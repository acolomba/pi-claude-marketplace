---
phase: 112
slug: hook-runtime
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-30
validated: 2026-08-31
---

# Phase 112 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework**          | Node.js `node:test` on Node `v26.7.0`, `node:assert/strict`, `strong-mock@9.2.2`, and native experimental coverage                                             |
| **Config file**        | No runner config; `scripts/test-coverage-direct.mjs` owns focused mapping and coverage, and `scripts/check-corresponding-tests.mjs` owns mirror correspondence |
| **Quick run command**  | `node --test <owner-test-path>`                                                                                                                                |
| **Pair gate command**  | `npm run test:coverage:direct -- <owner-test-path>`; requires 100% functions, lines, and branches for the paired source                                        |
| **Full suite command** | `npm run test:corresponding && npm run test:coverage:direct:all && npm run check`                                                                              |
| **Estimated runtime**  | Owner run: usually <10 seconds; full phase gates: ~3 minutes                                                                                                   |

---

## Sampling Rate

- **During every task:** Run `node --test <owner-test-path>` after each coherent case group.
- **Before every pair commit:** Run `npm run test:coverage:direct -- <owner-test-path>` and require 100% functions, lines, and branches.
- **After every supplemental carrier:** Run the edited supplemental suite plus every prerequisite owner that absorbed one of its cases.
- **After every plan wave:** Run every owner completed in that wave, `npm run typecheck`, and affected supplemental suites; run `npm run test:coverage:direct:all` after a shared harness or contract edit.
- **Before `$gsd-verify-work`:** `npm run test:corresponding`, `npm run test:coverage:direct:all`, and `npm run check` must all be green.
- **Max feedback latency:** 180 seconds for a full phase gate; focused owner feedback stays below 30 seconds.

---

## Threat References

| Ref      | Threat                                | Required secure behavior                                                                                                                                   |
| -------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-112-01 | Shell command injection               | Preserve args-present exec form with `shell: false`; assert exact command, arguments, and shell mode without interpolating test data into a shell command. |
| T-112-02 | Path traversal or symlink escape      | Preserve safe-name, containment, `lstat`/`realpath`, and typed refusal behavior against case-owned real trees.                                             |
| T-112-03 | PID reuse kills an unrelated process  | Require liveness plus exact Linux marker equality; soft-skip mismatch, read failure, and non-Linux platforms.                                              |
| T-112-04 | Unbounded output or hung child        | Preserve independent byte caps, listener removal, SIGTERM, five-second SIGKILL escalation, and complete cleanup.                                           |
| T-112-05 | Environment or session leakage        | Restore exact process state, preserve env precedence and optional-key absence, and reset lifecycle state per case/reload.                                  |
| T-112-06 | Hook output overwrites routing fields | Whitelist only supported mutation fields and preserve routing discriminators and tool identity.                                                            |

---

## Per-Task Verification Map

Rows are ordered by canonical owner path, then by task number. Task 1 records the
focused behavioral slice; Task 2 records the complete direct-coverage and carrier gate.
Together they cover all 62 automated tasks and all 31 canonical source-test pairs.

