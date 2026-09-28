---
phase: 104-workflow-lifecycle-completion
reviewed: 2026-08-15T23:02:27Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/workflows/index.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
  - tests/bridges/workflows/stage.test.ts
  - tests/bridges/workflows/unstage.test.ts
  - tests/helpers/workflow-home.ts
  - tests/live-uat/README.md
  - tests/live-uat/workflow-storage-canary.mjs
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-workflows.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 2
  warning: 10
  info: 0
  total: 12
status: resolved
---

# Phase 104: Code Review Report

**Reviewed:** 2026-08-15T23:02:27Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

The sixth bridge is wired into every remaining lifecycle verb and the four
closed unions (`Phase3Failure["phase"]`, `PHASE3_FAILURE_PHASES`,
`UpdatePhaseBridge`, `BridgePhase`) were all widened consistently; `npx tsc
--noEmit` is clean. The WR-06 refusal / undo interaction the phase flags as its
riskiest change is implemented correctly for the case it names: the whole-set
precheck runs before the first rename, and `isWorkflowTargetOccupiedError`
walks `Error.cause`, so the `appendLeaks` double-fault does not reach the
`instanceof`-only trap.

The defects are on the paths either side of that fix.

Two are Critical. First, `commitPreparedWorkflows`'s own failure handler
destroys the backup it just failed to restore: the restore loop pushes a leak
message and then `cleanupStaging` unconditionally `rm -rf`s the staging root,
which is where `.previous/` lives. Second, both re-stage verbs (`update`,
`reinstall`) can land the new envelopes and then fail before the record is
written; because the record is the only tracker of files that live outside
every scope root, a name change in that window orphans executable code that no
later operation can reach — which is the exact condition this phase exists to
prevent, and `reinstall.ts` documents a recovery path that does not work.

The Warnings cluster around three themes: the payload-drop guard is keyed on
error *type* rather than on "the commit placed nothing", so its own stated
rationale covers throws it does not handle; `marketplace remove` still carries
a hand-rolled 4-axis partial fold that the phase updated only in the shared
`applyPartialCascadeFold` helper, so the new workflows axis (and the older
hooks axis) is silently missing there; and neither cascade-failure narrower
gained an arm for the new `WorkflowsUnstageFailureError`, so a failed workflow
unlink renders as `{not in manifest}` on the `marketplace remove` surface.

Test coverage of the new token and of the six-slot cascade is genuinely good
(all four verbs carry per-verb render assertions plus negative controls). The
gap is that no test names `WorkflowTargetOccupiedError` or
`isWorkflowTargetOccupiedError` at all — the bridge test matches
`/non-previous content/` on the message, which is the substring coupling the
project convention forbids, and the wrapped double-fault form the fix exists
for is untested.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The commit's rollback deletes the previous envelope it failed to restore

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:343-373`
**Severity:** BLOCKER

**Issue:** `displacePreviousTargets` deliberately *moves* previous targets into
`<stagingRoot>/.previous/` rather than unlinking them, and the file header
states the reason: "A bare unlink is unrecoverable ... a commit that failed
after the removals would leave the saved directory holding neither the previous
envelopes nor the new ones."

The catch block then produces exactly that outcome. When a restore rename
fails, the failure is recorded as a string and the very next expression removes
the directory holding the only surviving copy:

```ts
for (const move of [...displaced].reverse()) {
  try {
    await rename(move.to, move.from);
  } catch (restoreErr) {
    rollbackLeaks.push(
      `failed to restore previous workflow envelope ${move.from}: ${errorMessage(restoreErr)}`,
    );
  }
}

throw appendLeaks(err, [
  ...rollbackLeaks,
  await cleanupStaging(prepared.stagingRoot, STAGING_LABEL), // rm -rf, includes .previous/
]);
```

`cleanupStaging` is `rm(dir, { recursive: true, force: true })`
(`shared/fs-utils.ts:38-50`). The reported leak message names `move.from` (the
target path the restore was aiming at), so the operator is pointed at a path
that never received the file, while the path that *did* hold it is deleted
without ever being named. The bytes are gone and nothing on disk records that
they existed — these envelopes live outside every scope root by design.

This is reachable whenever a restore rename fails: the saved directory was
removed or made read-only concurrently, ENOSPC, or a cross-device condition
introduced between the displace and the restore.

**Fix:** Skip the cleanup when any displaced envelope is still in staging, and
name the surviving path in the leak so recovery is possible:

```ts
const restoreFailures: string[] = [];
for (const move of [...displaced].reverse()) {
  try {
    await rename(move.to, move.from);
  } catch (restoreErr) {
    restoreFailures.push(
      `failed to restore previous workflow envelope ${move.from}; ` +
        `the only copy is at ${move.to} -- move it back by hand before retrying: ` +
        `${errorMessage(restoreErr)}`,
    );
  }
}

