// tests/orchestrators/plugin/list.test.ts
//
// PL-1..7 orchestrator-level test corpus for listPlugins. This file owns the
// orchestrator semantics; the rendered byte-shape contract is covered by the
// catalog UAT in `tests/architecture/catalog-uat.test.ts`. The list surface
// emits its rows through the `notify()` NotificationMessage payload.
//
//   - PL-1 filter union (--installed / --available / --unavailable)
//   - PL-3 marketplace narrowing
//   - PL-5 (upgradable) string compare
//   - PL-6 manifest soft-fail -> failed-marketplace header per CMC-22
//   - PL-7 <autoupdate> marker on the marketplace header
//   - CMC-21 orphan-fold rule (rendered cross-scope, but the adoption
//     round-trip lives in `tests/integration/fold-adoption.test.ts`)
//
// Plus the redundant in-test source grep for NFR-5 / PI-2 / PL-3
// defense-in-depth (mirror of `tests/architecture/no-orchestrator-network`).
//
// Output-format notes (catalog form):
//   - Plugin row icon + name + [<scope>] (for installed/upgradable) + v<ver>
//     + (status) + optional {reasons} (CMC-22 / CMC-06 / CMC-09)
//   - MSG-PL-6 carve-out: (available) / (unavailable) rows OMIT [<scope>]
//   - Marketplace header: ● <name> [<scope>] [<marker>]
//   - Description on a second 4-space indented line (when present),
//     truncated to col 66 with "..." suffix (63 chars + "...")

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_narrowListFailReason,
  __test_narrowProbeError,
  listPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { narrowUnsupportedKinds } from "../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
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
  /**
   * Installed plugin records keyed by plugin name. `disabled: true` seeds
   * the ENBL-02 empty-resources marker (recorded-but-disabled); the default
   * seeds a populated `resources.skills` -- a PRODUCTION installed record
   * always has at least one populated resources array (the resolver's
   * `requireInstallable` gate rules out zero-component installables), and
   * the empty-resources + installable:true intersection IS the load-bearing
   * "currently disabled" marker (D-54-01 / ENBL-04). `hooksOnly: true`
   * (D-63-04) seeds a hooks-only installed record (resources.hooks
   * populated, every other axis empty) -- the exact shape that triggered
   * the hooks-only-list-disabled regression.
   */
  installed?: Record<
    string,
    {
      version: string;
      disabled?: boolean;
      hooksOnly?: boolean;
      /**
       * FSTAT-01 / D-66-01: seed the persisted `compatibility.unsupported`
       * component-kind list. A non-empty value reproduces a recorded-installed
       * plugin that resolved `unsupported` at install time (the force-installed
       * signal the deriver reads, with `installable: false`).
       */
      unsupported?: readonly string[];
    }
  >;
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
    // ENBL-04: empty resources + installable:true IS the disabled marker;
    // an enabled installed record always has >= 1 populated array.
    // D-63-04: hooksOnly seeds the resources.hooks axis populated while
    // every other axis is empty (the production shape of a hooks-only
    // installed plugin like learning-output-style).
    let resources: {
      skills: string[];
      prompts: string[];
      agents: string[];
      mcpServers: string[];
      hooks: string[];
    };
    if (info.disabled === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] };
    } else if (info.hooksOnly === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [name] };
    } else {
      resources = { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [], hooks: [] };
    }

    // FSTAT-01 / D-66-01: a recorded-installed plugin whose install-time
    // resolution dropped components persists `unsupported` (and
    // `installable: false`). The deriver reads this to render
    // `(partially-installed)` -- no separate persisted flag.
    const unsupported = info.unsupported ?? [];
    const compatibility = {
      installable: unsupported.length === 0,
      notes: [],
      supported: [],
      unsupported: [...unsupported],
    };

    plugins[name] = {
      version: info.version,
      resolvedSource: "./placeholder",
      compatibility,
      resources,
      enabled: info.disabled !== true,
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
    schemaVersion: 2,
    marketplaces: { ...existing.marketplaces, [mpName]: record },
    // saveState validates -- the merged shape must satisfy STATE_SCHEMA.
  } as unknown as Parameters<typeof saveState>[1]);

  // SPLIT-01: autoupdate read-path lives in claude-plugins.json. Seed the
  // config when autoupdate is set so the list/info orchestrators read the
  // autoupdate truth from the new source of truth.
  if (opts.autoupdate !== undefined) {
    const cfgPath = locations.configJsonPath;
    let existingCfg: { marketplaces?: Record<string, { source: string; autoupdate?: boolean }> } =
      {};
    try {
      const raw = await readFile(cfgPath, "utf8");
      existingCfg = JSON.parse(raw) as typeof existingCfg;
    } catch {
      /* no existing config -- first marketplace in scope */
    }

    await saveConfig(
      cfgPath,
      {
        schemaVersion: 1,
        marketplaces: {
          ...(existingCfg.marketplaces ?? {}),
          [mpName]: { source: `./${mpName}-src`, autoupdate: opts.autoupdate },
        },
      },
      locations.scopeRoot,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Empty state (CMC-10 / MSG-ER-1 sentinel)
// ──────────────────────────────────────────────────────────────────────────

test("CMC-10: empty state in both scopes renders V2 `(no marketplaces)` sentinel", async () => {
  // Emits `(no marketplaces)` because the top-level
  // `marketplaces: []` array is the structural empty sentinel
  // (D-16-17). Catalog reference:
  // docs/output-catalog.md:139-145 -- `<!-- catalog-state: empty -->`.
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
    assert.equal(notifications[0]!.severity, undefined);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-1 filter union semantics (catalog rows reuse the compact-line shape)
// ──────────────────────────────────────────────────────────────────────────

test("PL-1: no flags = every bucket (installed, available, unavailable)", async () => {
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
      // on-disk dir (resolver bucket = unavailable).
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // Per D-16-17 orphan-fold rule the renderer suppresses `[<scope>]`
    // on a plugin row when `p.scope === mp.scope`. Here mp.scope and the
    // installed plugin's scope are both "user", so the bracket is
    // omitted on the alpha row.
    // SNM-11: `available` / `unavailable` rows never carry a `scope`
    // field by construction, so their brackets are always absent.
    // UAT G-21-01: list-surface inventory row emits no reload-hint
    // trailer; installedRowMessage emits `status: "present"` (list-only)
    // so the trailer is correctly absent.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ● alpha v1.0.0 (installed)",
        "  ○ beta v2.0.0 (available)",
        "  ⊘ gamma v3.0.0 (unavailable) {unsupported source}",
      ].join("\n"),
    );
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    // plugin.scope === mp.scope (both "user") -> bracket suppressed
    // per D-16-17. The installed alpha row is `● alpha v1.0.0 (installed)`,
    // not `● alpha [user] v1.0.0 (installed)`. The `[user]` marker
    // appears on the marketplace header only.
    assert.match(out, /● alpha v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("● alpha [user]"), false, out);
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.match(out, /○ beta v2\.0\.0 \(available\)/);
    assert.equal(out.includes("⊘"), false);
  });
});

