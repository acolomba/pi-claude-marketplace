---
phase: 18-migration-wave-1-marketplace-orchestrator-family
plan: 3
subsystem: marketplace-orchestrator-migration
tags: [migration, v1-to-v2, wave-2, plan-18-03, list-surface, mp-status-undefined, marketplace-details, last-updated-marker]
requires:
  - plan-18-00-pi-plumbing
  - plan-18-01-add-ts-pilot
  - phase-16-v2-notify
  - phase-17.1-autoupdate-grammar
provides:
  - list-ts-v2-migration
  - list-surface-arm-construction-recipe
  - lastUpdatedAt-enrichment-on-list-rows
affects:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - tests/orchestrators/marketplace/list.test.ts
tech-stack:
  added: []
  patterns:
    - "notify(opts.ctx, opts.pi, { marketplaces: <built array> }) -- single V2 call replacing the lone V1 notifySuccess wrapper"
    - "List-surface arm of MarketplaceNotificationMessage: mp.status omitted; details: MarketplaceDetails conditionally set when record carries autoupdate and/or lastUpdatedAt"
    - "10-line NotificationMessage construction recipe block-comment mirroring add.ts:160-169 with the list-surface variations called out (status undefined; details conditional; severity info; no reload-hint)"
    - "Caller-supplied order (D-16-06): drop the V1 alphabetic sort; rely on the project-then-user outer loop ordering"
    - "Backwards-compatible record enrichment: thread record.lastUpdatedAt into details.lastUpdatedAt so the <last-updated <iso>> token surfaces on list rows"
key-files:
  created:
    - .planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
    - tests/orchestrators/marketplace/list.test.ts
key-decisions:
  - "Followed the Plan 18-01 NotificationMessage construction recipe verbatim, substituting the list-surface variations (mp.status omitted; details conditional on autoupdate or lastUpdatedAt presence)."
  - "Dropped the V1 alphabetic sort: V2 D-16-06 mandates caller-supplied order; the outer scopes loop (project-then-user) already matches V1 compareByNameThenScope for same-name cross-scope tie-breakers. PATTERNS recipe at lines 277-294 codifies this choice."
  - "Threaded record.lastUpdatedAt into details.lastUpdatedAt -- the V1 list.ts dropped it on the floor at lines 54-60 because the V1 renderer had no marker for it; V2 catalog (docs/output-catalog.md:704) renders <last-updated <iso>> when defined."
  - "Dropped the ParsedSource import that the V1 entry construction needed -- the V2 list-surface payload no longer carries a source field."
patterns-established:
  - "List-surface mp.status === undefined: construct MarketplaceNotificationMessage without status; supply details only when autoupdate or lastUpdatedAt is present"
  - "Sort policy: orchestrator iterates project-then-user (SC-6 / MSG-GR-3); renderer honors order (D-16-06); no alphabetic sort layer"
requirements-completed: []
duration: 9min
completed: 2026-05-27
---

# Phase 18 Plan 3: `list.ts` V1 -> V2 Migration Summary

**V2 list-surface notification: single `notify(opts.ctx, opts.pi, { marketplaces: [...] })` call constructing `mp.status === undefined` payloads with conditional `details: MarketplaceDetails`, surfacing the previously-dropped `<last-updated <iso>>` marker.**

## Performance

- **Duration:** 9 min (580 s)
- **Started:** 2026-05-27T03:15:45Z
- **Completed:** 2026-05-27T03:25:25Z
- **Tasks:** 2 (both `type="auto"`, landed in one atomic commit per plan)
- **Files modified:** 2

## Accomplishments

- Migrated `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` from V1 `notifySuccess(opts.ctx, renderMarketplaceList(allRecords))` (line 67) to V2 `notify(opts.ctx, opts.pi, NotificationMessage)`.
- Constructed the list-surface payload arm: `mp.status` intentionally omitted; `details: MarketplaceDetails` set when the persisted record carries `autoupdate` and/or `lastUpdatedAt`.
- Threaded `record.lastUpdatedAt` into `details.lastUpdatedAt` (backwards-compatible enrichment; V1 dropped it on the floor at the local `MarketplaceListEntry` build site lines 54-60).
- Dropped the now-orphaned imports: `renderMarketplaceList`, `MarketplaceListEntry`, `notifySuccess`, and `ParsedSource`.
- Added the 10-line NotificationMessage construction recipe block-comment mirroring add.ts:160-169 with the list-surface variations called out.
- Confirmed (per RESEARCH §"Per-File Test Surface") that the existing 8 `list.test.ts` byte assertions ALREADY match the V2 catalog list-surface form -- ZERO byte-string flips required.
- Added one new test `ML-V2 / D-16-12: list surface emits <last-updated <iso>> marker when record carries lastUpdatedAt` bound against the canonical catalog UAT fixture `mixed-scopes` (`alpha [project]` row at `tests/architecture/catalog-uat.test.ts:1087-1107`).

## Task Commits

Tasks 1 + 2 landed in **one atomic commit** per the plan's `<done>` block ("Task 2 lands the test updates that unlock this verify in the same atomic commit"):

