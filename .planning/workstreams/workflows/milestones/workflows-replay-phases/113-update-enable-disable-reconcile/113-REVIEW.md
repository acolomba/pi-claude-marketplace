---
phase: 113-update-enable-disable-reconcile
reviewed: 2026-09-06T00:00:00Z
depth: standard
diff_base: d9ae367e
iteration: 2
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: resolved
resolution: all 8 iteration-2 findings fixed; see 113-REVIEW-FIX.md
---

# Phase 113: Code Review Report (iteration 2)

**Reviewed:** 2026-09-06
**Depth:** standard (diff-scoped against `d9ae367e`)
**Files Reviewed:** 12
**Status:** issues_found

## Summary

This is a re-review of the eight-commit fix pass, not of the original phase work. Scope is `git diff d9ae367e..HEAD` over the twelve listed files.

Three of the four fix areas hold up under attack:

- **`b36e5798` (CR-01, `unownedNames`)** is correct. `foreignOccupiedTargets` is a pure `lstat` probe that returns a list and never throws a refusal, so it cannot make `install` drop or reject anything — `install` does not read the field at all, and records its inventory from `onPlaced` after the commit (`install.ts:1244-1252`). The probe skips every name in `previousWorkflowNames`, which is exactly the set `displacePreviousTargets` moves aside before `assertTargetsUnoccupied` runs, so probe and commit ask the same ownership question. Both TOCTOU residuals degrade safely and are named in the comment. `reinstall.ts:1596` and `enable-disable.ts:366` already record placed names, so `markUpdateInProgress` was the only pre-commit record write needing the filter.
- **`76f40dd0` (`committed` vs the failure set)** is correct across every commit exit I traced: noop, staged-with-empty-renames, displace throw, occupancy refusal, mid-rename failure with full reversal, and failed-reversal-plus-failed-restore. The `committed: true` + cleanup-leak path is the one the old discriminant got wrong and it is now right.
- **`ca9da2c3` / `a78b141c` (the `notifyWithContext` opts bag)** dropped nothing. All four converted sites pass what they passed before, and no other site can silently lose an argument: every remaining call site passes four positional arguments only, and any stale positional would be a type error under the new signature. The one shape that *could* have hidden a drop — a trailing positional `undefined` — existed at exactly one site (`pending.ts`) and was converted.

**`3c500dee` (the redaction fix) is the problem.** It was written to close an Info-severity path-disclosure finding and, in doing so, destroys the manual-recovery instructions the CR-01 work in this same subsystem exists to produce. `redactAbsolutePaths` collapses both endpoints of a two-path recovery sentence to the *same* basename, because a workflow envelope's target and its displaced copy share a file name by construction. The result is a user-facing instruction that names one file as both the lost copy and the surviving copy. The one new test covers the benign cleanup-leak arm and never reaches the arm where the redaction is harmful.

## Narrative Findings (AI reviewer)

No `<structural_findings>` block was supplied for this iteration, so all findings below are narrative.

## Critical Issues

### CR-01: Redacting phase-3 failure text destroys the workflows manual-recovery instructions

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2392-2401` (`redactUpdatePhase3Failures`), consuming `extensions/pi-claude-marketplace/shared/notify.ts:290-321` (`redactAbsolutePaths`)

**Issue:** `commitPreparedWorkflows` composes two failure strings whose entire purpose is to tell an operator where the only surviving copy of a displaced envelope is (`bridges/workflows/stage.ts:442-446` and `:475-477`). Its own header says so: *"these strings are the manual-recovery instructions, as the restore leak above says in as many words"* (`stage.ts:468-470`). Those strings reach the phase-3 aggregate through `appendLeaks` (`stage.ts:480`) → `commitUpdateWorkflows`'s catch (`update.ts:2274-2278`) → `composePhase3FailureOutcome`, and are now run through `redactAbsolutePaths` in `msg`, in `notes`, in `phaseFailures`, and along the whole rebuilt `cause` chain.

A workflow envelope's target is `<savedDir>/<plugin>:<name>.json` and its displaced copy is `<stagingRoot>/.previous/<plugin>:<name>.json`. The two paths differ only in their directory, so basename redaction makes them textually identical. Verified against the live regex:

```
IN : failed to restore previous workflow envelope /home/u/.pi/agent/workflows/saved/hello:greet.json;
     the only copy is at /home/u/.pi/agent/workflows/.pi-claude-marketplace-staging/9f2c-abc/.previous/hello:greet.json
     -- move it back by hand before retrying: EACCES
OUT: failed to restore previous workflow envelope hello:greet.json; the only copy is at hello:greet.json
     -- move it back by hand before retrying: EACCES

