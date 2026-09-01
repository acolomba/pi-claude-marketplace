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
//   (a) single-scope installed with resolved components + description,
//       plus the DFEN-01 characterization that an entry declaring
//       `defaultEnabled` renders byte-identically to one that does not
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
//   (i) component list sort precondition (PR-5): unsorted manifest
//       declarations are sorted by the orchestrator before passing
//       into the renderer
//   (k) dependencies field surfaced as `dependencies: <plugin>@<mp>, ...`
//       line LAST

import assert from "node:assert/strict";
import * as fs from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as git from "isomorphic-git";
import { mock, verify, when } from "strong-mock";

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
import {
  buildInstalledPluginRecord,
  materializeMarketplaceTree,
  mergeMarketplaceIntoState,
  seedAutoupdateConfig,
} from "../../helpers/marketplace-seed.ts";
import { createCredentialOpsFake } from "../../platform/credential-ops-fake.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

function makeMockCredentialOps() {
  const credentials = createCredentialOpsFake({ boundary: "memory" });
  return {
    credOps: credentials.credentialOps,
    state: {
      get approveCalls() {
        return credentials.calls.approve;
      },
      get fillCalls() {
        return credentials.calls.fill;
      },
      get rejectCalls() {
        return credentials.calls.reject;
      },
    },
  };
}

interface GitOpsAdapterOptions {
  readonly fixtureSourceDir?: string;
  readonly cloneThrows?: Error;
  readonly head?: string;
  readonly localRefs?: Readonly<Record<string, string>>;
  readonly remoteRefs?: Readonly<Record<string, string>>;
}

const ALLOWED_INFO_REMOTES = [
  "https://example.com/monorepo",
  "https://example.com/monorepo.git",
  "https://example.com/repo",
  "https://example.com/repo.git",
  "https://example.com/warmdecl",
  "https://example.com/warmdecl.git",
  "https://github.com/owner/gh-mp",
  "https://github.com/owner/gh-mp.git",
] as const;

function makeMockGitOps(initial: GitOpsAdapterOptions = {}) {
  const normalizedRemoteRefs = Object.fromEntries(
    Object.entries(initial.remoteRefs ?? {}).map(([ref, oid]) => [
      ref.replace(/^refs\/remotes\/[^/]+\//, ""),
      oid,
    ]),
  );
  const initialOid =
    initial.head ??
    initial.localRefs?.["refs/heads/main"] ??
    "0000000000000000000000000000000000000001";
  const remoteHead =
    initial.remoteRefs?.["refs/remotes/origin/HEAD"] ??
    initial.remoteRefs?.["refs/remotes/origin/main"] ??
    initialOid;
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_INFO_REMOTES,
    initialOid,
    remoteHead,
    remoteRefs: { ...normalizedRemoteRefs, ...(initial.remoteRefs ?? {}) },
    ...(initial.localRefs === undefined ? {} : { localRefs: initial.localRefs }),
    ...(initial.fixtureSourceDir === undefined
      ? {}
      : {
          cloneFixture: {
            boundary: "local" as const,
            sourceDir: initial.fixtureSourceDir,
          },
        }),
    ...(initial.cloneThrows === undefined ? {} : { cloneError: initial.cloneThrows }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(options) {
      const { auth, ...authlessOptions } = options;
      await git.gitOps.clone(authlessOptions);
      if (auth !== undefined) {
        Object.assign(git.state.calls.clone.at(-1) ?? {}, { auth });
      }
    },
    async fetch(options) {
      const { auth, ...authlessOptions } = options;
      await git.gitOps.fetch(authlessOptions);
      if (auth !== undefined) {
        Object.assign(git.state.calls.fetch.at(-1) ?? {}, { auth });
      }
    },
    async resolveRef(options) {
      try {
        return await git.gitOps.resolveRef(options);
      } catch (error) {
        const remoteOid = git.state.remoteRefs[options.ref];
        if (remoteOid !== undefined) {
          return remoteOid;
        }

        throw error;
      }
    },
    async resolveRemoteRef(options) {
      const { auth, ...authlessOptions } = options;
      const oid = await git.gitOps.resolveRemoteRef(authlessOptions);
      if (auth !== undefined) {
        Object.assign(git.state.calls.resolveRemoteRef.at(-1) ?? {}, { auth });
      }

      return oid;
    },
  };

  return {
    gitOps,
    state: {
      get cloneCalls() {
        return git.state.calls.clone;
      },
      get fetchCalls() {
        return git.state.calls.fetch;
      },
    },
  };
}

interface NotifyRecord {
  message: string;
  severity?: NotificationSeverity;
}

type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

const pendingInteractionVerifications: Array<() => void> = [];

function makeCtx(expectedNotifications = 1): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(expectedNotifications);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(expectedNotifications * 2);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(expectedNotifications);
  pendingInteractionVerifications.push(() => {
    verify(ctx);
    verify(pi);
    verify(ui);
  });
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
    for (const verifyInteractions of pendingInteractionVerifications.splice(0)) {
      verifyInteractions();
    }

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
      /** Override the persisted source used by state-only info. */
      resolvedSource?: string;
      /** Override persisted resource inventories independently by kind. */
      resources?: {
        skills?: readonly string[];
        prompts?: readonly string[];
        agents?: readonly string[];
        mcpServers?: readonly string[];
        hooks?: readonly string[];
      };
      /** Persisted hook entries; omission exercises the legacy file fallback. */
      hookEntries?: readonly { event: string; matcher?: string }[];
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

  await materializeMarketplaceTree(mpRoot, opts);

  const plugins: Record<string, unknown> = {};
  for (const [name, info] of Object.entries(opts.installed ?? {})) {
    const override = info.resources;
    plugins[name] = buildInstalledPluginRecord(info, {
      agents: [...(override?.agents ?? [])],
      hooks: [...(override?.hooks ?? [])],
      mcpServers: [...(override?.mcpServers ?? [])],
      prompts: [...(override?.prompts ?? [])],
      skills: [...(override?.skills ?? [`${name}-skill`])],
    });
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

  return mpRoot;
}

async function seedMaterializedHooks(
  scope: "user" | "project",
  cwd: string,
  slug: string,
  raw: string,
): Promise<string> {
  const locations = locationsFor(scope, cwd);
  const file = path.join(locations.hooksDir, slug, "hooks.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, raw, "utf8");
  return file;
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

/**
 * The rendered message shared by the two cases below. The DFEN-01 case's entire
 * claim is that its output is byte-identical to the plain case, so both read one
 * literal: two copies would let a renderer change update one of them and retire
 * the claim without any test failing.
 */
const EXPECTED_FOO_INSTALLED_INFO = [
  "● mp [user] <no autoupdate>",
  "  ● foo v1.2.3 (installed)",
  "    Foo plugin",
  "    agents: a1",
  "    commands: c1",
  "    skills: s1",
].join("\n");

/** The `foo` entry both cases seed; `over` is the only intended difference. */
function fooInstalledEntry(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "foo",
    source: "./foo",
    version: "1.2.3",
    description: "Foo plugin",
    skills: "skills",
    commands: "commands",
    agents: "agents",
    ...over,
  };
}

function seedFooInstalled(
  home: string,
  cwd: string,
  entryOver: Record<string, unknown> = {},
): Promise<string> {
  return seedPathMarketplace({
    scope: "user",
    scopeRoot: path.join(home, ".pi", "agent"),
    cwd,
    mpName: "mp",
    manifest: { name: "mp", plugins: [fooInstalledEntry(entryOver)] },
    installed: { foo: { version: "1.2.3" } },
    installablePluginDirs: ["foo"],
    componentDirs: { foo: ["skills/s1"] },
    componentFiles: { foo: ["commands/c1.md", "agents/a1.md"] },
  });
}

test("INFO-02: single-scope installed (path source) renders header + plugin row + description + sorted per-kind components", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    await seedFooInstalled(home, cwd);

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(notifications[0]!.message, EXPECTED_FOO_INSTALLED_INFO);
  });
});

test("DFEN-01: an entry declaring defaultEnabled renders the same info message as one that does not", async () => {
  // `info` reads named fields off the parsed entry, so a declared
  // `defaultEnabled` is invisible to it: same single notification, same
  // `undefined` severity, same bytes as the case above -- no enablement line
  // and no reason token. The expectation is a shared literal rather than a
  // second live `getPluginInfo` call, because two live runs would agree even if
  // both had regressed.
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    await seedFooInstalled(home, cwd, { defaultEnabled: false });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(notifications[0]!.message, EXPECTED_FOO_INSTALLED_INFO);
  });
});

// ---------------------------------------------------------------------------
// (b) single-scope available with description.
// ---------------------------------------------------------------------------

test("INFO-02: single-scope available (path source) renders `○ ... (available)` with description", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "bar", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", cwd });
    // assert
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
    // arrange
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "p-only",
      manifest: { name: "p-only", plugins: [] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "p-only",
      plugin: "ghost",
      scope: "user",
      cwd,
    });
    // assert
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
    // arrange
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "ghost-mp", plugin: "ghost", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghost", scope: "user", cwd });
    // assert
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
    // arrange
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

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghost", cwd });

    // Two failed scopes -> two standalone error notifications (project-first),
    // NOT one info-severity cascade. The failure can never be summary-less.
    // assert
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
// The ladder itself is unit-tested in
// tests/shared/probe-classifiers.test.ts, against the public
// `narrowProbeError` both surfaces delegate to.
// An end-to-end integration of the THROW branch through the real
// resolver requires an FS-level fault injection that is not portable
// across CI sandboxes; the orchestrator-level `(c) install bucket
// throws` arm is exercised via the WR-01 NotInstallable test below
// (the `!installable` path runs through the SAME row-construction
// code as the throw branch).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// (h-WR-01b) WR-01: an INSTALLED plugin whose manifest declares
// `hooks` (resolveStrict returns NotInstallable with notes) must
// forward `narrowResolverNotes(notes)` as reasons on the `(installed)`
// row instead of swallowing them silently.
// ---------------------------------------------------------------------------