test("PL-1: --unavailable alone shows only unavailable (⊘) plugins", async () => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.equal(out.includes("○ beta"), false);
    assert.match(out, /⊘ gamma v3\.0\.0 \(unavailable\)/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RSTA-01 / RSTA-07 / D-80-03 / D-80-07: the `(remote)` git-source row + the
// `--remote` filter. A not-installed git source with no materialized clone
// renders `◌ <name> (remote)` (bare) and lands in the `remote` filter bucket;
// `--available` no longer admits it (the intended behavior change). A WARM clone
// resolves the three-way verdict against the on-disk tree.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Stage a warm git mirror at the user-scope URL-keyed mirror dir carrying a
 * minimal installable plugin, so the presence probe resolves `materialized` and
 * `resolveStrict` validates the on-disk tree. Uses a canonical url (no `.git`)
 * so the staged mirror key matches the parse-time canonical url the probe hashes.
 */
async function stageWarmMirror(cwd: string, canonicalUrl: string): Promise<void> {
  const locations = locationsFor("user", cwd);
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(canonicalUrl));
  await mkdir(path.join(mirrorDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "warm-plugin" }),
  );
  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDir, filepath: ".claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
}

test("RSTA-01 / D-80-03: a not-installed git source with no clone renders bare `◌ <name> (remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "gitplug", source: "https://example.com/plugin.git", version: "1.0.0" }],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Byte-equal: the bare `(remote)` row -- no scope bracket (SNM-11), no
    // reason brace (D-80-03).
    assert.equal(out, ["● mp1 [user]", "  ◌ gitplug v1.0.0 (remote)"].join("\n"), out);
  });
});

test("RSTA-07 / D-80-07: `--remote` selects only the remote bucket; `--available` alone EXCLUDES the cold git source; `--available --remote` includes both", async () => {
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
          // path-source available (on-disk dir seeded below).
          { name: "avail", source: "./avail", version: "1.0.0" },
          // cold git source -> remote.
          { name: "gitplug", source: "https://example.com/plugin.git", version: "2.0.0" },
        ],
      },
      installablePluginDirs: ["avail"],
    });

    // --remote: only the remote git row.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", remote: true });
      const out = notifications[0]!.message;
      assert.match(out, /◌ gitplug v2\.0\.0 \(remote\)/, out);
      assert.equal(out.includes("avail"), false, out);
    }

    // --available alone: the cold git source is EXCLUDED (the intended change);
    // only the path-source available row shows.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
      const out = notifications[0]!.message;
      assert.match(out, /○ avail v1\.0\.0 \(available\)/, out);
      assert.equal(out.includes("gitplug"), false, out);
    }

    // --available --remote: BOTH rows restore the pre-milestone set.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true, remote: true });
      const out = notifications[0]!.message;
      assert.match(out, /○ avail v1\.0\.0 \(available\)/, out);
      assert.match(out, /◌ gitplug v2\.0\.0 \(remote\)/, out);
    }
  });
});

test("RSTA-05 / D-80-04: a not-installed git source with a WARM clone classifies its three-way verdict (`available`), NOT `remote`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // Canonical url (no `.git`) so the manifest source and the staged mirror key
    // agree on the hashed url.
    const canonicalUrl = "https://example.com/plugin";
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "warm-plugin", source: canonicalUrl, version: "1.0.0" }],
      },
    });
    await stageWarmMirror(cwd, canonicalUrl);

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // A warm tree resolves `installable` -> `(available)`, never `(remote)`.
    assert.match(out, /○ warm-plugin v1\.0\.0 \(available\)/, out);
    assert.equal(out.includes("(remote)"), false, out);

    // The warm source is NOT in the `--remote` bucket, and DOES pass `--available`.
    {
      const { ctx: c2, pi: p2, notifications: n2 } = makeCtx();
      await listPlugins({ ctx: c2, pi: p2, cwd, scope: "user", remote: true });
      assert.equal(n2[0]!.message.includes("warm-plugin"), false, n2[0]!.message);
    }

    {
      const { ctx: c3, pi: p3, notifications: n3 } = makeCtx();
      await listPlugins({ ctx: c3, pi: p3, cwd, scope: "user", available: true });
      assert.match(n3[0]!.message, /○ warm-plugin v1\.0\.0 \(available\)/, n3[0]!.message);
    }
  });
});

test("T-80-08 / D-78-04: an INSTALLED git plugin with a missing clone stays `(installed)`, never `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        // Same version as installed -> steady-state `(installed)`, no upgrade.
        plugins: [{ name: "gitplug", source: "https://example.com/plugin.git", version: "1.0.0" }],
      },
      // Recorded installed at 1.0.0; NO clone staged on disk.
      installed: { gitplug: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // The installed path (installedRowMessage) never renders `(remote)` -- the
    // `remote` derivation lives only on the not-installed availableRowMessage
    // path. A cold clone does not regress the row (D-78-04 degrade preserved).
    assert.match(out, /● gitplug v1\.0\.0 \(installed\)/, out);
    assert.equal(out.includes("(remote)"), false, out);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// LIST-01 / D-67-01: the four list filters partition cleanly.
//   --unsupported  -> NOT-installed plugins that resolve `unsupported`
//                     (the force-installable candidates); keyed on the internal
//                     resolver bucket, which is independent of the render token.
//   --installed    -> installed + force-installed + force-upgradable (all
//                     installed-inventory render statuses) (A1).
//   --unavailable  -> structural-unavailable ONLY; it no longer admits the
//                     not-installed `unsupported` rows (A2 partition).
// USTAT-01 / D-64-01: a not-installed `unsupported` plugin renders the
// de-collapsed `(unsupported)` / `⊖` token; the filter buckets are unchanged.
// ──────────────────────────────────────────────────────────────────────────

test("LIST-01 / D-67-01: a not-installed plugin resolving `unsupported` shows under --unsupported (the `(unsupported)` row token) and is ABSENT under --unavailable and --available", async () => {
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
          // unsup: declares lspServers with an on-disk dir -> resolveStrict
          // yields `unsupported` (force-installable candidate, not installed).
          { name: "unsup", source: "./unsup", version: "1.0.0", lspServers: { ls: {} } },
          // clean: on-disk dir, no unsupported kinds -> `available`. (Named to
          // avoid colliding with the `unavailable` substring in assertions.)
          { name: "clean", source: "./clean", version: "2.0.0" },
          // gone: no on-disk dir -> structural `unavailable`.
          { name: "gone", source: "./gone", version: "3.0.0" },
        ],
      },
      installablePluginDirs: ["unsup", "clean"],
    });

    // --unsupported: the unsupported row appears, rendered with the de-collapsed
    // `(unsupported)` / `⊖` token (USTAT-01). clean/gone are excluded.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊖ unsup v1\.0\.0 \(partially-available\) \{lsp\}/, out);
      assert.equal(out.includes("clean"), false, out);
      assert.equal(out.includes("gone"), false, out);
    }

    // --unavailable: structural `gone` only; the unsupported `unsup` is NOT here.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);
      // Match the row token (the `{unsupported source}` reason contains the
      // `unsup` substring, so the bare name would false-positive).
      assert.equal(out.includes("unsup v1.0.0"), false, out);
      assert.equal(out.includes("clean"), false, out);
    }

    // --available: only the clean row.
    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
      const out = notifications[0]!.message;
      assert.match(out, /○ clean v2\.0\.0 \(available\)/, out);
      assert.equal(out.includes("unsup v1.0.0"), false, out);
      assert.equal(out.includes("gone"), false, out);
    }
  });
});

