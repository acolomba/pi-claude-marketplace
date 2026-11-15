// bridges/hooks/hook-env.ts
//
// HOOK-05 env construction + D-60-06 `_shared` CLAUDE_ENV_FILE, shared by the
// two dispatch lanes.
//
// WR-01: async-rewake re-dispatches the SAME handler declaration the sync lane
// spawned, so the two lanes' environments must be identical by construction.
// This leaf is the single builder both lanes call, so the agreement is
// structural rather than resting on a comment asking two copies to be kept
// in sync by hand.

import path from "node:path";

import { hookOptionVariableName } from "../../domain/user-config.ts";
import { assertPathInside } from "../../shared/path-safety.ts";
import { claudeSessionEnvFor } from "../../shared/session-env.ts";

import type { RoutingEntry } from "./routing-state.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ClaudePluginVars } from "../../shared/vars.ts";

/** The dispatch facts the env contract reads. */
export interface HookEnvContext {
  readonly cwd: string;
  /** The hook-facing session, which the session variables name (D-PG6-01). */
  readonly sessionId: string;
  /** Pi's own session, which names the env file (D-60-06, D-PG6-03). */
  readonly ownSessionId: string;
}

/**
 * The three path values a hook handler sees: `CLAUDE_PLUGIN_ROOT`,
 * `CLAUDE_PLUGIN_DATA`, and `CLAUDE_PROJECT_DIR`. `prepareHookEnv` exports
 * them, and an exec-form handler gets them substituted into its `command` and
 * `args` (D-CF5-15, FG-19), so the environment and the arguments always agree.
 * It leaves `skillDir` unset, so `${CLAUDE_SKILL_DIR}` stays literal.
 * `CLAUDE_PLUGIN_DATA` is the plugin's one data folder,
 * `<dataRoot>/<marketplace>/<plugin>`, the folder its skills, commands,
 * agents and MCP servers get and uninstall removes (HOOKDATA-01).
 */
export function hookPathVars(
  entry: RoutingEntry,
  transCtx: HookEnvContext,
  loc: ScopedLocations,
): ClaudePluginVars {
  return {
    pluginRoot: entry.resolvedSource,
    pluginData: path.join(loc.dataRoot, entry.marketplace, entry.pluginId),
    projectDir: transCtx.cwd,
  };
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
 * `_shared/`, which is likewise containment-checked. Its name holds the own
 * session id, so two children of one launching session get two files
 * (D-PG6-03).
 *
 * HOOK-05: `CLAUDE_CODE_REMOTE` is intentionally NOT set. Pi runs locally, and
 * the documented absence is the upstream-parity contract.
 *
 * D-PG10-10: each option value of the entry is exported as
 * `CLAUDE_PLUGIN_OPTION_<KEY>`, after the three path variables and before the
 * lane's additions and the session env, so no option can replace a lane
 * marker or a session var. Two keys that name one variable leave the later
 * key's value. A declared default counts as a saved value here (D-PG10-19).
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
  const vars = hookPathVars(entry, transCtx, loc);
  // The shared builder's name checks and containment guard this path, so a
  // hook can never name a folder outside the scope's data root.
  await loc.pluginDataDir(entry.marketplace, entry.pluginId);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: vars.projectDir,
    CLAUDE_PLUGIN_ROOT: vars.pluginRoot,
    CLAUDE_PLUGIN_DATA: vars.pluginData,
    ...Object.fromEntries(
      Array.from(entry.options.values, ([key, value]) => [hookOptionVariableName(key), value]),
    ),
    ...extra,
    // D-91-02: the session env spreads LAST so the authoritative per-dispatch
    // snapshot wins over both the live `process.env` and any per-lane `extra`.
    ...claudeSessionEnvFor(transCtx.sessionId),
  };

  if (entry.claudeEvent === "SessionStart") {
    const envFile = path.join(loc.dataRoot, "_shared", `claude-env-${transCtx.ownSessionId}.env`);
    await assertPathInside(loc.dataRoot, envFile, "CLAUDE_ENV_FILE");
    env.CLAUDE_ENV_FILE = envFile;
  }

  return env;
}
