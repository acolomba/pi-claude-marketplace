// Owner for edge/router.ts (MOD-09).
//
// AP-3: the subcommand router is a pure function over the handler record it is
// handed, so that record is a strict mock and every dispatch case states the one
// call it promises with all three arguments written out: the remaining text, the
// context, and the command's notification run (D-05). A misrouted subcommand
// fails on the unexpected member instead of passing quietly.
//
// D-116-06: every usage-error case builds the handler record with no stated
// expectation at all. A strict mock with nothing stated throws on its first
// call, so a green case is the proof that no handler ran; a stated count of zero
// would not be, because strong-mock treats that count as no limit.
//
// Every dispatch case sizes the Pi boundary at zero emissions, which is what
// makes a successful route provably silent. Every usage-error case sizes it at
// one emission, because notifyUsageError writes straight to the context.
//
// No exhaustiveness claim. Both switch statements turn on an open string peeled
// from raw user input and both carry a default arm, so removing an arm is a
// behavior change rather than a compiler diagnostic. A missing-arm plant has no
// target here and none was attempted: what catches a removed arm is the row
// table below, through the usage error the router would start emitting instead.
//
// The two usage blocks are written out by hand here rather than read back off
// the module, so each emission assertion pins the real text instead of passing
// for any text. They are compared against the module's own exported constants in
// their own cases, because those constants are part of the surface this pair
// owns: the completion provider reads the subcommand lists beside them.
//
// No case asserts the absence of direct process output -- fallow owns
// that -- and none restates the perma-forbidden-handler or hook-column fences
// owned by test/architecture/scope-fences-63.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  MARKETPLACE_SUBCOMMANDS,
  MARKETPLACE_USAGE,
  marketplaceUsage,
  routeClaudePlugin,
  selectClaudePluginRoute,
  TOP_LEVEL_SUBCOMMANDS,
  TOP_LEVEL_USAGE,
  type MarketplaceVerb,
  type SubcommandHandlers,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";
import { notify } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import { createJsonCapture } from "./json-capture.ts";
import { createNotificationBoundary } from "./notification-boundary.ts";
import { createMachineNotificationBoundary } from "./notification-boundary.ts";

import type { ExtensionCommandContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("executes a selected list route without selecting its handler again", async () => {
  // arrange
  const { ctx, run, capture, verifyBoundary } = createMachineNotificationBoundary("json");
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "handlers" });
  when(() => handlers.list)
    .thenReturn((args, handlerCtx, handlerRun) => {
      assert.strictEqual(args, "--scope project");
      assert.strictEqual(handlerCtx, ctx);
      assert.strictEqual(handlerRun, run);
      notify(handlerCtx, handlerRun, { marketplaces: [] });
      return Promise.resolve();
    })
    .times(1);
  const route = selectClaudePluginRoute("ls --scope project", handlers);

  // act
  await routeClaudePlugin(route, handlers, ctx, run);

  // assert
  assert.strictEqual(route.commandId, "plugin list");
  assert.deepStrictEqual(capture.entries, [
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        kind: "cascade",
        severity: "info",
        needsReload: false,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        marketplaces: [],
      },
    },
  ]);
  capture.assertValid();
  verifyBoundary();
  verify(handlers);
});

const EXPECTED_TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|prune|update|fetch|reinstall|list|ls|info|pending|apply|enable|disable|import|browse|marketplace|help> ...\n" +
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope and enable autoupdate\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local] [--prune]\n" +
  "  prune [--scope user|project] [--dry-run]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  list [<marketplace>] [--scope user|project]   (alias: ls)\n" +
  "  info <plugin>@<marketplace> [--scope user|project]\n" +
  "  pending [--scope user|project]\n" +
  "  apply [--scope user|project]\n" +
  "  enable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  disable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  import [--scope user|project]\n" +
  "  browse\n" +
  "  marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  help [marketplace]";

test("preserves ordered duplicate rejections around a handler emission on the same run", async () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn("json")
    .times(1);
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "handlers" });
  when(() => handlers.list).thenReturn((args, handlerCtx, handlerRun) => {
    assert.strictEqual(args, "");
    assert.strictEqual(handlerCtx, ctx);
    assert.strictEqual(handlerRun, run);
    notify(handlerCtx, handlerRun, { marketplaces: [] });
    return Promise.resolve();
  });

  // act
  await routeClaudePlugin("unknown", handlers, ctx, run);
  when(() => ctx.mode)
    .thenReturn("rpc")
    .times(3);
  await routeClaudePlugin("list", handlers, ctx, run);
  await routeClaudePlugin("unknown", handlers, ctx, run);
  await routeClaudePlugin("unknown", handlers, ctx, run);

  // assert
  const expectedUsageEntry = {
    customType: "claude-plugin",
    payload: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-error",
      severity: "error",
      needsReload: false,
      message: 'Unknown subcommand: "unknown".',
      usage: EXPECTED_TOP_LEVEL_USAGE,
    },
  };
  assert.deepStrictEqual(capture.entries, [
    expectedUsageEntry,
    {
      customType: "claude-plugin",
      payload: {
        schemaVersion: 1,
        origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
        kind: "cascade",
        severity: "info",
        needsReload: false,
        marketplaces: [],
      },
    },
    expectedUsageEntry,
    expectedUsageEntry,
  ]);
  capture.assertValid();
  verify(ctx);
  verify(handlers);
});

