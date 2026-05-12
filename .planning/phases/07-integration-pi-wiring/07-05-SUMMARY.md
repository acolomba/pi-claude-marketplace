---
phase: 07-integration-pi-wiring
plan: 05
subsystem: testing
tags: [e2e, ci, pi-runtime, pinned-sha, github-actions]

requires:
  - phase: 07-integration-pi-wiring
    provides: [pi-entrypoint, resources-discover, cross-process-lock]
provides:
  - Pinned anthropics/claude-plugins-official e2e fixture catalog
  - Layer A e2e tests for reload discovery and soft-dependency degradation
  - Real Pi package-bin smoke under isolated HOME and cwd
  - CI and nightly e2e workflow split for pinned PR vs floating-main runs
affects: [phase-7-verification, ci, e2e-validation, nightly-drift]

tech-stack:
  added: []
  patterns:
    - Pinned upstream checkout cloned into a tmpdir per e2e environment
    - Nightly failure classification by snapshot diff presence
    - Package-bin smoke using pi --offline --no-extensions --extension

key-files:
  created:
    - tests/e2e/_pinned-sha.ts
    - tests/e2e/_targets.ts
    - tests/e2e/_helpers.ts
    - tests/e2e/resources-discover.test.ts
    - tests/e2e/install-soft-deps.test.ts
    - tests/e2e/pi-runtime-smoke.test.ts
    - tests/e2e/nightly-classification.test.ts
    - tests/e2e/_fixtures/6196a61bdeece7b9889ecda1e45bd7085788ae75/marketplace.json
    - .github/workflows/e2e-nightly.yml
  modified:
    - package.json
    - .github/workflows/ci.yml
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - tests/integration/concurrent-install-child.ts
    - tests/integration/concurrent-install.test.ts

key-decisions:
  - "PR e2e uses the pinned upstream SHA 6196a61bdeece7b9889ecda1e45bd7085788ae75; nightly e2e uses floating main."
  - "Real Pi smoke uses the installed pi package bin in offline help mode with explicit extension loading, not agent-core."
  - "The default npm test script now excludes tests/e2e and tests/integration; CI invokes those gates separately."

patterns-established:
  - "E2E helper owns upstream fetch, isolated HOME/cwd, mock ExtensionAPI command dispatch, and state inspection."
  - "Soft-dep matrix tests assert canonical warnings without invoking installed resource bodies or LLM APIs."

requirements-completed: [NFR-2, NFR-3, NFR-11]

duration: 7 min
completed: 2026-05-11
---

# Phase 07 Plan 05: Live E2E and CI Validation Summary

**Pinned upstream e2e coverage with real Pi package-bin smoke, reload discovery assertions, soft-dep matrix checks, and CI/nightly workflow gates**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-11T20:30:22Z
- **Completed:** 2026-05-11T20:37:20Z
- **Tasks:** 3
- **Files modified:** 20

## Accomplishments

- Added auditable pinned-SHA e2e inputs for `anthropics/claude-plugins-official` at `6196a61bdeece7b9889ecda1e45bd7085788ae75`.
- Added e2e tests that clone/fetch the pinned upstream checkout, add the marketplace from the real local source tree, install representative plugins, and assert `/reload` resource discovery.
- Added a 2x2 agents/MCP soft-dependency matrix and a real `pi` package-bin smoke with isolated `HOME` and cwd.
- Split unit, integration, pinned e2e, and nightly e2e scripts, then wired CI plus a floating-main nightly workflow.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: pinned target catalog assertions** - `48e10e3` (test)
2. **Task 1 GREEN: pinned e2e fixtures and targets** - `d795f86` (feat)
3. **Task 2 RED: e2e coverage behavior tests** - `e164c46` (test)
4. **Task 2 GREEN: e2e helpers and runtime smoke implementation** - `1031170` (feat)
5. **Task 3: CI scripts and nightly workflow** - `ad4733f` (chore)

**Plan metadata:** included in final docs commit.

## Files Created/Modified

