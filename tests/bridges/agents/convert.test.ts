import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNoAgentCollisions,
  convertAgent,
  MODEL_MAP,
  THINKING_VALUES,
  TOOL_MAP,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/convert.ts";
import { parseFrontmatter } from "../../../extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts";

import type {
  DiscoveredAgent,
  RawAgentFrontmatter,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

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
      // AGSK-03: without Skill among the raw tokens, the error carries no
      // inheritSkills note -- the note is Skill-gated.
      assert.doesNotMatch(err.message, /inheritSkills/);
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
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /mapped tool list is empty/);
      // AGSK-03: no Skill among the raw tokens, so no inheritSkills note.
      assert.doesNotMatch(err.message, /inheritSkills/);
      return true;
    },
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
// AG-7 mapModel opt-in default
// ---------------------------------------------------------------------------

test("AG-7 convertAgent with mapModel: false omits model field entirely (source 'sonnet')", () => {
  // Default behavior: even when the source declares a known model, the
  // generated frontmatter MUST NOT contain a `model:` line. Pi picks its own
  // default.
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

// ---------------------------------------------------------------------------
// AGSK-02 (#86): plugin-qualified skill references in `skills:`
// ---------------------------------------------------------------------------

/** Exact cross-plugin drop wording (AGSK-02) -- pinned as a full sentence. */
function crossPluginSkillWarning(token: string): string {
  return `skill reference "${token}" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`;
}

function convertSpecTree(
  raw: RawAgentFrontmatter,
  knownSkills: readonly string[] = ["spec-tree-review-changes"],
): ReturnType<typeof convertAgent> {
  return convertAgent({
    pluginName: "spec-tree",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills,
    // Keep the fixture internally consistent: a spec-tree plugin generates
    // spec-tree-prefixed agent names, not makeDiscovered's acme default.
    discovered: makeDiscovered({ raw, generatedName: "pi-claude-marketplace-spec-tree-bot" }),
    sourceHash: "abc",
    mapModel: false,
  });
}

function frontmatterOf(fileContent: string): string {
  return fileContent.slice(0, fileContent.indexOf("\n---\n", 4));
}

test("AGSK-02 (#86) same-plugin qualified skill maps identically to its bare form", () => {
  const qualified = convertSpecTree({
    description: "d",
    tools: "Read",
    skills: "spec-tree:review-changes",
  });
  const bare = convertSpecTree({ description: "d", tools: "Read", skills: "review-changes" });
  assert.match(frontmatterOf(qualified.fileContent), /^skills: spec-tree-review-changes$/m);
  assert.equal(qualified.fileContent, bare.fileContent);
  assert.deepEqual(qualified.warnings, []);
});

test("AGSK-02 qualified redundant-prefix form converges on the same generated skill name", () => {
  // generatedSkillName's prefix elision must survive qualifier stripping:
  // spec-tree:spec-tree-review-changes -> spec-tree-review-changes.
  const out = convertSpecTree({
    description: "d",
    tools: "Read",
    skills: "spec-tree:spec-tree-review-changes",
  });
  assert.match(frontmatterOf(out.fileContent), /^skills: spec-tree-review-changes$/m);
  assert.deepEqual(out.warnings, []);
});

test("AGSK-02 cross-plugin qualified skill warns-and-drops naming the full token", () => {
  const out = convertSpecTree({
    description: "d",
    tools: "Read",
    skills: "other-plugin:some-skill",
  });
  assert.ok(
    out.warnings.includes(
      `skill reference "other-plugin:some-skill" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`,
    ),
  );
  // The dropped token never reaches the emit list...
  assert.doesNotMatch(frontmatterOf(out.fileContent), /^skills:/m);
  // ...and does NOT double-warn through the unknown-skill path.
  assert.ok(!out.warnings.some((w) => w.startsWith("unknown skill reference")));
});

test("AGSK-02 qualifier with empty remainder warn-drops instead of throwing", () => {
  // assertSafeName throws on empty names; the stripped remainder guard must
  // keep `spec-tree:` on the warn-drop path.
  let out: ReturnType<typeof convertAgent> | undefined;
  assert.doesNotThrow(() => {
    out = convertSpecTree({ description: "d", tools: "Read", skills: "spec-tree:" });
  });
  assert.ok(out?.warnings.includes(`unknown skill reference "spec-tree:" -- dropped`));
});

test("AGSK-02 qualifier with '.' or '..' remainder warn-drops instead of throwing", () => {
  for (const token of ["spec-tree:.", "spec-tree:.."]) {
    let out: ReturnType<typeof convertAgent> | undefined;
    assert.doesNotThrow(() => {
      out = convertSpecTree({ description: "d", tools: "Read", skills: token });
    });
    assert.ok(
      out?.warnings.includes(`unknown skill reference "${token}" -- dropped`),
      `expected warn-drop naming the full token ${token}`,
    );
  }
});

test("AGSK-02 qualified remainder with path separator or control char warn-drops instead of throwing", () => {
  // assertSafeName also rejects path separators and ASCII control
  // characters; the catch-based guard must keep these remainders on the
  // warn-drop path (a warn-drop must never become a throw).
  for (const token of ["spec-tree:sub/skill", "spec-tree:a\tb"]) {
    let out: ReturnType<typeof convertAgent> | undefined;
    assert.doesNotThrow(() => {
      out = convertSpecTree({ description: "d", tools: "Read", skills: token });
    });
    assert.ok(
      out?.warnings.includes(`unknown skill reference "${token}" -- dropped`),
      `expected warn-drop naming the full token ${JSON.stringify(token)}`,
    );
  }
});

test("AGSK-02 bare tokens that fail name validation warn-drop instead of throwing", () => {
  // Bare (unqualified) tokens reach the same generatedSkillName call, so
  // the catch-based guard must protect them too.
  for (const token of [".", "..", "sub/skill"]) {
    let out: ReturnType<typeof convertAgent> | undefined;
    assert.doesNotThrow(() => {
      out = convertSpecTree({ description: "d", tools: "Read", skills: token });
    });
    assert.ok(
      out?.warnings.includes(`unknown skill reference "${token}" -- dropped`),
      `expected warn-drop naming the token ${JSON.stringify(token)}`,
    );
  }
});

test("AGSK-02 conventional spacing around the qualifier colon still preloads the skill", () => {
  // A dash-list item like `- spec-tree: review-changes` folds verbatim
  // with the space after the colon; both colon slices are trimmed so the
  // intended skill still preloads instead of silently dropping.
  for (const token of ["spec-tree: review-changes", "spec-tree :review-changes"]) {
    const out = convertSpecTree({ description: "d", tools: "Read", skills: token });
    assert.match(
      frontmatterOf(out.fileContent),
      /^skills: spec-tree-review-changes$/m,
      `expected preload for token ${JSON.stringify(token)}`,
    );
    assert.deepEqual(out.warnings, []);
  }
});

test("AGSK-02 bare skill behavior is unchanged: unknown warns, known emits, duplicates kept", () => {
  const unknown = convertSpecTree({ description: "d", tools: "Read", skills: "phantom" });
  assert.ok(unknown.warnings.includes(`unknown skill reference "phantom" -- dropped`));

  const known = convertSpecTree({ description: "d", tools: "Read", skills: "review-changes" });
  assert.match(frontmatterOf(known.fileContent), /^skills: spec-tree-review-changes$/m);

  // No dedupe: duplicate bare tokens still emit twice (pi-subagents dedupes
  // downstream).
  const dupes = convertAgent({
    pluginName: "acme",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: ["acme-knowledge"],
    discovered: makeDiscovered({
      raw: { description: "d", tools: "Read", skills: "knowledge,knowledge" },
    }),
    sourceHash: "abc",
    mapModel: false,
  });
  assert.match(frontmatterOf(dupes.fileContent), /^skills: acme-knowledge,acme-knowledge$/m);
});

test("AGSK-02 crafted cross-plugin token cannot terminate the provenance comment early", () => {
  // The warning echoes the token; sanitizeProvenance must keep a crafted
  // `-->` from closing the HTML comment. Exactly one `-->` may remain: the
  // comment terminator itself.
  const out = convertSpecTree({ description: "d", tools: "Read", skills: "evil-->qual:skill" });
  assert.ok(out.warnings.includes(crossPluginSkillWarning("evil-->qual:skill")));
  assert.equal(out.fileContent.split("-->").length - 1, 1);
});

// ---------------------------------------------------------------------------
// AGSK-03 / D-83.1-01 / D-83.1-02: silent Skill conversion in tools mapping
// ---------------------------------------------------------------------------

test("AGSK-03 / AGSK-05 / D-83.1-01 an allowed Skill tool converts silently: no droppedTools entry, no warning", () => {
  const out = convertSpecTree({ description: "d", tools: "Bash, Read, Skill" });
  assert.deepEqual([...out.droppedTools], []);
  assert.deepEqual([...out.warnings], []);
  assert.match(frontmatterOf(out.fileContent), /^tools: bash,read$/m);
});

test("AGSK-03 non-Skill drops stay silent in warnings", () => {
  const out = convertSpecTree({ description: "d", tools: "Read,WebFetch" });
  assert.deepEqual([...out.droppedTools], ["WebFetch"]);
  assert.ok(!out.warnings.some((w) => w.startsWith("dropped tool")));
});

test("AGSK-03 / D-83.1-02 Skill alongside an unknown tool still records the unknown drop", () => {
  // The Skill skip is per-token: it must not suppress the droppedTools
  // record for a genuinely unmapped tool declared alongside it.
  const out = convertSpecTree({ description: "d", tools: "Read, Skill, WebFetch" });
  assert.deepEqual([...out.droppedTools], ["WebFetch"]);
  assert.deepEqual([...out.warnings], []);
});

test("AGSK-03 omitted tools: keeps only the implicit-default warning", () => {
  // The read,bash,edit default contains no Skill, so only today's
  // omitted-tools warning fires.
  const out = convertSpecTree({ description: "d" });
  assert.deepEqual(out.warnings, [
    "source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.",
  ]);
});

test("AG-11 / AGSK-03 / D-83.1-02 a Skill-only tools list throws with a note explaining the inheritSkills translation", () => {
  // `tools: Skill` is a legal Claude Code agent (skill invocation only).
  // Skill maps to inheritSkills rather than a Pi tool, so the mapped list
  // is empty and AG-11 fires -- the message must explain why the one
  // declared tool produced zero mapped tools.
  assert.throws(
    () => convertSpecTree({ description: "d", tools: "Skill" }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /mapped tool list is empty/);
      assert.match(err.message, /Source tools: Skill/);
      assert.match(
        err.message,
        /Note: the Skill tool maps to inheritSkills, not to a Pi tool, so it does not count toward the tool list\./,
      );
      return true;
    },
  );
});

test("AGSK-03 Skill in disallowedTools only is ignored: no drop entry, no warning", () => {
  // Disallowed tokens that are not in TOOL_MAP never reach the dropped
  // list; Skill absent from tools: keeps inheritSkills: false per D-83-01
  // -- disallowedTools alone never flips the flag (AGSK-05).
  const out = convertSpecTree({ description: "d", tools: "Read,Bash", disallowedTools: "Skill" });
  assert.deepEqual([...out.droppedTools], []);
  assert.match(frontmatterOf(out.fileContent), /^tools: read,bash$/m);
  assert.ok(!out.warnings.some((w) => w.startsWith("dropped tool")));
});

/**
 * AGSK-03 / AGSK-05 / D-83.1-01 / D-83.1-02 / D-83.1-04 (#86): whole-file
 * bytes for an agent that declares Skill in tools: AND lists Skill in
 * disallowedTools. Pins the amended-AGSK-03 silent contract: a
 * Skill-declared-but-disallowed agent converts with no Skill warning, no
 * droppedTools entry, and inheritSkills: false -- Claude-consistent
 * disallowed-wins suppression.
 * Raw literal on purpose -- no interpolated test constants, so later
 * constant renames can never touch this pin. Never edit this constant to
 * make a converter change pass.
 */
const DISALLOWED_SKILL_EXPECTED = `---
name: pi-claude-marketplace-spec-tree-bot
description: d
tools: bash,read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
---

<!--
generated by pi-claude-marketplace
plugin: spec-tree
sourceAgent: bot
sourcePath: /abs/path/source.md
droppedFields: (none)
droppedTools: (none)
warnings: (none)
-->

Body content.
`;

test("AGSK-03 / AGSK-05 / D-83.1-04 Skill declared but disallowed pins the silent whole-file bytes", () => {
  const out = convertSpecTree({
    description: "d",
    tools: "Bash, Read, Skill",
    disallowedTools: "Skill",
  });
  assert.deepEqual([...out.droppedTools], []);
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: false$/m);
  assert.equal(out.fileContent, DISALLOWED_SKILL_EXPECTED);
});

