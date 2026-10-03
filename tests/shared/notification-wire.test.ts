import assert from "node:assert/strict";
import test from "node:test";

import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

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
    kind: "cascade",
    severity: "error",
    summary: "A plugin operation has failed.",
    needsReload: true,
    tally: { label: "Plugin install", failures: 1, warnings: 0, success: { count: 2, verb: "ok" } },
    noOp: true,
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

/** The keyword and location of each leaf error, without the union wrapper. */
function leafErrors(payload: unknown): { keyword: string; instancePath: string }[] {
  const validator = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
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
    const errors = leafErrors(payload);

    // assert
    assert.deepStrictEqual(errors, expectedErrors);
  });
}
