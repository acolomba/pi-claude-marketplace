---
gsd_state_version: 1.0
milestone: defaults-enabled
milestone_name: defaultEnabled Manifest Field
current_phase: 104
current_phase_name: Pre-install read surfaces
current_plan: Not started
status: planning
stopped_at: Phase 103 closed and verified; phase 104 not started
last_updated: "2026-08-15T15:05:00.000Z"
last_activity: 2026-08-15
last_activity_desc: Phase 103 closed — six plans, three production fixes for one defect at three call sites, six review findings fixed, 4/4 criteria verified
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 60
---

# Project State

## Project Reference

See: .planning/PROJECT.md (shared across workstreams; updated 2026-08-12 after
the v1.18 close)

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Phase 104 — Pre-install read surfaces. The milestone goal is
that a plugin author can ship a plugin that installs disabled
(`defaultEnabled: false`), and nothing later re-enables it behind the user's
back. Phase 101 landed the schema field and the single precedence evaluation;
Phase 102 made the resolved value change what a user observes; Phase 103 proved
the resulting state is a fixed point and closed the three lifecycle doors that
could still re-enable a plugin. Phase 104 surfaces the field BEFORE install, so
a user can see what they are about to get.

## Current Position

Phase: 104 — Pre-install read surfaces
Plan: none yet — discuss and plan are both still to run
Status: Ready to discuss
Last activity: 2026-08-15 — Phase 103 closed: six plans across three waves, six
code-review findings fixed, 4/4 success criteria verified by mutation with one
accepted override. Transitioned to Phase 104.

## Progress

**Phases Complete:** 3/5
**Current Plan:** Not started

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 101 | Manifest field and precedence resolution | DFEN-01, DFEN-02, DFEN-03 | Complete (3/3 plans) |
| 102 | Reason token, install write-through and notification | OUT-01, DFEN-04, DFEN-05, OUT-04 | Complete (3/3 plans), verified |
| 103 | Reconcile stability and lifecycle non-reapplication | DFEN-06, DFEN-07 | Complete (6/6 plans), verified |
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

**No open decisions remain.** The question carried out of Phase 102 — whether
the install-disabled verdict should widen to fire on an explicit
`declaredEnabled === false` — was **SETTLED at the Phase 103 discuss session
(2026-08-15) as D-103-01, D-103-02 and D-103-03**, and the work landed.

It was decided by a constraint rather than by taste: no form of the widening
leaves DFEN-08 intact. Widening unconditionally changes `install` for plugins
whose manifest never declares the field; gating the widening on the manifest
declaring it changes the `defaultEnabled: true` case instead. DFEN-08 requires
both to stay byte-identical to today. So the verdict stays one-directional, the
Phase 102 criterion's illustrative gloss was reworded in `ROADMAP.md` to match
DFEN-05's normative text, and the current behavior is pinned by a regression test
carrying the DFEN-08 argument in its comment.

## Backlog Carried Forward

None of these blocks a phase; all are recorded so a later reader does not
rediscover them.

- **A fourth flag-aimed config write remains.** `maybeWritePluginConfigBack`
  (`orchestrators/plugin/shared.ts`, ~`:965` after the Phase 103 helper was
  inserted above it) still aims with the caller's `--local` flag rather than
  with the declaration's location, so a flagless `update` under a local-only
  declaration writes into the shadowed base file. **Benign and pinned, not
  broken:** its patch carries no field and it runs only when the key is absent,
  so the merged view never moves and no enablement can flip. Phase 103 fixed the
  three sites that could cause harm and left this one deliberately, with an
  assertion holding its fieldless shape so a future change that starts writing a
  field there fails a test.

- **Reinstall's new `(skipped) {already disabled}` row has no catalog block.**
  `docs/output-catalog.md` documents a curated set with a byte-equality runner
  over what it documents, so an absent block fails nothing. A **DOC-01 candidate
  for Phase 105**, named here so that phase inherits it.

- **Standalone retry after a failed disable cascade.** The record is saved, so
  an immediate re-run of `install` hits the PI-15 `already-installed` gate and
  the only escape named to the user is `uninstall`. A `/reload` does converge,
  because the config now declares `enabled: false`
  (`orchestrators/plugin/install.ts`).

- **Phase 102's criterion 2 proves its agents/MCP arm by composition.** The
  tests assert skills, commands and hooks are gone from disk; agents and MCP
  rest on `cascadeUnstagePlugin` covering all five kinds. One `stat` on
  `locations.agentsDir` and one read of `mcpJsonPath` in the existing
  `install-out04-row-` fixture would make it direct. A Phase 105 parity-sweep
  candidate.

---

