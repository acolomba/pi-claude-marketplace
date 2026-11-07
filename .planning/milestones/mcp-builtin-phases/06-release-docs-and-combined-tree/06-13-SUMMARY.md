---
phase: 06-release-docs-and-combined-tree
plan: "13"
subsystem: planning-records
tags: [dubious-choices, frozen-record, parent-lines, requirements]

requires:
  - phase: 06-release-docs-and-combined-tree
    provides: "plans 06-01 to 06-12 and their SUMMARYs; the gate on a7f73bf and 06-CI-HANDOFF.md (06-12)"
provides:
  - "the mcp-builtin root log `.planning/DUBIOUS-CHOICES.md`, opening with `## Decisions waiting on you`"
  - "the archived component-features log at `.planning/milestones/component-features-DUBIOUS-CHOICES.md`"
  - "01-FROZEN.md amended to the combined tree (interfaces 2, 3, 5; sections 3, 4)"
  - "`## Dispositions` in 06-PARENT-LINES.md: PL-01 to PL-94 with outcome and evidence"
  - "the D-P6-18 reading line under DUAL-04 in REQUIREMENTS.md"
affects: [milestone audit, milestone close, user review of choices, CI handoff]

actuals:
  tokens: 100282
  tasks: 3
  commits: 4
plan_head_before: 1bec91e2120360b1d8a4c3d10e11fd0012ffa7f3
plan_head_after: 6e7b953d99a81639a0dfd07aa31a3d5e7cb3f97b

tech-stack:
  added: []
  patterns:
    - "Root review log = new preface and review list, then the parent's working log copied line for line"

key-files:
  created:
    - .planning/DUBIOUS-CHOICES.md
    - .planning/phases/06-release-docs-and-combined-tree/06-13-SUMMARY.md
  modified:
    - .planning/milestones/component-features-DUBIOUS-CHOICES.md
    - .planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md
    - .planning/phases/06-release-docs-and-combined-tree/06-PARENT-LINES.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PL-10 (CI) is `applied; open`: the local legs are measured (9e9c116), and the CI run waits for the parent"
  - "Re-verification lines (PL-36, PL-44, PL-76, PL-88) are `applied` with the gate commit a7f73bf as evidence, since they verified with no change"
  - "The `## Phase 6 (execution)` section repeats no entry that the working-log copy already holds by ID"

patterns-established:
  - "A disposition row cites a commit for every applied part and a BACKLOG ID for every backlogged part"

requirements-completed: [DUAL-04, MDOC-02]

coverage:
  - id: D1
    description: "The previous root log is archived unchanged by git mv in its own commit, and the new root log holds every working-log line, every P6-DC entry, and a review list with every High entry and every Pending decision"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "06-13-PLAN.md Task 1 checks 1 to 4 (node line check, High check, Other decisions check, archive and token-shape scan)"
        status: pass
    human_judgment: true
    rationale: "The review list's short descriptions are paraphrases that the user should judge while reviewing the log"
  - id: D2
    description: "01-FROZEN.md describes interfaces 2, 3, 5 and sections 3, 4 as the combined tree has them, with seven `Amended by mcp-builtin Phase 6` lines"
    verification:
      - kind: other
        ref: "06-13-PLAN.md Task 2 verify (amendment count and three facts) and `grep -c 'An install writes a new record without the'` = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every parent line PL-01 to PL-94 has an outcome and evidence; every sha is a commit and every BACKLOG ID exists; the DUAL-04 reading line cites D-P6-18"
    requirement: DUAL-04
    verification:
      - kind: other
        ref: "06-13-PLAN.md Task 3 checks 1 to 3 (row completeness, sha and BACKLOG existence, DUAL-04 note and traceability row)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 13: Root Log, Frozen Record, and Parent-Line Outcomes Summary

**The milestone's root review log opens with twelve High entries and 36 Pending decisions over a line-for-line copy of the parent's 1642-line working log; 01-FROZEN.md now matches the combined tree; and all 94 parent lines have an outcome with a commit or BACKLOG ID, with one open line (the CI run).**

## Performance

- **Duration:** about 9 min of execution (03:16:55Z to 03:25:22Z for the three tasks), plus the SUMMARY
- **Started:** 2026-11-05T03:16:55Z
- **Completed:** 2026-11-05T03:25:22Z (task commits)
- **Tasks:** 3 of 3
- **Files modified:** 5 planning files, plus this SUMMARY

