// ENBL behaviors for the setPluginEnabled orchestrator.
//
// Each test exercises an ENBL-{01..04} behavior or an idempotency / CFG-03
// / --local invariant against
// `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`.
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

import type { EnableDisablePluginOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts";
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

test("ENBL-01: enable --local writes enabled:true to claude-plugins.local.json (base unchanged)", async () => {
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

    // Base file should still not exist.
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

    // UAT-03: catalog
    // `disable-fresh` byte form -- bare marketplace header + the closed-set
    // `(disabled)` row (same glyph + token as the disabled-inventory row,
    // version slot kept) + the `/reload` trailer (the orchestrator
    // dispatches with the `disable-cascade` kind, so the `(disabled)` row
    // counts as a realized transition per SNM-33).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "fresh disable routes to info severity");
    assert.equal(
      notifications[0]!.message,
      ["● mp [user]", "  ⊘ foo v9.9.9 (disabled)", "", "/reload to pick up changes"].join("\n"),
    );

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
    // BARE marketplace header (UAT-04: no `(added)` token -- that header
    // belongs to `marketplace add`) + `(installed)` row + `/reload` trailer.
    // A nested withStateGuard would instead produce a `(failed)` row with a
    // StateLockHeldError cause (the CR-01 regression this test pins).
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "fresh enable routes to info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● claude-plugins-official [user]",
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

test("WR-03: enable on state-enabled plugin with config enabled:false lands the config-side truth (promotion, state untouched)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath, configPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    // Config drift: the targeted config carries the OPPOSITE explicit value
    // (hand-edited config or base/local divergence pending reconcile). A
    // state-side-only idempotency gate would skip here and the next
    // reconcile would DISABLE the plugin the user just explicitly enabled.
    await writeFile(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: "/tmp/dummy-mp" } },
        plugins: { "foo@mp": { enabled: false } },
      }),
      "utf8",
    );
    const statePre = await readFile(statePath, "utf8");
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
    // The config-side truth landed: enabled flipped to true.
    const cfg = (await readConfig(configPath)) as {
      plugins?: Record<string, { enabled?: boolean }>;
    };
    assert.equal(cfg.plugins?.["foo@mp"]?.enabled, true);
    // State untouched -- the promotion arm writes config ONLY (no tx.save()).
    const statePost = await readFile(statePath, "utf8");
    assert.equal(statePost, statePre, "state.json bytes unchanged on config-only promotion");
    // Rendered as a FRESH enable (the user's command landed), not a skip.
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /\(installed\)/);
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
// RECON-03: orchestrated-mode coverage
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

// ──────────────────────────────────────────────────────────────────────────
// UAT-05: merged-view membership gate for the adopted-marketplace declaration
// ──────────────────────────────────────────────────────────────────────────

