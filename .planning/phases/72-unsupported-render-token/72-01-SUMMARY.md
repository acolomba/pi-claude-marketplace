---
phase: 72-unsupported-render-token
plan: 01
subsystem: ui
tags: [notify, render-grammar, discriminated-union, closed-set, typebox, list, info]

# Dependency graph
requires:
  - phase: 64-66 (force-install milestone)
    provides: resolver three-way state (installable/unsupported/unavailable); the force-installed (◉) closed-set-member lockstep precedent
  - phase: 71 (dropped-hooks reason + info enumeration)
    provides: narrowUnsupportedKinds reason mapping; lenient/strict info hooks readers
provides:
  - "ICON_UNSUPPORTED = ⊖ (U+2296) glyph constant"
  - "PluginUnsupportedMessage discriminated-union variant"
  - "\"unsupported\" member in STATUS_TOKENS (23) and PLUGIN_STATUSES (18)"
  - "De-collapsed (unsupported) render token on list + info surfaces, byte-consistent across both"
  - "Tool projection arm: unsupported -> unavailable bucket"
affects: [verify-work, any future render-grammar phase, install-error-surface cross-token follow-up]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lockstep new-closed-set-token template (closed-set member + glyph + union variant + renderer arms + tripwire bump), mirroring the force-installed precedent"
    - "Render split keyed on resolved.state discriminant, never on the reason brace"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/edge/handlers/tools.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md

key-decisions:
  - "Render split follows resolved.state, never the reason brace ({unsupported hooks} appears on both arms)"
  - "LSP-only and parseable-but-unsupportable-hooks plugins both flip to ⊖ (unsupported); only structural-malformed / non-path rows keep ⊘ (unavailable)"
  - "Severity preserved at info (token rename, not a severity change); PluginUnsupportedMessage omits the forceHint field (install-error surface out of scope)"
  - "Filter buckets (--unsupported / --unavailable) left untouched; they key on the pre-collapse resolver bucket, independent of the render token"
  - "Tool surface projects unsupported -> unavailable (no distinct coarse bucket), mirroring disabled"

patterns-established:
  - "New render token = closed-set member (both tuples) + glyph constant + union variant + every exhaustive switch arm + tripwire bump, landed coherently in one compiling change"
  - "Command-local render maps (list.messaging.ts) must gain the new arm in lockstep with the central renderPluginRow"

requirements-completed: [USTAT-01, USTAT-02]

coverage:
  - id: D1
    description: "A not-installed plugin resolving unsupported renders ⊖ <name> (unsupported) {…} in list; structural-unavailable keeps ⊘ (unavailable)"
    requirement: USTAT-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/list.test.ts#LIST-01 / D-67-01: a not-installed plugin resolving `unsupported` shows under --unsupported (the `(unsupported)` row token) and is ABSENT under --unavailable and --available"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/list.test.ts#gap: plugin declaring lspServers field renders as ⊖ (unsupported) with {lsp} note"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same not-installed unsupported plugin renders ⊖ … (unsupported) in info, byte-consistent with list; non-path + malformed rows stay ⊘"
    requirement: USTAT-01
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#INFO-05: lenient reader lists `Stop (unsupported)` on a path-resolvable `(unsupported) {unsupported hooks}` row"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/plugin/info.test.ts#INFO-02: single-scope unavailable (malformed hooks/hooks.json) renders `⊘ ... (unavailable) {unsupported hooks}`"
        status: pass
    human_judgment: false
  - id: D3
    description: "Byte-exact renderer arm: a status unsupported message renders ⊖ <name> (unsupported) {…}"
    requirement: USTAT-01
    verification:
      - kind: unit
        ref: "tests/shared/notify-v2.test.ts#USTAT-01 / D-64-01: notify renders unsupported plugin with the ⊖ glyph (MSG-PL-6 carve-out: NO scope bracket)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Closed-set tripwire: STATUS_TOKENS=23, PLUGIN_STATUSES=18, REASONS=32, MARKETPLACE_STATUSES=7"
    requirement: USTAT-02
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#SNM-02: STATUS_TOKENS is the closed 23-entry token set"
        status: pass
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#SNM-02: PLUGIN_STATUSES is the closed 18-entry plugin-status set"
        status: pass
    human_judgment: false
  - id: D5
    description: "--unsupported / --unavailable filters keep partitioning on the pre-collapse resolver bucket (unchanged)"
    requirement: USTAT-02
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/list.test.ts#LIST-01 / D-67-01: a structurally-unavailable plugin shows under --unavailable and is ABSENT under --unsupported"
        status: pass
    human_judgment: false
  - id: D6
    description: "Catalog/golden byte forms reconciled; docs split into (unsupported)/⊖ and (unavailable)/⊘ grammar; npm run check green"
    requirement: USTAT-02
    verification:
      - kind: integration
        ref: "tests/architecture/catalog-uat.test.ts"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false
  - id: D7
    description: "Tool projection: a list-payload unsupported row projects to the unavailable tool bucket"
    requirement: USTAT-02
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#pi_claude_marketplace_plugin_list :: unsupported row projects to unavailable tool bucket"
        status: pass
    human_judgment: false
  - id: D8
    description: "Real-marketplace visual confirmation: /claude:plugin list --unsupported renders ⊖ hookify (unsupported) and ⊖ clangd-lsp (unsupported) {lsp} after /reload"
    requirement: USTAT-01
    verification: []
    human_judgment: true
    rationale: "Live TUI render against the official marketplace after /reload cannot be asserted by the automated suite (manual-only per 72-VALIDATION.md)."

