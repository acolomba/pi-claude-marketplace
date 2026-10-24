import assert from "node:assert/strict";
import { test, type TestContext, type Mock } from "node:test";

import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { CENTRAL_ROW_POLICY } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import {
  buildSummaryLine,
  composeLeftoverRemovalAdvisories,
  composeRetainedWorkflowsAdvisories,
  computeSeverity,
  countRowsBySeverity,
  shouldEmitReloadHint,
} from "../../extensions/pi-claude-marketplace/shared/notification-summary.ts";

import { runWithSoftDeps } from "./notification-run-seeds.ts";

import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

interface NotificationContext {
  mode: string;
  readonly ui: {
    readonly notify: Mock<(message: string, severity?: "info" | "warning" | "error") => void>;
  };
}

function createContext(t: TestContext): NotificationContext {
  return {
    mode: "tui",
    ui: { notify: t.mock.fn((_message: string, _severity?: "info" | "warning" | "error") => {}) },
  };
}

/** pi-subagents and pi-mcp-adapter are loaded; the workflow engine is not. */
function notificationRun(): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: false,
  });
}

function emitContext(t: TestContext, message: CascadeNotificationMessage): readonly unknown[] {
  const ctx = createContext(t);

  emitContextCascade(ctx, notificationRun(), message, CENTRAL_ROW_POLICY);

  assert.equal(ctx.ui.notify.mock.callCount(), 1);
  return ctx.ui.notify.mock.calls[0]!.arguments;
}

for (const { name, cardinality, expected } of [
  {
    name: "single invocation omits a tally for one rendered row",
    cardinality: "single",
    expected: "● official [user] (added)",
  },
  {
    name: "plural invocation keeps a tally for the same one rendered row",
    cardinality: "plural",
    expected: "● official [user] (added)\n\nMarketplace autoupdate: 1 success",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const message = {
      kind: "cascade",
      cardinality,
      label: "Marketplace autoupdate",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "added",
          severity: "info",
          needsReload: false,
          plugins: [],
        },
      ],
    } satisfies CascadeNotificationMessage;

    // act
    const notification = emitContext(t, message);

    // assert
    assert.deepStrictEqual(notification, [expected]);
  });
}

for (const { name, marketplaces, expected } of [
  {
    name: "empty plural invocation emits only the empty-state sentinel",
    marketplaces: [],
    expected: "(no marketplaces)",
  },
  {
    name: "plural invocation reports one success for one rendered row",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "added",
        severity: "info",
        needsReload: false,
        plugins: [],
      },
    ],
    expected: "● official [user] (added)\n\nMarketplace autoupdate: 1 success",
  },
  {
    name: "plural invocation reports many successes in stable row order",
    marketplaces: [
      {
        name: "first",
        scope: "project",
        status: "added",
        severity: "info",
        needsReload: false,
        plugins: [],
      },
      {
        name: "second",
        scope: "user",
        status: "added",
        severity: "info",
        needsReload: false,
        plugins: [],
      },
    ],
    expected:
      "● first [project] (added)\n\n● second [user] (added)\n\nMarketplace autoupdate: 2 successes",
  },
] as const) {
  test(name, (t) => {
    // arrange
    const message = {
      kind: "cascade",
      cardinality: "plural",
      label: "Marketplace autoupdate",
      marketplaces,
    } satisfies CascadeNotificationMessage;

    // act
    const notification = emitContext(t, message);

    // assert
    assert.deepStrictEqual(notification, [expected]);
  });
}

test("nonempty all-failure summary, tally, and reload hint retain their exact order", (t) => {
  // arrange
  const message = {
    kind: "cascade",
    cardinality: "plural",
    label: "Plugin install",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "alpha",
            status: "failed",
            reasons: ["not found"],
            severity: "error",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  const notification = emitContext(t, message);

  // assert
  assert.deepStrictEqual(notification, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}\n\nPlugin install: 1 failure\n\n/reload to pick up changes",
    "error",
  ]);
});

for (const { name, message, expected } of [
  {
    name: "marketplace reload stamp requests a reload",
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "added",
          severity: "info",
          needsReload: true,
          plugins: [],
        },
      ],
    },
    expected: true,
  },
  {
    name: "plugin reload stamp requests a reload",
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              name: "alpha",
              status: "installed",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
    expected: true,
  },
  {
    name: "empty cascade does not request a reload",
    message: { marketplaces: [] },
    expected: false,
  },
] as const) {
  test(name, () => {
    // act & assert
    assert.equal(shouldEmitReloadHint(message as NotificationMessage), expected);
  });
}

