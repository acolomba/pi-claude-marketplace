// Owner for edge/router.ts (MOD-09).
//
// AP-3: the subcommand router is a pure function over the handler record it is
// handed, so that record is a strict mock and every dispatch case states the one
// call it promises with both arguments written out. A misrouted subcommand fails
// on the unexpected member instead of passing quietly.
//
// D-116-06: every usage-error case builds the handler record with no stated
// expectation at all. A strict mock with nothing stated throws on its first
// call, so a green case is the proof that no handler ran; a stated count of zero
// would not be, because strong-mock treats that count as no limit.
//
// Every dispatch case sizes the Pi boundary at zero emissions, which is what
// makes a successful route provably silent. Every usage-error case sizes it at
// one emission and no soft-dependency probe, because notifyUsageError writes
// straight to the context and probes nothing.
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
// No case asserts the absence of direct process output -- ESLint and fallow own
// that -- and none restates the perma-forbidden-handler or hook-column fences
// owned by tests/architecture/scope-fences-63.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  MARKETPLACE_SUBCOMMANDS,
  MARKETPLACE_USAGE,
  routeClaudePlugin,
  TOP_LEVEL_SUBCOMMANDS,
  TOP_LEVEL_USAGE,
  type SubcommandHandlers,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";

import { createNotificationBoundary } from "./notification-boundary.ts";

type HandlerName = keyof SubcommandHandlers;

interface DispatchRow {
  readonly subcommand: string;
  readonly handler: HandlerName;
}

// The accepted top-level vocabulary, minus the one token that opens the second
// dispatch instead of reaching a handler. Each target member is written out by
// hand; none is read back off the router.
const TOP_LEVEL_DISPATCH: readonly DispatchRow[] = [
  { subcommand: "bootstrap", handler: "bootstrap" },
  { subcommand: "install", handler: "install" },
  { subcommand: "uninstall", handler: "uninstall" },
  { subcommand: "update", handler: "update" },
  { subcommand: "fetch", handler: "fetch" },
  { subcommand: "reinstall", handler: "reinstall" },
  { subcommand: "list", handler: "list" },
  { subcommand: "ls", handler: "list" },
  { subcommand: "info", handler: "pluginInfo" },
  { subcommand: "pending", handler: "pending" },
  { subcommand: "enable", handler: "enable" },
  { subcommand: "disable", handler: "disable" },
  { subcommand: "import", handler: "import" },
];

const MARKETPLACE_DISPATCH: readonly DispatchRow[] = [
  { subcommand: "add", handler: "marketplaceAdd" },
  { subcommand: "remove", handler: "marketplaceRemove" },
  { subcommand: "rm", handler: "marketplaceRemove" },
  { subcommand: "list", handler: "marketplaceList" },
  { subcommand: "ls", handler: "marketplaceList" },
  { subcommand: "info", handler: "marketplaceInfo" },
  { subcommand: "update", handler: "marketplaceUpdate" },
  { subcommand: "autoupdate", handler: "marketplaceAutoupdate" },
  { subcommand: "noautoupdate", handler: "marketplaceNoautoupdate" },
];

const EXPECTED_TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <bootstrap|install|uninstall|update|fetch|reinstall|list|ls|info|pending|enable|disable|import|marketplace> ...\n" +
  "  bootstrap                                          add anthropics/claude-plugins-official to user scope and enable autoupdate\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  fetch [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  list [<marketplace>] [--scope user|project]   (alias: ls)\n" +
  "  info <plugin>@<marketplace> [--scope user|project]\n" +
  "  pending [--scope user|project]\n" +
  "  enable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  disable <plugin>@<marketplace> [--scope user|project] [--local]\n" +
  "  import [--scope user|project]\n" +
  "  marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...";

const EXPECTED_MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|rm|list|ls|info|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project]\n" +
  "  remove <name> [--scope user|project]   (alias: rm)\n" +
  "  list [--scope user|project]            (alias: ls)\n" +
  "  info <name> [--scope user|project]\n" +
  "  update [<name>] [--scope user|project]\n" +
  "  autoupdate [<name>] [--scope user|project]\n" +
  "  noautoupdate [<name>] [--scope user|project]";

