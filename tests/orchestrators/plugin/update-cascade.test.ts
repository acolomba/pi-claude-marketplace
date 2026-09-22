import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import test from "node:test";

import {
  composeUpdateCascade,
  type UpdateCascadeOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts";
import { preparePluginUpdate } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";

import { seedUnconstrainedTarget } from "./seed-unconstrained-target.ts";

function updated(
  marketplace: string,
  scope: "project" | "user",
  name: string,
): UpdateCascadeOutcome {
  return {
    target: { marketplace, scope },
    outcome: {
      partition: "updated",
      name,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      stagedAgentNames: [],
      stagedMcpServerNames: [],
      declaresAgents: false,
      declaresMcp: false,
      constraint: undefined,
    },
  };
}

/**
 * D-10-12: one held-update outcome, shared by the manual cascade's own
 * severity case and the identical literal `update.messaging.test.ts` drives
 * through the autoupdate mapper -- both cascades must agree on `warning` for
 * the SAME outcome.
 */
function heldOutcome(
  marketplace: string,
  scope: "project" | "user",
  name: string,
): UpdateCascadeOutcome {
  return {
    target: { marketplace, scope },
    outcome: {
      partition: "skipped",
      name,
      fromVersion: "1.0.0",
      notes: ['the declared ranges admit no version in common -- required by "alpha@mp"'],
      reasons: ["dependents constrain"],
      declaresAgents: false,
      declaresMcp: false,
    },
  };
}

test("renders an empty bulk cascade as the exact no-op headline", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, [], "plural");

  // assert
  assert.deepStrictEqual(boundary.notifications, [{ message: "Plugin update: nothing to update" }]);
  boundary.verifyBoundary();
});

test("sorts changed marketplaces and renders the exact bulk tally and reload hint", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes = [updated("zeta", "user", "world"), updated("alpha", "project", "hello")];
  const expectedMessage = [
    "● alpha [project]",
    "  ● hello v1.0.0 → v1.1.0 (updated)",
    "",
    "● zeta [user]",
    "  ● world v1.0.0 → v1.1.0 (updated)",
    "",
    "Plugin update: 2 updated",
    "",
    "/reload to pick up changes",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural");

  // assert
  assert.deepStrictEqual(boundary.notifications, [{ message: expectedMessage }]);
  boundary.verifyBoundary();
});

test("keeps an unchanged targeted result exact without a tally or reload hint", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "unchanged",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
      },
    },
  ];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project]\n  ⊘ hello (skipped) {up-to-date}" },
  ]);
  boundary.verifyBoundary();
});

test("D-10-13: the ceiling version discloses its range and holders", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "unchanged",
        name: "shared-lib",
        fromVersion: "1.5.0",
        toVersion: "1.5.0",
        declaresAgents: false,
        declaresMcp: false,
        constraint: {
          disclosure:
            'already the highest version the combined range admits (<=1.5.0) -- required by "alpha@mp"',
          fellBackToCurrentCopy: false,
        },
      },
    },
  ];
  const expectedMessage = [
    "● mp [project]",
    "  ⊘ shared-lib (skipped) {up-to-date}",
    '    cause: already the highest version the combined range admits (<=1.5.0) -- required by "alpha@mp"',
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [{ message: expectedMessage }]);
  boundary.verifyBoundary();
});

test("an unconstrained unchanged outcome renders no cause line", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "unchanged",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
      },
    },
  ];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: "● mp [project]\n  ⊘ hello (skipped) {up-to-date}" },
  ]);
  boundary.verifyBoundary();
});

test("UPDT-02: projects a held constraint outcome as a warning row with its notes as the cause", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        fromVersion: "1.0.0",
        notes: [
          'the declared ranges admit no version in common (no version satisfies all 2 declared ranges) -- required by "alpha@mp", "beta@mp"',
        ],
        reasons: ["dependents constrain"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
  ];
  const expectedMessage = [
    "A plugin operation needs attention.",
    "",
    "● mp [project]",
    "  ⊘ hello v1.0.0 (skipped) {dependents constrain}",
    '    cause: the declared ranges admit no version in common (no version satisfies all 2 declared ranges) -- required by "alpha@mp", "beta@mp"',
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: expectedMessage, severity: "warning" },
  ]);
  boundary.verifyBoundary();
});

