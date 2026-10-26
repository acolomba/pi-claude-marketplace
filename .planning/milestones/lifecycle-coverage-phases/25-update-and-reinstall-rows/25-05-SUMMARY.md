---
phase: 25-update-and-reinstall-rows
plan: 05
subsystem: reinstall-rows
tags: [reinstall, version-arrow, commit, failed-row, UPR-02, UPR-03]

requires:
  - phase: 25-update-and-reinstall-rows
    provides: plan 04's revisionVersionSlot, RevisionMove, the move layout for reinstalled and failed rows, and ThreePhaseArgsBase.onCandidate
provides:
  - ReinstallReinstalledOutcome.fromVersion (required) and optional fromCommit / toCommit
  - optional fromVersion / toVersion / fromCommit / toCommit on ReinstallFailedOutcome
  - RecordFailedOutcomeInput.move, the move the runner reported before a thrown failure
  - reinstall-flow's per-call candidate holder wired to the runner's onCandidate
  - reinstalled and failed reinstall rows built through revisionVersionSlot
  - the reinstall-newer-version and reinstall-same-version-new-commit catalog states
affects: [25-06 reinstall's not-installed failure, 25-07 preflight failures carry the installed version]

actuals:
  tokens: 16700
  tasks: 3
  commits: 3
plan_head_before: b16cd1b697219eab5e078643b547c1cc2c0b10f9
plan_head_after: 19a6ac018ae350a2a08bbafc891a2c1db18bec9a

tech-stack:
  added: []
  patterns:
    - "A per-call ReportedCandidate holder in reinstallPluginWith receives the runner's onCandidate report; the catch hands it to failReinstall"
    - "reinstall-record.ts copies only the known sides of a move (knownMove / knownCommits), so an unknown side's key stays absent"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - features/plugin/reinstall.feature
    - features/plugin/git-source-update.feature
    - features/plugin/state-lock.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/plugin-reinstall.ts

key-decisions:
  - "fromVersion is required on the reinstalled outcome (a forgotten producer must not compile); the commits stay optional because a path source has none"
  - "The reinstall holder is a one-field interface local to reinstall-flow.ts, not an import of update-flow's CandidateReport (BLOCK C forbids one plugin ledger importing another)"
  - "The two new catalog states use single cardinality (one named target, no tally)"

requirements-completed: [UPR-02, UPR-03]

duration: 60min
completed: 2026-10-23
status: complete
---

# Phase 25 Plan 05: Reinstall rows show the move Summary

**A reinstall that installs a newer version now renders `● demo v1.0.0 → v1.1.0 (reinstalled)` with JSON `from` beside `version`. A reinstall after `fetch` moved a git plugin to a new commit at the same version names both short commits. A failure after the candidate names the move it attempted. A repair at the recorded revision and a failure before any candidate render the same bytes as before.**

## Accomplishments

- `orchestrators/types.ts`: `ReinstallReinstalledOutcome` has a required `fromVersion` and optional `fromCommit` / `toCommit`. `ReinstallFailedOutcome` has optional `fromVersion`, `toVersion`, `fromCommit`, `toCommit`.
- `reinstall-record.ts::reinstallOutcomeFromRun`: the `updated` arm sets `fromVersion: run.fromVersion` and the run's commits. The `failed` arm copies whatever versions and commits the run carries, so a phase-3 commit or finalize failure names its move. `RecordFailedOutcomeInput` takes an optional `move`, and `failedOutcome` spreads its known sides. Two file-private helpers, `knownMove` and `knownCommits`, keep an unknown side's key absent (NREG-01).
- `reinstall-flow.ts`: `reinstallPluginWith` creates a fresh `ReportedCandidate` per call and passes it to `runReinstall`. `runReinstall` sets the runner's `onCandidate` to store the move. The catch passes the stored move to `failReinstall`, which passes it to `recordReinstallOutcome`.
- `reinstall.messaging.ts`: `reinstalledRowFromOutcome` builds its version fields with `revisionVersionSlot({ ...outcome, toVersion: outcome.version })`. The empty-version suppression (IN-02) now comes from the slot's own rule. The failed arm of `outcomeToPluginMessage` spreads `revisionVersionSlot(outcome)`. The manual-recovery arm is unchanged.
- Scenarios: two reinstall scenarios in `reinstall.feature` and the fetched-revision reinstall in `git-source-update.feature` state `from 1.0.0`. A new scenario, "Reinstalling a git-source plugin that a fetch moved to a new commit at the same version names both commits", states `from commit {ghp commit 1}` and `to commit {ghp commit 2}`, no git request, and revision 2 on disk. The two reinstall lock-held scenarios in `state-lock.feature` state `version 1.0.0`; their cause chains did not change. Every REI-01 and REI-02 scenario passes with its table unedited.
- Catalog: `reinstall-rollback-partial` renders `⊘ hello v1.0.0 (failed) {rollback partial}`, and its prose says a failure after the candidate names the version it attempted. New states `reinstall-newer-version` and `reinstall-same-version-new-commit` follow `reinstall-partial-component`. The section introduction says a reinstall row shows the version and commit it moved and a repair shows the single version.

## Task Commits

1. Task 1: a reinstall at a newer version shows the move, end to end. Commit `668483a6`.
2. Task 2: reinstall names a same-version commit move and the move a failure attempted. Commit `99989587`.
3. Task 3: the catalog documents reinstall's moves. Commit `19a6ac01`.

## Catalog state count

303 after this plan (301 before). `EXPECTED_UTF8_BYTES` moved 48_805 -> 49_019 (+214: the two new blocks are 91 and 116 bytes, and the rollback row gained `v1.0.0 `, 7 bytes). The wire test's `PRESENTED.length` moved 311 -> 313 and its emitted-key count 301 -> 303.

## reinstall-flow.test.ts expectations that changed

| Case | Change | Why |
| --- | --- | --- |
| AGENT-01 same-version reinstall (coexistence false and true) | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| REI-04: a reinstall after the marketplace offers a newer version | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| LAYER-04: the unnamed flagless backfill reinstall | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| GIT-01 / D-18-04 / D-18-11 unpinned reinstall on the mirror | outcome gains `fromVersion sha-b2c3d4e5f607` and both commits | reinstalled outcome |
| REI-04 / D-18-04 unpinned reinstall of the declared ref | outcome gains `fromVersion sha-b2c3d4e5f607` and both commits | reinstalled outcome |
| NREG-01 hygiene-only reinstall | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| retry proof: skills prepare, commands prepare, refused finalize (second runs) | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| PRL-08 / PRL-11 / REI-04 exact row | row `● hello v1.0.0 → v9.9.9 (reinstalled)` | the revision moved |
| AFILE-04 orchestrated reinstall | outcome gains `fromVersion 1.0.0` | reinstalled outcome |
| AGENT-01 / NFR-3 refused target, AGENT-01 owned target, AGENT-01 post-migration save | failed outcome gains `fromVersion` / `toVersion 1.0.0` | thrown after the candidate |
| retry proof: skills prepare failure (first run) | key list gains `fromVersion`, `toVersion` | thrown after the candidate |
| retry proof: refused finalize (first run) | failed outcome gains `fromVersion` / `toVersion 1.0.0` | phase-3 failure |
| retry proof: bulk cascade | `⊘ beta v1.0.0 (failed) {unreadable}` | beta's intent mark is after its candidate |
| AFILE-04 refused at the intent mark | `⊘ hello v1.0.0 (failed) {unreadable}` | the intent mark is after the candidate |
| AFILE-04 finalize fails after the MCP commit (`FINALIZE_FAILED_ROW`) | `⊘ hello v1.0.0 (failed) {rollback partial}` | phase-3 failure |

New cases: a held lock at the intent mark (same revision, `⊘ hello v1.0.0 (failed) {lock held}` with its cause, state unchanged), a finalize failure after moving 1.0.0 -> 1.1.0 (`⊘ hello v1.0.0 → v1.1.0 (failed) {rollback partial}` with its cause and `[mcp]` child), and a bulk reinstall where alpha moves 1.0.0 -> 2.0.0 and beta's first state read then fails before its candidate (`⊘ beta (failed) {unreadable}`, so a shared holder would have shown alpha's move). The layer-refusal and unreadable-walk cases needed no change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The finalize failure child is `[mcp]`**
- Found during: Task 2 (the new phase-3 case)
- Issue: the case first expected the skill-only plugin's finalize failure under the `[workflows]` child. The swap reports a finalize failure against `mcp` for every plugin, as the existing `FINALIZE_FAILED_ROW` already pins.
- Fix: the case expects `[mcp] (rollback failed)`.
- Commit: `99989587`

