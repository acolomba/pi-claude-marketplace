---
phase: 108-domain-and-platform
plan: 21
subsystem: platform
tags: [typescript, credentials, child-process, contract-tests, correspondence, coverage]

requires:
  - phase: 108-18
    provides: Exact lowercase owner normalization and direct-coverage discipline for Phase 108
provides:
  - Hermetic injected-process coverage for the production CredentialOps adapter
  - One complete callable credential contract shared by production and a guarded concern-local fake
  - Exact mutable-alias planted-defect sensitivity with one named failing invariant
  - Structural concern-local fake/contract correspondence classification with negative fixtures
  - 100% direct branch, function, and line coverage for platform/git-credential.ts
affects: [108-12, 108-22, 108-02, 108-03, 108-04, 108-05, 108-07, 108-23]

actuals:
  tokens: 12165
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Fresh explicitly guarded factories run one ordered public-port contract
    - Injected process fakes model stdin, stdout, lifecycle, timeout, termination, and cleanup
    - Supplemental fake owners qualify by suffix, companion files, and structural imports

key-files:
  created:
    - tests/platform/credential-ops-contract.ts
    - tests/platform/credential-ops-fake.ts
    - tests/platform/credential-ops-fake.test.ts
    - tests/platform/credential-process-fake.ts
    - .planning/phases/108-domain-and-platform/108-21-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - tests/platform/git-credential.test.ts
    - scripts/check-corresponding-tests.mjs
    - scripts/check-corresponding-tests.negative.mjs

key-decisions:
  - "Keep createCredentialOps dependency injection public while removing the uncovered private default-spawn wrapper per D-20."
  - "Run the same ordered 31-case registrar against production and fake participants, always from fresh factories."
  - "Classify supplemental fake owners structurally; do not add a filename allowlist or named exemption."

patterns-established:
  - "Credential contract participants share public behavior only; process controls and fake internals remain outside the registrar."
  - "Concern-local *-fake.test.ts supplements require matching fake and contract companions plus imports of both."

requirements-completed: [MOD-01, PRES-03, PRES-04]

coverage:
  - id: D1
    description: Hermetic production credential behavior and injected process mechanics
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/platform/git-credential.test.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-credential.ts (45/45 branches, 18/18 functions, 310/310 lines)"
        status: pass
    human_judgment: false
  - id: D2
    description: Complete production/fake CredentialOps parity with exact mutable-alias defect sensitivity
    requirement: PRES-03
    verification:
      - kind: unit
        ref: "node --test tests/platform/git-credential.test.ts tests/platform/credential-ops-fake.test.ts"
        status: pass
      - kind: unit
        ref: "private aliasing control: exactly [returns a credential copy that cannot mutate stored state] fails and the other 30 cases pass"
        status: pass
    human_judgment: false
  - id: D3
    description: Reusable structural supplemental-evidence classification without named exemptions
    requirement: PRES-04
    verification:
      - kind: unit
        ref: "npm run test:corresponding:negative"
        status: pass
      - kind: other
        ref: "credential supplement filtered checkCorrespondingTests(): 0 violations"
        status: pass
    human_judgment: false

duration: 3h 40m
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 21: Credential Contract Carrier Summary

**Hermetic credential process coverage, one sensitive 31-case production/fake contract, and structural supplemental correspondence at 100% direct coverage**

## Performance

- **Duration:** 3h 40m, including the D-20 ownership checkpoint
- **Started:** 2026-08-29T08:07:15Z
- **Completed:** 2026-08-29T11:47:03Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Replaced PATH-dependent credential testing with an injected `CredentialSpawn` model that records argv and stdin and controls stdout, stderr, exit, error, timeout, termination, and cleanup without invoking Git or an OS keychain.
- Registered the same ordered 31-case `CredentialOps` contract against production and concern-local fake participants from fresh guarded factories.
- Proved the contract's central isolation invariant with a private mutable-alias fake that fails exactly `returns a credential copy that cannot mutate stored state` and passes every other case.
- Added structural supplemental classification for concern-local `*-fake.test.ts` owners and exact negative fixtures for missing companions, missing imports, and suffix lookalikes.
- Removed the private default-spawn wrapper while retaining public `createCredentialOps` injection and reached 45/45 branches, 18/18 functions, and 310/310 lines directly covered.

## Task Commits

Each task was committed atomically:

1. **Task 1: Normalize the production owner through injected CredentialSpawn mechanics** - `46c17000` (test)
2. **Task 2: Register the complete CredentialOps contract and exact planted defect** - `e1bfb394` (test)
3. **Task 3: Establish structural supplemental evidence and close the credential carrier** - `33877f4d` (test)

