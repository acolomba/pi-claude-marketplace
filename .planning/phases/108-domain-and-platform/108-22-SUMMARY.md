---
phase: 108-domain-and-platform
plan: 22
subsystem: platform
tags: [typescript, git, isomorphic-git, contract-tests, hermetic-http, coverage]

requires:
  - phase: 108-12
    provides: Direct-coverage and canonical-owner rules for Phase 108
  - phase: 108-21
    provides: Callable production/fake contract and structural supplement patterns
provides:
  - One canonical Git platform owner with local repositories and injected HTTP transport
  - One ordered 12-case GitOps contract for production and fake participants
  - A guarded concern-local GitOps fake with exact force-update defect sensitivity
  - Complete legacy authentication and remote-ref evidence without loopback transport
  - 100% direct branch, function, and line coverage for platform/git.ts
affects: [108-02, 108-03, 108-04, 108-05, 108-07, 108-23]

actuals:
  tokens: 21496
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - Fresh case-owned repositories use isomorphic-git without the Git CLI
    - Per-case injected HTTP responses replace loopback and live Git remotes
    - Production and fake participants run one ordered callable GitOps contract

key-files:
  created:
    - tests/platform/git.test.ts
    - tests/platform/git-ops-contract.ts
    - tests/platform/git-ops-fake.ts
    - tests/platform/git-ops-fake.test.ts
    - tests/platform/git-test-repository.ts
    - .planning/phases/108-domain-and-platform/108-22-SUMMARY.md
  deleted:
    - tests/platform/git-auth-callbacks.test.ts
    - tests/platform/git-remote-refs.test.ts

key-decisions:
  - "Inject isomorphic-git HTTP requests per case and reject each unplanned URL or credential request."
  - "Generate deterministic upload-pack responses from local repositories so clone and fetch remain hermetic."
  - "Keep adapter-only auth, branch, remote, and transport mechanics outside the shared GitOps contract."
  - "Keep tests/helpers/git-mock.ts until the bounded consumer plans and final deletion plan 108-23 complete."

patterns-established:
  - "Git contract participants share only the seven public GitOps operations."
  - "The concern-local fake uses an explicit memory boundary and requires explicit permission for local clone fixtures."

requirements-completed: [MOD-01, PRES-03, PRES-04]

coverage:
  - id: D1
    description: Canonical Git owner with local repositories and injected HTTP mechanics
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/platform/git.test.ts"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts (52/52 branches, 14/14 functions, 492/492 lines)"
        status: pass
    human_judgment: false
  - id: D2
    description: Complete production and fake parity across all seven GitOps operations
    requirement: PRES-03
    verification:
      - kind: unit
        ref: "node --test tests/platform/git.test.ts tests/platform/git-ops-fake.test.ts"
        status: pass
      - kind: unit
        ref: "Both participants pass the same ordered 12-case contract"
        status: pass
    human_judgment: false
  - id: D3
    description: Exact force-update defect sensitivity and stable contract ordering
    requirement: PRES-04
    verification:
      - kind: unit
        ref: "Private no-force-update fake fails exactly [force-updates a ref to the requested commit]"
        status: pass
      - kind: unit
        ref: "npm run test:corresponding:negative"
        status: pass
    human_judgment: false

duration: 39m
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 22: Git Contract Carrier Summary

**One hermetic Git owner and one sensitive 12-case production/fake contract at 100% direct coverage**

## Performance

- **Duration:** 39 minutes
- **Started:** 2026-08-29T12:25:45Z
- **Completed:** 2026-08-29T13:04:48Z
- **Tasks:** 3
- **Implementation files changed:** 7
- **Estimated diff tokens:** 21,496 (`85,986` changed characters divided by four)

## Accomplishments

- Consolidated all legacy authentication and remote-ref cases into `tests/platform/git.test.ts` before deleting the two proxy suites.
- Replaced loopback transport with a per-case injected HTTP request method. Each response body is fresh, and each unplanned request fails.
- Added deterministic local repositories and upload-pack responses without the Git CLI, a live remote, credentials, or persistent temporary files.
- Registered one ordered 12-case contract against production and fake participants. The contract covers all seven public `GitOps` operations.
- Proved contract sensitivity with a private no-force-update fake. It fails one named case, while the other 11 cases pass.
- Reached 52/52 branches, 14/14 functions, and 492/492 lines for `extensions/pi-claude-marketplace/platform/git.ts`.

## Task Commits

1. **Task 1: Establish the canonical local-repository and injected-HTTP boundary** - `36c1c79b`
2. **Task 2: Register and verify the complete production GitOps contract** - `c81a7c2d`
3. **Task 3: Prove the Git fake contract and exact planted defect** - `3c7bfc4a`

The full-check fix for the ordered contract manifest is in `f5ab6b9f`.

