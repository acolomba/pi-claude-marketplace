import assert from "node:assert/strict";
import test from "node:test";

import {
  composeUpdateCascade,
  type UpdateCascadeOutcome,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts";
import { createNotificationBoundary } from "../../edge/notification-boundary.ts";

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

test("rejects an update result outside the closed partition set", () => {
  // arrange
  const boundary = createNotificationBoundary(0, 2);
  const invalidOutcome = {
    target: { marketplace: "mp", scope: "project" as const },
    outcome: {
      partition: "unknown",
      name: "hello",
      declaresAgents: false,
      declaresMcp: false,
    },
  };

  // act & assert
  assert.throws(
    () => {
      // @ts-expect-error -- the runtime guard protects JavaScript callers from an invalid partition.
      composeUpdateCascade(boundary.ctx, boundary.pi, [invalidOutcome], "single");
    },
    { message: "Unknown plugin update partition." },
  );
  boundary.verifyBoundary();
});