test("appends a complete unknown-command usage error in json", async () => {
  // arrange
  const capture = createJsonCapture();
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn("json")
    .times(1);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

  // act
  await routeClaudePlugin("unknownverb", handlers, ctx, run);

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
        message: 'Unknown subcommand: "unknownverb".',
        usage: EXPECTED_TOP_LEVEL_USAGE,
      },
    },
  ]);
  capture.assertValid();
  verify(ctx);
  verify(handlers);
});

type HandlerName = keyof SubcommandHandlers;

test("selects marketplace help when the complete trimmed help topic matches", () => {
  // arrange
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "handlers" });
  const help = (): Promise<void> => Promise.resolve();
  when(() => handlers.help)
    .thenReturn(help)
    .times(1);

  // act
  const route = selectClaudePluginRoute("help  marketplace  ", handlers);

  // assert
  assert.deepStrictEqual(route, {
    commandId: "marketplace help",
    handler: help,
    args: "marketplace  ",
  });
  verify(handlers);
});

interface DispatchRow {
  readonly subcommand: string;
  readonly handler: HandlerName;
  readonly commandId: string;
  readonly expectedArgs?: string;
  /** Operand text this row is driven with, for a verb the shared one is invalid for. */
  readonly operand?: string;
}

// The accepted top-level vocabulary, minus the one token that opens the second
// dispatch instead of reaching a handler. Each target member is written out by
// hand; none is read back off the router.
const TOP_LEVEL_DISPATCH: readonly DispatchRow[] = [
  { subcommand: "bootstrap", handler: "bootstrap", commandId: "plugin bootstrap" },
  { subcommand: "install", handler: "install", commandId: "plugin install" },
  { subcommand: "uninstall", handler: "uninstall", commandId: "plugin uninstall" },
  { subcommand: "prune", handler: "prune", commandId: "plugin prune" },
  { subcommand: "update", handler: "update", commandId: "plugin update" },
  { subcommand: "fetch", handler: "fetch", commandId: "plugin fetch" },
  { subcommand: "reinstall", handler: "reinstall", commandId: "plugin reinstall" },
  { subcommand: "list", handler: "list", commandId: "plugin list" },
  { subcommand: "ls", handler: "list", commandId: "plugin list" },
  { subcommand: "info", handler: "pluginInfo", commandId: "plugin info" },
  { subcommand: "pending", handler: "pending", commandId: "plugin pending" },
  { subcommand: "apply", handler: "pluginApply", commandId: "plugin apply" },
  { subcommand: "enable", handler: "enable", commandId: "plugin enable" },
  { subcommand: "disable", handler: "disable", commandId: "plugin disable" },
  { subcommand: "import", handler: "import", commandId: "plugin import" },
  { subcommand: "browse", handler: "browse", commandId: "plugin browse" },
  { subcommand: "help", handler: "help", commandId: "plugin help" },
];

const MARKETPLACE_DISPATCH: readonly DispatchRow[] = [
  { subcommand: "add", handler: "marketplaceAdd", commandId: "marketplace add" },
  { subcommand: "remove", handler: "marketplaceRemove", commandId: "marketplace remove" },
  { subcommand: "rm", handler: "marketplaceRemove", commandId: "marketplace remove" },
  { subcommand: "list", handler: "marketplaceList", commandId: "marketplace list" },
  { subcommand: "ls", handler: "marketplaceList", commandId: "marketplace list" },
  { subcommand: "info", handler: "marketplaceInfo", commandId: "marketplace info" },
  { subcommand: "update", handler: "marketplaceUpdate", commandId: "marketplace update" },
  {
    subcommand: "autoupdate",
    handler: "marketplaceAutoupdate",
    commandId: "marketplace autoupdate",
  },
  {
    subcommand: "noautoupdate",
    handler: "marketplaceNoautoupdate",
    commandId: "marketplace noautoupdate",
  },
  // The spelling fixes the topic, so this row carries no operand of its own --
  // and the router rejects one rather than discarding it.
  {
    subcommand: "help",
    handler: "help",
    commandId: "marketplace help",
    expectedArgs: "marketplace",
    operand: "",
  },
];

