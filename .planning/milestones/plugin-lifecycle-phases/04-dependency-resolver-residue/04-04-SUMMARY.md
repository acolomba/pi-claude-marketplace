---
phase: 04-dependency-resolver-residue
plan: 04
subsystem: plugin-lifecycle
tags: [dependency-plan, preview, git-source, commit-pin]
status: complete

requires:
  - "04-01 (previewInstall with the D-PL4-04 agent-target check)"
  - "04-03 (dependency-plan.test.ts ports fake and the D-PL4-02 case)"
provides:
  - "previewInstall answers its preflight's resolvedSha, or undefined (D-PL4-01)"
  - "DependencyPlanPorts.preview answers Promise<string | undefined>"
  - "each scheduled fresh install member carries previewedCommit when its preview resolved one"
  - "DependencyPlanOptions.rootCommit, carried on the root member in final"
  - "ResolvedCascadeMember.previewedCommit"
affects: [plan 04-05, which pins each member's install to previewedCommit and passes rootCommit]

actuals:
  tokens: 2022
  tasks: 2
  commits: 2
plan_head_before: b66bf0269d61c49a0687d23da5c69d861b09a9cf
plan_head_after: c8f04bffd940840efb23769b1974e3d3e81876f6

tech-stack:
  added: []
  patterns:
    - "A plan-scheduled member gains an optional key only when a value exists (withPreviewedCommit), so a copy is made and graph nodes stay shared and unchanged"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - test/orchestrators/plugin/dependency-plan.test.ts
    - test/orchestrators/plugin/install-outcome.test.ts

key-decisions:
  - "D-PL4-01: the commit an install preview resolves travels with the plan on the member it schedules (materialize step and final), keyed by member key; a preview that resolves none leaves the member unchanged"
  - "D-PL4-01 (Uncertain choice 1): the root of an install plan takes the caller's rootCommit; an update's plan has no root"

patterns-established: []

requirements-completed: []

metrics:
  completed: 2026-10-26
---

# Phase 4 Plan 04: Previewed commits on the plan's members Summary

The commit an install preview resolves now travels with the dependency plan. `previewInstall` answers its preflight's `resolvedSha`. The plan keeps one commit per fresh key and sets it as `previewedCommit` on the member it schedules, both in a materialize step and in `final`. The plugin being installed carries the caller's `rootCommit`. Plan 04-05 pins the install to that commit.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | c326af59 | feat(plugin): carry each previewed commit on the plan's members |
| 2 | c8f04bff | feat(plugin): carry the installed plugin's previewed commit in the plan |

## What changed

- `install-cascade.ts`: `ResolvedCascadeMember` gains `readonly previewedCommit?: string;` with a D-PL4-01 doc. Nothing else changed.
- `install-outcome.ts` (only `previewInstall`): the return type is `Promise<string | undefined>`. The marketplace-absent branch returns `undefined`, and the function returns `preflight.resolvedSha` after the PI-6 and D-PL4-04 checks. The doc says what it answers.
- `dependency-plan.ts`:
  - The `preview` port answers `Promise<string | undefined>`.
  - `previewFresh` returns the refusal or a `Map<string, string>` of commits by key. A key whose preview answered `undefined` is left out.
  - The new module-private `withPreviewedCommit(member, commit)` returns the same member when `commit` is `undefined`. Otherwise it returns a copy.
  - `materialized` and `schedule` take the commits. `planDependencyGraph` narrows with `instanceof Map`.
  - Task 2 adds `DependencyPlanOptions.rootCommit` and builds the root entry with `withPreviewedCommit(graph.root, options.rootCommit)`.
  - The header gains one D-PL4-01 sentence.
- `install-flow.ts` was not edited. Its `planningPorts.preview` binding type-checks against the new port type, and `planInstallMoves` ignores the root preview's answer until plan 04-05 wires `rootCommit`.

## Verification

- `node --test test/orchestrators/plugin/dependency-plan.test.ts test/orchestrators/plugin/install-outcome.test.ts`: 86/86 passed after Task 1. `dependency-plan.test.ts`: 26/26 passed after Task 2.
- `npm run test:coverage:direct -- …/dependency-plan.ts` exited 0 after each task, and `npm run test:coverage:direct -- …/install-outcome.ts` exited 0 after Task 1.
- `tsc --noEmit` and ESLint on the five files were clean before the first commit. Both commits passed the commit hook (`npm run check:commit`, prettier, TruffleHog, gitlint).
- Acceptance greps: each of `readonly previewedCommit?: string;`, `Promise<string | undefined>` (dependency-plan.ts), `return preflight.resolvedSha;`, `readonly rootCommit?: string;`, and `options.rootCommit` prints `1`. `git diff --stat b66bf026..HEAD -- …/install-flow.ts` prints nothing.
- Tracer gate: Task 1's `<verify>` passed end to end before Task 2 started.
- The full `npm run check` was not run, as the dispatch said. The phase gate runs in plan 04-06.

## Deviations from Plan

- **Commit title length.** The plan's example title for Task 1 has 74 characters, so gitlint failed the first attempt (the limit is 72). The title became `feat(plugin): carry each previewed commit on the plan's members`, and the commit was made again, with no `--amend` and no `--no-verify`.
- **No separate RED run.** For each task, the tests and the change were written together, and the first test run already had the implementation. The new cases assert behavior that the earlier code could not produce: no `previewedCommit` key existed, and `previewInstall` returned `void`.
- The fixture commits in the dependency-plan test are `"f".repeat(40)` and `"a".repeat(40)`, which are two distinct 40-hex values, as the plan asks.

## Files edited outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`: only the `ResolvedCascadeMember.previewedCommit` field (Phase 3 owns the file).

No file outside the plan's `files_modified` was touched.

## Known Stubs

None. `previewedCommit` and `rootCommit` have no consumer yet; plan 04-05 adds it.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: c326af59, c8f04bff (both ancestors of HEAD)
- FOUND: all five modified files
