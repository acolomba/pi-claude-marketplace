// tests/orchestrators/plugin/info.test.ts
//
// Integration tests for the read-only
// `getPluginInfo` orchestrator. Hermetic HOME + tmp cwd + saveState
// fixtures + on-disk path-source marketplace dirs carrying a real
// `plugin.json`. The orchestrator is the SOLE site that projects local
// state + on-disk manifest resolution into the info-message
// variants.
//
// Coverage:
//   (a) single-scope installed with resolved components + description
//   (b) single-scope available with description
//   (c) single-scope unavailable with `{unsupported hooks}` reason
//   (d) single-scope external source -> componentsResolved: false marker
//   (e) both-scopes fan-out (project-first per MSG-GR-3 / INFO-03)
//   (f) `--scope` mismatch -> INFO-04 `{not added}` row with
//       `[scope]` bracket + severity error
//   (g) absent-from-both with no --scope -> bare `{not added}` row,
//       NO `[scope]` bracket (D-03)
//   (h) missing-plugin-in-known-marketplace -> `(failed) {not in manifest}`
//       row at 2-space indent under marketplace header + severity error
//   (i) NFR-5 grep-gate: no `platform/git` / `DEFAULT_GIT_OPS` /
//       `refreshGitHubClone` imports in `info.ts`
//   (j) component list sort precondition (PR-5): unsorted manifest
//       declarations are sorted by the orchestrator before passing
//       into the renderer
//   (k) dependencies field surfaced as `dependencies: <plugin>@<mp>, ...`
//       line LAST
//   (l) barrel re-export: `orchestrators/plugin/index.ts` exposes
//       `getPluginInfo`

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";

import { pluginMirrorKey } from "../../../extensions/pi-claude-marketplace/domain/clone-key.ts";
import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  getPluginInfo,
  type InfoCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
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
 * is hermetic. Restores HOME after.
 */
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-info-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-info-cwd-"));
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

interface SeedPathMarketplaceOpts {
  readonly scope: "user" | "project";
  readonly scopeRoot: string;
  readonly cwd: string;
  readonly mpName: string;
  readonly manifest: { name: string; plugins: readonly Record<string, unknown>[] };
  /**
   * Installed plugin records. `disabled: true` seeds the ENBL-02
   * empty-resources marker (recorded-but-disabled); the default seeds a
   * populated `resources.skills` -- a production installed record always has
   * >= 1 populated array (the empty-resources + installable:true
   * intersection IS the disabled marker, D-54-01 / ENBL-04).
   */
  readonly installed?: Record<
    string,
    {
      version: string;
      disabled?: boolean;
      /**
       * FSTAT-01 / D-66-01: seed the persisted `compatibility.unsupported`
       * component-kind list. A non-empty value reproduces a recorded-installed
       * plugin that resolved `unsupported` at install time -- the force-installed
       * signal the deriver reads (with `installable: false`).
       */
      unsupported?: readonly string[];
    }
  >;
  readonly autoupdate?: boolean;
  /** Plugin source dirs to create under <mpRoot> so resolveStrict probes succeed. */
  readonly installablePluginDirs?: readonly string[];
  /** Per-plugin component dirs to create (relative to plugin root). */
  readonly componentDirs?: Record<string, readonly string[]>;
  /** Per-plugin component FILES to create (relative to plugin root). Used for
   *  agents/commands which are `.md` files (not directories). */
  readonly componentFiles?: Record<string, readonly string[]>;
}

/**
 * Seed a path-source marketplace into the given scope's state.json.
 * Writes the marketplace.json + the per-plugin source dirs so
 * `resolveStrict`'s `statKind` probe finds them.
 */
async function seedPathMarketplace(opts: SeedPathMarketplaceOpts): Promise<string> {
  const { scope, scopeRoot, cwd, mpName, manifest } = opts;
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const mpRoot = path.join(scopeRoot, "marketplaces", mpName);
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });

  const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

  for (const rel of opts.installablePluginDirs ?? []) {
    await mkdir(path.join(mpRoot, rel), { recursive: true });
  }

  for (const [pluginDir, components] of Object.entries(opts.componentDirs ?? {})) {
    for (const c of components) {
      await mkdir(path.join(mpRoot, pluginDir, c), { recursive: true });
    }
  }

  for (const [pluginDir, files] of Object.entries(opts.componentFiles ?? {})) {
    for (const rel of files) {
      const abs = path.join(mpRoot, pluginDir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, "", "utf8");
    }
  }

  const plugins: Record<string, unknown> = {};
  for (const [name, info] of Object.entries(opts.installed ?? {})) {
    // FSTAT-01 / D-66-01: a recorded-installed plugin whose install-time
    // resolution dropped components persists `unsupported` (and
    // `installable: false`). The deriver reads this to render
    // `(partially-installed)` -- no separate persisted flag.
    const unsupported = info.unsupported ?? [];
    plugins[name] = {
      version: info.version,
      resolvedSource: "./placeholder",
      compatibility: {
        installable: unsupported.length === 0,
        notes: [],
        supported: [],
        unsupported: [...unsupported],
      },
      resources:
        info.disabled === true
          ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] }
          : { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [], hooks: [] },
      enabled: info.disabled !== true,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  const stateJsonPath = path.join(locations.extensionRoot, "state.json");
  let existing: { marketplaces: Record<string, unknown> } = { marketplaces: {} };
  try {
    const raw = await readFile(stateJsonPath, "utf8");
    existing = JSON.parse(raw) as { marketplaces: Record<string, unknown> };
  } catch {
    /* first marketplace in scope */
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
  } as unknown as Parameters<typeof saveState>[1]);

  // SPLIT-01: autoupdate read-path lives in claude-plugins.json. Seed the
  // config when autoupdate is set so the info orchestrator reads the
  // autoupdate truth from the new source of truth.
  if (opts.autoupdate !== undefined) {
    const cfgPath = locations.configJsonPath;
    let existingCfg: { marketplaces?: Record<string, { source: string; autoupdate?: boolean }> } =
      {};
    try {
      const raw = await readFile(cfgPath, "utf8");
      existingCfg = JSON.parse(raw) as typeof existingCfg;
    } catch {
      /* first marketplace in scope */
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

  return mpRoot;
}

/**
 * Stage a WARM unpinned git mirror at the URL-keyed mirror dir carrying a real
 * committed plugin tree, so `makePresenceProbe` reads it fs-only as
 * `materialized` and `resolveStrict` validates the on-disk tree. `components`
 * lists per-kind files/dirs to seed under the mirror root (skills as dirs,
 * commands/agents as `.md` files) so the warm three-way resolution enumerates
 * them. The canonical url (no `.git` suffix) must match the manifest source so
 * the staged mirror key equals the probed key.
 */
async function seedWarmMirror(opts: {
  scope: "user" | "project";
  cwd: string;
  cloneUrl: string;
  pluginJson: Record<string, unknown>;
  componentDirs?: readonly string[];
  componentFiles?: readonly string[];
}): Promise<void> {
  const locations = locationsFor(opts.scope, opts.cwd);
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(opts.cloneUrl));
  await mkdir(path.join(mirrorDir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(mirrorDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(opts.pluginJson),
    "utf8",
  );

  for (const rel of opts.componentDirs ?? []) {
    await mkdir(path.join(mirrorDir, rel), { recursive: true });
  }

  for (const rel of opts.componentFiles ?? []) {
    const abs = path.join(mirrorDir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, "", "utf8");
  }

  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDir, filepath: ".claude-plugin/plugin.json" });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
}

/**
 * NFR-10 / D-77-03: stage a WARM unpinned git mirror carrying a git-subdir plugin
 * -- the plugin.json + components live under `<mirror>/<subPath>` while the mirror
 * ROOT is an empty monorepo (the canva shape). The presence probe must anchor the
 * pluginRoot at the subdir; a clone-root resolution would render the silently-empty
 * `(available)` row this fix removes.
 */
