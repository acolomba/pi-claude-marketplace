// orchestrators/marketplace/update.messaging.ts
//
// The `marketplace update` command's co-located notification vocabulary.
//
// D-01 / MOD-01: `marketplace update` records a marketplace header of
// `(updated)` (manifest changed and/or cascade ran) or `(skipped) {up-to-date}`
// (no-op), rendered via the central `renderMpHeader` seam the spine reuses. On
// the autoupdate-ON cascade path the marketplace block carries per-plugin child
// rows whose statuses are `updated` / `skipped` / `failed` (produced by
// `outcomeToCascadePluginMessage`); those rows dispatch through this command's
// render map below. The render-map arms are lifted verbatim from the central
// `renderPluginRow` `updated` / `skipped` / `failed` arms, so dispatch is
// byte-identical.

import { assertNever } from "../../shared/errors.ts";
import { skipSeverity } from "../../shared/notify-reasons.ts";
import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  composeVersionArrow,
  partiallyInstalledRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  type ContentReason,
  type PluginFailedMessage,
  type PluginPartiallyInstalledMessage,
  type PluginSkippedMessage,
  type PluginUpdatedMessage,
} from "../../shared/notify.ts";
import { updatedRowFromOutcome } from "../plugin/update-row.ts";

import type { CommandContext } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
} from "../types.ts";

/**
 * The plugin-child-row statuses `marketplace update`'s autoupdate-ON cascade
 * emits: `updated`, `partially-installed`, `skipped`, `failed`. This is the Status
 * set the render map below is total over (D-10: a missing arm is a TS2741
 * compile error). SEV-03 / D-69-01: `partially-installed` joins the set because the
 * autoupdate cascade now TAKES the partial path, so a degrading candidate renders
 * `(partially-installed) {dropped kinds}` instead of `(skipped) {no longer installable}`.
 */
type UpdateRowStatus = "updated" | "partially-installed" | "skipped" | "failed";
export type UpdateRowMsg =
  | PluginUpdatedMessage
  | PluginPartiallyInstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/**
 * D-04 / D-05 / D-10 / MOD-01 / MOD-03: the `marketplace update` command
 * context. The render map is total over the command's plugin-child-row statuses;
 * each arm reproduces the EXACT bytes of the central `renderPluginRow` arm it
 * lifts, so cascade dispatch through `notifyWithContext` is byte-identical.
 */
export const UPDATE_CONTEXT = {
  Messaging: { label: "Marketplace update" },
  render: {
    // WR-12: thread the optional `reasons` brace, as the central
    // `renderPluginRow` arm and the manual update cascade's map both do. This
    // map is the THIRD render surface reached by an `(updated)` row and the one
    // the autoupdate cascade actually dispatches through, so leaving it unthreaded
    // raises the severity while still dropping the brace.
    updated: (p, probe, mpScope) =>
      joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        composeVersionArrow(p.from, p.to),
        "(updated)",
        composeReasons(
          p.reasons,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]),
    // SEV-03 / D-69-01: an autoupdate cascade candidate that re-resolved
    // `partially-available` degraded via the partial path. Reuse `partiallyInstalledRow` --
    // the SOLE composition site (D-11 "call, never duplicate") -- so the
    // `◉ <name> v<version> (partially-installed) {dropped kinds[, requires pi-...]}`
    // bytes stay identical to the install / update success surfaces.
    "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
    skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
    failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  },
} as const satisfies CommandContext<UpdateRowStatus, UpdateRowMsg>;

