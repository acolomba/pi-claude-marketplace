/**
 * @fileoverview Drives the `/claude:plugin browse` picker in a real terminal
 * as a user does, reading it from the terminal's current screen.
 *
 * The picker draws each screen in a frame: a border row, its title, its rows,
 * its key hint, and a border row. It takes the place of Pi's editor, so the
 * last two border rows on the screen are its frame while it is open. A row is
 * its label and its description, two columns the picker aligns, and the
 * selected row starts with an arrow. Every text the driver reads there is the
 * extension's own.
 */

import assert from "node:assert/strict";

import type { PiTuiSession } from "./pi-tui.ts";

/** One row of a picker screen. */
export interface PickerRow {
  readonly label: string;
  readonly description: string;
  readonly selected: boolean;
}

/** One picker screen: its title and its rows in screen order. */
export interface PickerScreen {
  readonly title: string;
  readonly rows: readonly PickerRow[];
}

const FIRST_TITLE = "Browse Claude Plugin Marketplaces";

// The hint the picker shows while it loads a marketplace's plugins.
const LOADING_HINT = "loading…";

// The picker has four screens: marketplaces, plugins, actions, and scopes.
const SCREEN_COUNT = 4;

// Pi-tui reads these bytes as the arrow keys, Enter, and Escape.
const DOWN_KEY = "\u001b[B";
const UP_KEY = "\u001b[A";
const ENTER_KEY = "\r";
const ESCAPE_KEY = "\u001b";

// A redraw follows a keystroke within milliseconds; the deadline covers a
// plugin list that loads from disk and an install that the choice runs.
const PICKER_QUIET_MS = 500;
const PICKER_STEP_MS = 20_000;

const SELECTED_PREFIX = "→ ";

function isBorder(line: string): boolean {
  return /^─+$/u.test(line);
}

function pickerRow(line: string): PickerRow {
  const selected = line.startsWith(SELECTED_PREFIX);
  const [label = "", description = ""] = line.slice(SELECTED_PREFIX.length).split(/ {2,}/u);
  return { label, description, selected };
}

// The picker's frame on `lines`: its title, its hint, and the rows between
// them, or undefined when the picker is not open. Pi's editor frame holds one
// row, the picker's at least a title and a hint.
function pickerFrame(
  lines: readonly string[],
): { readonly title: string; readonly hint: string; readonly rows: readonly string[] } | undefined {
  const borders = lines.flatMap((line, index) => (isBorder(line) ? [index] : []));
  const [top, bottom] = borders.slice(-2);
  if (top === undefined || bottom === undefined || bottom - top < 3) {
    return undefined;
  }

  const inner = lines.slice(top + 1, bottom).filter((line) => line.trim() !== "");
  const title = inner[0]?.trim() ?? "";
  const hint = inner.at(-1)?.trim() ?? "";
  return { title, hint, rows: inner.slice(1, -1) };
}

/**
 * Returns the picker screen on `lines`, the terminal's current screen, or
 * undefined when the picker is not open or is still loading.
 */
function readPickerScreen(lines: readonly string[]): PickerScreen | undefined {
  const frame = pickerFrame(lines);
  if (frame === undefined || frame.hint === LOADING_HINT) {
    return undefined;
  }

  return { title: frame.title, rows: frame.rows.map(pickerRow) };
}

/** Returns the picker screen the terminal shows now, and fails when the picker is not open. */
export function currentPickerScreen(tui: PiTuiSession): PickerScreen {
  const screen = readPickerScreen(tui.screenLines());
  if (screen === undefined) {
    assert.fail(`the plugin picker is not open:\n${tui.screenLines().join("\n")}`);
  }

  return screen;
}

// Waits until the picker shows a screen other than the one titled `title`,
// or has closed, and the terminal is quiet.
async function waitForScreenChange(tui: PiTuiSession, title: string): Promise<void> {
  await tui.waitForScreen(
    (lines) => {
      const frame = pickerFrame(lines);
      return frame === undefined || (frame.title !== title && frame.hint !== LOADING_HINT);
    },
    PICKER_STEP_MS,
    `the plugin picker to leave the screen ${title}`,
  );
  await tui.waitForQuiet(PICKER_QUIET_MS, PICKER_STEP_MS);
}

/** Types `command` and waits until the picker shows its first screen. */
export async function openPicker(tui: PiTuiSession, command: string): Promise<void> {
  tui.sendLine(command);
  await tui.waitForScreen(
    (lines) => readPickerScreen(lines)?.title === FIRST_TITLE,
    PICKER_STEP_MS,
    "the plugin picker",
  );
  await tui.waitForQuiet(PICKER_QUIET_MS, PICKER_STEP_MS);
}

/**
 * Moves the selection to the row labeled `label` and presses Enter, then
 * waits until the next screen shows or the picker closes. Fails when no row
 * or more than one row has the label.
 */
export async function choosePickerRow(tui: PiTuiSession, label: string): Promise<void> {
  const { title, rows } = currentPickerScreen(tui);
  const labels = rows.map((row) => row.label);
  const target = labels.indexOf(label);
  if (target === -1 || labels.lastIndexOf(label) !== target) {
    assert.fail(`the screen ${title} has no single row ${label}: ${JSON.stringify(labels)}`);
  }

  const delta = target - rows.findIndex((row) => row.selected);
  tui.typeText((delta > 0 ? DOWN_KEY : UP_KEY).repeat(Math.abs(delta)));
  await tui.waitForScreen(
    (lines) => readPickerScreen(lines)?.rows[target]?.selected === true,
    PICKER_STEP_MS,
    `the row ${label} selected`,
  );
  tui.typeText(ENTER_KEY);
  await waitForScreenChange(tui, title);
  if (pickerFrame(tui.screenLines()) === undefined) {
    await waitForActionNotice(tui, title);
  }
}

// Waits until the notice of the action the picker closed on shows, and the
// terminal is quiet. The action and scope screens name their plugin in their
// title (`Action: <plugin> @ <marketplace>`), and the notice of every action
// names it on a row of its own.
async function waitForActionNotice(tui: PiTuiSession, title: string): Promise<void> {
  const plugin = /(\S+) @ \S+/u.exec(title)?.[1];
  if (plugin === undefined) {
    assert.fail(`the plugin picker closed on the screen ${title}, which names no plugin`);
  }

  await tui.waitForScreen(
    (lines) => lines.some((line) => line.trim().split(/\s+/u).includes(plugin)),
    PICKER_STEP_MS,
    `the notice about ${plugin}`,
  );
  await tui.waitForQuiet(PICKER_QUIET_MS, PICKER_STEP_MS);
}

/** Presses Escape until the picker closes, at most once per screen. */
export async function cancelPicker(tui: PiTuiSession): Promise<void> {
  for (let press = 0; press < SCREEN_COUNT; press += 1) {
    const screen = readPickerScreen(tui.screenLines());
    if (screen === undefined) {
      return;
    }

    tui.typeText(ESCAPE_KEY);
    await waitForScreenChange(tui, screen.title);
  }

  assert.equal(readPickerScreen(tui.screenLines()), undefined, "the plugin picker stayed open");
}
