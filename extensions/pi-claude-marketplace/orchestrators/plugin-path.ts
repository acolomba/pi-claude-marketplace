/**
 * orchestrators/plugin-path.ts -- the PENV-01 plugin-PATH recompute I/O shell.
 *
 * Reads install state for both scopes and threads it through the pure ledger
 * core in `shared/session-env.ts` into `process.env.PATH` +
 * `PI_CLAUDE_MARKETPLACE_PATH`. Lives in `orchestrators/` (not `shared/`)
 * because it imports `persistence/` -- the D-v1.0-01-11 import-direction rule forbids
 * `shared/` from importing `persistence/`, so the state-reading half of the
 * feature sits here alongside the other load-time reconcile orchestration.
 *
 * D-PG10-02: the project scope contributes only in a project Pi trusts. This
 * closes the case where Pi's answer is "not trusted"; a project Pi trusts
 * without asking is the gap D-LOC-01 accepts.
 */
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { asAbsolutePluginRoot } from "../domain/plugin-root.ts";
import { locationsFor } from "../persistence/locations.ts";
import { isRecordedButDisabled, loadState } from "../persistence/state-io.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage, isErrnoException } from "../shared/errors.ts";
import { applyPathLedger, PATH_LEDGER_ENV } from "../shared/session-env.ts";

import type { ExtensionState } from "../persistence/state-io.ts";

/**
 * PENV-01: collect the candidate `<resolvedSource>/bin` for every enabled
 * plugin record in `state`, in a stable insertion order (marketplace-then-plugin
 * object order). Disabled records are excluded. Pure: reads no `process.env`,
 * touches no fs; `keptBinDirs` decides which candidates exist (D-PG10-03).
 *
 * WR-01: `resolvedSource` is only `Type.String()` on state.json and is not
 * brand-validated at load, so a corrupted record (empty / relative /
 * traversal) would compose a relative PATH entry (CWE-426 untrusted search
 * path) inherited by every bash child. Mirror the hooks-hydrate guard
 * (`asAbsolutePluginRoot`) and drop such records instead of letting them
 * reach `process.env.PATH`.
 */
function collectBinDirs(state: ExtensionState): string[] {
  const dirs: string[] = [];
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const [pluginName, rec] of Object.entries(mp.plugins)) {
      // ENBL-05: read the single disabled-state predicate rather than the
      // `enabled` boolean directly, so this site cannot drift from the rule
      // `persistence/state-io.ts` owns.
      if (isRecordedButDisabled(rec)) {
        continue;
      }

      try {
        const root = asAbsolutePluginRoot(rec.resolvedSource);
        dirs.push(path.join(root, "bin"));
      } catch (err) {
        // WR-01: empty/relative/traversal resolvedSource must never reach PATH.
        // Log the drop (mirroring the hooks-hydrate guard's logging) so a
        // plugin whose bin dir vanished from PATH is diagnosable.
        hookDebugLog(
          `plugin PATH: dropped invalid resolvedSource for ${mpName}/${pluginName}: ${errorMessage(err)}`,
          "env",
        );
      }
    }
  }

  return dirs;
}

