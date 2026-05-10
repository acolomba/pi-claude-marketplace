// bridges/skills/stage.ts
//
// Skills bridge prepare/commit/abort with per-skill atomic dir rename.
//
// Carry-forward from V1 `resource/stage.ts` (skills branch, lines 178-204) for
// the per-skill cp+rewrite+substitute pipeline; from V1 `agent/stage.ts`
// (lines 280-525) for the prepare/commit/abort discriminated-union shape.
//
// Phase-3 deltas (vs V1):
//   - D-04: bridge owns its own staging dir at
//     `<extensionRoot>/skills-staging/<uuid>/` -- staging and target both
//     live under `<extensionRoot>/`, guaranteeing same-FS atomicity for the
//     per-skill `rename`.
//   - D-08: substitution helper is `shared/vars.ts::substituteClaudeVars`
//     (uniform across skills/commands/agents).
//   - RN-6: `assertNoSkillCollisions` throws if two source skills elide
//     to the same generated name, listing both source names.
//   - T-03-15 hardening: cp uses `verbatimSymlinks: true, dereference: false`
//     so a plugin author cannot escape the source tree by planting a symlink.

import { randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { appendLeakToError } from "../../shared/errors.ts";
import { cleanupStaging } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { discoverPluginSkills } from "./discover.ts";
import { rewriteFrontmatterName } from "./rewrite-frontmatter.ts";

import type {
  DiscoveredSkill,
  PreparedSkillsStaging,
  StagedSkillRecord,
  StageSkillsInput,
} from "./types.ts";

/**
 * RN-6: refuse two source skills that elide to the same generated name.
 * Throws an Error whose message lists ALL collision groups, each with the
 * generated name and every contributing source name.
 */
export function assertNoSkillCollisions(discovered: readonly DiscoveredSkill[]): void {
  const groups = new Map<string, string[]>();
  for (const s of discovered) {
    const arr = groups.get(s.generatedName) ?? [];
    arr.push(s.sourceName);
    groups.set(s.generatedName, arr);
  }

  const collisions: string[] = [];
  for (const [generated, sources] of groups) {
    if (sources.length > 1) {
      const sourceList = sources.map((s) => `"${s}"`).join(", ");
      collisions.push(`"${generated}" <- [${sourceList}]`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Generated skill name collision detected. Rename one of the source skills:\n  ` +
        collisions.join("\n  "),
    );
  }
}

/**
 * Phase-1 of the skills bridge two-phase commit:
 *   1. Discover skills in the source plugin (SK-5).
 *   2. Refuse on RN-6 collisions.
 *   3. If `discovered.length === 0 && previousSkillNames.length === 0`,
 *      return the noop variant (no staging dir created).
 *   4. Otherwise create `<skillsStagingDir>/<uuid>/` and per-skill copy +
 *      frontmatter rewrite (SK-3) + var substitution (SK-4) into it.
 *   5. Return the staged variant carrying internal `_renamePairs` for commit.
 *
 * On any error during step 4, the partial staging tree is best-effort
 * cleaned up via `cleanupStaging`; any leak message is appended to the
 * thrown error via `appendLeakToError` so the caller sees both the original
 * cause and a manual-cleanup hint in one notification.
 */
export async function prepareStageSkills(input: StageSkillsInput): Promise<PreparedSkillsStaging> {
  const { locations, pluginName, pluginRoot, pluginDataDir, resolved } = input;
  const previousNames = input.previousSkillNames ?? [];

  const discovered = await discoverPluginSkills({ pluginName, resolved });
  assertNoSkillCollisions(discovered);

  // AS-8-style materialization gate: nothing to stage AND nothing to clean
  // up -> noop. Mirrors mcp/agents bridge symmetry; no per-SK requirement.
  if (discovered.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze([]),
        recorded: Object.freeze([]),
        warnings: Object.freeze([]),
      },
    };
  }

  const stagingRoot = path.join(locations.skillsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.skillsStagingDir, stagingRoot, "skills staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];
  const recorded: StagedSkillRecord[] = [];

  try {
    for (const skill of discovered) {
      assertSafeName(skill.generatedName, "generated skill name");

      const stagedDir = path.join(stagingRoot, skill.generatedName);
      await assertPathInside(stagingRoot, stagedDir, "staged skill destination");

      const targetDir = path.join(locations.skillsTargetDir, skill.generatedName);
      await assertPathInside(locations.skillsTargetDir, targetDir, "skill target destination");

      // T-03-15: copy with `verbatimSymlinks: true, dereference: false` so a
      // symlink inside the source tree is preserved as a symlink rather than
      // resolved (which could escape the source tree). errorOnExist=true is a
      // belt-and-braces guard; randomUUID ensures the staging dir is fresh.
      await cp(skill.skillDir, stagedDir, {
        recursive: true,
        dereference: false,
        verbatimSymlinks: true,
        errorOnExist: true,
        force: false,
      });

      // SK-3 rewrite + SK-4 substitute on the SKILL.md only.
      const skillMdPath = path.join(stagedDir, "SKILL.md");
      let content = await readFile(skillMdPath, "utf8");
      content = rewriteFrontmatterName(content, skill.generatedName);
      content = substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir });
      await writeFile(skillMdPath, content, "utf8");

      renamePairs.push({ from: stagedDir, to: targetDir });
      stagedNames.push(skill.generatedName);
      recorded.push({
        generatedName: skill.generatedName,
        sourcePath: skill.skillDir,
        targetPath: targetDir,
      });
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingRoot, "skills staging directory"));
  }

  return {
    kind: "staged",
    locations,
    stagingRoot,
    result: {
      stagedNames: Object.freeze(stagedNames),
      recorded: Object.freeze(recorded),
      warnings: Object.freeze([]),
    },
    _previousNames: Object.freeze(previousNames),
    _renamePairs: Object.freeze(renamePairs),
  };
}

/**
 * Phase-2 of the skills bridge two-phase commit. For the staged variant:
 *   1. Remove every previous-named target dir (re-stage path; ENOENT-tolerant).
 *   2. mkdir target root recursively.
 *   3. Per-skill `rename(from, to)` -- atomic on same FS (D-04).
 *   4. Best-effort cleanup of the now-empty staging UUID dir; any leak
 *      message is RETURNED (not thrown) so the caller can fold it into a
 *      higher-level rollback marker without breaking the success path.
 *
 * For the noop variant: no-op; returns undefined.
 */
export async function commitPreparedSkills(
  prepared: PreparedSkillsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  // Step 1: remove previous-named target dirs (re-stage path).
  for (const name of prepared._previousNames) {
    assertSafeName(name, "previous skill name");
    const dir = path.join(prepared.locations.skillsTargetDir, name);
    await assertPathInside(prepared.locations.skillsTargetDir, dir, "previous skill dir");
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  // Step 2 + 3: ensure target root exists, then atomically rename each staged
  // dir into place. `rename` is per-OS atomic on same FS, which we guarantee
  // because both staging and target live under `<extensionRoot>/`.
  await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
  for (const pair of prepared._renamePairs) {
    await rename(pair.from, pair.to);
  }

  // Step 4: best-effort cleanup of the staging UUID dir.
  return cleanupStaging(prepared.stagingRoot, "skills staging directory");
}

/**
 * Cleanup-only counterpart to commit. Called when prepare returned the
 * `staged` variant but the orchestrator decided not to commit (e.g. another
 * bridge in the same Phase 5 transaction failed). After commit succeeds,
 * abort is a no-op because the staging dir is already cleaned.
 */
export async function abortPreparedSkills(prepared: PreparedSkillsStaging): Promise<void> {
  if (prepared.kind === "noop") {
    return;
  }

  await cleanupStaging(prepared.stagingRoot, "skills staging directory");
}
