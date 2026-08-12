---
phase: 98-lifecycle-regression-and-contract-documentation
reviewed: 2026-08-10T12:00:00Z
depth: standard
iteration: 2
files_reviewed: 29
files_reviewed_list:
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/helpers/source-scan.test.ts
  - tests/helpers/source-scan.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 98: Code Review Report (iteration 2)

**Reviewed:** 2026-08-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Re-review of the ten fix commits `f8575e3d..f805bea1` against `98-REVIEW.iter2.md`
(1 critical + 8 warnings) and `98-REVIEW-FIX.md`. Each claimed fix was verified at the
source rather than accepted from the report; the commits were then read as new code.

**All nine prior findings are genuinely fixed.** Per-fix verdicts are in the next section.
No fix regressed a sibling surface's byte contract, no closed set gained or lost a member,
no state write moved outside a guard, no lock was nested, no network surface entered a
network-free orchestrator, and no comment carries a forbidden `Phase NN` / `Pitfall N`
token (`WR-NN` / `CR-NN` are explicitly sanctioned anchors per
`.claude/rules/typescript-comments.md`).

Three NEW findings, all warnings, all arising from the fix commits themselves. Two are
loose ends of the WR-04 and WR-02 fixes that the fix report does not mention; the third is
a durability gap in the WR-03 fix's replacement type. None is a blocker: none produces a
wrong result today, and each is equally acceptable as a carried todo.

The recorded plan rulings (per-surface SEV-01 asymmetry on the reconcile projection, the
`not-installable` narrowing key, the plural tally pins, SEV-03 / WARN-01, the per-kind
LIFE-04 fixtures, the three documentation-only deferrals in `98-06-SUMMARY.md`) are honoured
and not re-raised.

## Per-fix verification

**CR-01 — FIXED.** `STALE_GATE_UPDATE_HINT_TRAILER` (`shared/notify.ts:2492`) reads
`Run update --partial on this plugin, then enable it again.` The renderer gate is split into
two mutually exclusive status arms (`notify.ts:3766-3782`), so the `partially-upgradable`
XSURF-03 literal stays byte-frozen and only the enable-failure narrowing selects the new one.
The literal appears in exactly four places and is byte-identical in all four: the renderer,
`docs/output-catalog.md:2247`, the style guide's frozen-trailer inventory
(`docs/messaging-style-guide.md:145`), and the orchestrator byte assertion
(`tests/orchestrators/plugin/enable-disable.test.ts:1014`). The cause-chain trailer still
renders below the hint. The remedy is now correct end to end: after WR-01 the stale-gate
record is CLEAN + disabled, plain `update` declines it, `update --partial` re-pins it to
`installable: false`, and the next `enable` derives `partial = true` from that record
(`enable-disable.ts:245`) and succeeds. The new edge test pins the fact the wording had to
respect (`enable … --partial` → `Unknown flag: "--partial".`).

**WR-01 — FIXED.** `widensPartialGate` (`orchestrators/plugin/update.ts:988-993`) is
`isRecordedButDisabled(record) && !record.compatibility.installable`. The ENBL-05 predicate
remains the sole reader of the disabled marker, so the drift-twin gate stays intact. Both
missing cases are seeded: a clean disabled record with a newly-degrading candidate keeps the
`(partially-upgradable)` decline row and an untouched record (version, `installable`,
`unsupported`, `enabled`, `resources.*` all asserted), and the same record with `--partial`
consents and re-pins.

**WR-02 — FIXED.** The refresh arm returns `partition: "skipped"` with
`reasons: ["already disabled"]` (`update.ts:1637-1644`); both tokens are inherited closed-set
members (`already disabled` at `shared/notify-reasons.ts:43`, inside `IDEMPOTENT_REASONS`, so
`cascadeSkipSeverity` keeps info and emits no summary line). The reachability claim is
correct: `preflightUpdate` returns `unchanged` on `toVersion === fromVersion` at
`update.ts:1131-1141`, before the disabled branch, so the arm only runs when the pin moved —
the old `{up-to-date}` was false on every render. The idempotency test now asserts the two
calls render DIFFERENTLY (first `{already disabled}`, second `{up-to-date}`), which is the
honest form of the equality it previously asserted. Catalog block, catalog prose and the
catalog-UAT fixture are repinned together. See WR-10 below for an unremarked consumer.

**WR-03 — FIXED (with WR-11 below).** The `installed` arm is
`Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">` (`install.ts:252`) and
`unsupported` is now populated from `installCtx.resolved` on the `partially-available` arm
(`install.ts:1882-1884`), omitted otherwise. The `Omit` spelling instead of `Pick` is
deliberate and correct: `'"unsupported"'` is in `ABSENT_STATUS_LITERALS` of the D-75-01 guard
(`tests/architecture/partial-vocabulary-guard.test.ts:165`), which a `Pick` key would have
spelled. The duplicate `stagedAgents` / `declaresAgents` vocabulary is gone and no consumer
broke — the only remaining reader (`reconcile/apply.ts:682-683`) lifts them off the ENABLE
outcome, not the install one. The overclaiming "becomes a compile error" sentence was
deleted rather than restated.