test("AGSK-03 / D-83.1-01 Skill contributes zero warnings even alongside other warnings", () => {
  // Warnings order is provenance-visible bytes: description -> model ->
  // tools -> thinking -> skills. The Skill declaration adds nothing to the
  // tools slot; only the cross-plugin skill drop fires.
  const out = convertSpecTree({
    description: "d",
    tools: "Bash, Read, Skill",
    skills: "other-plugin:x",
  });
  assert.deepEqual(out.warnings, [crossPluginSkillWarning("other-plugin:x")]);
});

// ---------------------------------------------------------------------------
// AGSK-05 / D-83-01: Skill tool declaration maps to inheritSkills
// ---------------------------------------------------------------------------

test("AGSK-05 / D-83.1-02 Skill declared and allowed: inheritSkills true, no drop record, no warning", () => {
  const out = convertSpecTree({ description: "d", tools: "Bash, Read, Skill" });
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: true$/m);
  assert.deepEqual([...out.droppedTools], []);
  assert.deepEqual([...out.warnings], []);
});

test("AGSK-03 / D-83.1-01 Skill declared but disallowed: inheritSkills false, silent", () => {
  const out = convertSpecTree({
    description: "d",
    tools: "Bash, Read, Skill",
    disallowedTools: "Skill",
  });
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: false$/m);
  assert.deepEqual([...out.warnings], []);
});

