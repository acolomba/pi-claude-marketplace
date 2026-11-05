---
phase: 06-release-docs-and-combined-tree
plan: "10"
subsystem: docs
tags: [changelog, backlog, windows-ledger, project-decisions, mcp-builtin]

requires:
  - phase: 06-release-docs-and-combined-tree
    provides: "06-01 to 06-08 shipped the switch read, the apply grant, completions, the encoder and gate work, the @mcp new-session scenario (window 112 fixed), the release docs with D-MB-14..29 citations, the output catalog, and the contained legacy reader"
provides:
  - "CHANGELOG [Unreleased] milestone entry: one lead bullet and 18 sub-bullets (MDOC-02 CHANGELOG half)"
  - "17 BACKLOG entries for the parent lines Phase 6 does not apply"
  - "Window ledger entry 112 marked fixed through gsd-tools"
  - "PROJECT.md Key Decisions rows D-MB-14..29, D-P3 and D-P5 rows, Phase 4 text on D-MB-03 and D-MB-12, five Validated entries, and a new Last updated line"
affects: [06-12, 06-13, milestone audit, PR description]

actuals:
  tokens: 11600
  tasks: 3
  commits: 3
plan_head_before: f8d1141bde8373586cc67e0e22ef24c04c4d6208
plan_head_after: a65e979b70fc18de1633d68eea5cd8dcbf0f7ada

tech-stack:
  added: []
  patterns:
    - "Phase decision IDs (D-P3-NN, D-P5-NN) keep their own Key Decisions rows instead of new D-MB IDs, because code comments and scenario titles cite them"

key-files:
  created: []
  modified:
    - CHANGELOG.md
    - .planning/BACKLOG.md
    - .planning/WINDOWS.md
    - .planning/PROJECT.md

key-decisions:
  - "The CHANGELOG entry splits the drafted lines into 18 short sub-bullets so that each meets the 40-word and 25-word limits"
  - "RPCSESSION-01 is not written, because plan 06-05 lifted the new-session scenario to @mcp"
  - "Every new Key Decisions row is -- Pending; D-MB-08 to D-MB-13 stay -- Pending; the D-CF1-16 row waits for the parent's CI amendment"

patterns-established: []

requirements-completed: [MDOC-02]

coverage:
  - id: D1
    description: "CHANGELOG [Unreleased] holds one lead bullet without a PR number and sub-bullets for every drafted milestone line, in the changelog skill's limits"
    requirement: MDOC-02
    verification:
      - kind: other
        ref: "Task 1 node rule script over the [Unreleased] section (word, sentence, semicolon, modal, PR-number, bullet-count checks)"
        status: pass
      - kind: other
        ref: "awk + grep -F \"turn on Pi's built-in MCP or install pi-mcp-adapter\" on the [Unreleased] section"
        status: pass
      - kind: other
        ref: "pre-commit run --files CHANGELOG.md (mdformat, markdownlint-cli2)"
        status: pass
    human_judgment: true
    rationale: "The MDOC-02 prohibition (the CHANGELOG must not say or imply that the extension turns on Pi's built-in MCP) is a judgment check"
  - id: D2
    description: "BACKLOG gains the 17 deferred entries, each naming its source IDs"
    verification:
      - kind: other
        ref: "Task 2 ID loop over .planning/BACKLOG.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "Window entry 112 is fixed"
    verification:
      - kind: other
        ref: "gsd-tools windows status (112 status fixed, open_count 13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "PROJECT.md carries D-MB-14..29, the D-P3 and D-P5 rows, Phase 4 text on D-MB-03 and D-MB-12, and the Phase 1 to 5 Validated entries"
    verification:
      - kind: other
        ref: "Task 3 grep loops (D-MB-14..29 rows, every D-MB ID the two docs cite has a row, D-P3-01, D-P5-04, mcp-builtin Phase 3)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 10: Release records for built-in MCP Summary

