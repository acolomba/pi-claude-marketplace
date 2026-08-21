// bridges/commands/stage.ts
//
// CommandsBridge: prepare/commit/abort, plus replacement exports:
// replacePreparedCommands, rollbackCommandsReplacement,
// finalizeCommandsReplacement.
//
// There is no RN-6 collision gate here. `discoverPluginCommands` returns the
// values of a Map keyed on the generated name, so its output is duplicate-free
// by construction and a gate reading it could never fire. Two sources that
// produce one name is the D-07 first-wins skip, warned about at discovery --
// which is also what D-141-01 mandates, since the elision it locks in makes
// the collision reachable within one directory.
//
// Storage layout:
//   - Staging:   <extensionRoot>/commands-staging/<uuid>/<plugin>:<command>.md
//   - Target:    <extensionRoot>/resources/prompts/<plugin>:<command>.md
//
// Filenames carry the literal colon (`:`) in the basename. POSIX targets
// allow this; Windows is explicitly not targeted.
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
import { parseFrontmatter } from "../../platform/pi-api.ts";
import { BridgeStagingError } from "../../shared/errors-bridges.ts";
import {
  appendLeakToError,
  appendLeaks,
  errorMessage,
  isErrnoException,
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
  CommandDegradeRecord,
  CommandsReplacement,
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
 * CMD-01 / D-86-07: neutralize an unparseable command source by stripping the
 * ENTIRE malformed frontmatter block -- the opening `---` line through the
 * matching closing `---` line -- leaving the real body. A re-parse of the
 * result RETURNS empty, so Pi's command loader falls back to name-from-filename
 * + description-from-first-body-line (NOT delimiter-only stripping, which would
 * leave ex-frontmatter junk as the first body line). Called ONLY on the gate-1
 * throw arm, where a closed `---`...`---` block is present by construction.
 *
 * Newlines are first normalized (CR/CRLF -> LF) with the SAME two-step replace
 * `parseFrontmatter` applies before its own `\n---` close search, so this scan
 * agrees with the parser for every line-ending style -- including lone-CR
 * sources, which would otherwise hide the close from a raw `\n---` search and
 * turn a graceful degrade into a gate-2 hard-fail. The body is emitted with LF
 * line endings (what Pi's loader normalizes the staged file to on read anyway).
 *
 * Successive leading malformed blocks are stripped until the remainder PARSES
 * (RETURNS) under Pi's loader: a source whose body itself opens with a second
 * malformed `---`...`---` block would otherwise re-throw at the PARSE-02 backstop
 * and turn a graceful degrade into a hard-fail. A leading block that parses
 * cleanly, or a remainder with no opening `---`, is Pi-acceptable and kept
 * verbatim (matching what Pi's own loader would do). Each pass removes at least
 * the opening delimiter, so the loop terminates.
 */
function neutralizeCommandFrontmatter(content: string): string {
  let normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

  for (;;) {
    if (!normalized.startsWith("---")) {
      // No opening fence: parseFrontmatter RETURNS the body as-is, nothing to strip.
      return normalized;
    }

    const closeIdx = normalized.indexOf("\n---", 3);
    if (closeIdx === -1) {
      // Opening `---` but no close: parseFrontmatter RETURNS, leave unchanged.
      return normalized;
    }

    const afterClose = normalized.indexOf("\n", closeIdx + 1);
    const stripped = afterClose === -1 ? "" : normalized.slice(afterClose + 1);

    try {
      // A clean parse (empty or valid frontmatter, or no opening fence) means the
      // remainder is Pi-acceptable -- stop here.
      parseFrontmatter(stripped);
      return stripped;
    } catch {
      // The remainder still opens with a malformed block; strip it too.
      normalized = stripped;
    }
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

export async function prepareStageCommands(
  input: StageCommandsInput,
): Promise<PreparedCommandsStaging> {
  const { locations, pluginName, pluginRoot, pluginDataDir, resolved, cwd } = input;
  const previousNames = input.previousCommandNames ?? [];
  // D-07: discover returns { discovered, warnings }. warnings carry
  // duplicate-generated-name first-wins skips across multiple
  // componentPaths.commands entries.
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
        warnings: Object.freeze([...discoverWarnings]),
        // CMD-01: the noop branch stages no commands, so no source is parsed and
        // nothing can degrade -- always empty here.
        degraded: Object.freeze<CommandDegradeRecord[]>([]),
      },
    };
  }

  const stagingRoot = path.join(locations.commandsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.commandsStagingDir, stagingRoot, "commands staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];
  const degraded: CommandDegradeRecord[] = [];

  try {
    for (const command of discovered) {
      try {
        assertSafeName(command.generatedName, "generated command name");
        // Filename includes the colon: <plugin>:<command>.md
        const stagedFile = path.join(stagingRoot, command.generatedName + ".md");
        await assertPathInside(stagingRoot, stagedFile, "staged command file");

        const targetFile = path.join(locations.promptsTargetDir, command.generatedName + ".md");
        await assertPathInside(locations.promptsTargetDir, targetFile, "target command file");

        let content = await readFile(command.commandFile, "utf8");

        // PARSE-01: parse the SOURCE frontmatter BEFORE substitution to establish
        // attribution ground truth + the degrade trigger. A THROW means a closed
        // `---` block whose inner YAML is malformed (an author defect); a RETURN
        // (including absent/empty frontmatter) is the byte-identical passthrough
        // (NREG-01). The parse is READ-ONLY -- validate, never eval (T-03-17).
        try {
          parseFrontmatter(content);
        } catch (parseErr) {
          // CMD-01 / D-86-07: neutralize by stripping the entire malformed
          // frontmatter block, leaving the real body, so Pi's command loader
          // takes name-from-filename + description-from-first-body-line. No
          // synthesized placeholder and no disable flag -- Pi's command loader
          // has no non-empty-description gate.
          content = neutralizeCommandFrontmatter(content);
          degraded.push({
            generatedName: command.generatedName,
            parseError: errorMessage(parseErr),
          });
        }

        // SUB-02: ${CLAUDE_PROJECT_DIR} resolves to the install cwd only for
        // project scope; user scope leaves the token literal (undefined ->
        // pass-through). Commands are not skill-scoped, so no skillDir is
        // supplied and ${CLAUDE_SKILL_DIR} stays literal.
        content = substituteClaudeVars(content, {
          pluginRoot,
          pluginData: pluginDataDir,
          projectDir: locations.scope === "project" ? cwd : undefined,
        });
        await writeFile(stagedFile, content, "utf8");

        // PARSE-02 / D-86-04: re-parse the STAGED bytes as a Pi-acceptability
        // backstop. The neutralized output is designed to RETURN, so a THROW here
        // is OUR self-inflicted defect (substitution produced bytes Pi rejects) --
        // throw loudly so it rides the cleanup catch below; never mask it as
        // author degradation.
        parseFrontmatter(content);

        renamePairs.push({ from: stagedFile, to: targetFile });
        stagedNames.push(command.generatedName);
      } catch (err) {
        throw contextualStagingError(pluginName, command.generatedName, err);
      }
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
      // CMD-01: one record per command whose SOURCE frontmatter was unparseable
      // and neutralized (D-86-07). The install orchestrator maps these to the
      // `{malformed command}` reason token + per-component detail.
      degraded: Object.freeze(degraded),
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
  // `commitPreparedAgents` step-2 shape (TR-01): track each
  // successful rename in completedRenames[]; on a partial failure, reverse-
  // walk the spread copy and rename each back into the staging root. The
  // rollback loop NEVER throws; failures accumulate into rollbackLeaks[]
  // surfaced via appendLeaks.
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
