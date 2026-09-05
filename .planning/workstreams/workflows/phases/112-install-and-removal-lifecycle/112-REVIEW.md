---
phase: 112-install-and-removal-lifecycle
reviewed: 2026-09-05T19:31:13Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/workflows-staging-gc.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/persistence/state-io.test.ts
  - tests/persistence/migrate.test.ts
  - .fallowrc.json
findings:
  critical: 2
  warning: 8
  info: 0
  total: 10
status: issues_found
---

# Phase 112: Code Review Report

**Reviewed:** 2026-09-05T19:31:13Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

The wiring is mostly sound and several of the phase's stated risk areas hold up under
inspection. Verified independently:

- **`ReplacementEntry` stays four-armed** (`reinstall.ts:291-295`); `BridgePhase` gained
  `"workflows"` only to label `pushLeak` in `abortPartialHandles`. Correct, not an omission.
- **`replaceAll` really does need two new members.** `placedWorkflowNames` is the removal
  payload for the caller's catch and `workflowsCommitLeaks` carries the commit's staging-cleanup
  report, which `commitPreparedWorkflows` returns by value and nothing else would surface.
- **The asymmetric `PathContainmentError` handling is as described, in both halves.**
  `bridges/workflows/unstage.ts` re-raises the refusal bare after the loop;
  `phase-ledger.ts:87-89,124-126` re-throws it out of `runPhases`, so the install ledger lets
  it escape. `reinstall.ts::unplaceWorkflows` converts it to a leak line inside a `catch` that
  cannot throw. Neither policy leaked into the other.
- **Both structural folds subtract the new axis and both are genuinely load-bearing.**
  `plugin/shared.ts:1230-1232` is held by a dedicated behavioral case
  (`tests/orchestrators/plugin/shared.test.ts:1654`, "subtracts the dropped workflow envelope
  and leaves the other four axes alone"); the hand-rolled duplicate at `remove.ts:335-340` is
  held by "subtracts a dropped workflow envelope from the persisted row and leaves hooks alone"
  in `remove.test.ts`. The "delete both lines, two tests go red" claim checks out.
- **The sweeper's age bound is correct in both directions** — `mtimeMs >= abandonedBefore`
  skips, and there is a positive case for the fresh tree surviving, not just the aged one being
  removed. The containment assertion is anchored on `workflowsHomeDir` (one level above the
  staging dir) and resolved outside the swallowing try, and `lstat` + `isDirectory()` keeps a
  planted symlink or file from being traversed or removed.
- `.fallowrc.json`'s change is minimal and correct: the `bridges-workflows` zone already
  existed; only `orchestrators`' allow-list gained it.

What does **not** hold up is the reinstall verb's `replaceAll` catch. It contains two distinct
defects that both trace to one false premise stated in a comment on `reinstall.ts:1369-1373`
("nothing inside this function can fail after it, so this catch never has to undo it"). The
workflows commit is the last step, but the commit itself can fail *part way*, and the bridge
reports exactly that case through `onPlaced` for exactly this reason. That path is untested,
and the reinstall test that comes closest states the same false premise in its own comment.

Two further items are behavioral gaps rather than wiring bugs: the staging sweeper's carefully
constructed containment refusal dead-ends in a bare `catch {}` at both call sites, and `update`
does not touch workflows at all while its failure-phase types were widened as if it did.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `replaceAll`'s catch discards the placed-envelope report, orphaning executable files

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1369-1389`

**Issue:**
`replaceAll` calls `commitPreparedWorkflows` last, capturing the placed names into the
function-local `let placedWorkflowNames` via `onPlaced`. If the commit throws, the `catch` at
line 1385 runs `rollbackReplacements(replacements)` + `abortHandles(handles)` and rethrows —
`placedWorkflowNames` is never read and `unplaceWorkflows` is never called. The only caller of
`unplaceWorkflows` is `runLockedReinstall`'s catch (line 1043), which is reachable only after
`replaceAll` has *returned*.

The bridge's contract is explicit that this is wrong. `CommitWorkflowsOptions.onPlaced` in
`bridges/workflows/types.ts` documents the callback as firing "before the throw on every failure
path", and `commitPreparedWorkflows`'s own doc says the report "— not the type of the thrown
error — is what a caller's removal payload must be built from". The commit reaches that report
via its `stranded` computation (`stage.ts:432-438`): renames it completed and could not reverse,
minus targets a restore reclaimed. Those envelopes sit at their target paths in
`workflowsSavedDir`.

Consequence: the reinstall fails, no state write occurs, and any stranded envelope whose
generated name is **not** already in the old record's `resources.workflows` (the ordinary case
when the new plugin version adds or renames a workflow) is left on disk under a name no record
owns. `unstagePluginWorkflows` removes strictly by recorded name and the saved directory is never
enumerated, so nothing will ever find it. That is precisely the WLIF-03 hazard — verbatim
third-party executable JavaScript outside every scope root — that the rest of this phase is built
to prevent.

The comment at lines 1369-1373 asserting the catch never has to undo the workflows step is the
root of the miss; it reasons about *later steps failing* and overlooks *this step failing
partially*.

**Fix:** thread the placed names out of the commit into the catch and unplace them, reusing the
helper that already exists for the sibling path:

```ts
  } catch (err) {
    const leaks = [
      ...(await rollbackReplacements(replacements)),
      // The commit reports what it left at its targets on the throw path too;
      // that report is the removal payload, whatever the error class was.
      ...(await unplaceWorkflows(opts.locations, placedWorkflowNames)),
      ...(await abortHandles(handles)),
    ];
    throw errorWithManualRecovery(err, leaks);
  }
