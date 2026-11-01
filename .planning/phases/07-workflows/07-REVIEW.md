---
phase: 07-workflows
reviewed: 2026-11-01T00:00:00Z
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
  critical: 1
  warning: 7
  info: 4
  total: 12
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

I reviewed the Phase 7 workflow scenarios, their step modules, the shared workflow helper, and the compatibility doc, using the diff `3a7a707..HEAD`. I checked the engine behavior they depend on against `@quintinshaw/pi-dynamic-workflows` 3.15.0 in the optional peer cache (`src/saved-commands.ts`, `src/workflow-manager.ts`, `src/workflow-progress.ts`, `src/task-panel.ts`). I also ran `run.feature:7` and `run.feature:48` with a temporary scratch `After` hook. The hook was passed with `--import` from outside the repository, and no repository file was changed. It dumped every notice and progress record of the run and re-read the model-call log 5 s after the run.

The U+2014 handling is correct. The engine's stale-command notice contains U+2014, and the notices step maps it to `--` before it compares (`listing.steps.ts:84`). The no-run `When` is sound. The engine refuses at `parseWorkflowScript` before it creates a run, and the `started` progress entry is published in a microtask that runs before Pi answers. So a run that does start leaves a progress entry, and a background-start `info` notice, inside the window. The settings merge-and-restore keeps other members of the file and refuses to overwrite `packages`.

The main problems:

1. One negative scenario cannot fail (CR-01).
2. Every run emits a warning notice that no step pins and the doc does not mention: result delivery is deferred (WR-01, WR-02).
3. Several doc claims are graded "scenario-measured" but say more than the scenarios pin (WR-03, WR-04).

## Critical Issues

### CR-01: "Without the engine, a new session offers no workflow command" cannot fail

**File:** `features/step_definitions/workflow/listing.steps.ts:30-45`, `features/workflow/companion-missing.feature:57-68`
**Issue:** `workflowCommandRows` keeps a command only when `command.path === entry`, where `entry` is the engine's `pi.extensions` entry from the optional peer cache. In this scenario the profile Pi starts with no companions (`Given pi runs with the scripted model`), so no command can have that path. `pi offers no workflow commands` therefore returns `[]` for any implementation.

The behavior the title names is that nothing offers `/demo:hello` when the engine is absent. A wrong implementation could break it in two plausible ways:

- The bridge falls back to staging the workflow as a prompt template or as an extension command of this extension.
- Another bridge picks the script up.

Neither is visible to the filter. Under the cucumber skill this is a scenario that a plausible wrong implementation still passes. The doc then cites the scenario as evidence (`docs/workflows-compatibility.md:232`: "and a new session offers no workflow command").

**Fix:** Give the negative its own step that looks at every source. For example, add a step `pi offers no command named {string}` that compares `snapshot.commands.filter((c) => c.name === name)` to `[]`, or that lists every non-builtin command whose name starts with `demo:`. Use it in `companion-missing.feature:68`. Keep the engine-path filter only for the positive listing tables, where the engine is loaded.

```ts
Then("pi offers no command named {string}", function (this: ScenarioWorld, name: string): void {
  const snapshot = this.registrySnapshot ?? assert.fail("no step listed the slash commands pi offers");
  const expanded = expandTokens(name, this.tokens).replace(/^\//, "");
  assert.deepStrictEqual(
    snapshot.commands.filter((command) => command.name === expanded).map((c) => [c.source, c.path]),
    [],
  );
});
```

## Warnings

### WR-01: The run `Then` steps mark the turn compared but ignore every notice, including a warning that every run emits

**File:** `features/step_definitions/workflow/runs.steps.ts:41-52,86-101`
**Issue:** `runOutcome` reads three fields (`status`, `resultPreview`, `error`) of the last progress entry, then calls `markTurnCompared()`. The turn's notify records are never compared.

The probe run of `run.feature:7` and `:48` showed this notice sequence on every run:

- `info`: `/demo:hello running in the background (<runId>) — check progress with /workflows status <runId>; the result is posted here when it finishes.`
- `warning`: `[workflow-delivery] delivery for <runId> deferred: endpoint for session <id> has no thenable send function`

