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
 * idempotent rows (`"already autoupdate"` / `"already no autoupdate"`) and the
 * failure-class closed Reasons the catalog UAT requires across uninstall /
 * marketplace-remove partial / reinstall / update / marketplace-update rows
 * (`"permission denied"` / `"source missing"` / `"network unreachable"`).
 *
 * Phase 42 / INFO-04 / INFO-08: added `"not added"` as the 29th entry to
 * carry the `--scope` mismatch failure surface on the new info-message
 * variants (`MarketplaceInfoMessage` / `PluginInfoMessage`). A request for a
 * scope where the target marketplace is not present renders
 * `⊘ <name> [<scope>] (failed) {not added}` at column 0 with severity
 * `"error"`. The atomic-supersession commit (v1.3 retrospective lesson per
 * `c4d87d4` / `dbd149a`) lands the tuple extension together with the new
 * variant types, the renderer arms, the first catalog state, and the
 * matching UAT fixture in ONE commit.
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
  "already autoupdate",
  "already no autoupdate",
  "permission denied",
  "source missing",
  "network unreachable",
  "not added",
] as const;

export type Reason = (typeof REASONS)[number];

/**
 * Phase 28 / UXG-02 (D-28-02): the closed set of `Reason` members that mark a
 * `skipped` row as a BENIGN idempotent no-op -- the resource already matches
 * the exact state the command requested (D-28-01 classification principle).
 * A `skipped` cascade whose reasons are ALL drawn from this set routes the
 * notification to `info` (no 2nd `ctx.ui.notify` arg) via `computeSeverity`;
 * any non-benign reason (or a missing/empty reason set on an mp-level skip)
 * routes to `warning`. These four are the idempotent "already in requested
 * state" reasons; `already autoupdate` / `already no autoupdate` are the
 * Phase-27/UXG-04-renamed forms of the requirement text's stale
 * `already enabled` / `already disabled`.
 */
const BENIGN_REASONS: ReadonlySet<Reason> = new Set([
  "up-to-date",
  "already installed",
  "already autoupdate",
  "already no autoupdate",
]);

/**
 * Phase 28 / UXG-02 (D-28-06): a skip's reasons are "all benign" iff the set
 * is NON-EMPTY and every member is in `BENIGN_REASONS`. An empty array returns
 * `false` -- a no-reason skip cannot be PROVEN benign, so it routes to
 * `warning` (the D-28-08 safe default for an mp-level `skipped` whose optional
 * `reasons?` is missing/empty). Shared by the plugin-skip and mp-skip arms.
 */
function allBenign(reasons: readonly Reason[] | undefined): boolean {
  return reasons !== undefined && reasons.length > 0 && reasons.every((r) => BENIGN_REASONS.has(r));
}

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
 * . PL-4: optional `description` rendered as a second
 * 4-space-indented line, truncated at column 66.
 */
export interface PluginAvailableMessage {
  readonly status: "available";
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
}

/**
 * `(unavailable)` -- list-surface row for plugins whose manifest exists
 * but cannot be installed under the current Pi environment (missing host
 * features). Carries REQUIRED `reasons`; NO `scope` (SNM-11);
 * no `dependencies`. PL-4: optional `description` rendered as a second
 * 4-space-indented line, truncated at column 66.
 */
export interface PluginUnavailableMessage {
  readonly status: "unavailable";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly description?: string;
}

/**
 * `(upgradable)` -- list-surface row for installed plugins with a newer
 * version available upstream. STRUCTURALLY constrained to the list surface
 * per MSG-PL-4 / CMC-09 (never emitted on cascade rows). Carries REQUIRED
 * `reasons`; no `dependencies`. PL-4: optional `description` rendered as
 * a second 4-space-indented line, truncated at column 66.
 */
export interface PluginUpgradableMessage {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly Reason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
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
 * is removed by virtue of the new discriminator. PL-4: optional `description`
 * rendered as a second 4-space-indented line, truncated at column 66.
 */
export interface PluginPresentMessage {
  readonly status: "present";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
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
 * `{already autoupdate}` for idempotent autoupdate flips); other mp-status
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
 * Cascade-arm of the top-level discriminated `NotificationMessage` union
 * (SNM-01). The `marketplaces` array is the only structural field --
 * severity is computed structurally by the renderer's switch (never
 * embedded as a field per PRD §6.12 ES-2) and the trailer is composed by
 * the renderer at emission time.
 *
 * An empty `marketplaces: []` IS the structural representation of the
 * `(no marketplaces)` rendering on the `marketplace list` surface;
 * state-change paths always populate at least one marketplace. No top-level
 * `noMarketplaces` discriminator field.
 *
 * Phase 42 / RESEARCH Migration Strategy #2: `kind?` is OPTIONAL on the
 * cascade variant so every v1.0-v1.7 call site (90+ orchestrator / test /
 * fixture sites that construct `{ marketplaces: [...] }`) continues to
 * type-check without migration. The `notify()` dispatcher narrows via
 * `message.kind ?? "cascade"` so the absence of `kind` routes through the
 * cascade arm unambiguously. The two new info-surface variants
 * (`MarketplaceInfoMessage`, `PluginInfoMessage`) carry a REQUIRED `kind`
 * literal so they cannot be confused with a cascade payload at construction
 * time.
 */
