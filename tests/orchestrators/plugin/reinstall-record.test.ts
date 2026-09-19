import assert from "node:assert/strict";
import test from "node:test";

import {
  recordReinstallOutcome,
  reinstallReasonsFromError,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts";
import {
  ManualRecoveryError,
  PluginShapeError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { MaterializablePlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { ReinstallPreparedHandles } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const EMPTY_RESOURCES: PluginInstallRecord["resources"] = {
  agents: [],
  hooks: [],
  mcpServers: [],
  prompts: [],
  skills: [],
};

function oldRecord(overrides: Partial<PluginInstallRecord> = {}): PluginInstallRecord {
  return {
    version: "1.2.3",
    resolvedSource: "/old/plugin",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: EMPTY_RESOURCES,
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function stateWith(record: PluginInstallRecord): ExtensionState {
  return {
    schemaVersion: 2,
    marketplaces: {
      market: {
        name: "market",
        scope: "project",
        source: { kind: "path", path: "/market" },
        addedFromCwd: "/workspace",
        manifestPath: "/market/marketplace.json",
        marketplaceRoot: "/market",
        plugins: { plugin: record },
      },
    },
  };
}

function installable(state: MaterializablePlugin["state"] = "installable"): MaterializablePlugin {
  return {
    state,
    installable: true,
    name: "plugin",
    pluginRoot: "/new/plugin",
    supported: state === "installable" ? ["skills", "commands", "agents", "mcp"] : ["skills"],
    unsupported: state === "installable" ? [] : ["commands"],
    notes: state === "installable" ? [] : ["commands unavailable"],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
    ...(state === "partially-available" && { hooksConfigPath: "hooks/hooks.json" }),
  };
}

function handles(
  options: {
    readonly degraded?: boolean;
    readonly populated?: boolean;
  } = {},
): ReinstallPreparedHandles {
  const result = (name: string, degraded = false) => ({
    recorded: options.populated === true ? [{ generatedName: name }] : [],
    degraded: degraded ? [{ generatedName: name }] : [],
    warnings: [],
  });
  return {
    skills: { result: result("skill", options.degraded) },
    commands: { result: result("command", options.degraded) },
    agents: { result: result("agent") },
    mcp: { result: result("server") },
  } as unknown as ReinstallPreparedHandles;
}

test("composes both skipped outcomes without mutating records", () => {
  // arrange
  const state = stateWith(oldRecord());
  const before = structuredClone(state);

  // act
  const missing = recordReinstallOutcome({
    partition: "skipped",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    reason: "not installed",
  });
  const disabled = recordReinstallOutcome({
    partition: "skipped",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    reason: "already disabled",
  });

  // assert
  assert.deepStrictEqual(missing, {
    partition: "skipped",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    notes: ["not installed"],
  });
  assert.deepStrictEqual(disabled, { ...missing, notes: ["already disabled"] });
  assert.deepStrictEqual(state, before);
});

test("records an installed replacement and returns its exact outcome", () => {
  // arrange
  const previous = oldRecord({ resources: { ...EMPTY_RESOURCES, skills: ["old-skill"] } });
  const state = stateWith(previous);

  // act
  const outcome = recordReinstallOutcome({
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    state,
    oldRecord: previous,
    installable: installable(),
    handles: handles({ populated: true }),
    hookEntries: undefined,
    isGitSource: true,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    version: "1.2.3",
    stagedAgentNames: ["agent"],
    stagedMcpServerNames: ["server"],
    declaresAgents: true,
    declaresMcp: true,
    resourcesChanged: true,
  });
  const recorded = state.marketplaces.market?.plugins.plugin;
  assert.ok(recorded);
  assert.match(recorded.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.deepStrictEqual(recorded.resources, {
    skills: ["skill"],
    prompts: ["command"],
    agents: ["agent"],
    mcpServers: ["server"],
    hooks: [],
  });
  assert.strictEqual(recorded.resolvedSha, undefined);
  assert.strictEqual(recorded.hookEntries, undefined);
  assert.strictEqual(recorded.installedAt, previous.installedAt);
});

test("LOAD-02: a reinstall of a held-down record drops the dependency marker", () => {
  // arrange
  const previous = oldRecord({ enabled: false, dependencyDisabled: true });
  const state = stateWith(previous);

  // act
  recordReinstallOutcome({
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    state,
    oldRecord: previous,
    installable: installable(),
    handles: handles({ populated: true }),
    hookEntries: undefined,
    isGitSource: true,
  });

  // assert -- a key-presence check: the rebuilt literal never names the field,
  // and a key left behind set to false would read as a record the load-time
  // check is still responsible for.
  const recorded = state.marketplaces.market?.plugins.plugin;
  assert.ok(recorded);
  assert.strictEqual(recorded.enabled, true);
  assert.strictEqual(Object.hasOwn(recorded, "dependencyDisabled"), false);
});

test("carries dependency provenance forward on reinstall", () => {
  // arrange
  const previous = oldRecord({ provenance: "dependency" });
  const state = stateWith(previous);

  // act
  recordReinstallOutcome({
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    state,
    oldRecord: previous,
    installable: installable(),
    handles: handles({ populated: true }),
    hookEntries: undefined,
    isGitSource: true,
  });

  // assert
  const recorded = state.marketplaces.market?.plugins.plugin;
  assert.ok(recorded);
  assert.match(recorded.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.deepStrictEqual(recorded, {
    version: "1.2.3",
    resolvedSource: "/new/plugin",
    compatibility: {
      installable: true,
      notes: [],
      supported: ["skills", "commands", "agents", "mcp"],
      unsupported: [],
    },
    resources: {
      skills: ["skill"],
      prompts: ["command"],
      agents: ["agent"],
      mcpServers: ["server"],
      hooks: [],
    },
    enabled: true,
    provenance: "dependency",
    installedAt: previous.installedAt,
    updatedAt: recorded.updatedAt,
  });
});

test("records partial compatibility, sha, hooks, and degradation exactly", () => {
  // arrange
  const previous = oldRecord({ resolvedSha: "abc123" });
  const state = stateWith(previous);

  // act
  const outcome = recordReinstallOutcome({
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    state,
    oldRecord: previous,
    installable: installable("partially-available"),
    handles: handles({ degraded: true }),
    hookEntries: [{ event: "SessionStart" }],
    isGitSource: true,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    version: "1.2.3",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    resourcesChanged: false,
    degradedKinds: ["skill", "command"],
  });
  const recorded = state.marketplaces.market?.plugins.plugin;
  assert.ok(recorded);
  assert.strictEqual(recorded.resolvedSha, "abc123");
  assert.deepStrictEqual(recorded.compatibility, {
    installable: false,
    notes: ["commands unavailable"],
    supported: ["skills"],
    unsupported: ["commands"],
  });
  assert.deepStrictEqual(recorded.resources.hooks, ["plugin"]);
  assert.deepStrictEqual(recorded.hookEntries, [{ event: "SessionStart" }]);
});

test("WR-01: a non-git source's reinstall drops a stale resolvedSha instead of carrying it forward", () => {
  // arrange: the old record carries a tag-pin sha from a prior `path`-source
  // install/update, but this reinstall re-resolves through the marketplace's
  // current checkout (isGitSource: false) -- there is no pin to reaffirm.
  const previous = oldRecord({ resolvedSha: "abc123" });
  const state = stateWith(previous);

  // act
  recordReinstallOutcome({
    partition: "reinstalled",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    state,
    oldRecord: previous,
    installable: installable(),
    handles: handles({ populated: true }),
    hookEntries: undefined,
    isGitSource: false,
  });

  // assert: the OLD sha must not survive onto a record whose resolvedSource
  // no longer sits at the commit it named.
  const recorded = state.marketplaces.market?.plugins.plugin;
  assert.ok(recorded);
  assert.strictEqual(recorded.resolvedSha, undefined);
  assert.strictEqual(Object.hasOwn(recorded, "resolvedSha"), false);
});

test("rejects record mutation after concurrent removal", () => {
  // arrange
  const previous = oldRecord();
  const state = stateWith(previous);
  delete state.marketplaces.market?.plugins.plugin;

  // act & assert
  assert.throws(
    () =>
      recordReinstallOutcome({
        partition: "reinstalled",
        name: "plugin",
        marketplace: "market",
        scope: "project",
        state,
        oldRecord: previous,
        installable: installable(),
        handles: handles(),
        hookEntries: undefined,
        isGitSource: true,
      }),
    /concurrently removed/u,
  );
});

test("composes ordinary, typed, errno, and manual-recovery failures", () => {
  // arrange
  const ordinary = new Error("broken");
  const permission = Object.assign(new Error("denied"), { code: "EACCES" });
  const missing = Object.assign(new Error("gone"), { code: "ENOENT" });
  const shape = new PluginShapeError({
    kind: "not-installable",
    plugin: "plugin",
    reasons: ["unsupported component"],
    partialable: false,
  });
  const manual = new ManualRecoveryError("rollback failed", ["skills: /leak"]);

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "plugin",
    marketplace: "market",
    scope: "user",
    error: manual,
  });

  // assert
  assert.deepStrictEqual(reinstallReasonsFromError(ordinary), undefined);
  assert.deepStrictEqual(reinstallReasonsFromError(permission), ["permission denied"]);
  assert.deepStrictEqual(reinstallReasonsFromError(missing), ["source missing"]);
  assert.deepStrictEqual(reinstallReasonsFromError(shape), ["source mismatch"]);
  assert.deepStrictEqual(reinstallReasonsFromError(manual), ["rollback partial"]);
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "plugin",
    marketplace: "market",
    scope: "user",
    notes: ["rollback failed\n\ncause: rollback failed"],
    failureClass: "manual-recovery",
    reasons: ["rollback partial"],
  });
  assert.deepStrictEqual(
    recordReinstallOutcome({
      partition: "failed",
      name: "plugin",
      marketplace: "market",
      scope: "user",
      error: ordinary,
    }),
    {
      partition: "failed",
      name: "plugin",
      marketplace: "market",
      scope: "user",
      notes: ["broken\n\ncause: broken"],
    },
  );
});
