---
phase: 07-marketplace-repo-tag-resolution
plan: 03
subsystem: documentation
tags: [documentation, architecture-gate, dependency-resolution, marketplace, path-source]

requires:
  - phase: 07-marketplace-repo-tag-resolution
    provides: "plan 07-01's path-source tag resolution (TAGS-01/TAGS-03) and plan 07-02's no-match fallback (TAGS-02) and the `dependency current copy` closed-set reason token, both of which this plan's doc rewrite describes"
provides:
  - "DIVG-01: docs/dependency-resolution.md states that upstream accepts a `sha` field on a dependency element and that this extension refuses it (D-03-36)"
  - "docs/dependency-resolution.md's resolution sections describe the shipped TAGS-01/02/03 behavior instead of the pre-phase-7 wildcard-only claim"
  - "a second architecture-gate half in tests/architecture/dependency-doc-agreement.test.ts that drives composeCascadeMemberRows and pins the fallback prose and the sha-divergence stem to the document"
affects: []

actuals:
  tokens: 3104
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Doc-agreement gate extended past its original failure-table scope: the same DRIVE-the-real-composer discipline (never compare a list to itself) now also covers a non-failure row's reasons and a specific subsection heading, proven by an explicit RED run against the pre-Task-1 document content."

key-files:
  created: []
  modified:
    - docs/dependency-resolution.md
    - tests/architecture/dependency-doc-agreement.test.ts

key-decisions:
  - "The rewritten fallback subsection states explicitly that the fallback applies only to path-source dependencies, and that a git-backed dependency with no satisfying tag still fails with `{no matching version}` -- added beyond the plan's literal action text to prevent a reader from concluding the fallback is universal, since the failure table (left untouched) still lists that reason for git-backed sources."

requirements-completed: [DIVG-01]

coverage:
  - id: D1
    description: "docs/dependency-resolution.md states that upstream accepts a sha field on a dependency element (Claude Code accepts a `sha` field) and that this extension refuses it with `{invalid manifest}` (D-03-36)"
    requirement: "DIVG-01"
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#DIVG-01 the plugin-declares section names the sha divergence from upstream"
        status: pass
    human_judgment: false
  - id: D2
    description: "docs/dependency-resolution.md describes path-source tag resolution: local, network-free tag listing against the marketplace clone, highest-satisfying-tag materialization, and the no-match fallback to the marketplace's current copy, checked afterward by the load-time check rather than failing"
    requirement: "DIVG-01"
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#DIVG-01 the resolution section names every reason the fallback row carries"
        status: pass
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#DIVG-01 the resolution section carries the exact fallback subsection heading"
        status: pass
    human_judgment: false
  - id: D3
    description: "The document no longer claims a path source can satisfy no constraint but the wildcard, and the pre-existing failure-table gate stays green with the table itself byte-unchanged"
    requirement: "DIVG-01"
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#RESV-06 the failure table names every reason the cascade stamps, and no others"
        status: pass
    human_judgment: false

duration: ~1h
completed: 2026-09-19
status: complete
---

# Phase 07 Plan 03: Marketplace-repository tag resolution -- documentation Summary

**`docs/dependency-resolution.md` now describes the path-source tag resolution and no-match fallback Phases 7-01/7-02 shipped, states that Claude Code accepts a `sha` field this extension refuses (DIVG-01), and a new architecture-gate half pins the fallback prose to the real `composeCascadeMemberRows` output.**

## Performance

- **Duration:** ~1h
- **Tasks:** 2 (both `type="auto"`, Task 2 `tdd="true"`)
- **Files modified:** 2

## Accomplishments

