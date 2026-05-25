import { causeChainTrailer } from "./errors.ts";

import type { Reason } from "./grammar/reasons.ts";
import type { Scope } from "./types.ts";
import type { ExtensionContext } from "../platform/pi-api.ts";

// Re-export Reason so Phase 16-20 call-site authors can import the entire v1.4
// structured-notify surface (types + Reason) from this file alone, instead of
// hopping to shared/grammar/reasons.ts. The runtime REASONS array + drift test
// against docs/messaging-style-guide.md stay in their original module; this
// is a pure type re-export (D-15-03 + Claude's discretion per CONTEXT).
export type { Reason } from "./grammar/reasons.ts";

/**
 * shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site (D-07).
 *
 * Severity is part of the function name. The Pi API's `notify(msg, type?)`
 * accepts a magic-string `"info" | "warning" | "error"` second arg; a typo
 * like `"warining"` silently degrades to `"info"` because there is no
 * exhaustiveness check. Severity-named wrappers eliminate that class of bug.
 *
 * The eslint per-file override in eslint.config.js (D-06 / BLOCK B) disables
 * `no-restricted-syntax` for this file, so inline `eslint-disable-next-line`
 * comments are unnecessary here (they would trigger
 * `reportUnusedDisableDirectives` warnings). The per-file override is the
 * single audit surface; this comment documents the sanctioned-use intent in
 * its place.
 *
 * SANCTIONED WRAPPERS (CMC-19 Phase 12 affirmation, governed by style guide
 * §10 MSG-SR-1..7):
 *
 *   (§10 numbering: MSG-SR-1..3 govern single-shot severity routing -- one
 *    rule per wrapper for the non-cascade case; MSG-SR-4..6 govern cascade
 *    summary routing -- those rules pick BETWEEN notifySuccess and
 *    notifyWarning for cascade summaries and never assign to notifyError or
 *    notifyUsageError; MSG-SR-7 is the dedicated usage-error rule routing to
 *    notifyUsageError.)
 *
 *   - notifySuccess(ctx, message)                -- default severity (MSG-SR-1; cascade variant MSG-SR-4)
 *   - notifyWarning(ctx, message)                -- "warning" severity (MSG-SR-2; cascade variant MSG-SR-5; MSG-SR-6 forbids cascade notifyError)
 *   - notifyError(ctx, message, cause?)          -- "error" severity (MSG-SR-3)
 *   - notifyUsageError(ctx, message, usageBlock) -- "error" severity (MSG-SR-7)
 *
 * Phase 13 composers return strings that flow VERBATIM into these wrappers;
 * no fifth wrapper, no structured-payload arg, no cascade-summary helper is
 * added (D-CMC-11). Severity remains structural via the wrapper name --
 * never embedded as a "[error]" / "[warning]" prefix in message text
 * (PRD §6.12 ES-2, reaffirmed by MSG-SR-7).
 *
 * Import path (D-CMC-13): callers import the wrappers directly from this
 * file (e.g., `import { notifySuccess } from "../../shared/notify.ts"`). No
 * presentation/ barrel re-exports the wrappers in Phase 12; the existing
 * direct-import path is the stable surface.
 */

/** Default-severity notify -- success path. */
export function notifySuccess(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message);
}

/** Warning notify -- used for cleanup leaks, partial failures, soft-dep warnings. */
export function notifyWarning(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

/**
 * Error notify -- operation did not succeed; state unchanged or fully rolled
 * back. Optional `cause` feeds Error.cause for the depth-5 MSG-CC-1 walk; the
 * trailer is appended automatically with a blank-line separator
 * (`${message}\n\n${trailer}`), matching the MSG-RH-1 blank-line discipline.
 *
 * D-CMC-12 (Phase 13): this body replaces the Phase 6 placeholder that
 * surfaced the cause as `\nCause: <message>`. The depth-5 walker lives in
 * `shared/errors.ts::causeChainTrailer` (re-exported from
 * `presentation/cause-chain.ts` for presentation-layer consumers); orchestrators
 * pass bare `err` here and let `notifyError` compose the trailer once, retiring
 * the legacy per-callsite pre-format-then-pass-as-message wrapping.
 *
 * NFR-9 / T-13-05 invariant: the trailer surfaces ONLY `Error.message` (or
 * `string` verbatim or `Object.prototype.toString.call` fallback for non-Error
 * causes). No `.stack`, no absolute paths. Callers that need to expose a path
 * must put it in `message` deliberately. Depth bound 5 prevents cycle DoS
 * (T-13-04) via the walker's cycle-detection inside `shared/errors.ts`.
 */
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const trailer = cause === undefined ? "" : causeChainTrailer(cause);
  const body = trailer === "" ? message : `${message}\n\n${trailer}`;
  ctx.ui.notify(body, "error");
}

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank line.
 *
 * Phase 6 will assemble actual Usage block strings (from PRD §6.12 ES-5
 * placeholders + per-subcommand argument tables) and call this primitive at
 * every argument-validation failure site. Phase 1 ships the primitive only;
 * call sites do not yet exist.
 *
 * Contract: the on-the-wire string is `${message}\n\n${usageBlock}`. The
 * blank line between message and Usage block is part of the user contract;
 * tests in Plan 06 assert it byte-for-byte.
 */
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void {
  ctx.ui.notify(`${message}\n\n${usageBlock}`, "error");
}

