---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "04"
subsystem: documentation
tags: [json, jq, invocation, exit-status, architecture-tests]
requires:
  - phase: 06-command-run-contract
    provides: Invocation identity, twelve outcome kinds, and partial-failure semantics
  - phase: 07-mode-refusals-real-pi-verification-and-docs
    provides: Merged mode refusals and real-Pi evidence from plans 07-01 through 07-03
provides:
  - Examples-first JSON guide with a short README link
  - Executable row extraction, severity, exit-policy, and reload snippets
  - Tests that read the actual guide fences and execute them against temporary JSONL captures
affects: [07-05, 07-06, json-output-documentation]
actuals:
  tokens: 6943
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 2fb236102e746b31b29f916fb51e04ad24756764
plan_head_after: b90aff6b46cb4269e495989327f020451d290386
tech-stack:
  added: []
  patterns:
    - Execute labeled documentation fences instead of copying their filters into tests
    - Prepare one validated invocation before separate verdict and reload examples
key-files:
  created:
    - docs/json-output.md
    - tests/architecture/json-output-docs.test.ts
  modified:
    - README.md
key-decisions:
  - Share invocation selection and envelope checks in one documented preparation fence.
  - Print all selected payloads before returning an error status so earlier results remain visible.
  - Distinguish a missing command outcome from an outcome that contains no plugin inventory.
requirements-completed: [JDOC-01, JDOC-02]
coverage:
  - id: D1
    description: The opening headless command, invocation selection, and plugin-row extraction distinguish empty inventory from missing output.
    requirement: JDOC-01
    verification:
      - kind: other
        ref: node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: The actual guide snippets enforce outcome presence, maximum severity, boolean reload, invocation isolation, and visible partial results.
    requirement: JDOC-01
    verification:
      - kind: other
        ref: node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Consumer guidance must not present silence, prompt-only output, or diagnostics as a successful command outcome.
    verification: []
    human_judgment: true
    rationale: "flagged-unverified: the plan declares a descriptor-less judgment; the behavioral tests do not invent or replace its human review."
duration: 17min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 4: Runnable JSON Consumer Guide Summary

**A dedicated guide now extracts plugin rows and computes command verdicts from real jq snippets that preserve partial results and reject missing outcomes.**

## Performance

- Started task execution: 2026-10-10T02:46:00Z.
- Closeout recorded after final verification: 2026-10-10T03:03:03Z.
- Tasks: 2 of 2.
- Task files changed: 3, plus this summary.
- Runtime: Node v26.11.1, jq 1.8.1.
- Actual token scale: ceiling of 27,771 realized task-diff characters divided by four.
- Commit measurement: two task commits between the persisted ledger base and `b90aff6b`; excludes the subsequent summary commit.

## Accomplishments

- The guide opens with `pi -p --mode json --no-session --offline "/claude:plugin list"`, closed stdin, invocation selection, and executable plugin-row extraction. Empty and populated results are stated independently. README adds one guide link.
- The guide separates the Pi event wrapper from `entry.data`, command vocabulary from invocation identity, and script policy from Pi process status. Runtime claims cite the merged 07-03 evidence on Pi 0.86.1 and 0.87.1; this executor did not rerun those runtime tests.
- A shared preparation fence recognizes all twelve outcome kinds and excludes load/hook output and other invocations. It preserves additive fields and unfamiliar kinds without letting them establish an outcome. Unsupported severity, schema version, and nonboolean reload values fail conservatively.
- Separate examples calculate maximum severity, print selected payloads before applying the info/warning/error exit policy, and OR-reduce reload needs. Partial successes remain visible when a later internal error arrives.
- The architecture suite reads the actual labeled Bash fences by repository-relative URL. It runs those fences and their documented preparation with jq against fresh temporary files, with bounded subprocesses and explicit missing-jq/fence failures. Invocation IDs pass through jq arguments, never shell evaluation.

## Task Commits

