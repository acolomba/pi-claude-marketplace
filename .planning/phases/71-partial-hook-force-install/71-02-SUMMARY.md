---
phase: 71-partial-hook-force-install
plan: 02
subsystem: api
tags: [hooks, resolver, partition, supportability, force-degrade, typescript]

# Dependency graph
requires:
  - phase: 71-partial-hook-force-install
    plan: 01
    provides: "partitionHooks + parseHooksConfig filtered subset + dropped enumeration"
  - phase: 64-resolver-three-way-state
    provides: "three-way resolver state + structural precedence (D-64-07)"
provides:
  - "applyHooksConfig split: supportability drops -> partial.unsupported + droppedHooks (unsupported); structural !ok -> dirty (unavailable)"
  - "PartialResolution.droppedHooks field threaded into installable + unsupported arms"
  - "ResolvedPlugin installable/unsupported arms carry optional droppedHooks (DroppedHookSchema)"
  - "Q2 empty-subset: Stop-only config routes unsupported with no hooksConfigPath and hooks absent from supported"
  - "detectOrphanRewake runs over the filtered subset (T-71-04)"
affects: [info enumeration (Plan 03), force-install staging (Plan 04), reason rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-way hooks verdict in a single helper: structural dirty | supportability unsupported | clean installable"
    - "Optional discriminated-union field carried on the resolver arm via a TypeBox union schema"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - tests/domain/resolver-strict.test.ts

key-decisions:
  - "droppedHooks modelled as a resolver-local TypeBox union (DroppedHookSchema) with event typed as plain string; the arm only carries the enumeration for downstream rendering, not re-validation"
  - "PartialResolution.droppedHooks is a mutable DroppedHook[] copied from the readonly parsed.dropped so it spreads cleanly into the schema-typed arm without a cast"
  - "Empty-subset detection uses Object.keys(value).length > 0 to gate the supported push + hooksConfigPath + orphan probe (Q2)"

requirements-completed: [PHOOK-02, PHOOK-03]

coverage:
  - id: D1
    description: "A parseable hooks.json with an unsupportable handler + supported components resolves unsupported (force-degradable), routing the dropped signal to partial.unsupported (kind 'hooks') and never the structural dirty accumulator"
    requirement: PHOOK-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#PHOOK-02 / D-71-03: hooks.json with a kept group + dropped Stop event -> unsupported"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#D-71-02: intra-event matcher mix keeps the clean group, drops the regex group -> unsupported"
        status: pass
    human_judgment: false
  - id: D2
    description: "A structural hooks defect (invalid JSON / shape mismatch) still resolves unavailable (structural precedence, D-64-07 preserved)"
    requirement: PHOOK-03
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#D-57-04: hooks/hooks.json present + parse-fails -> notInstallable + parse-detail note"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#D-57-04: hooks/hooks.json with structural-shape mismatch -> notInstallable"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Stop-only config (empty filtered subset) resolves unsupported with droppedHooks recorded, no hooksConfigPath, and hooks absent from supported (Q2)"
    requirement: PHOOK-02
    verification:
      - kind: unit
        ref: "tests/domain/resolver-strict.test.ts#D-71-03 / Q2: Stop-only config (empty subset) -> unsupported, no hooksConfigPath, hooks absent from supported"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-06-28
status: complete
---

# Phase 71 Plan 02: Resolver partial-hook verdict split Summary

**Split `applyHooksConfig`'s single "hooks failed -> dirty -> unavailable" verdict into three outcomes -- structural defect stays `unavailable`, a parseable config with supportability drops routes to `partial.unsupported` + `droppedHooks` (force-degradable `unsupported`), and the kept non-empty subset still materializes -- so partial-hook plugins become force-installable while structural precedence is preserved.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-28
- **Tasks:** 2
- **Files modified:** 2 (1 source, 1 test)

## Accomplishments
- `applyHooksConfig` now reads `parsed.dropped` (forwarded through `readStandaloneHooks`) and, on a successful parse with `dropped.length > 0`, pushes kind `"hooks"` into `partial.unsupported` and sets `partial.droppedHooks` -- never incrementing the structural `dirty` accumulator (D-71-03 / PHOOK-02).
- The structural `!hooksResult.ok -> notes + return true` arm is unchanged: invalid JSON / shape mismatch / X1 table-desync still resolve `unavailable` (PHOOK-03 / D-64-07).
- Q2 empty-subset: the kept-handler materialization (push `"hooks"` to supported, record `hooksConfigPath`, run `detectOrphanRewake`) is gated on a non-empty filtered subset, so a Stop-only config stages nothing but still routes `unsupported` via `droppedHooks`.
- `detectOrphanRewake` runs over the filtered subset only (T-71-04) -- a dropped handler's orphan field cannot raise a false `{orphan rewake}`.
- `droppedHooks` threaded: optional field on `PartialResolution`, spread into both the `installable()` and `unsupported()` arm builders, and added to both result-arm TypeBox schemas via a new resolver-local `DroppedHookSchema`.

## Task Commits

1. **Task 1: split applyHooksConfig + thread droppedHooks** - `e87e7b61` (feat)
2. **Task 2: resolver-strict cases for partial-hook unsupported + structural-precedence keep** - `414710bf` (test)

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/resolver.ts` - `DroppedHook` import; `DroppedHookSchema` union; `droppedHooks` optional on both result-arm schemas + `PartialResolution`; spreads in `installable()` / `unsupported()`; `readStandaloneHooks` forwards `parsed.dropped`; `applyHooksConfig` three-way verdict split.
- `tests/domain/resolver-strict.test.ts` - `readFile`/`fileURLToPath` imports + `FIXTURE_DIR`/`fixture()` helper; three degradable-hook cases (kept-group + dropped event, intra-event matcher mix, Stop-only empty subset); structural cases retained unchanged.

## Decisions Made
- **droppedHooks on the result arm modelled as a resolver-local TypeBox union.** The result types are `Type.Static`-derived, so carrying `droppedHooks` on the `installable`/`unsupported` arms required a schema. `DroppedHookSchema` mirrors the `components/hooks.ts` `DroppedHook` union but types `event` as a plain string (the arm only carries the enumeration for `info` rendering, not re-validation). `DroppedHook` (narrower `BucketAEvent`) remains assignable to the wider schema-static type.
- **PartialResolution.droppedHooks is a mutable `DroppedHook[]` copied from the readonly `parsed.dropped`.** A `readonly DroppedHook[]` is not assignable to the mutable schema-static array, so `applyHooksConfig` copies with `[...hooksResult.dropped]`, mirroring the `hooksConfigPath`/`orphanRewake` spread idiom without a cast.
- **Empty-subset gate via `Object.keys(value).length > 0`.** The filtered subset is `{}` for a Stop-only config; gating the supported push / `hooksConfigPath` / orphan probe on a non-empty object implements Q2 cleanly and also avoids claiming `"hooks"` supported for a degenerate empty config.

## Deviations from Plan

None - plan executed exactly as written. The new `DroppedHookSchema` and the result-arm schema fields are the schema-level realization of the plan's "spread it into BOTH arm builders" instruction (the arms are TypeBox-derived, so the field had to exist on the schema for the spread to typecheck and for downstream consumers to read `r.droppedHooks`).

## Issues Encountered

**Expected wave-transitional breakage (owned by Plan 03).** `npm test` reports exactly **2 failures**, both in `tests/orchestrators/plugin/info.test.ts` (the INFO-05 lenient-reader cases: `Stop (unsupported)` and the mixed `PostToolUse` + `Stop` row). These now resolve `unsupported` (force-degradable) rather than `unavailable {unsupported hooks}`, which is precisely the lenient->strict info-reader flip assigned to Plan 03. The plan-scoped verification is green: `npm run typecheck`, `node --test tests/domain/resolver-strict.test.ts` (39/39), and `node --test tests/domain/components/hooks.test.ts` (48/48). The closed-set REASONS vocabulary is untouched (no `shared/notify.ts` change), so the count stays 32 (D-71-04) and the closed-set tripwire is unchanged.

## Self-Check: PASSED

- Files: `resolver.ts` and `resolver-strict.test.ts` present and committed.
- Commits `e87e7b61`, `414710bf` present on `features/force-install`.
- `droppedHooks` field/spreads present on both arms; `npm run typecheck` green; resolver-strict 39/39 + hooks 48/48 green; only the 2 documented INFO-05 failures remain (owned by Plan 03).

## Next Phase Readiness
- `ResolvedPluginUnsupported.droppedHooks` now carries the dropped enumeration -- Plan 03 can migrate the `info` reader from lenient to strict and enumerate the dropped handlers (D-71-05), and Plan 04 can stage the byte-exact filtered surface.
- The 2 failing INFO-05 tests are the expected hand-off to the info-enumeration migration plan; no action needed here.

---
*Phase: 71-partial-hook-force-install*
*Completed: 2026-06-28*