// ───────────────────────────────────────────────────────────────────────────
// Outcome -> cascade row projection, moved from update.ts where it was reached
// through a `__test_` re-export. `UpdateRowMsg` is declared above, so the
// function that produces it belongs on this side of the line (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Map a `PluginUpdateOutcome` to a discriminated `UpdateRowMsg`.
 * The renderer (`renderPluginRow` in shared/notify.ts) owns the icon
 * dispatch, the version-arrow composition, the reasons-brace composition, and
 * the per-row soft-dep marker injection. The mapper's job is structural --
 * pick the variant that matches the partition and forward the
 * partition-specific fields.
 *
 * Per-partition mapping:
 *  - `updated`   -> `PluginUpdatedMessage{ from, to, dependencies }`. Renderer
 *                   composes `<name> v<from> → v<to> (updated)`; MSG-SD-3
 *                   allows the soft-dep marker, and `dependencies` carries the
 *                   declared kinds the notify-time probe combines with
 *                   `softDepStatus(pi)`.
 *  - `unchanged` -> `PluginSkippedMessage{ reasons: ["up-to-date"] }`. The
 *                   `skipped` status routes through the warning severity
 *                   ladder -> ⊘ glyph.
 *  - `skipped`   -> `PluginSkippedMessage{ reasons: [<narrowed>] }`, narrowed
 *                   via `narrowSkipReason`.
 *  - `failed`    -> `PluginFailedMessage{ reasons: [<narrowed>], cause? }`. The
 *                   cause chain rides on the per-plugin row; the cascade catch
 *                   in `cascadeAutoupdates` stamps `outcome.cause` so the
 *                   renderer emits a 4-space-indent trailer below the row.
 *
 * `scope` is forwarded so the renderer's orphan-fold logic
 * (`renderScopeBracket(plugin.scope, mp.scope)`) can suppress the redundant
 * `[<scope>]` bracket when the plugin scope matches the marketplace scope.
 */
export function outcomeToCascadePluginMessage(
  outcome: PluginUpdateOutcome,
  scope: Scope,
): UpdateRowMsg {
  // PluginUpdateOutcome is a discriminated union; the switch exhausts all 4
  // partitions and ends with an `assertNever` so any future variant addition
  // fails at compile time.
  switch (outcome.partition) {
    case "updated": {
      // SEV-01 / WR-01: the missing-soft-dep-companion `warning` stamp is
      // deliberately NOT applied on this autoupdate cascade surface. SEV-01
      // targets the interactive install / manual-update success arms, where the
      // user is present to act on an absent companion. Autoupdate is a
      // background operation; the actionable signal it must surface is a NEW
      // degradation, already covered by the `newlyDegraded` warning below. A
      // companion-absence warning here would be background noise. Any change to
      // this asymmetry is owned by the final severity/output reconcile, not by
      // the producer-stamp wiring.
      // SEV-03 / D-69-01 / FSTAT-07: the autoupdate cascade now TAKES the force
      // path (`updateSinglePlugin` sets `partial: true`), so a candidate that
      // re-resolved `partially-available` degraded in place. Report `(partially-installed)`
      // with the dropped-component detail instead of `(updated)`. A clean
      // candidate keeps `(updated)` (no `partialDegrade`). partially-installed is
      // a realized transition -> reloads Pi resources.
      //
      // SEV-03 / D-69-01: an autoupdate that NEWLY degrades a previously-clean
      // plugin (the prior persisted `compatibility.unsupported` was empty, read
      // before the update applied) silently dropped components the user did not
      // opt into -> the row is actionable -> `warning` (prepends the
      // `A plugin operation needs attention.` summary line). Re-degrading a
      // plugin that was ALREADY partially-installed (prior `partially-available` non-empty)
      // is benign -> `info`. The manual `update --partial` opt-in stays info on its
      // own renderer; the warning fires ONLY on this autoupdate surface.
      // WR-12 / CR-01: BOTH row forms are composed by the SAME composer the
      // manual update cascade calls, so the two surfaces cannot report one
      // ledger run differently -- and no mapper can pick a form itself and
      // short-circuit past a signal the composer threads. The base severities
      // below are this surface's own policy (WR-01 silence on the clean row,
      // the SEV-03 newly-degraded raise on the dropped-kind row); the composer
      // applies only the orthogonal WARN-01 malformed-component raise on top.
      return updatedRowFromOutcome(outcome, scope, {
        updated: "info",
        partiallyInstalled: outcome.partialDegrade?.newlyDegraded === true ? "warning" : "info",
      });
    }

    case "unchanged":
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons: ["up-to-date"],
        // D-03/D-06: an `up-to-date` no-op is benign -> info, no reload.
        severity: "info",
        needsReload: false,
      };
    case "skipped": {
      const reasons = [narrowSkipReason(outcome)];
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons,
        // D-03/D-06: benign idempotent skip -> info, actionable skip -> warning;
        // never reloads.
        severity: skipSeverity(reasons),
        needsReload: false,
      };
    }

    case "failed":
      return {
        status: "failed",
        name: outcome.name,
        scope,
        reasons: [narrowFailReason(outcome)],
        // The per-plugin cause-chain trailer. `outcome.cause` is populated by
        // the cascadeAutoupdates catch where the raw thrown Error is in scope;
        // failed outcomes produced by plugin/update.ts (no err in scope) leave
        // this undefined and the renderer simply omits the trailer.
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
        // D-03/D-06: a failed update -> error, no reload.
        severity: "error",
        needsReload: false,
      };
    default:
      // Exhaustiveness guard. A new partition added to PluginUpdateOutcome
      // without updating this switch fails at compile time on
      // `assertNever(outcome)`.
      return assertNever(outcome);
  }
}

