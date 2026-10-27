// Owner suite for orchestrators/import/execute.ts.
//
// D-115-03: the cascade's contract is what it AGGREGATES from its collaborators,
// and the module already exposes those collaborators as parameter-level
// dependency injection, so almost every case injects an `ImportDeps` bundle and
// asserts the complete public result plus the complete notification array.
// D-115-04 is the exception: cases that pass no bundle at all drive the real
// default resolvers against a case-owned temporary tree.
//
// D-115-08 draws the boundary: a case varies which fault each entry hits and
// which outcome each collaborator returns, then proves the composition's
// continuation, ordering, tally, and notification effect. It never re-derives
// why a lifecycle workflow failed internally -- those failure modes have their
// own owners.
//
// Every injected bundle is filled with fail-fast collaborators, so a call the
// case did not promise rejects instead of reaching a real transport (D-18). Every
// case that touches disk owns its own temporary roots and restores HOME and
// PI_CODING_AGENT_DIR through a hook registered before the act phase.
//
// IL-2 is proved by sizing the notification boundary: each case promises the
// exact number of emissions it expects, so an extra `ctx.ui.notify` call
// throws where it is made rather than being counted afterwards. A case whose
// result carries `diagnostics` promises a second emission -- the sanctioned
// `notifyDiagnostic` seam `importClaudeSettings` fires once after the
// cascade (mirrors `reconcile/apply.ts`'s post-commit-warnings exception) --
// every other case promises exactly one.
//
// D-05 / D-07: the cascade renders from the command run's snapshot. The nested
// marketplace add and plugin install receive the same run.

import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import lockfile from "proper-lockfile";
import { mock, verify, when } from "strong-mock";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { importClaudeSettings as importClaudeSettingsWithCache } from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import { createInstallOperation } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { loadMergedScopeConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
  toDisabledRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import {
  ConcurrentInstallError,
  DependencyCascadeError,
  FetchedUrlCause,
  InstallMarketplaceAddError,
  InvalidGitHubBaseUrlError,
  PluginShapeError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { openNotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { runWithNothingLoaded, runWithSoftDeps } from "../../shared/notification-run-seeds.ts";

import type { HooksRouting } from "../../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import type { HooksRuntime } from "../../../extensions/pi-claude-marketplace/bridges/hooks/runtime.ts";
import type {
  ClaudeImportExecutionResult,
  ImportClaudeSettingsOptions,
  ImportDeps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ContentReason } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { TestContext } from "node:test";

// Every collaborator shape below is derived from the module's own `ImportDeps`,
// so a change to the injection seam is a compile error in this suite rather than
// a silently stale hand-copied type.
type Scope = ImportClaudeSettingsOptions["selectedScopes"][number];
type GitOps = NonNullable<ImportClaudeSettingsOptions["gitOps"]>;
type LoadSettings = NonNullable<ImportDeps["loadSettings"]>;
type LoadState = NonNullable<ImportDeps["loadState"]>;
type AddMarketplace = NonNullable<ImportDeps["addMarketplace"]>;
type InstallPlugin = NonNullable<ImportDeps["installPlugin"]>;
type ClaudeSettings = Awaited<ReturnType<LoadSettings>>;
type ImportState = Awaited<ReturnType<LoadState>>;
type MarketplaceRecord = ImportState["marketplaces"][string];
type MarketplaceSource = MarketplaceRecord["source"];
type PluginRecord = MarketplaceRecord["plugins"][string];
type AddOutcome = Awaited<ReturnType<AddMarketplace>>;
type InstallOutcome = Awaited<ReturnType<InstallPlugin>>;
type AddOptions = Parameters<AddMarketplace>[0];
type InstallOptions = Parameters<InstallPlugin>[0];
type Diagnostic = ClaudeImportExecutionResult["diagnostics"][number];
type Collaborators = Required<ImportDeps>;
type TestImportOptions = Omit<ImportClaudeSettingsOptions, "completionCache">;

for (const mode of ["json", "rpc"] as const) {
  test(`appends import diagnostics after the cascade in ${mode}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "machine-diagnostics");
    const capture = createJsonCapture();
    const ctx = mock<ImportClaudeSettingsOptions["ctx"]>({ exactParams: true, name: "context" });
    when(() => ctx.mode)
      .thenReturn(mode)
      .times(2);
    const inventory = mock<
      Pick<Parameters<typeof openNotificationRun>[0], "getAllTools" | "getCommands">
    >({
      exactParams: true,
      name: "inventory",
    });
    when(() => inventory.getAllTools())
      .thenReturn([])
      .times(3);
    when(() => inventory.getCommands())
      .thenReturn([])
      .once();
    const pi = {
      getAllTools: () => inventory.getAllTools(),
      getCommands: () => inventory.getCommands(),
      appendEntry: capture.entrySink.appendEntry,
    };
    const run = openNotificationRun(pi, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });
    const diagnostic: Diagnostic = {
      code: "malformed-json",
      message: "Unable to parse settings.",
      scope: "user",
      severity: "warning",
    };

    // act
    const imported = await importClaudeSettings({
      ctx,
      run,
      cwd,
      deps: collaborators({
        loadSettings: () => Promise.resolve(claudeSettings({ diagnostics: [diagnostic] })),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(imported, { ...emptyImportResult(), diagnostics: [diagnostic] });
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "cascade",
          severity: "info",
          needsReload: false,
          marketplaces: [],
        },
      },
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "diagnostic",
          severity: "warning",
          needsReload: false,
          header: "1 import diagnostic surfaced.",
          lines: ["Unable to parse settings."],
        },
      },
    ]);
    capture.assertValid();
    assert.strictEqual(run.entrySink, pi);
    verify(inventory);
    verify(ctx);
  });
}

const completionCachesByRouting = new WeakMap<
  HooksRouting,
  ReturnType<typeof createCompletionCache>
>();

function completionCacheFor(hooksRouting: HooksRouting): ReturnType<typeof createCompletionCache> {
  let completionCache = completionCachesByRouting.get(hooksRouting);
  if (completionCache === undefined) {
    completionCache = createCompletionCache();
    completionCachesByRouting.set(hooksRouting, completionCache);
  }

  return completionCache;
}

function importClaudeSettings(
  opts: TestImportOptions,
): ReturnType<typeof importClaudeSettingsWithCache> {
  const completionCache = completionCacheFor(opts.hooksRouting);

  return importClaudeSettingsWithCache({ ...opts, completionCache });
}

interface HermeticScopes {
  readonly cwd: string;
  readonly project: ScopedLocations;
  readonly user: ScopedLocations;
}

/**
 * One project root and one user root per case, both removed with the
 * environment restore in a single hook registered before the act phase. The
 * cascade's config write-back resolves the user scope through the agent
 * directory, and `getAgentDir()` reads PI_CODING_AGENT_DIR before homedir(), so
 * an environment that sets it would defeat the hermetic HOME (SC-1).
 */
async function createHermeticScopes(t: TestContext, label: string): Promise<HermeticScopes> {
  const { cwd } = await createHermeticEnvironment(t, `import-${label}-`);
  return { cwd, project: locationsFor("project", cwd), user: locationsFor("user", cwd) };
}

/** The extension root must exist before the post-pass can take the scope lock. */
async function createScopeRoots(...locations: readonly ScopedLocations[]): Promise<void> {
  for (const location of locations) {
    await mkdir(location.extensionRoot, { recursive: true });
    await mkdir(location.scopeRoot, { recursive: true });
  }
}

/**
 * A git port that fails every remote it was not told about. No case in this
 * suite reaches a remote, so the allow-list is empty on purpose: any transport
 * attempt is a hard failure rather than a silent network call (D-18).
 */
function createOfflineGitOps(): GitOps {
  return createGitOpsFake({ allowedRemoteUrls: [], boundary: "memory" }).gitOps;
}

function claudeSettings(declared: {
  readonly enabledPlugins?: Record<string, unknown>;
  readonly extraKnownMarketplaces?: Record<string, unknown>;
  readonly diagnostics?: readonly Diagnostic[];
}): ClaudeSettings {
  return {
    paths: { basePath: "/claude/settings.json", localPath: "/claude/settings.local.json" },
    settings: {
      enabledPlugins: declared.enabledPlugins ?? {},
      extraKnownMarketplaces: declared.extraKnownMarketplaces ?? {},
    },
    diagnostics: declared.diagnostics ?? [],
  };
}

function pathSource(raw: string): MarketplaceSource {
  return { kind: "path", logical: raw, raw };
}

function githubSource(owner: string, repo: string): MarketplaceSource {
  return { kind: "github", owner, raw: `${owner}/${repo}`, repo };
}

/**
 * A stored source in a shape the parser does not recognise, as a hand-edited
 * `state.json` would leave it. The record schema types `source` as unknown, so
 * this needs no cast.
 */
function unrecognizedSource(): MarketplaceSource {
  return { handEdited: true };
}

function recordedPlugin(name: string): PluginRecord {
  return {
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    resolvedSource: `/marketplaces/plugins/${name}`,
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [], workflows: [] },
    updatedAt: "2026-01-01T00:00:00.000Z",
    version: "1.0.0",
  };
}

function recordedMarketplace(recorded: {
  readonly name: string;
  readonly scope: Scope;
  readonly source: MarketplaceSource;
  readonly plugins?: readonly string[];
}): MarketplaceRecord {
  return {
    addedFromCwd: "/work",
    manifestPath: `/marketplaces/${recorded.name}/.claude-plugin/marketplace.json`,
    marketplaceRoot: `/marketplaces/${recorded.name}`,
    name: recorded.name,
    plugins: Object.fromEntries(
      (recorded.plugins ?? []).map((plugin) => [plugin, recordedPlugin(plugin)]),
    ),
    scope: recorded.scope,
    source: recorded.source,
  };
}

function recordedState(records: readonly MarketplaceRecord[]): ImportState {
  return {
    marketplaces: Object.fromEntries(records.map((record) => [record.name, record])),
    schemaVersion: 2,
  };
}

function installedOutcome(): InstallOutcome {
  return {
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    resourcesChanged: true,
    status: "installed",
  };
}

function failedInstallOutcome(error: Error, cause: string): InstallOutcome {
  return { cause, error, status: "failed" };
}

function addedOutcome(name: string): AddOutcome {
  return { name, status: "added" };
}

function failedAddOutcome(cause: string): AddOutcome {
  return { cause, error: new Error(cause), reason: "duplicate name", status: "failed" };
}

/**
 * A bundle whose unpromised members reject. Each case overrides only the
 * collaborators its behavior depends on, so a call it did not promise surfaces
 * as an unexpected outcome on the aggregated result instead of reaching the real
 * marketplace, installer, state store, or Claude settings files.
 */
function collaborators(promised: ImportDeps): Collaborators {
  return {
    addMarketplace: (options) =>
      Promise.reject(new Error(`unpromised addMarketplace call for ${options.rawSource}`)),
    installPlugin: (options) =>
      Promise.reject(new Error(`unpromised installPlugin call for ${options.plugin}`)),
    loadSettings: (scope) => Promise.reject(new Error(`unpromised loadSettings call for ${scope}`)),
    loadState: (scope) => Promise.reject(new Error(`unpromised loadState call for ${scope}`)),
    setPluginEnabled: (options) =>
      Promise.reject(new Error(`unpromised setPluginEnabled call for ${options.plugin}`)),
    ...promised,
  } satisfies Collaborators;
}

/** One settings document per selected scope, answered in selection order. */
function settingsSequence(documents: readonly ClaudeSettings[]): LoadSettings {
  let answered = 0;
  return () => {
    const document = documents[answered];
    answered += 1;
    if (document === undefined) {
      return Promise.reject(new Error(`unpromised loadSettings call number ${answered}`));
    }

    return Promise.resolve(document);
  };
}

type Added = ClaudeImportExecutionResult["addedMarketplaces"][number];
type Skipped = ClaudeImportExecutionResult["skippedExistingMarketplaces"][number];
type Installed = ClaudeImportExecutionResult["installedPlugins"][number];
type SkippedPlugin = ClaudeImportExecutionResult["skippedExistingPlugins"][number];
type Warning = ClaudeImportExecutionResult["warnings"][number];
type MarketplaceFailure = ClaudeImportExecutionResult["marketplaceFailures"][number];
type SourceMismatch = ClaudeImportExecutionResult["sourceMismatches"][number];
type UnexpectedFailure = ClaudeImportExecutionResult["unexpectedPluginFailures"][number];

// The expected-outcome builders below hold the shipped literal vocabulary of
// each outcome type. Nothing here calls a production builder or projector; a
// wrong token in the source is a failing comparison, not a matching one.
function added(marketplace: string, scope: Scope): Added {
  return { kind: "marketplace-added", marketplace, reason: "added", scope };
}

function skipped(marketplace: string, scope: Scope): Skipped {
  return { kind: "marketplace-skip", marketplace, reason: "already-present", scope };
}

function installed(
  plugin: string,
  marketplace: string,
  scope: Scope,
  declares: {
    readonly agents: boolean;
    readonly mcp: boolean;
    readonly workflows?: boolean;
  } = { agents: false, mcp: false },
  resourcesChanged = true,
): Installed {
  return {
    declaresAgents: declares.agents,
    declaresMcp: declares.mcp,
    declaresWorkflows: declares.workflows ?? false,
    kind: "plugin-installed",
    marketplace,
    plugin,
    reason: "installed",
    ref: `${plugin}@${marketplace}`,
    resourcesChanged,
    scope,
  };
}

function skippedPlugin(plugin: string, marketplace: string, scope: Scope): SkippedPlugin {
  return {
    kind: "plugin-skip",
    marketplace,
    plugin,
    reason: "already-installed",
    ref: `${plugin}@${marketplace}`,
    scope,
  };
}

function warned(
  plugin: string,
  marketplace: string,
  scope: Scope,
  reason: Exclude<Warning["reason"], "uninstallable">,
  cause: string,
): Warning {
  return {
    cause,
    kind: "plugin-warning",
    marketplace,
    plugin,
    reason,
    ref: `${plugin}@${marketplace}`,
    scope,
  };
}

function addFailed(marketplace: string, scope: Scope, cause: string): MarketplaceFailure {
  return { cause, kind: "marketplace-failure", marketplace, reason: "add-failed", scope };
}

function mismatched(
  plugin: string,
  marketplace: string,
  scope: Scope,
  cause: string,
): SourceMismatch {
  return {
    cause,
    kind: "source-mismatch",
    marketplace,
    plugin,
    reason: "source-mismatch",
    ref: `${plugin}@${marketplace}`,
    scope,
  };
}

function failedUnexpectedly(
  plugin: string,
  marketplace: string,
  scope: Scope,
  cause: string,
  causeChain?: Error,
): UnexpectedFailure {
  return {
    cause,
    kind: "plugin-failure",
    marketplace,
    plugin,
    reason: "unexpected-failure",
    ref: `${plugin}@${marketplace}`,
    scope,
    ...(causeChain !== undefined && { causeChain }),
  };
}

function failedDependency(
  plugin: string,
  marketplace: string,
  scope: Scope,
  cause: string,
  causeChain?: Error,
): UnexpectedFailure {
  return {
    cause,
    kind: "plugin-failure",
    marketplace,
    plugin,
    reason: "dependency-failed",
    ref: `${plugin}@${marketplace}`,
    scope,
    ...(causeChain !== undefined && { causeChain }),
  };
}

/** One recorded state per scope plan, answered in plan order. */
function stateSequence(snapshots: readonly ImportState[]): LoadState {
  let answered = 0;
  return () => {
    const snapshot = snapshots[answered];
    answered += 1;
    if (snapshot === undefined) {
      return Promise.reject(new Error(`unpromised loadState call number ${answered}`));
    }

    return Promise.resolve(snapshot);
  };
}

function emptyImportResult(): ClaudeImportExecutionResult {
  return {
    addedMarketplaces: [],
    changedResources: false,
    diagnostics: [],
    installedPlugins: [],
    marketplaceFailures: [],
    skippedExistingMarketplaces: [],
    skippedExistingPlugins: [],
    sourceMismatches: [],
    unexpectedPluginFailures: [],
    warnings: [],
  };
}

test("declares plural cardinality when import produces zero rows", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "zero-row-tally");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(claudeSettings({})),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, emptyImportResult());
  assert.deepStrictEqual(notifications, [{ message: "(no marketplaces)" }]);
  verifyBoundary();
});

test("records a marketplace the state does not carry and installs its declared plugin", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "add-and-install");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const gitOps = createOfflineGitOps();
  const installPlugin = mock<InstallPlugin>({ exactParams: true, name: "install plugin" });
  when(() =>
    installPlugin({
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      plugin: "plugin",
      run,
      scope: "user",
    }),
  ).thenResolve(installedOutcome());
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [
      { kind: "marketplace-added", marketplace: "mp", reason: "added", scope: "user" },
    ],
    changedResources: true,
    installedPlugins: [
      {
        declaresAgents: false,
        declaresMcp: false,
        declaresWorkflows: false,
        kind: "plugin-installed",
        marketplace: "mp",
        plugin: "plugin",
        reason: "installed",
        ref: "plugin@mp",
        resourcesChanged: true,
        scope: "user",
      },
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin,
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    gitOps,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (added)\n  ● plugin (installed)\n\nImport: 2 successes\n\n/reload to pick up changes",
    },
  ]);
  verifyBoundary();
  verify(installPlugin);
});

test("passes the marketplace add an options object that carries the git port only when the caller supplied one", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "git-port");
  const withPort = createNotificationBoundary(1);
  const withoutPort = createNotificationBoundary(1);
  const withPortRun = runWithNothingLoaded();
  const withoutPortRun = runWithNothingLoaded();
  const gitOps = createOfflineGitOps();
  const withRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const withoutRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  // The whole options object, not just its `gitOps` value: a conditional spread
  // OMITS the key, and an omitted key is a different object from one holding an
  // explicit undefined.
  const requested: AddOptions[] = [];
  const promised = (): ImportDeps => ({
    addMarketplace: (options) => {
      requested.push(options);
      return Promise.resolve(addedOutcome("mp"));
    },
    installPlugin: () => Promise.resolve(installedOutcome()),
    loadSettings: () =>
      Promise.resolve(
        claudeSettings({
          enabledPlugins: { "plugin@mp": true },
          extraKnownMarketplaces: { mp: { directory: "./mp" } },
        }),
      ),
    loadState: () => Promise.resolve(recordedState([])),
  });

  // act
  await importClaudeSettings({
    ctx: withPort.ctx,
    run: withPortRun,
    cwd,
    deps: collaborators(promised()),
    gitOps,
    hooksRouting: withRouting,
    selectedScopes: ["user"],
  });
  await importClaudeSettings({
    ctx: withoutPort.ctx,
    run: withoutPortRun,
    cwd,
    deps: collaborators(promised()),
    hooksRouting: withoutRouting,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(requested, [
    {
      ctx: withPort.ctx,
      completionCache: completionCacheFor(withRouting),
      cwd,
      gitOps,
      notifications: { mode: "orchestrated" },
      rawSource: "./mp",
      run: withPortRun,
      scope: "user",
    },
    {
      ctx: withoutPort.ctx,
      completionCache: completionCacheFor(withoutRouting),
      cwd,
      notifications: { mode: "orchestrated" },
      rawSource: "./mp",
      run: withoutPortRun,
      scope: "user",
    },
  ]);
  withPort.verifyBoundary();
  withoutPort.verifyBoundary();
});

// A three-marketplace batch whose first entry fails. The batch is not abandoned:
// the two later marketplaces are still ensured and their plugins still install,
// and the failing marketplace's own plugin is blocked with the cause attributed
// to both the marketplace row and the plugin warning (WR-07).
for (const { addMarketplace, cause, title } of [
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome> =>
      Promise.resolve(
        rawSource === "./a"
          ? failedAddOutcome('Marketplace "mp-a" already added.')
          : addedOutcome(rawSource),
      ),
    cause: 'Marketplace "mp-a" already added.',
    title: "a typed failure outcome",
  },
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome | undefined> =>
      Promise.resolve(rawSource === "./a" ? undefined : addedOutcome(rawSource)),
    cause: "addMarketplace returned no outcome in orchestrated mode",
    title: "an absent outcome",
  },
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome> =>
      rawSource === "./a"
        ? Promise.reject(new Error("clone failed"))
        : Promise.resolve(addedOutcome(rawSource)),
    cause: "clone failed",
    title: "an unexpected throw",
  },
] satisfies readonly {
  readonly addMarketplace: (rawSource: string) => Promise<AddOutcome | undefined>;
  readonly cause: string;
  readonly title: string;
}[]) {
  test(`ensures the rest of the batch after ${title} on the first marketplace`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "add-fault-first");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp-b", "user"), added("mp-c", "user")],
      changedResources: true,
      installedPlugins: [installed("b", "mp-b", "user"), installed("c", "mp-c", "user")],
      marketplaceFailures: [addFailed("mp-a", "user", cause)],
      warnings: [warned("a", "mp-a", "user", "marketplace-failed", cause)],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: (options) => addMarketplace(options.rawSource),
        installPlugin: () => Promise.resolve(installedOutcome()),
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "a@mp-a": true, "b@mp-b": true, "c@mp-c": true },
              extraKnownMarketplaces: {
                "mp-a": { directory: "./a" },
                "mp-b": { directory: "./b" },
                "mp-c": { directory: "./c" },
              },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "⊘ mp-a [user] (failed)\n" +
          "  ⊘ mp-a (failed)\n" +
          `    cause: ${cause}\n\n` +
          "● mp-b [user] (added)\n  ● b (installed)\n\n" +
          "● mp-c [user] (added)\n  ● c (installed)\n\n" +
          "Import: 2 failures, 4 successes\n\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

// The same three fault modes on a MIDDLE entry. The marketplace ensured before
// the fault keeps its recorded outcome and its plugin stays installed, which is
// what proves the earlier commits survive rather than merely that the loop ran.
for (const { addMarketplace, cause, title } of [
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome> =>
      Promise.resolve(
        rawSource === "./b"
          ? failedAddOutcome("stale clone at /marketplaces/mp-b")
          : addedOutcome(rawSource),
      ),
    cause: "stale clone at /marketplaces/mp-b",
    title: "a typed failure outcome",
  },
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome | undefined> =>
      Promise.resolve(rawSource === "./b" ? undefined : addedOutcome(rawSource)),
    cause: "addMarketplace returned no outcome in orchestrated mode",
    title: "an absent outcome",
  },
  {
    addMarketplace: (rawSource: string): Promise<AddOutcome> =>
      rawSource === "./b"
        ? Promise.reject(new Error("manifest unreadable"))
        : Promise.resolve(addedOutcome(rawSource)),
    cause: "manifest unreadable",
    title: "an unexpected throw",
  },
] satisfies readonly {
  readonly addMarketplace: (rawSource: string) => Promise<AddOutcome | undefined>;
  readonly cause: string;
  readonly title: string;
}[]) {
  test(`ensures the rest of the batch after ${title} on a middle marketplace`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "add-fault-middle");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp-a", "user"), added("mp-c", "user")],
      changedResources: true,
      installedPlugins: [installed("a", "mp-a", "user"), installed("c", "mp-c", "user")],
      marketplaceFailures: [addFailed("mp-b", "user", cause)],
      warnings: [warned("b", "mp-b", "user", "marketplace-failed", cause)],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: (options) => addMarketplace(options.rawSource),
        installPlugin: () => Promise.resolve(installedOutcome()),
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "a@mp-a": true, "b@mp-b": true, "c@mp-c": true },
              extraKnownMarketplaces: {
                "mp-a": { directory: "./a" },
                "mp-b": { directory: "./b" },
                "mp-c": { directory: "./c" },
              },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "● mp-a [user] (added)\n  ● a (installed)\n\n" +
          "⊘ mp-b [user] (failed)\n" +
          "  ⊘ mp-b (failed)\n" +
          `    cause: ${cause}\n\n` +
          "● mp-c [user] (added)\n  ● c (installed)\n\n" +
          "Import: 2 failures, 4 successes\n\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

test("ensures every marketplace before installing any plugin and never installs under a blocked one", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "ensure-order");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const calls: string[] = [];

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => {
        calls.push(`add ${options.scope} ${options.rawSource}`);
        return Promise.resolve(
          options.rawSource === "./a" ? failedAddOutcome("clone refused") : addedOutcome("mp-b"),
        );
      },
      installPlugin: (options) => {
        calls.push(`install ${options.scope} ${options.plugin}@${options.marketplace}`);
        return Promise.resolve(installedOutcome());
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "a@mp-a": true, "b@mp-b": true },
            extraKnownMarketplaces: {
              "mp-a": { directory: "./a" },
              "mp-b": { directory: "./b" },
            },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(calls, ["add project ./a", "add project ./b", "install project b@mp-b"]);
  verifyBoundary();
});

// A marketplace already recorded with the same source is a skip, not a re-add.
for (const { declared, stored, title } of [
  { declared: { directory: "./mp" }, stored: pathSource("./mp"), title: "a path source" },
  {
    declared: { github: { repo: "owner/repo" } },
    stored: githubSource("owner", "repo"),
    title: "a github source",
  },
] satisfies readonly {
  readonly declared: Record<string, unknown>;
  readonly stored: MarketplaceSource;
  readonly title: string;
}[]) {
  test(`skips a recorded marketplace and its recorded plugin when ${title} matches the declaration`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "recorded-same");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      skippedExistingMarketplaces: [skipped("mp", "user")],
      skippedExistingPlugins: [skippedPlugin("plugin", "mp", "user")],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "plugin@mp": true },
              extraKnownMarketplaces: { mp: declared },
            }),
          ),
        loadState: () =>
          Promise.resolve(
            recordedState([
              recordedMarketplace({
                name: "mp",
                plugins: ["plugin"],
                scope: "user",
                source: stored,
              }),
            ]),
          ),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user] (skipped) {already added}\n" +
          "  ⊘ plugin (skipped) {already installed}\n\n" +
          "Import: 2 successes",
      },
    ]);
    verifyBoundary();
  });
}

// A recorded marketplace whose source no longer matches the declaration blocks
// every dependent plugin and reports the divergence once per plugin.
for (const { cause, declared, stored, title } of [
  {
    cause: "Existing marketplace source ./mp does not match Claude settings source owner/new.",
    declared: { github: { repo: "owner/new" } },
    stored: pathSource("./mp"),
    title: "the stored kind differs from the declared kind",
  },
  {
    cause:
      "Existing marketplace source https://github.com/owner/old does not match Claude settings source owner/new.",
    declared: { github: { repo: "owner/new" } },
    stored: githubSource("owner", "old"),
    title: "the stored repository differs from the declared repository",
  },
] satisfies readonly {
  readonly cause: string;
  readonly declared: Record<string, unknown>;
  readonly stored: MarketplaceSource;
  readonly title: string;
}[]) {
  test(`reports a source mismatch on every dependent plugin when ${title}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "recorded-different");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      sourceMismatches: [
        mismatched("one", "mp", "project", cause),
        mismatched("two", "mp", "project", cause),
      ],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "one@mp": true, "two@mp": true },
              extraKnownMarketplaces: { mp: declared },
            }),
          ),
        loadState: () =>
          Promise.resolve(
            recordedState([recordedMarketplace({ name: "mp", scope: "project", source: stored })]),
          ),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["project"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "Some operations have failed.\n\n" +
          "⊘ mp [project] (failed)\n" +
          "  ⊘ one (failed) {source mismatch}\n" +
          "  ⊘ two (failed) {source mismatch}\n\n" +
          "Import: 3 failures",
        severity: "error",
      },
    ]);
    verifyBoundary();
  });
}

