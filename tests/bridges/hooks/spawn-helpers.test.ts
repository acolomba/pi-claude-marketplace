import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { planSpawn } from "../../../extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";

import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";

describe("planSpawn", () => {
  test("uses exec form and stringifies mixed primitive arguments when args are present", () => {
    // arrange
    const entry = {
      scope: "user",
      marketplace: "catalog",
      pluginId: "mixed-arguments",
      resolvedSource: asAbsolutePluginRoot("/plugins/mixed-arguments"),
      claudeEvent: "PreToolUse",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: {
        type: "command",
        command: "/usr/bin/hook-runner",
        args: ["literal", 17, true, null],
        shell: "/bin/zsh",
      },
      declarationIndex: 4,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "/usr/bin/hook-runner",
      args: ["literal", "17", "true", "null"],
      shell: false,
    });
  });

  test("uses exec form when args are an empty array", () => {
    // arrange
    const entry = {
      scope: "project",
      marketplace: "catalog",
      pluginId: "empty-arguments",
      resolvedSource: asAbsolutePluginRoot("/plugins/empty-arguments"),
      claudeEvent: "SessionStart",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: {
        type: "command",
        command: "hook-without-arguments",
        args: [],
      },
      declarationIndex: 0,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "hook-without-arguments",
      args: [],
      shell: false,
    });
  });

  test("uses the default shell form when args are absent", () => {
    // arrange
    const entry = {
      scope: "user",
      marketplace: "catalog",
      pluginId: "default-shell",
      resolvedSource: asAbsolutePluginRoot("/plugins/default-shell"),
      claudeEvent: "UserPromptSubmit",
      matcher: { kind: "match-all" },
      rawMatcher: "prompt",
      handlerDecl: {
        type: "command",
        command: "printf '%s' \"$PROMPT\"",
      },
      declarationIndex: 2,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "printf '%s' \"$PROMPT\"",
      args: [],
      shell: true,
    });
  });

  test("preserves an explicit shell when args are absent", () => {
    // arrange
    const entry = {
      scope: "project",
      marketplace: "catalog",
      pluginId: "explicit-shell",
      resolvedSource: asAbsolutePluginRoot("/plugins/explicit-shell"),
      claudeEvent: "PostCompact",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: {
        type: "command",
        command: "source hook-profile && run-hook",
        shell: "/bin/bash",
      },
      declarationIndex: 7,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "source hook-profile && run-hook",
      args: [],
      shell: "/bin/bash",
    });
  });

  test("uses an empty shell-form command when the command is absent", () => {
    // arrange
    const entry = {
      scope: "user",
      marketplace: "catalog",
      pluginId: "missing-command",
      resolvedSource: asAbsolutePluginRoot("/plugins/missing-command"),
      claudeEvent: "SessionEnd",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: {
        type: "prompt",
      },
      declarationIndex: 1,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "",
      args: [],
      shell: true,
    });
  });

  test("preserves an explicitly empty command in exec form", () => {
    // arrange
    const entry = {
      scope: "project",
      marketplace: "catalog",
      pluginId: "empty-command",
      resolvedSource: asAbsolutePluginRoot("/plugins/empty-command"),
      claudeEvent: "PreCompact",
      matcher: { kind: "match-all" },
      rawMatcher: "",
      handlerDecl: {
        type: "command",
        command: "",
        args: ["--probe"],
      },
      declarationIndex: 9,
      ifPredicate: { kind: "match-all" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "",
      args: ["--probe"],
      shell: false,
    });
  });
});
