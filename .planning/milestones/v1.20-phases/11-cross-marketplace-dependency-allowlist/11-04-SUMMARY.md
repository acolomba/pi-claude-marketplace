---
phase: 11-cross-marketplace-dependency-allowlist
plan: "04"
subsystem: dependency-install
tags: [dependencies, marketplace, allowlist, install-cascade]
requires:
  - phase: 11-cross-marketplace-dependency-allowlist
    provides: validated cached marketplace allowlist and cross-marketplace notification reason from plans 11-01 and 11-03
provides:
  - root marketplace authorization for new foreign dependencies in direct install cascades
  - separate recorded-key exemption and traversal-stop sets
  - exact fail-clean refusal rows and matching dependency documentation
affects: [install-cascade, missing-dependency-install, dependency-closure, dependency-docs]
tech-stack:
  added: []
  patterns: [scope-selected cached root manifest policy, closure authorization before lookup]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/dependency-closure.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-cascade.test.ts
    - tests/domain/dependency-closure.test.ts
    - tests/orchestrators/plugin/install-cascade.messaging.test.ts
    - tests/architecture/dependency-doc-agreement.test.ts
    - docs/dependency-resolution.md
    - scripts/check-unused-type-members.contracts.json
key-decisions:
  - "Use the requested root marketplace's parsed list for every new foreign edge, including descendants of disabled records."
  - "Keep target-scope recorded keys separate from traversal stops so recorded disabled plugins remain exempt while their missing descendants are checked."
requirements-completed: [XMKT-01, XMKT-02]
actuals:
  tokens: 9437
  tasks: 2
  commits: 1
commits: 1
plan_head_before: 4f7692478bc45c345351767470a9cfc5ffeef2b3
duration: 34min
completed: 2026-09-23
status: complete
coverage:
  - id: D1
    description: A direct path-source install permits a listed foreign dependency and refuses an added but unlisted one without persistent changes.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install-flow.test.ts#XMKT-01 direct install
        status: pass
      - kind: unit
        ref: tests/domain/dependency-closure.test.ts#XMKT-01
        status: pass
    human_judgment: false
  - id: D2
    description: Recorded disabled foreign dependencies remain exempt while the direct-install walk reads through them.
    requirement: XMKT-02
    verification:
      - kind: unit
        ref: tests/domain/dependency-closure.test.ts#XMKT-02 a recorded disabled foreign key may be read through without permission
        status: pass
    human_judgment: false
  - id: D3
    description: The refusal renders the declaring plugin, policy root, and both remedies through the existing failure composer and matches the guide.
    requirement: XMKT-01
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/install-cascade.messaging.test.ts#XMKT-01 a foreign refusal names its declarer and root marketplace with both remedies
        status: pass
      - kind: unit
        ref: tests/architecture/dependency-doc-agreement.test.ts#RESV-06 the failure table names every reason the cascade stamps, and no others
        status: pass
    human_judgment: false
---

# Phase 11 Plan 04: Root marketplace install policy summary

Direct installs now use the requested marketplace's validated allowlist to authorize each new foreign dependency before catalog lookup or materialization.

## Accomplishments

- Added an optional install policy to the pure closure walk. The install cascade always supplies it; the existing enable traversal omits it because enable does not install new plugins.
- Kept the full target-scope recorded inventory separate from the traversal-stop set. A disabled recorded dependency can be read through without losing its exemption, while a new descendant still needs root permission.
- Loaded the root policy from the same scope-selected cached manifest used by install resolution at both cascade entry points. An absent source leaves the existing marketplace-absent result reachable; a malformed present manifest keeps its typed validation failure.
- Rendered `cross-marketplace` with the blocked key, declarer, policy root, and both remedies. Updated the guide and exhaustive failure-table test.

## Task Commit

- `f226bcf9` — `feat: enforce root marketplace dependency allowlist` (Tasks 1 and 2, one coupled failure-union and caller contract).

## Verification

- The full install-flow test file and the combined cascade, documentation-agreement, and catalog-contract test command passed.
- The direct closure and message-composer test files passed 30/30 and 31/31 tests. Their direct coverage passed at 62/62 and 58/58 branches, respectively, with all lines covered.
- `npm run typecheck`, `npm run lint:type-members`, and `npm run lint:type-members:negative` passed; the negative gate passed all 7 controls after an escalated retry for sandbox child-process EPERM.
- Focused ESLint and Prettier passed. The final eleven-file `SKIP=trufflehog pre-commit run --files ...` passed every applicable hook, including direct coverage and both type-member gates.
- `fallow audit --base HEAD` found no introduced issues in the eleven changed files. The JSON agent gate returned `warn`, not `fail`, against its wider merge-base scope.
- The full `npm run check` remains assigned to the orchestrator's post-merge wave gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added the two mirrored direct-coverage tests**

- **Found during:** Clean pre-commit gate after Tasks 1 and 2.
- **Issue:** New closure-policy and failure-composer branches were uncovered in their paired tests. The plan's nine-file list omitted both mirrored test files.
- **Fix:** With orchestrator authorization, added focused policy and exact-message cases in `tests/domain/dependency-closure.test.ts` and `tests/orchestrators/plugin/install-cascade.messaging.test.ts`. The coverage pin was not changed.
- **Verification:** Both source files reached 100% direct line, branch, and function coverage; the complete pre-commit rerun passed.
- **Commit:** `f226bcf9`.

### TDD Sequence

The Task 1 test was added after the implementation, so no intentional RED evidence or separate RED commit was recorded. The two real install cases and all required gates passed before the coupled contract commit. This is a process deviation from the task's `tdd="true"` marker.

## Issues Encountered

- The initial pre-commit run widened the new Markdown table through `mdformat`; the clean rerun passed.
- Git LFS metadata and the negative-control child process required escalated sandbox access. No package download or network operation was needed.

## Known Stubs

None.

## Next Phase Readiness

The required root-policy input and failure union are coherent for the graph, installed-record, and reload-edge cases in plans 11-05 and 11-06.

## Self-Check: PASSED

The summary and all eleven changed files exist. Commit `f226bcf9` exists, and the measured production-commit count is one. No tracked file was deleted.
