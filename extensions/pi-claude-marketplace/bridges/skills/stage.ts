// bridges/skills/stage.ts
//
// Skills bridge prepare/commit/abort with per-skill atomic dir rename, plus
// Phase 8 replacement exports: replacePreparedSkills, rollbackSkillsReplacement,
// finalizeSkillsReplacement.
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
import { appendLeakToError, errorMessage, ManualRecoveryError } from "../../shared/errors.ts";
import { cleanupStaging, pathExists, rollbackReplacementCommon } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { discoverPluginSkills } from "./discover.ts";
import { rewriteFrontmatterName } from "./rewrite-frontmatter.ts";

import type {
  DiscoveredSkill,
  PreparedSkillsStaging,
  SkillsReplacement,
  StagedSkillRecord,
  StageSkillsInput,
} from "./types.ts";

type SkillsReplacementInternals = Readonly<{
  backupRoot: string;
  backups: readonly { name: string; from: string; to: string }[];
  renamed: readonly { from: string; to: string }[];
}>;

const skillsReplacementInternals = new WeakMap<
  Extract<SkillsReplacement, { kind: "replaced" }>,
  SkillsReplacementInternals
>();

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

  // D-07: discover returns { discovered, warnings }. warnings surface
  // duplicate-generated-name first-wins skips across multiple
  // componentPaths.skills entries; RN-6 within-dir source-name
  // collisions are still hard errors via assertNoSkillCollisions.
  const { discovered, warnings: discoverWarnings } = await discoverPluginSkills({
    pluginName,
    resolved,
  });
  assertNoSkillCollisions(discovered);

  // AS-8-style materialization gate: nothing to stage AND nothing to clean
  // up -> noop. Mirrors mcp/agents bridge symmetry; no per-SK requirement.
  // D-07: discoverWarnings still surface even on noop -- a duplicate
  // generated name across array elements is observable.
  if (discovered.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze([]),
        recorded: Object.freeze([]),
        warnings: Object.freeze([...discoverWarnings]),
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
      warnings: Object.freeze([...discoverWarnings]),
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
export async function abortPreparedSkills(
  prepared: PreparedSkillsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupStaging(prepared.stagingRoot, "skills staging directory");
}

/**
 * Reinstall-safe replacement helper. Unlike commitPreparedSkills, this moves
 * previous plugin-owned target dirs to a backup root before staged renames so
 * a later orchestrator failure can restore the old install.
 */
export async function replacePreparedSkills(
  prepared: PreparedSkillsStaging,
): Promise<SkillsReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  const backupRoot = path.join(prepared.locations.skillsStagingDir, `backup-${randomUUID()}`);
  await mkdir(backupRoot, { recursive: true });
  await assertPathInside(prepared.locations.skillsStagingDir, backupRoot, "skills backup root");

  const backups: { name: string; from: string; to: string }[] = [];
  const renamed: { from: string; to: string }[] = [];

  try {
    for (const name of prepared._previousNames) {
      assertSafeName(name, "previous skill name");
      const target = path.join(prepared.locations.skillsTargetDir, name);
      await assertPathInside(prepared.locations.skillsTargetDir, target, "previous skill dir");
      if (!(await pathExists(target))) {
        continue;
      }

      const backup = path.join(backupRoot, name);
      await assertPathInside(backupRoot, backup, "skills backup dir");
      await rename(target, backup);
      backups.push({ name, from: target, to: backup });
    }

    await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace skill target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      renamed.push(pair);
    }
  } catch (err) {
    const leaks = await rollbackSkillsReplacementInternal(prepared, renamed, backups, backupRoot);
    if (leaks.length > 0) {
      throw new ManualRecoveryError(errorMessage(err), leaks, { cause: err });
    }

    throw err;
  }

  const replacement: Extract<SkillsReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
  };
  skillsReplacementInternals.set(replacement, {
    backupRoot,
    backups: Object.freeze(backups),
    renamed: Object.freeze(renamed),
  });
  return replacement;
}

export async function rollbackSkillsReplacement(
  replacement: SkillsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireSkillsReplacementInternals(replacement);
  return rollbackSkillsReplacementInternal(
    replacement.prepared,
    internals.renamed,
    internals.backups,
    internals.backupRoot,
  );
}

export async function finalizeSkillsReplacement(
  replacement: SkillsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireSkillsReplacementInternals(replacement);
  const leaks = [
    await cleanupStaging(internals.backupRoot, "skills replacement backup directory"),
    await cleanupStaging(replacement.prepared.stagingRoot, "skills staging directory"),
  ].filter((leak): leak is string => leak !== undefined);
  return Object.freeze(leaks);
}

function requireSkillsReplacementInternals(
  replacement: Extract<SkillsReplacement, { kind: "replaced" }>,
): SkillsReplacementInternals {
  const internals = skillsReplacementInternals.get(replacement);
  if (internals === undefined) {
    throw new Error("Unknown skills replacement handle.");
  }

  return internals;
}

async function rollbackSkillsReplacementInternal(
  prepared: Extract<PreparedSkillsStaging, { kind: "staged" }>,
  renamed: readonly { from: string; to: string }[],
  backups: readonly { name: string; from: string; to: string }[],
  backupRoot: string,
): Promise<readonly string[]> {
  return rollbackReplacementCommon({
    renamed,
    backups,
    stagingRoot: prepared.stagingRoot,
    backupRoot,
    removeMode: "tree",
    labels: {
      replacement: "replacement skill dir",
      previous: "previous skill dir",
      stagingDir: "skills staging directory",
      backupDir: "skills replacement backup directory",
    },
  });
}
