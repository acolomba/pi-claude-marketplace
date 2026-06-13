// tests/edge/handlers/plugin/preview.test.ts
//
// Thin-shim tests for `edge/handlers/plugin/preview.ts`. Verifies argument
// parsing + USAGE routing without exercising the orchestrator's I/O surface
// (the orchestrator's idempotency / CFG-03 tests live in
// `tests/orchestrators/reconcile/preview.test.ts`).
//
// The shim contract:
//   - bare `preview` -> dispatches with scope undefined (orchestrator fans out)
//   - `preview --scope user` -> dispatches with scope: "user"
//   - `preview --scope project` -> dispatches with scope: "project"
//   - `preview --scope foo` -> notifyUsageError (invalid scope value)
//   - `preview foo` -> notifyUsageError ("Too many arguments.")
//   - `preview --bogus` -> notifyUsageError ("Unknown option")
//
// The shim's orchestrator dispatch reaches `previewReconcile`, which in a
// hermetic empty-env emits the empty-steady-state advisory. We assert the
// advisory line shape as a proxy for "dispatched successfully" -- a
// USAGE-routed call instead carries a `Usage:` block.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makePreviewHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts";

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

const ADVISORY = "Preview: next reload will apply 0 actions.";
const USAGE_PREFIX = "Usage: /claude:plugin preview";

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "preview-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "preview-shim-cwd-"));
  process.env.HOME = home;
  // SC-1: getAgentDir() honors PI_CODING_AGENT_DIR FIRST and only falls back
  // to homedir(). Clear it so the hermetic HOME above actually governs the
  // user scope -- otherwise a developer/CI env that sets the variable would
  // make these tests read the real Pi agent dir.
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

test("shim :: bare /preview dispatches with scope undefined (advisory line confirms successful dispatch)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, ADVISORY);
    // info severity -> no second arg captured.
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("shim :: --scope user dispatches with scope: 'user'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("--scope user", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, ADVISORY);
  });
});

test("shim :: --scope project dispatches with scope: 'project'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("--scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, ADVISORY);
  });
});

test("shim :: --scope foo (invalid value) -> notifyUsageError", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("--scope foo", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      notifications[0]!.message.includes(USAGE_PREFIX),
      `expected USAGE block; got: ${notifications[0]!.message}`,
    );
    assert.ok(
      notifications[0]!.message.includes("Invalid --scope value"),
      `expected invalid scope diagnostic; got: ${notifications[0]!.message}`,
    );
  });
});

test("shim :: positional argument -> notifyUsageError ('Too many arguments.')", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("foo", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      notifications[0]!.message.includes(USAGE_PREFIX),
      `expected USAGE block; got: ${notifications[0]!.message}`,
    );
    assert.ok(notifications[0]!.message.includes("Too many arguments."));
  });
});

test("shim :: unknown flag -> notifyUsageError ('Unknown option')", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("--bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(notifications[0]!.message.includes("Unknown option"));
    assert.ok(notifications[0]!.message.includes(USAGE_PREFIX));
  });
});

test("shim :: --scope without value -> notifyUsageError", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makePreviewHandler(STUB_PI);
    await handler("--scope", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(notifications[0]!.message.includes("--scope requires a value"));
  });
});
