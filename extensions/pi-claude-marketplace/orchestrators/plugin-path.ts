/**
 * orchestrators/plugin-path.ts -- the PENV-01 plugin-PATH recompute I/O shell.
 *
 * Reads install state for both scopes and threads it through the pure ledger
 * core in `shared/session-env.ts` into `process.env.PATH` +
 * `PI_CLAUDE_MARKETPLACE_PATH`. Lives in `orchestrators/` (not `shared/`)
 * because it imports `persistence/` -- the D-11 import-direction rule forbids
 * `shared/` from importing `persistence/`, so the state-reading half of the
 * feature sits here alongside the other load-time reconcile orchestration.
 */
import { homedir } from "node:os";
import path from "node:path";

import { asAbsolutePluginRoot } from "../domain/plugin-root.ts";
import { locationsFor } from "../persistence/locations.ts";
import { loadState } from "../persistence/state-io.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";
import { applyPathLedger, PATH_LEDGER_ENV } from "../shared/session-env.ts";

import type { ExtensionState } from "../persistence/state-io.ts";

/**
 * PENV-01: collect `<resolvedSource>/bin` for every enabled plugin record in
 * `state`, in a stable insertion order (marketplace-then-plugin object order).
 * Disabled records are excluded. Pure: reads no `process.env`, touches no fs.
 *
 * WR-01: `resolvedSource` is only `Type.String()` on state.json and is not
 * brand-validated at load, so a corrupted record (empty / relative /
 * traversal) would compose a relative PATH entry (CWE-426 untrusted search
 * path) inherited by every bash child. Mirror the hooks-hydrate guard
 * (`asAbsolutePluginRoot`) and drop such records instead of letting them
 * reach `process.env.PATH`.
 */
export function collectBinDirs(state: ExtensionState): string[] {
  const dirs: string[] = [];
  for (const [mpName, mp] of Object.entries(state.marketplaces)) {
    for (const [pluginName, rec] of Object.entries(mp.plugins)) {
      if (!rec.enabled) {
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
 * Both scopes contribute (user before project, D-90-04), and each scope is
 * isolated: `loadState` returns DEFAULT_STATE on a missing file but THROWS on
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
export async function recomputePluginPath(cwd: string): Promise<{
  skipped: SkippedPathScope[];
}> {
  const priorLedger = process.env[PATH_LEDGER_ENV] ?? "";

  const skipped: SkippedPathScope[] = [];
  const freshBinDirs: string[] = [];
  // user scope ignores cwd (getAgentDir()); pass homedir() for symmetry.
  const scopeRoots = [
    { scope: "user", extensionRoot: locationsFor("user", homedir()).extensionRoot },
    { scope: "project", extensionRoot: locationsFor("project", cwd).extensionRoot },
  ] as const;
  for (const { scope, extensionRoot } of scopeRoots) {
    try {
      freshBinDirs.push(...collectBinDirs(await loadState(extensionRoot)));
    } catch (err) {
      skipped.push({ scope, reason: errorMessage(err) });
    }
  }

  if (freshBinDirs.length === 0 && priorLedger === "") {
    return { skipped };
  }

  const result = applyPathLedger(process.env.PATH ?? "", priorLedger, freshBinDirs);
  process.env.PATH = result.path;
  process.env[PATH_LEDGER_ENV] = result.ledger;
  return { skipped };
}
