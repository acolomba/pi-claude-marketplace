# Open-Closed Proof

**Status:** Normative -- the durable measurement that adding a new `claude:plugin` subcommand touches a small, fixed set of central files and zero lines of `shared/notify.ts` (MOD-05), and the deliberate catalog floor that bounds the "central section per rendered state" (MOD-06, per D-03). **Audience:** Engineers adding or reviewing new `claude:plugin` subcommands, and reviewers verifying the open-closed posture of the notification surface.

## Overview

This document is a written measurement (per D-02), not an architecture test. The user chose a documented walkthrough over an enforceable `notify.ts`-purity gate; nothing structurally prevents future grammar from creeping back into `notify.ts`, so this proof is the standing record of the target and the only automated gate at the milestone close is `npm run check` (GATE-03). It enumerates exactly which central files a new command touches today, after the two cross-cutting concerns (soft-dep markers and the hooks summary) left the `shared/notify.ts` monolith, and measures that end state against the baseline recorded in `.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md`.

Read the source, not a re-paste: the binding artifacts are `extensions/pi-claude-marketplace/edge/router.ts`, `extensions/pi-claude-marketplace/edge/register.ts`, and `docs/output-catalog.md`. The line spans below are pointers, current as of this milestone close; trust the files over the numbers.

## The target: 3 central files, 0 `notify.ts` edits

Adding a new subcommand that reuses the existing grammar (existing status tokens and reasons) touches these central files:

1. **`edge/router.ts`** -- registration only:

   - one `SubcommandHandlers` interface field (interface at `:26`-`:49`),
   - one `*_SUBCOMMANDS` tuple token plus any aliases (`TOP_LEVEL_SUBCOMMANDS` at `:55`-`:69`, `MARKETPLACE_SUBCOMMANDS` at `:75`-`:85`),
   - one switch `case` (top-level switch at `:143`-`:172`, marketplace switch at `:190`-`:213`),
   - one `*_USAGE` usage-string line (`TOP_LEVEL_USAGE` at `:87`-`:100`, `MARKETPLACE_USAGE` at `:102`-`:110`).

2. **`edge/register.ts`** -- one wiring line in the `handlers` object (`:78`-`:97`), the `make*Handler(pi[, deps])` entry that binds the verb to its handler.

3. **`docs/output-catalog.md`** -- one hand-authored H2 section with a `<!-- catalog-state: STATE -->` fenced block per new rendered state, consumed by `tests/architecture/catalog-uat.test.ts`. This central section is the accepted floor documented below (MOD-06 / D-03).

= **3 central files, 0 `notify.ts` edits.** The renderer spine, the envelope, the shared presentation vocabulary, and the two extracted concerns are all command-agnostic; a new command owns its grammar locally (command-local status sets and render maps) and the soft-dep / hooks concerns are self-contained, so no `notify.ts` line changes.

## The baseline it measures against

The coupling audit (`.planning/workstreams/notification-refactor/research/MESSAGING-COUPLING.md` section A.3, cited as prose -- that document's line numbers predate Phases 1-3 and are stale) recorded the pre-refactor cost:

- **New command, no new grammar:** **5 central files** -- `edge/router.ts`, `edge/register.ts`, `edge/completions/provider.ts`, `docs/output-catalog.md`, and the `catalog-uat.test.ts` fixtures (4 if the command takes no positional and no new flag, so `provider.ts` drops out).
- **New command with one new status token + one new reason:** **9-11 central edit-sites** -- the 5 above plus six distinct constructs inside `notify.ts` (status tuple, per-variant interface, union member, render arm, severity arm, reload arm), the `REASONS` / `BENIGN_REASONS` edits, the `notify-types.test.ts` length-locks, and the catalog status-token reference table. **`notify.ts` alone accounted for 6 of those edit-sites.**

The 9-11 figure assumed the pre-Phase-1 monolith where status tuples, per-variant interfaces, union members, render arms, and the severity/reload ladders all lived centrally in `notify.ts`. Phases 1-2 already collapsed those six central `notify.ts` edit-sites: command-local status sets and per-command render maps (MOD-01/02/03), caller-stamped severity and reload (deleting the central `cascadeSeverity` / `BENIGN_REASONS` / reload-token mapping), and the removal of the `notify-types.test.ts` length-locks. This milestone's contribution is the last two cross-cutting concerns: the soft-dep marker injection moved to `shared/concerns/soft-dep.ts` and the hooks summary moved to `shared/concerns/hooks.ts`. After that closure, adding a command needs **0 `notify.ts` edits even for new grammar**, because the grammar is owned locally and the concerns are self-contained.

## The honest caveat: partially irreducible

The locked D-02 target is the **3 grammar/registration files** above, and the proof holds for those. Two further central touch-points are partially irreducible (audit Part D) and are reported here rather than papered over as absolute zero-touch:

- **`edge/completions/provider.ts`** may still need a declarative descriptor when a new command introduces a novel positional or flag shape (the completion provider has to know the command's argument grammar to complete it). A command that reuses an existing positional/flag shape needs no provider edit.
- **`tests/architecture/catalog-uat.test.ts`** `FIXTURES` map gains one `(section, state)` entry per new rendered state -- the test-side mirror of the catalog section in (3) above.

Neither lives in `notify.ts`, so the 0-`notify.ts`-edits claim is unaffected; both are noted for honesty.

## MOD-06 catalog floor (D-03)

The catalog (`docs/output-catalog.md`) stays hand-authored: one central H2 section per new rendered state, with no generation or aggregation seam. This is a deliberate milestone boundary, not an oversight -- a generation/aggregation mechanism is explicitly deferred to a future milestone. The hand-authored catalog section is therefore the explicit, accepted **third central file** in the 3-central-files target above. The byte-equality gate (`tests/architecture/catalog-uat.test.ts` + `git diff --exit-code docs/output-catalog.md`) keeps the hand-authored catalog honest against the renderer.

## Evidence: `notify.ts` slimmed to envelope + reducer + shared vocabulary

`shared/notify.ts` line count: **3431 before** this milestone's Phase-4 extraction, **3315 after** (measured via `wc -l extensions/pi-claude-marketplace/shared/notify.ts` against the post-extraction file). The slimming is evidenced, not asserted.

**What LEFT** `notify.ts` this milestone:

- the soft-dep marker injection concern -> `shared/concerns/soft-dep.ts` (`DEPENDENCIES`, the `Dependency` type, the marker constants, and the pure `softDepMarkers` helper); `composeReasons` stays central and delegates its soft-dep branch to it,
- the hooks-summary concern -> `shared/concerns/hooks.ts` (`appendHooksBlock` plus the `ClaudeHookEvent` / `HookSummaryEntry` / `HookSummary` types); the info renderer calls into it.

**What STAYS central** in `notify.ts` (envelope + reducer spine + shared vocabulary): the `NotificationMessage` envelope and the `notify()` dispatcher; the reducer spine (severity max-reduce, OR-needsReload, tally, summary line); `isInfoKind`; the shared presentation vocabulary (`ICON_*`, `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, the core `composeReasons`, `pluginRow`, `joinTokens`); `RELOAD_HINT_TRAILER`; and the `redactAbsolutePaths` path-redaction security primitive (NFR-9), which is deliberately NOT a concern to extract.
