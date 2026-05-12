// bridges/agents/stage.ts
//
// Two-phase staging for the agents bridge: prepare / commit / abort.
// Carry-forward of V1 agent/stage.ts (lines 280-525) with the Phase 3
// successor deltas:
//
//   1. agents-index IO is hoisted to persistence/agents-index-io.ts
//      (Plan 03-02). saveAgentsIndex remains the LAST step in commit so
//      the V1 self-heal property survives: if commit fails after writing
//      files but before persisting the index, the next unstage's ENOENT
//      tolerance plus the index showing OLD targetPaths self-heals.
//   2. AG-5 prepare-time foreign content is SOFT-FAILED (W-08 / B-08
//      fix per D-06 corollary) -- surfaced via result.failed[] rather
//      than thrown as AgentForeignContentError. Foreign-preserved index
//      rows survive the commit (kept in agents:[]).
//   3. AG-9 / RN-4 cross-owner conflict (a generated name is already
//      owned by a DIFFERENT (mp, plugin)) STILL throws --
//      AgentOwnershipConflictError carries the full conflict list.
//   4. AG-12 collision detection within this plugin moves to convert.ts
//      (assertNoAgentCollisions); we call it before the convert pass.
//   5. The 10-step prepare is decomposed -- partition + ownership-guard
//      logic lives in index-mutation.ts so AG-3 / AG-9 are testable
//      without touching disk.

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadAgentsIndex, saveAgentsIndex } from "../../persistence/agents-index-io.ts";
import { AgentOwnershipConflictError } from "../../shared/errors-bridges.ts";
import { appendLeakToError } from "../../shared/errors.ts";
import { cleanupStaging } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { assertNoAgentCollisions, convertAgent } from "./convert.ts";
import { discoverPluginAgents } from "./discover.ts";
import { findOwnershipConflicts, partitionByOwner } from "./index-mutation.ts";
import { isOwnedAgentFile } from "./marker.ts";

import type {
  ConvertedAgent,
  DiscoveredAgent,
  PreparedAgentsStaging,
  StageAgentsCommitResult,
  StageAgentsInput,
  StagedAgentRecord,
  UnstageAgentFailure,
} from "./types.ts";
import type { AgentsIndexEntry } from "../../persistence/agents-index-schema.ts";

/**
 * 10-step prepare. NOTHING outside `<extensionRoot>/agents-staging/<uuid>/`
 * is touched. Safe to abort with `abortPreparedAgents`. Throws on AG-9
 * cross-owner conflict, AG-11 empty mapped tools, AG-12 within-plugin
 * collision, AG-2 file-level corruption (loadAgentsIndex), and any IO
 * failure during the staging-dir write.
 *
 * Steps:
 *   1. Discover (or [] if agentsSourceDir === "")
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
  } = input;

  // Step 1: discover. D-07 signature: discoverPluginAgents now takes
  // `agentsDirs: readonly string[]`. The legacy `agentsSourceDir: ""`
  // sentinel maps to an empty array; a non-empty string maps to a
  // single-element array. Phase 5 callers building over the new
  // `componentPaths.agents: readonly string[]` shape pass the array
  // directly (translation lives at the StageAgentsInput boundary).
  // D-07 warnings (duplicate generated names across array elements)
  // are folded into `aggregatedWarnings` below.
  const discoverResult =
    agentsSourceDir === ""
      ? { discovered: [] as readonly DiscoveredAgent[], warnings: [] as readonly string[] }
      : await discoverPluginAgents({ pluginName, agentsDirs: [agentsSourceDir] });
  const discovered: readonly DiscoveredAgent[] = discoverResult.discovered;
  const discoverWarnings: readonly string[] = discoverResult.warnings;

  // Step 2: AG-12 collision detection (within this plugin's set).
  assertNoAgentCollisions(
    discovered.map((d) => ({ sourceName: d.sourceName, generatedName: d.generatedName })),
  );

  // Step 3: convert (AG-7 + AG-11). AG-11 throws here if mapped tools is empty.
  const converted: ConvertedAgent[] = discovered.map((d) =>
    convertAgent({
      pluginName,
      pluginRoot,
      pluginDataDir,
      knownSkills: knownSkills ?? [],
      discovered: d,
      sourceHash: d.sourceHash,
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
        ...(c.originalModel !== undefined ? { originalModel: c.originalModel } : {}),
        droppedFields: [...c.droppedFields],
        droppedTools: [...c.droppedTools],
        warnings: [...c.warnings],
      };
      newEntries.push(entry);
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingDir, "agents staging directory"));
  }

  // Step 10: assemble the result. recorded[] is the W-05 fix Phase 5 reads
  // to populate state.json.installs.
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

/**
 * Format a single ConvertedAgent's warnings + dropped-fields/tools summary
 * into the flat array the orchestrator surfaces to the user. Mirrors V1
 * formatAgentWarnings (agent-stage.ts lines 256-271).
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

  // Step 1: rm ONLY safe-to-overwrite previous target files. The
  // _foreignPreservedEntries list is INTENTIONALLY excluded -- those
  // targets stay untouched on disk and their rows stay in the index.
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

  // Step 2: mkdir <scopeRoot>/agents/ + parallel rename staged -> target.
  try {
    await mkdir(prepared.locations.agentsDir, { recursive: true });
    await Promise.all(prepared._stagedFilePaths.map(({ from, to }) => rename(from, to)));
  } catch (err) {
    throw appendLeakToError(
      err,
      await cleanupStaging(prepared.stagingDir, "agents staging directory"),
    );
  }

  // Step 3: persist new index (LAST step before cleanup -- RESEARCH
  // self-heal property). Index = otherEntries (mp/plugin not ours) +
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
