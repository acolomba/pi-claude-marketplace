import assert from "node:assert/strict";
import test from "node:test";

import { toWirePayload } from "../../extensions/pi-claude-marketplace/shared/notification-json.ts";
import {
  presentCascade,
  presentUpdateNoOp,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type {
  CascadePresentation,
  ReconcileAppliedPresentation,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type {
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRow,
  RowHint,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  MarketplaceStatus,
  PluginNotificationMessage,
  PluginStatus,
  Reason,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

interface ExpectedCause {
  readonly causeChain: readonly string[];
  readonly truncated: boolean;
}

interface ExpectedRow {
  readonly status: PluginStatus;
  readonly name: string;
  readonly id: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly from?: string;
  readonly to?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly partial?: boolean;
  readonly hint?: RowHint;
  readonly cause?: ExpectedCause;
  readonly leaks?: readonly string[];
  readonly rollbackPartial?: readonly { readonly phase: string; readonly cause?: ExpectedCause }[];
}

interface ExpectedBlock {
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: readonly ExpectedRow[];
  readonly status?: MarketplaceStatus;
  readonly details?: { readonly autoupdate: boolean; readonly lastUpdatedAt?: string };
  readonly reasons?: readonly Reason[];
}

const INFO_ENVELOPE: ResolvedEnvelope = { severity: "info", needsReload: false, noOp: false };

function presentationOf(
  marketplaces: readonly ResolvedMarketplace[],
  envelope: ResolvedEnvelope = INFO_ENVELOPE,
): CascadePresentation {
  return { kind: "cascade", envelope, marketplaces };
}

function expectedInfoPayload(marketplaces: readonly ExpectedBlock[]): Record<string, unknown> {
  return { schemaVersion: 1, kind: "cascade", severity: "info", needsReload: false, marketplaces };
}

/** One row of the status table: a resolved row of that status and its wire row. */
interface StatusCase<S extends PluginStatus> {
  readonly row: ResolvedRow<Extract<PluginNotificationMessage, { status: S }>>;
  readonly expected: ExpectedRow;
}

// Every block below is `mp` in user scope, so a row without its own scope
// shows the block's on install-scoped statuses.
const STATUS_CASES: { readonly [S in PluginStatus]: StatusCase<S> } = {
  installed: {
    row: {
      status: "installed",
      name: "alpha",
      severity: "info",
      needsReload: true,
      reasons: [],
      version: "1.0.0",
      scope: "project",
      description: "Alpha.",
    },
    expected: {
      status: "installed",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      scope: "project",
      description: "Alpha.",
    },
  },
  updated: {
    row: {
      status: "updated",
      name: "alpha",
      severity: "info",
      needsReload: true,
      reasons: [],
      from: "1.0.0",
      to: "2.0.0",
    },
    expected: {
      status: "updated",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      from: "1.0.0",
      to: "2.0.0",
      scope: "user",
    },
  },
  reinstalled: {
    row: {
      status: "reinstalled",
      name: "alpha",
      severity: "info",
      needsReload: true,
      reasons: [],
      version: "1.0.0",
    },
    expected: {
      status: "reinstalled",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      scope: "user",
    },
  },
  uninstalled: {
    row: {
      status: "uninstalled",
      name: "alpha",
      severity: "info",
      needsReload: true,
      reasons: ["data kept"],
    },
    expected: {
      status: "uninstalled",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["data kept"],
      scope: "user",
    },
  },
  available: {
    row: {
      status: "available",
      name: "alpha",
      reasons: [],
      version: "1.0.0",
      description: "Alpha.",
    },
    expected: {
      status: "available",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      description: "Alpha.",
    },
  },
  unavailable: {
    row: {
      status: "unavailable",
      name: "alpha",
      reasons: ["unsupported source"],
      hint: "partial-install",
    },
    expected: {
      status: "unavailable",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["unsupported source"],
      hint: "partial-install",
    },
  },
  upgradable: {
    row: {
      status: "upgradable",
      name: "alpha",
      reasons: [],
      version: "1.0.0",
      scope: "project",
    },
    expected: {
      status: "upgradable",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      scope: "project",
    },
  },
  failed: {
    row: {
      status: "failed",
      name: "alpha",
      severity: "error",
      reasons: ["lock held"],
      failure: {
        cause: { causeChain: ["boom", "root"], truncated: true },
        leaks: ["leak"],
        rollbackPartial: [
          { phase: "skills", cause: { causeChain: ["undo"], truncated: false } },
          { phase: "mcp" },
        ],
      },
    },
    expected: {
      status: "failed",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["lock held"],
      scope: "user",
      cause: { causeChain: ["boom", "root"], truncated: true },
      leaks: ["leak"],
      rollbackPartial: [
        { phase: "skills", cause: { causeChain: ["undo"], truncated: false } },
        { phase: "mcp" },
      ],
    },
  },
  skipped: {
    row: {
      status: "skipped",
      name: "alpha",
      reasons: ["up-to-date"],
      version: "1.0.0",
    },
    expected: {
      status: "skipped",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["up-to-date"],
      version: "1.0.0",
      scope: "user",
    },
  },
  "manual recovery": {
    row: {
      status: "manual recovery",
      name: "alpha",
      reasons: ["rollback partial"],
      version: "1.0.0",
      failure: { leaks: ["leak"], rollbackPartial: [] },
    },
    expected: {
      status: "manual recovery",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["rollback partial"],
      scope: "user",
      leaks: ["leak"],
      rollbackPartial: [],
    },
  },
  "will install": {
    row: { status: "will install", name: "alpha", reasons: [], partial: true },
    expected: {
      status: "will install",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      scope: "user",
      partial: true,
    },
  },
  "will uninstall": {
    row: { status: "will uninstall", name: "alpha", reasons: ["plugins remain"] },
    expected: {
      status: "will uninstall",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["plugins remain"],
      scope: "user",
    },
  },
  "will enable": {
    row: { status: "will enable", name: "alpha", reasons: [], scope: "project" },
    expected: {
      status: "will enable",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      scope: "project",
    },
  },
  "will disable": {
    row: { status: "will disable", name: "alpha", reasons: [] },
    expected: { status: "will disable", name: "alpha", id: "alpha@mp", reasons: [], scope: "user" },
  },
  disabled: {
    row: {
      status: "disabled",
      name: "alpha",
      severity: "info",
      needsReload: true,
      reasons: [],
      version: "1.0.0",
      hint: "enable",
    },
    expected: {
      status: "disabled",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      scope: "user",
      hint: "enable",
    },
  },
  "partially-installed": {
    row: {
      status: "partially-installed",
      name: "alpha",
      reasons: ["lsp", "requires pi-subagents"],
      version: "1.0.0",
    },
    expected: {
      status: "partially-installed",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["lsp", "requires pi-subagents"],
      version: "1.0.0",
      scope: "user",
    },
  },
  "partially-upgradable": {
    row: {
      status: "partially-upgradable",
      name: "alpha",
      reasons: ["lsp"],
      version: "1.0.0",
      hint: "partial-update",
    },
    expected: {
      status: "partially-upgradable",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["lsp"],
      version: "1.0.0",
      scope: "user",
      hint: "partial-update",
    },
  },
  "partially-available": {
    row: {
      status: "partially-available",
      name: "alpha",
      reasons: ["lsp"],
      version: "1.0.0",
    },
    expected: {
      status: "partially-available",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["lsp"],
      version: "1.0.0",
    },
  },
  remote: {
    row: { status: "remote", name: "alpha", reasons: [], version: "1.0.0" },
    expected: {
      status: "remote",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
    },
  },
};

for (const [status, { row, expected }] of Object.entries(STATUS_CASES)) {
  test(`converts a ${status} row field by field`, () => {
    // arrange
    const presentation = presentationOf([{ name: "mp", scope: "user", plugins: [row] }]);

    // act
    const payload = toWirePayload(presentation);

    // assert
    assert.deepStrictEqual(
      payload,
      expectedInfoPayload([{ name: "mp", scope: "user", plugins: [expected] }]),
    );
  });
}

for (const { title, envelope, expectedEnvelope } of [
  {
    title: "emits an info envelope without a summary",
    envelope: { severity: "info", needsReload: true, noOp: false },
    expectedEnvelope: { severity: "info", needsReload: true },
  },
  {
    title: "emits a warning envelope with its summary",
    envelope: { severity: "warning", summary: "Heads up.", needsReload: false, noOp: false },
    expectedEnvelope: { severity: "warning", summary: "Heads up.", needsReload: false },
  },
  {
    title: "emits an error envelope with an empty summary",
    envelope: { severity: "error", summary: "", needsReload: false, noOp: false },
    expectedEnvelope: { severity: "error", summary: "", needsReload: false },
  },
  {
    title: "emits a tally without a success category",
    envelope: {
      severity: "info",
      needsReload: false,
      noOp: false,
      tally: { label: "Plugin install", failures: 0, warnings: 1 },
    },
    expectedEnvelope: {
      severity: "info",
      needsReload: false,
      tally: { label: "Plugin install", failures: 0, warnings: 1 },
    },
  },
  {
    title: "emits a tally whose success category has no verb",
    envelope: {
      severity: "info",
      needsReload: false,
      noOp: false,
      tally: { label: "Plugin install", failures: 0, warnings: 0, success: { count: 2 } },
    },
    expectedEnvelope: {
      severity: "info",
      needsReload: false,
      tally: { label: "Plugin install", failures: 0, warnings: 0, success: { count: 2 } },
    },
  },
  {
    title: "emits a tally whose success category has a verb",
    envelope: {
      severity: "info",
      needsReload: false,
      noOp: false,
      tally: {
        label: "Plugin update",
        failures: 0,
        warnings: 0,
        success: { count: 3, verb: "updated" },
      },
    },
    expectedEnvelope: {
      severity: "info",
      needsReload: false,
      tally: {
        label: "Plugin update",
        failures: 0,
        warnings: 0,
        success: { count: 3, verb: "updated" },
      },
    },
  },
  {
    title: "emits noOp true for a no-op envelope",
    envelope: { severity: "info", needsReload: false, noOp: true },
    expectedEnvelope: { severity: "info", needsReload: false, noOp: true },
  },
] satisfies readonly {
  title: string;
  envelope: ResolvedEnvelope;
  expectedEnvelope: Record<string, unknown>;
}[]) {
  test(title, () => {
    // arrange
    const presentation = presentationOf([], envelope);

    // act
    const payload = toWirePayload(presentation);

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      kind: "cascade",
      ...expectedEnvelope,
      marketplaces: [],
    });
  });
}

for (const { title, block, expectedBlock } of [
  {
    title: "emits a block's status and reasons when the model has them",
    block: {
      name: "mp",
      scope: "user",
      status: "failed",
      severity: "error",
      reasons: ["unreadable"],
      plugins: [],
    },
    expectedBlock: {
      name: "mp",
      scope: "user",
      status: "failed",
      reasons: ["unreadable"],
      plugins: [],
    },
  },
  {
    title: "leaves a block's reasons absent when the model has none",
    block: { name: "mp", scope: "project", status: "skipped", plugins: [] },
    expectedBlock: { name: "mp", scope: "project", status: "skipped", plugins: [] },
  },
  {
    title: "emits a list block without a status, keeping its details timestamp",
    block: {
      name: "mp",
      scope: "user",
      details: { autoupdate: true, lastUpdatedAt: "2026-10-03T00:00:00.000Z" },
      plugins: [],
    },
    expectedBlock: {
      name: "mp",
      scope: "user",
      details: { autoupdate: true, lastUpdatedAt: "2026-10-03T00:00:00.000Z" },
      plugins: [],
    },
  },
  {
    title: "emits list details without a timestamp when the model has none",
    block: { name: "mp", scope: "user", details: { autoupdate: false }, plugins: [] },
    expectedBlock: { name: "mp", scope: "user", details: { autoupdate: false }, plugins: [] },
  },
  {
    title: "emits a multi-word marketplace status verbatim",
    block: { name: "mp", scope: "user", status: "autoupdate enabled", plugins: [] },
    expectedBlock: { name: "mp", scope: "user", status: "autoupdate enabled", plugins: [] },
  },
] satisfies readonly {
  title: string;
  block: ResolvedMarketplace;
  expectedBlock: ExpectedBlock;
}[]) {
  test(title, () => {
    // arrange
    const presentation = presentationOf([block]);

    // act
    const payload = toWirePayload(presentation);

    // assert
    assert.deepStrictEqual(payload, expectedInfoPayload([expectedBlock]));
  });
}

test("copies advisories and retained workflows, with and without an envelope count", () => {
  // arrange
  const presentation: CascadePresentation = {
    ...presentationOf([]),
    advisories: ["first", "second"],
    retainedWorkflows: [{ name: "wf-a", envelopeCount: 2 }, { name: "wf-b" }],
  };

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, {
    ...expectedInfoPayload([]),
    advisories: ["first", "second"],
    retainedWorkflows: [{ name: "wf-a", envelopeCount: 2 }, { name: "wf-b" }],
  });
});

