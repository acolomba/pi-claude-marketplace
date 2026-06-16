---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 03
subsystem: ui
tags: [typescript, closed-set, notify-grammar, hook-warning, atomic-supersession]

# Dependency graph
requires:
  - phase: 58-matcher-parser-tool-name-mapping-supportability-gate
    provides: D-58-01 atomic-supersession pattern (REASONS + catalog + UAT fixture in ONE commit)
  - phase: 62-asyncrewake-registry-background-spawn
    provides: asyncRewake / rewakeMessage / rewakeSummary schema admission in HookHandlerEntry
provides:
  - REASONS tuple += "orphan rewake" (length lock: 31 -> 32)
  - ResolvedPlugin (both variants) optional orphanRewake?: boolean field
  - PartialResolution optional orphanRewake?: boolean
  - detectOrphanRewake(parsed: HooksConfig) helper in domain/resolver.ts
  - applyHooksConfig writes partial.orphanRewake on the parseHooksConfig success branch
  - PluginInstalledMessage gains optional reasons?: readonly ContentReason[]
  - renderPluginRow "installed" arm threads p.reasons through composeReasons
  - docs/output-catalog.md (installed) {orphan rewake} rows (single-reason + soft-dep mix)
  - tests/architecture/catalog-uat.test.ts byte-equality fixtures for both catalog rows
