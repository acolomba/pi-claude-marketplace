# Phase 83: Skill Tool Inherit Mapping - Research

**Researched:** 2026-07-19
**Domain:** agents-bridge conversion pipeline (TypeScript, pure functions) -- `Skill` tool detection to `inheritSkills: true` emission
**Confidence:** HIGH -- every implementation-surface claim read from current HEAD (`e442b483`); every external-behavior claim re-verified against installed pi-subagents 0.28.0 source and pi-coding-agent dist this session

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Mapping rule
- **D-83-01:** `Skill` present in source `tools:` AND not present in
  `disallowedTools` -> emit `inheritSkills: true`. Otherwise emit
  `inheritSkills: false` (today's value). No other trigger flips the flag.
- **D-83-02:** `Skill` remains recorded in `droppedTools` either way -- it
  is still not a Pi tool; what changes is the capability story told in the
  warning.
- **D-83-03:** User rationale (accepted): name mapping is already decided
  and discovery-by-description is what we get; catalog scope is equivalent
  between Claude Code (session skills) and Pi (agent-dir + project
  skills); an agent that declared dynamic skill access must get the Pi
  analog.

#### Provenance warning (branches Phase 82's D-82-09)
- **D-83-04:** For `Skill`-declaring agents the warning states: the Skill
  tool maps to Pi skill discovery (`inheritSkills: true`); installed Pi
  skills are discoverable and loadable on demand; catalog names differ
  from Claude names -- see the body legend. Exact string is Claude's
  discretion; pin with tests. Non-Skill agents keep the Phase 82 wording
  (which remains accurate for them).

#### Legend third state (extends Phase 82's D-82-05/06)
- **D-83-05:** For `Skill`-declaring agents, known-but-not-preloaded
  skills are annotated "available on demand as `<pi-name>`" instead of
  "not available in this session". Preloaded annotation unchanged.
  Non-Skill agents keep the two Phase 82 states.

#### Byte-identical contract
- **D-83-06:** The no-change guarantee is relative to Phase 82 output and
  carves out `Skill`-declaring agents (their `inheritSkills` line and
  warning text change by design). Pin both directions: a Skill-declaring
  fixture changes exactly as specified; a non-Skill fixture is
  byte-identical to its Phase 82 snapshot.

#### Accepted duplication edge
- **D-83-07:** A skill in the emitted `skills:` list is ALSO discoverable
  in the inherited catalog under its Pi name (eager injection + lazy
  listing). Accepted behavior; document with a pinning test, no dedup
  logic.

### Claude's Discretion
- Exact warning string and legend "available on demand" phrasing.
- Whether the emitted `inheritSkills:` line placement stays in the
  hardcoded trio (it should -- deterministic field order per AG-8).

### Deferred Ideas (OUT OF SCOPE)
- Install-time opt-out flag (e.g. `--no-inherit-skills`, analogous to
  `--map-model` opt-in) if users report contamination concerns -- only if
  demand appears.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGSK-05 | A source agent declaring the `Skill` tool (and not disallowing it via `disallowedTools`) converts with `inheritSkills: true` in generated frontmatter -- Pi's lazy skill catalog (name+description listing, read on demand) is the faithful analog of Claude's environment-dependent Skill tool. Provenance warning for these agents states the mapping and that catalog names differ from Claude names (see body legend); the legend annotates known-but-not-preloaded skills as available on demand under their Pi name. Agents not declaring `Skill` keep `inheritSkills: false` byte-identically. | Sections "Current HEAD Implementation Shape" (where every seam lives), "Recommended Threading Design" (how the flag flows mapTools -> emitter -> legend), "Exact Pinned Strings" (the wording being branched), "Test Impact Map" (sanctioned carve-outs vs must-stay-green pins), "External Behavior Evidence" (inheritSkills semantics verified in pi-subagents 0.28.0) |
</phase_requirements>

## Summary

Phase 83 is a small, fully-scoped extension of code that landed hours ago in Phase 82 (commits through `e442b483`, all 87 agents-bridge tests green at HEAD). Three files change: `convert.ts` (compute the inherit flag in `mapTools`, branch the Skill-drop warning wording), `frontmatter.ts` (split `inheritSkills` out of the hardcoded trio line into an optional field defaulting to `false`, teach `renderSkillLegend` the third annotation state), and the two test files that pin them. The byte-identity corpus (`convert-byte-identity.test.ts`, 7 classes, none declaring `Skill`) must survive untouched; four existing pins in `convert.test.ts` change BY DESIGN because they exercise `Skill`-declaring agents -- D-83-06 explicitly sanctions those updates.

Every load-bearing external claim was re-verified this session against the installed pi-subagents 0.28.0 source (the compatibility floor itself): `inheritSkills: false` spawns the child with `--no-skills`; the frontmatter parser requires the literal lowercase string `true`; declared `skills:` remain full-content injected regardless of the flag; and Pi's inherited catalog is a lazy name+description+path listing appended to a custom system prompt only when the `read` tool is selected.

The one subtlety the planner must not miss: the Skill-drop warning is currently pushed inside `mapToolTokens`, which runs BEFORE `disallowedTools` processing in `mapTools`. The Phase 83 wording branch depends on the combined flag (declared AND allowed), so the warning site must either receive the precomputed flag or move after the disallowed computation -- while preserving the pinned warnings order (tools slot strictly before skills slot).

**Primary recommendation:** Extend `ToolMappingResult` with an `inheritSkills: boolean` computed in `mapTools` from raw Claude-side tokens; key BOTH the warning wording branch and the emitted flag on that single boolean; make `GeneratedFrontmatterFields.inheritSkills` optional-default-false so every existing direct-emitter test stays green unchanged.

## Architectural Responsibility Map

This phase lives entirely in the pure conversion pipeline (no I/O, no UI, no state). Tiers here are module responsibilities, not deployment tiers.

| Capability | Primary Owner | Secondary Owner | Rationale |
|------------|--------------|-----------------|-----------|
| Skill-declared-and-allowed detection (D-83-01) | `convert.ts` `mapTools` | -- | Raw `tools:`/`disallowedTools:` strings are only visible there; TOOL_MAP semantics live there |
| Warning wording branch (D-83-04) | `convert.ts` (Skill warning site) | -- | Warnings are convert-side data; provenance rendering just joins them |
| `inheritSkills:` line emission | `frontmatter.ts` `emitGeneratedAgentFile` | -- | Module contract: only place deciding generated-file bytes (AG-8) |
| Legend third state (D-83-05) | `frontmatter.ts` `renderSkillLegend` | `convert.ts` supplies `SkillLegendEntry[]` unchanged | Established data/rendering split from AGSK-04: detection returns plain data; every byte-layout decision lives in the emitter |
| Byte-identity + carve-out pins (D-83-06) | `tests/bridges/agents/convert-byte-identity.test.ts` (unchanged) + `convert.test.ts` / `frontmatter.test.ts` (extended) | -- | Corpus pins non-Skill classes; per-facet pins carry the carve-outs |
| Duplication pin (D-83-07) | `tests/bridges/agents/convert.test.ts` | -- | Data-level fact (skill in both `skills:` emit and catalog); no runtime code |

## Standard Stack

No new dependencies. This phase edits two existing pure TypeScript modules and their node:test files.

### Core (all already in place, carry forward)
| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v26.5.0 installed [VERIFIED: `node --version` this session] | Runtime; native TS strip, `node --test` runs `.ts` directly |
| TypeScript | `^5.9.3` (project) | Strict mode; `tsc --noEmit` in `npm run check` |
| node:test | built-in | All pins; `assert.equal` whole-file byte pins are the established pattern |

### Alternatives Considered
None. CONTEXT locks the implementation surface; introducing any dependency (YAML lib, etc.) is already rejected by D-82-02 and the project's What-NOT-to-Use table.

## Package Legitimacy Audit

**This phase installs no external packages.** No slopcheck run required. `npm install` is not part of any plan for this phase; `package.json` is untouched (version bumps are a PR-time concern handled outside phase execution, and this milestone follows the [Unreleased]-CHANGELOG concurrent-milestone policy).

## Current HEAD Implementation Shape

All paths relative to the worktree root. Line numbers are current HEAD (`e442b483`). All claims below [VERIFIED: read from HEAD this session].

### `extensions/pi-claude-marketplace/bridges/agents/convert.ts`

**`SUPPORTED_SOURCE_FIELDS`** (lines 29-38) already contains `"disallowedTools"` -- no droppedFields interaction for this phase.

**`ToolMappingResult`** (lines 74-78):
```typescript
interface ToolMappingResult {
  readonly mapped: string[];
  readonly dropped: string[];
  readonly warnings: string[];
}
```

**`splitCsv(value: string | undefined): string[]`** (lines 80-109) -- handles bare CSV, inline-array `["A","B"]`, per-item quote stripping, trims, drops empties. This is how `disallowedTools` raw strings become tokens.

**`mapToolTokens(tokens, warnings): { mapped, dropped }`** (lines 221-242) -- the current Skill warning site. Inside the token loop:
```typescript
if (piName === undefined) {
  dropped.push(token);
  if (token === "Skill") {
    warnings.push(
      'dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child\'s context',
    );
  }
}
```
The doc comment (lines 214-220) anchors AGSK-03 / D-82-08 / D-82-09 and notes exact-match semantics ("exact match, like TOOL_MAP lookups").

**`mapTools(rawTools, rawDisallowed): ToolMappingResult`** (lines 244-292), in order:
1. If `rawTools === undefined`: push the omitted-tools warning and default tokens to `["Read", "Bash", "Edit"]` (never contains `Skill` -- the default can never flip the flag).
2. Call `mapToolTokens(tokens, warnings)` -- Skill warning fires HERE, before disallowed processing.
3. `disallowedTokens = splitCsv(rawDisallowed)`; each disallowed token is looked up in `TOOL_MAP` and the resulting **Pi names** filter `mapped`. **`Skill` is not in TOOL_MAP, so `disallowedTools: Skill` has zero effect on the mapped list today** (pinned by convert.test.ts:611). D-83-01's disallowed-detection must therefore inspect the **raw Claude-side tokens** (`splitCsv(rawDisallowed).includes("Skill")`), not the Pi-mapped set.
4. Returns `{ mapped: dedupePreservingOrder(...), dropped, warnings }`.

**`convertAgent(input): ConvertedAgent`** (lines 416-548), relevant steps:
- Step 3 (line 465): `const toolsResult = mapTools(raw.tools, raw.disallowedTools);` then `warnings.push(...toolsResult.warnings);` then the AG-11 empty-tools throw.
- Step 7.5 (line 508): `const legend = detectSkillTokens(substitutedBody, pluginName, knownSkills, skillsResult.emit);`
- Step 8 (lines 513-533): calls `emitGeneratedAgentFile({ frontmatter: { name, description, ...optionalModel, tools, ...optionalThinking, skills }, provenance: {...}, body, legend })`. **The frontmatter object has no inheritSkills field today** -- the emitter hardcodes it.

**`ConvertedAgent`** (types.ts lines 49-64) has no inherit-related field. `stage.ts:134-144` consumes only `fileContent` (plus names/hashes/provenance arrays) -- nothing downstream needs a new field. [VERIFIED: read stage.ts call site]

**`SkillLegendEntry`** (frontmatter.ts lines 199-203): `{ token, generatedName, preloaded: boolean }`. The third legend state does NOT require a data change -- it derives from `preloaded === false` plus the inherit flag at render time (see Recommended Threading Design).

### `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`

**`GeneratedFrontmatterFields`** (lines 184-191): `name`, `description`, `model?`, `tools`, `thinking?`, `skills`. No inherit field.

**`emitGeneratedAgentFile`** (lines 243-309). The hardcoded trio is ONE statement, line 272:
```typescript
lines.push("systemPromptMode: replace", "inheritProjectContext: true", "inheritSkills: false");
```
The comment above it (lines 251-254) says the trio is "extension-side defaults and intentionally hardcoded". That comment goes stale for `inheritSkills` and must be updated (same pattern as Phase 82 updating the "no list-of-dash arrays" comment when it became stale).

Assembly (line 308): `generatedFrontmatter + "\n" + provenanceComment + renderSkillLegend(legend) + bodyFinal`.

**`renderSkillLegend(legend)`** (lines 318-336):
```typescript
const annotation = entry.preloaded
  ? "preloaded in your context"
  : "not available in this session";
return `- \`${entry.token}\` → skill \`${entry.generatedName}\` (${annotation})`;
```
Block shape: `"\n## Pi coding agent skill legend\n\n" + "These instructions reference Claude skills by their original names. In this Pi session:\n\n" + entryLines.join("\n") + "\n"`. Note the Pi name **already appears in every entry line** (`→ skill \`<pi-name>\``) -- relevant to the D-83-05 phrasing discretion (see Open Questions).