test("keeps empty advisory and retained-workflow lists as empty arrays", () => {
  // arrange
  const presentation: CascadePresentation = {
    ...presentationOf([]),
    advisories: [],
    retainedWorkflows: [],
  };

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, {
    ...expectedInfoPayload([]),
    advisories: [],
    retainedWorkflows: [],
  });
});

test("gives each of two adjacent rows its own explicit scope", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "mp",
      scope: "user",
      plugins: [
        { status: "will enable", name: "alpha", reasons: [] },
        { status: "will enable", name: "bravo", reasons: [], scope: "project" },
      ],
    },
  ]);

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "mp",
        scope: "user",
        plugins: [
          { status: "will enable", name: "alpha", id: "alpha@mp", reasons: [], scope: "user" },
          { status: "will enable", name: "bravo", id: "bravo@mp", reasons: [], scope: "project" },
        ],
      },
    ]),
  );
});

test("keeps blocks and rows in model order when it is not alphabetical", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "zeta",
      scope: "user",
      plugins: [
        { status: "remote", name: "zulu", reasons: [] },
        { status: "remote", name: "alpha", reasons: [] },
      ],
    },
    { name: "alpha", scope: "project", plugins: [] },
  ]);

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "zeta",
        scope: "user",
        plugins: [
          { status: "remote", name: "zulu", id: "zulu@zeta", reasons: [] },
          { status: "remote", name: "alpha", id: "alpha@zeta", reasons: [] },
        ],
      },
      { name: "alpha", scope: "project", plugins: [] },
    ]),
  );
});

