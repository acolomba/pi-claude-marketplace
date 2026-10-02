// tests/orchestrators/reconcile/plan.test.ts
//
// Direct owner for planReconcile's pure seven-bucket diff. Every case supplies
// fresh complete config/state inputs and asserts the complete public plan.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { planReconcile } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts";
import { emptyReconcilePlan } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";
import { mergeScopeConfigs } from "../../../extensions/pi-claude-marketplace/persistence/config-merge.ts";

import type { ScopeSatisfactionVerdict } from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts";
import type {
  MarketplaceConfigEntry,
  PluginConfigEntry,
  ScopeConfig,
} from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

type MarketplaceRecord = ExtensionState["marketplaces"][string];
type PluginRecord = MarketplaceRecord["plugins"][string];

function marketplaceRecord(
  name: string,
  source: unknown,
  plugins: Record<string, PluginRecord> = {},
): MarketplaceRecord {
  return {
    name,
    scope: "project",
    source,
    addedFromCwd: "/workspace",
    manifestPath: `/marketplaces/${name}/.claude-plugin/marketplace.json`,
    marketplaceRoot: `/marketplaces/${name}`,
    plugins: { ...plugins },
  };
}

function mergedConfig(
  baseMarketplaces: Record<string, MarketplaceConfigEntry> = {},
  basePlugins: Record<string, PluginConfigEntry> = {},
  localMarketplaces: Record<string, MarketplaceConfigEntry> = {},
  localPlugins: Record<string, PluginConfigEntry> = {},
) {
  const base: ScopeConfig = {
    schemaVersion: 1,
    marketplaces: { ...baseMarketplaces },
    plugins: { ...basePlugins },
  };
  const local: ScopeConfig = {
    schemaVersion: 1,
    marketplaces: { ...localMarketplaces },
    plugins: { ...localPlugins },
  };
  return mergeScopeConfigs(base, local);
}

function pluginRecord(
  enabled: boolean,
  options: {
    readonly installable?: boolean;
    readonly skills?: readonly string[];
    readonly unsupported?: readonly string[];
    readonly provenance?: PluginRecord["provenance"];
    /**
     * Generated workflow names the record claims. A non-empty list also puts
     * `workflows` in the supported set, because the two travel together on a
     * real record and a record naming envelopes it does not claim to support
     * is a shape no verb produces.
     */
    readonly workflows?: readonly string[];
  } = {},
): PluginRecord {
  const installable = options.installable ?? true;
  const skills = options.skills ?? ["skill-a"];
  const unsupported = options.unsupported ?? [];
  const workflows = options.workflows ?? [];
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/plugin-a",
    compatibility: {
      installable,
      notes: installable ? [] : ["partial"],
      supported: [
        ...(skills.length === 0 ? [] : ["skills"]),
        ...(workflows.length === 0 ? [] : ["workflows"]),
      ],
      unsupported: [...unsupported],
    },
    resources: {
      skills: [...skills],
      prompts: [],
      agents: [],
      mcpServers: [],
      hooks: [],
      workflows: [...workflows],
    },
    enabled,
    // D-04-01: a direct install unless the case asks for a dependency.
    provenance: options.provenance ?? "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function stateWith(marketplaces: Record<string, MarketplaceRecord> = {}): ExtensionState {
  return { schemaVersion: 3, marketplaces: { ...marketplaces } };
}

// D-04-05: one retained marketplace holding a dependency-provenance record and
// a direct-install record side by side. Both D-04-05 cases plan over this same
// state, so an exemption wide enough to keep every undeclared record shows up
// as the missing `orphan` uninstall in either whole-plan assertion.
function provenanceState(): ExtensionState {
  return stateWith({
    keep: marketplaceRecord("keep", githubSource("acme/keep"), {
      steady: pluginRecord(true),
      dependency: pluginRecord(true, { provenance: "dependency" }),
      orphan: pluginRecord(true),
    }),
  });
}

