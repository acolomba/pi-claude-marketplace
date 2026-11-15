/**
 * orchestrators/plugin-options.ts -- the plugin option variable I/O shell
 * (D-PG10-11, D-PG10-23).
 *
 * pi-mcp-adapter reads only its config file and the process environment, so an
 * adapter entry references an option through a process variable this extension
 * sets on Pi's process, one per scope, plugin, and option key. This shell reads
 * install state and threads it through the pure ledger core in
 * `shared/session-env.ts` into `process.env` + `PI_CLAUDE_MARKETPLACE_OPTIONS`.
 * Lives in `orchestrators/` (not `shared/`) because it imports `persistence/`,
 * which the D-v1.0-01-11 import-direction rule forbids `shared/` from importing.
 *
 * D-PG10-23: the user scope is applied without a trust answer; the project
 * scope is read only when the load's trust answer is true, and its names are
 * removed when it is false, so an untrusted project's `state.json` never feeds
 * the process environment. A scope whose state cannot be read keeps its names:
 * a removed variable would turn a reference into the empty string.
 */
import { homedir } from "node:os";

import { ownedOptionVariables } from "../bridges/mcp/adapter-escape.ts";
import { OWNED_VARIABLE_PREFIX } from "../domain/user-config.ts";
import { locationsFor } from "../persistence/locations.ts";
import { isRecordedButDisabled, recordedOptionsOf } from "../persistence/state-io.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";
import { applyOptionLedger, OPTION_LEDGER_ENV, planOptionLedger } from "../shared/session-env.ts";

import type { ExtensionState } from "../persistence/state-io.ts";
import type { OptionScopeOutcome } from "../shared/session-env.ts";
import type { Scope } from "../shared/types.ts";

/** What the option variables read and write. */
export interface PluginOptionDeps {
  /** The state reader; the shell always asks for a read that persists nothing. */
  readonly loadState: (
    extensionRoot: string,
    options: { readonly persistMigration: false },
  ) => Promise<ExtensionState>;
  /** The environment the variables live in: Pi's `process.env` in production. */
  readonly env: NodeJS.ProcessEnv;
}

/** The applies the entry point runs. */
export interface PluginOptionVariables {
  /** Applies the user scope and keeps the project's names (the factory has no trust answer). */
  readonly applyUserScope: () => Promise<void>;
  /** Applies both scopes for a load, the project scope only when `projectTrusted` is true. */
  readonly applyForLoad: (cwd: string, projectTrusted: boolean) => Promise<void>;
}

// One pair per option of the MCP value map of each enabled record, in
// marketplace then plugin order.
function stateVariables(scope: Scope, state: ExtensionState): (readonly [string, string])[] {
  const variables: (readonly [string, string])[] = [];
  for (const [marketplace, mp] of Object.entries(state.marketplaces)) {
    for (const [plugin, record] of Object.entries(mp.plugins)) {
      if (isRecordedButDisabled(record)) {
        continue;
      }

      const owned = ownedOptionVariables(
        { scope, marketplace, plugin },
        recordedOptionsOf(record).mcpValues,
      );
      variables.push(...[...owned.values()].map(({ name, value }) => [name, value] as const));
    }
  }

  return variables;
}

/** Creates the option variable applies over one state reader and one environment. */
export function createPluginOptionVariables(deps: PluginOptionDeps): PluginOptionVariables {
  async function scopeOutcome(scope: Scope, cwd: string): Promise<OptionScopeOutcome> {
    try {
      const state = await deps.loadState(locationsFor(scope, cwd).extensionRoot, {
        persistMigration: false,
      });
      return { kind: "fresh", variables: stateVariables(scope, state) };
    } catch (err) {
      hookDebugLog(
        `plugin options: kept the ${scope} scope's variables: ${errorMessage(err)}`,
        "env",
      );
      return { kind: "keep" };
    }
  }

  // The state reads come first and the prior ledger is read after them, so the
  // change is computed and applied with no await in between.
  function apply(user: OptionScopeOutcome, project: OptionScopeOutcome): void {
    const priorLedger = deps.env[OPTION_LEDGER_ENV] ?? "";
    const change = planOptionLedger(priorLedger, OWNED_VARIABLE_PREFIX, { user, project });
    applyOptionLedger(deps.env, change);
  }

  return {
    applyUserScope: async () => {
      // user scope ignores cwd (getAgentDir()); pass homedir() for symmetry.
      apply(await scopeOutcome("user", homedir()), { kind: "keep" });
    },
    applyForLoad: async (cwd, projectTrusted) => {
      const user = await scopeOutcome("user", homedir());
      const project: OptionScopeOutcome = projectTrusted
        ? await scopeOutcome("project", cwd)
        : { kind: "remove" };
      apply(user, project);
    },
  };
}
