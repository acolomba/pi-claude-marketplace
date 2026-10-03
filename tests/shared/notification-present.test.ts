import assert from "node:assert/strict";
import test from "node:test";

import { presentCascade } from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";

import { runWithAllLoaded, runWithNothingLoaded } from "./notification-run-seeds.ts";

import type { CascadePresentation } from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { RowPolicyMap } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  CascadeNotificationMessage,
  PluginInstalledMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

function installedRow(): PluginInstalledMessage {
  return {
    status: "installed",
    name: "alpha",
    dependencies: ["agents"],
    severity: "info",
    needsReload: true,
    reasons: ["lsp"],
  };
}

function cascadeOf(row: PluginInstalledMessage): CascadeNotificationMessage {
  return { marketplaces: [{ name: "mp", scope: "user", plugins: [row] }] };
}

function infoPresentation(
  reasons: CascadePresentation["marketplaces"][number]["plugins"][number]["reasons"],
): CascadePresentation {
  return {
    kind: "cascade",
    envelope: { severity: "info", needsReload: true, noOp: false },
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            severity: "info",
            needsReload: true,
            reasons,
          },
        ],
      },
    ],
  };
}

test("drops content reasons under a policy that turns them off", () => {
  // arrange
  const rowPolicies: RowPolicyMap = { installed: { markers: false, contentReasons: false } };

  // act
  const presentation = presentCascade(
    runWithNothingLoaded(),
    cascadeOf(installedRow()),
    rowPolicies,
  );

  // assert
  assert.deepStrictEqual(presentation, infoPresentation([]));
});

test("composes a requires marker after the content reasons when the companion is missing", () => {
  // arrange
  const rowPolicies: RowPolicyMap = { installed: { markers: true, contentReasons: true } };

  // act
  const presentation = presentCascade(
    runWithNothingLoaded(),
    cascadeOf(installedRow()),
    rowPolicies,
  );

  // assert
  assert.deepStrictEqual(presentation, infoPresentation(["lsp", "requires pi-subagents"]));
});

test("composes no marker when every companion is loaded", () => {
  // arrange
  const rowPolicies: RowPolicyMap = { installed: { markers: true, contentReasons: true } };

  // act
  const presentation = presentCascade(runWithAllLoaded(), cascadeOf(installedRow()), rowPolicies);

  // assert
  assert.deepStrictEqual(presentation, infoPresentation(["lsp"]));
});

test("resolves a row with no policy before the envelope, so the envelope reads its floored severity", () => {
  // arrange
  const rowPolicies: RowPolicyMap = {};
  const expectedPresentation: CascadePresentation = {
    kind: "cascade",
    envelope: {
      severity: "error",
      summary: "A plugin operation has failed.",
      needsReload: true,
      noOp: false,
    },
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            severity: "error",
            needsReload: true,
            reasons: ["lsp"],
            missingPolicy: true,
          },
        ],
      },
    ],
  };

  // act
  const presentation = presentCascade(
    runWithNothingLoaded(),
    cascadeOf(installedRow()),
    rowPolicies,
  );

  // assert
  assert.deepStrictEqual(presentation, expectedPresentation);
});

test("copies the advisory lines and retained workflows the message carries", () => {
  // arrange
  const message: CascadeNotificationMessage = {
    marketplaces: [],
    advisories: ["advice"],
    retainedWorkflows: [{ name: "wf", envelopeCount: 2 }],
  };
  const expectedPresentation: CascadePresentation = {
    kind: "cascade",
    envelope: { severity: "info", needsReload: false, noOp: false },
    marketplaces: [],
    advisories: ["advice"],
    retainedWorkflows: [{ name: "wf", envelopeCount: 2 }],
  };

  // act
  const presentation = presentCascade(runWithNothingLoaded(), message, {});

  // assert
  assert.deepStrictEqual(presentation, expectedPresentation);
});

test("leaves advisories and retained workflows absent when the message has none", () => {
  // arrange
  const expectedPresentation: CascadePresentation = {
    kind: "cascade",
    envelope: { severity: "info", needsReload: false, noOp: false },
    marketplaces: [],
  };

  // act
  const presentation = presentCascade(runWithNothingLoaded(), { marketplaces: [] }, {});

  // assert
  assert.deepStrictEqual(presentation, expectedPresentation);
});

test("carries a failed row's cause as a serialized chain with no live error", () => {
  // arrange
  const message: CascadeNotificationMessage = {
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            severity: "error",
            reasons: ["lock held"],
            cause: new Error("boom", { cause: new Error("root") }),
            rollbackPartial: [{ phase: "skills", cause: new Error("undo") }, { phase: "mcp" }],
          },
        ],
      },
    ],
  };
  const expectedPresentation: CascadePresentation = {
    kind: "cascade",
    envelope: {
      severity: "error",
      summary: "A plugin operation has failed.",
      needsReload: false,
      noOp: false,
    },
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "alpha",
            severity: "error",
            reasons: ["lock held"],
            failure: {
              cause: { causeChain: ["boom", "root"], truncated: false },
              leaks: [],
              rollbackPartial: [
                { phase: "skills", cause: { causeChain: ["undo"], truncated: false } },
                { phase: "mcp" },
              ],
            },
          },
        ],
      },
    ],
  };

  // act
  const presentation = presentCascade(runWithNothingLoaded(), message, {
    failed: { markers: false, contentReasons: true },
  });

  // assert
  assert.deepStrictEqual(presentation, expectedPresentation);
});
