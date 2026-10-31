import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  REINSTALL_CONTEXT,
  narrowReasons,
  renderReinstallPartitionAndNotify,
  reinstalledRowFromOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { MarketplaceInLocalLayerOnlyError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { type Severity } from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../../extensions/pi-claude-marketplace/shared/notification-run.ts";

// reinstall's row union is module-private; the public carrier of its
// `reinstalled` arm is the row composer's own return type.
void ({
  status: "reinstalled",
  name: "alpha",
  dependencies: [],
  severity: "info",
  needsReload: true,
} satisfies ReturnType<typeof reinstalledRowFromOutcome>);
void ({
  status: "reinstalled",
  name: "alpha",
  severity: "info",
  needsReload: true,
  // @ts-expect-error reinstalled messages require a dependency inventory
} satisfies ReturnType<typeof reinstalledRowFromOutcome>);
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
  readonly run: NotificationRun;
  readonly ui: ExtensionContext["ui"];
}

function createNotifyHarness(expected: ExpectedNotification): NotifyHarness {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
  when(() => ctx.mode)
    .thenReturn("tui")
    .once();
  when(() => ctx.ui)
    .thenReturn(ui)
    .once();
  if (expected.severity === undefined) {
    when(() => {
      ui.notify(expected.message);
    }).thenReturn(undefined);
  } else {
    when(() => {
      ui.notify(expected.message, expected.severity);
    }).thenReturn(undefined);
  }

  return { ctx, run: runWithNothingLoaded(), ui };
}

test("reinstalledRowFromOutcome omits empty version, matching scope, reasons, and dependencies", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "",
    fromVersion: "",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
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
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: [],
    declaresAgents: true,
    declaresMcp: false,
    declaresWorkflows: false,
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
    resourcesChanged: true,
    name: "mcp-only",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: ["docs"],
    declaresAgents: false,
    declaresMcp: true,
    declaresWorkflows: false,
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
    resourcesChanged: true,
    name: "both",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: ["docs"],
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: false,
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

test("WDEP-02: reinstalledRowFromOutcome places the workflows dependency LAST", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "all-three",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: ["reviewer"],
    stagedMcpServerNames: ["docs"],
    declaresAgents: true,
    declaresMcp: true,
    declaresWorkflows: true,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert -- SEV-01: the reinstall row stamps the marker and stays `info`; the
  // no-raise asymmetry against install / update / enable is deliberate.
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "all-three",
    dependencies: ["agents", "mcp", "workflows"],
    version: "1.0.0",
    severity: "info",
    needsReload: true,
  });
});

test("WDEP-02: a reinstall declaring no workflow carries no host-engine dependency", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "none",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row.dependencies, []);
});

test("UPR-03: a reinstall that moved its version composes the arrow from the replaced version", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "1.1.0",
    fromVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "1.1.0",
    from: "1.0.0",
    severity: "info",
    needsReload: true,
  });
});

test("REI-01: a reinstall at the recorded revision composes the single version", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "1.0.0",
    fromVersion: "1.0.0",
    fromCommit: "1111111111111111111111111111111111111111",
    toCommit: "1111111111111111111111111111111111111111",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

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

test("UPR-02: a reinstall onto a new commit at the same version names both commits", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
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
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "1.0.0",
    from: "1.0.0",
    commits: {
      from: "1111111111111111111111111111111111111111",
      to: "2222222222222222222222222222222222222222",
    },
    severity: "info",
    needsReload: true,
  });
});

test("UPR-03: renderReinstallPartitionAndNotify draws the arrow for a reinstall that moved its version", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "● official [project]",
      "  ● alpha v1.0.0 → v1.1.0 (reinstalled)",
      "",
      "/reload to pick up changes",
    ].join("\n"),
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "reinstalled",
      resourcesChanged: true,
      name: "alpha",
      marketplace: "official",
      scope: "project",
      version: "1.1.0",
      fromVersion: "1.0.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

/**
 * Outcome-to-row projection is command-private: the public operation that
 * carries it is `renderReinstallPartitionAndNotify`, so each projection case
 * below states the exact notification bytes and severity that projection
 * produces. The row scope is not a case axis here -- the operation groups
 * outcomes by `(scope, marketplace)`, so a row's scope always matches its
 * marketplace block and the bracket is always suppressed.
 */
