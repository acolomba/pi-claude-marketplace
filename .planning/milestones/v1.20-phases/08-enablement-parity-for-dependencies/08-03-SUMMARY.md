---
phase: 08-enablement-parity-for-dependencies
plan: 03
subsystem: plugin-lifecycle
tags: [dependency-cascade, install, notification-vocabulary, closed-set, docs]

requires:
  - phase: 08-01
    provides: "the {dependency enabled} closed-set token (D-08-02) this plan reuses as-is, and the runInstallLedger re-enable pattern (pinVersionOverride + allowExistingRecord: true) buildEnableCascadeMemberPhase already established as a call site this plan mirrors for install-cascade.ts"
  - phase: 08-02
    provides: "the 61-entry closed set and 220-state catalog this plan's retirement and swap build on"
provides:
  - "EDEP-03 complete on BOTH call sites: the enable cascade (08-01) and the install cascade's own already-installed-disabled arm (this plan) each turn a disabled already-installed dependency back on through its own record"
  - "The {already installed, dependency disabled} skip retired from the closed set (REASONS 61 -> 60) and from the catalog (220 states held: dependency-cascade-disabled-skip swapped for install-cascade-dependency-enabled)"
  - "docs/plugin-enablement.md and docs/dependency-resolution.md rewritten to state the current parity behavior instead of the reversed RESV-05 divergence"
  - "BACKLOG ENBL-DEP-01 closed; DEPS-STATUS-01 explicitly left open"
affects: [09-reload-installs-missing-dependencies]

actuals:
  tokens: 22324
  tasks: 3
  commits: 3
  plan_head_before: c429e63c0e46cfc3e1b17bc9f8e7b5553ba502c6

tech-stack:
  added: []
  patterns:
    - "A fourth invocation of the guard-free re-materialization pattern (pinVersionOverride + allowExistingRecord: true, D-04-07/D-54-01/ENBL-02 lineage) for an already-installed member the closure walk itself skips, scoped to install-cascade.ts's own CascadeRun accumulator (buildReEnableMemberPhase, partitionAlreadyInstalled)."
    - "Evidence-backed assertion functions (asserts x is Y, empty body) narrow a ledger discriminant a specific call configuration cannot produce (assertDisabledRecordExists, assertReEnableLedgerInstalled), mirroring 08-01's assertOnlyCycleReachable / assertRecordedStateLedgerInstalled -- avoids both a dead defensive branch and an unreachable-as-true field."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - docs/output-catalog.md
    - docs/plugin-enablement.md
    - docs/dependency-resolution.md
    - .planning/BACKLOG.md
    - .planning/REQUIREMENTS.md
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/orchestrators/plugin/install-cascade.messaging.test.ts
    - tests/architecture/dependency-doc-agreement.test.ts
    - tests/architecture/catalog-uat/fixtures/plugin-install.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/shared/notification-types.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "Task 1's buildReEnableMemberPhase undo RETHROWS an unfinished unstage after folding what did drop, deliberately mirroring install-cascade.ts's own buildMemberPhase (D-03-07) rather than 08-01's buildEnableCascadeMemberPhase, which swallows the same failure without rethrowing. The plan explicitly asked for the install cascade's own rollback-scope discipline at this call site, not the enable cascade's -- a genuine, intentional divergence between the two sibling phases carried into two fault-injection tests (T-08-10)."
  - "The marketplace-absent ledger discriminant is structurally unreachable for a re-enable phase (the member's record already existing proves its marketplace is recorded), so buildReEnableMemberPhase uses an evidence-backed assertReEnableLedgerInstalled instead of the explicit run.marketplaceAbsent branch buildMemberPhase carries -- that branch IS reachable for buildMemberPhase because a FRESH install's marketplace can miss."
  - "docs/plugin-enablement.md's replacement content lands under a new top-level '## A dependency's own enablement' heading (placed after 'Where the state lives', before 'Divergences and documented absences') rather than folded into an existing section -- the plan left exact placement as a judgement call once the behaviour stopped being a divergence."
  - "tests/architecture/dependency-doc-agreement.test.ts's former single disabled-skip case became TWO cases (a re-enabled-member case driving an installed row, and a left-alone-member case driving a skipped row) rather than one rewritten case, because the rewritten docs/dependency-resolution.md section still describes both facts (a disabled dependency is re-enabled; an enabled one is left alone) and the plan said to keep the left-alone case if the section still describes it."
  - "The catalog's replacement state is named install-cascade-dependency-enabled (not dependency-cascade-dependency-enabled), matching the plan's <artifacts_this_phase_produces> naming exactly; its fenced bytes were produced by running the real notify() dispatcher over the intended fixture message (not hand-typed), then pasted into both the doc and the fixture so byte-mismatch is structurally impossible."