### AG-8 field ordering constraint

`frontmatter.test.ts:169` pins the order: `name, description, model, tools, thinking, skills, systemPromptMode, inheritProjectContext, inheritSkills` -- **`inheritSkills` is the LAST frontmatter field**. The conditional value must keep that position (CONTEXT discretion note agrees: keep it in the trio position). The minimal change is splitting the third string out of the single `lines.push(...)` into a template with the flag value.

### pi-subagents round-trip requirement

pi-subagents 0.28.0 (the installed version AND the declared compatibility floor) parses the field as string-literal comparison [VERIFIED: `~/.pi/agent/npm/node_modules/pi-subagents/src/agents/agents.ts:673-677`]:
```typescript
const inheritSkills = frontmatter.inheritSkills === "true"
  ? true
  : frontmatter.inheritSkills === "false"
    ? false
    : defaultInheritSkills();
```
Emit exactly lowercase `true` / `false`. Any other spelling silently falls back to the pi-subagents default.

## Exact Pinned Strings (Phase 82 user contract, quoted from HEAD)

These are byte-pinned by tests. Phase 83 branches some of them for `Skill`-declaring-and-allowed agents ONLY.

**D-82-09 Skill-drop warning** (convert.ts:233, pinned as `SKILL_DROP_WARNING` in convert.test.ts:586-587):
```
dropped tool "Skill" -- generated agents run with skills discovery disabled (inheritSkills: false); only the skills listed in skills: are preloaded into the child's context
```
After Phase 83 this exact string remains the wording for `Skill`-declared-but-disallowed agents (byte-identity, success criterion 2) and stays absent for non-declaring agents.