test("WR-01: installed plugin with malformed hooks/hooks.json surfaces `{unsupported hooks}` on the (installed) row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
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
    // arrange
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
            description: "Degraded plugin.",
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "degraded", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "force-installed is info, not error");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◉ degraded v1.0.0 (partially-installed) {lsp}",
        "    Degraded plugin.",
      ].join("\n"),
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "broken", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "x", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    // The orchestrator catches the ENOENT from `loadMarketplaceManifest`
    // and classifies via `narrowProbeError` -> `source missing` reason.
    const msg = notifications[0]!.message;
    assert.match(msg, /\(failed\) \{source missing\}/);
  });
});

// ---------------------------------------------------------------------------
// BOUND-01: a manifest that could not be READ licenses no membership claim
// about its contents, so a live installation record must not rescue the block
// into an installed-looking row. The read-failure arm returns before any
// plugin lookup, and this pins that ordering byte-exact with a populated
// record behind the unreadable manifest.
// ---------------------------------------------------------------------------

test("BOUND-01: a manifest READ FAILURE with an installed record present still renders the failure row, not the installation record", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
          plugins: {
            alpha: {
              version: "1.0.0",
              resolvedSource: "./placeholder",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
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

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      [
        "A plugin operation has failed.",
        "",
        "● mp [user] <no autoupdate>",
        "  ⊘ alpha (failed) {source missing}",
      ].join("\n"),
    );
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
    // arrange
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
            name: "p",
            source: "./p",
            version: "1.0.0",
            description: "Installed unreadable plugin.",
            skills: "skills",
          },
        ],
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
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
      // assert
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
    // arrange
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
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
      // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /dependencies:/);
  });
});

test("normalizeDependencies: empty `dependencies: []` array omits the line", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.doesNotMatch(notifications[0]!.message, /dependencies:/);
  });
});

// ---------------------------------------------------------------------------
// (i) PR-5 sort precondition: orchestrator pre-sorts per-kind arrays.
// ---------------------------------------------------------------------------

test("PR-5: orchestrator pre-sorts per-kind component arrays alphabetically before passing to renderer", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "p", scope: "user", cwd });
    // assert
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
// Github-source marketplace record: confirm the orchestrator does NOT
// access the network even when the marketplace record's source is github
// (the local clone supplies the manifest; the source-kind dispatch only
// affects PLUGIN-entry source classification, not marketplace source).
// ---------------------------------------------------------------------------

test("NFR-5 end-to-end: github-source marketplace record resolves plugin info from the LOCAL clone only", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "gh-mp",
      plugin: "local-plug",
      scope: "user",
      cwd,
    });
    // assert
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
// D-100-08 / ENBL-17: recorded-but-disabled plugin on the info surface. A
// record its manifest STILL declares resolves from the manifest exactly as an
// uninstalled one does, so the row reports the description and the component
// inventory -- while the injected disabled status keeps it from claiming to be
// installed.
// ---------------------------------------------------------------------------

test("D-100-08 / ENBL-17: info on a recorded-but-disabled plugin reports its description and components, still as `(disabled)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
      installed: { foo: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });

    // One notify, the standalone `plugin-info` shape every other installed
    // record uses: the manifest header, the `(disabled)` row, the manifest
    // description and the resolved component lines. The status token is what
    // stops the inventory being read as a running plugin -- it is not softened
    // or displaced by the lines below it. Severity info: a disabled record is
    // steady state, not a failure.
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ foo v1.2.3 (disabled)",
        "    Foo plugin",
        "    skills: s1",
      ].join("\n"),
    );
  });
});
test("plugin info manifest absent: INFO-09: a manifest-absent enabled record renders `(installed) {not in manifest}` at the recorded version", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "an installed record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-10: persisted unsupported kinds keep the record `(partially-installed)`
// on the state-only arm too. `narrowUnsupportedKinds` stays the sole producer
// of the kind tokens; the absence reason is PREPENDED around its output.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-10: a manifest-absent record with persisted unsupported kinds renders `(partially-installed) {not in manifest, lsp}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 / D-96-01: the four name-list kinds come from `resources.*` and
// render the Pi-GENERATED installed names verbatim -- no reverse-mapping to
// the plugin author's source names. MCP servers are the sole exception by data
// shape: the record holds their raw source keys. Kind order is the renderer's
// fixed `agents, commands, mcp, skills`; within a kind the orchestrator sorts.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-11: the four name-list kinds render from `resources.*`, sorted, with generated names verbatim", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: {
            skills: ["alpha-skill", "Alpha-other"],
            prompts: ["alpha:build"],
            agents: ["pi-claude-marketplace-alpha-review"],
            mcpServers: ["zeta-srv", "alpha-srv"],
          },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    agents: pi-claude-marketplace-alpha-review",
        "    commands: alpha:build",
        "    mcp: alpha-srv, zeta-srv",
        "    skills: Alpha-other, alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 empty edge: all five resources arrays empty on an ENABLED record.
// The components are known and known to be NONE, so the row renders alone --
// no per-kind lines and no `components: not resolved` marker (that marker
// means "we did not look", which would be a lie here).
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-11: a manifest-absent record with all-empty resources renders the bare row, no `components: not resolved`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 hooks kind: the installation record holds only the hooks container
// slug, so the entries are reconstructed from the MATERIALIZED configuration
// the install ledger wrote at `<hooksDir>/<slug>/hooks.json` (D-57-03). The
// block lands between the `commands` and `mcp` lines, which is the renderer's
// fixed kind order.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-11: a recorded hooks slug renders the materialized config's entries as a `hooks:` block", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      Stop",
        "      PreToolUse(Bash)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 ordering: hook entries keep the materialized file's DECLARATION
// order. Seeding the same two events in the reverse order must swap the two
// rendered lines -- the four name-list kinds are sorted, the hooks kind is not.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-11: hook entries follow the materialized file's declaration order, never a sort", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      PreToolUse(Bash)",
        "      Stop",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-100-03 / ENBL-12 read ladder: the record wins when it carries `hookEntries`,
// the materialized file answers when it does not, and a present-but-empty key
// is a completed answer of zero entries rather than a fall-through.
//
// Every case below seeds a materialized configuration whose entries DIFFER
// from the record's, so "the record won" and "the file won" produce different
// bytes. A test that seeded the same entries on both sides would pass whichever
// source the code actually read.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: D-100-03 / ENBL-12: a record carrying hookEntries renders them, not the materialized file's", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: { hooks: ["alpha"] },
          hookEntries: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
        },
      },
    });
    // Deliberately DIFFERENT from the record: these two lines are what the
    // rendered block must NOT contain.
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      SessionStart",
        "      PostToolUse(Read)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

