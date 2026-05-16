import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoAgentCollisions,
  convertAgent,
  MODEL_MAP,
  THINKING_VALUES,
  TOOL_MAP,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";

import type { DiscoveredAgent } from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

// AG-7 mapping pipeline + AG-11 / AG-12 throws + MODEL_MAP / TOOL_MAP user
// contract.

function makeDiscovered(overrides: Partial<DiscoveredAgent> = {}): DiscoveredAgent {
  const sourceName = overrides.sourceName ?? "bot";
  const generatedName = overrides.generatedName ?? `pi-claude-marketplace-acme-${sourceName}`;
  return {
    sourceName,
    generatedName,
    sourcePath: overrides.sourcePath ?? "/abs/path/source.md",
    sourceHash: overrides.sourceHash ?? "abc123",
    raw: overrides.raw ?? {},
    body: overrides.body ?? "Body content.",
  };
}

test("AG-7 convertAgent maps model 'sonnet' to 'anthropic/claude-sonnet-4-6'", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "sonnet", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.match(out.fileContent, /model: anthropic\/claude-sonnet-4-6/);
  assert.equal(out.originalModel, "sonnet");
});

test("AG-7 convertAgent maps model 'opus' to 'anthropic/claude-opus-4-7'", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "opus", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.match(out.fileContent, /model: anthropic\/claude-opus-4-7/);
});

test("AG-7 convertAgent maps model 'haiku' to 'anthropic/claude-haiku-4-5'", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "haiku", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.match(out.fileContent, /model: anthropic\/claude-haiku-4-5/);
});

test("AG-7 convertAgent maps tools 'Read,Bash,Edit' to 'read,bash,edit'", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read,Bash,Edit" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(out.fileContent, /tools: read,bash,edit/);
});

test("AG-7 convertAgent removes disallowed tools from mapped list", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read,Bash,Edit", disallowedTools: "Bash" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(out.fileContent, /tools: read,edit/);
});

test("AG-7 convertAgent thinking accepts valid values (off,minimal,low,medium,high,xhigh)", () => {
  for (const v of ["off", "minimal", "low", "medium", "high", "xhigh"]) {
    const out = convertAgent({
      pluginName: "acme",
      pluginRoot: "/root",
      pluginDataDir: "/data",
      knownSkills: [],
      discovered: makeDiscovered({ raw: { tools: "Read", thinking: v } }),
      sourceHash: "abc",
      mapModel: false,
    });
    assert.match(out.fileContent, new RegExp(`thinking: ${v}`));
  }
});

test("AG-7 convertAgent thinking with invalid value -- omits and warns when no fallback", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read", thinking: "ultra" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.doesNotMatch(out.fileContent, /thinking:/);
  assert.ok(out.warnings.some((w) => w.includes('unknown thinking value "ultra"')));
});

test("AG-7 convertAgent description fallback: uses synthetic when frontmatter description missing", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(
    out.fileContent,
    /description: Imported Claude Code plugin agent bot from plugin acme\./,
  );
  assert.ok(out.warnings.some((w) => w.includes("source description was missing")));
});

test("AG-7 convertAgent skills field preserved when matches knownSkills (after AG-1 elision)", () => {
  // generatedSkillName('acme', 'knowledge') = 'acme-knowledge'
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: ["acme-knowledge"],
    discovered: makeDiscovered({ raw: { tools: "Read", skills: "knowledge" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(out.fileContent, /skills: acme-knowledge/);
});

test("AG-7 convertAgent skills field warns when reference is unknown", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read", skills: "phantom" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.ok(out.warnings.some((w) => w.includes('unknown skill reference "phantom"')));
});

test("AG-11 convertAgent throws when mapped tool list is empty (only unknown tools)", () => {
  assert.throws(
    () =>
      convertAgent({
        pluginName: "acme",
        pluginRoot: "/root",
        pluginDataDir: "/data",
        knownSkills: [],
        discovered: makeDiscovered({ raw: { tools: "WebFetch" } }),
        sourceHash: "abc",
        mapModel: false,
      }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /mapped tool list is empty/);
      assert.match(err.message, /Source tools: WebFetch/);
      assert.match(err.message, /disallowedTools:/);
      return true;
    },
  );
});

test("AG-11 convertAgent throws when disallowedTools strips everything", () => {
  assert.throws(
    () =>
      convertAgent({
        pluginName: "acme",
        pluginRoot: "/root",
        pluginDataDir: "/data",
        knownSkills: [],
        discovered: makeDiscovered({ raw: { tools: "Read,Bash", disallowedTools: "Read,Bash" } }),
        sourceHash: "abc",
        mapModel: false,
      }),
    (err: unknown) => err instanceof Error && err.message.includes("mapped tool list is empty"),
  );
});

test("AG-12 assertNoAgentCollisions throws with both source names listed when two source names elide to same generated", () => {
  assert.throws(
    () => {
      assertNoAgentCollisions([
        { sourceName: "bot", generatedName: "pi-claude-marketplace-acme-bot" },
        { sourceName: "acme-bot", generatedName: "pi-claude-marketplace-acme-bot" },
      ]);
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /collision detected/);
      assert.match(err.message, /"bot"/);
      assert.match(err.message, /"acme-bot"/);
      return true;
    },
  );
});

test("AG-12 assertNoAgentCollisions returns silently when no collisions", () => {
  assert.doesNotThrow(() => {
    assertNoAgentCollisions([
      { sourceName: "bot", generatedName: "pi-claude-marketplace-acme-bot" },
      { sourceName: "helper", generatedName: "pi-claude-marketplace-acme-helper" },
    ]);
  });
});

