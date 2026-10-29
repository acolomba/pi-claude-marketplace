---
phase: "5"
slug: "marketplace-command-parity"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-26"
updated: "2026-10-28"
---

# Phase 5 — Validation

All nine plans and summaries are complete. MKT-01 through MKT-08 have behavioral automated evidence, except MKT-06, whose explicit acceptance route is the recorded D-PL5-14 decision. No new test is needed.

## Requirement map

| Requirement | Behavioral evidence | Automated command | Status |
| --- | --- | --- | --- |
| MKT-01 | Reserved names refused for untrusted sources; Anthropic GitHub source and bootstrap accepted; refresh refusal preserves state. | `node --test test/domain/name.test.ts test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts`; `npx cucumber-js features/marketplace/reserved-name.feature features/plugin/bootstrap.feature` | Green |
| MKT-02 | Hosted URL classification, bounded HTTPS fetch, add, refresh, autoupdate, stored catalog, and read-only operations without a request. | `node --test test/domain/source.test.ts test/platform/hosted-manifest-fetch.test.ts test/orchestrators/marketplace/add.test.ts test/orchestrators/marketplace/update.test.ts`; `npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/hosted-source-update.feature features/marketplace/autoupdate.feature` | Green |
| MKT-03 | Market alias dispatch, help, usage errors, and completions. | `node --test test/edge/router.test.ts test/edge/completions/provider.test.ts`; `npx cucumber-js features/marketplace/market-alias.feature` | Green |
| MKT-04 | Marketplace-level failure rows render a bare marketplace JSON id for add, update, remove, and info. | `node --test test/orchestrators/marketplace/shared.test.ts test/orchestrators/marketplace/update.test.ts test/shared/notification-json.test.ts`; `npm run test:cucumber` | Green |
| MKT-05 | The first @ or # separates owner/repo from ref; later @ remains in the ref and appears in info. | `node --test test/domain/source.test.ts`; `npx cucumber-js features/marketplace/github-source.feature` | Green |
| MKT-06 | D-PL5-14 records upstream parity: remove reports its own uninstalls; unmet dependents are reported at later load, pending, or apply. The requirement expressly permits a recorded choice. | Decision in `05-CONTEXT.md` and `05-09-SUMMARY.md`; `node --test test/orchestrators/marketplace/remove.test.ts`; `npx cucumber-js features/marketplace/remove.feature` | Decision satisfied; tests green |
| MKT-07 | Malformed manifest versus crash, missing recorded clone repair, missing path source refusal, EISDIR classification, and unchanged no-op outcome. | `node --test test/orchestrators/marketplace/add.test.ts`; `npx cucumber-js features/marketplace/failed-add.feature` | Green |
| MKT-08 | Partial remove subtracts all dropped axes, including hooks; the shared fold maps every dropped key with a compile-checked record. | `node --test test/orchestrators/plugin/shared.test.ts test/orchestrators/marketplace/remove.test.ts`; `npm run typecheck` | Green |

## Verification result

The final merged-tree owner audit at `b1dd3f15` passed all 13 modules in its focused batch: name and source parsing; router and completions; hosted fetch and catalog lifecycle; marketplace shared, update, remove, and info; the shared plugin fold; JSON notification rendering; and presentation redaction. The `marketplace/add` owner module initially hit the sandbox's Unix-socket `EPERM`; with socket permission it passed 198/198 tests. No product assertion failed.

The focused behavioral audit passed 16/16 scenarios and 140/140 steps. It exercised the alias, embedded-`@` shorthand, hosted add/update and redirect refusal, the reserved-name exemption and official bootstrap, marketplace-subject bare ids, credential masking, the accepted remove report, EISDIR classification, and the outline variants selected by those behaviors.

The parent's fresh final-tree `npm run check`, after the Phase 4 comment-only correction, exited 0: 1,142 Cucumber scenarios, 11,734 steps, and 309 merged LCOV records. Subsequent inputs through `b1dd3f15` are planning Markdown only, so the local-verification gate rule permits reuse of that passing combined-tree result for this validation update.

## Decision boundaries

- D-PL5-14 is the MKT-06 disposition; it does not require a new removal notification.
- D-PL5-04 keeps suffix-less HTTPS inputs on the existing git-source path. D-PL5-21 retains the update verb's 404 classification. Both are recorded MKT-02 choices.
- D-PL5-22's plugin-update sync path, import's own row ID, and MKTNAME-01 were assigned to later phases or backlog. The recorded review dispositions do not contradict a current Phase 5 requirement.

## Sign-off

- [x] All eight requirements map to executable tests or the expressly permitted recorded decision.
- [x] Every implemented user-visible requirement has a Cucumber scenario.
- [x] No missing Wave 0 fixture or test reference remains.
- [x] The final merged build inputs have a reusable passing full gate and fresh focused behavioral evidence.

**Approval:** validated; Nyquist compliant.
