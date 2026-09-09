import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import {
  composeTally,
  emitContextCascade,
  emitReconcileAppliedContextCascade,
  emitUpdateNoOpCascade,
  emitWithSummary,
  foldTallyAndHint,
  isInfoKind,
  shouldEmitReloadHint,
} from "../../extensions/pi-claude-marketplace/shared/notification-summary.ts";

import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  CascadeNotificationMessage,
  NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

interface NotificationContext {
  readonly ui: { readonly notify: ReturnType<TestContext["mock"]["fn"]> };
}

interface NotificationApi {
  readonly getAllTools: () => readonly { readonly name: string }[];
}

function createContext(t: TestContext): NotificationContext {
  return { ui: { notify: t.mock.fn() } };
}

function notificationApi(): NotificationApi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

function messageWithKindSequence(
  fields: Record<string, unknown>,
  kinds: readonly string[],
): Record<string, unknown> {
  let index = 0;

  // The changing discriminator models a hostile getter so the exhaustive
  // switch tails remain runtime-tested instead of being compile-time-only.
  return Object.defineProperty({ ...fields }, "kind", {
    enumerable: true,
    get() {
      const kind = kinds[Math.min(index, kinds.length - 1)]!;
      index++;
      return kind;
    },
  });
}

function renderRow(
  row: Parameters<typeof emitContextCascade>[2]["marketplaces"][number]["plugins"][number],
  _probe: SoftDepStatus,
): string {
  return `${row.name} (${row.status})`;
}

function emitContext(t: TestContext, message: CascadeNotificationMessage): readonly unknown[] {
  const ctx = createContext(t);

  emitContextCascade(ctx as never, notificationApi(), message, renderRow);

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
    name: "plural invocation reports zero successes for zero rendered rows",
    marketplaces: [],
    expected: "(no marketplaces)\n\nMarketplace autoupdate: 0 successes",
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

test("severity summary, tally, and reload hint retain their exact order", (t) => {
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

test("plural tally keeps failure, warning, and success categories in order", () => {
  // arrange
  const message = {
    cardinality: "plural",
    label: "Plugin update",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [
          {
            name: "warning-row",
            status: "skipped",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
          { name: "success-row", status: "available", severity: "info" },
        ],
      },
    ],
  } satisfies Parameters<typeof composeTally>[0];

  // act
  const tally = composeTally(message);

  // assert
  assert.equal(tally, "Plugin update: 1 failure, 1 warning, 1 success");
});

for (const { name, message, expected } of [
  {
    name: "single structural invocation suppresses its tally",
    message: { cardinality: "single", label: "Plugin list", marketplaces: [] },
    expected: "",
  },
  {
    name: "missing operation label suppresses a plural tally",
    message: { cardinality: "plural", marketplaces: [] },
    expected: "",
  },
  {
    name: "empty plural invocation emits zero successes",
    message: { cardinality: "plural", label: "Plugin list", marketplaces: [] },
    expected: "Plugin list: 0 successes",
  },
  {
    name: "positive update override emits its supplied verb",
    message: {
      cardinality: "plural",
      label: "Plugin update",
      marketplaces: [],
      tally: { verb: "updated", count: 2 },
    },
    expected: "Plugin update: 2 updated",
  },
  {
    name: "zero update override contributes no tally",
    message: {
      cardinality: "plural",
      label: "Plugin update",
      marketplaces: [],
      tally: { verb: "updated", count: 0 },
    },
    expected: "",
  },
] as const) {
  test(name, () => {
    // act & assert
    assert.equal(composeTally(message), expected);
  });
}

for (const { name, body, tally, hint, expected } of [
  {
    name: "keeps all fold segments in order",
    body: "body",
    tally: "tally",
    hint: "hint",
    expected: "body\n\ntally\n\nhint",
  },
  {
    name: "omits an empty body",
    body: "",
    tally: "tally",
    hint: "hint",
    expected: "tally\n\nhint",
  },
  { name: "omits an empty tally", body: "body", tally: "", hint: "hint", expected: "body\n\nhint" },
  {
    name: "omits an empty reload hint",
    body: "body",
    tally: "tally",
    hint: "",
    expected: "body\n\ntally",
  },
] as const) {
  test(name, () => {
    // act & assert
    assert.equal(foldTallyAndHint(body, tally, hint), expected);
  });
}

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

for (const { name, message, expected } of [
  {
    name: "marketplace absence emits an error summary",
    message: { kind: "marketplace-not-added", name: "missing" },
    expected: ["A marketplace operation has failed.\n\nbody", "error"],
  },
  {
    name: "failed plugin info emits an error summary",
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
    expected: ["A plugin operation has failed.\n\nbody", "error"],
  },
  {
    name: "available plugin info emits unchanged info bytes",
    message: {
      kind: "plugin-info",
      marketplaceName: "official",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: true },
      plugin: { name: "alpha", status: "available", componentsResolved: false },
    },
    expected: ["body"],
  },
] satisfies readonly {
  readonly name: string;
  readonly message: NotificationMessage;
  readonly expected: readonly unknown[];
}[]) {
  test(name, (t) => {
    // arrange
    const ctx = createContext(t);

    // act
    emitWithSummary(ctx as never, message, "body");

    // assert
    assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, expected);
  });
}

