import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  planSpawn,
  serializeWithTruncation,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/spawn-helpers.ts";
import { asAbsolutePluginRoot } from "../../../extensions/pi-claude-marketplace/domain/plugin-root.ts";
import { resolveOptions } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import {
  ShellFormOptionReferenceError,
  UnsetPluginOptionError,
} from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";

import type { RoutingEntry } from "../../../extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts";
import type { UserConfigSchema } from "../../../extensions/pi-claude-marketplace/domain/user-config.ts";
import type { ClaudePluginVars } from "../../../extensions/pi-claude-marketplace/shared/vars.ts";

const PATH_VARS = {
  pluginRoot: "/p",
  pluginData: "/d",
  projectDir: "/w",
} satisfies ClaudePluginVars;

function execEntry(command: string, args: readonly unknown[]): RoutingEntry {
  return {
    scope: "project",
    marketplace: "catalog",
    pluginId: "exec-substitution",
    resolvedSource: asAbsolutePluginRoot("/p"),
    claudeEvent: "UserPromptSubmit",
    matcher: { kind: "match-all" },
    rawMatcher: "",
    handlerDecl: { type: "command", command, args: [...args] },
    declarationIndex: 0,
    ifPredicate: { kind: "match-all" },
    options: resolveOptions(undefined),
  };
}

const OPTION_SCHEMA = {
  mode: { type: "string", title: "Mode", description: "The mode.", default: "fast" },
  level: { type: "number", title: "Level", description: "The level.", default: 3 },
  echo: {
    type: "string",
    title: "Echo",
    description: "A value that names another option.",
    default: "${user_config.mode}",
  },
} satisfies UserConfigSchema;

function optionEntry(command: string, args: readonly unknown[]): RoutingEntry {
  return { ...execEntry(command, args), options: resolveOptions(OPTION_SCHEMA) };
}