async function seedWarmSubdirMirror(opts: {
  scope: "user" | "project";
  cwd: string;
  cloneUrl: string;
  subPath: string;
  pluginJson: Record<string, unknown>;
  componentDirs?: readonly string[];
  componentFiles?: readonly string[];
}): Promise<void> {
  const locations = locationsFor(opts.scope, opts.cwd);
  const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(opts.cloneUrl));
  const subdir = path.join(mirrorDir, opts.subPath);
  await mkdir(path.join(subdir, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(subdir, ".claude-plugin", "plugin.json"),
    JSON.stringify(opts.pluginJson),
    "utf8",
  );

  for (const rel of opts.componentDirs ?? []) {
    await mkdir(path.join(subdir, rel), { recursive: true });
  }

  for (const rel of opts.componentFiles ?? []) {
    const abs = path.join(subdir, rel);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, "", "utf8");
  }

  await git.init({ fs, dir: mirrorDir, defaultBranch: "main" });
  await git.add({ fs, dir: mirrorDir, filepath: "." });
  await git.commit({
    fs,
    dir: mirrorDir,
    message: "initial",
    author: { name: "test", email: "test@example.com" },
  });
}

// ---------------------------------------------------------------------------
// (a) single-scope installed with resolved components + description.
// ---------------------------------------------------------------------------

test("INFO-02: single-scope installed (path source) renders header + plugin row + description + sorted per-kind components", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "foo",
            source: "./foo",
            version: "1.2.3",
            description: "Foo plugin",
            skills: "skills",
            commands: "commands",
            agents: "agents",
          },
        ],
      },
      installed: { foo: { version: "1.2.3" } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
      componentFiles: { foo: ["commands/c1.md", "agents/a1.md"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● foo v1.2.3 (installed)",
        "    Foo plugin",
        "    agents: a1",
        "    commands: c1",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (b) single-scope available with description.
// ---------------------------------------------------------------------------

test("INFO-02: single-scope available (path source) renders `○ ... (available)` with description", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "bar",
            source: "./bar",
            version: "0.5.0",
            description: "Bar plugin; not installed.",
            skills: "skills",
          },
        ],
      },
      // NOT installed in state -> available bucket.
      installablePluginDirs: ["bar"],
      componentDirs: { bar: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "bar", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ bar v0.5.0 (available)",
        "    Bar plugin; not installed.",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (c) single-scope unavailable with `{unsupported hooks}` reason.
// ---------------------------------------------------------------------------

test("INFO-02: single-scope unavailable (malformed hooks/hooks.json) renders `⊘ ... (unavailable) {unsupported hooks}` without per-kind component lines when nothing is on disk", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            description: "Old plugin with a malformed hooks/hooks.json.",
          },
        ],
      },
      installablePluginDirs: ["legacy"],
    });

    // HOOK-01 / D-57-04: plugin admission now depends on the convention file
    // parse result, not on entry-level hooks-field declaration. Seed an
    // unparseable hooks/hooks.json so resolveStrict flips installable: false.
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "unavailable is info, not error");
    // INFO-05: path-source not-installable variant enumerates components
    // from disk; with no skills/commands/agents/mcp seeded the components
    // map is empty and no per-kind lines are emitted (and the
    // `components: not resolved` marker is suppressed -- it is reserved
    // for non-path sources).
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ⊘ legacy v0.1.0 (unavailable) {unsupported hooks}",
        "    Old plugin with a malformed hooks/hooks.json.",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (c2) D-64-05: the `unavailable` arm re-derives the component search paths
// from the RAW manifest entry via `deriveLenientComponentPaths`. An
// ARRAY-form component field (`skills: ["skills", "extra", "extra"]`)
// exercises the array-normalize branch (`asDeclaredList` returns the array
// as-is) AND both sides of the `!out[kind].includes(d)` dedup guard: the
// default "skills" search path is skipped, "extra" is pushed once, and the
// repeat "extra" is skipped. The declared "extra" path is enumerated from
// disk alongside the conventional "skills" dir.
// ---------------------------------------------------------------------------

test("D-64-05: unavailable arm derives lenient component paths from an array-form component field (array normalize + dedup push/skip)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            // Array-form component field carrying the default search path
            // ("skills") AND a duplicated declared path ("extra"). This is
            // the only shape that drives both the array branch of
            // `asDeclaredList` and the push/skip arms of the dedup guard.
            skills: ["skills", "extra", "extra"],
          },
        ],
      },
      installablePluginDirs: ["legacy"],
      // A skill under the DECLARED "extra" search path so the lenient
      // enumeration surfaces it on the (unavailable) row.
      componentDirs: { legacy: ["extra/es1"] },
    });

    // A malformed hooks/hooks.json flips resolveStrict to the structural
    // `unavailable` arm -- the sole arm that calls deriveLenientComponentPaths
    // (D-64-05); the other arms carry `componentPaths` directly.
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "unavailable is info, not error");
    const msg = notifications[0]!.message;
    assert.match(msg, /⊘ legacy v0\.1\.0 \(unavailable\) \{unsupported hooks\}/, msg);
    // The DECLARED "extra" search path is enumerated from disk (D-64-05) so
    // the es1 skill surfaces -- proving the array path was read.
    assert.match(msg, /skills: es1/, msg);
  });
});

// ---------------------------------------------------------------------------
// (d) external source (github / npm / git-subdir / url) -> components not resolved (INFO-05).
// ---------------------------------------------------------------------------

test("INFO-05: external source (npm) emits `    components: not resolved` marker in place of per-kind component lists", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "remote",
            source: { source: "npm", package: "@scope/remote-plugin", version: "1.0.0" },
            version: "1.0.0",
            description: "Remote plugin sourced from an external npm package.",
          },
        ],
      },
      installed: { remote: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● remote v1.0.0 (installed)",
        "    Remote plugin sourced from an external npm package.",
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (e) both-scopes fan-out -- project-first per MSG-GR-3 / INFO-03.
// ---------------------------------------------------------------------------

test("INFO-03: both-scopes fan-out emits ONE notify call; project block FIRST, user block SECOND, joined by one blank line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "foo", source: "./foo", version: "1.0.0", skills: "skills" }],
      },
      installed: { foo: { version: "1.0.0" } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
      autoupdate: true,
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "foo", source: "./foo", version: "2.0.0", agents: "agents" }],
      },
      installed: { foo: { version: "2.0.0" } },
      installablePluginDirs: ["foo"],
      componentFiles: { foo: ["agents/a1.md"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", cwd });
    assert.equal(notifications.length, 1, "IL-2: exactly one ctx.ui.notify call");
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [project] <autoupdate>",
        "  ● foo v1.0.0 (installed)",
        "    skills: s1",
        "",
        "● mp [user] <no autoupdate>",
        "  ● foo v2.0.0 (installed)",
        "    agents: a1",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (f) `--scope` mismatch -- marketplace in project, requested user.
// ---------------------------------------------------------------------------

test("INFO-04: --scope user mismatch (mp only in project) emits bare `⊘ <mp> [user] (failed) {not added}` with severity error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "p-only",
      manifest: { name: "p-only", plugins: [] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "p-only",
      plugin: "ghost",
      scope: "user",
      cwd,
    });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ p-only [user] (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
  });
});

// ---------------------------------------------------------------------------
// (g) absent from both scopes with no --scope -> bare row, NO [scope] bracket.
// ---------------------------------------------------------------------------

test("D-03: absent from BOTH scopes with no --scope renders `(failed) {not added}` WITHOUT any [scope] bracket", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "ghost-mp", plugin: "ghost", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      "A marketplace operation has failed.\n\n⊘ ghost-mp (failed) {not added}",
    );
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      !notifications[0]!.message.includes("[user]") &&
        !notifications[0]!.message.includes("[project]"),
      "absent-from-both must NOT carry a [scope] bracket (D-03)",
    );
  });
});

// ---------------------------------------------------------------------------
// (h) missing plugin in known marketplace -> `{not in manifest}` row.
// ---------------------------------------------------------------------------