IN : failed to roll back workflow rename /home/u/.pi/agent/.../saved/hello:greet.json -> /home/u/.pi/agent/.../9f2c/hello:greet.json: EACCES
OUT: failed to roll back workflow rename hello:greet.json -> hello:greet.json: EACCES
```

The instruction is now self-contradictory and unactionable. This is the one failure mode the whole displace-rather-than-unlink design (`stage.ts:258-278`) and the CR-01 skip-cleanup-on-unrestored rule (`stage.ts:449-457`) exist to make recoverable: the bytes are deliberately left on disk under a random UUID directory, and the message that names that directory is the only thing pointing at them. After redaction it points at nothing. The staging-leak line degrades the same way — `left workflows staging directory at 9f2c-abc in place` names a bare UUID with no parent.

Note also that this project does **not** treat leak paths as a blanket disclosure: `notify.ts:4319` renders `manualRecoveryLeaks` output verbatim, absolute paths included, for exactly this class of message. The redaction rule applied here contradicts that precedent.

**Fix:** Do not redact the leak/recovery arms wholesale. Either exempt the recovery text from redaction, or keep enough of the path to disambiguate. The narrowest change that keeps the IN-01 intent (no home-directory disclosure, machine-stable bytes) while restoring actionability is to redact *relative to the workflow home* rather than to the basename, so the two endpoints stay distinct:

```ts
// in the workflows bridge, compose the leak text against a stable anchor:
const rel = (p: string): string => path.relative(prepared.locations.workflowsHomeDir, p);
unrestored.push(
  `failed to restore previous workflow envelope ${rel(move.from)}; the only copy is at ` +
    `${rel(move.to)} -- move it back by hand before retrying: ${errorMessage(restoreErr)}`,
);
```

with `redactUpdatePhase3Failures` left to handle only the arms that still emit absolute paths. Whatever the chosen shape, add a test that drives the **restore-failure** arm (not just the cleanup-leak arm) and asserts the two endpoints render differently.

## Warnings

### WR-01: `redactCauseChain` silently drops the `(truncated)` marker

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:339-350`

**Issue:** `causeChainTrailer` appends ` (truncated)` when the last link it yielded still carries an onward cause (`errors.ts:104-107`). `redactCauseChain` rebuilds exactly `causeChain`'s ≤5 links and gives the deepest one no `cause`, so `hasOnwardCause(links.at(-1))` is false on the rebuilt chain and the marker never fires. The function's own doc claims *"the rendered bytes differ from the unredacted form only in the paths themselves"* — that claim is false for any chain at or past the depth bound.

This is reachable, not theoretical: `appendLeaks` adds one `Error.cause` link per leak (`errors.ts:167-173`), and the workflows failure path passes `[...rollbackLeaks, ...unrestored, cleanupLeak]` (`stage.ts:480`). Two workflows with a failed reversal and a failed restore each already produce five leaks, i.e. a six-node chain. The user is told the chain ended where it did not.

**Fix:** Preserve the marker by rebuilding one extra sentinel link, or by having the redactor return the truncation flag alongside the chain:

```ts
export function redactCauseChain(err: unknown): Error {
  const links = [...causeChain(err)];
  let rebuilt: Error | undefined;
  // Seed with a marker link when the original chain continued past the bound,
  // so `causeChainTrailer` re-derives ` (truncated)` from the rebuilt shape.
  if (hasOnwardCause(links.at(-1))) {
    rebuilt = new Error("...");
  }
  for (const link of [...links].reverse()) { /* ... as today ... */ }
  return rebuilt ?? new Error(redactAbsolutePaths(linkMessage(err)));
}
```

(`hasOnwardCause` would need exporting from `errors.ts` alongside `causeChain`/`linkMessage`.)

### WR-02: `redactCauseChain` erases error classes that the renderer narrows on

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:339-350`

**Issue:** Every rebuilt link is a plain `new Error(message)`. Any typed link in the original chain loses its class and every field it carried. The renderer that consumes this exact `cause` field keys on one of those classes: `composePluginLines` calls `manualRecoveryLeaks(p.cause)` (`notify.ts:4319`), which returns the first `link instanceof ManualRecoveryError` payload (`errors.ts:470-478`). After redaction that search can never succeed, so the `leaked: ...` child rows silently vanish.

Today no phase-3a producer throws a `ManualRecoveryError` — those throws live only in the `replacePrepared*` functions (`skills/stage.ts:444`, `commands/stage.ts:425`, `agents/stage.ts:516`), which `commitUpdatePhase3a` does not call, and `agents/stage.ts:395` documents that choice. So the erasure is latent. It is still worth fixing before it bites: the redaction is applied deliberately to *all six arms* "because the next producer has no reason to know about" the rule, and the same argument says the next producer has no reason to know its error class will be discarded.

**Fix:** Preserve the payload for the classes the renderer reads, e.g. re-wrap a `ManualRecoveryError` as a `ManualRecoveryError` with redacted message and its `leaks` carried through; or assert the invariant with a test that a `ManualRecoveryError` in a phase-3 cause chain still yields its `leaked:` rows.

### WR-03: The "Phase 3b aggregate error path" JSDoc is orphaned again

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2372-2392`

