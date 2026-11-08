import assert from "node:assert/strict";
import { test } from "node:test";

import { asyncAnswerTexts } from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts";

const BOTH = JSON.stringify({
  systemMessage: "remember the tests",
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: "tests live in test",
  },
});

const cases: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ["an object with both fields", BOTH, ["remember the tests", "tests live in test"]],
  ["only a system message", JSON.stringify({ systemMessage: "only" }), ["only"]],
  [
    "only additional context",
    JSON.stringify({ hookSpecificOutput: { additionalContext: "context" } }),
    ["context"],
  ],
  [
    "empty and non-string fields",
    JSON.stringify({ systemMessage: "", hookSpecificOutput: { additionalContext: 7 } }),
    [],
  ],
  [
    "the rest after a first async line",
    `{"async":true}\n${BOTH}`,
    ["remember the tests", "tests live in test"],
  ],
  ["a later object line", `starting\n${JSON.stringify({ systemMessage: "later" })}`, ["later"]],
  ["never an async object", `{"async":true,"systemMessage":"no"}`, []],
  ["never an array", `["a"]`, []],
  ["never a number", "42", []],
  ["never plain text", "plain text", []],
  ["nothing", "", []],
  [
    "a decision that changes nothing",
    JSON.stringify({ decision: "block", reason: "x", systemMessage: "still" }),
    ["still"],
  ],
  ["broken JSON", "{not json}", []],
];

for (const [name, stdout, texts] of cases) {
  test(`reads ${name}`, () => {
    assert.deepStrictEqual(asyncAnswerTexts(stdout, "UserPromptSubmit"), texts);
  });
}
