---
phase: 83-skill-tool-inherit-mapping
reviewed: 2026-07-19T17:41:33Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/frontmatter.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 83: Code Review Report

**Reviewed:** 2026-07-19T17:41:33Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Reviewed the AGSK-05 phase diff (`f14cd717..HEAD`) in the context of the full
files: the `inheritSkills` computation in `mapTools`, the branched Skill-drop
warning, the optional `inheritSkills` frontmatter field with conditional
emission, and the third "(available on demand)" legend state. The full test
suite passes (2974 pass, 0 fail).

The core AGSK-05 / D-83-01 logic is correct: the inherit flag is computed from
raw Claude-side tokens (necessarily, since `Skill` has no `TOOL_MAP` entry and
never survives into the Pi-name filter), the omitted-tools default cannot flip
it, disallow wins over declare, and the emitter's `?? false` default preserves
the pre-phase layout for callers that omit the field. Byte identity was
verified by differential execution against a reconstructed pre-phase module:
non-Skill agents and single-Skill-disallowed agents produce byte-identical
output.

Two proven defects were found. First, the phase's own byte-identity contract
(D-83-06) breaks for the degenerate input class of a *duplicated* `Skill`
token: the warning-push moved from per-occurrence (inside the old
`mapToolTokens` loop) to per-agent (`if (skillDeclared)`), so a
declares-and-disallows agent with `tools: Read, Skill, Skill` now emits one
warning where the pre-phase converter emitted two -- different provenance
bytes. Second, a pre-existing (not phase-introduced) parser bug in
`parseFrontmatter`: the closing-delimiter regex matches `---` as a line
*prefix*, so a frontmatter line beginning with `---` silently truncates the
frontmatter and leaks its tail into the body. Both were confirmed with
executable reproductions.

## Warnings

### WR-01: D-83-06 byte-identity contract breaks for duplicated `Skill` tokens

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:278-284`
**Issue:** The phase contract requires byte-identical output for all agents
that do not declare Skill or that disallow it. Pre-phase, the Skill-drop
warning was pushed inside the `mapToolTokens` loop -- once **per occurrence**
of the `Skill` token. Post-phase, it is pushed once per agent behind
`if (skillDeclared)`. For a source agent with a duplicated token, e.g.
`tools: Bash, Read, Skill, Skill` + `disallowedTools: Skill` (an agent in the
must-stay-identical class), the pre-phase converter emitted the D-82-09
warning **twice** in the provenance `warnings:` line; the post-phase converter
emits it once. Confirmed by differential execution of the reconstructed
`f14cd717` module vs HEAD: `byte-identical=false` for both the CSV and the
inline-array duplicate-Skill forms; `droppedTools` still records `Skill`
twice in both versions, so the provenance block is now internally
inconsistent (two drop records, one explanation). The D-83-06 pin test
(`convert.test.ts:664`) only covers the single-Skill-token case, so this
regression is invisible to the suite.
**Fix:** Either restore per-occurrence semantics (faithful to the pin):
```ts
// AGSK-03 / AGSK-05: warn once per Skill occurrence, preserving pre-phase
// provenance bytes for duplicate-token sources (D-83-06).
for (const token of tokens) {
  if (token === "Skill") {
    warnings.push(inheritSkills ? SKILL_INHERIT_WORDING : SKILL_NO_INHERIT_WORDING);
  }
}
```
or, if warning dedup is the intended behavior, record that as an explicit
D-83-06 exception and add a pin test for the duplicate-Skill-disallowed input
class so the deviation is a documented decision rather than an accident.
Consider also covering `disallowedTools: ["Skill"]` (inline-array form) in the
inherit-flag tests -- it works today only because `splitCsv` is shared, and
nothing pins it.

### WR-02: `parseFrontmatter` closing-delimiter regex matches `---` as a line prefix (pre-existing)

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:95`
**Issue:** `const closeMatch = /\n---\r?\n?/.exec(afterOpen);` has both
trailing atoms optional, so it matches `\n---` anywhere -- including as a
prefix of a longer line. Any frontmatter line that merely *starts with* `---`
(a `----` divider, `--- note`, a stray YAML document separator) silently
terminates the frontmatter early. Reproduced against HEAD:
```
---
name: bot
---- internal divider
tools: Read
---

Body.
```
parses to `raw = {"name":"bot"}` and
`body = "- internal divider\ntools: Read\n---\n\nBody.\n"`. Consequences: the
agent's real `tools:` line is silently dropped (the converter then substitutes
the read,bash,edit default and emits a misleading "source agent omitted
`tools:`" warning), a `Skill` declaration on such a line would silently lose
skill inheritance, and frontmatter residue leaks into the generated body. The
comment on line 94 ("Find the closing `---` on its own line") describes the
intent; the regex does not implement it. Pre-existing behavior (unchanged in
this phase's diff), but this phase's inherit flag now also depends on this
parse path.
**Fix:**
```ts
const closeMatch = /\n---(?:\r?\n|$)/.exec(afterOpen);
```
This still accepts `\n---\n`, `\n---\r\n`, and a bare `---` at EOF, but
rejects prefix matches. All existing parser tests pass under this form by
inspection; add a regression test for a frontmatter line starting with `---`.

## Info

### IN-01: `mapTools` duplicates the 4-field result construction across two return sites

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:297-312`
**Issue:** The disallow branch and the fall-through branch each construct the
full `ToolMappingResult` literal. This phase had to remember to add
`inheritSkills` to both -- exactly the drift risk duplicated construction
invites; a future field added to only one branch would type-check if optional.
**Fix:** Build the result once, varying only `mapped`:
```ts
const finalMapped =
  disallowedPi.size > 0 ? mapped.filter((name) => !disallowedPi.has(name)) : mapped;
return { mapped: dedupePreservingOrder(finalMapped), dropped, warnings, inheritSkills };
```

### IN-02: D-83-06 byte-pin fixture mixes `spec-tree` plugin with an `acme` generated name

**File:** `tests/bridges/agents/convert.test.ts:642-662`
**Issue:** `DISALLOWED_SKILL_EXPECTED` pins `name: pi-claude-marketplace-acme-bot`
alongside `plugin: spec-tree` because `convertSpecTree` passes
`pluginName: "spec-tree"` while `makeDiscovered`'s default `generatedName`
still uses the `acme` prefix. Harmless at runtime (the converter takes
`generatedName` verbatim from `discovered`), but the pinned file is internally
inconsistent with the real naming contract
(`pi-claude-marketplace-<plugin>-<agent>`), which is confusing for anyone
using the pin as a reference artifact.
**Fix:** Pass `generatedName: "pi-claude-marketplace-spec-tree-bot"` through
`makeDiscovered` in the `convertSpecTree` helper and update the pins, or note
the mismatch in the fixture comment.

### IN-03: Opening-delimiter comment claims bare `---` at EOF is accepted, but the regex requires a newline

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:87-88`
**Issue:** The comment says "Accept `---\n` or `---\r\n` and also a bare `---`
followed by EOF," but `/^---\r?\n/` rejects a file that is exactly `---`
(no trailing newline); such a file is treated as all-body. Behavioral impact
is nil (there is no frontmatter to lose either way), but the comment
misdescribes the code -- only the *closing* delimiter accepts the bare-EOF
form.
**Fix:** Correct the comment (the bare-EOF acceptance applies to the closing
delimiter only), or use `/^---\r?\n/` -> `/^---(?:\r?\n|$)/` if the documented
behavior is the intended one.

---

_Reviewed: 2026-07-19T17:41:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
