import assert from "node:assert/strict";
import { test } from "node:test";

import { assertNever } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";

import type { HookExecResult } from "../../../extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts";

void ({ kind: "noop" } satisfies HookExecResult);
void ({ kind: "noop", suppressOutput: true } satisfies HookExecResult);

void ({ kind: "block" } satisfies HookExecResult);
void ({ kind: "block", reason: "operation refused" } satisfies HookExecResult);

void ({
  kind: "mutate",
  updatedInput: { command: "check" },
  updatedToolOutput: { content: [{ type: "text", text: "checked" }] },
  additionalContext: "review completed",
  permissionDecision: "allow",
  permissionDecisionReason: "safe operation",
} satisfies HookExecResult);
void ({ kind: "mutate", permissionDecision: "deny" } satisfies HookExecResult);
void ({ kind: "mutate", permissionDecision: "ask" } satisfies HookExecResult);

void ({ kind: "stop" } satisfies HookExecResult);
void ({ kind: "stop", stopReason: "hook requested stop" } satisfies HookExecResult);

// @ts-expect-error a hook result always carries its discriminant
void ({ reason: "operation refused" } satisfies HookExecResult);
// @ts-expect-error hook results have a closed discriminant set
void ({ kind: "continue" } satisfies HookExecResult);
// @ts-expect-error mutation data does not identify an arm without its required kind
void ({ updatedInput: { command: "check" } } satisfies HookExecResult);
// @ts-expect-error block results cannot carry fields from the noop arm
void ({ kind: "block", suppressOutput: true } satisfies HookExecResult);
// @ts-expect-error permission decisions use the closed allow, deny, and ask vocabulary
void ({ kind: "mutate", permissionDecision: "prompt" } satisfies HookExecResult);

test("throws the serialized impossible hook result", () => {
  // arrange
  const impossibleHookExecResult = { kind: "future" } as never;

  // act & assert
  assert.throws(
    () => assertNever(impossibleHookExecResult),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.constructor, Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message, cause: error.cause },
        {
          name: "Error",
          message: 'unreachable HookExecResult arm: {"kind":"future"}',
          cause: undefined,
        },
      );
      return true;
    },
  );
});
