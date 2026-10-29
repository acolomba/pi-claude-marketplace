---
phase: 10-lifecycle-test-and-harness-gaps
plan: "05"
subsystem: plugin-lifecycle-orchestration
tags: [diagnostics, redaction, git-failures, package-install, cucumber]
requires:
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "03"
    provides: typed install cascade outcomes and shared install-flow diagnostics
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "04"
    provides: typed staging diagnostics across apply and marketplace add
provides:
  - Typed update and reinstall diagnostics that retain move warnings, MCP notices, foreign agent-index facts, and source frames
  - Shared unknown-network classification with path-redacted install failures and content-specific post-clone manifest failures
  - Per-member package notes and recorded yarn/pnpm lockfile refusal behavior
affects: [phase-10-verification, phase-11-install-flow-split, plugin-lifecycle]
actuals:
  tokens: 25063
  tasks: 3
  commits: 4
plan_head_before: af8378d05ccc3d5b30ffa07befd42bb271180d67
plan_head_after: a3dff8d130fb720e06837d2ae38bcc6786cbd4fc
tech-stack:
  added: []
  patterns:
    - Typed warning and index facts remain structured through lifecycle outcomes until command-surface rendering
    - Git failures use one shared classifier while malformed cloned content stays distinct from transport failures
    - Cascade package diagnostics are rendered under the member that produced them
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - features/plugin/install.feature
    - features/plugin/update.feature
    - features/plugin/reinstall.feature
key-decisions:
  - "Occupied-agent cascade refusals expose only the target filename and omit the misleading cascade reason."
  - "Invalid post-clone manifests use the normal update failure frame without transport-retry guidance."
  - "A yarn or pnpm lockfile is refused only when package.json actually lists installable packages; otherwise it is silent."
requirements-completed: [XPH-01, XPH-02]
coverage:
  - id: D1
    description: Update and reinstall retain move warnings, MCP notices, foreign agent-index facts, source frames, and filename-only occupied-agent refusals.
    requirement: XPH-02
    verification:
      - kind: e2e
        ref: "features/plugin/update.feature and features/plugin/reinstall.feature#lifecycle diagnostic scenarios"
        status: pass
      - kind: unit
        ref: "update-swap, dependency-move, dependency-settle, materialize-latest, and reinstall-flow owner tests"
        status: pass
    human_judgment: false
  - id: D2
    description: Fetch and update classify unknown network failures consistently, install causes redact absolute paths, and invalid cloned manifests do not suggest retrying.
    requirement: XPH-01
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature, features/plugin/update.feature, and features/marketplace/update.feature#failure diagnostic scenarios"
        status: pass
      - kind: unit
        ref: "git-failure-classifiers, fetch, update-flow, marketplace update, and install messaging owner tests"
        status: pass
    human_judgment: false
  - id: D3
    description: Cascade members retain their package notes and yarn/pnpm lockfile-only plugins follow the recorded refusal rule.
    requirement: XPH-02
    verification:
      - kind: e2e
        ref: "features/plugin/install.feature#yarn, pnpm, and dependency package-note scenarios"
        status: pass
      - kind: unit
        ref: "package-install, install-cascade, and install-flow owner tests with 100% direct coverage"
        status: pass
    human_judgment: false
duration: 59min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 05: Lifecycle Diagnostic and Package-Note Gaps Summary

**Lifecycle operations now retain typed warnings and index facts, redact failure paths before rendering, classify network failures consistently, and keep package-manager notes with the cascade member that produced them.**

## Performance

- **Duration:** 59 min
- **Started:** 2026-10-28T01:10:16Z
- **Completed:** 2026-10-28T02:08:55Z
- **Tasks:** 3
- **Files modified:** 37

## Accomplishments

- Preserved dependency move warnings, MCP notices, foreign agent-index rows, reinstall source frames, and filename-only occupied-agent refusals through update and reinstall outcomes.
- Unified unknown git failure classification across fetch and update, redacted absolute install paths at model construction, and separated malformed cloned content from transport retry guidance.
- Retained package notes on cascade members and pinned the recorded yarn/pnpm refusal wording without adding support for another package manager.
- Added command-surface scenarios for every changed user-visible result and completed the repository-wide check gate.

## Task Commits