const EXPECTED_MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project] [--local]\n" +
  "  remove <name> [--scope user|project] [--local]   (alias: rm)\n" +
  "  list [--scope user|project]                      (alias: ls)\n" +
  "  info <name> [--scope user|project]\n" +
  "  update [<name>] [--scope user|project]\n" +
  "  autoupdate [<name>] [--scope user|project] [--local]\n" +
  "  noautoupdate [<name>] [--scope user|project] [--local]";

for (const mode of ["json", "rpc"] as const) {
  const spellings: readonly DispatchRow[] = [
    ...TOP_LEVEL_DISPATCH,
    ...MARKETPLACE_DISPATCH.map((row) => ({ ...row, subcommand: `marketplace ${row.subcommand}` })),
    { subcommand: "", handler: "browse", commandId: "plugin browse" },
    { subcommand: " \t ", handler: "browse", commandId: "plugin browse" },
    {
      subcommand: "help marketplace",
      handler: "help",
      commandId: "marketplace help",
      expectedArgs: "marketplace",
    },
    {
      subcommand: 'help "marketplace"',
      handler: "help",
      commandId: "marketplace help",
      expectedArgs: '"marketplace"',
    },
    {
      subcommand: "help marketplace extra",
      handler: "help",
      commandId: "plugin help",
      expectedArgs: "marketplace extra",
    },
    {
      subcommand: "help invalid",
      handler: "help",
      commandId: "plugin help",
      expectedArgs: "invalid",
    },
  ];
  for (const { subcommand, handler, commandId, expectedArgs } of spellings) {
    test(`attributes ${JSON.stringify(subcommand)} to ${commandId} in ${mode}`, async () => {
      // arrange
      const { ctx, run: seed, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
      const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "handlers" });
      when(() => handlers[handler]).thenReturn((args, handlerCtx, handlerRun) => {
        assert.strictEqual(args, expectedArgs ?? "");
        notify(handlerCtx, handlerRun, { marketplaces: [] });
        return Promise.resolve();
      });
      const selected = selectClaudePluginRoute(subcommand, handlers);
      const run = {
        ...seed,
        origin: {
          kind: "command",
          commandId: selected.commandId,
          invocationId: "route-run",
        } as const,
      };

      // act
      await routeClaudePlugin(selected, handlers, ctx, run);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            kind: "cascade",
            severity: "info",
            needsReload: false,
            origin: { kind: "command", commandId, invocationId: "route-run" },
            marketplaces: [],
          },
        },
      ]);
      capture.assertValid();
      verifyBoundary();
      verify(handlers);
    });
  }
}

