// tests/orchestrators/reconcile/backfill.test.ts
//
// BFILL-01 / BFILL-02 behavior proofs for the load-time backfill scan wired
// into `applyReconcile` (`applyBackfillForScope`).
//
// Coverage:
//   - BFILL-02 gate: a changed/absent `lastReconciledExtensionVersion` stamp
//     opens the scan and stamps the running EXTENSION_VERSION; an unchanged
//     stamp skips the scan entirely and leaves state.json mtime untouched
//     (RECON-05). The stamp closes the gate even with ZERO force-installed
//     plugins to promote (D-68-03), and a no-promotion load stays silent.
//   - BFILL-01 re-materialize: a force-installed plugin whose supported set
//     grew is re-materialized in place via the reinstall primitive (cache-only,
//     NFR-5). A full promotion records `compatibility.installable: true` with an
//     empty unsupported set and carries an `(installed)` cascade row; a partial
//     re-materialize stays force-installed with the real non-empty unsupported
//     set and carries a `force-installed` row. A non-grown force-installed
//     plugin is skipped (no reinstall, no row). Promotion rows fold into the
//     single applyReconcile cascade (RECON-04).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import lockfile from "proper-lockfile";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_applyBackfillForScopeIsolated,
  __test_scanForceInstalledBackfills,
  applyReconcile,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
  type ExtensionState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { __resetCacheForTests } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";

import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

const STUB_PI = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "backfill-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "backfill-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  __resetCacheForTests();
  try {
    return await fn({ cwd });
  } finally {
    __resetCacheForTests();
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

    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

interface PluginTree {
  readonly skill?: boolean;
  readonly command?: boolean;
  /** lspServers convention file -- an unsupported component kind. */
  readonly lsp?: boolean;
}

/** Lay down the on-disk plugin source tree under `<marketplaceRoot>/plugins/<name>`. */
async function writePluginTree(
  marketplaceRoot: string,
  pluginName: string,
  tree: PluginTree,
): Promise<void> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName }),
  );

  if (tree.skill === true) {
    const skillDir = path.join(pluginRoot, "skills", "tool");
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: tool\n---\n\nbody\n`);
  }

  if (tree.command === true) {
    const commandDir = path.join(pluginRoot, "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(path.join(commandDir, "deploy.md"), `# deploy\n\nbody\n`);
  }

  if (tree.lsp === true) {
    await writeFile(
      path.join(pluginRoot, ".lsp.json"),
      JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
    );
  }
}

/** Write the marketplace manifest declaring the given plugins. */
async function writeManifest(
  marketplaceRoot: string,
  marketplaceName: string,
  pluginNames: readonly string[],
): Promise<string> {
  const manifestDir = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: pluginNames.map((name) => ({
        name,
        version: "1.0.0",
        source: `./plugins/${name}`,
      })),
    }),
  );
  return manifestPath;
}

type PluginRecord = ExtensionState["marketplaces"][string]["plugins"][string];

/**
 * Build a plugin install record with a caller-controlled compatibility set so a
 * test can simulate a force-installed plugin whose recorded supported set is
 * smaller than what the on-disk plugin now resolves to (the boundary moved).
 */
