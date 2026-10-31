---
phase: 09-plugin-package-dependencies
fixed_at: 2026-10-29T06:27:50Z
review_path: .planning/phases/09-plugin-package-dependencies/09-REVIEW.md
iteration: 4
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
human_verification_required: true
security_recheck_required: false
---

# Phase 9: Code Review Fix Report

## Iteration 4

**Fixed at:** 2026-10-29T06:27:50Z
**Source review:** `09-REVIEW.md`, reviewed tree `cc02c791`.
**Summary:** The remaining ownership defect in CR-01 was fixed. No finding was skipped.

### CR-01: Fresh dependency package diagnostics disappear during update settlement

**Status:** fixed: requires human verification
**Commit:** `db79c003` — `fix(packages): preserve dependency warning ownership`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/types.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts`, their paired tests, and `features/plugin/package-dependencies.feature`.

The settlement now carries ordered dependency diagnostics with the member's plugin, scope, verb, and warnings. A first-run closure records each materialized member separately. Planned moves keep their own warning identity and retain diagnostics from nested dependency materialization. Materialization attaches these diagnostics to the requester outcome without merging them into the requester's `stagingWarnings`. Direct update and marketplace update render the dependency diagnostics before the requester's own diagnostic, so each warning keeps one owner and appears once.

**RED:** The closure ledger exposed only flat warnings. Both first-run and planned settlement dropped a structured diagnostic. Materialization merged the dependency warning into the requester. The direct Cucumber scenario therefore named `widget` for `zcore`'s package failure.

**GREEN:** Unit oracles cover first-run closure ownership, planned closure and move transport, nested move diagnostics, requester-warning separation, direct rendering, marketplace rendering, and failed-move ownership. The exact direct-update scenario reports one `zcore` installed diagnostic after the cascade, reports no `widget` diagnostic for that warning, and retains successful requester and dependency lifecycle rows.

### Iteration 4 Verification

Checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`, branch `agent-reverify-a`, on Linux with Node v26.12.1. No additional worktree was created because `workflow.use_worktrees` is false.

- Six focused owner modules passed: dependency move, dependency settlement, install dependency ledger, materialize latest, direct update flow, and marketplace update messaging.
- Direct coverage passed at 100% for every changed source/test pair, including the update-swap type carrier.
- The exact Cucumber regression passed one scenario and 16 steps through the real direct-update command and loopback package registry.
- TypeScript passed with `tsc --noEmit --incremental false`; focused ESLint, Prettier, `check:features`, Fallow guard, and the changed-code Fallow audit passed.
- Repository fixers passed. The normal commit hook passed `npm run check:commit`; no hook was bypassed.

**Combined-gate follow-up:** The parent's exact `npm run check` run found one stale ownership oracle in `features/plugin/update.feature`: the dependency move warning was still expected under requester `app`, while the corrected structured diagnostic renders under dependency `lib`. The old expectation failed the focused scenario with `Plugin "lib" [project] updated` versus `Plugin "app" [project] updated`. Commit `741516af` (`test(update): expect dependency warning owner`) changes only that header. The corrected scenario passed 1 scenario and 17 steps; the complete update feature passed 26 scenarios and 380 steps. `check:features`, repository fixers, and the normal commit hook passed.

The fixer did not run the full combined-tree `npm run check` gate. The parent workflow must run that gate before completing Phase 9. This report remains uncommitted for the parent workflow.

The automated regressions prove structured ownership, ordering, exact-once rendering, requester-warning separation, and lifecycle success. Human review remains requested because this is a logic correction across the dependency closure, settlement, update outcome, and two notification surfaces.

## Prior Iteration 3 Report

**Fixed at:** 2026-10-29T06:03:44Z
**Source review:** `09-REVIEW.md`, reviewed tree `0c989c42`.
**Summary:** The one current finding was fixed. No finding was skipped.

### CR-01: Fresh dependency package diagnostics disappear during update settlement

