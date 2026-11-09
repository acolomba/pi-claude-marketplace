---
phase: 14-bootstrap
plan: 01
subsystem: testing
tags: [cucumber, bootstrap, state-lock, json-mode, terminal, usage-error]
status: complete

requires:
  - phase: 01-foundation
    provides: "the json-mode and terminal drivers and steps (D-BG-09), the lock-holder helper, and the two bootstrap seeds"
provides:
  - "BOOT-02: an RPC scenario and a json-mode scenario for a first bootstrap under another process's user-scope state lock"
  - "BOOT-01: the --scope refusal in json mode and in the terminal, and the refusal outline proving that every refusal changes nothing"
affects: [behavioral-gaps merge of Phase 14, Phase 15 marketplace state lock (same lock-held row shape)]

actuals:
  tokens: 5200
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A refusal scenario publishes the stand-in source first, so its no-change steps fail for a command that did not refuse"
    - "A red proof that must reach steps after a result table runs the forbidden work silently (its run's entry sink drops the payloads), so the result still matches and the later steps catch it"

key-files:
  created:
    - .planning/phases/14-bootstrap/14-01-SUMMARY.md
  modified:
    - features/plugin/bootstrap.feature

key-decisions:
  - "The plan ran inline in the child session, not in a gsd-executor subagent: the agent isolation guard reads its sentinel from the session's checkout, not from the phase worktree"
  - "No product change: every scenario passed on the unchanged product, and the lock-held row naming the typed source is marketplace add's contract (D-BG-1406)"

patterns-established:
  - "Lock-held bootstrap rows: `anthropics/claude-plugins-official` as marketplace name, id, and name, with reason `lock held` and the `{agent dir}` cause chain"

requirements-completed: [BOOT-01, BOOT-02]

coverage:
  - id: D1
    description: "A first bootstrap under a held user-scope lock fails as lock held and records nothing, over RPC"
    requirement: "BOOT-02"
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping while another process holds the user scope's state lock fails as lock held and records nothing"
        status: pass
  - id: D2
    description: "The same held-lock failure in json mode carries the RPC rows"
    requirement: "BOOT-02"
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping in json mode while another process holds the user scope's state lock reports the failure it reports over rpc"
        status: pass
  - id: D3
    description: "The --scope refusal in json mode and in the terminal carries the RPC outcome and changes nothing"
    requirement: "BOOT-01"
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping with the user scope in json mode reports the refusal it reports over rpc"
        status: pass
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrapping with the user scope in the terminal shows the refusal it reports over rpc"
        status: pass
  - id: D4
    description: "Every refusal row refuses with its usage and changes nothing"
    requirement: "BOOT-01"
    verification:
      - kind: e2e
        ref: "features/plugin/bootstrap.feature#Bootstrap rejects <rejected> with its usage and changes nothing"
        status: pass
---

# Phase 14 Plan 01: Bootstrap coverage scenarios Summary

**`plugin/bootstrap.feature` now covers three things. Bootstrap refuses `--scope` and any argument, and a refusal changes nothing. The refused and lock-held outcomes are the same over RPC, in json mode, and in the terminal. A first bootstrap under another process's user-scope lock fails as lock held and records nothing. There is no product change.**

## Performance

- Tasks: 3, plus the SUMMARY
- Files modified: 1 (`features/plugin/bootstrap.feature`), and this SUMMARY
- Scenario count: 14 at the start, 15 after Task 1, 18 after Task 2. Task 3 changed the outline without adding a scenario.

## Accomplishments

- BOOT-02 over RPC and in json mode: the bootstrap reports one `cascade` result at `error` severity, with the summary `Some operations have failed.`. The failed row names `anthropics/claude-plugins-official` with the reason `lock held` and the `{agent dir}` cause chain. The run leaves no user `claude-plugins.json`, no marketplace checkout, no git clone, and no git request.
- BOOT-01: the `--scope user` refusal shows the same usage-error fields in json mode as the RPC outline row. In the terminal it shows the whole notice. Neither run changes anything.
- BOOT-01: the refusal outline is now titled "Bootstrap rejects <rejected> with its usage and changes nothing". It publishes the official marketplace first, and all seven rows assert that nothing changed.

## Task Commits

1. Task 1: `36eb1df4` test(features): pin bootstrap under a held state lock
2. Task 2: `4157d3ba` test(features): compare bootstrap outcomes across output modes
3. Task 3: `1d6d84e1` test(features): prove a refused bootstrap changes nothing
4. This SUMMARY: docs(planning): summarize the bootstrap coverage

## Scenarios (final titles)

- New: Bootstrapping while another process holds the user scope's state lock fails as lock held and records nothing
- New: Bootstrapping in json mode while another process holds the user scope's state lock reports the failure it reports over rpc
- New: Bootstrapping with the user scope in json mode reports the refusal it reports over rpc
- New: Bootstrapping with the user scope in the terminal shows the refusal it reports over rpc
- Changed: the outline "Bootstrap rejects <rejected> with its usage and changes nothing". It gains one Given and four no-change Thens. Its seven Examples rows are unchanged.
- Unchanged: the two Phase 14 seeds (json mode and terminal), checked byte for byte against `09414ebc`.

