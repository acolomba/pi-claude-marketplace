import assert from "node:assert/strict";
import test from "node:test";

import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

function internalErrorPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: "internal-error",
    origin: { kind: "command", commandId: "plugin update", invocationId: "run-a" },
    severity: "error",
    needsReload: false,
    summary: "Command failed unexpectedly.",
    cause: { causeChain: ["failed"], truncated: false },
  };
}

test("accepts a complete command internal-error payload", () => {
  // arrange
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

  // act
  const valid = validator.Check(internalErrorPayload());

  // assert
  assert.strictEqual(valid, true);
});

for (const { title, fields } of [
  { title: "load origin", fields: { origin: { kind: "load" } } },
  { title: "hook origin", fields: { origin: { kind: "hook" } } },
  { title: "wrong severity", fields: { severity: "warning" } },
  { title: "null cause", fields: { cause: null } },
  { title: "live stack", fields: { stack: "private" } },
  { title: "nonboolean reload", fields: { needsReload: "false" } },
]) {
  test(`rejects internal-error with ${title}`, () => {
    // arrange
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
    const payload = { ...internalErrorPayload(), ...fields };

    // act
    const valid = validator.Check(payload);

    // assert
    assert.strictEqual(valid, false);
  });
}

for (const field of ["cause", "summary", "needsReload", "severity", "origin"]) {
  test(`rejects internal-error without ${field}`, () => {
    // arrange
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
    const { [field]: _omitted, ...payload } = internalErrorPayload();

    // act
    const valid = validator.Check(payload);

    // assert
    assert.strictEqual(valid, false);
  });
}

/** A valid failed row carrying every optional row field once. */
function failedRow(): Record<string, unknown> {
  return {
    status: "failed",
    name: "alpha",
    id: "alpha@mp",
    reasons: ["lock held", "requires pi-subagents"],
    version: "1.0.0",
    scope: "project",
    description: "Alpha.",
    partial: true,
    hint: "partial-install",
    cause: { causeChain: ["boom"], truncated: false },
    leaks: ["leak"],
    rollbackPartial: [{ phase: "skills", cause: { causeChain: ["undo"], truncated: true } }],
  };
}

/** A valid cascade payload whose first row is `row`, exercising every optional field. */
function cascadePayloadWith(row: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "cascade",
    severity: "error",
    summary: "A plugin operation has failed.",
    needsReload: true,
    tally: { label: "Plugin install", failures: 1, warnings: 0, success: { count: 2, verb: "ok" } },
    noOp: true,
    needsApply: true,
    marketplaces: [
      {
        name: "mp",
        scope: "user",
        status: "failed",
        details: { autoupdate: true, lastUpdatedAt: "2026-10-03T00:00:00.000Z" },
        reasons: ["lock held"],
        plugins: [
          row,
          {
            status: "updated",
            name: "bravo",
            id: "bravo@mp",
            reasons: [],
            from: "1.0.0",
            to: "2.0.0",
          },
        ],
      },
    ],
    advisories: ["advice"],
    retainedWorkflows: [{ name: "wf", envelopeCount: 0 }],
  };
}

const [CASCADE_MEMBER, RECONCILE_APPLIED_MEMBER] = NOTIFICATION_PAYLOAD_SCHEMA.anyOf;

/**
 * The keyword and location of each leaf error of one union member. The union
 * reports every member's errors, so each case reads the member its kind names.
 */
function leafErrors(
  member: (typeof NOTIFICATION_PAYLOAD_SCHEMA.anyOf)[number],
  payload: unknown,
): { keyword: string; instancePath: string }[] {
  const validator = Compile(member);
  return [...validator.Errors(payload)]
    .filter((error) => error.keyword !== "anyOf")
    .map((error) => ({ keyword: error.keyword, instancePath: error.instancePath }));
}

test("accepts a cascade payload that carries every optional field", () => {
  // arrange
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
  const payload = cascadePayloadWith(failedRow());

  // act
  const valid = validator.Check(payload);

  // assert
  assert.strictEqual(valid, true, JSON.stringify([...validator.Errors(payload)]));
});

const ROW = "/marketplaces/0/plugins/0";