function pluginRecord(opts: {
  readonly pluginRoot: string;
  readonly installable: boolean;
  readonly supported: readonly string[];
  readonly unsupported: readonly string[];
}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: opts.pluginRoot,
    compatibility: {
      installable: opts.installable,
      notes: [],
      supported: [...opts.supported],
      unsupported: [...opts.unsupported],
    },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

interface SeedOptions {
  readonly cwd: string;
  readonly marketplaceName?: string;
  /** Plugins to materialize on disk + declare in the manifest. */
  readonly trees?: Readonly<Record<string, PluginTree>>;
  /** Plugin install records to write into state.json. */
  readonly records?: Readonly<Record<string, PluginRecord>>;
  /** Stamp written to state.json; omit for an absent stamp. */
  readonly stamp?: string;
  /** When set, write claude-plugins.json declaring these plugin keys (`name@mp`). */
  readonly configPluginKeys?: readonly string[];
}

/**
 * Seed a project-scope marketplace: write the on-disk plugin trees + manifest,
 * then write state.json with the supplied records + stamp. Returns the
 * marketplaceRoot and the extensionRoot.
 */
async function seedScope(
  opts: SeedOptions,
): Promise<{ marketplaceRoot: string; extensionRoot: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  const trees = opts.trees ?? {};
  for (const [name, tree] of Object.entries(trees)) {
    await writePluginTree(marketplaceRoot, name, tree);
  }

  const manifestPath = await writeManifest(marketplaceRoot, marketplaceName, Object.keys(trees));

  const loc = locationsFor("project", opts.cwd);
  await mkdir(loc.extensionRoot, { recursive: true });

  const state: ExtensionState = {
    schemaVersion: 2,
    ...(opts.stamp !== undefined && { lastReconciledExtensionVersion: opts.stamp }),
    marketplaces: {
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: { ...(opts.records ?? {}) },
      },
    },
  };
  await saveState(loc.extensionRoot, state);

  if (opts.configPluginKeys !== undefined) {
    const config = {
      schemaVersion: 1,
      marketplaces: { [marketplaceName]: { source: `./${path.basename(marketplaceRoot)}` } },
      plugins: Object.fromEntries(opts.configPluginKeys.map((k) => [k, {}])),
    };
    await writeFile(loc.configJsonPath, JSON.stringify(config, null, 2), "utf8");
  }

  return { marketplaceRoot, extensionRoot: loc.extensionRoot };
}

async function runReconcile(cwd: string, ctx: MockCtx): Promise<void> {
  await applyReconcile({
    ctx: ctx as unknown as ExtensionContext,
    pi: STUB_PI,
    cwd,
    scope: "project",
  });
}

test("BFILL-02: a changed extension-version stamp opens the gate and stamps the running version", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { extensionRoot } = await seedScope({ cwd, stamp: "0.0.0" });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});

test("BFILL-02: an absent stamp opens the gate (scan-once) and stamps the running version", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { extensionRoot } = await seedScope({ cwd });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});

test("BFILL-02 / RECON-05: an unchanged stamp skips the scan and leaves state.json untouched and silent", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: EXTENSION_VERSION,
      configPluginKeys: [],
    });
    const ctx = makeCtx();
    const statePath = locationsFor("project", cwd).stateJsonPath;
    const before = await stat(statePath);

    await runReconcile(cwd, ctx);

    const after = await stat(statePath);
    // RECON-05: gate closed -> no scan, no stamp write, mtime preserved.
    assert.equal(after.mtimeMs, before.mtimeMs);
    // Zero outcomes -> silent (NFR-2 / A4).
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});

test("BFILL-02 / D-68-03: a gate-open load with zero force-installed plugins still stamps and emits no notification", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // One CLEAN plugin (installable: true) -> the scan finds no force-installed
    // candidate, so nothing is re-materialized, yet the gate still stamps.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: true,
          supported: ["skills"],
          unsupported: [],
        }),
      },
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // Pitfall 4 / D-68-03: stamp closes the gate even with nothing backfilled.
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
    // Zero promotion rows -> silent.
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
  });
});

function pluginRecordOf(state: ExtensionState, marketplace: string, plugin: string): PluginRecord {
  const record = state.marketplaces[marketplace]?.plugins[plugin];
  assert.ok(record !== undefined, `expected ${plugin}@${marketplace} recorded`);
  return record;
}

test("BFILL-01: a full promotion re-materializes the plugin to (installed) with an empty unsupported set", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // On-disk plugin advertises skills + commands (both supported now). The
    // record was stored when only `skills` was supported (force-installed with
    // `commands` recorded unsupported), so the supported set grew.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
      },
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    // Full promotion: re-resolved installable, empty unsupported.
    assert.equal(record.compatibility.installable, true);
    assert.deepEqual(record.compatibility.unsupported, []);
    assert.ok(record.compatibility.supported.includes("commands"));
    // SAME recorded version -- a promotion is not an upgrade (D-68-02).
    assert.equal(record.version, "1.0.0");

    // RECON-04: exactly one cascade carrying one (installed) row for hello.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(body.includes("hello") && body.includes("(installed)"), `got:\n${body}`);
    assert.ok(!body.includes("/reload to pick up changes"), `RECON-04 trailer leaked:\n${body}`);
  });
});

