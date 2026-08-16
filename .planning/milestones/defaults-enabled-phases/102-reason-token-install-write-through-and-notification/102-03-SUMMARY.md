---
phase: 102
plan: 03
subsystem: install-orchestration
tags: [defaults-enabled, reconcile, config-write-back, write-target, cascade-truthfulness]
status: complete

requires:
  - "orchestrators/plugin/install.ts::InstallPluginOptions.applyDefaultEnabled"
  - "orchestrators/plugin/install.ts::InstallPluginOptions.local"
  - "orchestrators/plugin/install.ts::selectConfigWriteTarget"
  - "orchestrators/plugin/install.ts::InstallPluginOutcome.landedDisabled"
  - "persistence/config-write-back.ts::writePluginConfigEntry"
  - "orchestrators/reconcile/types.ts::PlannedPluginInstall.configSource"
  - "orchestrators/reconcile/apply-outcomes.ts::PluginDisabledOutcome"
provides:
  - "orchestrators/plugin/install.ts::the orchestrated-mode absent-key stamp"
  - "orchestrators/reconcile/apply.ts::applyPluginInstalls opt-in + declaring-file selection"
  - "orchestrators/reconcile/apply.ts::the plugin-disabled cascade arm for a landed-disabled install"
  - "tests/orchestrators/reconcile/apply.test.ts::the base-declared, local-declared and pre-existing-true cases"
  - "tests/orchestrators/reconcile/apply.test.ts::seedRealPathMarketplace entryDefaultEnabled knob"
affects:
  - "orchestrators/reconcile/plan.ts (103 / DFEN-06 asserts the planner plans nothing over the state this stamp writes)"

tech-stack:
  added: []
  patterns:
    - "write-target selection driven by recorded merge provenance (`configSource`) rather than re-derived at the write site"
    - "assert a write-target through the MERGED view, not only the physical file, wherever the two can disagree"
    - "reuse an existing outcome kind to report a new terminal state, so a gated projection arm is not forked"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - .planning/workstreams/defaults-enabled/phases/102-reason-token-install-write-through-and-notification/102-VALIDATION.md

decisions:
  - "The stamp is the `else` arm of the WR-09 orchestrated guard rather than a second `if` on the same condition. The two are logically identical; the `else` form keeps the locked closure under its cognitive-complexity budget, and the guard's own condition is unchanged"
  - "The `plugin-disabled` push omits `version`: the installed arm of `InstallPluginOutcome` carries no version field, so there is none to forward, and the optional field is left absent rather than re-derived"
  - "Both mutation checks were run rather than trusting a first-try green: the stamp neutralized (two cases red) and the write target mis-aimed at the base file (the local case red)"

metrics:
  duration: ~25min
  completed: 2026-08-14

actuals:
  tokens: 5000
  tasks: 2
  commits: 3
---

# Phase 102 Plan 03: Reason token, install write-through and notification Summary

A reconcile-driven install of a plugin whose declaration says
`defaultEnabled: false` now records the plugin disabled, writes `enabled: false`
into the physical config file the plugin was declared in, and reports the result
as `(disabled)` rather than `(installed)`.

## What Was Built

**The absent-key stamp (`orchestrators/plugin/install.ts`).** Inside the lock
the install already holds, beside the batched write-back, a second and much
narrower write goes through `writePluginConfigEntry` — the sole sanctioned
single-entry writer (D-102-09 / SPLIT-02). It carries exactly one field, spread
over the existing entry, so forward-compat keys (D-09) and sibling entries
survive. Its only condition is the landed-disabled verdict, which already
required the caller's opt-in (so `import` never reaches it, D-102-03) and an
absent `enabled` key (so a value the user wrote is never rewritten, D-102-04);
the comment says so, to stop a later reader adding a redundant second guard that
can then drift. The WR-09 orchestrated write-back skip keeps its exact
condition.