test("UXG-08: missing plugin in known marketplace emits `⊘ <plugin> (failed) {not in manifest}` at 2-space indent + severity error", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [{ name: "real", source: "./real", version: "1.0.0" }] },
      installablePluginDirs: ["real"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghost", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      [
        "A plugin operation has failed.",
        "",
        "● mp [user] <no autoupdate>",
        "  ⊘ ghost (failed) {not in manifest}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (h2) GRAM-04: a `(failed)` block on the BOTH-scopes path must NOT hide inside
// the info-severity `plugin-info-cascade`. It is separated out and surfaced as
// its own `error` + summary notify -- the same LOUD shape the single-scope arm
// (test h) produces. Guards against the standalone-vs-cascade divergence
// resurfacing on the fan-out path (code review WR-01/WR-02).
// ---------------------------------------------------------------------------

test("GRAM-04: both-scopes missing plugin emits per-scope `error` + summary, NOT a silent info cascade", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    // `mp` exists in BOTH scopes, but `ghost` is in neither manifest -> each
    // scope yields a `(failed) {not in manifest}` block.
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [{ name: "real", source: "./real", version: "1.0.0" }] },
      installablePluginDirs: ["real"],
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [{ name: "real", source: "./real", version: "1.0.0" }] },
      installablePluginDirs: ["real"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghost", cwd });

    // Two failed scopes -> two standalone error notifications (project-first),
    // NOT one info-severity cascade. The failure can never be summary-less.
    assert.equal(notifications.length, 2, "each failed scope surfaces its own notify");
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(notifications[1]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      [
        "A plugin operation has failed.",
        "",
        "● mp [project] <no autoupdate>",
        "  ⊘ ghost (failed) {not in manifest}",
      ].join("\n"),
    );
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation has failed.",
        "",
        "● mp [user] <no autoupdate>",
        "  ⊘ ghost (failed) {not in manifest}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (h-WR-01) WR-01: the `narrowProbeError` classifier
// in `info.ts` must stay in lockstep with `list.ts::narrowProbeError`.
// The orchestrator threads the closed-set Reason ladder that list.ts
// uses, so the user sees `{permission denied}` / `{source missing}` /
// `{unparseable}` / `{unreadable}` on the `(installed)` row instead
// of being silently misled.
//
// Unit-tests the ladder via the `__test_narrowProbeError` re-export.
// An end-to-end integration of the THROW branch through the real
// resolver requires an FS-level fault injection that is not portable
// across CI sandboxes; the orchestrator-level `(c) install bucket
// throws` arm is exercised via the WR-01 NotInstallable test below
// (the `!installable` path runs through the SAME row-construction
// code as the throw branch).
// ---------------------------------------------------------------------------

test("WR-01: narrowProbeError -> EACCES classifies as `permission denied`", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  const err = new Error("EACCES: permission denied, open '/foo/plugin.json'");
  (err as NodeJS.ErrnoException).code = "EACCES";
  assert.equal(mod.__test_narrowProbeError(err), "permission denied");
});

test("WR-01: narrowProbeError -> ENOENT classifies as `source missing`", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  const err = new Error("ENOENT: no such file");
  (err as NodeJS.ErrnoException).code = "ENOENT";
  assert.equal(mod.__test_narrowProbeError(err), "source missing");
});

test("WR-01: narrowProbeError -> SyntaxError classifies as `unparseable`", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  const err = new SyntaxError("Unexpected token");
  assert.equal(mod.__test_narrowProbeError(err), "unparseable");
});

test("D-48-B IN-02: narrowProbeError -> schema-invalid InvalidMarketplaceManifestError classifies as `invalid manifest`", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  // Schema-invalid manifest = typed error with NO SyntaxError cause. The read
  // surface reports the SAME `{invalid manifest}` reason the write path does.
  const err = new InvalidMarketplaceManifestError("marketplace.json schema invalid: plugins");
  assert.equal(mod.__test_narrowProbeError(err), "invalid manifest");
});

test("D-48-B IN-02: narrowProbeError -> malformed-JSON InvalidMarketplaceManifestError stays `unparseable`", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  // Malformed JSON = typed error WHOSE cause IS a SyntaxError. The collapse
  // into one InvalidMarketplaceManifestError branch must preserve this arm.
  const err = new InvalidMarketplaceManifestError("bad json", {
    cause: new SyntaxError("Unexpected token"),
  });
  assert.equal(mod.__test_narrowProbeError(err), "unparseable");
});

test("WR-01: narrowProbeError -> generic Error falls through to `unreadable` (NOT `unsupported source`)", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts");
  // The permissive fallback returns `unreadable`, but only AFTER trying
  // SyntaxError + errno classification first. Hardcoding `unreadable`
  // would pass this test but FAIL the SyntaxError / EACCES tests
  // above.
  const err = new Error("something broke");
  assert.equal(mod.__test_narrowProbeError(err), "unreadable");
});

// ---------------------------------------------------------------------------
// (h-WR-01b) WR-01: an INSTALLED plugin whose manifest declares
// `hooks` (resolveStrict returns NotInstallable with notes) must
// forward `narrowResolverNotes(notes)` as reasons on the `(installed)`
// row instead of swallowing them silently.
// ---------------------------------------------------------------------------

test("WR-01: installed plugin with malformed hooks/hooks.json surfaces `{unsupported hooks}` on the (installed) row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
          },
        ],
      },
      installed: { legacy: { version: "0.1.0" } },
      installablePluginDirs: ["legacy"],
    });

    // HOOK-01 / D-57-04: a malformed hooks/hooks.json now flips the
    // resolver to NotInstallable with a parse-failure note that
    // narrowResolverNotes maps to the `unsupported hooks` Reason via
    // prefix-anchored detection (HOOK-04 tightening).
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    // INFO-05: path-source not-installable variant enumerates components
    // from disk; with no skills/commands/agents/mcp seeded the components
    // map is empty and no per-kind lines or `components: not resolved`
    // marker is emitted -- only the `{unsupported hooks}` reasons brace.
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ● legacy v0.1.0 (installed) {unsupported hooks}"].join(
        "\n",
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// FSTAT-07 / D-66-04: an INSTALLED plugin that re-resolves `unsupported`
// (manifest declares an unsupported component kind such as `lspServers`)
// is reported as `(partially-installed)` with the dropped-component detail
// from `narrowUnsupportedKinds` -- NOT `(installed)`. The `unavailable`
// arm keeps `(installed)` (D-64-05, covered by WR-01 above) and the
// `installable` arm keeps `(installed)` (INFO-02 above); info never emits
// `force-upgradable` (that is a list-inventory-only concept).
// ---------------------------------------------------------------------------

test("FSTAT-07 / D-66-04: installed plugin re-resolving unsupported (lspServers) renders `◉ ... (partially-installed) {lsp}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "degraded",
            source: "./degraded",
            version: "1.0.0",
            // An unsupported component kind flips resolveStrict to the
            // `unsupported` arm (D-64-06); narrowUnsupportedKinds maps
            // `lspServers` -> the `lsp` manifest-field marker.
            lspServers: { foo: { command: "foo-lsp" } },
          },
        ],
      },
      installed: { degraded: { version: "1.0.0" } },
      installablePluginDirs: ["degraded"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "degraded", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "force-installed is info, not error");
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ◉ degraded v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// WR-02 / D-66-01: cross-surface force-installed parity for NON-PATH sources.
// INFO-05 defers LIVE component resolution for non-path (npm/github/...)
// sources to preserve NFR-5, but the install-time `compatibility.unsupported`
// record is read OFFLINE -- the SAME single deriver `list` reads. A
// recorded-installed non-path plugin whose install dropped components must
// therefore render `◉ ... (partially-installed)` on `info`, exactly as on `list`,
// never `● ... (installed)`. `componentsResolved: false` is preserved (the
// external plugin.json is still not fetched).
// ---------------------------------------------------------------------------

test("WR-02 / D-66-01: non-path (npm) recorded-installed plugin with persisted unsupported renders `◉ ... (partially-installed)` on info (parity with list)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "remote",
            // Non-path source: INFO-05 never resolves it live (NFR-5).
            source: { source: "npm", package: "@scope/remote-plugin", version: "1.0.0" },
            version: "1.0.0",
          },
        ],
      },
      // Recorded-installed AND the install-time resolution dropped `lspServers`
      // -- the persisted force-installed signal the deriver reads.
      installed: { remote: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "force-installed is info, not error");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        // ◉ (partially-installed), NOT ● (installed) -- the WR-02 regression.
        "  ◉ remote v1.0.0 (partially-installed) {lsp}",
        // NFR-5: the external plugin.json is still not fetched.
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (h-WR-02) WR-02: the NOT-installed catch path
// must classify the probe throw via the SAME `narrowProbeError` ladder
// as `list.ts`, not hardcode `"unreadable"`. We exercise the
// `unparseable` arm by writing a malformed `plugin.json` so the
// resolver's JSON.parse throws SyntaxError -- which the ladder
// must map to the `unparseable` Reason.
// ---------------------------------------------------------------------------