test("AGSK-05 / D-83-01 Skill not declared keeps inheritSkills: false with no dropped-tool warning", () => {
  const out = convertSpecTree({ description: "d", tools: "Read,Bash" });
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: false$/m);
  assert.ok(!out.warnings.some((w) => w.startsWith("dropped tool")));
});

test("AGSK-05 / D-83-01 omitted tools: default read,bash,edit never flips inheritSkills", () => {
  const out = convertSpecTree({ description: "d" });
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: false$/m);
});

// A skill in the emitted skills: list is eagerly FULL-CONTENT injected into
// the child's context AND lazily listed in the child's inherited catalog
// under the same Pi name. Accepted behavior, no dedup logic (D-83-07).
test("AGSK-05 / D-83-07 a preloaded skill also remains discoverable in the inherited catalog (accepted duplication)", () => {
  const out = convertSpecTree({
    description: "d",
    tools: "Read, Skill",
    skills: "spec-tree:review-changes",
  });
  const frontmatter = frontmatterOf(out.fileContent);
  assert.match(frontmatter, /^skills: spec-tree-review-changes$/m);
  assert.match(frontmatter, /^inheritSkills: true$/m);
});

// ---------------------------------------------------------------------------
// AGSK-04 / D-82-06 / D-82-07: body skill-token detection feeding the legend
// ---------------------------------------------------------------------------

