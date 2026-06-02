---
title: Patterns Research -- v1.7 Transaction Resilience Hardening
project: pi-claude-marketplace
milestone: v1.7
researched: 2026-06-02
---

# Patterns Research: Transaction Resilience Hardening

**Domain:** Atomic-commit correctness, sequential rename loops with rollback, phase-ledger undo ordering, ghost-record prevention in cascaded teardown, orphan-tolerant reinstall recovery.

## Executive Summary

The 8 findings cluster around **three sub-patterns of the same root issue**: the codebase already adopts saga / two-phase-commit / phase-ledger vocabulary in name, but the implementations have load-bearing edge cases where the saga discipline is silently violated:

1. **Sequential-loop discipline broken** by `Promise.all` (F1, F5) -- parallel commits cannot bookkeep partial completion.
2. **Ledger undo scope is too narrow** (F2) -- `runPhases` excludes the failing phase from `executed[]`.
3. **Cascade aggregation drops disk truth on the floor** (F3, F4) -- classic 2PC ghost-record symptom.

**Established patterns map cleanly onto the existing architecture.** No new architecture required.

## Category 1 -- Sequential Commit Loops with Tracked Partial-Completion and Per-Step Rollback

**Applies to:** F1 (`commitPreparedAgents`), F5 (`commitPreparedCommands`)

### Table Stakes (must-have for correctness)

| Pattern | What it is | Why required |
|---|---|---|
| Replace `Promise.all(renames)` with `for...of` sequential loop | Iterate pair list with `await rename(from, to)` one at a time | `Promise.all`: if 1 of N rejects, the other N-1 still run AND there is no bookkeeping of which succeeded |
| Append-only completion ledger inside commit step | `const committed: Rename[] = []; for (const pair of pairs) { await rename(...); committed.push(pair); }` | Mirrors existing `executed: Phase<C>[]` discipline in `runPhases` (phase-ledger.ts:121) |
| Per-step rollback walks `committed` in reverse on throw | `for (const c of committed.slice().reverse()) { await rename(c.to, c.from); }` | Textbook saga compensation shape; already in `rollbackExecuted` (phase-ledger.ts:70-102) |
| Reverse-rename is the natural compensation | undo of `rename(staged, target)` is `rename(target, staged)` while staging dir exists | Same-FS guarantee holds; staging dir lives under `<scopeRoot>/pi-claude-marketplace/` |
| PathContainmentError bypass in per-step rollback | If reverse-rename throws PathContainmentError, re-throw immediately | PI-14: state corruption is LOUD. Identical discipline at both granularities. |

### Differentiators

| Option | Recommendation | Rationale |
|---|---|---|
| (a) Sequential loop + reverse compensation vs (b) p-limit concurrent + allSettled | **(a)** | Plugin dirs: 1-20 files. Concurrency win is invisible. allSettled bookkeeping duplicates what sequential gives for free. |
| Per-rename rollback inside bridge vs. at orchestrator via ledger undo | **Inside the bridge** | Bridge owns staging-dir invariant. Lifting rollback to ledger would force bridge to expose `committed[]`. Bridge becomes self-contained: succeed-or-self-rollback-or-throw-with-leaks. |
| Aggregate rollback failures into thrown error vs. return result object | **Throw ManualRecoveryError-style with `leaks[]`** | Matches existing `replacePreparedAgents` (stage.ts:454). Keeps phase-ledger contract intact. |

**Complexity:** ~25 LOC change in `commitPreparedAgents` step 2. Same shape for `commitPreparedCommands`.

**Consolidation opportunity:** F1, F5, F6, and the existing `replacePreparedAgents` rollback all implement the same sequential-rename-loop-with-reverse shape. Consider extracting a `commitRenamesSequentially(pairs, opts)` helper in `shared/fs-utils.ts`.

## Category 2 -- Phase-Ledger Saga: Failing Phase Own Undo Must Run

**Applies to:** F2 (`runPhases` in `transaction/phase-ledger.ts:120-141`)

### Table Stakes

| Pattern | What it is | Why required |
|---|---|---|
| "Started → eligible for compensation" invariant | Every step whose forward action began must be a compensation candidate | Saga literature unanimous (Microsoft Compensating Transaction Pattern, Temporal). "Compensate only completed steps" is a misreading. |
| Push-before-await | `executed.push(phase); await phase.do(ctx);` -- push first, accept undo called even for phases that threw on entry | Makes the failing phase eligible for undo with one line change |
| Idempotent undo precondition | Failing phase undo MUST be safe to call when do partially completed or never started | Already the codebase invariant via ENOENT tolerance and ownership guards |

### Differentiators

| Option | Recommendation | Rationale |
|---|---|---|
| Push-before-await vs. try/finally push vs. separate `attempted[]` array | **Push-before-await** | Matches saga literature default. Single array. No new construct. |
| Track per-phase "do completed" flag | **Defer** | Enhancement for richer rollback reporting. Not required for correctness. |

