/**
 * @fileoverview Steps about how skill frontmatter shows in what the model
 * receives: the skills Pi lists in the system prompt of a model call.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { projectTokens } from "../../lib/run-tokens.ts";
import { numberedModelCall } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

const BLOCK_OPEN = "<available_skills>\n";
const BLOCK_CLOSE = "</available_skills>";

// Pi escapes these five characters in each field of a listed skill. `&amp;`
// is undone last, so an escaped entity such as `&amp;lt;` stays `&lt;`.
function unescapeXml(text: string): string {
  return text
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

// D-CF2-09: one `[name, description, location]` row per skill of the
// `<available_skills>` block Pi writes into the system prompt, in Pi's order.
// Pi leaves out a skill that disables model invocation. A missing block, or
// text in it that is not a whole skill entry, fails the step.
function availableSkillRows(systemPrompt: string): [string, string, string][] {
  const start = systemPrompt.indexOf(BLOCK_OPEN);
  if (start === -1) {
    assert.fail("the system prompt has no <available_skills> block");
  }

  const end = systemPrompt.indexOf(BLOCK_CLOSE, start);
  if (end === -1) {
    assert.fail("the <available_skills> block of the system prompt does not end");
  }

  const block = systemPrompt.slice(start + BLOCK_OPEN.length, end);
  const entry =
    / {2}<skill>\n {4}<name>([^<]*)<\/name>\n {4}<description>([^<]*)<\/description>\n {4}<location>([^<]*)<\/location>\n {2}<\/skill>\n/uy;
  const rows: [string, string, string][] = [];
  while (entry.lastIndex < block.length) {
    const match = entry.exec(block);
    if (match === null) {
      assert.fail(`malformed <available_skills> block:\n${block}`);
    }

    const [, name = "", description = "", location = ""] = match;
    rows.push([unescapeXml(name), unescapeXml(description), unescapeXml(location)]);
  }

  return rows;
}

// The skills of the system prompt of one call of the last turn, numbered
// from 1 as the calls step numbers them, with the run tokens projected in
// each location.
Then(
  "the model call {int} lists these skills in its system prompt:",
  function (this: ScenarioWorld, number: number, table: DataTable) {
    const call = numberedModelCall(this.requireTurn().logs, number);

    const rows = availableSkillRows(call.systemPrompt).map(([name, description, location]) => [
      name,
      description,
      projectTokens("text", location, this.tokens),
    ]);
    assert.deepStrictEqual([["name", "description", "location"], ...rows], table.raw());
    this.markTurnCompared();
  },
);