// ---------------------------------------------------------------------------
// v1.4 structured notification type model (Phase 15)
//
// Satisfies REQUIREMENTS.md SNM-01 (NotificationMessage), SNM-02
// (MarketplaceNotificationMessage), SNM-03 (10-variant PluginNotificationMessage
// discriminated union), SNM-04 (PluginStatus derived via indexed access),
// SNM-05 (MarketplaceStatus closed set), SNM-06 (Dependency + required
// `dependencies` on installed/updated/reinstalled), SNM-07 (MarketplaceDetails
// shape), SNM-08 (UsageErrorMessage shape), SNM-09 (rollbackPartial only on
// failed), SNM-10 (cause only on failed/manual recovery), SNM-11 (scope absent
// on available/unavailable).
//
// Governed by locked decisions D-15-01 (per-variant reasons discipline),
// D-15-02 (per-variant dependencies discipline), D-15-03 (Reason imported
// from shared/grammar/reasons.ts unchanged), D-15-04 (version vs from/to
// placement), D-15-05 (MarketplaceDetails fields), D-15-06 (status?/details?
// independent optionals), D-15-07 (MarketplaceStatus 4 entries, no "skipped"),
// D-15-08 / D-15-09 (empty arrays IS the structural "(no plugins)" /
// "(no marketplaces)" rendering), D-15-11 (runtime `as const` tuples shipped
// alongside derived literal-union types).
//
// Patterns:
//   - `as const` tuple + `(typeof X)[number]` literal-union derivation
//     mirrors shared/grammar/status-tokens.ts:34-52.
//   - Named per-variant interfaces joined in one discriminated union mirrors
//     presentation/compact-line.ts:96-259 (RowSpec). PluginNotificationMessage
//     discriminates on `status` instead of `kind`.
//   - MarketplaceDetails.lastUpdatedAt? mirrors persistence/state-io.ts:70
//     so list-surface orchestrators can pass the record's value through
//     unchanged.
//
// Zero runtime impact in Phase 15: the V1 wrappers above are the only call
// site of `ctx.ui.notify` in this file (D-07); no call site in extensions/
// references these new symbols (success criterion #4). Phase 16 wires the
// renderer + `notify(ctx, NotificationMessage)` public API; Phases 17-20
// migrate the catalog UAT and call sites; Phase 21 deletes the V1 wrappers.
// ---------------------------------------------------------------------------

/**
 * Runtime tuple of every plugin status literal (D-15-11). 10 entries.
 * `"manual recovery"` is a literal string WITH A SPACE per
 * shared/grammar/status-tokens.ts:47 precedent; do not transform to
 * kebab-case ("manual-recovery") or camelCase ("manualRecovery") -- the
 * Phase 16 renderer emits the discriminator literal directly into the
 * `(<status>)` brace slot.
 *
 * Pattern: shared/grammar/status-tokens.ts:34-52.
 */
export const PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
] as const;

/**
 * Runtime tuple of every marketplace status literal (D-15-07, D-15-11).
 * 4 entries -- no `"skipped"`; v1.3's marketplace-skipped rendering case
 * re-routes through `"updated"` with an empty `plugins: []` or through
 * the always-marketplace-header spec.
 *
 * Pattern: shared/grammar/status-tokens.ts:34-52.
 */
export const MARKETPLACE_STATUSES = ["added", "removed", "updated", "failed"] as const;

/**
 * Runtime tuple of every dependency literal (SNM-06, D-15-11). 2 entries.
 * Drives the Phase 16 renderer's per-dependency soft-dep probe path
 * (`requires pi-subagents` / `requires pi-mcp` reason emission).
 *
 * Pattern: shared/grammar/status-tokens.ts:34-52.
 */
export const DEPENDENCIES = ["agents", "mcp"] as const;

/**
 * Closed set of plugin status discriminators (SNM-04). Derived from
 * `PLUGIN_STATUSES` via indexed access so the runtime tuple and the type
 * stay in lockstep.
 */
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];

