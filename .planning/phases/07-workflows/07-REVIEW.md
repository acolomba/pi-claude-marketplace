---
phase: 07-workflows
reviewed: 2026-11-01T20:30:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - docs/workflows-compatibility.md
  - features/lib/workflow-files.ts
  - features/step_definitions/workflow/companion-missing.steps.ts
  - features/step_definitions/workflow/listing.steps.ts
  - features/step_definitions/workflow/refusals.steps.ts
  - features/step_definitions/workflow/runs.steps.ts
  - features/workflow/companion-missing.feature
  - features/workflow/lifecycle.feature
  - features/workflow/listing.feature
  - features/workflow/refusals.feature
  - features/workflow/run.feature
findings:
  critical: 0
  warning: 0
  info: 9
  total: 9
status: clean
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 11
**Status:** clean

## Summary

This is the third and final `--auto` pass. I re-read the 11 files at HEAD (`e8862af`) and the iteration-2 fix commits `6382ae4`, `cd65b30`, and `baf0cbd`. I checked the doc's new engine claim against `@quintinshaw/pi-dynamic-workflows` 3.15.0 in the optional peer cache (`src/task-panel.ts`: `warnDelivery` at lines 208-217, `bindSessionDelivery` at lines 1064-1132). I also ran both gates:

- `node scripts/check-features.mjs` exited 0.
- `npx cucumber-js features/workflow` passed 37 scenarios and 457 steps (seed 422528).

How each finding of the previous pass stands:

| Previous | Status | Evidence |
| --- | --- | --- |
| WR-01 | Fixed | `docs/workflows-compatibility.md:214` now says the first run in a session shows the warning, and that a later run in the same session shows only the start notice. The once-per-session part is graded source-read. The source matches: `warnDelivery` returns when `endpoint.warned` is set and sets it on the first warning (`task-panel.ts:210-211`). `bindSessionDelivery` builds a new endpoint without the flag (`task-panel.ts:1116-1125`). Two small precision gaps remain (IN-09). |
| WR-02 | Fixed | The step texts are now `the workflow install diagnostic reports these lines:` (`refusals.steps.ts:67-79`) and `pi offers no slash command for the workflow {string}` (`listing.steps.ts:114-127`). Both name the workflow kind. All four uses changed (`refusals.feature:60,88,123`, `companion-missing.feature:72`). No old text is left in `features/`, `docs/`, or `.agents/`. The bodies are unchanged. |
| IN-05 | Fixed | The two run `Then` steps no longer call `markTurnCompared()` (`runs.steps.ts:86-102`). Only `the workflow engine shows these notices:` marks a run turn compared (`listing.steps.ts:153`). All six run executions end with the notices step. The fix leaves the opposite gap open, and the skill's text does not match it (IN-10). |
| IN-01..IN-04, IN-06..IN-08 | Open | Out of fix scope. Carried forward unchanged. IN-04 and IN-06 now cite the correct line numbers. |

The fixes introduced no defect that a plausible wrong implementation could pass. No Critical or Warning finding remains. Two new Info items record a small imprecision in the doc sentence and a gap the marker change leaves open.

## Info

### IN-01: The release's stated reason does not hold, and the restore runs before the profile Pi stops (carried forward)

**File:** `features/step_definitions/workflow/companion-missing.steps.ts:35-55`
**Issue:** The comment says the restore stops "a stale entry [from loading] the engine into the shared Pi at its next new session". But `Before()` in `features/support/pi-process.ts` empties the sandbox, `agentDir` included, before the next scenario. So the restore is defense in depth. It is also registered after the profile Pi's release, so it runs while the engine-loaded Pi is still alive.
**Fix:** Describe the release as defense in depth. Optionally register it so that it runs after `pi.stop()`.

### IN-02: `DIALOG_METHODS` is defined three times (carried forward; parent line)

**File:** `features/lib/workflow-files.ts:49`, `features/lib/pi-process.ts:68`, `features/step_definitions/session.steps.ts:42`
**Issue:** The same four-method set appears in three modules. Two of them are frozen.
**Fix:** Parent line: export it once from `features/lib/pi-process.ts`, and import it in `session.steps.ts` and `workflow-files.ts`.

### IN-03: The doc quotes engine notices with `--` where the engine prints U+2014 (carried forward)

**File:** `docs/workflows-compatibility.md:75,191`
**Issue:** The stale-command notice at line 191 is quoted as the engine's own text, but the engine prints `—`. The commit hook forces `--`, and the notices step maps one way only (`listing.steps.ts:148`).
**Fix:** Add one sentence saying that quoted engine messages show U+2014 as `--`.

### IN-04: `description ?? ""` merges a missing description with an empty one (carried forward)

**File:** `features/step_definitions/workflow/listing.steps.ts:47`
**Issue:** A command with no description compares equal to one with an empty description. The engine always supplies `Saved workflow: <name>`, so nothing depends on this today. (The previous pass cited line 148. The projection is at line 47.)
**Fix:** Project `undefined` to a distinct marker such as `(none)`, or assert that it is a string.

