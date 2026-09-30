---
phase: 01-presentation-model
fixed_at: 2026-09-30T00:00:00Z
review_path: .planning/phases/01-presentation-model/01-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-30T00:00:00Z
**Source review:** .planning/phases/01-presentation-model/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 2 (WR-01, WR-02; IN-01..IN-05 are out of scope)
- Fixed: 2
- Skipped: 0

Both fixes change tests only. No production file changed.

## Fixed Issues

### WR-01: The context wrappers are only tested with markers on

**Files modified:** `tests/shared/notify-context.test.ts`
**Commit:** 3093a652
**Applied fix:** The D-12 loop now registers two cases for each of the four
wrappers (`notifyWithContext`, `notifyUpdateWithContext`,
`notifyUpdateNoOpWithContext`, `notifyReconcileAppliedWithContext`). The
existing on case keeps `markers: { installed: true }` and expects
`alpha {requires pi-subagents}`. The new off case uses
`markers: { installed: false }` with the same `dependencies: ["agents"]` row and
the nothing-loaded run, and expects `alpha {}`. The strict `ui.notify` mock
rejects any other bytes. Two small seed functions (`installedMarkerContext`,
`installedAgentsRows`) build the context and rows for both cases.

**Red/green evidence (planted mutations, reverted with `git checkout --`):**
In `shared/notify-context.ts`, each wrapper's `context.markers` argument was
replaced in turn, once with `CENTRAL_MARKER_POLICY` and once with an all-true
policy (a `Proxy` returning `true`). That makes eight runs of
`node --test tests/shared/notify-context.test.ts`:

| Wrapper mutated | `CENTRAL_MARKER_POLICY` | all-true |
|---|---|---|
| `notifyWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyUpdateWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyUpdateNoOpWithContext` | exit 1, only its off case red | exit 1, only its off case red |
| `notifyReconcileAppliedWithContext` | exit 1, only its off case red | exit 1, only its off case red |

In every run, the pre-existing on case stayed green. That confirms the review:
the old test could not see these mutations. With the production file restored,
the suite runs 21 cases with exit 0.

### WR-02: The SC-5 marker-policy table does not check that it lists every context

**Files modified:** `tests/architecture/soft-dep-marker-policy.test.ts`, `tests/architecture/gate-targets.ts`
**Commit:** 25691b07
**Applied fix:** The fix covers both directions of the review.

- **Row totality:** The literal table is now the named `MARKER_POLICY_TABLE`.
  A new case, `SC-5: the table states every declared marker policy exactly once`,
  compares the sorted row names with the sorted `DECLARED_MARKERS` keys. A
  deleted row or a doubled row makes this case red.
- **Source-derived context totality:** A new case,
  `SC-5: DECLARED_MARKERS names every command context the extension declares`,
  uses the house `filesMatching` walk over `EXTENSION_ROOT_REL` with the
  pattern `/\bsatisfies\s+CommandContext</`. It strips comments with
  `stripComments`. It labels each pin with the last `export const` name before
  it and the path relative to `ORCHESTRATORS_REL`. This is the same label form
  `DECLARED_MARKERS` uses, for example `INSTALL_CONTEXT (plugin/install.messaging.ts)`.
  The case compares the result with the `DECLARED_MARKERS` keys minus
  `CENTRAL_MARKER_POLICY`, which is not a context. The check is per context, not
  per file. So a second context added to a file that is already listed also makes
  the case red. A pin with no `export const` before it gets the label
  `(unexported)`, which can never match the table.
- **Planted control:** A new case,
  `SC-5: the context scan reports a context planted in a copy of a real messaging module`,
  uses `withTempRoot` and `plantOffender`. It appends a `PLANTED_CONTEXT ... as const satisfies CommandContext<never, never>`
  declaration to a copy of `orchestrators/plugin/install.messaging.ts`. The case
  asserts that the scan finds exactly the `INSTALL_CONTEXT` and
  `PLANTED_CONTEXT` labels.
- **Registry (D-07-06):** The planted host is registered in a new
  `MARKER_POLICY_CONTROL_TARGETS` group in `gate-targets.ts`. The test's local
  constant is typed `(typeof MARKER_POLICY_CONTROL_TARGETS)[number]`. The gate
  file builds no path from `.ts` segments. `gate-targets.test.ts` stays green.

**Red/green evidence (planted, then restored):**

- (a) Deleting the `INSTALL_CONTEXT` row from the table: exit 1. Only the
  row-totality case is red.
- (b) Removing `NOAUTOUPDATE_CONTEXT` from both `DECLARED_MARKERS` and the table:
  exit 1. Only the source-derived case is red, and its diff shows
  `+ 'NOAUTOUPDATE_CONTEXT (marketplace/autoupdate.messaging.ts)'`.
- (c) Appending an unregistered `STRAY_CONTEXT` to the real
  `orchestrators/marketplace/add.messaging.ts`: exit 1. Only the source-derived
  case is red, and its diff shows `+ 'STRAY_CONTEXT (marketplace/add.messaging.ts)'`.
  The production file was restored with `git checkout --`.

With the files restored, the suite runs 22 cases with exit 0.

## Verification

All gates ran in the main working tree of the `features/json` worktree
(`/home/acolomba/src/pi-claude-marketplace-json`). No nested review-fix
worktree was created. The gates need this checkout's `node_modules`, and the
caller named this worktree as the working directory. The numbers below can be
reproduced from this tree. The exit codes were read directly, not through a
pipe.

- `node --test tests/shared/notify-context.test.ts`: exit 0 (21 tests)
- `node --test tests/architecture/soft-dep-marker-policy.test.ts`: exit 0 (22 tests)
- `node --test tests/architecture/gate-targets.test.ts tests/architecture/partial-vocabulary-guard.test.ts tests/architecture/no-stale-test-citations.test.ts`: exit 0 (78 tests)
- `npm run typecheck`: exit 0 (before each commit)
- ESLint on the changed files: exit 0 (before each commit)
- `npx fallow health`: exit 0, 0 above threshold (before each commit)
- `npm run fallow`: exit 0 (before each commit). Its dupes summary prints a
  `✗` glyph, but the exit code is 0.
- `fallow audit --gate-marker agent`: verdict `warn` (not `fail`). It reports
  0 dead-code issues, 0 complexity findings, and 17 clone groups. These are the
  same 17 pre-existing groups the review classified.
- `SKIP=trufflehog pre-commit run --files <changed files>`: exit 0 for each
  commit, and no hook rewrote a file.
- `npm test`: exit 0 (7364 tests, 0 failed) after both commits.
- The type-member pins in `scripts/check-unused-type-members.*.json` name none
  of the touched files, so no repin was needed.

---

_Fixed: 2026-09-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
