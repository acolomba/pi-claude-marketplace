// Owner suite for orchestrators/reconcile/backfill.ts.
//
// D-115-03: backfill's contract is the state it leaves on disk, so every case
// drives the real gated re-materialize against a case-owned temporary tree and
// fakes only the git remote. `createOfflineGitOps` allows no remote at all, so
// an unexpected clone fails immediately; that refusal, not the absence of a
// call, is the NFR-5 offline proof.
//
// Backfill never renders. `reinstallPlugin` runs with `render: "none"` and the
// promotion rows fold into the caller's outcome array for the reconcile
// cascade to project (RECON-04), so every case states a notification boundary
// with no promised call: an unpromised `notify` or `getAllTools` call throws.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify } from "strong-mock";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  applyBackfillForScopeIsolated,
  runScopeIsolated,
  scanForceInstalledBackfills,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type {
  ApplyReconcileOptions,
  ScopeReadResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

/** The stamp every seeded scope carries: older than the running version, so the gate opens. */
const STALE_STAMP = "0.0.0";
const RECORDED_AT = "2026-01-01T00:00:00.000Z";
const REMATERIALIZED_AT = "2026-02-03T04:05:06.000Z";

/**
 * The single network edge. `allowedRemoteUrls` is empty, so the fake refuses
 * every remote: backfill re-resolves from the cached manifest and reinstalls
 * from the local clone, and any git reach at all fails the case (NFR-5).
 */
function createOfflineGitOps(): {
  readonly gitOps: GitOps;
  readonly clonedUrls: () => readonly string[];
} {
  const git = createGitOpsFake({ boundary: "memory", allowedRemoteUrls: [] });
  return { gitOps: git.gitOps, clonedUrls: () => git.state.calls.clone.map((call) => call.url) };
}

/**
 * Strict boundary for the Pi surfaces backfill hands to the composed
 * reinstall. No call is promised on either mock, which is the silence proof:
 * a `notify` emission or a `getAllTools` soft-dependency probe throws where it
 * is made rather than being recorded and counted afterwards.
 */
function createSilentBoundary(): {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly verifyBoundary: () => void;
} {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  return {
    ctx,
    pi,
    verifyBoundary: (): void => {
      verify(ctx);
      verify(pi);
    },
  };
}

async function createHermeticProjectScope(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly locations: ScopedLocations }> {
  const cwd = await mkdtemp(path.join(tmpdir(), `backfill-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `backfill-${label}-home-`));
  const homeExisted = Object.hasOwn(process.env, "HOME");
  const previousHome = process.env.HOME;
  const agentDirExisted = Object.hasOwn(process.env, "PI_CODING_AGENT_DIR");
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  t.after(async () => {
    if (homeExisted) {
      process.env.HOME = previousHome;
    } else {
      delete process.env.HOME;
    }

    if (agentDirExisted) {
      process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    } else {
      delete process.env.PI_CODING_AGENT_DIR;
    }

    await rm(cwd, { force: true, recursive: true });
    await rm(home, { force: true, recursive: true });
  });
  process.env.HOME = home;
  // SC-1: getAgentDir() reads PI_CODING_AGENT_DIR before homedir(), so an
  // environment that sets it would defeat the hermetic HOME above.
  delete process.env.PI_CODING_AGENT_DIR;
  return { cwd, locations: locationsFor("project", cwd) };
}

interface PluginTree {
  /** `malformed` leaves the SKILL.md frontmatter unparseable, which degrades the staged skill. */
  readonly skill?: "clean" | "malformed";
  readonly command?: boolean;
  /** `.lsp.json` convention file -- a component kind the resolver cannot support. */
  readonly lsp?: boolean;
  /** hooks.json whose kept handler carries a rewake field without `asyncRewake: true`. */
  readonly orphanRewakeHooks?: boolean;
}

async function writePluginTree(
  marketplaceRoot: string,
  plugin: string,
  tree: PluginTree,
): Promise<string> {
  const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: plugin }),
  );
  if (tree.skill !== undefined) {
    const skillDir = path.join(pluginRoot, "skills", "tool");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      tree.skill === "malformed"
        ? "---\nname: [unterminated\n---\n\nbody\n"
        : "---\nname: tool\n---\n\nbody\n",
    );
  }

  if (tree.command === true) {
    const commandDir = path.join(pluginRoot, "commands");
    await mkdir(commandDir, { recursive: true });
    await writeFile(path.join(commandDir, "deploy.md"), "# deploy\n\nbody\n");
  }

  if (tree.lsp === true) {
    await writeFile(
      path.join(pluginRoot, ".lsp.json"),
      JSON.stringify({ servers: { ts: { command: "tsserver" } } }),
    );
  }

  if (tree.orphanRewakeHooks === true) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      path.join(hooksDir, "hooks.json"),
      JSON.stringify({
        PreToolUse: [
          {
            matcher: "",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "wake me" }],
          },
        ],
      }),
    );
  }

  return pluginRoot;
}

/** Lay down the plugin trees and the cached marketplace manifest that declares them. */
async function writeMarketplaceSource(
  cwd: string,
  directory: string,
  marketplace: string,
  trees: Readonly<Record<string, PluginTree>>,
): Promise<{ readonly marketplaceRoot: string; readonly manifestPath: string }> {
  const marketplaceRoot = path.join(cwd, directory);
  for (const [plugin, tree] of Object.entries(trees)) {
    await writePluginTree(marketplaceRoot, plugin, tree);
  }

  const manifestDir = path.join(marketplaceRoot, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: Object.keys(trees).map((plugin) => ({
        name: plugin,
        version: "1.0.0",
        source: `./plugins/${plugin}`,
      })),
    }),
  );
  return { marketplaceRoot, manifestPath };
}

interface RecordSeed {
  readonly pluginRoot: string;
  readonly installable: boolean;
  readonly supported: readonly string[];
  readonly unsupported: readonly string[];
  /** ENBL-08 axis: omit for the enabled default; `false` seeds a disabled record. */
  readonly enabled?: boolean;
  /** Generated skill names the record already owns, for the cross-plugin conflict arm. */
  readonly skills?: readonly string[];
}

function pluginRecord(seed: RecordSeed): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: seed.pluginRoot,
    compatibility: {
      installable: seed.installable,
      notes: [],
      supported: [...seed.supported],
      unsupported: [...seed.unsupported],
    },
    resources: {
      skills: [...(seed.skills ?? [])],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
    },
    enabled: seed.enabled ?? true,
    installedAt: RECORDED_AT,
    updatedAt: RECORDED_AT,
  };
}

function marketplaceRecord(
  cwd: string,
  marketplace: string,
  directory: string,
  manifestPath: string,
  marketplaceRoot: string,
  plugins: Readonly<Record<string, PluginRecord>>,
): MarketplaceRecord {
  return {
    name: marketplace,
    scope: "project",
    source: pathSource(`./${directory}`),
    addedFromCwd: cwd,
    manifestPath,
    marketplaceRoot,
    plugins: { ...plugins },
  };
}

/** Write state.json under the scope's extension root, creating the root first. */
async function seedState(locations: ScopedLocations, state: ExtensionState): Promise<void> {
  await mkdir(locations.extensionRoot, { recursive: true });
  await saveState(locations.extensionRoot, state);
}

function backfillOptions(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  cwd: string,
  gitOps: GitOps,
): ApplyReconcileOptions {
  return { ctx, pi, cwd, scope: "project", gitOps };
}

function readResultFor(state: ExtensionState, stateExisted: boolean): ScopeReadResult {
  return { scope: "project", plan: undefined, invalidOutcomes: [], state, stateExisted };
}

/** A seeded scope that has been read but not re-materialized. */
function seededScopeTree(): readonly string[] {
  return ["pi-claude-marketplace/", "pi-claude-marketplace/state.json"];
}

/** The paths a promotion of both `skills` and `commands` leaves behind. */
function fullyPromotedScopeTree(): readonly string[] {
  return [
    "claude-plugins.json",
    "pi-claude-marketplace/",
    "pi-claude-marketplace/commands-staging/",
    "pi-claude-marketplace/resources/",
    "pi-claude-marketplace/resources/prompts/",
    "pi-claude-marketplace/resources/prompts/hello:deploy.md",
    "pi-claude-marketplace/resources/skills/",
    "pi-claude-marketplace/resources/skills/hello-tool/",
    "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
    "pi-claude-marketplace/skills-staging/",
    "pi-claude-marketplace/state.json",
  ];
}

describe("applyBackfillForScopeIsolated", () => {
  test("WR-05: skips a pristine scope whose read pass carried no state", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "pristine");
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const readResult: ScopeReadResult = {
      scope: "project",
      plan: undefined,
      invalidOutcomes: [],
      stateExisted: false,
    };
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResult,
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("BFILL-02: stamps the running version when the recorded stamp is older", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "stale-stamp");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {}),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-68-01: stamps the running version when no stamp is recorded at all", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "absent-stamp");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    const seeded: ExtensionState = {
      schemaVersion: 2,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {}),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-05: leaves state.json byte-identical when the recorded stamp already matches", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "gate-closed");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const seededBytes = await readFile(locations.stateJsonPath, "utf8");
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), seededBytes);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-68-03: stamps a gate-open scope that records no partially-installed plugin", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "nothing-to-promote");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: true,
            supported: ["skills"],
            unsupported: [],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-01: brings no state.json into existence for a state-file-absent scope with nothing to promote", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "no-state-file");
    await mkdir(locations.extensionRoot, { recursive: true });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    // Every recorded plugin is already fully installed, so the scan has
    // nothing to promote and the stamp is not worth a new state.json.
    const snapshot: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: true,
            supported: ["skills", "commands"],
            unsupported: [],
          }),
        }),
      },
    };
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(snapshot, false),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), ["pi-claude-marketplace/"]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-01: scans and stamps a state-file-absent scope whose snapshot records a partially-installed plugin", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "absent-but-recorded");
    await mkdir(locations.extensionRoot, { recursive: true });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    // The snapshot carries promotable work while state.json is gone from disk,
    // so the scan runs, the self-locking re-materialize finds no record to
    // replace, and the stamp is what brings state.json back.
    const snapshot: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(snapshot, false),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {},
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-02: leaves the version gate open when a scanned plugin's re-materialize fails", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "gate-stays-open");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    // A regular file where the skills target directory belongs makes the
    // staging write fail with ENOTDIR, which reinstall reports as a failed
    // partition rather than a throw.
    await mkdir(path.dirname(locations.skillsTargetDir), { recursive: true });
    await writeFile(locations.skillsTargetDir, "not a directory\n");
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "source missing",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WR-02: coerces a held scope lock on the stamp write into a structured state.json row", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "lock-held");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {}),
      },
    };
    await seedState(locations, seeded);
    const release = await lockfile.lock(locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
      stale: 10_000,
      update: 2_000,
    });
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
    ];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );
    // The lock is released here rather than in an `after` hook, so it can
    // never race the hook that removes the scope root it lives under.
    await release();

    // assert
    assert.deepStrictEqual(outcomes, [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
      {
        kind: "invalid-block",
        scope: "project",
        basename: "state.json",
        reason: "lock held",
        cause: new Error(
          "Another pi-claude-marketplace operation is in progress for project scope (.state-lock). Retry after it completes.",
        ),
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
});

// `runScopeIsolated` is a pure wrapper over a caller-supplied operation: it
// reads no file, no environment variable and no scope root, so these two cases
// own no temporary tree.
describe("runScopeIsolated", () => {
  test("leaves the accumulated outcomes untouched when the operation completes", async () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
    ];

    // act
    await runScopeIsolated("project", outcomes, () => Promise.resolve());

    // assert
    assert.deepStrictEqual(outcomes, [
      { kind: "mp-added", scope: "project", marketplace: "sibling" },
    ]);
  });

  test("WR-02: appends a state.json row carrying the redacted cause when the operation throws", async () => {
    // arrange
    const outcomes: PerEntryOutcome[] = [];

    // act
    await runScopeIsolated("user", outcomes, () =>
      Promise.reject(new Error("cannot write /home/someone/.pi/pi-claude-marketplace/state.json")),
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      {
        kind: "invalid-block",
        scope: "user",
        basename: "state.json",
        reason: "unreadable",
        cause: new Error("cannot write state.json"),
      },
    ]);
  });
});

describe("scanForceInstalledBackfills", () => {
  test("BFILL-01: promotes a plugin whose supported set grew into a fully installed record", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "full-promotion");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: true,
        unsupported: [],
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "commands"],
              unsupported: [],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: ["hello:deploy"],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), fullyPromotedScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("BFILL-01: keeps a partial re-materialize partially installed with the re-resolved unsupported kinds", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "partial-promotion");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", lsp: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: [],
            unsupported: ["lspServers", "skills"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: false,
        unsupported: ["lspServers"],
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: false,
              notes: ["contains lspServers"],
              supported: ["skills"],
              unsupported: ["lspServers"],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/hello-tool/",
      "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SURF-05: records an orphan rewake on a promotion whose re-resolve reports one", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "orphan-rewake");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true, orphanRewakeHooks: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: true,
        unsupported: [],
        orphanRewake: true,
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "commands", "hooks"],
              unsupported: [],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: ["hello:deploy"],
              agents: [],
              mcpServers: [],
              hooks: ["hello"],
            },
            hookEntries: [{ event: "PreToolUse", matcher: "" }],
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/commands-staging/",
      "pi-claude-marketplace/hooks/",
      "pi-claude-marketplace/hooks/hello/",
      "pi-claude-marketplace/hooks/hello/hooks.json",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/prompts/",
      "pi-claude-marketplace/resources/prompts/hello:deploy.md",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/hello-tool/",
      "pi-claude-marketplace/resources/skills/hello-tool/SKILL.md",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WARN-01: records the degraded component kinds a promotion's re-materialize produced", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "degraded-kinds");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "malformed", command: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: true,
        unsupported: [],
        degradedKinds: ["skill"],
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "commands"],
              unsupported: [],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: ["hello:deploy"],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), fullyPromotedScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-68-03: skips a partially-installed plugin whose supported set did not grow", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "no-growth");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-68-03: skips a resolved set that is longer than the recorded set but not a superset", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "not-superset");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { command: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    // An agents directory with no skills directory resolves to two supported
    // kinds that drop the one recorded kind: longer, but not a superset.
    await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: appends the promotion after the rows the caller already accumulated", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "folds-into-cascade");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "world",
        dependencies: [],
      },
    ];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-installed",
        scope: "project",
        marketplace: "mp",
        plugin: "world",
        dependencies: [],
      },
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: true,
        unsupported: [],
      },
    ]);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), fullyPromotedScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: skips a plugin already represented in this scope's accumulated outcomes", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "already-touched");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    // The apply pass already emitted a transition row for this plugin on this
    // load, so the scan must neither re-materialize over it nor add a row.
    const outcomes: PerEntryOutcome[] = [
      { kind: "plugin-enabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      { kind: "plugin-enabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-08: skips a disabled record whose supported set grew", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "disabled-partial");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true, lsp: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["lspServers"],
            enabled: false,
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-08: skips a record the snapshot reports disabled even when the stored record is enabled", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "snapshot-disabled");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true, lsp: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    // The scan reads its own snapshot, so a record the snapshot reports
    // disabled is never handed to the re-materialize -- even though the
    // re-materialize's own fresh read would find it enabled and promotable.
    const snapshot: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["lspServers"],
            enabled: false,
          }),
        }),
      },
    };
    const stored: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["lspServers"],
          }),
        }),
      },
    };
    await seedState(locations, stored);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      snapshot,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), stored);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-08: promotes the same grown fixture when the record is enabled", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "enabled-control");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true, lsp: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["lspServers"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: [],
        installable: false,
        unsupported: ["lspServers"],
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: false,
              notes: ["contains lspServers"],
              supported: ["skills", "commands"],
              unsupported: ["lspServers"],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: ["hello:deploy"],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), fullyPromotedScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-01: surfaces the pre-narrowed reason when the re-materialize reports one", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "narrowed-failure");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    // A regular file where the skills target directory belongs makes the
    // staging write fail with ENOTDIR, which reinstall pre-narrows to a typed
    // reason on the outcome rather than leaving it to the notes.
    await mkdir(path.dirname(locations.skillsTargetDir), { recursive: true });
    await writeFile(locations.skillsTargetDir, "not a directory\n");
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, true);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "source missing",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-01: classifies the composed notes when the re-materialize reports no reason", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "unnarrowed-failure");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    // A sibling record already owns the generated skill name this promotion
    // would write, so the cross-plugin conflict fails the re-materialize with
    // an error the reinstall primitive cannot pre-narrow.
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          conflictor: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "conflictor"),
            installable: true,
            supported: ["skills"],
            unsupported: [],
            skills: ["hello-tool"],
          }),
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, true);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "unreadable",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("BFILL-01: emits no promotion row when the record is removed between the snapshot and the re-materialize", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "concurrent-uninstall");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", command: true },
    });
    const snapshot: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    // The snapshot still carries the record; the on-disk state the
    // self-locking re-materialize re-reads no longer does.
    const afterConcurrentUninstall: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {}),
      },
    };
    await seedState(locations, afterConcurrentUninstall);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      snapshot,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), afterConcurrentUninstall);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-02: skips a recorded plugin the cached manifest no longer declares", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "entry-absent");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {});
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, false);
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-02: surfaces a plugin-scoped failure row when the cached manifest cannot be parsed", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "manifest-unreadable");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean" },
    });
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, true);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "unparseable",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-02: promotes a healthy plugin under one marketplace while a corrupt manifest fails its own", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "per-plugin-isolation");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const bad = await writeMarketplaceSource(cwd, "bad-src", "bad", { alpha: { skill: "clean" } });
    const good = await writeMarketplaceSource(cwd, "good-src", "good", {
      bravo: { skill: "clean", command: true },
    });
    await writeFile(bad.manifestPath, "{ this is not valid json at all", "utf8");
    const alphaRoot = path.join(bad.marketplaceRoot, "plugins", "alpha");
    const bravoRoot = path.join(good.marketplaceRoot, "plugins", "bravo");
    // `bad` is inserted first so the corrupt manifest is scanned before the
    // healthy sibling under the other marketplace.
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        bad: marketplaceRecord(cwd, "bad", "bad-src", bad.manifestPath, bad.marketplaceRoot, {
          alpha: pluginRecord({
            pluginRoot: alphaRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
        good: marketplaceRecord(cwd, "good", "good-src", good.manifestPath, good.marketplaceRoot, {
          bravo: pluginRecord({
            pluginRoot: bravoRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["commands"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act
    const anyFailure = await scanForceInstalledBackfills(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      seeded,
      outcomes,
    );

    // assert
    assert.strictEqual(anyFailure, true);
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "bad",
        plugin: "alpha",
        reason: "unparseable",
      },
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "good",
        plugin: "bravo",
        version: "1.0.0",
        dependencies: [],
        installable: true,
        unsupported: [],
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        bad: marketplaceRecord(cwd, "bad", "bad-src", bad.manifestPath, bad.marketplaceRoot, {
          alpha: pluginRecord({
            pluginRoot: alphaRoot,
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
        good: marketplaceRecord(cwd, "good", "good-src", good.manifestPath, good.marketplaceRoot, {
          bravo: {
            version: "1.0.0",
            resolvedSource: bravoRoot,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "commands"],
              unsupported: [],
            },
            resources: {
              skills: ["bravo-tool"],
              prompts: ["bravo:deploy"],
              agents: [],
              mcpServers: [],
              hooks: [],
            },
            enabled: true,
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
      "claude-plugins.json",
      "pi-claude-marketplace/",
      "pi-claude-marketplace/commands-staging/",
      "pi-claude-marketplace/resources/",
      "pi-claude-marketplace/resources/prompts/",
      "pi-claude-marketplace/resources/prompts/bravo:deploy.md",
      "pi-claude-marketplace/resources/skills/",
      "pi-claude-marketplace/resources/skills/bravo-tool/",
      "pi-claude-marketplace/resources/skills/bravo-tool/SKILL.md",
      "pi-claude-marketplace/skills-staging/",
      "pi-claude-marketplace/state.json",
    ]);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });
});