/**
 * Narrow a `skipped` outcome to a closed-set Reason.
 *
 * Prefer the pre-narrowed `outcome.reasons[0]` (populated by
 * `plugin/update.ts` producers) over the substring parse of `outcome.notes`.
 * The notes-fallback is retained for test fixtures that build outcomes
 * without `reasons`; once every producer populates `reasons`, the fallback
 * can be deleted.
 */
function narrowSkipReason(outcome: PluginUpdateSkippedOutcome): ContentReason {
  const firstReason = outcome.reasons[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  //
  // WR-06: a `partition: "skipped"` outcome with no reasons AND no notes
  // is a producer-contract violation -- the previous code masked it as
  // `"up-to-date"` (a SUCCESS reason), so the operator read
  // `skipped {up-to-date}` and assumed nothing was wrong while in fact
  // the producer failed to populate its outcome. Map empty-notes to
  // `"unreadable manifest"` instead so the brace surfaces a real failure
  // classification rather than a false success claim (mirrors the
  // narrowFailReason symmetric fallback below).
  const notes = outcome.notes;
  if (notes.length === 0) {
    return "unreadable manifest";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("source mismatch")) {
    return "source mismatch";
  }

  if (text.includes("no longer installable")) {
    return "no longer installable";
  }

  // WR-06: no-substring-match -> SAME treatment as empty-notes; do not
  // mask the unknown-class skip as `"up-to-date"`.
  return "unreadable manifest";
}

/**
 * Narrow a `failed` outcome to a closed-set Reason.
 *
 * Prefer pre-narrowed `outcome.reasons[0]` over notes parsing (same rationale
 * as `narrowSkipReason` above). The fallback is `"unreadable manifest"`
 * because most update failures bubble up from manifest re-reads.
 */
function narrowFailReason(outcome: PluginUpdateFailedOutcome): ContentReason {
  const firstReason = outcome.reasons?.[0];
  if (firstReason !== undefined) {
    return firstReason;
  }

  // Fallback: substring parse of `notes`. Retained for backward
  // compatibility with notes-only outcome fixtures.
  const notes = outcome.notes;
  if (notes.length === 0) {
    return "unreadable manifest";
  }

  const text = notes.join(" ").toLowerCase();
  if (text.includes("not in manifest") || text.includes("not found in marketplace")) {
    return "not in manifest";
  }

  if (text.includes("rollback partial")) {
    return "rollback partial";
  }

  if (text.includes("invalid manifest") || text.includes("unparseable")) {
    return "invalid manifest";
  }

  if (text.includes("unreadable")) {
    return "unreadable manifest";
  }

  return "unreadable manifest";
}
