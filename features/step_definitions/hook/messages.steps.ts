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
import { projectTokens } from "../../lib/run-tokens.ts";

import type { NotificationPayload } from "../../lib/pi-commands.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);

const NOTICE_COLUMNS: readonly string[] = ["severity", "text"];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The payload of a `claude-plugin` entry Pi appended, or undefined for any
// other record. Each payload is valid against the published schema.
function payloadOf(record: RpcRecord): NotificationPayload | undefined {
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
function statedNotice(row: readonly string[]): Record<string, unknown> {
  const [severity, text] = row;
  return {
    schemaVersion: 1,
    origin: { kind: "hook" },
    kind: "hook-notice",
    severity,
    needsReload: false,
    text,
  };
}

// The hook notices of the last turn, with the run tokens projected.
function turnNotices(world: ScenarioWorld): Record<string, unknown>[] {
  return world.requireTurn().records.flatMap((record) => {
    const payload = payloadOf(record);
    return payload?.kind === "hook-notice"
      ? [{ ...payload, text: projectTokens("text", payload.text, world.tokens) }]
      : [];
  });
}

Then("the hooks show the user these messages:", function (this: ScenarioWorld, table: DataTable) {
  const [header = [], ...rows] = table.raw();
  assert.deepStrictEqual(header, NOTICE_COLUMNS);
  assert.deepStrictEqual(
    turnNotices(this),
    rows.map((row) => statedNotice(row)),
  );
  this.markTurnCompared();
});

// A table with only a header cannot be compared, so a turn that showed no
// hook notice has a step of its own. It reads every record of the turn, so a
// notice appended to the session that a new session replaced counts too.
Then("the hooks show the user no messages", function (this: ScenarioWorld) {
  assert.deepStrictEqual(turnNotices(this), []);
  this.markTurnCompared();
});
