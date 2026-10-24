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
  PluginBrowser,
  type MarketplaceEntry,
  type PickerResult,
} from "../../../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";

import type { Theme } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { PluginNotificationMessage } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";

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
function identityTheme(): Theme {
  return {
    fg: (_color: string, text: string) => text,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => text,
  } as unknown as Theme;
}

function noopTui(): { requestRender(): void } {
  return {
    requestRender(): void {
      // No case in this suite asserts a render-request count.
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
    tui: noopTui(),
    theme: identityTheme(),
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

// ─── status projection, through the browser's own screens ──────────────────

const official: MarketplaceEntry = {
  name: "official",
  scope: "user",
  pluginCount: 1,
  source: "github:anthropics/claude-plugins-official",
};

/** A browser over one marketplace whose loader hands back exactly `rows`. */
function browserOverRows(rows: readonly PluginNotificationMessage[]): PluginBrowser {
  return new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces: [official],
    pluginLoader: () => Promise.resolve(rows),
    onSelect: () => undefined,
    onCancel: () => undefined,
  });
}

/** One plugin row with its selection marker and column padding collapsed away. */
function pluginLine(browser: PluginBrowser, name: string): string {
  const line = rendered(browser)
    .split("\n")
    .find((candidate) => candidate.includes(name));
  assert.ok(line !== undefined, `no rendered row for ${name}`);
  return line.replace("→", "").replace(/\s+/g, " ").trim();
}

/** The action labels the actions screen offers, in order. */
function actionLabels(browser: PluginBrowser, name: string): string[] {
  return rendered(browser)
    .split("\n")
    .filter((line) => line.includes(`${name}@${official.name}`))
    .map(
      (line) =>
        line
          .replace("→", "")
          .trim()
          .split(/\s{2,}/)[0] ?? "",
    );
}

/**
 * Every status the injected loader may hand the browser, with the row its
 * plugins screen renders and the actions its action screen offers. The
 * transition statuses the list surface never produces are here because the
 * loader returns whatever `loadPluginListPayload` produced: they carry no tag
 * and no description, and offer `Info` alone.
 */
const STATUS_CASES = [
  {
    row: {
      status: "installed",
      name: "installed-row",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    line: "[installed] installed-row installed",
    actions: ["Uninstall", "Disable", "Info"],
  },
  {
    row: {
      status: "updated",
      name: "updated-row",
      from: "1.0.0",
      to: "2.0.0",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    // `pluginVersion` reads the target version off an updated row, so the
    // description column carries it instead of a status phrase.
    line: "updated-row 2.0.0",
    actions: ["Info"],
  },
  {
    row: {
      status: "reinstalled",
      name: "reinstalled-row",
      dependencies: [],
      severity: "info",
      needsReload: false,
    },
    line: "reinstalled-row",
    actions: ["Info"],
  },
  {
    row: { status: "uninstalled", name: "uninstalled-row", severity: "info", needsReload: false },
    line: "uninstalled-row",
    actions: ["Info"],
  },
  {
    row: { status: "disabled", name: "disabled-row", severity: "info", needsReload: false },
    line: "[disabled] disabled-row disabled",
    actions: ["Enable", "Info"],
  },
  {
    row: { status: "available", name: "available-row" },
    line: "[available] available-row not installed",
    actions: ["Install", "Info"],
  },
  {
    row: { status: "remote", name: "remote-row" },
    line: "[remote] remote-row not fetched",
    actions: ["Install", "Info"],
  },
  {
    row: { status: "unavailable", name: "unavailable-row", reasons: [] },
    line: "[unavailable] unavailable-row not installable",
    actions: ["Info"],
  },
  {
    row: { status: "partially-available", name: "partial-avail-row", reasons: [] },
    line: "[partial] partial-avail-row partially installable",
    actions: ["Install", "Info"],
  },
  {
    row: { status: "upgradable", name: "upgradable-row", reasons: [] },
    line: "[upgradable] upgradable-row update available",
    actions: ["Uninstall", "Disable", "Info"],
  },
  {
    row: { status: "partially-installed", name: "partial-inst-row", reasons: [] },
    line: "[partial] partial-inst-row partially installed",
    actions: ["Uninstall", "Disable", "Info"],
  },
  {
    row: { status: "partially-upgradable", name: "partial-upgr-row", reasons: [] },
    line: "[partial] partial-upgr-row partial update available",
    actions: ["Uninstall", "Disable", "Info"],
  },
  {
    row: { status: "failed", name: "failed-row", severity: "error", reasons: [] },
    line: "failed-row",
    actions: ["Info"],
  },
  {
    row: { status: "skipped", name: "skipped-row", reasons: [] },
    line: "skipped-row",
    actions: ["Info"],
  },
  {
    row: { status: "manual recovery", name: "manual-recovery-row", reasons: [] },
    line: "manual-recovery-row",
    actions: ["Info"],
  },
  {
    row: { status: "will install", name: "will-install-row" },
    line: "will-install-row",
    actions: ["Info"],
  },
  {
    row: { status: "will uninstall", name: "will-uninstall-row" },
    line: "will-uninstall-row",
    actions: ["Info"],
  },
  {
    row: { status: "will enable", name: "will-enable-row" },
    line: "will-enable-row",
    actions: ["Info"],
  },
  {
    row: { status: "will disable", name: "will-disable-row" },
    line: "will-disable-row",
    actions: ["Info"],
  },
  {
    row: { status: "will update", name: "will-update-row", from: "1.0.0", to: "1.1.0" },
    line: "will-update-row 1.1.0",
    actions: ["Info"],
  },
] as const satisfies readonly {
  row: PluginNotificationMessage;
  line: string;
  actions: readonly string[];
}[];

// A status the table does not drive leaves `UndrivenStatus` inhabited and makes
// this a compile error, so the table stays total over the plugin status union.
// The tuple wrappers stop the naked-`never` conditional from distributing.
type UndrivenStatus = Exclude<
  PluginNotificationMessage["status"],
  (typeof STATUS_CASES)[number]["row"]["status"]
>;
type StatusCasesAreTotal = [UndrivenStatus] extends [never] ? true : false;
void (true satisfies StatusCasesAreTotal);

for (const { row, line, actions } of STATUS_CASES) {
  test(`PluginBrowser :: renders the ${row.status} row as "${line}"`, async () => {
    // arrange
    const browser = browserOverRows([row]);
    const expectedLine = line;

    // act
    browser.handleInput(ENTER);
    await flush();

    // assert
    assert.strictEqual(pluginLine(browser, row.name), expectedLine);
  });

  test(`PluginBrowser :: offers ${actions.join(" / ")} for the ${row.status} row`, async () => {
    // arrange
    const browser = browserOverRows([row]);
    const expectedActions = [...actions];

    // act
    browser.handleInput(ENTER);
    await flush();
    browser.handleInput(ENTER);

    // assert
    assert.deepStrictEqual(actionLabels(browser, row.name), expectedActions);
  });
}

test("PluginBrowser :: reports an empty marketplace list rather than an empty frame", () => {
  // arrange
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces: [],
    pluginLoader: () => Promise.resolve([]),
    onSelect: () => undefined,
    onCancel: () => undefined,
  });
  const expectedNotice = "No matching commands";

  // act
  const out = rendered(browser);

  // assert
  assert.ok(out.includes(expectedNotice), out);
});

test("PluginBrowser :: shows a scroll position once the marketplaces outrun one screen", () => {
  // arrange
  const crowd: readonly MarketplaceEntry[] = Array.from({ length: 13 }, (_, index) => ({
    name: `mp-${index.toString()}`,
    scope: "user",
    pluginCount: 0,
    source: "github:acme/plugins",
  }));
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces: crowd,
    pluginLoader: () => Promise.resolve([]),
    onSelect: () => undefined,
    onCancel: () => undefined,
  });
  const expectedPosition = "(1/13)";

  // act
  const out = rendered(browser);

  // assert
  assert.ok(out.includes(expectedPosition), out);
});

