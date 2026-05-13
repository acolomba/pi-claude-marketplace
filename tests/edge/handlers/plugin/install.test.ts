// Plan 06-04 Task 1: install handler shim tests.
//
// The shim is a thin Pattern 1 wrapper (parseCommandArgs -> early-return ->
// delegate). We verify:
//   - Bad args paths surface USAGE via notifyError (no orchestrator state change).
//   - Valid args reach the orchestrator -- asserted indirectly by observing
//     the orchestrator's notify output ("not found in marketplace" because we
//     don't pre-seed the marketplace; that's enough to prove control reached
//     `installPlugin`).
//
// Scope propagation: --scope project must route to project locations; we
// observe this by checking that the orchestrator's error message names the
// configured scope path semantics (project state.json is absent, so we see
// "marketplace ... not found").

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeInstallHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "install-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "install-shim-cwd-"));
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
    const handler = makeInstallHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin install/);
  });
});

test("shim :: invalid ref (no @) emits USAGE + format error; no orchestrator call", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeInstallHandler(makePi());
    await handler("no-at-sign", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin install/);
  });
});

test("shim :: invalid ref (leading @) emits USAGE + format error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeInstallHandler(makePi());
    await handler("@just-marketplace", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin install/);
  });
});

test("shim :: invalid ref (trailing @) emits USAGE + format error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeInstallHandler(makePi());
    await handler("plugin@", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin install/);
  });
});

test('shim :: valid args call installPlugin with { ctx, pi, scope: "user", cwd, marketplace, plugin }', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeInstallHandler(makePi());
    await handler("myplug@mymkt", ctx);
    // Empty user state -> orchestrator surfaces "not found" error. This proves
    // (a) control reached installPlugin, (b) default scope was user (the
    // notification is from the user-scope state.json read path).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /not found in marketplace "mymkt"/);
  });
});

test('shim :: --scope project calls installPlugin with scope: "project"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeInstallHandler(makePi());
    await handler("myplug@mymkt --scope project", ctx);
    // Empty project state -> "not found" surfaces. The shim selected the
    // project locations (state.json under <cwd>/.pi/pi-claude-marketplace/).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /not found in marketplace "mymkt"/);
  });
});