test("fails a recorded marketplace whose stored source is unrecognized and renders its header", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "recorded-unknown");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const cause = "unrecognized stored source format";
  const diagnosticMessage =
    'Marketplace "mp" has an unrecognized stored source format. ' +
    "Verify state.json or remove and re-add the marketplace.";
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    marketplaceFailures: [addFailed("mp", "user", cause)],
    warnings: [warned("plugin", "mp", "user", "marketplace-failed", cause)],
    diagnostics: [
      {
        code: "unrecognized-stored-source",
        marketplace: "mp",
        message: diagnosticMessage,
        scope: "user",
        severity: "warning",
      },
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({ name: "mp", scope: "user", source: unrecognizedSource() }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [user] (failed)\n" +
        "  ⊘ mp (failed)\n" +
        `    cause: ${cause}\n\n` +
        "Import: 2 failures",
      severity: "error",
    },
    {
      message: `1 import diagnostic surfaced.\n\n${diagnosticMessage}`,
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("MIM-02: adds an extra known marketplace no plugin names after the referenced one and declares both", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "extra-unreferenced");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const calls: string[] = [];

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => {
        calls.push(`add ${options.scope} ${options.rawSource}`);
        return Promise.resolve(addedOutcome(options.rawSource));
      },
      installPlugin: (options) => {
        calls.push(`install ${options.scope} ${options.plugin}@${options.marketplace}`);
        return Promise.resolve(installedOutcome());
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: {
              tools: { github: { repo: "owner/tools" } },
              mp: { directory: "./mp" },
            },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(calls, [
    "add project ./mp",
    "add project owner/tools",
    "install project plugin@mp",
  ]);
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "project"), added("tools", "project")],
    changedResources: true,
    installedPlugins: [installed("plugin", "mp", "project")],
  });
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { mp: { source: "./mp" }, tools: { source: "owner/tools" } },
      plugins: { "plugin@mp": {} },
    }),
  );
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (added)\n  ● plugin (installed)\n\n" +
        "● tools [project] (added)\n\n" +
        "Import: 3 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("D-PL6-01: settings that name only an extra known marketplace still read the scope and add it", async (t) => {
  // arrange
  const { cwd, user } = await createHermeticScopes(t, "extra-only");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const calls: string[] = [];

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => {
        calls.push(`add ${options.scope} ${options.rawSource}`);
        return Promise.resolve(addedOutcome("tools"));
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({ extraKnownMarketplaces: { tools: { directory: "./tools" } } }),
        ),
      loadState: (scope) => {
        calls.push(`read ${scope}`);
        return Promise.resolve(recordedState([]));
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(calls, ["read user", "add user ./tools"]);
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    addedMarketplaces: [added("tools", "user")],
  });
  assert.strictEqual(
    await readFile(user.baseConfigJsonPath, "utf8"),
    configBytes({ marketplaces: { tools: { source: "./tools" } }, plugins: {} }),
  );
  assert.deepStrictEqual(notifications, [
    { message: "● tools [user] (added)\n\nImport: 1 success" },
  ]);
  verifyBoundary();
});

