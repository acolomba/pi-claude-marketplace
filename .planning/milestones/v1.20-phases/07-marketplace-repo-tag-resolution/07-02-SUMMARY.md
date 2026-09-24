---
phase: 07-marketplace-repo-tag-resolution
plan: 02
subsystem: dependency-resolution
tags: [notification-vocabulary, dependency-resolution, marketplace, path-source, closed-set]

requires:
  - phase: 07-marketplace-repo-tag-resolution
    provides: "plan 07-01's marketplace-tag-probe.ts (probeMarketplaceTags), its no-matching-tag/tag-listing-failed interim failure arms on install-cascade.ts's path-source branch, and the ResolvedCascadeMember.pin shape this plan extends with a sibling fellBackToCurrentCopy marker"
provides:
  - "TAGS-02: a path-source dependency whose marketplace clone carries no satisfying release tag installs the marketplace's current copy instead of failing the whole cascade"
  - "the `dependency current copy` closed-set reason token (REASONS 58 -> 59), carried on an `installed` cascade row at whatever severity the companion probe computes"
  - "CascadeMemberOutcome.fellBackToCurrentCopy / CascadeInstalledRow.fellBackToCurrentCopy -- REQUIRED boolean facts a future plan can read without re-deriving them"
affects: [07-03-marketplace-repo-tag-resolution, docs/dependency-resolution.md]

actuals:
  tokens: 13348
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Non-failure fallback marker on a strict two-arm union (ResolvedCascadeMember.fellBackToCurrentCopy?: true): rather than widening MemberConstraintResolution's failure arm (which would fail the whole cascade per D-03-07's all-or-nothing rule), the fact rides an optional literal-true marker on the SUCCESS arm's member shape, mirroring the precedent CascadeSkippedMember already set for an out-of-band member fact."
    - "Required boolean on a closed row shape forces every construction site to answer it (CascadeMemberOutcome.fellBackToCurrentCopy, CascadeInstalledRow.fellBackToCurrentCopy are both non-optional), so a new fact can never go silently unreported at a hand-built test fixture."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - docs/output-catalog.md
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-cascade.messaging.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/integration/path-source-tag-install.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-install.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - tests/shared/notification-types.test.ts

key-decisions:
  - "D-07-07 implemented exactly as specified: `probeMemberPin`'s path-source branch takes the SAME fallback arm for both `no-matching-tag` and `tag-listing-failed` -- an unreadable local listing and an empty one are the same user-visible fact, and the install succeeds either way, so no transport classification rides a success row."
  - "Token spelling `dependency current copy`, per D-07-03's locked info tone and Claude's Discretion on wording -- follows the `dependency `-prefixed family (`dependency disabled`, `dependency promoted`, `dependency pruned`) already established in this file."
  - "Severity is left exactly where `companionSeverity` already puts it: the fallback token never stamps a literal severity, so a member with an unloaded companion still reports that genuine SEV-01 degradation on top of the fallback note, and a member with none stays `info`."

patterns-established:
  - "Every closed-set reason-vocabulary gate this repository owns is amended in the SAME commit as the token: REASONS length (notify-closed-set-locks.test.ts), REASONS enumeration (compat-01-no-expansion.test.ts), the catalog contract's state count and byte total (catalog-contract.test.ts, catalog-parser.test.ts), the catalog fixture and doc state, and a FIFTH gate this plan's own `npm run check` run surfaced that the plan text did not name: `tests/shared/notification-types.test.ts`'s own independent `EXPECTED_REASONS` enumeration. Recorded here so the next token addition has the full list."

requirements-completed: [TAGS-02]

