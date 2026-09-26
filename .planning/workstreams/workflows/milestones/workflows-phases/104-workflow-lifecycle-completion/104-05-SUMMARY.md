---
phase: 104-workflow-lifecycle-completion
plan: 05
subsystem: orchestrators
tags: [workflows, reinstall, commit-in-place, compile-forced-call-sites]

# Dependency graph
requires:
  - phase: 104-workflow-lifecycle-completion
    provides: previousWorkflowNames as a live parameter and the WR-06 ownership refusal
  - phase: 104-workflow-lifecycle-completion
    provides: withHermeticWorkflowHome and the array-shaped workflows fixture option
  - phase: 103-workflow-artifact-materialization
    provides: prepareStageWorkflows / commitPreparedWorkflows / abortPreparedWorkflows
provides:
  - the workflows slot in reinstall's prepared-handle set (prepare, abort, warnings, commit)
  - a resourcesFromHandles with one fewer parameter, so both call sites were compile-forced
  - the commit-in-place decision recorded with its residual window named
affects: [104-06]

actuals:
  tokens: 6300
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Removing a parameter rather than branching on it turns "did I revisit every caller?" into a compiler question
    - A commit with no rollback target is placed last, so its residual window is the shortest the sequence allows

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "The workflows commit is IN PLACE and LAST, not a fifth `ReplacementEntry` arm. `commitPreparedWorkflows` cleans up its own staging on success, and that cleanup discards the previous envelopes it displaced aside, so after it returns there is no rollback target -- a ledger entry could offer only the appearance of one."
  - "`resourcesFromHandles` LOST its `previousWorkflows` parameter instead of gaining a branch. The compiler then named both call sites (TS2554 at the record update, TS2345 at the success outcome), which is the closure proof the plan asked for."
  - "The fourth mirror in this file is `BridgePhase`, the leak-label vocabulary for `pushLeak`. It had to be widened for the abort arm, and is explicitly NOT the replacement union -- an abort can report a workflows leak even though a workflows commit has no rollback entry."
  - "A staging-cleanup leak from an otherwise-successful workflows commit rides the existing `bridgeWarnings` channel in the `<phase>: <leak>` shape `finalizeReplacements` already uses, rather than being dropped."

patterns-established:
  - "The empty-inventory case is reached by installing a workflow-free plugin and adding a workflow to the source before the reinstall, not by hand-editing the record. Hand-editing would produce a record naming nothing while envelopes sit on disk, which is the WR-06 refusal case, not this one."
  - "The adjacency case is written knowing it passes before the fix: when the staged name equals the recorded one the two lists agree. It guards against a later duplicate or drop, not against the bug this plan fixed."

requirements-completed: [WLIF-04]

coverage:
  - id: D1
    description: "Reinstall re-materializes workflow envelopes from the plugin source instead of leaving the previous install's bytes on disk."
    requirement: "WLIF-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts — 'WLIF-04: a reinstall re-materializes the workflow envelope from the plugin source' (RED observed: the envelope still carried the v1 script body)"
        status: pass
    human_judgment: false
  - id: D2
    description: "After a reinstall the record names the NEWLY staged workflows, never the previous version's names carried forward."
    requirement: "WLIF-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts — 'WLIF-04: a reinstall after a renamed workflow records only the new name' (RED observed: recorded `hello:ship` where `hello:launch` was staged); asserts the new name on disk AND the old name absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "An old record whose `resources.workflows` is empty reinstalls as though fresh, and the resulting record names the newly staged workflows."
    requirement: "WLIF-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts — 'WLIF-04: a reinstall over an empty workflow inventory records the staged names' (RED observed: recorded `[]` where `hello:ship` was staged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A workflow whose regenerated name equals the recorded one is replaced in place and appears exactly once in the record."
    requirement: "WLIF-04"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts — 'WLIF-04: a reinstall of an unchanged workflow name records it exactly once' (deep-equals both the record and the saved-directory contents map)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A per-file soft-fail raised while staging workflows reaches the operator on the reinstall row."
    requirement: "WLIF-04"
    verification:
      - kind: other
        ref: "code inspection: `collectStagingWarnings` spreads `handles.workflows.result.warnings` after the mcp entry (reinstall.ts:1908); comment-stripped grep returns 1"
        status: pass
    human_judgment: false
  - id: D6
    description: "`resourcesFromHandles` no longer accepts a previous-workflows parameter, so both call sites were compile-forced."
    requirement: "WLIF-04"
    verification:
      - kind: other
        ref: "`npm run typecheck` failed with TS2554 at reinstall.ts:1789 and TS2345 at :1838 after the parameter was dropped, and passes after both call sites were fixed; `grep -c previousWorkflows` returns 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "The workflows commit is placed LAST in the replace sequence and the abort path unwinds workflows FIRST."
    requirement: "WLIF-04"
    verification:
      - kind: other
        ref: "code inspection: the commit sits after the mcp replace (reinstall.ts:1690), the abort arm is first in `abortPartialHandles` (:1917); the replacement union stayed at four arms, so `grep -c 'phase: \"workflows\"'` returns 0 and both exhaustive switches are untouched"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 05: Reinstall replaces workflow envelopes Summary