| Task ID   | Plan | Wave | Requirement | Automated responsibility                                           | Automated command                                                                                                                        | Status   |
| --------- | ---- | ---- | ----------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 112-01-01 | 01   | 1    | MOD-05      | Scoped PID-table write/read/unlink lifecycle                        | `node --test tests/bridges/hooks/async-rewake/pid-table.test.ts`                                                                          | ✅ green |
| 112-01-02 | 01   | 1    | MOD-05      | Malformed, stale, scoped, and filesystem-failure partitions         | `npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/pid-table.test.ts`                                                       | ✅ green |
| 112-02-01 | 02   | 5    | MOD-05      | Background child spawn-to-cleanup lifecycle                         | `node --test tests/bridges/hooks/async-rewake/registry.test.ts`                                                                           | ✅ green |
| 112-02-02 | 02   | 5    | MOD-05      | Interleavings, orphan safety, persistence, and carrier pruning      | `node --test tests/architecture/hooks-async-rewake.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/registry.test.ts` | ✅ green |
| 112-03-01 | 03   | 1    | MOD-05      | Exact fill and chronological overflow tail                          | `node --test tests/bridges/hooks/async-rewake/ring-buffer.test.ts`                                                                        | ✅ green |
| 112-03-02 | 03   | 1    | MOD-05      | Empty, zero, wrap, oversized, raw-byte, and UTF-8 partitions        | `npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/ring-buffer.test.ts`                                                     | ✅ green |
| 112-04-01 | 04   | 6    | MOD-05      | Blocking hook through a portable real-child boundary                | `node --test tests/bridges/hooks/dispatch-exec.test.ts`                                                                                   | ✅ green |
| 112-04-02 | 04   | 6    | MOD-05      | Payload, stream, terminal, stdin, timer, and delegation matrix      | `node --test tests/architecture/hooks-translators.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/dispatch-exec.test.ts` | ✅ green |
| 112-05-01 | 05   | 7    | MOD-05      | Ordered matching and mutation visibility                            | `node --test tests/bridges/hooks/dispatch.test.ts`                                                                                        | ✅ green |
| 112-05-02 | 05   | 7    | MOD-05      | Terminal, async, stale, split, and adaptation partitions            | `test ! -e tests/architecture/hooks-reducer.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/dispatch.test.ts`       | ✅ green |
| 112-06-01 | 06   | 5    | MOD-05      | Whitelisted tool-result mutation                                    | `node --test tests/bridges/hooks/event-adapters.test.ts`                                                                                  | ✅ green |
| 112-06-02 | 06   | 5    | MOD-05      | Result arms, capture lifecycle, diagnostics, and carrier removal    | `test ! -e tests/architecture/hooks-adapters.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/event-adapters.test.ts` | ✅ green |
| 112-07-01 | 07   | 9    | MOD-05      | Bridge reload from state reset to registered handlers               | `node --test tests/bridges/hooks/event-router.test.ts`                                                                                    | ✅ green |
| 112-07-02 | 07   | 9    | MOD-05      | Cache, hydration, drain, scope, defensive, and carrier partitions   | `node --test tests/architecture/hooks-dispatch.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/event-router.test.ts` | ✅ green |
| 112-08-01 | 08   | 1    | MOD-05      | Valid result and permission arms                                    | `node --test tests/bridges/hooks/exec-result.test.ts &amp;&amp; npm run typecheck`                                                         | ✅ green |
| 112-08-02 | 08   | 1    | MOD-05      | Invalid result shapes and runtime `assertNever`                     | `npm run test:coverage:direct -- tests/bridges/hooks/exec-result.test.ts`                                                                 | ✅ green |
| 112-09-01 | 09   | 1    | MOD-05      | Exact SIGTERM and SIGKILL deadlines                                 | `node --test tests/bridges/hooks/exec-timer.test.ts`                                                                                      | ✅ green |
| 112-09-02 | 09   | 1    | MOD-05      | Delay normalization, exit, cancellation, and late races             | `npm run test:coverage:direct -- tests/bridges/hooks/exec-timer.test.ts`                                                                  | ✅ green |
| 112-10-01 | 10   | 1    | MOD-05      | Exact SessionStart environment precedence                           | `node --test tests/bridges/hooks/hook-env.test.ts`                                                                                        | ✅ green |
| 112-10-02 | 10   | 1    | MOD-05      | Event absence, inherited keys, containment, and restoration         | `npm run test:coverage:direct -- tests/bridges/hooks/hook-env.test.ts`                                                                    | ✅ green |
| 112-11-01 | 11   | 2    | MOD-05      | Quoted command extraction and stable deduplication                  | `node --test tests/bridges/hooks/if-field/bash.test.ts`                                                                                   | ✅ green |
| 112-11-02 | 11   | 2    | MOD-05      | Substitution, wrappers, recursion, unmatched, xargs, and empty      | `npm run test:coverage:direct -- tests/bridges/hooks/if-field/bash.test.ts`                                                               | ✅ green |
| 112-12-01 | 12   | 1    | MOD-05      | Compiled path glob from tokens through containment match            | `node --test tests/bridges/hooks/if-field/glob.test.ts`                                                                                   | ✅ green |
| 112-12-02 | 12   | 1    | MOD-05      | Command boundaries, anchors, globstars, names, and edge inputs      | `npm run test:coverage:direct -- tests/bridges/hooks/if-field/glob.test.ts`                                                               | ✅ green |
| 112-13-01 | 13   | 3    | MOD-05      | Path-tool predicate from compile through evaluation                 | `node --test tests/bridges/hooks/if-field/index.test.ts &amp;&amp; npm run typecheck`                                                      | ✅ green |
| 112-13-02 | 13   | 3    | MOD-05      | Predicate vocabulary, fail-open, MCP, cwd, and carrier partitions   | `node --test tests/architecture/hooks-if-field.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/if-field/index.test.ts` | ✅ green |
| 112-14-01 | 14   | 10   | MOD-05      | Identity of the seven public runtime re-exports                     | `node --test tests/bridges/hooks/index.test.ts`                                                                                           | ✅ green |
| 112-14-02 | 14   | 10   | MOD-05      | Compile-negative absence of internal bindings                       | `npm run typecheck &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/index.test.ts`                                           | ✅ green |
| 112-15-01 | 15   | 1    | MOD-05      | Complete PostCompact payload                                        | `node --test tests/bridges/hooks/payloads/post-compact.test.ts`                                                                           | ✅ green |
| 112-15-02 | 15   | 1    | MOD-05      | Empty values and exact PostCompact payload                          | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-compact.test.ts`                                                        | ✅ green |
| 112-16-01 | 16   | 1    | MOD-05      | Complete built-in PostToolUseFailure envelope                       | `node --test tests/bridges/hooks/payloads/post-tool-use-failure.test.ts`                                                                  | ✅ green |
| 112-16-02 | 16   | 1    | MOD-05      | Custom-tool mapping and immutable nested values                     | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-tool-use-failure.test.ts`                                               | ✅ green |
| 112-17-01 | 17   | 1    | MOD-05      | Complete built-in PostToolUse payload                               | `node --test tests/bridges/hooks/payloads/post-tool-use.test.ts`                                                                          | ✅ green |
| 112-17-02 | 17   | 1    | MOD-05      | Custom-tool mapping and non-mutation                                | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-tool-use.test.ts`                                                       | ✅ green |
| 112-18-01 | 18   | 1    | MOD-05      | Complete PreCompact envelope                                        | `node --test tests/bridges/hooks/payloads/pre-compact.test.ts`                                                                            | ✅ green |
| 112-18-02 | 18   | 1    | MOD-05      | Accepted empty values and exact key set                             | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/pre-compact.test.ts`                                                         | ✅ green |
| 112-19-01 | 19   | 1    | MOD-05      | Complete built-in PreToolUse payload                                | `node --test tests/bridges/hooks/payloads/pre-tool-use.test.ts`                                                                           | ✅ green |
| 112-19-02 | 19   | 1    | MOD-05      | Custom tool mapping and input non-mutation                          | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/pre-tool-use.test.ts`                                                        | ✅ green |
| 112-20-01 | 20   | 1    | MOD-05      | Complete SessionEnd translation                                     | `node --test tests/bridges/hooks/payloads/session-end.test.ts`                                                                            | ✅ green |
| 112-20-02 | 20   | 1    | MOD-05      | Declared reason and empty-value partitions                          | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-end.test.ts`                                                         | ✅ green |
| 112-21-01 | 21   | 1    | MOD-05      | Complete SessionStart payload                                       | `node --test tests/bridges/hooks/payloads/session-start.test.ts`                                                                          | ✅ green |
| 112-21-02 | 21   | 1    | MOD-05      | Source and accepted empty-value branches                            | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-start.test.ts`                                                       | ✅ green |
| 112-22-01 | 22   | 1    | MOD-05      | Complete StopFailure envelopes and optional-field semantics         | `node --test tests/bridges/hooks/payloads/stop-failure.test.ts`                                                                           | ✅ green |
| 112-22-02 | 22   | 1    | MOD-05      | Classifier precedence and boundary partitions                       | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/stop-failure.test.ts`                                                        | ✅ green |
| 112-23-01 | 23   | 1    | MOD-05      | Complete active Stop payload                                        | `node --test tests/bridges/hooks/payloads/stop.test.ts`                                                                                   | ✅ green |
| 112-23-02 | 23   | 1    | MOD-05      | Inactive and empty-text partitions                                  | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/stop.test.ts`                                                               | ✅ green |
| 112-24-01 | 24   | 1    | MOD-05      | Complete UserPromptSubmit envelope                                  | `node --test tests/bridges/hooks/payloads/user-prompt-submit.test.ts`                                                                     | ✅ green |
| 112-24-02 | 24   | 1    | MOD-05      | Empty and non-ASCII prompt preservation                             | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/user-prompt-submit.test.ts`                                                  | ✅ green |
| 112-25-01 | 25   | 4    | MOD-05      | Epoch and pending-context transitions through public verbs          | `node --test tests/bridges/hooks/routing-state.test.ts`                                                                                   | ✅ green |
| 112-25-02 | 25   | 4    | MOD-05      | Parsed-cache, bucket, and composite-reset semantics                 | `npm run test:coverage:direct -- tests/bridges/hooks/routing-state.test.ts`                                                               | ✅ green |
| 112-26-01 | 26   | 8    | MOD-05      | Public observer proof replacing settle state introspection          | `node --test tests/bridges/hooks/settle.test.ts`                                                                                          | ✅ green |
| 112-26-02 | 26   | 8    | MOD-05      | Aggregation, reasons, rendering, re-entry, and failure cleanup      | `npm run test:coverage:direct -- tests/bridges/hooks/settle.test.ts`                                                                      | ✅ green |
| 112-27-01 | 27   | 1    | MOD-05      | Shell-form and exec-form spawn planning                             | `node --test tests/bridges/hooks/spawn-helpers.test.ts`                                                                                   | ✅ green |
| 112-27-02 | 27   | 1    | MOD-05      | 256 KiB UTF-8 serialization boundaries                             | `npm run test:coverage:direct -- tests/bridges/hooks/spawn-helpers.test.ts`                                                               | ✅ green |
| 112-28-01 | 28   | 1    | MOD-05      | Real-filesystem containment and unreachable-guard disposition      | `node --test tests/bridges/hooks/stage.test.ts`                                                                                           | ✅ green |
| 112-28-02 | 28   | 1    | MOD-05      | Complete stage/remove lifecycle and supplemental retirement        | `test ! -e tests/bridges/hooks/symlink-escape.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/stage.test.ts`        | ✅ green |
| 112-29-01 | 29   | 1    | MOD-05      | Declared positive timeouts and exact event defaults                 | `node --test tests/bridges/hooks/timeout.test.ts`                                                                                         | ✅ green |
| 112-29-02 | 29   | 1    | MOD-05      | Unusable values, diagnostics, and large-positive behavior          | `npm run test:coverage:direct -- tests/bridges/hooks/timeout.test.ts`                                                                     | ✅ green |
| 112-30-01 | 30   | 1    | MOD-05      | Complete context from case-owned session inputs                     | `node --test tests/bridges/hooks/translation-context.test.ts`                                                                             | ✅ green |
| 112-30-02 | 30   | 1    | MOD-05      | Empty fallback and module-scope readonly evidence                  | `npm run test:coverage:direct -- tests/bridges/hooks/translation-context.test.ts`                                                         | ✅ green |
| 112-31-01 | 31   | 1    | MOD-05      | Exit status, JSON shape, and top-level precedence                  | `node --test tests/bridges/hooks/wire-protocol.test.ts`                                                                                   | ✅ green |
| 112-31-02 | 31   | 1    | MOD-05      | Nested decisions, mutation whitelist, typing, and noop             | `npm run test:coverage:direct -- tests/bridges/hooks/wire-protocol.test.ts`                                                               | ✅ green |

