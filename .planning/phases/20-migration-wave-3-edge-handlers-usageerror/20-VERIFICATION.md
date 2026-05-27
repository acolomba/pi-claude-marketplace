---
phase: 20-migration-wave-3-edge-handlers-usageerror
verified: 2026-05-27T21:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "WR-01 / WR-03 (v1 REVIEW.md): Stale 'execute.ts:745-755' citation and overstated 'per-scope try/catch via executeScopedPlan' claim in edge/handlers/plugin/import.ts comment block"
    - "WR-02 (v1 REVIEW.md): Partial-result-loss risk on unexpected installPlugin throw -- now wrapped in try/catch in executeScopedPlan, routed to result.unexpectedPluginFailures, per-plugin loop continues"
    - "IN-01 (v1 REVIEW.md): MSG-Block 1b doc note for orchestrators/import/** parallel with orchestrators/plugin/**"
    - "IN-02 (v1 REVIEW.md): Object.freeze sites now carry defense-in-depth comments (3 sites)"
    - "IN-03 (v1 REVIEW.md): MarketplaceBlock.name and .scope marked readonly"
  gaps_remaining: []
  regressions:
    - "20-REVIEW.md (post-closure) WR-01: Plan 20-05 Task 2 wrote line-anchored comment citations that match the file's pre-Task-1 state. Off-by-3 for import.ts:52-53 citations (execute.ts:518-528 -> actual 521-531; execute.ts:577-608 -> actual 580-611). Off-by-21 for the importClaudeSettings:787 citations in execute.ts:644 and tests/orchestrators/import/execute.test.ts:435,494 (actual location: execute.ts:808). Advisory comment quality only; no behavioral impact."
    - "20-REVIEW.md (post-closure) WR-02: The new WR-02 lock-test exercises in-scope per-plugin loop continuation on a single scope (selectedScopes: ['project']). Cross-scope continuation guarantee (scope A throws unexpectedly -> scope B still runs to completion -> single notify() emits merged cascade for BOTH scopes) is not regression-guarded by any test. Existing 'keeps user and project operations independent' test (line 907) has no failing/throwing path. Behavior is correct in the code; test coverage gap only."
human_verification:
  - test: "WR-01 (post-closure REVIEW.md): Decide whether to re-issue the line citations as accurate refs to current state, switch to function-anchored citations (REVIEW Option B), or accept the off-by-N drift as advisory-only"
    expected: "Either (a) update import.ts:52-53 to cite execute.ts:521-531 and 580-611, update execute.ts:644 + execute.test.ts:435,494 to cite importClaudeSettings (execute.ts:808), or (b) replace line refs with function-anchored citations per REVIEW.md WR-01 Option B, or (c) explicit acceptance that line-number drift is tolerable (warning-level only, no behavioral impact, no test failure)."
    why_human: "Comment-text quality is not machine-verifiable. The off-by-3 and off-by-21 drift produces no test or typecheck failure; only a human can decide whether to apply Option A (re-issue current line numbers), Option B (function-anchored citations), or accept the drift."
  - test: "WR-02 (post-closure REVIEW.md): Decide whether to add a cross-scope regression test or accept the in-scope-only WR-02 lock-test coverage"
    expected: "Either (a) a sibling test added to tests/orchestrators/import/execute.test.ts that exercises selectedScopes: ['project', 'user'] with an installPlugin mock throwing on scope A and succeeding on scope B, asserting both scopes attempted + single merged notify() emission, or (b) explicit acceptance that the existing in-scope lock-test plus the unmodified outer-loop iteration in importClaudeSettings (execute.ts:790-792) is sufficient regression guard."
    why_human: "Behavior is correct in the code (the try/catch routes throws into the result bucket and continue's the per-plugin loop, so executeScopedPlan returns normally and the outer for-loop iterates to scope B). The risk is regression-only: a future refactor could silently break cross-scope continuation. Only a human can decide whether the test gap warrants closure now or is acceptable given the surrounding test scaffolding."
---

# Phase 20: Migration Wave 3 - Edge Handlers & UsageError Verification Report

**Phase Goal:** Every remaining call site -- including all edge handlers and all
`notifyUsageError(ctx, msg, usage)` sites -- uses the v2 structured entrypoints.
After this phase, no code outside `shared/notify.ts` calls the V1 severity-named
wrappers or the V1 three-argument `notifyUsageError`.

