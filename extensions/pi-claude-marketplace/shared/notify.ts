import { softDepStatus } from "../platform/pi-api.ts";

import { assertNever, causeChainTrailer, ManualRecoveryError } from "./errors.ts";

import type { Scope } from "./types.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";

/**
 * shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site and the
 * single source of truth for the structured-notification surface. Severity
 * is structural, not a field. The Pi API's `notify(msg, type?)` accepts a
 * magic-string `"info" | "warning" | "error"` second arg; severity is
 * computed from message contents at notify time rather than caller-supplied
 * as a prefix or field (PRD §6.12 ES-2). The eslint per-file override in
 * eslint.config.js disables `no-restricted-syntax` for this file so inline
 * `eslint-disable-next-line` comments are unnecessary here.
 *
 * Public API:
 *
 *  - notify(ctx, pi, NotificationMessage)
 *  Single state-change entry. Renders the marketplace/plugin tree
 *  to a single string and routes through ctx.ui.notify with computed
 *  severity, a computed reload-hint trailer, and a single
 *  softDepStatus(pi) probe at entry threaded through the renderer so
 *  per-row {requires pi-subagents} / {requires pi-mcp} markers are
 *  injected at render time.
 *  - notifyUsageError(ctx, UsageErrorMessage)
 *  Argv-validation errors. On-the-wire string is
 *  `${message.message}\n\n${message.usage}` at "error" severity
 *  (SNM-13).
 *
 * Closed-set source of truth: `REASONS`, `STATUS_TOKENS`, `MARKERS`,
 * `PATTERN_CLASSES` const tuples and their derived literal-union types
 * `Reason`, `StatusToken`, `Marker`, `PatternClass` live in THIS file. The
 * `compareByNameThenScope` comparator also lives here as the single
 * per-scope row-order policy across every list-rendering surface.
 *
 * Import path: callers import the surface directly from this file
 * (`import { notify, type Reason, compareByNameThenScope } from
 * "../../shared/notify.ts"`). No barrel re-exports.
 */

// ---------------------------------------------------------------------------
// Closed-set runtime tuples + derived literal-union types.
//
// Each tuple is the runtime carrier for a closed set the structured-
// notification grammar recognizes; the derived `(typeof X)[number]`
// literal-union types are the compile-time enforcement that rejects
// out-of-set string literals at renderer call sites. Tuples are stored
// WITHOUT surrounding `{}` or `<>` brace/chevron decoration -- the renderer
// composes those at emission time (MSG-GR-5).
// ---------------------------------------------------------------------------

/**
 * CMC-11 closed reasons set. Byte-equal to the `reasons:` block in the
 * binding frontmatter at `docs/messaging-style-guide.md`. The set was
 * extended from the original 23 entries to cover the autoupdate-flip
 * idempotent rows (`"already enabled"` / `"already disabled"`) and the
 * failure-class closed Reasons the catalog UAT requires across uninstall /
 * marketplace-remove partial / reinstall / update / marketplace-update rows
 * (`"permission denied"` / `"source missing"` / `"network unreachable"`).
 */
export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
] as const;

export type Reason = (typeof REASONS)[number];

/**
 * CMC-08 closed status-token set. Byte-equal to the `status_tokens:` block
 * in the binding frontmatter at `docs/messaging-style-guide.md`.
 * `(no marketplaces)` and `(no plugins)` are FLAT members of this single
 * tuple; the bare-token render shape (no icon, no scope brackets) is a
 * renderer concern that branches at emission time.
 */
export const STATUS_TOKENS = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];

/**
 * CMC-38 closed marker set. Byte-equal to the `markers:` block in the
 * binding frontmatter at `docs/messaging-style-guide.md`. Entries are
 * stored WITHOUT surrounding `<>` chevrons; the `<marker>` chevron form
 * is composed by the renderer at emission time (MSG-GR-5).
 */
export const MARKERS = ["autoupdate", "no autoupdate"] as const;

export type Marker = (typeof MARKERS)[number];

/**
 * CMC-38 closed pattern-class set. Byte-equal to the `pattern_classes:`
 * block in the binding frontmatter at `docs/messaging-style-guide.md`.
 * Pattern classes label the SHAPES of compact-line emissions (success /
 * failure / cascade-row / etc.) for documentation and rule-attribution
 * purposes. They are NOT emitted in the rendered output -- the renderer
 * dispatches on the `NotificationMessage` discriminated union's `status`
 * field. The set exists so the style-guide body and the catalog can
 * reference the same canonical labels.
 */
export const PATTERN_CLASSES = [
  "success",
  "failure",
  "cascade-row",
  "cascade-summary",
  "list-rendering",
  "reload-hint",
  "soft-dep",
  "manual-recovery",
  "rollback-partial",
  "usage",
  "empty",
  "legacy-migrate",
] as const;

export type PatternClass = (typeof PATTERN_CLASSES)[number];

/**
 * Usage error notify (ES-3 primitive). Surfaces a usage-style error at
 * `error` severity with the relevant Usage block appended after a blank
 * line. The on-the-wire string is
 * `${message.message}\n\n${message.usage}` (SNM-13). The blank
 * line between message and Usage block is part of the user contract;
 * `tests/shared/notify-v2.test.ts` asserts it byte-for-byte.
 */
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}

