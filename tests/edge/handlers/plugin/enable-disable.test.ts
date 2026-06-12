// Enable/disable edge handler shim tests.
//
// Mirrors `uninstall.test.ts`. Valid-args tests run a well-formed
// `plugin@marketplace` against empty state and assert the `{not added}` row
// (proving control reached the orchestrator and the shim selected the right
// scope, visible in the `[scope]` bracket).

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("WR-02: --local BEFORE the ref parses identically to --local after (flag position must not change the outcome)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), true);
    // Pre-fix this failed with `Invalid <plugin>@<marketplace> ref:
    // "--local".` because the un-stripped `--local` token became the first
    // positional. Both orderings must reach the orchestrator.
    await handler("--local foo@mp --scope user", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mp \[user\] \(failed\) \{not added\}/);
    assert.ok(
      !notifications[0]!.message.includes("Invalid <plugin>@<marketplace> ref"),
      `--local must not be mistaken for the ref positional: ${notifications[0]!.message}`,
    );
  });
});

test("WR-02: --local between ref and --scope also parses (disable)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), false);
    await handler("foo@mp --local --scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ mp \[project\] \(failed\) \{not added\}/);
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

// ──────────────────────────────────────────────────────────────────────────
// C1: corrupt state.json driven through the edge handler must surface via
// notify (IL-2), not as a raw throw. The orchestrator catches the load-state
// throw internally; the handler's defense-in-depth try/catch covers any
// future leak past that contract.
// ──────────────────────────────────────────────────────────────────────────

test("C1: corrupt state.json -> edge handler renders a (failed) row via notify(); no exception escapes", async () => {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "enable-disable-c1-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "enable-disable-c1-cwd-"));
  process.env.HOME = home;
  try {
    // Seed a CORRUPT user-scope state.json so loadState throws at parse.
    const extRoot = path.join(home, ".pi", "agent", "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    const statePath = path.join(extRoot, "state.json");
    await writeFile(statePath, "{ not json ", "utf8");

    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeEnableDisableHandler(makePi(), true);
    // Must NOT throw -- the contract is honored end-to-end (orchestrator's
    // internal try/catch + handler's defense-in-depth catch).
    await handler("foo@mp --scope user", ctx);

    // Exactly one notify; the load-state failure surfaced through IL-2.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /\(failed\)/);
    assert.ok(
      !notifications[0]!.message.includes(statePath),
      `absolute state.json path must not leak: ${notifications[0]!.message}`,
    );
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
});
