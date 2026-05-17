// bridges/mcp/stage.ts
//
// MC-6 prepare/commit/abort for the MCP bridge, plus Phase 8 replacement
// exports: replacePreparedMcp, rollbackMcpReplacement, finalizeMcpReplacement. The prepare phase reads
// the scoped `mcp.json`, partitions existing entries into ours-vs-theirs
// by `_piClaudeMarketplace` marker, runs the four-slot cross-slot collision
// check (MC-4 / RN-5), short-circuits AS-8 noops, stamps the new entries
// with the marker (MC-5), and builds the merged doc IN MEMORY only.
// Commit is a single `atomicWriteJson` -- no per-file rename loop, no
// EXDEV risk, no partial-state recovery surface. Abort is a synchronous
// no-op because prepare wrote nothing to disk.
//
// V1 carry-forward (`mcp/stage.ts`, lines 81-173) with two deltas:
//   1. `MCP_COLLISION_SLOTS` is hoisted to a named export in
//      `collision-slots.ts` -- the V1 inline slot list moved there.
//   2. The plain-`Error` collision throw is replaced by typed
//      `McpServerCollisionError` so callers can `instanceof`-discriminate
//      the refusal category.
//
// W-05 fix: the commit result now carries `recorded: StagedMcpRecord[]`
// so Phase 5 can populate state.json from the bridge return value
// without re-deriving the per-server `targetPath`.

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpServerCollisionError } from "../../shared/errors-bridges.ts";
import { errorMessage } from "../../shared/errors.ts";

import { loadEffectiveServerNames } from "./collision-slots.ts";
import { CLAUDE_MARKETPLACE_MARKER_KEY, buildMarker, isOwnedBy } from "./marker.ts";

import type {
  McpReplacement,
  PreparedMcpStaging,
  RawMcpDoc,
  StageMcpCommitResult,
  StageMcpInput,
  StagedMcpRecord,
} from "./types.ts";

type McpReplacementInternals = Readonly<{
  oldText: string | undefined;
}>;

const mcpReplacementInternals = new WeakMap<
  Extract<McpReplacement, { kind: "replaced" }>,
  McpReplacementInternals
>();

/**
 * Read the scoped `mcp.json` document. ENOENT/ENOTDIR -> empty doc.
 * Top-level non-object (array / primitive) is treated as empty so a
 * malformed scoped doc cannot poison the ours/theirs partition; the
 * subsequent commit will overwrite it with a well-formed document.
 * Other I/O errors propagate.
 */
async function readScopedDoc(filePath: string): Promise<RawMcpDoc> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return {};
    }

    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tolerate malformed scoped doc -- treat as empty. The user's existing
    // foreign entries (if any) are lost on commit, which is acceptable
    // because a malformed mcp.json was already broken before we showed up.
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return parsed as RawMcpDoc;
}

/** Extract the `mcpServers` map. Missing/malformed -> {}. */
function getMcpServers(doc: RawMcpDoc): Record<string, unknown> {
  const m = doc.mcpServers;
  if (m === undefined || Array.isArray(m)) {
    return {};
  }

  return m;
}

function partitionExistingServers(
  existing: Record<string, unknown>,
  pluginName: string,
  marketplaceName: string,
): { ours: Set<string>; theirs: Record<string, unknown> } {
  const ours = new Set<string>();
  const theirs: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(existing)) {
    if (isOwnedBy(value, pluginName, marketplaceName)) {
      ours.add(name);
    } else {
      theirs[name] = value;
    }
  }

  return { ours, theirs };
}

async function assertNoMcpCollisions(input: {
  cwd: string;
  names: readonly string[];
  ours: ReadonlySet<string>;
  theirs: Record<string, unknown>;
  mcpJsonPath: string;
}): Promise<void> {
  if (input.names.length === 0) {
    return;
  }

  const effective = await loadEffectiveServerNames(input.cwd);
  for (const name of input.names) {
    if (input.ours.has(name)) {
      continue;
    }

    const owningPath = effective.get(name);
    if (owningPath !== undefined && owningPath !== input.mcpJsonPath) {
      throw new McpServerCollisionError(name, owningPath);
    }

    if (Object.hasOwn(input.theirs, name)) {
      throw new McpServerCollisionError(name, input.mcpJsonPath);
    }
  }
}

function stampServers(
  servers: Record<string, unknown>,
  pluginName: string,
  marketplaceName: string,
): Record<string, unknown> {
  const marker = buildMarker(pluginName, marketplaceName);
  const stamped: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    const entryObj =
      typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {};
    stamped[name] = { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker };
  }

  return stamped;
}

