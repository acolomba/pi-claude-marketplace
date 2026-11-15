/**
 * @fileoverview Steps about a plugin MCP server whose fields name the
 * plugin's options: a stub server whose tool name is an argument the
 * scenario writes, and a manifest whose option default is a value only the
 * run knows, such as the Node executable that runs the stub or the address
 * of the loopback HTTP server (PG-CORE-03, D-PG10-11).
 *
 * The stub lists one tool named by its fourth argument, so an option that
 * reaches that argument shows in the tool the model can call.
 */

import assert from "node:assert/strict";

import { Given } from "@cucumber/cucumber";

import { publishStubServersFile, withStubServers } from "../../lib/mcp-server-files.ts";
import { McpHttpServer } from "../../lib/mcp-server-http.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Writes the manifest `text` with the default of the option `key` set to
// `value`. The option must already be declared, so a typo fails here.
async function publishManifestWithDefault(
  world: ScenarioWorld,
  plugin: string,
  name: string,
  { text, key, value }: { readonly text: string; readonly key: string; readonly value: string },
): Promise<void> {
  const manifest = JSON.parse(text) as { userConfig?: Record<string, Record<string, unknown>> };
  const option = manifest.userConfig?.[key];
  assert.ok(option !== undefined, `the manifest declares no option "${key}"`);
  option.default = value;
  await publishStubServersFile(
    world.requirePublished(name),
    plugin,
    ".claude-plugin/plugin.json",
    JSON.stringify(manifest),
  );
}

// The stub's own entry from its marker, with `toolArgument` after the
// plugin and server arguments.
Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} whose tool name argument is {string}",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    server: string,
    toolArgument: string,
  ) {
    const document = withStubServers(plugin, { mcpServers: { [server]: { stub: {} } } }) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    const entry = document.mcpServers[server];
    if (entry === undefined) {
      throw new Error(`the stub marker of "${server}" wrote no server`);
    }

    entry.args.push(toolArgument);
    await publishStubServersFile(
      this.requirePublished(name),
      plugin,
      ".mcp.json",
      JSON.stringify(document),
    );
  },
);

// The Node executable this run starts stub servers with, which no scenario
// can name.
Given(
  "the published plugin {string} of the marketplace {string} has this manifest, with the default of the option {string} set to the node executable that runs stub mcp servers:",
  async function (this: ScenarioWorld, plugin: string, name: string, key: string, text: string) {
    await publishManifestWithDefault(this, plugin, name, { text, key, value: process.execPath });
  },
);

// The server starts before its address becomes the default. Its release runs
// after the profile Pi stops, so no request reaches a closed server.
Given(
  "the published plugin {string} of the marketplace {string} has this manifest, with the default of the option {string} set to the address of the http mcp server {string}:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    key: string,
    server: string,
    text: string,
  ) {
    const http = await McpHttpServer.start(this.tokens.home, server);
    this.onRelease(() => http.close());
    await publishManifestWithDefault(this, plugin, name, { text, key, value: http.url });
  },
);