**Omitted-tools warning** (convert.ts:258, pinned convert.test.ts:606-609):
```
source agent omitted `tools:` -- defaulted to read,bash,edit. Add `tools: read,bash,edit` (or your intended subset) to the source agent to silence this warning.
```

**Cross-plugin skill warning** (convert.ts:374): `skill reference "<token>" is qualified with a different plugin -- dropped (only this plugin's skills can be preloaded)`

**Unknown skill warning** (convert.ts:399): `unknown skill reference "<token>" -- dropped`

**Legend block** (frontmatter.ts:318-336, pinned in both test files):
- Heading: `## Pi coding agent skill legend`
- Intro: `These instructions reference Claude skills by their original names. In this Pi session:`
- Entry: `` - `<token>` → skill `<generatedName>` (<annotation>) `` with annotation `preloaded in your context` or `not available in this session`
- The U+2192 arrow is written as the `→` escape in every `.ts` literal (source stays ASCII; fix-unicode-dashes hook safe). Phase 83's new annotation string must follow the same rule: ASCII text, ` -- ` (double hyphen) never em dash, any non-ASCII byte as an escape.

**Warnings order pin** (convert.test.ts:620-630): warnings array order is description -> model -> tools -> thinking -> skills slots; for `tools: "Bash, Read, Skill"` + `skills: "other-plugin:x"` the array is exactly `[SKILL_DROP_WARNING, crossPluginSkillWarning]`. The Phase 83 warning must land in the same tools slot.

