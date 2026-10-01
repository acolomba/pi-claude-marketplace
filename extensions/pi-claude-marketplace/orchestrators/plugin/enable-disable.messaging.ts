import { isRenderablePluginKey } from "../../domain/dependencies.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { isErrnoException, PluginShapeError } from "../../shared/errors.ts";
import {
  ICON_UNINSTALLABLE,
  installedLikeRow,
  partiallyInstalledRow,
  pluginRow,
  renderDisabledRow,
  renderVersion,
  ICON_INSTALLED,
} from "../../shared/notification-grammar.ts";
import {
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyInstalledMessage,
  type PluginSkippedMessage,
  type ContentReason,
} from "../../shared/notification-types.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * enable-disable.messaging.ts -- the command-local notification vocabulary for
 * BOTH `/claude:plugin enable` and `/claude:plugin disable` (MOD-01). The two
 * verbs share one orchestrator file, so this module declares TWO command
 * contexts -- `ENABLE_CONTEXT` and `DISABLE_CONTEXT` -- each with its OWN render
 * map total over its OWN statuses (D-10). The render-arm bodies are lifted
 * VERBATIM from the central `renderPluginRow` switch; the shared presentation
 * vocabulary stays central in `shared/notification-grammar.ts` (D-11) and is CALLED here,
 * never duplicated.
 *
 * UAT-03 / RLD-05 / D-07: the fresh-disable `(disabled)` row's
 * `/reload to pick up changes` trailer is NOT a render concern -- it is driven
 * by the row's caller-stamped `needsReload: true` (the RLD-02 OR-reduce),
 * while the inventory `(disabled)` row stamps `needsReload: false`. The row
 * bytes are byte-identical across both.
 */

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

/**
 * Render map total over enable's OWN statuses (D-10). The fresh `installed` arm
 * is byte-identical to install's installed arm -- the enable verb constructs the
 * row with `dependencies: []`, so the soft-dep markers never append, but the
 * `dependencies.includes(...)` gating is preserved verbatim for byte parity.
 *
 * ENBL-07 / FSTAT-07 / D-66-04: the `partially-installed` arm CALLS the shared
 * `partiallyInstalledRow` composition site (D-11), so a re-enable that drops
 * component kinds renders the same `◉ ... (partially-installed) {kinds}` bytes
 * the install cascade and the `list` inventory row render for the very same
 * record.
 */
