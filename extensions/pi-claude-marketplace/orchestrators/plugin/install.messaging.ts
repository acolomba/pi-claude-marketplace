import {
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  ICON_PARTIALLY_AVAILABLE,
  composeReasons,
  partiallyInstalledRow,
  installedLikeRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginPartiallyInstalledMessage,
  type PluginInstalledMessage,
  type PluginUnavailableMessage,
  type PluginPartiallyAvailableMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * install.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin install` (MOD-01). It co-locates install's private status
 * set, the message shapes those statuses carry, install's command-private
 * reasons, and a render map total over install's OWN statuses (D-10) whose
 * arm bodies are lifted VERBATIM from the central `renderPluginRow` switch so
 * the dispatched output is byte-identical.
 *
 * The shared presentation vocabulary (`ICON_*`, `joinTokens`,
 * `renderScopeBracket`, `renderVersion`, `composeReasons`, `pluginRow`) stays
 * central in `shared/notify.ts` (D-11); this module CALLS it, never duplicates
 * it.
 */

/**
 * install's private status set. A single-target install emits exactly one of
 * these: a success `installed` row, a `failed` row, or -- when the
 * entity-shape classifier narrows a not-installable error -- an `unavailable`
 * row (structural defect) or, per XSURF-01, a `partially-available` row (the
 * partially-available arm, consistent with `list` / `info`).
 *
 * DFEN-04: `disabled` joins for the install that landed disabled because the
 * plugin's own `defaultEnabled` declaration said so. The install ran to
 * completion and then unstaged, so the terminal state -- and therefore the row
 * -- is the one the `disable` verb already renders.
 */
export const INSTALL_STATUSES = [
  "installed",
  "partially-installed",
  "failed",
  "unavailable",
  "partially-available",
  "disabled",
] as const;
export type InstallStatus = (typeof INSTALL_STATUSES)[number];

/**
 * install's row message union -- the subset of the central plugin message
 * shapes whose status install actually emits. `dependencies` stays REQUIRED on
 * the `installed` arm so the soft-dep marker injection in `composeReasons`
 * fires for exactly that arm (D-06 / TYPE-04 gating).
 */
export type InstallMsg =
  | PluginInstalledMessage
  | PluginPartiallyInstalledMessage
  | PluginFailedMessage
  | PluginUnavailableMessage
  | PluginPartiallyAvailableMessage
  | PluginDisabledMessage;

/**
 * install's command-private reason. `orphan rewake` surfaces a hook-config bug
 * (a handler declaring `rewakeMessage` / `rewakeSummary` without
 * `asyncRewake: true`) on the otherwise-successful `installed` row. The
 * failure-class reasons install also references (`rollback partial`,
 * `invalid manifest`, ...) are shared topic reasons owned by
 * `shared/notify-reasons.ts`.
 */
export type InstallPrivateReason = "orphan rewake";

/**
 * Render map total over install's OWN statuses (D-10): omitting an arm is a
 * TS2741 compile error at the `satisfies` site below. Each arm reproduces the
 * verbatim bytes of the matching `renderPluginRow` switch arm.
 */
const INSTALL_RENDER: { [K in InstallStatus]: RenderFn<Extract<InstallMsg, { status: K }>> } = {
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
  // FSTAT-07 / D-66-04: a partial install that re-resolves `partially-available` reports
  // (partially-installed) with the dropped-component detail. WR-03: the shared
  // `partiallyInstalledRow` threads `dependencies` so the soft-dep markers fire on a
  // degraded install exactly as on a clean `(installed)` row.
  "partially-installed": (p, probe, mpScope) => partiallyInstalledRow(p, mpScope, probe),
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
  // XSURF-01: the partially-available install-failure arm. Byte-identical to the
  // `unavailable` arm but with the `⊖` glyph + `(partially-available)` token; the
  // `--partial` hint trailer is composed centrally by the renderer, not here.
  "partially-available": (p, probe, mpScope) =>
    joinTokens([
      ICON_PARTIALLY_AVAILABLE,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `partially-available` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(partially-available)",
      composeReasons(p.reasons, false, false, probe),
    ]),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  // DFEN-04 / OUT-04: the install-disabled arm. Lifted verbatim from the
  // `disable` verb's own arm so an install that landed disabled and an install
  // followed by a disable render byte-identically. ENBL-15 / D-100-06: both
  // soft-dep flags stay hard-coded false, so the row cannot emit a
  // `{requires pi-subagents}` / `{requires pi-mcp}` marker whatever inventory
  // the record retained (ENBL-18). The enable-hint trailer is composed
  // centrally by the renderer, not here.
  disabled: (p, probe, mpScope) => pluginRow(ICON_DISABLED, p, mpScope, "(disabled)", probe),
};

/**
 * D-04 / D-05: install's `CommandContext`. `Messaging.label` is the human
 * operation name; `render` is the total render map. The `as const satisfies`
 * pin enforces that install cannot be wired without supplying both.
 */
export const INSTALL_CONTEXT = {
  Messaging: { label: "Plugin install" },
  render: INSTALL_RENDER,
} as const satisfies CommandContext<InstallStatus, InstallMsg>;
