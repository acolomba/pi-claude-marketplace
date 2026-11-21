---
phase: 03-marketplace-layers-and-cross-scope-install
review_path: .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW.md
fix_report_path: .planning/phases/03-marketplace-layers-and-cross-scope-install/03-REVIEW-FIX.md
updated: 2026-11-22
open_critical: 0
open_warning: 0
---

# Phase 3: Code Review Disposition

Three review passes (--auto loop). Final review: 0 critical, 0 warning, 6 info.

| Finding | Severity | Disposition | Where |
|---------|----------|-------------|-------|
| CR-01 (iter 1) | blocker | fixed | 6a02d04: MA-13 checks every checkout entry and an empty staging directory |
| CR-02 (iter 1) | blocker | fixed | e592d8b: repeated url add keeps the stored record bytes |
| WR-01 (iter 1) | warning | fixed | 43c4b37: refused autoupdate and remove compare every file |
| WR-02 (iter 1) | warning | fixed | a0bda9e: seeding also matches a git-subdir url ending in `/` (product fix, unit + scenario rows) |
| IN-01, IN-02 (iter 1) | info | fixed | a0bda9e: one shared url identity helper; `r.git.git` false match closed |
| WR-01 (iter 2) | warning | fixed | 717dbda: MA-13 checks the user file's text |
| IN-01 | info | open | unreachable `git-subdir` branch in `deriveMarketplaceUrl` |
| IN-02 | info | open | seeding doc comments mention only `.git` |
| IN-03 | info | open | ownership marker in the project clone unchecked |
| IN-04 | info | open | url row of the remove Outline does not prove the update fetched |
| IN-05 | info | open | "changes nothing" checks compare bytes, not mtimes |
| IN-06 | info | open | overlong header line in `installation.steps.ts:22` |