// ---------------------------------------------------------------------------
// Structured notification type model.
//
// Satisfies SNM-01 (NotificationMessage), SNM-02
// (MarketplaceNotificationMessage), SNM-03 (PluginNotificationMessage
// discriminated union, 11 variants), SNM-04 (PluginStatus derived via indexed
// access), SNM-05 (MarketplaceStatus closed set), SNM-06 (Dependency +
// required `dependencies` on installed/updated/reinstalled), SNM-07
// (MarketplaceDetails shape), SNM-08 (UsageErrorMessage shape), SNM-09
// (rollbackPartial only on failed), SNM-10 (cause only on failed/manual
// recovery), SNM-11 (scope absent on available/unavailable).
//
// Patterns:
//  - `as const` tuple + `(typeof X)[number]` literal-union derivation is the
//  closed-set convention used throughout this file.
//  - Named per-variant interfaces joined in one discriminated union;
//  PluginNotificationMessage discriminates on `status`.
//  - MarketplaceDetails.lastUpdatedAt? mirrors persistence/state-io.ts so
//  list-surface orchestrators can pass the record's value through
//  unchanged.
// ---------------------------------------------------------------------------

/**
 * Runtime tuple of every plugin status literal. 11 entries.
 * `"manual recovery"` is a literal string WITH A SPACE; do not transform to
 * kebab-case ("manual-recovery") or camelCase ("manualRecovery") -- the
 * renderer emits the discriminator literal directly into the `(<status>)`
 * brace slot.
 *
 * The trailing `"present"` entry is the list-only inventory token (SNM-15).
 * The four state-change tokens at the head of the tuple (`installed`,
 * `updated`, `reinstalled`, `uninstalled`) are the structurally-
 * distinguished transition tokens that drive `shouldEmitReloadHint`;
 * `"present"` is deliberately ABSENT from that trigger set so steady-state
 * `/claude:plugin list` rows never emit the `/reload to pick up changes`
 * trailer.
 *
 * Pattern: closed-set `as const` tuple + `(typeof X)[number]` literal-union.
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
  "present",
] as const;

/**
 * Runtime tuple of every marketplace status literal. 7 entries. The 3 final
 * entries (`"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"`)
 * support the autoupdate-flip surface; order is normative -- the 4 leading
 * entries retain their position to match the `renderMpHeader` switch-arm
 * ordering.
 *
 * Pattern: closed-set `as const` tuple + `(typeof X)[number]` literal-union.
 */
export const MARKETPLACE_STATUSES = [
  "added",
  "removed",
  "updated",
  "failed",
  "autoupdate enabled",
  "autoupdate disabled",
  "skipped",
] as const;

/**
 * Runtime tuple of every dependency literal (SNM-06). 2 entries. Drives the
 * renderer's per-dependency soft-dep probe path (`requires pi-subagents` /
 * `requires pi-mcp` reason emission).
 *
 * Pattern: closed-set `as const` tuple + `(typeof X)[number]` literal-union.
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
 * (SNM-07). `autoupdate` is REQUIRED -- the persistence record
 * always knows whether autoupdate is enabled. `lastUpdatedAt?` is an
 * optional ISO timestamp whose shape mirrors
 * persistence/state-io.ts:70 (`lastUpdatedAt: Type.Optional(Type.String)`)
 * so list orchestrators can pass the record's value through unchanged.
 *
 * Intentionally minimal: no `source`, no `version`, no other entries (the
 * catalog rendering does not consume any).
 */
export interface MarketplaceDetails {
  readonly autoupdate: boolean;
  readonly lastUpdatedAt?: string;
}

/**
 * Usage-error payload consumed by the `notifyUsageError(ctx,
 * UsageErrorMessage)` entry point (SNM-08). Both fields REQUIRED; the
 * renderer composes the on-the-wire string as `${message}\n\n${usage}`
 * with a blank line between the message and the Usage block.
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
// `PluginNotificationMessage` union below. Every field `readonly`.
//
// Per-variant required/optional discipline:
//  - `reasons: readonly Reason[]` REQUIRED only on the 5 variants that emit a
//    `{<reason>}` brace -- unavailable, upgradable, skipped, failed, manual
//    recovery. The other 5 omit the field entirely so the compiler rejects
//    `(installed) {up-to-date}` shapes.
//  - `dependencies: readonly Dependency[]` REQUIRED only on
//    installed / updated / reinstalled (SNM-06). Other 7 variants omit.
//  - `version?: string` on all variants except `updated`, which carries
//    REQUIRED `from: string; to: string` instead (the `v1.0 → v1.2` arrow).
//  - SNM-11: `scope?: Scope` absent on `available` / `unavailable`
//    (carve-out: the list surface does not emit `[<scope>]` brackets for
//    those rows per MSG-PL-6).
//  - SNM-09: `rollbackPartial?` exists only on `failed`.
//  - SNM-10: `cause?: Error` exists only on `failed` / `manual recovery`.
// ---------------------------------------------------------------------------

/**
 * `(installed)` -- single-shot install or cascade install row. Carries
 * `dependencies` (SNM-06) so the renderer can emit the
 * `requires pi-subagents` / `requires pi-mcp` probe reasons; no `reasons`
 * because installed rows never emit a `{<reason>}` brace.
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
 *  so the renderer can compose the `v1.0 → v1.2` arrow form;
 * `dependencies` REQUIRED; no `reasons`.
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
 * ; no `reasons`.
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
 * `dependencies` (-- MSG-SD-3 forbids the soft-dep marker on
 * uninstalled rows); no `reasons`.
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
 * brackets on available rows); no `reasons`; no `dependencies`
 * .
 */
