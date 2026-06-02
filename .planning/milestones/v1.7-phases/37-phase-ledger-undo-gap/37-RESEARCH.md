# Phase 37: Phase-Ledger Undo Gap - Research

**Researched:** 2026-06-02
**Domain:** Saga / phase-ledger compensation ordering; failing-phase own-undo invocation
**Confidence:** HIGH

## Summary

Phase 37 closes a single, surgical defect in `runPhases` in
`extensions/pi-claude-marketplace/transaction/phase-ledger.ts`: when a phase's `do`
throws partway through its forward work, the ledger today never gives that phase a
chance to clean up. The failing phase's `undo` (if any) is silently skipped because
`executed.push(phase)` runs AFTER `await phase.do(ctx)` returns, so a throw aborts
the push and the reverse-walk over `executed[]` sees only phases that fully
succeeded. The fix has been pre-decided by the milestone-wide research in
`.planning/research/SUMMARY.md` and CONTEXT.md SC#1: invoke the failing phase's
`undo` as a SEPARATE catch-block call site BEFORE `rollbackExecuted(executed, ctx)`,
and DO NOT push the failing phase onto `executed[]` (which would cause the reverse
walk to double-invoke it).

The fix is small (a structural change to `runPhases` plus a JSDoc amendment on
`Phase<C>.undo`), but the surrounding discipline is load-bearing: `PathContainmentError`
from the failing phase's own undo MUST re-throw immediately at the new call site
(mirroring `phase-ledger.ts:84-86`), undo-failure rows from the failing phase MUST
appear FIRST in `rollbackPartials` (consistent with "newest first" reverse-execution
order), and every existing `Phase<C>` consumer's `undo` MUST tolerate being called
after a partial-do throw. The four production consumer phases in `install.ts`
(skills/commands/agents/mcp) already gate their undo on `if (c.<bridge>Prep === undefined) return;`
making them naturally tolerant; the fifth phase `statePhase` defines no `undo`
which is the correct treatment (pure in-memory mutation discarded on throw).

**Primary recommendation:** In `runPhases`, restructure the catch block to call the
failing phase's `undo` first (with `PathContainmentError` re-throw and `RollbackPartial`
capture) and then `rollbackExecuted(executed, ctx)`. Prepend the failing-phase undo
partial (if any) to the reverse-walk partials so the result's `rollbackPartials[]`
reads newest-first. Update `Phase<C>.undo` JSDoc to document the "may be called after
a partial-do throw" contract. Add one regression test asserting the exact undo-call
sequence (phase2.undo, phase1.undo, phase0.undo) for a 3-phase ledger where phase 2
throws.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Phase-ledger ordering / undo orchestration | `transaction/phase-ledger.ts` | -- | The only file that owns "what is `executed[]`, when does `undo` run, how are undo failures aggregated." |
| Containment-error escalation | `shared/path-safety.ts` (definition) + `transaction/phase-ledger.ts` (re-throw discipline) | -- | `PathContainmentError` is defined in `shared/path-safety.ts:9-18`; the ledger's responsibility is to re-throw it immediately at every undo-invocation site (PI-14). |
| Per-bridge undo idempotency (skills/commands/agents/mcp) | Existing `install.ts` undo arms (no change) | `bridges/*/stage.ts` `unstage*` helpers (already ENOENT-tolerant) | The new contract on `Phase<C>.undo` is documentary -- existing implementations already satisfy it via `if (c.<bridge>Prep === undefined) return;` guards. |
| Rendering the rollback-partial body | `shared/notify.ts` (V2 renderer) | -- | Phase 37 ships RAW data (`RollbackPartial[]`). Order matters because the V2 renderer walks the array top-down. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states implementation is at Claude's discretion (discuss phase skipped via
`workflow.skip_discuss: true`). The five Specific Ideas in CONTEXT.md `<specifics>`
function as locked success criteria:

1. In `runPhases`, when `phase.do(ctx)` throws, the failing phase's `undo(ctx)` is
   called exactly once from the catch block BEFORE `rollbackExecuted(executed, ctx)`;
   `executed[]` does NOT contain the failing phase (prevents double-rollback by the
   reverse walk).
2. `Phase<C>.undo` JSDoc documents that undo must tolerate being called after a
   partial-do throw (ENOENT-tolerant, no-op if nothing to clean up).
3. `PathContainmentError` from the failing phase's `undo` re-throws immediately,
   matching the existing discipline at `phase-ledger.ts:84-86`.
4. A regression test asserts the exact undo-call sequence for a 3-phase ledger where
   phase 2 throws: `phase2.undo`, then `phase1.undo` (reverse walk), `phase0.undo`
   (reverse walk) -- each invoked exactly once.
5. `npm run check` GREEN; existing install/uninstall/reinstall tests unchanged.

### Claude's Discretion

All implementation choices (variable naming, exact structure of the catch block,
JSDoc wording, whether to factor a helper) are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)

None per CONTEXT.md.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TR-02 | `runPhases` in `transaction/phase-ledger.ts` invokes the failing phase's own `undo` before reverse-walking `executed[]`; failing phase's undo is called exactly once as a separate catch-block call site, never via `executed[]` addition (prevents double-rollback); Phase interface JSDoc documents that `undo` must tolerate being called after a partial-do throw. | Fix site verified at `phase-ledger.ts:120-141`; PathContainmentError re-throw discipline verified at lines 84-86; consumer phases verified ENOENT-tolerant at `install.ts:481-492, 514-523, 560-572, 590-600`. |

