---
phase: 108-domain-and-platform
plan: 07
subsystem: testing
tags: [typescript, node-test, matcher, guarded-fakes, lifecycle]

requires:
  - phase: 108-22
    provides: Guarded GitOps fake and contract carrier
provides:
  - Deterministic whole-result evidence for every accepted and rejected matcher form
  - Final seven lifecycle, reconcile, and prompt consumers migrated to guarded concern-local fakes
  - Zero generic helper imports across the declared consumer batch
affects: [108-23-helper-deletion, domain-hooks, plugin-lifecycle-tests]

actuals:
  tokens: 7726
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Literal expected matcher sets in source-defined insertion order
    - File-local compatibility bridges over guarded concern-local fakes
    - Explicit memory, local-fixture, disabled-network, and remote-allowlist boundaries

key-files:
  created: []
  modified:
    - tests/domain/components/hooks/matcher.test.ts
    - tests/orchestrators/plugin/install-auth.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/update-reinstall-auth.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/shared/device-flow-prompt.test.ts

key-decisions:
  - "Build expected matcher outputs as independent literals, preserving first-occurrence insertion order without production mapping helpers."
  - "Keep compatibility bridges file-local so the seven consumer scenarios stay unchanged while every guarded fake boundary remains explicit."
  - "Record callback-bearing Git calls locally, then remove function callbacks only at the structured-clone fake boundary."
  - "Leave the now-unused generic fixtureMarketplaceDir export for Plan 108-23, which owns generic helper deletion."

patterns-established:
  - "Matcher acceptance and rejection boundaries use equality-adjacent one-character examples and whole-value assertions."
  - "Guarded consumer adapters declare memory, network, fixture, remote URL, and call-recording boundaries at their concern-local use site."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: Matcher parsing covers match-all, literal MCP, mapped tokens, stable deduplication, mixed-token ordering, unsafe syntax, and empty alternatives.
    requirement: MOD-01
    verification:
      - kind: unit
        ref: node --test tests/domain/components/hooks/matcher.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
        status: pass
    human_judgment: false
  - id: D2
    description: All seven assigned consumers use guarded concern-local support and preserve their lifecycle, reconcile, and prompt scenarios.
    requirement: MOD-01
    verification:
      - kind: unit
        ref: node --test tests/orchestrators/plugin/install-auth.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts tests/orchestrators/plugin/update-reinstall-auth.test.ts tests/orchestrators/plugin/update.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/device-flow-prompt.test.ts
        status: pass
      - kind: integration
        ref: npm test && npm run test:integration
        status: pass
    human_judgment: false

duration: 27 min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 07: Matcher Boundaries and Guarded Consumer Migration Summary

**Deterministic matcher contract evidence plus seven lifecycle consumers running through explicit guarded concern-local boundaries**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-29T13:45:40Z
- **Completed:** 2026-08-29T14:12:27Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Made accepted matcher evidence deterministic for match-all, MCP literals, public token mappings, repeated tokens, and mixed mapped/unmapped inputs using independent whole-result literals.
- Locked regex-significant characters, empty pipe alternatives, rejected unmapped tokens, and a one-character valid/invalid MCP boundary to their public failure behavior.
- Migrated the final seven install, reinstall, update, reconcile, and device-flow prompt consumers away from generic helpers to guarded GitOps, CredentialOps, and device-flow fakes.
- Preserved all consumer scenarios, case-owned state, and cleanup while making memory, network, local fixture, remote URL, and call-recording boundaries explicit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize accepted matcher forms and whole outputs** - `4359975e` (test)
2. **Task 2: Lock unsafe, empty-alternative, and unmapped boundaries** - `12266c42` (test)
3. **Task 3: Migrate install, update, reconcile, and prompt consumers** - `4fa84d8d` (test)

## Files Created/Modified

- `tests/domain/components/hooks/matcher.test.ts` - Asserts complete accepted results, stable deduplication and ordering, and explicit unsafe or empty-alternative rejection boundaries.
- `tests/orchestrators/plugin/install-auth.test.ts` - Uses guarded credential, device-flow, and Git fakes through an auth-aware file-local bridge.
- `tests/orchestrators/plugin/install.test.ts` - Uses a guarded Git fake with explicit local fixture and allowed-remote boundaries.
- `tests/orchestrators/plugin/reinstall.test.ts` - Uses a guarded Git fake while preserving local-ref and clone-call behavior.
- `tests/orchestrators/plugin/update-reinstall-auth.test.ts` - Uses guarded credential, device-flow, and Git fakes while preserving auth callback evidence.
- `tests/orchestrators/plugin/update.test.ts` - Uses a guarded Git fake for update, ref, and call-log scenarios.
- `tests/orchestrators/reconcile/apply.test.ts` - Uses guarded Git support for reconcile clone and ref behavior.
- `tests/shared/device-flow-prompt.test.ts` - Uses guarded memory-only credential and disabled-network device-flow fakes with normalized lowercase runtime phases.

