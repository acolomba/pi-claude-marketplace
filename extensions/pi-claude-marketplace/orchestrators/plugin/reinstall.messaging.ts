import {
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  composeReasons,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginFailedMessage,
  type PluginManualRecoveryMessage,
  type PluginReinstalledMessage,
  type PluginSkippedMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * reinstall.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin reinstall` (MOD-01). Co-locates reinstall's private status
 * set, its cascade row message shapes, and a render map total over reinstall's
 * OWN statuses (D-10) lifting the matching `renderPluginRow` arm bodies
 * VERBATIM. The shared presentation vocabulary stays central in
 * `shared/notify.ts` (D-11) and is CALLED here, never duplicated.
 *
 * NFR-9: the `manual recovery` / `failed` cause-chain and rollback-partial
 * trailing lines are NOT composed here. The render map renders only the single
 * row body; the central `emitContextCascade` seam appends the indented
 * cause-chain / rollback-partial lines through `redactAbsolutePaths` (D-11), so
 * the path-redaction security seam is never bypassed.
 */

/**
 * reinstall's private status set: a success `reinstalled` row, a `skipped` row
 * (benign no-op), a `failed` row, or a `manual recovery` anchor row.
 */
export const REINSTALL_STATUSES = ["reinstalled", "skipped", "failed", "manual recovery"] as const;
export type ReinstallStatus = (typeof REINSTALL_STATUSES)[number];

/**
 * reinstall's row message union. `dependencies` stays REQUIRED on the
 * `reinstalled` arm so the soft-dep marker injection fires for exactly that arm
 * (D-06 / TYPE-04).
 */
export type ReinstallMsg =
  | PluginReinstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage
  | PluginManualRecoveryMessage;

/**
 * Render map total over reinstall's OWN statuses (D-10): a missing arm is a
 * TS2741 compile error at the `satisfies` site. Arm bodies are byte-identical
 * to the central `renderPluginRow` switch. The `manual recovery` status
 * discriminator is the literal `"manual recovery"` WITH a space.
 */
const REINSTALL_RENDER: {
  [K in ReinstallStatus]: RenderFn<Extract<ReinstallMsg, { status: K }>>;
} = {
  reinstalled: (p, probe, mpScope) =>
    joinTokens([
      ICON_INSTALLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(reinstalled)",
      composeReasons(
        undefined,
        p.dependencies.includes("agents"),
        p.dependencies.includes("mcp"),
        probe,
      ),
    ]),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  "manual recovery": (p, probe, mpScope) =>
    pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(manual recovery)", probe),
};

/**
 * D-04 / D-05: reinstall's `CommandContext`. The `as const satisfies` pin
 * enforces that reinstall supplies both `Messaging.label` and a total render
 * map.
 */
export const REINSTALL_CONTEXT = {
  Messaging: { label: "Plugin reinstall" },
  render: REINSTALL_RENDER,
} as const satisfies CommandContext<ReinstallStatus, ReinstallMsg>;
