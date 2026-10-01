---
phase: "02"
slug: row-policies
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| Estimated runtime | Focused checks: seconds; full suite: about 7 minutes |

## Sampling Rate

- Before every task commit: run changed owner tests, direct pair coverage, and typecheck.
- After every wave: run shared presentation, marker, and catalog suites.
- Before verification: run `npm run check`, `node scripts/notify-corpus.mjs check`, and `git diff --exit-code e40d3dda -- docs/output-catalog.md`.
- Target feedback latency for focused checks: 180 seconds. The full suite takes longer.

## Per-Task Verification Map

All commands run from the checkout root. Each PLAN command has a paired
`fails_when` condition. These are planned checks, not execution results.

| Task ID | Wave | Requirement | Behavior and owner | Automated command | Threat Ref | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 02-01-01 | 1 | PMOD-02 | Shared contract, producer narrowing, resolver, grammar, dispatch, and all 15 messaging owners | `npm run typecheck && node --test tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts tests/shared/notify-context.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/compat-01-no-expansion.test.ts "tests/orchestrators/**/*.messaging.test.ts"` | T-02-01, T-02-02, T-02-03 | pending |
| 02-01-01 | 1 | PMOD-02 | Marker census and planted controls; summary helper migration; catalog | `node --test tests/shared/notification-summary.test.ts tests/architecture/soft-dep-marker-policy.test.ts tests/architecture/workflows-marker-coverage.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-03 | pending |
| 02-01-01 | 1 | PMOD-02 | Exactly 25 authorized corpus substitutions, including duplicate occurrences | The complete `node --input-type=module -e` command in 02-01 Task 1 compares the ledger against Git blob `25f4e3c0a943a15a91d5231afef1551e5e5a6259` and requires the exact `Approved substitutions: 25; unchanged occurrences: 2636; total: 2661` line | T-02-04 | pending |
| 02-01-02 | 1 | PMOD-02 | Total policy, frozen/writable malformed rows, adjacency, empty, ordering, marker architecture | `npm run typecheck && node --test tests/shared/notify-context.test.ts tests/shared/notification-resolve.test.ts tests/shared/notification-grammar.test.ts tests/architecture/soft-dep-marker-policy.test.ts tests/architecture/workflows-marker-coverage.test.ts` | T-02-01, T-02-02, T-02-03 | pending |
| 02-02-01 | 2 | PMOD-05 | Typed facts, both pending message arms, one scan, and catalog fixture inputs | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notify-context.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-summary.test.ts tests/orchestrators/reconcile/pending.test.ts tests/orchestrators/reconcile/reconcile.messaging.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-05, T-02-06, T-02-07 | pending |
| 02-02-02 | 2 | PMOD-05 | Empty, zero/one/absent count, exact names/order, scanner containment | `npm run typecheck && node --test tests/shared/notification-types.test.ts tests/shared/notification-summary.test.ts tests/orchestrators/reconcile/pending.test.ts tests/orchestrators/plugin/workflows-staging-gc.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-02-05, T-02-06, T-02-07 | pending |
| 02-01-02, 02-02-02 | 1, 2 | Both | Every changed source retains 100% direct owner coverage | `npm run test:coverage:direct:all` | T-02-03, T-02-08 | pending |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Full project quality gates | `npm run check` | T-02-04, T-02-08 | pending |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Exactly 2661 baseline occurrences, zero missing and zero extra occurrences | `node scripts/notify-corpus.mjs check` | T-02-04, T-02-08 | pending |
| 02-01-01, 02-01-02, 02-02-01, 02-02-02 | 1, 2 | Both | Production catalog unchanged, 206 states and 26848 bytes | `git diff --exit-code e40d3dda -- docs/output-catalog.md` and the catalog-contract suite | T-02-04, T-02-08 | pending |

The shared carrier changes must pass their complete tests before committing.
Full check, direct coverage, and corpus runs can exceed the short feedback target;
focused owner tests provide the regular feedback loop. The corpus tool accepts
extras by design, so exit zero alone is insufficient: require zero extras.

## Explicit Edge Coverage

No SPEC exists. All five applicable edges from the fallback report are resolved
to explicit plan truths; none is dismissed or left to subjective review.

| Requirement | Edge | Acceptance criterion | Task and owner | Verification |
| --- | --- | --- | --- | --- |
| PMOD-02 | adjacency | Equal adjacent rows remain separate; repeated reasons survive before markers | 02-01-02; notification-resolve and notification-grammar | explicit |
| PMOD-02 | empty | Empty/singleton inputs retain existing sentinel/header/row behavior; null inputs are refused by type contracts | 02-01-02; notify-context, notification-resolve, notification-grammar | explicit |
| PMOD-02 | ordering | Marketplace/plugin order, equal-name rows, different scopes, and content-before-marker order remain exact | 02-01-02; notification-resolve and notification-grammar | explicit |
| PMOD-05 | empty | Absent/empty facts add no block; zero/one/three/absent count preserve parentheses and noun grammar | 02-02-02; notification-types, notification-summary, pending | explicit |
| PMOD-05 | encoding | Unicode and whitespace in supplied names are preserved byte for byte without normalization or reordering | 02-02-02; notification-summary | explicit |

Additional edge cases use pure resolver/formatter calls or strengthen existing
notifying cases so they do not introduce unapproved corpus occurrences.

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No runner or harness
installation is needed. Preserve paired direct coverage for every changed owner.
The user approved replacing only the 25 synthetic callback occurrences listed
in RESEARCH.md. Verify exact old/new triples and multiplicities; preserve
severity, argument count, every other occurrence, and the complete catalog.
The baseline source blob is `25f4e3c0a943a15a91d5231afef1551e5e5a6259`;
the unchanged metadata blob is `5304d88af67d0b4d58c3572aea6f9e5d3e73be7b`.
Task 02-01-01 creates `02-CORPUS-CHANGES.json` with the 25 specific before/after
records. All test owners and commands already exist; there is no missing
runner, harness, or external setup. Compile-negative contracts are implemented
with their production readers in 02-01-01 and completed in 02-01-02.

## Manual-Only Verifications

All implementation behaviors have automated verification. The synthetic-corpus
exception has the user's explicit approval recorded in CONTEXT.md D-07.

## Validation Sign-Off

- [ ] All tasks have automated verification or Wave 0 dependencies
- [ ] No three consecutive tasks lack automated verification
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Focused feedback latency below 180 seconds
- [ ] `nyquist_compliant: true` set after execution audit

**Approval:** plan prepared; execution evidence pending. D-07's narrow corpus
exception already has explicit user approval.
