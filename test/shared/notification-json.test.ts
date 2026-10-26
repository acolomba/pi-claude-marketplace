import assert from "node:assert/strict";
import test from "node:test";

import { Compile } from "typebox/compile";

import { resolveCommandError } from "../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";
import {
  toWireMarketplaces,
  toWirePayload,
} from "../../extensions/pi-claude-marketplace/shared/notification-json.ts";
import {
  presentCascade,
  presentUpdateNoOp,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import { runWithNothingLoaded } from "./notification-run-seeds.ts";

import type { CommandErrorPresentation } from "../../extensions/pi-claude-marketplace/shared/notification-command-error.ts";
import type {
  CascadePresentation,
  NotificationPresentation,
  ReconcileAppliedPresentation,
} from "../../extensions/pi-claude-marketplace/shared/notification-present.ts";
import type {
  ResolvedEnvelope,
  ResolvedMarketplace,
  ResolvedRawSurface,
  ResolvedRow,
  RowHint,
} from "../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import type {
  MarketplaceInfoMessage,
  MarketplaceStatus,
  PluginInfoMessage,
  PluginNotificationMessage,
  PluginStatus,
  Reason,
} from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../extensions/pi-claude-marketplace/shared/types.ts";

function assertSafeCommandPayload(payload: unknown, expectedCauseChain: readonly string[]): void {
  if (typeof payload === "string") {
    assert.doesNotMatch(payload, /secret123|user:private|ghp_abcdefghijklmnop/);
    for (const disclosure of [
      "private",
      "Private Data",
      "用户",
      "秘密",
      "server",
      "file:/",
      "Confidential Client",
      "Connor",
    ]) {
      assert.strictEqual(payload.includes(disclosure), false, `Disclosed ${disclosure}`);
    }

    return;
  }

  if (typeof payload === "boolean") {
    return;
  }

  if (typeof payload === "number") {
    assert.ok(Number.isFinite(payload));
    return;
  }

  assert.ok(payload !== null && typeof payload === "object");
  assert.ok(Array.isArray(payload) || Object.getPrototypeOf(payload) === Object.prototype);
  assert.deepStrictEqual(Object.getOwnPropertySymbols(payload), []);
  for (const [key, member] of Object.entries(payload)) {
    assert.notStrictEqual(key, "stack");
    if (key === "causeChain") {
      assert.deepStrictEqual(member, expectedCauseChain);
    }

    assertSafeCommandPayload(member, expectedCauseChain);
  }
}

for (const { message, safeMessage } of [
  { message: String.raw`open '\Users\ClientLedger\secret.json'`, safeMessage: "open '[path]'" },
  { message: String.raw`\PrivateVault\secret.json`, safeMessage: "[path]" },
  {
    message: String.raw`open '\Users\O'ClientLedger\secret.json'`,
    safeMessage: "Command failure details omitted.",
  },
  {
    message: "open '\\Users\\\nClientLedger\\secret.json'",
    safeMessage: "Command failure details omitted.",
  },
]) {
  test(`converts current-drive roots with exact disclosure controls: ${JSON.stringify(message)}`, () => {
    // arrange
    const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" } as const;
    const presentation = resolveCommandError(new Error(message), false);
    const expected = {
      schemaVersion: 1,
      kind: "internal-error",
      origin,
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: [safeMessage], truncated: false },
    };

    // act
    const payload = toWirePayload(presentation, origin);

    // assert
    assert.deepStrictEqual(payload, expected);
    assertSafeCommandPayload(payload, [safeMessage]);
    for (const disclosure of [message, "open '[path]ClientLedger[path]'"]) {
      const planted = { ...expected, cause: { causeChain: [disclosure], truncated: false } };
      assert.throws(() => {
        assertSafeCommandPayload(planted, [safeMessage]);
      }, assert.AssertionError);
    }
  });
}

test("converts hostile command causes to schema-valid disclosure-safe plain JSON", () => {
  // arrange
  const cause = new Error("https://user:private@host/repo Bearer secret123 ghp_abcdefghijklmnop", {
    cause: new Error(
      "/private/work/config.json C:\\private\\work\\config.json \\\\server file:///private/work/config.json file:/private/work/config.json",
      {
        cause: new Error(
          'open "/Private Data/client/secret.json" and "/用户/秘密/config.json" and "C:\\Private Data\\client\\secret.json"; failed at:/private/work/config.json',
        ),
      },
    ),
  });
  const presentation = resolveCommandError(cause, true);
  const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" } as const;
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

  // act
  const payload = toWirePayload(presentation, origin);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "internal-error",
    origin,
    severity: "error",
    needsReload: true,
    summary: "Command failed unexpectedly.",
    cause: {
      causeChain: [
        "https://***@host/repo Bearer *** ***",
        "[path]",
        "Command failure details omitted.",
      ],
      truncated: false,
    },
  });
  assert.strictEqual(validator.Check(payload), true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(payload)), payload);
  assertSafeCommandPayload(payload, [
    "https://***@host/repo Bearer *** ***",
    "[path]",
    "Command failure details omitted.",
  ]);
});

for (const message of [
  "ENOENT: no such file or directory, open '/tmp/review-absent/'Confidential Client'/secret.json'",
  "ENOENT: no such file or directory, open '/tmp/review-absent/O'Connor/secret.json'",
  "ENOENT: no such file or directory, open '/tmp/review-absent/\nConfidential Client/secret.json'",
  "failed at /Users/<Confidential Client>/secret.json",
]) {
  test(`converts ambiguous path details safely for ${JSON.stringify(message)}`, () => {
    // arrange
    const presentation = resolveCommandError(new Error(message), true);
    const origin = { kind: "command", commandId: "plugin update", invocationId: "run-a" } as const;
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

    // act
    const payload = toWirePayload(presentation, origin);

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      kind: "internal-error",
      origin,
      severity: "error",
      needsReload: true,
      summary: "Command failed unexpectedly.",
      cause: { causeChain: ["Command failure details omitted."], truncated: false },
    });
    assert.strictEqual(validator.Check(payload), true);
    assertSafeCommandPayload(payload, ["Command failure details omitted."]);
  });
}

