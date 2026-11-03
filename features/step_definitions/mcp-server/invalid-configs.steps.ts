/**
 * @fileoverview Steps about MCP config files a plugin cannot be read from:
 * a published file that is missing, that holds text that is not JSON, or
 * that nobody may read (D-CF6-02).
 */

import assert from "node:assert/strict";
import { chmod, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { publishStubServersFile } from "../../lib/mcp-server-files.ts";
import { writePublishedPluginFiles } from "../../lib/published-marketplace.ts";

import type { PublishedMarketplace } from "../../lib/published-marketplace.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const NOT_JSON = "{ not json\n";

// A server map whose one stub server would show up if Pi read the file.
const HIDDEN_SERVERS = '{"mcpServers": {"hidden": {"stub": {}}}}';

// The path of `file` inside the published plugin `plugin`, refused when it
// would leave the plugin.
function publishedPluginFile(
  published: PublishedMarketplace,
  plugin: string,
  file: string,
): string {
  const pluginRoot = path.resolve(published.root, "plugins", plugin);
  const target = path.resolve(pluginRoot, file);
  const relative = path.relative(pluginRoot, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`refusing to touch ${target} outside the plugin ${pluginRoot}`);
  }

  return target;
}

// Takes every permission away from the file, so reading it fails with EACCES,
// and gives the permissions back when the scenario ends. Only a `dir`
// publication takes it: git stores no file mode that denies reading.
async function makeUnreadable(
  world: ScenarioWorld,
  published: PublishedMarketplace,
  plugin: string,
  file: string,
): Promise<void> {
  if (published.kind !== "dir") {
    throw new Error(`a ${published.kind} publication cannot hold a file nobody may read`);
  }

  await publishStubServersFile(published, plugin, file, HIDDEN_SERVERS);
  const target = publishedPluginFile(published, plugin, file);
  await chmod(target, 0o000);
  world.onRelease(() => chmod(target, 0o644));
  await assert.rejects(readFile(target), { code: "EACCES" });
}

// D-CF6-02: each state is one way Claude Code's loader finds no servers in a
// file. A file that nobody may read holds a stub server named `hidden`, which
// Pi would list if it read the file.
Given(
  "the mcp file {string} of the published plugin {string} of the marketplace {string} is {string}",
  async function (this: ScenarioWorld, file: string, plugin: string, name: string, state: string) {
    const published = this.requirePublished(name);
    const target = publishedPluginFile(published, plugin, file);
    switch (state) {
      case "missing":
        await assert.rejects(stat(target), { code: "ENOENT" });
        return;
      case "not valid JSON":
        await writePublishedPluginFiles(published, plugin, { [file]: NOT_JSON });
        assert.strictEqual(await readFile(target, "utf8"), NOT_JSON);
        return;
      case "readable by nobody":
        await makeUnreadable(this, published, plugin, file);
        return;
      default:
        throw new Error(`unknown mcp file state "${state}"`);
    }
  },
);