for (const { subcommand, handler } of TOP_LEVEL_DISPATCH) {
  test(`dispatches ${subcommand} to the ${handler} handler with the remaining argument text (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers[handler]("alpha@official --scope user", ctx)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`${subcommand} alpha@official --scope user`, handlers, ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

for (const { subcommand, handler } of MARKETPLACE_DISPATCH) {
  test(`dispatches the marketplace ${subcommand} subcommand to the ${handler} handler with the remaining argument text (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers[handler]("official --scope user", ctx)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`marketplace ${subcommand} official --scope user`, handlers, ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

test("accepts exactly the top-level names its dispatch rows serve, plus the marketplace entry token", () => {
  // arrange
  const expectedVocabulary = [...TOP_LEVEL_DISPATCH.map((row) => row.subcommand), "marketplace"];

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

test("routes the ls alias and the list subcommand to one and the same plugin list handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.list("official --scope user", ctx))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("list official --scope user", handlers, ctx);
  await routeClaudePlugin("ls official --scope user", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("routes the marketplace rm alias and the remove subcommand to one and the same handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceRemove("official --scope user", ctx))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("marketplace remove official --scope user", handlers, ctx);
  await routeClaudePlugin("marketplace rm official --scope user", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("routes the marketplace ls alias and the list subcommand to one and the same handler", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceList("--scope user", ctx))
    .thenResolve(undefined)
    .times(2);

  // act
  await routeClaudePlugin("marketplace list --scope user", handlers, ctx);
  await routeClaudePlugin("marketplace ls --scope user", handlers, ctx);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
    when(() => handlers[topLevelHandler]("official", ctx)).thenResolve(undefined);
    when(() => handlers[marketplaceHandler]("official", ctx)).thenResolve(undefined);

    // act
    await routeClaudePlugin(`${subcommand} official`, handlers, ctx);
    await routeClaudePlugin(`marketplace ${subcommand} official`, handlers, ctx);

    // assert
    assert.deepStrictEqual(notifications, []);
    verifyBoundary();
    verify(handlers);
  });
}

test("strips the whitespace run after the subcommand and leaves the interior of the remainder alone", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install("alpha@official   --scope   user", ctx)).thenResolve(undefined);

  // act
  await routeClaudePlugin("install   alpha@official   --scope   user", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("strips whitespace that precedes the subcommand", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install("alpha@official", ctx)).thenResolve(undefined);

  // act
  await routeClaudePlugin("   install alpha@official", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the quotes and flags of the remainder to the handler untouched", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.install('"my plugin"@official --scope user --local', ctx)).thenResolve(
    undefined,
  );

  // act
  await routeClaudePlugin('install "my plugin"@official --scope user --local', handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the handler an empty argument text when the subcommand carries no remainder", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.bootstrap("", ctx)).thenResolve(undefined);

  // act
  await routeClaudePlugin("bootstrap", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("hands the handler an empty argument text when the subcommand is followed only by whitespace", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.bootstrap("", ctx)).thenResolve(undefined);

  // act
  await routeClaudePlugin("bootstrap   ", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

test("peels the marketplace token and its subcommand in turn, keeping the interior of what is left", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(0, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });
  when(() => handlers.marketplaceAdd("gh:owner/repo   --scope user", ctx)).thenResolve(undefined);

  // act
  await routeClaudePlugin("marketplace   add   gh:owner/repo   --scope user", handlers, ctx);

  // assert
  assert.deepStrictEqual(notifications, []);
  verifyBoundary();
  verify(handlers);
});

for (const { input, shape } of [
  { input: "", shape: "no characters at all" },
  { input: "   ", shape: "nothing but whitespace" },
]) {
  test(`reports a usage error with the top-level usage block for input with ${shape} (AP-3)`, async () => {
    // arrange
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

    // act
    await routeClaudePlugin(input, handlers, ctx);

    // assert
    assert.deepStrictEqual(notifications, [
      { message: `Usage error.\n\n${EXPECTED_TOP_LEVEL_USAGE}`, severity: "error" },
    ]);
    verifyBoundary();
    verify(handlers);
  });
}

test("names an unrecognized top-level token back to the operator with the top-level usage block (AP-3)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

  // act
  await routeClaudePlugin("unknownverb alpha@official", handlers, ctx);

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
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
    const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

    // act
    await routeClaudePlugin(input, handlers, ctx);

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

test("names an unrecognized marketplace token back to the operator with the marketplace usage block (AP-3)", async () => {
  // arrange
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1, 0);
  const handlers = mock<SubcommandHandlers>({ exactParams: true, name: "subcommand handlers" });

  // act
  await routeClaudePlugin("marketplace bogus official", handlers, ctx);

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

test("publishes the top-level usage block for the surfaces that render it", () => {
  // arrange
  const expectedUsage = EXPECTED_TOP_LEVEL_USAGE;

  // act
  const publishedUsage = TOP_LEVEL_USAGE;

  // assert
  assert.deepStrictEqual(publishedUsage, expectedUsage);
});

test("publishes the marketplace usage block for the surfaces that render it", () => {
  // arrange
  const expectedUsage = EXPECTED_MARKETPLACE_USAGE;

  // act
  const publishedUsage = MARKETPLACE_USAGE;

  // assert
  assert.deepStrictEqual(publishedUsage, expectedUsage);
});
