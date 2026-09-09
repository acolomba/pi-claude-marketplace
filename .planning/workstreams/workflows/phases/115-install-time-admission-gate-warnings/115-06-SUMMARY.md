---
phase: 115-install-time-admission-gate-warnings
plan: 06
subsystem: planning-artifacts
tags: [backlog, planning-hygiene, markdown, pruned-footer]

# Dependency graph
requires:
  - phase: 109-114 (workflows-replay)
    provides: the shipped `workflows` bridge whose existence makes the backlog entry false
provides:
  - a pruned-footer record in `.planning/BACKLOG.md` where the `WFLW-01` entry stood
  - a cross-reference audit of every surviving `WFLW-01` mention under `.planning/`
affects: [milestone close-out, backlog triage, audit-open scans]

actuals:
  tokens: 856
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Second instance of the BACKLOG pruned-footer convention, read off the file rather than off the requirement's wording"

key-files:
  created: []
  modified: [.planning/BACKLOG.md]

key-decisions:
  - "The footer's opening sentence names BOTH milestones — `workflows-detection` for the mechanical half (PR #154, 2026-08-29) and `workflows-replay` for the bridge (D-115-08) — because the entry had two halves that closed under two milestones, and only naming both keeps every sentence true (T-115-27)."
  - "The bullet's cited requirement IDs are the eight archived families from `milestones/workflows-REQUIREMENTS.md` (WFLW/WBRG/WNAM/WPTH/WLIF/WDEP/WVAL/WDOC), not the `workflows-detection` milestone's own IDs — the acceptance criterion requires every cited ID to appear in that archive file, and the detection milestone's IDs live in a different workstream directory. The mechanical half is therefore named by milestone and PR number instead of by ID."
  - "The entry's SUBJECT (not its heading including the ID) goes in the bullet's quoted position, so `WFLW-01` appears on exactly one line of the file — which is what the plan's `grep -c 'WFLW-01' = 1` criterion measures (grep counts matching LINES)."
  - "Paths inside the bullet's parenthetical are bare, matching the existing instance's parenthetical style; backticks are kept in the quoted subject, matching that instance's second bullet."

patterns-established:
  - "Pruned-footer placement: in the body of the file where the entry stood, between the preceding entry and the following `##` heading — never appended to the end."

requirements-completed: [WDOCS-01]

coverage:
  - id: D1
    description: "`.planning/BACKLOG.md` carries no open `WFLW-01` entry, and exactly one pruned-footer block naming it, in the file's existing convention"
    requirement: WDOCS-01
    verification:
      - kind: other
        ref: "bash -c 'test \"$(grep -c \"^## WFLW-01\" .planning/BACKLOG.md)\" = \"0\" && test \"$(grep -c \"WFLW-01\" .planning/BACKLOG.md)\" = \"1\"'"
        status: pass
      - kind: other
        ref: "bash -c 'test \"$(grep -c \"^<!--\" .planning/BACKLOG.md)\" = \"2\" && test \"$(grep -c \"^-->\" .planning/BACKLOG.md)\" = \"2\"'"
        status: pass
      - kind: other
        ref: "grep -c 'workflows-replay' .planning/BACKLOG.md"
        status: pass
      - kind: other
        ref: "SKIP=trufflehog pre-commit run --files .planning/BACKLOG.md"
        status: pass
    human_judgment: true
    rationale: "115-VALIDATION.md classifies WDOCS-01 as reviewer-read: the greps prove the entry is gone and a balanced comment block naming `workflows-replay` is present, but that the new block FOLLOWS the file's one existing instance in shape and placement is a convention judgment. The reviewer diffs `.planning/BACKLOG.md:891-900` against `:2508-2516` (the pre-existing footer, at its post-prune line numbers)."
  - id: D2
    description: "Every surviving `WFLW-01` mention under `.planning/` is enumerated and classified, and none depends on the entry existing as an open `##` heading"
    requirement: WDOCS-01
    verification:
      - kind: other
        ref: "bash -c 'set -o pipefail; grep -rn \"WFLW-01\" .planning/ --include=*.md | tee /dev/stderr | wc -l' (104, exit 0)"
        status: pass
    human_judgment: true
    rationale: "The command proves mentions still exist and the count; whether each one still RESOLVES after the prune is a read of what the surrounding sentence claims, which no grep decides. The table below is the audit; a reviewer confirms the dispositions."

