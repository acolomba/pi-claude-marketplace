---
phase: "07"
slug: "mode-refusals-real-pi-verification-and-docs"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-09"
---

# Phase 7 — Validation Strategy

## Test Infrastructure

Use the existing Node test runner and TypeBox schema compiler. Package scripts
and `skills/local-verification/SKILL.md` govern checks. Full combined-tree
GSD gate: `npm run check`; real-Pi e2e runs separately. Current research
observed Node v26.11.1, Pi 0.87.1, jq 1.8.1. The separate Pi 0.86.1 floor
fixture still needs provisioning and execution. No full gate is claimed here.

## Sampling Rate

Run changed owner tests during implementation. Before committing, run the
required fixers and let the commit hook run staged-input checks. Run
`npm run check` after every combined wave and at the phase gate, subject
only to the documented same-session unchanged-input reuse rule. Bound
runtime subprocesses with a finite timeout and explicitly close JSON stdin.
Measure task feedback latency during execution; no duration is assumed.

## Per-Task Verification Map

All commands run from the executor checkout root. A nonzero exit, zero applicable
passing tests, or a skipped new acceptance case is a failure. Each PLAN adds the
behavior-specific failing direction. New verification files are created by their
own tracer task before its command runs; no unavailable test is counted as passed.

| Task | Wave | Requirement / criterion | Automated command | Threat Ref | Status |
| --- | --- | --- | --- | --- | --- |
| 07-01-01 | 1 | MODE-03 / SC1 | `node --test tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts` | T-07-01, T-07-02 | Planned |
| 07-01-02 | 1 | MODE-03 / SC1 | `node --test tests/shared/notification-grammar.test.ts tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-07-01, T-07-02 | Planned |
| 07-02-01 | 1 | MODE-04 / SC1 | `node --test tests/shared/errors.test.ts tests/platform/git-auth-callbacks.test.ts tests/integration/auth-e2e.test.ts` | T-07-03, T-07-06 | Planned |
| 07-02-02 | 1 | MODE-04 / SC1 | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/platform/git.test.ts tests/integration/auth-e2e.test.ts` | T-07-03, T-07-04, T-07-05, T-07-06 | Planned |
| 07-03-01 | 1 | TENB-03, JDOC-02 / SC2, SC4 | `node --test --test-name-pattern='installed runtime' tests/e2e/pi-json-output.test.ts` | T-07-07, T-07-08, T-07-10 | New test planned |
| 07-03-02 | 1 | TENB-03 / SC2 | `npm view @earendil-works/pi-coding-agent@0.86.1 name version repository dist.integrity scripts.postinstall --json --fetch-retries=0 --fetch-timeout=15000` | T-07-SC | Prior authorization recorded; identity recheck planned |
| 07-03-03 | 1 | TENB-03, JDOC-02 / SC2, SC4 | `node --test tests/e2e/pi-json-output.test.ts` | T-07-07, T-07-08, T-07-09, T-07-10, T-07-SC | Exact-floor execution pending |
| 07-04-01 | 2 | JDOC-01 / SC3 | `node --test tests/architecture/json-output-docs.test.ts` | T-07-12 | New test planned |
| 07-04-02 | 2 | JDOC-01, JDOC-02 / SC3, SC4 | `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | T-07-11, T-07-12, T-07-13 | Planned |
| 07-05-01 | 3 | JDOC-01 / SC3 | `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | T-07-14 | Planned |
| 07-05-02 | 3 | JDOC-02 / SC4 | `node --test tests/architecture/json-output-docs.test.ts tests/e2e/pi-json-output.test.ts` | T-07-15 | Planned |
| 07-05-03 | 3 | JDOC-03 / SC5, SC6 | `git diff --check 64bcfa027530b55319446ea781facab229df92cd -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md && node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/wire-schema.test.ts` | T-07-16 | Planned; bounded prose review required |
| 07-06-01 | 4 | MODE-03, MODE-04, JDOC-03 / SC6 | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --self-test && node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --ledger` | T-07-16, T-07-17 | New phase-local audit planned |
| 07-06-02 | 4 | MODE-03, MODE-04, JDOC-03 / SC6 | `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check > .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-FINAL.log 2>&1 && node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --final` | T-07-17, T-07-18 | Pending ledgered amendment |
| 07-06-03 | 4 | JDOC-03 / SC6 | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --retired && npm run check` | T-07-18, T-07-19 | Must run last |

## Wave and Gate Order

Wave 1: 07-01, 07-02, 07-03 (disjoint file ownership and isolated runtime fixtures).
Wave 2: 07-04, after all three behavior/runtime plans.
Wave 3: 07-05, after 07-04 because both own the guide and its test.
Wave 4: 07-06, after every other plan; corpus capture runs alone.

The parent runs `npm run check` on the combined tree after each wave and at the
phase/merge/handoff gates. A same-session pass is reusable only under the exact
unchanged-input rule in local-verification. The corpus full-suite run and
combined-tree gate exceed the quick-feedback budget; use bounded tool waits and
report progress. Real-Pi evidence is separate and includes both exact targets.

The age-only package audit finding is retained in RESEARCH.md. The user explicitly
reaffirmed D-11 authorization for the isolated 0.86.1 fixture; no new permission
checkpoint is introduced. Fixture npm ci runs with lifecycle scripts disabled.

## Wave 0 Requirements

- [ ] Add isolated headless runner/fixtures with exact-floor version checks.
- [ ] Add startup emission positive controls and persistence-enabled slash-only coverage.
- [ ] Add checks that execute the guide's real snippets, including missing outcomes.
- [x] User approved the narrow corpus exception in CONTEXT.md D-14.
- [ ] Record exact refusal-only additions and prove preservation of all 3,149 old samples.
- [x] Planner assigns every task a concrete command, threat ref, and wave.

## Manual-Only Verifications

Review guide completeness/readability, exact selected refusal wording, bounded
AGENTS/backlog changes, and the two allowed catalog prose corrections. Preserve
all catalog fenced examples and the 260-state / 39,143-byte fixture locks.
CONTEXT.md D-14 authorizes only new refusal samples, with an exact change ledger;
no removals, replacements, silent recapture, or test suppression are permitted.

## Validation Sign-Off

- [ ] Every task has automated verification or an explicit manual reason.
- [ ] No three consecutive tasks lack automated verification.
- [ ] Missing test references are implemented before use.
- [ ] All combined-tree and separate real-Pi gates pass.
- [ ] Final strict corpus evidence is retained before tooling deletion.
- [ ] Set nyquist_compliant only after the completed validation audit.

## Probe and Audit Handling

COVERAGE.md maps all six requirements, six roadmap criteria, D-01 through D-14,
and research constraints. The 19 supplied edge probes become 17 explicit
must-have assertions and two flagged unclassified assumptions. Three recalled
prohibitions use the canonical projectProhibitions projection without check
descriptors; retain flagged-unverified disposition until reviewed. No ORM or
AI-product work is included.

Every execution SUMMARY must include `## Threat Flags`, even when None.
Planning validates coverage and structure, not runtime success; leave the
execution and Nyquist completion flags false until their gates actually pass.

**Approval:** D-01 through D-14 and exact-floor fixture scope approved; execution pending.
