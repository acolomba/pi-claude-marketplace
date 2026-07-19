// fetch handler shim tests.
//
// The shim parses the three positional shapes (D-81-01) into a `FetchTarget`
// discriminated union and delegates to `fetchPlugins`:
//   - bare (no positional)     -> { kind: "all" }
//   - `@<marketplace>`         -> { kind: "marketplace", marketplace }
//   - `<plugin>@<marketplace>` -> { kind: "plugin", plugin, marketplace }
//
// The pure `parseFetchTarget` parser is unit-tested directly for the three
// shapes + scope propagation + flag rejection (its `FetchTarget.kind` is the
// precise contract). A hermetic-home delegation test proves control reaches
// `fetchPlugins` against empty state (bare form -> `(no marketplaces)`).

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  makeFetchHandler,
  parseFetchTarget,
} from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "fetch-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "fetch-shim-cwd-"));
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

// ---------------------------------------------------------------------------
// D-81-01: the three positional shapes map to the FetchTarget union.
// `parseFetchTarget` returns `{ target, scope? }` on success, or `undefined`
// after notifying a USAGE error.
// ---------------------------------------------------------------------------

test("parse :: bare (no positional) -> target { kind: 'all' }", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("", ctx);
  assert.notEqual(parsed, undefined);
  assert.deepEqual(parsed!.target, { kind: "all" });
  assert.equal(parsed!.scope, undefined);
  assert.equal(notifications.length, 0);
});

test("parse :: `@<marketplace>` -> target { kind: 'marketplace', marketplace }", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("@mymkt", ctx);
  assert.notEqual(parsed, undefined);
  assert.deepEqual(parsed!.target, { kind: "marketplace", marketplace: "mymkt" });
  assert.equal(notifications.length, 0);
});

test("parse :: `<plugin>@<marketplace>` -> target { kind: 'plugin', plugin, marketplace }", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("hello@mymkt", ctx);
  assert.notEqual(parsed, undefined);
  assert.deepEqual(parsed!.target, { kind: "plugin", plugin: "hello", marketplace: "mymkt" });
  assert.equal(notifications.length, 0);
});

test("parse :: `--scope user` propagates alongside the target", () => {
  const { ctx } = makeCtx("/tmp");
  const parsed = parseFetchTarget("hello@mymkt --scope user", ctx);
  assert.notEqual(parsed, undefined);
  assert.deepEqual(parsed!.target, { kind: "plugin", plugin: "hello", marketplace: "mymkt" });
  assert.equal(parsed!.scope, "user");
});

test("parse :: `--scope project` propagates on the bare form", () => {
  const { ctx } = makeCtx("/tmp");
  const parsed = parseFetchTarget("--scope project", ctx);
  assert.notEqual(parsed, undefined);
  assert.deepEqual(parsed!.target, { kind: "all" });
  assert.equal(parsed!.scope, "project");
});

// ---------------------------------------------------------------------------
// Flag / arity rejection -- every non-`--scope` flag routes to USAGE.
// ---------------------------------------------------------------------------

test("parse :: unknown long flag routes through notifyUsageError (returns undefined)", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("hello@mymkt --bogus", ctx);
  assert.equal(parsed, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.severity, "error");
  assert.match(notifications[0]!.message, /Unknown flag: "--bogus"/);
});

test("parse :: bad --scope value routes through notifyUsageError", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("hello@mymkt --scope bogus", ctx);
  assert.equal(parsed, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.severity, "error");
  assert.match(notifications[0]!.message, /Usage: \/claude:plugin fetch/);
});

test("parse :: too many positionals routes through notifyUsageError", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("a@mp b@mp", ctx);
  assert.equal(parsed, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.severity, "error");
  assert.match(notifications[0]!.message, /Usage: \/claude:plugin fetch/);
});

test("parse :: malformed `<plugin>@<marketplace>` ref (trailing @) routes through notifyUsageError", () => {
  const { ctx, notifications } = makeCtx("/tmp");
  const parsed = parseFetchTarget("foo@", ctx);
  assert.equal(parsed, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.severity, "error");
  assert.match(notifications[0]!.message, /Invalid <plugin>@<marketplace> ref: "foo@"\./);
});

// ---------------------------------------------------------------------------
// Delegation -- the shim reaches `fetchPlugins`. Against empty hermetic state,
// enumeration yields zero targets and the cascade renders `(no marketplaces)`.
// ---------------------------------------------------------------------------

test("shim :: bare fetch reaches fetchPlugins -> `(no marketplaces)` against empty state", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeFetchHandler(makePi());
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: bad args short-circuit BEFORE fetchPlugins (no orchestrator output)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeFetchHandler(makePi());
    await handler("--bogus", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--bogus"/);
    assert.ok(!notifications[0]!.message.includes("(no marketplaces)"));
  });
});

test("shim :: `--scope project` threads the parsed scope into fetchPlugins (empty state -> `(no marketplaces)`)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeFetchHandler(makePi());
    await handler("--scope project", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});