test("PluginBrowser :: invalidate delegates to the underlying container without throwing", () => {
  // arrange
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // act & assert
  assert.doesNotThrow(() => {
    browser.invalidate();
  });
});

// ─── screen-transition tests ───────────────────────────────────────────────

test("PluginBrowser :: opens on the marketplaces screen with title + entries", () => {
  // arrange
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // act
  const screen = rendered(browser);

  // assert
  assert.ok(screen.includes("Browse Claude Plugin Marketplaces"), screen);
  assert.ok(screen.includes("official"), screen);
  assert.ok(screen.includes("team-plugins"), screen);
});

test("PluginBrowser :: marketplaces -> plugins -> actions -> esc back to plugins -> esc back to marketplaces -> esc cancel", async () => {
  // arrange
  let cancelled = false;
  const browser = makeBrowser(
    () => undefined,
    () => {
      cancelled = true;
    },
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  const pluginsScreen = rendered(browser);
  browser.handleInput(ENTER);
  const actionsScreen = rendered(browser);
  browser.handleInput(ESC);
  const backToPluginsScreen = rendered(browser);
  browser.handleInput(ESC);
  const backToMarketplacesScreen = rendered(browser);
  browser.handleInput(ESC);

  // assert
  assert.ok(pluginsScreen.includes("Plugins in official"), pluginsScreen);
  assert.ok(pluginsScreen.includes("installed-plug"), pluginsScreen);
  assert.ok(actionsScreen.includes("Action: installed-plug @ official"), actionsScreen);
  assert.ok(actionsScreen.includes("Uninstall"), actionsScreen);
  assert.ok(actionsScreen.includes("Disable"), actionsScreen);
  assert.ok(actionsScreen.includes("Info"), actionsScreen);
  assert.ok(backToPluginsScreen.includes("Plugins in official"), backToPluginsScreen);
  assert.ok(
    backToMarketplacesScreen.includes("Browse Claude Plugin Marketplaces"),
    backToMarketplacesScreen,
  );
  assert.strictEqual(cancelled, true);
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> Project local (Recommended) commits project scope with local:true", async () => {
  // arrange
  let picked: PickerResult | null = null;
  const browser = makeBrowser(
    (selection) => {
      picked = selection;
    },
    () => undefined,
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  const actionsScreen = rendered(browser);
  browser.handleInput(ENTER);
  const scopeScreen = rendered(browser);
  browser.handleInput(ENTER);

  // assert
  assert.ok(actionsScreen.includes("Action: avail-plug @ official"), actionsScreen);
  assert.ok(actionsScreen.includes("Install"), actionsScreen);
  assert.ok(!actionsScreen.includes("Uninstall"), actionsScreen);
  assert.ok(scopeScreen.includes("Install avail-plug @ official: Select Scope"), scopeScreen);
  assert.ok(scopeScreen.includes("Project local (Recommended)"), scopeScreen);
  assert.ok(scopeScreen.includes("Project"), scopeScreen);
  assert.ok(scopeScreen.includes("User (global)"), scopeScreen);
  assert.deepStrictEqual(picked, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "project",
    local: true,
  });
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> Project commits project scope without local", async () => {
  // arrange
  let picked: PickerResult | null = null;
  const browser = makeBrowser(
    (selection) => {
      picked = selection;
    },
    () => undefined,
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  browser.handleInput(ENTER);
  const scopeScreen = rendered(browser);
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);

  // assert
  assert.ok(scopeScreen.includes("Install avail-plug @ official: Select Scope"), scopeScreen);
  assert.deepStrictEqual(picked, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "project",
  });
});

