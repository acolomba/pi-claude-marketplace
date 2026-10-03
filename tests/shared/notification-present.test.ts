import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  presentCascade,
  presentNotification,
  presentReconcileApplied,
  presentUpdateNoOp,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";

import { runWithAllLoaded, runWithNothingLoaded } from "./notification-run-seeds.ts";

import type {
  CascadePresentation,
  ReconcileAppliedPresentation,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type { RowPolicyMap } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  CascadeNotificationMessage,
  MarketplaceInfoCascadeMessage,
  MarketplaceInfoMessage,
  MarketplaceNotAddedMessage,
  PluginInfoCascadeMessage,
  PluginInfoMessage,
  PluginInstalledMessage,
  PruneCommittedWarningMessage,
  PruneEmptyMessage,
  ReconcileAppliedCascadeMessage,
  ReconcilePendingEmptyMessage,
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

describe("presentCascade", () => {
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
});

describe("presentUpdateNoOp", () => {
  test("presents a no-op envelope with no tally or reload and drops the advisory lines", () => {
    // arrange
    const message: CascadeNotificationMessage = {
      ...cascadeOf(installedRow()),
      label: "Plugin update",
      cardinality: "plural",
      advisories: ["advice"],
      retainedWorkflows: [{ name: "wf" }],
    };
    const rowPolicies: RowPolicyMap = { installed: { markers: true, contentReasons: false } };
    const expectedPresentation: CascadePresentation = {
      kind: "cascade",
      envelope: { severity: "info", needsReload: false, noOp: true },
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
              reasons: ["requires pi-subagents"],
            },
          ],
        },
      ],
    };

    // act
    const presentation = presentUpdateNoOp(runWithNothingLoaded(), message, rowPolicies);

    // assert
    assert.deepStrictEqual(presentation, expectedPresentation);
  });
});

describe("presentReconcileApplied", () => {
  test("resolves a row with no policy before the envelope, so the envelope reads its floored severity", () => {
    // arrange
    const message: ReconcileAppliedCascadeMessage = {
      kind: "reconcile-applied-cascade",
      marketplaces: cascadeOf(installedRow()).marketplaces,
    };
    const expectedPresentation: ReconcileAppliedPresentation = {
      kind: "reconcile-applied-cascade",
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
    const presentation = presentReconcileApplied(runWithNothingLoaded(), message, {});

    // assert
    assert.deepStrictEqual(presentation, expectedPresentation);
  });

  test("presents a plural labeled reconcile with its tally", () => {
    // arrange
    const message: ReconcileAppliedCascadeMessage = {
      kind: "reconcile-applied-cascade",
      marketplaces: cascadeOf(installedRow()).marketplaces,
      label: "Reconcile",
      cardinality: "plural",
    };
    const rowPolicies: RowPolicyMap = { installed: { markers: false, contentReasons: true } };
    const expectedPresentation: ReconcileAppliedPresentation = {
      kind: "reconcile-applied-cascade",
      envelope: {
        severity: "info",
        needsReload: false,
        noOp: false,
        tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
      },
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
              reasons: ["lsp"],
            },
          ],
        },
      ],
    };

    // act
    const presentation = presentReconcileApplied(runWithAllLoaded(), message, rowPolicies);

    // assert
    assert.deepStrictEqual(presentation, expectedPresentation);
  });
});

function marketplaceInfo(): MarketplaceInfoMessage {
  return {
    kind: "marketplace-info",
    name: "mp",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "github", owner: "acme", repo: "mp" },
  };
}

function pluginInfo(): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "available", name: "alpha", componentsResolved: false },
  };
}