for (const { title, cause } of [
  {
    title: "quoted directory suffix",
    cause: { causeChain: ["open '[path]'Confidential Client'[path]'"], truncated: false },
  },
  {
    title: "apostrophe directory suffix",
    cause: { causeChain: ["open '[path]'Connor[path]'"], truncated: false },
  },
  {
    title: "newline directory suffix",
    cause: { causeChain: ["open '[path]\nConfidential Client[path]'"], truncated: false },
  },
  {
    title: "angle-bracket directory suffix",
    cause: { causeChain: ["failed at [path]<Confidential Client>[path]"], truncated: false },
  },
  { title: "credentials", cause: { causeChain: ["Bearer secret123"], truncated: false } },
  { title: "POSIX path", cause: { causeChain: ["/private/work/config.json"], truncated: false } },
  { title: "Windows path", cause: { causeChain: ["C:\\private\\config.json"], truncated: false } },
  { title: "bare UNC root", cause: { causeChain: ["\\\\server"], truncated: false } },
  { title: "file URL", cause: { causeChain: ["file:/private/config.json"], truncated: false } },
  {
    title: "spaced POSIX path",
    cause: { causeChain: ["/Private Data/client/secret.json"], truncated: false },
  },
  { title: "Unicode path", cause: { causeChain: ["/用户/秘密/config.json"], truncated: false } },
  {
    title: "spaced Windows path",
    cause: { causeChain: ["C:\\Private Data\\client\\secret.json"], truncated: false },
  },
  {
    title: "colon-prefixed path",
    cause: { causeChain: ["failed at:/private/work/config.json"], truncated: false },
  },
  {
    title: "partially masked path",
    cause: { causeChain: ["[path] Data/秘密/config.json"], truncated: false },
  },
  { title: "live Error", cause: new Error("failed") },
  { title: "stack", cause: { causeChain: ["failed"], truncated: false, stack: "private" } },
  { title: "null member", cause: null },
  { title: "undefined member", cause: undefined },
  { title: "function member", cause: () => "private" },
  { title: "symbol member", cause: Symbol("private") },
  { title: "nonfinite number", cause: Infinity },
  { title: "symbol key", cause: { [Symbol("private")]: "private" } },
]) {
  test(`the command payload disclosure check rejects planted ${title}`, () => {
    // arrange
    const payload = {
      schemaVersion: 1,
      kind: "internal-error",
      origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
      severity: "error",
      needsReload: false,
      summary: "Command failed unexpectedly.",
      cause,
    };

    // act & assert
    assert.throws(() => {
      assertSafeCommandPayload(payload, ["operation failed"]);
    }, assert.AssertionError);
  });
}

test("projects complete internal-error facts without undeclared properties", () => {
  // arrange
  const presentation = {
    kind: "internal-error",
    severity: "error",
    needsReload: true,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["failed", "nested"], truncated: true, stack: "private" },
    stack: "private",
  } as const satisfies CommandErrorPresentation & {
    readonly stack: string;
    readonly cause: { readonly stack: string };
  };
  const origin = {
    kind: "command",
    commandId: "plugin update",
    invocationId: "run-a",
    alias: "ignored",
  } as const;

  // act
  const payload = toWirePayload(presentation, origin);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "internal-error",
    origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
    severity: "error",
    needsReload: true,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["failed", "nested"], truncated: true },
  });
  assert.notStrictEqual(payload.cause, presentation.cause);
});

test("rejects a non-command internal-error projection", () => {
  // arrange
  const presentation: CommandErrorPresentation = {
    kind: "internal-error",
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["failed"], truncated: false },
  };

  // act & assert
  assert.throws(() => {
    // @ts-expect-error Internal errors require a command origin.
    toWirePayload(presentation, { kind: "load" });
  }, TypeError);
});

for (const kind of ["load", "hook"] as const) {
  test(`projects only ${kind} origin fields`, () => {
    // arrange
    const origin = { kind, commandId: "plugin list", invocationId: "do-not-copy", alias: "ls" };

    // act
    const payload = toWirePayload({ kind: "usage-info", usage: "Usage" }, origin);

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      kind: "usage-info",
      severity: "info",
      needsReload: false,
      origin: { kind },
      usage: "Usage",
    });
  });
}

test("projects only command identity fields", () => {
  // arrange
  const origin = {
    kind: "command",
    commandId: "plugin list",
    invocationId: "run-a",
    alias: "ls",
  } as const;

  // act
  const payload = toWirePayload({ kind: "usage-info", usage: "Usage" }, origin);

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "usage-info",
    severity: "info",
    needsReload: false,
    origin: { kind: "command", commandId: "plugin list", invocationId: "run-a" },
    usage: "Usage",
  });
});

test("projects marketplace blocks for tools without an envelope", () => {
  // arrange
  const marketplaces: ResolvedMarketplace[] = [{ name: "demo", scope: "project", plugins: [] }];

  // act
  const blocks = toWireMarketplaces(marketplaces);

  // assert
  assert.deepStrictEqual(blocks, [{ name: "demo", scope: "project", plugins: [] }]);
});

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
  readonly fromCommit?: string;
  readonly toCommit?: string;
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

const INFO_ENVELOPE: ResolvedEnvelope = {
  severity: "info",
  needsReload: false,
  needsApply: false,
  noOp: false,
};