test("PluginBrowser :: available plugin offers Install -> Scope screen -> User (global) commits user scope", async () => {
  // arrange
  let picked: PickerResult | null = null;
  const browser = makeBrowser(
    (selection) => {
      picked = selection;
    },
    () => undefined,
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  browser.handleInput(ENTER);
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);

  // assert
  assert.deepStrictEqual(picked, {
    action: "install",
    plugin: "avail-plug",
    marketplace: "official",
    scope: "user",
  });
});

test("PluginBrowser :: scope screen names the config each choice installs into", async () => {
  // arrange
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);

  // act
  browser.handleInput(ENTER);

  // assert
  assert.deepStrictEqual(
    rendered(browser, 200)
      .split("\n")
      .slice(2, 5)
      .map((line) =>
        line
          .replace("→", "")
          .trim()
          .split(/\s{2,}/),
      ),
    [
      [
        "Project local (Recommended)",
        "Install in the local config (.pi/claude-plugins.local.json, gitignored, this repo only)",
      ],
      [
        "Project",
        "Install in the base config (.pi/claude-plugins.json, for all collaborators on this repo)",
      ],
      [
        "User (global)",
        "Install in the user scope's base config (~/.pi/agent/claude-plugins.json, all projects)",
      ],
    ],
  );
});

