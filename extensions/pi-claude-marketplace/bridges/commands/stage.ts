// bridges/commands/stage.ts
//
// CommandsBridge: prepare/commit/abort + RN-6 collision detection, plus Phase 8
// replacement exports: replacePreparedCommands, rollbackCommandsReplacement,
// finalizeCommandsReplacement.
// Pattern carry-forward from V1 `resource/stage.ts` (commands branch of
// `stagePluginResources`) for the body-substitute + per-file rename
// logic; prepare/commit/abort discipline mirrors V1 `agent/stage.ts`.
//
// Storage layout:
//   - Staging:   <extensionRoot>/commands-staging/<uuid>/<plugin>:<command>.md
//   - Target:    <extensionRoot>/resources/prompts/<plugin>:<command>.md
//
// Filenames carry the literal colon (`:`) in the basename. POSIX targets
// allow this; Phase 3 explicitly does not target Windows (RESEARCH).
//
// Atomicity: per-file `rename` from staging into the target dir is atomic
// on the same filesystem (NFR-1). Staging dir lives under
// `<extensionRoot>/` so source and destination share the same FS.
//
// Re-stage path: previous-named target files (`previousCommandNames`) are
// deleted before the new renames are issued. ENOENT is tolerated -- if a
// previous file is already gone (e.g. a prior install partially failed),
// the unlink is a no-op.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
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
import { substituteClaudeVars } from "../../shared/vars.ts";

import { discoverPluginCommands } from "./discover.ts";

import type {
  CommandsReplacement,
  DiscoveredCommand,
  PreparedCommandsStaging,
  StageCommandsInput,
  StagedCommandRecord,
} from "./types.ts";

type CommandsReplacementInternals = Readonly<{
  backupRoot: string;
  backups: readonly { name: string; from: string; to: string }[];
  renamed: readonly { from: string; to: string }[];
}>;

const commandsReplacementInternals = new WeakMap<
  Extract<CommandsReplacement, { kind: "replaced" }>,
  CommandsReplacementInternals
>();

/**
 * RN-6: detect two source command names that elide to the same generated
 * name. When a collision is found, throw with BOTH source names listed so
 * the user can resolve it without guessing which two collided.
 *
 * Single-collision message:
 *   `Generated command name collision detected. Rename one of the source commands:
 *      "acme:deploy" <- ["acme-deploy", "deploy"]`
 *
 * Multi-collision messages join each line on a fresh `\n  ` separator.
 */
export function assertNoCommandCollisions(discovered: readonly DiscoveredCommand[]): void {
  const groups = new Map<string, string[]>();

  for (const c of discovered) {
    const arr = groups.get(c.generatedName) ?? [];
    arr.push(c.sourceName);
    groups.set(c.generatedName, arr);
  }

  const collisions: string[] = [];

  for (const [gen, sources] of groups) {
    if (sources.length > 1) {
      const quotedSources = sources.map((s) => `"${s}"`).join(", ");
      collisions.push(`"${gen}" <- [${quotedSources}]`);
    }
  }

  if (collisions.length > 0) {
    throw new Error(
      `Generated command name collision detected. Rename one of the source commands:\n  ` +
        collisions.join("\n  "),
    );
  }
}

/**
 * Stage commands into a fresh `<commandsStagingDir>/<uuid>/` tree. Reads
 * each source `.md`, substitutes `${CLAUDE_PLUGIN_ROOT}` /
 * `${CLAUDE_PLUGIN_DATA}` (CM-3), and writes the substituted body to a
 * staging file. Per-file rename to the target dir is deferred to
 * `commitPreparedCommands`.
 *
 * Returns a `kind: "noop"` short-circuit when `discovered.length === 0 &&
 * previousCommandNames.length === 0`: nothing to stage AND nothing to
 * remove, so creating the staging dir would be wasteful.
 */
