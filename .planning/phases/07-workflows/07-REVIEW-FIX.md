---
phase: 07-workflows
fixed_at: 2026-11-01T16:30:00Z
review_path: .planning/phases/07-workflows/07-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-11-01T16:30:00Z
**Source review:** .planning/phases/07-workflows/07-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (CR-01, WR-01 to WR-07; fix scope `critical_warning`, so IN-01 to IN-04 were not attempted)
- Fixed: 8
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace` on `features/component-features-phase-7`, not in a worktree. The caller told me to work there and not to switch branches. Every npm command ran with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. Every commit ran the hook's `npm run check:commit`, and it passed each time.

**Final gates:**

- `npx cucumber-js features/workflow`: 37 scenarios and 457 steps passed (seed 96241). A second run also passed 37 of 37 (seed 38175).
- `npm run check:static`: passed. That covers typecheck, lint, lint:workflows, fallow (dupes included), format:check, test:corresponding, and check:features.

## Fixed Issues

### CR-01: "Without the engine, a new session offers no workflow command" cannot fail

**Files modified:** `features/step_definitions/workflow/listing.steps.ts`, `features/workflow/companion-missing.feature`
**Commit:** e4e0052
**Applied fix:** I added the step `pi offers no slash command whose name contains {string}`. It reads every command of the registry probe's listing from any source (engine, prompt template, skill, other extension) and compares `[source, /name, path]` for each command whose name holds the text to `[]`. The companion-missing scenario now ends with `Then pi offers no slash command whose name contains "hello"`. The engine-path filter stays in `pi offers no workflow commands` and `pi offers these workflow commands:`, which `listing.feature` and `lifecycle.feature` use with the engine loaded.
**Red proof:** I temporarily published `/demo:hello` as a prompt template in the plugin (the slash-command `Given`), which stands in for a bridge that falls back to a prompt template. I kept the old step and placed it before the new one. The old step `pi offers no workflow commands` passed, and the new step failed with `[['prompt', '/demo:hello', '<agentDir>/pi-claude-marketplace/resources/prompts/demo:hello.md']]` against `[]`. After the revert the scenario passed.

### WR-01: The run `Then` steps mark the turn compared but ignore every notice

**Files modified:** `features/step_definitions/workflow/listing.steps.ts`, `features/workflow/run.feature`, `features/workflow/companion-missing.feature`, `features/workflow/lifecycle.feature`
**Commit:** 3fc82fa
**Applied fix:** I first checked that the notices are deterministic. The command handler calls `startInBackground` and then posts the start notice, both synchronously, before Pi answers. The `complete`/`error` listener of `task-panel.ts` emits the delivery warning synchronously, while `workflow-progress.ts` publishes the terminal progress entry in a `queueMicrotask`. So the warning always precedes the entry that ends the run `When`. `warnDelivery` warns once per session endpoint, and every run scenario runs one command in a fresh session. The notices step now shows each run id named by the turn's progress entries as `{run id}`, and the session id from Pi's RPC `get_state` as `{session id}`. A notice that names another run or session therefore fails. All six run scenarios (three in `run.feature`, the Outline with three rows among them, the recovery scenario in `companion-missing.feature`, and two in `lifecycle.feature`) now state both notices: the `info` start notice and the `warning` `[workflow-delivery] delivery for {run id} deferred: endpoint for session {session id} has no thenable send function`.
**Red proof:** In `run.feature`'s first scenario I changed `has no thenable send function` to `was delivered`. The scenario failed, and its diff showed the projected `{run id}` and `{session id}`. After the revert it passed. The run, companion-missing, and lifecycle files then passed three times on different seeds.

### WR-02: The doc says the delivery fix shipped in 3.14.0 and was never measured

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** 02c9447
**Applied fix:** The engine requirements paragraph now says that in Pi's RPC mode delivery stays pending with engine 3.15.0 too. It quotes the warning (scenario-measured at 3.15.0, Pi 1.4.0 over RPC, engine loaded with `--extension`, `features/workflow/run.feature`). It says that the run completes and its progress entry carries the result. It grades "the result is never posted" as source-read at 3.15.0 (`src/task-panel.ts`, the branch of `deliverAndAck` that warns and returns). It marks interactive mode as not measured.

### WR-03: "Scenario-measured" claims cover more cases than the scenarios pin

**Files modified:** `features/workflow/refusals.feature`, `features/workflow/lifecycle.feature`, `docs/workflows-compatibility.md`
**Commit:** 7af3d39
**Applied fix:** I took the "add coverage" option, not the "narrow the grade" one.

- The refusal Outline gained three rows:
  - `mutable.js` (`export let meta`) gives `/demo:mutable failed: meta export must be \`export const meta = ...\``.
  - `hidden.js` (unexported `const meta`) gives the check-3 first-statement message.
  - `pair.js` (`export const meta = {...}, other = 1`) gives `/demo:pair failed: meta export must declare only \`meta\``.
  So all six rows of the admit-versus-run table are now run.
