// Phase 54 Plan 02 -- ENBL behaviors for the setPluginEnabled orchestrator.
//
// Wave 0 scaffolds (Plan 01) flipped to GREEN bodies in lockstep with the new
// `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
// source file. Each test exercises an ENBL-{01..04} behavior or an
// idempotency / CFG-03 / --local invariant.
//
// Hermetic harness: each test uses a temp HOME + cwd so state/config files
// are isolated. The orchestrator is exercised end-to-end through its single
// public entry point `setPluginEnabled`.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { setPluginEnabled } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts";
import { MarketplaceNotFoundError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(cwd: string): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(
  fn: (env: { cwd: string; home: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "enable-disable-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "enable-disable-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd, home });
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

// Construct a state.json for the user scope where a marketplace `mp` contains
// a plugin `foo` in the requested shape (populated vs. disabled).
async function writeUserState(
  home: string,
  opts: { marketplaceName: string; pluginName: string; disabled: boolean; version?: string },
): Promise<{ statePath: string; configPath: string; configLocalPath: string; scopeRoot: string }> {
  const scopeRoot = path.join(home, ".pi", "agent");
  const extRoot = path.join(scopeRoot, "pi-claude-marketplace");
  await mkdir(extRoot, { recursive: true });
  const statePath = path.join(extRoot, "state.json");
  const configPath = path.join(scopeRoot, "claude-plugins.json");
  const configLocalPath = path.join(scopeRoot, "claude-plugins.local.json");
  const resources = opts.disabled
    ? { skills: [], prompts: [], agents: [], mcpServers: [] }
    : { skills: ["s1"], prompts: [], agents: [], mcpServers: [] };
  const state = {
    schemaVersion: 1,
    marketplaces: {
      [opts.marketplaceName]: {
        name: opts.marketplaceName,
        scope: "user",
        source: {
          kind: "path" as const,
          raw: "/tmp/dummy-mp",
          absPath: "/tmp/dummy-mp",
        },
        addedFromCwd: "/tmp",
        marketplaceRoot: "/tmp/dummy-mp",
        manifestPath: "/tmp/dummy-mp/.claude-plugin/marketplace.json",
        plugins: {
          [opts.pluginName]: {
            version: opts.version ?? "1.2.3",
            resolvedSource: "/tmp/dummy-mp/plugins/foo",
            compatibility: {
              installable: true,
              notes: [],
              supported: [],
              unsupported: [],
            },
            resources,
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  return { statePath, configPath, configLocalPath, scopeRoot };
}

async function readConfig(configPath: string): Promise<unknown> {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw);
}

/**
 * Build a REAL on-disk path-source marketplace (manifest + skill-bearing
 * plugin tree) AND a user-scope state.json carrying the KEPT disabled record
 * (ENBL-02 empty-resources marker) pointing at it. This is the fixture the
 * fresh-enable success path needs: the enable branch re-materializes from
 * the cached clone via the install ledger (PI-2 cached read, NFR-5
 * network-free).
 */
async function seedRealDisabledMarketplace(
  home: string,
  opts: { marketplaceName: string; pluginName: string; version: string },
): Promise<{ statePath: string; configPath: string }> {
  const scopeRoot = path.join(home, ".pi", "agent");
  const extRoot = path.join(scopeRoot, "pi-claude-marketplace");
  await mkdir(extRoot, { recursive: true });

  // Marketplace clone on disk.
  const mpRoot = path.join(home, "mp-src");
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
  const pluginRoot = path.join(mpRoot, "plugins", opts.pluginName);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: opts.pluginName, version: opts.version }),
  );
  const skillDir = path.join(pluginRoot, "skills", "s1");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: s1\n---\n\nBody.\n");
  const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: opts.marketplaceName,
      plugins: [
        {
          name: opts.pluginName,
          source: `./plugins/${opts.pluginName}`,
          version: opts.version,
        },
      ],
    }),
  );

  // State: the KEPT disabled record (ENBL-02) -- empty resources +
  // installable: true + the pinned version.
  const statePath = path.join(extRoot, "state.json");
  const state = {
    schemaVersion: 1,
    marketplaces: {
      [opts.marketplaceName]: {
        name: opts.marketplaceName,
        scope: "user",
        source: { kind: "path" as const, raw: mpRoot, absPath: mpRoot },
        addedFromCwd: home,
        marketplaceRoot: mpRoot,
        manifestPath,
        plugins: {
          [opts.pluginName]: {
            version: opts.version,
            resolvedSource: pluginRoot,
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
            installedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    },
  };
  await writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
  return { statePath, configPath: path.join(scopeRoot, "claude-plugins.json") };
}

// ──────────────────────────────────────────────────────────────────────────
// ENBL-01: config write-back (base + --local)
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-01: disable writes enabled:false to claude-plugins.json (base)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { configPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    const { ctx } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    const cfg = await readConfig(configPath);
    const plugins = (cfg as { plugins?: Record<string, { enabled?: boolean }> }).plugins ?? {};
    assert.equal(plugins["foo@mp"]?.enabled, false, "config entry should carry enabled:false");
  });
});

