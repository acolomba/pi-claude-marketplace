// tests/orchestrators/plugin/list-manifest-absent.test.ts
//
// Byte-exact characterization of `listPlugins` rows whose installed record is
// ABSENT from a marketplace manifest that loaded successfully. Split out of
// `list.test.ts` (D-95-08) because this set has its own lifecycle: it is
// written against unmodified production code first, and some cases are
// deliberately widened later by the disabled-state repair (ENBL-06).
//
// Requirement coverage:
//   - INV-01 an enabled, fully supported manifest-absent record
//   - INV-02 a degraded (partially-installed) manifest-absent record
//   - INV-03 `--installed` membership across both manifest-absent forms
//   - ENBL-16 a disabled record carries `{not in manifest}` and no other
//     reason, superseding INV-04's "never carries a reason brace" clause
//   - BOUND-03 the cross-scope orphan fold must distinguish a manifest that
//     FAILED to load from one that loaded without the entry (D-95-05)
//
// Assertions are whole-message equality against a `[...].join("\n")` literal
// (D-95-09), never a partial regex match: token, glyph, spacing and ordering
// drift is exactly the regression class INV-02 and INV-03 exist to catch.
//
// Fixture note: manifest ABSENCE is seeded by a manifest whose `plugins` array
// omits the installed name. Omitting the manifest file instead produces a
// manifest LOAD ERROR and a `(failed)` marketplace header (BOUND-01) -- a
// different state entirely.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { listPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
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

/**
 * `getAllTools: () => []` means BOTH soft-dep companions probe as UNLOADED, so
 * a record that declares `resources.agents` / `resources.mcpServers` renders
 * its `{requires ...}` marker.
 */
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
  const home = await mkdtemp(path.join(tmpdir(), "plug-list-abs-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-list-abs-cwd-"));
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

interface SeedMarketplaceOpts {
  /**
   * The user-scope root (`<home>/.pi/agent`). This helper seeds USER scope
   * only -- the project side of the fold cases is seeded by
   * `seedFoldedProjectClone`, which needs a marketplace root it does not own.
   */
  scopeRoot: string;
  cwd: string;
  mpName: string;
  /** Written to <mpRoot>/.claude-plugin/marketplace.json. */
  manifest: unknown;
  /**
   * Installed plugin records keyed by plugin name. `disabled: true` seeds
   * the ENBL-02 empty-resources marker (recorded-but-disabled); the default
   * seeds a populated `resources.skills` -- a PRODUCTION installed record
   * always has at least one populated resources array (the resolver's
   * `requireInstallable` gate rules out zero-component installables), and
   * the empty-resources + installable:true intersection IS the load-bearing
   * "currently disabled" marker (D-54-01 / ENBL-04).
   */
  installed?: Record<
    string,
    {
      version: string;
      disabled?: boolean;
      /**
       * FSTAT-01 / D-66-01: seed the persisted `compatibility.unsupported`
       * component-kind list. A non-empty value reproduces a recorded-installed
       * plugin that resolved `unsupported` at install time (the force-installed
       * signal the deriver reads, with `installable: false`).
       */
      unsupported?: readonly string[];
      /**
       * Populate `resources.agents` alongside the default skill. The soft-dep
       * flags on the installed row derive from the RECORD's resource counts,
       * so a marker case cannot be seeded without this.
       */
      agents?: boolean;
    }
  >;
  /** When provided, plugin source dirs at these names get created so resolver probes find them. */
  installablePluginDirs?: readonly string[];
}

/**
 * Seed a marketplace into USER-scope state.json. Writes the marketplace.json
 * on disk (under <scopeRoot>/marketplaces/<mpName>) and creates installable
 * source dirs under the same marketplace root so resolveStrict can find them.
 */
async function seedMarketplace(opts: SeedMarketplaceOpts): Promise<void> {
  const scope = "user";
  const { scopeRoot, cwd, mpName, manifest } = opts;
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  // Marketplace root: a tmp dir owned by this seed call.
  const mpRoot = path.join(scopeRoot, "marketplaces", mpName);
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });

  const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

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
    const resources: {
      skills: string[];
      prompts: string[];
      agents: string[];
      mcpServers: string[];
      hooks: string[];
    } =
      info.disabled === true
        ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] }
        : {
            skills: [`${name}-skill`],
            prompts: [],
            agents: info.agents === true ? [`${name}-agent`] : [],
            mcpServers: [],
            hooks: [],
          };

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

  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      ...existing.marketplaces,
      [mpName]: {
        name: mpName,
        scope,
        source: pathSource(`./${mpName}-src`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: mpRoot,
        plugins,
      },
    },
    // saveState validates -- the merged shape must satisfy STATE_SCHEMA.
  } as unknown as Parameters<typeof saveState>[1]);
}

// ──────────────────────────────────────────────────────────────────────────
// INV-01: the clean manifest-absent row states the absence
// ──────────────────────────────────────────────────────────────────────────

test("INV-01: an enabled, fully supported record absent from a LOADED manifest renders `{not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // A manifest that parses with an EMPTY `plugins` array is a successful
      // load, so every installed record under it is genuinely absent.
      manifest: { name: "mp1", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
  });
});

test("INV-01 / MSG-GR-4: the soft-dep marker composes AFTER the typed reason inside one brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // The record declares agents and the companion probes as unloaded.
      installed: { alpha: { version: "1.0.0", agents: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp1 [user]",
        "  ● alpha v1.0.0 (installed) {not in manifest, requires pi-subagents}",
      ].join("\n"),
    );
  });
});