test("D-PL6-09: fails an extra known marketplace no plugin names when its recorded source differs", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "extra-mismatch");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cause = "Existing marketplace source ./old does not match Claude settings source ./tools.";

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({ extraKnownMarketplaces: { tools: { directory: "./tools" } } }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({ name: "tools", scope: "project", source: pathSource("./old") }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    marketplaceFailures: [addFailed("tools", "project", cause)],
  });
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ tools [project] (failed)\n" +
        "  ⊘ tools (failed)\n" +
        `    cause: ${cause}\n\n` +
        "Import: 2 failures",
      severity: "error",
    },
  ]);
  await assert.rejects(stat(project.baseConfigJsonPath), { code: "ENOENT" });
  verifyBoundary();
});

test("warns about a plugin whose marketplace declares no supported source and renders no row for it", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "unmappable");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const unmappableDiagnosticMessage =
    'Skipping Claude marketplace "unknown-mp" because it has no supported url, github, ' +
    "or directory source (nested file/remote-marketplace.json sources are not importable).";
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    diagnostics: [
      {
        code: "unmappable-marketplace-source",
        marketplace: "unknown-mp",
        message: unmappableDiagnosticMessage,
        scope: "user",
        severity: "warning",
      },
    ],
    warnings: [
      warned(
        "plugin",
        "unknown-mp",
        "user",
        "unmappable-marketplace-source",
        "unmappable-marketplace-source",
      ),
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(claudeSettings({ enabledPlugins: { "plugin@unknown-mp": true } })),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    { message: "(no marketplaces)" },
    {
      message: `1 import diagnostic surfaced.\n\n${unmappableDiagnosticMessage}`,
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("carries the settings loader's own diagnostics onto the result", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "settings-diagnostics");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const settingsDiagnostic: Diagnostic = {
    code: "malformed-json",
    message: "Unable to parse Claude base settings file: Unexpected token",
    path: "/claude/settings.json",
    scope: "user",
    severity: "warning",
  };
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    diagnostics: [settingsDiagnostic],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(claudeSettings({ diagnostics: [settingsDiagnostic] })),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    { message: "(no marketplaces)" },
    {
      message: `1 import diagnostic surfaced.\n\n${settingsDiagnostic.message}`,
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

/** IMP-08: the `target@mp` warning of a plugin the resolver cannot install. */
function uninstallable(cause: string, reasons: readonly ContentReason[]): Warning {
  return {
    cause,
    kind: "plugin-warning",
    marketplace: "mp",
    plugin: "target",
    reason: "uninstallable",
    reasons,
    ref: "target@mp",
    scope: "project",
  };
}

// A typed install failure the dispatcher recognises as unavailable or
// uninstallable becomes a warning row. IMP-08: an uninstallable plugin carries
// the reasons `install` narrows from the same resolver verdict. The fault sits
// in the MIDDLE of a three-plugin batch, so the plugin installed before it
// keeps its outcome and the plugin after it is still attempted.
for (const { cause, error, token, title, warning } of [
  {
    cause: 'Plugin "target" not found in marketplace "mp".',
    error: (): Error =>
      new PluginShapeError({ kind: "not-in-manifest", marketplace: "mp", plugin: "target" }),
    token: "not in manifest",
    title: "the plugin is absent from the manifest",
    warning: warned(
      "target",
      "mp",
      "project",
      "unavailable",
      'Plugin "target" not found in marketplace "mp".',
    ),
  },
  {
    cause: "unsupported hooks: PreToolUse",
    error: (): Error =>
      new PluginShapeError({
        kind: "not-installable",
        partialable: false,
        plugin: "target",
        reasons: ["unsupported hooks: PreToolUse"],
      }),
    token: "unsupported hooks",
    title: "the plugin is not installable",
    warning: uninstallable("unsupported hooks: PreToolUse", ["unsupported hooks"]),
  },
  {
    cause: "contains outputStyles",
    error: (): Error =>
      new PluginShapeError({
        kind: "no-longer-installable",
        partialable: true,
        plugin: "target",
        reasons: ["contains outputStyles"],
        unsupportedKinds: ["outputStyles"],
      }),
    token: "unsupported component",
    title: "the plugin is only partially available",
    warning: uninstallable("contains outputStyles", ["unsupported component"]),
  },
] satisfies readonly {
  readonly cause: string;
  readonly error: () => Error;
  readonly token: string;
  readonly title: string;
  readonly warning: Warning;
}[]) {
  test(`warns and keeps installing the batch when ${title}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "install-warning");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const attempted: string[] = [];
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "project")],
      changedResources: true,
      installedPlugins: [installed("before", "mp", "project"), installed("after", "mp", "project")],
      warnings: [warning],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: () => Promise.resolve(addedOutcome("mp")),
        installPlugin: (options) => {
          attempted.push(options.plugin);
          return Promise.resolve(
            options.plugin === "target" ? failedInstallOutcome(error(), cause) : installedOutcome(),
          );
        },
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              // Declaration order is the install order the cascade must preserve,
              // so this inventory is deliberately not alphabetized.
              enabledPlugins: Object.fromEntries(
                ["before", "target", "after"].map((plugin) => [`${plugin}@mp`, true]),
              ),
              extraKnownMarketplaces: { mp: { directory: "./mp" } },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["project"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation needs attention.\n\n" +
          "● mp [project] (added)\n" +
          "  ● before (installed)\n" +
          "  ● after (installed)\n" +
          `  ⊘ target (unavailable) {${token}}\n\n` +
          "Import: 1 warning, 3 successes\n\n" +
          "/reload to pick up changes",
        severity: "warning",
      },
    ]);
    assert.deepStrictEqual(attempted, ["before", "target", "after"]);
    verifyBoundary();
  });
}

// Both routes into the already-installed skip bucket: the shape error the
// installer raises when the record is already present, and the concurrent-install
// sentinel raised when another process won the race.
for (const { error, faulted, order, title } of [
  {
    error: (): Error =>
      new PluginShapeError({ kind: "already-installed", marketplace: "mp", plugin: "target" }),
    faulted: "middle",
    order: ["before", "target", "after"],
    title: "the installer reports the plugin already installed",
  },
  {
    error: (): Error => new ConcurrentInstallError("target", "mp"),
    faulted: "first",
    order: ["target", "before", "after"],
    title: "another process installed the plugin concurrently",
  },
] satisfies readonly {
  readonly error: () => Error;
  readonly faulted: string;
  readonly order: readonly string[];
  readonly title: string;
}[]) {
  test(`skips the plugin and keeps the batch when ${title} (${faulted} entry)`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "install-skip");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const surviving = order.filter((plugin) => plugin !== "target");
    const attempted: string[] = [];
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "user")],
      changedResources: true,
      installedPlugins: surviving.map((plugin) => installed(plugin, "mp", "user")),
      skippedExistingPlugins: [skippedPlugin("target", "mp", "user")],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: () => Promise.resolve(addedOutcome("mp")),
        installPlugin: (options) => {
          attempted.push(options.plugin);
          return Promise.resolve(
            options.plugin === "target"
              ? failedInstallOutcome(error(), "already recorded")
              : installedOutcome(),
          );
        },
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: Object.fromEntries(order.map((plugin) => [`${plugin}@mp`, true])),
              extraKnownMarketplaces: { mp: { directory: "./mp" } },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user] (added)\n" +
          `  ● ${surviving[0]} (installed)\n` +
          `  ● ${surviving[1]} (installed)\n` +
          "  ⊘ target (skipped) {already installed}\n\n" +
          "Import: 4 successes\n\n" +
          "/reload to pick up changes",
      },
    ]);
    assert.deepStrictEqual(attempted, order);
    verifyBoundary();
  });
}

// An install failure the dispatcher does not recognise, reached both by a typed
// error the installer returned and by an installer that threw outright, with the
// fault in first and in middle position.
for (const { cause, installPlugin, order, title } of [
  {
    cause: "disk full",
    installPlugin: (plugin: string): Promise<InstallOutcome> =>
      Promise.resolve(
        plugin === "target"
          ? failedInstallOutcome(new Error("disk full"), "disk full")
          : installedOutcome(),
      ),
    order: ["before", "target", "after"],
    title: "an unrecognized typed error on a middle plugin",
  },
  {
    cause: "host crash",
    installPlugin: (plugin: string): Promise<InstallOutcome> =>
      plugin === "target"
        ? Promise.reject(new Error("host crash"))
        : Promise.resolve(installedOutcome()),
    order: ["target", "before", "after"],
    title: "an installer that throws on the first plugin",
  },
  {
    cause: "host crash",
    installPlugin: (plugin: string): Promise<InstallOutcome> =>
      // A rejection that is not an Error still lands on the row as its text.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the non-Error arm is the case under test.
      plugin === "target" ? Promise.reject("host crash") : Promise.resolve(installedOutcome()),
    order: ["target", "before", "after"],
    title: "an installer that rejects with a bare string",
  },
] satisfies readonly {
  readonly cause: string;
  readonly installPlugin: (plugin: string) => Promise<InstallOutcome>;
  readonly order: readonly string[];
  readonly title: string;
}[]) {
  test(`records an unexpected plugin failure and keeps the batch after ${title}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "install-unexpected");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const surviving = order.filter((plugin) => plugin !== "target");
    const attempted: string[] = [];
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "user")],
      changedResources: true,
      installedPlugins: surviving.map((plugin) => installed(plugin, "mp", "user")),
      unexpectedPluginFailures: [failedUnexpectedly("target", "mp", "user", cause)],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: () => Promise.resolve(addedOutcome("mp")),
        installPlugin: (options) => {
          attempted.push(options.plugin);
          return installPlugin(options.plugin);
        },
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: Object.fromEntries(order.map((plugin) => [`${plugin}@mp`, true])),
              extraKnownMarketplaces: { mp: { directory: "./mp" } },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A plugin operation has failed.\n\n" +
          "● mp [user] (added)\n" +
          `  ● ${surviving[0]} (installed)\n` +
          `  ● ${surviving[1]} (installed)\n` +
          "  ⊘ target (failed)\n" +
          `    cause: ${cause}\n\n` +
          "Import: 1 failure, 3 successes\n\n" +
          "/reload to pick up changes",
        severity: "error",
      },
    ]);
    assert.deepStrictEqual(attempted, order);
    verifyBoundary();
  });
}

// IMP-09: an unclassified failure carries the reason `install`'s failure row
// reads off the same error -- a git host's answer, or the marketplace add an
// install ran -- and the authentication row is bare, as install's is.
test("REC-06: names a rollback the failed install could not finish as rollback partial", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-rollback-partial");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const failure = new Error("failed to stage skill a-fmt: EACCES");

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () =>
        Promise.resolve({
          ...failedInstallOutcome(failure, failure.message),
          rollbackPartials: [{ phase: "skills", msg: "EACCES removing a-fmt" }],
        }),
      loadSettings: () => Promise.resolve(settingsForMp("broken")),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult.unexpectedPluginFailures, [
    {
      ...failedUnexpectedly("broken", "mp", "user", failure.message),
      runtimeReason: "rollback partial",
    },
  ]);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● mp [user] (added)\n" +
        "  ⊘ broken (failed) {rollback partial}\n" +
        `    cause: ${failure.message}\n\n` +
        "Import: 1 failure, 1 success",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("names the reason install gives an unclassified install failure", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-git-host");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const unreachable = Object.assign(new Error("getaddrinfo ENOTFOUND git.example"), {
    code: "ENOTFOUND",
  });
  const refused = Object.assign(new Error("HTTP Error: 401 Unauthorized"), {
    code: "HttpError",
    data: { statusCode: 401 },
  });
  const addFailure = new InstallMarketplaceAddError("source missing", "mp is gone");

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) => {
        const errors = new Map<string, Error>([
          ["offline", unreachable],
          ["private", refused],
        ]);
        const error = errors.get(options.plugin) ?? addFailure;
        return Promise.resolve(failedInstallOutcome(error, error.message));
      },
      loadSettings: () => Promise.resolve(settingsForMp("offline", "private", "unlisted")),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult.unexpectedPluginFailures, [
    {
      ...failedUnexpectedly("offline", "mp", "user", unreachable.message),
      runtimeReason: "network unreachable",
    },
    {
      ...failedUnexpectedly("private", "mp", "user", refused.message),
      runtimeReason: "authentication required",
    },
    {
      ...failedUnexpectedly("unlisted", "mp", "user", addFailure.message),
      runtimeReason: "source missing",
    },
  ]);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some plugin operations have failed.\n\n" +
        "● mp [user] (added)\n" +
        "  ⊘ offline (failed) {network unreachable}\n" +
        `    cause: ${unreachable.message}\n` +
        "  ⊘ private (failed) {authentication required}\n" +
        "  ⊘ unlisted (failed) {source missing}\n" +
        "    cause: mp is gone\n\n" +
        "Import: 3 failures, 1 success",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("GHB-03: an installer failing on an invalid base fails the whole import", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-invalid-base");
  const { ctx, verifyBoundary } = createNotificationBoundary(0);
  const invalid = new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme");
  const attempted: string[] = [];

  // act & assert
  await assert.rejects(
    () =>
      importClaudeSettings({
        ctx,
        run: runWithNothingLoaded(),
        cwd,
        deps: collaborators({
          addMarketplace: () => Promise.resolve(addedOutcome("mp")),
          installPlugin: (options) => {
            attempted.push(options.plugin);
            return Promise.reject(invalid);
          },
          loadSettings: () =>
            Promise.resolve(
              claudeSettings({
                enabledPlugins: { "target@mp": true, "after@mp": true },
                extraKnownMarketplaces: { mp: { directory: "./mp" } },
              }),
            ),
          loadState: () => Promise.resolve(recordedState([])),
        }),
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        selectedScopes: ["user"],
      }),
    (error: unknown) => {
      assert.strictEqual(error, invalid);
      return true;
    },
  );
  assert.deepStrictEqual(attempted, ["target"]);
  verifyBoundary();
});

