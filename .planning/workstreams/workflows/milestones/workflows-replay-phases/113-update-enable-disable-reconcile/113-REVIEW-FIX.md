---
phase: 113-update-enable-disable-reconcile
fixed_at: 2026-09-06T18:00:00Z
review_path: .planning/workstreams/workflows/phases/113-update-enable-disable-reconcile/113-REVIEW.md
iteration: 2
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 113: Code Review Fix Report (iteration 2)

**Fixed at:** 2026-09-06
**Source review:** `.planning/workstreams/workflows/phases/113-update-enable-disable-reconcile/113-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 8 (1 critical, 5 warning, 2 info)
- Fixed: 8
- Skipped: 0

`npm run check` exits 0. Member by member:

| Member | Result |
|---|---|
| `typecheck` | pass |
| `lint` | pass (0 problems) |
| `fallow` (dead-code) | `✓ No issues found` |
| `fallow` (health) | `0 above threshold · 11764 analyzed · maintainability 92.3` |
| `fallow` (dupes) | `1,015 lines (1.4%) across 39 files` — unchanged, under threshold |
| `format:check` | `All matched files use Prettier code style!` |
| `test:corresponding` | `Corresponding-test gate passed.` |
| `test:corresponding:negative` | `Corresponding-test negative controls passed.` |
| `test:coverage:direct:negative` | `Direct-coverage negative controls passed.` |
| `test` | 5530 pass / 0 fail (was 5528; +2 redaction table cases) |
| `test:integration` | 34 pass / 0 fail |

No `fallow` threshold override and no suppression marker was added. STATE.md and
ROADMAP.md are untouched. No output-catalog fixture moved: the revert restores
the bytes that shipped before `3c500dee`, and `catalog-uat` is green.

## Fixed Issues

### CR-01: Redacting phase-3 failure text destroyed the manual-recovery instructions

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
`extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/shared/errors.ts`,
`tests/orchestrators/plugin/update.test.ts`,
`tests/bridges/workflows/stage.test.ts`
**Commit:** `675e4e9f`

**Applied fix: reverted, as directed — not patched.** `redactUpdatePhase3Failures`
is gone and `composePhase3FailureOutcome` restates nothing: `msg`, `notes`,
`phaseFailures` and the `cause` chain carry the producers' text verbatim again.
`redactCauseChain` was that function's only caller, so it is deleted too, and
`causeChain` / `linkMessage` go back to module-private in `errors.ts` (they were
widened only to build it).

The production diff against `a78b141c` — the commit before the redaction — is now
exactly one added comment in `update.ts`; `notify.ts` and `errors.ts` are
byte-identical to their pre-redaction state.

**What the comment now says**, in place of the removed claim that redaction was
safe: this text is exempt because it IS the recovery instruction. A target and
its displaced copy share a basename by construction, so basename collapse renders
the two endpoints of "move it back by hand" as the same file name, and the
staging leak degrades to a bare UUID with no parent. It also names the
`manualRecoveryLeaks` precedent that renders the same class verbatim.

I did not carve out a narrower redaction. Every path in these six arms is
actionable — the staging root is the tree an operator has to go and delete, the
two envelope endpoints are the move — so no narrow distinction fell out.

**Tests.** Two cases, at the two levels where the claim lives:

- `tests/bridges/workflows/stage.test.ts` — the existing restore-failure case
  (the arm iteration 1's test never reached) now parses the two endpoints out of
  the leak sentence and pins that they differ *while their basenames are equal*.
  That second assertion is the regression itself, stated as a fact about the
  string. Negative control run: re-introducing `path.basename` at the producer
  fails this case (28 pass / 1 fail).
- `tests/orchestrators/plugin/update.test.ts` — iteration 1's test is inverted
  and renamed. It now asserts the rendered row contains the absolute staging
  tree, i.e. the composer passes the producer's bytes through untouched.

### WR-01: `redactCauseChain` silently dropped the `(truncated)` marker

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `675e4e9f`

**Fixed by removal.** The rebuilt chain could not carry the marker because it
rebuilt exactly the bounded walk and left the deepest link with no onward cause.
With the function deleted, the phase-3 `cause` is the producer's own chain and
`causeChainTrailer` derives ` (truncated)` from the real shape — which is what
the five-leak workflows arm the review traced actually produces. No sentinel-link
workaround was needed.

### WR-02: `redactCauseChain` erased error classes the renderer narrows on

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
**Commit:** `675e4e9f`

**Fixed by removal.** Every rebuilt link was a plain `Error`, which would have
made `manualRecoveryLeaks(p.cause)`'s `instanceof ManualRecoveryError` search
unable to succeed. The chain now reaches the renderer with its classes and
payloads intact, so the trap the review described is not merely disarmed for
today's producers — there is no longer a re-wrapping step for a future
`ManualRecoveryError` to be flattened by.

### WR-03: The "Phase 3b aggregate error path" JSDoc was orphaned again

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `675e4e9f`

**Applied fix:** the interposed function and its doc are gone, so the PUP-9 block
sits directly on `composePhase3FailureOutcome` again. I also scanned all twelve
reviewed files for the same drift (a `*/` line immediately followed by a `/**`
line): zero hits, so no sibling block drifted the same way.

### WR-04: The scheme-matching regex mangled URLs

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`,
`tests/shared/notify.test.ts`
**Commit:** `8c0c1ebf`

**Applied fix:** `redactAbsolutePaths` may now only start a match where a path
can start — `(?<![\w:/\\])` — so a URL scheme can open neither the drive-letter
alternative (`s:/` of `https://`) nor the POSIX one. This is a fix to the shared
seam, not to the widened call site: the mangling reached every caller.

Verified against the live regex before and after. `https://github.com/org/repo.git`
went to `httprepo.git` and now survives byte-for-byte; the POSIX, drive-letter,
extended-UNC and JSON-pointer cases are unchanged, as is a path after `key=`.
Two cases added to the table at `tests/shared/notify.test.ts` (URL preserved,
`path=` still redacted). Negative control run: removing the lookbehind fails the
URL case (254 pass / 1 fail). Also re-ran every other consumer of the seam
(`catalog-uat`, `reconcile/*`, `enable-disable`): 327 pass / 0 fail.

The doc records the one behavior this trades away: a path embedded in a `file://`
URL is no longer redacted. Nothing in the extension composes one, and a mangled
URL reads worse than an unredacted one.

### WR-05: The redaction path had no test on the arm where it mattered

**Files modified:** `tests/bridges/workflows/stage.test.ts`,
`tests/orchestrators/plugin/update.test.ts`
**Commit:** `675e4e9f`

**Applied fix:** covered by the two cases described under CR-01. The review's
half (a) — direct unit tests for `redactCauseChain` over a >5-link chain, a
non-Error link and a self-referencing cause — is void: the function no longer
exists.

**One deviation from the review's half (b), stated plainly.** It asked for an
*orchestrator* test that fails a workflows rename and its reversal. That arm is
not reachable from `updatePlugins` with filesystem manipulation alone: every
lever that fails a restore or a reversal (an occupied target, a sealed
directory) also fails the displacement that has to succeed first, and the
orchestrator offers no hook inside the commit. The bridge suite reaches it
through its `redefineRenamePairPath` / patched-`locations` seams, so the
distinguishability claim is pinned there, and the orchestrator case pins the
complementary claim that the composer does not transform what the bridge
produced. Together they cover the defect; separately, neither would.

### IN-01: `notify-reasons.ts` said "placed" where update passes "staged"

**Files modified:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
**Commit:** `d4db1b4e`

**Applied fix:** verified both halves first — enable passes
`summary.stagedWorkflowNames` (assigned from `onPlaced`) and reinstall passes
`placedWorkflowNames`, both placed; update passes
`handles.workflows.result.stagedNames`, which are prepared. The WLIF-06 note now
says update passes PREPARED names and states why they equal the placed ones
there: the call site sits past the `hasUpdatePhase3Failures` guard
(`update.ts:2586`), so a commit that placed any less returned through
`composePhase3FailureOutcome` instead. The derivation site's own comment made the
same conflation and now names the guard it depends on.

### IN-02: The prepare-time probe as a new prepare-stage failure mode

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`
**Commit:** `3d8834cc`

**Applied fix: documented — with a correction to the finding's premise.** The
finding rests on "`prepareStageWorkflows` previously never touched a target
path". It did. `prepareStageWorkflows` resolves each target through
`locations.workflowArtifactPath` one step before the probe, and the
`assertPathInside` walk inside it `lstat`s the leaf and re-raises everything but
ENOENT (`shared/path-safety.ts:130-135`) — a strictly wider re-raise than
`pathExists`, which also swallows ENOTDIR. So an EACCES / ELOOP on the saved
directory aborted prepare before the probe existed, on the install path as well
as update. There is no behavior change to gate, and nothing to decide.

The comment on `foreignOccupiedTargets` now states that, so the next reader does
not re-derive the same false alarm. No test was added: there is no new failure
mode to pin, and a permissions test here would assert an error raised by the
containment walk, not by the probe.

## Skipped Issues

None.

---

_Fixed: 2026-09-06_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
