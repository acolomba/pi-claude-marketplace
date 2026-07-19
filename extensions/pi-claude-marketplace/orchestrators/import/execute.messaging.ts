import {
  composeReasons,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginFailedMessage,
  type PluginInstalledMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * import/execute.messaging.ts -- the command-local notification vocabulary for
 * the `import` mixed-subject cascade (MOD-01). It co-locates import's operation
 * label, the union of plugin-row statuses import actually emits, and a render
 * map total over that union. The cascade is mixed-subject: a single load-time
 * import can touch many marketplaces, each carrying installed / skipped /
 * failed / unavailable plugin rows (RECON-04 reuse of the shared per-status
 * shapes). The render map renders only the per-PLUGIN-ROW body; the marketplace
 * header (`added` / `updated` / `failed`), cause-chains, rollback trailers, the
 * `(no marketplaces)` sentinel, the reload hint, and the severity/summary
 * surface all stay central in `notify.ts` and route byte-identically through
 * `emitContextCascade` (D-11).
 *
 * D-10: `IMPORT_CONTEXT` is pinned via `as const satisfies
 * CommandContext<...>`, so omitting a render arm for any declared status is a
 * TS2741 compile error at the satisfies site -- the localized replacement for
 * the central `renderPluginRow` `assertNever` default.
 */

/**
 * The plugin-row statuses the import cascade emits. Marketplace-level
 * `added` / `updated` / `failed` statuses are rendered by the central
 * `renderMpHeader` seam, not this per-row map; the rows this map dispatches are
 * the per-plugin children: a successful install (`installed`), an
 * already-present skip (`skipped`), a per-plugin failure (`failed`, e.g.
 * source-mismatch / not-in-manifest), and a soft-unavailable plugin
 * (`unavailable`).
 */
export const IMPORT_STATUSES = ["installed", "skipped", "failed", "unavailable"] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

/**
 * The discriminated union of plugin-row message shapes import constructs
 * (`buildImportNotificationMarketplaces`). `Extract<ImportMsg, { status: K }>`
 * narrows each render arm to exactly the shape carrying status `K`.
 */
export type ImportMsg =
  PluginInstalledMessage | PluginSkippedMessage | PluginFailedMessage | PluginUnavailableMessage;

/**
 * `(installed)` -- cascade install row. Only the `installed` arm reads
 * `dependencies` for the soft-dep marker brace (agents / mcp companion-
 * extension gating); the brace also folds in any `reasons` (e.g. orphan
 * rewake). Lifted verbatim from the central `renderPluginRow` `installed` arm.
 */
const renderInstalled: RenderFn<PluginInstalledMessage> = (p, probe, mpScope) =>
  installedLikeRow(
    ICON_INSTALLED,
    p,
    mpScope,
    renderVersion(p.version),
    "(installed)",
    p.reasons,
    probe,
  );

/**
 * `(skipped)` -- already-installed plugin row. No soft-dep gating (passes
 * `false`/`false` via the shared `pluginRow` primitive). Lifted verbatim from
 * the central `renderPluginRow` `skipped` arm.
 */
const renderSkipped: RenderFn<PluginSkippedMessage> = (p, probe, mpScope) =>
  pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe);

/**
 * `(failed)` -- per-plugin failure row (source mismatch / not-in-manifest). No
 * soft-dep gating. Lifted verbatim from the central `renderPluginRow` `failed`
 * arm. The cause-chain trailer is composed centrally by `composePluginLinesWith`
 * (NFR-9 path redaction stays central), not here.
 */
const renderFailed: RenderFn<PluginFailedMessage> = (p, probe, mpScope) =>
  pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe);

/**
 * `(unavailable)` -- soft-unavailable plugin row. No `scope` bracket (SNM-11
 * carve-out) and no soft-dep gating; carries its own `reasons`. Lifted verbatim
 * from the central `renderPluginRow` `unavailable` arm.
 */
const renderUnavailable: RenderFn<PluginUnavailableMessage> = (p, probe, mpScope) =>
  joinTokens([
    ICON_UNINSTALLABLE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(unavailable)",
    composeReasons(p.reasons, false, false, probe),
  ]);

/**
 * D-04 / D-05: import's `CommandContext`. `Messaging.label` is the human
 * operation name `"Import"`. The `render` map is total over `ImportStatus`
 * (D-10). import declares no command-private reasons -- it reuses the shared
 * closed reason set (`notify-reasons.ts`).
 */
export const IMPORT_CONTEXT = {
  Messaging: { label: "Import" },
  render: {
    installed: renderInstalled,
    skipped: renderSkipped,
    failed: renderFailed,
    unavailable: renderUnavailable,
  },
} as const satisfies CommandContext<ImportStatus, ImportMsg>;
