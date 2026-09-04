---
phase: 113
slug: orchestrator-support-and-presenters
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-01
---

# Phase 113 — Security

> Plan-authored threat mitigations verified against the implementation and tests from `cf8dd78c` through `HEAD`.

---

## Audit Basis

- Register origin: plan-authored (`113-01-PLAN.md` through `113-35-PLAN.md`).
- Policy: OWASP ASVS Level 1; `workflow.security_block_on: high`.
- Register: 35 high-severity `mitigate` threats; no accepted or transferred risks.
- Summary threat flags: none across all 35 summaries.
- Current verification: all 35 pair-direct gates passed at 100% functions, lines, and branches; `T-113-07` and `T-113-35` passed as explicit type-only records.
- Current test evidence: all 52 changed Phase 113 orchestrator/architecture test files passed, all eight phase-scoped architecture/security carriers passed, and `npm run typecheck` passed.
- Bypass scan: no added skip, todo, coverage-ignore, `as any`, or `as unknown as` line exists in the Phase 113 test delta from `cf8dd78c` through `HEAD`.
- Evidence paths beginning with `orchestrators/`, `import/`, `marketplace/`, `plugin/`, or `reconcile/` are relative to `extensions/pi-claude-marketplace/`.

## Trust Boundaries

| Boundary                                             | Threats           | Data Crossing                                                                                                                      |
| ---------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Authentication host and collaborator boundary        | T-113-01          | Clone URL hosts, credential lookup results, Device Flow results, and redacted notifications.                                       |
| Import filesystem and settings boundary              | T-113-02–T-113-07 | Local entries, symlinks, settings JSON, plugin references, source records, diagnostics, and compile-time import shapes.            |
| Marketplace presenter and lifecycle-support boundary | T-113-08–T-113-14 | Typed outcomes, scope, reasons, failure causes, notification bytes, PATH, and installation state.                                  |
| Clone, Git, and plugin-discovery boundary            | T-113-15–T-113-21 | Remote refs, authentication bundles, temporary roots, clone/cache state, filesystem errors, and public result rows.                |
| Plugin outcome and presenter boundary                | T-113-22–T-113-29 | Install/list/reinstall/uninstall/update outcomes, degraded state, causal failures, exact reasons, and reload ownership.            |
| Reconcile planner, scope, and type boundary          | T-113-30–T-113-35 | Config/state inputs, destructive plan buckets, per-entry outcomes, pending/applied rows, scope fan-out, and closed outcome unions. |

## Threat Register

