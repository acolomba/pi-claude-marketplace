// bridges/agents/stage.ts
//
// Two-phase staging for the agents bridge: prepare / commit / abort, plus
// three-phase replacement exports: replacePreparedAgents,
// rollbackAgentsReplacement, finalizeAgentsReplacement. Notable invariants:
//
//   1. agents-index IO lives in persistence/agents-index-io.ts.
//      saveAgentsIndex is the LAST step in commit so the self-heal property
//      holds: if commit fails after writing files but before persisting the
//      index, the next unstage's ENOENT tolerance plus the index showing OLD
//      targetPaths self-heals.
//   2. AG-5 prepare-time foreign content is SOFT-FAILED (W-08 / B-08 per
//      D-06 corollary) -- surfaced via result.failed[] rather than thrown as
//      AgentForeignContentError. Foreign-preserved index rows survive the
//      commit (kept in agents:[]).
//   3. AG-9 / RN-4 cross-owner conflict (a generated name is already owned
//      by a DIFFERENT (mp, plugin)) throws -- AgentOwnershipConflictError
//      carries the full conflict list.
//   4. AG-12 collision detection within this plugin lives in convert.ts
//      (assertNoAgentCollisions); we call it before the convert pass.
//   5. The 10-step prepare is decomposed -- partition + ownership-guard
//      logic lives in index-mutation.ts so AG-3 / AG-9 are testable
//      without touching disk.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import { assertSafeName } from "../../domain/name.ts";
import { loadAgentsIndex, saveAgentsIndex } from "../../persistence/agents-index-io.ts";
import { AgentOwnershipConflictError } from "../../shared/errors-bridges.ts";
import {
  appendLeakToError,
  appendLeaks,
  errorMessage,
  ManualRecoveryError,
} from "../../shared/errors.ts";
import {
  cleanupStaging,
  pathExists,
  removeOrphanIfPresent,
  rollbackReplacementCommon,
} from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { assertNoAgentCollisions, convertAgent } from "./convert.ts";
import { discoverPluginAgents } from "./discover.ts";
import { findOwnershipConflicts, partitionByOwner } from "./index-mutation.ts";
import { isOwnedAgentFile } from "./marker.ts";

import type {
  AgentsReplacement,
  ConvertedAgent,
  DiscoveredAgent,
  PreparedAgentsStaging,
  ReplacePreparedAgentsOptions,
  StageAgentsCommitResult,
  StageAgentsInput,
  StagedAgentRecord,
  UnstageAgentFailure,
} from "./types.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

type AgentsReplacementInternals = Readonly<{
  backupRoot: string;
  oldIndexText: string | undefined;
  backups: readonly { name: string; from: string; to: string }[];
  renamed: readonly { from: string; to: string }[];
}>;

const agentsReplacementInternals = new WeakMap<
  Extract<AgentsReplacement, { kind: "replaced" }>,
  AgentsReplacementInternals
>();

/**
 * 10-step prepare. NOTHING outside `<extensionRoot>/agents-staging/<uuid>/`
 * is touched. Safe to abort with `abortPreparedAgents`. Throws on AG-9
 * cross-owner conflict, AG-11 empty mapped tools, AG-12 within-plugin
 * collision, AG-2 file-level corruption (loadAgentsIndex), and any IO
 * failure during the staging-dir write.
 *
 * Steps:
 *   1. Discover (or [] if agentsSourceDir === null)
 *   2. AG-12 collision detection within this plugin
 *   3. Convert (AG-7 mapping pipeline)
 *   4. Load index, partition by (marketplace, plugin)
 *   5. AG-9 cross-owner guard -- THROWS on conflict
 *   6. AS-9 noop short-circuit
 *   7. Safety-check previous targets (AG-5 foreign-content SOFT-FAIL)
 *   8. Write staged files into <extensionRoot>/agents-staging/<uuid>/
 *   9. Build new index entries
 *  10. Aggregate warnings + index corruptions
 */
