---
phase: 09-plugin-package-dependencies
verified: 2026-10-29T13:52:46Z
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
  - AGENTS.md
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/package-lockfile.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - features/lib/npm-registry.ts
  - features/plugin/package-dependencies.feature
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/no-shell-out.test.ts
  - test/domain/package-lockfile.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/platform/package-manager.test.ts
covered_digest: "v4:sha256:99d49350cf34bc630fd7eabd2517f9c0875f3e7363c8bfb3377f1d276b90064b"
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

**Phase Goal:** A plugin that ships `package.json` and a supported lockfile installs its dependencies like Claude Code without blocking the plugin.
**Verified:** 2026-10-29T13:52:46Z
**Status:** passed
**Re-verification:** Yes — final integrated-tree refresh after later-phase convergence

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supported lockfiles drive a frozen, script-free staged dependency install whose `node_modules` is moved into the plugin root. | ✓ VERIFIED | `package-install.ts` selects the closed lockfile table, sanitizes the lockfile, writes only staged package inputs, runs the frozen command without lifecycle scripts, and moves the result. The named PKD-01 install test passed. |
| 2 | Install, update, and reinstall paths invoke package installation after materialization, and the install ledger places the package phase between workflows and state. | ✓ VERIFIED | `install-outcome.ts` orders `workflowsPhase`, `packagesPhase`, then `statePhase`; `materialize-latest.ts` calls the injected package installer after both swap paths. Owner and integration suites cover the lifecycle wiring. |
| 3 | A package installed for a plugin is resolvable by that plugin's real hook path. | ✓ VERIFIED | The Phase 9 Cucumber feature exercises the real command-to-hook resolution path; Nyquist reports 21 scenarios / 297 steps green for the focused feature evidence. |
| 4 | Install failures, timeouts, and refused lockfiles warn without blocking the plugin, while absent lockfiles and zero-package lockfiles remain silent. | ✓ VERIFIED | `createPackagesPhase` and `installUpdatedPackages` convert package failures to diagnostics, while the no-lockfile and zero-package paths return no warning. The named PKD-02 failure test and focused suite pass. |
| 5 | Dependency diagnostics retain the producing plugin's identity, render once, and remain separate from requester warnings through settlement and move paths. | ✓ VERIFIED | `dependency-settle.ts`, `dependency-move.ts`, and `materialize-latest.ts` preserve member-scoped diagnostics. Integrated owner and Cucumber coverage proves exact warning ownership and rendering. |
| 6 | Package-manager execution is shell-free, bounded, process-tree aware, and safe for Unicode paths. | ✓ VERIFIED | `package-manager.ts` uses `shell: false`, bounded execution, and process-tree timeout cleanup. The named surviving-child timeout test passed; architecture enforcement forbids shell-out regressions. |
| 7 | Package cleanup is contained, marker-owned, atomic/retry-safe, and removes only dependency trees created by the package phase. | ✓ VERIFIED | `package-install.ts` stages below the scope root, records created modules, supplies an undo that removes only those modules, and uses marker ownership for contained cleanup. Automated cleanup/rollback tests are green. |
| 8 | PKD governance and security policy are explicit and the integrated quality gates pass; T-09-08 is mitigated under its superseding decision. | ✓ VERIFIED | Decision coverage is 25/25. The current sanitizer rejects local-path lockfile content and npm receives `--git=<workDir>/git-is-disabled`; security is SECURED 25/25. Exact integrated gate: 1,145 scenarios, 11,777 steps, 309 LCOV records. |

**Score:** 8/8 truths verified (0 present, behavior-unverified)

### Roadmap Success Criteria

| # | Success criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | A supported lockfile installs dependency modules through the frozen, script-free contained path and hooks can resolve them. | ✓ VERIFIED | Truths 1-3 and focused behavioral evidence. |
| 2 | Failure, timeout, and refusal are nonblocking and visible; no-lockfile behavior is silent. | ✓ VERIFIED | Truths 4-5 and named PKD-02 behavior. |
| 3 | NFR-5/spawn decisions are recorded and the combined quality gate is green. | ✓ VERIFIED | Truths 6-8, 25/25 decision coverage, and exact integrated gate. |

### Advisory (New Scope, Unevidenced)

None.

## Required Artifacts

The artifact verifier passed all 16 declared artifacts across the five Phase 9 plans. Direct review confirmed that the key production artifacts are substantive and wired, rather than placeholders.

| Artifact group | Expected | Status | Details |
|----------------|----------|--------|---------|
| Lockfile and runner domain | Supported lockfile selection, sanitizer, bounded shell-free runner | ✓ VERIFIED | `domain/package-lockfile.ts` and `platform/package-manager.ts` are imported by the package-install path and exercised directly. |
| Package orchestration | Staging, install, move, diagnostics, cleanup, and lifecycle wiring | ✓ VERIFIED | Package phase, settlement/move, ledger, and update materializer paths are connected and covered. |
| Behavioral evidence | Real hook resolution, warning ownership, refusal, timeout, and cleanup behavior | ✓ VERIFIED | Cucumber and owner tests are current and green. |
| Governance | Decisions, architecture rule, validation, review, and security artifacts | ✓ VERIFIED | Nyquist COMPLIANT, review CLEAN, security SECURED. |

## Key Link Verification

