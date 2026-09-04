import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock } from "strong-mock";

import {
  emptyReconcilePlan,
  plannedSourceMismatchSubject,
  type ApplyReconcileOptions,
  type PlannedMarketplaceAdd,
  type PlannedMarketplaceRemove,
  type PlannedPluginDisable,
  type PlannedPluginEnable,
  type PlannedPluginInstall,
  type PlannedPluginUninstall,
  type PlannedSourceMismatch,
  type PlannedSourceMismatchOfDanglingReference,
  type PlannedSourceMismatchOfMalformedPluginKey,
  type PlannedSourceMismatchOfSourceMismatch,
  type PlannedSourceMismatchOfUnknownStored,
  type ReconcilePlan,
  type ScopeReadResult,
} from "../../../extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const extensionContext = mock<ExtensionContext>({
  exactParams: true,
  name: "extension context type evidence",
});
const extensionApi = mock<ExtensionAPI>({
  exactParams: true,
  name: "extension API type evidence",
});
const gitOps = mock<GitOps>({ exactParams: true, name: "Git operations type evidence" });

const plannedMarketplaceAdd = {
  scope: "project",
  marketplace: "official",
  source: "https://github.com/example/official.git",
  configSource: "base",
} satisfies PlannedMarketplaceAdd;
const plannedMarketplaceRemove = {
  scope: "user",
  marketplace: "retired",
  plugins: ["formatter", "linter"],
} satisfies PlannedMarketplaceRemove;
const plannedPluginInstall = {
  scope: "project",
  plugin: "formatter",
  marketplace: "official",
  configSource: "local",
} satisfies PlannedPluginInstall;
const plannedPluginUninstall = {
  scope: "user",
  plugin: "legacy",
  marketplace: "retired",
} satisfies PlannedPluginUninstall;
const plannedPluginEnable = {
  scope: "project",
  plugin: "formatter",
  marketplace: "official",
} satisfies PlannedPluginEnable;
const plannedPluginDisable = {
  scope: "user",
  plugin: "linter",
  marketplace: "official",
} satisfies PlannedPluginDisable;
const sourceMismatch = {
  scope: "project",
  cause: "source-mismatch",
  marketplace: "official",
  declaredSource: "https://github.com/example/official.git",
  recordedSource: "https://github.com/example/retired.git",
} satisfies PlannedSourceMismatchOfSourceMismatch;
const unknownStoredSource = {
  scope: "user",
  cause: "unknown-stored",
  marketplace: "legacy",
  declaredSource: "https://github.com/example/legacy.git",
  recordedSource: "unknown-source",
} satisfies PlannedSourceMismatchOfUnknownStored;
const danglingReference = {
  scope: "project",
  cause: "dangling-reference",
  marketplace: "missing",
  plugin: "formatter",
} satisfies PlannedSourceMismatchOfDanglingReference;
const malformedPluginKey = {
  scope: "user",
  cause: "malformed-plugin-key",
  rawKey: "formatter",
} satisfies PlannedSourceMismatchOfMalformedPluginKey;

void (sourceMismatch satisfies PlannedSourceMismatch);
void (unknownStoredSource satisfies PlannedSourceMismatch);
void (danglingReference satisfies PlannedSourceMismatch);
void (malformedPluginKey satisfies PlannedSourceMismatch);

void ({
  scope: "project",
  marketplacesToAdd: [plannedMarketplaceAdd],
  marketplacesToRemove: [plannedMarketplaceRemove],
  pluginsToInstall: [plannedPluginInstall],
  pluginsToUninstall: [plannedPluginUninstall],
  pluginsToEnable: [plannedPluginEnable],
  pluginsToDisable: [plannedPluginDisable],
  sourceMismatches: [sourceMismatch, unknownStoredSource, danglingReference, malformedPluginKey],
} satisfies ReconcilePlan);

void ({
  ctx: extensionContext,
  pi: extensionApi,
  cwd: "/work/project",
} satisfies ApplyReconcileOptions);
void ({
  ctx: extensionContext,
  pi: extensionApi,
  cwd: "/work/project",
  scope: "project",
  gitOps,
} satisfies ApplyReconcileOptions);

const extensionState = {
  schemaVersion: 2,
  marketplaces: {},
} satisfies ExtensionState;
void ({
  scope: "user",
  plan: undefined,
  invalidOutcomes: [],
  stateExisted: false,
} satisfies ScopeReadResult);
void ({
  scope: "project",
  plan: emptyReconcilePlan("project"),
  invalidOutcomes: [
    {
      kind: "invalid-block",
      scope: "project",
      basename: "state.json",
      reason: "unparseable",
      cause: new Error("Unexpected token"),
    },
  ],
  state: extensionState,
  stateExisted: true,
} satisfies ScopeReadResult);