export async function prepareStageCommands(
  input: StageCommandsInput,
): Promise<PreparedCommandsStaging> {
  const { locations, pluginName, pluginRoot, pluginDataDir, resolved } = input;
  const previousNames = input.previousCommandNames ?? [];
  // D-07: discover returns { discovered, warnings }. warnings carry
  // duplicate-generated-name first-wins skips across multiple
  // componentPaths.commands entries.
  const { discovered, warnings: discoverWarnings } = await discoverPluginCommands({
    pluginName,
    resolved,
  });

  assertNoCommandCollisions(discovered);

  // Materialization gate (symmetry with skills bridge). D-07: surface
  // discoverWarnings even on noop so duplicate-generated-name skips
  // remain observable.
  if (discovered.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze<string[]>([]),
        recorded: Object.freeze<StagedCommandRecord[]>([]),
        warnings: Object.freeze([...discoverWarnings]),
      },
    };
  }

  const stagingRoot = path.join(locations.commandsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.commandsStagingDir, stagingRoot, "commands staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];

  try {
    for (const command of discovered) {
      assertSafeName(command.generatedName, "generated command name");
      // Filename includes the colon: <plugin>:<command>.md
      const stagedFile = path.join(stagingRoot, command.generatedName + ".md");
      await assertPathInside(stagingRoot, stagedFile, "staged command file");

      const targetFile = path.join(locations.promptsTargetDir, command.generatedName + ".md");
      await assertPathInside(locations.promptsTargetDir, targetFile, "target command file");

      let content = await readFile(command.commandFile, "utf8");
      content = substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir });
      await writeFile(stagedFile, content, "utf8");

      renamePairs.push({ from: stagedFile, to: targetFile });
      stagedNames.push(command.generatedName);
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingRoot, "commands staging directory"));
  }

  const recorded: StagedCommandRecord[] = discovered.map((command) => ({
    generatedName: command.generatedName,
    sourcePath: command.commandFile,
    targetPath: path.join(locations.promptsTargetDir, command.generatedName + ".md"),
  }));

  return {
    kind: "staged",
    locations,
    stagingRoot,
    result: {
      stagedNames: Object.freeze(stagedNames),
      recorded: Object.freeze(recorded),
      warnings: Object.freeze([...discoverWarnings]),
    },
    _previousNames: Object.freeze([...previousNames]),
    _renamePairs: Object.freeze(renamePairs),
  };
}

/**
 * Commit a prepared staging into the target dir. Removes any
 * previously-named target files (re-stage path -- ENOENT-tolerant), then
 * issues the per-file `rename(stagedFile, targetFile)` calls. Finally,
 * cleans up the staging dir; if cleanup fails, returns the leak message
 * string so the caller can surface it via `appendLeakToError` without
 * losing the install's success state.
 *
 * Returns `undefined` on a successful commit (or for a noop). Returns the
 * leak message when staging cleanup fails.
 */
