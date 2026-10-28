---
phase: 08-background-autoupdate
audited: "2026-10-28"
status: verified
verdict: SECURED
asvs_level: 1
block_on: high
threats_total: 21
threats_closed: 21
threats_open: 0
threats_open_nonblocking: 0
---

# Phase 08 Security Audit

## Scope and verdict

SECURED: all 15 declared mitigations are verified, and all six accepted dispositions have distinct recorded entries. SEC-08-01 / T-08-17 is closed by the distinct-name behavioral scenario, its recorded mutant failure, and the existing exact-entry owner assertion.

Audited planning HEAD: `c571a4cb69ca63e82134fc78b407e2810ccf3e08`.
Current combined implementation/test HEAD: `7a436b05daff149cacb110258051d65675b1e8b2`.
Production implementation remains unchanged from `3a8c7e1c6b9af4e0f7c1646e67da622829eb525e`.
The diff after 7a436b05 contains only planning Markdown.

The four PLAN threat registers contain 21 authored rows: 15 mitigate and six accept dispositions, with 18 distinct threat IDs. Repeated T-08-SC rows retain their plan qualification. Severity totals are one high, 11 medium, and nine low. There are no critical threats or transfer dispositions.

All 21 authored rows are closed: 15 verified mitigations and six documented accepted dispositions. Open blocking and nonblocking counts are both zero. At block_on high, threats_open is zero.

Paths below are repository-relative. Implementation evidence was read directly; passing documentation or test counts were not used as substitutes for code inspection.

## Decisions governing this audit

The follow-up decisions in 08-CONTEXT.md supersede historical PLAN and initial verification wording:

- D-PL8-02 now schedules only in TUI. RPC, JSON, and print do not arm.
- Reversed D-PL8-07 applies the official-name default at read time; explicit configuration wins. Invalid configuration turns the background pass off for that scope.
- D-PL8-21 deduplicates notice text by bare plugin name. Wire rows retain every updated installation.
- D-PL8-22 distinguishes skipped, unrun updates from autoupdate-off failures.
- D-PL8-23 aborts the active step after a foreground or non-quit shutdown wait reaches 30 seconds, then waits for the step to settle. It does not release the state boundary while the step remains active.
- D-PL8-24 propagates the abort through the git async scope. D-PL8-25 halts subsequent background steps after an abort.
- D-PL8-15 suppresses notices from stopped runtimes. Non-quit shutdown waits for the active marketplace operation to return; quit retains its explicitly recorded immediate-return behavior.
- D-PL8-17 preserves the notice for plugins already updated before an early failure. D-PL8-18 rechecks autoupdate after a yield.

## Threat verification