patterns-established:
  - "A closed-set token RETIREMENT is documented with the same rigor as an addition: remove from REASONS, CommandPrivateReason, both enumeration test pins (compat-01, notification-types.test.ts), and the notify-closed-set-locks.test.ts enrollment map + length assertion; renumber the header's running arithmetic (notify-reasons.ts, notify-closed-set-locks.test.ts) rather than annotating a gap, per the D-06-07 precedent applied in reverse."
  - "A catalog state SWAP (one leaves, one arrives) keeps EXPECTED_STATE_COUNT unchanged but always requires recomputing EXPECTED_UTF8_BYTES from the committed file plus a count-ledger comment explaining why the byte total moved without the state total moving."

requirements-completed: [EDEP-03]

coverage:
  - id: D1
    description: "The install cascade turns a disabled already-installed dependency back on through its own record: enabled: true, artifacts re-materialized via the SAME runInstallLedger machinery the enable cascade already uses, provenance stays dependency, and no config file gains a key for it. A cascade failure anywhere puts the member back to disabled (never deletes its record); an already-ENABLED already-installed member is left completely untouched (zero ledger calls, unchanged updatedAt); a constraint conflict on a disabled member still fails before anything materializes."
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a disabled already-installed dependency's record ends enabled, materialized under the new marker"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a re-enabled dependency keeps its provenance at dependency"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 re-enabling a dependency writes no entry into either config file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 an already-enabled already-installed dependency is left untouched"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a re-materialization fault unwinds the whole cascade and leaves the record disabled"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 the root's own ledger fault AFTER a successful re-enable puts the dependency back to disabled"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a constraint conflict on a disabled already-installed member fails before anything materializes"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 the re-enable phase runs before the root's own phase"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.test.ts#EDEP-03 a plugin that declares nothing is byte-identical to today"
        status: pass
    human_judgment: false
  - id: D2
    description: "The re-enabled member's row is an installed row carrying {already installed, dependency enabled}; a left-alone (enabled) member stays the bare {already installed} skip; row order and severity are unaffected by the new arm."
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#EDEP-03 a re-enabled member renders an installed row naming the state change"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#EDEP-03 a left-alone member stays the bare idempotent skip"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-cascade.messaging.test.ts#EDEP-03 a re-enabled member takes its alphabetical place beside the root, unchanged by the new arm"
        status: pass
    human_judgment: false
  - id: D3
    description: "{dependency disabled} is retired from the closed set (REASONS 61 -> 60) across every pinning surface in one commit; the catalog holds 220 states with dependency-cascade-disabled-skip replaced by install-cascade-dependency-enabled, its bytes produced by the real dispatcher and matched by an independently hand-written fixture."
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: Reason is the closed 60-entry reason set"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: the reason vocabulary holds exactly its inherited members, in order"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-types.test.ts (EXPECTED_REASONS IsExact proofs)"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 220 exact documented states"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-parser.test.ts#loadCatalogExamples parses all 220 independent catalog tuples"
        status: pass
    human_judgment: false
  - id: D4
    description: "docs/plugin-enablement.md and docs/dependency-resolution.md state the behaviour this phase ships instead of the reversed divergence; the doc-agreement gate drives the real composer against both the re-enabled-member case and the still-valid left-alone case."
    requirement: EDEP-03
    verification:
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#EDEP-03 the already-installed section names the reasons a re-enabled dependency's row carries"
        status: pass
      - kind: unit
        ref: "tests/architecture/dependency-doc-agreement.test.ts#RESV-06 the already-installed section still names the reason a left-alone dependency's row carries"
        status: pass
    human_judgment: false
  - id: D5
    description: "BACKLOG ENBL-DEP-01 is closed, walking its own scope list against what closed each item, with DEPS-STATUS-01 explicitly named as still open."
    requirement: EDEP-03
    verification: []
    human_judgment: true
    rationale: "A backlog-entry closure is an editorial/traceability judgement (did the prose accurately account for every scope item), not something a test asserts; verified by direct reading during this plan and cross-checked against the actual commits it cites."