_Status: all 62 automated tasks are green on the completed Phase 112 tree._

---

## Wave 0 Requirements

- [x] Create missing owners 02, 05, 06, 08, 10, 11, 12, 13, 14, and 27 in their own pair plans.
- [x] Close measured direct-coverage gaps in 01, 04, 07, 25, 26, 28, and 31 in their own pair plans.
- [x] Normalize all 21 existing owners, including the 14 green baselines, to lowercase separate phases, complete typed inputs/expectations, public-behavior titles, and case-local cleanup.
- [x] Assign each supplemental test file to exactly one carrier plan before parallel execution: 02 (`hooks-async-rewake`), 04 (`hooks-exec` and `hooks-translators`), 05 (`hooks-reducer`), 06 (`hooks-adapters`), 07 (`session-start-additional-context` and `hooks-dispatch`), 13 (`hooks-if-field`), and 28 (`symlink-escape`).
- [x] Under carrier 04, prune byte-equal `hooks-translators` round trips and retain only translator completeness/shared tool-name mapping; keep lifecycle/foundation/cap-notify/schema suites and the four hook integration suites only for their documented cross-module contracts.

Existing runner, direct-coverage, correspondence, typecheck, lint, format, and integration
infrastructure covers the phase. No framework installation or generic shared fixture is needed.