test("AG-7 / PI-10 convertAgent passes ${CLAUDE_PLUGIN_ROOT} substitution through to body", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/abs/plugin",
    pluginDataDir: "/abs/data",
    knownSkills: [],
    discovered: makeDiscovered({
      raw: { tools: "Read" },
      body: "Use ${CLAUDE_PLUGIN_ROOT}/foo and ${CLAUDE_PLUGIN_DATA}/bar",
    }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(out.fileContent, /\/abs\/plugin\/foo/);
  assert.match(out.fileContent, /\/abs\/data\/bar/);
  assert.doesNotMatch(out.fileContent, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.doesNotMatch(out.fileContent, /\$\{CLAUDE_PLUGIN_DATA\}/);
});

test("MODEL_MAP snapshot: keys = [sonnet, opus, haiku]; values = [anthropic/claude-sonnet-4-6, anthropic/claude-opus-4-7, anthropic/claude-haiku-4-5]", () => {
  // User contract: byte-for-byte equality. Any drift is a contract break.
  assert.deepEqual(
    { ...MODEL_MAP },
    {
      sonnet: "anthropic/claude-sonnet-4-6",
      opus: "anthropic/claude-opus-4-7",
      haiku: "anthropic/claude-haiku-4-5",
    },
  );
});

test("TOOL_MAP snapshot: 7 entries with V1-exact values", () => {
  assert.deepEqual(
    { ...TOOL_MAP },
    {
      Read: "read",
      Bash: "bash",
      Edit: "edit",
      Write: "write",
      Grep: "grep",
      Glob: "find",
      LS: "ls",
    },
  );
});

test("THINKING_VALUES snapshot: off,minimal,low,medium,high,xhigh", () => {
  const expected = ["off", "minimal", "low", "medium", "high", "xhigh"];
  for (const v of expected) {
    assert.ok(THINKING_VALUES.has(v), `expected THINKING_VALUES to contain ${v}`);
  }

  assert.equal(THINKING_VALUES.size, expected.length);
});

test("AG-7 convertAgent records droppedFields when source has unsupported keys", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/r",
    pluginDataDir: "/d",
    knownSkills: [],
    discovered: makeDiscovered({
      raw: { tools: "Read", custom_field: "x", another: "y" },
    }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.deepEqual([...out.droppedFields].sort(), ["another", "custom_field"]);
});

test("AG-7 convertAgent records droppedTools when source mentions unknown tools", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/r",
    pluginDataDir: "/d",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { tools: "Read,WebFetch,NotebookEdit" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.deepEqual([...out.droppedTools], ["WebFetch", "NotebookEdit"]);
});

test("AG-7 convertAgent omits model and warns when model is unknown", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/r",
    pluginDataDir: "/d",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "future-model", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.equal(out.originalModel, "future-model");
  const fmEnd = out.fileContent.indexOf("\n---\n", 4);
  assert.doesNotMatch(out.fileContent.slice(0, fmEnd), /^model:/m);
  assert.ok(out.warnings.some((w) => w.includes('unknown model "future-model"')));
});

test("AG-7 convertAgent treats inherit as 'no model emit' but records originalModel='inherit'", () => {
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/r",
    pluginDataDir: "/d",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "inherit", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.equal(out.originalModel, "inherit");
});

// ---------------------------------------------------------------------------
// AG-7 mapModel opt-in default (260516-08j)
// ---------------------------------------------------------------------------

test("AG-7 convertAgent with mapModel: false omits model field entirely (source 'sonnet')", () => {
  // Default behavior per 260516-08j: even when the source declares a known
  // model, the generated frontmatter MUST NOT contain a `model:` line. Pi
  // picks its own default.
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "sonnet", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  const fmEnd = out.fileContent.indexOf("\n---\n", 4);
  const frontmatter = out.fileContent.slice(0, fmEnd);
  assert.doesNotMatch(frontmatter, /^model:/m);
  // No mapping was performed -- originalModel is NOT recorded.
  assert.equal(out.originalModel, undefined);
  // And no "unknown model" warning fires either.
  assert.ok(!out.warnings.some((w) => w.includes("unknown model")));
});

test("AG-7 convertAgent with mapModel: false on source 'inherit' omits model and emits no originalModel provenance", () => {
  // The inherit -> omit+originalModel rule is part of the AG-7 mapping
  // table. When the flag is off, the mapping does not run, so even the
  // 'inherit' provenance path is silent. Absence is self-documenting.
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/r",
    pluginDataDir: "/d",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "inherit", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: false,
  });
  const fmEnd = out.fileContent.indexOf("\n---\n", 4);
  const frontmatter = out.fileContent.slice(0, fmEnd);
  assert.doesNotMatch(frontmatter, /^model:/m);
  assert.equal(out.originalModel, undefined);
  assert.doesNotMatch(out.fileContent, /originalModel:/);
});

test("AG-7 convertAgent with mapModel: true preserves byte-for-byte AG-7 mapping for 'sonnet'", () => {
  // Sanity: when --map-model is on, the existing AG-7 contract holds.
  const out = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: [],
    discovered: makeDiscovered({ raw: { model: "sonnet", tools: "Read" } }),
    sourceHash: "abc",
    mapModel: true,
  });
  assert.match(out.fileContent, /model: anthropic\/claude-sonnet-4-6/);
  assert.equal(out.originalModel, "sonnet");
});
