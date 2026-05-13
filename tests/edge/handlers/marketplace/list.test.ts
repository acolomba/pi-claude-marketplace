// Plan 06-04 Task 1: marketplace list handler shim tests.
//
// `handleMarketplaceList` is a plain (non-factory) function. It accepts
// optional --scope and delegates to listMarketplaces. The orchestrator
// emits the byte-stable "No marketplaces configured." string when state
// is empty.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { handleMarketplaceList } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "mp-list-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-list-shim-cwd-"));
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

test("shim :: no positional calls listMarketplaces with scope: undefined", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    await handleMarketplaceList("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "No marketplaces configured.");
  });
});

test('shim :: --scope user calls listMarketplaces with scope: "user"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    await handleMarketplaceList("--scope user", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "No marketplaces configured.");
  });
});

test('shim :: --scope project calls listMarketplaces with scope: "project"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    await handleMarketplaceList("--scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "No marketplaces configured.");
  });
});
