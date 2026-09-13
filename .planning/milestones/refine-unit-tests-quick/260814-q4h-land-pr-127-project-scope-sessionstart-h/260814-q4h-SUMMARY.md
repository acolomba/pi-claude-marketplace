---
status: complete
phase: quick-260814-q4h
plan: 01
subsystem: bridges/hooks
tags: [external-contribution, hooks, session-start, dispatch, pr-127]
requires: []
provides:
  - "Project-scope SessionStart hooks dispatch on the session that starts them (PR #127 landed complete)"
  - "HOOK-E2E-03 pins the WR-05 half of the lazy-hydrate mkdir gate"
  - "HOOK-E2E-04 pins the OBS-01 swallow: a throwing lazy hydrate never blocks SessionStart dispatch"
  - "Root-cause record + knowledge-base digest for the session_start/resources_discover ordering trap"
affects:
  - extensions/pi-claude-marketplace/index.ts
  - tests/integration/hooks-dispatch-end-to-end.test.ts
  - CHANGELOG.md
  - .planning/debug/resolved/project-scope-sessionstart-never-dispatches.md
  - .planning/debug/knowledge-base.md
  - .planning/BACKLOG.md
tech-stack:
  added: []
  patterns:
    - "Event-order verification against the vendored pi runtime rather than the PR narrative"
    - "Gate-inversion check: break the invariant, confirm the new test fails, restore"
key-files:
  created:
    - .planning/debug/resolved/project-scope-sessionstart-never-dispatches.md
    - .planning/quick/260814-q4h-land-pr-127-project-scope-sessionstart-h/260814-q4h-PLAN.md
    - .planning/workstreams/hooks-sessionstart-hydrate/STATE.md
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - tests/integration/hooks-dispatch-end-to-end.test.ts
    - CHANGELOG.md
    - .planning/debug/knowledge-base.md
    - .planning/BACKLOG.md
decisions:
  - "Coverage measured locally rather than via Sonar: PR #127 is cross-repo, so the SonarCloud job skips on every run and the quality gate never reports"
  - "HKNC-01 filed rather than fixed inline -- removing the dead `?? []` touches the contributor's diff for a cosmetic gain"
  - "Version bump held at operator direction: CHANGELOG entry under ## [Unreleased], no version field touched, so a later release claims it"
  - "Reverted the planning-tree workstream migration that `workstream create` performed -- a ROADMAP/STATE relocation must not ride inside a community bugfix PR, and it would collide with the `workflows` workstream in flight on main"
  - "Contributor's fix accepted as submitted; the two added items are review findings, not corrections to their logic"
  - "HKDIR-01 filed rather than fixed inline -- adjacent, pre-existing, and out of the scope a contributor's PR should absorb"
metrics:
  completed: 2026-08-14
---

# Phase quick-260814-q4h Plan 01: Land PR #127 (project-scope SessionStart hydrate) Summary

Landed external contribution PR #127 (@rakesh-vs) complete. The contributor's
diagnosis and fix were correct as submitted and are unchanged; this task verified
them against the vendored pi runtime, added the two things review found missing
(a WR-05 regression test and a corrected wiring comment), recorded the root cause
in the debug knowledge base, and filed the adjacent defect the review surfaced.

## What the PR fixes

A project-scope plugin's `SessionStart` hooks never fired on the session that
started them. Pi emits `session_start` before `resources_discover`, but the
project-scope hook cache was hydrated only on `resources_discover` — so the
`SessionStart` routing bucket held user-scope entries only at dispatch time.
The hooks became reachable only after a later `/reload`. Silent: an empty bucket
is a legitimate no-op, so there was no error to see.

## Verification performed before accepting

The PR's claims were re-derived independently rather than taken on trust:

- **Event order is real, not just documented.** `agent-session.js:1761-1762` —
  `bindExtensions` awaits `emit(this._sessionStartEvent)` and only then calls
  `extendResourcesFromExtensions`, which emits `resources_discover`. `/reload`
  repeats it at `2070-2071`. The repo already carried this fact in
  `orchestrators/reconcile/apply.ts` (the A1 note); the hooks lane never used it.
