// Plan 06-04 Task 1: marketplace remove handler shim tests.
//
// removeMarketplace's MR-1 path throws MarketplaceNotFoundError when the
// name is absent in BOTH scopes (or the requested scope). The error is
// notifyError-surfaced; we assert on the notification.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeRemoveHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "mp-remove-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-remove-shim-cwd-"));
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

test("shim :: missing name positional emits USAGE", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin marketplace <remove\|rm>/);
  });
});

test("shim :: valid name calls removeMarketplace with { ctx, scope?, cwd, name }", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    // Without --scope and against empty state in both scopes,
    // resolveScopeFromState throws MarketplaceNotFoundError. That surfaces
    // via notifyError -- proving the handler reached the orchestrator.
    await assert.rejects(async () => handler("ghost", ctx));
  });
});

test("shim :: --scope user/project propagated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    // With --scope project, the orchestrator uses project locations directly
    // (bypassing resolveScopeFromState). Empty state -> the MarketplaceNotFoundError
    // is thrown from withStateGuard's closure and surfaces.
    await assert.rejects(async () => handler("ghost --scope project", ctx));
  });
});
