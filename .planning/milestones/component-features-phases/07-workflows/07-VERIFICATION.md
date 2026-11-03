---
phase: 07-workflows
verified: 2026-11-03T12:00:00Z
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
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - features/lib/workflow-files.ts
  - features/step_definitions/workflow/companion-missing.steps.ts
  - features/step_definitions/workflow/listing.steps.ts
  - features/step_definitions/workflow/refusals.steps.ts
  - features/step_definitions/workflow/runs.steps.ts
  - features/step_definitions/workflow/storage.steps.ts
  - features/workflow/collisions.feature
  - features/workflow/companion-missing.feature
  - features/workflow/lifecycle.feature
  - features/workflow/listing.feature
  - features/workflow/refusals.feature
  - features/workflow/run.feature
  - features/workflow/storage.feature
covered_digest: "v4:sha256:847eea8da96bef442842ba8b8aa888baa8139fd7ef8c14d724ca1d3ac8c51407"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 7: Workflows Verification Report

**Phase Goal:** With the workflow engine loaded, a bridged workflow is a command that runs and records its arguments and result, a script the engine refuses is reported, the workflows appear when the engine is loaded later, and the plugin lifecycle removes or replaces them.
**Verified:** 2026-11-03 (first verified 2026-11-01)
**Status:** passed
**Re-verification:** Yes. This run rechecks every criterion at `03f9a45` after the locality redesign moved project workflows into the project (D-LOC-01, c8bf3d2). See "Re-verification 2026-11-03" below.

## Goal Achievement

At phase close, the phase made no change under `extensions/`, `test/`, `scripts/`, or `package.json` (`git diff --stat 7aaeb1a^ HEAD` over those paths was empty). It added behavioral coverage in `features/`, the step and lib files, and docs. The truths below are therefore behavior-dependent. Each is judged on a scenario that ran against the real bridge and the real engine 3.15.0, not on symbol presence. Since then, `bridges/workflows/stage.ts` and `unstage.ts` changed for D-LOC-01 (project scope only), and `collisions.feature` and `storage.feature` were added.

I ran `npx cucumber-js features/workflow` myself at `03f9a45`: 41 scenarios (41 passed), 505 steps (505 passed), seed 716924. The 37 scenarios of 2026-11-01 are still there, unchanged, and pass. The other 4 are `collisions.feature` (2) and `storage.feature` (2).

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With the engine loaded, each bridged workflow is the command `/<plugin>:<meta.name>` with its description (WFL-01) | ✓ VERIFIED | `features/workflow/listing.feature` (4 scenarios, user scope, unchanged): `/demo:hello` / "Says hello."; named by `meta.name`, not by file name (`zzz.workflow.js` gives `/demo:greet`); the `<plugin>-` prefix elision is this extension's rule (`demo-audit` gives `/demo:audit`, WNAM-06); a plugin with no workflow adds none. The `Then` reads the registry probe, filters to commands whose path is the engine's entry, and compares command and description row by row. **Project scope (new):** `storage.feature` "A new session offers the workflow of a project install and runs it" shows a project install's `/demo:hello` is offered and runs from `<cwd>/.pi/workflows/saved/`. |
| 2 | Running the command completes, and the run's events record the arguments in the engine's shape and the script's result (WFL-02) | ✓ VERIFIED | `features/workflow/run.feature` (unchanged). The `When` sends the command over RPC and waits for the engine's own terminal progress entry (`pi-dynamic-workflows:progress`). The `Then` compares the last entry's `status`, `resultPreview`, and `error`. Pinned results: `Hello from demo.`; the argument outline `first second who=Ada` gives `{"who":"Ada","_":"first second","_raw":"first second who=Ada"}`, no text gives `{"_":"","_raw":""}`, and `a=1 b= =c x=y=z tail` gives `{"a":"1","b":"","x":"y=z","_":"=c tail","_raw":"a=1 b= =c x=y=z tail"}`; a throwing script ends `failed` with `Error: Nope.`. The `When` fails on any dialog (now `DIALOG_METHODS` from `features/lib/pi-process.ts`, the same four methods), extension error, or scripted-model call. |
| 3 | Scripts the engine refuses (meta shape, determinism, reserved names) are reported as upstream or as a recorded divergence, and the missing run approval carries an ID (WFL-03) | ✓ VERIFIED | `features/workflow/refusals.feature` (unchanged; 6 `late/reserved/nodesc/mutable/hidden/pair` examples plus 5 scenarios). The nondeterministic (`Date.now()`) and unparseable scripts are refused at install with the file named. The no-`meta` and computed-name scripts are skipped, as Claude Code does. Six caveat scripts install with a note, and running each command shows the engine's own error notice with no run. Docs carry the IDs (lines refreshed): D-CF7-01 (no run approval, Pi gap, `docs/workflows-compatibility.md:200-202`), D-CF7-02 (args shape, `:125`), D-CF7-03 (refused at install, `:301`), D-CF7-04 (admitted with a note, `:75`). |
| 4 | Without the engine, the install shows `{requires pi-dynamic-workflows}` at the decided severity, and loading the engine then `/reload` makes the workflows available with no reinstall (WFL-04) | ✓ VERIFIED (with a recorded deviation, see below) | `features/workflow/companion-missing.feature` (unchanged, user scope). Install without the engine: cascade severity `warning`, row reason `requires pi-dynamic-workflows`, needs reload true (WDEP-02). `list` reports the same reason at `info`. A new session without the engine offers no command matching `hello`. With a settings `packages` entry added after the install and a new session, `/demo:hello` runs to `completed` with `Hello from demo.` with no reinstall. |
| 5 | Disable, uninstall, and update remove or replace the workflow, including the lingering-command notice (WLIF-06) (WFL-05) | ✓ VERIFIED | `features/workflow/lifecycle.feature` (12 scenarios, user scope, unchanged). Uninstall and disable rows carry `stale workflow command` with a `warning` cascade. The lingering command in the same session shows the engine's `... is not available in this project -- reload the session to drop the stale command.` and starts no run. A new session offers none. Enable plus a new session runs it again. An update that keeps the name runs the new script at once (`Hello 2.`). A renaming update reports `stale workflow command`, and a new session offers only `/demo:greet`. **Project scope (new, D-LOC-01):** uninstall, disable, update and reinstall also delete the plugin's own recorded envelopes from the old `~/.pi/workflows/projects/<key>/saved/` location, so an old copy cannot hide the in-project one (`unstage.ts:82`, `stage.ts:569`). This is unit-tested (`test/bridges/workflows/unstage.test.ts:239`, `stage.test.ts:813`) and documented (`docs/workflows-compatibility.md:269`). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### WFL-04: the `/reload` deviation (P7-DC-06 / P7-DC-13)

