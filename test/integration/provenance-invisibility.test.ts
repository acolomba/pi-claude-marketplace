// test/integration/provenance-invisibility.test.ts
//
// T-d8i-01 headline safety claim, verified against pi-subagents' OWN parser:
// the provenance folded under the frontmatter `provenance:` mapping stays
// invisible to the child subagent. The child subagent's system prompt is
// exactly the `body` that pi-subagents' `parseFrontmatter` returns
// (pi-subagents' agent loader parses an agent file with
// `parseFrontmatter(content)` and sets `systemPrompt: body`), so running a
// real `emitGeneratedAgentFile(...)`
// output through that parser and inspecting its `body` + top-level
// `frontmatter` keys is the load-bearing check. This extension reads source
// agents as YAML, which is not how pi-subagents reads the generated file, so
// only pi-subagents' own reader can prove what reaches the child.
//
// D-PG7-06 / AG-8: the same reader proves that no line of a multi-line
// description becomes a key or closes the frontmatter, and that a one-line
// description that is only a block header is read as text. D-PG7-18: so is a
// one-line description that YAML would not read as its text.
//
// pi-subagents is an optional peer. The test imports its compiled
// `src/agents/frontmatter.js` in place from the version the suites run in the optional
// peer cache, through pi-subagents-peer.ts (D-PG1-02). A missing or wrong-version package
// fails the test, and so does a module that is missing or fails to import. A
// run reports the proven version as a diagnostic.

import assert from "node:assert/strict";
import { test } from "node:test";

import { emitGeneratedAgentFile } from "../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";
import { GENERATED_AGENT_MARKER } from "../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";

import { findPiSubagentsPackage, loadPiSubagentsModule } from "./pi-subagents-peer.ts";

interface PiSubagentsFrontmatterModule {
  readonly parseFrontmatter: (content: string) => {
    frontmatter: Record<string, string>;
    body: string;
  };
}

test("T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser", async (t) => {
  // arrange
  const peer = await findPiSubagentsPackage();
  t.diagnostic(`pi-subagents ${peer.version} at ${peer.root}`);
  const fm = await loadPiSubagentsModule<PiSubagentsFrontmatterModule>(peer, "frontmatter");

  // A distinctive body so any provenance leak into the child system prompt
  // is unambiguous. Provenance values are equally distinctive.
  const bodyText = "CHILD SYSTEM PROMPT: perform the delegated task and report.";
  const agentFileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description: "An agent.",
      model: "anthropic/claude-sonnet-4-6",
      tools: ["read", "bash"],
      skills: ["acme-knowledge"],
      inheritSkills: true,
    },
    provenance: {
      pluginName: "acme",
      sourceName: "bot",
      sourcePath: "/abs/provenance-source.md",
      originalModel: "sonnet",
      // Exercises BOTH list forms: a non-empty block list (droppedFields,
      // warnings, each rendered `    - item`) and an empty inline `[]`
      // (droppedTools) -- the two shapes the safety claim must survive. The
      // second item of each block list is written double-quoted (T-07-05).
      droppedFields: ["provColorField", "@provQuotedField"],
      droppedTools: [],
      warnings: ["provWarningText leaked check", "provQuotedWarning: a: b"],
    },
    body: bodyText,
  });

  // act
  const { frontmatter, body } = fm.parseFrontmatter(agentFileContent);

  // assert
  // (a) The parsed body IS the child subagent's system prompt. It must carry
  //     none of the provenance keys, values, or the generated marker.
  const provenanceLeaks = [
    // keys
    "generatedBy",
    "sourcePlugin",
    "sourceAgent",
    "sourcePath",
    "originalModel",
    "droppedFields",
    "droppedTools",
    "warnings",
    // marker text
    GENERATED_AGENT_MARKER,
    // values
    "provColorField",
    "provQuotedField",
    "provWarningText",
    "provQuotedWarning",
    "/abs/provenance-source.md",
  ];
  for (const needle of provenanceLeaks) {
    assert.ok(
      !body.includes(needle),
      `child system prompt (body) must not contain provenance token ${JSON.stringify(needle)}`,
    );
  }

  // The boundary landed exactly at the closing `---`: the body pi-subagents
  // hands the child is precisely the source body (their parser .trim()s it),
  // proving the nested provenance block did not shift the frontmatter/body
  // split into the prompt.
  assert.equal(body, bodyText);

  // (b) None of the provenance member keys surfaced as TOP-LEVEL config
  //     keys -- pi-subagents folded the whole indented block under the single
  //     `provenance` key and never re-parsed its members.
  for (const provKey of [
    "generatedBy",
    "sourcePlugin",
    "sourceAgent",
    "sourcePath",
    "originalModel",
    "droppedFields",
    "droppedTools",
    "warnings",
  ]) {
    assert.equal(
      frontmatter[provKey],
      undefined,
      `provenance member ${provKey} must not become a top-level frontmatter key`,
    );
  }

  // The real top-level config keys parsed correctly (the boundary and key
  // set were not corrupted by the appended provenance mapping).
  assert.equal(frontmatter.name, "pi-claude-marketplace-acme-bot");
  assert.equal(frontmatter.model, "anthropic/claude-sonnet-4-6");
  assert.equal(frontmatter.tools, "read,bash");
  assert.equal(frontmatter.skills, "acme-knowledge");
  assert.equal(frontmatter.inheritSkills, "true");

  // The provenance block rode along as the single `provenance` key's value
  // (a multi-line string), carrying the marker -- so isOwnedAgentFile's
  // whole-file substring check still matches while the child never sees it.
  assert.ok(
    frontmatter.provenance?.includes(GENERATED_AGENT_MARKER),
    "the provenance mapping value must carry the generated marker",
  );
});

