// bridges/agents/grant-rewrite.ts
//
// MGRT-01 / D-MB-03: after a switch between MCP implementations, swap each
// generated agent file's frontmatter block for the active implementation's
// grant form. Installing or removing pi-mcp-adapter runs no plugin command,
// so only the load can bring the files in line.
//
// The agents index stores each form a row's agent renders to (its
// frontmatter block, warnings, and dropped tools) and names the form the file
// holds. The body is the same under both forms, so a swap replaces the
// recorded block at the start of the file and keeps every byte after it.
//
// Invariants:
//   1. `needsAgentGrantRewrite` reads without the state lock and writes
//      nothing, so a scope with nothing to rewrite never takes the lock and
//      a scope with no index stays absent. It reads each candidate's file and
//      counts the row only when the locked pass would change it: the file
//      passes containment and starts with a stored block, or is a legacy file
//      that translates. A row the locked pass leaves (an edited, missing, or
//      foreign file, a malformed stored form, or any row of an index with a
//      corrupt row) would otherwise take the lock again at every load.
//   2. `rewriteAgentGrantForms` runs under the caller's state lock (this
//      bridge cannot take it) and calls the caller's `assertLockHeld` before
//      each rename and before the index save, so a lock lost on the way
//      writes nothing more (D-06). It re-reads the index and saves nothing
//      when the re-read drops a corrupt row: a save would lose that row and
//      orphan its file (T-04-13).
//   3. A row is rewritten only after containment (NFR-10): its target lies
//      inside `<scopeRoot>/agents/` and is named `<generatedName>.md`. The
//      active form must carry the `---` frame and the generated marker before
//      it is written (AG-4).
//   4. A file is rewritten only when it starts with the recorded block byte
//      for byte; a file that starts with the active block only gets its row
//      fixed; anything else (edited by the user, missing, foreign) is left
//      (AG-5). The match is `startsWith` on the stored block, never a search
//      for `---`, because a body may hold a `---` line.
//   5. The new file is written under `agents-staging/` and renamed over the
//      target (NFR-1), never as a temporary file inside the watched agents
//      folder. The index is saved last, so a failure before the save heals at
//      the next load.
//   6. A row written before the index stored forms (P4-DC-06) gets its forms
//      from `legacy-grant-form.ts` under the lock, then the same swap; a
//      translation that gives up records the adapter form only, so the row
//      is not retried at every load.
//   7. Silent: every skip is debug-logged on the `mcp` channel and nothing
//      reaches the user (RECON-05).

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadAgentsIndex, saveAgentsIndex } from "../../persistence/agents-index-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage, StateLockCompromisedError } from "../../shared/errors.ts";
import { cleanupStaging } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { deriveLegacyGrantForms } from "./legacy-grant-form.ts";
import { GENERATED_AGENT_MARKER } from "./marker.ts";
import { mcpAsyncWarning } from "./mcp-async-warning.ts";

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";

type McpForm = NonNullable<NonNullable<AgentsIndexEntry["mcpForms"]>["adapter"]>;

/** One locked rewrite pass over a scope's agents index. */
interface RewriteRun {
  readonly locations: ScopedLocations;
  /** This pass's folder under `agents-staging/`. */
  readonly stagingDir: string;
  readonly active: McpImplementationId;
  /** D-06: throws StateLockCompromisedError once the caller's state lock is lost. */
  readonly assertLockHeld: () => void;
}

/** The two forms a candidate row swaps between. */
interface FormSwap {
  /** The form the row records its file holds. */
  readonly recorded: McpForm;
  /** The active implementation's form. */
  readonly active: McpForm;
}

/** A row's stored forms when the file holds another form than `active` and the active one is stored. */
function storedSwap(row: AgentsIndexEntry, active: McpImplementationId): FormSwap | undefined {
  if (row.mcpImplementation === undefined || row.mcpImplementation === active) {
    return undefined;
  }

  const recorded = row.mcpForms?.[row.mcpImplementation];
  const activeForm = row.mcpForms?.[active];
  return recorded === undefined || activeForm === undefined
    ? undefined
    : { recorded, active: activeForm };
}

/**
 * P4-DC-06: a row written before the index stored forms, under Pi's built-in
 * MCP. Its file holds the adapter form, and every such agent with MCP grants
 * carries the adapter async warning, so no file is read before the lock.
 */
