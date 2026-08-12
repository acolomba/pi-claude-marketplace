---
phase: 97-disabled-state-classification-repair
plan: 04
subsystem: reconcile
tags: [typescript, load-time-safety, backfill-guard, fixed-point, stale-comment-repair]

requires:
  - phase: 97-disabled-state-classification-repair
    plan: 01
    provides: "`isRecordedButDisabled` keyed only on `enabled` — the collapse that makes the planner's declared-disabled branch converge on a disabled partial"
  - phase: 97-disabled-state-classification-repair
    plan: 03
    provides: "the partial-capable enable branch a reconcile-driven enable now routes through"
provides:
  - "the ENBL-08 disabled-record early return in `backfillOnePluginIsolated` — no load-time path re-materializes or re-enables a plugin the user disabled"
  - "the T-97-01 regression test over a manifest-present grown-supported-set disabled partial, with the enabled-record positive control on the identical fixture"
  - "the two-pass planner fixed-point pin for a disabled partial, with bucket membership asserted by identifier"
  - "the corrected `__test_scanForceInstalledBackfills` seam comment — the retired enable-bucket precondition claim is gone"
affects: [97-05, reconcile, backfill]

actuals:
  tokens: 3373
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Positive-control-anchored guard test: the guard fixture and the control fixture differ in exactly one field, so the control is what proves the guard test's fixture would otherwise have fired"
    - "Fixture axis extension over fixture duplication: both local record factories gained one optional axis (`enabled`, `unsupported`) rather than a parallel disabled-partial twin"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/plan.test.ts

key-decisions:
  - "The guard is keyed on `!record.enabled` read directly, not on `isRecordedButDisabled`. `apply.ts` is not one of the four former definition sites the ENBL-05 drift gate polices, and the guard is a scan filter — the same shape as the `record.compatibility.installable` line immediately above it — so a bare field read keeps the two adjacent filters symmetric and readable as one unit."
  - "The guard sits AFTER the availability filter and BEFORE the WR-03 dedupe. Ordering is behaviorally free (all three return `false`), but placing it beside the other record-shape filter separates 'this record is not a candidate' from 'this load already handled it'."
  - "The regression fixture declares the plugin in the manifest. A manifest-absent record returns early inside `maybeBackfillPlugin`'s offline resolve, so a manifest-absent fixture passes with or without the guard and proves nothing; the enabled-record control on the identical tree is what makes the guard test load-bearing."
  - "The planner fixed point is proven by two `planReconcile` calls plus per-identifier bucket assertions, not by the empty-plan deep-equal alone. A future change that populated both buckets in a compensating way would defeat a lone deep-equal."
  - "`orchestrators/reconcile/README.md:34` was left alone. It is outside this plan's enumerated files and its `deferred-items.md` entry names the Phase 98 DOC-08 prose carrier as the fallback owner; the substantive reconcile claim this plan owned was the `apply.ts` seam comment, which is fixed."

patterns-established:
  - "Load-time safety filter: any unattended path that re-enters a materialization primitive must filter on the user-intent axis (`enabled`) as well as the capability axis (`compatibility.installable`), because the primitive's record write is written for the commanded case and re-asserts intent it never checked."

requirements-completed: [ENBL-08]

coverage:
  - id: D1
    description: "The load-time backfill scan skips a disabled record entirely — no re-materialize, no re-enable (T-97-01 mitigation)"
    requirement: ENBL-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#ENBL-08: the backfill scan skips a DISABLED partial whose supported set grew -- no re-materialize, no re-enable"
        status: pass
      - kind: other
        ref: "RED gate observed: the same test failed with `1 !== 0` (one `plugin-backfilled` outcome pushed) on commit 6c5ba69a, before the source edit, and passed on 670b969f"
        status: pass
    human_judgment: false
  - id: D2
    description: "The guard is narrow: an otherwise identical ENABLED record on the same fixture still backfills"
    requirement: ENBL-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#ENBL-08 control: the SAME grown-set fixture with an ENABLED record still backfills"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two identical planner passes over a disabled partial declared disabled both return the empty plan, and the record appears in neither the disable nor the enable bucket"
    requirement: ENBL-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-08: two identical planReconcile passes over a disabled PARTIAL both return the empty plan (fixed point)"
        status: pass
      - kind: other
        ref: "Teeth confirmed by temporary mutation: restoring the pre-collapse two-axis predicate in state-io.ts turned both new planner tests red (plus the ENBL-05 truth table); the mutation was reverted and the suite re-verified green"
        status: pass
    human_judgment: false
  - id: D4
    description: "The fixed point is a property of the disabled DECLARATION, not of an inert record: the same record declared enabled reaches the enable bucket"
    requirement: ENBL-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#ENBL-05 / ENBL-08 counter-case: a config-declared-ENABLED disabled PARTIAL reaches the enable bucket"
        status: pass
    human_judgment: false
  - id: D5
    description: "No comment in apply.ts still claims the planner's enable bucket requires full availability"
    verification:
      - kind: other
        ref: "grep for `installable === true` in orchestrators/reconcile/apply.ts returns no hit; the seam JSDoc now states the ENBL-05 reachability explicitly"
        status: pass
    human_judgment: false
  - id: D6
    description: "The planner stays pure and offline-safe: the purity architecture gate and the convergence proof are unmoved"
    verification:
      - kind: unit
        ref: "tests/architecture/reconcile-planner-purity.test.ts and tests/orchestrators/reconcile/plan-convergence.test.ts both exit 0 unchanged"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-08-09