test("ENBL-01: enable --local writes enabled:true to claude-plugins.local.json (base unchanged, Pitfall 54-5)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Reset state to populated (so disable is a fresh transition).
    const { configPath, configLocalPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });

    // Verify base does NOT exist at start.
    async function fileExists(p: string): Promise<boolean> {
      try {
        await stat(p);
        return true;
      } catch {
        return false;
      }
    }

    const baseExistsPre = await fileExists(configPath);
    const { ctx } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
      local: true,
    });

    // Base file should still not exist (Pitfall 54-5).
    const baseExistsPost = await fileExists(configPath);
    assert.equal(baseExistsPost, baseExistsPre, "base file mtime/existence must be unchanged");

    // Local file should exist with enabled:false.
    const cfg = await readConfig(configLocalPath);
    const plugins = (cfg as { plugins?: Record<string, { enabled?: boolean }> }).plugins ?? {};
    assert.equal(plugins["foo@mp"]?.enabled, false, "--local file should carry enabled:false");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-02: disable preserves version pin + empties resources
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-02: disable preserves version pin and empties resources arrays", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
      version: "9.9.9",
    });
    const { ctx } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    const raw = await readFile(statePath, "utf8");
    const state = JSON.parse(raw) as {
      marketplaces: Record<
        string,
        {
          plugins: Record<
            string,
            {
              version: string;
              resources: {
                skills: string[];
                prompts: string[];
                agents: string[];
                mcpServers: string[];
              };
              compatibility: { installable: boolean };
              installedAt: string;
            }
          >;
        }
      >;
    };
    const rec = state.marketplaces.mp!.plugins.foo!;
    assert.equal(rec.version, "9.9.9", "version pin preserved");
    assert.equal(rec.compatibility.installable, true, "installable flag preserved");
    assert.equal(rec.installedAt, "2026-01-01T00:00:00.000Z", "installedAt preserved");
    assert.deepEqual(rec.resources.skills, [], "resources.skills emptied");
    assert.deepEqual(rec.resources.prompts, [], "resources.prompts emptied");
    assert.deepEqual(rec.resources.agents, [], "resources.agents emptied");
    assert.deepEqual(rec.resources.mcpServers, [], "resources.mcpServers emptied");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// CR-01 / ENBL-01 / ENBL-03: fresh enable success (end-to-end, real clone)
// ──────────────────────────────────────────────────────────────────────────

