import { assertNever, causeChainTrailer } from "./errors.ts";

import type { Reason } from "./grammar/reasons.ts";
import type { Scope } from "./types.ts";
import type { ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";

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
/** V1 3-arg overload signature (Phase 21 deletes). */
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void;
/** V2 structured usage-error entry point (SNM-13, D-16-02). Coexists with V1 3-arg notifyUsageError. */
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;
export function notifyUsageError(
  ctx: ExtensionContext,
  message: string | UsageErrorMessage,
  usageBlock?: string,
): void {
  if (typeof message === "string") {
    // V1 3-arg path -- byte-equal to the pre-Phase-16 wrapper at the
    // historical shared/notify.ts:105. The runtime body is identical:
    // ctx.ui.notify(`${message}\n\n${usageBlock}`, "error").
    // The overload signature guarantees usageBlock is present here; the
    // `?? ""` fallback exists solely to satisfy strict-null-check without
    // an eslint-suppressed non-null assertion (see eslint config: the
    // per-file override for shared/notify.ts disables no-restricted-syntax
    // but NOT no-non-null-assertion).
    ctx.ui.notify(`${message}\n\n${usageBlock ?? ""}`, "error");
  } else {
    // V2 structured path -- destructure UsageErrorMessage and emit the
    // same on-the-wire shape (`${message}\n\n${usage}` with "error"
    // severity), byte-equal to V1.
    ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
  }
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

// ---------------------------------------------------------------------------
// Phase 16 v2 grammar additions -- file-private rendering helpers (D-16-09).
//
// SNM-17 / SNM-18 contract: the v2 marketplace-header grammar and per-status
// icon discipline live HERE as the sole site that knows them. Plan 04 will
// add `renderPluginRow`; plan 05 will compose both helpers into the public
// `notify()` entry point. The duplication of literals from `presentation/*`
// is intentional (D-16-04 / D-16-09) and ends in Phase 21 when V1 wrappers
// and `presentation/*` composers are deleted together.
// ---------------------------------------------------------------------------

/** V2 grammar constants duplicated from presentation/compact-line.ts per D-16-04. Phase 21 deletes both copies. */
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";

/**
 * Renders the v2 marketplace header line. SOLE site for marketplace-header
 * grammar (SNM-17). File-private; consumed by notify() in plan 05. The case
 * undefined: arm explicitly guards mp.details === undefined per Phase 15's
 * optional-independent details? field.
 *
 * Byte forms (one per arm):
 *   "added"     -> `${ICON_INSTALLED}     ${name} [${scope}] (added)`
 *   "removed"   -> `${ICON_INSTALLED}     ${name} [${scope}] (removed)`
 *   "updated"   -> `${ICON_INSTALLED}     ${name} [${scope}] (updated)`
 *   "failed"    -> `${ICON_UNINSTALLABLE} ${name} [${scope}] (failed)`
 *   undefined   (list-surface):
 *     SUB-BRANCH A (mp.details === undefined): `${ICON_INSTALLED} ${name} [${scope}]`
 *     SUB-BRANCH B (mp.details !== undefined): `${ICON_INSTALLED} ${name} [${scope}]`
 *       + " <autoupdate>" iff mp.details.autoupdate === true (V1 marketplace-list
 *         byte-equivalent: marker omitted entirely when autoupdate is false)
 *       + " <last-updated ${mp.details.lastUpdatedAt}>" iff mp.details.lastUpdatedAt
 *         is defined (v2-only marker following V1's `<marker>` angle-bracket
 *         convention from presentation/compact-line.ts MarketplaceRow.marker)
 *
 * The icon arms use ICON_AVAILABLE nowhere -- marketplaces are either ok
 * (●) or failure-class (⊘); the open-circle ○ is reserved for available /
 * uninstalled PLUGIN rows that plan 04's `renderPluginRow` will own.
 */
function renderMpHeader(mp: MarketplaceNotificationMessage): string {
  switch (mp.status) {
    case "added":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (added)`;
    case "removed":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (removed)`;
    case "updated":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (updated)`;
    case "failed":
      return `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`;
    case undefined: {
      // List-surface case. mp.details is OPTIONAL and INDEPENDENT of mp.status
      // per Phase 15's D-15-06 (shared/notify.ts:466). Guard explicitly with
      // an early return for SUB-BRANCH A (mp.details === undefined) so the
      // SUB-BRANCH B composition below reads narrowed (non-optional)
      // mp.details.autoupdate / mp.details.lastUpdatedAt under TS strict.
      if (mp.details === undefined) {
        // SUB-BRANCH A: empty-list-surface -- bare header, no trailing tokens.
        return `${ICON_INSTALLED} ${mp.name} [${mp.scope}]`;
      }

      // SUB-BRANCH B: list-surface with details.
      // Compose tokens conditionally, then suppress empty slots so the join
      // never emits double-spaces. Mirrors V1 marketplace-list.ts:88 byte
      // discipline: emit `<autoupdate>` iff `autoupdate === true` (no
      // `<no autoupdate>` counterpart -- absence of the marker conveys
      // autoupdate-off).
      const autoupdateToken = mp.details.autoupdate ? "<autoupdate>" : "";
      const lastUpdatedToken =
        mp.details.lastUpdatedAt === undefined ? "" : `<last-updated ${mp.details.lastUpdatedAt}>`;
      return [ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken, lastUpdatedToken]
        .filter((t) => t !== "")
        .join(" ");
    }

    default:
      return assertNever(mp.status);
  }
}

// ---------------------------------------------------------------------------
// Phase 16 plan 04 -- file-private renderPluginRow + supporting helpers.
//
// SNM-17 / SNM-18: the v2 per-plugin row grammar lives HERE as the sole
// site. SNM-16 / D-16-15: soft-dep markers are injected at render time from
// the per-row `dependencies?` declaration + the threaded `SoftDepStatus`
// probe. D-16-10: the switch ends with `default: return assertNever(p);`
// so a future `PluginNotificationMessage` variant becomes a compile error
// at this switch.
//
// Bounded duplication of literals from `presentation/compact-line.ts` and
// `presentation/version-arrow.ts` is intentional (D-16-04 / D-16-09) and
// ends in Phase 21 when V1 wrappers and `presentation/*` composers are
// deleted together.
// ---------------------------------------------------------------------------

/** Soft-dep marker literals duplicated from presentation/compact-line.ts per D-16-04/D-16-15. Phase 21 deletes both copies. */
const SOFT_DEP_MARKER_AGENTS = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP = "requires pi-mcp";

/**
 * Join tokens with single spaces, suppressing empty slots so absent
 * optional tokens (e.g. an undefined scope-bracket on `available` rows)
 * never produce a double-space. Mirrors `presentation/compact-line.ts`
 * `joinTokens` (lines 489-491); duplicated inline per D-16-04.
 */
function joinTokens(parts: readonly string[]): string {
  return parts.filter((p) => p !== "").join(" ");
}

/**
 * Prepend `v` to the version string, returning `""` when `version` is
 * undefined or empty so the join discipline collapses the slot cleanly.
 * Mirrors `presentation/compact-line.ts` `renderVersion` (lines 481-487);
 * duplicated inline per D-16-04.
 */
function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${version}`;
}

/**
 * Conditional `[<scope>]` emitter. SOLE site for scope-bracket emission
 * inside `renderPluginRow` (BLOCKER-1 fix): per-arm code MUST funnel
 * `p.scope` through this helper so the bracket renders `""` when scope is
 * undefined (the common case -- the marketplace header carries the
 * `[mp.scope]` token; the per-row bracket only appears in the orphan-fold
 * case per D-16-17 + SNM-11). For `available` / `unavailable` variants
 * (which have NO `scope?` field at all per MSG-PL-6 / SNM-11 carve-out),
 * arm code passes `undefined` explicitly so the bracket unconditionally
 * collapses.
 */
function renderScopeBracket(scope: Scope | undefined): string {
  return scope === undefined ? "" : `[${scope}]`;
}

/**
 * Compose the MSG-PL-3 version-transition slot for the `updated` arm
 * (`<from> → v<to>`) and as a defensive helper for adjacent arms. Mirrors
 * `presentation/version-arrow.ts` lines 33-50 byte-for-byte; duplicated
 * inline per D-16-04.
 *
 * Per the plan-04 contract this helper returns `""` (not `undefined`) so
 * the `joinTokens` discipline collapses the slot cleanly when both sides
 * are undefined. For the `updated` variant, Phase 15 D-15-04 declares
 * `from` / `to` as REQUIRED so the both-defined branch is the live path;
 * the only-`to` and only-`from` branches are defensive (no current
 * caller in this plan exercises them, but they preserve the
 * version-arrow.ts contract).
 */
function composeVersionArrow(from: string | undefined, to: string | undefined): string {
  if (from === undefined && to === undefined) {
    return "";
  }

  if (from !== undefined && to !== undefined) {
    return `${from} → v${to}`;
  }

  if (to !== undefined) {
    return renderVersion(to);
  }

  // `from` is defined and `to` is undefined -- defensive branch matching
  // `presentation/version-arrow.ts:49`. Pass through unchanged (no `v`
  // prefix, mirroring the source helper's intent that `from` is the
  // bare value).
  return from ?? "";
}

/**
 * Compose the MSG-GR-4 reasons-block, injecting soft-dep markers from
 * the per-row `dependencies?` declaration + the threaded probe.
 *
 *   - Starts from the caller-provided `reasons` array (or `[]` when the
 *     variant lacks a reasons field).
 *   - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *   - Appends `SOFT_DEP_MARKER_MCP`    iff `declaresMcp    && !probe.piMcpAdapterLoaded`.
 *   - Returns `""` when the composed array is empty (MSG-GR-4 forbids `{}`).
 *   - Otherwise returns `{<r1>, <r2>, ...}`.
 *
 * Mirrors `presentation/compact-line.ts` `composeReasons` (lines 458-479);
 * duplicated inline per D-16-04 / D-16-15.
 *
 * The first parameter is typed `readonly string[] | undefined` rather than
 * `readonly Reason[] | undefined` for cross-variant ergonomics: each
 * switch arm passes either `p.reasons` (already `readonly Reason[]`, a
 * subtype of `readonly string[]`) or `undefined`. The discriminated-union
 * narrowing inside `renderPluginRow` guarantees that only valid `Reason`
 * arrays (or `undefined`) flow in.
 */
function composeReasons(
  reasons: readonly string[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string {
  const composed: string[] = reasons === undefined ? [] : [...reasons];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    composed.push(SOFT_DEP_MARKER_AGENTS);
  }

  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    composed.push(SOFT_DEP_MARKER_MCP);
  }

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
}

/**
 * Renders the v2 plugin row (no leading indent -- caller adds it). SOLE
 * site for plugin-row grammar (SNM-17). assertNever default arm is the
 * compile-time exhaustiveness gate (D-16-10).
 *
 * Token order follows the v1 grammar `icon name [scope] versionToken
 * (status) {reasons}` (MSG-GR-1). Scope bracket is emitted conditionally
 * via `renderScopeBracket(p.scope)` on the 8 variants that declare
 * `scope?`; the `available` / `unavailable` arms unconditionally omit the
 * bracket per MSG-PL-6 / SNM-11 by passing `undefined` to
 * `renderScopeBracket`.
 *
 * Soft-dep marker injection (D-16-15): only the `installed` / `updated` /
 * `reinstalled` arms carry `dependencies` (Phase 15 D-15-02); those arms
 * pass `p.dependencies.includes("agents")` / `p.dependencies.includes("mcp")`
 * to `composeReasons`. The other 7 arms pass `false` for both
 * declares-flags so the soft-dep markers cannot leak onto rows that
 * structurally never declare a soft dep.
 *
 * Per-variant `composeReasons` first argument:
 *   - 5 reasons-less variants (installed, updated, reinstalled,
 *     uninstalled, available) pass `undefined`;
 *   - 5 reasons-bearing variants (unavailable, upgradable, skipped,
 *     failed, manual recovery) pass `p.reasons`.
 *
 * NOT rendered here (plan 05's `notify()` composes them as additional
 * indented lines AFTER the row):
 *   - `failed.cause` / `manual recovery.cause` cause-chain trailers.
 *   - `failed.rollbackPartial[]` child rows.
 */
function renderPluginRow(p: PluginNotificationMessage, probe: SoftDepStatus): string {
  switch (p.status) {
    case "installed":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(installed)",
        composeReasons(
          undefined,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]);
    case "updated":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope),
        composeVersionArrow(p.from, p.to),
        "(updated)",
        composeReasons(
          undefined,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]);
    case "reinstalled":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(reinstalled)",
        composeReasons(
          undefined,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]);
    case "uninstalled":
      return joinTokens([
        ICON_AVAILABLE,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(uninstalled)",
        composeReasons(undefined, false, false, probe),
      ]);
    case "available":
      return joinTokens([
        ICON_AVAILABLE,
        p.name,
        // MSG-PL-6 / SNM-11 carve-out: `available` has NO `scope?` field.
        renderScopeBracket(undefined),
        renderVersion(p.version),
        "(available)",
        composeReasons(undefined, false, false, probe),
      ]);
    case "unavailable":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        // MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field.
        renderScopeBracket(undefined),
        renderVersion(p.version),
        "(unavailable)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "upgradable":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(upgradable)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "skipped":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(skipped)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "failed":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        "(failed)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "manual recovery":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope),
        renderVersion(p.version),
        // `manual recovery` discriminator preserved verbatim WITH A SPACE
        // per CONTEXT `<specifics>` + shared/grammar/status-tokens.ts:47.
        "(manual recovery)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    default:
      return assertNever(p);
  }
}

// Same self-reference for renderMpHeader -- it is wired by plan 05 into
// notify(), but is intentionally file-private (SNM-17, D-16-09) so cannot
// be made visible to TS via a re-export. The `void` discard is the
// documented escape hatch (per plan 03 execution context) that keeps
// `noUnusedLocals` quiet without an inline lint disable directive. Plan 04
// (this) removed the matching `void ICON_AVAILABLE;` self-reference because
// `renderPluginRow` now consumes `ICON_AVAILABLE` in the `(available)` /
// `(uninstalled)` arms. Plan 05's `notify()` will consume `renderPluginRow`
// and delete this remaining `void renderMpHeader;` line.
void renderMpHeader;
void renderPluginRow;