**Reinstall now re-materializes workflow envelopes from the plugin source and records the names it actually wrote, and the commit-in-place choice is documented as a decision with its residual window named rather than left to be read as an oversight.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Commits:** 4
- **Files modified:** 2 (0 created)

## Accomplishments

- **Six insertion points, none of them a ledger arm.** `reinstall.ts` composes its own handle set, so the work is `PreparedHandles.workflows` (required) and `PartialPreparedHandles.workflows` (optional), the prepare call after `mcp`, a warnings arm, an abort arm unwound first, and a commit slot at the tail of `replaceAll`.
- **The commit is in place and last.** `commitPreparedWorkflows` cleans up its own staging on success, and that cleanup is what discards the previous envelopes it displaced a statement earlier. After it returns, the bytes a rollback would restore are gone. A `ReplacementEntry` arm would have added a fifth case to two exhaustive switches to express a rollback that cannot happen. Placement bounds the consequence instead: nothing in the replace sequence follows the commit, so the residual window is the record composition, the config write-back and the state save -- all of which already route a throw through the manual-recovery path.
- **The parameter was removed, not defaulted.** `resourcesFromHandles` lost `previousWorkflows`, and `tsc` immediately named both call sites: TS2554 at the state-record update (four arguments), TS2345 at the success outcome (the array landing in the `plugin` slot). That is the closure proof; a defaulted parameter would have left both sites compiling and looking correct.
- **The old doc comment was deleted, not edited.** It justified the carry-forward on the premise that this path "re-materializes five kinds and leaves workflow envelopes untouched". That premise died with the commit slot, so the comment would have described the opposite of the code.
- **The warning aggregator was the asymmetry to fix.** Unlike `update.ts`, this path has a real `collectStagingWarnings`. Without the workflows arm a soft-fail reported on install would go silent on the repair run -- the one run where the operator is already looking for what went wrong.

## Task Commits

1. **Task 1 RED — the failing re-materialize proof** — `db09cd16` (test)
2. **Task 1 GREEN — the handle set, the abort, the warnings and the commit slot** — `84423fed` (feat)
3. **Task 2 RED — rename, empty inventory, adjacency** — `4eecc8fa` (test)
4. **Task 2 GREEN — the record names what this reinstall staged** — `2318757a` (feat)

## Files Created/Modified

- `orchestrators/plugin/reinstall.ts` — the workflows bridge import and type import; `PreparedHandles.workflows` / `PartialPreparedHandles.workflows`; a widened `BridgePhase`; a `ReplacementEntry` comment stating why there is no workflows arm; the prepare call reading `input.oldRecord.resources.workflows`; the workflows-first abort arm; the `collectStagingWarnings` arm; the commit-in-place slot with its mechanism/consequence/mitigation comment; a `commitLeaks` channel folded into `bridgeWarnings`; `resourcesFromHandles` with one fewer parameter and a replaced doc comment; both call sites.
- `tests/orchestrators/plugin/reinstall.test.ts` — the `withHermeticWorkflowHome` import and a `withWorkflowHome` composer; a `workflows` option on the fixture's `ResourceSet` and `writePluginTree`; `namedWorkflowScript`, `readSavedWorkflows`, `envelopeBytes`, `rewriteWorkflowScript` and `recordedWorkflows` helpers; four cases.

## Decisions Made

- **Commit in place, placed last.** Recorded in the slot's comment as mechanism (no rollback target after the staging cleanup), consequence (a later-step failure leaves the new envelopes with the old record until reinstall is re-run) and mitigation (placement). Reversing it later would need a second commit path in the stage module plus a fifth arm in three exhaustive switches.
- **The cleanup leak rides the existing channel.** `replaceAll` now returns `commitLeaks`, which the caller spreads into `bridgeWarnings` alongside `collectStagingWarnings` and `finalizeReplacements`. Dropping a non-undefined return would have made a failed staging cleanup invisible.
- **`clonePluginRecord` was left alone.** It snapshots the OLD record and is still correct; its `workflows` clone is the only remaining `record.resources.workflows` read in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The abort arm needed a fourth mirror widened: `BridgePhase`**

- **Found during:** Task 1, wiring the abort arm through the file's existing `pushLeak` helper
- **Issue:** `pushLeak(leaks, phase, leak)` types its `phase` argument as a file-local `BridgePhase = "skills" | "commands" | "agents" | "mcp"`. Routing the workflows leak through it -- which the plan requires, so the leak is not dropped -- does not compile until that union admits `"workflows"`. This is the same trap 104-04 hit with `UpdatePhaseBridge`, in a different file and with a different vocabulary.
- **Fix:** `BridgePhase` gains `"workflows"`, with a comment stating that it is the leak-LABEL vocabulary and explicitly not the replacement union, so a later reader does not conclude from it that a workflows rollback entry is missing.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
- **Commit:** `84423fed`