| Threat ID | Category                                               | Component                         | Severity | Disposition | Mitigation                                                                                                                                 | Status | Evidence                                                                                                                                                         |
| --------- | ------------------------------------------------------ | --------------------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-113-01  | Tampering / Information Disclosure                     | `auth-host.ts`                    | high     | mitigate    | Complete values, case-owned host memoization, exact collaborator schedules, offline fakes, redaction, and no test bypass.                  | closed | `orchestrators/auth-host.ts:48`; `tests/orchestrators/auth-host.test.ts:18`; direct gate 100%.                                                                   |
| T-113-02  | Tampering / Information Disclosure                     | `discover.ts`                     | high     | mitigate    | Contained case roots, exact filtering and symlink partitions, deterministic traversal, cleanup, and direct proof.                          | closed | `orchestrators/discover.ts:10`; `tests/orchestrators/discover.test.ts:80`; direct gate 100%.                                                                     |
| T-113-03  | Tampering / Information Disclosure                     | `execute.messaging.ts`            | high     | mitigate    | Total typed render arms, complete messages, exact bytes, omission, reason/severity ownership, and isolated probes.                         | closed | `import/execute.messaging.ts:53`; `tests/orchestrators/import/execute.messaging.test.ts:32`; direct gate 100%.                                                   |
| T-113-04  | Tampering / Information Disclosure                     | `marketplaces.ts`                 | high     | mitigate    | Plain-object/source validation, complete scoped plans, deterministic order, malformed-boundary diagnostics, and offline inputs.            | closed | `import/marketplaces.ts:98`; `tests/orchestrators/import/marketplaces.test.ts:9`; direct gate 100%.                                                              |
| T-113-05  | Tampering / Information Disclosure                     | `refs.ts`                         | high     | mitigate    | Exact reference parsing, closed diagnostics, malformed/non-boolean rejection, preserved order, and complete outputs.                       | closed | `import/refs.ts:10`; `tests/orchestrators/import/refs.test.ts:9`; direct gate 100%.                                                                              |
| T-113-06  | Tampering / Information Disclosure                     | `settings.ts`                     | high     | mitigate    | Absolute config-root gating, fresh environment/filesystem state, parse/read diagnostics, exact merge behavior, and cleanup.                | closed | `import/settings.ts:28`; `tests/orchestrators/import/settings.test.ts:54`; direct gate 100%.                                                                     |
| T-113-07  | Tampering / Information Disclosure                     | `types.ts` (import)               | high     | mitigate    | Closed diagnostic/scope/source shapes with positive inhabitants and targeted compile-time invalid-shape rejection.                         | closed | `import/types.ts:3`; positive evidence at `tests/orchestrators/import/types.test.ts:20`, negative evidence at `:280`; direct type-only gate passed.              |
| T-113-08  | Tampering / Information Disclosure                     | `add.messaging.ts`                | high     | mitigate    | Complete public outcomes, exact rows/context, fresh inputs, offline collaborators, and singular presenter ownership.                       | closed | `marketplace/add.messaging.ts:36`; `tests/orchestrators/marketplace/add.messaging.test.ts:18`; direct gate 100%.                                                 |
| T-113-09  | Tampering / Information Disclosure                     | `autoupdate.messaging.ts`         | high     | mitigate    | Total typed outcomes, exact scope/command/reason bytes, isolated messages, and no external boundary.                                       | closed | `marketplace/autoupdate.messaging.ts:44`; `tests/orchestrators/marketplace/autoupdate.messaging.test.ts:12`; direct gate 100%.                                   |
| T-113-10  | Tampering / Information Disclosure                     | `list.messaging.ts` (marketplace) | high     | mitigate    | Complete context identity, exact public rows, typed omission, and direct presenter ownership.                                              | closed | `marketplace/list.messaging.ts:22`; `tests/orchestrators/marketplace/list.messaging.test.ts:6`; direct gate 100%.                                                |
| T-113-11  | Tampering / Information Disclosure                     | `remove.messaging.ts`             | high     | mitigate    | Complete removal/partial/failure rows, exact reasons and status bytes, isolated inputs, and no false-success projection.                   | closed | `marketplace/remove.messaging.ts:33`; `tests/orchestrators/marketplace/remove.messaging.test.ts:54`; direct gate 100%.                                           |
| T-113-12  | Tampering / Information Disclosure                     | `shared.ts` (marketplace)         | high     | mitigate    | Injected Git/auth/unstage operations, fail-fast offline fakes, redaction, continuation policy, exact schedules, and cleanup.               | closed | `marketplace/shared.ts:57`; `tests/orchestrators/marketplace/shared.test.ts:348`; direct gate 100%.                                                              |
| T-113-13  | Tampering / Information Disclosure                     | update messaging (marketplace)    | high     | mitigate    | Exact typed projections/bytes, causal reason order, redacted causes, direct coverage, and the fail-closed 35-pair phase gate.              | closed | `marketplace/update.messaging.ts:50`; `tests/orchestrators/marketplace/update.messaging.test.ts:39`; all 35 direct gates and eight architecture carriers passed. |
| T-113-14  | Tampering / Information Disclosure                     | `plugin-path.ts`                  | high     | mitigate    | Exact PATH/install-state behavior, contained roots, process-property restoration, and isolated ownership.                                  | closed | `orchestrators/plugin-path.ts:35`; `tests/orchestrators/plugin-path.test.ts:137`; direct gate 100%.                                                              |
| T-113-15  | Tampering / Information Disclosure / Denial of Service | `clone-cache.ts`                  | high     | mitigate    | Contained temporary roots, bounded/injected Git schedules, auth threading, atomic promotion handling, cleanup, and exact results.          | closed | `plugin/clone-cache.ts:158`; `tests/orchestrators/plugin/clone-cache.test.ts:191`; direct gate 100% (11/11 functions, 579/579 lines, 100/100 branches).          |
| T-113-16  | Tampering / Information Disclosure / Denial of Service | `clone-gc.ts`                     | high     | mitigate    | Contained cache roots, exact retention/removal partitions, bounded filesystem schedules, error continuation, and cleanup.                  | closed | `plugin/clone-gc.ts:75`; `tests/orchestrators/plugin/clone-gc.test.ts:92`; direct gate 100%.                                                                     |
| T-113-17  | Tampering / Information Disclosure / Denial of Service | `discover-names.ts`               | high     | mitigate    | Contained discovery roots, validated/complete names, bounded traversal, deterministic results, and direct ownership.                       | closed | `plugin/discover-names.ts:25`; `tests/orchestrators/plugin/discover-names.test.ts:62`; direct gate 100%.                                                         |
| T-113-18  | Tampering / Information Disclosure / Denial of Service | `enable-disable.messaging.ts`     | high     | mitigate    | Complete typed success/failure partitions, exact status/reason rows, isolated results, and lifecycle parity.                               | closed | `plugin/enable-disable.messaging.ts:47`; `tests/orchestrators/plugin/enable-disable.messaging.test.ts:17`; direct gate 100%.                                     |
| T-113-19  | Tampering / Information Disclosure / Denial of Service | `fetch.messaging.ts`              | high     | mitigate    | Complete fetch outcome rows, exact failure/scope bytes, bounded presentation behavior, and direct ownership.                               | closed | `plugin/fetch.messaging.ts:40`; `tests/orchestrators/plugin/fetch.messaging.test.ts:11`; direct gate 100%.                                                       |
| T-113-20  | Tampering / Information Disclosure / Denial of Service | `git-source-probe.ts`             | high     | mitigate    | Offline injected Git operations, bounded ref/head schedules, exact probe/error partitions, auth isolation, and cleanup.                    | closed | `plugin/git-source-probe.ts:43`; `tests/orchestrators/plugin/git-source-probe.test.ts:87`; direct gate 100%.                                                     |
| T-113-21  | Tampering / Information Disclosure / Denial of Service | `info.messaging.ts`               | high     | mitigate    | Complete inventory-state outcomes, exact degradation/reason bytes, isolated presenter inputs, and no external calls.                       | closed | `plugin/info.messaging.ts:56`; `tests/orchestrators/plugin/info.messaging.test.ts:24`; direct gate 100%.                                                         |
| T-113-22  | Tampering / Information Disclosure                     | `install.messaging.ts`            | high     | mitigate    | Exhaustive typed install partitions, exact rows/results, compile-time invalid-shape rejection, fresh state, and reason parity.             | closed | `plugin/install.messaging.ts:74`; `tests/orchestrators/plugin/install.messaging.test.ts:21`; direct gate 100%.                                                   |
| T-113-23  | Tampering / Information Disclosure                     | `list.messaging.ts` (plugin)      | high     | mitigate    | Exhaustive inventory classifications, exact availability/degradation rows, true omission, and complete typed presentation.                 | closed | `plugin/list.messaging.ts:69`; `tests/orchestrators/plugin/list.messaging.test.ts:28`; direct gate 100%.                                                         |
| T-113-24  | Tampering / Information Disclosure                     | `plugin-state-classifier.ts`      | high     | mitigate    | Exhaustive resolver/state precedence, compile-time closed-union enforcement, complete literal matrix, and no impossible runtime arm.       | closed | `plugin/plugin-state-classifier.ts:43`; `tests/orchestrators/plugin/plugin-state-classifier.test.ts:188`; direct gate 100% and typecheck passed.                 |
| T-113-25  | Tampering / Information Disclosure                     | `reinstall.messaging.ts`          | high     | mitigate    | Exhaustive reinstall outcomes, exact per-entry causal/recovery rows, preserved order, compile-time exhaustiveness, and no forged arm.      | closed | `plugin/reinstall.messaging.ts:58`; `tests/orchestrators/plugin/reinstall.messaging.test.ts:95`; direct gate 100% and typecheck passed.                          |
| T-113-26  | Tampering / Information Disclosure                     | `shared.ts` (plugin)              | high     | mitigate    | Exact source/scope precedence, containment, immutable results, injected collaborator schedules, and conflict/adoption partitions.          | closed | `plugin/shared.ts:66`; `tests/orchestrators/plugin/shared.test.ts:246`; direct gate 100%.                                                                        |
| T-113-27  | Tampering / Information Disclosure                     | `uninstall.messaging.ts`          | high     | mitigate    | Exhaustive destructive outcomes, exact failure/reload rows, typed omission, and no false removed-state projection.                         | closed | `plugin/uninstall.messaging.ts:50`; `tests/orchestrators/plugin/uninstall.messaging.test.ts:12`; direct gate 100%.                                               |
| T-113-28  | Tampering / Information Disclosure                     | `update-row.ts`                   | high     | mitigate    | Complete update/degradation state transitions, exact reason/warning composition, typed omission, and severity fidelity.                    | closed | `plugin/update-row.ts:43`; `tests/orchestrators/plugin/update-row.test.ts:6`; direct gate 100%.                                                                  |
| T-113-29  | Tampering / Information Disclosure                     | `update.messaging.ts` (plugin)    | high     | mitigate    | Complete typed/runtime update partitions, exact causal order and omission, case-owned state, and producer-wire parity.                     | closed | `plugin/update.messaging.ts:40`; `tests/orchestrators/plugin/update.messaging.test.ts:44`; direct gate 100%; producer-wire carrier passed.                       |
| T-113-30  | Tampering / Information Disclosure                     | `apply-outcomes.ts`               | high     | mitigate    | Complete reconcile throw/outcome classification, exact order/omission, redacted invalid-block causes, and closed outcome types.            | closed | `reconcile/apply-outcomes.ts:36`; `tests/orchestrators/reconcile/apply-outcomes.test.ts:346`; direct gate 100%.                                                  |
| T-113-31  | Tampering / Information Disclosure                     | `plan.ts`                         | high     | mitigate    | Pure mutually exclusive plan buckets, exact source claims/precedence, malformed-key diagnostics, preserved order, and convergence.         | closed | `reconcile/plan.ts:409`; `tests/orchestrators/reconcile/plan.test.ts:98`; direct gate 100%; planner-purity carrier passed.                                       |
| T-113-32  | Tampering / Information Disclosure                     | `reconcile.messaging.ts`          | high     | mitigate    | Complete pending/applied partitions, exact tense/order/subject/failure fields, true omission, and stamp/projection parity.                 | closed | `reconcile/reconcile.messaging.ts:68`; `tests/orchestrators/reconcile/reconcile.messaging.test.ts:71`; direct gate 100%; notify-stamp carrier passed.            |
| T-113-33  | Tampering / Information Disclosure                     | `types.ts` (reconcile)            | high     | mitigate    | Closed plan/outcome unions, forbidden cross-arm fields, fresh non-aliased empty buckets, and positive/negative type evidence.              | closed | `reconcile/types.ts:50`; `tests/orchestrators/reconcile/types.test.ts:345`; direct gate 100% and typecheck passed.                                               |
| T-113-34  | Tampering / Information Disclosure                     | `scope-fanout.ts`                 | high     | mitigate    | Explicit roots, project-before-user fan-out, absent-record no-read behavior, exact config defaults, isolated trees, and offline operation. | closed | `orchestrators/scope-fanout.ts:24`; `tests/orchestrators/scope-fanout.test.ts:93`; direct gate 100%; no-network carrier passed.                                  |
| T-113-35  | Tampering / Information Disclosure                     | `types.ts` (root orchestrators)   | high     | mitigate    | Closed lifecycle outcome unions, positive inhabitants, targeted invalid-shape rejection, readonly contracts, and compiler exhaustiveness.  | closed | `orchestrators/types.ts:15`; positive evidence at `tests/orchestrators/types.test.ts:17`, negative evidence at `:470`; direct type-only gate passed.             |

_Status: open · closed · open — below high threshold (non-blocking)._

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By                               |
| ---------- | ------------: | -----: | ---: | ------------------------------------ |
| 2026-09-01 |            35 |     35 |    0 | Codex security verification workflow |

## Audit Findings

- No declared mitigation is missing.
- No blocking or below-threshold open threat remains.
- No unregistered summary threat flag exists.
- The narrow dead-branch simplifications in the marketplace-update, clone-cache, plugin-state-classifier, and reinstall owners do not widen input or bypass validation. Their closed unions remain compiler-enforced by `noImplicitReturns`, and their current direct gates and global typecheck pass.

## Sign-Off

- [x] All threats have a disposition.
- [x] Accepted risks are documented (none).
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-09-01
