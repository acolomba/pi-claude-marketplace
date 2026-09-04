---
gsd_state_version: 1.0
milestone: workflows-replay
milestone_name: Workflow Bridge Replay onto main
status: planning
last_updated: "2026-09-04T19:20:00.000Z"
last_activity: 2026-09-04
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
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

Phase: 109 — Kind inversion (not started)
Plan: —
Status: Planning artifacts and spike evidence ported; phases not yet planned
Last activity: 2026-09-04 — Workstream ported onto `features/workflow`, spikes renumbered 021-026, engine claims re-measured against 3.10.1 (Spike 027)

## Progress

**Phases Complete:** 0/6 (replay) + 0/3 (hardening, planned)
**Current Plan:** Not started

```text
[----------] 0%
```

| Phase | Name | Status |
|-------|------|--------|
| 109 | Kind inversion | Not started |
| 110 | Domain and platform modules | Not started |
| 111 | Workflows bridge | Not started |
| 112 | Install and removal lifecycle | Not started |
| 113 | Update, enable/disable, reconcile | Not started |
| 114 | Degradation and documentation | Not started |
| 115 | Install-time admission-gate warnings | Planned (hardening) |
| 116 | Load-time workflow convergence | Planned (hardening) |
| 117 | Measured `agent()` failure evidence | Planned (hardening) |

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

**Last session:** 2026-08-16

**Stopped At:** Roadmap written for milestone workflow-hardening — 3 phases (106-108), 12/12 requirements mapped.
**Resume File:** None
**Next Action:** `/gsd-plan-phase 106`.

**Where the work lives:** the worktree `.worktrees/workflows-spike` on branch
`features/workflows-spike`, well ahead of `main`. The primary checkout is on
`main` and carries none of this workstream's planning files. GSD tooling is
gitignored and therefore absent from a fresh worktree — this worktree has
`gsd-core`, `agents`, `hooks`, `scripts`, `commands/gsd-*.md` and the install
state copied in from the primary checkout, with `workstream set workflows`
applied. All of it is gitignore-matched, so `git status` stays clean. Run
gsd-tools from the worktree, never from `main`.

**Executors run SEQUENTIALLY here, never in agent worktrees.** `node_modules` is
a symlink into the primary checkout, so an isolated agent worktree has no
dependencies and could not run `npm run check` at all. Force the dispatch
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

- **`node_modules` here is a symlink** into the primary checkout, ignored only
  via `.git/info/exclude` (local, uncommitted). It must be removed before
  `gsd-cleanup` runs, which otherwise fails its worktree_dirty check.

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

## Decisions

_Recorded per phase as the milestone proceeds._

## Operator Next Steps

- Plan the first phase with `/gsd-plan-phase 106`
- Phases 106, 107 and 108 are mutually independent; the order above is
  execution order, not a dependency chain
- Phase 117's canary run needs a disposable scratch install of
  `@quintinshaw/pi-dynamic-workflows` — it can be primed at any point in the
  milestone
