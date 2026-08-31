import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  planSpawn,
  serializeWithTruncation,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts";
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

describe("serializeWithTruncation", () => {
  test("preserves an object serialized one byte below the stdin cap", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: "b".repeat(stdinCapBytes - 12) };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"text":"${"b".repeat(stdinCapBytes - 12)}"}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes - 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes - 1);
    assert.deepStrictEqual(JSON.parse(serialized), {
      text: "b".repeat(stdinCapBytes - 12),
    });
  });

  test("preserves an object serialized at the exact stdin cap", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: "e".repeat(stdinCapBytes - 11) };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"text":"${"e".repeat(stdinCapBytes - 11)}"}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes);
    assert.deepStrictEqual(JSON.parse(serialized), {
      text: "e".repeat(stdinCapBytes - 11),
    });
  });

  test("marks an object serialized one byte over the cap with the permitted overshoot", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: "o".repeat(stdinCapBytes - 10) };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"text":"${"o".repeat(stdinCapBytes - 10)}","_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes + 19);
    assert.deepStrictEqual(JSON.parse(serialized), {
      text: "o".repeat(stdinCapBytes - 10),
      _truncated: true,
    });
  });

  test("counts multibyte text by UTF-8 bytes before marking it truncated", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: `${"漢".repeat(87_377)}aaa` };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"text":"${"漢".repeat(87_377)}aaa","_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(inputJson.length, 87_391);
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes + 19);
    assert.deepStrictEqual(JSON.parse(serialized), {
      text: `${"漢".repeat(87_377)}aaa`,
      _truncated: true,
    });
  });

  test("overwrites a conflicting truncation marker without mutating the source", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = {
      text: "m".repeat(stdinCapBytes - 29),
      _truncated: false,
    };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"text":"${"m".repeat(stdinCapBytes - 29)}","_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes);
    assert.deepStrictEqual(JSON.parse(serialized), {
      text: "m".repeat(stdinCapBytes - 29),
      _truncated: true,
    });
    assert.deepStrictEqual(payload, {
      text: "m".repeat(stdinCapBytes - 29),
      _truncated: false,
    });
  });

  test("does not mutate an oversized ordinary object when adding the marker", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = {
      message: "n".repeat(stdinCapBytes),
      nested: { status: "kept" },
    };
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"message":"${"n".repeat(stdinCapBytes)}","nested":{"status":"kept"},"_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 41);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes + 59);
    assert.deepStrictEqual(JSON.parse(serialized), {
      message: "n".repeat(stdinCapBytes),
      nested: { status: "kept" },
      _truncated: true,
    });
    assert.deepStrictEqual(payload, {
      message: "n".repeat(stdinCapBytes),
      nested: { status: "kept" },
    });
  });

  test("wraps an oversized primitive under a marked payload envelope", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = "p".repeat(stdinCapBytes - 1);
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"payload":"${"p".repeat(stdinCapBytes - 1)}","_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes + 31);
    assert.deepStrictEqual(JSON.parse(serialized), {
      payload: "p".repeat(stdinCapBytes - 1),
      _truncated: true,
    });
  });

  test("wraps an oversized array under a marked payload envelope", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = ["a".repeat(stdinCapBytes - 3)];
    const inputJson = JSON.stringify(payload);
    const expectedSerialized = `{"payload":["${"a".repeat(stdinCapBytes - 3)}"],"_truncated":true}`;

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.strictEqual(serialized, expectedSerialized);
    assert.strictEqual(Buffer.byteLength(serialized, "utf8"), stdinCapBytes + 31);
    assert.deepStrictEqual(JSON.parse(serialized), {
      payload: ["a".repeat(stdinCapBytes - 3)],
      _truncated: true,
    });
    assert.deepStrictEqual(payload, ["a".repeat(stdinCapBytes - 3)]);
  });
});
