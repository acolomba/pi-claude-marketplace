---
title: Technology Stack -- v1.7 Transaction Resilience Hardening
project: pi-claude-marketplace
milestone: v1.7
researched: 2026-06-02
mode: ecosystem
overall_confidence: HIGH
verdict: NO NEW DEPENDENCIES -- hand-roll fixes against the existing stack
---

# Technology Stack -- v1.7 Transaction Resilience Hardening

## Executive Verdict

**Add nothing. Hand-roll all 8 fixes against the existing stack.**

The 8 findings are structural defects in already-hand-rolled, project-specific code
(`transaction/phase-ledger.ts`, `bridges/agents`, `bridges/commands`, `orchestrators/plugin/update.ts`,
`transaction/cascadeUnstage`). They are sequencing and ordering bugs -- not missing
infrastructure. Every npm option in this space is either (a) the wrong shape (generic
saga libraries for distributed systems), (b) already provided by `node:fs/promises` +
`write-file-atomic@^8`, or (c) bigger than the bug surface. Introducing a new dep
during a bug-fix milestone trades a small surgical change for a refactor that disturbs
the very lock-held, atomic-rename, two-phase-commit invariants the project has
already validated across 1312 tests and six prior milestones.

The only stack-adjacent guidance worth lifting into planning is *pattern-level*:
sequential-await-with-per-step-undo for the bridge commit loops (F1, F5), undo-before-pop
ordering for `runPhases` (F2), full-cascade-or-no-state for `cascadeUnstage` (F3),
state-after-physical-commit for `update.ts` (F4), and orphan-recovery-on-rename for
`replacePrepared*` (F6).

## Summary Table

| Concern                          | Recommendation                                                                                       | Confidence |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- |
| Sequential commit loop w/ undo   | Hand-roll: `for…of` + try/catch + reverse-order rollback over executed steps                         | HIGH       |
| Phase-ledger undo on self-throw  | Hand-roll: push to `executed` BEFORE `phase.do`, treat self-throw as `executed` for rollback         | HIGH       |
| Atomic file ops (JSON state)     | Keep `write-file-atomic@^8.0.0` (no change)                                                          | HIGH       |
| Atomic file ops (staging trees)  | Keep `node:fs/promises` rename (no change)                                                           | HIGH       |
| Saga / two-phase-commit library  | NOT recommended (`node-sagas`, `@nestjs/cqrs`, `redux-saga`, Temporal -- wrong domain)                | HIGH       |
| Transactional FS library         | NOT recommended (`fs-extra`, `graceful-fs`, `transactional-fs` -- wrong shape or unmaintained)        | HIGH       |
| Result-type for rollback paths   | Optional, NOT recommended for v1.7 (`neverthrow@^8.2.0`) -- disturbs too much code for a bug fix      | MEDIUM     |
| Concurrent ops serialization     | Keep `proper-lockfile@^4.1.2` + existing `withStateGuard` (no change)                                | HIGH       |

## Existing Stack (validated, carry forward unchanged)

| Package                            | Version     | Role in v1.7 fixes                                                                              |
| ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `node` runtime                     | `>=20.19.0` | Engine floor (NFR-4). `for await`, `Promise.allSettled`, `fs.rm({force:true})` all available    |
| `typescript`                       | `^6.0.3`    | Strict mode. Discriminated unions for phase return types (NFR-7)                                |
| `write-file-atomic`                | `^8.0.0`    | F4 state write happens through this; F3 ghost-record fix re-uses the same write path           |
| `node:fs/promises` (built-in)      | bundled     | F1, F5, F6 rename loops; F3 cascade unstage; F7 self-healing rm                                 |
| `proper-lockfile`                  | `^4.1.2`    | Cross-process scope lock (the `.state-lock` per D-25). F2/F3/F4 fixes run INSIDE this lock     |
| `typebox`                          | `^1.1.38`   | F4 may extend `state.json` schema if a tx-id is added; NOT required for v1.7                    |
| `@earendil-works/pi-coding-agent`  | `>=0.74.0`  | `ctx.ui.notify` for partial-rollback warnings (RollbackPartial -- IL-2/IL-3)                     |
| `node:test` (built-in)             | bundled     | Test framework for F7 / F8 documentation tests and new regression tests for F1-F6              |
| `memfs`                            | `^4.57.2`   | In-memory FS for new rollback-path unit tests (already in dev deps; no upgrade needed)          |

