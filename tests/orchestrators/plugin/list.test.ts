// tests/orchestrators/plugin/list.test.ts
//
// PL-1..7 orchestrator-level test corpus for listPlugins. Pairs with
// tests/presentation/plugin-list.test.ts (Plan 05-05 byte-stable
// formatter tests) -- this file owns the orchestrator semantics
// (filter union, marketplace narrowing, eager-probe bucketing, manifest
// soft-fail, autoupdate-flag plumbing) and the redundant in-test source
// grep for NFR-5 / PI-2 / PL-3 defense-in-depth.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { listPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}

/**
 * Run a callback with HOME pointing at a tmp dir so user-scope state
 * is hermetic. Restores the original HOME afterward.
 */
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-list-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-list-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
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

interface SeedMarketplaceOpts {
  scope: "user" | "project";
  scopeRoot: string;
  cwd: string;
  mpName: string;
  /** When provided, written to <mpRoot>/.claude-plugin/marketplace.json. */
  manifest?: unknown;
  /** When provided BUT manifest is undefined, manifestPath in state points here (typically a nonexistent file for PL-6 tests). */
  manifestPathOverride?: string;
  /** Installed plugin records keyed by plugin name. */
  installed?: Record<string, { version: string }>;
  /** When provided, sets `autoupdate` on the marketplace record. */
  autoupdate?: boolean;
  /** When provided, plugin source dirs at these names get created so resolver probes find them. */
  installablePluginDirs?: readonly string[];
}

/**
 * Seed a marketplace into the given scope's state.json. Writes the
 * marketplace.json on disk (under <scopeRoot>/marketplaces/<mpName>) when
 * `manifest` is provided. Creates installable source dirs under the same
 * marketplace root so resolveStrict can find them.
 */
async function seedMarketplace(opts: SeedMarketplaceOpts): Promise<void> {
  const { scope, scopeRoot, cwd, mpName, manifest } = opts;
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Marketplace root: a tmp dir owned by this seed call.
  const mpRoot = path.join(scopeRoot, "marketplaces", mpName);
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });

  let manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  if (manifest !== undefined) {
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
  }

  if (opts.manifestPathOverride !== undefined) {
    manifestPath = opts.manifestPathOverride;
  }

  // Create installable plugin source dirs so resolver probes succeed.
  for (const rel of opts.installablePluginDirs ?? []) {
    await mkdir(path.join(mpRoot, rel), { recursive: true });
  }

  // Build state, merging into any pre-existing state for the scope.
  const stateJsonPath = path.join(locations.extensionRoot, "state.json");
  let existing: { marketplaces: Record<string, unknown> } = { marketplaces: {} };
  try {
    const raw = await readFile(stateJsonPath, "utf8");
    existing = JSON.parse(raw) as { marketplaces: Record<string, unknown> };
  } catch {
    /* no existing state.json -- first marketplace in scope */
  }

  const plugins: Record<string, unknown> = {};
  for (const [name, info] of Object.entries(opts.installed ?? {})) {
    plugins[name] = {
      version: info.version,
      resolvedSource: "./placeholder",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  const record: Record<string, unknown> = {
    name: mpName,
    scope,
    source: pathSource(`./${mpName}-src`),
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot: mpRoot,
    plugins,
  };
  if (opts.autoupdate !== undefined) {
    record.autoupdate = opts.autoupdate;
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: { ...existing.marketplaces, [mpName]: record },
    // saveState validates -- the merged shape must satisfy STATE_SCHEMA.
  } as unknown as Parameters<typeof saveState>[1]);
}

// ──────────────────────────────────────────────────────────────────────────
// Empty state (PL-2 sentinel)
// ──────────────────────────────────────────────────────────────────────────