## Test Impact Map (D-83-06 both directions)

### Must stay byte-identical -- do NOT touch these

| File / test | Why it survives |
|-------------|-----------------|
| `tests/bridges/agents/convert-byte-identity.test.ts` -- all 7 classes | No input declares `Skill` (Class 5 has `disallowedTools: "Edit"`, not Skill). File header forbids editing constants to make a converter change pass. This corpus IS the D-83-06 non-Skill direction. |
| `frontmatter.test.ts` legend pins (`NO_LEGEND_EXPECTED`, empty-legend, two-entry D-82-04/05 pin, lines 356-435) | They call `emitGeneratedAgentFile` directly WITHOUT an inherit field; with `inheritSkills?: boolean` defaulting to `false` the emitted bytes are unchanged, including `inheritSkills: false` in the pinned constants. |
| `frontmatter.test.ts:169` AG-8 field-order test | `inheritSkills:` stays the last field; only its value becomes conditional. |
| `convert.test.ts:777-807` token-free-body pre-legend pin | Input `tools: "Read"` -- no Skill. |
| `convert.test.ts:611-618` "Skill in disallowedTools only is ignored" | `tools: "Read,Bash"` -- Skill not declared, so D-83-01 emits false and nothing changes. (Its comment says Skill/disallowedTools semantics are "out of scope here (AGSK-05)" -- that comment can be refreshed when the semantics land, a comment-only edit.) |
| `convert.test.ts:596-609` non-Skill-drop / omitted-tools warning tests | No Skill involved. |

### Change BY DESIGN (sanctioned carve-outs; the plan must update these deliberately, not as collateral)

| File / test (HEAD lines) | What changes |
|--------------------------|--------------|
| `convert.test.ts:589-594` "dropping the Skill tool emits the exact provenance warning" | Input declares Skill with no disallow -> new D-83-04 wording. Recommend keeping a test for BOTH wordings: this one becomes (or is joined by) the declared-and-allowed pin; a new declared-but-disallowed test pins the unchanged D-82-09 string. |
| `convert.test.ts:620-630` "aggregate warnings order" | Same input class -> the tools-slot warning becomes the new wording; order contract itself unchanged. |
| `convert.test.ts:846-901` #86 canonical whole-file pin | `inheritSkills: false` -> `true` in the pinned frontmatter; warning line -> new wording. Legend entry stays `(preloaded in your context)` (D-83-05: preloaded annotation unchanged). This updated pin IS success criterion 1's fixture. |
| `convert.test.ts:903-916` #86 canonical no-body-token twin | Asserts `SKILL_DROP_WARNING` inclusion -> new wording. |
| `SKILL_DROP_WARNING` test constant (convert.test.ts:586) | Split into two constants (e.g. `SKILL_DROP_WARNING_DISABLED` / `SKILL_DROP_WARNING_INHERIT`) or rename; both remain byte-pinned. |

### New pins Phase 83 must add

1. **D-83-01 matrix:** declared+allowed -> `inheritSkills: true`; declared+disallowed -> `false` AND whole-file byte-identical to the Phase 82 output of that input (capture the constant from HEAD before the change -- same Wave-0 discipline as 82-01); not declared -> `false` (already covered by corpus, but an explicit facet assertion is cheap).
2. **D-83-02:** `droppedTools` still contains `Skill` when `inheritSkills: true`.
3. **D-83-04:** exact-equality pin of the new warning string.
4. **D-83-05:** legend third state -- Skill-declaring agent + known-but-not-emitted skill -> new annotation; same input WITHOUT Skill -> `not available in this session` unchanged (both directions).
5. **D-83-06:** whole-file pin of a Skill-declaring fixture's NEW output (the updated canonical pin covers this) + the disallowed byte-identity pin from item 1.
6. **D-83-07:** pinning test documenting that a skill present in emitted `skills:` coexists with `inheritSkills: true` (eager full-content injection + lazy catalog listing under the same Pi name); comment anchors D-83-07, no dedup logic.

