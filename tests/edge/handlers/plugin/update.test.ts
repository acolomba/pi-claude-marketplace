// Plan 06-04 Task 1: update handler shim tests.
//
// Update has three positional forms (bare / @marketplace / plugin@marketplace).
// We verify each form reaches updatePlugins by observing the orchestrator's
// notification:
//   - bare    -> "No plugins installed." (PUP-1 empty-set silent success on
//                fresh state)
//   - @<mp>   -> "Marketplace \"<mp>\" not found ..." (orchestrator missing-mp
//                surface for the marketplace-form target)
//   - pl@<mp> -> "Marketplace \"<mp>\" not found ..." (orchestrator missing-mp
//                surface for the plugin-form target)
//
// Invalid forms (positional missing the `@` while non-empty and not @-prefixed)
// fall into the shim's own USAGE path.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "update-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "update-shim-cwd-"));
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

test("shim :: bare /update with no positional calls updatePlugins with target = all-plugins-all-marketplaces", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("", ctx);
    // PUP-1 empty-set silent success: "No plugins installed."
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.match(notifications[0]!.message, /No plugins installed\./);
  });
});

test("shim :: <plugin>@<marketplace> form calls updatePlugins with single-plugin target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("myplug@mymkt", ctx);
    // The orchestrator surfaces "Marketplace \"mymkt\" not found ..." for
    // single-form when marketplace doesn't exist; we accept either form
    // ("not found" + the marketplace name).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /mymkt/);
    assert.match(notifications[0]!.message, /not found/);
  });
});

test("shim :: bare @<marketplace> form calls updatePlugins with all-plugins-one-marketplace target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("@mymkt", ctx);
    // marketplace-form: orchestrator throws Marketplace not found.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /mymkt/);
    assert.match(notifications[0]!.message, /not found/);
  });
});

test("shim :: --scope user/project propagated to updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--scope project", ctx);
    // PUP-1 empty-set silent success on project scope.
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /No plugins installed\./);
  });
});

test("shim :: invalid ref (no @, not bare) emits USAGE", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("no-at-sign", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin update/);
  });
});