test("joins an scp-style marketplace name into the id verbatim", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "git@github.com:foo/bar.git",
      scope: "user",
      plugins: [{ status: "available", name: "alpha", reasons: [] }],
    },
  ]);

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "git@github.com:foo/bar.git",
        scope: "user",
        plugins: [
          {
            status: "available",
            name: "alpha",
            id: "alpha@git@github.com:foo/bar.git",
            reasons: [],
          },
        ],
      },
    ]),
  );
});

test("keeps content reasons before markers, one multi-word token per element", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "mp",
      scope: "user",
      plugins: [
        {
          status: "installed",
          name: "alpha",
          severity: "info",
          needsReload: true,
          reasons: ["unsupported hooks", "requires pi-subagents", "requires pi-mcp"],
        },
      ],
    },
  ]);

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            id: "alpha@mp",
            reasons: ["unsupported hooks", "requires pi-subagents", "requires pi-mcp"],
            scope: "user",
          },
        ],
      },
    ]),
  );
});

/** Collects the path of every own property whose value is `undefined` or `null`. */
function nullishPaths(value: unknown, path: string): string[] {
  if (value === undefined || value === null) {
    return [path];
  }

  if (typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, child]) => nullishPaths(child, `${path}/${key}`));
}

test("produces a payload that survives a JSON round trip with no undefined or null value", () => {
  // arrange
  const presentation: CascadePresentation = {
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
        plugins: [STATUS_CASES.failed.row, STATUS_CASES["manual recovery"].row],
      },
    ],
    retainedWorkflows: [{ name: "wf" }],
  };

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(JSON.parse(JSON.stringify(payload)), payload);
  assert.deepStrictEqual(nullishPaths(payload, ""), []);
});

