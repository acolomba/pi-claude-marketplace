import {
  ICON_AVAILABLE,
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginAvailableMessage,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginPresentMessage,
  type PluginUnavailableMessage,
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
 * The `present` status is PRESERVED -- it is the list-only inventory token that
 * renders byte-identically to `installed` but stays distinct so
 * `shouldEmitReloadHint` never misfires the `/reload` trailer on a steady-state
 * list. There is no `present` -> `installed` collapse this phase.
 */

/**
 * the list surface's private status set: the inventory `present` token,
 * `available` / `unavailable` not-installed rows, `upgradable` rows, the
 * `disabled` inventory row, and a synthetic `failed` row for list-orchestration
 * failures.
 */
export const LIST_STATUSES = [
  "present",
  "available",
  "unavailable",
  "upgradable",
  "disabled",
  "failed",
] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

/** the list surface's row message union. */
export type ListMsg =
  | PluginPresentMessage
  | PluginAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginDisabledMessage
  | PluginFailedMessage;

/**
 * Render map total over the list surface's OWN statuses (D-10): a missing arm
 * is a TS2741 compile error at the `satisfies` site. Arm bodies are
 * byte-identical to the central `renderPluginRow` switch.
 *
 * The `present` arm renders byte-identically to `installed` (ICON_INSTALLED +
 * `(installed)` token) but carries NO `reasons` -- the orphan-rewake brace is an
 * install-cascade surface, not a steady-state inventory surface. The
 * `available` / `unavailable` arms omit the `[<scope>]` bracket entirely
 * (MSG-PL-6 / SNM-11 carve-out) by passing `undefined` to `renderScopeBracket`.
 */
const LIST_RENDER: { [K in ListStatus]: RenderFn<Extract<ListMsg, { status: K }>> } = {
  present: (p, probe, mpScope) =>
    joinTokens([
      ICON_INSTALLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(installed)",
      composeReasons(
        undefined,
        p.dependencies.includes("agents"),
        p.dependencies.includes("mcp"),
        probe,
      ),
    ]),
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
  upgradable: (p, probe, mpScope) => pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe),
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
