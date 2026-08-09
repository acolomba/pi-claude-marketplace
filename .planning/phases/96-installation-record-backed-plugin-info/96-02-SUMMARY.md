---
phase: 96-installation-record-backed-plugin-info
plan: 02
subsystem: api
tags: [typescript, node-test, orchestrator, hooks, containment, output-catalog]

# Dependency graph
requires:
  - phase: 96-installation-record-backed-plugin-info
    plan: 01
    provides: "`buildStateOnlyInstalledRow` / `composeStateOnlyComponents` / `derivePersistedInstalledStatus`, the four name-list kinds, and the byte-exact manifest-absent suite this plan extends"
provides:
  - "`readStateOnlyHookEntries` — the state-only arm's hook inventory, read back from the materialized `<hooksDir>/<slug>/hooks.json` behind `assertPathInside`"
  - "the D-96-03 truthful split: no recorded hooks omits the line silently, recorded-but-unlistable hooks omits the line AND stamps a closed-set read reason last in the brace"
  - "an executable NFR-10 pin: a traversal slug classifies `unreadable` (the containment refusal) rather than `source missing` (a read that ran)"
  - "two more byte-gated output-catalog states covering both hook outcomes"
affects: [96 INFO-12 fetch skip note, 97 disabled-state classification repair, 98 DOC-08 contract reconciliation]

actuals:
  tokens: 6100
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Read-site containment mirror: a state-supplied path component goes through `assertPathInside` BEFORE `readFile`, inside the same try that classifies the failure — the shape `bridges/hooks/event-router.ts`'s hydrate reader established"
    - "Degradation as a row-level reason rather than a synthetic component entry: an unreadable sub-read omits its own block and appends an existing closed-set reason, so no new token, no renderer change, and no fabricated entry"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info-manifest-absent.test.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "The degradation marker reuses the existing `narrowProbeError` ladder (`source missing` / `permission denied` / `unparseable` / `unreadable`) stamped at ROW level, with the hooks line omitted. No new reason token was added, so `notify.ts`, `notify-reasons.ts`, the `REASONS.length` assertion and the catalog reference table are all untouched and `notify-closed-set-locks.test.ts` passes unmodified."
  - "Attribution rests on uniqueness, not on wording: the materialized hooks config is the ONLY file the state-only arm opens, so a row-level read reason can only mean hooks. The catalog prose states that premise explicitly, so a future second read on this arm breaks a documented assumption rather than silently mis-attributing."
  - "`composeStateOnlyComponents` now returns `{ components, degraded? }` and is `async`; `buildStateOnlyInstalledRow` is `async` and takes `locations`. This is the exact one-function, one-call-site conversion plan 96-01 left as the named extension point."
  - "`projectDroppedHookEntries` is deliberately NOT called here. The materialized file is the filtered supported subset the install ledger wrote, so its `dropped` list is empty by construction; enumerating detail that was never persisted would be invention."

patterns-established:
  - "A partial listing is never emitted: the first failing slug aborts the loop and discards entries already collected, because a half-listed block claims a completeness it does not have"
  - "A degraded sub-read is a footnote on the row, never a failure of the block — status, version, other reasons and all four name-list kinds keep rendering"

requirements-completed: [INFO-11]