test("UAT-05: --local enable flip with marketplace declared in BASE writes ONLY the plugin entry to local; merged autoupdate from base survives", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { configPath, configLocalPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    // BASE declares the marketplace with autoupdate: true; LOCAL carries an
    // explicit enabled:false for the plugin so the WR-03 promotion arm fires
    // a config write against the --local target. The flip must NOT
    // re-declare the marketplace in local -- the bare {source} entry would
    // shadow base wholesale per CFG-02 and flip merged autoupdate to false.
    await writeFile(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        marketplaces: { mp: { source: "/tmp/dummy-mp", autoupdate: true } },
      }),
      "utf8",
    );
    await writeFile(
      configLocalPath,
      JSON.stringify({
        schemaVersion: 1,
        plugins: { "foo@mp": { enabled: false } },
      }),
      "utf8",
    );

    const { ctx } = makeCtx(cwd);
    await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
      local: true,
    });

    const localCfg = (await readConfig(configLocalPath)) as {
      marketplaces?: Record<string, { source?: string; autoupdate?: boolean }>;
      plugins?: Record<string, { enabled?: boolean }>;
    };
    // The flip landed in local...
    assert.equal(localCfg.plugins?.["foo@mp"]?.enabled, true);
    // ...WITHOUT a marketplace re-declaration (CFG-02 shadowing guard).
    assert.equal(
      localCfg.marketplaces?.["mp"],
      undefined,
      "local file must NOT re-declare a base-declared marketplace",
    );

    // The merged view's autoupdate (from base) survives the flip.
    const { mergeScopeConfigs } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-merge.ts");
    const { loadConfig } =
      await import("../../../extensions/pi-claude-marketplace/persistence/config-io.ts");
    const baseLoaded = await loadConfig(configPath);
    const localLoaded = await loadConfig(configLocalPath);
    assert.equal(baseLoaded.status, "valid");
    assert.equal(localLoaded.status, "valid");
    if (baseLoaded.status !== "valid" || localLoaded.status !== "valid") {
      return;
    }

    const merged = mergeScopeConfigs(baseLoaded.config, localLoaded.config);
    assert.equal(merged.marketplaces["mp"]?.entry.autoupdate, true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// C1: corrupt state.json -> setPluginEnabled NEVER re-throws (PR #51 / C1)
// ──────────────────────────────────────────────────────────────────────────

test("C1: corrupt state.json in the requested scope renders a (failed) row (no throw escapes; basename-only path; IL-2)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Seed a CORRUPT state.json in the user scope so resolveCrossScopePluginTarget's
    // loadState call throws on parse. The doc on setPluginEnabled at the entry
    // promises "never re-throws" -- the throw must surface through notify().
    const scopeRoot = path.join(home, ".pi", "agent");
    const extRoot = path.join(scopeRoot, "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    const statePath = path.join(extRoot, "state.json");
    await writeFile(statePath, "{ not json ", "utf8");

    const { ctx, notifications } = makeCtx(cwd);
    // No throw -- the never-re-throws contract holds.
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: true,
      scope: "user",
    });
    assert.equal(outcome, undefined, "standalone mode returns undefined");

    // Exactly one notify call (IL-2 single chokepoint) at error severity.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /\(failed\)/);

    // T-53-02-02: the absolute path must NOT appear; only the basename.
    assert.ok(
      !notifications[0]!.message.includes(statePath),
      `absolute state.json path must not leak: ${notifications[0]!.message}`,
    );
    assert.match(
      notifications[0]!.message,
      /state\.json/,
      "basename should appear in the cause trailer",
    );
  });
});

