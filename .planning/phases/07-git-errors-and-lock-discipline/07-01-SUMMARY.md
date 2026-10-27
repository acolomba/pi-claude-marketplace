---
phase: 07-git-errors-and-lock-discipline
plan: 01
subsystem: git-failure-classification
tags: [git, classifier, marketplace-update, isomorphic-git]

requires: []
provides:
  - "classifyGitFailure(error, rule, remoteUrl?) -> { reason, frame? } | undefined, the one classifier entry point (D-PL7-01)"
  - "classifyGitHostFailure, classifyGitSourceAccessFailure, hostHttpFailureFrame as one-call fixed-rule wrappers (D-PL7-11)"
  - "marketplace update and its autoupdate cascade classify with the { notFound: network error } rule (UPD-11, D-PL7-02)"
affects: [07-02, 07-03, 07-04, fetch, info --fetch, update-flow, dependency-tag-probe]

actuals:
  tokens: 12088
  tasks: 2
  commits: 2
plan_head_before: 3f08d2b12d1a86dce871e3d4a67b838aed8c3ee0
plan_head_after: 2cb999487db26dcab311e0c31857bd019b246392

tech-stack:
  added: []
  patterns:
    - "Per-operation not-found rule passed as a parameter instead of one classifier layer per rule"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - test/shared/git-failure-classifiers.test.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts

key-decisions:
  - "classifyGitFailure reuses the exported classifyGitTransportFailure for its transport arm; that export stays until fetch, info, update-flow, and the tag probe move (later plans)"
  - "The private HTTP status helper (httpStatus) drops the transport re-check, because classifyGitFailure calls it only after the transport arm; the re-check would be an unreachable branch"
  - "marketplace/update.ts names its rule once as MARKETPLACE_REFRESH_RULE, typed Parameters<typeof classifyGitFailure>[1]"

patterns-established:
  - "Classifier rule table: one test() per row over { title, createFailure, rule, remoteUrl, expected }, compared with deepStrictEqual on the whole { reason, frame? } value"

requirements-completed: [GLK-01]

coverage:
  - id: D1
    description: "classifyGitFailure with the D-PL7-01 ladder and per-operation 404 rule"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "test/shared/git-failure-classifiers.test.ts#classifyGitFailure"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fixed-rule wrappers leave install, import, apply, and marketplace add rows unchanged"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "node --test test/orchestrators/marketplace/add.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/plugin/install.messaging.test.ts test/orchestrators/plugin/install-cascade.messaging.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/plugin/git-source.feature features/marketplace/url-source.feature features/marketplace/failed-add.feature"
        status: pass
    human_judgment: false
  - id: D3
    description: "marketplace update classifies through classifyGitFailure with the same reasons and frames"
    requirement: GLK-01
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts"
        status: pass
      - kind: e2e
        ref: "npx cucumber-js features/marketplace/url-source-update.feature features/marketplace/github-source.feature"
        status: pass
    human_judgment: false

duration: 41min
completed: 2026-10-27
status: complete
---

# Phase 7 Plan 01: One git-failure classifier entry point Summary

**`classifyGitFailure(error, rule, remoteUrl?)` now classifies every git host failure with a per-operation 404 rule. The three old named classifiers are one-call fixed-rule wrappers over it. `marketplace update` and `lacksStoredCredential` call it directly, and every rendered row and frame stays the same.**

## Performance

- **Duration:** about 41 min (two commit hooks took about 10 min each)
- **Started:** 2026-10-27T03:41:36Z
- **Completed:** 2026-10-27T04:22:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `classifyGitFailure` applies the D-PL7-01 ladder in order. It unwraps a cleanup leak, then returns undefined for a non-Error. A missing pin is `source missing`. The transport arm gives `authentication required` or `network unreachable`. An HTTP 404 or 410 gives `rule.notFound`, and any other HTTP status gives `network error`. A remote `NotFoundError` gives `rule.missingRef`. The frame `<status> on <wire url>` is set only for a non-auth HTTP status, and only when a remote URL is given.
- `classifyGitHostFailure`, `classifyGitSourceAccessFailure`, and `hostHttpFailureFrame` are each a single `return classifyGitFailure(...)` with a fixed rule. The five foreign callers (`marketplace/add.ts`, `import/execute.ts`, `install.messaging.ts`, `install-cascade.messaging.ts`, `reconcile/apply-outcomes.ts`) are not edited, and their tests pass unchanged.
- `marketplace/update.ts` classifies with `{ notFound: "network error" }` in `refreshFailureMessage` (the frame) and in `transportReason` (the reason). `refreshFailureReasons` now ends with `reasonsFromCascadeError(err) ?? []`.
- `hostHttpStatus` is no longer exported. It is now the private `httpStatus`.
- The classifier tests have one top-level `describe()` per export. `describe("classifyGitFailure")` holds the rule table (49 rows), and each wrapper keeps one row that pins its rule.