export async function commitPreparedCommands(
  prepared: PreparedCommandsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  // Remove previous-named target files (re-stage). Each unlink is
  // ENOENT-tolerant -- a previously-staged file may already be gone.
  for (const name of prepared._previousNames) {
    const target = path.join(prepared.locations.promptsTargetDir, name + ".md");
    await assertPathInside(prepared.locations.promptsTargetDir, target, "previous command file");

    try {
      await unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  // Lazy-create the target dir + sequential rename staged -> target with
  // TR-05 reverse-walk rollback tracking. Mirrors the
  // `commitPreparedAgents` step-2 shape (Phase 38 / TR-01): track each
  // successful rename in completedRenames[]; on a partial failure, reverse-
  // walk the spread copy and rename each back into the staging root. The
  // rollback loop NEVER throws; failures accumulate into rollbackLeaks[]
  // surfaced via appendLeaks (Pitfall 1, Pitfall 8).
  const completedRenames: { from: string; to: string }[] = [];
  try {
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
    const rollbackLeaks: string[] = [];
    for (const pair of [...completedRenames].reverse()) {
      try {
        await rename(pair.to, pair.from);
      } catch (rollbackErr) {
        rollbackLeaks.push(
          `failed to roll back command rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
        );
      }
    }

    throw appendLeaks(err, [
      ...rollbackLeaks,
      await cleanupStaging(prepared.stagingRoot, "commands staging directory"),
    ]);
  }

  return cleanupStaging(prepared.stagingRoot, "commands staging directory");
}

/**
 * Abort a prepared staging. Cleans up the staging dir; the noop branch
 * has nothing to clean.
 */
export async function abortPreparedCommands(
  prepared: PreparedCommandsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupStaging(prepared.stagingRoot, "commands staging directory");
}

/**
 * Reinstall-safe replacement helper. Unlike commitPreparedCommands, this
 * backs up previous plugin-owned prompt files before staged renames so a
 * later orchestrator failure can restore the old install.
 */
export async function replacePreparedCommands(
  prepared: PreparedCommandsStaging,
): Promise<CommandsReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  const backupRoot = path.join(prepared.locations.commandsStagingDir, `backup-${randomUUID()}`);
  await mkdir(backupRoot, { recursive: true });
  await assertPathInside(prepared.locations.commandsStagingDir, backupRoot, "commands backup root");

  const backups: { name: string; from: string; to: string }[] = [];
  const renamed: { from: string; to: string }[] = [];

  try {
    for (const name of prepared._previousNames) {
      assertSafeName(name, "previous command name");
      const target = path.join(prepared.locations.promptsTargetDir, name + ".md");
      await assertPathInside(prepared.locations.promptsTargetDir, target, "previous command file");
      if (!(await pathExists(target))) {
        continue;
      }

      const backup = path.join(backupRoot, name + ".md");
      await assertPathInside(backupRoot, backup, "commands backup file");
      await rename(target, backup);
      backups.push({ name, from: target, to: backup });
    }

    // TR-06: 3-arm policy at the rename loop. ownedNames is the basename
    // membership set derived from state.json (via _previousNames). When a
    // pre-existing target shares an owned basename, it is treated as an
    // orphan from a prior partial install and pre-removed via the
    // kind-strict helper. Foreign content (basename NOT in ownedNames)
    // still triggers the existing PI-6 "non-previous content" rejection
    // verbatim. Command targets are .md files -> mode "file".
    const ownedNames = new Set<string>(prepared._previousNames);
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      const targetName = path.basename(pair.to, ".md");
      if (ownedNames.has(targetName)) {
        await removeOrphanIfPresent(pair.to, "file");
      } else if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace command target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      renamed.push(pair);
    }
  } catch (err) {
    const leaks = await rollbackCommandsReplacementInternal(prepared, renamed, backups, backupRoot);
    if (leaks.length > 0) {
      throw new ManualRecoveryError(errorMessage(err), leaks, { cause: err });
    }

    throw err;
  }

  const replacement: Extract<CommandsReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
  };
  commandsReplacementInternals.set(replacement, {
    backupRoot,
    backups: Object.freeze(backups),
    renamed: Object.freeze(renamed),
  });
  return replacement;
}

export async function rollbackCommandsReplacement(
  replacement: CommandsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireCommandsReplacementInternals(replacement);
  return rollbackCommandsReplacementInternal(
    replacement.prepared,
    internals.renamed,
    internals.backups,
    internals.backupRoot,
  );
}

export async function finalizeCommandsReplacement(
  replacement: CommandsReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireCommandsReplacementInternals(replacement);
  const leaks = [
    await cleanupStaging(internals.backupRoot, "commands replacement backup directory"),
    await cleanupStaging(replacement.prepared.stagingRoot, "commands staging directory"),
  ].filter((leak): leak is string => leak !== undefined);
  return Object.freeze(leaks);
}

function requireCommandsReplacementInternals(
  replacement: Extract<CommandsReplacement, { kind: "replaced" }>,
): CommandsReplacementInternals {
  const internals = commandsReplacementInternals.get(replacement);
  if (internals === undefined) {
    throw new Error("Unknown commands replacement handle.");
  }

  return internals;
}

async function rollbackCommandsReplacementInternal(
  prepared: Extract<PreparedCommandsStaging, { kind: "staged" }>,
  renamed: readonly { from: string; to: string }[],
  backups: readonly { name: string; from: string; to: string }[],
  backupRoot: string,
): Promise<readonly string[]> {
  return rollbackReplacementCommon({
    renamed,
    backups,
    stagingRoot: prepared.stagingRoot,
    backupRoot,
    removeMode: "file",
    labels: {
      replacement: "replacement command file",
      previous: "previous command file",
      stagingDir: "commands staging directory",
      backupDir: "commands replacement backup directory",
    },
  });
}
