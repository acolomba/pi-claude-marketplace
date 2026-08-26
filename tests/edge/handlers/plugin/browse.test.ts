// Owner for edge/handlers/plugin/browse.ts (MOD-09).
//
// Tests for the /claude:plugin browse shim:
//   - non-TUI fallback to list subcommand
//   - TUI mode with no marketplaces (diagnostic notification)
//   - TUI mode custom UI cancel
//   - TUI mode action dispatch for install (with/without --local), uninstall,
//     info, enable, disable

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import {
  makeBrowseHandler,
  type BrowseActionHandlers,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { buildInstalledPluginRecord, mergeMarketplaceIntoState } from "../marketplace-seed.ts";

import type { PickerResult } from "../../../../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";
import type { ExtensionState } from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface HermeticScope {
  readonly cwd: string;
}

async function createHermeticScope(t: TestContext, name: string): Promise<HermeticScope> {
  const root = await mkdtemp(path.join(tmpdir(), `browse-test-${name}-`));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  return { cwd: root };
}

function marketplaceRecordIn(
  root: string,
  marketplaceName: string,
  plugins: MarketplaceRecord["plugins"] = {},
): MarketplaceRecord {
  const marketplaceRoot = path.join(root, "marketplaces", marketplaceName);
  return {
    name: marketplaceName,
    scope: "project",
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: root,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins,
  };
}

async function seedMarketplace(
  cwd: string,
  marketplaceName: string,
  plugins: MarketplaceRecord["plugins"] = {},
): Promise<void> {
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await mergeMarketplaceIntoState(
    locations.extensionRoot,
    marketplaceName,
    marketplaceRecordIn(cwd, marketplaceName, plugins),
  );
}

function createMockActionHandlers(): {
  readonly handlers: BrowseActionHandlers;
  readonly mockList: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly mockInstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly mockUninstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly mockPluginInfo: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly mockEnable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  readonly mockDisable: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
} {
  const mockList = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "list handler",
  });
  const mockInstall = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "install handler",
  });
  const mockUninstall = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "uninstall handler",
  });
  const mockPluginInfo = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "pluginInfo handler",
  });
  const mockEnable = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "enable handler",
  });
  const mockDisable = mock<(args: string, ctx: ExtensionCommandContext) => Promise<void>>({
    exactParams: true,
    name: "disable handler",
  });

  return {
    handlers: {
      list: mockList,
      install: mockInstall,
      uninstall: mockUninstall,
      pluginInfo: mockPluginInfo,
      enable: mockEnable,
      disable: mockDisable,
    },
    mockList,
    mockInstall,
    mockUninstall,
    mockPluginInfo,
    mockEnable,
    mockDisable,
  };
}

test("browse rejects non-empty arguments with usage error", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify("browse takes no arguments.\n\nUsage: /claude:plugin browse", "error");
  }).thenReturn();

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("foo", ctx);

  // assert
  verify(ctx);
  verify(ui);
});

test("non-TUI mode falls back to the list subcommand handler", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers, mockList } = createMockActionHandlers();
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("json");
  when(() => mockList("", ctx)).thenResolve(undefined);

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("", ctx);

  // assert
  verify(ctx);
  verify(pi);
  verify(mockList);
});

test("TUI mode with no marketplaces emits structured (no marketplaces) notification", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "no-marketplaces");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd).thenReturn(scope.cwd);
  when(() => ctx.ui).thenReturn(ui);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(2);
  when(() => {
    ui.notify("(no marketplaces)");
  })
    .thenReturn()
    .times(1);

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("", ctx);

  // assert
  verify(ctx);
  verify(pi);
  verify(ui);
});

test("TUI mode with cancel (null result) invokes no action handler", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "tui-cancel");
  await seedMarketplace(scope.cwd, "official");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd)
    .thenReturn(scope.cwd)
    .times(2);
  when(() => ctx.ui).thenReturn(ui);

  const customFactory = It.willCapture<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>();
  when(() => ui.custom(customFactory)).thenResolve(null);

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("", ctx);

  // assert
  verify(ctx);
  verify(pi);
  verify(ui);
});