1. **Task 1: Preserve move warnings and foreign agent-index facts** - `291b2df1`
2. **Task 2: Align failure classification and redaction** - `0114015c`
3. **Task 3: Pin package-note and refused-lockfile behavior** - `c6f07f10`
4. **Acceptance correction: Align clone-backed invalid-manifest scenario** - `a3dff8d1`

## Verification

| Check | Result |
| --- | --- |
| Task owner suites and focused lifecycle scenarios | Passed |
| Changed source/test direct coverage pairs | 100% passed |
| Marketplace invalid-manifest outline | 4 scenarios, 52 steps passed |
| Full `npm run check` | Passed |
| Full Cucumber suite | 1,105 scenarios, 11,289 steps passed |
| Direct coverage aggregate | 304 LCOV records merged |
| Commit hooks | Passed on all four commits |

## Decisions Made

- Warning, MCP, and agent-index facts remain typed until the existing outcome renderer selects their user-visible frame. Rendered strings are not parsed to recover facts.
- The shared unknown-network classifier owns transport classification for both fetch and update. A cloned manifest that fails schema validation is a content failure and receives no transport retry hint.
- Package inspection precedes lockfile selection. A yarn or pnpm lockfile produces the recorded refusal note only when `package.json` lists packages that would otherwise be installed.
- A dependency package note is projected beneath that dependency's own install diagnostic, not beneath the root plugin.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical carrier] Extended typed diagnostic carriers through the actual update and install cascade seams**

- **Found during:** Tasks 1 and 3
- **Issue:** The planned facts crossed shared dependency-settle, materialization, cascade, and install-flow boundaries that were not all named in the plan's file list.
- **Fix:** Extended the existing typed outcomes through those boundaries and added owner tests for each changed source/test pair.
- **Files modified:** `dependency-move.ts`, `dependency-settle.ts`, `materialize-latest.ts`, `update-flow.ts`, `install-cascade.ts`, `install-flow.ts`, and their owner tests.
- **Verification:** Owner suites, focused scenarios, commit hooks, and direct coverage passed.
- **Committed in:** `291b2df1`, `c6f07f10`

**2. [Rule 1 - Stale expectation] Updated clone-backed invalid-manifest acceptance rows to the new content-failure frame**

- **Found during:** Full `npm run check` after Task 3
- **Issue:** The URL and GitHub examples still expected the retired `clone advanced` wording even though Task 2 intentionally removed that misleading transport frame.
- **Fix:** Aligned both rows with `Failed to update marketplace`, retaining the manifest schema cause.
- **Files modified:** `features/marketplace/update.feature`
- **Verification:** The four-source scenario outline and the full 1,105-scenario Cucumber suite passed.
- **Committed in:** `a3dff8d1`

**3. [Rule 3 - Blocking coverage] Added direct owner cases for the shared diagnostic branches**

- **Found during:** Task commit hooks
- **Issue:** Broad scenarios proved the output but did not directly own the root/member diagnostic split and member warning carrier branches.
- **Fix:** Added exact owner cases in `install-cascade.test.ts` and `install-flow.test.ts` and retained the root-only discovery renderer for its existing branch.
- **Verification:** Direct coverage passed for `package-install`, `install-cascade`, and `install-flow`.
- **Committed in:** `c6f07f10`

**Total deviations:** 3 auto-fixed (1 missing carrier, 1 stale acceptance expectation, 1 blocking coverage gap).
**Impact on plan:** The extra files and cases are the minimum required to carry and prove the planned facts across existing shared seams. No new command surface or package-manager support was added.

## Issues Encountered

- The first full gate correctly exposed the two stale clone-backed acceptance rows. After the focused correction, the complete gate passed.
- Commit-hook direct coverage exposed branches that the command-surface scenarios reached indirectly; each received a paired owner case before the task commit.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Phase 10's lifecycle diagnostic and package-note residue is closed. Phase 11 can split `install-flow.ts` against the verified typed carrier and rendering behavior without preserving obsolete failure frames.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The planned mitigations are present: absolute paths are redacted before notification model construction, transport guidance depends on typed failure classification, and the supported package-manager allowlist remains unchanged.

## Self-Check: PASSED

- All 37 modified files and this summary exist.
- Commits `291b2df1`, `0114015c`, `c6f07f10`, and `a3dff8d1` are ancestors of `HEAD`.
- The full `npm run check` gate passed on the combined plan tree.

---

*Phase: 10-lifecycle-test-and-harness-gaps*
*Completed: 2026-10-27*
