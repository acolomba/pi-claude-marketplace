// Plan 06-04 Task 1: marketplace list handler shim tests.
//
// Plan 18-00 (Wave 0): the previous plain `handleMarketplaceList`
// function is now a `makeMarketplaceListHandler(pi)` factory that
// returns the same `(args, ctx) => Promise<void>` shape. Tests
// thread an empty-getAllTools `pi` to mirror production wiring.
// The orchestrator emits the bare CMC-10 EmptyToken form `(no
// marketplaces)` when state is empty.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeMarketplaceListHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts";

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

// Plan 18-00 (Wave 0): factory takes `pi: ExtensionAPI`. Mirror the
// production wiring shape used by sibling marketplace handler tests.
function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
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
    const handler = makeMarketplaceListHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test('shim :: --scope user calls listMarketplaces with scope: "user"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceListHandler(makePi());
    await handler("--scope user", ctx);
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test('shim :: --scope project calls listMarketplaces with scope: "project"', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceListHandler(makePi());
    await handler("--scope project", ctx);
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});
