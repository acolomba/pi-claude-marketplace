import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  recordReinstallOutcome,
  reinstallOutcomeFromRun,
  reinstallReasonsFromError,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts";
import {
  CleanupContextError,
  DependencyDeclarationsUnreadableError,
  InvalidMarketplaceManifestError,
  LayerConfigUnreadableError,
  ManualRecoveryError,
  PluginInBaseLayerOnlyError,
  PluginInLocalLayerOnlyError,
  PluginShapeError,
  PluginUpdateConcurrencyError,
  StateLockHeldError,
} from "../../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { UpdateRunOutcome } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts";
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
  workflows: [],
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

test("UPR-04: composes the not-installed failure and the already-disabled skip without mutating records", () => {
  // arrange
  const state = stateWith(oldRecord());
  const before = structuredClone(state);

  // act
  const missing = recordReinstallOutcome({
    partition: "failed",
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
    partition: "failed",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    notes: ["not installed"],
    reasons: ["not installed"],
  });
  assert.deepStrictEqual(disabled, {
    partition: "skipped",
    name: "plugin",
    marketplace: "market",
    scope: "project",
    notes: ["already disabled"],
  });
  assert.deepStrictEqual(state, before);
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
  const lockHeld = new StateLockHeldError("user", "/tmp/scope/.state-lock");

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
  assert.deepStrictEqual(reinstallReasonsFromError(lockHeld), ["lock held"]);
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

const LOCAL_CAUSE =
  "The plugin hello@mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.";
const BASE_CAUSE =
  "The plugin hello@mp is declared only in the base config (claude-plugins.json). Run the command again without --local.";
const INVALID_CAUSE = 'Config file "claude-plugins.local.json" failed schema validation.';

for (const { refusal, reason, note } of [
  {
    refusal: new PluginInLocalLayerOnlyError("hello", "mp"),
    reason: "plugin in local layer only",
    note: `${LOCAL_CAUSE}\n\ncause: ${LOCAL_CAUSE}`,
  },
  {
    refusal: new PluginInBaseLayerOnlyError("hello", "mp"),
    reason: "plugin in base layer only",
    note: `${BASE_CAUSE}\n\ncause: ${BASE_CAUSE}`,
  },
  {
    refusal: new LayerConfigUnreadableError("claude-plugins.local.json"),
    reason: "invalid manifest",
    note: `${INVALID_CAUSE}\n\ncause: ${INVALID_CAUSE}`,
  },
] as const) {
  test(`LAYER-04: the ${reason} refusal carries its reason and its cause`, () => {
    // act
    const outcome = recordReinstallOutcome({
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      error: refusal,
    });

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: [note],
      reasons: [reason],
      cause: refusal,
    });
    assert.strictEqual(outcome.cause, refusal);
  });
}

test("FLR-01: a held state lock carries lock held and its cause", () => {
  // arrange
  const error = new StateLockHeldError("project", "/tmp/scope/.state-lock", {
    cause: Object.assign(new Error("Lock file is already being held"), { code: "ELOCKED" }),
  });
  const lockMessage =
    "Another pi-claude-marketplace operation is in progress for project scope (/tmp/scope/.state-lock). Retry after it completes.";

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    error,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: [`${lockMessage}\n\ncause: ${lockMessage} -> Lock file is already being held`],
    reasons: ["lock held"],
    cause: error,
  });
  assert.strictEqual(outcome.cause, error);
});

test("UPR-03: a thrown failure carries the move the runner reported before it", () => {
  // arrange
  const error = new StateLockHeldError("project", "/tmp/scope/.state-lock");
  const lockMessage =
    "Another pi-claude-marketplace operation is in progress for project scope (/tmp/scope/.state-lock). Retry after it completes.";

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    error,
    move: {
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
    },
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    fromVersion: "1.0.0",
    toVersion: "1.0.0",
    fromCommit: "1111111111111111111111111111111111111111",
    toCommit: "2222222222222222222222222222222222222222",
    notes: [`${lockMessage}\n\ncause: ${lockMessage}`],
    reasons: ["lock held"],
    cause: error,
  });
});

test("a manifest parse failure carries no cause and no layer reason", () => {
  // arrange
  const error = new InvalidMarketplaceManifestError(
    'marketplace.json is not valid JSON: SyntaxError: "{ broken" is not valid JSON',
  );

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    error,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: [
      'marketplace.json is not valid JSON: SyntaxError: "{ broken" is not valid JSON\n\ncause: marketplace.json is not valid JSON: SyntaxError: "{ broken" is not valid JSON',
    ],
  });
});

