---
phase: 82-agent-skill-preload-fidelity
reviewed: 2026-07-19T15:32:38Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - tests/bridges/agents/convert-byte-identity.test.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/agents/frontmatter.test.ts
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: fixed
---

# Phase 82: Code Review Report

**Reviewed:** 2026-07-19T15:32:38Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the #86 agent-skill-preload changes: dash-list frontmatter folding
(`applyFrontmatterLine`), plugin-qualified skill mapping (`mapSkills`), the
Skill-drop provenance warning (`mapToolTokens`), and body skill-token
detection plus legend rendering (`detectSkillTokens`,
`renderSkillLegend`). All 83 tests in the three test files pass, and the
byte-identity corpus is a genuinely strong regression guard for the
no-trigger input classes.

Every finding below was reproduced by executing the actual modules, not
inferred from reading. The core defect: the qualified-remainder guard in
`mapSkills` enumerates three of assertSafeName's four throw conditions, so
a skills token like `spec-tree:sub/skill` still throws -- violating the
guard's own stated invariant ("A warn-drop must never become a throw") and
hard-failing the entire plugin agent staging via the uncaught `map` in
`stage.ts`. Two warnings cover whitespace intolerance around the qualifier
colon (silently drops obviously-intended preloads) and a lookbehind
boundary gap for dot-bearing plugin names in the legend scanner.

