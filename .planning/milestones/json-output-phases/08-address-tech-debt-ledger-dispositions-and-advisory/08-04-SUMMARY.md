---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
plan: "04"
subsystem: planning-records
tags: [windows-ledger, broken-windows, ship-gate, phase-gate, fallow-audit]

requires:
  - phase: 08-address-tech-debt-ledger-dispositions-and-advisory
    provides: "08-01 lock commit a12dfa16; 08-02 resolver-order commits 3f20490a and 9829a30e (entry 89); 08-03 BACKLOG.md carriers WOUT-01 (entry 84) and DEPADV-01"
provides:
  - "WINDOWS.md ledger with open_count 0: 23 entries waived under full [json-output] reasons, entries 85 and 89 fixed"
  - "Phase 8 gate evidence: npm run check exit 0 at 0b5f7067, fallow audit verdict pass against a876e321"
affects: [milestone-audit, gsd-ship]

actuals:
  tokens: 9137
  tasks: 3
  commits: 1
plan_head_before: cd09161434162978b6f0890289a1c9d8d75d9559
plan_head_after: 0b5f7067c83daf2b0edbc40e3ebb2e61a9d87a31

tech-stack:
  added: []
  patterns:
    - "Ledger batches run through one retry-safe Node script that passes each reason as a single argv element and dry-runs on a --cwd ledger copy first"

key-files:
  created:
    - .planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/deferred-items.md
  modified:
    - .planning/WINDOWS.md

key-decisions:
  - "Entries 32-34 and 41-58 waived as moot (D-01, D-02); 84 waived to BACKLOG.md WOUT-01 (D-03); 88 waived as accepted design (D-05); 85 and 89 marked fixed only after their owner tests passed on the committed tree (D-04, D-06)"
  - "The windows status --pick failure on a piped stdout is a pre-existing gsd-tools defect, logged as DEF-08-04-01; the /gsd-ship gate reads the full JSON with jq and sees 0"

requirements-completed: []

coverage:
  - id: D1
    description: "Every open WINDOWS.md entry has a fixed or waived disposition, so the ledger reads open_count 0 (SC-1)"
    verification:
      - kind: other
        ref: "windows status | node SC-1 check (plan 08-04-02 verify 1): { open: 0, waived: 50, fixed: 39, total: 89, bad: [] }"
        status: pass
      - kind: other
        ref: "windows status --pick ledger.open_count > file -> 0; ship.md read path (jq .ledger.open_count) -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase gate on the final tree: npm run check, fallow audit, no new suppression, protected paths byte-identical, SC-2 to SC-5 re-proven"
    verification:
      - kind: other
        ref: "npm run check (unpiped) at 0b5f7067"
        status: pass
      - kind: other
        ref: "npx fallow audit --base a876e321 --format json --quiet -> verdict pass"
        status: pass
      - kind: integration
        ref: "tests/integration/skill-path-resolution.test.ts + provenance-invisibility.test.ts: peer present pass 2 skipped 0; PI_SUBAGENTS_ROOT=/nonexistent skipped 2 fail 0"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-10
status: complete
---

# Phase 8 Plan 04: Ledger Dispositions and Phase Gate Summary

**All 25 open broken-window entries disposed through one retry-safe argv-safe batch (23 waived with full `[json-output]` reasons, 85 and 89 fixed), leaving the ledger at open 0 / waived 50 / fixed 39 / total 89, with `npm run check` and `fallow audit` green on the final tree.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-10T20:20:00Z
- **Completed:** 2026-10-10T20:26:30Z
- **Tasks:** 3
- **Files modified:** 1 tracked file by a task commit (`.planning/WINDOWS.md`), plus this SUMMARY and `deferred-items.md` in the metadata commit

## Accomplishments

- Dry-ran the full 25-row batch on a `--cwd` copy of the ledger: first run `summary open=0 waived=50 fixed=39 total=89 applied=25 skipped=0`, second run `applied=0 skipped=25`; the real ledger stayed byte-identical (`git diff --exit-code` 0).
- Applied the batch to the real ledger: `summary open=0 waived=50 fixed=39 total=89 applied=25 skipped=0`. Every waived reason equals its intended string exactly (the script asserts equality, not containment).
- Ran the phase gate on HEAD `0b5f7067`: `npm run check` exit 0 (84 s), fallow audit verdict `pass`.

## Task Commits

