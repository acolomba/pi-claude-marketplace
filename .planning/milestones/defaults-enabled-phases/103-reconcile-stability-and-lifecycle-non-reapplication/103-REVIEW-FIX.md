---
phase: 103-reconcile-stability-and-lifecycle-non-reapplication
fixed_at: 2026-08-15
review_path: .planning/workstreams/defaults-enabled/phases/103-reconcile-stability-and-lifecycle-non-reapplication/103-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 103: Code Review Fix Report

**Source review:** `103-REVIEW.md` (1 critical, 5 warnings)
**Commits:** `e6b03b08`, `810c2785`, `a05fce3c`

## Summary

| Finding | Disposition | Commit | Regression test |
|---|---|---|---|
| CR-01 (both halves) | fixed | `e6b03b08` | `install.test.ts` "CFG-03 / D-103-16: an UNREADABLE local config aborts a flagless install ..." and "UAT-05 / CR-02: an UNREADABLE sibling config skips the marketplace adoption write ..."; `enable-disable.test.ts` "CFG-03 / D-103-13: an UNREADABLE local config aborts a flagless enable ..." |
| WR-01 | fixed | `e6b03b08` | same three tests (CR-01 and WR-01 share one root) |
| WR-02 | fixed | `e6b03b08` | none — comment-only |
| WR-03 | fixed | `810c2785` | none — the compiler is the gate |
| WR-04 | fixed | `e6b03b08` | none — no behavior to pin; covered by the existing suites |
| WR-05 | fixed | `a05fce3c` | none — comment-only |

All three behavioral tests were mutation-checked: with the collapsed condition
restored (`invalid` local read as "not declared locally") and the sibling
re-coerced to `{schemaVersion: 1}`, exactly those three fail and nothing else.
Restoring the fix returns the suites to green.

## The rule that replaced the collapse

`selectDeclaringConfigWriteTarget` now returns a discriminated
`DeclaringConfigWriteTarget`. The rule is: **abort when the file that DETERMINES
the destination cannot be read; never guess a destination.**

- `--local` typed: local file, unconditionally. Unchanged. The flag names the
  destination, so no file has to be read to find it.
- Flagless, local `invalid`: `{ kind: "unreadable", filePath }`. The callers
  route it into the CFG-03 sentinel each already owns (`configInvalid` in
  `install.ts`, `{ kind: "invalid-config" }` in `enable-disable.ts`), so the row
  is the `(failed) {invalid manifest}` row the verb already renders, naming the
  basename of the file that could not be read.
- Flagless, local `valid` and declares the key: local file.
- Flagless, local `valid` or `absent` without the key: base file.

The `unreadable` arm also covers the targeted file itself being invalid, which
is the pre-existing CFG-03 abort; the two collapse into one arm because the
caller's action is identical. Both call sites destructure the `selected` arm, so
TypeScript refuses to compile a caller that ignores the other one.

## Decision: an unreadable sibling SKIPS the adoption write

`synthesizeAdoptedMarketplaceSource` no longer coerces an invalid sibling to
`{schemaVersion: 1}`. It takes `sibling: ScopeConfig | undefined` and returns
`undefined` when the sibling could not be read, which the existing call-site
composition (`...(adoptedSource !== undefined && { marketplaces: ... })`) already
renders as "write the plugin key alone".

I chose skipping over aborting, and the deciding argument is not the general
"conservative action" one — it is that **the hazard the adoption write exists to
prevent cannot fire while the sibling is unreadable.** That write exists so a
bare plugin key is never left dangling for the reconcile planner to convert into
a `<marketplace not declared>` row plus a destructive clone removal (invariant 5).
But `orchestrators/reconcile/apply.ts:194-226` refuses to run `planReconcile` at
all for a scope whose base OR local file is `invalid` — it returns
`plan: undefined` and emits an `invalid-block` row per bad file, precisely
because coercing an invalid config to empty desired state would emit a
mass-uninstall plan. So while the sibling is broken there is no plan, hence no
dangling-declaration damage; once the user repairs it, the next pass either
finds the marketplace declared (the write was never needed) or plans against a
readable pair.