function presentationOf(
  marketplaces: readonly ResolvedMarketplace[],
  envelope: ResolvedEnvelope = INFO_ENVELOPE,
): CascadePresentation {
  return { kind: "cascade", envelope, marketplaces };
}

function expectedInfoPayload(marketplaces: readonly ExpectedBlock[]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "cascade",
    severity: "info",
    needsReload: false,
    marketplaces,
  };
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
    row: { status: "will uninstall", name: "alpha", version: "1.2.0", reasons: ["plugins remain"] },
    expected: {
      status: "will uninstall",
      name: "alpha",
      id: "alpha@mp",
      version: "1.2.0",
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
  "will update": {
    row: {
      status: "will update",
      name: "alpha",
      reasons: [],
      from: "1.0.0",
      to: "1.0.0",
      commits: { from: "a".repeat(40), to: "b".repeat(40) },
    },
    expected: {
      status: "will update",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      from: "1.0.0",
      to: "1.0.0",
      fromCommit: "a".repeat(40),
      toCommit: "b".repeat(40),
      scope: "user",
    },
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
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(
      payload,
      expectedInfoPayload([{ name: "mp", scope: "user", plugins: [expected] }]),
    );
  });
}

test("UPR-02: an updated row with commits carries them whole as fromCommit and toCommit", () => {
  // arrange
  const fromCommit = "a".repeat(40);
  const toCommit = "b".repeat(40);
  const row: ResolvedRow = {
    status: "updated",
    name: "ghp",
    severity: "info",
    needsReload: true,
    reasons: [],
    from: "1.0.0",
    to: "1.0.0",
    commits: { from: fromCommit, to: toCommit },
  };
  const presentation = presentationOf([{ name: "mp", scope: "user", plugins: [row] }]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "mp",
        scope: "user",
        plugins: [
          {
            status: "updated",
            name: "ghp",
            id: "ghp@mp",
            reasons: [],
            from: "1.0.0",
            to: "1.0.0",
            fromCommit,
            toCommit,
            scope: "user",
          },
        ],
      },
    ]),
  );
});

test("D-10-13: an updated row's constraint disclosure rides the wire as its cause", () => {
  // arrange
  const disclosure = 'constrained to the combined range (^1.0.0) -- required by "app@tools"';
  const row: ResolvedRow = {
    status: "updated",
    name: "lib",
    severity: "info",
    needsReload: true,
    reasons: [],
    from: "1.0.0",
    to: "1.1.0",
    failure: {
      cause: { causeChain: [disclosure], truncated: false },
      leaks: [],
      rollbackPartial: [],
    },
  };
  const presentation = presentationOf([{ name: "tools", scope: "project", plugins: [row] }]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "tools",
        scope: "project",
        plugins: [
          {
            status: "updated",
            name: "lib",
            id: "lib@tools",
            reasons: [],
            from: "1.0.0",
            to: "1.1.0",
            scope: "project",
            cause: { causeChain: [disclosure], truncated: false },
            leaks: [],
            rollbackPartial: [],
          },
        ],
      },
    ]),
  );
});

const MOVE_WIRE_ROWS = [
  {
    row: {
      status: "reinstalled",
      name: "ghp",
      severity: "info",
      needsReload: true,
      reasons: [],
      version: "1.0.0",
    },
    reasons: [],
  },
  {
    row: {
      status: "partially-installed",
      name: "ghp",
      severity: "info",
      needsReload: true,
      reasons: ["unsupported component"],
      version: "1.0.0",
    },
    reasons: ["unsupported component"],
  },
  {
    row: {
      status: "failed",
      name: "ghp",
      severity: "error",
      reasons: ["lock held"],
      version: "1.0.0",
    },
    reasons: ["lock held"],
  },
] as const satisfies readonly { readonly row: ResolvedRow; readonly reasons: readonly Reason[] }[];

for (const { row, reasons } of MOVE_WIRE_ROWS) {
  test(`UPR-02 / UPR-03: a ${row.status} row that moved carries from and its commits beside version`, () => {
    // arrange
    const fromCommit = "a".repeat(40);
    const toCommit = "b".repeat(40);
    const moved: ResolvedRow = {
      ...row,
      from: "1.0.0",
      commits: { from: fromCommit, to: toCommit },
    };
    const presentation = presentationOf([{ name: "mp", scope: "user", plugins: [moved] }]);

    // act
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(
      payload,
      expectedInfoPayload([
        {
          name: "mp",
          scope: "user",
          plugins: [
            {
              status: row.status,
              name: "ghp",
              id: "ghp@mp",
              reasons,
              version: "1.0.0",
              from: "1.0.0",
              fromCommit,
              toCommit,
              scope: "user",
            },
          ],
        },
      ]),
    );
  });
}

for (const { title, envelope, expectedEnvelope } of [
  {
    title: "emits an info envelope without a summary",
    envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
    expectedEnvelope: { severity: "info", needsReload: true },
  },
  {
    title: "emits a warning envelope with its summary",
    envelope: {
      severity: "warning",
      summary: "Heads up.",
      needsReload: false,
      needsApply: false,
      noOp: false,
    },
    expectedEnvelope: { severity: "warning", summary: "Heads up.", needsReload: false },
  },
  {
    title: "emits an error envelope with an empty summary",
    envelope: {
      severity: "error",
      summary: "",
      needsReload: false,
      needsApply: false,
      noOp: false,
    },
    expectedEnvelope: { severity: "error", summary: "", needsReload: false },
  },
  {
    title: "emits a tally without a success category",
    envelope: {
      severity: "info",
      needsReload: false,
      needsApply: false,
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
      needsApply: false,
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
      needsApply: false,
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
    envelope: { severity: "info", needsReload: false, needsApply: false, noOp: true },
    expectedEnvelope: { severity: "info", needsReload: false, noOp: true },
  },
  {
    title: "APL-04 / D-14: emits needsApply true when the envelope needs apply",
    envelope: { severity: "info", needsReload: false, needsApply: true, noOp: false },
    expectedEnvelope: { severity: "info", needsReload: false, needsApply: true },
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
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
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
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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

test("keeps a cascade row named by its plugin key as the id instead of appending the block name", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "upstream",
      scope: "user",
      plugins: [{ status: "available", name: "lib@tools", reasons: [] }],
    },
  ]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "upstream",
        scope: "user",
        plugins: [{ status: "available", name: "lib@tools", id: "lib@tools", reasons: [] }],
      },
    ]),
  );
});

