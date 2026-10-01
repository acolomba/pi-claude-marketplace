---
phase: "02"
slug: endpoints-that-answer-only-at-the-verbatim-url
recorded: "2026-09-27"
review: 02-REVIEW.md
fix_report: 02-REVIEW-FIX.md
fix_scope: critical_warning
iterations: 3
review_status_at_close: issues_found
findings_total: 17
fixed: 11
skipped: 6
open: 0
---

# Phase 2 — Code Review Disposition

One row per finding from `02-REVIEW.md` (the iteration-2 review), reconciled against
`02-REVIEW-FIX.md` (the iteration-3 restructure). `fixed` means a fix commit exists and the fix
report names the finding; `skipped` means it fell outside `fix_scope: critical_warning` and was
deliberately not attempted, not forgotten.

**Read the review's status with this ledger, not on its own.** `02-REVIEW.md` still carries
`status: issues_found`, because the loop reached its 3-iteration cap and no fourth review was run
to re-grade the restructure. Every Critical and Warning it lists was subsequently fixed; the six
Info findings it lists genuinely remain open as deferred work.

## Critical

| ID | Finding | Disposition | Evidence |
|----|---------|-------------|----------|
| CR-01 | The iteration-1 fix moved the parse-time cache identity, violating D-2-03 | fixed | `6cc37bd1` — seam split into two compositions with no call edge; orchestrator independently confirmed `IDENTITY_DIFFS=0` against the pre-phase parser at `130d68a9` over 8 inputs, including the restored `github.com/o/r/#main` rejection |
| CR-02 | Object-form `url` sources bypassed the https-only scheme gate; the phase routed the wire URL through the attacker-controllable `raw` field | fixed | `6cc37bd1` — object arm funnelled through `parseUrlSourceForm`; closes a gap that predated the phase on the `url` field as well as the phase's own `raw` extension |

## Warning

| ID | Finding | Disposition | Evidence |
|----|---------|-------------|----------|
| WR-01 | The `info --fetch` fixtures could not fail (fixture still `raw === url`) | fixed | `33ae4a41` — negative control: `plugin/info` failures move from 2 (via the github allowlist) to 2 via the url arm |
| WR-02 | Six of nine `networkUrl` threading sites were undiscriminated on the `url` arm | fixed | `d90400fc` — negative control: `marketplace/add` 0→1, `plugin/fetch` 0→2, `install-clone-probe` 0→2, `update-preflight` 0→1, `clone-cache` 0→1 |
| WR-03 | `install-clone-probe.test.ts` asserted nothing about the required `networkUrl` argument | fixed | `d90400fc` |
| WR-04 | The D-2-02 add case took its evidence from the test double's own message | fixed | `5caa7a3e` |
| WR-05 | `ensureGitSuffix`'s trailing-slash loop was unreachable from production | fixed | `6cc37bd1` |
| WR-06 | The mirror clone-seam comment claimed the wire url is "the only thing sent to the remote" — false on `refreshGitHubClone` | fixed | `d90400fc` |
| WR-07 | Forbidden historical narration in the `ensureGitSuffix` docstring | fixed | `6cc37bd1` |
| WR-08 | The iteration-1 WR-06 fix computed a value the callee discards | fixed | `d90400fc`; its import change shifted `addMarketplace` 540→545, remapped in `aec01604` (still 108 entries, 4 exceptions) |
| WR-09 | A `networkCloneUrl` case title promised a fragment its fixture lacked | fixed | `d90400fc` |

## Info — deferred, out of `fix_scope`

| ID | Finding | Disposition |
|----|---------|-------------|
| IN-01 | Redundant local rebinding of `args.networkUrl` (×2 in `clone-cache.ts`) | skipped — Info, not attempted |
| IN-02 | Tautological purity case in `clone-key.test.ts` | skipped — Info, not attempted |
| IN-03 | `CloneOptions.url` docstring overstates "verbatim the user typed" | skipped — Info, not attempted |
| IN-04 | Seven `cloneUrl`/`networkUrl` pairs in `fetch.test.ts` hold the same string | skipped — Info; incidentally narrowed by `d90400fc`, which made two of the seven genuinely differ |
| IN-05 | `networkCloneUrl` imported from two different modules within one phase | skipped — Info, not attempted |
| IN-06 | The idempotence case asserts one field where the whole value is the promise | skipped — Info, not attempted |

## Carried forward

One residual is recorded in `02-REVIEW-FIX.md` § "One residual, stated plainly" and pinned by a
test at `9e08b48a`: for a `url` source whose stored `raw` carries a trailing slash immediately
before a `#<ref>`, the reload identity differs from pre-phase (`…/o/r/#main` reloads as `…/o/r/`
where it previously recomputed `…/o/r`; the same holds for `…/o/r.git/#main`). Pre-phase, `add`
stored one value and every reload recomputed a different one, so this replaces a permanent
add-vs-reload key disagreement with agreement. The cost is one re-clone per affected plugin on the
first reload after upgrade. Not a blocker; recorded so it is a decision rather than a surprise.
