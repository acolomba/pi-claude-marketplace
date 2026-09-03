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
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";
import { mock, verify, when } from "strong-mock";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  availableRowMessage,
  listPlugins,
  loadPluginListPayload,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { narrowUnsupportedKinds } from "../../../extensions/pi-claude-marketplace/shared/probe-classifiers.ts";
import {
  buildInstalledPluginRecord,
  mergeMarketplaceIntoState,
  seedAutoupdateConfig,
} from "../../edge/handlers/marketplace-seed.ts";

import type { ListPluginsOptions } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type ListPluginsWithoutConnections = Omit<ListPluginsOptions, "ctx" | "pi">;
void ({ cwd: "/workspace", scope: "user" } satisfies ListPluginsWithoutConnections);
// @ts-expect-error list is filesystem/state-only and exposes no Git transport option
void ({ cwd: "/workspace", gitOps: {} } satisfies ListPluginsWithoutConnections);

interface NotifyRecord {
  message: string;
  severity?: NotificationSeverity;
}

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
  ui: NotificationUi;
} {
  const notifications: NotifyRecord[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  when(() => pi.getAllTools())
    .thenReturn([])
    .twice();
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .once();

  return { ctx, pi, notifications, ui };
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

    // Retry rmdir: a recursive rm can race a lingering async write (a probe
    // or clone-cache op) and hit ENOTEMPTY on rmdir; retry until it settles.
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

interface TreeEntry {
  readonly bytes?: string;
  readonly path: string;
  readonly type: "directory" | "file";
}

async function snapshotTree(root: string): Promise<readonly TreeEntry[]> {
  const entries: TreeEntry[] = [];
  const walk = async (directory: string): Promise<void> => {
    const children = await fs.promises.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const absolutePath = path.join(directory, child.name);
      const relativePath = path.relative(root, absolutePath);
      if (child.isDirectory()) {
        entries.push({ path: relativePath, type: "directory" });
        await walk(absolutePath);
      } else {
        entries.push({
          path: relativePath,
          type: "file",
          bytes: (await readFile(absolutePath)).toString("base64"),
        });
      }
    }
  };

  await walk(root);

  return entries;
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
   * Installed plugin records keyed by plugin name. `disabled: true` sets the
   * record's `enabled` field and NOTHING else: under ENBL-18 disable preserves
   * every `resources.*` array, so a disabled record's inventory is whatever the
   * caller supplies. The load-bearing "currently disabled" marker is the
   * explicit `enabled: false` boolean alone (ENBL-05 /
   * `persistence/state-io.ts::isRecordedButDisabled`); emptiness is no longer
   * part of it. The default inventory seeds a populated `resources.skills` --
   * a PRODUCTION installed record always has at least one populated array (the
   * resolver's `requireInstallable` gate rules out zero-component
   * installables). `hooksOnly: true` (D-63-04) seeds a hooks-only installed
   * record (resources.hooks populated, every other axis empty) -- the exact
   * shape that triggered the hooks-only-list-disabled regression.
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
      /**
       * ENBL-15 / ENBL-18: per-kind override of the persisted `resources`
       * arrays. Each omitted kind keeps its default; an explicitly empty array
       * seeds a genuinely empty kind. This is the axis that makes a
       * disabled-plus-populated record expressible, which is what ENBL-15 pins.
       */
      resources?: {
        skills?: readonly string[];
        prompts?: readonly string[];
        agents?: readonly string[];
        mcpServers?: readonly string[];
        hooks?: readonly string[];
      };
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

  const plugins: Record<string, unknown> = {};
  for (const [name, info] of Object.entries(opts.installed ?? {})) {
    // ENBL-18: the inventory is INDEPENDENT of `disabled` -- disable preserves
    // every array, so the same defaults apply to an enabled and a disabled
    // record and the caller's `resources` override decides the rest.
    // D-63-04: hooksOnly seeds the resources.hooks axis populated while
    // every other axis is empty (the production shape of a hooks-only
    // installed plugin like learning-output-style).
    const defaults =
      info.hooksOnly === true
        ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [name] }
        : { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [], hooks: [] };
    const override = info.resources;
    const resources: {
      skills: string[];
      prompts: string[];
      agents: string[];
      mcpServers: string[];
      hooks: string[];
    } = {
      skills: [...(override?.skills ?? defaults.skills)],
      prompts: [...(override?.prompts ?? defaults.prompts)],
      agents: [...(override?.agents ?? defaults.agents)],
      mcpServers: [...(override?.mcpServers ?? defaults.mcpServers)],
      hooks: [...(override?.hooks ?? defaults.hooks)],
    };

    plugins[name] = buildInstalledPluginRecord(info, resources);
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

  await mergeMarketplaceIntoState(locations.extensionRoot, mpName, record);

  if (opts.autoupdate !== undefined) {
    await seedAutoupdateConfig(locations, mpName, opts.autoupdate);
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
    // arrange
    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
    assert.equal(notifications[0]!.severity, undefined);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-1 filter union semantics (catalog rows reuse the compact-line shape)
// ──────────────────────────────────────────────────────────────────────────

test("PL-1: no flags = every bucket (installed, available, unavailable)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
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

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-1: --installed alone shows only installed plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    // plugin.scope === mp.scope (both "user") -> bracket suppressed
    // per D-16-17. The installed alpha row is `● alpha v1.0.0 (installed)`,
    // not `● alpha [user] v1.0.0 (installed)`. The `[user]` marker
    // appears on the marketplace header only.
    assert.match(out, /● alpha v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("● alpha [user]"), false, out);
    assert.equal(out.includes("○ beta"), false);
    assert.equal(out.includes("⊘"), false);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-1: --available alone shows only available (not-yet-installed installable) plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
    // assert
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.match(out, /○ beta v2\.0\.0 \(available\)/);
    assert.equal(out.includes("⊘"), false);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-1: --unavailable alone shows only unavailable (⊘) plugins", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
    // assert
    const out = notifications[0]!.message;
    assert.equal(out.includes("● alpha"), false);
    assert.equal(out.includes("○ beta"), false);
    assert.match(out, /⊘ gamma v3\.0\.0 \(unavailable\)/);

    verify(ctx);
    verify(pi);
    verify(ui);
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
 *
 * `pluginJson` defaults to the minimal installable manifest every caller wanted
 * before it existed. It is a parameter because one caller needs to stage a warm
 * clone whose OWN manifest makes a declaration the marketplace entry does not,
 * in order to prove the read surfaces ignore that second declaration site.
 */
async function stageWarmMirror(
  cwd: string,
  canonicalUrl: string,
  pluginJson: Record<string, unknown> = { name: "warm-plugin" },
): Promise<void> {
  const locations = locationsFor("user", cwd);
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(canonicalUrl));
  await mkdir(path.join(mirrorDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(pluginJson),
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
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Byte-equal: the bare `(remote)` row -- no scope bracket (SNM-11), and no
    // PROBE- or SOFT-DEP-derived reason brace (D-80-03 as narrowed by
    // OUT-05). This fixture's entry declares nothing, so there is no
    // entry-derived token either, and the row is bare on both counts.
    assert.equal(out, ["● mp1 [user]", "  ◌ gitplug v1.0.0 (remote)"].join("\n"), out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-02 / OUT-05 / RSTA-01: a COLD git-source entry declaring `defaultEnabled: false` carries `{installs disabled}` on its `(remote)` row; a silent cold entry stays bare", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            name: "delta",
            source: "https://example.com/delta.git",
            version: "1.0.0",
            defaultEnabled: false,
          },
          { name: "epsilon", source: "https://example.com/epsilon.git", version: "1.0.0" },
        ],
      },
      // No mirror staged for either source: both rows are COLD.
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The load-bearing fact is that NO tree exists for either row -- no clone,
    // no mirror, no plugin manifest to read -- so `delta`'s claim can only have
    // come from the marketplace ENTRY the cached manifest holds (OUT-05 /
    // DOC-02).
    // That is what makes the claim reachable on the row of a marketplace the
    // user has never fetched from. `epsilon` is the parity half: a silent entry
    // renders the bare row byte-for-byte, exactly as the assertion above pins.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ◌ delta v1.0.0 (remote) {installs disabled}",
        "  ◌ epsilon v1.0.0 (remote)",
      ].join("\n"),
      out,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-05 / NFR-5 / RSTA-01: the cold `(remote)` claim is rendered with NO clone directory on disk after the call returns", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            name: "delta",
            source: "https://example.com/delta.git",
            version: "1.0.0",
            defaultEnabled: false,
          },
        ],
      },
      // No mirror staged: the row is COLD.
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.equal(
      out,
      ["● mp1 [user]", "  ◌ delta v1.0.0 (remote) {installs disabled}"].join("\n"),
      out,
    );

    // The two halves of the guarantee are asserted TOGETHER: the row states what
    // an install would do, AND nothing was fetched to let it say so. A clone or
    // any other network touch would have to materialize `plugin-clones/`, so the
    // directory's absence after the render is the evidence for the second half.
    // The bytes alone cannot supply it -- a surface that quietly materialized a
    // clone and read it would render exactly the same row.
    //
    // The probe's shape is deliberate on two counts. It asks for path METADATA
    // rather than file content, because a content read against an EXISTING
    // directory throws just as it does against a missing one, so a content-read
    // probe answers "absent" either way. And it runs AFTER the orchestrator
    // returns, because a probe taken before the call describes the fixture
    // rather than the render. The caught code is asserted rather than a bare
    // boolean derived from the try/catch, so a probe that failed for some
    // unrelated reason cannot pass as an absence.
    //
    // A probe carrying either of those faults is unfalsifiable, so this shape
    // is written this way deliberately rather than by accident.
    const locations = locationsFor("user", cwd);
    let probeCode: unknown;
    try {
      await stat(locations.pluginClonesDir);
    } catch (err) {
      probeCode = (err as { code?: unknown }).code;
    }

    assert.equal(probeCode, "ENOENT", "plugin-clones/ must not exist after the render");

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-02 / OUT-05 / DOC-02: an entry declaring `defaultEnabled: false` puts `{installs disabled}` on its `(available)` row; a declared-true entry and a silent entry stay bare", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0", defaultEnabled: false },
          { name: "beta", source: "./beta", version: "1.0.0", defaultEnabled: true },
          { name: "gamma", source: "./gamma", version: "1.0.0" },
        ],
      },
      installablePluginDirs: ["alpha", "beta", "gamma"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Byte-equal over the whole body, so the three rows prove two facts on one
    // run. `alpha`'s ENTRY declares that installing it would leave it disabled,
    // so its row carries the brace -- read offline, with no clone materialized
    // (OUT-05 / DOC-02). `beta` declares the opposite and `gamma` says nothing
    // at all; both render exactly the bytes they rendered before the token
    // existed, which is the no-op parity every plugin that does not use the
    // field is owed.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ○ alpha v1.0.0 (available) {installs disabled}",
        "  ○ beta v1.0.0 (available)",
        "  ○ gamma v1.0.0 (available)",
      ].join("\n"),
      out,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("DFEN-04 / DFEN-05: a config `enabled` declaration SUPPRESSES `{installs disabled}` in EITHER direction, because install checks it first", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // All three entries declare the SAME thing, so the only variable across
      // the rows is what the user's config says about each key.
      manifest: {
        name: "mp1",
        plugins: [
          { name: "alpha", source: "./alpha", version: "1.0.0", defaultEnabled: false },
          { name: "beta", source: "./beta", version: "1.0.0", defaultEnabled: false },
          { name: "gamma", source: "./gamma", version: "1.0.0", defaultEnabled: false },
        ],
      },
      installablePluginDirs: ["alpha", "beta", "gamma"],
    });
    // None of the three is INSTALLED -- these are hand-added declarations for
    // plugins the user has not reloaded into existence yet, which is exactly
    // the state in which a candidate row is read.
    const locations = locationsFor("user", cwd);
    await saveConfig(
      locations.configJsonPath,
      {
        schemaVersion: 1,
        plugins: { "alpha@mp1": { enabled: true }, "beta@mp1": { enabled: false } },
      },
      locations.scopeRoot,
    );

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The row states what an install WOULD do, so it must model the same
    // precedence `install` applies (install.ts::readDeclaredEnabled), not a
    // shorter one:
    //
    // `alpha` -- the config says `enabled: true`. `install` reads that FIRST,
    //   never reaches the entry's default, and the plugin lands ENABLED. A row
    //   claiming otherwise would predict an outcome the install path does not
    //   produce, which is the one thing this claim exists not to do.
    //
    // `beta` -- the config says `enabled: false`. An explicit declaration wins
    //   in EITHER direction, so the entry's default does not apply here either.
    //   The bare row is deliberate: the user typed the value, and the token is
    //   about the manifest's default taking effect, not about the user's own
    //   declaration being echoed back.
    //
    // `gamma` -- no config opinion, so the entry answers and the row claims.
    //   This is the control: it proves the suppression above comes from the
    //   config read and not from the entry read having broken.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ○ alpha v1.0.0 (available)",
        "  ○ beta v1.0.0 (available)",
        "  ○ gamma v1.0.0 (available) {installs disabled}",
      ].join("\n"),
      out,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-02: on a `(partially-available)` row the author-declared token appends at the TAIL, after the degrade tokens", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          // `lspServers` + an on-disk dir resolves `partially-available`, so the
          // row already carries a degrade token before the entry's declaration
          // is considered.
          {
            name: "zeta",
            source: "./zeta",
            version: "1.0.0",
            lspServers: { ls: {} },
            defaultEnabled: false,
          },
        ],
      },
      installablePluginDirs: ["zeta"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The ORDER is asserted deliberately, not incidentally: `composeReasons`
    // joins the array in order and there is no per-row sort, so the tail
    // position of the author-declared token is observable output. Reversing the
    // two tokens in the expected value below fails this test, which is the
    // point -- a later reordering would be a silent behavior change.
    assert.equal(
      out,
      ["● mp1 [user]", "  ⊖ zeta v1.0.0 (partially-available) {lsp, installs disabled}"].join("\n"),
      out,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-02: NEITHER `(unavailable)` path acquires the token -- not the structural resolver arm, not the probe-failure catch -- though both entries declare `defaultEnabled: false`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [
          // A "/" in the name passes the manifest validator but makes
          // `resolveStrict` THROW, so this row comes out of the probe-failure
          // catch rather than the resolver's structural arm.
          {
            name: "bad/name",
            source: "./badname",
            version: "1.0.0",
            defaultEnabled: false,
          },
          // No on-disk dir seeded, so this row comes out of the resolver's
          // structural `unavailable` arm.
          { name: "gone", source: "./gone", version: "1.0.0", defaultEnabled: false },
        ],
      },
      // No installablePluginDirs: neither entry resolves.
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Byte-equal rather than a non-match, so absence is proven together with
    // everything else on both rows staying put. The exclusion is deliberate:
    // nothing will install at all from either path, so the token would state
    // what an install does about an install that cannot happen, and each row's
    // brace already carries the blocker the user came to read.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ⊘ bad/name v1.0.0 (unavailable) {unreadable}",
        "  ⊘ gone v1.0.0 (unavailable) {unsupported source}",
      ].join("\n"),
      out,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-02 / D-95-02: an INSTALLED plugin's row never acquires the token, though its entry declares `defaultEnabled: false`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", defaultEnabled: false }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The durable-versus-transient rule (D-95-02): the token is a claim about an
    // action NOT YET TAKEN, and a steady-state inventory row states durable
    // facts about an existing record. Once the plugin is installed the row's
    // subject is the record, and what an install would have done is no longer
    // news. This holds because the installed-row builder was never taught the
    // token -- there is no runtime guard to relax.
    assert.equal(out, ["● mp1 [user]", "  ● alpha v1.0.0 (installed)"].join("\n"), out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("RSTA-07 / D-80-07: `--remote` selects only the remote bucket; `--available` alone EXCLUDES the cold git source; `--available --remote` includes both", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
      const { ctx, pi, notifications, ui } = makeCtx();
      // act
      await listPlugins({ ctx, pi, cwd, scope: "user", remote: true });
      const out = notifications[0]!.message;
      assert.match(out, /◌ gitplug v2\.0\.0 \(remote\)/, out);
      assert.equal(out.includes("avail"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    // --available alone: the cold git source is EXCLUDED (the intended change);
    // only the path-source available row shows.
    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
      const out = notifications[0]!.message;
      assert.match(out, /○ avail v1\.0\.0 \(available\)/, out);
      assert.equal(out.includes("gitplug"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    // --available --remote: BOTH rows restore the pre-`defaultEnabled` set.
    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true, remote: true });
      // assert
      const out = notifications[0]!.message;
      assert.match(out, /○ avail v1\.0\.0 \(available\)/, out);
      assert.match(out, /◌ gitplug v2\.0\.0 \(remote\)/, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }
  });
});