```

and replace the comment at 1369-1373 with the true statement: the commit is last, so no *later*
step in this function can fail, but the commit's own partial failure still places envelopes that
this catch must take back. Add a case that faults `retryFs.rename` on a `workflowsSavedDir`
target *and* on the reversal, then asserts the saved directory is empty and the leak text names
the file.

---

### CR-02: `abortHandles` recursively deletes the staging root the commit deliberately preserved

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1386` and
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1639-1648`

**Issue:**
`commitPreparedWorkflows` moves previously-recorded target envelopes aside into
`<stagingRoot>/.previous/` rather than unlinking them, and on a failed restore it **skips**
`cleanupStaging` on purpose (`stage.ts:419-425`, the CR-01 fix in that file):

```ts
const cleanupLeak =
  unrestored.length > 0
    ? `left ${STAGING_LABEL} at ${prepared.stagingRoot} in place: it still holds ` +
      `${unrestored.length} unrestored previous workflow envelope(s)`
    : await cleanupStaging(prepared.stagingRoot, STAGING_LABEL);
```

The leak string it emits tells the operator the staging root holds "the only copy" and to move it
back by hand.

`replaceAll`'s catch then calls `abortHandles(handles)` → `abortPartialHandles` →
`abortPreparedWorkflows(handles.workflows)` → `cleanupStaging(stagingRoot)`, which is
`fs.rm(dir, { recursive: true, force: true })` (`shared/fs-utils.ts:42`). `.previous/` is inside
that root. The recovery copy the bridge went out of its way to retain is destroyed a few
milliseconds after the message telling the user to go and get it — and the user's previous
workflow envelopes are gone from both their target path (the restore failed) and staging.

This is the exact data-loss class the displace-rather-than-unlink design exists to make
impossible. The guarding comment at `reinstall.ts:1641-1645` reasons only about the *successful*
commit case ("it tolerates being reached from `replaceAll`'s catch after a successful commit
already removed the staging root") and does not consider the deliberate-retention case.

**Fix:** make the workflows abort arm conditional on the commit not having run, or make
`abortPreparedWorkflows` refuse to remove a root that still holds `.previous/`. The narrower fix
is to track whether the commit was entered and skip the abort arm when it was — the commit owns
its own staging lifecycle on both its success and failure paths:

```ts
// replaceAll
let workflowsCommitEntered = false;
...
workflowsCommitEntered = true;
const workflowsLeak = await commitPreparedWorkflows(handles.workflows, { onPlaced: ... });
...
} catch (err) {
  const leaks = [
    ...(await rollbackReplacements(replacements)),
    ...(await unplaceWorkflows(opts.locations, placedWorkflowNames)),
    // The commit owns its staging root on BOTH its paths, and deliberately
    // retains it when it holds the only copy of a displaced envelope.
    ...(await abortHandles(handles, { skipWorkflows: workflowsCommitEntered })),
  ];
  throw errorWithManualRecovery(err, leaks);
}
```

Cover it with a case that faults the restore rename and asserts `<stagingRoot>/.previous/` still
exists after the reinstall fails.

## Warnings

### WR-01: a containment refusal makes the staging sweeper permanently inert, silently

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:115`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1694-1697`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:448-452`

