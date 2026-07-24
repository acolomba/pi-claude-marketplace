# Phase 83: Skill Tool Inherit Mapping - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 5 (4 modified, 1 guarded-unchanged; types.ts confirmed no-change)
**Analogs found:** 5 / 5 (every file is a self-analog -- this phase extends code Phase 82 just landed)

All paths relative to the worktree root
`/Users/acolomba/src/pi-claude-marketplace/.worktrees/issue-86-agent-skill-preloads/`.
Line numbers verified against HEAD `60105d09` this session (code files identical
to `e442b483`; the two commits since are planning docs only). Where this map and
82-PATTERNS.md disagree on line numbers, this map wins -- Phase 82's landed code
moved things.

## File Classification

| New/Modified File | Change | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|--------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | modify (`ToolMappingResult` + `inheritSkills`; warning-site restructure in `mapTools`/`mapToolTokens`; thread flag in `convertAgent` step 8) | service (pure mapping pipeline) | transform | self: `mapTools` 244-292, `mapToolTokens` 221-242, warning conventions | exact |
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | modify (`GeneratedFrontmatterFields.inheritSkills?`; conditional trio line 272; `renderSkillLegend` third state) | utility (pure emitter) | transform | self: optional-field pattern 184-191 + 259-270, annotation ternary 323-327 | exact |
| `tests/bridges/agents/convert.test.ts` | modify (sanctioned carve-outs at 586-594, 620-630, 846-916; new D-83 pins) | test | -- | self: `SKILL_DROP_WARNING` constant style, `convertSpecTree*` drivers, whole-file pins | exact |
| `tests/bridges/agents/frontmatter.test.ts` | modify (extend: direct-emitter `inheritSkills: true` pin, legend third-state pin) | test | -- | self: `makeLegendEmitInput` + `NO_LEGEND_EXPECTED` byte pins 336-435 | exact |
| `tests/bridges/agents/convert-byte-identity.test.ts` | DO NOT MODIFY (D-83-06 non-Skill guard) | test (regression corpus) | -- | n/a -- it IS the guard; its Class 5 is the shape analog for the new disallowed-direction pin | exact |
| `extensions/pi-claude-marketplace/bridges/agents/types.ts` | NO CHANGE expected | types | -- | n/a -- `ConvertedAgent` (types.ts:49-64) carries no inherit field and `stage.ts` consumes only `fileContent`; the flag lives inside the pipeline | n/a |

## Pattern Assignments

### `bridges/agents/convert.ts` (service, transform)

**Analog:** itself. Three edits: extend `ToolMappingResult`, move/branch the
Skill warning, thread the flag to the emitter.

**Result-interface extension pattern** -- `ToolMappingResult` (lines 74-78) is
the shape D-83-01's boolean joins; readonly fields, plain interface:

```typescript
interface ToolMappingResult {
  readonly mapped: string[];
  readonly dropped: string[];
  readonly warnings: string[];
}
```

Add `readonly inheritSkills: boolean;` here. The sibling per-facet result
shapes (`mapSkills` returns `{ emit, warnings }`, `mapModel` returns
`{ emit, originalModel, warning }`) show the convention: results are plain
data bags computed once, consumed by `convertAgent`.

**The warning site that branches** -- `mapToolTokens` (lines 221-242). The
current push fires inside the token loop, BEFORE `disallowedTools` is read:

```typescript
function mapToolTokens(
  tokens: readonly string[],
  warnings: string[],
): { mapped: string[]; dropped: string[] } {
  const mapped: string[] = [];
  const dropped: string[] = [];
  for (const token of tokens) {
    const piName = TOOL_MAP[token];
    if (piName === undefined) {
      dropped.push(token);
      if (token === "Skill") {
        warnings.push(
          'dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child\'s context',
        );
      }
    } else {
      mapped.push(piName);
    }
  }

  return { mapped, dropped };
}
```

The D-83-04 wording branch keys on the COMBINED flag (declared AND not
disallowed), so either pass the precomputed boolean into `mapToolTokens` or
lift the push into `mapTools` keyed on `dropped.includes("Skill")` after the
flag is known. Both keep the warning in the tools slot of the aggregate order
(the only other tools-slot warning, omitted-`tools:` at lines 257-259, cannot
co-occur with a Skill declaration). The doc comment at 214-220 anchors
AGSK-03 / D-82-08 and must be extended, not contradicted.

**Why disallowed detection must read RAW tokens** -- `mapTools` lines 266-285
filter by Pi names, and `Skill` has no `TOOL_MAP` entry, so this path can
never see it (pinned by convert.test.ts:611-618):