test("BFILL-01: a partial re-materialize stays force-installed and records the real unsupported set", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // On-disk plugin advertises skills + an lspServers convention file (an
    // unsupported kind). The record was stored with an EMPTY supported set, so
    // the re-resolved `skills` makes the supported set grow -- but lspServers
    // keeps it `unsupported`, so it stays force-installed.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, lsp: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: [],
          unsupported: ["lspServers", "skills"],
        }),
      },
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    // Partial: still force-installed with the REAL non-empty unsupported set.
    assert.equal(record.compatibility.installable, false);
    assert.deepEqual(record.compatibility.unsupported, ["lspServers"]);
    assert.ok(record.compatibility.supported.includes("skills"));

    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(body.includes("hello") && body.includes("(force-installed)"), `got:\n${body}`);
  });
});

test("BFILL-01: a force-installed plugin whose supported set did not grow is skipped (no row, no churn)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // On-disk plugin advertises only skills; the record already lists skills as
    // its supported set, so the boundary did not move for THIS plugin.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["themes"],
        }),
      },
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // No re-materialize: the record is untouched (still force-installed,
    // themes still recorded unsupported, empty resources).
    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    assert.equal(record.compatibility.installable, false);
    assert.deepEqual(record.compatibility.unsupported, ["themes"]);
    assert.deepEqual(record.resources.skills, []);
    // Zero promotion rows -> silent. The gate still stamped (gate-open).
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});

test("RECON-04: a load that backfills one plugin AND installs another emits exactly one cascade with both rows", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is recorded force-installed with a grown supported set (backfill);
    // world is declared in config but NOT recorded -> the apply pass installs
    // it. Both rows must fold into the single cascade.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true }, world: { skill: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
      },
      configPluginKeys: ["hello@mp", "world@mp"],
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // world was installed by the apply pass.
    const state = await loadState(extensionRoot);
    assert.ok(state.marketplaces["mp"]?.plugins["world"] !== undefined);
    // hello was promoted.
    assert.equal(pluginRecordOf(state, "mp", "hello").compatibility.installable, true);

    // RECON-04: exactly one notify carrying BOTH rows.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(body.includes("hello"), `expected hello row:\n${body}`);
    assert.ok(body.includes("world"), `expected world row:\n${body}`);
  });
});

test("NFR-5: the backfill scan and re-materialize perform no network call", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
      },
    });
    const ctx = makeCtx();
    let cloneCalls = 0;
    const failingGitOps = {
      clone: (): Promise<never> => {
        cloneCalls += 1;
        return Promise.reject(new Error("network access is forbidden on the load path (NFR-5)"));
      },
    } as unknown as NonNullable<Parameters<typeof applyReconcile>[0]["gitOps"]>;

    await applyReconcile({
      ctx: ctx as unknown as ExtensionContext,
      pi: STUB_PI,
      cwd,
      scope: "project",
      gitOps: failingGitOps,
    });

    // The backfill path is cache-only resolveStrict + reinstall -- it never
    // touches gitOps.
    assert.equal(cloneCalls, 0);
    // And it still promoted the plugin offline.
    assert.equal(
      pluginRecordOf(await loadState(extensionRoot), "mp", "hello").compatibility.installable,
      true,
    );
  });
});

test("WR-01 / WR-05: a config-present, state.json-absent scope with no force-installed plugins creates no state.json and stays silent", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const loc = locationsFor("project", cwd);
    // The scope has a config file but NO state.json on disk. The read pass loads
    // DEFAULT_STATE inside the lock (so `state` is defined), the empty config
    // yields an empty plan, and there is nothing to backfill.
    await mkdir(loc.extensionRoot, { recursive: true });
    await writeFile(
      loc.configJsonPath,
      JSON.stringify({ schemaVersion: 1, marketplaces: {}, plugins: {} }, null, 2),
      "utf8",
    );
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // WR-05: the gate must NOT bring an unsolicited state.json into existence
    // purely to record the version stamp when there is nothing to promote.
    assert.equal(existsSync(loc.stateJsonPath), false);
    // Empty-and-clean reconcile -> silent (NFR-2 / A4).
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
  });
});

