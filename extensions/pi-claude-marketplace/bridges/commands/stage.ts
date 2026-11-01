// bridges/commands/stage.ts
//
// CommandsBridge: prepare/commit/abort.
//
// There is no RN-6 collision gate here. `discoverPluginCommands` returns the
// values of a Map keyed on the generated name, so its output is duplicate-free
// by construction and a gate reading it could never fire. Two sources that
// produce one name is the D-07 first-wins skip, warned about at discovery --
// which is also what D-141-01 mandates, since the elision it locks in makes
// the collision reachable within one directory.
//
// Storage layout:
//   - Staging:   <extensionRoot>/commands-staging/<uuid>/<generatedName>.md
//   - Target:    <extensionRoot>/resources/prompts/<generatedName>.md
//
// Both basenames are the generated command name, whose namespace separator
// is platform-dependent: `platform/os.ts::commandNamespaceSeparator` gives a
// colon on POSIX, which the filesystem accepts, and a dot on Windows, where
// NTFS forbids a colon in a filename.
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
import { BridgeStagingError } from "../../shared/errors-bridges.ts";
import {
  appendLeakToError,
  appendLeaks,
  errorMessage,
  isErrnoException,
} from "../../shared/errors.ts";
import { cleanupStaging } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { discoveryWarning } from "../../shared/staging-warnings.ts";

import { discoverPluginCommands } from "./discover.ts";
import { commandFileDigest, projectCommandChange } from "./project-ledger.ts";
import { buildStagedCommand } from "./staged-command.ts";

import type { ProjectCommandEntry, ProjectCommandLedger } from "./project-ledger.ts";
import type { StagedCommandContext } from "./staged-command.ts";
import type {
  CommandDegradeRecord,
  DiscoveredCommand,
  PreparedCommandsStaged,
  PreparedCommandsStaging,
  StageCommandsInput,
  StagedCommandRecord,
} from "./types.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";

/**
 * Give a filesystem failure during staging the two facts it is missing.
 *
 * The staged basename is the generated command name, and CM-4 makes that name
 * as long as the whole relative source path, so ENAMETOOLONG is reachable.
 * The raw errno names a path under an internal staging UUID, which tells the
 * plugin author nothing about which of their files is at fault.
 *
 * Only an errno exception is wrapped. `PathContainmentError` carries no
 * `.code`, so it passes through verbatim and the PI-14 bypass still sees the
 * class it narrows on; a frontmatter parse throw passes through for the same
 * reason.
 */
function contextualStagingError(pluginName: string, generatedName: string, err: unknown): unknown {
  if (!isErrnoException(err)) {
    return err;
  }

  return new BridgeStagingError(
    `command "${generatedName}" of plugin "${pluginName}" could not be staged`,
    { cause: err },
  );
}

/**
 * The `sourcePath` a staged command's record names: its source file, or for
 * an inline command of the D-CF3-03 object map, which has no file, the
 * synthetic `<plugin root>#commands.<key>` (as MCP servers record
 * `<plugin root>#mcpServers`).
 */
function commandSourcePath(command: DiscoveredCommand, pluginRoot: string): string {
  return command.kind === "file"
    ? command.commandFile
    : `${pluginRoot}#commands.${command.sourceName}`;
}

/**
 * Stage commands into a fresh `<commandsStagingDir>/<uuid>/` tree. Builds
 * each source `.md` into its staged text through `buildStagedCommand`
 * (substitution, reference rewrite, rebuilt frontmatter with the D-CF3-08
 * description) and writes it to a staging file. Per-file rename to the target dir is deferred to
 * `commitPreparedCommands`.
 *
 * The result's warnings are the discover warnings, then one discovery warning
 * per command whose source frontmatter sets fields Pi cannot honor, in
 * command order (D-CF3-09); the install renders each as a declared-component
 * note.
 *
 * Returns a `kind: "noop"` short-circuit when `discovered.length === 0 &&
 * previousCommandNames.length === 0`: nothing to stage AND nothing to
 * remove, so creating the staging dir would be wasteful.
 */