coverage:
  - id: D1
    description: "A path-source dependency whose constraint no marketplace tag satisfies installs from the marketplace's current copy; the cascade succeeds, every other member installs, and the requesting plugin's install completes"
    requirement: "TAGS-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#TAGS-02 / D-07-03 a path-source member with no satisfying tag resolves anyway, with no pin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#TAGS-02 a cascade run's member outcomes carry fellBackToCurrentCopy per member"
        status: pass
      - kind: integration
        ref: "tests/integration/path-source-tag-install.test.ts#TAGS-02: a constraint no marketplace tag satisfies still installs both plugins, from the CURRENT checkout"
        status: pass
    human_judgment: false
  - id: D2
    description: "A local tag listing that cannot be read at all (throwing probe, or a marketplace root that is not a git repository) takes the SAME current-copy fallback arm as an empty or non-satisfying listing"
    requirement: "TAGS-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#TAGS-02 / D-07-07 a path-source member whose local listing THROWS resolves anyway, identically"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#TAGS-02 / D-07-07 a path-source member whose marketplace root is not a git repository resolves anyway"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fallback dependency's row is an installed-status row carrying the new closed-set reason token and nothing from the failure-reason class; the fallback contributes nothing to the row's severity on its own and never overwrites a genuine companion degradation"
    requirement: "TAGS-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#TAGS-02 / D-07-03 a member that fell back to the marketplace's current copy names it as a quiet note"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#TAGS-02 / D-07-03 the fallback never overwrites a genuine companion degradation"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#TAGS-02 a member that did NOT fall back renders byte-identically to today's row"
        status: pass
      - kind: e2e
        ref: "tests/orchestrators/plugin/install-flow.test.ts#TAGS-02 / D-07-03: an unsatisfiable path-source constraint installs the current copy, named on its own row"
        status: pass
      - kind: integration
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 218 exact documented states"
        status: pass
    human_judgment: false
  - id: D4
    description: "A dependency that fell back to the current copy resolves through the unchanged marketplaceRoot + raw branch of the resolver -- install-flow.ts is untouched, proving the pass-through relationship"
    requirement: "TAGS-02"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts (git diff --name-only against install-flow.ts across both task commits: empty)"
        status: pass
    human_judgment: false

duration: ~2h
completed: 2026-09-19
status: complete
---

# Phase 07 Plan 02: Marketplace-repository tag resolution -- fallback Summary

**A path-source dependency whose marketplace clone carries no satisfying release tag now installs the marketplace's current copy instead of failing the whole cascade, reported on the dependency's own `installed` row as a quiet `{dependency current copy}` info note -- the 59th member of the shared closed reason-token set.**

## Performance

- **Duration:** ~2h
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 15

## Accomplishments

- **TAGS-02**: `install-cascade.ts::probeMemberPin`'s path-source branch resolves both the `no-matching-tag` and `tag-listing-failed` arms as a normal member carrying `fellBackToCurrentCopy: true` and no `pin`, rather than failing the constraint step. A satisfying tag and the git-backed branch are both unaffected (07-01's behavior stands).
- **D-07-07**: one fallback arm covers an unreadable local listing (a throwing probe, or a marketplace root that is not a git repository at all) and an empty/non-satisfying one -- both are the same user-visible fact, and the install succeeds either way.
- **A new closed-set reason token**: `dependency current copy`, appended at the tail of `REASONS` (58 -> 59) and `CommandPrivateReason`'s dependency-cascade group. Carried on an `installed` row via the new REQUIRED `CascadeInstalledRow.fellBackToCurrentCopy` field; `composeCascadeMemberRows` spreads it into `reasons` only when set, and leaves `severity` exactly as `companionSeverity` computes it.
- **`CascadeMemberOutcome.fellBackToCurrentCopy`** is REQUIRED (not optional) for the same reason `CascadeInstalledRow`'s new field is: an optional member of a closed row shape compiles clean at every construction site that omits it, which is exactly how a new fact goes silently unreported.
- **`install-flow.ts` is untouched**, confirmed by `git diff --name-only` across both commits: `cascadeMembers` is a direct structural pass-through of the cascade result's `members` into `composeCascadeMemberRows`, exactly as Pattern 4 records.
- **Catalog and gate parity**: a new `docs/output-catalog.md` state (`dependency-cascade-fallback-current-copy`) and its matching fixture, produced by the real composer; every closed-set gate this repository owns moved together in the Task 2 commit (see "Gate files touched" below).
- **End-to-end proof**: `tests/integration/path-source-tag-install.test.ts` gained a real-repository case where the marketplace's only tag does not satisfy the declared constraint -- both plugins still install, the dependency's files come from the marketplace's CURRENT checkout (not the non-satisfying tag), and the rendered notification carries `{dependency current copy}`.

## Task Commits