**Issue:** the module doc argues at length that `assertPathInside` must sit *outside* the
swallowing try so "a `PathContainmentError` must propagate rather than be mistaken for an rm
leak". It does propagate — straight into `try { await garbageCollectWorkflowsStaging(locations); }
catch {}` at both call sites, where it is discarded whole. The net observable behavior is
identical to folding it into a leak string, so the design intent is unrealized.

Worse, the assertion is inside the per-entry loop with no per-entry guard, so one refusing entry
aborts the sweep for **every remaining aged tree**. Combined with the swallow, a symlinked
staging segment (the case the test at `workflows-staging-gc.test.ts:207` proves refuses) leaves
GC permanently dead with no user-visible signal, while orphaned executable envelopes keep
accumulating — the exact failure the sweeper exists to prevent.

**Fix:** either let the refusal reach the user, or make it per-entry so one poisoned entry does
not stop the pass. The narrow version:

```ts
try {
  await assertPathInside(locations.workflowsHomeDir, candidate, `workflows staging root ${name}`);
} catch (err) {
  // NFR-10: a refusal is loud but must not abort the sweep of every other tree.
  leaks.push(`${name}: ${errorMessage(err)}`);
  continue;
}
```

If the refusal really must be fatal, then at minimum one of the two call sites has to surface it
rather than swallow it.

---

### WR-02: the 24-hour sweeper deletes the manual-recovery copy the commit deliberately retained

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:6-10,
110-118`

**Issue:** the module header names the retention path explicitly — "the deliberate retention path
a failed restore takes leaves it behind" — and sweeps it anyway. That tree is, per
`stage.ts:419-423`, the **only** copy of the user's previous workflow envelopes, and the leak
string the operator received instructs them to move the file back by hand. Twenty-four hours
later the sweeper deletes it, with no notice (the leaks are discarded at both call sites) and no
liveness signal distinguishing it from a crash orphan.

Independent of CR-02, this puts a silent expiry on a recovery instruction the product just gave.

**Fix:** mark the retention deliberately — e.g. have the commit write a sentinel file into the
retained root (`.retained`) and have the sweeper skip any root containing it, or move the
unrestored envelopes to a sibling `recovery/` tree the sweeper does not walk. Whatever the
mechanism, the sweeper must be able to tell "abandoned by a crash" from "kept on purpose because
it holds the only copy".

---

### WR-03: `update` never re-stages workflows, and nothing tells the user

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1429-1436, 1448-1455`,
`extensions/pi-claude-marketplace/orchestrators/types.ts:145`,
`extensions/pi-claude-marketplace/shared/errors.ts:360`

**Issue:** three closed sets gained a `workflows` member that `update.ts` cannot produce, and the
comment concedes it: "`update.ts` cannot produce a workflows failure today and gains no behavior
from the widening". The per-axis record assignments at `update.ts:1840-1856` cover skills,
prompts, agents, mcpServers and hooks and deliberately leave `resources.workflows` alone — so the
inventory is at least not erased (good), but the envelopes on disk are never re-staged from the
new source.

The user-visible result: after `/claude:plugin update`, the version, the record and the row all
say updated, while the workflow envelopes still hold the **previous** version's executable
script. A workflow the new version added never appears; one it removed stays installed and
runnable. No row, reason token or warning marks the gap.

Two problems compound here. First, the widening pre-consumes the very signal
`PHASE3_FAILURE_PHASES` was built to give: its own comment says "a future bridge surfaces here as
a TS error", and adding the member now removes that error for workflows specifically. Second, the
deferral has no carrier in the product — only in a source comment.

**Fix:** if the update re-stage is genuinely a later phase, revert the three widenings (they are
type-only and buy nothing today) so the compiler still flags the slot when the re-stage lands,
and surface the gap to the user in the meantime — e.g. a `bridgeWarnings` line on any update of a
plugin whose resolved `componentPaths.workflows` is non-empty, stating the workflows were not
re-materialized and `reinstall` is the remedy.

---

### WR-04: the install ledger's workflows phase loses the prepare's warnings when the commit throws

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1195-1201`

**Issue:** `c.bridgeWarnings.push(...prep.result.warnings)` runs *after* `commitPreparedWorkflows`
returns. Every discovery warning the prepare produced — refused scripts, unreadable files, skipped
directories — is discarded when the commit throws, which is precisely the run where the operator
most needs to know what the bridge saw. Reinstall does not have this problem: it reads
`handles.workflows.result.warnings` at `reinstall.ts:1054` independently of whether the commit
succeeded.

**Fix:** push the prepare's warnings immediately after the prepare returns, before the commit:

```ts
c.workflowsPrep = prep;
c.stagedWorkflowNames = [];
// Recorded before the commit so a commit throw does not discard what the
// prepare already observed about the source.
c.bridgeWarnings.push(...prep.result.warnings);
const leak = await commitPreparedWorkflows(prep, { onPlaced: ... });
```

