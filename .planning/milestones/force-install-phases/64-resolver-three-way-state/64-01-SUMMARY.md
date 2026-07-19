---
phase: 64-resolver-three-way-state
plan: 01
subsystem: domain
tags: [typescript, typebox, discriminated-union, resolver, nfr-7, resolver-state]

# Dependency graph
requires:
  - phase: prior-resolver-work
    provides: binary installable resolver union, requireInstallable gate, NFR-7 compile contract
provides:
  - Three-way ResolvedPlugin union (state installable | unsupported | unavailable)
  - unsupported arm carries pluginRoot + full component payload (force-degradable)
  - unavailable minimal arm (state/name/notes) with pluginRoot compile-stripped (NFR-7)
  - Structural-precedence two-accumulator decision (structural defect wins)
  - requireForceInstallable gate (admits installable | unsupported, throws on unavailable)
  - Migrated consumers (list, info, edge-deps) reading r.state
affects: [force-install, resolver-render-markers, info-surface, list-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-literal discriminant state: installable|unsupported|unavailable (TypeBox Type.Union, NO discriminator option)"
    - "Two-accumulator resolver decision with structural precedence (D-64-07)"
    - "Minimal arm strips fields to compile-enforce NFR-7 non-readability"
    - "Independent info-surface component re-derivation for the minimal unavailable arm"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/domain/index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - tests/domain/resolver.types.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts

key-decisions:
  - "unsupported arm carries the FULL installable payload (not just lists) per A1, so force-install and info enumeration have the fields they read"
  - "unavailable arm is minimal (state/name/notes); info re-derives its components independently from the marketplace entry + conventional locations rather than reading the stripped fields"
  - "Dropped ResolvedPluginNotInstallable export (no union arm); migrated its sole consumer (hooks-foundation NFR-7 guard) to ResolvedPluginUnavailable"
  - "Single atomic commit: pre-commit stashes unstaged changes and runs npm typecheck, so the compiler-coupled union + all consumers must land together"

patterns-established:
  - "Pattern: three-arm literal-tagged TypeBox union narrowed by switch (r.state)"
  - "Pattern: structural-precedence decision splits dirty (structural) from partial.unsupported (component) signal"
  - "Pattern: requireForceInstallable widened-target assertion gate beside requireInstallable"

requirements-completed: [RSTATE-01, RSTATE-02, RSTATE-03, RSTATE-04]

# Metrics
duration: 32min
completed: 2026-06-27
---

# Phase 64 Plan 01: Resolver Three-Way State Summary

**Replaced the resolver's binary `installable: true | false` union with a three-way `state: installable | unsupported | unavailable` discriminant, splitting the decision into structural-defect vs unsupported-component signals (structural precedence) and adding the `requireForceInstallable` gate, with NFR-7 refined so `pluginRoot` is compile-unreadable on the minimal `unavailable` arm.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-06-27T03:07:43Z
- **Completed:** 2026-06-27T03:39:18Z
- **Tasks:** 3 (delivered in 1 atomic commit; see Deviations)
- **Files modified:** 18 (5 production, 13 test)

## Accomplishments
- Three-arm `ResolvedPlugin` union: `installable` and `unsupported` carry `pluginRoot` + the full component payload (D-64-06); `unavailable` is minimal (`state`, `name`, `notes`) and never carries `pluginRoot` (D-64-05). NFR-7 is compile-enforced by `@ts-expect-error` on the `unavailable` arm.
- Two-accumulator decision with structural precedence (D-64-07): `dirty` (structural) is checked before `partial.unsupported.length`, so a both-defects plugin resolves `unavailable` and never leaks `pluginRoot` through the `unsupported` arm. Every `preflightStages` short-circuit routes to `unavailable`.
- `requireForceInstallable` gate added beside `requireInstallable`: admits `installable | unsupported`, throws on `unavailable` (D-64-04). Exported and test-covered; no production caller this phase.
- All resolver-union consumers re-pointed from `r.installable` to `r.state` (`list`, `info`, `edge-deps`). `info` re-derives the minimal `unavailable` arm's components independently (entry-declared + conventional locations) so byte output for malformed-hooks path-source rows is preserved.
- Persisted `compatibility.installable` boolean left untouched (out of scope); no `persistence/` or `reconcile/` files modified.

## Task Commits

The three plan tasks were delivered in a single atomic commit because the change is compiler-coupled (the union type, all consumers, and all union-referencing tests must typecheck together) and the repo's pre-commit hook stashes unstaged changes before running `npm typecheck` — a partial stage would revert dependent files and fail the hook.

1. **Tasks 1-3 (union + factories + gates + consumer migration + tests)** - `34db8c75` (feat)

**Plan metadata:** committed separately (this SUMMARY + STATE/ROADMAP).

## Files Created/Modified
- `domain/resolver.ts` - Three-arm schema/types, `unsupported`/`unavailable` factories (replacing `notInstallable`), `decideResolution` two-accumulator decision, `requireForceInstallable`, updated header to D-64-01.
- `domain/index.ts` - Export `ResolvedPluginUnsupported` / `ResolvedPluginUnavailable` + `requireForceInstallable`; dropped `ResolvedPluginNotInstallable`.
- `orchestrators/plugin/list.ts` - `if (resolved.state === "installable")` for the `(available)` row.
- `orchestrators/plugin/info.ts` - Branch on `resolved.state`; added `deriveLenientComponentPaths` + `buildNonInstallableRowFields` so the `unavailable` arm re-derives components without reading stripped fields.
- `orchestrators/edge-deps.ts` - `installable = resolved.state === "installable"`.
- `tests/domain/resolver.types.test.ts` - Rewritten for three arms (positive `pluginRoot` on installable+unsupported, `@ts-expect-error` on unavailable, `requireForceInstallable` excludes unavailable).
- `tests/domain/resolver-strict.test.ts` / `resolver-loose.test.ts` - Migrated assertions per the false-split map; added RSTATE-02 precedence fixtures and `requireForceInstallable` gate tests.

## Decisions Made
- **Full payload on `unsupported` (A1):** kept `componentPaths`/`mcpServers`/`hooksConfigPath`/`orphanRewake` on the `unsupported` arm (not just the lists D-64-06 names) so the future force-install path and info's unsupported-row enumeration have the fields they read. Confirmed against existing info byte-contract tests.
- **`unavailable` component rendering:** for the minimal arm, `info` re-derives component paths from the marketplace entry's declared paths plus the conventional `<pluginRoot>/{skills,commands,agents}` locations and walks them via the existing `composeResolvedComponents` (which tolerates missing dirs). This preserves the malformed-hooks path-source `info` rows (INFO-05) without reading the arm's stripped fields (honors D-64-05).
- **Dropped `ResolvedPluginNotInstallable`:** it no longer maps to a union arm; its only consumer (the `hooks-foundation` NFR-7 type guard) was migrated to `ResolvedPluginUnavailable`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migrated additional compiler-surfaced consumers not in the plan's file list**
- **Found during:** Task 2/3 (typecheck enumeration, the intent of D-64-03)
- **Issue:** Beyond the plan's listed files, `tests/architecture/hooks-foundation.test.ts`, `tests/domain/resolver-comp01.test.ts`, and 7 `tests/bridges/**` fixture files read `r.installable` or construct `installable: true` literals; the new union broke their typecheck.
- **Fix:** Migrated `r.installable` reads to `r.state`, `installable: true` fixtures to `state: "installable"`, and the `ResolvedPluginNotInstallable` guard to `ResolvedPluginUnavailable`. No behavior change.
- **Files modified:** `tests/architecture/hooks-foundation.test.ts`, `tests/domain/resolver-comp01.test.ts`, `tests/bridges/{agents/stage,commands/discover,commands/stage,integration-foreign-content,integration-materialization-gate,integration,skills/discover,skills/stage}.test.ts`
- **Verification:** `npm run typecheck` green; all affected suites pass.
- **Committed in:** `34db8c75`

**2. [Rule 3 - Blocking] Added independent component re-derivation in info.ts for the minimal `unavailable` arm**
- **Found during:** Task 2 (info.ts migration)
- **Issue:** The plan assumed info already had a re-derivation that does not read the arm's stripped fields, but `composeResolvedComponents` requires `componentPaths`, which the minimal `unavailable` arm drops. Without re-derivation, the byte-contract INFO-05 tests (malformed-hooks path-source enumerating on-disk skills/commands) would break, and `info.test.ts` is not in scope to change.
- **Fix:** Added `deriveLenientComponentPaths(entry)` (entry-declared + conventional locations) and `buildNonInstallableRowFields` to synthesize the component source for the `unavailable` arm; `unsupported` still reads its own payload.
- **Files modified:** `orchestrators/plugin/info.ts`
- **Verification:** Full `tests/orchestrators/plugin/info.test.ts` passes (96 tests incl. INFO-02/INFO-05/SURF-01/WR-02 byte-contract rows).
- **Committed in:** `34db8c75`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking, compiler/byte-contract).
**Impact on plan:** Both required to keep `npm run check` green and the byte contract intact. No scope creep — the persisted `compatibility.installable` boolean and `persistence/`/`reconcile/` were not touched.