test("LIST-01 / D-67-01: a structurally-unavailable plugin shows under --unavailable and is ABSENT under --unsupported", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        // No on-disk dir -> resolveStrict returns `unavailable` (structural).
        plugins: [{ name: "gone", source: "./gone", version: "3.0.0" }],
      },
    });

    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);
    }

    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      const out = notifications[0]!.message;
      assert.equal(out.includes("gone"), false, out);
    }
  });
});

test("LIST-01 / D-67-01: a force-installed plugin shows under --installed (A1) and is ABSENT under --unsupported", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "forced", source: "./forced", version: "1.0.0" }],
      },
      // Recorded-installed with persisted unsupported -> derives force-installed.
      installed: { forced: { version: "1.0.0", unsupported: ["lspServers"] } },
      installablePluginDirs: ["forced"],
    });

    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
      const out = notifications[0]!.message;
      assert.match(out, /◉ forced v1\.0\.0 \(partially-installed\)/, out);
    }

    {
      const { ctx, pi, notifications } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      const out = notifications[0]!.message;
      assert.equal(out.includes("forced"), false, out);
    }
  });
});

test("PHOOK-05 / D-71-04: a force-installed partial-hook plugin renders the single aggregate {unsupported hooks} marker on the list row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "hookplug", source: "./hookplug", version: "1.0.0" }],
      },
      // Recorded-installed with persisted `unsupported: ["hooks"]` (one or more
      // hook events / matcher groups dropped at install) derives
      // `force-installed`. The `hooks` kind maps to the SINGLE aggregate
      // `{unsupported hooks}` marker via the shared `narrowUnsupportedKinds`
      // helper -- byte-identical to the install / info surfaces (D-71-04).
      installed: { hookplug: { version: "1.0.0", unsupported: ["hooks"] } },
      installablePluginDirs: ["hookplug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /◉ hookplug v1\.0\.0 \(partially-installed\) \{unsupported hooks\}/, out);
  });
});

test("LIST-01 / D-67-01 (A1): a force-upgradable plugin shows under --installed", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        // Newer candidate that resolves `unsupported` -> clean record derives
        // force-upgradable (an installed-inventory render status).
        name: "mp1",
        plugins: [{ name: "fup", source: "./fup", version: "1.0.1", lspServers: { ls: {} } }],
      },
      installed: { fup: { version: "1.0.0" } },
      installablePluginDirs: ["fup"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /● fup v1\.0\.0 \(partially-upgradable\)/, out);
  });
});

// FSTAT-02 / FSTAT-04 / D-66-03 / SNM-11: the in-block plugin sort's `scopeOf`
// only runs when two rows share a name (byName === 0). The orphan fold is the
// producer: a plugin installed in BOTH scopes under a CLONED marketplace
// (same marketplaceRoot) yields the user-side row PLUS the folded project-side
// row, both same-named, in one block. Seeding the derived force statuses into
// that pair drives the `force-installed` / `force-upgradable` sort arms.
test("FSTAT-02 / FSTAT-04: same-name force-installed + force-upgradable rows across scopes exercise the force scope-sort arms", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");

    // User scope: `fi` force-installed (persisted unsupported) + `fu` clean
    // installed whose newer manifest candidate resolves `unsupported`
    // (partially-upgradable). The seed writes the shared manifest + plugin dirs.
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "fi", source: "./fi", version: "1.0.0" },
          // Newer candidate declaring an unsupported kind -> a CLEAN installed
          // record derives force-upgradable.
          { name: "fu", source: "./fu", version: "1.0.1", lspServers: { ls: {} } },
        ],
      },
      installed: {
        fi: { version: "1.0.0", unsupported: ["lspServers"] },
        fu: { version: "1.0.0" },
      },
      installablePluginDirs: ["fi", "fu"],
    });

    // Project scope: a CLONE (same marketplaceRoot + manifestPath) with the
    // SAME two plugins installed, so the fold carries them under the user
    // header, producing same-name pairs the in-block sort must compare.
    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    const sharedManifestPath = path.join(sharedMpRoot, ".claude-plugin", "marketplace.json");
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "project",
          source: pathSource("./mp1-src"),
          addedFromCwd: cwd,
          manifestPath: sharedManifestPath,
          marketplaceRoot: sharedMpRoot,
          plugins: {
            fi: {
              version: "1.0.0",
              resolvedSource: "./placeholder",
              // Persisted unsupported -> force-installed (installable: false).
              compatibility: {
                installable: false,
                notes: [],
                supported: [],
                unsupported: ["lspServers"],
              },
              resources: {
                skills: ["fi-skill"],
                prompts: [],
                agents: [],
                mcpServers: [],
                hooks: [],
              },
              enabled: true,
              installedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
            fu: {
              version: "1.0.0",
              resolvedSource: "./placeholder",
              // Clean record; the newer manifest candidate resolves
              // `unsupported` -> force-upgradable.
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: {
                skills: ["fu-skill"],
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
    } as unknown as Parameters<typeof saveState>[1]);

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // Both the user-side row (no bracket) AND the folded project-side row
    // ([project]) appear for each name -> the same-name pair the sort's
    // `scopeOf` compares.
    assert.match(out, /◉ fi v1\.0\.0 \(partially-installed\)/, out);
    assert.match(out, /◉ fi \[project\] v1\.0\.0 \(partially-installed\)/, out);
    assert.match(out, /● fu v1\.0\.0 \(partially-upgradable\)/, out);
    assert.match(out, /● fu \[project\] v1\.0\.0 \(partially-upgradable\)/, out);
  });
});

// USTAT-01 / SNM-11 / D-64-01: two NOT-installed manifest entries that share a
// name (the manifest schema carries no name-uniqueness constraint) both
// resolve `unsupported`, so two `(unsupported)` rows land in one block. The
// in-block sort compares them (byName === 0), invoking `scopeOf` on the
// `unsupported` status -- the only list-surface producer of that sort arm.
test("USTAT-01 / SNM-11: two same-name not-installed unsupported rows exercise the unsupported scope-sort arm", async () => {
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
          { name: "dup", source: "./dup", version: "1.0.0", lspServers: { ls: {} } },
          { name: "dup", source: "./dup", version: "1.0.0", lspServers: { ls: {} } },
        ],
      },
      installablePluginDirs: ["dup"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    const matches = out.match(/⊖ dup v1\.0\.0 \(partially-available\) \{lsp\}/g) ?? [];
    assert.equal(matches.length, 2, out);
  });
});

