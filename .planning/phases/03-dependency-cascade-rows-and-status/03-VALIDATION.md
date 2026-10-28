---
phase: "3"
slug: "dependency-cascade-rows-and-status"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
audited: "2026-10-28"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral), catalog UAT (`test/architecture/catalog-uat/`) |
| **Config file** | `package.json` scripts, `cucumber.json` |
| **Quick run command** | `node --test <test-path>` plus `npm run test:coverage:direct -- <source>`; one scenario: `npx cucumber-js --name '<title>'` |
| **Full suite command** | `npm run check` (never piped; read `$?`) |
| **Estimated runtime** | ~75 seconds for `npm run check` on this machine; owner tests a few seconds |

---

## Sampling Rate

- **After every task commit:** the owner test files, the changed pairs' direct coverage, and each changed or new cucumber scenario (the hook's `check:commit` runs no cucumber)
- **After every plan wave:** `npm run check` on the combined tree
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

See `03-RESEARCH.md` § Validation Architecture → Phase Requirements → Test Map for the requirement-level map; plans fill task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | CAS-07 | T-03-41, T-03-42 | offered versions are bounded | unit + cucumber | `node --test test/domain/dependency-range.test.ts test/orchestrators/plugin/constraint-fold.test.ts`; `npx cucumber-js features/plugin/update.feature` | ✅ | ✅ green |
| 03-01-02 | 03-01 | 1 | CAS-07 | T-03-41, T-03-42 | refusal versions are bounded | unit | `node --test test/orchestrators/plugin/dependency-move.test.ts` | ✅ | ✅ green |
| 03-02-01 | 03-02 | 1 | CAS-02 | T-03-43..T-03-46 | invalid root IDs fail without unsafe record access | unit + integration | `node --test test/domain/dependency-closure.test.ts test/orchestrators/plugin/install-cascade.test.ts test/orchestrators/plugin/install-cascade.messaging.test.ts test/shared/notification-mcp.test.ts test/integration/reserved-record-keys.test.ts` | ✅ | ✅ green |
| 03-02-02 | 03-02 | 1 | CAS-02 | T-03-43..T-03-46 | rendered invalid IDs remain printable | cucumber + catalog UAT | `npx cucumber-js features/plugin/install.feature`; catalog UAT tests | ✅ | ✅ green |
| 03-03-01 | 03-03 | 2 | CAS-01 | T-03-47, T-03-48 | every failed closure member is named | unit + cucumber | install-cascade owner tests; named `install-dependencies.feature` scenarios | ✅ | ✅ green |
| 03-03-02 | 03-03 | 2 | CAS-01 | T-03-47, T-03-48 | rolled-back and unvisited members appear once | unit + cucumber | install-cascade/install-flow owner tests; `npx cucumber-js features/plugin/install-dependencies.feature` | ✅ | ✅ green |
| 03-03-03 | 03-03 | 2 | CAS-01 | T-03-47, T-03-48 | output catalog preserves the complete failed closure | catalog UAT | catalog contract/parser/wire tests; install-cascade messaging test | ✅ | ✅ green |
| 03-04-01 | 03-04 | 3 | CAS-05 | T-03-49, T-03-50 | directory-pin refusal names each declarer | unit + cucumber | install-cascade owner test; named directory-pin scenario | ✅ | ✅ green |
| 03-04-02 | 03-04 | 3 | CAS-05 | T-03-49, T-03-50 | refusal fields are bounded | unit + catalog UAT + cucumber | dependency-range/install-cascade/install-outcome tests; `install-dependencies.feature` | ✅ | ✅ green |
| 03-05-01 | 03-05 | 4 | CAS-06 | T-03-51, T-03-52 | offline refusal names the version-in-range update | unit + cucumber | dependency-plan/install-cascade messaging/install-flow tests; `install-dependencies.feature` | ✅ | ✅ green |
| 03-05-02 | 03-05 | 4 | CAS-06 | T-03-51, T-03-52 | update and catalog expose the hint | cucumber + catalog UAT | `npx cucumber-js features/plugin/update-dependencies.feature`; catalog UAT tests | ✅ | ✅ green |
| 03-06-01 | 03-06 | 5 | CAS-03, CAS-04 | T-03-53, T-03-54 | partial availability preserves dependent status; git sources upgrade from recorded SHA | unit + cucumber + docs | list-flow owner test; CAS-03 install/list/info scenario; decision-ID checks | ✅ | ✅ green |
| 03-06-02 | 03-06 | 5 | CAS-01..CAS-07 | T-03-54 | the combined tree remains green | full gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (every new scenario uses existing step definitions).

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed — 7/7 requirements have automated coverage. The 2026-10-28 audit ran 15 focused Node test modules and six feature files (151 scenarios, 1,847 steps). CAS-03's added adversarial scenario passed with 13 steps; the full Cucumber suite passed 1,121 scenarios and 11,424 steps.

## Validation Audit 2026-10-28

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |
