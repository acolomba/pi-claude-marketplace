/**
 * @fileoverview Steps about the hook notices a turn showed the user: each
 * hook's system message and the report of a block (HOOK-05).
 *
 * The extension shows a hook notice through its notify chokepoint, which in
 * an RPC session appends it as a `claude-plugin` entry of kind `hook-notice`.
 * Pi reports every appended entry as an `entry_appended` record, so the step
 * reads the notices from the records of the last turn, in emission order, each
 * valid against the published payload schema (D-CF5-14).
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";
import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../../extensions/pi-claude-marketplace/shared/notification-wire.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

const NOTICE_COLUMNS: readonly string[] = ["severity", "text"];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The payload of a `claude-plugin` entry Pi appended, or undefined for any
// other record. Each payload is valid against the published schema.
function payloadOf(record: RpcRecord): Readonly<Record<string, unknown>> | undefined {
  const { entry } = record;
  if (
    record.type !== "entry_appended" ||
    !isRecord(entry) ||
    entry.type !== "custom" ||
    entry.customType !== "claude-plugin"
  ) {
    return undefined;
  }

  const payload = entry.data;
  assert.ok(PAYLOAD_VALIDATOR.Check(payload), JSON.stringify(PAYLOAD_VALIDATOR.Errors(payload)));
  return payload;
}

// The whole payload of each stated notice row: a hook notice comes from a
// hook and never asks for a reload.
function statedNotice(row: readonly string[], world: ScenarioWorld): Record<string, unknown> {
  const [severity, text = ""] = row;
  return {
    schemaVersion: 1,
    origin: { kind: "hook" },
    kind: "hook-notice",
    severity,
    needsReload: false,
    text: expandTokens(text, world.tokens),
  };
}

Then("the hooks show the user these messages:", function (this: ScenarioWorld, table: DataTable) {
  const [header = [], ...rows] = table.raw();
  assert.deepStrictEqual(header, NOTICE_COLUMNS);
  const notices = this.requireTurn().records.flatMap((record) => {
    const payload = payloadOf(record);
    return payload?.kind === "hook-notice" ? [payload] : [];
  });
  assert.deepStrictEqual(
    notices,
    rows.map((row) => statedNotice(row, this)),
  );
  this.markTurnCompared();
});
