/** @fileoverview Steps that capture and compare complete plugin command completion sets. */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { pluginCompletions } from "../lib/plugin-completions.ts";

import type { ScenarioWorld } from "../support/world.ts";

When(
  "the user requests plugin completions for {string}",
  async function (this: ScenarioWorld, prefix: string): Promise<void> {
    this.recordCompletions(prefix, await pluginCompletions(prefix, this.tokens.projectDir));
  },
);

Then(
  "the plugin completion set for {string} contains these suggestions:",
  function (this: ScenarioWorld, prefix: string, table: DataTable): void {
    const rows = this.completionsFor(prefix).map(({ label, value, description }) => [
      label,
      JSON.stringify(value),
      description ?? "",
    ]);
    assert.deepStrictEqual([["label", "value", "description"], ...rows], table.raw());
    this.markCompletionsCompared(prefix);
  },
);
