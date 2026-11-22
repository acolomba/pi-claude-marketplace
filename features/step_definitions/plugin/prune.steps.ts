/**
 * @fileoverview Steps about plugin prune: a preview whose rows it states.
 */

import assert from "node:assert/strict";

import { type DataTable, Given } from "@cucumber/cucumber";

import { recordTable } from "../../lib/field-rows.ts";
import { runCommandPayloads } from "../../lib/pi-commands.ts";
import { pluginRowRecords } from "../../lib/result-rows.ts";
import { expandTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// A preview that a later Given makes stale: the step states the rows it listed.
Given(
  "the user has previewed the prune with {string}, which listed these plugins:",
  async function (this: ScenarioWorld, command: string, table: DataTable) {
    const payloads = await runCommandPayloads(this.pi, expandTokens(command, this.tokens));
    const [payload, ...rest] = payloads;
    assert.ok(payload !== undefined && rest.length === 0, JSON.stringify(payloads));
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
    const [stated = []] = table.raw();
    assert.deepStrictEqual(
      recordTable(stated, pluginRowRecords(payload, this.tokens)),
      table.raw(),
    );
  },
);
