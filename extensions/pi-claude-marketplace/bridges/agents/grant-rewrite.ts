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
//      a scope with no index stays absent.
//   2. `rewriteAgentGrantForms` runs under the caller's state lock (this
//      bridge cannot take it). It re-reads the index and saves nothing when
//      the re-read drops a corrupt row: a save would lose that row and orphan
//      its file (T-04-13).
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
//   6. Silent: every skip is debug-logged on the `mcp` channel and nothing
//      reaches the user (RECON-05).

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadAgentsIndex, saveAgentsIndex } from "../../persistence/agents-index-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { cleanupStaging } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { GENERATED_AGENT_MARKER } from "./marker.ts";

import type { McpImplementationId } from "../../domain/mcp-implementation.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";

type McpForm = NonNullable<NonNullable<AgentsIndexEntry["mcpForms"]>["adapter"]>;

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
 * MGRT-01: true when some row of the scope's agents index records another
 * grant form than `active` and stores the active one. Reads without the lock;
 * a missing index is no work, and nothing is created.
 */
export async function needsAgentGrantRewrite(
  locations: ScopedLocations,
  active: McpImplementationId,
): Promise<boolean> {
  const index = await loadAgentsIndex(locations);
  return index.agents.some((row) => storedSwap(row, active) !== undefined);
}

/** AG-4: a block this bridge wrote opens and closes with `---` and carries the marker. */
function isGeneratedBlock(block: string): boolean {
  return (
    block.startsWith("---\n") && block.endsWith("\n---\n") && block.includes(GENERATED_AGENT_MARKER)
  );
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

/** NFR-1: writes `content` under the staging folder and renames it over the row's target. */
async function replaceAgentFile(
  stagingDir: string,
  row: AgentsIndexEntry,
  content: string,
): Promise<void> {
  await mkdir(stagingDir, { recursive: true });
  const staged = path.join(stagingDir, `${row.generatedName}.md`);
  await assertPathInside(stagingDir, staged, "staged agent file");
  await writeFile(staged, content, "utf8");
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
 * Swaps one candidate row's file and returns the row to save; the row
 * itself when the file is left. Throws when containment or a read fails.
 */
async function swapRow(
  locations: ScopedLocations,
  stagingDir: string,
  row: AgentsIndexEntry,
  active: McpImplementationId,
  swap: FormSwap,
): Promise<AgentsIndexEntry> {
  await assertRowContained(locations, row);
  if (!isGeneratedBlock(swap.active.frontmatter)) {
    hookDebugLog(`agent ${row.generatedName}: the stored ${active} form is malformed`, "mcp");
    return row;
  }

  const text = await readFile(row.targetPath, "utf8");
  if (text.startsWith(swap.recorded.frontmatter)) {
    const body = text.slice(swap.recorded.frontmatter.length);
    await replaceAgentFile(stagingDir, row, swap.active.frontmatter + body);
  } else if (!text.startsWith(swap.active.frontmatter)) {
    hookDebugLog(`agent ${row.generatedName}: the file holds neither stored form`, "mcp");
    return row;
  }

  return rowForActive(row, active, swap.active);
}

/** One row's outcome: rewritten, fixed, or left; a failure leaves the row. */
async function rewriteRow(
  locations: ScopedLocations,
  stagingDir: string,
  row: AgentsIndexEntry,
  active: McpImplementationId,
): Promise<AgentsIndexEntry> {
  const swap = storedSwap(row, active);
  if (swap === undefined) {
    return row;
  }

  try {
    return await swapRow(locations, stagingDir, row, active, swap);
  } catch (err) {
    hookDebugLog(`agent ${row.generatedName}: grant rewrite skipped: ${errorMessage(err)}`, "mcp");
    return row;
  }
}

/** Rewrites every candidate row, then saves the index last when a row changed. */
async function rewriteRows(
  locations: ScopedLocations,
  stagingDir: string,
  rows: readonly AgentsIndexEntry[],
  active: McpImplementationId,
): Promise<void> {
  const next: AgentsIndexEntry[] = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop -- one rename at a time, each settled before the index save
    next.push(await rewriteRow(locations, stagingDir, row, active));
  }

  if (next.some((row, i) => row !== rows[i])) {
    await saveAgentsIndex(locations, { schemaVersion: 1, agents: next });
  }
}

/**
 * MGRT-01 / D-MB-03: swaps each candidate agent file's frontmatter block for
 * the `active` form and saves the index last. The caller holds the scope's
 * state lock. Reports nothing to the user; skips are debug-logged.
 */
export async function rewriteAgentGrantForms(
  locations: ScopedLocations,
  active: McpImplementationId,
  ops: RemovalOps,
): Promise<void> {
  const index = await loadAgentsIndex(locations);
  if (index.corruptions.length > 0) {
    hookDebugLog(
      `agent grants of ${locations.scope} scope left: the agents index has a corrupt row`,
      "mcp",
    );
    return;
  }

  const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
  try {
    await rewriteRows(locations, stagingDir, index.agents, active);
  } finally {
    const leak = await cleanupStaging(ops, stagingDir, "agents staging directory");
    if (leak !== undefined) {
      hookDebugLog(leak, "mcp");
    }
  }
}
