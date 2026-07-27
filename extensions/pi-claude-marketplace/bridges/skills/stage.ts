// bridges/skills/stage.ts
//
// Skills bridge prepare/commit/abort with per-skill atomic dir rename, plus
// replacement exports: replacePreparedSkills, rollbackSkillsReplacement,
// finalizeSkillsReplacement.
//
// Behavior:
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
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { parseFrontmatter } from "../../platform/pi-api.ts";
import { appendLeakToError, errorMessage, ManualRecoveryError } from "../../shared/errors.ts";
import {
  cleanupStaging,
  pathExists,
  removeOrphanIfPresent,
  rollbackReplacementCommon,
} from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { substituteClaudeVars } from "../../shared/vars.ts";

import { discoverPluginSkills } from "./discover.ts";
import {
  firstBodyParagraph,
  foldWhenToUse,
  setDescriptionScalar,
  synthesizeUnparseableSkill,
  truncate1536,
} from "./frontmatter-degrade.ts";
import { rewriteFrontmatterName } from "./rewrite-frontmatter.ts";

import type {
  DiscoveredSkill,
  PreparedSkillsStaging,
  SkillDegradeRecord,
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
 * SKILL-01: extract the markdown body from a skill source whose frontmatter
 * block failed to parse, reproducing `parseFrontmatter`'s OWN split so the
 * synthesized block preserves the body byte-for-byte identically to the
 * parseable path (PARSE-01 encoding parity). Newlines are normalized (CR/CRLF ->
 * LF, including lone CR) exactly as the parser does; the opening fence is the
 * parser's anchored `---` prefix (`startsWith`, NOT a per-line `trim`); and the
 * close is the parser's `\n---` prefix search. An exotic delimiter -- a `---x`
 * line or an indented `---` -- is therefore classified identically to Pi rather
 * than by a looser `line.trim() === "---"` match. Called ONLY on the gate-1
 * throw arm, where a closed `---` block is present by construction -- the body
 * is everything after the closing delimiter, trimmed. Falls back to the whole
 * normalized+trimmed content if no opening/closing delimiter is found.
 */
function extractBodyAfterFrontmatter(content: string): string {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  if (!normalized.startsWith("---")) {
    return normalized.trim();
  }

  const closeIndex = normalized.indexOf("\n---", 3);
  if (closeIndex === -1) {
    return normalized.trim();
  }

  return normalized.slice(closeIndex + 4).trim();
}

/**
 * SKILL-02 empty probe: a well-formed skill with neither a `description` nor any
 * prose body yields an empty first-paragraph candidate, and Pi drops a skill
 * whose `description` is empty (`skill: null`). Emit a short fixed non-empty
 * scalar so the skill still loads. Distinct from the unparseable-source
 * placeholder (D-86-02): the frontmatter parsed cleanly here; only the
 * description is absent.
 */
const MISSING_DESCRIPTION_PLACEHOLDER = "No description provided.";

/**
 * SKILL-02 / WTU-01 / WTU-02: augment the `description` on the well-formed
 * (gate-1 RETURN) arm. Reads the PARSED `description` / `when_to_use` values and
 * the parsed `body`:
 *   - SKILL-02 / D-86-06: an absent or empty `description` is filled from the
 *     first body paragraph (`firstBodyParagraph`); an empty candidate falls back
 *     to a fixed non-empty placeholder so Pi still loads the skill.
 *   - WTU-01 / A1: a non-empty `when_to_use` is folded in after a single `\n`.
 *   - WTU-02 / D-86-05 / A2: the combined text is hard-cut at 1,536 code units
 *     (never Pi's 1,024 warning threshold).
 * The value is written back through `setDescriptionScalar` (full node-span
 * replace + safe double-quoted scalar), so a `>-`/`|` block-scalar source
 * `description` cannot be corrupted (the SKILL-03 class). NREG-01: when the
 * effective value equals the source `description` AND no `when_to_use` was
 * folded, the frontmatter is left byte-identical (no re-emit).
 */
function augmentSkillDescription(
  content: string,
  frontmatter: Record<string, unknown>,
  body: string,
  vars: { pluginRoot: string; pluginData: string },
): string {
  const rawDescription = frontmatter.description;
  const sourceDescription = typeof rawDescription === "string" ? rawDescription : "";
  const rawWhenToUse = frontmatter.when_to_use;
  const whenToUse = typeof rawWhenToUse === "string" ? rawWhenToUse : "";

  const base = sourceDescription === "" ? firstBodyParagraph(body) : sourceDescription;
  const folded = foldWhenToUse(base, whenToUse === "" ? undefined : whenToUse);
  // SK-4 / AG-8: substitute the Claude path vars BEFORE the value is escaped into
  // the double-quoted scalar. The later whole-file `substituteClaudeVars` (below)
  // would otherwise splice a Windows path's backslashes into the ALREADY-escaped
  // scalar, forming an invalid `\U...`-class escape that fails the PARSE-02
  // backstop; substituting first lets `emitSafeDoubleQuotedScalar` escape those
  // backslashes. The cap is applied pre-substitution (the WTU-02 listing budget
  // measures the authored text), matching the prior whole-file ordering.
  const effective = substituteClaudeVars(
    truncate1536(folded === "" ? MISSING_DESCRIPTION_PLACEHOLDER : folded),
    vars,
  );

  // NREG-01: a present, in-cap `description` with no `when_to_use` and no path
  // var to expand is unchanged -- do NOT re-emit it as a double-quoted scalar
  // (byte-for-byte invariant).
  if (effective === sourceDescription) {
    return content;
  }

  return setDescriptionScalar(content, effective);
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
        degraded: Object.freeze([]),
      },
    };
  }

  const stagingRoot = path.join(locations.skillsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.skillsStagingDir, stagingRoot, "skills staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];
  const recorded: StagedSkillRecord[] = [];
  const degraded: SkillDegradeRecord[] = [];

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

      const skillMdPath = path.join(stagedDir, "SKILL.md");
      let content = await readFile(skillMdPath, "utf8");

      // PARSE-01: parse the SOURCE frontmatter BEFORE any rewrite/substitution
      // to establish attribution ground truth and the degrade trigger. A THROW
      // means a closed `---` block whose inner YAML is malformed (an author
      // defect); a RETURN (including absent/empty frontmatter) is the happy
      // arm. The parse is READ-ONLY -- validate, never eval (preserves T-03-17).
      let parsed: { frontmatter: Record<string, unknown>; body: string } | undefined;
      try {
        parsed = parseFrontmatter(content);
      } catch (parseErr) {
        // SKILL-01 / D-86-02: unparseable source -> synthesize a known-good
        // `disable-model-invocation` block (body preserved verbatim) so the
        // skill still installs (no hard-fail), stays invocable by `/name`, and
        // is never auto-invoked. The actionable detail (plugin, component,
        // parse error) rides the install-time warning channel instead.
        content = synthesizeUnparseableSkill(
          extractBodyAfterFrontmatter(content),
          skill.generatedName,
        );
        degraded.push({
          generatedName: skill.generatedName,
          parseError: errorMessage(parseErr),
        });
      }

      // The parseable (gate-1 RETURN) arm keeps today's SK-3 name rewrite, then
      // layers the SKILL-02 / WTU-01 / WTU-02 augment arm on the parsed values;
      // the synthesized arm already emits the generated `name` + a placeholder
      // `description`, so it skips both. SK-4 substitution runs on both arms.
      if (parsed !== undefined) {
        content = rewriteFrontmatterName(content, skill.generatedName);
        content = augmentSkillDescription(content, parsed.frontmatter, parsed.body, {
          pluginRoot,
          pluginData: pluginDataDir,
        });
      }

      content = substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir });
      await writeFile(skillMdPath, content, "utf8");

      // PARSE-02 / D-86-04: re-parse the STAGED bytes as a Pi-acceptability
      // backstop. A THROW here means our OWN rewrite/substitution produced
      // bytes Pi would reject -- our defect, not the author's. Throw loudly so
      // it rides the cleanup catch below; never mask it as author degradation.
      parseFrontmatter(content);

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
      degraded: Object.freeze(degraded),
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
  // If a stale target dir exists (e.g. from a previous failed uninstall), remove
  // it first -- POSIX rename(2) fails with ENOTEMPTY on non-empty directories.
  // PI-6 cross-plugin conflict guard already ran before staging, so any pre-existing
  // dir at pair.to is an orphan safe to discard.
  await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
  for (const pair of prepared._renamePairs) {
    // If a stale directory exists at the target (e.g. orphaned from a previous
    // failed uninstall), remove it before renaming -- POSIX rename(2) fails with
    // ENOTEMPTY on non-empty directories. Only remove if it is a directory; a
    // file at pair.to is unexpected and should surface as a commit error (ENOTDIR).
    // PI-6 cross-plugin conflict guard already ran before staging, so any
    // pre-existing directory here is an orphan safe to discard.
    try {
      const targetStat = await stat(pair.to);
      if (targetStat.isDirectory()) {
        await rm(pair.to, { recursive: true, force: true });
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        throw e;
      }
    }

    await rename(pair.from, pair.to);
  }

  // Step 4: best-effort cleanup of the staging UUID dir.
  return cleanupStaging(prepared.stagingRoot, "skills staging directory");
}

/**
 * Cleanup-only counterpart to commit. Called when prepare returned the
 * `staged` variant but the orchestrator decided not to commit (e.g. another
 * bridge in the same install transaction failed). After commit succeeds,
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

    // TR-06: 3-arm policy at the rename loop. ownedNames is the basename
    // membership set derived from state.json (via _previousNames). When a
    // pre-existing target shares an owned basename, it is treated as an
    // orphan from a prior partial install and pre-removed via the
    // kind-strict helper. Foreign content (basename NOT in ownedNames)
    // still triggers the existing PI-6 "non-previous content" rejection
    // verbatim. Skills targets are directories -> mode "tree".
    const ownedNames = new Set<string>(prepared._previousNames);
    await mkdir(prepared.locations.skillsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      const targetName = path.basename(pair.to);
      if (ownedNames.has(targetName)) {
        await removeOrphanIfPresent(pair.to, "tree");
      } else if (await pathExists(pair.to)) {
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
