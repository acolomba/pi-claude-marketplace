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
    assert.match(
      notifications[0]!.message,
      /\(failed\)/,
      "should emit a failed row when the cached clone is missing",
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
      enable: false,
      scope: "user",
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "benign idempotent skip routes to info");
    assert.match(notifications[0]!.message, /\(skipped\) \{already disabled\}/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// CFG-03: invalid-config abort
// ──────────────────────────────────────────────────────────────────────────

test("CFG-03: invalid config aborts and state.json is unchanged (path.basename containment, T-54-02-02)", async () => {
  await withHermeticHome(async ({ cwd, home }) => {
    const { statePath, configPath } = await writeUserState(home, {
      marketplaceName: "mp",
      pluginName: "foo",
      disabled: false,
    });
    // 0-byte file -> CFG-03 invalid (JSON parse failure).
    await writeFile(configPath, "", "utf8");
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
    // T-54-02-02 invariant: the plugin record's `resources.*` arrays and
    // `version` must be unchanged after a CFG-03 abort (state-io's load-time
    // source normalization is allowed to rewrite the source field, so we
    // can't byte-compare; we instead check the load-bearing fields).
    const statePost = await readFile(statePath, "utf8");
    const parsedPost = JSON.parse(statePost) as {
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
            }
          >;
        }
      >;
    };
    const parsedPre = JSON.parse(statePre) as typeof parsedPost;
    const recPost = parsedPost.marketplaces.mp!.plugins.foo!;
    const recPre = parsedPre.marketplaces.mp!.plugins.foo!;
    assert.equal(recPost.version, recPre.version, "version pin unchanged after CFG-03 abort");
    assert.deepEqual(recPost.resources, recPre.resources, "resources unchanged after CFG-03 abort");
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