test("gives a failed row whose subject is a marketplace its name alone as the id", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "https://git.example/acme/tools.git",
      scope: "project",
      status: "failed",
      severity: "error",
      plugins: [
        {
          status: "failed",
          name: "https://git.example/acme/tools.git",
          reasons: ["network error"],
          marketplaceSubject: true,
          severity: "error",
          needsReload: false,
        },
      ],
    },
  ]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "https://git.example/acme/tools.git",
        scope: "project",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "https://git.example/acme/tools.git",
            id: "https://git.example/acme/tools.git",
            reasons: ["network error"],
            scope: "project",
          },
        ],
      },
    ]),
  );
});

test("appends the block name to a failed row named like its block without the marketplace marker", () => {
  // arrange
  const presentation = presentationOf([
    {
      name: "https://git.example/acme/tools.git",
      scope: "project",
      status: "failed",
      severity: "error",
      plugins: [
        {
          status: "failed",
          name: "https://git.example/acme/tools.git",
          reasons: ["network error"],
          severity: "error",
          needsReload: false,
        },
      ],
    },
  ]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(
    payload,
    expectedInfoPayload([
      {
        name: "https://git.example/acme/tools.git",
        scope: "project",
        status: "failed",
        plugins: [
          {
            status: "failed",
            name: "https://git.example/acme/tools.git",
            id: "https://git.example/acme/tools.git@https://git.example/acme/tools.git",
            reasons: ["network error"],
            scope: "project",
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
          reasons: ["unsupported hooks", "requires pi-subagents", "requires pi-mcp-adapter"],
        },
      ],
    },
  ]);

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
            reasons: ["unsupported hooks", "requires pi-subagents", "requires pi-mcp-adapter"],
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
      needsApply: false,
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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(JSON.parse(JSON.stringify(payload)), payload);
  assert.deepStrictEqual(nullishPaths(payload, ""), []);
});

test("emits kind cascade for a presentation built from a message without a kind", () => {
  // arrange
  const presentation = presentCascade(runWithNothingLoaded(), { marketplaces: [] }, {});

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
      needsApply: false,
      noOp: false,
      tally: { label: "Reconcile", failures: 0, warnings: 0, success: { count: 1 } },
    },
    marketplaces: [reconcileBlock()],
  };

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
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
    envelope: {
      severity: "warning",
      summary: "Heads up.",
      needsReload: false,
      needsApply: false,
      noOp: false,
    },
    marketplaces: [reconcileBlock()],
  };

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
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
    envelope: {
      severity: "warning",
      summary: "Verbatim summary.",
      needsReload: true,
      needsApply: false,
      noOp: false,
    },
    marketplaces: [reconcileBlock()],
    advisories: ["advice"],
  };
}

function expectedWarningPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
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
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "reconcile-applied-cascade",
    severity: "info",
    needsReload: false,
    marketplaces: [expectedReconcileBlock()],
  };
}

function reconcilePresentation(): ReconcileAppliedPresentation {
  return {
    kind: "reconcile-applied-cascade",
    envelope: { severity: "info", needsReload: false, needsApply: false, noOp: false },
    marketplaces: [reconcileBlock()],
  };
}

test("converts one presentation twice into equal payloads that share no object", () => {
  // arrange
  const presentation = warningPresentation();

  // act
  const first = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  const second = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

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
    toWirePayload(presentation, { kind: "command", commandId: "plugin", invocationId: "test-run" }),
  );

  // assert
  assert.deepStrictEqual(payloads, [
    expectedWarningPayload(),
    expectedReconcilePayload(),
    expectedWarningPayload(),
    expectedReconcilePayload(),
  ]);
});

function infoEnvelope(): ResolvedEnvelope {
  return { severity: "info", needsReload: false, needsApply: false, noOp: false };
}

function githubMarketplaceInfo(): MarketplaceInfoMessage {
  return {
    kind: "marketplace-info",
    name: "mp",
    scope: "user",
    details: { autoupdate: false },
    source: { sourceKind: "github", owner: "acme", repo: "mp" },
  };
}

function unresolvedPluginInfo(): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "available", name: "alpha", componentsResolved: false },
  };
}