test("WR-02: a held scope lock on the stamp write is coerced to a structured row and does not abort the cascade", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Gate open (stamp 0.0.0), state.json exists, zero force-installed plugins
    // -> the scan is a no-op and the only state.json write is the stamp.
    const { extensionRoot } = await seedScope({ cwd, stamp: "0.0.0" });
    const loc = locationsFor("project", cwd);
    const state = await loadState(extensionRoot);
    const ctx = makeCtx();

    // Hold the per-scope state lock so the stamp's withStateGuard acquisition
    // fails with StateLockHeldError (a concurrent process owns the scope lock).
    const release = await lockfile.lock(loc.extensionRoot, {
      lockfilePath: loc.stateLockFile,
      realpath: false,
      retries: 0,
      stale: 10_000,
      update: 2_000,
    });

    // A sibling outcome already accumulated by the apply pass -- it MUST survive.
    const outcomes: PerEntryOutcome[] = [
      { kind: "mp-added", scope: "project", marketplace: "sib" },
    ];

    try {
      // Must NOT throw: the lock-held throw is coerced into a structured row.
      await __test_applyBackfillForScopeIsolated(
        { ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" },
        "project",
        { scope: "project", plan: undefined, invalidOutcomes: [], state, stateExisted: true },
        outcomes,
      );
    } finally {
      await release();
    }

    // The sibling outcome survived (cascade not aborted) ...
    assert.ok(outcomes.some((o) => o.kind === "mp-added"));
    // ... and the stamp throw surfaced as a structured lock-held row.
    const failed = outcomes.find((o) => o.kind === "invalid-block");
    assert.ok(failed !== undefined, "expected an invalid-block row for the stamp throw");
    assert.equal(failed.basename, "state.json");
    assert.equal(failed.reason, "lock held");
  });
});

test("WR-03: a plugin already touched by applyPlan this load is not double-emitted by the backfill scan", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is force-installed with a grown on-disk supported set (skills +
    // commands; recorded supported only skills) -- a backfill candidate.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
      },
    });
    const state = await loadState(extensionRoot);
    const ctx = makeCtx();

    // Simulate applyPlan having ALREADY emitted a transition row for hello this
    // load (an enable re-installs the plugin and emits an (installed) row).
    const outcomes: PerEntryOutcome[] = [
      { kind: "plugin-enabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ];

    await __test_scanForceInstalledBackfills(
      { ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" },
      "project",
      state,
      outcomes,
    );

    // The scan deduped against the prior row: no second row for hello, and no
    // redundant plugin-backfilled overwrite.
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes.filter((o) => "plugin" in o && o.plugin === "hello").length, 1);
    assert.ok(!outcomes.some((o) => o.kind === "plugin-backfilled"));
  });
});

test("SF-01: a grown force-installed plugin whose re-materialize FAILS surfaces a (failed) row and stays force-installed", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is force-installed with a grown on-disk supported set (skills +
    // commands; recorded supported only skills) -> a backfill candidate that
    // re-resolves installable. But a SIBLING recorded plugin already owns the
    // generated skill name `hello-tool`, so the re-materialize's
    // assertNoCrossPluginConflicts trips -> reinstallPlugin (render: "none")
    // CATCHES its own throw and RETURNS a `failed` partition. SF-01: maybeBackfill
    // surfaces that as a plugin-scoped (failed) row on the same cascade instead
    // of silently dropping it, and the record stays force-installed.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
        // A clean installed plugin whose recorded resources already own the
        // `hello-tool` generated skill name -> cross-plugin conflict on backfill.
        conflictor: {
          version: "1.0.0",
          resolvedSource: path.join(cwd, "mp-src", "plugins", "conflictor"),
          compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
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
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // SF-01: the failure surfaced as a single cascade carrying a (failed) row.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(body.includes("hello") && body.includes("(failed)"), `got:\n${body}`);

    // The record was NOT promoted -- it stays force-installed.
    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    assert.equal(record.compatibility.installable, false);

    // SF-02: a genuine re-materialize failure leaves the version gate OPEN so the
    // scan retries next load -- the stamp is NOT advanced.
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, "0.0.0");
  });
});

