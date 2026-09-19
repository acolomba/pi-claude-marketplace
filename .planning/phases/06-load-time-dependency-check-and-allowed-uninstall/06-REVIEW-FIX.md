---
phase: 06-load-time-dependency-check-and-allowed-uninstall
fixed_at: 2026-09-19T10:35:00Z
review_path: .planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 4
skipped: 2
status: partial
---

# Phase 06: Code Review Fix Report (iteration 2)

**Fixed at:** 2026-09-19T10:35:00Z
**Source review:** `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 6 (WR-01, WR-03, WR-09..WR-12; `fix_scope: critical_warning` excludes
  IN-02, IN-03, IN-04)
- Fixed: 4 (the four findings new to this re-review)
- Skipped: 2 (WR-01, WR-03 — both re-declined on iteration 1's reasoning)

## Verification

Gates ran in **this checkout** (`/home/acolomba/src/pi-claude-marketplace-manifest`), the
harness-supplied worktree for `features/manifest`. It carries `node_modules`, so the numbers
below are reproducible from the tree under review.

- `npx tsc --noEmit` exits 0 after every fix.
- `SKIP=trufflehog pre-commit run --files <changed>` ran clean before every commit. Its
  whole-repo local hooks (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow`,
  `npm direct coverage`) all pass; `SKIP=trufflehog` is the documented worktree skip.
