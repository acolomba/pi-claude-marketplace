---
phase: 04-ssh-sources-and-transport-selection
plan: 26
subsystem: records
tags: [system-git, ssh, records, windows, gap-closure]

requires:
  - phase: 04-ssh-sources-and-transport-selection
    provides: "the D-SG-22 gap closures of 04-19 and 04-21 to 04-25"
provides:
  - "WINDOWS #127 and #130 to #138 resolved as fixed through gsd-tools, with no entry appended"
  - "the 04-VERIFICATION.md D-SG-22 gap marked closed, with closed_by 04-19 and 04-21 to 04-25"
  - "the PROJECT.md D-SG-22 row rewritten: the 2026-11-26 amendments, every closed path, the unreachable fetch remote row, and the two paths that only unit cases prove"
  - "the output catalog's Clone transport lines name every block and row that can carry a clone line"
affects: [04-verification]

actuals:
  tokens: 2380
  tasks: 3
  commits: 3

plan_head_before: ebe7828ead4a68a3e8fea533c5962f39134a1121
plan_head_after: 12a901b19b6acfde6ac9df64b3d332b5d508a942

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/WINDOWS.md
    - .planning/PROJECT.md
    - .planning/phases/04-ssh-sources-and-transport-selection/04-VERIFICATION.md
    - docs/output-catalog.md

key-decisions:
  - "The amendments go in the D-SG-22 row's Rationale column, which holds the decision text in this table (Decision | Rationale | Outcome); the bold title stays as it was"
  - "The D-SG-22 outcome keeps its 04-02 to 04-17 list and adds one sentence per gap plan, then the fetch remote fact, the enable-after-ledger fact, the two unit-only paths, and the scenario files"
  - "The catalog byte pin did not move: the new placement text is prose and a list, outside the catalog-state examples that EXPECTED_UTF8_BYTES counts"

patterns-established: []

requirements-completed: [SG-SSH-02, SG-SSH-04]

coverage:
  - id: D1
    description: "WINDOWS #127 and #130 to #138 read fixed, and no entry was appended"
    requirement: SG-SSH-02
    verification:
      - kind: other
        ref: "grep -E '^\\| (127|13[0-8]) \\|' .planning/WINDOWS.md | grep -c '| fixed |' (10)"
        status: pass
    human_judgment: false
  - id: D2
    description: "04-VERIFICATION.md's D-SG-22 gap reads closed, with closed_by, and the report body is unchanged"
    requirement: SG-SSH-02
    verification:
      - kind: other
        ref: "grep -c 'status: closed' 04-VERIFICATION.md (1); git show -U0 bf6288f -- 04-VERIFICATION.md (one frontmatter hunk)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PROJECT.md's D-SG-22 row records the closed decision, its placement choices, the fetch remote fact, and the paths only unit cases prove"
    requirement: SG-SSH-02
    verification:
      - kind: other
        ref: "Task 2 acceptance greps (partly landed 0, Open... 0, via-http 1, bare marketplace block 1, labelled with 1, the fetch phrase 1); one hunk on line 2618"
        status: pass
    human_judgment: true
    rationale: "The greps prove the words are there; a reader confirms that the row says no more than the SUMMARYs of 04-19 and 04-21 to 04-25 prove (T-04-79)"
  - id: D4
    description: "docs/output-catalog.md names every block and row a clone line can sit on"
    requirement: SG-SSH-04
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts (5 of 5)"
        status: pass
      - kind: other
        ref: "grep -c 'a bulk update that changed nothing' docs/output-catalog.md (1); grep -c 'cascade member that failed' docs/output-catalog.md (1)"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-11-26
status: complete
---

# Phase 4 Plan 26: D-SG-22 gap closure records Summary

**The D-SG-22 clone note gap reads closed in every record: WINDOWS #127 and #130 to #138 are fixed through gsd-tools, the verification gap is closed by 04-19 and 04-21 to 04-25, the PROJECT.md D-SG-22 row names every shipped path, the unreachable fetch `remote` row, and the two unit-only paths, and the output catalog lists every block and row that can carry a clone line.**

## Performance