// Never delete the staging root while it still holds the only copy of a
// previous envelope: the cleanup would complete the data loss the restore
// loop just failed to prevent.
const cleanupLeak =
  restoreFailures.length > 0
    ? `left ${STAGING_LABEL} at ${prepared.stagingRoot} in place: it still holds ${restoreFailures.length} unrestored previous envelope(s)`
    : await cleanupStaging(prepared.stagingRoot, STAGING_LABEL);

throw appendLeaks(err, [...rollbackLeaks, ...restoreFailures, cleanupLeak]);
```

### CR-02: A post-commit failure in `update` / `reinstall` orphans untrackable executable envelopes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2066-2127`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1678-1706`
**Severity:** BLOCKER

**Issue:** In both verbs the workflows commit runs *before* the record is
persisted, and the commit's staging cleanup irreversibly discards the displaced
previous envelopes. If anything between the commit and the record write fails,
the record keeps naming the OLD workflow names while the disk holds the NEW
ones.

`update.ts`: `commitPreparedWorkflows(handles.workflows)` succeeds, then

```ts
try {
  const finalizeResult = await finalizeUpdateRecord(args, preflight, handles, ...);
} catch (finalizeErr) {
  phase3aFailures.push({ phase: "mcp", msg: `state finalize failed: ...`, cause: finalizeErr });
}
```

`finalizeUpdateRecord` opens `withStateGuard` (`update.ts:1740`), which throws
on `ELOCKED` (`StateLockHeldError`) or on any atomic-write failure. Nothing
writes `sRecord.resources.workflows` on that path.

`reinstall.ts` has the same window (record composition + config write-back +
state save follow the commit) and its comment acknowledges it:

> Consequence: if a later step throws, the NEW envelopes stay on disk while the
> record still names the old ones, until reinstall is re-run. Recovery is via
> the reinstall hint, not in-process rollback

That recovery claim is wrong whenever a workflow was renamed or added. A re-run
passes `oldRecord.resources.workflows` (the OLD names) as
`previousWorkflowNames`, so `displacePreviousTargets` never touches the new
names and `assertTargetsUnoccupied` then *refuses* them as foreign — the retry
fails and the orphans stay forever. For the other five bridges the equivalent
orphan sits under a scope root that a sweep can find; for workflows the record
is the only tracker, as `install.ts:1317-1323` and `shared.ts:892-900` both
state.

This is precisely the condition the phase charter names: "nothing executable is
left behind with no record tracking it."

**Fix:** Record the intent before the commit rather than after it. Both verbs
already have a pre-commit state window (`markUpdateInProgress` in `update.ts`;
the locked record read in `reinstall.ts`). Write the union of previous and
prepared workflow names into `resources.workflows` there, then narrow it to the
staged set in the finalize/save step:

```ts
// Pre-commit: the record must name every envelope that MAY exist on disk after
// the commit, because it is the only thing that can name them at all.
sRecord.resources.workflows = [
  ...new Set([...record.resources.workflows, ...handles.workflows.result.stagedNames]),
];
```

A subsequent retry then displaces (and a subsequent uninstall then removes)
both generations. At minimum, correct the `reinstall.ts` comment so it stops
asserting a recovery that a renamed workflow defeats.

## Warnings

### WR-01: The payload-drop guard is keyed on error type, not on "nothing was placed"

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1191-1206`,
`extensions/pi-claude-marketplace/bridges/workflows/stage.ts:284-292`

**Issue:** The rationale in `assertTargetsUnoccupied`'s doc comment is a
*placement* argument — "a refusal then provably leaves zero completed renames,
which is what lets the install ledger drop its removal payload." But the ledger
implements a *type* test:

```ts
if (isWorkflowTargetOccupiedError(err)) {
  c.stagedWorkflowNames = [];
}
```