Test-title/comment policy: anchor with `AGSK-05`, `D-83-NN`, `#86` -- never "Phase 83" (`.claude/rules/typescript-comments.md`).

## Recommended Threading Design

The single-boolean design that satisfies all four success criteria with minimal surface:

### 1. `convert.ts` -- compute once in `mapTools`

```typescript
// Source: derived from HEAD mapTools (convert.ts:244-292) + D-83-01
interface ToolMappingResult {
  readonly mapped: string[];
  readonly dropped: string[];
  readonly warnings: string[];
  readonly inheritSkills: boolean;   // NEW: D-83-01 -- Skill declared AND not disallowed
}

// In mapTools, BEFORE or replacing the current in-loop warning push:
const skillDeclared = tokens.includes("Skill");            // post-default tokens; the
                                                           // Read/Bash/Edit default never
                                                           // contains Skill (D-83-01: no
                                                           // other trigger flips the flag)
const skillDisallowed = splitCsv(rawDisallowed).includes("Skill");  // RAW Claude-side
                                                           // tokens -- TOOL_MAP has no
                                                           // Skill entry, so the existing
                                                           // Pi-name filter can't see it
const inheritSkills = skillDeclared && !skillDisallowed;
```

**Warning branch keys on `inheritSkills`, not on declaration alone.** Declared-but-disallowed must produce the byte-identical Phase 82 warning (success criterion 2). The current push lives inside `mapToolTokens` (line 231) which runs before `rawDisallowed` is read; either pass the precomputed boolean into `mapToolTokens`, or drop the in-loop push and emit the warning in `mapTools` keyed on `dropped.includes("Skill")`. Both preserve the pinned warnings order (the only other tools-slot warning is the omitted-`tools:` default, which can never co-occur with a Skill declaration).

### 2. `convert.ts` -- thread to the emitter

In `convertAgent` step 8, add to the frontmatter object: `inheritSkills: toolsResult.inheritSkills`. No `ConvertedAgent` change; nothing downstream reads the flag (stage.ts consumes `fileContent`).

### 3. `frontmatter.ts` -- optional field, default false

```typescript
// Source: derived from HEAD emitGeneratedAgentFile (frontmatter.ts:243-309)
export interface GeneratedFrontmatterFields {
  // ...existing fields...
  readonly inheritSkills?: boolean;  // default false -- CONTEXT: "split inheritSkills out
                                     // of the hardcoded string into a parameter with
                                     // default false"
}

// Line 272 becomes:
const inheritSkills = frontmatter.inheritSkills ?? false;
lines.push(
  "systemPromptMode: replace",
  "inheritProjectContext: true",
  `inheritSkills: ${inheritSkills ? "true" : "false"}`,  // lowercase literal -- pi-subagents
);                                                        // 0.28.0 parses === "true"
```
Optional-default-false keeps every existing direct-emitter test (all legend byte pins, AG-8 order test) green with zero edits. Update the stale "intentionally hardcoded" comment (lines 251-254) to describe the AGSK-05 conditional.

### 4. `frontmatter.ts` -- legend third state at render time

`SkillLegendEntry` stays `{ token, generatedName, preloaded }` (established data/rendering split: detection returns plain data, byte decisions live in the emitter). `renderSkillLegend` gains the flag:

```typescript
// Source: derived from HEAD renderSkillLegend (frontmatter.ts:318-336) + D-83-05
function renderSkillLegend(
  legend: readonly SkillLegendEntry[] | undefined,
  inheritSkills: boolean,
): string {
  // annotation for preloaded entries: unchanged.
  // annotation for !preloaded: inheritSkills ? <new on-demand wording>
  //                                          : "not available in this session"
}
```
`emitGeneratedAgentFile` passes `frontmatter.inheritSkills ?? false` at the single call site (line 308). Non-Skill agents keep both Phase 82 states byte-identically.

### Candidate wording (Claude's discretion -- planner finalizes, tests pin)

Warning (D-83-04 required elements: maps to Pi skill discovery / on-demand loadable / names differ, see body legend; style: lowercase ` -- ` continuation, no trailing period, matching D-82-09):
```
dropped tool "Skill" -- mapped to Pi skill discovery (inheritSkills: true): installed Pi skills are listed in the child's context and loadable on demand; catalog names are Pi names, which differ from Claude skill names (see the skill legend in the agent body)
```
Legend annotation (D-83-05): the entry line already renders `` → skill `<pi-name>` ``, so `(available on demand)` conveys "available on demand as `<pi-name>`" without repeating the name -- or `(available on demand in the skill catalog)` if more explicitness is wanted. Keep ASCII.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Disallowed-token parsing | A new tokenizer for `disallowedTools` | Existing `splitCsv` | Already handles CSV, inline-array, quotes; it is what the Pi-name filter path uses |
| Boolean serialization | Any YAML boolean helper | Template literal `"true"`/`"false"` | pi-subagents does string-literal comparison; anything fancier risks the silent-fallback path |
| Third legend state as new entry type | A discriminated `SkillLegendEntry` variant | Render-time flag on `renderSkillLegend` | Data shape stays stable; matches the 82-04 "legend data/rendering split" pattern; zero convert.ts legend changes |
| Duplication handling (D-83-07) | Dedup between `skills:` list and catalog | Nothing -- pin the accepted duplication | Locked decision: eager injection + lazy listing coexist |