test("BFILL-01: a concurrent uninstall (skipped partition) emits no promotion row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is force-installed with a grown on-disk supported set -> a backfill
    // candidate. The read-pass snapshot still carries hello, but by the time the
    // re-materialize acquires its own lock the record is GONE (a concurrent
    // process uninstalled it), so reinstallPlugin returns `skipped`. That benign
    // skip must NOT emit an (installed)/(force-installed) promotion row.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true, command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["commands"],
        }),
      },
    });
    // Snapshot (still carries hello) drives the scan; the on-disk state.json is
    // then rewritten to drop hello (marketplace kept), simulating the race.
    const snapshot = await loadState(extensionRoot);
    const concurrent = structuredClone(snapshot);
    delete concurrent.marketplaces["mp"]!.plugins["hello"];
    await saveState(extensionRoot, concurrent);

    const ctx = makeCtx();
    const outcomes: PerEntryOutcome[] = [];
    await __test_scanForceInstalledBackfills(
      { ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" },
      "project",
      snapshot,
      outcomes,
    );

    // Concurrent uninstall -> skipped -> no promotion row of any kind.
    assert.equal(outcomes.length, 0);
    assert.ok(!outcomes.some((o) => o.kind === "plugin-backfilled"));
  });
});

test("SF-02: an offline-unresolvable force-installed plugin (manifest omits the entry) is a silent skip and still stamps", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is recorded force-installed but is NOT declared in the marketplace
    // manifest (empty trees -> `plugins: []`). The offline re-resolve finds no
    // entry -> resolveRecordedPluginOffline returns undefined -> a benign silent
    // skip (NOT a failure). Zero notifications, record untouched, and -- because
    // this is a benign skip, not a genuine failure -- the version gate still
    // closes (SF-02: only an unreadable-manifest I/O throw keeps it open).
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["themes"],
        }),
      },
    });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // Silent skip -> zero notifications.
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
    // Record untouched -- still force-installed with its recorded unsupported set.
    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    assert.equal(record.compatibility.installable, false);
    assert.deepEqual(record.compatibility.unsupported, ["themes"]);
    // The gate closed: an absent/invalid ENTRY is benign, so the stamp still writes.
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});

test("SF-02: an UNREADABLE manifest I/O throw surfaces a plugin-scoped (failed) row and leaves the version gate OPEN", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // hello is recorded force-installed AND declared in the manifest, but the
    // manifest file is then corrupted. resolveRecordedPluginOffline's
    // loadMarketplaceManifest THROWS (unparseable JSON); SF-02 lets it propagate
    // to the per-plugin catch in scanForceInstalledBackfills, which surfaces a
    // plugin-scoped (failed) row naming hello (NOT a generic state.json row) and
    // keeps the version gate OPEN (stamp NOT advanced) so the scan retries.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { skill: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["themes"],
        }),
      },
    });
    // Corrupt the cached marketplace manifest so the offline re-resolve throws.
    const manifestPath = path.join(cwd, "mp-src", ".claude-plugin", "marketplace.json");
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // Per-plugin isolation: the throw is surfaced as a single plugin-scoped
    // (failed) row for hello (never aborts the cascade), not a state.json row.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(body.includes("hello") && body.includes("(failed)"), `got:\n${body}`);
    assert.ok(!body.includes("state.json"), `expected no generic state.json row:\n${body}`);
    // SF-02: the gate stays OPEN so the scan self-heals next load -- stamp untouched.
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, "0.0.0");
  });
});

