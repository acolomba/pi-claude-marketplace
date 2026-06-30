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
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { pathSource } from "../../../../extensions/pi-claude-marketplace/domain/source.ts";
import { makeUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
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
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
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
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
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
      "A marketplace operation has failed.\n\n⊘ mymkt (failed) {not added}",
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

// ──────────────────────────────────────────────────────────────────────────
// FORCE-02 (D-65-05): --force is parsed at the edge and threaded into
// updatePlugins.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Seed a path marketplace whose candidate plugin.json declares
 * `experimental themes/monitors` (the force-degradable `unsupported` arm)
 * over an already-installed older version, plus a supported `skills/` tree.
 */
async function seedUnsupportedCandidate(cwd: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  const marketplaceRoot = path.join(cwd, "mp-src");
  const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "skills", "tool", "SKILL.md"),
    "---\nname: tool\n---\n\nBody.\n",
  );
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "hello",
      version: "1.1.0",
      experimental: { themes: "./themes", monitors: "./monitors.json" },
    }),
  );
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.1.0" }],
    }),
  );

  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {
          hello: {
            version: "1.0.0",
            resolvedSource: "/tmp",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: ["hello-tool"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  });
}

test("USAGE string contains [--force]", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--frobnicate", ctx);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\[--force\]/);
  });
});

test("shim :: --force is accepted on the bare form; control reaches updatePlugins", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("--force", ctx);
    // No USAGE error -- `--force` is in the allow-list and the shared scanner
    // recognizes it; control reaches updatePlugins (empty state).
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /Usage: \/claude:plugin update/);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: --force threads force:true into updatePlugins (degrades an unsupported candidate)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Only the handler is under test, so a `(force-installed)` degrade row can
    // ONLY render if the handler forwarded `force: true` to updatePlugins.
    // FSTAT-07 / D-66-04: a force update whose candidate re-resolved
    // `unsupported` reports `(force-installed)`, not `(updated)`.
    await seedUnsupportedCandidate(cwd);
    const locations = locationsFor("project", cwd);

    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("hello@mp --force", ctx);

    const body = notifications.map((n) => n.message).join("\n");
    assert.match(body, /\(force-installed\)/, `expected degrade via threaded force; got: ${body}`);
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.1.0");
  });
});

test("shim :: without --force the force-upgradable candidate declines with the force-upgradable token", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedUnsupportedCandidate(cwd);
    const locations = locationsFor("project", cwd);

    const { ctx, notifications } = makeCtx(cwd);
    const handler = makeUpdateHandler(makePi());
    await handler("hello@mp", ctx);

    const body = notifications.map((n) => n.message).join("\n");
    // XSURF-03: the no-`--force` decline of a force-upgradable candidate renders
    // the `(force-upgradable)` token + the update-worded `--force` trailer, not
    // the misleading `(skipped) {no longer installable}`.
    assert.match(body, /\(force-upgradable\)/);
    assert.match(body, /Re-run with --force to update with the supported components\./);
    assert.doesNotMatch(body, /\{no longer installable\}/);
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]?.plugins["hello"]?.version, "1.0.0");
  });
});
