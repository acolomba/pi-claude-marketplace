import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

import {
  declaredOptions,
  hookOptionVariableName,
  OWNED_VARIABLE_PREFIX,
  ownedOptionVariableName,
  parseUserConfig,
  replaceUserConfigReferences,
  resolveOptions,
  type OwnedOptionAddress,
  type ResolvedOptions,
  type UserConfigOption,
  type UserConfigParse,
  type UserConfigSchema,
} from "../../extensions/pi-claude-marketplace/domain/user-config.ts";

void ({ type: "string", title: "Mode", description: "The mode." } satisfies UserConfigOption);
// @ts-expect-error An option always carries a title and a description.
void ({ type: "string", default: "fast" } satisfies UserConfigOption);
void ({ kind: "malformed", detail: "userConfig is not an object" } satisfies UserConfigParse);
// @ts-expect-error A malformed result carries its detail.
void ({ kind: "malformed" } satisfies UserConfigParse);
// @ts-expect-error A parsed result carries its schema.
void ({ kind: "ok" } satisfies UserConfigParse);

function modeOption(): UserConfigOption {
  return { type: "string", title: "Mode", description: "The mode.", default: "fast" };
}

function pickedOption(extra: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { type: "string", title: "Pick", description: "A pick.", options: ["a", "b"], ...extra };
}