test("C1: orchestrated mode -- corrupt state.json returns { status: 'failed' } typed outcome; ZERO notify calls", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const scopeRoot = path.join(home, ".pi", "agent");
    const extRoot = path.join(scopeRoot, "pi-claude-marketplace");
    await mkdir(extRoot, { recursive: true });
    await writeFile(path.join(extRoot, "state.json"), "{ not json ", "utf8");

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
    assert.equal(notifications.length, 0, "orchestrated mode never fires notify()");
    assert.ok(outcome);
    assert.equal(outcome.status, "failed");
    if (outcome.status === "failed") {
      // T-53-02-02: the cause string must not embed the absolute state.json
      // path; the basename-only sanitizer collapsed any "/.../state.json"
      // match to "state.json".
      assert.ok(
        !outcome.cause.includes("/.pi/agent/pi-claude-marketplace/state.json"),
        `absolute state.json path must not leak: ${outcome.cause}`,
      );
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// I3: disable cascade partial failure folds dropped + saves shrunken record
// ──────────────────────────────────────────────────────────────────────────

test("I3: disable cascade partial failure mutates state.resources to drop the cascaded artefacts (TR-03 fold) and surfaces (failed)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Seed a populated user-scope record. The cascade primitive walks bridges
    // in skills -> commands -> agents -> mcp order; we make the AGENTS bridge
    // throw (agents-index.json seeded as a directory -> EISDIR on read) so
    // the cascade returns ok:false with non-empty dropped.skills /
    // dropped.commands. The (now-folded) state record must drop only the
    // axes whose bridge actually removed something on disk.
    const { statePath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    const extRoot = path.join(home, ".pi", "agent", "pi-claude-marketplace");
    // Pre-seed populated resources across all 4 axes so the fold has something
    // to drop in skills + prompts, and something to retain in agents + mcp.
    const stateRaw = await readFile(statePath, "utf8");
    const stateJson = JSON.parse(stateRaw) as {
      marketplaces: Record<
        string,
        {
          plugins: Record<
            string,
            {
              resources: {
                skills: string[];
                prompts: string[];
                agents: string[];
                mcpServers: string[];
              };
            }
          >;
        }
      >;
    };
    stateJson.marketplaces.mp!.plugins.foo!.resources.skills = ["s1"];
    stateJson.marketplaces.mp!.plugins.foo!.resources.prompts = ["c1"];
    stateJson.marketplaces.mp!.plugins.foo!.resources.agents = ["a1"];
    stateJson.marketplaces.mp!.plugins.foo!.resources.mcpServers = ["m1"];
    await writeFile(statePath, JSON.stringify(stateJson, null, 2), "utf8");

    // Actually create the on-disk skill + command targets so the bridges
    // report removedNames non-empty when they run. The cascade walks
    // skills -> commands -> agents -> mcp; both skills and commands must
    // see a real target dir to push the name into `removed`.
    const skillsTargetDir = path.join(extRoot, "resources", "skills");
    await mkdir(path.join(skillsTargetDir, "s1"), { recursive: true });
    const promptsTargetDir = path.join(extRoot, "resources", "prompts");
    await mkdir(promptsTargetDir, { recursive: true });
    await writeFile(path.join(promptsTargetDir, "c1.md"), "# c1\n", "utf8");

    // Force the agents bridge to throw by seeding agents-index.json as a
    // directory (EISDIR on read). The cascade's skills + commands bridges
    // run cleanly first, populating dropped.skills + dropped.commands.
    const agentsIndexPath = path.join(extRoot, "agents-index.json");
    await mkdir(agentsIndexPath, { recursive: true });

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

    // Exactly one notify; failed row.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /\(failed\)/);

    // I3: state.json drops the SKILLS + PROMPTS the cascade actually unstaged
    // (their bridge ran ok), but RETAINS the agents + mcp axes (their
    // bridges never ran). The TR-03 fold makes the persisted row reflect
    // only artefacts still on disk.
    const stateAfter = JSON.parse(await readFile(statePath, "utf8")) as typeof stateJson;
    const rec = stateAfter.marketplaces.mp!.plugins.foo!;
    assert.deepEqual(rec.resources.skills, [], "skills folded (bridge ran ok before agents threw)");
    assert.deepEqual(rec.resources.prompts, [], "commands folded");
    assert.deepEqual(
      rec.resources.agents,
      ["a1"],
      "agents retained (bridge threw before completing)",
    );
    assert.deepEqual(rec.resources.mcpServers, ["m1"], "mcp retained (bridge never ran)");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// I4: enable failure threads InstallFailureCapture -> rollback-partial trailer
// ──────────────────────────────────────────────────────────────────────────
// I4 produces rollback-partials only when runInstallLedger's commit phase
// fails midway. Constructing that mid-commit-failure end-to-end requires the
// full install harness; the smaller pin here is that the capture-threading
// type contract holds: the existing fresh-enable test (CR-01) drives the
// happy path (capture stays empty, the row renders as `(installed)`), AND
// the ENBL-03 missing-clone test pins the non-rollback failure path.
// The non-empty-rollbackPartials shape is pinned by install.test.ts's
// `composeInstallFailureMessage` coverage; this test only exercises the
// I4 thread (capture argument provided) without asserting a rollback row.

test("I4: enable branch threads InstallFailureCapture into runInstallLedger (regression: empty capture leaves narrowEnableFailure path intact)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    // Drive the ENBL-03 missing-clone failure -- the capture is constructed
    // but stays empty (no commit phase ran), so the rendered row keeps the
    // catalog `(failed) {source missing}` byte form (regression-pin for the
    // I4 thread: providing the capture argument must not alter the
    // pre-commit failure shape).
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
    // Empty rollbackPartials must NOT promote the reason to `rollback partial`.
    assert.match(notifications[0]!.message, /\(failed\) \{source missing\}/);
    assert.ok(
      !notifications[0]!.message.includes("rollback partial"),
      `empty capture must not render rollback-partial: ${notifications[0]!.message}`,
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Y3 (PR #51): orchestrated overload narrows the return type to
// `Promise<EnableDisablePluginOutcome>` (no `| undefined`). The cascade in
// `applyPluginToggles` relied on this narrowing to drop its silent-vanish
// guard; a future regression that widens the orchestrated arm back to
// `| undefined` would re-introduce the lost row, so both shapes are pinned at
// the type level here.
// ──────────────────────────────────────────────────────────────────────────

test("Y3: orchestrated overload returns EnableDisablePluginOutcome (no | undefined) -- typecheck pin", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
      version: "1.2.3",
    });
    const { ctx } = makeCtx(cwd);
    // The annotation is load-bearing: pre-Y3 the orchestrated arm returned
    // `Promise<EnableDisablePluginOutcome | undefined>` and this assignment
    // would fail typecheck (TS2322 -- `Outcome | undefined` not assignable to
    // `Outcome`). Post-Y3 the overload narrows the return so the assignment
    // succeeds without a non-null assertion or runtime guard.
    const outcome: EnableDisablePluginOutcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "mp",
      plugin: "foo",
      enable: false,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });
    assert.equal(outcome.status, "disabled");
  });
});

