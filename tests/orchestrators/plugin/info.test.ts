// tests/orchestrators/plugin/info.test.ts
//
// Phase 44 / Plan 44-01 / Task 2: integration tests for the read-only
// `getPluginInfo` orchestrator. Hermetic HOME + tmp cwd + saveState
// fixtures + on-disk path-source marketplace dirs carrying a real
// `plugin.json`. The orchestrator is the SOLE site that projects local
// state + on-disk manifest resolution into the Phase 42 info-message
// variants.
//
// Coverage:
//   (a) single-scope installed with resolved components + description
//   (b) single-scope available with description
//   (c) single-scope unavailable with `{hooks}` reason
//   (d) single-scope external source -> componentsResolved: false marker
//   (e) both-scopes fan-out (project-first per MSG-GR-3 / INFO-03)
//   (f) `--scope` mismatch -> Phase 42 INFO-04 `{not added}` row with
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
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { getPluginInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
  readonly installed?: Record<string, { version: string }>;
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
    plugins[name] = {
      version: info.version,
      resolvedSource: "./placeholder",
      compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
      resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
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
    schemaVersion: 1,
    marketplaces: { ...existing.marketplaces, [mpName]: record },
  } as unknown as Parameters<typeof saveState>[1]);

  return mpRoot;
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
// (c) single-scope unavailable with `{hooks}` reason.
// ---------------------------------------------------------------------------

test("INFO-02: single-scope unavailable (declares hooks) renders `⊘ ... (unavailable) {hooks}` + components: not resolved", async () => {
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
            name: "legacy",
            source: "./legacy",
            version: "0.1.0",
            description: "Old plugin that declares hooks.",
            hooks: { path: "./hooks.json" },
          },
        ],
      },
      installablePluginDirs: ["legacy"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "unavailable is info, not error");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ⊘ legacy v0.1.0 (unavailable) {hooks}",
        "    Old plugin that declares hooks.",
        "    components: not resolved",
      ].join("\n"),
    );
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
    assert.equal(notifications[0]!.message, "⊘ p-only [user] (failed) {not added}");
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
    assert.equal(notifications[0]!.message, "⊘ ghost-mp (failed) {not added}");
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
      ["● mp [user] <no autoupdate>", "  ⊘ ghost (failed) {not in manifest}"].join("\n"),
    );
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
      schemaVersion: 1,
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
              resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
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
