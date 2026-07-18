// tests/edge/router.test.ts
//
// AP-3 + dispatch + TC-2 alias coverage for routeClaudePlugin /
// routeMarketplace. The router is a pure function of
// `(args, handlers, ctx)`, so these tests instantiate handlers as spies,
// build a notify-recording `ctx`, and assert directly on the recorded
// state.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MARKETPLACE_USAGE,
  routeClaudePlugin,
  TOP_LEVEL_SUBCOMMANDS,
  TOP_LEVEL_USAGE,
  type SubcommandHandlers,
} from "../../extensions/pi-claude-marketplace/edge/router.ts";

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

interface HandlerCall {
  name: keyof SubcommandHandlers;
  args: string;
}

function makeHandlers(): { handlers: SubcommandHandlers; calls: HandlerCall[] } {
  const calls: HandlerCall[] = [];
  const mk =
    (name: keyof SubcommandHandlers) =>
    (args: string): Promise<void> => {
      calls.push({ name, args });
      return Promise.resolve();
    };

  const handlers: SubcommandHandlers = {
    bootstrap: mk("bootstrap"),
    install: mk("install"),
    uninstall: mk("uninstall"),
    update: mk("update"),
    fetch: mk("fetch"),
    reinstall: mk("reinstall"),
    list: mk("list"),
    pluginInfo: mk("pluginInfo"),
    pending: mk("pending"),
    enable: mk("enable"),
    disable: mk("disable"),
    import: mk("import"),
    marketplaceAdd: mk("marketplaceAdd"),
    marketplaceRemove: mk("marketplaceRemove"),
    marketplaceList: mk("marketplaceList"),
    marketplaceInfo: mk("marketplaceInfo"),
    marketplaceUpdate: mk("marketplaceUpdate"),
    marketplaceAutoupdate: mk("marketplaceAutoupdate"),
    marketplaceNoautoupdate: mk("marketplaceNoautoupdate"),
  };
  return { handlers, calls };
}

test("AP-3 :: empty input emits TOP_LEVEL_USAGE at error severity", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("", handlers, ctx);
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  // notifyUsageError emits `${message}\n\n${usageBlock}` -- assert the
  // Usage block is present in the surfaced message.
  assert.ok(notifications[0]?.message.includes(TOP_LEVEL_USAGE));
  // RINST-01 / D-67-03: the reinstall help line no longer advertises
  // `[--force]` (overwrite is unconditional; `--force` errors as unknown).
  assert.ok(
    TOP_LEVEL_USAGE.includes(
      "reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n",
    ),
  );
  assert.doesNotMatch(TOP_LEVEL_USAGE, /reinstall.*\[--force\]/);
  assert.ok(notifications[0]?.message.includes("import"));
});

test("AP-3 :: unknown subcommand emits Unknown subcommand: + TOP_LEVEL_USAGE at error severity", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("unknownverb foo", handlers, ctx);
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  assert.ok(notifications[0]?.message.startsWith('Unknown subcommand: "unknownverb".'));
  assert.ok(notifications[0]?.message.includes(TOP_LEVEL_USAGE));
});

test("AP-3 :: marketplace with empty rest emits MARKETPLACE_USAGE at error severity", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace", handlers, ctx);
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  assert.ok(notifications[0]?.message.includes(MARKETPLACE_USAGE));
});

test("AP-3 :: marketplace with unknown verb emits Unknown subcommand: + MARKETPLACE_USAGE", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace bogus arg", handlers, ctx);
  assert.deepEqual(calls, []);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.severity, "error");
  assert.ok(notifications[0]?.message.startsWith('Unknown marketplace subcommand: "bogus".'));
  assert.ok(notifications[0]?.message.includes(MARKETPLACE_USAGE));
});

test("routeClaudePlugin :: dispatches bootstrap to handlers.bootstrap", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("bootstrap", handlers, ctx);
  assert.deepEqual(calls, [{ name: "bootstrap", args: "" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches install to handlers.install", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("install foo@bar --scope user", handlers, ctx);
  assert.deepEqual(calls, [{ name: "install", args: "foo@bar --scope user" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches uninstall to handlers.uninstall", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("uninstall foo@bar", handlers, ctx);
  assert.deepEqual(calls, [{ name: "uninstall", args: "foo@bar" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches update to handlers.update", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("update foo@bar", handlers, ctx);
  assert.deepEqual(calls, [{ name: "update", args: "foo@bar" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches fetch to handlers.fetch", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("fetch foo@bar", handlers, ctx);
  assert.deepEqual(calls, [{ name: "fetch", args: "foo@bar" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches reinstall to handlers.reinstall", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("reinstall foo@bar --force", handlers, ctx);
  assert.deepEqual(calls, [{ name: "reinstall", args: "foo@bar --force" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches list to handlers.list", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("list bar", handlers, ctx);
  assert.deepEqual(calls, [{ name: "list", args: "bar" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches info to handlers.pluginInfo (INFO-02)", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("info foo@mp", handlers, ctx);
  assert.deepEqual(calls, [{ name: "pluginInfo", args: "foo@mp" }]);
  assert.deepEqual(notifications, []);
});

test("router :: TOP_LEVEL_SUBCOMMANDS includes `info` (INFO-02)", () => {
  assert.ok(
    (TOP_LEVEL_SUBCOMMANDS as readonly string[]).includes("info"),
    `TOP_LEVEL_SUBCOMMANDS missing "info" -- got ${TOP_LEVEL_SUBCOMMANDS.join(", ")}`,
  );
});

test("router :: TOP_LEVEL_USAGE contains the `info <plugin>@<marketplace>` usage line", () => {
  assert.match(TOP_LEVEL_USAGE, /info <plugin>@<marketplace> \[--scope user\|project\]/);
});

test("routeClaudePlugin :: dispatches import to handlers.import", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("import --scope user", handlers, ctx);
  assert.deepEqual(calls, [{ name: "import", args: "--scope user" }]);
  assert.deepEqual(notifications, []);
});

test("routeClaudePlugin :: dispatches ls alias to handlers.list", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("ls bar --scope project", handlers, ctx);
  assert.deepEqual(calls, [{ name: "list", args: "bar --scope project" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches add to handlers.marketplaceAdd", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace add gh:owner/repo", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceAdd", args: "gh:owner/repo" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches remove to handlers.marketplaceRemove", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace remove myname", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceRemove", args: "myname" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches rm alias to handlers.marketplaceRemove (TC-2 surface, alias accepted)", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace rm myname", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceRemove", args: "myname" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches list to handlers.marketplaceList", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace list", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceList", args: "" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches info to handlers.marketplaceInfo", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace info my-mp --scope user", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceInfo", args: "my-mp --scope user" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches ls alias to handlers.marketplaceList", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace ls", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceList", args: "" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches update to handlers.marketplaceUpdate", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace update myname", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceUpdate", args: "myname" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches autoupdate to handlers.marketplaceAutoupdate", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace autoupdate", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceAutoupdate", args: "" }]);
  assert.deepEqual(notifications, []);
});

test("routeMarketplace :: dispatches noautoupdate to handlers.marketplaceNoautoupdate", async () => {
  const { ctx, notifications } = makeCtx();
  const { handlers, calls } = makeHandlers();
  await routeClaudePlugin("marketplace noautoupdate myname --scope project", handlers, ctx);
  assert.deepEqual(calls, [{ name: "marketplaceNoautoupdate", args: "myname --scope project" }]);
  assert.deepEqual(notifications, []);
});
