---
phase: "05"
slug: mode-selected-json-sink
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| Runtime | Node v26.10.0; combined-tree gate passed at 5ba904966f9d76e0f83651edc6c98b7967b88e22 with 264 direct pairs |

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
| 05-03.1 | JOUT-01, MODE-01, TENB-01 | T-05-07 | node --test tests/orchestrators/import/execute.test.ts tests/orchestrators/plugin/shared.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/notification-dispatch.test.ts | A diagnostic producer misses capture, bypasses redaction, or changes completed state | passed: 1040 owner tests; final direct coverage 100%; commits 0c9e0abd, c9634f59 |
| 05-03.2 | JOUT-01, TENB-01 | T-05-08 | node --test tests/shared/notification-dispatch.test.ts tests/orchestrators/reconcile/apply.test.ts | Empty/no-op, duplicate ordering, or retained invalid-middle assertion fails | passed: 334 tests; empty, blank, ordered duplicates and retained caught failure; commit f9a80456 |
| 05-04.1 | JOUT-01, MODE-01, TENB-01 | T-05-09, 10 | node --test tests/orchestrators/auth-host.test.ts tests/orchestrators/plugin/install-clone-probe.test.ts tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-constraint-gate.test.ts tests/integration/auth-e2e.test.ts | Any auth carrier loses parent run or stored-only paths acquire a prompt | passed: 145 owner tests; 17 direct pairs at 100%; commit dbb9e985 |
| 05-04.2 | JOUT-01, MODE-01, TENB-01 | T-05-11 | node --test tests/orchestrators/auth-host.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts | Delayed mode read, exact two-field prompt, or whole-payload secret protection fails | passed: 308 tests; delayed live mode, original snapshot, memo and retained invalid capture; commit eb7ed820 |
| 05-05.1 | MODE-02, JOUT-01, JOUT-05, TENB-01 | T-05-12, 13, 15 | node --test tests/index.test.ts tests/edge/register.test.ts tests/shared/notification-dispatch.test.ts tests/shared/debug-log.test.ts | Unknown-mode writes occur, stale callback rejects, or independent discovery/PATH work disappears | passed: 476 owner tests; three direct pairs at 100%; commit 66d6e2f1 |
| 05-05.2 | MODE-02, JOUT-05 | T-05-14 | node --test tests/bridges/hooks/event-router.test.ts tests/index.test.ts | Factory creates fresh directories, unsupported session dispatches, or cleanup is skipped | passed: 73 owner tests and 77 with integration; router direct coverage 100%; commits f89156b1, c554c134 |
| 05-06.1 | JOUT-01, JOUT-05, MODE-02, TENB-01 | T-05-16, 17 | node --test tests/bridges/hooks/async-rewake/registry.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-async-rewake.test.ts | Stale callback escapes, terminal cleanup fails, old generation emits, or independent valid exit-2 handling stops | passed: 295 tests; both direct pairs 100%; commit 4520b0ea |
| 05-06.2 | JOUT-01, JOUT-05, MODE-02, TENB-01 | T-05-18 | node --test tests/bridges/hooks/settle.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/hooks-cap-notify.test.ts | Failure escapes, recorded cap resets/repeats, or existing reentry behavior changes | passed: 292 tests; both direct pairs 100%; commit fbb7b0ca |
| 05-07.1 | All six | T-05-19 | node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-producer-wire-coverage.test.ts tests/architecture/no-credential-leak.test.ts | Tuple set is not bijective, raw kind missing, schema/UI proof fails, or pins drift | passed: 70 tests; 260 catalog tuples and eight raw kinds per machine mode; commit ee1c4362 |
| 05-07.2 | All six | T-05-20 | npm run check; strict corpus wrapper from PLAN; git diff --exit-code 26cb0056 -- docs/output-catalog.md; schema diff; repeat 05-01.2 planting | Any gate fails, corpus differs from exactly 3149/0, or evidence does not match the current combined inputs | accepted: nine explicit-mode fixtures corrected in 83ebe170; 16 owner tests, full check with 264 direct pairs, strict 3149/0 corpus, catalog/schema checks passed; unchanged lint controls reused |

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

### Observed plan 05-03 evidence

