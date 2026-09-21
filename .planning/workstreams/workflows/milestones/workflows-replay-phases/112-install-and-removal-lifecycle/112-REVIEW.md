---
phase: 112-install-and-removal-lifecycle
iteration: 2
reviewed: 2026-09-05T00:00:00Z
depth: standard
diff_base: 1a478772
files_reviewed: 5
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/workflows-staging-gc.test.ts
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 112: Code Review Report (iteration 2)

**Reviewed:** 2026-09-05
**Depth:** standard (narrow — regression-hunt over the four fix commits `7ed19e4f`, `42f7821a`, `240a63d1`, `bcadbf89`)
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Answers to the five questions, then the findings.

**Q1 — did any fix introduce a new defect?** No behavioral regression. `npx tsc --noEmit` is clean, `reinstall.test.ts` is 122/122, `workflows-staging-gc.test.ts` is 10/10. The residual problems are in the sweeper's new retention predicate (WR-05, WR-06, WR-07 below) and in one fix that does not do what its commit message says (WR-04).

**Q2 — are CR-01 and CR-02 actually fixed?** Yes, and both are non-vacuous, confirmed independently by execution. I restored the pre-fix catch in `replaceAll` (`const leaks = [...rollbackReplacements(replacements), ...abortHandles(handles)]`), re-ran the two cases, and both went red; the file was restored and md5-verified afterwards.

```
✖ CR-01: a partially failed workflows commit unplaces what it stranded
✖ CR-02: a failed restore keeps the staging root holding the only copy
ℹ pass 0  ℹ fail 2
```

CR-01's recovery also provably cannot unlink an envelope belonging to the old record. The payload is the bridge's `onPlaced` report, and on the throw path that report is `stranded` (`bridges/workflows/stage.ts:431`) — completed renames whose reversal failed, **filtered by `restoredTargets`**. A target reclaimed by the restore loop is excluded, so the one case where the target holds an old-record envelope is exactly the case the caller never sees. Where the restore *failed*, the target holds the new envelope and the old copy is in `.previous/`; unlinking is correct there and the retained `.previous/` still backs the leak text's "move it back by hand".

CR-02's path is closed. `workflowsCommitEntered` is set before the call, so the abort arm is skipped on every commit path. Cross-checked the corner cases: a commit that throws *before* displacing (`mkdir` / `assertTargetsUnoccupied`) already ran its own `cleanupStaging`, and `cleanupStaging` swallows ENOENT and never throws (`shared/fs-utils.ts:40`), so skipping the abort is harmless there. There is no double-unplace: `replaceAll` is called *outside* the outer `try` (`reinstall.ts:968`), so the outer catch at `:1048` cannot see a `placedWorkflowNames` the inner catch already consumed.

**Q3 — is WR-02's contents predicate correct?** The choice of a contents predicate over a sentinel is right, and the fixer's reasoning holds: a crash mid-commit strands identical bytes in the identical place with no sentinel ever written, so "does this hold the only copy" is the cause-independent question. But the *implementation* of that predicate can misfire in both directions — see WR-05 (sweeps something it should keep) and WR-06 (keeps something forever with no surface). Adjudication: keep the design, fix the predicate.

**Q4 — is WR-01's fix sound, and did the test rewrite lose coverage?** The fix is sound. The rewritten test proves strictly more on the WR-01 axis: two entries refused rather than one, the sweep returning normally rather than throwing, and both external trees intact. The one thing it dropped — `caught.name === "SymlinkRefusedError"` — is no longer observable at that boundary by construction, because the production code now converts the refusal to `` `${name}: ${errorMessage(err)}` ``. A test cannot pin a class the code under test discards, and the project convention against message-substring narrowing does not apply to a leak *string* channel. So: more, not less. One residual gap recorded as IN-01.

**Q5 — is WR-08's deviation right?** The fixer is right and the iteration-1 citation was wrong. `tests/orchestrators/reconcile/apply.test.ts:200-206` is a `denyWrites` helper that **throws** `"denyWrites cannot deny root; run this suite as a non-root user"` under uid 0. It does not call `t.skip`. `requireNonRoot()` matches that idiom exactly, down to the comment shape.

**Also confirmed undisturbed:**
- `PathContainmentError` asymmetry intact — `unstagePluginWorkflows` still raises by class, the install ledger still lets it escape (PI-14), and only `unplaceWorkflows` (`reinstall.ts:1442`) and now the sweeper's hygienic loop convert it to a leak string. Both conversions sit in D-19-01 best-effort cleanup.
- `ReplacementEntry` is still four-armed (`reinstall.ts:291-295`); workflows remains deliberately outside `replacements[]`.
- `CASCADEAX-01` still pinned as deliberately unrepaired at `tests/orchestrators/marketplace/remove.test.ts:1170`.
- WR-03's carrier exists: ROADMAP Phase 113, success criterion 6, verbatim ("The `workflows` failure-phase widenings stop being inert"). Not re-reported.

