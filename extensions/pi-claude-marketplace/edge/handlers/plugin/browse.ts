// edge/handlers/plugin/browse.ts
//
// Thin-shim handler factory for `/claude:plugin browse` -- the interactive
// SelectList browser over configured marketplaces and their plugins.
//
// TUI-only: `ctx.mode === "tui"` guards `ctx.ui.custom` (a terminal
// component). Non-TUI modes receive a refusal naming the `list` command.
//
// Data is read-only (`loadMarketplaceEntries` -> `loadVisibleMarketplaces`
// and each catalog counted through the shared `edge/marketplace-counts.ts`,
// NFR-5 / NFR-8, and the per-marketplace `pluginLoader` ->
// `loadPluginListPayload`). The chosen action is dispatched to the existing
// install/uninstall/info/enable/disable handlers with a constructed
// `<plugin>@<marketplace> --scope <scope>` arg string, so arg-parsing, usage
// errors, and notify surfaces stay byte-identical with the typed subcommands.
//
// IL-2: no direct `ctx.ui.notify` -- the action handlers route through
// shared/notify.ts themselves. BLOCK C: imports from picker/ (sibling),
// orchestrators/, domain/, shared/ (types), platform/ (types).

import { sourceLogical, type ParsedSource } from "../../../domain/source.ts";
import {
  loadVisibleMarketplaces,
  recordedManifestPath,
} from "../../../orchestrators/marketplace/shared.ts";
import { loadPluginListPayload } from "../../../orchestrators/plugin/list-flow.ts";
import { notify, notifyUsageError } from "../../../shared/notification-dispatch.ts";
import { tokenizeArgs } from "../../args.ts";
import {
  PluginBrowser,
  type MarketplaceEntry,
  type PickerResult,
} from "../../browser/plugin-browser.ts";
import { offeredPluginCount } from "../../marketplace-counts.ts";

import { rejectUnknownFlag } from "./shared.ts";

