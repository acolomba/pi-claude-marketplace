/**
 * @fileoverview Steps about the resources of a plugin's MCP server: a stub
 * server that offers one static text resource, which the model reads through
 * the active MCP implementation (PG-MCP-08, D-PG9-10).
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import { publishStubMcpServer, stubMcpFileText } from "../../lib/mcp-server-files.ts";
import { STUB_RESOURCE_VARIABLE } from "../../lib/mcp-stub-server.ts";

import type { ScenarioWorld } from "../../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} has the stub mcp server {string} with the text resource {string}",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    server: string,
    resource: string,
  ) {
    const stub = { plugin, server, env: { [STUB_RESOURCE_VARIABLE]: resource } };
    const file = await publishStubMcpServer(this.requirePublished(name), stub);
    assert.strictEqual(await readFile(file, "utf8"), stubMcpFileText(stub));
  },
);
