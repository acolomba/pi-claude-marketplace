---
phase: 07-workflows
reviewed: 2026-11-01T18:00:00Z
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
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This is the second `--auto` pass. I re-read the 11 files at HEAD (`7e0f3c9`) and the fix commits `e4e0052..7e0f3c9`. I checked the engine behavior the new notice rows depend on against `@quintinshaw/pi-dynamic-workflows` 3.15.0 in the optional peer cache (`src/task-panel.ts`, `src/workflow-progress.ts`). I also ran both gates:

- `node scripts/check-features.mjs` exited 0.
- `npx cucumber-js features/workflow` passed 37 scenarios and 457 steps (seed 106043).

How each finding of the previous pass stands:

| Previous | Status | Evidence |
| --- | --- | --- |
| CR-01 | Fixed | `pi offers no slash command whose name contains "hello"` reads every command source (`listing.steps.ts:211-228`). A prompt-template or extension fallback named for the workflow now fails. |
| WR-01 | Fixed | All eight run executions now state both notices. The ordering is deterministic: `routeBackgroundDelivery` → `deliverAndAck` warns synchronously in the `complete` listener (`task-panel.ts:1394-1407`, `:971-976`), and the terminal progress entry is published in a `queueMicrotask` (`workflow-progress.ts:164`). So the warning always comes before the record that ends the run `When`. |
| WR-02 | Fixed, with an overclaim | The doc now records the deferred delivery, but it says "each run" (WR-01 below). |
| WR-03 | Fixed | The Outline now runs `mutable.js`, `hidden.js`, and `pair.js`. `lifecycle.feature` pins the stale notice after a renaming update, and pins the absence in a new session after disable. A small residue is left (IN-07). |
| WR-04 | Fixed | The note now matches the bridge. `domain/workflow-script.ts:977-979` warns under `meta-fields-invalid` on a missing or blank description. |
| WR-05 | Fixed | The `Given` compares the full `script \| disposition` set (`refusals.steps.ts:281-318`). |
| WR-06 | Fixed | `the diagnostic reports these lines:` compares one row per line. The new step's text does not name its kind (WR-02 below). |
| WR-07 | Fixed | Both descriptions are three lines. |
| IN-01..IN-04 | Open | Out of fix scope. Carried forward unchanged as IN-01..IN-04. |

No scenario can now pass for a plausible wrong implementation. Two warnings remain. One doc sentence generalizes a once-per-session warning to every run. And the two new steps break the rule that a phase's step text names its kind.

## Warnings

### WR-01: The doc says every run shows the delivery warning, but the engine warns once per session

**File:** `docs/workflows-compatibility.md:214`
**Issue:** The paragraph says: "Each run that a workflow command starts shows the engine's start notice ... Then it shows the warning `[workflow-delivery] delivery for <run id> deferred: ...`" and grades it scenario-measured.

The engine does not work that way. `warnDelivery` (`src/task-panel.ts:208-217`) returns early when `endpoint.warned` is set, and it sets that flag the first time it warns. The endpoint is replaced only when the session binds again (`bindSessionDelivery`, `task-panel.ts:1122-1132`). So within one session, only the first deferred delivery warns, and a second run in the same session shows the start notice alone.

Every scenario that pins the warning runs exactly one command in a fresh profile Pi and session. The fix report says so ("`warnDelivery` warns once per session endpoint, and every run scenario runs one command in a fresh session"). So "each run" is neither measured nor true. A reader who sees no warning on a second run would conclude that delivery succeeded.

**Fix:** Narrow the claim and grade the once-per-session part as source-read:

```markdown
The first run in a session shows the engine's start notice, which says that the result is posted here when it finishes, and then the warning `[workflow-delivery] delivery for <run id> deferred: endpoint for session <session id> has no thenable send function` (scenario-measured at 3.15.0, ..., `features/workflow/run.feature`). The engine warns once per session, so a later run in the same session shows only the start notice, and its result stays pending all the same (source-read at 3.15.0, `src/task-panel.ts`, `warnDelivery`).
```

### WR-02: Two steps added by the fixes do not name their kind

**File:** `features/step_definitions/workflow/refusals.steps.ts:323`, `features/step_definitions/workflow/listing.steps.ts:215-228`
**Issue:** `.agents/skills/cucumber/rules/layout.md` ("Reserved names") says: "A step that a phase adds names its kind in its text, so two phases never define the same step text." Every other step this phase added names workflows (`the workflow engine shows these notices:`, `pi offers no workflow commands`, `..., which reported these notes on workflow scripts:`). The two steps the fixes added do not:

- `the diagnostic reports these lines:` is generic text about a command's result. The slash-command, skill, agent, or MCP phase could plausibly need the same per-line check for its own install notes, because the frozen results projection joins a diagnostic's lines with `", "` for every kind. If two phases define it, the milestone merge has an ambiguous step, and the skill grades that a BLOCKER. The step also picks one payload out of several (the diagnostic beside the cascade). The earlier results step compares every payload, so nothing escapes, but the steps rule says a step "never picks one payload out of several".
- `pi offers no slash command whose name contains {string}` names no kind either. Its natural owner is the slash-command phase's vocabulary.

