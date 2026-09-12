---
phase: 01-live-evidence-revalidation
plan: 72
subsystem: evidence-tooling
tags: [scope-seal, negative-control, quality-gate, revalidation]
status: complete
requires:
  - "scripts/revalidation.mjs SEALED_REQUIREMENT_SIGNATURES / SEALED_REQUIREMENT_ROUTES"
  - "scripts/revalidation.mjs validatePhaseAfterAnchor"
provides:
  - "SEALED_PHASE_CONTRACTS: exact Phase 2-9 titles and route actions held outside the mutable ledger"
  - "SEALED_REQUIREMENT_ACTIONS: exact canonical action for all 32 requirement rows"
  - "phase-title-contract and scope-action-contract violation classes"
  - "Standalone witnesses for coordinated title/anchor drift and legal-but-wrong action drift"
affects:
  - "node scripts/revalidation.mjs scope-impact --check"
  - "node scripts/revalidation.negative.mjs"
tech-stack:
  added: []
  patterns:
    - "Seal held outside both mutable inputs, so the checker compares each input with a fixed contract instead of comparing the two with each other"
    - "Row-id-keyed lookup derived from the two sealed tables at module load, so the validator selects no table at run time and an unsealed id resolves to undefined"
    - "Negative controls that match their plant by pattern and assert the match, so a reformat fails the control instead of emptying it"
key-files:
  created: []
  modified:
    - scripts/revalidation.mjs
    - scripts/revalidation.negative.mjs
    - tests/architecture/revalidation.test.ts
    - .planning/phases/01-live-evidence-revalidation/01-VALIDATION.md
decisions:
  - "Build the expected route anchor segment from the sealed title rather than from the parsed roadmap heading, so a coordinated rename of both mutable inputs still disagrees with a fixed authority (D-20, D-23)."
  - "Derive one row-id-keyed SEALED_SCOPE_ACTIONS map from the requirement-action and phase-contract tables at module load, instead of branching on the row prefix at run time, so the miss path has one shape and stays reachable by the existing unsealed-row cases."
  - "Gate the sealed-action comparison on SCOPE_ACTIONS.has(change.action) so a structurally invalid action keeps reporting invalid-scope-action alone."
  - "Repair the standalone runner's stale plants by matching the definition line and traceability row with a pattern and asserting the match, rather than re-hard-coding today's spelling."
metrics:
  duration: ~70m
  completed: 2026-09-12
actuals:
  tokens: 6855
  tasks: 3
  commits: 3
  plan_head_before: cff25be1
---

# Phase 01 Plan 72: Seal phase titles and scope actions outside the ledger Summary

The exact Phase 2-9 headings and the exact canonical action for all 40 scope rows are now fixed
contracts inside `scripts/revalidation.mjs`, and `scope-impact --check` measures both mutable
inputs against them; the two drift shapes that returned exit 0 now exit 1, each proved fail-closed
by planting and then reverting on a disposable copy of the repository root.

## What Was Built

### Sealed phase titles (`e66faa88`)

`SEALED_PHASE_CONTRACTS` holds the exact `### Phase N:` heading text and the canonical route action
for `PHASE-02` through `PHASE-09`. Phase 1 is deliberately unsealed — no scope row references it,
so it carries no scope-impact semantic.

Two mutable inputs are now measured against it:

- `validatePhaseTitle` compares the parsed roadmap heading with the sealed title and emits the new
  `phase-title-contract` violation.
- `validatePhaseAfterAnchor` builds its expected anchor segment from the sealed title instead of
  from `phase.title`. That is the whole fix for probe (a): the anchor was previously checked against
  the same heading it is meant to attest, so renaming both at once left them agreeing with each
  other and nothing reported it.

Every sealed lookup compares rather than reads through, so an absent entry emits nothing.

### Sealed scope actions (`d8ed8995`)

`SEALED_REQUIREMENT_ACTIONS` holds the exact action for each of the 32 requirement rows
(`narrow/split` 23, `keep` 7, `move-to-evidence` 2); the eight route actions already live in
`SEALED_PHASE_CONTRACTS`. `SEALED_SCOPE_ACTIONS` derives one row-id-keyed `Map` over all 40 rows
from those two tables at module load, so `validateScopeActionContracts` performs a single lookup
with no run-time table selection.

The comparison is gated on `SCOPE_ACTIONS.has(change.action)`, so a structurally invalid action
still reports `invalid-scope-action` alone, and an unsealed row id resolves to `undefined` so the
unexpected-row diagnostics stay one line. The check is wired into `validatePlanningContracts` only,
never into the strict `validateLedger` path.

### Controls and the hard-gate record (`bf1146a1`)

Public-CLI controls in `tests/architecture/revalidation.test.ts` (9 new cases) and standalone
controls in `scripts/revalidation.negative.mjs` cover both drift classes, each asserting the whole
`{status, stdout, stderr}` result against a literal expectation. Both new sealed tables are pinned
by membership and by length.

