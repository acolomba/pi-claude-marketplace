// edge/register.ts
//
// Plan 06-05 D-04: two registration helpers Phase 7's `index.ts` will
// call to wire the `/claude:plugin` slash-command surface and the two
// read-only LLM tools onto the Pi extension API.
//
//   - registerClaudePluginCommand(pi, deps):
//       * pi.registerCommand("claude:plugin", { handler, getArgumentCompletions, description })
//         -- routes through routeClaudePlugin; arg completions go through
//         getArgumentCompletions + makeLocationsResolver(process.cwd()).
//       * pi.on("session_start", ...) -- installs the TC-7 autocomplete
//         wrapper that scopes normalizeCompletionWhitespace to lines
//         matching isClaudePluginCommandLine.
//
//   - registerClaudeMarketplaceTools(pi):
//       * delegates to registerListMarketplacesTool + registerListPluginsTool.
//
// Pitfall 3 (06-RESEARCH §pitfalls): `process.cwd()` is acceptable here
// at the registration glue layer -- this is the one site in Phase 6
// where it is sanctioned. The cwd captured here is per-command-registration,
// matching V1's behavior.
//
// BLOCK C: this file imports from edge/* (sibling), orchestrators/* (one
// allowed up-import), shared/* (leaf), and the Pi peer dep. The
// edge -> persistence/domain barrier is honored via the
// orchestrators/edge-deps.ts indirection -- `makeLocationsResolver`
// closes over persistence + domain surfaces inside orchestrators/, and
// this file consumes the returned shape only.
//
// BLOCK A: zero direct Pi-context notify calls. The slash-command
// handler path goes through `routeClaudePlugin` which uses
// notifyUsageError; the session_start wrapper installs an autocomplete
// provider but does NOT emit user-visible messages.

import { makeLocationsResolver } from "../orchestrators/edge-deps.ts";

import {
  isClaudePluginCommandLine,
  normalizeCompletionWhitespace,
} from "./completions/normalize.ts";
import { getArgumentCompletions } from "./completions/provider.ts";
import { makeAddHandler } from "./handlers/marketplace/add.ts";
import { makeAutoupdateHandler } from "./handlers/marketplace/autoupdate.ts";
import { handleMarketplaceList } from "./handlers/marketplace/list.ts";
import { makeRemoveHandler } from "./handlers/marketplace/remove.ts";
import { makeMarketplaceUpdateHandler } from "./handlers/marketplace/update.ts";
import { makeBootstrapHandler } from "./handlers/plugin/bootstrap.ts";
import { makeImportHandler } from "./handlers/plugin/import.ts";
import { makeInstallHandler } from "./handlers/plugin/install.ts";
import { makeListHandler } from "./handlers/plugin/list.ts";
import { makeUninstallHandler } from "./handlers/plugin/uninstall.ts";
import { makeUpdateHandler } from "./handlers/plugin/update.ts";
import { registerListMarketplacesTool, registerListPluginsTool } from "./handlers/tools.ts";
import { routeClaudePlugin } from "./router.ts";

import type { SubcommandHandlers } from "./router.ts";
import type { EdgeDeps } from "./types.ts";
import type { ExtensionAPI } from "../platform/pi-api.ts";

const COMMAND_DESCRIPTION =
  "Manage Claude plugin marketplaces and plugins. Bootstrap, install, " +
  "uninstall, list, import, and update plugins from configured marketplaces.";

/**
 * Wire the `/claude:plugin` slash command + the TC-7 autocomplete
 * normalization onto `pi`. Idempotency: Pi's extension API does NOT
 * dedupe; callers MUST invoke this exactly once per session lifecycle
 * (Phase 7's `index.ts` is the single call site).
 *
 * `deps.gitOps` and `deps.pluginUpdate` are threaded into the marketplace
 * add/update/remove handlers per D-04 EdgeDeps; Phase 7 supplies the live
 * implementations.
 */
export function registerClaudePluginCommand(pi: ExtensionAPI, deps: EdgeDeps): void {
  const handlers: SubcommandHandlers = {
    bootstrap: makeBootstrapHandler(deps),
    install: makeInstallHandler(pi),
    uninstall: makeUninstallHandler(pi),
    update: makeUpdateHandler(pi),
    list: makeListHandler(),
    import: makeImportHandler(pi, deps),
    marketplaceAdd: makeAddHandler(deps),
    marketplaceRemove: makeRemoveHandler(pi),
    marketplaceList: handleMarketplaceList,
    marketplaceUpdate: makeMarketplaceUpdateHandler(deps),
    marketplaceAutoupdate: makeAutoupdateHandler(true),
    marketplaceNoautoupdate: makeAutoupdateHandler(false),
  };

  pi.registerCommand("claude:plugin", {
    description: COMMAND_DESCRIPTION,
    handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
    // Pitfall 3: this `process.cwd()` is the single sanctioned site in
    // Phase 6. Captured at registration time; threads through every
    // keystroke's completion lookup via the closed-over resolver.
    getArgumentCompletions: (prefix) =>
      getArgumentCompletions(prefix, makeLocationsResolver(process.cwd())),
  });

  // TC-7 autocomplete wrapper (V1 carry-forward, 06-PATTERNS §register).
  // V1 installs the wrapper unconditionally on every session_start;
  // `normalizeCompletionWhitespace` is idempotent so re-installation is
  // harmless. Scoped to lines matching isClaudePluginCommandLine to keep
  // other extensions' completions untouched.
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) => ({
      getSuggestions: (lines, line, col, options) =>
        current.getSuggestions(lines, line, col, options),
      applyCompletion: (lines, line, col, item, prefix) => {
        const result = current.applyCompletion(lines, line, col, item, prefix);
        const original = lines[line] ?? "";
        if (!isClaudePluginCommandLine(original)) {
          return result;
        }

        return normalizeCompletionWhitespace(result);
      },
      shouldTriggerFileCompletion: (lines, line, col) =>
        current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
    }));
  });
}

/**
 * Wire the two read-only LLM tools (`pi_claude_marketplace_list` +
 * `pi_claude_marketplace_plugin_list`) onto `pi`. Same idempotency
 * contract as the slash command -- Phase 7 calls this exactly once.
 */
export function registerClaudeMarketplaceTools(pi: ExtensionAPI): void {
  registerListMarketplacesTool(pi);
  registerListPluginsTool(pi);
}
