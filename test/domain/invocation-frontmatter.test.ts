import assert from "node:assert/strict";
import { test } from "node:test";

import { droppedInvocationFieldsWarning } from "../../extensions/pi-claude-marketplace/domain/invocation-frontmatter.ts";

interface WarningRow {
  readonly behavior: string;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly warning: string | undefined;
}

const ROWS: readonly WarningRow[] = [
  {
    behavior: "lists the unhonored fields and leaves allowed-tools out",
    frontmatter: {
      name: "greet",
      description: "Greets.",
      model: "x",
      "allowed-tools": "Bash",
      hooks: {},
    },
    warning: "[greet] dropped fields: model, hooks",
  },
  {
    behavior: "lists all eight unhonored fields in frontmatter key order",
    frontmatter: {
      paths: "src/**",
      background: true,
      hooks: {},
      "disallowed-tools": "Bash",
      context: "fork",
      model: "x",
      agent: "a",
      effort: "high",
    },
    warning:
      "[greet] dropped fields: paths, background, hooks, disallowed-tools, context, model, agent, effort",
  },
  {
    behavior: "gives no warning for fields Pi reads or the bridge honors",
    frontmatter: {
      arguments: "a b",
      shell: "bash",
      "user-invocable": false,
      "argument-hint": "x",
      "disable-model-invocation": true,
    },
    warning: undefined,
  },
  {
    behavior: "gives no warning for empty frontmatter",
    frontmatter: {},
    warning: undefined,
  },
];

for (const { behavior, frontmatter, warning } of ROWS) {
  test(`D-CF1-05: ${behavior}`, () => {
    // arrange
    const expectedWarning = warning;

    // act
    const droppedWarning = droppedInvocationFieldsWarning("greet", frontmatter);

    // assert
    assert.strictEqual(droppedWarning, expectedWarning);
  });
}

test("D-CF1-05: ignores an unhonored field that only the prototype carries", () => {
  // arrange
  const frontmatter: Record<string, unknown> = {};
  Object.setPrototypeOf(frontmatter, { model: "x" });

  // act
  const droppedWarning = droppedInvocationFieldsWarning("greet", frontmatter);

  // assert
  assert.strictEqual(droppedWarning, undefined);
});