- `lifecycle.feature` gained two scenarios:
  - "Running the old workflow command after a renaming update shows the engine's notice, ..."
  - "A new session after the disable offers no workflow command".
- The doc sentence at line 191 now says that the lingering-command behavior holds "after each of the three" verbs.

**Red proof:**

- The three new Outline rows first ran with the placeholder message `x`, and all three failed with the engine's real message, which I then wrote in.
- The rename scenario with `/demo:greet` in place of `/demo:hello` failed.
- The disable scenario with its `Given the user has started a new pi session` removed failed: `pi offers no workflow commands` saw `[['/demo:hello', 'Says hello.']]`.
- All passed after the revert.

### WR-04: The table note "the bridge never checks `description`" contradicts the pinned install note

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** 1505f71
**Applied fix:** The Notes cell now reads "the bridge does not require `description` and warns under `meta-fields-invalid`; the engine refuses at check 9". mdformat realigned the table, which is why the commit touches 11 lines.

### WR-05: The refusal precondition accepts the wrong disposition

**Files modified:** `features/step_definitions/workflow/refusals.steps.ts`, `features/workflow/refusals.feature`
**Commit:** ab1a516
**Applied fix:** The step `the user has run {string}, which reported notes on workflow scripts of the plugin` is now `the user has run {string}, which reported these notes on workflow scripts:` with a `| script | disposition |` table. The step parses each diagnostic line with `^workflow script "([^"]+)" in "workflows" (was refused|was not installed|was installed but the engine will refuse to load it): `. It compares the whole set of rows (file names, dispositions, and count) in the `Given`, with the info cascade and the warning diagnostic as before. A line that is no workflow note keeps its text in the script cell and fails. The Outline states `| <file> | was installed but the engine will refuse to load it |`. The listing scenario states all seven scripts.
**Red proof:** In the listing scenario I changed `clock.js` to `was not installed`. The scenario failed in the `Given` (`'was refused'` against `'was not installed'`). After the revert it passed.

### WR-06: The joined `lines` cell cannot tell where one note ends and the next begins

**Files modified:** `features/step_definitions/workflow/refusals.steps.ts`, `features/workflow/refusals.feature`
**Commit:** c8a9bfa
**Applied fix:** I added `Then the diagnostic reports these lines:`. It requires exactly one diagnostic among the command's results and compares its lines, one row per line, to a `| line |` table. The three install scenarios now state it after the results table. The joined `lines` column of `the command reports these results:` stays, because that frozen step appends any column a table leaves out (`features/lib/field-rows.ts`), so the column cannot be dropped without editing a frozen file.
**Red proof:** I merged the `broken.js` and `clock.js` rows into one row joined with `, `, which is what a bridge that merged two notes would print. The joined cell cannot see that merge, but the new step failed. After the revert it passed.

### WR-07: Two feature descriptions break the two-to-three-line rule

**Files modified:** `features/workflow/refusals.feature`, `features/workflow/lifecycle.feature`
**Commit:** 7e0f3c9
**Applied fix:** I reflowed both descriptions to three lines. Each names its stand-ins in one clause ("A scripted model and a local marketplace stand in for real ones."), as `run.feature` does. This change has no behavior and no red proof. `check:features` passes.

## Parent lines

None. No fix needed a frozen file. One note for the parent: a cleaner WR-06 fix would make the shared results projection (`features/lib/field-rows.ts`, frozen) render a diagnostic's `lines` without the ambiguous `, ` join. Then the per-line step could replace the joined column instead of sitting beside it.

## Not in scope (Info, not attempted)

IN-01 (release comment and order in `companion-missing.steps.ts`), IN-02 (`DIALOG_METHODS` defined three times; two of the copies live in frozen files), IN-03 (doc note that quoted engine messages show U+2014 as `--`), and IN-04 (`description ?? ""` projection).

______________________________________________________________________

_Fixed: 2026-11-01T16:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
