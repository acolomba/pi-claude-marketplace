# Pitfalls Research: v1.7 Transaction Resilience Hardening

**Domain:** Adding rollback correctness, sequential loops, phase-undo ordering, and TOCTOU guards to an existing two-phase plugin manager that already implements `withStateGuard`, `runPhases`, replacement helpers, and ENOENT-tolerant cascades.
**Researched:** 2026-06-02
**Overall confidence:** HIGH (Source-anchored to `transaction/phase-ledger.ts`, `bridges/{agents,commands,skills}/stage.ts`, `orchestrators/plugin/update.ts`, `orchestrators/marketplace/shared.ts`, and the PUP-6 / phase3a tests in `tests/orchestrators/plugin/update.test.ts`).

---

## Summary

These eight TR-* fixes look small in isolation. Each one is a 5-20 line edit to a
single file. But every one of them threads through at least three other guarantees
the code already makes -- and the existing tests deliberately depend on those
guarantees through indirect side-effects (e.g. the PUP-6 test seeds a FILE at the
target path to make rename throw ENOTDIR, and any fix that "tidies up" that obstacle
mid-rollback or pre-stage removes the test's only failure trigger and renders it
GREEN-for-wrong-reasons).

The pitfalls cluster into five integration classes:

1. **Reverse-iteration rollback** -- looks correct, but breaks on ENOENT-tolerant
   forward passes (you must undo only what you proved succeeded, not what you
   attempted), and the existing `rollbackReplacementCommon` already does this
   right -- new sequential commit code MUST adopt the same shape.

2. **Phase-ledger semantics** -- "register for undo after `do` returns" is what the
   v1.7 fix targets, but the boundary "did the phase succeed enough to deserve undo"
   is ambiguous when a phase has internal partial commits (e.g. half the renames
   landed before throwing). The ledger's `executed.push(phase)` AFTER `await phase.do`
   already encodes the answer -- the fix is to widen the catch to invoke the failing
   phase's own `undo` ONCE before re-throwing, NOT to push it onto `executed` (that
   would cause double-rollback when the reverse walk also touches it).

3. **State/disk ordering** -- moving state.json AFTER commits in update.ts looks
   like an obvious correctness fix, but the existing phase 3a contract explicitly
   continues on partial failure (`phase3aFailures: Phase3Failure[]` is appended-to,
   never thrown-from). If state writes only happen "after all commits succeed,"
   ANY phase 3a failure means state.json is never written -- a regression that
   loses the successful sub-bridges from state. The right shape is to write state
   AFTER each commit's success is observed, never before any commit ran.

4. **Ghost state records** -- cascadeUnstagePlugin already fail-fasts (D-03), so
   `dropped.*` captures only what unstaged BEFORE the throw. The pitfall is in
   the CALLER (update.ts, remove.ts, uninstall.ts): partial cascade success means
   some on-disk artifacts are gone but the index/state row still claims they
   exist. Fixing this requires the caller to materialize `dropped.*` into a
   state-mutation, not just observe it for messaging.

5. **TOCTOU on pre-rename target removal** -- The `replacePrepared*` helpers
   explicitly REFUSE to overwrite a target with non-previous content
   (`throw new Error("Cannot replace ... with non-previous content")`). This is
   the PI-6 cross-plugin collision guard. The TR-06 fix "remove orphan targets
   before rename" reverses this guarantee -- you MUST distinguish "orphan we
   created in a prior partial install" from "another plugin's artifact" before
   removing, or the fix becomes a silent cross-plugin data-loss vector.

The test-breakage class is the single largest integration risk: every fix
in TR-01..TR-06 touches code that is already test-pinned through a specific
failure injection (PUP-6's ENOTDIR file, phase3a-commands-fail's directory
obstacle, the `non-previous content` rejection at `stage.ts:411`). The
roadmap MUST surface "what failure injection does this test currently use,
and does the fix change the trigger" as a per-phase planning question.

---

## Critical Pitfalls

These can cause silent data loss, double-rollback, or render existing tests
green-for-wrong-reasons.

### Pitfall 1: Sequential rename loop without rollback-tracking
**Affects:** TR-01 (agents `commitPreparedAgents`), TR-05 (commands `commitPreparedCommands`)

**What goes wrong:** Converting `Promise.all(_stagedFilePaths.map(({from, to}) => rename(from, to)))` to a sequential `for` loop with rollback looks like a one-line refactor. The classic bug is to capture the failing pair only:

```typescript
// WRONG
const completed: typeof prepared._stagedFilePaths = [];
for (const pair of prepared._stagedFilePaths) {
  try {
    await rename(pair.from, pair.to);
    completed.push(pair);
  } catch (err) {
    // rollback `completed` by renaming each `to` back to `from`
    for (const done of completed.reverse()) {
      await rename(done.to, done.from);  // BUG #1: mutating completed in place
    }
    throw err;
  }
}
```

There are three bugs hiding here:

1. **`completed.reverse()` mutates `completed`** -- if anything reads `completed`
   after the catch (logs, leaks array), it sees the reversed order. Use
   `[...completed].reverse()` (the existing `rollbackReplacementCommon` at
   `shared/fs-utils.ts:142` does this correctly).

