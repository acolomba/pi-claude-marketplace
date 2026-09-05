---
gsd_state_version: 1.0
milestone: workflows-replay
milestone_name: Workflow Bridge Replay onto main
current_phase: 109
current_phase_name: kind-inversion
current_plan: 05
status: in_progress
stopped_at: Completed 109-05-PLAN.md
last_updated: "2026-09-05T00:20:00.000Z"
last_activity: 2026-09-05
last_activity_desc: Phase 109 Plan 05 executed — the install-level window test pins both halves, the WINV-05 sweep is confirmed a no-op, and the whole npm run check chain is green
state_head: e5ae373f
progress:
  total_phases: 9
  completed_phases: 0
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Re-land the `workflows` bridge on a main that has moved under
it. Phases 101-105 shipped on `features/workflows-spike` and that branch was
never merged. Since then #154 declared `workflows` an *unsupported* kind, and
#167 replaced the test architecture the bridge was written against.

## Current Position

Phase: 109 (kind-inversion) — ALL PLANS EXECUTED, awaiting verification
Plan: 5/5 complete (109-01 through 109-05 done)
Status: The inversion is live in production code, the whole test tree agrees with
it, the published contract states the post-inversion meaning, and both halves of
the intermediate window are pinned by an assertion. `workflows` sits in both
supported tuples and in neither unsupported structure,
`componentPaths.workflows` exists, and the dedicated `{workflows}` reason is
retired from all four declaration sites. `tests/integration/workflow-kind-inversion.test.ts`
drives a real `installPlugin` and asserts the clean `(installed)` row with no
`--partial`, then asserts `<HOME>/.pi/workflows` does not exist. The whole
`npm run check` chain is green: typecheck **0** errors, all three fallow
sub-gates, Prettier, both corresponding-test gates, the direct-coverage negative
gate, `npm test` at **5195 pass / 0 fail**, `npm run test:integration` at
**32 pass / 0 fail**, and ESLint exit 0. `pre-commit run --all-files` passes with
no file left modified. Next is `/gsd-verify-work 109`.
Last activity: 2026-09-05 — 109-05 executed; one test commit plus the metadata
commit, and the phase taken through the full gate chain

**The D-109-06 window is now open, and pinned by test.** Until Phase 111 lands, a
workflow-bearing plugin resolves `installable`, renders `● (installed)` with no
brace, and materializes zero workflow commands.
`tests/integration/workflow-kind-inversion.test.ts` asserts both halves, so the
window is a fact under test rather than an undocumented gap. Cut no release from
this branch, and do NOT bump `EXTENSION_VERSION` before Phase 111 (A-03: a bump
would fire the `supportedSetGrew` backfill convergence while no bridge exists to
materialize anything).

**Phase 111 must invert the no-artifact half** of that test — the single
`assert.rejects(stat(<HOME>/.pi/workflows), { code: "ENOENT" })` line becomes an
assertion that the envelopes ARE written. An assertion that quietly stays green
while meaning the opposite is worse than no assertion. Recorded in
`109-CONTEXT.md` §Deferred Ideas and `109-05-SUMMARY.md`.

**Phase 111 must also BUMP `EXTENSION_VERSION`** in the same change that lands
`bridges/workflows/`. A-03 records only the prohibition — do not bump *during*
the window — and its inverse is an obligation that was written nowhere.
`orchestrators/reconcile/backfill.ts:76` returns early while
`state.lastReconciledExtensionVersion === EXTENSION_VERSION`, so the bump is the
only thing that opens the gate and lets `supportedSetGrew` (`backfill.ts:343`)
re-materialize the records the released v0.18.1 wrote. Any user who
`--partial`-installed a workflow-bearing plugin on 0.18.1 has
`compatibility: { installable: false, unsupported: ["workflows"] }` on disk, and
`list` / `info` / `enable` / reconcile read that PERSISTED array rather than a
fresh resolution, so the row now renders
`◉ helper (partially-installed) {unsupported component}` — a token naming a
dropped component for a kind Pi supports. Without the bump those records stay
that way permanently.