const ENABLE_RENDER: { [K in EnableStatus]: RenderFn<Extract<EnableMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      p.reasons,
      probe,
    ),
  "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * Render map total over disable's OWN statuses (D-10). The `disabled` arm uses
 * the dedicated `ICON_DISABLED` glyph.
 *
 * ENBL-16 / D-100-07: the row's `reasons` are THREADED, as in the two sibling
 * arms (`notify.ts`'s central `disabled` arm and `list.messaging.ts`). This
 * command's producer stamps none today -- a fresh disable reaches the requested
 * state, so there is nothing to report and the brace collapses -- so the
 * threading changes no byte now and cannot silently drop a reason a later
 * producer stamps. Both soft-dep flags stay hard-coded false, which keeps a
 * disabled row free of a soft-dep marker whatever inventory the record retained
 * (ENBL-15 / D-100-06).
 */
const DISABLE_RENDER: { [K in DisableStatus]: RenderFn<Extract<DisableMsg, { status: K }>> } = {
  disabled: (p, probe, mpScope) => renderDisabledRow(p, probe, mpScope),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: enable's `CommandContext`. The `as const satisfies` pin enforces
 * that enable supplies both `Messaging.label` and a total render map.
 */
export const ENABLE_CONTEXT = {
  Messaging: { label: "Plugin enable" },
  render: ENABLE_RENDER,
} as const satisfies CommandContext<EnableStatus, EnableMsg>;

/**
 * EDEP-01 / EDEP-03: one row for one member of the enable cascade's
 * transitive closure. Deliberately NOT `EnableMsg.dependencies` or the
 * `Dependency` union from `shared/concerns/soft-dep.ts` -- that vocabulary
 * names the pi-subagents / pi-mcp-adapter soft-dependency companion
 * extensions, an unrelated concept from a declared PLUGIN dependency. A
 * member renders through the SAME `ENABLE_RENDER` arms as the root (its
 * `status` selects the arm exactly as `dispatchRow` already does), so no new
 * render map is needed -- only the row shape.
 */
export type EnableCascadeMemberRow = PluginInstalledMessage | PluginSkippedMessage;

/**
 * RESV-01 / RESV-06 precedent, applied to the enable cascade: one row per
 * closure member beside the root's own row, sorted through the project's
 * canonical name-then-scope comparator so the root takes its alphabetical
 * place among the members rather than always leading (EDEP-01 ordering
 * edge). Every member of one cascade lands in the root's own scope, so the
 * comparator's scope half is inert here by construction, exactly as it is
 * for the install cascade's block.
 *
 * A one-element sort is a no-op, so a root that declares no dependencies (or
 * whose every member fails classification, `members: []`) composes to
 * exactly `[rootRow]`.
 */
export function composeEnableCascadeRows(args: {
  readonly scope: Scope;
  readonly rootRow: EnableMsg;
  readonly members: readonly EnableCascadeMemberRow[];
}): readonly EnableMsg[] {
  const rows: EnableMsg[] = [args.rootRow, ...args.members];
  return [...rows].sort((a, b) =>
    compareByNameThenScope(
      { name: a.name, scope: args.scope },
      { name: b.name, scope: args.scope },
    ),
  );
}

/**
 * D-04 / D-05: disable's `CommandContext`. Distinct label and render map from
 * `ENABLE_CONTEXT`.
 */
export const DISABLE_CONTEXT = {
  Messaging: { label: "Plugin disable" },
  render: DISABLE_RENDER,
} as const satisfies CommandContext<DisableStatus, DisableMsg>;

/**
 * The dependents as EDEP-02's refusal sentence names them: the keys
 * themselves when every one of them is renderable, and their count when any
 * is not. Local mirror of `uninstall.messaging.ts::renderDependents` --
 * T-08-06: the keys are holder keys `findDependents` derived from STATE
 * records, bounded only by `domain/name.ts::assertSafeName`, which admits
 * `"`, `,`, spaces and bidi controls. Interpolated unchecked, one hostile
 * name could forge the rest of the sentence.
 */
function renderDependentKeys(dependents: readonly string[]): string {
  if (dependents.every(isRenderablePluginKey)) {
    return dependents.join(", ");
  }

  return dependents.length === 1 ? "1 other plugin" : `${dependents.length} other plugins`;
}

/**
 * D-08-01: the disable refusal's plain-English instruction. Upstream's
 * template offers a chained command; `disable` accepts exactly one
 * `<plugin>@<marketplace>` target, so this names the target, names the
 * sorted dependents through `renderDependentKeys`, and states the order --
 * disable the dependents first, then the target. T-08-07: composed from
 * `name@marketplace` keys and fixed phrases only, with no `{ cause }`
 * chained behind it, so the renderer's cause-chain walk cannot print a raw
 * underlying message.
 */
export function composeDisableRefusalCause(target: string, dependents: readonly string[]): string {
  return `Disable ${renderDependentKeys(dependents)} first, then ${target}.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Failure -> reasons narrowing for both verbs, moved from enable-disable.ts
// where `staleGateDropped` was reached through a `__test_` re-export. These
// three produce the reason tokens this module's render map renders, so they
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

  // PR-2 case 3: the resolver classifies a plugin clone directory that is
  // genuinely absent from disk as a structural `not-installable` shape
  // (`domain/plugin-resolver.ts`'s "source dir does not exist" note), not a
  // raw errno throw -- the two checks above cannot see it. ENBL-03: a cached
  // clone missing between the recorded state and the enable invocation
  // reaches exactly this shape.
  if (
    cause instanceof PluginShapeError &&
    cause.shape.kind === "not-installable" &&
    cause.shape.reasons.some((reason) => reason.startsWith("source dir does not exist"))
  ) {
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