test("GHB-01: a marketplace add failing under the GitHub base override names the fetched URL", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "add-fetched-url");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const error = Object.assign(new Error("HTTP Error: 404"), {
    code: "HttpError",
    data: { statusCode: 404 },
    cause: new FetchedUrlCause("https://mirror.example/git/owner/mp.git"),
  });
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    marketplaceFailures: [
      {
        ...addFailed("mp", "user", "HTTP Error: 404"),
        causeChain: new Error("fetched https://mirror.example/git/owner/mp.git"),
      },
    ],
    warnings: [warned("p", "mp", "user", "marketplace-failed", "HTTP Error: 404")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () =>
        Promise.resolve({
          status: "failed",
          reason: "source missing",
          error,
          cause: "HTTP Error: 404",
        }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "p@mp": true },
            extraKnownMarketplaces: { mp: { github: { repo: "owner/mp" } } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [user] (failed)\n" +
        "  ⊘ mp (failed)\n" +
        "    cause: HTTP Error: 404 -> fetched https://mirror.example/git/owner/mp.git\n\n" +
        "Import: 2 failures",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("GHB-03: a marketplace add failing on an invalid base fails the whole import", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "add-invalid-base");
  const { ctx, verifyBoundary } = createNotificationBoundary(0);
  const invalid = new InvalidGitHubBaseUrlError("PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL", "scheme");
  const attempted: string[] = [];

  // act & assert
  await assert.rejects(
    () =>
      importClaudeSettings({
        ctx,
        run: runWithNothingLoaded(),
        cwd,
        deps: collaborators({
          addMarketplace: (options) => {
            attempted.push(options.rawSource);
            return Promise.reject(invalid);
          },
          loadSettings: () =>
            Promise.resolve(
              claudeSettings({
                enabledPlugins: { "a@mp-a": true, "b@mp-b": true },
                extraKnownMarketplaces: {
                  "mp-a": { directory: "./a" },
                  "mp-b": { directory: "./b" },
                },
              }),
            ),
          loadState: () => Promise.resolve(recordedState([])),
        }),
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        selectedScopes: ["user"],
      }),
    (error: unknown) => {
      assert.strictEqual(error, invalid);
      return true;
    },
  );
  assert.deepStrictEqual(attempted, ["./a"]);
  verifyBoundary();
});

// A `DependencyCascadeError` thrown by a dependency cascade (closure,
// constraint, or a dependency member's own ledger, RESV-06) must name the
// dependency: a reasonless unexpected-failure row would leave the requesting
// plugin's row beside a cause line about another plugin.
test("records a dependency-cascade failure with the dependency-failed reason", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-dependency-cascade");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  // The dependency's own ledger failure names a staged file by absolute
  // path; the row must carry only its basename (T-55-02-02 / T-53-02-02).
  const cause =
    'Dependency "lib@mp" failed: malformed JSON at /home/user/.pi/agent/plugin-clones/lib/plugin.json';
  const redactedCause = 'Dependency "lib@mp" failed: malformed JSON at plugin.json';
  const order = ["before", "target", "after"];
  const surviving = order.filter((plugin) => plugin !== "target");
  const attempted: string[] = [];
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    installedPlugins: surviving.map((plugin) => installed(plugin, "mp", "user")),
    unexpectedPluginFailures: [failedDependency("target", "mp", "user", redactedCause)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) => {
        attempted.push(options.plugin);
        return Promise.resolve(
          options.plugin === "target"
            ? failedInstallOutcome(new DependencyCascadeError(cause, "lib@mp"), cause)
            : installedOutcome(),
        );
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: Object.fromEntries(order.map((plugin) => [`${plugin}@mp`, true])),
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● mp [user] (added)\n" +
        `  ● ${surviving[0]} (installed)\n` +
        `  ● ${surviving[1]} (installed)\n` +
        "  ⊘ target (failed) {dependency failed}\n" +
        `    cause: ${redactedCause}\n\n` +
        "Import: 1 failure, 3 successes\n\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(attempted, order);
  verifyBoundary();
});

// A dependency's own ledger failure can itself wrap a nested cause (e.g. an
// errno from the bridge that staged it). `dispatchFailedOutcome` must render
// that chain exactly once: the row's `cause:` line joins the head and the
// nested link with " -> ", never a second `cause:` line grown from
// re-wrapping an already-flattened trailer (T-55-02-02 / T-53-02-02).
test("records a dependency-cascade failure whose ledger error carries a nested cause without double-rendering it", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-dependency-cascade-nested-cause");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const headCause = 'Dependency "lib@mp" could not be staged: command "lib:deploy" failed.';
  const nestedCause = new Error(
    "EACCES: permission denied, open '/home/user/.pi/agent/plugin-clones/lib/deploy.md'",
  );
  const redactedNestedMessage = "EACCES: permission denied, open 'deploy.md'";
  const order = ["before", "target", "after"];
  const surviving = order.filter((plugin) => plugin !== "target");
  const attempted: string[] = [];
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    installedPlugins: surviving.map((plugin) => installed(plugin, "mp", "user")),
    unexpectedPluginFailures: [
      failedDependency("target", "mp", "user", headCause, new Error(redactedNestedMessage)),
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) => {
        attempted.push(options.plugin);
        return Promise.resolve(
          options.plugin === "target"
            ? failedInstallOutcome(
                new DependencyCascadeError(headCause, "lib@mp", { cause: nestedCause }),
                // The dispatcher derives its row from the typed error, not this
                // pre-flattened string -- an arbitrary placeholder proves it.
                "unused-flattened-cause",
              )
            : installedOutcome(),
        );
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: Object.fromEntries(order.map((plugin) => [`${plugin}@mp`, true])),
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● mp [user] (added)\n" +
        `  ● ${surviving[0]} (installed)\n` +
        `  ● ${surviving[1]} (installed)\n` +
        "  ⊘ target (failed) {dependency failed}\n" +
        `    cause: ${headCause} -> ${redactedNestedMessage}\n\n` +
        "Import: 1 failure, 3 successes\n\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(attempted, order);
  verifyBoundary();
});

// The generic `unexpected-failure` fallthrough shares the same defect surface
// as the dependency-cascade arm: any orchestrated error with a nested cause
// (e.g. a bridge-staging error wrapping an errno) must render its chain
// exactly once.
test("records an unexpected plugin failure whose error carries a nested cause without double-rendering it", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-unexpected-nested-cause");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const headCause = 'command "target:build" of plugin "target" could not be staged';
  const nestedCause = new Error(
    "EACCES: permission denied, open '/home/user/.pi/agent/plugin-clones/target/build.md'",
  );
  const redactedNestedMessage = "EACCES: permission denied, open 'build.md'";
  const order = ["before", "target", "after"];
  const surviving = order.filter((plugin) => plugin !== "target");
  const attempted: string[] = [];
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    installedPlugins: surviving.map((plugin) => installed(plugin, "mp", "user")),
    unexpectedPluginFailures: [
      failedUnexpectedly("target", "mp", "user", headCause, new Error(redactedNestedMessage)),
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) => {
        attempted.push(options.plugin);
        return Promise.resolve(
          options.plugin === "target"
            ? failedInstallOutcome(
                new Error(headCause, { cause: nestedCause }),
                // The dispatcher derives its row from the typed error, not this
                // pre-flattened string -- an arbitrary placeholder proves it.
                "unused-flattened-cause",
              )
            : installedOutcome(),
        );
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: Object.fromEntries(order.map((plugin) => [`${plugin}@mp`, true])),
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● mp [user] (added)\n" +
        `  ● ${surviving[0]} (installed)\n` +
        `  ● ${surviving[1]} (installed)\n` +
        "  ⊘ target (failed)\n" +
        `    cause: ${headCause} -> ${redactedNestedMessage}\n\n` +
        "Import: 1 failure, 3 successes\n\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  assert.deepStrictEqual(attempted, order);
  verifyBoundary();
});

// The installed outcome's three soft-dependency predicates ride onto the public
// outcome and onto the cascade row's marker brace. The boundary reports no
// companion extension loaded, so a declared dependency always surfaces.
// WDEP-02: `workflows` composes LAST, so the agents/mcp brace forms are the same
// bytes whether or not the row also declares workflows.
for (const { declaresAgents, declaresMcp, declaresWorkflows, marker } of [
  { declaresAgents: false, declaresMcp: false, declaresWorkflows: false, marker: "" },
  {
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
    marker: " {requires pi-subagents}",
  },
  {
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
    marker: " {requires pi-mcp-adapter}",
  },
  {
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: true,
    marker: " {requires pi-dynamic-workflows}",
  },
  {
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
    marker: " {requires pi-subagents, requires pi-mcp-adapter}",
  },
  {
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: true,
    marker: " {requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}",
  },
] satisfies readonly {
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly declaresWorkflows: boolean;
  readonly marker: string;
}[]) {
  test(`propagates declaresAgents ${declaresAgents}, declaresMcp ${declaresMcp} and declaresWorkflows ${declaresWorkflows} onto the outcome and the cascade row`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "declares");
    const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "user")],
      changedResources: true,
      installedPlugins: [
        installed("plugin", "mp", "user", {
          agents: declaresAgents,
          mcp: declaresMcp,
          workflows: declaresWorkflows,
        }),
      ],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({
        addMarketplace: () => Promise.resolve(addedOutcome("mp")),
        installPlugin: () =>
          Promise.resolve({
            ...installedOutcome(),
            declaresAgents,
            declaresMcp,
            declaresWorkflows,
          }),
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "plugin@mp": true },
              extraKnownMarketplaces: { mp: { directory: "./mp" } },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          `● mp [user] (added)\n  ● plugin (installed)${marker}\n\n` +
          "Import: 2 successes\n\n" +
          "/reload to pick up changes",
      },
    ]);
    verifyBoundary();
  });
}

