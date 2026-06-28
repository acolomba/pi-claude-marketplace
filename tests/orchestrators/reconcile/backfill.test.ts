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
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { applyReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
  type ExtensionState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { __resetCacheForTests } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";

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
