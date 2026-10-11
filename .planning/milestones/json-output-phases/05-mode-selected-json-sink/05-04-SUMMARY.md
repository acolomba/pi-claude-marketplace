---
phase: 05-mode-selected-json-sink
plan: "04"
subsystem: auth
tags: [notifications, json, rpc, device-flow, credentials]
requires:
  - phase: 05-01
    provides: Required entry sink and live mode selection
  - phase: 05-02
    provides: Parent-run usage delivery and protected formatter provenance
  - phase: 05-03
    provides: Parent-run diagnostic delivery and strict capture validation
provides:
  - All interactive auth carriers forward the parent run to device prompt delivery
  - Stored-only updates retain an absent interactive notification capability
  - Delayed prompt tests prove live selection, credential exclusion, and memo preservation
affects: [05-05, 05-06, 05-07]
actuals:
  tokens: 18752
  tasks: 2
  commits: 2
plan_head_before: 835142e243638e28f6514a9c10f14ed29398c816
plan_head_after: eb7ed820b4b62c5ef6ad6dc7f6c7c053557656f7
tech-stack:
  added: []
  patterns: [Required parent run for interactive auth, Optional paired context/run capability]
key-files:
  created:
    - .planning/phases/05-mode-selected-json-sink/05-04-RED.json
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - tests/orchestrators/auth-host.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/architecture/no-credential-leak.test.ts
key-decisions:
  - Preserve the original run through every interactive auth carrier without reading mode during callback construction.
  - Represent optional update prompting as one complete notification context/run pair.
patterns-established:
  - Device prompts use the existing resolved raw presentation and sole live selector.
requirements-completed: ["JOUT-01", "TENB-01", "MODE-01"]
coverage:
  - id: D1
    description: Auth carriers deliver device prompts through the parent run while stored-only updates cannot prompt.
    requirement: JOUT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/auth-host.test.ts#appends the host-bound device prompt in json
        status: pass
      - kind: other
        ref: npm run check
        status: pass
    human_judgment: false
  - id: D2
    description: Delayed prompts read live mode, retain the original snapshot, preserve host memoization, and exclude credentials.
    requirement: MODE-01
    verification:
      - kind: unit
        ref: tests/orchestrators/auth-host.test.ts#selects the live mode for a delayed prompt and memoizes only the authentication
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#retains a caught invalid device prompt append for final validation
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check
        status: pass
    human_judgment: false
duration: 25min
completed: 2026-10-07
status: complete
---

# Phase 05 Plan 04: Device Authentication Prompt Delivery Summary

**Device-flow prompts now reach JSON/RPC consumers through the original notification run, with stored-only updates and credential boundaries preserved.**

## Performance

- Started: 2026-10-07T12:01:53Z
- Completed: 2026-10-07T12:26:30Z
- Duration: approximately 25 minutes
- Tasks: 2
- Files changed by task commits: 30; summary and validation add two planning files.
- Actual tokens: 75,007 realized task-diff characters / 4, rounded up; not harness usage.
- Runtime: Node `v26.10.0`.

## Accomplishments

- Required the parent run in the device-prompt helper and host/clone auth factories, then threaded it through install, reinstall, dependency tags, fetch, info, update, and marketplace add/update.
- Paired optional update context/run capability, preserving stored-only authentication and skipped interactive tag probing when absent.
- Added machine-mode clone/tag-root tests and delayed callback proof, including complete payload comparison, host memo reuse, unchanged polling, original sink/snapshot identity, and retained invalid capture failures.

## Task Commits

1. **Task 1: Connect all auth carriers to the device-prompt sink** - `dbb9e985c4de2be6da4e6a305d251c910a771780` (`feat`).
2. **Task 2: Prove delayed prompt selection and credential-safe callback content** - `eb7ed820b4b62c5ef6ad6dc7f6c7c053557656f7` (`test`).

Plan metadata is committed separately with this summary and the validation rows.
The measured two commits are the ledger range ending before this metadata commit.

## Files Created/Modified

- `shared/notification-dispatch.ts`: device prompts use `emitPresentation` with explicit two-field projection.
- `orchestrators/auth-host.ts`: required run bound into the existing host callback; no changes to provider selection, memoization, or credential policy.
- Plugin clone/tag probes, fetch/info, install/reinstall/update flows, install ledger/cascade, and enable-disable: forward the existing parent run.
- Marketplace add/update: both host construction arms forward the run.
- Update preflight/constraint gate: optional paired notification capability preserves stored-only branches.
- Mirrored owner tests and auth integration fixture: updated signatures and exact expectations; new JSON/RPC transport cases.
- `tests/architecture/no-credential-leak.test.ts`: exact callback/declaration matches require the new run argument; all credential predicates and reference restrictions retained.
- `05-04-RED.json`: original failing TAP report and semantic assessment.
- `05-VALIDATION.md`: observed results for this plan only.

## Verification

All passing handoff results describe clean task head `eb7ed820b4b62c5ef6ad6dc7f6c7c053557656f7` on Node `v26.10.0`; only planning Markdown follows it.

