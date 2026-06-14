---
phase: 58-matcher-parser-tool-name-mapping-supportability-gate
plan: 02
subsystem: domain/components/hooks
tags: [hooks, events, closed-set, supportability, typebox]
requirements: [TOOL-02]
dependency_graph:
  requires:
    - 58-01 (TOOL-01 tool-name map sibling pattern)
    - 57-04 (architecture-test pattern via hooks-foundation.test.ts)
  provides:
    - "Bucket-A 8-event closed-set tuple + tool-event 3-tuple subset"
    - "Per-non-tool-event Claude-side matcher target field map"
    - "Per-non-tool-event Claude-side admissible-value closed sets"
    - "Architecture-test scaffold locking the four contracts above"
  affects:
    - Plan 58-03 will read all four exports inside `checkMatcherSupportability`
      to trip TOOL-02 for: non-bucket-A event keys, non-tool-event matcher
      values outside the per-event closed set, and any UserPromptSubmit
      non-empty matcher.
tech_stack:
  added: []
  patterns:
    - "`as const` tuple + `(typeof X)[number]` literal-union derive"
    - "`Readonly<Partial<Record<K, V>>>` for per-event lookup tables"
    - "`ReadonlySet<string>` for closed value sets (no `as const` on Set)"
    - "JSDoc table block in module header citing Pi peer-dep field shapes"
key_files:
  created:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - tests/architecture/hooks-supportability.test.ts
  modified: []