test("LAYER-04: an unreadable dependency declaration narrows to unreadable", () => {
  // arrange
  const error = new DependencyDeclarationsUnreadableError(
    "app@tools",
    "cannot read the dependencies of app@tools: not declared by its marketplace, and its installed copy cannot be read",
  );

  // act
  const reasons = reinstallReasonsFromError(error);

  // assert
  assert.deepStrictEqual(reasons, ["unreadable"]);
});

test("FLR-01: a held state lock wrapped with cleanup failures carries lock held and the lock as its cause", () => {
  // arrange
  const lock = new StateLockHeldError("project", "/tmp/scope/.state-lock");
  const error = new CleanupContextError(lock, [
    {
      phase: "abort",
      artifact: "skills",
      path: "/tmp/scope/skills-staging/run",
      cause: new Error("busy"),
    },
  ]);
  const lockMessage =
    "Another pi-claude-marketplace operation is in progress for project scope (/tmp/scope/.state-lock). Retry after it completes.";

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    error,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: [
      `${lockMessage}\n\ncause: ${lockMessage} (cleanup: abort skills run: busy) -> ${lockMessage}`,
    ],
    reasons: ["lock held"],
    cause: lock,
  });
  assert.strictEqual(outcome.cause, lock);
});

for (const { kind, reason } of [
  { kind: "plugin-updated", reason: "concurrently updated" },
  { kind: "plugin-uninstalled", reason: "concurrently uninstalled" },
] as const) {
  test(`a ${kind} concurrency failure narrows to ${reason}`, () => {
    // arrange
    const error = new PluginUpdateConcurrencyError(kind, "hello", "mp", {
      expectedVersion: "1.0.0",
      actualVersion: "1.1.0",
    });

    // act
    const reasons = reinstallReasonsFromError(error);

    // assert
    assert.deepStrictEqual(reasons, [reason]);
  });
}

test("D-18-17: an unreadable dependency walk carries unreadable and names the record on its cause", () => {
  // arrange
  const walkMessage =
    "cannot read the dependencies of gone@mp: not declared by its marketplace, and its installed copy cannot be read";
  const error = new DependencyDeclarationsUnreadableError("gone@mp", walkMessage);

  // act
  const outcome = recordReinstallOutcome({
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    error,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    partition: "failed",
    name: "hello",
    marketplace: "mp",
    scope: "project",
    notes: [`${walkMessage}\n\ncause: ${walkMessage}`],
    reasons: ["unreadable"],
    cause: error,
  });
  assert.strictEqual(outcome.cause, error);
});

test("a thrown value that is not an Error narrows to no reason", () => {
  // act
  const reasons = reinstallReasonsFromError("EACCES");

  // assert
  assert.strictEqual(reasons, undefined);
});

const RUN_TARGET = { name: "hello", marketplace: "mp", scope: "project" } as const;

