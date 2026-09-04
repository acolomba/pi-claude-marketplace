---
phase: 111-non-hook-component-bridges
plan: 31
subsystem: testing
tags: [typescript, node-test, skills, unstage, filesystem, direct-coverage]
dependency-graph:
  requires:
    - phase: 111-29
      provides: Final skill fixture consumers localized before cleanup
  provides:
    - Canonical direct owner for the skills unstage bridge
    - Complete direct coverage for the skills unstage source
    - Removal of four handed-off skill fixtures
  affects: [phase-111-verification, security-review, skills-bridge]
tech-stack:
  added: []
  patterns:
    - Case-owned filesystem scenarios with complete expected state
    - Test-context built-in substitution for deterministic filesystem failures
key-files:
  created: []
  modified:
    - tests/bridges/skills/unstage.test.ts
  deleted:
    - tests/bridges/_fixtures/test-plugin/skills/acme-knowledge/SKILL.md
    - tests/bridges/_fixtures/test-plugin/skills/acme-knowledge/resources/lookup.json
    - tests/bridges/_fixtures/test-plugin/skills/helper/SKILL.md
    - tests/bridges/_fixtures/unparseable-skill-plugin/skills/bad-skill/SKILL.md
key-decisions:
  - Kept the production skills unstage source byte-for-byte unchanged.
  - Used test-context filesystem substitution to expose race and removal failures through the public export.
  - Deleted the four handed-off fixtures only after explicit repository consumer checks passed.
requirements-completed: [MOD-04]
metrics:
  duration: 23 min
  completed: 2026-08-30
status: complete
actuals:
  tokens: 4114
  tasks: 2
  commits: 2
---

# Phase 111 Plan 31: Skills Unstage Direct Owner Summary

The skills unstage bridge now has one fixture-free direct owner that proves exact cleanup, preservation, validation, idempotence, and filesystem failures with complete direct coverage.

## Performance

- **Duration:** 23 min
- **Tasks:** 2
- **Files changed:** 5
- **Implementation commits:** 2
- **Estimated tokens:** 12,000
- **Actual diff tokens:** 4,114

## Accomplishments

- Replaced the shared-fixture owner with seven case-owned filesystem scenarios.
- Proved ordered multi-name removal, missing-path idempotence, unsafe-name rejection, symlink rejection, a disappearance race, an ordinary removal failure, and foreign-path preservation.
- Reached 100 percent direct coverage for `unstage.ts`: 10/10 branches, 1/1 functions, and 57/57 lines.
- Removed the four fixtures handed off by P111-29 after exact-path and owner-root consumer audits passed.
- Preserved `extensions/pi-claude-marketplace/bridges/skills/unstage.ts` byte-for-byte at SHA-256 `280d1a70ed7373d358c95fa345228929ae73921c1b9740584776220ab3a109ca`.

## Task Commits

1. **Task 1: Establish the canonical skills/unstage owner** - `a4eeaa5a`
2. **Task 2: Close edge and direct-coverage evidence** - `17d88c6e`

## Files Changed

- `tests/bridges/skills/unstage.test.ts` - Adds the normalized direct owner and full public lifecycle matrix.
- `tests/bridges/_fixtures/test-plugin/skills/acme-knowledge/SKILL.md` - Deleted after the consumer audit.
- `tests/bridges/_fixtures/test-plugin/skills/acme-knowledge/resources/lookup.json` - Deleted after the consumer audit.
- `tests/bridges/_fixtures/test-plugin/skills/helper/SKILL.md` - Deleted after the consumer audit.
- `tests/bridges/_fixtures/unparseable-skill-plugin/skills/bad-skill/SKILL.md` - Deleted after the consumer audit.

## Decisions Made

- The test helper allocates only fresh paths. Each case owns its inputs, filesystem state, expected values, and cleanup.
- Deterministic test-context substitution covers `ENOENT` and `EACCES` branches without a production seam or export.
- The source file, production API, and runtime behavior remain unchanged.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `node --test tests/bridges/skills/unstage.test.ts` - passed with no skipped or todo tests.
- `npm run typecheck` - passed.
- `npx eslint tests/bridges/skills/unstage.test.ts` - passed.
- `npx prettier --check tests/bridges/skills/unstage.test.ts` - passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/unstage.ts` - passed at 10/10 branches, 1/1 functions, and 57/57 lines.
- Repository exact-path checks found no remaining consumer for any deleted fixture.
- The skills owner fixture-root scan found no `_fixtures`, `FIXTURE_ROOT`, or `FIXTURES` reference.
- `git diff --check` - passed.

## Security and Stub Review

- Unsafe names and symlink destinations are rejected at the existing public boundary.
- Removal failures preserve the thrown error identity and already-applied state.
- No network, authentication, file-access, schema, or other trust-boundary surface was added.
- No stub, placeholder, skipped test, todo test, coverage pragma, or test-only production surface remains.

## Self-Check: PASSED

- The canonical owner and summary exist.
- Both task commits exist.
- All four handed-off fixtures are absent.
- The production source hash is unchanged.