## Plant-then-revert evidence

Both seals were witnessed failing before the implementation landed, and proved fail-closed after it,
on a disposable copy of the repository root under the scratch directory. No file under the real
`.planning/` tree was mutated at any point (`git status --short` over the three planning files was
empty after every run).

### Before the seals landed — the two reproduced false passes

Coordinated Phase 8 title + route anchor drift, public CLI, run before the Task 1 implementation:

```
+   status: 0,
+   stderr: '',
+   stdout: 'Scope impact valid: 40 records.\n'
-   status: 1,
-   stderr: 'phase-title-contract: PHASE-08: roadmap phase title differs from sealed phase contract\n' +
-     'scope-after-anchor: SCOPE-ROUTE-PHASE-08: afterAnchor does not resolve to phase\n',
-   stdout: ''
```

`SCOPE-REQ-PDEF-01` action `narrow/split` -> `keep`, run before the Task 2 implementation:

```
+   status: 0,
+   stderr: '',
+   stdout: 'Scope impact valid: 40 records.\n'
-   status: 1,
-   stderr: 'scope-action-contract: SCOPE-REQ-PDEF-01: canonical action differs from sealed scope contract\n',
-   stdout: ''
```

The route-row direction (`SCOPE-ROUTE-PHASE-08` action -> `keep`) reproduced the same exit-0 success
line before the implementation.

### After the seals landed — four recorded observations

Baseline on the disposable copy: exit 0, `Scope impact valid: 40 records.`

| # | Step | Observed |
|---|------|----------|
| 1 | Plant: Phase 8 heading and both `SCOPE-ROUTE-PHASE-08` anchors renamed together | exit 1 — `phase-title-contract: PHASE-08: roadmap phase title differs from sealed phase contract` + `scope-after-anchor: SCOPE-ROUTE-PHASE-08: afterAnchor does not resolve to phase` |
| 2 | Revert | exit 0 — `Scope impact valid: 40 records.` |
| 3 | Plant: `SCOPE-REQ-PDEF-01` action `narrow/split` -> `keep`, both planning documents untouched | exit 1 — `scope-action-contract: SCOPE-REQ-PDEF-01: canonical action differs from sealed scope contract` |
| 4 | Revert | exit 0 — `Scope impact valid: 40 records.` |

The revert half is what makes the plant half mean something: it shows the seal is what rejected the
drift, not some unrelated breakage in the copied contracts.

## The one changed expectation

Exactly one pre-existing expectation moved, as the plan predicted, and it was not weakened.

`tests/architecture/revalidation.test.ts`, `RVAL-04 scope-impact rejects phase title drift` — this
case renames only the ROADMAP.md Phase 8 heading. Once the seal is the anchor's authority, a
roadmap-only rename no longer disagrees with the anchor; it disagrees with the seal. Its expected
stderr moved from

```
scope-after-anchor: SCOPE-ROUTE-PHASE-08: afterAnchor does not resolve to phase
```

to

```
phase-title-contract: PHASE-08: roadmap phase title differs from sealed phase contract
```

Exit status stays 1, stdout stays empty, and the assertion remains a whole-result
`deepStrictEqual`. A separate new case covers anchor-only drift and still expects the original
`scope-after-anchor` code, target and message byte-unchanged, so the two shapes stay distinguishable.

No second expectation moved. Measured: `git diff cff25be1..HEAD` over the test file contains no
removed assertion line other than the one above, and the `invent` case's expectation
(`invalid-scope-action: SCOPE-REQ-PDEF-01: invent`) is byte-unchanged and passing.

## Folded scope repair: the negative runner had stopped planting

`node scripts/revalidation.negative.mjs` exited 1 before this plan, for a reason unrelated to the
seals. It was repaired here because this plan authors that file anyway.

The runner planted its `EVIL-99` rename with hard-coded literals that had drifted out of
`.planning/REQUIREMENTS.md`: it looked for `- [ ] **AUTH-01**` where the document now reads
`- [x] **AUTH-01**`, and for `| AUTH-01 |` where the table row is column-padded. `String.replace`
returns the original document on a miss, silently, so `EVIL-99` never entered the file and two of
the five expected violations could not fire. Behind that failing assertion, two more plants had been
disarmed the same way and had never been reached: the `PDEF-01` route change
(`| PDEF-01 | Phase 3 | Pending |`, now padded and `Complete`) and the `GGAT-02` former-phase change.

This is a negative control that silently stopped planting its violation — the defect class this work
exists to retire.

The repair matches by pattern and asserts the match:

- `traceabilityRow(markdown, id)` matches `^\|[ \t]*<id>[ \t]*\|[^\n]*\|$` and asserts a hit.
- `requirementDefinitionLine(markdown, id)` matches `^- \[[ x]\] \*\*<id>\*\*` and asserts a hit.

Every mutation is then derived from the matched text rather than from a literal, so a reformat or a
status flip now fails the control loudly instead of emptying it. `.planning/REQUIREMENTS.md` was not
edited — the document is correct; the control was stale.

