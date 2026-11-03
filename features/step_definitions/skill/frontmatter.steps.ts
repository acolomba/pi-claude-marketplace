/**
 * @fileoverview Steps about how skill frontmatter shows in what the model
 * receives: the skills Pi lists in the system prompt of a model call.
 */

import assert from "node:assert/strict";

import { type DataTable, Then } from "@cucumber/cucumber";

import { projectTokens } from "../../lib/run-tokens.ts";
import { numberedModelCall } from "../../lib/scripted-model/script.ts";

import type { ScenarioWorld } from "../../support/world.ts";

// Pi lists the skills a model may load in one `<available_skills>` element,
// with one `<skill>` element for each. Pi lays the list out itself, so the
// readers below accept any whitespace between tags, any attribute on a tag,
// and a field written as a child element or as an attribute of `<skill>`, and
// they ignore every field this extension does not write.
const BLOCK = /<available_skills(?:\s[^>]*)?>([\s\S]*?)<\/available_skills\s*>/gu;
const ATTRIBUTE = /([\w-]+)\s*=\s*"([^"]*)"/gu;

// The fields of a listed skill that this extension writes, in table order.
const SKILL_FIELDS = ["name", "description", "location"] as const;

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

// Every `name -> text` pair of a run of elements, which must hold nothing
// but elements. A name given twice fails, since it would leave a field
// ambiguous.
function childFields(body: string, skill: string): Map<string, string> {
  const fields = new Map<string, string>();
  const child = /\s*<([\w-]+)(?:\s[^>]*)?>([^<]*)<\/\1\s*>/uy;
  while (body.slice(child.lastIndex).trim() !== "") {
    const match = child.exec(body);
    if (match === null) {
      assert.fail(`unreadable <skill> entry in the system prompt:\n${skill}`);
    }

    const [, name = "", text = ""] = match;
    if (fields.has(name)) {
      assert.fail(`a <skill> entry gives <${name}> twice:\n${skill}`);
    }

    fields.set(name, text.trim());
  }

  return fields;
}

// The fields of one `<skill>` element: its children, then its attributes,
// where a field given both ways fails.
function skillRow(attributes: string, body: string, skill: string): [string, string, string] {
  const fields = childFields(body, skill);
  for (const [, name = "", text = ""] of attributes.matchAll(ATTRIBUTE)) {
    if (fields.has(name)) {
      assert.fail(`a <skill> entry gives ${name} twice:\n${skill}`);
    }

    fields.set(name, text);
  }

  const [name, description, location] = SKILL_FIELDS.map((field) => {
    const text = fields.get(field);
    if (text === undefined) {
      assert.fail(`a <skill> entry in the system prompt has no ${field}:\n${skill}`);
    }

    return unescapeXml(text);
  });
  return [name ?? "", description ?? "", location ?? ""];
}

// D-CF2-09: one `[name, description, location]` row per skill of the
// `<available_skills>` element Pi writes into the system prompt, in Pi's
// order. Pi leaves out a skill that disables model invocation. A system
// prompt with no such element or with two, or an element that holds anything
// but whole skill entries, fails the step.
function availableSkillRows(systemPrompt: string): [string, string, string][] {
  const blocks = [...systemPrompt.matchAll(BLOCK)];
  if (blocks.length !== 1) {
    assert.fail(
      `the system prompt has ${blocks.length} <available_skills> elements, not one:\n${systemPrompt}`,
    );
  }

  const block = blocks[0]?.[1] ?? "";
  const rows: [string, string, string][] = [];
  const entry = /\s*<skill(\s[^>]*)?>([\s\S]*?)<\/skill\s*>/uy;
  while (block.slice(entry.lastIndex).trim() !== "") {
    const match = entry.exec(block);
    if (match === null) {
      assert.fail(`malformed <available_skills> element:\n${block}`);
    }

    const [skill, attributes = "", body = ""] = match;
    rows.push(skillRow(attributes, body, skill));
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