---

## Manual-Only Verifications

None. Portable operating-system spawn proof uses a case-owned `process.execPath` child;
filesystem proof uses case-owned temporary roots; timer proof uses test-context fake timers.
No developer credentials, external service, manual timing, or manual-only acceptance item is
required.

---

## Validation Sign-Off

- [x] All 62 automated tasks and all 31 canonical pairs have focused owner and direct-coverage verification.
- [x] Sampling continuity: no task commit occurred without its focused owner gate.
- [x] All ten missing owners exist and all seven measured baseline coverage gaps are closed.
- [x] Every pair reports 100% direct function, line, and branch coverage.
- [x] Supplemental suites have one carrier and retain only genuine cross-module contracts.
- [x] All runtime cases use lowercase AAA markers; presentation inventories are lowercase and alphabetized, while contractual runtime order remains unchanged.
- [x] No watch-mode flags, real-time waits, credentials, shared external service, or shared mutable state are required.
- [x] Phase-scoped correspondence, direct owner coverage, focused hook suites, and typecheck pass.
- [x] Repository-wide gate failures are explicitly classified outside Phase 112 and do not conceal a hook-runtime gap.
- [x] `nyquist_compliant: true` and `wave_0_complete: true` are set after validation of the completed implementation.

**Approval:** validated — Phase 112 is Nyquist-compliant.

