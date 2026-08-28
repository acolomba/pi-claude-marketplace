import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  PLUGIN_ENTRY_SCHEMA,
  PLUGIN_ENTRY_VALIDATOR,
  PLUGIN_MANIFEST_VALIDATOR,
  type PluginEntry,
} from "../../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

void ({ name: "plugin", source: "./plugin" } satisfies PluginEntry);
void ({
  name: "plugin",
  source: { type: "github", repo: "owner/repository" },
  defaultEnabled: false,
  mcpServers: "./plugin.mcp.json",
} satisfies PluginEntry);
// @ts-expect-error A plugin entry requires its source declaration.
void ({ name: "plugin" } satisfies PluginEntry);
// @ts-expect-error The enablement declaration is boolean when present.
void ({ name: "plugin", source: "./plugin", defaultEnabled: "false" } satisfies PluginEntry);

describe("PLUGIN_ENTRY_SCHEMA", () => {
  test("describes the complete plugin entry object", () => {
    // arrange
    const expectedSchema = {
      type: "object",
      required: ["name", "source"],
      properties: {
        name: { type: "string" },
        source: {},
        description: { type: "string" },
        version: { type: "string" },
        defaultEnabled: { type: "boolean" },
        skills: {},
        commands: {},
        agents: {},
        hooks: {},
        lspServers: {},
        monitors: {},
        themes: {},
        outputStyles: {},
        channels: {},
        userConfig: {},
        bin: {},
        settings: {},
        mcpServers: {
          anyOf: [
            { type: "string" },
            {
              type: "object",
              patternProperties: { "^.*$": {} },
            },
          ],
        },
        dependencies: {},
      },
    };

    // act
    const schema = PLUGIN_ENTRY_SCHEMA;

    // assert
    assert.deepStrictEqual(schema, expectedSchema);
  });
});

describe("PLUGIN_ENTRY_VALIDATOR", () => {
  test("accepts the required name and source", () => {
    // arrange
    const pluginEntry = { name: "plugin", source: "./plugin" };

    // act
    const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts an opaque object source", () => {
    // arrange
    const pluginEntry = {
      name: "plugin",
      source: { type: "github", repo: "owner/repository" },
    };

    // act
    const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts every optional field and an unknown vendor field", () => {
    // arrange
    const pluginEntry = {
      name: "plugin",
      source: "./plugin",
      description: "Description",
      version: "1.2.3",
      defaultEnabled: false,
      skills: ["./skills"],
      commands: "./commands",
      agents: { directory: "./agents" },
      hooks: { PreToolUse: [] },
      lspServers: ["typescript"],
      monitors: null,
      themes: ["dark"],
      outputStyles: { concise: true },
      channels: 2,
      userConfig: false,
      bin: ["plugin"],
      settings: { feature: true },
      mcpServers: { local: { command: "node" } },
      dependencies: { other: "1.0.0" },
      vendorField: { enabled: true },
    };

    // act
    const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts an MCP file reference", () => {
    // arrange
    const pluginEntry = {
      name: "plugin",
      source: "./plugin",
      mcpServers: "./plugin.mcp.json",
    };

    // act
    const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts enabled-by-default declarations", () => {
    // arrange
    const pluginEntry = {
      name: "plugin",
      source: "./plugin",
      defaultEnabled: true,
    };

    // act
    const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

    // assert
    assert.strictEqual(isValid, true);
  });

  for (const pluginEntry of [
    null,
    [],
    { source: "./plugin" },
    { name: "plugin" },
    { name: 1, source: "./plugin" },
    { name: "plugin", source: "./plugin", description: 1 },
    { name: "plugin", source: "./plugin", version: 1 },
    { name: "plugin", source: "./plugin", defaultEnabled: "false" },
    { name: "plugin", source: "./plugin", defaultEnabled: null },
    { name: "plugin", source: "./plugin", mcpServers: [] },
    { name: "plugin", source: "./plugin", mcpServers: 1 },
  ]) {
    test(`rejects ${JSON.stringify(pluginEntry)}`, () => {
      // arrange
      const invalidPluginEntry = pluginEntry;

      // act
      const isValid = PLUGIN_ENTRY_VALIDATOR.Check(invalidPluginEntry);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});

describe("PLUGIN_MANIFEST_VALIDATOR", () => {
  test("accepts an empty standalone manifest", () => {
    // arrange
    const pluginManifest = {};

    // act
    const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(pluginManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts every optional field and an unknown vendor field", () => {
    // arrange
    const pluginManifest = {
      name: "plugin",
      description: "Description",
      version: "1.2.3",
      defaultEnabled: false,
      skills: ["./skills"],
      commands: "./commands",
      agents: { directory: "./agents" },
      hooks: { PreToolUse: [] },
      lspServers: ["typescript"],
      monitors: null,
      themes: ["dark"],
      outputStyles: { concise: true },
      channels: 2,
      userConfig: false,
      bin: ["plugin"],
      settings: { feature: true },
      mcpServers: { local: { command: "node" } },
      dependencies: { other: "1.0.0" },
      vendorField: { enabled: true },
    };

    // act
    const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(pluginManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts an MCP file reference", () => {
    // arrange
    const pluginManifest = { mcpServers: "./plugin.mcp.json" };

    // act
    const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(pluginManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  test("accepts enabled-by-default declarations", () => {
    // arrange
    const pluginManifest = { defaultEnabled: true };

    // act
    const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(pluginManifest);

    // assert
    assert.strictEqual(isValid, true);
  });

  for (const pluginManifest of [
    null,
    [],
    { name: 42 },
    { description: 42 },
    { version: 42 },
    { defaultEnabled: "false" },
    { defaultEnabled: null },
    { mcpServers: [] },
    { mcpServers: 1 },
  ]) {
    test(`rejects ${JSON.stringify(pluginManifest)}`, () => {
      // arrange
      const invalidPluginManifest = pluginManifest;

      // act
      const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(invalidPluginManifest);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});