/**
 * Closed set of marketplace status discriminators (SNM-05). Derived from
 * `MARKETPLACE_STATUSES` via indexed access.
 */
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];

/**
 * Closed set of dependency probe targets (SNM-06). Derived from
 * `DEPENDENCIES` via indexed access.
 */
export type Dependency = (typeof DEPENDENCIES)[number];

/**
 * Marketplace-level details surfaced on the `marketplace list` rendering
 * (SNM-07, D-15-05). `autoupdate` is REQUIRED -- the persistence record
 * always knows whether autoupdate is enabled. `lastUpdatedAt?` is an
 * optional ISO timestamp whose shape mirrors
 * persistence/state-io.ts:70 (`lastUpdatedAt: Type.Optional(Type.String())`)
 * so list orchestrators can pass the record's value through unchanged.
 *
 * Intentionally minimal: no `source`, no `version`, no other entries
 * (per D-15-05; v1.4 catalog rendering does not consume any).
 */
export interface MarketplaceDetails {
  readonly autoupdate: boolean;
  readonly lastUpdatedAt?: string;
}

/**
 * Usage-error payload consumed by the Phase 16 V2 `notifyUsageError(ctx,
 * UsageErrorMessage)` entry point (SNM-08). Both fields REQUIRED; the
 * renderer composes the on-the-wire string as `${message}\n\n${usage}`
 * mirroring the V1 wrapper's blank-line discipline at line 96 above.
 *
 * No `cause` (the usage-error path is non-cause-bearing; cause chains
 * belong to `PluginFailedMessage.cause` / `PluginManualRecoveryMessage.cause`
 * per SNM-10) and no `severity` (always `"error"` -- structural, not a
 * field per PRD §6.12 ES-2).
 */
export interface UsageErrorMessage {
  readonly message: string;
  readonly usage: string;
}

// ---------------------------------------------------------------------------
// Per-variant plugin notification interfaces (SNM-03).
//
// Each variant is a separate exported `interface` joined in the
// `PluginNotificationMessage` union below. Pattern mirrors
// presentation/compact-line.ts:96-259 (RowSpec). Every field `readonly`.
//
// Per-variant required/optional discipline:
//   - D-15-01: `reasons: readonly Reason[]` REQUIRED only on the 5 variants
//     that emit a `{<reason>}` brace -- unavailable, upgradable, skipped,
//     failed, manual recovery. The other 5 omit the field entirely so the
//     compiler rejects `(installed) {up-to-date}` shapes.
//   - D-15-02: `dependencies: readonly Dependency[]` REQUIRED only on
//     installed / updated / reinstalled (per SNM-06). Other 7 variants omit.
//   - D-15-04: `version?: string` on all variants except `updated`, which
//     carries REQUIRED `from: string; to: string` instead (mirrors
//     v1.3's `v1.0 → v1.2` arrow rendering).
//   - SNM-11: `scope?: Scope` absent on `available` / `unavailable`
//     (carve-out: the list surface does not emit `[<scope>]` brackets for
//     those rows per MSG-PL-6).
//   - SNM-09: `rollbackPartial?` exists only on `failed`.
//   - SNM-10: `cause?: Error` exists only on `failed` / `manual recovery`.
// ---------------------------------------------------------------------------

/**
 * `(installed)` -- single-shot install or cascade install row. Carries
 * `dependencies` (SNM-06, D-15-02) so the renderer can emit the
 * `requires pi-subagents` / `requires pi-mcp` probe reasons; no `reasons`
 * because installed rows never emit a `{<reason>}` brace (D-15-01).
 */