- Node `v26.10.0`, isolated branch `agent-p05-03-1791371631`.
- Task commits `0c9e0abd` and `f9a80456`, plus fixture correction `c9634f59`, passed their required `npm run check:commit` hooks.
- `npm run check` exited 0 at `c9634f593bf5e5902ddd151a01e9fcf62e6d7a89`, including all direct pairs (264 LCOV records).
- All seven diagnostic owner suites passed (1040 tests) before the fixture correction; its changed pair passed through its commit hook and the final full gate. The Task 2 owner command passed 334 tests.
- The first corpus run had two extra text notifications from the new reinstall fixture's setup install. The fixture now uses the existing orchestrated install option, preserving the production behavior and all existing text cases.
- The final file-backed corpus command and strict missing/extra/count assertions passed: 3149 baseline entries present, 0 extra. Corpus run: 8850 tests, 8849 passed, zero failed, one existing optional resolver skip. No skip was added.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed without output.
- Retained Task 1 TAP evidence classified `RED_EVIDENCE_OK`; green source and tests were committed together under the explicit hook policy. Task 2 was test-only.
- The model's zero-length diagnostic lines predicate runs before resolution and transport selection. Both protected UI calls and the formatter-provenance gate remain unchanged.
- Later plan rows, assumptions, prohibitions, and phase-wide sign-off remain pending.

### Observed plan 05-04 evidence

- Node `v26.10.0`, isolated branch `agent-p05-04-1791374242`.
- Task commits `dbb9e985` and `eb7ed820` passed all required commit hooks.
- `npm run check` exited 0 at `eb7ed820b4b62c5ef6ad6dc7f6c7c053557656f7`, including all direct pairs (264 LCOV records).
- Task 1 owner command passed 145 tests. Its 17 changed source pairs passed isolated 100% line/function/branch coverage. Task 2 command passed 308 tests.
- The delayed callback reads only the emission-time `rpc` mode, retains the original sink/snapshot, performs no further inventory probes, and reuses the host memo. Whole-entry assertions exclude provider credential fields.
- AUTH-09 exact binding/declaration patterns now require the run argument. The two protected UI calls, formatter provenance controls, callback field whitelist, and stored-only update behavior remain enforced.
- Corpus subprocess and saved-log assertions passed: 3149 baseline entries present, zero extras; 8859 tests passed, zero failed, one pre-existing optional resolver skip. No skip was added.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed without output.
- Task 1 evidence classified `RED_EVIDENCE_OK`; green source and tests were committed together under the explicit hook policy. Task 2 adds test-only proof of behavior already implemented by Task 1.
- Later plans and phase-wide sign-off remain pending.

### Observed plan 05-05 evidence

- Node `v26.10.0`, isolated branch `agent-p05-05-1791376612`.
- Task commits `66d6e2f1`, `f89156b1`, and corrective commit `c554c134` passed their required commit hooks.
- `npm run check` exited 0 at `c554c134090c4e2d6699a19c6ea368dd8130f2a8`, including all direct pairs (264 LCOV records). The first full run exposed missing integration-context modes and an overly broad hydration catch; both were corrected without weakening assertions.
- Task 1 owner command passed 476 tests; all three changed source pairs reached 100% direct coverage. Task 2 owner command passed 73 tests, and the final owner-plus-integration command passed 77 tests; router direct coverage remained 100%.
- Unsupported and stale contexts preserve existing discovery, disk and environment state. JSON/RPC load warnings use the original run, retain complete captured entries, and continue independent PATH/discovery work after append refusal.
- All four supported modes prepare both eligible shared directories before dispatch. Unknown/stale modes and later mode changes suppress new work. Existing child/orphan cleanup, generation checks, per-scope containment, and 11 registrations remain verified.
- Corpus subprocess and strict saved-log assertions passed: exactly 3149 baseline entries present, zero extras. Corpus run: 8889 tests, 8888 passed, zero failed, one existing optional resolver skip. No skip was added.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed without output. Both protected UI calls and formatter-provenance controls remain intact.
- Both retained RED records classified `RED_EVIDENCE_OK`. The directory RED was re-observed against committed source using a clean fixture after the original recovery fixture proved unsuitable because its PID writers create shared directories themselves.
- Later plan rows, assumptions, prohibitions, and phase-wide sign-off remain pending.

### Observed plan 05-06 evidence