for (const { title, source, expectedSource } of [
  {
    title: "a github source without a ref",
    source: { sourceKind: "github", owner: "acme", repo: "mp" },
    expectedSource: { sourceKind: "github", owner: "acme", repo: "mp" },
  },
  {
    title: "a github source with a ref",
    source: { sourceKind: "github", owner: "acme", repo: "mp", ref: "v1" },
    expectedSource: { sourceKind: "github", owner: "acme", repo: "mp", ref: "v1" },
  },
  {
    title: "a url source without a ref",
    source: { sourceKind: "url", url: "https://git.example/mp.git" },
    expectedSource: { sourceKind: "url", url: "https://git.example/mp.git" },
  },
  {
    title: "a url source with a ref",
    source: { sourceKind: "url", url: "https://git.example/mp.git", ref: "main" },
    expectedSource: { sourceKind: "url", url: "https://git.example/mp.git", ref: "main" },
  },
  {
    title: "a path source",
    source: { sourceKind: "path", absPath: "/srv/mp" },
    expectedSource: { sourceKind: "path", absPath: "/srv/mp" },
  },
] satisfies readonly {
  title: string;
  source: MarketplaceInfoMessage["source"];
  expectedSource: Record<string, unknown>;
}[]) {
  test(`converts a marketplace-info presentation with ${title}`, () => {
    // arrange
    const presentation = {
      kind: "marketplace-info",
      envelope: infoEnvelope(),
      message: { ...githubMarketplaceInfo(), source },
    } satisfies NotificationPresentation;

    // act
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "marketplace-info",
      severity: "info",
      needsReload: false,
      name: "mp",
      scope: "user",
      details: { autoupdate: false },
      source: expectedSource,
    });
  });
}

test("converts a marketplace-info presentation with every optional field", () => {
  // arrange
  const presentation = {
    kind: "marketplace-info",
    envelope: infoEnvelope(),
    message: {
      ...githubMarketplaceInfo(),
      scope: "project",
      details: { autoupdate: true, lastUpdatedAt: "2026-01-02T03:04:05.000Z" },
      source: { sourceKind: "path", absPath: "/srv/mp" },
      description: "Tools",
      allowedMarketplaces: ["other", "third"],
    },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "marketplace-info",
    severity: "info",
    needsReload: false,
    name: "mp",
    scope: "project",
    details: { autoupdate: true, lastUpdatedAt: "2026-01-02T03:04:05.000Z" },
    source: { sourceKind: "path", absPath: "/srv/mp" },
    description: "Tools",
    allowedMarketplaces: ["other", "third"],
  });
});

test("converts an unresolved catalogue plugin-info row with no scope and empty reasons", () => {
  // arrange
  const presentation = {
    kind: "plugin-info",
    envelope: infoEnvelope(),
    message: unresolvedPluginInfo(),
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "plugin-info",
    severity: "info",
    needsReload: false,
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "available",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      componentsResolved: false,
    },
  });
});

test("converts a remote plugin-info row with its dependencies and version", () => {
  // arrange
  const presentation = {
    kind: "plugin-info",
    envelope: infoEnvelope(),
    message: {
      ...unresolvedPluginInfo(),
      plugin: {
        status: "remote",
        name: "alpha",
        version: "1.0.0",
        componentsResolved: false,
        dependencies: ["beta@mp"],
      },
    },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "plugin-info",
    severity: "info",
    needsReload: false,
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "remote",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      version: "1.0.0",
      dependencies: ["beta@mp"],
      componentsResolved: false,
    },
  });
});

test("converts a resolved installed plugin-info row with every component and optional field", () => {
  // arrange
  const presentation = {
    kind: "plugin-info",
    envelope: infoEnvelope(),
    message: {
      ...unresolvedPluginInfo(),
      marketplaceScope: "project",
      plugin: {
        status: "installed",
        name: "alpha",
        version: "2.0.0",
        scope: "user",
        description: "Alpha tools",
        reasons: ["lsp"],
        notes: ["note one"],
        componentsResolved: true,
        components: {
          agents: ["alpha:reviewer"],
          commands: ["alpha:run"],
          hooks: [
            { event: "PreToolUse", matcher: "Bash" },
            { event: "SessionStart" },
            { kind: "lenient", event: "Custom", supported: false },
            { kind: "lenient", event: "PostToolUse", supported: true, matcher: "Edit" },
          ],
          mcp: [
            {
              name: "plugin:alpha:full",
              unsupportedFeature: "ws",
              unsetVariables: ["A"],
              withheldVariables: ["B"],
              status: "connected",
            },
            { name: "plugin:alpha:bare" },
          ],
          skills: ["alpha:skill"],
          workflows: ["alpha:flow"],
        },
        requires: [
          { companion: "pi-mcp-adapter", missing: true },
          { companion: "pi-subagents", missing: false },
        ],
        dependencies: ["beta@mp"],
      },
    },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "plugin-info",
    severity: "info",
    needsReload: false,
    marketplaceName: "mp",
    marketplaceScope: "project",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "installed",
      name: "alpha",
      id: "alpha@mp",
      reasons: ["lsp"],
      version: "2.0.0",
      scope: "user",
      description: "Alpha tools",
      notes: ["note one"],
      dependencies: ["beta@mp"],
      componentsResolved: true,
      components: {
        agents: ["alpha:reviewer"],
        commands: ["alpha:run"],
        hooks: [
          { event: "PreToolUse", matcher: "Bash" },
          { event: "SessionStart" },
          { kind: "lenient", event: "Custom", supported: false },
          { kind: "lenient", event: "PostToolUse", supported: true, matcher: "Edit" },
        ],
        mcp: [
          {
            name: "plugin:alpha:full",
            unsupportedFeature: "ws",
            unsetVariables: ["A"],
            withheldVariables: ["B"],
            status: "connected",
          },
          { name: "plugin:alpha:bare" },
        ],
        skills: ["alpha:skill"],
        workflows: ["alpha:flow"],
      },
      requires: [
        { companion: "pi-mcp-adapter", missing: true },
        { companion: "pi-subagents", missing: false },
      ],
    },
  });
});