The mechanical key-link verifier reported 11/12 links. Its sole miss is a stale Plan 09-03 regex that expects `installUpdatedPackages(DEFAULT_PACKAGE_INSTALL_OPS, ...)`. Current code intentionally injects `packageInstallOps` and calls `installUpdatedPackages(packageInstallOps, await swapPluginUpdate(...), packageTarget)` on both swap paths. Manual source and behavioral evidence therefore verify the effective link count as 12/12.

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `install-outcome.ts` | package phase | literal lifecycle phase ordering | ✓ WIRED | Packages run after workflows and before state. |
| `materialize-latest.ts` | `installUpdatedPackages` | injected package operations after both swap paths | ✓ WIRED | Current dependency-injection seam supersedes the stale plan regex. |
| `package-install.ts` | sanitizer and package runner | direct imports and invocation | ✓ WIRED | Sanitization occurs before spawn; npm git access is disabled. |
| package result | diagnostics/renderers | dependency settlement and move flow | ✓ WIRED | Member ownership and exact-once rendering are behaviorally tested. |

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces real data | Status |
|----------|------|--------|--------------------|--------|
| `package-install.ts` | package manifest and supported lockfile | materialized plugin root | Yes — validated, sanitized, and staged | ✓ FLOWING |
| `package-manager.ts` | command result, timeout, stdout/stderr | spawned package manager | Yes — bounded process result | ✓ FLOWING |
| dependency settlement/move | plugin-scoped package diagnostic | package phase result | Yes — retained through lifecycle aggregation | ✓ FLOWING |
| hook resolution feature | installed package export | moved plugin `node_modules` | Yes — resolved by the real hook path | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Supported package-lock install and move | `node --test --test-name-pattern 'installs the packages a package-lock.json lists and moves node_modules into the plugin root' test/orchestrators/plugin/package-install.test.ts` | 1 passed | ✓ PASS |
| Package failure is nonblocking and preserves plugin root | `node --test --test-name-pattern 'PKD-02: reports a failed install and leaves the plugin root as it was' test/orchestrators/plugin/package-install.test.ts` | 1 passed | ✓ PASS |
| T-09-08 local-folder lockfile refusal | `node --test --test-name-pattern 'D-PL9-08: refuses a lockfile that lists a package from a local folder and runs nothing' test/orchestrators/plugin/package-install.test.ts` | 1 passed | ✓ PASS |
| Timed-out package process tree is terminated | `node --test --test-name-pattern 'kills a surviving group after its timed-out parent closes' test/platform/package-manager.test.ts` | 1 passed | ✓ PASS |

## Integrated Gate Evidence

- Nyquist validation: **COMPLIANT**, PKD-01..03 and all 8 current truths; commit `7cad91d0`.
- Security: **SECURED**, 25/25 threats closed, 21 mitigated, 4 accepted, `threats_open: 0`; commit `7ab0b154`.
- Complete code review: **CLEAN**, 60-file scope, 0 critical / 0 warning / 0 info; commit `0cfc7e5d`.
- Exact full `npm run check`: **1,145/1,145 scenarios, 11,777/11,777 steps, 309 LCOV records**.
- Executable diff from the gate's verified implementation head `be0de0c3`: empty.

## Requirements Coverage

| Requirement | Source plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| PKD-01 | 09-01 through 09-04 | Install supported plugin dependencies and make them resolvable. | ✓ SATISFIED | Truths 1-3; named owner test and real hook-resolution feature. |
| PKD-02 | 09-01 through 09-04 | Keep dependency failures nonblocking with correct warning/silent behavior. | ✓ SATISFIED | Truths 4-5; named failure test and integrated lifecycle coverage. |
| PKD-03 | 09-01 and 09-05 | Record network/spawn policy and keep the quality gate green. | ✓ SATISFIED | Truths 6-8; decisions 25/25 and exact full gate. |

No orphaned Phase 9 requirement exists.

## Decision and Supersession Coverage

`check.decision-coverage-verify` reports 25/25 Phase 9 decisions honored. The current contract supersedes the original T-09-08 acceptance: `domain/package-lockfile.ts` now sanitizes npm/bun lockfiles, rejects local-path package sources, and npm receives a disabled-git configuration argument. Security therefore treats T-09-08 as mitigated, not accepted. The named refusal test proves the fail-closed behavior.

## Probe Execution

No Phase 9 probe is declared.

## Anti-Patterns and Test Quality

No unreferenced `TBD`, `FIXME`, or `XXX` marker, skipped/todo/only requirement test, placeholder implementation, or hollow data flow was found in the verified scope. The only `.pending` search matches are Windows test-harness promise-state fields, not disabled tests. Focused owner/architecture evidence passed 1,331/1,331 tests across 14 files; the Phase 9 feature passed 21 scenarios / 297 steps; all five direct source/test pairs retain 100% direct coverage.

## Human Verification Required

None. Every behavior-dependent truth has deterministic automated evidence.

## Gaps Summary

No gaps. PKD-01..03 and all eight current must-haves are verified on the integrated implementation tree. Supported dependency installs are contained, sanitized, frozen, script-free, lifecycle-wired, nonblocking on failure, exact in warning ownership, bounded in process execution, and cleanup-safe.

---

_Verified: 2026-10-29T13:52:46Z_
_Verifier: gsd-verifier_