test("shows the version the install resolved on the installed row", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "installed-version");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    installedPlugins: [{ ...installed("plugin", "mp", "user"), version: "1.2.0" }],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () => Promise.resolve({ ...installedOutcome(), version: "1.2.0" }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (added)\n  ● plugin v1.2.0 (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("records each post-commit warning the installed outcome carried as its own diagnostic", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "post-commit");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    diagnostics: [
      {
        code: "post-install-warning",
        message: "data directory creation deferred: ENOSPC",
        ref: "plugin@mp",
        scope: "user",
        severity: "warning",
      },
      {
        code: "post-install-warning",
        message: "hook registration deferred: EACCES",
        ref: "plugin@mp",
        scope: "user",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("plugin", "mp", "user")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () =>
        Promise.resolve({
          ...installedOutcome(),
          postCommitWarnings: [
            "data directory creation deferred: ENOSPC",
            "hook registration deferred: EACCES",
          ],
        }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (added)\n  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message:
        "2 import diagnostics surfaced.\n\n" +
        "data directory creation deferred: ENOSPC\n" +
        "hook registration deferred: EACCES",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("AFILE-04: import over a commented mcp-adapter.json shows the comments-removed notice after its cascade", async (t) => {
  // arrange -- the installed plugin and the failed one each report a rewrite of
  // the same user-scope adapter file, and the failed one also of mcp.json.
  const { cwd } = await createHermeticScopes(t, "mcp-config-notices");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
  const adapterNotice = {
    kind: "comments-dropped",
    scope: "user",
    file: "mcp-adapter.json",
  } as const;
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    diagnostics: [
      {
        code: "post-install-warning",
        message: "hook registration deferred: EACCES",
        ref: "alpha@mp",
        scope: "user",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("alpha", "mp", "user")],
    unexpectedPluginFailures: [failedUnexpectedly("target", "mp", "user", "disk full")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) =>
        Promise.resolve(
          options.plugin === "alpha"
            ? {
                ...installedOutcome(),
                postCommitWarnings: ["hook registration deferred: EACCES"],
                mcpConfigNotices: [adapterNotice],
              }
            : {
                ...failedInstallOutcome(new Error("disk full"), "disk full"),
                mcpConfigNotices: [
                  adapterNotice,
                  { kind: "comments-dropped", scope: "user", file: "mcp.json" },
                ],
              },
        ),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "alpha@mp": true, "target@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A plugin operation has failed.\n\n" +
        "● mp [user] (added)\n" +
        "  ● alpha (installed)\n" +
        "  ⊘ target (failed)\n" +
        "    cause: disk full\n\n" +
        "Import: 1 failure, 2 successes\n\n" +
        "/reload to pick up changes",
      severity: "error",
    },
    {
      message: "1 import diagnostic surfaced.\n\nhook registration deferred: EACCES",
      severity: "warning",
    },
    {
      message:
        "MCP config comments removed.\n\n" +
        "The user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.\n" +
        "The user-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

/**
 * AVAR-04: plugin `hello` declares a stdio server that reads the unset
 * `PI_CM_AVAR_SITE` and a remote server that sends the set
 * `ANTHROPIC_API_KEY`, which Claude Code never sends to a remote server. The
 * project settings declare it enabled.
 */
async function seedVariableNoticePlugin(t: TestContext): Promise<{ cwd: string }> {
  const savedSite = process.env.PI_CM_AVAR_SITE;
  const savedCredential = process.env.ANTHROPIC_API_KEY;
  t.after(() => {
    for (const [name, saved] of [
      ["PI_CM_AVAR_SITE", savedSite],
      ["ANTHROPIC_API_KEY", savedCredential],
    ] as const) {
      if (saved === undefined) {
        Reflect.deleteProperty(process.env, name);
      } else {
        process.env[name] = saved;
      }
    }
  });
  delete process.env.PI_CM_AVAR_SITE;
  process.env.ANTHROPIC_API_KEY = "avar-sentinel-04-09";
  const { cwd } = await createHermeticScopes(t, "mcp-variable-notices");
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version: "1.0.0" }],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "hello", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "hello", ".mcp.json"),
    JSON.stringify({
      mcpServers: {
        local: { command: "node", args: ["--site", "${PI_CM_AVAR_SITE}"] },
        api: {
          type: "http",
          url: "https://mcp.example.test/mcp",
          headers: { Authorization: "Bearer ${ANTHROPIC_API_KEY}" },
        },
      },
    }),
  );
  await writeUnder(
    path.join(cwd, ".claude", "settings.json"),
    settingsNaming(marketplaceRoot, { "hello@fixture-mp": true }),
  );
  return { cwd };
}

/** AVAR-04 / AVAR-05: the two notices an import of the seeded `hello` sends. */
function variableNotices(): Array<{ message: string; severity: "warning" }> {
  return [
    {
      message:
        "MCP server variables not set.\n\n" +
        'Server "plugin_hello_local_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: PI_CM_AVAR_SITE.',
      severity: "warning",
    },
    {
      message:
        "MCP server credentials withheld.\n\n" +
        'Server "plugin_hello_api_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
      severity: "warning",
    },
  ];
}

test("AVAR-04: an import reports the unset variable and the withheld credential after its cascade", async (t) => {
  // arrange
  const { cwd } = await seedVariableNoticePlugin(t);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);

  // act
  await importClaudeSettings({
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● fixture-mp [project] (added)\n" +
        "  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    ...variableNotices(),
  ]);
  assert.deepStrictEqual(
    notifications.filter(({ message }) => message.includes("avar-sentinel-04-09")),
    [],
  );
  verifyBoundary();
});

test("AVAR-04 / AVAR-05: with pi-mcp-adapter loaded, an import reports an info row and the MCP notices as separate warnings (D-08-03)", async (t) => {
  // arrange
  const { cwd } = await seedVariableNoticePlugin(t);
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
  const run = runWithSoftDeps({
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: false,
  });

  // act
  await importClaudeSettings({
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● fixture-mp [project] (added)\n" +
        "  ● hello v1.0.0 (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    ...variableNotices(),
  ]);
  verifyBoundary();
});

test("reports no changed resources when every install left the Pi resource set alone", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "no-resource-change");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    installedPlugins: [installed("plugin", "mp", "user", { agents: false, mcp: false }, false)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () => Promise.resolve({ ...installedOutcome(), resourcesChanged: false }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (added)\n  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("UPD-DEP-D1 / WR-N5 / WR-3: lists every dependency change an install made beside its row", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "dependency-changes");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    changedResources: true,
    installedPlugins: [installed("plugin", "mp", "user", { agents: false, mcp: false }, false)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () =>
        Promise.resolve({
          ...installedOutcome(),
          resourcesChanged: false,
          movedDependencies: [
            {
              key: "lib@mp",
              name: "lib",
              marketplace: "mp",
              row: {
                status: "updated",
                name: "lib@mp",
                from: "1.0.0",
                to: "2.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            },
          ],
          dependencyInstalls: [
            {
              key: "ggg@mp",
              name: "ggg",
              marketplace: "mp",
              row: {
                status: "installed",
                name: "ggg@mp",
                version: "1.0.0",
                dependencies: [],
                severity: "info",
                needsReload: true,
              },
            },
          ],
        }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (added)\n  ● plugin (installed)\n  ● lib@mp v1.0.0 → v2.0.0 (updated)\n" +
        "  ● ggg@mp v1.0.0 (installed)\n\n" +
        "Import: 4 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("UPD-DEP-D1 / WR-N5: lists the changes a failed install made, the failing one included", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "dependency-changes-failed");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cause = 'Dependency "aaa@mp" did not move into ^2.0.0.';
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    unexpectedPluginFailures: [failedDependency("plugin", "mp", "user", cause)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () =>
        Promise.resolve({
          ...failedInstallOutcome(new DependencyCascadeError(cause, "aaa@mp"), cause),
          movedDependencies: [
            {
              key: "aaa@mp",
              name: "aaa",
              marketplace: "mp",
              row: {
                status: "failed",
                name: "aaa@mp",
                version: "1.0.0",
                reasons: [],
                cause: new Error("permission denied"),
                severity: "error",
              },
            },
          ],
        }),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some plugin operations have failed.\n\n" +
        "● mp [user] (added)\n" +
        "  ⊘ plugin (failed) {dependency failed}\n" +
        `    cause: ${cause}\n` +
        "  ⊘ aaa@mp v1.0.0 (failed)\n" +
        "    cause: permission denied\n\n" +
        "Import: 2 failures, 1 success",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("installs only the plugin the state does not already record under a recorded marketplace", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "mixed-plugins");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const attempted: string[] = [];
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [installed("fresh", "mp", "user")],
    skippedExistingMarketplaces: [skipped("mp", "user")],
    skippedExistingPlugins: [skippedPlugin("recorded", "mp", "user")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      installPlugin: (options) => {
        attempted.push(options.plugin);
        return Promise.resolve(installedOutcome());
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "fresh@mp": true, "recorded@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "mp",
              plugins: ["recorded"],
              scope: "user",
              source: pathSource("./mp"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (skipped) {already added}\n" +
        "  ● fresh (installed)\n" +
        "  ⊘ recorded (skipped) {already installed}\n\n" +
        "Import: 3 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(attempted, ["fresh"]);
  verifyBoundary();
});

test("installs every plugin in orchestrated mode and never opts in to the default-enabled policy", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "install-options");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const requested: InstallOptions[] = [];

  // act
  await importClaudeSettings({
    ctx,
    run,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: (options) => {
        requested.push(options);
        return Promise.resolve(installedOutcome());
      },
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "alpha@mp": true, "beta@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(requested, [
    {
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      plugin: "alpha",
      run,
      scope: "project",
    },
    {
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      plugin: "beta",
      run,
      scope: "project",
    },
  ]);
  verifyBoundary();
});

test("abandons only the scope whose state cannot be read and records why", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "state-unreadable");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp-project", "project")],
    changedResources: true,
    diagnostics: [
      {
        code: "settings-read-error",
        message: "Cannot read user scope state: state.json is unreadable",
        scope: "user",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("plugin", "mp-project", "project")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp-project")),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: (scope) =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { [`plugin@mp-${scope}`]: true },
            extraKnownMarketplaces: { [`mp-${scope}`]: { directory: `./${scope}` } },
          }),
        ),
      loadState: (scope) =>
        scope === "user"
          ? Promise.reject(new Error("state.json is unreadable"))
          : Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-project [project] (added)\n  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message:
        "1 import diagnostic surfaced.\n\nCannot read user scope state: state.json is unreadable",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("keeps each selected scope's marketplaces and plugins independent and renders both blocks", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "two-scopes");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const calls: string[] = [];
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user"), added("mp", "project")],
    changedResources: true,
    installedPlugins: [installed("plugin", "mp", "user"), installed("plugin", "mp", "project")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => {
        calls.push(`add ${options.scope} ${options.rawSource}`);
        return Promise.resolve(addedOutcome("mp"));
      },
      installPlugin: (options) => {
        calls.push(`install ${options.scope} ${options.plugin}`);
        return Promise.resolve(installedOutcome());
      },
      loadSettings: (scope) =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: `./${scope}-mp` } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (added)\n  ● plugin (installed)\n\n" +
        "● mp [user] (added)\n  ● plugin (installed)\n\n" +
        "Import: 4 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  assert.deepStrictEqual(calls, [
    "add user ./user-mp",
    "install user plugin",
    "add project ./project-mp",
    "install project plugin",
  ]);
  verifyBoundary();
});

/** The exact bytes `claude-plugins.json` carries after a batched post-pass. */
function configBytes(declared: {
  readonly marketplaces: Record<string, { readonly source: string }>;
  readonly plugins: Record<string, { readonly enabled?: boolean }>;
}): string {
  return `${JSON.stringify({ schemaVersion: 1, ...declared }, null, 2)}\n`;
}

test("declares every added marketplace and installed plugin in the persisted config", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-happy");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { mp1: { source: "owner/mp1" }, mp2: { source: "owner/mp2" } },
    plugins: { "p1@mp1": {}, "p2@mp1": {}, "p3@mp2": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => Promise.resolve(addedOutcome(options.rawSource)),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "p1@mp1": true, "p2@mp1": true, "p3@mp2": true },
            extraKnownMarketplaces: {
              mp1: { github: { repo: "owner/mp1" } },
              mp2: { github: { repo: "owner/mp2" } },
            },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("leaves the config byte-identical when the batch carries nothing to declare", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-empty");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  await createScopeRoots(project);
  const seededBytes = `${JSON.stringify({ schemaVersion: 1, futureKey: "preserved" }, null, 2)}\n`;
  await writeFile(project.baseConfigJsonPath, seededBytes, "utf8");

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(undefined),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "p1@mp1": true },
            extraKnownMarketplaces: { mp1: { github: { repo: "owner/mp1" } } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), seededBytes);
  verifyBoundary();
});

test("declares only the entries whose marketplace and install both succeeded", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-mixed");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { mp1: { source: "owner/mp1" } },
    plugins: { "p1@mp1": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) =>
        Promise.resolve(options.rawSource === "owner/mp1" ? addedOutcome("owner/mp1") : undefined),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "p1@mp1": true, "p2@mp2": true },
            extraKnownMarketplaces: {
              mp1: { github: { repo: "owner/mp1" } },
              mp2: { github: { repo: "owner/mp2" } },
            },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("abandons the post-pass for a scope whose config is invalid and still writes the other scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "batch-invalid");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  await createScopeRoots(project, user);
  const invalidBytes = "{ not valid json";
  await writeFile(user.baseConfigJsonPath, invalidBytes, "utf8");
  const expectedProjectBytes = configBytes({
    marketplaces: { "mp-project": { source: "owner/mp-project" } },
    plugins: { "p@mp-project": {} },
  });
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp-user", "user"), added("mp-project", "project")],
    changedResources: true,
    diagnostics: [
      {
        code: "settings-read-error",
        message: "Cannot write user scope claude-plugins.json: existing file is invalid.",
        scope: "user",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("p", "mp-user", "user"), installed("p", "mp-project", "project")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) => Promise.resolve(addedOutcome(options.rawSource)),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: (scope) =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { [`p@mp-${scope}`]: true },
            extraKnownMarketplaces: { [`mp-${scope}`]: { github: { repo: `owner/mp-${scope}` } } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.strictEqual(await readFile(user.baseConfigJsonPath, "utf8"), invalidBytes);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedProjectBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-project [project] (added)\n  ● p (installed)\n\n" +
        "● mp-user [user] (added)\n  ● p (installed)\n\n" +
        "Import: 4 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message:
        "1 import diagnostic surfaced.\n\n" +
        "Cannot write user scope claude-plugins.json: existing file is invalid.",
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

test("declares a missing config entry for a marketplace and plugin the state already records", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "repair");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "plugin@mp": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "mp",
              plugins: ["plugin"],
              scope: "project",
              source: pathSource("./mp"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

// LAYER-06: the second scope plan repairs the plugin the first plan skipped,
// but by then a hand edit has removed the first plan's declarations, and the
// second plan names no source for that plugin's marketplace. A repaired plugin
// key without its marketplace would make the base layer fail its next load.
test("LAYER-06: writes no repaired plugin key whose marketplace neither the batch nor the file declares", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "repair-no-marketplace");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const editedBytes = configBytes({ marketplaces: {}, plugins: {} });
  const expectedBytes = configBytes({
    marketplaces: { "mp-b": { source: "./b" } },
    plugins: { "b@mp-b": {} },
  });
  const state = recordedState([
    recordedMarketplace({
      name: "mp-a",
      plugins: ["a"],
      scope: "project",
      source: pathSource("./a"),
    }),
    recordedMarketplace({
      name: "mp-b",
      plugins: ["b"],
      scope: "project",
      source: pathSource("./b"),
    }),
  ]);
  let stateReads = 0;

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: settingsSequence([
        claudeSettings({
          enabledPlugins: { "a@mp-a": true },
          extraKnownMarketplaces: { "mp-a": { directory: "./a" } },
        }),
        claudeSettings({
          enabledPlugins: { "b@mp-b": true },
          extraKnownMarketplaces: { "mp-b": { directory: "./b" } },
        }),
      ]),
      loadState: async () => {
        stateReads += 1;
        if (stateReads === 2) {
          await writeFile(project.baseConfigJsonPath, editedBytes, "utf8");
        }

        return state;
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("leaves an already-declared config byte-identical when every entry was a skip", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "repair-declared");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  await createScopeRoots(project);
  const seededBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "plugin@mp": {} },
  });
  await writeFile(project.baseConfigJsonPath, seededBytes, "utf8");

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "mp",
              plugins: ["plugin"],
              scope: "project",
              source: pathSource("./mp"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), seededBytes);
  verifyBoundary();
});

test("repairs each scope's own config and never leaks the other scope's recorded entries", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "repair-scoped");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedUserBytes = configBytes({
    marketplaces: { "mp-user": { source: "./user" } },
    plugins: { "p-user@mp-user": {} },
  });
  const expectedProjectBytes = configBytes({
    marketplaces: { "mp-project": { source: "./project" } },
    plugins: { "p-project@mp-project": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: (scope) =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { [`p-${scope}@mp-${scope}`]: true },
            extraKnownMarketplaces: { [`mp-${scope}`]: { directory: `./${scope}` } },
          }),
        ),
      loadState: (scope) =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: `mp-${scope}`,
              plugins: [`p-${scope}`],
              scope,
              source: pathSource(`./${scope}`),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.strictEqual(await readFile(user.baseConfigJsonPath, "utf8"), expectedUserBytes);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedProjectBytes);
  verifyBoundary();
});

test("skips a recorded marketplace the later scope plan never declared when building its patch", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "patch-undeclared-add");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { "mp-a": { source: "./a" }, "mp-b": { source: "./b" } },
    plugins: { "a@mp-a": {}, "b@mp-b": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: (options) =>
        Promise.resolve(addedOutcome(options.rawSource === "./a" ? "mp-a" : "mp-b")),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: settingsSequence([
        claudeSettings({
          enabledPlugins: { "a@mp-a": true },
          extraKnownMarketplaces: { "mp-a": { directory: "./a" } },
        }),
        claudeSettings({
          enabledPlugins: { "b@mp-b": true },
          extraKnownMarketplaces: { "mp-b": { directory: "./b" } },
        }),
      ]),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-a [project] (added)\n  ● a (installed)\n\n" +
        "● mp-b [project] (added)\n  ● b (installed)\n\n" +
        "Import: 4 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

// The repair builder's undeclared-source guard is REACHED here, but it is not
// discriminating on its own: any marketplace that reaches a later plan's repair
// without a declared source was already written into the config by the plan that
// skipped it, so `mergeEnsureAndRepairs` would drop it anyway. What this case
// does claim is the observable outcome -- both scope plans converge on one
// config declaring both recorded marketplaces and both recorded plugins.
test("skips a repair for a marketplace the later scope plan never declared", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "patch-undeclared-repair");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { "mp-a": { source: "./a" }, "mp-b": { source: "./b" } },
    plugins: { "a@mp-a": {}, "b@mp-b": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: settingsSequence([
        claudeSettings({
          enabledPlugins: { "a@mp-a": true },
          extraKnownMarketplaces: { "mp-a": { directory: "./a" } },
        }),
        claudeSettings({
          enabledPlugins: { "b@mp-b": true },
          extraKnownMarketplaces: { "mp-b": { directory: "./b" } },
        }),
      ]),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "mp-a",
              plugins: ["a"],
              scope: "project",
              source: pathSource("./a"),
            }),
            recordedMarketplace({
              name: "mp-b",
              plugins: ["b"],
              scope: "project",
              source: pathSource("./b"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-a [project] (skipped) {already added}\n  ⊘ a (skipped) {already installed}\n\n" +
        "● mp-b [project] (skipped) {already added}\n  ⊘ b (skipped) {already installed}\n\n" +
        "Import: 4 successes",
    },
  ]);
  verifyBoundary();
});

