/**
 * @fileoverview Steps about plugin uninstall: what it leaves of a plugin's data directory.
 */

import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";

import { Then } from "@cucumber/cucumber";

import type { ScenarioWorld } from "../../support/world.ts";

Then(
  "the uninstall has removed the data directory of {string} from the {word} scope",
  async function (this: ScenarioWorld, id: string, scope: string) {
    const match = /^(?<plugin>[^/\\@]+)@(?<marketplace>[^/\\@]+)$/u.exec(id);
    const { plugin, marketplace } = match?.groups ?? {};
    if (plugin === undefined || marketplace === undefined) {
      assert.fail(`${id} is not a plugin@marketplace id`);
    }

    const marketplaceData = path.join(
      this.scopeRoot(scope),
      "pi-claude-marketplace",
      "data",
      marketplace,
    );
    assert.ok((await stat(marketplaceData)).isDirectory(), `${marketplaceData} is not a directory`);
    const directory = path.join(marketplaceData, plugin);
    await assert.rejects(stat(directory), { code: "ENOENT" }, `${directory} still exists`);
  },
);
