---
phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam
plan: "01"
subsystem: testing
tags: [uninstall, reconcile, filesystem, flag-parsing, node-test]

requires:
  - phase: 01-manifest-and-dependency-display
    provides: verified baseline suite and direct-coverage pin file
provides:
  - "Optional readonly keepData on UninstallPluginOptions, threaded to runPostUninstallCleanup"
  - "Consuming mode on the shared extractLocalFlag scanner, alongside its pass-through mode"
  - "Filesystem evidence for both data dispositions, failure ordering, scope isolation and the reconcile default"
affects: [02-02, phase-5-prune, uninstall-option-seam]

actuals:
  tokens: 7694
  tasks: 3
  commits: 4
  plan_head_before: 02754576b5aa06a5de1f1bb9a6cb061378fa2943

tech-stack:
  added: []
  patterns:
    - "Per-invocation uninstall policy lives on UninstallPluginOptions, not on a second operation"
    - "One shared scanner serves both a pass-through and a strict consuming caller"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/edge/handlers/shared.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/edge/handlers/shared.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "keepData guards only data-path resolution and removal; every other post-commit cleanup stays active"
  - "Consuming scanner input is { consumeLongFlags: readonly string[] }; output adds consumedFlags: ReadonlySet<string>; legacy shapes unchanged"
  - "DATA-01..03 stay Pending until plan 02-02 ships the CLI flag those requirements name"

patterns-established:
  - "Data-disposition cases run through the public factories over real temporary files, never a test-only export"
  - "A symlinked data directory proves preservation never resolves the data path at all"

requirements-completed: []

coverage:
  - id: D1
    description: "uninstall with keepData true keeps every byte of a nested data directory while artifacts, the installed record and the standalone declaration are removed"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#uninstall preserves nested data only when keepData is true (true, user|project)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#preservation bypasses the data path while retiring routes, caches and the last clone"
        status: pass
    human_judgment: false
  - id: D2
    description: "keepData false or omitted deletes non-empty data after the durable commit, with no confirmation interaction"
    requirement: DATA-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#uninstall preserves nested data only when keepData is true (false|undefined, user|project)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#retry proof: uninstall: a hooks cascade refusal persists the shrunken record"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#retry proof: uninstall: a refused state save leaves the swept config divergent"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyReconcile removes a dropped plugin's seeded data on the first pass and stays silent on the second"
    requirement: DATA-03
    verification:
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#WR-06: a plugin whose declaration is deleted is uninstalled while its marketplace stays recorded, and the next pass is silent"
        status: pass
    human_judgment: false
  - id: D4
    description: "The shared scanner gains a consuming mode that returns detected boolean names, strips them from residuals, and rejects unknown short and long options without disturbing existing callers"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "tests/edge/handlers/shared.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/shared.ts"
        status: pass
    human_judgment: false

duration: 58min
completed: 2026-09-14
status: complete
---

# Phase 2 Plan 01: Uninstall data disposition and the scanner seam Summary

**An optional `keepData` policy on the real uninstall operation preserves a plugin's data
directory byte for byte while still retiring its artifacts, hook routes, completion cache and
last git clone — with promptless deletion still the shared default at both entry points, and a
consuming mode on the existing flag scanner ready for the CLI flag in plan 02-02.**

## Performance

- **Duration:** 58 min wall clock across two sessions (user pause between task 2 and task 3)
- **Started:** 2026-09-14T16:28:44Z
- **Completed:** 2026-09-14T17:26:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `UninstallPluginOptions` carries a documented optional `keepData`, threaded through
  `uninstallPluginWithTransaction` into `runPostUninstallCleanup`. The guard covers only
  `locations.pluginDataDir` resolution and the data `rm`; containment resolution for the deleting
  path stays outside the tolerated removal catch, so a safety refusal still propagates.
- `extractLocalFlag` gained a named consuming form taking `{ consumeLongFlags: readonly string[] }`
  and returning `consumedFlags: ReadonlySet<string>`. The legacy omitted and `readonly string[]`
  fourth-argument forms keep their exact result shape, residual pass-through, duplicate handling and
  single-dash behavior.
- Data disposition is proven over real temporary files in both scopes: `true` keeps the nested
  bytes, `false` and omission delete them, and a sentinel seeded in the sibling scope is untouched
  either way.
- A symlinked data directory proves preservation never resolves the data path, while the same run
  still removes the hook route, invalidates the completion cache and collects the now-unreferenced
  git clone.
- A failed hooks cascade and a refused state save both retain seeded data, because deletion runs
  only after the durable commit; the successful retry then removes it.
- The reconcile dropped-declaration case seeds real nested data, asserts its removal on the first
  pass, and keeps the existing aggregate-notification and second-pass-silence assertions intact.

## Task Commits

1. **Task 1: Preserve real data through the public uninstall operation** — `87aefafe` (feat)
2. **Task 2: Extend the existing scanner with consumable boolean options** — `a2b27536` (feat)
3. **Task 3: Prove cleanup safety and reconcile's promptless default** — `5a3afa55` (test)

A pause-handoff commit `514fbaca` sits between tasks 2 and 3; it carries planning artifacts only.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` — optional `keepData` on the
  options bundle, threaded to post-commit cleanup and normalized to `false` on omission.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts` — consuming scanner mode beside the
  existing pass-through mode, in one token walk.