`assertTargetsUnoccupied` calls `pathExists`, which rethrows every lstat error
other than `ENOENT`/`ENOTDIR` (`shared/fs-utils.ts:59-71`) — `ENAMETOOLONG`,
`ELOOP`, `EACCES`, `EIO`. Such a throw also leaves zero completed renames, yet
`isWorkflowTargetOccupiedError` returns `false`, the full prepared name list
stays armed, and the phase undo unlinks those target paths. If one of them is
occupied by a hand-saved workflow that the loop had not yet reached, the undo
deletes it — the identical outcome the WR-06 refusal exists to prevent.

**Fix:** Make the signal structural instead of type-derived. Have
`commitPreparedWorkflows` report the names it actually renamed, and use that as
the removal payload:

```ts
// bridges/workflows/stage.ts
export interface WorkflowsCommitResult {
  readonly placedNames: readonly string[]; // empty when the commit placed nothing
  readonly leak?: string;
}

// install.ts workflows phase
c.stagedWorkflowNames = [];               // nothing placed yet
const commit = await commitPreparedWorkflows(prep);
c.stagedWorkflowNames = commit.placedNames;
```

On a throw, have the commit attach `placedNames` to the thrown error (or accept
a mutable out-array the phase pre-assigns), so the undo removes exactly the
names that reached a target and never a name it merely prepared.

### WR-02: The ledger undo deletes previous envelopes the commit's rollback just restored

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1217-1242`

**Issue:** On a mid-sequence rename failure `commitPreparedWorkflows` reverses
completed renames and restores the displaced previous envelopes, so "the saved
directory ends the way it started" (its own doc comment). The phase undo then
runs with `c.stagedWorkflowNames` still holding the full prepared list — which,
on a re-stage, contains the same names as the restored previous envelopes — and
unlinks them.

Reachable on the `allowExistingRecord` (enable) path when the record still
names envelopes that are physically present, e.g. after a `disable` whose
cascade partially failed and folded the still-present names back into the
record. The result: the commit's rollback contract is silently reversed by its
caller, and the record continues naming files that were just deleted.

**Fix:** The same structural fix as WR-01 — the undo must work from the names
the commit actually placed. `placedNames` is empty after a fully-reversed
commit, so the undo becomes a correct no-op.

### WR-03: `marketplace remove`'s partial-cascade fold ignores the workflows and hooks axes

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:388-401`

**Issue:** This phase extended `applyPartialCascadeFold`
(`orchestrators/plugin/shared.ts:855-901`) with the sixth axis, and its comment
states why it matters: "a stale entry here names a file that is gone, and the
missing entry for one that is NOT gone leaves an executable envelope no later
run can find."

`cascadePluginsInPlace` never calls that helper — it re-implements the fold
inline over four axes only:

```ts
plugin.resources.skills     = ...filter(dropped.skills)
plugin.resources.prompts    = ...filter(dropped.commands)
plugin.resources.agents     = ...filter(dropped.agents)
plugin.resources.mcpServers = ...filter(dropped.mcpServers)
// dropped.hooks and dropped.workflows are never subtracted
```

`cascadeUnstagePlugin` now populates `dropped.workflows` and can fail at the
workflows slot (`marketplace/shared.ts:427-451`), so a partial
`marketplace remove` persists a record naming envelopes that are already gone.
`dropped.hooks` was already missing before this phase; the phase widened one
copy of the fold and left the other behind.

**Fix:** Delete the inline fold and call the shared helper, which is exactly the
duplication `sonarjs/no-identical-functions` is configured to prevent:

```ts
import { applyPartialCascadeFold } from "../plugin/shared.ts";
// ...
if (!(cause instanceof AgentsUnstageFailureError)) {
  applyPartialCascadeFold(plugin, outcome.dropped);
}
```

If the plugin→marketplace import direction is unacceptable under D-11, move
`applyPartialCascadeFold` to `orchestrators/types.ts` or a neutral shared tier
and have both call sites import it from there.

### WR-04: Neither cascade-failure narrower classifies `WorkflowsUnstageFailureError`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:187-232`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:155-182`

**Issue:** The phase introduces a new typed error but adds no arm to either
narrower. `WorkflowsUnstageFailureError` is not an `AgentsUnstageFailureError`
and carries no `.code`, so:

