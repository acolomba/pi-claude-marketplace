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
// IL-2 is proved by sizing the notification boundary: `importClaudeSettings`
// promises exactly one emission, so a second `ctx.ui.notify` call throws where it
// is made rather than being counted afterwards.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { importClaudeSettings } from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  ConcurrentInstallError,
  PluginShapeError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { createNotificationBoundary } from "../../helpers/notification-boundary.ts";
import { createGitOpsFake } from "../../platform/git-ops-fake.ts";

import type {
  ClaudeImportExecutionResult,
  ImportClaudeSettingsOptions,
  ImportDeps,
} from "../../../extensions/pi-claude-marketplace/orchestrators/import/execute.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
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
  const cwd = await mkdtemp(path.join(tmpdir(), `import-${label}-cwd-`));
  const home = await mkdtemp(path.join(tmpdir(), `import-${label}-home-`));
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
  delete process.env.PI_CODING_AGENT_DIR;
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
    installedAt: "2026-01-01T00:00:00.000Z",
    resolvedSource: `/marketplaces/plugins/${name}`,
    resources: { agents: [], hooks: [], mcpServers: [], prompts: [], skills: [] },
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
  return { declaresAgents: false, declaresMcp: false, resourcesChanged: true, status: "installed" };
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
  declares: { readonly agents: boolean; readonly mcp: boolean } = { agents: false, mcp: false },
  resourcesChanged = true,
): Installed {
  return {
    declaresAgents: declares.agents,
    declaresMcp: declares.mcp,
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
  reason: Warning["reason"],
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
): UnexpectedFailure {
  return {
    cause,
    kind: "plugin-failure",
    marketplace,
    plugin,
    reason: "unexpected-failure",
    ref: `${plugin}@${marketplace}`,
    scope,
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

test("records a marketplace the state does not carry and installs its declared plugin", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "add-and-install");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const gitOps = createOfflineGitOps();
  const installPlugin = mock<InstallPlugin>({ exactParams: true, name: "install plugin" });
  when(() =>
    installPlugin({
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      pi,
      plugin: "plugin",
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
    pi,
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
  const withPort = createNotificationBoundary(1, 2);
  const withoutPort = createNotificationBoundary(1, 2);
  const gitOps = createOfflineGitOps();
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
    cwd,
    deps: collaborators(promised()),
    gitOps,
    pi: withPort.pi,
    selectedScopes: ["user"],
  });
  await importClaudeSettings({
    ctx: withoutPort.ctx,
    cwd,
    deps: collaborators(promised()),
    pi: withoutPort.pi,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(requested, [
    {
      ctx: withPort.ctx,
      cwd,
      gitOps,
      notifications: { mode: "orchestrated" },
      pi: withPort.pi,
      rawSource: "./mp",
      scope: "user",
    },
    {
      ctx: withoutPort.ctx,
      cwd,
      notifications: { mode: "orchestrated" },
      pi: withoutPort.pi,
      rawSource: "./mp",
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
      pi,
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "⊘ mp-a [user] (failed)\n\n" +
          "● mp-b [user] (added)\n  ● b (installed)\n\n" +
          "● mp-c [user] (added)\n  ● c (installed)\n\n" +
          "Import: 1 failure, 4 successes\n\n" +
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
      pi,
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "A marketplace operation has failed.\n\n" +
          "● mp-a [user] (added)\n  ● a (installed)\n\n" +
          "⊘ mp-b [user] (failed)\n\n" +
          "● mp-c [user] (added)\n  ● c (installed)\n\n" +
          "Import: 1 failure, 4 successes\n\n" +
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
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const calls: string[] = [];

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      skippedExistingMarketplaces: [skipped("mp", "user")],
      skippedExistingPlugins: [skippedPlugin("plugin", "mp", "user")],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
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
      pi,
      selectedScopes: ["user"],
    });

    // assert
    assert.deepStrictEqual(importResult, expectedResult);
    assert.deepStrictEqual(notifications, [
      {
        message:
          "● mp [user] (updated)\n" +
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
      pi,
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
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const cause = "unrecognized stored source format";
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    marketplaceFailures: [addFailed("mp", "user", cause)],
    warnings: [warned("plugin", "mp", "user", "marketplace-failed", cause)],
    diagnostics: [
      {
        code: "unrecognized-stored-source",
        marketplace: "mp",
        message:
          'Marketplace "mp" has an unrecognized stored source format. ' +
          "Verify state.json or remove and re-add the marketplace.",
        scope: "user",
        severity: "warning",
      },
    ],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "A marketplace operation has failed.\n\n" +
        "⊘ mp [user] (failed)\n\n" +
        "Import: 1 failure",
      severity: "error",
    },
  ]);
  verifyBoundary();
});

test("warns about a plugin whose marketplace declares no supported source and renders no row for it", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "unmappable");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    diagnostics: [
      {
        code: "unmappable-marketplace-source",
        marketplace: "unknown-mp",
        message:
          'Skipping Claude marketplace "unknown-mp" because it has no supported url, github, ' +
          "or directory source (nested file/remote-marketplace.json sources are not importable).",
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
    cwd,
    deps: collaborators({
      loadSettings: () =>
        Promise.resolve(claudeSettings({ enabledPlugins: { "plugin@unknown-mp": true } })),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    pi,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [{ message: "(no marketplaces)" }]);
  verifyBoundary();
});

test("carries the settings loader's own diagnostics onto the result", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "settings-diagnostics");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    cwd,
    deps: collaborators({
      loadSettings: () => Promise.resolve(claudeSettings({ diagnostics: [settingsDiagnostic] })),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    pi,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [{ message: "(no marketplaces)" }]);
  verifyBoundary();
});

// A typed install failure the dispatcher recognises as unavailable or
// uninstallable becomes a warning row. The fault sits in the MIDDLE of a
// three-plugin batch, so the plugin installed before it keeps its outcome and
// the plugin after it is still attempted.
for (const { cause, error, reason, title } of [
  {
    cause: 'Plugin "target" not found in marketplace "mp".',
    error: (): Error =>
      new PluginShapeError({ kind: "not-in-manifest", marketplace: "mp", plugin: "target" }),
    reason: "unavailable",
    title: "the plugin is absent from the manifest",
  },
  {
    cause: "requires an unsupported tool",
    error: (): Error =>
      new PluginShapeError({
        kind: "not-installable",
        partialable: false,
        plugin: "target",
        reasons: ["requires an unsupported tool"],
      }),
    reason: "uninstallable",
    title: "the plugin is not installable",
  },
  {
    cause: "the marketplace dropped every supported component",
    error: (): Error =>
      new PluginShapeError({
        kind: "no-longer-installable",
        partialable: true,
        plugin: "target",
        reasons: ["the marketplace dropped every supported component"],
      }),
    reason: "uninstallable",
    title: "the plugin is no longer installable",
  },
] satisfies readonly {
  readonly cause: string;
  readonly error: () => Error;
  readonly reason: Warning["reason"];
  readonly title: string;
}[]) {
  test(`warns and keeps installing the batch when ${title}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "install-warning");
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
    const attempted: string[] = [];
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "project")],
      changedResources: true,
      installedPlugins: [installed("before", "mp", "project"), installed("after", "mp", "project")],
      warnings: [warned("target", "mp", "project", reason, cause)],
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
      pi,
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
          "  ⊘ target (unavailable) {no longer installable}\n\n" +
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
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
      pi,
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
] satisfies readonly {
  readonly cause: string;
  readonly installPlugin: (plugin: string) => Promise<InstallOutcome>;
  readonly order: readonly string[];
  readonly title: string;
}[]) {
  test(`records an unexpected plugin failure and keeps the batch after ${title}`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "install-unexpected");
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
      pi,
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
          "  ⊘ target (failed) {not in manifest}\n" +
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

// The installed outcome's two soft-dependency predicates ride onto the public
// outcome and onto the cascade row's marker brace. The boundary reports no
// companion extension loaded, so a declared dependency always surfaces.
for (const { declaresAgents, declaresMcp, marker } of [
  { declaresAgents: false, declaresMcp: false, marker: "" },
  { declaresAgents: true, declaresMcp: false, marker: " {requires pi-subagents}" },
  { declaresAgents: false, declaresMcp: true, marker: " {requires pi-mcp}" },
  {
    declaresAgents: true,
    declaresMcp: true,
    marker: " {requires pi-subagents, requires pi-mcp}",
  },
] satisfies readonly {
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
  readonly marker: string;
}[]) {
  test(`propagates declaresAgents ${declaresAgents} and declaresMcp ${declaresMcp} onto the outcome and the cascade row`, async (t) => {
    // arrange
    const { cwd } = await createHermeticScopes(t, "declares");
    const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
    const expectedResult: ClaudeImportExecutionResult = {
      ...emptyImportResult(),
      addedMarketplaces: [added("mp", "user")],
      changedResources: true,
      installedPlugins: [
        installed("plugin", "mp", "user", { agents: declaresAgents, mcp: declaresMcp }),
      ],
    };

    // act
    const importResult = await importClaudeSettings({
      ctx,
      cwd,
      deps: collaborators({
        addMarketplace: () => Promise.resolve(addedOutcome("mp")),
        installPlugin: () =>
          Promise.resolve({ ...installedOutcome(), declaresAgents, declaresMcp }),
        loadSettings: () =>
          Promise.resolve(
            claudeSettings({
              enabledPlugins: { "plugin@mp": true },
              extraKnownMarketplaces: { mp: { directory: "./mp" } },
            }),
          ),
        loadState: () => Promise.resolve(recordedState([])),
      }),
      pi,
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

test("records each post-commit warning the installed outcome carried as its own diagnostic", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "post-commit");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
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

test("reports no changed resources when every install left the Pi resource set alone", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "no-resource-change");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "user")],
    installedPlugins: [installed("plugin", "mp", "user", { agents: false, mcp: false }, false)],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
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
    pi,
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

test("installs only the plugin the state does not already record under a recorded marketplace", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "mixed-plugins");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
    selectedScopes: ["user"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp [user] (updated)\n" +
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
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const requested: InstallOptions[] = [];

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(requested, [
    {
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      pi,
      plugin: "alpha",
      scope: "project",
    },
    {
      ctx,
      cwd,
      marketplace: "mp",
      notifications: { mode: "orchestrated" },
      pi,
      plugin: "beta",
      scope: "project",
    },
  ]);
  verifyBoundary();
});

test("abandons only the scope whose state cannot be read and records why", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "state-unreadable");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
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
  ]);
  verifyBoundary();
});

test("keeps each selected scope's marketplaces and plugins independent and renders both blocks", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "two-scopes");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
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

/**
 * Count the completed atomic rewrites of one file. `write-file-atomic` finishes
 * every write with `fs.rename(tmp, target)`, so one rename whose destination is
 * the target is one complete rewrite. The spy carries no replacement, so the
 * real write still runs and the resulting bytes stay assertable; the count is
 * the separate promise. Counting discriminates the WB-03 batched post-pass from
 * a per-entry write loop, which an mtime comparison cannot: `>` holds for one
 * write and for thirty, and equality holds for a same-millisecond rewrite.
 */
function countAtomicWrites(t: TestContext, targetPath: string): () => number {
  const fsModule = createRequire(import.meta.url)("node:fs") as typeof import("node:fs");
  const renameSpy = t.mock.method(fsModule, "rename");
  return () => renameSpy.mock.calls.filter((call) => call.arguments[1] === targetPath).length;
}

/** The exact bytes `claude-plugins.json` carries after a batched post-pass. */
function configBytes(declared: {
  readonly marketplaces: Record<string, { readonly source: string }>;
  readonly plugins: Record<string, Record<string, never>>;
}): string {
  return `${JSON.stringify({ schemaVersion: 1, ...declared }, null, 2)}\n`;
}

test("declares every added marketplace and installed plugin in one batched config patch", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-happy");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { mp1: { source: "owner/mp1" }, mp2: { source: "owner/mp2" } },
    plugins: { "p1@mp1": {}, "p2@mp1": {}, "p3@mp2": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("touches the config file once for a multi-entry batch", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-mtime");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  await createScopeRoots(project);
  await writeFile(project.configJsonPath, configBytes({ marketplaces: {}, plugins: {} }), "utf8");
  const configWrites = countAtomicWrites(t, project.configJsonPath);
  const expectedBytes = configBytes({
    marketplaces: { mp1: { source: "owner/mp1" }, mp2: { source: "owner/mp2" } },
    plugins: { "p1@mp1": {}, "p2@mp1": {}, "p3@mp2": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  assert.strictEqual(configWrites(), 1);
  verifyBoundary();
});

test("leaves the config byte-identical when the batch carries nothing to declare", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-empty");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  await createScopeRoots(project);
  const seededBytes = `${JSON.stringify({ schemaVersion: 1, futureKey: "preserved" }, null, 2)}\n`;
  await writeFile(project.configJsonPath, seededBytes, "utf8");
  const configWrites = countAtomicWrites(t, project.configJsonPath);

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), seededBytes);
  assert.strictEqual(configWrites(), 0);
  verifyBoundary();
});

test("declares only the entries whose marketplace and install both succeeded", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-mixed");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { mp1: { source: "owner/mp1" } },
    plugins: { "p1@mp1": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("abandons the post-pass for a scope whose config is invalid and still writes the other scope", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "batch-invalid");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  await createScopeRoots(project, user);
  const invalidBytes = "{ not valid json";
  await writeFile(user.configJsonPath, invalidBytes, "utf8");
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
    pi,
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.deepStrictEqual(importResult, expectedResult);
  assert.strictEqual(await readFile(user.configJsonPath, "utf8"), invalidBytes);
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedProjectBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-project [project] (added)\n  ● p (installed)\n\n" +
        "● mp-user [user] (added)\n  ● p (installed)\n\n" +
        "Import: 4 successes\n\n" +
        "/reload to pick up changes",
    },
  ]);
  verifyBoundary();
});

test("declares a missing config entry for a marketplace and plugin the state already records", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "repair");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "plugin@mp": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("leaves an already-declared config byte-identical when every entry was a skip", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "repair-declared");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  await createScopeRoots(project);
  const seededBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "plugin@mp": {} },
  });
  await writeFile(project.configJsonPath, seededBytes, "utf8");
  const configWrites = countAtomicWrites(t, project.configJsonPath);

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), seededBytes);
  assert.strictEqual(configWrites(), 0);
  verifyBoundary();
});

test("repairs each scope's own config and never leaks the other scope's recorded entries", async (t) => {
  // arrange
  const { cwd, project, user } = await createHermeticScopes(t, "repair-scoped");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
    selectedScopes: ["user", "project"],
  });

  // assert
  assert.strictEqual(await readFile(user.configJsonPath, "utf8"), expectedUserBytes);
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedProjectBytes);
  verifyBoundary();
});

test("skips a recorded marketplace the later scope plan never declared when building its patch", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "patch-undeclared-add");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { "mp-a": { source: "./a" }, "mp-b": { source: "./b" } },
    plugins: { "a@mp-a": {}, "b@mp-b": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
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
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { "mp-a": { source: "./a" }, "mp-b": { source: "./b" } },
    plugins: { "a@mp-a": {}, "b@mp-b": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project", "project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● mp-a [project] (updated)\n  ⊘ a (skipped) {already installed}\n\n" +
        "● mp-b [project] (updated)\n  ⊘ b (skipped) {already installed}\n\n" +
        "Import: 4 successes",
    },
  ]);
  verifyBoundary();
});

test("records a diagnostic and keeps the result when the batched config write fails", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "batch-write-fails");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  await mkdir(project.scopeRoot, { recursive: true });
  // A regular file where the extension root belongs: taking the scope lock has
  // to create that directory first, so the post-pass fails before any write.
  await writeFile(project.extensionRoot, "not a directory", "utf8");
  const expectedResult: ClaudeImportExecutionResult = {
    ...emptyImportResult(),
    addedMarketplaces: [added("mp", "project")],
    changedResources: true,
    diagnostics: [
      {
        code: "settings-read-error",
        message:
          "Failed to write project scope claude-plugins.json batched post-pass: " +
          `EEXIST: file already exists, mkdir '${project.extensionRoot}'`,
        scope: "project",
        severity: "warning",
      },
    ],
    installedPlugins: [installed("plugin", "mp", "project")],
  };

  // act
  const importResult = await importClaudeSettings({
    ctx,
    cwd,
    deps: collaborators({
      addMarketplace: () => Promise.resolve(addedOutcome("mp")),
      installPlugin: () => Promise.resolve(installedOutcome()),
      loadSettings: () =>
        Promise.resolve(
          claudeSettings({
            enabledPlugins: { "plugin@mp": true },
            extraKnownMarketplaces: { mp: { directory: "./mp" } },
          }),
        ),
      loadState: () => Promise.resolve(recordedState([])),
    }),
    pi,
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
  ]);
  verifyBoundary();
});

/** Write `bytes` at `filePath`, creating the parent directory first. */
async function writeUnder(filePath: string, bytes: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes, "utf8");
}

test("resolves every collaborator from production when the caller supplies no dependency bundle", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "no-deps");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(2, 4);
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
      installed("sample", "fixture-mp", "project", { agents: false, mcp: false }, false),
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

  // act
  const firstResult = await importClaudeSettings({
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    pi,
    selectedScopes: ["project"],
  });
  const secondResult = await importClaudeSettings({
    ctx,
    cwd,
    gitOps: createOfflineGitOps(),
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.deepStrictEqual(firstResult, expectedFirstResult);
  assert.deepStrictEqual(secondResult, expectedSecondResult);
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  assert.deepStrictEqual(notifications, [
    {
      message:
        "● fixture-mp [project] (added)\n  ● sample (installed)\n\n" +
        "Import: 2 successes\n\n" +
        "/reload to pick up changes",
    },
    {
      message:
        "● fixture-mp [project] (updated)\n  ⊘ sample (skipped) {already installed}\n\n" +
        "Import: 2 successes",
    },
  ]);
  verifyBoundary();
});

test("declares a marketplace whose only plugin failed to install", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "marketplace-only-patch");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: {},
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("declares a freshly installed plugin under a recorded marketplace that records no plugins", async (t) => {
  // arrange
  const { cwd, project } = await createHermeticScopes(t, "plugin-only-patch");
  const { ctx, pi, verifyBoundary } = createNotificationBoundary(1, 2);
  const expectedBytes = configBytes({
    marketplaces: { mp: { source: "./mp" } },
    plugins: { "fresh@mp": {} },
  });

  // act
  await importClaudeSettings({
    ctx,
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
    pi,
    selectedScopes: ["project"],
  });

  // assert
  assert.strictEqual(await readFile(project.configJsonPath, "utf8"), expectedBytes);
  verifyBoundary();
});

test("lets a later scope plan's source mismatch supersede the header an earlier add recorded", async (t) => {
  // arrange
  const { cwd } = await createHermeticScopes(t, "status-supersede");
  const { ctx, notifications, pi, verifyBoundary } = createNotificationBoundary(1, 2);
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
    pi,
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
