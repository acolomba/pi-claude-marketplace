/**
 * @fileoverview Steps about running a bridged agent: the part of the child's
 * system prompt that the agent file supplies, and the tools that pi-subagents
 * offers the child the run starts (AGT-02).
 *
 * pi-subagents words the rest of a child's system prompt and adds tools of
 * its own, and a release may change either, so these steps state only what
 * the agents bridge decides.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { readStagedAgentFile } from "../../lib/agent-files.ts";
import { projectTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf, numberedModelCall } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// AG-7: the Pi tools that the agents bridge maps a Claude tool name to. An
// agent's tools list grants or denies only these, so a step compares only
// these. pi-subagents' own tools, such as `contact_supervisor`, are its
// choice and stay out of the comparison.
const AGENT_NAMEABLE_TOOLS: ReadonlySet<string> = new Set([
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
]);

// The frontmatter block at the start of a staged agent file.
const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n/u;

// The names of the tools of model call `number` of the last turn, numbered
// from 1, that an agent's tools list can name, in the order Pi offered them.
function offeredNameableTools(world: ScenarioWorld, number: number): string[] {
  const calls = modelCallsOf(world.requireTurn().logs);
  const tools = calls.find((call) => call.index === number - 1)?.tools;
  assert.ok(tools !== undefined, `the last turn has no model call ${number}`);
  return tools.map((tool) => tool.name).filter((name) => AGENT_NAMEABLE_TOOLS.has(name));
}

// The number of times `part` occurs in `text`.
function occurrences(text: string, part: string): number {
  return text.split(part).length - 1;
}

// D-CF4-04: the agents bridge writes the agent body, and after it each
// preloaded skill, into the staged agent file. The step compares that body
// whole, then requires the child's system prompt to hold it exactly once.
// The rest of the prompt is pi-subagents' own and goes unstated.
Then(
  "the agent's model call {int} runs on the body of the agent file {string} of the {word} scope, which reads:",
  async function (
    this: ScenarioWorld,
    number: number,
    fileName: string,
    scope: string,
    expected: string,
  ) {
    const text = await readStagedAgentFile(this.tokens, scope, fileName);
    const body = text.replace(FRONTMATTER_PATTERN, "").trim();
    assert.strictEqual(projectTokens("text", body, this.tokens), expected);

    const { systemPrompt } = numberedModelCall(this.requireTurn().logs, number);
    assert.strictEqual(
      occurrences(systemPrompt, body),
      1,
      `the system prompt of model call ${number} does not hold the agent body once:\n${systemPrompt}`,
    );
  },
);

// AG-7: of the tools an agent's tools list can name, the ones the child is
// offered, so the table states what the agent's tools list grants and denies.
Then(
  "the agent's model call {int} is offered these of the tools an agent can name:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const rows = offeredNameableTools(this, number).map((name) => [name]);
    assert.deepStrictEqual([["tool"], ...rows], table.raw());
    this.markTurnCompared();
  },
);

// #179: an agent without a tools list narrows nothing, so its child is
// offered the same nameable tools as the session that runs it, whichever
// tools Pi offers by default.
Then(
  "the agent's model call {int} is offered the tools an agent can name that the model call {int} is offered",
  function (this: ScenarioWorld, child: number, parent: number) {
    const parentTools = offeredNameableTools(this, parent);
    assert.notDeepStrictEqual(parentTools, [], `model call ${parent} is offered no nameable tool`);
    assert.deepStrictEqual(offeredNameableTools(this, child), parentTools);
    this.markTurnCompared();
  },
);
