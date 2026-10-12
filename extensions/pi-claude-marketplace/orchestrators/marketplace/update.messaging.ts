import {
  type ContentReason,
  type PluginFailedMessage,
  type PluginPartiallyInstalledMessage,
  type PluginUpdateSkippedMessage,
  type PluginUpdatedMessage,
} from "../../shared/notification-types.ts";
import { skipSeverity } from "../../shared/notify-reasons.ts";
import { constraintCauseFor, updatedRowFromOutcome } from "../plugin/update-row.ts";

import type { CommandContext } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  PluginUpdateFailedOutcome,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
} from "../types.ts";

type UpdateRowStatus = "updated" | "partially-installed" | "skipped" | "failed";
export type UpdateRowMsg =
  | PluginUpdatedMessage
  | PluginPartiallyInstalledMessage
  | PluginUpdateSkippedMessage
  | PluginFailedMessage;

/** The command label and complete per-status reason policy. */
export const UPDATE_CONTEXT = {
  Messaging: { label: "Marketplace update" },
  rowPolicies: {
    updated: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<UpdateRowStatus>;

// ───────────────────────────────────────────────────────────────────────────
// Outcome -> cascade row projection, moved from update.ts where it was reached
// through a `__test_` re-export. `UpdateRowMsg` is declared above, so the
// function that produces it belongs on this side of the line (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Map a `PluginUpdateOutcome` to a discriminated `UpdateRowMsg`.
 * The renderer owns the icon dispatch, the version-arrow composition, and the
 * reasons-brace composition; `resolveRows` composes the per-row soft-dep
 * markers (D-12). The mapper's job is structural --
 * pick the variant that matches the partition and forward the
 * partition-specific fields.
 *
 * Per-partition mapping:
 *  - `updated`   -> `PluginUpdatedMessage{ from, to, dependencies }`. Renderer
 *                   composes `<name> v<from> → v<to> (updated)`; MSG-SD-3
 *                   allows the soft-dep marker, and `dependencies` carries the
 *                   declared kinds `resolveRows` combines with the
 *                   command run's soft-dep snapshot.
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
  // partitions with no default arm, so any future variant addition fails at
  // compile time.
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
      // ledger run's ROW BYTES differently -- and no mapper can pick a form
      // itself and short-circuit past a signal the composer threads. The claim
      // is about the bytes only: the severity channel is per-surface, and this
      // surface and the manual cascade do differ on it. The base severities
      // below are this surface's own policy (WR-01 silence on the clean row,
      // the SEV-03 newly-degraded raise on the dropped-kind row); the composer
      // applies only the orthogonal WARN-01 malformed-component raise on top.
      return updatedRowFromOutcome(outcome, scope, {
        updated: "info",
        partiallyInstalled: outcome.partialDegrade?.newlyDegraded === true ? "warning" : "info",
      });
    }

    case "unchanged": {
      // D-10-13: the ceiling disclosure, read through the SAME carrier the
      // manual cascade's skipped row reads; `undefined` for an unconstrained
      // up-to-date plugin, so its row stays byte-identical.
      const cause = constraintCauseFor(outcome);

      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons: ["up-to-date"],
        // D-03/D-06: an `up-to-date` no-op is benign -> info, no reload.
        severity: "info",
        needsReload: false,
        ...(cause !== undefined && { cause }),
      };
    }

    case "skipped": {
      const reasons = [narrowSkipReason(outcome)];
      const cause = constraintCauseFor(outcome);
      return {
        status: "skipped",
        name: outcome.name,
        scope,
        reasons,
        // D-03/D-06: benign idempotent skip -> info, actionable skip -> warning;
        // never reloads. D-10-12: the held-update token relies on THIS
        // default to reach `warning` on the autoupdate surface too, with no
        // bespoke branch -- a deliberate departure from the `(updated)`
        // partition's info-for-autoupdate split (WR-01), because a
        // constraint hold persists across every future run until the user
        // changes a declaration, unlike an absent soft-dep companion the
        // user is not present to act on. The token must never be added to
        // `IDEMPOTENT_REASONS`.
        severity: skipSeverity(reasons),
        needsReload: false,
        ...(cause !== undefined && { cause }),
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