2. **Each rollback rename can ALSO fail** -- the staging file's parent (`stagingDir`)
   may have been cleaned up by a concurrent abort, or the rename source may now be
   on a different inode after a partial unlink. The shape must accumulate
   rollback-failures into `leaks: string[]` and `appendLeakToError` them onto the
   original throw, like `rollbackReplacementCommon` does.

3. **The staging file may not exist anymore at `pair.from`** -- because step 1 of
   `commitPreparedAgents` already `rm`'d the `_previousEntries[i].targetPath`, and
   if rename succeeded for entries 1..k then the staging file at index k+1 is
   still in staging, but the `to` path may have been overwritten by a concurrent
   process holding NO lock at all (the agents bridge has no `withStateGuard`
   around its rename phase; the state lock is held only by the orchestrator).

**Warning sign (looks right but isn't):** The pre-step (`rm` previous targets at
agents `stage.ts:322-332`) uses `Promise.all`. If TR-01 only converts the
RENAME loop to sequential but leaves the PRE-STEP parallel, then a partial pre-step
failure leaves some old targets removed and others present, and the rollback can't
restore them (it never backed them up -- `commitPreparedAgents` is the "commit"
path, not the `replacePreparedAgents` "backup" path). The fix must either
serialize BOTH or accept that the pre-step's `Promise.all` is unsymmetric with
the new sequential rename (the failure semantics are different: pre-step is
ENOENT-tolerant deletion of OLD targets; rename is creation of NEW targets).

**Prevention strategy:**
1. **Adopt the shape of `rollbackReplacementCommon`** -- it already does
   `for (const pair of [...input.renamed].reverse())`, accumulates leaks into a
   `string[]`, never throws from the rollback loop itself, and returns
   `readonly string[]` for the caller to surface via `appendLeakToError`. The
   commit-path rollback should be the same shape with a different name.
2. **Do NOT roll back the pre-step deletions** -- they were ENOENT-tolerant
   forward passes; the bridge owns no backup for them. Document explicitly that
   commit-path rollback restores the new-rename pairs only, not the
   pre-step-rm'd previous targets. Cross-link this to TR-06 (which DOES need to
   back up "orphan" targets before removing them).
3. **Distinguish `_stagedFilePaths` (a snapshot from prepare) from "renames I
   actually completed"** -- the rolled-back set is a subset of `_stagedFilePaths`.
   Name the local variable accordingly (`completedRenames`, not `done` or
   `executed`).

**Phase to address it:** TR-01 (agents) and TR-05 (commands) in the same phase,
because the shape is identical and divergence between the two bridges is a future
maintenance hazard. Extract a shared `commitWithRollback` helper into
`shared/fs-utils.ts` if the second bridge would otherwise copy-paste 30 lines.

---

### Pitfall 2: Phase-ledger undo includes the failing phase (TR-02 over-correction)
**Affects:** TR-02 (phase-ledger undo gap fix)

**What goes wrong:** The current ledger (`transaction/phase-ledger.ts:120-141`)
ONLY calls undo on previously-executed phases. The reverse-walk skips the
failing phase entirely because `executed.push(phase)` runs AFTER `await phase.do(ctx)`
returns successfully -- a throw aborts the push. So the bug is real: a phase
that does work, then throws, leaves its work uncleaned-by-the-ledger (the phase
is expected to throw a "clean" error, but if it can't clean up internally then
the ledger never gives it the chance via its own `undo`).

The over-correction is to ADD the failing phase to `executed` before the catch:

```typescript
// WRONG -- causes double-undo of every phase
try {
  await phase.do(ctx);
} catch (err) {
  executed.push(phase);  // BUG: this phase didn't fully succeed
  const partials = await rollbackExecuted(executed, ctx);
  // ...
}
```

This causes the failing phase's `undo` to be called, but then EVERY subsequent
phase in the reverse walk is also called -- which is the existing correct
behavior. The bug here is that `rollbackExecuted` already walks `executed.slice().reverse()`,
so pushing the failing phase puts it at the FRONT of the reverse walk: it gets
undone first, which is correct. But the failing phase's `undo` may itself have
been written ASSUMING `do` ran to completion. If the failing phase's `undo`
encounters its own no-op preconditions (e.g. "if X exists, rm X" where X never
got written because `do` threw early), it must be ENOENT-tolerant -- and the
new contract is now silently load-bearing on that.

The other over-correction is to call the failing phase's `undo` SEPARATELY,
then walk `executed` for the prior phases:

```typescript
// WRONG -- double-rollback if executed already includes phase
if (phase.undo) {
  try { await phase.undo(ctx); } catch (undoErr) { partials.push(...) }
}
const partials2 = await rollbackExecuted(executed, ctx);
```

This is correct ONLY if `executed` definitely does NOT contain `phase` (which
is the current state, since push happens after await). But a future refactor
that moves the push BEFORE the await (to make `executed` track "attempted")
would silently double-invoke the failing phase's undo.