for (const { title, mutate, expectedErrors } of [
  {
    title: "rejects an unknown plugin status",
    mutate: (row: Record<string, unknown>, _payload: Record<string, unknown>): void => {
      row.status = "nope";
    },
    expectedErrors: [{ keyword: "enum", instancePath: `${ROW}/status` }],
  },
  {
    title: "rejects an unknown reason token",
    mutate: (row: Record<string, unknown>, _payload: Record<string, unknown>): void => {
      row.reasons = ["lock held", "nope"];
    },
    expectedErrors: [{ keyword: "enum", instancePath: `${ROW}/reasons/1` }],
  },
  {
    title: "rejects a null scope",
    mutate: (row: Record<string, unknown>, _payload: Record<string, unknown>): void => {
      row.scope = null;
    },
    expectedErrors: [{ keyword: "enum", instancePath: `${ROW}/scope` }],
  },
  {
    title: "rejects a row property the schema does not declare",
    mutate: (row: Record<string, unknown>, _payload: Record<string, unknown>): void => {
      row.missingPolicy = true;
    },
    expectedErrors: [
      { keyword: "boolean", instancePath: `${ROW}/missingPolicy` },
      { keyword: "additionalProperties", instancePath: ROW },
    ],
  },
  {
    title: "rejects a row without reasons",
    mutate: (row: Record<string, unknown>, _payload: Record<string, unknown>): void => {
      delete row.reasons;
    },
    expectedErrors: [{ keyword: "required", instancePath: ROW }],
  },
  {
    title: "rejects schemaVersion 2",
    mutate: (_row: Record<string, unknown>, payload: Record<string, unknown>): void => {
      payload.schemaVersion = 2;
    },
    expectedErrors: [{ keyword: "const", instancePath: "/schemaVersion" }],
  },
  {
    title: "rejects a fractional failure count",
    mutate: (_row: Record<string, unknown>, payload: Record<string, unknown>): void => {
      payload.tally = { label: "Plugin install", failures: 1.5, warnings: 0 };
    },
    expectedErrors: [{ keyword: "type", instancePath: "/tally/failures" }],
  },
  {
    title: "rejects noOp false",
    mutate: (_row: Record<string, unknown>, payload: Record<string, unknown>): void => {
      payload.noOp = false;
    },
    expectedErrors: [{ keyword: "const", instancePath: "/noOp" }],
  },
]) {
  test(title, () => {
    // arrange
    const row = failedRow();
    const payload = cascadePayloadWith(row);
    mutate(row, payload);

    // act
    const errors = leafErrors(CASCADE_MEMBER, payload);
    const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

    // assert
    assert.deepStrictEqual(errors, expectedErrors);
    assert.strictEqual(valid, false);
  });
}

/** A valid reconcile-applied payload carrying every field its member declares. */
function reconcileAppliedPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "reconcile-applied-cascade",
    severity: "warning",
    summary: "Heads up.",
    needsReload: false,
    tally: { label: "Reconcile", failures: 0, warnings: 1 },
    marketplaces: [{ name: "mp", scope: "user", plugins: [failedRow()] }],
  };
}

test("accepts a reconcile-applied payload that carries every field its member declares", () => {
  // arrange
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
  const payload = reconcileAppliedPayload();

  // act
  const valid = validator.Check(payload);

  // assert
  assert.strictEqual(valid, true, JSON.stringify([...validator.Errors(payload)]));
});

test("rejects noOp on a reconcile-applied payload", () => {
  // arrange
  const payload = { ...reconcileAppliedPayload(), noOp: true };

  // act
  const errors = leafErrors(RECONCILE_APPLIED_MEMBER, payload);
  const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

  // assert
  assert.deepStrictEqual(errors, [
    { keyword: "boolean", instancePath: "/noOp" },
    { keyword: "additionalProperties", instancePath: "" },
  ]);
  assert.strictEqual(valid, false);
});

test("APL-04 / D-14: rejects needsApply false on a cascade payload", () => {
  // arrange
  const payload = { ...cascadePayloadWith(failedRow()), needsApply: false };

  // act
  const errors = leafErrors(CASCADE_MEMBER, payload);
  const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

  // assert
  assert.deepStrictEqual(errors, [{ keyword: "const", instancePath: "/needsApply" }]);
  assert.strictEqual(valid, false);
});

test("APL-04 / D-14: rejects needsApply on a reconcile-applied payload", () => {
  // arrange
  const payload = { ...reconcileAppliedPayload(), needsApply: true };

  // act
  const errors = leafErrors(RECONCILE_APPLIED_MEMBER, payload);
  const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

  // assert
  assert.deepStrictEqual(errors, [
    { keyword: "boolean", instancePath: "/needsApply" },
    { keyword: "additionalProperties", instancePath: "" },
  ]);
  assert.strictEqual(valid, false);
});