## Common Pitfalls

### Pitfall 1: Branching the warning on declaration instead of the combined flag
**What goes wrong:** `tools: Read, Skill` + `disallowedTools: Skill` gets the new wording, breaking success criterion 2's byte-identity.
**How to avoid:** One boolean (`declared && !disallowed`) drives BOTH the emitted flag and the wording branch.
**Warning sign:** The new declared-but-disallowed whole-file pin (captured from HEAD before the change) fails.

### Pitfall 2: Editing byte-identity corpus constants
**What goes wrong:** Making a corpus constant "pass" hides a regression; the file header explicitly forbids it.
**How to avoid:** If any of the 7 `EXPECTED_N` constants fails, the implementation is wrong -- none of those inputs declares `Skill`.

### Pitfall 3: Checking disallowedTools via TOOL_MAP
**What goes wrong:** `Skill` has no TOOL_MAP entry, so the existing Pi-name disallow filter never sees it; reusing that path makes `disallowedTools: Skill` a no-op and D-83-01's "otherwise emit false" clause silently fails.
**How to avoid:** Inspect raw Claude-side tokens: `splitCsv(rawDisallowed).includes("Skill")` (exact match, case-sensitive -- consistent with the documented "exact match, like TOOL_MAP lookups" convention).

### Pitfall 4: Non-ASCII bytes or em dashes in new literals
**What goes wrong:** fix-unicode-dashes pre-commit hook rejects em dashes; a literal U+2192 in source breaks the ASCII-source convention (and BSD grep starts treating the file as binary in audits).
**How to avoid:** ` -- ` (space-hyphen-hyphen-space) in warning prose; any arrow in new legend strings as `→` escape. Commit messages ASCII too.

### Pitfall 5: Making `inheritSkills` a required emitter field
**What goes wrong:** Every existing direct `emitGeneratedAgentFile` test call (8+ in frontmatter.test.ts) fails typecheck, forcing edits to pins that must stay untouched.
**How to avoid:** `inheritSkills?: boolean` with `?? false` -- the CONTEXT code-insight already prescribes this.

### Pitfall 6: Emitting anything but lowercase `true`
**What goes wrong:** pi-subagents 0.28.0 compares `frontmatter.inheritSkills === "true"`; `True`/`yes`/`on` silently fall back to the pi-subagents default -- the feature ships broken with green local tests.
**How to avoid:** Pin the exact frontmatter line `inheritSkills: true` in the updated canonical whole-file test.

### Pitfall 7: Breaking the warnings-order pin
**What goes wrong:** Moving the warning push relative to the omitted-tools warning or the skills-slot warnings reorders the provenance `warnings:` line.
**How to avoid:** The new wording must land where the old one did (tools slot). The order pin at convert.test.ts:620 (updated for wording) is the guard.

### Pitfall 8: GSD phase references in comments/test titles
**What goes wrong:** pre-commit/review flags `Phase 83` in code comments.
**How to avoid:** Anchor with `AGSK-05`, `D-83-01`..`D-83-07`, `#86`.

## External Behavior Evidence (all re-verified this session)

| Claim | Evidence | Status |
|-------|----------|--------|
| `inheritSkills: false` -> child spawned with `--no-skills`; `true` -> child loads its normal skill catalog | `~/.pi/agent/npm/node_modules/pi-subagents/src/runs/shared/pi-args.ts` (~line 132): `if (!input.inheritSkills) { args.push("--no-skills"); }` | [VERIFIED: read installed 0.28.0 source] |
| Compatibility floor holds -- 0.28.0 supports the field | Installed pi-subagents version is exactly `0.28.0` (its package.json); the frontmatter parse path exists there | [VERIFIED] |
| Generated frontmatter must say literally `true`/`false` lowercase | `pi-subagents/src/agents/agents.ts:673-677`: `frontmatter.inheritSkills === "true" ? true : === "false" ? false : defaultInheritSkills()` | [VERIFIED] |
| Declared `skills:` remain FULL-CONTENT injected regardless of inheritSkills (D-83-07 basis) | `pi-subagents/src/agents/skills.ts` `buildSkillInjection` (~line 579): `` skills.map((s) => `<skill name="${s.name}">\n${s.content}\n</skill>`) `` | [VERIFIED] |
| Inherited catalog is lazy: name+description+location, read on demand | `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` `formatSkillsForPrompt` (line 257): emits `<available_skills>` with `<name>/<description>/<location>` and "Use the read tool to load a skill's file" | [VERIFIED] |
| With a custom system prompt the catalog is appended only when the read tool is selected | `pi-coding-agent/dist/core/system-prompt.js` (~line 34): `const customPromptHasRead = !selectedTools \|\| selectedTools.includes("read"); if (customPromptHasRead && skills.length > 0) prompt += formatSkillsForPrompt(skills);` | [VERIFIED] |

