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
//   - INV-04 the CANONICAL disabled shape (ENBL-04: empty resources +
//     `compatibility.installable: true`) never carries a reason brace
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
  scope: "user" | "project";
  scopeRoot: string;
  cwd: string;
  mpName: string;
  /** When provided, written to <mpRoot>/.claude-plugin/marketplace.json. */
  manifest?: unknown;
  /** When provided, manifestPath in state points here (typically a nonexistent file). */
  manifestPathOverride?: string;
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
      /** Populate `resources.mcpServers` alongside the default skill. */
      mcp?: boolean;
    }
  >;
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
            mcpServers: info.mcp === true ? [`${name}-mcp`] : [],
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
// INV-02: the degraded manifest-absent row
// ──────────────────────────────────────────────────────────────────────────

test("INV-02: a manifest-absent degraded record keeps its glyph, recorded version and unsupported-kind reasons", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // Same-scope row: the `[user]` bracket is suppressed (D-16-17). This
      // pins the PRE-INV-02 reason set -- the brace carries the
      // unsupported-kind token alone.
      ["● mp1 [user]", "  ◉ plug v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// INV-04: the canonical disabled row never carries a reason brace
// ──────────────────────────────────────────────────────────────────────────

test("INV-04: a manifest-absent CANONICAL disabled record renders `(disabled)` with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // ENBL-04 canonical marker: empty resources + installable:true. The
      // PARTIAL disabled shape (`enabled: false` with populated resources) is
      // deliberately NOT pinned here -- ENBL-06 changes it.
      installed: { dis: { version: "1.2.3", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // `PluginDisabledMessage` has no `reasons` field and the disabled render
      // arm hardcodes `composeReasons(undefined, ...)`, so the bare form is
      // structurally guaranteed rather than conditionally produced.
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

    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user", installed: true });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      // MSG-GR-3 row order is name-primary (case-insensitive), scope-secondary
      // and never consults reasons: `clean` precedes `degraded`.
      [
        "● mp1 [user]",
        "  ● clean v1.0.0 (installed)",
        "  ◉ degraded v2.0.0 (partially-installed) {lsp}",
      ].join("\n"),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// BOUND-03: the cross-scope orphan fold under an UNREADABLE project manifest
// ──────────────────────────────────────────────────────────────────────────

test("BOUND-03: a folded row whose project-side manifest FAILED to load is preserved and carries no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp1",
      manifest: { name: "mp1", plugins: [] },
      // No user-scope installs -- alpha lives in project scope (the fold case).
    });

    // The install orchestrator clones the user-scope marketplace record into
    // the project scope verbatim, so a real clone shares `marketplaceRoot` --
    // which is the ONLY field `isCloneOfUserMarketplace` keys on. Write the
    // project record directly to keep that root identical while pointing
    // `manifestPath` at a file that does not exist, so the project-side
    // manifest read FAILS.
    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
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
          manifestPath: path.join(sharedMpRoot, ".claude-plugin", "does-not-exist.json"),
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
    assert.equal(
      notifications[0]!.message,
      // D-95-05: the row survives and carries its cross-scope `[project]`
      // bracket; only the unverified absence claim is suppressed. Dropping the
      // row instead would hide a plugin already materialized on disk.
      ["● mp1 [user]", "  ● alpha [project] v1.0.0 (installed)"].join("\n"),
    );
  });
});