test("WR-02: not-installed plugin with malformed plugin.json surfaces `{unparseable}` (not `{unreadable}`)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "broken", source: "./broken", version: "1.0.0" }],
      },
      // NOT installed -> available/unavailable branch.
      installablePluginDirs: ["broken"],
    });

    // Write a malformed plugin.json under the plugin source dir so the
    // resolver's JSON.parse path throws SyntaxError.
    await mkdir(path.join(mpRoot, "broken", ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "broken", ".claude-plugin", "plugin.json"),
      "{ not valid json",
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "broken", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    // Expect `{unparseable}` because the SyntaxError is correctly
    // distinguished by the ladder.
    // Either outcome of `resolveStrict` (throws SyntaxError, or
    // catches internally and returns NotInstallable with a malformed-
    // JSON note) is acceptable -- the test locks the WR-02 invariant
    // that the orchestrator MUST NOT hardcode `unreadable` when the
    // underlying failure is parse-related. The renderer body must
    // include `(unavailable)` and EITHER an `unparseable` or
    // `unsupported source` reason brace (depending on which path the
    // resolver chose), but NEVER a bare `unreadable` brace alone.
    const msg = notifications[0]!.message;
    assert.match(msg, /\(unavailable\)/);
    assert.doesNotMatch(
      msg,
      /\(unavailable\) \{unreadable\}/,
      "post-fix: probe-throw must classify SyntaxError as `unparseable`, not the hardcoded `unreadable`",
    );
  });
});

// ---------------------------------------------------------------------------
// (h-WR-03) End-to-end: manifest read failure (missing marketplace.json on
// disk) surfaces a `(failed) {<reason>}` row under the marketplace header
// rather than throwing. Locks the orchestrator-level catch path that
// `narrowProbeError` classifies against ENOENT.
// ---------------------------------------------------------------------------

test("WR-03: marketplace.json missing on disk surfaces `{source missing}` failure row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const locations = locationsFor("user", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const mpRoot = path.join(userRoot, "marketplaces", "mp");
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    // Intentionally do NOT write the manifest file -- the state record
    // points at a path that does not exist.
    await mkdir(path.dirname(manifestPath), { recursive: true });

    await saveState(locations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: pathSource("./mp-src"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "x", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    // The orchestrator catches the ENOENT from `loadMarketplaceManifest`
    // and classifies via `narrowProbeError` -> `source missing` reason.
    const msg = notifications[0]!.message;
    assert.match(msg, /\(failed\) \{source missing\}/);
  });
});

// ---------------------------------------------------------------------------
// Component-discovery failure propagation. ENOENT/ENOTDIR on a declared
// component dir is the legitimate "no components in this kind" state
// and yields an empty bucket. Every other readdir failure (EACCES, EPERM,
// EIO, ...) propagates so the row builder can classify via
// `narrowProbeError`. Locks the row catch arms that prevent a
// permission-denied component dir from silently rendering as
// "no components". POSIX-only -- chmod-based fault injection does not
// reproduce on Windows.
// ---------------------------------------------------------------------------

test("readdir EACCES on installed plugin's skills dir surfaces `{permission denied}` (POSIX)", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "p", source: "./p", version: "1.0.0", skills: "skills" }],
      },
      installed: { p: { version: "1.0.0" } },
      installablePluginDirs: ["p"],
      componentDirs: { p: ["skills/s1"] },
    });

    // chmod 000 the skills dir so readdir raises EACCES. Component
    // discovery propagates the throw up through composeResolvedComponents
    // into buildInstalledRow's outer catch, which classifies via
    // narrowProbeError.
    const { chmod } = await import("node:fs/promises");
    const skillsDir = path.join(mpRoot, "p", "skills");
    await chmod(skillsDir, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
      assert.equal(notifications.length, 1);
      const msg = notifications[0]!.message;
      assert.match(msg, /\(installed\) \{permission denied\}/);
      // Anti-regression: row must NOT render byte-identically to a
      // deliberate INFO-05 external-source defer (no reason brace).
      assert.doesNotMatch(msg, /\(installed\)\n {4}components: not resolved$/);
    } finally {
      await chmod(skillsDir, 0o755).catch(() => undefined);
    }
  });
});

test("readdir EACCES on available plugin's skills dir surfaces `{permission denied}` (POSIX)", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "p", source: "./p", version: "1.0.0", skills: "skills" }],
      },
      // Not installed -> goes through buildNotInstalledRow ->
      // buildAvailableRow (resolvable: true) -> composeResolvedComponents
      // throws EACCES on the chmod'd skills dir -> buildAvailableRow's
      // catch fires and surfaces `{permission denied}`.
      installablePluginDirs: ["p"],
      componentDirs: { p: ["skills/s1"] },
    });

    const { chmod } = await import("node:fs/promises");
    const skillsDir = path.join(mpRoot, "p", "skills");
    await chmod(skillsDir, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
      assert.equal(notifications.length, 1);
      const msg = notifications[0]!.message;
      assert.match(msg, /\(available\) \{permission denied\}/);
    } finally {
      await chmod(skillsDir, 0o755).catch(() => undefined);
    }
  });
});

// ---------------------------------------------------------------------------
// (j-S-3) normalizeDependencies: non-array shapes (object, empty array)
// return undefined -> renderer omits `dependencies:` line entirely.
// ---------------------------------------------------------------------------

test("normalizeDependencies: object-shaped `dependencies` field omits the line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "p",
            source: "./p",
            version: "1.0.0",
            skills: "skills",
            // Object shape, not string[] -- normalizer returns undefined.
            dependencies: { foo: "1.0.0", bar: "2.0.0" },
          },
        ],
      },
      installed: { p: { version: "1.0.0" } },
      installablePluginDirs: ["p"],
      componentDirs: { p: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /dependencies:/);
  });
});

test("normalizeDependencies: empty `dependencies: []` array omits the line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "p",
            source: "./p",
            version: "1.0.0",
            skills: "skills",
            dependencies: [],
          },
        ],
      },
      installed: { p: { version: "1.0.0" } },
      installablePluginDirs: ["p"],
      componentDirs: { p: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /dependencies:/);
  });
});

// ---------------------------------------------------------------------------
// (i) NFR-5 import discipline: no network surface.
// ---------------------------------------------------------------------------

test("NFR-5: info.ts has zero imports from platform/git, DEFAULT_GIT_OPS, or refreshGitHubClone", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
    "utf8",
  );
  // Strip comments before grep so the explanatory header that
  // mentions forbidden symbols in PROSE does not produce false
  // positives. Mirrors `tests/orchestrators/marketplace/info.test.ts`.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(code.includes("platform/git"), false, "info.ts must not import platform/git");
  assert.equal(
    code.includes("DEFAULT_GIT_OPS"),
    false,
    "info.ts must not reference DEFAULT_GIT_OPS",
  );
  assert.equal(
    code.includes("refreshGitHubClone"),
    false,
    "info.ts must not reference refreshGitHubClone",
  );
});

// ---------------------------------------------------------------------------
// (j) PR-5 sort precondition: orchestrator pre-sorts per-kind arrays.
// ---------------------------------------------------------------------------

test("PR-5: orchestrator pre-sorts per-kind component arrays alphabetically before passing to renderer", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "p",
            source: "./p",
            version: "1.0.0",
            skills: "skills",
          },
        ],
      },
      installed: { p: { version: "1.0.0" } },
      installablePluginDirs: ["p"],
      // Component dirs created in non-alphabetical order: `zeta`, then
      // `alpha`. The resolver's implicit-by-convention probe walks the
      // declared dir and accumulates in directory-iteration order
      // (filesystem-dependent), but the orchestrator MUST sort the
      // names before handing to the renderer.
      componentDirs: { p: ["skills/zeta", "skills/alpha"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    // The body must show `skills: alpha, zeta` (sorted), NOT in
    // directory-iteration order. PR-5 precondition test.
    assert.match(notifications[0]!.message, /skills: alpha, zeta/);
  });
});

// ---------------------------------------------------------------------------
// (k) dependencies field surfaced as `dependencies:` line.
// ---------------------------------------------------------------------------