| Plan / Threat | Category | Severity | Disposition | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| 08-01 / T-08-01 | Tampering | high | mitigate | CLOSED | `extensions/pi-claude-marketplace/edge/register.ts:167` wraps routed command execution in runForeground; `index.ts:261` supplies the runtime's gate. `orchestrators/marketplace/background-gate.ts:64` increments the foreground count before waiting and releases it in finally; `:77` rechecks the count before marking a step active. `background-pass.ts:304` yields before plugin updates. Gate owner tests at `test/orchestrators/marketplace/background-gate.test.ts:70`, `:90`, `:121`, `:185` and pass tests at `background-pass.test.ts:437`, `:473` verify ordering and concurrent foreground commands. |
| 08-01 / T-08-02 | Elevation of privilege | medium | mitigate | CLOSED | `orchestrators/marketplace/background-pass.ts:354` creates one load-origin run; `:360` passes it to the update runner. `orchestrators/auth-host.ts:186` returns stored-credential auth for every non-command origin, before Device Flow construction. `test/orchestrators/marketplace/background-pass.test.ts:384` checks the actual load origin; `test/orchestrators/auth-host.test.ts:716` checks stored auth without notification for a registered host and load run. |
| 08-01 / T-08-03 | Repudiation | medium | mitigate | CLOSED | `orchestrators/marketplace/background-update.ts:49` implements trimmed, case-insensitive truthiness; `:54` gives FORCE precedence over both boolean opt-outs and any nonempty nonessential-traffic value. The policy is read at arm time at `:101`. Owner tests at `test/orchestrators/marketplace/background-update.test.ts:264`, `:291`, `:305` cover refusals, overrides, and read timing. Current official defaults and corrupt-config refusal are applied by `background-pass.ts:156`; tests at `background-pass.test.ts:365`, `:1235`, `:1252` cover them. |
| 08-01 / T-08-04 | Information disclosure | low | mitigate | CLOSED | `orchestrators/marketplace/background-update.ts:68` accepts digits only and rejects values above 2147483647, falling back to 600000. Timer tests at `test/orchestrators/marketplace/background-update.test.ts:219` cover the maximum, overflow, fractional, signed, exponent, whitespace, and malformed values. |
| 08-01 / T-08-05 | Information disclosure | medium | mitigate | CLOSED | `orchestrators/marketplace/background-pass.ts:100` supplies a print context whose notify target is the debug log; `:109` drops entry writes; `:193` and `:354` use those objects for reused updates. `test/orchestrators/marketplace/background-pass.test.ts:411` exercises both output paths. Only the final aggregate notice uses the real context at `background-pass.ts:380`. |
| 08-01 / T-08-06 | Denial of service | medium | mitigate | CLOSED | `orchestrators/marketplace/background-update.ts:87` catches rejection from the production async pass; `:95` catches input failures; `:119` catches shutdown failures. `test/orchestrators/marketplace/background-update.test.ts:440`, `:465`, `:487` verify stale-context, stale-event, and rejected-pass handling. `background-pass.ts:386` preserves the original pass error if its attempted notice also fails. |
| 08-01 / T-08-07 | Tampering | medium | mitigate | CLOSED | `orchestrators/marketplace/background-update.ts:115` sets stopped before clearing the timer and awaiting the active step. `background-pass.ts:186`, `:300`, `:306`, `:335` enforce stopped/halted checks. The stopped plugin wrapper retains the marketplace step until updateMarketplace returns, preventing premature shutdown completion. Tests at `test/orchestrators/marketplace/background-pass.test.ts:709`, `:1042`, `:1075`, `:1289` and scheduler tests at `background-update.test.ts:333`, `:349`, `:369`, `:390` verify the boundaries and recorded quit exception. |
| 08-01 / T-08-08 | Denial of service | low | accept | CLOSED — historical accepted risk superseded | AR-08-01 records the original acceptance and its later closure by D-PL8-23 through D-PL8-25. The current gate aborts after 30000 ms and waits for settlement: `orchestrators/marketplace/background-gate.ts:25`, `:40`. `platform/git.ts:302`, `:316`, `:359`, `:372`, `:507` propagate abort through requests, response bodies, and operation results. Gate tests at `background-gate.test.ts:300`, `:326`, `:351` and scheduler test `background-update.test.ts:369` cover the cap. |
| 08-01 / T-08-09 | Tampering | low | accept | CLOSED — accepted risk | AR-08-02; D-PL8-05 and D-06. `transaction/with-state-guard.ts:208` acquires the scope lock with retries zero and maps contention to StateLockHeldError. `orchestrators/marketplace/update.ts:684` refreshes and saves under that transaction; `:879` classifies lock refusal. `test/orchestrators/marketplace/update.test.ts:4493` verifies refusal while held and success after release. Background output remains silent and the runtime performs no retry loop. |
| 08-01 / T-08-SC | Tampering | low | accept | CLOSED — accepted risk | AR-08-03; 08-01 PLAN disposition and 08-RESEARCH.md Package Legitimacy Audit. The plan introduces no package dependency. |
| 08-02 / T-08-10 | Tampering | medium | mitigate | CLOSED | `test/e2e/_rpc.ts:190` constructs the child environment from an allowlist and copies the delay only from the explicit run environment at `:205`. `test/architecture/hermetic-git-environment.test.ts:18` plants inherited git and all five background variables; cases at `:79` compare complete expected environments. The TUI driver uses the same function at `features/lib/pi-tui.ts:167`. |
| 08-02 / T-08-11 | Repudiation | low | mitigate | CLOSED | `docs/env-vars.md:189` documents TUI-only scheduling, stored credentials, the wait behavior, precedence, official-name defaults, and unsupported upstream settings. Its opt-out table at `:209` agrees with `orchestrators/marketplace/background-update.ts:49` and `:68` and the corresponding scheduler cases. |
| 08-02 / T-08-SC | Tampering | low | accept | CLOSED — accepted risk | AR-08-04; 08-02 PLAN disposition and 08-RESEARCH.md Package Legitimacy Audit. The plan changes the existing harness and documentation without adding a package. |
| 08-03 / T-08-12 | Information disclosure | medium | mitigate | CLOSED | `shared/notification-resolve.ts:974` redacts name, marketplace, optional fromVersion, and toVersion before presentation. `test/shared/notification-resolve.test.ts:1759` plants credentials in all four fields; `test/architecture/no-credential-leak.test.ts:903` exercises the real raw-surface presentation path with credential-bearing name/version text. |
| 08-03 / T-08-13 | Information disclosure | medium | mitigate | CLOSED | `shared/notification-dispatch.ts:268` only guards the empty list and forwards the raw surface through emitLoadSurface. Wording is centralized at `shared/notification-grammar.ts:1322`; bare-name deduplication uses first-seen Set order. The presentation-sink architecture gate and `test/architecture/background-update-notice.test.ts` cover the sanctioned transport and catalog text. |
| 08-03 / T-08-14 | Tampering | low | mitigate | CLOSED | `shared/notification-dispatch.ts:273` suppresses empty lists. `shared/notification-wire.ts:854` closes plugin rows; `:870` requires needsReload true and at least one row, with additionalProperties false. `shared/notification-json.ts:245` maps each installation field explicitly. `test/shared/notification-wire.test.ts:542`, the wire-schema architecture gate, and `schema/claude-plugin.schema.json:2702` cover the wire contract. |
| 08-03 / T-08-15 | Denial of service | medium | mitigate | CLOSED | `orchestrators/marketplace/background-pass.ts:378` checks stopped before opening the real notice run. Its error path catches a secondary notice failure at `:390`; a normal-path notice rejection reaches the scheduler catch at `background-update.ts:87`. Owner cases at `test/orchestrators/marketplace/background-pass.test.ts:1183`, `:1211`, `:1332` cover silence and stale-context failures. |
| 08-03 / T-08-SC | Tampering | low | accept | CLOSED — accepted risk | AR-08-05; 08-03 PLAN disposition and 08-RESEARCH.md Package Legitimacy Audit. Notification support uses existing dependencies. |
| 08-04 / T-08-16 | Information disclosure | medium | mitigate | CLOSED | `features/lib/pi-tui.ts:160` validates the sandbox before starting the PTY process, sets its sandbox cwd, and uses the shared environment allowlist. `test/e2e/_rpc.ts:190` supplies sandbox HOME, PI_CODING_AGENT_DIR, and PI_OFFLINE; `:214` supplies --offline to both modes. `features/support/world.ts:449` registers TUI cleanup before readiness; the PTY driver terminates the process group. The feature uses local path fixtures and the run's loopback host. |
| 08-04 / T-08-17 | Repudiation | medium | mitigate | CLOSED | `features/marketplace/background-update.feature:60` updates distinct alpha/beta plugins across marketplaces and scopes, requires their combined notice, and verifies both installed versions. The original same-name scenario at `:30` retains D-PL8-21 deduplication coverage. `features/step_definitions/marketplace/background-update.steps.ts:90` waits for the combined text and `:92` compares all distinct visible notice texts. `features/lib/pi-tui.ts:105` explicitly exposes that text-only boundary; four cases in `test/architecture/pi-tui-notices.test.ts` pin it. `test/orchestrators/marketplace/background-pass.test.ts:1128` separately asserts exactly one notification entry. `08-REVIEW-FIX.md` records that a temporary per-plugin/per-marketplace production mutant passed the old scenario and failed the new one; the mutant is absent from the audited tree. |
| 08-04 / T-08-SC | Tampering | low | accept | CLOSED — accepted risk | AR-08-06; 08-04 PLAN disposition and 08-RESEARCH.md Package Legitimacy Audit. The scenario and harness require no new package. |

