import assert from "node:assert/strict";
import test from "node:test";

import { isSubagentChild } from "../../extensions/pi-claude-marketplace/platform/subagent-child.ts";

import type { SubagentChildEnv } from "../../extensions/pi-claude-marketplace/platform/subagent-child.ts";

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