test("INFO-02: manifest entry's `dependencies: string[]` field surfaces as `    dependencies: ...` line LAST after components", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "p",
            source: "./p",
            version: "1.0.0",
            skills: "skills",
            dependencies: ["helper@utils-mp", "another@aux"],
          },
        ],
      },
      installed: { p: { version: "1.0.0" } },
      installablePluginDirs: ["p"],
      componentDirs: { p: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    // Sorted alphabetically: `another@aux` precedes `helper@utils-mp`.
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● p v1.0.0 (installed)",
        "    skills: s1",
        "    dependencies: another@aux, helper@utils-mp",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// (l) Barrel re-export.
// ---------------------------------------------------------------------------

test("Barrel: orchestrators/plugin/index.ts re-exports getPluginInfo and GetPluginInfoOptions", async () => {
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/plugin/index.ts");
  assert.equal(typeof mod.getPluginInfo, "function");
});

// ---------------------------------------------------------------------------
// Github-source marketplace record: confirm the orchestrator does NOT
// access the network even when the marketplace record's source is github
// (the local clone supplies the manifest; the source-kind dispatch only
// affects PLUGIN-entry source classification, not marketplace source).
// ---------------------------------------------------------------------------

test("NFR-5 end-to-end: github-source marketplace record resolves plugin info from the LOCAL clone only", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const locations = locationsFor("user", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const mpRoot = path.join(userRoot, "marketplaces", "gh-mp");
    await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "gh-mp",
        plugins: [
          {
            name: "local-plug",
            source: "./local-plug",
            version: "1.0.0",
            skills: "skills",
          },
        ],
      }),
    );
    await mkdir(path.join(mpRoot, "local-plug", "skills", "s1"), { recursive: true });

    await saveState(locations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        "gh-mp": {
          name: "gh-mp",
          scope: "user",
          source: githubSource("https://github.com/owner/gh-mp"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {
            "local-plug": {
              version: "1.0.0",
              resolvedSource: "./local-plug",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              // Populated resources: an ENABLED installed record (empty
              // resources + installable:true would read as disabled per
              // ENBL-04 and route to the `(disabled)` inventory arm).
              resources: {
                skills: ["local-plug-skill"],
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

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "gh-mp",
      plugin: "local-plug",
      scope: "user",
      cwd,
    });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● gh-mp [user] <no autoupdate>",
        "  ● local-plug v1.0.0 (installed)",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-54-01 / ENBL-04: recorded-but-disabled plugin on the info surface (CR-02)
// ---------------------------------------------------------------------------

test("ENBL-04: info on a recorded-but-disabled plugin renders the list-arm `(disabled)` inventory row (not the installed info block)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "foo",
            source: "./foo",
            version: "1.2.3",
            description: "Foo plugin",
            skills: "skills",
          },
        ],
      },
      // ENBL-02 marker: empty resources + installable:true.
      installed: { foo: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });

    // Single notify (IL-2 holds on the all-disabled path); list-arm
    // marketplace header + `(disabled)` row per the catalog's info-surface
    // paragraph; NO per-kind component lines (the plugin has no
    // materialized artefacts -- ENBL-02). Severity info.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "disabled inventory routes to info");
    assert.equal(
      notifications[0]!.message,
      ["● mp [user]", "  ◍ foo v1.2.3 (disabled)"].join("\n"),
    );
  });
});

test("ENBL-04: bare info (no --scope) with disabled record in one scope and info block in the other emits BOTH surfaces", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    // Project scope: enabled installed record (info block).
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "foo", source: "./foo", version: "1.0.0", skills: "skills" }],
      },
      installed: { foo: { version: "1.0.0" } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });
    // User scope: disabled record.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "foo", source: "./foo", version: "1.2.3", skills: "skills" }],
      },
      installed: { foo: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", cwd });

    // Two notifies: the project-scope info block + the user-scope
    // `(disabled)` inventory block (mirrors the GRAM-04 mixed-surface
    // separation -- the two message kinds cannot share one cascade).
    assert.equal(notifications.length, 2);
    const all = notifications.map((n) => n.message).join("\n---\n");
    assert.match(all, /● foo v1\.0\.0 \(installed\)/, all);
    assert.match(all, /◍ foo v1\.2\.3 \(disabled\)/, all);
  });
});

// ---------------------------------------------------------------------------
// SURF-01 / D-63-04 / D-63-07: `info <plugin>` for an installable plugin
// with `hooks/hooks.json` renders the multi-line `hooks:` block. The
// block slots alphabetically between `commands` and `mcp` (driven by
// the 5-tuple `COMPONENT_KINDS`). Tool events render as
// `<event>(<matcher>)`; non-tool events render as bare `<event>`.
// Declaration order from the parsed file is preserved.
//
// The byte-form of the `hooks:` block itself is locked end-to-end in
// `tests/shared/notify-v2.test.ts` (renderer unit tests). These
// orchestrator-level fixtures verify the integration: the info.ts
// re-parse from disk produces the `HookSummaryEntry[]` that flows into
// the renderer at the correct alphabetical slot.
// ---------------------------------------------------------------------------

test("SURF-01 / D-63-04: installed plugin with hooks/hooks.json renders multi-line `hooks:` block between `commands:` and `mcp:`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "h",
            source: "./h",
            version: "1.0.0",
            commands: "commands",
          },
        ],
      },
      installed: { h: { version: "1.0.0" } },
      installablePluginDirs: ["h"],
      componentFiles: { h: ["commands/c1.md"] },
    });

    // Seed a parseable hooks/hooks.json with two PreToolUse groups, one
    // PostToolUse group, and one SessionStart group. Declaration order
    // is preserved end-to-end: PreToolUse(Bash) -> PreToolUse(Edit|Write)
    // -> PostToolUse(Edit) -> SessionStart.
    const pluginDir = path.join(mpRoot, "h");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo pre-bash" }] },
          { matcher: "Edit|Write", hooks: [{ type: "command", command: "echo pre-edit-write" }] },
        ],
        PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "echo post-edit" }] }],
        SessionStart: [{ hooks: [{ type: "command", command: "echo session-start" }] }],
      }),
      "utf8",
    );

    // Also seed a `mcpServers` field so we can verify the alphabetical
    // slot of `hooks:` BETWEEN `commands:` and `mcp:`.
    await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "h",
        version: "1.0.0",
        mcpServers: { "my-mcp": { command: "echo" } },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "h", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● h v1.0.0 (installed)",
        "    commands: c1",
        "    hooks:",
        "      PreToolUse(Bash)",
        "      PreToolUse(Edit|Write)",
        "      PostToolUse(Edit)",
        "      SessionStart",
        "    mcp: my-mcp",
      ].join("\n"),
    );
  });
});

test("SURF-01 / D-63-04: unavailable plugin (malformed hooks/hooks.json) suppresses `hooks:` block and does NOT emit `components: not resolved` for a path source", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "legacy", source: "./legacy", version: "0.1.0" }],
      },
      installablePluginDirs: ["legacy"],
    });

    // Malformed hooks.json: resolver flips installable: false. The
    // resolver does NOT record `hooksConfigPath` when the parse fails,
    // so the not-installable variant carries no hooks bucket -- the
    // row renders without a `hooks:` block. With no other components on
    // disk the components map is empty, so the path-source INFO-05
    // arm emits no per-kind lines and suppresses the
    // `components: not resolved` marker (reserved for non-path sources).
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(unavailable\) \{unsupported hooks\}/);
    assert.doesNotMatch(msg, /components: not resolved/);
    assert.doesNotMatch(msg, /hooks:/);
  });
});

test("SURF-01 / D-63-04: installable plugin with NO hooks/hooks.json renders NO `hooks:` line (legacy 4-kind output unchanged)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "no-hooks",
            source: "./no-hooks",
            version: "1.0.0",
            skills: "skills",
          },
        ],
      },
      installed: { "no-hooks": { version: "1.0.0" } },
      installablePluginDirs: ["no-hooks"],
      componentDirs: { "no-hooks": ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "no-hooks",
      scope: "user",
      cwd,
    });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ● no-hooks v1.0.0 (installed)", "    skills: s1"].join(
        "\n",
      ),
    );
    assert.doesNotMatch(notifications[0]!.message, /hooks:/);
  });
});