The requirement says "loading the engine then reloading". The scenario adds the engine to Pi's `<agentDir>/settings.json` `packages` (merging beside the existing `retry` key, failing if `packages` already exists, restoring the exact found text at release) and then starts a new session with RPC `new_session`.

I judge this satisfies the intent. `/reload` over RPC is sent to the model, and a scenario can start one profile Pi only. `startSession` in `features/lib/pi-commands.ts` documents that `new_session` rebuilds the extension runtime and rediscovers resources, which is what `/reload` does. The engine registers saved envelopes on every session start. The scenario proves what the requirement is about: the engine was absent, the plugin was installed once, the engine then loaded in the same Pi process, and the command appeared and ran with no reinstall. The fourth scenario is the negative control: the same flow without the settings step offers no command. Two limits remain. The session starts with reason `new`, not `reload`, and the literal `/reload` builtin is not exercised. Both are logged as Medium dubious choices for the user's review. They are not a verification gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/workflow/listing.feature` | WFL-01 | ✓ VERIFIED | 4 scenarios, passing |
| `features/workflow/run.feature` | WFL-02 | ✓ VERIFIED | 5 scenarios (outline of 3), passing |
| `features/workflow/refusals.feature` | WFL-03 | ✓ VERIFIED | 11 scenarios (outline of 6), passing |
| `features/workflow/companion-missing.feature` | WFL-04 | ✓ VERIFIED | 4 scenarios, passing |
| `features/workflow/lifecycle.feature` | WFL-05 | ✓ VERIFIED | 12 scenarios, passing |
| `features/workflow/storage.feature` | project-scope placement (D-LOC-01, Phase 8) | ✓ VERIFIED | 2 scenarios, passing; supports WFL-01/02 at project scope |
| `features/step_definitions/workflow/{listing,runs,refusals,companion-missing}.steps.ts` | steps | ✓ VERIFIED | Substantive, no stubs: assertions use `deepStrictEqual` against Pi's records and the engine's progress entries |
| `features/lib/workflow-files.ts` | fixture writer, progress reader, command sender | ✓ VERIFIED | `sendWorkflowCommand` requires `handled` and fails on a dialog, extension error, or model call |
| `docs/workflows-compatibility.md` | D-CF7-01..04 | ✓ VERIFIED | All four IDs present with upstream evidence. The project storage section (`:265-269`) matches D-LOC-01. |

`gsd-tools query verify.artifacts` and `verify.key-links` pass for every plan except one artifact of 07-02. Its `contains` pattern `which reported notes on workflow scripts of the plugin` is a step text that ab1a516 reworded before the 2026-11-01 verification. The refusals scenarios pass. This is a stale plan pattern, not a regression.

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `/claude:plugin install` | engine command in `get_commands` | bridge envelope, engine registers on `session_start` | ✓ WIRED (listing, run and storage scenarios pass on a real engine) |
| workflow command | progress entry | engine `appendEntry`, read by `progressOf` | ✓ WIRED |
| uninstall / disable / rename-update | `{stale workflow command}` and the engine's lingering notice | existing WLIF-06 marker | ✓ WIRED |
| install without the engine | `{requires pi-dynamic-workflows}` | existing WDEP-02 marker | ✓ WIRED |
| project install | `<cwd>/.pi/workflows/saved/` | `locationsFor("project").workflowsSavedDir` (`persistence/locations.ts:261`) | ✓ WIRED (`storage.feature` reads the file) |