### IN-06: `{run id}` and `{session id}` are tokens the skill does not list, and the notices `Then` queries Pi (carried forward; parent line)

**File:** `features/step_definitions/workflow/listing.steps.ts:58-77,135-155`
**Issue:**

- `features.md` "Run tokens" lists every brace token, but the notices step adds `{run id}` and `{session id}` locally, outside `features/lib/run-tokens.ts`.
- The step reads the session id with a `get_state` RPC request in the `Then`, not from what the `When` left on the world. The request is read-only and the step is correct.

Both deviations are forced, because the world, `run-tokens.ts`, and the skill are frozen.
**Fix:** Parent lines:

- List `{run id}` (the run a workflow command started, as its progress entries name it) and `{session id}` (Pi's current session id) in `.agents/skills/cucumber/rules/features.md`.
- Have the world keep the session id of a recorded turn, so the step reads it from the turn.

### IN-07: Two row variants in the admit-versus-run table are graded scenario-measured but not driven (carried forward)

**File:** `docs/workflows-compatibility.md:63,65,75`
**Issue:** Line 75 grades "the first six rows" as scenario-measured. Two of those rows name two shapes each, and the Outline drives only one of each:

- `export let` is driven, `export var` is not.
- A missing `description` is driven, an empty one is not.

The engine and bridge predicates are the same for both variants (`domain/workflow-script.ts:778,979`), so the risk is low.
**Fix:** Add `export var meta` and `description:""` rows to the refusal Outline, or name the driven variant in the grade.

### IN-08: The results table still joins diagnostic lines ambiguously (carried forward; parent line)

**File:** `features/workflow/refusals.feature:57-63,85-91,120-127` (projection in frozen `features/lib/field-rows.ts`)
**Issue:** The `lines` column of `the command reports these results:` keeps the `", "` join, so each install scenario states every note twice: once joined, and once per line in `the workflow install diagnostic reports these lines:`.
**Fix:** Parent line: make the shared results projection render a diagnostic's `lines` without the ambiguous join. Then the per-line step can replace the column instead of repeating it.

### IN-09: The new doc sentences are slightly broader than the evidence

**File:** `docs/workflows-compatibility.md:214`
**Issue:** The WR-01 fix added two sentences that are not quite exact:

- "Every scenario that pins the warning runs one command in a new session." The update scenario (`lifecycle.feature:76-92`) runs `/claude:plugin update` in the session before the workflow command, so the scenario runs two commands. The point the sentence makes still holds, because only one of them is a workflow command and only a workflow run can use up the warning.
- "The engine shows this warning only once per session." The flag lives on the delivery endpoint, and `bindSessionDelivery` replaces the endpoint, without the flag, each time the engine binds a session (`task-panel.ts:1116-1125`). The engine binds on `session_start`. So a `/reload` that keeps the same session id would likely show the warning again on the next run. "Once per session" is a fair summary, and "once per session binding" is exact.

**Fix:** Write "runs one workflow command in a new session", and optionally "only once until the session is bound again (a new session or a `/reload`)".

### IN-10: The run turn is marked compared by a step that does not compare the run outcome, and the skill says a turn reader marks it

**File:** `features/step_definitions/workflow/runs.steps.ts:86-102`, `features/step_definitions/workflow/listing.steps.ts:153`
**Issue:** After the IN-05 fix, only the notices step marks a run turn compared. That closes the gap of a run scenario with no notices step. The opposite gap stays open: a run scenario that states the notices but leaves out `the workflow run ends with ...` passes the uncompared-turn check, and its status and result go unchecked. All six run executions state both today, so this is a convention again, as IN-05 was.

The change also departs from the text of a binding rule. `.agents/skills/cucumber/rules/world-and-stand-ins.md:66` says: "A `Then` that reads the turn marks it compared through the world's `markTurnCompared()`." `runOutcome` reads the turn (`world.requireTurn()`, `runs.steps.ts:44`), and the two run steps no longer mark it. The skill conflicts with itself here: `steps.md:64` lists five allowed `Then` side effects and leaves `markTurnCompared()` out. The fix follows the intent of the rule, the world check fails more often under it, and `features/step_definitions/mcp-server/calls.steps.ts:50` already reads a turn without marking it. So this is Info, not a Warning.
**Fix:** Parent lines, because the world and the skill are frozen:

- Reword `world-and-stand-ins.md:66` to say that a `Then` that compares the whole of what a turn reports marks it compared, and add `markTurnCompared()` to the side-effect list in `steps.md:64`.
- Optionally, give the world one marker for each part of a workflow run (the notices and the run outcome), so that each step marks only its own part and the world fails when either part goes unstated.

---

_Reviewed: 2026-11-01T20:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
