---
phase: 93-substitution-completion
reviewed: 2026-08-03T00:00:00Z
depth: standard
files_reviewed: 17
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
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/vars.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: issues_found
---

# Phase 93: Code Review Report

**Reviewed:** 2026-08-03
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found (info-only)

## Summary

Iteration 2 re-review of Phase 93 (SUB-01/SUB-02 four-variable
`substituteClaudeVars`). The prior review's one WARNING (WR-01 -- reinstall/update
lacked end-to-end SUB-02 `projectDir` tests) is **verified closed** by commit
9e0fbc00.

Verification performed:
- Read the two new test blocks. `tests/orchestrators/plugin/reinstall.test.ts`
  (project-scope + user-scope) and `tests/orchestrators/plugin/update.test.ts`
  (project-scope) assert substitution against the **materialized target files**
  (`skillsTargetDir/<name>/SKILL.md`, `promptsTargetDir/<name>.md`,
  `agentsDir/<name>.md`) -- not just the bridge return value. They assert both
  arms of the contract: project scope substitutes `${CLAUDE_PROJECT_DIR}` to the
  install cwd and leaves no residual token, while `${CLAUDE_SKILL_DIR}` stays
  literal in command/agent output (skill-scoped). The user-scope reinstall case
  pins the scope gate keeping `${CLAUDE_PROJECT_DIR}` literal.
- Ran the three SUB-02 tests directly: all pass (`# pass 3 # fail 0`).

Scope-gating is correct and single-sourced: the `locations.scope === "project"
? cwd : undefined` gate lives in each bridge (`bridges/skills/stage.ts:256`,
`bridges/commands/stage.ts:247`, `bridges/agents/stage.ts:115`); the three
orchestrators thread `cwd` unconditionally and the bridge decides. Skills feed
`skillDir` + gated `projectDir`; commands/agents feed gated `projectDir` only, so
`${CLAUDE_SKILL_DIR}` correctly stays literal there. `substituteClaudeVars`
(`shared/vars.ts`) is a single-pass replacer -- an absent field passes the token
through literally (never empty string), and an injected value is never
re-scanned. Comment-policy scan found no phase/plan/pitfall/milestone tokens in
the changed source or tests.

No BLOCKER or WARNING defects found. The fix broke nothing. Three carried/new
INFO items remain.

## Info

### IN-01: Skill `description` 1,536-code-unit cap is applied pre-substitution

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:169-172`
**Issue:** In `augmentSkillDescription`, `truncate1536` is applied to `folded`
**before** `substituteClaudeVars`:
```ts
const effective = substituteClaudeVars(
  truncate1536(folded === "" ? MISSING_DESCRIPTION_PLACEHOLDER : folded),
  vars,
);
```
A `description` that embeds `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}` and
sits near the cap can exceed 1,536 code units **after** the token expands to a
long absolute path, so the emitted double-quoted scalar can be longer than the
WTU-02 budget nominally guarantees. The inline comment documents this as
intentional ("the WTU-02 listing budget measures the authored text"), and the
PARSE-02 re-parse still guards Pi-acceptability, so this is a low-severity
spec-vs-implementation nuance rather than a defect. Carried forward from
iteration 1 (still true).
**Fix:** If the cap must hold on the *rendered* description, apply
`truncate1536` **after** substitution (accepting the Windows-backslash escaping
tradeoff the current comment calls out), or amend the WTU-02 contract text to
state the cap measures authored (pre-substitution) length. Otherwise leave as-is
and treat this as documented behavior.

### IN-02: `TOKEN_TO_FIELD` map and `CLAUDE_VAR_PATTERN` regex are kept in manual lockstep

**File:** `extensions/pi-claude-marketplace/shared/vars.ts:35-43`
**Issue:** The substitutable-token set is declared twice: once as the
`TOKEN_TO_FIELD` object keys and once as the hand-written alternation in
`CLAUDE_VAR_PATTERN`. The `satisfies Record<string, keyof ClaudePluginVars>`
constrains the map's *values*, and the replacer types `name: keyof typeof
TOKEN_TO_FIELD`, but nothing ties the regex alternation to the map keys. Adding a
fifth token to only one of the two drifts silently: a map-only addition never
matches (no substitution); a regex-only addition makes the `name` type assertion
a lie and yields `TOKEN_TO_FIELD[name] === undefined` -> `vars[undefined]` ->
pass-through literal. Both degrade quietly rather than failing loudly. Carried
forward from iteration 1 (still true).
**Fix:** Derive the pattern from the map keys, e.g.
`new RegExp(String.raw`\$\{(${Object.keys(TOKEN_TO_FIELD).join("|")})\}`, "g")`,
so the token set has a single source of truth. Optional cleanup; behavior is
correct today.

### IN-03: `update.ts` SUB-02 coverage lacks a user-scope case (asymmetric with reinstall)

**File:** `tests/orchestrators/plugin/update.test.ts:4402`
**Issue:** The fix added a project-scope **and** a user-scope SUB-02 test to
`reinstall.test.ts` but only a project-scope test to `update.test.ts` (the commit
message acknowledges this). The user-scope "keep `${CLAUDE_PROJECT_DIR}` literal"
path on the update orchestrator is therefore not exercised end-to-end. Risk is
low: the literal-when-undefined behavior is decided by the shared bridge gate
(`locations.scope === "project" ? cwd : undefined`), which is covered by the
reinstall user-scope test and the `shared/vars.test.ts` absent-`projectDir`
assertions; the WR-01 threading concern (a dropped `cwd` line) is guarded by the
existing project-scope update test.
**Fix:** For parity and defense-in-depth, add a user-scope variant of the
`update.test.ts` SUB-02 test mirroring the reinstall user-scope case.

---

_Reviewed: 2026-08-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
