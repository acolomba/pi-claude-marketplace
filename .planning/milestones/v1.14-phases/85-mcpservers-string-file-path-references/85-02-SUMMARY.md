---
phase: 85-mcpservers-string-file-path-references
plan: 02
subsystem: notify
tags: [reason-catalog, closed-set, probe-classifiers, notify, mcp]

# Dependency graph
requires:
  - phase: 85-01
    provides: "resolver emits the collision-proof `malformed mcp reference:` note prefix on a broken mcpServers string reference"
provides:
  - "`malformed mcp` closed-set failure-class reason (REASONS 34 -> 35; FAILURE_REASONS member)"
  - "narrowResolverNotes arm mapping `malformed mcp reference` notes -> `{malformed mcp}`, before the catch-all"
  - "ResolverNoteReason widened return alias (keeps narrowUnsupportedKinds / kindToReason narrow)"
  - "docs/output-catalog.md reason-vocabulary + (unavailable)-row documentation for `{malformed mcp}`"
affects: [mcp-bridge, list.ts, fetch.ts, info-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Closed-set reason growth: append to REASONS (order-stable, at tuple end like prior failure-class additions) + a FAILURE_REASONS home, so _ReasonsCoverageProof stays total by construction"
    - "Collision-proof prefix narrowing: match the FULL `malformed mcp reference` prefix before the catch-all so the inline `malformed mcpServers` note is not reclassified"
    - "Extract a pure classifyResolverNote(note) from the dedup loop to keep cognitive complexity within budget when adding an arm"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/shared/probe-classifiers.test.ts
    - docs/output-catalog.md

key-decisions:
  - "D-02: `malformed mcp` is filed FAILURE-CLASS (FAILURE_REASONS), NOT UNSUPPORTED_REASONS -- it is a malformation of a SUPPORTED feature the resolver parses, sibling to invalid manifest / unparseable"
  - "Appended `malformed mcp` at the REASONS tuple END (after `dangling reference`), matching the convention of the two prior failure-class additions (authentication required, dangling reference) and preserving existing tuple order (OUT-08)"
  - "Widened only the narrowResolverNotes return alias to ResolverNoteReason; narrowUnsupportedKinds / kindToReason stay on the narrow UnsupportedReason (they classify per-kind markers, never resolver notes)"

patterns-established:
  - "When a new narrowResolverNotes arm trips the sonarjs cognitive-complexity ceiling, extract the arm ladder into a pure classifier and keep the loop a classify + push-once"

requirements-completed: [MCPR-03]

coverage:
  - id: D1
    description: "narrowResolverNotes(['malformed mcp reference: ...']) narrows to ['malformed mcp']"
    requirement: "MCPR-03"
    verification:
      - kind: unit
        ref: "tests/shared/probe-classifiers.test.ts#MCPR-03 / D-02: narrowResolverNotes emits `malformed mcp` for a `malformed mcp reference:` note"
        status: pass
    human_judgment: false
  - id: D2
    description: "collision guard: inline `malformed mcpServers:` note STILL narrows to ['unsupported source'] (D-02 scope boundary held)"
    requirement: "MCPR-03"
    verification:
      - kind: unit
        ref: "tests/shared/probe-classifiers.test.ts#MCPR-03 / D-02: an inline `malformed mcpServers:` note STILL narrows to `unsupported source` (collision guard)"
        status: pass
    human_judgment: false
  - id: D3
    description: "REASONS.length === 35; `malformed mcp` is a FAILURE_REASONS member; _ReasonsCoverageProof stays total (typecheck green)"
    requirement: "MCPR-03"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 35-entry reason set"
        status: pass
      - kind: typecheck
        ref: "notify-reasons.ts::_ReasonsCoverageProof resolves to never (tsc --noEmit)"
        status: pass
    human_judgment: false
  - id: D4
    description: "output catalog documents `{malformed mcp}` in the (unavailable) status-token row and the info-surface unavailable recipe"
    requirement: "MCPR-03"
    verification:
      - kind: doc
        ref: "docs/output-catalog.md (grep -c 'malformed mcp' == 2)"
        status: pass
    human_judgment: false

# Metrics
duration: ~35min
completed: 2026-07-22
status: complete
---

# Phase 85 Plan 02: `{malformed mcp}` reason-token wiring Summary

**A broken `mcpServers` string reference now renders the truthful failure-class `{malformed mcp}` token on the `(unavailable)` row: the resolver's `malformed mcp reference:` notes narrow to `["malformed mcp"]` while the inline `malformed mcpServers` note is untouched and still narrows to `["unsupported source"]`.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Appended `"malformed mcp"` to the `REASONS` tuple (`shared/notify.ts`, 34 -> 35) at the tuple END and to the `FAILURE_REASONS` tuple (`shared/notify-reasons.ts`) as a failure-class member (D-02). `ContentReason = Exclude<Reason, "not added">` picks it up automatically, so `list.ts` / `fetch.ts` `readonly ContentReason[]` row fields accept it with no local edit. `_ReasonsCoverageProof` stays total by construction (the member has a home in a topic group AND is in `REASONS`).
- Added a new arm in `narrowResolverNotes` (`shared/probe-classifiers.ts`) matching `note.startsWith("malformed mcp reference")` -> `"malformed mcp"`, placed BEFORE the permissive `unsupported source` catch-all. The FULL `reference` prefix is load-bearing: a bare `malformed mcp` match would also match the inline `malformed mcpServers` note and silently reroute it (the T-85-07 spoofing/attribution regression the collision guard exists to prevent).
- Widened the local return alias to `type ResolverNoteReason = UnsupportedReason | "malformed mcp"` on `narrowResolverNotes` only; `narrowUnsupportedKinds` / `kindToReason` stay on the narrow `UnsupportedReason` (they classify per-kind markers, never resolver notes).
- Bumped the closed-set length tripwire (34 -> 35) in `tests/architecture/notify-closed-set-locks.test.ts` and added bidirectional collision-guard + de-dupe cases to `tests/shared/probe-classifiers.test.ts`.
- Documented `{malformed mcp}` in `docs/output-catalog.md` (the `(unavailable)` status-token row and the info-surface unavailable recipe), matching the sibling `{invalid manifest}` granularity.

## Task Commits

1. **Task 1 (RED): failing malformed mcp reason-token guards** - `86487f82` (test)
2. **Task 1 (GREEN): wire malformed mcp reason token** - `41b42ef3` (feat)
3. **Task 2: document {malformed mcp} in the output catalog** - `40bb018a` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - `"malformed mcp"` appended to `REASONS` (tuple end) with a `// MCPR-03 / D-02:` comment; the two `34-entry` count comments bumped to `35-entry` to stay truthful.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - `"malformed mcp"` added to `FAILURE_REASONS` (NOT `UNSUPPORTED_REASONS`); the `34-entry` count comment bumped to `35-entry`.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` - `ResolverNoteReason` widened alias; `narrowResolverNotes` rewritten as a classify + push-once dedup loop over a new pure `classifyResolverNote(note)` helper carrying the `malformed mcp reference` arm before the catch-all.
- `tests/architecture/notify-closed-set-locks.test.ts` - length tripwire 34 -> 35.
- `tests/shared/probe-classifiers.test.ts` - MCPR-03 / D-02 reference-note, collision-guard, and de-dupe cases.
- `docs/output-catalog.md` - `{malformed mcp}` reason-vocabulary + `(unavailable)`-row documentation.

## Decisions Made

- **Appended at the tuple END, not "near failure-class members."** The plan text said "near the failure-class members (`invalid manifest` / `unparseable`)", but the two most recent failure-class additions (`authentication required`, `dangling reference`) were both appended at the tuple END, and the OUT-08 order-stability comment forbids reordering existing members. Appending after `dangling reference` preserves all existing indices while keeping the new member adjacent to a failure-class token. The `FAILURE_REASONS` grouping is what actually files it failure-class; tuple position is cosmetic for the union type.
- **Widened only `narrowResolverNotes`.** Introduced `ResolverNoteReason` rather than widening `UnsupportedReason` itself, so the sibling per-kind classifiers keep their narrow contract (they cannot legitimately emit `malformed mcp`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] sonarjs cognitive-complexity ceiling tripped by the new arm**
- **Found during:** Task 1 GREEN, `npm-lint` pre-commit hook.
- **Issue:** Adding the `malformed mcp reference` arm to `narrowResolverNotes` raised its cognitive complexity to 18 (ceiling 15) -- `sonarjs/cognitive-complexity` error, a blocking lint failure directly caused by the plan's own change.
- **Fix:** Extracted the arm ladder into a pure `classifyResolverNote(note): ResolverNoteReason` helper; `narrowResolverNotes` is now a `classify(note)` + push-once dedup loop. Behavior is byte-identical (all 16 probe-classifier tests pass, including the WR-01 first-wins dedup guards).
- **Files modified:** extensions/pi-claude-marketplace/shared/probe-classifiers.ts
- **Verification:** `npm-lint` clean; `node --test tests/shared/probe-classifiers.test.ts` 16/16; `tsc --noEmit` clean.
- **Committed in:** `41b42ef3`

---

**Total deviations:** 1 auto-fixed (1 blocking). No scope creep; behavior unchanged.

## Threat Model

- **T-85-07 (mitigate):** the collision guard is locked bidirectionally -- the reference note narrows to `["malformed mcp"]` AND the inline `malformed mcpServers` note stays `["unsupported source"]`. Both directions are asserted in `tests/shared/probe-classifiers.test.ts`.
- **T-85-08 (mitigate):** the `_ReasonsCoverageProof` (compile-time) + the `REASONS.length` 35 tripwire force the deliberate coordinated bump; `npm run check` is the gate.

## Issues Encountered

- **Pre-existing integration-test failures (out of scope, unchanged).** `npm run check`'s `test:integration` step reports the SAME 2 failures documented in 85-01-SUMMARY -- `T-d8i-01` (`tests/integration/provenance-invisibility.test.ts`) and `SC-2 / AGSK-06` (`tests/integration/skill-path-resolution.test.ts`). Both are environmental pi-subagents companion-extension integration failures that fail identically on the base commit (`2aa29a15`, before any Phase 85 work) and are already tracked in `deferred-items.md`. This plan's files (notify / notify-reasons / probe-classifiers / catalog docs) do not intersect the skill-path / provenance surfaces. The full unit suite, typecheck, lint, and format:check are all green.

## User Setup Required

None.

## Next Phase Readiness

- The `{malformed mcp}` token is now live end-to-end: Plan 01 emits the `malformed mcp reference:` note, Plan 02 narrows it to the closed-set token and documents it. The MCP-bridge / info / list surfaces consume it via `ContentReason` with no further edits required.

## Self-Check: PASSED

All 6 modified files present; all task commits (`86487f82`, `41b42ef3`, `40bb018a`) confirmed in git history.

---
*Phase: 85-mcpservers-string-file-path-references*
*Completed: 2026-07-22*