Exit code before repair: **1**. Exit code after repair: **0** (`Revalidation negative controls
passed.`).

## Gate Evidence

Every command was run unpiped and its own exit status was read. No command's result was taken from
the tail of a pipeline. (This plan's own verify steps use `&&` chains, not pipes; no piped verify
step needed fixing.)

`npm run check` — exit **0**.

- Unit: `tests 6118 / pass 6118 / fail 0 / skipped 0 / todo 0` (33.3 s) — up from 6109 by the 9 new cases
- Integration: `tests 32 / pass 32 / fail 0 / skipped 0 / todo 0` (10.0 s)

`node scripts/revalidation.mjs scope-impact --check` — exit 0:

```
Scope impact valid: 40 records.
```

`node --test tests/architecture/revalidation.test.ts` — `tests 147 / pass 147 / fail 0` (138 -> 147).

`node scripts/revalidation.negative.mjs` — exit 0, `Revalidation negative controls passed.`

`npm run test:coverage:direct -- scripts/revalidation.mjs` — exit 0:

```
Direct coverage passed: scripts/revalidation.mjs (branches 806/806, functions 208/208, lines 2795/2795)
```

Branches 794 -> 806 and functions 204 -> 208, all reached; no new code was stranded.

`grep -rn 'fallow-ignore\|eslint-disable\|thresholdOverrides' scripts/revalidation.mjs scripts/revalidation.negative.mjs .fallowrc.json` returns nothing. `.fallowrc.json` still carries zero
`health.thresholdOverrides`. `npx fallow health --fail-on-issues` reports `0 above threshold`, and
`npx eslint` is clean, so both independently-computed complexity engines accept the two new
validators without suppression.

## Pre-existing Out-of-Scope Red

`node scripts/revalidation.mjs validate` still exits 1 with 945 `unsafe-reference` violations across
13 stale paths in the canonical ledger's finding references. It is outside `npm run check`, outside
both gaps this plan closes, and owned by a separate plan. It was not chased, and
`01-REVALIDATION.json` was not edited.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two further stale plants in the negative runner, behind the one named in the plan**

- **Found during:** Task 3
- **Issue:** The folded repair brief named only the `AUTH-01` plant. Once that assertion passed, the
  runner failed on the next two, whose literals had drifted the same way: `PDEF-01`'s traceability
  row (`| PDEF-01 | Phase 3 | Pending |` against a padded `Complete` row) and `GGAT-02`'s
  former-phase row. Both were unreachable before, because the `AUTH-01` assertion threw first.
- **Fix:** Same repair shape — derive both mutations from `traceabilityRow(...)` plus an
  `assert.ok` on the substring being replaced, so a future flip fails rather than empties.
- **Files modified:** `scripts/revalidation.negative.mjs`
- **Commit:** `bf1146a1`

**2. [Rule 3 - Blocking] `traceabilityRow` helper name collided with a module-scope const**

- **Found during:** Task 3
- **Issue:** The `CLOSE-02` case declared `const traceabilityRow = "| CLOSE-02 | Phase 9 | Pending |"`
  at module scope, so the new helper hit a temporal dead zone (`Cannot access 'traceabilityRow'
  before initialization`).
- **Fix:** Renamed that local to `hiddenRow` and sourced it from the helper, which also repaired its
  own stale literal.
- **Files modified:** `scripts/revalidation.negative.mjs`
- **Commit:** `bf1146a1`

### Additions beyond the literal plan text

The negative runner ends its scope-impact block with a restored-bytes positive assertion (exit 0,
exact 40-record line) before its success line. The plan required the revert half to be recorded; this
keeps it executable rather than only written down.

## Known Stubs

None. No hardcoded empty value, placeholder string, TODO or FIXME was introduced.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or schema at a trust boundary was added;
both new checks are bounded lookups over an already-parsed map.

## Commits

- `e66faa88` — `feat(revalidation): seal exact Phase 2-9 titles outside the ledger`
- `d8ed8995` — `feat(revalidation): seal the exact canonical action for all 40 scope rows`
- `bf1146a1` — `test(revalidation): repair stale plants and witness both new seals`

Measured: `git rev-list --count cff25be1..HEAD` = 3. `git diff --name-only cff25be1..HEAD` lists
exactly the four declared files and no deletions.

## Self-Check: PASSED

- `scripts/revalidation.mjs` — FOUND
- `scripts/revalidation.negative.mjs` — FOUND
- `tests/architecture/revalidation.test.ts` — FOUND
- `.planning/phases/01-live-evidence-revalidation/01-VALIDATION.md` — FOUND
- `e66faa88` — FOUND in `git log`
- `d8ed8995` — FOUND in `git log`
- `bf1146a1` — FOUND in `git log`
- No planning contract, canonical ledger, `STATE.md` or `ROADMAP.md` modified — verified empty
  `git status --short` over `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and
  `01-REVALIDATION.json`