test("RSTA-05 / D-80-04: a not-installed git source with a WARM clone classifies its three-way verdict (`available`), NOT `remote`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // A warm tree resolves `installable` -> `(available)`, never `(remote)`.
    assert.match(out, /○ warm-plugin v1\.0\.0 \(available\)/, out);
    assert.equal(out.includes("(remote)"), false, out);

    // The warm source is NOT in the `--remote` bucket, and DOES pass `--available`.
    {
      const { ctx: c2, pi: p2, notifications: n2, ui: u2 } = makeCtx();
      await listPlugins({ ctx: c2, pi: p2, cwd, scope: "user", remote: true });
      assert.equal(n2[0]!.message.includes("warm-plugin"), false, n2[0]!.message);

      verify(c2);
      verify(p2);
      verify(u2);
    }

    {
      const { ctx: c3, pi: p3, notifications: n3, ui: u3 } = makeCtx();
      await listPlugins({ ctx: c3, pi: p3, cwd, scope: "user", available: true });
      // assert
      assert.match(n3[0]!.message, /○ warm-plugin v1\.0\.0 \(available\)/, n3[0]!.message);

      verify(c3);
      verify(p3);
      verify(u3);
    }

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("OUT-05 / DOC-02: a SILENT entry over a warm clone that declares `defaultEnabled: false` renders the bare row -- declining to claim is the correct answer", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const canonicalUrl = "https://example.com/warmdecl";
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The ENTRY says nothing about the install-time default.
      manifest: {
        name: "mp1",
        plugins: [{ name: "warmdecl", source: canonicalUrl, version: "1.0.0" }],
      },
    });
    // The warm clone's OWN manifest declares what the entry does not. It is
    // readable here, fs-only, with no fetch -- which is exactly what makes
    // ignoring it a decision rather than an inability.
    await stageWarmMirror(cwd, canonicalUrl, { name: "warmdecl", defaultEnabled: false });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Three things this pins, in the order they matter (OUT-05 / DOC-02):
    //
    // 1. The bare row is the CORRECT outcome, not a gap. The whole body is
    //    asserted so the absence of the brace is proven alongside everything
    //    else on the row staying put.
    //
    // 2. The marketplace entry is the only MANIFEST-side source these surfaces
    //    read -- `domain/resolver.ts::entryDeclaresInstallDisabled` carries the
    //    argument for why, and `rowClaimsInstallDisabled` beside it carries the
    //    other half of the rule (the user's config opinion is weighed first).
    //
    // 3. What this test is FOR: it fails the moment either read surface starts
    //    honoring the clone's own declaration. Such a change would LOOK like a
    //    bug fix -- it would make these surfaces agree with what the install
    //    path reads -- and it is not one. It reintroduces the warm/cold
    //    asymmetry, and the only remedy for that asymmetry is a fetch the
    //    network-free requirement forbids. OUT-05 / DOC-02 own the rule; do
    //    not "fix" this toward what install reads.
    assert.equal(out, ["● mp1 [user]", "  ○ warmdecl v1.0.0 (available)"].join("\n"), out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("T-80-08 / D-78-04: an INSTALLED git plugin with a missing clone stays `(installed)`, never `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The installed path (installedRowMessage) never renders `(remote)` -- the
    // `remote` derivation lives only on the not-installed availableRowMessage
    // path. A cold clone does not regress the row (D-78-04 degrade preserved).
    assert.match(out, /● gitplug v1\.0\.0 \(installed\)/, out);
    assert.equal(out.includes("(remote)"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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
      const { ctx, pi, notifications, ui } = makeCtx();
      // act
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊖ unsup v1\.0\.0 \(partially-available\) \{lsp\}/, out);
      assert.equal(out.includes("clean"), false, out);
      assert.equal(out.includes("gone"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    // --unavailable: structural `gone` only; the unsupported `unsup` is NOT here.
    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);
      // Match the row token (the `{unsupported source}` reason contains the
      // `unsup` substring, so the bare name would false-positive).
      assert.equal(out.includes("unsup v1.0.0"), false, out);
      assert.equal(out.includes("clean"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    // --available: only the clean row.
    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", available: true });
      // assert
      const out = notifications[0]!.message;
      assert.match(out, /○ clean v2\.0\.0 \(available\)/, out);
      assert.equal(out.includes("unsup v1.0.0"), false, out);
      assert.equal(out.includes("gone"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }
  });
});

test("LIST-01 / D-67-01: a structurally-unavailable plugin shows under --unavailable and is ABSENT under --unsupported", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
      const { ctx, pi, notifications, ui } = makeCtx();
      // act
      await listPlugins({ ctx, pi, cwd, scope: "user", unavailable: true });
      const out = notifications[0]!.message;
      assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      // assert
      const out = notifications[0]!.message;
      assert.equal(out.includes("gone"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }
  });
});

test("LIST-01 / D-67-01: a force-installed plugin shows under --installed (A1) and is ABSENT under --unsupported", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
      const { ctx, pi, notifications, ui } = makeCtx();
      // act
      await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
      const out = notifications[0]!.message;
      assert.match(out, /◉ forced v1\.0\.0 \(partially-installed\)/, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }

    {
      const { ctx, pi, notifications, ui } = makeCtx();
      await listPlugins({ ctx, pi, cwd, scope: "user", partial: true });
      // assert
      const out = notifications[0]!.message;
      assert.equal(out.includes("forced"), false, out);

      verify(ctx);
      verify(pi);
      verify(ui);
    }
  });
});

