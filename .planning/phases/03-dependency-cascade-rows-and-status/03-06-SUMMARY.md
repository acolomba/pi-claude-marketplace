---
phase: 03-dependency-cascade-rows-and-status
plan: 06
subsystem: dependency-cascade
tags: [docs, decisions, list, dependency-status, phase-gate]

requires:
  - phase: 03-dependency-cascade-rows-and-status
    provides: "plans 03-01..03-05: the 64-character version cut, the invalid-id refusal, the {dependency failed} member rows, the directory pin requirers and 120-character cuts, the version-in-range hint; catalog at 324 states / 54_615 bytes"
provides:
  - "list-flow.ts PL-5 contract comment citing D-PL3-07"
  - "docs/dependency-resolution.md: the D-PL3-06 record and the phase's user-visible behavior"
  - "phase gate evidence: npm run check exit 0 on the combined tree"
affects: [phase verification, PROJECT.md key decisions (parent session), BACKLOG.md dispositions (parent session)]

actuals:
  tokens: 6400
  tasks: 2
  commits: 1
plan_head_before: b4505392c1ebe60c4b16f287c25b6c4a8fd8f946
plan_head_after: 8ea10ae7a6744d68378258546965cac260441321

tech-stack:
  added: []
  patterns:
    - "A divergence from Claude Code with no code change is recorded by its decision ID where a reader meets the behavior: the code comment and the user documentation"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - docs/dependency-resolution.md

key-decisions:
  - "D-PL3-06: a dependency's partial availability does not change its dependents' status on list, info, or install rows, as in Claude Code; recorded in docs/dependency-resolution.md, no code change"
  - "D-PL3-07: git-source list rows keep upgradable / partially-upgradable; recorded as a divergence licensed by PL-5 and RSTA/FTCH in list-flow.ts's PL-5 comment and the dependency documentation"

requirements-completed: [CAS-03, CAS-04]

coverage:
  - id: D1
    description: "The decision not to propagate partial availability is recorded by ID in the user documentation, with no code change"
    requirement: CAS-03
    verification:
      - kind: other
        ref: "grep -c D-PL3-06 docs/dependency-resolution.md (1)"
        status: pass
    human_judgment: true
  - id: D2
    description: "The git-source list upgrade state is recorded as a divergence by ID in list-flow.ts and the docs no longer claim Claude Code's list shows upgrade state"
    requirement: CAS-04
    verification:
      - kind: other
        ref: "grep -c D-PL3-07 extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts (1)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/list-flow.test.ts (100 pass, 0 fail)"
        status: pass
    human_judgment: true
  - id: D3
    description: "The combined phase tree passes the full gate"
    requirement: CAS-03
    verification:
      - kind: other
        ref: "npm run check (exit 0 at 8ea10ae7)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-27
status: complete
---

# Phase 3 Plan 06: Dependency Status and List Decisions, Phase Gate Summary

