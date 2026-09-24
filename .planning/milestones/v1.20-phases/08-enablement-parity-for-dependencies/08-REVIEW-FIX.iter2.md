---
phase: 08-enablement-parity-for-dependencies
fixed_at: 2026-09-21T23:10:00Z
review_path: .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-09-21T23:10:00Z
**Source review:** .planning/phases/08-enablement-parity-for-dependencies/08-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 6 (2 critical + 4 warning; `fix_scope: critical_warning`, info findings IN-01..06 out of scope per the orchestrator ruling except where a fix touches the same lines)
- Fixed: 6
- Skipped: 0

All 6 in-scope findings from the iteration-2 review are fixed, tested, and committed atomically across 10 commits (6 for the findings themselves, 4 follow-up commits closing a self-inflicted gate regression and a prettier reformat -- see "Coverage and contract-pin follow-up" below). Sequential mode per the orchestrator's `tree_state` ruling: this checkout is itself already a worktree of a separate main repository, so every commit was made directly in this checkout with no nested agent worktree.

## Iteration 1

`08-REVIEW-FIX.iter1.md` recorded the first review pass: 12 in-scope findings (5 critical, 7 warning), all fixed across 13 commits (`2fa1bba5..f2378bac`). CR-01 (a re-enabled dependency's stale config entry survives), CR-02 (a `sha`-pinned declaration crashes the enable), CR-03 (a root failure after the cascade commits strands members), CR-04 (the install cascade's re-enable arm was not transitive), and CR-05 (the unwind/undo fault-injection tests proved nothing) were all fixed, along with WR-01 through WR-07 (rollback-partial threading, hook hydration, the whole-scope fail-closed read, severity misclassification, weakened fixtures, comment-policy violations, and the standalone/orchestrated asymmetry). The iteration-2 review re-derived every finding against the real source rather than trusting that report, and found two of the fixes only partially correct plus two new Critical defects of the same class.

## Fixed Issues

### CR-06: The member config patch reads only the target file, so `--local` leaves a base-file `enabled: false` in the merged view

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/plugin/shared.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts` (install-cascade side); `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts` (enable-cascade side)
**Commits:** `72d5a000` (install-cascade side), `0b3f1013` (enable-cascade side, combined with WR-08 -- see below)
**Applied fix:** Per the orchestrator ruling, added one shared helper (`orchestrators/plugin/shared.ts::overwriteDisabledMemberEntries`) that selects each member's declaring config file by DECLARATION ALONE (`local: undefined`), never by the flag the caller typed for the root, so a base-file `enabled: false` entry is found even when the root's own write targets the local file under `--local`. Both `enable-disable.ts::writeReEnabledMemberConfigEntries` and `install-flow.ts::writeReEnabledCascadeMemberConfigEntries` now delegate to it, retiring the near-verbatim duplicate IN-06 named. Added the reviewer's own test shape to both cascades: seed `{"b@official": {"enabled": false}}` in the base file, run the command with `local: true`, and assert `planReconcile(merged, stateAfter, scope)` equals `emptyReconcilePlan(scope)`. Added a direct test module (`overwriteDisabledMemberEntries` describe block in `shared.test.ts`) covering the overwrite, the untouched-no-entry case, the already-enabled case, the unreadable-declaring-file skip, and multi-key processing.

### CR-07: `assertFoldingClosureSucceeded` is false -- a manifest-absent disabled member crashes the install with a TypeError

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`
**Commit:** `9530d58f` (combined with WR-11 -- see below)
**Applied fix:** The fold's `not-found` failure for a discovered member absent from its own manifest is now mapped back onto the real dependent that discovered the member (`discovered.get(folded.key).requiredBy`) instead of leaking the internal synthetic root key, or throwing. Per the ruling's "prefer removing the synthetic root" guidance, I evaluated dropping the synthetic-root fold entirely but kept it (it reuses the walk's own tested post-order and diamond dedup, which a hand-rolled multi-root walk would have to re-derive) and instead proved the remaining failure arm is the ONLY reachable one after WR-11(a)'s `installedKeys` alignment, replacing the removed `assertFoldingClosureSucceeded` with two narrow evidence-backed assertions (`assertFoldedNotFoundFromSyntheticChild`, `assertDeclaredBySyntheticRoot`) rather than a bare `!` -- matching the project's own precedent (iteration-1's CR-02/CR-04 coverage-driven rewrite) for a branch TypeScript's exhaustiveness lint forces into existence but that no reachable graph can hit. Added the reviewer's own test graph (`foo -> {bar, qux}`, `bar -> baz`, all three disabled and installed, `qux` absent from the catalog) asserting `closure-failed` / `not-found` with `requiredBy: "foo@marketplace"` -- not a throw, not the synthetic key.

