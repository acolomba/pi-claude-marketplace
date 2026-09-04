---
phase: 112-hook-runtime
plan: 04
subsystem: hook-runtime
tags: [typescript, node-test, child-process, streams, timers, translators, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Payload owners, spawn helpers, timer ladder, hook environment, async registry, and wire parsing contracts from Plans 112-02 through 112-31
provides:
  - Portable real-child proof of the blocking dispatch process boundary
  - Complete injected dispatch matrix for translators, malformed input, subprocess streams, stdin, timers, terminal settlement, parsing, and async delegation
  - Sole direct dispatch-exec owner with the duplicate execution suite removed and translator supplemental narrowly retained
affects:
  - 112-05 dispatch reducer ownership
  - 112-07 event-router lifecycle ownership
  - 112-14 hook barrel ownership
  - MOD-05 hook-runtime verification
actuals:
  tokens: 31892
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Portable process.execPath tracer with literal argv, synchronous stdin consumption, and direct descriptor output
    - Real PassThrough streams for buffering and decoder behavior with custom emitters only for otherwise unstaged event orderings
    - Complete case-local subprocess outcomes with exact bytes, terminal state, listener removal, timer cancellation, and cleanup
key-files:
  created: []
  modified:
    - tests/bridges/hooks/dispatch-exec.test.ts
    - tests/architecture/hooks-exec.test.ts
    - tests/architecture/hooks-translators.test.ts
key-decisions:
  - Kept dispatch-exec.ts byte-for-byte unchanged because its public dispatchHookExec dependency boundary exposes every process, stream, stdin, timer, parse, and delegation branch.
  - Made the portable child consume stdin synchronously and write directly to file descriptors so fast exit cannot race fixture delivery; no sleep, polling, or production change was added.
  - Consolidated all single-module execution evidence in the mirrored dispatch-exec owner, then deleted hooks-exec.test.ts.
  - Removed only translator byte-round-trip duplication and its shared fixture data while retaining cross-module translator completeness and shared built-in/custom tool-name mapping.
  - Used live failing diagnostics to prove the outer async delegation catch while preserving the never-throw noop contract.
patterns-established:
  - Blocking child evidence asserts the complete command, args, shell mode, cwd, environment, stdin bytes, parsed result, terminal state, and cleanup through the real OS boundary.
  - Injected child cases keep stdout and stderr independently ordered and bounded without inventing a total inter-stream order.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: A portable real child proves blocking dispatch through the default OS spawn boundary with literal argv, exact stdin and environment, parsed output, terminal state, and complete timer and listener cleanup.
    requirement: MOD-05
    verification:
      - kind: integration
        ref: tests/bridges/hooks/dispatch-exec.test.ts#executes a blocking hook through the portable process boundary
        status: pass
      - kind: other
        ref: node --test tests/bridges/hooks/dispatch-exec.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: The direct owner proves all ten translators and required-field lists plus malformed payload, async delegation, spawn, stream, stdin, timer, terminal, parsing, overflow, and cleanup partitions.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/dispatch-exec.test.ts#complete injected dispatch matrix
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- tests/bridges/hooks/dispatch-exec.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: The duplicate hooks-exec suite is absent, while the translator architecture suite retains only module completeness and shared built-in/custom tool-name mapping.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/architecture/hooks-translators.test.ts
        status: pass
      - kind: other
        ref: test ! -e tests/architecture/hooks-exec.test.ts
        status: pass
    human_judgment: false
duration: 33 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 04: Dispatch execution summary

**Blocking dispatch now has a portable real-child tracer and a complete injected subprocess matrix at 100% direct coverage, with duplicate execution evidence retired.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-08-31T11:00:57Z
- **Completed:** 2026-08-31T11:33:12Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Proved the default blocking spawn arm with `process.execPath`, literal shell-like argv, exact command and environment boundaries, exact serialized stdin, independently captured stdout and stderr, parsed mutation output, real terminal state, listener removal, and timer cancellation.
- Completed the injected matrix for all ten translators and their `[]`, `["text"]`, or `["toolName", "input"]` required-field lists; malformed null, primitive, missing, and throwing shapes; literal async delegation; missing Pi; rejected delegation; live outer catch behavior; and the public never-throw noop contract.
- Covered exact-cap and one-byte-over stdout and stderr, multiple chunks, split UTF-8, incomplete decoder flush, string chunks, null streams, independent lane ordering, exit-before-close, spawn and late errors, duplicate settlement, stdin listener ordering, EPIPE, synchronous end failure, immediate termination escalation, timer cleanup, and parse outcomes.
- Deleted `tests/architecture/hooks-exec.test.ts` after absorption and narrowed `hooks-translators.test.ts` to genuine translator-module completeness and shared built-in/custom tool-name mapping.

## Task Commits

1. **Task 1: Prove one blocking hook through a real portable child boundary** - `13e7da75`
2. **Task 2: Complete malformed payload, stream, terminal, stdin, and delegation partitions** - `93dca4d1`

## Files Created/Modified

- `tests/bridges/hooks/dispatch-exec.test.ts` - Canonical direct owner for the real blocking process boundary and the complete injected dispatch matrix.
- `tests/architecture/hooks-exec.test.ts` - Deleted after every distinct single-module execution contract moved into the canonical owner.
- `tests/architecture/hooks-translators.test.ts` - Removes byte-equal round-trip duplication and shared fixture data while retaining cross-module completeness and tool-name mapping.

## Decisions Made

- Kept `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` byte-for-byte unchanged. Its existing `dispatchHookExec` dependency argument is sufficient to prove controllable branches without a test-only export, module replacement, or hidden seam.
- Used one real, portable `process.execPath` child only for the default spawn tracer. Its program reads stdin synchronously and writes stdout and stderr directly through file descriptors, eliminating the fixture-only fast-exit race without a sleep, polling loop, elapsed-time assertion, or runtime modification.
- Used real Node `PassThrough` streams for buffering, UTF-8 decoding, end and flush behavior, and listener lifecycle. Purpose-built emitters are limited to terminal orderings that real streams cannot deterministically stage.
- Asserted stdout and stderr as independent ordered lanes. No test invents a global inter-stream order that the child-process contract does not guarantee.
- Retained only genuine cross-module translator evidence: all ten modules remain loadable, and all three tool translators share both built-in `bash` to `Bash` mapping and custom-name passthrough.
- Kept `MOD-05` pending in `.planning/REQUIREMENTS.md` until every Phase 112 owner completes.

## Validation

- `node --test tests/bridges/hooks/dispatch-exec.test.ts` passed with zero failures, skips, or todos and exited without a residual portable child.
- `test ! -e tests/architecture/hooks-exec.test.ts` and `node --test tests/architecture/hooks-translators.test.ts` passed; the retained suite contains exactly its two planned cross-module tests.
- `npm run test:coverage:direct -- tests/bridges/hooks/dispatch-exec.test.ts` passed with 55/55 branches, 17/17 functions, and 472/472 lines for `dispatch-exec.ts`.
- `npm run typecheck`, targeted ESLint, targeted Prettier, and `git diff --check` passed.
- Static scope checks found exactly the three planned test-file changes and no production diff, test seam, coverage exception, skipped/todo/only case, legacy `EVENT_FIXTURES`, or legacy `EXPECTED_JSON`.
- The owner and retained supplemental contain 27 matching lowercase arrange/act/assert phase blocks. The portable fixture contains no sleep or polling, and post-run checks found no residual child or `/tmp/dispatch-*` case directory.
- Task commits `13e7da75` and `93dca4d1` form an exact contiguous sequence in task order and leave all three task paths clean.

## Deviations from Plan

None - the plan executed within its declared owner and supplemental test scope, with no production change.

## Issues Encountered

The first portable-child fixture shape could allow a very fast child to finish while asynchronous pipe delivery was still being observed. The final committed tracer reads stdin synchronously and writes directly to descriptors 1 and 2 while separately recording exact output bytes. This fixture-only resolution is deterministic, uses no wait or sleep, and changes no production behavior.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty required-field lists, null streams, empty output, and noop results are explicit subprocess contract partitions rather than placeholders.

## Security Review

The direct owner closes the plan's high-severity process and resource threats by proving exec-form `shell: false` with literal arguments, complete environment construction, bounded independent streams, immediate overflow cleanup, SIGTERM/SIGKILL escalation, duplicate-settlement guards, listener removal, exact timer cancellation, and contained stdin failures. No endpoint, production file-access path, public symbol, test mode, or new trust boundary was introduced.

## Next Phase Readiness

Plan 112-05 can consume the complete dispatch-exec result surface, Plan 112-07 can rely on its async delegation contract, and Plan 112-14 can verify the hook barrel without a competing execution suite. The dispatch-exec pair is ready for phase-wide MOD-05 verification.

## Self-Check: PASSED

- The canonical owner, retained translator supplemental, plan, and summary exist; the duplicate hooks-exec supplemental is absent.
- Task commits `13e7da75` and `93dca4d1` exist in exact order and modify only the three planned test paths; production is unchanged.
- Owner, translator, direct coverage, typecheck, targeted lint, targeted format, diff, scope, lowercase phase, skip, process, temporary-directory, and coverage-metadata gates pass.
- `.planning/REQUIREMENTS.md` was not changed, and `MOD-05` remains pending until Phase 112 completes.

---

*Phase: 112-hook-runtime*
*Completed: 2026-08-31*
