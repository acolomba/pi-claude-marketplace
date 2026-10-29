---
phase: 09-plugin-package-dependencies
verified: 2026-10-29T06:45:54Z
status: passed
score: 8/8 must-haves verified
covered_files:
  - .planning/phases/09-plugin-package-dependencies/09-01-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-01-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-02-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-02-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-03-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-03-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-04-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-04-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-05-PLAN.md
  - .planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md
  - .planning/phases/09-plugin-package-dependencies/09-CONTEXT.md
  - .planning/phases/09-plugin-package-dependencies/09-PATTERNS.md
  - .planning/phases/09-plugin-package-dependencies/09-RESEARCH.md
  - .planning/phases/09-plugin-package-dependencies/09-REVIEW-DISPOSITION.md
  - .planning/phases/09-plugin-package-dependencies/09-REVIEW-FIX.md
  - .planning/phases/09-plugin-package-dependencies/09-REVIEW.md
  - .planning/phases/09-plugin-package-dependencies/09-SECURITY.md
  - .planning/phases/09-plugin-package-dependencies/09-VALIDATION.md
  - AGENTS.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/package-lockfile.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/plugin/update.feature
  - features/step_definitions/npm-registry.steps.ts
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/npm-registry.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/no-shell-out.test.ts
  - test/domain/package-lockfile.test.ts
  - test/edge/register.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/platform/package-manager.test.ts
  - test/shared/redact-absolute-paths.test.ts
  - test/shared/redact-credentials.test.ts
covered_digest: "v4:sha256:9ce6a247110bdf0d9942cf45213a7e7beeb8d2ec2e6d03e66d7455491133f5ca"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 8/8
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory: []
decision_coverage:
  honored: 25
  total: 25
  not_honored: []
---

# Phase 9: Plugin Package Dependencies Verification Report

**Phase Goal:** A plugin that ships `package.json` with a supported lockfile gets its dependencies installed as Claude Code installs them, without ever blocking the plugin.
**Verified:** 2026-10-29T06:45:54Z
**Status:** passed
**Re-verification:** Yes — final verification on the integrated Phase 1–10 tree.

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A supported lockfile runs the frozen, script-free install in a staged copy and the installed hook or MCP server can find its modules. | ✓ VERIFIED | `LOCKFILE_TABLE`, the sanitizer, `runInWorkDir`, and `moveNodeModules` form one production path. The named package-install test passed, and the real loopback-backed session-start hook scenario passed. |
| 2 | Failure, timeout, and refused lockfiles leave the plugin installed with a warning, while no lockfile stays silent. | ✓ VERIFIED | Detection and process failures become notes, never throws. Unit tests cover refusal, launch failure, non-zero exit, timeout, and silent skips; install, direct update, marketplace/autoupdate, apply, and dependency scenarios prove the visible outcomes. |
| 3 | NFR-5 and the spawn rule carry decision IDs, and the combined gate is green. | ✓ VERIFIED | AGENTS.md and PROJECT.md record D-PL9-10; PROJECT.md records D-PL9-11 and the full decision register. The architecture and ESLint chokepoints are active. Fresh `npm run check` passed: 1,144 scenarios, 11,758 steps, 309 LCOV records. |