## Files Created and Deleted

- `tests/platform/git.test.ts` - Canonical owner, adapter mechanics, transport evidence, and production contract participant.
- `tests/platform/git-ops-contract.ts` - Ordered callable cases and `registerGitOpsContract`.
- `tests/platform/git-ops-fake.ts` - Guarded concern-local fake with full call records.
- `tests/platform/git-ops-fake.test.ts` - Fake participant and the private no-force-update control.
- `tests/platform/git-test-repository.ts` - Case-owned deterministic repository factory with mandatory cleanup.
- `tests/platform/git-auth-callbacks.test.ts` - Deleted after its distinct cases moved to the canonical owner.
- `tests/platform/git-remote-refs.test.ts` - Deleted after its distinct cases moved to the canonical owner.

## Contract Evidence

The manifest contains 12 literal ordered case names. It covers these operations:

- `clone`
- `fetch`
- `forceUpdateRef`
- `checkout`
- `resolveRef`
- `currentBranch`
- `resolveRemoteRef`

The private broken participant produced this exact failure set:

```text
["force-updates a ref to the requested commit"]
```

All other 11 contract cases passed. The production and guarded fake participants both pass the complete manifest.

## AAA Audit

- The changed runtime sources contain 45 complete `// arrange`, `// act`, and `// assert` source triplets.
- The counts are exact: 45 arrange markers, 45 act markers, and 45 assert markers.
- There are no combined markers, uppercase phase markers, or type-only runtime phases.
- Blank lines separate each runtime phase. The focused expanded run passed 58/58 registered tests.

## Decisions Made

- The owner injects the `isomorphic-git/http/node` request method for remote cases. It does not open a socket.
- The production contract uses local repository data to create deterministic pack responses for clone and fetch.
- Adapter-only authentication, branch listing, remote listing, and raw transport cases remain in the canonical owner.
- The shared contract contains only public `GitOps` behavior. Fake controls remain outside the contract.
- The generic `tests/helpers/git-mock.ts` helper remains for the assigned consumer migration plans and plan 108-23.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept the memory fake inside its declared boundary**

- **Found during:** Task 3 focused verification
- **Issue:** The fake clone method tried to create `/memory/clone` on the host filesystem.
- **Fix:** The memory path updates only virtual state. Filesystem copy runs only with an explicit local clone fixture.
- **Files modified:** `tests/platform/git-ops-fake.ts`
- **Committed in:** `3c7bfc4a`

**2. [Rule 3 - Blocking] Proved and consumed the ordered manifest**

- **Found during:** Final full-check verification
- **Issue:** Fallow reported `GIT_OPS_CASE_NAMES` as an unused export.
- **Fix:** The negative control compares callable case order with the exported literal manifest before it checks the exact failure set.
- **Files modified:** `tests/platform/git-ops-fake.test.ts`
- **Committed in:** `f5ab6b9f`

**Total deviations:** 2 auto-fixed problems. The fixes did not change production behavior or plan ownership.

## Issues Encountered

- `npm run test:corresponding` reports 98 known repository migration violations outside this plan. No plan-owned Git file appears in that list.
- `npm run test:coverage:direct:all` stops at the known missing pair `tests/bridges/agents/index.test.ts`.
- The sandboxed full check failed only in two known loopback suites. They are marketplace add and plugin update.
- The identical elevated full check passed with zero failures.

## Verification

- Focused expanded owner and fake run - 58/58 tests passed.
- Standard focused owner and fake command - both file-level suites passed.
- Direct Git coverage - 52/52 branches, 14/14 functions, and 492/492 lines.
- Exact planted-defect control - one failure name and 11 passing contract cases.
- `npm run test:corresponding:negative` - passed.
- Plan-owned correspondence - no Git owner or supplement violation in the repository report.
- AAA audit - 45 lowercase triplets and no uppercase or combined markers.
- Elevated `npm run check` - passed typecheck, ESLint, fallow, formatting, 3,928 unit tests, and 21 integration tests.

## Known Stubs

None. Empty arrays in the changed files are case-owned accumulators or expected whole-value assertions.

## User Setup Required

None. The tests do not use an external service, credential, Git CLI, or live network.

## Next Phase Readiness

- Plans 108-02, 108-03, 108-04, 108-05, and 108-07 can migrate bounded consumers to the concern-local fake.
- Plan 108-23 retains the final generic-helper reference check and deletion.
- No Git contract, hermetic transport, coverage, or plan-local quality blocker remains.

## Self-Check: PASSED

- All five created implementation files and this summary exist.
- Both declared legacy suites are absent.
- Commits `36c1c79b`, `c81a7c2d`, `3c7bfc4a`, and `f5ab6b9f` are present.
- Focused tests, direct coverage, exact defect sensitivity, AAA, and the elevated full check pass.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_