Nothing is ever posted back to the session (`task-panel.ts:963-966`).

The user sees a warning on every successful run, and the result the start notice promises is never delivered. No scenario pins either fact, so a regression that adds or removes notices passes. This goes against the skill rule to compare whole values, and against the doc's statement that the scenarios "compared what Pi and the engine reported" (`docs/workflows-compatibility.md:13`).

**Fix:** In each run scenario, after the run `Then`, add a `Then the workflow engine shows these notices:` table. This needs the notices step to accept the run turn, which it already does, because it reads `requireTurn()`. Use `{run id}` / `{session id}` projections, or a token for the run id. Alternatively, have `runOutcome` also return the projected notice list and compare it in the same step.

### WR-02: The doc says the delivery fix shipped in 3.14.0 and was never measured, but the scenarios measure delivery as deferred at 3.15.0

**File:** `docs/workflows-compatibility.md:214`
**Issue:** The doc says: "With engine 3.13.0 or 3.13.1, result delivery can stay pending ... Engine 3.14.0 includes the fix ... and no run recorded here measured it." The section then recommends 3.15.0.

The scenarios under `features/workflow/` run engine 3.15.0 in Pi 1.4.0, loaded with `--extension` and without `--no-extensions` (`test/e2e/_rpc.ts:19,252`). On every run they observe `delivery ... deferred: ... has no thenable send function` (WR-01). So a run here does measure delivery, and it stays pending. The doc's guidance, and its "scenario-measured" grade definition, hide an observed shortfall.

**Fix:** Record the observation with its grade, for example: "scenario-measured at 3.15.0 over RPC: the engine defers result delivery with `[workflow-delivery] ... deferred` because the session endpoint has no thenable send function". Say whether TUI mode differs, or mark that as not measured. Pin it per WR-01.

### WR-03: "Scenario-measured" claims cover more cases than the scenarios pin

**File:** `docs/workflows-compatibility.md:75`, `docs/workflows-compatibility.md:191`
**Issue:**

- Line 75 says the first six rows of the admit-versus-run table install with a note and are refused at run with `/<plugin>:<name> failed: <message>` and no progress entry, graded "scenario-measured at 3.15.0, `features/workflow/refusals.feature`". The refusal Outline (`refusals.feature:30-34`) drives only checks 3 (`late.js`), 8 (`reserved.js`) and 9 (`nodesc.js`). The rows for check 4 (`export let` / `export var`), check 5 (two declarators), and `const meta` not exported (check 3) are never installed or run by any scenario.
- Line 191 says that running the lingering command starts no run and shows the stale notice. It lists uninstall, disable, and "an update that renames the workflow" in the sentence before. The scenarios pin the notice after uninstall and disable (`lifecycle.feature:21-26,52-57`) but never run `/demo:hello` after a renaming update. "A new session no longer offers the command" is pinned after uninstall and rename, but not after disable.

**Fix:** Do one of two things. Narrow the grade to the measured rows ("scenario-measured for checks 3, 8 and 9; source-read for the rest"), or add Outline rows for `export let meta`, `export const meta = {...}, other = 1`, and `const meta = ...` (unexported). Also add a lifecycle scenario that runs the old command after a renaming update.

### WR-04: The table note "the bridge never checks `description`" contradicts the pinned install note

**File:** `docs/workflows-compatibility.md:63`
**Issue:** This phase rewrote the row, and its Notes cell says "the bridge never checks `description`". The same doc says the bridge warns when `description` is missing (lines 79, 119: "it does not require a description, and warns without one"). `refusals.feature:110` pins that warning for `nodesc.js`: "`meta.description` must be a non-empty string ...". The note is false.

**Fix:** Change the note to "the bridge does not require `description` and warns under `meta-fields-invalid`; the engine refuses at check 9".

### WR-05: The refusal precondition accepts the wrong disposition

**File:** `features/step_definitions/workflow/refusals.steps.ts:16-29,36-56`
**Issue:** The `Given ... which reported notes on workflow scripts of the plugin` step accepts any diagnostic line that starts with `workflow script "`. It does not check:

- which files the notes name
- that the disposition is "was installed but the engine will refuse to load it"
- how many notes there are
- the header

Suppose `late.js` were wrongly refused at install ("was refused") or skipped ("was not installed"). The Given still passes. The scenario then fails later, at the no-run `When`, with a non-`handled` disposition. That message points away from the broken precondition. The skill requires that "a broken precondition fails in the `Given`". The step's comment says a broken precondition "fails here", but that is only true when no diagnostic is reported at all.

**Fix:** Require every note line to match `/^workflow script "[^"]+" in "workflows" was installed but the engine will refuse to load it: /`. Alternatively, take the expected script file names as a parameter and compare the set of named files.

### WR-06: The joined `lines` cell cannot tell where one note ends and the next begins

**File:** `features/workflow/refusals.feature:55,79,110` (projection in `features/lib/field-rows.ts:37`)
**Issue:** The `lines` column joins the diagnostic lines with `", "`, and the note texts contain `", "` themselves. For example, the check-8 note alone has more than ten. A bridge that merged the notes into one line, or split one note into several, would produce the same cell and pass. These three scenarios are the only pins of the per-script note format (one line per script, sorted by file name).

**Fix:** For diagnostics, compare the lines as a separate table, for example `the diagnostic reports these lines:` with one row per line. Or use a separator that cannot occur in a note, such as `" | "` written as an escaped cell, for the `lines` column.

### WR-07: Two feature descriptions break the two-to-three-line rule

**File:** `features/workflow/refusals.feature:3-6`, `features/workflow/lifecycle.feature:3-6`
**Issue:** `.agents/skills/cucumber/rules/features.md` says: "Every feature has a description of two or three lines." Both descriptions have four lines. The skill classifies this as a WARNING.

**Fix:** Reflow each description to three lines. Each could drop the stand-in sentence's second clause, as `run.feature:3-5` does.

## Info

### IN-01: The release's stated reason does not hold, and the restore runs before the profile Pi stops

**File:** `features/step_definitions/workflow/companion-missing.steps.ts:35-53`
**Issue:**

- The comment says the restore is needed because "a stale entry would load the engine into the shared Pi at its next new session". But `Before()` in `features/support/pi-process.ts:127-135` empties every sandbox directory, `agentDir` included, before it starts the shared Pi's next session. So the restore is defense in depth, not the guard.
- The release is registered after the profile Pi's release, so it runs before `pi.stop()`. The file is put back while the engine-loaded Pi is still alive. If Pi ever writes its in-memory settings on shutdown, `packages` would come back.

**Fix:** Change the comment to describe the release as defense in depth. Optionally register the restore before the write, or after `pi.stop()`.

### IN-02: `DIALOG_METHODS` is defined three times

**File:** `features/lib/workflow-files.ts:49`, `features/lib/pi-process.ts:68`, `features/step_definitions/session.steps.ts:42`
**Issue:** The same four-method set is declared in three modules. If Pi adds a dialog method, all three copies must change together.
**Fix:** Export it once from `features/lib/pi-process.ts` and import it in the other two.

### IN-03: The doc quotes engine notices with `--` where the engine prints U+2014

**File:** `docs/workflows-compatibility.md:75,191`
**Issue:** Line 191 quotes the stale-command notice as the engine's own text, but the engine emits `—` (`saved-commands.ts:78`). The commit hook forces `--` in the doc. The step's one-way mapping also means a notice printed with a literal `--` would pass.
**Fix:** Add one sentence saying that the quoted engine messages show U+2014 as `--`.

### IN-04: `description ?? ""` hides the difference between a missing description and an empty one

**File:** `features/step_definitions/workflow/listing.steps.ts:43`
**Issue:** If a command came back with no description, it would compare equal to a command with an empty one. The engine always supplies `Saved workflow: <name>`, so no case today depends on this. A regression that drops the fallback would show as an empty cell, not as an error.
**Fix:** Project `undefined` to a distinct marker, such as `(none)`, or assert that it is a string.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