for (const { action, local, expectedHandler, expectedArgs } of [
  {
    action: "install" as const,
    local: true,
    expectedHandler: "mockInstall" as const,
    expectedArgs: "my-plugin@official --scope project --local",
  },
  {
    action: "install" as const,
    local: false,
    expectedHandler: "mockInstall" as const,
    expectedArgs: "my-plugin@official --scope user",
  },
  {
    action: "uninstall" as const,
    local: false,
    expectedHandler: "mockUninstall" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
  {
    action: "info" as const,
    local: false,
    expectedHandler: "mockPluginInfo" as const,
    expectedArgs: "my-plugin@official --scope user",
  },
  {
    action: "enable" as const,
    local: false,
    expectedHandler: "mockEnable" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
  {
    action: "disable" as const,
    local: false,
    expectedHandler: "mockDisable" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
]) {
  test(`TUI mode action dispatch: ${action} (local: ${String(local)}) dispatches to ${expectedHandler}`, async (t) => {
    // arrange
    const scope = await createHermeticScope(t, `dispatch-${action}-${String(local)}`);
    await seedMarketplace(scope.cwd, "official");
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    const actionMocks = createMockActionHandlers();
    const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
    const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
    when(() => ctx.mode).thenReturn("tui");
    when(() => ctx.cwd)
      .thenReturn(scope.cwd)
      .times(2);
    when(() => ctx.ui).thenReturn(ui);

    const pickerResult: PickerResult = {
      action,
      plugin: "my-plugin",
      marketplace: "official",
      scope: local ? "project" : action === "info" || action === "install" ? "user" : "project",
      ...(local && { local: true }),
    };

    const customFactory = It.willCapture<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>();
    when(() => ui.custom(customFactory)).thenResolve(pickerResult);

    when(() => actionMocks[expectedHandler](expectedArgs, ctx)).thenResolve(undefined);

    const browseHandler = makeBrowseHandler(pi, actionMocks.handlers);

    // act
    await browseHandler("", ctx);

    // assert
    verify(ctx);
    verify(pi);
    verify(ui);
    verify(actionMocks[expectedHandler]);
  });
}

test("TUI mode when loadMarketplaceEntries throws emits structured failure notification", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "load-err");
  const locations = locationsFor("project", scope.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(path.join(locations.extensionRoot, "state.json"), "invalid json");

  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd).thenReturn(scope.cwd);
  when(() => ctx.ui).thenReturn(ui);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(2);
  when(() => {
    ui.notify(It.isString(), "error");
  })
    .thenReturn()
    .times(1);

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("", ctx);

  // assert
  verify(ctx);
  verify(pi);
  verify(ui);
});

test("TUI mode exercises custom UI factory, render, invalidate, handleInput, and pluginLoader", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "factory-exercise");
  const pluginRecord = buildInstalledPluginRecord(
    { version: "1.0.0" },
    { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
  ) as unknown as MarketplaceRecord["plugins"][string];
  await seedMarketplace(scope.cwd, "official", { "test-plugin": pluginRecord });
  const manifestPath = marketplaceRecordIn(scope.cwd, "official").manifestPath;
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name: "official", plugins: [] }), "utf8");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd)
    .thenReturn(scope.cwd)
    .atLeast(2);
  when(() => ctx.ui).thenReturn(ui);

  const customFactory = It.willCapture<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>();
  when(() => ui.custom(customFactory)).thenResolve(null);

  const browseHandler = makeBrowseHandler(pi, handlers);

  // act
  await browseHandler("", ctx);

  // assert custom UI factory execution
  const factory = customFactory.value;
  assert.ok(factory !== undefined);
  let capturedResult: unknown;
  const mockTui = { requestRender: () => {} } as unknown as Parameters<typeof factory>[0];
  const mockTheme = {
    fg: (_c: string, s: string) => s,
    bold: (s: string) => s,
  } as unknown as Parameters<typeof factory>[1];
  const mockKb = {} as unknown as Parameters<typeof factory>[2];
  const comp = factory(mockTui, mockTheme, mockKb, (r: unknown) => {
    capturedResult = r;
  });
  assert.ok(comp !== null && typeof comp === "object" && !(comp instanceof Promise));
  assert.ok(Array.isArray(comp.render(80)));
  comp.invalidate();
  // Press Enter to open the marketplace and execute pluginLoader
  comp.handleInput?.("\r");
  await new Promise((resolve) => setTimeout(resolve, 50));
  // Press Enter to open actions for test-plugin
  comp.handleInput?.("\r");
  // Press Enter on first action (Uninstall) to trigger onSelect -> done(r)
  comp.handleInput?.("\r");
  assert.deepEqual(capturedResult, {
    action: "uninstall",
    plugin: "test-plugin",
    marketplace: "official",
    scope: "project",
  });

  // Also exercise onCancel -> done(null) on the marketplaces screen
  let cancelResult: unknown;
  const comp2 = factory(mockTui, mockTheme, mockKb, (r: unknown) => {
    cancelResult = r;
  });
  assert.ok(comp2 !== null && typeof comp2 === "object" && !(comp2 instanceof Promise));
  comp2.handleInput?.("\x1b");
  assert.equal(cancelResult, null);

  verify(ctx);
  verify(pi);
  verify(ui);
});

test("TUI mode pluginLoader fallback when marketplace block is missing", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "loader-fallback");
  await seedMarketplace(scope.cwd, "ghost");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd)
    .thenReturn(scope.cwd)
    .atLeast(2);
  when(() => ctx.ui).thenReturn(ui);

  const customFactory = It.willCapture<Parameters<ExtensionCommandContext["ui"]["custom"]>[0]>();
  when(() => ui.custom(customFactory)).thenResolve(null);

  const browseHandler = makeBrowseHandler(pi, handlers);
  await browseHandler("", ctx);

  const factory = customFactory.value;
  assert.ok(factory !== undefined);
  const mockTui = { requestRender: () => {} } as unknown as Parameters<typeof factory>[0];
  const mockTheme = {
    fg: (_c: string, s: string) => s,
    bold: (s: string) => s,
  } as unknown as Parameters<typeof factory>[1];
  const mockKb = {} as unknown as Parameters<typeof factory>[2];
  const comp = factory(mockTui, mockTheme, mockKb, () => {});
  assert.ok(comp !== null && typeof comp === "object" && !(comp instanceof Promise));

  // Remove state so loadPluginListPayload returns empty payload []
  const locations = locationsFor("project", scope.cwd);
  await rm(path.join(locations.extensionRoot, "state.json"));

  comp.handleInput?.("\r");
  await new Promise((resolve) => setTimeout(resolve, 50));

  verify(ctx);
  verify(pi);
  verify(ui);
});