- `tests/e2e/_pinned-sha.ts` - Exports the pinned upstream SHA and manual refresh policy.
- `tests/e2e/_targets.ts` - Documents four representative targets, source locations, soft-dep matrix flags, and rationale.
- `tests/e2e/_fixtures/6196a61bdeece7b9889ecda1e45bd7085788ae75/**` - Snapshot fixture metadata for selected marketplace/plugin manifests.
- `tests/e2e/_helpers.ts` - Shared e2e harness for upstream checkout fetch, isolated HOME/cwd, mock Pi dispatch, runtime smoke, and nightly classification.
- `tests/e2e/resources-discover.test.ts` - Verifies staged skills/prompts surface via `resources_discover` after a reload event.
- `tests/e2e/install-soft-deps.test.ts` - Runs the agents/MCP 2x2 loaded/unloaded warning matrix.
- `tests/e2e/pi-runtime-smoke.test.ts` - Loads the extension through the real `pi` package bin under isolated runtime roots.
- `tests/e2e/nightly-classification.test.ts` - Verifies upstream-change vs regression classification logic.
- `package.json` - Splits unit, integration, pinned e2e, and nightly e2e scripts.
- `.github/workflows/ci.yml` - Adds integration, pinned e2e, and package dry-run gates.
- `.github/workflows/e2e-nightly.yml` - Adds scheduled and manual floating-main e2e runs.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` - Hardens MCP soft-dep probing for mixed tool lists.
- `tests/integration/concurrent-install-child.ts` and `tests/integration/concurrent-install.test.ts` - Lint-only cleanup required by the commit hook.

## Decisions Made

- Used the package's own `pi` bin for the required runtime smoke because research found `@earendil-works/pi-agent-core` lacks the needed extension-loading API.
- Kept e2e source installs pointed at real directories inside the fetched upstream checkout; fixture JSON is only a deterministic snapshot and is not treated as installable source.
- Kept `npm run check` unit-only by narrowing `npm test`; CI now owns integration/e2e/package gates explicitly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hardened MCP soft-dependency probing for tools without sourceInfo**
- **Found during:** Task 2 (soft-dep matrix e2e)
- **Issue:** `hasLoadedPiMcpAdapter` could throw when a non-MCP tool lacked `sourceInfo`, causing the whole probe to report unloaded even when a later `mcp` tool was present.
- **Fix:** Treat `getAllTools()` entries structurally and optional-chain only after casting to a partial shape.
- **Files modified:** `extensions/pi-claude-marketplace/platform/pi-api.ts`
- **Verification:** `PI_CM_E2E_REF=pinned node --test tests/e2e/resources-discover.test.ts tests/e2e/install-soft-deps.test.ts tests/e2e/pi-runtime-smoke.test.ts` passed.
- **Committed in:** `1031170`

**2. [Rule 3 - Blocking] Fixed pre-existing lint blockers surfaced by commit hooks**
- **Found during:** Task 2 commit
- **Issue:** The repository-wide lint hook surfaced `no-misused-promises` and padding-line violations in the concurrent-install integration files from the prior plan, blocking the e2e helper commit.
- **Fix:** Wrapped the async child message handler in a voided helper call and added required blank lines.
- **Files modified:** `tests/integration/concurrent-install-child.ts`, `tests/integration/concurrent-install.test.ts`
- **Verification:** `npm run lint` and commit hooks passed.
- **Committed in:** `1031170`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were required to make the planned e2e matrix and repository hooks green. No feature scope was added.

## Issues Encountered

- Prettier hooks reformatted new e2e files during initial commit attempts; files were re-staged and committed with hooks enabled.
- `npm pack --dry-run` emits a very large file manifest because the repository package includes planning and GSD assets; the dry-run completed successfully and produced no tarball side effect.

## User Setup Required

None - no external service configuration required. E2E tests use anonymous GitHub fetch by default and only rely on `GITHUB_TOKEN` opportunistically for rate-limit fallback.

## Known Stubs

None. Stub-pattern scan found no TODO/FIXME/placeholder text or UI-facing empty data stubs in the new e2e files or modified platform file.

## Threat Flags

None. New network and runtime-smoke surfaces are covered by T-07-03 and T-07-04 in the plan threat model.

## TDD Gate Compliance

- RED commits present: `48e10e3`, `e164c46`
- GREEN commits present after RED: `d795f86`, `1031170`
- REFACTOR commits: not needed

## Next Phase Readiness

Plan 07-06 can perform validation sign-off with deterministic pinned e2e, a floating-main nightly path, and a real Pi package-bin smoke already automated. The plan-level verification gate is green.

## Verification

- `node --test tests/e2e/_targets.test.ts` passed.
- `npm run typecheck` passed during Task 1 and Task 2 verification.
- `PI_CM_E2E_REF=pinned node --test tests/e2e/resources-discover.test.ts tests/e2e/install-soft-deps.test.ts tests/e2e/pi-runtime-smoke.test.ts` passed.
- `node --test tests/e2e/nightly-classification.test.ts` passed.
- `npm run test:e2e -- tests/e2e/nightly-classification.test.ts && npm pack --dry-run` passed.
- `npm run check && npm run test:integration && npm run test:e2e && npm pack --dry-run` passed.

## Self-Check: PASSED

- Found `tests/e2e/_pinned-sha.ts`, `tests/e2e/_targets.ts`, `tests/e2e/_helpers.ts`, and all four e2e test files.
- Found `.github/workflows/e2e-nightly.yml`.
- Found commits `48e10e3`, `d795f86`, `e164c46`, `1031170`, and `ad4733f`.
- Verified plan-level check, integration, e2e, and package dry-run commands completed successfully.

---
*Phase: 07-integration-pi-wiring*
*Completed: 2026-05-11*