### Plan Statements Corrected

**2. [Acceptance-criterion wording] The `commitPreparedWorkflows` grep returns 2, not 1**

The criterion expects the comment-stripped grep over `reinstall.ts` to return `1`. It returns `2`: the named-import block contributes one occurrence on top of the single call site. The stated intent -- exactly one commit slot -- holds, confirmed by `grep -n`: the import at `:66` and the call at `:1690`. This is the same wording gap 104-02, 104-03 and 104-04 each recorded once.

**3. [Test-shape clarification] The empty-inventory case is reached by adding a workflow, not by emptying a record**

The plan asks for "an old record whose `resources.workflows` is empty". Hand-editing a populated record to `[]` while its envelopes stay on disk does not produce that case -- it produces the WR-06 refusal case, because the commit's displacement pass has no names to move aside and then finds the targets occupied by content this plugin cannot prove it owns. The case therefore installs a workflow-free plugin and adds a workflow script to the source before the reinstall, which is the shape where the record and the disk are both genuinely empty. The comment above the case says so.

**4. [Test-shape note] The adjacency case is green before the fix**

When the regenerated name equals the recorded one, the carried-forward list and the staged list are the same list, so the case passed on the RED run. That is inherent to the invariant it states (exactly once, replaced in place), not a defect. It is kept because a later duplicate or drop is exactly what it would catch, and its comment says it is written for that and not for a red run.

**5. [Residual-window wording] Three steps follow the workflows commit, not one**

The plan's truth statement says "the only step that can fail after it is the state save". Strictly, the record composition and the config write-back also follow it, inside the same try block. All three route a throw through the same manual-recovery path, so the mitigation the placement buys is unchanged; the slot's comment names all three rather than only the save, so the window is not understated to the next reader.

## Issues Encountered

None beyond the deviation above.

## Verification

- `npm run check` exits 0 — typecheck, ESLint, Prettier, the unit suite (3644 tests, 0 fail) and the integration suite (18/18). The single skip is the pre-existing non-Linux `reapOrphans` arm, unrelated to this plan.
- `node --test tests/orchestrators/plugin/reinstall.test.ts` — 89/89 (85 before this plan, plus four new cases).
- `node --test "tests/orchestrators/plugin/*.test.ts" "tests/bridges/workflows/*.test.ts"` — 823/823, 0 skipped.
- RED was observed before GREEN on both tasks: Task 1's case failed on the envelope still carrying the `v1` script body; Task 2's rename case failed with `hello:ship` where `hello:launch` was expected and its empty case with `[]` where `hello:ship` was expected, while both cases' disk assertions already passed — the exact split the two tasks divide.
- `grep -c 'previousWorkflows' reinstall.ts` → 0 (the parameter and its doc comment are gone, not renamed).
- `grep -rniE 're-materializes five kinds' extensions/ | wc -l` → 0 — the false doc comment is gone.
- Comment-stripped greps over `reinstall.ts`: `handles.workflows.result.warnings` → 1; `phase: "workflows"` → 0 (the replacement union stayed at four arms, both exhaustive switches untouched); `oldRecord.resources.workflows` → 1 (the prepare call's previous-name list); `record.resources.workflows` → 1 (`clonePluginRecord`).
- `npx eslint` on the changed source file and the test file — zero errors, including `sonarjs/cognitive-complexity`; no disable directive was added.
- No line added by this plan cites a GSD process artifact: `git diff 3a5b7c30..HEAD -- extensions tests | grep '^+' | grep -inE 'phase [0-9]|plan [0-9]|wave [0-9]|task [0-9]|milestone|pitfall [0-9]|pattern [0-9]'` returns nothing. The anchors used are `WLIF-04`, `WR-06` and `D-03`.
- `STATE.md` and `ROADMAP.md` were not staged or modified by this plan. (`STATE.md` carries an unrelated working-tree modification owned by the orchestrator, unchanged since before this plan started.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The five lifecycle verbs that materialize (install, update, reinstall, enable, disable) now all reach the workflows bridge. Any remaining consumer added later must widen the same four mirrors this file carries: `PreparedHandles`, `PartialPreparedHandles`, `BridgePhase`, and — only if it can actually be rolled back — `ReplacementEntry`.
- The accepted residual window (a failure between the workflows commit and the state save leaving new envelopes with an old record) is recorded in the slot's comment and in the plan's threat register as `T-104-05-05`. It is not a defect to be found later; it is the trade the placement bounds.

No blockers.

## Self-Check: PASSED

Both modified files verified present on disk. All four task commits verified in `git log`: `db09cd16`, `84423fed`, `4eecc8fa`, `2318757a`. `git status --short` shows only the pre-existing orchestrator-owned `STATE.md` modification. `npm run check` re-run green (exit 0) after the last code commit.

---
*Phase: 104-workflow-lifecycle-completion*
*Completed: 2026-08-15*