## Project Constraints (from CLAUDE.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Conventional Commits, titles >=5 and <=72 chars, body lines <=80 chars | CLAUDE.md "Git" | Commits land as `fix(transaction):` or `refactor(transaction):` -- never `chore:`. |
| `pre-commit run --all-files` before commit; fix failures, restage, re-run | CLAUDE.md "Git" | Implementation tasks MUST verify hooks pass before commit (lint/format failures block commit). |
| `SKIP=trufflehog` prefix only when committing from a worktree | CLAUDE.md "Git" | Not applicable here (working in the main checkout); no SKIP prefix on the regular branch. |
| TypeScript strict; discriminated `installable: true \| false` (NFR-7) | CLAUDE.md "Constraints" | Not directly touched, but `Phase<C>` is a TypeScript-strict generic interface -- the JSDoc amendment MUST not regress strict-mode type-checking. |
| Atomic file ops; recovery via `/reload` only (NFR-1/NFR-2) | CLAUDE.md "Constraints" | The fix MUST preserve the ledger's "never throws on its own; callers inspect `result.ok`" contract (line 110) so orchestrators can keep using `/reload`-safe recovery flow. |
| Output via `ctx.ui.notify` only (IL-2) | CLAUDE.md "Constraints" | Not touched -- `runPhases` does not emit notifications. |
| `npm run check` must stay GREEN (NFR-6) | CLAUDE.md "Constraints" | Phase-gate validation; SC#5 enforces this. |
| GSD workflow enforcement: edits only inside a GSD workflow | CLAUDE.md "GSD Workflow Enforcement" | Implementation MUST proceed via `/gsd-execute-phase`, not direct edits. |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | bundled with Node >=20.19.0 | Test framework for the regression test | Project convention `[VERIFIED: package.json scripts.test]`; existing `tests/transaction/phase-ledger.test.ts` already uses `node:test` + `node:assert/strict`. |
| TypeScript | `^5.9.3` | Phase<C> generic interface and strict-mode discriminated rollback result | `[VERIFIED: existing tsconfig + package.json]`; the JSDoc amendment is type-checked under strict. |
| `node:assert/strict` | bundled with Node >=20.19.0 | `assert.deepEqual`, `assert.equal`, `assert.rejects` in the regression test | Existing convention in `tests/transaction/phase-ledger.test.ts:1` `[VERIFIED: file read]`. |

### No new dependencies

`.planning/research/SUMMARY.md` is explicit: "No new dependencies. All eight fixes
stay within `extensions/pi-claude-marketplace/`." Phase 37 specifically requires
zero new packages.

## Package Legitimacy Audit

Not applicable -- Phase 37 installs no new packages. The fix is a structural change
to one existing source file plus a regression test using already-installed
`node:test` and `node:assert/strict` built-ins.

## Architecture Patterns

### System Architecture Diagram

```
                    Orchestrators (install.ts -- only direct consumer today)
                         │
                         │  buildPhases() -> readonly Phase<C>[]
                         ▼
            ┌─────────────────────────────────┐
            │  runPhases(phases, ctx)         │
            │  ─────────────────────          │
            │                                 │
            │   for each phase in order:      │
            │     try {                       │
            │       await phase.do(ctx);      │
            │       executed.push(phase);     │
            │     } catch (err) {             │
            │                                 │
            │  ┌──── NEW (Phase 37) ────┐    │
            │  │  1. failingPhase.undo? │    │  ←── failing phase's undo, FIRST
            │  │     (sep. call site)   │    │      [PathContainmentError re-throw]
            │  │     -> RollbackPartial │    │      [Error -> partial row]
            │  └────────────────────────┘    │
            │                                 │
            │       2. rollbackExecuted(      │  ←── reverse walk over phases that
            │            executed, ctx)       │      fully succeeded (existing)
            │                                 │
            │       3. return {ok:false,      │  ←── partials = [failingPartial?,
            │              error, partials,   │                    ...reversePartials]
            │              leaks:[]};         │
            │     }                           │
            └─────────────────────────────────┘
                         │
                         ▼
            ┌─────────────────────────────────┐
            │  formatRollbackError(result,    │
            │    result.error)                │
            │  -> RollbackErrorResult         │
            └─────────────────────────────────┘
                         │
                         ▼
                 shared/notify.ts V2 renderer
                 (RollbackPartial[] -> body)
```

Key contract preservation:
- `runPhases` still never throws on its own (line 110 contract); only
  `PathContainmentError` from any undo escapes.
- `RollbackPartial` shape unchanged: `{phase, msg, cause?}`.
- `rollbackExecuted` signature unchanged; only `runPhases` changes.
- The order in `rollbackPartials[]` remains "newest first" -- failing-phase undo
  partial is index 0, then `executed.reverse()` partials follow.

### Recommended Project Structure

No new files. The fix is in-place:

```
extensions/pi-claude-marketplace/
└── transaction/
    └── phase-ledger.ts        # MODIFIED (runPhases catch block, Phase<C> JSDoc)

tests/
└── transaction/
    └── phase-ledger.test.ts   # MODIFIED (1 new test + possibly an updated count assertion)
```

### Pattern 1: Failing-phase own-undo invocation (saga compensation discipline)