const LEGEND_HEADING = "## Pi coding agent skill legend";

/** Exact legend entry line as rendered by the emitter (arrow is U+2192). */
function legendEntryLine(token: string, generatedName: string): string {
  return `- \`${token}\` \u2192 skill \`${generatedName}\` (available on demand)`;
}

function convertSpecTreeWithBody(
  raw: RawAgentFrontmatter,
  body: string,
  knownSkills: readonly string[] = ["spec-tree-review-changes"],
): ReturnType<typeof convertAgent> {
  return convertAgent({
    pluginName: "spec-tree",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills,
    // Same fixture-consistency rule as convertSpecTree above.
    discovered: makeDiscovered({
      raw,
      body,
      generatedName: "pi-claude-marketplace-spec-tree-bot",
    }),
    sourceHash: "abc",
    mapModel: false,
  });
}

test("AGSK-04 / D-82-06 same-plugin token whose skill is emitted gets a legend entry", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read", skills: "spec-tree:review-changes" },
    "Invoke spec-tree:review-changes on the diff.",
  );
  assert.ok(out.fileContent.includes(LEGEND_HEADING));
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
});

test("AGSK-04 / D-83.1-03 known-but-not-emitted skill token annotates available on demand", () => {
  // The skill is discovered in the plugin (knownSkills) but absent from the
  // source `skills:` list, so it is not preloaded into the child context.
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Invoke spec-tree:review-changes on the diff.",
  );
  assert.ok(out.fileContent.includes(LEGEND_HEADING));
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
});

