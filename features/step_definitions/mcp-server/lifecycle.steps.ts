/**
 * @fileoverview Steps about a user's own choices for a plugin's MCP server
 * across the plugin verbs that rewrite its entry, including a request timeout
 * the user wrote (D-08-01, D-08-02, D-CF6-09, D-PG1-11), the fields the user
 * wrote that beat this extension's defaults or that the closed table never
 * writes (D-PG9-03, D-PG9-05), and an entry as release 0.23.0 wrote it, before
 * any default (D-PG9-04).
 */

import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given } from "@cucumber/cucumber";

import {
  writeMcpAdapterOverride,
  writeRelease0230McpAdapterEntry,
} from "../../lib/mcp-server-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The user's own edit of a plugin server's entry, under the key that
// pi-mcp-adapter shows for it, such as `plugin_demo_stub_`. The scenario
// observes the disabled choice, request timeout, or other fields through the
// adapter entry.
Given(
  "the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { disabled: true });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

Given(
  "the user has set the request timeout of the mcp server {string} to {int} ms in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, timeoutMs: number, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, { requestTimeoutMs: timeoutMs });
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

Given(
  "the user has written these fields on the mcp server {string} in the mcp-adapter.json file of the {word} scope:",
  async function (this: ScenarioWorld, key: string, scope: string, fieldsText: string) {
    const fields: unknown = JSON.parse(fieldsText);
    if (!isRecord(fields)) {
      throw new Error(`the user's fields are not a JSON object: ${fieldsText}`);
    }

    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeMcpAdapterOverride(file, key, fields);
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

Given(
  "the mcp-adapter.json file of the {word} scope holds the entry {string} as release 0.23.0 wrote it",
  async function (this: ScenarioWorld, scope: string, key: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const written = await writeRelease0230McpAdapterEntry(file, key);
    assert.strictEqual(await readFile(file, "utf8"), written);
  },
);

// pi-mcp-adapter 7.0.1's `/mcp-adapter enable <key>` removes `disabled` from
// the entry under the key and keeps every other member, the marker included.
Given(
  "the user has enabled the mcp server {string} in the mcp-adapter.json file of the {word} scope",
  async function (this: ScenarioWorld, key: string, scope: string) {
    const file = path.join(this.scopeRoot(scope), "mcp-adapter.json");
    const doc: unknown = JSON.parse(await readFile(file, "utf8"));
    const servers: unknown = isRecord(doc) ? doc.mcpServers : undefined;
    assert.ok(isRecord(doc) && isRecord(servers), `${file} holds no mcpServers object`);
    const entry = servers[key];
    assert.ok(isRecord(entry) && entry.disabled === true, `${key} is not disabled in ${file}`);
    const enabled = Object.fromEntries(
      Object.entries(entry).filter(([field]) => field !== "disabled"),
    );
    const text = `${JSON.stringify({ ...doc, mcpServers: { ...servers, [key]: enabled } }, null, 2)}\n`;
    await writeFile(file, text);
    assert.strictEqual(await readFile(file, "utf8"), text);
  },
);