import type { ActiveMcpImplementation, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { NotificationRun } from "../../../shared/notification-run.ts";
import type {
  PluginFailedMessage,
  PluginNotificationMessage,
} from "../../../shared/notification-types.ts";
import type { SubcommandHandler } from "../../router.ts";

const USAGE = "Usage: /claude:plugin browse";

/**
 * The existing subcommand handlers the browser dispatches into. Passed in by
 * `register.ts` so the browse handler does not reconstruct the handler map
 * (no circular factory). Each handler receives the browse command's own
 * notification run.
 */
export interface BrowseActionHandlers {
  readonly install: SubcommandHandler;
  readonly uninstall: SubcommandHandler;
  readonly pluginInfo: SubcommandHandler;
  readonly enable: SubcommandHandler;
  readonly disable: SubcommandHandler;
}

/**
 * Eager marketplace-row projection. `loadVisibleMarketplaces` returns the
 * persistence-tier record verbatim, and each catalog is counted through the
 * shared `offeredPluginCount` (D-BG-1201, NFR-5, NFR-8); the browse handler
 * only needs the display fields to seed the picker's first screen.
 */
async function loadMarketplaceEntries(cwd: string): Promise<readonly MarketplaceEntry[]> {
  const visible = await loadVisibleMarketplaces({ cwd });
  return Promise.all(
    visible.map(async ({ scope, record }): Promise<MarketplaceEntry> => {
      const source = record.source as ParsedSource;
      return {
        name: record.name,
        scope,
        pluginCount: await offeredPluginCount(record.name, source, recordedManifestPath(record)),
        installedCount: Object.keys(record.plugins).length,
        source: sourceLogical(source),
      };
    }),
  );
}

/**
 * Build the per-marketplace plugin loader the browser injects. Wraps
 * `loadPluginListPayload`, selects the matching marketplace block (falling
 * back to the first block for a synthetic `(list)` failure), and returns the
 * raw `PluginNotificationMessage` rows. The browser projects them onto its
 * display entries. The loader only reads, so it takes no notification run,
 * only the browse command's MCP implementation, whose view the rows show
 * (MREC-03).
 */
function makePluginLoader(
  ctx: ExtensionCommandContext,
  cwd: string,
  mcpImplementation: ActiveMcpImplementation,
): (marketplace: MarketplaceEntry) => Promise<readonly PluginNotificationMessage[]> {
  return async (mp): Promise<readonly PluginNotificationMessage[]> => {
    const payload = await loadPluginListPayload({
      ctx,
      cwd,
      marketplace: mp.name,
      mcpImplementation,
    });
    const block = payload.find((b) => b.name === mp.name && b.scope === mp.scope);
    return block?.plugins ?? [];
  };
}

/**
 * Build the arg string the typed subcommand handler expects. Every action
 * targets a single `<plugin>@<marketplace>` in the marketplace's scope,
 * with optional `--local` targeting `claude-plugins.local.json`.
 */
function actionArgs(result: PickerResult): string {
  const local = result.local === true ? " --local" : "";
  return `${result.plugin}@${result.marketplace} --scope ${result.scope}${local}`;
}

/**
 * Dispatch the picker result to the matching typed subcommand handler.
 */
async function dispatch(
  handlers: BrowseActionHandlers,
  result: PickerResult,
  ctx: ExtensionCommandContext,
  run: NotificationRun,
): Promise<void> {
  const args = actionArgs(result);
  switch (result.action) {
    case "install":
      return handlers.install(args, ctx, run);
    case "uninstall":
      return handlers.uninstall(args, ctx, run);
    case "info":
      return handlers.pluginInfo(args, ctx, run);
    case "enable":
      return handlers.enable(args, ctx, run);
    case "disable":
      return handlers.disable(args, ctx, run);
  }
}

/**
 * Factory: returns the async handler closed over the action handlers. The
 * browser's own notifications render from the router's command run (D-05),
 * and the handler forwards that run to every action handler it calls.
 */
export function makeBrowseHandler(handlers: BrowseActionHandlers): SubcommandHandler {
  return async (args, ctx, run): Promise<void> => {
    const tokens = tokenizeArgs(args).map((token) => token.value);
    if (rejectUnknownFlag(tokens, { ctx, run, usage: USAGE })) {
      return;
    }

    if (tokens.length > 0) {
      notifyUsageError(ctx, run, { message: "browse takes no arguments.", usage: USAGE });
      return;
    }

    // Non-TUI modes have no terminal for the picker.
    const mode = ctx.mode;
    if (mode !== "tui") {
      notifyUsageError(ctx, run, {
        message: `Browse is unavailable in ${mode} mode. Use /claude:plugin list instead.`,
        usage: mode === "print" ? "" : USAGE,
      });
      return;
    }

    // Eager marketplace load. The plugins for a marketplace load lazily
    // inside the browser when the marketplace is opened.
    let marketplaces;
    try {
      marketplaces = await loadMarketplaceEntries(ctx.cwd);
    } catch (err) {
      const failedRow: PluginFailedMessage = {
        status: "failed",
        name: "(browse)",
        reasons: [],
        cause: err as Error,
        severity: "error",
        needsReload: false,
      };
      notify(ctx, run, {
        marketplaces: [
          {
            name: "(browse)",
            scope: "user",
            plugins: [failedRow],
          },
        ],
      });
      return;
    }

    if (marketplaces.length === 0) {
      notify(ctx, run, { marketplaces: [] });
      return;
    }

    const pluginLoader = makePluginLoader(ctx, ctx.cwd, run.softDeps.mcpImplementation);

    const result = await ctx.ui.custom<PickerResult | null>((tui, theme, _kb, done) => {
      const browser = new PluginBrowser({
        tui,
        theme,
        marketplaces,
        pluginLoader,
        onSelect: (r) => {
          done(r);
        },
        onCancel: () => {
          done(null);
        },
      });
      return {
        render: (w: number) => browser.render(w),
        invalidate: () => {
          browser.invalidate();
        },
        handleInput: (data: string) => {
          browser.handleInput(data);
        },
      };
    });

    if (result === null) {
      return;
    }

    await dispatch(handlers, result, ctx, run);
  };
}
