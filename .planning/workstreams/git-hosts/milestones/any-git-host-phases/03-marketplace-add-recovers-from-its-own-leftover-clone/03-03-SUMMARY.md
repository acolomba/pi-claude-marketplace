---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
plan: 03
subsystem: auth
tags: [auth, autoupdate, cascade, planning-docs, gate-conformance]

requires:
  - phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
    provides: "plan 01/02's recognize-remove-rename leftover-clone guard and the closed 100%-branch gate"
provides:
  - "buildAuthForHost and buildCloneAuth accept an optional ctx; a missing ctx answers exactly like a missing provider (the graceful stored-credential decline), on ANY host including github.com/gitlab.com"
  - "update-preflight.ts's clone probe calls buildCloneAuth directly for both clone-cache arms; the local buildBundle closure and its early-undefined-return are gone"
  - "Both Phase 1 and Phase 2 live canaries carried forward with blocking reasons and resume commands in ROADMAP.md, STATE.md and BACKLOG.md (GHCAN-01, GHCAN-02)"
  - "PROJECT.md's D-79-03 row rationale rewritten to name the plugin failure grammar's missing cause-chain trailer slot"
  - "npm run check green at the phase's final HEAD: 7354/7354 unit tests, all files 100.00/100.00/100.00, 108 contract entries with 4 pre-existing exceptions, 36/36 integration tests"
affects: []

actuals:
  tokens: 9000
  tasks: 3
  commits: 2
  plan_head_before: 3a7f10dfc8907dc7c7e1e45bc773573477d25a97
  plan_head_after: 05104ea7385ec8d9e9e498213c3cad2d5675f9c3

tech-stack:
  added: []
  patterns:
    - "Widen an early-return guard to cover a second missing-input condition, rather than threading a second optional-return path through a caller: buildAuthForHost's `provider === undefined || ctx === undefined` reuses the existing graceful-decline arm verbatim."
    - "Delete-and-reuse over parallel-copy: update-preflight.ts's local buildBundle closure (an undefined-returning duplicate of buildCloneAuth) is deleted once the shared helper covers its one point of difference, rather than kept beside it."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/orchestrators/plugin/update-preflight.test.ts
    - scripts/check-unused-type-members.contracts.json
    - .planning/PROJECT.md
    - .planning/workstreams/git-hosts/ROADMAP.md
    - .planning/workstreams/git-hosts/STATE.md
    - .planning/BACKLOG.md

key-decisions:
  - "buildAuthForHost.args.ctx and buildCloneAuth.auth.ctx both become optional (`ctx?: NotificationContext`), rather than threading a ctx through the cascade. The guard widens to `provider === undefined || ctx === undefined`; the provider-found arm is untouched, so after the widened guard it can only run with ctx present and makeRawNotifyFn(ctx) never sees undefined."
  - "update-preflight.ts's local buildBundle closure is deleted outright (not kept as a thinner wrapper); both probeUnpinned and probePinned call buildCloneAuth directly and pass the result as an unconditional auth: property, since buildCloneAuth now always returns a bundle."
  - "The one preflight contract pin below the edit (update-preflight.ts:349:63, StaticPreflightRowOptions.fromVersion) is remapped to 342:63 -- a -7 line net delta from removing buildBundle and its early-return, confirmed by re-deriving the column position on the formatted tree, not by predicted arithmetic. Its refines target moves identically (349:6 -> 342:6). The two pins above the edit (138:56, 139:5) are confirmed unchanged."
  - "The D-79-03 PROJECT.md row's rationale clause only is rewritten -- 'no `onAuth` callback registered at all for no-provider hosts -- structural fail-clean' (false after Phase 1) becomes a reference to the plugin failure grammar's missing cause-chain trailer slot (install.messaging.ts), which is the reason that actually holds. The OUTCOME sentences and the table's own Outcome column are untouched."
  - "Both live canaries (Phase 1's private-repo clone, Phase 2's verbatim-only smart-HTTP server) are recorded in three places per their different audiences: STATE.md's existing Deferred Verification paragraphs (one added sentence each), a new ROADMAP.md subsection under Milestone-wide constraints, and two new BACKLOG.md entries (GHCAN-01, GHCAN-02) for post-archive visibility. Neither is attempted; neither is marked passed."

patterns-established: []

requirements-completed: [GATE-01]