test("LIST-01 / D-67-01: passive (no filter flag) shows every bucket and the not-installed unsupported row renders the `(unsupported)` byte form", async () => {
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
          { name: "inst", source: "./inst", version: "1.0.0" },
          { name: "avail", source: "./avail", version: "2.0.0" },
          { name: "unsup", source: "./unsup", version: "4.0.0", lspServers: { ls: {} } },
          { name: "gone", source: "./gone", version: "3.0.0" },
        ],
      },
      installed: { inst: { version: "1.0.0" } },
      installablePluginDirs: ["inst", "avail", "unsup"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● inst v1\.0\.0 \(installed\)/, out);
    assert.match(out, /○ avail v2\.0\.0 \(available\)/, out);
    assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);
    // USTAT-01 / D-64-01: the not-installed `unsupported` row renders the
    // de-collapsed `(unsupported)` / `⊖` token, distinct from structural `⊘`.
    assert.match(out, /⊖ unsup v4\.0\.0 \(partially-available\) \{lsp\}/, out);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// D-54-01 / ENBL-04: recorded-but-disabled inventory row (CR-02 producer)
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-04: recorded-but-disabled record renders `(disabled)` -- NOT `(installed)` -- and stays distinct from `(unavailable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.2.3" }],
      },
      // ENBL-02 marker: empty resources + installable:true.
      installed: { alpha: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // Catalog `disabled-inventory` row form: ◍ glyph (ICON_DISABLED), version
    // pin rendered, `(disabled)` token. Severity info (inventory row, not a
    // failure).
    assert.match(out, /◍ alpha v1\.2\.3 \(disabled\)/, out);
    assert.equal(out.includes("(installed)"), false, `must not render (installed): ${out}`);
    assert.equal(out.includes("(unavailable)"), false, `must not render (unavailable): ${out}`);
    assert.equal(notifications[0]!.severity, undefined, "disabled inventory routes to info");
  });
});

test("ENBL-04: disabled record with drifted manifest version does NOT render `(upgradable)` (version pin frozen while disabled)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "9.9.9" }],
      },
      installed: { alpha: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /◍ alpha v1\.2\.3 \(disabled\)/, out);
    assert.equal(out.includes("(upgradable)"), false, out);
  });
});

test("ENBL-04 / PL-1: --installed filter includes the disabled bucket (a disabled plugin IS recorded)", async () => {
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
      installed: { alpha: { version: "1.0.0", disabled: true } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /◍ alpha v1\.0\.0 \(disabled\)/, out);
    assert.equal(out.includes("○ beta"), false, out);
  });
});

// D-63-04: hooks-only installed plugin must render `(installed)`, NOT
// `(disabled)`. Regression pin for the hooks-only-list-disabled bug --
// the hook bridge added resources.hooks to the state schema
// but did not extend the 4-axis empty-resources predicate, so a
// hooks-only installed plugin satisfied isRecordedButDisabled and the
// list renderer routed the row to the (disabled) arm.
test("D-63-04: hooks-only installed plugin renders `(installed)` -- NOT `(disabled)` -- on /claude:plugin list", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "hookplug", source: "./hookplug", version: "1.0.0" }],
      },
      // hooksOnly: true seeds resources.hooks = ["hookplug"], every
      // other axis empty, installable: true -- the production shape of a
      // hooks-only installed plugin (e.g. learning-output-style).
      installed: { hookplug: { version: "1.0.0", hooksOnly: true } },
      installablePluginDirs: ["hookplug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● hookplug v1\.0\.0 \(installed\)/, out);
    assert.equal(out.includes("(disabled)"), false, `must not render (disabled): ${out}`);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// SC-6 scope narrowing + cross-scope visibility for fold rule
// ──────────────────────────────────────────────────────────────────────────

test("SC-6: bare form (no opts.scope) enumerates marketplaces from BOTH scopes", async () => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    const out = notifications[0]!.message;
    // MSG-GR-3 sort: p-mp < u-mp alphabetically -> p-mp renders first.
    assert.match(out, /● p-mp \[project\]/);
    assert.match(out, /● u-mp \[user\]/);
    const pIdx = out.indexOf("p-mp");
    const uIdx = out.indexOf("u-mp");
    assert.ok(pIdx >= 0 && uIdx >= 0 && pIdx < uIdx, `expected p-mp before u-mp: ${out}`);
  });
});

test("CMC-21 / D-13-17 / D-13-19: same-name marketplace in BOTH scopes renders TWO separate headers when added independently", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");

    // Two INDEPENDENT marketplaces with the same name: they live at
    // different marketplaceRoot paths because each scope's seedMarketplace
    // call provisions its own dir. The fold rule does NOT trigger (the
    // project record is not a clone of the user record).
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "official",
      manifest: {
        name: "official",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
    });
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "official",
      manifest: {
        name: "official",
        plugins: [{ name: "alpha", source: "./alpha", version: "0.9.0" }],
      },
      installed: { alpha: { version: "0.9.0" } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    const out = notifications[0]!.message;
    // Both headers render; project-before-user per MSG-GR-3 tie-break.
    assert.match(out, /● official \[project\]/);
    assert.match(out, /● official \[user\]/);
    const projIdx = out.indexOf("● official [project]");
    const userIdx = out.indexOf("● official [user]");
    assert.ok(projIdx < userIdx, `expected project header first: ${out}`);
    // Catalog `same-plugin-both-scopes` at
    // docs/output-catalog.md:168-182: the plugin scope equals each
    // marketplace block's scope, so the renderer's D-16-17 orphan-fold
    // rule SUPPRESSES the `[<scope>]` bracket on each row. Plugin rows
    // are `● alpha v0.9.0 (installed)` (under project header) and
    // `● alpha v1.0.0 (installed)` (under user header).
    assert.match(out, /● alpha v0\.9\.0 \(installed\)/);
    assert.match(out, /● alpha v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("● alpha [project]"), false, out);
    assert.equal(out.includes("● alpha [user]"), false, out);
  });
});

test("CR-01 / G-21-01: project-scope plugin under a CLONED user marketplace folds under the user-scope header (carry-over filter must discriminate on `present`)", async () => {
  // Regression for CR-01 (the orphan-fold filter
  // gap). Setup: seed a user-scope marketplace `mp1` AND a project-scope
  // marketplace `mp1` whose state record points at the SAME
  // `marketplaceRoot` directory -- this is the on-disk shape produced by
  // the install orchestrator's `cloneMarketplaceRecordForTargetScope`
  // path when a project-scope install runs against a user-scope
  // marketplace. `isCloneOfUserMarketplace` returns true on
  // `marketplaceRoot` equality, which routes the project-side
  // enumeration through the orphan-fold filter at
  // `loadPluginListPayload`. That filter discriminates on
  // `"present"` (plus the `"upgradable"` arm), so the folded row appears
  // under the user-scope header with the cross-scope `[project]` bracket
  // per D-13-18 / D-16-17.
  //
  // The integration counterpart for this regression is
  // tests/integration/fold-adoption.test.ts step 2 (CMC-21 step 2).
  // The same-mp-both-scopes test above does NOT cover this case
  // because both seedMarketplace calls allocate independent
  // `marketplaceRoot` paths -- the fold rule does not trigger.
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");

    // Seed user-scope first so the on-disk marketplace fixture exists
    // under `<userRoot>/marketplaces/mp1`. The seedMarketplace helper
    // writes `marketplaceRoot: mpRoot` into state; we capture that
    // exact path below so the project-scope record can point at it.
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
      // No installed plugins in user scope -- the alpha install lives
      // in project scope (the orphan-fold case).
    });

    // Project-scope record: the install orchestrator's clone path copies
    // the user-scope record verbatim (same `marketplaceRoot`). We
    // simulate that by seeding a project-scope marketplace whose
    // on-disk seed lives under the user scopeRoot path. The
    // seedMarketplace helper would normally allocate
    // `<projectRoot>/marketplaces/mp1` as a NEW dir; to match a real
    // clone we instead write state.json directly with the same
    // marketplaceRoot as the user-scope record.
    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    const sharedManifestPath = path.join(sharedMpRoot, ".claude-plugin", "marketplace.json");
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "project",
          source: pathSource("./mp1-src"),
          addedFromCwd: cwd,
          manifestPath: sharedManifestPath,
          // CLONE: same marketplaceRoot as the user-scope record.
          marketplaceRoot: sharedMpRoot,
          plugins: {
            alpha: {
              version: "1.0.0",
              resolvedSource: "./placeholder",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              // Populated resources: an ENABLED installed record (empty
              // resources + installable:true would read as disabled per
              // ENBL-04 and render `(disabled)` instead of `(installed)`).
              resources: {
                skills: ["alpha-skill"],
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
    } as unknown as Parameters<typeof saveState>[1]);

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;

    // The orphan-fold row appears under the user-scope header with the
    // cross-scope `[project]` bracket -- this is the CR-01 assertion.
    assert.match(
      out,
      /● mp1 \[user\][\s\S]*● alpha \[project\] v1\.0\.0 \(installed\)/,
      `expected orphan-folded alpha row under mp1 [user] header: ${out}`,
    );

    // The duplicate `(available)` row that would appear if the filter
    // dropped the `present` row and the user-side enumeration re-emitted
    // alpha from the manifest MUST NOT appear under the user-scope block.
    assert.equal(
      /● mp1 \[user\][\s\S]*○ alpha v1\.0\.0 \(available\)/.test(out),
      false,
      `regression: alpha should not re-emit as (available) when present row is folded: ${out}`,
    );

    // No separate project-scope mp1 header (the project-scope record is
    // a clone of the user-scope record per D-13-19; folded under user).
    assert.equal(
      out.includes("● mp1 [project]"),
      false,
      `expected no project-scope mp1 header in cloned-state phase: ${out}`,
    );
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", marketplace: "official" });
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // CMC-09 (upgradable) carries the ● effective-state
    // icon. D-16-17: `[<scope>]` suppressed when `p.scope === mp.scope`.
    assert.match(out, /● plug v1\.0\.0 \(upgradable\)/);
    assert.equal(out.includes("● plug [user]"), false, out);
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // D-16-17 suppresses `[<scope>]` bracket on same-scope rows.
    assert.match(out, /● plug v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("● plug [user]"), false, out);
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /\(upgradable\)/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// FSTAT-01 / FSTAT-03 / FSTAT-04 / FSTAT-05 / D-66-01 / D-66-02 force-state
// deriver matrix: purity (no state write), A4 ordering (force-installed wins),
// no-network candidate split, and auto-return-to-installed.
// ──────────────────────────────────────────────────────────────────────────

test("FSTAT-01 / D-66-01: recorded-installed with compatibility.unsupported derives `(partially-installed)` with NO state write", async () => {
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
      // Degraded record: persisted `unsupported` non-empty -> force-installed.
      installed: { plug: { version: "1.0.0", unsupported: ["lspServers"] } },
      installablePluginDirs: ["plug"],
    });

    // FSTAT-01 purity: the deriver is a pure read of the persisted record --
    // listing MUST NOT rewrite state.json.
    const stateJsonPath = path.join(locationsFor("user", cwd).extensionRoot, "state.json");
    const before = await readFile(stateJsonPath, "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // ◉ glyph + `(partially-installed)`; version is the installed record's version.
    assert.match(out, /◉ plug v1\.0\.0 \(partially-installed\)/);

    const after = await readFile(stateJsonPath, "utf8");
    assert.equal(after, before, "the deriver must not write state.json (FSTAT-01)");
  });
});

test("WR-02 / D-66-01: non-path (npm) recorded-installed plugin with persisted unsupported derives `(partially-installed)` on list (parity with info)", async () => {
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
          {
            name: "remote",
            // Non-path source -- list derives force state purely from the
            // persisted record, identically to the non-path `info` surface.
            source: { source: "npm", package: "@scope/remote-plugin", version: "1.0.0" },
            version: "1.0.0",
          },
        ],
      },
      installed: { remote: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(
      notifications[0]!.message,
      // Byte-identical to the non-path `info` row (sans the info-only
      // `components: not resolved` line) -- the WR-02 cross-surface parity.
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
  });
});

test("FSTAT-04 / D-66-02 (A4): a degraded record with a newer candidate derives `(partially-installed)`, NEVER `(partially-upgradable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        // Newer candidate that ALSO resolves unsupported (declares lspServers).
        // A4 ordering: force-installed is checked first, so the candidate
        // resolve never runs / never wins.
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "2.0.0", lspServers: { ls: {} } }],
      },
      installed: { plug: { version: "1.0.0", unsupported: ["lspServers"] } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /\(partially-installed\)/);
    assert.equal(out.includes("(partially-upgradable)"), false, out);
  });
});