export async function prepareStageCommands(
  ops: RemovalOps,
  input: StageCommandsInput,
): Promise<PreparedCommandsStaging> {
  const { locations, pluginName, pluginRoot, pluginDataDir, resolved, cwd } = input;
  const previousNames = input.previousCommandNames ?? [];
  // D-07: discover returns { discovered, warnings }. warnings carry
  // duplicate-generated-name first-wins skips across multiple
  // componentPaths.commands entries.
  // fallow-ignore-next-line code-duplication -- reviewed: the commands and skills bridges keep the same shape on purpose, and the fallow boundary zones forbid one bridge from importing the other
  const { discovered, warnings: discoverWarnings } = await discoverPluginCommands({
    pluginName,
    resolved,
  });

  // Materialization gate (symmetry with skills bridge). D-07: surface
  // discoverWarnings even on noop so duplicate-generated-name skips
  // remain observable.
  if (discovered.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze<string[]>([]),
        recorded: Object.freeze<StagedCommandRecord[]>([]),
        warnings: Object.freeze(discoverWarnings.map(discoveryWarning)),
        // CMD-01: the noop branch stages no commands, so no source is parsed and
        // nothing can degrade -- always empty here.
        degraded: Object.freeze<CommandDegradeRecord[]>([]),
      },
    };
  }

  const referenceNames = input.referenceNames ?? {
    skills: [],
    commands: discovered.map((command) => command.generatedName),
    workflows: [],
  };

  // SUB-02: ${CLAUDE_PROJECT_DIR} resolves to the install cwd only for project
  // scope; user scope leaves the token literal. Commands are not skill-scoped,
  // so ${CLAUDE_SKILL_DIR} stays literal.
  const context: StagedCommandContext = {
    pluginName,
    pluginRoot,
    pluginDataDir,
    projectDir: locations.scope === "project" ? cwd : undefined,
    referenceNames,
  };

  const stagingRoot = path.join(locations.commandsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.commandsStagingDir, stagingRoot, "commands staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];
  const degraded: CommandDegradeRecord[] = [];
  const droppedFields: string[] = [];

  try {
    for (const command of discovered) {
      try {
        assertSafeName(command.generatedName, "generated command name");
        // Filename is the generated command name: <generatedName>.md
        const stagedFile = path.join(stagingRoot, command.generatedName + ".md");
        // eslint-disable-next-line no-await-in-loop -- staging cleanup in the catch needs no write in flight
        await assertPathInside(stagingRoot, stagedFile, "staged command file");

        const targetFile = path.join(locations.promptsTargetDir, command.generatedName + ".md");
        // eslint-disable-next-line no-await-in-loop -- staging cleanup in the catch needs no write in flight
        await assertPathInside(locations.promptsTargetDir, targetFile, "target command file");

        // eslint-disable-next-line no-await-in-loop -- staging cleanup in the catch needs no write in flight
        const staged = await buildStagedCommand(command, context);
        if (staged.parseError !== undefined) {
          // CMD-01 / D-86-07: the source frontmatter did not parse and was
          // neutralized; the install maps this to `{malformed command}`.
          degraded.push({ generatedName: command.generatedName, parseError: staged.parseError });
        }

        if (staged.droppedFields !== undefined) {
          droppedFields.push(staged.droppedFields);
        }

        // eslint-disable-next-line no-await-in-loop -- staging cleanup in the catch needs no write in flight
        await writeFile(stagedFile, staged.text, "utf8");

        renamePairs.push({ from: stagedFile, to: targetFile });
        stagedNames.push(command.generatedName);
      } catch (err) {
        throw contextualStagingError(pluginName, command.generatedName, err);
      }
    }
  } catch (err) {
    throw appendLeakToError(
      err,
      await cleanupStaging(ops, stagingRoot, "commands staging directory"),
    );
  }

  const recorded: StagedCommandRecord[] = discovered.map((command) => ({
    generatedName: command.generatedName,
    sourcePath: commandSourcePath(command, pluginRoot),
    targetPath: path.join(locations.promptsTargetDir, command.generatedName + ".md"),
  }));

  return {
    kind: "staged",
    locations,
    stagingRoot,
    result: {
      stagedNames: Object.freeze(stagedNames),
      recorded: Object.freeze(recorded),
      warnings: Object.freeze([...discoverWarnings, ...droppedFields].map(discoveryWarning)),
      // CMD-01: one record per command whose SOURCE frontmatter was unparseable
      // and neutralized (D-86-07). The install orchestrator maps these to the
      // `{malformed command}` reason token + per-component detail.
      degraded: Object.freeze(degraded),
    },
    _previousNames: Object.freeze([...previousNames]),
    _pluginName: pluginName,
    _renamePairs: Object.freeze(renamePairs),
  };
}

/**
 * D-CF3-07: lists the committed commands of a project-scope stage in the
 * user's project ledger, each with the digest of its file as it now sits at
 * its target, and drops the previous names this stage replaced. A user-scope
 * stage reads no file and writes no ledger.
 */