test("emits kind cascade for a presentation built from a message without a kind", () => {
  // arrange
  const presentation = presentCascade(runWithNothingLoaded(), { marketplaces: [] }, {});

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, expectedInfoPayload([]));
});

function reconcileBlock(): ResolvedMarketplace {
  return {
    name: "mp",
    scope: "user",
    plugins: [
      { status: "installed", name: "alpha", severity: "info", needsReload: false, reasons: [] },
    ],
  };
}

function expectedReconcileBlock(): ExpectedBlock {
  return {
    name: "mp",
    scope: "user",
    plugins: [{ status: "installed", name: "alpha", id: "alpha@mp", reasons: [], scope: "user" }],
  };
}

test("emits a reconcile-applied payload with its tally and no noOp", () => {
  // arrange
  const presentation: ReconcileAppliedPresentation = {
    kind: "reconcile-applied-cascade",
    envelope: {
      severity: "info",
      needsReload: false,
      noOp: false,
      tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
    },
    marketplaces: [reconcileBlock()],
  };

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "reconcile-applied-cascade",
    severity: "info",
    needsReload: false,
    tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
    marketplaces: [expectedReconcileBlock()],
  });
});

test("emits a reconcile-applied payload without a tally and with its summary", () => {
  // arrange
  const presentation: ReconcileAppliedPresentation = {
    kind: "reconcile-applied-cascade",
    envelope: { severity: "warning", summary: "Heads up.", needsReload: false, noOp: false },
    marketplaces: [reconcileBlock()],
  };

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "reconcile-applied-cascade",
    severity: "warning",
    summary: "Heads up.",
    needsReload: false,
    marketplaces: [expectedReconcileBlock()],
  });
});