- `uninstall` renders `(failed) {unreadable}` — imprecise but not false.
- `marketplace remove` falls through to `return "not in manifest";` — an
  outright lie about a workflow file that could not be unlinked, and exactly
  the class of false assertion the sibling narrower's own comment says it fixed
  ("the former `not in manifest` lied that the plugin was gone from the
  manifest").

The two narrowers already carry comments claiming they are aligned "so the two
cascade-failure narrowers do not drift". They have drifted.

**Fix:** Add the arm to both, using an existing closed-set member:

```ts
if (cause instanceof WorkflowsUnstageFailureError) {
  // The envelope is still on disk and still runnable; this is a removal
  // failure, not a manifest claim.
  return "unreadable";
}
```

and change `remove.ts`'s permissive default from `"not in manifest"` to
`"unreadable"` to match `uninstall.ts`.

### WR-05: A partial-cascade failure never reports the workflows it did remove

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:472-488`,
`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:346-371`

**Issue:** `removedWorkflow` is assigned from `localOutcome.dropped.workflows`
before the failure branch, and `runDisableBranch` computes
`cascade.dropped.workflows` only on the `ok` path. On a partial cascade the
code returns via `emitCascadeFailure` / `disable-failed`, whose rows carry no
`stale workflow command` token.

So the operator is told about lingering commands only when the operation
*fully* succeeded. A cascade that removed two envelopes and then failed on a
third leaves three stale commands registered and reports none of them — the
operator sees `(failed)` and reasonably assumes nothing changed.

**Fix:** Thread the fact onto the failure rows too. `PluginFailedMessage`
already accepts `reasons: readonly ContentReason[]`:

```ts
const failedRow: PluginFailedMessage = {
  status: "failed",
  name: plugin,
  reasons: removedWorkflow
    ? [narrowCascadeFailure(cause), "stale workflow command"]
    : [narrowCascadeFailure(cause)],
  ...
};
```

Apply the same to `runDisableBranch`'s `disable-failed` arm (its
`cascade.dropped.workflows` is available in the `!cascade.ok` branch).

### WR-06: `isWorkflowTargetOccupiedError` walks `Error.cause` with no depth bound or cycle guard

**File:** `extensions/pi-claude-marketplace/shared/errors-bridges.ts:117-125`

**Issue:**

```ts
for (let cur: unknown = err; cur instanceof Error; cur = cur.cause) {
  if (cur instanceof WorkflowTargetOccupiedError) {
    return true;
  }
}
```

The house cause-walker (`shared/errors.ts::causeChainTrailer`) carries both a
`MAX_DEPTH = 5` bound and a `current.cause !== current` self-reference check,
documented as a DoS mitigation. This walker has neither: a self-referential or
cyclic `cause` chain spins forever inside a bridge commit's catch, hanging the
extension with no notify and no `/reload` recovery (NFR-2). The walker also
runs on arbitrary caught values, including errors this module did not build.

**Fix:** Mirror the existing walker's contract:

```ts
export function isWorkflowTargetOccupiedError(err: unknown): boolean {
  const MAX_DEPTH = 5; // same bound as causeChainTrailer
  let cur: unknown = err;
  for (let depth = 0; depth < MAX_DEPTH && cur instanceof Error; depth++) {
    if (cur instanceof WorkflowTargetOccupiedError) {
      return true;
    }

    if (cur.cause === cur) {
      break;
    }

    cur = cur.cause;
  }

  return false;
}
```

### WR-07: No test names the typed refusal; the bridge test asserts it by message substring

**File:** `tests/bridges/workflows/stage.test.ts:432-466`

**Issue:** `grep -rn "WorkflowTargetOccupiedError\|isWorkflowTargetOccupiedError" tests/`
returns nothing. The refusal is asserted as:

```ts
assert.match(err.message, /non-previous content/);
```

That is the message-substring coupling `CONVENTIONS.md` explicitly forbids
("callers narrow on `instanceof`, never on message substring matching"), and it
means renaming the message silently disarms the test. More importantly, the
cause-walking predicate — the fix the phase brief singles out as the one whose
failure "would delete a user's file" — has no test at all, and neither does the
double-fault case it exists for (a WR-06 refusal whose `cleanupStaging` also
leaks, so `appendLeaks` re-wraps in a plain `Error`).

**Fix:** Assert the class, and add a direct predicate test for the wrapped form:

```ts
await assert.rejects(commitPreparedWorkflows(prepared), (err: unknown) => {
  assert.ok(isWorkflowTargetOccupiedError(err), "the refusal must stay recognizable to the ledger");
  return true;
});

test("WR-06 the predicate sees a refusal that appendLeaks re-wrapped in a plain Error", () => {
  const wrapped = appendLeaks(new WorkflowTargetOccupiedError("/tmp/x.json"), ["cleanup leaked"]);
  assert.equal(wrapped instanceof WorkflowTargetOccupiedError, false, "non-vacuity");
  assert.equal(isWorkflowTargetOccupiedError(wrapped), true);
});
```

### WR-08: The mid-loop refusal test describes behavior the code no longer has, and pins nothing

**File:** `tests/bridges/workflows/stage.test.ts:467-497`

**Issue:** The test is titled "WR-06 a refusal mid-loop restores every displaced
previous envelope" and its comment says "alpha is displaced and renamed over;
beta is refused." Neither is true: `assertTargetsUnoccupied` runs the whole set
*before* the first rename (`stage.ts:337`), so alpha is never renamed over and
there is no mid-loop.

Because the assertions only check the final bytes at both targets, they pass
identically under the pre-check implementation and under a per-iteration check
followed by a rollback. The load-bearing property the phase brief calls out —
"a refusal then provably leaves zero completed renames, which is what lets the
install ledger drop its removal payload" — is therefore not pinned by any test.
A regression to per-iteration checking would land green here while re-arming
the undo bug the phase fixed.

**Fix:** Retitle to match the mechanism and assert placement directly, e.g. by
having the commit expose `placedNames` (see WR-01) and asserting it is empty on
refusal, or by asserting the staging root's `.previous/` is empty and the
displaced envelope is back at its target *without* a reversal having occurred
(e.g. via an `mtime`/inode check on `alphaTarget`).

### WR-09: The catalog misstates `disable`'s stamping gate

**File:** `docs/output-catalog.md:653`

**Issue:** The catalog is the spec source for this token. It says:

> Three other verbs stamp the same token on their own success rows -- `disable`,
> `update` and `reinstall` -- with the same gate: the previously recorded
> workflow names that the operation did not re-stage.

`disable` uses a different gate: `cascade.dropped.workflows.length > 0`
(`enable-disable.ts:408`), i.e. what the cascade *reported removing*. It stages
nothing, so "previous names not re-staged" would be the entire recorded
inventory and would stamp even when the cascade removed nothing — which is the
false positive the code comment at `enable-disable.ts:399-403` explicitly
rejects. `uninstall` uses the same removed-set gate (`uninstall.ts:443`), not
the not-re-staged gate the paragraph attributes to it by omission.

**Fix:** Split the sentence by gate:

> `uninstall` and `disable` stamp it when the cascade reported removing at least
> one envelope; `update` and `reinstall` stamp it for the previously recorded
> names the run did not re-stage (so a rename stamps and a pure addition does
> not).

### WR-10: A shared hermetic-workflow-home helper was added but the duplicates were left in place

**File:** `tests/helpers/workflow-home.ts:33-62`, `tests/bridges/workflows/stage.test.ts:44`,
`tests/bridges/workflows/unstage.test.ts:17`, `tests/bridges/workflows/discover.test.ts:81`,
`tests/orchestrators/plugin/uninstall.test.ts:122`

**Issue:** The new shared helper is adopted by six orchestrator suites, but
three `bridges/workflows/*` suites keep their own `withRelocatedWorkflowHome`
copies, and `uninstall.test.ts` imports the shared helper *and* still defines a
local `withHermeticHome` that overrides `HOME` without touching
`setWorkflowHomeDirForTesting`. The two isolation strategies now coexist in one
file, and only the reader can tell which tests are protected by the seam.

`platform/workflow-home.ts:12-14` states the intended discipline outright: "A
test relocates storage by calling the setter rather than by mutating
process-global environment state that concurrently-running suites also read."
The shared helper mutates both, and the local copy mutates only the one the
module warns against.

**Fix:** Point the three bridge suites and `uninstall.test.ts` at
`withHermeticWorkflowHome` and delete the local copies; where a suite genuinely
needs only a `HOME` override (state.json isolation, no workflow writes), keep
one clearly-named helper and say so in its doc comment.

---

_Reviewed: 2026-08-15T23:02:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (2026-08-16)

All 12 findings are closed within this phase -- there was no later phase to defer to.
CR-01 and CR-02 were fixed with a stronger mechanism than the review proposed (an `onPlaced`
callback reporting what a commit actually placed), which also closed WR-06 by deleting its
only caller. Four residual risks were accepted and are recorded in STATE.md rather than
silently carried.