1. **Task 1: The no-match arm becomes a resolved member, not a cascade failure** - `a9e59b21` (feat)
2. **Task 2: The fallback says so -- a new closed-set reason token on the dependency's installed row** - `f29ba8ca` (feat)

**Plan metadata:** committed alongside this SUMMARY (docs), per worktree isolation this plan does not touch STATE.md/ROADMAP.md.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` -- `ResolvedCascadeMember.fellBackToCurrentCopy?: true`; `CascadeMemberOutcome.fellBackToCurrentCopy: boolean` (required); the path-source branch of `probeMemberPin` resolves instead of failing on `no-matching-tag`/`tag-listing-failed`; `buildMemberPhase` populates the outcome field; removed the now-superseded `classifyGitTransportFailure` import (no longer reached from this branch) and the 07-01 interim comment.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` -- `CascadeInstalledRow.fellBackToCurrentCopy: boolean` (required); `composeCascadeMemberRows` spreads `["dependency current copy"]` into a fallback member's `reasons`.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` -- `dependency current copy` added to `CommandPrivateReason`'s dependency-cascade group, with the TAGS-02/D-07-03 rationale inline; narrative comment bump (58 -> 59).
- `extensions/pi-claude-marketplace/shared/notification-types.ts` -- `dependency current copy` appended at the tail of `REASONS`.
- `docs/output-catalog.md` -- new `dependency-cascade-fallback-current-copy` catalog state beside the three existing dependency-cascade states; the `dependency-no-matching-version` section's prose now notes it is reachable ONLY from a git-backed source.
- Test files: `tests/orchestrators/plugin/install-cascade.test.ts` (7 new direct unit tests for the resolution-layer fallback), `tests/orchestrators/plugin/install-cascade.messaging.test.ts` (3 new tests for the row-composition layer), `tests/orchestrators/plugin/install-flow.test.ts` (2 pre-existing tests updated for the new success behavior, 1 new regression test closing a coverage gap the behavior change opened, 1 new end-to-end row test), `tests/integration/path-source-tag-install.test.ts` (1 new real-repository end-to-end test), `tests/architecture/notify-closed-set-locks.test.ts`, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/catalog-uat/fixtures/plugin-install.ts`, `tests/architecture/catalog-uat/catalog-contract.test.ts`, `tests/architecture/catalog-uat/catalog-parser.test.ts`, `tests/shared/notification-types.test.ts`.

## Decisions Made

- D-07-07 and the token spelling are recorded above under `key-decisions`.
- Severity is deliberately never stamped as a literal on the fallback row -- `composeCascadeMemberRows` still calls `companionSeverity`, so the fallback and a genuine SEV-01 degradation compose rather than one silently overwriting the other.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two pre-existing `install-flow.test.ts` cases asserted the now-superseded whole-cascade-failure behavior**
- **Found during:** Task 1's own `<verify>` run (`node --test tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-flow.test.ts`)
- **Issue:** `RESV-03: a dependency whose constraint no release tag satisfies fails the install whole` and `RESV-03 / RESV-06: an unsatisfiable constraint names the dependency and the range` both asserted the pre-TAGS-02 failure shape for a path-source no-matching-tag case -- exactly the arm this plan's Task 1 changes to a success.
- **Fix:** Renamed and rewrote both to assert the TAGS-02 success path (install completes; the dependency's record carries its own source version, not a pin).
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** both tests pass; the full `install-flow.test.ts` suite is green.
- **Committed in:** `a9e59b21` (Task 1 commit)

**2. [Rule 3 - Blocking] Task 1's own test rewrite opened a direct-coverage gap on `install-flow.ts`'s still-live `constraint-failed` throw arm**
- **Found during:** `npm run test:coverage:direct:commit`, run as part of Task 1's own verification
- **Issue:** The two tests fixed in item 1 were the ONLY direct-file tests reaching `install-flow.ts`'s `constraint-failed` throw arm (lines 557-560). Converting them to success cases left that arm -- still reachable via a git-backed no-match, a range conflict, or an unparseable constraint -- uncovered by `install-flow.ts`'s own corresponding test file, tripping the D-08-05 shortfall-drift gate (`install-flow.ts` fell short but was not pinned).
- **Fix:** Added `RESV-03 regression: an unreadable version constraint still fails the install whole -- TAGS-02 does not touch this arm`, using an unparseable version constraint (`range-invalid`, decided in `resolveOneMember` before any tag source is resolved) rather than a path-source no-match, so the regression is independent of source kind and cannot be closed by a future TAGS-02-adjacent change.
- **Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
- **Verification:** `npm run test:coverage:direct:commit` exits 0, reporting only the three PRE-EXISTING pinned shortfalls (unrelated, documented in `scripts/test-coverage-direct.pin.json`).
- **Committed in:** `a9e59b21` (Task 1 commit)

**3. [Rule 2 - Missing Critical] A parameterized test loop's third case changed behavior under TAGS-02 and needed splitting out**
- **Found during:** manual audit of `install-cascade.test.ts`'s existing path-source coverage while writing Task 1's new tests
- **Issue:** A three-case parameterized loop (`RESV-03 a constrained dependency resolving to ${label} reports no matching tag`) bundled "a path source whose marketplace clone carries no matching release tag" alongside two genuinely-still-failing "absent tag source" cases. TAGS-02 changes only the path-source case's outcome, so leaving it in the loop would have asserted the wrong (pre-TAGS-02) result for that one case.
- **Fix:** Removed the third case from the loop (with an inline comment explaining why) and added a dedicated `TAGS-02 a path source whose marketplace clone carries no matching release tag installs anyway` test asserting the new success behavior.
- **Files modified:** `tests/orchestrators/plugin/install-cascade.test.ts`
- **Verification:** all four resulting tests (two loop cases + the new dedicated test + the updated `TAGS-02 a path-source member's local tag-listing failure resolves anyway` test) pass.
- **Committed in:** `a9e59b21` (Task 1 commit)

