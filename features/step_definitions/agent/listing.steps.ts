/**
 * @fileoverview Steps that every agent feature shares: the agents a published
 * plugin holds, and the pi-subagents settings that decide which agents it
 * lists (HAR-07, AGT-01, D-CF4-13, D-08).
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given } from "@cucumber/cucumber";

import {
  agentFileText,
  agentRowText,
  publishAgentFile,
  publishAgentFiles,
  readAgentFileRows,
} from "../../lib/agent-files.ts";

import type { ScenarioWorld } from "../../support/world.ts";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Returns `settings` with `value` set at the nested `keys`, keeping every
// other key at each level.
function withSetting(settings: JsonObject, keys: readonly string[], value: unknown): JsonObject {
  const [key, ...rest] = keys;
  if (key === undefined) {
    return settings;
  }

  if (rest.length === 0) {
    return { ...settings, [key]: value };
  }

  const inner = settings[key];
  return { ...settings, [key]: withSetting(isJsonObject(inner) ? inner : {}, rest, value) };
}

async function readTextIfPresent(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if (isJsonObject(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

// Sets one pi-subagents setting in the user scope's `settings.json`, which Pi
// itself may already have written when the profile Pi started, and keeps
// every other key. The release restores the previous bytes, or removes the
// file when this step created it.
async function mergeUserSetting(
  world: ScenarioWorld,
  keys: readonly string[],
  value: unknown,
): Promise<void> {
  const file = path.join(world.tokens.agentDir, "settings.json");
  const previous = await readTextIfPresent(file);
  const parsed: unknown = previous === undefined ? {} : JSON.parse(previous);
  assert.ok(isJsonObject(parsed), `${file} does not hold a JSON object`);
  const merged = withSetting(parsed, keys, value);
  await writeFile(file, `${JSON.stringify(merged, null, 2)}\n`);
  world.onRelease(() =>
    previous === undefined ? rm(file, { force: true }) : writeFile(file, previous),
  );
  assert.deepStrictEqual(JSON.parse(await readFile(file, "utf8")), merged);
}

Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} described as {string} with this body:",
  async function (
    this: ScenarioWorld,
    plugin: string,
    name: string,
    agent: string,
    description: string,
    body: string,
  ) {
    const published = this.requirePublished(name);
    const file = await publishAgentFile(published, plugin, { name: agent, description, body });
    assert.strictEqual(
      await readFile(file, "utf8"),
      agentFileText({ name: agent, description, body }),
    );
  },
);

Given(
  "the published plugin {string} of the marketplace {string} has these agents:",
  async function (this: ScenarioWorld, plugin: string, name: string, table: DataTable) {
    const rows = readAgentFileRows(table);
    const files = await publishAgentFiles(this.requirePublished(name), plugin, rows);
    assert.deepStrictEqual(
      await Promise.all(files.map((file) => readFile(file, "utf8"))),
      rows.map((row) => agentRowText(row)),
    );
  },
);

// D-CF4-13: with its builtins hidden, pi-subagents lists only the agents a
// scenario installs.
Given("pi-subagents hides its builtin agents", async function (this: ScenarioWorld) {
  await mergeUserSetting(this, ["subagents", "disableBuiltins"], true);
});

Given(
  "pi-subagents hides the builtin agent {string}",
  async function (this: ScenarioWorld, agent: string) {
    await mergeUserSetting(this, ["subagents", "agentOverrides", agent, "disabled"], true);
  },
);