status: complete
---

# Phase 97 Plan 04: Reconcile fixed point for a disabled partial Summary

**The load-time backfill scan now filters on the user-intent axis as well as the capability axis, so a plugin the user disabled is never re-materialized — and with it re-enabled — by an unattended `resources_discover` pass; the planner's matching fixed point is pinned by two identical passes plus a declared-enabled counter-case.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 (Task 1 ran the TDD cycle: RED then GREEN)
- **Files modified:** 3 (1 source, 2 test)
- **Diff:** +185 / -15

## Accomplishments

- **The two-line guard, and the reason it is not redundant.** `backfillOnePluginIsolated` filtered only on `record.compatibility.installable`. Availability and disabled-ness are orthogonal (ENBL-05), so a disabled partial passed that filter, resolved, and — if its supported set had grown — went through `reinstallPlugin`, whose record write sets `enabled: true` unconditionally. That is the T-97-01 elevation-of-privilege path: hooks handlers, MCP servers and a `bin/` directory on the child-process PATH all restored at load time with no command and no prompt.
- **The RED gate was real and it demonstrated the threat, not just a missing branch.** On the test-only commit the guard test failed with `1 !== 0` — one `plugin-backfilled` outcome, meaning the disabled record had actually been re-materialized and flipped back to enabled. The source commit turned it green.
- **The control is what gives the guard test teeth.** A manifest-ABSENT fixture would pass either way, because `maybeBackfillPlugin`'s offline resolve returns early before any growth check. The guard fixture therefore declares the plugin in the manifest and seeds a tree (skills + commands + an `.lsp.json` unsupported marker) strictly broader than the recorded `["skills"]`; the sibling control, identical except for `enabled`, produces the backfilled outcome and proves the guard narrowed the scan rather than switching BFILL-01 off.
- **The falsified seam comment is gone.** The `__test_scanForceInstalledBackfills` JSDoc claimed the planner's enable bucket requires `installable === true`, "so a partially-installed plugin cannot reach it through a real plan". The ENBL-05 collapse falsified that and `97-03` made the reachable path actually work. The comment now describes what the seam is for — driving one scan in isolation over a caller-supplied outcomes array — and states the ENBL-05 reachability positively.
- **The planner fixed point is pinned in both directions.** Two identical `planReconcile` calls over an unchanged disabled-partial state plus a disabled declaration both deep-equal the empty plan, with `cr@mp` asserted absent from the disable and enable buckets by identifier. The counter-case flips the declaration to enabled and asserts the enable bucket has exactly that entry, so the fixed point is demonstrably about the declaration rather than about a record the planner cannot see.
- **Both fixtures grew one axis.** `pluginRecord` in `backfill.test.ts` gained `enabled?`; `stateWithDisabledRecord` in `plan.test.ts` gained `opts.unsupported`, deriving `installable` from the list's emptiness the way the enable-disable and list fixtures do. No existing call site of either changed.

## Task Commits

1. **Task 1 (TDD RED): the guard test and its enabled-record control** — `6c5ba69a` (test)
2. **Task 1 (TDD GREEN): the disabled-record early return plus the seam-comment correction** — `670b969f` (fix)
3. **Task 2: the two-pass planner fixed point and the declared-enabled counter-case** — `85408e94` (test)