test("SURF-01 / D-63-04: available plugin (not-installed) with hooks/hooks.json also renders the `hooks:` block", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "ah", source: "./ah", version: "0.2.0" }],
      },
      // NOT installed -> goes through buildAvailableRow.
      installablePluginDirs: ["ah"],
    });

    const pluginDir = path.join(mpRoot, "ah");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        UserPromptSubmit: [{ hooks: [{ type: "command", command: "echo ups" }] }],
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ah", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ ah v0.2.0 (available)",
        "    hooks:",
        "      UserPromptSubmit",
      ].join("\n"),
    );
  });
});

test("SURF-01 / Open Question 3: hooks/hooks.json deleted between resolve and info-render surfaces probe-classifier reason via narrowProbeError (POSIX)", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "hr", source: "./hr", version: "1.0.0" }],
      },
      installed: { hr: { version: "1.0.0" } },
      installablePluginDirs: ["hr"],
    });

    // Seed a parseable hooks.json so the resolver records `hooksConfigPath`
    // (`installable: true`), then chmod 000 the file so the info-time
    // re-read raises EACCES. The narrowProbeError ladder must classify
    // the failure as `permission denied` -- the SAME closed-set REASON
    // the other component-probe failures (e.g. skills dir EACCES) emit.
    const pluginDir = path.join(mpRoot, "hr");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    const hooksFile = path.join(pluginDir, "hooks", "hooks.json");
    await writeFile(
      hooksFile,
      JSON.stringify({
        SessionStart: [{ hooks: [{ type: "command", command: "echo s" }] }],
      }),
      "utf8",
    );

    const { chmod } = await import("node:fs/promises");
    await chmod(hooksFile, 0o000);
    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "hr", scope: "user", cwd });
      assert.equal(notifications.length, 1);
      const msg = notifications[0]!.message;
      // The closed-set REASON form for unreadable probes flows through
      // the EXISTING narrowProbeError ladder (Open Question 3: no new
      // REASON, no new code path). Permission-denied is the expected
      // classification for an EACCES on the hooks.json read.
      assert.match(msg, /\(installed\) \{permission denied\}/);
      // No partial `hooks:` block under a permission-denied row.
      assert.doesNotMatch(msg, /hooks:/);
    } finally {
      await chmod(hooksFile, 0o644).catch(() => undefined);
    }
  });
});

// ---------------------------------------------------------------------------
// INFO-05: path-source not-installable variants enumerate components from disk.
// The gate excludes non-path sources, not the not-installable verdict.
// ---------------------------------------------------------------------------

test("INFO-05: (unavailable) {unsupported hooks} path-source plugin enumerates on-disk skills + commands", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            description: "Plugin with unsupported hooks and on-disk components.",
            skills: "skills",
            commands: "commands",
          },
        ],
      },
      installablePluginDirs: ["legacy"],
      componentDirs: { legacy: ["skills/s1"] },
      componentFiles: { legacy: ["commands/c1.md"] },
    });

    // Malformed hooks.json flips installable: false.
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    // Per-kind component lines appear even though the resolver returned
    // not-installable; no `hooks:` line because the resolver bailed
    // before recording `hooksConfigPath`; no `components: not resolved`
    // marker (reserved for non-path sources).
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ⊘ legacy v0.1.0 (unavailable) {unsupported hooks}",
        "    Plugin with unsupported hooks and on-disk components.",
        "    commands: c1",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

test("INFO-05: (installed) {unsupported hooks} path-source plugin enumerates on-disk skills + commands", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            skills: "skills",
            commands: "commands",
          },
        ],
      },
      installed: { legacy: { version: "0.1.0" } },
      installablePluginDirs: ["legacy"],
      componentDirs: { legacy: ["skills/s1"] },
      componentFiles: { legacy: ["commands/c1.md"] },
    });

    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● legacy v0.1.0 (installed) {unsupported hooks}",
        "    commands: c1",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

test("INFO-05: not-installed npm-source plugin still emits `components: not resolved` (non-path gate preserved)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "remote",
            source: { source: "npm", package: "@scope/remote-plugin", version: "1.0.0" },
            version: "1.0.0",
            description: "Remote plugin sourced from an external npm package.",
          },
        ],
      },
      // NOT installed -> buildNotInstalledRow path.
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ⊘ remote v1.0.0 (unavailable) {unsupported source}",
        "    Remote plugin sourced from an external npm package.",
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

test("INFO-05: composeResolvedComponents throw on the unavailable arm falls back to `componentsResolved: false` with merged reasons (POSIX)", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            skills: "skills",
          },
        ],
      },
      installablePluginDirs: ["legacy"],
      componentDirs: { legacy: ["skills/s1"] },
    });

    // Malformed hooks.json flips installable: false; then chmod 000 on the
    // skills dir makes the on-disk discovery throw EACCES. The throw must
    // propagate up to the unavailable-arm catch and fall back to
    // `componentsResolved: false` with the merged reasons brace.
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { chmod } = await import("node:fs/promises");
    const skillsDir = path.join(pluginDir, "skills");
    await chmod(skillsDir, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
      assert.equal(notifications.length, 1);
      const msg = notifications[0]!.message;
      // Both reasons surface in the brace; order follows the
      // composeReasons join (resolver notes first, then probe error).
      assert.match(msg, /\(unavailable\) \{unsupported hooks, permission denied\}/);
      assert.match(msg, /components: not resolved/);
      assert.doesNotMatch(msg, /skills:/);
    } finally {
      await chmod(skillsDir, 0o755).catch(() => undefined);
    }
  });
});

test("INFO-05: composeResolvedComponents throw on the installed arm falls back to `componentsResolved: false` with merged reasons (POSIX)", async (t) => {
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            skills: "skills",
          },
        ],
      },
      installed: { legacy: { version: "0.1.0" } },
      installablePluginDirs: ["legacy"],
      componentDirs: { legacy: ["skills/s1"] },
    });

    // Malformed hooks.json flips installable: false; chmod 000 on the
    // skills dir makes the on-disk discovery throw EACCES. Symmetric to
    // the unavailable-arm test above -- the throw propagates to
    // buildNotInstallablePathRowFields' narrowed catch and merges the
    // resolver `unsupported hooks` note with the probe-classified
    // `permission denied` reason. Status stays `installed` because the
    // state record confirms the install.
    const pluginDir = path.join(mpRoot, "legacy");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { chmod } = await import("node:fs/promises");
    const skillsDir = path.join(pluginDir, "skills");
    await chmod(skillsDir, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
      assert.equal(notifications.length, 1);
      const msg = notifications[0]!.message;
      assert.match(msg, /\(installed\) \{unsupported hooks, permission denied\}/);
      assert.match(msg, /components: not resolved/);
      assert.doesNotMatch(msg, /skills:/);
    } finally {
      await chmod(skillsDir, 0o755).catch(() => undefined);
    }
  });
});

// ---------------------------------------------------------------------------
// INFO-05: lenient hooks reader -- when the resolver bails because the
// hooks file declares non-bucket-A events, the info surface STILL lists
// the declared events with a `(unsupported)` suffix on each non-bucket-A
// one. The strict resolver-side parser (HOOK-01) remains unchanged; the
// lenient reader runs ONLY on the path-resolvable
// `(partially-available) {unsupported hooks}` carrier row (USTAT-01 / D-64-01: the
// row resolves `unsupported`, so it renders the de-collapsed `⊖` token).
// ---------------------------------------------------------------------------

test("INFO-05: lenient reader lists `Stop (unsupported)` on a path-resolvable `(partially-available) {unsupported hooks}` row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "ralph", source: "./ralph", version: "0.1.0" }],
      },
      installablePluginDirs: ["ralph"],
    });

    // ralph-loop fixture shape: a single top-level `Stop` event, which is
    // not in BUCKET_A_EVENTS. The partition filters it to the EMPTY subset
    // (Q2), so the plugin resolves `unsupported` WITHOUT recording
    // `hooksConfigPath` -- info therefore routes to the lenient reader, which
    // still enumerates `Stop (unsupported)` from the source file.
    const pluginDir = path.join(mpRoot, "ralph");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: { Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }] },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ralph", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(partially-available\) \{unsupported hooks\}/);
    // The hooks: block lists Stop with the (unsupported) suffix.
    assert.match(msg, /\n {4}hooks:\n {6}Stop \(unsupported\)/);
  });
});

