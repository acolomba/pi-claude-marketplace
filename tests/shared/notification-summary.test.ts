import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import {
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
} from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import {
  buildSummaryLine,
  composeRetainedWorkflowsAdvisories,
  computeSeverity,
  countRowsBySeverity,
  isInfoKind,
  shouldEmitReloadHint,
} from "../../extensions/pi-claude-marketplace/shared/notification-summary.ts";

import { runWithSoftDeps } from "./notification-run-seeds.ts";

import type { ResolvedRow } from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

interface NotificationContext {
  readonly ui: { readonly notify: ReturnType<TestContext["mock"]["fn"]> };
}

function createContext(t: TestContext): NotificationContext {
  return { ui: { notify: t.mock.fn() } };
}

/** A render map that covers every row status, so no row is floored to error. */
function hasRenderArm(): boolean {
  return true;
}

/** pi-subagents and pi-mcp-adapter are loaded; the workflow engine is not. */
function notificationRun(): NotificationRun {
  return runWithSoftDeps({
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: false,
  });
}

function renderRow(row: ResolvedRow): string {
  return `${row.name} (${row.status})`;
}

function emitContext(t: TestContext, message: CascadeNotificationMessage): readonly unknown[] {
  const ctx = createContext(t);

  emitContextCascade(ctx as never, notificationRun(), message, renderRow, {}, hasRenderArm);

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
    "A plugin operation has failed.\n\n● official [user]\n  alpha (failed)\n\nPlugin install: 1 failure\n\n/reload to pick up changes",
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
  { kind: "reconcile-pending-empty" },
  { kind: "reconcile-applied-cascade", marketplaces: [] },
] satisfies readonly NotificationMessage[]) {
  test(`${message.kind} is standalone and suppresses reload`, () => {
    // act & assert
    assert.equal(isInfoKind(message), true);
    assert.equal(shouldEmitReloadHint(message), false);
  });
}

test("cascade messages are not standalone", () => {
  // arrange
  const message = { kind: "cascade", marketplaces: [] } satisfies NotificationMessage;

  // act & assert
  assert.equal(isInfoKind(message), false);
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
  emitUpdateNoOpCascade(
    emptyContext as never,
    notificationRun(),
    emptyMessage,
    renderRow,
    {},
    hasRenderArm,
  );
  emitUpdateNoOpCascade(
    bodyContext as never,
    notificationRun(),
    bodyMessage,
    renderRow,
    {},
    hasRenderArm,
  );

  // assert
  assert.deepStrictEqual(emptyContext.ui.notify.mock.calls[0]!.arguments, [
    "Plugin update: nothing to update",
  ]);
  assert.deepStrictEqual(bodyContext.ui.notify.mock.calls[0]!.arguments, [
    "● official [user]\n  alpha (partially-upgradable)\n\nPlugin update: nothing to update",
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
  emitReconcileAppliedContextCascade(
    ctx as never,
    notificationRun(),
    message,
    renderRow,
    {},
    hasRenderArm,
  );

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  alpha (failed)\n\nReconcile: 1 failure",
    "error",
  ]);
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