const EMPTY_PROVENANCE = {
  pluginName: "acme",
  sourceName: "bot",
  sourcePath: "agents/bot.md",
  droppedFields: [],
  droppedTools: [],
  warnings: [],
} as const;

test("D-PG7-06: no line of a description block becomes a key under pi-subagents' own reader", async () => {
  // arrange
  const peer = await findPiSubagentsPackage();
  const fm = await loadPiSubagentsModule<PiSubagentsFrontmatterModule>(peer, "frontmatter");
  const description = [
    "First line: with a colon.",
    "name: injected",
    "tools: bash",
    "# not a comment",
    "",
    "---",
    "Last line.",
  ].join("\n");
  const agentFileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: "pi-claude-marketplace-acme-bot",
      description,
      skills: [],
      inheritSkills: true,
    },
    provenance: EMPTY_PROVENANCE,
    body: "Answer the task.",
  });

  // act
  const { frontmatter, body } = fm.parseFrontmatter(agentFileContent);

  // assert
  assert.equal(frontmatter.description, description);
  assert.equal(frontmatter.name, "pi-claude-marketplace-acme-bot");
  assert.equal(Object.hasOwn(frontmatter, "tools"), false);
  assert.equal(body, "Answer the task.");
});

for (const header of ["|", "|-", ">", ">-"]) {
  test(`D-PG7-06: a description that is only ${header} reads as text under pi-subagents' own reader`, async () => {
    // arrange
    const peer = await findPiSubagentsPackage();
    const fm = await loadPiSubagentsModule<PiSubagentsFrontmatterModule>(peer, "frontmatter");
    const agentFileContent = emitGeneratedAgentFile({
      frontmatter: {
        name: "pi-claude-marketplace-acme-bot",
        description: header,
        tools: ["read"],
        skills: [],
        inheritSkills: true,
      },
      provenance: EMPTY_PROVENANCE,
      body: "Answer the task.",
    });

    // act
    const { frontmatter } = fm.parseFrontmatter(agentFileContent);

    // assert
    assert.equal(frontmatter.description, header);
    assert.equal(frontmatter.tools, "read");
    assert.equal(frontmatter.systemPromptMode, "replace");
  });
}

for (const description of [
  "Reviews: code.",
  "Reviews #1 and #2",
  "@reviewer checks it",
  '"Quoted words."',
]) {
  test(`D-PG7-18: the one-line description ${JSON.stringify(description)} reads as its text under pi-subagents' own reader`, async () => {
    // arrange
    const peer = await findPiSubagentsPackage();
    const fm = await loadPiSubagentsModule<PiSubagentsFrontmatterModule>(peer, "frontmatter");
    const agentFileContent = emitGeneratedAgentFile({
      frontmatter: {
        name: "pi-claude-marketplace-acme-bot",
        description,
        tools: ["read"],
        skills: [],
        inheritSkills: true,
      },
      provenance: EMPTY_PROVENANCE,
      body: "Answer the task.",
    });

    // act
    const { frontmatter } = fm.parseFrontmatter(agentFileContent);

    // assert
    assert.deepStrictEqual(
      { description: frontmatter.description, tools: frontmatter.tools },
      { description, tools: "read" },
    );
  });
}

test("T-07-05: a quoted name and alias read as their text under pi-subagents' own reader", async () => {
  // arrange
  const peer = await findPiSubagentsPackage();
  const fm = await loadPiSubagentsModule<PiSubagentsFrontmatterModule>(peer, "frontmatter");
  const agentFileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: "acme:Reviewer: code",
      description: "Reviews files",
      aliases: ["pi-claude-marketplace-acme-Reviewer: code"],
      tools: ["read"],
      skills: [],
      inheritSkills: true,
    },
    provenance: EMPTY_PROVENANCE,
    body: "Answer the task.",
  });

  // act
  const { frontmatter } = fm.parseFrontmatter(agentFileContent);

  // assert
  assert.deepStrictEqual(
    { name: frontmatter.name, aliases: frontmatter.aliases },
    { name: "acme:Reviewer: code", aliases: "pi-claude-marketplace-acme-Reviewer: code" },
  );
});
