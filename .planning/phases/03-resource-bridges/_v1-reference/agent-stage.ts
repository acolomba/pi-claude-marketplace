import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { appendLeakToError, errorMessage } from "../errors.ts";
import { atomicWriteJson, cleanupStaging } from "../fs-utils.ts";
import {
  assertPathInside,
  assertSafeName,
  validateNonEmptyString,
  validateStringArray,
} from "../validation.ts";

import {
  assertNoAgentCollisions,
  convertAgent,
  discoverPluginAgents,
  type ConvertedAgent,
} from "./convert.ts";
import { GENERATED_AGENT_MARKER } from "./frontmatter.ts";

import type { ScopedLocations } from "../location/index.ts";

// Re-export commonly-used names so plugin-side consumers don't need to know
// which agent/* module owns each piece.
export { GENERATED_AGENT_MARKER } from "./frontmatter.ts";
export {
  assertNoAgentCollisions,
  convertAgent,
  discoverPluginAgents,
  generateAgentName,
  type ConvertedAgent,
  type DiscoveredAgent,
} from "./convert.ts";

/** Filename prefix that identifies a generated agent file on disk. Safety
 *  checks reject any target whose basename does not start with this. */
const GENERATED_AGENT_PREFIX = "pi-claude-marketplace-";

export interface AgentIndexEntry {
  plugin: string;
  /** Marketplace name -- needed for cross-marketplace cleanup in removeMarketplace. */
  marketplace: string;
  sourceAgent: string;
  generatedName: string;
  sourcePath: string;
  targetPath: string;
  sourceHash: string;
  originalModel?: string;
  droppedFields: string[];
  droppedTools: string[];
  warnings: string[];
}

/** On-disk shape of the agent index. Persisted form -- save accepts this. */
export interface AgentIndexFileOnDisk {
  schemaVersion: 1;
  agents: AgentIndexEntry[];
}

/** In-memory shape returned by `loadAgentIndex`. Adds a transient
 *  `corruptions` field listing per-row entries that failed schema
 *  validation and were dropped, so callers can surface a recovery hint.
 *  This field is NOT persisted; `saveAgentIndex` accepts an
 *  `AgentIndexFileOnDisk` and never writes corruptions back. */
export interface LoadedAgentIndex extends AgentIndexFileOnDisk {
  corruptions: readonly string[];
}

/** Load the agent index from `locations.agentsIndexPath`. Missing file
 *  returns the empty default. File-level errors (JSON parse, unknown
 *  schema, non-array `agents`) throw -- they leave the index
 *  uninterpretable. Per-row validation failures soft-fail: the bad row is
 *  dropped from the returned `agents` and its label is collected into
 *  `corruptions` so callers can surface a recovery hint. The pre-fix
 *  behavior threw on the first bad row, blocking every other plugin's
 *  index operation indefinitely. */
