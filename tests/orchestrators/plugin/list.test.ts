// tests/orchestrators/plugin/list.test.ts
//
// Phase 13 Wave 2 sub-wave 2d (Plan 13-02d-01):
//
// PL-1..7 orchestrator-level test corpus for listPlugins. Pairs with
// `tests/presentation/plugin-list.test.ts` (byte-shape contract on the
// renderer) -- this file owns the orchestrator semantics on top of the
// new Wave 1 `RowSpec` / `PluginListPayload` shape:
//
//   - PL-1 filter union (--installed / --available / --unavailable)
//   - PL-3 marketplace narrowing
//   - PL-5 (upgradable) string compare
//   - PL-6 manifest soft-fail -> failed-marketplace header per CMC-22
//   - PL-7 <autoupdate> marker via MarketplaceRow.marker
//   - CMC-21 / D-13-17 orphan-fold rule (rendered cross-scope, but the
//     adoption round-trip lives in `tests/integration/fold-adoption.test.ts`)
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
//     truncated to col 66 with U+2026 (catalog binding)

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
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

test("CMC-10: empty state in both scopes renders bare `(no plugins)` EmptyToken", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no plugins)");
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
    // CMC-22 catalog form: installed carries [<scope>]; available/unavailable omit it.
    assert.match(out, /● alpha \[user\] v1\.0\.0 \(installed\)/);
    assert.match(out, /○ beta v2\.0\.0 \(available\)/);
    assert.match(out, /⊘ gamma v3\.0\.0 \(unavailable\)/);
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
    assert.match(out, /● alpha \[user\]/);
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
    // Each header carries its own plugin row.
    assert.match(out, /● alpha \[project\] v0\.9\.0 \(installed\)/);
    assert.match(out, /● alpha \[user\] v1\.0\.0 \(installed\)/);
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
    // CMC-09 (upgradable) carries the ● effective-state icon.
    assert.match(out, /● plug \[user\] v1\.0\.0 \(upgradable\)/);
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
    assert.match(out, /● plug \[user\] v1\.0\.0 \(installed\)/);
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

test("PL-6 / CMC-22: manifest load failure renders the marketplace as a failed header + indented cause trailer", async () => {
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
    const out = notifications[0]!.message;
    // CMC-22 catalog form: ⊘ <mp> [<scope>] (failed) {unparseable} + indented cause.
    assert.match(out, /⊘ mp1 \[user\] \(failed\) \{unparseable\}/);
    assert.match(out, /\n {2}cause:/);
    // Installed plugins are NOT rendered under a failed-manifest header
    // per the catalog (the failure replaces the per-plugin enumeration).
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