- **`ctx.cwd` is populated at `session_start`.** `ExtensionContext` declares
  `cwd: string` (`core/extensions/types.d.ts:216`), served from a getter over the
  runner's own cwd set in its constructor (`runner.js:150-154`, `473-475`). This
  refutes the v1.12 research note ("`session_start`'s ctx does not obviously carry
  cwd in the same shape") that left the gap open.
- **The mkdir target matches the dispatch lane.** Exec resolves
  `locationsFor(entry.scope, ctx.cwd)` (`dispatch-exec.ts:191`, `299`) — the same
  cwd the wrapper hands `ensureSharedDataDir`, so `CLAUDE_ENV_FILE`'s directory
  lands where the hook looks for it.
- **No stale-registration or race concerns.** `/reload` builds a fresh
  `ExtensionRunner` (`agent-session.js:2037`), so wrappers do not accumulate; and
  handlers for one event are awaited sequentially (`runner.js:576-606`), so the
  cache clear inside `hydrateProjectScopeForCwd` cannot race a concurrent rebuild.
- **HOOK-E2E-02 is a real gate.** Reverting only `event-router.ts` to its pre-fix
  state fails it with 0 dispatches against an expected 1.

## What Changed

### Task 1 — Worktree, workstream, branch

- PR #127 head fetched; `main` already an ancestor, branch is exactly main plus
  contributor commit `41c60073`. No merge needed, nothing rewritten.
- Worktree at `.worktrees/pr-127`. GSD tooling is gitignored, so `.claude/gsd-core`
  and `.claude/scripts` were `cp -a`'d in (not symlinked).
- Workstream `hooks-sessionstart-hydrate` created.
- **Deviation, see below:** `workstream create` migrated the planning tree; reverted.

### Task 2 — Review findings closed

- `index.ts`: the step-3 comment said project hydrate is deferred to the first
  `resources_discover`. There are now two deferral points and the order matters,
  so the comment names both and says which runs first and why.
- `tests/integration/hooks-dispatch-end-to-end.test.ts`: added `HOOK-E2E-03`.
  User-scope-only SessionStart plugin, bridge booted against a third cwd so the
  factory's own mkdir cannot land in the project and mask the result,
  `session_start` fired against a pristine project cwd, that cwd asserted empty.
  **Gate-inversion checked:** relaxing the production gate from
  `.some((e) => e.scope === "project")` back to `.length > 0` fails the test;
  the production file was then restored from git, not by hand.

### Task 3 — Knowledge recorded

- `.planning/debug/resolved/project-scope-sessionstart-never-dispatches.md` — root
  cause, evidence, and resolution, with its provenance stated plainly (found in PR
  review, not a `/gsd-debug` session).
- `.planning/debug/knowledge-base.md` — digest entry so `gsd-debugger` surfaces
  this pattern on future hook investigations. Generalizable lesson recorded: a
  deferred initialization is only correct for events that fire *after* the point it
  was deferred to; enumerate what fires before.
- `.planning/BACKLOG.md` — `HKDIR-01`.
- `CHANGELOG.md` — entry under a new `## [Unreleased]`, crediting @rakesh-vs (#127).

### Task 4 — Verification and push

- `npm run check` green in the worktree: typecheck, lint, `format:check`, **3442
  unit tests** (1 pre-existing skip, 0 failures), **20 integration tests**
  (0 failures — 19 before, plus HOOK-E2E-03).
- `pre-commit run --all-files` at CI scope: every hook passed except TruffleHog,
  which fails with the structural linked-worktree error CLAUDE.md documents
  (`failed to read index file: .../.git/index: not a directory`).
- Filesystem TruffleHog scan over the exact committed paths per the CLAUDE.md
  route: `verified_secrets: 0, unverified_secrets: 0`, exit 0. Only then was
  `SKIP=trufflehog` used, and only for that hook.

### Task 5 — Coverage of the new code, and the gap it exposed

Ran after the PR's workflows went green. SonarCloud cannot answer this
question for #127: the job is `skipped` on every run because the PR is
cross-repo, so coverage was measured locally in `.worktrees/pr-127` and the
`unit.lcov` + `integration.lcov` records unioned by hand.

- **Measured:** `event-router.ts:899-912` is the whole executable change
  (the `index.ts` diff is comment-only). 12 of 14 lines covered; only
  `908-909` — the `catch` body — was dead, in both suites. The unit suite
  never enters the wrapper at all; all coverage of the new logic comes from
  the integration tests.
- **`HOOK-E2E-04` added.** Fires `session_start` with a ctx carrying no
  `cwd`, so `locationsFor("project", ctx.cwd)` throws
  `ERR_INVALID_ARG_TYPE` out of `hydrateProjectScopeForCwd` — that
  function's own try/catch wraps only its `loadState` call, not the
  `locationsFor` above it. Asserts the user-scope entry still dispatches:
  the OBS-01 contract that a hydrate failure degrades to a debug line
  rather than a dead SessionStart. The ctx shape is the one the bridge was
  called with before this PR, so it is a real Pi shape, not a contrivance.
- **Gate-inversion checked**, same discipline as `HOOK-E2E-03`: adding
  `throw err;` to the catch fails `HOOK-E2E-04` with `ERR_INVALID_ARG_TYPE`;
  the production file was then restored from git, not by hand. After the
  test, `DA 908/909 hits=1` and `BRDA 907 taken=1`.
- **`HKNC-01` filed.** The one branch still uncovered on the new code is the
  `?? []` fallback on line 904, and no test can close it — `rebuildRoutingTables`
  pre-seeds the `SessionStart` bucket one line earlier, so the arm is
  unreachable by construction.

## Commit SHAs

- `41c60073` — contributor commit (@rakesh-vs), preserved unrewritten.
- `e7a26455` — `test: pin the WR-05 gate on session_start project hydrate (#127)`
  (index.ts comment, HOOK-E2E-03, CHANGELOG).
- Planning artifacts committed separately on the same branch.

## Deviations from Plan

**1. [Blocking] `workstream create` migrated the whole planning tree**
- **Found during:** Task 1.
- **Issue:** `workstream create hooks-sessionstart-hydrate` reported
  `migration: {migrated: true, workstream: "milestone", files_moved: ["ROADMAP.md",
  "STATE.md"]}` — it converted `.planning/` from single-stream to workstream mode,
  relocating `ROADMAP.md` and `STATE.md` under `.planning/workstreams/milestone/`.
- **Why that could not stand:** it is a repo-wide restructure with no relationship
  to the defect, it would have landed inside a community contributor's PR, and main
  already has a `workflows` workstream half-created that it would collide with.
- **Fix:** `rm -rf .planning/workstreams/milestone` plus
  `git checkout -- .planning/ROADMAP.md .planning/STATE.md`. The new workstream's own
  directory was kept — it is purely additive.
- **Left open:** migrating to workstream mode is a real decision, worth landing
  deliberately and on its own.

**2. [Directed] Version bump held**
- **Found during:** Task 3 planning.
- **Issue:** CLAUDE.md asks for a version bump before a PR; the operator directed
  that the bump be held and only the CHANGELOG updated.
- **Fix:** `## [Unreleased]` heading, matching the precedent set by PR #88 under the
  concurrent v0.9.0 milestone. `package.json`, `package-lock.json`,
  `EXTENSION_VERSION`, and `sonar.projectVersion` are untouched and verified so.

## Self-Check: PASSED

- `npm run check` exit 0 in the worktree (3442 unit + 21 integration, 0 failures)
  — re-run after `HOOK-E2E-04`, including the pi-subagents peer tests.
- `HOOK-E2E-03` verified to fail when the gate it pins is relaxed, and to pass with
  the contributor's code restored from git.
- `HOOK-E2E-04` verified to fail when the catch it pins is made to rethrow, and to
  pass with the catch restored; `event-router.ts` confirmed byte-identical to HEAD
  afterwards.
- No version field modified: `git diff main..HEAD` touches neither `package.json`,
  `package-lock.json`, `sonar-project.properties`, nor `shared/extension-version.ts`.
- Contributor commit `41c60073` present and unrewritten; `main` is an ancestor of HEAD.
