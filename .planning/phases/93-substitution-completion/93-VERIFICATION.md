---
phase: 93-substitution-completion
verified: 2026-08-03T00:00:00Z
status: passed
score: 3/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 93: Substitution completion Verification Report

**Phase Goal:** The static `${...}` substitution set that the model reads in
materialized skill/command/agent content is completed — `${CLAUDE_SKILL_DIR}`
resolves to a skill's installed directory, and `${CLAUDE_PROJECT_DIR}`
resolves for project-scope installs (passing through untouched for
user-scope, documented). Extends `shared/vars.ts::substituteClaudeVars`
(previously only `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}`) and its
four call sites across the three bridges — skills stage ×2 (description
augmentation and whole-file), commands stage, agents convert.

**Verified:** 2026-08-03
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `${CLAUDE_SKILL_DIR}` in a skill's content is replaced at stage time with the skill's installed directory (SUB-01) | VERIFIED | `bridges/skills/stage.ts` builds `skillVars.skillDir = path.join(locations.skillsTargetDir, skill.generatedName)` (the same `assertPathInside`-guarded `targetDir`) and feeds it to both `augmentSkillDescription` and the whole-file `substituteClaudeVars` call. `tests/bridges/skills/stage.test.ts` — `"SUB-01/SUB-02 project-scope skill substitutes all four \${CLAUDE_*} tokens"` — asserts the staged file resolves `${CLAUDE_SKILL_DIR}` to the target dir. Test run: PASS. |
| 2 | `${CLAUDE_PROJECT_DIR}` in a project-scope skill/command/agent is replaced at stage time with the project root (SUB-02) | VERIFIED | Scope-gated `projectDir = locations.scope === "project" ? cwd : undefined` present at all three bridge call sites (`bridges/skills/stage.ts`, `bridges/commands/stage.ts`, `bridges/agents/convert.ts` via `bridges/agents/stage.ts`'s single scope+cwd meeting point). `cwd` is threaded from all 9 orchestrator call sites (`install.ts`: `c.cwd`; `reinstall.ts`: `input.cwd`; `update.ts`: `args.cwd`/`cwd`) — confirmed by direct file read of each of the 9 sites. End-to-end proof: `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`, `tests/orchestrators/plugin/update.test.ts` each contain a `"SUB-02: project-scope ... substitutes \${CLAUDE_PROJECT_DIR} to the install cwd ..."` test that installs/reinstalls/updates a project-scope fixture and asserts the materialized skill/command/agent files carry the cwd. All ran and PASS. |
| 3 | A user-scope occurrence of `${CLAUDE_PROJECT_DIR}` passes through untouched (documented divergence), and the already-substituted `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` remain correctly substituted (SUB-02) | VERIFIED | `substituteClaudeVars`'s replacer returns `value ?? matched` — an `undefined` projectDir (user scope) yields the literal token, never an empty string. User-scope companion tests exist and pass in all three bridge test files plus the three orchestrator test files (`"SUB-02 user-scope ... keeps \${CLAUDE_PROJECT_DIR} literal; other ... substitute"` / `"SUB-02: user-scope reinstall keeps ..."`). `93-CONTEXT.md` documents the divergence rationale (Pi materializes once at install; Claude Code substitutes at invoke time). Divergence is also documented in `shared/vars.ts`'s module JSDoc. |

**Score:** 3/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/vars.ts` | Extended `ClaudePluginVars` (4 fields) + single-pass `substituteClaudeVars` | VERIFIED | `ClaudePluginVars` has `pluginRoot`, `pluginData` (required) + `skillDir?`, `projectDir?` (optional, `string \| undefined`). `substituteClaudeVars` is a single `content.replaceAll(CLAUDE_VAR_PATTERN, replacer)` over a 4-token alternation regex; replacer returns `value ?? matched`. |
| `bridges/skills/stage.ts` | Both call sites pass skillDir + scope-gated projectDir | VERIFIED | `skillVars` object built once per skill-loop iteration with `skillDir: targetDir, projectDir: locations.scope === "project" ? cwd : undefined`; passed to `augmentSkillDescription(...)` and the whole-file `substituteClaudeVars(content, skillVars)`. |
| `bridges/skills/types.ts` | `StageSkillsInput.cwd` | VERIFIED | `readonly cwd?: string` present with doc comment. |
| `bridges/commands/stage.ts` | projectDir at the substitute call, no skillDir | VERIFIED | `substituteClaudeVars(content, { pluginRoot, pluginData: pluginDataDir, projectDir: locations.scope === "project" ? cwd : undefined })` — no `skillDir` key. |
| `bridges/commands/types.ts` | `StageCommandsInput.cwd` | VERIFIED | `readonly cwd?: string` present. |
| `bridges/agents/convert.ts` | projectDir consumed at the substitute call | VERIFIED | `convertAgent` input gains `projectDir?: string \| undefined`, destructured, fed to `substituteClaudeVars(body, { pluginRoot, pluginData: pluginDataDir, projectDir })` — no `skillDir`. |
| `bridges/agents/stage.ts` | Computes scope-gated projectDir, threads into convertAgent | VERIFIED | `const projectDir = locations.scope === "project" ? cwd : undefined;` computed once, passed into each `convertAgent({...})` call. |
| `bridges/agents/types.ts` | `StageAgentsInput.cwd` | VERIFIED | `readonly cwd?: string` present. |
| `orchestrators/plugin/install.ts` | cwd threaded at skills/commands/agents stage inputs | VERIFIED | `cwd: c.cwd` present at all 3 `prepareStage*` call sites (lines ~897, ~938, ~976 confirmed by direct read). |
| `orchestrators/plugin/reinstall.ts` | cwd threaded at skills/commands/agents stage inputs | VERIFIED | `cwd: input.cwd` present at all 3 `prepareStage*` call sites. |
| `orchestrators/plugin/update.ts` | cwd threaded at skills/commands/agents stage inputs | VERIFIED | `cwd` present at all 3 `prepareStage*` call sites. |
| `tests/shared/vars.test.ts` | Helper-contract assertions | VERIFIED | 4-token substitution, absent-field pass-through (both skillDir and projectDir), unknown-token pass-through, no-re-expansion (T-03-01), byte-identity — all present and passing. |
| `tests/bridges/skills/stage.test.ts` | End-to-end skills substitution assertions | VERIFIED | Project-scope 4-token test + user-scope literal-projectDir test present and passing. |
| `tests/bridges/commands/stage.test.ts` | Commands scope-arm tests | VERIFIED | Project-scope projectDir test + user-scope literal test + skillDir-literal-in-both-scopes assertion, all passing. |
| `tests/bridges/agents/convert.test.ts` | Agents projectDir present/absent tests | VERIFIED | Both arms present and passing; skillDir literal assertion included. |
| `tests/orchestrators/plugin/install.test.ts` | End-to-end delivery assertion | VERIFIED | Project-scope + user-scope e2e tests present and passing. |
| `tests/orchestrators/plugin/reinstall.test.ts` | End-to-end delivery assertion (review-fix WR-01) | VERIFIED | Added in review-fix commit `9e0fbc00`; project-scope + user-scope e2e tests present and passing. |
| `tests/orchestrators/plugin/update.test.ts` | End-to-end delivery assertion (review-fix WR-01) | VERIFIED | Added in review-fix commit `9e0fbc00`; project-scope e2e test present and passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `bridges/skills/stage.ts` skill loop | `shared/vars.ts::substituteClaudeVars` | `skillVars` object (skillDir + scope-gated projectDir) passed to both call sites | WIRED | Confirmed by direct read; single object built and reused for both `augmentSkillDescription` and whole-file substitution. |
| `bridges/commands/stage.ts` | `shared/vars.ts::substituteClaudeVars` | inline vars object with scope-gated projectDir, no skillDir | WIRED | Confirmed by direct read. |
| `bridges/agents/stage.ts` | `bridges/agents/convert.ts::convertAgent` | `projectDir` computed once, threaded per convertAgent call | WIRED | Confirmed by direct read — sole scope+cwd meeting point per plan design. |
| `orchestrators/plugin/install.ts` (3 sites) | `prepareStageSkills` / `prepareStageCommands` / `prepareStagePluginAgents` | `cwd: c.cwd` | WIRED | Confirmed by direct read at all 3 sites. |
| `orchestrators/plugin/reinstall.ts` (3 sites) | same three bridges | `cwd: input.cwd` | WIRED | Confirmed by direct read at all 3 sites. |
| `orchestrators/plugin/update.ts` (3 sites) | same three bridges | `cwd` | WIRED | Confirmed by direct read at all 3 sites. |

All 9 orchestrator → bridge threading sites (3 bridges × 3 orchestrators) are wired — this closes the review's WR-01 concern (reinstall/update had no e2e guard at initial review; the review-fix commit `9e0fbc00` added end-to-end SUB-02 tests for both, now present and passing).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Helper contract (4-token sub, pass-through, no re-expansion) | `node --test tests/shared/vars.test.ts` | 234 combined pass (see below), 0 fail | PASS |
| Skills bridge end-to-end (both scope arms) | `node --test tests/bridges/skills/stage.test.ts` (run together with the set below) | pass | PASS |
| Commands bridge end-to-end (both scope arms) | `node --test tests/bridges/commands/stage.test.ts` | pass | PASS |
| Agents convert end-to-end (projectDir present/absent) | `node --test tests/bridges/agents/convert.test.ts` | pass | PASS |
| Install orchestrator e2e delivery | `node --test tests/orchestrators/plugin/install.test.ts` | pass | PASS |
| Reinstall orchestrator e2e delivery (review-fix) | `node --test tests/orchestrators/plugin/reinstall.test.ts` | 148 combined pass with update.test.ts, 0 fail | PASS |
| Update orchestrator e2e delivery (review-fix) | `node --test tests/orchestrators/plugin/update.test.ts` | pass | PASS |
| Typecheck | `npm run typecheck` | clean, no errors | PASS |
| Lint | `npm run lint` | exit 0, no errors | PASS |

Ran directly by the verifier (not taken from SUMMARY.md claims):
- `node --test tests/shared/vars.test.ts tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/agents/convert.test.ts tests/orchestrators/plugin/install.test.ts` → 234 pass, 0 fail.
- `node --test tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update.test.ts` → 148 pass, 0 fail.
- `npm run typecheck` → exit 0, no output (clean).
- `npm run lint` → exit 0, no output (clean).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SUB-01 | 93-01 | `${CLAUDE_SKILL_DIR}` resolves at stage time to the skill's installed directory | SATISFIED | `bridges/skills/stage.ts` skillDir wiring + passing `tests/bridges/skills/stage.test.ts` and `tests/shared/vars.test.ts` assertions. |
| SUB-02 | 93-01 (skills arm), 93-02 (commands/agents arm + orchestrator threading) | `${CLAUDE_PROJECT_DIR}` resolves in project-scope skills/commands/agents to the project root; user-scope passes through untouched | SATISFIED | All three bridges + all nine orchestrator threading sites confirmed by direct read; e2e tests across install/reinstall/update all pass. |

No orphaned requirements: REQUIREMENTS.md maps only SUB-01 and SUB-02 to Phase 93, and both are claimed in the 93-01/93-02 PLAN frontmatter `requirements:` fields. (Note: REQUIREMENTS.md checkboxes for SUB-01/SUB-02 are still unchecked `[ ]` and the traceability table still shows "Pending" — this is a documentation bookkeeping gap, not a code gap; it does not affect goal achievement since the checkbox update is typically done at milestone-close, not phase-verify. Flagged for the developer's awareness, not blocking.)

### Anti-Patterns Found

Scanned all 11 source files (excluding tests) modified across both plans for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, hardcoded empty stubs, and console.log-only implementations.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `bridges/skills/stage.ts` | 131 | `MISSING_DESCRIPTION_PLACEHOLDER` constant name | none | Pre-existing named constant (a fallback description string), not an incomplete-implementation marker. Not flagged. |
| `orchestrators/plugin/*.ts` | various | `Phase 2`/`Phase 3a`/`Phase 3b` comments | none | Domain concept (two-phase commit / phase-ledger transaction narration), explicitly whitelisted by `.claude/rules/typescript-comments.md`'s own example. Not a GSD planning-step reference. |

No blocking debt markers found in any of the 11 modified source files. Comment policy compliance spot-checked: all `SUB-01`/`SUB-02`/`T-03-01` traceability anchors are requirement/finding IDs (allowed); no `Phase 93`/`Plan 01`/`Plan 02`/`Wave N` planning references found in source comments.

### Code Review State

`93-REVIEW.iter2.md` (re-review after fix): 0 critical, 1 warning (WR-01), 2 info.
`93-REVIEW-FIX.iter2.md`: WR-01 fixed (commit `9e0fbc00`, adds reinstall/update e2e SUB-02 tests); 2 info findings explicitly deferred as out-of-scope (low-priority, non-blocking, documented rationale in each). Verifier independently confirmed the WR-01 fix by reading `reinstall.test.ts`/`update.test.ts` and running both files — both new e2e tests are present and pass.

### Human Verification Required

None. All observable truths are provable by static content substitution in materialized files, fully assertable in automated tests (per the phase's own `93-VALIDATION.md`: "All phase behaviors have automated verification").

### Gaps Summary

No gaps. All three success criteria are verified against the codebase (not just SUMMARY claims): the shared helper is correctly extended, all four call sites (skills ×2, commands, agents) feed the right scope-gated values, all nine orchestrator threading sites pass `cwd`, and both scope arms (project-scope substitutes, user-scope stays literal) are proven by passing tests the verifier ran directly — including the reinstall/update e2e tests added to close the review's WR-01 gap.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
