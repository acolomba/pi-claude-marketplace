# Phase 38: Sequential Commit Loops + Orphan Tolerance - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

The agents and commands bridge commit paths are atomic at rename granularity: a partial
failure rolls back completed renames instead of leaving orphans. The `replacePrepared*`
helpers unblock reinstall after a prior partial install by pre-removing owned orphan
targets, while preserving the PI-6 foreign-content guard.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- discuss phase was skipped
per user setting. Use ROADMAP phase goal, success criteria, RESEARCH.md, and the
v1.7 research synthesis under `.planning/research/` to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research. Confirmed touched paths
include the agents and commands bridges' `commitPrepared*` helpers, `shared/fs-utils.ts`
(new `removeOrphanIfPresent`), and the three `replacePrepared*` paths
(skills/agents/commands). The PUP-6 phase-3 failure test in `tests/transaction/update.test.ts`
is a known invariant to preserve.

</code_context>

<specifics>
## Specific Ideas

Requirements: TR-01 (bridge commit atomicity), TR-05 (orphan-pre-removal helper), TR-06
(replacePrepared callers adopt the helper).

Success Criteria (must be TRUE):

1. `commitPreparedAgents` iterates `_stagedFilePaths` sequentially; on a rename throw,
   it reverse-walks completed renames (`[...completedRenames].reverse()`) to restore
   them to staging; rollback failures accumulate into `leaks[]` surfaced via
   `appendLeakToError`; rollback loop never throws.
2. `commitPreparedCommands` adds the same `completedRenames[]` tracking to its existing
   sequential loop; reverse-walk shape is identical to agents.
3. `shared/fs-utils.ts` exports `removeOrphanIfPresent(target, mode: "file" | "tree")`
   that pre-removes a target only when state.json confirms it is an owned artifact from
   a prior partial install; ENOENT is silently swallowed; mismatched kind (file where
   tree expected) leaves the target alone so rename fails loudly.
4. `replacePreparedSkills`, `replacePreparedAgents`, and `replacePreparedCommands`
   call `removeOrphanIfPresent` instead of `if (pathExists(pair.to)) throw`; the PI-6
   `stage.test.ts:388` non-previous-content rejection test remains RED for foreign
   artifacts not in state.json.
5. PUP-6 phase-3 failure test (`update.test.ts:744`) still triggers its failure path
   (file obstacle at `hello-tool` not in state.json's skills list, so orphan guard
   leaves it alone); alternatively, a synthetic bridge-throw variant preserves the
   phase-3a aggregation contract if the file test is retired.
6. `npm run check` GREEN; no regression from Phase 37 baseline.

</specifics>

<deferred>
## Deferred Ideas

None -- discuss phase skipped.

</deferred>
