---
phase: 05-postcompact-hooks
plan: 02
subsystem: hooks
tags: [postcompact, cucumber, docs]
requires: [05-01]
provides:
  - overflow, auto-matcher, and next-turn PostCompact scenarios
  - PostCompact rows of docs/hooks-compatibility.md
affects: [features/hook/compaction.feature, docs/hooks-compatibility.md]
key-files:
  created: []
  modified:
    - features/hook/compaction.feature
    - docs/hooks-compatibility.md
key-decisions:
  - D-BG-505 to D-BG-508 applied as planned
requirements-completed: [PCOMP-01]
duration: ~40 min
completed: 2026-11-08
---

# Phase 5 Plan 02: PostCompact coverage, docs, and parent lines Summary

Scenarios 2, 3, and 6 of D-BG-507 pin the overflow trigger, the auto matcher, and the turn after a compaction; the hooks doc states D-BG-501 to D-BG-504.

## Execution

Executed inline by the phase orchestrator (P5-DC-17). Tasks 1 and 2 share one commit `test(features): pin PostCompact on overflow, auto matcher, next turn`; Task 3 is the docs commit. The scenarios are the plan's, unchanged; `features/hook/compaction.feature` holds six scenarios, none tagged.

Green: `npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature features/hook/session.feature` gave `18 scenarios (18 passed)`, `254 steps (254 passed)`. `npm run check:features` exits 0.

## Red proofs

Each run: `npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature` with one product edit, restored with `git checkout -- <path>` right after; afterwards `git diff --quiet HEAD -- extensions/` exited 0. Script: `/tmp/claude-1000/bg-phase-5/red-0502.sh`.

| Run | Edit | Result |
|-----|------|--------|
| A | `compactTrigger` returns `auto` only for `threshold` (overflow → manual) | `6 scenarios (5 passed, 1 failed)`: "A compaction after a context overflow runs PostCompact with trigger auto" failed at `the hooks record these runs:` |
| B | `compactTrigger` returns `auto` only for `overflow` (threshold → manual) | `6 scenarios (3 passed, 3 failed)`: the seed, scenario 3 (auto matcher), and scenario 5 failed; this is the seed's red proof |
| C | the PostCompact branch of `compositeHandlerFor` also sends the joined lines to the model with `pi?.sendMessage` | `6 scenarios (5 passed, 1 failed)`: scenario 6 failed at `the model receives these calls:`; call 3 gained a message with the three PostCompact lines |

Scenarios 4 and 5 were red before the product change (05-01-SUMMARY).

## Parent lines

1. **`.planning/PROJECT.md` Key Decisions.** One row each, in the shape of the D-BG rows (`| **D-BG-5NN (behavioral-gaps, Phase 5, settled with the recommended answer, pending user review): <title>**. <decision> | <rationale> | -- Pending |`):
   - D-BG-501: after `/compact`, one `hook-notice` at `info` lists how each PostCompact hook ended, `PostCompact [<command>] completed successfully[: <text>]` / `failed[: <text>]`, in routing order (Claude Code 2.1.319 `/compact` output).
   - D-BG-502: after an automatic compaction, PostCompact hooks run and nothing shows (upstream computes the text and never shows it).
   - D-BG-503: the run travels as the optional PostCompact-only field `postCompactRun` of `HookExecResult`, worked out by `postCompactRunOf` at every end of the hook process; `postCompactLineText` words a line, `postCompactNotices` builds the notice.
   - D-BG-504: a line's command is the declared `command` plus exec-form `args` joined by spaces (upstream display command).
   - D-BG-505: every Phase 5 scenario lives in `features/hook/compaction.feature`, untagged; `hook/session.feature` unchanged.
   - D-BG-506: the overflow scenario uses Pi's compact-and-retry path after a `prompt is too long` error, with a prior turn (a probe showed it compacts without it too, P5-DC-14).
   - D-BG-507: the six-scenario set, each with a red proof.
   - D-BG-508: PostCompact-only doc rows; shared sentences and PreCompact parity are parent lines.
   - Amend the D-CF5-24 row: "amended by D-BG-501: a PostCompact block no longer shows as `<label> hook error: <message>`; after `/compact` one notice lists how each PostCompact hook ended, and an automatic compaction shows none (D-BG-502)."
2. **`CHANGELOG.md` `[Unreleased]`**, milestone aggregate sub-bullet: "After `/compact`, PostCompact hooks now show one notice that lists how each hook ended, as Claude Code does. An automatic compaction shows nothing, and a PostCompact block no longer shows as a hook error."
3. **`docs/hooks-compatibility.md`, sentences shared with Phase 6** (line numbers on this branch):
   - Line 237: "On `SessionStart`, `SessionEnd`, and `PostCompact`, which cannot block, the block shows as the event's hook error (D-CF5-24)." becomes "On `SessionStart` and `SessionEnd`, which cannot block, the block shows as the event's hook error (D-CF5-24). On `PostCompact`, the failure shows in the hook's line after `/compact` (D-BG-501)."
   - Line 299: "The same notice kind carries three more notices (D-CF5-24):" becomes "... four more notices (D-CF5-24, D-BG-501):".
   - Line 302: the bullet names only `SessionStart` and `SessionEnd`, and a new bullet follows: "After `/compact`, one notice lists how each `PostCompact` hook ended, one line per hook (see [Compaction](#compaction)). An automatic compaction shows none (D-BG-501, D-BG-502)."
4. **`.planning/BACKLOG.md`**: `## HOOKPRECOMPACT-01: PreCompact output after /compact and as summary instructions` — "Deferred by behavioral-gaps Phase 5 (D-BG-508). Claude Code 2.1.319 uses a PreCompact hook's exit-0 stdout as instructions for the compaction summary, at most 10,000 characters per hook, and after `/compact` shows `PreCompact [<command>] completed successfully: <stdout>` or `PreCompact [<command>] failed: <message>` lines before the PostCompact lines. The bridge does neither. No stream of the behavioral-gaps milestone owns the PreCompact arm."
5. **Frozen `features/lib/upstream/` (optional, P1-DC-32, P5-DC-21).** A projection of Pi's compaction frame (the "The conversation history before this point was compacted into the following summary:" message with `<summary>` tags, and the split-turn frame inside a summary). Until then scenario 6 and the `compact summary` cells of `hook/compaction.feature` and `hook/session.feature` state Pi's wording.
6. **Unowned feature files.** None changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **Tasks 1 and 2 in one commit (Low).** The three scenarios landed together; each still has its own red proof.
- **Red proofs run from one script (Low).** Runs A, B, and C ran back to back from `/tmp/claude-1000/bg-phase-5/red-0502.sh`, each restored by `git checkout` before the next.