**Roadmap score:** 3/3 criteria verified.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supported npm and bun lockfiles run the correct frozen, script-free command from a clean staged copy, then move modules atomically into the plugin root. | ✓ VERIFIED | `package-install.ts` selects a closed table, sanitizes and rewrites only package inputs, invokes the bounded runner in `sources-staging`, marks the result, and renames `node_modules`. The focused install test passed. |
| 2 | Every materializing lifecycle path reaches the package step with the correct reinstall policy. | ✓ VERIFIED | The literal install ledger orders workflows → packages → state. `materializeLatestVersion` calls `installUpdatedPackages` after either swap path, and update, reinstall, apply, enable/import cascades, and dependency moves converge on those owners. |
| 3 | An installed plugin resolves its installed dependency from a session-start hook. | ✓ VERIFIED | The focused real-Pi Cucumber scenario used the loopback registry, installed the package, started a new session, and passed as part of the 2-scenario/28-step verifier run. |
| 4 | Package failure, timeout, refusal, and launch failure never block the plugin; a package without a supported lockfile remains a silent skip. | ✓ VERIFIED | `installPluginPackages` returns `NOTHING_DONE` or a bounded note; `createPackagesPhase` records a discovery warning without throwing; `installUpdatedPackages` retains the updated partition. Focused install, silent-skip, and process-tree tests passed. |
| 5 | Dependency package diagnostics retain member identity and render exactly once across first-run/planned/nested/failed moves, direct update, marketplace/autoupdate, and apply; requester warnings remain separate. | ✓ VERIFIED | `DependencyStagingDiagnostic` carries `{plugin, scope, verb, warnings}`. `saveInstallDependencyPlanClosure`, `runDependencySteps`, `settleDependencies`, `runDependencyMove`, and `materializeLatestVersion` preserve it separately from requester `stagingWarnings`; both notification surfaces prepend it once. Named unit tests and focused direct/marketplace Cucumber scenarios passed. |
| 6 | The package-manager runner is shell-free, bounded, process-tree aware, and Unicode-safe. | ✓ VERIFIED | The runner uses `shell: false`, fixed argv, independent `StringDecoder`s, capped streams, SIGTERM/SIGKILL escalation, POSIX process groups, Windows task-tree termination, and a final deadline. The surviving-descendant regression passed. |
| 7 | Package cleanup is containment-safe, marker-owned, atomic, and synchronized against concurrent lifecycle operations. | ✓ VERIFIED | Install/removal requires extension-root containment and the regular ownership marker; replacement and removal use staging renames; disabled refresh and uninstall perform state-sensitive cleanup under their locks. The complete reviewed test scope covers rollback, retries, and competing installs. |
| 8 | Governance and quality gates prevent new spawn sites or untested package behavior. | ✓ VERIFIED | Artifacts passed 16/16, effective key links passed 12/12, decision coverage passed 25/25, validation is COMPLIANT, security is SECURED 25/25, the complete 60-file review is CLEAN 0/0/0, and the exact combined gate passed. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified).

## Required Artifacts

The automated artifact verifier passed all 16 declarations across the five plans.

| Artifact group | Expected | Status | Details |
|----------------|----------|--------|---------|
| Package runner and paired tests | Shell-free, bounded subprocess execution | ✓ VERIFIED | Substantive, wired only through the authorized seam, and behaviorally tested. |
| Package-install owner and paired tests | Trigger/refusal rules, sanitizer, staging, atomic move, notes, cleanup | ✓ VERIFIED | Substantive and wired into both install ledger and update materializer. |
| Ledger/materializer/settlement modules | All lifecycle and dependency paths | ✓ VERIFIED | Literal phase ordering and both swap/settlement arms are wired. |
| Architecture rule and ESLint config | Four child-process sites and one package-runner consumer | ✓ VERIFIED | Exact importer census and rejection tests are active. |
| Registry stand-in, support, steps, and features | Hermetic public-surface proof | ✓ VERIFIED | Loopback-only registry, exact request log, complete output and filesystem assertions. |
| Phase handoff summary | Decision and merge records | ✓ VERIFIED | D-PL9-10/11 appear in the final project constraints and decisions. |

## Key Link Verification

The automated verifier passed 11/12 declared links. The remaining plan regex is stale, but the link itself is verified in current source, so the effective result is 12/12.

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `install-outcome.ts` | `package-install.ts` | Literal packages phase between workflows and state | ✓ WIRED | `createPackagesPhase` is in the eight-phase array. |
| `package-install.ts` | `package-manager.ts` | Production runner binding | ✓ WIRED | Install and registry query bind the real spawn seam with independent limits. |
| `materialize-latest.ts` | `package-install.ts` | Both swap paths call `installUpdatedPackages` | ✓ WIRED | Plan 09-03's regex expects literal `DEFAULT_PACKAGE_INSTALL_OPS`; current code correctly uses the injected parameter whose default is that constant. |
| Dependency closure | Update outcome | Structured dependency diagnostic | ✓ WIRED | First-run, planned, nested, and failed-move arms retain member identity. |
| Update outcome | Direct and marketplace notifications | Dependency diagnostics before requester diagnostic | ✓ WIRED | Direct update and marketplace/autoupdate render the member once and keep requester warnings separate. |
| Feature steps | Loopback registry/world | Package fixtures and request windows | ✓ WIRED | Real npm is constrained to the per-scenario loopback registry. |

## Data-Flow Trace