## Warnings

### WR-04: the install warning fix is inert — the defect it claims to fix is still live

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1202`

**Issue:** Commit `240a63d1` moves `c.bridgeWarnings.push(...prep.result.warnings)` from after `commitPreparedWorkflows` to before it, and its message states the warnings are now kept "on exactly the run where the operator most needs them". They are not. `installCtx.bridgeWarnings` has exactly one consumer: `collectPostCommitWarnings` (`install.ts:1691`), whose own doc-comment says "POST-state-commit side effects" and which is called once, at `install.ts:2488`, **after** the ledger has returned and the state record has been committed. It is not a member of `InstallLedgerSummary` (`install.ts:511-530`), and the failure arm composes its `PluginFailedMessage` from the thrown error and the rollback partials, never from the context.

So when the workflows commit throws, `runPhases` unwinds, the ledger throws, and the array is discarded with the context — byte-for-byte the pre-fix outcome. The reordering is behavior-neutral on the success path and unobservable on the failure path. The commit carries no test, which is why the vacuity was not caught: a test asserting "a commit throw still surfaces the prepare's discovery warnings" would fail against both the old and the new code.

The cited precedent is also wrong. Reinstall composes `bridgeWarnings` at `reinstall.ts:1055`, i.e. only after `replaceAll` **returned**; on a `replaceAll` throw it loses the same warnings for the same reason.

**Fix:** Either revert the reorder as churn and re-carry the finding, or make it real. Real means giving the failure path a channel. The narrowest version is to thread the prepare's warnings out of the ledger on the throw, e.g. attach them to the error the way `appendLeaks` already attaches leak strings:

```ts
// install.ts, workflows phase
c.bridgeWarnings.push(...prep.result.warnings);
try {
  const leak = await commitPreparedWorkflows(prep, { onPlaced: ... });
  ...
} catch (err) {
  // The prepare's observations describe the SOURCE and survive the commit's
  // failure; appendLeaks is the established carrier for strings that must
  // reach the failure row.
  throw appendLeaks(err, prep.result.warnings);
}
```

and pin it with a case that drives a commit throw and asserts a refused-script warning appears in the rendered failure row.

### WR-05: `holdsDisplacedEnvelopes` treats every errno as "nothing displaced", including the ones that prove nothing

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:183-189`

**Issue:** The predicate is `readdir(...).length > 0` wrapped in a bare `catch { return false; }`. Its doc-comment argues "no other errno tells us the directory holds bytes, so none of them justifies keeping an aged tree forever" — but that inverts the asymmetry the rest of the file is built on. `WORKFLOWS_STAGING_MAX_AGE_MS`'s own comment states the policy explicitly: "the cost of erring in the safe direction is one orphan surviving an extra pass." Here the two outcomes are *one orphan surviving another pass* versus *`rm -rf` on the only surviving copy of the user's workflow scripts*, and the code picks the second on every non-ENOENT failure.

`ENOENT` (and arguably `ENOTDIR`, a plain file named `.previous`) is the only errno that proves the directory holds nothing. Everything else — a transient `EMFILE`/`ENFILE` under fd pressure, `EIO`, an `EACCES` window that closes before the subsequent `rm` retries — reads as "nothing displaced" and hands the tree to a recursive force-remove. Narrow, but the loss is irreversible and it is precisely the loss `7ed19e4f` was written to prevent.

**Fix:**

```ts
async function holdsDisplacedEnvelopes(stagingRoot: string): Promise<boolean> {
  try {
    return (await readdir(path.join(stagingRoot, DISPLACED_DIR))).length > 0;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Only an absent (or non-directory) `.previous` PROVES nothing is
    // displaced. Any other errno leaves the question open, and the safe
    // answer to an open question here is one orphan surviving another pass
    // rather than a recursive rm over the only copy.
    return code !== "ENOENT" && code !== "ENOTDIR";
  }
}
```

### WR-06: a retained tree is retained forever, and nothing enumerates the retained set

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:127-136`

**Issue:** Once a staging root holds a non-empty `.previous/`, no code path ever removes it. The sweeper skips it on every pass; uninstall and `/reload` cannot reach it because `workflowsStagingDir` sits outside every scope root (WPTH-04); and both sweeper call sites (`install.ts:1701`, `uninstall.ts:449`) discard the return inside a bare `catch {}`, so nothing ever names it again. The single notice the operator gets is the one-shot leak line inside the failure the commit threw.

The crash case the fix was designed around makes this concrete and worse: a kill signal between `displacePreviousTargets` and the rename loop leaves the targets **empty** and the only copies inside `.previous/`, with no error thrown and therefore no leak line ever emitted. The user's workflows have silently vanished; the recovery bytes now live forever in a `randomUUID()` directory that no surface lists. Pre-fix behavior deleted them after 24 hours, which is worse — but "kept forever, undiscoverable" is not the finished state.

**Fix:** Retention needs a read surface. Cheapest version that closes the discoverability half without changing the retention policy: have the sweeper return retained roots as their own channel and give an existing user-facing verb somewhere to render it, e.g.

```ts
export async function garbageCollectWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
): Promise<{ readonly leaks: string[]; readonly retained: string[] }>
```

with `retained` carrying `` `${name}: holds N displaced previous workflow envelope(s) at ${candidate}` ``, surfaced once from `info` or `pending`. If that belongs to Phase 113/114, carry it there explicitly rather than leaving it implicit.

### WR-07: the retention probe reads through the candidate before the containment refusal

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:134` (probe) vs `:149` (assertion)

