---
phase: 20-migration-wave-3-edge-handlers-usageerror
plan: 6
subsystem: orchestrators/import + edge/handlers/plugin + tests
tags: [gap-closure, citation-hygiene, cross-scope-regression-test, comment-quality]
requires:
  - 20-05 (WR-02 in-scope lock-test landed; line-anchored citations introduced)
provides:
  - Function-anchored comment citations across the import path (no
    `execute.ts:NNN-NNN` or `importClaudeSettings:NNN` refs remain in
    Plan-20-05-touched files); future line shifts cannot make the comments
    drift.
  - Sibling cross-scope regression test next to the existing WR-02 in-scope
    lock-test: locks that an unexpected `installPlugin` throw on scope A
    does NOT abort the outer `for (const scopePlan of plan.scopes)` loop,
    that only the throwing scope's plugin lands in
    `unexpectedPluginFailures`, and that a SINGLE merged `notify()` emits
    the combined cascade for both scopes.
affects:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - tests/orchestrators/import/execute.test.ts
tech-stack:
  added: []
  patterns:
    - "Function-anchored comment citations (executeScopedPlan's named
      sub-blocks + 'end of importClaudeSettings') replacing line-anchored
      refs that drift on edits below."
    - "Scope-parameterized `loadSettings: async (scope) => ({...})` test
      pattern (carried from the existing `keeps user and project
      operations independent` test at execute.test.ts:907) extended with
      an `installPlugin` throw branch on one scope to lock cross-scope
      continuation."
key-files:
  created:
    - .planning/phases/20-migration-wave-3-edge-handlers-usageerror/20-06-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - tests/orchestrators/import/execute.test.ts