The two milestone-level questions raised before Phase 102 are **SETTLED** and
recorded as D-102-01..D-102-10 in
`phases/102-reason-token-install-write-through-and-notification/102-CONTEXT.md`.

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

**Last session:** 2026-08-15T15:05:00.000Z

**Stopped At:** Phase 103 closed. It was scoped as characterization — a scout
found three of its four criteria already structurally true — and grew twice.
Research probed the criteria against the real orchestrators instead of reading
them and found `reinstall` re-materializing a disabled plugin and `enable`
writing to the wrong physical config file; planning then found the same
write-target defect a third time, on `install`, where it was a permanent
re-enable loop on every reload rather than an edge. The three are one defect at
three call sites: every verb that authors a declaration on the user's behalf
aimed its write with the caller's `--local` flag instead of with the
declaration's location. They now share one selector. A code review then found
that selector treating an unreadable config as one that declares nothing, and
guessing the shadowed file; all six findings were fixed with regression tests
that fail without them. 4/4 criteria verified by mutation, one accepted
override. `npm run check` exits 0.
**Resume File:** None
**Next Action:** discuss, plan and execute phase 104 (OUT-02 / OUT-03 / OUT-05)
— pre-install read surfaces, so a user can see the declared default before
installing. No open decision is carried into it; the Backlog Carried Forward
section above holds four non-blocking items, two of which are Phase 105
candidates.

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
| Phase 102 P02 | 40min | 3 tasks | 3 files |
| Phase 102 P03 | 25min | 2 tasks | 4 files |
| Phase 103 P01 | 15min | 3 tasks | 2 files |
| Phase 103 P02 | 34min | 2 tasks | 2 files |
| Phase 103 P03 | 45min | 3 tasks | 3 files |
| Phase 103 P04 | 45min | 3 tasks | 3 files |
| Phase 103 P06 | 40min | 3 tasks | 2 files |
| Phase 103 P05 | 25min | 2 tasks | 2 files |

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

- [Phase 102]: The cascade-failure fault is injected through AG-5 foreign
  content, not by seeding `agents-index.json` as a directory. The install
  ledger's own agents phase loads that index BEFORE its noop short-circuit, so
  the directory trick trips the ledger and turns the case into an install
  rollback. Foreign content is the right lever because the ledger tolerates a
  `failed[]` row while the cascade throws on one — succeed on the way in, throw
  on the way out.

- [Phase 102]: A precedence test over a three-valued key covers all three values
  explicitly. `entry.enabled !== undefined` and `isDeclaredEnabled(entry)` agree
  on `true` and on `false`, so a two-valued matrix passes while the gate asks
  the wrong question.

- [Phase 102]: The reconcile stamp's physical target comes from
  `PlannedPluginInstall.configSource`, the planner's recorded merge provenance,
  rather than being re-derived at the write site. A mis-aimed stamp is silent:
  CFG-02 replaces the whole entry per key, so a base-file write under a local
  declaration leaves the merged view still reading `enabled` absent.

- [Phase 102]: An assertion about a write TARGET is taken through the merged
  view, not only the physical file, wherever the two can disagree. A test that
  asks only "did some file gain the key" passes over exactly the mis-target
  defect it exists to catch.

- [Phase 102]: A landed-disabled install reports through the EXISTING
  `plugin-disabled` outcome kind. Defining a new kind would have forked a
  projection arm gated by `notify-stamp-coverage.test.ts`, for a row the
  existing arm already renders correctly.

- [Phase 103]: A constraint decided the install-widening question that taste
  could not. DFEN-08 requires `defaultEnabled: true` and an absent
  `defaultEnabled` to behave byte-identically to today, and no form of the
  widening survives that — unconditional widening changes plugins whose manifest
  never declares the field, and gating it on the manifest changes the `true`
  case instead.

- [Phase 103]: A phase scoped as characterization must still PROBE, not only
  read. The scout read the code and concluded three of four criteria were
  already true; research ran them and found two live defects, and planning found
  a third. All three were in scope by the phase's own goal sentence.

- [Phase 103]: Every verb that authors a config declaration on the user's behalf
  selects its write target from where the declaration LIVES, never from the
  caller's `--local` flag. A typed flag still wins; the rule answers only the
  flagless case. The three sites now share one selector so a fourth authoring
  verb inherits the rule rather than re-opening the question.

- [Phase 103]: A file that cannot be READ is never treated as a file that
  declares nothing. The first form of the shared selector folded "absent",
  "says no" and "unreadable" into one boolean and guessed the shadowed file on
  the third. Where a file's content determines a write destination, an
  unreadable file aborts.

- [Phase 103]: The gate for a guarantee that is already structurally true is a
  source-level grep, not only a behavioral test. `update` and `reinstall` never
  read `defaultEnabled` today; the gate fails at the token, before a behavior
  exists to test.