export interface PluginAvailableMessage {
  readonly status: "available";
  readonly name: string;
  readonly version?: string;
}

/**
 * `(unavailable)` -- list-surface row for plugins whose manifest exists
 * but cannot be installed under the current Pi environment (missing host
 * features). Carries REQUIRED `reasons`; NO `scope` (SNM-11);
 * no `dependencies`.
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
 * `reasons`; no `dependencies`.
 */
export interface PluginUpgradableMessage {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(present)` -- list-only inventory row emitted by
 * `list.ts::installedRowMessage`; never emitted by cascade-row code paths.
 * STRUCTURALLY constrained to the list surface so `shouldEmitReloadHint`
 * can distinguish steady-state inventory (no `/reload` trailer) from
 * actual state-changing transitions (with `/reload` trailer). Introduced
 * to close UAT gap G-21-01 (SNM-15 surface tightening): the four
 * state-change tokens (installed / updated / reinstalled / uninstalled)
 * unambiguously trigger the reload-hint, while `"present"` is deliberately
 * ABSENT from the trigger set.
 *
 * The structural shape mirrors `PluginInstalledMessage` exactly (dependencies
 * REQUIRED so the soft-dep marker injection still applies; version optional;
 * scope optional). The renderer arm for this discriminator is BYTE-IDENTICAL
 * to the `installed` arm -- the human-visible row text
 * `● <name> [<scope>] v<ver> (installed)` is preserved; only the trailing
 * `/reload to pick up changes` line that the inventory case was misfiring
 * is removed by virtue of the new discriminator.
 */
export interface PluginPresentMessage {
  readonly status: "present";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(failed)` -- failure row across single-shot and cascade surfaces.
 * Carries REQUIRED `reasons`; optional `cause?: Error` (SNM-10)
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
    // Free-form phase label sourced from transaction/phase-ledger.ts's
    // RollbackPartial.phase. The install path emits `phase3a` / `phase3b`
    // while the update path emits bridge names; the renderer only echoes the
    // label into the MSG-RP-1 child row, so the field stays `string`.
    readonly phase: string;
    readonly cause?: Error;
  }[];
}

/**
 * `(skipped)` -- per-plugin skip row inside cascades (e.g. update cascade
 * encountering an already-up-to-date plugin). Carries REQUIRED `reasons`
 * ; no `dependencies`; no `cause` (skipped is not a
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
 * SPACE. Carries REQUIRED `reasons` and optional `cause?: Error` (SNM-10); no
 * `dependencies`; no `rollbackPartial` (only `failed` carries it per SNM-09).
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
 * The renderer narrows via `switch (msg.status)` + `assertNever` for
 * exhaustiveness; downstream tests iterate `PLUGIN_STATUSES` to enumerate
 * the variants.
 *
 * Pattern: discriminated union over named per-variant interfaces.
 */
export type PluginNotificationMessage =
  | PluginInstalledMessage
  | PluginUpdatedMessage
  | PluginReinstalledMessage
  | PluginUninstalledMessage
  | PluginAvailableMessage
  | PluginUnavailableMessage
  | PluginUpgradableMessage
  | PluginPresentMessage
  | PluginFailedMessage
  | PluginSkippedMessage
  | PluginManualRecoveryMessage;

/**
 * Marketplace-level notification message (SNM-02). `status?`,
 * `details?`, and `reasons?` are independent optionals -- the renderer
 * narrows on `status` and consumes the others only where the relevant arm
 * needs them, but the type does not structurally constrain co-occurrence.
 *
 * `readonly reasons?: readonly Reason[]`: the `"skipped"` mp-status renderer
 * arm consumes this field to compose the `{<reason>, <reason>}` brace (e.g.,
 * `{already enabled}` for idempotent autoupdate flips); other mp-status
 * arms ignore the field, per the independent-optionals discipline (the type
 * does not structurally constrain co-occurrence with `status`).
 *
 * `plugins: readonly PluginNotificationMessage[]` is REQUIRED. An empty
 * array IS the structural representation of the `(no plugins)` rendering
 * on the list surface; on state-change paths an empty
 * `plugins` array is the normal case (renderer emits the marketplace
 * header alone). No separate `noPlugins` discriminator field.
 */
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;
  readonly details?: MarketplaceDetails;
  readonly reasons?: readonly Reason[];
  readonly plugins: readonly PluginNotificationMessage[];
}

/**
 * Top-level structured notification payload consumed by the
 * `notify(ctx, NotificationMessage)` entry point (SNM-01). The
 * `marketplaces` array is the only field -- severity is computed
 * structurally by the renderer's switch (never embedded as a field per
 * PRD §6.12 ES-2) and the trailer is composed by the renderer at
 * emission time.
 *
 * An empty `marketplaces: []` IS the structural representation of the
 * `(no marketplaces)` rendering on the `marketplace list` surface;
 * state-change paths always populate at least one marketplace. No top-level
 * `noMarketplaces` discriminator field.
 */
export interface NotificationMessage {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}

