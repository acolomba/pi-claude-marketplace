// tests/edge/handlers/plugin/info.test.ts
//
// plugin info handler shim tests.
//
// Mirrors `tests/edge/handlers/plugin/install.test.ts`. The shim parses
// one required `<plugin>@<marketplace>` positional + the optional
// `--scope` filter and delegates to `getPluginInfo`. With an empty
// hermetic state, the orchestrator's INFO-04 `{not added}` carve-out
// surfaces (the orchestrator's responsibility -- the shim is "thin"
// and only enforces argv shape).

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makePluginInfoHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(cwd: string): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

function makePi(): ExtensionAPI {
  return { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-info-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-info-shim-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

test("shim :: missing positional emits USAGE via notifyUsageError; orchestrator NOT invoked", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin info <plugin>@<marketplace>/);
    // The orchestrator's `{not added}` byte form does not appear because
    // it never ran.
    assert.ok(!notifications[0]!.message.includes("not added"));
  });
});

test("shim :: malformed ref (no @) routes through notifyUsageError; orchestrator NOT invoked", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Invalid <plugin>@<marketplace> ref: "foo"\./);
  });
});

test("shim :: malformed ref (leading @) routes through notifyUsageError", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("@mp", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Invalid <plugin>@<marketplace> ref: "@mp"\./);
  });
});

test("shim :: malformed ref (trailing @) routes through notifyUsageError", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Invalid <plugin>@<marketplace> ref: "foo@"\./);
  });
});

test("shim :: `info foo@mp` delegates with scope: undefined; absent-from-both -> bare `{not added}` (no [scope])", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ mp (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: `info foo@mp --scope user` delegates with scope: 'user'; absent -> `⊘ mp [user] (failed) {not added}` + error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --scope user", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ mp [user] (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: `info foo@mp --scope project` delegates with scope: 'project'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ mp [project] (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: bad --scope value routes through notifyUsageError; orchestrator NOT invoked", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --scope bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin info <plugin>@<marketplace>/);
    assert.ok(
      !notifications[0]!.message.includes("not added"),
      "the orchestrator must not have been invoked",
    );
  });
});

test("shim :: unknown long flag routes through notifyUsageError; orchestrator NOT invoked", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin info <plugin>@<marketplace>/);
    assert.ok(
      !notifications[0]!.message.includes("not added"),
      "the orchestrator must not have been invoked",
    );
  });
});

test("FTCH-03 :: `info foo@mp --fetch` is accepted and delegates (reaches the absent-marketplace path)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --fetch", ctx);
    assert.equal(notifications.length, 1);
    // Delegation proof: `--fetch` was NOT rejected as an unknown flag; the
    // orchestrator ran and hit the absent-marketplace `{not added}` arm.
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ mp (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("FTCH-03 :: `--fetch` does not open the flag gate -- another unknown flag is still rejected", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePluginInfoHandler(makePi());
    await handler("foo@mp --fetch --bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--bogus"/);
    assert.ok(
      !notifications[0]!.message.includes("not added"),
      "the orchestrator must not have been invoked",
    );
  });
});
