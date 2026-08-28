import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { HOOKS_VALIDATOR } from "../../../../extensions/pi-claude-marketplace/domain/components/hooks/schema.ts";

describe("HOOKS_VALIDATOR", () => {
  for (const { role, config } of [
    { role: "an empty configuration", config: {} },
    { role: "an empty event", config: { SessionStart: [] } },
    {
      role: "a command handler",
      config: {
        PreToolUse: [
          {
            matcher: "Edit",
            hooks: [{ type: "command", command: "/bin/true" }],
          },
        ],
      },
    },
    {
      role: "an unknown handler type without a command",
      config: {
        PreToolUse: [{ hooks: [{ type: "future-handler" }] }],
      },
    },
    {
      role: "unknown fields at every level",
      config: {
        FutureEvent: [
          {
            futureGroupField: true,
            hooks: [
              {
                type: "command",
                command: "/bin/true",
                futureHandlerField: { nested: true },
              },
            ],
          },
        ],
      },
    },
    {
      role: "all optional group fields",
      config: {
        PreToolUse: [
          {
            matcher: "Edit",
            statusMessage: "running",
            once: true,
            async: false,
            shell: "/bin/bash",
            args: ["-c", "true"],
            hooks: [{ type: "command", command: "/bin/true" }],
          },
        ],
      },
    },
    {
      role: "all optional handler fields",
      config: {
        PreToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "/bin/true",
                if: "tool == 'Edit'",
                statusMessage: "running",
                once: true,
                async: false,
                shell: "/bin/bash",
                args: ["-c", "true"],
                timeout: "30",
                asyncRewake: "yes",
                rewakeMessage: 42,
                rewakeSummary: null,
              },
            ],
          },
        ],
      },
    },
  ]) {
    test(`accepts ${role}`, () => {
      // arrange

      // act
      const accepted = HOOKS_VALIDATOR.Check(config);

      // assert
      assert.strictEqual(accepted, true);
    });
  }

  for (const { role, config } of [
    { role: "null", config: null },
    { role: "a top-level array", config: [] },
    { role: "a non-array event", config: { PreToolUse: "invalid" } },
    { role: "a group without handlers", config: { PreToolUse: [{}] } },
    {
      role: "a group with a non-string matcher",
      config: { PreToolUse: [{ matcher: 1, hooks: [] }] },
    },
    { role: "a handler without a type", config: { PreToolUse: [{ hooks: [{}] }] } },
    {
      role: "a handler with a non-string type",
      config: { PreToolUse: [{ hooks: [{ type: 1 }] }] },
    },
    {
      role: "a command handler without a command",
      config: { PreToolUse: [{ hooks: [{ type: "command" }] }] },
    },
    {
      role: "a command handler with a non-string command",
      config: { PreToolUse: [{ hooks: [{ type: "command", command: 1 }] }] },
    },
    {
      role: "a handler with a non-string if condition",
      config: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/bin/true", if: true }] }],
      },
    },
  ]) {
    test(`rejects ${role}`, () => {
      // arrange

      // act
      const accepted = HOOKS_VALIDATOR.Check(config);

      // assert
      assert.strictEqual(accepted, false);
    });
  }
});
