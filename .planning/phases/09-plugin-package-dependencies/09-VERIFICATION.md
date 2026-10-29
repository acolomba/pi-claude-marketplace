---
phase: 09-plugin-package-dependencies
verified: 2026-10-29T02:25:18Z
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
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/step_definitions/npm-registry.steps.ts
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/npm-registry.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/no-shell-out.test.ts
  - test/domain/package-lockfile.test.ts
  - test/edge/register.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
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
covered_digest: "v4:sha256:5f37e0223ee6fa7df746c4dadedcf943e085f4b9434b2c38c856d6515576ffb6"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory: []
decision_coverage:
  honored: null
  total: null
  not_honored: []
---

# Phase 9: Plugin Package Dependencies Verification Report

**Phase Goal:** A plugin that ships `package.json` with a supported lockfile gets its dependencies installed as Claude Code installs them, without ever blocking the plugin.
**Verified:** 2026-10-29T02:25:18Z
**Status:** passed
**Re-verification:** Yes — fresh stale-verification pass over the current implementation.

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Installing a plugin with `package.json` and a supported lockfile runs the frozen, script-free install in a staged copy, and its hook or MCP server finds its modules. | ✓ VERIFIED | `package-install.ts` selects the closed lockfile table, sanitizes and rewrites inputs into `sources-staging`, runs npm or bun with `--ignore-scripts`, and renames `node_modules` into the plugin root. The focused install test passed. The session-start hook scenario passed 1/1 scenario and 12/12 steps through real npm and the loopback registry. |
| 2 | Failure, timeout, and refused lockfiles leave the plugin installed with a warning; no lockfile remains silent. | ✓ VERIFIED | Detection and runner failures return notes rather than throws. Exact unit cases cover non-zero exits, launch failure, timeout, refusals, invalid files, and the silent no-lockfile branch. Install, update, reinstall, apply, autoupdate, and dependency-move scenarios verify visible warning placement and successful plugin lifecycle outcomes. |
| 3 | NFR-5 and the spawn rule carry decision IDs, and `npm run check` is green. | ✓ VERIFIED | AGENTS.md and PROJECT.md contain D-PL9-10. PROJECT.md contains D-PL9-11 and the Phase 9 decision register. The exact-path ESLint seam and four-import architecture rule are active. Fresh `npm run check` passed on the final executable tree: 1,131 scenarios, 11,561 steps, and 309 LCOV records. |

**Roadmap score:** 3/3 criteria verified.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Supported npm and bun lockfiles run the correct frozen, script-free command from a clean staged copy, then install modules atomically into the plugin root. | ✓ VERIFIED | `LOCKFILE_TABLE`, `checkLockfile`, `installInWorkDir`, `runInWorkDir`, and `moveNodeModules` form one wired path. The work directory receives only rewritten `package.json` and the selected lockfile. Existing modules are parked inside that work directory and restored on failure. |
| 2 | Every materializing lifecycle path reaches the package step with the correct reinstall policy. | ✓ VERIFIED | The install ledger orders `workflowsPhase`, `packagesPhase`, `statePhase`. `materializeLatestVersion` runs `installUpdatedPackages` after either swap path. Update, reinstall, convergence, apply, and dependency moves call the shared materializer. A disabled revision refresh invalidates marked old packages under the state lock before saving the new revision; enable then installs from the new lockfile. |
| 3 | An installed plugin can resolve its installed dependency from a session-start hook. | ✓ VERIFIED | The focused Cucumber scenario drove the real command, npm stand-in, installed hook, and new Pi session. It passed 1 scenario and 12 steps. |
| 4 | Package failure, timeout, refusal, or launch failure never blocks the plugin; no supported lockfile remains a silent skip. | ✓ VERIFIED | `installPluginPackages` converts detection and run failures into bounded notes. The ledger adds a discovery warning without throwing; updated outcomes retain the `updated` partition. Focused install, silent-skip, and timeout-note tests each passed. |
| 5 | Package diagnostics remain visible exactly once on install, direct update, marketplace/autoupdate, apply, and dependency moves. | ✓ VERIFIED | Discovery warnings flow through `stagingWarnings`; cascade diagnostics consume those warnings. Combined move-and-enable outcomes retain warnings and MCP notices. Dependency moves keep the package note on the dependency row while filtering that exact note from forwarded requester warnings. Behavioral scenarios compare complete payloads and rows. |
| 6 | The package-manager runner is shell-free, bounded, process-tree aware, and Unicode-safe. | ✓ VERIFIED | Spawn uses `shell: false`, fixed argv, async pipes, a 60-second install timeout, SIGTERM/SIGKILL escalation, POSIX process groups, and Windows `taskkill /T /F`. Independent `StringDecoder`s preserve split UTF-8 while retaining stream and note caps. The named surviving-descendant regression passed. |
| 7 | Package cleanup is containment-safe, marker-owned, atomic, and synchronized against concurrent lifecycle operations. | ✓ VERIFIED | Removal requires extension-root containment and a regular `.pi-claude-marketplace` marker, then moves modules into staging before deletion. Disabled refresh runs removal inside its state transaction. Uninstall takes a fresh scope lock around state reload, reference decision, and removal. The named disabled-refresh and competing-install regressions passed. |
| 8 | Governance and quality gates prevent new spawn sites or untested package behavior. | ✓ VERIFIED | Artifact checks passed 16/16. The architecture rule admits exactly four `node:child_process` importers. The ESLint exception admits only the exact package-install seam. Validation is Nyquist-compliant, security is SECURED 25/25, the final 52-file review is CLEAN 0/0/0, and the full gate passed. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified).