```typescript
  // Apply disallowedTools after mapping. Disallowed values are Claude-side
  // names; map them to Pi names then filter the mapped list.
  const disallowedTokens = splitCsv(rawDisallowed);
  if (disallowedTokens.length > 0) {
    const disallowedPi = new Set<string>();
    for (const token of disallowedTokens) {
      const piName = TOOL_MAP[token];
      if (piName !== undefined) {
        disallowedPi.add(piName);
      }
    }
    ...
```

D-83-01 detection: `splitCsv(rawDisallowed).includes("Skill")` -- exact match,
case-sensitive, same convention as TOOL_MAP lookups. Reuse `splitCsv`
(lines 80-109, handles CSV / inline-array / quotes); do not write a new
tokenizer. Note `splitCsv(rawDisallowed)` will then be computed for the flag
before the existing filter block also computes it -- compute once, reuse.

**Default-tokens guard** (lines 254-262) -- when `tools:` is omitted the
default is `["Read", "Bash", "Edit"]`, which never contains `Skill`, so the
omitted-tools path can never flip the flag (D-83-01 "no other trigger").

**Threading seam** -- `convertAgent` step 3 (line 465) computes
`toolsResult`; step 8 (lines 513-533) is the single emitter call where the
flag joins the frontmatter object:

```typescript
  const fileContent = emitGeneratedAgentFile({
    frontmatter: {
      name: generatedName,
      description,
      ...optionalModel(modelResult.emit),
      tools: toolsResult.mapped,
      ...optionalThinking(thinkingResult.emit),
      skills: skillsResult.emit,
    },
    provenance: { ... },
    body: substitutedBody,
    legend,
  });
```

Add `inheritSkills: toolsResult.inheritSkills` to the frontmatter object
(plain field, no `optionalX` spread helper needed -- the emitter defaults
`undefined` to `false`, and always-passing the boolean is simpler and equally
byte-safe). `ConvertedAgent` (types.ts:49-64) does not change; `droppedTools`
still receives `Skill` via `toolsResult.dropped` untouched (D-83-02 is free --
the drop loop is not modified, only the warning wording).

**Legend data is NOT touched in convert.ts** -- `detectSkillTokens`
(lines 138-174) keeps returning `{ token, generatedName, preloaded }`; the
third annotation state is a render-time decision in frontmatter.ts (D-83-05,
same data/rendering split Phase 82 established).

---

### `bridges/agents/frontmatter.ts` (utility, transform)

**Analog:** itself -- the module header (lines 8-12) declares it the only
place that decides generated-file bytes; keep it that way.

**Optional-field interface pattern** -- `GeneratedFrontmatterFields`
(lines 184-191); `model?` / `thinking?` are the template for the new field:

```typescript
export interface GeneratedFrontmatterFields {
  readonly name: string;
  readonly description: string;
  readonly model?: string;
  readonly tools: readonly string[];
  readonly thinking?: string;
  readonly skills: readonly string[];
}
```

Add `readonly inheritSkills?: boolean;` -- optional-default-false is
load-bearing: every existing direct `emitGeneratedAgentFile` test call
(9 call sites in frontmatter.test.ts, none passing the field) must stay green
unchanged, and `NO_LEGEND_EXPECTED` pins `inheritSkills: false` bytes.

**The hardcoded trio -- the exact line that becomes conditional**
(line 272, one statement):

```typescript
  lines.push("systemPromptMode: replace", "inheritProjectContext: true", "inheritSkills: false");
```

Minimal change preserving AG-8 position (`inheritSkills` is the LAST
frontmatter field, pinned by frontmatter.test.ts:169-207):

```typescript
  lines.push(
    "systemPromptMode: replace",
    "inheritProjectContext: true",
    `inheritSkills: ${(frontmatter.inheritSkills ?? false) ? "true" : "false"}`,
  );
```

Emit the lowercase literal ONLY -- pi-subagents 0.28.0 parses
`frontmatter.inheritSkills === "true"` by string equality
(`~/.pi/agent/npm/node_modules/pi-subagents/src/agents/agents.ts:673-677`);
any other spelling silently falls back to the pi-subagents default.

**Stale comment to update** (lines 251-254) -- currently says all three are
"extension-side defaults and intentionally hardcoded"; that stops being true
for `inheritSkills`. Rewrite to describe the AGSK-05 conditional (same
comment-freshness discipline Phase 82 applied to the parser header when
dash-folding landed). Also touch the AG-8 order sentence at lines 235-236 if
wording implies a constant value (it lists field order only -- likely fine).

