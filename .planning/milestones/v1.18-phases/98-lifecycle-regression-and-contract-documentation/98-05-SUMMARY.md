---
phase: 98-lifecycle-regression-and-contract-documentation
plan: 05
subsystem: testing
tags: [node-test, characterization, plugin-update, marketplace-autoupdate]

# Dependency graph
requires:
  - phase: 98-lifecycle-regression-and-contract-documentation
    provides: "The WR-04 gate change in preflightUpdate, whose disabled-record arm sits beside the manifest-absent arm these cases pin"
provides:
  - "Byte coverage of the `(skipped) {not in manifest}` row on all three plugin-update enumeration targets"
  - "Idempotency and no-state-write pins on the manifest-absent skip arm"
  - "Two-half coverage of the autoupdate cascade skip: the mapper re-narrowing and the end-to-end origin"
  - "A backward-compatible path-marketplace seed helper in the marketplace update suite, taking optional scope, autoupdate, and plugin records"
affects: [98-06, milestone verification, output catalog work touching skip rows]

actuals:
  tokens: 3300
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "User-scope + hermetic home as the isolation route for any case that drives a function reading process.cwd() itself"

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "The bulk enumeration bodies carry one line the targeted body does not — the OUT-03 / D-04 plural-cardinality tally. The cases pin the full bulk body (targeted row bytes + tally) rather than weakening to a substring match, so the skip row stays byte-pinned and the tally is pinned alongside it."
  - "The expected row literal is duplicated rather than shared with the pre-existing targeted case, so both remain independent pins; a single shared constant would drift on both sides at once."
  - "The end-to-end autoupdate case runs at user scope with the suite's hermetic home. The real single-plugin update reads the process working directory itself, and changing that setting is process-global and unsafe under concurrent case execution."

patterns-established:
  - "Fixture mutation check: before accepting a new end-to-end characterization case, invert the fixture precondition and confirm exactly that case fails."

requirements-completed: [LIFE-05, LIFE-06]

coverage:
  - id: D1
    description: "The manifest-absent skip renders the same `(skipped) {not in manifest}` row on the marketplace-bulk enumeration target, and a repeated update over the same state is byte-identical."
    requirement: LIFE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#LIFE-05: marketplace-bulk target renders `(skipped) {not in manifest}`, and a repeated update is byte-identical"
        status: pass
    human_judgment: false
  - id: D2
    description: "The manifest-absent skip renders the same row on the global-bulk enumeration target and writes no state — the installation record is byte-identical before and after."
    requirement: LIFE-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#LIFE-05: global-bulk target renders `(skipped) {not in manifest}` and writes NO state"
        status: pass
    human_judgment: false
  - id: D3
    description: "The autoupdate cascade mapper carries a preflight-narrowed `not in manifest` skip through instead of collapsing it into its permissive fallback, and leaves the installation record untouched."
    requirement: LIFE-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#LIFE-06: cascade mapper carries a preflight `not in manifest` skip through, leaving the record untouched"
        status: pass
    human_judgment: false
  - id: D4
    description: "The autoupdate cascade renders the same skipped row end to end through the real single-plugin update, covering the origin in the shared preflight."
    requirement: LIFE-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#LIFE-06: autoupdate cascade through the REAL single-plugin update renders `(skipped) {not in manifest}`"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-10
status: complete
---

# Phase 98 Plan 05: LIFE-05 / LIFE-06 manifest-absent skip coverage Summary

**Four characterization cases pinning the `(skipped) {not in manifest}` row on all three plugin-update enumeration targets and on both halves of the marketplace autoupdate cascade, plus the idempotency and no-state-write edges the row form alone does not cover.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-10T04:05:00Z
- **Completed:** 2026-08-10T04:21:20Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- The two previously uncovered enumeration targets — marketplace-bulk and global-bulk — now assert the manifest-absent skip byte for byte. All three targets converge on one preflight arm, so a change that drops the skip on a bulk path can no longer pass.
- The skip arm is proven idempotent (a second update over the same state renders identical bytes) and write-free (the installation record is deeply equal before and after), so an interrupted run cannot leave a partial record.
- The autoupdate cascade is covered in both halves: the mapper re-narrowing with a stubbed plugin-update function, and the origin end to end through the real single-plugin update.
- The marketplace suite's path-marketplace seed helper now takes an optional scope, autoupdate flag, and plugin-record map. Every pre-existing call site is unchanged.
- No production file was touched — `git diff extensions/` is empty across all three commits.

## Task Commits

Each task was committed atomically, tests included in the same commit:

1. **Task 1: LIFE-05 — the two uncovered enumeration paths plus the idempotency and no-write edges** — `83aa4165` (test)
2. **Task 2: LIFE-06 — the cascade mapper re-narrowing** — `dcdd798f` (test)
3. **Task 3: LIFE-06 — the end-to-end autoupdate origin** — `755e968a` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/update.test.ts` — two `LIFE-05:` cases under a section divider, plus the shared expected-body constants
- `tests/orchestrators/marketplace/update.test.ts` — two `LIFE-06:` cases, a shared `readPluginRecord` helper, and the widened `seedPathMarketplace`

## Decisions Made

- **Pin the full bulk body, not a substring.** The plan expected the bulk bodies to equal the targeted body exactly. They do not: bulk operations carry `cardinality: "plural"`, which appends the OUT-03 / D-04 tally line (`Plugin update: 1 warning`). The skip row itself is byte-identical, which is what LIFE-05 asserts. Rather than weaken to a substring match, the cases pin `${targeted body}\n\nPlugin update: 1 warning`, so the row and the tally are both locked.
- **Duplicate the row literal instead of sharing it with the targeted case.** Referencing one constant from the pre-existing targeted case would let a single edit move both pins together, which is the failure mode the pins exist to catch.
- **Extract `readPluginRecord` rather than repeat the read.** Two near-identical inline readers would have been copy-paste-detection surface; one helper taking the extension root, marketplace, and plugin name serves both cascade cases.
- **User scope for the end-to-end case, recorded in a comment.** The single-plugin update reads `process.cwd()` itself, so a project-scope fixture under a temporary directory is unreachable. User-scope locations ignore the working directory, so the hermetic home alone is enough. The comment states this so a later author does not "simplify" it back.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's expected bulk body was missing the plural-cardinality tally**

- **Found during:** Task 1 (both LIFE-05 cases)
- **Issue:** The plan and the phase research both stated the bulk shapes render the same body as the targeted shape. The first run failed on both cases: bulk bodies carry an extra `\n\nPlugin update: 1 warning` line. The claim was true of the row and false of the body — `composeTally` renders only when `cardinality === "plural"`, and the targeted form is `"single"`.
- **Fix:** Added a second constant, `MANIFEST_ABSENT_BULK_BODY`, composed from the targeted literal plus the tally, and pinned that. The section comment records the tally as an orthogonal contract so the distinction survives.
- **Files modified:** tests/orchestrators/plugin/update.test.ts
- **Verification:** `node --test tests/orchestrators/plugin/update.test.ts` → exit 0, 81/81.
- **Committed in:** `83aa4165` (Task 1 commit)

**2. [Rule 3 - Blocking] Prettier reflowed a chained state read into an unreadable wrap**

- **Found during:** Task 1 (pre-commit)
- **Issue:** `(await loadState(...)).marketplaces["mp"]?.plugins["hello"]` exceeded the 100-column width and Prettier split it across the index bracket, failing the hook.
- **Fix:** Replaced the chain with a local `readRecord` closure (later generalized to the module-level `readPluginRecord` helper in Task 3).
- **Files modified:** tests/orchestrators/plugin/update.test.ts
- **Verification:** `pre-commit run --files ...` → prettier Passed; suite re-run green.
- **Committed in:** `83aa4165` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 incorrect expected value in the plan, 1 formatting blocker)
**Impact on plan:** Neither changed the plan's intent or scope. The first made the assertion stricter than planned — the full bulk body is now pinned rather than just the row. No production code was touched.

## Issues Encountered

- **Vacuous-pass risk on the end-to-end case.** A characterization case that seeds a fixture and matches a row can pass for the wrong reason. Confirmed it does not: inverting the fixture precondition (leaving the manifest entry in place) produced exactly one failure, the new case. The regex is anchored to the whole row line, and `(skipped)` cannot be reached from the throw path, which renders `(failed)`.
- The TruffleHog pre-commit hook fails structurally inside a worktree (git-mode scan cannot read `.git/index`). Each commit was preceded by a clean filesystem-mode scan (`verified_secrets: 0, unverified_secrets: 0`) and committed with `SKIP=trufflehog`, per the documented protocol. No other hook was skipped.

## Carrier List

Nothing to carry forward. This plan added no production behavior, minted no token, and left no stub or deferred item.

One observation for whoever touches the skip rows next: the marketplace cascade's `skipped` arm forwards name, scope, and reasons only — no version. So the cascade row is `⊘ hello (skipped) {not in manifest}` while the plugin-update row is `⊘ hello v1.0.0 (skipped) {not in manifest}`. Both forms are now pinned; the asymmetry is deliberate as far as this plan can tell, but it is worth a glance during the output-catalog reconciliation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LIFE-05 and LIFE-06 are fully covered. Plan 06's contract gate can assume both skip surfaces are locked.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` all exit 0; both touched suites pass (133/133 together).

## Self-Check: PASSED

All modified files exist on disk; all three task commits resolve in `git log`.

---
*Phase: 98-lifecycle-regression-and-contract-documentation*
*Completed: 2026-08-10*