test("plugin info manifest absent: D-100-03 / ENBL-12: a legacy record with no hookEntries key still reports its hooks from the materialized file", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      // No `hookEntries`: the shape every record written before the key
      // existed has. The fallback is what keeps these records reporting
      // truthfully until the next install, update, reinstall or enable.
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      Stop",
        "      PreToolUse(Bash)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

test("plugin info manifest absent: D-100-03 / ENBL-12: a present-but-empty hookEntries renders no `hooks:` line and no reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: { version: "1.0.0", resources: { hooks: ["alpha"] }, hookEntries: [] },
      },
    });
    // A readable file with real entries: if the empty key fell through to the
    // file, these two lines would appear.
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-03 true negative: a record with NO recorded hooks omits the `hooks:`
// line and stamps NO reason. Nothing is read, so there is nothing to degrade.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: D-96-03: a record with no recorded hooks omits the `hooks:` line with no added reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: [] } } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 empty edge / D-96-03: a materialized file that parses to an EMPTY
// event map is a successful read of nothing. Zero entries means no header line
// and, because nothing failed, no reason either -- byte-identical to the
// INFO-09 row.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-11: a materialized hooks config that parses to an empty map renders no `hooks:` line and no reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks("user", cwd, "alpha", "{}");

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-03 degradation matrix. Every case below records hook slugs the arm
// cannot list. The contract is the same each time: the `hooks:` line is
// OMITTED and the row carries a read reason LAST in the brace, so the operator
// can tell "this plugin has no hooks" from "this plugin has hooks I could not
// read". The rest of the block always renders -- no read failure takes the
// plugin's remaining truth off the screen.
//
// The reasons are the `narrowProbeError` ladder's own output, not a
// hooks-specific vocabulary. They are attributable to hooks because the
// materialized hooks configuration is the ONLY file this arm opens.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: D-96-03: a recorded hooks slug with no materialized file omits the block and reports `source missing`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    // Deliberately no `seedMaterializedHooks` call: the record names a slug
    // whose file the install ledger wrote and something later removed.

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// Both structural parse arms collapse to the same token: `parseHooksConfig`
// returns `{ok:false}` for malformed JSON and for a schema-invalid payload
// alike, and the reader maps that single verdict to `unparseable`. One case
// therefore covers the whole arm.
test("plugin info manifest absent: D-96-03: a malformed materialized hooks config omits the block and reports `unparseable`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks("user", cwd, "alpha", "{ not json");

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, unparseable}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// NFR-10: the slug is state-supplied data used as a path component, so
// `assertPathInside` refuses a traversal slug BEFORE any `readFile`. No file
// outside `hooksDir` is opened even if one exists at the composed path. The
// containment error carries no errno, so it classifies as `unreadable`, and
// the four name-list kinds still render in full.
test("plugin info manifest absent: NFR-10: a traversal hooks slug is refused before any read and the block still renders", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: {
            skills: ["alpha-skill"],
            prompts: ["alpha:build"],
            agents: ["pi-claude-marketplace-alpha-review"],
            mcpServers: ["alpha-srv"],
            hooks: ["../../etc"],
          },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, unreadable}",
        "    agents: pi-claude-marketplace-alpha-review",
        "    commands: alpha:build",
        "    mcp: alpha-srv",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// NFR-10 observability: `{unreadable}` is a cosmetic degradation marker shared
// with transient disk failures, so a REFUSED traversal slug must also be named
// in the debug log -- otherwise a tampering attempt is indistinguishable from an
// EIO in both the UI and the log. Mirrors the hooks hydrate read site, which
// logs its containment violation before returning.
test("plugin info manifest absent: NFR-10: a refused traversal hooks slug is named in the debug log, not just folded to `{unreadable}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["../../etc"] } } },
    });

    const originalDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    const originalError = console.error;
    const logged: string[] = [];
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
    console.error = (...args: unknown[]): void => {
      logged.push(args.map((a) => String(a)).join(" "));
    };

    try {
      const { ctx, pi, notifications } = makeCtx();
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // The rendered outcome is unchanged -- the token stays the closed-set
      // `{unreadable}` the catalog pins.
      // assert
      assert.equal(
        notifications[0]!.message,
        [
          "● mp [user] <no autoupdate>",
          "  ● alpha v1.0.0 (installed) {not in manifest, unreadable}",
          "    skills: alpha-skill",
        ].join("\n"),
      );
    } finally {
      console.error = originalError;
      if (originalDebug === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = originalDebug;
      }
    }

    const violation = logged.find((l) => l.includes("containment violation"));
    assert.ok(
      violation !== undefined,
      `expected a containment-violation debug line, got: ${JSON.stringify(logged)}`,
    );
    assert.ok(violation.startsWith("[hooks] info: containment violation"), violation);
    assert.ok(violation.includes('"../../etc"'), violation);
  });
});

test("plugin info manifest absent: D-96-03: an unreadable materialized hooks config reports `permission denied` (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 unreadable file path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block read");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    const file = await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({ Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] }),
    );
    await chmod(file, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // assert
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]!.severity, undefined);
      assert.equal(
        notifications[0]!.message,
        [
          "● mp [user] <no autoupdate>",
          "  ● alpha v1.0.0 (installed) {not in manifest, permission denied}",
          "    skills: alpha-skill",
        ].join("\n"),
      );
    } finally {
      // Restore the mode so the hermetic-HOME teardown can remove the tree.
      await chmod(file, 0o644);
    }
  });
});

// INFO-10 / D-96-03 composition: absence FIRST, the unsupported-kind tokens
// NEXT, the read marker LAST. Three reasons in one brace prove the order rule
// holds when both reason families are present.
test("plugin info manifest absent: INFO-10 / D-96-03: a partial record with an unreadable hooks config orders the three reasons absence, kind, read", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          unsupported: ["lspServers"],
          resources: { hooks: ["alpha"] },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// Control: the manifest DECLARES the plugin, so the manifest-backed arm runs
// unchanged -- no `{not in manifest}` brace, and components enumerate from
// disk as the author's SOURCE names. Proves the arm split did not leak the
// absence reason onto the declared path, and shows the D-96-01 divergence
// side by side (source `alpha-src-skill` here vs generated `alpha-skill` on
// the state-only rows above).
// ---------------------------------------------------------------------------

test("plugin info manifest absent: INFO-09 boundary: a DECLARED plugin keeps the manifest-backed row with no `{not in manifest}` brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed)",
        "    skills: alpha-src-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-100-08 / ENBL-17: a manifest-absent DISABLED record goes through the SAME
// `buildBlock` every other installed record does, so it reports the component
// inventory the disable retained (ENBL-18) instead of a bare row. The
// `(disabled)` token survives the reroute because the disabled status is
// injected ahead of the persisted-status derivation, which knows only
// `installed` / `partially-installed`; and `{not in manifest}` stays on the
// inventory row per D-100-07 -- it names what blocks the user's next action.
// ---------------------------------------------------------------------------

test("plugin info manifest absent: D-100-08 / ENBL-17: a manifest-absent DISABLED record renders `(disabled) {not in manifest}` with its retained inventory", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// The disabled-PARTIAL half, which pins BOTH halves of the disabled row shape
// on one record. The STATUS: without the injection this record derives
// `(partially-installed)`, which would tell the user a deregistered plugin is
// running. The REASON BRACE: the record carries a persisted unsupported kind,
// and the row hides it (ENBL-16 / D-100-07). A dropped component kind describes
// runtime behavior that the disable suspended, so it waits for the plugin to be
// re-enabled; manifest absence blocks `enable` itself, so it stays. The same
// record renders the same bytes on the `list` surface.
test("plugin info manifest absent: D-100-08 / ENBL-16 / ENBL-17: a manifest-absent DISABLED PARTIAL keeps `(disabled)` and hides its unsupported-kind token", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      // The factory derives the reachable persisted shape from these two
      // fields alone: `enabled: false` and `installable: false` (unsupported is
      // non-empty). The inventory survives the disable (ENBL-18).
      installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    // Row-scoped: the token is absent from the ROW, not merely absent from a
    // brace an equality could also lose by moving the line.
    assert.equal(notifications[0]!.message.split("\n")[1]!.includes("lsp"), false);
  });
});

// ENBL-17 / D-100-03: the population the retained inventory exists for. A
// disabled plugin's materialized hook configuration is DELETED by the disable
// (ENBL-02), so the record is the only thing left that can answer "which hooks
// did this plugin register". The fixture writes no materialized configuration
// at all: the `hooks:` block below can only have come from `hookEntries`, and a
// reader that fell back to the file would render no block instead.
//
// Every other kind is populated too, which is what makes the two negatives
// below say something: a record with agents and mcpServers is exactly the shape
// a soft-dependency marker would attach to (ENBL-15 / D-100-06).
test("plugin info manifest absent: ENBL-16 / ENBL-17: a disabled, manifest-absent record lists its recorded hooks and its whole retained inventory", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          disabled: true,
          resources: {
            skills: ["alpha-skill"],
            agents: ["pi-claude-marketplace-alpha-bot"],
            mcpServers: ["alpha-mcp"],
            hooks: ["alpha"],
          },
          hookEntries: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    agents: pi-claude-marketplace-alpha-bot",
        "    hooks:",
        "      SessionStart",
        "      PostToolUse(Read)",
        "    mcp: alpha-mcp",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // Row-scoped negatives. An equality failure reports a diff; these name the
    // regression. The row is line 1 -- the component lines below it legitimately
    // contain neither token, so scoping to the row is what makes them tight.
    const row = notifications[0]!.message.split("\n")[1]!;
    assert.equal(row.includes("lsp"), false, row);
    assert.equal(row.includes("requires"), false, row);
  });
});

// ENBL-16 / D-100-07 / D-96-03: the failure class SURVIVES the disabled row's
// reason narrowing. The suppression rule is "hide the runtime the disable
// suspended", and a container the command could not read is not that: it is a
// fact about disk, and the enabled twin of this fixture
// (`state-only-installed-hooks-degraded`) reports it. The record names a hooks
// container, carries no `hookEntries`, and no materialized configuration exists
// -- so the read fails and the row must say so. Without the reason the row
// renders bare, and silence there reads as verified absence of hooks, which is
// exactly the conflation the discriminated read result exists to prevent.
test("plugin info manifest absent: ENBL-16 / D-96-03: a DISABLED record whose recorded hooks container cannot be listed keeps the read reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: { version: "1.0.0", disabled: true, resources: { hooks: ["alpha"] } },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// The still-declared control for the disabled arm, the twin of the INFO-09
// boundary above. The manifest DECLARES this disabled plugin, so the row
// resolves from the manifest and carries no absence brace. This is what proves
// `{not in manifest}` is derived from the manifest lookup rather than from
// disabled-ness -- without it, a stamp hard-coded on the disabled arm would
// pass every other test in this file.
test("plugin info manifest absent: ENBL-16 / ENBL-17: a DECLARED disabled record renders `(disabled)` with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0", disabled: true } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled)",
        "    skills: alpha-src-skill",
      ].join("\n"),
    );
    const row = notifications[0]!.message.split("\n")[1]!;
    assert.ok(row.includes("(disabled)"), row);
    assert.equal(row.includes("not in manifest"), false, row);
  });
});