affects: [63-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-58-01 atomic-supersession enforced by catalog-UAT byte-equality test (a partial landing fails in isolation -- no manual git-staging check needed)"
    - "absent-vs-false invariant on optional boolean flags (mirror hooksConfigPath discipline: only SET when true so the spread `partial.X !== undefined && { X: partial.X }` omits the field on the false case)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-types.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "[Phase 63] PluginInstalledMessage gains optional reasons?: readonly ContentReason[] (Rule 2 architectural extension): SURF-05's `(installed) {orphan rewake}` row cannot land without it. The plan's `<must_haves>` requires the catalog row + UAT fixture to land atomically in this commit, but the existing `installed` renderer arm passes `undefined` to composeReasons -- no path for a typed reason existed. Adding the optional field + threading it through the existing composeReasons helper preserves the legacy zero-reason byte form (the spread + composeReasons return `''` when reasons is undefined and dep markers don't fire). PluginPresentMessage stays reasons-less by design (list-only inventory, not an install-cascade surface)."

patterns-established:
  - "Closed-set REASONS additions that target an existing variant must verify the variant's renderer arm reads `p.reasons` -- if not, the type seam needs a `reasons?` extension + thread-through in the same atomic commit. Rule 2 (auto-add missing critical functionality) applies; the catalog-UAT byte-equality test fails in isolation otherwise."

requirements-completed: [SURF-05]

# Metrics
duration: ~25min
completed: 2026-06-16
---

# Phase 63 Plan 03: SURF-05 Orphan-Rewake REASONS Token Summary

**Closed-set `"orphan rewake"` REASONS token + resolver-side detection + catalog/UAT landing -- atomic per D-58-01.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (folded into ONE atomic commit per D-58-01 atomic-supersession)
- **Files modified:** 7
- **Commits:** 1

## Accomplishments

- `REASONS` tuple += `"orphan rewake"` (length lock 31 → 32, length-lock test in `tests/architecture/notify-types.test.ts` updated in lockstep).
- `ResolvedPlugin` (both `installable: true` and `installable: false` schemas) and `PartialResolution` gain optional `orphanRewake?: boolean`.
- `detectOrphanRewake(parsed: HooksConfig)` helper in `domain/resolver.ts` walks handler entries; returns `true` on the first handler with `rewakeMessage !== undefined || rewakeSummary !== undefined` AND `asyncRewake !== true`.
- `applyHooksConfig` writes `partial.orphanRewake = true` ONLY on the `parseHooksConfig` success branch and ONLY when `detectOrphanRewake` returns true. Absent-vs-false invariant mirrors `hooksConfigPath` discipline so the constructor spread (`partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }`) omits the field on the no-orphan path.
- `PluginInstalledMessage` gains optional `reasons?: readonly ContentReason[]`; the `renderPluginRow` `installed` arm now threads `p.reasons` through `composeReasons` so the orphan-rewake token and any soft-dep markers share one brace block per MSG-GR-4 (`(installed) {orphan rewake, requires pi-subagents}`). The `present` arm (list-only inventory, UAT G-21-01) stays reasons-less.
- `docs/output-catalog.md` gains two new `(installed) {orphan rewake}` sections under `/claude:plugin install <plugin>@<marketplace>`: `success-with-orphan-rewake` (single-reason brace) and `success-with-orphan-rewake-and-soft-dep` (orphan-rewake comma-joined with the agents soft-dep marker).
- `tests/architecture/catalog-uat.test.ts` gains the matching byte-equality fixtures; the inverse-walk test confirms no orphan fixtures and no stale catalog annotations.

## Task Commits

Both tasks bundled into ONE atomic commit per D-58-01 atomic-supersession (the catalog-UAT byte-equality test is the enforcer; a partial landing fails in isolation):

1. **Task 1+2 combined: REASONS token + resolver detection + ResolvedPlugin field + catalog rows + UAT fixtures** — `75871ff` (feat)

## Exact line locations (post-commit file state)

- `extensions/pi-claude-marketplace/shared/notify.ts:100-113` — REASONS tuple `"orphan rewake"` member + docstring
- `extensions/pi-claude-marketplace/shared/notify.ts:578-596` (approx.) — `PluginInstalledMessage` `reasons?: readonly ContentReason[]` field + extended docstring
- `extensions/pi-claude-marketplace/shared/notify.ts:1781-1812` (approx.) — `renderPluginRow` `installed` arm threads `p.reasons` (and `present` arm kept reasons-less)
- `extensions/pi-claude-marketplace/domain/resolver.ts:58-100` — `ResolvedPluginInstallableSchema` + `ResolvedPluginNotInstallableSchema` gain `orphanRewake: Type.Optional(Type.Boolean())`
- `extensions/pi-claude-marketplace/domain/resolver.ts:200-230` — `PartialResolution.orphanRewake?: boolean`
- `extensions/pi-claude-marketplace/domain/resolver.ts:240-265` — constructor spread for `orphanRewake` in `installable` and `notInstallable`
- `extensions/pi-claude-marketplace/domain/resolver.ts:720-755` — `detectOrphanRewake` helper
- `extensions/pi-claude-marketplace/domain/resolver.ts:765-790` — `applyHooksConfig` success-branch `partial.orphanRewake = true` assignment
- `docs/output-catalog.md:348-372` — two new `(installed) {orphan rewake}` sections
- `tests/architecture/catalog-uat.test.ts:569-622` (approx.) — `success-with-orphan-rewake` + `success-with-orphan-rewake-and-soft-dep` fixtures
- `tests/architecture/notify-types.test.ts:907-918` — REASONS length lock bumped 31 → 32
- `tests/domain/resolver-strict.test.ts:254-394` — 5 SURF-05 tests
- `tests/shared/notify-v2.test.ts:4108-4150` — REASONS membership test + installed-row byte-form test

## Test count added

5 resolver tests + 2 notify tests = 7 new unit tests:

1. `SURF-05 / D-63-08: rewakeMessage without asyncRewake -> orphanRewake === true` (resolver-strict)
2. `SURF-05 / D-63-08: rewakeMessage WITH asyncRewake: true -> orphanRewake absent (no warning)` (resolver-strict)
3. `SURF-05 / D-63-08: rewakeSummary without asyncRewake -> orphanRewake === true` (resolver-strict)
4. `SURF-05 / D-63-08: multi-event / multi-group config with ONE orphan -> orphanRewake === true (one-per-plugin)` (resolver-strict)
5. `SURF-05 / D-63-08: hooks.json without any rewake fields -> orphanRewake absent` (resolver-strict)
6. `SURF-05 / D-63-08: REASONS tuple includes the literal 'orphan rewake' member` (notify-v2)
7. `SURF-05 / D-63-08: installed row renders ` `(installed) {orphan rewake}` ` via the existing reasons brace` (notify-v2)

Plus 2 catalog-UAT fixtures driven by the existing byte-equality + inverse-walk machinery: `success-with-orphan-rewake`, `success-with-orphan-rewake-and-soft-dep`.

## Verification

- `npx tsc --noEmit` — green
- `npm test` — 2232 pass / 0 fail / 1 skip (added 7 new tests + 2 catalog-UAT-driven fixtures over the Plan 63-01 baseline)
- `npm run test:integration` — 10 pass / 0 fail
- `npm run check` — green (typecheck + lint + format:check + unit + integration)
- `grep -c '"orphan rewake"' extensions/pi-claude-marketplace/shared/notify.ts` — 2 (tuple member + docstring quote)
- `grep -c "orphan rewake" docs/output-catalog.md` — 3 (section header + 2 row examples)
- `grep -c "orphan rewake" tests/architecture/catalog-uat.test.ts` — 3 (2 fixture row reasons + 1 doc-comment reference)
- `grep -v '^[[:space:]]*//' extensions/pi-claude-marketplace/shared/notify.ts docs/output-catalog.md | grep -c "lossy synthesis\|LOSSY_SYNTHESIS"` — 0 (SURF-03 stays unshipped)
- `pre-commit run --files <changed files>` — all hooks passed (trufflehog run separately, also passed)

## Decisions Made

- **PluginInstalledMessage gains optional `reasons?: readonly ContentReason[]` (Rule 2 architectural extension).** The plan's `<must_haves>` requires the `(installed) {orphan rewake}` catalog row + UAT fixture to land atomically in this commit (D-58-01 atomic-supersession), but the existing `renderPluginRow` `installed` arm passed `undefined` to `composeReasons` -- no path for a typed reason on an installed row existed. The minimal seam is to add `reasons?` on `PluginInstalledMessage` and thread `p.reasons` through `composeReasons` in the `installed` arm. The legacy zero-reason byte form is preserved (when `p.reasons` is undefined and no soft-dep markers fire, `composeReasons` returns `""` and `joinTokens` collapses the slot, identical to the prior output). `PluginPresentMessage` stays reasons-less by design -- it is the list-only inventory variant (UAT G-21-01) and SURF-05 surfaces only on the install-cascade row, not on steady-state inventory.

- **Absent-vs-false invariant on `partial.orphanRewake` (mirror `hooksConfigPath` discipline).** The plan documented "absence-or-false invariant"; the implementation chose absence to match the existing `hooksConfigPath` pattern. The resolver sets `partial.orphanRewake = true` only when `detectOrphanRewake` returns true; the constructor spread (`partial.orphanRewake !== undefined && { orphanRewake: partial.orphanRewake }`) omits the field entirely on the no-orphan path. Consumers read `r.orphanRewake === true` (Plan 63-04 will follow this convention).

- **Atomicity enforced by the catalog-UAT byte-equality test, not by manual git-staging.** Per D-58-01 / the plan's `<must_haves>` truth: a tuple-only commit would have a passing test (the test doesn't observe the tuple directly); a catalog-only commit would fail because the fixture asserts a row that needs the renderer thread; a fixture-only commit would fail because no catalog annotation exists for the fixture key. The four-part bundle is mutually load-bearing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] PluginInstalledMessage carried no `reasons` field**