describe("planSpawn", () => {
  test("fills Claude's three path variables into exec-form arguments and leaves other placeholders literal", () => {
    // arrange
    const entry = execEntry("/usr/bin/hook", [
      "${CLAUDE_PLUGIN_ROOT}/bin",
      "--data=${CLAUDE_PLUGIN_DATA}",
      "${CLAUDE_PROJECT_DIR}",
      "${HOME}",
      "${CLAUDE_SKILL_DIR}",
      7,
    ]);

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "/usr/bin/hook",
      args: ["/p/bin", "--data=/d", "/w", "${HOME}", "${CLAUDE_SKILL_DIR}", "7"],
      shell: false,
    });
  });

  test("D-PG10-10: fills plugin options into an exec-form command and its string arguments after the path variables", () => {
    // arrange
    const entry = optionEntry("${CLAUDE_PLUGIN_ROOT}/bin/${user_config.mode}", [
      "${user_config.mode}",
      "--level=${user_config.level}",
      "${CLAUDE_PLUGIN_DATA}/${user_config.mode}",
      7,
    ]);

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "/p/bin/fast",
      args: ["fast", "--level=3", "/d/fast", "7"],
      shell: false,
    });
  });

  test("D-PG10-10: fills two option references side by side and never rescans a spliced value", () => {
    // arrange
    const entry = optionEntry("/usr/bin/hook", [
      "${user_config.mode}${user_config.level}",
      "${user_config.echo}",
    ]);

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "/usr/bin/hook",
      args: ["fast3", "${user_config.mode}"],
      shell: false,
    });
  });

  const unsetCases: readonly {
    readonly name: string;
    readonly entry: RoutingEntry;
    readonly key: string;
  }[] = [
    {
      name: "D-PG10-21: an argument of a plugin that declares no options",
      entry: execEntry("/usr/bin/hook", ["${user_config.token}"]),
      key: "token",
    },
    {
      name: "D-PG10-08: the command, for a key the plugin does not declare",
      entry: optionEntry("/usr/bin/${user_config.missing}", []),
      key: "missing",
    },
    {
      name: "D-PG10-08: a key that is not an identifier",
      entry: optionEntry("/usr/bin/hook", ["${user_config.a-b}"]),
      key: "a-b",
    },
  ];
  for (const { name, entry, key } of unsetCases) {
    test(`${name} fails the run with the unset-option error`, () => {
      // act & assert
      assert.throws(
        () => planSpawn(entry, PATH_VARS),
        (error: unknown) => {
          assert.ok(error instanceof UnsetPluginOptionError);
          assert.strictEqual(error.key, key);
          return true;
        },
      );
    });
  }

  test("fills the path variables into an exec-form command with no arguments", () => {
    // arrange
    const entry = execEntry("${CLAUDE_PLUGIN_ROOT}/hooks/a.sh", []);

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, { command: "/p/hooks/a.sh", args: [], shell: false });
  });

  test("replaces each placeholder of one argument once and never rescans a spliced value", () => {
    // arrange
    const entry = execEntry("/usr/bin/hook", [
      "${CLAUDE_PLUGIN_ROOT}:${CLAUDE_PLUGIN_DATA}",
      "${CLAUDE_PLUGIN_ROOT}",
      "two words",
    ]);
    const vars = { pluginRoot: "/root/${CLAUDE_PLUGIN_DATA}", pluginData: "/d" };

    // act
    const spawnPlan = planSpawn(entry, vars);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "/usr/bin/hook",
      args: ["/root/${CLAUDE_PLUGIN_DATA}:/d", "/root/${CLAUDE_PLUGIN_DATA}", "two words"],
      shell: false,
    });
  });

  test("leaves a shell-form command's placeholder text to the shell", () => {
    // arrange
    const entry = {
      ...execEntry("echo ${CLAUDE_PLUGIN_ROOT} '${CLAUDE_PLUGIN_DATA}'", []),
      handlerDecl: {
        type: "command",
        command: "echo ${CLAUDE_PLUGIN_ROOT} '${CLAUDE_PLUGIN_DATA}'",
      },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "echo ${CLAUDE_PLUGIN_ROOT} '${CLAUDE_PLUGIN_DATA}'",
      args: [],
      shell: true,
    });
  });

  for (const { name, options, command } of [
    { name: "an option with a value", options: OPTION_SCHEMA, command: "run ${user_config.mode}" },
    { name: "an undeclared key", options: OPTION_SCHEMA, command: "run '${user_config.nope}'" },
    { name: "a plugin with no options", options: undefined, command: "run ${user_config.mode}" },
  ]) {
    test(`D-PG10-10: refuses a shell-form command that names ${name}`, () => {
      // arrange
      const entry = {
        ...execEntry(command, []),
        handlerDecl: { type: "command", command },
        options: resolveOptions(options),
      } satisfies RoutingEntry;

      // act & assert
      assert.throws(
        () => planSpawn(entry, PATH_VARS),
        (error: unknown) => {
          assert.ok(error instanceof ShellFormOptionReferenceError);
          assert.deepStrictEqual(
            { plugin: error.plugin, command: error.command },
            { plugin: "exec-substitution@catalog", command },
          );
          return true;
        },
      );
    });
  }

  test("D-PG10-10: runs a shell-form command that reads the option variable from its environment", () => {
    // arrange
    const entry = {
      ...optionEntry("echo $CLAUDE_PLUGIN_OPTION_MODE", []),
      handlerDecl: { type: "command", command: "echo $CLAUDE_PLUGIN_OPTION_MODE" },
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

    // assert
    assert.deepStrictEqual(spawnPlan, {
      command: "echo $CLAUDE_PLUGIN_OPTION_MODE",
      args: [],
      shell: true,
    });
  });

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
      options: resolveOptions(undefined),
    } satisfies RoutingEntry;

    // act
    const spawnPlan = planSpawn(entry, PATH_VARS);

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