### Data-Flow Trace (Level 4)

Run results are real: `resultPreview` and `error` come from the engine's progress entries after a real script run in the engine's vm realm. Nothing is hardcoded in the steps. Expected values are literals in the feature files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Whole workflow behavioral suite | `npx cucumber-js features/workflow` | 41/41 scenarios, 505/505 steps (seed 716924) | ✓ PASS |
| Workflow bridge and locations unit tests | `node --test test/bridges/workflows/*.test.ts test/persistence/locations.test.ts` | 127/127 | ✓ PASS |

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts.

### Requirements Coverage

Plan frontmatter IDs: 07-01 [WFL-01, WFL-05], 07-02 [WFL-03], 07-03 [WFL-02], 07-04 [WFL-04], 07-05 [WFL-05], 07-06 [WFL-01..05]. Every ID appears in REQUIREMENTS.md, and REQUIREMENTS.md maps no other ID to Phase 7 (no orphans).

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| WFL-01 | 07-01, 07-06 | command `/<plugin>:<meta.name>` with description | ✓ SATISFIED | `listing.feature`; `storage.feature` at project scope |
| WFL-02 | 07-03, 07-06 | run completes, records args shape (FG-32) and result | ✓ SATISFIED | `run.feature` |
| WFL-03 | 07-02, 07-06 | refusals reported as upstream or divergence, approval ID (FG-31) | ✓ SATISFIED | `refusals.feature`, D-CF7-01/03/04 |
| WFL-04 | 07-04, 07-06 | `{requires pi-dynamic-workflows}` severity; engine later, no reinstall | ✓ SATISFIED (new session stands in for `/reload`) | `companion-missing.feature` |
| WFL-05 | 07-01 (first slice), 07-05, 07-06 | disable, uninstall, update remove or replace; WLIF-06 notice | ✓ SATISFIED | `lifecycle.feature`; old-copy cleanup unit tests at project scope |

The REQUIREMENTS.md checkboxes and traceability rows for WFL-01..05 now read `[x]` (lines 117-121) and `Complete` (lines 212-216). The 2026-11-01 housekeeping note is resolved.

### Anti-Patterns Found

None blocking. No `TBD`, `FIXME`, `XXX`, or `TODO` in any covered file. `07-REVIEW.md` is `status: clean`, and `07-SECURITY.md` reports `threats_open: 0`.

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `.planning/phases/07-workflows/07-02-PLAN.md` | - | Stale artifact pattern (step text reworded by ab1a516) | ℹ️ Info | Checker reports 1/2; the scenarios pass |
| `docs/workflows-compatibility.md` | 267 | A later engine release may drop the in-project saved source that project installs now rely on | ℹ️ Info | Accepted risk of D-LOC-01, tracked as BACKLOG WFLOCAL-01. Not a Phase 7 criterion. |

### Human Verification Required

None. No behavior-unverified truths. The `/reload` deviation is logged for the user's review of dubious choices.

### Gaps Summary

No gaps. Every success criterion is exercised by a passing cucumber scenario against the real extension and engine 3.15.0. Decision IDs D-CF7-01..04 are present in the compatibility doc. The move of project workflows into the project changes where a project install saves its envelopes. It does not change what any Phase 7 criterion asks, and `storage.feature` shows a project workflow is still offered and runs.

## Re-verification 2026-11-03

**What I rechecked:** all five ROADMAP criteria and WFL-01..05 at `03f9a45`. I ran `features/workflow` (41/41) and the workflow bridge and locations unit tests (127/127). I also ran the artifact and key-link checks on all six plans.

**What changed since 2026-11-01:**

- **Project workflows in the project (D-LOC-01, c8bf3d2; amends WPTH-02).** A project install now saves to `<cwd>/.pi/workflows/saved/` and stages under `<cwd>/.pi/pi-claude-marketplace/workflows-staging/`. Before, it used `~/.pi/workflows/projects/<key>/`. Uninstall, disable, update and reinstall remove the plugin's own recorded old copies from that home folder. Every Phase 7 scenario installs at user scope, so none changed meaning. `storage.feature` (Phase 8) adds project-scope evidence for WFL-01/02.
- **`collisions.feature` (added after phase close):** a workflow keeps a name it shares with a command of its plugin. It is outside Phase 7's criteria and passes.
- `features/lib/workflow-files.ts` now imports `DIALOG_METHODS` from `pi-process.ts`. The behavior is the same.
- Docs line references moved: D-CF7-01 `:200-202`, D-CF7-03 `:301`.
- All covered files still exist. Added to `covered_files`: `bridges/workflows/stage.ts`, `bridges/workflows/unstage.ts`, `persistence/locations.ts`, `features/workflow/storage.feature`, `features/workflow/collisions.feature`, `features/step_definitions/workflow/storage.steps.ts`. The digest is recomputed.

**Verdict:** still passed, 5/5. No gap.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
