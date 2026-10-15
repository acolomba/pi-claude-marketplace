/**
 * @fileoverview Steps that publish a local marketplace and add it to a scope.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import { readOfferedPlugins, writeMarketplace } from "../lib/path-marketplace.ts";
import { runCommand } from "../lib/pi-commands.ts";

import type { PluginWorld } from "../support/world.ts";

Given(
  "the marketplace {string} offers these plugins:",
  async function (this: PluginWorld, name: string, table: DataTable) {
    const root = path.join(this.marketplacesRoot, name);
    await writeMarketplace(root, name, readOfferedPlugins(table));
  },
);

Given(
  "the marketplace {string} is added to the {word} scope",
  async function (this: PluginWorld, name: string, scope: string) {
    const source = path.join(this.marketplacesRoot, name);
    const payload = await runCommand(
      this.pi,
      `/claude:plugin marketplace add ${source} --scope ${scope}`,
    );
    assert.strictEqual(payload.severity, "info", JSON.stringify(payload));
  },
);
