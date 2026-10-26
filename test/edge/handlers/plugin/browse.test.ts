// Owner for edge/handlers/plugin/browse.ts (MOD-09).
//
// Tests for the /claude:plugin browse shim:
//   - non-TUI refusal before list or marketplace work
//   - TUI mode with no marketplaces (diagnostic notification)
//   - TUI mode custom UI cancel
//   - TUI mode action dispatch for install (with/without --local), uninstall,
//     info, enable, disable

import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { It, mock, verify, when } from "strong-mock";

import {
  makeBrowseHandler,
  type BrowseActionHandlers,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createHermeticEnvironment } from "../../../platform/hermetic-environment.ts";
import { runWithNothingLoaded } from "../../../shared/notification-run-seeds.ts";
import { createJsonCapture } from "../../json-capture.ts";
import { createMachineNotificationBoundary } from "../../notification-boundary.ts";
import { buildInstalledPluginRecord, mergeMarketplaceIntoState } from "../marketplace-seed.ts";

import type { PickerResult } from "../../../../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";
import type { SubcommandHandler } from "../../../../extensions/pi-claude-marketplace/edge/router.ts";
import type { ExtensionState } from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionCommandContext } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];

interface HermeticScope {
  readonly cwd: string;
}

async function createHermeticScope(t: TestContext, name: string): Promise<HermeticScope> {
  const environment = await createHermeticEnvironment(t, `browse-test-${name}-`);
  return { cwd: environment.cwd };
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
  readonly installHandler: SubcommandHandler;
  readonly uninstallHandler: SubcommandHandler;
  readonly pluginInfoHandler: SubcommandHandler;
  readonly enableHandler: SubcommandHandler;
  readonly disableHandler: SubcommandHandler;
} {
  const installHandler = mock<SubcommandHandler>({
    exactParams: true,
    name: "install handler",
  });
  const uninstallHandler = mock<SubcommandHandler>({
    exactParams: true,
    name: "uninstall handler",
  });
  const pluginInfoHandler = mock<SubcommandHandler>({
    exactParams: true,
    name: "pluginInfo handler",
  });
  const enableHandler = mock<SubcommandHandler>({
    exactParams: true,
    name: "enable handler",
  });
  const disableHandler = mock<SubcommandHandler>({
    exactParams: true,
    name: "disable handler",
  });

  return {
    handlers: {
      install: installHandler,
      uninstall: uninstallHandler,
      pluginInfo: pluginInfoHandler,
      enable: enableHandler,
      disable: disableHandler,
    },
    installHandler,
    uninstallHandler,
    pluginInfoHandler,
    enableHandler,
    disableHandler,
  };
}

test("browse rejects non-empty arguments with usage error", async () => {
  // arrange
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify("browse takes no arguments.\n\nUsage: /claude:plugin browse", "error");
  }).thenReturn();

  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("foo", ctx, runWithNothingLoaded());

  // assert
  verify(ctx);
  verify(ui);
});

for (const { args, flag } of [
  { args: "--bogus", flag: "--bogus" },
  { args: "foo --scope user", flag: "--scope" },
]) {
  test(`browse rejects the flag in ${args} as an unknown flag`, async () => {
    // arrange
    const { handlers } = createMockActionHandlers();
    const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
    const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(1);
    when(() => ctx.ui).thenReturn(ui);
    when(() => {
      ui.notify(`Unknown flag: "${flag}".\n\nUsage: /claude:plugin browse`, "error");
    }).thenReturn();

    const browseHandler = makeBrowseHandler(handlers);

    // act
    await browseHandler(args, ctx, runWithNothingLoaded());

    // assert
    verify(ctx);
    verify(ui);
  });
}