coverage:
  - id: D1
    description: "The autoupdate cascade attaches a host-bound auth bundle on every host with no ctx in sight; a registry host declines the Device Flow gracefully instead of crashing on makeRawNotifyFn(undefined)"
    requirement: GATE-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#resolves the stored-credential cause for an unregistered host with no notification context"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#D-3-04: github.com with no notification context declines the Device Flow gracefully instead of crashing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#D-3-04: returns a bundle bound to the resolved host when ctx is omitted"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-preflight.test.ts#D-3-04: authenticates the autoupdate cascade against github.com with no notification context"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both live canaries carried forward with blocking reasons and resume commands; PROJECT.md's D-79-03 rationale rewritten to match the code at this HEAD"
    verification:
      - kind: other
        ref: "grep -c 'gsd-verify-work 1'/'gsd-verify-work 2' ROADMAP.md; grep -c 'structural fail-clean'/'D-79-03' PROJECT.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run check exits 0 at the phase's final, formatted, committed tree; 7354/7354 unit tests, all files 100.00/100.00/100.00, contract file at 108 entries with 4 pre-existing exceptions, both coverage-pin surfaces unchanged"
    requirement: GATE-01
    verification:
      - kind: other
        ref: "npm run check; echo CHECK_EXIT=$? -> CHECK_EXIT=0"
        status: pass
    human_judgment: false

duration: 210min
completed: 2026-09-27
status: complete
---

# Phase 3 Plan 3: The autoupdate cascade authenticates, both canaries carried forward, gate green at close

**`buildAuthForHost`'s `ctx` becomes optional so the autoupdate cascade attaches a host-bound auth bundle instead of cloning authless, both live canaries and the D-79-03 rationale are carried forward with accurate reasons, and `npm run check` exits 0 at the phase's final HEAD (7354/7354 tests, 100.00/100.00/100.00).**

## Performance

- **Duration:** ~210 min (dominated by three full `pre-commit`/`npm run check` runs against the full test suite and the 5-pass unused-type-member negative controls; no start/end timestamp captured at dispatch)
- **Tasks:** 3
- **Files modified:** 9 (5 code/test/pin files in Task 1, 4 planning documents in Task 2; Task 3 changed no files -- `npm run check` was green on its first attempt)

## Accomplishments