async function recordCommittedCommands(
  ledger: ProjectCommandLedger,
  prepared: PreparedCommandsStaged,
): Promise<void> {
  const change = projectCommandChange(prepared.locations, prepared._previousNames);
  if (change === undefined) {
    return;
  }

  const committed = new Map<string, ProjectCommandEntry>();
  for (const command of prepared.result.recorded) {
    // eslint-disable-next-line no-await-in-loop -- the digest reads each committed file once, in commit order
    const text = await readFile(command.targetPath, "utf8");
    committed.set(command.generatedName, {
      plugin: prepared._pluginName,
      sha256: commandFileDigest(text),
    });
  }

  await ledger.update({ ...change, remember: committed });
}

/**
 * WR-01: removes the renamed commands of a commit whose project ledger write
 * failed. The update runner has no undo, so a commit that throws must leave
 * no command on disk that the ledger and the state record do not list. A
 * file that is already gone needs no removal. Any other failure becomes a
 * leak message, in rename order.
 */
async function removeUnrecordedCommands(
  prepared: PreparedCommandsStaged,
): Promise<(string | undefined)[]> {
  return Promise.all(
    prepared._renamePairs.map(async ({ to }) =>
      unlink(to).then(
        () => undefined,
        (err: unknown) =>
          (err as NodeJS.ErrnoException).code === "ENOENT"
            ? undefined
            : `failed to remove unrecorded command ${to}: ${errorMessage(err)}`,
      ),
    ),
  );
}

/**
 * Commit a prepared staging into the target dir. Removes any
 * previously-named target files (re-stage path -- ENOENT-tolerant), then
 * issues the per-file `rename(stagedFile, targetFile)` calls. Then it
 * cleans up the staging dir; if cleanup fails, it returns the leak message
 * string so the caller can surface it via `appendLeakToError` without
 * losing the install's success state. Last, at project scope, it lists the
 * committed commands in the user's project ledger (D-CF3-07). IN-02: the
 * cleanup runs first. WR-01: a failed ledger write removes the renamed
 * commands, then throws with any cleanup leak and removal leak appended. So
 * a throw means no new command was committed, for the install ledger and
 * for the update runner, which has no undo.
 *
 * Returns `undefined` on a successful commit (or for a noop). Returns the
 * leak message when staging cleanup fails.
 */
export async function commitPreparedCommands(
  ops: RemovalOps,
  prepared: PreparedCommandsStaging,
  ledger: ProjectCommandLedger,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  // Remove previous-named target files (re-stage). Each unlink is
  // ENOENT-tolerant -- a previously-staged file may already be gone.
  for (const name of prepared._previousNames) {
    const target = path.join(prepared.locations.promptsTargetDir, name + ".md");
    // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
    await assertPathInside(prepared.locations.promptsTargetDir, target, "previous command file");
    // Defense-in-depth (state.json corruption could surface a bad name), checked
    // after containment so a path-separator name still surfaces as the existing
    // PathContainmentError / SymlinkRefusedError, not this.
    assertSafeName(name, "previous command name");

    try {
      // eslint-disable-next-line no-await-in-loop -- the first containment or unlink failure stops later unlinks
      await unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  // Lazy-create the target dir + sequential rename staged -> target with
  // TR-05 reverse-walk rollback tracking. Mirrors the
  // `commitPreparedAgents` step-2 shape (TR-01): track each
  // successful rename in completedRenames[]; on a partial failure, reverse-
  // walk the spread copy and rename each back into the staging root. The
  // rollback loop NEVER throws; failures accumulate into rollbackLeaks[]
  // surfaced via appendLeaks.
  const completedRenames: { from: string; to: string }[] = [];
  try {
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      // eslint-disable-next-line no-await-in-loop -- TR-01: one rename at a time so rollback knows which landed
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
    const rollbackLeaks: string[] = [];
    for (const pair of [...completedRenames].reverse()) {
      try {
        // eslint-disable-next-line no-await-in-loop -- rollback walks completed renames in reverse
        await rename(pair.to, pair.from);
      } catch (rollbackErr) {
        rollbackLeaks.push(
          `failed to roll back command rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
        );
      }
    }

    throw appendLeaks(err, [
      ...rollbackLeaks,
      await cleanupStaging(ops, prepared.stagingRoot, "commands staging directory"),
    ]);
  }

  const leak = await cleanupStaging(ops, prepared.stagingRoot, "commands staging directory");
  try {
    await recordCommittedCommands(ledger, prepared);
  } catch (err) {
    throw appendLeaks(err, [leak, ...(await removeUnrecordedCommands(prepared))]);
  }

  return leak;
}

/**
 * Abort a prepared staging. Cleans up the staging dir; the noop branch
 * has nothing to clean.
 */
export async function abortPreparedCommands(
  ops: RemovalOps,
  prepared: PreparedCommandsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  return cleanupStaging(ops, prepared.stagingRoot, "commands staging directory");
}