// D-04-05: the cross-marketplace shape. `keep` is declared and holds the
// requesting plugin; `adopted` was recorded through the CMP-3 fallback, is
// declared nowhere, and holds a dependency record -- with or without a direct
// install beside it that nothing declares. Both cases below plan over the same
// declared config, so a removal guard that ignored provenance shows up as a
// planned removal of `adopted` in either whole-plan assertion.
function adoptedMarketplaceState(adoptedPlugins: Record<string, PluginRecord>): ExtensionState {
  return stateWith({
    keep: marketplaceRecord("keep", githubSource("acme/keep"), { steady: pluginRecord(true) }),
    adopted: marketplaceRecord("adopted", githubSource("acme/adopted"), adoptedPlugins),
  });
}

describe("planReconcile", () => {
  test("resolves a declared alias to the canonical recorded plugin target", () => {
    // arrange
    const merged = mergedConfig(
      { "declared-name": { source: "./local-marketplace" } },
      { "formatter@declared-name": {} },
    );
    const state = stateWith({
      "canonical-name": marketplaceRecord("canonical-name", pathSource("./local-marketplace")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [
        {
          scope: "project",
          plugin: "formatter",
          marketplace: "canonical-name",
          configSource: "base",
        },
      ],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("keeps the declared plugin target when its marketplace is new", () => {
    // arrange
    const merged = mergedConfig(
      { "declared-name": { source: "./local-marketplace" } },
      { "formatter@declared-name": {} },
    );

    // act
    const result = planReconcile(merged, stateWith(), "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [
        {
          scope: "project",
          marketplace: "declared-name",
          source: "./local-marketplace",
          configSource: "base",
        },
      ],
      marketplacesToRemove: [],
      pluginsToInstall: [
        {
          scope: "project",
          plugin: "formatter",
          marketplace: "declared-name",
          configSource: "base",
        },
      ],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("claims an alternate recorded name after skipping declared and different-source records", () => {
    // arrange
    const merged = mergedConfig({
      declared: { source: "acme/declared" },
      alias: { source: "acme/actual" },
    });
    const state = stateWith({
      declared: marketplaceRecord("declared", githubSource("acme/declared")),
      unmatched: marketplaceRecord("unmatched", githubSource("acme/unmatched")),
      actual: marketplaceRecord("actual", githubSource("acme/actual")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [{ scope: "project", marketplace: "unmatched", plugins: [] }],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("reports every recorded candidate when an alias source is ambiguous", () => {
    // arrange
    const merged = mergedConfig({ alias: { source: "acme/actual" } }, { "formatter@alias": {} });
    const state = stateWith({
      zeta: marketplaceRecord("zeta", githubSource("acme/actual")),
      alpha: marketplaceRecord("alpha", githubSource("acme/actual")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        {
          scope: "project",
          cause: "source-mismatch",
          marketplace: "alias",
          declaredSource: "acme/actual",
          recordedSource: "ambiguous recorded marketplaces: alpha, zeta",
        },
      ],
    });
    assert.deepStrictEqual(Object.keys(state.marketplaces), ["zeta", "alpha"]);
  });

  test("reports duplicate alias claims independently of declaration order", () => {
    // arrange
    const forward = mergedConfig({
      "alias-a": { source: "acme/actual" },
      "alias-b": { source: "acme/actual" },
    });
    const reverse = mergedConfig({
      "alias-b": { source: "acme/actual" },
      "alias-a": { source: "acme/actual" },
    });
    const state = stateWith({
      actual: marketplaceRecord("actual", githubSource("acme/actual")),
    });

    // act
    const forwardResult = planReconcile(forward, state, "project");
    const reverseResult = planReconcile(reverse, state, "project");

    // assert
    const expected = {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        {
          scope: "project",
          cause: "source-mismatch",
          marketplace: "alias-a",
          declaredSource: "acme/actual",
          recordedSource: "recorded marketplace claimed by multiple declarations: actual",
        },
        {
          scope: "project",
          cause: "source-mismatch",
          marketplace: "alias-b",
          declaredSource: "acme/actual",
          recordedSource: "recorded marketplace claimed by multiple declarations: actual",
        },
      ],
    };
    assert.deepStrictEqual(forwardResult, expected);
    assert.deepStrictEqual(reverseResult, expected);
  });

  test("keeps matching GitHub and path marketplaces at steady state", () => {
    // arrange
    const merged = mergedConfig({
      github: { source: "acme/github" },
      path: { source: "./local-marketplace" },
    });
    const state = stateWith({
      github: marketplaceRecord("github", githubSource("acme/github")),
      path: marketplaceRecord("path", pathSource("./local-marketplace")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("preserves base and local marketplace declaration order and provenance", () => {
    // arrange
    const merged = mergedConfig(
      {
        "base-zeta": { source: "acme/base-zeta" },
        "base-alpha": { source: "acme/base-alpha" },
      },
      {},
      {
        "local-zeta": { source: "./local-zeta" },
        "local-alpha": { source: "./local-alpha" },
      },
    );
    const state = stateWith();

    // act
    const result = planReconcile(merged, state, "user");

    // assert
    assert.deepStrictEqual(result, {
      scope: "user",
      marketplacesToAdd: [
        {
          scope: "user",
          marketplace: "base-zeta",
          source: "acme/base-zeta",
          configSource: "base",
        },
        {
          scope: "user",
          marketplace: "base-alpha",
          source: "acme/base-alpha",
          configSource: "base",
        },
        {
          scope: "user",
          marketplace: "local-zeta",
          source: "./local-zeta",
          configSource: "local",
        },
        {
          scope: "user",
          marketplace: "local-alpha",
          source: "./local-alpha",
          configSource: "local",
        },
      ],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("preserves source mismatch order and distinguishes unknown stored sources", () => {
    // arrange
    const merged = mergedConfig({
      mismatch: { source: "other/tools" },
      unknown: { source: "acme/unknown" },
    });
    const state = stateWith({
      mismatch: marketplaceRecord("mismatch", githubSource("acme/tools")),
      unknown: marketplaceRecord("unknown", {
        kind: "future-source",
        raw: "future://unknown",
      }),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        {
          scope: "project",
          cause: "source-mismatch",
          marketplace: "mismatch",
          declaredSource: "other/tools",
          recordedSource: "https://github.com/acme/tools",
        },
        {
          scope: "project",
          cause: "unknown-stored",
          marketplace: "unknown",
          declaredSource: "acme/unknown",
          recordedSource: "[object Object]",
        },
      ],
    });
  });

  test("returns the complete empty plan for empty inputs", () => {
    // arrange
    const merged = mergedConfig();
    const state = stateWith();

    // act
    const result = planReconcile(merged, state, "user");

    // assert
    assert.deepStrictEqual(result, {
      scope: "user",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("returns identical complete nonempty plans for repeated calls", () => {
    // arrange
    const merged = mergedConfig(
      { marketplace: { source: "acme/marketplace" } },
      { "plugin@marketplace": { enabled: true } },
    );
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", githubSource("acme/marketplace"), {
        plugin: pluginRecord(false, {
          installable: false,
          skills: [],
          unsupported: ["lspServers"],
        }),
      }),
    });

    // act
    const first = planReconcile(merged, state, "project");
    const second = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(first, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [{ scope: "project", plugin: "plugin", marketplace: "marketplace" }],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
    assert.deepStrictEqual(second, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [{ scope: "project", plugin: "plugin", marketplace: "marketplace" }],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("routes dangling enabled and disabled declarations to diagnostics before action buckets", () => {
    // arrange
    const merged = mergedConfig(
      {},
      {
        "enabled@obsolete": { enabled: true },
        "disabled@obsolete": { enabled: false },
        "ghost@missing": {},
      },
    );
    const state = stateWith({
      obsolete: marketplaceRecord("obsolete", githubSource("acme/obsolete"), {
        beta: pluginRecord(true),
        alpha: pluginRecord(true),
      }),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [
        { scope: "project", marketplace: "obsolete", plugins: ["beta", "alpha"] },
      ],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        {
          scope: "project",
          cause: "dangling-reference",
          marketplace: "obsolete",
          plugin: "enabled",
        },
        {
          scope: "project",
          cause: "dangling-reference",
          marketplace: "obsolete",
          plugin: "disabled",
        },
        {
          scope: "project",
          cause: "dangling-reference",
          marketplace: "missing",
          plugin: "ghost",
        },
      ],
    });
  });

  test("RECON-05: a declared, enabled, workflow-bearing record lands in no bucket", () => {
    // arrange -- the steady state a load-time reconcile meets after an install:
    // the marketplace is declared and recorded, the plugin is declared enabled
    // and recorded enabled, and the record names a workflow envelope. This is
    // the FIRST of the two structures that keep a reload from rewriting
    // executable code -- an empty plan means the apply path drives no
    // orchestrator for this plugin at all.
    const merged = mergedConfig(
      { marketplace: { source: "./local-marketplace" } },
      { "plugin-a@marketplace": { enabled: true } },
    );
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", pathSource("./local-marketplace"), {
        "plugin-a": pluginRecord(true, { workflows: ["plugin-a:greet"] }),
      }),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert -- every bucket, not just the install and enable ones. A record
    // reaching `pluginsToUninstall` or `pluginsToDisable` would take the
    // envelope off disk on a plain reload, which is the opposite failure.
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("routes enabled and disabled records to mutually exclusive action buckets", () => {
    // arrange
    const merged = mergedConfig(
      { marketplace: { source: "acme/marketplace" } },
      {
        "enable@marketplace": { enabled: true },
        "disable@marketplace": { enabled: false },
        "disabled-steady@marketplace": { enabled: false },
        "enabled-steady@marketplace": {},
      },
    );
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", githubSource("acme/marketplace"), {
        enable: pluginRecord(false),
        disable: pluginRecord(true),
        "disabled-steady": pluginRecord(false),
        "enabled-steady": pluginRecord(true),
      }),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [{ scope: "project", plugin: "enable", marketplace: "marketplace" }],
      pluginsToDisable: [{ scope: "project", plugin: "disable", marketplace: "marketplace" }],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("routes enabled missing plugins to install with base and local provenance", () => {
    // arrange
    const merged = mergedConfig(
      { marketplace: { source: "acme/marketplace" } },
      {
        "base-default@marketplace": {},
        "base-disabled@marketplace": { enabled: false },
      },
      {},
      { "local-enabled@marketplace": { enabled: true } },
    );
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", githubSource("acme/marketplace")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [
        {
          scope: "project",
          plugin: "base-default",
          marketplace: "marketplace",
          configSource: "base",
        },
        {
          scope: "project",
          plugin: "local-enabled",
          marketplace: "marketplace",
          configSource: "local",
        },
      ],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("routes malformed last-at boundaries to diagnostics and preserves a valid at-sign plugin name", () => {
    // arrange
    const merged = mergedConfig(
      { marketplace: { source: "./marketplace" } },
      {
        "missing-at": {},
        "@leading": {},
        "trailing@": {},
        "evil@evil@marketplace": {},
      },
    );
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", pathSource("./marketplace")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [
        {
          scope: "project",
          plugin: "evil@evil",
          marketplace: "marketplace",
          configSource: "base",
        },
      ],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        { scope: "project", cause: "malformed-plugin-key", rawKey: "missing-at" },
        { scope: "project", cause: "malformed-plugin-key", rawKey: "@leading" },
        { scope: "project", cause: "malformed-plugin-key", rawKey: "trailing@" },
      ],
    });
  });

  test("returns every nonempty bucket in deterministic input order", () => {
    // arrange
    const merged = mergedConfig(
      {
        keep: { source: "acme/keep" },
        mismatch: { source: "other/mismatch" },
        added: { source: "acme/added" },
      },
      {
        "install-zeta@keep": {},
        "install-alpha@keep": { enabled: true },
        "enable@keep": { enabled: true },
        "disable@keep": { enabled: false },
        "steady@keep": { enabled: true },
      },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        enable: pluginRecord(false),
        disable: pluginRecord(true),
        steady: pluginRecord(true),
        "uninstall-zeta": pluginRecord(true),
        "uninstall-alpha": pluginRecord(true),
      }),
      obsolete: marketplaceRecord("obsolete", githubSource("acme/obsolete"), {
        "child-zeta": pluginRecord(true),
        "child-alpha": pluginRecord(true),
      }),
      mismatch: marketplaceRecord("mismatch", githubSource("acme/mismatch")),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [
        {
          scope: "project",
          marketplace: "added",
          source: "acme/added",
          configSource: "base",
        },
      ],
      marketplacesToRemove: [
        {
          scope: "project",
          marketplace: "obsolete",
          plugins: ["child-zeta", "child-alpha"],
        },
      ],
      pluginsToInstall: [
        {
          scope: "project",
          plugin: "install-zeta",
          marketplace: "keep",
          configSource: "base",
        },
        {
          scope: "project",
          plugin: "install-alpha",
          marketplace: "keep",
          configSource: "base",
        },
      ],
      pluginsToUninstall: [
        { scope: "project", plugin: "uninstall-zeta", marketplace: "keep" },
        { scope: "project", plugin: "uninstall-alpha", marketplace: "keep" },
      ],
      pluginsToEnable: [{ scope: "project", plugin: "enable", marketplace: "keep" }],
      pluginsToDisable: [{ scope: "project", plugin: "disable", marketplace: "keep" }],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [
        {
          scope: "project",
          cause: "source-mismatch",
          marketplace: "mismatch",
          declaredSource: "other/mismatch",
          recordedSource: "https://github.com/acme/mismatch",
        },
      ],
    });
  });

  test("returns recorded plugin uninstalls in state insertion order", () => {
    // arrange
    const merged = mergedConfig({ marketplace: { source: "acme/marketplace" } });
    const state = stateWith({
      marketplace: marketplaceRecord("marketplace", githubSource("acme/marketplace"), {
        zeta: pluginRecord(true),
        alpha: pluginRecord(true),
      }),
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [
        { scope: "project", plugin: "zeta", marketplace: "marketplace" },
        { scope: "project", plugin: "alpha", marketplace: "marketplace" },
      ],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("D-04-05: keeps an undeclared record whose provenance is dependency", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = provenanceState();

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [{ scope: "project", plugin: "orphan", marketplace: "keep" }],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("D-04-05: still sweeps an undeclared direct install beside a declared dependency", () => {
    // arrange
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "steady@keep": {}, "dependency@keep": {} },
    );
    const state = provenanceState();

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [{ scope: "project", plugin: "orphan", marketplace: "keep" }],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("D-04-05: retains an undeclared marketplace while a record under it is a dependency", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = adoptedMarketplaceState({
      dependency: pluginRecord(true, { provenance: "dependency" }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("D-04-05: still sweeps a direct-install orphan under a marketplace retained for its dependency", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = adoptedMarketplaceState({
      dependency: pluginRecord(true, { provenance: "dependency" }),
      orphan: pluginRecord(true),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [{ scope: "project", plugin: "orphan", marketplace: "adopted" }],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("D-04-05: still removes an undeclared marketplace whose records are all direct installs", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = adoptedMarketplaceState({ orphan: pluginRecord(true) });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [{ scope: "project", marketplace: "adopted", plugins: ["orphan"] }],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });
  // LOAD-01: the load-time verdict arrives as precomputed data (D-06-04), so
  // every case below states the whole verdict rather than deriving one.
  test("buckets a held-down declarer and plans no enable for it", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert -- D-09-02's third arm: deploy-kit is user-disabled but the
    // config declares it enabled, so this pass will enable it and its own
    // missing dependency is fetched.
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [
        {
          scope: "project",
          plugin: "deploy-kit",
          marketplace: "keep",
          dependency: "secrets-vault@keep",
          kind: "missing",
        },
      ],
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "secrets-vault",
          marketplace: "keep",
          ranges: [],
          requiredBy: "deploy-kit@keep",
          declarers: ["deploy-kit@keep"],
        },
      ],
      sourceMismatches: [],
    });
  });

  test("MISS-01: buckets a missing declared dependency once, with its declarer's ranges", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        {
          dependent: "deploy-kit@keep",
          dependency: "secrets-vault@keep",
          kind: "missing",
          ranges: ["^2.0.0"],
        },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [
        {
          scope: "project",
          plugin: "deploy-kit",
          marketplace: "keep",
          dependency: "secrets-vault@keep",
          kind: "missing",
        },
      ],
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "secrets-vault",
          marketplace: "keep",
          ranges: ["^2.0.0"],
          requiredBy: "deploy-kit@keep",
          declarers: ["deploy-kit@keep"],
        },
      ],
      sourceMismatches: [],
    });
  });

  test("MISS-01: two declarers of one missing key fold into one bucket entry", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "a@keep": {}, "b@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        a: pluginRecord(true),
        b: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "a@keep", dependency: "c@keep", kind: "missing", ranges: ["^1.0.0"] },
        { dependent: "b@keep", dependency: "c@keep", kind: "missing", ranges: [">=1.2.0"] },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, [
      {
        scope: "project",
        plugin: "c",
        marketplace: "keep",
        ranges: ["^1.0.0", ">=1.2.0"],
        requiredBy: "a@keep",
        declarers: ["a@keep", "b@keep"],
      },
    ]);
  });

  test("XMKT-01 retains each eligible original declarer once without dropping ranges", () => {
    // arrange
    const merged = mergedConfig(
      { alpha: { source: "acme/alpha" }, gamma: { source: "acme/gamma" } },
      { "a@alpha": {}, "c@gamma": {} },
    );
    const state = stateWith({
      alpha: marketplaceRecord("alpha", githubSource("acme/alpha"), { a: pluginRecord(true) }),
      gamma: marketplaceRecord("gamma", githubSource("acme/gamma"), { c: pluginRecord(true) }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "a@alpha", dependency: "b@beta", kind: "missing", ranges: ["^1.0.0"] },
        { dependent: "c@gamma", dependency: "b@beta", kind: "missing", ranges: [">=1.2.0"] },
        { dependent: "a@alpha", dependency: "b@beta", kind: "missing", ranges: ["<2.0.0"] },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, [
      {
        scope: "project",
        plugin: "b",
        marketplace: "beta",
        ranges: ["^1.0.0", ">=1.2.0", "<2.0.0"],
        requiredBy: "a@alpha",
        declarers: ["a@alpha", "c@gamma"],
      },
    ]);
  });

  test("MISS-01: a second declarer with no constraint contributes nothing to the fold", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "a@keep": {}, "b@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        a: pluginRecord(true),
        b: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "a@keep", dependency: "c@keep", kind: "missing", ranges: ["^1.0.0"] },
        { dependent: "b@keep", dependency: "c@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, [
      {
        scope: "project",
        plugin: "c",
        marketplace: "keep",
        ranges: ["^1.0.0"],
        requiredBy: "a@keep",
        declarers: ["a@keep", "b@keep"],
      },
    ]);
  });

  test("MISS-01: bucket entries sort by dependency key", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "app@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        app: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "app@keep", dependency: "zeta@keep", kind: "missing" },
        { dependent: "app@keep", dependency: "alpha@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(
      plan.pluginsToDependencyInstall.map((entry) => entry.plugin),
      ["alpha", "zeta"],
    );
  });

  test("MISS-01: skips a verdict entry whose dependency key parsePluginKey rejects", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "app@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        app: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [{ dependent: "app@keep", dependency: "no-at-sign", kind: "missing" }],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-02: a user-disabled dependent the config leaves alone brings nothing in", () => {
    // arrange -- deploy-kit is a dependency-provenance record (D-04-02: never
    // named in config), disabled with no marker, so no arm admits it.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false, { provenance: "dependency" }),
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-02: a marker-held dependent brings its missing dependency in", () => {
    // arrange -- deploy-kit is a dependency-provenance record (D-04-02: never
    // named in config) the check's own marker holds down; a marker-held
    // record is optimistically read as about to recover.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": {
          ...pluginRecord(false, { provenance: "dependency" }),
          dependencyDisabled: true,
        },
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, [
      {
        scope: "project",
        plugin: "secrets-vault",
        marketplace: "keep",
        ranges: [],
        requiredBy: "deploy-kit@keep",
        declarers: ["deploy-kit@keep"],
      },
    ]);
  });

  test("D-09-02: a config-declared disabled record is not lifted by its own marker", () => {
    // arrange -- the merged config explicitly disables deploy-kit; the
    // marker must not override that even though it satisfies arm (b).
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "deploy-kit@keep": { enabled: false } },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-02: an uninstall-claimed dependent brings nothing in", () => {
    // arrange -- orphan is recorded but declared nowhere, so it is claimed by
    // the uninstall bucket.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        orphan: pluginRecord(true),
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "orphan@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToUninstall, [
      { scope: "project", plugin: "orphan", marketplace: "keep" },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-02: a disable-claimed dependent brings nothing in", () => {
    // arrange -- paused is declared `enabled: false` and still materialised,
    // so it is claimed by the disable bucket.
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "paused@keep": { enabled: false } },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        paused: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "paused@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDisable, [
      { scope: "project", plugin: "paused", marketplace: "keep" },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-02: a removal-claimed dependent brings nothing in", () => {
    // arrange -- `dropped`'s whole marketplace is undeclared, so every plugin
    // under it is claimed by the marketplace-removal cascade.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), { steady: pluginRecord(true) }),
      dropped: marketplaceRecord("dropped", githubSource("acme/dropped"), {
        gone: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "gone@dropped", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.marketplacesToRemove, [
      { scope: "project", marketplace: "dropped", plugins: ["gone"] },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("D-09-06: a key the config already installs stays out of the bucket", () => {
    // arrange -- secrets-vault@keep is declared+enabled but not yet recorded,
    // so it lands in pluginsToInstall; its own cascade will claim it.
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "deploy-kit@keep": {}, "secrets-vault@keep": {} },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToInstall, [
      { scope: "project", plugin: "secrets-vault", marketplace: "keep", configSource: "base" },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, []);
  });

  test("carries the declared range of an out-of-range dependency onto the bucket entry", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        {
          dependent: "deploy-kit@keep",
          dependency: "secrets-vault@keep",
          kind: "out-of-range",
          range: "^2.0.0",
        },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, [
      {
        scope: "project",
        plugin: "deploy-kit",
        marketplace: "keep",
        dependency: "secrets-vault@keep",
        kind: "out-of-range",
        range: "^2.0.0",
      },
    ]);
  });

  test("buckets one entry per held-down declarer however many of its declarations are unsatisfied", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
        { dependent: "deploy-kit@keep", dependency: "logger@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, [
      {
        scope: "project",
        plugin: "deploy-kit",
        marketplace: "keep",
        dependency: "secrets-vault@keep",
        kind: "missing",
      },
    ]);
  });

  test("LOAD-02: lifts a marked record once the live verdict no longer names it", () => {
    // arrange -- the marker says a previous pass held it down; the verdict says
    // the dependency is satisfied now.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, [
      { scope: "project", plugin: "deploy-kit", marketplace: "keep" },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, []);
  });

  test("LOAD-02: plans neither the enable nor the disable bucket for a marked record whose dependency is still unsatisfied", () => {
    // arrange -- the terminal state of a consequence-disable. Bucketing it for
    // enable would oscillate; bucketing it for the disable again would put the
    // scope in the plan on every reload. MISS-01 still fetches the missing
    // dependency: that is what lets D-09-08's lift bring the record back up
    // on a later pass.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, []);
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, []);
    assert.deepStrictEqual(plan.pluginsToDependencyInstall, [
      {
        scope: "project",
        plugin: "secrets-vault",
        marketplace: "keep",
        ranges: [],
        requiredBy: "deploy-kit@keep",
        declarers: ["deploy-kit@keep"],
      },
    ]);
  });

  test("LOAD-02: never lifts a disable the user asked for", () => {
    // arrange -- a user disable writes `enabled: false` to the config AND the
    // record, and stamps no marker. The satisfied verdict must not revive it.
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "deploy-kit@keep": { enabled: false } },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
  });

  test("LOAD-02: an unmarked disabled record is enabled by the ordinary path, not by the check", () => {
    // arrange -- the config declares it enabled and the record is disabled, so
    // the ordinary ENBL-02 divergence fires. The check's predicate gates
    // nothing here, which is what makes the marker the only thing it lifts.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, [
      { scope: "project", plugin: "deploy-kit", marketplace: "keep" },
    ]);
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, []);
  });

  test("D-09-08: a marker-held dependency-provenance record is lifted without a config entry", () => {
    // arrange -- deploy-kit is never named in config (D-04-02); the marker
    // says a previous pass held it down, and the empty verdict says its
    // dependency is satisfied now.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": {
          ...pluginRecord(false, { provenance: "dependency" }),
          dependencyDisabled: true,
        },
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, [
      { scope: "project", plugin: "deploy-kit", marketplace: "keep" },
    ]);
  });

  test("D-09-08: neither bucket holds a marker-held record while the verdict still holds it", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": {
          ...pluginRecord(false, { provenance: "dependency" }),
          dependencyDisabled: true,
        },
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "deploy-kit@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, []);
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, []);
  });

  test("D-09-08: a disabled record without the marker is not lifted", () => {
    // arrange -- no marker: this is the user's own disable, or predates the
    // marker's existence, and stays down.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false, { provenance: "dependency" }),
        steady: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, []);
  });

  test("D-09-08: a marker-carrying record the config declares disabled is not lifted", () => {
    // arrange -- the merged config explicitly disables deploy-kit; the
    // marker must not override that.
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "deploy-kit@keep": { enabled: false } },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, []);
  });

  test("D-09-08: a marker-carrying record the config declares enabled is lifted exactly once", () => {
    // arrange -- the config-declared lift in classifyDeclaredPlugin and the
    // D-09-08 walk must not both produce an entry for this key.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, [
      { scope: "project", plugin: "deploy-kit", marketplace: "keep" },
    ]);
  });

  test("D-09-08: a marker-carrying record under a removed marketplace is not lifted", () => {
    // arrange -- `dropped`'s whole marketplace is undeclared, so every
    // plugin under it is claimed by the marketplace-removal cascade.
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), { steady: pluginRecord(true) }),
      dropped: marketplaceRecord("dropped", githubSource("acme/dropped"), {
        "deploy-kit": { ...pluginRecord(false), dependencyDisabled: true },
      }),
    });
    const verdict: ScopeSatisfactionVerdict = { ok: true, unsatisfied: [] };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToEnable, []);
    assert.deepStrictEqual(plan.marketplacesToRemove, [
      { scope: "project", marketplace: "dropped", plugins: ["deploy-kit"] },
    ]);
  });

  test("plans the ordinary enable when the declaration walk could not reach a verdict", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "deploy-kit@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        "deploy-kit": pluginRecord(false),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: false,
      declarer: "deploy-kit@keep",
      cause: new Error("cannot read the dependencies of deploy-kit@keep: unusable"),
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [{ scope: "project", plugin: "deploy-kit", marketplace: "keep" }],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });

  test("leaves a plugin another bucket already claims out of the dependency-disable bucket", () => {
    // arrange -- `retired` is uninstalled, `paused` is disabled by the config,
    // and `gone`'s whole marketplace is removed.
    const merged = mergedConfig(
      { keep: { source: "acme/keep" } },
      { "paused@keep": { enabled: false } },
    );
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        paused: pluginRecord(true),
        retired: pluginRecord(true),
      }),
      dropped: marketplaceRecord("dropped", githubSource("acme/dropped"), {
        gone: pluginRecord(true),
      }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "paused@keep", dependency: "secrets-vault@keep", kind: "missing" },
        { dependent: "retired@keep", dependency: "secrets-vault@keep", kind: "missing" },
        { dependent: "gone@dropped", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan.pluginsToDependencyDisable, []);
    assert.deepStrictEqual(plan.pluginsToDisable, [
      { scope: "project", plugin: "paused", marketplace: "keep" },
    ]);
    assert.deepStrictEqual(plan.pluginsToUninstall, [
      { scope: "project", plugin: "retired", marketplace: "keep" },
    ]);
  });

  test("skips a verdict entry naming a key no record in the scope carries", () => {
    // arrange
    const merged = mergedConfig({ keep: { source: "acme/keep" } }, { "steady@keep": {} });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), { steady: pluginRecord(true) }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [
        { dependent: "ghost@keep", dependency: "secrets-vault@keep", kind: "missing" },
        { dependent: "@keep", dependency: "secrets-vault@keep", kind: "missing" },
      ],
    };

    // act
    const plan = planReconcile(merged, state, "project", verdict);

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });
});