describe("parseUserConfig", () => {
  test("parses a full-shape option (D-PG10-05)", () => {
    // arrange
    const declared = { mode: modeOption() };

    // act
    const parsed = parseUserConfig(declared);

    // assert
    assert.deepStrictEqual(parsed, { kind: "ok", schema: { mode: modeOption() } });
  });

  test("parses an empty object as a userConfig with no option", () => {
    // arrange
    const declared = {};

    // act
    const parsed = parseUserConfig(declared);

    // assert
    assert.deepStrictEqual(parsed, { kind: "ok", schema: {} });
  });

  test("accepts a default whose type differs from the option type (D-PG10-20)", () => {
    // arrange
    const declared = {
      count: { type: "number", title: "Count", description: "A count.", default: "abc" },
    };

    // act
    const parsed = parseUserConfig(declared);

    // assert
    assert.deepStrictEqual(parsed, {
      kind: "ok",
      schema: {
        count: { type: "number", title: "Count", description: "A count.", default: "abc" },
      },
    });
  });

  test("parses options named __proto__ and constructor as own keys and changes no prototype", () => {
    // arrange
    const declared: unknown = JSON.parse(
      '{"__proto__": {"type": "string", "title": "P", "description": "D."},' +
        ' "constructor": {"type": "boolean", "title": "C", "description": "D.", "default": true}}',
    );
    const expectedSchema: unknown = JSON.parse(
      '{"__proto__": {"type": "string", "title": "P", "description": "D."},' +
        ' "constructor": {"type": "boolean", "title": "C", "description": "D.", "default": true}}',
    );

    // act
    const parsed = parseUserConfig(declared);

    // assert
    assert.deepStrictEqual(parsed, { kind: "ok", schema: expectedSchema });
    assert.ok(parsed.kind === "ok");
    assert.deepStrictEqual(Object.keys(parsed.schema), ["__proto__", "constructor"]);
    assert.strictEqual(Object.getPrototypeOf(parsed.schema), Object.prototype);
    assert.strictEqual(Object.getPrototypeOf(Object.prototype), null);
  });

  for (const { label, declared, detail } of [
    { label: "null", declared: null, detail: "userConfig is not an object" },
    { label: "an array", declared: [], detail: "userConfig is not an object" },
    { label: "a string", declared: "x", detail: "userConfig is not an object" },
    { label: "false", declared: false, detail: "userConfig is not an object" },
    {
      label: "a key with a leading digit",
      declared: { "1a": modeOption() },
      detail: 'userConfig key "1a" is not an identifier',
    },
    {
      label: "a key with a hyphen",
      declared: { "a-b": modeOption() },
      detail: 'userConfig key "a-b" is not an identifier',
    },
    {
      label: "an option that is not an object",
      declared: { mode: 3 },
      detail: 'userConfig option "mode" is not an object',
    },
    {
      label: "an option without title and description",
      declared: { mode: { type: "string", default: "fast" } },
      detail: 'userConfig option "mode": field "title" is missing, field "description" is missing',
    },
    {
      label: "an option with an unknown field",
      declared: { mode: { ...modeOption(), color: "red" } },
      detail: 'userConfig option "mode": field "color" is not a known field',
    },
    {
      label: "an option with an unknown type",
      declared: { mode: { ...modeOption(), type: "date" } },
      detail: 'userConfig option "mode": field "type" is not valid',
    },
    {
      label: "an option with a non-boolean required",
      declared: { mode: { ...modeOption(), required: "yes" } },
      detail: 'userConfig option "mode": field "required" is not valid',
    },
    {
      label: "an option whose fields fail in declaration order",
      declared: { mode: { sensitive: 1, type: "string", title: "M", zz: 0 } },
      detail:
        'userConfig option "mode": field "sensitive" is not valid, field "zz" is not a known field, field "description" is missing',
    },
    {
      label: "a bad option after a good one",
      declared: { good: modeOption(), bad: { type: "string" }, "2x": modeOption() },
      detail: 'userConfig option "bad": field "title" is missing, field "description" is missing',
    },
    {
      label: "an empty options list",
      declared: { pick: pickedOption({ options: [], required: true }) },
      detail: 'userConfig option "pick": field "options": options needs at least one value',
    },
    {
      label: "an empty options value",
      declared: { pick: pickedOption({ options: ["", "b"], default: "b" }) },
      detail: 'userConfig option "pick": field "options" value 0: An option cannot be empty',
    },
    {
      label: "an options value longer than 64 characters",
      declared: { pick: pickedOption({ options: ["b", "x".repeat(65)], default: "b" }) },
      detail:
        'userConfig option "pick": field "options" value 1: An option can be at most 64 characters',
    },
    {
      label: "an options value with an invisible character",
      declared: { pick: pickedOption({ options: ["a\u200Bb"], default: "a\u200Bb" }) },
      detail:
        'userConfig option "pick": field "options" value 0: An option cannot contain control, invisible or bidirectional-formatting characters',
    },
    {
      label: "an options value with a bidirectional-formatting character",
      declared: { pick: pickedOption({ options: ["a\u202Eb"], default: "a\u202Eb" }) },
      detail:
        'userConfig option "pick": field "options" value 0: An option cannot contain control, invisible or bidirectional-formatting characters',
    },
    {
      label: "an options value with a lone surrogate",
      declared: { pick: pickedOption({ options: ["a\uD800"], default: "a\uD800" }) },
      detail:
        'userConfig option "pick": field "options" value 0: An option cannot contain control, invisible or bidirectional-formatting characters',
    },
    {
      label: "an options value with a leading space",
      declared: { pick: pickedOption({ options: [" a"], default: " a" }) },
      detail:
        'userConfig option "pick": field "options" value 0: An option cannot start or end with a space',
    },
    {
      label: "an options list that repeats a value in another letter case",
      declared: { pick: pickedOption({ options: ["a", "A"], default: "a" }) },
      detail:
        'userConfig option "pick": field "options": options cannot repeat a value (in any letter case)',
    },
    {
      label: "options on a number field",
      declared: { pick: pickedOption({ type: "number", default: "a" }) },
      detail:
        'userConfig option "pick": field "options": options is only for a field of type "string" that is neither multiple nor sensitive',
    },
    {
      label: "options on a multiple field",
      declared: { pick: pickedOption({ multiple: true, default: "a" }) },
      detail:
        'userConfig option "pick": field "options": options is only for a field of type "string" that is neither multiple nor sensitive',
    },
    {
      label: "options on a sensitive field",
      declared: { pick: pickedOption({ sensitive: true, default: "a" }) },
      detail:
        'userConfig option "pick": field "options": options is only for a field of type "string" that is neither multiple nor sensitive',
    },
    {
      label: "options with no default on a field that is not required",
      declared: { pick: pickedOption({}) },
      detail:
        'userConfig option "pick": field "default": a field with options needs a default among them, or required: true',
    },
    {
      label: "options with a default outside them",
      declared: { pick: pickedOption({ default: "c" }) },
      detail: 'userConfig option "pick": field "default": default must be one of the options: a, b',
    },
    {
      label: "options with a default that is not a string",
      declared: { pick: pickedOption({ default: ["a"] }) },
      detail: 'userConfig option "pick": field "default": default must be one of the options: a, b',
    },
  ]) {
    test(`gives malformed for ${label}, naming the first bad key or field (D-PG10-05)`, () => {
      // arrange
      const value: unknown = declared;

      // act
      const parsed = parseUserConfig(value);

      // assert
      assert.deepStrictEqual(parsed, { kind: "malformed", detail });
    });
  }

  for (const { label, extra } of [
    { label: "a default among them", extra: { default: "b" } },
    { label: "required and no default", extra: { required: true } },
  ]) {
    test(`parses options with ${label} (D-PG10-05)`, () => {
      // arrange
      const declared = { pick: pickedOption(extra) };

      // act
      const parsed = parseUserConfig(declared);

      // assert
      assert.deepStrictEqual(parsed, { kind: "ok", schema: { pick: pickedOption(extra) } });
    });
  }
});