test("Y3: standalone overload still returns | undefined -- typecheck pin", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    // The standalone arm fires its own notify() and the caller has nothing to
    // consume; the overload pair preserves that shape so existing callers
    // (edge handlers) keep their current contract.
    const outcome: EnableDisablePluginOutcome | undefined = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "ghost-mp",
      plugin: "foo",
      enable: false,
      scope: "user",
    });
    // @ts-expect-error -- standalone arm DOES carry `| undefined`; assigning
    // to a non-undefined type must remain a TS error so a regression that
    // widens the standalone arm to non-undefined (or narrows it the same way
    // as orchestrated) is caught at typecheck.
    const _narrow: EnableDisablePluginOutcome = outcome;
    void _narrow;
  });
});

test("T1 / PR #51: orchestrated mode enable-success returns { status: 'enabled', name, version } with ZERO notify calls -- pinned alongside the load-time apply-cascade T1 test in apply.test.ts", async () => {
  // Before T1 only the disable / idempotent-enable / not-added orchestrated
  // outcomes had explicit tests at :665, :724, :753. The enable-success
  // outcome (the `enabled` arm of EnableDisablePluginOutcome at
  // enable-disable.ts:115) was exercised only via the standalone CR-01
  // fresh-enable at :340, never through the orchestrated notifications
  // mode the reconcile apply-cascade actually uses. This pins the
  // contract: a fresh enable against a disabled record returns the typed
  // outcome (with the version pin preserved) and fires ZERO notifications
  // (the apply-cascade is the sole projection seam in orchestrated mode).
  await withHermeticHome(async ({ cwd, home }) => {
    await seedRealDisabledMarketplace(home, {
      marketplaceName: "claude-plugins-official",
      pluginName: "foo-plugin",
      version: "1.2.3",
    });
    const { ctx, notifications } = makeCtx(cwd);
    const outcome = await setPluginEnabled({
      ctx,
      pi: makePi(),
      cwd,
      marketplace: "claude-plugins-official",
      plugin: "foo-plugin",
      enable: true,
      scope: "user",
      notifications: { mode: "orchestrated" },
    });

    assert.equal(notifications.length, 0, "orchestrated mode must not fire notifications");
    assert.equal(outcome.status, "enabled");
    if (outcome.status === "enabled") {
      assert.equal(outcome.name, "foo-plugin");
      // ENBL-02: the version pin survives a disable -> enable cycle and
      // surfaces on the typed outcome so apply.ts can compose the
      // `(installed) v1.2.3` row in the reconcile cascade.
      assert.equal(outcome.version, "1.2.3");
    }
  });
});
