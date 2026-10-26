/**
 * @fileoverview Steps about MCP configuration: the MCP servers published
 * plugins declare, and the `mcp-adapter.json` a user keeps in a scope, which
 * a step can also block with a directory of the same name.
 */

import assert from "node:assert/strict";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { declarePublishedMcpServer, writeCommentedMcpConfig } from "../lib/mcp-configuration.ts";

import type { ScenarioWorld } from "../support/world.ts";

function mcpAdapterFile(world: ScenarioWorld, scope: string): string {
  return path.join(world.scopeRoot(scope), "mcp-adapter.json");
}

Given(
  "the published plugin {string} of the marketplace {string} declares the mcp server {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, server: string) {
    await declarePublishedMcpServer(this.requirePublished(name), plugin, server);
  },
);

Given(
  "the mcp-adapter.json file of the {word} scope holds a comment",
  async function (this: ScenarioWorld, scope: string) {
    const file = mcpAdapterFile(this, scope);
    await writeCommentedMcpConfig(file);
    this.onRelease(() => rm(file, { force: true }));
    assert.match(await readFile(file, "utf8"), /^\/\/ /u);
  },
);

// A directory in place of the file fails an install in its mcp phase, after
// the skills phase has committed, so the install must roll the skills back;
// it fails an update before the update swaps versions. Reading a directory
// fails with EISDIR whatever its mode, so a run as root fails the same way.
Given(
  "a directory blocks the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, scope: string) {
    const file = mcpAdapterFile(this, scope);
    await mkdir(path.dirname(file), { recursive: true });
    // Not recursive, so a file already there fails the step.
    await mkdir(file);
    this.onRelease(() => rm(file, { recursive: true, force: true }));
    const error = await readFile(file).then(
      () => assert.fail(`reading ${file} did not fail`),
      (reason: unknown) => reason as NodeJS.ErrnoException,
    );
    assert.deepStrictEqual([error.code, error.syscall], ["EISDIR", "read"]);
    this.recordErrorMessage("{mcp-adapter.json read error}", error.message);
  },
);

Given(
  "the directory that blocks the mcp-adapter.json file of the {word} scope is removed",
  async function (this: ScenarioWorld, scope: string) {
    const file = mcpAdapterFile(this, scope);
    await rm(file, { recursive: true });
    await assert.rejects(stat(file), { code: "ENOENT" });
  },
);