**The CHANGELOG now has the milestone's Unreleased entry (a lead bullet for built-in MCP support and 18 sub-bullets, the Pi 1.5.0 line folded in). BACKLOG gains 17 deferred built-in MCP items, window 112 is fixed, and PROJECT.md records D-MB-14..29, the Phase 3 and Phase 5 decisions, Phase 4's implementation text, and Validated entries for Phases 1 to 5.**

## Performance

- **Duration:** about 9 min of execution (reads included, about 20 min)
- **Started:** 2026-11-05T02:08:05Z
- **Completed:** 2026-11-05T02:17:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- The CHANGELOG `[Unreleased]` entry: the lead bullet names Pi's built-in MCP support. It says that switching needs no plugin command and that Pi 1.5.0 is required. It has no PR number yet (D-P6-01, D-P6-17). Under it are 18 sub-bullets.
- 17 BACKLOG entries (MCPV2-01..03, DENYPIN-01, BLTNOTICE-01, TOOLSEARCHOFF-01, BLTOWNER-01, HOOKTOOLSEARCH-01, HOOKDETAILS-01, HOOKPROXYBOTH-01, HOOKMATCH-01, HOOKNOIMPL-01, PENDAPPLY-01, GRANTLEGACY-01, GRANTWARN-01, SWITCHNOTICE-01, STRICTINSTALL-01). Each one's first paragraph names its source IDs. No ID was taken, so none was renamed.
- Window ledger entry 112 is `fixed`, set through `gsd-tools windows fixed 112`.
- PROJECT.md gains 23 Key Decisions rows, all `-- Pending`: D-MB-14..29, the D-P3-01/02, D-P3-06..08, D-P3-11/13, and D-P3-12 rows, and the D-P5-01..03, D-P5-04, and D-P5-06/07 rows. D-MB-03 and D-MB-12 gain Phase 4's text. Validated gains five entries, and a new Last updated line leads the list.

## Task Commits

1. **Task 1: The CHANGELOG tells a reader what the milestone changes** - `3fd8819` (docs)
2. **Task 2: BACKLOG entries and the window ledger** - `511bb30` (docs)
3. **Task 3: PROJECT.md decisions and validated requirements** - `a65e979` (docs)

## Files Created/Modified

- `CHANGELOG.md` - the milestone's `[Unreleased]` entry
- `.planning/BACKLOG.md` - 17 new entries, appended newest last
- `.planning/WINDOWS.md` - entry 112 fixed (written by `gsd-tools windows`, not by hand)
- `.planning/PROJECT.md` - Key Decisions rows, D-MB-03 and D-MB-12 text, Validated entries, Last updated line

## CHANGELOG lines and the sub-bullets that carry them

