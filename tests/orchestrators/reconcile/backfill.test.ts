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
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  applyBackfillForScopeIsolated,
  runScopeIsolated,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { EXTENSION_VERSION } from "../../../extensions/pi-claude-marketplace/shared/extension-version.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { retryTree } from "../plugin/scope-tree-inventory.ts";

import type { HooksRouting } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { PerEntryOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
import type * as BackfillOrchestrator from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts";
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
import type { CompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import type { TestContext } from "node:test";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

// backfill.ts publishes the two isolated wrappers; the partially-installed scan is
// the body of one of them and has no caller of its own. Restoring the export
// makes the `satisfies` resolve and turns the directive below into an unused
// one (TS2578).
// @ts-expect-error backfill.ts does not expose the partially-installed scan
void ({} satisfies { readonly retired?: typeof BackfillOrchestrator.scanForceInstalledBackfills });

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
  const { cwd } = await createHermeticEnvironment(t, `backfill-${label}-`);
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
  /** A runnable workflow script, so a re-materialize would place an envelope. */
  readonly workflow?: boolean;
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

  if (tree.workflow === true) {
    const workflowsDir = path.join(pluginRoot, "workflows");
    await mkdir(workflowsDir, { recursive: true });
    // A NAMED `meta` export: a default-export body classifies as skipped and
    // stages nothing, so a case relying on it would prove nothing about
    // whether a re-materialize ran.
    await writeFile(
      path.join(workflowsDir, "greet.js"),
      'export const meta = { name: "greet", description: "greets" };\n',
    );
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

/**
 * Lay down the plugin trees and the cached marketplace manifest that declares
 * them.
 *
 * `sources` overrides the manifest entry's `source` for the named plugins.
 * Every entry is a relative path source by default, which is the only shape
 * that resolves offline; a case pinning the git-source bound (NFR-5) supplies
 * an `owner/repo` shorthand or an `https://` URL here instead.
 */
async function writeMarketplaceSource(
  cwd: string,
  directory: string,
  marketplace: string,
  trees: Readonly<Record<string, PluginTree>>,
  sources?: Readonly<Record<string, string>>,
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
        source: sources?.[plugin] ?? `./plugins/${plugin}`,
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
      workflows: [],
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
  return backfillOptionsWithRouting(
    ctx,
    pi,
    cwd,
    gitOps,
    createHooksRouting(createHooksRuntime(), { readHooksJson }),
    createCompletionCache(),
  );
}

function backfillOptionsWithRouting(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  cwd: string,
  gitOps: GitOps,
  hooksRouting: HooksRouting,
  completionCache: CompletionCache,
): ApplyReconcileOptions {
  return {
    ctx,
    pi,
    cwd,
    scope: "project",
    completionCache,
    gitOps,
    hooksRouting,
  };
}

function readResultFor(state: ExtensionState, stateExisted: boolean): ScopeReadResult {
  return { plan: undefined, invalidOutcomes: [], state, stateExisted };
}

/**
 * Envelope file names under the host engine's saved workflows directory, or
 * `[]` when the directory was never created. That directory lives under the
 * hermetic HOME rather than under the scope root, so the scope-tree inventory
 * the other cases assert cannot see it.
 */
async function savedWorkflowEntries(locations: ScopedLocations): Promise<string[]> {
  try {
    return (await readdir(locations.workflowsSavedDir)).sort();
  } catch {
    return [];
  }
}

/**
 * Every axis a rewrite of state.json could move. Byte equality alone is
 * satisfied by an atomic rewrite of identical content, which is a write; the
 * inode catches exactly that rename, and the nanosecond mtime catches a
 * truncating rewrite that reused the inode. One frozen object so a single
 * deep equality reports all three.
 */
async function stateSnapshot(target: string): Promise<{
  readonly bytes: string;
  readonly inode: bigint;
  readonly mtimeNs: bigint;
}> {
  const [bytes, metadata] = await Promise.all([
    readFile(target, "utf8"),
    stat(target, { bigint: true }),
  ]);
  return Object.freeze({ bytes, inode: metadata.ino, mtimeNs: metadata.mtimeNs });
}

/**
 * Hold the scope's cross-process state lock for the length of one case, the way
 * a second Pi process would. `withScopeLock` takes this same lock BEFORE it
 * loads state or reads any record, so an operation that reaches for the
 * re-materialize under a held lock fails at the lock rather than on anything it
 * would have decided afterwards. Callers release it inside the case body rather
 * than in an `after` hook, so it can never race the hook that removes the scope
 * root it lives under.
 */
function holdScopeLock(locations: ScopedLocations): Promise<() => Promise<void>> {
  return lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
    retries: 0,
    stale: 10_000,
    update: 2_000,
  });
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

  test("RECON-05: leaves state.json unchanged in bytes, inode and mtime when the recorded stamp already matches", async (t) => {
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
    const seededSnapshot = await stateSnapshot(locations.stateJsonPath);
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
    assert.deepStrictEqual(await stateSnapshot(locations.stateJsonPath), seededSnapshot);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("D-68-03 / WCONV-02: stamps a gate-open scope whose scanned record did not grow", async (t) => {
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
    const release = await holdScopeLock(locations);
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

  // ENBL-08 / D-116-03: the pair below measures "a disabled record is never
  // scanned" rather than inferring it from a missing row. The manifest the
  // record resolves through is made unparseable, which turns any read of it
  // into a throw the scan cannot swallow: a scanned record surfaces a
  // plugin-scoped failure row AND holds the version gate open, so a landed
  // stamp beside an empty outcome array is a positive observation that the
  // read never happened.
  //
  // Both records are seeded `installable: false` because that is the only
  // population whose unresolvable manifest is observable. `installable: true` is
  // in the scan population too (WCONV-01), but `resolveRecordedPluginOffline`
  // answers a benign `undefined` for a clean record it cannot resolve -- so a
  // clean record here would leave an empty outcome array and a landed stamp
  // whether it was scanned or not, and the pair would be measuring nothing.
  // Disabled-ness is orthogonal to installability (ENBL-05), so the degraded seed
  // narrows nothing about the filter under test.
  //
  // The limit, stated rather than glossed: the observable is the marketplace
  // MANIFEST READ, which is the first statement of the offline re-resolve. It
  // is one step downstream of "the resolver was never called" -- a future
  // change that read the manifest before the disabled filter would keep this
  // pair honest about the read while no longer bounding the resolve.
  test("ENBL-08 / D-116-03: leaves a disabled record's poisoned manifest unread, so the stamp lands", async (t) => {
    // arrange
    const { cwd, locations } = await createHermeticProjectScope(t, "disabled-unread-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
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
            enabled: false,
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    // The poison is laid AFTER the seed so the record still names a manifest
    // path that exists; only its contents are unreadable. The manifest cache
    // cannot mask it either -- a stat failure there is a pure miss and the
    // loader's error propagates verbatim.
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
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

    // assert -- both halves. The empty array alone would be an absence; the
    // landed stamp is what makes it a measurement, because a record that WAS
    // scanned would have thrown, pushed a failure row and held the gate open.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("ENBL-08 / D-116-03: reads the same poisoned manifest when the record is enabled, and holds the gate open", async (t) => {
    // arrange -- the twin of the case above in every respect but the disabled
    // flag, so the poison is proved VISIBLE rather than assumed. Without this
    // half the measured zero could be measuring an inert fixture.
    const { cwd, locations } = await createHermeticProjectScope(t, "enabled-unread-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
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
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
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

    // assert -- the read happened: a failure row, and the stamp withheld so the
    // scope retries next load.
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
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  // WCONV-01 / SC-4: the pair below is the convergence half of the same fixture.
  // A record recorded `installable: true` carries no shortfall, so a marketplace
  // manifest it cannot read is a reason to promote nothing, not a failure to
  // report: no row, and the gate closes. These two cases pin that answer AND pin
  // that the silence is scoped to that population rather than blanket -- a
  // degraded sibling under the SAME poisoned manifest still fails loudly and
  // still holds the gate open (SF-02).
  test("WCONV-01: converges over a clean record whose manifest cannot be read, emitting nothing", async (t) => {
    // arrange -- a scope whose marketplace source went unreadable under it. Two
    // clean records, so a per-record surface would be visible as two rows.
    const { cwd, locations } = await createHermeticProjectScope(t, "clean-unreadable-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
      world: { skill: "clean", workflow: true },
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
          world: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "world"),
            installable: true,
            supported: ["skills"],
            unsupported: [],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
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

    // assert -- no rows, and the stamp LANDED. The landed stamp is the half that
    // carries convergence: the gate is closed, so this load is the last one that
    // reads the dead manifest rather than the first of an unbounded series.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("SF-02 / WCONV-01: still fails a degraded record under the same unreadable manifest", async (t) => {
    // arrange -- the discriminator. One clean record and one partially-installed
    // record share a poisoned manifest. If the fix silenced the resolve throw for
    // both populations this would emit zero rows and stamp; if it silenced
    // neither it would emit two.
    const { cwd, locations } = await createHermeticProjectScope(t, "mixed-unreadable-manifest");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
      world: { skill: "clean", workflow: true },
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
          world: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "world"),
            installable: false,
            supported: ["skills"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    await writeFile(manifestPath, "{ this is not valid json at all", "utf8");
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

    // assert -- exactly one row, for the record that had a pending shortfall, and
    // the stamp withheld so that record retries (SF-02 unchanged).
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "world",
        reason: "unparseable",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
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

// The partially-installed scan reached through the wrapper that owns it. Its
// SF-02 answer is not returned to a caller: the wrapper consumes it as the
// version-gate decision, so a scan that reported no failure closes the gate to
// the running version and a scan that reported one leaves it open.
describe("applyBackfillForScopeIsolated: the partially-installed scan", () => {
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              workflows: [],
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              workflows: [],
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
    const ownerRuntime = createHooksRuntime();
    const peerRuntime = createHooksRuntime();
    const hooksRouting = createHooksRouting(ownerRuntime, { readHooksJson });
    const ownerCache = createCompletionCache();
    const peerCache = createCompletionCache();
    const cachePath = await locations.pluginCacheFile("mp");
    const unrelatedCachePath = await locations.pluginCacheFile("unrelated");
    await ownerCache.getPluginIndex(cachePath, "project", "mp", () =>
      Promise.resolve([{ name: "owner-stale", status: "available" }]),
    );
    await rm(cachePath, { force: true });
    await peerCache.getPluginIndex(cachePath, "project", "mp", () =>
      Promise.resolve([{ name: "peer-stale", status: "available" }]),
    );
    await rm(cachePath, { force: true });
    await ownerCache.getPluginIndex(unrelatedCachePath, "project", "unrelated", () =>
      Promise.resolve([{ name: "owner-unrelated", status: "available" }]),
    );
    await rm(unrelatedCachePath, { force: true });
    await rm(path.dirname(path.dirname(cachePath)), { recursive: true, force: true });
    const outcomes: PerEntryOutcome[] = [];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptionsWithRouting(ctx, pi, cwd, gitOps, hooksRouting, ownerCache),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );
    // assert
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              workflows: [],
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
    const ownerRows = await ownerCache.getPluginIndex(cachePath, "project", "mp", () =>
      Promise.resolve([{ name: "owner-fresh", status: "installed" }]),
    );
    const peerRows = await peerCache.getPluginIndex(cachePath, "project", "mp", () =>
      Promise.reject(new Error("the peer cache must retain its warmed target row")),
    );
    const unrelatedRows = await ownerCache.getPluginIndex(
      unrelatedCachePath,
      "project",
      "unrelated",
      () => Promise.reject(new Error("the owner cache must retain its unrelated row")),
    );
    assert.deepStrictEqual(
      ownerRuntime.getRoutingBucket("PreToolUse").map((entry) => ({
        command: entry.handlerDecl["command"],
        marketplace: entry.marketplace,
        plugin: entry.pluginId,
        scope: entry.scope,
      })),
      [{ command: "echo orphan", marketplace: "mp", plugin: "hello", scope: "project" }],
    );
    assert.deepStrictEqual(peerRuntime.getRoutingBucket("PreToolUse"), []);
    assert.deepStrictEqual(ownerRows, [{ name: "owner-fresh", status: "installed" }]);
    assert.deepStrictEqual(peerRows, [{ name: "peer-stale", status: "available" }]);
    assert.deepStrictEqual(unrelatedRows, [{ name: "owner-unrelated", status: "available" }]);
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              workflows: [],
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

  test("RECON-05: places no workflow envelope for a record whose supported set did not grow", async (t) => {
    // arrange -- the record already claims `workflows`, and the source still
    // ships exactly the one script it claimed, so the set did not grow. This is
    // the SECOND of the two structures that keep a reload from rewriting
    // executable code: the first is an empty plan bucket, this is the gate the
    // backfill applies to the records the plan never reaches.
    const { cwd, locations } = await createHermeticProjectScope(t, "workflows-no-growth");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
    });
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "hello"),
            installable: false,
            supported: ["skills", "workflows"],
            unsupported: ["themes"],
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [];

    // act -- the gate is deliberately left OPEN (a stale stamp), so the scan
    // does run and the skip is the growth test's doing, not the version test's.
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert -- the engine's saved directory is the one place a workflow
    // re-materialize would show, and it sits OUTSIDE the scope root that the
    // sibling cases' tree inventory covers, so it is asserted on its own.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
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
    assert.strictEqual(
      (await loadState(locations.extensionRoot)).lastReconciledExtensionVersion,
      EXTENSION_VERSION,
    );
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, [
      { kind: "plugin-enabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("RECON-04: does not re-materialize behind a disable the same load already applied", async (t) => {
    // arrange -- the shape the apply pass leaves when it disables a plugin: the
    // scan's snapshot PREDATES that pass, so it still reports the record
    // enabled, and the growth test still says the set grew.
    //
    // What the dedupe protects is single-emit (RECON-04): no second row for a
    // plugin this load already transitioned, and no redundant re-materialize
    // over it. It is NOT the last line of defence against re-enabling a disabled
    // record -- `runLockedReinstall` re-reads fresh state under its own lock and
    // refuses a disabled record with `already disabled`
    // (`reinstall.ts` isRecordedButDisabled branch), which is precisely the
    // cross-process shape this fixture simulates. `backfill.ts` says the same
    // beside its own ENBL-08 filter.
    const { cwd, locations } = await createHermeticProjectScope(t, "disable-already-touched");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
    });
    const snapshot: ExtensionState = {
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
    await seedState(locations, snapshot);
    const { ctx, pi, verifyBoundary } = createSilentBoundary();
    const { gitOps, clonedUrls } = createOfflineGitOps();
    const outcomes: PerEntryOutcome[] = [
      { kind: "plugin-disabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ];

    // act
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(snapshot, true),
      outcomes,
    );

    // assert -- no second row and no envelope: the plugin the user just
    // disabled stays inert.
    assert.deepStrictEqual(outcomes, [
      { kind: "plugin-disabled", scope: "project", marketplace: "mp", plugin: "hello" },
    ]);
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...snapshot,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  // ENBL-08: the cases below measure the filter against a fully LIVE fixture --
  // a readable manifest and a real strict-superset growth -- which the
  // poisoned-manifest pair cannot do, because poisoning the manifest denies the
  // growth test its input. Everything up to the re-materialize therefore runs,
  // and the filter is the only thing that can stop the scan short of it. The
  // enabled control promotes the same fixture, so the disabled case's silence
  // is a fact about the filter rather than about a fixture nothing would have
  // promoted.
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert -- silence and a landed stamp. The D-116-03 pair above is what
    // proves the record was never READ; this case pins the row-level outcome.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(snapshot, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...stored,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(seeded, true),
      outcomes,
    );

    // assert
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
      lastReconciledExtensionVersion: EXTENSION_VERSION,
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
              workflows: [],
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

  // The re-materialize takes the per-scope state lock itself
  // (`runLockedReinstall`), so a concurrent process holding it fails the
  // reinstall at the lock rather than on anything it would have read. That
  // failure is caught INSIDE `reinstallPlugin` and returned as a `failed`
  // outcome, and the failed arm prefers the outcome's own pre-narrowed reason
  // over `classifyOrchestratorThrow`. Both layers must therefore agree on the
  // token: the wrapper one layer up already says `lock held` for the same error
  // (WR-02 above), and a row that said `unreadable` would claim the cascade
  // could not read a plugin that nothing had trouble reading.
  test("ENBL-08: reports a held scope lock on the re-materialize as `lock held` and holds the gate open", async (t) => {
    // arrange -- the enabled control's fixture, under a lock another process holds.
    const { cwd, locations } = await createHermeticProjectScope(t, "enabled-lock-held");
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
          }),
        }),
      },
    };
    await seedState(locations, seeded);
    const release = await holdScopeLock(locations);
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
    await release();

    // assert -- one plugin-scoped failure row under the lock's own token, and
    // no state.json row: a failed scan skips the stamp write instead of
    // colliding with the lock a second time, so the gate stays open for the
    // next load and the record is left exactly as seeded.
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-install-failed",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        reason: "lock held",
      },
    ]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), seeded);
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WCONV-01: promotes a cleanly-installed record whose supported set grew", async (t) => {
    // arrange -- the shape a plugin leaves behind when it declares a component
    // kind the extension did not support at install time: the kind is simply
    // absent from BOTH halves of `compatibility`, so the record reads exactly
    // like a clean install and only the growth test can see the boundary move.
    const { cwd, locations } = await createHermeticProjectScope(t, "clean-growth");
    t.mock.timers.enable({ apis: ["Date"], now: new Date(REMATERIALIZED_AT) });
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(cwd, "mp-src", "mp", {
      hello: { skill: "clean", workflow: true },
    });
    const pluginRoot = path.join(marketplaceRoot, "plugins", "hello");
    const seeded: ExtensionState = {
      schemaVersion: 2,
      lastReconciledExtensionVersion: STALE_STAMP,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: pluginRecord({
            pluginRoot,
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

    // assert -- one promotion row, the grown set persisted with the workflow
    // command named, and the envelope in the host engine's saved directory:
    // the commands exist after this load with nothing run by the user.
    assert.deepStrictEqual(outcomes, [
      {
        kind: "plugin-backfilled",
        scope: "project",
        marketplace: "mp",
        plugin: "hello",
        version: "1.0.0",
        dependencies: ["workflows"],
        installable: true,
        unsupported: [],
      },
    ]);
    assert.deepStrictEqual(await savedWorkflowEntries(locations), ["hello:greet.json"]);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      schemaVersion: 2,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
      marketplaces: {
        mp: marketplaceRecord(cwd, "mp", "mp-src", manifestPath, marketplaceRoot, {
          hello: {
            version: "1.0.0",
            resolvedSource: pluginRoot,
            compatibility: {
              installable: true,
              notes: [],
              supported: ["skills", "workflows"],
              unsupported: [],
            },
            resources: {
              skills: ["hello-tool"],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: [],
              workflows: ["hello:greet"],
            },
            enabled: true,
            // D-68-02: the promotion re-materializes at the recorded version, so
            // both the version and the original install time survive it.
            installedAt: RECORDED_AT,
            updatedAt: REMATERIALIZED_AT,
          },
        }),
      },
    });
    // NFR-5: the whole promotion ran off the cached manifest and the local
    // clone, so the counting fake saw no remote at all.
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("WCONV-01: declines to degrade a clean record whose re-resolve is partially-available", async (t) => {
    // arrange -- growth and degradation in the same re-resolve. The record is
    // recorded CLEAN (`installable: true`, empty unsupported); the tree it
    // re-resolves against adds a supported `commands` kind AND an unsupported
    // `lspServers` one, so the supported set strictly grows while the resolve
    // answers `partially-available`.
    //
    // Promoting it would unstage whatever dropped out of the supported set and
    // persist `installable: false`, degrading a clean record on a reload the user
    // did not initiate. `docs/output-catalog.md` states the project's stance on
    // that transition for the update path; this case pins the same stance here.
    const { cwd, locations } = await createHermeticProjectScope(t, "clean-degrade-declined");
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

    // assert -- a benign skip, not a failure: no row, the record untouched (still
    // clean, still naming only `skills`), nothing unstaged, and the gate free to
    // close. The declined transition is the one the sibling case above PERFORMS
    // when the same growth resolves `installable`, so this is not the growth test
    // declining.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
    assert.deepStrictEqual(clonedUrls(), []);
    verifyBoundary();
  });

  test("NFR-5: skips a git-source record whose supported set grew, and reaches no remote", async (t) => {
    // arrange -- both git-shaped sources the resolver classifies away from
    // `path`: the `owner/repo` shorthand and an `https://` URL. The scan
    // re-resolves with no clone-cache resolver, so each answers `unavailable`
    // and never reaches the re-materialize. Both trees are seeded and both
    // records seeded at a set that WOULD grow, so a case that passes here
    // cannot be passing because the growth test skipped them.
    const { cwd, locations } = await createHermeticProjectScope(t, "git-source");
    const { manifestPath, marketplaceRoot } = await writeMarketplaceSource(
      cwd,
      "mp-src",
      "mp",
      {
        hello: { skill: "clean", workflow: true },
        world: { skill: "clean", workflow: true },
      },
      { hello: "acolomba/some-plugin", world: "https://example.com/some-plugin.git" },
    );
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
          world: pluginRecord({
            pluginRoot: path.join(marketplaceRoot, "plugins", "world"),
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

    // assert -- a benign skip, not a failure: an unresolvable source leaves the
    // version gate free to close. The empty clone list is the NFR-5 half -- a
    // reload the user did not initiate reaches no remote, and the counting fake
    // would have recorded the attempt if one had been made.
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(clonedUrls(), []);
    assert.deepStrictEqual(await savedWorkflowEntries(locations), []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...seeded,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
    assert.deepStrictEqual(await retryTree(locations.scopeRoot), seededScopeTree());
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
    await applyBackfillForScopeIsolated(
      backfillOptions(ctx, pi, cwd, gitOps),
      "project",
      readResultFor(snapshot, true),
      outcomes,
    );

    // assert
    assert.deepStrictEqual(outcomes, []);
    assert.deepStrictEqual(await loadState(locations.extensionRoot), {
      ...afterConcurrentUninstall,
      lastReconciledExtensionVersion: EXTENSION_VERSION,
    });
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
              workflows: [],
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
