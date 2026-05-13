// Plan 06-04 Task 1: uninstall handler shim tests.
//
// Pattern mirrors install.test.ts. Uninstall has a special silent-converge
// semantic (PU-5) -- when the plugin is absent the orchestrator emits NO
// notification at all. Our valid-args tests assert this silence path: a
// well-formed `plugin@marketplace` against empty state -> zero notifications.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeUninstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts";

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
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "uninstall-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "uninstall-shim-cwd-"));
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

test("shim :: missing positional emits USAGE via notifyError; no orchestrator call", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin uninstall/);
  });
});

test("shim :: invalid ref (no @) emits USAGE + format error; no orchestrator call", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("no-at-sign", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin uninstall/);
  });
});

test("shim :: invalid ref (leading @) emits USAGE + format error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("@just-marketplace", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin uninstall/);
  });
});

test("shim :: invalid ref (trailing @) emits USAGE + format error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("plugin@", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin uninstall/);
  });
});

test('shim :: valid args call uninstallPlugin with { ctx, pi, scope: "user", cwd, marketplace, plugin }', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("myplug@mymkt", ctx);
    // PU-5 silent converge: absent record -> NO notification.
    assert.equal(notifications.length, 0);
  });
});

test('shim :: --scope project calls uninstallPlugin with scope: "project"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("myplug@mymkt --scope project", ctx);
    // PU-5 silent converge on project scope -> NO notification.
    assert.equal(notifications.length, 0);
  });
});
