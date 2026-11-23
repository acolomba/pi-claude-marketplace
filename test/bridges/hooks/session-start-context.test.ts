import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  asyncAnswerHeld,
  sessionStartValues,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts";

import type { AsyncAnswerHook } from "../../../extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts";
import type { AgentMessage } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// The hook whose answer each `asyncAnswerHeld` case checks.
const NOTES_HOOK = {
  pluginId: "notes",
  marketplace: "tools",
  command: "/hooks/notes-start",
} satisfies AsyncAnswerHook;

// A message of the synchronous SessionStart context, as Pi's projection
// gives it back: one labeled part for `texts`, with `details`.
function syncContext(texts: readonly string[], details?: unknown): AgentMessage {
  return {
    role: "custom",
    customType: "claude-hook-additional-context",
    content: [{ type: "text", text: `SessionStart hook additional context: ${texts.join("\n")}` }],
    display: false,
    details,
    timestamp: 0,
  };
}

// A message of an async SessionStart answer of `hook` that holds `values`.
function asyncAnswer(hook: AsyncAnswerHook, values: readonly string[]): AgentMessage {
  return {
    role: "custom",
    customType: "claude-hook-async-response",
    content: values.at(-1) ?? "",
    display: false,
    details: { ...hook, dispatchId: "dispatch-earlier", event: "SessionStart", values },
    timestamp: 0,
  };
}

function prompt(text: string): AgentMessage {
  return { role: "user", content: text, timestamp: 0 };
}

describe("sessionStartValues", () => {
  test("gives the values of the details when they join to the labeled text", () => {
    // arrange
    const message = syncContext(["alpha", "beta"], {
      event: "SessionStart",
      values: ["alpha", "beta"],
    });

    // act
    const values = sessionStartValues(message);

    // assert
    assert.deepStrictEqual(values, ["alpha", "beta"]);
  });

  test("gives the whole labeled text when an edit changed it", () => {
    // arrange
    const message = syncContext(["alpha"], { event: "SessionStart", values: ["alpha", "beta"] });

    // act
    const values = sessionStartValues(message);

    // assert
    assert.deepStrictEqual(values, ["alpha"]);
  });

  test("reads text content as one part", () => {
    // arrange
    const message: AgentMessage = {
      role: "custom",
      customType: "claude-hook-additional-context",
      content: "SessionStart hook additional context: gamma",
      display: false,
      timestamp: 0,
    };

    // act
    const values = sessionStartValues(message);

    // assert
    assert.deepStrictEqual(values, ["gamma"]);
  });

  test("gives nothing for a part with another label or an image", () => {
    // arrange
    const message: AgentMessage = {
      role: "custom",
      customType: "claude-hook-additional-context",
      content: [
        { type: "text", text: "UserPromptSubmit hook additional context: delta" },
        { type: "image", data: "aGk=", mimeType: "image/png" },
      ],
      display: false,
      timestamp: 0,
    };

    // act
    const values = sessionStartValues(message);

    // assert
    assert.deepStrictEqual(values, []);
  });

  for (const { kind, details } of [
    { kind: "another event", details: { event: "Stop", values: ["epsilon"] } },
    { kind: "values that are text", details: { event: "SessionStart", values: "epsilon" } },
    { kind: "a value that is a number", details: { event: "SessionStart", values: [7] } },
    { kind: "no values", details: { event: "SessionStart" } },
    { kind: "null", details: null },
  ]) {
    test(`gives the whole labeled text for details with ${kind}`, () => {
      // arrange
      const message = syncContext(["epsilon"], details);

      // act
      const values = sessionStartValues(message);

      // assert
      assert.deepStrictEqual(values, ["epsilon"]);
    });
  }

  test("gives nothing for an async answer or a prompt", () => {
    // arrange
    const messages = [asyncAnswer(NOTES_HOOK, ["zeta"]), prompt("zeta")];

    // act
    const values = messages.map(sessionStartValues);

    // assert
    assert.deepStrictEqual(values, [[], []]);
  });
});

