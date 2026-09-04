---
gsd_summary_version: 1.0
quick_id: 260821-kkp
status: complete
date: 2026-08-24
branch: features/cross-scope-install-remedy
commits:
  - eaa82289 feat(completion) offer --local on the six write-target verbs
  - 300b25dd fix(install) name both remedies when the marketplace is in the other scope
  - 83db6340 fix(notify) name the scope a missing marketplace is not added to
  - f53b146c fix(notify) blame the plugin, not the marketplace, on a scope miss
  - b735b939 docs(backlog) record ARGS-01 edge parse-layer leniency
  - 3ca1d662 Merge origin/main (CM-4 nested command discovery)
---

# Summary -- 260821-kkp

Supersedes the install half of PR #142. That PR's completion half was sound
and is carried over here; its install half is replaced.

The plan's Task 1 shipped in a form the plan does not describe. Read the
deviation section below before the plan.

## Deviation: the trailer was designed, built, rejected, and replaced

The plan specified a fourth frozen prose TRAILER beneath the row, naming both
remedies. It was built, then rejected in operator review on two grounds:

1. The brace was hard-coded to a one-element literal, not type-blocked. The
   `reasons` array is genuinely multi-valued -- `composeReasons` takes the full
   `readonly Reason[]` -- so the fact belonged in the existing closed set, not
   in new machinery beside it.
2. Trailer prose must name a command, which binds it to `install`. Ten
   construction sites across eight files render this same row. A state token is
   verb-neutral; a trailer is not.

`crossScopeRemedyTrailerFor` is deleted. `docs/messaging-style-guide.md` still
records three trailers, not four.

A second reset followed. The first token draft added ONE new member beside the
existing `not added`. Operator instead renamed the pre-existing token and
declared BOTH directions, accepting the blast radius explicitly ("i don't care
what the impact is, we're renaming").

## What shipped

**Three structural tokens, replacing one.** `REASONS` now carries:

| Token | Condition |
|-------|-----------|
| `marketplace not added` | absent from BOTH scopes (renamed from `not added`) |
| `marketplace not added to user scope` | exists at project scope only |
| `marketplace not added to project scope` | exists at user scope only |

`notAddedReasonFor` (`shared/notify.ts`) selects among them from
`presentInOtherScope` + `scope`. `renderMarketplaceNotAdded` ends with
`composeReasons([...])` like every other row -- the brace is no longer
hard-coded. All three are excluded from `ContentReason` (TYPE-02 / D-46-02):
they describe the marketplace SUBJECT, so a plugin row cannot carry one.
`REASONS.length` pin 39 -> 41.

**The probe moved to the marketplace side.** `marketplaceInOtherScope` and the
new `crossScopeFlag` live in `orchestrators/marketplace/shared.ts`, NOT
`orchestrators/plugin/shared.ts` as the plan said. The D-11 cycle gate forbids
plugin and marketplace LEDGER modules from importing each other in either
direction; `marketplace/shared.ts` is the module it leaves reachable from both
families, and both families now need the probe.

**Every command carries it, not just install.** `install`, `info`, `update`,
`reinstall`, `uninstall`, `enable`, `disable`, and the three `marketplace`
verbs. The plan wired only the standalone `install` arm.

**The five lifecycle verbs blame the PLUGIN.** Operator split this out as a
follow-up: `uninstall --scope project` against a user-scope marketplace should
not say the marketplace is missing, because adding it there would not make the
command succeed -- nothing was installed there either. `missIsNotInstalled`
(`orchestrators/plugin/shared.ts`) draws the line:

- container exists in EITHER scope -> plugin row, `{not installed}`
- container absent from BOTH -> marketplace row, so a mistyped marketplace name
  is not disguised as an uninstalled plugin

`uninstall`/`enable`/`disable` reuse the existing `emitAlreadyGone`
(`(failed) {not installed}`); `update`/`reinstall` render `(skipped)
{not installed}` and shift severity `error` -> `warning`, because a skip is not
a failure. `uninstall` stays `error` -- its render map has no `skipped` arm.

**Completion.** The shared `--local` catalog entry is `complete: true` with a
description, renamed `NON_COMPLETED_SCOPE_TARGET` -> `WRITE_TARGET_FLAG_ENTRY`.

## Decisions honored

- Stays a FAILURE. D-29 Locked / CMP-4 / PI-16: no user->project source
  fallback, no retarget. Severity and summary unchanged for `install`.
- The token REPLACES the plain form, never joins it. "Does not exist" and
  "exists, but not where you targeted" are competing claims about one subject.
- Scope word baked into each literal, not interpolated -- the closed set is a
  catalog of literals, and a template would defeat the enumeration pins.
- No remedy text on the row. `--local` selects the file within a scope and
  cannot resolve a scope miss. Pinned by assertion.
- Boolean field, not `hint?: string`.
- No invented requirement ID. Cites CMP-4 / SCOPE-01 / D-29 only; PR #142's
  fabricated `ATTR-11` is not carried over.

## Reachability, measured

`install` is the ONE verb that cannot render the project-direction token. CMP-3
lets a project-target install source a user-scope marketplace and ADOPTS it
into project scope, so the miss never occurs. Established empirically, not by
reading: a matrix run's scenario C was polluted when the install succeeded and
made later project-scope reads find the record.

## Two defects in PR #142 that this avoids

1. **Unguarded `loadState`.** The probe sits after
   `withLockedStateTransaction` returns and no edge handler catches, so an
   unreadable other-scope `state.json` replaced the failure row with an
   unhandled rejection and ZERO `ctx.ui.notify` calls. Reproduced on both
   branches before writing the fix. The probe catches and degrades to the plain
   token. Mutation-checked twice: blinding the probe fails the cross-scope
   test, stripping the guard reproduces #142's regression.
2. **Unreachable project-target arm** in #142's install-only design.

## Verification

- `npm run check` GREEN after the origin/main merge: 3644 unit (3643 pass,
  1 pre-existing skip), 21 integration.
- `pre-commit run --all-files`: all hooks pass except trufflehog, which fails
  structurally in a linked worktree (documented in CLAUDE.md). Cleared by the
  filesystem route: `verified_secrets: 0`, `unverified_secrets: 0`.
- Catalog UAT byte-equality holds; annotated-example count 173 -> 175.
- Live UAT: a disposable-sandbox driver exercised all three tokens against a
  real `marketplace add`-written `state.json` across scope roots -- the one
  thing the offline suite cannot prove. Mutation-proven twice. Still in
  gitignored `tmp/uat/`; promotion to `tests/live-uat/` is UNRESOLVED (needs a
  README section, a `fallow-ignore-file unused-file` marker, and a dupes check
  against the two existing canaries).

## Found in passing, filed not fixed

`ARGS-01` in `.planning/BACKLOG.md`: the edge parse layer accepts unknown long
flags on three marketplace verbs and surplus positionals on eleven, both
silently. Surfaced while checking what a usage error looks like. Filed because
the fix is not a pure tightening -- those three verbs also ignore `--local`, so
routing them through the existing gate would GRANT a flag their usage strings
do not advertise.

## Not done (deliberate)

- `SCOPE_TARGET_FLAG` (the exported name for `--local`) is still a misnomer now
  that the scope-vs-file axis distinction is explicit. Pre-existing exported
  symbol; flagged rather than renamed.
- PR #142 is closed as superseded rather than merged.