**Verified:** 2026-05-27T21:00:00Z
**Status:** human_needed
**Re-verification:** Yes -- post-Plan-20-05 gap closure re-verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                             | Status     | Evidence                                                                                                               |
|----|-----------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------|
| 1  | Zero `notifySuccess` / `notifyWarning` / `notifyError` callers in `edge/handlers/**/*.ts`                                        | VERIFIED   | `grep -rnE "^[^/]*notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/edge/handlers/` returns empty. Note: `edge/args-schema.ts:33,84` use `notifyError` only as a local closure parameter name -- not a call to `shared/notify.ts::notifyError` (which has been retired). |
| 2  | All V1 3-arg `notifyUsageError(ctx, msg, usage)` sites migrated; 30 V2 1-arg sites present; zero V1 form remains                  | VERIFIED   | V1 grep (`notifyUsageError\(ctx,\s*"`) in `edge/` returns 0; V2 grep (`notifyUsageError\(ctx,\s*\{`) returns 30        |
| 3  | MSG-* lint plugin `files:` globs cover no remaining source files; Block 1 effectively no-op against migrated codebase             | VERIFIED   | `eslint.config.js` Block 1 `ignores` at lines 161-163 covers `orchestrators/marketplace/**`, `orchestrators/plugin/**`, `orchestrators/import/**` -- all 3 migrated families. |
| 4  | Catalog UAT byte-equality GREEN for every edge-handler output and every usage-error output against the v2.0 spec                  | VERIFIED   | `node --test tests/architecture/catalog-uat.test.ts` -> 3/3 pass, exit 0                                              |
| 5  | `npm run check` stays GREEN                                                                                                       | VERIFIED   | `npm run check` -> 1364 pass / 0 fail / 2 todo, exit 0                                                                |

**Score:** 5/5 truths verified

---

### Plan 20-05 Gap-Closure Verification (from prior VERIFICATION.md `human_verification:`)

| Item                  | Disposition (prior) | Disposition (current)              | Evidence                                                                                          |
|-----------------------|---------------------|------------------------------------|---------------------------------------------------------------------------------------------------|
| WR-01 / WR-03 comment | human_needed        | RESOLVED (with new advisory issue) | `import.ts:52-63` rewritten; stale `execute.ts:745-755` removed (`grep` returns 0). However, the rewrite re-introduced a new off-by-3 drift (see Regressions in frontmatter). |
| WR-02 risk acceptance | human_needed        | CLOSED (Option A applied)          | `installPlugin` wrapped in try/catch at `execute.ts:646-667`; catch handler pushes one entry to `result.unexpectedPluginFailures` with `reason: "unexpected-failure"` and `cause: errorMessage(err)`, then `continue`s. New test at `execute.test.ts:429-507` locks the 4 behavioral guarantees. |

---

### Required Artifacts (from Plan 20-05 must_haves)

| Artifact                                                                  | Expected                                                                                                                            | Status     | Details                                                                                                          |
|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------|
| `orchestrators/import/execute.ts`                                         | installPlugin try/catch + readonly MarketplaceBlock.name/.scope + 3 defense-in-depth Object.freeze comments                          | VERIFIED   | `grep -c "result.unexpectedPluginFailures.push"` = 2 (line 657 new + line 758 pre-existing); `readonly name:` and `readonly scope:` both present at lines 304-305; `grep -B1 Object.freeze ... grep -c defense-in-depth` = 3 (one per freeze at lines 354, 491, 501) |
| `edge/handlers/plugin/import.ts`                                          | Comment block rewritten: cite `execute.ts:518-528` + `577-608` + installPlugin (Plan 20-05); drop `745-755` and "per-scope try/catch via executeScopedPlan" | VERIFIED (with stale-citation caveat) | `grep -c "execute.ts:518-528"` = 1, `grep -c "execute.ts:577-608"` = 1, `grep -c "execute.ts:745-755"` = 0, `grep -cE "WR-02\|Plan 20-05"` = 3. NOTE: actual `loadState` try/catch is at lines 521-531 and `addMarketplace` try/catch is at lines 580-611 -- the cited line ranges drifted by -3 due to Task 1's 12-line insert. Advisory comment only; no behavioral impact. See 20-REVIEW.md (post-closure) WR-01. |
| `tests/orchestrators/import/execute.test.ts`                              | New test `installPlugin.*unexpected.*throw\|partial.*cascade` (case-insensitive)                                                    | VERIFIED   | Test at line 429: `importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02)`; passes `ok 7`. |
| `eslint.config.js`                                                        | MSG-Block 1b comment extended with `orchestrators/import/**` parallel note                                                          | VERIFIED   | `grep -c "orchestrators/import"` = 3 (Block 1 ignore at line 163 + Block 1b doc note at lines 196-204 + inline anchor). |