describe("presentNotification", () => {
  test("presents a cascade with no kind under the central row policy", () => {
    // arrange
    const message = {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            {
              status: "installed",
              name: "alpha",
              dependencies: [],
              severity: "info",
              needsReload: true,
              reasons: ["lsp"],
            },
          ],
        },
      ],
    } satisfies CascadeNotificationMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
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
              reasons: ["lsp"],
            },
          ],
        },
      ],
    } satisfies CascadePresentation);
  });

  test("presents an explicit cascade kind like a cascade with no kind", () => {
    // arrange
    const message = { kind: "cascade", marketplaces: [] } satisfies CascadeNotificationMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "cascade",
      envelope: { severity: "info", needsReload: false, noOp: false },
      marketplaces: [],
    } satisfies CascadePresentation);
  });

  test("presents an applied reconcile without a reload", () => {
    // arrange
    const message = {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            {
              status: "installed",
              name: "alpha",
              dependencies: [],
              severity: "info",
              needsReload: true,
              reasons: [],
            },
          ],
        },
      ],
    } satisfies ReconcileAppliedCascadeMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "reconcile-applied-cascade",
      envelope: { severity: "info", needsReload: false, noOp: false },
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
              reasons: [],
            },
          ],
        },
      ],
    } satisfies ReconcileAppliedPresentation);
  });

  test("carries a marketplace-info message by identity with an info envelope", () => {
    // arrange
    const message = marketplaceInfo();

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "marketplace-info",
      envelope: { severity: "info", needsReload: false, noOp: false },
      message,
    });
    assert.ok("message" in presentation);
    assert.strictEqual(presentation.message, message);
  });

  test("presents a failed plugin-info row with an error envelope", () => {
    // arrange
    const message = {
      ...pluginInfo(),
      plugin: { status: "failed", name: "alpha", componentsResolved: false },
    } satisfies PluginInfoMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "plugin-info",
      envelope: {
        severity: "error",
        summary: "A plugin operation has failed.",
        needsReload: false,
        noOp: false,
      },
      message,
    });
    assert.ok("message" in presentation);
    assert.strictEqual(presentation.message, message);
  });

  test("carries both info fan-outs by identity with info envelopes", () => {
    // arrange
    const marketplaces = {
      kind: "marketplace-info-cascade",
      blocks: [marketplaceInfo()],
    } satisfies MarketplaceInfoCascadeMessage;
    const plugins = {
      kind: "plugin-info-cascade",
      blocks: [pluginInfo()],
    } satisfies PluginInfoCascadeMessage;

    // act
    const presentations = [
      presentNotification(runWithAllLoaded(), marketplaces),
      presentNotification(runWithAllLoaded(), plugins),
    ];

    // assert
    assert.deepStrictEqual(presentations, [
      {
        kind: "marketplace-info-cascade",
        envelope: { severity: "info", needsReload: false, noOp: false },
        message: marketplaces,
      },
      {
        kind: "plugin-info-cascade",
        envelope: { severity: "info", needsReload: false, noOp: false },
        message: plugins,
      },
    ]);
  });

  test("carries the pending-empty and prune-empty messages with info envelopes", () => {
    // arrange
    const pending = {
      kind: "reconcile-pending-empty",
      advisories: ["note"],
    } satisfies ReconcilePendingEmptyMessage;
    const prune = { kind: "prune-empty", scope: "project" } satisfies PruneEmptyMessage;

    // act
    const presentations = [
      presentNotification(runWithAllLoaded(), pending),
      presentNotification(runWithAllLoaded(), prune),
    ];

    // assert
    assert.deepStrictEqual(presentations, [
      {
        kind: "reconcile-pending-empty",
        envelope: { severity: "info", needsReload: false, noOp: false },
        message: pending,
      },
      {
        kind: "prune-empty",
        envelope: { severity: "info", needsReload: false, noOp: false },
        message: prune,
      },
    ]);
  });

  for (const { message, reason } of [
    {
      message: { kind: "marketplace-not-added", name: "mp" },
      reason: "marketplace not added",
    },
    {
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "user",
        presentInOtherScope: true,
      },
      reason: "marketplace not added to user scope",
    },
    {
      message: {
        kind: "marketplace-not-added",
        name: "mp",
        scope: "project",
        presentInOtherScope: true,
      },
      reason: "marketplace not added to project scope",
    },
  ] satisfies readonly { message: MarketplaceNotAddedMessage; reason: string }[]) {
    test(`resolves the not-added reason as ${reason}`, () => {
      // arrange
      const expectedPresentation = {
        kind: "marketplace-not-added",
        envelope: {
          severity: "error",
          summary: "A marketplace operation has failed.",
          needsReload: false,
          noOp: false,
        },
        message,
        reason,
      };

      // act
      const presentation = presentNotification(runWithAllLoaded(), message);

      // assert
      assert.deepStrictEqual(presentation, expectedPresentation);
    });
  }

  test("serializes the prune cause over its redacted chain with no live error", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("save failed at /home/user/.pi/state.json", {
        cause: new Error("disk full"),
      }),
    } satisfies PruneCommittedWarningMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "prune-committed-warning",
      envelope: {
        severity: "warning",
        summary: "Prune committed; finalization needs attention.",
        needsReload: true,
        noOp: false,
      },
      scope: "project",
      cause: { causeChain: ["save failed at state.json", "disk full"], truncated: false },
    });
    assert.ok(!Object.values(presentation).some((field) => field instanceof Error));
  });

  test("presents a prune warning whose cause is absent with no cause member", () => {
    // arrange
    const message = { kind: "prune-committed-warning", scope: "user" };

    // act
    const presentation = presentNotification(runWithAllLoaded(), message as never);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "prune-committed-warning",
      envelope: {
        severity: "warning",
        summary: "Prune committed; finalization needs attention.",
        needsReload: true,
        noOp: false,
      },
      scope: "user",
    });
  });
});
