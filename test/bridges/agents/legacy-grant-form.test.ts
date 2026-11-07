import assert from "node:assert/strict";
import test from "node:test";

import { deriveLegacyGrantForms } from "../../../extensions/pi-claude-marketplace/bridges/agents/legacy-grant-form.ts";

import {
  ADAPTER_ASYNC,
  adapterBlock,
  agentBlock,
  BODY,
  BUILTIN_ASYNC,
  builtinBlock,
  legacyRow,
} from "./agent-grant-seeds.ts";

const TARGET = "/scope/agents/pi-claude-marketplace-demo-helper.md";
const PLAIN_BODY = "\nYou help.\n";
const NARROW_TAIL =
  " -- pi-subagents takes no excludeTools beside an explicit tools: list, " +
  "so the agent keeps every tool of that server";
const ADAPTER_NARROW =
  "disallowedTools entry mcp__plugin_demo_my-db__drop cannot narrow the whole-server grant " +
  `mcp:plugin_demo_my-db_${NARROW_TAIL}`;
const BUILTIN_NARROW =
  "disallowedTools entry mcp__plugin_demo_my-db__drop cannot narrow the whole-server grant " +
  `mcp:plugin_demo_my-db${NARROW_TAIL}`;

test("MGRT-01: each mcp: entry of the plugin loses its key's last underscore; other entries stay", () => {
  // arrange
  const adapter = agentBlock(
    "tools: read,mcp:plugin_demo_stub_/echo,mcp:plugin_demo_my-db_,mcp:plugin_other_x_/y,mcp:plugin_demo_odd",
    [ADAPTER_ASYNC],
  );
  const row = legacyRow(TARGET, [ADAPTER_ASYNC]);

  // act
  const recorded = deriveLegacyGrantForms(adapter + PLAIN_BODY, row);

  // assert
  assert.deepStrictEqual(recorded, {
    ...row,
    mcpImplementation: "adapter",
    mcpForms: {
      adapter: { frontmatter: adapter, warnings: [ADAPTER_ASYNC], droppedTools: [] },
      builtin: {
        frontmatter: agentBlock(
          "tools: read,mcp:plugin_demo_stub/echo,mcp:plugin_demo_my-db,mcp:plugin_other_x_/y,mcp:plugin_demo_odd",
          [BUILTIN_ASYNC],
        ),
        warnings: [BUILTIN_ASYNC],
        droppedTools: [],
      },
    },
  });
});

test("MGRT-01: each per-tool exclude name of the plugin becomes Pi's built-in tool name", () => {
  // arrange
  const adapter = agentBlock(
    "excludeTools: bash,mcp__plugin_demo_my-db__query,mcp__plugin_other_a-b__q",
    ["a warning that stays"],
  );
  const row = legacyRow(TARGET, ["a warning that stays"], ["WebFetch"]);

  // act
  const recorded = deriveLegacyGrantForms(adapter + PLAIN_BODY, row);

  // assert
  assert.deepStrictEqual(recorded, {
    ...row,
    mcpImplementation: "adapter",
    mcpForms: {
      adapter: {
        frontmatter: adapter,
        warnings: ["a warning that stays"],
        droppedTools: ["WebFetch"],
      },
      builtin: {
        frontmatter: agentBlock(
          "excludeTools: bash,mcp__plugin_demo_my_db__query,mcp__plugin_other_a-b__q",
          ["a warning that stays"],
        ),
        warnings: ["a warning that stays"],
        droppedTools: ["WebFetch"],
      },
    },
  });
});

test("MGRT-01: an exclude name of exactly 64 characters is translated", () => {
  // arrange
  const name = `mcp__plugin_demo_my-db__${"q".repeat(40)}`;
  const adapter = agentBlock(`excludeTools: ${name}`, []);
  const row = legacyRow(TARGET, []);

  // act
  const recorded = deriveLegacyGrantForms(adapter + PLAIN_BODY, row);

  // assert
  assert.deepStrictEqual(recorded?.mcpForms?.builtin, {
    frontmatter: agentBlock(`excludeTools: mcp__plugin_demo_my_db__${"q".repeat(40)}`, []),
    warnings: [],
    droppedTools: [],
  });
});

test("MGRT-01: an exclude name whose translation passes 64 characters records the adapter form only", () => {
  // arrange
  const adapter = agentBlock(`excludeTools: bash,mcp__plugin_demo_my-db__${"q".repeat(41)}`, [
    ADAPTER_ASYNC,
  ]);
  const row = legacyRow(TARGET, [ADAPTER_ASYNC]);

  // act
  const recorded = deriveLegacyGrantForms(adapter + PLAIN_BODY, row);

  // assert
  assert.deepStrictEqual(recorded, {
    ...row,
    mcpImplementation: "adapter",
    mcpForms: { adapter: { frontmatter: adapter, warnings: [ADAPTER_ASYNC], droppedTools: [] } },
  });
});

test("D-CF6-10 / ANAME-02: the async and cannot-narrow warnings take the built-in texts in the block and the row", () => {
  // arrange
  const warnings = [ADAPTER_ASYNC, ADAPTER_NARROW, "a warning that stays"];
  const adapter = agentBlock("tools: read,mcp:plugin_demo_my-db_", warnings);
  const row = legacyRow(TARGET, warnings);
  const builtinWarnings = [BUILTIN_ASYNC, BUILTIN_NARROW, "a warning that stays"];

  // act
  const recorded = deriveLegacyGrantForms(adapter + PLAIN_BODY, row);

  // assert
  assert.deepStrictEqual(recorded?.mcpForms?.builtin, {
    frontmatter: agentBlock("tools: read,mcp:plugin_demo_my-db", builtinWarnings),
    warnings: builtinWarnings,
    droppedTools: [],
  });
});

test("AG-6: a body holding a --- line does not move the end of the block", () => {
  // arrange
  const row = legacyRow(TARGET, [ADAPTER_ASYNC]);

  // act
  const recorded = deriveLegacyGrantForms(adapterBlock() + BODY, row);

  // assert
  assert.deepStrictEqual(recorded?.mcpForms, {
    adapter: { frontmatter: adapterBlock(), warnings: [ADAPTER_ASYNC], droppedTools: [] },
    builtin: { frontmatter: builtinBlock(), warnings: [BUILTIN_ASYNC], droppedTools: [] },
  });
});

for (const { label, fileText } of [
  { label: "does not open with a --- line", fileText: `# Notes\n${adapterBlock()}${PLAIN_BODY}` },
  {
    label: "has no closing --- line",
    fileText: `${adapterBlock().slice(0, -"---\n".length)}You help.\n`,
  },
  {
    label: "lacks the generated marker",
    fileText: adapterBlock().replace("  generatedBy: pi-claude-marketplace\n", "") + PLAIN_BODY,
  },
]) {
  test(`AG-5: text that ${label} yields no forms`, () => {
    // arrange
    const row = legacyRow(TARGET, [ADAPTER_ASYNC]);

    // act
    const recorded = deriveLegacyGrantForms(fileText, row);

    // assert
    assert.strictEqual(recorded, undefined);
  });
}
