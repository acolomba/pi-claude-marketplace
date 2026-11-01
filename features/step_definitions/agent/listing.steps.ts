/**
 * @fileoverview Steps that every agent feature shares: the agents a published
 * plugin holds, the pi-subagents settings that decide which agents it lists,
 * and the agents it advertises to the parent model (HAR-07, AGT-01,
 * D-CF4-13, D-CF4-14, D-08).
 */

import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import {
  agentFileText,
  agentRowText,
  publishAgentFile,
  publishAgentFiles,
  readAgentFileRows,
} from "../../lib/agent-files.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A logged model message that Pi sent as a system message.
function isSystemMessage(message: unknown): message is JsonObject & { role: "system" } {
  return isJsonObject(message) && message.role === "system";
}

// The `advertised_subagents` section of the leading system message of model
// call `number` in `logs`, numbered from 1. It fails when the turn has no
// such call or the call has no such section.
function advertisedSection(logs: ReadonlyMap<string, readonly unknown[]>, number: number): string {
  const messages = modelCallsOf(logs).find((call) => call.index === number - 1)?.messages ?? [];
  const sections = messages.find(isSystemMessage)?.sections;
  const advertised = isJsonObject(sections) ? sections.advertised_subagents : undefined;
  if (typeof advertised !== "string") {
    assert.fail(`model call ${number} of the last turn has no advertised_subagents section`);
  }

  return advertised;
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

// D-CF4-14: the catalog pi-subagents puts in the leading system message of a
// parent call, as Claude Code lists plugin agents to its model. Calls are
// numbered from 1 as the calls step numbers them.
Then(
  "the model call {int} advertises these agents:",
  function (this: ScenarioWorld, number: number, expected: string) {
    const advertised = advertisedSection(this.requireTurn().logs, number);
    assert.strictEqual(projectTokens("text", advertised, this.tokens), expected);
    this.markTurnCompared();
  },
);