function isLegacyCandidate(row: AgentsIndexEntry, active: McpImplementationId): boolean {
  return (
    active === "builtin" &&
    row.mcpImplementation === undefined &&
    row.mcpForms === undefined &&
    row.warnings.includes(mcpAsyncWarning("adapter"))
  );
}

function isCandidate(row: AgentsIndexEntry, active: McpImplementationId): boolean {
  return storedSwap(row, active) !== undefined || isLegacyCandidate(row, active);
}

/** AG-4: a block this bridge wrote opens and closes with `---` and carries the marker. */
function isGeneratedBlock(block: string): boolean {
  return (
    block.startsWith("---\n") && block.endsWith("\n---\n") && block.includes(GENERATED_AGENT_MARKER)
  );
}

/**
 * What a candidate file starts with, against the row's stored forms: the
 * recorded block (AG-5), the active block, neither, or a stored active form
 * that is not a generated block (AG-4).
 */
type HeldForm = "recorded" | "active" | "neither" | "malformed";

function heldForm(swap: FormSwap, text: string): HeldForm {
  if (!isGeneratedBlock(swap.active.frontmatter)) {
    return "malformed";
  }

  if (text.startsWith(swap.recorded.frontmatter)) {
    return "recorded";
  }

  return text.startsWith(swap.active.frontmatter) ? "active" : "neither";
}

/** NFR-10: the row's target lies in the scope's agents folder under its own name. */
async function assertRowContained(
  locations: ScopedLocations,
  row: AgentsIndexEntry,
): Promise<void> {
  await assertPathInside(locations.agentsDir, row.targetPath, "agent target path");
  if (path.basename(row.targetPath) !== `${row.generatedName}.md`) {
    throw new Error(`agent target ${row.targetPath} is not named ${row.generatedName}.md`);
  }
}

/** T-04-13: an index with a corrupt row is left whole, so no row of it is rewritten. */
function hasCorruptRow(locations: ScopedLocations, corruptions: readonly string[]): boolean {
  if (corruptions.length === 0) {
    return false;
  }

  hookDebugLog(
    `agent grants of ${locations.scope} scope left: the agents index has a corrupt row`,
    "mcp",
  );
  return true;
}

/**
 * Whether the locked pass changes this candidate's row given its file text:
 * a file that starts with a stored block, or a legacy file that translates.
 */
function changesRow(row: AgentsIndexEntry, active: McpImplementationId, text: string): boolean {
  const swap = storedSwap(row, active);
  if (swap === undefined) {
    return deriveLegacyGrantForms(text, row) !== undefined;
  }

  const held = heldForm(swap, text);
  return held === "recorded" || held === "active";
}

/** Whether the locked pass changes `row`; read without the lock, so a failure is no work. */
async function isRewritable(
  locations: ScopedLocations,
  row: AgentsIndexEntry,
  active: McpImplementationId,
): Promise<boolean> {
  if (!isCandidate(row, active)) {
    return false;
  }

  try {
    await assertRowContained(locations, row);
    return changesRow(row, active, await readFile(row.targetPath, "utf8"));
  } catch {
    return false;
  }
}

/**
 * MGRT-01: true when the locked pass would change some row of the scope's
 * agents index: a row that records another grant form than `active`, stores
 * the active one, and whose file starts with a stored block, or a legacy row
 * whose file a built-in session translates (P4-DC-06). Reads without the
 * lock; a missing index is no work, and nothing is created.
 */
export async function needsAgentGrantRewrite(
  locations: ScopedLocations,
  active: McpImplementationId,
): Promise<boolean> {
  const index = await loadAgentsIndex(locations);
  if (hasCorruptRow(locations, index.corruptions)) {
    return false;
  }

  const rewritable = await Promise.all(
    index.agents.map((row) => isRewritable(locations, row, active)),
  );
  return rewritable.includes(true);
}

/**
 * NFR-1: writes `content` under the staging folder and renames it over the
 * row's target while the state lock is still held (D-06).
 */
async function replaceAgentFile(
  run: RewriteRun,
  row: AgentsIndexEntry,
  content: string,
): Promise<void> {
  await mkdir(run.stagingDir, { recursive: true });
  const staged = path.join(run.stagingDir, `${row.generatedName}.md`);
  await assertPathInside(run.stagingDir, staged, "staged agent file");
  await writeFile(staged, content, "utf8");
  run.assertLockHeld();
  await rename(staged, row.targetPath);
}

/** The row once it records `active`, with that form's warnings and dropped tools. */
function rowForActive(
  row: AgentsIndexEntry,
  active: McpImplementationId,
  form: McpForm,
): AgentsIndexEntry {
  return {
    ...row,
    mcpImplementation: active,
    warnings: [...form.warnings],
    droppedTools: [...form.droppedTools],
  };
}

