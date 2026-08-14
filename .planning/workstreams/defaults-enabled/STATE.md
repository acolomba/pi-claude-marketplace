---
gsd_state_version: 1.0
milestone: defaults-enabled
milestone_name: defaultEnabled Manifest Field
current_phase: 102
current_phase_name: Reason token, install write-through and notification
current_plan: 1
status: executing
stopped_at: Completed 102-01-PLAN.md
last_updated: "2026-08-14T19:18:30.386Z"
last_activity: 2026-08-14
last_activity_desc: Phase 102 planned — 3 plans in 2 waves; D-102-10 settled the OUT-04 remedy carrier
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
  percent: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (shared across workstreams; updated 2026-08-12 after
the v1.18 close)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Phase 102 — Reason token, install write-through and
notification. The milestone goal is that a plugin author can ship a plugin that
installs disabled (`defaultEnabled: false`), and nothing later re-enables it
behind the user's back. Phase 101 landed the schema field and the single
precedence evaluation; Phase 102 is the milestone's substantive phase, where
the resolved value first changes what a user observes.

## Current Position

Phase: 102 — Reason token, install write-through and notification — EXECUTING
Plan: 1/3 complete; next is 102-02 (wave 2)
Status: 102-01 landed — the install-disabled spine is green end to end
Last activity: 2026-08-14 — 102-01 executed: `installs disabled` joined REASONS,
install now materializes-then-disables, writes `enabled: false` through, and
reports it at info severity with the enable hint

## Progress

**Phases Complete:** 1/5
**Current Plan:** 102-02 (not started)

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 101 | Manifest field and precedence resolution | DFEN-01, DFEN-02, DFEN-03 | Complete (3/3 plans) |
| 102 | Reason token, install write-through and notification | OUT-01, DFEN-04, DFEN-05, OUT-04 | Executing (1/3 plans) |
| 103 | Reconcile stability and lifecycle non-reapplication | DFEN-06, DFEN-07 | Not started |
| 104 | Pre-install read surfaces | OUT-02, OUT-03, OUT-05 | Not started |
| 105 | No-op parity sweep and contract documentation | DFEN-08, DOC-01, DOC-02 | Not started |

## Accumulated Context

**Design anchor (fixed, not re-litigable per phase):** install-time
write-through. Install stamps `enabled: false` into the scope's
`claude-plugins.json` entry rather than resolving the manifest value at consume
time. The rejected alternative — teaching `isDeclaredEnabled`
(`persistence/config-io.ts`) the manifest value — must not reappear in any
phase: the reconcile planner has no manifest access, a manifest edit would flip
a user's plugin off underneath them on reload, and it contradicts the upstream
install-time-only timing.