test("renderReinstallPartitionAndNotify projects a clean reinstalled row with a reload trailer", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "● official [project]",
      "  ● alpha v1.0.0 (reinstalled)",
      "",
      "/reload to pick up changes",
    ].join("\n"),
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "reinstalled",
      resourcesChanged: true,
      name: "alpha",
      marketplace: "official",
      scope: "project",
      version: "1.0.0",
      fromVersion: "1.0.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      declaresWorkflows: false,
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify preserves ordered idempotent skip reasons", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "● official [project]",
      "  ⊘ alpha (skipped) {up-to-date, already installed, already disabled}",
    ].join("\n"),
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["up-to-date", "already installed", "already disabled"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify gives an opaque skipped note warning severity", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation needs attention.",
      "",
      "● official [project]",
      "  ⊘ alpha (skipped) {unreadable}",
    ].join("\n"),
    severity: "warning",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["opaque"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify gives an empty skipped reason set warning severity", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation needs attention.",
      "",
      "● official [project]",
      "  ⊘ alpha (skipped)",
    ].join("\n"),
    severity: "warning",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: [],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify gives manual recovery precedence over typed reasons", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation needs attention.",
      "",
      "● official [user]",
      "  ⊘ alpha (manual recovery) {rollback partial}",
    ].join("\n"),
    severity: "warning",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "user",
      notes: ["EACCES: permission denied"],
      failureClass: "manual-recovery",
      reasons: ["permission denied"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify preserves typed failed reasons over the note fallback", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha (failed) {permission denied, source missing}",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["opaque"],
      reasons: ["permission denied", "source missing"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify replaces an empty typed failed reason set with unreadable", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha (failed) {unreadable}",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["rollback failed"],
      reasons: [],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("SRC-01: an empty typed failed reason set with a cause renders no reason token and the cause line", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha v1.0.0 (failed)",
      "    cause: mirror gone",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      fromVersion: "1.0.0",
      notes: ["mirror gone"],
      reasons: [],
      cause: new Error("mirror gone"),
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify narrows a rollback note for an ordinary failure", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha (failed) {rollback partial}",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["rollback failed at commands"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("FIX-03: a failed reinstall that carries a cause renders its cause line", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● mp [project]",
      "  ⊘ hello (failed) {marketplace in local layer only}",
      "    cause: The marketplace mp is declared only in the local config (claude-plugins.local.json). Run the command again with --local.",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["refused"],
      reasons: ["marketplace in local layer only"],
      cause: new MarketplaceInLocalLayerOnlyError("mp"),
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

for (const { move, subject } of [
  { move: { fromVersion: "1.0.0", toVersion: "1.1.0" }, subject: "hello v1.0.0 → v1.1.0" },
  {
    move: {
      fromVersion: "1.0.0",
      toVersion: "1.0.0",
      fromCommit: "1111111111111111111111111111111111111111",
      toCommit: "2222222222222222222222222222222222222222",
    },
    subject: "hello v1.0.0 (1111111) → v1.0.0 (2222222)",
  },
  { move: { fromVersion: "1.0.0", toVersion: "1.0.0" }, subject: "hello v1.0.0" },
  { move: { fromVersion: "1.0.0" }, subject: "hello v1.0.0" },
] as const) {
  test(`UPR-03: a failed reinstall that knew its move renders ${subject}`, () => {
    // arrange
    const harness = createNotifyHarness({
      message: [
        "A plugin operation has failed.",
        "",
        "● mp [project]",
        `  ⊘ ${subject} (failed) {lock held}`,
      ].join("\n"),
      severity: "error",
    });
    const outcomes: readonly ReinstallFailedOutcome[] = [
      {
        partition: "failed",
        name: "hello",
        marketplace: "mp",
        scope: "project",
        ...move,
        notes: ["refused"],
        reasons: ["lock held"],
      },
    ];

    // act
    renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

    // assert
    verify(harness.ctx);
    verify(harness.ui);
  });
}

test("D-18-07: a dependents constrain skip renders its typed reason and names the holders on its cause line", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation needs attention.",
      "",
      "● mp [project]",
      "  ⊘ hello (skipped) {dependents constrain}",
      "    cause: no version satisfies ^1.0.0 (app@mp)",
    ].join("\n"),
    severity: "warning",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["no version satisfies ^1.0.0 (app@mp)"],
      reasons: ["dependents constrain"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("D-18-07: a typed skip with no notes renders no cause line", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation needs attention.",
      "",
      "● mp [project]",
      "  ⊘ hello (skipped) {dependents constrain}",
    ].join("\n"),
    severity: "warning",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "skipped",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: [],
      reasons: ["dependents constrain"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("D-18-10: a commit failure renders the aggregate cause and one child per failed bridge", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● mp [project]",
      "  ⊘ hello (failed) {rollback partial}",
      "    cause: replace failed",
      "    [skills] (rollback failed)",
      "      cause: skills refused",
      "    [workflows] (rollback failed)",
      "      cause: workflows refused",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallFailedOutcome[] = [
    {
      partition: "failed",
      name: "hello",
      marketplace: "mp",
      scope: "project",
      notes: ["replace failed"],
      reasons: ["rollback partial"],
      cause: new Error("replace failed"),
      rollbackPartial: [
        { phase: "skills", cause: new Error("skills refused") },
        { phase: "workflows", cause: new Error("workflows refused") },
      ],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
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
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("renderReinstallPartitionAndNotify sorts case-insensitive names and scopes while preserving block row order", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● acme [project]",
      "  ● p-first v2.0.0 (reinstalled) {requires pi-subagents, requires pi-mcp-adapter}",
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
      resourcesChanged: true,
      name: "p-first",
      marketplace: "acme",
      scope: "project",
      version: "2.0.0",
      fromVersion: "2.0.0",
      stagedAgentNames: ["reviewer"],
      stagedMcpServerNames: ["docs"],
      declaresAgents: true,
      declaresMcp: true,
      declaresWorkflows: false,
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
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "plural");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("UPR-04: renderReinstallPartitionAndNotify renders a single missing target as failed with no tally or reload", () => {
  // arrange
  const harness = createNotifyHarness({
    message: [
      "A plugin operation has failed.",
      "",
      "● official [project]",
      "  ⊘ alpha (failed) {not installed}",
    ].join("\n"),
    severity: "error",
  });
  const outcomes: readonly ReinstallPluginOutcome[] = [
    {
      partition: "failed",
      name: "alpha",
      marketplace: "official",
      scope: "project",
      notes: ["not installed"],
      reasons: ["not installed"],
    },
  ];

  // act
  renderReinstallPartitionAndNotify(harness.ctx, harness.run, outcomes, "single");

  // assert
  verify(harness.ctx);
  verify(harness.ui);
});

test("WLIF-06: a retired workflow command takes the tail token and raises the row", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    degradedKinds: ["skill"],
    staleWorkflowCommand: true,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert -- the malformed kinds first, the stale-command token at the tail,
  // the same order the enable and update rows use.
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    reasons: ["malformed skill", "stale workflow command"],
    severity: "warning",
    needsReload: true,
  });
});

test("WLIF-06: the token raises a row that has no other reason of its own", () => {
  // arrange -- nothing degraded, so the raise can only come from this axis.
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    staleWorkflowCommand: true,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    reasons: ["stale workflow command"],
    severity: "warning",
    needsReload: true,
  });
});

test("WLIF-06: a reinstall that retired nothing renders the row it always rendered", () => {
  // arrange -- the same outcome with the axis absent. The key must be ABSENT
  // rather than present-and-empty, which is what preserves the legacy bytes.
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    severity: "info",
    needsReload: true,
  });
  assert.equal(Object.hasOwn(row, "reasons"), false, "no present-and-empty reasons key");
});

test("D-18-06: a reinstall names its malformed kinds before the kinds it left out", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    degradedKinds: ["skill"],
    partialDegrade: { kinds: ["hooks"], newlyDegraded: false },
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    reasons: ["malformed skill", "unsupported hooks"],
    severity: "warning",
    needsReload: true,
  });
});

