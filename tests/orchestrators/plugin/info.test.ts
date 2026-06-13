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
//   (c) single-scope unavailable with `{hooks}` reason
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
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { getPluginInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { InvalidMarketplaceManifestError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

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
  readonly installed?: Record<string, { version: string; disabled?: boolean }>;
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
      // ENBL-04: empty resources + installable:true IS the disabled marker;
      // an enabled installed record always has >= 1 populated array.
      resources:
        info.disabled === true
          ? { skills: [], prompts: [], agents: [], mcpServers: [] }
          : { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [] },
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
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ p-only [user] (failed) {not added}",
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
      "1 marketplace operation failed.\n\n⊘ ghost-mp (failed) {not added}",
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
        "1 plugin operation failed.",
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
        "1 plugin operation failed.",
        "",
        "● mp [project] <no autoupdate>",
        "  ⊘ ghost (failed) {not in manifest}",
      ].join("\n"),
    );
    assert.equal(
      notifications[1]!.message,
      [
        "1 plugin operation failed.",
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

test("WR-01: installed plugin whose manifest declares hooks surfaces `{hooks}` on the (installed) row", async () => {
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
            // Declares hooks -> resolveStrict returns NotInstallable
            // with a note like "contains hooks" that
            // `narrowResolverNotes` maps to the `hooks` Reason.
            hooks: { path: "./hooks.json" },
          },
        ],
      },
      installed: { legacy: { version: "0.1.0" } },
      installablePluginDirs: ["legacy"],
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● legacy v0.1.0 (installed) {hooks}",
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
      schemaVersion: 1,
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
              // Populated resources: an ENABLED installed record (empty
              // resources + installable:true would read as disabled per
              // ENBL-04 and route to the `(disabled)` inventory arm).
              resources: { skills: ["local-plug-skill"], prompts: [], agents: [], mcpServers: [] },
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
      ["● mp [user]", "  ⊘ foo v1.2.3 (disabled)"].join("\n"),
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
    assert.match(all, /⊘ foo v1\.2\.3 \(disabled\)/, all);
  });
});
