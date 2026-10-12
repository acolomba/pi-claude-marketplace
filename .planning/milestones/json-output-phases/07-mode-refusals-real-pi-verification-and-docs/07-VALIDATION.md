---
phase: "07"
slug: "mode-refusals-real-pi-verification-and-docs"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-09"
---

# Phase 7 — Validation Strategy

## Test Infrastructure

Use the existing Node test runner and TypeBox schema compiler. Package scripts
and `skills/local-verification/SKILL.md` govern checks. Full combined-tree
GSD gate: `npm run check`; real-Pi e2e runs separately. Current research
observed Node v26.11.1, Pi 0.87.1, jq 1.8.1. The separate Pi 0.86.1 floor
fixture and installed Pi 0.87.1 each passed all four real-runtime cases.
All four combined-wave gates passed, most recently at `77300475` on Node
v26.11.1; see `07-WAVE-4-VERIFICATION.md`.

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
| 07-01-01 | 1 | MODE-03 / SC1 | `node --test tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts` | T-07-01, T-07-02 | Passed; see plan SUMMARY |
| 07-01-02 | 1 | MODE-03 / SC1 | `node --test tests/shared/notification-grammar.test.ts tests/edge/handlers/plugin/browse.test.ts tests/edge/register.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | T-07-01, T-07-02 | Passed; see plan SUMMARY |
| 07-02-01 | 1 | MODE-04 / SC1 | `node --test tests/shared/errors.test.ts tests/platform/git-auth-callbacks.test.ts tests/integration/auth-e2e.test.ts` | T-07-03, T-07-06 | Passed; see plan SUMMARY |
| 07-02-02 | 1 | MODE-04 / SC1 | `node --test tests/orchestrators/auth-host.test.ts tests/platform/git-auth-callbacks.test.ts tests/platform/git.test.ts tests/integration/auth-e2e.test.ts` | T-07-03, T-07-04, T-07-05, T-07-06 | Passed; see plan SUMMARY |
| 07-03-01 | 1 | TENB-03, JDOC-02 / SC2, SC4 | `node --test --test-name-pattern='installed runtime' tests/e2e/pi-json-output.test.ts` | T-07-07, T-07-08, T-07-10 | Passed; see plan SUMMARY |
| 07-03-02 | 1 | TENB-03 / SC2 | `npm view @earendil-works/pi-coding-agent@0.86.1 name version repository dist.integrity scripts.postinstall --json --fetch-retries=0 --fetch-timeout=15000` | T-07-SC | Passed; see plan SUMMARY |
| 07-03-03 | 1 | TENB-03, JDOC-02 / SC2, SC4 | `node --test tests/e2e/pi-json-output.test.ts` | T-07-07, T-07-08, T-07-09, T-07-10, T-07-SC | Passed; see plan SUMMARY |
| 07-04-01 | 2 | JDOC-01 / SC3 | `node --test tests/architecture/json-output-docs.test.ts` | T-07-12 | Passed; see plan SUMMARY |
| 07-04-02 | 2 | JDOC-01, JDOC-02 / SC3, SC4 | `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | T-07-11, T-07-12, T-07-13 | Passed; see plan SUMMARY |
| 07-05-01 | 3 | JDOC-01 / SC3 | `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | T-07-14 | Passed; see plan SUMMARY |
| 07-05-02 | 3 | JDOC-02 / SC4 | `node --test tests/architecture/json-output-docs.test.ts tests/e2e/pi-json-output.test.ts` | T-07-15 | Passed; see plan SUMMARY |
| 07-05-03 | 3 | JDOC-03 / SC5, SC6 | `git diff --check 64bcfa027530b55319446ea781facab229df92cd -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md && node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/wire-schema.test.ts` | T-07-16 | Passed; see plan SUMMARY |
| 07-06-01 | 4 | MODE-03, MODE-04, JDOC-03 / SC6 | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --self-test && node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --ledger` | T-07-16, T-07-17 | Passed; see plan SUMMARY |
| 07-06-02 | 4 | MODE-03, MODE-04, JDOC-03 / SC6 | `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check > .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-FINAL.log 2>&1 && node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --final` | T-07-17, T-07-18 | Passed; see plan SUMMARY |
| 07-06-03 | 4 | JDOC-03 / SC6 | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --retired && npm run check` | T-07-18, T-07-19 | Passed; see plan SUMMARY |

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

- [x] Add isolated headless runner/fixtures with exact-floor version checks.
- [x] Add startup emission positive controls and persistence-enabled slash-only coverage.
- [x] Add checks that execute the guide's real snippets, including missing outcomes.
- [x] User approved the narrow corpus exception in CONTEXT.md D-14.
- [x] Record exact refusal-only additions and prove preservation of all 3,149 old samples.
- [x] Planner assigns every task a concrete command, threat ref, and wave.

## Manual-Only Verifications

Review guide completeness/readability, exact selected refusal wording, bounded
AGENTS/backlog changes, and the two allowed catalog prose corrections. Preserve
all catalog fenced examples and the 260-state / 39,143-byte fixture locks.
CONTEXT.md D-14 authorizes only new refusal samples, with an exact change ledger;
no removals, replacements, silent recapture, or test suppression are permitted.

## Validation Sign-Off

- [x] Every task has automated verification or an explicit manual reason.
- [x] No three consecutive tasks lack automated verification.
- [x] Missing test references are implemented before use.
- [x] All combined-tree and separate real-Pi gates pass.
- [x] Final strict corpus evidence is retained before tooling deletion.
- [x] Validation audit completed with all 15 task checks supported by execution evidence.

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

## Completed Validation Evidence

All six requirement IDs have executed automated coverage: MODE-03 through
browse and registered-command tests; MODE-04 through auth owner and real-Git
integration tests; TENB-03 through eight current/floor runtime cases; JDOC-01
through executable guide examples and schema-derived inventory checks;
JDOC-02 through lifecycle tests and command-run evidence; JDOC-03 through
bounded diffs, immutable catalog checks, and strict corpus/retirement audits.
No missing or failing task verification remains. The documented manual prose
and descriptor-less judgments remain for phase verification; automated
coverage does not claim those judgments are approved.

Full corpus selection: 10,228 tests, 10,227 pass, zero failures, and one existing
optional pi-subagents resolver skip. That inherited coverage limitation is
recorded as TEST-07-06-01 and WINDOWS 89. It is unrelated to the new acceptance
cases; all eight new real-Pi cases executed with zero skips. The exact baseline
relation is 3,149 immutable records plus one authorized refusal. The strict
report has 3,150 present and zero extras before deletion. The merged-tree audit
independently revalidated the report and concrete input hashes after deletion.

The live final log is ignored. `07-CORPUS-FINAL.json` retains its complete,
losslessly encoded report and actual exit status; `07-RETIREMENT.json` retains
the executor's post-deletion full gate. The parent ran its own full gate.
After retirement, use `07-corpus-audit.mjs --retired`; historical commands
above are the commands actually executed before the three tools were removed.

**Approval:** Automated validation complete on 2026-10-10. Human phase
judgments remain pending; no skipped behavior or dependency advisory is waived.

## Validation Audit 2026-10-10

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Post-review verification

WR-01 added the executable guide to both check selectors in `0dffe6c1`.
Fresh full capture, strict zero-extra comparison, both real-Pi runtimes,
retirement audit, and `npm run check` all passed after the correction.
See `07-REVIEW-FIXES.md` and the refreshed durable evidence. Human judgments
and pre-existing deferred items retain their prior disposition.
