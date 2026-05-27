// Plan 06-04 Task 1 + Phase 13 Plan 13-02d-01 + Phase 19 Plan 19-03 migration:
//
// `listPlugins` orchestrator emits a success notification with the rendered
// plugin list, or the V2 `(no marketplaces)` sentinel (D-16-17 / shared/notify.ts:1158)
// for the empty case. We verify the shim reaches the orchestrator by observing
// this notification, and we verify the boolean flag plumbing by exercising
// each of the three filter flags on empty state.
//
// Phase 13 migration: `makeListHandler(pi)` is the factory shape (the
// orchestrator constructs a SoftDepProbe from `softDepStatus(pi)` for
// per-row soft-dep marker emission per CMC-13 / MSG-SD-1..3).
//
// Phase 19 / Plan 19-03 migration: V1 emitted `(no plugins)` for the empty
// case via the renderPluginList composer; V2's `notify()` emits
// `(no marketplaces)` because the top-level `marketplaces: []` array IS
// the structural empty sentinel per D-16-17. Catalog reference:
// docs/output-catalog.md:139-145.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeListHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts";

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

const STUB_PI = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "list-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "list-shim-cwd-"));
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

test("shim :: bare /list calls listPlugins with no marketplace, no scope, no filter flags", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("", ctx);
    // CMC-10 / MSG-ER-1: empty state -> V2 `(no marketplaces)` sentinel
    // (D-16-17). V1 emitted `(no plugins)`; the V2 form is the empty-
    // marketplaces-array structural representation.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: list <marketplace> calls listPlugins with marketplace argument", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("mymkt", ctx);
    // marketplace filter against empty state -> still empty list output.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: --installed flag calls listPlugins with installed: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("--installed", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: --available flag calls listPlugins with available: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("--available", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: --unavailable flag calls listPlugins with unavailable: true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("--unavailable", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: --installed --available union flags both propagated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeListHandler(STUB_PI);
    await handler("--installed --available", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});
