---
phase: 01-staging-warning-channels
audited: 2026-10-28
status: secured
asvs_level: 1
block_on: high
threats_total: 19
threats_closed: 19
threats_open: 0
threats_open_nonblocking: 0
accepted_risks: 6
unregistered_flags: 0
source_commit: 67a589aa043092978351de71ce641e138539fead
audit_head: 395bd627328a9672489a6523586af09e6f389ab4
---

# Phase 1 Security Audit

The integrated Phase 11 implementation satisfies all 13 Phase 1 mitigation
requirements, including the cascade-rendering amendment authorized by D-PL1-25.
The auditor verified the six persisted accepted-risk entries against their
original PLAN dispositions on 2026-10-28. All 19 threats are closed:
13 through verified mitigations and six through documented accepted risks.
No blocking or non-blocking threats remain open.

Security configuration was absent from the supplied context and project
configuration. The audit used the documented defaults: ASVS level 1 and
`block_on: high`.

The register contains **19 unique threats**. T-01-SC appears in all eight plans
and is counted once. There are no `transfer` dispositions.

## Threat Verification

Implementation paths below are relative to
`extensions/pi-claude-marketplace/`. Bare PLAN, SUMMARY, CONTEXT and SECURITY
filenames are relative to this phase directory. Other paths are relative
to the repository root.