void ({
  marketplace: "official",
  source: "https://github.com/example/official.git",
  configSource: "base",
  // @ts-expect-error marketplace additions always carry their scope
} satisfies PlannedMarketplaceAdd);
void ({
  scope: "project",
  // @ts-expect-error marketplace additions cannot carry removal children
  plugins: ["formatter"],
  marketplace: "official",
  source: "https://github.com/example/official.git",
  configSource: "base",
} satisfies PlannedMarketplaceAdd);
void ({
  scope: "user",
  plugins: [],
  // @ts-expect-error marketplace removals always identify their marketplace
} satisfies PlannedMarketplaceRemove);
void ({
  scope: "user",
  marketplace: "retired",
  plugins: [],
  // @ts-expect-error marketplace removals cannot carry an addition source
  source: "https://github.com/example/retired.git",
} satisfies PlannedMarketplaceRemove);
void ({
  scope: "project",
  marketplace: "official",
  configSource: "base",
  // @ts-expect-error plugin installs always identify their plugin
} satisfies PlannedPluginInstall);
void ({
  scope: "user",
  plugin: "legacy",
  // @ts-expect-error plugin uninstalls always identify their marketplace
} satisfies PlannedPluginUninstall);
void ({
  scope: "user",
  plugin: "legacy",
  marketplace: "retired",
  // @ts-expect-error plugin uninstalls do not carry config provenance
  configSource: "base",
} satisfies PlannedPluginUninstall);
void ({
  plugin: "formatter",
  marketplace: "official",
  // @ts-expect-error plugin enables always carry their scope
} satisfies PlannedPluginEnable);
void ({
  scope: "project",
  plugin: "formatter",
  marketplace: "official",
  // @ts-expect-error plugin enables do not carry install config provenance
  configSource: "local",
} satisfies PlannedPluginEnable);
void ({
  scope: "user",
  marketplace: "official",
  // @ts-expect-error plugin disables always identify their plugin
} satisfies PlannedPluginDisable);
void ({
  scope: "user",
  plugin: "linter",
  marketplace: "official",
  // @ts-expect-error plugin disables do not carry install config provenance
  configSource: "base",
} satisfies PlannedPluginDisable);
void ({
  scope: "project",
  cause: "source-mismatch",
  marketplace: "official",
  declaredSource: "https://github.com/example/official.git",
  // @ts-expect-error source mismatches retain the recorded source
} satisfies PlannedSourceMismatchOfSourceMismatch);
void ({
  scope: "user",
  cause: "unknown-stored",
  marketplace: "legacy",
  recordedSource: "unknown-source",
  // @ts-expect-error unknown stored sources retain the declared source
} satisfies PlannedSourceMismatchOfUnknownStored);
void ({
  scope: "project",
  cause: "dangling-reference",
  marketplace: "missing",
  // @ts-expect-error dangling references identify the referenced plugin
} satisfies PlannedSourceMismatchOfDanglingReference);
void ({
  scope: "project",
  cause: "dangling-reference",
  marketplace: "missing",
  plugin: "formatter",
  // @ts-expect-error dangling references do not carry source comparison fields
  declaredSource: "https://github.com/example/missing.git",
} satisfies PlannedSourceMismatchOfDanglingReference);
void ({
  scope: "user",
  cause: "malformed-plugin-key",
  // @ts-expect-error malformed plugin keys identify the raw config key
} satisfies PlannedSourceMismatchOfMalformedPluginKey);
void ({
  scope: "user",
  cause: "malformed-plugin-key",
  rawKey: "formatter",
  // @ts-expect-error malformed plugin keys do not pretend to be marketplace names
  marketplace: "official",
} satisfies PlannedSourceMismatchOfMalformedPluginKey);
void ({
  scope: "project",
  // @ts-expect-error mismatch causes use a closed vocabulary
  cause: "unreadable",
  marketplace: "official",
} satisfies PlannedSourceMismatch);
void ({
  scope: "project",
  marketplacesToAdd: [],
  marketplacesToRemove: [],
  pluginsToInstall: [],
  pluginsToUninstall: [],
  pluginsToEnable: [],
  pluginsToDisable: [],
  // @ts-expect-error reconcile plans always expose their mismatch bucket
} satisfies ReconcilePlan);
// @ts-expect-error apply options always expose the Pi context
void ({ pi: extensionApi, cwd: "/work/project" } satisfies ApplyReconcileOptions);
void ({
  ctx: extensionContext,
  pi: extensionApi,
  cwd: "/work/project",
  scope: undefined,
  // @ts-expect-error exact optional properties reject an explicitly undefined scope
} satisfies ApplyReconcileOptions);
void ({
  ctx: extensionContext,
  pi: extensionApi,
  cwd: "/work/project",
  gitOps: undefined,
  // @ts-expect-error exact optional properties reject explicitly undefined Git operations
} satisfies ApplyReconcileOptions);
void ({
  scope: "project",
  plan: undefined,
  invalidOutcomes: [],
  // @ts-expect-error scope reads always state whether state.json existed
} satisfies ScopeReadResult);
void ({
  scope: "project",
  plan: undefined,
  invalidOutcomes: [
    {
      // @ts-expect-error invalid outcomes use the closed per-entry discriminants
      kind: "plugin-updated",
      scope: "project",
      marketplace: "official",
      plugin: "formatter",
    },
  ],
  stateExisted: true,
} satisfies ScopeReadResult);
void ({
  scope: "project",
  plan: undefined,
  invalidOutcomes: [],
  state: undefined,
  stateExisted: false,
  // @ts-expect-error exact optional properties reject an explicitly undefined state
} satisfies ScopeReadResult);

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error marketplace removal children are readonly
void (true satisfies IsMutableArray<PlannedMarketplaceRemove["plugins"]>);
// @ts-expect-error marketplace additions are readonly
void (true satisfies IsMutableArray<ReconcilePlan["marketplacesToAdd"]>);
// @ts-expect-error marketplace removals are readonly
void (true satisfies IsMutableArray<ReconcilePlan["marketplacesToRemove"]>);
// @ts-expect-error plugin installs are readonly
void (true satisfies IsMutableArray<ReconcilePlan["pluginsToInstall"]>);
// @ts-expect-error plugin uninstalls are readonly
void (true satisfies IsMutableArray<ReconcilePlan["pluginsToUninstall"]>);
// @ts-expect-error plugin enables are readonly
void (true satisfies IsMutableArray<ReconcilePlan["pluginsToEnable"]>);
// @ts-expect-error plugin disables are readonly
void (true satisfies IsMutableArray<ReconcilePlan["pluginsToDisable"]>);
// @ts-expect-error source mismatches are readonly
void (true satisfies IsMutableArray<ReconcilePlan["sourceMismatches"]>);
// @ts-expect-error invalid per-entry outcomes are readonly
void (true satisfies IsMutableArray<ScopeReadResult["invalidOutcomes"]>);