test("AGSK-05 / D-83.1-03 Skill-declaring agent annotates a known-but-not-emitted skill as available on demand", () => {
  // skills: is absent, so the known skill is not preloaded; with Skill
  // declared and allowed the child can still discover and load it from
  // its inherited catalog under the Pi name.
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read, Skill" },
    "Consult spec-tree:review-changes when needed.",
  );
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
  assert.match(frontmatterOf(out.fileContent), /^inheritSkills: true$/m);
});

test("AGSK-04 / D-83.1-03 the on-demand annotation applies regardless of inheritSkills", () => {
  // No Skill declared: inheritSkills stays false, yet the annotation is the
  // same -- extension-contributed skills survive --no-skills in child
  // sessions, so the catalog is present either way.
  const noSkill = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Consult spec-tree:review-changes when needed.",
  );
  assert.ok(
    noSkill.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );

  // A disallowed Skill turns inheritance off (D-83-01), and the annotation
  // is still the same unified state.
  const disallowed = convertSpecTreeWithBody(
    { description: "d", tools: "Read, Skill", disallowedTools: "Skill" },
    "Consult spec-tree:review-changes when needed.",
  );
  assert.ok(
    disallowed.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
});

test("AGSK-04 / D-82-06 unknown-skill token gets no legend", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Use spec-tree:phantom.",
  );
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
});

test("AGSK-04 / D-82-06 cross-plugin token gets no legend", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Use other-plugin:review-changes.",
  );
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
});

test("AGSK-04 token embedded in a longer word is not a reference (lookbehind boundary)", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Use other-spec-tree:review-changes.",
  );
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
});

test("AGSK-04 dotted plugin-name prefix is not a reference (lookbehind boundary)", () => {
  // Plugin names may legally contain `.`; `other.spec-tree:review-changes`
  // references a plugin named `other.spec-tree`, not `spec-tree`, and must
  // not produce a spurious legend entry.
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "Use other.spec-tree:review-changes.",
  );
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
});

test("AGSK-04 sentence-final punctuation does not poison the token candidate", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read", skills: "spec-tree:review-changes" },
    "Use spec-tree:review-changes.",
  );
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
});

test("AGSK-04 legend entries dedupe by token in first-occurrence body order", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read" },
    "First spec-tree:review-changes then spec-tree:review-changes again, later spec-tree:other.",
    ["spec-tree-review-changes", "spec-tree-other"],
  );
  const reviewLine = legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes");
  const otherLine = legendEntryLine("spec-tree:other", "spec-tree-other");
  // Exactly two entries...
  assert.equal(out.fileContent.split("\u2192 skill").length - 1, 2);
  // ...in first-occurrence order.
  const reviewIdx = out.fileContent.indexOf(reviewLine);
  const otherIdx = out.fileContent.indexOf(otherLine);
  assert.ok(reviewIdx !== -1 && otherIdx !== -1 && reviewIdx < otherIdx);
});

test("AGSK-04 / D-82-07 token appearing only inside a fenced code block still yields a legend entry", () => {
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read", skills: "spec-tree:review-changes" },
    "Run this:\n\n```\npi skill spec-tree:review-changes\n```\n",
  );
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );
});

test("AGSK-04 plugin-prefix-only body candidate never throws and gets no legend", () => {
  // `spec-tree:spec-tree-` scans to candidate `spec-tree-`, which elides to
  // an empty skill name inside generatedSkillName (assertSafeName would
  // throw). The scanner must skip it -- a body scan never throws.
  let out: ReturnType<typeof convertAgent> | undefined;
  assert.doesNotThrow(() => {
    out = convertSpecTreeWithBody(
      { description: "d", tools: "Read" },
      "Use spec-tree:spec-tree- now.",
    );
  });
  assert.ok(out !== undefined && !out.fileContent.includes(LEGEND_HEADING));
});

test("AGSK-04 token-free body emits no legend and stays byte-identical to the pre-legend output", () => {
  // Constant captured from convertAgent BEFORE the legend wiring existed.
  const preLegendExpected = `---
name: pi-claude-marketplace-spec-tree-bot
description: d
tools: read
skills: spec-tree-review-changes
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
---

<!--
generated by pi-claude-marketplace
plugin: spec-tree
sourceAgent: bot
sourcePath: /abs/path/source.md
droppedFields: (none)
droppedTools: (none)
warnings: (none)
-->

Review the diff.
`;
  const out = convertSpecTreeWithBody(
    { description: "d", tools: "Read", skills: "spec-tree:review-changes" },
    "Review the diff.",
  );
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
  assert.equal(out.fileContent, preLegendExpected);
});

