---
phase: 112
slug: hook-runtime
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-30
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

Every row is one roadmap source-test pair and one pair-atomic task/commit. “File exists”
describes the research baseline, not completion. Each owner must be normalized and re-proved
even when its baseline status is green.

| Task ID   | Plan | Wave | Requirement | Threat Ref                   | Contract, isolation, carrier, and prerequisites                                                                                                                                                                           | Automated Command                                                                            | File Exists | Status     |
| --------- | ---- | ---- | ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------- | ---------- |
| 112-01-01 | 01   | 1    | MOD-05      | T-112-02                     | PID-table path/version/shape, malformed/stale/ENOENT/error arms, defensive copy, fresh root and cleanup; absorb PID-file-only async-rewake cases; no prerequisites.                                                       | `npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/pid-table.test.ts`         | ✅          | ❌ red     |
| 112-02-01 | 02   | 5    | MOD-05      | T-112-03, T-112-04, T-112-05 | Full async registration/exit/notification/persistence/orphan matrix, multi-child/scope isolation and reload cleanup; carrier for pruning `hooks-async-rewake`; requires 01, 03, 09, 10, 15-25, 27, 29, 30.                | `npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/registry.test.ts`          | ❌ W0       | ⬜ pending |
| 112-03-01 | 03   | 1    | MOD-05      | T-112-04                     | Zero/exact/overflow/wrap/oversized/raw-byte/UTF-8 ring behavior with a fresh buffer per case; no supplemental carrier or prerequisite.                                                                                    | `npm run test:coverage:direct -- tests/bridges/hooks/async-rewake/ring-buffer.test.ts`       | ✅          | ✅ green   |
| 112-04-01 | 04   | 6    | MOD-05      | T-112-01, T-112-04, T-112-05 | Blocking/async spawn, translator dispatch, stream/stdin/timer/cleanup; sole carrier for removing `hooks-exec` and pruning only byte-equal `hooks-translators` round trips while retaining completeness/name mapping; requires 02, 03, 09, 10, 15-24, 27, 29-31. | `node --test tests/architecture/hooks-translators.test.ts &amp;&amp; npm run test:coverage:direct -- tests/bridges/hooks/dispatch-exec.test.ts` | ✅          | ❌ red     |
| 112-05-01 | 05   | 7    | MOD-05      | T-112-06                     | Matcher/if conjunction, ordered reduction, terminal outcomes, async degradation, stale composites, tool-result split and adaptation; carrier for removing `hooks-reducer`; requires 04, 06, 08, 13, 25.                   | `npm run test:coverage:direct -- tests/bridges/hooks/dispatch.test.ts`                       | ❌ W0       | ⬜ pending |
| 112-06-01 | 06   | 5    | MOD-05      | T-112-06                     | Complete adapter outcome matrix, object guards, mutation whitelist, optional-key absence, SessionStart provenance and diagnostics; carrier for removing `hooks-adapters`; requires 08 and 25.                             | `npm run test:coverage:direct -- tests/bridges/hooks/event-adapters.test.ts`                 | ❌ W0       | ⬜ pending |
| 112-07-01 | 07   | 9    | MOD-05      | T-112-02, T-112-03, T-112-05 | Cache/read/rebuild/hydration/registration/reload/orphan sequencing, exactly 11 registrations and lifecycle cleanup; carrier for removing SessionStart supplemental and pruning `hooks-dispatch`; requires 02, 05, 25, 26. | `npm run test:coverage:direct -- tests/bridges/hooks/event-router.test.ts`                   | ✅          | ❌ red     |
| 112-08-01 | 08   | 1    | MOD-05      | —                            | Module-scope positive/negative evidence for all result arms and permission values plus runtime `assertNever`; no shared state or carrier; no prerequisites.                                                               | `npm run test:coverage:direct -- tests/bridges/hooks/exec-result.test.ts`                    | ❌ W0       | ⬜ pending |
| 112-09-01 | 09   | 1    | MOD-05      | T-112-04                     | Exact fake-time deadlines, value partitions, exit/cancel races, `unref`, exact clears and no timer leaks; current test-context timers only; no prerequisites.                                                             | `npm run test:coverage:direct -- tests/bridges/hooks/exec-timer.test.ts`                     | ✅          | ✅ green   |
| 112-10-01 | 10   | 1    | MOD-05      | T-112-05                     | Exact env precedence, contained paths, SessionStart env file, remote-key absence and inherited keys; capture and restore property existence/value per case; requires 25 types only.                                       | `npm run test:coverage:direct -- tests/bridges/hooks/hook-env.test.ts`                       | ❌ W0       | ⬜ pending |
| 112-11-01 | 11   | 2    | MOD-05      | T-112-01                     | Quote-aware Bash parsing, separators, substitution, wrappers, recursion/fail-open, dedupe and glob specificity with fresh inputs; absorb Bash rows from `hooks-if-field`; requires 12.                                    | `npm run test:coverage:direct -- tests/bridges/hooks/if-field/bash.test.ts`                  | ❌ W0       | ⬜ pending |
| 112-12-01 | 12   | 1    | MOD-05      | T-112-02                     | Tokenization, command/path boundaries, anchor precedence, containment, globstar and compiled metadata with complete literals; leaf evidence later absorbed from `hooks-if-field`; no prerequisites.                       | `npm run test:coverage:direct -- tests/bridges/hooks/if-field/glob.test.ts`                  | ❌ W0       | ⬜ pending |
| 112-13-01 | 13   | 3    | MOD-05      | T-112-01, T-112-02           | Exact predicate type/re-export, compile/evaluate matrix, path membership/cwd fallback and MCP arms; carrier for pruning `hooks-if-field`; requires 11 and 12.                                                             | `npm run test:coverage:direct -- tests/bridges/hooks/if-field/index.test.ts`                 | ❌ W0       | ⬜ pending |
| 112-14-01 | 14   | 10   | MOD-05      | —                            | Binding identity for exactly seven runtime exports and type-negative internal absence without widening the barrel; no mutable state or supplemental carrier; requires 07 and 28.                                          | `npm run test:coverage:direct -- tests/bridges/hooks/index.test.ts`                          | ❌ W0       | ⬜ pending |
| 112-15-01 | 15   | 1    | MOD-05      | —                            | Complete PostCompact five-key envelope, exact discriminator/trigger, no unexpected keys and typed event; remove duplicate translator bytes only under the designated architecture carrier.                                | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-compact.test.ts`          | ✅          | ✅ green   |
| 112-16-01 | 16   | 1    | MOD-05      | T-112-06                     | Complete PostToolUseFailure seven-key envelope, tool mapping and nested identity with no unexpected keys; malformed input stays in 04; no prerequisites.                                                                  | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-tool-use-failure.test.ts` | ✅          | ✅ green   |
| 112-17-01 | 17   | 1    | MOD-05      | T-112-06                     | Complete PostToolUse seven-key envelope, tool mapping and nested identity with no unexpected keys; malformed input stays in 04; no prerequisites.                                                                         | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/post-tool-use.test.ts`         | ✅          | ✅ green   |
| 112-18-01 | 18   | 1    | MOD-05      | —                            | Complete PreCompact five-key envelope, exact discriminator/trigger and no unexpected keys using a complete typed input; no supplemental carrier or prerequisites.                                                         | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/pre-compact.test.ts`           | ✅          | ✅ green   |
| 112-19-01 | 19   | 1    | MOD-05      | T-112-06                     | Complete PreToolUse six-key envelope, built-in/custom tool mapping, nested identity and no unexpected keys; malformed input stays in 04; no prerequisites.                                                                | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/pre-tool-use.test.ts`          | ✅          | ✅ green   |
| 112-20-01 | 20   | 1    | MOD-05      | T-112-05                     | Complete SessionEnd five-key envelope and verbatim reason/context with no unexpected keys and independent expectation; no prerequisites.                                                                                  | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-end.test.ts`           | ✅          | ✅ green   |
| 112-21-01 | 21   | 1    | MOD-05      | T-112-05                     | Complete SessionStart five-key envelope and verbatim source/context with no unexpected keys; additional-context behavior stays in 06/07; no prerequisites.                                                                | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/session-start.test.ts`         | ✅          | ✅ green   |
| 112-22-01 | 22   | 1    | MOD-05      | T-112-06                     | Complete StopFailure envelope, true optional omission, classifier/status/stop-reason precedence and type negatives; routing/decision discard stays in 26; no prerequisites.                                               | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/stop-failure.test.ts`          | ✅          | ✅ green   |
| 112-23-01 | 23   | 1    | MOD-05      | T-112-05                     | Complete Stop six-key envelope, text/active pass-through, no unexpected keys and synthetic-event type evidence; re-entry stays in 26; no prerequisites.                                                                   | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/stop.test.ts`                  | ✅          | ✅ green   |
| 112-24-01 | 24   | 1    | MOD-05      | —                            | Complete UserPromptSubmit five-key envelope, empty/non-ASCII raw prompt and no unexpected keys; malformed input stays in 04; no prerequisites.                                                                            | `npm run test:coverage:direct -- tests/bridges/hooks/payloads/user-prompt-submit.test.ts`    | ✅          | ✅ green   |
| 112-25-01 | 25   | 4    | MOD-05      | T-112-05                     | Directly prove every public epoch/pending/cache/bucket/reset verb with case-owned lifecycle cleanup and no cell export; absorb routing-state supplemental cases; requires 13.                                             | `npm run test:coverage:direct -- tests/bridges/hooks/routing-state.test.ts`                  | ✅          | ❌ red     |
| 112-26-01 | 26   | 8    | MOD-05      | T-112-05                     | Full cache/stop-reason matrix; every matching observer in order; noop/block/mutate/stop discard with no effects or short-circuit; re-entry/cap/input-reset/send-failure and full cleanup through public outcomes, not hidden readers; requires 05, 22, 23, 25. | `npm run test:coverage:direct -- tests/bridges/hooks/settle.test.ts`                         | ✅          | ❌ red     |
| 112-27-01 | 27   | 1    | MOD-05      | T-112-01                     | Args-present/absent spawn planning and complete UTF-8 serialization cap/marker/wrap/no-mutation matrix; absorb helper assertions from exec suites; requires 25 type input only.                                           | `npm run test:coverage:direct -- tests/bridges/hooks/spawn-helpers.test.ts`                  | ❌ W0       | ⬜ pending |
| 112-28-01 | 28   | 1    | MOD-05      | T-112-02                     | Real-FS directory/symlink/containment/atomic-write/remove matrix, portable independent `realpath` normalization, and deterministic restored Node-FS boundary mock for unreadable/I/O branches; sole carrier for removing `symlink-escape`; no prerequisites. | `npm run test:coverage:direct -- tests/bridges/hooks/stage.test.ts`                          | ✅          | ❌ red     |
| 112-29-01 | 29   | 1    | MOD-05      | T-112-04                     | Configured/invalid/default timeout partitions, exact per-event/background defaults and diagnostics, with no upper clamp assertion here; no mutable timer state or prerequisites.                                          | `npm run test:coverage:direct -- tests/bridges/hooks/timeout.test.ts`                        | ✅          | ✅ green   |
| 112-30-01 | 30   | 1    | MOD-05      | T-112-05                     | Exact session/transcript/cwd snapshot, empty file fallback, readonly/type negatives and barrel non-export using a complete typed context; no prerequisites.                                                               | `npm run test:coverage:direct -- tests/bridges/hooks/translation-context.test.ts`            | ✅          | ✅ green   |
| 112-31-01 | 31   | 1    | MOD-05      | T-112-06                     | Complete exit/parse/root/top-level/nested/mutation/suppression/wrong-type/noop precedence matrix with semantic diagnostics; no shared state; imports existing 08 result type.                                             | `npm run test:coverage:direct -- tests/bridges/hooks/wire-protocol.test.ts`                  | ✅          | ❌ red     |

_Status: ⬜ pending · ✅ green baseline · ❌ red baseline · ❌ W0 missing owner_

---

## Wave 0 Requirements

- [ ] Create missing owners 02, 05, 06, 08, 10, 11, 12, 13, 14, and 27 in their own pair plans.
- [ ] Close measured direct-coverage gaps in 01, 04, 07, 25, 26, 28, and 31 in their own pair plans.
- [ ] Normalize all 21 existing owners, including the 14 green baselines, to lowercase separate phases, complete typed inputs/expectations, public-behavior titles, and case-local cleanup.
- [ ] Assign each supplemental test file to exactly one carrier plan before parallel execution: 02 (`hooks-async-rewake`), 04 (`hooks-exec` and `hooks-translators`), 05 (`hooks-reducer`), 06 (`hooks-adapters`), 07 (`session-start-additional-context` and `hooks-dispatch`), 13 (`hooks-if-field`), and 28 (`symlink-escape`).
- [ ] Under carrier 04, prune byte-equal `hooks-translators` round trips and retain only translator completeness/shared tool-name mapping; keep lifecycle/foundation/cap-notify/schema suites and the four hook integration suites only for their documented cross-module contracts.

Existing runner, direct-coverage, correspondence, typecheck, lint, format, and integration
infrastructure covers the phase. No framework installation or generic shared fixture is needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Portable operating-system spawn proof uses a
case-owned `process.execPath` child; filesystem proof uses case-owned temporary roots; timer proof
uses test-context fake timers. No developer credentials, external service, or manual timing is
required.

---

## Validation Sign-Off

- [ ] All 31 tasks have focused owner and direct-coverage verification.
- [ ] Sampling continuity: no task commit occurs without its owner gate.
- [ ] All ten missing owners exist and all seven measured coverage gaps are closed.
- [ ] Every pair reports 100% direct function, line, and branch coverage.
- [ ] Supplemental suites have one carrier and retain only genuine cross-module contracts.
- [ ] No watch-mode flags, real-time waits, credentials, shared external service, or shared mutable state.
- [ ] `npm run test:corresponding`, `npm run test:coverage:direct:all`, and `npm run check` pass.
- [ ] `nyquist_compliant: true` set in frontmatter after `$gsd-validate-phase` verifies the completed implementation.

**Approval:** pending