test("D-10-12: the held row is warning on the manual cascade", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes = [heldOutcome("mp", "project", "shared-lib")];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  const notification = boundary.notifications[0];
  assert.ok(notification !== undefined);
  assert.strictEqual(notification.severity, "warning");
  boundary.verifyBoundary();
});

test("keeps an ordinary skipped outcome cause-free", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        fromVersion: "1.0.0",
        notes: ["hello is not in the refreshed manifest"],
        reasons: ["not in manifest"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
  ];
  const expectedMessage = [
    "A plugin operation needs attention.",
    "",
    "● mp [project]",
    "  ⊘ hello v1.0.0 (skipped) {not in manifest}",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    { message: expectedMessage, severity: "warning" },
  ]);
  boundary.verifyBoundary();
});

test("renders a partial bulk decline before the exact no-op headline", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        fromVersion: "1.0.0",
        notes: [],
        reasons: ["unsupported component"],
        partialUpgradable: true,
        declaresAgents: false,
        declaresMcp: false,
      },
    },
  ];
  const expectedMessage = [
    "● mp [project]",
    "  ● hello v1.0.0 (partially-upgradable) {unsupported component}",
    "    Re-run with --partial to update with the supported components.",
    "",
    "Plugin update: nothing to update",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural");

  // assert
  assert.deepStrictEqual(boundary.notifications, [{ message: expectedMessage }]);
  boundary.verifyBoundary();
});

test("renders an absent targeted result as an exact error without a version", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        notes: [],
        reasons: ["not installed"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
  ];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    {
      message:
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (skipped) {not installed}",
      severity: "error",
    },
  ]);
  boundary.verifyBoundary();
});

test("renders a failed bulk result with exact severity and tally", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "failed",
        name: "hello",
        notes: ["denied"],
        reasons: ["permission denied"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
  ];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural");

  // assert
  assert.deepStrictEqual(boundary.notifications, [
    {
      message:
        "A plugin operation has failed.\n\n● mp [project]\n  ⊘ hello (failed) {permission denied}\n\nPlugin update: 1 failure",
      severity: "error",
    },
  ]);
  boundary.verifyBoundary();
});

test("suppresses an unchanged cascade after a separately reported failure", () => {
  // arrange
  const boundary = createNotificationBoundary(0, 2);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "unchanged",
        name: "hello",
        fromVersion: "1.0.0",
        toVersion: "1.0.0",
        declaresAgents: false,
        declaresMcp: false,
        constraint: undefined,
      },
    },
  ];

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural", true);

  // assert
  assert.deepStrictEqual(boundary.notifications, []);
  boundary.verifyBoundary();
});

interface SkippedCase {
  readonly title: string;
  readonly cardinality: "single" | "plural";
  readonly outcome: UpdateCascadeOutcome;
  readonly expectedMessage: string;
  readonly expectedSeverity?: "warning" | "error";
}