**Milestone-wide constraints:** `npm run check` green at every phase boundary
(NFR-6); no phase introduces a network call on a read path (NFR-5); no state
schema migration; `--skip-ui` on every `/gsd-plan-phase` call (the UI keyword
gate matches this project's domain vocabulary as a known false positive).

## Open Decisions

Both milestone-level open questions are now **SETTLED** at the Phase 102 discuss
session (2026-08-14) and recorded as D-102-01..D-102-09 in
`phases/102-reason-token-install-write-through-and-notification/102-CONTEXT.md`.
No open decisions remain for the milestone.

1. **Materialization path for an install-disabled plugin — SETTLED (D-102-01,
   D-102-02).** Materialize, then disable: run the full six-phase ledger, then
   the existing disable cascade. The D-01 literal array and all five
   materialization phase bodies stay untouched, the terminal state matches
   `install`+`disable` by construction, and `toDisabledRecord` remains the sole
   producer of the disabled shape (ENBL-02). A ledger-succeeds/cascade-fails
   window inherits today's disable failure behavior unchanged.

2. **Orchestrated-mode installs — SETTLED, and split by caller (D-102-03,
   D-102-04).** `import` and `reconcile` are NOT one case. `import` never
   applies `defaultEnabled`: `extractEnabledPluginRefs`
   (`orchestrators/import/refs.ts`) skips `enabled: false` entries outright, so
   everything it installs carries an explicit `enabled: true` and DFEN-05
   governs. `reconcile` DOES apply it — a hand-added `"p@mp": {}` declares which
   plugin, not whether it is enabled — and stamps `enabled: false` into the
   entry, but ONLY when the key is absent. A pre-existing value is never
   touched. The stamp is what makes the next `/reload` a fixed point instead of
   the `acc.enable` re-enable at `orchestrators/reconcile/plan.ts:338`.

## Session Continuity

**Last session:** 2026-08-14T19:18:30.355Z

**Stopped At:** Completed 102-01-PLAN.md — the phase's wave-1 spine. The closed
set now holds 39 members, install materializes-then-disables a
`defaultEnabled: false` plugin, writes `enabled: false` through to the target
config, and reports it once at info severity with the frozen enable hint.
`npm run check` is green.
**Resume File:** None
**Next Action:** execute wave 2 — `102-02` (DFEN-05 precedence in both
directions, the `import` non-application proof, and the D-102-02 cascade-failure
case) and `102-03` (the reconcile absent-key stamp and the projection that reads
`landedDisabled`). Discuss and plan are already done — do not re-run them.

**Resume requirement:** run GSD from the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/defaults-enabled` (branch
`features/defaults-enabled`). From the main checkout the workstream does not
exist and GSD reports no phases, exiting clean — a false negative.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 101 P01 | 20min | 2 tasks | 13 files |
| Phase 101 P02 | 15min | 2 tasks | 2 files |
| Phase 101 P03 | 17min | 3 tasks | 3 files |
| Phase 102 P01 | 55min | 2 tasks | 9 files |

## Decisions

- [Phase 101]: The resolved `defaultEnabled` is threaded as an explicit
  parameter out of `preflightStages` rather than carried on
  `PartialResolution`, so a forgotten wiring is a compile error instead of a
  silent `true`. Costs four private signature edits in `domain/resolver.ts`.

- [Phase 101]: The `defaultEnabled` precedence truth table lives in ONE delimited
  section per resolution mode. Plan 101-01's end-to-end case was relocated into
  it rather than a cell being duplicated, so a reader meets every cell at once.

- [Phase 101]: Mode parity is asserted by spelling the expected literal out in
  the loose-mode suite, not by cross-calling `resolveStrict` from it — a
  divergence then reads directly in the failure output.

- [Phase 101]: A test asserting the opposite containment outcome to a sibling
  test in the same file names that sibling and says why the two differ, so a
  later reader does not "fix" one toward the other.

- [Phase 102]: The install-disabled verdict is caller-supplied
  (`applyDefaultEnabled`), never inferred from the config. On the `import` path
  the plugin's config entry does not exist yet when `installPlugin` runs, so an
  absent-entry inference would install every imported plugin disabled.

- [Phase 102]: `installs disabled` gets a FOURTH shared topic group
  (`DECLARED_STATE_REASONS`). Stretching `UNSUPPORTED_REASONS` would falsify
  that group's own charter comment — installing disabled is not an unsupported
  feature.

- [Phase 102]: The install-disabled row stamps `needsReload: false`. The ledger
  staged and the cascade unstaged inside the same command, so Pi's resource view
  saw no net change; no existing reload-agreement gate constrains this
  per-status.

- [Phase 102]: The disable half is composed from `cascadeUnstagePlugin` +
  `toDisabledRecord`, never by calling `setPluginEnabled`. Two hard blocks:
  `enable-disable.ts` already imports `runInstallLedger` from `install.ts`, so
  the reverse edge closes a cycle `import-x/no-cycle` rejects; and the per-scope
  lock is not re-entrant.

- [Phase 102]: A failed disable cascade RETURNS its cause and saves the shrunken
  record rather than throwing. A closure throw discards the mutated snapshot,
  which would leave `state.json` claiming artifacts the cascade already removed
  from disk.