export async function prepareStagePluginAgents(
  input: StageAgentsInput,
): Promise<PreparedAgentsStaging> {
  const {
    locations,
    marketplaceName,
    pluginName,
    pluginRoot,
    pluginDataDir,
    agentsSourceDir,
    knownSkills,
    mapModel,
  } = input;

  // Step 1: discover. D-07 signature: discoverPluginAgents takes
  // `agentsDirs: readonly string[]`. A null agentsSourceDir means the
  // plugin has no agents component; a non-null string maps to a
  // single-element array. Callers building over the
  // `componentPaths.agents: readonly string[]` shape pass the array
  // directly (translation lives at the StageAgentsInput boundary).
  // D-07 warnings (duplicate generated names across array elements)
  // are folded into `aggregatedWarnings` below.
  const discoverResult =
    agentsSourceDir === null
      ? { discovered: [] as readonly DiscoveredAgent[], warnings: [] as readonly string[] }
      : await discoverPluginAgents({ pluginName, agentsDirs: [agentsSourceDir] });
  const discovered: readonly DiscoveredAgent[] = discoverResult.discovered;
  const discoverWarnings: readonly string[] = discoverResult.warnings;

  // Step 2: AG-12 collision detection (within this plugin's set).
  assertNoAgentCollisions(
    discovered.map((d) => ({ sourceName: d.sourceName, generatedName: d.generatedName })),
  );

  // Step 3: convert (AG-7 + AG-11). AG-11 throws here if mapped tools is empty.
  // `mapModel` defaults to false: the omit-by-default behavior is the
  // contract; only explicit `--map-model` on install/update flips it on.
  const converted: ConvertedAgent[] = discovered.map((d) =>
    convertAgent({
      pluginName,
      pluginRoot,
      pluginDataDir,
      knownSkills: knownSkills ?? [],
      discovered: d,
      sourceHash: d.sourceHash,
      mapModel: mapModel ?? false,
    }),
  );

  // Step 4: load + partition (AG-3).
  const loaded = await loadAgentsIndex(locations);
  const { previous: previousEntries, other: otherEntries } = partitionByOwner(
    loaded.agents,
    marketplaceName,
    pluginName,
  );

  // Step 5: AG-9 cross-owner guard. THROWS -- a generated name owned by a
  // different (mp, plugin) cannot be silently overwritten.
  const conflicts = findOwnershipConflicts(
    otherEntries,
    converted.map((c) => c.generatedName),
  );
  if (conflicts.length > 0) {
    throw new AgentOwnershipConflictError(
      { marketplace: marketplaceName, plugin: pluginName },
      conflicts.map((c) => ({
        generatedName: c.generatedName,
        owner: { marketplace: c.owner.marketplace, plugin: c.owner.plugin },
      })),
    );
  }

  // Aggregate warnings (corruptions + per-agent warnings + D-07 dedup
  // warnings) -- needed for both noop and staged paths so they're built
  // up here.
  const aggregatedWarnings: string[] = [
    ...loaded.corruptions.map((c) => `agent index corruption (entry dropped): ${c}`),
    ...converted.flatMap((c) => formatAgentWarnings(c)),
    ...discoverWarnings,
  ];

  // Step 6: AS-9 noop short-circuit. Nothing to write AND no previous
  // entries to preserve/clean up -- never materialize agents/ or
  // agents-index.json.
  if (converted.length === 0 && previousEntries.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze([]),
        recorded: Object.freeze([]),
        warnings: Object.freeze(aggregatedWarnings),
        failed: Object.freeze([]),
      },
    };
  }

  // Step 7: AG-5 foreign-content SOFT-FAIL (W-08 / B-08 / D-06 corollary).
  // For each previous index entry, check its on-disk targetPath. If foreign
  // content is present, surface via failed[] (NOT throw); preserve the
  // index row so commit can keep recording it.
  const ag5Failures: UnstageAgentFailure[] = [];
  const safePreviousEntries: AgentsIndexEntry[] = [];
  const foreignPreservedEntries: AgentsIndexEntry[] = [];
  for (const entry of previousEntries) {
    const safety = await isOwnedAgentFile(entry.targetPath);
    if (safety.ok) {
      safePreviousEntries.push(entry);
    } else {
      ag5Failures.push({
        generatedName: entry.generatedName,
        targetPath: entry.targetPath,
        reason: safety.reason,
      });
      foreignPreservedEntries.push(entry);
    }
  }

  // Step 8: write staged files into <extensionRoot>/agents-staging/<uuid>/.
  const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
  await mkdir(stagingDir, { recursive: true });
  await assertPathInside(locations.agentsStagingDir, stagingDir, "agents staging dir");

  const stagedFilePaths: { from: string; to: string }[] = [];
  const newEntries: AgentsIndexEntry[] = [];

  try {
    for (const c of converted) {
      const stagedFile = path.join(stagingDir, c.generatedName + ".md");
      await assertPathInside(stagingDir, stagedFile, "staged agent file");
      const targetFile = path.join(locations.agentsDir, c.generatedName + ".md");
      await assertPathInside(locations.agentsDir, targetFile, "agent target path");

      await writeFile(stagedFile, c.fileContent, "utf8");
      stagedFilePaths.push({ from: stagedFile, to: targetFile });

      // Step 9: build new index entry.
      const entry: AgentsIndexEntry = {
        plugin: pluginName,
        marketplace: marketplaceName,
        sourceAgent: c.sourceName,
        generatedName: c.generatedName,
        sourcePath: c.sourcePath,
        targetPath: targetFile,
        sourceHash: c.sourceHash,
        ...optionalOriginalModel(c.originalModel),
        droppedFields: [...c.droppedFields],
        droppedTools: [...c.droppedTools],
        warnings: [...c.warnings],
      };
      newEntries.push(entry);
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingDir, "agents staging directory"));
  }

  // Step 10: assemble the result. recorded[] is the W-05 record the
  // orchestrator reads to populate state.json.installs.
  const recorded: StagedAgentRecord[] = newEntries.map((e) => ({
    generatedName: e.generatedName,
    sourcePath: e.sourcePath,
    targetPath: e.targetPath,
  }));

  const result: StageAgentsCommitResult = {
    stagedNames: Object.freeze(newEntries.map((e) => e.generatedName)),
    recorded: Object.freeze(recorded),
    warnings: Object.freeze(aggregatedWarnings),
    failed: Object.freeze(ag5Failures),
  };

  return {
    kind: "staged",
    locations,
    stagingDir,
    result,
    _previousEntries: Object.freeze(safePreviousEntries),
    _foreignPreservedEntries: Object.freeze(foreignPreservedEntries),
    _otherEntries: Object.freeze(otherEntries),
    _newEntries: Object.freeze(newEntries),
    _stagedFilePaths: Object.freeze(stagedFilePaths),
  };
}

