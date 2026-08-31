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
