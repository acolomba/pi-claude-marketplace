---
phase: "4"
slug: "wire-schema-and-json-strategy"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-03"
---

# Phase 4 -- Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Node `node:test` with `strong-mock` doubles |
| Config | npm scripts in `package.json` |
| Focused run | `node --test <test-file.ts>` |
| Full gate | `npm run check` |
| Corpus gate | `node scripts/notify-corpus.mjs check` |

## Requirement Coverage

| Requirement | Behavioral evidence | Result |
| --- | --- | --- |
| LLMT-01 | `tests/edge/handlers/tools.test.ts` checks list-tool detail rows, empty and filtered results, raw statuses and versions, and unchanged content lines. | covered |
| WIRE-01 | `tests/architecture/catalog-uat/catalog-wire.test.ts` converts every catalog fixture and eight raw kinds through the schema validator; `tests/architecture/wire-schema.test.ts` checks all 18 ordered discriminants and integer version 1. | covered |
| WIRE-03 | `tests/shared/notification-json.test.ts` checks verbatim multiword reasons and marker order; `tests/shared/notification-wire.test.ts` rejects an invalid member; the catalog wire gate plants an off-vocabulary reason and observes rejection. | covered |
| WIRE-04 | `tests/shared/notification-json.test.ts` checks per-row scope, raw values, absent optional fields, empty arrays, JSON round-trip, and nonalphabetical order. | covered |
| WIRE-05 | `tests/architecture/catalog-uat/catalog-wire.test.ts` checks summary and `noOp` placement across real payloads; `tests/shared/notification-json.test.ts` checks tally and update no-op conversion. | covered |
| WIRE-06 | `tests/shared/notification-json.test.ts` checks verbatim `name@marketplace` IDs, including an scp-style marketplace name. | covered |
| WIRE-08 | `tests/architecture/catalog-uat/catalog-wire.test.ts` walks every payload for undisclosed paths, live `Error` objects, and nullish fields; planted invalid values are detected. | covered |
| WIRE-09 | `tests/architecture/wire-schema.test.ts` checks schema drift, deterministic generation, declared order, and `package.json` inclusion. `npm_config_cache=/tmp/gsd-phase4-npm-cache npm pack --dry-run --json` exited 0 and listed `schema/claude-plugin.schema.json`. | covered |
| JOUT-02 | `tests/architecture/catalog-uat/catalog-wire.test.ts` validates every catalog fixture and raw kind; `{}` converter, invalid token, and forbidden field controls fail. | covered |
| PMOD-04 | `tests/shared/redact-credentials.test.ts`, `tests/shared/notification-resolve.test.ts`, `tests/shared/notification-present.test.ts`, and 18 planted sites in `tests/architecture/no-credential-leak.test.ts` check presentation, JSON, and text redaction, including block, row, and not-added subject names. | covered |

## Sampling Rate

- Each task has an automated owner or architecture test listed below. Each plan's SUMMARY records its task checks.
- The combined-tree gate at commit `c5494971` passed under Node v26.10.0: `npm run check` exited 0, including static checks, integration tests, and 100% direct coverage for 264 source-test pairs.
- The separate corpus gate on the same commit passed: 3149 baseline entries present, 0 extra; 8592 tests, 8591 passed, 0 failed, 1 skipped. Six entries were added by merged main commit `69a6ade8` after the phase's earlier 3143-entry baseline.
- `docs/output-catalog.md` has no diff from merged main commit `d7213bc2`; both catalog suites pass. The earlier `4e6c568a` comparison includes a later main prose citation change and is no longer the current byte baseline.

## Per-Task Verification Map

| Task | Wave | Requirements | Test type | Automated command | Status |
| --- | --- | --- | --- | --- | --- |
| 04-01-T1 | 1 | LLMT-01, WIRE-03/04/05/06 | unit | `node --test tests/shared/notification-present.test.ts tests/shared/notification-wire.test.ts tests/shared/notification-json.test.ts tests/shared/notification-dispatch.test.ts tests/edge/handlers/tools.test.ts` | green |
| 04-01-T2 | 1 | WIRE-09 | architecture + package | `node --test tests/architecture/wire-schema.test.ts`; `npm_config_cache=/tmp/gsd-phase4-npm-cache npm pack --dry-run --json` | green |
| 04-02-T1 | 2 | LLMT-01 | unit | `node --test tests/orchestrators/marketplace/list.test.ts tests/edge/handlers/tools.test.ts` | green |
| 04-02-T2 | 2 | WIRE-05 | unit + corpus | `node --test tests/shared/notification-present.test.ts tests/shared/notification-json.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notify-context.test.ts tests/architecture/wire-schema.test.ts` | green |
| 04-03-T1 | 3 | WIRE-01/03/04/06 | unit + corpus | `node --test tests/shared/notification-present.test.ts tests/shared/notification-json.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-grammar.test.ts tests/architecture/wire-schema.test.ts` | green |
| 04-03-T2 | 3 | WIRE-01 | unit + architecture | `node --test tests/shared/notification-json.test.ts tests/shared/notification-wire.test.ts tests/shared/notification-grammar.test.ts tests/architecture/hooks-cap-notify.test.ts tests/architecture/hooks-async-rewake.test.ts` | green |
| 04-04-T1 | 4 | PMOD-04 | unit + corpus | `node --test tests/shared/redact-credentials.test.ts tests/shared/errors.test.ts tests/shared/notification-resolve.test.ts tests/shared/notification-present.test.ts` | green |
| 04-04-T2 | 4 | PMOD-04 | architecture | `node --test tests/architecture/no-credential-leak.test.ts` | green |
| 04-05-T1 | 5 | JOUT-02, WIRE-01 | architecture | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | green |
| 04-05-T2 | 5 | WIRE-08 | architecture + full | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts`; `npm run check` | green |
| 04-06-T1 | 6 | PMOD-04 | unit + architecture | `node --test tests/shared/notification-resolve.test.ts tests/architecture/no-credential-leak.test.ts` | green |
| 04-06-T2 | 6 | PMOD-04 | unit + architecture | `node --test tests/shared/notification-resolve.test.ts tests/shared/notification-present.test.ts tests/architecture/no-credential-leak.test.ts` | green |

## Manual-Only Verifications

None for this phase's ten requirements. WIRE-02 and WIRE-07 belong to Phase 6.

## Validation Sign-Off

- [x] All 12 tasks have automated verification.
- [x] All ten phase requirements have behavioral tests that passed in the combined-tree gate.
- [x] No three consecutive tasks lack automated verification.
- [x] No watch-mode flags are used.
- [x] The schema is included in the package dry run.
- [x] `nyquist_compliant: true` is set after the current combined-tree, corpus, and package checks.

**Approval:** validated against commit `c5494971` on 2026-10-06.

## Validation Audit 2026-10-06

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
