---
phase: quick-261123-gti
verified: 2026-11-23T14:10:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-PLAN.md
  - .planning/quick/261123-gti-hookasyncresume-01-planning-backlog-md-an-async-sessionstart/261123-gti-SUMMARY.md
  - docs/hooks-compatibility.md
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/session-start-context.ts
  - features/hook/async.feature
  - features/step_definitions/hook/async.steps.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/session-start-context.test.ts
covered_digest: "v4:sha256:0dddd91958fb7014e465f303eae04b6cd691d0e906b75ce8c51947b5d17fd277"
behavior_unverified: 0
overrides_applied: 0
---

# Quick 261123-gti: Verification Report

**Goal (HOOKASYNCRESUME-01):** An unchanged async `SessionStart` answer that the conversation already holds is not added to the model's context again on resume, as Claude Code 2.1.295 does.
**Verified:** 2026-11-23 at HEAD 1cd35e7. Commits c099652 (fix) and 146a28b (docs).
**Re-verification:** No

Evidence: code reads, the four unit files run here (`node --import ./scripts/isolated-pi-home.mjs --test`, 616 tests, 616 pass, 0 fail), the upstream binary `/opt/claude-code/bin/claude` (2.1.330), and the executor's logs under `/tmp/claude-0/-home-user-pi-claude-marketplace/36571f01-5770-4f51-bd77-b22d58691339/scratchpad/quick-261123-gti/`. Cucumber and coverage were not rerun.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a continued session, an async SessionStart answer the conversation already holds unchanged gives the model no second copy (scenario call 2 is `first prompt`, `async-ctx`, `Hello.`, `second prompt`, `fresh-ctx`) | VERIFIED | Scenario at `features/hook/async.feature:261`. `R0-adapter.log` (code without the fix): fails at `Then the model receives these calls`, with an extra `async-ctx` row. `green-adapter.log`: `1 scenario (1 passed)`, `18 steps (18 passed)`. `hook-adapter.log`: all `features/hook` pass (315/315). |
| 2 | An answer the conversation does not hold still reaches the model | VERIFIED | The resume-only hook `fresh` gives `fresh-ctx` after `second prompt` in the scenario. `B3-adapter.log` (registry drops every SessionStart answer) fails the same `Then`, so the scenario guards against over-removal. |
| 3 | The check reads the nearest SessionStart context with text (synchronous context or an earlier answer of the same hook), skips other hooks, holds only when that context has every text, and runs for every source | VERIFIED | `asyncAnswerHeld` in `session-start-context.ts`: maps messages to `heldContextOf`, keeps those with no hook (synchronous) or `sameHook` (plugin, marketplace, command), takes `.at(-1)`, returns `texts.every(text => nearest.texts.includes(text))`. Empty `texts` returns false. No source gate in `sendAsyncAnswer`. |
| 4 | The check compares the hook's own texts before the 10,000-character cap, kept whole in `details.values`; no saved-path normalization | VERIFIED | `sendAsyncAnswer` builds `values = answer.map(({ text }) => text)` before `capHookContext`, runs `sessionStartAnswerHeld` before any save (a held answer saves no file), and writes `details` with `values` via `answerDetails`. |
| 5 | The synchronous HKRL-02 check still reads only `claude-hook-additional-context` and keeps its saved-path key; existing cases unchanged | VERIFIED | `event-adapters.ts` diff: `messageKeys` is now `sessionStartValues(message).map(contextKey)`. `sessionStartValues` returns `[]` unless `customType === HOOK_CONTEXT_MESSAGE_TYPE`. `contextKey` stays in `event-adapters.ts`. The four unit files pass 616/616 here. |
| 6 | Other events keep details `{ pluginId, dispatchId }`; an unreadable session holds nothing (debug line); a held answer writes a debug line | VERIFIED | `answerDetails` returns the old shape unless `claudeEvent === "SessionStart"`. `sessionStartAnswerHeld` catches a throw from `buildSessionProjection()`, logs it, returns false. A held answer logs `async-hook: answer not added, the conversation holds its text` and returns before the send. |
| 7 | Red proofs: R0 fails without the fix, B1/B2/B3 each fail the same `Then`, `extensions/` restored clean | VERIFIED (logs) | `R0`, `B1`, `B2`, `B3` logs each `1 scenario (1 failed)`, `exit=1`, `restored=clean`; `red-check.log` and `red-fix.log` print `RED-PROOFS OK`. |

**Score:** 7/7. No behavior-dependent truth is left without a behavioral test (the scenario and the registry unit cases exercise the transition).

## Upstream parity (Claude Code 2.1.295 check)

I read `o0o`, `KDi`, `D7`, and the `CFi` call site in the 2.1.330 binary:

- `o0o(e,o)`: `r=D7(e.response)`; return false when `r` is empty; walk attachments from the newest; skip a hook's attachment when it has a command and is not the same command and pluginId; the first attachment with text decides `r.every(k => h.texts.includes(k))`; a same-hook entry with no text and exit code 0 returns false. The bridge matches this: texts are `systemMessage` then `additionalContext` (`D7`; `asyncAnswerTexts`), empty is never held, synchronous contexts have no command so they count, other hooks are skipped, the nearest context with text decides, all-or-nothing, and no source gate. The call site is `H==="SessionStart"&&o0o(...)`, matching the bridge's `claudeEvent === "SessionStart"` gate. A held answer is not added, as upstream's "Not adding the output ... Claude already sees the same text".
- Upstream's `pluginId` is `<plugin>@<marketplace>`; the bridge stores plugin, marketplace, and command, which is the same identity.
- Upstream reads the uncapped response; the bridge keeps the uncapped texts in `details.values`. No divergence.

Known gaps in `docs/hooks-compatibility.md` (lines 464-470): all three are recorded as bullets. (1) An answer with no text leaves nothing in the conversation, where upstream's same-hook, exit-0, no-text entry stops the walk (the `y&&h.exitCode===0` branch I read). (2) An answer an earlier release added has no `values`, so the first resume after the update adds it once more. (3) The bridge decides when the hook ends, not when the answer is added to the next model call, so it does not compare with an earlier answer still waiting. The three match what I derived from the binary.

## Docs consistency

- Line 464 states the check and the three gaps. The HKRL-02 paragraph at 462 (`ignores the path of a saved file`) covers the synchronous check only and the async paragraph explains why it differs, so there is no contradiction.
- The `async` row at line 364 says the answer reaches the model on its next call and says nothing about the repeat check. It is not wrong. A pointer to the new paragraph would help but is not needed.
- The `SessionStart` row at line 455 (resume or fork sends only new values) is about the synchronous context and stays correct.

## Anti-Patterns

None found. The new leaf is pure; the registry change has no debt markers. A command-less async hook is not storable as an entry, but the hook schema requires `command` for `type: "command"`, so this cannot arise for a dispatched async hook.

## Observations (no gap)

- `CHANGELOG.md` has no entry for this fix. The summary assigns it to the orchestrator ("For the orchestrator"), and AGENTS.md asks for it at PR time. Record it before the PR.
- `BACKLOG.md` and `STATE.md` were updated in 1cd35e7: HOOKASYNCRESUME-01 is struck through as CLOSED.

## Gaps

None.

---

_Verified: 2026-11-23_
_Verifier: Claude (gsd-verifier)_