test("D-18-06: an already partial record's reinstall names the left-out kind at info", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: false },
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    reasons: ["lsp"],
    severity: "info",
    needsReload: true,
  });
});

test("D-18-06: a reinstall that newly left a kind out raises a row that has no other reason", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "2.0.0",
    fromVersion: "2.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: true },
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "2.0.0",
    reasons: ["lsp"],
    severity: "warning",
    needsReload: true,
  });
});

test("D-10-15 / D-18-07: a reinstall that landed the marketplace's current copy names it first at info, with its range on the cause line", () => {
  // arrange
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "alpha",
    marketplace: "official",
    scope: "project",
    version: "1.1.0",
    fromVersion: "1.1.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    constraint: {
      disclosure: 'constrained to the combined range (^1.0.0) -- required by "app@official"',
      fellBackToCurrentCopy: true,
    },
    partialDegrade: { kinds: ["lspServers"], newlyDegraded: false },
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "alpha",
    dependencies: [],
    version: "1.1.0",
    reasons: ["dependency current copy", "lsp"],
    cause: new Error('constrained to the combined range (^1.0.0) -- required by "app@official"'),
    severity: "info",
    needsReload: true,
  });
});

test("D-10-13: a reinstall a dependent's range admitted names the range on its cause line", () => {
  // arrange
  const disclosure = 'constrained to the combined range (^1.0.0) -- required by "app@tools"';
  const outcome: ReinstallReinstalledOutcome = {
    partition: "reinstalled",
    resourcesChanged: true,
    name: "lib",
    marketplace: "tools",
    scope: "project",
    version: "1.0.0",
    fromVersion: "1.0.0",
    stagedAgentNames: [],
    stagedMcpServerNames: [],
    declaresAgents: false,
    declaresMcp: false,
    declaresWorkflows: false,
    constraint: { disclosure, fellBackToCurrentCopy: false },
  };

  // act
  const row = reinstalledRowFromOutcome(outcome, undefined);

  // assert
  assert.deepStrictEqual(row, {
    status: "reinstalled",
    name: "lib",
    dependencies: [],
    version: "1.0.0",
    cause: new Error(disclosure),
    severity: "info",
    needsReload: true,
  });
});

test("REINSTALL_CONTEXT declares complete row policies", () => {
  // act
  const policies = REINSTALL_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    reinstalled: { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    "manual recovery": { markers: false, contentReasons: true },
  });
});