for (const mode of ["json", "rpc"] as const) {
  test(`refuses browse in ${mode} before list, state, or picker access`, async () => {
    // arrange
    const capture = createJsonCapture();
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
    const handlers = mock<BrowseActionHandlers>({ exactParams: true, name: "browse actions" });
    const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
    when(() => ctx.mode)
      .thenReturn(mode)
      .times(2);
    const browseHandler = makeBrowseHandler(handlers);

    // act
    await browseHandler("", ctx, run);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "usage-error",
          severity: "error",
          needsReload: false,
          message: `Browse is unavailable in ${mode} mode. Use /claude:plugin list instead.`,
          usage: "Usage: /claude:plugin browse",
        },
      },
    ]);
    capture.assertValid();
    verify(ctx);
    verify(handlers);
  });
}

test("refuses browse in print with only the error and remedy before state or picker access", async () => {
  // arrange
  const handlers = mock<BrowseActionHandlers>({ exactParams: true, name: "browse actions" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  when(() => ctx.mode)
    .thenReturn("print")
    .times(2);
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => {
    ui.notify("Browse is unavailable in print mode. Use /claude:plugin list instead.", "error");
  })
    .thenReturn()
    .times(1);
  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("", ctx, runWithNothingLoaded());

  // assert
  verify(ctx);
  verify(ui);
  verify(handlers);
});

test("TUI mode with no marketplaces emits structured (no marketplaces) notification", async (t) => {
  // arrange
  const run = runWithNothingLoaded();
  const scope = await createHermeticScope(t, "no-marketplaces");
  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(2);
  when(() => ctx.cwd).thenReturn(scope.cwd);
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify("(no marketplaces)");
  })
    .thenReturn()
    .times(1);

  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("", ctx, run);

  // assert
  verify(ctx);
  verify(ui);
});

test("TUI mode with cancel (null result) invokes no action handler", async (t) => {
  // arrange
  const run = runWithNothingLoaded();
  const scope = await createHermeticScope(t, "tui-cancel");
  await seedMarketplace(scope.cwd, "official");
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

  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("", ctx, run);

  // assert
  verify(ctx);
  verify(ui);
});

