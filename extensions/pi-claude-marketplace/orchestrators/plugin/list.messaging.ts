import {
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_PARTIALLY_INSTALLED,
  ICON_INSTALLED,
  ICON_REMOTE,
  ICON_UNINSTALLABLE,
  ICON_PARTIALLY_AVAILABLE,
  composeReasons,
  installedLikeRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginAvailableMessage,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginPartiallyInstalledMessage,
  type PluginPartiallyUpgradableMessage,
  type PluginInstalledMessage,
  type PluginRemoteMessage,
  type PluginUnavailableMessage,
  type PluginPartiallyAvailableMessage,
  type PluginUpgradableMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * list.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin list` (MOD-01). Co-locates the list surface's private status
 * set, its row message shapes, and a render map total over the list's OWN
 * statuses (D-10) lifting the matching `renderPluginRow` arm bodies VERBATIM.
 * The shared presentation vocabulary stays central in `shared/notify.ts` (D-11)
 * and is CALLED here, never duplicated.
 *
 * RLD-04 / D-08: the list surface's steady-state inventory row uses the
 * `installed` status with `needsReload: false` -- the stamped flag carries the
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
export const LIST_STATUSES = [
  "installed",
  "available",
  // USTAT-01 / D-64-01: not-installed, partially-available row -- distinct from
  // structural `unavailable` (renders `(partially-available)` / `⊖`).
  "partially-available",
  "unavailable",
  "upgradable",
  "disabled",
  "failed",
  // FSTAT-02 / FSTAT-04 / D-66-01 / D-66-02: the derived partial-state inventory
  // rows. `partially-installed` is a recorded-installed plugin currently resolving
  // `partially-available`; `partially-upgradable` is a currently-clean plugin whose newer
  // candidate would newly degrade it.
  "partially-installed",
  "partially-upgradable",
  // RSTA-01 / D-80-06: the not-installed git-source row with no materialized
  // clone. Appended last per the closed-set tuple-ordering discipline.
  "remote",
] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

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
 * is a TS2741 compile error at the `satisfies` site. Arm bodies are
 * byte-identical to the central `renderPluginRow` switch.
 *
 * RLD-04 / D-08: the `installed` inventory arm passes `undefined` for `reasons`
 * so the orphan-rewake brace (an install-cascade surface) never leaks onto a
 * steady-state inventory row. The `available` / `unavailable` arms omit the
 * `[<scope>]` bracket entirely (MSG-PL-6 / SNM-11 carve-out) by passing
 * `undefined` to `renderScopeBracket`.
 */
const LIST_RENDER: { [K in ListStatus]: RenderFn<Extract<ListMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      undefined,
      probe,
    ),
  available: (p, probe, mpScope) =>
    joinTokens([
      ICON_AVAILABLE,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `available` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(available)",
      composeReasons(undefined, false, false, probe),
    ]),
  unavailable: (p, probe, mpScope) =>
    joinTokens([
      ICON_UNINSTALLABLE,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(unavailable)",
      composeReasons(p.reasons, false, false, probe),
    ]),
  // USTAT-01 / D-64-01: not-installed, partially-available row -- the dedicated
  // ICON_PARTIALLY_AVAILABLE (`⊖`) glyph + `(partially-available)` token. Body cloned from the
  // `unavailable` arm (same MSG-PL-6 / SNM-11 no-scope carve-out and reasons
  // composition); only the glyph and token differ.
  "partially-available": (p, probe, mpScope) =>
    joinTokens([
      ICON_PARTIALLY_AVAILABLE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(partially-available)",
      composeReasons(p.reasons, false, false, probe),
    ]),
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
  disabled: (p, probe, mpScope) =>
    joinTokens([
      ICON_DISABLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(disabled)",
      composeReasons(undefined, false, false, probe),
    ]),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  // RSTA-01 / D-80-03: not-installed git-source row whose clone/mirror is not
  // materialized locally. Clones the `available` arm, swapping the glyph
  // (`○` -> `◌`) and token (`(available)` -> `(remote)`). SNM-11 carve-out:
  // `remote` has NO `scope?` field, so the scope bracket is omitted. Bare row --
  // NO reasons brace (D-80-03), so the `composeReasons` line is dropped. Body
  // lifted verbatim from the central `renderPluginRow` remote arm.
  remote: (p, _probe, mpScope) =>
    joinTokens([
      ICON_REMOTE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(remote)",
    ]),
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