// ---------------------------------------------------------------------------
// #86 canonical reproduction: full parse -> convert pipeline (SC-1..SC-4)
// ---------------------------------------------------------------------------

/** The #86 frontmatter shape: CSV tools with Skill + block-list skills. */
function makeCanonicalSource(body: string): string {
  return (
    "---\n" +
    "name: changes-reviewer\n" +
    "description: Reviews changes\n" +
    "tools: Bash, Read, Skill\n" +
    "skills:\n" +
    "  - spec-tree:review-changes\n" +
    "---\n" +
    "\n" +
    body
  );
}

function convertCanonical(sourceText: string): ReturnType<typeof convertAgent> {
  const { raw, body } = parseFrontmatter(sourceText);
  return convertAgent({
    pluginName: "spec-tree",
    pluginRoot: "/root",
    pluginDataDir: "/data",
    knownSkills: ["spec-tree-review-changes"],
    discovered: makeDiscovered({
      sourceName: "changes-reviewer",
      generatedName: "pi-claude-marketplace-spec-tree-changes-reviewer",
      raw,
      body,
    }),
    sourceHash: "abc",
    mapModel: false,
  });
}

test("#86 canonical agent converts end to end with correct frontmatter, provenance, and legend", () => {
  const out = convertCanonical(
    makeCanonicalSource("Invoke spec-tree:review-changes on the diff.\n"),
  );

  // Frontmatter: Skill translated to inheritSkills, block-list skill mapped.
  const frontmatter = frontmatterOf(out.fileContent);
  assert.match(frontmatter, /^tools: bash,read$/m);
  assert.match(frontmatter, /^skills: spec-tree-review-changes$/m);

  // The dash-list item never becomes a bogus `- spec-tree` dropped field.
  assert.ok(!out.droppedFields.includes("- spec-tree"));
  assert.deepEqual([...out.droppedFields], []);

  // Provenance: the Skill translation is silent (AGSK-03 / D-83.1-01 /
  // D-83.1-02) -- no droppedTools entry, no warning.
  assert.deepEqual([...out.droppedTools], []);
  assert.deepEqual([...out.warnings], []);

  // Legend: the body reference maps to the preloaded Pi skill.
  assert.ok(
    out.fileContent.includes(
      legendEntryLine("spec-tree:review-changes", "spec-tree-review-changes"),
    ),
  );

  // Whole-file pin: reviewed line by line against the SC facts above.
  const canonicalExpected = `---
name: pi-claude-marketplace-spec-tree-changes-reviewer
description: Reviews changes
tools: bash,read
skills: spec-tree-review-changes
skillPath: ../pi-claude-marketplace/resources/skills
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: true
---

<!--
generated by pi-claude-marketplace
plugin: spec-tree
sourceAgent: changes-reviewer
sourcePath: /abs/path/source.md
droppedFields: (none)
droppedTools: (none)
warnings: (none)
-->

## Pi coding agent skill legend

These instructions reference Claude skills by their original names. In this Pi session:

- \`spec-tree:review-changes\` \u2192 skill \`spec-tree-review-changes\` (available on demand)

Invoke spec-tree:review-changes on the diff.
`;
  assert.equal(out.fileContent, canonicalExpected);
});

test("#86 canonical agent without a body token converts with no legend (reference-gated)", () => {
  const out = convertCanonical(makeCanonicalSource("Review the diff.\n"));

  // Same frontmatter and provenance facts as the token-bearing twin...
  const frontmatter = frontmatterOf(out.fileContent);
  assert.match(frontmatter, /^tools: bash,read$/m);
  assert.match(frontmatter, /^skills: spec-tree-review-changes$/m);
  assert.deepEqual([...out.droppedFields], []);
  assert.deepEqual([...out.droppedTools], []);
  assert.deepEqual([...out.warnings], []);

  // ...but no legend anywhere in the generated file.
  assert.ok(!out.fileContent.includes(LEGEND_HEADING));
});
