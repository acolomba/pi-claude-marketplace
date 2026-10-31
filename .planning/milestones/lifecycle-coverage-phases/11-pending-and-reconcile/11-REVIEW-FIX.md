---
phase: 11-pending-and-reconcile
fixed_at: 2026-10-23T09:30:00Z
review_path: .planning/phases/11-pending-and-reconcile/11-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 11: Code Review Fix Report

**Source review:** .planning/phases/11-pending-and-reconcile/11-REVIEW.md

| ID | Severity | Outcome | Commit |
| --- | --- | --- | --- |
| CR-01 | Critical | Fixed: the nine integration tests expect `v1.0.0` on the reconcile `(installed)` rows. An import row in `reserved-record-keys.test.ts` keeps its version-less form, because import has its own path (Phase 13 candidate). | `cb489a34` |
| WR-01 | Warning | Fixed: the REC-04 scenario declares `ghost` before `demo`. The reconcile tries `ghost` first, and the rows state that order. | `29c0422f` |
| WR-02 | Warning | Fixed: removed the stale "carries no version" comment in `apply.test.ts`. | `cb489a34` |
| IN-01 | Info | Fixed: the CHANGELOG bullet now says "a reload" and is under 25 words. | `cb489a34` |
| IN-02 | Info | Partly fixed: the `docs/output-catalog.md` reconcile example and its fixture show `v1.0.0`, and the catalog byte pin moves from 46 623 to 46 637. Skipped: the `pending.feature` Background still offers `alpha`, `beta`, and `gamma` to every scenario. One `offers these plugins` step serves all scenarios, and extra catalog plugins change no seed result. | `cb489a34` |

**Verification:** `node --test test/integration/*.test.ts` 232/232; catalog-uat tests 71/71; `npx cucumber-js features/plugin/pending.feature features/plugin/reconcile.feature` 12/12; `npm run check:features` exit 0; final `npm run check` on `29c0422f` recorded in 11-VERIFICATION.md.
