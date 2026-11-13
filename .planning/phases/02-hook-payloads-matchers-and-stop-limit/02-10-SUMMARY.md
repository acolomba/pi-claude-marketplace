---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "10"
subsystem: hooks-documentation
tags: [hooks, payloads, matchers, stop, validation]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Implemented and tested Phase 2 hook translation, matcher and Stop behavior from plans 02-01 through 02-09
provides:
  - Supported hook input, result and replacement contract with explicit Pi limits
  - Accepted D-PG2-01 through D-PG2-12 outcomes and open full-capture backlog
  - Task, threat, probe and combined-tree validation evidence
affects: [hook-authors, phase-verification, HOOKRESULT-01, phase-05]
actuals:
  tokens: 35142
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 278e7ef3cc2b80e42568b890ed1600584bf0bff8
plan_head_after: 9a26a74c4a6f619f788b28c9823fca54b1ecc71b
tech-stack:
  added: []
  patterns: [Scenario-linked compatibility claims, Same-input full-gate reuse for planning-only changes]
key-files:
  created:
    - .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-10-SUMMARY.md
  modified:
    - docs/hooks-compatibility.md
    - docs/research/claude-hook-config-syntax.md
    - docs/research/parity-gaps/hooks.md
    - .planning/PROJECT.md
    - .planning/BACKLOG.md
    - .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-VALIDATION.md
key-decisions:
  - D-PG2-01 through D-PG2-12 were recorded as implemented with their accepted Pi divergences and evidence limits.
  - HOOKRESULT-01 remains open for full execution capture; Phase 5 retains Stop timing and cap environment work.
patterns-established:
  - Compatibility claims cite source owners and concrete real-Pi scenarios while preserving dated research observations.
requirements-completed: [PG-HOOK-01, PG-HOOK-03, PG-HOOK-13]
coverage:
  - id: D1
    description: Current supported hook input, result, matcher and Stop contracts are documented with explicit limits.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature features/hook/tool-failure.feature features/hook/async.feature features/hook/matchers.feature features/hook/prompt-and-stop.feature
        status: pass
      - kind: other
        ref: git diff --check
        status: pass
    human_judgment: true
    rationale: Tests establish behavior; a reader must judge whether prose represents the supported contract clearly.
  - id: D2
    description: Accepted decisions and all task, threat and probe rows are reconciled to actual execution evidence.
    requirement: PG-HOOK-03
    verification:
      - kind: integration
        ref: timeout 2400s npm run check
        status: pass
      - kind: other
        ref: git diff --quiet 043118e0d20044fbe737b25d3fdc10e6d5e2b621 -- . ':(exclude,glob).planning/**/*.md'
        status: pass
    human_judgment: true
    rationale: The automated gate proves code and scenarios; the evidence mapping and deferred scope still require review.
duration: 25min
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 10: Hook Contracts and Validation Summary

**The implemented tool, matcher and Stop contracts are documented with scenario-linked limits, and the combined tree passed its final local gate.**

## Performance

- **Duration:** 25 min (started 2026-11-13T09:54:40Z; task evidence closed 2026-11-13T10:19:48Z)
- **Tasks:** 2
- **Files modified:** 6 documentation files; this summary is the seventh file
- **Measured diff:** 140,570 characters across the six task files, or 35,142 estimate-scale tokens (characters/4 rounded down)

## Accomplishments

- The compatibility guide now explains per-tool input/result/reverse translation, one invocation per Edit pair, original-call fallback, result redaction and missing facts. Dated research records retain their historical observations and point to current implementation evidence.
- PROJECT records D-PG2-01..12 outcomes. HOOKRESULT-01 stays open for execution wrappers or an upstream seam; Phase 1 MCP limits and Phase 5 Stop work remain explicit.
- VALIDATION now reconciles 29 task rows, 27 distinct threat rows and 13 probe truths, with 46 named scenario anchors and real owner/integration evidence. It keeps `nyquist_compliant: false` for the parent verifier.

## Task Commits

1. **Task 1: Document supported hook contracts and precise compatibility limits**: `043118e0d20044fbe737b25d3fdc10e6d5e2b621`
2. **Task 2: Record accepted decisions and seal actual combined-tree validation evidence**: `9a26a74c4a6f619f788b28c9823fca54b1ecc71b`

Both task commits passed normal hooks. The first Task 1 message attempt failed gitlint on a literal newline escape and made no commit; its corrected retry passed. Neither task staged a build input, so the commit hooks correctly skipped `npm run check:commit`. No commit hook was bypassed.

3. **Task 1: Restore the existing prompt context explanation (parent correction)**: `fae378d2b58ea520a6557a61d198c77e71a7d03e`

4. **Task 1: Correct stale MCP matcher and invalid-regex support claims (security audit correction)**: `10750a0ef185082226f11e79d40f5a6140c27580`

- **Task 2: Phase closeout review correction: Clear omitted structured MCP output**: `087cc0718b0839cb5d5c39adac29231d2c227174`
- **Task 2: Phase closeout review correction: Prove same-text MCP redaction in both profiles**: `d893084229f11876c92b4e036a09b112c4002873`
- **Task 2: Phase closeout review correction: Normalize native Glob search roots**: `af1272c8b0a63d4139fb6bb8fe9b405a08b54c02`
- **Task 2: Phase closeout review correction: Preserve original calls after malformed file URL rewrites**: `58895946da7866a44a40b0305e38e3288617d4ba`
- **Task 2: Phase closeout review correction: Keep custom tool identities out of native result codecs**: `cf819853a98b6b8aaaf02ebf48c38e125bda2959`
- **Task 2: Phase closeout review correction: Distinguish regex matchers from MCP if predicates**: `8b5c728d4a397fc084aefe8c5437f4eb43f52099`