**What:** When a saga step's forward action throws, that step's own compensation
runs FIRST (because the step partially started -- by saga literature it is "eligible
for compensation" the moment `do` begins, not when it completes). Then earlier
steps' compensations run in reverse order of their successful completion.

**When to use:** Any phase-ledger where forward actions can have side effects that
must be cleaned up even after a partial-do throw. All four production consumer
bridge phases (skills/commands/agents/mcp) in `install.ts` fit this profile --
their `do` stages onto disk before throwing.

**Example (post-fix shape):**
```typescript
// Source: research synthesis grounded in Microsoft Compensating Transaction
// Pattern, Temporal Saga Compensating Transactions, and the existing project
// convention at extensions/pi-claude-marketplace/transaction/phase-ledger.ts.
export async function runPhases<C>(
  phases: readonly Phase<C>[],
  ctx: C,
): Promise<RunPhasesResult> {
  const executed: Phase<C>[] = [];
  for (const phase of phases) {
    try {
      await phase.do(ctx);
      executed.push(phase);
    } catch (err) {
      const original = err instanceof Error ? err : new Error(String(err));

      // Failing phase's own undo FIRST -- separate call site so the
      // structural invariant "every phase's undo runs at most once" is
      // visually obvious and the failing-phase partial sorts to index 0
      // of the result (consistent with reverse-execution order, where the
      // failing phase is "most recent").
      const failingPartial: RollbackPartial | undefined =
        phase.undo === undefined
          ? undefined
          : await invokeFailingPhaseUndo(phase, ctx);

      // Then reverse-walk the phases that fully succeeded.
      const reversePartials = await rollbackExecuted(executed, ctx);

      const partials: RollbackPartial[] =
        failingPartial === undefined
          ? reversePartials
          : [failingPartial, ...reversePartials];

      return { ok: false, error: original, rollbackPartials: partials, leaks: [] };
    }
  }
  return { ok: true, rollbackPartials: [], leaks: [] };
}

// Local helper: identical capture+re-throw discipline to rollbackExecuted's
// inner try/catch (phase-ledger.ts:81-98). PathContainmentError still escapes.
async function invokeFailingPhaseUndo<C>(
  phase: Phase<C>,
  ctx: C,
): Promise<RollbackPartial | undefined> {
  if (phase.undo === undefined) return undefined;
  try {
    await phase.undo(ctx);
    return undefined;
  } catch (undoErr) {
    if (undoErr instanceof PathContainmentError) throw undoErr;
    return {
      phase: phase.name,
      msg: errorMessage(undoErr),
      ...(undoErr instanceof Error && { cause: undoErr }),
    };
  }
}
```

### Pattern 2: ENOENT-tolerant undo (existing convention)

**What:** Every consumer `undo` arm in `install.ts` is gated on `if (c.<bridge>Prep === undefined) return;` so that a phase whose `do` threw before assigning the prep
context object will no-op cleanly. The bridge-level unstage helpers
(`unstagePluginSkills`, `unstagePluginCommands`, `unstagePluginAgents`,
`unstageMcpServers`) are already ENOENT-tolerant by codebase convention.

**Example (verified in source at `install.ts:481-492`):**
```typescript
const skillsPhase: Phase<InstallCtx> = {
  name: "skills",
  do: async (c) => { /* ... stages and commits skills ... */ },
  undo: async (c) => {
    if (c.skillsPrep === undefined) {
      return;
    }
    // Commit already succeeded -- the dirs are at the target path.
    // unstage* by name removes them.
    await unstagePluginSkills({
      locations: c.locations,
      previousSkillNames: c.stagedSkillNames,
    });
  },
};
```

The same gate appears at `install.ts:514-523` (commandsPhase), `:560-572`
(agentsPhase), and `:590-600` (mcpPhase). The fifth phase `statePhase` defines no
`undo` at all -- comment at `:651-654` documents that "at state-commit phase time
the guard has not flushed yet, and on throw the guard does NOT save the mutated
snapshot." That is the correct, intentional treatment for pure in-memory mutation.

### Anti-Patterns to Avoid

- **Pushing the failing phase onto `executed[]` before the catch.** This would
  cause `rollbackExecuted`'s reverse walk to invoke the failing phase's `undo` --
  but combining that with a separate failing-phase undo call site would
  DOUBLE-INVOKE it. The locked SC#1 rule is "executed[] does NOT contain the
  failing phase."
- **Folding the failing-phase undo invocation INTO `rollbackExecuted` (e.g. by
  passing the failing phase as a separate argument or by prepending it to the
  array before calling).** This violates SC#1's "separate catch-block call site"
  requirement and obscures the structural invariant. Two SEPARATE call sites are
  the readable form.
- **Appending the failing-phase partial to the END of `rollbackPartials[]`.**
  The reverse-execution order convention (verified in the existing
  `rollbackExecuted` at `phase-ledger.ts:76` which walks `executed.slice().reverse()`)
  is "newest first." The failing phase IS the newest. It belongs at index 0.
- **Modifying `rollbackExecuted` signature or behavior.** SC#1 calls for a change
  ONLY in `runPhases`'s catch block. The existing `rollbackExecuted` contract is
  load-bearing for the AS-4 partial-aggregation tests at `phase-ledger.test.ts:87-144`
  and MUST remain byte-identical to preserve those tests.
- **Swallowing `PathContainmentError` from the failing phase's own undo.** PI-14
  is unambiguous: state corruption is LOUD. The new call site MUST re-throw
  `PathContainmentError` immediately, matching the discipline at
  `phase-ledger.ts:84-86`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Saga / phase-ledger framework | `node-sagas`, Temporal, `redux-saga` | The existing `runPhases` primitive in `transaction/phase-ledger.ts` | `.planning/research/SUMMARY.md` and `STACK.md` are explicit: "All eight TR-* fixes stay within existing patterns" -- the ledger primitive is the correct shape, only its catch block is broken. Pulling in a saga library would be over-engineering for a one-line structural defect. |
| Error-with-cause wrapper | `verror`, `nesterr`, custom error subclass | `errorMessage(err)` + native `Error.cause` (already used at `phase-ledger.ts:96`) | The existing `RollbackPartial.cause?: Error` field already preserves the original undo throw's Error instance; the depth-5 walker in `shared/notify.ts` traverses `.cause` for user-visible cause chains. No new wrapper needed. |
| ENOENT-tolerant undo helper | New `safeUndo()` wrapper, try-catch macros | Existing `if (c.<bridge>Prep === undefined) return;` guards in `install.ts` + ENOENT-tolerant bridge unstage helpers | The convention is consistent across all four bridge consumer phases. The new JSDoc on `Phase<C>.undo` documents the contract -- no helper required. |

**Key insight:** The fix is structural, not infrastructural. Adding any new
helper module, abstraction, or library would be inconsistent with the milestone-wide
verdict from `.planning/research/SUMMARY.md`: "No new dependencies." Even an internal
helper function like `invokeFailingPhaseUndo` (suggested above) is optional --
inlining the try/catch into `runPhases` keeps the file at <160 lines and reads
fine.

## Runtime State Inventory

Not applicable. Phase 37 is not a rename/refactor/migration. No runtime state
needs migration: the change is to in-memory control flow in a single function.

- **Stored data:** None.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: Double-undo of the failing phase (over-correction)

**What goes wrong:** A "fix" that pushes the failing phase onto `executed[]` BEFORE
the catch block (e.g. `executed.push(phase); await phase.do(ctx);`) makes the
reverse walk over `executed` invoke the failing phase's `undo`. If the catch block
ALSO calls the failing phase's `undo` separately (as SC#1 requires), the undo runs
TWICE. The first invocation may clean up successfully; the second may throw an
ENOENT-tolerated no-op (silent regression) or throw a non-ENOENT error and pollute
the rollback partials.

**Why it happens:** The two over-correction variants (push-before-await + separate
catch-block call, OR rely solely on the reverse walk) both look correct in
isolation. They are wrong only in combination, which is the trap.

**How to avoid:** Treat "executed[] never contains the failing phase" as a hard
invariant. The push position in the loop body stays AFTER `await phase.do(ctx)` (as
today, line 124-125 in `phase-ledger.ts`). The new failing-phase undo call site is
in the catch block, BEFORE `rollbackExecuted(executed, ctx)`. The two call sites
are visually adjacent so a future maintainer cannot accidentally introduce both.

**Warning signs:** A regression test that asserts undo was called "at least once"
instead of "exactly once" hides this bug. The test in SC#4 (assert exact sequence,
each invoked exactly once) is the correct gate.

