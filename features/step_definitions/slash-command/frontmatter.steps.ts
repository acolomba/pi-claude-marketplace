/**
 * @fileoverview Steps about Pi's terminal slash menu: typing the prefix of a
 * slash command and reading the menu rows Pi renders for it.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi lists its loaded resources, ending with `[Extensions]`, once the
// extensions' `session_start` handlers ran and its autocomplete was set up.
// The default readiness text follows it, so this wait returns at once; it
// states the precondition the typed prefix relies on.
const RESOURCES_LISTED = "[Extensions]";
const RESOURCES_MS = 10_000;

// Pi shows its completion menu, with its selection marker on the first row,
// once it has the suggestions for the typed prefix; the menu is complete when
// the output stays unchanged for a while.
const MENU_MARKER = "→ ";
const MENU_MS = 10_000;
const MENU_QUIET_MS = 250;
const MENU_SETTLE_MS = 5_000;

// The pseudoterminal is 120 columns wide, and Pi pads every menu row to it.
const TERMINAL_COLUMNS = 120;

// A row is the selection marker or two spaces, the command, then its text.
const MENU_ROW = /^(?:→ | {2})(\S+)(?: +(.*?))? *$/u;

// Pi joins a command's argument hint and its description with an em dash.
// The repository's dash fixer rewrites an em dash in a feature file to `--`,
// so a row states the dash as `--`.
const EM_DASH = /\u2014/gu;
const STATED_DASH = "--";

/**
 * The rows of the last menu Pi drew: from its last selection marker, one
 * terminal line per row, up to the first line that is not a menu row.
 */
function menuRows(terminalText: string): string[][] {
  const start = terminalText.lastIndexOf(MENU_MARKER);
  if (start === -1) {
    assert.fail(`pi's terminal shows no slash menu:\n${terminalText}`);
  }

  const rows: string[][] = [];
  for (let line = start; line < terminalText.length; line += TERMINAL_COLUMNS) {
    const match = MENU_ROW.exec(terminalText.slice(line, line + TERMINAL_COLUMNS));
    if (match === null) {
      break;
    }

    rows.push([match[1] ?? "", (match[2] ?? "").replace(EM_DASH, STATED_DASH)]);
  }

  return rows;
}

When(
  "the user types the slash command prefix {string} in pi's terminal",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, prefix: string): Promise<void> {
    const tui = await this.startTuiSession();
    await tui.waitForText(RESOURCES_LISTED, RESOURCES_MS);
    const beforePrefix = tui.markOutput();
    tui.typeText(prefix);
    await tui.waitForTextAfter(MENU_MARKER, beforePrefix, MENU_MS);
    await tui.waitForQuiet(MENU_QUIET_MS, MENU_SETTLE_MS);
  },
);

// Every row of the menu, in Pi's order, as Pi renders it: the command without
// its slash, then the argument hint, Pi's source tag, and the description,
// with an em dash stated as `--`.
Then(
  "pi's terminal menu offers these slash commands:",
  function (this: ScenarioWorld, table: DataTable): void {
    const rows = menuRows(this.requireTuiSession().text);
    assert.deepStrictEqual([["command", "text"], ...rows], table.raw());
  },
);