- **DIVG-01**: `docs/dependency-resolution.md`'s "What a plugin declares" section now states, immediately before the existing refusal sentence, that Claude Code accepts a `sha` field on a dependency element and pins to it; this extension refuses the field instead and fails with `{invalid manifest}` (D-03-36) -- unchanged.
- **Resolution rewrite**: "How a constrained dependency is resolved" now splits the tag-list read by source kind -- a git-backed dependency's own repository, read over the network (the one network call, NFR-5/D-03-03, unchanged); a path-source dependency's marketplace clone, read locally with no network call at all (TAGS-01).
- **Fallback subsection replaced**: "Only a git-backed dependency can be version-constrained" (the section DIVG-01 targeted as now-false) is replaced by "### When no tag satisfies the constraint", describing TAGS-01/02/03: the highest satisfying tag is materialized and its files replace the marketplace's current checkout; when none satisfies, the install proceeds with the marketplace's current copy, the row reads `{dependency current copy}`, and the [load-time check](../../../docs/dependency-resolution.md#the-load-time-check) is what decides afterward whether the fallback copy is actually out of range (D-07-03). The subsection also states plainly that this fallback is path-source-only -- a git-backed dependency with no satisfying tag still fails with `{no matching version}`, so the untouched failure table stays accurate.
- **The wildcard-only claim is gone**: no sentence in the document any longer says a path source can satisfy no constraint but the wildcard.
- **A pointer sentence** in "What a version constraint can say" sends the reader to the resolution section now that the answer differs by source kind.
- **New gate cases**: three cases added to `tests/architecture/dependency-doc-agreement.test.ts`, each observed RED against the pre-Task-1 document before Task 1's rewrite made them pass (see "Task-2 TDD evidence" below):
  - drives `composeCascadeMemberRows` with an `installed` member carrying `fellBackToCurrentCopy: true`, and asserts every reason on that row (`dependency current copy`) appears in the "How a constrained dependency is resolved" section text
  - asserts the fallback subsection heading reads exactly `### When no tag satisfies the constraint` (equality, not containment, so a rename or typo names itself in the failure diff)
  - asserts "What a plugin declares" contains the literal stem `Claude Code accepts a`
  - each section read carries a `section.length > 200` sanity floor before its containment/equality assertion, mirroring the existing failure-table case's `documented.length > 5` floor

## Task Commits

1. **Task 1: Rewrite the resolution sections and record the `sha` divergence** - `ccfadb0d` (docs)
2. **Task 2: Bind the fallback prose to the reason the composer stamps** - `8de8524f` (test)

**Plan metadata:** committed alongside this SUMMARY (docs); per worktree isolation this plan does not touch STATE.md/ROADMAP.md.

## Files Created/Modified

- `docs/dependency-resolution.md` -- the `sha`-field divergence sentence (a); the pointer sentence in "What a version constraint can say" (b); the two-source-kind split of the tag-list read (c); "Only a git-backed dependency can be version-constrained" replaced wholesale by "### When no tag satisfies the constraint" (d). The `## Why a dependency can fail` table is byte-identical to before this plan's commit -- confirmed by `git diff` showing no hunk touching that heading or any row beneath it. Final `### ` heading count: 1 (same as before -- one subsection replaced, none added or lost).
- `tests/architecture/dependency-doc-agreement.test.ts` -- three new `test(...)` cases (see Accomplishments), a `CascadeMsg` type import, and one new module-header paragraph recording what the DIVG-01 half of the gate now guards, following the header's existing convention of naming the specific prose-versus-code drift each half exists to catch.

## Decisions Made

- The rewritten fallback subsection states explicitly, in its own first sentence, that the fallback is path-source-only and that a git-backed dependency with no satisfying tag still fails with `{no matching version}`. This is not literally required by the plan's action text, but without it a reader could plausibly conclude from the new subsection alone that the fallback now applies to every constrained dependency, when the (deliberately untouched) failure table still lists `{no matching version}` as a live git-backed outcome. Documented here as a clarity addition rather than a deviation, since it does not touch any gate-checked artifact (the failure table stays byte-identical) and directly serves DIVG-01's own "no reader is left with a definitively false or misleading takeaway" goal.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the one addition beyond the literal action text (see "Decisions Made" above) is a clarity choice within Claude's Discretion for DIVG-01's exact wording, not a deviation from a stated requirement.

## Task-2 TDD evidence

Per the plan's requirement that each new case be observed RED against the pre-Task-1 document:

- **Method used:** scratch-copy revert. Backed up the post-Task-1 working file (`cp docs/dependency-resolution.md <scratchpad>/dependency-resolution.post-task1.md`), materialized the pre-Task-1 content via `git show HEAD^:docs/dependency-resolution.md > docs/dependency-resolution.md` (overwriting the tracked file's working-tree content only, no commit), ran `node --test tests/architecture/dependency-doc-agreement.test.ts`, confirmed all three new cases failed with informative diffs (`dependency current copy` present in the row's reasons but absent from the section text; the found heading was the old `### Only a git-backed dependency can be version-constrained` instead of the expected new one; the "What a plugin declares" section lacked the `Claude Code accepts a` stem) while the three pre-existing `RESV-06` cases stayed green throughout, then restored the tracked file with `git checkout -- docs/dependency-resolution.md` (a targeted single-file restore of the plan's own prior commit, not a blanket reset).
- After restoring, re-ran the file: all 6 tests (3 pre-existing + 3 new) pass.

## Verification

- `node --test tests/architecture/dependency-doc-agreement.test.ts`: 6/6 pass (test count increased by exactly 3, from 3 to 6, per Task 2's `<verify>` requirement).
- `npx prettier --check docs/dependency-resolution.md tests/architecture/dependency-doc-agreement.test.ts`: clean.
- `npx tsc --noEmit -p .`: clean (aside from a pre-existing, environment-only `@types/semver` gap closed by a plain `npm install` that touched no lockfile -- see "Issues Encountered").
- `npm run lint`, `lint:workflows`, `lint:workflows:negative`: all pass.
- `npm run fallow`: 0 issues above threshold; duplicated-lines count (1,148 lines / 1.3%) unchanged from plan 07-01's own measurement -- this plan added no new duplication.
- `npm run test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`: all pass.
- `npm test`: 6,709/6,709 pass (up from 6,706 before this plan, +3 exactly matching the new gate cases).
- `npm run test:coverage:direct:commit`: exits 0, reporting the same 3 PRE-EXISTING pinned shortfalls this phase's prior plans already documented (`domain/alpha.ts`, `domain/beta.ts`, `install-outcome.ts`) -- unchanged by this plan's test-only, non-production-code diff.
- `npm run test:integration`: 35/35 pass.
- `npm run format:check` (repo-wide): fails on the SAME pre-existing `.planning/HANDOFF.json` violation plans 07-01 and 07-02 already documented in `deferred-items.md` -- confirmed unmodified (`git status --short .planning/HANDOFF.json` shows nothing; `git log` shows it predates this phase). Scoped `prettier --check` on this plan's own two files (above) is clean.

## Issues Encountered

- **Pre-existing `npm run check` failure unrelated to this plan**: same `.planning/HANDOFF.json` `format:check` violation documented in `deferred-items.md` since plan 07-01. No new entry needed; the existing entry already covers it.
- **Missing `@types/semver` in this worktree's `node_modules`**: `npx tsc --noEmit -p .` initially reported `TS7016` for `domain/dependency-range.ts` and `domain/release-tag.ts` (both pre-existing files, untouched by this plan) because `node_modules/@types/semver` was absent despite being a committed `devDependency`. Ran a plain `npm install` (no `package.json`/lockfile changes resulted -- confirmed via `git status --short`), which populated it from the committed lockfile. This matches the exact environment note plan 07-02's SUMMARY already recorded for a fresh worktree.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- DIVG-01, TAGS-01, TAGS-02, and TAGS-03 are all complete as of this plan; `REQUIREMENTS.md` marking is deferred to the orchestrator per this plan's worktree-isolation instructions (no STATE.md/ROADMAP.md/REQUIREMENTS.md writes from this agent).
- Phase 07 has no further plans naming this documentation as a dependency (`affects: []`); the doc-agreement gate now covers both the failure table (RESV-06, pre-existing) and the resolution/declaration sections (DIVG-01, this plan), so a future change to either the fallback token or the sha-refusal sentence will fail this same gate before it can silently drift from the document again.

## Self-Check: PASSED

Verified via `git log --oneline`: commits `ccfadb0d` and `8de8524f` are present. Verified via `git diff --diff-filter=D --name-only` across both commits: no unexpected file deletions. Verified via `git status --short`: working tree clean before writing this SUMMARY. Both modified files confirmed present on disk with the expected content via the diffs and grep checks run during Task 1's acceptance-criteria verification.

---

*Phase: 07-marketplace-repo-tag-resolution*
*Plan: 03*
*Completed: 2026-09-19*