test("emits noOp true with no tally and no reload for an update no-op presentation", () => {
  // arrange
  const presentation = presentUpdateNoOp(
    runWithNothingLoaded(),
    {
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
      label: "Plugin update",
      cardinality: "plural",
    },
    { installed: { markers: false, contentReasons: true } },
  );

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "cascade",
    severity: "info",
    needsReload: false,
    noOp: true,
    marketplaces: [expectedReconcileBlock()],
  });
});

/** A warning cascade whose summary no composer would write, so a copy is provable. */
function warningPresentation(): CascadePresentation {
  return {
    kind: "cascade",
    envelope: { severity: "warning", summary: "Verbatim summary.", needsReload: true, noOp: false },
    marketplaces: [reconcileBlock()],
    advisories: ["advice"],
  };
}

function expectedWarningPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "cascade",
    severity: "warning",
    summary: "Verbatim summary.",
    needsReload: true,
    marketplaces: [expectedReconcileBlock()],
    advisories: ["advice"],
  };
}

function expectedReconcilePayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "reconcile-applied-cascade",
    severity: "info",
    needsReload: false,
    marketplaces: [expectedReconcileBlock()],
  };
}

function reconcilePresentation(): ReconcileAppliedPresentation {
  return {
    kind: "reconcile-applied-cascade",
    envelope: { severity: "info", needsReload: false, noOp: false },
    marketplaces: [reconcileBlock()],
  };
}

test("converts one presentation twice into equal payloads that share no object", () => {
  // arrange
  const presentation = warningPresentation();

  // act
  const first = toWirePayload(presentation);
  const second = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual([first, second], [expectedWarningPayload(), expectedWarningPayload()]);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.marketplaces, second.marketplaces);
  assert.notStrictEqual(first.marketplaces[0], second.marketplaces[0]);
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const member of Object.values(value)) {
      deepFreeze(member);
    }

    Object.freeze(value);
  }

  return value;
}

test("converts a deep-frozen presentation and leaves it unchanged", () => {
  // arrange
  const presentation = deepFreeze(warningPresentation());
  const before = structuredClone(presentation);

  // act
  const payload = toWirePayload(presentation);

  // assert
  assert.deepStrictEqual(payload, expectedWarningPayload());
  assert.deepStrictEqual(presentation, before);
});

test("interleaved conversions of two presentations match each converted alone", () => {
  // arrange
  const warning = warningPresentation();
  const reconcile = reconcilePresentation();

  // act
  const payloads = [warning, reconcile, warning, reconcile].map((presentation) =>
    toWirePayload(presentation),
  );

  // assert
  assert.deepStrictEqual(payloads, [
    expectedWarningPayload(),
    expectedReconcilePayload(),
    expectedWarningPayload(),
    expectedReconcilePayload(),
  ]);
});