duration: 7 min
completed: 2026-09-09
status: complete
---

# Phase 115 Plan 06: Prune the stale `WFLW-01` backlog entry Summary

**`.planning/BACKLOG.md`'s `WFLW-01` entry is replaced in place by a second instance of the file's pruned-footer convention, attributing the mechanical half to `workflows-detection` (PR #154) and the bridge to `workflows-replay`, and all 104 surviving `WFLW-01` mentions under `.planning/` are enumerated and classified with no orphaned cross-reference.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-09T04:25:00Z
- **Completed:** 2026-09-09T04:32:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- The 46-line `## WFLW-01` entry (`.planning/BACKLOG.md:891-936`) is gone, replaced by a
  10-line pruned-footer HTML comment block at `:891-900` — the same position in the body
  of the file that the entry occupied, between the `MRO-01` entry that precedes it and the
  `## PSRC-01` heading that follows.
- The footer's opening sentence names both closing milestones truthfully in one sentence
  (`workflows-detection`, PR #154, 2026-08-29 for the mechanical fix; `workflows-replay`
  for the bridge that re-landed on this branch), which is the T-115-27 repudiation
  mitigation and D-115-08's resolution of the three-way milestone-name disagreement.
- The bullet cites `WFLW-01..04, WBRG-01..04, WNAM-01..06, WPTH-01..05, WLIF-01..06,
  WDEP-01..04, WVAL-01..03 and WDOC-01..03` — all 35 read out of
  `milestones/workflows-REQUIREMENTS.md`, and every one of them verified present in that
  file by a per-ID grep loop (0 missing), with `WGATE-01` as the negative control
  returning 0 to prove the loop can fail.
- The audit found no orphaned cross-reference: no surviving mention depends on `WFLW-01`
  existing as an open `##` heading.

## Task Commits

1. **Task 1: Replace the WFLW-01 entry with a pruned footer in the file's own convention** — `f89c6dc8` (docs)
2. **Task 2: Audit every surviving WFLW-01 cross-reference** — read-and-report only; no file change, so no separate commit (the task's own `<action>` says "This task reads and reports", and its `git status` guard requires that nothing outside `.planning/BACKLOG.md` moved)

**Plan metadata:** this SUMMARY (`docs(115-06)`)

## Files Created/Modified

- `.planning/BACKLOG.md` — the `WFLW-01` entry replaced by a pruned-footer block at
  `:891-900`. Net −46/+10 lines; 3426 diff characters (856 estimateTokens).

## Measured verification results

Every count below was DERIVED by running the grep against the file on disk after the
edit, not transcribed from the plan.

| Command | Measured | Required | Result |
|---|---|---|---|
| `grep -c '^## WFLW-01' .planning/BACKLOG.md` | `0` (was `1`) | `0` | PASS |
| `grep -c 'WFLW-01' .planning/BACKLOG.md` | `1` (line 896 only) | `1` | PASS |
| `grep -c '^<!--' .planning/BACKLOG.md` | `2` (was `1`) | `2` | PASS |
| `grep -c '^-->' .planning/BACKLOG.md` | `2` (was `1`) | `2` | PASS |
| `grep -c 'workflows-replay' .planning/BACKLOG.md` | `2` (was `1`) | non-zero | PASS |
| Task 1 verify 1 (`test … && test …`) | exit `0` | exit `0` | PASS |
| Task 1 verify 2 (comment markers) | exit `0` | exit `0` | PASS |
| Task 2 verify 1 (`set -o pipefail; grep -rn … \| tee \| wc -l`) | `104`, exit `0` | exit `0` | PASS |
| Task 2 verify 2 (`git status --short` over `.planning/` minus two pathspecs) | exit `1` | exit `0` | KNOWN RED — see below |
| Every cited requirement ID present in `milestones/workflows-REQUIREMENTS.md` | 35/35, 0 missing | all present | PASS |
| `pre-commit run --files .planning/BACKLOG.md` | exit `1`, TruffleHog `Failed` | exit `0` | STRUCTURAL — see below |
| `SKIP=trufflehog pre-commit run --files .planning/BACKLOG.md` | exit `0`, 11 hooks `Passed` | exit `0` | PASS |
| `trufflehog filesystem .planning/BACKLOG.md --results=verified,unknown --fail` | exit `0`, `verified_secrets: 0`, `unverified_secrets: 0` | clean | PASS |

**Two negative controls, because a guard that cannot fail proves nothing:**

- `test "$(grep -c '^## PSRC-01' .planning/BACKLOG.md)" = "0"` → exit `1`. The verify's
  `test "$(grep -c …)" = "0"` shape does fail on a heading that IS present, so Task 1
  verify 1's exit `0` is a real reading of `^## WFLW-01` being absent.
- `set -o pipefail; grep -rn "ZZZZ-99" .planning/ --include=*.md | tee /dev/stderr | wc -l`
  → printed `0`, exit `1`. Confirms `pipefail` is load-bearing exactly as the plan's
  `<fails_when>` claims: without it this pipeline would have reported `wc`'s exit `0` and
  a total prune (every mention deleted, record included) would have read as a pass.

### Task 2 verify 2: the known red, reported not fixed

The command exits `1`. Re-running the same pathspec by hand names exactly two paths:

```
?? .planning/workstreams/workflows/.verification-ledger.json
?? .planning/workstreams/workflows/config.json
```

Both are operator-owned, both are untracked (`??`, not ` M`), and no third path matched.
The plan's `<fails_when>` names this as the KNOWN state rather than a violation. They were
not staged, not deleted, and the pathspec exclusions were not widened to hide them.

### `pre-commit run --files .planning/BACKLOG.md`: the structural TruffleHog failure

Run literally, the gate exits `1` on:

```
TruffleHog...............................................................Failed
error preparing repo: failed to read index file:
open /home/acolomba/pi-claude-marketplace-workflows/.git/index: not a directory
```

This checkout is a linked worktree, so `.git` is a text file and the hook's git-mode scan
has no index to read. `CLAUDE.md` documents this as structural, not transient, and
prescribes the filesystem-mode scan as the substitute — which ran clean (exit `0`,
`verified_secrets: 0`, `unverified_secrets: 0`) before the commit, and the commit carried
`SKIP=trufflehog` and nothing else. Every other applicable hook passed: trailing
whitespace, end-of-file fixer, BOM, case conflicts, merge conflicts, destroyed symlinks,
shebang-executable, private key, VCS permalinks, irregular spaces, BiDi controls.
`mdformat` and `markdownlint-cli2` reported `(no files to check)` — both `exclude`
`^…\.planning/`, so `.planning/*.md` is outside the markdown formatters entirely and no
reflow of the new block was possible. `prettier` was likewise skipped (it matches
`\.(js|json|ts)$` only), so the "never prettier on markdown here" rule held mechanically
rather than by discipline. `git status` after the commit shows no hook rewrite.

## Task 2 audit: every surviving `WFLW-01` mention under `.planning/`

104 mentions across 27 `.md` files. Grouped by file; the Lines column enumerates every
matching line, so each of the 104 is accounted for.

**Dispositions:** **A** = the record (the new footer). **B** = `WFLW-01` used as a
REQUIREMENT ID from the archived `workflows` milestone, never as a pointer at a backlog
entry — resolves against `milestones/workflows-REQUIREMENTS.md:25`, which is untouched.
**C** = describes the prune itself; a reference to a pruned entry inside the requirement
that prunes it is self-consistent. **D** = dated historical artifact, recording what the
entry said when it was written; not reconciled by design.

| File | Lines | Count | Disposition |
|---|---|---|---|
| `.planning/BACKLOG.md` | 896 | 1 | **A** — the new footer, the record |
| `.planning/workstreams/workflows/REQUIREMENTS.md` | 70 | 1 | **C** — WDOCS-01's own text |
| `.planning/workstreams/workflows/ROADMAP.md` | 123, 128, 593, 602 | 4 | **C** — all four describe the prune (phase line, criterion 5, plan line, dependency prose) |
| `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-CONTEXT.md` | 18, 137, 206, 265 | 4 | **C** — this phase's own scope and D-115-08 |
| `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-RESEARCH.md` | 116, 152, 948, 949, 951, 952, 969, 1265, 1384 | 9 | **C** — the research that specified the prune; `:951-952` snapshot the pre-prune line range (see observation below) |
| `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-VALIDATION.md` | 63, 138 | 2 | **C** — WDOCS-01's reviewer-read rows |
| `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-06-PLAN.md` | 20, 22, 24, 34, 37, 60, 68, 73, 76, 82, 88, 112, 113, 116, 120, 129, 133, 136, 138, 139, 142, 148, 150, 163, 164, 168, 189, 214 | 28 | **C** — this plan |
| `.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/.continue-here.md` | 107 | 1 | **C** — the operator's `workflows-replay` choice |
| `.planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md` | 25, 183 | 2 | **B** — the requirement itself and its traceability row |
| `.planning/workstreams/workflows/milestones/workflows-ROADMAP.md` | 69, 81, 205 | 3 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-MILESTONE-AUDIT.md` | 52 | 1 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-RESEARCH.md` | 100, 113, 308, 830, 944, 945, 1012 | 7 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-CONTEXT.md` | 106 | 1 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-PATTERNS.md` | 87, 473, 678 | 3 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-VALIDATION.md` | 44, 63, 64, 124 | 4 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-VERIFICATION.md` | 26, 122, 127 | 3 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-REVIEW.md` | 267 | 1 | **B** — a source-comment tag |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-01-PLAN.md` | 25, 35, 143, 149, 169, 229, 294, 337, 372 | 9 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-02-PLAN.md` | 11 | 1 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-01-SUMMARY.md` | 52, 57, 60, 146, 173 | 5 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-02-SUMMARY.md` | 165 | 1 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/101-*/101-04-SUMMARY.md` | 39, 44, 138, 160 | 4 | **B** |
| `.planning/workstreams/workflows/milestones/workflows-phases/103-*/103-PATTERNS.md` | 676 | 1 | **B** — a source-comment tag |
| `.planning/workstreams/workflows/phases/109-kind-inversion/109-RESEARCH.md` | 716, 718 | 2 | **B** — retag-or-keep notes on two source comments citing the ID |
| `.planning/workstreams/workflows/milestones/workflows-phases/102-*/102-RESEARCH.md` | 765 | 1 | **D** — records the mechanical-fix option that was not taken |
| `.planning/spikes/021-workflow-demand-signal/README.md` | 21, 114, 140 | 3 | **D** — dated spike; records what the entry said in 2026-08 |
| `.planning/spikes/024-workflows-bridge-shape/README.md` | 155, 170 | 2 | **D** — dated spike; `:170` is past tense ("was rewritten around that") |

**Total: 104.** No row instructs a reader to go read an open `WFLW-01` entry, so there is
no defect to report and nothing outside `.planning/BACKLOG.md` was edited.

Two checks behind that conclusion rather than assumed:

- `.planning/BACKLOG.md:2462` (`:2498` before the prune) was read as the plan required. It
  says "matches the workflow milestone's own never-turn-a-reading-into-a-refusal anchor" —
  prose about this phase's posture inside the `NAMEFOLD-01` entry. It does not contain the
  string `WFLW-01` at all, so the prune cannot have orphaned it. Confirmed, not assumed.
- A pointer-phrasing sweep (`see the backlog`, `read WFLW-01`, `BACKLOG.md … WFLW-01`,
  `WFLW-01 … entry`) over all 104 matches returned 19 candidates, each read individually.
  All 19 are class **C** or **D**: they describe the prune, or record the entry's past
  wording. None is an instruction to open a live entry.

### One observation, reported not fixed

`115-RESEARCH.md:951` states "**The current `WFLW-01` entry** occupies
`.planning/BACKLOG.md:891-936`". That line range no longer holds — it is the pre-prune
snapshot the research took in order to specify the prune, and `115-06-PLAN.md:73` cites
the same range in its `read_first`. Both are dated artifacts describing the pre-prune
state, not cross-references telling a reader to go read an open entry, so neither is a
defect and neither was edited: `.planning/BACKLOG.md` is this requirement's whole file
scope. Recorded here because a future reader following that range will land on the footer
rather than the entry, which is the intended outcome.

## Decisions Made

- **The footer names both milestones.** D-115-08 says cite `workflows-replay`; the entry's
  own text says it closes with `workflows-replay`; `MILESTONES.md:21` records
  `workflows-detection` as the shipped milestone; the ROADMAP says "the `workflows`
  milestone", which is a family label with no milestone of that literal name. Naming
  `workflows-detection` for the mechanical half and `workflows-replay` for the bridge is
  the only phrasing under which every sentence of the footer is true, and it satisfies
  D-115-08 (which is about which milestone re-landed the bridge, and gets the right
  answer) rather than contradicting it.
- **The cited IDs come from the archive file the acceptance criterion names.** The
  criterion is that every cited ID appears in
  `milestones/workflows-REQUIREMENTS.md`. `workflows-detection`'s own requirement IDs live
  under `.planning/workstreams/workflows-detection/`, so citing them would have broken it;
  the mechanical half is therefore attributed by milestone name and PR number. Both halves
  are still attributed, no ID is invented, and every cited ID was grep-verified.
- **The quoted subject omits the ID.** `grep -c` counts matching LINES, so putting
  `WFLW-01:` in the quoted subject as well as `WFLW-01..04` in the closed-by clause would
  have measured `2` and failed the plan's `= "1"` criterion. The existing instance quotes
  each entry's subject rather than its full heading, so dropping the ID prefix follows the
  convention as well as the count.

## Deviations from Plan

None — plan executed exactly as written. Both tasks ran as `type="auto"`, no deviation
rule fired, no fix attempt was needed, and no file outside `.planning/BACKLOG.md` changed.

## Issues Encountered

- **`pre-commit run --files .planning/BACKLOG.md` cannot pass in this checkout.** The
  TruffleHog hook runs a git-mode scan and this is a linked worktree, so it aborts on a
  missing `.git/index`. Resolved per `CLAUDE.md`: a filesystem-mode scan over the file
  being committed (clean, `--results=verified,unknown --fail`, exit `0`), then
  `SKIP=trufflehog` for both the gate re-run and the commit, with no other hook skipped.
  The plan's `<fails_when>` for that verify is unsatisfiable in a worktree and is recorded
  as an environment condition rather than a finding — this is a documented, recurring
  property of this checkout, not a new discovery.
- **Task 2's `git status` guard is red by the plan's own prediction.** Two operator-owned
  untracked files under `.planning/` match the pathspec. Reported above and left alone.
- **Task 2 produced no commit.** It is a read-and-report task whose own guard asserts that
  nothing moved, so a commit would have contradicted it. Its output is this SUMMARY's
  audit table.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- WDOCS-01 is closed on the artifact side: the backlog no longer advertises the shipped
  `workflows` bridge as open work, and `audit-open`-style scans will no longer see a
  `## WFLW-01` heading.
- One reviewer-read item remains for phase verification, exactly as
  `115-VALIDATION.md:138` scopes it: diff the new block at `.planning/BACKLOG.md:891-900`
  against the pre-existing instance at `:2508-2516` and confirm the shape matches.
- `.planning/BACKLOG.md` is now free for the phase's other editor — `WGATE-01` is the
  entry the rest of phase 115 touches in this same file, and this plan changed nothing
  else in it.

## Self-Check: PASSED

Run after the SUMMARY commit (`4be654c5`), against the committed tree:

- `[ -f .planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/115-06-SUMMARY.md ]` — FOUND.
- `git log --oneline --all | grep f89c6dc8` — FOUND. Same for `4be654c5`.
- Task 1 verify 1 and verify 2 re-run against the committed `.planning/BACKLOG.md` — both exit `0`.
- Plan-level `test -z "$(git diff HEAD --name-only -- package.json package-lock.json extensions tests)"` — exit `0`. No source, no manifest (T-115-30).
- `git diff --name-only f89c6dc8~1 HEAD` — exactly two paths, `.planning/BACKLOG.md` and this SUMMARY. Nothing else moved (T-115-28).
- The reviewer-diff line numbers this SUMMARY cites were MEASURED, not assumed: `grep -n '^<!--\|^-->' .planning/BACKLOG.md` prints `891`, `900`, `2508`, `2516` — the new block and the pre-existing instance at its post-prune position.

---
*Phase: 115-install-time-admission-gate-warnings*
*Completed: 2026-09-09*
