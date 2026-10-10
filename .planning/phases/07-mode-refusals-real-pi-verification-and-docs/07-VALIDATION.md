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

Task IDs, waves, and threat references will be assigned when plans exist.
The following requirement-level rows are the planning input, not a claim
of task coverage or completed validation.

| Requirement | Behavior | Automated command / planned test | Status |
| --- | --- | --- | --- |
| MODE-03 | Non-tui refusal, message/help, no list delegation, preserved tui | `node --test tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts` | Pending |
| MODE-04 | Lazy typed refusal, no request/poll, stored credentials, propagation and cleanup | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/integration/auth-e2e.test.ts` | Pending |
| TENB-03 | Real stdout schema, exact peer floor, startup positive/negative controls | New isolated e2e test and floor target; name assigned by planner | Missing test |
| JDOC-01/02 | Actual jq examples, severity/outcome/reload matrix, field inventory | New guide-example test; `node --test tests/architecture/wire-schema.test.ts` | Missing example test |
| JDOC-03 | Output policy, backlog corrections, README link | Focused content/diff review | Pending |
| Criterion 6 | Strict corpus, unchanged catalog fixtures, deletion only after final pass | `node scripts/notify-corpus.mjs check` plus zero-extra assertion; `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | Corpus policy unresolved |

## Wave 0 Requirements

- [ ] Add isolated headless runner/fixtures with exact-floor version checks.
- [ ] Add startup emission positive controls and persistence-enabled slash-only coverage.
- [ ] Add checks that execute the guide's real snippets, including missing outcomes.
- [ ] Resolve new refusal text versus frozen-corpus rule before corpus amendment.
- [ ] Planner assigns every task a concrete command, threat ref, and wave.

## Manual-Only Verifications

Review guide completeness/readability, exact selected refusal wording, bounded
AGENTS/backlog changes, and the two allowed catalog prose corrections. Preserve
all catalog fenced examples and the 260-state / 39,143-byte fixture locks.
Any corpus exception requires explicit authorization and an exact change ledger;
no silent recapture or test suppression is permitted.

## Validation Sign-Off

- [ ] Every task has automated verification or an explicit manual reason.
- [ ] No three consecutive tasks lack automated verification.
- [ ] Missing test references are implemented before use.
- [ ] All combined-tree and separate real-Pi gates pass.
- [ ] Final strict corpus evidence is retained before tooling deletion.
- [ ] Set nyquist_compliant only after the completed validation audit.

**Approval:** Pending planning and execution.