1. **Run the documented plugin-row extraction:** `a9ca613d` — `docs: add executable JSON plugin-row extraction guide`.
2. **Prove command verdict and partial-failure examples:** `b90aff6b` — `docs: prove JSON command verdict and partial failure examples`.

Both task commits passed Fallow audit, explicit-file fixers, and normal commit hooks. No tracked files were deleted.

## Verification Evidence

All commands ran in the pinned executor worktree. The final dedicated test log is `/tmp/p07-04-final-tests.log`.

| Command or check | Result | Task head |
| --- | --- | --- |
| `node --test tests/architecture/json-output-docs.test.ts` | Exit 0; 5 tests passed after the tracer commit, before expansion | `a9ca613d` |
| `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | Exit 0; 117 passed, 0 failed/cancelled/skipped/todo; 17.37 seconds on the clean committed tree | `b90aff6b` |
| `node_modules/.bin/fallow audit --base HEAD` before each commit | Exit 0; no issues in changed files | Both task trees |
| Explicit-file `SKIP=npm-check pre-commit run --files ...` | Passed after formatter changes were restaged | Both task trees |
| Normal commit hooks, including `npm run check:commit` | Passed; static checks and unpaired tests, with no changed production pair requiring direct coverage | Both task commits |
| Shared tracking, dependency files, corpus baseline, and output catalog compared with `2fb23610` | Empty diff | `b90aff6b` |
| Stub scan and post-commit deletion checks | No stubs, skipped tests, or tracked deletions | `b90aff6b` |

The test matrix covers empty inventories, populated rows, missing output, unrelated events, all twelve outcome kinds, seven non-outcome kinds, unknown kinds, repeated command IDs, both severity orders, warning visibility, partial failure, malformed JSON, additive fields, unsupported closed values, and shell-sensitive invocation IDs.

The parent owns `npm run check` on the combined wave tree and the final corpus gate. These task hooks do not substitute for those checks. No STATE.md, state.json, ROADMAP.md, config.json, requirements tracking, dependency manifest, corpus, or catalog changes were made.

## Decisions Made

The preparation fence is shared by the three verdict examples so each task example stays small. Tests execute the same preparation and task fences without replacing their filters. The opening row extraction remains independently runnable and distinguishes an absent outcome from a known outcome without an inventory.

## Deviations from Plan

None. The implementation follows the approved scope and decisions. The source of the writing skills was resolved to the existing parent skill directory because the worktree lacked those two skill files; only read operations targeted that directory.

## Issues Encountered

- The sandbox denied Node subprocess execution and Fallow's temporary comparison worktree. Authorized escalated reruns passed. No automatic approval rejection occurred.
- The first task's fresh ESLint pass took several minutes. The existing hook process was allowed to finish.
- The second task's initial commit attempt failed on three unsafe JSON parse return types in test callbacks. Explicit `unknown` return types fixed the findings, and the normal retry passed without history rewriting.
- Formatters changed Markdown layout and TypeScript formatting. Their changes were restaged, and explicit-file hooks passed before each commit.

## Known Stubs

None. All task verification commands ran. Empty arrays in examples and tests represent valid empty inventories, not unfinished implementations.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Invocation isolation and outcome/severity checks cover T-07-11. Temporary input files and jq arguments cover T-07-12, including a shell-sensitive value regression. Visible earlier payloads and retained reload truth cover T-07-13. Existing tools satisfy T-07-SC without dependency acquisition.

## User Setup Required

None. The documented examples require the existing Pi installation and jq; jq was available for all tests.

## Next Phase Readiness

Ready for 07-05 to add the full field reference, limitations, and bounded policy corrections. The descriptor-less consumer-guidance prohibition remains flagged-unverified for human review. The parent retains ownership of the combined-tree and corpus gates.

## Self-Check: PASSED

Both created task files and this summary exist. Both task commits are ancestors of HEAD. The final guide/schema suite passes, and the worktree diff has no whitespace errors.
