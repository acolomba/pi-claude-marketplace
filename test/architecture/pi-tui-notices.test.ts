/** @fileoverview Pins the TUI notice-text oracle and its emission-count limit. */

import assert from "node:assert/strict";
import { test } from "node:test";

import { backgroundUpdateNoticeTexts } from "../../features/lib/pi-tui.ts";

function screenWrite(notice: string): string {
  return `\u001b[?2026h\u001b[34;1H\u001b[2K \u001b[39m\u001b[2m${notice}\u001b[22;39m\u001b[0m\u001b]8;;\u0007\u001b[37;1H\u001b[?25l\u001b[?2026l`;
}

test("reads no background notice from unrelated terminal output", () => {
  // arrange
  const output = screenWrite("Plugin list");

  // act
  const notices = backgroundUpdateNoticeTexts(output);

  // assert
  assert.deepStrictEqual(notices, []);
});

test("identical screen writes cannot prove how many notices were emitted", () => {
  // arrange
  const notice = "Plugin updated: demo · Run /reload to apply";
  const output = `${screenWrite(notice)}\r\n${screenWrite(notice)}`;

  // act
  const notices = backgroundUpdateNoticeTexts(output);

  // assert
  assert.deepStrictEqual(notices, [notice]);
});

test("accepts repeated redraws of the combined notice", () => {
  // arrange
  const notice = "Plugins updated: alpha and beta · Run /reload to apply";
  const output = screenWrite(notice) + screenWrite(notice);

  // act
  const notices = backgroundUpdateNoticeTexts(output);

  // assert
  assert.deepStrictEqual(notices, [notice]);
});

test("separate notices for distinct plugins cannot pass the combined-notice assertion", () => {
  // arrange
  const alpha = "Plugin updated: alpha · Run /reload to apply";
  const beta = "Plugin updated: beta · Run /reload to apply";
  const output = screenWrite(alpha) + screenWrite(beta);

  // act
  const notices = backgroundUpdateNoticeTexts(output);

  // assert
  assert.deepStrictEqual(notices, [alpha, beta]);
  assert.throws(() => {
    assert.deepStrictEqual(notices, ["Plugins updated: alpha and beta · Run /reload to apply"]);
  }, assert.AssertionError);
});
