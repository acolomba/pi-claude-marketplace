/**
 * @fileoverview Steps about Pi's terminal slash menu: typing the prefix of a
 * slash command and reading the menu rows Pi renders for it.
 */

import assert from "node:assert/strict";

import { type DataTable, Then, When } from "@cucumber/cucumber";

import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { PiTuiSession } from "../../lib/pi-tui.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Pi lists its loaded resources, ending with `[Extensions]`, once the
// extensions' `session_start` handlers ran and its autocomplete was set up.
// The default readiness text follows it, so this wait returns at once; it
// states the precondition the typed prefix relies on.
const RESOURCES_LISTED = "[Extensions]";
const RESOURCES_MS = 10_000;

// Pi shows its completion menu once it has the suggestions for the typed
// prefix, and the menu is complete when the output stays unchanged for a
// while. Pi draws the menu itself, so the step reads its rows without relying
// on its marker glyph, its spacing, or its decorations: see `menuRows`.
const MENU_MS = 10_000;
const MENU_QUIET_MS = 250;
const MENU_SETTLE_MS = 5_000;

// The pseudoterminal is 120 columns wide, and Pi pads every menu row to it.
const TERMINAL_COLUMNS = 120;

// The selected row of a menu: a marker of one or two marks, then the
// command, which names its plugin before a colon as every command of this
// extension does. A mark is any character but a space, a letter, a digit, or
// one that ends a sentence or a quote, so the end of a row's text before the
// next row's command never reads as a marker.
const SELECTED_ROW = /[^\s\p{L}\p{N}.,;:!?)\]}"'/]{1,2} {1,3}\/?[\p{L}\p{N}_][^\s:]*:\S+/gu;

// One row of the menu: a marker or spaces, the command, then its text.
const MENU_ROW = /^([^\s\p{L}\p{N}]{0,2} *)(\S+)(?: +(.*?))? *$/u;

// Pi tags a command's description with its source, such as `[t]`, `[u]`, or
// `[p:npm:<package>]`: a bracketed word that holds no space. And it joins an
// argument hint and a description with a dash or a similar mark between
// spaces. Neither is something this extension writes.
const SOURCE_TAG = /(?:^|\s)\[[a-z]+(?::[^\s\]]*)?\](?:\s|$)/u;
const HINT_SEPARATOR = /^(.*?)\s+(?:\p{Pd}+|\||·)(?:\s+(.*))?$/u;
const TRAILING_SEPARATOR = /\s*(?:\p{Pd}+|\||·)$/u;

/** What one menu row shows of a command: its argument hint and its description. */
type MenuRow = [command: string, argumentHint: string, description: string];

// The argument hint and the description in the text of one menu row, with
// Pi's source tag and separator left out. Pi's tag starts the description,
// so with a tag the hint is the text before it and the description the text
// after it. With no tag, text with no separator is the description alone; a
// description that holds a dash between spaces would then read as a hint and
// the rest, and no scenario's untagged description does.
function hintAndDescription(text: string): [string, string] {
  const tag = SOURCE_TAG.exec(text);
  if (tag !== null) {
    const before = text.slice(0, tag.index).replace(TRAILING_SEPARATOR, "").trim();
    const after = text.slice(tag.index + tag[0].length).trim();
    if (before !== "" || after !== "") {
      return after === "" ? hintAndDescription(before) : [before, after];
    }
  }

  const untagged = text.replace(/\s+/gu, " ").trim();
  const separated = HINT_SEPARATOR.exec(untagged);
  if (separated === null) {
    return ["", untagged];
  }

  return [separated[1] ?? "", separated[2] ?? ""];
}

/**
 * The rows of the last menu Pi drew: from its last selected row, one
 * terminal line per row, while each line holds a command at the column of
 * the selected row's command with only spaces before it. A terminal with no
 * selected row fails the step.
 */
function menuRows(terminalText: string): MenuRow[] {
  const start = [...terminalText.matchAll(SELECTED_ROW)].at(-1)?.index;
  if (start === undefined) {
    assert.fail(`pi's terminal shows no slash menu:\n${terminalText}`);
  }

  const rows: MenuRow[] = [];
  let commandColumn: number | undefined;
  for (let line = start; line < terminalText.length; line += TERMINAL_COLUMNS) {
    const match = MENU_ROW.exec(terminalText.slice(line, line + TERMINAL_COLUMNS));
    const lead = match?.[1] ?? "";
    commandColumn ??= lead.length;
    if (
      match === null ||
      lead.length !== commandColumn ||
      (rows.length > 0 && lead.trim() !== "")
    ) {
      break;
    }

    rows.push([(match[2] ?? "").replace(/^\//u, ""), ...hintAndDescription(match[3] ?? "")]);
  }

  return rows;
}

// How many times Pi has drawn a selected menu row so far.
function selectedRowCount(tui: PiTuiSession): number {
  return [...tui.text.matchAll(SELECTED_ROW)].length;
}

// Waits until Pi draws a menu after `drawn` earlier selected rows, checking
// each time its output goes quiet, and then until the menu stays unchanged.
async function waitForMenu(tui: PiTuiSession, drawn: number): Promise<void> {
  const deadline = Date.now() + MENU_MS;
  while (selectedRowCount(tui) <= drawn) {
    if (Date.now() > deadline) {
      assert.fail(`pi drew no slash menu in ${MENU_MS} ms:\n${tui.text}`);
    }

    await tui.waitForQuiet(MENU_QUIET_MS, MENU_SETTLE_MS);
  }

  await tui.waitForQuiet(MENU_QUIET_MS, MENU_SETTLE_MS);
}

When(
  "the user types the slash command prefix {string} in pi's terminal",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, prefix: string): Promise<void> {
    const tui = await this.startTuiSession();
    await tui.waitForText(RESOURCES_LISTED, RESOURCES_MS);
    const drawn = selectedRowCount(tui);
    tui.typeText(prefix);
    await waitForMenu(tui, drawn);
  },
);

// Every row of the menu, in Pi's order: the command without its slash, then
// the argument hint and the description this extension gave it. Pi's marker,
// source tag, and separator are left out.
Then(
  "pi's terminal menu offers these slash commands:",
  function (this: ScenarioWorld, table: DataTable): void {
    const rows = menuRows(this.requireTuiSession().text);
    assert.deepStrictEqual([["command", "argument hint", "description"], ...rows], table.raw());
  },
);