test("records a diagnostic and keeps the result when the batched config write fails", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-write-fails");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  // A regular file where the extension root belongs, placed by the install
  // after the read pass released the lock: taking the scope lock again has to
  // create that directory first, so the post-pass fails before any write.
  const replaceRootWithFile = async (): Promise<InstallOutcome> => {
    await rm(project.extensionRoot, { recursive: true, force: true });
    await writeFile(project.extensionRoot, "not a directory", "utf8");
    return installedOutcome();
  };

  const writeFailureMessage =
    "Failed to write project scope claude-plugins.json batched post-pass: " +
    `EEXIST: file already exists, mkdir '${project.extensionRoot}'`;
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "project")],
    changedResources: true,
    diagnostics: [
      {
        code: "settings-write-error",
        message: writeFailureMessage,
        scope: "project",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("plugin", "mp", "project")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: replaceRootWithFile,
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (added)\n  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message: `1 import diagnostic surfaced.\n\n${writeFailureMessage}`,
      severity: "warning",
    },
  ]);
  verifyBoundary();
});

/** Write `bytes` at `filePath`, creating the parent directory first. */
async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

/**
 * The Claude settings document that names `enabledPlugins` under the one
 * path-sourced fixture marketplace at `marketplaceRoot`.
 */
function settingsNaming(marketplaceRoot: string, enabledPlugins: Record<string, boolean>): string {
  return JSON.stringify({
    enabledPlugins,
    extraKnownMarketplaces: { "fixture-mp": { directory: marketplaceRoot } },
  });
}

async function seedHookRoute(
  hooksRouting: HooksRouting,
  cwd: string,
  marketplace: string,
  plugin: string,
  command: string,
): Promise<void> {
  const pluginRoot = path.join(cwd, `${marketplace}-${plugin}`);
  const hooksJsonPath = path.join(pluginRoot, "hooks", "hooks.json");
  await writeUnder(
    hooksJsonPath,
    JSON.stringify({
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command }] }],
    }),
  );
  await hooksRouting.readAndCachePluginHooks({
    cwd,
    hooksJsonPath,
    logPrefix: "import owner route fixture",
    marketplace,
    plugin,
    resolvedSource: asAbsolutePluginRoot(pluginRoot),
    scope: "project",
  });
  hooksRouting.rebuildRoutingTables();
}

function preToolUseRoutes(runtime: HooksRuntime): readonly {
  readonly command: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly scope: Scope;
}[] {
  return runtime.getRoutingBucket("PreToolUse").map((entry) => {
    const command = entry.handlerDecl.command;
    if (command === undefined) {
      throw new Error("the PreToolUse fixture must declare a command handler");
    }

    return {
      command,
      marketplace: entry.marketplace,
      plugin: entry.pluginId,
      scope: entry.scope,
    };
  });
}

test("resolves every collaborator from production when the caller supplies no dependency bundle", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "no-deps");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const ownerRuntime = createHooksRuntime();
  const peerRuntime = createHooksRuntime();
  const hooksRouting = createHooksRouting(ownerRuntime, { readHooksJson });
  const peerHooksRouting = createHooksRouting(peerRuntime, { readHooksJson });
  await seedHookRoute(hooksRouting, cwd, "unrelated-mp", "unrelated", "echo unrelated");
  await seedHookRoute(peerHooksRouting, cwd, "peer-mp", "peer", "echo peer");
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [{ name: "sample", source: "./plugins/sample", version: "1.0.0" }],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", "hooks", "hooks.json"),
    JSON.stringify({
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo imported" }] }],
    }),
  );
  await writeUnder(
    path.join(cwd, ".claude", "settings.json"),
    JSON.stringify({
      enabledPlugins: { "sample@fixture-mp": true },
      extraKnownMarketplaces: { "fixture-mp": { directory: marketplaceRoot } },
    }),
  );
  const expectedFirstResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("fixture-mp", "project")],
    installedPlugins: [
      {
        ...installed("sample", "fixture-mp", "project", { agents: false, mcp: false }, false),
        version: "1.0.0",
      },
    ],
  };
  // The second run reads the state the first run committed, so a default state
  // loader that answered with an empty snapshot would add and install again
  // instead of reporting the two skips below.
  const expectedSecondResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [skippedPlugin("sample", "fixture-mp", "project")],
  };
  const expectedBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "sample@fixture-mp": {} },
  });
  const importOptions = {
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    gitOps: createOfflineGitOps(),
    hooksRouting,
    selectedScopes: ["project"] as const,
  };

  // act
  const firstResult = await importClaudeSettings(importOptions);
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  assert.deepStrictEqual(firstResult, expectedFirstResult);
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(preToolUseRoutes(ownerRuntime), [
    {
      command: "echo imported",
      marketplace: "fixture-mp",
      plugin: "sample",
      scope: "project",
    },
    {
      command: "echo unrelated",
      marketplace: "unrelated-mp",
      plugin: "unrelated",
      scope: "project",
    },
  ]);
  assert.deepStrictEqual(preToolUseRoutes(peerRuntime), [
    { command: "echo peer", marketplace: "peer-mp", plugin: "peer", scope: "project" },
  ]);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● fixture-mp [project] (added)\n  ● sample v1.0.0 (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message:
        "● fixture-mp [project] (skipped) {already added}\n  ⊘ sample (skipped) {already installed}\n\n" +
        "Import: 2 successes",
    },
  ]);
  verifyBoundary();
});

test("D-04-07: promotes a recorded dependency the imported settings name instead of skipping it", async (t) => {
  // arrange
  // The first import names `sample` alone, and the cascade records
  // `dep` as its dependency. The second import names both, which is the user
  // asking for `dep` by name -- so it reaches the install rather than the
  // already-installed skip, and the install's promotion arm flips its record.
  const { cwd, project } = await createHermeticScopes(t, "promotes-dependency");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0" }),
  );
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const expectedSecondResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    installedPlugins: [
      {
        ...installed("dep", "fixture-mp", "project", { agents: false, mcp: false }, false),
        promoted: true,
        version: "1.0.0",
      },
    ],
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [skippedPlugin("sample", "fixture-mp", "project")],
  };
  const expectedBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": {} },
  });
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"] as const,
  };
  await writeUnder(settingsPath, settingsNaming(marketplaceRoot, { "sample@fixture-mp": true }));
  await importClaudeSettings(importOptions);
  const recordedAfterFirst = await loadState(project.extensionRoot);
  assert.strictEqual(
    recordedAfterFirst.marketplaces["fixture-mp"]?.plugins["dep"]?.provenance,
    "dependency",
    "the first import's cascade recorded the dependency as such",
  );

  // act
  await writeUnder(
    settingsPath,
    settingsNaming(marketplaceRoot, { "sample@fixture-mp": true, "dep@fixture-mp": true }),
  );
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  assert.strictEqual(
    (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]?.plugins["dep"]?.provenance,
    "explicit",
  );
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  // The promoted row carries the standalone promotion row's brace. It moved
  // nothing on disk, so it carries no reload hint where a fresh install's row
  // always does.
  assert.deepStrictEqual(notifications[1], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ● dep v1.0.0 (installed) {already installed, dependency promoted}\n" +
      "  ⊘ sample (skipped) {already installed}\n\n" +
      "Import: 3 successes",
  });
  verifyBoundary();
});

test("D-04-07: promotes a partially installed dependency the imported settings name with the record's own consent", async (t) => {
  // arrange
  // The first import adds the marketplace through `base`; a standalone
  // `--partial` install of `sample` then records `dep`, whose unsupported kind
  // makes it partially available, as a partially installed dependency. The
  // second import names all three. Import carries no `--partial` of its own,
  // so the promotion consents on the record's recorded availability and the
  // name in the settings.
  const { cwd, project } = await createHermeticScopes(t, "promotes-partial-dependency");
  // Two imports and one standalone install, one emission each.
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(3);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        { name: "base", source: "./plugins/base", version: "1.0.0" },
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "base", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "base", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0", experimental: { themes: "./themes" } }),
  );
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const expectedSecondResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    installedPlugins: [
      {
        ...installed("dep", "fixture-mp", "project", { agents: false, mcp: false }, false),
        promoted: true,
        version: "1.0.0",
      },
    ],
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [
      skippedPlugin("base", "fixture-mp", "project"),
      skippedPlugin("sample", "fixture-mp", "project"),
    ],
  };
  const expectedBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "base@fixture-mp": {}, "sample@fixture-mp": {}, "dep@fixture-mp": {} },
  });
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting,
    selectedScopes: ["project"] as const,
  };
  await writeUnder(settingsPath, settingsNaming(marketplaceRoot, { "base@fixture-mp": true }));
  await importClaudeSettings(importOptions);
  const installPlugin = createInstallOperation(hooksRouting, completionCacheFor(hooksRouting));
  await installPlugin({
    ctx,
    run: runWithNothingLoaded(),
    scope: "project",
    cwd,
    marketplace: "fixture-mp",
    plugin: "sample",
    partial: true,
  });
  const dependencyBefore = (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]
    ?.plugins["dep"];
  assert.strictEqual(dependencyBefore?.provenance, "dependency");
  assert.strictEqual(
    dependencyBefore.compatibility.installable,
    false,
    "the cascade recorded the dependency as partially installed",
  );

  // act
  await writeUnder(
    settingsPath,
    settingsNaming(marketplaceRoot, {
      "base@fixture-mp": true,
      "sample@fixture-mp": true,
      "dep@fixture-mp": true,
    }),
  );
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  // The same one-field flip the fully-supported record gets.
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  assert.deepStrictEqual(
    (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]?.plugins["dep"],
    { ...dependencyBefore, provenance: "explicit" },
  );
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications[2], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ● dep v1.0.0 (installed) {already installed, dependency promoted}\n" +
      "  ⊘ base (skipped) {already installed}\n" +
      "  ⊘ sample (skipped) {already installed}\n\n" +
      "Import: 4 successes",
  });
  verifyBoundary();
});

/**
 * Seeds a record as the disable verb leaves it. IMP-05's production-enable case
 * uses it for a direct install; the D-04-07 cases below use it for a
 * dependency.
 *
 * D-04-07 / EDEP-02: these two promotion fixtures need `dep` disabled while
 * `sample` -- the plugin that declares it -- stays enabled, but the disable
 * verb now refuses exactly that (EDEP-02: an installed and ENABLED plugin in
 * the same scope still declares the target). That refusal is not what these
 * tests exercise, so the precondition is seeded directly: the state record
 * the disable verb would have produced (`toDisabledRecord`) and its skill
 * taken off disk, the same two effects the disable cascade's unstage leaves
 * behind. Neither test needs a companion probe or a `notify()` emission for
 * this step, so the boundary below sizes the two imports alone.
 */
async function seedDisabledRecord(
  project: ScopedLocations,
  opts: { readonly plugin: string; readonly marketplace: string; readonly skillDir: string },
): Promise<void> {
  const state = await loadState(project.extensionRoot);
  const marketplace = state.marketplaces[opts.marketplace];
  const record = marketplace?.plugins[opts.plugin];
  assert.ok(marketplace !== undefined && record !== undefined);
  marketplace.plugins[opts.plugin] = toDisabledRecord(record, new Date().toISOString());
  await saveState(project.extensionRoot, state);
  await rm(opts.skillDir, { recursive: true, force: true });
}

test("D-04-07: promotes a disabled dependency the imported settings name and declares it enabled", async (t) => {
  // arrange
  // The first import's cascade records `dep`. `seedDisabledRecord`
  // then takes it off disk, and the base config file is seeded directly with
  // `{ enabled: false }` for it -- the entry the disable verb would have
  // written. The second import names `dep`, which is the user asking for it
  // by name: the promotion re-materializes the record, and the post-pass
  // writes the enable path's own `{ enabled: true }` over the seeded entry. A
  // bare key merged over that entry would leave `enabled: false` in the file
  // and hand the reload the row asks for a disable to plan.
  const { cwd, project } = await createHermeticScopes(t, "promotes-disabled-dependency");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", "skills", "tool", "SKILL.md"),
    "---\nname: tool\n---\n\nBody.\n",
  );
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const expectedSecondResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [
      {
        ...installed("dep", "fixture-mp", "project"),
        promoted: true,
        version: "1.0.0",
        reenabled: true,
      },
    ],
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [skippedPlugin("sample", "fixture-mp", "project")],
  };
  const expectedBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": { enabled: true } },
  });
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting,
    selectedScopes: ["project"] as const,
  };
  const skillDir = path.join(project.skillsTargetDir, "dep-tool");
  await writeUnder(settingsPath, settingsNaming(marketplaceRoot, { "sample@fixture-mp": true }));
  await importClaudeSettings(importOptions);
  await seedDisabledRecord(project, {
    plugin: "dep",
    marketplace: "fixture-mp",
    skillDir,
  });
  await writeUnder(
    project.baseConfigJsonPath,
    configBytes({
      marketplaces: { "fixture-mp": { source: marketplaceRoot } },
      plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": { enabled: false } },
    }),
  );
  const dependencyBefore = (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]
    ?.plugins["dep"];
  assert.strictEqual(dependencyBefore?.provenance, "dependency");
  assert.strictEqual(dependencyBefore.enabled, false, "the seeded record is disabled");
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { "fixture-mp": { source: marketplaceRoot } },
      plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": { enabled: false } },
    }),
    "and declared the disable in the base config",
  );
  await assert.rejects(stat(skillDir), { code: "ENOENT" }, "and took its skill off disk");

  // act
  await writeUnder(
    settingsPath,
    settingsNaming(marketplaceRoot, { "sample@fixture-mp": true, "dep@fixture-mp": true }),
  );
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  // The record is the one the cascade wrote, enabled again and
  // promoted, with its update time moved; the skill is back on disk; the
  // declaration is the enable path's own, overwriting the seeded
  // `{ enabled: false }` entry; and the reload the row asks for finds
  // nothing to plan.
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  const stateAfter = await loadState(project.extensionRoot);
  const promoted = stateAfter.marketplaces["fixture-mp"]?.plugins["dep"];
  assert.ok(promoted !== undefined);
  assert.ok(promoted.updatedAt > dependencyBefore.updatedAt, "the update time moved");
  assert.deepStrictEqual(promoted, {
    ...dependencyBefore,
    enabled: true,
    provenance: "explicit",
    updatedAt: promoted.updatedAt,
  });
  await stat(skillDir);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(
    planReconcile((await loadMergedScopeConfig(project)).merged, stateAfter, "project"),
    emptyReconcilePlan("project"),
  );
  assert.deepStrictEqual(notifications[1], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ● dep v1.0.0 (installed) {already installed, dependency promoted}\n" +
      "  ⊘ sample (skipped) {already installed}\n\n" +
      "Import: 3 successes\n\n" +
      "/reload to pick up changes",
  });
  verifyBoundary();
});

