---
phase: 21
plan: 21-01
subsystem: lint-infrastructure
tags: [teardown, lint, drift-guard, atomic-commit, msg-plugin]
requires: []
provides:
  - "tests/lint-rules/ absent on disk (SNM-24 closed)"
  - "tests/architecture/msg-rule-registry.test.ts absent on disk (SNM-25 closed)"
  - "tests/architecture/no-legacy-markers.test.ts absent on disk (SNM-28 closed via D-21-03 DELETE arm)"
  - "eslint.config.js stock-rules-only with BLOCK B-2 persistence/migrate.ts override (SNM-27 closed)"
  - "extensions/pi-claude-marketplace/persistence/migrate.ts: zero inline eslint-disable directives"
  - "package.json test script: no tests/lint-rules glob argument"
affects:
  - "Plan 21-02 inherits a stock-ESLint baseline; no MSG-* drift-guard surface remains to migrate"
  - "Plan 21-03 final-gate verification runs against the reduced post-Plan-21-01 lint surface"
tech-stack:
  added: []
  patterns:
    - "Block-level files-override supersedes inline eslint-disable directives (BLOCK B-2 / D-21-04)"
    - "Atomic single-commit teardown of cross-cutting drift-guard infrastructure (D-21-06 + D-21-08)"
key-files:
  created: []
  modified:
    - "eslint.config.js (573 -> 323 lines; -252 net; BLOCK B-2 added; MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 deleted; tests/lint-rules/** overrides deleted; msgPlugin import deleted; BLOCK A message strings rewritten to V2-only phrasing)"
    - "extensions/pi-claude-marketplace/persistence/migrate.ts (-3 lines; inline `// eslint-disable-next-line ...` directive at line 177 removed; header docs + JSDoc updated to describe BLOCK B-2)"
    - "package.json (line 76: dropped trailing `\"tests/lint-rules/**/*.test.{js,ts}\"` argument)"
    - "tests/persistence/migrate.test.ts (CMC-37 test updated to assert the inline directive is GONE under D-21-04 -- the new post-Plan-21-01 invariant -- rather than asserting its presence)"
  deleted:
    - "tests/lint-rules/ (73 files: 34 MSG-* rule sources + 34 RuleTester `.test.js` suites + 3 `lib/` helpers + 2 plugin shell files)"
    - "tests/architecture/msg-rule-registry.test.ts (1 file, 4 inner parity tests)"
    - "tests/architecture/no-legacy-markers.test.ts (1 file, 1 inner static-audit test)"
decisions:
  - "D-21-04: Surgical BLOCK A message-string updates + new BLOCK B-2 files-override for persistence/migrate.ts (no-console: off, no-restricted-syntax: off)"
  - "D-21-06 + D-21-08: ONE atomic commit covers all 79 file changes (`chore(21): retire MSG-* drift-guard + tests/lint-rules + lint sweep`)"
  - "tests/persistence/migrate.test.ts CMC-37 rewritten to enforce the new post-D-21-04 invariant (Rule 1 -- stale test asserting v1.3 invariant)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-27"
  tests_pre: 1438  # estimated pre-Phase-21 baseline including 34 lint-rules suites + 4 + 1 architecture + 1263 other ≈ 1302; npm test now reports 1263; tests/lint-rules suites do not count against `npm test` baseline (filtered by separate glob arg)
  tests_post: 1263  # `npm test` post-commit (no `no files found` warnings)
  files_changed: 79
  insertions: 34
  deletions: 4992
---

# Phase 21 Plan 21-01: ESLint + MSG-* Drift-Guard + Static-Audit Teardown Summary

Atomic single-commit retirement of the entire v1.3 MSG-* drift-guard infrastructure (34-rule ESLint plugin under `tests/lint-rules/`, 4-way registry-parity test, and 5-ES-5-literal static-audit gate), the matching `eslint.config.js` wirings (MSG-Blocks 1 / 1b / 2 / 3 / 4a / 4b / 5 / 6 + the two `tests/lint-rules/**` overrides + the `msgPlugin` import), and the now-redundant inline `eslint-disable-next-line` directive at `persistence/migrate.ts:177` -- replaced by a single block-level `files: ["…/persistence/migrate.ts"]` override (BLOCK B-2) per D-21-04. Closed: SNM-24, SNM-25, SNM-27, SNM-28.

