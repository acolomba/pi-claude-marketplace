---
phase: 80-remote-status-glyph-reassignment-warm-cache-resolution
plan: 01
subsystem: shared-notify-closed-set
tags: [closed-set-amendment, glyph-reassignment, notify, catalog-uat, RSTA-01, RSTA-02]
status: complete
requirements: [RSTA-01, RSTA-02]
dependency_graph:
  requires:
    - "shared/notify.ts closed-set tuples (STATUS_TOKENS / PLUGIN_STATUSES) + ICON constants"
    - "catalog-uat bidirectional byte-equality runner (tests/architecture/catalog-uat.test.ts)"
  provides:
    - "remote (STATUS_TOKENS + PLUGIN_STATUSES member)"
    - "ICON_REMOTE = ◌ (U+25CC)"
    - "ICON_DISABLED = ◍ (U+25CD, reassigned)"
    - "PluginRemoteMessage interface + PluginNotificationMessage union member"
    - "PluginInfoRowBase.status widened with remote"
  affects:
    - "Plans 80-02/03/04 emit remote / PluginRemoteMessage (only exist after this commit)"
tech_stack:
  added: []
  patterns:
    - "closed-set append-last amendment (partially-available / disabled precedent)"
    - "SNM-11 bare-row carve-out family (available | partially-available | unavailable | remote)"
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - tests/architecture/notify-closed-set-locks.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
decisions:
  - "remote projects to the coarse available tool bucket (D-80-05: install still offers it)"
  - "remote joins the SNM-11 no-scope carve-out family (no scope bracket, no reasons)"
metrics:
  duration_min: 22
  completed: 2026-07-14
  tasks_completed: 1
  files_modified: 12
---

# Phase 80 Plan 01: Remote closed-set token + glyph reassignment amendment Summary

Landed the `(remote)` plugin-status token and the `◌`/`◍` glyph reassignment as ONE atomic green commit (RSTA-01 vocabulary + RSTA-02 lockstep): `remote` appended last to both closed-set tuples, `ICON_REMOTE = "◌"` added, `ICON_DISABLED` reassigned to `"◍"`, the bare `PluginRemoteMessage` variant + its list/info renderer arms added, and every tripwire test, catalog byte form, catalog-UAT fixture, and the style guide updated in lockstep so the amendment cannot land partially.

## What Was Built

- **notify.ts closed-set tuples** — `"remote"` appended LAST to `STATUS_TOKENS` (23→24) and `PLUGIN_STATUSES` (18→19), below the reload-hint trigger window, with the `Extract<PluginStatus, ...>` coupling comment (RSTA-01 / D-80-06).
- **notify.ts glyph constants** — `ICON_DISABLED` reassigned `"◌"`→`"◍"` (U+25CD, D-80-01); new sibling `ICON_REMOTE = "◌"` (U+25CC). The `will disable` / `disabled` renderer arms consume `ICON_DISABLED` through the constant, so the glyph flowed through automatically with no arm-code change.
- **notify.ts variant + union** — `PluginRemoteMessage` (status `"remote"`, optional `version`/`description`; NO scope per SNM-11, NO reasons per D-80-03) modeled on `PluginAvailableMessage`; added to the `PluginNotificationMessage` union.
- **notify.ts render surfaces** — `PluginInfoRowBase.status` Extract widened with `"remote"`; plugin-row renderer `case "remote"` (bare row, `ICON_REMOTE`, `(remote)`, no `composeReasons`); `pluginInfoStatusGlyph` `case "remote": return ICON_REMOTE`; PL-4 description guard widened to include `remote`.
- **Tripwire tests** — closed-set length locks bumped 23→24 / 18→19; grammar-invariant `WILL_TOKEN_RE` char class `[●○⊘◌]`→`[●○⊘◍]` and `DISABLED_TOKEN_RE` anchor `^◌ `→`^◍ ` (+ its describe title).
- **Catalog + catalog-UAT** — new `remote-inventory`, `remote-inventory-with-description` (list) and `remote-single-scope` (info) FIXTURES paired with new `<!-- catalog-state: remote-... -->` blocks; the three existing disabled/will-disable catalog byte blocks flipped `◌`→`◍`; glyph legend split, `<icon>` enumeration + status-token table updated.
- **Style guide** — `PluginRemoteMessage` variant line added; `PluginDisabledMessage` annotated `◍`; stale prose discriminator counts dropped per the guide's own "do not re-enumerate in prose" rule.