- **Found during:** Task 2 fixture design (composing the `(installed) {orphan rewake}` UAT fixture row).
- **Issue:** The plan's `<must_haves>` requires a `(installed) {orphan rewake}` catalog row to land in this commit, but the existing `PluginInstalledMessage` type has no `reasons` field and the renderer's `installed` arm passes `undefined` to `composeReasons`. The fixture row `reasons: ["orphan rewake"]` would not typecheck against the existing type, and even if forced, the renderer would drop the value.
- **Fix:** Added `readonly reasons?: readonly ContentReason[]` to `PluginInstalledMessage` (optional, preserves legacy zero-reason byte form). Split the renderer's combined `case "installed": case "present":` arm into two arms; the `installed` arm threads `p.reasons` through `composeReasons`; the `present` arm passes `undefined` (list-only inventory stays reasons-less per UAT G-21-01). Updated the `_NoReasonsOnInstalled` type-level negative test in `tests/architecture/notify-types.test.ts` to a positive `_Assert_InstalledReasonsOptional` proof (the optional-vs-required discipline is preserved -- `installed.reasons` is `readonly ContentReason[] | undefined`, not `readonly ContentReason[]`).
- **Files modified:** extensions/pi-claude-marketplace/shared/notify.ts, tests/architecture/notify-types.test.ts
- **Verification:** `npx tsc --noEmit` green; the legacy `installed` fixtures (success, success-with-soft-dep, etc.) byte-render identically (no `reasons` field set ⇒ `composeReasons(undefined, ...)` ⇒ same output as before). The new `success-with-orphan-rewake` fixture passes byte-equality.
- **Committed in:** 75871ff (atomic commit per D-58-01)