Without the stamp the next `/reload` reads the absent key as enabled (D-04),
finds the record disabled, and plans an enable — the silent re-enable this
milestone exists to close.

**The declaring-file selection (`orchestrators/reconcile/apply.ts`).**
`applyPluginInstalls` now passes `applyDefaultEnabled: true` unconditionally — a
user who hand-adds a bare `"p@mp": {}` has declared WHICH plugin, not WHETHER it
is enabled — and derives `local` from `PlannedPluginInstall.configSource`, the
merge provenance the planner has recorded since it was written and which nothing
had ever read. Both the DFEN-05 precedence read and the stamp follow that one
selection. Getting it wrong is silent in both directions: reading the base file
under a local declaration reports `enabled` absent even when the local entry says
`true`, and stamping the base file under a local declaration changes nothing the
merged view can see, because CFG-02 replaces the whole entry per key.

**The truthful cascade row.** When the outcome carries `landedDisabled`, the
loop pushes the EXISTING `plugin-disabled` outcome kind instead of
`plugin-installed`. No new kind, no edit to `orchestrators/reconcile/notify.ts`:
the existing `(disabled)` arm already renders the row and is gated by
`notify-stamp-coverage.test.ts`, which forking would have broken. The arm
hard-codes both soft-dep flags false (ENBL-15 / D-100-06), so the push needs no
`dependencies` counterpart.

**Three end-to-end cases plus a fixture knob
(`tests/orchestrators/reconcile/apply.test.ts`).**
`seedRealPathMarketplace` gained an optional `entryDefaultEnabled`, stamped onto
the MARKETPLACE ENTRY rather than `plugin.json` because the entry is the side
that wins the precedence rule — a fixture on the fallback side could pass for the
wrong reason. The cases:

1. **Base declaration, absent key (DFEN-04).** Disabled record with its
   inventory retained (ENBL-18), no staged skill on disk, a base entry of
   exactly `{ enabled: false }`, no local file conjured into existence, a
   `(disabled)` row and no `(installed)` one. A second `applyReconcile` pass
   rewrites neither the entry nor the record.
2. **Local declaration, absent key.** The stamp follows the declaration into
   `claude-plugins.local.json`, the base file stays byte-identical, and the
   assertion is taken through the MERGED view as well — the only reading that
   distinguishes a correct stamp from a mis-targeted one.
3. **Pre-existing `enabled: true` (DFEN-05).** The plugin installs enabled, its
   artifacts materialize, and the entry is left deep-equal to what the user
   wrote.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | The absent-key stamp, targeted at the declaring file | `2400872e` | `install.ts`, `apply.ts` |
| 2 | The stamp's scope, proven against a base and a local declaration | `4c053805` | `tests/orchestrators/reconcile/apply.test.ts` |
| — | Summary + state | (final docs commit) | `102-03-SUMMARY.md`, `102-VALIDATION.md`, `STATE.md` |

## Verification

| Gate | Result |
|------|--------|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | 151 pass, 0 fail |
| `node --test "tests/architecture/**/*.test.ts"` | 352 pass, 0 fail, 1 skipped |
| `npm run check` | green — 3487 unit + 18 integration, 0 fail |

The one skipped architecture test is the known pi-subagents global-peer skip,
not a regression from this plan.

Every acceptance grep passed: `writePluginConfigEntry` occurs exactly twice in
`install.ts` (the import and its single call site), `config-merge` zero times
there, `configSource` exactly once in `apply.ts`, and
`orchestrators/reconcile/{notify,plan,types}.ts` are untouched.

**Mutation checks.** The cases were confirmed to fail for the right reason
rather than trusted on a first-try green. With the stamp neutralized, cases 1
and 2 go red. With the write target mis-aimed at the base file, case 2 alone
goes red — which is the assertion the merged-view read exists to provide
(T-102-07). Both sources were restored from git afterwards.

## Decisions Made