## Tasks Completed

1. **Task 21-01-01 -- Rewrite eslint.config.js** -- Deleted `msgPlugin` import (line 8); deleted MSG-Block comment header (lines 144-150) + MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 (lines 151-356); deleted both `tests/lint-rules/**` overrides (lines 535-572); inserted new BLOCK B-2 (per-file override for `persistence/migrate.ts` with `no-console: "off"` AND `no-restricted-syntax: "off"`); updated BLOCK A `no-restricted-syntax` selector messages at lines 111, 116, 127 to V2-only phrasing (references to `notify(ctx, pi, NotificationMessage)` and `notifyUsageError(ctx, UsageErrorMessage)` instead of the deleted V1 wrappers). Final file size: **323 lines** (down from 573; -250 net). RETAINED verbatim: BLOCK A `no-restricted-syntax` selector + `no-console: "error"`, BLOCK B (shared/notify.ts self-override), BLOCK C (9-zone import-direction), BLOCK D (test fixtures), BLOCK E (Pi peer chokepoint), tests-wide relaxation override, and the `eslint.config.js` self-`disableTypeChecked` override. No commit -- folded into the atomic Plan 21-01 commit.

2. **Task 21-01-02 -- Remove inline `eslint-disable-next-line` at `persistence/migrate.ts:177`** -- Deleted the one-line directive `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail`. The `console.warn(...)` callsite at the now-line-177 STAYS unchanged; the BLOCK B-2 override added in Task 1 supplies the equivalent suppression. Also updated two stale documentation blocks (file header lines 6-10 and the `persistMigratedState` JSDoc at lines 156-168) to describe the new block-level discipline rather than the retired inline-directive incantation. No commit -- folded into the atomic Plan 21-01 commit.

3. **Task 21-01-03 -- Delete `tests/lint-rules/` + 2 architecture tests** -- `rm -rf tests/lint-rules/` (73 files: 34 MSG-* rule sources + 34 RuleTester `.test.js` suites + 3 `lib/` helpers + 2 plugin shell files); `rm tests/architecture/msg-rule-registry.test.ts` (4-way parity test obsolete); `rm tests/architecture/no-legacy-markers.test.ts` per D-21-03 (V2 closed-set type encoding structurally rejects ES-5 marker re-introduction). RETAINED untouched: `tests/architecture/markers-snapshot.test.ts`, `tests/architecture/catalog-uat.test.ts`, `tests/architecture/notify-types.test.ts`. No commit -- folded into the atomic Plan 21-01 commit.

4. **Task 21-01-04 -- Update `package.json` test script** -- Surgically removed the trailing `" \"tests/lint-rules/**/*.test.{js,ts}\""` argument from line 76's `test` script per RESEARCH §8 CORRECTION 7. Brace expansion order unchanged (still `{architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction}` -- Plan 21-02 owns removal of `presentation` in BOTH `test` and `test:coverage:unit`). `test:coverage:unit` (line 80) NOT touched (its glob never contained `tests/lint-rules`). No other package.json changes. No commit -- folded into the atomic Plan 21-01 commit.

5. **Task 21-01-05 -- Pre-commit gate + atomic single commit** -- Ran `npm run check`; one failure surfaced (`tests/persistence/migrate.test.ts:189` CMC-37 asserted the inline `eslint-disable-next-line` was PRESENT -- the v1.3 invariant). Updated the test to assert the inline directive is GONE per D-21-04 (Rule 1 -- stale-test fix; the assertion now enforces the new post-Plan-21-01 invariant). `npm run check` GREEN: **1263 pass / 0 fail / 0 skipped / 0 todo**. Staged 79 files; ran `pre-commit run --files $(git diff --cached --name-only)` -- TruffleHog failed due to documented worktree sandbox issue (CLAUDE.md note); ran `pre-commit run trufflehog --all-files` outside the worktree (from the main repo) -- passed. Committed with `SKIP=trufflehog` prefix per CLAUDE.md worktree guidance. Commit `878e51f` landed: `chore(21): retire MSG-* drift-guard + tests/lint-rules + lint sweep`.