test("PluginBrowser :: scope screen esc returns to actions screen", async () => {
  // arrange
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  browser.handleInput(ENTER);
  const scopeScreen = rendered(browser);
  browser.handleInput(ESC);
  const actionsScreen = rendered(browser);

  // assert
  assert.ok(scopeScreen.includes("Select Scope"), scopeScreen);
  assert.ok(actionsScreen.includes("Action: avail-plug @ official"), actionsScreen);
});

test("PluginBrowser :: disabled plugin offers Enable; committing fires onSelect with action enable", async () => {
  // arrange
  let picked: PickerResult | null = null;
  const browser = makeBrowser(
    (selection) => {
      picked = selection;
    },
    () => undefined,
  );

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  const actionsScreen = rendered(browser);
  browser.handleInput(ENTER);

  // assert
  assert.ok(actionsScreen.includes("Action: disabled-plug @ official"), actionsScreen);
  assert.ok(actionsScreen.includes("Enable"), actionsScreen);
  assert.ok(!actionsScreen.includes("Install"), actionsScreen);
  assert.ok(!actionsScreen.includes("Uninstall"), actionsScreen);
  assert.deepStrictEqual(picked, {
    action: "enable",
    plugin: "disabled-plug",
    marketplace: "official",
    scope: "user",
  });
});

test("PluginBrowser :: empty marketplace renders the (no plugins) placeholder", async () => {
  // arrange
  const browser = makeBrowser(
    () => undefined,
    () => undefined,
  );

  // act
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  await flush();
  const emptyScreen = rendered(browser);
  browser.handleInput(DOWN);
  browser.handleInput(ESC);
  const backScreen = rendered(browser);

  // assert
  assert.ok(emptyScreen.includes("Plugins in team-plugins"), emptyScreen);
  assert.ok(emptyScreen.includes("(no plugins)"), emptyScreen);
  assert.ok(backScreen.includes("Browse Claude Plugin Marketplaces"), backScreen);
});

test("PluginBrowser :: pluginLoader rejection renders the failure hint", async () => {
  // arrange
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces,
    pluginLoader: (): Promise<readonly PluginNotificationMessage[]> =>
      Promise.reject(new Error("boom")),
    onSelect: () => undefined,
    onCancel: () => undefined,
  });

  // act
  browser.handleInput(ENTER);
  await flush();
  const screen = rendered(browser);

  // assert
  assert.ok(screen.includes("Failed to load plugins"), screen);
  assert.ok(screen.includes("esc to go back"), screen);
});