decisions:
  - "D-58-06 strict-supportability stance locked into closed-set tables:
    SessionStart admits only {startup, resume} (no `clear` / `compact`
    Pi analog); SessionEnd / PreCompact / PostCompact are empty sets
    under v1.13; UserPromptSubmit has no entry (null sentinel in
    NON_TOOL_EVENT_FIELDS marks no-upstream-matcher-support)."
  - "Per-event field map uses `Readonly<Partial<Record<BucketAEvent,
    string | null>>>` rather than `Record<NonToolEvent, ...>` so the
    UserPromptSubmit null sentinel can coexist with the four field-bearing
    events under a single discriminator."
metrics:
  duration: "~14 minutes"
  tasks: 2
  files: 2
  completed: 2026-06-14
---

# Phase 58 Plan 02: Bucket-A event closed-set + non-tool-event matcher tables Summary

Shipped `domain/components/hook-events.ts` (4 exports + 2 derived types) and
the paired architecture-test scaffold at
`tests/architecture/hooks-supportability.test.ts` (5 passing
ID-prefixed invariants + a Plan 03 extension marker) -- the source-of-truth
tables Plan 03's `checkMatcherSupportability` reads to trip TOOL-02 on
non-bucket-A event keys, non-tool-event matcher values outside the
per-event admissible set, or any UserPromptSubmit non-empty matcher.

## Objective

Ship the bucket-A 8-event closed-set tuple, the tool-event 3-tuple subset,
the per-non-tool-event field-name map, and the per-event admissible-value
closed sets (D-58-06 strict-supportability stance), plus the paired
architecture-test gate locking them all. Sibling to Plan 58-01's
`hook-tool-names.ts`. Plan 58-03 consumes both at parse time inside the
matcher parser + TOOL-02 supportability gate.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create `hook-events.ts` with BUCKET_A_EVENTS + TOOL_EVENTS + NON_TOOL_EVENT_FIELDS + NON_TOOL_EVENT_CLOSED_SETS | `a403ca5` | `extensions/pi-claude-marketplace/domain/components/hook-events.ts` |
| 2 | Scaffold `hooks-supportability.test.ts` with TOOL-02 / D-58-06 closed-set deepEqual invariants | `1833528` | `tests/architecture/hooks-supportability.test.ts` |

## What Was Built

### `extensions/pi-claude-marketplace/domain/components/hook-events.ts` (NEW, 145 lines)

- **`BUCKET_A_EVENTS`** -- `readonly ["SessionStart", "UserPromptSubmit",
  "PreToolUse", "PostToolUse", "PostToolUseFailure", "PreCompact",
  "PostCompact", "SessionEnd"] as const`. Order matches
  `.planning/PROJECT.md` "Current Milestone" wording and is preserved
  as a deterministic registration order for downstream consumers.

- **`BucketAEvent`** -- `(typeof BUCKET_A_EVENTS)[number]` literal union.

- **`TOOL_EVENTS`** -- `readonly ["PreToolUse", "PostToolUse",
  "PostToolUseFailure"] as const`. The 3-tuple subset whose matcher
  targets a Claude tool name (Plan 58-01's TOOL-01 reverse map handles
  the translation). Every other bucket-A event is a non-tool event
  whose matcher targets a `source` / `reason` / `trigger` field or has
  no matcher support at all.

- **`ToolEvent`** -- `(typeof TOOL_EVENTS)[number]` literal union.

- **`NON_TOOL_EVENT_FIELDS`** -- `Readonly<Partial<Record<BucketAEvent,
  string | null>>>` with five entries:
  - `SessionStart -> "source"` (Pi `SessionStartEvent.reason`)
  - `SessionEnd -> "reason"` (Pi `SessionShutdownEvent.reason`)
  - `PreCompact -> "trigger"` (no Pi compact-event field exposes this)
  - `PostCompact -> "trigger"` (no Pi compact-event field exposes this)
  - `UserPromptSubmit -> null` (sentinel: no upstream matcher support)

- **`NON_TOOL_EVENT_CLOSED_SETS`** -- `Readonly<Partial<Record<BucketAEvent,
  ReadonlySet<string>>>>` with four entries per Pi peer-dep verification:
  - `SessionStart -> Set(["startup", "resume"])` -- Claude `clear` and
    `compact` are unmappable; Pi `SessionStartEvent.reason` is
    `startup | reload | new | resume | fork`, two-value overlap with
    Claude SessionStart sources.
  - `SessionEnd -> Set([])` -- empty set under v1.13. The only literal
    overlap with Pi `SessionShutdownEvent.reason` is `resume`, but the
    Pi semantic ("session resumed elsewhere") vs the Claude semantic
    ("user resumed prior conversation") diverge enough that admitting
    it would silently mis-fire. v1.14+ may relax if Pi exposes a
    matching value vocabulary.
  - `PreCompact -> Set([])` -- empty (Pi `SessionBeforeCompactEvent`
    has no `trigger` field).
  - `PostCompact -> Set([])` -- empty (Pi `SessionCompactEvent` has
    no `trigger` field).
  - UserPromptSubmit intentionally omitted -- null sentinel in
    `NON_TOOL_EVENT_FIELDS` is the no-matcher-support disposition.

### `tests/architecture/hooks-supportability.test.ts` (NEW, 5 tests)

Five `node:test` cases mirroring the `hooks-foundation.test.ts` /
`hooks-tool-name-map.test.ts` pattern:

1. **TOOL-02: BUCKET_A_EVENTS is exactly the 8 documented events in
   locked order** -- `assert.deepEqual` against the 8-element literal
   list. Catches a 9th-event addition or any reordering.

2. **TOOL-02: TOOL_EVENTS is the closed 3-tuple subset of bucket-A** --
   `assert.deepEqual` lock + a subset-invariant loop asserting every
   `TOOL_EVENTS` member is also a `BUCKET_A_EVENTS` member.

3. **D-58-06: NON_TOOL_EVENT_FIELDS maps each non-tool bucket-A event
   to its Claude-side matcher target** -- five `assert.equal` checks
   (source / reason / trigger / trigger / null sentinel).

4. **D-58-06: NON_TOOL_EVENT_CLOSED_SETS admits only Pi-peer-dep-mapped
   Claude values** -- four `assert.deepEqual` checks against sorted
   value arrays for SessionStart / SessionEnd / PreCompact / PostCompact.

5. **D-58-06: UserPromptSubmit has no entry in
   NON_TOOL_EVENT_CLOSED_SETS** -- `assert.ok(!("UserPromptSubmit" in
   ...))` confirming the null-sentinel disposition is sole handler.

File ends with `// Plan 03 extends with checkMatcherSupportability
invariants below this line.` marking the extension point.

## Verification

- `npm run typecheck` GREEN.
- `node --test tests/architecture/hooks-supportability.test.ts` reports
  pass 5 / fail 0 / duration ~464ms.
- `npm run check` GREEN end-to-end at plan close (typecheck + lint +
  prettier + unit tests + integration tests).
- `grep -c '"SessionStart"\|"UserPromptSubmit"\|...|"SessionEnd"'` shows
  the 8 bucket-A literals appear in `hook-events.ts`.
- `grep -E '(TOOL-02|D-58-06):'` shows 5 ID-prefixed test names.
- Extension-point marker present at EOF of test file.

## Deviations from Plan

None substantive. One mechanical fix: prettier converted backtick-template
strings (containing literal "`" characters inside assert-message strings)
to regular double-quote strings inside the test file. Auto-applied by
`prettier --write` and verified GREEN. No behavioral change.

## Wave-1 Parallel-Safety Invariant

Plan 58-01 and Plan 58-02 produced ZERO shared file edits:

- 58-01 touched only `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
  and `tests/architecture/hooks-tool-name-map.test.ts`.
- 58-02 touched only `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
  and `tests/architecture/hooks-supportability.test.ts`.

Both plans sit cleanly side-by-side; Plan 58-03's matcher parser at
`domain/components/hooks.ts` imports from both new sibling files.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/components/hook-events.ts
- FOUND: tests/architecture/hooks-supportability.test.ts
- FOUND: a403ca5
- FOUND: 1833528