| Data | Source | Flow | Status |
|------|--------|------|--------|
| Package inputs | Plugin `package.json` and selected lockfile | bounded read → sanitizer → rewritten staging files → runner | ✓ FLOWING |
| Installed modules | Package-manager work directory | ownership marker → atomic rename → contained plugin root | ✓ FLOWING |
| Package failure | Runner stderr/stdout/error/timeout | Unicode-safe bounded capture → discovery warning → mode-selected notification | ✓ FLOWING |
| Dependency warning | Installed/moved dependency member | closure diagnostic → settlement → update outcome → direct/marketplace renderer | ✓ FLOWING |
| Requester warning | Requester's own bridge/package staging | separate `stagingWarnings` → requester diagnostic | ✓ FLOWING |
| Cleanup decision | Current locked scope state | reference scan → containment/marker check → staging move/delete | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| First-run and planned materialization retain dependency warning identity | Two named dependency-settlement tests passed 1/1 each | ✓ PASS |
| Failed/nested move retains dependency ownership and requester separation | Named dependency-move and materializer tests passed 1/1 each | ✓ PASS |
| Direct and marketplace renderers emit the dependency diagnostic once | Named update-flow and marketplace messaging tests passed 1/1 each | ✓ PASS |
| Hook module resolution plus direct ownership through the real command | Focused Cucumber run passed 2 scenarios / 28 steps | ✓ PASS |
| Marketplace/autoupdate ownership through the real command | Focused Cucumber run passed 1 scenario / 16 steps | ✓ PASS |
| Frozen staged install, silent zero-package skip, and surviving-child cleanup | Three named tests passed 1/1 each | ✓ PASS |
| Phase 8 stop/live settlement integration | Two named background-pass tests passed 1/1 each | ✓ PASS |
| Phase 6 state-path redaction integration | Named shared-redactor test passed 1/1 | ✓ PASS |

The first focused Cucumber attempt was blocked by the execution sandbox's loopback restriction (`EPERM`). The permitted loopback runs passed; this was not a product failure.

## Full Gate

No executable input changed after source commit `741516af`; HEAD `cc9fc8d5` adds only Phase 9 planning evidence. The final owner ran exact foreground `npm run check` on Node v26.12.1 and observed exit 0:

- static checks, TypeScript, ESLint, workflow lint, Fallow, Prettier, pairing, unit, integration, and direct coverage passed;
- 1,144/1,144 Cucumber scenarios and 11,758/11,758 steps passed;
- merged direct coverage contains 309 LCOV records.

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|-------------|--------------|--------|----------|
| PKD-01 | 09-01 through 09-04 | ✓ SATISFIED | Frozen script-free install, sanitizer, staged copy, install/update/reinstall wiring, and real hook/module proof. |
| PKD-02 | 09-01 through 09-04 | ✓ SATISFIED | Failure/timeout/refusal is nonblocking and visible, no-lockfile/zero-package skips are silent, and warning ownership is exact across lifecycle paths. |
| PKD-03 | 09-01 and 09-05 | ✓ SATISFIED | D-PL9-10/11 records, NFR-5 amendment, exact spawn chokepoints, ESLint seam, and green full gate. |

No orphaned Phase 9 requirement exists.

## Decision Coverage

`check.decision-coverage-verify` reported 25/25 trackable Phase 9 decisions honored, with no unhonored decision. This includes the D-PL9-08 sanitizer reversal, D-PL9-09 supersession by D-PL9-14, install/update package policy, warning placement, process bounds, cleanup ownership, and governance records.

## Probe Execution

No Phase 9 probe is declared.

## Anti-Patterns and Test Quality

The independent scope scan found no unreferenced `TBD`, `FIXME`, or `XXX`, no skipped/todo/only requirement test, no weak placeholder implementation, and no hollow data flow. `SYNTHETIC_UPDATE_PLACEHOLDER_NAME` is an intentional named update-scheduler sentinel, not a user-visible stub. The final complete code review independently covered all 60 source/test/feature files and returned CLEAN with 0 critical, 0 warning, and 0 info findings.

Security is SECURED: 25/25 threats closed, 21 mitigated and 4 explicitly accepted, with `threats_open: 0`. Nyquist validation is COMPLIANT for all eight truths and PKD-01..03.

### Advisory (New Scope, Unevidenced)

None.

## Human Verification

None. Every state transition, ordering/cleanup invariant, member-ownership edge, user-visible diagnostic, hook-resolution path, and Phase 6/8 integration seam identified in this pass has deterministic automated evidence. The prior fix report's conservative human-review request is resolved by the subsequent complete 60-file re-review, final security audit, exact full gate, and this verifier's focused reruns.

## Gaps Summary

No gaps. Supported plugin dependencies install through a contained, sanitized, frozen and script-free path; hooks resolve them; failures remain nonblocking; silent skips stay silent; dependency warnings keep the producing member's identity and render once without absorbing requester warnings; lifecycle and cleanup paths remain convergent; and all quality/security/governance gates pass on the same integrated implementation tree.

---

_Verified: 2026-10-29T06:45:54Z_
_Verifier: gsd-verifier_
