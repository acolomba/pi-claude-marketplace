/**
 * @fileoverview Steps about the legacy move of a plugin's MCP servers out of a
 * scope's `mcp.json`: the user's own servers that file holds before the move,
 * the marked entries that release 0.19.2 left in it, and a plugin record an
 * earlier release wrote before records held options.
 */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import { jsonObject } from "../../lib/earlier-version-state.ts";
import { isPlainObject } from "../../lib/field-rows.ts";
import { readPluginRecord, rewritePluginRecord } from "../../lib/installation-record.ts";
import { legacyMcpServers } from "../../lib/mcp-configuration.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { writeScenarioFile } from "../../lib/scenario-file.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// A scope's mcp.json, the text a step writes there with run tokens expanded,
// and the names of the servers in that text that carry the extension's marker.
function mcpJsonText(
  world: ScenarioWorld,
  scope: string,
  text: string,
): { readonly file: string; readonly expanded: string; readonly markedNames: string[] } {
  const file = path.join(world.scopeRoot(scope), "mcp.json");
  const expanded = expandTokens(text, world.tokens);
  const doc: unknown = JSON.parse(expanded);
  const servers: unknown = isPlainObject(doc) ? Reflect.get(doc, "mcpServers") : undefined;
  assert.ok(isPlainObject(servers), `the text for ${file} holds no mcpServers object`);
  const markedNames = Object.keys(servers).filter((name) => {
    const entry: unknown = Reflect.get(servers, name);
    return isPlainObject(entry) && "_piClaudeMarketplace" in entry;
  });
  return { file, expanded, markedNames };
}

// The marked entries of `servers` grouped by the `<plugin>@<marketplace>` their
// marker names, each group in file order.
function markedEntriesByPlugin(
  servers: Readonly<Record<string, unknown>>,
  markedNames: readonly string[],
): Map<string, Record<string, unknown>> {
  const byPlugin = new Map<string, Record<string, unknown>>();
  for (const name of markedNames) {
    const entry = jsonObject(Reflect.get(servers, name), name);
    const marker = jsonObject(entry._piClaudeMarketplace, `the marker of ${name}`);
    const pluginId = `${String(marker.plugin)}@${String(marker.marketplace)}`;
    const entries = byPlugin.get(pluginId) ?? {};
    entries[name] = entry;
    byPlugin.set(pluginId, entries);
  }

  return byPlugin;
}

// The one `CLAUDE_PLUGIN_ROOT` that the stdio entries of `pluginId` name.
// Release 0.19.2 put env only on a stdio entry, so a remote entry names no
// root, and a plugin with only remote entries takes the writer step instead.
function pluginRootOf(entries: Readonly<Record<string, unknown>>, pluginId: string): string {
  const roots = new Set(
    Object.values(entries)
      .filter(
        (entry): entry is object =>
          isPlainObject(entry) && typeof Reflect.get(entry, "command") === "string",
      )
      .map((entry): unknown => {
        const env: unknown = Reflect.get(entry, "env");
        return isPlainObject(env) ? Reflect.get(env, "CLAUDE_PLUGIN_ROOT") : undefined;
      }),
  );
  const [root, ...others]: unknown[] = [...roots];
  assert.ok(
    typeof root === "string" && others.length === 0,
    `the stdio entries of ${pluginId} name no one plugin root (a plugin with only remote servers needs the writer step)`,
  );
  return root;
}

// D-BG-905: the user's own, unmarked servers, written in the two-space form
// the move writes, so the text after the move compares entry by entry
// (AMIG-02). The file must not exist yet: the frozen release 0.19.2 step adds
// the plugin's marked servers after these.
Given(
  "the mcp.json file of the {word} scope holds the user's own servers before the legacy move, in this text:",
  async function (this: ScenarioWorld, scope: string, text: string) {
    const { file, expanded, markedNames } = mcpJsonText(this, scope, text);
    assert.strictEqual(expanded, `${JSON.stringify(JSON.parse(expanded), null, 2)}\n`);
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

// D-BG-13: a scope's mcp.json as release 0.19.2 left it, holding the marked
// entries of a plugin that the scope may not record (AMIG-02, AMIG-04). The
// text must be what that release wrote: its two-space form, and the marked
// entries of each plugin exactly as it built them from the servers the
// plugin at the entries' `CLAUDE_PLUGIN_ROOT` declares now. The file must not
// exist yet.
Given(
  "the mcp.json file of the {word} scope holds this text, as release 0.19.2 wrote it:",
  async function (this: ScenarioWorld, scope: string, text: string) {
    const { file, expanded, markedNames } = mcpJsonText(this, scope, text);
    assert.notDeepStrictEqual(markedNames, [], `the text for ${file} holds no marked server`);
    assert.strictEqual(expanded, `${JSON.stringify(JSON.parse(expanded), null, 2)}\n`);
    const servers = jsonObject(
      Reflect.get(jsonObject(JSON.parse(expanded), file), "mcpServers"),
      file,
    );
    const groups = [...markedEntriesByPlugin(servers, markedNames)];
    const released = await Promise.all(
      groups.map(([pluginId, entries]) =>
        legacyMcpServers({
          scopeRoot: this.scopeRoot(scope),
          pluginId,
          pluginRoot: pluginRootOf(entries, pluginId),
        }),
      ),
    );
    assert.deepStrictEqual(
      groups.map(([, entries]) => JSON.stringify(entries, null, 2)),
      released.map((entries) => JSON.stringify(entries, null, 2)),
    );

    await mkdir(path.dirname(file), { recursive: true });
    await writeScenarioFile(this, file, expanded);
  },
);
