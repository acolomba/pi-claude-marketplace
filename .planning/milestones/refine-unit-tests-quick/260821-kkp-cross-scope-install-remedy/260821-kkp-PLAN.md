---
gsd_plan_version: 1.0
quick_id: 260821-kkp
slug: cross-scope-install-remedy
date: 2026-08-21
branch: features/cross-scope-install-remedy
---

# Quick Task 260821-kkp: cross-scope install remedy + `--local` completion

A default-scope (`user`) `install` against a marketplace registered only at
project scope fails with a bare `⊘ mp [user] (failed) {not added}` row that
names neither where the container lives nor how to fix it. Separately,
`--local` is parse-accepted on six verbs and documented in every one of their
`USAGE` strings, yet completion never offers it.

Supersedes the install half of PR #142 (contributor `rakesh-vs`). That PR's
completion half is sound and is carried over; its install half is replaced.

## Decisions (locked by the operator)

- **Stays a failure.** D-29 is Locked: a user-target install may source only
  from user scope (CMP-4 / PI-16). No user->project source fallback, no
  retarget, no severity change. `{not added}`, `error`, and the summary line
  are unchanged.
- **Two remedies, in this order.** (1) add the marketplace at the scope the
  install targeted -- this makes the command the user typed work; (2) re-run
  the install at the scope the container lives in. Remedy 1 first: a bare
  `--scope` means the user chose nothing, not that they meant project.
- **`--local` must not appear in the remedy.** It selects the physical config
  file within a scope and cannot resolve a scope miss. Naming it conflates two
  axes and smuggles in a tracked-vs-untracked decision the failure never
  raised.
- **No invented requirement ID.** PR #142 fabricated `ATTR-11`; ATTR-01..10
  are the closed v1.10 set. Cite existing IDs only (CMP-4 / SCOPE-01 / D-29).

## Task 1 -- cross-scope remedy trailer

**Files:** `shared/notify.ts`, `orchestrators/plugin/shared.ts`,
`orchestrators/plugin/install.ts`

- `MarketplaceNotAddedMessage` gains `presentInOtherScope?: boolean`. A
  BOOLEAN, not prose: the orchestrator decides WHETHER, `notify.ts` owns the
  BYTES. A caller-composed `hint?: string` is forbidden --
  `docs/messaging-style-guide.md` line 9 states top-level free text is not
  expressible in `NotificationMessage`.
- `notify.ts` gains a frozen trailer builder beside
  `PARTIAL_INSTALL_HINT_TRAILER` / `PARTIAL_UPDATE_HINT_TRAILER` /
  `STALE_GATE_UPDATE_HINT_TRAILER`, interpolating the marketplace name and
  both scope labels internally.
- `renderMarketplaceNotAdded` appends it after the row separated by a BLANK
  line, matching every other trailer. No 2-space or 4-space indented prose --
  those indents mean plugin row and cause chain.
- `marketplaceInOtherScope` in `orchestrators/plugin/shared.ts`: returns
  `false` immediately unless the target scope is `user` (a project-target
  `marketplace-absent` means the CMP-3 project->user fallback ALREADY missed,
  so the other scope provably has no container -- no unreachable branch, no
  wasted read). Wraps `loadState` in try/catch and returns `false` on throw:
  the arm sits OUTSIDE the `withLockedStateTransaction` try/catch and the edge
  layer has no catch, so an unreadable other-scope `state.json` would
  otherwise replace the failure row with an unhandled throw and ZERO
  notifications. That is the regression PR #142 shipped.
- Wire into the standalone `marketplaceAbsent` arm only. Orchestrated (import
  cascade) mode returns the failed outcome without emitting -- unchanged.

**Verify:** byte-exact trailer test; bare row unchanged when absent in both
scopes; corrupt other-scope `state.json` still renders the bare row and does
not throw.

## Task 2 -- surface `--local` in completion

**Files:** `edge/flag-catalog.ts`

- Flip the shared `--local` entry to `complete: true` with a description
  naming the override file. Applies to install / update / uninstall /
  reinstall / enable / disable.
- Rename `NON_COMPLETED_SCOPE_TARGET` and correct the stale header comment
  claiming the parse/complete bits diverge.
- `passThroughFlagNames` filters by NAME, not by the `complete` bit, so no
  downstream behavior shifts.

**Verify:** exact-set completion assertions for all SIX verbs (#142 changed
six, asserted four).

## Task 3 -- docs and catalog lockstep

**Files:** `docs/output-catalog.md`, `docs/messaging-style-guide.md`,
`tests/architecture/catalog-uat.test.ts`,
`tests/architecture/notify-grammar-invariant.test.ts`, `CHANGELOG.md`

- New catalog state + fixture; bump the exact annotated-example count.
- Style guide: record the fourth frozen trailer beside the other three.
- Grammar-invariant fixture for the trailered variant.

## Gates

`npm run check` green, then `pre-commit run --all-files` (not scoped --files;
CI runs --all-files). Commit from the worktree with `SKIP=trufflehog` only
after a clean filesystem trufflehog scan. No PR -- operator reviews the diff.