**4. [Rule 3 - Blocking] A fifth closed-set gate, not named in the plan, also enumerates `REASONS` independently**
- **Found during:** `npm run test:coverage:direct:commit`, run as part of Task 2's own verification (the plan's action section named `cross-surface-reason-parity.test.ts` and `notify-producer-wire-coverage.test.ts` as the two most likely additional opinions; neither had one, but a third, unnamed file did)
- **Issue:** `tests/shared/notification-types.test.ts`'s own `EXPECTED_REASONS` constant is a THIRD independent, hand-written enumeration of the closed set (beside `notify-closed-set-locks.test.ts`'s length pin and `compat-01-no-expansion.test.ts`'s ordered list), asserted via `assert.deepStrictEqual(REASONS, EXPECTED_REASONS)`. It failed with the new token present in `REASONS` but absent from its own list.
- **Fix:** Appended `"dependency current copy"` to `EXPECTED_REASONS`.
- **Files modified:** `tests/shared/notification-types.test.ts`
- **Verification:** `npm run test:coverage:direct:commit` and the full `npm test` (6,706/6,706) pass.
- **Committed in:** `f29ba8ca` (Task 2 commit)

**5. [Rule 3 - Blocking] The catalog contract's own state count and byte total, and a third parser test's hardcoded tuple count, all pin the pre-token numbers**
- **Found during:** `npm test`'s full suite run, after Task 2's catalog fixture and doc state landed
- **Issue:** `tests/architecture/catalog-uat/catalog-contract.test.ts`'s `EXPECTED_STATE_COUNT`/`EXPECTED_UTF8_BYTES` (217 / 29,652) and its own test title, plus `tests/architecture/catalog-uat/catalog-parser.test.ts`'s independent `loadCatalogExamples parses all 217 independent catalog tuples` test, all hardcode the PRE-token catalog shape and do not move with `docs/output-catalog.md` automatically.
- **Fix:** Bumped `EXPECTED_STATE_COUNT` to 218, `EXPECTED_UTF8_BYTES` to the measured 29,798 (not guessed -- computed from the actual failing-assertion diff), the contract test's own title, and `catalog-parser.test.ts`'s count and title, each with a one-line reason comment following the file's own established amendment convention.
- **Files modified:** `tests/architecture/catalog-uat/catalog-contract.test.ts`, `tests/architecture/catalog-uat/catalog-parser.test.ts`
- **Verification:** both tests pass; full `npm test` (6,706/6,706) passes.
- **Committed in:** `f29ba8ca` (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (2 Rule 3 test-behavior corrections required by Task 1's own verify, 1 Rule 2 test-loop split for accuracy, 2 Rule 3 closed-set gate closures Task 2's own `npm run check` run surfaced)
**Impact on plan:** All five are test-only corrections or additive gate/catalog updates required to make this plan's own new production behavior pass the repository's existing verification suite. No production behavior changed beyond what Tasks 1 and 2 specify. No scope creep.

## Gate files touched by this token addition (for the next token's author)

Beyond the plan's own named list (`notify-reasons.ts`, `notification-types.ts`, `docs/output-catalog.md`, `catalog-uat/fixtures/plugin-install.ts`, `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`), this addition also touched:
- `tests/shared/notification-types.test.ts` -- its own independent `EXPECTED_REASONS` enumeration (deviation 4 above)
- `tests/architecture/catalog-uat/catalog-contract.test.ts` -- `EXPECTED_STATE_COUNT` / `EXPECTED_UTF8_BYTES` (deviation 5 above)
- `tests/architecture/catalog-uat/catalog-parser.test.ts` -- its own hardcoded tuple count (deviation 5 above)

`cross-surface-reason-parity.test.ts` and `notify-producer-wire-coverage.test.ts` -- the two gates the plan flagged as "most likely" -- had NO opinion about this token; both stayed green with no edit.

## Issues Encountered

- **Pre-existing `npm run check` failure unrelated to this plan**: `.planning/HANDOFF.json` fails `format:check`'s repo-wide prettier scan, the SAME pre-existing issue 07-01's SUMMARY and `deferred-items.md` already documented (predates this plan, confirmed via `git status --short` showing it unmodified). Every other step of `npm run check` passes cleanly: typecheck, lint, lint:workflows(:negative), fallow, test:corresponding(:negative), test:coverage:direct:negative, test:coverage:direct:commit, `npm test` (6,706/6,706), and `npm run test:integration` (35/35), verified both individually and as the composed script up to the known failure point.
- **Two-commit ordering across coupled tasks**: because Task 2's messaging change is read structurally by code Task 1 introduces, and both tasks were implemented in one continuous session, verifying Task 1's commit in isolation required temporarily reverting Task 2's production and test files to their pre-plan (`git checkout HEAD --`) content, re-running Task 1's full verify suite, then restoring the Task 2 edits from a scratchpad backup before continuing. Both commits were independently confirmed green against the file set they actually contain.
- **Worktree/branch environment note**: `node_modules` did not exist in this worktree at all (unlike the parent checkout, which had a stale copy missing `@types/semver` despite it being a declared devDependency); ran `npm install` once at the start of this plan to populate it from the committed lockfile before any verification could run. No `package.json`/lockfile changes resulted.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- TAGS-02 is complete. `REQUIREMENTS.md` marking is deferred to the orchestrator per this plan's worktree-isolation instructions (no STATE.md/ROADMAP.md/REQUIREMENTS.md writes from this agent).
- Plan 07-03 (per its own PLAN.md, not read in depth here) can build on a stable `fellBackToCurrentCopy` fact at both the resolution layer (`CascadeMemberOutcome`) and the row layer (`CascadeInstalledRow`), and on the `dependency current copy` token as a full closed-set member.
- `docs/dependency-resolution.md` still describes the pre-TAGS-02 path-source failure behavior; per the phase's canonical references this doc update is explicitly plan 07-03's job (DIVG-01 and the general TAGS-02 narrative), not this plan's -- `docs/output-catalog.md` was updated here because it is the rendered-output source of truth the catalog-contract gate checks, which is a different document from `dependency-resolution.md`'s prose contract.

## Self-Check: PASSED

Verified via `git log --oneline`: commits `a9e59b21` and `f29ba8ca` are present. Verified via `git diff --diff-filter=D --name-only` across both commits: no unexpected file deletions. Verified via `git status --short`: working tree clean before writing this SUMMARY. All 15 modified files confirmed present on disk via the commit diffs above.

---

*Phase: 07-marketplace-repo-tag-resolution*
*Plan: 02*
*Completed: 2026-09-19*