// ---------------------------------------------------------------------------
// Grammar rendering helpers -- file-private.
//
// SNM-17 / SNM-18 contract: the marketplace-header grammar and per-status
// icon discipline live HERE as the sole site that knows them.
// `renderMpHeader` + `renderPluginRow` compose into the public `notify`
// entry point.
// ---------------------------------------------------------------------------

/** Grammar icon literals. */
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";

/**
 * Renders the marketplace header line. SOLE site for marketplace-header
 * grammar (SNM-17). File-private; consumed by notify(). The
 * `case undefined:` arm explicitly guards mp.details === undefined, matching
 * the optional-independent details? field.
 *
 * Byte forms (one per arm):
 *   "added"              -> `${ICON_INSTALLED} ${name} [${scope}] (added)`
 *   "removed"            -> `${ICON_INSTALLED} ${name} [${scope}] (removed)`
 *   "updated"            -> `${ICON_INSTALLED} ${name} [${scope}] (updated)`
 *   "failed"             -> `${ICON_UNINSTALLABLE} ${name} [${scope}] (failed)`
 *   "autoupdate enabled" -> `${ICON_INSTALLED} ${name} [${scope}] (autoupdate enabled)`
 *                           (fresh state-flip; never carries mp.reasons.)
 *   "autoupdate disabled"-> `${ICON_INSTALLED} ${name} [${scope}] (autoupdate disabled)`
 *                           (fresh state-flip; never carries mp.reasons.)
 *   "skipped"            -> `${ICON_INSTALLED} ${name} [${scope}] (skipped)`
 *                           (+ ` {<reason>,...}` iff `mp.reasons` is defined
 *                           and non-empty, composed via `composeReasons` with
 *                           both soft-dep flags FALSE; mp-level skipped never
 *                           emits soft-dep markers.)
 *   undefined (list-surface):
 *     SUB-BRANCH A (mp.details === undefined): `${ICON_INSTALLED} ${name} [${scope}]`
 *     SUB-BRANCH B (mp.details !== undefined): `${ICON_INSTALLED} ${name} [${scope}]`
 *       + " <autoupdate>" iff mp.details.autoupdate === true (marker omitted
 *         entirely when autoupdate is false)
 *       The `mp.details.lastUpdatedAt` field is retained in state/type but is
 *       NOT rendered on the list surface (UXG-01 -- the raw ISO timestamp is
 *       noise and meaningless for path-source marketplaces).
 *
 * The icon arms use ICON_AVAILABLE nowhere -- marketplaces are either ok
 * (●) or failure-class (⊘); the open-circle ○ is reserved for available /
 * uninstalled PLUGIN rows that `renderPluginRow` owns.
 *
 * The `"skipped"` arm reuses the file-private `composeReasons` helper to
 * render the reasons brace, which requires the threaded `SoftDepStatus` probe
 * even though mp-level skipped passes BOTH declares-flags as `false`
 * (guarantees no soft-dep marker leaks onto mp-skipped rows). Every call site
 * in this file MUST pass the probe.
 */
function renderMpHeader(mp: MarketplaceNotificationMessage, probe: SoftDepStatus): string {
  switch (mp.status) {
    case "added":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (added)`;
    case "removed":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (removed)`;
    case "updated":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (updated)`;
    case "failed":
      return `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`;
    case "autoupdate enabled":
      //  + : fresh state-flip. Same shape as
      // "added"/"removed"/"updated"; does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (autoupdate enabled)`;
    case "autoupdate disabled":
      //  + : fresh state-flip. Same shape as
      // "added"/"removed"/"updated"; does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (autoupdate disabled)`;
    case "skipped": {
      //  + : idempotent autoupdate no-op. The
      // reasons brace is composed via composeReasons reusing the helper that
      // backs plugin-level skipped rows. CRITICAL : pass
      // (false, false) for the two soft-dep declares flags -- mp-level
      // skipped never emits {requires pi-subagents} / {requires pi-mcp}
      // markers; those are plugin-row-only. composeReasons returns "" when
      // mp.reasons is undefined or empty, so the conditional join collapses
      // cleanly with no trailing space.
      const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
      return reasonsBrace === ""
        ? `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (skipped)`
        : `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (skipped) ${reasonsBrace}`;
    }

    case undefined: {
      // List-surface case. mp.details is OPTIONAL and INDEPENDENT of mp.status
      // 's (shared/notify.ts:466). Guard explicitly with
      // an early return for SUB-BRANCH A (mp.details === undefined) so the
      // SUB-BRANCH B composition below reads narrowed (non-optional)
      // mp.details.autoupdate under TS strict.
      if (mp.details === undefined) {
        // SUB-BRANCH A: empty-list-surface -- bare header, no trailing tokens.
        return `${ICON_INSTALLED} ${mp.name} [${mp.scope}]`;
      }

      // SUB-BRANCH B: list-surface with details.
      // Compose tokens conditionally, then suppress empty slots so the join
      // never emits double-spaces: emit `<autoupdate>` iff
      // `autoupdate === true` (no `<no autoupdate>` counterpart -- absence of
      // the marker conveys autoupdate-off). `details.lastUpdatedAt` is
      // retained in state/type (UXG-01) but intentionally not rendered here.
      const autoupdateToken = mp.details.autoupdate ? "<autoupdate>" : "";
      return [ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken]
        .filter((t) => t !== "")
        .join(" ");
    }

    default: {
      assertNever(mp.status);
      return "";
    }
  }
}