## Deferred Issues

- **Flaky test `tests/orchestrators/marketplace/autoupdate.test.ts:674`** (logged in `deferred-items.md`): intermittently fails (~1 in 3) only under the full `npm test` suite; passes deterministically in isolation (20/20). Uses NO resolver code — exercises the persisted `compatibility.installable` boolean. The added fast in-memory resolver tests perturbed concurrent timing and surfaced a pre-existing latent `withHermeticHome` isolation race. Out of Phase 64 scope (resolver refactor); belongs to marketplace/test-infra owners. The resolver work itself is fully deterministic (typecheck, lint, format, and all resolver/info/list/edge-deps/bridges suites pass every run).

## TDD Gate Compliance

Task 3 was tagged `tdd="true"`, but `tdd_mode` is `false` for this phase and the implementation already existed from Task 1, so the tests are migrations/extensions rather than RED-driving-new-impl. The repo's pre-commit `npm typecheck` gate forbids committing a RED state, so the standard RED-then-GREEN commit pair is not expressible here; tests and implementation are green in a single commit.

## Issues Encountered
- Initial commit rejected by `gitlint` (title 73 > 72 chars); shortened the title and re-committed. No `--amend` used (the failed hook meant the commit never happened).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Type-level foundation for force-install is in place: `unsupported` (force-degradable) vs `unavailable` (force cannot help) are now distinguishable, and `requireForceInstallable` is exported and locked by tests for Phase 65 to wire the `--force` flag.
- Plan 64-02 (render-time per-kind unsupported markers, D-64-02) is the remaining Phase 64 work.

## Self-Check: PASSED

- All listed created/modified files exist on disk.
- Commit `34db8c75` present in git history.
- Artifact `contains` checks pass (unsupported literal, `requireForceInstallable` re-export, `@ts-expect-error` in types test).

---
*Phase: 64-resolver-three-way-state*
*Completed: 2026-06-27*