**Legend third state -- the exact ternary that branches**
(`renderSkillLegend`, lines 318-336; single call site at line 308):

```typescript
function renderSkillLegend(legend: readonly SkillLegendEntry[] | undefined): string {
  if (legend === undefined || legend.length === 0) {
    return "";
  }

  const entryLines = legend.map((entry) => {
    const annotation = entry.preloaded
      ? "preloaded in your context"
      : "not available in this session";
    return `- \`${entry.token}\` → skill \`${entry.generatedName}\` (${annotation})`;
  });

  return (
    "\n## Pi coding agent skill legend\n\n" +
    "These instructions reference Claude skills by their original names. In this Pi session:\n\n" +
    entryLines.join("\n") +
    "\n"
  );
}
```

Add an `inheritSkills: boolean` parameter; only the `!preloaded` arm
branches (`preloaded` annotation unchanged per D-83-05, pinned by
convert.test.ts:846-901). Call site update (line 308):

```typescript
  return generatedFrontmatter + "\n" + provenanceComment + renderSkillLegend(legend) + bodyFinal;
```

becomes `renderSkillLegend(legend, frontmatter.inheritSkills ?? false)`.
`SkillLegendEntry` (lines 199-203) stays `{ token, generatedName, preloaded }`
-- no discriminated variant (RESEARCH Don't-Hand-Roll table).

**Escape convention for the new annotation string:** the entry line writes
U+2192 as the `→` escape (line 327); source stays ASCII. The on-demand
annotation must be pure ASCII with ` -- ` (never em dash) if it needs a
separator. Note the entry line ALREADY renders the Pi name
(`` → skill `<generatedName>` ``), so `(available on demand)` conveys
D-83-05's "available on demand as `<pi-name>`" without repeating the name --
recommended phrasing, planner pins final wording.

---

### `tests/bridges/agents/convert.test.ts` (test -- extend + sanctioned carve-outs)

**Analog:** itself. Reuse `makeDiscovered` (21-32), `convertSpecTree`
(420-433), `convertSpecTreeWithBody` (644-658), `frontmatterOf` (435-437),
`legendEntryLine` (638-642), `convertCanonical`/`makeCanonicalSource`
(813-844).

**Pinned-wording constant pattern** (lines 585-587) -- the constant that
splits into two:

```typescript
/** D-82-09 exact wording -- byte-identical to the literal in convert.ts. */
const SKILL_DROP_WARNING =
  'dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child\'s context';
```

After Phase 83: two test-local constants, both byte-pinned (naming per
RESEARCH Open Question 3, e.g. `SKILL_DROP_WARNING_NO_INHERIT` /
`SKILL_INHERIT_WARNING`). The old string remains the wording for
declared-but-disallowed agents.

**Tests changing BY DESIGN (D-83-06 carve-outs -- update deliberately):**

| Lines | Test | Change |
|-------|------|--------|
| 589-594 | "AGSK-03 / D-82-09 dropping the Skill tool emits the exact provenance warning" | input `tools: "Bash, Read, Skill"` is declared+allowed -> asserts the NEW wording; add a declared+disallowed twin pinning the OLD string |
| 620-630 | "AGSK-03 aggregate warnings order" | same input class -> tools-slot warning becomes new wording; order contract itself (`[toolsWarning, crossPluginSkillWarning(...)]`) unchanged |
| 846-901 | "#86 canonical agent converts end to end ..." | whole-file pin: `inheritSkills: false` -> `true` (line 879 of the constant), `warnings:` line -> new wording (line 889 interpolates the constant), legend entry stays `(preloaded in your context)`. This updated pin IS success criterion 1's fixture |
| 903-916 | "#86 canonical agent without a body token ..." | `assert.ok(out.warnings.includes(SKILL_DROP_WARNING))` at line 912 -> new constant |

**Tests that must stay green untouched:** 596-600 (non-Skill drops silent),
602-609 (omitted-tools warning -- exact array `assert.deepEqual`), 611-618
(Skill-in-disallowedTools-only -- behavior unchanged since Skill is not
declared; ONLY its stale comment "out of scope here (AGSK-05)" at 612-613 may
be refreshed), 777-807 (token-free-body pre-legend pin, `tools: "Read"`).

**Whole-file pin shape for new D-83 pins** -- the #86 canonical pin
(lines 872-900) is the template: template-literal constant, `assert.equal`,
warning interpolated by constant, `→` escapes in legend lines:

```typescript
  const canonicalExpected = `---
name: pi-claude-marketplace-spec-tree-changes-reviewer
description: Reviews changes
tools: bash,read
skills: spec-tree-review-changes
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
---
...
warnings: ${SKILL_DROP_WARNING}
-->
...
- \`spec-tree:review-changes\` → skill \`spec-tree-review-changes\` (preloaded in your context)
...
`;
  assert.equal(out.fileContent, canonicalExpected);