// ---------------------------------------------------------------------------
// File-private renderPluginRow + supporting helpers.
//
// SNM-17 / SNM-18: the per-plugin row grammar lives HERE as the sole site.
// SNM-16: soft-dep markers are injected at render time from the per-row
// `dependencies?` declaration + the threaded `SoftDepStatus` probe. The
// switch ends with the hardened shape `default: { assertNever(p);
// return ""; }` so a future `PluginNotificationMessage` variant becomes a
// compile error at this switch (the typecheck relies on `assertNever`'s
// throw at runtime, not on its `never` return type via a value-returning
// expression).
// ---------------------------------------------------------------------------

/** Soft-dep marker literals -- both are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";

/**
 * Join tokens with single spaces, suppressing empty slots so absent
 * optional tokens (e.g. an undefined scope-bracket on `available` rows)
 * never produce a double-space. Single canonical implementation.
 */
function joinTokens(parts: readonly string[]): string {
  return parts.filter((p) => p !== "").join(" ");
}

/**
 * Anchored-exact predicate for a persisted PI-7 hash-version string. Matches
 * EXACTLY `hash-` + 12 lowercase-hex chars -- the shape produced by
 * `domain/version.ts::computeHashVersion` (`"hash-" + sha256.slice(0, 12)`).
 * Uppercase hex, wrong length, or a trailing/leading character are all
 * rejected so a malformed pseudo-hash is never silently rewritten into a
 * misleading short SHA (T-23-06; SNM-35).
 */
const HASH_VERSION_RE = /^hash-[0-9a-f]{12}$/;
function looksLikeHashVersion(v: string): boolean {
  return HASH_VERSION_RE.test(v);
}

/**
 * Render a persisted PI-7 hash-version to a compact git-style short SHA for
 * display: `hash-2ea95f85703d` -> `#2ea95f8` (the `hash-` prefix stripped, the
 * first 7 of the 12 hex chars kept, matching git `--short=7`). Returns WITHOUT
 * the `v` prefix -- the `v` is prepended downstream by `renderVersion` /
 * `composeVersionArrow`, producing the final `v#2ea95f8` byte form. A non-hash
 * string (e.g. a SemVer `1.0.0`) passes through UNCHANGED so SemVer rows still
 * render `v1.0.0`. Renderer-only: persistence stays `hash-<12hex>` (PI-7
 * intact, no migration; SC#3). SNM-35.
 */
function formatHashVersionForDisplay(v: string): string {
  if (!looksLikeHashVersion(v)) {
    return v;
  }

  return `#${v.slice("hash-".length, "hash-".length + 7)}`;
}

/**
 * Prepend `v` to the version string, returning `""` when `version` is
 * undefined or empty so the join discipline collapses the slot cleanly.
 * Routes the token through `formatHashVersionForDisplay` first so a persisted
 * PI-7 `hash-<12hex>` renders as `v#<7hex>` while a SemVer passes through to
 * `v<version>` (SNM-35). Single canonical implementation.
 */
function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${formatHashVersionForDisplay(version)}`;
}

/**
 * Conditional `[<pluginScope>]` emitter -- orphan-fold contract.
 * SOLE site for plugin-row scope-bracket emission inside
 * `renderPluginRow`: per-arm code MUST funnel `p.scope` (or `undefined` for
 * the MSG-PL-6 / SNM-11 carve-out variants) AND the parent marketplace scope
 * through this helper.
 *
 * The bracket emits ONLY when `pluginScope !== undefined AND
 * pluginScope !== mpScope` -- the orphan-fold case from. When the
 * plugin's scope matches the parent marketplace's scope, the bracket is
 * suppressed because the marketplace header already carries the
 * `[mpScope]` token; emitting a redundant per-row bracket would
 * contradict the binding contract at `docs/messaging-style-guide.md:73`
 * ("plugin row emits `[<scope>]` ONLY when its scope differs from the
 * parent marketplace's scope").
 *
 * `mpScope` is non-optional: the renderer always has the parent
 * marketplace's scope from `composeMarketplaceBlock` threading. The
 * `available` / `unavailable` arms (which have NO `scope?` field per
 * MSG-PL-6 / SNM-11) call with `pluginScope: undefined`; the same-scope
 * and orphan-fold short-circuits in the body cover both that carve-out
 * and the same-scope case uniformly.
 */
function renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string {
  if (pluginScope === undefined || pluginScope === mpScope) {
    return "";
  }

  return `[${pluginScope}]`;
}

/**
 * Compose the MSG-PL-3 version-transition slot for the `updated` arm
 * (`<from> → v<to>`). Caller precondition: both
 * `from` and `to` are REQUIRED on the `updated` variant, so the helper
 * is only ever invoked with both values defined. Sole caller is the
 * `updated` arm in renderPluginRow.
 *
 * Both sides route through `formatHashVersionForDisplay`, preserving the
 * asymmetric `v` prefix (bare `from`, `v`-prefixed `to` per
 * `docs/output-catalog.md`): two hashes render `#<7hex> → v#<7hex>`
 * (e.g. `#2ea95f8 → v#1c3d9a0`) while SemVer pairs stay `<from> → v<to>`
 * (SNM-35).
 */
function composeVersionArrow(from: string, to: string): string {
  return `${formatHashVersionForDisplay(from)} → v${formatHashVersionForDisplay(to)}`;
}

