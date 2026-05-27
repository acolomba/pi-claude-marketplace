---
phase: 20-migration-wave-3-edge-handlers-usageerror
verified: 2026-05-27T18:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "WR-01 / WR-03: Verify stale comment in edge/handlers/plugin/import.ts:52-55 is acceptable as-is or updated"
    expected: "Comment accurately describes the error boundary contract (or a follow-up fix is scheduled). The current comment cites a non-existent try/catch at execute.ts:745-755 and overstates the per-scope safety guarantee."
    why_human: "Advisory comment quality is not machine-verifiable. The REVIEW.md WR-01/WR-03 findings are warning-level (not blocking), but the comment wording is observable only by human code readers. A human must decide whether to accept the stale reference or apply the suggested fix."
  - test: "WR-02: Verify the partial-result-loss risk on unexpected installPlugin throw is accepted or mitigated"
    expected: "Team has explicitly accepted D-20-03's design intent (catastrophic throws bubble to Pi runtime; partial cascade is lost) for the installPlugin case, or has scheduled Option A / Option B remediation from REVIEW.md WR-02."
    why_human: "Behavioral risk under rare failure conditions cannot be verified by grep or test run. The REVIEW.md explicitly flags this as a trade-off requiring a decision, not a defect introduced by Phase 20."
---

# Phase 20: Migration Wave 3 — Edge Handlers & UsageError Verification Report

**Phase Goal:** Every remaining call site — including all edge handlers and all
`notifyUsageError(ctx, msg, usage)` sites — uses the v2 structured entrypoints.
After this phase, no code outside `shared/notify.ts` calls the V1 severity-named
wrappers or the V1 three-argument `notifyUsageError`.