## Progress

**Phases Complete:** 0/9 (Phases 109-114 replay, 115-117 hardening)
**Current Plan:** 109-05 (5 of 5 complete; phase awaiting verification)

```text
[----------] 0%
```

| Phase | Name | Status |
|-------|------|--------|
| 109 | Kind inversion | Executed (5/5 plans), awaiting verification |
| 110 | Domain and platform modules | Not started |
| 111 | Workflows bridge | Not started |
| 112 | Install and removal lifecycle | Not started |
| 113 | Update, enable/disable, reconcile | Not started |
| 114 | Degradation and documentation | Not started |
| 115 | Install-time admission-gate warnings | Not started (hardening) |
| 116 | Load-time workflow convergence | Not started (hardening) |
| 117 | Measured `agent()` failure evidence | Not started (hardening) |

**Why one run covers both milestones.** GSD scopes a milestone by parsing a
`vN.N` version out of STATE's `milestone:` field
(`workstream-inventory.cjs::readCurrentMilestoneVersion`). This workstream uses
a NAME, so scoping never engages and `roadmap analyze` returns all nine phases.
That is the right order to run them in anyway — replay, then harden — so
`total_phases` is 9 rather than the replay's 6. A consequence of the same gap:
`workstream status` reports this workstream `milestone complete`, derived from
the archived `milestones/workflows-ROADMAP.md` through the legacy fallback.
`init milestone-op` reads it correctly as incomplete, and that is what
`/gsd-autonomous` uses.

**Why the numbers start at 109.** Phase numbers are per-workstream, not global:
root `v1.19` uses 106-117, `defaults-enabled` uses 101-105, and this
workstream's archived milestone uses 101-105. Only a collision *within* this
workstream would matter, and 106-108 are free here. They are left unused
anyway, because the spike branch's own records plan the hardening milestone as
"Phases 106-108" — reusing those numbers for the replay would make every such
reference ambiguous when the two branches are read side by side.

## Replay Ground Truth

What is on this branch right now, so a later session does not read the archived
101-105 records as a claim about this tree:

- **Planning artifacts:** ported. The 101-105 phase records, the archived
  requirements, and the milestone audit all describe work that exists on
  `features/workflows-spike`, not here.
