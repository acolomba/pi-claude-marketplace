---
phase: 03-stopfailure-hooks
status: clean
reviewed: 2026-11-08
depth: standard
files_reviewed: 9
findings:
  critical: 0
  warning: 0
  info: 2
---

# Phase 3 Code Review

The phase session wrote this review inline, following `.claude/agents/gsd-code-reviewer.md`, because it cannot dispatch subagents in the foreground. Scope: `git diff a6d7825d..1e61a128`.

Product files:
- `domain/components/hook-events.ts`
- `domain/components/hooks/partition.ts`
- `bridges/hooks/settle.ts`
- `bridges/hooks/payloads/stop-failure.ts`

Test files:
- `hook-events.test.ts`
- `hooks/partition.test.ts`
- `settle.test.ts`
- `payloads/stop-failure.test.ts`

Feature file:
- `features/hook/stop-failure.feature`

Docs:
- `docs/hooks-compatibility.md`

## Checked

- **Matcher parsing (T-3-03).** `stopFailureMatcherTypes` tests one anchored character class (`/^[\w|]+$/`, no `u` flag, so `[A-Za-z0-9_]` plus `|`) and splits on `|`. No `RegExp` is built from plugin text, and it runs in linear time. This matches upstream's `Plt` exact path (`^[a-zA-Z0-9_|]+$`, split on `|`, `.filter(Boolean)`).
- **Admission and dispatch agree (T-3-04).** `partition.ts` admits a list when one listed type is in the vocabulary. `runStopFailure` fires on the shared predicate (match-all, or an exact member) or on list membership. Every matcher admitted at parse time fires on exactly the types it names. A dropped matcher never reaches routing.
- **Other events are unaffected (T-3-05).** The new partition branch runs only for `StopFailure`. `matcherFiresOnClosedSetValue` and `dispatch.ts` are unchanged, and settle still consumes the shared export, so fallow passes. `features/hook/session.feature` passed with the change.
- **Payload.** `last_assistant_message` is optional on both types. `translateStopFailure` spreads it only when present, and the async-rewake registry's use of the translator still compiles (it never runs on StopFailure). Classification still reads the untrimmed `errorMessage`, so the trim cannot change an error type.
- **Tests.** The table-driven rows avoid clone groups, and every new row cites D-BG-302 or D-BG-303. Direct coverage is 100% for the four pairs (`npm run test:coverage:direct`, exit 0).

## Info

- **IN-01.** `runStopFailure`'s filter checks an exact member twice: the shared predicate admits it, and `stopFailureMatcherTypes` also lists it. This is harmless, and it was kept on purpose so that settle remains the production consumer of `matcherFiresOnClosedSetValue` (P3-DC-06).
- **IN-02.** `stopFailureMatcherTypes` returns `readonly string[]`, not `StopFailureErrorType[]`, because a list may name types outside the vocabulary. Callers compare by membership, so no cast is needed.

No fix is required.
