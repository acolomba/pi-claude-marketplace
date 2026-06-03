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
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  __test_narrowListFailReason,
  __test_narrowProbeError,
  listPlugins,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
// Empty state (CMC-10 / MSG-ER-1 sentinel)
// ──────────────────────────────────────────────────────────────────────────

test("CMC-10: empty state in both scopes renders V2 `(no marketplaces)` sentinel", async () => {
  // V1->V2 byte change: V1 emitted `(no plugins)` for an empty list; V2
  // emits `(no marketplaces)` because the top-level
  // `marketplaces: []` array is the structural empty sentinel
  // (D-16-17 / shared/notify.ts:1158). Catalog reference:
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
    // V1->V2 byte form: per D-16-17 / shared/notify.ts:719 orphan-fold rule
    // the renderer suppresses `[<scope>]` on a plugin row when
    // `p.scope === mp.scope`. Here mp.scope and the installed plugin's
    // scope are both "user", so the bracket is omitted on the alpha row.
    // SNM-11: `available` / `unavailable` rows never carry a `scope`
    // field by construction, so their brackets are always absent.
    // UAT G-21-01: list-surface inventory row emits no reload-hint
    // trailer; the previous trailer was the misfire shouldEmitReloadHint
    // produced because installedRowMessage emitted the cascade-context
    // `status: "installed"` discriminator. Now it emits `status:
    // "present"` (list-only) and the trailer is correctly absent.
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
    // V2: plugin.scope === mp.scope (both "user") -> bracket suppressed
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
    // V1->V2 byte form (catalog `same-plugin-both-scopes` at
    // docs/output-catalog.md:168-182): the plugin scope equals each
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
  // Regression for 21-04-REVIEW.md CR-01 (closes the orphan-fold filter
  // gap). Setup: seed a user-scope marketplace `mp1` AND a project-scope
  // marketplace `mp1` whose state record points at the SAME
  // `marketplaceRoot` directory -- this is the on-disk shape produced by
  // the install orchestrator's `cloneMarketplaceRecordForTargetScope`
  // path when a project-scope install runs against a user-scope
  // marketplace. `isCloneOfUserMarketplace` returns true on
  // `marketplaceRoot` equality, which routes the project-side
  // enumeration through the orphan-fold filter at
  // `loadPluginListPayload`. Pre-fix, that filter discriminated on the
  // (now-unreachable) cascade-context `status: "installed"` arm and
  // silently dropped every `status: "present"` row, re-emitting the
  // plugin as `(available)` under the user header. Post-fix it
  // discriminates on `"present"` (plus the unchanged `"upgradable"`
  // arm), so the folded row appears under the user-scope header with
  // the cross-scope `[project]` bracket per D-13-18 / D-16-17.
  //
  // The integration counterpart for this regression is
  // tests/integration/fold-adoption.test.ts phase 2 (CMC-21 phase 2).
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
      schemaVersion: 1,
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
              resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
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
    // cross-scope `[project]` bracket -- this is the assertion the
    // CR-01 regression breaks pre-fix.
    assert.match(
      out,
      /● mp1 \[user\][\s\S]*● alpha \[project\] v1\.0\.0 \(installed\)/,
      `expected orphan-folded alpha row under mp1 [user] header: ${out}`,
    );

    // The duplicate `(available)` row that the pre-fix regression
    // emitted (when the filter dropped the `present` row and the
    // user-side enumeration re-emitted alpha from the manifest) MUST
    // NOT appear under the user-scope block.
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
    // V1->V2 byte form: CMC-09 (upgradable) carries the ● effective-state
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
    // V1->V2: D-16-17 suppresses `[<scope>]` bracket on same-scope rows.
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
// PL-6: manifest soft-fail (catalog CMC-22 form: failed-marketplace header)
// ──────────────────────────────────────────────────────────────────────────

test("PL-6 / CMC-22: manifest load failure renders the marketplace as a bare V2 failed header (no `{unparseable}` brace; no cause trailer)", async () => {
  // V1->V2 byte form (catalog `unparseable-mp` at
  // docs/output-catalog.md:215-226): the V1 rendering surfaced
  // `(failed) {unparseable}` plus a 2-space-indented `cause: <message>`
  // trailer. V2 emits a BARE `(failed)` header (no reasons brace, no
  // cause trailer) because the v2 type model places `cause?: Error`
  // on plugin variants only -- not marketplace headers -- and the
  // orchestrator constructs the unparseable mp with `status: "failed"`
  // + `plugins: []` per the catalog reference. Severity: "error"
  // computed by notify() per D-16-11 (any mp.status === "failed"
  // routes to error). No reload-hint (failed is not in the
  // state-changing variant set per D-16-12).
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
    // Phase 29 / UXG-07 (D-29-03): 0 failed plugins, 1 failed marketplace
    // -> the "1 marketplace operation failed." summary line is prepended.
    assert.equal(note.message, "1 marketplace operation failed.\n\n⊘ mp1 [user] (failed)");
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
// Task 260525-cjr A3: probe-error classification + non-`{unsupported source}`
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

test("260525-cjr A3: narrowProbeError -> generic Error falls through to `unreadable` (NOT `unsupported source`)", () => {
  // The pre-fix behavior was to substring-match the message through
  // `narrowResolverNotes`, which would degrade ANY unrecognized throw
  // to `unsupported source`. The fix routes it to `unreadable`.
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
// straightforward pass-through. The pre-fix call site is documented in
// the commit message; the binding contract is that `narrowProbeError`
// returns the closed-set Reason the user sees on the row.

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
// (Plan 05-02) but lives here so a future contributor of list logic
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
  // D-19-01 retired the V1 PROBE_FAILURES module-level capture-buffer +
  // drain notifyWarning. Probe failures now manifest at row granularity
  // via the per-row `(unavailable) {<narrowed-reason>}` discriminator.
  // This test locks the retirement with defense-in-depth: a direct
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

// Gap 1: hooks unsupported kind via declared field
// resolveStrict reaches step 9 (addUnsupportedKindNotes) and finds
// "hooks" in declaresUnsupportedKind; pushes note "contains hooks"; the
// manifestEntryStatus returns {status:"uninstallable", notes:["contains
// hooks"]} via the notes.length > 0 branch.
test("gap: plugin declaring hooks field buckets as ⊘ with 'contains hooks' note", async () => {
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
          // hooks declared at entry level -- declaresUnsupportedKind fires.
          { name: "hooks-plugin", source: "./hooks-plugin", hooks: ["hooks.json"] },
        ],
      },
      // Source dir must exist so the resolver passes the "dir does not exist"
      // preflight check and reaches the unsupported-kind step.
      installablePluginDirs: ["hooks-plugin"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /⊘ hooks-plugin/);
    assert.match(out, /{hooks}/);
  });
});

// Gap 2: lspServers unsupported kind via declared field
// Same path as Gap 1 but for the "lspServers" kind.
test("gap: plugin declaring lspServers field buckets as ⊘ with 'contains lspServers' note", async () => {
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
    assert.match(out, /⊘ lsp-plugin/);
    assert.match(out, /{lsp}/);
  });
});

// Gap 3: hooks unsupported kind via file convention (UNSUPPORTED_COMPONENT_CONVENTIONS)
// Plugin dir exists but contains hooks/hooks.json -- detected via
// hasUnsupportedConvention; resolver returns installable:false with note
// "contains hooks".
test("gap: plugin dir with hooks/hooks.json file buckets as ⊘ via file convention", async () => {
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

    // Write hooks/hooks.json inside the plugin source dir AFTER seeding so
    // resolver's hasUnsupportedConvention probe finds it.
    const pluginDir = path.join(mpRoot, "hooks-conv");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{}", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    assert.match(out, /⊘ hooks-conv/);
    assert.match(out, /{hooks}/);
  });
});

// Gap 4: lspServers via file convention (.lsp.json)
test("gap: plugin dir with .lsp.json file buckets as ⊘ via file convention", async () => {
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
    assert.match(out, /⊘ lsp-conv/);
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