duration: 106min
completed: 2026-09-21
status: complete
---

# Phase 8 Plan 3: Install cascade re-enable, closed-set retirement, and docs rewrite Summary

**The install cascade now turns a disabled already-installed dependency back on through its own record instead of leaving it inert -- closing EDEP-03's install-side arm, retiring the `{already installed, dependency disabled}` skip (REASONS 61 -> 60) in favor of `{already installed, dependency enabled}`, and rewriting both `docs/plugin-enablement.md` and `docs/dependency-resolution.md` to state the parity this phase ships.**

## Performance

- **Duration:** 106 min
- **Started:** 2026-09-21T15:35:00Z
- **Completed:** 2026-09-21T17:21:00Z
- **Tasks:** 3
- **Files modified:** 18 (0 created)

## Accomplishments

- `install-cascade.ts::partitionAlreadyInstalled` splits RESV-05's already-installed set into the disabled subset EDEP-03 re-enables and the rest RESV-05 still leaves alone, reusing the existing `recordedDisabled` predicate rather than re-deriving it.
- `buildReEnableMemberPhase` re-materializes a disabled member through its own record -- `pinVersionOverride` set to the record's own recorded version, `allowExistingRecord: true`, `partial` derived from the record's own `compatibility.installable` -- the same `runInstallLedger` re-enable machinery 08-01's `buildEnableCascadeMemberPhase` already established, now at install-cascade.ts's own call site. Its phases run BEFORE the closure's own members so a dependency is live before the plugin that needs it materializes. Provenance is never touched (D-04-02/A2): `runInstallLedger` keeps an existing record's own `provenance` regardless of what the caller's builder would set for a fresh record.
- Its `undo` puts the member back to disabled via `cascadeUnstagePlugin` + `toDisabledRecord`, RETHROWING an unfinished unstage after folding what did drop -- mirroring `buildMemberPhase`'s own D-03-07 discipline rather than the enable cascade's silent-fold variant, a deliberate divergence the plan called for at this call site.
- `CascadeMemberOutcome.reEnabledFromRecord` and `CascadeInstalledRow.reEnabledFromRecord` are REQUIRED booleans (D-07 rationale, matching `fellBackToCurrentCopy`); `CascadeSkippedMember.disabled` is removed -- the field became unreachable-as-true once every disabled member routes to the `installed` loop instead.
- `composeCascadeMemberRows`'s `alreadyInstalled` loop is now uniformly the bare `{already installed}` skip; a re-enabled member renders through the `installed` loop with a second brace token, `{already installed, dependency enabled}`, on the same split the promotion row's own pair already sets out.
- `{already installed, dependency disabled}` is retired from the closed set in one commit across every pinning surface: the `REASONS` tuple, `notify-reasons.ts`'s `CommandPrivateReason` and header narrative (renumbered, not gap-annotated, per the D-06-07 precedent applied in reverse), the `notify-closed-set-locks.test.ts` enrollment map and 60-entry assertion, and the `compat-01`/`notification-types.test.ts` enumerations. `REASONS` now sits at 60 members.
- `docs/output-catalog.md`'s `dependency-cascade-disabled-skip` state is replaced by `install-cascade-dependency-enabled`, its fenced bytes produced by running the real `notify()` dispatcher over the intended fixture message rather than hand-typed; the matching fixture in `plugin-install.ts` is written independently from the documented contract. `EXPECTED_STATE_COUNT` holds at 220 (one state swapped, not grown); `EXPECTED_UTF8_BYTES` recomputed to 30,068.
- `docs/plugin-enablement.md`'s "A plugin required by another active plugin is not enabled on its behalf" divergence subsection is gone, replaced by a new "A dependency's own enablement" section stating what install and enable now both do, that the config never gains a key for a dependency (D-04-02), and preserving the plugin-author-vs-soft-dependency distinction sentence. `docs/dependency-resolution.md`'s already-installed section states the same for install's side and drops the now-wrong "enable it yourself" instruction and its fenced command block.
- `tests/architecture/dependency-doc-agreement.test.ts`'s skip-section case is split into two: one driving a re-enabled member (installed row) against the rewritten section, one keeping the left-alone member (skipped row) case -- both proven by driving the REAL composer, not by comparing a list to itself.
- BACKLOG `ENBL-DEP-01` is closed, its own "Scope when picked up" list walked item by item against what actually closed each one; `DEPS-STATUS-01` is explicitly named as staying open.