**Consequence of the last row (edge, not a blocker):** a Skill-declaring agent whose mapped tools exclude `read` (e.g. source `tools: Bash, Skill`) gets `inheritSkills: true` but Pi will not append the catalog to its replace-mode system prompt, and it could not read skill files anyway. D-83-01 locks the mapping rule unconditionally, and the wording is discretion -- see Open Questions.

## State of the Art

Not applicable in the usual sense -- no library or ecosystem choice is open. The relevant "state" is: Phase 82 landed at `e442b483`; 87/87 agents-bridge tests green at HEAD ([VERIFIED: ran `node --test` on the three files this session]); the byte-identity corpus is authoritative for the non-Skill direction.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Skill` detection in `disallowedTools` is exact-match, case-sensitive (`"Skill"`), consistent with the documented TOOL_MAP exact-match convention -- D-83-01 does not specify case handling [ASSUMED] | Recommended Threading Design | Low: a source writing `disallowedTools: skill` (lowercase) would not suppress the flag. No such form observed in the wild; Claude Code tool names are canonically capitalized. Planner may pin the choice with a test comment. |

All other claims in this document are [VERIFIED] against HEAD source, installed pi-subagents 0.28.0, pi-coding-agent dist, or a live test run.

## Open Questions

1. **Legend pointer in the warning when no legend exists**
   - What we know: D-83-04 requires the warning to point at the body legend; the legend is reference-gated (only rendered when the body contains same-plugin skill tokens). A Skill-declaring agent with a token-free body gets the warning but no legend.
   - What's unclear: whether the pointer should be softened for accuracy.
   - Recommendation: phrase the pointer conditionally-true for both cases (e.g. "see the skill legend in the agent body" reads acceptably as "where present", or use "see the skill legend in the agent body when its instructions reference Claude skill names"). Wording is Claude's discretion (D-83-04); pick once, pin with tests. Do NOT make the warning string itself conditional on legend presence -- that would add a third wording branch nothing requires.

2. **Read-tool-less Skill agents** (see External Behavior Evidence consequence)
   - What we know: the flag mapping is locked unconditionally (D-83-01); the catalog silently won't render for agents without `read`.
   - Recommendation: no behavior change (locked). At most, the plan may note it in a code comment at the warning site. Frequency is near zero (agents without Read are rare and already semi-functional).

3. **Test-constant naming for the two warning wordings**
   - What we know: `SKILL_DROP_WARNING` (convert.test.ts:586) currently names the single wording; after Phase 83 there are two pinned wordings.
   - Recommendation: two test-local constants with names describing the branch condition (e.g. `SKILL_DROP_WARNING_NO_INHERIT` / `SKILL_INHERIT_WARNING`); planner's naming discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test` on `.ts` (native strip) | Yes | v26.5.0 | -- |
| npm | `npm run check` | Yes | 11.17.0 | -- |
| pi-subagents source (read-only evidence) | Behavior verification only | Yes | 0.28.0 at `~/.pi/agent/npm/node_modules/pi-subagents/` | Evidence already captured in this doc |
| pi-coding-agent dist (read-only evidence) | Behavior verification only | Yes | `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/` | Evidence already captured in this doc |

No missing dependencies. No network required for any part of this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in), native TS strip under Node 26 |
| Config file | none (glob in package.json scripts) |
| Quick run command | `node --test tests/bridges/agents/convert.test.ts tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert-byte-identity.test.ts` (~0.1s, 87 tests at HEAD) |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + unit + integration) -- NFR-6 gate |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGSK-05 / D-83-01 | declared+allowed -> `inheritSkills: true`; disallowed or absent -> `false` | unit (exact pins) | quick run command above | Extend `tests/bridges/agents/convert.test.ts` |
| AGSK-05 / D-83-02 | `Skill` still in `droppedTools` when flag true | unit | same | Extend convert.test.ts |
| AGSK-05 / D-83-04 | New warning wording exact-equality; old wording for disallowed | unit | same | Extend convert.test.ts |
| AGSK-05 / D-83-05 | Legend third state; two Phase 82 states preserved for non-Skill | unit (byte pins) | same | Extend `frontmatter.test.ts` (render) + convert.test.ts (end-to-end) |
| AGSK-05 / D-83-06 | Non-Skill corpus byte-identical; Skill fixture changes exactly as specified | unit (whole-file `assert.equal`) | same | Corpus exists (unchanged); carve-out pins in convert.test.ts |
| AGSK-05 / D-83-07 | Duplication (eager + lazy) documented | unit (pinning test) | same | Extend convert.test.ts |