No REFACTOR commit — the GREEN edit is a three-line branch and needed no cleanup pass.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — the ENBL-08 early return with its user-terms rationale, the `backfillOnePluginIsolated` JSDoc now naming all three benign skips, and the rewritten seam comment
- `tests/orchestrators/reconcile/backfill.test.ts` — the `enabled` factory axis plus the guard test and its positive control, placed beside the existing seam tests
- `tests/orchestrators/reconcile/plan.test.ts` — the `unsupported` fixture axis with its restated JSDoc, the two-pass fixed-point test, and the declared-enabled counter-case

## Decisions Made

See `key-decisions` in the frontmatter.

One detail worth recording about the Task 2 gate. Both new planner tests were green on first run, which is expected — `97-01` already landed the behavior and this plan's job for that half is to pin it. Rather than accept a green-on-arrival test, the pin was verified by mutation: temporarily restoring the pre-collapse two-axis predicate in `persistence/state-io.ts` turned the fixed-point test AND the counter-case red (alongside the ENBL-05 truth table), which is the same evidence a RED-first ordering would have produced. The mutation was reverted and `git diff` over `state-io.ts` confirmed empty before committing.

## Deviations from Plan

**None.** Every cited line range matched the worktree and both `<action>` blocks were executable as written.

## Issues Encountered

The `pre-commit` trufflehog hook fails structurally in a linked worktree (git-mode scan cannot read `.git/index`). Per CLAUDE.md, each commit was preceded by a filesystem-mode scan over the changed paths — all clean (`verified_secrets: 0`, `unverified_secrets: 0`) — and committed with `SKIP=trufflehog`. No other hook was skipped.

## Verification

- `node --test` over `backfill.test.ts`, `plan.test.ts`, `plan-convergence.test.ts` and `tests/architecture/reconcile-planner-purity.test.ts` — exit 0, 55/55
- `node --test tests/orchestrators/reconcile/backfill.test.ts` — exit 0, 20/20, including the untouched SF-01, SF-02, WR-02 and WR-03 dedupe tests
- `npm run typecheck`, `npm run lint`, `npm run format:check` — all exit 0
- `PI_SUBAGENTS_ROOT=… npm run check` — exit 0; 3319 unit tests (3318 pass, 0 fail) plus 18 integration tests
- RED-gate confirmation (Task 1): the guard test failed `1 !== 0` on `6c5ba69a` and passed on `670b969f`
- Mutation confirmation (Task 2): the pre-collapse predicate turned both new planner tests red; reverted, `git diff --stat -- persistence/state-io.ts` empty
- `grep "installable === true" extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — no hit

## Requirement Accounting

**ENBL-08 — Complete.** The requirement text names the disable re-plan; both paths that falsify "load-time reconcile reaches steady state for a disabled partially-installed record" are closed. The planner half was fixed by `97-01` and is now pinned by the two-pass fixed point with per-bucket identifier assertions. The backfill half — the path the requirement text does not name but which reverses the user's disable outright — is closed by the early return, proven red-without-it and narrow-with-it.

## Known Stubs

None.

## Out-of-Scope Discoveries (not fixed)

- `orchestrators/reconcile/README.md:34` — unchanged and still owned by its existing `deferred-items.md` entry. This plan's enumerated files do not include it, and the substantive reconcile claim (`apply.ts`'s seam comment) is fixed here, which shrinks that entry to pure prose drift for the Phase 98 DOC-08 carrier.
- `tests/orchestrators/reconcile/plan.test.ts:284-287` and the section banner just below it still describe the retired empty-resources marker in prose. The fixture JSDoc directly above the factory this plan extended was restated; these two neighbours were left alone to keep the diff surgical. Low risk — they are test-file comments, not a contract.
- `tests/orchestrators/reconcile/backfill.test.ts:318` carries a bare `Pitfall 4` token, which the comment policy forbids. Pre-existing, unrelated to this plan's lines, and cheap to sweep whenever that file is next edited for its own reasons.

## Next Phase Readiness

The reconcile subsystem now holds for the disabled partial in both directions: the planner plans nothing, and the backfill scan touches nothing. What remains for `97-05` is `refreshDisabledRecord`'s hard-coded `installable: true` (ENBL-09) — the short-circuit a disabled partial now reaches, which would rewrite its compatibility block untruthfully. Nothing in this plan changes that path; the guard added here sits upstream of it.

## Self-Check: PASSED

All three commit hashes resolve in `git log`; all three files claimed as modified exist on disk and appear in `git diff --stat f1610acc..HEAD`.

---
*Phase: 97-disabled-state-classification-repair*
*Completed: 2026-08-09*
</content>
</invoke>