## Task Commits

1. **Task 1: classifyGitFailure behind the unchanged wrappers, proved through install and marketplace add** - `f524371a` (refactor)
2. **Task 2: move marketplace update onto the entry point and make the status helper private** - `2cb99948` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts` - adds `classifyGitFailure`, rewrites the three wrappers as fixed-rule calls, makes the status helper private, and updates the module header
- `test/shared/git-failure-classifiers.test.ts` - groups cases by entry point and adds the `classifyGitFailure` rule table
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - `lacksStoredCredential` checks `classifyGitFailure(...)?.reason === "authentication required"`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - refresh classification and frame go through `classifyGitFailure` with the refresh rule

## Verification

| Command | Exit | After commit |
|---|---|---|
| `node --test test/shared/git-failure-classifiers.test.ts test/orchestrators/marketplace/shared.test.ts` (+ foreign callers) | 0 (463 tests across shared + five foreign suites) | f524371a |
| `npm run test:coverage:direct -- shared/git-failure-classifiers.ts marketplace/shared.ts` | 0 | f524371a |
| `npm run fallow` | 0 | f524371a |
| `npx cucumber-js features/plugin/git-source.feature features/marketplace/url-source.feature features/marketplace/failed-add.feature` | 0 (37 scenarios) | f524371a |
| `node --test test/shared/git-failure-classifiers.test.ts test/orchestrators/marketplace/update.test.ts` | 0 (192 tests) | 2cb99948 |
| `npm run test:coverage:direct -- shared/git-failure-classifiers.ts marketplace/update.ts marketplace/shared.ts` | 0 | 2cb99948 |
| `npx cucumber-js features/marketplace/url-source-update.feature features/marketplace/github-source.feature` | 0 (14 scenarios) | 2cb99948 |
| `npm run fallow` | 0 | 2cb99948 |
| pre-commit hook `npm run check:commit` (both commits) | Passed | both |
| **`npm run check`** (unpiped, full tree) | **0** (901 scenarios passed, merged direct LCOV 291 records) | 2cb99948 |

Acceptance greps: `export function classifyGitFailure` 1; `return classifyGitFailure(` 3; `describe("classifyGitFailure"` 1. `classifyGitTransportFailure` appears 0 times in `marketplace/shared.ts`, and `classifyGitFailure(` 1 time. `^export function hostHttpStatus` 0. The old helper names appear 0 times in `update.ts`, and `classifyGitFailure(` 2 times. No commit touches the five foreign callers.

## Decisions Made

- The transport arm calls the still-exported `classifyGitTransportFailure`. It is not copied into a private body, because fetch, info, update-flow, and the tag probe still import it until their own plans move them.
- The private `httpStatus(error: Error)` drops the old transport re-check and the leak unwrap. `classifyGitFailure` does both before it calls the helper, so keeping them would leave a branch no test can reach and fail 100% branch coverage.

## Deviations

None. The plan ran as written. Two small choices stay inside the plan's discretion:

- `refreshFailureReasons` now ends with `return reasonsFromCascadeError(err) ?? [];` rather than an `if` followed by `return []`. The behavior is the same and the code is shorter.
- Behavior note, which D-PL7-02 asks for: `transportReason` in `marketplace/update.ts` is also the autoupdate cascade's classifier for a raw throw from `pluginUpdate`. It now classifies an HTTP status there (404/410/5xx -> `network error`) and a `PinnedCommitMissingError` (`source missing`). Before, it left both unclassified. No existing unit test or scenario covers a cascade throw with an HTTP status, and every suite passes.

## Out-of-line edits

None.

## Issues Encountered

- Each commit's pre-commit hook (`npm run check:commit`) ran for about 10 minutes on this machine, past the 600 s foreground tool limit. Both commits went to the background and finished with exit code 0, and the hook printed `Passed` both times.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The frame still travels only as a `MarketplaceUpdateError` message in the cause chain, which `serializeCauseChain` redacts (T-07-01). No new output path prints it.

## Known Stubs

None.

## Next Phase Readiness

Later plans can call `classifyGitFailure` directly. `classifyGitTransportFailure` stays exported until fetch, info, update-flow, and the dependency tag probe stop importing it. The plan that moves the last of them must make it private and move its `describe("classifyGitTransportFailure")` cases into the `classifyGitFailure` table.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
- FOUND: test/shared/git-failure-classifiers.test.ts
- FOUND: f524371a (ancestor of HEAD)
- FOUND: 2cb99948 (ancestor of HEAD)