**Issue:** `holdsDisplacedEnvelopes(candidate)` runs *before* `assertPathInside`. The file's own comment at `:138` states the discipline — "resolve the containment boundary OUTSIDE the rm's try" — and WPTH-04's whole point is that the staging segment is the one an attacker could have replaced. The new predicate now performs a `readdir` through that unvalidated segment, on every aged entry, ahead of the check that exists to refuse it. The WR-01 test proves this happens: both symlinked entries reach the refusal, which means both were probed through the symlink first.

The reachable consequence is retention rather than disclosure, and it is permanent: `readdir` follows symlinks, so planting `.previous -> /` (or any non-empty directory) inside a staging root pins that root against the sweeper for the life of the machine. Combined with WR-06 there is no way to notice.

**Fix:** Move the containment assertion above the retention probe. The assertion has no dependency on the probe, and running it first means every subsequent read is inside a boundary that has been walked.

```ts
try {
  await assertPathInside(locations.workflowsHomeDir, candidate, `workflows staging root ${name}`);
} catch (err) {
  leaks.push(`${name}: ${errorMessage(err)}`);
  continue;
}

if (await holdsDisplacedEnvelopes(candidate)) {
  continue;
}
```

Optionally `lstat` `.previous` unfollowed inside the predicate so a symlinked `.previous` is not credited as displaced content.

### WR-08: the sweeper's header enumerates an import surface it no longer has

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:17-22`

**Issue:** The header states "This helper is fs-only: node:fs/promises + the containment chokepoint + the shared error-message helper + the locations type", and uses that closed enumeration to justify an architectural property ("It never touches the git surface, so any orchestrator — even one gated by tests/architecture/no-orchestrator-network.test.ts — can import it"). `7ed19e4f` added a fifth import, `DISPLACED_DIR` from `bridges/workflows/stage.ts`, and the enumeration was not updated. The claim's *conclusion* still holds (I checked `stage.ts:47-59` — no git surface, and `install.ts` already imports the same module directly), but a header whose enumeration is load-bearing and stale is a trap for the next reader who takes it as an invariant.

**Fix:** Add the bridge import to the list and say why it is safe there, e.g. "…plus `DISPLACED_DIR` from the workflows bridge, whose own imports are fs-only — the shared constant is what keeps the sweeper's retention predicate and the commit's displacement from drifting apart."

## Info

### IN-01: the WR-01 test never shows a *collectible* tree surviving a containment refusal

**File:** `tests/orchestrators/plugin/workflows-staging-gc.test.ts:229`

**Issue:** The rewritten case plants two entries behind the same symlinked staging segment, so both are refused and neither is removable. It proves the refusal does not escape and does not stop at the first entry, but it does not demonstrate the harm the fix names — "orphaned executable envelopes kept accumulating" — because no sweepable tree exists in that fixture to be swept afterwards. The fixture cannot hold one: every entry lives under the same symlink. The adjacent case at `:204` ("continues past a staging tree it cannot remove") does prove continuation-then-collection, but through the `rm`-leak path, not the containment path.

**Fix:** Optional. If you want the containment path to carry the same proof, refuse one entry by containment and make a second entry collectible by planting only *one* of the two behind a per-entry symlink rather than symlinking the staging directory itself, then assert the collectible one is gone.

### IN-02: a post-commit failure still leaves the record naming envelopes that no longer exist

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1048`

**Issue:** Pre-existing and outside this iteration's fixes, recorded for completeness because it is the mirror image of what CR-01/CR-02 closed. On a *successful* workflows commit followed by a state-write or write-back failure, the outer catch unlinks the full placed set — while the previous envelopes were already destroyed by the commit's own `cleanupStaging`. The transaction does not save, so `state.json` keeps the old record naming workflows that are now absent from disk: the exact record/disk divergence this phase exists to prevent, reached from the one path where it is unavoidable without a second staging generation.

**Fix:** None proposed. The manual-recovery contract covers it (re-running reinstall re-resolves and re-materializes) and reinstall is the repair verb. Worth one sentence in the Phase 114 contract document so the window is written down rather than rediscovered.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard, iteration 2 (narrow regression scope)_