## Decisions Made

- Kept expected matcher outputs literal and independent of production mapping helpers, so a production mapping regression cannot rewrite both sides of an assertion.
- Added file-local compatibility bridges instead of changing hundreds of established lifecycle cases. The bridges expose the existing test controls while configuring the concern-local guarded fakes explicitly.
- Retained auth callback assertions in local call records, but removed function-bearing callback bundles before handing calls to the structured-clone-backed fake recorder.
- Preserved the generic helper files. Plan 108-23 owns their deletion after every consumer migration is complete.

## Verification

- `node --test tests/domain/components/hooks/matcher.test.ts` — passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` — passed at 22/22 branches, 2/2 functions, and 59/59 lines.
- Exact seven-consumer test command — passed, 365/365 tests.
- `npm run typecheck` — passed.
- ESLint — passed.
- `npm run format:check` — passed.
- Full unit suite — passed, 3,936 passed, one pre-existing platform skip, zero failed.
- `npm run test:integration` — passed, 21/21 tests.
- `git diff --check` and the declared-file uppercase phase-comment audit — passed.
- Declared consumer search found zero imports from `tests/helpers/git-mock.ts`, `credential-mock.ts`, or `device-flow-mock.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted function-bearing auth calls to the guarded recorder**

- **Found during:** Task 3 consumer verification
- **Issue:** The guarded Git fake records arguments with `structuredClone()`, which cannot clone the authentication callback functions passed by the auth lifecycle tests.
- **Fix:** The two auth-focused file-local bridges retain the original calls for assertions and remove only the callback-bearing `auth` field before delegating to the guarded fake.
- **Files modified:** `tests/orchestrators/plugin/install-auth.test.ts`, `tests/orchestrators/plugin/update-reinstall-auth.test.ts`
- **Verification:** Both auth suites and the exact seven-consumer command passed.
- **Committed in:** `4fa84d8d`

**2. [Rule 3 - Blocking] Preserved the legacy remote HEAD alias at the local adapter boundary**

- **Found during:** Task 3 consumer verification
- **Issue:** The generic helper resolved `refs/remotes/origin/HEAD` from the seeded remote main ref, while the concern-local fake intentionally exposes exact refs only.
- **Fix:** File-local Git bridges preserve the established fallback to `refs/remotes/origin/main` without changing the shared guarded fake or production behavior.
- **Files modified:** `tests/orchestrators/plugin/install-auth.test.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`, `tests/orchestrators/plugin/update-reinstall-auth.test.ts`, `tests/orchestrators/plugin/update.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`
- **Verification:** The exact seven-consumer command passed, 365/365 tests.
- **Committed in:** `4fa84d8d`

**Total deviations:** 2 auto-fixed blocking compatibility issues.
**Impact on plan:** No production, shared fake, or generic helper file changed; the adaptations are bounded to the declared consumer files.

## Issues Encountered

- `npm run check` reaches one expected transitional Fallow finding: `fixtureMarketplaceDir` is now unused at `tests/helpers/git-mock.ts:310` because this plan removed its final consumers. Deleting the export or helper is outside Plan 108-07 ownership and is explicitly assigned to Plan 108-23. Typecheck and ESLint pass before that Fallow gate; formatting, the full unit suite, and the integration suite were also run separately and pass, confirming there are no other full-check failures.
- The restricted sandbox denied local network binding in three established `update.test.ts` cases. The identical elevated focused suite passed all 105 tests, and the elevated exact seven-consumer suite passed all 365 tests.

## Known Stubs

None. Empty collections and placeholder strings found by the scan are established test fixtures or assertions, not unwired runtime behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 108-23 can delete the generic Git, credential, and device-flow helpers now that the declared final consumer batch has zero generic helper imports.
- That deletion will remove the intentional transitional `fixtureMarketplaceDir` Fallow finding.
- No consumer production pair is claimed complete by this plan.

## Self-Check: PASSED

- All eight declared test files exist.
- Task commits `4359975e`, `12266c42`, and `4fa84d8d` exist on the worktree branch.
- Matcher direct coverage and every plan-local verification gate pass.
- No file outside Plan 108-07 ownership was modified.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_