## Re-verification Closure

The prior report’s deferred and advisory items are now resolved:

- Marketplace and autoupdate package notes use the shared WRN-02/D-PL1-26 placement.
- ROADMAP criterion 2 now correctly distinguishes refused lockfiles from a missing lockfile.
- PROJECT.md and AGENTS.md contain the D-PL9-10 NFR-5 amendment and PROJECT.md records D-PL9-11.
- The lockfile sanitizer is implemented; D-PL9-08’s original deferral is superseded.
- Process-tree cleanup, uninstall cleanup, disabled-update package invalidation, warning ownership, and Unicode decoding now have regression tests.
- No prior behavior regressed.

## Required Artifacts

The automated artifact verifier passed all 16 declarations across the five plans.

| Artifact group | Expected | Status | Details |
|----------------|----------|--------|---------|
| `platform/package-manager.ts` and paired test | Bounded shell-free package runner | ✓ VERIFIED | Substantive, imported only by the authorized seam, direct coverage green. |
| `orchestrators/plugin/package-install.ts` and paired test | Detection, sanitizer bridge, staged install, notes, cleanup, ledger/update APIs | ✓ VERIFIED | Substantive and wired into both ledger and shared materializer. |
| Ledger and materializer modules | Install and update/reinstall lifecycle wiring | ✓ VERIFIED | Literal phase order and both swap returns verified. |
| Architecture rule, ESLint configuration, architecture tests | Four process sites and one package-runner consumer | ✓ VERIFIED | Exact-path and same-basename rejection tests are active. |
| Registry stand-in, world/support, steps, and feature | Hermetic public-surface proof | ✓ VERIFIED | Loopback-only registry, exact request log, full result/row assertions, resource release. |
| `09-05-SUMMARY.md` | Decision and merge handoff | ✓ VERIFIED | Required decision records exist and were applied to PROJECT.md/AGENTS.md. |

## Key Link Verification

The automated link verifier passed 11 of 12 declared links. The remaining link is manually verified; its plan regex is stale, not the implementation.

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `install-outcome.ts` | `package-install.ts` | `createPackagesPhase` in the literal ledger array | ✓ WIRED | `workflowsPhase`, `packagesPhase`, `statePhase` is present. |
| `package-install.ts` | `package-manager.ts` | Production runner binding | ✓ WIRED | Both install and registry-query runners bind the real spawn and bounded timeouts. |
| `materialize-latest.ts` | `package-install.ts` | Both swap returns call `installUpdatedPackages` | ✓ WIRED | The plan regex expects literal `DEFAULT_PACKAGE_INSTALL_OPS`; current code correctly takes injected `packageInstallOps = DEFAULT_PACKAGE_INSTALL_OPS` and passes that variable to both calls. |
| Update/reinstall/apply/dependency paths | `materializeLatestVersion` | Shared update runner | ✓ WIRED | Current callers converge on the shared materializer. |
| Package outcome warnings | User-visible diagnostics and rows | Staging-warning and row composition | ✓ WIRED | Direct update, cascade, apply, and dependency scenarios pin complete output. |
| Feature steps | Loopback registry/world | Package fixtures, request windows, release hooks | ✓ WIRED | Real npm requests are constrained to the scenario’s loopback registry. |

## Data-Flow Trace

| Data | Source | Flow | Status |
|------|--------|------|--------|
| Package inputs | Plugin `package.json` and selected lockfile | bounded read → sanitizer → rewritten staged files → package manager | ✓ FLOWING |
| Installed modules | Package-manager work directory | marker write → atomic rename into contained plugin root | ✓ FLOWING |
| Failure diagnostic | Child stderr/stdout/error/timeout | incremental decode → compact/cap → discovery warning → mode-selected notification | ✓ FLOWING |
| Update package note | `installUpdatedPackages` | updated outcome `stagingWarnings`/`packageNote` → direct/cascade/apply/dependency renderer | ✓ FLOWING |
| Cleanup decision | Current locked scope state | reference scan → contained marker check → staging move/delete | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Install, silent no-lockfile skip, and timeout degradation | Three named `node --test --test-name-pattern ... test/orchestrators/plugin/package-install.test.ts` runs | Each passed 1/1 | ✓ PASS |
| Process-tree escalation after the direct child closes | Named package-manager test | Passed 1/1 | ✓ PASS |
| Disabled refresh and concurrent uninstall cleanup | Named update-preflight and uninstall tests | Each passed 1/1 | ✓ PASS |
| Dependency-warning ownership and hook module resolution | Named dependency-move test plus focused Cucumber hook scenario | Unit passed 1/1; Cucumber passed 1 scenario and 12 steps | ✓ PASS |