**2. [Rule 3 - Blocking] The text cause chain is one line**
- Found during: Task 2 (the held-lock case)
- Issue: the plan's "two-line cause chain" is the cucumber `cause chain` cell. The text row renders the chain on one `cause:` line joined by `->`.
- Fix: the case expects `cause: <lock message> -> Lock file is already being held`.
- Commit: `99989587`

**3. [Rule 2 - Coverage] Extra test cases**
- `reinstall-record.test.ts` gained a phase-3 failure case with commits and a thrown-failure case with a reported move. `reinstall.messaging.test.ts` gained a render-bytes case for the moved row and a four-row table for the failed arm (arrow, commit arrow, same revision, one side only).

No file owned by Phase 26 was staged, and `update-preflight.ts` was not edited.

## Verification

- `npm run test:coverage:direct` on `types.ts`, `reinstall-record.ts`, `reinstall.messaging.ts`, `reinstall-flow.ts`, `operations.ts`, `edge/handlers/plugin/reinstall.ts`: exit 0.
- `npm run test:integration`: exit 0.
- Cucumber: `reinstall.feature`, `git-source-update.feature`, `state-lock.feature`, `reconcile.feature`, 50 of 50 scenarios passed.
- `npx fallow dupes`, `npx fallow health`: exit 0.
- `npm run test:architecture`: exit 0.
- `npm run check` at `19a6ac01`: exit 0 (751 of 751 scenarios).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-25-09 holds: the row's versions come from the run outcome that wrote the record, or from the runner's own candidate report, and whole-outcome tests pin both. T-25-10 is mitigated: `reinstallPluginWith` creates one holder per call, and the bulk case proves a later target's failure does not name an earlier target's move.

## Self-Check: PASSED

- Commits `668483a6`, `99989587`, and `19a6ac01` are ancestors of HEAD.
- `fromVersion` appears in `reinstall-record.ts`; `reinstall.messaging.ts` imports `revisionVersionSlot` and calls it twice; `onCandidate` appears in `reinstall-flow.ts`.
- `names both commits` appears once in `features/plugin/git-source-update.feature`.
- `catalog-state: reinstall-newer-version` and `catalog-state: reinstall-same-version-new-commit` each appear once in `docs/output-catalog.md`.