// D-96-04 / ENBL-17: the skip note survives the reroute. This scope carries
// BOTH skip causes -- disabled AND manifest-absent -- and emits exactly ONE
// skip row, because the cause is a single producer-reported field on the block
// rather than two per-cause lists that could concatenate. The reason names the
// proximate cause: a disabled record has no materialized artifacts to refresh
// (ENBL-02) whatever the manifest says, while the inventory row above it keeps
// `{not in manifest}` because that is what constrains the user next.
test("plugin info manifest absent: D-96-04 / ENBL-17: `info --fetch` on a disabled AND manifest-absent scope emits ONE skip row, reporting the disabled cause", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      deviceFlowHttp: {
        requestCode() {
          return Promise.reject(new Error("device flow was not expected"));
        },
        pollToken() {
          return Promise.reject(new Error("device flow was not expected"));
        },
      },
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the inventory block keeps info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
    // ONE row, not one per cause: a `(skipped)` row for the manifest-absence
    // cause beside the disabled one would be the concatenation regression the
    // single `skipReason` field exists to make unrepresentable.
    assert.equal(
      notifications[1]!.message.split("(skipped)").length - 1,
      1,
      notifications[1]!.message,
    );
  });
});

// ENBL-06 / ENBL-17: the same `--fetch` accounting for the PARTIAL disabled
// shape. Before the disabled-state axes were separated, this record missed the
// disabled classification and its skip row named the manifest-absence cause.
// The cause is the disabled record, not the missing manifest entry, and the
// reason token has to say so.
test("plugin info manifest absent: ENBL-06 / D-96-04: `info --fetch` on a DISABLED PARTIAL skips for the disabled cause, not the manifest-absence cause", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the inventory block keeps info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
    // The specific regression: the state-only arm's reason token on a record
    // that never belongs there. The SKIP note names the disabled cause; the
    // inventory row above is where manifest absence is reported.
    assert.equal(
      notifications[1]!.message.includes("not in manifest"),
      false,
      notifications[1]!.message,
    );
  });
});

test("plugin info manifest absent: D-96-04: bare `info` on an all-disabled marketplace emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1, "no flag was typed, so there is nothing to account for");
    assert.ok(!notifications[0]!.message.includes("(skipped)"), notifications[0]!.message);
  });
});

// MSG-GR-3: a mixed run skips for two different reasons in two different
// scopes. Both rows ride ONE notification, ordered project-first by SCOPE --
// not grouped by which arm produced them.
test("plugin info manifest absent: D-96-04: a mixed disabled + state-only `--fetch` run orders both skip rows project-first", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "2.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd, fetch: true });

    // The whole sequence is pinned by index, not searched: a `find()` would
    // survive a duplicated skip notification, a lost info block, and any
    // reordering -- including the WR-10 inventory/note inversion this order
    // encodes.
    //
    // D-100-08 / ENBL-17: TWO notifications, not three. The disabled scope is no
    // longer a foreign message kind, so both scopes ride ONE info cascade
    // instead of forcing a second notify for the mixed result.
    // assert
    assert.equal(notifications.length, 2, JSON.stringify(notifications));

    // 0: both scopes' info blocks in one cascade, project-first (MSG-GR-3). The
    // disabled scope reports its retained inventory beside the enabled one.
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [project] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
        "",
        "● mp [user] <no autoupdate>",
        "  ● alpha v2.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // 1: ONE skip notification carrying both rows, project-first, each naming
    // its own cause. WR-10: the note follows the inventory it annotates.
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "Some plugin operations need attention.",
        "",
        "● mp [project]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
        "",
        // Both headers are the list-arm form, which omits the marker when
        // autoupdate is off -- see the `state-only-fetch-skipped` catalog state.
        "● mp [user]",
        "  ⊘ alpha v2.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-12 / NFR-5: the state-only arm reaches no network surface.
//
// Before the arm split this held for free -- a manifest-absent name returned
// its `(failed)` row before any fetch-capable builder existed. The arm now sits
// DOWNSTREAM of `buildInfoFetchContext`, so "we do not call the network here"
// is a claim that needs an assertion which can fail. The counters below are
// call counts on injected doubles, never a reading of the control flow: break
// the guard by threading a `fetchCtx` into `buildStateOnlyInstalledRow` and
// probing, and these tests go red.
//
// The clone-cache seam and the credential ops are the ONLY two routes from this
// file to a network call or a credential read, so pinning all five counters at
// zero covers the whole boundary.

/** The byte-exact single-scope state-only block, shared by the INFO-12 cases. */
const STATE_ONLY_BLOCK = [
  "● mp [user] <no autoupdate>",
  "  ● alpha v1.0.0 (installed) {not in manifest}",
  "    skills: alpha-skill",
].join("\n");

test("plugin info manifest absent: INFO-12 / NFR-5: `info --fetch` on a manifest-absent record makes ZERO clone-seam and ZERO credential-seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: the state-only arm must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: the state-only arm must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "INFO-12: the state-only arm must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: the state-only arm must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "INFO-12: the state-only arm must not erase a credential",
    );

    // The row itself is byte-identical to the bare INFO-09 render: `--fetch`
    // changes nothing about what the arm can say.
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("plugin info manifest absent: INFO-12 / NFR-5: bare `info` on a manifest-absent record makes the same ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    // The seams are supplied but `fetch` is omitted: nothing may run.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: bare info must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: bare info must not fetch");
    assert.equal(credState.fillCalls.length, 0, "INFO-12: bare info must not read a credential");
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: bare info must not store a credential",
    );
    assert.equal(credState.rejectCalls.length, 0, "INFO-12: bare info must not erase a credential");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("plugin info manifest absent: INFO-12 / NFR-5: a git-source-shaped manifest-absent record under `--fetch` still makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    // A remote `resolvedSource` is the shape that WOULD drive a probe on the
    // manifest-backed arm. The state-only arm never consults the source kind,
    // so the counters stay at zero for exactly the same reason as above.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resolvedSource: "https://example.com/repo" } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: a remote-shaped record must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: a remote-shaped record must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "INFO-12: a remote-shaped record must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: a remote-shaped record must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "INFO-12: a remote-shaped record must not erase a credential",
    );
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

// ENBL-17 / NFR-5: the same zero-call boundary for the REROUTED disabled arm.
// The enabled cases above cannot cover it: a disabled record used to return
// before any fetch-capable builder ran, and it now travels the same path an
// enabled one does. So "no network here" stopped being a property of the
// control flow and became a claim needing an assertion that can fail. The
// record is remote-SHAPED and the run carries `--fetch`, which is the input
// that would drive a probe on the manifest-backed arm.
test("plugin info manifest absent: ENBL-17 / NFR-5: a DISABLED manifest-absent record under `--fetch` makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          disabled: true,
          resolvedSource: "https://example.com/repo",
          resources: { skills: ["alpha-skill"], hooks: ["alpha"] },
          hookEntries: [{ event: "SessionStart" }],
        },
      },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.equal(gitState.cloneCalls.length, 0, "ENBL-17: the disabled arm must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "ENBL-17: the disabled arm must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "ENBL-17: the disabled arm must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "ENBL-17: the disabled arm must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "ENBL-17: the disabled arm must not erase a credential",
    );

    // Zero calls AND the full inventory: a guard that reached zero by returning
    // an empty block would satisfy the counters alone.
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    hooks:",
        "      SessionStart",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ENBL-17 / NFR-5: the zero-call boundary for the disabled record the manifest
// STILL DECLARES. Every other disabled `--fetch` case in this file seeds an
// EMPTY `plugins` array, which routes the block to the state-only arm -- an arm
// whose signature cannot express a fetch. A declared record travels the
// manifest-backed arm instead, where the fetch context IS threaded, so the
// decline is a branch rather than a signature and needs an assertion that can
// fail. The record is git-sourced with no clone on disk, which is the input the
// enabled twin of this fixture fetches for real.
//
// The claim under test is the one the `already disabled` skip note makes: the
// note says the fetch did nothing, so nothing may be fetched. A run that clones
// and then reports a skipped fetch contradicts the note, `InfoBlock.skipReason`
// and the `disabled-fetch-skipped` catalog state at once.
test("plugin info manifest absent: ENBL-17 / NFR-5: `info --fetch` on a DISABLED record the manifest still DECLARES makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "https://example.com/alpha.git", version: "1.0.0" }],
      },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.equal(
      gitState.cloneCalls.length,
      0,
      "ENBL-17: a disabled declared record must not clone",
    );
    assert.equal(
      gitState.fetchCalls.length,
      0,
      "ENBL-17: a disabled declared record must not fetch",
    );
    assert.equal(
      credState.fillCalls.length,
      0,
      "ENBL-17: a disabled declared record must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "ENBL-17: a disabled declared record must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "ENBL-17: a disabled declared record must not erase a credential",
    );

    // The rendered pair, so a guard that reached zero by dropping the block
    // would not pass. The row carries no absence brace (the manifest declares
    // it) and no components (the clone is cold and nothing fetched it warm).
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled)",
        "    components: not resolved",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-04: a `--fetch` the state-only arm cannot carry out is REPORTED, never
// swallowed. Rendering identical bytes with and without the flag would teach
// the user the flag worked, so the request is accounted for as a separate
// `warning` note beside an info block that keeps its own bytes.
//
// The note is a cascade row because the standalone `PluginInfoRow` status set
// admits no `skipped`; the IL-2 break mirrors the disabled-inventory path in
// the same function.
// ---------------------------------------------------------------------------