The first sandboxed Cucumber attempt could not bind loopback (`EPERM`). The permitted loopback run passed; this was an execution-sandbox restriction, not a product failure.

## Full Gate

The current executable inputs are identical to source commit `4a7ae05e`; later commits only refreshed planning reports.

`npm run check` passed on Node v26.12.1:

- typecheck, ESLint, workflow lint, Fallow, formatting, pairing, and feature checks passed;
- unit and integration tests passed;
- 1,131/1,131 Cucumber scenarios passed;
- 11,561/11,561 Cucumber steps passed;
- direct coverage merged 309 LCOV records.

## Requirements Coverage

| Requirement | Source plans | Status | Evidence |
|-------------|--------------|--------|----------|
| PKD-01 | 09-01 through 09-04 | ✓ SATISFIED | Frozen, script-free, bounded install; sanitizer; staged copy; install/update/reinstall wiring; real hook/module behavioral proof. |
| PKD-02 | 09-01 through 09-04 | ✓ SATISFIED | Failure/timeout/refusal stays non-blocking and visible; silent no-lockfile behavior; complete lifecycle warning placement; cleanup and retry regressions. |
| PKD-03 | 09-01 and 09-05 | ✓ SATISFIED | D-PL9-10/11 records, NFR-5 amendment, exact spawn chokepoints, ESLint seam, and green full gate. |

No orphaned Phase 9 requirements exist.

## Test Quality Audit

| Test area | Linked requirement | Active | Disabled | Circular | Strongest assertion | Verdict |
|-----------|--------------------|--------|----------|----------|---------------------|---------|
| Package install and lockfile sanitizer unit pairs | PKD-01, PKD-02 | Yes | 0 | No | Exact values, filesystem state, interaction checks | ✓ PASS |
| Process runner unit pair | PKD-01, PKD-02 | Yes | 0 | No | Ordered signals, process results, exact output, real child | ✓ PASS |
| Update, disabled refresh, reinstall, uninstall, dependency and apply pairs | PKD-01, PKD-02 | Yes | 0 | No | Multi-step state and concurrency assertions | ✓ PASS |
| Architecture gate | PKD-03 | Yes | 0 | No | Exact importer set and violation lists | ✓ PASS |
| Package-dependencies Cucumber feature | PKD-01, PKD-02 | 20 scenarios | 0 | No | Full payload/row/request/package-state comparisons | ✓ PASS |

**Disabled requirement tests:** 0
**Circular expected-value generation:** 0
**Insufficient assertions:** 0

## Decision Coverage

The automated decision-coverage handler emitted no structured result because `09-CONTEXT.md` has no `<decisions>` block. Manual verification traced the current D-PL9 decisions through code, tests, PROJECT.md, AGENTS.md, and the final summaries. D-PL9-09 is explicitly superseded; D-PL9-08’s original deferral is explicitly reversed. No unhonored current decision was found.

## Probe Execution

No Phase 9 probe scripts are declared.

## Anti-Patterns

No blocking anti-pattern was found:

- no unreferenced `TBD`, `FIXME`, or `XXX` marker in the reviewed scope;
- no skipped/todo requirement test;
- no test-only production hook;
- no new suppression without a valid line-specific reason;
- no placeholder or hollow package lifecycle path;
- fresh security audit: SECURED, 25/25 threats closed;
- fresh complete code review: CLEAN, 52 files, 0/0/0 findings.

### Advisory (New Scope, Unevidenced)

None.

## Human Verification

None. Every state transition, cleanup/ordering invariant, and user-visible package diagnostic identified during this pass has an automated behavioral or focused regression test. Controlled Windows host/process cases cover the Windows launcher and taskkill decisions; no unverified truth remains.

## Gaps Summary

No gaps. Phase 9 achieves its goal: supported plugin packages install through a contained, sanitized, frozen and script-free path; the resulting modules work from plugin hooks; failures remain non-blocking and visible exactly once; silent skips remain silent; update and cleanup races are synchronized; and governance gates prevent the subprocess surface from widening.

---

_Verified: 2026-10-29T02:25:18Z_
_Verifier: gsd-verifier_