/**
 * Swaps one candidate file's text for the active form and returns the row to
 * save; the row itself when the file is left.
 */
async function swapFile(
  run: RewriteRun,
  row: AgentsIndexEntry,
  swap: FormSwap,
  text: string,
): Promise<AgentsIndexEntry> {
  const held = heldForm(swap, text);
  if (held === "malformed") {
    hookDebugLog(`agent ${row.generatedName}: the stored ${run.active} form is malformed`, "mcp");
    return row;
  }

  if (held === "neither") {
    hookDebugLog(`agent ${row.generatedName}: the file holds neither stored form`, "mcp");
    return row;
  }

  if (held === "recorded") {
    const body = text.slice(swap.recorded.frontmatter.length);
    await replaceAgentFile(run, row, swap.active.frontmatter + body);
  }

  return rowForActive(row, run.active, swap.active);
}

/**
 * P4-DC-06: a legacy row gets its forms from its file's text, then the same
 * swap to the built-in form. A translation that gives up records the adapter
 * form only, so the row is not a candidate again.
 */
async function translateLegacyFile(
  run: RewriteRun,
  row: AgentsIndexEntry,
  text: string,
): Promise<AgentsIndexEntry> {
  const recorded = deriveLegacyGrantForms(text, row);
  if (recorded === undefined) {
    hookDebugLog(`agent ${row.generatedName}: the legacy file is not a generated agent`, "mcp");
    return row;
  }

  const swap = storedSwap(recorded, "builtin");
  if (swap === undefined) {
    hookDebugLog(`agent ${row.generatedName}: no exact built-in translation`, "mcp");
    return recorded;
  }

  return swapFile(run, recorded, swap, text);
}

/** Rewrites one candidate row after containment; throws when containment or the read fails. */
async function rewriteCandidate(run: RewriteRun, row: AgentsIndexEntry): Promise<AgentsIndexEntry> {
  await assertRowContained(run.locations, row);
  const text = await readFile(row.targetPath, "utf8");
  const swap = storedSwap(row, run.active);
  return swap === undefined ? translateLegacyFile(run, row, text) : swapFile(run, row, swap, text);
}

/**
 * One row's outcome: rewritten, fixed, or left; a failure leaves the row. A
 * lost state lock ends the pass instead (D-06).
 */
async function rewriteRow(run: RewriteRun, row: AgentsIndexEntry): Promise<AgentsIndexEntry> {
  if (!isCandidate(row, run.active)) {
    return row;
  }

  try {
    return await rewriteCandidate(run, row);
  } catch (err) {
    if (err instanceof StateLockCompromisedError) {
      throw err;
    }

    hookDebugLog(`agent ${row.generatedName}: grant rewrite skipped: ${errorMessage(err)}`, "mcp");
    return row;
  }
}

/**
 * Rewrites every candidate row, then saves the index last when a row changed
 * and the state lock is still held (D-06).
 */
async function rewriteRows(run: RewriteRun, rows: readonly AgentsIndexEntry[]): Promise<void> {
  const next: AgentsIndexEntry[] = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop -- one rename at a time, each settled before the index save
    next.push(await rewriteRow(run, row));
  }

  if (next.some((row, i) => row !== rows[i])) {
    run.assertLockHeld();
    await saveAgentsIndex(run.locations, { schemaVersion: 1, agents: next });
  }
}

/**
 * MGRT-01 / D-MB-03: swaps each candidate agent file's frontmatter block for
 * the `active` form and saves the index last. The caller holds the scope's
 * state lock and passes its `assertLockHeld`, which this calls before each
 * rename and before the save; a lost lock rejects with its error (D-06).
 * Reports nothing to the user; skips are debug-logged.
 */
export async function rewriteAgentGrantForms(
  locations: ScopedLocations,
  active: McpImplementationId,
  ops: RemovalOps,
  assertLockHeld: () => void,
): Promise<void> {
  const index = await loadAgentsIndex(locations);
  if (hasCorruptRow(locations, index.corruptions)) {
    return;
  }

  const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
  try {
    await rewriteRows({ locations, stagingDir, active, assertLockHeld }, index.agents);
  } finally {
    const leak = await cleanupStaging(ops, stagingDir, "agents staging directory");
    if (leak !== undefined) {
      hookDebugLog(leak, "mcp");
    }
  }
}
