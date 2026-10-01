---
phase: 01-presentation-model
fixed_at: 2026-10-01T00:00:00Z
review_path: .planning/phases/01-presentation-model/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-10-01T00:00:00Z
**Source review:** .planning/phases/01-presentation-model/01-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (WR-01, WR-02, IN-01..IN-05)
- Fixed: 7 (WR-01 and WR-02 in the first pass; IN-01, IN-02, IN-04 in the
  second pass; IN-03 and IN-05 in this pass, after the operator approved the
  IN-03 recorded exceptions and the IN-05 corpus re-baseline)
- Skipped: 0

No committed fix changes user-visible output bytes. IN-01 changes comments
only. IN-02, WR-01, and WR-02 change tests only. IN-03 adds a type-only refusal
marker and a type-level control. IN-04 changes the operator-run corpus scripts
only. IN-05 deletes two tests, their helper and a comment; the corpus loses
exactly the two entries those tests emitted.

## Fixed Issues

### WR-01: The context wrappers are only tested with markers on, so ignoring `context.markers` would pass every test

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

### IN-01: Comments still describe render-time probes

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`
**Commit:** 8f6a4f69
**Applied fix:** Comments only.

- `update-swap.ts` (success block above `stagedAgentNames`): the comment now
  says that `resolveRows` composes `{requires pi-subagents}` /
  `{requires pi-mcp}` from the command run's snapshot under the context's
  marker policy (D-05, D-12), iff (declares AND unloaded).
- `update-row.ts` (`updatedRowFromOutcome` doc, the out-of-list site the review
  named): "renderer-time" and "the notify-time probe" are gone. The comment
  says that `resolveRows` composes the markers from `dependencies` membership
  and the command run's snapshot under the context's marker policy.
- `marketplace/list.ts` (`ListMarketplacesOptions.run`): the doc now says the
  run is threaded for the shared emitter signature, and that `LIST_CONTEXT`
  declares no marker policy, so its snapshot composes no markers here.

No type-member pin names these lines. The pins in `update-swap.ts` sit at line
219-222, above the edit, and the edit keeps the line count there.

### IN-02: `CommandProbes.probingEmissions` is a dead test member that describes surfaces that no longer exist

**Files modified:** `tests/edge/register.test.ts`
**Commit:** 6bc023d7
**Applied fix:** The `probingEmissions` member is deleted from `CommandProbes`,
and `toolReads` is now `probes.runs * 3`. All 15 sites that passed
`probingEmissions: 0` (the default parameter and 14 call sites) now pass
`{ runs: N }`. The doc comment now states one count: each handler invocation
opens one notification run whose snapshot reads the inventory three times
(D-05). The interface is kept, not replaced by a bare number, so each call site
still names what the count is. `node --test tests/edge/register.test.ts`: exit
0, 164 tests.

### IN-03: Row composers accept unresolved producer rows structurally, so markers can be dropped silently

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts`, `tests/shared/notification-grammar.test.ts`, `scripts/check-unused-type-members.exceptions.json`, `scripts/check-unused-type-members.contracts.json`
**Commit:** fb68e4bf
**Applied fix:** The operator approved the three recorded exceptions on
2026-10-01.

- **Guard.** The `p` parameter of `pluginRow`, `partiallyInstalledRow`, and
  `installedLikeRow` now declares `readonly dependencies?: never;`. Each
  composer's JSDoc gains one D-13 paragraph that says the refusal rejects an
  unresolved producer row. Every production caller already passes a
  `ResolvedRow`, which omits `dependencies`, so no caller changed.
- **Type-level control.** `tests/shared/notification-grammar.test.ts` now pins
  six assignability facts with an `Assignable<A, B>` helper. For each
  composer, the resolved row is accepted (`true`) and the raw producer row is
  refused (`false`). `pluginRow` and `partiallyInstalledRow` use
  `PluginPartiallyInstalledMessage` (list renders that status through
  `pluginRow`). `installedLikeRow` uses `PluginInstalledMessage`.
- **Recorded exceptions.** Three entries were added to
  `scripts/check-unused-type-members.exceptions.json`, modeled on the WR-01
  `enableRowDependencies.signals.partition` entry:
  `notification-grammar.ts:532:5 pluginRow.p.dependencies`,
  `:567:5 partiallyInstalledRow.p.dependencies`, and
  `:615:5 installedLikeRow.p.dependencies`. Each `decision` cites D-13 and the
  operator approval on 2026-10-01. Each `mechanism` explains why no contract
  entry can reach the marker and names the type-level control.
