/**
 * @fileoverview Steps about where a plugin declares its MCP servers: its
 * marketplace entry, and a plugin without its own plugin.json, whose entry
 * Claude Code then reads as the manifest (D-CF6-01).
 */

import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

import { Given } from "@cucumber/cucumber";

import {
  removePublishedPluginManifest,
  setPublishedEntryMcpServers,
  withStubServers,
} from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The `mcpServers` of the entry named `plugin` in the marketplace manifest
// text, or undefined when the manifest offers no such entry.
function entryMcpServers(manifestText: string, plugin: string): unknown {
  const manifest: unknown = JSON.parse(manifestText);
  const entries: unknown = isRecord(manifest) ? manifest.plugins : undefined;
  const offered: readonly unknown[] = Array.isArray(entries) ? entries : [];
  const entry = offered.find((item) => isRecord(item) && item.name === plugin);
  return isRecord(entry) ? entry.mcpServers : undefined;
}

// D-CF6-06: the doc string is the entry's `mcpServers` value, whose stub
// markers become stub servers of the plugin.
Given(
  "the marketplace entry of the published plugin {string} of the marketplace {string} declares these stub mcp servers:",
  async function (this: ScenarioWorld, plugin: string, name: string, text: string) {
    const published = this.requirePublished(name);
    const mcpServers = withStubServers(plugin, JSON.parse(text));
    await setPublishedEntryMcpServers(published, plugin, mcpServers);
    assert.deepStrictEqual(
      entryMcpServers(await readFile(published.manifestPath, "utf8"), plugin),
      mcpServers,
    );
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has no plugin.json, so its marketplace entry declares its mcp servers",
  async function (this: ScenarioWorld, plugin: string, name: string) {
    const file = await removePublishedPluginManifest(this.requirePublished(name), plugin);
    await assert.rejects(stat(file), { code: "ENOENT" });
  },
);
