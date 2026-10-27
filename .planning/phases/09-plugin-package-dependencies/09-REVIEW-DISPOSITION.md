# Phase 9 — Code Review Disposition

Review: `09-REVIEW.md` (commit 8b968b69). Fixes landed in a5ec61b8..adb28310; `npm run check` exited 0 at adb28310 (912 scenarios).

| Finding | Disposition | Commit |
| --- | --- | --- |
| CR-01 reinstall keeps old node_modules | Fixed: force is `revisionMoved(move)` (commit or version changed); scenario failed RED on the old code | 05c6c9c3 |
| CR-02 apply / dependency move drops the note | Fixed: `packageNote` on the updated outcome; apply prints it as a post-commit warning, `moveRow` puts it on the dependency row; scenario failed RED on the old code | adb28310 |
| WR-01 timeout needs stdio close | Fixed: settle one grace after SIGKILL even without `close` | fb837d45 |
| WR-02 redaction removes the folder | Fixed: the note names the marketplace, no absolute path | 869eff2a |
| WR-03 uninstall leaves node_modules | Follow-up (PKGDEP-05 proposed). Next install skips the step and keeps stale modules | — |
| WR-04 raw multi-line output | Fixed: strip ANSI and control chars, drop `npm warn` lines, strip `npm error` prefixes, join with "; " | eba851ee |
| WR-05 package ops not injectable | Fixed: `packageInstallOps` on the ledger seam and the runner | a5ec61b8 |
| IN-01..IN-08 | Follow-ups, recorded in `09-05-SUMMARY.md` addendum | — |

Residue from the fixes (not findings): `marketplace update` autoupdate rows (`orchestrators/marketplace/update.messaging.ts`) still drop the note; a grandchild process holding the pipes can outlive the run (no process-group kill).