```

**Wave-0 capture pattern for the disallowed-direction pin** (D-83-06 /
RESEARCH Wave 0 Gaps): before ANY converter change, run
`convertSpecTree({ description: "d", tools: "Read, Skill", disallowedTools: "Skill" })`
(or equivalent) at HEAD and capture `fileContent` into a constant -- same
discipline as the byte-identity corpus header ("captured from the converter
before any ... change"). That input's output today has `inheritSkills: false`,
`droppedTools: Skill`, and the D-82-09 warning; it must be byte-identical
after Phase 83.

**Facet-assert patterns for the new pins:**
- Frontmatter isolation: `frontmatterOf(out.fileContent)` + `assert.match(fm, /^inheritSkills: true$/m)` (pattern at 435-437, 592).
- droppedTools: `assert.deepEqual([...out.droppedTools], ["Skill"])` (line 591) -- reuse verbatim for D-83-02.
- Exact warning membership: `assert.ok(out.warnings.includes(CONST))` (line 593).
- D-83-07 duplication pin: data-level -- same-plugin skill in both
  `skills:` emit AND `inheritSkills: true` frontmatter; comment anchors
  D-83-07, no runtime code.

**Legend third-state end-to-end pin:** extend `legendEntryLine` (638-642)
with the inherit-aware annotation or add a sibling helper; drive through
`convertSpecTreeWithBody` with `tools: "Read, Skill"` + a known-but-not-emitted
skill token in the body (the two-state analog is the test at 673-686,
"known-but-not-emitted skill token annotates not available"). Pin both
directions: same input WITHOUT Skill keeps `not available in this session`.

---

### `tests/bridges/agents/frontmatter.test.ts` (test -- extend)

**Analog:** itself.

**Direct-emitter pins that must NOT change** -- `makeLegendEmitInput`
(336-354) passes no inherit field; `NO_LEGEND_EXPECTED` (356-377) pins
`inheritSkills: false`; the undefined-legend (379-382), empty-legend
(384-387), and two-entry legend (389-435) tests all `assert.equal` against
full-file constants containing `inheritSkills: false`. Optional-default-false
keeps all of them green with zero edits -- if any needs editing, the emitter
change is wrong.

**AG-8 order test survives as-is** (169-207): it asserts relative byte
offsets of `"inheritSkills:"` (key with colon, value-agnostic), so the
conditional value cannot break it.

**New direct-emitter pins to add, following the existing shapes:**
- `inheritSkills: true` path: spread pattern from the empty-legend test
  (line 385): `emitGeneratedAgentFile({ ...makeLegendEmitInput(), inheritSkills: true })`
  -- note the field goes INSIDE `frontmatter`, so the spread is
  `{ ...base, frontmatter: { ...base.frontmatter, inheritSkills: true } }`.
  Pin the full file or at minimum `assert.match(fm, /^inheritSkills: true$/m)`
  plus field order.
- Legend third state at render level: clone the two-entry test (389-435)
  with `inheritSkills: true`; `preloaded: true` entry line unchanged,
  `preloaded: false` entry line carries the new annotation. Full-file
  `assert.equal` (Phase 82 lesson: `includes`-style tests miss separator
  drift).

---

### `tests/bridges/agents/convert-byte-identity.test.ts` (guard -- DO NOT MODIFY)

Not a change target; listed because it is the enforcement mechanism for
D-83-06's non-Skill direction. File header (lines 9-18): "these constants
must never be edited to make a converter change pass." None of the seven
input classes declares `Skill` (Class 5 uses `disallowedTools: "Edit"`).
If any `EXPECTED_N` fails during Phase 83, the implementation is wrong.

Class 5 (lines 169-198) is the shape analog for the new
declared-but-disallowed capture pin (which lives in convert.test.ts, not
here -- this file's header scopes it to the #86 pre-fix corpus).

## Shared Patterns

### Warning-string convention
**Source:** `bridges/agents/convert.ts` lines 210, 232-234, 258, 374, 399
**Apply to:** the D-83-04 inherit-mapping warning
Lowercase sentence, ASCII ` -- ` separator, double-quoted token, no trailing
period, colon-led elaboration acceptable (see the D-82-09 string). Required
elements per D-83-04: maps to Pi skill discovery (`inheritSkills: true`);
installed Pi skills loadable on demand; catalog names differ from Claude
names -- pointer to the body legend (phrase the pointer so it reads correctly
when the reference-gated legend is absent; do NOT make the string conditional
on legend presence -- RESEARCH Open Question 1). RESEARCH's candidate:

```
dropped tool "Skill" -- mapped to Pi skill discovery (inheritSkills: true): installed Pi skills are listed in the child's context and loadable on demand; catalog names are Pi names, which differ from Claude skill names (see the skill legend in the agent body)
```

Planner finalizes; tests pin byte-for-byte. New warning strings inherit
`sanitizeProvenance` for free via `formatOptionalProvenanceList`
(frontmatter.ts:338-340) -- compile-time literal, no new escaping needed.

### Single-boolean threading (compute once, key everything on it)
**Source:** RESEARCH Recommended Threading Design; analog is Phase 82's
`skillsResult.emit` threading (computed in `mapSkills`, consumed by both the
emitter and `detectSkillTokens` at convert.ts:508, 520)
**Apply to:** `inheritSkills` -- computed once in `mapTools` from raw
Claude-side tokens, drives (a) the warning wording branch, (b) the emitted
frontmatter line, (c) the legend annotation state. Never re-derive it at a
second site (RESEARCH Pitfall 1: declared-but-disallowed must produce
Phase 82 bytes exactly).

### Optional emitter field, default preserves bytes
**Source:** `frontmatter.ts` `model?`/`thinking?` (184-191, 259-266) and the
Phase 82 `legend?` field (247, `?? ""`-equivalent behavior at 318-321)
**Apply to:** `inheritSkills?: boolean` with `?? false` -- every existing
direct-emitter test call stays green with zero edits (RESEARCH Pitfall 5).

### Byte-pin discipline (capture before change)
**Source:** `convert-byte-identity.test.ts` header (lines 9-18);
`NO_LEGEND_EXPECTED` comment (frontmatter.test.ts:331-335); the pre-legend
pin comment (convert.test.ts:778)
**Apply to:** the new declared-but-disallowed whole-file constant -- capture
from HEAD BEFORE any converter edit (Wave 0), comment it as captured-at-HEAD.

### ASCII-only source literals (pre-commit survival)
**Source:** frontmatter.ts:327 (`→` escape), convert.test.ts:641/896
(same escape in tests); fix-unicode-dashes hook
**Apply to:** all new warning/annotation strings and pinned constants.
` -- ` never em dash; any non-ASCII byte as a `\uXXXX` escape. Commit
messages ASCII too.

### Comment/test-title anchor policy
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every new comment and test title. Allowed: `AGSK-05`,
`D-83-01`..`D-83-07`, `D-82-NN` (where the old wording is referenced), `#86`,
`AG-8`, `AG-11`, `SC-N`. Forbidden: `Phase 83`, `Plan NN`, `Wave N`, bare
`Pitfall N`. Existing titles show the shape:
`test("AGSK-03 / D-82-09 dropping the Skill tool emits the exact provenance warning", ...)`.

