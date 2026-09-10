// edge/handlers/plugin/browse.ts
//
// Thin-shim handler factory for `/claude:plugin browse` -- the interactive
// SelectList browser over configured marketplaces and their plugins.
//
// TUI-only: `ctx.mode === "tui"` guards `ctx.ui.custom` (a terminal
// component). In non-TUI modes (rpc/json/print) the handler falls back to
// the `list` subcommand so the user still gets a useful inventory.
//
// Data is read-only (`loadMarketplaceEntries` -> `loadVisibleMarketplaces`,
// and the per-marketplace `pluginLoader` -> `loadPluginListPayload`). The
// chosen action is dispatched to the existing install/uninstall/info/
// enable/disable handlers with a constructed `<plugin>@<marketplace>
// --scope <scope>` arg string, so arg-parsing, usage errors, and notify
// surfaces stay byte-identical with the typed subcommands.
//
// BLOCK A: no direct `ctx.ui.notify` -- the action handlers route through
// shared/notify.ts themselves. BLOCK C: imports from picker/ (sibling),
// orchestrators/, domain/, shared/ (types), platform/ (types).

import { sourceLogical } from "../../../domain/source.ts";
import { loadVisibleMarketplaces } from "../../../orchestrators/marketplace/shared.ts";
import { loadPluginListPayload } from "../../../orchestrators/plugin/list.ts";
import { notifyDiagnostic } from "../../../shared/notify.ts";
import {
  PluginBrowser,
  type MarketplaceEntry,
  type PickerResult,
} from "../../browser/plugin-browser.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "../../../platform/pi-api.ts";
import type { PluginNotificationMessage } from "../../../shared/notify.ts";

/**
 * The existing subcommand handlers the browser dispatches into. Passed in by
 * `register.ts` so the browse handler does not reconstruct the handler map
 * (no circular factory). `list` is the non-TUI fallback.
 */
export interface BrowseActionHandlers {
  readonly list: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly uninstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly pluginInfo: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly enable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly disable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

/**
 * Eager marketplace-row projection. `loadVisibleMarketplaces` returns the
 * persistence-tier record verbatim; the browse handler only needs the
 * display fields to seed the picker's first screen.
 */
async function loadMarketplaceEntries(cwd: string): Promise<readonly MarketplaceEntry[]> {
  const visible = await loadVisibleMarketplaces({ cwd });
  return visible.map(({ scope, record }) => {
    const source = record.source as Parameters<typeof sourceLogical>[0];
    return {
      name: record.name,
      scope,
      pluginCount: Object.keys(record.plugins).length,
      source: sourceLogical(source),
    };
  });
}

/**
 * Build the per-marketplace plugin loader the browser injects. Wraps
 * `loadPluginListPayload`, selects the matching marketplace block (falling
 * back to the first block for a synthetic `(list)` failure), and returns the
 * raw `PluginNotificationMessage` rows. The browser projects them onto its
 * display entries.
 */
function makePluginLoader(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  cwd: string,
): (marketplace: MarketplaceEntry) => Promise<readonly PluginNotificationMessage[]> {
  return async (mp): Promise<readonly PluginNotificationMessage[]> => {
    const payload = await loadPluginListPayload({ ctx, pi, cwd, marketplace: mp.name });
    const block = payload.find((b) => b.name === mp.name) ?? payload[0];
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
): Promise<void> {
  const args = actionArgs(result);
  switch (result.action) {
    case "install":
      return handlers.install(args, ctx);
    case "uninstall":
      return handlers.uninstall(args, ctx);
    case "info":
      return handlers.pluginInfo(args, ctx);
    case "enable":
      return handlers.enable(args, ctx);
    case "disable":
      return handlers.disable(args, ctx);
  }
}

/**
 * Factory: returns the async handler closed over `pi` (needed by the
 * plugin loader's `loadPluginListPayload` soft-dep probe) and the action
 * handlers.
 */
export function makeBrowseHandler(
  pi: ExtensionAPI,
  handlers: BrowseActionHandlers,
): (args: string, ctx: ExtensionCommandContext) => Promise<void> {
  return async (_args, ctx): Promise<void> => {
    // Non-TUI modes have no terminal for `ctx.ui.custom`; fall back to the
    // inventory surface so `browse` is never a no-op.
    if (ctx.mode !== "tui") {
      await handlers.list("", ctx);
      return;
    }

    // Eager marketplace load. The plugins for a marketplace load lazily
    // inside the browser when the marketplace is opened.
    let marketplaces;
    try {
      marketplaces = await loadMarketplaceEntries(ctx.cwd);
    } catch (err) {
      notifyDiagnostic(ctx, "/claude:plugin browse", [
        `Failed to load marketplaces: ${err instanceof Error ? err.message : String(err)}`,
      ]);
      return;
    }

    if (marketplaces.length === 0) {
      notifyDiagnostic(ctx, "/claude:plugin browse", [
        "No marketplaces configured.",
        "Add one with: /claude:plugin marketplace add <source>",
      ]);
      return;
    }

    const pluginLoader = makePluginLoader(pi, ctx, ctx.cwd);

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

    await dispatch(handlers, result, ctx);
  };
}