Against that, coercing is actively harmful and silent: a base file that DOES
declare the marketplace reads as declaring nothing, the synthesized bare
`{source}` entry shadows the base entry wholesale under CFG-02, and the moment
the base file is repaired the user's `autoupdate: false` is gone and the
marketplace starts auto-updating — a network-touching setting flipped with no
command and no prompt.

Aborting the whole operation was the third option and is worse than skipping:
the plugin entry itself is still correctly targeted, the marketplace adoption is
a side-effect of the CMP-3 fallback rather than the thing the user asked for,
and failing an otherwise-correct install because of an unrelated file the verb
does not write would be a much larger blast radius than the finding warrants.

The doc comment citing D-18 as precedent for the coercion is corrected on both
functions. `config-merge.ts:131-136` says the opposite in as many words: the
merge coerces the CONTRIBUTION while PRESERVING the invalid SIGNAL for the
caller to act on, and it computes a read rather than choosing a write target.
The citation was load-bearing and wrong, and it is what would have kept a future
reader from touching this.

## UX consequence: this is a NEW abort, and it is intended

Before this fix, a flagless `install` / `enable` / `disable` consulted
`claude-plugins.local.json` only as a membership-test sibling. An unreadable one
never blocked anything. It now aborts the operation with
`(failed) {invalid manifest}` naming `claude-plugins.local.json`.

That is deliberate. A loud, fixable error naming the file beats a silent write
into the file CFG-02 shadows, where the verb reports success, the merged view
never moves, and the next `/reload` plans the opposite of the command. It also
matches CFG-03's existing philosophy rather than extending it: `applyReconcile`
already treats an invalid `claude-plugins.local.json` as a hard block for the
entire scope and renders exactly this row for it. The standalone verbs were the
outlier, tolerating a file the load-time path already refuses to guess around.

A phase verifier should read this as an intended behavior change, not collateral.

## Intended behavior changes, before and after

1. Flagless `install` / `enable` / `disable`, unreadable `claude-plugins.local.json`:
   **before** the write landed in the base file and the verb reported success;
   **after** the operation aborts with `(failed) {invalid manifest}` naming
   `claude-plugins.local.json`, with no config write and no `state.json` write
   (the no-save abort discipline is asserted byte- and mtime-wise in both new
   tests).
2. Adoption gate with an unreadable sibling (either arm, `--local` included):
   **before** the sibling contributed `{}` and a bare `{source}` marketplace
   entry could be synthesized into the other file; **after** no `marketplaces`
   key is written.

No existing assertion was weakened, and none needed to move: all 46 pre-existing
`enable-disable.test.ts` cases and all 122 pre-existing `install.test.ts` cases
pass unchanged.

## One arm deliberately left as it was

`readDeclaredEnabled` still treats an unreadable sibling as contributing no
plugins. On every flagless arm that costs nothing: the selector aborts when the
local file is unreadable, and when the target IS the local file the key is
declared there by construction, so the base file is never the one that answers.
The sole arm where an `enabled` value can still be missed is a typed `--local`
over an unreadable BASE file — pre-existing, untouched by this phase, and out of
scope because the flag names the destination outright so no abort is owed there.
Documented in the function's doc comment so it reads as a known boundary rather
than an oversight.

## Verification

Run in the main checkout at `.worktrees/defaults-enabled` (worktree isolation is
off for this phase, so the gates run against the real `node_modules` and the
numbers below are reproducible from this tree).

- `npm run typecheck`: clean after every commit.
- `node --test` on `install.test.ts`, `enable-disable.test.ts`,
  `reconcile/apply.test.ts`, `architecture/import-boundaries.test.ts`:
  210 pass / 0 fail.
- `npm run check`: **exit 0** — 3518 tests, 3517 pass, 0 fail, 1 skipped. The
  skip is the known `pi-subagents` global-peer environment case. Baseline before
  the fixes was 3514 pass / 0 fail; the delta is exactly the three new tests.
- `pre-commit run --files <changed>` clean on every commit except the structural
  worktree TruffleHog git-mode failure, confirmed clean the sanctioned way with
  `trufflehog filesystem --results=verified,unknown --fail`
  (`verified_secrets: 0`, `unverified_secrets: 0`) before each commit.

---
*Phase: 103-reconcile-stability-and-lifecycle-non-reapplication*
*Fixed: 2026-08-15*