/**
 * Compose the MSG-GR-4 reasons-block, injecting soft-dep markers from
 * the per-row `dependencies?` declaration + the threaded probe.
 *
 *  - Starts from the caller-provided `reasons` array (or `[]` when the
 *  variant lacks a reasons field).
 *  - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *  - Appends `SOFT_DEP_MARKER_MCP` iff `declaresMcp && !probe.piMcpAdapterLoaded`.
 *  - Returns `""` when the composed array is empty (MSG-GR-4 forbids `{}`).
 *  - Otherwise returns `{<r1>, <r2>,...}`.
 *
 * Single canonical implementation.
 *
 * The reasons array is the closed `Reason` set end-to-end: every switch arm
 * passes either `p.reasons` (a `readonly Reason[]`) or `undefined`, and the
 * appended soft-dep markers are themselves `Reason` members. Typing the
 * parameter and accumulator as `Reason` rejects out-of-set strings at the
 * call sites at compile time (CMC-11 closed-set discipline).
 */
function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string {
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];

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
 * Renders the plugin row (no leading indent -- caller adds it). SOLE
 * site for plugin-row grammar (SNM-17). assertNever default arm is the
 * compile-time exhaustiveness gate.
 *
 * Token order follows the grammar `icon name [scope] versionToken
 * (status) {reasons}` (MSG-GR-1). Scope bracket is emitted via the
 * orphan-fold contract: the 8 scope-bearing arms
 * pass `(p.scope, mpScope)` to `renderScopeBracket`, which emits the
 * bracket ONLY when `p.scope !== undefined AND p.scope !== mpScope`. The
 * `available` / `unavailable` arms unconditionally omit the bracket per
 * MSG-PL-6 / SNM-11 by passing `(undefined, mpScope)`.
 *
 * `mpScope` is threaded from `composeMarketplaceBlock` -> `composePluginLines`
 * -> here so every per-arm bracket call has the parent marketplace's scope
 * available.
 *
 * Soft-dep marker injection: only the `installed` / `updated` /
 * `reinstalled` arms carry `dependencies`; those arms
 * pass `p.dependencies.includes("agents")` / `p.dependencies.includes("mcp")`
 * to `composeReasons`. The other 7 arms pass `false` for both
 * declares-flags so the soft-dep markers cannot leak onto rows that
 * structurally never declare a soft dep.
 *
 * Per-variant `composeReasons` first argument:
 *  - 5 reasons-less variants (installed, updated, reinstalled,
 *  uninstalled, available) pass `undefined`;
 *  - 5 reasons-bearing variants (unavailable, upgradable, skipped,
 *  failed, manual recovery) pass `p.reasons`.
 *
 * NOT rendered here ('s `notify` composes them as additional
 * indented lines AFTER the row):
 *  - `failed.cause` / `manual recovery.cause` cause-chain trailers.
 *  - `failed.rollbackPartial[]` child rows.
 */
function renderPluginRow(
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  switch (p.status) {
    // `present` (UAT G-21-01) is a list-only inventory row that renders
    // byte-identically to `installed`; it stays a distinct status so
    // shouldEmitReloadHint suppresses the /reload trailer for inventory rows.
    case "installed":
    case "present":
      return joinTokens([
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
      ]);
    case "updated":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
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
        renderScopeBracket(p.scope, mpScope),
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
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(uninstalled)",
        composeReasons(undefined, false, false, probe),
      ]);
    case "available":
      return joinTokens([
        ICON_AVAILABLE,
        p.name,
        // MSG-PL-6 / SNM-11 carve-out: `available` has NO `scope?` field.
        renderScopeBracket(undefined, mpScope),
        renderVersion(p.version),
        "(available)",
        composeReasons(undefined, false, false, probe),
      ]);
    case "unavailable":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        // MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field.
        renderScopeBracket(undefined, mpScope),
        renderVersion(p.version),
        "(unavailable)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "upgradable":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(upgradable)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "skipped":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(skipped)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "failed":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(failed)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "manual recovery":
      return joinTokens([
        ICON_UNINSTALLABLE,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        // `manual recovery` discriminator preserved verbatim WITH A SPACE
        // (historical convention).
        "(manual recovery)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    default: {
      assertNever(p);
      return "";
    }
  }
}