describe("resolveOptions", () => {
  test("gives hooks and content each default as text and MCP fields the empty string for an unset optional (D-PG10-06, D-PG10-07, D-PG10-19, D-PG10-21)", () => {
    // arrange
    const schema = {
      mode: modeOption(),
      count: { type: "number", title: "Count", description: "D.", default: 3 },
      flag: { type: "boolean", title: "Flag", description: "D.", default: true },
      list: {
        type: "string",
        title: "List",
        description: "D.",
        multiple: true,
        default: ["a", "b"],
      },
      blank: { type: "string", title: "Blank", description: "D.", default: "" },
      loose: { type: "string", title: "Loose", description: "D." },
      needed: { type: "string", title: "Needed", description: "D.", required: true },
      secret: { type: "string", title: "Secret", description: "D.", sensitive: true, default: "s" },
      later: { type: "directory", title: "Later", description: "D.", required: true },
      given: { type: "file", title: "Given", description: "D.", required: true, default: "~/f" },
    } satisfies UserConfigSchema;
    const expectedValues = new Map([
      ["mode", "fast"],
      ["count", "3"],
      ["flag", "true"],
      ["list", "a,b"],
      ["blank", ""],
      ["secret", "s"],
      ["given", "~/f"],
    ]);

    // act
    const resolved = resolveOptions(schema);

    // assert
    assert.deepStrictEqual(resolved, {
      declared: true,
      values: expectedValues,
      mcpValues: new Map([
        ["mode", "fast"],
        ["count", "3"],
        ["flag", "true"],
        ["list", "a,b"],
        ["blank", ""],
        ["loose", ""],
        ["secret", "s"],
        ["given", "~/f"],
      ]),
      unsetRequired: ["needed", "later"],
      sensitive: new Set(["secret"]),
    } satisfies ResolvedOptions);
  });

  test("lists the unset required keys in declaration order at every call", () => {
    // arrange
    const schema = {
      zeta: { type: "string", title: "Z", description: "D.", required: true },
      alpha: { type: "string", title: "A", description: "D.", required: true },
    } satisfies UserConfigSchema;

    // act
    const first = resolveOptions(schema);
    const second = resolveOptions(schema);

    // assert
    assert.deepStrictEqual(first.unsetRequired, ["zeta", "alpha"]);
    assert.deepStrictEqual(second.unsetRequired, ["zeta", "alpha"]);
  });

  test("resolves a plugin with no userConfig to no option", () => {
    // arrange
    const schema = undefined;

    // act
    const resolved = resolveOptions(schema);

    // assert
    assert.deepStrictEqual(resolved, {
      declared: false,
      values: new Map(),
      mcpValues: new Map(),
      unsetRequired: [],
      sensitive: new Set(),
    } satisfies ResolvedOptions);
  });

  test("resolves an empty userConfig to a declared userConfig with no option", () => {
    // arrange
    const schema = {} satisfies UserConfigSchema;

    // act
    const resolved = resolveOptions(schema);

    // assert
    assert.deepStrictEqual(resolved, {
      declared: true,
      values: new Map(),
      mcpValues: new Map(),
      unsetRequired: [],
      sensitive: new Set(),
    } satisfies ResolvedOptions);
  });

  test("resolves options named __proto__ and constructor like any other key", () => {
    // arrange
    const schema: UserConfigSchema = Object.fromEntries([
      ["__proto__", { type: "string", title: "P", description: "D.", default: "p" }],
      ["constructor", { type: "string", title: "C", description: "D.", sensitive: true }],
    ] satisfies [string, UserConfigOption][]);

    // act
    const resolved = resolveOptions(schema);

    // assert
    assert.deepStrictEqual(resolved, {
      declared: true,
      values: new Map([["__proto__", "p"]]),
      mcpValues: new Map([
        ["__proto__", "p"],
        ["constructor", ""],
      ]),
      unsetRequired: [],
      sensitive: new Set(["constructor"]),
    } satisfies ResolvedOptions);
    assert.strictEqual(Object.getPrototypeOf(schema), Object.prototype);
  });
});

