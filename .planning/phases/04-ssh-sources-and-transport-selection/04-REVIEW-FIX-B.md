---
phase: 04-ssh-sources-and-transport-selection
slice: B
fixed_at: 2026-11-26T00:00:00Z
review_path: .planning/phases/04-ssh-sources-and-transport-selection/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 4: Code Review Fix Report, slice B

**Fixed at:** 2026-11-26
**Source review:** `.planning/phases/04-ssh-sources-and-transport-selection/04-REVIEW.md`
**Iteration:** 1

Slice B owns CR-B-02, WR-B-01, WR-B-02, WR-B-03, IN-B-01, IN-B-02, and IN-B-03.
CR-B-01 (the clone note redaction, F-04-1) and IN-B-04 belong to the slice A
fixer and are not in this report.

**Summary:**

- Findings in scope: 7
- Fixed: 5
- Skipped: 2
- Needs a user decision: 0 (no finding in this slice changes behavior to or
  from Claude Code's, so none is a parity question)

| Finding | Result | Commit | Proof |
| --- | --- | --- | --- |
| CR-B-02 | fixed | `8cf8f62` | unit cases in `update-flow.test.ts`, `reinstall-flow.test.ts`, `update-cascade.test.ts`; scenario in `features/plugin/github-transport-update.feature` |
| WR-B-01 | fixed | `bcc2148` | probe-count case in `reconcile/apply.test.ts`; cases in `update-flow.test.ts`, `marketplace/background-pass.test.ts`, `edge/handlers/marketplace/update.test.ts` |
| WR-B-02 | fixed | `08c1f0e` | caller search and `fallow dead-code --trace`; pinned cases in `clone-cache.test.ts` |
| WR-B-03 | fixed | `380ff1e` | two-probe case in `dependency-tag-probe.test.ts` |
| IN-B-01 | fixed | `cb165a3` | comment-only change |
| IN-B-02 | skipped | none | ripple reason below |
| IN-B-03 | skipped | none | ripple reason below |

## Fixed Issues

### CR-B-02: Bare `update` and bare `reinstall` show one scope's clone note on the other scope's row

**Files modified:** `orchestrators/plugin/update-flow.ts`, `orchestrators/plugin/update-cascade.ts`,
`orchestrators/plugin/reinstall-flow.ts`, `orchestrators/plugin/reinstall.messaging.ts`, and the tests
**Commit:** `8cf8f62`
**Applied fix:** each target of `updatePluginsWith` and `reinstallPluginsWith` now clones through
its own `withOwnCloneNotes(transportContext)` view, as `apply`, `fetch`, `info`, and `import` do.
An update outcome carries its view's notes (`UpdateCascadeOutcome.notes`), and its row and its
dependency rows read them in place of the command's notes. A direct failure row reads them too.
`renderReinstallPartitionAndNotify` now takes a per-outcome notes reader. The view shares the
command's checks, so the command still probes once (D-SG-19).
**Tests:** the bare update and bare reinstall cases (plugin in both scopes, only the project scope
clones) failed before the fix with the project's `Cloning via HTTPS` line under the user row, and
pass after it. The scenario "Reinstalling a github plugin in both scopes names the clone only on
the row of the scope that cloned it" (project-scope clone deleted, user clone warm) failed without
the source change and passes with it. Two D-SG-19 reinstall cases that asserted one shared context
object now assert the shared checks and the note forwarding.

### WR-B-01: `createScopeDependencyInstall` makes a new transport context on every call

**Files modified:** `orchestrators/types.ts`, `orchestrators/reconcile/apply.ts`,
`orchestrators/plugin/update-flow.ts`, and, outside the slice, `edge/types.ts`,
`edge/handlers/marketplace/update.ts`, `orchestrators/marketplace/background-pass.ts`
**Commit:** `bcc2148`
**Applied fix:** `ScopeDependencyInstallRequest` has an optional `transportContext`, and the step
uses `request.transportContext ?? newTransportContext()`. `beginPluginUpdateRun` takes an optional
second argument, the command's context. The `marketplace update` handler and the background
autoupdate pass make one context per command and give it to their plugin updates and to every
missing-dependency step they run, so the command probes once (D-SG-18). `marketplace add` and
`bootstrap` run the step once per command, so their plugin installs already share one context;
they were left as they are.
**Tests:** "two missing-dependency steps of one command clone over the context the command gives
them, so they probe once" counted `made: 2, probes: 2` before the fix and `made: 0, probes: 1`
after it.

### WR-B-02: `resolvePluginPin`'s remote-pin path is unreachable in production

**Files modified:** `orchestrators/plugin/clone-cache.ts`, `fetch.ts`, `info.ts`,
`install-clone-probe.ts`, `update-preflight.ts`, and twelve test modules under
`test/orchestrators/plugin/`
**Commit:** `08c1f0e`
**Proof of unreachability:** `fallow dead-code --trace .../clone-cache.ts:resolvePluginPin` lists
four production importers (`fetch.ts`, `info.ts`, `install-clone-probe.ts`, `update-preflight.ts`).
Each one calls it only on its pinned arm (`source.sha === undefined ? <mirror path> : <pinned>`),
so `source.sha ?? resolveRemotePin(...)` always took the left side.
**Applied fix:** `resolvePluginPin` takes a `PinnedGitSource` (`GitBackedSource` with a required
`sha`) and gives the sha as the pin, with no git port, auth bundle, or transport. The callers
narrow with the new `isPinnedSource` guard. `resolveRemotePin`, `askOverPlan`,
`MAX_PIN_ATTEMPTS`, `PinAnswer`, and `requireRemotePin` are deleted, with the 21 unit cases in
`clone-cache.test.ts` that tested only them. Three rewritten pinned cases keep the canonical github
url, the git-subdir url, and the ref hint, and one new case covers `isPinnedSource`. The seam
doubles in the other test modules lost the pin's `transport` and `auth` they no longer get.
Nothing a user sees changes.

### WR-B-03: A failed SSH tag listing is not memoized

**Files modified:** `orchestrators/plugin/dependency-tag-probe.ts` and its test
**Commit:** `380ff1e`
**Applied fix:** when the HTTPS retry of a failed SSH listing succeeds, its tags are also kept in
the run's memo under the SSH address, so a later constrained dependency on the same repository
reads them with no SSH attempt (D-SG-20 as amended, D-10-18). A listing that fails over both is
still not memoized, as before.
**Tests:** two probes of one repository over one memo queried `[ssh, https, ssh]` before the fix
and `[ssh, https]` after it. No scenario was added: the change saves network attempts and changes
no output.

### IN-B-01: Doc comments describe a "no context" behavior that no longer exists

**Files modified:** `orchestrators/plugin/update-preflight.ts`, `materialize-latest.ts`,
`install-outcome.ts`
**Commit:** `cb165a3`
**Applied fix:** the three comments now say that every command root, enable included, passes a
context, and that a missing one gets a new default context with the full skip checks and probe.
The WR-B-02 commit also removed the "pin's `ls-remote`" wording from the preflight comments.

## Skipped Issues

### IN-B-02: Leaf-level default transport contexts that no production root reaches

**File:** `orchestrators/plugin/install-clone-probe.ts:68-73`, `orchestrators/plugin/update-preflight.ts:1195-1200`
**Reason:** the change ripples beyond the slice. Making `transportContext` required on
`InstallCloneProbeOptions` and `PreparePluginUpdateOptions` (measured with `tsc`) breaks three
source callers whose own option is optional (`InstallLedgerOptions`, `ThreePhaseArgs`, and the
dependency-move context), so the requirement climbs through the guard-free ledger, the shared
update runner, and the move context. It also gives 55 type errors in seven test modules, one of
them `test/orchestrators/marketplace/update.messaging.test.ts`, outside the slice. The defaults stay;
IN-B-01 now documents them correctly, and WR-B-01 removes the multiple-probe case that the review
said a forgotten context would hide.
**Original issue:** every production root passes a context, so the leaf defaults guard a state
production never reaches and would silently hide a root that forgets its context.

### IN-B-03: The tag probes read the transport force from `process.env`

**File:** `orchestrators/plugin/dependency-tag-probe.ts:202`, `orchestrators/plugin/marketplace-tag-probe.ts:131`
**Reason:** not a local change. Neither caller of the probes (`install-cascade.ts` and
`update-constraint-gate.ts`) holds a transport context today, so reading `context.force` means
threading the context through the install cascade, the install-flow planning that builds its
options, the update constraint gate, and the preflight that calls it, and their tests. In
production both the probes and the context read `process.env`, so the force matches today and no
behavior changes. Left for a later change.
**Original issue:** a command whose context was built from another environment would list tags
under a different force than its clones use (two sources of truth for D-SG-20 and D-SG-24).

## Files touched outside slice B

- `extensions/pi-claude-marketplace/edge/types.ts` (WR-B-01: the `beginPluginUpdateRun` type)
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` (WR-B-01)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts` (WR-B-01)
- `test/edge/handlers/marketplace/update.test.ts` and
  `test/orchestrators/marketplace/background-pass.test.ts` (their WR-B-01 cases)

`orchestrators/github-transport.ts` was not edited.

## Verification

All checks ran in the isolated worktree of this fixer, not in the main checkout, so the numbers
are not reproducible from the main checkout until the branch is merged. Each commit passed the
pre-commit hook (`npm run check:commit`). The suites were run with `GIT_CONFIG_COUNT` unset: the
cloud session's own `GIT_CONFIG_*` variables make the default plugin skip checks see a rewritten
SSH URL, which fails seven github-source cases in `reinstall-flow.test.ts` at the base commit too.
Run with a bare `node --test` (without `scripts/isolated-pi-home.mjs`), six cases in
`test/orchestrators/plugin/bootstrap.test.ts` and one in `test/edge/register.test.ts` fail at the
base commit as well; `npm run test:modules` passes them.

- `npm run test:modules`: passed (exit 0).
- `npm run test:integration`: passed (exit 0).
- Cucumber, `adapter` profile, all of `features`: 2389 scenarios, 2384 passed, 5 failed. The 5
  are the known `fd` scenarios in `features/hook/tool-use.feature` (:296, :355, :443, :1696,
  :1834).
- Cucumber, `builtin` profile, all of `features`: 260 scenarios, 260 passed.
- `npm run check` was not run; the orchestrator runs it after the merge.

---

_Fixed: 2026-11-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