test("gives an installed plugin-info row with no scope of its own the marketplace scope", () => {
  // arrange
  const presentation = {
    kind: "plugin-info",
    envelope: {
      severity: "error",
      summary: "A plugin operation has failed.",
      needsReload: false,
      needsApply: false,
      noOp: false,
    },
    message: {
      ...unresolvedPluginInfo(),
      marketplaceScope: "project",
      plugin: { status: "failed", name: "alpha", componentsResolved: true, components: {} },
    },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "plugin-info",
    severity: "error",
    summary: "A plugin operation has failed.",
    needsReload: false,
    marketplaceName: "mp",
    marketplaceScope: "project",
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status: "failed",
      name: "alpha",
      id: "alpha@mp",
      reasons: [],
      scope: "project",
      componentsResolved: true,
      components: {},
    },
  });
});

test("converts both info fan-outs into blocks with no envelope fields of their own", () => {
  // arrange
  const marketplaces = {
    kind: "marketplace-info-cascade",
    envelope: infoEnvelope(),
    message: { kind: "marketplace-info-cascade", blocks: [githubMarketplaceInfo()] },
  } satisfies NotificationPresentation;
  const plugins = {
    kind: "plugin-info-cascade",
    envelope: infoEnvelope(),
    message: { kind: "plugin-info-cascade", blocks: [unresolvedPluginInfo()] },
  } satisfies NotificationPresentation;

  // act
  const payloads = [
    toWirePayload(marketplaces, { kind: "command", commandId: "plugin", invocationId: "test-run" }),
    toWirePayload(plugins, { kind: "command", commandId: "plugin", invocationId: "test-run" }),
  ];

  // assert
  assert.deepStrictEqual(payloads, [
    {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "marketplace-info-cascade",
      severity: "info",
      needsReload: false,
      blocks: [
        {
          name: "mp",
          scope: "user",
          details: { autoupdate: false },
          source: { sourceKind: "github", owner: "acme", repo: "mp" },
        },
      ],
    },
    {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "plugin-info-cascade",
      severity: "info",
      needsReload: false,
      blocks: [
        {
          marketplaceName: "mp",
          marketplaceScope: "user",
          marketplaceDetails: { autoupdate: false },
          plugin: {
            status: "available",
            name: "alpha",
            id: "alpha@mp",
            reasons: [],
            componentsResolved: false,
          },
        },
      ],
    },
  ]);
});

for (const { title, scope, expectedScope } of [
  { title: "without a scope", scope: {}, expectedScope: {} },
  { title: "with a scope", scope: { scope: "user" }, expectedScope: { scope: "user" } },
] satisfies readonly { title: string; scope: { scope?: Scope }; expectedScope: object }[]) {
  test(`converts a marketplace-not-added presentation ${title}`, () => {
    // arrange
    const presentation = {
      kind: "marketplace-not-added",
      envelope: {
        severity: "error",
        summary: "A marketplace operation has failed.",
        needsReload: false,
        needsApply: false,
        noOp: false,
      },
      message: { kind: "marketplace-not-added", name: "mp", ...scope },
      reason: "marketplace not added",
    } satisfies NotificationPresentation;

    // act
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "marketplace-not-added",
      severity: "error",
      summary: "A marketplace operation has failed.",
      needsReload: false,
      name: "mp",
      ...expectedScope,
      reasons: ["marketplace not added"],
    });
  });
}

test("converts a pending-empty presentation with its advisories and retained workflows", () => {
  // arrange
  const presentation = {
    kind: "reconcile-pending-empty",
    envelope: infoEnvelope(),
    message: {
      kind: "reconcile-pending-empty",
      command: "pending",
      advisories: ["note"],
      retainedWorkflows: [{ name: "flow", envelopeCount: 2 }],
    },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "reconcile-pending-empty",
    severity: "info",
    needsReload: false,
    advisories: ["note"],
    retainedWorkflows: [{ name: "flow", envelopeCount: 2 }],
  });
});

test("D-08: converts an apply-empty presentation to the bare envelope without its command", () => {
  // arrange
  const presentation = {
    kind: "reconcile-pending-empty",
    envelope: infoEnvelope(),
    message: { kind: "reconcile-pending-empty", command: "apply" },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin apply",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin apply", invocationId: "test-run" },
    kind: "reconcile-pending-empty",
    severity: "info",
    needsReload: false,
  });
});

test("converts a prune-empty presentation with its scope", () => {
  // arrange
  const presentation = {
    kind: "prune-empty",
    envelope: infoEnvelope(),
    message: { kind: "prune-empty", scope: "project" },
  } satisfies NotificationPresentation;

  // act
  const payload = toWirePayload(presentation, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "prune-empty",
    severity: "info",
    needsReload: false,
    scope: "project",
  });
});

for (const { title, cause, expectedCause } of [
  { title: "without a cause", cause: {}, expectedCause: {} },
  {
    title: "with a cause",
    cause: { cause: { causeChain: ["save failed", "disk full"], truncated: true } },
    expectedCause: { cause: { causeChain: ["save failed", "disk full"], truncated: true } },
  },
] satisfies readonly {
  title: string;
  cause: { cause?: ExpectedCause };
  expectedCause: object;
}[]) {
  test(`converts a prune-committed-warning presentation ${title}`, () => {
    // arrange
    const presentation = {
      kind: "prune-committed-warning",
      envelope: {
        severity: "warning",
        summary: "Prune committed; finalization needs attention.",
        needsReload: true,
        needsApply: false,
        noOp: false,
      },
      scope: "user",
      ...cause,
    } satisfies NotificationPresentation;

    // act
    const payload = toWirePayload(presentation, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "prune-committed-warning",
      severity: "warning",
      summary: "Prune committed; finalization needs attention.",
      needsReload: true,
      scope: "user",
      ...expectedCause,
    });
  });
}

