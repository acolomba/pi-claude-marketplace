import {
  ICON_INSTALLED,
  ICON_PARTIALLY_INSTALLED,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  pluginRow,
  renderAvailableRow,
  renderDisabledRow,
  renderPartiallyAvailableRow,
  renderRemoteRow,
  renderUnavailableRow,
  renderVersion,
  type PluginAvailableMessage,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyAvailableMessage,
  type PluginPartiallyInstalledMessage,
  type PluginPartiallyUpgradableMessage,
  type PluginRemoteMessage,
  type PluginUnavailableMessage,
  type PluginUpgradableMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * list.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin list` (MOD-01). Co-locates the list surface's private status
 * set, its row message shapes, and a render map total over the list's OWN
 * statuses (D-10) whose arms DELEGATE to the shared per-row renderers. The
 * shared presentation vocabulary stays central in `shared/notify.ts` (D-11)
 * and is CALLED here, never duplicated.
 *
 * RLD-04: the list surface's steady-state inventory row uses the `installed`
 * status with `needsReload: false` -- the stamped flag carries the
 * reload-suppression (the OR-reduce reload-hint, RLD-02, never fires on a
 * steady-state list). The former `present` token has been collapsed into
 * `installed`.
 */

/**
 * the list surface's private status set: the inventory `installed` token,
 * `available` / `unavailable` not-installed rows, `upgradable` rows, the
 * `disabled` inventory row, and a synthetic `failed` row for list-orchestration
 * failures.
 */
type ListStatus =
  | "installed"
  | "available"
  // USTAT-01 / D-64-01: not-installed, partially-available row -- distinct from
  // structural `unavailable` (renders `(partially-available)` / `⊖`).
  | "partially-available"
  | "unavailable"
  | "upgradable"
  | "disabled"
  | "failed"
  // FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived partial-state inventory
  // rows. `partially-installed` is a recorded-installed plugin currently resolving
  // `partially-available`; `partially-upgradable` is a currently-clean plugin whose newer
  // candidate would newly degrade it.
  | "partially-installed"
  | "partially-upgradable"
  // RSTA-01 / D-80-06: the not-installed git-source row with no materialized
  // clone. Appended last per the closed-set tuple-ordering discipline.
  | "remote";

/** the list surface's row message union. */
export type ListMsg =
  | PluginInstalledMessage
  | PluginAvailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginDisabledMessage
  | PluginFailedMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage
  | PluginRemoteMessage;

/**
 * Render map total over the list surface's OWN statuses (D-10): a missing arm
 * is a TS2741 compile error at the `satisfies` site. The arms call the shared
 * per-row renderers, so their bytes agree with the central `renderPluginRow`
 * switch because both call the SAME helper.
 *
 * INV-01: the `installed` inventory arm forwards `p.reasons`. Steady-state
 * inventory rows may state DURABLE facts about a record's relationship to its
 * marketplace -- `{not in manifest}` stays true across reloads until either
 * the manifest or the installation changes -- but not TRANSIENT conditions
 * tied to a pending action (D-95-02). Under D-95-01 that split is documented
 * convention for authors of the row builder, not a gate here: this map holds
 * no allowlist and renders whatever the orchestrator stamped. The absence
 * claim itself is gated upstream on a SUCCESSFUL manifest read (BOUND-03 /
 * D-95-05).
 *
 * The `available` / `unavailable` rows omit the `[<scope>]` bracket entirely
 * (MSG-PL-6 / SNM-11 carve-out); that is a property of their shared helpers.
 */
const LIST_RENDER: { [K in ListStatus]: RenderFn<Extract<ListMsg, { status: K }>> } = {
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
  available: (p, probe, mpScope) => renderAvailableRow(p, probe, mpScope),
  unavailable: (p, probe, mpScope) => renderUnavailableRow(p, probe, mpScope),
  // USTAT-01 / D-64-01: not-installed, partially-available row -- the dedicated
  // ICON_PARTIALLY_AVAILABLE (`⊖`) glyph + `(partially-available)` token. The helper differs
  // from the `unavailable` one in glyph and token only (same MSG-PL-6 / SNM-11
  // no-scope carve-out and reasons composition).
  "partially-available": (p, probe, mpScope) => renderPartiallyAvailableRow(p, probe, mpScope),
  upgradable: (p, probe, mpScope) => pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe),
  // FSTAT-02 / D-66-03: dedicated ICON_PARTIALLY_INSTALLED (`◉`) glyph; the reasons
  // brace carries the dropped-component detail (mirrors the `upgradable`
  // composition). Body lifted verbatim from the central renderPluginRow arm.
  "partially-installed": (p, probe, mpScope) =>
    pluginRow(ICON_PARTIALLY_INSTALLED, p, mpScope, "(partially-installed)", probe),
  // FSTAT-04 / D-66-02 / D-66-03: REUSES ICON_INSTALLED (`●`) -- the row is
  // clean today -- exactly like the `upgradable` arm above.
  "partially-upgradable": (p, probe, mpScope) =>
    pluginRow(ICON_INSTALLED, p, mpScope, "(partially-upgradable)", probe),
  // ENBL-16 / D-100-07: the shared helper threads the row's `reasons`, and the
  // orchestrator stamps at most `not in manifest` there. Both soft-dep flags
  // stay hard-coded false inside that helper, which is what keeps a disabled row
  // free of a soft-dep marker whatever inventory the record retained (ENBL-15 /
  // D-100-06).
  disabled: (p, probe, mpScope) => renderDisabledRow(p, probe, mpScope),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  // RSTA-01 / D-80-03: not-installed git-source row whose clone/mirror is not
  // materialized locally. The helper differs from the `available` one in glyph
  // (`○` -> `◌`) and token (`(available)` -> `(remote)`). SNM-11 carve-out:
  // `remote` has NO `scope?` field, so the scope bracket is omitted, and the row
  // is bare -- NO reasons brace (D-80-03), which is why it takes no `probe`.
  remote: (p, _probe, mpScope) => renderRemoteRow(p, mpScope),
};

/**
 * D-04 / D-05: the list surface's `CommandContext`. The `as const satisfies`
 * pin enforces that list supplies both `Messaging.label` and a total render
 * map.
 */
export const LIST_CONTEXT = {
  Messaging: { label: "Plugin list" },
  render: LIST_RENDER,
} as const satisfies CommandContext<ListStatus, ListMsg>;