- **The stamp is the `else` arm of the WR-09 guard, not a second `if`.** The
  plan describes "a separate statement with its own condition". The condition it
  names — orchestrated mode AND landed-disabled — is exactly what the `else if`
  expresses, and the guard's own `!== "orchestrated"` condition is unchanged, so
  the prohibition the plan actually cares about (widening WR-09) holds. The
  `else` form keeps the locked closure inside its `sonarjs/cognitive-complexity`
  budget. The comment states the equivalence so the choice is not mistaken for
  an accident.
- **The `plugin-disabled` push omits `version`.** `PluginDisabledOutcome`
  declares it optional and the installed arm of `InstallPluginOutcome` carries no
  version field, so the plan's "plus `version` if the outcome makes one
  available" resolves to: it does not.
- **Case 4 lives inside case 1's test, and asserts only what this seam can
  observe.** The config entry and the state record are unchanged by a second
  pass. Whether the planner plans an action at all is DFEN-06's requirement; a
  comment says so, so the omission reads as a scope boundary rather than an
  oversight.

## Deviations from Plan

**1. Task 1's source edits were already present, uncommitted, at plan start.**

- **Found during:** Task 1, before any edit.
- **What was found:** `install.ts` and `apply.ts` carried uncommitted changes
  matching this plan's Task 1 — evidently an interrupted earlier run of the same
  plan.
- **What was done:** Rather than reverting and rewriting them, the changes were
  read and checked line by line against the plan's action list, the four
  critical constraints and every acceptance criterion, then verified
  (typecheck, targeted suites, architecture gates, lint, format, the grep
  criteria) and committed as Task 1. They were faithful; the only substantive
  difference from the plan's prose is the `else if` shape recorded above.
- **Why it matters:** the work is now in git under a message that describes it,
  instead of sitting uncommitted where a later `git checkout` could discard it.

**2. `actuals.tokens` is measured on the documented scale and is not comparable
to the sibling summaries.** 5000 is chars/4 over this plan's realized code diff
(19,824 chars). Plans 102-01 and 102-02 recorded 14000 and 26000 against diffs
of a similar order, so their basis was evidently wider. The number here is left
on the documented basis and the discrepancy is stated rather than silently
split, and it is additionally deflated by deviation 1 — the Task 1 diff was not
authored in this session.

No `deferred-items.md` entries and no `WINDOWS.md` defects: no stub, skipped
test or unrun `<verify>` was left behind.

## Issues Encountered

None blocking. Two environment notes, both known and both already documented in
`CLAUDE.md`:

- TruffleHog's pre-commit hook fails structurally inside a worktree (its
  git-mode scan cannot find `.git/index`). Both commits were preceded by the
  sanctioned filesystem scan over the exact changed paths — clean, 0 verified
  and 0 unverified — and only then committed with `SKIP=trufflehog`.
- The repository has no installed `pre-commit` git hook, so `pre-commit run
  --files` run by hand IS the gate rather than a preview of it. It was run
  before each commit and passed every hook except the structural TruffleHog
  failure above.

## Next Phase Readiness

Phase 103 (DFEN-06 / DFEN-07) can proceed. The state it needs now exists where
the planner reads it: after a reconcile-driven install-disabled, the declaring
config entry says `enabled: false` and the record is disabled. This plan proves
that pair is a fixed point at the APPLY seam; proving the planner produces an
empty plan over it is 103's own requirement and was deliberately left unasserted
here.

The reload-hint asymmetry is carried forward as a recorded decision, not a
defect: the standalone install-disabled row stamps `needsReload: false` while
this cascade row inherits the shared `plugin-disabled` arm's `true`. Both are
defensible at their own seam and reconciling them would mean forking a gated
projection arm for no user-visible gain.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — FOUND
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — FOUND
- `tests/orchestrators/reconcile/apply.test.ts` — FOUND
- commit `2400872e` — FOUND
- commit `4c053805` — FOUND