**WR-04 — FIXED for the backfill arm (with WR-09 below).** `PluginInstalledOutcome` and
`PluginBackfilledOutcome` both now inherit
`Pick<EnableDegradationSignals, "orphanRewake" | "degradedKinds">`, so all three
ledger-driven arms read one vocabulary. `maybeBackfillPlugin` threads `orphanRewake` off its
own offline resolution and `degradedKinds` off the reinstall outcome
(`reconcile/apply.ts:1240-1247`), each omitted when empty. `backfilledRowFromOutcome` mirrors
`enabledRowFromOutcome` exactly: emit order `{orphan rewake}` → malformed kinds → dropped
kinds, `warning` only on a malformed component. `ReinstallReinstalledOutcome.degradedKinds`
is derived in `successOutcome` from the prepared handles, and `DegradeKind` is
`"skill" | "command"` so the two-branch collection is complete.

**WR-05 — FIXED.** `staleGateDropped` returns `undefined` for an empty narrowing
(`enable-disable.ts:1216-1225`), so `staleGate ?? baseReasons` can no longer discard the base
narrowing while stamping `partialHint`. The `__test_staleGateDropped` seam pins all three
arms (empty → undefined, populated → `["lsp"]`, non-partialable → undefined).

**WR-06 — FIXED.** A missing target now fails with a message naming the uncovering, with an
explicit per-path `opts.allowMissing` waiver (`tests/helpers/source-scan.ts:82-88`); non-ENOENT
errors still rethrow. The new `tests/helpers/source-scan.test.ts` is real gate-the-gate
coverage — it proves a missing target rejects, that the waiver is per-path and not a blanket
opt-out, and (the case that matters) that an existing target is really read. The COMPAT-01
delegation clause inherits the guarantee.

**WR-07 — FIXED.** `\bexport const ICON_[A-Z_]+\b`, built once as
`GLYPH_DECLARATION_SOURCE` and split into `/g` and non-`/g` instances precisely because a
`/g` regex carries `lastIndex` across `.test()` calls — the correct handling of the trap.
The new clause pins all three spellings including the two that used to slip past, plus the
negative (a glyph USE is not a declaration), which is what the counting clause's
assert-an-absence shape needs.

**WR-08 — FIXED.** `◉` is U+25C9 FISHEYE and `◍` is U+25CD CIRCLE WITH VERTICAL FILL; the
catalog now names both as the code-point pins do. The new pairing gate walks all seven glyphs
against the catalog's Glyphs section, so renaming one in either document without the other
fails.

## Narrative Findings (AI reviewer)

### WR-09: `reinstall`'s own success row discards the degraded-kinds signal its outcome now carries

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:917-934`
(row composer), `:1717-1746` (producer)
**Severity:** WARNING
**Issue:** The WR-04 fix added `degradedKinds` to `ReinstallReinstalledOutcome` and populates
it in `successOutcome`, but only the reconcile backfill projection reads it. The standalone
`/claude:plugin reinstall` verb's own row composer is unchanged:

```ts
case "reinstalled": {
  const dependencies = dependenciesFromOutcome(outcome);
  return {
    status: "reinstalled",
    name: outcome.name,
    dependencies,
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    severity: "info",      // no reasons brace, no WARN-01 raise
    needsReload: true,
  };
}
```

The phase's own new test proves the case is reachable through the public verb:
`tests/orchestrators/plugin/reinstall.test.ts` "WR-04: a reinstall whose source frontmatter no
longer parses reports the degraded kind on its outcome" calls `reinstallPlugin` with the
default (rendering) mode, breaks a `SKILL.md` frontmatter, and asserts
`degradedKinds === ["skill"]`. That same call renders a bare `● hello v1.0.0 (reinstalled)` at
info while `list` renders the degraded record one command later — the exact contradiction
class CR-01 and WR-04 were about, now one surface over. Before the fix this was a data gap
(the signal did not exist); after the fix the outcome asserts a fact its own renderer throws
away, which is strictly worse to leave undocumented.

`install`, standalone `enable`, the reconcile enable projection and the reconcile backfill
projection all name the kind and take the WARN-01 raise. `reinstall` is now the only
ledger-driven verb that does not.

**Fix:** Read the signal on the arm that produces it, mirroring
`backfilledRowFromOutcome`:

```ts
case "reinstalled": {
  const dependencies = dependenciesFromOutcome(outcome);
  // WARN-01 / D-86-03: a component this ledger degraded names itself and takes
  // the info -> warning raise, exactly as on the install / enable / backfill arms.
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  return {
    status: "reinstalled",
    name: outcome.name,
    dependencies,
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    ...(malformed.length > 0 && { reasons: malformed }),
    severity: malformed.length > 0 ? "warning" : "info",
    needsReload: true,
  };
}
```

This changes rendered bytes, so it needs a `reinstall-degraded-component` catalog state and a
byte assertion in the same change. If the standalone surface is a deliberate deferral, record
it as one and say why the signal is carried but unread — nothing in the fix report or the
phase artifacts mentions the standalone arm.

### WR-10: the WR-02 partition flip silently changes the marketplace autoupdate no-op gate, with no pin and no test

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1637`
(producer), `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:1023`
(consumer), `docs/output-catalog.md:2027-2033` (affected catalog state)
**Severity:** WARNING
**Issue:** The fix report's blast-radius note covers one consumer — the UGRM-01 bulk
suppression in `updatePlugins`, which keys on `partition === "unchanged"`. There is a second,
unmentioned consumer of that same discriminant:

```ts
// orchestrators/marketplace/update.ts:1023
const cascadeIsNoOp = outcomes.every((o) => o.partition === "unchanged");
if (!snapshot.changed && cascadeIsNoOp) { /* emit (skipped) {up-to-date}, plugins: [] */ }
```

An autoupdate-ON `marketplace update <mp>` whose `marketplace.json` is byte-identical
pre/post but whose plugin CONTENT moved (the hash-version ladder is content-derived, not
manifest-derived) over a disabled degraded record previously produced `unchanged` for that
plugin, so the whole notification collapsed to the documented `update-autoupdate-noop-skipped`
state:

```text
● official [user] (skipped) {up-to-date}
```

With the refresh arm now returning `skipped`, `cascadeIsNoOp` is false and the same scenario
emits the cascade-rows shape instead:

```text
● official [user] (updated)
  ⊘ hello (skipped) {already disabled}
```

The new bytes are more truthful (the pin really moved, and the previous form denied it — the
same falsehood WR-02 fixed one level down), so this reads as a correct consequence rather
than a regression. What makes it a finding is that it is the only rendered-byte change in
this fix round that was not pinned: `docs/output-catalog.md:2033` still describes the no-op
gate purely in terms of `outcomes.every(o => o.partition === "unchanged")` without noting
which outcomes now leave that set, and no test seeds a disabled record into a marketplace
cascade at all (`grep` for `makeDisabledPluginRecord` / `enabled: false` in
`tests/orchestrators/marketplace/update.test.ts` returns nothing). The phase's own standard —
every byte contract repinned with its catalog block and its byte assertions in the same
commit — was applied to the two changes the fixer knew about and missed this one.

**Fix:** Pin the behavior rather than revert it. Add a case to
`tests/orchestrators/marketplace/update.test.ts` that seeds an autoupdate-ON marketplace with
one disabled degraded record, moves the plugin content without touching `marketplace.json`,
and asserts the cascade-rows byte form; and amend the `update-autoupdate-noop-skipped` prose
to say that a disabled-record re-pin is a `skipped` outcome and therefore leaves the no-op
gate. If the no-op collapse is intended to survive a disabled-record re-pin, the gate needs
to widen deliberately — `o.partition === "unchanged" || isDisabledRefreshSkip(o)` — not by
accident of the partition rename.

### WR-11: the `Omit`-based signal subset re-opens the drift channel WR-03 closed, with nothing gating it

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:230-252`
**Severity:** WARNING
**Issue:** The replacement type is an exclusion, not an enumeration:

```ts
} & Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">)
```

and the doc above it states as fact: "the intersection EXCLUDES the two staged-count verdicts,
and every field it keeps is populated below." Nothing enforces the second half. Adding a sixth
signal to `LedgerDegradationSignals` — which is exactly what IN-07 built that shape to invite —
automatically widens `InstallPluginOutcome` with a field `installPlugin` does not write, and a
consumer reads it as `undefined` and takes it for "none". That is WR-03's defect verbatim,
arriving through the type operator rather than through a hand-written field list. (A `Pick`
would drift the opposite way — silently omitting the new signal and restoring the original
IN-07 asymmetry — so the spelling is not the fix; the missing gate is.)

The tree already has the idiom for this, in this phase's own gate file: `COMPAT-01: the
persisted install record holds exactly its inherited key set`
(`tests/architecture/compat-01-no-expansion.test.ts`) pins a key set by enumeration so a
silent widening fails.

**Fix:** Gate the claim the comment makes. A compile-time pin costs one type alias and no
runtime surface, and does not spell the D-75-01-forbidden literal:

```ts
// The signal keys this outcome POPULATES. A signal added to
// LedgerDegradationSignals must be populated in installPlugin's return or
// named here as a deliberate exclusion -- otherwise this line stops compiling.
type InstallSignalKeys = keyof Omit<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers">;
const _installSignalKeys: readonly InstallSignalKeys[] = [
  "unsupported",
  "orphanRewake",
  "degradedKinds",
] as const satisfies readonly InstallSignalKeys[];
```

A runtime enumeration clause in `compat-01-no-expansion.test.ts`, matching the existing
key-set pin, works equally well and keeps the production module clean.

---

_Reviewed: 2026-08-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