| Command | Result |
| --- | --- |
| `node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-constraint-gate.test.ts tests/integration/auth-e2e.test.ts` | Exit 0, 145 tests; `/tmp/p05-04-owner2.log` |
| `npm run typecheck` | Exit 0 after all required carriers and fixtures were migrated; `/tmp/p05-04-typecheck3.log` |
| `npm run test:coverage:direct -- $(git diff --name-only -- extensions/)` | Exit 0, all 17 changed source pairs at 100% line/function/branch; `/tmp/p05-04-coverage2.log` |
| `node --test tests/orchestrators/auth-host.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts` | Exit 0, 308 tests; `/tmp/p05-04-task2.log` |
| `node_modules/.bin/fallow review --base 835142e243638e28f6514a9c10f14ed29398c816 --brief` | Exit 0; orientation reviewed, inherited duplication left unchanged |
| `node_modules/.bin/fallow audit --base 835142e243638e28f6514a9c10f14ed29398c816` and Task 2 `--base HEAD` | Exit 0, no new findings; `/tmp/p05-04-audit2.log`, `/tmp/p05-04-task2-audit.log` |
| `SKIP=npm-check pre-commit run --files <task files>` | Final passes exit 0 after formatting; `/tmp/p05-04-fixers3.log`, `/tmp/p05-04-task2-fixers2.log` |
| Task `git commit` commands, with hooks | Both passed `npm run check:commit`; `/tmp/p05-04-commit1-retry.log`, `/tmp/p05-04-commit2.log` |
| `npm run check` | Exit 0; all static, unpaired, integration, and direct-pair checks; merged LCOV 264 records; `/tmp/p05-04-full-check.log` |
| `node scripts/notify-corpus.mjs check > /tmp/p05-04-corpus.log 2>&1` | Exit 0; 3149 baseline entries present, zero extras; 8859 tests passed, zero failed, one pre-existing optional resolver skip |
| Saved-log Node assertions | Exit 0; no lines beginning `missing in ` or `extra in ` and exact 3149/0 success line required |
| `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0, no output |

The direct-coverage command expanded to auth-host, marketplace add/update, dependency-tag-probe, enable-disable, fetch, info, install-cascade, install-clone-probe, install-flow, install-outcome, reinstall-clone-probe, reinstall-flow, update-constraint-gate, update-flow, update-preflight, and notification-dispatch.

Acceptance checks confirmed exactly two `ctx.ui.notify` calls, both in `deliver`; the auth host has no mode read, entry append, or new run construction. The existing formatter-provenance and AUTH-09 tests passed through the hook and full gate. Stored-only cases and both pinned/unpinned probe paths passed.

## TDD Gate Compliance

- RED: the targeted JSON host callback test executed and failed on the planned assertion: expected one complete prompt entry, observed no entries because the old callback attempted UI access. The complete TAP report, exit 1, and semantic assessment are retained in `05-04-RED.json`.
- `node .codex/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence .planning/phases/05-mode-selected-json-sink/05-04-RED.json --raw` returned `RED_EVIDENCE_OK` before implementation and again at close-out.
- GREEN: original-run transport made the test pass. Source and tests were committed together, as explicitly authorized because hooks reject failing commits.
- Task 2 is test-only. Its first run passed because Task 1 already implemented the behavior; no artificial production regression or RED claim was introduced.
- REFACTOR: none required.

## Decisions Made

Followed D-05-04 through D-05-07. No new schema fields, provider behavior, authentication policy, or network policy were introduced.

## Deviations from Plan

**1. [Rule 3 - Blocking] Complete the required-run migration through omitted carriers.**

- Found during Task 1 caller tracing and type checking.
- The plan's file list omitted install-outcome, install-cascade, and enable-disable, which construct or forward the interactive install ledger.
- Added only the required run field and forwarding, plus mirrored fixture and exact auth-object assertion changes.
- Verification: all 17 changed direct pairs reached 100%; type checking, hooks, and full gate passed.
- Commit: `dbb9e985`.

Total deviations: one necessary carrier-inventory correction. The AUTH-09 exact signature retarget was explicitly permitted by the plan and parent; its gate was not weakened.

## Issues Encountered

- Sandboxed Node test execution initially produced an opaque file-level failure, which was not accepted as RED. Required verification and Git commands succeeded through authorized automatic escalation, retaining this worktree's cwd.
- `fallow` was not on PATH; used installed `node_modules/.bin/fallow`. Its base comparison required authorized Git metadata access. No tools or packages were installed.
- Two existing exact auth-object assertions needed the newly required run; updated without dropping fields or predicates.
- First commit attempt failed on import ordering. Fixed those imports and reran fixers and the complete hook; no commit was amended or bypassed.
- GSD's plan-only evaluation-scope query returned no subject-matched commits because project policy forbids phase numbers in commit titles. The explicit `--phase-dir .planning/phases/05-mode-selected-json-sink` query resolved task commits from summaries; an independent assertion confirmed both exact task hashes. Combining `--plan` and `--phase-dir` is unsupported and was rejected without mutations.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Remaining Limitations

- The corpus retains its one pre-existing optional resolver skip; no skip was added.
- Later lifecycle/hook migrations, assumptions, and phase-wide verification remain owned by later plans and the parent.
- Logs under `/tmp` are session-local; committed RED evidence and this summary retain the verification record.
- Shared STATE.md and ROADMAP.md were intentionally left to the parent.

## Next Phase Readiness

Ready for plan 05-05. No blocker remains for this plan.

## Self-Check: PASSED

The summary and RED evidence exist; both task hashes are ancestors of this worktree HEAD. The measured ledger range contains exactly two task commits. Owner tests, acceptance checks, full handoff gate, strict corpus assertions, and catalog equality passed. No new stubs, TODOs, skipped tests, or unintended file deletions were introduced.