test("mixed warning rows emit a plural summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
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
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations need attention.\n\nbody",
    "warning",
  ]);
});

test("a marketplace-only failure emits a marketplace summary", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        status: "failed",
        severity: "error",
        plugins: [],
      },
    ],
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation has failed.\n\nbody",
    "error",
  ]);
});

test("read-only marketplace info emits unchanged info bytes", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
    kind: "marketplace-info",
    name: "official",
    scope: "user",
    details: { autoupdate: true },
    source: { sourceKind: "path", absPath: "/marketplaces/official" },
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["body"]);
});

test("an unstamped cascade plugin defaults to info severity and success tally", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
    cardinality: "plural",
    label: "Plugin list",
    marketplaces: [
      {
        name: "official",
        scope: "user",
        plugins: [{ name: "alpha", status: "available" }],
      },
    ],
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, composeTally(message));

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["Plugin list: 1 success"]);
});

test("reconcile summary counts mixed failed subjects", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
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
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Some operations have failed.\n\nbody",
    "error",
  ]);
});

test("reconcile summary counts marketplace-only warnings", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = {
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
  } satisfies NotificationMessage;

  // act
  emitWithSummary(ctx as never, message, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A marketplace operation needs attention.\n\nbody",
    "warning",
  ]);
});

test("summary preserves its read-only empty fallback after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = messageWithKindSequence({}, [
    ...Array<string>(6).fill("marketplace-not-added"),
    "marketplace-info",
  ]);

  // act
  emitWithSummary(ctx as never, message as never, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["\n\nbody", "error"]);
});

test("summary preserves its available-plugin empty fallback after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = messageWithKindSequence(
    {
      plugin: { name: "alpha", status: "available", componentsResolved: false },
    },
    [...Array<string>(6).fill("marketplace-not-added"), "marketplace-info", "plugin-info"],
  );

  // act
  emitWithSummary(ctx as never, message as never, "body");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, ["\n\nbody", "error"]);
});

test("severity rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = messageWithKindSequence({}, [
    ...Array<string>(5).fill("marketplace-not-added"),
    "corrupted",
  ]);

  // act & assert
  assert.throws(
    () => {
      emitWithSummary(ctx as never, message as never, "body");
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("summary rejects a discriminator changed after narrowing", (t) => {
  // arrange
  const ctx = createContext(t);
  const message = messageWithKindSequence({}, [
    ...Array<string>(11).fill("marketplace-not-added"),
    "corrupted",
  ]);

  // act & assert
  assert.throws(
    () => {
      emitWithSummary(ctx as never, message as never, "body");
    },
    {
      name: "Error",
      message: "Unexpected value: [object Object]",
    },
  );
});

test("reload decision rejects a discriminator changed after narrowing", () => {
  // arrange
  const message = messageWithKindSequence({}, [
    ...Array<string>(5).fill("marketplace-not-added"),
    "corrupted",
  ]);

  // act & assert
  assert.throws(() => shouldEmitReloadHint(message as never), {
    name: "Error",
    message: "Unexpected value: [object Object]",
  });
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
  emitUpdateNoOpCascade(emptyContext as never, notificationApi(), emptyMessage, renderRow);
  emitUpdateNoOpCascade(bodyContext as never, notificationApi(), bodyMessage, renderRow);

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
  emitReconcileAppliedContextCascade(ctx as never, notificationApi(), message, renderRow);

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "A plugin operation has failed.\n\n● official [user]\n  alpha (failed)\n\nReconcile: 1 failure",
    "error",
  ]);
});