No structural findings block was provided for this review.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Qualified skill remainder with path separator or control char still throws, aborting the whole plugin install

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:373-384`
**Severity:** BLOCKER

**Issue:** The AGSK-02 guard enumerates specific unsafe remainders:

```ts
if (rest === "" || rest === "." || rest === "..") {
```

but `assertSafeName` (domain/name.ts:23-51) throws on **four** conditions:
empty-after-trim, `.`/`..`, path separators (`/`, `\`), and ASCII control
characters. The last two are unguarded. Verified by execution:

- `skills: spec-tree:sub/skill` -> throws `Name "sub/skill" must not
  contain path separators.`
- `skills: spec-tree:a\tb` -> throws `Name "a\tb" must not contain ASCII
  control characters.`
- Bare tokens are equally exposed: `skills: ..` and `skills: a/b` throw
  through the same `generatedSkillName` call at convert.ts:384.

This violates the guard's own comment ("A warn-drop must never become a
throw") and the tests' stated invariant (convert.test.ts:480-501 pins only
the ""/"."/".." cases). Blast radius: `stage.ts:133-143` maps
`convertAgent` over all discovered agents with no per-agent catch, so one
malformed skills reference in one agent of a third-party plugin hard-fails
the plugin's entire agent staging with a raw `Error`. Mitigating context:
the throw happens before any disk writes (fail-clean, NFR-3 holds), and
the bare-token throw predates this phase -- but the phase's explicit
purpose was to make skill-reference handling soft, and its guard is
provably incomplete against the function it protects.

**Fix:** Stop enumerating assertSafeName's conditions; catch the throw and
warn-drop. This also fixes the pre-existing bare-token path and lets the
`rest === "" || ...` enumeration be deleted:

```ts
let generated: string | null;
try {
  generated = generatedSkillName(pluginName, effective);
} catch {
  generated = null;
}
if (generated !== null && known.has(generated)) {
  emit.push(generated);
} else {
  warnings.push(`unknown skill reference "${token}" -- dropped`);
}
```

Note: `detectSkillTokens` does NOT need the same treatment -- its candidate
class `[A-Za-z0-9_-]+` cannot produce separators, dots, or control chars,
and the `${pluginName}-` empty-elision guard closes the only remaining
throw path (verified). A defensive try/catch there is optional.

### Warnings

#### WR-01: No whitespace tolerance around the qualifier colon -- conventional YAML spacing silently drops the preload

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:363-365`
**Severity:** WARNING

**Issue:** `qualifier` and `rest` are sliced without trimming:

```ts
const qualifier = token.slice(0, colon);
const rest = token.slice(colon + 1);
```

Verified by execution:

- Source `skills:\n  - spec-tree: review-changes` (space after colon --
  the conventional YAML `key: value` spacing a user is likely to type)
  folds verbatim to token `spec-tree: review-changes`; `rest` becomes
  `" review-changes"`, `generatedSkillName` yields
  `"spec-tree- review-changes"` (embedded space), which can never be in
  `knownSkills`. Result: the skill the user obviously intended is silently
  NOT preloaded, with a misleading `unknown skill reference` warning.
- `spec-tree :review-changes` (space before colon) is worse: the qualifier
  `"spec-tree "` fails the `!== pluginName` check and the token is dropped
  with the wrong diagnosis ("qualified with a different plugin").

Related wording nit: a leading-colon typo (`:skill`) yields an empty
qualifier and also gets the "different plugin" message.

**Fix:**

```ts
const qualifier = token.slice(0, colon).trim();
const rest = token.slice(colon + 1).trim();
```

`spec-tree:` (empty rest) still warn-drops correctly after trimming. Add a
test pinning `- spec-tree: review-changes` -> preloaded.

#### WR-02: Legend scanner lookbehind omits `.`, so dotted plugin-name prefixes are mis-attributed

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:144-147`
**Severity:** WARNING

**Issue:** The boundary lookbehind is `(?<![A-Za-z0-9_:-])`, which does not
include `.` -- yet `escapeRegExp`'s own docstring (convert.ts:113-116)
acknowledges plugin names "may legally contain `.`". Verified by
execution: for plugin `spec-tree`, a body containing
`other.spec-tree:review-changes` (a reference to a *different* plugin
named `other.spec-tree`) produces the legend entry:

```
- `spec-tree:review-changes` -> skill `spec-tree-review-changes` (not available in this session)
```

The legend is injected into the child agent's prompt, so a spurious entry
actively misinforms the agent. The code comment covers `.`-exclusion in
the *candidate* class but the same reasoning was not applied to the
boundary class; the hyphen case (`other-spec-tree:x`) is handled and
tested, the dot case is not. Likelihood is low (requires overlapping
plugin names with a dot boundary), but it is a provable hole in a boundary
check this phase designed and tested.

**Fix:** Add `.` to the lookbehind class:

```ts
`(?<![A-Za-z0-9_.:-])${escapeRegExp(pluginName)}:([A-Za-z0-9_-]+)`
```

and add a test mirroring the existing `other-spec-tree:` lookbehind pin
(convert.test.ts:658-664) with `other.spec-tree:`.

### Info

#### IN-01: Duplicate `Skill` tokens duplicate the D-82-09 warning in provenance

**File:** `extensions/pi-claude-marketplace/bridges/agents/convert.ts:225-236`
**Issue:** `mapToolTokens` pushes the Skill-drop warning per occurrence.
Verified: `tools: Skill, Skill, Read` yields the identical sentence twice
in the provenance `warnings:` line (and `droppedTools: Skill, Skill` --
the dropped duplication is pre-existing shape).
**Fix:** Gate the push on first occurrence, e.g.
`if (token === "Skill" && !warnings.includes(SKILL_DROP_WARNING))` or
track a boolean.

#### IN-02: `__proto__` frontmatter key silently vanishes; fold path reads inherited prototype members

**File:** `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts:104,146-148,165`
**Issue:** `raw` is a default-prototype object. `raw["__proto__"] = value`
with a string RHS is a silent no-op, so a `__proto__:` frontmatter key
never appears in `Object.keys(raw)` and is therefore never recorded in
`droppedFields` (verified: keys are `["name","color"]` for a source
containing `__proto__: evil`). The new fold read
`raw[state.lastKey] ?? ""` also reaches inherited `Object.prototype`
members for that key (verified: it reads an object, not a string). No
prototype pollution is possible (values are always strings) and the
computed garbage is discarded by the same no-op assignment, so this is
hardening, not an active bug.
**Fix:** Build `raw` as `Object.create(null)` (adjust the
`ParsedFrontmatter` return) or use a `Map` internally and convert at the
boundary.

#### IN-03: `(T-82-12)` comment violates the TypeScript comment policy

**File:** `tests/bridges/agents/convert.test.ts:710`
**Issue:** The comment `a body scan never throws (T-82-12)` cites a
phase-plan test-matrix row. Per `.claude/rules/typescript-comments.md`,
allowed anchors are decision/requirement IDs (D-82-xx, AGSK-NN, SC-N,
#86 -- all used correctly elsewhere in these files); phase-qualified
planning-artifact row IDs like `T-82-12` are the class the policy
forbids ("phrasing whose only purpose is to record which planning
artefact authored the line").
**Fix:** Drop the parenthetical; the surrounding sentence already carries
the invariant.

## Fixes Applied

Fixed 2026-07-19. `npm run check` green after each commit; byte-identity
corpus (7 tests) untouched and passing throughout.

- **CR-01** -- `bf62c77b` fix(agents): warn-drop unsafe skill tokens
  instead of throwing. Catch-based guard around `generatedSkillName`
  replaces the `""`/`"."`/`".."` enumeration; covers qualified remainders
  AND bare tokens. Regression tests pin separator, control-char, and
  bare-token inputs.
- **WR-01** -- `fade105c` fix(agents): trim whitespace around skill
  qualifier colon. Both colon slices trimmed; test pins
  `spec-tree: review-changes` and `spec-tree :review-changes` to the
  preloaded outcome.
- **WR-02** -- `fb158171` fix(agents): add dot to legend scanner
  lookbehind boundary. `.` added to the boundary class; test pins
  `other.spec-tree:` producing no legend.
- **IN-03** -- `8f5fcb3d` test(agents): drop planning-artifact reference
  from comment. `(T-82-12)` parenthetical removed; sweep found no other
  T-82-NN references.

Not fixed (left as documented observations per fix scope): IN-01
(duplicate Skill-token warning), IN-02 (`__proto__` frontmatter
hardening).

---

_Reviewed: 2026-07-19T15:32:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
