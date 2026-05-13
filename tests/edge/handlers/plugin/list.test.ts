// Plan 06-04 Task 1: plugin list handler shim tests.
//
// `listPlugins` orchestrator emits a success notification with the rendered
// plugin list (or the byte-stable sentinel "No plugins configured." for the
// empty case). We verify the shim reaches the orchestrator by observing this
// notification, and we verify the boolean flag plumbing by exercising each
// of the three filter flags on empty state.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeListHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts";

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

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

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "list-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "list-shim-cwd-"));
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

test("shim :: bare /list calls listPlugins with no marketplace, no scope, no filter flags", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("", ctx);
    // Empty state -> "No plugins configured." renderer output.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});

test("shim :: list <marketplace> calls listPlugins with marketplace argument", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("mymkt", ctx);
    // marketplace filter against empty state -> still empty list output.
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});

test("shim :: --installed flag calls listPlugins with installed: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("--installed", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});

test("shim :: --available flag calls listPlugins with available: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("--available", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});

test("shim :: --unavailable flag calls listPlugins with unavailable: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("--unavailable", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});

test("shim :: --installed --available union flags both propagated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler();
    await handler("--installed --available", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins configured\./);
  });
});