### Pitfall 2: PathContainmentError silently captured at the new call site

**What goes wrong:** A "convenient" `try { await phase.undo(ctx); } catch (err) { partials.push(...) }` at the new call site captures EVERY undo throw -- including
`PathContainmentError`. This violates PI-14 (state corruption is LOUD) and
silently degrades the loud `assert.rejects` path that the existing test at
`phase-ledger.test.ts:146-163` locks for the reverse-walk case.

**Why it happens:** Copy-paste from the existing `rollbackExecuted` inner catch
LOSES the `if (undoErr instanceof PathContainmentError) throw undoErr;` line
unless you remember to copy lines 84-86 verbatim.

**How to avoid:** The new call site MUST mirror `rollbackExecuted`'s inner catch
EXACTLY -- re-throw `PathContainmentError` first, then capture other errors as
`RollbackPartial` rows (lines 83-98 are the template).

**Warning signs:** The PI-14 test (currently exercising the reverse-walk path)
would NOT cover the failing-phase undo path. Add a parallel test asserting
PathContainmentError from the failing phase's own undo also re-throws.

### Pitfall 3: Partial order in `rollbackPartials[]` inverted

**What goes wrong:** If the failing-phase partial is APPENDED to
`reversePartials` instead of PREPENDED, the V2 renderer in `shared/notify.ts`
(which walks the array top-down per AS-4 / CMC-17 / MSG-RP-1) displays the
failing phase LAST instead of FIRST. The user reads "older phases first, newer
phase last" -- opposite of the reverse-execution convention.

**Why it happens:** Array concatenation defaults to "natural reading order"
(left-to-right). The convention here is "reverse execution order" (newest first).
These look the same for an N=2 case ("failing then earlier") but invert visibly
for N=3+ (failing phase is the most recent, so first; then phases 1, 0 follow in
reverse executed-order).

**How to avoid:** The concatenation is
`failingPartial === undefined ? reversePartials : [failingPartial, ...reversePartials]`.
The regression test in SC#4 (3-phase ledger, phase 2 throws) catches the inversion:
the expected sequence is phase2, phase1, phase0.

**Warning signs:** A test that only checks `rollbackPartials.length` masks
ordering bugs. Assert the `.phase` field of each partial in turn.

### Pitfall 4: `Phase<C>.undo` no longer idempotent under the new contract

**What goes wrong:** A future bridge author writes an `undo` that ASSUMES
`do` ran to completion (e.g. uses a context field set at the END of `do`).
Under the new contract -- invoked after a partial-do throw -- the field may be
`undefined` and the undo throws a `TypeError: Cannot read property 'x' of undefined`.

**Why it happens:** The OLD contract was "undo only runs after `do` completed
successfully" (reverse walk over `executed[]`). The NEW contract is "undo MAY run
after `do` threw partway through." The change is invisible to existing consumer
code unless documented.

**How to avoid:** Update `Phase<C>.undo` JSDoc (line 30-34 of `phase-ledger.ts`,
the `Phase<C>` interface declaration) to document:
> `undo` MUST tolerate being called after a partial-do throw -- it cannot assume
> `do` ran to completion. Bridge authors should gate undo work on context-set
> sentinels (e.g. `if (c.skillsPrep === undefined) return;` as `install.ts` does)
> and the bridge-level cleanup helpers MUST be ENOENT-tolerant.

**Warning signs:** A new orchestrator (e.g. a future v1.8 `migrate.ts`) is added
without this discipline. The drift-guard is documentary, not enforced -- code
review is the gate.

## Code Examples

### Verified pattern: existing `rollbackExecuted` (the template for the new call site)