## Accepted risks

The original acceptance date is retained from the authored phase decisions. This audit records each accepted disposition separately on 2026-10-28. No additional acceptance is inferred.

| Entry | Authored row | Recorded authority | Disposition and current scope |
| --- | --- | --- | --- |
| AR-08-01 | 08-01 / T-08-08 | 08-01-PLAN.md accepted disposition; 08-CONTEXT.md original Known limit and review IN-04; follow-up D-PL8-23, D-PL8-24, D-PL8-25 | Historical acceptance of a stalled background git fetch holding a waiting command or runtime transition. Superseded by the implemented abort-and-settle boundary. Retained to preserve the authored register. The 30-second threshold starts cancellation; the waiter still waits for settlement. |
| AR-08-02 | 08-01 / T-08-09 | 08-CONTEXT.md D-PL8-05; D-06 retries zero | Cross-process contention fails cleanly and is not retried in the same runtime. Another process may receive lock held while this process owns the lock. Same-process background/foreground exclusion remains enforced. |
| AR-08-03 | 08-01 / T-08-SC | 08-01-PLAN.md accepted disposition; 08-RESEARCH.md Package Legitimacy Audit | No external package is installed by this plan. Existing dependency risk is unchanged. |
| AR-08-04 | 08-02 / T-08-SC | 08-02-PLAN.md accepted disposition; 08-RESEARCH.md Package Legitimacy Audit | No external package is installed by this plan. Existing dependency risk is unchanged. |
| AR-08-05 | 08-03 / T-08-SC | 08-03-PLAN.md accepted disposition; 08-RESEARCH.md Package Legitimacy Audit | No external package is installed by this plan. Existing dependency risk is unchanged. |
| AR-08-06 | 08-04 / T-08-SC | 08-04-PLAN.md accepted disposition; 08-RESEARCH.md Package Legitimacy Audit | No external package is installed by this plan. Existing dependency risk is unchanged. |

