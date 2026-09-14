# Quick task 260612-bcs: Sub-plan index + coverage table

The single `260612-bcs-PLAN.md` was re-cut into 7 sequential single-commit
sub-plans (`260612-bcs-01-PLAN.md` .. `260612-bcs-07-PLAN.md`) so a fresh
gsd-executor can run each one in its own context window without overflowing.

The original `260612-bcs-PLAN.md` is preserved unchanged for reference.

## Execution order

Sub-plans run STRICTLY SEQUENTIALLY, in numeric order. Each executor reads
ONLY its own sub-plan + `260612-bcs-CONTEXT.md` + `CLAUDE.md`.

| Plan | Wave | Byte contract | Depends on | One-line scope |
|------|------|---------------|------------|----------------|
| 260612-bcs-01-PLAN.md | 1 | catalog-amending | (none) | I1 partial-cascade + I2 autoupdate-skipped + I5 loadConfig diagnostic + S2 postCommitWarnings + S3 read-pass attribution. ONLY plan that touches docs/output-catalog.md + catalog-uat. |
| 260612-bcs-02-PLAN.md | 2 | byte-neutral | 01 | C1 setPluginEnabled never-rethrows + I3 disable dropped-fold + I4 enable InstallFailureCapture thread + D-UPD update-vs-disabled (LOCKED) + D-NCF narrowCascadeFailure (LOCKED) + S5 reinstall/update invalid-config + T2 update-vs-disabled behavior tests. Must precede Y3. |
| 260612-bcs-03-PLAN.md | 3 | byte-neutral | 01, 02 | I6 classifyOrchestratorThrow (StateLockHeldError + PluginShapeError) + S4 synthesizeUndeclaredMarketplaceSource + S6 three non-toggle silent loops + Y7 errorMessage at index.ts:31. |
| 260612-bcs-04-PLAN.md | 4 | byte-neutral | 01, 02, 03 | Y1 samePlannedSource tri-state + Y2 PlannedSourceMismatch widening to 4 causes + Y4 InvalidBlockOutcome rename + Y5 MigrateFirstRunResult discriminant cut + Y6 PluginToggleAxes derived successStatus. |
| 260612-bcs-05-PLAN.md | 5 | byte-neutral | 02, 04 | Y3 setPluginEnabled overload (closes S6 fourth loop) + S7 isDeclaredEnabled helper + S8 MarketplaceBlock.status narrow + S9 cascadeSeverity closed-set + S10 config-write-back cast comment. |
| 260612-bcs-06-PLAN.md | 6 | byte-neutral (tests only) | 02, 04, 05 | T1 load-time ENABLE + orchestrated enable-success + T3 direct pluginsToUninstall + T4 applySourceMismatches dangling-reference + T5 predicate-drift matrix + T6 smaller arms. |
| 260612-bcs-07-PLAN.md | 7 | byte-neutral (comments/docs only) | 01-06 | D1 reconcile/README.md rewrite + D2-D10 textual + symbolic-ref corrections + D11 planning-artifact ID strip + D-MIG first-run migration comment (LOCKED) + S1 CLAUDE.md NFR-10 enumeration. LAST so it documents final code. |

## Ordering constraints honoured

1. C1, I3, I4 edit `enable-disable.ts` -> Plan 02 (before Plan 05's Y3
   overload). C1's outer try/catch is the structure Y3 narrows.
2. D-UPD + D-NCF + T2 (behavior side) -> Plan 02 alongside their tests.
3. The comment/docs scrub (D1-D11, S1, D-MIG) -> Plan 07 LAST so it
   documents the final post-Plan-06 code.
4. Catalog-amending fixes (I1, I2, I5 + the catalog-uat-relevant rows for
   S2/S3) -> Plan 01 only. Every other plan is byte-neutral with NO
   docs/output-catalog.md edits.
5. Test-gap-only plan (T1, T3-T6; T2 absorbed by Plan 02) -> Plan 06 after
   every behavior fix has landed.

## Coverage table — 53 finding IDs accounted for

Every finding ID from CONTEXT.md `<specifics>` is closed by EXACTLY ONE
sub-plan.

### CRITICAL (1)

| ID | Plan |
|----|------|
| C1 | 02 |

### IMPORTANT — error handling (6)

| ID | Plan |
|----|------|
| I1 | 01 |
| I2 | 01 |
| I3 | 02 |
| I4 | 02 |
| I5 | 01 |
| I6 | 03 |

### IMPORTANT — test gaps (6)

| ID | Plan |
|----|------|
| T1 | 06 |
| T2 | 02 (D-UPD behavior tests in update.test.ts + autoupdate.test.ts) |
| T3 | 06 |
| T4 | 06 |
| T5 | 06 |
| T6 | 06 |

### IMPORTANT — type design (7)

| ID | Plan |
|----|------|
| Y1 | 04 |
| Y2 | 04 |
| Y3 | 05 |
| Y4 | 04 |
| Y5 | 04 |
| Y6 | 04 |
| Y7 | 03 |

### IMPORTANT — comments/docs (11)

| ID | Plan |
|----|------|
| D1 | 07 |
| D2 | 07 |
| D3 | 07 |
| D4 | 07 |
| D5 | 07 |
| D6 | 07 |
| D7 | 07 |
| D8 | 07 |
| D9 | 07 |
| D10 | 07 |
| D11 | 07 |

### SUGGESTIONS (10)

| ID | Plan |
|----|------|
| S1 | 07 |
| S2 | 01 |
| S3 | 01 |
| S4 | 03 |
| S5 | 02 |
| S6 | 03 (three non-toggle loops) + 05 (Y3 closes the fourth toggle loop) |
| S7 | 05 |
| S8 | 05 |
| S9 | 05 |
| S10 | 05 |

### LOCKED decisions from CONTEXT.md (3)

| Decision | Plan |
|----------|------|
| D-UPD update vs disabled | 02 |
| D-NCF narrowCascadeFailure align | 02 |
| D-MIG first-run migration silence | 07 |

## Coverage totals

- CRITICAL: 1 / 1
- IMPORTANT error handling: 6 / 6
- IMPORTANT test gaps: 6 / 6
- IMPORTANT type design: 7 / 7
- IMPORTANT comments/docs: 11 / 11
- SUGGESTIONS: 10 / 10
- LOCKED decisions: 3 / 3

Total: **44 IMPORTANT/CRITICAL/SUGGESTION findings + 3 locked decisions + 6
test gaps = 53 IDs covered, each in exactly one sub-plan** (Plan 03 + Plan
05 share S6 across the 3 + 1 loop split, by design -- the four loops
require two structural changes, and the count above lists S6 once).

## Notes for fresh executors

- Each sub-plan is self-contained. The execution context tells you which
  prior plans it depends on, but you do NOT need to read prior PLAN files
  -- only `CONTEXT.md` + `CLAUDE.md` + the relevant source spans.
- `npm run check` must be GREEN at the end of every commit (NFR-6).
- Conventional Commits; titles <=72 chars; body lines <=80 chars.
- `pre-commit run --files <changed>` before `git commit`; NEVER
  `--no-verify`.
- If committing from inside a worktree, prefix `SKIP=trufflehog`. Confirm
  trufflehog separately via `pre-commit run trufflehog --all-files` before
  the commit.
- Catalog amendments (`docs/output-catalog.md` + `tests/shared/catalog-uat.test.ts`)
  are ALLOWED ONLY in Plan 01. Every other plan must keep
  `docs/output-catalog.md` UNCHANGED and the catalog-uat byte gate GREEN.