describe("asyncAnswerHeld", () => {
  for (const { title, messages, texts, held } of [
    {
      title: "holds an answer that the same hook gave before",
      messages: [prompt("first"), asyncAnswer(NOTES_HOOK, ["kept", "note"]), prompt("second")],
      texts: ["kept", "note"],
      held: true,
    },
    {
      title: "holds an answer whose texts a synchronous context holds",
      messages: [
        syncContext(["kept", "other"], { event: "SessionStart", values: ["kept", "other"] }),
      ],
      texts: ["kept"],
      held: true,
    },
    {
      title: "does not hold an answer when one of its texts is new",
      messages: [asyncAnswer(NOTES_HOOK, ["kept"])],
      texts: ["kept", "new"],
      held: false,
    },
    {
      title: "decides by the nearest context, not an older one",
      messages: [asyncAnswer(NOTES_HOOK, ["kept"]), syncContext(["other"])],
      texts: ["kept"],
      held: false,
    },
    {
      title: "skips the answer of another command of the plugin",
      messages: [
        asyncAnswer(NOTES_HOOK, ["kept"]),
        asyncAnswer({ ...NOTES_HOOK, command: "/hooks/other-start" }, ["other"]),
      ],
      texts: ["kept"],
      held: true,
    },
    {
      title: "skips the answer of a plugin of the same name from another marketplace",
      messages: [
        asyncAnswer(NOTES_HOOK, ["kept"]),
        asyncAnswer({ ...NOTES_HOOK, marketplace: "mirror" }, ["other"]),
      ],
      texts: ["kept"],
      held: true,
    },
    {
      title: "skips the answer of another plugin",
      messages: [asyncAnswer({ ...NOTES_HOOK, pluginId: "lint" }, ["kept"])],
      texts: ["kept"],
      held: false,
    },
    {
      title: "skips a synchronous message with no session start part",
      messages: [
        asyncAnswer(NOTES_HOOK, ["kept"]),
        {
          role: "custom",
          customType: "claude-hook-additional-context",
          content: [{ type: "text", text: "UserPromptSubmit hook additional context: other" }],
          display: false,
          timestamp: 0,
        } satisfies AgentMessage,
      ],
      texts: ["kept"],
      held: true,
    },
    {
      title: "does not read an answer whose details name no session start",
      messages: [
        {
          role: "custom",
          customType: "claude-hook-async-response",
          content: "kept",
          display: false,
          details: { pluginId: "notes", dispatchId: "dispatch-old" },
          timestamp: 0,
        } satisfies AgentMessage,
      ],
      texts: ["kept"],
      held: false,
    },
    {
      title: "does not read an answer whose details name no command",
      messages: [
        {
          role: "custom",
          customType: "claude-hook-async-response",
          content: "kept",
          display: false,
          details: {
            pluginId: "notes",
            marketplace: "tools",
            event: "SessionStart",
            values: ["kept"],
          },
          timestamp: 0,
        } satisfies AgentMessage,
      ],
      texts: ["kept"],
      held: false,
    },
    { title: "holds nothing in an empty conversation", messages: [], texts: ["kept"], held: false },
    {
      title: "never holds an answer with no text",
      messages: [asyncAnswer(NOTES_HOOK, ["kept"])],
      texts: [],
      held: false,
    },
  ] satisfies ReadonlyArray<{
    readonly title: string;
    readonly messages: readonly AgentMessage[];
    readonly texts: readonly string[];
    readonly held: boolean;
  }>) {
    test(title, () => {
      // arrange
      const expectedHeld = held;

      // act
      const answerHeld = asyncAnswerHeld(messages, NOTES_HOOK, texts);

      // assert
      assert.strictEqual(answerHeld, expectedHeld);
    });
  }
});