**Warning sign (looks right but isn't):** A test that asserts
`undo` was called exactly N times for an N-phase ledger. If the fix adds the
failing phase's undo, the test count becomes N+1 -- but a buggy fix that
double-invokes makes it N+2, and an "off by one" assertion change that
hard-codes the expected count masks the regression silently.

**Prevention strategy:**
1. **Make the boundary explicit in code:** the failing phase's undo is invoked
   from the CATCH block, BEFORE `rollbackExecuted(executed, ctx)`, and the
   reverse walk of `executed` does NOT include the failing phase. The two
   undo invocations are SEPARATE call sites with separate error capture, so
   the structural invariant "every phase's undo is invoked at most once" is
   readable.
2. **Document the new undo contract on `Phase<C>.undo`:** the undo MUST be
   ENOENT/no-op tolerant when called after a partial-do throw -- it cannot
   assume `do` ran to completion. Add this to the JSDoc on the `Phase<C>`
   interface.
3. **Order the partials correctly:** if the failing phase's undo throws, its
   `RollbackPartial` row appears FIRST in the result (consistent with reverse
   order of execution: the failing phase is "most recent"). The user-visible
   rollback-partial cascade reads top-down newest-first.
4. **PathContainmentError discipline:** the existing rule (lines 84-86) that
   undo PathContainmentError re-throws immediately MUST also apply to the
   failing phase's own undo. Apply the same `if (err instanceof PathContainmentError) throw err`
   guard at the new call site.

**Phase to address it:** TR-02 standalone. Add a test that asserts the SPECIFIC
undo-call sequence (failing-phase-undo, then phase-(N-1)-undo, then phase-(N-2)-undo,
...) so the contract is locked. Cite the test from RollbackPartial[] ordering
in `shared/notify.ts` rendering -- the renderer assumes newest-first.

---

### Pitfall 3: Cascade success observation without state mutation (TR-03 ghost records)
**Affects:** TR-03 (cascadeUnstage ghost record)

**What goes wrong:** `cascadeUnstagePlugin` (in `orchestrators/marketplace/shared.ts:317-395`)
fail-fasts on the first bridge throw (D-03), but its `dropped.*` fields
accumulate the successful drops BEFORE the throw. The current consumer pattern
(at every call site) does one of two things:

- **`uninstall.ts` / `remove.ts`:** drop the state row regardless of `outcome.ok`,
  because uninstall semantics is "delete the row even on partial disk failure --
  next reinstall self-heals."
- **`update.ts`:** never calls cascadeUnstagePlugin at the failure path; the
  replace handles own their own rollback.

The TR-03 ghost-record bug is: when cascade fails after `dropped.skills` is full
but before agents finish, the caller drops the WHOLE state row including
`resources.skills` -- but the index records the skills as still attached. If the
caller leaves the row in place instead (the obvious "fix"), then the state row
LIES about the on-disk content: state says skills=[a,b,c] but a,b,c were
successfully unstaged. Next `update` reads stale resources.skills, tries to
`commitPreparedSkills` with `previousSkillNames=[a,b,c]`, and ENOENT-tolerates
its way to a "successful" commit -- but the user sees no `(skills dropped)`
row anywhere because the state-row delta is zero.

**Warning sign (looks right but isn't):** A test that asserts cascade failure
preserves the state row (e.g. "after cascade throws, state.marketplaces[mp].plugins[p]
is unchanged"). This is the SHAPE of the ghost record -- a test that "passes"
because the row is preserved is documenting the bug, not preventing it.

**Prevention strategy:**
1. **Materialize `dropped.*` into a partial state update.** The caller, holding
   the state lock, must mutate `installedPlugin.resources.skills = filter(out
   what dropped)`, then either delete the row (uninstall semantics) or leave
   the SHRUNK row (update semantics). The cascade primitive itself stays
   read-only on state -- only the orchestrator owns the mutation.
2. **Add a typed partial-success return shape** -- `UnstageOutcome.ok === false`
   carries `dropped.*`, which IS the set the caller should remove from state.
   Document: "the caller MUST treat `dropped.*` as a state-mutation directive,
   not a notification-only payload."
3. **Distinguish "cascade failed, partial disk delete" from "cascade failed,
   nothing deleted."** The current shape doesn't structurally distinguish them
   -- `dropped.skills = []` could mean either "skills succeeded but agents
   threw" (no, dropped.skills would be populated then) or "skills threw first"
   (dropped.skills empty AND cause references skills). Add a `phaseReached:
   "skills" | "commands" | "agents" | "mcp" | "complete"` field if the
   semantics aren't already reconstructible from `dropped.*` non-emptiness.

**Phase to address it:** TR-03 standalone. The fix must touch BOTH the cascade
primitive (to document the partial-success contract) AND every caller
(uninstall.ts, remove.ts, possibly the cascade pathway in update.ts) -- a
roadmap that addresses TR-03 only in `shared.ts` will leave a silent caller
bug.

---

### Pitfall 4: State-before-commit reversal breaks continue-on-partial-failure (TR-04)
**Affects:** TR-04 (update.ts state-before-commit fix)

**What goes wrong:** The current `runThreePhaseUpdate` (in `orchestrators/plugin/update.ts:867-923`):

1. `swapStateRecord(args, preflight, handles)` mutates state.json to the NEW
   version + NEW resources.
2. Phase 3a runs four bridge commits, accumulating failures into
   `phase3aFailures: Phase3Failure[]` -- explicitly NOT throwing on partial
   failure (continue-on-failure semantics).
3. If `phase3aFailures.length > 0`, emit aggregate error WITHOUT rolling back
   state. State.json now claims version=NEW with resources=NEW, but disk
   may have version=OLD bytes for some subset.

The obvious fix is to move state.json mutation to AFTER all four commits
succeed. But "all four commits succeed" is not a thing in the current contract
-- the contract is "all four commits ATTEMPT, then aggregate failures." If
state.json only writes when failures.length === 0, then ANY phase 3a failure
means state.json is NEVER written -- which loses the records for the
sub-bridges that DID succeed (e.g. skills committed but agents threw; state
still claims OLD skills resources, but disk has NEW skills bytes -- ghost
records from the other direction).

The deeper issue: state.json mutation needs to reflect "what's on disk after
phase 3a," which means writing state INSIDE the per-bridge loop, recording
each bridge's success individually. The shape is:

```typescript
const stateUpdates: Array<(rec: PluginRecord) => void> = [];
try {
  await commitPreparedSkills(handles.skills);
  stateUpdates.push((rec) => { rec.resources.skills = newSkillNames; });
} catch (err) { phase3aFailures.push(...); }
// ... commands, agents, mcp ...

// AFTER all four commits, apply stateUpdates inside withStateGuard
await withStateGuard(locations, (state) => {
  const rec = state.marketplaces[mp].plugins[plugin];
  for (const upd of stateUpdates) upd(rec);
  if (phase3aFailures.length === 0) {
    rec.version = toVersion;  // only bump version when ALL succeed
  }
});
```

But this is a substantial refactor of swap+phase3a into a single state-guarded
block. The naive "just move the write" misses that the version bump and the
resources update have DIFFERENT failure semantics: resources update is
per-bridge, version bump is all-or-nothing.

**Warning sign (looks right but isn't):** A fix that moves `swapStateRecord`
to AFTER the four commits but does not partition the state-mutation per-bridge
will pass the happy-path tests (PUP-6 happy at line 406, WR-04 at line 817)
because they don't exercise partial-success. The PUP-6 phase-3 failure test
at line 744 will ALSO pass because the test only asserts ONE notification with
the recovery-hint -- it doesn't check state.json contents post-failure. The
bug surfaces only in a synthetic "skills commits, commands throws" scenario.

**Prevention strategy:**
1. **Define the state contract for each phase 3a outcome explicitly.** Four
   bridges × {success, fail} = 16 cases; the state mutation in each case must
   be enumerated. The current code has effectively one case ("all attempts
   complete; state was set optimistically before") and TR-04 needs to define
   16.
2. **Split version bump from resource record update.** Version bump is the
   transactional "this update succeeded" marker -- it bumps iff all four
   bridges succeed. Resource record update is per-bridge -- it records each
   bridge's actual on-disk state regardless of other bridges' outcomes.
3. **Test the partial-failure matrix.** Add 4 tests (one per bridge throwing
   while the others succeed) and assert state.json after each: version=OLD,
   but resources reflect the partial commit. Without these, the "fix" can
   regress to "state.json never written" silently.
4. **Coordinate with TR-03.** Cascade-pathway and direct-pathway failures
   both need consistent state semantics. The cascade-pathway uses
   `cascadeUnstagePlugin`, which produces `dropped.*` -- the direct-pathway
   uses `phase3aFailures`, which produces nothing structural. Unify the
   shape so the state mutation is the same in both.

**Phase to address it:** TR-04, after TR-03. TR-03 establishes the partial-
success state-mutation pattern; TR-04 applies it to update.ts's direct
pathway. Splitting these phases lets the roadmap test the cascade-pathway
fix in isolation before the more complex direct-pathway refactor.

---

### Pitfall 5: PI-6 collision guard bypassed by orphan-target removal (TR-06)
**Affects:** TR-06 (replacePrepared* orphan blocking fix)

**What goes wrong:** `replacePreparedSkills`, `replacePreparedAgents`,
`replacePreparedCommands` all share the same shape:

```typescript
// agents stage.ts:432-434
for (const pair of prepared._stagedFilePaths) {
  if (await pathExists(pair.to)) {
    throw new Error(`Cannot replace agent target with non-previous content at ${pair.to}`);
  }
  await rename(pair.from, pair.to);
}
```

This is the PI-6 cross-plugin collision guard: refuse to overwrite a target that
isn't in `previousNames` (since those got backed up in the prior loop). It's the
SAME mechanism the test at `tests/bridges/skills/stage.test.ts:388-421` exercises:
"replacePreparedSkills restores backups if an unrelated target blocks rename"
-- the test pre-creates `acme-helper` (an unrelated target) and asserts the
replace throws with `/non-previous content/`.

The TR-06 fix "remove orphan targets before rename" wants to handle the case
where a PRIOR install partially succeeded and left orphan content at the target,
blocking reinstall. But the existing guard cannot distinguish "orphan from our
own prior partial install" from "another plugin's artifact that happens to
collide on generated name." If TR-06 removes ANY pre-existing target, then:

1. A user with plugin-A installing skill `acme-helper` and plugin-B installing
   skill `acme-helper` (same generated name, different plugins) will silently
   overwrite each other on reinstall. This is the EXACT scenario PI-6 is
   designed to prevent.
2. The test at `stage.test.ts:388` (which seeds `acme-helper` as "manual helper
   bytes" and expects rejection) will RED. A "fix" that updates the test to
   accept the new behavior is destroying the PI-6 contract.
3. PUP-6 phase-3 failure test at `update.test.ts:744` seeds a FILE at
   `skillsTargetDir/hello-tool` to force rename-into-file ENOTDIR. If TR-06's
   pre-removal step `rm`s that file before the rename, the rename succeeds,
   and the test goes GREEN-for-wrong-reasons (it was supposed to exercise the
   phase 3a failure aggregation path, not the happy path).

**Warning sign (looks right but isn't):** The "natural" TOCTOU window: between
`pathExists(pair.to)` and `rename(pair.from, pair.to)`, another process could
create `pair.to`. This SOUNDS like the bug TR-06 is fixing, but it's not --
the actual TR-06 problem is the ABSENCE of pre-removal in the happy-path
reinstall when there's a leftover from a prior install. A roadmap that frames
TR-06 as "fix the TOCTOU" will write the wrong fix.

**Prevention strategy:**
1. **Distinguish "orphan we own" from "third-party content."** The agents
   bridge already has `isOwnedAgentFile` (`bridges/agents/stage.ts:194`) for
   exactly this distinction -- it inspects file content for an ownership
   marker. Skills and commands don't have an ownership marker today; the only
   ownership signal is the agents-index.json (for agents) and state.json (for
   skills/commands). The TR-06 fix MUST consult state.json's
   `installs[plugin].resources.{skills,prompts}` to decide "this target is
   ours, pre-rm it" vs "this target is foreign, throw the existing error."
2. **Do NOT pre-remove in the catch-all case.** The narrow case TR-06 targets
   is "we tried to install but partially failed; on reinstall, the orphan
   blocks us." The fix is to ALSO inspect state.json: if the plugin's record
   says skills=[a,b,c] but on disk a,b,c+d are present, then d is the orphan
   from a prior partial install (we recorded the success before disk
   finalized, OR vice versa per TR-04). Pre-remove d, NOT pre-remove the
   contents at a,b,c (those should already be in `_previousNames` and going
   through the backup path).
3. **Preserve the PUP-6 test's failure trigger.** The test at update.test.ts:776
   seeds a FILE (not a directory) at `hello-tool`. The TR-06 logic must check
   either (a) "the file is in state.json's skills list" -- it's not, so the
   throw stays, OR (b) "the file matches our ownership pattern" -- it doesn't
   (it's `"obstacle"` text, not a SKILL.md tree). The fix only pre-removes
   what state-or-marker confirms as ours. Re-run PUP-6 after the fix and
   verify the trigger still fires.
4. **Audit `replacePrepared*` test inventory.** Three tests at
   `stage.test.ts:309/351/388` depend on the existing collision behavior:
   the rollback path, the finalize path, and the rejection path. The TR-06
   fix must preserve all three -- specifically, the rejection test (line 388)
   must continue to RED-reject a foreign `acme-helper`. Add a NEW test for
   the orphan case to prove the new behavior.

**Phase to address it:** TR-06 standalone. This is the highest-risk fix because
its happy-path looks like a simplification ("just rm before rename") that
silently re-enables cross-plugin overwrite. Stage the work as: (1) add the
orphan-vs-foreign distinction; (2) add the orphan-detection test; (3) preserve
the rejection test; (4) only then change the replace* path.

---

## Moderate Pitfalls

These cause subtle correctness regressions but are easier to catch in review or
in the existing test suite.

### Pitfall 6: ENOENT tolerance hides a "your target moved" race
**Affects:** TR-01, TR-05 (sequential rename loop)

**What goes wrong:** The existing pre-step `rm` loops (agents `stage.ts:322-332`,
commands `stage.ts:202-213`) tolerate ENOENT because "previous target already
gone is a no-op." After TR-01/TR-05 introduce sequential per-rename rollback,
the rollback loop's reverse-walk MUST also tolerate ENOENT: if the rollback's
`rename(pair.to, pair.from)` finds `pair.to` already gone (because another
process raced in and removed it), the rollback can't restore it. Falling
through with a leak is correct; throwing from the rollback loop poisons the
catch and may double-invoke the outer rollback (in the orchestrator's
state-guard frame).

**Warning sign:** A rollback loop without ENOENT handling that "looks
defensive" -- ENOENT inside rollback isn't an error condition, it's the
expected race outcome.

**Prevention strategy:** Copy the shape from `rollbackReplacementCommon`
(`shared/fs-utils.ts:135-177`): every rollback rename is in a try/catch that
captures `errorMessage(err)` into `leaks[]` -- including ENOENT, since the
caller decides whether to surface the leak. Return readonly `string[]`, never
throw from the rollback.

**Phase to address it:** TR-01 and TR-05 (same shape, same phase).

---

### Pitfall 7: Phase-ledger undo + replacePrepared* both rolling back the same disk delta
**Affects:** TR-02, TR-06 (when reinstall.ts uses the ledger AND replacePrepared*)

**What goes wrong:** `reinstall.ts` uses `replacePrepared*` for atomicity, which
has its own rollback path (`rollbackPrepared*Replacement`). If reinstall.ts ALSO
wraps the replace step inside a `runPhases` ledger, then a later phase's throw
triggers the ledger's reverse-walk, which invokes the replace step's `undo` --
which in turn calls `rollbackPrepared*Replacement`. Fine so far. But if the
REPLACE step itself failed and was rolled back internally via the catch at
`stage.ts:445`, the ledger's reverse-walk would then try to undo a step that
already self-cleaned, leading to "rollback the rollback" / double-rollback
exceptions.

**Warning sign:** A phase whose `do` already catches and rolls back internally
-- the corresponding `undo` becomes ambiguous (is it idempotent? does it
detect the prior internal rollback?).

**Prevention strategy:** A phase that does its own internal rollback on
throw MUST throw a typed error that the ledger's `undo` can recognize and
no-op on. Alternatively, the phase should not be wrapped in `runPhases` at all
-- it owns its own transaction. Document this in the `Phase<C>` JSDoc: "if
your `do` rolls back internally on throw, your `undo` is only invoked for
do-success-then-later-phase-throw scenarios, NOT for do-throw scenarios."

**Phase to address it:** TR-02. Audit every call site of `runPhases` for
"phases whose do catches" -- the agents/commands/skills replace functions
fit this pattern.

---

### Pitfall 8: Aggregating leaks from rollback into the wrong error
**Affects:** TR-01, TR-05 (catch-and-rollback path)

**What goes wrong:** The rollback loop accumulates leaks; the catch then needs
to surface those leaks alongside the ORIGINAL error. The existing pattern uses
`appendLeakToError` (`shared/errors.ts`), which appends leak strings to the
error message. The pitfall is to wrap the original error in `ManualRecoveryError`
(which `replacePrepared*` does at `stage.ts:454` and `stage.ts:286`) when only
the COMMIT path actually has manual-recovery semantics. Wrapping the original
phase-3a-style continue-on-failure throws in `ManualRecoveryError` will route
them through the manual-recovery cascade in `shared/notify.ts`, which is the
WRONG presentation for a transient commit-time IO error.

**Warning sign:** A commit-path catch that does `throw new ManualRecoveryError(
errorMessage(err), leaks, { cause: err })` by copy-paste from the
`replacePrepared*` pattern.

**Prevention strategy:** Use `appendLeakToError(err, leaks)` for commit-path
leaks (existing pattern at stage.ts:242, :334, :346). Reserve
`ManualRecoveryError` for replacement-path leaks where the user must take
action to restore prior state. The user-visible difference is the
`⊘ <resource> (manual recovery) {<reason>}` marker vs the
`{rollback partial}` body -- both per the v1.3 style guide §15.

**Phase to address it:** TR-01, TR-05 in review.

---

### Pitfall 9: Replacement WeakMap leak when rollback throws inside its own catch
**Affects:** TR-02 (phase-ledger integration with replacePrepared*)

**What goes wrong:** `replacePreparedAgents` stores internals in a WeakMap
keyed by the returned `replacement` object. If the catch at line 445 throws
(via `ManualRecoveryError`), the function never returns the `replacement`
object, but if the catch's `rollbackAgentsReplacementInternal` ALSO throws
(violating the "never throws" contract), the WeakMap entry is never created.
That's actually fine -- no caller holds the key. BUT if a future refactor
under TR-02 reorders the calls so the WeakMap insertion happens BEFORE the
try block, then a throw leaves a WeakMap entry pointing at internals whose
backupRoot has already been cleaned up by a finalize call from another
code path -- a logical use-after-free.

**Warning sign:** Moving `agentsReplacementInternals.set(replacement, ...)`
or `commandsReplacementInternals.set(replacement, ...)` outside the try block
to "simplify the happy path."

**Prevention strategy:** Keep WeakMap insertion as the LAST statement before
return (existing position at stage.ts:464). Add a JSDoc comment noting that
the WeakMap entry's lifetime is intentionally bound to successful return.

**Phase to address it:** TR-02 review checklist.

---

### Pitfall 10: Pre-existing `agentsResult.failed.length > 0` cascade throw
**Affects:** TR-03 (cascade ghost record fix)

**What goes wrong:** `cascadeUnstagePlugin` at lines 350-365 throws when
`agentsResult.failed.length > 0` -- this is the AG-5 foreign-content
soft-fail aggregator. The TR-03 fix to materialize `dropped.*` into state
mutation must NOT silently swallow this throw, because foreign-content
failures specifically should NOT result in state-row removal (the user has
foreign content that they own; we don't want to drop the state row that
remembers our prior install).

**Warning sign:** A TR-03 fix that always strips `dropped.*` from state on
cascade failure -- the AG-5 case needs to KEEP the row.

**Prevention strategy:** Inspect `cause` in `UnstageOutcome.ok === false`.
If `cause instanceof AgentsUnstageFailureError`, the row stays (foreign
content marker). For other throws, materialize `dropped.*` as a partial
removal. Add a test that drives a foreign-content scenario and asserts the
state row is preserved with the original resources array.

**Phase to address it:** TR-03, integrated with the agents-bridge AG-5
contract documentation.

---

### Pitfall 11: PUP-6 test trigger removal masks regression
**Affects:** TR-06 (replacePrepared* orphan removal)

**What goes wrong:** PUP-6 phase-3 failure test at `update.test.ts:744-813`
seeds a FILE at `skillsTargetDir/hello-tool` as the obstacle. The PUP-6 test
relies on rename(staged-dir, target-file) failing with ENOTDIR. The test's
comment at line 749 says "rename(dir -> file) returns ENOTDIR on Linux/macOS."

A TR-06 fix that pre-removes orphans before rename would `rm` the file at
`hello-tool`, the rename would succeed, the test would expect "1 notification
with recovery hint" but would observe "1 notification of success" -- which
the assertion `assert.match(allText, /plugin-uninstall \+ plugin-install/)`
would fail on, so the test would RED. The hazard is updating the test to
match the new behavior (e.g. seeding a DIFFERENT obstacle, like a non-empty
directory with content the orphan-detection would refuse to remove) -- this
documents the new behavior but loses the original ENOTDIR-failure-aggregation
coverage.

**Warning sign:** A PR that modifies BOTH the source and the PUP-6 test in
the same commit, with the test change being "replace the file obstacle with
something the orphan-removal won't touch."

**Prevention strategy:**
1. Identify the test's REAL purpose: phase 3a failure aggregation, not the
   specific ENOTDIR trigger. Replace the file obstacle with a synthetic
   bridge-commit injection (e.g. a stub `commitPreparedSkills` that throws)
   so the test exercises the aggregation path independently of the
   filesystem-level failure mode.
2. Keep BOTH tests: the ENOTDIR-via-file test (renamed and scoped to "the
   pre-existing file at target is treated as foreign and triggers phase 3a
   failure") AND the synthetic-throw test (covering aggregation contract).
3. Document the test's intent in a comment so future refactors don't
   "simplify" the obstacle setup.

**Phase to address it:** TR-06, alongside the source fix in the same phase.

---

### Pitfall 12: State write before all bridge commits leaves stale resources on retry
**Affects:** TR-04 (state-before-commit fix)

**What goes wrong:** The current order is `swapStateRecord` then four
commits; if the user retries `update` after a phase 3a failure, the
`preflightUpdate` reads state.json with `version=NEW` and computes
"already up to date" -- short-circuiting the retry. So the user must run
`reinstall`, which is the recovery hint at line 928.

If TR-04 moves state.json write to AFTER all commits and partitions per-bridge,
then a retry sees `version=OLD` but `resources.skills=NEW` (partial). The
preflight may now compute "version drift, do the update" -- and the second
update tries to re-commit skills that are already on disk. If the bridges
are idempotent on re-commit (skills bridge does `rm <target>` then `rename`,
which works whether or not target exists -- but the `_previousNames` came
from state.json's OLD skills, not NEW), then the re-commit will rm the
OLD-named targets (which were already replaced with NEW-named) -- ENOENT
no-op -- then rename NEW staging into NEW target -- which already has NEW
bytes -- ENOTDIR if target is a dir? success if rename overwrites? depends on
OS and on the bridge's specific shape.

**Warning sign:** A TR-04 fix that doesn't add a retry test.

**Prevention strategy:** Add a test that: (1) seeds a partial-success state
(version=OLD, resources.skills=NEW, disk skills=NEW); (2) runs `update`
again; (3) asserts version=NEW after the retry, no notification of
unexpected work. This exercises the re-entrant contract that TR-04's
partitioning enables.

**Phase to address it:** TR-04, with the retry test as a success criterion.

---

## Minor Pitfalls

These are documentation/test-coverage gaps with low blast radius.

### Pitfall 13: TR-07 documentation drift
**Affects:** TR-07 (agents step-1 self-healing rm)

**What goes wrong:** The agents bridge step 1 (`stage.ts:322-332`) does
`rm` on `_previousEntries[i].targetPath` with ENOENT tolerance. The
"self-heal" claim is documented at lines 11-13: "if commit fails after
writing files but before persisting the index, the next unstage's ENOENT
tolerance plus the index showing OLD targetPaths self-heals." TR-07 asks
for a test of this property. The hazard is writing a test that asserts
the IMPLEMENTATION (calls to rm) instead of the BEHAVIOR (retry succeeds
without ghost records). An implementation-asserting test breaks every
refactor.

**Prevention strategy:** Drive the test through `prepareStagePluginAgents`
+ partial-commit-injection + `commitPreparedAgents`, then re-run the same
sequence, and assert FINAL state on disk + index. Don't assert intermediate
function calls.

**Phase to address it:** TR-07.

---

### Pitfall 14: TR-08 cache-drop swallow rationale documentation
**Affects:** TR-08 (D-19-01 cache-drop swallow)

**What goes wrong:** D-19-01 documents that list.ts's `PROBE_FAILURES`
buffer was removed in Phase 19; cache-drop failures are intentionally
swallowed. The risk in TR-08 is documenting WHAT was changed without
documenting WHY -- the rationale ("probe failures during list are
diagnostic noise, not actionable user errors") is what protects future
refactors from "fixing" the swallow.

**Prevention strategy:** Inline the WHY into the source comment (not just
the ADR). Add an architecture test that asserts no `PROBE_FAILURES`-style
module-level state in `list.ts`.

**Phase to address it:** TR-08.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| TR-01 / TR-05 (sequential rename) | Pitfall 1 (rollback bugs), Pitfall 6 (ENOENT in rollback), Pitfall 8 (wrong error type) | Extract `commitWithRollback` helper into `fs-utils.ts`; copy shape from `rollbackReplacementCommon`; use `appendLeakToError` not `ManualRecoveryError` |
| TR-02 (phase-ledger undo gap) | Pitfall 2 (failing-phase undo boundary), Pitfall 7 (double-rollback with replacePrepared*) | Two SEPARATE call sites in the catch (failing phase undo, then `rollbackExecuted`); document undo's "may be called after partial-do" contract |
| TR-03 (cascade ghost record) | Pitfall 3 (state mutation per dropped.*), Pitfall 10 (AG-5 foreign content carve-out) | Caller materializes `dropped.*` into state mutation; AG-5 cause preserves the row; add cause-discrimination test |
| TR-04 (state-before-commit) | Pitfall 4 (partial-failure state matrix), Pitfall 12 (re-entrant retry) | Split version bump from resources update; 4-bridge × 2-outcome failure matrix tests; retry test |
| TR-06 (replacePrepared* orphan) | Pitfall 5 (PI-6 cross-plugin), Pitfall 11 (PUP-6 trigger preservation) | Orphan vs foreign distinction via state.json + ownership marker; preserve `non-previous content` rejection test; add synthetic-throw PUP-6 variant |
| TR-07 / TR-08 (documentation) | Pitfall 13 (impl vs behavior testing), Pitfall 14 (WHY in source) | Behavior-asserting tests; inline rationale comments; architecture test for cache-drop swallow |

---

## Integration Pitfall: Test Suite Co-Adaptation

The single highest-risk integration class is "tests pinned through specific
failure injection." The PUP-6 test (`update.test.ts:744`), the phase3a-commands-fail
test (line 1584), and the agents-target-is-directory test (line 1641) all use
SPECIFIC filesystem-level obstacles to trigger commit failures. The fixes in
TR-01, TR-03, TR-04, TR-06 all touch the code paths these tests exercise. A
"green tests after the fix" assertion is NOT proof of correctness -- the
tests may be passing because the fix silently disabled the failure trigger.

**Prevention strategy:** For each TR-* fix, the planning doc MUST enumerate
which tests depend on the failure-trigger AND verify the trigger still fires
under the fix. If the trigger no longer fires, add a synthetic injection
(stub bridge that throws) as a parallel test so the failure-aggregation
contract is still covered.

**Phase to address it:** All TR-* phases. The roadmap's per-phase success
criteria should include: "the [list of impacted tests] still trigger
phase-N failure path after the fix." Cite the test:line for each.

---

## Sources

### Authoritative (HIGH confidence, source-anchored)

- `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` (current
  ledger shape: `executed.push(phase)` after await, reverse-walk only over
  successful phases, PathContainmentError re-throw discipline, AS-4
  RollbackPartial shape with cause-preservation).
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` (commit Step 1
  `Promise.all` rm with ENOENT tolerance at lines 322-332; Step 2 parallel
  rename at line 343; foreign-content preservation; `replacePreparedAgents`
  backup loop + non-previous-content rejection at lines 432-434).
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` (sequential
  ENOENT-tolerant unlink at lines 202-213; sequential rename at lines
  219-221; `replacePreparedCommands` non-previous-content rejection at
  line 277).
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` (similar
  shape; existing test pinned at `tests/bridges/skills/stage.test.ts:388-421`
  for the rejection contract).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:825-950`
  (the three-phase update: swapStateRecord BEFORE phase 3a, continue-on-failure
  semantics with `phase3aFailures: Phase3Failure[]`, aggregate error path
  with recovery hint).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:317-395`
  (cascadeUnstagePlugin D-03 fail-fast with partial `dropped.*` accumulation;
  AG-5 throw at lines 350-365).
- `extensions/pi-claude-marketplace/shared/fs-utils.ts:135-177`
  (rollbackReplacementCommon: the existing reference shape for sequential
  reverse-walk rollback with leaks aggregation).
- `tests/orchestrators/plugin/update.test.ts:744-813` (PUP-6 phase-3
  failure test, ENOTDIR-via-file obstacle, CR-01 `notifications.length === 1`
  assertion).
- `tests/orchestrators/plugin/update.test.ts:1584-1640` (phase3a-commands-fail
  test, directory obstacle pattern).
- `tests/bridges/skills/stage.test.ts:388-421` (Phase 8 / PRL-10 unrelated-
  target rejection test -- the test TR-06 is most likely to break).
- `.planning/PROJECT.md` (v1.7 milestone scope, TR-01..TR-08 active
  requirements, NFR-1 atomicity contract, NFR-2 recoverability without
  restart, NFR-3 retry-safety, the v1.3 messaging style guide marker
  vocabulary `{rollback partial}` / `(manual recovery)`).

### Cross-referencing (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` and `.planning/research/STACK.md`
  (predecessor milestone research; unchanged for TR-* scope but consulted
  for the `withStateGuard` / `appendLeakToError` patterns).
- `extensions/pi-claude-marketplace/shared/errors.ts` (PluginUpdatePhase3Error,
  ManualRecoveryError, appendLeakToError -- the error-routing contract that
  determines user-visible presentation).
- `docs/messaging-style-guide.md` v1.0 §15 (the `{rollback partial}` and
  `(manual recovery)` marker contract that distinguishes commit-path leaks
  from replacement-path leaks; constrains Pitfall 8's "wrong error type"
  warning).