**Complexity:** One-line code change + JSDoc update + ~1 regression test.

**Audit requirement:** Every literal-array `PHASES` call site must be audited to confirm each `Phase.undo` handles "do never ran / partially ran" gracefully (ENOENT tolerance and ownership guards confirm this for all existing bridges).

## Category 3 -- Ghost-Record Prevention in Cascaded Teardown

**Applies to:** F3 (`cascadeUnstagePlugin`), F4 (`update.ts swapStateRecord` ordering)

### Table Stakes

| Pattern | What it is | Why required |
|---|---|---|
| "Disk is the ledger; state.json is the index" ordering | state.json MUST reflect disk reality. Physical-commit-first, state-write-last. | Classic 2PC discipline. F4 is the textbook violation. |
| All-or-nothing state mutation per plugin | Either all bridges committed + record removed, OR record remains pointing at what is still on disk | F3: cascade removes skills/commands, fails on agents, but orchestrator removes the whole record. Ghost record. |
| "State reflects disk" invariant bridge-by-bridge | When cascade fails at bridge K, surviving record describes ONLY what bridges K+1..N still hold | Strip-not-restore: bridges that succeeded intentionally removed files; record just needs to say "skills gone, commands still here". |

### Differentiators

| Option | Recommendation | Rationale |
|---|---|---|
| Cascade self-heals by shrinking state record | **Recommended** | Restore is impossible without backup. Re-phase-ledger is overkill. Strip-on-fail is idempotent and preserves retry. |
| State record cleanse on F3 failure vs. leave record + rely on retry | **Cleanse** | Makes failure visible in `list`; allows targeted manual recovery. |
| F4: state write AFTER physical commits vs. keep state-first + intent-mark | **Two-guard intent-mark + finalize** | Preserves D-03 continue-on-failure semantics while eliminating the divergence window. |

**F3 complexity:** Orchestrator-side only. `cascadeUnstagePlugin` already populates `dropped.*` as-it-goes (shared.ts:290-302). ~30-50 LOC across 2-3 call sites.
**F4 complexity:** Split `swapStateRecord` into `markUpdateInProgress` + `finalizeUpdateRecord` bracketing phase 3a. Largest change in milestone.

## Category 4 -- TOCTOU-Safe Orphan Target Cleanup Before Rename

**Applies to:** F6 (`replacePreparedSkills`, `replacePreparedCommands`, `replacePreparedAgents`)

### Table Stakes

| Pattern | What it is | Why required |
|---|---|---|
| Owner-marker re-check + rm + rename | When target exists, verify it is an owned orphan then rm it then rename | Preserves AG-5 foreign-content protection while unblocking reinstall recovery |
| Only check when target exists | stat check only when `pathExists(pair.to)`; otherwise proceed straight to atomic rename | Same performance; semantically a superset of current code |

### Differentiators

| Option | Recommendation | Rationale |
|---|---|---|
| Let POSIX rename overwrite vs. owner-marker recheck + rm vs. renameNoReplace fallback | **Owner-marker recheck + rm + rename** | POSIX-overwrite loses AG-5. renameNoReplace is Linux-only. |

**Complexity:** Replace `if (await pathExists(pair.to)) throw ...` with owner-marker recheck + rm. ~6 LOC per bridge, 3 bridges. Extract `removeOrphanIfPresent` to `shared/fs-utils.ts`.

## Sub-Patterns for F7 and F8 (LOW)

### F7 -- Agents step-1 parallel rm is self-healing
- Idempotent cleanup with ENOENT swallow is the canonical safe parallel destructive operation.
- **Action:** 1 regression test + inline doc comment.

### F8 -- D-19-01 intentional post-state-commit cache-drop swallow
- Post-commit best-effort cleanup is saga discipline.
- **Action:** Inline ADR comment referencing D-19-01 + 1 regression test.

## Suggested Phase Ordering

**Critical path:** F2 → F1/F5/F6 (parallel) → F3 → F4 → F7/F8

1. F2 (phase-ledger undo gap) -- FIRST. Foundational. Lowest LOC, most impact.
2. F1 + F5 (sequential commit loops) -- Together; same pattern, two bridges; extract shared helper.
3. F6 (orphan unblock) -- Consider folding into F1/F5 phase.
4. F3 (cascade ghost record) -- After bridge-level fixes are stable.
5. F4 (state-before-commit) -- After F1/F5 bridge rollback available; structural change.
6. F7 + F8 (LOW) -- Final phase; docs + tests only.

## Sources

- Microsoft Azure Compensating Transaction Pattern
- Temporal Saga Compensating Transactions
- Two-Phase Commit Protocol (Wikipedia)
- CWE-367: TOCTOU
- Node.js PR #61664 -- TOCTOU fix
- Microservices.io Saga Pattern
