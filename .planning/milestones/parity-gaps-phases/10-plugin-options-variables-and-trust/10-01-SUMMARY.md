---
phase: 10-plugin-options-variables-and-trust
plan: "01"
subsystem: behavioral-harness
status: complete
tags: [cucumber, harness, project-trust, plugin-path]
requires: []
provides:
  - "Given: the published plugin {string} of the marketplace {string} has the executable file {string} with this text:"
  - "Given: pi runs with the scripted model in a project the user marked \"do not trust\""
  - "PiProfile.trust value \"refused\" (saves false in trust.json)"
  - "features/plugin/executables.feature with two guard scenarios"
affects: [10-04]
tech-stack:
  added: []
  patterns: ["one trust.json writer that takes the decision", "executable publishing step refuses a git publication"]
key-files:
  created:
    - features/plugin/executables.feature
  modified:
    - features/step_definitions/plugin/publishing.steps.ts
    - features/support/world.ts
    - features/step_definitions/model.steps.ts
decisions:
  - "The \"do not trust\" start keeps the single PROFILE_PI_START_TIMEOUT_MS budget: the folder holds no Pi trust-requiring resource, so Pi loads the extensions once (measured 13.2 s of 90 s)."
  - "The generic file Given and the executable-file Given share one private writer, writePluginText, so fallow dupes sees no clone."
metrics:
  duration: "~35 min"
  completed: 2026-11-14
actuals:
  tokens: 3094
  tasks: 2
  commits: 2
plan_head_before: c888a7ceadd596a98093506208425c165c09faa2
plan_head_after: 3cd1ff21
---

# Phase 10 Plan 01: Executable plugin file and "Do not trust" profile Summary

Two harness additions and two guard scenarios: a publishing step that writes a plugin file with mode 0755, and a profile Pi that starts with `false` saved for the project in `trust.json`. The measured stop gate passes: Pi does not trust a project the user marked "Do not trust", even when the folder holds only this extension's files.

## Stop gate (for plan 10-04)

**Pi does NOT trust the project.** In the new profile, with no `the project holds a pi settings file` step, a project-scope plugin with a recording `PreToolUse`/`Bash` hook, a new session, and one prompt whose model runs `echo from-model`, `Then the hooks record no runs` passed (exit 0, 1 scenario passed, 14 steps passed). A control run of the same scenario with the default trusted profile failed at `Then the hooks record no runs` because the hook recorded a `PreToolUse` run, so the measurement can tell the two apart. Plan 10-04 may proceed with this profile. Both temporary feature files were deleted and never committed.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Publish an executable plugin file; bash finds it in a trusted project | d7c4be27 | publishing.steps.ts, executables.feature |
| 2 | Start Pi in a "Do not trust" project; a user-scope plugin's executable is still found | 3cd1ff21 | world.ts, model.steps.ts, executables.feature |

## Fail-then-green runs

Task 1, "The bash tool finds the executable of an enabled project plugin in a trusted project":
- Green on today's code: 1 scenario (1 passed), 13 steps (13 passed).
- Red: a temporary early `return dirs;` at the top of `collectBinDirs` in `extensions/pi-claude-marketplace/orchestrators/plugin-path.ts`. The scenario failed at `Then the model receives these calls:` (`model.steps.ts`), with the actual tool result `bash returned: absent\n`. 1 scenario (1 failed), 13 steps (12 passed, 1 failed).
- Restored with `git checkout -- extensions/pi-claude-marketplace/orchestrators/plugin-path.ts`; green again (1 passed). `git diff --quiet HEAD -- extensions` exited 0.

Task 2, "The bash tool finds the executable of a user-scope plugin in a project the user marked do not trust (D-PG10-02)":
- Green on today's code: 1 scenario (1 passed), 13 steps (13 passed).
- Red: the `user` row removed from `scopeRoots` in `recomputePluginPath`. Failed at `Then the model receives these calls:` with `bash returned: absent\n`. 1 scenario (1 failed), 13 steps (12 passed, 1 failed).
- Restored with `git checkout`; the combined verify run below is green.

## Verification

