---
phase: 02-caller-stamped-severity-reload-reducer
plan: 02
subsystem: notifications
tags: [typescript, discriminated-union, notify, status-collapse, reload, output-preserving]

# Dependency graph
requires:
  - phase: 02-caller-stamped-severity-reload-reducer (Plan 02-01)
    provides: live caller-stamped severity/needsReload, the 5 narrowed transition interfaces (TransitionMessageBase / GATE-01), notify() as a dumb MAX/OR/tally reducer, and a fresh-disable row that stamps needsReload:true directly
provides:
  - "present plugin status collapsed into installed (RLD-04 / D-08): the list-surface inventory row is now installed + needsReload:false, with PluginInstalledMessage carrying an optional description for the PL-4 second line"
  - "disable-cascade cascade kind removed (RLD-05 / D-07): the disable reload trailer is driven by the per-row needsReload:true stamp via the RLD-02 OR-reduce, not a distinguishing cascade kind"
  - "one fewer plugin status token and one fewer cascade kind; all source consumers + test input fixtures migrated; EXPECTED rendered bytes byte-identical (docs/output-catalog.md blob OID unchanged)"
affects: [Phase 3 desired-state output + catalog supersession (OUT-08 present->installed grammar collapse), Phase 4 concern-module extraction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-token collapse: a list-only inventory token (present) folds into a transition token (installed) once a per-row stamped fact (needsReload:false) carries its only distinguishing behavior"
    - "Cascade-kind removal: a kind-level straddle (disable-cascade) is eliminated once the discriminating behavior is a per-row caller-stamped fact read by the OR-reduce"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/shared/snm37-behavioral-smoke.test.ts
    - tests/shared/snm38-indent-ladder.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "PluginInstalledMessage gained an optional description field and the two PL-4 description-emit predicates were widened to include installed -- the former present row carried a description (PL-4 second line) populated from the manifest, and dropping description on the collapse would have broken byte-identity on the catalog description-lines fixture and the notify-v2 PL-4 test."
  - "Kept the notifyWithContext kind? param (narrowed to \"cascade\") rather than deleting it, per plan -- no caller now passes a kind, but the param + the notify() exhaustiveness switch (undefined | \"cascade\") stay as the structural seam."
  - "Migrated two test files NOT in the plan's file list (snm37-behavioral-smoke, snm38-indent-ladder) in lockstep -- they carried status:\"present\" fixtures that fail to typecheck once the type is deleted (Rule 3 blocking)."

patterns-established:
  - "Collapse-with-stamp: delete the redundant discriminator (status token / cascade kind), route its behavior through a per-row caller-stamped fact, migrate the input fixtures in the SAME task, keep EXPECTED bytes byte-identical (catalog-uat + blob-OID gate)."

requirements-completed: [RLD-04, RLD-05]

# Metrics
duration: 16min
completed: 2026-06-24
---

# Phase 2 Plan 02: present->installed collapse + disable-cascade kind removal Summary

**Collapsed the list-only `present` plugin status into `installed` (RLD-04: list inventory row now stamps `needsReload:false`, `PluginInstalledMessage` gains an optional `description`) and removed the `disable-cascade` cascade kind (RLD-05: the disable reload trailer is driven by the per-row `needsReload:true` stamp via the RLD-02 OR-reduce) -- one fewer status token, one fewer cascade kind, EXPECTED bytes byte-identical (docs/output-catalog.md blob OID `8f9724c3...` unchanged).**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-24T21:34:22Z
- **Completed:** 2026-06-24T21:50:39Z
- **Tasks:** 2
- **Files modified:** 12 (across 2 task commits)

## Accomplishments
- Deleted the `present` plugin status token end-to-end: removed it from `PLUGIN_STATUSES`, deleted `PluginPresentMessage`, folded the `present` render arm into the `installed` arm, and routed the list-surface inventory row through `installed` + `needsReload:false`. `PluginInstalledMessage` gained an optional `description` and the two PL-4 description-emit predicates were widened to include `installed` so the list row's description second line still renders byte-identically.
- Removed the `disable-cascade` cascade kind: dropped it from the `kind?` union, the `notify()` exhaustiveness switch, and the `notifyWithContext` param; dropped the 5th arg from the disable dispatch. The fresh-disable row already stamps `needsReload:true` (from 02-01), so the `/reload` trailer now fires purely via the RLD-02 OR-reduce.
- Migrated every dependent test input fixture in lockstep (catalog-uat, notify-v2, snm37, snm38, enable-disable orchestrator test) so `npm run check` stays green and the catalog EXPECTED blocks stay byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: Collapse `present` into `installed` + migrate present fixtures (D-08 / RLD-04)** - `ae0b83a0` (refactor)
2. **Task 2: Remove the `disable-cascade` cascade kind + migrate UAT-03 fixtures (D-07 / RLD-05)** - `9522cc28` (refactor)

## Files Created/Modified
- `shared/notify.ts` - dropped `present` from `PLUGIN_STATUSES`, deleted `PluginPresentMessage` + removed it from the union, folded the present render arm into `installed` (added `description?` to `PluginInstalledMessage`, widened both PL-4 description predicates to `installed`); dropped `disable-cascade` from the cascade `kind?` union + the `notify()` exhaustiveness switch arm; refreshed the `shouldEmitReloadHint` and `PluginDisabledMessage` doc comments to the per-row-stamp model.
- `shared/notify-context.ts` - narrowed the `notifyWithContext` `kind?` param to `"cascade"` and rewrote its doc comment (RLD-05).
- `orchestrators/plugin/list.ts` - `installedRowMessage` now returns `installed` + `severity:"info"` + `needsReload:false` (reasons omitted, Pitfall-2 orphan-rewake suppression), return type/import switched to `PluginInstalledMessage`, the `PluginRenderStatus` alias + filter + carry-over filter + `scopeOf` switch retargeted from `present` to `installed`.
- `orchestrators/plugin/list.messaging.ts` - `LIST_STATUSES`/`ListMsg`/`LIST_RENDER` retargeted from `present` to `installed`; `PluginPresentMessage` import swapped for `PluginInstalledMessage`.
- `orchestrators/plugin/enable-disable.ts` - dropped the `disable-cascade` 5th arg from the disable `notifyWithContext` dispatch; refreshed the comments (the fresh-disable row already stamps `needsReload:true`).
- `orchestrators/plugin/enable-disable.messaging.ts` - refreshed the stale `disable-cascade`-kind doc comment to the per-row-stamp model.
- `edge/handlers/tools.ts` - merged the three `case "present":` arms into the matching `case "installed":` arms.
- `tests/architecture/catalog-uat.test.ts` - migrated 15 `present` input fixtures to `installed` + severity/needsReload; dropped `kind:"disable-cascade"` from the `disable-fresh` fixture. EXPECTED blocks untouched.
- `tests/shared/notify-v2.test.ts` - migrated the inventory + PL-4 `present` tests to `installed`; rewrote the two UAT-03 tests to assert the trailer is driven by the per-row `needsReload` stamp (the second became "a `disabled` inventory row with `needsReload:false` stays trailer-free").
- `tests/shared/snm37-behavioral-smoke.test.ts`, `tests/shared/snm38-indent-ladder.test.ts` - migrated their `present` list fixtures to `installed` + needsReload:false (Rule 3, see Deviations).
- `tests/orchestrators/plugin/enable-disable.test.ts` - refreshed the stale `disable-cascade`-kind comment (the byte assertion was unchanged).

## Decisions Made
- **`PluginInstalledMessage` gained `description?` + both PL-4 predicates widened to `installed`.** The former `present` row carried a `description` (the PL-4 4-space second line) populated from the manifest entry. Folding `present` into `installed` without carrying `description` would have dropped that second line, breaking byte-identity on the catalog `description-lines` fixture and the notify-v2 PL-4 test. Cascade `installed` rows never set `description`, so the `p.description !== undefined` guard keeps them single-line -- byte-safe.
- **Kept the `notifyWithContext` `kind?` param (narrowed to `"cascade"`)** rather than deleting it, per the plan. No caller now passes a kind, but the param plus the `notify()` exhaustiveness switch (`undefined | "cascade"` + `default: assertNever`) remain the structural seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two test files outside the plan's file list carried `present` fixtures that broke typecheck**
- **Found during:** Task 1 (`npm run check` after deleting `PluginPresentMessage`)
- **Issue:** `tests/shared/snm37-behavioral-smoke.test.ts` and `tests/shared/snm38-indent-ladder.test.ts` each construct list-surface fixtures with `status: "present"`. Deleting the `present` type made those literals a TS2322 compile error (5 sites), so `npm run check` could not go green within Task 1.
- **Fix:** Migrated their `present` fixtures to `installed` + `severity:"info", needsReload:false` (the same migration the plan prescribes for the in-scope fixtures), and refreshed the surrounding `present`-token comments. Both are list-surface assertions (no `/reload` trailer); the migration is byte-output-preserving.
- **Files modified:** tests/shared/snm37-behavioral-smoke.test.ts, tests/shared/snm38-indent-ladder.test.ts
- **Verification:** `npm run check` exit 0; both files pass; catalog blob OID unchanged.
- **Committed in:** `ae0b83a0` (Task 1 commit)

**2. [Rule 1 - Bug] Stale `disable-cascade`-kind doc comments in two files outside the plan's file list**
- **Found during:** Task 2 (grep sweep for `disable-cascade` after removing the kind)
- **Issue:** `orchestrators/plugin/enable-disable.messaging.ts` and `tests/orchestrators/plugin/enable-disable.test.ts` carried comments stating the disable trailer is "gated by the `disable-cascade` cascade kind" -- factually wrong once the kind is removed.
- **Fix:** Rewrote both comments to the per-row-stamp model (RLD-05 / D-07: the trailer fires via the row's `needsReload:true` stamp). No assertion/behavior change; the enable-disable orchestrator test byte assertion (including the `/reload` trailer) was already correct.
- **Files modified:** orchestrators/plugin/enable-disable.messaging.ts, tests/orchestrators/plugin/enable-disable.test.ts
- **Verification:** `npm run check` exit 0; catalog byte-identical.
- **Committed in:** `9522cc28` (Task 2 commit)

**3. [Rule 1 - Bug] Stale `Plan 63-04` planning-artifact reference in an edited comment block**
- **Found during:** Task 1 (editing the `PluginInstalledMessage` doc comment to add the RLD-04 note)
- **Issue:** The `PluginInstalledMessage` doc comment carried a `Plan 63-04` reference, forbidden by `.claude/rules/typescript-comments.md`. Since I was authoring this block to add the RLD-04 list-inventory note, leaving the forbidden token would have re-emitted a policy violation in a freshly-edited block.
- **Fix:** Dropped the `Plan 63-04` token, keeping the surviving requirement-ID rationale (the resolver pushes `orphanRewake` plugins into `reasons[]`).
- **Files modified:** shared/notify.ts
- **Verification:** `npm run check` exit 0; comment policy hook (fix-unicode-dashes etc.) green.
- **Committed in:** `ae0b83a0` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs).
**Impact on plan:** All three were required to keep `npm run check` green or to avoid re-emitting a known-wrong/forbidden comment in a block I was already editing. No scope creep -- the `present` collapse and `disable-cascade` removal were executed exactly as specified, EXPECTED bytes stay byte-identical, and no divergent severities (Phase 3 / D-02) were introduced.

## Issues Encountered
- **Inlined-stamp prettier reflow:** the `replace_all` fixture migration inlined `status: "installed", severity: "info", needsReload: false` on single lines; prettier reformatted them to multiline. Ran `prettier --write` on the three affected test files; the reflow is cosmetic and preserves the rendered output. `format:check` green afterward.
- **GATE-01 probe:** after Task 2, deliberately removed `needsReload` from the `list.ts` `installed` inventory literal -> `tsc --noEmit` reported `Property 'needsReload' is missing ... but required in type 'PluginInstalledMessage'` at the construction site, then restored the file (clean diff, clean typecheck). GATE-01 type-level enforcement remains live.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The collapse + kind removal are mechanism-only and output-preserving: `docs/output-catalog.md` blob OID stays `8f9724c31307e759277b69534918d28a860c54a4`; `node --test tests/architecture/catalog-uat.test.ts` byte-identical; `npm run check` exit 0.
- Phase 2 is now structurally complete for RLD-04/RLD-05: the runtime `present` token and the `disable-cascade` kind are gone, leaving the catalog markdown `present`->`installed` grammar collapse (OUT-08) and the divergent desired-state severities (D-02) for Phase 3.
- No source/fixture references to `"present"` / `PluginPresentMessage` or `disable-cascade` remain (only historical-rationale comments). GATE-01 (transition stamp omission is a TS compile error) remains live.

## Self-Check: PASSED

- Created/modified files present: all 12 modified files verified on disk (see below).
- Task commits present: `ae0b83a0`, `9522cc28` verified in `git log`.
- `npm run check` exit 0; `node --test tests/architecture/catalog-uat.test.ts` passes; `git diff docs/output-catalog.md` empty; working-tree blob OID `8f9724c3...` unchanged; GATE-01 TS error proven live and reverted.

---
*Phase: 02-caller-stamped-severity-reload-reducer*
*Completed: 2026-06-24*
