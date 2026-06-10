// Phase 54 Plan 02 -- enable/disable edge handler shim tests.
//
// Mirrors `uninstall.test.ts`. Valid-args tests run a well-formed
// `plugin@marketplace` against empty state and assert the `{not added}` row
// (proving control reached the orchestrator and the shim selected the right
// scope, visible in the `[scope]` bracket).

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeEnableDisableHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "enable-disable-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "enable-disable-shim-cwd-"));
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

// ──────────────────────────────────────────────────────────────────────────
// USAGE error arms
// ──────────────────────────────────────────────────────────────────────────

test("USAGE: missing positional emits USAGE error (enable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), true);
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin enable/);
  });
});

test("USAGE: malformed <plugin>@<marketplace> emits USAGE error (disable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), false);
    await handler("no-at-sign", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin disable/);
  });
});

test("USAGE: unknown flag emits USAGE error (enable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), true);
    await handler("foo@bar --bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--bogus"\./);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Flag parsing + forward
// ──────────────────────────────────────────────────────────────────────────

test("Flag: --local is parsed and forwarded to the orchestrator (enable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), true);
    // Empty state + missing marketplace -> orchestrator emits the
    // marketplace-not-added row, proving control reached the orchestrator.
    await handler("foo@mp --scope user --local", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mp \[user\] \(failed\) \{not added\}/);
  });
});

test("Flag: --scope user|project is parsed and forwarded to the orchestrator (disable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), false);
    await handler("foo@mp --scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mp \[project\] \(failed\) \{not added\}/);
  });
});