# Metrics
duration: 34min
completed: 2026-06-29
status: complete
---

# Phase 72 Plan 01: Unsupported Render Token Summary

**De-collapsed the resolver `unsupported` arm at the list/info render points so a not-installed, force-installable plugin renders a distinct `⊖ (unsupported)` row (new `ICON_UNSUPPORTED` glyph + `PluginUnsupportedMessage` variant), while structural failures keep `⊘ (unavailable)` — closing the D-64-01 deferral with filter buckets untouched.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-06-29T01:46:46Z
- **Completed:** 2026-06-29T02:21:25Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Added the `"unsupported"` closed-set member (STATUS_TOKENS 22→23, PLUGIN_STATUSES 17→18), the `ICON_UNSUPPORTED = "⊖"` (U+2296) glyph, and the `PluginUnsupportedMessage` union variant, all type-enforced by the closed-set tripwire and the `assertNever` exhaustiveness gates.
- De-collapsed `availableRowMessage` (list) and the not-installed PATH-source row (info) so the render split follows `resolved.state`: LSP-only and parseable-but-unsupportable-hooks plugins flip to `⊖ (unsupported)`, byte-consistent across list and info; structural-malformed and non-path rows keep `⊘ (unavailable)`.
- Left the `--unsupported` / `--unavailable` filter buckets, `FilterBucket`/`shouldShow`/`classifyManifestEntry`, `domain/resolver.ts`, and `shared/probe-classifiers.ts` untouched (verified by diff).
- Reconciled every byte-exact fixture and the `docs/output-catalog.md` / `docs/messaging-style-guide.md` grammar; `npm run check` green (typecheck + lint + format:check + unit + integration).

## Task Commits

Each task was committed atomically:

1. **Task 1: Foundation — closed-set member, glyph, union variant, renderer arms, tool projection, tripwire bump** - `ec4af3c2` (feat)
2. **Task 2: De-collapse list.ts and reconcile list-surface fixtures + catalog** - `abae08e5` (feat)
3. **Task 3: De-collapse info.ts, reconcile info/import fixtures, finalize docs, full check green** - `81896838` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify.ts` - ICON_UNSUPPORTED glyph, PluginUnsupportedMessage variant, "unsupported" in both closed-set tuples, renderPluginRow + pluginInfoStatusGlyph arms, PluginInfoRowBase.status Extract widened
- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` - projectRowStatus "unsupported"→"unavailable" arm (exported for testing); widened pluginScopeOrFallback / pluginVersion / pluginReasons switches
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - availableRowMessage emits status "unsupported" on the resolved.state === "unsupported" arm; PluginRenderStatus widened; stale collapse comments refreshed (filter logic unchanged)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` - command-local unsupported render arm, status, and union member
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - extracted buildNotInstalledPathRow helper deriving status from resolved.state
- `tests/architecture/notify-closed-set-locks.test.ts` - tripwire bumped to 23 / 18
- `tests/shared/notify-v2.test.ts` - byte-exact ⊖ (unsupported) renderer cases
- `tests/edge/handlers/tools.test.ts` - projectRowStatus("unsupported") unit test
- `tests/orchestrators/plugin/list.test.ts` - flipped lsp/unsup rows to ⊖ (unsupported); structural stays ⊘
- `tests/orchestrators/plugin/info.test.ts` - flipped path-resolvable parseable-unsupportable hooks rows to (unsupported)
- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` - clarified comments (brace content pinned; outer token differs by surface)
- `tests/architecture/catalog-uat.test.ts` - flipped epsilon to status "unsupported"; rewrote the stale audit comment for the de-collapsed regime
- `docs/output-catalog.md` - ⊖ glyph legend, split status-token table, corrected filter prose, flipped epsilon example, split conflated info description
- `docs/messaging-style-guide.md` - PluginUnsupportedMessage in the union + reasons/scope carve-out lists