test("CR-01: fresh enable succeeds end-to-end against a real on-disk marketplace (single lock, catalog enable-fresh byte form, state re-populated)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath, configPath } = await seedRealDisabledMarketplace(home, {
      marketplaceName: "claude-plugins-official",
      pluginName: "foo-plugin",
      version: "1.2.3",
    });
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "claude-plugins-official",
      plugin: "foo-plugin",
      enable: true,
      scope: "user",
    });

    // Exactly one notify, info severity, catalog `enable-fresh` byte form:
    // `(added)` header + `(installed)` row + `/reload` trailer. A nested
    // withStateGuard would instead produce a `(failed)` row with a
    // StateLockHeldError cause (the CR-01 regression this test pins).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "fresh enable routes to info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● claude-plugins-official [user] (added)",
        "  ● foo-plugin v1.2.3 (installed)",
        "",
        "/reload to pick up changes",
      ].join("\n"),
    );

    // State: the ledger's mutation must be what got SAVED (no outer
    // stale-snapshot clobber) -- resources.skills re-populated, version pin
    // + installedAt preserved (ENBL-02), record no longer disabled.
    const state = JSON.parse(await readFile(statePath, "utf8")) as {
      marketplaces: Record<
        string,
        {
          plugins: Record<
            string,
            {
              version: string;
              installedAt: string;
              resources: { skills: string[] };
            }
          >;
        }
      >;
    };
    const rec = state.marketplaces["claude-plugins-official"]!.plugins["foo-plugin"]!;
    assert.ok(
      rec.resources.skills.length > 0,
      "resources.skills must be non-empty after a fresh enable (state/disk drift otherwise)",
    );
    assert.equal(rec.version, "1.2.3", "ENBL-02 version pin preserved across re-materialization");
    assert.equal(
      rec.installedAt,
      "2026-01-01T00:00:00.000Z",
      "installedAt preserved on re-materialization (record was disabled, never uninstalled)",
    );

    // Config write-back: enabled:true recorded (ENBL-01).
    const cfg = await readConfig(configPath);
    const plugins = (cfg as { plugins?: Record<string, { enabled?: boolean }> }).plugins ?? {};
    assert.equal(
      plugins["foo-plugin@claude-plugins-official"]?.enabled,
      true,
      "config entry should carry enabled:true",
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-03: enable from cache (no network, NFR-5)
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-03: missing cached clone aborts with (failed) {source missing}", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: true,
    });
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    // WR-06: pin the FULL brace byte form. A bare /\(failed\)/ assertion
    // also passed for the CR-01 nested-lock StateLockHeldError (which
    // narrowEnableFailure maps to reasons: [], no brace) -- the weak match
    // is exactly how a never-working fresh enable shipped green. The
    // ENBL-03 classification requires the ENOENT-class failure to surface
    // as `{source missing}`.
    assert.match(
      notifications[0]!.message,
      /\(failed\) \{source missing\}/,
      `cached-clone-missing must classify as {source missing}: ${notifications[0]!.message}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL idempotency arm
// ──────────────────────────────────────────────────────────────────────────

test("Idempotency: enable on already-enabled plugin renders (skipped) {already enabled} at info severity", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    // benign reason -> info severity (no severity arg).
    assert.equal(notifications[0]!.severity, undefined, "benign idempotent skip routes to info");
    assert.match(notifications[0]!.message, /\(skipped\) \{already enabled\}/);
  });
});

test("Idempotency: disable on already-disabled plugin renders (skipped) {already disabled} at info severity", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: true,
    });
    const statePre = await readFile(statePath, "utf8");
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "benign idempotent skip routes to info");
    assert.match(notifications[0]!.message, /\(skipped\) \{already disabled\}/);
    // WR-01: the idempotent arm returns without tx.save() -- state.json is
    // not rewritten on a no-op.
    const statePost = await readFile(statePath, "utf8");
    assert.equal(statePost, statePre, "state.json bytes unchanged after idempotent no-op");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// CFG-03: invalid-config abort
// ──────────────────────────────────────────────────────────────────────────

test("CFG-03 / WR-01: invalid config aborts and state.json is byte- and mtime-unchanged (path.basename containment, T-54-02-02)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath, configPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    // 0-byte file -> CFG-03 invalid (JSON parse failure).
    await writeFile(configPath, "", "utf8");
    const statePre = await readFile(statePath, "utf8");
    const mtimePre = (await stat(statePath)).mtimeMs;
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /\(failed\) \{invalid manifest\}/);
    // Information-disclosure: the absolute path must NOT appear.
    assert.ok(
      !notifications[0]!.message.includes(configPath),
      "absolute path must not be leaked (T-54-02-02)",
    );
    // The cause should mention the basename only.
    assert.match(
      notifications[0]!.message,
      /claude-plugins\.json/,
      "basename should be cited in the cause",
    );
    // WR-01: the abort arms return WITHOUT tx.save(), so state.json is not
    // rewritten at all -- the catalog's "state.json mtime is UNCHANGED"
    // claim for `enable-invalid-config` / `disable-invalid-config` is a real
    // byte-level invariant (not just load-bearing-field preservation).
    const statePost = await readFile(statePath, "utf8");
    assert.equal(statePost, statePre, "state.json bytes unchanged after CFG-03 abort");
    const mtimePost = (await stat(statePath)).mtimeMs;
    assert.equal(mtimePost, mtimePre, "state.json mtime unchanged after CFG-03 abort");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WR-03: marketplace present, plugin row absent -> (skipped) {not installed}
// ──────────────────────────────────────────────────────────────────────────

test("WR-03: enable on a present marketplace whose plugin row is absent renders (skipped) {not installed} at warning severity", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Seed state with the marketplace container but a DIFFERENT plugin row.
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "other-plugin",
      disabled: false,
    });
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    // `not installed` is NOT benign -> warning severity (D-28-03), and the
    // taxonomy must NOT misuse `{not in manifest}` (reserved for "plugin
    // absent from a PRESENT manifest").
    assert.equal(notifications[0]!.severity, "warning");
    assert.match(notifications[0]!.message, /⊘ foo \(skipped\) \{not installed\}/);
    assert.ok(
      !notifications[0]!.message.includes("{not in manifest}"),
      `must not misuse the not-in-manifest reason: ${notifications[0]!.message}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Marketplace-not-added (M3 / M4)
// ──────────────────────────────────────────────────────────────────────────

test("Marketplace not added: explicit --scope emits standalone marketplace-not-added row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "ghost-mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /⊘ ghost-mp \[user\] \(failed\) \{not added\}/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RECON-03 (Phase 55 Plan 01): orchestrated-mode coverage
// ──────────────────────────────────────────────────────────────────────────

test("RECON-03 enable-disable orchestrated mode -- disable returns { status: 'disabled', name, version } with ZERO notify calls", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
      version: "1.2.3",
    });
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome);
    assert.equal(outcome.status, "disabled");
    if (outcome.status === "disabled") {
      assert.equal(outcome.name, "foo");
      assert.equal(outcome.version, "1.2.3");
    }
  });
});