1. **Tasks 1 + 2 (atomic): Migrate list.ts to V2 notify() + verify/extend list.test.ts** -- `3654dcd` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` -- V1 -> V2 migration; imports flipped; V2 `notify()` call constructing list-surface payloads with conditional `details`; 10-line construction recipe added; ParsedSource cast site removed.
- `tests/orchestrators/marketplace/list.test.ts` -- existing 8 tests preserved verbatim (byte assertions already match V2 per RESEARCH); 1 new `<last-updated>` enrichment test added.
- `.planning/phases/18-migration-wave-1-marketplace-orchestrator-family/18-03-SUMMARY.md` -- this file.

## Decisions Made

- **List-surface arm construction (mp.status undefined, details conditional):** The list surface is the only marketplace-family command using `mp.status === undefined`. `details: MarketplaceDetails` is OPTIONAL and INDEPENDENT of status per D-15-06; setting it conditionally on `autoupdate || lastUpdatedAt` presence matches the catalog UAT fixture `mixed-scopes` arms (alpha[project] has both; alpha[user] has neither; zeta[project] has autoupdate only).
- **Drop V1 alphabetic sort:** V2 D-16-06 mandates caller-supplied order; the orchestrator's outer scopes loop (project-then-user) already enforces the SC-6 / MSG-GR-3 project-first ordering for same-name cross-scope rows. No replacement sort added.
- **Backwards-compatible `lastUpdatedAt` enrichment:** V1 list.ts at lines 54-60 spread only `autoupdate` into the V1 `MarketplaceListEntry`; the persisted record may carry `lastUpdatedAt` (set at add/update time per persistence/state-io.ts:70). V2 catalog renders `<last-updated <iso>>` when `details.lastUpdatedAt` is defined. Threading the field through is value-positive and backward-compatible (V1 tests asserted no `<last-updated>` form; new V2 test pins the byte form).

## Deviations from Plan

None - plan executed exactly as written. The plan called for:
- One V2 `notify()` call with the list-surface payload (done).
- Drop `renderMarketplaceList` + `MarketplaceListEntry` + `notifySuccess` + `ParsedSource` imports (all four dropped).
- Preserve existing 8 byte assertions verbatim (done; RESEARCH confirmed V2 alignment).
- Add one new `<last-updated>` enrichment test (done).
- Add recipe block-comment near the new `notify()` call referencing the Wave 1 pilot (done -- 10 comment lines, in band with the planner's 6-10 guidance).
- `npm run check` GREEN at the atomic commit (done).
- Catalog UAT byte-equality GREEN (done).

---

**Total deviations:** 0
**Impact on plan:** Clean execution; no scope creep. The list-surface arm is now the canonical exemplar for any future planner needing the `mp.status === undefined` construction.

## Issues Encountered

None.

## Verification

```
$ grep -c "notifySuccess|notifyWarning|notifyError" extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
0

$ grep -c 'from "../../presentation/' extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
0

$ node --test "tests/orchestrators/marketplace/list.test.ts"
# tests 9   pass 9   fail 0
# (8 existing assertions preserved + 1 new <last-updated> enrichment test)

$ node --test "tests/architecture/catalog-uat.test.ts"
# tests 3   pass 3   fail 0   (catalog UAT byte-equality GREEN)

$ npm run check
typecheck     PASS
lint          PASS
format:check  PASS
test          PASS   1362 tests (1360 pass, 0 fail, 2 todo)
```

Plan-specified invariants:

| Check | Expected | Actual |
|-------|---------:|-------:|
| `grep -c "notifySuccess|notifyWarning|notifyError" list.ts` | 0 | 0 |
| `grep -c 'from "../../presentation/' list.ts` | 0 | 0 |
| V2 `notify(opts.ctx, opts.pi` call sites in list.ts | 1 | 1 |
| Recipe block-comment line count | 6-10 | 10 |
| Existing list.test.ts byte assertions touched | 0 | 0 |
| New `<last-updated>` test added | 1 | 1 |
| Catalog UAT byte-equality | GREEN | GREEN |
| `npm run check` exit code | 0 | 0 |

## V1 -> V2 Migration Status (list.ts only)

| Status | Count |
|--------|------:|
| V1 wrapper callsites remaining in list.ts | 0 |
| V2 `notify()` callsites in list.ts | 1 |
| `presentation/*` imports remaining in list.ts | 0 |
| Catalog UAT fixtures for `marketplace list` still GREEN | 2/2 (empty, mixed-scopes) |

## Threat Flags

None. Per the plan's `<threat_model>` (T-18-03-01: accept), this is an internal API refactor; byte output is governed by the Phase 17 catalog binding contract; the `lastUpdatedAt` enrichment surfaces a value already persisted (no new data flowing into the system).

## Known Stubs

None. list.ts now emits real V2 NotificationMessage payloads; the only structurally-required hardcoded value is `plugins: []` per D-15-08 (list rows are mp-only, no plugin rows).

## Authentication Gates

None.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` exists, compiles strict, and emits exactly one V2 `notify(opts.ctx, opts.pi, ...)` call.
- File `tests/orchestrators/marketplace/list.test.ts` exists; 9/9 tests pass (8 existing + 1 new `<last-updated>`).
- Commit `3654dcd` exists on worktree branch `worktree-agent-a62f83d76fcd41328` and contains both modified files.
- `npm run check` exits 0 (1360 pass / 0 fail / 2 todo -- identical to Plan 18-01 baseline).
- Plan's verification invariants confirmed (grep counts 0/0; notify call count 1; recipe lines 10).
- NotificationMessage construction recipe block-comment present at the new `notify()` call site (10 comment lines).
- Catalog UAT byte-equality GREEN.
- No modifications to STATE.md or ROADMAP.md (orchestrator owns those writes per parallel_execution rules).

## Next Phase Readiness

- Plan 18-03 closes 1 of the remaining V1 callsites in the marketplace orchestrator family.
- The list-surface arm of `renderMpHeader` is now exercised end-to-end through real `notify()` from the orchestrator (Plan 18-00 plumbed `pi`; Plan 18-03 consumed it).
- Plans 18-04 (`remove.ts`) and 18-05 (`update.ts`) can mirror the same recipe block-comment pattern, substituting their own `mp.status` values per the Plan 18-01 substitution table.

---
*Phase: 18-migration-wave-1-marketplace-orchestrator-family*
*Completed: 2026-05-27*
