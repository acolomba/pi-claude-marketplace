// edge/register.ts
//
// D-04: two registration helpers `index.ts` calls to wire the
// `/claude:plugin` slash-command surface and the two read-only LLM tools
// onto the Pi extension API.
//
//   - registerClaudePluginCommand(pi, deps):
//       * pi.registerCommand("claude:plugin", { handler, getArgumentCompletions, description })
//         -- routes through routeClaudePlugin; arg completions go through
//         getArgumentCompletions + makeLocationsResolver(process.cwd()).
//         The handler runs each command through the optional
//         `runForeground` gate, so a command waits for the background
//         autoupdate step in flight (D-PL8-04).
//       * pi.on("session_start", ...) -- installs the TC-7 autocomplete
//         wrapper that scopes normalizeCompletionWhitespace to lines
//         matching isClaudePluginCommandLine.
//
//   - registerClaudeMarketplaceTools(pi):
//       * delegates to registerListMarketplacesTool + registerListPluginsTool.
//
// `process.cwd()` is acceptable here at the registration glue layer --
// this is the one site where it is sanctioned. The read happens inside
// the `getArgumentCompletions` callback, once per completion lookup, so
// completions resolve against the directory the process is in at the
// moment the user types, and no directory value is retained between
// lookups.
//
// BLOCK C: this file imports from edge/* (sibling), orchestrators/* (one
// allowed up-import), shared/* (leaf), and the Pi peer dep. The
// edge -> persistence/domain barrier is honored via the
// orchestrators/edge-deps.ts indirection -- `makeLocationsResolver`
// closes over persistence + domain surfaces inside orchestrators/, and
// this file consumes the returned shape only.
//
// IL-2: zero direct Pi-context notify calls. The slash-command
// handler path goes through `routeClaudePlugin` which uses
// notifyUsageError; the session_start wrapper installs an autocomplete
// provider but does NOT emit user-visible messages.

import { randomUUID } from "node:crypto";

import { makeLocationsResolver } from "../orchestrators/edge-deps.ts";
import { createReinstallOperation } from "../orchestrators/plugin/operations.ts";
import { createNodeReinstallPlugins } from "../orchestrators/plugin/reinstall-flow.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";
import { openNotificationRun, requireNotificationMode } from "../shared/notification-run.ts";

import { runCommand } from "./command-run.ts";
import {
  isClaudePluginCommandLine,
  normalizeCompletionWhitespace,
} from "./completions/normalize.ts";
import { getArgumentCompletions } from "./completions/provider.ts";
import { makeAddHandler } from "./handlers/marketplace/add.ts";
import { makeAutoupdateHandler } from "./handlers/marketplace/autoupdate.ts";
import { makeMarketplaceInfoHandler } from "./handlers/marketplace/info.ts";
import { makeMarketplaceListHandler } from "./handlers/marketplace/list.ts";
import { makeRemoveHandler } from "./handlers/marketplace/remove.ts";
import { makeMarketplaceUpdateHandler } from "./handlers/marketplace/update.ts";
import { makeApplyHandler } from "./handlers/plugin/apply.ts";
import { makeAutoapplyHandler } from "./handlers/plugin/autoapply.ts";
import { makeBootstrapHandler } from "./handlers/plugin/bootstrap.ts";
import { makeBrowseHandler } from "./handlers/plugin/browse.ts";
import { makeEnableDisableHandler } from "./handlers/plugin/enable-disable.ts";
import { makeFetchHandler } from "./handlers/plugin/fetch.ts";
import { makeHelpHandler } from "./handlers/plugin/help.ts";
import { makeImportHandler } from "./handlers/plugin/import.ts";
import { makePluginInfoHandler } from "./handlers/plugin/info.ts";
import { makeInstallHandler } from "./handlers/plugin/install.ts";
import { makeListHandler } from "./handlers/plugin/list.ts";
import { makePendingHandler } from "./handlers/plugin/pending.ts";
import { makePruneHandler } from "./handlers/plugin/prune.ts";
import { makeReinstallHandler } from "./handlers/plugin/reinstall.ts";
import { makeUninstallHandler } from "./handlers/plugin/uninstall.ts";
import { makeUpdateHandler } from "./handlers/plugin/update.ts";
import { registerListMarketplacesTool, registerListPluginsTool } from "./handlers/tools.ts";
import { routeClaudePlugin, selectClaudePluginRoute } from "./router.ts";

import type { SubcommandHandlers } from "./router.ts";
import type { EdgeDeps } from "./types.ts";
import type { InstallHooksRouting } from "../orchestrators/plugin/install-disable-cascade.ts";
import type { UpdatePluginsFn } from "../orchestrators/plugin/update-flow.ts";
import type { ExtensionAPI } from "../platform/pi-api.ts";

const COMMAND_DESCRIPTION =
  "Manage Claude plugin marketplaces and plugins. Bootstrap, install, " +
  "uninstall, prune, list, import, update, and reinstall plugins from configured marketplaces.";

