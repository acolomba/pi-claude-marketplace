---
phase: "05"
slug: mode-selected-json-sink
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-06"
---

# Phase 5 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | node:test, node:assert/strict, strong-mock |
| Config | package.json and skills/local-verification/SKILL.md |
| Quick command | `node --test tests/shared/notification-dispatch.test.ts` |
| Full suite | `npm run check` |
| Runtime | Measure during execution; full direct coverage is the long gate |

## Sampling Rate

- During each task, run the changed module's owner test. Use a named case
  where a lifecycle owner is slow; run its whole pair before task completion.
- Before commit, run the required fixers-only pre-commit command; the commit
  hook owns staged-input checks. Do not duplicate it immediately beforehand.
- After every combined wave and at phase close, run `npm run check`.
- After transport migrations, run `node scripts/notify-corpus.mjs check` and
  require 3149 baseline entries present, zero extras. Check catalog equality
  with `git diff --exit-code 26cb0056 -- docs/output-catalog.md`.
- Reuse a gate only within this session for unchanged verified inputs, under
  the local-verification policy. Record Node version, commit, and exit status.

## Per-Task Verification Map

Task IDs are phase-qualified plan.task names. Each plan supplies the complete command and its observable fails_when predicate. Owner direct-coverage commands are required for all changed production pairs; the full gate also covers them.