## Files Created/Modified

| File | Change | Notes |
|------|--------|-------|
| `eslint.config.js` | modified | 573 → 323 lines; -250 net; +BLOCK B-2 (~10 lines); -msgPlugin import; -MSG-Block comment header; -MSG-Blocks 1, 1b, 2, 3, 4a, 4b, 5, 6 (~213 lines); -both `tests/lint-rules/**` overrides (~38 lines); BLOCK A message strings rewritten to V2-only phrasing |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | modified | -1 line (inline `eslint-disable-next-line` directive removed); 2 docstring blocks rewritten to describe BLOCK B-2 |
| `package.json` | modified | Line 76: dropped trailing `\"tests/lint-rules/**/*.test.{js,ts}\"` argument |
| `tests/persistence/migrate.test.ts` | modified | CMC-37 test rewritten: now asserts inline directive is GONE per D-21-04 |
| `tests/lint-rules/` | deleted | 73 files (entire directory) |
| `tests/architecture/msg-rule-registry.test.ts` | deleted | 4-way parity test obsolete with MSG-* plugin gone |
| `tests/architecture/no-legacy-markers.test.ts` | deleted | Per D-21-03; V2 closed-set type encoding supersedes |
| `.planning/phases/21-final-teardown-green-gate/21-01-SUMMARY.md` | created | this file |

## Verification Matrix: All Plan 21-01 Success Criteria

| SC | Description | Command | Observed Result | Exit | Status |
|----|-------------|---------|-----------------|------|--------|
| SNM-24 | `tests/lint-rules/` absent on disk | `! test -d tests/lint-rules` | absent | 0 (predicate) | **GREEN** |
| SNM-25 | `tests/architecture/msg-rule-registry.test.ts` absent on disk | `! test -f tests/architecture/msg-rule-registry.test.ts` | absent | 0 (predicate) | **GREEN** |
| SNM-27 | `eslint.config.js` cleaned of all MSG-* wirings | `! grep -nE "import msgPlugin\|msg/(sr-\|gr-\|nc-\|lc-\|mr-\|rp-\|rh-\|cc-\|sd-\|er-\|wm-\|kc-\|kp-)" eslint.config.js` | no matches | 0 (predicate) | **GREEN** |
| SNM-27 (BLOCK B-2) | persistence/migrate.ts files-override added with no-console + no-restricted-syntax both off | `grep -A 6 "persistence/migrate.ts" eslint.config.js \| grep -c "no-console"` + `grep -A 6 "persistence/migrate.ts" eslint.config.js \| grep -c "no-restricted-syntax"` | 1 + 2 (BLOCK B-2 + BLOCK A AST selector definition) | 0 | **GREEN** |
| SNM-28 | `tests/architecture/no-legacy-markers.test.ts` absent on disk | `! test -f tests/architecture/no-legacy-markers.test.ts` | absent | 0 (predicate) | **GREEN** |
| D-21-04 inline-directive removal | `persistence/migrate.ts` contains zero inline `eslint-disable*` directives | `! grep "eslint-disable-next-line" extensions/pi-claude-marketplace/persistence/migrate.ts` | no matches | 0 (predicate) | **GREEN** |
| RESEARCH §8 CORRECTION 7 | `package.json` test script no longer references `tests/lint-rules` | `! grep "tests/lint-rules" package.json` | no matches | 0 (predicate) | **GREEN** |
| `npm test` no-files hygiene | No "no files found" warnings post-deletion | `npm test 2>&1 \| grep -i "no files"` | empty | n/a | **GREEN** |
| `npm run check` full pipeline | typecheck + lint + format + tests all pass | `npm run check` | 1263 pass / 0 fail / 0 skipped / 0 todo | 0 | **GREEN** |
| BLOCK A message-string V2-only | BLOCK A selector messages reference `notify` / `notifyUsageError` (not deleted V1 wrappers) | `grep -E "notifySuccess\|notifyWarning\|notifyError\(ctx" eslint.config.js` | no matches | 1 | **GREEN** |
| Atomic single commit | One commit covers all 79 changes | `git log -1 --pretty=%s` | `chore(21): retire MSG-* drift-guard + tests/lint-rules + lint sweep` | 0 | **GREEN** |