test("PluginBrowser :: same-name marketplaces across scopes open their respective scope", async () => {
  // arrange
  const sameNameMarketplaces: readonly MarketplaceEntry[] = [
    {
      name: "community",
      scope: "user",
      pluginCount: 1,
      source: "github:user/community",
    },
    {
      name: "community",
      scope: "project",
      pluginCount: 2,
      source: "github:project/community",
    },
  ];
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces: sameNameMarketplaces,
    pluginLoader: (mp): Promise<readonly PluginNotificationMessage[]> => {
      return Promise.resolve([
        {
          status: "available",
          name: `${mp.scope}-plug`,
        },
      ]);
    },
    onSelect: () => undefined,
    onCancel: () => undefined,
  });

  // act
  browser.handleInput(DOWN);
  browser.handleInput(ENTER);
  await flush();
  const screen = rendered(browser);

  // assert
  assert.ok(screen.includes("Plugins in community [project]"), screen);
  assert.ok(screen.includes("project-plug"), screen);
});

test("PluginBrowser :: stale load race is cancelled when user navigates back to marketplaces", async () => {
  // arrange
  let resolveSlowLoad!: (rows: readonly PluginNotificationMessage[]) => void;
  const slowLoadPromise = new Promise<readonly PluginNotificationMessage[]>((resolve) => {
    resolveSlowLoad = resolve;
  });
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces,
    pluginLoader: () => slowLoadPromise,
    onSelect: () => undefined,
    onCancel: () => undefined,
  });

  // act
  browser.handleInput(ENTER);
  const loadingScreen = rendered(browser);
  browser.handleInput(ESC);
  const backScreen = rendered(browser);
  resolveSlowLoad([
    {
      status: "available",
      name: "late-plug",
    },
  ]);
  await flush();
  const settledScreen = rendered(browser);

  // assert
  assert.ok(loadingScreen.includes("loading…"), loadingScreen);
  assert.ok(backScreen.includes("Browse Claude Plugin Marketplaces"), backScreen);
  assert.ok(settledScreen.includes("Browse Claude Plugin Marketplaces"), settledScreen);
  assert.ok(!settledScreen.includes("late-plug"), settledScreen);
});

test("PluginBrowser :: stale load failure is cancelled when user navigates back to marketplaces", async () => {
  // arrange
  let rejectSlowLoad!: (err: Error) => void;
  const slowLoadPromise = new Promise<readonly PluginNotificationMessage[]>((_resolve, reject) => {
    rejectSlowLoad = reject;
  });
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces,
    pluginLoader: () => slowLoadPromise,
    onSelect: () => undefined,
    onCancel: () => undefined,
  });

  // act
  browser.handleInput(ENTER);
  const loadingScreen = rendered(browser);
  browser.handleInput(ESC);
  const backScreen = rendered(browser);
  rejectSlowLoad(new Error("late failure"));
  await flush();
  const settledScreen = rendered(browser);

  // assert
  assert.ok(loadingScreen.includes("loading…"), loadingScreen);
  assert.ok(backScreen.includes("Browse Claude Plugin Marketplaces"), backScreen);
  assert.ok(settledScreen.includes("Browse Claude Plugin Marketplaces"), settledScreen);
  assert.ok(!settledScreen.includes("Failed to load plugins"), settledScreen);
});

test("PluginBrowser :: non-install action preserves row-level scope on cross-scope installed row", async () => {
  // arrange
  let picked: PickerResult | null = null;
  const browser = new PluginBrowser({
    tui: noopTui(),
    theme: identityTheme(),
    marketplaces,
    pluginLoader: (): Promise<readonly PluginNotificationMessage[]> => {
      return Promise.resolve([
        {
          status: "installed",
          name: "cross-scope-plug",
          scope: "project",
          version: "1.0.0",
          dependencies: [],
          severity: "info",
          needsReload: false,
        },
      ]);
    },
    onSelect: (selection) => {
      picked = selection;
    },
    onCancel: () => undefined,
  });

  // act
  browser.handleInput(ENTER);
  await flush();
  browser.handleInput(ENTER);
  browser.handleInput(ENTER);

  // assert
  assert.deepStrictEqual(picked, {
    action: "uninstall",
    plugin: "cross-scope-plug",
    marketplace: "official",
    scope: "project",
  });
});