describe("reinstallOutcomeFromRun", () => {
  test("REI-04 / D-18-08: a swapped candidate is reinstalled at the version the runner derived", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "updated",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      stagedAgentNames: ["hello-bot"],
      stagedMcpServerNames: ["hello-server"],
      declaresAgents: true,
      declaresMcp: true,
      declaresWorkflows: false,
      constraint: undefined,
      notes: ["skill tool could not be read"],
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "reinstalled",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      version: "1.1.0",
      fromVersion: "1.0.0",
      stagedAgentNames: ["hello-bot"],
      stagedMcpServerNames: ["hello-server"],
      declaresAgents: true,
      declaresMcp: true,
      declaresWorkflows: false,
    });
  });

  test("WARN-01 / WLIF-06: a swapped candidate carries its degraded kinds and the stale-command flag", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "updated",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: true,
      constraint: undefined,
      degradedKinds: ["skill", "command"],
      staleWorkflowCommand: true,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "reinstalled",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      version: "1.0.0",
      fromVersion: "1.0.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: true,
      degradedKinds: ["skill", "command"],
      staleWorkflowCommand: true,
    });
  });

  test("D-18-06 / D-18-07: a swapped candidate carries its left-out kinds and the constraint disclosure", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "updated",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      constraint: {
        disclosure: 'constrained to the combined range (^1.0.0) -- required by "app@mp"',
        fellBackToCurrentCopy: true,
      },
      partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "reinstalled",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      version: "1.1.0",
      fromVersion: "1.0.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
      constraint: {
        disclosure: 'constrained to the combined range (^1.0.0) -- required by "app@mp"',
        fellBackToCurrentCopy: true,
      },
    });
  });

  test("UPR-02: a swapped candidate carries the commits the run moved between", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "updated",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      constraint: undefined,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "reinstalled",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      version: "1.0.0",
      fromVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    });
  });

  test("ENBL-05: an unchanged run is an already-disabled skip", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "unchanged",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      constraint: undefined,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "skipped",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["already disabled"],
    });
  });

  test("D-18-07: a skipped run keeps its notes and typed reasons", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "skipped",
      name: "hello",
      fromVersion: "1.0.0",
      notes: ["no version satisfies ^1.0.0 (app@mp)"],
      reasons: ["dependents constrain"],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "skipped",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["no version satisfies ^1.0.0 (app@mp)"],
      reasons: ["dependents constrain"],
    });
  });

  test("a preflight failure keeps its notes and reasons and carries no cause", () => {
    // arrange
    const run: UpdateRunOutcome = {
      partition: "failed",
      name: "hello",
      notes: ["not found"],
      reasons: ["not in manifest"],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["not found"],
      reasons: ["not in manifest"],
    });
  });

  test("SRC-01: a preflight failure carries its cause and the installed version", () => {
    // arrange
    const cause = new Error("HTTP Error: 404 Not Found");
    const run: UpdateRunOutcome = {
      partition: "failed",
      name: "hello",
      fromVersion: "1.0.0",
      notes: ["HTTP Error: 404 Not Found"],
      reasons: ["source missing"],
      cause,
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, undefined);

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      fromVersion: "1.0.0",
      notes: ["HTTP Error: 404 Not Found"],
      reasons: ["source missing"],
      cause,
    });
  });

  test("D-18-10: a commit failure carries the captured aggregate error and one child per failed bridge", () => {
    // arrange
    const skillsCause = new Error("skills refused");
    const workflowsCause = new Error("workflows refused");
    const aggregate = new Error("replace failed");
    const run: UpdateRunOutcome = {
      partition: "failed",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      notes: ["replace failed", "skills: skills refused", "workflows: workflows refused"],
      reasons: ["rollback partial"],
      phaseFailures: [
        { phase: "skills", msg: "skills refused" },
        { phase: "workflows", msg: "workflows refused" },
      ],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, {
      error: aggregate,
      failures: [
        { phase: "skills", msg: "skills refused", cause: skillsCause },
        { phase: "workflows", msg: "workflows refused", cause: workflowsCause },
      ],
    });

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      notes: ["replace failed", "skills: skills refused", "workflows: workflows refused"],
      reasons: ["rollback partial"],
      cause: aggregate,
      rollbackPartial: [
        { phase: "skills", cause: skillsCause },
        { phase: "workflows", cause: workflowsCause },
      ],
    });
    assert.ok(outcome.partition === "failed");
    assert.strictEqual(outcome.cause, aggregate);
  });

  test("UPR-02: a commit failure carries the commits of the move it attempted", () => {
    // arrange
    const skillsCause = new Error("skills refused");
    const aggregate = new Error("replace failed");
    const run: UpdateRunOutcome = {
      partition: "failed",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
      notes: ["replace failed", "skills: skills refused"],
      reasons: ["rollback partial"],
      phaseFailures: [{ phase: "skills", msg: "skills refused" }],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, {
      error: aggregate,
      failures: [{ phase: "skills", msg: "skills refused", cause: skillsCause }],
    });

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
      notes: ["replace failed", "skills: skills refused"],
      reasons: ["rollback partial"],
      cause: aggregate,
      rollbackPartial: [{ phase: "skills", cause: skillsCause }],
    });
  });

  test("AFILE-04: a failure after the MCP commit carries the notices of the rewritten file", () => {
    // arrange
    const finalizeCause = new Error("state finalize failed: refused");
    const aggregate = new Error("replace failed");
    const run: UpdateRunOutcome = {
      partition: "failed",
      name: "hello",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      notes: ["replace failed", "mcp: state finalize failed: refused"],
      reasons: ["rollback partial"],
      phaseFailures: [{ phase: "mcp", msg: "state finalize failed: refused" }],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
      mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
    };

    // act
    const outcome = reinstallOutcomeFromRun(RUN_TARGET, run, {
      error: aggregate,
      failures: [{ phase: "mcp", msg: "state finalize failed: refused", cause: finalizeCause }],
    });

    // assert
    assert.deepStrictEqual(outcome, {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      notes: ["replace failed", "mcp: state finalize failed: refused"],
      reasons: ["rollback partial"],
      cause: aggregate,
      rollbackPartial: [{ phase: "mcp", cause: finalizeCause }],
      mcpConfigNotices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
    });
  });
});