test("D-04-07: declares a promoted dependency enabled in the local config when the disable verb declared it there", async (t) => {
  // arrange
  // The first import's cascade records `dep`. `seedDisabledRecord`
  // then takes it off disk, and the local config file is seeded directly with
  // `{ enabled: false }` for it -- the state a `disable --local` declares in the
  // local config, whose entry shadows the base entry wholesale (CFG-02). The
  // second import names `dep`: the promotion re-materializes the record, and
  // the post-pass writes the enable path's `{ enabled: true }` to the file
  // that declares the key (D-103-16), leaving the base config the bare key. A
  // stamp in the base config alone would leave the merged view disabled and
  // hand the reload the row asks for a disable to plan.
  const { cwd, project } = await createHermeticScopes(t, "promotes-disabled-dependency-local");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", "skills", "tool", "SKILL.md"),
    "---\nname: tool\n---\n\nBody.\n",
  );
  const settingsPath = path.join(cwd, ".claude", "settings.json");
  const expectedSecondResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [
      {
        ...installed("dep", "fixture-mp", "project"),
        promoted: true,
        reenabled: true,
        version: "1.0.0",
      },
    ],
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [skippedPlugin("sample", "fixture-mp", "project")],
  };
  const expectedBaseBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": {} },
  });
  const expectedLocalBytes = configBytes({
    marketplaces: {},
    plugins: { "dep@fixture-mp": { enabled: true } },
  });
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting,
    selectedScopes: ["project"] as const,
  };
  const skillDir = path.join(project.skillsTargetDir, "dep-tool");
  await writeUnder(settingsPath, settingsNaming(marketplaceRoot, { "sample@fixture-mp": true }));
  await importClaudeSettings(importOptions);
  await seedDisabledRecord(project, {
    plugin: "dep",
    marketplace: "fixture-mp",
    skillDir,
  });
  await writeUnder(
    project.localConfigJsonPath,
    configBytes({ marketplaces: {}, plugins: { "dep@fixture-mp": { enabled: false } } }),
  );
  const dependencyBefore = (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]
    ?.plugins["dep"];
  assert.strictEqual(dependencyBefore?.provenance, "dependency");
  assert.strictEqual(dependencyBefore.enabled, false, "the seeded record is disabled");
  assert.strictEqual(
    await readFile(project.localConfigJsonPath, "utf8"),
    configBytes({ marketplaces: {}, plugins: { "dep@fixture-mp": { enabled: false } } }),
    "and declared the disable in the local config",
  );
  await assert.rejects(stat(skillDir), { code: "ENOENT" }, "and took its skill off disk");

  // act
  await writeUnder(
    settingsPath,
    settingsNaming(marketplaceRoot, { "sample@fixture-mp": true, "dep@fixture-mp": true }),
  );
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  // The record is enabled again and promoted; the skill is back on
  // disk; the local config carries the enable path's own declaration and the base
  // config the bare key; the merged view reads the local entry; and the reload the
  // row asks for finds nothing to plan.
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  const stateAfter = await loadState(project.extensionRoot);
  const promoted = stateAfter.marketplaces["fixture-mp"]?.plugins["dep"];
  assert.ok(promoted !== undefined);
  assert.deepStrictEqual(promoted, {
    ...dependencyBefore,
    enabled: true,
    provenance: "explicit",
    updatedAt: promoted.updatedAt,
  });
  await stat(skillDir);
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBaseBytes);
  assert.strictEqual(await readFile(project.localConfigJsonPath, "utf8"), expectedLocalBytes);
  const { merged } = await loadMergedScopeConfig(project);
  assert.deepStrictEqual(merged.plugins["dep@fixture-mp"], {
    entry: { enabled: true },
    source: "local",
  });
  assert.deepStrictEqual(
    planReconcile(merged, stateAfter, "project"),
    emptyReconcilePlan("project"),
  );
  assert.deepStrictEqual(notifications[1], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ● dep v1.0.0 (installed) {already installed, dependency promoted}\n" +
      "  ⊘ sample (skipped) {already installed}\n\n" +
      "Import: 3 successes\n\n" +
      "/reload to pick up changes",
  });
  verifyBoundary();
});

test("D-04-07: keeps the enabled declaration in the base config when the local config declares only other keys", async (t) => {
  // arrange
  // A disabled dependency record, its `{ enabled: false }` in the base
  // config, and a local config that declares a different key. The file that
  // declares the promoted key takes the stamp (D-103-16); a local config that
  // merely exists does not.
  const { cwd, project } = await createHermeticScopes(t, "reenable-local-other-key");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  await createScopeRoots(project);
  await writeFile(
    project.baseConfigJsonPath,
    configBytes({
      marketplaces: { mp: { source: "./mp" } },
      plugins: { "plugin@mp": { enabled: false } },
    }),
    "utf8",
  );
  const localBytes = configBytes({ marketplaces: {}, plugins: { "other@mp": {} } });
  await writeFile(project.localConfigJsonPath, localBytes, "utf8");
  const expectedBaseBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "plugin@mp": { enabled: true } },
  });
  const recorded = recordedMarketplace({
    name: "mp",
    plugins: ["plugin"],
    scope: "project",
    source: pathSource("./mp"),
  });
  const disabledDependency: PluginRecord = {
    ...recordedPlugin("plugin"),
    enabled: false,
    provenance: "dependency",
  };

  // act
  await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(recordedState([{ ...recorded, plugins: { plugin: disabledDependency } }])),
    }),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(
    {
      base: await readFile(project.baseConfigJsonPath, "utf8"),
      local: await readFile(project.localConfigJsonPath, "utf8"),
    },
    { base: expectedBaseBytes, local: localBytes },
  );
  verifyBoundary();
});

test("D-04-07: marks a dependency promoted at lock time by the same import's earlier cascade", async (t) => {
  // arrange
  // One import names `sample` and then `dep`. The scope's snapshot is
  // taken once before the loop, so when `sample`'s cascade records `dep`, the
  // `dep` entry still sees no record and reaches the install with nothing to
  // promote at its call site; the install finds the record under its lock and
  // promotes it there. The promotion is read off the install's outcome, so the
  // entry and its row still say so.
  const { cwd, project } = await createHermeticScopes(t, "promotes-same-import");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(cwd, ".claude", "settings.json"),
    JSON.stringify({
      enabledPlugins: { "sample@fixture-mp": true, "dep@fixture-mp": true },
      extraKnownMarketplaces: { "fixture-mp": { directory: marketplaceRoot } },
    }),
  );
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("fixture-mp", "project")],
    installedPlugins: [
      {
        ...installed("sample", "fixture-mp", "project", { agents: false, mcp: false }, false),
        version: "1.0.0",
      },
      {
        ...installed("dep", "fixture-mp", "project", { agents: false, mcp: false }, false),
        promoted: true,
        version: "1.0.0",
      },
    ],
  };
  const expectedBytes = configBytes({
    marketplaces: { "fixture-mp": { source: marketplaceRoot } },
    plugins: { "sample@fixture-mp": {}, "dep@fixture-mp": {} },
  });

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"] as const,
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.strictEqual(
    (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]?.plugins["dep"]?.provenance,
    "explicit",
  );
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● fixture-mp [project] (added)\n" +
        "  ● sample v1.0.0 (installed)\n" +
        "  ● dep v1.0.0 (installed) {already installed, dependency promoted}\n\n" +
        "Import: 3 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("declares a marketplace whose only plugin failed to install", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "marketplace-only-patch");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: {},
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () =>
        Promise.resolve(
          failedInstallOutcome(
            new PluginShapeError({ kind: "not-in-manifest", marketplace: "mp", plugin: "plugin" }),
            'Plugin "plugin" not found in marketplace "mp".',
          ),
        ),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("declares a freshly installed plugin under a recorded marketplace that records no plugins", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "plugin-only-patch");
  const { ctx, verifyBoundary } = createNotificationBoundary(1);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "fresh@mp": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "fresh@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({ name: "mp", scope: "project", source: pathSource("./mp") }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.baseConfigJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("lets a later scope plan's source mismatch supersede the header an earlier add recorded", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "status-supersede");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cause = "Existing marketplace source ./x does not match Claude settings source owner/x.";
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp-x", "project")],
    changedResources: true,
    installedPlugins: [installed("p", "mp-x", "project")],
    sourceMismatches: [mismatched("q", "mp-x", "project", cause)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp-x")),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: settingsSequence([
        claudeSettings({
          enabledPlugins: { "p@mp-x": true },
          extraKnownMarketplaces: { "mp-x": { directory: "./x" } },
        }),
        claudeSettings({
          enabledPlugins: { "q@mp-x": true },
          extraKnownMarketplaces: { "mp-x": { github: { repo: "owner/x" } } },
        }),
      ]),
      loadState: stateSequence([
        recordedState([]),
        recordedState([
          recordedMarketplace({ name: "mp-x", scope: "project", source: pathSource("./x") }),
        ]),
      ]),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp-x [project] (failed)\n" +
        "  ● p (installed)\n" +
        "  ⊘ q (failed) {source mismatch}\n\n" +
        "Import: 2 failures, 1 success\n\n" +
        "/reload to pick up changes",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

/** Runs `act` while this process holds the scope's real state lock. */
async function whileLockHeld<T>(locations: ScopedLocations, act: () => Promise<T>): Promise<T> {
  await mkdir(locations.extensionRoot, { recursive: true });
  const release = await lockfile.lock(locations.extensionRoot, {
    lockfilePath: locations.stateLockFile,
    realpath: false,
  });
  try {
    return await act();
  } finally {
    await release();
  }
}

function lockHeldMessage(locations: ScopedLocations): string {
  return `Another pi-claude-marketplace operation is in progress for ${locations.scope} scope (${locations.stateLockFile}). Retry after it completes.`;
}

/** The settings naming `plugins` under the one path-sourced marketplace `mp`. */
function settingsForMp(...plugins: readonly string[]): ClaudeSettings {
  return claudeSettings({
    enabledPlugins: Object.fromEntries(plugins.map((plugin) => [`${plugin}@mp`, true])),
    extraKnownMarketplaces: { mp: { directory: "./mp" } },
  });
}

/** A recorded `mp` whose `disabled` plugins carry the disable verb's record. */
function stateWithDisabled(...disabled: readonly string[]): ImportState {
  const marketplace = recordedMarketplace({
    name: "mp",
    scope: "project",
    source: pathSource("./mp"),
  });
  for (const plugin of disabled) {
    marketplace.plugins[plugin] = toDisabledRecord(
      recordedPlugin(plugin),
      "2026-01-02T00:00:00.000Z",
    );
  }

  return recordedState([marketplace]);
}

test("IMP-07: fails every settings marketplace as lock held and runs nothing while another process holds the scope lock", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "lock-held");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const message = lockHeldMessage(project);

  // act
  const importResult = await whileLockHeld(project, async () =>
    importClaudeSettings({
      ctx,
      run: runWithNothingLoaded(),
      cwd,
      deps: collaborators({ loadSettings: () => Promise.resolve(settingsForMp("plugin")) }),
      hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      selectedScopes: ["project"],
    }),
  );

  // assert
  const [failure] = importResult.marketplaceFailures;
  assert.ok(failure?.causeChain instanceof Error);
  assert.strictEqual(failure.causeChain.message, "Lock file is already being held");
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    marketplaceFailures: [
      {
        kind: "marketplace-failure",
        scope: "project",
        marketplace: "mp",
        reason: "lock-held",
        cause: message,
        causeChain: failure.causeChain,
      },
    ],
    warnings: [warned("plugin", "mp", "project", "marketplace-failed", message)],
  });
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [project] (failed)\n" +
        "  ⊘ mp (failed) {lock held}\n" +
        `    cause: ${message} -> Lock file is already being held\n\n` +
        "Import: 2 failures",
      severity: "error",
    },
  ]);
  await assert.rejects(stat(project.baseConfigJsonPath), { code: "ENOENT" });
  await assert.rejects(stat(project.stateJsonPath), { code: "ENOENT" });
  verifyBoundary();
});

test("IMP-07 / D-09: a lock another process takes after the read pass fails the add and the install as lock held", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "lock-race");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const lockError = new StateLockHeldError("project", "/held/.state-lock", {
    cause: new Error("Lock file is already being held"),
  });

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      addMarketplace: () =>
        Promise.resolve({
          status: "failed",
          reason: "lock held",
          error: lockError,
          cause: lockError.message,
        }),
      installPlugin: () => Promise.resolve(failedInstallOutcome(lockError, lockError.message)),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true, "kept@recorded": true },
            extraKnownMarketplaces: {
              mp: { directory: "./mp" },
              recorded: { directory: "./recorded" },
            },
          }),
        ),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "recorded",
              scope: "project",
              source: pathSource("./recorded"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    marketplaceFailures: [
      {
        kind: "marketplace-failure",
        scope: "project",
        marketplace: "mp",
        reason: "lock-held",
        cause: lockError.message,
        causeChain: lockError.cause,
      },
    ],
    skippedExistingMarketplaces: [skipped("recorded", "project")],
    unexpectedPluginFailures: [
      {
        kind: "plugin-failure",
        scope: "project",
        plugin: "kept",
        marketplace: "recorded",
        ref: "kept@recorded",
        reason: "lock-held",
        cause: lockError.message,
        causeChain: lockError.cause,
      },
    ],
    warnings: [warned("plugin", "mp", "project", "marketplace-failed", lockError.message)],
  });
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [project] (failed)\n" +
        "  ⊘ mp (failed) {lock held}\n" +
        `    cause: ${lockError.message} -> Lock file is already being held\n\n` +
        "● recorded [project] (skipped) {already added}\n" +
        "  ⊘ kept (failed) {lock held}\n" +
        `    cause: ${lockError.message} -> Lock file is already being held\n\n` +
        "Import: 3 failures, 1 success",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("IMP-05: enables a plugin the scope records disabled and declares it enabled", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "enable-disabled");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const adapterNotice = {
    kind: "comments-dropped",
    scope: "project",
    file: "mcp-adapter.json",
  } as const;
  const enableCalls: string[] = [];

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("alpha", "beta")),
      loadState: () => Promise.resolve(stateWithDisabled("alpha", "beta")),
      setPluginEnabled: (options) => {
        enableCalls.push(
          `${options.scope ?? "?"} ${options.plugin}@${options.marketplace} ${String(options.enable)}`,
        );
        return Promise.resolve(
          options.plugin === "alpha"
            ? {
                status: "enabled",
                name: "alpha",
                version: "1.0.0",
                stagedAgents: true,
                stagedMcpServers: true,
                stagedWorkflows: true,
                mcpConfigNotices: [adapterNotice],
              }
            : { status: "enabled", name: "beta" },
        );
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(enableCalls, ["project alpha@mp true", "project beta@mp true"]);
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [
      {
        ...installed("alpha", "mp", "project", { agents: true, mcp: true, workflows: true }),
        version: "1.0.0",
        reenabled: true,
        enableSignals: { stagedAgents: true, stagedMcpServers: true, stagedWorkflows: true },
      },
      { ...installed("beta", "mp", "project"), reenabled: true, enableSignals: {} },
    ],
    skippedExistingMarketplaces: [skipped("mp", "project")],
  });
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { mp: { source: "./mp" } },
      plugins: { "alpha@mp": { enabled: true }, "beta@mp": { enabled: true } },
    }),
  );
  assert.deepStrictEqual(notifications[0], {
    message:
      "● mp [project] (skipped) {already added}\n" +
      "  ● alpha v1.0.0 (installed) {requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}\n" +
      "  ● beta (installed)\n\n" +
      "Import: 3 successes\n\n" +
      "/reload to pick up changes",
  });
  verifyBoundary();
});