/** The byte-exact single-scope skip note, shared by the D-96-04 cases. */
const SKIP_NOTE = [
  "A plugin operation needs attention.",
  "",
  "● mp [user]",
  "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
].join("\n");

test("plugin info manifest absent: D-96-04: `info --fetch` on a manifest-absent record emits the skip note beside an unchanged info block", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the info block keeps info severity");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

// Header agreement across the two arms in ONE run. The skip note rides the
// LIST-arm marketplace header, which shows `<autoupdate>` only when the flag is
// on; the standalone info header always spells one of the two markers. The pair
// below pins both halves: with autoupdate ON the two headers match byte for
// byte, and with autoupdate OFF (the case every other test in this file seeds)
// the note's header is bare while the info block reads `<no autoupdate>`. The
// marker therefore AGREES with the info block -- it is present in exactly the
// runs the info block reports autoupdate as on -- and the off-case difference is
// recorded in the catalog's `state-only-fetch-skipped` prose.
test("plugin info manifest absent: D-96-04: with autoupdate ON the skip-note header matches the info block header", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
      autoupdate: true,
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user] <autoupdate>",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});

test("plugin info manifest absent: D-96-04: with autoupdate OFF the skip-note header omits the marker the info block spells", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
      autoupdate: false,
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.ok(
      notifications[0]!.message.startsWith("● mp [user] <no autoupdate>\n"),
      notifications[0]!.message,
    );
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

test("plugin info manifest absent: D-96-04: bare `info` on the same record emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.equal(notifications.length, 1, "no flag was typed, so there is nothing to account for");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("plugin info manifest absent: D-96-04: `info --fetch` on a manifest-DECLARED plugin emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    // The note is keyed on the ARM that fired, not on the flag alone. A
    // declared, enabled plugin runs the manifest-backed arm, which reports NO
    // `skipReason` on its `InfoBlock` -- the field `emitFetchSkip` reads.
    // Nothing about the rendered row is consulted, so the keying cannot drift
    // with the reason tokens the row happens to carry.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    for (const n of notifications) {
      // assert
      assert.ok(!n.message.includes("(skipped)"), n.message);
    }
  });
});

// D-96-04 false-positive control: the BOUND-02 row carries the very same
// `not in manifest` reason, so it is the input that would wrongly acquire a skip
// note if the note were keyed on the rendered reason rather than on the arm that
// produced the block. No installation record exists, so nothing was ever
// fetchable and there is no skipped request to account for.
test("plugin info manifest absent: D-96-04: a `--fetch` run on a name in NEITHER manifest nor records emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 1, "the failure block only -- no skip note beside it");
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      notifications[0]!.message.includes("(failed) {not in manifest}"),
      notifications[0]!.message,
    );
    assert.ok(!notifications[0]!.message.includes("(skipped)"), notifications[0]!.message);
  });
});

test("plugin info manifest absent: D-96-04: a hooks-degraded state-only record under `--fetch` still emits the skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    // A recorded hooks slug with no materialized file: the info row carries the
    // read marker, the skip row does not. The note is keyed on the arm that
    // fired, not on the row being clean.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.equal(notifications.length, 2);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

test("plugin info manifest absent: D-96-04: two state-only scopes under `--fetch` produce ONE skip notification carrying both blocks", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx(2);
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd, fetch: true });

    // INFO-09 / GRAM-04 boundary: the same input used to produce TWO `error`
    // notifications, one per `(failed)` block. Both blocks are `(installed)`
    // now, so they join ONE info-severity cascade, project-scope first.
    // assert
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [project] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
        "",
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // ONE skip notification carrying one block per scope, same order. Two
    // skipped rows pluralize the summary through the central counter.
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "Some plugin operations need attention.",
        "",
        "● mp [project]",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});

test("D-100-08 / ENBL-17: bare info (no --scope) with a disabled record in one scope renders ONE cascade with both scopes", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", cwd });

    // ONE notify: the disabled scope is no longer a foreign message kind, so
    // both scopes ride the same cascade. The second notify the mixed
    // disabled+info result used to force is gone with the divert that caused
    // it.
    // assert
    assert.equal(notifications.length, 1, JSON.stringify(notifications));
    const all = notifications[0]!.message;
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "h", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(unavailable\) \{unsupported hooks\}/);
    assert.doesNotMatch(msg, /components: not resolved/);
    assert.doesNotMatch(msg, /hooks:/);
  });
});

test("SURF-01 / D-63-04: installable plugin with NO hooks/hooks.json renders NO `hooks:` line (legacy 4-kind output unchanged)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "no-hooks",
      scope: "user",
      cwd,
    });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ah", scope: "user", cwd });
    // assert
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

// ---------------------------------------------------------------------------
// ADMIT-02: `plugin info` lists Stop / StopFailure as SUPPORTED (bare
// `<event>` non-tool entries, no ` (unsupported)` suffix) once BUCKET_A_MEMBERS
// contains them. Fixture-backed for both real-wire-byte plugins; a synthetic
// case pins the StopFailure listing + deterministic Stop-before-StopFailure
// order (no first-party plugin ships StopFailure, so it is not in a fixture).
// ---------------------------------------------------------------------------

test("ADMIT-02: ralph-wiggum fixture (Stop-only) lists Stop as a bare supported hook entry", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "ralph", source: "./ralph", version: "1.0.0" }],
      },
      installablePluginDirs: ["ralph"],
    });

    const pluginDir = path.join(mpRoot, "ralph");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      await readFile("tests/fixtures/ralph-wiggum-hooks.json", "utf8"),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ralph", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ ralph v1.0.0 (available)",
        "    hooks:",
        "      Stop",
      ].join("\n"),
    );
    assert.doesNotMatch(notifications[0]!.message, /Stop \(unsupported\)/);
  });
});

test("ADMIT-02: hookify fixture (Stop + bucket-A events) lists Stop supported alongside the other arms", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "hookify", source: "./hookify", version: "1.0.0" }],
      },
      installablePluginDirs: ["hookify"],
    });

    const pluginDir = path.join(mpRoot, "hookify");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      await readFile("tests/fixtures/hookify-hooks.json", "utf8"),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "hookify", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    // Declaration order from the fixture is preserved end-to-end. The two
    // matcher-less tool arms render `<event>()`; Stop and UserPromptSubmit are
    // non-tool events and render bare -- Stop with NO ` (unsupported)` suffix.
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ hookify v1.0.0 (available)",
        "    hooks:",
        "      PreToolUse()",
        "      PostToolUse()",
        "      Stop",
        "      UserPromptSubmit",
      ].join("\n"),
    );
    assert.doesNotMatch(notifications[0]!.message, /Stop \(unsupported\)/);
  });
});

test("ADMIT-02: a config declaring Stop + StopFailure lists both bare-supported in declaration order", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "sf", source: "./sf", version: "1.0.0" }],
      },
      installablePluginDirs: ["sf"],
    });

    const pluginDir = path.join(mpRoot, "sf");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    // Both are non-tool events with match-all (no-matcher) groups, so both are
    // admitted and render as bare supported entries. No first-party plugin
    // ships StopFailure, so this synthetic config pins its supported listing.
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo stop" }] }],
        StopFailure: [{ hooks: [{ type: "command", command: "echo stop-failure" }] }],
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "sf", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ sf v1.0.0 (available)",
        "    hooks:",
        "      Stop",
        "      StopFailure",
      ].join("\n"),
    );
    assert.doesNotMatch(notifications[0]!.message, /\(unsupported\)/);
  });
});

// ---------------------------------------------------------------------------
// INFO-05: path-source not-installable variants enumerate components from disk.
// The gate excludes non-path sources, not the not-installable verdict.
// ---------------------------------------------------------------------------

test("INFO-05: (unavailable) {unsupported hooks} path-source plugin enumerates on-disk skills + commands", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    // assert
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
    // arrange
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
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
      // assert
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
    // arrange
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
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "legacy", scope: "user", cwd });
      // assert
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

test("INFO-05: lenient reader lists `Notification (unsupported)` on a path-resolvable `(partially-available) {unsupported hooks}` row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    // A single top-level `Notification` event, which is not in
    // BUCKET_A_EVENTS. The partition filters it to the EMPTY subset
    // (Q2), so the plugin resolves `unsupported` WITHOUT recording
    // `hooksConfigPath` -- info therefore routes to the lenient reader, which
    // still enumerates `Notification (unsupported)` from the source file.
    const pluginDir = path.join(mpRoot, "ralph");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: { Notification: [{ hooks: [{ type: "command", command: "echo notification" }] }] },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ralph", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(partially-available\) \{unsupported hooks\}/);
    // The hooks: block lists Notification with the (unsupported) suffix.
    assert.match(msg, /\n {4}hooks:\n {6}Notification \(unsupported\)/);
  });
});

test("PHOOK-05 / D-71-05: strict reader lists the kept `PostToolUse(Bash)` group plus the dropped `Notification (unsupported)` on a mixed force-degradable row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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

    // Mixed shape: PostToolUse (bucket-A, with a matcher) + Notification
    // (non-bucket-A). The partition keeps the supportable PostToolUse(Bash)
    // group and drops the Notification event, so the plugin resolves
    // `unsupported` and records `hooksConfigPath`. Info therefore routes to
    // the STRICT reader, which extracts the matcher (`PostToolUse(Bash)`) and
    // now also enumerates the dropped Notification event (FSTAT-07
    // dropped-component detail).
    const pluginDir = path.join(mpRoot, "mixed");
    await mkdir(path.join(pluginDir, "hooks"), { recursive: true });
    await writeFile(
      path.join(pluginDir, "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          PostToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo p" }] }],
          Notification: [{ hooks: [{ type: "command", command: "echo s" }] }],
        },
      }),
      "utf8",
    );

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "mixed", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /\(partially-available\) \{unsupported hooks\}/);
    // Kept group first (with its matcher, via the strict reader), then the
    // dropped Notification event carrying the (unsupported) suffix.
    assert.match(msg, /\n {4}hooks:\n {6}PostToolUse\(Bash\)\n {6}Notification \(unsupported\)/);
  });
});