/**
 * Wires the `/claude:plugin` slash command + the TC-7 autocomplete
 * normalization onto `pi`. Idempotency: Pi's extension API does NOT
 * dedupe; callers MUST invoke this exactly once per session lifecycle
 * (`index.ts` is the single call site).
 *
 * `deps.gitOps` and `deps.beginPluginUpdateRun` are threaded into the marketplace
 * add/update/remove handlers per D-04 EdgeDeps. `deps.mcpStatus` is threaded
 * into the plugin info handler (ASTAT-01).
 */
export function registerClaudePluginCommand(
  pi: ExtensionAPI,
  deps: EdgeDeps,
  hooksRouting: InstallHooksRouting,
  updatePlugins: UpdatePluginsFn,
  options: {
    readonly createInvocationId?: () => string;
    readonly createRecoveryId?: () => string;
    /** D-PL8-04: runs each command through the background gate. */
    readonly runForeground?: (command: () => Promise<void>) => Promise<void>;
  } = {},
): void {
  const createInvocationId = options.createInvocationId ?? randomUUID;
  const runForeground = options.runForeground ?? ((command) => command());
  const createRecoveryId = options.createRecoveryId ?? randomUUID;
  const reinstallPlugins = createNodeReinstallPlugins(
    createReinstallOperation(hooksRouting, deps.completionCache),
  );
  const install = makeInstallHandler(hooksRouting, deps.completionCache);
  const uninstall = makeUninstallHandler(hooksRouting, deps.completionCache);
  const prune = makePruneHandler(hooksRouting, deps.completionCache);
  const pluginInfo = makePluginInfoHandler(deps.mcpStatus);
  const enable = makeEnableDisableHandler(true, hooksRouting);
  const disable = makeEnableDisableHandler(false, hooksRouting);
  const list = makeListHandler();
  const browse = makeBrowseHandler({ install, uninstall, pluginInfo, enable, disable });

  const handlers: SubcommandHandlers = {
    bootstrap: makeBootstrapHandler(deps),
    install,
    uninstall,
    prune,
    update: makeUpdateHandler(updatePlugins),
    fetch: makeFetchHandler(),
    reinstall: makeReinstallHandler(reinstallPlugins),
    list,
    pluginInfo,
    pending: makePendingHandler(),
    pluginApply: makeApplyHandler(deps, hooksRouting),
    autoapply: makeAutoapplyHandler(),
    enable,
    disable,
    import: makeImportHandler(deps, hooksRouting),
    marketplaceAdd: makeAddHandler(deps),
    marketplaceRemove: makeRemoveHandler(deps),
    marketplaceList: makeMarketplaceListHandler(),
    marketplaceInfo: makeMarketplaceInfoHandler(),
    marketplaceUpdate: makeMarketplaceUpdateHandler({
      completionCache: deps.completionCache,
      gitOps: deps.gitOps,
      beginPluginUpdateRun: deps.beginPluginUpdateRun,
      installMissingDependencies: deps.installMissingDependencies,
    }),
    marketplaceAutoupdate: makeAutoupdateHandler(true),
    marketplaceNoautoupdate: makeAutoupdateHandler(false),
    browse,
    help: makeHelpHandler(),
  };

  pi.registerCommand("claude:plugin", {
    description: COMMAND_DESCRIPTION,
    // D-05 / D-07: one notification run per command invocation, opened
    // before routing, so every emission of the command reads one snapshot.
    // A usage error opens its run too.
    handler: (args, ctx) => {
      requireNotificationMode(ctx.mode);
      const route = selectClaudePluginRoute(args, handlers);
      return runForeground(() =>
        runCommand(
          pi,
          ctx,
          route.commandId,
          (run) => routeClaudePlugin(route, handlers, ctx, run),
          { createInvocationId, createRecoveryId, openRun: openNotificationRun },
        ),
      );
    },
    // This `process.cwd()` is the single sanctioned site.
    // The arrow body runs per completion lookup and reads
    // `process.cwd()` there, so a fresh `makeLocationsResolver` is
    // built from the current directory on each lookup -- the read
    // happens per lookup, not once when the command is registered.
    // Pinned by `test/edge/register.test.ts`, test "resolves argument
    // completions against the working directory the callback runs in".
    getArgumentCompletions: (prefix) =>
      getArgumentCompletions(prefix, makeLocationsResolver(process.cwd()), deps.completionCache),
  });

  // TC-7 autocomplete wrapper. Installed unconditionally on every
  // session_start; `normalizeCompletionWhitespace` is idempotent so
  // re-installation is harmless. Scoped to lines matching
  // isClaudePluginCommandLine to keep other extensions' completions
  // untouched.
  pi.on("session_start", (_event, ctx) => {
    try {
      requireNotificationMode(ctx.mode);
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
    } catch (err) {
      hookDebugLog(`autocomplete setup skipped: ${errorMessage(err)}`, "completions");
    }
  });
}

/**
 * Wires the two read-only LLM tools (`pi_claude_marketplace_list` +
 * `pi_claude_marketplace_plugin_list`) onto `pi`. Same idempotency
 * contract as the slash command -- called exactly once.
 */
export function registerClaudeMarketplaceTools(pi: ExtensionAPI): void {
  registerListMarketplacesTool(pi);
  registerListPluginsTool(pi);
}
