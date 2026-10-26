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
// @ts-expect-error A plugin entry requires its name.
void ({ source: "./plugin" } satisfies PluginEntry);
// @ts-expect-error A plugin entry requires its source declaration.
void ({ name: "plugin" } satisfies PluginEntry);
// @ts-expect-error The enablement declaration is boolean when present.
void ({ name: "plugin", source: "./plugin", defaultEnabled: "false" } satisfies PluginEntry);
// @ts-expect-error MCP servers are a file reference or a server map.
void ({ name: "plugin", source: "./plugin", mcpServers: 42 } satisfies PluginEntry);

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
        workflows: {},
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
  for (const { entryShape, pluginEntry } of [
    {
      entryShape: "the required name and source",
      pluginEntry: { name: "plugin", source: "./plugin" },
    },
    {
      entryShape: "an opaque object source",
      pluginEntry: {
        name: "plugin",
        source: { type: "github", repo: "owner/repository" },
      },
    },
    {
      entryShape: "opaque component payloads",
      pluginEntry: {
        name: "plugin",
        source: "./plugin",
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
        workflows: ["./workflows"],
      },
    },
    {
      entryShape: "metadata, dependencies, and an unknown vendor field",
      pluginEntry: {
        name: "plugin",
        source: "./plugin",
        description: "Description",
        version: "1.2.3",
        defaultEnabled: false,
        dependencies: { other: "1.0.0" },
        vendorField: { enabled: true },
      },
    },
    {
      entryShape: "an inline MCP server map",
      pluginEntry: {
        name: "plugin",
        source: "./plugin",
        mcpServers: { local: { command: "node" } },
      },
    },
    {
      entryShape: "an MCP file reference",
      pluginEntry: {
        name: "plugin",
        source: "./plugin",
        mcpServers: "./plugin.mcp.json",
      },
    },
    {
      entryShape: "enabled-by-default declarations",
      pluginEntry: {
        name: "plugin",
        source: "./plugin",
        defaultEnabled: true,
      },
    },
  ]) {
    test(`accepts ${entryShape}`, () => {
      // arrange
      const acceptedPluginEntry = pluginEntry;

      // act
      const isValid = PLUGIN_ENTRY_VALIDATOR.Check(acceptedPluginEntry);

      // assert
      assert.strictEqual(isValid, true);
    });
  }

  for (const { missingField, pluginEntry } of [
    { missingField: "name", pluginEntry: { source: "./plugin" } },
    { missingField: "source", pluginEntry: { name: "plugin" } },
  ]) {
    test(`rejects an entry without its ${missingField}`, () => {
      // arrange
      const incompletePluginEntry = pluginEntry;

      // act
      const isValid = PLUGIN_ENTRY_VALIDATOR.Check(incompletePluginEntry);

      // assert
      assert.strictEqual(isValid, false);
    });
  }

  for (const pluginEntry of [null, [], undefined, "plugin", 42, true]) {
    test(`rejects the non-record value ${JSON.stringify(pluginEntry)}`, () => {
      // arrange
      const nonRecordPluginEntry = pluginEntry;

      // act
      const isValid = PLUGIN_ENTRY_VALIDATOR.Check(nonRecordPluginEntry);

      // assert
      assert.strictEqual(isValid, false);
    });
  }

  for (const pluginEntry of [
    { name: 1, source: "./plugin" },
    { name: "plugin", source: "./plugin", description: 1 },
    { name: "plugin", source: "./plugin", version: 1 },
    { name: "plugin", source: "./plugin", defaultEnabled: "false" },
    { name: "plugin", source: "./plugin", defaultEnabled: null },
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

  for (const mcpServers of [null, [], 1, true]) {
    test(`rejects the MCP declaration ${JSON.stringify(mcpServers)}`, () => {
      // arrange
      const pluginEntry = { name: "plugin", source: "./plugin", mcpServers };

      // act
      const isValid = PLUGIN_ENTRY_VALIDATOR.Check(pluginEntry);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});

describe("PLUGIN_MANIFEST_VALIDATOR", () => {
  for (const { manifestShape, pluginManifest } of [
    {
      manifestShape: "an empty standalone manifest without entry fields",
      pluginManifest: {},
    },
    {
      manifestShape: "an optional name without an entry source",
      pluginManifest: { name: "plugin" },
    },
    {
      manifestShape: "opaque component payloads",
      pluginManifest: {
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
        workflows: ["./workflows"],
      },
    },
    {
      manifestShape: "metadata, dependencies, and an unknown vendor field",
      pluginManifest: {
        description: "Description",
        version: "1.2.3",
        defaultEnabled: false,
        dependencies: { other: "1.0.0" },
        vendorField: { enabled: true },
      },
    },
    {
      manifestShape: "an inline MCP server map",
      pluginManifest: { mcpServers: { local: { command: "node" } } },
    },
    {
      manifestShape: "an MCP file reference",
      pluginManifest: { mcpServers: "./plugin.mcp.json" },
    },
    {
      manifestShape: "enabled-by-default declarations",
      pluginManifest: { defaultEnabled: true },
    },
  ]) {
    test(`accepts ${manifestShape}`, () => {
      // arrange
      const acceptedPluginManifest = pluginManifest;

      // act
      const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(acceptedPluginManifest);

      // assert
      assert.strictEqual(isValid, true);
    });
  }

  for (const pluginManifest of [null, [], undefined, "plugin", 42, true]) {
    test(`rejects the non-record value ${JSON.stringify(pluginManifest)}`, () => {
      // arrange
      const nonRecordPluginManifest = pluginManifest;

      // act
      const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(nonRecordPluginManifest);

      // assert
      assert.strictEqual(isValid, false);
    });
  }

  for (const pluginManifest of [
    { name: 42 },
    { description: 42 },
    { version: 42 },
    { defaultEnabled: "false" },
    { defaultEnabled: null },
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

  for (const mcpServers of [null, [], 1, true]) {
    test(`rejects the MCP declaration ${JSON.stringify(mcpServers)}`, () => {
      // arrange
      const pluginManifest = { mcpServers };

      // act
      const isValid = PLUGIN_MANIFEST_VALIDATOR.Check(pluginManifest);

      // assert
      assert.strictEqual(isValid, false);
    });
  }
});