- **Spike evidence:** ported and renumbered 021-026 (008-013 collided with this
  branch's existing spikes). Re-verified against engine 3.10.1 in Spike 027.
- **Production code:** none of it. No `bridges/workflows/`, no
  `domain/workflow-*.ts`, no `platform/workflow-home.ts`, no `acorn`
  dependency.
- **Behavior today:** a workflow-bearing plugin resolves `partially-available`
  and reports `{workflows}`, per #154. That is the state Phase 109 inverts.

## Accumulated Context

**Decisions carried in:**

- **Only the lax direction self-corrects.** A replicated engine gate can only
  make the bridge stricter than the engine; a spurious refusal needs an
  extension release to clear, a spurious warning costs one line. Phase 115 may
  read the six gates but must never refuse on them.

- **The determinism blocklist keeps its refusal.** It is the one replicated
  gate because it is the one whose failure the engine reports wrongly — a
  raw-text screen cannot tell a call from a mention, so a script is refused for
  a rule its comment merely names.

- **Equality is not growth.** The convergence widening keeps the strict-superset
  test and the extension-version stamp; re-materializing on every load is the
  failure WCONV-02 exists to prevent.

- **Never scan a disabled record.** The backfill re-materializes through
  reinstall, whose record write sets `enabled: true` unconditionally, so
  scanning a disabled record reverses an explicit user disable at load time.
  Widening the arm must not widen past that filter.

- **Engine claims are pinned to `@quintinshaw/pi-dynamic-workflows` 3.10.1 (Spike 027)**, and
  every claim carries its evidence grade — documented-upstream,
  runtime-measured, or source-read. An ungraded claim reads as stronger evidence
  than it is.

- **The engine is deliberately not a declared dependency.** Adding it would
  couple `npm run check` to a 0.x package with ~50 releases since May 2026 and
  no exported contract. The live-UAT scratch-install route exists precisely to
  avoid that, which is why WEVID-01 produces a HUMAN-UAT item rather than an
  automated gate.

- Host engine chosen on trust grounds: it sandboxes scripts in a
  `vm.createContext` realm. `@nicknisi/pi-workflows` is rejected —
  `runInThisContext()` plus the real `process`, all env vars, and
  `process.binding('fs')`. The reason token is `requires pi-dynamic-workflows`,
  never `requires pi-workflows` — the latter names the rejected engine.

- NFR-10 carries a writable **root** (`~/.pi/workflows/`), not a subdirectory;
  the engine honors no override, and staging must sit adjacent to the target.

**Open todos:** None yet.

**Blockers:** None.

**Evidence base:** The validation audit of Phases 101-105 (2026-08-16) — sources
and tests read, suites run, and the real admission logic driven against the
seven workflow scripts of the two Anthropic-authored plugins that carry a
`workflows/` directory (`claude-security`, `code-modernization`). All seven pass
the six unreplicated gates today, so the value of Phase 115 is in the error
message a third-party author gets, not in a live breakage. Spike findings for
the bridge itself are packaged in the `spike-findings-pi-claude-marketplace`
project skill (`references/workflows-bridge.md`), which auto-loads during
implementation.

## Session Continuity

**Last session:** 2026-09-05T00:20:00.000Z

**Stopped At:** Completed 109-05-PLAN.md
**Resume File:** None
**Next Action:** `/gsd-verify-work 109`. All five plans of Phase 109 are
executed and the whole `npm run check` chain is green, so the phase is ready for
verification. Two of the phase's obligations are manual-only and their answers
are already recorded in `109-05-SUMMARY.md` §*Human-check answers* — the
Success-Criterion-4 observation sequence and the WINV-05 prose read. After
verification, plan Phase 110 with `/gsd-plan-phase 110`.

**One gate note for the verifier:** `roadmap.update-plan-progress 109` wrote
`5/5` but left the phase row `In Progress`, which is the tool's own behavior
while phase verification has not run. It flips to `Complete` at verification;
do not hand-edit the row.

**Where the work lives:** the worktree
`/home/acolomba/pi-claude-marketplace-workflows` on branch `features/workflow`.
The primary checkout (`/home/acolomba/pi-claude-marketplace`) carries none of
this workstream's planning files. The older `.worktrees/workflows-spike`
worktree on `features/workflows-spike` still exists and is reference only — the
replay reads it, never merges it. GSD tooling is gitignored and therefore absent
from a fresh worktree; this one has `gsd-core`, `agents`, `hooks`, `scripts`,
`commands/gsd-*.md` and the install state copied in from the primary checkout,
with `workstream set workflows` applied. All of it is gitignore-matched, so
`git status` stays clean. Run gsd-tools from this worktree, never from `main`.

**Executors run SEQUENTIALLY here, never in agent worktrees.** This worktree's
own `node_modules` is a real directory, but a freshly-created agent worktree has
none, so it could not run `npm run check` at all. `workflow.use_worktrees` is
`false` in `.planning/config.json` for the same reason. Force the dispatch
sentinel (`query dispatch-isolation --raw --phase N --force-isolation none`)
before every executor, reviewer and fixer dispatch — a bare call re-resolves and
re-persists `harness-worktree` as a side effect.

**Outstanding, carried deliberately:**

- **Phase 101 was never code-reviewed.** Its 23 changed files are verified 4/4
  but unreviewed — the earlier autonomous run was interrupted at that dispatch.
  Phase 102's review found two blockers in comparable code, so the gap is real.
  Resume with `/gsd-code-review 101`.

- **Release work from the `workflows` milestone is still open.** Bump the
  version in `package.json`, `sonar-project.properties` and `EXTENSION_VERSION`;
  update `package-lock.json`; record the milestone in `CHANGELOG.md`; re-run
  `npm test` (pre-commit does not run the suite that guards the version). Push
  `features/workflows-spike` and open the PR — nothing is pushed yet and no PR
  exists. This milestone's phases can land on the same branch first.

- **A pre-existing bare planning-artifact token** sits at
  `tests/orchestrators/reconcile/backfill.test.ts:320` (commit `c695bdab3`).
  Phase 116 edits that file, so the token is now in reach — clean it there
  rather than leaving it.

- **The `node_modules` cleanup hazard does not apply on this worktree.** It did
  on `.worktrees/workflows-spike`, where `node_modules` was a symlink ignored
  only via a local `.git/info/exclude` and had to be removed before
  `gsd-cleanup` would pass its worktree_dirty check. Here it is a real
  directory ignored by the committed `.gitignore:67`, and this worktree's
  exclude file is empty — verified 2026-09-04. Re-check before running
  `gsd-cleanup` from any other worktree.

- **Four residual risks accepted in the `workflows` milestone**, recorded so they
  are not rediscovered as new defects: the commit double-fault branch (restore
  failure during rollback) has no automated test; a narrow `update` double fault
  can persist a record over-claiming a foreign name; the two re-stage-window
  tests are POSIX-only and SKIP as root, so container CI skips them silently;
  and `unplaceWorkflows` failures surface only as leak strings on the
  manual-recovery message.

- **All five `VALIDATION.md` files for Phases 101-105 are `status: draft`**, so
  Nyquist reads NOT-VALIDATED. A coverage TODO, not a compliance failure —
  `/gsd-validate-phase 101..105` closes it if wanted.

- **One open question for the operator:** `README.es.md` reads
  `Workflows (flujos de trabajo).` (parallel to the existing `Hooks (ganchos).`).
  Flip to `Flujos de trabajo (workflows).` if preferred — the link text changes
  with it.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| — | — | — | — |
| Phase 109 P01 | 22 min | 3 tasks | 7 files |
| Phase 109 P02 | 11 min | 2 tasks | 6 files |
| Phase 109 P03 | 12 min | 2 tasks | 8 files |
| Phase 109 P04 | 14 min | 3 tasks | 5 files |
| Phase 109 P05 | 15 min | 2 tasks | 1 file |

## Decisions

_Recorded per phase as the milestone proceeds._

- [Phase 109]: The closed-set move is one commit, never two. T-02-25 warns that a kind in neither closed set is silently ignored, so the removal from `UNSUPPORTED_COMPONENT_KINDS` and the additions to both supported tuples landed together in `f23d964d`. — A tidier two-commit split would have published an intermediate tree carrying the exact defect the security note exists to prevent.
- [Phase 109]: The install-level window test composes the host engine's storage root by hand (`path.join(HOME, ".pi", "workflows")`) rather than adding a `locations` getter for it. — That getter is Phase 110's deliverable; adding it here would be an unused export `fallow dead-code` would flag, and a boundary widening the assertion does not need.
- [Phase 109]: A negative assertion is only trusted after a non-vacuity probe. Before accepting the green `ENOENT` assertion, `resolveStrict` was driven against the identical fixture shape and returned `installable` with `workflows` in `supported`. — Without that check the assertion passes just as happily for a plugin carrying no `workflows/` directory at all, and would pin nothing.
- [Phase 109]: D-109-01/D-109-05 executed as a red slice: the five locking gates and the published byte contract were turned to the post-inversion reading BEFORE any production edit, and each was observed failing against unmodified code. — Success Criterion 4 asks for a red-then-green pair. With production edited first the renderer prints whatever the fixture hands it, both halves agree, and the observed red never happens.

## Operator Next Steps

- Plan the first phase with `/gsd-plan-phase 106`
- Phases 106, 107 and 108 are mutually independent; the order above is
  execution order, not a dependency chain
- Phase 117's canary run needs a disposable scratch install of
  `@quintinshaw/pi-dynamic-workflows` — it can be primed at any point in the
  milestone