for (const { subcommand, handler } of TOP_LEVEL_DISPATCH) {
  test(`dispatches ${subcommand} to the ${handler} handler with the remaining argument text (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers[handler]("alpha@official --scope user", ctx, run)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`${subcommand} alpha@official --scope user`, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

for (const { subcommand, handler, expectedArgs, operand } of MARKETPLACE_DISPATCH) {
  test(`dispatches the marketplace ${subcommand} subcommand to the ${handler} handler with the remaining argument text (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    const driven = operand ?? "official --scope user";
    const forwardArg = expectedArgs ?? driven;
    when(() => handlers[handler](forwardArg, ctx, run)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`marketplace ${subcommand} ${driven}`, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

test("accepts exactly the top-level names its dispatch rows serve, plus the marketplace entry token", () => {
  // arrange
  const expectedVocabulary = [
    ...TOP_LEVEL_DISPATCH.slice(0, -1).map((row) => row.subcommand),
    "marketplace",
    TOP_LEVEL_DISPATCH[TOP_LEVEL_DISPATCH.length - 1]!.subcommand,
  ];

  // act
  const vocabulary = [...TOP_LEVEL_SUBCOMMANDS];

  // assert
  assert.deepStrictEqual(vocabulary, expectedVocabulary);
});

test("accepts exactly the marketplace names its dispatch rows serve", () => {
  // arrange
  const expectedVocabulary = MARKETPLACE_DISPATCH.map((row) => row.subcommand);

  // act
  const vocabulary = [...MARKETPLACE_SUBCOMMANDS];

  // assert
  assert.deepStrictEqual(vocabulary, expectedVocabulary);
});

test("spells every marketplace name except help in both help headers", () => {
  // arrange
  const spellings = MARKETPLACE_SUBCOMMANDS.filter((name) => name !== "help").join("|");

  // act
  const headers = [
    MARKETPLACE_USAGE.split("\n")[0],
    TOP_LEVEL_USAGE.split("\n").find((line) => line.startsWith("  marketplace ")),
  ];

  // assert
  assert.deepStrictEqual(headers, [
    `Usage: /claude:plugin marketplace <${spellings}> ...`,
    `  marketplace <${spellings}> ...`,
  ]);
});

for (const { verb, expectedUsage } of [
  {
    verb: "add",
    expectedUsage:
      "Usage: /claude:plugin marketplace add <source> [--scope user|project] [--local]",
  },
  {
    verb: "remove",
    expectedUsage:
      "Usage: /claude:plugin marketplace <remove|rm> <name> [--scope user|project] [--local]",
  },
  {
    verb: "list",
    expectedUsage: "Usage: /claude:plugin marketplace <list|ls> [--scope user|project]",
  },
  {
    verb: "info",
    expectedUsage: "Usage: /claude:plugin marketplace info <name> [--scope user|project]",
  },
  {
    verb: "update",
    expectedUsage: "Usage: /claude:plugin marketplace update [<name>] [--scope user|project]",
  },
  {
    verb: "autoupdate",
    expectedUsage:
      "Usage: /claude:plugin marketplace autoupdate [<name>] [--scope user|project] [--local]",
  },
  {
    verb: "noautoupdate",
    expectedUsage:
      "Usage: /claude:plugin marketplace noautoupdate [<name>] [--scope user|project] [--local]",
  },
] satisfies readonly { verb: MarketplaceVerb; expectedUsage: string }[]) {
  test(`gives marketplace ${verb} its own usage line: ${expectedUsage}`, () => {
    // arrange
    const marketplaceVerb = verb;

    // act
    const usage = marketplaceUsage(marketplaceVerb);

    // assert
    assert.strictEqual(usage, expectedUsage);
  });
}

test("routes the marketplace help subcommand to handlers.help with marketplace topic", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.help("marketplace", ctx, run)).thenResolve(undefined);

  // act
  await routeClaudePlugin("marketplace help", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("routes the ls alias and the list subcommand to one and the same plugin list handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.list("official --scope user", ctx, run))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("list official --scope user", handlers, ctx, run);
  await routeClaudePlugin("ls official --scope user", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("routes the marketplace rm alias and the remove subcommand to one and the same handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceRemove("official --scope user", ctx, run))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("marketplace remove official --scope user", handlers, ctx, run);
  await routeClaudePlugin("marketplace rm official --scope user", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("routes the marketplace ls alias and the list subcommand to one and the same handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceList("--scope user", ctx, run))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("marketplace list --scope user", handlers, ctx, run);
  await routeClaudePlugin("marketplace ls --scope user", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

// The four names both vocabularies spell. Neither dispatch shadows the other:
// the same token reaches a different member depending on which one reads it.
for (const { subcommand, topLevelHandler, marketplaceHandler } of [
  { subcommand: "list", topLevelHandler: "list", marketplaceHandler: "marketplaceList" },
  { subcommand: "ls", topLevelHandler: "list", marketplaceHandler: "marketplaceList" },
  { subcommand: "info", topLevelHandler: "pluginInfo", marketplaceHandler: "marketplaceInfo" },
  { subcommand: "update", topLevelHandler: "update", marketplaceHandler: "marketplaceUpdate" },
] satisfies readonly {
  subcommand: string;
  topLevelHandler: HandlerName;
  marketplaceHandler: HandlerName;
}[]) {
  test(`reads ${subcommand} as the ${topLevelHandler} handler at the top level and as the ${marketplaceHandler} handler behind the marketplace token`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers[topLevelHandler]("official", ctx, run)).thenResolve(undefined);
    when(() => handlers[marketplaceHandler]("official", ctx, run)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`${subcommand} official`, handlers, ctx, run);
    await routeClaudePlugin(`marketplace ${subcommand} official`, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

test("strips the whitespace run after the subcommand and leaves the interior of the remainder alone", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install("alpha@official   --scope   user", ctx, run)).thenResolve(undefined);

  // act
  await routeClaudePlugin("install   alpha@official   --scope   user", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("strips whitespace that precedes the subcommand", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install("alpha@official", ctx, run)).thenResolve(undefined);

  // act
  await routeClaudePlugin("   install alpha@official", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the quotes and flags of the remainder to the handler untouched", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install('"my plugin"@official --scope user --local', ctx, run)).thenResolve(
    undefined,
  );

  // act
  await routeClaudePlugin('install "my plugin"@official --scope user --local', handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the handler an empty argument text when the subcommand carries no remainder", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.bootstrap("", ctx, run)).thenResolve(undefined);

  // act
  await routeClaudePlugin("bootstrap", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the handler an empty argument text when the subcommand is followed only by whitespace", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.bootstrap("", ctx, run)).thenResolve(undefined);

  // act
  await routeClaudePlugin("bootstrap   ", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("peels the marketplace token and its subcommand in turn, keeping the interior of what is left", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceAdd("gh:owner/repo   --scope user", ctx, run)).thenResolve(
    undefined,
  );

  // act
  await routeClaudePlugin("marketplace   add   gh:owner/repo   --scope user", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

for (const { input, shape } of [
  { input: "", shape: "no characters at all" },
  { input: "   ", shape: "nothing but whitespace" },
]) {
  test(`dispatches to the browse handler for input with ${shape} (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers.browse("", ctx, run)).thenResolve(undefined);

    // act
    await routeClaudePlugin(input, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

test("names an unrecognized top-level token back to the operator with the top-level usage block (AP-3)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

  // act
  await routeClaudePlugin("unknownverb alpha@official", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Unknown subcommand: "unknownverb".\n\n${EXPECTED_TOP_LEVEL_USAGE}`,
      severity: "error",
    },
  ]);
  verifyBoundary();
  verify(handlers);
});

for (const { input, shape } of [
  { input: "marketplace", shape: "nothing after the marketplace token" },
  { input: "marketplace   ", shape: "nothing but whitespace after the marketplace token" },
]) {
  test(`reports that marketplace needs a subcommand, with the marketplace usage block, for input with ${shape} (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

    // act
    await routeClaudePlugin(input, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: `marketplace requires a subcommand.\n\n${EXPECTED_MARKETPLACE_USAGE}`,
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(handlers);
  });
}

test("refuses an argument after marketplace help rather than discarding it (AP-3)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

  // act
  await routeClaudePlugin("marketplace help official", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: "marketplace help takes no arguments.\n\nUsage: /claude:plugin marketplace help",
      severity: "error",
    },
  ]);
  verifyBoundary();
  verify(handlers);
});

for (const args of ["--bogus", "official --bogus"]) {
  test(`MPA-03: names the flag in marketplace help ${args} as help marketplace does`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const run = runWithNothingLoaded();
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

    // act
    await routeClaudePlugin(`marketplace help ${args}`, handlers, ctx, run);

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: 'Unknown flag: "--bogus".\n\nUsage: /claude:plugin marketplace help',
        severity: "error",
      },
    ]);
    verifyBoundary();
    verify(handlers);
  });
}

test("names an unrecognized marketplace token back to the operator with the marketplace usage block (AP-3)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

  // act
  await routeClaudePlugin("marketplace bogus official", handlers, ctx, run);

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message: `Unknown marketplace subcommand: "bogus".\n\n${EXPECTED_MARKETPLACE_USAGE}`,
      severity: "error",
    },
  ]);
  verifyBoundary();
  verify(handlers);
});

for (const mode of ["json", "rpc"] as const) {
  for (const { args, message, usage, commandId } of [
    {
      args: "unknown",
      commandId: "plugin",
      message: 'Unknown subcommand: "unknown".',
      usage: EXPECTED_TOP_LEVEL_USAGE,
    },
    {
      args: "marketplace",
      commandId: "marketplace",
      message: "marketplace requires a subcommand.",
      usage: EXPECTED_MARKETPLACE_USAGE,
    },
    {
      args: "marketplace unknown",
      commandId: "marketplace",
      message: 'Unknown marketplace subcommand: "unknown".',
      usage: EXPECTED_MARKETPLACE_USAGE,
    },
    {
      args: "marketplace help extra",
      commandId: "marketplace help",
      message: "marketplace help takes no arguments.",
      usage: "Usage: /claude:plugin marketplace help",
    },
  ]) {
    test(`appends router rejection for ${args} in ${mode}`, async () => {
      // arrange
      const { ctx, run: seed, capture, verifyBoundary } = createMachineNotificationBoundary(mode);
      const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "handlers" });
      const selected = selectClaudePluginRoute(args, handlers);
      const run = {
        ...seed,
        origin: {
          kind: "command",
          commandId: selected.commandId,
          invocationId: "rejected-run",
        } as const,
      };

      // act
      await routeClaudePlugin(selected, handlers, ctx, run);

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId, invocationId: "rejected-run" },
            kind: "usage-error",
            severity: "error",
            needsReload: false,
            message,
            usage,
          },
        },
      ]);
      capture.assertValid();
      verifyBoundary();
      verify(handlers);
    });
  }
}