test("PHOOK-05 / D-71-05: strict reader lists the kept `PostToolUse(Bash)` group plus the dropped `Stop (unsupported)` on a mixed force-degradable row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "mixed", source: "./mixed", version: "0.1.0" }],
      },
      installablePluginDirs: ["mixed"],
    });

    // Mixed shape: PostToolUse (bucket-A, with a matcher) + Stop
    // (non-bucket-A). The partition keeps the supportable PostToolUse(Bash)
    // group and drops the Stop event, so the plugin resolves `unsupported`
    // and records `hooksConfigPath`. Info therefore routes to the STRICT
    // reader, which extracts the matcher (`PostToolUse(Bash)`) and now also
    // enumerates the dropped Stop event (FSTAT-07 dropped-component detail).
    const pluginDir = path.join(mpRoot, "mixed");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo p" }] }],
          Stop: [{ hooks: [{ type: "command", command: "echo s" }] }],
        },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "mixed", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(partially-available\) \{unsupported hooks\}/);
    // Kept group first (with its matcher, via the strict reader), then the
    // dropped Stop event carrying the (unsupported) suffix.
    assert.match(msg, /\n {4}hooks:\n {6}PostToolUse\(Bash\)\n {6}Stop \(unsupported\)/);
  });
});

test("PHOOK-05 / D-71-05: strict reader enumerates an intra-event dropped matcher group as `PreToolUse(.*) (unsupported)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "grouped", source: "./grouped", version: "0.1.0" }],
      },
      installablePluginDirs: ["grouped"],
    });

    // Intra-event matcher-group partition (D-71-02): PreToolUse declares a
    // supportable `Edit` group and an unsupportable regex `.*` group. The
    // partition keeps the Edit group and drops the regex group, so the plugin
    // resolves `unsupported` with `hooksConfigPath` recorded. The strict
    // reader renders the kept group plain and the dropped group at
    // matcher-group granularity with the (unsupported) suffix.
    const pluginDir = path.join(mpRoot, "grouped");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Edit", hooks: [{ type: "command", command: "echo edit" }] },
            { matcher: ".*", hooks: [{ type: "command", command: "echo regex" }] },
          ],
        },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "grouped", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(partially-available\) \{unsupported hooks\}/);
    // Kept group plain, dropped regex group at matcher-group granularity.
    assert.match(
      msg,
      /\n {4}hooks:\n {6}PreToolUse\(Edit\)\n {6}PreToolUse\(\.\*\) \(unsupported\)/,
    );
  });
});

test("INFO-05: invalid-JSON `hooks/hooks.json` suppresses the `hooks:` block on the `(unavailable) {unsupported hooks}` row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "broken", source: "./broken", version: "0.1.0" }],
      },
      installablePluginDirs: ["broken"],
    });

    const pluginDir = path.join(mpRoot, "broken");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(path.join(pluginDir, "hooks", "hooks.json"), "{ not valid json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "broken", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(unavailable\) \{unsupported hooks\}/);
    // Unparseable hooks.json -> lenient reader returns undefined ->
    // appendHooksBlock's length-zero guard suppresses the header.
    assert.doesNotMatch(msg, /hooks:/);
  });
});

// ---------------------------------------------------------------------------
// RSTA-01 / RSTA-04 / RSTA-05 / RSTA-06 / D-80-04 / NFR-5: git-source plugins
// on the info surface. A NOT-installed git plugin (url / github / git-subdir)
// with a COLD clone renders `(remote)` + `components: not resolved` from the
// manifest -- it is NOT over-claimed `(available)` when nothing is materialized
// locally. A WARM clone resolves and lists components fs-only via the three-way
// resolver. An installed git plugin whose clone is missing keeps its recorded
// installed status (D-78-04). Neither path clones or touches the network.
// ---------------------------------------------------------------------------

test("RSTA-01: uninstalled url-source plugin with a cold clone renders `(remote)` + components: not resolved, not (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: "https://example.com/repo",
            version: "1.0.0",
            description: "Git-source plugin; not installed.",
          },
        ],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\)/, msg);
    assert.match(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
  });
});

test("RSTA-01: uninstalled github-object-source plugin with a cold clone renders `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "ghplug",
            source: { source: "github", repo: "owner/repo" },
            version: "2.0.0",
          },
        ],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ ghplug v2\.0\.0 \(remote\)/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
  });
});

test("RSTA-01: uninstalled git-subdir-source plugin with a cold clone renders `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
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
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "subplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ subplug v3\.0\.0 \(remote\)/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
  });
});

test("RSTA-05: uninstalled url-source plugin with a WARM mirror resolves and lists components fs-only (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // Canonical url (no `.git`) so the staged mirror key matches the probed key.
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: cloneUrl,
            version: "1.0.0",
            description: "Warm git-source plugin.",
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "gplug" },
      componentDirs: ["skills/warm-skill"],
      componentFiles: ["commands/warm-cmd.md"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    // Warm resolution: three-way `available`, components enumerated fs-only from
    // the mirror working tree -- byte-equal the path-plugin components layout.
    assert.match(msg, /○ gplug v1\.0\.0 \(available\)/, msg);
    assert.match(msg, /commands: warm-cmd/, msg);
    assert.match(msg, /skills: warm-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("RSTA-05 / D-77-03: uninstalled git-subdir plugin with a WARM mirror renders the subdir's components, not an empty (available) row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // Canonical url (no `.git`) so the staged mirror key matches the probed key.
    const cloneUrl = "https://example.com/monorepo";
    const subPath = "plugins/canva";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "canva",
            // Object-form git-subdir source -- the only form that produces a
            // git-subdir kind (the string `#ref:sub` form parses as a plain url).
            source: { source: "git-subdir", url: cloneUrl, path: subPath },
            version: "1.0.0",
            description: "Warm git-subdir plugin.",
          },
        ],
      },
    });
    await seedWarmSubdirMirror({
      scope: "user",
      cwd,
      cloneUrl,
      subPath,
      pluginJson: { name: "canva" },
      componentDirs: ["skills/canva-skill"],
      componentFiles: ["commands/canva-cmd.md"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "canva", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    // Warm resolution anchored at the subdir: three-way `available` with the
    // subdir's components enumerated, NOT the silently-empty `(available)` row.
    assert.match(msg, /○ canva v1\.0\.0 \(available\)/, msg);
    assert.match(msg, /commands: canva-cmd/, msg);
    assert.match(msg, /skills: canva-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("RSTA-04: uninstalled git source with a WARM clone declaring an unsupported component resolves with a reason brace, not (remote)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "badplug",
            source: cloneUrl,
            version: "1.0.0",
          },
        ],
      },
    });
    // A warm mirror whose plugin.json declares an unsupported field
    // (`lspServers`) -> resolveStrict returns a non-installable arm, so the row
    // carries the same reason-brace path a path plugin gets (RSTA-04).
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "badplug", lspServers: { foo: {} } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "badplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    // Non-installable warm resolution routes through the SAME reason-brace arm a
    // path source uses -- NOT `(remote)` and NOT a bare `components: not resolved`.
    assert.match(msg, /\((unavailable|partially-available)\) \{/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("PURL-08 / D-78-04: installed git-source plugin with a missing clone keeps its recorded (installed) status, never (remote)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: "https://example.com/repo",
            version: "1.0.0",
            description: "Installed git-source plugin.",
          },
        ],
      },
      // Installed record present; no clone dir on disk. The installed path
      // preserves the D-78-04 degrade -- status holds, never regresses to remote.
      installed: { gplug: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /● gplug v1\.0\.0 \(installed\)/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
    assert.doesNotMatch(msg, /\(partially/, msg);
  });
});