| Drafted parent line | Sub-bullet |
|---|---|
| 01-14 "CHANGELOG.md" (the Pi 1.5.0 fold, P1-DC-27) | `The extension now needs Pi 1.5.0 or newer.` (sub-bullet 1). The lead bullet also names Pi 1.5.0. The PR number waits for the PR (D-P6-17). |
| 02-08 item 1 (built-in runs at each start and `/reload`, trusted projects, status in `info`, no plugin command) | Lead bullet (no plugin command); sub-bullet 2 (registration at start and `/reload`, project servers only in a trusted project); sub-bullet 4 (`info` built-in states) |
| D-P6-02 turn-on words | Sub-bullet 3 (`turn on Pi's built-in MCP or install pi-mcp-adapter`, and pi-mcp-adapter runs them when both are loaded) |
| 03-09 CHANGELOG line 1 (the three markers) | Sub-bullet 5 |
| 03-09 CHANGELOG line 2 (state, verdicts, consent follow the implementation; `list`, `info`, `fetch`; `info` per-server verdicts) and the parent note "Phase 3 CHANGELOG candidate" and "`list` follows the active MCP implementation" | Sub-bullets 6 and 7 |
| 03-09 CHANGELOG line 3 with the P3-DC-112 correction | Sub-bullet 8 (the `install` rule), sub-bullet 9 (dependency moves and the plain `update`), sub-bullet 10 (`enable`, `apply`, `pending`) |
| 03-09 CHANGELOG line 4 (`requires:` naming, `{"companion":"mcp"}`) | Sub-bullet 11 |
| 03-09 addendum CR-01/WR-05 (the record backfill) | Sub-bullet 12 |
| 04-06 item 5 MGRT-01, and 06-02 (apply and autoupdate write the active form at once, P4-DC-60) | Sub-bullets 13 and 14 |
| 04-06 item 5 MGRT-02 | Sub-bullet 15 |
| 05-04 item 1 (hook tool names, the `-` to `_` fold, Pi's 55-character cut) | Sub-bullets 16 and 17 |
| 05-02 CHANGELOG line and the proxy part of 05-04 item 1 | Sub-bullet 18 |
| Parent note: completion follows the implementation (P3-DC-22, 06-03) | Sub-bullet 19 |

Acceptance greps on the section: `requires mcp` 1, `requires builtin mcp` 1, `requires pi-mcp-adapter` 1, `Tab completion` 1, `55` 1. The count of `^  - The extension now needs Pi 1.5.0 or newer\.$` is 1 (0 at HEAD).

## Window records

Applied: `windows fixed 112` (06-05's `## Window records` says `112: fixed`). Every other 06-01 to 06-08 SUMMARY lists `None.`, so nothing else was appended, fixed, or waived.

`windows status` before (each full JSON output is about 104 KB, so this lists the counters, the open IDs, and entry 112):

```text
open_count 14, waived_count 52, fixed_count 46, total_count 112, last_updated 2026-11-04T15:04:12.808Z
open: 93,94,100,101,102,103,104,105,106,107,108,109,111,112
112: kind unmet-truth, phase 2, file features/mcp-server/lifecycle.feature, status open, resolved_at null
```

`windows status` after:

```text
open_count 13, waived_count 52, fixed_count 47, total_count 112, last_updated 2026-11-05T02:11:02.263Z
open: 93,94,100,101,102,103,104,105,106,107,108,109,111
112: status fixed, resolved_at 2026-11-05T02:11:02.263Z
```

## PROJECT.md counts

- `grep -c -- '-- Pending' .planning/PROJECT.md`: 6 at HEAD, 29 after, so 23 more, one for each new row.
- `grep -c 'Implemented by mcp-builtin Phase 4'`: 1 (0 at HEAD).
- The first `_Last updated:` line names mcp-builtin Phase 6.
- The D-MB IDs that `docs/mcp-compatibility.md` and `docs/hooks-compatibility.md` cite all have rows (the Task 3 loop printed nothing).

## Parent-line dispositions

CHANGELOG:
- 01-14 "CHANGELOG.md": applied (sub-bullet 1 and the lead bullet). The PR number waits for the PR (D-P6-17).
- 02-08 item 1: applied (lead bullet, sub-bullets 2 and 4).
- 03-09 "CHANGELOG.md", its four lines: applied (sub-bullets 5 to 11). The P3-DC-112 correction is applied (sub-bullet 9). CR-01/WR-05 is applied (sub-bullet 12).
- 04-06 item 5: applied (sub-bullets 13 to 15). P4-DC-60 is applied (sub-bullet 13).
- 05-02 CHANGELOG: applied (sub-bullet 18).
- 05-04 item 1: applied (sub-bullets 16 to 18).
- Parent notes: the Phase 3 `info` candidate is applied (sub-bullet 7). Completion following the implementation is applied (sub-bullet 19).

BACKLOG:
- 01-14 "BACKLOG.md": MCPV2-01, MCPV2-02, and MCPV2-03 are backlogged as those IDs. The four Phase 1 conditionals are listed below.
- 02-08 item 4: (a) was applied by 06-04, not by this plan. (b) is backlogged as DENYPIN-01, (c) as BLTNOTICE-01, (d) as TOOLSEARCHOFF-01, and (e) as BLTOWNER-01.
- 02-08 item 9: the strict `which did not fail` installs (P2-DC-78) are backlogged as STRICTINSTALL-01. The `info` re-verify and the switch restart results belong to 06-12 Task 1 (06-13's PL-36 row). The AMIG-01 part no longer applies (D-P3-16).
- 02-06 lines 2-3 and 02-08 items 17-18: no longer applicable. Plan 06-05 lifted "A new session offers the plugin's tool again (BLT-01)" to `@mcp` and drafted no report, so RPCSESSION-01 is not written (D-P6-11). Flagged assumption 2 of 02-06 is again true for that scenario, which now passes under both profiles.
- 03-09 addendum P3-DC-122: backlogged as PENDAPPLY-01.
- 04-06 item 8: backlogged as GRANTLEGACY-01 and GRANTWARN-01.
- 05-02 BACKLOG: backlogged as HOOKPROXYBOTH-01.
- 05-04 item 5: backlogged as HOOKTOOLSEARCH-01, HOOKDETAILS-01, HOOKPROXYBOTH-01, HOOKMATCH-01, and HOOKNOIMPL-01.

WINDOWS:
- 02-06 line 1 and 02-08 item 16 (entry 112): the harness half was applied by 06-05. The ledger half is applied here: `windows fixed 112`.
- Every SUMMARY's window records: applied. Only 06-05 listed one (112). The rest list `None.`

PROJECT.md:
- 01-14 "PROJECT.md": D-MB-08 to D-MB-13 stay `-- Pending` (applied: unchanged). The D-CF1-16 amendment is left for the parent after CI, from plan 06-12's handoff (not this plan's edit).
- 02-08 item 3: applied as D-MB-14 (P2-DC-02), D-MB-16 (P2-DC-04), D-MB-17 (P2-DC-05), D-MB-19 (P2-DC-08), D-MB-20 (P2-DC-10), D-MB-22 (P2-DC-13), D-MB-23 (P2-DC-14), and D-MB-25 (P2-DC-20). These are inside D-MB-14..29 (D-P6-24).
- P2-DC-90: applied. D-MB-14..29 are minted in P2-DC order. 06-06 re-pointed the docs citations.
- 03-09 addendum: Validated MREC-03..07 is applied (the Phase 3 entry). The Key Decisions candidates are applied as the D-P3-01/02, D-P3-06..08, D-P3-11/13, and D-P3-12 rows. The "Update Last updated to after mcp-builtin Phase 3" line is superseded by the Phase 6 Last updated line, which names the same rows.
- 04-06 item 7: applied verbatim to D-MB-03 and D-MB-12. Their statuses did not change (D-MB-03 `-- Locked`, D-MB-12 `-- Pending`).
- 05-04 item 4: applied as the D-P5-01..03, D-P5-04, and D-P5-06/07 rows.

The four Phase 1 conditionals:
- (a) What `info`'s `requires:` shows while an implementation runs every server: settled by D-P3-08 (row D-P3-06, D-P3-07, D-P3-08).
- (b) A load warning row for a plugin that becomes partial after a switch: deferred by D-P3-14, backlogged as SWITCHNOTICE-01.
- (c) Built-in `not loaded` against `not connected`: settled by D-MB-20 as a documented gap.
- (d) How the first built-in session reports legacy `mcp.json` entries: settled by D-MB-21 as a documented gap.

## Decisions Made

- D-P3 and D-P5 rows keep their phase IDs (plan flagged assumption). No new ID was minted.
- Every new row is `-- Pending`, for the user's review.

## Deviations from Plan

None in what was delivered. Process notes are in Dubious Choices (the date, the summarized ledger output, and the reference files that were read only in part).

## Issues Encountered

- The worktree isolation guard refused compound Bash commands with sed scripts or a `git` word inside loops. Edits were made with the Edit tool and short node scripts instead. This changed nothing in the output.

## User Setup Required

None.

## Next Phase Readiness

- Plan 06-12 runs the gate on the tree that holds these records. They are not build inputs.
- Plan 06-13 can check the inventory against `## Parent-line dispositions` above.
- The CHANGELOG lead bullet needs its PR number when the PR exists.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

**P6-DC-1001: The BACKLOG "Noted" date and the Last updated date are 2026-11-05, not the plan's 2026-11-04.** Chosen: the actual date of the edit. Alternatives: the plan's literal `Noted 2026-11-04` and `_Last updated: 2026-11-04 during mcp-builtin Phase 6`. Why: a record's date says when it was written, and the run happened on 2026-11-05. Severity: Low.

**P6-DC-1002: The CHANGELOG entry has 18 sub-bullets, and seven of them have two sentences where the reader does not act.** Chosen: split each drafted line into bullets of 25 words or fewer per sentence and 40 words or fewer per bullet. Where a line needed two facts, the bullet uses two sentences, which the verify script allows. Alternatives: one sentence per bullet, which gives about 25 bullets, or dropping detail such as the `info --json` change. Why: each drafted parent line keeps its facts, and the entry stays within the plan's rules. The entry rule says to add a second sentence only when the reader must act, so this is a soft departure. Severity: Low.

**P6-DC-1003: Two CHANGELOG readings of the drafted lines.** Sub-bullet 2 says "project servers only in a trusted project" (D-MB-09, D-MB-18, README) for 02-08's "only in projects that Pi trusts". Sub-bullet 17 says a long name "keeps Pi's cut to 55 characters and a hash" and leaves out the case where the cut falls inside the namespace and hooks see Pi's whole name. Alternatives: the literal drafted wording, or a third hook bullet for the namespace case. Why: user-scope servers register in an untrusted project too, and the namespace case is rare and documented in `docs/hooks-compatibility.md`. Severity: Low.

**P6-DC-1004: The Key Decisions rationales for D-MB-14..29 were written from the P2-DC entries' Choice, Alternatives, and Why-dubious fields, because the entries have no rationale field.** D-MB-25's rationale says only that Phase 2 research settled it and names its risk. Alternatives: copy the Why-dubious text alone as the rationale. Why: the row form needs a rationale, and the text adds no fact that the entries do not hold. Severity: Medium (the user reviews these rows, and a paraphrase can shift meaning).

**P6-DC-1005: The D-P3-06..08 row cites P3-DC-06 as well as the plan's P3-DC-05 and P3-DC-07.** Alternatives: cite only the plan's two IDs. Why: 03-CONTEXT's D-P3-07 text cites P3-DC-06. Severity: Low.

**P6-DC-1006: The D-P5 rows cite no DUBIOUS-CHOICES ID and are labeled "settled autonomously, pending user review".** Alternatives: look up and cite the P5-DC entries for each decision. Why: 05-04 item 4's drafts carry no DC IDs, and the plan says to use those drafts. Severity: Low.

**P6-DC-1007: The five Validated entries go at the top of the Validated list.** Alternatives: append them at the end, or put them after the component-features entries. Why: the list has no strict order, and the newest entries first matches the Last updated list. Severity: Low.

**P6-DC-1008: The `windows status` outputs in this SUMMARY are summarized (counters, open IDs, entry 112), not pasted in full.** Alternatives: paste both full JSON outputs, about 104 KB each. Why: the plan's sizing note limits the token budget. The summarized fields are the ones the acceptance criteria check. Severity: Low.

**P6-DC-1009: Of the five execution-context reference files, only `templates/summary.md` was read in full.** `execute-plan.md`, `checkpoints.md`, `worktree-path-safety.md`, and `executor-examples.md` were not read, because the plan's sizing note asks for targeted reads. The executor's own system contract covers the commit, path-safety, and checkpoint rules, and the plan has no checkpoints. Alternatives: read all five in full, about 2,400 lines. Severity: Low.

**P6-DC-1010: Two BACKLOG statements were inferred, not tested.** MCPV2-02 says that Pi "exposes a denied tool like any other" under built-in MCP. STRICTINSTALL-01 says that no Phase 6 plan owns the strict-install edit. A grep of the Phase 6 plans supports the second statement. Alternatives: leave both statements out. Why: each entry has to say what is missing. Severity: Low.

## Self-Check: PASSED

- FOUND: CHANGELOG.md, .planning/BACKLOG.md, .planning/WINDOWS.md, .planning/PROJECT.md
- FOUND commits: 3fd8819, 511bb30, a65e979 (all ancestors of HEAD)

---
*Phase: 06-release-docs-and-combined-tree*
*Completed: 2026-11-05*