### Exact-match token detection
**Source:** convert.ts:214-220 doc comment ("exact match, like TOOL_MAP
lookups") + `TOOL_MAP[token]` lookups
**Apply to:** `Skill` detection in both `tools:` tokens and raw
`disallowedTools` tokens -- case-sensitive `"Skill"`, via `splitCsv` output
(RESEARCH Assumption A1; a lowercase `skill` does not match, consistent with
the existing convention).

## No Analog Found

None. Every change extends a pattern that exists at HEAD in the same file.
The only genuinely new artifacts are (a) the second warning wording and
(b) the third legend annotation string -- both are string-literal branches of
existing pinned strings, with wording as Claude's discretion (D-83-04,
D-83-05) to be finalized by the planner and pinned by tests.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/bridges/agents/`
(convert.ts, frontmatter.ts, types.ts full reads), `tests/bridges/agents/`
(convert.test.ts, frontmatter.test.ts, convert-byte-identity.test.ts full
reads), `.claude/rules/typescript-comments.md`, 82-PATTERNS.md,
83-CONTEXT.md, 83-RESEARCH.md
**Files scanned:** 6 code/test files read in full at HEAD `60105d09`; no
broader search needed -- CONTEXT locks the implementation surface to these
files and Phase 82's fresh code is the primary analog
**Pattern extraction date:** 2026-07-19