**Issue:** `3c500dee` inserted `redactUpdatePhase3Failures` and its own JSDoc *between* the "Phase 3b aggregate error path / PUP-9" block and `composePhase3FailureOutcome`. The file now has two consecutive `/** ... */` blocks; the first documents a function it no longer precedes. This is the same defect `573b3f41` was landed to fix one commit earlier in this very pass ("reattach the phase-3a contract to its own function"), reintroduced on a different function.

**Fix:** Move `redactUpdatePhase3Failures` (with its doc) above the "Phase 3b aggregate error path" block, so that block sits directly on `composePhase3FailureOutcome`.

### WR-04: Blanket redaction mangles non-path tokens in the arms it was extended to

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2382-2401`

**Issue:** `redactAbsolutePaths` matches on any `<letter>:[\\/]` prefix, which a URL scheme satisfies. Verified:

```
IN : clone failed for https://github.com/org/repo.git
OUT: clone failed for httprepo.git
```

Before this commit the phase-3 arms were not redacted at all; the commit message justifies applying it to all six "rather than the three known to embed one". That widening is what brings producers whose text can carry a URL into range — the `mcp` arm, the `hooks` arm, and the synthetic `phase: "mcp"` "state finalize failed" entry (`update.ts:2601-2605`), which wraps whatever `finalizeUpdateRecord` threw. A mangled `httprepo.git` is worse for diagnosis than the untouched string.

**Fix:** Anchor the regex so a scheme cannot match — require the drive-letter alternative to be a single letter at a word boundary and not be preceded by alphanumerics, e.g. `(?<![A-Za-z0-9])[A-Za-z]:[\\/]`. Add a case to the `redactAbsolutePaths` test table (`tests/shared/notify.test.ts:5038`) pinning that a `https://` URL survives intact.

### WR-05: The new redaction path has no test on the arm where it matters

**File:** `tests/orchestrators/plugin/update.test.ts:9192-9295`

**Issue:** The single test added by `3c500dee` seals the staging parent directory so only the post-commit `rm` fails. That exercises the `committed: true` cleanup-leak arm, where redaction is harmless. Nothing drives the catch arm of `commitPreparedWorkflows` — the one that emits the `failed to restore ... the only copy is at ...` and `failed to roll back workflow rename ... -> ...` strings, and the one where redaction produces the CR-01 defect above. `redactCauseChain` itself has zero direct unit tests (grep: 0 hits in `tests/`), so neither the truncation-marker loss (WR-01) nor the class erasure (WR-02) has a guard.

**Fix:** Add (a) a unit test for `redactCauseChain` covering a >5-link chain, a non-Error link, and a self-referencing cause; and (b) an orchestrator test that fails a workflows rename *and* its reversal, asserting the rendered recovery text names two distinguishable locations.

## Info

### IN-01: `notify-reasons.ts` comment says "placed" where update passes "staged"

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:258-263`

**Issue:** The corrected comment states that enable / reinstall / update all "take the previous-minus-placed difference through `retiresWorkflowCommand`". Enable passes `summary.stagedWorkflowNames`, which `install.ts` assigns from `onPlaced`, and reinstall passes `placedWorkflowNames` — both are placed names. Update passes `handles.workflows.result.stagedNames`, the *prepared* names (`update.ts:2652-2655`). The two coincide there only because that call site is reached only on the all-success path, where every prepared name was placed. The comment is right about the effect and wrong about the mechanism, which matters because the same file's `WR-01` reasoning one function away turns on prepared-vs-placed being different questions.

**Fix:** Say so: "update takes the difference against its prepared names, which equal the placed names on the success path that is the only site reaching this call".

### IN-02: The prepare-time probe introduces a new prepare-stage failure mode on the shared install path

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:122-140, 230`

**Issue:** `foreignOccupiedTargets` calls `pathExists`, which re-throws anything that is not `ENOENT`/`ENOTDIR` (`shared/fs-utils.ts:61-73`). `prepareStageWorkflows` previously never touched a target path; target existence was probed only at commit. An `EACCES`/`ELOOP` on the host engine's saved directory now aborts *prepare* — for `install` as well as `update`, since the probe runs on the shared path regardless of who reads the field.

The end state is a failure either way, and failing earlier is arguably cleaner (for `update` it aborts before the intent mark is written). Recording it because it is a behavior change on a path that gains nothing from the probe, and because it is not covered by a test.

**Fix:** Optional. If the earlier failure is not wanted for `install`, treat a non-ENOENT probe error as "unknown → not foreign" and let `assertTargetsUnoccupied` remain the sole authority; document whichever is chosen.

---

_Reviewed: 2026-09-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