const skippedCases: readonly SkippedCase[] = [
  {
    title: "keeps a no-longer-installable targeted decline at warning",
    cardinality: "single",
    outcome: {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        fromVersion: "1.0.0",
        notes: [],
        reasons: ["no longer installable"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
    expectedMessage:
      "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {no longer installable}",
    expectedSeverity: "warning",
  },
  {
    title: "keeps a no-longer-installable bulk decline informational",
    cardinality: "plural",
    outcome: {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        fromVersion: "",
        notes: [],
        reasons: ["no longer installable"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
    expectedMessage:
      "● mp [project]\n  ⊘ hello (skipped) {no longer installable}\n\nPlugin update: nothing to update",
  },
  {
    title: "renders a targeted partial decline with warning severity",
    cardinality: "single",
    outcome: {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        notes: [],
        reasons: ["unsupported component"],
        partialUpgradable: true,
        declaresAgents: false,
        declaresMcp: false,
      },
    },
    expectedMessage:
      "A plugin operation needs attention.\n\n● mp [project]\n  ● hello (partially-upgradable) {unsupported component}\n    Re-run with --partial to update with the supported components.",
    expectedSeverity: "warning",
  },
  {
    title: "routes an ordinary actionable skip through shared severity",
    cardinality: "single",
    outcome: {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "skipped",
        name: "hello",
        notes: [],
        reasons: ["invalid manifest"],
        declaresAgents: false,
        declaresMcp: false,
      },
    },
    expectedMessage:
      "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {invalid manifest}",
    expectedSeverity: "warning",
  },
];

for (const row of skippedCases) {
  test(row.title, () => {
    // arrange
    const boundary = createNotificationBoundary(1, 4);
    const expectedNotification =
      row.expectedSeverity === undefined
        ? { message: row.expectedMessage }
        : { message: row.expectedMessage, severity: row.expectedSeverity };

    // act
    composeUpdateCascade(boundary.ctx, boundary.pi, [row.outcome], row.cardinality);

    // assert
    assert.deepStrictEqual(boundary.notifications, [expectedNotification]);
    boundary.verifyBoundary();
  });
}

test("preserves caller order for rows in one marketplace", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes = [updated("mp", "project", "beta"), updated("mp", "project", "alpha")];
  const expectedMessage = [
    "● mp [project]",
    "  ● beta v1.0.0 → v1.1.0 (updated)",
    "  ● alpha v1.0.0 → v1.1.0 (updated)",
    "",
    "Plugin update: 2 updated",
    "",
    "/reload to pick up changes",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural");

  // assert
  assert.deepStrictEqual(boundary.notifications, [{ message: expectedMessage }]);
  boundary.verifyBoundary();
});

test("UPDT-02: a bulk run holds one plugin and updates the rest", () => {
  // arrange
  const boundary = createNotificationBoundary(1, 4);
  const outcomes = [
    heldOutcome("mp", "project", "charlie"),
    updated("mp", "project", "alpha"),
    updated("mp", "project", "beta"),
  ];
  const expectedMessage = [
    "A plugin operation needs attention.",
    "",
    "● mp [project]",
    "  ⊘ charlie v1.0.0 (skipped) {dependents constrain}",
    '    cause: the declared ranges admit no version in common -- required by "alpha@mp"',
    "  ● alpha v1.0.0 → v1.1.0 (updated)",
    "  ● beta v1.0.0 → v1.1.0 (updated)",
    "",
    "Plugin update: 1 warning, 2 updated",
    "",
    "/reload to pick up changes",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "plural");

  // assert -- one held row (warning) beside two updated rows (info); the
  // stage-two hold on one plugin leaves the other two rows unchanged.
  assert.deepStrictEqual(boundary.notifications, [
    { message: expectedMessage, severity: "warning" },
  ]);
  boundary.verifyBoundary();
});

test("SC3: an unconstrained plugin renders the same manual cascade rows as before", async (t) => {
  // arrange: the REAL preflight over a real on-disk marketplace, with a
  // second installed plugin ("beta") declaring something else entirely --
  // the gate itself, not a stub, decides "alpha" is unconstrained, and
  // `constraintFromVerdict` -- the production step that turns that verdict
  // into the outcome's disclosure slot -- is what fills `constraint` below.
  const seed = await seedUnconstrainedTarget("sc3-update-cascade-");
  t.after(() => rm(seed.cwd, { force: true, recursive: true }));
  const prepared = await preparePluginUpdate({
    plugin: "alpha",
    marketplace: "mp",
    scope: "project",
    locations: seed.locations,
    cleanupClones: async () => {},
  });
  assert.ok(!("partition" in prepared));
  assert.strictEqual(prepared.constraint, undefined);
  const outcomes: readonly UpdateCascadeOutcome[] = [
    {
      target: { marketplace: "mp", scope: "project" },
      outcome: {
        partition: "updated",
        name: "alpha",
        fromVersion: prepared.fromVersion,
        toVersion: prepared.toVersion,
        stagedAgentNames: [],
        stagedMcpServerNames: [],
        declaresAgents: false,
        declaresMcp: false,
        constraint: prepared.constraint,
      },
    },
  ];
  const boundary = createNotificationBoundary(1, 4);
  const expectedMessage = [
    "● mp [project]",
    "  ● alpha v1.0.0 → v1.1.0 (updated)",
    "",
    "/reload to pick up changes",
  ].join("\n");

  // act
  composeUpdateCascade(boundary.ctx, boundary.pi, outcomes, "single");

  // assert: the gate ran, found no holder, the preflight projected no
  // disclosure, and the rendered row is byte-identical to the
  // pre-constraint-gate rendering (NREG-01).
  assert.deepStrictEqual(boundary.notifications, [{ message: expectedMessage }]);
  boundary.verifyBoundary();
});
