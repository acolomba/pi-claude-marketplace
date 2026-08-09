---
created: 2026-08-09
source: 97-REVIEW-FIX session (residual found while dispositioning WR-05)
---

# A disabled record keeps a stale `resolvedSource` when the source moves but the version does not

## Mechanism

`preflightUpdate` (`orchestrators/plugin/update.ts`) returns the `unchanged`
outcome as soon as `toVersion === fromVersion`, and it returns it BEFORE
`runThreePhaseUpdate` reaches the disabled-record branch. So
`refreshDisabledRecord` — the function that exists precisely to refresh a
disabled record's pin so a future `enable` re-materializes from the current
manifest — never runs when the version is unchanged.

That is correct for `version`, but `refreshDisabledRecord` also owns
`resolvedSource` and the `compatibility` block, and those can move
independently of the version:

- a path-source marketplace re-added from a different directory, or a plugin
  entry whose `source` path changed while its `plugin.json` version stayed put;
- a manifest entry that gained or lost an unsupported component kind without a
  version bump (the `compatibility` block drifts, and with it the availability
  discriminant that `enable` reads to pick its ledger gate — see
  `2026-08-09-enable-partial-remediation-affordance.md`, which is the
  user-visible symptom of the same staleness).

The record then points a future `enable` at a path that may no longer exist
(surfacing as the `(failed) {source missing}` enable row) or gates it on a
stale availability flag.

## Why deferred

Different axis from WR-05, which this was found beside: WR-05 alleged a
SPURIOUS write on the refresh path, and that claim does not hold (the same
short-circuit is what prevents it — see the ENBL-09 idempotency test and
`97-REVIEW-FIX.md`). This is the mirror-image gap, a MISSING write, and it was
outside the scope of `97-REVIEW.md` entirely — no finding covers it.

Fixing it means changing what the `unchanged` short-circuit means for disabled
records specifically, which touches the byte-pinned `(skipped) {up-to-date}`
row and the `unchanged` outcome partition shared with every enabled-plugin
update. Not a local repair.

## Where it lands

`orchestrators/plugin/update.ts`, at the `toVersion === fromVersion`
short-circuit in `preflightUpdate` and its interaction with the
`isRecordedButDisabled` branch in `runThreePhaseUpdate`.

Options:

1. Let the disabled-record branch run before the version short-circuit, and
   have `refreshDisabledRecord` no-op when nothing moved (the deep-equal guard
   drafted and reverted during the 97 fix pass — it is unreachable only because
   of the current ordering, so reordering makes it load-bearing); or
2. Keep the ordering and extend the short-circuit's own condition to compare
   `resolvedSource` + `compatibility` for disabled records, falling through to
   the refresh when either moved.

Either way, decide what the row says: the artifact state genuinely is
unchanged, so `(skipped) {up-to-date}` may still be right even when the pin
moved — but that should be an explicit, documented call rather than a
side effect of the ordering. Pin whichever contract is chosen in the ENBL-09
suite in `tests/orchestrators/plugin/update.test.ts`.