/** One row per raw kind; a kind missing from the table fails typecheck. */
const RAW_CASES: {
  readonly [K in ResolvedRawSurface["kind"]]: {
    readonly surface: Extract<ResolvedRawSurface, { kind: K }>;
    readonly expected: Record<string, unknown>;
  };
} = {
  "usage-error": {
    surface: { kind: "usage-error", message: "unknown flag", usage: "usage: install" },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-error",
      severity: "error",
      needsReload: false,
      message: "unknown flag",
      usage: "usage: install",
    },
  },
  "usage-info": {
    surface: { kind: "usage-info", usage: "usage: install" },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-info",
      severity: "info",
      needsReload: false,
      usage: "usage: install",
    },
  },
  "autoapply-status": {
    surface: {
      kind: "autoapply-status",
      enabled: false,
      source: { scope: "user", file: "claude-plugins.json" },
      files: [
        { scope: "user", file: "claude-plugins.json", value: false },
        { scope: "user", file: "claude-plugins.local.json" },
      ],
      set: { scope: "user", file: "claude-plugins.json", value: false },
    },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "autoapply-status",
      severity: "info",
      needsReload: false,
      enabled: false,
      source: { scope: "user", file: "claude-plugins.json" },
      files: [
        { scope: "user", file: "claude-plugins.json", value: false },
        { scope: "user", file: "claude-plugins.local.json" },
      ],
      set: { scope: "user", file: "claude-plugins.json", value: false },
    },
  },
  diagnostic: {
    surface: { kind: "diagnostic", header: "2 warnings", lines: ["one", "two"] },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "diagnostic",
      severity: "warning",
      needsReload: false,
      header: "2 warnings",
      lines: ["one", "two"],
    },
  },
  "device-flow-prompt": {
    surface: {
      kind: "device-flow-prompt",
      verificationUri: "https://github.com/login/device",
      userCode: "ABCD-1234",
    },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "device-flow-prompt",
      severity: "info",
      needsReload: false,
      verificationUri: "https://github.com/login/device",
      userCode: "ABCD-1234",
    },
  },
  "async-rewake-summary": {
    surface: { kind: "async-rewake-summary", summary: "rewoke" },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "async-rewake-summary",
      severity: "info",
      needsReload: false,
      text: "rewoke",
    },
  },
  "stop-override-cap": {
    surface: { kind: "stop-override-cap", pluginId: "alpha@mp", cap: 8 },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "stop-override-cap",
      severity: "warning",
      needsReload: false,
      pluginId: "alpha@mp",
      cap: 8,
    },
  },
  "reconcile-aborted": {
    surface: { kind: "reconcile-aborted", causeMessage: "state unreadable" },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "reconcile-aborted",
      severity: "error",
      needsReload: false,
      causeMessage: "state unreadable",
    },
  },
  "plugin-path-skipped": {
    surface: { kind: "plugin-path-skipped", scope: "project", reason: "EACCES" },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "plugin-path-skipped",
      severity: "warning",
      needsReload: false,
      scope: "project",
      reason: "EACCES",
    },
  },
  "mcp-config-notices": {
    surface: {
      kind: "mcp-config-notices",
      section: "left-unchanged",
      notices: [{ kind: "left-unchanged", scope: "user", file: "mcp.json" }],
    },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "mcp-config-notices",
      severity: "warning",
      needsReload: false,
      notices: [{ kind: "left-unchanged", scope: "user", file: "mcp.json" }],
    },
  },
  "mcp-migration": {
    surface: {
      kind: "mcp-migration",
      rows: [{ kind: "stopped", scope: "user", detail: "state.json is locked" }],
      notices: [],
      severity: "warning",
      needsReload: false,
    },
    expected: {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "mcp-migration",
      severity: "warning",
      needsReload: false,
      rows: [{ kind: "stopped", scope: "user", detail: "state.json is locked" }],
      notices: [],
    },
  },
};

for (const [kind, { surface, expected }] of Object.entries(RAW_CASES)) {
  test(`converts a ${kind} raw surface with its severity, no reload, and no summary`, () => {
    // arrange
    const expectedPayload = expected;

    // act
    const payload = toWirePayload(surface, {
      kind: "command",
      commandId: "plugin",
      invocationId: "test-run",
    });

    // assert
    assert.deepStrictEqual(payload, expectedPayload);
  });
}

test("AAP-04: converts a default autoapply status without a source or a set", () => {
  // act
  const payload = toWirePayload(
    {
      kind: "autoapply-status",
      enabled: false,
      files: [{ scope: "project", file: "claude-plugins.json" }],
    },
    { kind: "command", commandId: "plugin autoapply", invocationId: "test-run" },
  );

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin autoapply", invocationId: "test-run" },
    kind: "autoapply-status",
    severity: "info",
    needsReload: false,
    enabled: false,
    files: [{ scope: "project", file: "claude-plugins.json" }],
  });
});

test("AFILE-04: converts every MCP config notice kind field by field", () => {
  // arrange
  const subject = {
    scope: "project",
    file: "mcp-adapter.json",
    plugin: "hello",
    server: "srv",
  } as const;
  const notices = [
    { kind: "comments-dropped", scope: "user", file: "mcp.json" },
    { kind: "left-unchanged", scope: "user", file: "mcp-adapter.json" },
    { kind: "override-kept", ...subject, fields: ["env"] },
    { kind: "variables-missing", ...subject, names: ["A"] },
    { kind: "credentials-blanked", ...subject, names: ["B"] },
    { kind: "tool-rules-unenforced", ...subject, fields: ["toolPermissions"] },
    { kind: "leftover-removed", ...subject },
  ] as const;

  // act
  const payload = toWirePayload(
    { kind: "mcp-config-notices", section: "comments-dropped", notices },
    { kind: "load" },
  );

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "load" },
    kind: "mcp-config-notices",
    severity: "warning",
    needsReload: false,
    notices: [
      { kind: "comments-dropped", scope: "user", file: "mcp.json" },
      { kind: "left-unchanged", scope: "user", file: "mcp-adapter.json" },
      { kind: "override-kept", ...subject, fields: ["env"] },
      { kind: "variables-missing", ...subject, names: ["A"] },
      { kind: "credentials-blanked", ...subject, names: ["B"] },
      { kind: "tool-rules-unenforced", ...subject, fields: ["toolPermissions"] },
      { kind: "leftover-removed", ...subject },
    ],
  });
});

