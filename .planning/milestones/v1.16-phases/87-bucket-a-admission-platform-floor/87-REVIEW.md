---
phase: 87-bucket-a-admission-platform-floor
reviewed: 2026-07-30T12:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/shared/concerns/hooks.ts
  - tests/architecture/hooks-supportability.test.ts
  - tests/architecture/hooks-translators.test.ts
  - tests/domain/components/hooks.test.ts
  - tests/domain/resolver-strict.test.ts
  - tests/fixtures/hookify-hooks.json
  - tests/fixtures/hooks-notification-only.json
  - tests/fixtures/hooks-posttooluse-and-notification.json
  - tests/fixtures/ralph-wiggum-hooks.json
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 87: Code Review Report

**Reviewed:** 2026-07-30T12:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 87 promotes `Stop` / `StopFailure` into the bucket-A admission set (8 → 10)
without wiring dispatch, and introduces a decoupled `DISPATCHABLE_EVENTS` subset
(pinned 8) that keys the dispatch / rewake / translator tables. I reviewed the
five source modules plus the test/fixture surface with special attention to the
four risk areas named in the phase brief.

**Correctness of the subset/union relationship — clean.** I traced whether a
`Stop`/`StopFailure` entry can reach a translator table at runtime and blow up.
It cannot:

- Both dispatch index sites (`dispatch-exec.ts::dispatchHookExec` and
  `async-rewake/registry.ts::spawnAndRegister`) call `isDispatchableEvent(...)`
  and early-return before indexing `TRANSLATORS` / `REQUIRED_EVENT_FIELDS`. The
  async-rewake guard is correctly placed inside `spawnAndRegister` so the
  `asyncRewake === true` branch in `dispatchHookExec` (which fires before the
  sync guard) is still covered.
- `isDispatchableEvent` is sound: `DISPATCHABLE_MEMBERS` is derived from
  `DISPATCHABLE_EVENTS`, the same tuple that defines the `DispatchableEvent`
  type predicate target, so runtime membership and the type narrowing cannot
  diverge.
- The `Exclude<DispatchableEvent, "PostToolUse" | "PostToolUseFailure">`
  retype of `compositeHandlerFor` / `adaptForEvent` / `entryFires` (was
  `Exclude<BucketAEvent, ...>`) is load-bearing: had these stayed on
  `BucketAEvent`, the exhaustive switches in `adaptForEvent` / `entryFires`
  would have gone non-exhaustive (Stop/StopFailure uncovered) and `tsc` would
  break. Keeping them on the subset both preserves exhaustiveness and prevents
  Stop/StopFailure from ever being a valid type argument, so no dispatch handler
  can be registered for them. The guards are genuinely defensive/dead paths, as
  documented.

**StopFailure closed-set validation — data is correct and consistent.** The
10-value set in `NON_TOOL_EVENT_CLOSED_SETS.StopFailure` matches the
architecture-test lock exactly; the tables `NON_TOOL_EVENT_FIELDS` (total over
`NonToolEvent`, 7 entries) and `NON_TOOL_EVENT_CLOSED_SETS` (Partial, omits the
two `null`-sentinel events) stay synchronized, and the WR-04 desync test pins
that relationship. Exact whole-string membership (no pipe-splitting) is verified
by `hooks.test.ts` (`rate_limit|server_error` trips `closed-set`).

