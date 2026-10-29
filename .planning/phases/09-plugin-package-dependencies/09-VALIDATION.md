---
phase: "9"
slug: "plugin-package-dependencies"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
updated: "2026-10-29"
---

# Phase 9 — Validation Strategy

> Current-tree Nyquist contract for plugin package dependencies after Phases 6, 8, and 10 converged.

---

## Test Infrastructure

| Property               | Value                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| **Framework**          | `node:test` (unit, integration, architecture); `@cucumber/cucumber` (behavioral)                       |
| **Config file**        | `package.json` scripts; `cucumber.json`                                                                |
| **Focused owner run**  | `node --test` over the 14 owner, lifecycle, integration, architecture, and redactor files listed below |
| **Behavioral run**     | `npx cucumber-js features/plugin/package-dependencies.feature --format summary`                        |
| **Direct coverage**    | `npm run --silent test:coverage:direct -- <source>`                                                    |
| **Full suite command** | `npm run check`                                                                                        |

---

## Sampling Rate

- **After every task commit:** owner test + direct coverage for the changed source/test pair; the hook runs `check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** the exact combined tree must pass `npm run check`
- **Max feedback latency:** 120 seconds for focused checks

---

## Requirement Verification Map

| Requirement | Observable contract                                                                                                                                                             | Behavioral evidence                                                                                                                                                        | Status   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| PKD-01      | A supported lockfile produces a sanitized, frozen, script-free staged install; missing, malformed, drifting, or unsupported inputs do not run a package manager                 | `test/domain/package-lockfile.test.ts`, `test/platform/package-manager.test.ts`, `test/orchestrators/plugin/package-install.test.ts`, and the package-dependencies feature | ✅ green |
| PKD-02      | Install, update, reinstall, enable, import, apply, dependency moves, marketplace updates, and autoupdate use the package phase with the specified reinstall/invalidation policy | package-install/outcome, materialize-latest, dependency-move/settle, update-preflight, uninstall, apply, notify, and background-pass owner tests plus the feature          | ✅ green |
| PKD-03      | Package execution is shell-free, bounded, process-tree aware, and reachable only through the approved spawn seams                                                               | `test/platform/package-manager.test.ts` and `test/architecture/no-shell-out.test.ts`                                                                                       | ✅ green |

## Current-Truth Coverage Matrix

| #   | Current truth                                                           | Failing behavioral oracle                                                                                                                                                                                 | Result   |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | Lockfile detection, sanitization, and frozen script-free staged install | Lockfile normalization rejects drift and unsupported forms; runner assertions require exact frozen/script-disabled arguments and isolated staging                                                         | ✅ green |
| 2   | Lifecycle wiring and reinstall policy                                   | Lifecycle owner tests exercise install/update/reinstall/enable/import/apply, revision invalidation, dependency moves, marketplace update, and autoupdate                                                  | ✅ green |
| 3   | Real hook-module resolution                                             | Package install owner and Cucumber tests load a hook module from the installed `node_modules` tree and fail when the staged dependency is absent                                                          | ✅ green |
| 4   | Failure, timeout, refusal, and no-lockfile behavior                     | Exact owner/feature assertions keep lifecycle success non-blocking, surface one bounded warning on real failure/refusal/timeout, and stay silent without a lockfile                                       | ✅ green |
| 5   | Exact-once warning placement                                            | Install/update/marketplace/autoupdate/apply/dependency-move tests assert one warning at the owning row/notice and no duplicate promotion through later renderers                                          | ✅ green |
| 6   | Bounded shell-free process-tree and Unicode runner                      | Runner tests cover verbatim argv, `shell: false`, incremental split UTF-8 decoding, output bounds, timeout, POSIX process groups, Windows `taskkill`, and fallback deadlines                              | ✅ green |
| 7   | Containment, marker, atomic synchronization, and cleanup                | Package-install/outcome, update-preflight, uninstall, apply, and dependency-move tests cover contained paths, marker ownership, locked cleanup, atomic replacement, retries, and shared-root preservation | ✅ green |
| 8   | Governance spawn seams                                                  | Architecture census fixes the approved `node:child_process` import set; package runner tests prove the production launcher is Node's injected `spawn` seam                                                | ✅ green |

---

## Integrated Regression Checks

### Phase 8 post-config abort guard

`test/orchestrators/marketplace/background-pass.test.ts` proves all sides of the dependency-settlement boundary:

- a normal cascade calls `installMissingDependencies` once under a fresh gate signal;
- runtime stop, signal abort, or autoupdate opt-out after the config read calls it zero times;
- a held scope lock skips cleanly and a later pass settles once;
- foreground cancellation reaches the active settlement and waits for the marketplace cascade to return.

The later Phase 8 guard in `yieldingPluginUpdate` stops only a plugin update whose config-read step was stopped or aborted. The distinct dependency wrapper still performs its own post-read halt, abort, and config checks. The focused owner run and its direct pair are green, so the guard neither skips a valid settlement nor duplicates one.

### Phase 6 shared diagnostic redactor

The Phase 6 additions recognize only the exact unquoted state-file and state-lock diagnostic grammars before the existing generic path handling. The shared redactor pair remains green, including URL, relative-path, Unicode, idempotence, and state-path cases. Package-install and notification tests still assert exact package diagnostics such as `E404`, `ETARGET`, launch failure, bounded stderr, and timeout. The package-dependencies feature also remains green. No package cause is hidden or rewritten beyond the existing absolute-path basename policy.

---

## Executed Evidence — 2026-10-29

| Gate                                | Command / scope                                                                                                                                                                                    | Result                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Focused owner and integration suite | `node --test` across lockfile, runner, package install/outcome, materialize, dependency move/settle, update preflight, uninstall, apply, notify, background pass, redactor, and no-shell-out files | **1,042 tests; 1,042 passed; 0 failed/skipped/todo**     |
| Phase 9 behavioral feature          | `npx cucumber-js features/plugin/package-dependencies.feature --format summary`                                                                                                                    | **20 scenarios; 281 steps; all passed**                  |
| Direct coverage                     | lockfile, package manager, package install, background pass, and shared redactor source/test pairs                                                                                                 | **5/5 pairs green at 100% direct coverage**              |
| Exact combined gate                 | `npm run check` on the same merged input tree                                                                                                                                                      | **1,143 scenarios; 11,742 steps; 309 LCOV pairs; green** |

The focused and direct runs were executed at `f81d377488a5358f2d77c09b4c2de1014650d848`. The combined-gate result is the final-integration owner's fresh reusable result for the same implementation and test inputs.

## Wave 0 Requirements

- [x] `test/platform/package-manager.test.ts`
- [x] `test/orchestrators/plugin/package-install.test.ts`
- [x] `features/lib/npm-registry.ts` (loopback npm registry stand-in)
- [x] `features/plugin/package-dependencies.feature` + step module

## Manual-Only Verifications

None. Every Phase 9 requirement and current truth has a deterministic automated behavioral oracle.

## Validation Sign-Off

- [x] PKD-01..03 have executable behavioral coverage
- [x] All eight current truths have failing-capable oracles
- [x] Phase 8 abort-guard integration is covered for call-once and call-zero boundaries
- [x] Phase 6 redactor integration preserves package diagnostic causes
- [x] No watch-mode flags
- [x] Direct coverage and the exact combined gate are green
- [x] `nyquist_compliant: true` remains justified

**Approval:** COMPLIANT on 2026-10-29; no validation gap, test addition, or implementation escalation required.

## Validation Audit 2026-10-29

| Metric                  | Count |
| ----------------------- | ----- |
| Requirements covered    | 3/3   |
| Current truths covered  | 8/8   |
| Gaps found              | 0     |
| Resolved with new tests | 0     |
| Escalated               | 0     |