| Task ID | Requirements | Threat Ref | Automated verification | Fails when | Status |
|---|---|---|---|---|---|
| 05-01.1 | MODE-01, MODE-02, JOUT-01, TENB-01, TENB-02 | T-05-01, 02, 04 | node --test tests/shared/errors.test.ts tests/platform/pi-api.test.ts tests/shared/notification-run.test.ts tests/shared/notification-dispatch.test.ts tests/edge/register.test.ts tests/edge/handlers/tools.test.ts tests/architecture/presentation-sink.test.ts | Root mutation, live selection, full payload, retained capture failure, or fake contract assertion fails | passed: 593 tests; direct coverage 100%; commit ccb25e51 |
| 05-01.2 | JOUT-01 | T-05-03 | 05-01.2 exact ESLint.lintText planting command; npm run lint | Any call form lacks JOUT-01 report; NFR-5 control fails; clean source reports ownership violation | passed: eight append controls, retained NFR-5 control, 274 production configurations; commit 414984c6 |
| 05-02.1 | JOUT-01, MODE-01, TENB-02 | T-05-05 | node --test tests/edge/router.test.ts tests/edge/handlers/shared.test.ts tests/edge/handlers/plugin/*.test.ts tests/edge/handlers/marketplace/*.test.ts tests/shared/notification-dispatch.test.ts | Any usage branch loses its run, emits text in machine mode, or changes an existing assertion | passed: 905 focused tests including architecture; final direct coverage 100%; commit f1930ffb |
| 05-02.2 | MODE-01, JOUT-01, TENB-02 | T-05-06 | node --test tests/shared/notification-dispatch.test.ts tests/edge/router.test.ts | Live mode, duplicate count/order, or snapshot-count assertion fails | passed: 286 tests; ordered mixed entries, adjacent duplicates, live getter and original snapshot; commit 25398caa |
| 05-03.1 | JOUT-01, MODE-01, TENB-01 | T-05-07 | node --test tests/orchestrators/import/execute.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/notification-dispatch.test.ts | A diagnostic producer misses capture, bypasses redaction, or changes completed state | pending execution |
| 05-03.2 | JOUT-01, TENB-01 | T-05-08 | node --test tests/shared/notification-dispatch.test.ts tests/orchestrators/reconcile/apply.test.ts | Empty/no-op, duplicate ordering, or retained invalid-middle assertion fails | pending execution |
| 05-04.1 | JOUT-01, MODE-01, TENB-01 | T-05-09, 10 | node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-constraint-gate.test.ts tests/integration/auth-e2e.test.ts | Any auth carrier loses parent run or stored-only paths acquire a prompt | pending execution |
| 05-04.2 | JOUT-01, MODE-01, TENB-01 | T-05-11 | node --test tests/orchestrators/auth-host.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts | Delayed mode read, exact two-field prompt, or whole-payload secret protection fails | pending execution |
| 05-05.1 | MODE-02, JOUT-01, JOUT-05, TENB-01 | T-05-12, 13, 15 | node --test tests/index.test.ts tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/debug-log.test.ts | Unknown-mode writes occur, stale callback rejects, or independent discovery/PATH work disappears | pending execution |
| 05-05.2 | MODE-02, JOUT-05 | T-05-14 | node --test tests/bridges/hooks/event-router.test.ts tests/index.test.ts | Factory creates fresh directories, unsupported session dispatches, or cleanup is skipped | pending execution |
| 05-06.1 | JOUT-01, JOUT-05, MODE-02, TENB-01 | T-05-16, 17 | node --test tests/bridges/hooks/async-rewake/registry.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-async-rewake.test.ts | Stale callback escapes, terminal cleanup fails, old generation emits, or independent valid exit-2 handling stops | pending execution |
| 05-06.2 | JOUT-01, JOUT-05, MODE-02, TENB-01 | T-05-18 | node --test tests/bridges/hooks/settle.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts | Failure escapes, recorded cap resets/repeats, or existing reentry behavior changes | pending execution |
| 05-07.1 | All six | T-05-19 | node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-producer-wire-coverage.test.ts tests/architecture/no-credential-leak.test.ts | Tuple set is not bijective, raw kind missing, schema/UI proof fails, or pins drift | pending execution |
| 05-07.2 | All six | T-05-20 | npm run check; strict corpus wrapper from PLAN; git diff --exit-code 26cb0056 -- docs/output-catalog.md; schema diff; repeat 05-01.2 planting | Any gate fails, corpus differs from exactly 3149/0, or evidence does not match the current combined inputs | pending execution |

T-05-SC is reserved in every plan: no installs are planned. For all seven waves, npm run check is the combined-tree gate. A command exit, timeout, missing expected assertion/report, or altered corpus/catalog is a failure, never a partial passing verdict. The strict corpus wrapper in each PLAN checks both exit status and the exact 3149 present/0 extra result; the tool's exit alone is insufficient.

A-05-01 and A-05-02 remain flagged unclassified assumptions. P-05-01 and P-05-02 remain descriptorless/unverified prohibitions. Their current statuses are recorded in 05-PROBES.md; passing tests do not automatically resolve them.

### Observed plan 05-01 evidence

- Node `v26.10.0`, isolated branch `agent-p05-01-1791308673`.
- Both task commits passed `npm run check:commit` with hooks enabled.
- `npm run check` passed at `414984c60202b4f78629b0378c489cd728ff96c2`, including all direct pairs (264 LCOV records).
- Corpus command exited 0: exactly 3149 baseline entries present, 0 extra; the strict missing/extra/count assertions passed. The initial piped reader aborted natively; the successful rerun saved the complete report and applied the same assertions through file-backed stdin.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed with no output.
- Corpus test run: 8629 passed, zero failed, one existing optional pi-subagents resolver case skipped because that module was unavailable. No skip was added by this plan.
- Later tasks, assumptions, prohibitions, and phase-wide sign-off remain pending.

### Observed plan 05-02 evidence

- Node `v26.10.0`, isolated branch `agent-p05-02-1791368841`.
- Task commits `f1930ffb` and `25398caa` passed their required `npm run check:commit` hooks.
- `npm run check` exited 0 at `25398caab19fea506f9a0edcb9e5d61f42da2499`, including all direct pairs (264 LCOV records).
- `node scripts/notify-corpus.mjs check` exited 0 into a regular log. Independent missing/extra and exact-count assertions passed: 3149 baseline entries present, 0 extra.
- Corpus run: 8824 tests, 8823 passed, zero failed, one existing optional resolver test skipped. No skip was added.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed without output.
- The parent approved the second internal raw delivery site and its exact formatter-provenance assertion; the protected two UI calls and existing controls remain enforced.
- Task 1's retained TAP evidence was classified `RED_EVIDENCE_OK`. Green production and tests were committed together under the explicit hook policy; Task 2 was test-only.
- Later plan rows and phase-wide sign-off remain pending.

Tests must prove live mode selection on the same run, exclusive JSON/RPC
entry delivery, unsupported plain-string rejection before mutation, empty
no-ops, and contained stale getters/throwing sinks. Lifecycle tests also prove
that independent discovery and cleanup complete. The JSON capture helper
retains invalid-payload failures for an explicit final assertion, so lifecycle
catches cannot hide them. All fake contexts supply a required mode.

## Wave 0 Requirements

No dependency installation or standalone scaffolding wave is needed. New
mode-validator owner tests and JSON capture support land with their first
real callers. Add explicit mode/sink members alongside the required contracts.
No permanent lint-rule self-test or copied-tree negative-control harness.

## Manual-Only Verifications

All six requirement behaviors have automated verification. Any prohibition
judgment generated by the planner must remain explicitly unverified until
the workflow obtains the required assessment; do not mark it passed here.

## Validation Sign-Off

- [x] Every final task has an automated check, observable failure, requirement, and threat mapping.
- [ ] New production modules have paired owner tests and direct coverage.
- [ ] Each wave has a combined-tree full check.
- [ ] Corpus and catalog remain unchanged.
- [ ] Transient lint violation fails and is removed.
- [ ] No watch commands or unverified persistent success markers.
- [ ] Execution evidence supports `nyquist_compliant: true`.

**Approval:** Planning map complete; execution and validation audit pending. Frontmatter remains false until actual evidence satisfies the gates.