describe("declaredOptions", () => {
  test("gives back the options of a plugin that declares userConfig (D-PG10-21)", () => {
    // arrange
    const options = resolveOptions({ mode: modeOption() });

    // act
    const passed = declaredOptions(options);

    // assert
    assert.strictEqual(passed, options);
  });

  test("gives back the options of an empty declared userConfig (D-PG10-21)", () => {
    // arrange
    const options = resolveOptions({});

    // act
    const passed = declaredOptions(options);

    // assert
    assert.strictEqual(passed, options);
  });

  test("gives no options for a plugin that declares no userConfig (D-PG10-21)", () => {
    // arrange
    const options = resolveOptions(undefined);

    // act
    const passed = declaredOptions(options);

    // assert
    assert.strictEqual(passed, undefined);
  });
});

describe("replaceUserConfigReferences", () => {
  test("calls the replacer once for each reference, in order", () => {
    // arrange
    const calls: [string, string][] = [];
    const replace = (key: string, matched: string): string => {
      calls.push([key, matched]);
      return key.toUpperCase();
    };

    // act
    const replaced = replaceUserConfigReferences("a ${user_config.x} b ${user_config.y}", replace);

    // assert
    assert.strictEqual(replaced, "a X b Y");
    assert.deepStrictEqual(calls, [
      ["x", "${user_config.x}"],
      ["y", "${user_config.y}"],
    ]);
  });

  test("does not scan a spliced value again", () => {
    // arrange
    const calls: string[] = [];
    const replace = (key: string): string => {
      calls.push(key);
      return "${user_config.z}";
    };

    // act
    const replaced = replaceUserConfigReferences("${user_config.x}", replace);

    // assert
    assert.strictEqual(replaced, "${user_config.z}");
    assert.deepStrictEqual(calls, ["x"]);
  });

  test("passes a key that is not an identifier to the replacer", () => {
    // arrange
    const calls: string[] = [];
    const replace = (key: string): string => {
      calls.push(key);
      return "v";
    };

    // act
    const replaced = replaceUserConfigReferences("-${user_config.a-b}-", replace);

    // assert
    assert.strictEqual(replaced, "-v-");
    assert.deepStrictEqual(calls, ["a-b"]);
  });

  test("leaves a reference with an empty key as text", () => {
    // arrange
    const calls: string[] = [];
    const replace = (key: string): string => {
      calls.push(key);
      return "v";
    };

    // act
    const replaced = replaceUserConfigReferences("${user_config.}", replace);

    // assert
    assert.strictEqual(replaced, "${user_config.}");
    assert.deepStrictEqual(calls, []);
  });
});

