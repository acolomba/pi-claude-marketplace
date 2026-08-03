---
phase: 93-substitution-completion
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/convert.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/types.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/shared/vars.ts
  - tests/bridges/agents/convert.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/shared/vars.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 93: Code Review Report

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 93 extends `substituteClaudeVars` from a two-variable, two-pass literal
`replaceAll` chain to a four-variable single-pass alternation replace, and threads
scope-gated `${CLAUDE_PROJECT_DIR}` (via `cwd`) plus skill-scoped
`${CLAUDE_SKILL_DIR}` (via `targetDir`) into the skills/commands/agents bridges
and the install/reinstall/update orchestrators.

The core substitution primitive is correct and the binding prohibitions from the
plan all hold under inspection:

- **Single-pass no-reexpansion:** the alternation replacer walks `content` once;
  `value ?? matched` returns the literal on an absent field. A value that embeds a
  `${CLAUDE_*}` literal cannot be re-folded within a pass. Verified against
  `tests/shared/vars.test.ts` (T-03-01 cases) and the byte-identity test.
- **Absent field -> literal, never empty string:** `undefined ?? matched` yields
  the matched literal. Confirmed for both `skillDir` and `projectDir`.
- **Scope gate:** all three surfaces gate `projectDir` on
  `locations.scope === "project" ? cwd : undefined`, so user-scope
  `${CLAUDE_PROJECT_DIR}` is never substituted (bridge unit tests + install e2e
  both cover this).
- **`${CLAUDE_SKILL_DIR}` stays literal in commands/agents:** neither surface
  supplies `skillDir`; the pass-through leaves the token literal
  (`tests/bridges/commands/stage.test.ts`, `tests/bridges/agents/convert.test.ts`).
- **Cascade preserved:** `updateSinglePlugin` threads no new flag; `cwd` defaults
  to `process.cwd()` and flows to the same scope gate. No regression in the
  autoupdate path.
- **All nine call sites threaded:** install (3 phases), reinstall
  (`prepareAllHandles`, 3), update (`prepareUpdateHandles`, 3) all pass `cwd`;
  a repo-wide grep confirms these are the only `prepareStage*` callers.

No correctness, security, or data-loss defects were found. The `replaceAll`
regex carries the required `/g` flag, is module-level and stateless across
synchronous calls, and performs pure string replacement (no eval, no ReDoS
surface). Comments use only allowed traceability anchors (SUB-01/02, D-08, PI-10,
NFR-10, T-03-*); no forbidden phase/plan/pitfall tokens were introduced.

The findings below are a test-coverage gap and two low-severity robustness notes.

## Warnings

### WR-01: reinstall and update orchestrators thread `cwd` by hand with no end-to-end SUB-02 guard

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1508` and `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1148,1159,1174`
**Issue:** The install orchestrator's new tests explicitly document the risk they
close: *"the orchestrator threads `cwd` into every stage input by hand (optional
field a compiler cannot enforce)"* — an omitted `cwd` silently degrades
`${CLAUDE_PROJECT_DIR}` to a literal with no compile error. The same hand-threaded,
compiler-unenforced pattern exists in `reinstall.ts::prepareAllHandles` and
`update.ts::prepareUpdateHandles`, but only `install.ts` gained an end-to-end
SUB-02 test. A grep of `tests/orchestrators/plugin/reinstall.test.ts` and
`tests/orchestrators/plugin/update.test.ts` finds zero references to `SUB-02`,
`projectDir`, or `CLAUDE_PROJECT_DIR`. A future refactor that drops the `cwd`
line from either path (both `cwd?` bridge fields are optional) would compile,
pass the existing suite, and silently ship un-substituted project dirs on the
reinstall/update paths.
**Fix:** Add an end-to-end SUB-02 assertion for the reinstall and update
orchestrators mirroring the install test — install a project-scope fixture whose
skill/command/agent bodies carry `${CLAUDE_PROJECT_DIR}`, run reinstall (and
update to a new version), and assert the materialized files substitute `cwd`.
Alternatively, tighten the risk at the type level by making `cwd` required on the
three `Stage*Input` interfaces (bridges default the scope gate to pass-through
when scope !== project), so the compiler enforces threading.

## Info

### IN-01: description cap is applied pre-substitution, so an expanded `${CLAUDE_*}` token can push the emitted skill description past 1,536 code units

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:169-172`
**Issue:** `augmentSkillDescription` runs `truncate1536(folded)` on the *authored*
text and then substitutes vars, so the final scalar length is
`1536 - len("${CLAUDE_SKILL_DIR}") + len(targetDir)` when a token sits inside the
capped window — which can exceed the WTU-02 budget. This ordering is intentional
and pre-existing for `pluginRoot`/`pluginData` (the comment notes it matches the
prior whole-file ordering), but Phase 93 widens the reachable expansions to
`skillDir` (a full absolute target path) and `projectDir`, making an over-cap
description more likely for a skill whose description references those tokens near
the cap boundary. The WTU-02 tests use token-free `a`/`b` fillers, so this path is
unexercised.
**Fix:** Low priority. If the 1,536 ceiling is meant to bound the *emitted* bytes
(not just authored bytes), apply a second `truncate1536` after substitution; if
it is meant to bound authored text only (per D-86-05), no change is needed — add
a test with a token-bearing description near the cap to pin whichever semantics is
intended.

### IN-02: `name` replacer parameter is type-asserted without a runtime guard

**File:** `extensions/pi-claude-marketplace/shared/vars.ts:63-65`
**Issue:** The replacer types its capture-group argument as
`name: keyof typeof TOKEN_TO_FIELD` and indexes `TOKEN_TO_FIELD[name]` directly.
The assertion is sound today because `CLAUDE_VAR_PATTERN`'s alternation can only
capture the four mapped names, but the regex and the `TOKEN_TO_FIELD` map are two
separate literals that must be kept in lockstep by hand (the comment acknowledges
this). If a fifth token were added to the regex alternation but not the map,
`TOKEN_TO_FIELD[name]` would be `undefined`, `vars[undefined]` would be
`undefined`, and the token would silently pass through as a literal rather than
failing loudly.
**Fix:** Low priority. Derive `CLAUDE_VAR_PATTERN` from `Object.keys(TOKEN_TO_FIELD)`
(join with `|`) so the pattern and the map cannot drift, eliminating the manual
lockstep requirement and the type assertion.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