**2. [Rule 1 - Bug] Lint-style padding-line-between-statements errors after resolver edits**

- **Found during:** `npm run check` (lint stage)
- **Issue:** ESLint flagged two `@stylistic/padding-line-between-statements` errors at the new `detectOrphanRewake` helper and the new `partial.orphanRewake = true` assignment inside `applyHooksConfig`.
- **Fix:** `npx eslint --fix extensions/pi-claude-marketplace/domain/resolver.ts` inserted the required blank lines.
- **Files modified:** extensions/pi-claude-marketplace/domain/resolver.ts
- **Verification:** `npm run lint` green.
- **Committed in:** 75871ff (folded into the atomic commit)

**3. [Rule 3 - Blocking] Prettier reformatting of resolver-strict test bodies**

- **Found during:** `npm run check` (format:check stage)
- **Issue:** New multi-line test cases in `tests/domain/resolver-strict.test.ts` violated prettier formatting after the initial write.
- **Fix:** `npx prettier --write tests/domain/resolver-strict.test.ts`.
- **Files modified:** tests/domain/resolver-strict.test.ts
- **Verification:** `npm run format:check` green.
- **Committed in:** 75871ff (folded into the atomic commit)

---

**Total deviations:** 3 auto-fixed (1 Rule-2 architectural, 1 lint, 1 formatting)
**Impact on plan:** Deviation #1 extends the type seam by one optional field on `PluginInstalledMessage` and one short branch in the renderer; the plan explicitly allowed touching `shared/notify.ts` and explicitly deferred install.ts row composition to Plan 63-04, so the extension lives on the correct side of that line. Plan 63-04 will read `resolved.orphanRewake` and push `"orphan rewake"` into the cascade row's `reasons[]` -- the seam this plan establishes.

## Issues Encountered

- None beyond the deviations above.

## User Setup Required

None.

## Next Phase Readiness

Plan 63-04 (install.ts cascade row composition for orphan-rewake) can now:
1. Read `resolved.orphanRewake === true` from any installable `ResolvedPlugin`.
2. Push `"orphan rewake"` into the install row's `reasons[]` array.
3. Pass the row through the existing v1.4 NotificationMessage cascade -- no new notify call site, no new top-level message variant (RECON-04 / IL-2 honored).
4. Rely on the catalog-UAT byte-equality test continuing to guard the row form: the two fixtures landed in this plan exercise the full render pipeline end-to-end.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notify.ts` — FOUND (modified)
- `extensions/pi-claude-marketplace/domain/resolver.ts` — FOUND (modified)
- `docs/output-catalog.md` — FOUND (modified)
- `tests/architecture/catalog-uat.test.ts` — FOUND (modified)
- `tests/architecture/notify-types.test.ts` — FOUND (modified)
- `tests/domain/resolver-strict.test.ts` — FOUND (modified)
- `tests/shared/notify-v2.test.ts` — FOUND (modified)
- Commit `75871ff` — FOUND in git log

---
*Phase: 63-lifecycle-cascade-user-facing-surface-docs*
*Completed: 2026-06-16*