**Fixtures — valid and provenance-stamped.** All four JSON fixtures parse; the
restored hookify `Stop` arm and the new `ralph-wiggum-hooks.json` (Stop-only,
citing issue #103 and D-87-03) carry provenance in their `description` fields.
The old synthetic Stop fixture (`hooks-stop-only.json`) was deleted and its
former assertions correctly re-pointed to `Notification` (a still-non-bucket-A
event) across `install.test.ts` and `notify-v2.test.ts`; no dangling references
to the deleted fixture remain.

**No runtime version detection** was introduced (D-87-01 declarative floor) in
any reviewed source file.

The issues below are all documentation/comment-policy quality items — no
correctness, security, or data-loss defects were found.

## Warnings

### WR-01: Comment-policy violation — `per 87 research` phase reference introduced this phase

**File:** `extensions/pi-claude-marketplace/domain/components/hook-events.ts:170`
**Issue:** The `StopFailure` docstring added in commit `9ff93e5a` contains
`per 87 research the label is non-load-bearing`. `.claude/rules/typescript-comments.md`
forbids bare phase references (`Phase NN` / bare `NN` citing per-phase RESEARCH
docs); the rule's intent is that comments must not record which planning artefact
authored a line. This is newly introduced by Phase 87 (the same edit correctly
*removed* a pre-existing `Pitfall:` reference a few lines down, so the policy is
clearly in force). A pre-commit hook enforcing the policy could red-fail on this
line.
**Fix:** Drop the planning-artefact citation; keep the `[ASSUMED]` marker and the
mechanism rationale, which already carry the anchor:
```ts
 * [ASSUMED -- field-name label] the `"error"` label names the
 * Claude-side matcher target field; the label is non-load-bearing (the
 * gate compares the raw matcher string to the closed set regardless of the
 * label), and field-name confirmation against the upstream contract is
 * deferred. What is load-bearing is the closed set in
 * `NON_TOOL_EVENT_CLOSED_SETS.StopFailure` below.
```

## Info

### IN-01: Stale block-comment says "8-event tuple" after the set grew to 10

**File:** `tests/architecture/hooks-supportability.test.ts:39`
**Issue:** The same edit that updated the file header to "exactly the 10
documented events" and renamed the test to `... is exactly the 10 documented
events ...` left the section banner reading `// Block 1: TOOL-02 bucket-A
8-event tuple (D-58-06)`. The "8-event" count is now wrong and contradicts the
assertion directly below it.
**Fix:** Update the banner to `// Block 1: ADMIT-01 bucket-A 10-event tuple
(D-58-06)` (or drop the count).

### IN-02: WR-04 synchrony test comment claims "compile time" but it is a runtime assertion

**File:** `tests/architecture/hooks-supportability.test.ts:200-202`
**Issue:** The comment states a missing closed-set entry "would cause
`tryNonToolEventTrip` to fall into the WR-04 'missing entry' branch at runtime;
this test red-fails CI **at compile time** instead." The test is a `node:test`
runtime assertion iterating `Object.entries(NON_TOOL_EVENT_FIELDS)`, not a
compile-time check (`NON_TOOL_EVENT_CLOSED_SETS` is `Partial<...>`, so its
synchrony with the total `NON_TOOL_EVENT_FIELDS` is *not* type-enforced — which
is exactly why this runtime test exists). The "compile time" claim mis-describes
the guard.
**Fix:** Change "red-fails CI at compile time instead" to "red-fails CI at test
time instead" (or "before the runtime branch can be hit").

### IN-03: Pre-existing GSD milestone-version references remain in reviewed files

**File:** `extensions/pi-claude-marketplace/domain/components/hook-events.ts:188,205-206,241`; `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:579`
**Issue:** Several comments reference GSD milestone labels (`under v1.13`,
`v1.14+ may relax`). Per the repo convention, `v1.x` labels are GSD milestone
numbers (npm releases are `0.x.y`), so these read as milestone references the
comment policy discourages. They were **not** introduced by Phase 87 (they
predate this change and sit in unmodified context), so this is flagged only for
awareness, not as a Phase 87 regression. Note the same class of pre-existing
refs also exists in the test surface (`install.test.ts` "Phase 65/69 gates",
"dead under v1.13"; `notify-v2.test.ts` "in v1.13").
**Fix:** Out of surgical scope for this phase; address in a dedicated
comment-hygiene pass if/when these lines are next touched.

### IN-04: StopFailure error-type vocabulary and `"error"` field label are explicitly unverified against upstream

**File:** `extensions/pi-claude-marketplace/domain/components/hook-events.ts:169-174,253-264`
**Issue:** The 10-value closed set and the `NON_TOOL_EVENT_FIELDS.StopFailure =
"error"` label are marked `[ASSUMED]` with upstream confirmation deferred. If the
real Claude `StopFailure`/`stopReason` vocabulary differs, every StopFailure
matcher would be classified wrong (an admissible value dropped as `closed-set`,
or vice versa). The architecture test locks the assumed set, so a future upstream
correction must update both the source and the test. This is a documented,
accepted deferral rather than a defect — recorded here so it is not lost.
**Fix:** No change required now; verify the vocabulary against the upstream
contract before dispatch is wired (Phase 88) and update the set + lock test
together if it diverges.

---

_Reviewed: 2026-07-30T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
