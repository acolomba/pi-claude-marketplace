---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
plan: 02
subsystem: marketplace-add
tags: [testing, coverage, marketplace-add, leftover-clone, gitops]

requires:
  - phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
    provides: "plan 01's recognizeLeftover/joinLeaks helpers and the measured list of add.ts branches still uncovered at its boundary"
provides:
  - "Every MA-13 refusal arm (origin mismatch, prefix-adjacent, case-differing, ssh-form, garbage, empty-string origin, no-origin, unreadable) asserted by behaviour through addMarketplace"
  - "The MA-8-before-recognition precedence case: a matching leftover still yields {duplicate name} when the derived name is already recorded"
  - "MA-14's single-fault and double-fault leak cases: a recognized leftover that cannot be fully removed fails as stale with the leak appended and no recorded destination, and both cases prove unwrapAddError's one-level Error.cause contract"
affects: [03-03-cascade-and-phase-boundary]

actuals:
  tokens: 3483
  tasks: 2
  commits: 2
  plan_head_before: f14b34cfb3404b4ba13621302fd8c094b50f9b17
  plan_head_after: c74861a22d296d221af00e8345f06a414d332e52

tech-stack:
  added: []
  patterns:
    - "Table-driven data-row cases (one sibling test() per row) for a discriminated result's near-miss arms, shared skeleton/assertions across rows."
    - "Two-call-in-one-case pattern for asserting both the standalone notify() row (reason + derived-name subject) and the orchestrated outcome.cause (leak text), since marketplace add's notify row carries no cause/leak detail by design."
    - "onClone hook chmod's the staging root AFTER the fake's clone already wrote the fixture into it, so a double-fault case faults the SECOND cleanup site without corrupting the first (WR-07's read-only-parent lever, applied twice)."

key-files:
  created: []
  modified:
    - tests/orchestrators/marketplace/add.test.ts

key-decisions:
  - "The MA-6/ATTR-07 not-a-repo case needed NO edit. Its fixture has no .git and the fake's canned listRemotes result defaults to {kind:\"not-a-repo\"} when a case does not configure listRemotesResult -- confirmed by running it unmodified, not assumed."
  - "The near-miss origin arms (mismatch, prefix-adjacent, case-differing, ssh-form, garbage, empty) are table-driven: one ListRemotesResult row per arm, one shared assertion block (stale-clone reason, derived-name subject, marker file survives, no throw escapes)."
  - "MA-14's leak text is unobservable from marketplace add's standalone notify() row by design (the MpFailed row type carries reasons/severity/plugins only, no cause field) -- both MA-14 cases therefore make TWO calls: one standalone (asserts the rendered row) and one orchestrated (asserts outcome.cause, which is errorMessage() over the same wrapped error)."
  - "The double-fault case must restore sources-staging/ to 0o755 between its two calls. The first call's onClone leaves it read-only permanently; without restoring it, the SECOND call's own fixture-copy mkdir fails before cloning, misclassifying the whole case as {unparseable} instead of {stale clone} -- caught by re-running the suite after the first attempt failed exactly that way."

patterns-established: []

requirements-completed: [MA-12, MA-13, MA-14]
# Copied verbatim from 03-02-PLAN.md frontmatter. MA-12/MA-13/MA-14 are ALSO
# declared by 03-01-PLAN.md's frontmatter; that plan's SUMMARY already
# exists, so the shared-ID gate is satisfied by this plan's completion.