const DEVICE_FLOW_PROMPT_MEMBER = NOTIFICATION_PAYLOAD_SCHEMA.anyOf[14];
const ASYNC_REWAKE_SUMMARY_MEMBER = NOTIFICATION_PAYLOAD_SCHEMA.anyOf[15];

for (const origin of [
  { kind: "command", commandId: "plugin list", invocationId: "run-a" },
  { kind: "load" },
  { kind: "hook" },
]) {
  test(`accepts exact ${origin.kind} origin on raw and structured payloads`, () => {
    // arrange
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

    // act
    const accepted = [
      validator.Check({ ...cascadePayloadWith(failedRow()), origin }),
      validator.Check({ ...deviceFlowPromptPayload(), origin }),
    ];

    // assert
    assert.deepStrictEqual(accepted, [true, true]);
  });
}

for (const { title, origin } of [
  { title: "null origin", origin: null },
  { title: "absent command ID", origin: { kind: "command", invocationId: "run-a" } },
  { title: "absent invocation ID", origin: { kind: "command", commandId: "plugin list" } },
  { title: "empty command ID", origin: { kind: "command", commandId: "", invocationId: "run-a" } },
  {
    title: "empty invocation ID",
    origin: { kind: "command", commandId: "plugin list", invocationId: "" },
  },
  { title: "null command ID", origin: { kind: "command", commandId: null, invocationId: "run-a" } },
  {
    title: "null invocation ID",
    origin: { kind: "command", commandId: "plugin list", invocationId: null },
  },
  {
    title: "alias",
    origin: { kind: "command", commandId: "plugin list", invocationId: "run-a", alias: "ls" },
  },
  {
    title: "load command fields",
    origin: { kind: "load", commandId: "plugin list", invocationId: "run-a" },
  },
  {
    title: "hook command fields",
    origin: { kind: "hook", commandId: "plugin list", invocationId: "run-a" },
  },
  { title: "unknown root", origin: { kind: "tool" } },
]) {
  test(`rejects ${title} on raw and structured payloads`, () => {
    // arrange
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

    // act
    const accepted = [
      validator.Check({ ...cascadePayloadWith(failedRow()), origin }),
      validator.Check({ ...deviceFlowPromptPayload(), origin }),
    ];

    // assert
    assert.deepStrictEqual(accepted, [false, false]);
  });
}

test("rejects missing origin on raw and structured payloads", () => {
  // arrange
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
  const { origin: _cascadeOrigin, ...cascade } = cascadePayloadWith(failedRow());
  const { origin: _rawOrigin, ...raw } = deviceFlowPromptPayload();

  // act
  const accepted = [validator.Check(cascade), validator.Check(raw)];

  // assert
  assert.deepStrictEqual(accepted, [false, false]);
});

function deviceFlowPromptPayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "device-flow-prompt",
    severity: "info",
    needsReload: false,
    verificationUri: "https://github.com/login/device",
    userCode: "ABCD-1234",
  };
}

test("accepts a raw device-flow-prompt payload", () => {
  // arrange
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
  const payload = deviceFlowPromptPayload();

  // act
  const valid = validator.Check(payload);

  // assert
  assert.strictEqual(valid, true, JSON.stringify([...validator.Errors(payload)]));
});

test("rejects a device-flow-prompt payload without its user code", () => {
  // arrange
  const { userCode: _userCode, ...payload } = deviceFlowPromptPayload();

  // act
  const errors = leafErrors(DEVICE_FLOW_PROMPT_MEMBER, payload);
  const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

  // assert
  assert.deepStrictEqual(errors, [{ keyword: "required", instancePath: "" }]);
  assert.strictEqual(valid, false);
});

test("rejects an async-rewake-summary payload that carries summary", () => {
  // arrange
  const payload = {
    schemaVersion: 1,
    origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
    kind: "async-rewake-summary",
    severity: "info",
    needsReload: false,
    text: "rewoke",
    summary: "rewoke",
  };

  // act
  const errors = leafErrors(ASYNC_REWAKE_SUMMARY_MEMBER, payload);
  const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

  // assert
  assert.deepStrictEqual(errors, [
    { keyword: "boolean", instancePath: "/summary" },
    { keyword: "additionalProperties", instancePath: "" },
  ]);
  assert.strictEqual(valid, false);
});

function mcpConfigNoticesPayload(notices: readonly unknown[]): Record<string, unknown> {
  return {
    schemaVersion: 1,
    origin: { kind: "load" },
    kind: "mcp-config-notices",
    severity: "warning",
    needsReload: false,
    notices,
  };
}

