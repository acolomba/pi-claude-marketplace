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

  test("bounds and marks an object serialized one byte over the stdin cap", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: "o".repeat(stdinCapBytes - 10) };
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as { text: string; _truncated: boolean };

    // assert
    assert.strictEqual(Buffer.byteLength(inputJson, "utf8"), stdinCapBytes + 1);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.ok(decoded.text.length < payload.text.length);
    assert.ok(payload.text.startsWith(decoded.text));
  });

  test("bounds substantially oversized multibyte text by UTF-8 bytes", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { text: "漢".repeat(stdinCapBytes) };
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as { text: string; _truncated: boolean };

    // assert
    assert.ok(Buffer.byteLength(inputJson, "utf8") > stdinCapBytes * 3);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.ok(decoded.text.length < payload.text.length);
    assert.ok(payload.text.startsWith(decoded.text));
  });

  test("overwrites a conflicting truncation marker without mutating the source", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = {
      text: "m".repeat(stdinCapBytes * 4),
      _truncated: false,
    };
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as { text: string; _truncated: boolean };

    // assert
    assert.ok(Buffer.byteLength(inputJson, "utf8") > stdinCapBytes * 4);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.ok(decoded.text.length < payload.text.length);
    assert.ok(payload.text.startsWith(decoded.text));
    assert.deepStrictEqual(payload, {
      text: "m".repeat(stdinCapBytes * 4),
      _truncated: false,
    });
  });

  test("retains complete object fields before filling the remaining bounded space", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = {
      nested: { status: "kept" },
      message: "n".repeat(stdinCapBytes * 4),
    };
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as {
      message: string;
      nested: { status: string };
      _truncated: boolean;
    };

    // assert
    assert.ok(Buffer.byteLength(inputJson, "utf8") > stdinCapBytes * 4);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.ok(decoded.message.length < payload.message.length);
    assert.ok(payload.message.startsWith(decoded.message));
    assert.deepStrictEqual(decoded.nested, { status: "kept" });
    assert.deepStrictEqual(payload, {
      nested: { status: "kept" },
      message: "n".repeat(stdinCapBytes * 4),
    });
  });

  test("omits an oversized non-string object field while retaining the marker", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = { nested: { text: "n".repeat(stdinCapBytes * 4) } };

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.deepStrictEqual(JSON.parse(serialized), { _truncated: true });
    assert.deepStrictEqual(payload, { nested: { text: "n".repeat(stdinCapBytes * 4) } });
  });

  test("emits only the marker when an oversized object field cannot fit", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const oversizedKey = "k".repeat(stdinCapBytes);
    const payload = { [oversizedKey]: "v" };

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.ok(Buffer.byteLength(JSON.stringify(payload), "utf8") > stdinCapBytes);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.deepStrictEqual(JSON.parse(serialized), { _truncated: true });
  });

  test("bounds an oversized primitive under a marked payload envelope", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = "p".repeat(stdinCapBytes * 4);
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as { payload: string; _truncated: boolean };

    // assert
    assert.ok(Buffer.byteLength(inputJson, "utf8") > stdinCapBytes * 4);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.ok(decoded.payload.length < payload.length);
    assert.ok(payload.startsWith(decoded.payload));
  });

  test("bounds an oversized array prefix under a marked payload envelope", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = ["kept", "a".repeat(stdinCapBytes * 4)];
    const inputJson = JSON.stringify(payload);

    // act
    const serialized = serializeWithTruncation(payload);
    const decoded = JSON.parse(serialized) as { payload: string[]; _truncated: boolean };
    const boundedValue = decoded.payload.at(1);

    // assert
    assert.ok(Buffer.byteLength(inputJson, "utf8") > stdinCapBytes * 4);
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.strictEqual(decoded._truncated, true);
    assert.strictEqual(decoded.payload[0], "kept");
    assert.ok(boundedValue !== undefined);
    assert.ok(boundedValue.length < payload[1]!.length);
    assert.ok(payload[1]!.startsWith(boundedValue));
    assert.deepStrictEqual(payload, ["kept", "a".repeat(stdinCapBytes * 4)]);
  });

  test("stops an oversized array before a non-string item that cannot fit", () => {
    // arrange
    const stdinCapBytes = 256 * 1024;
    const payload = [{ text: "a".repeat(stdinCapBytes * 4) }, "not-reached"];

    // act
    const serialized = serializeWithTruncation(payload);

    // assert
    assert.ok(Buffer.byteLength(serialized, "utf8") <= stdinCapBytes);
    assert.deepStrictEqual(JSON.parse(serialized), {
      payload: [],
      _truncated: true,
    });
    assert.deepStrictEqual(payload, [{ text: "a".repeat(stdinCapBytes * 4) }, "not-reached"]);
  });
});