---

## Validation Audit 2026-08-31

| Metric                         | Count |
| ------------------------------ | ----: |
| Automated tasks audited        | 62/62 |
| Canonical pairs audited        | 31/31 |
| Gaps found                     |     0 |
| Resolved by this audit         |     0 |
| Escalated                      |     0 |
| New tests required             |     0 |
| Manual-only items              |     0 |

| Gate or evidence                         | Observed result                                                                                                                                | Phase 112 classification |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Fresh focused owner/direct coverage      | 31/31 owners; 906/906 branches, 198/198 functions, and 6,823/6,823 lines                                                                        | PASS                     |
| Current async-rewake registry owner      | 115/115 branches, 30/30 functions, and 730/730 lines                                                                                            | PASS                     |
| Focused hook architecture and integration | 12/12 retained files; no failures, skips, or todos                                                                                              | PASS                     |
| TypeScript typecheck                     | Exit 0                                                                                                                                         | PASS                     |
| Phase-scoped correspondence              | Zero hook-runtime violations                                                                                                                    | PASS                     |
| Repository-wide correspondence           | 58 missing/unexpected entries, all assigned to future Phase 113–117 surfaces; no Phase 112 hook entry                                           | OUTSIDE PHASE 112        |
| Repository-wide direct-all               | Stops at the future `tests/edge/flag-catalog.test.ts` pair after the Phase 112 owners pass                                                       | OUTSIDE PHASE 112        |
| Repository-wide full suite               | Three unchanged failures: `tests/bridges/agents/stage.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, and `tests/orchestrators/plugin/update.test.ts` | OUTSIDE PHASE 112        |
| Test-quality audit                       | 426 runtime tests: 415 separate lowercase AAA and 11 permitted lowercase `act & assert`; zero disabled, nested, or noncanonical cases           | PASS                     |
| Code review and review fix               | Review status clean; one async no-PID lifecycle finding fixed and re-proved at current HEAD                                                     | PASS                     |

The dated audit found no uncovered Phase 112 behavior, so it created no test file and
performed no debug iteration. The old `REQUIREMENTS.md` HEAD-triage labels are brownfield
baseline data; the completed plan summaries, review, and fresh verifier evidence supersede
those labels for MOD-05 validation.