export interface CascadeNotificationMessage {
  readonly kind?: "cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}

/**
 * Phase 42 / INFO-01 / INFO-04: top-level info-surface variant emitted by
 * the (Phase 43) `/claude:plugin marketplace info <name>` command. Carries
 * the marketplace identifier (`name`, `scope`), the persisted
 * `MarketplaceDetails` for the `<autoupdate>` / `<no autoupdate>` marker
 * AND for the `last_updated:` ISO8601 line (read from
 * `details.lastUpdatedAt` -- single source of truth; Phase 42 / WR-04
 * removed a parallel top-level `lastUpdated?` field that duplicated the
 * same datum), the source-kind detail (`github: <owner>/<repo>[#<ref>]`
 * vs `path: <abs-path>`), and optional `description` (marketplace.json
 * description, optional) line. The `last_updated:` line renders only on
 * the github-source arm (INFO-01).
 *
 * Phase 42's only catalog state under this variant is the INFO-04 `{not
 * added}` `--scope` mismatch row (which is emitted via the sibling
 * `PluginInfoMessage` per INFO-04's byte form -- see that interface). The
 * Phase 43 catalog will exercise the github + path +
 * details.lastUpdatedAt + description rendering paths.
 */
export interface MarketplaceInfoMessage {
  readonly kind: "marketplace-info";
  readonly name: string;
  readonly scope: Scope;
  readonly details: MarketplaceDetails;
  readonly source:
    | {
        readonly sourceKind: "github";
        readonly owner: string;
        readonly repo: string;
        readonly ref?: string;
      }
    | { readonly sourceKind: "path"; readonly absPath: string };
  readonly description?: string;
}

/**
 * Top-level info-surface variant emitted by `/claude:plugin info
 * <plugin>@<marketplace>`. Carries the parent marketplace identifier
 * so the renderer can compose the always-marketplace-header form
 * (mirrors the install cascade shape), and a `PluginInfoRow` whose
 * `componentsResolved` discriminator chooses between resolved-components
 * (per-kind sorted arrays + optional dependencies) and the
 * `components: not resolved` marker (external sources cannot be
 * resolved without fetching, which would violate NFR-5).
 *
 * `{not added}` carve-out: a `--scope` mismatch row is constructed
 * with `status: "failed"`, `name: <marketplace-name>`,
 * `reasons: ["not added"]`, `componentsResolved: false`. The renderer
 * emits the bare `⊘ <name> [<scope>] (failed) {not added}` row at
 * column 0 with severity `"error"` and NO marketplace header (the row
 * IS the message). See `renderPluginInfo`.
 */
export interface PluginInfoMessage {
  readonly kind: "plugin-info";
  readonly marketplaceName: string;
  readonly marketplaceScope: Scope;
  readonly marketplaceDetails: MarketplaceDetails;
  readonly plugin: PluginInfoRow;
}

/**
 * Per-plugin row carried by `PluginInfoMessage`. Discriminated on
 * `componentsResolved: true | false` so the renderer's switch is
 * exhaustive via `assertNever`. The resolved arm carries per-kind
 * component arrays + optional `dependencies`; the unresolved arm
 * carries no component data and triggers the
 * `components: not resolved` marker.
 */
export type PluginInfoRow =
  | (PluginInfoRowBase & PluginInfoComponentsResolved)
  | (PluginInfoRowBase & PluginInfoComponentsUnresolved);

/**
 * Shared base for both `PluginInfoRow` arms.
 *
 * `status: "installed" | "available" | "unavailable" | "failed"` is
 * the 4-member closed set used on the info surface. The literal-union
 * is inlined here rather than added to `PLUGIN_STATUSES` because info
 * messages are a SIBLING concept to cascades and must not contaminate
 * the cascade closed set.
 *
 * `reasons?: readonly Reason[]` is populated when `status` is
 * `"unavailable"` or `"failed"` (e.g., `["not added"]` for the
 * `--scope` mismatch row, `["not in manifest"]` for an unknown plugin).
 */
interface PluginInfoRowBase {
  readonly status: "installed" | "available" | "unavailable" | "failed";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly Reason[];
}

/**
 * `componentsResolved: true` arm. The renderer emits per-kind component
 * lists in alphabetical order (`agents`, `commands`, `mcp`, `skills`)
 * followed by an optional `dependencies:` line in
 * `<plugin>@<marketplace>` form.
 *
 * PRECONDITION: per-kind arrays and the `dependencies` array MUST be
 * pre-sorted alphabetically at construction time. The renderer assumes
 * sorted input and does NOT sort defensively -- defensive sorting
 * would mask caller contract violations.
 */
interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];
}

/**
 * `componentsResolved: false` arm. The renderer emits the single
 * marker line `    components: not resolved` instead of per-kind
 * component lists. The marker is a structural signal that the
 * plugin's `plugin.json` lives at an unsynced external source and the
 * orchestrator deliberately does NOT fetch it (preserves NFR-5).
 */
interface PluginInfoComponentsUnresolved {
  readonly componentsResolved: false;
}

/**
 * Fan-out wrapper used by `getMarketplaceInfo` when no `--scope` is
 * given and the requested marketplace name exists in BOTH scopes.
 * `renderMarketplaceInfoCascade` joins per-block bodies with `\n\n`.
 * Iteration order is the orchestrator's responsibility (project-first
 * per MSG-GR-3). Reload-hint NEVER fires; severity is always info (no
 * failure can be expressed on a fan-out payload -- the orchestrator
 * routes the `{not added}` failure surface through the sibling
 * `PluginInfoMessage` variant).
 *
 * The `blocks` tuple is non-empty (`readonly [T, ...T[]]`) so an empty
 * fan-out is a compile-time error rather than a documented "renderer
 * keeps it deterministic" carve-out.
 */
export interface MarketplaceInfoCascadeMessage {
  readonly kind: "marketplace-info-cascade";
  readonly blocks: readonly [MarketplaceInfoMessage, ...MarketplaceInfoMessage[]];
}

