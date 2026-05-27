// Plan 06-04 Task 1: marketplace autoupdate dual-form handler shim tests.
//
// Dual-form factory: makeAutoupdateHandler(true) maps to enable=true;
// makeAutoupdateHandler(false) maps to enable=false. The orchestrator
// setMarketplaceAutoupdate handles bare-form (flip every mp in scope)
// and named-form (single-name flip).
//
// On empty state, the bare form lands in the CMC-10 `(no marketplaces)`
// EmptyToken path; named form lands in the "name absent in every
// scope" error path.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeAutoupdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts";

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

// Plan 18-00 (Wave 0): `makeAutoupdateHandler(pi, enable)` requires `pi`
// as first positional arg. Edge shim tests mirror the production wiring shape.
function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-auto-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-auto-shim-cwd-"));
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

test("dual-form :: makeAutoupdateHandler(true) calls setMarketplaceAutoupdate with enabled: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeAutoupdateHandler(makePi(), true);
    await handler("", ctx);
    // Bare form, empty state both scopes -> "No marketplaces configured."
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("dual-form :: makeAutoupdateHandler(false) calls setMarketplaceAutoupdate with enabled: false", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeAutoupdateHandler(makePi(), false);
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: bare form (no name) propagates name: undefined", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeAutoupdateHandler(makePi(), true);
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: named form propagates name", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeAutoupdateHandler(makePi(), true);
    await handler("mymkt", ctx);
    // Name absent in BOTH scopes -> orchestrator emits a single error.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: --scope user/project propagated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeAutoupdateHandler(makePi(), true);
    await handler("--scope project", ctx);
    // Project-scope empty -> "No marketplaces configured."
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken (formerly the
    // "No marketplaces configured." sentence; retired by Plan 13-02c-01).
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});
