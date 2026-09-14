---
phase: "02"
slug: uninstall-data-disposition-and-the-uninstall-option-seam
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-14"
---

# Phase 02 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Built-in Node test runner |
| Config file | package.json |
| Quick run command | `node --test tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts` |
| Data lifecycle command | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts` |
| Full suite command | `npm run check` |
| Estimated focused runtime | 15 seconds |

## Sampling Rate

- After each task: run its changed owner suites and direct pair coverage.
- After each plan wave: run `npm run check`.
- Before verification: the full gate must pass for the final source tree.
- Maximum focused feedback latency: 60 seconds.
- Run the existing FIFO fixture with the required sandbox permission; do not skip it or change the test to accommodate the sandbox.

## Per-Task Verification Map

The five tasks below belong to two sequential plans. Each task uses existing owner files; the new behavior cases are created during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 02-01 | 1 | DATA-01, DATA-02 | T-02-01, T-02-03 | Preserve nested bytes or delete by default after commit; retain path checks and other cleanup | operation tracer | `node --test tests/orchestrators/plugin/uninstall.test.ts` | Yes | passed (68/68, 2026-09-14) |
| 02-01-02 | 02-01 | 1 | DATA-01 | T-02-02 | Consume accepted booleans; reject unknown short/long options in consuming mode; preserve old callers and scope values | unit | `node --test tests/edge/handlers/shared.test.ts` | Yes | passed (part of 118/118 combined run, 2026-09-14) |
| 02-01-03 | 02-01 | 1 | DATA-01, DATA-02, DATA-03 | T-02-01, T-02-03, T-02-04 | Preserve data on failure; keep independent cleanup active; reconcile deletes seeded data without a prompt | filesystem and consumer integration | `node --test tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/reconcile/apply.test.ts` | Yes | passed (118/118, 2026-09-14) |
| 02-02-01 | 02-02 | 2 | DATA-01, DATA-02 | T-02-02, T-02-05, T-02-06 | Command reaches the shared operation; rejected flags change nothing; exact catalog set and success output hold | command tracer | `node --test tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts` | Yes | passed (108/108, 2026-09-14) |
| 02-02-02 | 02-02 | 2 | DATA-01, DATA-02, DATA-03 | T-02-06 | Document both dispositions and reconcile default without changing success bytes | output regression and documentation | `node --test tests/edge/handlers/plugin/uninstall.test.ts tests/edge/flag-catalog.test.ts tests/architecture/flag-catalog-drift.test.ts`; `pre-commit run --files docs/output-catalog.md` | Yes | passed (part of 108/108 combined run, 2026-09-14) |

### Direct coverage and wave checks

| Task | Additional command |
|------|--------------------|
| 02-01-01 | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` |
| 02-01-02 | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/shared.ts` |
| 02-01-03 | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` |
| 02-02-01 | `node --test tests/edge/completions/provider.test.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts`; `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/flag-catalog.ts` |
| Wave 1 | `npm run test:coverage:direct:all` after shared scanner/transaction contract changes; `npm run check` |
| Wave 2 | `npm run check`; repeat direct-all only if this wave changes a shared contract, fake or harness |

Focused owner commands use the research-proven test runner and tracked files. A nonzero exit, zero executed runtime tests, or incomplete pair is a failed check. Full and all-pair gates can exceed 60 seconds and run outside the focused feedback loop.

### Flagged probe assumptions

The edge engine returned three unclassified/unresolved rows, zero resolved. Preserve that status in phase reports; behavioral evidence does not retroactively change the engine result.

| Requirement | Engine status | Explicit evidence |
|-------------|---------------|-------------------|
| DATA-01 | unclassified / unresolved | 02-01-01/03 and 02-02-01 prove retained nested bytes and removed installed resources |
| DATA-02 | unclassified / unresolved | 02-01-01/03 and 02-02-01 prove promptless omitted/false deletion and failure ordering |
| DATA-03 | unclassified / unresolved | 02-01-03 proves config-driven deletion and next-pass silence |

All product policies are settled in D-02-01 through D-02-06. Plan 02-01 records prohibition recall, correctness/security referral breadcrumbs and a zero-kept precision result.

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Extend the existing paired test files with preservation, promptless deletion, rejected-flag, and reconcile-data cases. No new dependency or test framework is required.

## Manual-Only Verifications

All product behavior has automated verification. The documentation task also compares its prose with the tested usage and completion contract and checks that existing success text blocks remain byte-identical. This review supplements the automated output regressions and file hooks; it does not require a blocking user checkpoint.

## Validation Audit 2026-09-14

Post-execution audit (state A: existing draft VALIDATION.md, all five tasks
re-run against the final source tree, including the code-review fix cycle's
nine additional commits — WR-01/02/03/06, IN-01..05 — and the WR-07 revert).

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All five tasks' automated commands re-ran clean: quick-run command 108/108,
data-lifecycle command 118/118, completions probe 59/59, and all five direct
source-test pairs (`uninstall.ts`, `shared.ts`, `apply.ts`,
`edge/handlers/plugin/uninstall.ts`, `flag-catalog.ts`) at 100% branch,
function and line coverage. No new dependency, framework, or test file was
required beyond what the existing owners already covered.

## Validation Sign-Off

- [x] All tasks have automated verification.
- [x] Sampling continuity: no three consecutive tasks lack automated verification.
- [x] Existing owners cover all required behaviors.
- [x] No watch-mode flags.
- [x] Focused feedback latency is below 60 seconds.
- [x] Direct coverage passes for changed source-test pairs.
- [x] Full project checks pass.
- [x] `nyquist_compliant: true` is set after validation.

**Approval:** Validated 2026-09-14 — all five tasks pass with fresh evidence
on the final tree.
