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
  for (const mp of Object.values(state.marketplaces)) {
    for (const rec of Object.values(mp.plugins)) {
      if (!rec.enabled) {
        continue;
      }

      try {
        const root = asAbsolutePluginRoot(rec.resolvedSource);
        dirs.push(path.join(root, "bin"));
      } catch {
        // WR-01: empty/relative/traversal resolvedSource must never reach PATH.
      }
    }
  }

  return dirs;
}

/**
 * PENV-01 / D-90-03 / D-90-04: recompute the plugin-PATH from install state and
 * apply it to `process.env`. "At session start" is read as "at load time" --
 * the caller wires this into `resources_discover` after `applyReconcile`.
 *
 * Both scopes contribute (user before project, D-90-04). `loadState` returns
 * DEFAULT_STATE on a missing file but THROWS on malformed/schema-invalid
 * state -- this shell does NOT catch it; the caller must swallow so a bad
 * state.json never blocks Pi load (NFR-2).
 */
export async function recomputePluginPath(cwd: string): Promise<void> {
  const priorLedger = process.env[PATH_LEDGER_ENV] ?? "";

  // user scope ignores cwd (getAgentDir()); pass homedir() for symmetry.
  const userState = await loadState(locationsFor("user", homedir()).extensionRoot);
  const projState = await loadState(locationsFor("project", cwd).extensionRoot);

  const freshBinDirs = [...collectBinDirs(userState), ...collectBinDirs(projState)];

  const result = applyPathLedger(process.env.PATH ?? "", priorLedger, freshBinDirs);
  process.env.PATH = result.path;
  process.env[PATH_LEDGER_ENV] = result.ledger;
}
