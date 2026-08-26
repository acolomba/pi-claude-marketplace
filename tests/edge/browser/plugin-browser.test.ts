// Unit tests for the PluginBrowser SelectList picker.
//
// Drives the browser with raw terminal bytes ("\r" = enter, "\x1b" = esc,
// "\x1b[A"/"\x1b[B" = up/down -- the same sequences matchesKey recognizes)
// and asserts render output + onSelect/onCancel transitions. A mock
// pluginLoader injects canned PluginNotificationMessage rows so no
// orchestrator/disk/network surface is exercised.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  availableActions,
  PluginBrowser,
  statusTag,
  type MarketplaceEntry,
  type PickerResult,
} from "../../../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";

import type { Theme } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { PluginNotificationMessage } from "../../../extensions/pi-claude-marketplace/shared/notify.ts";

// ─── fixtures ──────────────────────────────────────────────────────────────

const ENTER = "\r";
const ESC = "\x1b";
const DOWN = "\x1b[B";

/**
 * Identity theme: every fg/bg/bold call returns its text unchanged so render
 * output is plain ASCII and substring assertions are trivial. Cast through
 * `unknown` because the real `Theme` interface has many more members the
 * browser never touches.
 */
function mockTheme(): Theme {
  return {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Theme;
}

function mockTui(): { requestRender(): void } {
  const calls: number[] = [];
  return {
    requestRender(): void {
      calls.push(calls.length);
    },
  };
}

const marketplaces: readonly MarketplaceEntry[] = [
  {
    name: "official",
    scope: "user",
    pluginCount: 5,
    source: "github:anthropics/claude-plugins-official",
  },
  {
    name: "team-plugins",
    scope: "project",
    pluginCount: 0,
    source: "github:your-org/team-plugins",
  },
];

const officialPlugins: readonly PluginNotificationMessage[] = [
  {
    status: "installed",
    name: "installed-plug",
    dependencies: [],
    severity: "info",
    needsReload: false,
    version: "1.2.0",
  },
  { status: "available", name: "avail-plug" },
  { status: "unavailable", name: "unavail-plug", reasons: [] },
  { status: "disabled", name: "disabled-plug", severity: "info", needsReload: false },
  { status: "upgradable", name: "upgradable-plug", reasons: [], version: "2.0.0" },
];

/** Flush pending microtasks so the browser's async pluginLoader resolves. */
function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function makeBrowser(
  onSelect: (result: PickerResult) => void,
  onCancel: () => void,
): PluginBrowser {
  return new PluginBrowser({
    tui: mockTui(),
    theme: mockTheme(),
    marketplaces,
    pluginLoader: (mp): Promise<readonly PluginNotificationMessage[]> => {
      if (mp.name === "official") {
        return Promise.resolve(officialPlugins);
      }

      return Promise.resolve([]);
    },
    onSelect,
    onCancel,
  });
}

function rendered(browser: PluginBrowser, width = 80): string {
  return browser.render(width).join("\n");
}

// ─── pure helper tests ─────────────────────────────────────────────────────

test("availableActions :: install+info for available / remote / partially-available", () => {
  assert.deepEqual([...availableActions("available")], ["install", "info"]);
  assert.deepEqual([...availableActions("remote")], ["install", "info"]);
  assert.deepEqual([...availableActions("partially-available")], ["install", "info"]);
});

test("availableActions :: uninstall+disable+info for the installed family", () => {
  const family = [
    "installed",
    "upgradable",
    "partially-installed",
    "partially-upgradable",
  ] as const;
  for (const status of family) {
    assert.deepEqual(
      [...availableActions(status)],
      ["uninstall", "disable", "info"],
      `status=${status}`,
    );
  }
});

test("availableActions :: enable+info for disabled; only info for unavailable", () => {
  assert.deepEqual([...availableActions("disabled")], ["enable", "info"]);
  assert.deepEqual([...availableActions("unavailable")], ["info"]);
});

test("statusTag :: bracketed token per list-surface status", () => {
  assert.equal(statusTag("installed"), "[installed]");
  assert.equal(statusTag("available"), "[available]");
  assert.equal(statusTag("unavailable"), "[unavailable]");
  assert.equal(statusTag("disabled"), "[disabled]");
  assert.equal(statusTag("remote"), "[remote]");
  assert.equal(statusTag("upgradable"), "[upgradable]");
  assert.equal(statusTag("partially-available"), "[partial]");
});

// ─── screen-transition tests ───────────────────────────────────────────────

test("PluginBrowser :: opens on the marketplaces screen with title + entries", () => {
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );
  const out = rendered(browser);
  assert.ok(out.includes("Browse Claude Plugin Marketplaces"), out);
  assert.ok(out.includes("official"), out);
  assert.ok(out.includes("team-plugins"), out);
});