for (const { action, local, expectedHandler, expectedArgs } of [
  {
    action: "install" as const,
    local: true,
    expectedHandler: "installHandler" as const,
    expectedArgs: "my-plugin@official --scope project --local",
  },
  {
    action: "install" as const,
    local: false,
    expectedHandler: "installHandler" as const,
    expectedArgs: "my-plugin@official --scope user",
  },
  {
    action: "uninstall" as const,
    local: false,
    expectedHandler: "uninstallHandler" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
  {
    action: "info" as const,
    local: false,
    expectedHandler: "pluginInfoHandler" as const,
    expectedArgs: "my-plugin@official --scope user",
  },
  {
    action: "enable" as const,
    local: false,
    expectedHandler: "enableHandler" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
  {
    action: "disable" as const,
    local: false,
    expectedHandler: "disableHandler" as const,
    expectedArgs: "my-plugin@official --scope project",
  },
]) {
  test(`TUI mode action dispatch: ${action} (local: ${String(local)}) dispatches to ${expectedHandler}`, async (t) => {
    // arrange
    const run = runWithNothingLoaded();
    const scope = await createHermeticScope(t, `dispatch-${action}-${String(local)}`);
    await seedMarketplace(scope.cwd, "official");
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

    when(() => actionMocks[expectedHandler](expectedArgs, ctx, run)).thenResolve(undefined);

    const browseHandler = makeBrowseHandler(actionMocks.handlers);

    // act
    await browseHandler("", ctx, run);

    // assert
    verify(ctx);
    verify(ui);
    verify(actionMocks[expectedHandler]);
  });
}

test("TUI mode when loadMarketplaceEntries throws emits structured failure notification", async (t) => {
  // arrange
  const run = runWithNothingLoaded();
  const scope = await createHermeticScope(t, "load-err");
  const locations = locationsFor("project", scope.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  await writeFile(path.join(locations.extensionRoot, "state.json"), "invalid json");

  const { handlers } = createMockActionHandlers();
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(2);
  when(() => ctx.cwd).thenReturn(scope.cwd);
  when(() => ctx.ui).thenReturn(ui);
  const capturedNotify = It.willCapture<string>();
  when(() => {
    ui.notify(capturedNotify, "error");
  })
    .thenReturn()
    .times(1);

  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("", ctx, run);

  // assert
  assert.ok(capturedNotify.value?.includes("(browse)"));
  assert.ok(capturedNotify.value?.includes("cause:"));
  verify(ctx);
  verify(ui);
});

test("TUI mode exercises custom UI factory, render, invalidate, handleInput, and pluginLoader", async (t) => {
  // arrange
  const run = runWithNothingLoaded();
  const scope = await createHermeticScope(t, "factory-exercise");
  const pluginRecord = buildInstalledPluginRecord(
    { version: "1.0.0" },
    { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [], workflows: [] },
  ) as unknown as MarketplaceRecord["plugins"][string];
  await seedMarketplace(scope.cwd, "official", { "test-plugin": pluginRecord });
  const manifestPath = marketplaceRecordIn(scope.cwd, "official").manifestPath;
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify({ name: "official", plugins: [] }), "utf8");

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

  const browseHandler = makeBrowseHandler(handlers);

  // act
  await browseHandler("", ctx, run);

  // assert custom UI factory execution
  const factory = customFactory.value;
  assert.ok(factory !== undefined);
  let capturedResult: unknown;
  const tui = { requestRender: () => {} } as unknown as Parameters<typeof factory>[0];
  const theme = {
    fg: (_c: string, s: string) => s,
    bold: (s: string) => s,
  } as unknown as Parameters<typeof factory>[1];
  const keybindings = {} as unknown as Parameters<typeof factory>[2];
  const comp = factory(tui, theme, keybindings, (r: unknown) => {
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
  const comp2 = factory(tui, theme, keybindings, (r: unknown) => {
    cancelResult = r;
  });
  assert.ok(comp2 !== null && typeof comp2 === "object" && !(comp2 instanceof Promise));
  comp2.handleInput?.("\x1b");
  assert.equal(cancelResult, null);

  verify(ctx);
  verify(ui);
});

test("TUI mode pluginLoader fallback when marketplace block is missing", async (t) => {
  // arrange
  const run = runWithNothingLoaded();
  const scope = await createHermeticScope(t, "loader-fallback");
  await seedMarketplace(scope.cwd, "ghost");

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

  const browseHandler = makeBrowseHandler(handlers);
  await browseHandler("", ctx, run);

  const factory = customFactory.value;
  assert.ok(factory !== undefined);
  const tui = { requestRender: () => {} } as unknown as Parameters<typeof factory>[0];
  const theme = {
    fg: (_c: string, s: string) => s,
    bold: (s: string) => s,
  } as unknown as Parameters<typeof factory>[1];
  const keybindings = {} as unknown as Parameters<typeof factory>[2];
  const comp = factory(tui, theme, keybindings, () => {});
  assert.ok(comp !== null && typeof comp === "object" && !(comp instanceof Promise));

  // Remove state so loadPluginListPayload returns empty payload []
  const locations = locationsFor("project", scope.cwd);
  await rm(path.join(locations.extensionRoot, "state.json"));

  comp.handleInput?.("\r");
  await new Promise((resolve) => setTimeout(resolve, 50));

  verify(ctx);
  verify(ui);
});

for (const mode of ["json", "rpc"] as const) {
  for (const { args, message } of [
    {
      args: "extra",
      message: "browse takes no arguments.",
    },
  ]) {
    test(`appends plugin/browse rejection for ${args} in ${mode} (enabled)`, async () => {
      // arrange
      const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
      const deps = mock<Parameters<typeof makeBrowseHandler>[0]>({
        exactParams: true,
        name: "handler dependencies",
      });
      const commandHandler = makeBrowseHandler(deps);

      // act
      await commandHandler(args, ctx, run);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "usage-error",
            severity: "error",
            needsReload: false,
            message,
            usage: "Usage: /claude:plugin browse",
          },
        },
      ]);
      capture.assertValid();
      verifyBoundary();
      verify(deps);
    });
  }
}
