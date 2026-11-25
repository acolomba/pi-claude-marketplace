/**
 * @fileoverview Steps about the scripted model of a profile Pi: starting the
 * profile Pi with it, arming its script, and the calls it receives (D-CF1-17).
 *
 * A feature file writes the whole script as literals. The calls step and the
 * single-call step `the model call {int} receives these messages:` read the
 * call log, never the script, so they state what Pi sent the model. A
 * companion's tool result or task message reads as `features/lib/upstream/`
 * reduces it, so a row states only the facts this extension owns.
 */

import assert from "node:assert/strict";
import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import { type DataTable, Given, Then } from "@cucumber/cucumber";

import { isInPeerCache } from "../lib/companions.ts";
import { listedCommands } from "../lib/pi-rpc.ts";
import { expandTokens, projectTokens } from "../lib/run-tokens.ts";
import {
  callMessageRows,
  modelCallsOf,
  numberedModelCall,
  parseScriptTable,
  readModelScript,
  writeModelScript,
} from "../lib/scripted-model/script.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../support/world.ts";

import type { RunTokens } from "../lib/run-tokens.ts";
import type { ScenarioWorld } from "../support/world.ts";

// Some texts carry an id drawn for each run, such as the session id that a
// skill or a slash command puts in its text.
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gu;

// The extension prefixes a finished input that starts with `/` with U+200B,
// which a feature file cannot show, so a scenario states it as a token.
const ZERO_WIDTH_SPACE = /\u200B/gu;

// A text Pi sent the model, with the run tokens projected, each UUID read as
// `{uuid}`, so a scenario states a per-run id without knowing its value, and
// each zero-width space read as `{zero width space}`.
function projectCallText(text: string, tokens: RunTokens): string {
  return projectTokens("text", text, tokens)
    .replaceAll(UUID_PATTERN, "{uuid}")
    .replaceAll(ZERO_WIDTH_SPACE, "{zero width space}");
}

// HAR-01: a profile Pi started with no companion loads none, so no command
// comes from the optional peer cache.
Given(
  "pi runs with the scripted model",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [] });
    const { response } = await this.pi.request({ type: "get_commands" });
    const commands = listedCommands(response);
    assert.notDeepStrictEqual(commands, [], JSON.stringify(response));
    assert.deepStrictEqual(
      commands.filter(({ sourcePath }) => sourcePath !== undefined && isInPeerCache(sourcePath)),
      [],
    );
  },
);

// D-PG6-24: Pi holds a model that cannot reason at the thinking level `off`,
// so a scenario that sets a level starts with a model that reasons.
Given(
  "pi runs with a scripted model that reasons",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], reasoningModel: true });
  },
);

// Pi lowers a level the model cannot take to one it can, so the step reads
// the level back and fails on one Pi changed.
Given(
  "the user has set the thinking level {string}",
  async function (this: ScenarioWorld, level: string) {
    const set = await this.pi.request({ type: "set_thinking_level", level });
    assert.strictEqual(set.response.success, true, JSON.stringify(set.response));
    const { response } = await this.pi.request({ type: "get_state" });
    assert.strictEqual(response.success, true, JSON.stringify(response));
    assert.strictEqual((response.data as { readonly thinkingLevel?: string }).thinkingLevel, level);
  },
);

// Pi loads every extension twice in a project that needs a trust decision,
// once to ask the extensions and once with the decision, so this start gets
// two trusted starts' budget.
const UNTRUSTED_START_TIMEOUT_MS = 2 * PROFILE_PI_START_TIMEOUT_MS;

// D-CF1-07: the profile Pi starts with no entry in Pi's trust store. With a pi
// settings file in the project, that alone makes Pi distrust the project.
Given(
  "pi runs with the scripted model in an untrusted project",
  { timeout: UNTRUSTED_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], trust: "untrusted" });
    await assert.rejects(access(path.join(this.tokens.agentDir, "trust.json")), {
      code: "ENOENT",
    });
  },
);

// D-PG10-17: the profile Pi starts with `false` saved for the project in Pi's
// trust store, which is what Pi's "Do not trust" option saves. A saved `false`
// wins even in a folder that holds none of Pi's trust-requiring resources.
Given(
  'pi runs with the scripted model in a project the user marked "do not trust"',
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({ companions: [], trust: "refused" });
    const { agentDir, projectDir } = this.tokens;
    assert.deepStrictEqual(JSON.parse(await readFile(path.join(agentDir, "trust.json"), "utf8")), {
      [await realpath(projectDir)]: false,
    });
  },
);

Given(
  "the scripted model plays these steps:",
  async function (this: ScenarioWorld, table: DataTable) {
    const rows = table.raw().map((cells) => cells.map((cell) => expandTokens(cell, this.tokens)));
    const steps = parseScriptTable(rows);
    const harness = this.profileHarness();
    await writeModelScript(harness, steps);
    assert.deepStrictEqual(await readModelScript(harness), steps);
  },
);

// One row per message of every call of the last turn, system messages aside,
// in call order: each call repeats the conversation so far.
Then("the model receives these calls:", function (this: ScenarioWorld, table: DataTable) {
  const rows = callMessageRows(modelCallsOf(this.requireTurn().logs)).map(([call, role, text]) => [
    call,
    role,
    projectCallText(text, this.tokens),
  ]);
  assert.deepStrictEqual([["call", "role", "text"], ...rows], table.raw());
  this.markTurnCompared();
});

// One row per message of one call of the last turn, system messages aside,
// numbered from 1 as the calls step numbers them. A scenario about one call
// of a long turn, such as the call after a compaction, states that call
// whole, while the script bounds the turn's calls.
Then(
  "the model call {int} receives these messages:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const call = numberedModelCall(this.requireTurn().logs, number);
    const rows = callMessageRows([call]).map(([, role, text]) => [
      role,
      projectCallText(text, this.tokens),
    ]);
    assert.deepStrictEqual([["role", "text"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
