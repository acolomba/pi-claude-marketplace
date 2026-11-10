/**
 * @fileoverview Steps about MCP configuration: the MCP servers published
 * plugins declare, the `mcp-adapter.json` a user keeps in a scope, which a
 * step can also block with a directory of the same name, the user's approval
 * of project MCP servers, and a legacy `mcp.json` that holds an installed
 * plugin's servers beside the user's own, as release 0.19.2 wrote it. One
 * step reads the whole text of a scope's `mcp.json` or `mcp-adapter.json`.
 */

import assert from "node:assert/strict";
import { chmod, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

import { Given, Then } from "@cucumber/cucumber";

import { isPlainObject } from "../lib/field-rows.ts";
import {
  declarePublishedMcpServer,
  PROJECT_SERVERS_ALLOWED_CONFIG,
  writeCommentedMcpConfig,
  writeLegacyMcpConfig,
  writeProjectServersAllowedConfig,
} from "../lib/mcp-configuration.ts";
import { projectTokens } from "../lib/run-tokens.ts";

import type { ScenarioWorld } from "../support/world.ts";

// The MCP configuration files of a scope a scenario can read whole.
const MCP_CONFIG_FILES: ReadonlySet<string> = new Set(["mcp.json", "mcp-adapter.json"]);

// The command of the user's own server in a legacy `mcp.json`. No sandbox
// provides it, so the server never starts.
const USERS_OWN_COMMAND = "pi-features-users-own-mcp-server";

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

// D-CF1-07: approving project MCP servers is a precondition of its own,
// never part of the default profile. pi-mcp-adapter reads the setting from
// the user-global `<agent dir>/mcp-adapter.json` when a session starts, so
// the step comes before the profile Pi starts.
Given(
  "pi-mcp-adapter allows project mcp servers for the user",
  async function (this: ScenarioWorld) {
    const file = mcpAdapterFile(this, "user");
    await writeProjectServersAllowedConfig(file);
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), PROJECT_SERVERS_ALLOWED_CONFIG);
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

// The configuration remains readable during update preparation. Its parent becomes
// read-only before the command, so the atomic replacement fails during commit.
Given(
  "the {word} scope directory that holds mcp-adapter.json is read-only",
  async function (this: ScenarioWorld, scope: string) {
    const file = mcpAdapterFile(this, scope);
    const root = path.dirname(file);
    await writeCommentedMcpConfig(file);
    this.onRelease(() => rm(file, { force: true }));
    await chmod(root, 0o555);
    this.onRelease(() => chmod(root, 0o755));
    assert.strictEqual((await stat(root)).mode & 0o777, 0o555);
    assert.match(await readFile(file, "utf8"), /^\/\/ /u);
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

// D-BG-13: release 0.19.2 kept the user's own servers and the plugin's marked
// ones in one `mcp.json`, which the load moves apart (AMIG-01, AMIG-02).
Given(
  "the mcp.json file of the {word} scope holds the servers of the plugin {string} as release 0.19.2 wrote them, beside the user's own server {string}",
  async function (this: ScenarioWorld, scope: string, pluginId: string, name: string) {
    const scopeRoot = this.scopeRoot(scope);
    const written = await writeLegacyMcpConfig({
      scopeRoot,
      pluginId,
      userServer: { name, command: USERS_OWN_COMMAND },
    });
    const file = path.join(scopeRoot, "mcp.json");
    const servers: unknown = Reflect.get(JSON.parse(await readFile(file, "utf8")), "mcpServers");
    assert.deepStrictEqual(servers, written.mcpServers);
    assert.ok(isPlainObject(servers), `${file} holds no servers`);
    const marked = Object.entries(servers).filter(
      ([, entry]) => isPlainObject(entry) && Object.hasOwn(entry, "_piClaudeMarketplace"),
    );
    assert.deepStrictEqual(Reflect.get(servers, name), { command: USERS_OWN_COMMAND });
    assert.notDeepStrictEqual(marked, [], `${file} holds no server of ${pluginId}`);
  },
);

Then(
  "the mcp configuration file {string} of the {word} scope holds this text:",
  async function (this: ScenarioWorld, fileName: string, scope: string, text: string) {
    assert.ok(MCP_CONFIG_FILES.has(fileName), `${fileName} is not an mcp configuration file`);
    const file = path.join(this.scopeRoot(scope), fileName);
    const content = await readFile(file, "utf8");
    assert.strictEqual(projectTokens("text", content, this.tokens), text);
  },
);