- **Repin.** The edit adds 12 lines above the existing
  `notification-grammar.ts` pins in
  `scripts/check-unused-type-members.contracts.json`, so each pin moved by
  +12 lines. `isDescriptionBearingRow` moved from 1401 to 1413 (id `:32`,
  filter `:9`). `renderPendingRow.p` moved from 789 to 801 (id), and its
  filter moved from 787 to 799. These numbers were recomputed on the
  post-merge tree. The `+7` in the earlier skip entry is obsolete. Prettier
  ran before the repin.

**Proof by removal:** With the three guard lines deleted from a scratch copy,
`npx tsc --noEmit -p tsconfig.json` exited 2 with exactly three errors, all
TS1360 (`Type 'false' does not satisfy the expected type 'true'`), at
`tests/shared/notification-grammar.test.ts` lines 87, 92, and 94. Those are the
three `false` lines. The guarded file was then restored from the scratch
copy, and `tsc` exited 0.

**Gate evidence:** Before the exceptions were added,
`node scripts/check-unused-type-members.mjs` exited 1 with exactly the three
`unread` findings above. After they were added, it exited 0 with
`passed with 7 recorded exception(s)`. `npm run lint:type-members:negative`
exited 0 (7 of 7 controls).
`node --test tests/shared/notification-grammar.test.ts tests/architecture/unused-type-member-gate.test.ts`
exited 0 (121 tests). Direct coverage for `notification-grammar.ts` passed with
180/180 branches, 47/47 functions, and 1586/1586 lines.

### IN-04: Corpus tooling fragilities

**Files modified:** `scripts/notify-corpus.mjs`, `scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.negative.mjs`
**Commit:** 736e69fc
**Applied fix:**

1. **Argument order.** A new `flagValues(args, flag)` helper in
   `notify-corpus.mjs` returns the values after a flag, up to the next `--`
   flag. `parseCaptureArgs` reads `--files` through it, so
   `capture --files a.test.ts --out x.jsonl` no longer reads `x.jsonl` as a
   test path.
2. **Hook receiver.** The hook regex is now the module constant
   `bareReceiverCall`, `/(?<![\w$.])([A-Za-z_$][\w$]*)\.ui\.notify\(/g`. After
   the rewrite, the load hook compares the literal `ui.notify(` count with the
   match count. If they differ, it throws
   `notify-corpus: <url> spells N ui.notify( calls, but only M have the bare X.ui.notify( receiver the hook can rewrite`.
   So a member-access receiver or a destructured `ui.notify(` now fails to load
   with an error. Before, the first became broken code that threw only when
   called, and the second went unrecorded. The hook doc states the rule. A scan
   of every `.ts` file under `extensions/pi-claude-marketplace/` found no module
   where the two counts differ, so the stricter hook refuses nothing today.
3. **Controls** (there is no `tests/scripts/` pair for these operator-run
   scripts; their test is `notify-corpus.negative.mjs`, so the controls go
   there):
   - Control 5 runs `capture --files <test> --out <existing capture file>` and
     asserts exit 0 and the same entries as Control 4.
   - Control 6 plants three `.ts` files under
     `<tmp>/extensions/pi-claude-marketplace/` and loads each with
     `node --import <hook>` and `NOTIFY_CORPUS_OUT` set. The bare
     `ctx.ui.notify(` loads with exit 0. `opts.ctx.ui.notify(` and a
     destructured `ui.notify(` exit non-zero, with the refusal on stderr.

**Red/green evidence:**

- `node scripts/notify-corpus.negative.mjs` with the fix: exit 0.
- With the previous hook restored (`git show HEAD:...`): exit 1,
  `AssertionError: member:`. The member-receiver file loaded cleanly.
- With the previous `parseCaptureArgs` restored: exit 1,
  `The test run exited 1, so its corpus is incomplete`.

An earlier draft of Control 5 wrote to a new `--out` path, and it passed
against the old parser too. On Node 26, `node --test` reads a path that does
not exist as a glob that matches nothing, so the stray token did no harm. The
control now points `--out` at an existing file, which the old parser ran as a
test file. Both production files were restored from scratch copies after each
red run, and the final green run was repeated.

