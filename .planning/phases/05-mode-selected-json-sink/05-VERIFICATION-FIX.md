---
phase: 05-mode-selected-json-sink
gap_id: A-05-01
requirement: MODE-02
fixed_at: 2026-10-07T15:58:23.286Z
source_verification: .planning/phases/05-mode-selected-json-sink/05-VERIFICATION.md
source_head: 95467716
commit: 191f75e83dfa3fc26a43edaee315ce72da831ac2
status: independently_reviewed_pending_phase_verification
---

# Hook Bookkeeping Mode Guard Fix

The A-05-01 verification gap is fixed in commit
`191f75e83dfa3fc26a43edaee315ce72da831ac2`
(`fix(hooks): guard callback bookkeeping before state changes`).
The existing CR-01 fix and its report remain in history.

## Changes

- `event-router.ts` reuses the narrow mode guard, renamed `bindWithMode`,
  for pending-context draining, assistant caching, and the second input
  subscription that resets Stop state. Generation checks still run first.
- `settle.ts` validates the live mode immediately after its generation check,
  before `takeLastAssistant()`. The redundant checks inside the Stop and
  StopFailure branches are removed. Executor calls remain outside the catch.
- No notification run is created for bookkeeping. Stop still creates its
  existing run after validation; its inventory readers already contain their
  own failures.
- The paired tests cover state preservation, successful behavior in all four
  supported modes, live changes to unknown or throwing modes, both seven-entry
  and already-notified eight-entry Stop states, and all seven assistant stop
  reasons.

Files committed:

- `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`
- `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`
- `tests/bridges/hooks/event-router.test.ts`
- `tests/bridges/hooks/settle.test.ts`

## Registered Callback Inventory

All 11 hook bridge registrations were traced from the real factory:

| Registration | Mutation protected | Guard owner |
| --- | --- | --- |
| session_start | Hydration, routing rebuild, shared directories, SessionStart dispatch | Existing startup boundary |
| session_shutdown | Fresh SessionEnd dispatch | bindWithMode |
| session_before_compact | Fresh PreCompact dispatch | bindWithMode |
| session_compact | Fresh PostCompact dispatch | bindWithMode |
| input, first subscription | Fresh UserPromptSubmit dispatch | bindWithMode |
| tool_call | Fresh PreToolUse dispatch | bindWithMode |
| tool_result | Fresh PostToolUse or PostToolUseFailure dispatch | bindWithMode |
| before_agent_start | Pending-context drain | bindWithMode |
| agent_end | Assistant cache replacement | bindWithMode |
| agent_settled | Assistant cache consumption and subsequent Stop/StopFailure work | settleHandlerFor, before takeLastAssistant |
| input, second subscription | Stop-active state, consecutive count, notification latch reset | bindWithMode |

The factory's registration reset, in-memory child shutdown, and orphan reap
remain unchanged. Async terminal-child cleanup remains unchanged. No guard was
added around these cleanup operations. The generation guards and the existing
executor error contract remain intact.

## Verification

All checks ran on Node `v26.10.0` in the isolated worktree
`/home/acolomba/src/pi-claude-marketplace-json/.claude/worktrees/rf-05-hook-state-mode`.
It used an independent copy of the installed dependencies; no package was
installed.

1. RED:
   `node --test --test-reporter=tap --test-name-pattern='preserves .* (when|on)' tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/settle.test.ts`
   exited 1 before production changes. All 54 new regression cases failed.
   One unrelated existing case also matched the filter and passed.
2. GREEN:
   `node --test --test-reporter=tap tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/settle.test.ts`
   exited 0: 205 passed, zero failures, skips, or todo
   (148 event-router tests and 57 settle tests).
3. Modified source and test sections were reread after edits and formatting.
4. `node_modules/.bin/fallow audit --base HEAD --format json --quiet`
   exited 0 against `95467716`: four changed files, zero dead-code,
   complexity, or duplication findings.
5. `SKIP=npm-check pre-commit run --files extensions/pi-claude-marketplace/bridges/hooks/event-router.ts extensions/pi-claude-marketplace/bridges/hooks/settle.ts tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/settle.test.ts`
   passed on the final staged files.
6. The successful foreground `git commit` ran all hooks.
   `npm run check:commit` passed static checks, unpaired tests, and staged
   direct coverage: both modified source/test pairs satisfy 100% line,
   function, and branch coverage. Commit-message hooks also passed.

The parent workflow must run `npm run check` on the combined checkout and
perform independent reverification. A commit-hook pass is not a phase gate.
This report does not overwrite the verifier's verdict or resolve the separate
judgment-tier prohibitions.

### Parent checks and independent review

The parent combined-tree `npm run check` exited 0 at
`191f75e83dfa3fc26a43edaee315ce72da831ac2` on Node `v26.10.0`, with all
264 direct pairs. Log: `/tmp/json-phase5-state-guard-parent-check.log`.
The strict corpus check exited 0 with 3149 baseline entries, zero extras,
and no missing/extra diagnostics; its log is
`/tmp/json-phase5-state-guard-parent-corpus.log`. Catalog and schema match
`26cb0056`. These checks supersede the earlier pre-correction gate.

The independent code reviewer checked all 11 registrations and reran both
owner suites plus hook lifecycle architecture tests successfully. It verified
the mode checks, cleanup independence, generation ordering, and exception
containment when creating the notification run. Its report is clean at this
commit. Phase reverification remains separate.

## Failed Attempts and Corrections

- The first owner-suite run after the fix passed 200 of 205 tests. Five
  existing Stop-cap tests expected ten mode reads; the new check before
  empty-cache consumption makes eleven. Only those expected counts changed.
  The next owner-suite run passed all 205 tests.
- The first fixer preflight formatted the two test files. Its next run passed.
- The first commit attempt passed type checking but failed ESLint on one
  missing blank line and an assigned `Promise<void>` result in the new tests.
  Both were corrected without changing the state assertions. The preflight
  and Fallow audit were rerun, and the next commit passed every hook.
- No hooks were bypassed, no commit was amended, and no history was rewritten.

## Threat Flags

No new security-relevant surface was introduced. The fix closes the remaining
MODE-02 bookkeeping gap and preserves the existing Stop-loop cap and its
one-shot notification latch. Child cleanup, process execution, and disk
containment code are unchanged.

---

_Fixer: gsd-code-fixer_
_Independent verification required for A-05-01 / MODE-02._
