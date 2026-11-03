---
phase: 07-workflows
fixed_at: 2026-11-01T19:30:00Z
review_path: .planning/phases/07-workflows/07-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-11-01T19:30:00Z
**Source review:** .planning/phases/07-workflows/07-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 3. The fix scope is `critical_warning` (WR-01, WR-02), and the caller added IN-05 on the condition that every scenario keeps passing and the cucumber rules allow it. Both held. IN-01 to IN-04 and IN-06 to IN-08 were not attempted.
- Fixed: 3
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace` on `features/component-features-phase-7`, not in a worktree. The caller told me to work there and not to switch branches, although `workflow.use_worktrees` is `true`. Every npm command and every commit ran with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`. No staged file in these three commits is a build input, so the hook skipped `npm run check:commit` each time, and I ran the gates below by hand.

**Final gates (after the last commit, `baf0cbd`):**

- `npx cucumber-js features/workflow`: 37 scenarios and 457 steps passed (seed 61268).
- `node scripts/check-features.mjs`: exit 0.
- `npm run check:static` (after a lone `npm run lint` to warm ESLint): passed. That covers typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features.

## Iteration 1 (summary)

The first pass fixed all 8 in-scope findings of the first review, with no skips:

- CR-01 (e4e0052): the companion-missing scenario reads every slash command from any source, not only engine commands.
- WR-01 (3fc82fa): every run scenario states the engine's notices, with the run id and session id shown as `{run id}` and `{session id}`.
- WR-02 (02c9447): the doc records that delivery stays pending over RPC with engine 3.15.0.
- WR-03 (7af3d39): the refusal Outline gained three rows, and `lifecycle.feature` gained a rename scenario and a new-session-after-disable scenario.
- WR-04 (1505f71): the doc note says the bridge warns on a missing description.
- WR-05 (ab1a516): the refusal precondition compares the whole `script | disposition` set.
- WR-06 (c8a9bfa): a per-line diagnostic step replaced the ambiguous comma join as the real check.
- WR-07 (7e0f3c9): two feature descriptions fit in three lines.

Each behavior fix had a red proof. The full record is in the git history of this file.

## Fixed Issues (iteration 2)

### WR-01: The doc says every run shows the delivery warning, but the engine warns once per session

**Files modified:** `docs/workflows-compatibility.md`
**Commit:** 6382ae4
**Applied fix:** I first confirmed the engine behavior in the optional peer cache (engine 3.15.0, `src/task-panel.ts`). `warnDelivery` returns early when `endpoint.warned` is set and sets it the first time it warns. `bindSessionDelivery` builds a new endpoint, without the flag, only when the session binds again. The paragraph now says that the first run in a session shows the start notice and then the warning (scenario-measured, as before). It adds that the engine shows the warning only once per session, so a later run in the same session shows only the start notice and its result stays pending all the same. That part is graded source-read at 3.15.0 (`src/task-panel.ts`, `warnDelivery`). It also says that every scenario that pins the warning runs one command in a new session. This is a doc change, so it has no red proof.

### WR-02: Two steps added by the fixes do not name their kind

**Files modified:** `features/step_definitions/workflow/refusals.steps.ts`, `features/step_definitions/workflow/listing.steps.ts`, `features/workflow/refusals.feature`, `features/workflow/companion-missing.feature`
**Commit:** cd65b30
**Applied fix:** I renamed both steps so that their text names the workflow kind:

- `the diagnostic reports these lines:` is now `the workflow install diagnostic reports these lines:`. The three uses in `refusals.feature` (lines 60, 88, 123) changed with it.
- `pi offers no slash command whose name contains {string}` is now `pi offers no slash command for the workflow {string}`. Its parameter is now named `workflow`, and its comment says it matches commands whose name holds the workflow's name. The use in `companion-missing.feature:72` changed with it.

The bodies are unchanged. Prettier rewrapped the refusals step because the longer text passes 100 columns.

**Red proof:**

- In "Installing a plugin refuses a nondeterministic script and one that does not parse, ..." (`refusals.feature:40`), I changed the expected `clock.js` line from `was refused` to `was skipped`. The scenario failed in `Then the workflow install diagnostic reports these lines:` (`refusals.steps.ts:67`) with an `AssertionError`.
- In "Without the engine, a new session offers no workflow command" (`companion-missing.feature:61`), I changed `"hello"` to `"claude"`. The scenario failed in `Then pi offers no slash command for the workflow "claude"` (`listing.steps.ts:114`): it found `['extension', '/claude:plugin', '<repo>/extensions/pi-claude-marketplace/index.ts']` where it expected `[]`.
- After the revert, both feature files passed 15 of 15 scenarios (seed 997313), and `check:features` passed.

### IN-05: The run `Then` steps still mark the turn compared on their own

**Files modified:** `features/step_definitions/workflow/runs.steps.ts`
**Commit:** baf0cbd
**Applied fix:** I removed `this.markTurnCompared()` from `the workflow run ends with the status {string} and the result {string}` and from `... and the error {string}`, and added a comment that says only `the workflow engine shows these notices:` marks a run turn compared. Both steps still read the world through `runOutcome(this)`, so they stay `function` expressions. The cucumber rules allow this: `steps.md` lists the side effects a `Then` may have, and the change removes one. Every run scenario (the three in `run.feature`, including the Outline, the recovery scenario in `companion-missing.feature`, and two in `lifecycle.feature`) already ends with the notices step, and every `which starts no run` scenario uses the notices step alone, so no scenario needed a change.

**Red proof:**

- Before the change, I deleted the notices step and its table from the first scenario of `run.feature` (line 7). The scenario passed (11 of 11 steps). That shows the gap the finding describes.
- After the change, the same edited scenario failed with `AssertionError: no step compared the last model turn`.
- After I restored `run.feature`, the whole workflow suite passed: 37 scenarios and 457 steps (seed 61268).

## Parent lines

None. No fix needed a frozen file. The parent lines of the review (IN-02, IN-06, IN-08) are unchanged and remain open for the parent.

## Not in scope (Info, not attempted)

IN-01 (release comment and order in `companion-missing.steps.ts`), IN-02 (`DIALOG_METHODS` defined three times; parent line), IN-03 (doc note that quoted engine messages show U+2014 as `--`), IN-04 (`description ?? ""` projection), IN-06 (`{run id}` and `{session id}` tokens; parent line), IN-07 (the `export var` and empty-`description` variants are not driven), and IN-08 (the joined results column; parent line).

______________________________________________________________________

_Fixed: 2026-11-01T19:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