### WR-08: A config-write throw after the merged ledger commits still strands every member and the root on disk with no state save

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** `0b3f1013` (combined with CR-06's enable-cascade side -- both touch the same config-write call sites, and WR-08's phase restructuring is built directly on top of CR-06's simplified signature, so they could not be committed as clean independent hunks)
**Applied fix:** The two post-cascade config writes (`writeEnabledFlagBack` for the root, `writeReEnabledMemberConfigEntries` for the members) are now a single `"config"` phase, pushed as the LAST phase of the SAME `runPhases` ledger the cascade's members (and, on the fresh-root path, the root) already run in -- exactly the ruling's sketch. A throw from either write now unwinds every phase before it through `runPhases`'s own reverse-order undo, instead of propagating past the ledger with every materialized artifact already on disk and no state save to record them. This required also giving `buildEnableRootPhase` an `undo` it did not have before: its own doc comment had correctly argued no undo was needed because the phase was unconditionally last, and WR-08's new config phase makes that no longer true -- without the fix, a config-phase failure after a successful root materialization would strand the root's own artifacts on disk with the same NFR-3 violation WR-08 exists to close. Added the reviewer's own fault-injection test: `writeConfigEntries` rejects after both `a` (root) and `b` (member) materialize; both `a:s1` and `b:s1` are `ENOENT` afterward.

### WR-09: The docs contradict the CR-01/CR-06 behaviour and the WR-07 subsection makes a false claim about EDEP-03

**Files modified:** `docs/plugin-enablement.md`, `docs/dependency-resolution.md`, `docs/output-catalog.md`
**Commit:** `680fefbe`
**Applied fix:** Rewrote all three false "neither path touches the config" claims to state D-04-02 accurately: neither path ADDS a new config key, but where the target scope already declares a member `enabled: false`, a standalone command overwrites that entry to `true`. Rewrote the "standalone-only" subsection (renamed to "Standalone and reconcile-driven enablement diverge on a disabled dependency"): the enable cascade (EDEP-01) is standalone-only (`resolveEnableCascadeStep` skips it outright for an orchestrated call), but the install cascade's re-enable arm (EDEP-03) runs on EVERY install since `runInstallCascade` carries no orchestration gate -- only the config write-back is standalone-gated -- so a reconcile-driven install that re-enables a disabled dependency leaves that dependency's config entry stale until the next standalone `enable` or `install`. `docs/output-catalog.md`'s EDEP-01/EDEP-03 catalog-state prose was corrected the same way; the pinned fenced example bytes were untouched (prose-only edit, outside the `catalog-contract.test.ts` pinned blocks).

### WR-10: The fix commits introduced new comment-policy violations (removed-code narration) in source and tests

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** `a58215bd`
**Applied fix:** Rewrote every listed violation as a present-tense fact: `enableCascadeLookup`'s doc comment no longer narrates "replacing the former whole-scope eager read" or "the same reason the former eager lookup did" -- it states what the lazy per-record read does and why, and states that the ENBL-07 "not in manifest" refusal is rendered by the ledger's own PI-3 lookup rather than claiming to "restore the pre-EDEP-01 ENBL-07 bytes". `resolveEnableCascadeStep`'s doc comment drops "that decision was not available yet at THIS point when materialization used to happen here". The two matching test arrange comments (`WR-03`'s and `CR-03`'s) were rewritten the same way. (`buildEnableRootPhase`'s own "Before this, the members materialized in their own separate ledger... the file's own former 'Known gap' comment" violation was independently superseded by WR-08's rewrite of that same doc comment, landing in the WR-08 commit rather than duplicated here.)

## Coverage and contract-pin follow-up (not separate REVIEW.md findings, required by the phase's own gate)

- **`73c6fe2b`** -- every contract pin in `scripts/check-unused-type-members.contracts.json` that the fix pass shifted (34 entries across `enable-disable.ts`, `install-cascade.ts`, `install-flow.ts`, `shared.ts`) was remapped by diffing the exact hunks rather than by hand; the `assertFoldingClosureSucceeded` entry was dropped (the function no longer exists, replaced by CR-07's two narrower assertions), and one new entry was added for the `Extract<DependencyClosureResult, { ok: false }>` pattern `TransitiveReEnableResult` now carries -- the same analyzer-known pattern already excepted twice elsewhere in the same file (`InstallCascadeResult.failure`, `toIntersectionFailure.failed`).
- `resolveTransitiveReEnableSet`'s discovery loop was extracted into `classifyReEnableCandidate` to keep it under the project's cognitive-complexity ceiling after WR-11(b)'s addition pushed it over.
- Both `install-cascade.ts` and `shared.ts` needed direct-coverage follow-up beyond the fixes themselves: `install-cascade.ts` had one uncovered ternary branch before the CR-07 assertion rewrite (closed by the rewrite itself, which also closes the coverage gap without a pin); `shared.ts`'s new `overwriteDisabledMemberEntries` had no direct test in its own paired test module (`shared.test.ts`) even though it was exercised indirectly through `enable-disable.test.ts` and `install-flow.test.ts` -- the unit-testing skill requires the PAIRED module to reach 100% on its own, so five direct cases were added.
- **`b2f80755`** -- the full `test:coverage:unit` run surfaced that CR-07's assertion, `asserts _folded is Extract<DependencyClosureResult, { ok: false; reason: "not-found" }>`, compiles and behaves correctly but fails the unused-type-member gate's own type-selection prover: "reason" does not discriminate across the RAW `DependencyClosureResult` union (its `ok: true` arm carries no `reason` field at all), so the gate's `--json` subprocess exited 2 with empty stdout and the gate's own architecture test (`unused-type-member-gate.test.ts`) failed parsing it. Restructured into the same two-step chain `enable-disable.ts`'s pre-existing `ClosureFailure` / `ClosureUnusableDeclarationFailure` pair already uses: `FoldFailure` narrows by `ok` first (valid on the raw union), then `FoldNotFoundFailure` narrows THAT by `reason` (valid, since every `ok: false` arm carries one). This is a fix to the SAME CR-07 change, not a new finding.
- **`28fba5fa`**, **`3a0bd2c2`** -- two more contract-pin remap commits. The first corrects an operator error: an intermediate `git checkout <base> -- <path>` used to recompute the very first remap from a clean baseline left the file partially staged, and a later plain `git commit` (after `git add`-ing unrelated paths for an unrelated finding) silently picked up that stale staged copy, shipping a REVERTED `contracts.json` in the `CR-07` gate-fix commit. The second remaps the pins the pre-commit hook's own `prettier` rewrite of two destructuring/call-wrap sites shifted (see `1331decd`).
- **`1331decd`** -- `SKIP=trufflehog pre-commit run` (see Final verification) rewrote two sites in `enable-disable.ts` and one in its test module to match prettier's own line-wrap choice; no semantic change, committed as `style(08):` per the tree-state instructions rather than folded into an unrelated commit.

## Skipped Issues

None -- all 6 in-scope findings were fixed.

## Final verification

Run in the main checkout directly (sequential mode; this checkout is itself a worktree of a separate main repository, so no nested agent worktree was created — the orchestrator's `tree_state` ruling for this run). All gates were re-run against the FINAL committed tree (`HEAD` = `3a0bd2c2`) after the follow-up commits above landed, and all pass:

- `npm run typecheck` (`npx tsc --noEmit -p .`) -- clean, run after every source edit and again on the final committed tree.
- `npx eslint extensions tests scripts` -- clean (whole tree, exit 0 verified directly, not through a pipe). Two findings surfaced and were fixed mid-session before reaching a commit: a `sonarjs/cognitive-complexity` finding from WR-11(b)'s addition to `resolveTransitiveReEnableSet` (fixed by extracting `classifyReEnableCandidate`), and a `padding-line-between-statements` finding in the CR-07 test (fixed in `b2f80755`).
- `npx fallow health` -- `0 above threshold`, exit 0 (checked via `$?`, not the glyph).
- `npx fallow dead-code` -- `No issues found`, exit 0.
- `npm run lint:type-members` -- passes with the same 5 pre-existing recorded exceptions iteration-1 reported (none of mine); every contract pin this pass shifted was remapped and verified against the tool itself across three remap rounds (see the follow-up commits above).
- `node scripts/test-coverage-direct.mjs --base f2378bac` (the commit before this session) -- passes: `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts (branches 186/186, functions 45/45, lines 1562/1562)`; `install-cascade.ts` reached the same 100% independently; no shortfall recorded, no pin needed.
- Targeted `node --test` across every touched/adjacent suite in one run (enable-disable, install-cascade, install-flow, shared, enable-disable.messaging, install-cascade.messaging, edge handler, reconcile apply, import execute, dependency-doc-agreement, catalog-contract) -- 649 tests, 0 failures. Re-run after the CR-07 gate-fix restructuring; still 0 failures.
- `npm run test:coverage:unit` (native `node --test --experimental-test-coverage` with `--test-coverage-lines=100 --test-coverage-functions=100 --test-coverage-branches=100` over `extensions/**`, no pin mechanism) -- run twice. The first run (before `b2f80755`) surfaced the CR-07 gate-discriminant regression as the sole failure among 7417 tests (`tests/architecture/unused-type-member-gate.test.ts`'s own real-gate subprocess test, which parses the gate's `--json` output and got an empty stream because the gate itself was erroring out) -- coverage itself was already 100.00/100.00/100.00 across every file in `extensions/pi-claude-marketplace/**` on that run. The second run (final, `HEAD` = `3a0bd2c2`): **7417 tests, 0 failures, 100.00/100.00/100.00 lines/branches/functions**, exit 0, full ~6-minute run waited to completion both times.
- `SKIP=trufflehog pre-commit run --files <every file changed this session>` -- run twice. The first run's `prettier` hook rewrote two sites (committed as `1331decd`, see above) and `npm type-members` / `npm type-members (negative controls)` failed on the stale pins that reformat shifted (closed by `3a0bd2c2`). The second, final run: every hook passed (`mdformat`, `markdownlint-cli2`, `prettier` now a no-op, `npm lint`, `npm format check`, `npm typecheck`, `npm fallow`, `npm direct coverage (changed pairs)`, `npm type members` + negative controls, and the generic hygiene hooks), no rewrites, `git status` clean afterward except the pre-existing dirty files this run was instructed not to touch.

REVIEW-FIX.md itself is intentionally left uncommitted; the orchestrator commits it separately.

---

_Fixed: 2026-09-21T23:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