for (const message of [
  {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    source: { sourceKind: "path", absPath: "/marketplaces/official" },
  },
  {
    kind: "plugin-info",
    marketplaceName: "official",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin: { name: "alpha", status: "available", componentsResolved: false },
  },
  {
    kind: "marketplace-info-cascade",
    blocks: [
      {
        kind: "marketplace-info",
        name: "official",
        scope: "user",
        details: { autoupdate: true },
        source: { sourceKind: "path", absPath: "/marketplaces/official" },
      },
    ],
  },
  {
    kind: "plugin-info-cascade",
    blocks: [
      {
        kind: "plugin-info",
        marketplaceName: "official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: { name: "alpha", status: "available", componentsResolved: false },
      },
    ],
  },
  { kind: "marketplace-not-added", name: "missing" },
  { kind: "reconcile-pending-empty", command: "apply" },
  { kind: "prune-empty", scope: "user" },
  { kind: "reconcile-applied-cascade", marketplaces: [] },
] satisfies readonly NotificationMessage[]) {
  test(`${message.kind} is standalone and suppresses reload`, () => {
    // act & assert
    assert.equal(shouldEmitReloadHint(message), false);
  });
}

test("a cascade is not standalone, so its row stamps drive the reload", () => {
  // arrange
  const message = {
    kind: "cascade",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies NotificationMessage;

  // act & assert
  assert.equal(shouldEmitReloadHint(message), true);
});

test("a committed prune warning remains standalone and requests reload", () => {
  // arrange
  const message = {
    kind: "prune-committed-warning",
    scope: "user",
    cause: new Error("release failed"),
  } satisfies NotificationMessage;

  // act & assert
  assert.equal(shouldEmitReloadHint(message), true);
  assert.equal(computeSeverity(message), "warning");
  assert.equal(
    buildSummaryLine(message, "warning"),
    "Prune committed; finalization needs attention.",
  );
});

for (const { name, message, severity, summary } of [
  {
    name: "marketplace absence resolves an error with a marketplace summary",
    message: { kind: "marketplace-not-added", name: "missing" },
    severity: "error",
    summary: "A marketplace operation has failed.",
  },
  {
    name: "failed plugin info resolves an error with a plugin summary",
    message: {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin: {
        name: "alpha",
        status: "failed",
        reasons: ["not found"],
        componentsResolved: false,
      },
    },
    severity: "error",
    summary: "A plugin operation has failed.",
  },
  {
    name: "mixed warning rows resolve a plural subjectless warning summary",
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "skipped",
          severity: "warning",
          reasons: ["not found"],
          plugins: [
            {
              name: "alpha",
              status: "skipped",
              reasons: ["not installed"],
              severity: "warning",
              needsReload: false,
            },
          ],
        },
      ],
    },
    severity: "warning",
    summary: "Some operations need attention.",
  },
  {
    name: "a marketplace-only failure resolves a marketplace summary",
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "failed",
          severity: "error",
          plugins: [],
        },
      ],
    },
    severity: "error",
    summary: "A marketplace operation has failed.",
  },
  {
    name: "reconcile summary counts mixed failed subjects",
    message: {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "failed",
          severity: "error",
          plugins: [
            {
              name: "alpha",
              status: "failed",
              reasons: ["not found"],
              severity: "error",
              needsReload: true,
            },
          ],
        },
      ],
    },
    severity: "error",
    summary: "Some operations have failed.",
  },
  {
    name: "reconcile summary counts marketplace-only warnings",
    message: {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "skipped",
          severity: "warning",
          plugins: [],
        },
      ],
    },
    severity: "warning",
    summary: "A marketplace operation needs attention.",
  },
] satisfies readonly {
  readonly name: string;
  readonly message: NotificationMessage;
  readonly severity: "warning" | "error";
  readonly summary: string;
}[]) {
  test(name, () => {
    // act
    const resolved = {
      severity: computeSeverity(message),
      summary: buildSummaryLine(message, severity),
    };

    // assert
    assert.deepStrictEqual(resolved, { severity, summary });
  });
}

for (const { name, message } of [
  {
    name: "available plugin info resolves to info severity",
    message: {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin: { name: "alpha", status: "available", componentsResolved: false },
    },
  },
  {
    name: "read-only marketplace info resolves to info severity",
    message: {
      kind: "marketplace-info",
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      source: { sourceKind: "path", absPath: "/marketplaces/official" },
    },
  },
  {
    name: "an unstamped cascade plugin defaults to info severity",
    message: {
      cardinality: "plural",
      label: "Plugin list",
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [{ name: "alpha", status: "available" }],
        },
      ],
    },
  },
] satisfies readonly { readonly name: string; readonly message: NotificationMessage }[]) {
  test(name, () => {
    // act & assert
    assert.equal(computeSeverity(message), undefined);
  });
}

for (const { name, message } of [
  {
    name: "summary composes no line for a read-only kind",
    message: {
      kind: "marketplace-info",
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      source: { sourceKind: "path", absPath: "/marketplaces/official" },
    },
  },
  {
    name: "summary composes no line for an available plugin info",
    message: {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin: { name: "alpha", status: "available", componentsResolved: false },
    },
  },
] satisfies readonly { readonly name: string; readonly message: NotificationMessage }[]) {
  test(name, () => {
    // act & assert
    assert.equal(buildSummaryLine(message, "error"), "");
  });
}

