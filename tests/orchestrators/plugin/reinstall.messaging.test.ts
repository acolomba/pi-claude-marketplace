import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";
import { Type } from "typebox";

import {
  narrowReasons,
  outcomeToPluginMessage,
  renderReinstallPartitionAndNotify,
  reinstalledRowFromOutcome,
  type ReinstallMsg,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";

import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Severity } from "../../../extensions/pi-claude-marketplace/shared/notify.ts";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";

void ({
  status: "reinstalled",
  name: "alpha",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies ReinstallMsg);
void ({
  status: "reinstalled",
  name: "alpha",
  severity: "info",
  needsReload: true,
  // @ts-expect-error reinstalled messages require a dependency inventory
} satisfies ReinstallMsg);
void ({
  partition: "skipped",
  name: "alpha",
  marketplace: "official",
  scope: "project",
  notes: [],
  // @ts-expect-error only failed outcomes can carry the manual-recovery class
  failureClass: "manual-recovery",
} satisfies ReinstallPluginOutcome);

interface ExpectedNotification {
  readonly message: string;
  readonly severity?: Severity;
}

interface NotifyHarness {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly ui: ExtensionContext["ui"];
}

function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    sourceInfo: {
      path: `/test/tools/${name}.ts`,
      source: "test",
      scope: "temporary",
      origin: "top-level",
    },
  } satisfies ToolInfo;
}

function createNotifyHarness(
  expected: ExpectedNotification,
  toolNames: readonly string[] = [],
): NotifyHarness {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  when(() => pi.getAllTools())
    .thenReturn(toolNames.map(toolInfo))
    .twice();
  if (expected.severity === undefined) {
    when(() => {
      ui.notify(expected.message);
    }).thenReturn(undefined);
  } else {
    when(() => {
      ui.notify(expected.message, expected.severity);
    }).thenReturn(undefined);
  }

  return { ctx, pi, ui };
}

test("reinstalledRowFromOutcome omits empty version, matching scope, reasons, and dependencies", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "",
    resourcesChanged: false,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    degradedKinds: [],
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    severity: "info",
    needsReload: true,
  });
});

test("reinstalledRowFromOutcome orders agent dependency and degraded reasons with a row scope", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    resourcesChanged: true,
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: [],
    declaresAgents: true,
    declaresMcp: false,
    degradedKinds: ["command", "skill", "command"],
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: ["agents"],
    version: "2.0.0",
    scope: "user",
    reasons: ["malformed skill", "malformed command"],
    severity: "warning",
    needsReload: true,
  });
});

test("reinstalledRowFromOutcome projects an MCP-only dependency", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    name: "mcp-only",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    resourcesChanged: true,
    stagedAgentNames: [],
    stagedMcpServerNames: ["docs"],
    declaresAgents: false,
    declaresMcp: true,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "mcp-only",
    dependencies: ["mcp"],
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  });
});

test("reinstalledRowFromOutcome preserves agents before MCP when both dependencies apply", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    name: "both",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    resourcesChanged: true,
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: ["docs"],
    declaresAgents: true,
    declaresMcp: true,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "both",
    dependencies: ["agents", "mcp"],
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  });
});

test("outcomeToPluginMessage projects a clean reinstalled outcome without row scope", () => {
  // arrange
  const outcome: ReinstallPluginOutcome = {
    partition: "reinstalled",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "1.0.0",
    resourcesChanged: true,
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  });
});

test("outcomeToPluginMessage gives a missing installed target error severity", () => {
  // arrange
  const outcome: ReinstallPluginOutcome = {
    partition: "skipped",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["not installed"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "alpha",
    reasons: ["not installed"],
    severity: "error",
    needsReload: false,
  });
});

test("outcomeToPluginMessage preserves ordered idempotent skip reasons and orphan scope", () => {
  // arrange
  const outcome: ReinstallPluginOutcome = {
    partition: "skipped",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["up-to-date", "already installed", "already disabled"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "alpha",
    reasons: ["up-to-date", "already installed", "already disabled"],
    scope: "project",
    severity: "info",
    needsReload: false,
  });
});

test("outcomeToPluginMessage gives an opaque skipped note warning severity", () => {
  // arrange
  const outcome: ReinstallPluginOutcome = {
    partition: "skipped",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["opaque"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "alpha",
    reasons: ["unreadable"],
    severity: "warning",
    needsReload: false,
  });
});

test("outcomeToPluginMessage gives an empty skipped reason set warning severity", () => {
  // arrange
  const outcome: ReinstallPluginOutcome = {
    partition: "skipped",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: [],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "skipped",
    name: "alpha",
    reasons: [],
    severity: "warning",
    needsReload: false,
  });
});

test("outcomeToPluginMessage gives manual recovery precedence over typed reasons", () => {
  // arrange
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    notes: ["EACCES: permission denied"],
    failureClass: "manual-recovery",
    reasons: ["permission denied"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "manual recovery",
    name: "alpha",
    reasons: ["rollback partial"],
    scope: "user",
    severity: "warning",
    needsReload: false,
  });
});