**Status:** fixed: requires human verification
**Commit:** `16e4c849` — `fix(packages): preserve dependency package diagnostics`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts`, `test/orchestrators/plugin/install-flow-dependency-ledger.test.ts`, `test/orchestrators/plugin/dependency-settle.test.ts`, `features/plugin/package-dependencies.feature`.

The closure projection now gathers each materialized member's discovery warnings in member order. The step runner and the first-run settlement carry those warnings into the update result. Existing move ownership remains unchanged, so a requester's forwarded warning is not duplicated.

**RED:** A materialized step dropped a scripted package diagnostic, a successful first run dropped the same diagnostic, and the real closure projection dropped a dependency member's package warning. The public direct-update scenario installed the dependency and updated its requester but emitted no diagnostic.

**GREEN:** Both settlement paths retain the warning. The closure projection retains a real member discovery warning. The direct update emits one diagnostic after its cascade while the requester update and dependency install succeed; the failed package fetch appears once and the dependency remains installed without `node_modules`.

### Iteration 3 Verification

Checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-a-14710`, branch `agent-reverify-a`, on Linux with Node v26.12.1. No additional worktree was created because `workflow.use_worktrees` is false.

- Focused owner tests passed: 27 dependency-settlement tests and 14 install-ledger tests.
- Direct coverage passed for both changed source/test pairs at 100%.
- The exact Cucumber regression passed one scenario and 16 steps using the real update command and loopback registry.
- TypeScript passed with `tsc --noEmit --incremental false`; ESLint, Prettier, `check:features`, Fallow guard, and Fallow audit passed.
- Repository fixers passed. The normal commit hook passed `npm run check:commit`; no hook was bypassed.

The fixer did not run the full combined-tree `npm run check` gate. The parent workflow must run that gate before completing Phase 9. This report remains uncommitted for the parent workflow.

The automated regressions prove warning transport, ordering, exact-once rendering, and lifecycle success. Human review remains requested because this is a logic correction across the install closure and update settlement ownership boundary.

## Prior Iteration 2 Report

**Iteration:** 2
**Source review:** `09-REVIEW.md`, reviewed tree `64b397f9`.
**Summary:** All seven current findings have separate commits. No finding was skipped.

## Fixed Issues

Source paths below are relative to `extensions/pi-claude-marketplace/`. Test and feature paths are relative to the repository root.

### CR-01: Finish timed-out process-tree cleanup

**Status:** fixed: requires human verification
**Commit:** `a23332b7` — `fix(package): finish timed-out process cleanup`
**Files modified:** `platform/package-manager.ts`, `test/platform/package-manager.test.ts`.

Once timeout starts, a direct-child close no longer cancels group SIGKILL escalation. The final bounded deadline clears the remaining timers. Normal closes still cancel timers immediately.

**RED:** The controlled process-boundary regression closed the parent after SIGTERM while a same-group descendant survived. The original runner left that descendant alive beyond the grace period.
**GREEN:** The regression observes SIGTERM followed by SIGKILL even after the result settles. Direct coverage passed at 100%. Existing real POSIX process-tree and controlled Windows cases also passed.

### CR-02: Refresh packages after a disabled revision change

**Status:** fixed: requires human verification
**Commit:** `170b56ad` — `fix(package): refresh disabled plugin packages`
**Files modified:** `orchestrators/plugin/update-preflight.ts`, `test/orchestrators/plugin/update-preflight.test.ts`, `features/plugin/package-dependencies.feature`.

A disabled update in the same root removes only marked, extension-owned packages before saving the changed revision. Both actions run under the existing state lock. Enable then reads the new lockfile. A failed invalidation retains the old record for retry. Compatibility-only changes retain packages.

**RED:** Unit regressions retained stale packages and failed to reject an invalidation failure. The visible v1 install → disable → v2 update → enable scenario omitted the required v2 registry request.
**GREEN:** Direct coverage passed at 100%. The revision-change and unchanged-enable scenarios passed, including installed package versions and exact registry requests. Unit coverage includes failed invalidation followed by successful retry. Unchanged enable remains offline with an empty npm cache.

