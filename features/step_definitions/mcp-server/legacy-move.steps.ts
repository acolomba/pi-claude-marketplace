/**
 * @fileoverview Steps about the legacy move of a plugin's MCP servers out of a
 * scope's `mcp.json`: the user's own servers that file holds before the move,
 * and a plugin record an earlier release wrote before records held options.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { isPlainObject } from "../../lib/field-rows.ts";
import { readPluginRecord, rewritePluginRecord } from "../../lib/installation-record.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { writeScenarioFile } from "../../lib/scenario-file.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// D-BG-905: the user's own, unmarked servers, written in the two-space form
// the move writes, so the text after the move compares entry by entry
// (AMIG-02). The file must not exist yet: the frozen release 0.19.2 step adds
// the plugin's marked servers after these.
Given(
  "the mcp.json file of the {word} scope holds the user's own servers before the legacy move, in this text:",
  async function (this: ScenarioWorld, scope: string, text: string) {
    const file = path.join(this.scopeRoot(scope), "mcp.json");
    const expanded = expandTokens(text, this.tokens);
    const doc: unknown = JSON.parse(expanded);
    assert.strictEqual(expanded, `${JSON.stringify(doc, null, 2)}\n`);
    const servers: unknown = isPlainObject(doc) ? Reflect.get(doc, "mcpServers") : undefined;
    assert.ok(isPlainObject(servers), `the text for ${file} holds no mcpServers object`);
    const markedNames = Object.keys(servers).filter((name) => {
      const entry: unknown = Reflect.get(servers, name);
      return isPlainObject(entry) && "_piClaudeMarketplace" in entry;
    });
    assert.deepStrictEqual(markedNames, []);
    await writeScenarioFile(this, file, expanded);
  },
);

// D-PG10-23: a record that an earlier release wrote holds the neutral MCP
// verdict but no `userConfig`, so only the move can give it the options.
Given(
  "the installation record of the plugin {string} in the {word} scope holds no plugin options, as an earlier release wrote it",
  async function (this: ScenarioWorld, pluginId: string, scope: string) {
    const scopeRoot = this.scopeRoot(scope);
    await rewritePluginRecord(scopeRoot, pluginId, (record) =>
      Object.fromEntries(Object.entries(record).filter(([member]) => member !== "userConfig")),
    );
    const record = await readPluginRecord(scopeRoot, pluginId);
    assert.deepStrictEqual(
      [Object.hasOwn(record, "userConfig"), record.compatibilityBasis],
      [false, "neutral"],
    );
  },
);