test("outcomeToPluginMessage preserves typed failed reasons over note fallback", () => {
  // arrange
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["opaque"],
    reasons: ["permission denied", "source missing"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "user");

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "alpha",
    reasons: ["permission denied", "source missing"],
    scope: "project",
    severity: "error",
    needsReload: false,
  });
});

test("outcomeToPluginMessage replaces an empty typed failed reason set with unreadable", () => {
  // arrange
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["rollback failed"],
    reasons: [],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "alpha",
    reasons: ["unreadable"],
    severity: "error",
    needsReload: false,
  });
});

test("outcomeToPluginMessage narrows a rollback note for an ordinary failure", () => {
  // arrange
  const outcome: ReinstallFailedOutcome = {
    partition: "failed",
    name: "alpha",
    marketplace: "official",
    scope: "project",
    notes: ["rollback failed at commands"],
  };

  // act
  const row = outcomeToPluginMessage(outcome, "project");

  // assert
  assert.deepStrictEqual(row, {
    status: "failed",
    name: "alpha",
    reasons: ["rollback partial"],
    severity: "error",
    needsReload: false,
  });
});

test("narrowReasons returns independent empty results for absent and empty notes", () => {
  // arrange
  const noNotes = undefined;
  const emptyNotes: readonly string[] = [];

  // act
  const absent = narrowReasons(noNotes);
  const empty = narrowReasons(emptyNotes);

  // assert
  assert.deepStrictEqual(absent, []);
  assert.deepStrictEqual(empty, []);
  assert.notStrictEqual(absent, empty);
});

test("narrowReasons preserves every exact known note in input order", () => {
  // arrange
  const notes = [
    "not installed",
    "not in manifest",
    "up-to-date",
    "already installed",
    "already disabled",
  ] as const;

  // act
  const reasons = narrowReasons(notes);

  // assert
  assert.deepStrictEqual(reasons, [
    "not installed",
    "not in manifest",
    "up-to-date",
    "already installed",
    "already disabled",
  ]);
  assert.equal(Object.isFrozen(reasons), true);
});

test("narrowReasons applies cached-manifest, generic not-found, rollback, and unknown fallbacks", () => {
  // arrange
  const notes = [
    "alpha not found in cached manifest",
    "beta not found on disk",
    "rollback failed",
    "opaque",
  ] as const;

  // act
  const reasons = narrowReasons(notes);

  // assert
  assert.deepStrictEqual(reasons, [
    "not in manifest",
    "not found",
    "rollback partial",
    "unreadable",
  ]);
  assert.equal(Object.isFrozen(reasons), true);
});

test("narrowReasons preserves duplicates and returns frozen independent arrays", () => {
  // arrange
  const notes = ["not installed", "opaque", "not installed"] as const;

  // act
  const first = narrowReasons(notes);
  const second = narrowReasons(notes);

  // assert
  assert.deepStrictEqual(first, ["not installed", "unreadable", "not installed"]);
  assert.deepStrictEqual(second, ["not installed", "unreadable", "not installed"]);
  assert.notStrictEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(second), true);
});

test("renderReinstallPartitionAndNotify emits the empty single-cardinality cascade", () => {
  // arrange
  const harness = createNotifyHarness({ message: "(no marketplaces)" });
  const outcomes: readonly ReinstallPluginOutcome[] = [];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.pi, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify sorts case-insensitive names and scopes while preserving block row order", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● acme [project]",
      "  ● p-first v2.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp}",
      "  ⊘ p-second (skipped) {already installed}",
      "",
      "● Acme [user]",
      "  ⊘ u-first (skipped) {up-to-date}",
      "  ⊘ u-second (manual recovery) {rollback partial}",
      "",
      "● Beta [user]",
      "  ⊘ beta-failed (failed) {source missing}",
      "",
      "Plugin reinstall: 1 failure, 1 warning, 3 successes",
      "",
      "/reload to pick up changes",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "u-first",
      marketplace: "Acme",
      scope: "user",
      notes: ["up-to-date"],
    },
    {
      partition: "failed",
      name: "beta-failed",
      marketplace: "Beta",
      scope: "user",
      notes: ["missing"],
      reasons: ["source missing"],
    },
    {
      partition: "reinstalled",
      name: "p-first",
      marketplace: "acme",
      scope: "project",
      version: "2.0.0",
      resourcesChanged: true,
      stagedAgentNames: ["reviewer"],
      stagedMcpServerNames: ["docs"],
      declaresAgents: true,
      declaresMcp: true,
    },
    {
      partition: "failed",
      name: "u-second",
      marketplace: "Acme",
      scope: "user",
      notes: ["rollback failed"],
      failureClass: "manual-recovery",
    },
    {
      partition: "skipped",
      name: "p-second",
      marketplace: "acme",
      scope: "project",
      notes: ["already installed"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.pi, outcomes, "plural");

  // assert
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify omits tally and reload for a single missing target", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha (skipped) {not installed}",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["not installed"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.pi, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.pi);
  verify(harness.ui);
});