coverage:
  - id: D1
    description: "Every MA-13 refusal arm (origin mismatch, prefix-adjacent, case-differing, ssh-form, garbage, empty-string origin, no-origin, unreadable) refuses as {stale clone}, leaves the directory on disk, and never throws"
    requirement: MA-13
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-13: <arm> still refuses as stale clone (8 table-driven cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "MA-8's duplicate-name check runs before recognition: a matching leftover still yields {duplicate name}"
    requirement: MA-12
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-8: a matching leftover still yields (failed) {duplicate name}, not {stale clone}"
        status: pass
    human_judgment: false
  - id: D3
    description: "A recognized leftover whose removal leaks fails as stale with the leak appended and no recorded destination (single fault)"
    requirement: MA-14
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-14: an unremovable recognized leftover fails as stale, with the leak appended and no recorded destination"
        status: pass
    human_judgment: false
  - id: D4
    description: "A double fault (leftover removal AND staging cleanup both leak) still classifies as {stale clone} through exactly one Error.cause level, with both leak texts present and one join marker"
    requirement: MA-14
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#MA-14 double fault: leftover removal AND staging cleanup both leak; still stale clone through one Error.cause level"
        status: pass
    human_judgment: false
  - id: D5
    description: "The whole-suite 100%-branch gate is green (add.ts and every extensions/** module), closing the red plan 01 declared"
    requirement: GATE-01
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:unit"
        status: pass
    human_judgment: false

duration: ~45min (approximate; start time not captured at dispatch)
completed: 2026-09-27
status: complete
---

# Phase 3 Plan 2: The refusal-arm and leak-arm proofs that close the 100%-branch gate Summary

**Every MA-13 refusal arm and both MA-14 leak arms are now asserted by behaviour in `tests/orchestrators/marketplace/add.test.ts`, and `npm run test:coverage:unit` reports `all files | 100.00 | 100.00 | 100.00` for the first time since plan 01 opened the branch -- no production file is touched.**

## Performance

- **Duration:** ~45 min (approximate; start time not captured at dispatch)
- **Completed:** 2026-09-27
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Every MA-13 refusal arm is asserted through `addMarketplace`, table-driven over one `ListRemotesResult` row per arm: origin names a different repository, origin is the identity plus one trailing character (the whole-string-equality guard), origin differs only by letter case (byte comparison, no case folding, per D-3-01), origin is an ssh-form remote, origin is a garbage string, origin is the empty string, no remote is named origin, and the destination could not be read. Every case asserts the `{stale clone}` reason, the derived-name subject, the marker file surviving on disk, and that `addMarketplace` never throws.
- The pre-existing `MA-6 / ATTR-07` case (not-a-repo arm) is confirmed byte-unchanged and still passes: its fixture has no `.git`, and `createGitOpsFake`'s `listRemotes` defaults to `{kind: "not-a-repo"}` when a case does not configure `listRemotesResult`.
- A new case proves MA-8's duplicate-name check (step 3) runs BEFORE recognition (step 4): a leftover whose `origin` MATCHES the source, plus an existing `state.marketplaces` entry for the derived name, still renders `{duplicate name}`, not `{stale clone}`.
- MA-14's single-fault case: a recognized leftover clone whose removal leaks (via a read-only `sourcesDir` parent, WR-07's own lever) fails as stale with the leak text appended and `loadState(...).marketplaces` recording no entry for the derived name.
- MA-14's double-fault case: BOTH the leftover-removal leak AND the fresh-staging-cleanup leak fire on the same add (the staging root is chmod'd read-only inside `onClone`, after the fixture has already been copied into it). The classification stays `{stale clone}` through exactly one `Error.cause` level, both leak texts are present, and the `" (additionally: "` marker appears exactly once -- the case that fails if the two leaks were ever chained through two `appendLeakToError` calls instead of joined into one.
- `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` now reports `branches 143/143, functions 16/16, lines 996/996` with no new pin row; `npm run test:coverage:unit` reports `all files | 100.00 | 100.00 | 100.00` across `extensions/**`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Every refusal arm refuses, and leaves the tree alone** - `fa9ea5ea` (test)
2. **Task 2: An unremovable leftover fails as stale, with the leak and no recorded destination** - `c74861a2` (test)

## Files Created/Modified

- `tests/orchestrators/marketplace/add.test.ts` - 8 table-driven MA-13 refusal cases, 1 MA-8-precedence case, 1 MA-14 single-fault case, 1 MA-14 double-fault case

## Decisions Made

See `key-decisions` in frontmatter. In prose: marketplace add's standalone `notify()` row for a failed add carries only `reasons` / `severity` / `plugins` -- no cause or leak text (confirmed by the existing D-79-03 test's explicit `note.message.includes("cause:") === false` assertion, and by reading `notifyWithContext` / `ADD_CONTEXT`'s render map, which declares no cause slot). Both MA-14 cases therefore call `addMarketplace` twice against the same still-broken leftover: once in standalone mode to assert the rendered row (reason + derived-name subject), once in orchestrated mode to assert `outcome.cause` (the same `errorMessage()` text `AddMarketplaceOutcome`'s `error` field carries). Repeating the failing add is safe because the fault is deterministic and idempotent -- the leftover directory is never fully removed and state is never mutated, so a second attempt reproduces the identical failure.

The double-fault case's first debugging pass failed with `{unparseable}` instead of `{stale clone}` on its second (orchestrated) call: the first call's `onClone` hook had left `sources-staging/` permanently read-only, so the second call's own fixture-copy `mkdir` failed before it ever reached recognition, routing the add down the unrelated clone-failure path. Fixed by restoring `sources-staging/` to `0o755` between the two calls; the second call's own `onClone` re-faults it afterward. Verified empirically with a standalone probe script (not committed) that printed the actual double-fault message.