## Why No New Dependencies

### Saga / two-phase-commit libraries

Surveyed (HIGH confidence -- none recommended):

| Library                                   | Latest       | Why not                                                                                                                                                                  |
| ----------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node-sagas`                              | unmaintained | Last publish 2020; designed for distributed microservice compensation, not local FS commits                                                                              |
| `@nestjs/cqrs` sagas                      | `^11.x`      | NestJS-coupled; pulls RxJS + decorator metadata; massive surface for what is a ~50-line fix                                                                              |
| `redux-saga`                              | `^1.3.x`     | Generator-driven side-effects model; wrong abstraction for sequential FS commits                                                                                         |
| `@temporalio/*` workflows                 | current      | Requires a Temporal server; absurd for a CLI extension                                                                                                                   |
| Custom "Saga" classes (swissknife-style)  | n/a          | Same shape as the existing `Phase<C>` / `runPhases` in `transaction/phase-ledger.ts` -- adopting a library means rewriting a contract that already works for 12+ phases   |

**Verdict:** the project already HAS a phase-ledger. The bug is `runPhases` push-order
(F2) and bridge loops not USING the ledger pattern at rename granularity (F1, F5). Fix
the bug at the call-site, do not swap in a third-party orchestrator.

### Transactional file-system libraries

Surveyed (HIGH confidence -- none recommended):

| Library                | Status                       | Why not                                                                                                                                |
| ---------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `fs-extra`             | `^11.x` actively maintained  | The atomic-write surface (`outputJson`, `move`) is weaker than `write-file-atomic@^8`'s fsync queue; recursive copy already in Node 16+ |
| `graceful-fs`          | `^4.x`                       | Adds EMFILE retry around file ops -- not the bug class here                                                                             |
| `transactional-fs`     | unmaintained                 | Tiny userbase; last release 2017; relies on a "transaction log" concept incompatible with the same-FS-rename invariant                 |
| `npm/fs-minipass`      | `^3.x`                       | Stream-oriented atomic writes; orthogonal to the rename-loop class of bugs                                                             |
| `@npmcli/fs`           | `^4.x`                       | Adds `cp` polyfills for older Node; redundant on Node 20.19+                                                                           |

**Verdict:** F1/F5/F6 are *control-flow* fixes (sequential vs parallel, rollback on
throw, orphan-tolerance on target) -- not file-primitive fixes. Wrapping the rename in
a different library does not change loop semantics.

### Result-type libraries (`neverthrow`, `effect`, `ts-results`)

Surveyed (MEDIUM confidence -- optional, NOT recommended for v1.7):

`neverthrow@^8.2.0` is the cleanest of the cohort, but adopting it would:

- Force every `Phase.do` / `Phase.undo` signature to migrate from
  `Promise<void> + throws` to `ResultAsync<void, E>` -- a project-wide refactor.
- Disturb the 1312/1312 GREEN test surface, which depends on throw-based error
  propagation through `runPhases` and `cascadeUnstagePlugin`.
- Provide nothing the existing `RollbackPartial` discriminated union does not already provide.

If a result type is wanted for clearer rollback-path data flow, defer to a future
refactor milestone with its own scope -- not bug fixes mixed into v1.7.

### Concurrent-operation primitives (`p-queue`, `p-limit`, `p-map`)

Surveyed (HIGH confidence -- none recommended):

The fixes go the OPPOSITE direction: F1 and F5 move FROM `Promise.all` (parallel) TO
sequential. Adding a concurrency-limiter is precisely the wrong tool. `p-queue@^9.3.0`
is excellent for rate-limited HTTP work; it is the wrong shape for "do these renames
in order, undo on throw, stop the loop."

## What to Hand-Roll (patterns, not libraries)

These are *patterns* the planner can encode directly in TypeScript; no new dep needed.

### Pattern A -- Sequential commit loop with per-step rollback (F1 agents, F5 commands)

```ts
// pseudocode -- adapt to bridges/agents/commit.ts and bridges/commands/commit.ts
async function commitPreparedAgents(prepared: Prepared[]): Promise<void> {
  const committed: Prepared[] = [];
  try {
    for (const p of prepared) {
      await fs.rename(p.staged, p.target); // ONE rename at a time
      committed.push(p);                    // record AFTER success
    }
  } catch (err) {
    // reverse-order undo of what already moved
    for (const c of committed.reverse()) {
      await fs.rename(c.target, c.staged).catch(() => { /* swallow -- best effort */ });
    }
    throw err; // re-raise to the phase-ledger
  }
}
```

Why hand-roll: this is ~20 lines and replicates the `Phase<C>` invariant `runPhases`
already provides -- but at rename granularity, which the bridge needs and the
phase-ledger does not provide today.

### Pattern B -- Phase-ledger undo-on-self-throw (F2)

```ts
// transaction/phase-ledger.ts
for (const phase of phases) {
  executed.push(phase);            // push BEFORE do (F2 fix)
  try {
    await phase.do(ctx);
  } catch (err) {
    // the failing phase itself now gets its undo called by rollbackExecuted
    await rollbackExecuted(executed.reverse(), ctx, err);
    throw err;
  }
}
```

The current code pushes AFTER `phase.do` resolves, so a partially-applied phase that
throws never gets its own undo called. The fix is a one-line re-order. Stays inside
the existing `rollbackExecuted` contract.

### Pattern C -- Full-cascade-or-no-state for `cascadeUnstagePlugin` (F3)

```ts
async function cascadeUnstagePlugin(plugin, scope, ctx): Promise<void> {
  // Step 1: tear down ALL bridges first, collect partials via allSettled
  const results = await Promise.allSettled([
    unstageSkills(plugin, scope),
    unstageCommands(plugin, scope),
    unstageAgents(plugin, scope),
    unstageMcp(plugin, scope),
  ]);
  // Step 2: ONLY if every bridge succeeded, drop the state record.
  //         If any failed, leave state intact + surface a RollbackPartial.
  const failed = results.filter(r => r.status === "rejected");
  if (failed.length > 0) {
    throw new RollbackPartialError("cascade-unstage", failed);
  }
  await dropStateRecord(plugin, scope); // last
}
```

State-record removal is the *commit point* for uninstall -- placing it last mirrors
how install does it (state-record written last, after physical commits).

### Pattern D -- State-after-physical-commit for `update.ts` (F4)

Move `swapStateRecord` from before the agents/commands/skills/mcp commits to after
*all* of them resolve. On any commit failure, the old state record stays -- exactly the
recoverable state the user can re-run `update` against. No new schema, no tx-id.

### Pattern E -- Orphan-tolerant rename target (F6 `replacePrepared*`)

```ts
async function replacePreparedAgent(staged: string, target: string): Promise<void> {
  // If an orphan exists at target (left over from an earlier crashed install), rm it
  // before rename. The orphan is by definition not in state.json (else state would
  // claim it and reinstall would be blocked at the orchestrator gate), so removing it
  // restores a recoverable state. No state mutation needed; the rename is the commit.
  await fs.rm(target, { force: true });
  await fs.rename(staged, target);
}
```

### Pattern F (LOW priority -- docs only) -- F7 / F8

F7 (agents step-1 parallel rm) and F8 (D-19-01 cache-drop swallow) are correctness-OK
today; they need a short block comment explaining *why* the parallel rm is
self-healing (idempotent on `force: true`) and *why* the cache-drop catch is intentional
(probe-buffer drain explicitly retired in D-21-01), plus one regression test each
asserting the contract. No code change, no library.

## Versions Verified (2026-06-02)

| Package                 | Latest published | In use     | Action     |
| ----------------------- | ---------------- | ---------- | ---------- |
| `write-file-atomic`     | 8.0.0            | `^8.0.0`   | None       |
| `proper-lockfile`       | 4.1.2            | `^4.1.2`   | None       |
| `typebox`               | 1.1.38           | `^1.1.38`  | None       |
| `typescript`            | (project pinned) | `^6.0.3`   | None       |
| `neverthrow` (rejected) | 8.2.0            | --          | Do not add |
| `p-queue` (rejected)    | 9.3.0            | --          | Do not add |
| `p-retry` (rejected)    | 8.0.0            | --          | Do not add |

Verified via `npm view <pkg> version time.modified` on 2026-06-02.

## What NOT to Add

| Avoid                                        | Reason                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Any saga/orchestration library               | The existing `runPhases` is the saga -- bug is in its ordering, not its existence                                |
| `fs-extra`, `transactional-fs`, `graceful-fs` | Wrong shape; the bugs are loop-control, not file-primitive issues                                                |
| `neverthrow` / `effect` / `ts-results`       | Forces a milestone-wide signature refactor that disturbs the GREEN test surface                                 |
| `p-queue`, `p-limit`, `p-map`                | The fixes go from parallel TO sequential -- concurrency primitives are the wrong direction                       |
| A new "transaction id" persistence column    | Out of scope; F4 fix is ordering, not auditing. If WAL-style audit is wanted, defer to v1.8 backlog              |
| `tsx` for tests                              | Node 20.19+ with `--test` already strips TS in this project's CI; carry-forward decision from prior milestones  |

## Integration Points With Existing Stack

| v1.7 Finding | Integrates with                                                       | Existing Tests to Re-run                                |
| ------------ | --------------------------------------------------------------------- | ------------------------------------------------------- |
| F1 agents    | `bridges/agents/commit.ts` + `transaction/phase-ledger.ts` (via Phase) | `tests/bridges/agents/*.test.ts`, `tests/transaction/*` |
| F2 ledger    | `transaction/phase-ledger.ts::runPhases`                              | `tests/transaction/phase-ledger.test.ts` (entire file)  |
| F3 cascade   | `transaction/cascade-unstage.ts` (or current name)                    | `tests/transaction/cascade-unstage*.test.ts`            |
| F4 update    | `orchestrators/plugin/update.ts` + `persistence/state.ts`             | `tests/orchestrators/plugin/update.test.ts`             |
| F5 commands  | `bridges/commands/commit.ts`                                          | `tests/bridges/commands/*.test.ts`                      |
| F6 orphan    | `bridges/*/replacePrepared*` family                                   | `tests/bridges/*/replace-prepared*.test.ts`             |
| F7 docs      | `bridges/agents/uninstall.ts` (step-1 parallel rm)                    | New: 1 regression test                                  |
| F8 docs      | `orchestrators/plugin/list.ts::narrowResolverNotes` D-19-01 catch     | New: 1 regression test                                  |

All eight findings stay inside `extensions/pi-claude-marketplace/`. None requires a
peer-dep bump, a new runtime dep, or a new dev-dep.

## Sources

### Authoritative (HIGH confidence)

- npm registry, queried 2026-06-02 via `npm view`:
  - `write-file-atomic@8.0.0` (published 2026-05-08, engines `^22.22.2 || ^24.15.0 || >=26.0.0`)
  - `proper-lockfile@4.1.2`
  - `p-queue@9.3.0`, `p-retry@8.0.0`, `neverthrow@8.2.0`
- Project source: `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` --
  confirmed `Phase<C>`, `RollbackPartial`, `runPhases`, `rollbackExecuted` exports;
  identified the F2 push-order site at the `executed.push(phase)` call.
- Project source: `package.json` -- confirmed current dep set (no orchestration libraries
  in use; `write-file-atomic@^8.0.0` and `proper-lockfile@^4.1.2` already adopted).
- Node.js official docs -- [nodejs.org/api/fs.html#promises-api](https://nodejs.org/api/fs.html#promises-api) --
  confirmed `fs.rename`, `fs.rm({force:true})` semantics (idempotent on missing target);
  `Promise.allSettled` semantics for the F3 cascade pattern.

### Cross-referencing (MEDIUM confidence -- context only, not load-bearing)

- npm `node-sagas` (last publish 2020) -- confirms the ecosystem has not produced a
  competitive local-FS saga library since.
- `neverthrow` README -- confirms migration shape; supports the verdict that adoption
  is a milestone-wide change, not a bug-fix change.