Task 3 verification fixes were committed separately as `a2b1c4ac` and `3beee25a`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git-credential.ts` - Retains injected spawn selection without the uncovered private live-process wrapper.
- `tests/platform/git-credential.test.ts` - Canonical production owner, contract participant, wire validation, and process-lifecycle coverage.
- `tests/platform/credential-ops-contract.ts` - Ordered callable 31-case public-port contract and registrar.
- `tests/platform/credential-ops-fake.ts` - Fresh guarded in-memory credential participant with copy isolation.
- `tests/platform/credential-ops-fake.test.ts` - Fake participant plus the private one-invariant aliasing negative control.
- `tests/platform/credential-process-fake.ts` - Deterministic injected child-process model with lifecycle observability.
- `scripts/check-corresponding-tests.mjs` - Generic structural classifier for concern-local fake supplements.
- `scripts/check-corresponding-tests.negative.mjs` - Valid supplement and exact missing-companion/import/lookalike fixtures.

## Decisions Made

- Kept `createCredentialOps` dependency injection and public behavior unchanged; only the private default `spawnCredentialProcess` wrapper was removed after the user approved D-20 ownership.
- Kept process mechanics and fake controls outside the shared contract so both participants prove only the public `CredentialOps` port.
- Required companion existence and imports of both the fake and contract modules before a `*-fake.test.ts` file qualifies as supplemental evidence.
- Left generic credential-helper consumer migration to 108-02/03/04/05/07 and final no-reference proof/deletion to 108-23, as assigned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected lint-contract findings in the new test support**

- **Found during:** Task 3 verification
- **Issue:** The first integrated lint run found import ordering, padding, discarded void-return, and async-method findings in the new contract and fake support.
- **Fix:** Reordered imports and phases, captured void results through a typed helper, and made async fake methods contain an await without changing their behavior.
- **Files modified:** `tests/platform/git-credential.test.ts`, `tests/platform/credential-ops-contract.ts`, `tests/platform/credential-ops-fake.ts`, `tests/platform/credential-ops-fake.test.ts`, `tests/platform/credential-process-fake.ts`
- **Verification:** Targeted ESLint, Prettier, typecheck, focused tests, and the full check pass.
- **Committed in:** `a2b1c4ac`

**2. [Rule 3 - Blocking] Internalized fallow contract declarations**

- **Found during:** Task 3 full verification
- **Issue:** Fallow correctly reported an exported contract interface and inapplicable-category constants that no external module consumed.
- **Fix:** Kept the participant interface internal and recorded source-defined inapplicable categories as adjacent module comments instead of unused exports.
- **Files modified:** `tests/platform/credential-ops-contract.ts`
- **Verification:** Fallow and the full check pass with the complete contract behavior unchanged.
- **Committed in:** `3beee25a`

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking fixes)
**Impact on plan:** Both fixes enforced repository quality gates without widening production behavior or ownership.

## Issues Encountered

- Initial direct coverage exposed the private live-spawn wrapper as unreachable under the no-real-Git/PATH constraint. Execution paused at the ownership checkpoint; the user selected behavior-preserving removal, and D-20 plus Task 3 ownership were added before work resumed.
- The repository-wide `npm run test:corresponding` still reports 101 known Phase 108 pairs outside this plan. The credential supplement itself has zero filtered violations, and all structural positive and negative fixtures pass.
- `npm run test:coverage:direct:all` reaches the first existing incomplete repository pair at `tests/bridges/agents/index.test.ts`. The plan-owned credential source passes direct coverage independently at 100%.
- The sandboxed full check reproduced only the established loopback restrictions in marketplace add, plugin update, and git remote refs. The identical elevated `npm run check` passed completely: 3,870 of 3,871 unit tests passed with one intentional non-Linux skip, and all 21 integration tests passed.

## Verification

- `node --test tests/platform/git-credential.test.ts tests/platform/credential-ops-fake.test.ts` - passed.
- Exact planted-defect control - passed: one literal failing case and 30 passing cases.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git-credential.ts` - passed at 100%: 45/45 branches, 18/18 functions, and 310/310 lines.
- Credential-filtered correspondence - passed with zero violations.
- `npm run test:corresponding:negative` - passed all valid and lookalike fixtures.
- Exact lowercase AAA scan - passed with no uppercase phase markers, focused skips, or fake runtime phases around type-only evidence.
- Elevated `npm run check` - passed typecheck, lint, fallow, formatting, 3,871 unit tests, and 21 integration tests with zero failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 108-12 and 108-22 can use the structural supplement rule without adding exemptions.
- Plans 108-02/03/04/05/07 can migrate bounded generic credential-helper consumers after the remaining carriers land.
- Plan 108-23 retains the final no-reference proof and generic-helper deletion; this plan makes no early deletion claim.
- No credential-carrier blocker or plan-local defect remains.

## Self-Check: PASSED

- All eight implementation files and this summary exist.
- Task and verification-fix commits `46c17000`, `e1bfb394`, `33877f4d`, `a2b1c4ac`, and `3beee25a` are present.
- Focused tests, exact planted-defect sensitivity, direct coverage, structural correspondence fixtures, lowercase AAA, and the elevated full check pass.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_