```typescript
// Source: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:70-102
async function rollbackExecuted<C>(
  executed: readonly Phase<C>[],
  ctx: C,
): Promise<RollbackPartial[]> {
  const partials: RollbackPartial[] = [];

  for (const done of executed.slice().reverse()) {
    if (!done.undo) {
      continue;
    }

    try {
      await done.undo(ctx);
    } catch (undoErr) {
      if (undoErr instanceof PathContainmentError) {
        throw undoErr;
      }

      partials.push({
        phase: done.name,
        msg: errorMessage(undoErr),
        ...(undoErr instanceof Error && { cause: undoErr }),
      });
    }
  }

  return partials;
}
```

### Existing test pattern in `phase-ledger.test.ts`

```typescript
// Source: tests/transaction/phase-ledger.test.ts:43-85 (verbatim)
test("D-01 runPhases: 4 phases, phase 3 throws -> reverse-order undo of phases 1+2", async () => {
  const ctx: TraceCtx = { trace: [] };
  const phases: Phase<TraceCtx>[] = [
    {
      name: "p1",
      do: (c) => { c.trace.push("do:p1"); return Promise.resolve(); },
      undo: (c) => { c.trace.push("undo:p1"); return Promise.resolve(); },
    },
    {
      name: "p2",
      do: (c) => { c.trace.push("do:p2"); return Promise.resolve(); },
      undo: (c) => { c.trace.push("undo:p2"); return Promise.resolve(); },
    },
    { name: "p3", do: throwAsync("boom") },
    {
      name: "p4",
      do: (c) => { c.trace.push("do:p4"); return Promise.resolve(); },
    },
  ];
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, "boom");
  assert.deepEqual(ctx.trace, ["do:p1", "do:p2", "undo:p2", "undo:p1"], "reverse-order undo");
  assert.equal(result.rollbackPartials.length, 0);
});
```