test("PL-2 / SC-6: empty state in both scopes renders 'No plugins configured.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "No plugins configured.");
    assert.equal(notifications[0]!.severity, undefined);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-1 filter union semantics
// ──────────────────────────────────────────────────────────────────────────

test("PL-1: no flags = every bucket (installed, available, uninstallable)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0" },
          { name: "beta", source: "./beta", version: "2.0.0" },
          { name: "gamma", source: "./gamma", version: "3.0.0" },
        ],
      },
      // alpha is installed; beta has on-disk dir (available); gamma has NO
      // on-disk dir (resolver bucket = uninstallable).
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    assert.match(out, /● alpha/);
    assert.match(out, /○ beta/);
    assert.match(out, /⊘ gamma/);
  });
});

test("PL-1: --installed alone shows only installed plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0" },
          { name: "beta", source: "./beta", version: "2.0.0" },
        ],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /● alpha/);
    assert.equal(out.includes("○ beta"), false);
    assert.equal(out.includes("⊘"), false);
  });
});

test("PL-1: --available alone shows only available (not-yet-installed installable) plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0" },
          { name: "beta", source: "./beta", version: "2.0.0" },
        ],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user", available: true });
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.match(out, /○ beta/);
    assert.equal(out.includes("⊘"), false);
  });
});

test("PL-1: --unavailable alone shows only uninstallable (⊘) plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0" },
          { name: "beta", source: "./beta", version: "2.0.0" },
          { name: "gamma", source: "./gamma", version: "3.0.0" },
        ],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user", unavailable: true });
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.equal(out.includes("○ beta"), false);
    assert.match(out, /⊘ gamma/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-2: nested-tree, grouped by scope
// ──────────────────────────────────────────────────────────────────────────

test("PL-2: bare form enumerates BOTH scopes; both render with scope-header line separation", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");

    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "u-mp",
      manifest: { name: "u-mp", plugins: [] },
    });
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "p-mp",
      manifest: { name: "p-mp", plugins: [] },
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd });
    const out = notifications[0]!.message;
    // user scope header BEFORE project scope header (renderer ordering).
    const userIdx = out.indexOf("user scope");
    const projectIdx = out.indexOf("project scope");
    assert.ok(userIdx !== -1, `expected 'user scope' header in: ${out}`);
    assert.ok(projectIdx !== -1, `expected 'project scope' header in: ${out}`);
    assert.ok(userIdx < projectIdx, "user scope should render before project scope");
    assert.match(out, /u-mp/);
    assert.match(out, /p-mp/);
  });
});

test("PL-2: same plugin name in two marketplaces stays under both marketplace headers", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");

    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "anthropics",
      manifest: { name: "anthropics", plugins: [{ name: "superpowers", source: "./superpowers" }] },
      installablePluginDirs: ["superpowers"],
    });
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "superpowers-marketplace",
      manifest: {
        name: "superpowers-marketplace",
        plugins: [
          { name: "superpowers", source: { source: "url", url: "https://example.test/s.git" } },
        ],
      },
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    const anthropicsIdx = out.indexOf("anthropics");
    const superpowersMpIdx = out.indexOf("superpowers-marketplace");
    assert.ok(anthropicsIdx !== -1, out);
    assert.ok(superpowersMpIdx !== -1, out);
    assert.ok(anthropicsIdx < superpowersMpIdx, out);
    assert.match(out.slice(anthropicsIdx, superpowersMpIdx), /○ superpowers/);
    assert.match(out.slice(superpowersMpIdx), /⊘ superpowers .*unsupported source kind: url/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-3: marketplace narrowing
// ──────────────────────────────────────────────────────────────────────────

test("PL-3: opts.marketplace narrows to a single marketplace; other marketplaces are excluded", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "official",
      manifest: {
        name: "official",
        plugins: [{ name: "off-plug", source: "./off-plug", version: "1.0.0" }],
      },
      installed: { "off-plug": { version: "1.0.0" } },
      installablePluginDirs: ["off-plug"],
    });
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "community",
      manifest: {
        name: "community",
        plugins: [{ name: "com-plug", source: "./com-plug", version: "1.0.0" }],
      },
      installed: { "com-plug": { version: "1.0.0" } },
      installablePluginDirs: ["com-plug"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user", marketplace: "official" });
    const out = notifications[0]!.message;
    assert.match(out, /official/);
    assert.match(out, /off-plug/);
    assert.equal(out.includes("community"), false);
    assert.equal(out.includes("com-plug"), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-5: upgradable via STRING comparison (NOT semver)
// ──────────────────────────────────────────────────────────────────────────

test("PL-5: installed version differs from manifest version -> upgradable", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "1.0.1" }],
      },
      installed: { plug: { version: "1.0.0" } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● plug \(1\.0\.0\) upgradable/);
  });
});

