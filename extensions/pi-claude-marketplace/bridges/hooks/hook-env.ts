// bridges/hooks/hook-env.ts
//
// HOOK-05 env construction + D-60-06 `_shared` CLAUDE_ENV_FILE, shared by the
// two dispatch lanes.
//
// WR-01: async-rewake re-dispatches the SAME handler declaration the sync lane
// spawned, so the two lanes' environments must be identical by construction.
// They were previously two copies of this builder that a comment asked future
// readers to keep in sync by hand; this leaf makes the agreement structural.

import path from "node:path";

import { assertPathInside } from "../../shared/path-safety.ts";
import { claudeSessionEnvFor } from "../../shared/session-env.ts";

import type { RoutingEntry } from "./routing-state.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/** The dispatch facts the env contract reads. */
export interface HookEnvContext {
  readonly cwd: string;
  readonly sessionId: string;
}

/**
 * Build the environment exported to a spawned hook handler.
 *
 * `CLAUDE_PLUGIN_ROOT` flows from `RoutingEntry.resolvedSource`, hydrated from
 * state.json at install and boot, so the upstream Claude Code
 * `${CLAUDE_PLUGIN_ROOT}/...` interpolation resolves to the real plugin source
 * on disk. For a git-source marketplace that path is inside
 * `<extensionRoot>/sources/...`; for a path source the user pointed at an
 * external directory deliberately, so no containment assertion is meaningful
 * on it. `CLAUDE_PLUGIN_DATA` IS contained, and asserted.
 *
 * HENV-01 / HENV-02 / D-91-02: the session env comes from the shared producer
 * and is spread AFTER `...process.env`, so the authoritative per-dispatch
 * snapshot wins over whatever was last written to the live `process.env`.
 * That ordering is the race-window safety property.
 *
 * D-60-06: a `SessionStart` dispatch also gets `CLAUDE_ENV_FILE` under
 * `_shared/`, which is likewise containment-checked.
 *
 * HOOK-05: `CLAUDE_CODE_REMOTE` is intentionally NOT set. Pi runs locally, and
 * the documented absence is the upstream-parity contract.
 *
 * `extra` carries per-lane additions -- the async-rewake lane stamps its
 * dispatch marker through it. It is spread BEFORE the session env, so a lane
 * addition can never override a session var (D-91-02).
 */
export async function prepareHookEnv(
  entry: RoutingEntry,
  transCtx: HookEnvContext,
  loc: ScopedLocations,
  extra?: NodeJS.ProcessEnv,
): Promise<NodeJS.ProcessEnv> {
  const pluginData = path.join(loc.dataRoot, entry.pluginId);
  await assertPathInside(loc.dataRoot, pluginData, "CLAUDE_PLUGIN_DATA");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: transCtx.cwd,
    CLAUDE_PLUGIN_ROOT: entry.resolvedSource,
    CLAUDE_PLUGIN_DATA: pluginData,
    ...extra,
    // D-91-02: the session env spreads LAST so the authoritative per-dispatch
    // snapshot wins over both the live `process.env` and any per-lane `extra`.
    ...claudeSessionEnvFor(transCtx.sessionId),
  };

  if (entry.claudeEvent === "SessionStart") {
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.sessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
    env.CLAUDE_ENV_FILE = envFile;
  }

  return env;
}