### CR-03: Lock uninstall package cleanup

**Status:** fixed: requires human verification
**Commit:** `297172b5` — `fix(package): lock uninstall package cleanup`
**Files modified:** `orchestrators/plugin/uninstall.ts`, `test/orchestrators/plugin/uninstall.test.ts`.

Post-uninstall cleanup takes a fresh scope lock. It reads current references and removes marked packages in the same critical section. Lock contention and cleanup failures remain best-effort, with debug logging only. Existing shared-root and other-record protections remain in place.

**RED:** A deterministic competing install acquired the lock, observed existing packages, and later saved its record. The unlocked cleanup deleted those packages, producing ENOENT in the assertion.
**GREEN:** Cleanup now retains packages while that competing installation holds the lock. Its newly saved record retains usable packages. All 139 paired tests passed with 100% direct coverage, including held-lock cleanup behavior.

**Combined-gate follow-up:** The parent's full gate exposed two stale lock-count assertions in `test/edge/register.test.ts`. Commit `9c41eb6b` (`test(prune): account for package cleanup lock`) changes only that expectation and its comment. Both registered-prune scope cases failed with `3 !== 2` before the change and passed afterward. They now account for the state guard, package cleanup lock, and clone cleanup lock. Fallow and the normal commit hook passed, including type checking, static checks, and the register pair's 100% direct coverage. The parent must rerun the combined gate on this test correction.

**Second combined-gate follow-up:** Commit `df596941` (`test(prune): count cleanup locks in composed operations`) updates only the two matching expectations and comments in `test/orchestrators/plugin/operations.test.ts`. Both focused composed-prune cases failed with `3 !== 2` before the change and passed afterward. Fallow, fixers, and the normal commit hook passed, including static checks and the operations pair's 100% direct coverage. The combined gate still requires a fresh run after this correction.

### CR-04: Retain diagnostics on a combined move and enable

**Status:** fixed: requires human verification
**Commit:** `4a5cd228` — `fix(apply): retain move enable diagnostics`
**Files modified:** `orchestrators/reconcile/apply.ts`, `test/orchestrators/reconcile/apply.test.ts`, `features/plugin/package-dependencies.feature`.

The consolidated revision-move outcome carries staging warnings and MCP notices from its enable outcomes. It still reports exactly one net transition row.

**RED:** The composed paired test lost both the package warning and the MCP notice. The visible held-plugin move-and-enable scenario lost its package diagnostic.
**GREEN:** Direct coverage passed at 100%. The paired test asserts the complete notification set, including the MCP notice and one transition per plugin. The exact Cucumber scenario passed all 16 steps without a duplicate diagnostic.

### CR-05: Give a moved dependency's package warning one owner

**Status:** fixed: requires human verification
**Commit:** `58c9f696` — `fix(package): dedupe moved dependency warnings`
**Files modified:** `orchestrators/plugin/dependency-move.ts`, `test/orchestrators/plugin/dependency-move.test.ts`, `features/plugin/package-dependencies.feature`.

The moved dependency's row retains its package note. The move excludes that exact note from forwarded staging warnings, so the requester does not repeat it. Other discovery warnings and MCP notices still propagate.

**RED:** Three paired assertions exposed the forwarded duplicate. The direct-update scenario emitted B's row note and the same warning in A's diagnostic.
**GREEN:** Direct coverage passed at 100%. Three composed scenarios passed all 45 steps. Direct update and apply report the note once on B's row. Marketplace autoupdate preserves its existing single B-attributed diagnostic. Exact notification and row assertions retain both install/apply visibility and dependency identity. The paired warning/MCP case preserves an unrelated discovery warning and the MCP notice.

### WR-01: Restrict the package-runner exception to its exact path