test("AMIG-03: converts a migration surface with its resolved severity and reload, every row kind field by field", () => {
  // arrange
  const owner = { scope: "user", plugin: "p", marketplace: "m", servers: ["s"] } as const;
  const rows = [
    { kind: "moved", scope: "project", plugin: "p", marketplace: "m", from: "s", to: "t" },
    {
      kind: "removed",
      scope: "project",
      plugin: "p",
      marketplace: "m",
      server: "s",
      cause: "unsupported-feature",
      feature: "ws",
    },
    {
      kind: "removed",
      scope: "project",
      plugin: "p",
      marketplace: "m",
      server: "s",
      cause: "not-declared",
    },
    { kind: "stopped", scope: "user", detail: "locked" },
    { kind: "file-unreadable", scope: "user", file: "mcp.json" },
    { kind: "unowned", ...owner },
    { kind: "not-listed", ...owner },
    { kind: "source-unreadable", ...owner },
    { kind: "source-outdated", ...owner },
    { kind: "marketplace-unreadable", ...owner },
    { kind: "collision", ...owner, key: "k", source: "~/.config/mcp/mcp.json" },
    { kind: "unfinished", ...owner, file: "project-scope mcp-adapter.json", detail: "denied" },
  ] as const;

  // act
  const payload = toWirePayload(
    {
      kind: "mcp-migration",
      rows,
      notices: [{ kind: "comments-dropped", scope: "user", file: "mcp.json" }],
      severity: "warning",
      needsReload: true,
    },
    { kind: "load" },
  );

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    kind: "mcp-migration",
    origin: { kind: "load" },
    severity: "warning",
    needsReload: true,
    rows: [
      { kind: "moved", scope: "project", plugin: "p", marketplace: "m", from: "s", to: "t" },
      {
        kind: "removed",
        scope: "project",
        plugin: "p",
        marketplace: "m",
        server: "s",
        cause: "unsupported-feature",
        feature: "ws",
      },
      {
        kind: "removed",
        scope: "project",
        plugin: "p",
        marketplace: "m",
        server: "s",
        cause: "not-declared",
      },
      { kind: "stopped", scope: "user", detail: "locked" },
      { kind: "file-unreadable", scope: "user", file: "mcp.json" },
      { kind: "unowned", ...owner },
      { kind: "not-listed", ...owner },
      { kind: "source-unreadable", ...owner },
      { kind: "source-outdated", ...owner },
      { kind: "marketplace-unreadable", ...owner },
      { kind: "collision", ...owner, key: "k", source: "~/.config/mcp/mcp.json" },
      { kind: "unfinished", ...owner, file: "project-scope mcp-adapter.json", detail: "denied" },
    ],
    notices: [{ kind: "comments-dropped", scope: "user", file: "mcp.json" }],
  });
});

test("converts a diagnostic with no lines to an empty line list", () => {
  // arrange
  const surface = {
    kind: "diagnostic",
    header: "0 warnings",
    lines: [],
  } satisfies ResolvedRawSurface;

  // act
  const payload = toWirePayload(surface, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "diagnostic",
    severity: "warning",
    needsReload: false,
    header: "0 warnings",
    lines: [],
  });
});

test("converts an empty rewake summary to empty text", () => {
  // arrange
  const surface = { kind: "async-rewake-summary", summary: "" } satisfies ResolvedRawSurface;

  // act
  const payload = toWirePayload(surface, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual(payload, {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "async-rewake-summary",
    severity: "info",
    needsReload: false,
    text: "",
  });
});

test("copies the diagnostic lines so the payload shares no array with the surface", () => {
  // arrange
  const surface = {
    kind: "diagnostic",
    header: "1 warning",
    lines: ["one"],
  } satisfies ResolvedRawSurface;

  // act
  const payload = toWirePayload(surface, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.ok("lines" in payload);
  assert.notStrictEqual(payload.lines, surface.lines);
  assert.deepStrictEqual(payload.lines, ["one"]);
});

function adjacentCascade(): CascadePresentation {
  return {
    kind: "cascade",
    envelope: { severity: "info", needsReload: true, needsApply: false, noOp: false },
    marketplaces: [],
  };
}

function expectedAdjacentPayloads(): Record<string, unknown>[] {
  return [
    {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "usage-info",
      severity: "info",
      needsReload: false,
      usage: "usage: list",
    },
    {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
      kind: "cascade",
      severity: "info",
      needsReload: true,
      marketplaces: [],
    },
  ];
}

test("a raw surface converted before a cascade stays independent of it", () => {
  // arrange
  const surface = { kind: "usage-info", usage: "usage: list" } satisfies ResolvedRawSurface;

  // act
  const raw = toWirePayload(surface, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  const cascade = toWirePayload(adjacentCascade(), {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual([raw, cascade], expectedAdjacentPayloads());
});

test("a cascade converted before a raw surface stays independent of it", () => {
  // arrange
  const surface = { kind: "usage-info", usage: "usage: list" } satisfies ResolvedRawSurface;

  // act
  const cascade = toWirePayload(adjacentCascade(), {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });
  const raw = toWirePayload(surface, {
    kind: "command",
    commandId: "plugin",
    invocationId: "test-run",
  });

  // assert
  assert.deepStrictEqual([raw, cascade], expectedAdjacentPayloads());
});
