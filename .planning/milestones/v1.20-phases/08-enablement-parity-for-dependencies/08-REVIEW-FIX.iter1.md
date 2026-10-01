---
phase: 08-enablement-parity-for-dependencies
fixed_at: 2026-09-21T21:23:17Z
review_path: .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-09-21T21:23:17Z
**Source review:** .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (5 critical + 7 warning; `fix_scope: critical+warning`, info findings IN-01..03 out of scope per the orchestrator ruling)
- Fixed: 12
- Skipped: 0

All 12 in-scope findings are fixed, tested, and committed atomically (13 fix/test/docs commits, listed below). Every fix worktree ran in the main checkout directly (`workflow.use_worktrees: true` in config, but the orchestrator's own `tree_state` block explicitly ruled "Sequential mode, no agent worktree" for this run, since this checkout is itself already a worktree of a separate main repository -- creating a nested worktree there would have attached to the wrong repository entirely).

## Fixed Issues

### CR-01: A re-enabled dependency whose config entry says `enabled: false` is reverted by the next reconcile pass

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts` (enable-cascade side); `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/plugin/install-flow.test.ts` (install-cascade side); `scripts/check-unused-type-members.contracts.json`
**Commits:** `33dc82c7` (enable-cascade), `657c2cf5` (install-cascade)
**Applied fix:** Per the orchestrator ruling, a re-enabled member whose key the target-scope config already declares with `enabled: false` is overwritten to `true` inside the same lock, through the same declaring-file selection the root uses (`selectDeclaringConfigWriteTarget`). A member with no config entry stays untouched (D-04-02). `writeReEnabledMemberConfigEntries` (enable-disable.ts) and `writeReEnabledCascadeMemberConfigEntries` (install-flow.ts) implement this on both cascades, called only after the whole ledger has succeeded and before `tx.save()`. Proven by the reviewer's own test shape: seed `{"b@official": {"enabled": false}}`, run `enable a`, assert `planReconcile(merged, stateAfter, scope)` equals `emptyReconcilePlan(scope)`; and the mirror case for `install a`. Also covers the idempotent-root variant (a member re-enabled even though the root itself is a no-op) and the "no entry stays untouched" case.

### CR-02: `assertOnlyCycleReachable` is wrong -- a `sha`-pinned declaration crashes the enable with a TypeError

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commits:** `a7f92514`; further simplified in `f2378bac` (coverage-driven rewrite, see below)
**Applied fix:** `enableCascadeClosureFailure` now handles `unusable-declaration` with `closureFailureFacts`'s own token (`invalid manifest`) and cause shape, and proves `not-found`/`marketplace-not-added` structurally unreachable via an evidence-backed assertion rather than a false claim. (During the final coverage pass this was further rewritten from a switch with two dead case arms to an early return + one unconditional assertion, since TypeScript's exhaustiveness lint forces dead arms into existence but 100% branch coverage cannot tolerate them -- see the `f2378bac` entry below.) Added the reviewer's sha-pinned test asserting the refusal row bytes and that nothing is saved.

### CR-03: A root failure after the cascade members committed leaves member artifacts on disk with no state save

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** `7c7ae95d`
**Applied fix:** The root's own fresh enable is now the LAST phase of the SAME `runPhases` ledger the cascade's members run in (`buildEnableRootPhase`, merged via `runEnableCascadeWithRoot`), reached only for a standalone, non-orchestrated, non-idempotent enable. A root failure now unwinds every member phase before it; a member failure unwinds a run before the root phase is even reached -- both directions are just `runPhases`'s existing reverse-order undo over one array. Extracted `materializeEnableRoot` (ledger call + outcome construction) and `unstageBackToDisabled` (unstage + `toDisabledRecord`) as shared helpers between the ordinary single-plugin path (`runEnableBranch`, still used for `disable` and orchestrated enable) and the new merged root phase -- verified byte-identical behavior on every pre-existing test. Added the reviewer's fault-injection test: root's `runInstallLedger` rejects after a member already materialized; the member's staged skill directory is `ENOENT` afterward.

### CR-04: The install cascade's re-enable arm is not transitive

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** `34997786`
**Applied fix:** `resolveTransitiveReEnableSet` walks each `toReEnable` member's own closure with an empty `installedKeys` set (the same technique `enable-disable.ts::resolveEnableCascade` uses) to discover every transitively reachable disabled member, then folds the whole discovered set into one globally post-ordered list via a single further walk from a synthetic root that declares the discovered set as its own dependencies -- reusing `resolveDependencyClosure`'s own tested post-order and diamond dedup instead of hand-rolling a merge. A closure failure while exploring a member's own dependencies propagates as the cascade's own `closure-failed` outcome (fail-closed, D-05-07 precedent). Added a depth-2 disabled-chain test (both records end enabled) and a cycle-among-disabled-dependencies test proving the fail-closed path.

### CR-05: The EDEP-01 unwind and undo fault-injection tests cannot observe the behaviour their titles claim

**Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** `114c3178` (with WR-01, see below -- they are the same fix/test pair)
**Applied fix:** All three tests rewritten to assert the real on-disk footprint (a member's staged skill directory, present or `ENOENT`) and the exact row bytes, which only pass when the real unwind/fold/rethrow logic runs -- not a no-op undo. This is only meaningful together with WR-01's fix (the undo previously swallowed the failure the tests were meant to prove), so both landed in one commit.

## Warnings

### WR-01: The enable cascade discards every rollback-partial signal and its undo swallows an unfinished unstage

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** `114c3178`
**Applied fix:** The member undo now rethrows after folding what did drop, mirroring `install-cascade.ts::buildReEnableMemberPhase`'s own D-03-07 discipline. `EnableCascadeRun` accumulates rollback partials from a failing member's own ledger capture; `runEnableCascadeMembers`/`runEnableCascadeWithRoot` combine those with `runPhases`'s own aggregate over every other phase's undo and thread the combined list into the `enable-failed` outcome's `rollbackPartials` -- the already-wired rendering in `enableFailedRow` picks it up unchanged, producing the `{rollback partial}` row and the `[b@official] (rollback failed)` child exactly as the root's own path already did.

### WR-02: Re-enabled cascade members' hooks are never hydrated into the routing cache

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `scripts/check-unused-type-members.contracts.json`
**Commit:** `f3f5e801`
**Applied fix:** `EnableCascadeRun` now records `{ key, name, marketplace, pluginRoot, hooksConfigPath }` per re-enabled member, threaded through the cascade's "ran" arm. `hydrateReEnabledMemberHooks` mirrors `install-flow.ts::hydrateInstalledHooks`: reads and caches every member's hooks (non-fatal, routed through `hookDebugLog` on failure) and rebuilds the routing table once. Called after `tx.save()` on both the fresh and the idempotent-root save paths. Added a hydration test plus both non-fatal-catch-arm tests (cache-read failure, routing-rebuild failure).

### WR-03: The whole-scope fail-closed declaration read misattributes a manifest-absent root as `{unreadable}` and blocks unrelated plugins

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `scripts/check-unused-type-members.contracts.json`, `docs/plugin-enablement.md`
**Commit:** `c2c7bb64`
**Applied fix:** `enableCascadeLookup` now reads one record's declarations lazily, as the closure walk actually visits it (reusing `dependency-index.ts::readRecordDeclarations`, now exported), instead of eagerly indexing the whole scope. An unreadable record outside the closure is never read and never blocks. D-05-07 fail-closed still applies to every record the walk does reach -- except the root itself when its manifest is readable and its own entry is simply absent (ATTR-08 "not in manifest"), restoring the pre-EDEP-01 ENBL-07 bytes (`⊘ foo-plugin v1.2.3 (failed)` / `cause: Plugin "foo-plugin" not found in marketplace "mp".`) instead of `{unreadable}`. `knownMarketplaces` is now a mutable set the lookup grows as each record's declarations are read. `disable`'s own dependents guard (EDEP-02) keeps its whole-scope, fail-closed read unchanged, per the ruling -- documented in `docs/plugin-enablement.md` rather than narrowed, since `uninstall`'s own D-05-07 guard makes the identical scope-wide choice for the identical reason. Added a test proving an unrelated plugin's unreadable manifest never blocks an enable that has nothing to do with it, and updated the ENBL-07/D-97-01 test to the restored bytes.

### WR-04: A not-installed declared dependency renders an `error` block over an `(installed)` root row whose enable the next reload undoes

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `docs/output-catalog.md`
**Commit:** `9065055c`
**Applied fix:** Per the ruling, kept the `not-installed` disposition non-refusing but changed its severity to `warning` ("carried out but short") instead of `error` ("not carried out"), matching the tri-state severity model. The catalog prose now states the reload consequence (LOAD-01 holds the root down as `dependencyDisabled` until the dependency is installed).

### WR-05: Two promotion fixtures no longer seed the `enabled: false` config entry their arrange comments still describe

**Files modified:** `tests/orchestrators/import/execute.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `94884529`
**Applied fix:** Both fixtures now seed the config precondition directly (the base-file `{ enabled: false }` entry the import fixture's comment claims; the local-file `{ enabled: false }` entry the CFG-02 shadowing test needs) and the arrange comments say so.

### WR-06: New source comments violate the project comment policy

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts`, `extensions/pi-claude-marketplace/shared/notification-types.ts`, `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
**Commit:** `33975fc3`
**Applied fix:** Rewrote every listed violation as a present-tense fact: "the Phase 6 consequence marker" became "the LOAD-02 consequence marker (`dependencyDisabled`)"; both "byte-identical to the pre-EDEP-01 form" occurrences became "a one-element sort is a no-op..."; "in every case this plan does not change" was dropped; "Retires the `{already installed, dependency disabled}` skip this token replaces" was dropped from both `notification-types.ts` and `notify-reasons.ts`. `enable-disable.ts`'s "Not reachable by any case this plan tests" comment was left for the CR-03 fix (which removed the gap it described) and was in fact deleted along with the code it annotated when CR-03 landed.

### WR-07: The standalone/orchestrated asymmetry is undocumented and leaves the same intent with two outcomes

**Files modified:** `docs/plugin-enablement.md`
**Commit:** `05fcf0ae`
**Applied fix:** Per the ruling, documented the asymmetry rather than extending either cascade to orchestrated calls: a new subsection states that a config-declared (reconcile-driven) enable does not turn on a disabled dependency and that LOAD-01 holds the dependent down until the user runs `enable`.

## Coverage follow-up (not separate REVIEW.md findings, required by the phase's own gate)

Two additional commits closed direct-coverage and native 100%-coverage gaps the fixes above opened, per the mandatory verification pass in `tree_state`:

- **`28c8f201`** -- added tests for previously-uncovered branches: a member ledger failure while the root is idempotent (the merged-ledger path already had CR-03/CR-05 coverage; the idempotent-root path did not), that same case's rollback-partial threading, both of `hydrateReEnabledMemberHooks`'s non-fatal catch arms, a depth-2 cycle-among-disabled-dependencies test for the install cascade, and the install cascade's own "member with no config entry" branch (the existing CR-01 test for that branch was enable-cascade-only).
- **`f2378bac`** -- `test:coverage:unit`'s native 100% thresholds have no pin/exception mechanism (unlike `test:coverage:direct`), so two branches CR-02 and CR-04 introduced -- forced into existence by TypeScript's switch-exhaustiveness lint for values that can never occur at runtime -- had to be rewritten as unconditional evidence-backed assertions (matching the file's own pre-existing `assertRecordedStateLedgerInstalled` pattern) instead of dead switch/if arms, since the assertion's own body IS reached whenever the surrounding condition holds, closing the gap without weakening the fail-closed guarantee. Also fixed two smaller real gaps (an untested `?? new Error(...)` fallback in `unstageBackToDisabled`, and a redundant `?? ""` in `hydrateReEnabledMemberHooks` that was dead code given the caller's own filter -- removed via the same flatMap-narrowing shape `install-flow.ts::hydrateInstalledHooks` already uses).

## Skipped Issues

None -- all 12 in-scope findings were fixed.

## Final verification

Run in the main checkout directly (no nested worktree; see the status-line note above). All gates green on the final committed tree (`HEAD` = `f2378bac`):

- `npm run typecheck` -- clean.
- `npx eslint extensions tests scripts` -- clean (whole tree).
- `npx fallow health` -- `0 above threshold`, exit 0 (checked via `$?`, not the `✗` summary glyph).
- `npx fallow dead-code` -- `No issues found`, exit 0.
- `npm run lint:type-members` -- passes with the same 5 pre-existing recorded exceptions (none of mine); every contract pin this phase's insertions shifted was remapped and verified against the tool itself.
- `npm run test:coverage:direct:commit` (`node scripts/test-coverage-direct.mjs --base 2fa1bba5`, the commit before this session) -- every changed file passes at 100%, `scripts/test-coverage-direct.pin.json` is empty (no recorded shortfalls needed).
- Targeted `node --test` on every touched/adjacent suite (enable-disable, install-cascade, install-flow, dependency-index, enable-disable.messaging, install-cascade.messaging, edge handler, reconcile apply, import execute) -- 561+ tests, all passing throughout the session; the broadest combined run was 561 tests / 0 failures.
- `npm run test:coverage:unit` (native `node --test --experimental-test-coverage` with `--test-coverage-lines=100 --test-coverage-functions=100 --test-coverage-branches=100` over `extensions/**`, no pin mechanism) -- **100.00 / 100.00 / 100.00** across every file in `extensions/pi-claude-marketplace/**`, 7406 tests, 0 failures, exit 0. Full ~10-minute run, waited to completion.
- `SKIP=trufflehog pre-commit run --files <all 14 touched files>` -- every hook passed (`mdformat`, `markdownlint-cli2`, `prettier`, `npm lint`, `npm format check`, `npm typecheck`, `npm fallow`, `npm direct coverage (changed pairs)`, `npm type members` + negative controls, and the generic hygiene hooks), no rewrites, `git status` clean afterward.

REVIEW-FIX.md itself is intentionally left uncommitted; the orchestrator commits it separately.

---

_Fixed: 2026-09-21T21:23:17Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