test("PHOOK-05 / D-71-04: a force-installed partial-hook plugin renders the single aggregate {unsupported hooks} marker on the list row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◉ hookplug v1\.0\.0 \(partially-installed\) \{unsupported hooks\}/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("LIST-01 / D-67-01 (A1): a force-upgradable plugin shows under --installed", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● fup v1\.0\.0 \(partially-upgradable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // Both the user-side row (no bracket) AND the folded project-side row
    // ([project]) appear for each name -> the same-name pair the sort's
    // `scopeOf` compares.
    assert.match(out, /◉ fi v1\.0\.0 \(partially-installed\)/, out);
    assert.match(out, /◉ fi \[project\] v1\.0\.0 \(partially-installed\)/, out);
    assert.match(out, /● fu v1\.0\.0 \(partially-upgradable\)/, out);
    assert.match(out, /● fu \[project\] v1\.0\.0 \(partially-upgradable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// USTAT-01 / SNM-11 / D-64-01: two NOT-installed manifest entries that share a
// name (the manifest schema carries no name-uniqueness constraint) both
// resolve `unsupported`, so two `(unsupported)` rows land in one block. The
// in-block sort compares them (byName === 0), invoking `scopeOf` on the
// `unsupported` status -- the only list-surface producer of that sort arm.
test("USTAT-01 / SNM-11: two same-name not-installed unsupported rows exercise the unsupported scope-sort arm", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    const matches = out.match(/⊖ dup v1\.0\.0 \(partially-available\) \{lsp\}/g) ?? [];
    assert.equal(matches.length, 2, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("LIST-01 / D-67-01: passive (no filter flag) shows every bucket and the not-installed unsupported row renders the `(unsupported)` byte form", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● inst v1\.0\.0 \(installed\)/, out);
    assert.match(out, /○ avail v2\.0\.0 \(available\)/, out);
    assert.match(out, /⊘ gone v3\.0\.0 \(unavailable\)/, out);
    // USTAT-01 / D-64-01: the not-installed `unsupported` row renders the
    // de-collapsed `(unsupported)` / `⊖` token, distinct from structural `⊘`.
    assert.match(out, /⊖ unsup v4\.0\.0 \(partially-available\) \{lsp\}/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// D-54-01 / ENBL-04: recorded-but-disabled inventory row (CR-02 producer)
// ──────────────────────────────────────────────────────────────────────────

test("ENBL-04: recorded-but-disabled record renders `(disabled)` -- NOT `(installed)` -- and stays distinct from `(unavailable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // Catalog `disabled-inventory` row form: ◍ glyph (ICON_DISABLED), version
    // pin rendered, `(disabled)` token. Severity info (inventory row, not a
    // failure).
    assert.match(out, /◍ alpha v1\.2\.3 \(disabled\)/, out);
    assert.equal(out.includes("(installed)"), false, `must not render (installed): ${out}`);
    assert.equal(out.includes("(unavailable)"), false, `must not render (unavailable): ${out}`);
    assert.equal(notifications[0]!.severity, undefined, "disabled inventory routes to info");

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("ENBL-04: disabled record with drifted manifest version does NOT render `(upgradable)` (version pin frozen while disabled)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◍ alpha v1\.2\.3 \(disabled\)/, out);
    assert.equal(out.includes("(upgradable)"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("ENBL-04 / PL-1: --installed filter includes the disabled bucket (a disabled plugin IS recorded)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◍ alpha v1\.0\.0 \(disabled\)/, out);
    assert.equal(out.includes("○ beta"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ENBL-06: disabled-ness (`enabled`) and availability
// (`compatibility.installable`) are orthogonal axes, so a record whose
// install-time resolution dropped a component kind is still DISABLED once the
// user disables it.
//
// ENBL-16: both records here are absent from the loaded manifest and both
// dropped the same kind, so the braces separate the two reason SOURCES. The
// disabled row names manifest absence alone -- its unsupported-kind tokens stay
// suppressed, because a dropped component describes runtime behavior that is
// suspended while the plugin is disabled. The enabled partial beside it keeps
// `{not in manifest, lsp}`, which is what makes the two shapes distinguishable
// inside one marketplace block.
test("ENBL-06 / ENBL-16: a manifest-absent disabled PARTIAL renders `(disabled) {not in manifest}` beside an enabled partial's `(partially-installed) {not in manifest, lsp}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The manifest LOADED and declares neither record, which is the only
      // state that backs an absence claim (BOUND-03 / D-95-05).
      manifest: { name: "mp1", plugins: [] },
      // Both records carry the same dropped kind; only `disabled` differs.
      installed: {
        alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] },
        beta: { version: "1.0.0", unsupported: ["lspServers"] },
      },
      installablePluginDirs: ["alpha", "beta"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });

    // assert
    assert.equal(notifications.length, 1);
    const out = notifications[0]!.message;
    // The byte form IS the contract: one join proves both status tokens, the
    // brace asymmetry, and the row order together. `alpha` staying first shows
    // that reclassifying a record from partially-installed to disabled does not
    // move its row -- order is state insertion order, not bucket order.
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "  ◉ beta v1.0.0 (partially-installed) {not in manifest, lsp}",
      ].join("\n"),
    );

    // Row-scoped negatives so a regression names itself. A whole-output check
    // for `lsp` would be defeated by beta's legitimate token. The disabled
    // row's reason list holds AT MOST one member, so no ordering rule applies
    // to it -- the join above is the whole assertion.
    const alphaRow = out.split("\n").find((line) => line.includes("alpha")) ?? "";
    assert.equal(alphaRow.includes("{lsp}"), false, alphaRow);
    assert.equal(alphaRow.includes("lsp"), false, `no unsupported-kind token: ${alphaRow}`);
    assert.equal(alphaRow.includes("(partially-installed)"), false, alphaRow);
    assert.equal(notifications[0]!.severity, undefined, "disabled inventory routes to info");

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ENBL-15 / D-100-06: the disabled row renders byte-identically whatever the
// retained inventory holds. `agents` and `mcpServers` are the two axes the
// soft-dependency markers derive from, and ENBL-18 lets a disabled record keep
// them populated, so this is the pair that could leak. The guarantee is
// STRUCTURAL, not test-enforced: `PluginDisabledMessage` declares no
// `dependencies` field and the render arm hard-codes both soft-dep arguments
// false. `makeCtx` probes BOTH companions as UNLOADED, which is exactly the
// condition under which a leak would render `{requires pi-subagents, requires
// pi-mcp}` -- so a bare row here is evidence, not an accident of the harness.
const DISABLED_BARE_ROW = ["● mp1 [user]", "  ◍ alpha v1.0.0 (disabled)"].join("\n");

/**
 * Render one disabled `alpha` whose retained inventory is the caller's, and
 * report the message alongside the arrays that actually reached `state.json`.
 * The recorded arrays are returned because a seeder that silently emptied them
 * would make the byte assertion vacuous.
 */
async function renderDisabledWithInventory(inventory: {
  agents: readonly string[];
  mcpServers: readonly string[];
}): Promise<{ out: string; recorded: { agents: string[]; mcpServers: string[] } }> {
  return withHermeticHome(async ({ home, cwd }) => {
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
      installed: { alpha: { version: "1.0.0", disabled: true, resources: inventory } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);

    const raw = await readFile(
      path.join(locationsFor("user", cwd).extensionRoot, "state.json"),
      "utf8",
    );
    const state = JSON.parse(raw) as {
      marketplaces: Record<
        string,
        {
          plugins: Record<string, { resources: { agents: string[]; mcpServers: string[] } }>;
        }
      >;
    };

    verify(ctx);
    verify(pi);
    verify(ui);
    return {
      out: notifications[0]!.message,
      recorded: state.marketplaces.mp1!.plugins.alpha!.resources,
    };
  });
}

test("ENBL-15 / D-100-06: a disabled record with populated agents and mcpServers renders the same bytes as one with empty arrays", async () => {
  // arrange
  // act
  const populated = await renderDisabledWithInventory({
    agents: ["alpha-agent"],
    mcpServers: ["alpha-mcp"],
  });
  const empty = await renderDisabledWithInventory({ agents: [], mcpServers: [] });

  // The populated fixture must really be populated on disk.
  // assert
  assert.deepEqual(populated.recorded.agents, ["alpha-agent"]);
  assert.deepEqual(populated.recorded.mcpServers, ["alpha-mcp"]);
  assert.deepEqual(empty.recorded.agents, []);
  assert.deepEqual(empty.recorded.mcpServers, []);

  // ONE expected literal for both shapes: the two cases collide deliberately,
  // so a divergence turns exactly one of these comparisons red.
  assert.equal(populated.out, DISABLED_BARE_ROW);
  assert.equal(empty.out, DISABLED_BARE_ROW);
  assert.equal(populated.out.includes("{"), false, populated.out);
});

// D-63-04: hooks-only installed plugin must render `(installed)`, NOT
// `(disabled)`. Regression pin for the hooks-only-list-disabled bug --
// the hook bridge added resources.hooks to the state schema
// but did not extend the 4-axis empty-resources predicate, so a
// hooks-only installed plugin satisfied isRecordedButDisabled and the
// list renderer routed the row to the (disabled) arm.
test("D-63-04: hooks-only installed plugin renders `(installed)` -- NOT `(disabled)` -- on /claude:plugin list", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● hookplug v1\.0\.0 \(installed\)/, out);
    assert.equal(out.includes("(disabled)"), false, `must not render (disabled): ${out}`);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// SC-6 scope narrowing + cross-scope visibility for fold rule
// ──────────────────────────────────────────────────────────────────────────

test("SC-6: bare form (no opts.scope) enumerates marketplaces from BOTH scopes", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    const out = notifications[0]!.message;
    // MSG-GR-3 sort: p-mp < u-mp alphabetically -> p-mp renders first.
    assert.match(out, /● p-mp \[project\]/);
    assert.match(out, /● u-mp \[user\]/);
    const pIdx = out.indexOf("p-mp");
    const uIdx = out.indexOf("u-mp");
    assert.ok(pIdx >= 0 && uIdx >= 0 && pIdx < uIdx, `expected p-mp before u-mp: ${out}`);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("CMC-21 / D-13-17 / D-13-19: same-name marketplace in BOTH scopes renders TWO separate headers when added independently", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
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

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
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

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-3: marketplace narrowing
// ──────────────────────────────────────────────────────────────────────────

test("PL-3: opts.marketplace narrows to a single marketplace; other marketplaces are excluded", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", marketplace: "official" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /official/);
    assert.match(out, /off-plug/);
    assert.equal(out.includes("community"), false);
    assert.equal(out.includes("com-plug"), false);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-5: upgradable via STRING comparison (NOT semver)
// ──────────────────────────────────────────────────────────────────────────

test("PL-5: installed version differs from manifest version -> upgradable", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // CMC-09 (upgradable) carries the ● effective-state
    // icon. D-16-17: `[<scope>]` suppressed when `p.scope === mp.scope`.
    assert.match(out, /● plug v1\.0\.0 \(upgradable\)/);
    assert.equal(out.includes("● plug [user]"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-5: installed version equals manifest version -> NOT upgradable", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // D-16-17 suppresses `[<scope>]` bracket on same-scope rows.
    assert.match(out, /● plug v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("● plug [user]"), false, out);
    assert.equal(out.includes("upgradable"), false);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-5: hash-* versions string-compare (any difference -> upgradable; NOT semver)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /\(upgradable\)/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// FSTAT-01 / FSTAT-03 / FSTAT-04 / FSTAT-05 / D-66-01 / D-66-02 force-state
// deriver matrix: purity (no state write), A4 ordering (force-installed wins),
// no-network candidate split, and auto-return-to-installed.
// ──────────────────────────────────────────────────────────────────────────

test("FSTAT-01 / D-66-01: recorded-installed with compatibility.unsupported derives `(partially-installed)` without mutating the workspace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const workspaceBefore = {
      cwd: await snapshotTree(cwd),
      home: await snapshotTree(home),
    };

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.deepStrictEqual(notifications, [
      { message: "● mp1 [user]\n  ◉ plug v1.0.0 (partially-installed) {lsp}" },
    ]);
    assert.deepStrictEqual(
      { cwd: await snapshotTree(cwd), home: await snapshotTree(home) },
      workspaceBefore,
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("WR-02 / D-66-01: non-path (npm) recorded-installed plugin with persisted unsupported derives `(partially-installed)` on list (parity with info)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(
      notifications[0]!.message,
      // Byte-identical to the non-path `info` row (sans the info-only
      // `components: not resolved` line) -- the WR-02 cross-surface parity.
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("FSTAT-04 / D-66-02 (A4): a degraded record with a newer candidate derives `(partially-installed)`, NEVER `(partially-upgradable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /\(partially-installed\)/);
    assert.equal(out.includes("(partially-upgradable)"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("FSTAT-04 / D-66-02: clean record + candidate resolving `unsupported` derives `(partially-upgradable)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // ● glyph (clean today) + `(partially-upgradable)`; version stays the installed
    // record's version. The reasons brace carries the narrowUnsupportedKinds
    // marker for the degrading candidate kind.
    assert.match(out, /● plug v1\.0\.0 \(partially-upgradable\)/);
    assert.match(out, new RegExp(`\\{${narrowUnsupportedKinds(["lspServers"]).join(", ")}\\}`));

    // assert
    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("FSTAT-03 / FSTAT-04: clean record + candidate resolving `installable` derives `(upgradable)` (no force state)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● plug v1\.0\.0 \(upgradable\)/);
    assert.equal(out.includes("force-"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // The throwing candidate degrades to a plain `(upgradable)` row...
    assert.match(out, /bad\/name v1\.0\.0 \(upgradable\)/, out);
    // ...the sibling row is intact...
    assert.match(out, /good v1\.0\.0 \(installed\)/, out);
    // ...and the whole list was NOT replaced by the synthetic failure row.
    assert.equal(out.includes("(failed)"), false, out);
    assert.equal(out.includes("(list)"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("FSTAT-03: clean record + no newer candidate derives `(installed)` (auto-return, no lingering force state)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● plug v1\.0\.0 \(installed\)/);
    assert.equal(out.includes("force-"), false, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("FSTAT-01 / D-64-02: the force-installed row's reasons are the narrowUnsupportedKinds dropped-component markers", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    const expectedMarkers = narrowUnsupportedKinds(["lspServers", "monitors"]).join(", ");
    // assert
    assert.match(out, /\(partially-installed\)/);
    assert.match(out, new RegExp(`\\{${expectedMarkers}\\}`));

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
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

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-7 / CMC-05: <autoupdate> marker on marketplace headers
// ──────────────────────────────────────────────────────────────────────────

test("PL-7 / CMC-05: marketplace with autoupdate=true renders the <autoupdate> marker on the header", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "auto-mp",
      manifest: { name: "auto-mp", plugins: [] },
      autoupdate: true,
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● auto-mp \[user\] <autoupdate>/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-7 / CMC-05: marketplace with autoupdate=false (or undefined) does NOT render the <autoupdate> marker", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "plain-mp",
      manifest: { name: "plain-mp", plugins: [] },
      autoupdate: false,
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● plain-mp \[user\]/);
    assert.equal(out.includes("<autoupdate>"), false);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Probe-error classification + non-`{unsupported source}`
// surface for unexpected `resolveStrict` throws inside `availableRowComputation`.
// ──────────────────────────────────────────────────────────────────────────

// Note on integration coverage: constructing a real fixture that drives
// `resolveStrict` into THROWING (vs returning NotInstallable with notes)
// requires FS-level fault injection that is brittle across platforms
// (chmod 000 behaves differently as root, on tmpfs, on macOS APFS, etc.).
// The classifier ladder is exercised branch by branch in
// tests/shared/probe-classifiers.test.ts, against the public
// `narrowProbeError` this surface delegates to; the orchestrator wiring is
// a straightforward pass-through. The binding contract is that the ladder
// returns the closed-set Reason the user sees on the row.

// ──────────────────────────────────────────────────────────────────────────
// WR-03: narrowListFailReason -- dedicated narrower for orchestrator-level
// list failures (loadState / cross-scope walk throws). Distinct from
// narrowProbeError (per-row resolver probe failures). Mirrors the same
// classifier ladder so the test ergonomics carry over.
//
// Its ladder tests live in tests/shared/probe-classifiers.test.ts, beside
// the shared classifiers this wrapper delegates to -- the same move the
// probe-error note above records. Nothing is asserted here.
// ──────────────────────────────────────────────────────────────────────────

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
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Plugin admits cleanly (no hooks.json on disk -> no parse-fail flip).
    assert.match(out, /○ hooks-plugin/);
    assert.doesNotMatch(out, /\{hooks\}/);
    assert.doesNotMatch(out, /contains hooks/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Gap 2: lspServers unsupported kind via declared field
// Same path as Gap 1 but for the "lspServers" kind.
test("gap: plugin declaring lspServers field renders as ⊖ (unsupported) with {lsp} note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /⊖ lsp-plugin/);
    assert.match(out, /{lsp}/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// HOOK-01 + D-57-04: hooks/hooks.json convention file now drives admission.
// A PARSEABLE file admits the plugin (no longer unavailable); a MALFORMED
// file flips to unavailable with the parse-failure note.
test("HOOK-01: plugin dir with parseable hooks/hooks.json buckets as ○ (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /○ hooks-conv/);
    assert.doesNotMatch(out, /\{hooks\}/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// D-57-04 / HOOK-04: malformed hooks/hooks.json flips to ⊘ with
// {unsupported hooks} reason (the parse-failure detail flows through
// narrowResolverNotes's prefix-anchored detection on the resolver's
// `"malformed hooks.json: "` wrapper).
test("D-57-04: plugin dir with malformed hooks/hooks.json buckets as ⊘ with {unsupported hooks} reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /⊘ hooks-conv/);
    assert.match(out, /\{unsupported hooks\}/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Gap 4: lspServers via file convention (.lsp.json)
test("gap: plugin dir with .lsp.json file renders as ⊖ (unsupported) via file convention", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /⊖ lsp-conv/);
    assert.match(out, /{lsp}/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Gap 5: resolveStrict THROWS -- caught by manifestEntryStatus catch block
// A plugin name containing "/" passes MARKETPLACE_VALIDATOR (name is
// Type.String()) but causes resolveStrict to throw via assertSafeName.
// The catch at manifestEntryStatus lines 149-151 catches it and returns
// {status:"uninstallable", notes:[errorMessage(err)]}.
test("gap: plugin with path-separator in name -- resolveStrict throws, caught as ⊘", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Row is bucketed as uninstallable; note contains the assertSafeName message.
    assert.match(out, /⊘/);
    assert.match(out, /{unreadable}/);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PL-4: description flows from manifest entry onto rendered output
// ──────────────────────────────────────────────────────────────────────────

test("PL-4: manifest description appears as 4-space-indented second line on installed, available, and unavailable rows", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
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

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PL-4: manifest entry without description renders no second line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Only the plugin row -- no second line follows the (installed) token.
    assert.ok(out.includes("● alpha v1.0.0 (installed)"), `plugin row missing; got: ${out}`);
    // No 4-space indent anywhere (no description).
    assert.ok(!out.includes("    "), `unexpected indented second line; got: ${out}`);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Gap 6: collectMarketplacePlugins manifest=undefined with no installed plugins
// The early-return branch (manifest === undefined) fires and returns [] when
// the marketplace has no installed records and no loadable manifest.
// This path confirms zero available rows appear without a manifest even when
// the marketplace record itself is valid.
test("gap: manifest load fails + zero installed -> marketplace renders with warning and no plugin rows", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Manifest load failure renders the marketplace as (failed) with error severity.
    assert.match(out, /mp1.*failed/);
    assert.equal(notifications[0]?.severity, "error");

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Gap 7: listPlugins top-level catch -- loadPluginListPayload throws
// Writing corrupt JSON to state.json causes loadState to throw; the
// listPlugins try/catch (lines 264-269) catches it and calls notifyError.
test("gap: corrupt state.json causes listPlugins to notify an error", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const extensionRoot = path.join(userRoot, "pi-claude-marketplace");
    await mkdir(extensionRoot, { recursive: true });
    const stateJsonPath = path.join(extensionRoot, "state.json");
    // Write corrupt JSON -- loadState throws, listPlugins catches it.
    await writeFile(stateJsonPath, "{ this is not valid json }", "utf8");

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    // notifyError is called; severity should be "error".
    assert.equal(notifications[0]!.severity, "error");
    // The error message should reference the JSON parse failure.
    assert.match(notifications[0]!.message, /state\.json/);
    // ...and carry the closed-set reason token. `narrowListFailReason` is a
    // one-line delegate to `sharedNarrowProbeError`, whose ladder is tested
    // directly in tests/shared/probe-classifiers.test.ts. This assertion is
    // what pins the delegate itself: without it, hardcoding either wrapper's
    // return value leaves the whole suite green.
    //
    // `unreadable`, not `unparseable`: loadState wraps the JSON failure, so
    // the error reaching the classifier is not a bare SyntaxError and lands
    // on the permissive fallback arm.
    assert.match(notifications[0]!.message, /\{unreadable\}/);

    verify(ctx);
    verify(pi);
    verify(ui);
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
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("RSTA-01 / D-80-03: an uninstalled github-object-source plugin renders (remote)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◌ ghplug v2\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /ghplug.*\(unavailable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("RSTA-01 / D-80-03: an uninstalled git-subdir-source plugin renders (remote)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◌ subplug v3\.0\.0 \(remote\)/, out);
    assert.doesNotMatch(out, /subplug.*\(unavailable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PURL-08 / D-78-04: an installed git-source plugin with a missing clone keeps its recorded (installed) status", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● gplug v1\.0\.0 \(installed\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);
    assert.doesNotMatch(out, /gplug.*\(partially/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("PURL-08 / D-78-04: an installed git-source plugin with a newer manifest and a missing clone degrades to plain (upgradable), never (unavailable)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /● gplug v1\.0\.0 \(upgradable\)/, out);
    assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("RSTA-01: list renders an uninstalled git-source plugin as a `(remote)` row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    assert.match(out, /◌ gplug v1\.0\.0 \(remote\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("RSTA-01 / SNM-11: a `remote` row sorts by the marketplace scope when its name case-ties a sibling row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    const out = notifications[0]!.message;
    // Both rows render inside the one mp1 block; the scope tie-break returns
    // equal scopes, so the original (manifest) order is preserved.
    assert.match(out, /○ caseplug v1\.0\.0 \(available\)/, out);
    assert.match(out, /◌ CasePlug v2\.0\.0 \(remote\)/, out);

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// Manifest-absence cases consolidated from the former supplemental owner.

test("plugin list manifest absent: INV-01: an enabled, fully supported record absent from a LOADED manifest renders `{not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // A manifest that parses with an EMPTY `plugins` array is a successful
      // load, so every installed record under it is genuinely absent.
      manifest: { name: "mp1", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: INV-01 / MSG-GR-4: the soft-dep marker composes AFTER the typed reason inside one brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // The record declares agents and the companion probes as unloaded.
      installed: {
        alpha: { version: "1.0.0", resources: { agents: ["alpha-agent"] } },
      },
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp1 [user]",
        "  ● alpha v1.0.0 (installed) {not in manifest, requires pi-subagents}",
      ].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: INV-01: a record the loaded manifest DOES declare renders with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
      // Same version as the manifest entry, so the row stays `(installed)`
      // rather than deriving `(upgradable)` on the PL-5 string compare.
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: INV-01: manifest membership is EXACT string identity -- a name differing only in case is a miss", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The manifest declares `Alpha`; the installed record is `alpha`. The
      // membership test applies no case folding and no Unicode normalization,
      // so the record is absent.
      manifest: {
        name: "mp1",
        plugins: [{ name: "Alpha", source: "./Alpha", version: "1.0.0" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["Alpha"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // `--installed` keeps the undeclared-but-available `Alpha` row out of the
    // expectation so the assertion isolates the membership question.
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// INV-02: the degraded manifest-absent row
// ──────────────────────────────────────────────────────────────────────────

test("plugin list manifest absent: INV-02: a manifest-absent degraded record keeps its glyph, recorded version and unsupported-kind reasons", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // Manifest LOADS and simply does not declare `plug`.
      manifest: { name: "mp1", plugins: [] },
      installed: { plug: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // Same-scope row: the `[user]` bracket is suppressed (D-16-17). INV-02
      // puts the absence reason FIRST, ahead of the unsupported-kind token:
      // `composeReasons` joins in array order.
      ["● mp1 [user]", "  ◉ plug v1.0.0 (partially-installed) {not in manifest, lsp}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: INV-02: a degraded record its manifest still DECLARES keeps its unsupported-kind reasons alone", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "remote", source: "./remote", version: "1.0.0" }],
      },
      installed: { remote: { version: "1.0.0", unsupported: ["lspServers"] } },
      installablePluginDirs: ["remote"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The prepend is GATED on manifest absence: this record IS declared
      // (same name, same version, so the row stays `partially-installed`
      // rather than deriving the upgradable arm), and an ungated prepend
      // would falsify it.
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: INV-02: a manifest-absent degraded record with a non-carve-out kind renders `{not in manifest, unsupported component}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // `themes` is not one of `narrowUnsupportedKinds`' carve-outs
      // (`lspServers` -> `lsp`, `hooks` -> `unsupported hooks`), so it maps to
      // the generic token.
      installed: { plug: { version: "1.0.0", unsupported: ["themes"] } },
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp1 [user]",
        "  ◉ plug v1.0.0 (partially-installed) {not in manifest, unsupported component}",
      ].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ENBL-16: the disabled row names manifest absence, and nothing else
// ──────────────────────────────────────────────────────────────────────────

// ENBL-16 / D-100-07 supersedes INV-04's no-reason clause. Manifest absence is
// a DURABLE fact that constrains what the user can do next: `plugin enable`
// re-runs the install ledger, which resolves from the marketplace manifest, so
// a disabled record the manifest no longer declares cannot be re-enabled. The
// bare row gave no warning before the attempt. Every OTHER reason stays
// suppressed on this row -- they describe runtime behavior that is currently
// suspended.
test("plugin list manifest absent: ENBL-16: a manifest-absent disabled record renders `(disabled) {not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      installed: { dis: { version: "1.2.3", disabled: true } },
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ◍ dis v1.2.3 (disabled) {not in manifest}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// The gate half of the pair: an absence claim is made only against a manifest
// that loaded AND omitted the entry (BOUND-03 / D-95-05). A manifest that still
// declares the plugin backs no claim, so the row stays byte-identical to the
// legacy bare form.
test("plugin list manifest absent: ENBL-16: a disabled record its manifest STILL declares renders `(disabled)` with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: {
        name: "mp1",
        plugins: [{ name: "dis", source: "./dis", version: "1.2.3" }],
      },
      installed: { dis: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["dis"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ◍ dis v1.2.3 (disabled)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// INV-03: `--installed` membership
// ──────────────────────────────────────────────────────────────────────────

test("plugin list manifest absent: INV-03: `--installed` spans both manifest-absent installed forms and excludes `(available)` rows", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // `avail` is declared but NOT installed; neither installed record is
      // declared. One manifest, three distinct row fates.
      manifest: {
        name: "mp1",
        plugins: [{ name: "avail", source: "./avail", version: "1.0.0" }],
      },
      installed: {
        clean: { version: "1.0.0" },
        degraded: { version: "2.0.0", unsupported: ["lspServers"] },
      },
      installablePluginDirs: ["avail"],
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // MSG-GR-3 row order is name-primary (case-insensitive), scope-secondary
      // and never consults reasons: `clean` precedes `degraded`.
      [
        "● mp1 [user]",
        "  ● clean v1.0.0 (installed) {not in manifest}",
        "  ◉ degraded v2.0.0 (partially-installed) {not in manifest, lsp}",
      ].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// BOUND-03: the cross-scope orphan fold
// ──────────────────────────────────────────────────────────────────────────

/**
 * Write a PROJECT-scope marketplace record that is a CLONE of the user-scope
 * one: the install orchestrator copies `marketplaceRoot` verbatim, and that
 * root is the ONLY field `isCloneOfUserMarketplace` compares, so sharing it is
 * what makes the fold trigger. `manifestPath` is the axis under test -- a
 * missing file makes the project-side manifest read FAIL, the user record's
 * real manifest makes it LOAD without the entry.
 *
 * `seedMarketplace` cannot express this: it allocates a fresh marketplace root
 * per call.
 */
async function seedFoldedProjectClone(opts: {
  cwd: string;
  marketplaceRoot: string;
  manifestPath: string;
  pluginName: string;
  version: string;
}): Promise<void> {
  const projectLocations = locationsFor("project", opts.cwd);
  await mkdir(projectLocations.extensionRoot, { recursive: true });
  await saveState(projectLocations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      mp1: {
        name: "mp1",
        scope: "project",
        source: pathSource("./mp1-src"),
        addedFromCwd: opts.cwd,
        manifestPath: opts.manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {
          [opts.pluginName]: {
            version: opts.version,
            resolvedSource: "./placeholder",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            // Populated resources: an ENABLED installed record (empty
            // resources + installable:true would read as disabled per
            // ENBL-04 and render `(disabled)` instead of `(installed)`).
            resources: {
              skills: [`${opts.pluginName}-skill`],
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

// BOUND-03: the load-failure state is the ONLY thing that suppresses the brace
// here -- the project record's own manifest is the authority either way, and
// the sibling test below proves a successful read of that same path renders the
// brace. Treating the failed read as "manifest omits the record" is the exact
// false claim D-95-05 forbids.
test("plugin list manifest absent: BOUND-03: a folded row whose project-side manifest FAILED to load is preserved and carries no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // No user-scope installs -- alpha lives in project scope (the fold case).
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      // Nonexistent file -> the project-side manifest read throws.
      manifestPath: path.join(sharedMpRoot, ".claude-plugin", "does-not-exist.json"),
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // D-95-05: the row survives and carries its cross-scope `[project]`
      // bracket; only the unverified absence claim is suppressed. Dropping the
      // row instead would hide a plugin already materialized on disk.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: BOUND-03: a folded row whose project-side manifest LOADED without the entry renders `{not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      // The user record's REAL manifest: it loads, and it omits alpha. Only
      // the manifestPath differs from the failed-read case above.
      manifestPath: path.join(sharedMpRoot, ".claude-plugin", "marketplace.json"),
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed) {not in manifest}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// INV-01: the fold triggers on `marketplaceRoot` equality alone, so the two
// records can name DIFFERENT manifests -- `marketplace add` derives the root by
// walking up two levels when the source path is a manifest FILE, which pairs
// one root with an arbitrary manifest name. The folded row is a statement about
// the PROJECT record, so its absence is judged against the manifest that record
// names, even though the row renders under the user-scope header. D-96-02
// settles that a folded row describes its own record's manifest for every fact
// it states -- the absence claim, the upgradable derivation and the description
// -- since all three read the one `ManifestLookup` value built for that
// manifest. This test pins the absence fact; the three below pin the others.
test("plugin list manifest absent: INV-01: a folded row absent from its OWN manifest claims the absence even when the user block names another manifest", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The USER block's manifest DECLARES alpha.
      manifest: { name: "mp1", plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }] },
      installablePluginDirs: ["alpha"],
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    // Same root, different manifest file -- and this one loads cleanly while
    // omitting alpha.
    const otherManifestPath = path.join(sharedMpRoot, ".claude-plugin", "other.json");
    await writeFile(otherManifestPath, JSON.stringify({ name: "mp1", plugins: [] }), "utf8");
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      manifestPath: otherManifestPath,
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The user block's own manifest DOES declare alpha, so the folded row
      // suppresses the duplicate `(available)` enumeration -- but the row's
      // own reason brace is read off `other.json`, which omits it.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed) {not in manifest}"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// D-96-02: the absence claim above is one of THREE facts a folded row states
// about a manifest. The upgradable derivation and the description are the other
// two, and all three read the SINGLE `ManifestLookup` value `manifestLookupFor`
// produces for the manifest the folded record itself names. The three pins below
// state that authority in the directions where the two manifests DISAGREE --
// agreeing fixtures prove nothing about which manifest was consulted.

test("plugin list manifest absent: D-96-02: a folded row is NOT upgradable when its OWN manifest declares the installed version, though the user block's manifest declares a newer one", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The discriminator: the USER block's manifest declares 2.0.0. Consulting
      // it against the record's installed 1.0.0 would derive `(upgradable)`.
      manifest: { name: "mp1", plugins: [{ name: "alpha", source: "./alpha", version: "2.0.0" }] },
      installablePluginDirs: ["alpha"],
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    // Same root, different manifest file -- and this one declares the version
    // the project record is actually installed at.
    const otherManifestPath = path.join(sharedMpRoot, ".claude-plugin", "other.json");
    await writeFile(
      otherManifestPath,
      JSON.stringify({
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      }),
      "utf8",
    );
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      manifestPath: otherManifestPath,
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // `other.json` declares alpha at the installed version, so the PL-5
      // string compare finds no drift: `(installed)`, and no `{not in manifest}`
      // brace either -- the same lookup backs both facts.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: D-96-02: a folded row IS upgradable when its OWN manifest declares a newer version, though the user block's manifest declares the installed one", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // The inverse discriminator: the USER block's manifest declares the
      // installed version, so consulting it would leave the row `(installed)`.
      manifest: { name: "mp1", plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }] },
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    const otherManifestPath = path.join(sharedMpRoot, ".claude-plugin", "other.json");
    await writeFile(
      otherManifestPath,
      JSON.stringify({
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "2.0.0" }],
      }),
      "utf8",
    );
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      manifestPath: otherManifestPath,
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The candidate probe has no materialized plugin tree under this fixture's
      // marketplace root, so the CR-01 degrade returns the PLAIN `(upgradable)`
      // row rather than the `(partially-upgradable)` variant. That degradation
      // is the documented behavior of an unassertable candidate, not a defect.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (upgradable)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("plugin list manifest absent: D-96-02: a folded row's description comes from its OWN manifest entry, not the user block's entry for the same name", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // Both manifests declare alpha at the installed version, so the version
      // axis is held constant and the description is the ONLY disagreement.
      manifest: {
        name: "mp1",
        plugins: [
          {
            name: "alpha",
            source: "./alpha",
            version: "1.0.0",
            description: "From the user manifest.",
          },
        ],
      },
      installablePluginDirs: ["alpha"],
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    const otherManifestPath = path.join(sharedMpRoot, ".claude-plugin", "other.json");
    await writeFile(
      otherManifestPath,
      JSON.stringify({
        name: "mp1",
        plugins: [
          {
            name: "alpha",
            source: "./alpha",
            version: "1.0.0",
            description: "From the project manifest.",
          },
        ],
      }),
      "utf8",
    );
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      manifestPath: otherManifestPath,
      pluginName: "alpha",
      version: "1.0.0",
    });

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // PL-4 renders the description as a 4-space-indented second line. The
      // user block's text appears nowhere: whole-message equality is what makes
      // that a real assertion rather than a hopeful one.
      [
        "● mp1 [user]",
        "  ● alpha [project] v1.0.0 (installed)",
        "    From the project manifest.",
      ].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

// BOUND-01 / D-96-02: the own-manifest authority rule has a second half. A
// marketplace whose OWN manifest cannot be read renders nothing beneath it --
// folded rows from a scope whose manifest reads perfectly well included. The
// mechanism is the `!scopedManifest.ok` early return, which emits `plugins: []`
// before the folded extras are merged. This is the decided contract, not a
// defect: the block states one honest failure instead of a partial truth
// assembled from a neighbouring scope's evidence. Changing it needs a decision,
// not a patch, and this pin is what stops such a "fix" from landing silently.
test("plugin list manifest absent: BOUND-01: a marketplace whose OWN manifest failed to load renders the bare `(failed)` header -- folded rows are suppressed with it", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
    });

    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    // The project clone's OWN manifest reads cleanly and declares its installed
    // alpha, so nothing about the project record is in doubt.
    const otherManifestPath = path.join(sharedMpRoot, ".claude-plugin", "other.json");
    await writeFile(
      otherManifestPath,
      JSON.stringify({
        name: "mp1",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      }),
      "utf8",
    );
    await seedFoldedProjectClone({
      cwd,
      marketplaceRoot: sharedMpRoot,
      manifestPath: otherManifestPath,
      pluginName: "alpha",
      version: "1.0.0",
    });

    // Remove the file the USER record names, so its own manifest read throws.
    await rm(path.join(sharedMpRoot, ".claude-plugin", "marketplace.json"));

    const { ctx, pi, notifications, ui } = makeCtx();
    // act
    await listPlugins({ ctx, pi, cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      // No `alpha` row of any kind: the fold computed one, and the failed
      // header discarded it.
      ["A marketplace operation has failed.", "", "⊘ mp1 [user] (failed)"].join("\n"),
    );

    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("availableRowMessage returns the complete available candidate projection", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const marketplaceRoot = path.join(cwd, "marketplace");
    await mkdir(path.join(marketplaceRoot, "alpha"), { recursive: true });
    const locations = locationsFor("project", cwd);
    const manifestEntry = {
      name: "alpha",
      source: "./alpha",
      version: "1.0.0",
      description: "Alpha plugin.",
    } satisfies Parameters<typeof availableRowMessage>[0];

    // act
    const candidate = await availableRowMessage(
      manifestEntry,
      marketplaceRoot,
      locations,
      undefined,
    );

    // assert
    assert.deepStrictEqual(candidate, {
      message: {
        status: "available",
        name: "alpha",
        version: "1.0.0",
        description: "Alpha plugin.",
      },
      bucket: "available",
    });
  });
});

test("listPlugins renders the installed MCP dependency marker after inventory reasons", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      installed: {
        mcpplug: { version: "1.0.0", resources: { mcpServers: ["mcpplug-server"] } },
      },
    });
    const { ctx, pi, notifications, ui } = makeCtx();

    // act
    await listPlugins({ ctx, pi, cwd, scope: "user" });

    // assert
    assert.deepStrictEqual(notifications, [
      {
        message: "● mp1 [user]\n  ● mcpplug v1.0.0 (installed) {not in manifest, requires pi-mcp}",
      },
    ]);
    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("loadPluginListPayload filters project marketplaces and projects autoupdate exactly", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectRoot = path.join(cwd, ".pi");
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "zeta",
      manifest: { name: "zeta", plugins: [] },
    });
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "alpha",
      manifest: { name: "alpha", plugins: [] },
      autoupdate: true,
    });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

    // act
    const marketplaces = await loadPluginListPayload({
      ctx,
      pi,
      cwd,
      scope: "project",
      marketplace: "alpha",
    });

    // assert
    assert.deepStrictEqual(marketplaces, [
      {
        name: "alpha",
        scope: "project",
        details: { autoupdate: true },
        plugins: [],
      },
    ]);
    verify(ctx);
    verify(pi);
  });
});

test("loadPluginListPayload preserves input order for case-tied marketplaces in one scope", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const projectRoot = path.join(cwd, ".pi");
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "Bravo",
      manifest: { name: "Bravo", plugins: [] },
    });
    await seedMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "bravo",
      manifest: { name: "bravo", plugins: [] },
    });
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });

    // act
    const marketplaces = await loadPluginListPayload({ ctx, pi, cwd, scope: "project" });

    // assert
    assert.deepStrictEqual(marketplaces, [
      { name: "Bravo", scope: "project", plugins: [] },
      { name: "bravo", scope: "project", plugins: [] },
    ]);
    verify(ctx);
    verify(pi);
  });
});

test("listPlugins defaults a bare orchestration failure to user scope", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const stateJsonPath = path.join(home, ".pi", "agent", "pi-claude-marketplace", "state.json");
    await mkdir(path.dirname(stateJsonPath), { recursive: true });
    await writeFile(stateJsonPath, "{ this is not valid json }", "utf8");
    const { ctx, pi, notifications, ui } = makeCtx();

    // act
    await listPlugins({ ctx, pi, cwd });

    // assert
    const parseFailure = "Expected property name or '}' in JSON at position 2 (line 1 column 3)";
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● (list) [user]",
          "  ⊘ (list) (failed) {unreadable}",
          `    cause: state.json at ${stateJsonPath} is not valid JSON: ${parseFailure} -> ${parseFailure}`,
        ].join("\n"),
        severity: "error",
      },
    ]);
    verify(ctx);
    verify(pi);
    verify(ui);
  });
});

test("listPlugins normalizes a non-Error notification failure before reporting it", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
    const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
    const notifications: NotifyRecord[] = [];
    const notificationFailure = (function* (): Generator<void, void, unknown> {
      yield;
    })();
    notificationFailure.next();
    let notifyCall = 0;
    when(() => ctx.ui)
      .thenReturn(ui)
      .twice();
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(4);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        notifyCall += 1;
        if (notifyCall === 1) {
          notificationFailure.throw("ui unavailable");
        }

        notifications.push(severity === undefined ? { message } : { message, severity });
      })
      .twice();

    // act
    await listPlugins({ ctx, pi, cwd });

    // assert
    assert.strictEqual(notifyCall, 2);
    assert.deepStrictEqual(notifications, [
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● (list) [user]",
          "  ⊘ (list) (failed) {unreadable}",
          "    cause: ui unavailable",
        ].join("\n"),
        severity: "error",
      },
    ]);
    verify(ctx);
    verify(pi);
    verify(ui);
  });
});
