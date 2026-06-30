---
status: clean
phase: 73-force-cross-surface-token-unification
depth: standard
files_reviewed: 9
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
reviewed: 2026-06-29
---

# Phase 73 Code Review — Force Cross-Surface Token Unification

**Verdict: CLEAN — no Critical, Warning, or Info findings.**

## Scope

Reviewed the Phase 73 diff (base `85629970^`) at standard depth across the
resolver-state-driven force-token unification:

- `extensions/pi-claude-marketplace/shared/notify.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts`
- `docs/output-catalog.md`
- `docs/messaging-style-guide.md`

Cross-referenced `shared/errors.ts` (`PluginShapeErrorShape`) and
`domain/resolver.ts` (throw-site `forceable`/`unsupportedKinds`).

## Verification performed (all passed)

- `tsc --noEmit`: clean
- `eslint` on all 7 changed source files: clean
- `catalog-uat.test.ts` + `notify-v2.test.ts`: 152/152 pass
- `install.test.ts` + `update.test.ts` + edge `update.test.ts`: 155/155 pass
- `notify-closed-set-locks.test.ts`: 4/4 pass — confirms **no silent widening**
  (PLUGIN_STATUSES stays 18, MARKETPLACE_STATUSES stays 7; the
  `unsupported`/`force-installed`/`force-upgradable` tokens predate this phase,
  from Phases 66/72).

## Correctness checks against the review brief

1. **No wrong status/reason on the non-resolvable arm.**
   `classifyEntityShapeError` never emits an `"unsupported"` `EntityErrorRow`; it
   keeps `status: "unavailable"` and threads `forceable`. The message-status flip
   to `"unsupported"` happens in `composeNotInstallableMessage`, keyed on
   `entityErrorRow.forceable` (not the reason brace). Reasons are sourced once via
   `narrowResolverReasons(reasons, unsupportedKinds)`.

2. **Discriminator narrowing is sound.** The XSURF-03 decline arm reads
   `err.shape.forceable`/`err.shape.unsupportedKinds` only after narrowing
   `err.shape.kind === "no-longer-installable"`. The resolver guarantees
   `forceable: true ⇒ unsupportedKinds = r.unsupported`, giving byte-parity with
   the `list (force-upgradable)` row's `narrowUnsupportedKinds` seam.

3. **SEV-04 split routes correctly.** `force-upgradable` is absent from the status
   severity ladder, so it relies on the stamped `severity` field — both
   `computeSeverity` (MAX-reduce of `p.severity ?? "info"`) and
   `composeTally`/`countRowsBySeverity` count by stamped severity, not status. The
   bulk info-stamped row counts as "1 success"; the targeted warning-stamped row
   prepends the `needs attention` summary. Reload-hint is a pure `needsReload`
   OR-reduce; the decline row stamps `false`, so no hint fires.

4. **`forceHint` gating is exact.** The install trailer fires on
   `(status === "unavailable" || status === "unsupported") && forceHint === true`;
   the update trailer on `status === "force-upgradable" && forceHint === true`.
   Inventory rows omit `forceHint`, so list/info surfaces stay byte-frozen —
   directly asserted by the four added `notify-v2` tests.

## Process note (not a code defect)

The MCP `grep` tool was non-functional in the review sandbox (silently returned
zero matches for strings that exist). All grep-dependent claims were re-verified
via `cat`/`sed`/Read. Memory observation 7151 ("info.ts does not import
narrowUnsupportedKinds") was a stale mid-implementation note; the committed state
(`4544c282`) has the import at `info.ts:53-57` and usage at line 1057.
