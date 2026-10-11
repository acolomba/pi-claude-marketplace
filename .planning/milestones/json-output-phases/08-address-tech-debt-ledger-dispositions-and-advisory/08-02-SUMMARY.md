---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
plan: "02"
subsystem: testing
tags: [integration-tests, pi-subagents, hermetic-environment, npm-root]

requires:
  - phase: 08-address-tech-debt-ledger-dispositions-and-advisory
    provides: "08-01 root brace-expansion lock bump with a green npm run check at a12dfa16"
provides:
  - "SC-2 / AGSK-06 resolver case runs (not skips) wherever the global pi-subagents peer is installed"
  - "Shared resolve-then-load shape in both pi-subagents resolver integration tests"
affects: [phase-08-verification, SC-2]

actuals:
  tokens: 1060
  tasks: 2
  commits: 2
plan_head_before: 9c13008a18aa4d1e71befd2551a2097c3ed510dc
plan_head_after: 9829a30e631560cd0ae24a35bfb9bb7bfb1fe4b2

tech-stack:
  added: []
  patterns:
    - "Resolve the global peer root with the real HOME, then enter the hermetic environment, then load"

key-files:
  created: []
  modified:
    - tests/integration/skill-path-resolution.test.ts
    - tests/integration/provenance-invisibility.test.ts

key-decisions:
  - "D-06: the SC-2 / AGSK-06 case calls resolvePiSubagentsPackageRoot() before createHermeticEnvironment repoints HOME, so npm reads ~/.npmrc for its global prefix"
  - "provenance-invisibility gets the same loader signature as a symmetry refactor; it never swaps HOME, so its behavior is unchanged"

patterns-established:
  - "Peer loaders take packageRoot: string | undefined as an argument; the case owns the lookup"

requirements-completed: []

coverage:
  - id: D1
    description: "SC-2 / AGSK-06 case passes against the installed global pi-subagents peer instead of skipping"
    verification:
      - kind: integration
        ref: "node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts (# pass 1, # skipped 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both resolver tests share the resolve-then-load shape and behave correctly in both peer states"
    verification:
      - kind: integration
        ref: "node --test over both files with the peer installed (# pass 2, # skipped 0)"
        status: pass
      - kind: integration
        ref: "PI_SUBAGENTS_ROOT=/nonexistent node --test over both files (# skipped 2, # fail 0, exit 0)"
        status: pass
      - kind: other
        ref: "source-order node checks for both files (resolver before HOME swap / mkdtemp, resolver byte-identical to a876e321)"
        status: pass
      - kind: other
        ref: "git diff --exit-code a876e321 -- .github/workflows/"
        status: pass
      - kind: other
        ref: "npm run check (exit 0 at 9829a30e)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-10
status: complete
---

# Phase 8 Plan 02: Resolve the pi-subagents Root Before the Hermetic HOME Swap Summary

**The SC-2 / AGSK-06 integration case now resolves the global pi-subagents root with the real HOME before entering the hermetic environment, so it runs and passes against pi-subagents@0.47.1 instead of skipping; the frontmatter loader in provenance-invisibility gets the same signature.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-10T20:05:47Z
- **Completed:** 2026-10-10T20:10:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `loadPiSubagentsSkillsModule(packageRoot, scratchRoot)` no longer calls the resolver. The SC-2 / AGSK-06 case calls `resolvePiSubagentsPackageRoot()` as its first statement, before `createHermeticEnvironment` sets `process.env.HOME`. A short comment says why: npm reads its global prefix from `~/.npmrc`.
- `loadPiSubagentsFrontmatterModule(packageRoot, scratchRoot)` has the same shape. The T-d8i-01 case resolves the root before `mkdtemp`. Its behavior is unchanged (pass before and after).
- `resolvePiSubagentsPackageRoot` is byte-identical to a876e321 in both files. Case titles, `t.skip` branches, assertions, the PI_OFFLINE handling, and the top-of-file CI-gap TODO are unchanged. `.github/workflows/` is unchanged, so CI keeps its documented skip.

## Task Commits

1. **08-02-01: Run the SC-2 / AGSK-06 case against the installed peer** - `3f20490a` (test). Hook: all pre-commit hooks passed, including `npm run check:commit` and gitlint.
2. **08-02-02: Give the frontmatter loader the same shape and prove both peer states** - `9829a30e` (test). Hook: all pre-commit hooks passed, including `npm run check:commit` and gitlint.

## Evidence

| Run | Before | After |
| --- | --- | --- |
| skill-path-resolution alone, peer present | `# pass 0`, `# skipped 1` (planning measurement) | `# pass 1`, `# fail 0`, `# skipped 0`, exit 0 |
| provenance-invisibility alone, peer present | `# pass 1`, `# fail 0`, `# skipped 0` (measured before the edit) | covered by the two-file run |
| Both files, peer present | `# pass 1`, `# skipped 1` (planning measurement) | `# pass 2`, `# fail 0`, `# skipped 0`, exit 0 |
| Both files, `PI_SUBAGENTS_ROOT=/nonexistent` | `# skipped 2`, exit 0 (planning measurement) | `# pass 0`, `# fail 0`, `# skipped 2`, exit 0 |

- Tracer feedback gate: auto mode off, `human_verify_mode` end-of-phase, tracer `<verify>` automated only. The tracer TAP run was re-run after the commit (`# pass 1`, `# skipped 0`), so the plan continued to 08-02-02 with no checkpoint.
- Source-order checks: skill-path `{ t: 4614, r: 4922, h: 5039, same: true }`; provenance `{ t: 4642, r: 4768, m: 4825, same: true }`. Both exited 0.
- `npm ls -g --depth=0 pi-subagents`: `/home/acolomba/.npm-global/lib` -> `pi-subagents@0.47.1` (at or above the 0.35.0 floor).
- `git diff --exit-code a876e321 -- .github/workflows/`: exit 0.
- `npm run check`: exit 0 (output redirected to a file, not piped) at HEAD `9829a30e631560cd0ae24a35bfb9bb7bfb1fe4b2`, `node --version` v26.11.1.

## Files Created/Modified

- `tests/integration/skill-path-resolution.test.ts` - loader takes `packageRoot`; the case resolves it before the HOME swap.
- `tests/integration/provenance-invisibility.test.ts` - loader takes `packageRoot`; the case resolves it before `mkdtemp`.

## Decisions Made

None beyond the plan's D-06 instructions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

SC-2 holds locally wherever the global peer is installed. CI still skips both cases because no job installs pi-subagents globally. That gap stays visible through the top-of-file TODO and remains a deferred idea.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-04 holds: only the read-only `npm root -g` lookup runs before `createHermeticEnvironment`, and every write stays inside the hermetic root.

---
*Phase: 08-address-tech-debt-ledger-dispositions-and-advisory*
*Completed: 2026-10-10*

## Self-Check: PASSED
