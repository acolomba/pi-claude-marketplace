import { isErrnoException, PluginShapeError } from "../../shared/errors.ts";
import {
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginSkippedMessage,
  type ContentReason,
} from "../../shared/notification-types.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * enable's private status set: a fresh `installed` row, a fresh
 * `partially-installed` row (ENBL-07 re-materialized a soft-degraded record
 * through the partial gate), a `skipped` row (already-enabled / not-installed),
 * or a `failed` row.
 */
type EnableStatus = "installed" | "partially-installed" | "skipped" | "failed";

/** enable's row message union. */
export type EnableMsg =
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/**
 * disable's private status set: a fresh `disabled` row, a `skipped` row
 * (already-disabled / not-installed), or a `failed` row.
 */
type DisableStatus = "disabled" | "skipped" | "failed";

/** disable's row message union. */
export type DisableMsg = PluginDisabledMessage | PluginSkippedMessage | PluginFailedMessage;

/** The command label and complete per-status reason policy. */
export const ENABLE_CONTEXT = {
  Messaging: { label: "Plugin enable" },
  rowPolicies: {
    installed: { markers: true, contentReasons: true },
    "partially-installed": { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<EnableStatus>;

/** The command label and complete per-status reason policy. */
export const DISABLE_CONTEXT = {
  Messaging: { label: "Plugin disable" },
  rowPolicies: {
    disabled: { markers: false, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<DisableStatus>;

// ───────────────────────────────────────────────────────────────────────────
// Failure -> reasons narrowing for both verbs, moved from enable-disable.ts
// where `staleGateDropped` was reached through a `__test_` re-export. These
// three produce the reason tokens the shared grammar renders, so they
// belong on this side of the line. The private `isErrnoException` copy they
// shared went to shared/errors.ts, which was already holding two identical
// twins of it (FLOW-09).
// ───────────────────────────────────────────────────────────────────────────

/**
 * WR-02 / D-98-03: recognise the STALE-GATE enable failure and name the kinds
 * it dropped. The enable branch derives its ledger gate from the persisted
 * record, so a record that was installable at disable time runs the strict
 * `requireInstallable` gate (op `install` -> shape kind `not-installable`);
 * `partialable` is true only when the live resolution came back
 * `partially-available`, which is exactly the record-versus-manifest
 * disagreement. The kinds are narrowed through the same
 * `narrowUnsupportedKinds` seam the `list (partially-upgradable)` row uses, so
 * the brace is byte-identical across the surfaces, and the caller stamps
 * `partialHint` to point at `update --partial` -- the command that re-pins the
 * record against the current manifest entry.
 *
 * Returns `undefined` for every other cause, which keeps the trailer inert.
 * Mirrors `composeUpdateDeclineRow`'s cause narrowing in `update.ts`.
 */
export function staleGateDropped(cause: Error): readonly ContentReason[] | undefined {
  if (
    cause instanceof PluginShapeError &&
    cause.shape.kind === "not-installable" &&
    cause.shape.partialable
  ) {
    const narrowed = narrowUnsupportedKinds(cause.shape.unsupportedKinds ?? []);
    // WR-05: an EMPTY narrowing names no fact, so it is not a match. The caller
    // writes `staleGate ?? baseReasons`, and `??` treats `[]` as present -- an
    // empty return would therefore discard the base narrowing AND still stamp
    // `partialHint`, producing a brace-less `(failed)` row carrying a
    // remediation trailer. Unreachable today (the resolver builds the
    // `partially-available` arm only for a non-empty kind list, and every kind
    // maps to a reason), which is exactly why the contract is enforced here
    // rather than assumed: `undefined` means leave the row as it was.
    return narrowed.length > 0 ? narrowed : undefined;
  }

  return undefined;
}

/**
 * Narrow an enable-branch failure cause to a closed Reason. ENOENT-class
 * failures surface as `source missing` (ENBL-03 missing-clone path);
 * everything else falls back to an empty array so the renderer suppresses
 * the brace and surfaces the cause-chain trailer.
 */
export function narrowEnableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause) && cause.code === "ENOENT") {
    return ["source missing"];
  }

  const chained = cause.cause;
  if (chained !== undefined && isErrnoException(chained) && chained.code === "ENOENT") {
    return ["source missing"];
  }

  // Defensive: an empty reasons array lets the renderer suppress the brace
  // while still surfacing the cause via the 4-space-indent trailer.
  return [];
}

/**
 * Narrow a disable-branch cascade failure to a closed Reason. Mirrors the
 * uninstall.ts `narrowCascadeFailure` taxonomy (permission denied / source
 * missing / unreadable). The full taxonomy is duplicated locally rather than
 * exported from uninstall.ts because the disable branch is structurally a
 * cascade re-use of uninstall's primitives -- the two should drift together.
 */
export function narrowDisableFailure(cause: Error): readonly ContentReason[] {
  if (isErrnoException(cause)) {
    switch (cause.code) {
      case "EACCES":
      case "EPERM":
        return ["permission denied"];
      case "ENOENT":
        return ["source missing"];
      default:
        break;
    }
  }

  return ["unreadable"];
}
