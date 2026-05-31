---
phase: 28-severity-routing-label-discipline
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/28-severity-routing-label-discipline/28-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 28: Code Review Fix Report

**Fixed at:** 2026-05-31
**Source review:** .planning/phases/28-severity-routing-label-discipline/28-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; critical_warning scope)
- Fixed: 2
- Skipped: 0

The 4 Info findings (IN-01 through IN-04) were OUT of scope for this pass
(critical_warning scope) and were not attempted.

## Fixed Issues

### WR-01: Two autoupdate test titles assert "severity warning" but the bodies assert info (stale-title drift)

**Files modified:** `tests/orchestrators/marketplace/autoupdate.test.ts`
**Commit:** 59042ea
**Applied fix:** Replaced the trailing `at severity warning` with `at severity
info (benign per UXG-02 / D-28-07)` in BOTH idempotent-flip test titles (line
124 `already autoupdate` / line 143 `already no autoupdate`). Title text only;
the bodies and `assert.equal(notifications[0]!.severity, undefined)` assertions
were left untouched. The current code matched the review context exactly -- both
stale titles were present verbatim and the bodies already asserted info
severity, so the titles were the only thing lying. No logic changed; this is a
documentation/maintainability fix.

### WR-02: No direct unit test pins the empty-`reasons` plugin-skip -> warning case (arm-3 boundary gap)

**Files modified:** `tests/shared/notify-v2.test.ts`
**Commit:** 5911a1e
**Applied fix:** Added a `notify()`-boundary unit test
`"UXG-02 (D-28-06): plugin skip with empty reasons:[] computes warning
(allBenign guard on length)"`, inserted directly before the sibling
mp-omitted-reasons test (the former `:1995` test). It builds a plugin `skipped`
row carrying a literal `reasons: []`, drives it through `notify()`, and asserts
`args.length === 2` and `args[1] === "warning"` -- mirroring the shape used by
the sibling tests at the former `:1940`/`:1995` lines. Reused the existing
`makeCtx()` and `piWithNothingLoaded()` helpers (verified present at
notify-v2.test.ts:141 and :176) and the imported `NotificationMessage` type.
This pins the arm-3 `allBenign([]) === false` boundary so a future refactor
dropping the `reasons.length > 0` guard (which would make `[].every(...)`
vacuously `true` -> info) is caught.

## Verification

- **Tier 1 (re-read):** Confirmed both fixes present and surrounding code intact
  for each edit.
- **Tier 2 (pre-commit hooks):** `pre-commit run --files
  tests/orchestrators/marketplace/autoupdate.test.ts
  tests/shared/notify-v2.test.ts` -- all hooks Passed (prettier, trailing
  whitespace, smartquotes, trufflehog, etc.). The eslint/typecheck npm hooks were
  skipped by the hook file-pattern config for these paths and were instead
  covered by the full check below.
- **Full check (`npm run check`):** GREEN. Typecheck + ESLint + Prettier + tests
  all pass: `# tests 1157 / # pass 1157 / # fail 0`. The new WR-02 test executed
  and passed (`ok 1092 - UXG-02 (D-28-06): plugin skip with empty reasons:[]
  computes warning (allBenign guard on length)`). The WR-01 change is title-only,
  so it cannot affect pass/fail.

## Working-tree discipline

Only the two intended test files were staged and committed. The five
pre-existing modified files (`.claude/settings.json`, `.mdformat.toml`,
`.pre-commit-config.yaml`, `CHANGELOG.md`, `CLAUDE.md`) were left untouched and
unstaged throughout. `git status` was checked before each commit to confirm none
of them were staged.

---

_Fixed: 2026-05-31_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
