/** @fileoverview Pins the screen model that the terminal driver reads the current screen through. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { terminalScreen } from "../../features/lib/pi-tui.ts";

test("replays plain lines from the top of the screen", () => {
  // arrange
  const output = "first\r\nsecond";

  // act
  const screen = terminalScreen(output, 3, 10);

  // assert
  assert.deepStrictEqual(screen, ["first", "second", ""]);
});

test("reads a row a differential redraw rewrote as its last value", () => {
  // arrange
  const output = "status: old\r\nprompt\r\n\u001b[2A\r\u001b[2Kstatus: new\u001b[2B\r";

  // act
  const screen = terminalScreen(output, 4, 20);

  // assert
  assert.deepStrictEqual(screen, ["status: new", "prompt", "", ""]);
});

test("replays absolute positioning with an erased line", () => {
  // arrange
  const output = "keep\r\nstale text\u001b[2;1H\u001b[2K fresh\u001b[3;5Hx\u001b[1;3fY";

  // act
  const screen = terminalScreen(output, 3, 12);

  // assert
  assert.deepStrictEqual(screen, ["keYp", " fresh", "    x"]);
});

test("moves the cursor forward, back, and to a column", () => {
  // arrange
  const output = "abcdef\u001b[3DX\u001b[2CY\u001b[1GZ";

  // act
  const screen = terminalScreen(output, 1, 10);

  // assert
  assert.deepStrictEqual(screen, ["ZbcXefY"]);
});

test("scrolls up when a line feed reaches past the bottom row", () => {
  // arrange
  const output = "one\r\ntwo\r\nthree\r\nfour";

  // act
  const screen = terminalScreen(output, 3, 10);

  // assert
  assert.deepStrictEqual(screen, ["two", "three", "four"]);
});

test("wraps a character past the right edge onto the next row", () => {
  // arrange
  const output = "abcdefgh\r\nnext";

  // act
  const screen = terminalScreen(output, 3, 4);

  // assert
  assert.deepStrictEqual(screen, ["abcd", "efgh", "next"]);
});

test("erases the display below, above, and whole", () => {
  // arrange
  const below = "aaa\r\nbbb\r\nccc\u001b[2;2H\u001b[J";
  const above = "aaa\r\nbbb\r\nccc\u001b[2;2H\u001b[1J";
  const whole = "aaa\r\nbbb\u001b[2J\u001b[Hz";

  // act
  const screens = [below, above, whole].map((output) => terminalScreen(output, 3, 5));

  // assert
  assert.deepStrictEqual(screens, [
    ["aaa", "b", ""],
    ["", "  b", "ccc"],
    ["z", "", ""],
  ]);
});

test("keeps the screen on an erase of the scrollback alone", () => {
  // arrange
  const output = "aaa\r\nbbb\u001b[3J";

  // act
  const screen = terminalScreen(output, 2, 5);

  // assert
  assert.deepStrictEqual(screen, ["aaa", "bbb"]);
});

test("drops C1 control characters", () => {
  // arrange
  const output = "a\u0080b\u009bc\u009fd";

  // act
  const screen = terminalScreen(output, 1, 8);

  // assert
  assert.deepStrictEqual(screen, ["abcd"]);
});

test("erases a line from its start to the cursor", () => {
  // arrange
  const output = "abcdef\u001b[1;3H\u001b[1K";

  // act
  const screen = terminalScreen(output, 1, 8);

  // assert
  assert.deepStrictEqual(screen, ["   def"]);
});

test("drops color, hyperlink, synchronized-output, and mode sequences", () => {
  // arrange
  const output =
    "\u001b[?2026h\u001b[?25l\u001b[1;32mgreen\u001b[0m \u001b]8;;https://example.test\u0007link\u001b]8;;\u0007" +
    "\u001b_Gdata\u001b\\\u001b=\u001b[?2026l";

  // act
  const screen = terminalScreen(output, 1, 20);

  // assert
  assert.deepStrictEqual(screen, ["green link"]);
});

test("gives a box-drawing border and a non-ASCII glyph one column each", () => {
  // arrange
  const output = "╭──╮\r\n│✓ │\r\n╰──╯x";

  // act
  const screen = terminalScreen(output, 3, 6);

  // assert
  assert.deepStrictEqual(screen, ["╭──╮", "│✓ │", "╰──╯x"]);
});

test("removes the trailing spaces of each row", () => {
  // arrange
  const output = "text   \r\n    \r\n  indented  ";

  // act
  const screen = terminalScreen(output, 3, 14);

  // assert
  assert.deepStrictEqual(screen, ["text", "", "  indented"]);
});