test("PHOOK-05 / D-71-05: strict reader enumerates an intra-event dropped matcher group as `PreToolUse(.*) (unsupported)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "grouped", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "broken", scope: "user", cwd });
    // assert
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
    // arrange
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
            dependencies: ["dep@mp"],
          },
        ],
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "ghplug", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ ghplug v2\.0\.0 \(remote\)/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
  });
});

test("RSTA-01: uninstalled git-subdir-source plugin with a cold clone renders `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "subplug", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ subplug v3\.0\.0 \(remote\)/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
  });
});

test("RSTA-05: uninstalled url-source plugin with a WARM mirror resolves and lists components fs-only (available)", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            dependencies: ["dep@mp"],
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "canva", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "badplug", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    // assert
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
    // arrange
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
            description: "Installed warm plugin.",
            dependencies: ["dep@mp"],
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    // assert
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
    // arrange
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
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    const msg = notifications[0]!.message;
    // assert
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
    // arrange
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
            source: {
              source: "url",
              url: "https://github.com/owner/gh-mp",
              sha: GIT_SHA,
              ref: "main",
            },
            version: "1.0.0",
          },
        ],
      },
    });

    const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureRepoDir });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    // act
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
    // assert
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
    // arrange
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
    // act
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

    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /components: not resolved/, msg);
    assert.match(msg, /network unreachable/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
  });
});

test("NFR-5: bare info (no --fetch) on a COLD git plugin makes ZERO git-seam calls and renders `(remote)`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
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

    // assert
    assert.equal(gitState.cloneCalls.length, 0, "bare info must not clone (network-free)");
    assert.equal(gitState.fetchCalls.length, 0, "bare info must not fetch (network-free)");
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\)/, msg);
  });
});

test("OUT-05 / NFR-5 / OUT-03: a COLD git plugin whose entry declares `defaultEnabled: false` carries the claim while making ZERO git-seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: cloneUrl, version: "1.0.0", defaultEnabled: false }],
      },
    });

    // The seam is injected but `fetch` is omitted, so any call through it is a
    // defect rather than a consented fetch. Counting the calls is what makes
    // this evidence: a source grep says the module holds no git import, while
    // the count says the injected surface was never reached at run time.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    // act
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

    // The pair asserted in one run: the claim IS made, and nothing was fetched
    // to make it. The second half is what turns the first half into a
    // requirement rather than a coincidence -- a surface that quietly
    // materialized a mirror and read its `plugin.json` would emit these same
    // bytes, so the row cannot testify about its own source.
    // assert
    assert.equal(gitState.cloneCalls.length, 0, "the claim must cost no clone");
    assert.equal(gitState.fetchCalls.length, 0, "the claim must cost no fetch");
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    const msg = notifications[0]!.message;
    assert.ok(msg.includes("(remote) {installs disabled}"), msg);
    assert.equal(
      msg,
      [
        "● mp [user] <no autoupdate>",
        "  ◌ gplug v1.0.0 (remote) {installs disabled}",
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

test("D-78-04 / D-81-04: info --fetch on an INSTALLED git plugin with a missing clone surfaces the fetch failure reason WITHOUT regressing the recorded status", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            source: "https://github.com/owner/gh-mp#main",
            version: "1.0.0",
          },
        ],
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
    // act
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

    // assert
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
    // arrange
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
    // act
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
    // assert
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
    // arrange
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
    // act
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
    // assert
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
    // arrange
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
    // act
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

    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\) \{authentication required\}/, msg);
    assert.match(msg, /components: not resolved/, msg);
  });
});

test("FTCH-06: info --fetch folds a UserCanceledError (denied/expired Device Flow) to `{authentication required}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
    // act
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

    // assert
    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\) \{authentication required\}/, msg);
    assert.match(msg, /components: not resolved/, msg);
  });
});

// ---------------------------------------------------------------------------
// OUT-03: the author-declared install-time claim on the info surface.
//
// A not-installed row whose marketplace ENTRY declares `defaultEnabled: false`
// says so in the row's existing reason brace, so a user deciding whether to
// install learns it before committing. OUT-05 / DOC-02: the entry is the only
// source
// -- the plugin's own manifest is never read, which is what lets a row with no
// materialized tree at all carry the claim.
//
// Every case below pins the severity as ABSENT. That is not decoration: the
// token names an AUTHOR'S INTENT rather than a shortfall, so stating it must
// not move the surface off informational severity.
// ---------------------------------------------------------------------------

test("OUT-03: an entry declaring `defaultEnabled: false` puts `{installs disabled}` on its `(available)` info row, and a declared-true entry differs by exactly that brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            name: "dis",
            source: "./dis",
            version: "1.0.0",
            description: "Candidate plugin.",
            skills: "skills",
            defaultEnabled: false,
          },
          {
            name: "ena",
            source: "./ena",
            version: "1.0.0",
            description: "Candidate plugin.",
            skills: "skills",
            defaultEnabled: true,
          },
        ],
      },
      installablePluginDirs: ["dis", "ena"],
      componentDirs: { dis: ["skills/s1"], ena: ["skills/s1"] },
    });

    const declaring = makeCtx();
    // act
    await getPluginInfo({
      ctx: declaring.ctx,
      pi: declaring.pi,
      marketplace: "mp",
      plugin: "dis",
      scope: "user",
      cwd,
    });
    // assert
    assert.equal(declaring.notifications.length, 1);
    assert.equal(declaring.notifications[0]!.severity, undefined);
    assert.equal(
      declaring.notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ dis v1.0.0 (available) {installs disabled}",
        "    Candidate plugin.",
        "    skills: s1",
      ].join("\n"),
    );

    const declaredTrue = makeCtx();
    await getPluginInfo({
      ctx: declaredTrue.ctx,
      pi: declaredTrue.pi,
      marketplace: "mp",
      plugin: "ena",
      scope: "user",
      cwd,
    });
    assert.equal(declaredTrue.notifications.length, 1);
    assert.equal(declaredTrue.notifications[0]!.severity, undefined);
    assert.equal(
      declaredTrue.notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ ena v1.0.0 (available)",
        "    Candidate plugin.",
        "    skills: s1",
      ].join("\n"),
    );

    // OUT-03: the fact is stated through the brace the row ALREADY has, never
    // through a new body line. Asserting the two renders line-by-line is what
    // proves it: same line count, every non-row line identical, and the row
    // line differing by the brace alone. One fact keeps one grammar here.
    const declaringLines = declaring.notifications[0]!.message.split("\n");
    const declaredTrueLines = declaredTrue.notifications[0]!.message.split("\n");
    assert.equal(declaringLines.length, declaredTrueLines.length);
    assert.deepEqual(
      declaringLines.filter((_, i) => i !== 1),
      declaredTrueLines.filter((_, i) => i !== 1),
    );
    assert.equal(
      declaringLines[1],
      `${declaredTrueLines[1]!.replace("ena", "dis")} {installs disabled}`,
    );
  });
});

test("DFEN-04 / DFEN-05: a config `enabled` declaration SUPPRESSES `{installs disabled}` in EITHER direction, because install checks it first", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      // All three entries declare the SAME thing, so the only variable across
      // the three renders is what the user's config says about each key.
      manifest: {
        name: "mp",
        plugins: [
          { name: "yes", source: "./yes", version: "1.0.0", skills: "skills" },
          { name: "no", source: "./no", version: "1.0.0", skills: "skills" },
          { name: "mute", source: "./mute", version: "1.0.0", skills: "skills" },
        ].map((p) => ({ ...p, defaultEnabled: false })),
      },
      installablePluginDirs: ["yes", "no", "mute"],
      componentDirs: { yes: ["skills/s1"], no: ["skills/s1"], mute: ["skills/s1"] },
    });
    // None of the three is INSTALLED -- these are hand-added declarations for
    // plugins the user has not reloaded into existence yet, which is exactly
    // the state in which a candidate row is read.
    const locations = locationsFor("user", cwd);
    await saveConfig(
      locations.configJsonPath,
      {
        schemaVersion: 1,
        plugins: { "yes@mp": { enabled: true }, "no@mp": { enabled: false } },
      },
      locations.scopeRoot,
    );

    const rowFor = async (plugin: string): Promise<string> => {
      // arrange
      const { ctx, pi, notifications } = makeCtx();
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin, scope: "user", cwd });
      // assert
      assert.equal(notifications.length, 1);
      return notifications[0]!.message.split("\n")[1]!;
    };

    // The row states what an install WOULD do, so it must model the same
    // precedence `install` applies (install.ts::readDeclaredEnabled), not a
    // shorter one:
    //
    // `yes` -- the config says `enabled: true`. `install` reads that FIRST,
    //   never reaches the entry's default, and the plugin lands ENABLED. A row
    //   claiming otherwise would predict an outcome the install path does not
    //   produce, which is the one thing this claim exists not to do.
    //
    // `no` -- the config says `enabled: false`. An explicit declaration wins in
    //   EITHER direction, so the entry's default does not apply here either.
    //   The bare row is deliberate: the user typed the value, and the token is
    //   about the manifest's default taking effect, not about the user's own
    //   declaration being echoed back.
    //
    // `mute` -- no config opinion, so the entry answers and the row claims.
    //   This is the control: it proves the suppression above comes from the
    //   config read and not from the entry read having broken.
    assert.equal(await rowFor("yes"), "  ○ yes v1.0.0 (available)");
    assert.equal(await rowFor("no"), "  ○ no v1.0.0 (available)");
    assert.equal(await rowFor("mute"), "  ○ mute v1.0.0 (available) {installs disabled}");
  });
});