**Critical note:** This existing test pins behavior that MUST CHANGE under the fix.
The phase that throws (`p3`) has NO `undo` defined, so the post-fix trace is
unchanged: `["do:p1", "do:p2", "undo:p2", "undo:p1"]` -- the failing-phase undo
call site is a no-op when `phase.undo === undefined`. **This test remains
GREEN under the fix.** SC#5 ("existing install/uninstall/reinstall tests
unchanged") is preserved because the existing trace test does not give `p3` an
`undo`. Same applies to the test at `:196-228` ("phase WITHOUT undo is silently
skipped during rollback") and the test at `:230-251` ("ctx threaded to every
do AND undo call").

The AS-4 multi-undo-failure test at `:115-144` is also unaffected: phases p1 and
p2 each have an `undo`, but the failing phase p3 has none, so the new failing-phase
call site is a no-op there too. The reverse-walk partials are unchanged.

The PI-14 test at `:146-163` is unaffected for the same reason: the failing phase
p2 has no `undo`; the PathContainmentError comes from p1's undo, captured by the
existing `rollbackExecuted` path.

The non-Error / Error.cause tests at `:260-307` are unaffected.

### Required new regression test (SC#4)

```typescript
// New test for SC#4 -- locks the exact undo-call sequence when the failing
// phase ITSELF has an undo (the path the v1.7 fix newly covers).
test("TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each", async () => {
  const ctx: TraceCtx = { trace: [] };
  const phases: Phase<TraceCtx>[] = [
    {
      name: "p0",
      do: (c) => { c.trace.push("do:p0"); return Promise.resolve(); },
      undo: (c) => { c.trace.push("undo:p0"); return Promise.resolve(); },
    },
    {
      name: "p1",
      do: (c) => { c.trace.push("do:p1"); return Promise.resolve(); },
      undo: (c) => { c.trace.push("undo:p1"); return Promise.resolve(); },
    },
    {
      name: "p2",
      do: (c) => { c.trace.push("do:p2"); throw new Error("boom"); },
      undo: (c) => { c.trace.push("undo:p2"); return Promise.resolve(); },
    },
  ];
  const result = await runPhases(phases, ctx);
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, "boom");
  // EXACT expected sequence: failing phase's own undo FIRST, then reverse walk.
  // Each undo invoked EXACTLY ONCE (no double-rollback).
  assert.deepEqual(
    ctx.trace,
    ["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"],
    "failing-phase undo first, then reverse-walk over executed[], each exactly once",
  );
  assert.equal(result.rollbackPartials.length, 0);
});
```

### Required new regression test (PathContainmentError re-throw at failing-phase undo)

```typescript
// PI-14 discipline applies to the new call site too.
test("PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN", async () => {
  const phases: Phase<object>[] = [
    {
      name: "p1",
      do: () => Promise.resolve(),
      undo: () => Promise.resolve(),
    },
    {
      name: "p2",
      do: () => Promise.reject(new Error("boom")),
      undo: () =>
        Promise.reject(new PathContainmentError("/parent", "/parent/../escape", "p2 undo")),
    },
  ];
  await assert.rejects(
    () => runPhases(phases, {}),
    (err: unknown) => err instanceof PathContainmentError,
  );
});
```

### Required new regression test (RollbackPartial ordering: failing phase FIRST)

```typescript
// AS-4 ordering: failing-phase undo partial appears at index 0 of partials[],
// followed by reverse-walk partials in execution-reverse order.
test("AS-4 runPhases: failing-phase undo failure is FIRST in rollbackPartials[]", async () => {
  const phases: Phase<object>[] = [
    { name: "p0", do: noopAsync, undo: throwAsync("p0 undo failed") },
    { name: "p1", do: noopAsync, undo: throwAsync("p1 undo failed") },
    { name: "p2", do: throwAsync("boom"), undo: throwAsync("p2 undo failed") },
  ];
  const result = await runPhases(phases, {});
  assert.equal(result.ok, false);
  assert.equal(result.error?.message, "boom");
  assert.equal(result.rollbackPartials.length, 3);
  // Newest first: failing phase (p2), then reverse-walk (p1, p0).
  assert.equal(result.rollbackPartials[0]?.phase, "p2");
  assert.equal(result.rollbackPartials[0]?.msg, "p2 undo failed");
  assert.equal(result.rollbackPartials[1]?.phase, "p1");
  assert.equal(result.rollbackPartials[2]?.phase, "p0");
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| "Compensate only successfully-completed steps" (`executed.push` AFTER `await`) | "Started → eligible for compensation" -- failing step's own undo runs FIRST, then reverse walk over completed steps | Phase 37 (v1.7, TR-02) | The failing phase gets its compensation called, closing the orphan-leak path documented in `.planning/research/SUMMARY.md` Critical Pitfall 1. |
| Implicit `Phase<C>.undo` contract (assumes `do` completed) | Documented contract: `undo` MUST tolerate being called after a partial-do throw | Phase 37 (v1.7, TR-02) | New bridge authors see the discipline at declaration site, not buried in implementation lore. |

**Deprecated/outdated:** None -- the underlying ledger primitive, RollbackPartial
shape, and PathContainmentError discipline remain authoritative.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The V2 renderer in `shared/notify.ts` walks `rollbackPartials[]` top-down and presents the first entry as "most recent" | "Anti-Patterns" + "Pitfall 3" | If the renderer walks bottom-up, the suggested PREPEND order would invert the user-visible cascade. Mitigation: the AS-4/MSG-RP-1 contract in `phase-ledger.ts:16-21` says "ships RAW data; the user-visible body is assembled by the renderer ... as a `(failed) {rollback partial}` parent line followed by 2-space-indented per-phase children" -- the order in the array is the order in the body. The implementation should still spot-check the renderer behavior to confirm. |
| A2 | The phase-ledger fix is THE ONLY change needed in Phase 37 -- there is no orchestrator-side adaptation in `install.ts` | "Common Pitfalls" + "Validation Architecture" | If a future audit reveals an `install.ts` undo arm that assumes `do` completed before assigning a context field, that arm would need updating too. Verified READ of all four bridge consumer phases at `install.ts:481-600` confirms ALL gate on `if (c.<bridge>Prep === undefined) return;` -- but a deeper read of e.g. `c.stagedSkillNames` (set inside `do` BEFORE `commitPreparedSkills`) is needed to verify the gate is truly safe. |
| A3 | `RollbackPartial.cause` is the correct field to populate from `phase.undo`'s thrown Error (mirroring `rollbackExecuted`'s discipline at `phase-ledger.ts:96`) | "Code Examples" | If a different shape is required for the new call site (e.g. wrapping in a higher-level error), the post-fix code would need adjustment. Mitigation: matching the existing `rollbackExecuted` shape exactly is the conservative choice and preserves the depth-5 cause-chain walker in `shared/notify.ts`. |

**Confirmation required from planner:** A1 (renderer top-down ordering) should be
spot-checked by reading `shared/notify.ts` (look for the `rollbackPartial` mapping)
during planning, before locking the [failingPartial, ...reversePartials] order.
A2 (no orchestrator adaptation) should be re-verified by the planner with a
targeted read of `install.ts` lines 463-600 in context with the runtime
`stagedSkillNames` assignment ordering.

## Open Questions (RESOLVED)

1. **RESOLVED: Inline. The failing-phase undo invocation is implemented inline
   in the `runPhases` catch block, NOT extracted into a helper.**
   - What we know: The existing `rollbackExecuted` is a separate function. Adding
     a parallel `invokeFailingPhaseUndo` helper would mirror that style but is
     ~12 lines of code for one call site.
   - Adopted by PLAN.md Task 2 action ("DO NOT extract a helper function like
     `invokeFailingPhaseUndo`"). The catch block grows by ~12 lines; the file
     stays <160 lines; the structural invariant ("two call sites in the catch")
     is more obvious when both are visible at the call site.

2. **RESOLVED: Amend the existing `Phase<C>` interface JSDoc in place (lines
   26-29 of `phase-ledger.ts`), NOT a dedicated field-level JSDoc.**
   - What we know: The current JSDoc at lines 26-29 of `phase-ledger.ts` says
     "`do` runs forward; `undo` (optional) is invoked in reverse order if a
     later phase throws."
   - Adopted by PLAN.md Task 2 action ("amend the single interface-level JSDoc
     in place"). The existing sentence is extended to add: "is invoked in
     reverse order when a later phase throws AND also for the throwing phase
     itself (failing-phase own-undo runs first). MUST tolerate being called
     after a partial-do throw -- cannot assume `do` ran to completion." This
     preserves the single-JSDoc-per-interface style already used.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runtime + TypeScript strip | ✓ | >=20.19.0 (NFR-4) | -- |
| TypeScript | typecheck for `Phase<C>` strict-mode | ✓ | ^5.9.3 (project lockfile) | -- |
| `node:test` (built-in) | Regression test framework | ✓ | bundled | -- |
| `node:assert/strict` (built-in) | `assert.deepEqual`, `assert.equal`, `assert.rejects` | ✓ | bundled | -- |
| `pre-commit` | CLAUDE.md hook gate | ✓ (verified by `.pre-commit-config.yaml` presence) | -- | -- |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, since 20.x stable) |
| Config file | none -- `package.json` `"test"` script glob: `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` |
| Quick run command | `node --test tests/transaction/phase-ledger.test.ts` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test) |
| Phase gate | Full suite GREEN before `/gsd-verify-work` (per SC#5) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TR-02 (SC#1) | Failing phase's `undo` invoked exactly once from catch block BEFORE `rollbackExecuted`; `executed[]` does NOT contain failing phase | unit | `node --test tests/transaction/phase-ledger.test.ts` → test "TR-02 runPhases: failing-phase undo runs BEFORE reverse-walk, exactly once each" | ❌ (Wave 0: add to existing file) |
| TR-02 (SC#3) | `PathContainmentError` from failing phase's `undo` re-throws immediately | unit | same file → test "PI-14 runPhases: PathContainmentError from FAILING phase's own undo is RE-THROWN" | ❌ (Wave 0: add to existing file) |
| TR-02 (SC#4 ordering, AS-4 newest-first) | Failing-phase undo partial appears at index 0 of `rollbackPartials[]`, followed by reverse-walk partials | unit | same file → test "AS-4 runPhases: failing-phase undo failure is FIRST in rollbackPartials[]" | ❌ (Wave 0: add to existing file) |
| TR-02 (SC#2) | `Phase<C>.undo` JSDoc documents tolerate-after-partial-do contract | type/docs | `npm run typecheck` (the JSDoc is on the strict-mode interface; typecheck verifies non-breaking); manual review for docs content | ✓ (`phase-ledger.ts:26-34` exists; amend in place) |
| TR-02 (SC#5) | Existing install/uninstall/reinstall tests unchanged | regression | `npm run check` (full suite) -- full test count should be unchanged baseline (Plan 28-02 noted 1156 GREEN; v1.6 added more) PLUS the 3 new TR-02 tests | ✓ (existing `tests/orchestrators/plugin/{install,uninstall,reinstall}.test.ts`) |

### Sampling Rate

- **Per task commit:** `node --test tests/transaction/phase-ledger.test.ts` (~1-2 sec)
- **Per wave merge:** `node --test tests/transaction/**/*.test.ts tests/orchestrators/plugin/{install,uninstall,reinstall}.test.ts` (~10-30 sec)
- **Phase gate:** `npm run check` (full suite) -- green before `/gsd-verify-work`

### Wave 0 Gaps

The test file `tests/transaction/phase-ledger.test.ts` exists and is well-structured
(9 tests covering D-01 reverse-order, AS-4 aggregation, PI-14 re-throw, no-undo
skip, ctx threading, Error.cause preservation, non-Error defensive). The 3 new
tests above must be appended to it. No new test file required.

- [ ] `tests/transaction/phase-ledger.test.ts` -- append 3 new tests (TR-02
      sequence, PI-14 failing-phase-undo, AS-4 newest-first ordering); MUST NOT
      modify the 9 existing tests.
- [ ] No framework install needed.
- [ ] No shared fixtures needed -- existing `noopAsync`, `throwAsync`, `TraceCtx`
      helpers in the file are sufficient.

### Recommended exact test cases (input → expected sequence → assertion mechanism)

1. **TR-02 sequence (SC#1, SC#4):**
   - **Input:** 3-phase ledger `[p0, p1, p2]` with p2's `do` throwing. All three
     have `undo`. Each `do` and `undo` pushes a string to `ctx.trace`.
   - **Expected sequence:** `["do:p0", "do:p1", "do:p2", "undo:p2", "undo:p1", "undo:p0"]`
   - **Assertion:** `assert.deepEqual(ctx.trace, [...])` -- exact array equality.
   - **Negative assertion:** `assert.equal(result.rollbackPartials.length, 0)` (no
     undo throw, so no partials).

2. **PI-14 failing-phase undo re-throw (SC#3):**
   - **Input:** 2-phase ledger `[p1, p2]` where p1 has noop undo (irrelevant), p2
     throws "boom" in `do` AND throws `PathContainmentError` in `undo`.
   - **Expected:** `runPhases` REJECTS with a `PathContainmentError` (does NOT
     return `{ok:false, ...}`).
   - **Assertion:** `await assert.rejects(() => runPhases(phases, {}), (err) => err instanceof PathContainmentError)`.

3. **AS-4 newest-first ordering (SC#4 ordering):**
   - **Input:** 3-phase ledger `[p0, p1, p2]` where ALL THREE undo arms throw
     different errors ("p0 undo failed", "p1 undo failed", "p2 undo failed"); p2's
     `do` throws "boom".
   - **Expected:** `result.rollbackPartials.length === 3`, with
     `partials[0].phase === "p2"`, `partials[1].phase === "p1"`,
     `partials[2].phase === "p0"`.
   - **Assertion:** field-by-field `.phase` and `.msg` equality per row.

4. **Regression preservation (SC#5):**
   - **Input:** Run the full `npm run check` suite.
   - **Expected:** All existing tests in `phase-ledger.test.ts` (9 existing + 3
     new = 12 total) plus the full project suite GREEN.
   - **Assertion:** `npm run check` exits 0; existing test count + 3 new = total
     count baseline.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not applicable -- internal control-flow change. |
| V3 Session Management | no | Not applicable. |
| V4 Access Control | no | Not applicable. |
| V5 Input Validation | no | No new inputs introduced. |
| V6 Cryptography | no | Not applicable. |
| V10 Malicious Code | no | No new external code paths. |
| V12 File and Resources | yes (indirect) | `PathContainmentError` re-throw at the new call site (PI-14 discipline) is the load-bearing security control. |

### Known Threat Patterns for transaction-ledger fix

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal during undo cleanup (e.g., a malicious plugin's bridge undo writes outside the scope root) | Tampering | `PathContainmentError` is thrown by `assertPathInside` in `shared/path-safety.ts` and re-thrown by `runPhases` (existing line 84-86 + new failing-phase undo call site). The re-throw is LOUD and never folded into a rollback partial -- the operator gets the original verbatim error. |
| Double-rollback racing with concurrent state mutation | Tampering | Mitigated upstream by the `withStateGuard` outer wrapper (per `transaction/index.ts:7` D-02 composition pattern) -- the `runPhases` fix itself does not introduce new concurrency. |
| Undo throws masking the original `do` error | Tampering / Repudiation | The fix preserves the `original` error reference (line 127 of `phase-ledger.ts`) and surfaces undo failures via the structured `RollbackPartial[]` channel, not by overwriting the original. The V2 renderer presents both. |

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`
  (140 lines, READ in full) -- the exact fix site at lines 120-141, the
  PathContainmentError re-throw discipline at lines 84-86, the RollbackPartial
  shape and JSDoc at lines 36-55, and the existing `runPhases` JSDoc at
  lines 104-118.
- Project source: `tests/transaction/phase-ledger.test.ts` (308 lines, READ in
  full) -- 9 existing tests covering D-01, AS-4, PI-14, and the 260525-cjr C1
  Error.cause preservation tests. None will break under the fix because none
  exercise the failing-phase own-undo path (the failing phase in each test has
  no `undo` defined).
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  (lines 450-668, READ) -- the only direct production consumer of `runPhases`;
  verified ALL FOUR bridge consumer phases gate undo on
  `if (c.<bridge>Prep === undefined) return;` and `statePhase` defines no `undo`
  (intentional, comment at lines 651-654).
- Project source: `extensions/pi-claude-marketplace/shared/path-safety.ts:9-40`
  -- `PathContainmentError` and `SymlinkRefusedError` class definitions.
- Project source: `extensions/pi-claude-marketplace/shared/errors.ts` --
  `errorMessage(err)` and `appendLeakToError(err, leak)` exports.
- Project source: `extensions/pi-claude-marketplace/transaction/index.ts:1-17`
  and `transaction/rollback.ts` (lines 1-75) -- the public API contract for the
  transaction tier including `formatRollbackError`'s ES-4 / PI-14 discipline.
- Project source: `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
  (header comment around line 24-28) -- the D-02 composition pattern
  (`withStateGuard(loc, async (state) => { await runPhases(buildPhases(state), { ...ctx, state }); })`).
- `.planning/research/SUMMARY.md` (293 lines, READ in full) -- v1.7 milestone
  research synthesis; Phase 1/TR-02 rationale at lines 152-163, Critical Pitfall
  1 (double-rollback) at lines 112-117.
- `.planning/research/PITFALLS.md` (800 lines, READ in full) -- Pitfall 2
  (phase-ledger undo includes the failing phase, TR-02 over-correction) at
  lines 146-227 -- direct authority for the SEPARATE call sites discipline.
- `.planning/research/ARCHITECTURE.md` (269 lines, READ in full) -- Q1 minimal
  change to `phase-ledger.ts` at lines 107-130; flagged the over-correction
  (push-before-await) as the wrong solution.
- `.planning/research/FEATURES.md` (142 lines, READ in full) -- Category 2
  phase-ledger saga patterns at lines 48-69.
- `.planning/REQUIREMENTS.md` -- TR-02 definition at lines 19-23.
- `.planning/phases/37-phase-ledger-undo-gap/37-CONTEXT.md` (62 lines, READ in
  full) -- locked decisions and success criteria.
- `.planning/STATE.md` (221 lines) -- v1.7 milestone progress, phase 37 status.
- `.planning/ROADMAP.md` (Phase 37 details at lines 132-138) -- phase boundary
  and dependencies.
- `package.json` `scripts` section -- verified `npm run check` composition
  (`typecheck && lint && format:check && test`) and the `node:test` glob.

### Secondary (MEDIUM confidence -- ecosystem signal, not load-bearing)

- Microsoft Compensating Transaction Pattern (saga literature) -- "Started →
  eligible for compensation" invariant, cited transitively via
  `.planning/research/PITFALLS.md` Pitfall 2 sources at line 786.
- Temporal Saga Compensating Transactions -- confirms "failing step's own
  compensation runs first" is the standard discipline, cited transitively via
  `.planning/research/SUMMARY.md` Sources line 286.

### Tertiary (LOW confidence)

None -- all load-bearing claims sourced from project files read in full.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH -- verified against `package.json`, `.planning/research/STACK.md`
  (no new dependencies), and Node built-ins.
- Architecture: HIGH -- fix site, all undo gates, and consumer-side discipline
  verified by reading `phase-ledger.ts` (full file), `install.ts:450-668`,
  `path-safety.ts:1-60`, and the `transaction/index.ts` barrel.
- Pitfalls: HIGH -- direct authority from `.planning/research/PITFALLS.md` Pitfall 2
  (over-correction trap) and `.planning/research/SUMMARY.md` Critical Pitfall 1.

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days -- stable internal control-flow change in a
stable codebase; nothing external can drift)

## RESEARCH COMPLETE

The fix is a structural change to the catch block in `runPhases`
(`extensions/pi-claude-marketplace/transaction/phase-ledger.ts:120-141`): invoke
the failing phase's own `undo` as a SEPARATE call site BEFORE
`rollbackExecuted(executed, ctx)`, re-throwing `PathContainmentError` immediately
and capturing other errors into a `RollbackPartial` row prepended to the
reverse-walk partials so failing-phase rows sort first (AS-4 newest-first
ordering). Amend the `Phase<C>.undo` JSDoc at lines 26-34 to document that undo
MUST tolerate being called after a partial-do throw. Add three new regression
tests to `tests/transaction/phase-ledger.test.ts` (sequence assertion,
PathContainmentError re-throw, and rollbackPartials[0]=failing-phase ordering).
All four bridge consumer phases in `install.ts` already satisfy the new
contract via existing `if (c.<bridge>Prep === undefined) return;` gates -- no
orchestrator-side changes required, and SC#5 ("existing install/uninstall/reinstall
tests unchanged") is preserved because no existing phase-ledger test gives the
throwing phase an `undo`.