| Threat ID | Category | Severity | Disposition | Status | Evidence |
|---|---|---|---|---|---|
| T-01-01 | Information disclosure | medium | mitigate | CLOSED | `orchestrators/plugin/staging-diagnostics.ts:126` maps every warning line through `redactAbsolutePaths` before `notifyDiagnostic`. `test/orchestrators/plugin/staging-diagnostics.test.ts:22` asserts exact redacted JSON/RPC payloads. `features/plugin/staging-warnings.feature:14` asserts duplicate-agent paths render as basenames. |
| T-01-02 | Information disclosure | low | mitigate | CLOSED | `bridges/agents/stage.ts:153` tags index corruption and conversion messages as hygiene, and duplicate discovery messages as discovery. `bridges/mcp/stage.ts:595` tags MCP warnings as hygiene. `orchestrators/plugin/install-outcome.ts:1054` partitions into discovery and bridge warnings; cleanup leaks use `hygieneWarning` at lines 1224, 1270, 1314 and 1492. `test/orchestrators/plugin/install-outcome.test.ts:2097` asserts both exact warning arrays. |
| T-01-03 | Information disclosure | low | accept | CLOSED - documented accepted risk | Existing acceptance: `01-01-PLAN.md:292`. `shared/notification-dispatch.ts:354` routes diagnostics through `resolveRawSurface`; `shared/notification-resolve.ts:697` redacts credentials in both header and lines. `test/orchestrators/plugin/staging-diagnostics.test.ts:22` asserts `Bearer ***` in JSON and RPC. See accepted-risk log. |
| T-01-04 | Information disclosure | low | mitigate | CLOSED | `orchestrators/plugin/staging-diagnostics.ts:107` requires `readonly DiscoveryWarning[]`; its standalone list renderer selects `.discovery` at line 51. `test/orchestrators/plugin/staging-diagnostics.test.ts:204` pins the type rejection, and line 273 asserts that hygiene-only standalone input emits nothing. |
| T-01-05 | Tampering | medium | mitigate | CLOSED | `bridges/agents/stage.ts:318` matches forced foreign replacements by generated name **and target path**, retaining other rows. `assertAgentCommitTargets` invokes containment at line 351; every replaced target passes `assertPathInside` at line 380 before removal at line 433. Tests at `test/bridges/agents/stage.test.ts:1596`, `:1681` and `:1815` cover hand-named preservation, differing target paths, and containment refusal without deletion. |
| T-01-06 | Denial of service | low | accept | CLOSED - documented accepted risk | Existing acceptance: `01-03-PLAN.md:132`. The documented kept-row conflict behavior remains in `bridges/agents/stage.ts:306`; the occupied-target check at line 355 throws before removal. See accepted-risk log. |
| T-01-07 | Repudiation | low | accept | CLOSED - documented accepted risk | Existing acceptance: `01-04-PLAN.md:224`. `orchestrators/plugin/update-swap.ts:1731` catches completion-cache drop failures and debug-logs them. `orchestrators/plugin/reinstall-flow.ts:452` performs data-directory maintenance without a second cache drop. `test/orchestrators/plugin/reinstall-flow.test.ts:3021` covers a failed drop. See accepted-risk log. |
| T-01-08 | Tampering | low | accept | CLOSED - documented accepted risk | Existing acceptance: `01-04-PLAN.md:225`. `orchestrators/plugin/update-swap.ts:1625` derives the field; `orchestrators/plugin/reinstall-record.ts:101` carries it into the reinstall result. No reinstall renderer or control-flow consumer reads this field. Tests at `test/orchestrators/plugin/update-swap.test.ts:1944` and `test/orchestrators/plugin/reinstall-record.test.ts:579` cover both boolean values. See accepted-risk log. |
| T-01-09 | Information disclosure | medium | mitigate | CLOSED | `orchestrators/plugin/enable-disable.ts:2933` renders through `surfaceStagingDiagnostics`, which selects discovery warnings and reaches path and credential redaction. `test/orchestrators/plugin/enable-disable.test.ts:9321` asserts the exact redacted line; `features/plugin/staging-warnings.feature:52` covers the command. |
| T-01-10 | Information disclosure | low | mitigate | CLOSED | `orchestrators/plugin/enable-disable.ts:1125` records root staging warnings; line 2307 copies that root-only value into the sink. `test/orchestrators/plugin/enable-disable.test.ts:9440` gives the dependency colliding skills and asserts the complete output contains no diagnostic for it. |
| T-01-11 | Repudiation | low | mitigate | CLOSED | `orchestrators/plugin/enable-disable.ts:2293` returns the failed result before copying root warnings at line 2307. The renderer rejects every outcome other than `fresh` at line 2929. `test/orchestrators/plugin/enable-disable.test.ts:9392` asserts no diagnostic after a config-write failure rolls back the root. |
| T-01-12 | Information disclosure | medium | mitigate | CLOSED | Standalone failure diagnostics use `surfaceStagingDiagnostics`: install at `orchestrators/plugin/install-flow-results.ts:641`, update abort at `orchestrators/plugin/update-flow.ts:750`, and reinstall through `orchestrators/plugin/reinstall-flow.ts:635`. The common renderer selects discovery warnings and redacts paths. Failure scenarios begin at `features/plugin/staging-warnings.feature:65` and assert redacted install/update/reinstall diagnostics. |
| T-01-13 | Spoofing | low | mitigate | CLOSED | `orchestrators/plugin/install-flow-results.ts:688` routes dependency failures to `handleCascadeThrow`; that function emits the cascade without staging diagnostics. The standalone root diagnostic is after the orchestrated early return at line 613. `test/orchestrators/plugin/install-flow-ledger.test.ts:1499` asserts the entire dependency-failure output contains no diagnostic under the root. |
| T-01-14 | Information disclosure | low | mitigate | CLOSED | Fresh `CandidateReport` objects are created per direct-update target at `orchestrators/plugin/update-flow.ts:448`, per cascade call at `:844`, per reinstall at `orchestrators/plugin/reinstall-flow.ts:286`, and per post-settlement swap at `orchestrators/plugin/materialize-latest.ts:228`. `test/orchestrators/plugin/update-flow.test.ts:11667` gives both targets warnings and asserts only the failed target's diagnostic renders after abort. |
| T-01-15 | Information disclosure | medium | mitigate | CLOSED under D-PL1-25 | D-PL1-25 supersedes the original discovery-only cascade requirement. `orchestrators/plugin/staging-diagnostics.ts:67` partitions both channels; line 126 redacts every line before emission. Marketplace rendering calls this at `orchestrators/marketplace/update.messaging.ts:213`, and apply at `orchestrators/reconcile/apply.ts:2427`. `test/orchestrators/plugin/staging-diagnostics.test.ts:423` asserts hygiene-path redaction. Scenarios at `features/plugin/staging-warnings.feature:122` and `:171` assert both channels under one header. |
| T-01-16 | Denial of service | low | accept | CLOSED - documented accepted risk | Existing acceptance: `01-07-PLAN.md:202`, amended for both channels by D-PL1-25. `orchestrators/plugin/staging-diagnostics.ts:72` emits one diagnostic per supplied plugin entry. Tests at `test/orchestrators/plugin/staging-diagnostics.test.ts:298` pin entry order and one combined diagnostic. See accepted-risk log. |
| T-01-17 | Repudiation | medium | mitigate | CLOSED | The former `saveRootClosure` responsibility is now `saveInstallDependencyPlanClosure`; `orchestrators/plugin/install-flow-dependency-ledger.ts:584` forwards notices. `dependency-settle.ts:227` accumulates them and preserves them on success/failure; `materialize-latest.ts:182` places settlement notices first; `update-flow.ts:615` renders updated and failed outcomes. `shared/notification-types.ts:1300` restricts file notices to kind, scope and fixed filename. `features/plugin/staging-warnings.feature:203` asserts the exact comments-dropped payload. |
| T-01-18 | Repudiation | medium | mitigate | CLOSED | `package.json:86` chains required checks with `&&`, preserving failure status. The owner reported `npm run check` exit 0 at source commit `67a589aa043092978351de71ce641e138539fead`, Node `v26.12.1`: 1120 scenarios, 11411 steps, 309 direct LCOV records. The audit verified unchanged build inputs against that commit; see audit trail. |
| T-01-SC | Tampering | high | accept | CLOSED - documented accepted risk | Existing acceptance: all eight plans, first at `01-01-PLAN.md:293`. Phase 1 adds warning-channel and lifecycle-reporting behavior without adding a package dependency. This acceptance is scoped to Phase 1; it does not waive the separate Phase 9 package-install threat model. See accepted-risk log. |

