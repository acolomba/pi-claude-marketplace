---
phase: 07-git-errors-and-lock-discipline
iterations: 2
open: 0
---

# Phase 07 review disposition

Iteration 1 is `07-REVIEW.iter1.md`; iteration 2 is `07-REVIEW.md`. Fix details are in
`07-REVIEW-FIX.md`. Iteration 2 renumbered its Info findings, so each row names its
iteration.

| Iteration | Finding | Severity | Disposition | Commit or reason |
|-----------|---------|----------|-------------|------------------|
| 1 | WR-01 plugin update's marketplace refresh writes git with no scope lock | Warning | fixed | 96103d64 |
| 1 | WR-02 autoupdate cascade cause lines print raw local paths | Warning | deferred | the direct update path prints the same raw cause (D-PL7-12 parity); recorded in 07-CONTEXT Deferred (a66a932f) |
| 1 | IN-01 `nextUpdateStamp` throws at the largest Date | Info | fixed | e8ce1713 |
| 1 | IN-02 other `updatedAt` writers keep `new Date()` | Info | accepted | sub-millisecond window; outside this phase's files |
| 1 | IN-03 rule constants copied, not shared | Info | accepted | style only; no behavior change |
| 1 | IN-04a fetch reads `source missing` for a lock lost after the row read | Info | fixed | 11b2c5fd |
| 1 | IN-04b marketplace update cascade catch applies the refresh rule to a clone 404 | Info | accepted | unreachable in production |
| 2 | IN-01 update reads `unreadable manifest` for a lost lock | Info | fixed | 05614199 |
| 2 | IN-02 sync reads the marketplace record before taking the lock | Info | accepted | millisecond remove/re-add window; same class as the deferred unlocked-record items |
| 2 | IN-03 two stale comments | Info | fixed | d7301f35 |
| 2 | IN-04 a failed body plus a failed release loses the HTTP frame | Info | accepted | needs two failures at once; wrapper is in `transaction/with-state-guard.ts`, outside this phase |

Residual noted by the iteration-2 fixer, not a review finding: the update preflight's locked
mirror step and tag copy, and `info --fetch`'s locked probe, map only `StateLockHeldError`, so a
lock lost mid-body reads as a failed candidate or a fetch reason instead of `lock held`.