export async function loadAgentIndex(locations: ScopedLocations): Promise<LoadedAgentIndex> {
  const indexPath = locations.agentsIndexPath;
  let text: string;
  try {
    text = await readFile(indexPath, "utf8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: 1, agents: [], corruptions: Object.freeze([]) };
    }

    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse agent index at ${indexPath}: ${errorMessage(err)}`, {
      cause: err,
    });
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
  ) {
    throw new Error(`Unsupported agent index schema at ${indexPath}: expected schemaVersion 1.`);
  }

  const obj = parsed as { schemaVersion: 1; agents?: unknown };
  if (!Array.isArray(obj.agents)) {
    throw new Error(`Malformed agent index at ${indexPath}: "agents" must be an array.`);
  }

  const validAgents: AgentIndexEntry[] = [];
  const corruptions: string[] = [];
  for (const [index, entry] of obj.agents.entries()) {
    try {
      validAgents.push(
        validateAgentIndexEntry(entry, locations.agentsDir, `${indexPath}.agents[${index}]`),
      );
    } catch (err) {
      corruptions.push(`${indexPath}.agents[${index}]: ${errorMessage(err)}`);
    }
  }

  return { schemaVersion: 1, agents: validAgents, corruptions };
}

function validateAgentIndexEntry(
  value: unknown,
  agentsDir: string,
  label: string,
): AgentIndexEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const obj = value as Record<string, unknown>;
  assertSafeName(obj.plugin, `${label}.plugin`);
  assertSafeName(obj.marketplace, `${label}.marketplace`);
  assertSafeName(obj.sourceAgent, `${label}.sourceAgent`);
  assertSafeName(obj.generatedName, `${label}.generatedName`);
  const sourcePath = validateNonEmptyString(obj.sourcePath, `${label}.sourcePath`);
  const targetPath = validateNonEmptyString(obj.targetPath, `${label}.targetPath`);
  assertPathInside(agentsDir, targetPath, `${label}.targetPath`);
  if (path.basename(targetPath) !== obj.generatedName + ".md") {
    throw new Error(`${label}.targetPath basename must match generatedName.`);
  }

  const sourceHash = validateNonEmptyString(obj.sourceHash, `${label}.sourceHash`);
  const entry: AgentIndexEntry = {
    plugin: obj.plugin,
    marketplace: obj.marketplace,
    sourceAgent: obj.sourceAgent,
    generatedName: obj.generatedName,
    sourcePath,
    targetPath,
    sourceHash,
    droppedFields: validateStringArray(obj.droppedFields, `${label}.droppedFields`),
    droppedTools: validateStringArray(obj.droppedTools, `${label}.droppedTools`),
    warnings: validateStringArray(obj.warnings, `${label}.warnings`),
  };
  if (obj.originalModel !== undefined) {
    entry.originalModel = validateNonEmptyString(obj.originalModel, `${label}.originalModel`);
  }

  return entry;
}

/** Persist the agent index atomically (tmp + rename) at
 *  `locations.agentsIndexPath`. Accepts the on-disk shape only -- the
 *  in-memory `corruptions` field on `LoadedAgentIndex` is a transient
 *  load-time marker and would never be written even if passed. */
export async function saveAgentIndex(
  locations: ScopedLocations,
  index: AgentIndexFileOnDisk,
): Promise<void> {
  const persisted: AgentIndexFileOnDisk = {
    schemaVersion: 1,
    agents: index.agents.map((entry, entryIndex) =>
      validateAgentIndexEntry(
        entry,
        locations.agentsDir,
        `agent index to save.agents[${entryIndex}]`,
      ),
    ),
  };
  await atomicWriteJson(locations.agentsIndexPath, persisted);
}

type SafetyResult = { ok: true } | { ok: false; reason: string };

/** Validate that `targetPath` is safe to overwrite or delete. The caller
 *  must already have verified the target appears in the index for this scope
 *  (i.e. we own it); this helper handles the on-disk basename + marker checks.
 *
 *  Rules:
 *  - Missing file (ENOENT) -> ok (nothing to clobber).
 *  - Filename must start with `pi-claude-marketplace-`.
 *  - File must contain GENERATED_AGENT_MARKER. */
async function isSafeToTouch(targetPath: string): Promise<SafetyResult> {
  const base = path.basename(targetPath);
  if (!base.startsWith(GENERATED_AGENT_PREFIX)) {
    return {
      ok: false,
      reason: `target filename "${base}" does not start with "${GENERATED_AGENT_PREFIX}"`,
    };
  }

  let contents: string;
  try {
    contents = await readFile(targetPath, "utf8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: true };
    }

    // EACCES, EISDIR, etc. propagate to caller.
    throw err;
  }

  if (!contents.includes(GENERATED_AGENT_MARKER)) {
    return {
      ok: false,
      reason: `target ${targetPath} is missing the generated marker`,
    };
  }

  return { ok: true };
}

export interface StagePluginAgentsInput {
  locations: ScopedLocations;
  marketplaceName: string;
  pluginName: string;
  pluginRoot: string;
  pluginDataDir: string;
  /** Staged skill names for this plugin (used to validate `skills:` refs). */
  knownSkills: readonly string[];
  /** Absolute path to the source agents/ dir in the plugin, OR ""/missing
   *  -> the plugin declares no agents. Distinct from `locations.agentsDir`
   *  which is the SCOPED destination (`<scopeRoot>/agents/`). */
  agentsSourceDir: string;
}

export interface StagePluginAgentsResult {
  /** Names of generated agents written. May be empty if the plugin has no agents directory. */
  stagedNames: string[];
  /** Aggregated warnings + dropped-field summary across all staged agents,
   *  plus any "leaked staging dir" notes from best-effort cleanup. */
  warnings: string[];
}

/** Format the per-agent warnings collected during conversion into the flat
 *  array the handler renders. */
function formatAgentWarnings(converted: ConvertedAgent): string[] {
  const out: string[] = [];
  for (const w of converted.warnings) {
    out.push(`[${converted.sourceName}] ${w}`);
  }

  if (converted.droppedFields.length > 0) {
    out.push(`[${converted.sourceName}] dropped fields: ${converted.droppedFields.join(", ")}`);
  }

  if (converted.droppedTools.length > 0) {
    out.push(`[${converted.sourceName}] dropped tools: ${converted.droppedTools.join(", ")}`);
  }

  return out;
}

const cleanupAgentsStaging = (stagingDir: string): Promise<string | undefined> =>
  cleanupStaging(stagingDir, "agents staging directory");

/**
 * Phase-1 output of two-phase staging. Treat the underscore-prefixed fields
 * as opaque; pass the bundle to `commitPreparedAgents` or `abortPreparedAgents`.
 *
 * Discriminated union of two shapes:
 *   - "noop": the plugin has no agents AND no previous index entries; no
 *     I/O happened during prepare and commit/abort are no-ops.
 *   - "staged": files are written into `stagingDir` and ready for the
 *     atomic rename + index save in `commitPreparedAgents`.
 *
 * The discriminator lets commit/abort branch on `kind` instead of an
 * empty-string sentinel on `stagingDir`.
 */
export type PreparedAgentsStaging = PreparedAgentsNoop | PreparedAgentsStaged;

export interface PreparedAgentsNoop {
  readonly kind: "noop";
  /** Empty stagedNames + empty warnings; included so callers can read
   *  `result` uniformly across both variants. */
  readonly result: StagePluginAgentsResult;
}

export interface PreparedAgentsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagingDir: string;
  /** Names + warnings, computed during prepare so callers can persist state
   *  records (which include the staged agent names) before commit. */
  readonly result: StagePluginAgentsResult;
  // The underscore-prefixed fields are internal state shared between
  // prepare and commit/abort. `readonly` on both the field and the array
  // contents prevents callers from mutating the rename plan in flight.
  readonly _previousEntries: readonly AgentIndexEntry[];
  readonly _otherEntries: readonly AgentIndexEntry[];
  readonly _newEntries: readonly AgentIndexEntry[];
  readonly _stagedFilePaths: readonly { from: string; to: string }[];
}

/**
 * Phase 1: discover, convert, safety-check, and write new agent files into a
 * tmp staging dir. No file outside that tmp dir is touched, and the on-disk
 * agent index is not mutated. Safe to abort with `abortPreparedAgents`.
 *
 * Throws on any precondition failure (collision, cross-plugin name owned by
 * another plugin, foreign content where a previous file should be).
 */
export async function prepareStagePluginAgents(
  input: StagePluginAgentsInput,
): Promise<PreparedAgentsStaging> {
  const {
    locations,
    marketplaceName,
    pluginName,
    pluginRoot,
    pluginDataDir,
    knownSkills,
    agentsSourceDir,
  } = input;

  const scopedAgentsDir = locations.agentsDir;

  // 1. Discover + convert. agentsSourceDir === "" means the plugin declares
  //    no agents directory; treat as zero discovered agents but keep going
  //    so previous index entries for this plugin still get cleaned up at
  //    commit.
  const discovered =
    agentsSourceDir === ""
      ? []
      : await discoverPluginAgents({ pluginName, agentsDir: agentsSourceDir });

  // 2. Collision detection within this plugin's set.
  assertNoAgentCollisions(discovered);

  const converted: ConvertedAgent[] = discovered.map((d) =>
    convertAgent({
      pluginName,
      pluginRoot,
      pluginDataDir,
      knownSkills,
      discovered: d,
      sourceHash: d.sourceHash,
    }),
  );

  // 3. Load index, partition by (marketplace, plugin).
  const existingIndex = await loadAgentIndex(locations);
  const previousEntries = existingIndex.agents.filter(
    (e) => e.marketplace === marketplaceName && e.plugin === pluginName,
  );
  const otherEntries = existingIndex.agents.filter(
    (e) => !(e.marketplace === marketplaceName && e.plugin === pluginName),
  );

  // 3b. Cross-plugin name guard: reject if a new name is already owned by a
  //     different (marketplace, plugin). Without this, rename in step 7 would
  //     silently clobber a foreign bridge file.
  const otherNames = new Map(otherEntries.map((e) => [e.generatedName, e]));
  const conflicts = converted
    .map((c) => ({
      name: c.generatedName,
      owner: otherNames.get(c.generatedName),
    }))
    .filter((x): x is { name: string; owner: AgentIndexEntry } => x.owner !== undefined);
  if (conflicts.length > 0) {
    const list = conflicts
      .map((c) => `"${c.name}" already owned by ${c.owner.marketplace}/${c.owner.plugin}`)
      .join("; ");
    throw new Error(`Refusing to stage agents for ${marketplaceName}/${pluginName}: ${list}.`);
  }

  // 3c. Nothing to write and nothing to clean up -- skip all I/O so we don't
  //     materialize the scoped agents dir for plugins that have never had
  //     agents.
  if (converted.length === 0 && previousEntries.length === 0) {
    return { kind: "noop", result: { stagedNames: [], warnings: [] } };
  }

  // 4. Safety-check each previous target before any disk write.
  for (const entry of previousEntries) {
    const safety = await isSafeToTouch(entry.targetPath);
    if (!safety.ok) {
      throw new Error(`Refusing to overwrite agent file at ${entry.targetPath}: ${safety.reason}`);
    }
  }

  // 5. Write staged files into tmp dir under the extension's private
  //    agents-staging dir. Same scopeRoot as agentsDir, so the rename in
  //    step 7 stays atomic.
  const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
  await mkdir(stagingDir, { recursive: true });

  const stagedFilePaths: { from: string; to: string }[] = [];
  try {
    for (const c of converted) {
      assertSafeName(c.generatedName, "generated agent name");
      const targetFile = path.join(scopedAgentsDir, c.generatedName + ".md");
      const stagedFile = path.join(stagingDir, c.generatedName + ".md");
      assertPathInside(scopedAgentsDir, targetFile, "agent target path");
      assertPathInside(stagingDir, stagedFile, "staged agent path");
      await writeFile(stagedFile, c.fileContent, "utf8");
      stagedFilePaths.push({ from: stagedFile, to: targetFile });
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupAgentsStaging(stagingDir));
  }

  const newEntries: AgentIndexEntry[] = converted.map((c) => {
    const entry: AgentIndexEntry = {
      plugin: pluginName,
      marketplace: marketplaceName,
      sourceAgent: c.sourceName,
      generatedName: c.generatedName,
      sourcePath: c.sourcePath,
      targetPath: path.join(scopedAgentsDir, c.generatedName + ".md"),
      sourceHash: c.sourceHash,
      droppedFields: [...c.droppedFields],
      droppedTools: [...c.droppedTools],
      warnings: [...c.warnings],
    };
    if (c.originalModel !== undefined) {
      entry.originalModel = c.originalModel;
    }

    return entry;
  });

  const aggregatedWarnings: string[] = [];
  for (const c of converted) {
    aggregatedWarnings.push(...formatAgentWarnings(c));
  }

  // Surface any per-row corruption that loadAgentIndex dropped on read.
  // The bad rows have already been excluded from previousEntries/otherEntries,
  // so cross-plugin guards run against the cleaned subset; the user just
  // gets a warning so they can reinstall the plugin behind the bad row.
  for (const corruption of existingIndex.corruptions) {
    aggregatedWarnings.push(`agent index corruption (entry dropped): ${corruption}`);
  }

  return {
    kind: "staged",
    locations,
    stagingDir,
    result: {
      stagedNames: converted.map((c) => c.generatedName),
      warnings: aggregatedWarnings,
    },
    _previousEntries: previousEntries,
    _otherEntries: otherEntries,
    _newEntries: newEntries,
    _stagedFilePaths: stagedFilePaths,
  };
}

/**
 * Phase 2: remove previous target files, rename staged files into the scoped
 * agents dir, persist the new index, clean up the tmp dir.
 *
 * If steps 6-7 fail partway, the on-disk agent files may be removed (or
 * partially removed) while the index file still describes the OLD entries
 * (saveAgentIndex was never reached). The next call to unstagePluginAgents
 * tolerates ENOENT on the previous targetPaths, so the skew self-heals on
 * the user's retry.
 */
export async function commitPreparedAgents(
  prepared: PreparedAgentsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  const { locations, stagingDir, _previousEntries, _otherEntries, _newEntries, _stagedFilePaths } =
    prepared;

  // 6. Remove old target files. ENOENT is fine.
  try {
    await Promise.all(
      _previousEntries.map(async (entry) => {
        try {
          await rm(entry.targetPath);
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code !== "ENOENT") {
            throw err;
          }
        }
      }),
    );
  } catch (err) {
    throw appendLeakToError(err, await cleanupAgentsStaging(stagingDir));
  }

  // 7. Ensure scoped agents dir + rename staged files into place.
  try {
    await mkdir(locations.agentsDir, { recursive: true });
    await Promise.all(_stagedFilePaths.map(({ from, to }) => rename(from, to)));
  } catch (err) {
    throw appendLeakToError(err, await cleanupAgentsStaging(stagingDir));
  }

  // 8. Persist new index.
  await saveAgentIndex(locations, {
    schemaVersion: 1,
    agents: [..._otherEntries, ..._newEntries],
  });

  // 9. Best-effort cleanup. Returns the leak (if any) for callers to fold
  //    into their result.warnings instead of dropping it on stderr.
  return cleanupAgentsStaging(stagingDir);
}

/**
 * Cleanup-only path. Use when the caller decides not to commit (e.g. saveState
 * failed after prepare). The scoped agents dir is left untouched. Returns the
 * staging-cleanup leak (if any) for the caller to surface.
 */
export async function abortPreparedAgents(
  prepared: PreparedAgentsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupAgentsStaging(prepared.stagingDir);
}

/**
 * All-or-nothing convenience that runs prepare + commit. Use this when the
 * caller does not need to interleave its own state-mutation step between the
 * two phases (e.g. installPlugin where there is no prior version to preserve).
 */
export async function stagePluginAgents(
  input: StagePluginAgentsInput,
): Promise<StagePluginAgentsResult> {
  const prepared = await prepareStagePluginAgents(input);
  let commitLeak: string | undefined;
  try {
    commitLeak = await commitPreparedAgents(prepared);
  } catch (err) {
    throw appendLeakToError(err, await abortPreparedAgents(prepared));
  }

  if (commitLeak === undefined) {
    return prepared.result;
  }

  return {
    stagedNames: prepared.result.stagedNames,
    warnings: [...prepared.result.warnings, commitLeak],
  };
}

export interface UnstagePluginAgentsInput {
  locations: ScopedLocations;
  marketplaceName: string;
  pluginName: string;
}

export interface UnstagePluginAgentsFailure {
  name: string;
  targetPath: string;
  reason: string;
}

export interface UnstagePluginAgentsResult {
  /** Names that were removed from disk + index. */
  removedNames: string[];
  /** Entries intentionally preserved in the index because their files could not be removed safely. */
  failed: UnstagePluginAgentsFailure[];
}

/**
 * Plugin-scoped removal. Foreign/read/delete failures are not treated as
 * removed: their index entries are preserved so uninstall/remove can fail
 * loudly and the user can retry after fixing the underlying file. */
export async function unstagePluginAgents(
  input: UnstagePluginAgentsInput,
): Promise<UnstagePluginAgentsResult> {
  const { locations, marketplaceName, pluginName } = input;

  const existingIndex = await loadAgentIndex(locations);

  const matching = existingIndex.agents.filter(
    (e) => e.marketplace === marketplaceName && e.plugin === pluginName,
  );
  if (matching.length === 0) {
    return { removedNames: [], failed: [] };
  }

  const nonMatching = existingIndex.agents.filter(
    (e) => !(e.marketplace === marketplaceName && e.plugin === pluginName),
  );

  type Outcome =
    | { kind: "removed"; name: string }
    | { kind: "preserved"; entry: AgentIndexEntry; failure: UnstagePluginAgentsFailure };

  const outcomes = await Promise.all(
    matching.map(async (entry): Promise<Outcome> => {
      const fail = (reason: string): Outcome => ({
        kind: "preserved",
        entry,
        failure: { name: entry.generatedName, targetPath: entry.targetPath, reason },
      });

      let safety: SafetyResult;
      try {
        safety = await isSafeToTouch(entry.targetPath);
      } catch (err) {
        return fail(errorMessage(err));
      }

      if (!safety.ok) {
        return fail(safety.reason);
      }

      try {
        await rm(entry.targetPath);
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          return fail(errorMessage(err));
        }
      }

      return { kind: "removed", name: entry.generatedName };
    }),
  );

  const removedNames: string[] = [];
  const failed: UnstagePluginAgentsFailure[] = [];
  const preservedMatching: AgentIndexEntry[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === "removed") {
      removedNames.push(outcome.name);
    } else {
      failed.push(outcome.failure);
      preservedMatching.push(outcome.entry);
    }
  }

  await saveAgentIndex(locations, {
    schemaVersion: 1,
    agents: [...nonMatching, ...preservedMatching],
  });

  return { removedNames, failed };
}
