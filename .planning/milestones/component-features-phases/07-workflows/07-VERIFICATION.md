---
phase: 07-workflows
verified: 2026-11-01T22:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/07-workflows/07-01-PLAN.md
  - .planning/phases/07-workflows/07-01-SUMMARY.md
  - .planning/phases/07-workflows/07-02-PLAN.md
  - .planning/phases/07-workflows/07-02-SUMMARY.md
  - .planning/phases/07-workflows/07-03-PLAN.md
  - .planning/phases/07-workflows/07-03-SUMMARY.md
  - .planning/phases/07-workflows/07-04-PLAN.md
  - .planning/phases/07-workflows/07-04-SUMMARY.md
  - .planning/phases/07-workflows/07-05-PLAN.md
  - .planning/phases/07-workflows/07-05-SUMMARY.md
  - .planning/phases/07-workflows/07-06-PLAN.md
  - .planning/phases/07-workflows/07-06-SUMMARY.md
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
covered_digest: "v4:sha256:02fe5bf399fc3e258a031fb8f4f9498ec84531ef7d756bbb7334fd790251ce58"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 7: Workflows Verification Report

**Phase Goal:** With the workflow engine loaded, a bridged workflow is a command that runs and records its arguments and result, a script the engine refuses is reported, the workflows appear when the engine is loaded later, and the plugin lifecycle removes or replaces them.
**Verified:** 2026-11-01
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

The phase made no change under `extensions/`, `test/`, `scripts/`, or `package.json` (`git diff --stat 7aaeb1a^ HEAD` over those paths is empty). It adds the behavioral coverage in `features/`, the step and lib files, and docs. The truths below are therefore behavior-dependent, and each is judged on a scenario that ran against the real bridge and the real engine 3.15.0, not on symbol presence.

I ran `npx cucumber-js features/workflow` myself on HEAD 9920677: 37 scenarios (37 passed), 457 steps (457 passed), 16 hooks (16 passed), seed 159666. This agrees with the orchestrator's recorded gate (`npm run check` 1255/1255; `features/workflow` 37/37 three times).

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With the engine loaded, each bridged workflow is the command `/<plugin>:<meta.name>` with its description (WFL-01) | ✓ VERIFIED | `features/workflow/listing.feature` (4 scenarios): `/demo:hello` / "Says hello."; named by `meta.name` not by file name (`zzz.workflow.js` gives `/demo:greet`); the `<plugin>-` prefix elision is stated as this extension's rule (`demo-audit` gives `/demo:audit`, WNAM-06); a plugin with no workflow adds none. The `Then` reads the registry probe, filters to commands whose path is the engine's entry, and compares command and description row by row. |
| 2 | Running the command completes, and the run's events record the arguments in the engine's shape and the script's result (WFL-02) | ✓ VERIFIED | `features/workflow/run.feature`. The `When` sends the command over RPC and waits for the engine's own terminal progress entry (`pi-dynamic-workflows:progress`). The `Then` compares the last entry's `status`, `resultPreview`, and `error`. Pinned results: `Hello from demo.`; the argument outline `first second who=Ada` gives `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`, no text gives `{"_":"","_raw":""}`, and `a=1 b= =c x=y=z tail` gives `{"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z tail"}`; a throwing script ends `failed` with `Error: Nope.`. The `When` fails on any dialog, extension error, or scripted-model call, and the run's notices are compared too. |
| 3 | Scripts the engine refuses (meta shape, determinism, reserved names) are reported as upstream or as a recorded divergence, and the missing run approval carries an ID (WFL-03) | ✓ VERIFIED | `features/workflow/refusals.feature` (6 `late/reserved/nodesc/mutable/hidden/pair` examples plus 5 scenarios). The nondeterministic (`Date.now()`) and unparseable scripts are refused at install with the file named. The no-`meta` and computed-name scripts are skipped, as Claude Code does. Six caveat scripts install with a note, and running each command shows the engine's own error notice with no run (reserved key `constructor` gives `reserved key name not allowed in meta: constructor`). Docs carry the IDs: D-CF7-01 (no run approval, Pi gap, `docs/workflows-compatibility.md:199`), D-CF7-02 (args shape, line 125), D-CF7-03 (refused at install, line 288), D-CF7-04 (admitted with a note, line 75). The reserved-name reading is `meta` reserved keys (`__proto__`, `constructor`, `prototype`); that is what the engine and the loader refuse. Command names carry a `<plugin>:` prefix and can't collide with Pi reserved commands. |
| 4 | Without the engine, the install shows `{requires pi-dynamic-workflows}` at the decided severity, and loading the engine then `/reload` makes the workflows available with no reinstall (WFL-04) | ✓ VERIFIED (with a recorded deviation, see below) | `features/workflow/companion-missing.feature`. Install without the engine: cascade severity `warning`, row reason `requires pi-dynamic-workflows`, needs reload true (WDEP-02). `list` reports the same reason at `info`. A new session without the engine offers no command matching `hello` from any source. With a settings `packages` entry added after the install and a new session, `/demo:hello` runs to `completed` with `Hello from demo.` with no reinstall. |
| 5 | Disable, uninstall, and update remove or replace the workflow, including the lingering-command notice (WLIF-06) (WFL-05) | ✓ VERIFIED | `features/workflow/lifecycle.feature` (12 scenarios). Uninstall and disable rows carry `stale workflow command` with a `warning` cascade. The lingering command in the same session shows the engine's `... is not available in this project -- reload the session to drop the stale command.` and starts no run. A new session offers none. Enable plus a new session runs it again. An update that keeps the name runs the new script at once (`Hello 2.`), and the same session still lists the old description until a new session. A renaming update reports `stale workflow command`, the old command shows the engine notice, and a new session offers only `/demo:greet`. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### WFL-04: the `/reload` deviation (P7-DC-06 / P7-DC-13)

