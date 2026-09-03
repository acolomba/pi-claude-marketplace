// edge/browser/plugin-browser.ts
//
// Interactive SelectList browser for `/claude:plugin browse`. Four screens:
//   marketplaces -> plugins -> actions -> install scope
// mirrors Claude Code's `/plugin` picker UX on top of pi-tui `SelectList` +
// `DynamicBorder` (tui.md Pattern 1).
//
// Pure UI: data loading is injected via `pluginLoader` so the component has
// no dependency on `ctx` / `pi` / orchestrators. The browse handler supplies
// a loader that wraps `loadPluginListPayload`; tests and the standalone demo
// supply canned data. The chosen action is returned to the caller (the browse
// handler), which dispatches to the existing install/uninstall/info/enable/
// disable handlers.
//
// BLOCK C: imports only from shared/ (types), platform/ (Theme + DynamicBorder
// chokepoint), and the `@earendil-works/pi-tui` peer dep (unrestricted by
// BLOCK E). No orchestrators/ or domain/ import -- this file is pure UI.

import { Container, SelectList, Text, type SelectItem } from "@earendil-works/pi-tui";

import { DynamicBorder, type Theme } from "../../platform/pi-api.ts";

import type { PluginNotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

// ─── public types ─────────────────────────────────────────────────────────

export type PickerAction = "install" | "uninstall" | "info" | "enable" | "disable";

/** Action chosen by the user; the browse handler dispatches it. */
export interface PickerResult {
  readonly action: PickerAction;
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly local?: boolean;
}

/** One marketplace row on the first screen. */
export interface MarketplaceEntry {
  readonly name: string;
  readonly scope: Scope;
  readonly pluginCount: number;
  readonly source: string;
}

// ─── internal types ───────────────────────────────────────────────────────

interface PluginEntry {
  readonly name: string;
  readonly status: PluginNotificationMessage["status"];
  readonly version?: string;
}

/**
 * Structural surface of `TUI` the browser uses. Declared locally (not
 * imported from `@earendil-works/pi-tui`) so the type does not depend on
 * WHICH `pi-tui` copy resolves -- the peer dep nests its own, and the two
 * `TUI` declarations are nominally distinct. `requestRender` is the only
 * method the browser calls. Exported because the exported
 * `PluginBrowserOptions` references it (fallow private-type-leak rule).
 */
export interface BrowserTui {
  requestRender(): void;
}

export interface PluginBrowserOptions {
  readonly tui: BrowserTui;
  readonly theme: Theme;
  readonly marketplaces: readonly MarketplaceEntry[];
  /**
   * Lazy plugin loader for the opened marketplace. Returns the raw
   * `PluginNotificationMessage` rows; the browser projects them onto its
   * display `PluginEntry`. Injected so the component stays free of ctx/pi/
   * orchestrator dependencies (tests + the standalone demo inject canned
   * data).
   */
  readonly pluginLoader: (
    marketplace: MarketplaceEntry,
  ) => Promise<readonly PluginNotificationMessage[]>;
  readonly onSelect: (result: PickerResult) => void;
  readonly onCancel: () => void;
}

const MAX_VISIBLE = 12;

// ─── display helpers ──────────────────────────────────────────────────────

function pluginVersion(p: PluginNotificationMessage): string | undefined {
  // `version` is optional on every list-surface arm; the unreachable
  // transition arms (updated/reinstalled/...) are gated by `"version" in p`.
  if ("version" in p && typeof p.version === "string") {
    return p.version;
  }

  return undefined;
}

function capitalize(s: string): string {
  // `charAt` (not `s[0]`) so `noUncheckedIndexedAccess` keeps the result
  // `string` rather than `string | undefined`.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function statusTag(status: PluginNotificationMessage["status"]): string {
  switch (status) {
    case "installed":
      return "[installed]";
    case "upgradable":
      return "[upgradable]";
    case "available":
      return "[available]";
    case "remote":
      return "[remote]";
    case "partially-available":
    case "partially-installed":
    case "partially-upgradable":
      return "[partial]";
    case "unavailable":
      return "[unavailable]";
    case "disabled":
      return "[disabled]";
    default:
      // Transition arms (updated/reinstalled/uninstalled/failed/skipped/
      // manual recovery/will-*) are unreachable on the list surface.
      return "";
  }
}

function statusDescription(status: PluginNotificationMessage["status"]): string {
  switch (status) {
    case "installed":
      return "installed";
    case "upgradable":
      return "update available";
    case "available":
      return "not installed";
    case "remote":
      return "not fetched";
    case "partially-available":
      return "partially installable";
    case "partially-installed":
      return "partially installed";
    case "partially-upgradable":
      return "partial update available";
    case "unavailable":
      return "not installable";
    case "disabled":
      return "disabled";
    default:
      return "";
  }
}

/**
 * Actions offered for a plugin, filtered by its list-surface status. `info`
 * is always available; install/uninstall/enable/disable are gated by what the
 * status makes meaningful (matches the typed subcommands' preconditions).
 */
export function availableActions(
  status: PluginNotificationMessage["status"],
): readonly PickerAction[] {
  const actions: PickerAction[] = ["info"];
  switch (status) {
    case "available":
    case "remote":
    case "partially-available":
      actions.unshift("install");
      break;
    case "installed":
    case "upgradable":
    case "partially-installed":
    case "partially-upgradable":
      actions.unshift("uninstall", "disable");
      break;
    case "disabled":
      actions.unshift("enable");
      break;
    default:
      break;
  }

  return actions;
}

// ─── component ────────────────────────────────────────────────────────────

/**
 * Multi-screen SelectList browser. The `ctx.ui.custom` factory constructs one
 * instance and delegates the `Component` surface (`render` / `invalidate` /
 * `handleInput`) to it. Esc walks back one screen (install scope -> actions ->
 * plugins -> marketplaces -> cancel); Enter descends or commits.
 */
export class PluginBrowser {
  private readonly tui: BrowserTui;
  private readonly theme: Theme;
  private readonly marketplaces: readonly MarketplaceEntry[];
  private readonly pluginLoader: (
    marketplace: MarketplaceEntry,
  ) => Promise<readonly PluginNotificationMessage[]>;
  private readonly onSelect: (result: PickerResult) => void;
  private readonly onCancel: () => void;

  private readonly container = new Container();
  private list: SelectList | null = null;
  private plugins: readonly PluginEntry[] = [];
  // Name -> entry index so the SelectList `onSelect` correlates a picked
  // item back to its `PluginEntry` without a `.plugins.find(... .name ===)`
  // scan (the manifest-lookup-drift architecture gate flags that pattern).
  private readonly pluginsByName = new Map<string, PluginEntry>();

  constructor(opts: PluginBrowserOptions) {
    this.tui = opts.tui;
    this.theme = opts.theme;
    this.marketplaces = opts.marketplaces;
    this.pluginLoader = opts.pluginLoader;
    this.onSelect = opts.onSelect;
    this.onCancel = opts.onCancel;
    this.showMarketplaces();
  }

  // --- framed-layout helpers (tui.md Pattern 1: DynamicBorder + title +
  //     body + hint + DynamicBorder) ---

  private border(): DynamicBorder {
    return new DynamicBorder((s: string) => this.theme.fg("accent", s));
  }

  private title(text: string): Text {
    return new Text(this.theme.fg("accent", this.theme.bold(text)), 1, 0);
  }

  private hint(text: string): Text {
    return new Text(this.theme.fg("dim", text), 1, 0);
  }

  private listTheme() {
    return {
      selectedPrefix: (t: string) => this.theme.fg("accent", t),
      selectedText: (t: string) => this.theme.fg("accent", t),
      description: (t: string) => this.theme.fg("muted", t),
      scrollInfo: (t: string) => this.theme.fg("dim", t),
      noMatch: (t: string) => this.theme.fg("warning", t),
    };
  }

  private rebuild(titleText: string, hintText: string): void {
    this.container.clear();
    this.container.addChild(this.border());
    this.container.addChild(this.title(titleText));
    if (this.list !== null) {
      this.container.addChild(this.list);
    }

    this.container.addChild(this.hint(hintText));
    this.container.addChild(this.border());
  }

  // --- screen: marketplaces ---

  private showMarketplaces(): void {
    const items: SelectItem[] = this.marketplaces.map((m) => ({
      value: m.name,
      label: `${m.name} [${m.scope}]`,
      description: `${m.pluginCount.toString()} plugin(s) -- ${m.source}`,
    }));
    const list = new SelectList(items, Math.min(items.length, MAX_VISIBLE), this.listTheme());
    list.onSelect = (item) => {
      const mp = this.marketplaces.find((m) => m.name === item.value);
      if (mp !== undefined) {
        this.showPlugins(mp);
      }
    };

    list.onCancel = () => {
      this.onCancel();
    };

    this.list = list;
    this.rebuild("Browse Claude Plugin Marketplaces", "↑↓ navigate • enter open • esc cancel");
  }

  // --- screen: plugins (lazy-loaded) ---

  private showPlugins(mp: MarketplaceEntry): void {
    this.plugins = [];
    this.pluginsByName.clear();
    this.list = null;
    this.rebuild(`Plugins in ${mp.name} [${mp.scope}]`, "loading…");
    void this.loadPlugins(mp);
  }

  private async loadPlugins(mp: MarketplaceEntry): Promise<void> {
    try {
      const rows = await this.pluginLoader(mp);
      this.plugins = rows.map((p): PluginEntry => {
        const version = pluginVersion(p);
        return version !== undefined
          ? { name: p.name, status: p.status, version }
          : { name: p.name, status: p.status };
      });
      this.pluginsByName.clear();
      for (const entry of this.plugins) {
        this.pluginsByName.set(entry.name, entry);
      }

      this.buildPluginsList(mp);
    } catch {
      this.list = null;
      this.rebuild(
        `Plugins in ${mp.name} [${mp.scope}]`,
        "Failed to load plugins • esc to go back",
      );
    }

    this.tui.requestRender();
  }

  private buildPluginsList(mp: MarketplaceEntry): void {
    const items: SelectItem[] = this.plugins.map((p) => ({
      value: p.name,
      label: `${statusTag(p.status)} ${p.name}`,
      description: p.version ?? statusDescription(p.status),
    }));
    if (items.length === 0) {
      this.list = null;
      this.rebuild(`Plugins in ${mp.name} [${mp.scope}]`, "(no plugins) • esc to go back");
      return;
    }

    const list = new SelectList(items, Math.min(items.length, MAX_VISIBLE), this.listTheme());
    list.onSelect = (item) => {
      const plugin = this.pluginsByName.get(item.value);
      if (plugin !== undefined) {
        this.showActions(mp, plugin);
      }
    };

    list.onCancel = () => {
      this.showMarketplaces();
    };

    this.list = list;
    this.rebuild(`Plugins in ${mp.name} [${mp.scope}]`, "↑↓ navigate • enter select • esc back");
  }

  // --- screen: actions ---

  private showActions(mp: MarketplaceEntry, plugin: PluginEntry): void {
    const actions = availableActions(plugin.status);
    const items: SelectItem[] = actions.map((a) => ({
      value: a,
      label: capitalize(a),
      description:
        a === "install"
          ? `install ${plugin.name}@${mp.name} (choose scope next)`
          : `${a} ${plugin.name}@${mp.name} --scope ${mp.scope}`,
    }));
    const list = new SelectList(items, Math.min(items.length, MAX_VISIBLE), this.listTheme());
    list.onSelect = (item) => {
      const action = item.value as PickerAction;
      if (action === "install") {
        this.showInstallScope(mp, plugin);
        return;
      }

      this.onSelect({
        action,
        plugin: plugin.name,
        marketplace: mp.name,
        scope: mp.scope,
      });
    };

    list.onCancel = () => {
      this.buildPluginsList(mp);
    };

    this.list = list;
    this.rebuild(`Action: ${plugin.name} @ ${mp.name}`, "↑↓ navigate • enter select • esc back");
  }

  // --- screen: install scope ---

  private showInstallScope(mp: MarketplaceEntry, plugin: PluginEntry): void {
    const items: SelectItem[] = [
      {
        value: "project-local",
        label: "Project local (Recommended)",
        description:
          "Install locally in .pi/claude-plugins.local.json (gitignored, this repo only)",
      },
      {
        value: "project",
        label: "Project",
        description: "Install in .pi/claude-plugins.json (committed, shared across repo)",
      },
      {
        value: "user",
        label: "User (global)",
        description: "Install globally in ~/.pi/agent/claude-plugins.json (all projects)",
      },
    ];
    const list = new SelectList(items, items.length, this.listTheme());
    list.onSelect = (item) => {
      if (item.value === "project-local") {
        this.onSelect({
          action: "install",
          plugin: plugin.name,
          marketplace: mp.name,
          scope: "project",
          local: true,
        });
      } else if (item.value === "project") {
        this.onSelect({
          action: "install",
          plugin: plugin.name,
          marketplace: mp.name,
          scope: "project",
        });
      } else {
        this.onSelect({
          action: "install",
          plugin: plugin.name,
          marketplace: mp.name,
          scope: "user",
        });
      }
    };

    list.onCancel = () => {
      this.showActions(mp, plugin);
    };

    this.list = list;
    this.rebuild(
      `Install ${plugin.name} @ ${mp.name}: Select Scope`,
      "↑↓ navigate • enter install • esc back",
    );
  }

  // --- Component surface (delegated by the ctx.ui.custom factory) ---

  handleInput(data: string): void {
    this.list?.handleInput(data);
    // SelectList mutates selection state internally; request a re-render so
    // the highlight moves (tui.md key rule 3).
    this.tui.requestRender();
  }

  render(width: number): string[] {
    return this.container.render(width);
  }

  invalidate(): void {
    this.container.invalidate();
  }
}