## Accomplishments

- `.planning/DUBIOUS-CHOICES.md` is the mcp-builtin root log: preface, `## Decisions waiting on you` (`### High`, then `### Other decisions`), the working log from line 22 (`## Session-level choices`) to line 1642 copied byte for byte, and `## Phase 6 (execution)` with this plan's entries.
- The component-features log moved with `git mv` in its own commit; `git log --follow --oneline -- .planning/milestones/component-features-DUBIOUS-CHOICES.md` lists 2 commits (fd414a0, the move, and bdbb5f2, the old root file's only commit).
- 01-FROZEN.md carries seven `Amended by mcp-builtin Phase 6 (2026-11-04):` lines: interface 2, interface 3 (three), interface 5, section 3, section 4.
- 06-PARENT-LINES.md ends with `## Dispositions`: 94 rows plus 24 PL-90 sub-rows.
- REQUIREMENTS.md has the D-P6-18 reading line under the DUAL-04 bullet; the bullet, its checkbox, and its `| DUAL-04 | Phase 6 | Pending |` row are unchanged.

## Task Commits

1. **Task 1 (tracer): the root log** - `fd414a0` (docs: the archive move, alone) and `272dd20` (docs: the new root log). Tracer gate: auto-free unattended run with an automated-only verify; the four checks were re-run after the commit and passed, so expansion went ahead.
2. **Task 2: 01-FROZEN.md amendments** - `99a62fe` (docs)
3. **Task 3: dispositions and the DUAL-04 reading** - `6e7b953` (docs)

**Plan metadata:** the SUMMARY commit, which also adds this plan's entries to the root log.

## Root log entry counts per source

| Source | Entries copied | Note |
| --- | --- | --- |
| Working log `QUESTIONABLE-CHOICES.md` (lines 22 to 1642, 1621 lines) | all, line for line | 410 distinct IDs appear in the copy: S 3, P1-DC 40, P2-DC 59, P3-DC 78, P4-DC 46, P5-DC 30, P6-PRE 2, P6-DC 102, P6-PLN 25, P6-CHK 8, P6-REV 12, P6-EXE 5 (counts are IDs named, which include cross-references) |
| Phase logs 01 to 05 `DUBIOUS-CHOICES.md` | 0 extra | The preface names each by path; their entries are in the working log by ID |
| Phase 6 `DUBIOUS-CHOICES.md` (P6-DC-01 to P6-DC-22) | 0 extra | All 22 IDs are in the working log |
| 06-01 to 06-12 SUMMARY `## Dubious Choices` (80 entries, P6-DC-0101 to P6-DC-1206) | 0 extra | All 80 IDs are in the working log's executor sections (P6-DC-1301 records the choice) |
| This SUMMARY (06-13) | 9 | P6-DC-1301 to P6-DC-1309, in `## Phase 6 (execution)` |

**High IDs found by the second check (12):** P1-DC-12, P1-DC-21, P1-DC-40 (Medium to High; CR-02 High), P2-DC-02, P2-DC-08, P2-DC-100, P3-DC-06, P3-DC-07, P4-DC-06 (High in the working log, Medium in its phase log), P4-DC-60, P4-DC-76, P5-DC-03. No Phase 6 entry is High.

**`### Other decisions`:** 36 Pending IDs written in full (D-MB-08 to D-MB-29, D-P3-01, D-P3-02, D-P3-06, D-P3-07, D-P3-08, D-P3-11, D-P3-12, D-P3-13, D-P5-01, D-P5-02, D-P5-03, D-P5-04, D-P5-06, D-P5-07), then the 02-UAT.md checks, the version bump and PR offer (D-P6-17), and the D-CF1-16 amendment. No drafted Pi report line: 06-05-SUMMARY.md has no `## Drafted upstream report`.

**Token-shape scan:** no match in the working log or the root log.

## 01-FROZEN.md signature comparisons (source at the gate commit; no source file changed since a7f73bf)

| Interface | Record now | Source |
| --- | --- | --- |
| 2 `SoftDepStatus` | `piSubagentsLoaded`, `mcpImplementation`, `workflowEngineLoaded` | `platform/pi-api.ts:171-179`, same three members |
| 3 `LegacyServersSource` | one line with `marketplaceName`, `marketplace` (`Pick<..., "manifestPath" \| "marketplaceRoot" \| "source">`), `pluginName`, `locations: ScopedLocations` | `orchestrators/mcp/recorded-servers.ts:86-98`, same members |
| 3 `LegacyServersUnreadableReason` | not exported, five members ending `"uncontained"` | `recorded-servers.ts:103-104`, `type` without `export`, same five |
| 3 `LegacyServersUnreadableError` | not exported | `recorded-servers.ts:110`, `class` without `export` |
| 3 `createLegacyServersReader` | unchanged; refuses `uncontained` first | `recorded-servers.ts:248-254` |
| 5 `agentGrantsStep` | `export async function agentGrantsStep(input: AgentGrantsStepInput, env: SubagentChildEnv = process.env): Promise<void>;` | `orchestrators/mcp/agent-grants-step.ts:76-79`, same |
| 5 `createLoadReconcile` (prose) | `createLoadReconcile(reader, applyReconcile, env: SubagentChildEnv = process.env)` | `orchestrators/reconcile/load.ts:238-242`, same parameters |
| Section 3 | one entry, no `ignoreExports` | `.fallowrc.json:2`, `"entry": ["extensions/pi-claude-marketplace/index.ts"]`, no `ignoreExports` key |
| Section 4 | all six entries emitted | 06-07-SUMMARY `## Closed-set emitters` |

`grep -c 'An install writes a new record without the'` prints 0 (baseline 1).

## Disposition counts

94 rows (PL-01 to PL-94) and 24 sub-rows (PL-90.1 to PL-90.24, all `repeats PL-NN`).

| Outcome of the row | Rows |
| --- | --- |
| applied | 53 |
| already applied | 7 |
| nothing to apply | 15 |
| no longer applicable | 5 |
| backlogged | 4 |
| left for the user | 1 |
| repeats PL-NN (PL-89) | 1 |
| repeats earlier lines (PL-90, the group row) | 1 |
| applied; left for the user (PL-05) | 1 |
| applied; open (PL-10) | 1 |
| applied; backlogged (PL-31) | 1 |
| applied; no longer applicable (PL-32) | 1 |
| applied; backlogged; no longer applicable (PL-36) | 1 |
| backlogged; no longer applicable (PL-08) | 1 |
| already applied; left for the user (PL-92) | 1 |

**Open lines for the parent:** one. PL-10 (01-14 "CI"): the local legs are measured (9e9c116), but the CI run on the combined tree is not done; the parent dispatched `ci.yml` on 1bec91e and fills `06-CI-HANDOFF.md` `## CI timings` and the D-CF1-16 row after it.

## Checks

| Command | Exit | At |
| --- | --- | --- |
| Task 1 check 1 (working-log lines and P6-DC IDs) | 0 | 272dd20, again at 6e7b953, and again with this SUMMARY |
| Task 1 check 2 (`### High` holds every High entry) | 0 | 272dd20, again at 6e7b953 |
| Task 1 check 3 (`### Other decisions` holds every Pending ID) | 0 | 272dd20, again at 6e7b953 |
| Task 1 check 4 (archive header, token-shape scan) | 0 | 272dd20, again at 6e7b953 |
| Task 2 verify (five or more amendment lines, three facts) | 0 | 99a62fe |
| Task 3 check 1 (complete rows PL-01 to PL-94) | 0 | 6e7b953 |
| Task 3 check 2 (shas are commits, BACKLOG IDs exist) | 0 | 6e7b953 |
| Task 3 check 3 (DUAL-04 note, traceability row) | 0 | 6e7b953 |
| `git diff --stat a7f73bf HEAD -- . ':(exclude,glob).planning/**/*.md'` | 0, empty | 6e7b953 |

## Files Created/Modified

- `.planning/DUBIOUS-CHOICES.md` - the mcp-builtin root log (new content at the old path)
- `.planning/milestones/component-features-DUBIOUS-CHOICES.md` - the previous root log, moved and not changed
- `.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md` - seven Phase 6 amendments
- `.planning/phases/06-release-docs-and-combined-tree/06-PARENT-LINES.md` - `## Dispositions`
- `.planning/REQUIREMENTS.md` - the D-P6-18 reading line under DUAL-04

## Decisions Made

See `## Dubious Choices`. The plan's rules decided the rest.

## Deviations from Plan

None - plan executed exactly as written. Two notes on how the plan's text met the current sources:

- The plan named D-MB-08 to D-MB-13 as the Pending rows at planning time. After 06-10, 36 rows are Pending, so `### Other decisions` names all 36.
- The PL-90 group row has the outcome `repeats earlier lines`, which is not one of the plan's eight words, because the group row stands for 24 sub-rows (P6-DC-1307).

## Issues Encountered

The worktree's command guard refused compound shell lines (pipes with `git`, `awk -v`), so the checks ran from script files in the scratchpad. No result changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 6 records are complete for the user's review. The parent still owns: the CI run and `## CI timings`, the D-CF1-16 amendment, and the review of `.planning/DUBIOUS-CHOICES.md` with the user.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None. No stub, skipped test, or unrun verify was left (and `gsd-tools windows` was not run, as the plan requires).

## Dubious Choices

- **P6-DC-1301 (Low):** the root log's `## Phase 6 (execution)` section repeats none of P6-DC-01 to P6-DC-22 and P6-DC-0101 to P6-DC-1206, because the working-log copy above it already has an entry with each ID. The working log's executor entries are short summaries, so the full text of the 80 SUMMARY entries stays only in the SUMMARYs. Alternative: copy the full SUMMARY text again, so one file holds it all, at the cost of a second, longer version of 80 entries. Chosen because the plan's rule writes each entry once.
- **P6-DC-1302 (Low):** the twelve `### High` lines and the 36 `### Other decisions` lines are my own short paraphrases of the entries and the Key Decisions row titles. Alternative: quote each entry's first line verbatim, which is longer and in places unclear without context. A paraphrase can drift from the entry; each line names the file with the full text.
- **P6-DC-1303 (Low):** PL-10 (01-14 "CI") is `applied; open`. The local re-measure is done (9e9c116), and the CI run is not. Alternatives: `left for the user` (the parent, not the user, runs CI) or `applied` (would hide the pending run). Chosen by the plan's rule that a line not done is `open` and listed for the parent.
- **P6-DC-1304 (Low):** the re-verification lines PL-36 (switch and status part), PL-44, PL-76, and PL-88 are `applied` with the gate commit a7f73bf as evidence, although no commit changed anything for them: they ran and passed with no change. Alternative: `nothing to apply`, which would hide that the re-run happened, or `already applied`.
- **P6-DC-1305 (Low):** PL-03 (remove the closed-set entries nothing emits) is `nothing to apply`, because all six are emitted (D-P6-20). Alternative: `applied` with 06-07's record, but 06-07 Task 3 has no commit and nothing was removed.
- **P6-DC-1306 (Low):** PL-32 (02-08 item 5) is `applied; no longer applicable`: the two example blocks became prose and table rows (D-P6-26) and count as applied in d343443, and the line 3161 `not loaded` change no longer applies (P6-DC-0702). Alternative: mark the example-block part `open`, since the blocks the line asked for do not exist.
- **P6-DC-1307 (Low):** the PL-90 group row's outcome is `repeats earlier lines`, outside the plan's list of outcomes, and PL-89 and several sub-rows join two or more `repeats PL-NN` parts. Alternative: give PL-90 one `repeats` label, which no single label fits. The checks read only `applied`, shas, and BACKLOG IDs, so this does not change them.
- **P6-DC-1308 (Low):** in 01-FROZEN.md, the module-private `LegacyServersUnreadableReason` and `LegacyServersUnreadableError` stay in interface 3's code block without `export` and with a `// module-private` comment, as interface 2 shows `hasLoadedBuiltinMcp`. The amended `agentGrantsStep` line keeps `async`, as the source has it, unlike the block's other declarations. Alternative: delete the two private lines and write the step without `async`.
- **P6-DC-1309 (Low):** PL-05 (CHANGELOG with the PR number) and PL-92 (02-UAT.md) carry `left for the user` for their open part. The PR number waits for the PR, which waits for the user (D-P6-17); the 02-UAT.md checks need the user. Alternative: `open`, which would ask the parent to act on something only the user can settle.

## Self-Check: PASSED

- FOUND: `.planning/DUBIOUS-CHOICES.md`, `.planning/milestones/component-features-DUBIOUS-CHOICES.md`, `.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`, `.planning/phases/06-release-docs-and-combined-tree/06-PARENT-LINES.md`, `.planning/REQUIREMENTS.md`
- FOUND commits on this branch: fd414a0, 272dd20, 99a62fe, 6e7b953

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