decisions:
  - "WR-01 post-closure: Option B (function-anchored citations) locked.
    Every `execute.ts:NNN-NNN` or `importClaudeSettings:NNN` comment ref
    in the three Plan-20-05-modified files is now anchored to a stable
    function-name identifier (`executeScopedPlan`'s state-load try block,
    marketplacesToEnsure loop, pluginsToInstall loop, or 'the end of
    importClaudeSettings'). Function names do not drift on edits below
    the citation point; line numbers do."
  - "WR-02 post-closure: sibling cross-scope regression test landed. The
    Plan-20-05 in-scope lock-test (`execute.test.ts` subtest 7) exercised
    `selectedScopes: ['project']` only; this plan adds subtest 8 with
    `selectedScopes: ['project', 'user']` and an `installPlugin` mock that
    throws on scope A and succeeds on scope B. The outer-loop guarantee is
    now regression-guarded against silent breakage by future refactors."
  - "SNM-23 remains SATISFIED. This plan is a behavior-neutral REFINEMENT;
    the V2 cascade migration was verified GREEN by Plans 20-01..20-05 (per
    `20-VERIFICATION.md`). No production code paths changed."
metrics:
  duration: "~12 minutes"
  completed: "2026-05-27T19:15:00Z"
  tasks_completed: 2
  files_modified: 3
  commits: 2
---

# Phase 20 Plan 6: Citation Anchor and Cross-Scope Test Summary

One-liner: Replaced 7 line-anchored comment citations
(`execute.ts:NNN-NNN`, `importClaudeSettings:NNN`) with function-anchored
equivalents per WR-01 Option B, and added a sibling cross-scope regression
test that locks `importClaudeSettings`'s outer-loop continuation guarantee
when `installPlugin` throws on one scope and succeeds on another.

## Gap Closure Outcome

| Item                     | Disposition | Notes                                                                                                                                                                                                                                                              |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WR-01 (post-closure)     | CLOSED      | Option B applied: all 7 line-anchored refs (`execute.ts:518-528`, `execute.ts:577-608`, `execute.ts:737-745`, `execute.ts:457-465`, `importClaudeSettings:787` ×3) removed from the three Plan-20-05-touched files. Function-anchored equivalents in place.       |
| WR-02 (post-closure)     | CLOSED      | New sibling subtest `importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)` landed at `tests/orchestrators/import/execute.test.ts`, immediately after the in-scope lock-test (subtest 7 → 8 ordering). |
| SNM-23 (requirement)     | UNCHANGED   | Still SATISFIED. No production code paths changed; the change set is comments + one new test.                                                                                                                                                                       |

## Plan-Level Gate Results

| Gate | Command / Expectation                                                                                                       | Result                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1    | `grep -nE "execute\.ts:[0-9]+\|importClaudeSettings:[0-9]+" <three files>` → empty                                          | **PASS** (zero matches across all three files)                       |
| 2    | `grep -c "executeScopedPlan" .../import.ts` ≥ 3 AND `grep -c "end of importClaudeSettings" <execute.ts + execute.test.ts>` ≥ 3 | **PASS** (executeScopedPlan: 3 in import.ts; "end of importClaudeSettings": 1 in execute.ts + 3 in execute.test.ts = 4 total) |
| 3    | New cross-scope subtest emits an `ok` line matching the WR-02 cross-scope regex                                              | **PASS** (`ok 8 - importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)`) |
| 4    | Existing in-scope WR-02 subtest still PASSES                                                                                 | **PASS** (`ok 7 - importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)`) |
| 5    | `npm run check` exits 0; full suite GREEN                                                                                    | **PASS** (exit 0; 1365 pass / 0 fail / 0 cancelled / 2 todo; baseline 1364 + 1 new test = 1365) |
| 6    | `node --test tests/architecture/catalog-uat.test.ts` exits 0                                                                  | **PASS** (3/3 pass; byte-equality unchanged)                        |

### Gate 1 evidence (raw grep)

```
$ grep -nE "execute\.ts:[0-9]+" \
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts \
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
    tests/orchestrators/import/execute.test.ts
(no output -- exit 1 from grep)

$ grep -nE "importClaudeSettings:[0-9]+" \
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts \
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
    tests/orchestrators/import/execute.test.ts
(no output -- exit 1 from grep)
```

### Gate 2 evidence (raw grep counts)

```
$ grep -c "executeScopedPlan" extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
3

$ grep -c "end of importClaudeSettings" \
    extensions/pi-claude-marketplace/orchestrators/import/execute.ts \
    tests/orchestrators/import/execute.test.ts
extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1
tests/orchestrators/import/execute.test.ts:3
```

### Gate 5 evidence (npm run check tail)

```
1..1295
# tests 1367
# suites 90
# pass 1365
# fail 0
# cancelled 0
# skipped 0
# todo 2
# duration_ms ~22585

(npm run check exit code: 0)
```

### Gate 6 evidence (catalog UAT tail)

```
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms ~2424

(catalog-uat.test.ts exit code: 0)
```

## Tasks Completed

### Task 1: WR-01 -- Function-anchored citations across three files

**Commit:** `560d959`
**Subject:** `docs(20): function-anchor citations across import path (WR-01)`

**Files (3):**

- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` -- the
  12-line comment block at the top of the handler was rewritten. The three
  named wraps now cite `executeScopedPlan`'s sub-blocks by name:
  "state-load try block", "marketplacesToEnsure loop", "pluginsToInstall
  loop". The final-notify ref is anchored to "the end of
  importClaudeSettings". The previous citations
  `execute.ts:518-528` and `execute.ts:577-608` are gone.

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` -- the
  WR-02 try/catch comment above the `let outcome: InstallPluginOutcome;`
  declaration now reads "the final notify() at the end of
  importClaudeSettings still fires" instead of "the final notify() at
  importClaudeSettings:787 still fires".

- `tests/orchestrators/import/execute.test.ts` -- four comments inside the
  existing WR-02 in-scope lock-test were rewritten:
  - the cascade-row comment now says "the final notify() at the end of
    importClaudeSettings to fire exactly once"
  - the discriminated-shape comment now says "the catch arm in
    executeScopedPlan's pluginsToInstall loop" instead of
    `execute.ts:737-745`
  - the assertion-(3) header now says "final notify() at the end of
    importClaudeSettings fired exactly once" instead of
    `importClaudeSettings:787`
  - the buildImportNotificationMarketplaces comment now says "the V2
    cascade builder in execute.ts" instead of `execute.ts:457-465`

Behavior: ZERO change. Comments only. The WR-02 in-scope subtest still
passes (`ok 7`); the full check suite still GREEN.

### Task 2: WR-02 -- Cross-scope sibling regression test

**Commit:** `9350776`
**Subject:** `test(20): lock cross-scope continuation after installPlugin throw`

**File (1):** `tests/orchestrators/import/execute.test.ts`

Inserted ONE new `test(...)` block immediately after the existing WR-02
in-scope lock-test (between the closing `});` of subtest 7 and the
`importClaudeSettings classifies uninstallable plugins as warnings`
subtest at line 509). Test name:
`importClaudeSettings continues to next scope after unexpected installPlugin throw on prior scope (WR-02 cross-scope)`.

The test uses the scope-parameterized `loadSettings: async (scope) =>
({...})` mock pattern from the existing `keeps user and project operations
independent` test. Plugin `boom` on scope `project` throws via
`installPlugin`; plugin `other` on scope `user` succeeds. Asserts four
guarantees:

1. **Both scopes attempted:** `attempted === ["project:boom", "user:other"]`
   (the outer `for (const scopePlan of plan.scopes)` loop iterated past the
   throw).
2. **Single unexpected failure record:**
   `result.unexpectedPluginFailures.length === 1`, scope `"project"`,
   plugin `"boom"`.
3. **Single merged notify() emission:** `notifications.length === 1`
   (NOT one-per-scope).
4. **Merged cascade rendering:** the single message matches both
   `/⊘ boom \(failed\) \{not in manifest\}/` (scope A's caught throw) AND
   `/● other \(installed\)/` (scope B's successful install).

Result: subtest 8 lands GREEN. Total test count in
`execute.test.ts` rises from 17 → 18 (delta +1, no duplications).

## SNM-23 Behavioral Surface

UNCHANGED. SNM-23 was already verified GREEN by Plans 20-01..20-05. This
plan is a behavior-neutral refinement that:

- Hardens the comment quality of the import error-boundary documentation
  against future line-shift drift (Task 1).
- Locks an additional regression-guard around the existing cross-scope
  continuation behavior, which was correct in production but unguarded
  against silent regression (Task 2).

## Deviations from Plan

None. Plan executed exactly as written. The two `test(...)` commit
messages used the exact Conventional Commits subjects from the plan's
`<action>` blocks. Pre-commit ran clean on both commits without `SKIP=`
prefixes (this execution was inline on `gsd/v1.3-replan-catalog`, not in
a worktree).

## Commits

| Commit    | Type   | Subject                                                                  |
| --------- | ------ | ------------------------------------------------------------------------ |
| `560d959` | docs   | `docs(20): function-anchor citations across import path (WR-01)`         |
| `9350776` | test   | `test(20): lock cross-scope continuation after installPlugin throw`      |

## Self-Check: PASSED

Verified both commits exist in git log and each modified file contains the
expected function-anchor / new-test markers:

- `560d959` -- FOUND: `git log --oneline | grep -q 560d959` ✓
- `9350776` -- FOUND: `git log --oneline | grep -q 9350776` ✓
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`
  present; contains `executeScopedPlan` ×3 (state-load, marketplacesToEnsure,
  pluginsToInstall sub-block citations), contains `pluginsToInstall loop`,
  contains `end of` phrase pointing at `importClaudeSettings`; ZERO matches
  for `execute.ts:[0-9]+`.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
  present; contains exactly one `end of importClaudeSettings` reference
  (in the WR-02 catch comment); ZERO matches for `importClaudeSettings:[0-9]+`.
- `tests/orchestrators/import/execute.test.ts` present; contains three
  `end of importClaudeSettings` references (across the WR-02 in-scope and
  cross-scope subtests + the existing assertion-(3) comment), contains
  `scope-A host crash` ×1 (the new throw message), contains exactly one
  occurrence of `selectedScopes: ["project", "user"]` (the cross-scope
  param shape); ZERO matches for `execute.ts:[0-9]+` or
  `importClaudeSettings:[0-9]+`.
- Subtest 7 (`partial cascade row (WR-02)`) still `ok`.
- Subtest 8 (`continues to next scope after unexpected installPlugin throw
  on prior scope (WR-02 cross-scope)`) `ok`.
- Total subtests in `execute.test.ts`: 18 (was 17 pre-plan; delta +1, no
  duplications).