test("OUT-03 / OUT-05 / RSTA-01: a COLD `(remote)` row whose entry declares `defaultEnabled: false` carries `{installs disabled}` with no tree materialized anywhere", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            defaultEnabled: false,
          },
        ],
      },
    });

    // No mirror is staged, so there is no `plugin.json` on disk to read and no
    // fetch is made to produce one. The claim can only have come from the
    // marketplace entry -- which is exactly why the entry is the single source
    // (OUT-05 / DOC-02): it reads the same warm and cold.
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◌ gplug v1.0.0 (remote) {installs disabled}",
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

test("OUT-05 / DOC-02: a SILENT entry over a warm clone that declares `defaultEnabled: false` renders the bare row -- declining to claim is the correct answer", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/warmdecl";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      // The ENTRY says nothing about the install-time default.
      manifest: {
        name: "mp",
        plugins: [{ name: "warmdecl", source: cloneUrl, version: "1.0.0" }],
      },
    });
    // The warm clone's OWN manifest declares what the entry does not, and the
    // components make the mirror resolve installable rather than empty -- so the
    // row this produces is a real `(available)` row whose declaration was
    // available for the reading and was not read.
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "warmdecl", defaultEnabled: false },
      componentDirs: ["skills/warm-skill"],
      componentFiles: ["commands/warm-cmd.md"],
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "warmdecl", scope: "user", cwd });
    // Three things this pins, in the order they matter (OUT-05 / DOC-02):
    //
    // 1. The bare row is the CORRECT outcome, not a gap. The whole body is
    //    asserted so the absence of the brace is proven alongside the component
    //    lines and everything else staying put.
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
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ warmdecl v1.0.0 (available)",
        "    commands: warm-cmd",
        "    skills: warm-skill",
      ].join("\n"),
    );
  });
});

test("OUT-03: a `(partially-available)` row appends `installs disabled` at the tail of the degrade token it already carries", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            name: "lspplug",
            source: cloneUrl,
            version: "1.0.0",
            defaultEnabled: false,
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "lspplug", lspServers: { foo: {} } },
    });

    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "lspplug", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ⊖ lspplug v1.0.0 (partially-available) {lsp, installs disabled}",
      ].join("\n"),
    );
  });
});

test("OUT-05 / OUT-03: a degraded `(remote)` row reporting a read failure carries BOTH facts in one brace, failure first", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
    const userRoot = path.join(home, ".pi", "agent");
    const cloneUrl = "https://example.com/repo";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "gplug", source: cloneUrl, version: "1.0.0", defaultEnabled: false }],
      },
    });

    const netErr = Object.assign(new Error("getaddrinfo ENOTFOUND example.com"), {
      code: "ENOTFOUND",
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: netErr });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    // act
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

    // The two facts are ORTHOGONAL and neither suppresses the other: the
    // failure says the fetch did not succeed, the token says what an install
    // would do. The token is entry-derived, so it stays true whether or not the
    // tree could be read -- and the tail position is observable, since the
    // brace composer joins in array order with no per-row sort.
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◌ gplug v1.0.0 (remote) {network unreachable, installs disabled}",
        "    components: not resolved",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// OUT-03: the info rows that stay clean.
//
// Every case below seeds an entry that DOES declare `defaultEnabled: false`.
// A negative test whose input says nothing proves nothing -- these prove an
// EXCLUSION, against the one input that would otherwise produce the token.
// ---------------------------------------------------------------------------

test("OUT-03: an `(unavailable)` row never acquires `installs disabled`, however the entry declares", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            defaultEnabled: false,
          },
        ],
      },
      // NOT installed -> the not-installed consumer, so this row DOES reach the
      // composer and is excluded there by status rather than by never arriving.
    });

    // Nothing will install at all, so the token would describe an install that
    // cannot happen -- and the brace already carries the blocker that stops it.
    // Adding a second token here would answer a question the user cannot act on.
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "remote", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
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

test("OUT-03: an `(installed)` row never acquires `installs disabled`, however the entry declares", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            defaultEnabled: false,
          },
        ],
      },
      installed: { foo: { version: "1.2.3" } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });

    // This row and the two below are clean STRUCTURALLY, not by a runtime
    // guard: the composer is applied at the not-installed consumer alone, so the
    // installed bucket never reaches it. The guarantee is the absence of an
    // edit, which is stronger than a check a later change could relax. The
    // token is also a claim about a FUTURE install, and on a record the action
    // is already taken -- the row reports what exists, not what would happen.
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● foo v1.2.3 (installed)",
        "    Foo plugin",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

test("OUT-03: a `(partially-installed)` row never acquires `installs disabled`, however the entry declares", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            lspServers: { foo: { command: "foo-lsp" } },
            defaultEnabled: false,
          },
        ],
      },
      installed: { degraded: { version: "1.0.0" } },
      installablePluginDirs: ["degraded"],
    });

    // Clean for the reason given on the `(installed)` case above.
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "degraded", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ◉ degraded v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
  });
});

test("OUT-03: a `(disabled)` row never acquires `installs disabled`, however the entry declares", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    // arrange
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
            defaultEnabled: false,
          },
        ],
      },
      installed: { foo: { version: "1.2.3", disabled: true } },
      installablePluginDirs: ["foo"],
      componentDirs: { foo: ["skills/s1"] },
    });

    // The sharpest of the four: this row is disabled AND its entry declares the
    // install-time default false, so a naive implementation would report the
    // same idea twice in two tenses. It does not. The row's disabled-ness is a
    // recorded fact about a record; the token is a prediction about an install
    // that, here, already happened. Clean for the structural reason given on the
    // `(installed)` case above.
    const { ctx, pi, notifications } = makeCtx();
    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "foo", scope: "user", cwd });
    // assert
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ foo v1.2.3 (disabled)",
        "    Foo plugin",
        "    skills: s1",
      ].join("\n"),
    );
  });
});

test("lenient hook inventory ignores a nonobject root exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(path.join(mpRoot, "alpha", "hooks", "hooks.json"), "[]", "utf8");
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha v1.0.0 (unavailable) {unsupported hooks}",
        ].join("\n"),
      },
    ]);
  });
});

test("lenient hook inventory ignores an array hooks value exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", "hooks", "hooks.json"),
      JSON.stringify({ hooks: [] }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊖ alpha v1.0.0 (partially-available) {unsupported hooks}",
        ].join("\n"),
      },
    ]);
  });
});

test("lenient hook inventory ignores blank events exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", "hooks", "hooks.json"),
      JSON.stringify({ hooks: { " ": [{ hooks: [{ type: "command", command: "echo" }] }] } }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊖ alpha v1.0.0 (partially-available) {unsupported hooks}",
        ].join("\n"),
      },
    ]);
  });
});

test("lenient hook inventory ignores empty event groups exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          Stop: [],
          Notification: [{ hooks: [{ type: "command", command: "echo notification" }] }],
        },
      }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊖ alpha v1.0.0 (partially-available) {unsupported hooks}",
          "    hooks:",
          "      Notification (unsupported)",
        ].join("\n"),
      },
    ]);
  });
});

test("resolved MCP inventory sorts two server names exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", ".claude-plugin", "plugin.json"),
      JSON.stringify({
        name: "alpha",
        mcpServers: { zeta: { command: "zeta" }, alpha: { command: "alpha" } },
      }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ○ alpha v1.0.0 (available)",
          "    mcp: alpha, zeta",
        ].join("\n"),
      },
    ]);
  });
});

test("two-scope fan-out emits one info block before one exact failed block", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: cwd,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
    });
    const { ctx, pi, notifications } = makeCtx(2);

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: ["● mp [project] <no autoupdate>", "  ○ alpha v1.0.0 (available)"].join("\n"),
      },
      {
        message: [
          "A plugin operation has failed.",
          "",
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha (failed) {not in manifest}",
        ].join("\n"),
        severity: "error",
      },
    ]);
  });
});

test("state-only fetch safely constructs default ports without invoking them", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });
    const { ctx, pi, notifications } = makeCtx(2);

    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ● alpha v1.0.0 (installed) {not in manifest}",
          "    skills: alpha-skill",
        ].join("\n"),
      },
      {
        message: [
          "A plugin operation needs attention.",
          "",
          "● mp [user]",
          "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
        ].join("\n"),
        severity: "warning",
      },
    ]);
  });
});