## NO-CHANGE Invariant Re-Verification

| Invariant | Command | Observed | Expected | Status |
|-----------|---------|----------|----------|--------|
| BLOCK A present | `grep -c "BLOCK A" eslint.config.js` | 1 | ≥1 | **PASS** |
| BLOCK B (shared/notify.ts self-override) retained verbatim | `grep -A 3 "BLOCK B:" eslint.config.js \| grep -c "shared/notify.ts"` | 1 | 1 | **PASS** |
| BLOCK C (9-zone import-direction) retained verbatim | `grep -c "import-x/no-restricted-paths" eslint.config.js` | 1 | 1 (Plan 21-02 may amend; Plan 21-01 leaves verbatim) | **PASS** |
| BLOCK D (test fixtures) retained | `grep -c "tests/fixtures/bad-imports" eslint.config.js` | 1 | 1 | **PASS** |
| BLOCK E (Pi peer chokepoint) retained verbatim | `grep -c "@earendil-works/pi-coding-agent" eslint.config.js` | 1 | 1 | **PASS** |
| Tests-wide relaxation override retained | `grep -c 'files: \["tests/\*\*/\*.ts"\]' eslint.config.js` | 1 | 1 | **PASS** |
| `eslint.config.js` self-`disableTypeChecked` override retained | `grep -c 'files: \["eslint.config.js"\]' eslint.config.js` | 1 | 1 | **PASS** |
| `tests/architecture/markers-snapshot.test.ts` untouched | `test -f tests/architecture/markers-snapshot.test.ts` | exists | exists | **PASS** |
| `tests/architecture/catalog-uat.test.ts` untouched | `test -f tests/architecture/catalog-uat.test.ts` | exists | exists | **PASS** |
| `tests/architecture/notify-types.test.ts` untouched | `test -f tests/architecture/notify-types.test.ts` | exists | exists | **PASS** |
| `package.json` brace expansion order unchanged | `grep -c "architecture,bridges,domain,edge,helpers,orchestrators,persistence,presentation,shared,transaction" package.json` | 2 | 2 (in `test` + `test:coverage:unit`) | **PASS** |
| `package.json:test:coverage:unit` untouched (Plan 21-02 owns) | `grep "test:coverage:unit" package.json \| head -1` | `architecture,...presentation,...transaction` glob unchanged | unchanged | **PASS** |
| `shared/grammar/` directory still present (Plan 21-02 deletes) | `test -d extensions/pi-claude-marketplace/shared/grammar` | exists | exists (Plan 21-01 out of scope) | **PASS** |
| `presentation/` directory still present (Plan 21-02 deletes) | `test -d extensions/pi-claude-marketplace/presentation` | exists | exists (Plan 21-01 out of scope) | **PASS** |
| V1 wrappers in `shared/notify.ts` still present (Plan 21-02 deletes) | `grep -c "^export function notify(Success\|Warning\|Error)" extensions/pi-claude-marketplace/shared/notify.ts` | 3 | 3 (Plan 21-01 out of scope) | **PASS** |

## Decisions Made

- **CMC-37 test rewrite (D-21-04-driven; Rule 1 auto-fix during Task 21-01-05):** `tests/persistence/migrate.test.ts` line 189 asserted the v1.3 invariant that the IL-3 callsite carry an inline `eslint-disable-next-line` directive. Under D-21-04 the inline directive is removed in favor of a block-level files-override; the test as written becomes a stale-invariant failure. The test was rewritten to enforce the new post-Plan-21-01 invariant (asserts the inline directive is GONE; asserts the `console.warn(...)` callsite is still present). This is a Rule 1 fix (the original assertion contradicted the active discipline) and is documented here in lieu of a separate deviation entry.