- Node `v26.10.0`, isolated branch `agent-p05-06-1791379262`.
- Task commits `4520b0ea` and `fbb7b0ca` passed all required commit hooks.
- Task 1 owner command passed 295 tests; Task 2 passed 292 tests. Both tasks' two direct pairs reached 100% line/function/branch coverage.
- Rewake tests prove complete JSON/RPC entries, exact empty suppression, whitespace preservation, terminal child/PID cleanup, stale-generation defense, stale mode/isIdle/sink containment, and independent supported exit-2 injection after append refusal.
- Stop tests prove complete warning entries, shared block/additional-context counting, seven reentries, retained eighth-attempt cap, no repeated warning after delivery failure, and rejection of unsupported/stale initial contexts. The existing executor-rejection and StopFailure contracts remain intact.
- `npm run check` exited 0 at `fbb7b0ca8fa9e9bb07f5f7be28fa015616435c6e`, including all 264 direct-coverage pairs.
- Corpus command and strict saved-log assertions passed: 3149 baseline entries, zero extras. The run passed 8911 tests, with zero failures and one pre-existing optional resolver skip.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed without output. The sink gate retains both protected UI calls and exact formatter provenance after removal of the obsolete text-only hook path.
- Both RED records returned `RED_EVIDENCE_OK`. Green tests and code were committed together under the explicit hook policy.
- Shared STATE.md and ROADMAP.md are unchanged. Plan 05-07 and phase-wide assumption/prohibition assessments remain pending.

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

## Initial plan 05-07 evidence (checkpoint resolved below)

- Runtime: Node `v26.10.0`; isolated branch `agent-p05-07-1791381783`.
- Verified clean commit: `ee1c4362a0fbda084b6066c9f27a6ad3707ad0fc`, based on
  `b9852e84db55c3f89452c751cbda5a9bfad04cc2`, which includes all six prerequisite
  plans. No untracked build inputs or dirty source/test/configuration inputs
  existed when the initial full gate ran. Changes through halted-summary
  commit `95f5eed9` were planning Markdown only. The resumed verification
  below supersedes this initial gate after the fixture correction.
- Task 05-07.1's exact owner command in the map exited 0: 70 tests, zero
  failures/skips. Its 18 new tests prove an ordered bijection for all 260
  catalog tuples in each machine mode and one entry for every raw kind in
  each mode. The four emit-driven fixtures use their public seams. Each
  catalog fixture reuses its original run snapshot; the capture replaces
  only the test run's entry sink. Strict inventory expectations remain intact.
- Every capture validates original JSON safety and schema at append time;
  `assertValid()` runs after each catalog callback and after each raw helper.
  Rejecting UI getters retain attempted UI access. Existing converter,
  invalid-fixture, whole-payload safety, credential, 260-state and 39143-byte
  assertions remain unchanged. No production or mock-pi change was needed.
- The commit hook initially rejected one import-order error. After correction,
  the fixers and `npm run check:commit` passed with hooks enabled. No amend,
  hook bypass, dependency installation, or schema regeneration occurred.
- `npm run check > /tmp/p05-07-full-check.log 2>&1` exited 0 at the verified
  commit, including static checks, unpaired architecture tests, integration
  tests, and all 264 direct-coverage pairs. This is the executor handoff
  gate on the combined prerequisite tree; the parent still owns its
  post-merge gate and independent phase verdict.