coverage:
  - id: D1
    description: "A manifest-absent record whose `resources.hooks` names a slug with a readable materialized `hooks.json` renders a `hooks:` block listing every declared event group at 6-space indent, between the `commands` and `mcp` lines"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-11: a recorded hooks slug renders the materialized config's entries as a `hooks:` block"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hook entries are never sorted: `projectHookSummaryEntries` output order is the materialized declaration order and reaches the renderer untouched"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-11: hook entries follow the materialized file's declaration order, never a sort"
        status: pass
    human_judgment: false
  - id: D3
    description: "A record whose `resources.hooks` is empty renders NO `hooks:` line at all — a true negative, not a degradation"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-03: a record with no recorded hooks omits the `hooks:` line with no added reason"
        status: pass
    human_judgment: false
  - id: D4
    description: "A materialized `hooks.json` that parses to an EMPTY event map produces zero entries, so no header line renders and no degradation marker is stamped — byte-identical to the plain INFO-09 row"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-11: a materialized hooks config that parses to an empty map renders no `hooks:` line and no reason"
        status: pass
    human_judgment: false
  - id: D5
    description: "A recorded slug whose materialized `hooks.json` is missing renders no `hooks:` line AND carries `source missing` as the last reason; a malformed or schema-invalid file renders the same way with `unparseable`"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-03: a recorded hooks slug with no materialized file omits the block and reports `source missing`"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-03: a malformed materialized hooks config omits the block and reports `unparseable`"
        status: pass
    human_judgment: false
  - id: D6
    description: "A traversal slug in `resources.hooks` is refused by `assertPathInside` before any `readFile`, the block still renders with all four name-list kinds, and the brace carries `unreadable`"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#NFR-10: a traversal hooks slug is refused before any read and the block still renders"
        status: pass
    human_judgment: false
    rationale: "The token itself is the proof of ordering: had `readFile` run first on a non-existent composed path, the ladder would have produced `source missing`, not `unreadable`."
  - id: D7
    description: "An unreadable materialized config (mode 0) reports `permission denied` — POSIX-only, skipped on Windows and when running as root"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#D-96-03: an unreadable materialized hooks config reports `permission denied` (POSIX-only)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Reason order inside the brace is `not in manifest`, then the `narrowUnsupportedKinds` tokens, then the hooks read marker last"
    requirement: INFO-11
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info-manifest-absent.test.ts#INFO-10 / D-96-03: a partial record with an unreadable hooks config orders the three reasons absence, kind, read"
        status: pass
    human_judgment: false
  - id: D9
    description: "Both hook outcomes are published in docs/output-catalog.md and pinned byte-for-byte in both directions by the catalog gate, including the fidelity limit and the single-read attribution premise"
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
    human_judgment: true
    rationale: "The byte gate proves the rendered rows match. It cannot judge whether the prose actually conveys the two things an operator must take away: that the list can be shorter than the plugin's own declaration, and that a bare read reason on this row means hooks. That is an editorial call."

# Metrics
duration: 31min
completed: 2026-08-09
status: complete
---

# Phase 96 Plan 02: Hooks reconstruction for the state-only info arm Summary

**`plugin info` now lists a manifest-absent plugin's hooks from the configuration the extension itself materialized, and says so out loud when it cannot — the `hooks:` line disappears and a closed-set read reason takes its place, so silence never passes for a verified absence.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-08-09T02:20:35Z
- **Completed:** 2026-08-09T02:51:44Z
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified)

## Accomplishments