## Decisions Made
- **Render split keys on `resolved.state`, never the reason brace.** `{unsupported hooks}` appears on both the `unsupported` (⊖) and structural `unavailable` (⊘) arms; classifying by brace would re-introduce the D-64-01 bug.
- **LSP-only plugins flip to ⊖ (unsupported).** Confirmed by code trace (lspServers ∈ UNSUPPORTED_COMPONENT_KINDS → resolver `unsupported`), contradicting the tentative CONTEXT example that guessed `unavailable`.
- **Severity preserved at info; forceHint omitted.** Token rename only; the install-error `--force` hint surface stays out of scope (keeps `(unavailable)`).
- **Catalog: epsilon (carries lsp) flips to (unsupported); delta stays structural (unavailable),** so the list catalog documents both de-collapsed byte forms.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened additional exhaustive switches the research's 11-site map omitted**
- **Found during:** Task 1 (Foundation)
- **Issue:** Adding `PluginUnsupportedMessage` to the union broke three exhaustive switches not listed in the RESEARCH blast radius: `pluginScopeOrFallback` and `pluginVersion` in `tools.ts`, and `sortPluginsInBlock`'s `scopeOf` in `list.ts` ("not all code paths return" / "lacks ending return"). `pluginReasons` (an `if`, not a switch) was also extended so the unsupported row surfaces its reasons on the tool details, mirroring the unavailable row.
- **Fix:** Added the `"unsupported"` arm to each (no scope → marketplaceScope; carries optional version; carries reasons), matching the SNM-11 `available`/`unavailable` carve-out group.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/tools.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
- **Verification:** `tsc --noEmit` clean; full suite green.
- **Committed in:** ec4af3c2 (Task 1 commit)

**2. [Rule 3 - Blocking] Added the command-local list render arm (list.messaging.ts)**
- **Found during:** Task 2 (de-collapse list.ts)
- **Issue:** The list surface has its OWN render map (`LIST_RENDER` in `list.messaging.ts`) total over `LIST_STATUSES`; emitting `status: "unsupported"` from the producer routed to a synthetic `(failed) {internal: no render arm for "unsupported"}` fallback. This file was not in the plan's Task 2 file list.
- **Fix:** Added `"unsupported"` to `LIST_STATUSES`, `PluginUnsupportedMessage` to `ListMsg`, imported `ICON_UNSUPPORTED`, and added the byte-exact `unsupported` render arm (clone of the `unavailable` arm).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
- **Verification:** list.test.ts + catalog-uat green.
- **Committed in:** abae08e5 (Task 2 commit)

**3. [Rule 3 - Blocking] Extracted buildNotInstalledPathRow to satisfy the cognitive-complexity lint gate**
- **Found during:** Task 3 (de-collapse info.ts)
- **Issue:** Deriving the row status from `resolved.state` via a ternary pushed `buildNotInstalledRow`'s cognitive complexity from 16 to 17 (sonarjs limit 15), failing `npm run lint` (NFR-6).
- **Fix:** Extracted the path-source not-installable try/catch block into a dedicated `buildNotInstalledPathRow` helper, moving the branch out of the parent.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
- **Verification:** `npm run lint` clean; full `npm run check` green.
- **Committed in:** 81896838 (Task 3 commit)

**4. [Rule 2 - Missing critical] Exported projectRowStatus + added a direct unit test**
- **Found during:** Task 1 (Foundation, Wave 0 tools coverage)
- **Issue:** The plan's Wave 0 required a tools.test.ts case proving an `unsupported` list-payload row projects to `unavailable`, but the real list producer does not emit `unsupported` until Task 2, so an end-to-end projection test was impossible in Task 1.
- **Fix:** Exported `projectRowStatus` from `tools.ts` and added a direct unit test asserting `projectRowStatus("unsupported") === "unavailable"`, exercising the new arm at runtime in Task 1.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/tools.ts, tests/edge/handlers/tools.test.ts
- **Verification:** tools.test.ts green.
- **Committed in:** ec4af3c2 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing-critical)
**Impact on plan:** All four were necessary to keep the tree compiling/green and to satisfy the Wave 0 / NFR-6 gates. No scope creep — every change is mechanical follow-on from the union widening or required by the lint/test gates. The two list.test fixtures the RESEARCH expected to flip at info.test ~1709/1752 did NOT flip (they model structural-malformed hooks → `⊘`, confirmed by passing tests); classification was done by actual resolver state, not by the research's tentative per-fixture guess.

## Issues Encountered
- The `grep`/`Read` tooling intermittently returned false-empty results mid-session; cross-checked with `sed` and `tsc` (authoritative) — the `ResolvedPluginUnsupported` type referenced by the new info.ts helper resolves correctly and `npm run check` is green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The three-way render grammar (`○`/`●` available/installed, `⊖` unsupported, `◉` force-installed, `⊘` unavailable/blocked/failed) is now complete and byte-consistent across list and info.
- **Known follow-up (out of scope, deferred):** the install-error surface (`requireInstallable` → `PluginShapeError` + `--force` hint) still renders `(unavailable)` for a force-installable plugin, so the same plugin shows `(unsupported)` on list/info but `(unavailable)` on the install error. CONTEXT locked scope to the two list/info collapse points only; this cross-surface inconsistency is a candidate for a future phase (RESEARCH Open Question 1 / Assumption A2).

## Self-Check: PASSED

- SUMMARY.md present on disk.
- All three task commits found in history: ec4af3c2, abae08e5, 81896838.
- `npm run check` green end-to-end (typecheck + lint + format:check + unit + integration).

---
*Phase: 72-unsupported-render-token*
*Completed: 2026-06-29*