- `tests/orchestrators/plugin/uninstall.test.ts` — disposition matrix across both scopes, the
  symlink/hygiene case, and data assertions added to the two retry-proof failure cases.
- `tests/edge/handlers/shared.test.ts` — consuming-form, placement, duplicate, scope-value and
  rejected-token cases beside every pre-existing case.
- `tests/orchestrators/reconcile/apply.test.ts` — seeded data in the WR-06 dropped-declaration
  fixture, with first-pass removal and the unchanged second-pass silence.

## Verification Evidence

Every result below was produced in the resume session on the final tree. The two background runs
left over from the paused session died without writing a terminal result and were discarded, not
read as evidence.

| Check | Command | Result |
|---|---|---|
| Task 3 owners | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts` | exit 0 — 118 tests, 118 pass, 0 fail, 0 skipped |
| Uninstall pair coverage | `npm run test:coverage:direct -- .../orchestrators/plugin/uninstall.ts` | exit 0 — branches 89/89, functions 15/15, lines 893/893 |
| Reconcile pair coverage | `npm run test:coverage:direct -- .../orchestrators/reconcile/apply.ts` | exit 0 — branches 119/119, functions 23/23, lines 961/961 |
| Exact-file hooks | `pre-commit run --files <the two task 3 test files>` | prettier, npm lint, npm format check, npm typecheck, npm fallow, npm direct coverage all Passed |
| Secret scan | `trufflehog filesystem <the two task 3 test files> --results=verified,unknown --fail` | exit 0 — 0 verified, 0 unverified |
| Wave gate | `npm run check` | exit 0 — 6157 unit tests pass, 32 integration tests pass, 0 fail, 0 skipped |
| Wave gate | `npm run test:coverage:direct:all` | exit 0 — 236 pairs in 479 s; 3 pinned shortfalls matched `scripts/test-coverage-direct.pin.json` exactly |

The three recorded shortfalls (`bridges/agents/convert.ts`, `bridges/commands/discover.ts`,
`orchestrators/plugin/install-outcome.ts`) are the pre-existing accepted pins, unchanged by this
plan. `test:coverage:direct:all` was owed because task 2 changed the shared scanner interface.

The TruffleHog pre-commit hook fails in this checkout for an environmental reason, not a finding:
`.git` is a file (linked worktree), so its git-mode scan reports
`failed to read index file: ... not a directory`. Per `CLAUDE.md`, the commit used
`SKIP=trufflehog`, and the equivalent filesystem-mode scan above was run on the exact staged files.

## Decisions Made

- `keepData` guards only the data-specific work. Completion-cache invalidation, hook-route removal,
  unused-clone collection, configuration writes and artifact removal keep their established
  scheduling (D-02-06).
- Consuming-mode input is `{ consumeLongFlags: readonly string[] }` and output adds
  `consumedFlags: ReadonlySet<string>`. Existing callers' shapes are untouched (D-02-05).
- `requirements-completed` is deliberately empty. DATA-01, DATA-02 and DATA-03 each name the
  `uninstall --keep-data` command surface, which plan 02-02 delivers. Marking them complete here
  would claim a CLI flag that does not exist yet, so REQUIREMENTS.md stays Pending for all three
  until 02-02 closes them.

## Deviations from Plan

None — plan executed as written. No deviation rule fired; no auto-fix was required.

## Issues Encountered

- The paused session left two background checks with no terminal result: the full-check exit file
  was never written and the exact-file pre-commit log stopped mid-run. Both were treated as
  unresolved and re-run from scratch rather than inferred from log progress. Both came back green.
- The TruffleHog hook failure described above is environmental and was handled the way `CLAUDE.md`
  prescribes for this checkout.

## Flagged Engine Classifications

The spec-less edge engine returned three unclassified/unresolved rows and zero resolved. That
status is preserved here; behavioral evidence does not retroactively change the engine result.

| Requirement | Engine category/status | Evidence in this plan |
|---|---|---|
| DATA-01 | unclassified / unresolved | Tasks 1 and 3 — retained nested bytes with artifacts and record removed |
| DATA-02 | unclassified / unresolved | Tasks 1 and 3 — promptless omitted/false deletion and failure ordering |
| DATA-03 | unclassified / unresolved | Task 3 — config-driven deletion and next-pass silence |

## Known Stubs

None. This plan added no placeholder value, no skipped test and no unrun `<verify>` command.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The operation seam is proven, so plan 02-02 can add `--keep-data` to the flag catalog, usage text
  and completions and bind it through the consuming scanner into the existing operation.
- Nothing in plan 02-02 needs new production surface in `uninstall.ts` or `shared.ts`.
- Phase 2's remaining gates (code review, Nyquist validation, security, prior-phase regressions and
  goal verification) are still outstanding and run after plan 02-02.

## Self-Check: PASSED

All three task commits resolve (`87aefafe`, `a2b27536`, `5a3afa55`). All five modified files are
present on disk. `keepData` appears in the uninstall orchestrator and `consumeLongFlags` in the
shared scanner. `actuals.commits` is the measured `git rev-list --count 02754576..HEAD` at
SUMMARY-write time; it counts the pause-handoff commit alongside the three task commits and
excludes the metadata commit that carries this file.

---
*Phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam*
*Completed: 2026-09-14*