// ---------------------------------------------------------------------------
// Public notify() entry point + file-private helpers.
//
// Grammar mini-spec (documented in docs/output-catalog.md per SNM-19 /
// SNM-20). The wire format `notify` emits is:
//
//   <mp-header-1>
//     <plugin-row-1>
//       [cause-chain at 4-space indent if (failed | manual recovery) with cause]
//       [rollback child row at 4-space indent for each rollbackPartial phase]
//       [phase cause-chain at 6-space indent if phase.cause set]
//     <plugin-row-2>
//     ...
//
//   <mp-header-2>
//   ...
//
//   /reload to pick up changes  <-- iff any state-changing status set
//
// Joins / separators:
//   - Plugin row prefix:                "  " (2 spaces)
//   - Cause-chain trailer prefix:       "    " (4 spaces)
//   - rollbackPartial child row prefix: "    " (4 spaces)
//   - rollbackPartial phase cause:      "      " (6 spaces)
//   - Between marketplace blocks:       "\n\n" (one blank line)
//   - Between body and reload-hint:     "\n\n" (one blank line)
//
// Severity ladder (first match wins):
//   1. Any plugin.status === "failed" OR mp.status === "failed" -> "error"
//   2. Any plugin.status in {"skipped", "manual recovery"} -> "warning"
//   3. Otherwise -> undefined (info)
//
// Reload-hint trigger (SNM-33):
//   - Any plugin.status in {"installed", "updated", "reinstalled", "uninstalled"}.
//   - No marketplace-status arm: marketplace records are bookkeeping, not Pi-visible.
//
// Empty-marketplaces sentinel: "(no marketplaces)".
//
// Soft-dep probe discipline: single softDepStatus(pi) call at notify entry;
// the resulting SoftDepStatus is threaded into every renderPluginRow(p,
// probe) invocation. No per-row re-probing.
//
// D-11 layering: notify lives entirely in `shared/`; the reload-hint trailer
// literal sits alongside the renderMpHeader / renderPluginRow grammar
// literals.
// ---------------------------------------------------------------------------

/** Reload-hint trailer literal. */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

/** Severity ladder per SNM-14. First-match: failed (plugin or marketplace) wins over skipped / manual recovery OR marketplace skipped, wins over success. */
function computeSeverity(message: NotificationMessage): "warning" | "error" | undefined {
  // First-match pass: any failed (plugin or marketplace) -> "error".
  const hasError = message.marketplaces.some(
    (mp) => mp.status === "failed" || mp.plugins.some((p) => p.status === "failed"),
  );
  if (hasError) {
    return "error";
  }

  // Second-match pass: any skipped or manual recovery -> "warning". mp-level
  // "skipped" (idempotent autoupdate flip) routes to warning, consistent with
  // plugin-level "skipped". The mp.status === "skipped" check on the outer
  // .some ensures an empty plugins array still triggers the warning route.
  const hasWarning = message.marketplaces.some(
    (mp) =>
      mp.status === "skipped" ||
      mp.plugins.some((p) => p.status === "skipped" || p.status === "manual recovery"),
  );
  if (hasWarning) {
    return "warning";
  }

  // Otherwise success (omit 2nd arg).
  return undefined;
}

/**
 * Reload-hint trigger per SNM-33. The trailer is reserved for
 * operations that actually change a Pi-visible resource. The ONLY Pi-visible
 * resources are plugin rows (skill / agent / command / MCP entry); marketplace
 * records are bookkeeping, not resources, so they never warrant a `/reload`.
 *
 * The rule is therefore plugin-row-driven only: emit iff some marketplace
 * carries a plugin row whose status is one of the four state-change tokens
 * `installed | updated | reinstalled | uninstalled`. No marketplace-status arm
 * remains -- every marketplace status (added / removed / updated / autoupdate
 * enabled / autoupdate disabled / skipped / failed) now NEVER triggers on its
 * own. This mirrors the G-21-01 invariant: every status
 * discriminator either always triggers the reload-hint or never does -- no
 * token straddles inventory vs transition, so the predicate is unambiguous.
 *
 * : this supersedes the reload-trigger half of -- fresh-flip
 * autoupdate enabled/disabled no longer emit the trailer (the flip changes a
 * marketplace record, not a Pi-visible resource). The `skipped -> warning`
 * severity route (computeSeverity) is unaffected: severity and
 * reload-hint are independent ladders.
 *
 * Clean `marketplace remove` carries one `PluginUninstalledMessage` row per
 * unstaged plugin, so a non-empty remove still emits the trailer via
 * the `uninstalled` token while an empty remove (header-only) does not.
 */