- **Duration:** 32min
- **Started:** 2026-11-26T22:17:00Z
- **Completed:** 2026-11-26T22:48:31Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- WINDOWS #127, #130, #131, #132, #133, #134, #135, #136, #137, and #138 read `fixed`. Each went through `gsd-tools windows fixed <id>`, one call each. `total_count` stays 139, so no entry was appended. #126, #128, #129, and #139 (the enable unsupported-source deviation of 04-20) stay open.
- `04-VERIFICATION.md`: the D-SG-22 gap entry reads `status: closed` with `closed_by: [04-19, 04-21, 04-22, 04-23, 04-24, 04-25]`. Only that frontmatter hunk changed. The report body stays for the re-verification.
- `PROJECT.md` D-SG-22 row, edited in place (one hunk, line 2618):
  - Rationale column: the 2026-11-26 maintainer amendments. These are the `via-http` note (IN-A-02), the bare marketplace block of a D-MF-04 add as a placement choice within D-SG-22 (#132), and the failed enable's root row with the failing member's clone line, labelled with the member's `<plugin>@<marketplace>` (`clone.plugin`, #136).
  - Outcome column: "partly landed" and the open-path list are gone. The outcome names what 04-02 and 04-08 to 04-17 landed, then one sentence per gap plan (04-19, 04-21 to 04-25), citing WINDOWS #127 and #130 to #138.
  - The outcome also says what an enable that fails after its ledger names. It says that no public input makes a fetch row after a clone read `remote`, and it keeps the concurrent-removal exception and gives no WINDOWS entry for that row. It names the two unit-only paths with their reasons: #138's dependency rollback row (04-24) and the reinstall `manual recovery` row (04-22). Last, it lists the scenario files.
- `docs/output-catalog.md`, Clone transport lines: a list now names every place the lines can sit. These places are the marketplace blocks of add, update, and the PUP-2 sync, the bare block of a dependency's marketplace that an install adds, and a bulk update that changed nothing. They are also the plugin rows of every install, update, reinstall, fetch, `info --fetch`, enable, apply, and import outcome that follows a clone (skipped, partially-upgradable, manual-recovery, and disabled included), and a failed enable's row, which carries the line of the cascade member that failed. One sentence adds that only a failed enable's row shows a labelled line (the one `clone.plugin` producer is `enable-disable.messaging.ts`).

## Task Commits

1. **Task 1 (tracer): the ledger and the verification report record the closed paths** - `bf6288f` (docs)
2. **Task 2: the D-SG-22 outcome says what shipped** - `6c395e4` (docs)
3. **Task 3: the output catalog names every place a clone line can sit** - `12a901b` (docs). The full gate ran on the final tree (counts below).

**Plan metadata:** this SUMMARY commit (docs)

Tracer gate after Task 1: interactive, `end-of-phase`, automated-only verify. Both verify commands ran again on the committed tree (fixed count 10, `status: closed` count 1), so expansion continued with no checkpoint.

## Acceptance results

Task 1:
- `| open |` count over rows 127 and 130 to 138: 0. `| fixed |` count: 10. PASS.
- `status: closed` in 04-VERIFICATION.md: 1. PASS.
- `git show --stat bf6288f`: `.planning/WINDOWS.md` and `04-VERIFICATION.md` only. The 04-VERIFICATION.md diff is one hunk at line 112 inside the frontmatter. PASS.
- WINDOWS diff line count: 33 added and 33 removed lines, not 10 (see Deviations). Status changes only, no row appended. The intent passes, but the literal count does not.

Task 2:
- `partly landed`: 0. `Open, to be closed after phase verification`: 0. `via-http` (word): 1. `bare marketplace block`: 1. `labelled with`: 1. `no public input makes a fetch row after a clone read`: 1. PASS.
- `git show -U0 6c395e4 -- .planning/PROJECT.md`: one hunk, `@@ -2618 +2618 @@`. PASS.

Task 3:
- `a bulk update that changed nothing`: 1. `cascade member that failed`: 1. PASS.
- `catalog-contract.test.ts`: `tests 5, pass 5, fail 0`. `EXPECTED_UTF8_BYTES` (55,943) did not move. PASS.
- `npm run check`: see below.

## npm run check (final tree)

`npm run check` ran once, after `node scripts/install-test-peers.mjs`, with `env -u GIT_CONFIG_COUNT` and the Node 24 wrapper first on PATH (22:29 to 22:42 UTC). It exited 1, and only for the known sandbox baselines:

- `check:static`: passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features)
- `test:unpaired`: passed (exit 0. The local reporter prints no count on a pass.)
- `test:integration`: passed (exit 0)
- cucumber `--profile adapter`: `2412 scenarios (2407 passed, 5 failed)`, `30402 steps (30392 passed, 5 skipped, 5 failed)`. The 5 failures are the known `fd`-dependent Glob baselines in `features/hook/tool-use.feature`, lines 296, 355, 443, 1696, and 1834. No other scenario failed.