**D-PL3-06 (no propagation of a dependency's partial availability) and D-PL3-07 (git-source `list` rows keep their upgrade state) are recorded by ID, `docs/dependency-resolution.md` now describes everything the phase shipped, and `npm run check` exits 0 on the combined tree.**

## Performance

- **Duration:** about 12 min (most of it the gate)
- **Started:** 2026-10-27T06:03:00Z
- **Completed:** 2026-10-27T06:15:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `list-flow.ts`: the PL-5 bullet of the contract comment now says Claude Code's `list` shows no upgrade state for any source, so the state is a recorded divergence, kept for git sources because `fetch` feeds it (D-PL3-07). Comment lines only; `list-flow.test.ts` 100/100 and direct coverage unchanged.
- `docs/dependency-resolution.md`, edits in place:
  1. "The load-time check": a partly installed dependency leaves its dependents' status alone on `list`, `info`, and install rows, as in Claude Code; only a missing, disabled, or out-of-range dependency changes them (D-PL3-06).
  2. "How a constrained dependency is resolved": the wrong claim "as Claude Code does" for `list` is replaced. The comparison is the one Claude Code's `update` makes; Claude Code's `list` shows no upgrade state; this extension keeps it, git sources included (D-PL3-07, PL-5). The directory pin paragraph now says every plugin of the install with a constraint is named, nearest the named plugin first, outside-install plugins are not (D-PL3-13), and the fields are cut at 120 characters with `…` (D-PL3-09).
  3. "What happens to a dependency you already installed": the version-in-range hint and its condition (D-PL3-11).
  4. "What happens when an update is constrained by other plugins": the 64-character version cut (D-PL3-12).
  5. "Why a dependency can fail" table: `{invalid manifest}` covers the invalid id of the named plugin (D-PL3-04); `{dependency failed}` covers every other dependency the failed install would have installed (D-PL3-01). mdformat re-padded the table.
  6. "What a failure does to the install": every would-be dependency gets a row, already-installed ones none, and the three single-row routes (D-PL3-15).

## Task Commits

1. **Task 1: Record D-PL3-06 and D-PL3-07 and describe the phase's behavior in the dependency documentation** - `8ea10ae7` (docs)
2. **Task 2: Phase gate** - no commit; the gate passed on the first run and needed no fix.

## Gate evidence

- Command: `npm run check > .../scratchpad/check-0306.log 2>&1; echo exit=$?`, unpiped, run from the worktree root.
- Exit status: **0** (read directly from the shell: `exit=0`).
- Commit: `8ea10ae7a6744d68378258546965cac260441321`, clean tree.
- Node: `v26.12.1`.
- Scope: the combined tree of this worktree (branch `features/plugin-lifecycle-p3`), all of plans 03-01..03-06.
- Output: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features passed; unpaired and integration tests passed (optional peers present at `node_modules/.cache/optional-peers`, pi-subagents 0.74.0); cucumber 909 scenarios / 9084 steps passed; direct coverage merged 291 records with no "Incomplete direct coverage".
- Pre-commit range run: `SKIP=npm-check pre-commit run --from-ref 4b623b71d7f21def577c916dd0cc57229ac919ce --to-ref HEAD` (BASE is the parent of plan 03-01's first commit `1667ca33`): exit 0, every hook Passed or Skipped, no file modified.
- Fix commits the gate needed: none.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` - PL-5 comment cites D-PL3-07
- `docs/dependency-resolution.md` - D-PL3-06 record and the phase's behavior descriptions

## Decisions Made

D-PL3-06 and D-PL3-07 were recorded as written in CONTEXT.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- mdformat re-padded the "Why a dependency can fail" table on the first pre-commit pass; the second pass was clean.
- The gate ran as a background shell because it takes longer than the 600-second foreground tool limit; its exit status was echoed by the same shell that ran `npm run check` and read from that output (`exit=0`).

## Touched outside Files

- `docs/dependency-resolution.md`: user documentation of the D-PL3-06 record and the phase's behavior; not on the ROADMAP `Files` line.
- No gate fix touched any file.

## CHANGELOG line

None of its own. The behavior lines live in plans 03-01..03-05.

## Decision rows

| Decision | Basis | Status |
| --- | --- | --- |
| **D-PL3-06 (plugin-lifecycle, uncertain): a dependency installed with some component kinds unsupported does not change its dependents' status on `list`, `info`, or install rows** -- only a missing, disabled, or out-of-range dependency does, which LOAD-01 (`{dependency unsatisfied}`) already reports at load | Claude Code has no partial state; a plugin whose components fail to load stays enabled and its dependents are unaffected (2.1.310, E3) | Recorded in `docs/dependency-resolution.md`; no code change, `info.ts` untouched. For user review: the backlog records an operator statement asking for propagation (alternative: a `{dependency partial}`-style reason) |
| **D-PL3-10 (plugin-lifecycle, reversed 2026-10-27): every refusal other than the directory pin renders ranges as Claude Code does** -- a valid printable range as written, any other text in curly quotes cut to 64 code units, the joined list cut at 200 code units (never inside a quote) with `… (+N chars)` | Claude Code 2.1.310 `q`/`W` (E4) | Shipped by quick task 261027-8h9; supersedes the 03-04 row |
| **D-PL3-07 (plugin-lifecycle, uncertain): git-source `list` rows keep `upgradable` / `partially-upgradable`** -- a recorded divergence licensed by PL-5 (GV-01, VER-01, VER-02) and the fetch work (RSTA-04..06, FTCH-01..06) | Claude Code's `list` shows no upgrade state for any source (2.1.310, E7), so PL-5 already diverges for every source | Recorded in `list-flow.ts`'s PL-5 comment and `docs/dependency-resolution.md`. For user review (alternative: drop the upgrade state for git sources only, or for all sources) |

## Backlog dispositions

- `DEPS-STATUS-01`: closed by decision D-PL3-06 (no propagation, as Claude Code).
- `PARITYGV-01` b1: closed by decision D-PL3-07 (divergence licensed by PL-5 and RSTA/FTCH).

## Uncertain choices (for user review)

1. **D-PL3-06** -- partial availability is not propagated to dependents. Shipped: a documentation record only.
2. **D-PL3-07** -- git-source `list` rows keep the upgrade state. Shipped: the PL-5 comment and the documentation record.
3. **D-PL3-01/02** -- every resolved-but-uninstalled member gets `(failed) {dependency failed}` with no cause line. Shipped in 03-03 (walk and member ledger failures).
4. **D-PL3-11** -- the version-in-range hint appears when the named plugin declares the dependency, for every source kind. Shipped in 03-05.
5. **D-PL3-10** -- resolved: the user reversed it on 2026-10-27. Refusals other than the directory pin now render ranges as Claude Code does (quick task 261027-8h9).
6. **D-PL3-13** -- installed plugins outside the closure are not named on a member's directory pin refusal. Shipped in 03-04.
7. **D-PL3-15** -- the named plugin's own ledger failure, a dependency-move step failure, and a catalog read that throws during the walk keep one failure row. Shipped in 03-03 as known gaps.

## Known gaps

None of this plan's own. The phase's known gaps are in the 03-03, 03-04, and 03-05 summaries.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-53 is mitigated: each divergence carries its decision ID in the code comment or document where a reader meets the behavior, and in the decision rows above. T-03-54 is mitigated: `npm run check` ran unpiped on the combined tree and exited 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 3 is ready for verification. All six plans are complete and the gate is green at `8ea10ae7`.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` and `docs/dependency-resolution.md` exist; commit `8ea10ae7` is an ancestor of HEAD and lists exactly those two files.
- Acceptance greps: `D-PL3-07` in list-flow.ts 1; `D-PL3-06` in docs/dependency-resolution.md 1; `To look for a version in range` in docs/dependency-resolution.md 1.
- The list-flow.ts diff changes comment lines only.
