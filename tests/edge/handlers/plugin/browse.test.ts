// Owner for edge/handlers/plugin/browse.ts (MOD-09).
//
// Tests for the /claude:plugin browse shim:
//   - non-TUI fallback to list subcommand
//   - TUI mode with no marketplaces (diagnostic notification)
//   - TUI mode custom UI cancel
//   - TUI mode action dispatch for install (with/without --local), uninstall,
//     info, enable, disable

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import {
  makeBrowseHandler,
  type BrowseActionHandlers,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { mergeMarketplaceIntoState } from "../marketplace-seed.ts";

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

function marketplaceRecordIn(root: string, marketplaceName: string): MarketplaceRecord {
  const marketplaceRoot = path.join(root, "marketplaces", marketplaceName);
  return {
    name: marketplaceName,
    scope: "project",
    source: { kind: "path", raw: marketplaceRoot },
    addedFromCwd: root,
    manifestPath: path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    marketplaceRoot,
    plugins: {},
  };
}

async function seedMarketplace(cwd: string, marketplaceName: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await mergeMarketplaceIntoState(
    locations.extensionRoot,
    marketplaceName,
    marketplaceRecordIn(cwd, marketplaceName),
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

test("TUI mode with no marketplaces emits a diagnostic notification", async (t) => {
  // arrange
  const scope = await createHermeticScope(t, "no-marketplaces");
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode).thenReturn("tui");
  when(() => ctx.cwd).thenReturn(scope.cwd);
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify(
      "/claude:plugin browse\n\nNo marketplaces configured.\nAdd one with: /claude:plugin marketplace add <source>",
      "warning",
    );
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
