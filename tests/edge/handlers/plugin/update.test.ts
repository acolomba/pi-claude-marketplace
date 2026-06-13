// update handler shim tests.
//
// Update has three positional forms (bare / @marketplace / plugin@marketplace).
// We verify each form reaches updatePlugins by observing the orchestrator's
// notification:
//   - bare    -> "No plugins installed." (PUP-1 empty-set silent success on
//                fresh state)
//   - @<mp>   -> "Marketplace \"<mp>\" not found ..." (orchestrator missing-mp
//                surface for the marketplace-form target)
//   - pl@<mp> -> "Marketplace \"<mp>\" not found ..." (orchestrator missing-mp
//                surface for the plugin-form target)
//
// Invalid forms (positional missing the `@` while non-empty and not @-prefixed)
// fall into the shim's own USAGE path.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts";

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
  const home = await mkdtemp(path.join(tmpdir(), "update-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "update-shim-cwd-"));
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

test("shim :: bare /update with no positional calls updatePlugins with target = all-plugins-all-marketplaces", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("", ctx);
    // empty-targets renders via notify({
    // marketplaces: [] }) -> renderer's `(no marketplaces)` sentinel
    // per D-16-17.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: <plugin>@<marketplace> form calls updatePlugins with single-plugin target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("myplug@mymkt", ctx);
    // ATTR-02: a missing marketplace (no `--scope`, absent in both scopes) now
    // surfaces the standalone `(failed) {not added}` marketplace-subject row --
    // no raw `{not found}` misattribution. No bracket (absent-from-both form).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: bare @<marketplace> form calls updatePlugins with all-plugins-one-marketplace target", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("@mymkt", ctx);
    // ATTR-02: marketplace-form against a missing marketplace -> standalone
    // `(failed) {not added}` (no bracket: absent in both scopes, no `--scope`).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: --scope user/project propagated to updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--scope project", ctx);
    // empty-targets renders `(no marketplaces)`.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: invalid ref (no @, not bare) emits USAGE", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("no-at-sign", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin update/);
  });
});

// ---------------------------------------------------------------------------
// --map-model flag is accepted on all three positional forms;
// unknown long flags rejected.
// ---------------------------------------------------------------------------

test("shim :: bare form + --map-model is accepted; control reaches updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--map-model", ctx);
    // empty-targets renders `(no marketplaces)`;
    // critically, no USAGE error fires.
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /Usage: \/claude:plugin update/);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: @<mp> form + --map-model is accepted; control reaches updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("@mymkt --map-model", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.doesNotMatch(notifications[0]!.message, /Usage: \/claude:plugin update/);
    // ATTR-02: control reaches updatePlugins, which emits the standalone
    // `{not added}` for the missing marketplace (not the raw `{not found}`).
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: pl@<mp> form + --map-model is accepted; control reaches updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("myplug@mymkt --map-model", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.doesNotMatch(notifications[0]!.message, /Usage: \/claude:plugin update/);
    // ATTR-02: control reaches updatePlugins, which emits the standalone
    // `{not added}` for the missing marketplace (not the raw `{not found}`).
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ mymkt (failed) {not added}",
    );
  });
});

test("shim :: rejects unknown long flag with USAGE", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--bogus-flag", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin update/);
  });
});

test("shim :: rejects unknown long flag on pl@mp form with USAGE", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("myplug@mymkt --bogus-flag", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin update/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// --local flag scanning at the edge boundary
// ──────────────────────────────────────────────────────────────────────────

test("USAGE string contains [--local]", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\[--local\]/);
  });
});

test("Flag: --local at the trailing position is accepted", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    // Bare bulk update against empty state -> (no marketplaces).
    await handler("--local", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("Flag: --local at the leading position parses identically", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--local --map-model", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("Unknown long flag -> USAGE error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Unknown flag: "--frobnicate"\./);
  });
});
