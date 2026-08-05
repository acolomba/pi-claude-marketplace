// bridges/mcp/stage.ts
//
// MC-6 prepare/commit/abort for the MCP bridge, plus replacement
// exports: replacePreparedMcp, rollbackMcpReplacement, finalizeMcpReplacement.
// The prepare phase reads
// the scoped `mcp.json`, partitions existing entries into ours-vs-theirs
// by `_piClaudeMarketplace` marker, runs the four-slot cross-slot collision
// check (MC-4 / RN-5), short-circuits AS-8 noops, stamps the new entries
// with the marker (MC-5), and builds the merged doc IN MEMORY only.
// Commit is a single `atomicWriteJson` -- no per-file rename loop, no
// EXDEV risk, no partial-state recovery surface. Abort is a synchronous
// no-op because prepare wrote nothing to disk.
//
// The collision throw is a typed `McpServerCollisionError` so callers can
// `instanceof`-discriminate the refusal category.
//
// W-05: the commit result carries `recorded: StagedMcpRecord[]` so callers
// can populate state.json from the bridge return value without re-deriving
// the per-server `targetPath`.

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import { atomicWriteJson } from "../../shared/atomic-json.ts";
import { McpServerCollisionError } from "../../shared/errors-bridges.ts";
import { errorMessage } from "../../shared/errors.ts";

import { loadEffectiveServerNames } from "./collision-slots.ts";
import { CLAUDE_MARKETPLACE_MARKER_KEY, buildMarker, isOwnedBy } from "./marker.ts";
import { safeSet } from "./safe-set.ts";
import { substituteAndInject, type McpSubstitutionContext } from "./substitute.ts";

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
 * Top-level non-object (array / primitive) or unparseable JSON is treated as
 * empty so a malformed scoped doc cannot poison the ours/theirs partition;
 * the subsequent commit will overwrite it with a well-formed document.
 * `malformed` reports that tolerance so the staged branch can surface a
 * warning naming the file before its foreign content is dropped.
 * Other I/O errors propagate.
 */
async function readScopedDoc(filePath: string): Promise<{ doc: RawMcpDoc; malformed: boolean }> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") {
      return { doc: {}, malformed: false };
    }

    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Tolerate malformed scoped doc -- treat as empty. The user's existing
    // foreign entries (if any) are lost on commit; the staged branch surfaces
    // that as a warning rather than silently.
    return { doc: {}, malformed: true };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { doc: {}, malformed: true };
  }

  return { doc: parsed as RawMcpDoc, malformed: false };
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
      // safeSet copies a server literally named `__proto__` verbatim as an own
      // key rather than routing it through the inherited setter (which would
      // drop it, silently losing the user's foreign entry) -- WR-01.
      safeSet(theirs, name, value);
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stampServers(
  servers: Record<string, unknown>,
  pluginName: string,
  marketplaceName: string,
  subCtx: McpSubstitutionContext,
): { stamped: Record<string, unknown>; warnings: string[] } {
  const marker = buildMarker(pluginName, marketplaceName);
  const stamped: Record<string, unknown> = {};
  const warnings: string[] = [];
  for (const [name, entry] of Object.entries(servers)) {
    // Deep-substitute + inject env BEFORE the marker is spread on, so the
    // marker never enters the walk (MENV-01/02, D-92-01/02). Non-object
    // entries keep the existing `{}` tolerance -- no substitution attempted --
    // but each normalization is surfaced as a warning instead of silently
    // reporting a dead entry as staged.
    let entryObj: Record<string, unknown>;
    if (isPlainObject(entry)) {
      // A malformed declared env on a stdio entry is discarded by the
      // injection step (injected defaults only); say so instead of leaving
      // the plugin author to diff mcp.json against their source.
      if (
        typeof entry.command === "string" &&
        entry.env !== undefined &&
        !isPlainObject(entry.env)
      ) {
        warnings.push(
          `mcp server "${name}": declared env is not an object; it was ignored (injected defaults only)`,
        );
      }

      entryObj = substituteAndInject(entry, subCtx);
    } else {
      warnings.push(`mcp server "${name}": entry is not an object; staged as an empty entry`);
      entryObj = {};
    }

    // safeSet copies a plugin-declared server literally named `__proto__` as an
    // own key so it is stamped and written rather than dropped via the
    // inherited setter (which would diverge state.json from disk) -- WR-01.
    safeSet(stamped, name, { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker });
  }

  return { stamped, warnings };
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
 * Throws `McpServerCollisionError` on cross-slot conflict.
 */
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const { locations, cwd, marketplaceName, pluginName, servers, pluginRoot, pluginData } = input;

  const { doc, malformed } = await readScopedDoc(locations.mcpJsonPath);
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
  // The CLAUDE_PROJECT_DIR arm is decided HERE, once (MENV-03): project scope
  // resolves it to the project root `cwd` (NOT scopeRoot); user scope carries
  // `undefined` so neither substitution nor injection can emit it.
  const subCtx: McpSubstitutionContext = {
    pluginRoot,
    pluginData,
    projectDir: locations.scope === "project" ? cwd : undefined,
  };
  const { stamped, warnings: stampWarnings } = stampServers(
    servers,
    pluginName,
    marketplaceName,
    subCtx,
  );

  // The commit overwrite is what actually destroys a malformed doc's foreign
  // entries, and only the staged branch commits -- so the warning lives here,
  // not on the AS-8 noop branch (which writes nothing).
  const docWarnings = malformed
    ? [
        `existing mcp.json at ${locations.mcpJsonPath} is malformed; it will be replaced (non-plugin entries in it are lost)`,
      ]
    : [];

  // Merge: keep theirs verbatim; replace ours with stamped (or drop if
  // no new servers but ours.size > 0).
  const next: RawMcpDoc = { ...doc, mcpServers: { ...theirs, ...stamped } };

  // W-05: callers read `recorded` to populate state.json. `sourcePath`
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
    warnings: Object.freeze([...docWarnings, ...stampWarnings]),
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
 * the prepare phase computed (W-05) so callers have a stable hand-off
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