test("IMP-05: an enable that fails or finds the plugin enabled is reported, not retried", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "enable-fails");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const lockError = new StateLockHeldError("project", "/held/.state-lock");
  const shapeError = new PluginShapeError({
    kind: "not-in-manifest",
    plugin: "gone",
    marketplace: "mp",
  });

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("locked", "gone", "raced")),
      loadState: () => Promise.resolve(stateWithDisabled("locked", "gone", "raced")),
      setPluginEnabled: (options) => {
        switch (options.plugin) {
          case "locked":
            return Promise.resolve({
              status: "failed",
              reason: "lock held",
              error: lockError,
              cause: lockError.message,
              mcpConfigNotices: [
                { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
              ],
            });
          case "gone":
            return Promise.resolve({
              status: "failed",
              reason: "not in manifest",
              error: shapeError,
              cause: "gone is not in the manifest",
            });
          default:
            return Promise.resolve({ status: "skipped", reason: "already enabled", name: "raced" });
        }
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    skippedExistingMarketplaces: [skipped("mp", "project")],
    skippedExistingPlugins: [skippedPlugin("raced", "mp", "project")],
    unexpectedPluginFailures: [
      {
        kind: "plugin-failure",
        scope: "project",
        plugin: "locked",
        marketplace: "mp",
        ref: "locked@mp",
        reason: "lock-held",
        cause: lockError.message,
      },
    ],
    warnings: [warned("gone", "mp", "project", "unavailable", "gone is not in the manifest")],
  });
  assert.deepStrictEqual(notifications[0], {
    message:
      "A plugin operation has failed.\n\n" +
      "● mp [project] (skipped) {already added}\n" +
      "  ⊘ raced (skipped) {already installed}\n" +
      "  ⊘ locked (failed) {lock held}\n" +
      `    cause: ${lockError.message}\n` +
      "  ⊘ gone (unavailable) {not in manifest}\n\n" +
      "Import: 1 failure, 1 warning, 2 successes",
    severity: "error",
  });
  verifyBoundary();
});

test("MIM-01: a settings marketplace the scope records under one other name installs its plugin under that record", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "source-claimed");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const run = runWithNothingLoaded();
  const installPlugin = mock<InstallPlugin>({ exactParams: true, name: "install plugin" });
  when(() =>
    installPlugin({
      ctx,
      cwd,
      marketplace: "recorded-mp",
      notifications: { mode: "orchestrated" },
      plugin: "plugin",
      run,
      scope: "project",
    }),
  ).thenResolve(installedOutcome());
  const recorded = recordedMarketplace({
    name: "recorded-mp",
    scope: "project",
    source: pathSource("./mp"),
  });

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run,
    cwd,
    deps: collaborators({
      installPlugin,
      loadSettings: () => Promise.resolve(settingsForMp("plugin")),
      loadState: () => Promise.resolve(recordedState([recorded])),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [installed("plugin", "recorded-mp", "project")],
    skippedExistingMarketplaces: [skipped("recorded-mp", "project")],
  });
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { "recorded-mp": { source: "./mp" } },
      plugins: { "plugin@recorded-mp": {} },
    }),
  );
  assert.deepStrictEqual(
    planReconcile(
      (await loadMergedScopeConfig(project)).merged,
      recordedState([
        recordedMarketplace({
          name: "recorded-mp",
          plugins: ["plugin"],
          scope: "project",
          source: pathSource("./mp"),
        }),
      ]),
      "project",
    ),
    emptyReconcilePlan("project"),
  );
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● recorded-mp [project] (skipped) {already added}\n" +
        "  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
  verify(installPlugin);
});

test("D-PL6-09: a settings marketplace whose source two records hold blocks its plugins before any add", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "source-ambiguous");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cause =
    "Existing marketplace source ambiguous recorded marketplaces: first-mp, second-mp " +
    "does not match Claude settings source ./mp.";

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("plugin")),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({
              name: "second-mp",
              scope: "project",
              source: pathSource("./mp"),
            }),
            recordedMarketplace({ name: "first-mp", scope: "project", source: pathSource("./mp") }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    sourceMismatches: [mismatched("plugin", "mp", "project", cause)],
  });
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [project] (failed)\n" +
        "  ⊘ plugin (failed) {source mismatch}\n\n" +
        "Import: 2 failures",
      severity: "error",
    },
  ]);
  await assert.rejects(stat(project.baseConfigJsonPath), { code: "ENOENT" });
  verifyBoundary();
});

test("D-PL6-09: an extra known marketplace no plugin names fails when two records hold its source", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "source-ambiguous-unreferenced");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const cause =
    "Existing marketplace source ambiguous recorded marketplaces: first-mp, second-mp " +
    "does not match Claude settings source ./mp.";

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp()),
      loadState: () =>
        Promise.resolve(
          recordedState([
            recordedMarketplace({ name: "first-mp", scope: "project", source: pathSource("./mp") }),
            recordedMarketplace({
              name: "second-mp",
              scope: "project",
              source: pathSource("./mp"),
            }),
          ]),
        ),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    marketplaceFailures: [addFailed("mp", "project", cause)],
  });
  assert.deepStrictEqual(notifications, [
    {
      message:
        "Some operations have failed.\n\n" +
        "⊘ mp [project] (failed)\n" +
        "  ⊘ mp (failed)\n" +
        `    cause: ${cause}\n\n` +
        "Import: 2 failures",
      severity: "error",
    },
  ]);
  await assert.rejects(stat(project.baseConfigJsonPath), { code: "ENOENT" });
  verifyBoundary();
});

test("MIM-01: enables a disabled plugin under the recorded marketplace a settings name claims", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "source-claimed-enable");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);
  const enableCalls: string[] = [];
  const recorded = recordedMarketplace({
    name: "recorded-mp",
    scope: "project",
    source: pathSource("./mp"),
  });
  recorded.plugins["plugin"] = toDisabledRecord(
    recordedPlugin("plugin"),
    "2026-01-02T00:00:00.000Z",
  );

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("plugin")),
      loadState: () => Promise.resolve(recordedState([recorded])),
      setPluginEnabled: (options) => {
        enableCalls.push(
          `${options.scope ?? "?"} ${options.plugin}@${options.marketplace} ${String(options.enable)}`,
        );
        return Promise.resolve({ status: "enabled", name: "plugin" });
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(enableCalls, ["project plugin@recorded-mp true"]);
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [
      { ...installed("plugin", "recorded-mp", "project"), reenabled: true, enableSignals: {} },
    ],
    skippedExistingMarketplaces: [skipped("recorded-mp", "project")],
  });
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { "recorded-mp": { source: "./mp" } },
      plugins: { "plugin@recorded-mp": { enabled: true } },
    }),
  );
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● recorded-mp [project] (skipped) {already added}\n" +
        "  ● plugin (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("IMP-05: enables a disabled plugin through the production enable operation when the caller supplies no dependency bundle", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "enable-production");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [{ name: "sample", source: "./plugins/sample", version: "1.0.0" }],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", "skills", "tool", "SKILL.md"),
    "---\nname: tool\n---\n\nBody.\n",
  );
  await writeUnder(
    path.join(cwd, ".claude", "settings.json"),
    settingsNaming(marketplaceRoot, { "sample@fixture-mp": true }),
  );
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"] as const,
  };
  const skillDir = path.join(project.skillsTargetDir, "sample-tool");
  await importClaudeSettings(importOptions);
  await seedDisabledRecord(project, {
    plugin: "sample",
    marketplace: "fixture-mp",
    skillDir,
  });

  // act
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  assert.deepStrictEqual(secondResult, {
    ...emptyImportResult(),
    changedResources: true,
    installedPlugins: [
      {
        ...installed("sample", "fixture-mp", "project"),
        version: "1.0.0",
        reenabled: true,
        enableSignals: {},
      },
    ],
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
  });
  const record = (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]?.plugins[
    "sample"
  ];
  assert.strictEqual(record?.enabled, true);
  await stat(skillDir);
  assert.strictEqual(
    await readFile(project.baseConfigJsonPath, "utf8"),
    configBytes({
      marketplaces: { "fixture-mp": { source: marketplaceRoot } },
      plugins: { "sample@fixture-mp": { enabled: true } },
    }),
  );
  assert.deepStrictEqual(notifications[1], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ● sample v1.0.0 (installed)\n\n" +
      "Import: 2 successes\n\n" +
      "/reload to pick up changes",
  });
  verifyBoundary();
});

test("IMP-05: an enable that throws or finds the record gone fails that plugin and keeps going", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "enable-throws");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("thrown", "odd", "gone", "flipped")),
      loadState: () => Promise.resolve(stateWithDisabled("thrown", "odd", "gone", "flipped")),
      setPluginEnabled: (options) => {
        switch (options.plugin) {
          case "thrown":
            return Promise.reject(new Error("enable exploded"));
          case "odd":
            // A string rejection takes the same route as an Error.
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the non-Error arm is the case
            return Promise.reject("enable exploded oddly");
          case "gone":
            return Promise.resolve({ status: "skipped", reason: "not installed", name: "gone" });
          default:
            // `disabled` cannot answer an enable; it reads as the already-enabled skip.
            return Promise.resolve({ status: "disabled", name: "flipped" });
        }
      },
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult, {
    ...emptyImportResult(),
    skippedExistingMarketplaces: [skipped("mp", "project")],
    skippedExistingPlugins: [skippedPlugin("flipped", "mp", "project")],
    unexpectedPluginFailures: [
      failedUnexpectedly("thrown", "mp", "project", "enable exploded"),
      failedUnexpectedly("odd", "mp", "project", "enable exploded oddly"),
      {
        ...failedUnexpectedly(
          "gone",
          "mp",
          "project",
          "gone@mp is not installed in the project scope.",
        ),
        reason: "not-installed",
      },
    ],
  });
  assert.strictEqual(notifications.length, 1);
  verifyBoundary();
});

test("IMP-10: re-enabling a partially installed record shows the row reconcile shows", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "enable-partial");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(1);

  // act
  const importResult = await importClaudeSettings({
    ctx,
    run: runWithNothingLoaded(),
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(settingsForMp("partial")),
      loadState: () => Promise.resolve(stateWithDisabled("partial")),
      setPluginEnabled: () =>
        Promise.resolve({
          status: "enabled",
          name: "partial",
          version: "1.0.0",
          unsupported: ["outputStyles"],
          orphanRewake: true,
        }),
    }),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(importResult.installedPlugins, [
    {
      ...installed("partial", "mp", "project"),
      version: "1.0.0",
      reenabled: true,
      enableSignals: { unsupported: ["outputStyles"], orphanRewake: true },
    },
  ]);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [project] (skipped) {already added}\n" +
        "  ◉ partial v1.0.0 (partially-installed) {orphan rewake, unsupported component}\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("leaves a record the load-time check holds down disabled and reports it already installed", async (t) => {
  // arrange
  // `sample` depends on `dep`. After the first import the user disables `dep`
  // and the load-time check holds `sample` down. Settings that still enable
  // `sample` must not bring it back: the next reload would hold it down again.
  const { cwd, project } = await createHermeticScopes(t, "held-dependency");
  const { ctx, notifications, verifyBoundary } = createNotificationBoundary(2);
  const marketplaceRoot = path.join(cwd, "fixture-mp");
  const dependency = { name: "dep", version: "*" };
  await writeUnder(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "fixture-mp",
      owner: { name: "import owner suite" },
      plugins: [
        {
          name: "sample",
          source: "./plugins/sample",
          version: "1.0.0",
          dependencies: [dependency],
        },
        { name: "dep", source: "./plugins/dep", version: "1.0.0" },
      ],
    }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "sample", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "sample", version: "1.0.0", dependencies: [dependency] }),
  );
  await writeUnder(
    path.join(marketplaceRoot, "plugins", "dep", ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "dep", version: "1.0.0" }),
  );
  await writeUnder(
    path.join(cwd, ".claude", "settings.json"),
    settingsNaming(marketplaceRoot, { "sample@fixture-mp": true }),
  );
  const importOptions = {
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    run: runWithNothingLoaded(),
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    selectedScopes: ["project"] as const,
  };
  await importClaudeSettings(importOptions);
  const state = await loadState(project.extensionRoot);
  const plugins = state.marketplaces["fixture-mp"]?.plugins;
  const sample = plugins?.["sample"];
  const dep = plugins?.["dep"];
  assert.ok(plugins !== undefined && sample !== undefined && dep !== undefined);
  const updatedAt = "2026-01-02T00:00:00.000Z";
  plugins["dep"] = toDisabledRecord(dep, updatedAt);
  plugins["sample"] = { ...toDisabledRecord(sample, updatedAt), dependencyDisabled: true };
  await saveState(project.extensionRoot, state);

  // act
  const secondResult = await importClaudeSettings(importOptions);

  // assert
  assert.deepStrictEqual(secondResult, {
    ...emptyImportResult(),
    skippedExistingMarketplaces: [skipped("fixture-mp", "project")],
    skippedExistingPlugins: [skippedPlugin("sample", "fixture-mp", "project")],
  });
  const held = (await loadState(project.extensionRoot)).marketplaces["fixture-mp"]?.plugins[
    "sample"
  ];
  assert.strictEqual(held?.enabled, false);
  assert.strictEqual(held.dependencyDisabled, true);
  assert.deepStrictEqual(notifications[1], {
    message:
      "● fixture-mp [project] (skipped) {already added}\n" +
      "  ⊘ sample (skipped) {already installed}\n\n" +
      "Import: 2 successes",
  });
  verifyBoundary();
});