1. **Task 08-04-01: Dry-run the full disposition batch on a copy of the ledger.** No commit, by design (scratch script and ledger copy only).
2. **Task 08-04-02: Apply the dispositions to the real ledger and commit it.** `0b5f7067` (`docs(planning): dispose every open broken-window ledger entry`). The commit contains only `.planning/WINDOWS.md`.
3. **Task 08-04-03: Run the phase gate on the final tree and record the evidence.** No tracked change; its output is this SUMMARY.

**Plan metadata:** the `docs(08-04)` commit that adds this file.

## Prerequisites proven before the real run (08-04-02 step 1)

| Check | Result |
| --- | --- |
| `grep -c '^## WOUT-01: ' .planning/BACKLOG.md` (D-03) | `1` |
| `git diff --quiet HEAD -- tests/integration/skill-path-resolution.test.ts` (D-06) | exit 0 |
| `node --test --test-reporter=tap tests/integration/skill-path-resolution.test.ts` (D-06) | exit 0; `# pass 1`, `# fail 0`, `# skipped 0` |
| `node --test tests/orchestrators/marketplace/update.test.ts` (D-04) | exit 0; 66 tests, 66 pass |

## Phase gate evidence (SC-1 to SC-5)

Environment: HEAD `0b5f7067c83daf2b0edbc40e3ebb2e61a9d87a31`, Node `v26.11.1`, global peer `pi-subagents@0.47.1` (`npm ls -g --depth=0 pi-subagents`).