## Accepted Risks

These entries preserve the plans' existing `accept` dispositions. They introduce
no new risk acceptance.

| Threat ID | Severity | Accepted risk and rationale | Acceptance source |
|---|---|---|---|
| T-01-03 | low | Warning text can contain credentials. Phase 1 retains the existing diagnostic output boundary, which redacts header and line credentials before transport. The phase introduces no new output channel. | `01-01-PLAN.md:292`; credential-redaction implementation and exact JSON/RPC assertions cited above. |
| T-01-06 | low | A retained hand-named agents-index row can occupy a newly generated target and prevent commit. Refusing before removal protects the user's file; manual conflict resolution is accepted. | `01-03-PLAN.md:132`; documented guard at `bridges/agents/stage.ts:306`. |
| T-01-07 | low | A completion-cache drop failure is debug-logged and can leave stale tab-completion data until a later successful refresh. It does not change the installed plugin or its authorization boundaries. | `01-04-PLAN.md:224`; D-19-01 and D-PL1-17. |
| T-01-08 | low | The reinstall outcome's `resourcesChanged` field is informational. An incorrect value does not select installed artifacts or alter reinstall rendering. This acceptance concerns the reinstall field, not unrelated fields with the same name on import/install outcomes. | `01-04-PLAN.md:225`; D-PL1-18. |
| T-01-16 | low | A cascade emits one diagnostic for each participating plugin with warnings. Output therefore grows with the plugins and warning lines involved. This visibility is intentional; D-PL1-25 extends it to hygiene warnings. | `01-07-PLAN.md:202`; D-PL1-07 and D-PL1-25. |
| T-01-SC | high | Phase 1 introduces no package dependency or package-acquisition subsystem, so no new package-legitimacy mitigation is required for its changes. This is a phase-scoped acceptance. Package-manager execution introduced by Phase 9 remains governed by that phase's threats and controls. | `01-01-PLAN.md:293`, repeated in plans 02-08. |

## T-01-15 Supersession