**Fix:** Name the kind in both texts and update the four uses:

```ts
Then("the install reports these workflow script notes:", function (this: ScenarioWorld, table: DataTable) { ... });

Then(
  "pi offers no slash command for the workflow {string}",
  function (this: ScenarioWorld, workflow: string): void { /* same body, filter on name.includes(workflow) */ },
);
```

`refusals.feature:60,88,123` and `companion-missing.feature:72` change with them (`Then pi offers no slash command for the workflow "hello"`).

## Info

### IN-01: The release's stated reason does not hold, and the restore runs before the profile Pi stops (carried forward)

**File:** `features/step_definitions/workflow/companion-missing.steps.ts:35-53`
**Issue:** The comment says the restore stops "a stale entry [from loading] the engine into the shared Pi at its next new session". But `Before()` in `features/support/pi-process.ts` empties the sandbox, `agentDir` included, before the next scenario. So the restore is defense in depth. It is also registered after the profile Pi's release, so it runs while the engine-loaded Pi is still alive.
**Fix:** Describe the release as defense in depth. Optionally register it so that it runs after `pi.stop()`.

### IN-02: `DIALOG_METHODS` is defined three times (carried forward; parent line)

**File:** `features/lib/workflow-files.ts:49`, `features/lib/pi-process.ts:68`, `features/step_definitions/session.steps.ts:42`
**Issue:** The same four-method set appears in three modules. Two of them are frozen.
**Fix:** Parent line: export it once from `features/lib/pi-process.ts`, and import it in `session.steps.ts` and `workflow-files.ts`.

### IN-03: The doc quotes engine notices with `--` where the engine prints U+2014 (carried forward)

**File:** `docs/workflows-compatibility.md:75,191`
**Issue:** The stale-command notice at line 191 is quoted as the engine's own text, but the engine prints `—`. The commit hook forces `--`, and the notices step maps one way only (`listing.steps.ts:249`).
**Fix:** Add one sentence saying that quoted engine messages show U+2014 as `--`.

### IN-04: `description ?? ""` merges a missing description with an empty one (carried forward)

**File:** `features/step_definitions/workflow/listing.steps.ts:148`
**Issue:** A command with no description compares equal to one with an empty description. The engine always supplies `Saved workflow: <name>`, so nothing depends on this today.
**Fix:** Project `undefined` to a distinct marker such as `(none)`, or assert that it is a string.

### IN-05: The run `Then` steps still mark the turn compared on their own

**File:** `features/step_definitions/workflow/runs.steps.ts:86-101`
**Issue:** WR-01 of the previous pass was fixed by convention: every run scenario now adds the notices step. But `the workflow run ends with ...` reads only the progress entries and still calls `markTurnCompared()`. A future run scenario that leaves out the notices step therefore passes the world's uncompared-turn check, and its notices go unchecked. That is the gap the check exists to close.
**Fix:** Remove `this.markTurnCompared()` from the two run `Then` steps, so that only `the workflow engine shows these notices:` marks a run turn compared. All current run scenarios already end with it.

### IN-06: `{run id}` and `{session id}` are tokens the skill does not list, and the notices `Then` queries Pi (parent line)

**File:** `features/step_definitions/workflow/listing.steps.ts:152-179,236-256`
**Issue:**

- `features.md` "Run tokens" lists every brace token, but the notices step adds `{run id}` and `{session id}` locally, outside `features/lib/run-tokens.ts`.
- The step reads the session id with a `get_state` RPC request in the `Then`, not from what the `When` left on the world. The request is read-only and the step is correct.

Both deviations are forced, because the world, `run-tokens.ts`, and the skill are frozen.
**Fix:** Parent lines:

- List `{run id}` (the run a workflow command started, as its progress entries name it) and `{session id}` (Pi's current session id) in `.agents/skills/cucumber/rules/features.md`.
- Have the world keep the session id of a recorded turn, so the step reads it from the turn.

### IN-07: Two row variants in the admit-versus-run table are graded scenario-measured but not driven

**File:** `docs/workflows-compatibility.md:63,65,75`
**Issue:** Line 75 grades "the first six rows" as scenario-measured. Two of those rows name two shapes each, and the Outline drives only one of each:

- `export let` is driven, `export var` is not.
- A missing `description` is driven, an empty one is not.

The engine and bridge predicates are the same for both variants (`domain/workflow-script.ts:778,979`), so the risk is low.
**Fix:** Add `export var meta` and `description:""` rows to the refusal Outline, or name the driven variant in the grade.

### IN-08: The results table still joins diagnostic lines ambiguously (parent line)

**File:** `features/workflow/refusals.feature:57-63,85-91,120-127` (projection in frozen `features/lib/field-rows.ts`)
**Issue:** The `lines` column of `the command reports these results:` keeps the `", "` join, so each install scenario states every note twice: once joined, and once per line in the new step.
**Fix:** Parent line: make the shared results projection render a diagnostic's `lines` without the ambiguous join. Then the per-line step can replace the column instead of repeating it.

---

_Reviewed: 2026-11-01T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
