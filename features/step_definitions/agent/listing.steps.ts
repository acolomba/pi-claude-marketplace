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
  readStagedAgentFile,
} from "../../lib/agent-files.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { numberedModelCall } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A logged model message that Pi sent as a system message.
function isSystemMessage(message: unknown): message is JsonObject & { role: "system" } {
  return isJsonObject(message) && message.role === "system";
}

// Every string inside `value`, depth first.
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => stringsIn(item));
  }

  return isJsonObject(value) ? Object.values(value).flatMap((item) => stringsIn(item)) : [];
}

// pi-subagents writes the text of a catalog entry as XML text.
function xmlText(text: string): string {
  return text
    .trim()
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

// The `[name, description]` of each `<subagent>` entry of `text`, in order.
function catalogEntries(text: string): [string, string][] {
  return [...text.matchAll(/<subagent>([\s\S]*?)<\/subagent>/gu)].map(([, entry = ""]) => {
    const name = /<name>([\s\S]*?)<\/name>/u.exec(entry)?.[1];
    const description = /<description>([\s\S]*?)<\/description>/u.exec(entry)?.[1];
    if (name === undefined || description === undefined) {
      assert.fail(`cannot read pi-subagents' catalog entry: ${JSON.stringify(entry)}`);
    }

    return [xmlText(name), xmlText(description)];
  });
}

// The agents pi-subagents advertises in model call `number` of `logs`,
// numbered from 1: the entries of the first text of the call's system
// messages, or else of its system prompt, that holds a catalog. Only the
// entries are read, so pi-subagents' own wording around them goes unstated.
// It fails when the turn has no such call or the call has no catalog.
function advertisedAgents(
  logs: ReadonlyMap<string, readonly unknown[]>,
  number: number,
): [string, string][] {
  const call = numberedModelCall(logs, number);
  const texts = [...stringsIn(call.messages.filter(isSystemMessage)), call.systemPrompt];
  const catalog = texts.find((text) => text.includes("<subagent>"));
  if (catalog === undefined) {
    assert.fail(`model call ${number} of the last turn advertises no agents`);
  }

  return catalogEntries(catalog);
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

// D-CF4-14: the agents pi-subagents advertises to the parent model, as Claude
// Code lists plugin agents to its model, each with the name and description
// the agents bridge writes. Calls are numbered from 1 as the calls step
// numbers them.
Then(
  "the model call {int} advertises these agents:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const rows = advertisedAgents(this.requireTurn().logs, number).map(([name, description]) => [
      name,
      projectTokens("text", description, this.tokens),
    ]);
    assert.deepStrictEqual([["name", "description"], ...rows], table.raw());
    this.markTurnCompared();
  },
);

// The whole text of the agent file that the agents bridge staged for pi-subagents
// in the agents folder of a scope, with the run tokens projected. The doc
// string holds the text without the line feed that ends the file.
Then(
  "the agents folder of the {word} scope holds the file {string} with this text:",
  async function (this: ScenarioWorld, scope: string, fileName: string, expected: string) {
    const text = await readStagedAgentFile(this.tokens, scope, fileName);
    assert.strictEqual(projectTokens("text", text, this.tokens), `${expected}\n`);
  },
);
