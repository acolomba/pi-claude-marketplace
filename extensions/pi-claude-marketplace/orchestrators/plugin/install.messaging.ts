import {
  ICON_DISABLED,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  partiallyInstalledRow,
  pluginRow,
  renderPartiallyAvailableRow,
  renderUnavailableRow,
  renderVersion,
  type ContentReason,
  type PluginDisabledMessage,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginPartiallyAvailableMessage,
  type PluginPartiallyInstalledMessage,
  type PluginUnavailableMessage,
  type StatusToken,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";

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
type InstallStatus =
  | "installed"
  | "partially-installed"
  | "failed"
  | "unavailable"
  | "partially-available"
  | "disabled";

/**
 * Entity-shaped non-cascade error line (MSG-NC-1 / CMC-34) -- internal
 * classified-error return shape for `classifyEntityShapeError` and the
 * install.ts error-routing path. It lives here beside `InstallMsg` because
 * it is a message-row shape: `composeInstallFailureMessage` consumes it and
 * returns `InstallMsg`.
 *
 * Examples: `⊘ unknown@claude-plugins-official (failed) {not found}`;
 * `⊘ hookify [user] (unavailable) {unsupported hooks}`.
 */
export interface EntityErrorRow {
  readonly kind: "entity-error";
  readonly name: string;
  readonly marketplace?: string;
  readonly scope?: Scope;
  readonly status: Extract<StatusToken, "failed" | "unavailable">;
  readonly reasons: readonly ContentReason[];
  // SEV-02 / D-69-03: carried from the thrown PluginShapeError's `partialable`
  // discriminant on the `unavailable` arm -- `true` when the resolver verdict
  // is partially-available, so the composed row points at `--partial`.
  readonly partialable?: boolean;
}

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
  unavailable: (p, probe, mpScope) => renderUnavailableRow(p, probe, mpScope),
  // XSURF-01: the partially-available install-failure arm. Byte-identical to the
  // `unavailable` arm but with the `⊖` glyph + `(partially-available)` token; the
  // `--partial` hint trailer is composed centrally by the renderer, not here.
  "partially-available": (p, probe, mpScope) => renderPartiallyAvailableRow(p, probe, mpScope),
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
