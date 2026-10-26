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
// chokepoint), and the `@earendil-works/pi-tui` peer dep, which the Pi peer
// chokepoint does not restrict. No orchestrators/ or domain/ import -- this
// file is pure UI.

import {
  Container,
  matchesKey,
  SelectList,
  Text,
  type SelectItem,
  type SelectListTheme,
} from "@earendil-works/pi-tui";

import { DynamicBorder, type Theme } from "../../platform/pi-api.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import {
  pluginScopeOrFallback,
  pluginVersion,
  type PluginNotificationMessage,
} from "../../shared/notification-types.ts";

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
  readonly scope: Scope;
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

function capitalize(s: string): string {
  // `charAt` (not `s[0]`) so `noUncheckedIndexedAccess` keeps the result
  // `string` rather than `string | undefined`.
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type RowStatus = PluginNotificationMessage["status"];

// D-15: each status table is a TOTAL map over the status union, so a new
// status fails to compile until every table classifies it. A switch naming all
// twenty statuses would exceed the cyclomatic ceiling.
const STATUS_TAG = {
  installed: "[installed]",
  upgradable: "[upgradable]",
  available: "[available]",
  remote: "[remote]",
  "partially-available": "[partial]",
  "partially-installed": "[partial]",
  "partially-upgradable": "[partial]",
  unavailable: "[unavailable]",
  disabled: "[disabled]",
  updated: "",
  reinstalled: "",
  uninstalled: "",
  failed: "",
  skipped: "",
  "manual recovery": "",
  "will install": "",
  "will uninstall": "",
  "will enable": "",
  "will disable": "",
  "will update": "",
} as const satisfies Record<RowStatus, string>;

const STATUS_DESCRIPTION = {
  installed: "installed",
  upgradable: "update available",
  available: "not installed",
  remote: "not fetched",
  "partially-available": "partially installable",
  "partially-installed": "partially installed",
  "partially-upgradable": "partial update available",
  unavailable: "not installable",
  disabled: "disabled",
  updated: "",
  reinstalled: "",
  uninstalled: "",
  failed: "",
  skipped: "",
  "manual recovery": "",
  "will install": "",
  "will uninstall": "",
  "will enable": "",
  "will disable": "",
  "will update": "",
} as const satisfies Record<RowStatus, string>;

const INSTALL_ACTIONS: readonly PickerAction[] = ["install"];
const INSTALLED_ACTIONS: readonly PickerAction[] = ["uninstall", "disable"];
const DISABLED_ACTIONS: readonly PickerAction[] = ["enable"];
const NO_ACTIONS: readonly PickerAction[] = [];

/**
 * The actions offered ahead of `info`, by list-surface status. `info` is
 * always available; install/uninstall/enable/disable are gated by what the
 * status makes meaningful (matches the typed subcommands' preconditions).
 */
const STATUS_ACTIONS = {
  available: INSTALL_ACTIONS,
  remote: INSTALL_ACTIONS,
  "partially-available": INSTALL_ACTIONS,
  installed: INSTALLED_ACTIONS,
  upgradable: INSTALLED_ACTIONS,
  "partially-installed": INSTALLED_ACTIONS,
  "partially-upgradable": INSTALLED_ACTIONS,
  disabled: DISABLED_ACTIONS,
  unavailable: NO_ACTIONS,
  updated: NO_ACTIONS,
  reinstalled: NO_ACTIONS,
  uninstalled: NO_ACTIONS,
  failed: NO_ACTIONS,
  skipped: NO_ACTIONS,
  "manual recovery": NO_ACTIONS,
  "will install": NO_ACTIONS,
  "will uninstall": NO_ACTIONS,
  "will enable": NO_ACTIONS,
  "will disable": NO_ACTIONS,
  "will update": NO_ACTIONS,
} as const satisfies Record<RowStatus, readonly PickerAction[]>;

function statusTag(status: RowStatus): string {
  return STATUS_TAG[status];
}

function statusDescription(status: RowStatus): string {
  return STATUS_DESCRIPTION[status];
}

/** Actions offered for a plugin, filtered by its list-surface status. */
function availableActions(status: RowStatus): readonly PickerAction[] {
  return [...STATUS_ACTIONS[status], "info"];
}

function makeSelectListTheme(theme: Theme): SelectListTheme {
  const accent = (t: string): string => theme.fg("accent", t);
  return {
    // Both accent roles render identically, and the installed pi-tui calls
    // only `selectedText`; one function covers both rather than leaving a
    // second, identical body that nothing can reach.
    selectedPrefix: accent,
    selectedText: accent,
    description: (t: string) => theme.fg("muted", t),
    scrollInfo: (t: string) => theme.fg("dim", t),
    noMatch: (t: string) => theme.fg("warning", t),
  };
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
  private loadEpoch = 0;
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

  private listTheme(): SelectListTheme {
    return makeSelectListTheme(this.theme);
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
    ++this.loadEpoch;
    const items: SelectItem[] = this.marketplaces.map((m) => ({
      value: `${m.scope}:${m.name}`,
      label: `${m.name} [${m.scope}]`,
      description: `${m.pluginCount.toString()} plugin(s) -- ${m.source}`,
    }));
    const list = new SelectList(items, Math.min(items.length, MAX_VISIBLE), this.listTheme());
    list.onSelect = (item) => {
      const mp = this.marketplaces.find((m) => `${m.scope}:${m.name}` === item.value);
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
    const epoch = ++this.loadEpoch;
    try {
      const rows = await this.pluginLoader(mp);
      if (epoch !== this.loadEpoch) {
        return;
      }

      this.plugins = rows.map((p): PluginEntry => {
        const version = pluginVersion(p);
        const scope = pluginScopeOrFallback(p, mp.scope);
        return version !== undefined
          ? { name: p.name, status: p.status, scope, version }
          : { name: p.name, status: p.status, scope };
      });
      this.pluginsByName.clear();
      for (const entry of this.plugins) {
        this.pluginsByName.set(entry.name, entry);
      }

      this.buildPluginsList(mp);
    } catch (err) {
      hookDebugLog(
        `plugin load failed for ${mp.name} [${mp.scope}]: ${errorMessage(err)}`,
        "browser",
      );
      if (epoch !== this.loadEpoch) {
        return;
      }

      this.list = null;
      this.rebuild(
        `Plugins in ${mp.name} [${mp.scope}]`,
        "Failed to load plugins • esc to go back",
      );
    }

    this.tui.requestRender();
  }

  private buildPluginsList(mp: MarketplaceEntry): void {
    const items: SelectItem[] = this.plugins.map((p) => {
      // The status phrase is what the column describes; a version is a display
      // override on top of it. Reading the phrase for every row rather than
      // only for the rows without a version keeps the two halves of the column
      // independent -- `updated` is the one status that always carries a
      // version, so short-circuiting is the difference between a status switch
      // that answers for the whole union and one that never answers for it.
      const described = statusDescription(p.status);
      return {
        value: p.name,
        label: `${statusTag(p.status)} ${p.name}`,
        description: p.version ?? described,
      };
    });
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
          : `${a} ${plugin.name}@${mp.name} --scope ${plugin.scope}`,
    }));
    const list = new SelectList(items, Math.min(items.length, MAX_VISIBLE), this.listTheme());
    list.onSelect = (item) => {
      // Every item value above comes from `availableActions`.
      const action = item.value as PickerAction;
      if (action === "install") {
        this.showInstallScope(mp, plugin);
        return;
      }

      this.onSelect({
        action,
        plugin: plugin.name,
        marketplace: mp.name,
        scope: plugin.scope,
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
          "Install in the local config (.pi/claude-plugins.local.json, gitignored, this repo only)",
      },
      {
        value: "project",
        label: "Project",
        description:
          "Install in the base config (.pi/claude-plugins.json, for all collaborators on this repo)",
      },
      {
        value: "user",
        label: "User (global)",
        description:
          "Install in the user scope's base config (~/.pi/agent/claude-plugins.json, all projects)",
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
    if (this.list === null) {
      if (matchesKey(data, "escape")) {
        this.showMarketplaces();
      }

      this.tui.requestRender();
      return;
    }

    this.list.handleInput(data);
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