## Open findings

None.

## Closed finding: SEC-08-01 / T-08-17

Closed at `c571a4cb` after harness/test commit `7a436b05`.

The original same-name scenario could pass when an incorrect implementation emitted one identical notice per marketplace. The new alpha/beta scenario requires a combined notice and verifies both installed results. The recorded temporary production mutant passed the old scenario and failed the new one. Production code was restored before commit and matches the previously audited baseline.

The oracle is now explicitly named `backgroundUpdateNoticeTexts`. Four focused tests document its boundary: PTY screen redraws and separate identical emissions cannot be distinguished reliably from these bytes. The driver reports distinct visible texts; it does not count notification events.

The initial audit's requested identical-emission-count assertion was therefore not an appropriate PTY requirement. Aggregate visible behavior is now covered by the distinct-name scenario and its mutant result. Exact notification-entry cardinality remains covered by `test/orchestrators/marketplace/background-pass.test.ts:1128`. The original bare-name deduplication scenario remains intact.

This correction introduces no additional accepted-risk disposition.

## Unregistered flags

None. All four SUMMARY Threat Flags sections report none. The current runtime, abort, notification, and PTY surfaces inspected here map to the existing authored rows. SEC-08-01 maps to T-08-17.

## Validation evidence

The initial validation recorded 618/618 focused tests and five real-Pi scenarios with 64 steps. The SEC-08-01 fix then passed 119 focused tests, including four oracle cases, and six real-PTY/RPC feature scenarios with 83 steps, as recorded in 08-REVIEW-FIX.md.

The orchestrator reported a fresh full `npm run check` at `7a436b05daff149cacb110258051d65675b1e8b2`: 1125 scenarios, 11481 steps, and 309 merged LCOV records. No subsequent build input changed. The security auditor reused that combined-tree result, inspected the current LCOV artifact, ran the focused oracle test module successfully, and obtained a clean Fallow review against 0b5d3d5b.

The security auditor did not rerun the full gate or the temporary production mutant. The mutant result is recorded execution evidence from 08-REVIEW-FIX.md; its removal was independently confirmed by the production diff.

The current LCOV artifact was inspected:

| Owner | Lines | Functions | Branches |
| --- | --- | --- | --- |
| background-gate.ts | 96/96 | 10/10 | 18/18 |
| background-pass.ts | 399/399 | 20/20 | 64/64 |
| background-update.ts | 132/132 | 10/10 | 32/32 |

## Audit trail and sign-off

| Audit | Authored rows | Mitigations verified | Accepted rows recorded | Open blocking | Open nonblocking |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 at 0b5d3d5b, including this accepted-risk log | 21 | 14/15 | 6 | 0 | 1 |
| 2026-10-28 final recheck at c571a4cb | 21 | 15/15 | 6 | 0 | 0 |

- [x] All 21 authored rows retained, including four plan-qualified supply-chain sentinels.
- [x] Every accepted disposition has a distinct recorded entry.
- [x] Superseding runtime decisions applied to the evidence.
- [x] Implementation files remained read-only during the audit.
- [x] T-08-17 behavioral-proof gap resolved and reverified.

Approval: SECURED at `c571a4cb69ca63e82134fc78b407e2810ccf3e08`, with combined implementation/test inputs at `7a436b05daff149cacb110258051d65675b1e8b2`. All 21 authored rows are closed; threats_open is zero.