**Verified:** 2026-05-27T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                             | Status     | Evidence                                                                                                               |
|----|-----------------------------------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------------------------------------|
| 1  | Zero `notifySuccess` / `notifyWarning` / `notifyError` callers in `edge/handlers/**/*.ts`                                        | ✓ VERIFIED | `grep -rnE "^[^/]*notify(Success\|Warning\|Error)\(" extensions/pi-claude-marketplace/edge/handlers/` returns empty; one comment mention in add.ts is not a CallExpression |
| 2  | All V1 3-arg `notifyUsageError(ctx, msg, usage)` sites migrated; 30 V2 1-arg sites present; zero V1 form remains                  | ✓ VERIFIED | V1 grep (`notifyUsageError\(ctx,\s*"`) returns 0; V2 grep (`notifyUsageError\(ctx,\s*\{`) returns 30 across `edge/`    |
| 3  | MSG-* lint plugin `files:` globs cover no remaining source files; Block 1 effectively no-op against migrated codebase             | ✓ VERIFIED | `eslint.config.js` Block 1 `ignores` contains all 3 families (marketplace/**, plugin/**, import/**) at lines 161-163  |
| 4  | Catalog UAT byte-equality GREEN for every edge-handler output and every usage-error output against the v2.0 spec                  | ✓ VERIFIED | `node --test tests/architecture/catalog-uat.test.ts` exits 0; 3/3 subtests pass                                       |
| 5  | `npm run check` stays GREEN                                                                                                       | ✓ VERIFIED | `npm run check` exits 0; 1363 pass / 0 fail / 2 todo                                                                  |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact                                                                                | Expected                                                                 | Status     | Details                                                                                    |
|-----------------------------------------------------------------------------------------|--------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------|
| `edge/router.ts`                                                                        | 4 V2 `notifyUsageError(ctx, { message` swaps                             | ✓ VERIFIED | V1 grep returns 0 in `edge/`; confirmed via 30-count sum                                   |
| `edge/handlers/plugin/shared.ts`                                                        | 3 V2 `notifyUsageError` swaps                                            | ✓ VERIFIED | Same                                                                                       |
| `edge/handlers/marketplace/{add,autoupdate,list,remove,update}.ts`                      | 1 V2 swap each (5 files)                                                 | ✓ VERIFIED | Same                                                                                       |
| `edge/handlers/plugin/{install,update,reinstall,list}.ts`                               | 3/3/4/3 V2 swaps respectively                                            | ✓ VERIFIED | Same                                                                                       |
| `edge/handlers/plugin/import.ts`                                                        | 2 V2 swaps; `notifyError` dropped; `notifyUsageError` import retained    | ✓ VERIFIED | `grep notifyError import.ts` = 0; `grep notifyUsageError import.ts` >= 1                  |
| `edge/handlers/plugin/bootstrap.ts`                                                     | 3 V2 swaps; `notifyError` dropped; outer try/catch removed               | ✓ VERIFIED | File confirmed clean; catch-all wrapper gone; V2 form present                              |
| `orchestrators/import/execute.ts`                                                       | Single `notify(opts.ctx, opts.pi, { marketplaces })` at bottom of importClaudeSettings; V1 helpers retired | ✓ VERIFIED | `grep` returns line 787 `notify(opts.ctx, opts.pi, { marketplaces })`; V1 comment at 781 is documentation only |
| `orchestrators/import/index.ts`                                                         | `formatClaudeImportSummary` re-export removed                            | ✓ VERIFIED | `grep -c "formatClaudeImportSummary" index.ts` = 0                                         |
| `tests/edge/handlers/import.test.ts`                                                    | Catch-all test (`catches unexpected orchestrator throws`) deleted         | ✓ VERIFIED | `grep -c "catches unexpected orchestrator throws" tests/edge/handlers/import.test.ts` = 0 |
| `eslint.config.js`                                                                      | MSG-Block 1 `ignores` extended with `orchestrators/import/**`            | ✓ VERIFIED | Line 163 contains the entry; marketplace/** appears 2× (Block 1 + Block 1b); plugin/** 1×; import/** 1× |

---

### Key Link Verification

| From                                          | To                                                    | Via                                                        | Status     | Details                                                           |
|-----------------------------------------------|-------------------------------------------------------|------------------------------------------------------------|------------|-------------------------------------------------------------------|
| `edge/handlers/**/*.ts` (all 13 edge files)   | `shared/notify.ts::notifyUsageError` (V2 overload)    | `notifyUsageError(ctx, { message, usage })` inline payload | ✓ WIRED    | 30 V2 callsites confirmed; 0 V1 3-arg forms                       |
| `edge/handlers/plugin/bootstrap.ts`           | `orchestrators/plugin/bootstrap.ts::bootstrapClaudePlugin` | Direct unwrapped call (no outer try/catch)            | ✓ WIRED    | File confirms `await bootstrapClaudePlugin({...})` with no catch   |
| `edge/handlers/plugin/import.ts`              | `orchestrators/import/execute.ts::importClaudeSettings`    | Direct unwrapped call (no outer try/catch)            | ✓ WIRED    | File confirms `await (deps.importClaudeSettings ?? importClaudeSettings)({...})` with no catch |
| `orchestrators/import/execute.ts::importClaudeSettings` | `shared/notify.ts::notify`                     | Single `notify(opts.ctx, opts.pi, { marketplaces })` at line 787 | ✓ WIRED | Confirmed in file |
| `eslint.config.js::MSG-Block 1`               | `orchestrators/import/**`                             | Additive `ignores:` entry at line 163                       | ✓ WIRED    | Verified in eslint.config.js                                       |

---

### Data-Flow Trace (Level 4)

Not applicable. Phase 20 is a pure migration (mechanical signature changes + import cleanup). No new rendering surfaces or data sources are introduced. The renderer in `shared/notify.ts` is unchanged; catalog UAT (SC #4) is the byte-form gate.

---

### Behavioral Spot-Checks

| Behavior                                      | Command                                               | Result                          | Status  |
|-----------------------------------------------|-------------------------------------------------------|---------------------------------|---------|
| Catalog UAT byte-equality runner              | `node --test tests/architecture/catalog-uat.test.ts`  | 3/3 subtests pass, exit 0       | ✓ PASS  |
| `npm run check` (typecheck + lint + fmt + test) | `npm run check`                                     | 1363/1365 pass, 0 fail, exit 0  | ✓ PASS  |

---

### Probe Execution

No probes declared in PLAN files. The phase used `npm run check` and per-plan `node --test` runs as the verification mechanism, all documented in SUMMARY files and confirmed above.

| Probe                         | Command                                               | Result        | Status  |
|-------------------------------|-------------------------------------------------------|---------------|---------|
| Full check suite              | `npm run check`                                       | exit 0        | PASS    |
| Catalog UAT                   | `node --test tests/architecture/catalog-uat.test.ts`  | exit 0        | PASS    |

---

### Requirements Coverage

| Requirement | Source Plan        | Description                                                             | Status      | Evidence                                                          |
|-------------|-------------------|-------------------------------------------------------------------------|-------------|-------------------------------------------------------------------|
| SNM-23      | Plans 20-01..20-04 | All `notifyUsageError(ctx, msg, usage)` call sites across edge handlers migrated to V2 `notifyUsageError(ctx, structuredUsageError)`; V1 three-argument signature has no remaining callers | ✓ SATISFIED | 30 V2 callsites confirmed; 0 V1 3-arg forms; Phase 21 deletes the V1 overload per REQUIREMENTS.md |

REQUIREMENTS.md traceability: SNM-23 maps to Phase 20 (Pending status in the table — this verification confirms it is now complete on the migration half; deletion half closes in Phase 21 via SNM-22).

---

### Anti-Patterns Found

| File                                                          | Line | Pattern                              | Severity | Impact                                                                                       |
|---------------------------------------------------------------|------|--------------------------------------|----------|----------------------------------------------------------------------------------------------|
| `edge/handlers/plugin/import.ts`                              | 53   | Stale line-number reference (`execute.ts:745-755`) in comment | WARNING | The cited range is inside `dispatchFailedOutcome` and the start of `importClaudeSettings`, not a try/catch. Advisory comment only — no behavioral impact. REVIEW.md WR-03. |
| `edge/handlers/plugin/import.ts`                              | 52-55 | Misleading "per-scope try/catch via executeScopedPlan" claim | WARNING | Overstates the safety guarantee; only `loadState` and `addMarketplace` are wrapped, not `installPlugin`. Advisory comment — no behavioral impact. REVIEW.md WR-01. |

No `TBD`, `FIXME`, or `XXX` debt markers found in modified files. No unreferenced markers. No stub patterns (no `return null`, `return []`, `return {}` where data is expected). The above anti-patterns are comment-quality issues only, flagged by REVIEW.md at warning level.

---

### Human Verification Required

#### 1. Stale Comment in import.ts (WR-01 / WR-03)

**Test:** Read `edge/handlers/plugin/import.ts:52-55`. Evaluate whether the comment accurately describes the error boundary contract, or apply the REVIEW.md WR-01/WR-03 fix.

**Expected:** Either (a) the comment is updated to accurately reference `execute.ts:518-528` (loadState wrap) and `577-608` (addMarketplace wrap) and drop the overstated "per-scope try/catch" claim, or (b) the team explicitly accepts the comment as-is since it is advisory and does not affect behavior.

**Why human:** Comment wording quality cannot be verified programmatically. The stale line reference does not cause a test failure or type error.

#### 2. Partial-Result-Loss Risk on Unexpected installPlugin Throw (WR-02)

**Test:** Review REVIEW.md WR-02. Decide whether the implicit acceptance of D-20-03 for the `installPlugin` case is intentional, or whether Option A (wrap `installPlugin` in try/catch and route to `unexpectedPluginFailures`) should be applied.

**Expected:** A documented decision: either "accepted — partial cascade loss for catastrophic installPlugin throws is intentional per D-20-03" (Option B), or a follow-up plan applying Option A.

**Why human:** Rare failure-mode behavior under edge conditions (unexpected installPlugin throw mid-loop) cannot be verified by grep or test run. The risk is real but arises only for programming bugs / unhandled host exceptions, not for any expected failure path.

---

### Gaps Summary

No blocking gaps. All 5 ROADMAP Success Criteria are verified GREEN by direct codebase inspection and test execution. The two human verification items (WR-01/WR-02 from the REVIEW.md) are advisory warning-level findings that do not block the phase goal. The phase goal — "every remaining call site uses the v2 structured entrypoints; no code outside `shared/notify.ts` calls the V1 severity-named wrappers or the V1 three-argument `notifyUsageError`" — is observably achieved in the codebase.

---

_Verified: 2026-05-27T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