/**
 * Fan-out wrapper used by `getPluginInfo` when no `--scope` is given
 * and the requested plugin+marketplace pair exists in BOTH scopes.
 * `renderPluginInfoCascade` joins per-block bodies with `\n\n`.
 * Iteration order is the orchestrator's responsibility (project-first
 * per MSG-GR-3). Reload-hint NEVER fires; severity is always info.
 *
 * The `blocks` tuple is non-empty (`readonly [T, ...T[]]`) so an empty
 * fan-out is a compile-time error.
 */
export interface PluginInfoCascadeMessage {
  readonly kind: "plugin-info-cascade";
  readonly blocks: readonly [PluginInfoMessage, ...PluginInfoMessage[]];
}

/**
 * Top-level discriminated-union envelope consumed by `notify(ctx, pi,
 * NotificationMessage)`. The cascade arm omits `kind` (or sets it to
 * `"cascade"`) for back-compat with v1.0-v1.7 call sites; the four
 * info-surface arms set `kind` explicitly. The dispatcher narrows
 * with an `assertNever` default arm so every future variant addition
 * becomes a compile-time error at the switch.
 */
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage
  | MarketplaceInfoCascadeMessage
  | PluginInfoCascadeMessage;

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
 * PL-4 column-66 description truncation. Strings longer than 66 chars are
 * sliced to 63 chars and suffixed with `"..."`, landing exactly at column 66.
 * The column limit applies to the description TEXT; the 4-space indent prefix
 * is NOT counted. File-private; only used in `composePluginLines`.
 */
const DESCRIPTION_MAX_COLS = 66;
function truncateDescription(s: string): string {
  if (s.length <= DESCRIPTION_MAX_COLS) {
    return s;
  }

  return s.slice(0, DESCRIPTION_MAX_COLS - 3) + "...";
}

/**
 * Phase 42 / INFO-02 hard-wrap helper. Splits `text` on whitespace
 * (`/\s+/`), filters empty tokens, greedy-accumulates words into lines
 * whose TEXT length (not counting the indent) does not exceed `wrapCol`,
 * then prepends `indentCol` spaces to each emitted line. Returns an array
 * of indented lines so the caller composes the final body via `.join("\n")`.
 *
 * Edge cases:
 *  - Empty / whitespace-only text -> `[]` (caller skips the wrap block).
 *  - A single token longer than `wrapCol` -> emitted on its own line at
 *    `indentCol`; the line WILL exceed `wrapCol`. No truncation, no
 *    ellipsis per INFO-02 ("no ellipsis"). Hard-wrap is greedy-by-word.
 *  - Whitespace tokenization collapses leading / trailing / repeated
 *    whitespace (newlines, tabs, multi-space) into single-space
 *    separators, which also serves as basic display normalization for
 *    user-supplied descriptions (T-42-01 mitigation).
 *
 * RESEARCH Pitfall 4: `wrapCol` is the TEXT width, NOT the total line
 * width. Mirrors the existing `DESCRIPTION_MAX_COLS = 66` / 4-space-indent
 * convention used by `truncateDescription` (INFO-02 catalog spec: col 4
 * indent / 66-col text width).
 *
 * File-private; sole caller is `renderPluginInfo` (Phase 42). Do NOT
 * export -- RESEARCH Anti-Pattern: exporting would let other modules drift
 * from the catalog byte contract.
 */
function wrapDescription(text: string, indentCol: number, wrapCol: number): string[] {
  const words = text.split(/\s+/).filter((w) => w !== "");
  if (words.length === 0) {
    return [];
  }

  const indent = " ".repeat(indentCol);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current === "") {
      current = word;
      continue;
    }

    // +1 for the single space between `current` and `word`.
    if (current.length + 1 + word.length <= wrapCol) {
      current = `${current} ${word}`;
    } else {
      lines.push(`${indent}${current}`);
      current = word;
    }
  }

  if (current !== "") {
    lines.push(`${indent}${current}`);
  }

  return lines;
}

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
 *   "autoupdate enabled" -> `${ICON_INSTALLED} ${name} [${scope}] <autoupdate>`
 *                           (UXG-04 fresh state-flip; marker-as-outcome,
 *                           never carries mp.reasons.)
 *   "autoupdate disabled"-> `${ICON_INSTALLED} ${name} [${scope}] <no autoupdate>`
 *                           (UXG-04 fresh state-flip; explicit off-marker,
 *                           never carries mp.reasons.)
 *   "skipped"            -> `${ICON_INSTALLED} ${name} [${scope}] (skipped)`
 *                           (+ ` {<reason>,...}` iff `mp.reasons` is defined
 *                           and non-empty, composed via `composeReasons` with
 *                           both soft-dep flags FALSE; mp-level skipped never
 *                           emits soft-dep markers.) UXG-04 SPECIAL CASE: when
 *                           `mp.reasons` contains `"already autoupdate"` /
 *                           `"already no autoupdate"` the row renders
 *                           `... <autoupdate> {already autoupdate}` /
 *                           `... <no autoupdate> {already no autoupdate}`
 *                           (marker-as-outcome + idempotence brace, no
 *                           `(skipped)` token).
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
      // UXG-04: fresh autoupdate-on flip renders the `<autoupdate>` marker as
      // the outcome (byte-form parity with the `marketplace list` surface),
      // superseding the Phase 17.1 / D-18-05 `(autoupdate enabled)` status
      // token. The `autoupdate enabled` discriminator STAYS (Strategy B); only
      // the emitted bytes change. Does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate>`;
    case "autoupdate disabled":
      // UXG-04: fresh autoupdate-off flip renders the explicit `<no autoupdate>`
      // off-marker (`<no autoupdate>` is already a MARKERS member; only its
      // emission on the flip surface is new), superseding `(autoupdate
      // disabled)`. Discriminator STAYS (Strategy B). Does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate>`;
    case "skipped": {
      // The "skipped" arm is SHARED across mp-level skips (UXG-05's
      // `(skipped) {up-to-date}`, the idempotent autoupdate no-ops, etc.). The
      // reasons brace is composed via composeReasons reusing the helper that
      // backs plugin-level skipped rows. CRITICAL: pass (false, false) for the
      // two soft-dep declares flags -- mp-level skipped never emits
      // {requires pi-subagents} / {requires pi-mcp} markers; those are
      // plugin-row-only. composeReasons returns "" when mp.reasons is undefined
      // or empty, so the conditional join collapses cleanly with no trailing
      // space.
      const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
      // UXG-04: idempotent autoupdate flips render the marker as the outcome
      // (no `(skipped)` token -- the marker conveys the state, the brace
      // conveys idempotence) for byte-form parity with the fresh-flip + list
      // surfaces. Branch ONLY on the autoupdate-idempotent reasons; every other
      // skipped reason keeps the existing `(skipped) {<reason>}` byte form.
      if (mp.reasons?.includes("already autoupdate")) {
        return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate> ${reasonsBrace}`;
      }

      if (mp.reasons?.includes("already no autoupdate")) {
        return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate> ${reasonsBrace}`;
      }

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
 * (`v<from> → v<to>`). Caller precondition: both
 * `from` and `to` are REQUIRED on the `updated` variant, so the helper
 * is only ever invoked with both values defined. Sole caller is the
 * `updated` arm in renderPluginRow.
 *
 * Both sides route through `renderVersion` so both carry the `v` prefix:
 * SemVer pairs render `v<from> → v<to>` (e.g. `v1.0.0 → v1.1.0`) and
 * hash pairs render `v#<7hex> → v#<7hex>` (e.g. `v#2ea95f8 → v#1c3d9a0`,
 * SNM-35).
 */
function composeVersionArrow(from: string, to: string): string {
  return `${renderVersion(from)} → ${renderVersion(to)}`;
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

/**
 * Severity ladder per SNM-14, refined by Phase 28 / UXG-02
 * (D-28-06/07/08/09). A first-match ladder with FIVE arms, in this order:
 *
 *   1. any `plugin.status === "failed"` OR `mp.status === "failed"` -> "error"
 *   2. any `plugin.status === "manual recovery"`                    -> "warning"
 *      (always actionable -- a manual-recovery anchor is never benign)
 *   3. any `plugin.status === "skipped"` whose REQUIRED `reasons` are NOT all
 *      benign                                                       -> "warning"
 *   4. any `mp.status === "skipped"` whose OPTIONAL `reasons?` are NOT all
 *      benign (missing/empty `reasons?` is NOT all-benign per D-28-08, so a
 *      no-reason mp-skip routes to warning -- the safe default)      -> "warning"
 *   5. otherwise                                                    -> undefined (info)
 *
 * This SOFTENS the old "any skipped -> warning" rule (the original SNM-14 /
 * D-16-11 / Phase-17.1 wording): a cascade whose ONLY non-success rows are
 * BENIGN idempotent no-op skips (every reason in `BENIGN_REASONS`) now
 * computes `info` and omits the 2nd `ctx.ui.notify` arg. mp-level skips soften
 * SYMMETRICALLY with plugin-level skips (D-28-07): the UXG-04 idempotent
 * autoupdate flip and the UXG-05 `marketplace update` no-op are benign -> info,
 * closing the Plan 27-04 deferral. First-match poisoning is intentional
 * (D-28-09): a MIXED cascade (one benign skip + one actionable skip, or any
 * manual-recovery row) routes the whole notification to `warning`. This ladder
 * is independent of `shouldEmitReloadHint` (SNM-33) -- severity and reload-hint
 * are separate ladders. NO rendered byte string changes: severity is the
 * second arg, never part of the body.
 */
function computeSeverity(message: NotificationMessage): "warning" | "error" | undefined {
  // Phase 42 / INFO-04 / SC#2 + Phase 43 / INFO-03 + Phase 44 / INFO-02:
  // info-surface kinds take precedence over the cascade severity ladder.
  // `marketplace-info` payloads carry no failure state and route to info
  // (undefined 2nd arg); `plugin-info` payloads route to `"error"` ONLY when
  // the embedded plugin row is `(failed)` (the `{not added}` --scope mismatch
  // row is the canonical example), else info; `marketplace-info-cascade`
  // AND `plugin-info-cascade` payloads route to info unconditionally -- no
  // failure can be expressed on a fan-out wrapper (the orchestrator routes
  // `{not added}` through the sibling `PluginInfoMessage` variant instead).
  // The cascade arm executes the existing first-match ladder below.
  if (
    message.kind === "marketplace-info" ||
    message.kind === "marketplace-info-cascade" ||
    message.kind === "plugin-info-cascade"
  ) {
    return undefined;
  }

  if (message.kind === "plugin-info") {
    return message.plugin.status === "failed" ? "error" : undefined;
  }

  // Arm 1: any failed (plugin or marketplace) -> "error".
  const hasError = message.marketplaces.some(
    (mp) => mp.status === "failed" || mp.plugins.some((p) => p.status === "failed"),
  );
  if (hasError) {
    return "error";
  }

  // Arm 2: any manual-recovery plugin row -> "warning" (always actionable).
  const hasManualRecovery = message.marketplaces.some((mp) =>
    mp.plugins.some((p) => p.status === "manual recovery"),
  );
  if (hasManualRecovery) {
    return "warning";
  }

  // Arm 3: any plugin-level "skipped" whose REQUIRED reasons are not all
  // benign -> "warning" (first-match poisoning per D-28-09 -- one actionable
  // skip warning-routes the whole cascade).
  const hasActionablePluginSkip = message.marketplaces.some((mp) =>
    mp.plugins.some((p) => p.status === "skipped" && !allBenign(p.reasons)),
  );
  if (hasActionablePluginSkip) {
    return "warning";
  }

  // Arm 4: any mp-level "skipped" whose OPTIONAL reasons? are not all benign
  // -> "warning". Missing/empty reasons? cannot be proven benign (allBenign
  // returns false on undefined/empty) -> warning, the D-28-08 safe default.
  const hasActionableMpSkip = message.marketplaces.some(
    (mp) => mp.status === "skipped" && !allBenign(mp.reasons),
  );
  if (hasActionableMpSkip) {
    return "warning";
  }

  // Arm 5: otherwise success / benign-only skip (omit 2nd arg = info).
  return undefined;
}

/**
 * The plugin/marketplace operation counts that drive the Phase 29 summary line.
 */
interface SummaryCounts {
  readonly plugins: number;
  readonly marketplaces: number;
}

/**
 * `error`-severity counting (D-29-04): failed plugin rows (summed across all
 * marketplaces) and failed marketplace rows. Mirrors `computeSeverity` arm 1.
 * Cascade-only: Phase 42 / SC#1 narrows the parameter to
 * `CascadeNotificationMessage` -- info-surface kinds do not invoke
 * `buildSummaryLine` (see `notify()` dispatcher and `buildSummaryLine`'s
 * defensive short-circuit).
 */
function countFailedOperations(message: CascadeNotificationMessage): SummaryCounts {
  let plugins = 0;
  let marketplaces = 0;

  for (const mp of message.marketplaces) {
    if (mp.status === "failed") {
      marketplaces++;
    }

    plugins += mp.plugins.filter((p) => p.status === "failed").length;
  }

  return { plugins, marketplaces };
}

/**
 * `warning`-severity counting (D-29-04): actionable-skip plugin rows
 * (`skipped` with NON-benign reasons) plus `manual recovery` plugin rows, and
 * actionable-skip marketplace rows (`skipped` with non-benign `reasons`).
 * Mirrors `computeSeverity` arms 2-4 / `allBenign`. Cascade-only per Phase
 * 42 / SC#1 (see `countFailedOperations`).
 */
function countSkippedOperations(message: CascadeNotificationMessage): SummaryCounts {
  let plugins = 0;
  let marketplaces = 0;

  for (const mp of message.marketplaces) {
    if (mp.status === "skipped" && !allBenign(mp.reasons)) {
      marketplaces++;
    }

    plugins += mp.plugins.filter(
      (p) => p.status === "manual recovery" || (p.status === "skipped" && !allBenign(p.reasons)),
    ).length;
  }

  return { plugins, marketplaces };
}

/**
 * D-29-03 pluralization: singular `"operation"` for a count of 1, plural
 * `"operations"` otherwise.
 */
function operationPhrase(count: number, kind: "plugin" | "marketplace"): string {
  return `${count} ${kind} ${count === 1 ? "operation" : "operations"}`;
}

/**
 * Phase 29 / UXG-07 (D-29-02/03/04): build the human-readable summary line that
 * `notify()` prepends before the cascade body for `error` and `warning`
 * severity. It gives the host `Error:` / `Warning:` prefix a meaningful,
 * contextual sentence to introduce ("focus on the operation, not what happened
 * to each plugin -- the cascade body already shows that").
 *
 * Verb is `"failed"` for error severity, `"skipped"` for warning severity.
 *
 * Wording (D-29-03): when only one type is non-zero the sentence is
 * `"N plugin operation(s) <verb>."` or `"N marketplace operation(s) <verb>."`;
 * when both are non-zero it is
 * `"N plugin operation(s) and M marketplace operation(s) <verb>."`. When BOTH
 * counts are zero (an unreachable shape -- `computeSeverity` only returns
 * error/warning when a matching row exists) the function degrades gracefully to
 * the plugin-only plural form (`"0 plugin operations <verb>."`) rather than
 * crashing.
 */
function buildSummaryLine(message: NotificationMessage, severity: "error" | "warning"): string {
  // Phase 42 / RESEARCH A6 + Phase 43 / INFO-03 + Phase 44 / INFO-02:
  // info-surface kinds NEVER carry a Phase-29 summary line (the operation-
  // count semantics of "N plugin operations failed" do not apply to
  // read-only query results -- the `notify()` dispatcher only invokes
  // `buildSummaryLine` from the cascade arm). This defensive short-circuit
  // returns the empty string so a future mistaken call still produces
  // benign output instead of accessing `message.marketplaces` on a
  // narrowed-away variant.
  if (
    message.kind === "marketplace-info" ||
    message.kind === "plugin-info" ||
    message.kind === "marketplace-info-cascade" ||
    message.kind === "plugin-info-cascade"
  ) {
    return "";
  }

  const verb = severity === "error" ? "failed" : "skipped";
  const counts =
    severity === "error" ? countFailedOperations(message) : countSkippedOperations(message);

  const pluginPhrase = operationPhrase(counts.plugins, "plugin");
  const marketplacePhrase = operationPhrase(counts.marketplaces, "marketplace");

  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return `${pluginPhrase} and ${marketplacePhrase} ${verb}.`;
  }

  if (counts.marketplaces > 0) {
    return `${marketplacePhrase} ${verb}.`;
  }

  // counts.plugins > 0, or the unreachable 0/0 degrade-to-plugin-plural case.
  return `${pluginPhrase} ${verb}.`;
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
  // Phase 42 / RESEARCH "Don't Hand-Roll: Reload-hint trailer on info messages"
  // + Phase 43 / INFO-03 + Phase 44 / INFO-02: info-surface kinds NEVER
  // trigger the reload-hint trailer. The info commands (`marketplace info`,
  // `plugin info`) are read-only surfaces that do not change a Pi-visible
  // resource; the trailer would mislead the user into running `/reload`
  // for no reason. Each fan-out wrapper inherits this short-circuit -- a
  // fan-out of N info blocks is N read-only queries composed; it remains
  // structurally read-only.
  if (
    message.kind === "marketplace-info" ||
    message.kind === "plugin-info" ||
    message.kind === "marketplace-info-cascade" ||
    message.kind === "plugin-info-cascade"
  ) {
    return false;
  }

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

  // PL-4: emit description as a 4-space-indented second line when present and
  // non-empty. Only the four list-surface variants carry the field; the type
  // narrowing is intentionally structural (switch on status) so the compiler
  // rejects any future attempt to add description to a cascade-only variant.
  if (
    (p.status === "present" ||
      p.status === "upgradable" ||
      p.status === "available" ||
      p.status === "unavailable") &&
    p.description !== undefined &&
    p.description.length > 0
  ) {
    lines.push(`    ${truncateDescription(p.description)}`);
  }

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
 * Phase 42 / INFO-01: compose the marketplace-info marketplace header line.
 * Mirrors `renderMpHeader`'s SUB-BRANCH B list-surface composition (the
 * details-defined / list-surface form: `● <name> [<scope>] <autoupdate-marker>`).
 * Differs from `renderMpHeader` in one place: on the info surface BOTH the
 * `<autoupdate>` and `<no autoupdate>` markers are emitted (per INFO-01:
 * "with `<autoupdate>` / `<no autoupdate>` marker"), whereas the list
 * surface suppresses `<no autoupdate>` (absence-conveys-off). The carve-out
 * lives here and does NOT touch `renderMpHeader` (RESEARCH Pitfall 1: zero
 * mutation of the cascade renderer arms).
 *
 * File-private; sole callers are `renderMarketplaceInfo` and
 * `renderPluginInfo` below.
 */
function composeMpInfoHeader(name: string, scope: Scope, details: MarketplaceDetails): string {
  const marker = details.autoupdate ? "<autoupdate>" : "<no autoupdate>";
  return `${ICON_INSTALLED} ${name} [${scope}] ${marker}`;
}

/**
 * Phase 42 / INFO-01 / INFO-04: render a `MarketplaceInfoMessage` to its
 * single-string body. Composes:
 *   - the marketplace-info header line at column 0 (`composeMpInfoHeader`),
 *   - the source-kind line (`github: <owner>/<repo>[#<ref>]` or
 *     `path: <abs-path>`),
 *   - optional `last_updated: <ISO8601>` (github sources only per INFO-01),
 *   - optional `description: <text>` (single attribute line, NOT wrapped
 *     -- description wrapping is `plugin info`-only per INFO-02).
 *
 * Joins all lines with `\n`. `probe` is unused on info surfaces (info
 * messages do not emit soft-dep markers per RESEARCH Anti-Patterns) but
 * accepted for signature parity with `composeMarketplaceBlock`. File-
 * private; sole caller is `notify()` dispatcher.
 */
function renderMarketplaceInfo(message: MarketplaceInfoMessage, _probe: SoftDepStatus): string {
  const lines: string[] = [composeMpInfoHeader(message.name, message.scope, message.details)];

  switch (message.source.sourceKind) {
    case "github": {
      const refSuffix = message.source.ref === undefined ? "" : `#${message.source.ref}`;
      lines.push(`github: ${message.source.owner}/${message.source.repo}${refSuffix}`);

      // Phase 42 / WR-04: read the timestamp from the persisted
      // `MarketplaceDetails.lastUpdatedAt` rather than a duplicate
      // top-level `lastUpdated` field. The `details` record already carries
      // this value through state-io; a parallel top-level field would mean
      // two sources of truth that callers have to keep in sync. Github-
      // source gate is enforced on the renderer side (INFO-01).
      if (message.details.lastUpdatedAt !== undefined) {
        lines.push(`last_updated: ${message.details.lastUpdatedAt}`);
      }

      break;
    }

    case "path":
      lines.push(`path: ${message.source.absPath}`);
      break;

    default:
      assertNever(message.source);
  }

  if (message.description !== undefined) {
    lines.push(`description: ${message.description}`);
  }

  return lines.join("\n");
}

/**
 * Phase 43 / INFO-03: render a `MarketplaceInfoCascadeMessage` to its
 * single-string body by composing `renderMarketplaceInfo` over each block
 * in caller order and joining the per-block bodies with `\n\n` (one blank
 * line between blocks). Mirrors the cascade `composeMarketplaceBlock` join
 * semantics so the fan-out byte form matches the existing project-first /
 * user-second list-surface convention.
 *
 * The renderer does NOT sort blocks -- caller-supplied order is honored
 * end-to-end (`getMarketplaceInfo` is responsible for the project-first
 * iteration per MSG-GR-3 / INFO-03). An empty `blocks` array returns the
 * empty string (the orchestrator MUST NOT construct an empty fan-out for
 * the user-facing path, but the renderer keeps the edge case
 * deterministic).
 *
 * `probe` is unused on info surfaces but accepted for signature parity
 * with `renderMarketplaceInfo` (and forwarded to each per-block render).
 * File-private; sole caller is `notify()` dispatcher.
 */
function renderMarketplaceInfoCascade(
  message: MarketplaceInfoCascadeMessage,
  probe: SoftDepStatus,
): string {
  return message.blocks.map((b) => renderMarketplaceInfo(b, probe)).join("\n\n");
}

/**
 * Phase 44 / INFO-02 + INFO-03: render a `PluginInfoCascadeMessage` to
 * its single-string body by composing `renderPluginInfo` over each block
 * in caller order and joining the per-block bodies with `\n\n` (one
 * blank line between blocks). Mirrors `renderMarketplaceInfoCascade` and
 * the cascade `composeMarketplaceBlock` `\n\n` join so the fan-out byte
 * form matches the existing project-first / user-second list-surface
 * convention.
 *
 * The renderer does NOT sort blocks -- caller-supplied order is honored
 * end-to-end (`getPluginInfo` is responsible for the project-first
 * iteration per MSG-GR-3 / INFO-03). An empty `blocks` array returns
 * the empty string (the orchestrator MUST NOT construct an empty
 * fan-out for the user-facing path, but the renderer keeps the edge
 * case deterministic).
 *
 * `probe` is unused on info surfaces but accepted for signature parity
 * with `renderPluginInfo` (and forwarded to each per-block render).
 * File-private; sole caller is the `dispatchInfoMessage` helper.
 */
function renderPluginInfoCascade(message: PluginInfoCascadeMessage, probe: SoftDepStatus): string {
  return message.blocks.map((b) => renderPluginInfo(b, probe)).join("\n\n");
}

/**
 * Map a `PluginInfoRow` status literal to its rendering glyph.
 * `installed` -> `●`, `available` -> `○`,
 * `unavailable | failed` -> `⊘`. Exhaustive switch + `assertNever`
 * so a 5th status member in `PluginInfoRowBase` would be a compile-
 * time error here rather than silently defaulting to the uninstallable
 * glyph.
 */
function pluginInfoStatusGlyph(status: PluginInfoRow["status"]): string {
  switch (status) {
    case "installed":
      return ICON_INSTALLED;
    case "available":
      return ICON_AVAILABLE;
    case "unavailable":
    case "failed":
      // Both use the prohibited-symbol glyph.
      return ICON_UNINSTALLABLE;
    default:
      assertNever(status);
      return "";
  }
}

// Derive the tuple's element type from the interface so the two
// declarations cannot drift. The tuple is sized exactly (4 entries):
// adding a 5th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- TS rejects the
// literal because `ComponentKind` would no longer cover every keyof
// the interface. Without the explicit tuple length, the renderer
// would silently omit the new kind from output.
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [ComponentKind, ComponentKind, ComponentKind, ComponentKind] = [
  "agents",
  "commands",
  "mcp",
  "skills",
];

/**
 * Append the per-kind component lines + optional dependencies line
 * for a resolved `PluginInfoRow`. Per-kind order is alphabetical
 * (`agents`, `commands`, `mcp`, `skills`); within each kind, names
 * render in the caller-supplied order. The orchestrator pre-sorts;
 * the renderer does not.
 */
function appendResolvedComponentLines(
  lines: string[],
  components: PluginInfoComponentsResolved["components"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }

  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}

/**
 * Render a `PluginInfoMessage` to its single-string body.
 *
 * `{not added}` carve-out: when the embedded plugin row has
 * `status === "failed"` AND `reasons` is EXACTLY `["not added"]` (sole
 * reason), the marketplace being queried is not present in the
 * requested scope -- the renderer emits ONLY the bare plugin row at
 * column 0 (`⊘ <name> [<scope>] (failed) {not added}`). No
 * marketplace header. Any `failed` row whose reasons contain
 * `"not added"` AS WELL AS other reasons routes through the standard
 * header form so the additional failure context surfaces.
 *
 * Standard path: every other plugin-info row renders the
 * always-marketplace-header form: marketplace header at col 0;
 * plugin row at 2-space indent (status glyph + name + optional scope
 * bracket + version + (status) + optional reasons brace); optional
 * description block wrapped via `wrapDescription(text, 4, 66)`; then
 * either per-kind component lists at 4-space indent + optional
 * `dependencies:` line (componentsResolved: true), or the single
 * marker line `    components: not resolved` (componentsResolved:
 * false).
 *
 * Reasons brace via `composeReasons` with both declares-flags FALSE
 * -- info messages NEVER emit soft-dep markers.
 *
 * SORT PRECONDITION: per-kind arrays and `dependencies` MUST be
 * pre-sorted at message construction. The renderer does not sort.
 *
 * `probe` is accepted for signature parity with
 * `composeMarketplaceBlock` but unused on the info path.
 */
function renderPluginInfo(message: PluginInfoMessage, probe: SoftDepStatus): string {
  const plugin = message.plugin;

  // `{not added}` carve-out: bare row at column 0, no marketplace
  // header. The predicate demands `"not added"` be the SOLE reason:
  // a future caller bug constructing
  // `reasons: ["not added", "permission denied"]` must NOT silently
  // suppress the additional reason and marketplace context. Sole-
  // reason scoping keeps the carve-out at the catalog state and routes
  // every other reason mix through the standard header form.
  if (
    plugin.status === "failed" &&
    plugin.reasons?.length === 1 &&
    plugin.reasons[0] === "not added"
  ) {
    return joinTokens([
      ICON_UNINSTALLABLE,
      plugin.name,
      plugin.scope === undefined ? "" : `[${plugin.scope}]`,
      renderVersion(plugin.version),
      "(failed)",
      composeReasons(plugin.reasons, false, false, probe),
    ]);
  }

  // INFO-02 standard path: marketplace header + 2-space-indent row + optional
  // description + per-kind components.
  const lines: string[] = [
    composeMpInfoHeader(
      message.marketplaceName,
      message.marketplaceScope,
      message.marketplaceDetails,
    ),
  ];

  const pluginRow = joinTokens([
    pluginInfoStatusGlyph(plugin.status),
    plugin.name,
    renderScopeBracket(plugin.scope, message.marketplaceScope),
    renderVersion(plugin.version),
    `(${plugin.status})`,
    composeReasons(plugin.reasons, false, false, probe),
  ]);
  lines.push(`  ${pluginRow}`);

  if (plugin.description !== undefined && plugin.description.length > 0) {
    lines.push(...wrapDescription(plugin.description, 4, DESCRIPTION_MAX_COLS));
  }

  // INFO-02 / INFO-05: per-kind components OR the unresolved marker.
  switch (plugin.componentsResolved) {
    case true:
      appendResolvedComponentLines(lines, plugin.components, plugin.dependencies);
      break;

    case false:
      lines.push("    components: not resolved");
      break;

    default:
      assertNever(plugin);
  }

  return lines.join("\n");
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
 * Dispatcher for the info-surface arms of `notify()`. Centralizes the
 * four-arm body computation + the severity-aware `ctx.ui.notify()`
 * call so the public `notify()` dispatcher stays under the cognitive-
 * complexity budget. IL-2: one `ctx.ui.notify` call per invocation
 * (arms are mutually exclusive).
 */
function dispatchInfoMessage(
  ctx: ExtensionContext,
  message:
    | MarketplaceInfoMessage
    | PluginInfoMessage
    | MarketplaceInfoCascadeMessage
    | PluginInfoCascadeMessage,
  probe: SoftDepStatus,
): void {
  // Body composition per variant. The four info renderers share the
  // same `(message, probe) => string` shape; severity is computed off
  // the discriminator via the shared `computeSeverity` ladder.
  let body: string;
  switch (message.kind) {
    case "marketplace-info":
      body = renderMarketplaceInfo(message, probe);
      break;
    case "plugin-info":
      body = renderPluginInfo(message, probe);
      break;
    case "marketplace-info-cascade":
      body = renderMarketplaceInfoCascade(message, probe);
      break;
    case "plugin-info-cascade":
      body = renderPluginInfoCascade(message, probe);
      break;
    default:
      assertNever(message);
      return;
  }

  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);
  } else {
    ctx.ui.notify(body, severity);
  }
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
  // call inside composePluginLines below (cascade arm) and into the info-
  // surface renderers (which accept it for signature parity but do not use it
  // -- info messages never emit soft-dep markers per RESEARCH Anti-Patterns).
  const probe = softDepStatus(pi);

  // Dispatch info-surface kinds through `dispatchInfoMessage` so the
  // cascade arm below stays under the cognitive-complexity budget.
  // The helper performs exactly ONE `ctx.ui.notify` call per
  // invocation (IL-2). No reload-hint, no summary line for any info
  // kind. After this branch, TypeScript narrows `message` to
  // `CascadeNotificationMessage` via the exhaustiveness switch below.
  if (
    message.kind === "marketplace-info" ||
    message.kind === "plugin-info" ||
    message.kind === "marketplace-info-cascade" ||
    message.kind === "plugin-info-cascade"
  ) {
    dispatchInfoMessage(ctx, message, probe);
    return;
  }

  // Exhaustiveness gate. After the info-arm return above, the only
  // legal residual `message.kind` values are `undefined` (back-compat)
  // or the explicit `"cascade"`. The switch + `assertNever` ensures a
  // future 6th `kind` literal added without extending this dispatcher
  // becomes a compile error here.
  switch (message.kind) {
    case undefined:
    case "cascade":
      // Cascade body falls through below.
      break;
    default:
      assertNever(message);
      return;
  }

  // Cascade body unchanged -- moved verbatim into this arm so v1.0-v1.7
  // byte forms remain identical across the 60+ catalog UAT fixtures
  // (RESEARCH Pitfall 1). Caller-supplied order honored end-to-end (no
  // internal sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  // Compute reload-hint per the state-change trigger ladder and append it
  // with one blank line.
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withHint = hint === "" ? body : `${body}\n\n${hint}`;

  // Severity dispatch via the Pi API's magic-string second-arg convention:
  // omitting the 2nd arg is info severity; "warning" / "error" otherwise.
  const severity = computeSeverity(message);
  if (severity === undefined) {
    // Phase 29 / UXG-07 (D-29-02): info severity is byte-identical to the
    // pre-Phase-29 behavior -- cascade body only, NO summary line.
    ctx.ui.notify(withHint);
  } else {
    // Phase 29 / UXG-07 (D-29-02): for error/warning severity, PREPEND the
    // summary line so the host `Error:` / `Warning:` prefix introduces a
    // meaningful count of the failed/skipped operations. The reload-hint
    // (if any) stays last: `{summary}\n\n{cascade body}\n\n{reload-hint}`.
    const summarized = `${buildSummaryLine(message, severity)}\n\n${withHint}`;
    ctx.ui.notify(summarized, severity);
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

/**
 * AUTH-01 seam: create a raw notify callback bound to ctx.ui.notify for
 * use with domain-tier functions (e.g. initiateDeviceFlow) that require a
 * simple `(message, severity?) => void` callback rather than the structured
 * NotificationMessage surface. This is the ONLY sanctioned way to derive
 * a raw callback from ctx.ui.notify outside of shared/notify.ts itself --
 * all other code must use notify(ctx, pi, NotificationMessage) directly.
 */
export function makeRawNotifyFn(
  ctx: ExtensionContext,
): (message: string, severity?: "info" | "warning" | "error") => void {
  return (message: string, severity?: "info" | "warning" | "error"): void => {
    if (severity === undefined) {
      ctx.ui.notify(message);
    } else {
      ctx.ui.notify(message, severity);
    }
  };
}