`01-07-PLAN.md:201` originally required cascades to suppress hygiene warnings
under D-PL1-08.

The user explicitly reversed that decision through D-PL1-25, recorded in
`01-CONTEXT.md:47` and `.planning/PROJECT.md:1473`. Cascades now render discovery
warnings followed by hygiene warnings, with one header clause per channel.
Standalone commands continue to render discovery warnings only.

The audit verified the amended mitigation in executable code: both cascade
channels pass through `redactAbsolutePaths`, then through diagnostic credential
redaction. The original suppression requirement is superseded, not silently
treated as implemented.

## Open Findings

None. The initial audit found six missing accepted-risk log entries.
The orchestrator persisted the plans' existing acceptances, and the auditor
verified all six against their cited PLAN dispositions on 2026-10-28.

Blocking open: **0**. Non-blocking open: **0**. **threats_open: 0**.

## Unregistered Flags

None. All eight summaries contain `## Threat Flags` and declare no unmapped
security surface.

D-PL1-25 maps to T-01-15 and T-01-16. The later preservation of foreign agent
rows with differing target paths strengthens T-01-05. Neither requires a new
Phase 1 threat ID.

## Audit Trail

- Read Phase 1 plans 01-08, summaries 01-08, validation, verification,
  requirements, project instructions, security-auditor bootstrap and ASVS
  guidance.
- Queried configured security-auditor skills; no additional configured skills
  were returned.
- Verified mitigation calls and their entry points with current source,
  targeted searches and CodeGraph. Inspected discriminating test assertions.
- Traced current locations after Phase 11 module splitting, including
  `staging-diagnostics.ts`, `install-flow-results.ts`, `install-flow-ledger.ts`
  and `install-flow-dependency-ledger.ts`.
- Reused the owner's same-session full gate: `npm run check`, exit 0, source
  commit `67a589aa043092978351de71ce641e138539fead`, Node `v26.12.1`, 1120
  scenarios, 11411 steps, 309 direct LCOV records.
- Verified `git diff --stat 67a589aa043092978351de71ce641e138539fead -- .
  ':(exclude,glob).planning/**/*.md'` produced no output. `git status --short`
  was empty at audit time.
- No tests were rerun; unchanged-input gate evidence was reused under the
  local-verification policy.
- The auditor modified no implementation, tests or documentation. The
  orchestrator owns report persistence.
- Final acceptance-log recheck on 2026-10-28 verified all six persisted
  entries against their original PLAN dispositions. The register contains
  19 unique threats: 13 mitigated and six documented accepted risks.
  Build inputs remain unchanged from the verified source commit.
  Final verdict: SECURED; threats_open: 0.
- Final merged-tree security re-audit on 2026-10-28 inspected A+B+C source
  commit `059a1edd` at audit head
  `8d8b136bfe88d2ee4f5f43271584d7698d978bd5`.
- Re-verified all 19 unique Phase 1 threats: 13 implementation mitigations
  and six previously accepted risks. All 19 are closed; blocking open: 0;
  non-blocking open: 0; unregistered flags: 0.
- Re-traced staging-warning tags and rendering, absolute-path and credential
  redaction, forced agent-row containment, failure and rollback routing,
  per-target candidate ownership, dependency MCP-notice propagation, output
  transports, and Phase 1 process/network boundaries across the final merged
  install, cascade, reconcile, update, staging, and presentation changes.
- D-PL10-13 formally supersedes Plan 01-03's older broad-listing literal:
  differing-target foreign rows are preserved, while every replaced owned
  target still passes containment before removal. T-01-05 remains closed.
- Reused the exact final merged `npm run check` result: exit 0, 1,142
  scenarios, 11,734 steps, and 309 direct LCOV records. Phase 1 Nyquist status
  is COMPLIANT.
- `git diff --stat 059a1edd..8d8b136b -- ':(exclude,glob).planning/**'`
  produced no output. The auditor modified no implementation, tests, planning
  records, or state; the orchestrator owns `01-SECURITY.md` persistence.
- Final merged-tree verdict: SECURED; threats_open: 0.