test("countRowsBySeverity counts unstamped rows as info", () => {
  // arrange
  const marketplaces = [
    {
      name: "official",
      scope: "user",
      plugins: [
        { name: "alpha", status: "available" },
        { name: "beta", status: "available", severity: "info" },
        {
          name: "gamma",
          status: "failed",
          reasons: ["not found"],
          severity: "error",
          needsReload: false,
        },
      ],
    },
    {
      name: "extra",
      scope: "project",
      status: "failed",
      severity: "error",
      plugins: [],
    },
  ] satisfies CascadeNotificationMessage["marketplaces"];

  // act
  const counts = countRowsBySeverity(marketplaces, "info");

  // assert
  assert.deepStrictEqual(counts, { plugins: 2, marketplaces: 1 });
});

test("update no-op fold preserves empty and non-empty bodies", (t) => {
  // arrange
  const emptyContext = createContext(t);
  const bodyContext = createContext(t);
  const emptyMessage = { marketplaces: [] } satisfies CascadeNotificationMessage;
  const bodyMessage = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "alpha",
            status: "partially-upgradable",
            reasons: ["lsp"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  } satisfies CascadeNotificationMessage;

  // act
  emitUpdateNoOpCascade(emptyContext, notificationRun(), emptyMessage, CENTRAL_ROW_POLICY);
  emitUpdateNoOpCascade(bodyContext, notificationRun(), bodyMessage, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(emptyContext.ui.notify.mock.calls[0]!.arguments, [
    "Plugin update: nothing to update",
  ]);
  assert.deepStrictEqual(bodyContext.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  ● alpha (partially-upgradable) {lsp}\n\nPlugin update: nothing to update",
  ]);
});

test("reconcile applied fold suppresses reload while preserving severity and tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
    kind: "reconcile-applied-cascade",
    cardinality: "plural",
    label: "Reconcile",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            name: "alpha",
            status: "failed",
            reasons: ["not found"],
            severity: "error",
            needsReload: true,
          },
        ],
      },
    ],
  } satisfies Parameters<typeof emitReconcileAppliedContextCascade>[2];

  // act
  emitReconcileAppliedContextCascade(ctx, notificationRun(), message, CENTRAL_ROW_POLICY);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  ⊘ alpha (failed) {not found}\n\nReconcile: 1 failure",
    "error",
  ]);
});

test("leftover removal advisory redacts paths and preserves indentation", () => {
  // arrange
  const leak = "could not remove /private/clones/official: permission denied";

  // act
  const lines = composeLeftoverRemovalAdvisories(leak);

  // assert
  assert.deepStrictEqual(lines, ["    could not remove official: permission denied"]);
});

test("WR-05: composeRetainedWorkflowsAdvisories states the count when known and omits it when not", () => {
  // act
  const lines = composeRetainedWorkflowsAdvisories([
    { name: "alpha", envelopeCount: 1 },
    { name: "beta", envelopeCount: 3 },
    { name: "gamma" },
  ]);

  // assert
  assert.deepStrictEqual(lines, [
    "    retained workflow staging: alpha (1 envelope) under the workflows staging directory",
    "    retained workflow staging: beta (3 envelopes) under the workflows staging directory",
    "    retained workflow staging: gamma under the workflows staging directory",
  ]);
});

test("empty retained workflow observations produce no advisory lines", () => {
  // arrange
  const retained: [] = [];

  // act
  const lines = composeRetainedWorkflowsAdvisories(retained);

  // assert
  assert.deepStrictEqual(lines, []);
});

test("a retained workflow with zero envelopes keeps its observed count", () => {
  // arrange
  const retained = [{ name: "empty-tree", envelopeCount: 0 }];

  // act
  const lines = composeRetainedWorkflowsAdvisories(retained);

  // assert
  assert.deepStrictEqual(lines, [
    "    retained workflow staging: empty-tree (0 envelopes) under the workflows staging directory",
  ]);
});

test("retained workflow names preserve Unicode, spaces, and supplied order", () => {
  // arrange
  const retained = [
    { name: "z é", envelopeCount: 3 },
    { name: "é", envelopeCount: 1 },
    { name: "  spaced tree  " },
    { name: "é", envelopeCount: 0 },
  ];

  // act
  const lines = composeRetainedWorkflowsAdvisories(retained);

  // assert
  assert.deepStrictEqual(lines, [
    "    retained workflow staging: z é (3 envelopes) under the workflows staging directory",
    "    retained workflow staging: é (1 envelope) under the workflows staging directory",
    "    retained workflow staging:   spaced tree   under the workflows staging directory",
    "    retained workflow staging: é (0 envelopes) under the workflows staging directory",
  ]);
});