test("RSTA-04: installed git-source plugin with a WARM mirror resolves its components fs-only on the (installed) row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: cloneUrl,
            version: "1.0.0",
          },
        ],
      },
      installed: { gplug: { version: "1.0.0" } },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "gplug" },
      componentDirs: ["skills/inst-skill"],
      componentFiles: ["agents/inst-agent.md"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /● gplug v1\.0\.0 \(installed\)/, msg);
    assert.match(msg, /agents: inst-agent/, msg);
    assert.match(msg, /skills: inst-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("NFR-5: info renders an uninstalled git plugin `(remote)` with no plugin-clones dir on disk (no clone, no network)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    // No plugin-clones/ directory exists; its continued absence after the
    // render proves the surface neither cloned nor fetched.
    const clonesDir = path.join(userRoot, "pi-claude-marketplace", "plugin-clones");
    let clonesExisted = true;
    try {
      await readFile(clonesDir);
    } catch {
      clonesExisted = false;
    }

    assert.equal(clonesExisted, false);

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\)/, msg);

    // The clones dir must STILL be absent -- the render neither cloned nor fetched.
    let clonesAfter = true;
    try {
      await readFile(clonesDir);
    } catch {
      clonesAfter = false;
    }

    assert.equal(clonesAfter, false, "info must not create plugin-clones/ (NFR-5)");
  });
});

// FTCH-03 / FTCH-04 / FTCH-06 / D-81-04 / D-81-05: `info --fetch`.
//
// A real clone-cache seam over a mock gitOps lets the fetch hook materialize a
// cold clone/mirror without touching the network; the production
// `buildAuthForHost` runs inside info. Tests inject this via
// `GetPluginInfoOptions.cloneCacheSeam`.
function fetchSeamWith(gitOps: GitOps): InfoCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

test("FTCH-03: info --fetch on a COLD pinned git plugin materializes the clone then resolves and lists components (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fixtureRepoDir = path.join(cwd, "repo-fixture");
    await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "gplug" }),
    );
    await mkdir(path.join(fixtureRepoDir, "skills", "fetched-skill"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, "skills", "fetched-skill", "SKILL.md"),
      `---\nname: fetched-skill\n---\n\nHello.\n`,
    );

    // A PINNED source (manifest sha) drives the immutable per-sha clone path,
    // whose mock-git surface is `clone` + `checkout` (no HEAD resolveRef on the
    // fixture-copied tree). The fetch hook clones then resolves the warm tree.
    const GIT_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: { source: "url", url: "https://example.com/repo", sha: GIT_SHA },
            version: "1.0.0",
          },
        ],
      },
    });

    const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // The mirror was materialized (network on cache miss), then resolved warm.
    assert.ok(gitState.cloneCalls.length >= 1, "the fetch hook cloned the cold mirror");
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /○ gplug v1\.0\.0 \(available\)/, msg);
    assert.match(msg, /skills: fetched-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("D-81-04: info --fetch degrades to `components: not resolved` + an existing reason when the fetch THROWS, never failing info", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: cloneUrl, version: "1.0.0" }],
      },
    });

    // A network-typed clone failure: the fetch hook must catch it and fall
    // through to the componentsResolved: false arm with `network unreachable`.
    const netErr = Object.assign(new Error("getaddrinfo ENOTFOUND example.com"), {
      code: "ENOTFOUND",
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: netErr });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();

    // getPluginInfo MUST resolve (not reject) even though the fetch threw.
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /components: not resolved/, msg);
    assert.match(msg, /network unreachable/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
  });
});

test("NFR-5: bare info (no --fetch) on a COLD git plugin makes ZERO git-seam calls and renders `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: cloneUrl, version: "1.0.0" }],
      },
    });

    // The seam is provided but `fetch` is omitted: the hook must NOT run.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "bare info must not clone (network-free)");
    assert.equal(gitState.fetchCalls.length, 0, "bare info must not fetch (network-free)");
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\)/, msg);
  });
});

test("D-78-04 / D-81-04: info --fetch on an INSTALLED git plugin with a missing clone surfaces the fetch failure reason WITHOUT regressing the recorded status", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
      // Installed record present; no clone dir on disk. The consented fetch
      // fails, so the row must carry the failure reason -- NOT render
      // byte-identical to bare info's silent degrade.
      installed: { gplug: { version: "1.0.0" } },
    });

    const netErr = Object.assign(new Error("getaddrinfo ENOTFOUND example.com"), {
      code: "ENOTFOUND",
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: netErr });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    // The recorded status holds (D-78-04: a fetch failure never un-installs)
    // AND the consented fetch failure surfaces as a closed-set reason.
    assert.match(msg, /● gplug v1\.0\.0 \(installed\) \{network unreachable\}/, msg);
    assert.match(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
    assert.doesNotMatch(msg, /\(partially/, msg);
  });
});

test("FTCH-03 / D-78-04: info --fetch on an installed git plugin with a missing clone materializes it and upgrades to resolved components", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fixtureRepoDir = path.join(cwd, "repo-fixture");
    await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "gplug" }),
    );
    await mkdir(path.join(fixtureRepoDir, "skills", "fetched-skill"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, "skills", "fetched-skill", "SKILL.md"),
      `---\nname: fetched-skill\n---\n\nHello.\n`,
    );

    const GIT_SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "gplug",
            source: { source: "url", url: "https://example.com/repo", sha: GIT_SHA },
            version: "1.0.0",
          },
        ],
      },
      // Installed record present; no clone dir on disk -- bare info renders
      // `components: not resolved` here (PURL-08). The fetch recovers it.
      installed: { gplug: { version: "1.0.0" } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // The clone was materialized, then the now-warm tree resolved on the
    // recorded (installed) row -- the headline `info --fetch` recovery.
    assert.ok(gitState.cloneCalls.length >= 1, "the fetch hook cloned the cold clone");
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /● gplug v1\.0\.0 \(installed\)/, msg);
    assert.match(msg, /skills: fetched-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("FTCH-03 / MIRR-02: info --fetch on an UNPINNED not-installed source materializes AND refreshes the mirror (probeUnpinned arm)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const fixtureRepoDir = path.join(cwd, "repo-fixture");
    await mkdir(path.join(fixtureRepoDir, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: "gplug" }),
    );
    await mkdir(path.join(fixtureRepoDir, "skills", "fetched-skill"), { recursive: true });
    await writeFile(
      path.join(fixtureRepoDir, "skills", "fetched-skill", "SKILL.md"),
      `---\nname: fetched-skill\n---\n\nHello.\n`,
    );

    // An UNPINNED source (no sha) drives the URL-keyed mirror path. The mock
    // pre-seeds refs so refreshGitHubClone's default-branch form resolves:
    // refs/remotes/origin/HEAD + refs/heads/main + HEAD all read MIRROR_HEAD.
    const MIRROR_HEAD = "fedcba9876543210fedcba9876543210fedcba98";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureRepoDir,
      head: MIRROR_HEAD,
      localRefs: { "refs/heads/main": MIRROR_HEAD },
      remoteRefs: { "refs/remotes/origin/HEAD": MIRROR_HEAD },
    });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // Cold mirror: materialized once, then refreshed in place (MIRR-02 -- the
    // mirror refresh IS the consented fetch on the unpinned arm).
    assert.ok(gitState.cloneCalls.length >= 1, "the fetch hook cloned the cold mirror");
    assert.ok(gitState.fetchCalls.length >= 1, "the fetch hook refreshed the mirror (MIRR-02)");
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /○ gplug v1\.0\.0 \(available\)/, msg);
    assert.match(msg, /skills: fetched-skill/, msg);
    assert.doesNotMatch(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(remote\)/, msg);
  });
});

test("FTCH-06: info --fetch folds an HttpError 401 seam throw to `{authentication required}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    // The isomorphic-git HttpError shape: `.code === "HttpError"` with the
    // status on `.data.statusCode` (duck-typed by classifyFetchFailure).
    const authErr = Object.assign(new Error("auth"), {
      code: "HttpError",
      data: { statusCode: 401 },
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: authErr });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\) \{authentication required\}/, msg);
    assert.match(msg, /components: not resolved/, msg);
  });
});

test("FTCH-06: info --fetch folds a UserCanceledError (denied/expired Device Flow) to `{authentication required}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: "https://example.com/repo", version: "1.0.0" }],
      },
    });

    // isomorphic-git throws UserCanceledError when onAuth returns
    // `{ cancel: true }` -- the shape a denied/expired Device Flow surfaces.
    const canceledErr = Object.assign(new Error("auth canceled"), {
      code: "UserCanceledError",
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: canceledErr });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "gplug",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\) \{authentication required\}/, msg);
    assert.match(msg, /components: not resolved/, msg);
  });
});