test("INV-01: a record the loaded manifest DOES declare renders with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed)"].join("\n"),
    );
  });
});

test("INV-01: manifest membership is EXACT string identity -- a name differing only in case is a miss", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    // `--installed` keeps the undeclared-but-available `Alpha` row out of the
    // expectation so the assertion isolates the membership question.
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// INV-02: the degraded manifest-absent row
// ──────────────────────────────────────────────────────────────────────────

test("INV-02: a manifest-absent degraded record keeps its glyph, recorded version and unsupported-kind reasons", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      // Manifest LOADS and simply does not declare `plug`.
      manifest: { name: "mp1", plugins: [] },
      installed: { plug: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // Same-scope row: the `[user]` bracket is suppressed (D-16-17). INV-02
      // puts the absence reason FIRST, ahead of the unsupported-kind token:
      // `composeReasons` joins in array order.
      ["● mp1 [user]", "  ◉ plug v1.0.0 (partially-installed) {not in manifest, lsp}"].join("\n"),
    );
  });
});

test("INV-02: a degraded record its manifest still DECLARES keeps its unsupported-kind reasons alone", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The prepend is GATED on manifest absence: this record IS declared
      // (same name, same version, so the row stays `partially-installed`
      // rather than deriving the upgradable arm), and an ungated prepend
      // would falsify it.
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
  });
});

test("INV-02: a manifest-absent degraded record with a non-carve-out kind renders `{not in manifest, unsupported component}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // `themes` is not one of `narrowUnsupportedKinds`' carve-outs
      // (`lspServers` -> `lsp`, `hooks` -> `unsupported hooks`), so it maps to
      // the generic token.
      installed: { plug: { version: "1.0.0", unsupported: ["themes"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp1 [user]",
        "  ◉ plug v1.0.0 (partially-installed) {not in manifest, unsupported component}",
      ].join("\n"),
    );
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
test("ENBL-16: a manifest-absent disabled record renders `(disabled) {not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      installed: { dis: { version: "1.2.3", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ◍ dis v1.2.3 (disabled) {not in manifest}"].join("\n"),
    );
  });
});

// The gate half of the pair: an absence claim is made only against a manifest
// that loaded AND omitted the entry (BOUND-03 / D-95-05). A manifest that still
// declares the plugin backs no claim, so the row stays byte-identical to the
// legacy bare form.
test("ENBL-16: a disabled record its manifest STILL declares renders `(disabled)` with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ◍ dis v1.2.3 (disabled)"].join("\n"),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// INV-03: `--installed` membership
// ──────────────────────────────────────────────────────────────────────────

test("INV-03: `--installed` spans both manifest-absent installed forms and excludes `(available)` rows", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
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
  } as unknown as Parameters<typeof saveState>[1]);
}

// BOUND-03: the load-failure state is the ONLY thing that suppresses the brace
// here -- the project record's own manifest is the authority either way, and
// the sibling test below proves a successful read of that same path renders the
// brace. Treating the failed read as "manifest omits the record" is the exact
// false claim D-95-05 forbids.
test("BOUND-03: a folded row whose project-side manifest FAILED to load is preserved and carries no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // D-95-05: the row survives and carries its cross-scope `[project]`
      // bracket; only the unverified absence claim is suppressed. Dropping the
      // row instead would hide a plugin already materialized on disk.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed)"].join("\n"),
    );
  });
});

test("BOUND-03: a folded row whose project-side manifest LOADED without the entry renders `{not in manifest}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
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
test("INV-01: a folded row absent from its OWN manifest claims the absence even when the user block names another manifest", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The user block's own manifest DOES declare alpha, so the folded row
      // suppresses the duplicate `(available)` enumeration -- but the row's
      // own reason brace is read off `other.json`, which omits it.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
  });
});

// D-96-02: the absence claim above is one of THREE facts a folded row states
// about a manifest. The upgradable derivation and the description are the other
// two, and all three read the SINGLE `ManifestLookup` value `manifestLookupFor`
// produces for the manifest the folded record itself names. The three pins below
// state that authority in the directions where the two manifests DISAGREE --
// agreeing fixtures prove nothing about which manifest was consulted.

test("D-96-02: a folded row is NOT upgradable when its OWN manifest declares the installed version, though the user block's manifest declares a newer one", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // `other.json` declares alpha at the installed version, so the PL-5
      // string compare finds no drift: `(installed)`, and no `{not in manifest}`
      // brace either -- the same lookup backs both facts.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed)"].join("\n"),
    );
  });
});

test("D-96-02: a folded row IS upgradable when its OWN manifest declares a newer version, though the user block's manifest declares the installed one", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // The candidate probe has no materialized plugin tree under this fixture's
      // marketplace root, so the CR-01 degrade returns the PLAIN `(upgradable)`
      // row rather than the `(partially-upgradable)` variant. That degradation
      // is the documented behavior of an unassertable candidate, not a defect.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (upgradable)"].join("\n"),
    );
  });
});

test("D-96-02: a folded row's description comes from its OWN manifest entry, not the user block's entry for the same name", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
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
test("BOUND-01: a marketplace whose OWN manifest failed to load renders the bare `(failed)` header -- folded rows are suppressed with it", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      // No `alpha` row of any kind: the fold computed one, and the failed
      // header discarded it.
      ["A marketplace operation has failed.", "", "⊘ mp1 [user] (failed)"].join("\n"),
    );
  });
});