| SC | Command | Exit | Key output |
| --- | --- | --- | --- |
| SC-1 | `windows status \| node` SC-1 check (statuses, `[json-output]` prefixes, retiring commits, carrier, design constraint) | 0 | `{ open: 0, waived: 50, fixed: 39, total: 89, bad: [] }` |
| SC-1 | `windows status --pick ledger.open_count > file` | 0 | `0` (see Deviations: the piped form fails on a pre-existing tool defect) |
| SC-2 | `node --test --test-reporter=tap` on `skill-path-resolution` + `provenance-invisibility`, peer present | 0 | `# pass 2`, `# skipped 0` |
| SC-2 | same, `PI_SUBAGENTS_ROOT=/nonexistent` (CI path) | 0 | `# skipped 2`, `# fail 0` |
| SC-3 | `npm audit --package-lock-only --json` + node check | 0 (node check; npm audit's own exit 1 is expected) | only `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion` reported; root `brace-expansion` `5.0.12`, nested `5.0.9` |
| SC-4, SC-5 | BACKLOG / deferred-items / validation-record node check | 0 | `{ ok: true }`: one `## WOUT-01:`, one `## DEPADV-01:`, DEP-07-03-01 points at DEPADV-01, 03 reads `nyquist_compliant: true`, 01 reads `false` with no contradicting `[x]` line |
| SC-5 | `npm run check` (unpiped, output redirected to a file) | 0 | static checks, unpaired, integration, and direct coverage all passed; `Merged LCOV: coverage/direct.lcov (266 records)` |
| SC-5 | `npx fallow audit --base a876e321 --format json --quiet` | 0 | `pass {"dead_code_issues":0,"dead_code_has_errors":false,"complexity_findings":0,"max_cyclomatic":null,"duplication_clone_groups":0}` |
| SC-5 | `git diff a876e321 -U0 -- . ':(exclude).planning'` grepped for `fallow-ignore\|eslint-disable\|@ts-expect-error\|@ts-ignore\|node:coverage` on added lines | 0 | no match |
| SC-5 / D-12 | `git diff --exit-code a876e321 --` `extensions/`, `docs/output-catalog.md`, the 01 notify-corpus, `package.json`, `tests/e2e/pi-peer-floor/`, `.github/workflows/`, 01-06 `*-VERIFICATION.md` | 0 | byte-identical |

## D-02 evidence: the 21 inherited entries (32-34, 41-58)

The 21 entries name 18 distinct paths. 14 are absent. The 4 present ones no longer hold what their entries describe. Output of the 08-RESEARCH.md loop, run on the final tree:

```text
absent  scripts/check-unused-type-members.contracts.json
PRESENT extensions/pi-claude-marketplace/bridges/hooks/stage.ts
PRESENT extensions/pi-claude-marketplace/edge/handlers/tools.ts
absent  scripts/coverage-producer.convert.mjs
PRESENT .gitignore
PRESENT package.json
absent  tests/scripts/coverage-source-map-fixtures.ts
absent  scripts/coverage-source-map.mjs
absent  tests/scripts/coverage-run-support.ts
absent  tests/scripts/coverage-correspondence-fixtures.ts
absent  scripts/coverage-capture.mjs
absent  scripts/coverage-validate.mjs
absent  tests/scripts/coverage-projection.ts
absent  tests/scripts/coverage-unit-fixtures.ts
absent  tests/scripts/coverage-source-map.test.ts
absent  tests/scripts/check-coverage-risk-fixtures.ts
absent  scripts/coverage-acceptance.mjs
absent  tests/architecture/pre-commit-hooks.ts
```

The two greps that follow it:

- `grep -c 'vendor/coverage' .gitignore` prints `0` (entry 42's line is gone).
- `grep -n 'coverage:producer\|lint:type-members' package.json` prints nothing and exits 1 (entries 43 and 32 describe scripts that are gone).

The 08-04-01 node check confirmed the same facts from the ledger itself: `distinct: 18`, the 4 present paths exactly as listed above, `gi: false`, `sc: []`. The D-05 evidence also held: `tests/` contains 138 references to `renderMpHeader` and `composePluginLines` in 15 files.

**Entry 58 note:** its named file, `tests/architecture/pre-commit-hooks.ts`, did reach main through #202, and #234 (`e6c274bf`, "perf: speed up local checks and remove duplicate CI work") later deleted it. The locked R2 reason for 41-58 is unchanged; this note records the detail instead.

## Phase 07 verification status (D-12, accepted)

`node .claude/gsd-core/bin/gsd-tools.cjs verification status .planning/phases/07-mode-refusals-real-pi-verification-and-docs` reads `"status": "stale"` with `next_command: /gsd-execute-phase 07`. This is expected: 08-01 and 08-03 edited `package-lock.json` and phase 07's `deferred-items.md`, which its `covered_files` list. Per D-12 this is accepted, and phases 01-06 are left alone. The `/gsd-progress` route to phase 07 is therefore not a regression.

## Files Created/Modified

- `.planning/WINDOWS.md`: 25 entries moved from open to waived or fixed through the windows verbs only (commit `0b5f7067`).
- `.planning/phases/08-address-tech-debt-ledger-dispositions-and-advisory/deferred-items.md`: DEF-08-04-01, the out-of-scope `--pick` defect.
- Scratch only, never committed: `dispose-ledger.mjs`, the ledger copy, the TAP, audit, and diff captures, and the commit message file, all under the session scratchpad (`TMPDIR` was set to the scratchpad so the plan's `${TMPDIR:-/tmp}` paths resolved there).

## Decisions Made

- Waivers and fixes follow D-01 to D-06 exactly, with the plan's four reasons R1 to R4 stored verbatim.
- The batch ran with `TMPDIR` pointing at the session scratchpad instead of `/tmp`, so the scratch files stay out of the system temp directory. The plan's commands use `${TMPDIR:-/tmp}` and ran unchanged.

## Deviations from Plan

### Out-of-scope discovery (logged, not fixed)

**1. `windows status --pick ledger.open_count` fails when its stdout is a pipe**
- **Found during:** Task 08-04-02, acceptance check 2 (`test "$(... --pick ledger.open_count)" = 0`).
- **Issue:** in a `$(...)` capture or a pipe, the command exits 1 with `--pick "ledger.open_count": command output was not JSON`. The status JSON is larger than the pipe buffer: 85,009 bytes before this plan and about 92 KB after. The pre-plan ledger (`HEAD~1`) fails the same way, so the dispositions did not cause it. The planner's "prints the bare number" was measured with a non-pipe stdout.
- **Resolution:** the same command with stdout redirected to a file prints `0` and exits 0, and that form was used for the acceptance and SC-1 checks. The `/gsd-ship` broken-windows gate does not use `--pick`: it captures `windows status --raw` and reads `.ledger.open_count` with `jq`, and that exact path printed `0`. Logged as DEF-08-04-01 in `deferred-items.md`. gsd-tools is gitignored upstream tooling, so it was not edited.
- **Files modified:** `deferred-items.md` (new).

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope tool defect logged.
**Impact on plan:** none on the ledger or the gate. One acceptance command needed its file-redirect form.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All four plans of phase 8 have summaries. The ledger reads open 0, so the broken-windows ship gate passes. Phase verification and phase completion belong to the orchestrator.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `.planning/WINDOWS.md` committed in `0b5f7067` (`git merge-base --is-ancestor 0b5f7067 HEAD` holds; it is HEAD's commit at the time of writing).
- `deferred-items.md` exists on disk.
- Measured commits since `plan_head_before`: 1 (`git rev-list --count cd091614..HEAD`).