- `node scripts/notify-corpus.mjs check > /tmp/p05-07-corpus.log 2>&1` exited 0.
  A separate Node assertion read that regular log and required no lines
  starting `missing in ` or `extra in ` and the exact line
  `Notify corpus check passed: 3149 baseline entries present, 0 extra.`
  It exited 0. Corpus run: 8930 tests, 8929 passed, zero failures, one existing
  optional resolver skip. No skip or text emission was added.
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` and
  `git diff --exit-code -- schema/claude-plugin.schema.json` both exited 0
  without output. Production, ESLint configuration, mock-pi, STATE.md, and
  ROADMAP.md match the starting commit.
- The exact transient `ESLint.lintText` command from 05-01.2 exited 0 on the
  final configuration: direct, optional, and computed appendEntry calls in
  both notify-reasons.ts and dependency-closure.ts produced JOUT-01 findings;
  the planted gitOps identifier retained its NFR-5 finding. Additional clean
  lintText checks of those two files and notification-dispatch.ts returned
  no messages. Subjects existed only in memory. The full gate supplied the
  clean whole-tree lint pass. Log: `/tmp/p05-07-lint-controls.log`.

### Final source and requirement audit

CodeGraph and current call-site searches confirmed six production run
construction sites: registered command, load preparation, two read-only
LLM tools, async rewake, and Stop settle. Nested usage/diagnostic/auth calls
reuse the parent run. The sole live transport switch and appendEntry call
remain in notification-dispatch.ts, with exactly two ui.notify calls inside
deliver. The host object remains the original entry sink; contexts are not
spread or mode-cached. Command errors propagate normally. Load/session guards
precede fresh work; lifecycle catches preserve independent discovery,
cleanup, and recorded Stop-cap state. Existing owner tests exercise live
getters, receiver identity, invalid capture retention, and no-op boundaries.

| Criterion | Requirements / threats | Executed evidence | Verdict |
| --- | --- | --- | --- |
| SC1: all surfaces and exact text | JOUT-01, MODE-01; T-05-02, 05–11, 16–19 | Catalog/raw transport command; auth, diagnostic, load and hook owners in full gate; strict corpus/catalog | pass |
| SC2: live selection and before-write rejection | MODE-01, MODE-02; T-05-01, 06, 11–18 | notification-run, notification-dispatch, register, index and lifecycle owner pairs in full gate; root/caller audit | pass |
| SC3: sole append owner | JOUT-01; T-05-03 | Six transient JOUT-01 controls, retained NFR-5 control, three clean controls, full lint | pass |
| SC4: lifecycle failure containment | JOUT-05, MODE-02; T-05-12–18 | index, register, event-router, async-rewake registry, and settle owner pairs in full gate | pass |
| SC5: required explicit fake modes and retaining capture | TENB-01, TENB-02; T-05-04, 08, 19 | Initial construction audit identified nine omissions; 83ebe170 supplies all nine modes; exact source comparison preserves assertions; 16 owner tests and final full gate pass | pass; checkpoint resolved |
| SC6: empty no-ops and contained Stop-cap output | JOUT-05, JOUT-01; T-05-08, 16–18 | notification-dispatch empty/stale getter cases, registry and settle owner pairs in full gate | pass |

### Resolved owner correction: TENB-02 / SC5

The initial audit found nine contexts without mode in
`tests/bridges/hooks/if-field/index.test.ts`: the cwd-only Pick at original
line 126, cast at 143, and literals at 521, 555, 614, 637, 682, 709, 788,
and 821. This concrete fixture-contract gap caused the initial halt recorded
in `acff6d6c` and `95f5eed9`, despite passing runtime checks.

The parent explicitly extended this executor's ownership on continuation.
Commit `83ebe170d80674b344276138d1100a5e46fccbf7` adds `mode: "print"` to
all nine constructions and includes `mode` in the Pick's required keys.
An exact source comparison against `95f5eed9` proves these declarations are
the only changes; all assertions are preserved. No production behavior or
artificial RED requirement was introduced. Task 05-07.2 is now accepted.

### Resumed final verification

- Verified clean combined prerequisite head:
  `83ebe170d80674b344276138d1100a5e46fccbf7`, Node `v26.10.0`.
  The original ledger base remains
  `b9852e84db55c3f89452c751cbda5a9bfad04cc2`; Task 1 was not repeated.
- `node --test tests/bridges/hooks/if-field/index.test.ts` exited 0 with
  16 tests, zero failures/skips (`/tmp/p05-07-resume-owner.log`). The initial
  sandbox run reported only one file-level case, so it was not accepted;
  the authorized escalated rerun executed all 16 actual owner cases.
- `node_modules/.bin/fallow guard tests/bridges/hooks/if-field/index.test.ts`
  passed. `node_modules/.bin/fallow audit --base HEAD` passed against
  `95f5eed9` after authorized escalation for its temporary Git worktree.
  The usual skipped tsbuildinfo entry-point diagnostic is unchanged.
- Required `SKIP=npm-check pre-commit run --files
  tests/bridges/hooks/if-field/index.test.ts` passed. The ordinary correction
  commit passed `npm run check:commit`, including direct owner coverage;
  `/tmp/p05-07-resume-commit.log` records the successful build hook.
- `npm run check > /tmp/p05-07-resume-full-check.log 2>&1` exited 0 on the
  corrected head: static checks, unpaired tests, integration tests, and
  all 264 direct-coverage pairs passed.
- `node scripts/notify-corpus.mjs check > /tmp/p05-07-resume-corpus.log 2>&1`
  exited 0: 8929 passed, zero failed, one existing optional resolver skip.
  Separate saved-log Node assertions exited 0, requiring no `missing in `
  or `extra in ` lines and the exact success line:
  `Notify corpus check passed: 3149 baseline entries present, 0 extra.`
- `git diff --exit-code 26cb0056 -- docs/output-catalog.md` and
  `git diff --exit-code -- schema/claude-plugin.schema.json` exited 0.
- The parent authorized reuse of the initial session's transient lint
  controls. `/tmp/p05-07-lint-controls.log` retains both passing lines:
  six appendEntry controls plus the retained NFR-5 control, and three
  clean controls. `git diff --exit-code ee1c4362 -- eslint.config.js
  package.json package-lock.json tsconfig.json extensions tests/edge
  tests/architecture/catalog-uat/mock-pi.ts` exited 0. No dependency,
  installed-tool, runtime, or configuration change occurred. The ESLint
  configuration SHA-256 is
  `7ac787458a6bc065bfd3890190f43ff55ed3219ccb6100b4ebb07d671a05b3fb`.
  The new full gate also supplied the clean whole-tree lint result.
- Production, the protected two UI calls and formatter-provenance gate,
  STATE.md, and ROADMAP.md remain unchanged from the original base.
  Subsequent validation/summary changes are planning Markdown only.

A-05-01 and A-05-02 remain independently unclassified. P-05-01 and P-05-02
remain descriptorless and unverified. Their dispositions are unchanged;
none is resolved by this full test run. Phase 6/7 scope and the accepted
startup-streaming limitation remain unchanged.

## Manual-Only Verifications

All six requirement behaviors have automated verification. Any prohibition
judgment generated by the planner must remain explicitly unverified until
the workflow obtains the required assessment; do not mark it passed here.

## Validation Sign-Off

- [x] Every final task has an automated check, observable failure, requirement, and threat mapping.
- [x] New production modules have paired owner tests and direct coverage (no new modules here; all 264 pairs pass).
- [x] Each wave has a combined-tree full check.
- [x] Corpus and catalog remain unchanged.
- [x] Transient lint violation fails and is removed (in-memory subjects only).
- [x] No watch commands or unverified persistent success markers.
- [x] Execution evidence supports `nyquist_compliant: true` for automated requirement coverage.

**Approval:** All 14 tasks have executed automated checks, and all six phase
requirements have behavioral coverage. The combined-tree `npm run check` passed
at `5ba904966f9d76e0f83651edc6c98b7967b88e22` on Node `v26.10.0`, with
264 direct pairs. The strict corpus check passed with 3149 baseline entries
present and zero extras. The TENB-02 / SC5 checkpoint is resolved. This is
Nyquist sign-off for automated requirement coverage. A-05-01, A-05-02,
P-05-01, and P-05-02 still require independent final-verifier judgment.

## Validation Audit 2026-10-07

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Post-review regression gate

Independent code review found CR-01: six fresh hook-dispatch callbacks lacked
live mode validation. Commit `cd569d2aeb02f2691a636e325fc3c7976c4952c1`
closes the gap with a narrow registration guard and 70 regression cases.
The owner suite passes all 108 tests; the commit hook confirms 100% direct
coverage for the changed pair. Independent re-review is clean.

The combined-tree `npm run check` exited 0 on Node `v26.10.0` at that commit,
including all 264 direct pairs and prior-phase regression suites. Evidence:
`/tmp/json-phase5-fixed-parent-check.log`. This is the current full-gate
reference; the earlier `5ba9049` result predates this correction. The strict
corpus check also exited 0: 3149 baseline entries, zero extras, and no
missing/extra diagnostic lines (`/tmp/json-phase5-fixed-parent-corpus.log`).
The output catalog is unchanged from `26cb0056`. The four assumption/prohibition
judgments still belong to the final verifier.

## Final mutation-root correction

The final verifier found an additional MODE-02 gap in bookkeeping callbacks
and pre-guard assistant-cache consumption. Commit
`191f75e83dfa3fc26a43edaee315ce72da831ac2` fixes it with 54 new behavioral
regressions. Both owner suites pass 205 tests and both direct pairs retain
100% coverage. Independent code review verifies all 11 registered roots.

The new parent `npm run check` exited 0 on Node `v26.10.0`, including all
264 direct pairs and prior-phase suites. Strict corpus verification exited 0
with 3149 entries and zero extras or missing/extra diagnostics. Catalog and
schema diffs are empty. Current logs are
`/tmp/json-phase5-state-guard-parent-check.log` and
`/tmp/json-phase5-state-guard-parent-corpus.log`. The current verified build
reference is `191f75e8`; the earlier gate predates this correction.