**Status:** fixed
**Commit:** `98809fa9` — `fix(lint): narrow package runner seam`
**Files modified:** `eslint.config.js`, `test/architecture/no-shell-out.test.ts`.

The package-runner restriction now excludes only `orchestrators/plugin/package-install.ts`. The existing layer and ledger zones are shared between both ESLint configurations, so the authorized seam retains those restrictions.

**RED:** Four equally named importers outside the seam bypassed the original rule.
**GREEN:** All eight architecture tests passed. The exact seam is allowed. Same-basename importers in edge, another orchestrator, a nested plugin folder, and the extension root are rejected. An ordinary edge importer remains rejected. `node --check eslint.config.js` passed.

### WR-02: Decode UTF-8 streams incrementally

**Status:** fixed: requires human verification
**Commit:** `53686755` — `fix(package): decode manager output streams`
**Files modified:** `platform/package-manager.ts`, `orchestrators/plugin/package-install.ts`, `test/platform/package-manager.test.ts`, `test/orchestrators/plugin/package-install.test.ts`.

Each output stream has its own StringDecoder. Completion flushes each decoder once. Capture retains a bounded prefix and removes a high surrogate cut by the cap. Both skipped and failed package notes use the same Unicode-safe 500-character limit.

**RED:** Five focused regressions failed: split café/emoji bytes, incomplete-sequence flushing, both output-cap boundaries, and a surrogate split at the note limit. The adjacent note boundary was already correct and remains covered.
**GREEN:** Both source pairs passed 100% direct coverage. Tests compare complete stdout/stderr values, exercise independent streams, flush incomplete byte sequences, preserve an emoji that fits, and omit an emoji that crosses a limit.

## Verification

All checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369`, branch `agent-reverify-c`, on Linux with Node v26.12.1. No new worktree was created.

Every changed source pair passed `npm run test:coverage:direct -- <paired-test>` at 100% lines, branches, and functions:

- `test/platform/package-manager.test.ts`
- `test/orchestrators/plugin/update-preflight.test.ts`
- `test/orchestrators/plugin/uninstall.test.ts`
- `test/orchestrators/reconcile/apply.test.ts`
- `test/orchestrators/plugin/dependency-move.test.ts`
- `test/orchestrators/plugin/package-install.test.ts`

The final `npx cucumber-js features/plugin/package-dependencies.feature --format summary` passed 20 scenarios and 281 steps. Earlier focused runs established the visible regressions and verified their fixes. `node --test test/architecture/no-shell-out.test.ts` passed eight tests.

Each finding passed the changed-code Fallow audit and repository fixers. Each of the seven plain commits passed the normal hooks, including `npm run check:commit`. The hook checked types, ESLint, Fallow, formatting, source/test pairing, feature rules, unpaired tests, and the staged pairs' direct coverage. No hook was bypassed. Hook findings and formatting changes were corrected before retrying the affected commits.

The fixer did not run the full combined-tree `npm run check` gate. The parent workflow must run that gate on the integrated tree. This report remains uncommitted for the parent workflow.

## Human Verification and Security Recheck

The logic and concurrency fixes retain human-verification flags despite automated regression coverage. Review the disabled-revision invalidation, uninstall lock lifetime, process escalation lifetime, combined apply diagnostics, dependency-warning ownership, and Unicode boundary handling.

Run a fresh security review for CR-01 and CR-03. They change process lifetime and destructive cleanup synchronization. Also inspect CR-02's marked-package invalidation under the state lock. The previous security report does not certify these changes.

Native execution covered Linux/POSIX. Windows process-tree and launcher behavior were exercised through the existing controlled host/process cases, not on a native Windows machine. A timed-out parent can settle before its remaining group receives SIGKILL during the scheduled grace period. Signal denial and failed Windows taskkill still reach the existing bounded final deadline and cannot guarantee OS process termination. Existing containment, no-shell execution, sanitization, marker ownership, and soft-failure policies remain unchanged.

---

_Fixer: gsd-code-fixer_
_Iteration: 4_