test("FSTAT-04 / D-66-02: clean record + candidate resolving `unsupported` derives `(partially-upgradable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        // Newer candidate version AND declares lspServers -> resolveStrict
        // yields `unsupported`, newly degrading a currently-clean plugin.
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "1.0.1", lspServers: { ls: {} } }],
      },
      installed: { plug: { version: "1.0.0" } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // ● glyph (clean today) + `(partially-upgradable)`; version stays the installed
    // record's version. The reasons brace carries the narrowUnsupportedKinds
    // marker for the degrading candidate kind.
    assert.match(out, /● plug v1\.0\.0 \(partially-upgradable\)/);
    assert.match(out, new RegExp(`\\{${narrowUnsupportedKinds(["lspServers"]).join(", ")}\\}`));
  });
});

test("FSTAT-03 / FSTAT-04: clean record + candidate resolving `installable` derives `(upgradable)` (no force state)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        // Newer candidate, but clean (no unsupported kinds) -> plain upgradable.
        name: "mp1",
        plugins: [{ name: "plug", source: "./plug", version: "1.0.1" }],
      },
      installed: { plug: { version: "1.0.0" } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● plug v1\.0\.0 \(upgradable\)/);
    assert.equal(out.includes("force-"), false, out);
  });
});

test("CR-01 / FSTAT-04 / NFR-5: a candidate resolveStrict throw degrades to `(upgradable)`, never blanks the whole list", async () => {
  // Regression guard for the force-upgradable candidate resolve. A plugin name
  // with a path separator passes the manifest's `Type.String()` name field but
  // makes `resolveStrict` throw via `assertSafeName`. Before the guard, that
  // throw escaped the row builder and the top-level `listPlugins` catch
  // replaced the ENTIRE list with one synthetic `(list) (failed)` row, hiding
  // every sibling plugin. The guard must degrade ONLY the offending row to a
  // plain `(upgradable)` and keep the rest of the list intact.
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
          // Upgradable (manifest 2.0.0 vs installed 1.0.0) AND a "/" in the
          // name -> the candidate `resolveStrict` throws.
          { name: "bad/name", source: "./badname", version: "2.0.0" },
          // A clean, non-upgradable sibling that must survive the throw.
          { name: "good", source: "./good", version: "1.0.0" },
        ],
      },
      installed: {
        "bad/name": { version: "1.0.0" },
        good: { version: "1.0.0" },
      },
      installablePluginDirs: ["good"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // The throwing candidate degrades to a plain `(upgradable)` row...
    assert.match(out, /bad\/name v1\.0\.0 \(upgradable\)/, out);
    // ...the sibling row is intact...
    assert.match(out, /good v1\.0\.0 \(installed\)/, out);
    // ...and the whole list was NOT replaced by the synthetic failure row.
    assert.equal(out.includes("(failed)"), false, out);
    assert.equal(out.includes("(list)"), false, out);
  });
});