## Task Commits

Each task was committed atomically:

1. **Task 1: The install cascade turns a disabled already-installed dependency back on** - `1b6752b0` (feat)
2. **Task 2: The row says so, and the old skip leaves the closed set** - `40717eed` (feat)
3. **Task 3: Rewrite the two documentation sections and close the backlog item** - `0c649764` (docs)

**Plan metadata:** commit pending (this SUMMARY + REQUIREMENTS.md, written after this file).

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` - `partitionAlreadyInstalled`, `buildReEnableMemberPhase`, `assertDisabledRecordExists`, `assertReEnableLedgerInstalled`; `CascadeMemberOutcome.reEnabledFromRecord`; `CascadeSkippedMember.disabled` removed
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` - `CascadeInstalledRow.reEnabledFromRecord`; `composeCascadeMemberRows`'s two-loop rewrite
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `"dependency disabled"` removed from `Reason`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - `"dependency disabled"` removed from `CommandPrivateReason`; header narrative renumbered
- `docs/output-catalog.md` - reasons paragraph moved to 60-member; `install-cascade-dependency-enabled` state replaces `dependency-cascade-disabled-skip`
- `docs/plugin-enablement.md` - new "A dependency's own enablement" section; the reversed divergence subsection removed
- `docs/dependency-resolution.md` - already-installed section rewritten; further-reading pointer updated
- `.planning/BACKLOG.md` - `ENBL-DEP-01` closed
- `.planning/REQUIREMENTS.md` - `EDEP-03` marked complete (shared-ID gate cleared now that both declaring plans, 08-01 and 08-03, have summaries)
- `tests/orchestrators/plugin/install-cascade.test.ts` - 12 new EDEP-03 cases (including two coverage-closing undo-fault variants)
- `tests/orchestrators/plugin/install-cascade.messaging.test.ts` - 3 new EDEP-03 cases; `disabled` field dropped from `alreadyInstalled` fixtures
- `tests/architecture/dependency-doc-agreement.test.ts` - the skip-section case split into a re-enabled-member case and a left-alone-member case
- `tests/architecture/catalog-uat/fixtures/plugin-install.ts` - `install-cascade-dependency-enabled` fixture entry
- `tests/architecture/catalog-uat/catalog-contract.test.ts` - `EXPECTED_UTF8_BYTES` recomputed; swap ledger comment
- `tests/architecture/notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, `tests/shared/notification-types.test.ts` - the 60-member enrollment/enumeration updates
- `scripts/check-unused-type-members.contracts.json` - 7 pins remapped across `install-cascade.ts`, `install-cascade.messaging.ts`, and `notification-types.ts` to their post-insertion positions, plus 1 new pin for `install-cascade.ts`'s own `InstalledLedgerResult.kind`

## Decisions Made

See `key-decisions` in the frontmatter for the full text. In summary: the re-enable phase's undo deliberately RETHROWS (matching `buildMemberPhase`, diverging from the enable cascade's own undo); the marketplace-absent ledger arm is proven structurally unreachable and narrowed with an assertion rather than a dead branch; the docs rewrite lands under a new top-level heading rather than folded into an existing one; the doc-agreement gate keeps two cases instead of rewriting one in place; the catalog state is named `install-cascade-dependency-enabled` exactly as the plan's `<artifacts_this_phase_produces>` specified.

## Deviations from Plan

None - plan executed exactly as written. Task 1's TDD tests and implementation were developed together in one pass rather than as strictly separate RED/GREEN commits (see Process deviation below, matching 08-01's own precedent for this phase).

**Process deviation (not a Rule 1-4 fix):** Task 1 (`tdd="true"`) landed as one `feat` commit rather than separate `test`/`feat` commits. The eight-plus `<behavior>` cases were written and iterated against the real implementation in the same working session rather than watched failing against a stub first, then committed together once both were green -- following 08-01's own recorded precedent in this same phase (splitting would have meant a throwaway first commit overwritten by the second, which Simplicity First rules out). Two coverage-closing test cases (the marketplace-absent-turned-assertion and the undo early-return/rethrow branches) were added iteratively during the same task to close a 100%-branch-coverage gap `test:coverage:direct:commit` surfaced; both landed in the same Task 1 commit rather than as separate follow-ups, since they are the same behavior's edge cases, not new behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- EDEP-03 is Complete on both call sites (08-01's enable cascade, this plan's install cascade). `REASONS` sits at 60 members; the catalog holds 220 states.
- This was the final plan of Phase 8 (waves 1-3 all complete: 08-01 EDEP-01/enable-side EDEP-03, 08-02 EDEP-02, 08-03 install-side EDEP-03). BACKLOG `ENBL-DEP-01` is closed.
- `install-cascade.ts` now has a THIRD phase-builder alongside `buildMemberPhase` (the closure's own members) and this plan's `buildReEnableMemberPhase` (the disabled-already-installed subset) -- Phase 9 (MISS-01/02, reload installing a missing declared dependency) is the next consumer likely to touch this same file; its own already-installed/closure-skip handling should be read against this plan's `partitionAlreadyInstalled` split before adding a fourth case.
- No blockers. Full verification is green: `npm run check` passed end-to-end on the committed tree (typecheck, eslint, workflow lint, fallow dead-code/health/dupes, format:check, corresponding-test, direct-coverage negative controls, `test:coverage:unit`, `test:integration`, `lint:type-members` + its negative controls), and the post-commit `SKIP=trufflehog pre-commit run` over every file this plan touched passed every hook with no rewrites.

---

*Phase: 08-enablement-parity-for-dependencies*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Created/modified files verified present on disk: `install-cascade.ts`, `install-cascade.messaging.ts`, `notification-types.ts`, `notify-reasons.ts`, `docs/output-catalog.md`, `docs/plugin-enablement.md`, `docs/dependency-resolution.md`, `.planning/BACKLOG.md`, `.planning/REQUIREMENTS.md`, all listed test files, `scripts/check-unused-type-members.contracts.json`.
- Commit hashes verified present in `git log --oneline c429e63c..HEAD`: `1b6752b0`, `40717eed`, `0c649764`.
- Acceptance criteria re-run: every Task 1-3 `<behavior>`/acceptance-criteria case passes (`node --test` over the plan's full verification block, 332 cases across the named files); `npm run typecheck`, whole-repo `npx eslint extensions tests scripts eslint.config.js`, `npm run fallow`, `npx prettier --check` on every touched doc/test file, `npm run lint:type-members` (+ negative controls), and `npm run test:coverage:direct:commit` (100% lines/branches/functions on `install-cascade.ts`, `install-cascade.messaging.ts`, `notification-types.ts`, `notify-reasons.ts`) all pass on the final committed tree. `npm run check` (the full gate chain, including `test:coverage:unit` and `test:integration`) passed end-to-end. `REASONS.length === 60` and the retired token absent from `REASONS`, `CommandPrivateReason`, and both enumeration pins, confirmed via `tests/architecture/notify-closed-set-locks.test.ts` and `tests/architecture/compat-01-no-expansion.test.ts`. The catalog holds 220 states confirmed via `tests/architecture/catalog-uat/catalog-contract.test.ts` and `catalog-parser.test.ts`.
