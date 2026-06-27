---
phase: 65-force-install-update
plan: 02
subsystem: api
tags: [typescript, force-install, resolver-gate, edge-handler, degrade]

# Dependency graph
requires:
  - phase: 65-force-install-update
    plan: 01
    provides: "MaterializablePlugin union alias, requireForceInstallable gate (Phase 64), --force recognition in the shared edge positional parser, force boolean on ParsedMapModelArgs"
provides:
  - "install --force gate selection: opts.force selects requireForceInstallable so an unsupported plugin degrades (installs supported components, skips unsupported) instead of blocking (FORCE-01)"
  - "force boolean threaded InstallPluginOptions -> InstallLedgerOptions -> the runInstallLedger gate"
  - "install handler --force parse + conditional-spread threading into installPlugin (FORCE-01 parse, D-65-05)"
  - "InstallCtx.resolved + the installable holder widened to MaterializablePlugin (NFR-7, excludes unavailable)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate selection by threaded boolean: force ? requireForceInstallable : requireInstallable at the install preflight (D-65-03)"
    - "Single materialize path reused for degrade: componentPaths holds only supported kinds, so the unsupported arm skips unsupported components with no force branch (D-65-02)"
    - "Unsupported-plugin test fixture via plugin.json experimental.{themes,monitors} declaration (D-64-06)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/edge/handlers/plugin/install.test.ts

key-decisions:
  - "Reused the single supported-components materialize path for the degrade case; the only force-specific orchestrator change is gate selection (D-65-02/03)"
  - "Widened InstallCtx.resolved and the installable local to MaterializablePlugin rather than casting, keeping NFR-7 compile-enforced (the union excludes unavailable)"
  - "Left the PluginInstalledMessage success row at severity info and added no suppression logic; FORCE-04 is discharged by a guard test asserting zero warning-severity notifications on the force path"

requirements-completed: [FORCE-01, FORCE-03, FORCE-04, FORCE-05]

# Metrics
duration: ~30min
completed: 2026-06-27
---

# Phase 65 Plan 02: Force Install Degrade Gate Summary

**`install --force` selects `requireForceInstallable` so an `unsupported` plugin
degrades (installs its supported components, skips the unsupported ones) instead
of blocking, while `--force` on a fully-supported plugin is inert and never
bypasses an `unavailable`/structural failure or a missing marketplace, with no
`Warning:` summary on any force path.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-27
- **Tasks:** 2
- **Files modified:** 4 (+1 deferred-items log)

## Accomplishments

- Force-gated the install preflight (orchestrators/plugin/install.ts:~496): when
  `opts.force === true` the orchestrator calls `requireForceInstallable`,
  otherwise `requireInstallable`. Both still reject `unavailable` (FORCE-05).
- Threaded a `force` boolean through `InstallPluginOptions` and
  `InstallLedgerOptions` to the gate via the same conditional-spread shape used
  for `mapModel`.
- Widened `InstallCtx.resolved` and the `installable` holder to
  `MaterializablePlugin` (NFR-7, excludes `unavailable`); the five materialize
  phases are unchanged because `componentPaths` only ever holds supported kinds,
  so the `unsupported` arm degrades naturally with no separate branch (D-65-02).
- Parsed `--force` in the install handler: added it to the `extractLocalFlag`
  allow-list, destructured the parsed `force`, conditionally spread
  `...(force && { force: true })` into `installPlugin`, and added `[--force]` to
  USAGE (D-65-05).
- Added a `seedPathMarketplaceWithPlugin` `experimental` fixture knob driving the
  resolver `unsupported` arm (D-64-06), plus integration cases for FORCE-01
  (degrade + no-op), FORCE-03 (block without force), FORCE-04 (no warning / no
  `Warning:` summary), and FORCE-05 (force cannot bypass an `unavailable` plugin
  or a missing marketplace).
- Added handler shim cases proving the `force` boolean is load-bearing: the same
  unsupported plugin installs with `--force` and blocks without it (the only
  difference being the token), plus a `[--force]` USAGE assertion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Force-gate the install orchestrator and thread the force boolean** - `d2d0ff0b` (feat)
2. **Task 2: Parse --force in the install handler and add FORCE-01/03/04/05 tests** - `e1656f78` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Imported
  `requireForceInstallable` + `MaterializablePlugin`; added `force?` to
  `InstallPluginOptions` and `InstallLedgerOptions`; replaced the unconditional
  gate with the D-65-03 selection; widened `InstallCtx.resolved` and the
  `installable` local; threaded `force` at the `runInstallLedger` call site.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` - Added
  `--force` to the `extractLocalFlag` allow-list, destructured `force`, spread
  `force: true` into `installPlugin`, added `[--force]` to USAGE.
- `tests/orchestrators/plugin/install.test.ts` - Added the `experimental`
  fixture knob and FORCE-01/03/04/05 integration cases.
- `tests/edge/handlers/plugin/install.test.ts` - Added a minimal unsupported
  path-marketplace seeder and the force-threading + USAGE shim cases.

## Decisions Made

- None beyond the locked CONTEXT decisions (D-65-01/02/03/05). The degrade reuses
  the single materialize path; the only force-specific orchestrator change is
  gate selection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The pre-commit `trufflehog` hook cannot run inside the worktree sandbox
  (`.git` is a file, not a directory, so it fails to read the index). Per
  project CLAUDE.md this is expected; both commits used `SKIP=trufflehog` after
  confirming every other hook passes. This matches the 65-01 finding and is
  environmental, not a content issue.
- The full `npm test` run shows a non-deterministic failure in
  `tests/orchestrators/marketplace/autoupdate.test.ts`
  (`D-UPD: setMarketplaceAutoupdate leaves a disabled plugin record untouched`),
  UNRELATED to this plan: it passes 20/20 in isolation and 106/106 alongside
  this plan's own changed test files, and the failure count varies run to run
  (1 then 2). Root cause is a pre-existing parallel-test race on the global
  `process.env.HOME` (`withHermeticHome`). Logged to
  `.planning/phases/65-force-install-update/deferred-items.md`; out of scope.

## Verification

- `npm run typecheck` green.
- `node --test tests/orchestrators/plugin/install.test.ts tests/edge/handlers/plugin/install.test.ts`
  -> 86 pass / 0 fail (includes all FORCE-01/03/04/05 orchestrator cases and the
  three handler force shim cases).
- `pre-commit run --files <changed files>` (with `SKIP=trufflehog`) green:
  prettier, eslint (`import-x/order`, `@stylistic/padding-line-between-statements`),
  format check, typecheck.
- Scope: only the four plan files changed since the wave base; `update.ts`
  (owned by concurrent plan 65-03) and the shared 65-01 files were untouched; no
  file deletions; no untracked files.

## Next Phase Readiness

- The install half of the `--force` milestone is wired. Plan 65-03 delivers the
  symmetric `update --force` path (FORCE-02 + the update half of FORCE-03/04/05)
  against the resolved candidate (D-65-04), consuming the same
  `MaterializablePlugin` union and `force` parse seam from 65-01.

## Self-Check: PASSED

- All four modified files and the deferred-items log present on disk.
- Commits `d2d0ff0b` and `e1656f78` exist in history.
- `requireForceInstallable` / `MaterializablePlugin` present in the install
  orchestrator (gate branch + widened holders); `--force` parse + threading
  present in the handler.
- Typecheck green; quick test set 86 pass / 0 fail.

---
*Phase: 65-force-install-update*
*Completed: 2026-06-27*