test("FSTAT-03: clean record + no newer candidate derives `(installed)` (auto-return, no lingering force state)", async () => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● plug v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("force-"), false, out);
  });
});

test("FSTAT-01 / D-64-02: the force-installed row's reasons are the narrowUnsupportedKinds dropped-component markers", async () => {
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
      // Two dropped kinds: lspServers -> `lsp`, monitors -> `unsupported source`
      // (first-wins dedup is exercised on the `unsupported source` mapping).
      installed: { plug: { version: "1.0.0", unsupported: ["lspServers", "monitors"] } },
      installablePluginDirs: ["plug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    const expectedMarkers = narrowUnsupportedKinds(["lspServers", "monitors"]).join(", ");
    assert.match(out, /\(partially-installed\)/);
    assert.match(out, new RegExp(`\\{${expectedMarkers}\\}`));
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-6: manifest soft-fail (catalog CMC-22 form: failed-marketplace header)
// ──────────────────────────────────────────────────────────────────────────

test("PL-6 / CMC-22: manifest load failure renders the marketplace as a bare V2 failed header (no `{unparseable}` brace; no cause trailer)", async () => {
  // Catalog `unparseable-mp` at docs/output-catalog.md:215-226: emits a
  // BARE `(failed)` header (no reasons brace, no cause trailer) because
  // the type model places `cause?: Error` on plugin variants only -- not
  // marketplace headers -- and the orchestrator constructs the
  // unparseable mp with `status: "failed"` + `plugins: []` per the
  // catalog reference. Severity: "error" computed by notify() per
  // D-16-11 (any mp.status === "failed" routes to error). No reload-hint
  // (failed is not in the state-changing variant set per D-16-12).
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fakePath = path.join(userRoot, "marketplaces", "mp1", ".claude-plugin", "no-such.json");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifestPathOverride: fakePath,
      installed: { stranded: { version: "9.9.9" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    const note = notifications[0]!;
    // Severity is "error" because the synthetic mp has status "failed".
    assert.equal(note.severity, "error");
    // Bare V2 failed header; no `{unparseable}` brace; no cause trailer.
    // UXG-07 (D-29-03): 0 failed plugins, 1 failed marketplace
    // -> the "A marketplace operation has failed." summary line is prepended.
    assert.equal(note.message, "A marketplace operation has failed.\n\n⊘ mp1 [user] (failed)");
    const out = note.message;
    assert.equal(out.includes("{unparseable}"), false, out);
    assert.equal(out.includes("cause:"), false, out);
    // Installed plugins are NOT rendered under a failed-manifest header
    // (the failure replaces the per-plugin enumeration; plugins: [] in
    // the V2 payload).
    assert.equal(out.includes("stranded"), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-7 / CMC-05: <autoupdate> marker on marketplace headers
// ──────────────────────────────────────────────────────────────────────────

test("PL-7 / CMC-05: marketplace with autoupdate=true renders the <autoupdate> marker on the header", async () => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● auto-mp \[user\] <autoupdate>/);
  });
});

test("PL-7 / CMC-05: marketplace with autoupdate=false (or undefined) does NOT render the <autoupdate> marker", async () => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /● plain-mp \[user\]/);
    assert.equal(out.includes("<autoupdate>"), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Probe-error classification + non-`{unsupported source}`
// surface for unexpected `resolveStrict` throws inside `availableRowComputation`.
// ──────────────────────────────────────────────────────────────────────────

test("260525-cjr A3: narrowProbeError -> EACCES classifies as `permission denied`", () => {
  const err = new Error("EACCES: permission denied, open '/foo/bar/manifest.json'");
  (err as NodeJS.ErrnoException).code = "EACCES";
  assert.equal(__test_narrowProbeError(err), "permission denied");
});

test("260525-cjr A3: narrowProbeError -> EPERM also classifies as `permission denied`", () => {
  const err = new Error("EPERM");
  (err as NodeJS.ErrnoException).code = "EPERM";
  assert.equal(__test_narrowProbeError(err), "permission denied");
});

test("260525-cjr A3: narrowProbeError -> ENOENT classifies as `source missing`", () => {
  const err = new Error("ENOENT");
  (err as NodeJS.ErrnoException).code = "ENOENT";
  assert.equal(__test_narrowProbeError(err), "source missing");
});

test("260525-cjr A3: narrowProbeError -> SyntaxError classifies as `unparseable`", () => {
  const err = new SyntaxError("Unexpected token } in JSON at position 7");
  assert.equal(__test_narrowProbeError(err), "unparseable");
});

test("D-48-B IN-02: narrowProbeError -> schema-invalid InvalidMarketplaceManifestError classifies as `invalid manifest`", () => {
  // Schema-invalid manifest = typed error with NO SyntaxError cause. The read
  // surface reports the SAME `{invalid manifest}` reason the write path does.
  const err = new InvalidMarketplaceManifestError("marketplace.json schema invalid: plugins");
  assert.equal(__test_narrowProbeError(err), "invalid manifest");
});

test("D-48-B IN-02: narrowProbeError -> malformed-JSON InvalidMarketplaceManifestError stays `unparseable`", () => {
  // Malformed JSON = typed error WHOSE cause IS a SyntaxError. The collapse
  // into one InvalidMarketplaceManifestError branch must preserve this arm.
  const err = new InvalidMarketplaceManifestError("bad json", {
    cause: new SyntaxError("Unexpected token"),
  });
  assert.equal(__test_narrowProbeError(err), "unparseable");
});

test("260525-cjr A3: narrowProbeError -> generic Error falls through to `unreadable` (NOT `unsupported source`)", () => {
  // An unrecognized throw routes to `unreadable`, not `unsupported
  // source`.
  const err = new Error("something went wrong probing this plugin");
  const reason = __test_narrowProbeError(err);
  assert.equal(reason, "unreadable");
  assert.notEqual(reason, "unsupported source");
});

// Note on integration coverage: constructing a real fixture that drives
// `resolveStrict` into THROWING (vs returning NotInstallable with notes)
// requires FS-level fault injection that is brittle across platforms
// (chmod 000 behaves differently as root, on tmpfs, on macOS APFS, etc.).
// The unit tests above exercise every classifier branch directly through
// the `__test_narrowProbeError` re-export; the orchestrator wiring is a
// straightforward pass-through. The binding contract is that
// `narrowProbeError` returns the closed-set Reason the user sees on the
// row.

// ──────────────────────────────────────────────────────────────────────────
// WR-03: narrowListFailReason -- dedicated narrower for orchestrator-level
// list failures (loadState / cross-scope walk throws). Distinct from
// narrowProbeError (per-row resolver probe failures). Mirrors the same
// classifier ladder so the test ergonomics carry over.
// ──────────────────────────────────────────────────────────────────────────

test("WR-03: narrowListFailReason -> EACCES classifies as `permission denied`", () => {
  const err = new Error("EACCES: permission denied, open '/foo/state.json'");
  (err as NodeJS.ErrnoException).code = "EACCES";
  assert.equal(__test_narrowListFailReason(err), "permission denied");
});

test("WR-03: narrowListFailReason -> EPERM also classifies as `permission denied`", () => {
  const err = new Error("EPERM");
  (err as NodeJS.ErrnoException).code = "EPERM";
  assert.equal(__test_narrowListFailReason(err), "permission denied");
});

test("WR-03: narrowListFailReason -> ENOENT classifies as `source missing`", () => {
  const err = new Error("ENOENT");
  (err as NodeJS.ErrnoException).code = "ENOENT";
  assert.equal(__test_narrowListFailReason(err), "source missing");
});

test("WR-03: narrowListFailReason -> SyntaxError classifies as `unparseable`", () => {
  const err = new SyntaxError("Unexpected token } in JSON at position 7");
  assert.equal(__test_narrowListFailReason(err), "unparseable");
});

test("WR-03: narrowListFailReason -> generic Error falls through to `unreadable`", () => {
  const err = new Error("something went wrong loading state");
  assert.equal(__test_narrowListFailReason(err), "unreadable");
});

test("WR-03: narrowListFailReason -> non-Error throw falls through to `unreadable`", () => {
  assert.equal(__test_narrowListFailReason("string throw"), "unreadable");
  assert.equal(__test_narrowListFailReason(42), "unreadable");
  assert.equal(__test_narrowListFailReason(undefined), "unreadable");
});

// ──────────────────────────────────────────────────────────────────────────
// Source-grep self-tests (NFR-5 / PI-2 / PL-3 defense-in-depth)
//
// Redundant with tests/architecture/no-orchestrator-network.test.ts
// but lives here so a future contributor of list logic
// reads the constraint at the same file they are editing.
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

test("TR-08 / D-19-01: list.ts has no module-level PROBE_FAILURES-style accumulator", async () => {
  // D-19-01: there is no PROBE_FAILURES module-level capture-buffer +
  // drain notifyWarning. Probe failures manifest at row granularity
  // via the per-row `(unavailable) {<narrowed-reason>}` discriminator.
  // This test locks that with defense-in-depth: a direct
  // identifier match (caught if anyone reintroduces by name) AND a
  // top-level mutable-state heuristic (caught if anyone reintroduces by
  // shape under a different name).
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);

  // Assertion A -- direct identifier match.
  assert.equal(
    code.includes("PROBE_FAILURES"),
    false,
    "list.ts must not contain a PROBE_FAILURES identifier",
  );

  // Assertion B -- generic top-level mutable-state heuristic. Match
  // top-of-line `let|var <identifier>`. `const` is INTENTIONALLY omitted:
  // const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)" is a
  // legitimate module-level constant (deliberate, immutable, non-
  // accumulating); only let/var declarations at module scope are the
  // anti-pattern this guard targets.
  const topLevelLetVar = code.match(/^(let|var)\s+\w+/gm) ?? [];
  assert.equal(
    topLevelLetVar.length,
    0,
    `list.ts must not have top-level let/var module state, found: ${topLevelLetVar.join(", ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Uncovered-path gap tests
// ──────────────────────────────────────────────────────────────────────────

// HOOK-01: hooks moved from UNSUPPORTED_COMPONENT_KINDS to the supported
// set. A plugin declaring `hooks` at entry level with NO hooks/hooks.json
// on disk is no longer rejected -- the resolver owns convention-file
// discovery only; entry/manifest-level hooks-field semantics are deferred
// to future dispatch work. The plugin now lands as `available`
// (not installed, no admission blocker).
test("HOOK-01: plugin declaring hooks field with no hooks/hooks.json on disk buckets as ○ (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "hooks-plugin", source: "./hooks-plugin", hooks: ["hooks.json"] }],
      },
      installablePluginDirs: ["hooks-plugin"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Plugin admits cleanly (no hooks.json on disk -> no parse-fail flip).
    assert.match(out, /○ hooks-plugin/);
    assert.doesNotMatch(out, /\{hooks\}/);
    assert.doesNotMatch(out, /contains hooks/);
  });
});

// Gap 2: lspServers unsupported kind via declared field
// Same path as Gap 1 but for the "lspServers" kind.
test("gap: plugin declaring lspServers field renders as ⊖ (unsupported) with {lsp} note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "lsp-plugin", source: "./lsp-plugin", lspServers: { "my-ls": {} } }],
      },
      installablePluginDirs: ["lsp-plugin"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /⊖ lsp-plugin/);
    assert.match(out, /{lsp}/);
  });
});

// HOOK-01 + D-57-04: hooks/hooks.json convention file now drives admission.
// A PARSEABLE file admits the plugin (no longer unavailable); a MALFORMED
// file flips to unavailable with the parse-failure note.
test("HOOK-01: plugin dir with parseable hooks/hooks.json buckets as ○ (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = path.join(userRoot, "marketplaces", "mp1");

    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "hooks-conv", source: "./hooks-conv" }],
      },
      installablePluginDirs: ["hooks-conv"],
    });

    const pluginDir = path.join(mpRoot, "hooks-conv");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{}", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /○ hooks-conv/);
    assert.doesNotMatch(out, /\{hooks\}/);
  });
});

// D-57-04 / HOOK-04: malformed hooks/hooks.json flips to ⊘ with
// {unsupported hooks} reason (the parse-failure detail flows through
// narrowResolverNotes's prefix-anchored detection on the resolver's
// `"malformed hooks.json: "` wrapper).
test("D-57-04: plugin dir with malformed hooks/hooks.json buckets as ⊘ with {unsupported hooks} reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = path.join(userRoot, "marketplaces", "mp1");

    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "hooks-conv", source: "./hooks-conv" }],
      },
      installablePluginDirs: ["hooks-conv"],
    });

    const pluginDir = path.join(mpRoot, "hooks-conv");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /⊘ hooks-conv/);
    assert.match(out, /\{unsupported hooks\}/);
  });
});

// Gap 4: lspServers via file convention (.lsp.json)
test("gap: plugin dir with .lsp.json file renders as ⊖ (unsupported) via file convention", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = path.join(userRoot, "marketplaces", "mp1");

    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "lsp-conv", source: "./lsp-conv" }],
      },
      installablePluginDirs: ["lsp-conv"],
    });

    // Write .lsp.json inside the plugin source dir so resolver detects it.
    const pluginDir = path.join(mpRoot, "lsp-conv");
    await writeFile(path.join(pluginDir, ".lsp.json"), "{}", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /⊖ lsp-conv/);
    assert.match(out, /{lsp}/);
  });
});

// Gap 5: resolveStrict THROWS -- caught by manifestEntryStatus catch block
// A plugin name containing "/" passes MARKETPLACE_VALIDATOR (name is
// Type.String()) but causes resolveStrict to throw via assertSafeName.
// The catch at manifestEntryStatus lines 149-151 catches it and returns
// {status:"uninstallable", notes:[errorMessage(err)]}.
test("gap: plugin with path-separator in name -- resolveStrict throws, caught as ⊘", async () => {
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
          // "/" in name passes TypeBox String() but assertSafeName throws.
          { name: "bad/name", source: "./badname" },
        ],
      },
      // No installablePluginDirs -- resolveStrict throws before stat checks.
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Row is bucketed as uninstallable; note contains the assertSafeName message.
    assert.match(out, /⊘/);
    assert.match(out, /{unreadable}/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-4: description flows from manifest entry onto rendered output
// ──────────────────────────────────────────────────────────────────────────

test("PL-4: manifest description appears as 4-space-indented second line on installed, available, and unavailable rows", async () => {
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
          // installed (will render as "present"); has description
          {
            name: "alpha",
            source: "./alpha",
            version: "1.0.0",
            description: "Alpha is an installed plugin.",
          },
          // not-installed dir present -> available; has description
          {
            name: "beta",
            source: "./beta",
            version: "2.0.0",
            description: "Beta is an available plugin.",
          },
          // not-installed, no dir -> unavailable; has description
          {
            name: "gamma",
            source: "./gamma",
            version: "3.0.0",
            description: "Gamma is an unavailable plugin.",
          },
        ],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;

    // Installed row (present) -> description indented 4 spaces below it.
    assert.ok(
      out.includes("● alpha v1.0.0 (installed)\n    Alpha is an installed plugin."),
      `alpha description missing; got: ${out}`,
    );
    // Available row -> description indented 4 spaces below it.
    assert.ok(
      out.includes("○ beta v2.0.0 (available)\n    Beta is an available plugin."),
      `beta description missing; got: ${out}`,
    );
    // Unavailable row -> description indented 4 spaces below it.
    assert.ok(
      out.includes("⊘ gamma v3.0.0 (unavailable)"),
      `gamma unavailable row missing; got: ${out}`,
    );
    assert.ok(
      out.includes("    Gamma is an unavailable plugin."),
      `gamma description missing; got: ${out}`,
    );
  });
});

test("PL-4: manifest entry without description renders no second line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Only the plugin row -- no second line follows the (installed) token.
    assert.ok(out.includes("● alpha v1.0.0 (installed)"), `plugin row missing; got: ${out}`);
    // No 4-space indent anywhere (no description).
    assert.ok(!out.includes("    "), `unexpected indented second line; got: ${out}`);
  });
});

// Gap 6: collectMarketplacePlugins manifest=undefined with no installed plugins
// The early-return branch (manifest === undefined) fires and returns [] when
// the marketplace has no installed records and no loadable manifest.
// This path confirms zero available rows appear without a manifest even when
// the marketplace record itself is valid.
test("gap: manifest load fails + zero installed -> marketplace renders with warning and no plugin rows", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fakePath = path.join(userRoot, "marketplaces", "mp1", ".claude-plugin", "no-such.json");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifestPathOverride: fakePath,
      // No installed plugins -- collectMarketplacePlugins returns [] immediately.
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Manifest load failure renders the marketplace as (failed) with error severity.
    assert.match(out, /mp1.*failed/);
    assert.equal(notifications[0]?.severity, "error");
  });
});

// Gap 7: listPlugins top-level catch -- loadPluginListPayload throws
// Writing corrupt JSON to state.json causes loadState to throw; the
// listPlugins try/catch (lines 264-269) catches it and calls notifyError.
test("gap: corrupt state.json causes listPlugins to notify an error", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const extensionRoot = path.join(userRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    const stateJsonPath = path.join(extensionRoot, "state.json");
    // Write corrupt JSON -- loadState throws, listPlugins catches it.
    await writeFile(stateJsonPath, "{ this is not valid json }", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    // notifyError is called; severity should be "error".
    assert.equal(notifications[0]!.severity, "error");
    // The error message should reference the JSON parse failure.
    assert.match(notifications[0]!.message, /state\.json/);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RSTA-01 / D-80-03 / D-78-04: git-source plugins on the list surface.
// An uninstalled git plugin (url / github / git-subdir) with NO materialized
// clone renders `(remote)` -- a valid install target with no local tree to
// resolve, NOT the over-claimed `(available)`. An installed git plugin whose
// clone is missing shows no status change (status derives from the recorded
// record, never a clone probe -- D-78-04 degrade preserved). Neither surface
// clones or touches the network (NFR-5).
// ──────────────────────────────────────────────────────────────────────────

test("RSTA-01 / D-80-03: an uninstalled url-source plugin renders (remote), not (unavailable)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        // A url-source plugin NOT installed and with NO on-disk clone. The
        // presence probe returns not-cached, so the row classifies `remote`
        // (a valid install target with no local tree to resolve), NOT the
        // over-claimed `available`.
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);
  });
});

test("RSTA-01 / D-80-03: an uninstalled github-object-source plugin renders (remote)", async () => {
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
          { name: "ghplug", source: { source: "github", repo: "owner/repo" }, version: "2.0.0" },
        ],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /◌ ghplug v2\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /ghplug.*\(unavailable\)/, out);
  });
});

test("RSTA-01 / D-80-03: an uninstalled git-subdir-source plugin renders (remote)", async () => {
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
          {
            name: "subplug",
            source: { source: "git-subdir", url: "https://example.com/repo", path: "sub" },
            version: "3.0.0",
          },
        ],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /◌ subplug v3\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /subplug.*\(unavailable\)/, out);
  });
});

test("PURL-08 / D-78-04: an installed git-source plugin with a missing clone keeps its recorded (installed) status", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        // Same manifest version as the installed record (no upgrade) -> the
        // installed row derives from the recorded record; the clone cache dir
        // never exists on disk, and status must not regress to unavailable.
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
      installed: { gplug: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /● gplug v1\.0\.0 \(installed\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);
    assert.doesNotMatch(out, /gplug.*\(partially/, out);
  });
});

test("PURL-08 / D-78-04: an installed git-source plugin with a newer manifest and a missing clone degrades to plain (upgradable), never (unavailable)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        // Newer manifest version than the recorded install -> upgradable. The
        // presence probe finds no clone (cold cache) and returns not-cached, so
        // the row degrades to plain (upgradable) -- NOT (unavailable).
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "2.0.0" }],
      },
      installed: { gplug: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    const out = notifications[0]!.message;
    assert.match(out, /● gplug v1\.0\.0 \(upgradable\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);
  });
});

test("RSTA-01 / NFR-5: list renders an uninstalled git plugin (remote) with no plugin-clones dir on disk (no clone, no network)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    // No plugin-clones/ directory is ever created; a clone (or any network
    // touch) would have to materialize one. Its absence after the render proves
    // the surface neither cloned nor fetched.
    const clonesDir = path.join(userRoot, "pi-claude-marketplace", "plugin-clones");
    let clonesExisted = true;
    try {
      await readFile(clonesDir);
    } catch {
      clonesExisted = false;
    }

    assert.equal(clonesExisted, false);

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/, out);
  });
});

test("RSTA-01 / SNM-11: a `remote` row sorts by the marketplace scope when its name case-ties a sibling row", async () => {
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
          // Case-insensitively IDENTICAL names force the block sorter past
          // the name comparison into the per-row scope derivation, which must
          // fall back to the marketplace scope for the scope-less `remote`
          // variant (the SNM-11 carve-out family) without disturbing the
          // sibling `available` row.
          { name: "caseplug", source: "./caseplug", version: "1.0.0" },
          { name: "CasePlug", source: "https://example.com/caseplug.git", version: "2.0.0" },
        ],
      },
      installablePluginDirs: ["caseplug"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Both rows render inside the one mp1 block; the scope tie-break returns
    // equal scopes, so the original (manifest) order is preserved.
    assert.match(out, /○ caseplug v1\.0\.0 \(available\)/, out);
    assert.match(out, /◌ CasePlug v2\.0\.0 \(remote\)/, out);
  });
});
