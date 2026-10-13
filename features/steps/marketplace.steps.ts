/**
 * @fileoverview Steps that publish a local marketplace and add it to a scope.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { writeMarketplace } from "../lib/marketplace-fixture.ts";
import { runCommand } from "../lib/pi-commands.ts";

import type { OfferedPlugin } from "../lib/marketplace-fixture.ts";
import type { PluginWorld } from "../lib/world.ts";
import type { DataTable } from "@cucumber/cucumber";

async function offeredPlugins(this: PluginWorld, name: string, table: DataTable): Promise<void> {
  const [header = []] = table.raw();
  assert.deepStrictEqual(header, ["name", "version"]);
  const plugins: OfferedPlugin[] = table.rows().map(([pluginName = "", version = ""]) => ({
    name: pluginName,
    version,
  }));
  await writeMarketplace(path.join(this.marketplacesRoot, name), name, plugins);
}

Given("the marketplace {string} offers these plugins:", offeredPlugins);

async function addedMarketplace(this: PluginWorld, name: string, scope: string): Promise<void> {
  const source = path.join(this.marketplacesRoot, name);
  const payload = await runCommand(
    this.pi,
    `/claude:plugin marketplace add ${source} --scope ${scope}`,
  );
  assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
}

Given("the marketplace {string} is added to the {word} scope", addedMarketplace);