The `&&` chain stops after the adapter profile fails, so the two remaining members ran by themselves on the same tree:

- cucumber `--profile builtin`: `261 scenarios (261 passed)`, `3592 steps (3592 passed)`
- `npm run test:coverage:direct:all`: passed (exit 0, 100% direct coverage for every source-test pair)

`test/bridges/hooks/dispatch-exec.test.ts:39` did not fail in this run, and the `features/hook/async.feature` timeout scenario did not flake.

## Files Created/Modified

- `.planning/WINDOWS.md` - ten entries set to `fixed` by gsd-tools (table row, JSON `status` and `resolved_at`, and the header counts)
- `.planning/phases/04-ssh-sources-and-transport-selection/04-VERIFICATION.md` - gap `status: closed`, `closed_by`
- `.planning/PROJECT.md` - the D-SG-22 row only
- `docs/output-catalog.md` - the Clone transport lines placement list and the labelled-line sentence

## Decisions Made

- The plan's "Decision column" is the Rationale column of this table, which holds the decision body (`Maintainer chose 2026-11-25.`). The amendments follow that sentence. The bold title stays as it was.
- The outcome lists the scenario files the gap plans added scenarios to, as the D-SG-18 row does: `git-source`, `install-dependencies`, `cross-scope-install`, `github-transport-update`, `github-transport-apply`, `bootstrap`, `marketplace/update`, and `marketplace/url-source`.
- No SUMMARY of 04-19 or 04-21 to 04-25 names a third unit-only path. 04-23's autoupdate rows, 04-25's two enable paths, and 04-21's three install paths each have a scenario. So the outcome names two unit-only paths.

## Deviations from Plan

### Plan miscount

**1. [Rule 3 - Blocking] The WINDOWS diff has 33 changed lines per side, not 10**
- **Found during:** Task 1
- **Issue:** The acceptance criterion expects `grep -c '^+[^+]'` and `grep -c '^-[^-]'` on the Task 1 WINDOWS diff to print 10. But `gsd-tools windows fixed` writes three lines per entry: the table row, and the JSON block's `status` and `resolved_at`. It also rewrites the frontmatter's `open_count`, `fixed_count`, and `last_updated` once per call. Ten calls therefore change 3 x 10 + 3 = 33 lines per side. AGENTS.md forbids hand-editing the file, so the count cannot be 10.
- **Fix:** None needed. The intent of the criterion holds. Every changed line is a status, a `resolved_at`, or a header counter. `total_count` stays 139, and no row was appended.
- **Files modified:** none beyond the plan's
- **Committed in:** bf6288f

**Total deviations:** 1 (a plan miscount, no change in scope). **Impact:** none.

## Issues Encountered

- `.claude/gsd-core` is not in this worktree, so the plan's `node .claude/gsd-core/bin/gsd-tools.cjs` ran as `/home/user/pi-claude-marketplace/.claude/gsd-core/bin/gsd-tools.cjs` with this worktree as its cwd. The tool wrote this worktree's `.planning/WINDOWS.md`. `git status` showed only that file.
- `node_modules/.cache/optional-peers` was empty, and `node scripts/install-test-peers.mjs` filled it (pi-mcp-adapter 7.0.1, pi-subagents 0.88.1, pi-dynamic-workflows 3.15.0). No package was added to the project.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-79: each closure cites the plan whose SUMMARY proves it. Each unit-only path is named with its reason, the fetch `remote` row is stated as 04-19's measured fact, and the full gate ran on the final tree. T-04-SC: no package added.

## Orchestrator actions

This plan ran the gsd-tools windows commands itself, under the orchestrator override: `windows fixed` for 127, 130, 131, 132, 133, 134, 135, 136, 137, and 138. No `windows append` was run, and none is needed. #126, #128, #129, and #139 were not touched. STATE.md and ROADMAP.md were not touched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The records match what 04-19 and 04-21 to 04-25 shipped. Phase 4 is ready for re-verification (`/gsd-verify-work 4`), which writes the new report.

---
*Phase: 04-ssh-sources-and-transport-selection*
*Completed: 2026-11-26*

## Self-Check: PASSED

- All four modified files exist. Commits bf6288f, 6c395e4, and 12a901b are on this branch (`git rev-list --count ebe7828..HEAD` = 3 before this SUMMARY commit).
- Every acceptance check passed, except the literal WINDOWS diff line count (33, not 10), which is a plan miscount. See Deviations.