test("RECON-03 enable-disable orchestrated mode -- idempotent disable-already-disabled returns { status: 'skipped', reason: 'already disabled' } no notify", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: true,
      version: "1.2.3",
    });
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome);
    assert.equal(outcome.status, "skipped");
    if (outcome.status === "skipped") {
      assert.equal(outcome.reason, "already disabled");
    }
  });
});

test("RECON-03 enable-disable orchestrated mode -- idempotent enable-already-enabled returns { status: 'skipped', reason: 'already enabled' }", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false, // populated resources = enabled
      version: "1.2.3",
    });
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome);
    assert.equal(outcome.status, "skipped");
    if (outcome.status === "skipped") {
      assert.equal(outcome.reason, "already enabled");
    }
  });
});

test("RECON-03 enable-disable orchestrated mode -- missing marketplace returns { status: 'failed', reason: 'not added' } no notifications", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "ghost-mp",
      plugin: "foo",
      enable: false,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.ok(outcome);
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      assert.equal(outcome.reason, "not added");
      assert.ok(outcome.error instanceof MarketplaceNotFoundError);
    }
  });
});

test("RECON-03 enable-disable standalone-default mode -- omitted notifications option remains byte-identical to today (regression guard)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "ghost-mp-byte",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    assert.equal(outcome, undefined, "standalone (omitted) returns undefined");
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /⊘ ghost-mp-byte \[user\] \(failed\) \{not added\}/);
  });
});
