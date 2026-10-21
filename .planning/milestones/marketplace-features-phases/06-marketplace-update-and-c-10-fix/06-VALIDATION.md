---
phase: "06"
slug: "marketplace-update-and-c-10-fix"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-18"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Cucumber 13.3.0 behavioral tests and Node.js `node:test` unit tests |
| **Config file** | `cucumber.json`, `package.json` |
| **Quick run command** | `npm run test:cucumber -- features/marketplace/update.feature features/marketplace/file-source-update.feature --parallel 1` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Target under 60 seconds per focused command; measure during execution |

---

## Sampling Rate

- **During each task:** Run its focused Cucumber/owner commands, then record the normal commit hook result
- **After every plan wave:** Run `npm run check`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** Target under 60 seconds per focused command; split selections if measured slower

---

## Per-Task Verification Map

The final plan set has eleven tasks in four sequential waves. Every task command in its PLAN has an adjacent fails_when description. The first tracer creates and runs the actual C-10 scenario before production edits; startup failure is not the required product red. Other new scenarios are authored before their focused commands run.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | FIX-01 | T-06-01, T-06-02, T-06-03 | Exact source and complete validated baseline commit together | behavioral + unit | `npm run test:cucumber -- features/marketplace/file-source-update.feature --parallel 1 --name '^An external manifest is refreshed from its original file$'` | ✅ | ✅ green |
| 06-01-02 | 01 | 1 | FIX-01 | T-06-03, T-06-05 | Info projects the exact resolved source and leaves state untouched | behavioral + unit | `node --test tests/orchestrators/marketplace/info.test.ts` | ✅ | ✅ green |
| 06-01-03 | 01 | 1 | FIX-01 | T-06-02, T-06-04 | Failed save/refresh preserves durable state; retry is safe | behavioral + unit | `node --test tests/orchestrators/marketplace/update.test.ts tests/orchestrators/marketplace/add.test.ts tests/transaction/with-state-guard.test.ts` | ✅ | ✅ green |
| 06-02-01 | 02 | 2 | UPD-01, UPD-02 | T-06-06, T-06-09 | Whole-result structural comparison distinguishes cosmetic and real changes | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name '^(An unchanged marketplace is up to date|A changed marketplace refreshes without plugin rows|Whitespace and object key order do not change a marketplace)$'` | ✅ | ✅ green |
| 06-02-02 | 02 | 2 | UPD-01, UPD-02 | T-06-06 | Raw unknown fields and array order survive comparison normalization | behavioral + unit | `node --test tests/domain/manifest.test.ts tests/orchestrators/marketplace/update.test.ts` | ✅ | ✅ green |
| 06-02-03 | 02 | 2 | UPD-10, UPD-14 | T-06-07, T-06-08 | Invalid/missing sources preserve registration and cannot select a decoy | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature features/marketplace/file-source-update.feature --parallel 1 --name '^(An invalid refreshed manifest leaves installed plugins unchanged|A repaired marketplace can be updated again|A missing marketplace directory leaves its registration intact|A missing original manifest does not use a conventional decoy)$'` | ✅ | ✅ green |
| 06-03-01 | 03 | 3 | UPD-03, UPD-04 | T-06-12 | Autoupdate controls versions without holding the marketplace lock over plugin work | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name '^(Autoupdate off preserves installed versions|Autoupdate exposes the offered version in a new session|Repeating an autoupdate does not reinstall a plugin)$'` | ✅ | ✅ green |
| 06-03-02 | 03 | 3 | UPD-05, UPD-06, UPD-13 | T-06-10 | New offers stay uninstalled; dropped entries stay installed/enabled | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name '^(An unchanged autoupdate is up to date|Autoupdate does not install newly offered plugins|Autoupdate keeps a plugin removed from the catalog)$'` | ✅ | ✅ green |
| 06-03-03 | 03 | 3 | UPD-04, UPD-13 | T-06-11, T-06-12, T-06-13 | Ordinary plugin failure preserves old installation and later ordered results | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name '^Autoupdate continues in installed order after a plugin fails$'` | ✅ | ✅ green |
| 06-04-01 | 04 | 4 | UPD-07 | T-06-14, T-06-15 | Every notice is fully compared immediately after its cascade | behavioral + unit | `npm run test:cucumber -- features/marketplace/update.feature --parallel 1 --name '^(A bare update preserves scope and insertion order with adjacent notices|Repeating a bare update is up to date without repeated notices)$'` | ✅ | ✅ green |
| 06-04-02 | 04 | 4 | UPD-07, UPD-08, UPD-09 | T-06-16, T-06-17 | Later scopes continue; empty/missing targets cannot fall back or corrupt names | behavioral + unit | `node --test tests/orchestrators/marketplace/update.test.ts tests/transaction/with-state-guard.test.ts` | ✅ | ✅ green |

Each source edit must also pass its direct paired coverage command. For the update orchestrator, run `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`.

The other changed production pairs are domain/manifest.ts, persistence/state-io.ts, orchestrators/marketplace/add.ts, and orchestrators/marketplace/info.ts under extensions/pi-claude-marketplace/. Each has its normal mirrored owner test and its own isolated direct-coverage command in 06-01-PLAN.md. No cache-source edit is planned. 06-SOURCE-AUDIT.md retains the complete 22-item edge lift: ten explicit truths, five structured concurrency backstops, seven flagged unclassified assumptions.

---

## Wave 0 Requirements

- [x] `features/marketplace/update.feature` — general Phase 6 update scenarios and exact output assertions
- [x] `features/marketplace/file-source-update.feature` — file-only C-10 scenarios under the suite's single-kind feature rule
- [x] `features/step_definitions/command.steps.ts` — row assertions that accept adjacent `mcp-config-notices` without weakening other result validation
- [x] `tests/orchestrators/marketplace/update.test.ts` — owner tests for refresh baselines, equality, failure continuation, and ordering
- [x] Paired tests for every additional changed TypeScript source file — 100% direct statement, branch, function, and line coverage

The existing Cucumber and `node:test` infrastructure is sufficient; no framework installation is needed.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Focused command latency measured; split selections above 60 seconds
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-19 — every requirement has automated coverage; full `npm run check` green at `97341ee4` (Node v26.11.1)

## Validation Audit 2026-10-19

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
