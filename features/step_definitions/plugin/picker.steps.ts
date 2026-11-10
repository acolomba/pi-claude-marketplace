/**
 * @fileoverview Steps about the plugin picker in a real terminal: opening it,
 * the rows of each screen, choosing a row, and cancelling it.
 *
 * The steps read the picker from the terminal's current screen, so a row the
 * picker redrew reads as its last value.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import {
  cancelPicker,
  choosePickerRow,
  currentPickerScreen,
  openPicker,
} from "../../lib/plugin-picker.ts";
import { expandTokens, projectTokens } from "../../lib/run-tokens.ts";

import type { ScenarioWorld } from "../../support/world.ts";

When(
  "the user opens the plugin picker with {string} in pi's terminal",
  async function (this: ScenarioWorld, command: string): Promise<void> {
    const tui = await this.startTuiSession();
    await openPicker(tui, expandTokens(command, this.tokens));
  },
);

When(
  "the user chooses {string} in the plugin picker",
  async function (this: ScenarioWorld, label: string): Promise<void> {
    await choosePickerRow(this.requireTuiSession(), label);
  },
);

When("the user cancels the plugin picker", async function (this: ScenarioWorld): Promise<void> {
  await cancelPicker(this.requireTuiSession());
});

Then(
  "the plugin picker shows the screen {string} with these rows:",
  function (this: ScenarioWorld, title: string, table: DataTable): void {
    const screen = currentPickerScreen(this.requireTuiSession());
    const rows = screen.rows.map((row) => [
      row.label,
      projectTokens("", row.description, this.tokens),
    ]);
    assert.deepStrictEqual(
      { title: screen.title, rows: [["label", "description"], ...rows] },
      { title, rows: table.raw() },
    );
  },
);