function shouldEmitReloadHint(message: NotificationMessage): boolean {
  for (const mp of message.marketplaces) {
    for (const p of mp.plugins) {
      if (
        p.status === "installed" ||
        p.status === "updated" ||
        p.status === "reinstalled" ||
        p.status === "uninstalled"
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * : render the depth-5 cause-chain trailer at the requested space-indent
 * prefix when `cause` is defined and the walker returns a non-empty string.
 * Returns `""` otherwise so callers can `if (trailer !== "") lines.push(...)`.
 * Centralizes the "guard + walker + indent" composition reused for both the
 * per-plugin cause (`indent = " "`, 4 spaces) and the per-rollback-phase
 * cause (`indent = " "`, 6 spaces).
 */
function renderIndentedCauseChain(cause: unknown, indent: string): string {
  if (cause === undefined) {
    return "";
  }

  const trailer = causeChainTrailer(cause);
  return trailer === "" ? "" : `${indent}${trailer}`;
}

/**
 * : render the rollbackPartial child rows for a failed-variant plugin.
 * Each phase emits a 4-space-indented row plus an optional 6-space-indented
 * cause-chain trailer when `phase.cause` is set. Returns an empty array when
 * the plugin has no `rollbackPartial`, so callers can spread the result
 * unconditionally.
 */
function composeRollbackPartialLines(p: PluginNotificationMessage): string[] {
  if (p.status !== "failed" || p.rollbackPartial === undefined) {
    return [];
  }

  const lines: string[] = [];
  for (const phase of p.rollbackPartial) {
    lines.push(`    [${phase.phase}] (rollback failed)`);
    const phaseTrailer = renderIndentedCauseChain(phase.cause, "      ");
    if (phaseTrailer !== "") {
      lines.push(phaseTrailer);
    }
  }

  return lines;
}

/**
 * AS-7: walk the cause chain (depth-bounded, mirroring causeChainTrailer)
 * and collect the leaked file paths from the first ManualRecoveryError that
 * carries any. The bridges produce the leak set as STRUCTURED data on
 * `ManualRecoveryError.leaks`; this surfaces it on the rendered manual-recovery
 * row so the user is told which files to clean up by hand. Returns an empty
 * array when no ManualRecoveryError with leaks is in the chain.
 */
function collectManualRecoveryLeaks(cause: unknown): readonly string[] {
  const MAX_DEPTH = 5;
  let current: unknown = cause;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (current instanceof ManualRecoveryError && current.leaks.length > 0) {
      return current.leaks;
    }

    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
    } else {
      break;
    }
  }

  return [];
}

/**
 * Compose the multi-line block for a single plugin row: the 2-space-indented
 * plugin row, the optional 4-space-indented cause-chain trailer, the AS-7
 * leaked-paths child rows when the cause is a ManualRecoveryError, and any
 * rollbackPartial child rows + nested phase-cause trailers. The caller pushes
 * these lines into the marketplace block's accumulator in order.
 */
function composePluginLines(
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string[] {
  const lines: string[] = [`  ${renderPluginRow(p, probe, mpScope)}`];

  if (p.status === "failed" || p.status === "manual recovery") {
    const trailer = renderIndentedCauseChain(p.cause, "    ");
    if (trailer !== "") {
      lines.push(trailer);
    }

    // AS-7: name the leaked files the user must clean up by hand.
    for (const leak of collectManualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
  }

  lines.push(...composeRollbackPartialLines(p));
  return lines;
}

/**
 * Compose the single-marketplace block: header line followed by one composed
 * plugin block per `mp.plugins[]` entry, in caller order. Joined
 * with `\n` to produce the block string that `notify` then joins with
 * `\n\n` between marketplaces.
 */
function composeMarketplaceBlock(mp: MarketplaceNotificationMessage, probe: SoftDepStatus): string {
  //  : pass the threaded soft-dep probe into renderMpHeader
  // so the new "skipped" arm can reuse composeReasons. The mp-skipped arm
  // passes (false, false) for the two declares-flags; no
  // soft-dep marker can leak onto an mp-level row.
  const lines: string[] = [renderMpHeader(mp, probe)];
  for (const p of mp.plugins) {
    lines.push(...composePluginLines(p, probe, mp.scope));
  }

  return lines.join("\n");
}

/**
 * Structured-notification entry point. Sole public surface for state-change
 * notifications (SNM-12). Severity, reload-hint, and soft-dep probe are
 * computed from contents at notify time (SNM-14, SNM-15, SNM-16).
 */
export function notify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: NotificationMessage,
): void {
  // Single soft-dep probe per invocation; threaded into every renderPluginRow
  // call inside composePluginLines below.
  const probe = softDepStatus(pi);

  // Caller-supplied order honored end-to-end (no internal sort). An empty
  // top-level marketplaces array renders the "(no marketplaces)" sentinel
  // rather than the empty string; one blank line between marketplace blocks.
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  // Compute reload-hint per the state-change trigger ladder and append it with
  // one blank line.
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withHint = hint === "" ? body : `${body}\n\n${hint}`;

  // Severity dispatch via the Pi API's magic-string second-arg convention:
  // omitting the 2nd arg is info severity; "warning" / "error" otherwise.
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(withHint);
  } else {
    ctx.ui.notify(withHint, severity);
  }
}

// ---------------------------------------------------------------------------
// MSG-GR-3 single per-scope sort comparator.
//
// Per the messaging style guide (Per-Scope Rendering) the canonical row order
// across every list-rendering surface (marketplace list, plugin list, plugin
// folding, cascade summaries) is:
//  1. name primary, case-insensitive (`localeCompare` with
//  `sensitivity: 'base'`)
//  2. scope secondary as a tie-breaker -- project before user
//
// SINGLE source of that policy. Every list-rendering surface (mp list,
// plugin list, import / update / reinstall cascades) consumes this helper
// directly.
//
// MSG-GR-3 lock notes:
//  - The comparator accepts a STRUCTURAL minimum
//  `{ readonly name: string; readonly scope: "user" | "project" }`
//  so it can sort any row type that carries these two fields without
//  requiring an adapter.
//  - `sensitivity: 'base'` treats "Alpha", "alpha", and "ALPHA" as
//  equal -- accent differences are folded as well (matching the
//  style guide's "case-insensitive" wording, which under the JS spec
//  maps to base sensitivity).
//  - The scope tie-breaker uses a strict ternary -- mapping project to
//  -1 and user to +1 -- so the canonical "project before user"
//  ordering holds for every same-name pair. When
//  `a.scope === b.scope` the result is 0, leaving
//  Array.prototype.sort's stability guarantee to preserve
//  caller-side ordering.
//  - The comparator never throws.
// ---------------------------------------------------------------------------

export interface Sortable {
  readonly name: string;
  readonly scope: "user" | "project";
}

export function compareByNameThenScope(a: Sortable, b: Sortable): number {
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }

  // Tie-breaker: project before user per MSG-GR-3.
  if (a.scope === b.scope) {
    return 0;
  }

  return a.scope === "project" ? -1 : 1;
}