---

### Key Link Verification

| From                                                                | To                                                                                  | Via                                                                                  | Status   | Details                                                                          |
|---------------------------------------------------------------------|-------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|----------|----------------------------------------------------------------------------------|
| `edge/handlers/**/*.ts` (all 13 edge files)                         | `shared/notify.ts::notifyUsageError` (V2 overload)                                  | `notifyUsageError(ctx, { message, usage })` inline payload                           | WIRED    | 30 V2 callsites; 0 V1 3-arg forms                                                |
| `edge/handlers/plugin/bootstrap.ts`                                 | `orchestrators/plugin/bootstrap.ts::bootstrapClaudePlugin`                          | Direct unwrapped call (no outer try/catch -- per Plan 20-03 D-20-03)                | WIRED    | File confirms `await bootstrapClaudePlugin({...})` with no catch                 |
| `edge/handlers/plugin/import.ts`                                    | `orchestrators/import/execute.ts::importClaudeSettings`                             | Direct unwrapped call (no outer try/catch -- per Plan 20-03 D-20-03)                | WIRED    | File confirms `await (deps.importClaudeSettings ?? importClaudeSettings)({...})` with no catch |
| `executeScopedPlan` (installPlugin call site, lines 646-667)        | `result.unexpectedPluginFailures` (mutable result accumulator)                       | try/catch wrapping `await installPlugin({...})`; catch pushes + `continue`s          | WIRED    | `grep -c "result.unexpectedPluginFailures.push"` = 2; one in new catch at line 657, one pre-existing in `dispatchFailedOutcome` at line 758 |
| `executeScopedPlan` (catch handler)                                 | `buildImportNotificationMarketplaces` (V2 mapping at `execute.ts:457-466`)         | The pushed entry round-trips through the unexpectedPluginFailures->PluginFailedMessage{reasons:["not in manifest"]} mapping | WIRED | Test at line 429-507 asserts the round-trip end-to-end: `assert.match(message, /⊘ boom \(failed\) \{not in manifest\}/)` |
| `importClaudeSettings` outer for-loop                               | `notify(opts.ctx, opts.pi, { marketplaces })` at execute.ts:808                     | Single final emission per import; survives in-scope try/catch + outer-loop iteration | WIRED    | Code path verified by direct read; behavioral lock by new WR-02 test (single-scope path only -- cross-scope gap noted in regressions) |
| `eslint.config.js::MSG-Block 1`                                     | `orchestrators/import/**`                                                           | `ignores:` entry at line 163                                                          | WIRED    | Confirmed                                                                         |
| `eslint.config.js::MSG-Block 1b`                                    | `orchestrators/import/**` (NOT ignored)                                             | Doc-note paragraph at lines 196-204 + Block-1b `ignores:` at line 209 lists only marketplace/** | WIRED    | Confirmed -- MSG-GR-3 still applies to `orchestrators/import/**`               |

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 20 is a pure migration (mechanical signature changes + import cleanup + Plan-20-05 error-boundary hardening). No new rendering surfaces or data sources are introduced. The renderer in `shared/notify.ts` is unchanged; catalog UAT (SC #4) is the byte-form gate and is GREEN.

The new WR-02 try/catch routes a previously-uncaught error into an existing data flow (`result.unexpectedPluginFailures` -> `buildImportNotificationMarketplaces` at lines 457-466 -> `PluginFailedMessage { reasons: ["not in manifest"] }`); the V2 mapping is the same one already used by `dispatchFailedOutcome` for structured `status: "failed"` returns from `installPlugin`. End-to-end flow locked by `tests/orchestrators/import/execute.test.ts:429-507`.

---

### Behavioral Spot-Checks

| Behavior                                                              | Command                                                                | Result                            | Status |
|-----------------------------------------------------------------------|------------------------------------------------------------------------|-----------------------------------|--------|
| Catalog UAT byte-equality runner                                      | `node --test tests/architecture/catalog-uat.test.ts`                   | 3/3 pass, exit 0                  | PASS   |
| Import orchestrator test suite (covers new WR-02 lock-test)           | `node --test tests/orchestrators/import/execute.test.ts`               | 17/17 pass, exit 0                | PASS   |
| WR-02 lock-test subtest present and named correctly                   | `node --test ... 2>&1 \| grep -iE "installPlugin.*unexpected.*throw\|partial.*cascade"` | ok 7 - importClaudeSettings catches unexpected installPlugin throws and surfaces a partial cascade row (WR-02) | PASS   |
| Edge import handler test suite (post-Plan-20-03 catch-all drop intact) | `node --test tests/edge/handlers/import.test.ts`                       | 5/5 pass, exit 0                  | PASS   |
| Full `npm run check` (typecheck + ESLint + Prettier + tests)          | `npm run check`                                                        | 1364 pass / 0 fail / 2 todo, exit 0 | PASS   |

---

### Probe Execution

No probes declared in any of Plans 20-01..20-05 PLAN files. The phase uses `npm run check` and per-plan `node --test` runs as the verification mechanism; all GREEN above.

| Probe                         | Command                                              | Result | Status |
|-------------------------------|------------------------------------------------------|--------|--------|
| Full check suite              | `npm run check`                                      | exit 0 | PASS   |
| Catalog UAT                   | `node --test tests/architecture/catalog-uat.test.ts` | exit 0 | PASS   |

---

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                                                | Status    | Evidence                                                                                                                              |
|-------------|---------------------|--------------------------------------------------------------------------------------------------------------------------------------------|-----------|---------------------------------------------------------------------------------------------------------------------------------------|
| SNM-23      | Plans 20-01..20-05  | All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers migrated to V2 `notifyUsageError(ctx, structuredUsageError)`; V1 three-argument signature has no remaining callers | SATISFIED | 30 V2 callsites confirmed; 0 V1 3-arg forms; behavior also hardened against unexpected installPlugin throws (Plan 20-05 refinement). Phase 21 deletes the V1 overload per REQUIREMENTS.md SNM-22 deletion half. |

REQUIREMENTS.md still shows SNM-23 as `Pending` (line 100). This verification confirms the migration half (the part Phase 20 owns) is complete. The deletion half closes in Phase 21 via SNM-22.

No orphaned requirements: SNM-23 is the only requirement mapped to Phase 20 per REQUIREMENTS.md line 116 (`Phase 20 (1: SNM-23)`).

---

### Anti-Patterns Found

| File                                                                            | Line       | Pattern                                                                | Severity | Impact                                                                                                                                                              |
|---------------------------------------------------------------------------------|------------|------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `edge/handlers/plugin/import.ts`                                                | 52         | Stale line citation: `execute.ts:518-528` -- actual loadState catch at 521-531 | WARNING  | Advisory comment only -- no behavioral impact. REVIEW.md (post-closure) WR-01.                                                                                      |
| `edge/handlers/plugin/import.ts`                                                | 53         | Stale line citation: `execute.ts:577-608` -- actual addMarketplace catch at 580-611 | WARNING  | Advisory comment only -- no behavioral impact. REVIEW.md (post-closure) WR-01.                                                                                      |
| `orchestrators/import/execute.ts`                                               | 644        | Stale citation: `importClaudeSettings:787` -- actual final notify() at execute.ts:808 (off-by-21 due to Task 1's 12-line insert + the new WR-02 fix's comment lines) | WARNING  | Advisory comment only -- no behavioral impact. REVIEW.md (post-closure) WR-01.                                                                                      |
| `tests/orchestrators/import/execute.test.ts`                                    | 435, 494   | Same stale `importClaudeSettings:787` citation (off-by-21)              | WARNING  | Comment in test only -- no behavioral impact. REVIEW.md (post-closure) WR-01.                                                                                       |
| `tests/orchestrators/import/execute.test.ts`                                    | 429-507    | WR-02 lock-test covers in-scope continuation only -- cross-scope continuation guarantee not regression-tested | WARNING  | Behavior is correct in the code (try/catch + `continue` keeps `executeScopedPlan` returning normally, outer loop iterates). Test gap only; future refactor could regress silently. REVIEW.md (post-closure) WR-02. |
| `orchestrators/import/execute.ts`                                               | 510        | `eslint-disable-next-line sonarjs/cognitive-complexity` on `executeScopedPlan` -- IN-04 explicitly DEFERRED per Plan 20-05 `<gap_inputs>` | INFO     | No code change required; the WR-02 catch handler increased cognitive complexity by ~1, widening the gap to threshold. REVIEW.md (post-closure) IN-01.            |
| `orchestrators/import/execute.ts`                                               | 332-342, 468-474 | `importWarningReason` dead-arm pair (`marketplace-failed`, `unmappable-marketplace-source`) -- helper broader than caller after A1 DROP filter | INFO     | Helper is defensively broad; caller `buildImportNotificationMarketplaces` filters the two unreachable reasons before invocation. Not a bug. REVIEW.md (post-closure) IN-02. |

No `TBD`, `FIXME`, or `XXX` debt markers found in modified files. No unreferenced markers. No stub patterns. All anti-patterns above are comment-quality or test-coverage observations only; none block the phase goal.

---

### Human Verification Required

#### 1. WR-01 (post-closure REVIEW.md) -- Stale line citations re-introduced by Plan 20-05 itself

**Test:** Read `edge/handlers/plugin/import.ts:52-63` and `orchestrators/import/execute.ts:644` and `tests/orchestrators/import/execute.test.ts:435,494`. Verify which option to apply:
- **Option A (low-effort):** Update citations to current line numbers: `execute.ts:521-531` (loadState wrap), `execute.ts:580-611` (addMarketplace wrap), and `importClaudeSettings (execute.ts:808)` for the final notify() refs.
- **Option B (durable):** Replace line-anchored citations with function-anchored citations (REVIEW.md WR-01 §Fix option B). Pair with a one-line gap-closure self-check that verifies cited ranges actually contain the cited construct.
- **Option C (accept):** Explicitly accept the off-by-3 / off-by-21 drift as advisory-only.

**Expected:** A documented decision on Option A / B / C. The same bug class was closed by the v1 REVIEW.md's WR-03 and re-introduced by Plan 20-05 within the same plan run -- a durable mitigation (Option B + a lint-time check) would prevent the third recurrence.

**Why human:** Line-citation drift in comments and tests is not machine-verifiable. The drift produces no test failure or type error. Only a human can decide whether the cost of Option A/B exceeds the value of fixing advisory comments.

#### 2. WR-02 (post-closure REVIEW.md) -- Cross-scope continuation regression test gap

**Test:** Review the new WR-02 lock-test at `tests/orchestrators/import/execute.test.ts:429-507`. Decide whether to add a sibling test exercising cross-scope continuation (`selectedScopes: ["project", "user"]` with `installPlugin` mock throwing on scope A and succeeding on scope B; assert both scopes attempted + single merged `notify()` emission), or accept the existing coverage.

**Expected:** Either (a) a sibling test added (REVIEW.md WR-02 §Fix provides a minimal scaffold), or (b) explicit acceptance that the existing in-scope lock-test plus the unmodified `for (const scopePlan of plan.scopes)` outer loop at `importClaudeSettings:790-792` (which iterates regardless of inner per-plugin loop state) is sufficient regression guard.

**Why human:** The behavior is correct in the code as it stands (the try/catch routes throws into `result.unexpectedPluginFailures` and `continue`s the per-plugin loop, so `executeScopedPlan` returns normally and the outer per-scope for-loop iterates to scope B). The risk is regression-only: a future refactor could silently break cross-scope continuation. Only a human can weigh the cost of writing the test against the regression risk.

---

### Gaps Summary

No blocking gaps. All 5 ROADMAP Success Criteria for Phase 20 are VERIFIED GREEN by direct codebase inspection and test execution. SNM-23's migration half is complete; the deletion half closes in Phase 21 via SNM-22.

Plan 20-05's gap closure delivered all 6 actionable items it claimed (WR-01, WR-02, WR-03, IN-01, IN-02, IN-03 from the v1 REVIEW.md); IN-04 was explicitly deferred per `<gap_inputs>`.

Two new human-verification items surface from the refreshed 20-REVIEW.md (post-closure):

1. **WR-01 (post-closure):** Plan 20-05 itself re-introduced the same stale-line-citation class of bug that the prior REVIEW.md's WR-03 had closed. Off-by-3 for `import.ts:52-53` (cited `execute.ts:518-528` and `577-608` -- actual 521-531 and 580-611). Off-by-21 for the `importClaudeSettings:787` refs in `execute.ts:644` and `execute.test.ts:435,494` (actual: execute.ts:808). Advisory comment quality only; no behavioral impact.

2. **WR-02 (post-closure):** The new lock-test covers in-scope per-plugin loop continuation (`selectedScopes: ["project"]`) but not cross-scope continuation. The behavior is correct in the code; a future refactor could regress the cross-scope guarantee silently.

Both items are warning-level, non-blocking. The phase goal -- "every remaining call site uses the v2 structured entrypoints; no code outside `shared/notify.ts` calls the V1 severity-named wrappers or the V1 three-argument `notifyUsageError`" -- is observably achieved in the codebase. Plan 20-05's behavioral hardening on the import path (the WR-02 try/catch) is correctly in place and test-locked end-to-end. The phase is functionally complete pending human disposition of the two REVIEW.md (post-closure) advisory items above.

---

_Verified: 2026-05-27T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