- **`persistence/migrate.ts` docstring rewrites (Rule 2 auto-fix during Task 21-01-02):** The file header (lines 6-10) and `persistMigratedState` JSDoc (lines 156-168) described the now-retired inline-directive incantation as the IL-3 mechanism. Stale docs that misdescribe the active enforcement mechanism create maintenance hazard; both blocks were rewritten to reference BLOCK B-2 instead. The verify command `! grep "eslint-disable-next-line"` required avoiding that specific substring in the new docstrings (paraphrased to "inline disable directive" instead).

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 -- Stale Test] `tests/persistence/migrate.test.ts:189` CMC-37 invariant-flip**
   - **Found during:** Task 21-01-05 pre-commit gate (`npm run check` reported 1 failure: `IL-3 inline disable must appear directly above the warn`).
   - **Issue:** The test asserted the v1.3 inline `eslint-disable-next-line` directive was PRESENT; after D-21-04 the directive is removed in favor of BLOCK B-2. The plan correctly removed the directive but did not call out that this same test file enforced the inverse invariant.
   - **Fix:** Rewrote the test body to assert the inline directive is GONE (new post-D-21-04 invariant), and kept a positive assertion that the `console.warn(...)` callsite itself is still present (preserving the IL-3 callsite invariant separately).
   - **Files modified:** `tests/persistence/migrate.test.ts` (lines 189-208 -- 11 line-diff).
   - **Commit:** Folded into atomic Plan 21-01 commit `878e51f`.

2. **[Rule 2 -- Stale Docs] `extensions/pi-claude-marketplace/persistence/migrate.ts` header + JSDoc**
   - **Found during:** Task 21-01-02 (after removing the inline directive at line 177, the file header at lines 6-10 and the `persistMigratedState` JSDoc at lines 156-168 still described the inline-directive incantation as the active IL-3 mechanism).
   - **Issue:** Stale documentation actively misdescribes the enforcement path -- a future maintainer reading the JSDoc would search for an inline directive that no longer exists.
   - **Fix:** Both docblocks rewritten to reference BLOCK B-2 (the new mechanism). Phrasing avoids the substring `eslint-disable-next-line` so the verify command `! grep -n "eslint-disable-next-line" extensions/pi-claude-marketplace/persistence/migrate.ts` continues to enforce zero inline directives.
   - **Files modified:** `extensions/pi-claude-marketplace/persistence/migrate.ts` (header lines 6-10 + JSDoc lines 156-168 -- net ~-1 line after rewrite).
   - **Commit:** Folded into atomic Plan 21-01 commit `878e51f`.

No Rule 3 (blocking fix) or Rule 4 (architectural decision) deviations occurred.

## Authentication Gates

None -- Plan 21-01 is pure file-system + git work; no network or credentialed surfaces touched.

## Known Stubs

None -- Plan 21-01 is a teardown plan; no stubs or placeholders introduced. The closed-set type encoding in `shared/notify.ts` (which Plan 21-02 inlines from `shared/grammar/*`) is the structural replacement for the deleted MSG-* drift-guard surface.

## Threat Flags

None -- Plan 21-01 only DELETES surface area (drift-guard infrastructure + inline directives). No new endpoints, no new auth paths, no new file-access patterns, no schema changes. The reduction in surface is monotonically safer than the pre-plan state.

## Self-Check: PASSED

- **Files exist as claimed:**
  - `eslint.config.js` -- modified (323 lines, BLOCK B-2 present, no msg/ wirings).
  - `extensions/pi-claude-marketplace/persistence/migrate.ts` -- modified (no inline directive).
  - `package.json` -- modified (no `tests/lint-rules` substring).
  - `tests/persistence/migrate.test.ts` -- modified (CMC-37 enforces inline-directive-absence invariant).
  - `tests/lint-rules/` -- absent.
  - `tests/architecture/msg-rule-registry.test.ts` -- absent.
  - `tests/architecture/no-legacy-markers.test.ts` -- absent.
  - `.planning/phases/21-final-teardown-green-gate/21-01-SUMMARY.md` -- created (this file).

- **Commit exists:** `git log --oneline -5` shows `878e51f chore(21): retire MSG-* drift-guard + tests/lint-rules + lint sweep` at HEAD.

- **`npm run check` post-commit:** GREEN (1263 pass / 0 fail / 0 skipped / 0 todo).
