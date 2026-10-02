---
phase: "02"
slug: row-policies
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-01"
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Existing node:test and node:assert/strict |
| Config file | package.json and existing TypeScript configuration |
| Quick run command | `node --test tests/shared/notification-resolve.test.ts tests/shared/notify-context.test.ts` |
| Full suite command | `npm run check` |
| Observed runtime | Focused checks: seconds; final full suite: 23m33s; corpus: 136s |

## Sampling Rate

- Before every task commit: run changed owner tests, direct pair coverage, and typecheck.
- After every wave: run shared presentation, marker, and catalog suites.
- Before verification: run `npm run check`, `node scripts/notify-corpus.mjs check`, and `git diff --exit-code e40d3dda -- docs/output-catalog.md`.
- Target feedback latency for focused checks: 180 seconds. The full suite takes longer.

## Per-Task Verification Map

All commands run from the checkout root. Each PLAN command has a paired
`fails_when` condition. All checks below passed; the execution evidence follows
the table. Prior-plan results are recorded in 02-01-SUMMARY.md.

| Task ID | Wave | Requirement | Behavior and owner | Automated command | Threat Ref | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 02-01-01 | 1 | PMOD-02 | Shared contract, producer narrowing, resolver, grammar, dispatch, and all 15 messaging owners | `npm run typecheck && node --test tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts tests/shared/notify-context.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/compat-01-no-expansion.test.ts "tests/orchestrators/**/*.messaging.test.ts"` | T-02-01, T-02-02, T-02-03 | passed |
| 02-01-01 | 1 | PMOD-02 | Marker census and planted controls; summary helper migration; catalog | `node --test tests/shared/notification-summary.test.ts tests/architecture/soft-dep-marker-policy.test.ts tests/architecture/workflows-marker-coverage.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-03 | passed |
| 02-01-01 | 1 | PMOD-02 | Exactly 28 authorized corpus substitutions, including duplicate occurrences | The complete `node --input-type=module -e` command in 02-01 Task 1 compares the ledger against Git blob `25f4e3c0a943a15a91d5231afef1551e5e5a6259` and requires the exact `Approved substitutions: 28; unchanged occurrences: 2633; total: 2661` line | T-02-04 | passed |
| 02-01-02 | 1 | PMOD-02 | Total policy, frozen/writable malformed rows, adjacency, empty, ordering, marker architecture | `npm run typecheck && node --test tests/shared/notify-context.test.ts tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts tests/architecture/soft-dep-marker-policy.test.ts tests/architecture/workflows-marker-coverage.test.ts` | T-02-01, T-02-02, T-02-03 | passed |
| 02-02-01 | 2 | PMOD-05 | Typed facts, both pending message arms, one scan, and catalog fixture inputs | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notify-context.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-summary.test.ts tests/orchestrators/reconcile/pending.test.ts tests/orchestrators/reconcile/reconcile.messaging.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-05, T-02-06, T-02-07 | passed |
| 02-02-02 | 2 | PMOD-05 | Empty, zero/one/absent count, exact names/order, scanner containment | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notification-summary.test.ts tests/orchestrators/reconcile/pending.test.ts tests/orchestrators/plugin/workflows-staging-gc.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-05, T-02-06, T-02-07 | passed |
| 02-01-02, 02-02-02 | 1, 2 | Both | Every changed source retains 100% direct owner coverage | `npm run test:coverage:direct:all` | T-02-03, T-02-08 | passed |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Full project quality gates | `npm run check` | T-02-04, T-02-08 | passed |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Exactly 2661 baseline occurrences, zero missing and zero extra occurrences | `node scripts/notify-corpus.mjs check` | T-02-04, T-02-08 | passed |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Production catalog unchanged, 206 states and 26848 bytes | `git diff --exit-code e40d3dda -- docs/output-catalog.md` and the catalog-contract suite | T-02-04, T-02-08 | passed |

The shared carrier changes must pass their complete tests before committing.
Full check, direct coverage, and corpus runs can exceed the short feedback target;
focused owner tests provide the regular feedback loop. The corpus tool accepts
extras by design, so exit zero alone is insufficient: require zero extras.

## Observed Execution Evidence

Final checks ran on 2026-10-02 UTC with normal concurrency and no heap override.
No baseline or catalog file changed during Plan 02.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Plan 01 focused migration | 679 tests passed | 02-01-SUMMARY.md; `/tmp/row-policy-focused-final.log` |
| Plan 01 defensive and collection edges | 220 tests passed | `/tmp/row-policy-task2-focused.log` |
| Plan 02 typecheck and eight focused owners | Typecheck passed; 363 tests passed in 3.1s | `/tmp/pending-facts-typecheck.log`; `/tmp/pending-facts-focused.log` |
| Grouped advisory caller regression | 138 tests passed in 4.4s | `/tmp/pending-facts-options-focused.log` |
| All-owner direct coverage | 253 pairs passed with 100% functions, lines, and branches | `/tmp/row-policy-direct-all.log`; all unchanged owners reused with parent authorization |
| Final changed-owner direct coverage | Six changed sources each passed at 100% functions, lines, and branches | `/tmp/pending-facts-direct-{types,summary,dispatch,context,pending,add}.log` |
| Final `npm run check` | Passed, 00:06:19–00:29:52 UTC; 7,580 unit tests, 312 suites, 36 integration tests, no failures or skips; 100% unit coverage | `/tmp/pending-facts-check-final.log` |
| Type-member gate and sensitivity controls | Three existing exceptions; all seven negative controls passed; no new exception | Same final-check log |
| `node scripts/notify-corpus.mjs check` | All 2,661 baseline entries present; zero extras; 136s | `/tmp/pending-facts-corpus.log` |
| Immutable-blob ledger command from 02-01 Task 1 | `Approved substitutions: 28; unchanged occurrences: 2633; total: 2661` | `/tmp/pending-facts-ledger-final.log` |
| `git diff --exit-code e40d3dda -- docs/output-catalog.md` | Passed with no diff; catalog owner checks 206 states and 26,848 bytes | Final check and corpus both include the catalog-contract owner |
| Final source review | No row callback/adapter, extra staging scan, new formatter probe, baseline edit, or new suppression | Final diff and unchanged scanner owner |

The six direct pairs are notification-types, notification-summary,
notification-dispatch, notify-context, reconcile/pending, and marketplace/add.
Their respective branch/function/line totals were 26/3/776, 102/17/501,
45/18/426, 9/4/177, 37/8/316, and 161/19/1089, with every counter covered.
The final full check also covers unchanged owners. Reusing the earlier 253-pair
run plus these six fresh pairs avoids a duplicate full direct-coverage sweep.

The corpus run reports one existing environment-dependent skip: SC-2 / AGSK-06
could not reach the optional pi-subagents resolver module in that harness.
The ordinary full check passes all 7,580 unit and 36 integration tests with zero
skips. No test was disabled or weakened by this plan.

An earlier full check failed because the dispatch type-member contract still
pointed to line 201 after an import shifted its declaration to line 202. A direct
analyzer run reported that exact invalid coordinate (exit 2); it was not a
memory failure. Re-anchoring the existing contract fixed the cause. The direct
analyzer and the complete final check then passed without environment overrides.

## Explicit Edge Coverage

No SPEC exists. All five applicable edges from the fallback report are resolved
to explicit plan truths; none is dismissed or left to subjective review.

| Requirement | Edge | Acceptance criterion | Task and owner | Verification |
| --- | --- | --- | --- | --- |
| PMOD-02 | adjacency | Equal adjacent rows remain separate; repeated reasons survive before markers | 02-01-02; notification-resolve and notification-grammar | passed |
| PMOD-02 | empty | Empty/singleton inputs retain existing sentinel/header/row behavior; null inputs are refused by type contracts | 02-01-02; notify-context, notification-resolve, notification-grammar | passed |
| PMOD-02 | ordering | Marketplace/plugin order, equal-name rows, different scopes, and content-before-marker order remain exact | 02-01-02; notification-resolve and notification-grammar | passed |
| PMOD-05 | empty | Absent/empty facts add no block; zero/one/three/absent count preserve parentheses and noun grammar | 02-02-02; notification-types, notification-summary, pending | passed |
| PMOD-05 | encoding | Unicode and whitespace in supplied names are preserved byte for byte without normalization or reordering | 02-02-02; notification-summary | passed |

Additional edge cases use pure resolver/formatter calls or strengthen existing
notifying cases so they do not introduce unapproved corpus occurrences.
The pending owner now observes exactly one real staging-root enumeration in its
existing both-scopes case. Existing action and empty-state cases retain complete
message and boundary assertions. The scanner owner proves absent-count and
containment behavior; type and pure formatter checks prove lossless transport
and exact absent/zero/one/three-count output. No new notifying case is needed.

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No runner or harness
installation is needed. Preserve paired direct coverage for every changed owner.
The user approved replacing only the 28 synthetic callback occurrences listed
in RESEARCH.md and current CONTEXT.md D-07, plus the one CR-01 review-fix
occurrence (29 in total; the execution evidence above records the 28 that
existed at plan completion). Verify exact old/new triples and multiplicities; preserve
severity, argument count, every other occurrence, and the complete catalog.
The baseline source blob is `25f4e3c0a943a15a91d5231afef1551e5e5a6259`;
the unchanged metadata blob is `5304d88af67d0b4d58c3572aea6f9e5d3e73be7b`.
Task 02-01-01 creates `02-CORPUS-CHANGES.json` with the 28 specific before/after
records. All test owners and commands already exist; there is no missing
runner, harness, or external setup. Compile-negative contracts are implemented
with their production readers in 02-01-01 and completed in 02-01-02.

## Manual-Only Verifications

All implementation behaviors have automated verification. The synthetic-corpus
exception has the user's explicit approval recorded in CONTEXT.md D-07.

## Validation Sign-Off

- [x] All tasks have automated verification or Wave 0 dependencies
- [x] No three consecutive tasks lack automated verification
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Focused feedback latency below 180 seconds
- [x] `nyquist_compliant: true` set after execution audit

**Approval:** automated execution evidence is complete. D-07's narrow corpus
exception has explicit user approval. The phase verifier owns the final phase
verdict; this document records the completed automated checks.