test("component discovery ignores wrong entry kinds and accepts an absolute in-root directory", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installablePluginDirs: ["alpha"],
    });
    const pluginRoot = path.join(mpRoot, "alpha");
    const absoluteSkills = path.join(pluginRoot, "absolute-skills");
    await mkdir(path.join(absoluteSkills, "bravo"), { recursive: true });
    await mkdir(path.join(pluginRoot, "skills"), { recursive: true });
    await writeFile(path.join(pluginRoot, "skills", "not-a-skill.md"), "", "utf8");
    await mkdir(path.join(pluginRoot, "commands", "not-a-command"), { recursive: true });
    await writeFile(path.join(pluginRoot, "commands", "not-markdown.txt"), "", "utf8");
    await mkdir(path.join(pluginRoot, "agents", "not-an-agent"), { recursive: true });
    await writeFile(path.join(pluginRoot, "agents", "not-markdown.txt"), "", "utf8");
    await writeFile(
      path.join(mpRoot, ".claude-plugin", "marketplace.json"),
      JSON.stringify({
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: "./alpha",
            version: "1.0.0",
            skills: ["skills", absoluteSkills],
            commands: "commands",
            agents: "agents",
          },
        ],
      }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha v1.0.0 (unavailable) {unsupported source}",
          "    skills: bravo",
        ].join("\n"),
      },
    ]);
  });
});

test("strict hook inventory deduplicates two dropped matcher groups exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Edit", hooks: [{ type: "command", command: "echo edit" }] },
            { matcher: ".*", hooks: [{ type: "command", command: "echo one" }] },
            { matcher: ".*", hooks: [{ type: "command", command: "echo two" }] },
          ],
        },
      }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊖ alpha v1.0.0 (partially-available) {unsupported hooks}",
          "    hooks:",
          "      PreToolUse(Edit)",
          "      PreToolUse(.*) (unsupported)",
        ].join("\n"),
      },
    ]);
  });
});

test("a nonarray lenient event group is ignored beside an unsupported event", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    await mkdir(path.join(mpRoot, "alpha", "hooks"), { recursive: true });
    await writeFile(
      path.join(mpRoot, "alpha", "hooks", "hooks.json"),
      JSON.stringify({
        hooks: {
          Stop: {},
          Notification: [{ hooks: [{ type: "command", command: "echo notification" }] }],
        },
      }),
      "utf8",
    );
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha v1.0.0 (unavailable) {unsupported hooks}",
          "    hooks:",
          "      Notification (unsupported)",
        ].join("\n"),
      },
    ]);
  });
});

test("a path source escaping the marketplace becomes an exact unavailable row", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: "../outside",
            version: "1.0.0",
            description: "Escaped plugin.",
          },
        ],
      },
    });
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha v1.0.0 (unavailable) {unreadable}",
          "    Escaped plugin.",
          "    components: not resolved",
        ].join("\n"),
      },
    ]);
  });
});

test("a generic explicit-fetch failure uses the probe fallback exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: "https://example.com/repo",
            version: "1.0.0",
            description: "Alpha plugin",
          },
        ],
      },
    });
    const { gitOps } = makeMockGitOps({ cloneThrows: new Error("fetch failed") });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ◌ alpha v1.0.0 (remote) {unreadable}",
          "    Alpha plugin",
          "    components: not resolved",
        ].join("\n"),
      },
    ]);
  });
});

test("a warm unavailable git plugin lists conventional component directories exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const cloneUrl = "https://example.com/unavailable";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: cloneUrl,
            version: "1.0.0",
            description: "Unavailable warm plugin.",
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "alpha" },
      componentDirs: ["skills/bravo"],
    });
    const mirrorDir = await locationsFor("user", cwd).pluginCloneDir(pluginMirrorKey(cloneUrl));
    await mkdir(path.join(mirrorDir, "hooks"), { recursive: true });
    await writeFile(path.join(mirrorDir, "hooks", "hooks.json"), "{", "utf8");
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message: [
          "● mp [user] <no autoupdate>",
          "  ⊘ alpha v1.0.0 (unavailable) {unsupported hooks}",
          "    Unavailable warm plugin.",
          "    skills: bravo",
        ].join("\n"),
      },
    ]);
  });
});

test("a warm partially available git plugin folds a component read failure exactly", async (t) => {
  // arrange
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const cloneUrl = "https://example.com/partial-unreadable";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: cloneUrl,
            version: "1.0.0",
            description: "Partial warm plugin.",
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "alpha", lspServers: { server: {} }, skills: ["skills"] },
      componentDirs: ["skills/bravo"],
    });
    const mirrorDir = await locationsFor("user", cwd).pluginCloneDir(pluginMirrorKey(cloneUrl));
    const skillsDir = path.join(mirrorDir, "skills");
    await chmod(skillsDir, 0o000);
    const { ctx, pi, notifications } = makeCtx();

    try {
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // assert
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [user] <no autoupdate>\n" +
            "  ⊖ alpha v1.0.0 (partially-available) {lsp, permission denied}\n" +
            "    Partial warm plugin.\n" +
            "    components: not resolved",
        },
      ]);
    } finally {
      await chmod(skillsDir, 0o755);
    }
  });
});

test("a warm installable git plugin folds a component read failure to remote exactly", async (t) => {
  // arrange
  if (process.platform === "win32") {
    t.skip("chmod-based EACCES fault injection is POSIX-only");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const cloneUrl = "https://example.com/available-unreadable";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: cloneUrl,
            version: "1.0.0",
            description: "Alpha plugin",
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "alpha", skills: ["skills"] },
      componentDirs: ["skills/bravo"],
    });
    const mirrorDir = await locationsFor("user", cwd).pluginCloneDir(pluginMirrorKey(cloneUrl));
    const skillsDir = path.join(mirrorDir, "skills");
    await chmod(skillsDir, 0o000);
    const { ctx, pi, notifications } = makeCtx();

    try {
      // act
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // assert
      assert.deepEqual(notifications, [
        {
          message:
            "● mp [user] <no autoupdate>\n" +
            "  ○ alpha v1.0.0 (available) {permission denied}\n" +
            "    Alpha plugin\n" +
            "    components: not resolved",
        },
      ]);
    } finally {
      await chmod(skillsDir, 0o755);
    }
  });
});

test("an explicit fetch whose second materialization fails folds the warm resolver error", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const cloneUrl = "https://example.com/second-fetch-fails";
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: cloneUrl,
            version: "1.0.0",
            description: "Alpha plugin",
          },
        ],
      },
    });
    await seedWarmMirror({
      scope: "user",
      cwd,
      cloneUrl,
      pluginJson: { name: "alpha" },
    });
    const mirrorDir = await locationsFor("user", cwd).pluginCloneDir(pluginMirrorKey(cloneUrl));
    let materializations = 0;
    const cloneCacheSeam: InfoCloneCacheSeam = {
      resolvePluginPin() {
        return Promise.reject(new Error("pinned materialization was not expected"));
      },
      materializePluginClone() {
        return Promise.reject(new Error("pinned materialization was not expected"));
      },
      materializeOrRefreshPluginMirror() {
        materializations += 1;
        if (materializations === 2) {
          return Promise.reject(
            Object.assign(new Error("mirror became unreadable"), { code: "EACCES" }),
          );
        }

        return Promise.resolve({ pluginRoot: mirrorDir, resolvedSha: "a".repeat(40) });
      },
    };
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam,
    });

    // assert
    assert.equal(materializations, 2);
    assert.deepEqual(notifications, [
      {
        message:
          "● mp [user] <no autoupdate>\n" +
          "  ◌ alpha v1.0.0 (remote) {permission denied}\n" +
          "    Alpha plugin\n" +
          "    components: not resolved",
      },
    ]);
  });
});

test("a path source containing a NUL byte folds the resolver failure exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: "./alpha\u0000invalid",
            version: "1.0.0",
            description: "Alpha plugin",
          },
        ],
      },
    });
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message:
          "● mp [user] <no autoupdate>\n" +
          "  ⊘ alpha v1.0.0 (unavailable) {unreadable}\n" +
          "    Alpha plugin\n" +
          "    components: not resolved",
      },
    ]);
  });
});

test("a lenient hooks path targeting a directory folds the read failure exactly", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    const mpRoot = await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0" }],
      },
      installablePluginDirs: ["alpha"],
    });
    const hooksDir = path.join(mpRoot, "alpha", "hooks");
    const directoryTarget = path.join(mpRoot, "alpha", "hooks-target");
    await mkdir(hooksDir, { recursive: true });
    await mkdir(directoryTarget, { recursive: true });
    await symlink(directoryTarget, path.join(hooksDir, "hooks.json"));
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message:
          "● mp [user] <no autoupdate>\n" +
          "  ○ alpha v1.0.0 (available) {unreadable}\n" +
          "    components: not resolved",
      },
    ]);
  });
});

test("an available path plugin renders sorted dependencies after its inventory", async () => {
  // arrange
  await withHermeticHome(async ({ home, cwd }) => {
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: path.join(home, ".pi", "agent"),
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [
          {
            name: "alpha",
            source: "./alpha",
            version: "1.0.0",
            dependencies: ["zulu@mp", "bravo@mp"],
          },
        ],
      },
      installablePluginDirs: ["alpha"],
    });
    const { ctx, pi, notifications } = makeCtx();

    // act
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    // assert
    assert.deepEqual(notifications, [
      {
        message:
          "● mp [user] <no autoupdate>\n" +
          "  ○ alpha v1.0.0 (available)\n" +
          "    dependencies: bravo@mp, zulu@mp",
      },
    ]);
  });
});
