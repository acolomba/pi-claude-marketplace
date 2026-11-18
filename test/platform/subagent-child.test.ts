import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isSubagentChild,
  subagentParentSessionId,
} from "../../extensions/pi-claude-marketplace/platform/subagent-child.ts";

import type { SubagentChildEnv } from "../../extensions/pi-claude-marketplace/platform/subagent-child.ts";

describe("isSubagentChild", () => {
  test('MGRT-02: PI_SUBAGENT_CHILD "1" marks a pi-subagents background child', () => {
    // arrange
    const env = { PI_SUBAGENT_CHILD: "1" } satisfies SubagentChildEnv;

    // act
    const subagentChild = isSubagentChild(env);

    // assert
    assert.strictEqual(subagentChild, true);
  });

  for (const { label, env } of [
    { label: "an absent variable", env: {} },
    { label: '""', env: { PI_SUBAGENT_CHILD: "" } },
    { label: '"0"', env: { PI_SUBAGENT_CHILD: "0" } },
    { label: '"true"', env: { PI_SUBAGENT_CHILD: "true" } },
    { label: '" 1"', env: { PI_SUBAGENT_CHILD: " 1" } },
    { label: '"1 "', env: { PI_SUBAGENT_CHILD: "1 " } },
  ] satisfies { label: string; env: SubagentChildEnv }[]) {
    test(`MGRT-02: PI_SUBAGENT_CHILD ${label} does not mark a pi-subagents background child`, () => {
      // arrange
      const childEnv = env;

      // act
      const subagentChild = isSubagentChild(childEnv);

      // assert
      assert.strictEqual(subagentChild, false);
    });
  }
});

describe("subagentParentSessionId", () => {
  test("D-PG6-02: PI_SUBAGENT_PARENT_SESSION names the launching session's id", () => {
    // arrange
    const env = { PI_SUBAGENT_PARENT_SESSION: "session-1" } satisfies SubagentChildEnv;

    // act
    const parentSessionId = subagentParentSessionId(env);

    // assert
    assert.strictEqual(parentSessionId, "session-1");
  });

  for (const { label, env } of [
    { label: "an absent variable", env: {} },
    { label: "an empty value", env: { PI_SUBAGENT_PARENT_SESSION: "" } },
    {
      label: "a value with a slash",
      env: { PI_SUBAGENT_PARENT_SESSION: "/sessions/session-1.jsonl" },
    },
    {
      label: "a value with a backslash",
      env: { PI_SUBAGENT_PARENT_SESSION: "C:\\sessions\\session-1.jsonl" },
    },
  ] satisfies { label: string; env: SubagentChildEnv }[]) {
    test(`D-PG6-02: ${label} names no launching session id`, () => {
      // arrange
      const childEnv = env;

      // act
      const parentSessionId = subagentParentSessionId(childEnv);

      // assert
      assert.strictEqual(parentSessionId, undefined);
    });
  }
});