### IN-05: Resolve's read order is constrained by a test's getter-backed `kind`

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts`, `tests/shared/notification-dispatch.test.ts`, `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl`, `.planning/phases/01-presentation-model/notify-corpus/meta.json`
**Commit:** 52863f55 (preceded by the drift-only re-baseline 557d39a3)
**Applied fix:** `messageWithKindSequence` and its two getter-backed tests
(`summary computation preserves its read-only empty fallback after narrowing`
and `summary computation preserves its available-plugin empty fallback after narrowing`)
are deleted, and so is the three-line comment in `resolveEnvelope` that cited
the tests' read order. The empty-summary arms stay covered without a getter by
`tests/shared/notification-summary.test.ts`. Direct coverage stays at 100% on
`notification-dispatch.ts`, `notification-resolve.ts` and
`notification-summary.ts`. No type-member pin names `notification-resolve.ts`.

**Corpus re-baseline (D-03), split in two commits as the operator chose:**

- The committed baseline already disagreed with the post-merge tree before
  IN-05 touched anything (`notify-corpus check` exited 1: 2 missing, 24 extra
  groups). `557d39a3` re-baselined that drift alone, with the IN-05 edits set
  aside: 2622 -> 2663 entries, 2 removed and 43 added. The two removals are the
  `urlmp-403` and `urlmp-private` cause lines that main's credential-helper
  work (#221) rewrote; main's own tests assert the new text. The 43 additions
  are main's new tests (34), the D-12 wrapper on/off cases (8), and one
  `notification-dispatch.test.ts` row (`alpha (installed)` / `beta (reinstalled)`);
  no existing entry changed.
- `52863f55` re-baselined with the IN-05 edits in place: 2663 -> 2661, a
  multiset diff of exactly two removed entries, both
  `tests/shared/notification-dispatch.test.ts`,
  `"\n\n⊘ official [user] (failed) {marketplace not added}"`, `error`,
  argc 2, and nothing added. That meets the operator's condition.

## Verification

All gates ran in the main working tree of the `features/json` worktree
(`/home/acolomba/src/pi-claude-marketplace-json`). No nested review-fix
worktree was created. The gates need this checkout's `node_modules`, and the
caller named this worktree as the working directory. Exit codes were read
directly, not through a pipe.

IN-03 pass (IN-05 then held back):

- `node scripts/notify-corpus.mjs check` before any edit: exit 1 (two missing,
  24 extra groups; listed under IN-05).
- `SKIP=trufflehog pre-commit run --files <the four IN-03 files>`: exit 0
  before the IN-03 commit. It ran `prettier`, `npm lint`, `npm format check`,
  `npm typecheck`, `npm fallow`, `npm direct coverage (changed pairs)`,
  `npm type members`, and `npm type members (negative controls)`. No hook
  rewrote a file, and `git status` showed only the four IN-03 files.
- `fallow audit --format json --quiet --explain --gate-marker agent` before the
  commit: verdict `warn` (not `fail`), 0 dead-code issues, 0 complexity
  findings, 17 pre-existing duplication groups.
- `node scripts/check-unused-type-members.mjs`: exit 0 (7 recorded
  exceptions). `npm run lint:type-members:negative`: exit 0 (7 of 7).
- `npm run check`, once, after the last commit (`fb68e4bf`): **exit 0**. The
  working tree still held the uncommitted IN-05 edits, so this run covers
  `fb68e4bf` plus those edits. The edits only delete two tests, a test helper,
  and a comment. Unit coverage run: 7550 tests, 0 failed. Integration run: 36
  tests, 0 failed. The type-member gate passed with 7 recorded exceptions.
- `SKIP=trufflehog pre-commit run npm-coverage-direct --files <IN-03 and IN-05 files>`
  after `npm run check`: **exit 0**. The hook runs with `--base HEAD`, so this
  run selected the uncommitted IN-05 pairs. The committed IN-03 pair passed the
  same hook in its pre-commit run. Its explicit run,
  `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-grammar.ts`,
  also exited 0 (180/180 branches, 47/47 functions, 1586/1586 lines).

Earlier passes (WR-01, WR-02, IN-01, IN-02, IN-04): see the evidence under
each finding. `npm run check` was exit 0 after the IN-04 commit.

---

_Fixed: 2026-10-01T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

IN-05 completion (orchestrator):

- Drift-only `node scripts/notify-corpus.mjs baseline`: exit 0, 2663 entries.
  `SKIP=trufflehog pre-commit run --files <baseline.jsonl meta.json>`: exit 0.
- IN-05 `node scripts/notify-corpus.mjs baseline`: exit 0, 2661 entries, 7585
  tests passed and 0 failed during the capture.
- `SKIP=trufflehog pre-commit run --files <the four IN-05 files>`: exit 0,
  including `npm lint`, `npm format check`, `npm typecheck`, `npm fallow`,
  `npm direct coverage (changed pairs)` and `npm type members`. No hook
  rewrote a file.