export interface PluginInstalledMessage {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(updated)` -- update cascade row. Carries REQUIRED `from` / `to`
 * (D-15-04) so the renderer can compose the `v1.0 → v1.2` arrow form;
 * `dependencies` REQUIRED per D-15-02; no `reasons` (D-15-01).
 */
export interface PluginUpdatedMessage {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly dependencies: readonly Dependency[];
  readonly scope?: Scope;
}

/**
 * `(reinstalled)` -- reinstall cascade row. Carries `dependencies` per
 * D-15-02; no `reasons` (D-15-01).
 */
export interface PluginReinstalledMessage {
  readonly status: "reinstalled";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(uninstalled)` -- single-shot uninstall or cascade uninstall row. NO
 * `dependencies` (D-15-02 -- MSG-SD-3 forbids the soft-dep marker on
 * uninstalled rows); no `reasons` (D-15-01).
 */
export interface PluginUninstalledMessage {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(available)` -- list-surface row for installable, not-yet-installed
 * plugins. NO `scope` (SNM-11 carve-out: MSG-PL-6 omits `[<scope>]`
 * brackets on available rows); no `reasons` (D-15-01); no `dependencies`
 * (D-15-02).
 */
export interface PluginAvailableMessage {
  readonly status: "available";
  readonly name: string;
  readonly version?: string;
}

/**
 * `(unavailable)` -- list-surface row for plugins whose manifest exists
 * but cannot be installed under the current Pi environment (missing host
 * features). Carries REQUIRED `reasons` (D-15-01); NO `scope` (SNM-11);
 * no `dependencies` (D-15-02).
 */
export interface PluginUnavailableMessage {
  readonly status: "unavailable";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
}

/**
 * `(upgradable)` -- list-surface row for installed plugins with a newer
 * version available upstream. STRUCTURALLY constrained to the list surface
 * per MSG-PL-4 / CMC-09 (never emitted on cascade rows). Carries REQUIRED
 * `reasons` (D-15-01); no `dependencies` (D-15-02).
 */
export interface PluginUpgradableMessage {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(failed)` -- failure row across single-shot and cascade surfaces.
 * Carries REQUIRED `reasons` (D-15-01); optional `cause?: Error` (SNM-10)
 * feeds the depth-5 cause-chain trailer; optional
 * `rollbackPartial?: readonly { phase; cause? }[]` (SNM-09) drives the
 * MSG-RP-1 indented child rows when a rollback was partial.
 */
export interface PluginFailedMessage {
  readonly status: "failed";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
  readonly rollbackPartial?: readonly {
    readonly phase: string;
    readonly cause?: Error;
  }[];
}

/**
 * `(skipped)` -- per-plugin skip row inside cascades (e.g. update cascade
 * encountering an already-up-to-date plugin). Carries REQUIRED `reasons`
 * (D-15-01); no `dependencies` (D-15-02); no `cause` (skipped is not a
 * failure -- SNM-10 confines `cause` to failed / manual recovery).
 */
export interface PluginSkippedMessage {
  readonly status: "skipped";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(manual recovery)` -- per-plugin manual-recovery anchor row (MSG-MR-1).
 * Status discriminator is the literal string `"manual recovery"` WITH A
 * SPACE per shared/grammar/status-tokens.ts:47 precedent. Carries REQUIRED
 * `reasons` (D-15-01) and optional `cause?: Error` (SNM-10); no
 * `dependencies` (D-15-02); no `rollbackPartial` (only `failed` carries
 * it per SNM-09).
 */
export interface PluginManualRecoveryMessage {
  readonly status: "manual recovery";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
}

/**
 * Discriminated union of every per-plugin notification variant (SNM-03).
 * Phase 16's renderer narrows via `switch (msg.status)` + `assertNever` for
 * exhaustiveness; downstream tests iterate `PLUGIN_STATUSES` to enumerate
 * the variants.
 *
 * Pattern: presentation/compact-line.ts:250-259 (RowSpec).
 */
export type PluginNotificationMessage =
  | PluginInstalledMessage
  | PluginUpdatedMessage
  | PluginReinstalledMessage
  | PluginUninstalledMessage
  | PluginAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginFailedMessage
  | PluginSkippedMessage
  | PluginManualRecoveryMessage;

/**
 * Marketplace-level notification message (SNM-02, D-15-06). `status?`
 * and `details?` are independent optionals -- they never co-occur in
 * practice (Phase 16 renderer ignores `details` when `status` is set) but
 * the type does not structurally constrain that. Mirrors v1.3
 * `MarketplaceRow`'s independent `status?` / `marker?` pattern at
 * presentation/compact-line.ts:190-198.
 *
 * `plugins: readonly PluginNotificationMessage[]` is REQUIRED. An empty
 * array IS the structural representation of the `(no plugins)` rendering
 * on the list surface (D-15-08); on state-change paths an empty
 * `plugins` array is the normal case (renderer emits the marketplace
 * header alone). No separate `noPlugins` discriminator field.
 */
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;
  readonly details?: MarketplaceDetails;
  readonly plugins: readonly PluginNotificationMessage[];
}

/**
 * Top-level structured notification payload consumed by the Phase 16 V2
 * `notify(ctx, NotificationMessage)` entry point (SNM-01). The
 * `marketplaces` array is the only field -- severity is computed
 * structurally by the renderer's switch (never embedded as a field per
 * PRD §6.12 ES-2) and the trailer is composed by the renderer at
 * emission time.
 *
 * An empty `marketplaces: []` IS the structural representation of the
 * `(no marketplaces)` rendering on the `marketplace list` surface
 * (D-15-09); state-change paths always populate at least one
 * marketplace. No top-level `noMarketplaces` discriminator field.
 */
export interface NotificationMessage {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}