- `npx cucumber-js --profile adapter --name "The bash tool finds the executable of an enabled project plugin in a trusted project" features/plugin/executables.feature`: 1 scenario (1 passed).
- `npm run test:cucumber:profile -- --profile adapter features/plugin/executables.feature features/plugin/project-trust.feature`: 9 scenarios (9 passed), 149 steps (149 passed), exit 0.
- `npm run check:features`: exit 0, no "Feature gate failed" (run after each task).
- `git diff --quiet HEAD -- extensions && test -z "$(git ls-files --others --exclude-standard -- features)"`: exit 0.
- `npx tsc --noEmit -p .` and `npx eslint` on the three changed `.ts` files: exit 0.
- Both commits passed the hook, including `npm run check:commit`.
- `features/plugin/project-trust.feature` is unchanged since PLAN_BASE `c888a7ce`.

## Measured start timeout

The new Given took 13,218.72 ms in the measurement run (cucumber `usage` formatter). The folder holds no Pi trust-requiring resource (`.pi/settings.json`, `extensions`, `skills`, and so on), so Pi 1.5.0 reads the saved decision directly and loads the extensions once. The step keeps `PROFILE_PI_START_TIMEOUT_MS` (90 s), not the doubled budget of the untrusted Given.

## Lines for later plans

Executable-file step (`features/step_definitions/plugin/publishing.steps.ts`):

```gherkin
Given the published plugin "<plugin>" of the marketplace "<name>" has the executable file "bin/hello" with this text:
  """
  #!/bin/sh
  echo greeted
  """
```

Step definition text: `the published plugin {string} of the marketplace {string} has the executable file {string} with this text:`. It refuses a publication that is not `dir` or `file`.

"Do not trust" profile step (`features/step_definitions/model.steps.ts`):

```gherkin
Given pi runs with the scripted model in a project the user marked "do not trust"
```

The profile value is `trust: "refused"` in `PiProfile` (`features/support/world.ts`); the single writer is `saveSandboxTrust(trusted: boolean)`.

Bash row and calls table of both scenarios:

```gherkin
    Given the scripted model plays these steps:
      | reply | tool | arguments                                                                       |
      |       | bash | {"command": "if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | Done. |      |                                                                                 |
    When the user prompts "run hello"
    Then the model receives these calls:
      | call | role        | text                                                                                          |
      | 1    | user        | run hello                                                                                     |
      | 2    | user        | run hello                                                                                     |
      | 2    | assistant   | tool call bash {"command":"if command -v hello >/dev/null; then hello; else echo absent; fi"} |
      | 2    | tool result | bash returned: greeted\n                                                                      |
```

Under the red edit the last row reads `bash returned: absent\n`.

## Parent-owned lines

The parent may record these; this plan did not touch them.

- `10-VALIDATION.md`, Wave 0: both harness gaps closed — "the 'Do not trust' profile step (`trust: \"refused\"`, `Given pi runs with the scripted model in a project the user marked \"do not trust\"`)" and "the executable-file publishing step (`... has the executable file {string} with this text:`)".
- `10-VALIDATION.md`, guards: "features/plugin/executables.feature: 'The bash tool finds the executable of an enabled project plugin in a trusted project' (PG-CORE-06 guard) and 'The bash tool finds the executable of a user-scope plugin in a project the user marked do not trust (D-PG10-02)' — both pass on today's code, both shown red."
- STATE.md decision: "The 'do not trust' profile start keeps the single 90 s start budget: a folder with no Pi trust-requiring resource loads extensions once (measured 13.2 s)."
- STATE.md / plan 10-04 note: "Stop gate passed: with `false` saved in trust.json, Pi answers not trusted for a folder holding only this extension's files; a project-scope recording hook recorded no run."
- Requirements PG-CORE-06 and PG-CORE-07: harness and guard only; the behavior lands in plan 10-04, so do not mark them complete yet.

## Deviations from Plan

None in scope. One addition: the stop-gate measurement also ran a trusted control (the same temporary scenario with the default profile), which failed as expected, to show the "no runs" result is not vacuous. No file under `features/lib/` or `extensions/` changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-01: the writer joins `sandbox.agentDir` only, opens with flag `wx`, and reads the text back. T-10-02: both guards were run red and green. T-10-SC: no package installed or changed.

## Self-Check: PASSED

- FOUND: features/plugin/executables.feature
- FOUND: d7c4be27, 3cd1ff21 (ancestors of HEAD)