// Taken verbatim from Claude Code 2.1.323 `getEnabledPluginBinPaths` (D-PG10-22).
const SHELL_METACHARACTERS = /[:"'$`\\\n\r]/;
// Upstream skips the character check where the path separator is a backslash.
const CHECKS_SHELL_METACHARACTERS = path.sep !== "\\";

/**
 * D-PG10-03 / D-PG10-22: whether one candidate bin joins PATH. A path with a
 * shell metacharacter is dropped; otherwise `stat`, which follows a symbolic
 * link, must say it is a directory. `ENOENT` and `ENOTDIR` drop the path, and
 * any other `stat` error keeps it, as Claude Code 2.1.323 does. Upstream's 2 s
 * `stat` timeout is not copied (D-PG10-03). Each drop and each kept-despite-error
 * path is debug-logged.
 */
async function keepsBinDir(dir: string): Promise<boolean> {
  if (CHECKS_SHELL_METACHARACTERS && SHELL_METACHARACTERS.test(dir)) {
    hookDebugLog(`plugin PATH: dropped ${dir}: holds a shell metacharacter`, "env");
    return false;
  }

  try {
    if ((await stat(dir)).isDirectory()) {
      return true;
    }

    hookDebugLog(`plugin PATH: dropped ${dir}: not a directory`, "env");
    return false;
  } catch (err) {
    if (isErrnoException(err) && (err.code === "ENOENT" || err.code === "ENOTDIR")) {
      hookDebugLog(`plugin PATH: dropped ${dir}: ${err.code}`, "env");
      return false;
    }

    hookDebugLog(`plugin PATH: kept ${dir} despite a stat error: ${errorMessage(err)}`, "env");
    return true;
  }
}

/** D-PG10-03: the candidates that `keepsBinDir` keeps, in their order, read at each recompute. */
async function keptBinDirs(dirs: readonly string[]): Promise<string[]> {
  const kept = await Promise.all(dirs.map(keepsBinDir));
  return dirs.filter((_, index) => kept[index]);
}

/** A scope whose install state could not be read during a PATH recompute. */
export interface SkippedPathScope {
  readonly scope: "user" | "project";
  readonly reason: string;
}

/**
 * PENV-01 / D-90-03 / D-90-04: recompute the plugin-PATH from install state and
 * apply it to `process.env`. "At session start" is read as "at load time" --
 * the caller wires this into `resources_discover` after `applyReconcile`.
 *
 * Both scopes contribute (user before project, D-90-04), the project scope only
 * when `projectTrusted` is true. D-PG10-02 / D-PG10-22: `projectTrusted` is the
 * answer the load already read from Pi; when it is false the project's
 * `state.json` is never opened, and the ledger removes the project entries an
 * earlier load appended. A candidate bin joins only when it is a directory with
 * no shell metacharacter in its path, decided at each recompute, so a folder
 * created or removed after a load is reflected at the next `/reload`
 * (D-PG10-03). Each scope read is isolated: `loadState` returns DEFAULT_STATE on a missing file but THROWS on
 * malformed/schema-invalid state, and a throw from one scope must not zero the
 * other scope's PATH contribution. A failed scope contributes no bin dirs --
 * its previously-appended entries are removed by the ledger (fail-safe: an
 * entry that cannot be re-derived from state is not kept, WR-01 posture) --
 * and is reported in `skipped` so the caller can surface a warning.
 *
 * When there is nothing to append and nothing owned to remove, `process.env`
 * is left untouched, so a previously-unset PATH is never materialized as an
 * empty string.
 */
export async function recomputePluginPath(
  cwd: string,
  projectTrusted: boolean,
): Promise<{
  skipped: SkippedPathScope[];
}> {
  const priorLedger = process.env[PATH_LEDGER_ENV] ?? "";

  const skipped: SkippedPathScope[] = [];
  const candidateBinDirs: string[] = [];
  // user scope ignores cwd (getAgentDir()); pass homedir() for symmetry.
  const scopeRoots: { scope: "user" | "project"; extensionRoot: string }[] = [
    { scope: "user", extensionRoot: locationsFor("user", homedir()).extensionRoot },
  ];
  if (projectTrusted) {
    scopeRoots.push({
      scope: "project",
      extensionRoot: locationsFor("project", cwd).extensionRoot,
    });
  }

  for (const { scope, extensionRoot } of scopeRoots) {
    try {
      // eslint-disable-next-line no-await-in-loop -- two scopes, one state read each
      candidateBinDirs.push(...collectBinDirs(await loadState(extensionRoot)));
    } catch (err) {
      skipped.push({ scope, reason: errorMessage(err) });
    }
  }

  const freshBinDirs = await keptBinDirs(candidateBinDirs);
  if (freshBinDirs.length === 0 && priorLedger === "") {
    return { skipped };
  }

  const result = applyPathLedger(process.env.PATH ?? "", priorLedger, freshBinDirs);
  process.env.PATH = result.path;
  process.env[PATH_LEDGER_ENV] = result.ledger;
  return { skipped };
}