The requirement says "loading the engine then reloading". The scenario adds the engine to Pi's `<agentDir>/settings.json` `packages` (merging beside the existing `retry` key, failing if `packages` already exists, restoring the exact found text at release) and then starts a new session with RPC `new_session`.

I judge this satisfies the intent. `/reload` over RPC is sent to the model, and a scenario can start one profile Pi only. `startSession` in `features/lib/pi-commands.ts` documents that `new_session` rebuilds the extension runtime and rediscovers resources, which is what `/reload` does. The engine registers saved envelopes on every session start. The scenario proves what the requirement is about: the engine was absent, the plugin was installed once, the engine then loaded in the same Pi process, and the command appeared and ran with no reinstall. The fourth scenario is the negative control: the same flow without the settings step offers no command. Two limits remain. The session starts with reason `new`, not `reload`, and the literal `/reload` builtin is not exercised. Both are logged as open Medium dubious choices for the user's review at merge. They are not a verification gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/workflow/listing.feature` | WFL-01 | ✓ VERIFIED | 80 lines, 4 scenarios, passing |
| `features/workflow/run.feature` | WFL-02 | ✓ VERIFIED | 79 lines, 5 scenarios (outline of 3), passing |
| `features/workflow/refusals.feature` | WFL-03 | ✓ VERIFIED | 205 lines, 11 scenarios (outline of 6), passing |
| `features/workflow/companion-missing.feature` | WFL-04 | ✓ VERIFIED | 72 lines, 4 scenarios, passing |
| `features/workflow/lifecycle.feature` | WFL-05 | ✓ VERIFIED | 176 lines, 12 scenarios, passing |
| `features/step_definitions/workflow/{listing,runs,refusals,companion-missing}.steps.ts` | steps | ✓ VERIFIED | Substantive, no stubs: assertions use `deepStrictEqual` against Pi's records and the engine's progress entries |
| `features/lib/workflow-files.ts` | fixture writer, progress reader, command sender | ✓ VERIFIED | `sendWorkflowCommand` requires `handled`, fails on a dialog, extension error, or model call |
| `docs/workflows-compatibility.md` | D-CF7-01..04 | ✓ VERIFIED | All four IDs present with upstream evidence and the measuring feature file |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `/claude:plugin install` | engine command in `get_commands` | bridge envelope, engine registers on `session_start` | ✓ WIRED (listing and run scenarios pass on a real engine) |
| workflow command | progress entry | engine `appendEntry`, read by `progressOf` | ✓ WIRED |
| uninstall / disable / rename-update | `{stale workflow command}` and the engine's lingering notice | existing WLIF-06 marker | ✓ WIRED |
| install without the engine | `{requires pi-dynamic-workflows}` | existing WDEP-02 marker | ✓ WIRED |

### Data-Flow Trace (Level 4)

Run results are real: `resultPreview` and `error` come from the engine's progress entries after a real script run in the engine's vm realm. Nothing is hardcoded in the steps; expected values are literals in the feature files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Whole workflow behavioral suite | `npx cucumber-js features/workflow` | 37/37 scenarios, 457/457 steps | ✓ PASS |

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

Plan frontmatter IDs: 07-01 [WFL-01, WFL-05], 07-02 [WFL-03], 07-03 [WFL-02], 07-04 [WFL-04], 07-05 [WFL-05], 07-06 [WFL-01..05]. Every ID appears in REQUIREMENTS.md, and REQUIREMENTS.md maps no other ID to Phase 7 (no orphans).

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| WFL-01 | 07-01, 07-06 | command `/<plugin>:<meta.name>` with description | ✓ SATISFIED | `listing.feature` |
| WFL-02 | 07-03, 07-06 | run completes, records args shape (FG-32) and result | ✓ SATISFIED | `run.feature` |
| WFL-03 | 07-02, 07-06 | refusals reported as upstream or divergence, approval ID (FG-31) | ✓ SATISFIED | `refusals.feature`, D-CF7-01/03/04 |
| WFL-04 | 07-04, 07-06 | `{requires pi-dynamic-workflows}` severity; engine later, no reinstall | ✓ SATISFIED (new session stands in for `/reload`) | `companion-missing.feature` |
| WFL-05 | 07-01 (first slice), 07-05, 07-06 | disable, uninstall, update remove or replace; WLIF-06 notice | ✓ SATISFIED | `lifecycle.feature` |

Housekeeping: the REQUIREMENTS.md checkboxes and traceability rows for WFL-01..05 still read `[ ]` / `Pending`. The summaries do not tick them. The parent session folds this in at merge, so I note it only; it is not a goal gap.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, `XXX`, or `TODO` in any phase-modified file. `07-REVIEW.md` is `status: clean` (0 critical, 0 warning, 9 info), and `07-SECURITY.md` reports `threats_open: 0`.

### Human Verification Required

None. No behavior-unverified truths. The `/reload` deviation is logged for the user's merge-time review of dubious choices.

### Gaps Summary

No gaps. Every success criterion is exercised by a passing cucumber scenario against the real extension and engine 3.15.0. A phase with no product change that ships its coverage as scenarios is consistent with AGENTS.md: the "fails without the change" rule applies to a change in user-visible behavior, and there was none. Decision IDs D-CF7-01..04 are present in the compatibility doc.

---

_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