test("PL-5: installed version equals manifest version -> NOT upgradable", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "1.0.0" }],
      },
      installed: { plug: { version: "1.0.0" } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● plug \(1\.0\.0\)/);
    assert.equal(out.includes("upgradable"), false);
  });
});

test("PL-5: hash-* versions string-compare (any difference -> upgradable; NOT semver)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "hash-abcdef012345" }],
      },
      installed: { plug: { version: "hash-fedcba543210" } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /upgradable/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-6: manifest soft-fail
// ──────────────────────────────────────────────────────────────────────────

test("PL-6: manifest load failure surfaces as [warning] line; installed plugins still render", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fakePath = path.join(userRoot, "marketplaces", "mp1", ".claude-plugin", "no-such.json");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // No manifest written; manifestPathOverride forces the recorded
      // manifestPath to a file that does NOT exist on disk.
      manifestPathOverride: fakePath,
      installed: { stranded: { version: "9.9.9" } },
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /\[warning\] could not load manifest for "mp1"/);
    // Installed plugin still renders despite manifest absence.
    assert.match(out, /● stranded \(9\.9\.9\)/);
  });
});

test("PL-6: per-entry resolver-probe failures bucket as ⊘ with notes; list continues across remaining entries", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "good", source: "./good", version: "1.0.0" },
          { name: "missing", source: "./missing-source-dir", version: "1.0.0" },
        ],
      },
      installablePluginDirs: ["good"],
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // The good entry still buckets as available.
    assert.match(out, /○ good/);
    // The missing entry buckets as uninstallable with the resolver note
    // appended after the head line (' -- ' prefix per Plan 05-05 renderer).
    assert.match(out, /⊘ missing/);
    assert.match(out, /-- .*source dir does not exist/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-7: [autoupdate] header tag
// ──────────────────────────────────────────────────────────────────────────

test("PL-7: marketplace with autoupdate=true renders ' [autoupdate]' on the marketplace header line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "auto-mp",
      manifest: { name: "auto-mp", plugins: [] },
      autoupdate: true,
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /auto-mp \[autoupdate\]/);
  });
});

test("PL-7: marketplace with autoupdate=false (or undefined) does NOT render the [autoupdate] tag", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "plain-mp",
      manifest: { name: "plain-mp", plugins: [] },
      autoupdate: false,
    });

    const { ctx, notifications } = makeCtx();
    await listPlugins({ ctx, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /plain-mp/);
    assert.equal(out.includes("[autoupdate]"), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Source-grep self-tests (NFR-5 / PI-2 / PL-3 defense-in-depth)
//
// Redundant with tests/architecture/no-orchestrator-network.test.ts
// (Plan 05-02) but lives here so a future contributor of list logic
// reads the constraint at the same file they are editing. Mirror of
// tests/orchestrators/marketplace/list.test.ts:175-216 stripComments
// pattern.
// ──────────────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("NFR-5 / PL-3: list.ts source has zero imports from platform/git", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
});

test("NFR-5 / PL-3: list.ts source contains no DEFAULT_GIT_OPS or gitOps reference", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(code.includes("gitOps"), false);
});

test("D-04 corollary: list.ts does not use withStateGuard (read-only)", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("withStateGuard"), false);
});