### Sampling Rate
- **Per task commit:** quick run command (3 files)
- **Per wave merge:** `npm test` (full unit tree)
- **Phase gate:** `npm run check` green before verification (NFR-6; also run `pre-commit run --files <changed>` before each commit per project policy)

### Wave 0 Gaps
- [ ] Capture the Phase 82 (HEAD) whole-file output of a `Skill`-declared-but-disallowed input as a constant BEFORE any converter change (the D-83-06 disallowed-direction pin -- the only Skill-bearing input class whose bytes must NOT change). Everything else reuses existing infrastructure. Same discipline as 82-01's pre-fix corpus capture.

## Security Domain

`security_enforcement` config absent -- treated as enabled; scope here is minimal because the phase adds no I/O, no network, no new input surface.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes (marginal) | Existing `splitCsv` + exact-match token comparison; no new parsing. The disallowed-token check operates on already-parsed frontmatter strings. |
| V6 Cryptography | no | -- |

### Known Threat Patterns for this change
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Capability expansion: generated child sessions gain read access to the user's installed Pi skill catalog | Elevation of privilege (deliberate) | User-accepted by D-83-03 (Claude analog parity); scoped to agents that explicitly declared `Skill`; install-time opt-out consciously deferred. Provenance warning discloses the capability (D-83-04). No mitigation code needed -- disclosure is the control. |
| Warning-string injection into provenance comment | Tampering | Already mitigated: `formatOptionalProvenanceList` routes warnings through `sanitizeProvenance` (`-->` -> `--&gt;`); the new warning string is a compile-time literal, not user data. |

## Project Constraints (from CLAUDE.md)

Directives that bind this phase's plans:
- `npm run check` must stay green (NFR-6) -- typecheck + ESLint + Prettier + unit + integration.
- TypeScript strict; node:test; no new deps (Jest/Vitest/fs-extra/etc. all rejected project-wide).
- No user-visible output changes outside `ctx.ui.notify` paths (IL-2) -- this phase touches only generated-file bytes and provenance strings carried in existing warning plumbing; no notify changes needed.
- English-only strings (IL-1); no telemetry (IL-4).
- Git: never commit to main; conventional commits (title 5-72 chars, body lines <= 80); `pre-commit run --files <changed>` BEFORE `git commit`; `SKIP=trufflehog` prefix when committing from this worktree (run `pre-commit run trufflehog --all-files` separately to confirm clean); never `--no-verify`, never rebase.
- Commit messages ASCII (fix-unicode-dashes hook rejects em dashes in COMMIT_EDITMSG).
- Comment policy (`.claude/rules/typescript-comments.md`): anchor with AGSK-05 / D-83-NN / #86; never GSD phase/plan/wave references.
- Concurrent-milestone policy: this branch records changes under `[Unreleased]` in CHANGELOG when release PRs are open; no version bumps mid-phase.

## Sources

### Primary (HIGH confidence -- read/executed this session)
- `extensions/pi-claude-marketplace/bridges/agents/convert.ts` @ HEAD `e442b483` -- full read
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` @ HEAD -- full read
- `extensions/pi-claude-marketplace/bridges/agents/types.ts`, `stage.ts` (call site) @ HEAD
- `tests/bridges/agents/convert.test.ts`, `frontmatter.test.ts`, `convert-byte-identity.test.ts` @ HEAD -- full read; executed: 87/87 pass
- `~/.pi/agent/npm/node_modules/pi-subagents/` (installed 0.28.0): `src/runs/shared/pi-args.ts`, `src/agents/agents.ts:665-685`, `src/agents/skills.ts` (`buildSkillInjection`), `package.json`
- `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js` (`formatSkillsForPrompt`), `dist/core/system-prompt.js` (read-tool gating)
- `.planning/workstreams/issue-86-agent-skill-preloads/`: `83-CONTEXT.md`, `82-CONTEXT.md`, `82-04-SUMMARY.md`, `82-PATTERNS.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`

### Secondary (MEDIUM confidence)
- None load-bearing. (No web research needed -- the phase's entire domain is first-party code verified above.)

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Implementation surface (function shapes, seams, pinned strings): HIGH -- read from HEAD, tests executed
- External behavior (pi-subagents/pi semantics): HIGH -- verified in installed floor-version source, not training data
- Recommended threading design: HIGH -- derived directly from locked decisions + HEAD shapes; the only judgment calls (warning-site restructure options, optional-field default) are flagged as such
- Wording candidates: MEDIUM by definition -- explicitly Claude's discretion (D-83-04/D-83-05), planner finalizes and pins

**Research date:** 2026-07-19
**Valid until:** Any commit that touches `bridges/agents/{convert,frontmatter}.ts` or the three test files invalidates the line numbers here; the shapes and pinned strings are stable until Phase 83 itself changes them. Nominal validity: 30 days.