describe("hookOptionVariableName", () => {
  for (const { key, name } of [
    { key: "mode", name: "CLAUDE_PLUGIN_OPTION_MODE" },
    { key: "MODE", name: "CLAUDE_PLUGIN_OPTION_MODE" },
    { key: "my_key2", name: "CLAUDE_PLUGIN_OPTION_MY_KEY2" },
    { key: "a-b.c", name: "CLAUDE_PLUGIN_OPTION_A_B_C" },
  ]) {
    test(`names the hook variable of ${key} ${name}`, () => {
      // arrange
      const optionKey = key;

      // act
      const variable = hookOptionVariableName(optionKey);

      // assert
      assert.strictEqual(variable, name);
    });
  }
});

describe("OWNED_VARIABLE_PREFIX", () => {
  test("uses the exact prefix of every owned option variable (D-PG10-23)", () => {
    // arrange
    const expectedPrefix = "PI_CLAUDE_MARKETPLACE_OPTION_";

    // act
    const prefix = OWNED_VARIABLE_PREFIX;

    // assert
    assert.strictEqual(prefix, expectedPrefix);
  });
});

describe("ownedOptionVariableName", () => {
  function address(): OwnedOptionAddress {
    return { scope: "user", marketplace: "mp", plugin: "plug", key: "mode" };
  }

  test("names the variable from the SHA-256 of scope, marketplace, plugin, and key joined by NUL (D-PG10-23)", () => {
    // arrange
    const hex = createHash("sha256").update("user\0mp\0plug\0mode").digest("hex").slice(0, 16);

    // act
    const variable = ownedOptionVariableName(address());

    // assert
    assert.strictEqual(variable, `PI_CLAUDE_MARKETPLACE_OPTION_${hex}`);
    assert.match(variable, /^PI_CLAUDE_MARKETPLACE_OPTION_[0-9a-f]{16}$/);
  });

  test("gives equal names for equal inputs (D-PG10-23)", () => {
    // arrange
    const first = address();
    const second = address();

    // act
    const firstName = ownedOptionVariableName(first);
    const secondName = ownedOptionVariableName(second);

    // assert
    assert.strictEqual(firstName, secondName);
  });

  for (const { label, changed, joined } of [
    { label: "scope", changed: { scope: "project" }, joined: "project\0mp\0plug\0mode" },
    { label: "marketplace", changed: { marketplace: "other" }, joined: "user\0other\0plug\0mode" },
    { label: "plugin", changed: { plugin: "other" }, joined: "user\0mp\0other\0mode" },
    { label: "key letter case", changed: { key: "MODE" }, joined: "user\0mp\0plug\0MODE" },
  ] satisfies { label: string; changed: Partial<OwnedOptionAddress>; joined: string }[]) {
    test(`gives a different name when the ${label} differs (D-PG10-23)`, () => {
      // arrange
      const other = { ...address(), ...changed };
      const hex = createHash("sha256").update(joined).digest("hex").slice(0, 16);
      const baseHex = createHash("sha256")
        .update("user\0mp\0plug\0mode")
        .digest("hex")
        .slice(0, 16);

      // act
      const otherName = ownedOptionVariableName(other);

      // assert
      assert.strictEqual(otherName, `PI_CLAUDE_MARKETPLACE_OPTION_${hex}`);
      assert.notStrictEqual(hex, baseHex);
    });
  }
});