## Red Proofs

Each mutation was local and temporary. Each was restored with `git checkout -- <file>`, and afterwards `git status --short -- extensions` printed nothing. No mutation was staged.

| Proof | Mutation | Scenarios | Result |
| --- | --- | --- | --- |
| Task 1, M3 | In `transaction/with-state-guard.ts` (frozen; local proof only), `acquireStateLock` returns a no-op held lock on `ELOCKED` instead of throwing `StateLockHeldError` | RPC lock-held | Exit 1. Fails at `Then the command reports these results:` (actual `info` cascade with no summary) |
| Task 2, M3 | same | json lock-held | Exit 1. Fails at `Then the command reports these results:` (actual `info` cascade) |
| Task 2, M2 | In `edge/handlers/plugin/bootstrap.ts`, the `parsed.scope` refusal block is deleted | json and terminal `--scope` refusals | Exit 1, 2 of 2 fail. The json scenario fails at `Then the result has these fields:` (`cascade` instead of `usage-error`). The terminal scenario fails at `Then pi's terminal shows this result of the command:`, and the screen shows the `(added)` row |
| Task 3, M1 | The handler first awaits `bootstrapClaudePlugin` with a run whose `entrySink.appendEntry` does nothing, then checks its arguments | 7 outline rows and both refusal scenarios | Exit 1, 9 of 9 fail at `Then the "claude-plugins.json" file of the user scope does not exist`. The usage-error step and the terminal notice step still passed |

Rerun note: the first Task 1 red run went to the unmutated file, because the Edit tool refused an unread file. The scenario passed (exit 0), and that run does not count as a proof. The proof was rerun after the mutation was really applied. No scenario needed a load rerun. Every green run passed the first time: `15 scenarios (15 passed)`, then `18 (18 passed)` twice, with 152 steps and then 187 steps.

## Verification

- `npx cucumber-js --profile adapter features/plugin/bootstrap.feature --parallel 3 --format progress`: exit 0, `18 scenarios (18 passed)`, `187 steps (187 passed)`.
- `npm run check:features`: exit 0 after each task.
- Guards:
  - Examples rows and both seeds are identical to `09414ebc`.
  - 0 tag lines.
  - `features/step_definitions/plugin/bootstrap.steps.ts` is absent.
  - Counts: 12 official-marketplace Givens, 2 terminal Whens, 3 json-mode Whens, 1 outline, and 2 lock Givens.
- Home and process checks:
  - `find /home/acolomba/.pi -newer <run-start marker>` printed nothing.
  - `pgrep -af .../features/lib/state-lock-holder` matched only its own shell, so no helper was left.
- The commit hook ran `npm run check:commit` on each feature-file commit, and it passed.
- The wave gate, which runs every part of `npm run check`, is the orchestrator's job.

## Decisions Made

- The plan ran inline in the child session. A `gsd-executor` dispatch was refused by the agent isolation guard. The guard resolves `.gsd/dispatch-isolation-sentinel.json` under the session cwd, which is the parent checkout, and not under the phase worktree where the sentinel was forced. The workflow's documented fallback is inline execution, so the plan ran inline.

## Deviations from Plan

- The plan's executor was a subagent; the orchestrator ran it inline instead, for the reason above. The tasks, mutations, and commits otherwise follow the plan.
- The plan named a `pgrep -af ...state-lock-holder` check that should print nothing. It printed only its own invoking shell, so no helper process was found.

## Issues Encountered

- The scratchpad directory is shared with the sibling child sessions. A context commit made before this plan picked up a sibling's commit message (P14-DC-04). This plan's commit messages used unique `p14-exec-` files, and each message was checked with `git log -1`.

## Known Stubs

None.

## Threat Flags

None. No security-relevant surface outside the plan's `<threat_model>` was introduced. The two mutations of product files were restored before each commit, and every commit holds only `features/plugin/bootstrap.feature` or this SUMMARY.

## Dubious Choices

1. (Medium) The plan ran inline in the orchestrator, not in a `gsd-executor` subagent, because the isolation guard reads the sentinel from the session's checkout (parent) and not from the phase worktree. Writing that sentinel into the parent checkout was not allowed.
2. (Low) The `pgrep` check named in the plan matches its own invoking shell, because the pattern appears in the command line. The check was read as "no helper process", since the only hit was the check itself.

## Parent lines

- `.planning/PROJECT.md` Key Decisions: add rows D-BG-1401 to D-BG-1410 in the form of the D-BG-01 row, as "(behavioral-gaps, Phase 14, settled with the recommended answer, pending user review)" with outcome "-- Pending". The text of each row is in `.planning/phases/14-bootstrap/14-CONTEXT.md`, under `<decisions>`.
- `CHANGELOG.md`: None. No user-visible behavior changed; the phase adds tests only.
- `README.md`, `README.es.md`, `.planning/BACKLOG.md`: None.
- Frozen files: None. The two mutations of `transaction/with-state-guard.ts` were red proofs only, and each was restored.
- Unowned feature files whose rows changed: None.

## User Setup Required

None.

## Next Phase Readiness

The wave gate and the phase gate run next: the parts of `npm run check`, then the full `npm run check` and `npm run test:modules`.

## Self-Check: PASSED