- `npm test` — 6653 tests, 6653 pass, 0 fail (up 12 from iteration 1's 6641).
- `npm run test:integration` — 32 pass, 0 fail.
- WR-11's new case was **planted against the pre-fix ordering** and observed to fail (see below),
  so it is not a green test that checks nothing.

### Worktree note

`workflow.use_worktrees` is `true`, but no nested worktree was created, on iteration 1's
reasoning. The environment already places this agent in an isolated worktree for
`features/manifest` and directs that all commands run from it; the repository's main checkout
is a separate directory on a different branch (`features/gsd-model-refinements`). A nested
worktree would carry no `node_modules`, so none of the gates above could have run in it.
Staging was explicit-path only — the four modified config files and the untracked planning
files in the working tree are the operator's and were never staged.

## Fixed Issues

### WR-09: The eighth bucket was documented as seven in four places

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`,
`tests/architecture/reconcile-planner-purity.test.ts`
**Commit:** `4a8e406a`
**Applied fix:** `plan.ts:3` and the purity gate's header now say 8-bucket. The README's count,
heading and numbered list are renumbered to eight with `pluginsToDependencyDisable` inserted in
its `types.ts` position, and both the file sketch and the purity paragraph carry the four-argument
`planReconcile` signature. `apply.ts`'s CONTRACT block names the verdict argument.

**Two sites beyond the review's list, same finding, same files:**

- `apply.ts`'s apply-order sketch omitted the dependency-disable step, which its own
  `applyPlan` doc comment 900 lines below lists as step 7 of 8 — the identical
  one-file-states-both shape WR-09 is about. The README's apply-order block had the same gap.
- The README's "Sentinel contracts" section claimed "one structural sentinel, plus one explicit
  schema field". There are now two: `dependencyDisabled` is a planner/apply coordination field
  with two decision readers. It gets its own entry naming both, and naming where the marker is
  cleared (`install-outcome.ts`'s state-phase literal rebuilds the record without it).

**Deliberately not changed:** `docs/competitive-analysis/pi-plugins.md:752` also says "seven
buckets". That document is a dated snapshot ("Analysis date: 2026-08-10", "Baseline:
pi-claude-marketplace v0.13.0") whose own snapshot rule pins every claim to one commit — it
already describes `state.json` as accepting schemaVersion 1 or 2, where current is 3. Updating
it would break the snapshot contract, not repair drift.

### WR-10: The projection's bucket-to-row contract never learned about the eighth bucket

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`
**Commit:** `185703d8`
**Applied fix:** Both mapping lists — the module header and
`buildReconcilePendingNotification`'s own doc comment — gain a `pluginsToDependencyDisable`
entry stating the token it previews as, that it folds into the `pluginsToDisable` loop, that
`claimedPluginKeys` keeps the two buckets from naming one plugin twice, and that the bucket is
empty for every caller today (PENDING-VERDICT-01 / D-06-25).

Two further enumerations of the plan's buckets, both behind the D-66-05 "no update bucket"
claim (the `resolvePendingForceInstalls` header and the comment inside the install loop), were
likewise a member short and now list the bucket.

### WR-11: The CR-01 fix shipped with nothing pinning it

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`,
`tests/orchestrators/reconcile/apply.test.ts`,
`tests/orchestrators/reconcile/types.test.ts`
**Commit:** `4c594188`
**Applied fix:** Took the review's first arm — the seam — rather than the source-level
assertion. `ApplyReconcileOptions` gains an optional `stampDependencyDisabled` port
(`DependencyDisableStamp`), which is the third seam on that bundle and follows the two D-12
seams already there (`gitOps`, `uninstallPlugin`). Production callers omit it and the module's
own `stampDependencyDisabled` applies. The field's doc comment records why the seam exists:
the emission point has no other observable, because the stamp and the `setPluginEnabled` write
before it take the same lock and write the same file.

The new case (`apply.test.ts`, "CR-01: a throwing marker stamp keeps the dependency-disable row
on the cascade") injects a stamp that throws `StateLockHeldError` and asserts the whole
emission: the `{dependency unsatisfied}` disable row AND the `state.json` `{lock held}` row the
`runScopeIsolated` wrapper builds from the throw, with the `2 failures, 1 warning` tally.

**Negative control run, not assumed.** With the two `outcomes.push` calls moved back below the
stamp — the pre-fix ordering — the case fails, and it fails in exactly the shape CR-01
described: the disable row is absent from the emission entirely and the tally drops to
`2 failures`. The pre-fix ordering was restored from a backup and the case re-run green.

The expected notification bytes were composed from the two existing renderings in the same
file (the LOAD-01 disable row and the lock-held `state.json` block) plus `composeTally`'s
failures-then-warnings order, and matched the run on the first attempt.

### WR-12: The T-06-01 / T-06-02 provenance claim was false for half of every interpolated key

**Files modified:** `extensions/pi-claude-marketplace/domain/dependencies.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts`,
`docs/output-catalog.md`, `tests/domain/dependencies.test.ts`,
`tests/orchestrators/reconcile/apply-outcomes.test.ts`,
`tests/orchestrators/plugin/uninstall.messaging.test.ts`
**Commit:** `486487a4`
**Applied fix:** Took the review's second arm — validate, do not merely re-document.
`isRenderablePluginKey` joins `domain/dependencies.ts`, beside the `TOKEN_PATTERN` it reuses
and next to `isRenderableDependencyToken`, which is where the module header already says every
rendered field is allowlisted. It splits on the first `@` (the alphabet admits none) and
requires both halves to pass the token rule — the same shape as the private `splitKey` in
`domain/dependency-closure.ts`.

- `apply-outcomes.ts::dependencyRemedy` now quotes a party only after `remedyParty` clears its
  key, and otherwise says `the declared dependency` or `this plugin`. The row's own subject
  still names the held-down plugin, so the key-less sentence stays actionable.
- `uninstall.messaging.ts::composeUninstalledRow` routes the dependents through
  `renderDependents`, which joins the keys when every one of them clears and otherwise reports
  the count (`required by 2 other plugins`). The next load gives each dependent its own row, so
  no fact is lost.
- Both cause-line comments now state the real provenance instead of the claim the code did not
  support.

**The cleared path is byte-identical**, so every catalogued form and every existing byte-pinned
case is unchanged; the whole suite (6653) passes.

**New information the review did not have.** The review held that `held.dependency` has token
provenance and only the `dependent` half lacks it. That is half right. The dependency key is
built as `` `${dependency.name}@${dependency.marketplace}` ``, and
`dependency-index.ts::readRecordDeclarations:212` fills the marketplace from
`dep.marketplace ?? marketplace.name` — the fallback is the DECLARING RECORD's marketplace
name, which is state-derived and `assertSafeName`-bounded like the dependent. A declaration
that names no address is the ordinary case, so the dependency key is usually just as
forgeable. The fix therefore checks **both** parties, not only the dependent.

**Tests:** seven rows for the new predicate (including a bidi-control key, built with
`String.fromCodePoint` because a repository hook forbids the literal character in tracked
source), two remedy cases (a quote-forging plugin name; a hostile marketplace name that takes
both parties down at once), and two uninstall cases covering the plural and singular count
forms. Each discriminates: written against the old code they render the forged text.

**Docs:** `docs/output-catalog.md` is the catalogue of rendered forms, so both affected
sections record the guard and the fallback wording. `docs/dependency-resolution.md` was left
alone — it shows the same three sentences, and stating the caveat twice invites the two copies
to drift.

**Wants an operator nod:** the two fallback wordings (`the declared dependency` / `this
plugin`, and `required by N other plugins`) are new output forms on a surface the project
treats as a catalogued vocabulary. The mechanism is settled; the exact words are a call the
operator may want to make.

## Skipped Issues

### WR-01: `/claude:plugin pending` previews `(will enable)` for a plugin the next reload holds down

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:207`
**Reason:** Re-declined on iteration 1's reasoning, which this iteration found nothing to
change. It is a design decision with a carrier — backlog item `PENDING-VERDICT-01` / D-06-25 —
not a mechanical repair. The reviewer's own re-review says it is "not re-litigated here" and
that "nothing in this iteration changes the shape of the remedy". The smaller fallback remains
rejected for the reason recorded in iteration 1: it would make `plan.ts` read the marker at a
second action-deciding site, contradicting the invariant restated for WR-04 one commit earlier.

### WR-03: One stale record aborts the whole scope's check and emits an error row on every reload

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:192-195,
255-271`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:999-1026`
**Reason:** Re-declined on iteration 1's reasoning. The remedy reopens the D-05-07 fail-closed
posture, which `readRecordDeclarations` shares with `buildScopeDeclarationIndex` — uninstall's
dependents guard — so relaxing it here silently stops a dependent from blocking an uninstall
there. That is a phase-contract decision, and an automated fix would also rewrite the two tests
that currently pin the posture as intentional.

**Carrier still missing.** The review repeats iteration 1's note: unlike WR-01, nothing tracks
WR-03. It should get a backlog item before the phase closes.

## Out of scope this iteration

`fix_scope` is `critical_warning`, so the three Info findings were not attempted.

- **IN-02** (`NO_HELD_DECLARERS` freezes the wrapper but not the array) — a one-line change,
  open by process rather than by decision.
- **IN-03** (a check-held record is indistinguishable from a user disable on `list` / `info`) —
  wants a follow-up item, not a review fix.
- **IN-04** (a failed marker stamp is not self-healing) — worth flagging: this is the one Info
  finding that describes a real behaviour the code does not document. `isAlreadyDependencyDisabled`
  requires the marker, so an un-stamped held record stays in the bucket forever and re-drives a
  no-op `setPluginEnabled` on every session start. The user-visible surface stays silent
  (RECON-05 holds) and the plugin ends in the correct state. Its cheap remedy — extending the
  `stampDependencyDisabled` header to say a failed stamp is not self-healing — was left out
  only to keep this iteration's commits inside the declared scope. **WR-11's new seam makes the
  expensive remedy testable**, should the operator prefer the re-stamp arm.

## Follow-ups for the operator

1. **WR-12 wording.** Confirm the two fallback sentences, or name the wording you want.
2. **WR-03 carrier.** It needs a backlog item; WR-01 already has `PENDING-VERDICT-01`.
3. **IN-04.** Decide between the header note and the re-stamp on the `skipped` arm.
4. **Iteration-1 follow-ups 2 and 3** (the WR-07 behaviour decision and the WR-08 structural
   half) are unchanged and still open.

---

_Fixed: 2026-09-19T10:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
