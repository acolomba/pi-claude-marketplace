// uninstall handler shim tests.
//
// Pattern mirrors install.test.ts. The silent-converge semantic (PU-5) is now
// reserved for an already-gone PLUGIN record inside a PRESENT marketplace; a
// never-added MARKETPLACE is LOUD `{not added}` per ATTR-04. Our valid-args
// tests run a well-formed `plugin@marketplace` against empty state and assert
// the `{not added}` row (proving control reached the orchestrator and the
// shim selected the right scope, visible in the `[scope]` bracket).

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
    // ATTR-04: a never-added marketplace is now LOUD `{not added}` (was the
    // silent PU-5 path, which is now reserved for an already-gone PLUGIN
    // record). The bare/unqualified form misses in BOTH scopes -> no bracket.
    // This proves control reached uninstallPlugin against empty state.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mymkt \(failed\) \{not added\}/);
  });
});

test('shim :: --scope project calls uninstallPlugin with scope: "project"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("myplug@mymkt --scope project", ctx);
    // ATTR-04 / SCOPE-01: explicit `--scope project` against a never-added
    // marketplace -> LOUD `{not added}` with the `[project]` bracket, proving
    // the shim selected the project scope.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mymkt \[project\] \(failed\) \{not added\}/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// --local flag scanning at the edge boundary
// ──────────────────────────────────────────────────────────────────────────

test("USAGE string contains [--local]", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\[--local\]/);
  });
});

test("Flag: --local at the trailing position is accepted; control reaches uninstallPlugin", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("myplug@mymkt --local", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\(failed\) \{not added\}/);
  });
});

test("Flag: --local at the leading position parses identically", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("--local myplug@mymkt", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\(failed\) \{not added\}/);
  });
});

test("Unknown long flag -> USAGE error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUninstallHandler(makePi());
    await handler("myplug@mymkt --frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--frobnicate"\./);
  });
});