---

### WR-05: `garbageCollectWorkflowsStaging` takes a scoped bundle for two scope-independent fields

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts:79-81`

**Issue:** the parameter is a full `ScopedLocations`, but the function reads only
`workflowsStagingDir` and `workflowsHomeDir`, both of which `locations.ts:235-248` derives from
`workflowHomeDir()` with no scope input. The signature therefore implies a per-scope sweep that
does not exist: a project-scope uninstall sweeps user-scope staging trees and vice versa. The
doc comment on the age constant knows this ("`workflowsStagingDir` is scope-independent so the
per-scope `proper-lockfile` state guard does not serialize access to it either") but the
signature does not say it, and `ScopedLocations` is a branded type whose whole purpose is to stop
one scope's path being used in another scope's operation.

**Fix:** narrow the parameter to the two fields it actually reads, so the type states the truth
and no caller can conclude the sweep is scoped:

```ts
export async function garbageCollectWorkflowsStaging(
  locations: Pick<ScopedLocations, "workflowsStagingDir" | "workflowsHomeDir">,
): Promise<string[]> {
```

---

### WR-06: `resourcesFromHandles` defaults `placedWorkflowNames` to `[]`, defeating its own discipline

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:1543,
1560-1567`

**Issue:** the parameter is declared `placedWorkflowNames: readonly string[] = []`, and the
comment immediately below invokes the project's compile-forcing convention — the same convention
`state-io.ts:122` cites for making the schema member required ("Required, like every sibling axis,
so each construction site is compile-forced to answer for it"). A default parameter is the exact
opposite: a future third caller silently records an empty workflow inventory for a plugin whose
envelopes are on disk, which is the record/disk divergence the phase is guarding against, and it
compiles clean.

The existing `plugin?` / `installable?` optionals set the precedent, but they were not introduced
by a change whose stated rationale is that this axis cannot be recovered from disk.

**Fix:** make the parameter required and have `successOutcome`'s call site pass `[]` explicitly,
so the "no state write occurs on that path" reasoning is stated at the site that relies on it
rather than hidden in a default.

---

### WR-07: the reinstall abort test's premise is false, and it is why CR-01/CR-02 are untested

**File:** `tests/orchestrators/plugin/reinstall.test.ts` — "WLIF-01: a replace-step failure leaves
no workflows staging tree behind"

**Issue:** the arrange comment states that faulting the *skills* replace is "the only path on
which the workflows abort arm can fire, because workflows is prepared last and no later prepare
exists to fail after it". That is wrong: the abort arm also fires when the **workflows commit
itself** throws, which is the path CR-01 and CR-02 live on. The test then asserts the envelope is
byte-unchanged and notes "the failure landed BEFORE the workflows step" — so the whole
commit-failure branch of `replaceAll`'s catch has no coverage at all, despite the file's ten new
cases.

The install-side suite does exercise the analogous branch (`WLIF-03: an undo that cannot remove a
placed envelope raises the typed failure`, `T-112-01: an envelope this install did not place
survives the undo byte-unchanged`), which makes the reinstall-side absence a scope gap rather
than a house-style one.

**Fix:** correct the comment, and add the two cases named in CR-01 and CR-02 — fault the
`workflowsSavedDir` rename plus its reversal (assert the saved directory ends empty), and fault
the `.previous/` restore rename (assert the staging root still exists after the failure).

---

### WR-08: the sweeper's permission-denial tests have no root guard

**File:** `tests/orchestrators/plugin/workflows-staging-gc.test.ts:165-186, 188-211`

**Issue:** "records a leak for a staging entry it cannot inspect" and "continues past a staging
tree it cannot remove and names it once" both manufacture failure with `chmod` (`0o444` on the
staging dir, `0o555` on a subtree). Running as root — the default in many container CI images —
those modes do not restrict anything: `lstat` and `rm` succeed, `leaks.length` is `0`, and both
`assert.strictEqual(leaks.length, 1)` calls fail. The repo already has the guard pattern for
exactly this (`tests/orchestrators/reconcile/apply.test.ts:204` checks `process.getuid() === 0`),
so the omission is inconsistent rather than novel.

**Fix:** skip both cases when `process.getuid?.() === 0`, matching the existing precedent:

```ts
if (typeof process.getuid === "function" && process.getuid() === 0) {
  t.skip("chmod-based denial is inert for root");
  return;
}
```

---

_Reviewed: 2026-09-05T19:31:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
