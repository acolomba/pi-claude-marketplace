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
    envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
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
        needsApply: false,
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
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      marketplaces: [],
      advisories: ["advice"],
      retainedWorkflows: [{ name: "wf", envelopeCount: 2 }],
    };

    // act
    const presentation = presentCascade(runWithNothingLoaded(), message, {});

    // assert
    assert.deepStrictEqual(presentation, expectedPresentation);
  });

  test("PMOD-04 / D-07 redacts the credentials of advisory lines", () => {
    // arrange
    const message: CascadeNotificationMessage = {
      marketplaces: [],
      advisories: ["clone https://user:tok@host/o/r failed", "plain advice"],
    };
    const expectedPresentation: CascadePresentation = {
      kind: "cascade",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      marketplaces: [],
      advisories: ["clone https://***@host/o/r failed", "plain advice"],
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
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
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
        needsApply: false,
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
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: true },
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
        needsReload: true,
        needsApply: false,
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
        needsReload: true,
        needsApply: false,
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
      envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
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
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      marketplaces: [],
    } satisfies CascadePresentation);
  });

  test("presents an applied reconcile with the reload its row stamps", () => {
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
      envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
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
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
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
        needsApply: false,
        noOp: false,
      },
      message,
    });
    assert.ok("message" in presentation);
    assert.strictEqual(presentation.message, message);
  });

  test("PMOD-04 / D-07 redacts the userinfo of a url-source marketplace-info", () => {
    // arrange
    const message = {
      ...marketplaceInfo(),
      source: { sourceKind: "url", url: "https://user:tok@host/mp.git", ref: "main" },
    } satisfies MarketplaceInfoMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "marketplace-info",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message: {
        kind: "marketplace-info",
        name: "mp",
        scope: "user",
        details: { autoupdate: false },
        source: { sourceKind: "url", url: "https://***@host/mp.git", ref: "main" },
      },
    });
  });

  test("carries a path-source marketplace-info message by identity", () => {
    // arrange
    const message = {
      ...marketplaceInfo(),
      source: { sourceKind: "path", absPath: "/srv/mp" },
    } satisfies MarketplaceInfoMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.ok("message" in presentation);
    assert.strictEqual(presentation.message, message);
  });

  for (const source of [
    { sourceKind: "path", absPath: "/srv/mp" },
    { sourceKind: "github", owner: "acme", repo: "mp" },
    { sourceKind: "url", url: "https://host/mp.git", ref: "main" },
  ] satisfies readonly MarketplaceInfoMessage["source"][]) {
    test(`redacts a stored marketplace-info name with a ${source.sourceKind} source`, () => {
      // arrange
      const message: MarketplaceInfoMessage = {
        ...marketplaceInfo(),
        name: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
        source,
        description: "Tools",
        allowedMarketplaces: ["other"],
      };

      // act
      const presentation = presentNotification(runWithAllLoaded(), message);

      // assert
      assert.deepStrictEqual(presentation, {
        kind: "marketplace-info",
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
        message: {
          kind: "marketplace-info",
          name: "***",
          scope: "user",
          details: { autoupdate: false },
          source,
          description: "Tools",
          allowedMarketplaces: ["other"],
        },
      });
    });
  }

  test("preserves marketplace-info when neither its name nor its URL needs redaction", () => {
    // arrange
    const message: MarketplaceInfoMessage = {
      ...marketplaceInfo(),
      source: { sourceKind: "url", url: "https://host/mp.git", ref: "main" },
    };

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "marketplace-info",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message,
    });
    assert.ok(presentation.kind === "marketplace-info");
    assert.strictEqual(presentation.message, message);
  });

  test("redacts the name and URL of a marketplace-info cascade block", () => {
    // arrange
    const githubBlock = marketplaceInfo();
    const message = {
      kind: "marketplace-info-cascade",
      blocks: [
        {
          ...marketplaceInfo(),
          name: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
          source: { sourceKind: "url", url: "ssh://git@host/mp.git" },
        },
        githubBlock,
      ],
    } satisfies MarketplaceInfoCascadeMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "marketplace-info-cascade",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message: {
        kind: "marketplace-info-cascade",
        blocks: [
          {
            kind: "marketplace-info",
            name: "***",
            scope: "user",
            details: { autoupdate: false },
            source: { sourceKind: "url", url: "ssh://***@host/mp.git" },
          },
          githubBlock,
        ],
      },
    });
    assert.ok(presentation.kind === "marketplace-info-cascade");
    assert.strictEqual(presentation.message.blocks[1], githubBlock);
  });

  test("redacts credentials in plugin-info names and notes without changing its subject", () => {
    // arrange
    const message = {
      ...pluginInfo(),
      marketplaceName: "https://user:secret123@example.com/tools",
      plugin: {
        status: "available",
        name: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
        marketplaceSubject: true,
        scope: "user",
        reasons: ["invalid manifest"],
        componentsResolved: false,
        notes: ["workflow wf: fetch with Bearer abc.def failed", "plain note"],
      },
    } satisfies PluginInfoMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "plugin-info",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message: {
        kind: "plugin-info",
        marketplaceName: "https://***@example.com/tools",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "***",
          marketplaceSubject: true,
          scope: "user",
          reasons: ["invalid manifest"],
          componentsResolved: false,
          notes: ["workflow wf: fetch with Bearer *** failed", "plain note"],
        },
      },
    });
  });

  for (const { marketplaceName, name, expectedMarketplaceName, expectedName } of [
    {
      marketplaceName: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
      name: "alpha",
      expectedMarketplaceName: "***",
      expectedName: "alpha",
    },
    {
      marketplaceName: "mp",
      name: "ghp_0123456789abcdefghijklmnopqrstuvwxyz",
      expectedMarketplaceName: "mp",
      expectedName: "***",
    },
  ]) {
    test(`redacts plugin-info names without notes for ${expectedMarketplaceName}/${expectedName}`, () => {
      // arrange
      const message: PluginInfoMessage = {
        ...pluginInfo(),
        marketplaceName,
        plugin: { ...pluginInfo().plugin, name },
      };

      // act
      const presentation = presentNotification(runWithAllLoaded(), message);

      // assert
      assert.deepStrictEqual(presentation, {
        kind: "plugin-info",
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
        message: {
          ...message,
          marketplaceName: expectedMarketplaceName,
          plugin: { ...message.plugin, name: expectedName },
        },
      });
    });
  }

  test("preserves a plugin-info message whose names and notes need no redaction", () => {
    // arrange
    const message: PluginInfoMessage = {
      ...pluginInfo(),
      plugin: { ...pluginInfo().plugin, notes: ["plain note"] },
    };

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "plugin-info",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message,
    });
    assert.ok(presentation.kind === "plugin-info");
    assert.strictEqual(presentation.message, message);
  });

  test("PMOD-04 / D-07 redacts the plugin-info notes of a plugin-info cascade", () => {
    // arrange
    const notesFreeBlock = pluginInfo();
    const message = {
      kind: "plugin-info-cascade",
      blocks: [
        notesFreeBlock,
        {
          ...pluginInfo(),
          plugin: {
            status: "available",
            name: "beta",
            componentsResolved: false,
            notes: ["token ghp_0123456789abcdefghijklmnopqrstuvwxyz rejected"],
          },
        },
      ],
    } satisfies PluginInfoCascadeMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "plugin-info-cascade",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message: {
        kind: "plugin-info-cascade",
        blocks: [
          notesFreeBlock,
          {
            kind: "plugin-info",
            marketplaceName: "mp",
            marketplaceScope: "user",
            marketplaceDetails: { autoupdate: false },
            plugin: {
              status: "available",
              name: "beta",
              componentsResolved: false,
              notes: ["token *** rejected"],
            },
          },
        ],
      },
    });
    assert.ok(presentation.kind === "plugin-info-cascade");
    assert.strictEqual(presentation.message.blocks[0], notesFreeBlock);
  });

  test("PMOD-04 / D-07 redacts the credentials of pending-empty advisories", () => {
    // arrange
    const message = {
      kind: "reconcile-pending-empty",
      command: "pending",
      advisories: ["retained https://user:tok@host/o/r staging"],
      retainedWorkflows: [{ name: "wf" }],
    } satisfies ReconcilePendingEmptyMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "reconcile-pending-empty",
      envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
      message: {
        kind: "reconcile-pending-empty",
        command: "pending",
        advisories: ["retained https://***@host/o/r staging"],
        retainedWorkflows: [{ name: "wf" }],
      },
    });
  });

  test("carries both info fan-outs with info envelopes", () => {
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
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
        message: marketplaces,
      },
      {
        kind: "plugin-info-cascade",
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
        message: plugins,
      },
    ]);
  });

  test("carries a pending-empty message without advisories by identity", () => {
    // arrange
    const message = {
      kind: "reconcile-pending-empty",
      command: "apply",
    } satisfies ReconcilePendingEmptyMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.ok("message" in presentation);
    assert.strictEqual(presentation.message, message);
  });

  test("carries the pending-empty and prune-empty messages with info envelopes", () => {
    // arrange
    const pending = {
      kind: "reconcile-pending-empty",
      command: "pending",
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
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
        message: pending,
      },
      {
        kind: "prune-empty",
        envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
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
          needsApply: false,
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

  test("PMOD-04 / D-07 redacts the userinfo of a marketplace-not-added name", () => {
    // arrange
    const message = {
      kind: "marketplace-not-added",
      name: "https://alice:s3cret@github.com/o/r.git",
      scope: "user",
    } satisfies MarketplaceNotAddedMessage;

    // act
    const presentation = presentNotification(runWithAllLoaded(), message);

    // assert
    assert.deepStrictEqual(presentation, {
      kind: "marketplace-not-added",
      envelope: {
        severity: "error",
        summary: "A marketplace operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
      message: {
        kind: "marketplace-not-added",
        name: "https://***@github.com/o/r.git",
        scope: "user",
      },
      reason: "marketplace not added",
    });
  });

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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: { causeChain: ["save failed at state.json", "disk full"], truncated: false },
    });
    assert.ok(!Object.values(presentation).some((field) => field instanceof Error));
  });

  test("keeps diagnostic prose after a redacted prune cause path", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/private/file.json' failed; see docs/errors 'E_READ'"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open 'file.json' failed; see docs/errors 'E_READ'"],
        truncated: false,
      },
    });
  });

  test("fails closed for ambiguous quote boundaries in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("unlink '/tmp/O' Mary Jane/秘密/secret.json'", {
        cause: new Error("open '/tmp/private/file.json' docs/errors 'E_READ'"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["unlink '[redacted path]", "open 'file.json' docs/errors 'E_READ'"],
        truncated: false,
      },
    });
  });

  test("keeps slash-bearing prose before a punctuation-prefixed quoted value", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/private/file.json' docs/errors '.hidden'"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open 'file.json' docs/errors '.hidden'"],
        truncated: false,
      },
    });
  });

  test("fails closed for multi-quote paths in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/O' Brien's files/秘密/secret.json'", {
        cause: new Error("open '\\\\server\\private\\O' Mary Jane\\秘密\\secret.json '"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open '[redacted path]", "open '[redacted path]"],
        truncated: false,
      },
    });
  });

  test("fails closed for an embedded quote before Unicode space", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/O'\u00a0Brien/秘密/secret.json'"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: { causeChain: ["open '[redacted path]"], truncated: false },
    });
  });

  test("elides prose after an unclosed path in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/private/file.json failed; see docs/errors"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open '[redacted path]"],
        truncated: false,
      },
    });
  });

  test("fails closed for an unclosed spaced path in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/O Brien/private/secret.json"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: { causeChain: ["open '[redacted path]"], truncated: false },
    });
  });

  test("fails closed for a path before unmatched quotes in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/private/file.json' docs/errors 'x/y' tail 'unclosed"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open '[redacted path]"],
        truncated: false,
      },
    });
  });

  test("fails closed for ambiguous quote chains in a presented prune cause", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/O' Brien/private/secret.json", {
        cause: new Error("open '/tmp/private/file.json' help/guide '"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: {
        causeChain: ["open '[redacted path]", "open '[redacted path]"],
        truncated: false,
      },
    });
  });

  test("fails closed when a later quoted value resembles a local path delimiter", () => {
    // arrange
    const message = {
      kind: "prune-committed-warning",
      scope: "project",
      cause: new Error("open '/tmp/private/file.json' value 'x/y' docs/errors '"),
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
        needsApply: false,
        noOp: false,
      },
      scope: "project",
      cause: { causeChain: ["open '[redacted path]"], truncated: false },
    });
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
        needsApply: false,
        noOp: false,
      },
      scope: "user",
    });
  });
});