## Verification

- **Task 1 focused gate:** `npm run test:cucumber:profile -- --profile adapter features/hook/tool-use.feature features/hook/tool-failure.feature features/hook/async.feature features/hook/matchers.feature features/hook/prompt-and-stop.feature` exited 0 at Task 1 head on Node v26.13.0: 107 scenarios, 1,610 steps, seed 413084, 1m 34.920s wall time. Log: `/tmp/pg2-p10-focused.log`. Its sandbox attempt stopped before scenarios with `spawnSync npm EPERM`; the ordinary-permission rerun supplied the passing result.
- **Full gate:** `timeout 2400s npm run check` exited 0 at clean `043118e0d20044fbe737b25d3fdc10e6d5e2b621`, Node v26.13.0. Started 2026-11-13T10:01:31Z; ended 10:17:58Z (16m 27s). Adapter: 1,867 scenarios/22,776 steps, seed 138606. Built-in: 161 scenarios/2,193 steps, seed 324340. Static, unpaired unit and integration checks passed; merged direct LCOV has 361 records. Log: `/tmp/pg2-p10-check.log`.
- **Exact same-input check after Task 2:** `git diff --binary 043118e0d20044fbe737b25d3fdc10e6d5e2b621 -- . ':(exclude,glob).planning/**/*.md' | sha256sum` returned the empty hash `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`. `git diff --quiet` on the same pathspec exited 0; no untracked executable inputs existed. Task 2 changed planning Markdown only. Thus this full result applies to Task 2's final build inputs under local-verification. The parent still owns the post-merge gate and phase verifier.
- `git diff --check`, pre-commit fixers, and `npx --no fallow audit --base HEAD` passed for each task. Fallow found no issue in the respective three-file task diffs.

## Decisions Made

No new choice was made. The twelve accepted D-PG2 decisions were recorded against their actual outcomes. The intentional unsupported-input original-call fallback remains distinct from explicit denial and conflicting-target blocks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The focused test's first attempt could not start npm in the sandbox (`EPERM`); the same command passed with ordinary host permissions.
- The first Task 1 commit message contained a literal `\\n`, exceeded gitlint's 80-column body limit, and was rejected. The retry used a compliant subject and passed normal hooks.

## Parent Combined-Tree Verification

`npm run check` exited 0 at `fae378d2b58ea520a6557a61d198c77e71a7d03e`, Node v26.13.0: 1867 adapter scenarios / 22776 steps and 161 built-in scenarios / 2193 steps. Merged LCOV: coverage/direct.lcov (361 records). Log: `/tmp/pg2-wave9-check.log`.

The parent verified exact task ancestry, the six declared files plus summary,
a clean handoff and Fallow review. Commit `fae378d2` restores the unrelated
UserPromptSubmit additional-context explanation accidentally replaced by a
checkmark in Task 1. Only that table and its formatter alignment changed;
normal hooks and Fallow audit/review passed. This full gate includes the
restoration. No implementation changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

LS's current upstream schema is unresolved; PowerShell has contract tests but no live executable run; MCP legacy-field intent is ambiguous. Phase 1 ambient child and long-name limits, Phase 5 Stop timing/environment work, and HOOKRESULT-01 complete result capture remain open. This plan is ready for the parent to run the post-merge combined-tree gate and phase verifier; it does not close the phase.

## Self-Check: PASSED

All six declared task files and this summary exist. Both exact task SHAs are ancestors of this branch. The focused and full gates exited 0, all 29 task rows have evidence, and the final build-input diff from the full-gate commit is empty. No shared orchestration artifact was modified.

## Security audit correction

T-02-26 found two stale matcher claims in the compatibility page. Commit `10750a0e` documents whole native regex matching under both MCP profiles and limits regex-related partition drops to invalid syntax. Normal hooks and Fallow audit/review passed; the independent security recheck closed all 27 threats. A fresh combined-tree gate follows code review.

## Code review corrections

The first review found four runtime defects and one documentation inconsistency. Six normal-hook commits fixed all five findings and added owner, installed-runner and real-Pi behavioral regressions. Independent re-review replayed all four counterexamples and returned clean across 72 files. See `02-REVIEW.md` and `02-REVIEW-FIX.md` for exact evidence. The final combined-tree gate passed; see the review-closeout gate below.

## Final review-closeout gate — 2026-11-13

`npm run check` exited **0** on Node v26.13.1 for source commit `d893084229f11876c92b4e036a09b112c4002873`. The 2,400-second bounded run started at 2026-11-13T13:49:46.660374+00:00 and finished at 2026-11-13T14:05:05.098545+00:00 (15m 18s). All static, unpaired-unit and integration checks passed. Adapter: **1,869 scenarios / 22,807 steps** (seed 567364); builtin: **162 scenarios / 2,210 steps** (seed 225284). All **361** direct source/test pairs passed with 100% required coverage. Log: `/tmp/pg2-final-check.log`; proof: `/tmp/pg2-final-gate.json`.

This gate includes all six code-review correction commits and pi-subagents 0.88.1. The four runtime findings have owner and live-Pi behavioral regressions; same-text MCP redaction passes under both profiles. Independent rereview returned clean and refreshed security review closed all 27 threats. No manual verification remains for those findings.

The configured prior-phase regression command is also `npm run check` with a 2,400-second timeout; this exact run covers the 34 prior-phase test files collected in the handoff. Subsequent commits through `06abcab40848ca548196538977ea97432fdc4e01` change only planning Markdown. The exact non-planning diff is empty, Node is unchanged, and no untracked executable input exists. The phase-goal verifier remains the final gate.
