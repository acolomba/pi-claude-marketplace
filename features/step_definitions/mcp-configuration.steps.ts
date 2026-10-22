/**
 * @fileoverview Steps about MCP configuration: the MCP servers published
 * plugins declare, and the `mcp-adapter.json` a user keeps in a scope.
 */

import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { declarePublishedMcpServer, writeCommentedMcpConfig } from "../lib/mcp-configuration.ts";

import type { ScenarioWorld } from "../support/world.ts";

Given(
  "the published plugin {string} of the marketplace {string} declares the mcp server {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    await declarePublishedMcpServer(this.requirePublished(name), plugin, server);
  },
);

Given(
  "the mcp-adapter.json file of the {word} scope holds a comment",
  async function (this: ScenarioWorld, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    await writeCommentedMcpConfig(file);
    this.onRelease(() => rm(file, { force: true }));
    assert.match(await readFile(file, "utf8"), /^\/\/ /u);
  },
);
