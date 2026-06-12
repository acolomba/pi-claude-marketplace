// marketplace remove handler shim tests.
//
// ATTR-06 / D-48-C Shape 1: removeMarketplace's MR-1 missing-marketplace
// precondition no longer throws raw past the orchestrator. The orchestrator
// routes the miss (bare form in BOTH scopes, or explicit-scope absence) to the
// standalone `(failed) {not added}` notify variant. These shim tests assert the
// precondition error does NOT escape the handler -- a notification is captured,
// no rejection propagates to the Pi command runner.

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

test("shim :: valid name reaches the orchestrator; bare-form miss routes to `{not added}` WITHOUT escaping the handler (ATTR-06 S4)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    // Without --scope and against empty state in both scopes, the orchestrator
    // catches resolveScopeFromState's MarketplaceNotFoundError and routes the
    // miss to the standalone `(failed) {not added}` variant -- proving the
    // handler reached the orchestrator AND that no precondition error escapes.
    await assert.doesNotReject(async () => handler("ghost", ctx));
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ ghost (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: --scope propagated; explicit-scope miss routes to `{not added}` WITHOUT escaping the handler (ATTR-06 S3)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    // With --scope project, the orchestrator uses project locations directly
    // (bypassing resolveScopeFromState). Empty state -> the pre-guard existence
    // check routes the miss to the standalone `(failed) {not added}` variant
    // carrying the `[project]` bracket; no error escapes the handler.
    await assert.doesNotReject(async () => handler("ghost --scope project", ctx));
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ ghost [project] (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// --local flag scanning at the edge boundary
// ──────────────────────────────────────────────────────────────────────────

test("USAGE string contains [--local]", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\[--local\]/);
  });
});

test("Flag: --local at trailing position parses and routes to the orchestrator", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    // `ghost` not present in any scope; --local at the trailing position is
    // accepted by the scanner. The orchestrator's not-added precondition then
    // surfaces the standard standalone variant. The test just proves the flag
    // did not break parsing.
    await handler("ghost --local", ctx);
    assert.ok(notifications.length >= 1);
    assert.match(notifications[0]!.message, /\(failed\) \{not added\}/);
  });
});

test("Unknown long flag -> USAGE error (remove handler)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeRemoveHandler(makePi());
    await handler("ghost --frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--frobnicate"\./);
  });
});