- Added `readStateOnlyHookEntries`, the one disk read the state-only arm performs. It composes the path through `hookConfigPathFor` (the hooks bridge's own single source of truth), runs `assertPathInside` before `readFile`, and re-parses with the same `skipIfMap` idiom the strict reader uses.
- Implemented D-96-03's truthful split end to end. Zero recorded slugs returns neither entries nor a marker. A slug whose file is missing, mode-0, malformed or schema-invalid returns no entries plus a marker, and the marker lands last in the brace behind the absence token and the unsupported-kind tokens.
- Pinned the whole degradation matrix executably, including the containment refusal. The traversal case's `unreadable` token is itself the ordering proof: a `readFile` that ran first would have produced `source missing`.
- Published both outcomes as byte-gated catalog states, documenting the two things the byte gate cannot say — that the materialized file is the filtered supported subset, and that a bare read reason on this row is attributable to hooks only because this arm opens exactly one file.

## Task Commits

Each task was committed atomically; task 1 was TDD, so it carries a RED and a GREEN commit.

1. **Task 1: Read the materialized hooks config behind the containment guard** - `f86b1a49` (test, RED) and `69b4648b` (feat, GREEN)
2. **Task 2: Pin the degradation matrix, including the traversal refusal** - `d45c654f` (test)
3. **Task 3: Publish the hooks-present and hooks-degraded states in the catalog** - `39c82b4f` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - added `readStateOnlyHookEntries`; converted `composeStateOnlyComponents` to `async` returning `{ components, degraded? }`; converted `buildStateOnlyInstalledRow` to `async` taking `locations`; awaited it at its single call site; added the `hookConfigPathFor` import at the head of the relative-import group
- `tests/orchestrators/plugin/info-manifest-absent.test.ts` - the `seedMaterializedHooks` helper plus nine new byte-exact cases (4 rendering, 5 degradation); the suite is now 15 tests
- `docs/output-catalog.md` - `state-only-installed-with-hooks` and `state-only-installed-hooks-degraded`
- `tests/architecture/catalog-uat.test.ts` - the two matching pure-literal fixtures plus the enumerating comment

## Decisions Made

- **The degradation marker reuses existing tokens at row level.** The plan's own analysis held up: a new `malformed hooks` token would be a four-place closed-set amendment plus a DOC-08 ripple for no gain in truthfulness, and a synthetic `(unreadable)` hook entry would abuse the `event` field to carry a status. `notify.ts`, `notify-reasons.ts` and the closed-set lock test are untouched, and the lock test passes unmodified.
- **The dropped-hook projector stays out of this reader.** The materialized file is what the install ledger wrote after filtering, so `parsed.dropped` is empty by construction. Calling the projector would have been dead code that looked like coverage.
- **The first failing slug aborts the loop.** Entries already collected are discarded rather than rendered as a shorter block. The loop over `resources.hooks` is defensive forward-compat (the ledger writes zero or one), and a partially listed block would be a worse lie than an omitted one plus a named reason.

## Deviations from Plan

None - the plan executed as written. No auto-fix rules fired.

One plan-internal overlap is worth recording so the count reconciles: the empty-parsed-map case appears both as Task 1's fourth `<behavior>` bullet and as Task 2's case 6. It was written once, in Task 1's commit, and satisfies both. Task 2 therefore added five cases rather than six.

## Issues Encountered

- `grep` still cannot read `info.ts` (the NUL byte makes it look binary). Every inspection used `Read` or `node -e` with `readFile`, as the plan required.
- The worktree trufflehog hook fails structurally on every commit (`.git` is a file, not a directory). Each commit was preceded by a clean `trufflehog filesystem` scan over the changed paths, then committed with `SKIP=trufflehog` per the project's documented worktree procedure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INFO-11 is now complete: all five component kinds render on the state-only arm. REQUIREMENTS.md should move it from Partial to Complete.
- INFO-12's `--fetch` skip note (D-96-04) is still open. The state-only arm now performs exactly one disk read and still constructs no probe and takes no `fetchCtx`, so the structural half of the network guarantee holds; the visible skip report and the zero-call seam assertion remain to be built.
- D-96-02's folded-row catalog note (the "still open under BOUND-01 / BOUND-02" sentence in the list section) was not in this plan's edit set and is still open.
- A standing constraint for later work: the row-level read reason is attributable to hooks ONLY because this arm opens exactly one file. Adding a second disk read to the state-only arm breaks that attribution and forces the marker to become per-kind. The catalog prose records the premise so the break is visible rather than silent.

---
*Phase: 96-installation-record-backed-plugin-info*
*Completed: 2026-08-09*

## Self-Check: PASSED

All 4 source artifacts and the SUMMARY exist on disk; all 4 task commits
(`f86b1a49`, `69b4648b`, `d45c654f`, `39c82b4f`) are present in git history.
`npm run check` exits 0 with `PI_SUBAGENTS_ROOT` set. No stubs, no skipped
tests (the POSIX-only EACCES case runs on this platform), no unrun `<verify>`
blocks.