test("per-plugin isolation: a corrupt-manifest plugin surfaces its own (failed) row while a healthy sibling under another marketplace is still promoted", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Two force-installed plugins under two marketplaces. `bad`'s cached manifest
    // is corrupt, so alpha's offline re-resolve THROWS. `good`'s bravo has grown
    // (skills + commands on disk; recorded supported only skills), so it is a
    // promotable backfill candidate. Per-plugin isolation: alpha's throw must
    // surface its OWN plugin-scoped (failed) row and keep the gate OPEN, while
    // bravo is still promoted to (installed) on the SAME cascade -- proving one
    // corrupt manifest does not block a healthy sibling under another marketplace.
    const badRoot = path.join(cwd, "bad-src");
    const goodRoot = path.join(cwd, "good-src");
    await writePluginTree(badRoot, "alpha", { skill: true });
    await writePluginTree(goodRoot, "bravo", { skill: true, command: true });
    const badManifest = await writeManifest(badRoot, "bad", ["alpha"]);
    const goodManifest = await writeManifest(goodRoot, "good", ["bravo"]);
    // Corrupt the `bad` marketplace manifest so alpha's offline re-resolve throws.
    await writeFile(badManifest, "{ this is not valid json at all", "utf8");

    const loc = locationsFor("project", cwd);
    await mkdir(loc.extensionRoot, { recursive: true });
    // `bad` is inserted BEFORE `good` so the corrupt marketplace is scanned first
    // -- proving the throw does not unwind the loop before `good` is reached.
    const state: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: "0.0.0",
      marketplaces: {
        bad: {
          name: "bad",
          scope: "project",
          source: pathSource("./bad-src"),
          addedFromCwd: cwd,
          manifestPath: badManifest,
          marketplaceRoot: badRoot,
          plugins: {
            alpha: pluginRecord({
              pluginRoot: path.join(badRoot, "plugins", "alpha"),
              installable: false,
              supported: ["skills"],
              unsupported: ["themes"],
            }),
          },
        },
        good: {
          name: "good",
          scope: "project",
          source: pathSource("./good-src"),
          addedFromCwd: cwd,
          manifestPath: goodManifest,
          marketplaceRoot: goodRoot,
          plugins: {
            bravo: pluginRecord({
              pluginRoot: path.join(goodRoot, "plugins", "bravo"),
              installable: false,
              supported: ["skills"],
              unsupported: ["commands"],
            }),
          },
        },
      },
    };
    await saveState(loc.extensionRoot, state);
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    const persisted = await loadState(loc.extensionRoot);
    // The healthy sibling was promoted despite the corrupt-manifest sibling being
    // scanned first: bravo flips installable -> true.
    assert.equal(pluginRecordOf(persisted, "good", "bravo").compatibility.installable, true);
    // The corrupt-manifest plugin was NOT promoted -- still force-installed.
    assert.equal(pluginRecordOf(persisted, "bad", "alpha").compatibility.installable, false);

    // Exactly one cascade carrying BOTH the promotion row for bravo and a
    // plugin-scoped (failed) row for alpha.
    assert.equal(ctx.ui.notify.mock.calls.length, 1);
    const body = (ctx.ui.notify.mock.calls[0]!.arguments as [string, string?])[0];
    assert.ok(
      body.includes("bravo") && body.includes("(installed)"),
      `expected bravo promotion:\n${body}`,
    );
    assert.ok(
      body.includes("alpha") && body.includes("(failed)"),
      `expected alpha failure:\n${body}`,
    );

    // A per-plugin failure keeps the version gate OPEN -- stamp NOT advanced.
    assert.equal(persisted.lastReconciledExtensionVersion, "0.0.0");
  });
});

test("D-68-03: a length-grown-but-not-superset resolved set does NOT backfill (strict superset only)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Recorded supported is ["skills"], but the on-disk plugin now advertises
    // commands + agents and NO skills dir -> resolved supported ["commands",
    // "agents"]. That is LONGER (2 > 1) but NOT a superset (it drops "skills"),
    // so supportedSetGrew must reject it: no re-materialize, no promotion row.
    const { extensionRoot } = await seedScope({
      cwd,
      stamp: "0.0.0",
      trees: { hello: { command: true } },
      records: {
        hello: pluginRecord({
          pluginRoot: path.join(cwd, "mp-src", "plugins", "hello"),
          installable: false,
          supported: ["skills"],
          unsupported: ["themes"],
        }),
      },
    });
    // Add an agents dir so the on-disk resolve grows to ["commands", "agents"].
    await mkdir(path.join(cwd, "mp-src", "plugins", "hello", "agents"), { recursive: true });
    const ctx = makeCtx();

    await runReconcile(cwd, ctx);

    // Not a strict superset -> no re-materialize: the record is untouched.
    const record = pluginRecordOf(await loadState(extensionRoot), "mp", "hello");
    assert.equal(record.compatibility.installable, false);
    assert.deepEqual(record.compatibility.supported, ["skills"]);
    assert.deepEqual(record.resources.skills, []);
    // No promotion row -> silent (the gate still stamped: gate-open, no failure).
    assert.equal(ctx.ui.notify.mock.calls.length, 0);
    const persisted = await loadState(extensionRoot);
    assert.equal(persisted.lastReconciledExtensionVersion, EXTENSION_VERSION);
  });
});
