// Phase 43 / Plan 43-01 / Task 3: marketplace info handler shim tests.
//
// Mirrors the structure of `tests/edge/handlers/marketplace/list.test.ts`
// and `remove.test.ts`. The shim parses one required positional + the
// optional `--scope` filter and delegates to `getMarketplaceInfo`. With
// an empty hermetic state, the orchestrator's INFO-04 `{not added}`
// carve-out surfaces (the orchestrator's responsibility -- the shim is
// "thin" and only enforces argv shape).
//
// Also asserts the router-constant wiring (MARKETPLACE_SUBCOMMANDS +
// MARKETPLACE_USAGE) here because there is no dedicated router test
// file in the existing layout.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeMarketplaceInfoHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts";
import {
  MARKETPLACE_SUBCOMMANDS,
  MARKETPLACE_USAGE,
} from "../../../../extensions/pi-claude-marketplace/edge/router.ts";

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
  return { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-info-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-info-shim-cwd-"));
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

test("shim :: missing name positional emits USAGE via notifyUsageError", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceInfoHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin marketplace info <name>/);
  });
});

test("shim :: `info my-mp` delegates with scope: undefined; absent-from-both -> bare {not added} row (no [scope] bracket)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceInfoHandler(makePi());
    await handler("my-mp", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ my-mp (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: `info my-mp --scope user` delegates with scope: 'user'; absent -> `⊘ my-mp [user] (failed) {not added}` + error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceInfoHandler(makePi());
    await handler("my-mp --scope user", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ my-mp [user] (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: `info my-mp --scope project` delegates with scope: 'project'; absent -> `⊘ my-mp [project] (failed) {not added}` + error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceInfoHandler(makePi());
    await handler("my-mp --scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ my-mp [project] (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: bad --scope value routes through notifyUsageError (orchestrator NOT invoked)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeMarketplaceInfoHandler(makePi());
    await handler("my-mp --scope bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    // The argv parser rejects the bogus scope before the orchestrator
    // runs; the body carries the Usage block (notifyUsageError shape).
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin marketplace info <name>/);
    // The orchestrator's `{not added}` byte form does not appear because
    // it never ran.
    assert.ok(
      !notifications[0]!.message.includes("not added"),
      "the orchestrator must not have been invoked",
    );
  });
});

test("router :: MARKETPLACE_SUBCOMMANDS includes `info`", () => {
  assert.ok(
    (MARKETPLACE_SUBCOMMANDS as readonly string[]).includes("info"),
    `MARKETPLACE_SUBCOMMANDS missing "info" -- got ${MARKETPLACE_SUBCOMMANDS.join(", ")}`,
  );
});

test("router :: MARKETPLACE_USAGE contains the `info <name>` usage line", () => {
  assert.match(MARKETPLACE_USAGE, /info <name> \[--scope user\|project\]/);
});