/**
 * MC-6 prepare: in-memory only. Reads the scope's `mcp.json`, partitions
 * existing entries by marker, runs the MC-4 cross-slot collision check
 * (self-replace within own scope is allowed; ours.has(name) is the
 * exemption), stamps every new entry with the marker (MC-5), and builds
 * the merged doc. AS-8 noop short-circuits when there is nothing new
 * AND nothing previously-ours -- in that case `commitPreparedMcp` writes
 * no file (PRD success criterion: AS-8 noop produces no `mcp.json`).
 *
 * Throws `McpServerCollisionError` on cross-slot conflict (NEW typed-error
 * delta vs V1's plain `Error`).
 */
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const { locations, cwd, marketplaceName, pluginName, servers } = input;

  const doc = await readScopedDoc(locations.mcpJsonPath);
  const existing = getMcpServers(doc);

  // Partition existing into ours-vs-theirs by marker (MC-5).
  const { ours, theirs } = partitionExistingServers(existing, pluginName, marketplaceName);

  const newNames = Object.keys(servers);

  // MC-4 / RN-5 cross-slot collision check. Self-replace inside own scope
  // is allowed (`ours.has(name)`); otherwise any existing declarer wins.
  await assertNoMcpCollisions({
    cwd,
    names: newNames,
    ours,
    theirs,
    mcpJsonPath: locations.mcpJsonPath,
  });

  // AS-8 noop: nothing new AND nothing previously-ours. Don't materialize
  // the file; commit returns the noop result without touching disk.
  if (newNames.length === 0 && ours.size === 0) {
    const noopResult: StageMcpCommitResult = {
      stagedNames: Object.freeze<string[]>([]),
      recorded: Object.freeze<StagedMcpRecord[]>([]),
      warnings: Object.freeze<string[]>([]),
    };
    return { kind: "noop", result: noopResult };
  }

  // MC-5 marker stamp -- every new entry carries `_piClaudeMarketplace`.
  const stamped = stampServers(servers, pluginName, marketplaceName);

  // Merge: keep theirs verbatim; replace ours with stamped (or drop if
  // no new servers but ours.size > 0).
  const next: RawMcpDoc = { ...doc, mcpServers: { ...theirs, ...stamped } };

  // W-05: Phase 5 reads `recorded` to populate state.json. `sourcePath`
  // is the canonical provenance the install path passes in (e.g.
  // "<pluginRoot>/.mcp.json" or "<pluginRoot>/<plugin>.json#mcpServers");
  // when omitted we fall back to a synthetic `<plugin>#mcpServers` tag.
  const sourcePath = input.sourcePath ?? `${pluginName}#mcpServers`;
  const recorded: readonly StagedMcpRecord[] = Object.freeze(
    newNames.map((generatedName) => ({
      generatedName,
      sourcePath,
      targetPath: locations.mcpJsonPath,
    })),
  );

  const result: StageMcpCommitResult = {
    stagedNames: Object.freeze([...newNames]),
    recorded,
    warnings: Object.freeze<string[]>([]),
  };

  return {
    kind: "staged",
    locations,
    stagedNames: result.stagedNames,
    result,
    _nextDoc: next,
  };
}

/**
 * MC-6 commit: a single `atomicWriteJson` for the staged branch; a
 * zero-op for the noop branch. Returns the same `StageMcpCommitResult`
 * the prepare phase computed (W-05) so Phase 5 has a stable hand-off
 * shape regardless of which branch the prepare took.
 */
export async function commitPreparedMcp(
  prepared: PreparedMcpStaging,
): Promise<StageMcpCommitResult> {
  if (prepared.kind === "noop") {
    return prepared.result;
  }

  await atomicWriteJson(prepared.locations.mcpJsonPath, prepared._nextDoc);
  return prepared.result;
}

/**
 * MC-6 abort: synchronous no-op. The prepare phase wrote nothing to
 * disk -- the merged doc lives only inside the discriminated union --
 * so there is nothing to roll back. Exists for symmetry with the agent
 * and skill bridges' prepare/commit/abort triplet.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function abortPreparedMcp(_prepared: PreparedMcpStaging): void {
  // No-op: nothing was written outside memory pre-commit.
}

export async function replacePreparedMcp(prepared: PreparedMcpStaging): Promise<McpReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  const oldText = await readOptionalText(prepared.locations.mcpJsonPath);
  await commitPreparedMcp(prepared);

  const replacement: Extract<McpReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
  };
  mcpReplacementInternals.set(replacement, { oldText });
  return replacement;
}

export async function rollbackMcpReplacement(
  replacement: McpReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireMcpReplacementInternals(replacement);
  const leaks: string[] = [];
  try {
    if (internals.oldText === undefined) {
      await rm(replacement.prepared.locations.mcpJsonPath, { force: true });
    } else {
      await mkdir(path.dirname(replacement.prepared.locations.mcpJsonPath), { recursive: true });
      await writeFileAtomic(replacement.prepared.locations.mcpJsonPath, internals.oldText, {
        encoding: "utf8",
      });
    }
  } catch (err) {
    leaks.push(
      `failed to restore mcp.json at ${replacement.prepared.locations.mcpJsonPath}: ${errorMessage(err)}`,
    );
  }

  return Object.freeze(leaks);
}

export function finalizeMcpReplacement(replacement: McpReplacement): readonly string[] {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  requireMcpReplacementInternals(replacement);
  return Object.freeze([]);
}

function requireMcpReplacementInternals(
  replacement: Extract<McpReplacement, { kind: "replaced" }>,
): McpReplacementInternals {
  const internals = mcpReplacementInternals.get(replacement);
  if (internals === undefined) {
    throw new Error("Unknown MCP replacement handle.");
  }

  return internals;
}

async function readOptionalText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw err;
  }
}