## Deviations from Plan

None - plan executed exactly as written. The two Rule-3-class fixes below were needed only to get the double-fault case's OWN test code (not production code) working, and are recorded as issues encountered rather than plan deviations since no production file was touched and no plan instruction was contradicted.

## Issues Encountered

- The double-fault case's first draft chmod'd `sources-staging/` inside `onClone` on BOTH the first (standalone) and second (orchestrated) `addMarketplace` calls, but never restored it between them. Since `path.dirname(stagingDir)` is the same fixed `sources-staging/` root regardless of the per-call random UUID subdirectory, the second call's own clone-time `mkdir` failed with EACCES before recognition ever ran, misclassifying the case as `{unparseable}`. Fixed by adding `await chmod(stagingRoot, 0o755)` between the two acts, immediately before the second `createGitOps()` call.
- Confirmed empirically (not assumed) that `fs.rm(dir, {recursive:true,force:true})` against a directory whose PARENT is chmod'd `0o555` deletes the directory's children (which stay writable) but fails EACCES on the final `rmdir`, leaving the leftover directory present but empty -- this is why repeating a failed MA-14 add is safe: the second call's `pathExists(finalDir)` still reports `true` and the canned `listRemotesResult` (not a real fs read) reproduces the identical origin match.

## User Setup Required

None - no external service configuration required.

## Verification

- `node --test tests/orchestrators/marketplace/add.test.ts` -- `tests 79`, `pass 79`, `fail 0`, no `blocked unplanned remote` line, no `✖` line.
- `npx tsc --noEmit` -- exit 0.
- `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- `Direct coverage passed: branches 143/143, functions 16/16, lines 996/996`, exit 0, no new `scripts/test-coverage-direct.pin.json` row (`git status --short` on that file is empty).
- `npm run test:coverage:unit; echo "COVERAGE_EXIT=$?"` -- `COVERAGE_EXIT=0`, `all files | 100.00 | 100.00 | 100.00` with an empty uncovered-lines cell on every `extensions/` row.
- `npm run lint`, `npm run format:check`, `npx tsc --noEmit`, `npm run fallow` (`FALLOW_EXIT=0`, pre-existing dupes only), `npm run lint:type-members` (4 pre-existing exceptions, unchanged), `npm run test:corresponding` -- all exit 0.
- `pre-commit run --files tests/orchestrators/marketplace/add.test.ts` -- every hook passed except `TruffleHog`, which failed with `error preparing repo: failed to read index file: open .../.git/index: not a directory` -- the documented spurious worktree failure (this checkout's `.git` is a file, not a directory), not a real finding. Skipped per that precedent.
- `git diff --name-only -- extensions/` across both commits -- empty. No production file changed.

## Next Phase Readiness

Plan 03 (wave 3) is unblocked: the milestone's whole gate surface is green (`npm run check`-equivalent commands above all exit 0) at this plan's boundary, so plan 03 can proceed straight to its three milestone-closing obligations (SC5 autoupdate-cascade fix, SC6 canary carry-forward, SC7 PROJECT.md amendment) without absorbing any residual red from this plan. No blockers.

## Threat Flags

None. T-3-05 (spoofed origin) and T-3-06 (partially-removed destination recorded in state) from this plan's own threat model are both exercised directly by the new cases rather than merely asserted: every near-miss origin shape (prefix-adjacent, case-differing, ssh-form, garbage, empty) is proven to refuse, and both MA-14 cases read `loadState(...)` directly to confirm no entry is written for a partially-removed tree. No new network endpoint, auth path, or schema change was introduced -- this plan adds test surface only.

---
*Phase: 03-marketplace-add-recovers-from-its-own-leftover-clone*
*Completed: 2026-09-27*

## Self-Check: PASSED

`tests/orchestrators/marketplace/add.test.ts` and this SUMMARY.md verified present on disk; both task commits (`fa9ea5ea`, `c74861a2`) verified present in `git log --oneline --all`. `npx tsc --noEmit`, `node --test tests/orchestrators/marketplace/add.test.ts`, `npm run lint`, `npm run format:check`, `npm run lint:type-members`, `npm run fallow`, `npm run test:corresponding`, and `npm run test:coverage:unit` all re-ran green (or unchanged) at this plan's final HEAD.