describe("plannedSourceMismatchSubject", () => {
  test("selects the marketplace for a source mismatch", () => {
    // arrange
    const mismatch = {
      scope: "project",
      cause: "source-mismatch",
      marketplace: "official",
      declaredSource: "https://github.com/example/official.git",
      recordedSource: "https://github.com/example/retired.git",
    } satisfies PlannedSourceMismatch;

    // act
    const subject = plannedSourceMismatchSubject(mismatch);

    // assert
    assert.strictEqual(subject, "official");
  });

  test("selects the raw key for a malformed plugin key", () => {
    // arrange
    const mismatch = {
      scope: "user",
      cause: "malformed-plugin-key",
      rawKey: "formatter",
    } satisfies PlannedSourceMismatch;

    // act
    const subject = plannedSourceMismatchSubject(mismatch);

    // assert
    assert.strictEqual(subject, "formatter");
  });
});

describe("emptyReconcilePlan", () => {
  test("returns the complete project plan in canonical bucket order", () => {
    // arrange
    const scope = "project";

    // act
    const plan = emptyReconcilePlan(scope);

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      sourceMismatches: [],
    });
    assert.deepStrictEqual(Object.keys(plan), [
      "scope",
      "marketplacesToAdd",
      "marketplacesToRemove",
      "pluginsToInstall",
      "pluginsToUninstall",
      "pluginsToEnable",
      "pluginsToDisable",
      "sourceMismatches",
    ]);
  });

  test("returns the complete user plan", () => {
    // arrange
    const scope = "user";

    // act
    const plan = emptyReconcilePlan(scope);

    // assert
    assert.deepStrictEqual(plan, {
      scope: "user",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      sourceMismatches: [],
    });
  });

  test("returns fresh plans with no bucket aliases", () => {
    // arrange
    const scope = "project";

    // act
    const firstPlan = emptyReconcilePlan(scope);
    const secondPlan = emptyReconcilePlan(scope);

    // assert
    assert.deepStrictEqual(firstPlan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      sourceMismatches: [],
    });
    assert.deepStrictEqual(secondPlan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      sourceMismatches: [],
    });
    assert.notStrictEqual(firstPlan, secondPlan);
    assert.strictEqual(
      new Set([
        firstPlan.marketplacesToAdd,
        firstPlan.marketplacesToRemove,
        firstPlan.pluginsToInstall,
        firstPlan.pluginsToUninstall,
        firstPlan.pluginsToEnable,
        firstPlan.pluginsToDisable,
        firstPlan.sourceMismatches,
        secondPlan.marketplacesToAdd,
        secondPlan.marketplacesToRemove,
        secondPlan.pluginsToInstall,
        secondPlan.pluginsToUninstall,
        secondPlan.pluginsToEnable,
        secondPlan.pluginsToDisable,
        secondPlan.sourceMismatches,
      ]).size,
      14,
    );
  });
});
