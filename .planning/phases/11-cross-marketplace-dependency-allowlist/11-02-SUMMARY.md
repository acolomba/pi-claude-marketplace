---
phase: 11-cross-marketplace-dependency-allowlist
plan: "02"
subsystem: marketplace-info
tags: [marketplace, allowlist, notifications, catalog]
requires:
  - phase: 11-cross-marketplace-dependency-allowlist
    provides: validated cached marketplace manifest allowlist from plan 11-01
provides:
  - per-scope marketplace info display of nonempty parsed allowlists
  - single-line display escaping for control and bidirectional characters
  - exact 228-state output catalog contract
affects: [marketplace-info, notification-grammar, catalog-uat]
tech-stack:
  added: []
  patterns: [typed cached-manifest projection, display-only JSON escaping]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - tests/orchestrators/marketplace/info.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/architecture/catalog-uat/fixtures/marketplace-info.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/architecture/catalog-uat/catalog-parser.test.ts
    - docs/output-catalog.md
    - scripts/check-unused-type-members.contracts.json
key-decisions:
  - "Display the typed parsed list verbatim in source order using compact JSON array notation."
  - "Escape terminal controls only in the rendered copy; preserve the manifest values used for policy matching."
requirements-completed: [XMKT-01]
actuals:
  tokens: 2709
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 8a6834c2137c242dae342b12776051421d4f7113
duration: 60min
completed: 2026-09-23
status: complete
coverage:
  - id: D1
    description: Nonempty parsed policies appear in each marketplace info scope, with omission and safe escaping.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/marketplace/info.test.ts#marketplace info shows each scope's own allowlist
        status: pass
      - kind: unit
        ref: tests/shared/notification-grammar.test.ts#marketplace info escapes hostile allowlist values on one line without mutation
        status: pass
    human_judgment: false
  - id: D2
    description: The public catalog pins the nonempty allowlist line and 228 exact states.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/architecture/catalog-uat/catalog-contract.test.ts#catalog contract matches all 20 fixture modules to 228 exact documented states
        status: pass
    human_judgment: false
---

# Phase 11 Plan 02: Marketplace allowlist info summary

Marketplace info now shows each scope's validated nonempty allowlist as an escaped, compact JSON array, with exact output pinned in the 228-state catalog.

## Accomplishments

- Projected `allowCrossMarketplaceDependenciesOn` from the cached typed manifest into `MarketplaceInfoMessage.allowedMarketplaces` without normalizing its values.
- Rendered `allowed_marketplaces:` after `description:` when the list is nonempty. Absent and empty lists omit it; duplicates and empty strings remain visible. JSON quoting plus explicit C1, line-separator, and bidirectional-control escaping keep the policy on one physical line.
- Added exact single-scope and both-scope notification tests, a malformed-policy failure test, a typed catalog fixture, and an independently written rendered example. The catalog has 228 states and 31,560 rendered UTF-8 bytes.

## Task Commits

1. `48021400` — `feat: show marketplace dependency allowlist in info`
2. `f3128044` — `docs: pin marketplace allowlist info output`

## Test Results

- The focused marketplace info and notification grammar tests passed 122/122.
- Direct coverage passed for `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`: 32/32 branches, 4/4 functions, and 207/207 lines. It passed for `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: 205/205 branches, 49/49 functions, and 1686/1686 lines.
- The catalog contract and parser tests passed 16/16.
- `npm run lint:type-members` and `npm run lint:type-members:negative`: passed in the complete-tree pre-commit run. The latter confirmed its five negative controls.
- `SKIP=trufflehog pre-commit run --files ...`: passed for all ten changed files before the Task 1 commit, and passed for the four Task 2 files before that commit. The worktree skip is required because TruffleHog's Git mode cannot read a linked-worktree index.
- `fallow audit --base HEAD --format json --quiet --explain --gate-marker agent`: passed before each task commit, with no introduced findings.

## Decisions Made

- Reused the cached manifest loader for info, preserving its typed invalid-manifest failure path and offline, read-only behavior.
- Kept escaping local to the notification renderer. Policy matching continues to consume the unmodified parsed strings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Repaired a moved type-member contract coordinate**

- **Found during:** Task 1 pre-commit gate.
- **Issue:** Adding the renderer helper moved `isDescriptionBearingRow` from line 1543 to 1557, making the existing contract anchor invalid.
- **Fix:** Changed only that contract's `id` and `filter` coordinates; owner, member, category, and rationale are unchanged.
- **Files modified:** `scripts/check-unused-type-members.contracts.json`.
- **Verification:** Positive type-member gate and all negative controls passed.
- **Commit:** `48021400`. This Task 2-listed contract file had to join Task 1 so its mandatory pre-commit gate could pass.

**2. [Rule 3 - Blocking issue] Updated the catalog parser's independent total**

- **Found during:** Task 2 catalog verification.
- **Issue:** The parser test hardcoded 227 even though this task adds the 228th state; the plan's file list omitted the parser test.
- **Fix:** Updated only its test title and expected total to 228, with orchestrator authorization.
- **Files modified:** `tests/architecture/catalog-uat/catalog-parser.test.ts`.
- **Verification:** Catalog contract and parser tests passed 16/16.
- **Commit:** `f3128044`.

The plan's combined direct-coverage command accepts one source path per invocation, so the two requested pairs were checked in separate invocations.

## TDD Gate Compliance

The Task 1 target assertion failed before implementation, and GSD's persisted RED evidence returned `RED_EVIDENCE_OK`. A separate RED commit was not possible under this repository's mandatory pre-commit direct-coverage hook: it requires the changed test to pass before any commit. The test and implementation were therefore committed together in `48021400`; the RED/GREEN commit separation was not met.

## Issues Encountered

- Git LFS metadata was read-only in the sandbox, so unrestricted `git status` could not clean three tracked media files. Exact-path Git operations and approved metadata access kept them untouched.
- An intermediate pre-commit run detected concurrent Task 2 edits and was discarded. The stable-tree run then passed every hook before either task was committed.
- The full `npm run check` was left for the orchestrator's post-merge wave gate, as assigned; focused tests, direct coverage, type-member controls, pre-commit, and Fallow passed in this worktree.

## Known Stubs

None.

## Threat Flags

None. The changed files add no network endpoint, auth path, file-access boundary, or schema trust boundary beyond the plan's notification projection.

## Self-Check: PASSED

All ten changed files and this summary exist. Both task commits exist, and the measured plan commit count is two. Neither task commit deleted a tracked file.