test("PluginBrowser :: marketplaces -> plugins -> actions -> esc back to plugins -> esc back to marketplaces -> esc cancel", async () => {
  let cancelled = false;
  const browser = makeBrowser(
    () => undefined,
    () => {
      cancelled = true;
    },
  );

  // marketplaces -> plugins (first marketplace = official)
  browser.handleInput(ENTER);
  await flush();
  let out = rendered(browser);
  assert.ok(out.includes("Plugins in official"), out);
  assert.ok(out.includes("installed-plug"), out);

  // plugins -> actions (first plugin = installed-plug)
  browser.handleInput(ENTER);
  out = rendered(browser);
  assert.ok(out.includes("Action: installed-plug @ official"), out);
  // installed family offers Uninstall, Disable, Info
  assert.ok(out.includes("Uninstall"), out);
  assert.ok(out.includes("Disable"), out);
  assert.ok(out.includes("Info"), out);

  // esc: actions -> plugins
  browser.handleInput(ESC);
  out = rendered(browser);
  assert.ok(out.includes("Plugins in official"), out);

  // esc: plugins -> marketplaces
  browser.handleInput(ESC);
  out = rendered(browser);
  assert.ok(out.includes("Browse Claude Plugin Marketplaces"), out);

  // esc: marketplaces -> cancel
  browser.handleInput(ESC);
  assert.equal(cancelled, true);
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> Project local (Recommended) commits project scope with local:true", async () => {
  let result: PickerResult | null = null;
  const browser = makeBrowser(
    (r) => {
      result = r;
    },
    () => undefined,
  );

  // open official
  browser.handleInput(ENTER);
  await flush();

  // move to the second plugin (avail-plug, status "available")
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  let out = rendered(browser);
  assert.ok(out.includes("Action: avail-plug @ official"), out);
  // available offers Install first
  assert.ok(out.includes("Install"), out);
  assert.ok(!out.includes("Uninstall"), out);

  // select Install -> opens scope screen
  browser.handleInput(ENTER);
  out = rendered(browser);
  assert.ok(out.includes("Install avail-plug @ official: Select Scope"), out);
  assert.ok(out.includes("Project local (Recommended)"), out);
  assert.ok(out.includes("Project"), out);
  assert.ok(out.includes("User (global)"), out);

  // commit first item: Project local (Recommended)
  browser.handleInput(ENTER);
  assert.deepEqual(result, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "project",
    local: true,
  });
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> Project commits project scope without local", async () => {
  let result: PickerResult | null = null;
  const browser = makeBrowser(
    (r) => {
      result = r;
    },
    () => undefined,
  );

  // open official
  browser.handleInput(ENTER);
  await flush();

  // move to the second plugin (avail-plug, status "available")
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);

  // select Install -> opens scope screen
  browser.handleInput(ENTER);
  const out = rendered(browser);
  assert.ok(out.includes("Install avail-plug @ official: Select Scope"), out);

  // down to second item: Project
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  assert.deepEqual(result, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "project",
  });
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> User (global) commits user scope", async () => {
  let result: PickerResult | null = null;
  const browser = makeBrowser(
    (r) => {
      result = r;
    },
    () => undefined,
  );

  // open official
  browser.handleInput(ENTER);
  await flush();

  // move to the second plugin (avail-plug, status "available")
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);

  // select Install -> opens scope screen
  browser.handleInput(ENTER);

  // down twice to third item: User (global)
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  assert.deepEqual(result, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "user",
  });
});

test("PluginBrowser :: scope screen esc returns to actions screen", async () => {
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // open official -> avail-plug -> install -> scope screen
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  browser.handleInput(ENTER);
  let out = rendered(browser);
  assert.ok(out.includes("Select Scope"), out);

  // esc back to actions
  browser.handleInput(ESC);
  out = rendered(browser);
  assert.ok(out.includes("Action: avail-plug @ official"), out);
});

test("PluginBrowser :: disabled plugin offers Enable; committing fires onSelect with action enable", async () => {
  let result: PickerResult | null = null;
  const browser = makeBrowser(
    (r) => {
      result = r;
    },
    () => undefined,
  );

  browser.handleInput(ENTER);
  await flush();

  // installed-plug (0), avail-plug (1), unavail-plug (2), disabled-plug (3)
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  const out = rendered(browser);
  assert.ok(out.includes("Action: disabled-plug @ official"), out);
  assert.ok(out.includes("Enable"), out);
  assert.ok(!out.includes("Install"), out);
  assert.ok(!out.includes("Uninstall"), out);

  browser.handleInput(ENTER);
  assert.deepEqual(result, {
    action: "enable",
    plugin: "disabled-plug",
    marketplace: "official",
    scope: "user",
  });
});

test("PluginBrowser :: empty marketplace renders the (no plugins) placeholder", async () => {
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // down to the second marketplace (team-plugins, 0 plugins) then enter
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  await flush();
  const out = rendered(browser);
  assert.ok(out.includes("Plugins in team-plugins"), out);
  assert.ok(out.includes("(no plugins)"), out);
});

test("PluginBrowser :: pluginLoader rejection renders the failure hint", async () => {
  const browser = new PluginBrowser({
    tui: mockTui(),
    theme: mockTheme(),
    marketplaces,
    pluginLoader: (): Promise<readonly PluginNotificationMessage[]> =>
      Promise.reject(new Error("boom")),
    onSelect: () => undefined,
    onCancel: () => undefined,
  });

  browser.handleInput(ENTER);
  await flush();
  const out = rendered(browser);
  assert.ok(out.includes("Failed to load plugins"), out);
  assert.ok(out.includes("esc to go back"), out);
});