- `buildAuthForHost`'s `ctx` parameter becomes `ctx?: NotificationContext`; the early-return guard widens from `provider === undefined` to `provider === undefined || ctx === undefined`. The existing no-provider arm answers both conditions unchanged -- it builds its closure from `host` alone and needs no notification channel. The provider-found arm is untouched: after the widened guard it can only run with `ctx` present, so `makeRawNotifyFn(ctx)` never sees `undefined` and both registry hosts behave exactly as before.
- `buildCloneAuth`'s `auth.ctx` becomes `readonly ctx?: NotificationContext`, forwarded via conditional spread (`exactOptionalPropertyTypes` compliant). Its docstring is rewritten to name the update probe as a fifth caller sharing this one helper, replacing the sentence that described a separate local copy.
- `update-preflight.ts`'s local `buildBundle` closure -- which returned `undefined` when `auth.ctx === undefined`, the actual defect -- is deleted. `probeUnpinned` and `probePinned` call `buildCloneAuth` directly; the three `...(authBundle !== undefined && { auth: authBundle })` spreads become unconditional `auth: authBundle` properties, since `buildCloneAuth` now always returns a bundle. `buildAuthForHost` and `hostFromCloneUrl` are no longer imported in this file (replaced by `buildCloneAuth`); `DEFAULT_CREDENTIAL_OPS` stays, since it is still used elsewhere in the file.
- `update-flow.ts` is untouched, confirmed by `git diff --name-only` returning empty; its two contract pins stay at `834:42` / `915:42`.
- Both live canaries (Phase 1's private-repo clone on a non-registry host, Phase 2's verbatim-only smart-HTTP server) are carried forward in three places: STATE.md's existing Deferred Verification paragraphs each gained one sentence stating the item survives Phase 3's completion and blocks milestone close only; ROADMAP.md gained a new "Outstanding at milestone close" subsection under Milestone-wide constraints naming both canaries with their blocking reasons, resume commands (`/gsd-verify-work 1`, `/gsd-verify-work 2`) and phase directories; BACKLOG.md gained two new entries (GHCAN-01, GHCAN-02) for visibility after the workstream's documents are archived. Neither canary was attempted; neither is marked passed.
- PROJECT.md's D-79-03 row: the rationale clause "no isomorphic-git retry loop (no `onAuth` callback registered at all for no-provider hosts -- structural fail-clean)" -- false after Phase 1 registers a callback for every host -- is rewritten to name the reason that actually holds: the plugin failure grammar (`install.messaging.ts`) has no cause-chain trailer slot that renders on the subject row; that slot exists only on the update path's synthetic child row. The row's OUTCOME sentences and the table's own Outcome column (`✓ Good`) are byte-unchanged.
- `npm run format` ran first (no rewrite produced -- confirmed via `git status --short` showing no new diffs), then the whole `npm run check` ran in one command with its exit code captured into `CHECK_EXIT` and echoed on its own line: `CHECK_EXIT=0`. `test:coverage:unit` reports `all files | 100.00 | 100.00 | 100.00` across 7354/7354 passing unit tests (up from 7286 at Phase 2's close -- this phase's own new cases plus plans 01/02's), with an empty uncovered-lines cell on every row under `extensions/`. `test:integration` reports 36/36 pass. `lint:type-members` passes with the same 4 pre-existing exceptions and 108 contract entries; `lint:type-members:negative` passes all 7 of 7 controls.

## Task Commits

Each task was committed atomically:

1. **Task 1: The autoupdate cascade authenticates on every host** - `5fa8ca87` (feat)
2. **Task 2: Carry both canaries forward, and correct the D-79-03 rationale** - `05104ea7` (docs)
3. **Task 3: The whole gate surface, green, at the phase's final HEAD** - no commit (measurement only; `npm run check` was green on its first attempt, so no fix was needed and no file changed)

**Plan metadata:** commit follows this SUMMARY

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` - `buildAuthForHost`/`buildCloneAuth`'s `ctx` becomes optional; the no-provider guard widens to cover a missing ctx
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - local `buildBundle` closure deleted; both clone-cache arms call `buildCloneAuth` directly with an unconditional `auth:` property
- `tests/orchestrators/auth-host.test.ts` - two new `buildAuthForHost` cases and one new `buildCloneAuth` case proving the no-ctx graceful decline
- `tests/orchestrators/plugin/update-preflight.test.ts` - one new case proving the cascade shape (`ctx` omitted) authenticates both clone-cache arms against `github.com`
- `scripts/check-unused-type-members.contracts.json` - one pin remapped (`update-preflight.ts:349:63` -> `342:63`, and its `refines` target `349:6` -> `342:6`); entry count unchanged at 108
- `.planning/PROJECT.md` - D-79-03 row's rationale clause rewritten; outcome untouched
- `.planning/workstreams/git-hosts/ROADMAP.md` - new "Outstanding at milestone close" subsection naming both canaries
- `.planning/workstreams/git-hosts/STATE.md` - one sentence added to each Deferred Verification paragraph
- `.planning/BACKLOG.md` - GHCAN-01 and GHCAN-02 entries filed

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed an async test function with no `await` expression**
- **Found during:** Task 1 verification (the first full `pre-commit` run, `npm-lint` hook)
- **Issue:** The new `buildCloneAuth` case ("D-3-04: returns a bundle bound to the resolved host when ctx is omitted") was written as `async () => { ... }` but its body never awaits anything (`buildCloneAuth` is synchronous) -- `@typescript-eslint/require-await` failed the `npm run lint` hook with one error at `tests/orchestrators/auth-host.test.ts:1075:92`.
- **Fix:** Removed the unnecessary `async` keyword from the test's arrow function.
- **Files modified:** `tests/orchestrators/auth-host.test.ts`
- **Verification:** `npx eslint tests/orchestrators/auth-host.test.ts` exits 0; `node --test tests/orchestrators/auth-host.test.ts` -- 28/28 pass, 0 fail. Re-verified in a subsequent full `SKIP=trufflehog pre-commit run` with `npm-lint` passing clean.
- **Committed in:** `5fa8ca87` (Task 1 commit; caught and fixed before that commit was made)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, caught by the project's own lint gate before committing).
**Impact on plan:** No scope creep; the fix corrected a lint violation introduced by this plan's own new test code, with no production-code or test-semantics change.

## Issues Encountered

- **A pre-commit `npm-lint` run raced against this plan's own Task 2 edits.** The first re-verification run of the Task 1 fix (a second `SKIP=trufflehog pre-commit run`) reported `npm lint ... Failed - files were modified by this hook` with no error text, while Task 2's PROJECT.md/ROADMAP.md/STATE.md/BACKLOG.md edits were being made concurrently in the main context. This is the documented "spurious 'files were modified'" class from concurrent edits inside one working tree (not a real lint finding): a standalone `npx eslint` over the same four files returned exit 0 clean at that moment, and a THIRD `pre-commit` run -- started once Task 2's edits had settled with no further concurrent writes -- passed `npm-lint` cleanly. No code was affected; the false report is disclosed here per the plan's own verdict-integrity discipline (never certify or dismiss a result without measuring it).
- **`npm run check`'s `test:coverage:unit` step produces long stretches with no new stdout,** because `node --test`'s per-file worker processes buffer their spec-reporter output; `ps` inspection of the running child processes (which test file each worker was executing) was used to confirm forward progress rather than a hang, at several points during the ~6-minute unit-test run and the ~2-minute `test:integration` run that follows it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 is complete: all three plans executed, `npm run check` green at 7354/7354 unit tests + 36/36 integration tests with 100.00/100.00/100.00 coverage, all four Phase 3 requirements (MA-12, MA-13, MA-14, GATE-01) marked Complete in REQUIREMENTS.md. The milestone's only remaining obligations are the two live canaries (Phase 1, Phase 2), both explicitly carried forward and both blocking milestone close only -- not this phase, not any later phase. Phase 3 has had no code review and no verification yet; per STATE.md's own note, Phase 2's review found Critical findings on its first pass, so this should not be skipped before milestone close.

## Threat Flags

None. All three of this plan's own threat-model entries are mitigated as designed and verified:
- **T-3-07** (Information Disclosure -- `buildAuthForHost` invoked with no `ctx` on a registry host): the widened guard returns the no-provider bundle for that exact combination; the "D-3-04: github.com with no notification context declines the Device Flow gracefully" test asserts the resolution AND that no Device Flow HTTP collaborator was called (`deviceFlow.calls` is empty).
- **T-3-08** (Elevation of Privilege -- the newly credential-capable cascade bundle): `buildCloneAuth`'s `host` binding via `hostFromCloneUrl` is unchanged by this plan; `buildAuthCallbacks.onAuth`'s cross-host cancel guard (GAUTH-06, unchanged since Phase 1) still applies, and `tests/architecture/no-credential-leak.test.ts` ran clean as part of `npm run check`.
- **T-3-09** (Repudiation -- a completion claim from a glyph, pipeline, or subset): `FORMAT_EXIT=0` and `CHECK_EXIT=0` were both captured into named variables and echoed on their own lines from the whole composed commands, and `git status --porcelain` was checked after (see note below on the two orchestrator-owned dirty files).

---
*Phase: 03-marketplace-add-recovers-from-its-own-leftover-clone*
*Completed: 2026-09-27*

## Gate Measurement Record (verbatim echoed values)

- `npm run format; echo "FORMAT_EXIT=$?"` -> `FORMAT_EXIT=0` (no rewrite produced; `git status --short` showed no new diff from this step)
- `npm run check; echo "CHECK_EXIT=$?"` -> `CHECK_EXIT=0`
- `node -e '...contracts.json... .length'` -> `CONTRACTS=108`
- `test:coverage:unit` totals: `tests 7354`, `pass 7354`, `fail 0`; `all files | 100.00 | 100.00 | 100.00` with an empty uncovered-lines cell on every row under `extensions/`
- `test:integration` totals: `tests 36`, `pass 36`, `fail 0`
- `lint:type-members` -> "Unused type member gate passed with 4 recorded exception(s)" (the same 4 pre-existing exceptions, unchanged)
- `lint:type-members:negative` -> "Unused type member negative controls passed (7 of 7)"
- `scripts/test-coverage-direct.pin.json` -> `git diff --name-only 3a7f10df..HEAD -- scripts/test-coverage-direct.pin.json` prints nothing (unchanged by this phase)
- `git status --porcelain` at the end of this plan's own work: **two lines remain** -- `.planning/workstreams/git-hosts/config.json` and `.planning/workstreams/git-hosts/state.json` (modified) and `.planning/workstreams/git-hosts/milestone.lock` (untracked). These are the orchestrator's own dispatch artifacts, present and dirty/untracked BEFORE this plan began execution (per the dispatch prompt's own note to leave them alone) -- not touched by any task in this plan. Every file this plan's three tasks changed is committed; `git diff --stat HEAD` confirms only those same three orchestrator-owned paths remain dirty. Recorded literally, per this plan's own prohibition against certifying a result the measurement does not support.

## Self-Check: PASSED

All 9 modified files verified present on disk with the expected content; both task commits (`5fa8ca87`, `05104ea7`) verified present in `git log --oneline --all`. `npx tsc --noEmit`, the full `node --test` suites for the four directly-touched test files, `npm run lint`, `npm run format:check`, `npm run fallow`, `npm run lint:type-members`, and the complete `npm run check` (13 composed steps, `CHECK_EXIT=0`) all re-ran green at this plan's final HEAD.
