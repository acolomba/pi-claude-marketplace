import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  ICON_UNSUPPORTED,
  composeReasons,
  forceInstalledRow,
  installedLikeRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginFailedMessage,
  type PluginForceInstalledMessage,
  type PluginInstalledMessage,
  type PluginUnavailableMessage,
  type PluginUnsupportedMessage,
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
 * row (structural defect) or, per XSURF-01, an `unsupported` row (the
 * force-degradable arm, consistent with `list` / `info`).
 */
export const INSTALL_STATUSES = [
  "installed",
  "force-installed",
  "failed",
  "unavailable",
  "unsupported",
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
  | PluginForceInstalledMessage
  | PluginFailedMessage
  | PluginUnavailableMessage
  | PluginUnsupportedMessage;

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
  // FSTAT-07 / D-66-04: a force install that re-resolves `unsupported` reports
  // (force-installed) with the dropped-component detail. WR-03: the shared
  // `forceInstalledRow` threads `dependencies` so the soft-dep markers fire on a
  // degraded install exactly as on a clean `(installed)` row.
  "force-installed": (p, probe, mpScope) => forceInstalledRow(p, mpScope, probe),
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
  // XSURF-01: the force-degradable install-failure arm. Byte-identical to the
  // `unavailable` arm but with the `⊖` glyph + `(unsupported)` token; the
  // `--force` hint trailer is composed centrally by the renderer, not here.
  unsupported: (p, probe, mpScope) =>
    joinTokens([
      ICON_UNSUPPORTED,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `unsupported` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(unsupported)",
      composeReasons(p.reasons, false, false, probe),
    ]),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
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