function optionalOriginalModel(originalModel: string | undefined): { originalModel?: string } {
  return originalModel === undefined ? {} : { originalModel };
}

/**
 * Format a single ConvertedAgent's warnings + dropped-fields/tools summary
 * into the flat array the orchestrator surfaces to the user.
 */
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

/**
 * Phase 2: remove old target files (only safe-to-overwrite ones), rename
 * staged files into <scopeRoot>/agents/, persist the new index, clean up.
 *
 * If steps 1-2 fail partway, the on-disk agent files may be removed (or
 * partially removed) while the index file still describes the OLD entries
 * (saveAgentsIndex was never reached). The next unstage's ENOENT tolerance
 * plus the index pointing at the OLD targetPaths self-heals on retry.
 *
 * Returns the staging-cleanup leak (if any) so the caller can surface it
 * via warnings[] rather than dropping it.
 */
export async function commitPreparedAgents(
  prepared: PreparedAgentsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  // TR-07: Step 1 is retry-safe by construction. The Promise.all
  // rm loop pre-removes OLD plugin-owned targets; ENOENT means "already gone"
  // -- the only way ENOENT can fire is if a prior partial commit already
  // removed the target before crashing, in which case the second pass is a
  // no-op and step 2 proceeds with the new rename. This is the self-heal
  // property documented at the function JSDoc above (the index pointing at
  // the OLD targetPaths plus step-1 ENOENT tolerance closes the retry loop).
  // The loop stays parallel here because step 1 has no source to roll back
  // to -- those files were never backed up (commitPreparedAgents is the
  // commit path, not the replacePreparedAgents backup path); rollback would
  // have nothing to restore. _foreignPreservedEntries is INTENTIONALLY
  // excluded -- those targets stay untouched on disk and their rows stay
  // in the index.
  try {
    await Promise.all(
      prepared._previousEntries.map(async (entry) => {
        try {
          await rm(entry.targetPath);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            throw err;
          }
        }
      }),
    );
  } catch (err) {
    throw appendLeakToError(
      err,
      await cleanupStaging(prepared.stagingDir, "agents staging directory"),
    );
  }

  // Step 2: mkdir <scopeRoot>/agents/ + sequential rename staged -> target.
  // TR-01: Sequential so we can track completed renames and reverse them on
  // a partial failure -- mirrors the rollback shape in
  // `rollbackReplacementCommon` (shared/fs-utils.ts:135-177): spread-before-
  // reverse to avoid in-place mutation, per-pair try/catch into a leaks[]
  // string array, and the rollback loop NEVER throws.
  const completedRenames: { from: string; to: string }[] = [];
  try {
    await mkdir(prepared.locations.agentsDir, { recursive: true });
    for (const pair of prepared._stagedFilePaths) {
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
    // Reverse-walk completed renames -- restore each back to staging. The
    // rollback loop NEVER throws; rollback failures accumulate into
    // rollbackLeaks[] for surfacing via appendLeaks below.
    const rollbackLeaks: string[] = [];
    for (const pair of [...completedRenames].reverse()) {
      try {
        await rename(pair.to, pair.from);
      } catch (rollbackErr) {
        rollbackLeaks.push(
          `failed to roll back agent rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
        );
      }
    }

    // Surface BOTH original err AND rollback leaks AND staging-cleanup leak
    // via appendLeaks (sequential-cause chain; preserves Error.cause for the
    // depth-5 walker in shared/notify.ts). Use appendLeaks here, NOT
    // ManualRecoveryError -- commit-path leaks are transient IO.
    throw appendLeaks(err, [
      ...rollbackLeaks,
      await cleanupStaging(prepared.stagingDir, "agents staging directory"),
    ]);
  }

  // Step 3: persist new index (LAST step before cleanup -- the self-heal
  // property). Index = otherEntries (mp/plugin not ours) +
  // newEntries (just staged) + foreignPreservedEntries (W-08 fix: keep
  // these so future runs surface them again).
  await saveAgentsIndex(prepared.locations, {
    schemaVersion: 1,
    agents: [
      ...prepared._otherEntries,
      ...prepared._newEntries,
      ...prepared._foreignPreservedEntries,
    ],
  });

  // Step 4: best-effort cleanup. Returns leak message (if any) for caller
  // to surface in warnings[]; never throws.
  return cleanupStaging(prepared.stagingDir, "agents staging directory");
}

/**
 * Cleanup-only path. Use when the caller decides not to commit (e.g.
 * saveState failed after prepare). The scoped agents dir is left
 * untouched. Returns the staging-cleanup leak (if any) for the caller to
 * surface.
 */
export async function abortPreparedAgents(
  prepared: PreparedAgentsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupStaging(prepared.stagingDir, "agents staging directory");
}

/**
 * Reinstall-safe replacement helper. Unlike commitPreparedAgents, this
 * backs up previous plugin-owned agent files and agents-index.json before
 * staged renames so later orchestrator failures can restore the old install.
 */
export async function replacePreparedAgents(
  prepared: PreparedAgentsStaging,
  options?: ReplacePreparedAgentsOptions,
): Promise<AgentsReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  if (prepared.result.failed.length > 0 && options?.force !== true) {
    throw new Error(
      `Agent replacement blocked by foreign previous content:\n${prepared.result.failed
        .map((f) => `  - ${f.generatedName} at ${f.targetPath}: ${f.reason}`)
        .join("\n")}`,
    );
  }

  const oldIndexText = await readOptionalText(prepared.locations.agentsIndexPath);
  const backupRoot = path.join(prepared.locations.agentsStagingDir, `backup-${randomUUID()}`);
  await mkdir(backupRoot, { recursive: true });
  await assertPathInside(prepared.locations.agentsStagingDir, backupRoot, "agents backup root");
  const backupEntries =
    options?.force === true
      ? [...prepared._previousEntries, ...prepared._foreignPreservedEntries]
      : [...prepared._previousEntries];
  const backups: { name: string; from: string; to: string }[] = [];
  const renamed: { from: string; to: string }[] = [];

  try {
    for (const entry of backupEntries) {
      assertSafeName(entry.generatedName, "previous agent name");
      await assertPathInside(prepared.locations.agentsDir, entry.targetPath, "previous agent file");
      if (!(await pathExists(entry.targetPath))) {
        continue;
      }

      const backup = path.join(backupRoot, entry.generatedName + ".md");
      await assertPathInside(backupRoot, backup, "agents backup file");
      await rename(entry.targetPath, backup);
      backups.push({ name: entry.generatedName, from: entry.targetPath, to: backup });
    }

    // TR-06: 3-arm policy at the rename loop. ownedNames is the basename
    // membership set derived from state.json (via _previousEntries). When
    // a pre-existing target shares an owned basename, it is treated as an
    // orphan from a prior partial install and pre-removed via the
    // kind-strict helper. Foreign content (basename NOT in ownedNames)
    // still triggers the existing PI-6 "non-previous content" rejection
    // verbatim. Agents targets are .md files -> mode "file".
    const ownedNames = new Set<string>(prepared._previousEntries.map((e) => e.generatedName));
    await mkdir(prepared.locations.agentsDir, { recursive: true });
    for (const pair of prepared._stagedFilePaths) {
      const targetName = path.basename(pair.to, ".md");
      if (ownedNames.has(targetName)) {
        await removeOrphanIfPresent(pair.to, "file");
      } else if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace agent target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      renamed.push(pair);
    }

    await saveAgentsIndex(prepared.locations, {
      schemaVersion: 1,
      agents: [...prepared._otherEntries, ...prepared._newEntries],
    });
  } catch (err) {
    const leaks = await rollbackAgentsReplacementInternal(
      prepared,
      renamed,
      backups,
      backupRoot,
      oldIndexText,
    );
    if (leaks.length > 0) {
      throw new ManualRecoveryError(errorMessage(err), leaks, { cause: err });
    }

    throw err;
  }

  const replacement: Extract<AgentsReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
  };
  agentsReplacementInternals.set(replacement, {
    backupRoot,
    oldIndexText,
    backups: Object.freeze(backups),
    renamed: Object.freeze(renamed),
  });
  return replacement;
}

export async function rollbackAgentsReplacement(
  replacement: AgentsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireAgentsReplacementInternals(replacement);
  return rollbackAgentsReplacementInternal(
    replacement.prepared,
    internals.renamed,
    internals.backups,
    internals.backupRoot,
    internals.oldIndexText,
  );
}

export async function finalizeAgentsReplacement(
  replacement: AgentsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireAgentsReplacementInternals(replacement);
  const leaks = [
    await cleanupStaging(internals.backupRoot, "agents replacement backup directory"),
    await cleanupStaging(replacement.prepared.stagingDir, "agents staging directory"),
  ].filter((leak): leak is string => leak !== undefined);
  return Object.freeze(leaks);
}

function requireAgentsReplacementInternals(
  replacement: Extract<AgentsReplacement, { kind: "replaced" }>,
): AgentsReplacementInternals {
  const internals = agentsReplacementInternals.get(replacement);
  if (internals === undefined) {
    throw new Error("Unknown agents replacement handle.");
  }

  return internals;
}

async function rollbackAgentsReplacementInternal(
  prepared: Extract<PreparedAgentsStaging, { kind: "staged" }>,
  renamed: readonly { from: string; to: string }[],
  backups: readonly { name: string; from: string; to: string }[],
  backupRoot: string,
  oldIndexText: string | undefined,
): Promise<readonly string[]> {
  return rollbackReplacementCommon({
    renamed,
    backups,
    stagingRoot: prepared.stagingDir,
    backupRoot,
    removeMode: "file",
    labels: {
      replacement: "replacement agent file",
      previous: "previous agent file",
      stagingDir: "agents staging directory",
      backupDir: "agents replacement backup directory",
    },
    beforeCleanup: () => restoreAgentsIndex(prepared.locations.agentsIndexPath, oldIndexText),
  });
}

async function restoreAgentsIndex(
  agentsIndexPath: string,
  oldIndexText: string | undefined,
): Promise<readonly string[]> {
  try {
    if (oldIndexText === undefined) {
      await rm(agentsIndexPath, { force: true });
    } else {
      await mkdir(path.dirname(agentsIndexPath), { recursive: true });
      await writeFileAtomic(agentsIndexPath, oldIndexText, { encoding: "utf8" });
    }

    return [];
  } catch (err) {
    return [`failed to restore agents index at ${agentsIndexPath}: ${errorMessage(err)}`];
  }
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