for (const { title, notices, expectedValid } of [
  {
    title: "accepts an mcp-config-notices payload with one notice",
    notices: [{ kind: "left-unchanged", scope: "user", file: "mcp.json" }],
    expectedValid: true,
  },
  {
    title: "rejects an mcp-config-notices payload with no notice",
    notices: [],
    expectedValid: false,
  },
  {
    title: "rejects an override-kept notice that names mcp.json",
    notices: [
      {
        kind: "override-kept",
        scope: "user",
        file: "mcp.json",
        plugin: "p",
        server: "s",
        fields: ["env"],
      },
    ],
    expectedValid: false,
  },
]) {
  test(`AFILE-04: ${title}`, () => {
    // act
    const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(mcpConfigNoticesPayload(notices));

    // assert
    assert.strictEqual(valid, expectedValid);
  });
}

for (const { title, cause, expectedValid } of [
  {
    title: "accepts a removed row with a closed-set cause",
    cause: "malformed",
    expectedValid: true,
  },
  {
    title: "rejects a removed row whose cause is outside its closed set",
    cause: "gone",
    expectedValid: false,
  },
]) {
  test(`AMIG-03: ${title}`, () => {
    // arrange
    const payload = {
      schemaVersion: 1,
      origin: { kind: "load" },
      kind: "mcp-migration",
      severity: "warning",
      needsReload: true,
      rows: [{ kind: "removed", scope: "user", plugin: "p", marketplace: "m", server: "s", cause }],
      notices: [],
    };

    // act
    const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

    // assert
    assert.strictEqual(valid, expectedValid);
  });
}

for (const { title, needsReload, plugins, expectedValid } of [
  {
    title: "accepts a load-origin payload whose row omits its from version",
    needsReload: true,
    plugins: [{ name: "alpha", marketplace: "tools", scope: "user", toVersion: "1.1.0" }],
    expectedValid: true,
  },
  {
    title: "rejects a payload with no plugin row",
    needsReload: true,
    plugins: [],
    expectedValid: false,
  },
  {
    title: "rejects a payload that needs no reload",
    needsReload: false,
    plugins: [{ name: "alpha", marketplace: "tools", scope: "user", toVersion: "1.1.0" }],
    expectedValid: false,
  },
]) {
  test(`AUP-03: ${title}`, () => {
    // arrange
    const payload = {
      schemaVersion: 1,
      origin: { kind: "load" },
      kind: "background-update",
      severity: "info",
      needsReload,
      plugins,
    };

    // act
    const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

    // assert
    assert.strictEqual(valid, expectedValid);
  });
}

for (const { title, status, expectedValid } of [
  {
    title: "accepts an MCP server with a closed-set status",
    status: "pending approval",
    expectedValid: true,
  },
  {
    title: "rejects an MCP server whose status is outside its closed set",
    status: "online",
    expectedValid: false,
  },
]) {
  test(`ASTAT-01: ${title}`, () => {
    // arrange
    const payload = {
      schemaVersion: 1,
      origin: { kind: "load" },
      kind: "plugin-info",
      severity: "info",
      needsReload: false,
      marketplaceName: "mp",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "installed",
        name: "p",
        id: "p@mp",
        reasons: [],
        componentsResolved: true,
        components: { mcp: [{ name: "plugin:p:s", status }] },
        requires: [{ companion: "pi-mcp-adapter", missing: false }],
      },
    };

    // act
    const valid = Compile(NOTIFICATION_PAYLOAD_SCHEMA).Check(payload);

    // assert
    assert.strictEqual(valid, expectedValid);
  });
}

for (const status of ["will add", "will remove"]) {
  test(`D-20: accepts a pending cascade whose marketplace status is ${status}`, () => {
    // arrange
    const payload = {
      schemaVersion: 1,
      origin: { kind: "command", commandId: "plugin pending", invocationId: "test-run" },
      kind: "cascade",
      severity: "info",
      needsReload: false,
      needsApply: true,
      marketplaces: [{ name: "mp", scope: "project", status, plugins: [] }],
    };
    const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

    // act
    const valid = validator.Check(payload);

    // assert
    assert.strictEqual(valid, true, JSON.stringify([...validator.Errors(payload)]));
  });
}

test("D-24: accepts a pending decline row carrying the catalog partial-update hint", () => {
  // arrange
  const payload = cascadePayloadWith({
    ...failedRow(),
    status: "partially-upgradable",
    reasons: ["unsupported component"],
    hint: "catalog-partial-update",
  });
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

  // act
  const valid = validator.Check(payload);

  // assert
  assert.strictEqual(valid, true, JSON.stringify([...validator.Errors(payload)]));
});