## Deviations from Plan

The plan's `files_modified` listed 6 files; the atomic amendment required 6 additional files. Every one is a compile-time or byte-form consequence of growing the `PluginNotificationMessage` union / reassigning `ICON_DISABLED`, and per the RSTA-02 lockstep discipline they MUST land in the same commit or `npm run check` fails. None are architectural (no Rule 4 needed).

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exhaustive `PluginNotificationMessage["status"]` switches in `tools.ts`**
- **Found during:** Task 1 (typecheck surfaced `TS2366`/`TS7030` "lacks ending return").
- **Issue:** Three exhaustive switches (`projectRowStatus`, `pluginScopeOrFallback`, `pluginVersion`) over the union status became non-total once `remote` joined the union — the `remote` list-surface row is reachable, so it could not stay in the "unreachable → throw" group.
- **Fix:** `projectRowStatus` maps `remote`→`"available"` (D-80-05: install still offers remote); `pluginScopeOrFallback` groups `remote` with the SNM-11 no-scope family returning `marketplaceScope`; `pluginVersion` groups `remote` with the optional-`version?` arms.
- **Files modified:** extensions/pi-claude-marketplace/edge/handlers/tools.ts

**2. [Rule 3 - Blocking] `list.ts::sortPluginsInBlock` `scopeOf` `assertNever`**
- **Found during:** Task 1 (typecheck: `PluginRemoteMessage is not assignable to parameter of type 'never'`).
- **Issue:** The `scopeOf` exhaustive switch's `assertNever(p)` tail saw the new union member.
- **Fix:** Added `case "remote":` to the SNM-11 no-scope arm returning `marketplaceScope` (the plan flagged this as an in-scope `assertNever` site).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/list.ts

**3. [Rule 1 - Byte-form correctness] `◌`→`◍` disabled/will-disable byte expectations in 4 non-tripwire test files**
- **Found during:** Task 1 (after the tripwire suites went green, the broader suites asserted the old `◌` disabled/will-disable byte forms).
- **Issue:** `notify-v2.test.ts` (8), `list.test.ts` (4), `info.test.ts` (2), `enable-disable.test.ts` (2) hard-code the rendered disabled/will-disable row bytes; the `ICON_DISABLED` reassignment changed the render to `◍`.
- **Fix:** Flipped all 16 literal `◌`→`◍` occurrences (none paired with `(remote)`, so the replacement was unambiguous). This is exactly the byte-form lockstep the RSTA-02 discipline requires in the same commit.
- **Files modified:** tests/shared/notify-v2.test.ts, tests/orchestrators/plugin/list.test.ts, tests/orchestrators/plugin/info.test.ts, tests/orchestrators/plugin/enable-disable.test.ts

## Verification

- `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/notify-grammar-invariant.test.ts tests/architecture/catalog-uat.test.ts` — 15/15 pass (forward + inverse catalog-UAT walks green).
- `npm run check` (typecheck + ESLint + Prettier + test + test:integration) — exit 0, every `# fail 0`.
- Acceptance-criteria greps confirmed: `ICON_REMOTE = "◌"` ×1, `ICON_DISABLED = "◍"` ×1, `interface PluginRemoteMessage` ×1 with no `scope`/`reasons`; no new `Phase/Plan/Wave` planning refs in any touched file.

## Notes for Downstream Plans (80-02/03/04)

- `"remote"` / `PluginRemoteMessage` / `ICON_REMOTE` now exist and are safe to emit.
- No resolver arm was added (NFR-7 preserved) — `remote` is a classification-layer/plugin-status token only. `ManifestEntryClassification` grows in Plan 02, not here.
- The three git-source `"available"` short-circuits (`probeManifestEntry`, `list.ts::availableRowMessage`, `info.ts::buildNotInstalledRow`), the completion-cache schemaVersion 5→6 bump, `INSTALL_STATUSES`, and `list --remote` are all Wave-B work (Plans 02/03/04) and were intentionally NOT touched here.

## Self-Check: PASSED

- SUMMARY.md exists at the plan directory.
- Commit `124e88bd` present in git log (single atomic commit, 13 files, no deletions).
- Committed `notify.ts` contains `ICON_REMOTE = "◌"`, `ICON_DISABLED = "◍"`, and `interface PluginRemoteMessage` (3/3 artifact greps matched).
