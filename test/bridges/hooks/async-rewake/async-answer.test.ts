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

const BOTH_TEXTS = [
  { source: "systemMessage", text: "remember the tests" },
  { source: "additionalContext", text: "tests live in test" },
] as const;

const cases: ReadonlyArray<
  readonly [string, string, readonly { readonly source: string; readonly text: string }[]]
> = [
  ["an object with both fields", BOTH, BOTH_TEXTS],
  [
    "only a system message",
    JSON.stringify({ systemMessage: "only" }),
    [{ source: "systemMessage", text: "only" }],
  ],
  [
    "only additional context",
    JSON.stringify({ hookSpecificOutput: { additionalContext: "context" } }),
    [{ source: "additionalContext", text: "context" }],
  ],
  [
    "empty and non-string fields",
    JSON.stringify({ systemMessage: "", hookSpecificOutput: { additionalContext: 7 } }),
    [],
  ],
  [
    "an empty context beside a system message",
    JSON.stringify({ systemMessage: "kept", hookSpecificOutput: { additionalContext: "" } }),
    [{ source: "systemMessage", text: "kept" }],
  ],
  ["the rest after a first async line", `{"async":true}\n${BOTH}`, BOTH_TEXTS],
  [
    "a later object line",
    `starting\n${JSON.stringify({ systemMessage: "later" })}`,
    [{ source: "systemMessage", text: "later" }],
  ],
  ["never an async object", `{"async":true,"systemMessage":"no"}`, []],
  ["never an array", `["a"]`, []],
  ["never a number", "42", []],
  ["never plain text", "plain text", []],
  ["nothing", "", []],
  [
    "a decision that changes nothing",
    JSON.stringify({ decision: "block", reason: "x", systemMessage: "still" }),
    [{ source: "systemMessage", text: "still" }],
  ],
  ["broken JSON", "{not json}", []],
];

for (const [name, stdout, texts] of cases) {
  test(`reads ${name} with the field of each text (D-BG-205, D-PG5-14)`, () => {
    assert.deepStrictEqual(asyncAnswerTexts(stdout, "UserPromptSubmit"), texts);
  });
}
