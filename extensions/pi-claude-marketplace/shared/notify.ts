import { softDepStatus } from "../platform/pi-api.ts";

import { appendHooksBlock } from "./concerns/hooks.ts";
import { softDepMarkers } from "./concerns/soft-dep.ts";
import { assertNever, causeChainTrailer, ManualRecoveryError } from "./errors.ts";

import type { Scope } from "./types.ts";
import type { ExtensionAPI, ExtensionContext, SoftDepStatus } from "../platform/pi-api.ts";
import type { HookSummaryEntry } from "./concerns/hooks.ts";
import type { Dependency } from "./concerns/soft-dep.ts";

/**
 * shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site and the
 * single source of truth for the structured-notification surface. Severity is
 * a caller-stamped per-row field (`Severity`): each producer stamps every row's
 * `severity`, and `computeSeverity` takes the numeric MAX over the rows (SEV-02)
 * to derive the magic-string `"info" | "warning" | "error"` second arg the Pi
 * API's `notify(msg, type?)` accepts -- NOT content inference. The standalone
 * info-surface kinds (`marketplace-not-added`, `plugin-info`, and the read-only
 * info/cascade kinds) carry no per-row severity array, so they keep a tiny
 * kind->severity map. The eslint per-file override in eslint.config.js disables
 * `no-restricted-syntax` for this file so inline `eslint-disable-next-line`
 * comments are unnecessary here.
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
 * CMC-11 closed reasons set. This tuple is the SOLE closed-set authority
 * (style guide v2.0 retired the binding YAML frontmatter at
 * `docs/messaging-style-guide.md`; the guide's prose references these
 * tuples). The set covers the
 * autoupdate-flip idempotent rows (`"already autoupdate"` /
 * `"already no autoupdate"`) and the failure-class closed Reasons the catalog
 * UAT requires across uninstall / marketplace-remove partial / reinstall /
 * update / marketplace-update rows (`"permission denied"` /
 * `"source missing"` / `"network unreachable"`).
 *
 * INFO-04 / INFO-08 / TYPE-01: `"not added"` is the STRUCTURAL marketplace-
 * absent marker -- it is NOT a `ContentReason` and is reachable ONLY via the
 * dedicated `MarketplaceNotAddedMessage` variant (`renderMarketplaceNotAdded`
 * hard-codes the `{not added}` brace). A request for a scope where the target
 * marketplace is not present renders `⊘ <name> [<scope>] (failed) {not added}`
 * at column 0 with severity `"error"`.
 *
 * D-09 / OUT-08: this tuple is the byte-source of the closed set -- its
 * 34-entry membership AND order are catalog-stable and MUST NOT change. The
 * topic-grouped organization of these literals (idempotent / unsupported-
 * components / failure-class shared groups, plus the command-private reasons)
 * lives in `shared/notify-reasons.ts` as typed VIEWS over this set; that module
 * carries a compile-time completeness proof that its partition exactly covers
 * this tuple. Command-private reasons (`duplicate name` / `stale clone` /
 * `not found` / `not installed` / `plugins remain` / `orphan rewake`) and the
 * structural `"not added"` marker are owned outside the shared topic groups.
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
  "unsupported hooks",
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
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
  "not added",
  // SURF-05 / D-63-08: a hook handler declared `rewakeMessage` or
  // `rewakeSummary` without `asyncRewake: true`. The orphan companion-field
  // family is admitted at the schema layer (HOOK-06 / EXEC-05) but produces
  // no runtime effect; this REASONS member surfaces the config bug as
  // `(installed) {orphan rewake}` on the install-cascade row. Detection
  // lives in `domain/resolver.ts::applyHooksConfig`; install row composition
  // reads `resolved.orphanRewake` and pushes this token into `reasons[]`.
  // One row per plugin regardless of N orphan handlers.
  "orphan rewake",
  // D-76-08: a marketplace clone hit an HTTP auth challenge (401/403). Error
  // severity; truthful attribution -- a 401/403 is an auth failure, NOT
  // `network unreachable`. The cause chain carries the HTTP detail. Reused by
  // PROV-04's fail-clean case for provider-based auth.
  "authentication required",
  // PURL-06: a declared plugin key `${plugin}@${marketplace}` whose
  // `@<marketplace>` is NOT declared in the merged config (an orphaned plugin
  // declaration -- e.g. a previous-version `--local` install that a marketplace
  // remove left behind). The reconcile planner's `dangling-reference`
  // source-mismatch cause renders this token instead of `source mismatch`, so
  // the operator sees the real problem (an undeclared marketplace) rather than a
  // source-comparison failure that does not exist.
  "dangling reference",
] as const;

export type Reason = (typeof REASONS)[number];

/**
 * The closed set of CONTENT reasons -- every `Reason` EXCEPT the structural
 * `"not added"` marker (TYPE-02 / D-46-02). Content reasons describe WHY a
 * resource is in a failure / skipped / unavailable state; the structural
 * `"not added"` describes that the marketplace SUBJECT is absent entirely and
 * is reachable ONLY via the dedicated `MarketplaceNotAddedMessage` variant
 * (TYPE-01). Retyping the row `reasons` fields to `readonly ContentReason[]`
 * makes a mixed `["not added", "permission denied"]` row a COMPILE error
 * rather than a render-time `length === 1` guard.
 */
export type ContentReason = Exclude<Reason, "not added">;

/**
 * I5 / PR #51 / T-53-02-02 / T-55-02-01: collapse any absolute-path token
 * (POSIX `/...` or Windows `<drive>:\...` / `\\?\...`) in a free-text
 * diagnostic to its basename. Preserves the surrounding parse / permission
 * detail (NFR-9: surface only message text, never `.stack`) so callers can
 * thread `loadConfig`'s `result.error` -- which embeds the absolute
 * `filePath` -- through the rendered cause-chain trailer WITHOUT leaking
 * the path. Single canonical implementation here; consumers route their
 * diagnostic strings through this seam before constructing a synthetic
 * Error for `notify()`'s cause-chain walker.
 *
 * Conservative match:
 *   - POSIX absolute: `/` followed by a non-whitespace, non-quote run
 *     (`[\w./_~-]` chars), with at least one path separator inside the run.
 *   - Windows drive: `<letter>:[\\/]` followed by the same run.
 *   - UNC extended: `\\?\` followed by the same run.
 * Each match is replaced with `path.basename(match)`. Non-path tokens
 * (e.g. JSON pointers like `/schemaVersion`) are short -- single-segment
 * after the leading `/` -- and intentionally excluded so JSON-validator
 * diagnostics survive intact for the operator.
 */
export function redactAbsolutePaths(text: string): string {
  // Match absolute paths with at least one internal separator so single-
  // segment leading-slash JSON pointers (`/schemaVersion`) are not eaten.
  const re = /(?:[A-Za-z]:[\\/]|\\\\\?\\|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
  return text.replace(re, (match) => {
    // path.basename handles both POSIX and Windows separators when invoked
    // through the platform-agnostic node:path module, but the renderer ships
    // on POSIX and a hand-rolled split is byte-stable across runtimes here.
    const lastSep = Math.max(match.lastIndexOf("/"), match.lastIndexOf("\\"));
    return lastSep < 0 ? match : match.slice(lastSep + 1);
  });
}

/**
 * CMC-08 closed status-token set. This tuple is the SOLE closed-set
 * authority (style guide v2.0 retired the binding YAML frontmatter at
 * `docs/messaging-style-guide.md`).
 * `(no marketplaces)` and `(no plugins)` are FLAT members of this single
 * tuple; the bare-token render shape (no icon, no scope brackets) is a
 * renderer concern that branches at emission time.
 *
 * DIFF-02 (D-53-02): the 4 `"will *"` entries are the pending-tense tokens
 * emitted by `/claude:plugin pending` rows. They are STRUCTURALLY EXCLUDED
 * from `shouldEmitReloadHint`'s trigger set (pending rows are
 * pre-transition; `/reload to pick up changes` is grammatically false for
 * them) and sit AFTER the four head-of-tuple state-change tokens that
 * drive the reload-hint, so those positions stay unchanged. The
 * `"disabled"` entry is the D-54-01 / ENBL-04 token and is appended LAST
 * after the `"will *"` block; the head-of-tuple invariant is preserved
 * because it sits below the reload-hint trigger window.
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
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  // FSTAT-02 / FSTAT-04 / D-66-03: derived partial-state realized tokens. Both
  // are appended LAST (below the reload-hint trigger window, like "disabled"):
  // `partially-installed` (◉) is a recorded-installed plugin currently re-resolving
  // `partially-available`; `partially-upgradable` (●) is a currently-clean installed plugin
  // whose newer cache candidate would NEWLY degrade. The `will partially install`
  // pending case is a render MODIFIER on `will install`, NOT a token, so the set
  // grows by exactly 2 (D-66-05).
  "partially-installed",
  "partially-upgradable",
  // USTAT-02 / D-64-01: the not-installed, partially-available
  // render token. Appended LAST (below the reload-hint trigger window, like
  // `disabled` and the partial-state tokens). Distinct from `unavailable`: a
  // plugin resolving `partially-available` has no structural defect -- it would
  // degrade-install (drop unsupported components) under `--partial`. Maps to the
  // dedicated `ICON_PARTIALLY_AVAILABLE` (`⊖`) glyph.
  "partially-available",
  // RSTA-01 / D-80-06: the not-installed git-source inventory token for a
  // plugin whose clone/mirror is not yet materialized locally (`(remote)`,
  // `ICON_REMOTE` `◌`). Replaces the manifest-only `(available)` over-claim on
  // the list/info/install-completion surfaces. Appended LAST (below the
  // reload-hint trigger window, like `disabled` and the partial-state tokens):
  // it is an inventory row (`info` severity, `needsReload: false`), never a
  // realized transition. Bare row -- no `reasons` (D-80-03).
  "remote",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];

/**
 * CMC-38 closed marker set. This tuple is the SOLE closed-set authority
 * (style guide v2.0 retired the binding YAML frontmatter at
 * `docs/messaging-style-guide.md`). Entries are
 * stored WITHOUT surrounding `<>` chevrons; the `<marker>` chevron form
 * is composed by the renderer at emission time (MSG-GR-5).
 */
export const MARKERS = ["autoupdate", "no autoupdate"] as const;

export type Marker = (typeof MARKERS)[number];

/**
 * CMC-38 closed pattern-class set. This tuple is the SOLE closed-set
 * authority (style guide v2.0 retired the binding YAML frontmatter at
 * `docs/messaging-style-guide.md`).
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

/**
 * S2 / PR #51: post-cascade hygiene warnings out-of-band notification seam.
 *
 * Surfaces post-state-commit warnings (data-dir mkdir deferred,
 * completion-cache refresh deferred, agent foreign-content preserved,
 * bridge-side soft warnings) that have no representation in the
 * `MarketplaceNotificationMessage` cascade body. The reconcile apply
 * pass collects these from `InstallPluginOutcome.postCommitWarnings`
 * across the install bucket and fires this helper exactly once -- a
 * sanctioned exception to the per-cascade single-notify discipline
 * (RECON-04 / IL-2) that mirrors `import/execute.ts`'s `pushDiagnostic`
 * channel.
 *
 * The on-the-wire form is `${header}\n\n${lines.join("\n")}` at
 * `"warning"` severity. The header counts the per-warning lines so the
 * operator sees both the total and the per-warning detail without
 * re-flowing the cascade body. Standalone-mode commands swallow these
 * per D-19-01; orchestrated-mode (cascade) callers use this seam.
 */
export function notifyDiagnostic(
  ctx: ExtensionContext,
  header: string,
  lines: readonly string[],
): void {
  if (lines.length === 0) {
    return;
  }

  ctx.ui.notify(`${header}\n\n${lines.join("\n")}`, "warning");
}

/**
 * T-62-09 IL-2 EXEMPTION: surfaces the `rewakeSummary` UI message at
 * `"info"` severity from the asyncRewake exit handler. This is the
 * single sanctioned runtime notify call originating from
 * `bridges/hooks/async-rewake/registry.ts`; the exemption exists
 * because `rewakeSummary` is the upstream Claude-Code-mandated UI
 * status surface declared in the plugin author's hook handler -- the
 * hooks bridge does not have a structured `NotificationMessage` arm
 * for it (HOOK-06).
 *
 * Empty strings are silently ignored so the caller can pass an
 * `entry.rewakeSummary` field unconditionally without a guard.
 */
export function notifyAsyncRewakeSummary(ctx: ExtensionContext, summary: string): void {
  if (summary.length === 0) {
    return;
  }

  ctx.ui.notify(summary, "info");
}

// ---------------------------------------------------------------------------
// Structured notification type model.
//
// Satisfies SNM-01 (NotificationMessage), SNM-02
// (MarketplaceNotificationMessage), SNM-03 (PluginNotificationMessage
// discriminated union; each command's render map is total over its OWN
// statuses, so a missing or extra variant is a local compile error -- D-10),
// SNM-04 (PluginStatus derived via indexed
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
 * Runtime tuple of every plugin status literal; the derived `PluginStatus`
 * union is the SNM-04 closed set each command's render map narrows over.
 * `"manual recovery"` is a literal string WITH A SPACE; do not transform to
 * kebab-case ("manual-recovery") or camelCase ("manualRecovery") -- the
 * renderer emits the discriminator literal directly into the `(<status>)`
 * brace slot.
 *
 * RLD-04 / D-08: the list-only inventory row uses `"installed"` with
 * `needsReload: false` (the list surface's reload-suppression is carried by the
 * stamped `needsReload` flag, not by a separate status token). The four
 * `"will *"` entries are the DIFF-02 pending-tense tokens; the
 * trailing `"disabled"` entry is the D-54-01 / ENBL-04 token. Per RLD-02 the
 * `/reload to pick up changes` trailer is driven by the OR-reduce of the
 * caller-stamped `needsReload` over the rows -- a steady-state
 * `/claude:plugin list` inventory row stamps `needsReload: false`, while a
 * realized transition (install / update / reinstall / uninstall / disable)
 * stamps `needsReload: true`.
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
  "will install",
  "will uninstall",
  "will enable",
  "will disable",
  "disabled",
  // FSTAT-02 / FSTAT-04 / D-66-03: derived partial-state realized tokens,
  // appended last (mirrors the STATUS_TOKENS ordering). `partially-installed`
  // stamps `needsReload: true` on the install/update success cascade (a
  // realized transition like `installed`); `partially-upgradable` is a
  // list-inventory-only row (`needsReload: false`).
  "partially-installed",
  "partially-upgradable",
  // USTAT-02 / D-64-01: the not-installed, partially-available
  // plugin-status member. REQUIRED here (not just in STATUS_TOKENS) because
  // `PluginInfoRowBase.status` derives via `Extract<PluginStatus, ...>`; without
  // this entry `Extract<PluginStatus, "partially-available">` resolves to `never`. This
  // is an inventory/list-surface row (no realized transition), so it stamps no
  // reload-hint trigger -- like `available` / `unavailable`.
  "partially-available",
  // RSTA-01 / D-80-06: the not-installed git-source `(remote)` member.
  // REQUIRED here (not just in STATUS_TOKENS) because `PluginInfoRowBase.status`
  // derives via `Extract<PluginStatus, ...>`; the info surface renders
  // `(remote)`, so without this entry `Extract<PluginStatus, "remote">`
  // resolves to `never`. Inventory/list-surface row (no realized transition):
  // stamps no reload-hint trigger, like `available` / `unavailable`.
  "remote",
] as const;

/**
 * Runtime tuple of every marketplace status literal; the derived
 * `MarketplaceStatus` union is the SNM-05 closed set.
 * `"autoupdate enabled"` / `"autoupdate disabled"` / `"skipped"` support the
 * autoupdate-flip surface. Marketplace add/remove are immediate (WILL-01 /
 * D-65.1-02 / D-65.1-03): de-registration carries no `will` token and the
 * reload-deferred plugin-uninstall cascade is surfaced as per-plugin
 * `will uninstall` child rows, so this set carries no marketplace-level
 * `will *` token. Order is normative -- the 4 leading entries retain their
 * position to match the `renderMpHeader` switch-arm ordering.
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
 * Marketplace-level details surfaced on the `marketplace list` rendering
 * (SNM-07). `autoupdate` is REQUIRED -- the persistence record
 * always knows whether autoupdate is enabled. `lastUpdatedAt?` is an
 * optional ISO timestamp whose shape mirrors
 * `persistence/state-io.ts` (`lastUpdatedAt: Type.Optional(Type.String)`)
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
 * The closed severity union stamped on every notification row and passed as the
 * Pi API `notify(msg, type?)` second arg. `computeSeverity` MAX-reduces it
 * across rows (SEV-02); rank `info < warning < error`.
 */
export type Severity = "info" | "warning" | "error";

/**
 * D-05 / D-06: the universal caller-intent fields carried on the base message
 * shape common to every plugin and marketplace notification row. The member
 * names are the fixed shared convention (`severity`, `needsReload`,
 * `dependencies`) so every command's message shapes look identical.
 *
 * D-07: `severity?` and `needsReload?` are the caller-stamped reduction inputs.
 * `computeSeverity` MAX-reduces `severity` across rows (SEV-02) and the
 * reload-hint trailer is the OR-reduce of `needsReload` (RLD-02); an absent
 * value defaults to `info` / `false` (SEV-01 / RLD-01). Typed as the closed
 * `Severity` union and a plain `boolean` respectively.
 *
 * D-06 / TYPE-04: `dependencies` is the universal soft-dep field. It is NOT
 * promoted to this base as optional, because three plugin variants
 * (`installed` / `updated` / `reinstalled`) declare it as a REQUIRED
 * `readonly Dependency[]` and the soft-dep marker injection in `composeReasons`
 * is gated to exactly those three render arms. Promoting it to an optional base
 * field here would let any row carry it and risk a `requires pi-subagents`
 * marker leaking onto a row that structurally never declares a soft dep; so the
 * field stays declared on those three arms (notify.ts) and this anchor records
 * that it is the universal soft-dep member of the shared convention.
 */
export interface MessageBase {
  readonly severity?: Severity;
  readonly needsReload?: boolean;
}

/**
 * GATE-01 / D-04: the narrowing base for state-change (transition) message
 * arms. It redeclares the two optional `MessageBase` fields as REQUIRED, so a
 * producer literal that omits either `severity` or `needsReload` on a
 * transition row is a TS2741 compile error at the construction site. The
 * `MarketplaceRows<Msg>` call-site type narrows `plugins` to the command's
 * `Msg` union BEFORE the post-check widening cast in `notifyWithContext`, so
 * the gate reaches every producer that builds a transition row. Non-transition
 * arms (`available`/`unavailable`/`upgradable`/`failed`/`skipped`/`manual
 * recovery`/`will *`) stay on `extends MessageBase` -- their fields
 * remain optional and default to info/false (SEV-01/RLD-01).
 */
export interface TransitionMessageBase extends MessageBase {
  readonly severity: Severity; // narrowed: required
  readonly needsReload: boolean; // narrowed: required
}

/**
 * `(installed)` -- single-shot install or cascade install row. Carries
 * `dependencies` (SNM-06) so the renderer can emit the
 * `requires pi-subagents` / `requires pi-mcp` probe reasons; no `reasons`
 * because installed rows never emit a `{<reason>}` brace.
 *
 * SURF-05 / D-63-08: as of v1.13 the installed row CAN carry a
 * `readonly reasons?: ContentReason[]` brace -- the `"orphan rewake"`
 * token surfaces a hook-config bug (`rewakeMessage` / `rewakeSummary`
 * declared on a handler without `asyncRewake: true`) on the otherwise-
 * successful install row (`(installed) {orphan rewake}`). The reasons
 * brace renders through the existing `composeReasons` helper so the
 * soft-dep markers and reasons share one brace block per MSG-GR-4
 * (`(installed) {orphan rewake, requires pi-subagents}`). The resolver-side
 * `resolved.orphanRewake === true` plugins are pushed into `reasons[]`.
 *
 * RLD-04 / D-08: this arm ALSO carries the list-surface steady-state inventory
 * row (the former `present` status, now collapsed into `installed`). The list
 * orchestrator emits it with `needsReload: false` so the OR-reduce reload-hint
 * (RLD-02) stays suppressed for inventory, and OMITS `reasons` so the
 * orphan-rewake brace never leaks onto a steady-state row. `description?` is the
 * PL-4 optional second line, populated only on the list surface from the
 * manifest entry; cascade install rows never carry it.
 */
export interface PluginInstalledMessage extends TransitionMessageBase {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
  readonly description?: string;
}

/**
 * `(updated)` -- update cascade row. Carries REQUIRED `from` / `to`
 * so the renderer can compose the `v1.0 → v1.2` arrow form;
 * `dependencies` REQUIRED; no `reasons`.
 */
export interface PluginUpdatedMessage extends TransitionMessageBase {
  readonly status: "updated";
  readonly name: string;
  readonly from: string;
  readonly to: string;
  readonly dependencies: readonly Dependency[];
  readonly scope?: Scope;
}

/**
 * `(reinstalled)` -- reinstall cascade row. Carries `dependencies` (SNM-06);
 * no `reasons`.
 */
export interface PluginReinstalledMessage extends TransitionMessageBase {
  readonly status: "reinstalled";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(uninstalled)` -- single-shot uninstall or cascade uninstall row. NO
 * `dependencies` (MSG-SD-3 forbids the soft-dep marker on uninstalled
 * rows); no `reasons`.
 */
export interface PluginUninstalledMessage extends TransitionMessageBase {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(disabled)` -- D-54-01 / ENBL-04 closed-set token. Emitted on `list` /
 * `info` surfaces for plugins whose state record carries the
 * empty-resources + `installable: true` marker (the load-bearing predicate is
 * `orchestrators/reconcile/plan.ts::isRecordedButDisabled`), AND -- per the
 * UAT-03 decision -- as the `/claude:plugin
 * disable` command's fresh cascade row (byte-identical to the inventory row).
 * RLD-05 / D-07: the reload-hint is driven by the caller-stamped `needsReload`
 * -- the fresh-disable transition stamps `true`, the list / info inventory row
 * stamps `false` -- so the row's reload behavior no longer depends on a cascade
 * kind. Structurally
 * distinct from `(unavailable)`: the variant carries no `reasons` (a disabled
 * plugin is in the user-requested state, not a failure state), and the byte
 * form differs (`(disabled)` vs `(unavailable)`).
 *
 * NO `dependencies` / `reasons` / `cause` / `rollbackPartial` by construction
 * -- the inventory row is bare. The renderer arm uses `ICON_DISABLED`
 * (`◍`) -- the same glyph the `will disable` row uses. PL-4: optional
 * `description` rendered as a second 4-space-indented line, truncated at
 * column 66 (same as the other list-surface inventory variants).
 */
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}

/**
 * `(available)` -- list-surface row for installable, not-yet-installed
 * plugins. NO `scope` (SNM-11 carve-out: MSG-PL-6 omits `[<scope>]`
 * brackets on available rows); no `reasons`; no `dependencies`. PL-4:
 * optional `description` rendered as a second 4-space-indented line,
 * truncated at column 66.
 */
export interface PluginAvailableMessage extends MessageBase {
  readonly status: "available";
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
}

/**
 * `(remote)` -- list/info-surface row for a not-installed git-source plugin
 * whose clone/mirror is not yet materialized locally (RSTA-01 / D-80-03).
 * Replaces the manifest-only `(available)` over-claim for unfetched git
 * sources. Modeled on `PluginAvailableMessage`: bare row -- NO `scope`
 * (SNM-11 carve-out family, joining `available | partially-available |
 * unavailable`); NO `reasons` (the REASONS closed set does not grow for this
 * row -- parity with `available`); NO `dependencies`. Uses the dedicated
 * `ICON_REMOTE` (`◌`) glyph. PL-4: optional `description` rendered as a second
 * 4-space-indented line, truncated at column 66.
 */
export interface PluginRemoteMessage extends MessageBase {
  readonly status: "remote";
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
export interface PluginUnavailableMessage extends MessageBase {
  readonly status: "unavailable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly description?: string;
  // SEV-02 / D-69-03: set on the install-failure surface when the resolver
  // verdict is `partially-available`. The renderer appends a
  // 4-space-indented `--partial` hint trailer below the row pointing the user
  // at the flag that can degrade-install the plugin. Absent on the
  // structural `unavailable` arm (`--partial` cannot help) and on every list /
  // inventory surface, which render byte-frozen.
  readonly partialHint?: boolean;
}

/**
 * `(partially-available)` -- row for a not-installed, partially-available plugin
 * (USTAT-01 / D-64-01 / XSURF-01). The manifest is structurally sound but
 * carries components Pi cannot install (lsp / hooks / unsupported source), so
 * the plugin would degrade-install under `--partial`. Mirrors
 * `PluginUnavailableMessage` (carries REQUIRED `reasons`; NO `scope` (SNM-11);
 * no `dependencies`; PL-4 optional `description`). The list / info inventory
 * rows OMIT `partialHint` and render byte-frozen with no `--partial` trailer; the
 * install-failure surface (XSURF-01) sets `partialHint: true` so the renderer
 * appends the SEV-02 `--partial` hint trailer. Uses the dedicated
 * `ICON_PARTIALLY_AVAILABLE` (`⊖`) glyph. `extends MessageBase` (optional severity,
 * defaults to info -- this is a token rename, not a severity change).
 */
export interface PluginPartiallyAvailableMessage extends MessageBase {
  readonly status: "partially-available";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly description?: string;
  // SEV-02 / XSURF-01: set on the install-failure surface when the resolver
  // verdict is `partially-available`. The renderer appends a
  // 4-space-indented `--partial` hint trailer below the row. Absent on every
  // list / info inventory surface, which render byte-frozen.
  readonly partialHint?: boolean;
}

/**
 * `(upgradable)` -- list-surface row for installed plugins with a newer
 * version available upstream. STRUCTURALLY constrained to the list surface
 * per MSG-PL-4 / CMC-09 (never emitted on cascade rows). Carries REQUIRED
 * `reasons`; no `dependencies`. PL-4: optional `description` rendered as
 * a second 4-space-indented line, truncated at column 66.
 */
export interface PluginUpgradableMessage extends MessageBase {
  readonly status: "upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}

/**
 * `(partially-installed)` -- FSTAT-02 / D-66-03 row for a recorded-installed plugin
 * that currently re-resolves `partially-available` (installed with components dropped).
 * Surfaces on the list inventory surface AND the install/update success cascade.
 * Modeled on `PluginUpgradableMessage`: carries REQUIRED `reasons` (the dropped-
 * component / degradation detail). Uses the dedicated `ICON_PARTIALLY_INSTALLED`
 * (`◉`) glyph. PL-4: optional `description` on the list surface, truncated at
 * column 66.
 *
 * WR-03: optional `dependencies?: readonly Dependency[]`. The partially-available
 * `partially-available` resolver arm still materializes the SUPPORTED components, so a
 * partially-installed plugin can legitimately stage agents / mcp servers. When the
 * install/update success cascade builds this row it threads the staged
 * dependencies so the `{requires pi-subagents}` / `{requires pi-mcp}` soft-dep
 * markers fire on a degraded install exactly as on a clean `(installed)` row --
 * the signal is most relevant precisely on a degraded install. The
 * list/info INVENTORY partial rows OMIT `dependencies` (the inventory surface
 * carries no soft-dep markers), so they render unchanged.
 */
export interface PluginPartiallyInstalledMessage extends MessageBase {
  readonly status: "partially-installed";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly dependencies?: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
}

/**
 * `(partially-upgradable)` -- FSTAT-04 / D-66-02 / D-66-03 row for a currently-clean
 * installed plugin whose newer no-network cache candidate would NEWLY degrade
 * it. Emitted on the list inventory surface AND, per XSURF-03, on the manual
 * update-decline surface (a no-`--partial` update of a partially-upgradable plugin
 * declines rather than degrading; the declined row reuses this token to read
 * consistently with `list`). REUSES `ICON_INSTALLED` (`●`) because the row is
 * currently clean, mirroring the `upgradable` arm. Carries REQUIRED `reasons`;
 * no `dependencies`. The list inventory row OMITS `partialHint` and renders
 * byte-frozen; the update-decline row sets `partialHint: true` (and carries the
 * pre-update version) so the renderer appends the update-worded `--partial` hint
 * trailer. PL-4: optional `description`, truncated at column 66.
 */
export interface PluginPartiallyUpgradableMessage extends MessageBase {
  readonly status: "partially-upgradable";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  // SEV-04 / XSURF-03: set on the manual update-decline surface. The renderer
  // appends a 4-space-indented update-worded `--partial` hint trailer below the
  // row. Absent on the list inventory row, which renders byte-frozen.
  readonly partialHint?: boolean;
}

/**
 * `(failed)` -- failure row across single-shot and cascade surfaces.
 * Carries REQUIRED `reasons`; optional `cause?: Error` (SNM-10)
 * feeds the depth-5 cause-chain trailer; optional
 * `rollbackPartial?: readonly { phase; cause? }[]` (SNM-09) drives the
 * MSG-RP-1 indented child rows when a rollback was partial.
 */
export interface PluginFailedMessage extends MessageBase {
  readonly status: "failed";
  // GATE-01 / SEV-02: a failure row must stamp an error-bearing severity --
  // narrowed from the optional `MessageBase.severity` to REQUIRED `"error" |
  // "warning"`, so a `failed` row that omits it (or stamps `info`) is a compile
  // error at the construction site rather than defaulting to info (rank 0).
  readonly severity: "error" | "warning";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
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
 * encountering an already-up-to-date plugin). Carries REQUIRED `reasons`;
 * no `dependencies`; no `cause` (skipped is not a failure -- SNM-10
 * confines `cause` to failed / manual recovery).
 */
export interface PluginSkippedMessage extends MessageBase {
  readonly status: "skipped";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
}

/**
 * `(manual recovery)` -- per-plugin manual-recovery anchor row (MSG-MR-1).
 * Status discriminator is the literal string `"manual recovery"` WITH A
 * SPACE. Carries REQUIRED `reasons` and optional `cause?: Error` (SNM-10); no
 * `dependencies`; no `rollbackPartial` (only `failed` carries it per SNM-09).
 */
export interface PluginManualRecoveryMessage extends MessageBase {
  readonly status: "manual recovery";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly cause?: Error;
}

/**
 * `(will install)` -- DIFF-02 pending-list row for a plugin declared in config but
 * not yet recorded. Carries NO `dependencies` (the soft-dep probe is
 * meaningless before installation); NO `reasons`; NO `version` (the recorded
 * version does not exist yet for an install).
 */
export interface PluginWillInstallMessage extends MessageBase {
  readonly status: "will install";
  readonly name: string;
  readonly scope?: Scope;
  // FSTAT-06 / D-66-04: render-time modifier. When `true`, the row renders
  // `(will partially install)` -- the planned install would degrade (resolves
  // `partially-available`) and proceed under the partial path -- instead of
  // `(will install)`. A modifier, NOT a new closed-set token (D-66-05): the
  // `will partial update` analog is VACUOUS (the reconcile plan has no update
  // bucket), so no partial-update render path exists.
  readonly partial?: boolean;
}

/**
 * `(will uninstall)` -- DIFF-02 pending-list row for a plugin recorded in state
 * but no longer declared. Carries NO `reasons`; NO `version`; NO
 * `dependencies`.
 */
export interface PluginWillUninstallMessage extends MessageBase {
  readonly status: "will uninstall";
  readonly name: string;
  readonly scope?: Scope;
}

/**
 * `(will enable)` -- DIFF-02 pending-list row for a recorded plugin currently
 * marked disabled but newly declared `enabled: true`. The bucket is
 * populated only when the recorded-but-disabled marker (all four resource
 * arrays empty + `installable: true` -- see
 * `orchestrators/reconcile/plan.ts::isRecordedButDisabled`) is paired
 * with a config entry whose `enabled !== false`.
 */
export interface PluginWillEnableMessage extends MessageBase {
  readonly status: "will enable";
  readonly name: string;
  readonly scope?: Scope;
}

/**
 * `(will disable)` -- DIFF-02 pending-list row for a recorded plugin newly
 * declared `enabled: false`. Carries NO `reasons`; NO `version`; NO
 * `dependencies`.
 */
export interface PluginWillDisableMessage extends MessageBase {
  readonly status: "will disable";
  readonly name: string;
  readonly scope?: Scope;
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
  | PluginRemoteMessage
  | PluginUnavailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUpgradableMessage
  | PluginFailedMessage
  | PluginSkippedMessage
  | PluginManualRecoveryMessage
  | PluginWillInstallMessage
  | PluginWillUninstallMessage
  | PluginWillEnableMessage
  | PluginWillDisableMessage
  | PluginDisabledMessage
  | PluginPartiallyInstalledMessage
  | PluginPartiallyUpgradableMessage;

/**
 * Common fields shared by every arm of the per-status
 * `MarketplaceNotificationMessage` discriminated union (SNM-02 / TYPE-04 /
 * D-46-03).
 *
 * `plugins: readonly PluginNotificationMessage[]` is REQUIRED. An empty
 * array IS the structural representation of the `(no plugins)` rendering
 * on the list surface; on state-change paths an empty `plugins` array is the
 * normal case (renderer emits the marketplace header alone). No separate
 * `noPlugins` discriminator field.
 */
interface MpCommon extends MessageBase {
  readonly name: string;
  readonly scope: Scope;
  readonly plugins: readonly PluginNotificationMessage[];
}

/** `(added)` marketplace block. */
interface MpAdded extends MpCommon {
  readonly status: "added";
}

/** `(removed)` marketplace block. */
interface MpRemoved extends MpCommon {
  readonly status: "removed";
}

/** `(updated)` marketplace block. */
interface MpUpdated extends MpCommon {
  readonly status: "updated";
}

/**
 * `(failed)` marketplace block. Carries OPTIONAL mp-level `reasons?`
 * (D-48-A): a marketplace-op precondition failure with NO plugin child rows
 * (e.g. `marketplace add` duplicate-name / unsupported-source) renders its
 * closed-set reason on the marketplace subject. `reasons?` is
 * `readonly ContentReason[]` so the structural `"not added"` marker stays
 * unrepresentable here (TYPE-02) -- that condition is the dedicated
 * `MarketplaceNotAddedMessage` variant. When omitted/empty the brace
 * collapses (composeReasons returns ""), preserving the bare
 * `${ICON_UNINSTALLABLE} ${name} [${scope}] (failed)` byte form for the
 * existing update/autoupdate mp-failure states that ride the cause on a child
 * row.
 */
interface MpFailed extends MpCommon {
  readonly status: "failed";
  // GATE-01 / SEV-02: a marketplace failure row must stamp an error-bearing
  // severity -- narrowed from the optional `MessageBase.severity` to REQUIRED
  // `"error" | "warning"` so an omitted (or `info`) stamp is a compile error.
  readonly severity: "error" | "warning";
  readonly reasons?: readonly ContentReason[];
}

/** `<autoupdate>` fresh-flip block (UXG-04). Never carries `reasons`. */
interface MpAutoupdateEnabled extends MpCommon {
  readonly status: "autoupdate enabled";
}

/** `<no autoupdate>` fresh-flip block (UXG-04). Never carries `reasons`. */
interface MpAutoupdateDisabled extends MpCommon {
  readonly status: "autoupdate disabled";
}

/**
 * `(skipped)` marketplace block. `reasons?` is reachable ONLY on this arm
 * (TYPE-04): the `"skipped"` mp-status renderer arm composes the
 * `{<reason>, <reason>}` brace (e.g. `{already autoupdate}` for idempotent
 * autoupdate flips, `{up-to-date}` for the `marketplace update` no-op). The
 * skip's severity is caller-stamped (SEV-01): a benign idempotent skip stamps
 * `info`, an actionable skip `warning`; a missing reason set routes to the
 * `warning` safe default at the producer.
 */
interface MpSkipped extends MpCommon {
  readonly status: "skipped";
  readonly reasons?: readonly ContentReason[];
}

/**
 * List / inventory marketplace block (status omitted). Modeled as
 * `status?: undefined` so the many status-omitted construction sites compile
 * unchanged and the renderer's `case undefined:` narrows to this arm.
 * `details?` is reachable ONLY on this arm (TYPE-04): the list surface
 * composes the `<autoupdate>` marker from `details.autoupdate`.
 */
interface MpList extends MpCommon {
  readonly status?: undefined;
  readonly details?: MarketplaceDetails;
}

/**
 * Marketplace-level notification message (SNM-02), a per-status discriminated
 * union (TYPE-04 / D-46-03). One arm per `MarketplaceStatus` plus a
 * list/inventory arm (status omitted). The renderer's status switch narrows
 * to exactly one arm per `case` with an `assertNever` tail -- adding a
 * marketplace status becomes a compile error at every construction site and
 * renderer case. `reasons` is reachable only on the `skipped` arm; `details`
 * only on the list arm; the `failed` arm carries neither (D-46-03a).
 */
export type MarketplaceNotificationMessage =
  | MpAdded
  | MpRemoved
  | MpUpdated
  | MpFailed
  | MpAutoupdateEnabled
  | MpAutoupdateDisabled
  | MpSkipped
  | MpList;

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
 * `kind?` is OPTIONAL on the cascade variant so call sites that construct
 * `{ marketplaces: [...] }` type-check without supplying `kind`. The
 * `notify()` dispatcher narrows via `message.kind ?? "cascade"` so the
 * absence of `kind` routes through the cascade arm unambiguously. The
 * info-surface variants (`MarketplaceInfoMessage`, `PluginInfoMessage`)
 * carry a REQUIRED `kind` literal so they cannot be confused with a cascade
 * payload at construction time.
 *
 * RLD-05 / D-07: the `/claude:plugin disable` command's realized-transition
 * cascade no longer needs a distinguishing kind. The fresh `(disabled)` row
 * stamps `needsReload: true` directly, while the list / info inventory
 * `(disabled)` rows stamp `needsReload: false`; the RLD-02 OR-reduce reads
 * those per-row facts, so the disable reload-hint is driven by the stamp, not
 * by a kind-level straddle.
 */
export interface CascadeNotificationMessage {
  readonly kind?: "cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  // OUT-04 / D-04: the command's human operation name (`CommandContext.
  // Messaging.label`, e.g. `Plugin install`) used as the trailing tally's
  // `<Operation>` prefix. Threaded from `notifyWithContext`; the tally only
  // renders when `cardinality === "plural"`, so this is unread on single-target
  // and legacy emissions.
  readonly label?: string;
  // OUT-07 / D-04: the STRUCTURAL single-vs-bulk cardinality, set at the call
  // site (a single-target op constructs the 1-tuple `single`; a bulk /
  // @marketplace / import / reconcile op constructs the `plural` array). The
  // trailing tally renders IFF `cardinality === "plural"` -- NOT a render-time
  // row-count heuristic. Absent defaults to no tally.
  readonly cardinality?: "single" | "plural";
  // UGRM-02 / OUT-03 / D-04: an OPT-IN, update-scoped override of the trailing
  // tally's SUCCESS category. When present, `composeTally` renders the success
  // count as `<count> <verb>` (e.g. `2 updated`) instead of deriving it from the
  // info-severity row count, so the `update` headline reports realized
  // transitions only. The failure / warning categories are unchanged (still
  // computed from `countRowsBySeverity`). Absent on every other op
  // (install / reinstall / marketplace / import), so their summaries stay
  // byte-identical. Read ONLY by `composeTally`. A `count` of 0 contributes no
  // success category (the never-silent no-op headline is the orchestrator's job,
  // not `composeTally`'s).
  readonly tally?: { readonly verb: string; readonly count: number };
}

/**
 * INFO-01 / INFO-04: top-level info-surface variant emitted by the
 * `/claude:plugin marketplace info <name>` command. Carries the marketplace
 * identifier (`name`, `scope`), the persisted `MarketplaceDetails` for the
 * `<autoupdate>` / `<no autoupdate>` marker AND for the `last_updated:`
 * ISO8601 line (read from `details.lastUpdatedAt` -- single source of
 * truth), the source-kind detail (`github: <owner>/<repo>[#<ref>]`,
 * `url: <url>[#<ref>]`, or `path: <abs-path>`), and optional `description`
 * (marketplace.json description, optional) line. The `last_updated:` line
 * renders for all git-backed kinds (github + url), never for path (D-76-10).
 *
 * The marketplace-absent (`{not added}`) condition is NOT emitted by this
 * variant -- it is the dedicated `MarketplaceNotAddedMessage` variant
 * (TYPE-01 / D-46-01). This variant can only carry a found marketplace.
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
    // MURL-05 / D-76-09: url sources project a kind-labeled `url:` line.
    | { readonly sourceKind: "url"; readonly url: string; readonly ref?: string }
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
 * The marketplace-absent condition is NOT carried by this variant -- it is
 * the dedicated `MarketplaceNotAddedMessage` variant (TYPE-01). This variant's
 * `plugin.reasons` is a `readonly ContentReason[]` (TYPE-02): the structural
 * `"not added"` marker can never appear on it.
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
 * `reasons?: readonly ContentReason[]` is populated when `status` is
 * `"unavailable"` or `"failed"` (e.g., `["not in manifest"]` for an unknown
 * plugin, `["unreadable manifest"]` for a manifest read failure). The
 * structural `"not added"` marker is NOT a `ContentReason` (TYPE-02): the
 * marketplace-absent condition is carried by the dedicated
 * `MarketplaceNotAddedMessage` variant, never by this row field.
 */
interface PluginInfoRowBase {
  // FSTAT-07 / D-66-04: `partially-installed` widens the info row status set so an
  // installed plugin re-resolving `partially-available` reports `(partially-installed)` on
  // the info surface. `partially-upgradable` is deliberately omitted -- it is a
  // list-inventory-only concept (an installed plugin's info is partially-installed
  // or installed, never partially-upgradable).
  readonly status: Extract<
    PluginStatus,
    | "installed"
    | "available"
    // RSTA-01: the info surface renders `(remote)` for an unfetched git source.
    | "remote"
    | "unavailable"
    | "partially-available"
    | "failed"
    | "partially-installed"
  >;
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
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
    readonly hooks?: readonly HookSummaryEntry[];
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
 * failure can be expressed on a fan-out payload -- the marketplace-absent
 * (`{not added}`) failure surface is carried by the dedicated
 * `MarketplaceNotAddedMessage` variant, TYPE-01).
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
 * DIFF-01 SC #2 / D-53-01: the dedicated empty-steady-state
 * variant emitted by `/claude:plugin pending` when the next reload's
 * reconcile would apply zero actions in every scope (no marketplaces /
 * plugins / source-mismatches / invalid-config rows). Routes through the
 * standalone-dispatched arm of `notify()` with severity `info` (no second
 * arg) and emits the catalog-locked free-form advisory body line:
 *
 *   Pending: next reload will apply 0 actions.
 *
 * Carries NO fields -- the body is a hard-coded literal in
 * `renderReconcilePendingEmpty` so the byte form cannot drift from the
 * catalog state. `shouldEmitReloadHint` is structurally false on this arm
 * (pending rows are pre-transition; `/reload to pick up changes` is
 * grammatically false). `buildSummaryLine` returns the empty string
 * (info-severity -- no summary semantics apply).
 */
export interface ReconcilePendingEmptyMessage {
  readonly kind: "reconcile-pending-empty";
}

/**
 * TYPE-01 / D-46-01: the dedicated marketplace-not-added variant -- the 6th
 * arm of `NotificationMessage`. Carries ONLY the fields its row renders:
 * `name` (the MARKETPLACE name) and an optional `scope` (`scope` present =>
 * `[scope]` bracket; absent => no bracket). It has NO placeholder
 * `marketplaceScope` / `marketplaceDetails` fields and NO `reasons` field --
 * the structural `{not added}` brace is hard-coded by `renderMarketplaceNotAdded`.
 *
 * Renders byte-identical to the former `renderPluginInfo` `{not added}`
 * carve-out (D-46-01a): a bare column-0 row
 * `⊘ <name> [scope?] (failed) {not added}` at severity `"error"`. The info
 * construction sites build it in this phase; install / uninstall / reinstall /
 * update reuse the SAME variant in later phases (no re-cut).
 */
export interface MarketplaceNotAddedMessage {
  readonly kind: "marketplace-not-added";
  readonly name: string;
  readonly scope?: Scope;
}

/**
 * RECON-04: the load-time reconcile apply cascade variant
 * emitted by `applyReconcile` after every resources_discover invocation that
 * resulted in at least one apply action OR carried at least one
 * invalid-config / source-mismatch row. Wraps the same per-status
 * `MarketplaceNotificationMessage[]` shape the cascade arm carries so the
 * existing `renderMpHeader` + `renderPluginRow` helpers compose the body --
 * no new icon, no new closed-set status / reason / marker literals (reuse
 * the existing closed sets).
 *
 * Dispatched as a StandaloneKind so `shouldEmitReloadHint` returns `false`
 * structurally: the cascade rows carry realized transition tokens
 * (`installed` / `uninstalled` / etc.) which would otherwise trigger the
 * `Run /reload to pick up changes` trailer -- but the reconcile already ran
 * ON /reload, so the trailer would be a lie (RECON-04).
 *
 * `computeSeverity` derives severity from contents (mirrors the cascade
 * arm's first-match ladder); `buildSummaryLine` runs only at error/warning
 * severity and reuses `countFailedOperations` / `countSkippedOperations`
 * over `marketplaces`.
 *
 * Empty-and-clean callers MUST short-circuit BEFORE invoking notify() per
 * the load-time silence contract (NFR-2 / A4) -- this variant is never
 * dispatched with an empty `marketplaces` array.
 */
export interface ReconcileAppliedCascadeMessage {
  readonly kind: "reconcile-applied-cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  // OUT-04 / OUT-06 / D-03 / D-04: the operation label + structural cardinality
  // for the trailing tally, threaded from `notifyReconcileAppliedWithContext`.
  // A load-time reconcile cascade is mixed-subject (plugin + marketplace rows);
  // the tally uses the operation `label` and counts all rows uniformly.
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
}

/**
 * Top-level discriminated-union envelope consumed by `notify(ctx, pi,
 * NotificationMessage)`. The cascade arm omits `kind` (or sets it to
 * `"cascade"`); the six standalone-dispatched arms set `kind` explicitly. The
 * dispatcher narrows with an `assertNever` default arm so every future
 * variant addition becomes a compile-time error at the switch.
 */
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage
  | MarketplaceInfoCascadeMessage
  | PluginInfoCascadeMessage
  | MarketplaceNotAddedMessage
  | ReconcilePendingEmptyMessage
  | ReconcileAppliedCascadeMessage;

/**
 * TYPE-03 / D-46-04: the closed set of STANDALONE-DISPATCHED message kinds --
 * the 4 read-only info surfaces (`marketplace-info`, `plugin-info`,
 * `marketplace-info-cascade`, `plugin-info-cascade`) PLUS the
 * `marketplace-not-added` failure variant. Enumerated in EXACTLY ONE place so
 * that adding a future standalone kind is a single-site edit here that
 * surfaces as a compile error in every consumer's `assertNever` tail.
 *
 * The guard name is kept as `isInfoKind` per the TYPE-03 wording even though
 * the set now includes a failure kind; "standalone-dispatched" is the precise
 * meaning -- these kinds are routed through `dispatchInfoMessage` and never
 * carry a cascade summary line or reload-hint trailer.
 */
type StandaloneKind =
  | "marketplace-info"
  | "plugin-info"
  | "marketplace-info-cascade"
  | "plugin-info-cascade"
  | "marketplace-not-added"
  | "reconcile-pending-empty"
  | "reconcile-applied-cascade";

/**
 * Single-source type-predicate for the standalone-dispatched kinds
 * (TYPE-03 / D-46-04). All four consumers (`computeSeverity`,
 * `buildSummaryLine`, `shouldEmitReloadHint`, the `notify()` early-dispatch)
 * route through this one guard; each then narrows the residual to
 * `CascadeNotificationMessage` and closes with `assertNever`.
 */
function isInfoKind(
  m: NotificationMessage,
): m is Extract<NotificationMessage, { kind: StandaloneKind }> {
  return (
    m.kind === "marketplace-info" ||
    m.kind === "plugin-info" ||
    m.kind === "marketplace-info-cascade" ||
    m.kind === "plugin-info-cascade" ||
    m.kind === "marketplace-not-added" ||
    m.kind === "reconcile-pending-empty" ||
    m.kind === "reconcile-applied-cascade"
  );
}

// ---------------------------------------------------------------------------
// Grammar rendering helpers -- file-private.
//
// SNM-17 / SNM-18 contract: the marketplace-header grammar and per-status
// icon discipline live HERE as the sole site that knows them.
// `renderMpHeader` + `renderPluginRow` compose into the public `notify`
// entry point.
// ---------------------------------------------------------------------------

/**
 * Grammar icon literals.
 *
 * D-11: the shared presentation vocabulary stays central in this file;
 * `export` only widens visibility so sibling command modules can CALL these
 * glyphs from their own render maps without redeclaring them.
 */
export const ICON_INSTALLED = "●";
export const ICON_AVAILABLE = "○";
export const ICON_UNINSTALLABLE = "⊘";
/**
 * D-54-01 / ENBL-04: dedicated glyph for the deliberate, user-requested
 * disabled-class rows -- `(disabled)` (realized inventory) and
 * `(will disable)` (pending-tense). Distinct from `ICON_UNINSTALLABLE`
 * (`⊘`), which marks the error / blocked-state rows
 * (`(unavailable)`, `(failed)`, `(skipped) {already disabled}`,
 * `(manual recovery)`). Mirrors the realized + pending-tense precedent
 * already in the grammar (`●` for `(installed)` / `(will install)`,
 * `○` for `(available)` / `(will uninstall)`).
 *
 * D-80-01: uses `◍` (U+25CD, circle with vertical fill). The `◌` (U+25CC,
 * dotted circle) it previously carried was reassigned to `ICON_REMOTE`.
 */
export const ICON_DISABLED = "◍";

/**
 * RSTA-02 / D-80-01: dedicated glyph (`◌` U+25CC, dotted circle) for the
 * `(remote)` row -- a not-installed git-source plugin whose clone/mirror is not
 * yet materialized locally. The dotted circle reads "declared but not
 * present". Reassigned from `ICON_DISABLED`, which now uses `◍` (U+25CD).
 */
export const ICON_REMOTE = "◌";

/**
 * FSTAT-02 / D-66-03: dedicated glyph for a `partially-installed` row -- a
 * recorded-installed plugin that currently re-resolves `partially-available` (installed
 * with one or more components dropped). DISTINCT from `ICON_INSTALLED` (`●`) so
 * the degraded install is visually separable from a clean `(installed)` row.
 * `partially-upgradable` deliberately REUSES `ICON_INSTALLED` (the row is currently
 * clean -- only its candidate would degrade), mirroring the `upgradable`
 * precedent.
 */
export const ICON_PARTIALLY_INSTALLED = "◉";

/**
 * USTAT-02 / D-64-01: dedicated glyph for a not-installed, partially-available
 * `partially-available` row (`⊖` U+2296, circled minus) -- a plugin whose manifest is
 * sound but carries components Pi cannot install (lsp / hooks / unsupported
 * source), so it would degrade-install under `--partial`. Stays in the circled-
 * operator family with `ICON_UNINSTALLABLE` (`⊘`) but reads "diminished /
 * components dropped" rather than "blocked". DISTINCT from `⊘`
 * (`ICON_UNINSTALLABLE`, reserved for unavailable / blocked / failed / manual-
 * recovery) and from `◉` (`ICON_PARTIALLY_INSTALLED`, the *installed*-degraded row).
 */
export const ICON_PARTIALLY_AVAILABLE = "⊖";

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
 * INFO-02 hard-wrap helper. Splits `text` on whitespace (`/\s+/`), filters
 * empty tokens, greedy-accumulates words into lines whose TEXT length (not
 * counting the indent) does not exceed `wrapCol`, then prepends `indentCol`
 * spaces to each emitted line. Returns an array of indented lines so the
 * caller composes the final body via `.join("\n")`.
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
 * `wrapCol` is the TEXT width, NOT the total line width. Mirrors the
 * `DESCRIPTION_MAX_COLS = 66` / 4-space-indent convention used by
 * `truncateDescription` (INFO-02 catalog spec: col 4 indent / 66-col text
 * width).
 *
 * File-private; sole caller is `renderPluginInfo`. Do NOT export --
 * exporting would let other modules drift from the catalog byte contract.
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
 * No marketplace arm renders ICON_AVAILABLE (○): every arm is either ok (●)
 * or failure-class (⊘). Marketplace add/remove are immediate (WILL-01 /
 * D-65.1-02 / D-65.1-03), so they carry no marketplace-level pending token --
 * a remove's reload-deferred plugin-uninstall cascade renders as ○ PLUGIN
 * `will uninstall` child rows under a bare (●) header. The open-circle uses
 * are the available / uninstalled / will-uninstall PLUGIN rows that
 * `renderPluginRow` owns.
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
    case "failed": {
      // D-48-A: append the closed-set reason brace iff `mp.reasons` is present
      // and non-empty (marketplace-op precondition failure with no plugin child
      // rows, e.g. `marketplace add`). Pass (false, false) for the soft-dep
      // declares-flags -- mp-level rows never emit soft-dep markers (mirrors the
      // "skipped" arm). composeReasons returns "" when reasons is
      // undefined/empty, so the existing bare `(failed)` byte form
      // (update/autoupdate mp-failure states that ride the cause on a child row)
      // is preserved unchanged.
      const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
      return reasonsBrace === ""
        ? `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed)`
        : `${ICON_UNINSTALLABLE} ${mp.name} [${mp.scope}] (failed) ${reasonsBrace}`;
    }

    case "autoupdate enabled":
      // UXG-04 / D-18-05: fresh autoupdate-on flip renders the `<autoupdate>`
      // marker as the outcome (byte-form parity with the `marketplace list`
      // surface). Does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate>`;
    case "autoupdate disabled":
      // UXG-04: fresh autoupdate-off flip renders the explicit `<no autoupdate>`
      // off-marker (`<no autoupdate>` is a MARKERS member). Does NOT carry
      // mp.reasons.
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
      // List-surface case. mp.details is OPTIONAL and INDEPENDENT of mp.status.
      // Guard explicitly with an early return for SUB-BRANCH A
      // (mp.details === undefined) so the SUB-BRANCH B composition below reads
      // narrowed (non-optional) mp.details.autoupdate under TS strict.
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
      // Per-status discriminated union (TYPE-04): every arm is handled above,
      // so `mp` narrows to `never` here -- pass the value itself rather than
      // `mp.status` (which would be an access on `never`).
      assertNever(mp);
      return "";
    }
  }
}

// ---------------------------------------------------------------------------
// File-private renderPluginRow + supporting helpers.
//
// MOD-03 / D-02 / D-10: this central switch is NO LONGER the per-row dispatch
// path for any command's cascade rows. Every state-change producer routes its
// rows through `notifyWithContext` / `notifyReconcileAppliedWithContext`, which
// dispatch each per-plugin body via the command's OWN `context.render[status]`
// map (`emitContextCascade` / `emitReconcileAppliedContextCascade`). A missing
// or extra arm is now a per-command compile error, not a central concern.
// This switch survives only as a STATICALLY-REFERENCED seam on the central
// envelope: the legacy `notify(ctx, pi, message)` cascade arm (reached today
// only by the `{ marketplaces: [] }` empty sentinel, which short-circuits to
// `(no marketplaces)` before the plugin loop runs) and the
// `composeReconcileAppliedBody` arm of `dispatchInfoMessage` (kept for the
// `reconcile-applied-cascade` StandaloneKind exhaustiveness; its live emitter
// goes through `emitReconcileAppliedContextCascade`, not this body). Removing
// it would either break that exhaustiveness switch or require rewriting the
// legacy envelope the deferred-central standalone surfaces still depend on, so
// it stays until those surfaces relocate.
//
// SNM-16: soft-dep markers are injected at render time from the per-row
// `dependencies?` declaration + the threaded `SoftDepStatus` probe. The
// switch ends with the hardened shape `default: { assertNever(p);
// return ""; }` so a future `PluginNotificationMessage` variant becomes a
// compile error at this switch (the typecheck relies on `assertNever`'s
// throw at runtime, not on its `never` return type via a value-returning
// expression).
// ---------------------------------------------------------------------------

/**
 * Join tokens with single spaces, suppressing empty slots so absent
 * optional tokens (e.g. an undefined scope-bracket on `available` rows)
 * never produce a double-space. Single canonical implementation.
 */
// D-11: the row-composition primitives below (joinTokens, renderScopeBracket,
// renderVersion, composeVersionArrow, composeReasons, pluginRow) stay declared
// HERE as the single source of the byte-stable presentation vocabulary; the
// `export` keyword only widens their visibility so sibling command render maps
// can CALL them without duplicating the brace/space/join logic.
export function joinTokens(parts: readonly string[]): string {
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
 * Anchored-exact predicate for a persisted git-source `sha-<12hex>` version
 * string. Matches EXACTLY `sha-` + 12 lowercase-hex chars -- the shape
 * produced by `domain/version.ts::shaVersion`. Local to the renderer tier
 * (shared/ must not import domain/), mirroring `looksLikeHashVersion` above.
 */
const SHA_VERSION_DISPLAY_RE = /^sha-[0-9a-f]{12}$/;
function looksLikeShaVersion(v: string): boolean {
  return SHA_VERSION_DISPLAY_RE.test(v);
}

/**
 * D-77-01 / PURL-09: render a persisted git-source `sha-<12hex>` version to the
 * same compact git-style short SHA as the hash-version arm: `sha-2ea95f857031`
 * -> `#2ea95f8` (the `sha-` prefix stripped, the first 7 of the 12 hex chars
 * kept). Returns WITHOUT the `v` prefix -- `renderVersion` prepends it, yielding
 * `v#2ea95f8`. A non-sha string passes through UNCHANGED so hash-versions and
 * SemVer are untouched. Renderer-only: persistence stays `sha-<12hex>`.
 */
function formatShaVersionForDisplay(v: string): string {
  if (!looksLikeShaVersion(v)) {
    return v;
  }

  return `#${v.slice("sha-".length, "sha-".length + 7)}`;
}

/**
 * Prepend `v` to the version string, returning `""` when `version` is
 * undefined or empty so the join discipline collapses the slot cleanly.
 * Routes the token through `formatHashVersionForDisplay` then
 * `formatShaVersionForDisplay` so a persisted PI-7 `hash-<12hex>` OR a
 * git-source `sha-<12hex>` (D-77-01 / PURL-09) renders as `v#<7hex>`, while a
 * SemVer passes through to `v<version>` (SNM-35). Each formatter is a no-op on
 * a string the other owns, so the order is irrelevant. Single canonical
 * implementation.
 */
export function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${formatShaVersionForDisplay(formatHashVersionForDisplay(version))}`;
}

/**
 * Conditional `[<pluginScope>]` emitter -- orphan-fold contract.
 * SOLE site for plugin-row scope-bracket emission inside
 * `renderPluginRow`: per-arm code MUST funnel `p.scope` (or `undefined` for
 * the MSG-PL-6 / SNM-11 carve-out variants) AND the parent marketplace scope
 * through this helper.
 *
 * The bracket emits ONLY when `pluginScope !== undefined AND
 * pluginScope !== mpScope` -- the orphan-fold case. When the
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
export function renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string {
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
export function composeVersionArrow(from: string, to: string): string {
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
export function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string {
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];
  composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe));

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
 * NOT rendered here (`notify` composes them as additional
 * indented lines AFTER the row):
 *  - `failed.cause` / `manual recovery.cause` cause-chain trailers.
 *  - `failed.rollbackPartial[]` child rows.
 */
/**
 * Compose a scope-bearing, reasons-bearing plugin row that carries NO
 * soft-dep marker. Folds the four structurally-identical `renderPluginRow`
 * arms (`upgradable` / `skipped` / `failed` / `manual recovery`) that differ
 * only in their icon and their parenthesized status `label`. `label` is the
 * FULL parenthesized token (the caller passes `"(upgradable)"` etc., INCLUDING
 * the parens, so the `"(manual recovery)"` literal keeps its space verbatim).
 * The `p` param is the structural subset those four variants share: a required
 * `name`, an optional `scope` / `version`, and a required
 * `readonly ContentReason[]` reasons. Both declares-flags are `false` (these
 * arms never carry `dependencies`).
 */
export function pluginRow(
  icon: string,
  p: {
    readonly name: string;
    readonly scope?: Scope;
    readonly version?: string;
    readonly reasons: readonly ContentReason[];
  },
  mpScope: Scope,
  label: string,
  probe: SoftDepStatus,
): string {
  return joinTokens([
    icon,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    label,
    composeReasons(p.reasons, false, false, probe),
  ]);
}

/**
 * WR-03: SOLE composition site for the `(partially-installed)` row -- shared by the
 * central `renderPluginRow` switch AND the install / update command-local
 * render maps, so the bytes stay identical across surfaces (D-11 "call, never
 * duplicate"). Uses the dedicated `ICON_PARTIALLY_INSTALLED` (`◉`) glyph; the
 * reasons brace carries the dropped-component detail. Unlike `pluginRow` it
 * threads the optional `dependencies` so the `{requires pi-subagents}` /
 * `{requires pi-mcp}` soft-dep markers compose into the SAME brace AFTER the
 * dropped-component reasons (MSG-GR-4) -- exactly like the `installed` arm. The
 * partially-available arm still stages the SUPPORTED components, so a
 * partial-install/update success row legitimately carries `dependencies` and the
 * marker is most relevant precisely there. The list/info INVENTORY partial rows
 * omit `dependencies`, so the markers never fire (the row renders
 * byte-identically to a bare `(partially-installed)` row).
 */
export function partiallyInstalledRow(
  p: {
    readonly name: string;
    readonly scope?: Scope;
    readonly version?: string;
    readonly reasons: readonly ContentReason[];
    readonly dependencies?: readonly Dependency[];
  },
  mpScope: Scope,
  probe: SoftDepStatus,
): string {
  return joinTokens([
    ICON_PARTIALLY_INSTALLED,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(partially-installed)",
    composeReasons(
      p.reasons,
      p.dependencies?.includes("agents") ?? false,
      p.dependencies?.includes("mcp") ?? false,
      probe,
    ),
  ]);
}

/**
 * WR-03: SOLE composition site for the soft-dep-bearing
 * `installed` / `updated` / `reinstalled` plugin rows. Folds the
 * 7 command-arm copies that each repeated the same
 * `joinTokens([icon, name, scope, versionToken, label,
 * composeReasons(reasons, dependencies.includes("agents"),
 * dependencies.includes("mcp"), probe)])` block, differing ONLY in their
 * version token (`renderVersion(p.version)` vs `composeVersionArrow(p.from,
 * p.to)`), their parenthesized `label`, and whether they thread `p.reasons` or
 * `undefined`. Those three remain caller-supplied so the byte form is verbatim;
 * the `dependencies.includes(...)` soft-dep gate + `composeReasons`
 * composition is owned here (D-11 "call, never duplicate"), keeping every
 * soft-dep arm byte-identical to one another and to the central
 * `renderPluginRow` `installed` arm.
 *
 * `versionToken` is the already-rendered version slot (the caller passes
 * `renderVersion(...)` or `composeVersionArrow(...)`); `reasons` is the optional
 * reason set (the `installed` arm threads `p.reasons`, the reasons-less variants
 * pass `undefined`); `dependencies` drives the `{requires pi-subagents}` /
 * `{requires pi-mcp}` markers via `composeReasons`.
 */
export function installedLikeRow(
  icon: string,
  p: {
    readonly name: string;
    readonly scope?: Scope;
    readonly dependencies: readonly Dependency[];
  },
  mpScope: Scope,
  versionToken: string,
  label: string,
  reasons: readonly ContentReason[] | undefined,
  probe: SoftDepStatus,
): string {
  return joinTokens([
    icon,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    versionToken,
    label,
    composeReasons(
      reasons,
      p.dependencies.includes("agents"),
      p.dependencies.includes("mcp"),
      probe,
    ),
  ]);
}

function renderPluginRow(
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  switch (p.status) {
    // `installed` (cascade transition AND the RLD-04 / D-08 list-surface
    // inventory row) -- SURF-05 / D-63-08 threads the optional `reasons`
    // brace through composeReasons; soft-dep markers append into the SAME
    // brace block per MSG-GR-4 (a plugin with orphan-rewake AND a missing
    // companion extension renders as
    // `(installed) {orphan rewake, requires pi-subagents}`). The list
    // inventory row OMITS `reasons` (the orphan-rewake warning is an
    // install-cascade surface, not a steady-state inventory surface), so it
    // renders byte-identically to a bare `(installed)` row.
    case "installed":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(installed)",
        composeReasons(
          p.reasons,
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
    case "remote":
      // RSTA-01 / D-80-03: not-installed git-source row whose clone/mirror is
      // not materialized locally. Clones the `available` arm, swapping the
      // glyph (`○` -> `◌`) and token (`(available)` -> `(remote)`). SNM-11
      // carve-out: `remote` has NO `scope?` field, so the scope bracket is
      // omitted. Bare row -- NO reasons brace (D-80-03), so the
      // `composeReasons` line is dropped.
      return joinTokens([
        ICON_REMOTE,
        p.name,
        renderScopeBracket(undefined, mpScope),
        renderVersion(p.version),
        "(remote)",
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
    case "partially-available":
      // USTAT-01 / D-64-01: not-installed, partially-available row. Clones the
      // `unavailable` arm, swapping the glyph (`⊘` -> `⊖`) and token
      // (`(unavailable)` -> `(partially-available)`). MSG-PL-6 / SNM-11 carve-out:
      // `partially-available` has NO `scope?` field, so the scope bracket is omitted.
      return joinTokens([
        ICON_PARTIALLY_AVAILABLE,
        p.name,
        renderScopeBracket(undefined, mpScope),
        renderVersion(p.version),
        "(partially-available)",
        composeReasons(p.reasons, false, false, probe),
      ]);
    case "upgradable":
      return pluginRow(ICON_INSTALLED, p, mpScope, "(upgradable)", probe);
    case "partially-installed":
      return partiallyInstalledRow(p, mpScope, probe);
    case "partially-upgradable":
      // FSTAT-04 / D-66-02 / D-66-03: currently-clean installed plugin whose
      // newer candidate would newly degrade. REUSES ICON_INSTALLED (`●`) -- the
      // row is clean today -- exactly like the `upgradable` arm above.
      return pluginRow(ICON_INSTALLED, p, mpScope, "(partially-upgradable)", probe);
    case "skipped":
      return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe);
    case "failed":
      return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe);
    case "manual recovery":
      // `(manual recovery)` discriminator preserved verbatim WITH A SPACE.
      return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(manual recovery)", probe);
    case "will install":
      // DIFF-02 / D-53-02: pending-tense row for a plugin declared in
      // config but not yet recorded. Reuses ICON_INSTALLED. No `version`
      // slot (the install hasn't happened yet); no reasons (pending rows are
      // pre-transition). FSTAT-06 / D-66-04: the `partial` modifier renders
      // `(will partially install)` when the planned install would degrade
      // (resolves `partially-available`); there is deliberately NO `will partially update`
      // analog -- the reconcile plan has no update bucket (D-66-05).
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        p.partial === true ? "(will partially install)" : "(will install)",
      ]);
    case "will uninstall":
      // DIFF-02: pending-tense row for a plugin recorded in state but
      // no longer declared. Reuses ICON_AVAILABLE (open circle `○`) -- same
      // glyph as the realized (uninstalled) row, because a `will uninstall`
      // is its pre-transition analog.
      return joinTokens([
        ICON_AVAILABLE,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        "(will uninstall)",
      ]);
    case "will enable":
      // DIFF-02: pending-tense row for a recorded plugin newly
      // declared `enabled: true` after being locally disabled. Reuses
      // ICON_INSTALLED. The bucket is populated only when the recorded-
      // but-disabled marker (empty resources + installable true) is paired
      // with a config entry whose `enabled !== false`; the arm is always
      // present so enable-wiring stays type-complete.
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        "(will enable)",
      ]);
    case "will disable":
      // DIFF-02: pending-tense row for a recorded plugin newly declared
      // `enabled: false`. Uses ICON_DISABLED (`◌`) -- the same glyph the
      // realized `(disabled)` inventory row uses; this mirrors the precedent
      // that realized + pending-tense rows for the same row class share a
      // glyph (`●` for `(installed)` / `(will install)`, `○` for
      // `(available)` / `(will uninstall)`).
      return joinTokens([
        ICON_DISABLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        "(will disable)",
      ]);
    case "disabled":
      // D-54-01 / ENBL-04: list/info inventory row for a recorded-but-disabled
      // plugin. Subject-first grammar; uses the dedicated ICON_DISABLED
      // (`◌`) glyph, the same glyph the `(will disable)` pending-tense row
      // carries. NO reasons -- the variant carries none; composeReasons
      // receives undefined + both soft-dep flags false (the inventory row
      // never emits soft-dep markers).
      return joinTokens([
        ICON_DISABLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(disabled)",
        composeReasons(undefined, false, false, probe),
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
//   /reload to pick up changes  <-- iff any row stamps needsReload:true
//
// Joins / separators:
//   - Plugin row prefix:                "  " (2 spaces)
//   - Cause-chain trailer prefix:       "    " (4 spaces)
//   - rollbackPartial child row prefix: "    " (4 spaces)
//   - rollbackPartial phase cause:      "      " (6 spaces)
//   - Between marketplace blocks:       "\n\n" (one blank line)
//   - Between body and reload-hint:     "\n\n" (one blank line)
//
// Severity (SEV-02): the numeric MAX over the caller-stamped `row.severity`
// (info=0 < warning=1 < error=2) across the marketplace rows AND their plugin
// rows; rank 0 -> undefined (info, no 2nd arg). No status/reasons inference.
//
// Reload-hint (RLD-02): the OR-reduce of the caller-stamped `row.needsReload`
// over the same flattened rows. Realized transitions (install/update/reinstall/
// uninstall + the fresh-disable) stamp needsReload:true; inventory rows stamp
// false. No marketplace-status / cascade-kind inference -- the former
// `disable-cascade` straddle is now a per-row stamped fact. Info-surface kinds
// short-circuit to no-trailer (including reconcile-applied-cascade, which
// suppresses the trailer at the kind level even though its rows stamp true).
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
 * UGRM-01 / UGRM-02 never-silent no-op headline for a bulk `update` that
 * realized ZERO transitions (all targets up-to-date, OR the only surviving rows
 * are benign info skips such as a `(partially-upgradable)` decline). Hard-coded so
 * the byte form cannot drift from `docs/output-catalog.md`'s `all-up-to-date-noop`
 * / `skip-partially-upgradable-bulk` states -- mirrors the `reconcile-pending-empty`
 * byte-lock precedent. Emitted in PLACE of the `composeTally` success line
 * (which collapses a `tally {count: 0}` override to `""`), so the summary line
 * never vanishes.
 */
const UPDATE_NO_OP_HEADLINE = "Plugin update: nothing to update";

/**
 * SEV-02 / D-69-03 `--partial` hint trailer literal, rendered below a
 * partially-available install-failure row. References the user's
 * own `--partial` flag only -- no plugin / marketplace interpolation (T-69-01).
 * D-70-01: this byte form is FROZEN as the reconciled DOC contract and is
 * locked byte-for-byte in docs/output-catalog.md and
 * docs/messaging-style-guide.md. Do not change the wording.
 */
const PARTIAL_INSTALL_HINT_TRAILER = "Re-run with --partial to install the supported components.";

/**
 * XSURF-03 update-worded `--partial` hint trailer literal, rendered below a
 * partially-upgradable manual update-decline row. The update-worded analog of
 * `PARTIAL_INSTALL_HINT_TRAILER`. References the user's own `--partial` flag only
 * -- no plugin / marketplace interpolation (T-73-01). This byte form is FROZEN
 * as a reconciled DOC contract and is locked byte-for-byte in
 * docs/output-catalog.md and docs/messaging-style-guide.md. Do not change the
 * wording.
 */
const PARTIAL_UPDATE_HINT_TRAILER =
  "Re-run with --partial to update with the supported components.";

/**
 * SEV-03: the desired-state tri-state contract every producer stamps on a row:
 *   - `info`    = the resource reached the desired state (success / steady
 *                 inventory / benign idempotent no-op);
 *   - `warning` = the command fell short of the desired state but did not
 *                 crash (an actionable skip, a manual-recovery anchor);
 *   - `error`   = the command could not carry out the desired state (a failure).
 * `notify()` does NOT re-derive these from content -- it reduces the stamped
 * facts (SEV-02).
 */

/** Numeric rank for the SEV-02 max-severity reduce: info < warning < error. */
const SEVERITY_RANK = { info: 0, warning: 1, error: 2 } as const;

type ComputedSeverity = "warning" | "error" | undefined;

/**
 * SEV-02: the cascade severity is the numeric MAX over the caller-stamped
 * `severity` of every row -- both the marketplace-level rows AND their nested
 * plugin rows (the same flattened traversal the deleted content ladder walked).
 * An absent `severity` defaults to `info` (rank 0) per SEV-01. The reducer reads
 * ONLY the stamped field -- no `status`/`reasons` content inference. Rank 0
 * returns `undefined` (info -> no 2nd `ctx.ui.notify` arg); rank 1 -> "warning";
 * rank 2 -> "error", preserving the `ComputedSeverity` host-arg contract. The
 * D-03 producer stamps reproduce the former first-match ladder's output exactly,
 * so this is byte-identical (gated by catalog-uat).
 *
 * Structural-subset typed so any message whose `marketplaces[]` carries the
 * `(severity?, plugins[].severity?)` shape can be evaluated (the cascade arm and
 * the RECON-04 `reconcile-applied-cascade` standalone arm share it).
 */
function cascadeSeverity(message: {
  readonly marketplaces: readonly {
    readonly severity?: Severity;
    readonly plugins: readonly {
      readonly severity?: Severity;
    }[];
  }[];
}): ComputedSeverity {
  let rank = 0; // info
  for (const mp of message.marketplaces) {
    rank = Math.max(rank, SEVERITY_RANK[mp.severity ?? "info"]);
    for (const p of mp.plugins) {
      rank = Math.max(rank, SEVERITY_RANK[p.severity ?? "info"]);
    }
  }

  if (rank === 0) {
    return undefined;
  }

  return rank === 1 ? "warning" : "error";
}

function computeSeverity(message: NotificationMessage): ComputedSeverity {
  // SEV-02: the cascade severity is the MAX over the rows' caller-stamped
  // `severity` (see `cascadeSeverity`), NOT content inference.
  //
  // The standalone info-kind switch below STAYS (Q1 LOCKED): these kinds carry
  // no per-row `severity` array to reduce, so they keep a tiny kind->severity
  // map (a kind lookup, NOT reason inference, so SEV-02 holds).
  // INFO-04 / SC#2 / INFO-03 / INFO-02: info-surface kinds take precedence
  // over the cascade reduce.
  // `marketplace-info` payloads carry no failure state and route to info
  // (undefined 2nd arg); `plugin-info` payloads route to `"error"` ONLY when
  // the embedded plugin row is `(failed)` (e.g. an unreadable manifest), else
  // info; `marketplace-info-cascade` AND `plugin-info-cascade` payloads route
  // to info unconditionally -- no failure can be expressed on a fan-out
  // wrapper. The `{not added}` --scope mismatch condition is carried by the
  // dedicated `marketplace-not-added` arm, which always routes to `"error"`.
  if (isInfoKind(message)) {
    // The `marketplace-not-added` variant routes to "error" (the marketplace
    // is absent -- a failure surface); `plugin-info` routes to "error" only
    // when its embedded row is `(failed)`; the read-only info/cascade kinds
    // carry no failure state and route to info (undefined).
    // `reconcile-applied-cascade` (RECON-04) carries the same stamped
    // `MarketplaceNotificationMessage[]` rows as the plain cascade, so it
    // reduces through the SEV-02 max-severity reducer too.
    switch (message.kind) {
      case "marketplace-not-added":
        return "error";
      case "plugin-info":
        return message.plugin.status === "failed" ? "error" : undefined;
      case "reconcile-applied-cascade":
        return cascadeSeverity(message);
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: the empty-steady-state advisory is read-only / info.
        return undefined;
      default:
        assertNever(message);
        return undefined;
    }
  }

  // Cascade arm: reduce the stamped row severities (SEV-02).
  return cascadeSeverity(message);
}

/**
 * The plugin/marketplace operation counts that drive the summary line.
 */
interface SummaryCounts {
  readonly plugins: number;
  readonly marketplaces: number;
}

/**
 * `error`-severity counting (D-29-04): failed plugin rows (summed across all
 * marketplaces) and failed marketplace rows. Mirrors `computeSeverity` arm 1.
 * Cascade-only (SC#1): the parameter is narrowed to
 * `CascadeNotificationMessage` -- info-surface kinds do not invoke
 * `buildSummaryLine` (see `notify()` dispatcher and `buildSummaryLine`'s
 * defensive short-circuit).
 */
function countFailedOperations(message: CascadeNotificationMessage): SummaryCounts {
  return countFailedRows(message.marketplaces);
}

/**
 * SEV-02: error-severity tally by stamped fact -- the marketplace rows AND
 * plugin rows whose caller-stamped `severity === "error"`. The D-03 stamps map
 * `failed` rows to `error`, exactly the rows the former status-based counter
 * matched, so the count is byte-identical. Consumed by both the cascade arm and
 * the RECON-04 `reconcile-applied-cascade` standalone arm.
 */
function countFailedRows(marketplaces: readonly MarketplaceNotificationMessage[]): SummaryCounts {
  return countRowsBySeverity(marketplaces, "error");
}

/**
 * `warning`-severity counting consumed by the summary line. Cascade-only (SC#1;
 * see `countFailedOperations`).
 */
function countSkippedOperations(message: CascadeNotificationMessage): SummaryCounts {
  return countSkippedRows(message.marketplaces);
}

/**
 * SEV-02: warning-severity tally by stamped fact -- the rows whose caller-
 * stamped `severity === "warning"`. The D-03 stamps map actionable skips and
 * manual-recovery anchors to `warning` (benign idempotent skips stamp `info`),
 * so this is byte-identical to the former content-derived counter.
 */
function countSkippedRows(marketplaces: readonly MarketplaceNotificationMessage[]): SummaryCounts {
  return countRowsBySeverity(marketplaces, "warning");
}

/**
 * Shared tally of marketplace rows AND their nested plugin rows whose stamped
 * `severity` equals `target`. An absent `severity` defaults to `info` (SEV-01),
 * so an absent-severity row is counted under the `"info"` target.
 *
 * OUT-03: the `target` union includes `"info"` so the trailing tally can count
 * `<n> success(es)` (the desired-state-reached rows) alongside the existing
 * error/warning counts -- the `(x.severity ?? "info") === target` predicate
 * already classifies an absent or explicit `info` severity, so widening the
 * union needs no further change.
 */
function countRowsBySeverity(
  marketplaces: readonly MarketplaceNotificationMessage[],
  target: Severity,
): SummaryCounts {
  let plugins = 0;
  let mpCount = 0;

  for (const mp of marketplaces) {
    if ((mp.severity ?? "info") === target) {
      mpCount++;
    }

    plugins += mp.plugins.filter((p) => (p.severity ?? "info") === target).length;
  }

  return { plugins, marketplaces: mpCount };
}

/**
 * OUT-02 / D-02: build the leading severity sentence from a row count, the max
 * severity, and the row subject. `subject` is `"plugin"` / `"marketplace"` for a
 * homogeneous cascade, or `null` for a mixed-subject cascade (D-03) where the
 * subject noun is dropped.
 *
 * Form: `[A|An|Some] <subject> operation[s] has/have failed | needs/need attention.`
 * -- `A` / `An` (vowel-aware off the leading noun) for a single row, `Some` for
 * more than one; `operation` / `operations`
 * pluralized by count; `has failed` / `have failed` for error and
 * `needs attention` / `need attention` for warning; terminal period kept. The
 * verb-number agrees with the count (singular for 1, plural otherwise).
 */
function summaryPhrase(
  count: number,
  severity: "error" | "warning",
  subject: "plugin" | "marketplace" | null,
): string {
  const singular = count === 1;
  const operationWord = singular ? "operation" : "operations";
  const errorVerb = singular ? "has failed" : "have failed";
  const warningVerb = singular ? "needs attention" : "need attention";
  const verbPhrase = severity === "error" ? errorVerb : warningVerb;
  const subjectWord = subject === null ? "" : `${subject} `;
  const noun = `${subjectWord}${operationWord}`;
  // CR-01: mixed-subject (subject === null) drops the noun, so the count-1 form
  // would read "A operation" -- vowel-initial, grammatically "An". Choose the
  // singular article off the resolved noun's leading letter; "Some" for plural.
  const singularArticle = /^[aeiou]/i.test(noun) ? "An" : "A";
  const article = singular ? singularArticle : "Some";
  return `${article} ${noun} ${verbPhrase}.`;
}

/**
 * RECON-04: shared summary-line wording over a marketplaces array. Mirrors
 * the cascade-arm tail of `buildSummaryLine` so the reconcile-applied
 * variant emits identical phrasing.
 *
 * D-03: mixed-subject detection is render-time -- a cascade whose rows span
 * BOTH plugin and marketplace subjects (`counts.plugins > 0 &&
 * counts.marketplaces > 0`) drops the subject noun and counts all rows
 * uniformly off the combined total.
 */
function buildSummaryLineForCascade(
  marketplaces: readonly MarketplaceNotificationMessage[],
  severity: "error" | "warning",
): string {
  const counts =
    severity === "error" ? countFailedRows(marketplaces) : countSkippedRows(marketplaces);

  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return summaryPhrase(counts.plugins + counts.marketplaces, severity, null);
  }

  if (counts.marketplaces > 0) {
    return summaryPhrase(counts.marketplaces, severity, "marketplace");
  }

  return summaryPhrase(counts.plugins, severity, "plugin");
}

/**
 * UXG-07 / GRAM-01 / GRAM-02 (D-29-02/03/04): build the human-readable summary
 * line that `emitWithSummary` prepends before the body for `error` and
 * `warning` severity. It gives the host `Error:` / `Warning:` prefix a
 * meaningful, contextual sentence to introduce ("focus on the operation, not
 * what happened to each plugin -- the body already shows that").
 *
 * Invoked for BOTH the cascade arm and the standalone arm (GRAM-04): the two
 * error-severity standalone kinds (`marketplace-not-added`, failed
 * `plugin-info`) take a hard-count-1 summary on the FAILED ROW's subject
 * (GRAM-02); the cascade arm counts the failed/skipped rows.
 *
 * Wording (OUT-02 / D-02): `[A|Some] <subject> operation[s] has/have failed |
 * needs/need attention.` -- `A` for a single row, `Some` otherwise; `has failed`
 * / `have failed` for error and `needs attention` / `need attention` for
 * warning. D-03: a mixed-subject cascade (plugin AND marketplace rows present)
 * drops the subject noun and counts all rows uniformly. When BOTH counts are
 * zero (an unreachable shape -- `computeSeverity` only returns error/warning
 * when a matching row exists) the function degrades gracefully to the
 * plugin-only plural form rather than crashing.
 */
function buildSummaryLine(message: NotificationMessage, severity: "error" | "warning"): string {
  // GRAM-02: the standalone-dispatched kinds derive their summary from the
  // FAILED ROW's subject, not the invoking command. The two error-severity
  // standalone kinds carry a hard-count-1 summary (one absent marketplace /
  // one failed plugin row); the read-only info/cascade kinds and a non-failed
  // `plugin-info` carry NO summary (they route through the info arm of the
  // emission helper and never reach the summary path). Narrowed through the
  // single `isInfoKind` guard so a future StandaloneKind without a summary arm
  // is a compile error.
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-not-added":
        return summaryPhrase(1, "error", "marketplace");
      case "plugin-info":
        return message.plugin.status === "failed" ? summaryPhrase(1, "error", "plugin") : "";
      case "reconcile-applied-cascade":
        // RECON-04: at error/warning severity reuse the cascade-arm counting
        // helpers over the same per-status `marketplaces` shape; at info
        // severity buildSummaryLine isn't called (emitWithSummary short-
        // circuits) so the empty arm below is unreachable in practice.
        return buildSummaryLineForCascade(message.marketplaces, severity);
      case "marketplace-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: info-severity / read-only -- no summary semantics.
        return "";
      default:
        assertNever(message);
        return "";
    }
  }

  const counts =
    severity === "error" ? countFailedOperations(message) : countSkippedOperations(message);

  // D-03: mixed-subject cascade drops the noun and counts all rows uniformly.
  if (counts.plugins > 0 && counts.marketplaces > 0) {
    return summaryPhrase(counts.plugins + counts.marketplaces, severity, null);
  }

  if (counts.marketplaces > 0) {
    return summaryPhrase(counts.marketplaces, severity, "marketplace");
  }

  // counts.plugins > 0, or the unreachable 0/0 degrade-to-plugin-plural case.
  return summaryPhrase(counts.plugins, severity, "plugin");
}

/**
 * OUT-03: pluralize one tally category by count. Mirrors the `summaryPhrase`
 * `count === 1 ? singular : plural` idiom: `failure`/`failures`,
 * `warning`/`warnings`, `success`/`successes`.
 */
function tallyCategory(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * OUT-03 / OUT-04 / D-04: build the trailing per-operation tally for a PLURAL
 * (bulk) cascade. Returns `<Operation>: <n> failure(s), <n> warning(s), <n>
 * success(es)` where `<Operation>` is the threaded `Messaging.label`, the counts
 * come from `countRowsBySeverity` over the marketplace + nested plugin rows
 * (D-03 mixed-subject: all rows counted uniformly under the operation name),
 * zero-count categories are OMITTED, and there is NO terminal period.
 *
 * Returns `""` when the tally must not render: the operation is single-target
 * (cardinality !== "plural" -- D-04, never a row-count heuristic),
 * the label is absent (legacy `notify()` emissions), or every category is zero.
 * Per OUT-03 the tally renders on plural ops regardless of severity, so a
 * successful bulk import shows `Plugin import: 3 success(es)`.
 */
function composeTally(message: {
  readonly label?: string;
  readonly cardinality?: "single" | "plural";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
  readonly tally?: { readonly verb: string; readonly count: number };
}): string {
  if (message.cardinality !== "plural" || message.label === undefined) {
    return "";
  }

  const errorCount = countRowsBySeverity(message.marketplaces, "error");
  const warningCount = countRowsBySeverity(message.marketplaces, "warning");

  const failures = errorCount.plugins + errorCount.marketplaces;
  const warnings = warningCount.plugins + warningCount.marketplaces;

  const parts: string[] = [];

  if (failures > 0) {
    parts.push(tallyCategory(failures, "failure", "failures"));
  }

  if (warnings > 0) {
    parts.push(tallyCategory(warnings, "warning", "warnings"));
  }

  if (message.tally === undefined) {
    // OUT-03 / OUT-06 / D-03: the default tally counts OPERATION rows uniformly
    // across the plugin and marketplace subjects. A BARE marketplace header --
    // one carrying neither a `status` (a realized mp outcome: `added` /
    // `updated` / `removed` / `failed` / `skipped`) NOR a stamped `severity` --
    // is a pure grouping label (bookkeeping, not an operation), so it must not
    // inflate the success count. A marketplace row WITH a `status` IS a real
    // mp-level operation and counts (an import `added` block, a `marketplace
    // remove` `removed` block). The `info` count from `countRowsBySeverity`
    // includes bare headers via its `?? "info"` default, so subtract them;
    // plugin rows always represent an operation and always count.
    const successCount = countRowsBySeverity(message.marketplaces, "info");
    const bareHeaders = message.marketplaces.filter(
      (mp) => mp.severity === undefined && mp.status === undefined,
    ).length;
    const successes = successCount.plugins + successCount.marketplaces - bareHeaders;

    if (successes > 0) {
      parts.push(tallyCategory(successes, "success", "successes"));
    }
  } else if (message.tally.count > 0) {
    // UGRM-02: the update-scoped override OWNS the success category -- the count
    // is realized transitions only (the orchestrator's `updated`-partition
    // tally), rendered with a verb that has no plural-s (`1 updated`, `2
    // updated`). The info-row `successes` math above is SKIPPED entirely so an
    // at-desired-state `(skipped) {up-to-date}` row never inflates the headline.
    // A `count` of 0 contributes nothing (the never-silent no-op headline is the
    // orchestrator's job), so a failure-only cascade stays e.g. `1 failure`.
    parts.push(tallyCategory(message.tally.count, message.tally.verb, message.tally.verb));
  }

  if (parts.length === 0) {
    return "";
  }

  return `${message.label}: ${parts.join(", ")}`;
}

/**
 * OUT-03: fold the optional trailing tally into the body BETWEEN the cascade
 * body and the reload-hint trailer, yielding `{body}\n\n{tally}\n\n{hint}` when
 * both are present (each segment omitted when empty). The tally placement is the
 * binding catalog byte contract.
 */
function foldTallyAndHint(body: string, tally: string, hint: string): string {
  return [body, tally, hint].filter((segment) => segment !== "").join("\n\n");
}

/**
 * Reload-hint trigger per SNM-33. The trailer is reserved for
 * operations that actually change a Pi-visible resource. The ONLY Pi-visible
 * resources are plugin rows (skill / agent / command / MCP entry); marketplace
 * records are bookkeeping, not resources, so they never warrant a `/reload`.
 *
 * RLD-02 / RLD-05 / D-07: the rule is the OR-reduce of the caller-stamped
 * `needsReload` over the cascade rows -- no status-token or cascade-kind
 * inference. The D-06 stamps reproduce the former trigger set exactly: the
 * realized install / update / reinstall / uninstall transitions AND the
 * realized fresh-disable transition stamp `needsReload: true`, while
 * list / info inventory `disabled` / `installed` rows and every marketplace
 * status (added / removed / updated / autoupdate enabled / autoupdate disabled
 * / skipped / failed) stamp `needsReload: false`. The former `"disable-cascade"`
 * kind straddle (where a `disabled` row's hint depended on the cascade kind) is
 * thus replaced by a per-row stamped fact.
 *
 * A fresh autoupdate enabled/disabled flip does NOT emit the trailer (the
 * flip changes a marketplace record, not a Pi-visible resource). The
 * `skipped -> warning` severity route (computeSeverity) is unaffected:
 * severity and reload-hint are independent ladders.
 *
 * Clean `marketplace remove` carries one `PluginUninstalledMessage` row per
 * unstaged plugin, so a non-empty remove still emits the trailer via
 * the `uninstalled` token while an empty remove (header-only) does not.
 */
function shouldEmitReloadHint(message: NotificationMessage): boolean {
  // RLD-02: the reload hint is the OR-reduce of the caller-stamped
  // `needsReload` over the cascade rows (see the flattened loop below) -- NOT
  // status-token / cascade-kind inference.
  // INFO-03 / INFO-02: info-surface kinds NEVER trigger the reload-hint
  // trailer. The info commands (`marketplace info`,
  // `plugin info`) are read-only surfaces that do not change a Pi-visible
  // resource; the trailer would mislead the user into running `/reload`
  // for no reason. Each fan-out wrapper inherits this short-circuit -- a
  // fan-out of N info blocks is N read-only queries composed; it remains
  // structurally read-only.
  if (isInfoKind(message)) {
    switch (message.kind) {
      case "marketplace-info":
      case "plugin-info":
      case "marketplace-info-cascade":
      case "plugin-info-cascade":
      case "marketplace-not-added":
      case "reconcile-pending-empty":
        // DIFF-01 SC #2: pending-list rows are pre-transition; the trailer would
        // be grammatically false (`/reload` cannot pick up zero changes).
        return false;
      case "reconcile-applied-cascade":
        // RECON-04: the reconcile already ran ON /reload (the
        // resources_discover handler IS the trailer's nominal trigger), so
        // emitting `Run /reload to pick up changes` after applying changes
        // would be a lie. Structurally false closes the trailer-leak gap --
        // this kind-level exclusion stands EVEN THOUGH its rows stamp
        // needsReload:true (they are realized transitions).
        return false;
      default:
        assertNever(message);
        return false;
    }
  }

  // RLD-02: the trailer fires iff the OR-reduce of the stamped `needsReload`
  // over the flattened marketplace + plugin rows is true. The D-06 stamps
  // reproduce the former trigger set exactly: realized install/update/
  // reinstall/uninstall and the realized fresh-disable transition stamp
  // needsReload:true, while list/info inventory `disabled`/`installed` rows
  // stamp needsReload:false. (See this function's JSDoc for the migration
  // rationale that retired the former cascade-kind straddle.)
  for (const mp of message.marketplaces) {
    if (mp.needsReload === true) {
      return true;
    }

    for (const p of mp.plugins) {
      if (p.needsReload === true) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Render the depth-5 cause-chain trailer at the requested space-indent
 * prefix when `cause` is defined and the walker returns a non-empty string.
 * Returns `""` otherwise so callers can `if (trailer !== "") lines.push(...)`.
 * Centralizes the "guard + walker + indent" composition reused for both the
 * per-plugin cause (4-space indent) and the per-rollback-phase
 * cause (6-space indent).
 */
function renderIndentedCauseChain(cause: unknown, indent: string): string {
  if (cause === undefined) {
    return "";
  }

  const trailer = causeChainTrailer(cause);
  return trailer === "" ? "" : `${indent}${trailer}`;
}

/**
 * Render the rollbackPartial child rows for a failed-variant plugin.
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
  // Byte-identical to dispatching through the central `renderPluginRow` switch:
  // delegate to the body-parameterized variant with `renderPluginRow` as the
  // row renderer, so the PL-4 description line, the cause-chain / AS-7
  // leaked-paths trailers, and the rollback-partial lines are composed in
  // exactly one place (`composePluginLinesWith`).
  return composePluginLinesWith(p, probe, mpScope, renderPluginRow);
}

/**
 * INFO-01: compose the marketplace-info marketplace header line.
 * Mirrors `renderMpHeader`'s SUB-BRANCH B list-surface composition (the
 * details-defined / list-surface form: `● <name> [<scope>] <autoupdate-marker>`).
 * Differs from `renderMpHeader` in one place: on the info surface BOTH the
 * `<autoupdate>` and `<no autoupdate>` markers are emitted (per INFO-01:
 * "with `<autoupdate>` / `<no autoupdate>` marker"), whereas the list
 * surface suppresses `<no autoupdate>` (absence-conveys-off). The carve-out
 * lives here and does NOT touch `renderMpHeader` (zero mutation of the
 * cascade renderer arms).
 *
 * File-private; sole callers are `renderMarketplaceInfo` and
 * `renderPluginInfo` below.
 */
function composeMpInfoHeader(name: string, scope: Scope, details: MarketplaceDetails): string {
  const marker = details.autoupdate ? "<autoupdate>" : "<no autoupdate>";
  return `${ICON_INSTALLED} ${name} [${scope}] ${marker}`;
}

/**
 * INFO-01 / INFO-04: render a `MarketplaceInfoMessage` to its
 * single-string body. Composes:
 *   - the marketplace-info header line at column 0 (`composeMpInfoHeader`),
 *   - the source-kind line (`github: <owner>/<repo>[#<ref>]`,
 *     `url: <url>[#<ref>]`, or `path: <abs-path>`),
 *   - optional `last_updated: <ISO8601>` (git-backed kinds github + url;
 *     never path per D-76-10),
 *   - optional `description: <text>` (single attribute line, NOT wrapped
 *     -- description wrapping is `plugin info`-only per INFO-02).
 *
 * Joins all lines with `\n`. `probe` is unused on info surfaces (info
 * messages do not emit soft-dep markers) but accepted for signature parity
 * with `composeMarketplaceBlock`. File-private; sole caller is `notify()`
 * dispatcher.
 */
function renderMarketplaceInfo(message: MarketplaceInfoMessage, _probe: SoftDepStatus): string {
  const lines: string[] = [composeMpInfoHeader(message.name, message.scope, message.details)];

  switch (message.source.sourceKind) {
    case "github": {
      const refSuffix = message.source.ref === undefined ? "" : `#${message.source.ref}`;
      lines.push(`github: ${message.source.owner}/${message.source.repo}${refSuffix}`);
      break;
    }

    // MURL-05 / D-76-09: url sources render `url: <url>[#<ref>]`, mirroring the
    // github label==kind convention. NOT a `path:` line (the clone dir).
    case "url": {
      const refSuffix = message.source.ref === undefined ? "" : `#${message.source.ref}`;
      lines.push(`url: ${message.source.url}${refSuffix}`);
      break;
    }

    case "path":
      lines.push(`path: ${message.source.absPath}`);
      break;

    default:
      assertNever(message.source);
  }

  // D-76-10: `last_updated:` renders for all git-backed kinds (github + url),
  // never for path. WR-04: the timestamp is read from the persisted
  // `MarketplaceDetails.lastUpdatedAt` (single source of truth), not a
  // duplicate top-level field. Lifted out of the github case so the widened
  // gate fires for url too.
  if (message.source.sourceKind !== "path" && message.details.lastUpdatedAt !== undefined) {
    lines.push(`last_updated: ${message.details.lastUpdatedAt}`);
  }

  if (message.description !== undefined) {
    lines.push(`description: ${message.description}`);
  }

  return lines.join("\n");
}

/**
 * INFO-03: render a `MarketplaceInfoCascadeMessage` to its
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
 * INFO-02 / INFO-03: render a `PluginInfoCascadeMessage` to
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
    case "partially-installed":
      // FSTAT-02 / FSTAT-07 / D-66-03: info row for an installed plugin
      // re-resolving `partially-available` -- the dedicated `◉` glyph.
      return ICON_PARTIALLY_INSTALLED;
    case "available":
      return ICON_AVAILABLE;
    case "remote":
      // RSTA-01: not-installed git-source info row whose clone/mirror is not
      // materialized -- the dedicated `◌` dotted-circle glyph.
      return ICON_REMOTE;
    case "partially-available":
      // USTAT-01 / D-64-01: not-installed, partially-available info row -- the
      // dedicated `⊖` glyph, distinct from the `⊘` structural-unavailable arm.
      return ICON_PARTIALLY_AVAILABLE;
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
// declarations cannot drift. The tuple is sized exactly (5 entries):
// adding a 6th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- TS rejects the
// literal because `ComponentKind` would no longer cover every keyof
// the interface. Without the explicit tuple length, the renderer
// would silently omit the new kind from output.
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
] = ["agents", "commands", "hooks", "mcp", "skills"];

/**
 * Append the per-kind component lines + optional dependencies line
 * for a resolved `PluginInfoRow`. Per-kind order is alphabetical
 * (`agents`, `commands`, `hooks`, `mcp`, `skills`); within each kind,
 * names render in the caller-supplied order. The orchestrator pre-sorts;
 * the renderer does not.
 *
 * SURF-02 / D-63-04: the `hooks` kind is the only multi-line member;
 * the per-arm rendering is owned by `appendHooksBlock`. Every other
 * kind keeps the single-line `<kind>: <name>, <name>, ...` comma-join
 * shape.
 */
function appendResolvedComponentLines(
  lines: string[],
  components: PluginInfoComponentsResolved["components"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    if (kind === "hooks") {
      appendHooksBlock(lines, components.hooks);
      continue;
    }

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
 * TYPE-01 / D-46-01a: render the dedicated `MarketplaceNotAddedMessage`
 * variant. Lifted from the former `renderPluginInfo` `{not added}` carve-out;
 * emits the byte-identical bare column-0 row
 * `⊘ <name> [scope?] (failed) {not added}` with NO marketplace header (the row
 * IS the message). `name` carries the MARKETPLACE name. `scope` present =>
 * `[scope]` bracket; absent => no bracket. The version slot collapses to `""`
 * (the variant carries no version) and the `{not added}` brace is hard-coded
 * via the `["not added"]` literal (the variant carries no `reasons` field).
 *
 * `probe` is accepted for signature parity with the other info renderers and
 * threaded into `composeReasons` with BOTH soft-dep declares-flags FALSE --
 * info-surface rows NEVER emit soft-dep markers.
 */
function renderMarketplaceNotAdded(
  message: MarketplaceNotAddedMessage,
  probe: SoftDepStatus,
): string {
  return joinTokens([
    ICON_UNINSTALLABLE,
    message.name,
    message.scope === undefined ? "" : `[${message.scope}]`,
    renderVersion(undefined),
    "(failed)",
    composeReasons(["not added"], false, false, probe),
  ]);
}

/**
 * Render a `PluginInfoMessage` to its single-string body.
 *
 * Every plugin-info row renders the always-marketplace-header form:
 * marketplace header at col 0;
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
  // Pass the threaded soft-dep probe into renderMpHeader so the "skipped" arm
  // can reuse composeReasons. The mp-skipped arm passes (false, false) for the
  // two declares-flags; no soft-dep marker can leak onto an mp-level row.
  const lines: string[] = [renderMpHeader(mp, probe)];
  for (const p of mp.plugins) {
    lines.push(...composePluginLines(p, probe, mp.scope));
  }

  return lines.join("\n");
}

/**
 * RECON-04: compose the `reconcile-applied-cascade` body using the SAME
 * per-mp / per-plugin helpers the cascade arm uses, so realized transition
 * tokens (`added` / `installed` / `uninstalled` / `disabled` / `failed`)
 * render byte-identical to their standalone-command counterparts. The empty-
 * marketplaces case is unreachable (callers MUST short-circuit BEFORE
 * invoking notify() per NFR-2 / A4); we defensively fall back to the
 * `(no marketplaces)` sentinel for parity with the cascade arm.
 */
function composeReconcileAppliedBody(
  message: ReconcileAppliedCascadeMessage,
  probe: SoftDepStatus,
): string {
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  return blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
}

/**
 * GRAM-04: the single summary-emission seam shared by the standalone arm
 * (`dispatchInfoMessage`) and the cascade arm of `notify()`. Computing the
 * severity and prepending the summary in ONE place is the structural
 * anti-divergence guarantee -- no caller can re-introduce a summary-less
 * error/warning emission like the v1.10 standalone-arm defect.
 *
 * GRAM-01: at error/warning severity the summary is prepended as its own
 * block, separated from the body by `\n\n` (never a single `\n`, which would
 * re-glue the host `Error:` / `Warning:` label onto the detail row). At info
 * severity the body is emitted unchanged (no summary -- the operation-count
 * semantics do not apply to read-only results). IL-2: exactly one
 * `ctx.ui.notify` call per invocation.
 */
function emitWithSummary(ctx: ExtensionContext, message: NotificationMessage, body: string): void {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);
  } else {
    ctx.ui.notify(`${buildSummaryLine(message, severity)}\n\n${body}`, severity);
  }
}

/**
 * Dispatcher for the standalone-dispatched arms of `notify()`. Centralizes the
 * per-variant body composition, then routes through the shared
 * `emitWithSummary` seam (GRAM-04) so error/warning standalone emissions carry
 * the summary line exactly like the cascade arm does. IL-2: one
 * `ctx.ui.notify` call per invocation (the seam performs it).
 */
function dispatchInfoMessage(
  ctx: ExtensionContext,
  message: Extract<NotificationMessage, { kind: StandaloneKind }>,
  probe: SoftDepStatus,
): void {
  // Body composition per variant. The standalone renderers share the
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
    case "marketplace-not-added":
      body = renderMarketplaceNotAdded(message, probe);
      break;
    case "reconcile-pending-empty":
      // DIFF-01 SC #2: catalog-locked free-form advisory body line. Hard-coded
      // here so the byte form cannot drift from `docs/output-catalog.md`'s
      // `empty-steady-state` state.
      body = "Pending: next reload will apply 0 actions.";
      break;
    case "reconcile-applied-cascade":
      // RECON-04: compose the same cascade body the cascade arm renders
      // (per-mp header + per-plugin row via the existing helpers). The
      // reload-hint trailer is structurally suppressed (the reconcile already
      // ran ON /reload); emitWithSummary handles the summary prepend at
      // error/warning severity. OUT-03/OUT-06/D-03/D-04: a reconcile apply is a
      // plural mixed-subject operation, so the trailing tally folds in after the
      // body (no reload-hint segment), mirroring the
      // `emitReconcileAppliedContextCascade` production path so the byte form is
      // identical whichever entry composes it.
      body = foldTallyAndHint(
        composeReconcileAppliedBody(message, probe),
        composeTally(message),
        "",
      );
      break;
    default:
      assertNever(message);
      return;
  }

  emitWithSummary(ctx, message, body);
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
  // -- info messages never emit soft-dep markers).
  const probe = softDepStatus(pi);

  // Dispatch standalone-dispatched kinds through `dispatchInfoMessage` so the
  // cascade arm below stays under the cognitive-complexity budget. The single
  // `isInfoKind` guard (TYPE-03) is the one place that enumerates the
  // standalone set. The helper performs exactly ONE `ctx.ui.notify` call per
  // invocation (IL-2) and routes through the SAME `emitWithSummary` seam as the
  // cascade arm (GRAM-04): error/warning standalone kinds carry the summary
  // line, info kinds do not. No reload-hint for any standalone kind. After this
  // branch, TypeScript narrows `message` to `CascadeNotificationMessage` via
  // the exhaustiveness switch below.
  if (isInfoKind(message)) {
    dispatchInfoMessage(ctx, message, probe);
    return;
  }

  // Exhaustiveness gate. After the standalone-arm return above, the only
  // legal residual `message.kind` values are `undefined` (back-compat)
  // or the explicit `"cascade"`. The switch + `assertNever` ensures a
  // future standalone `kind` literal added without extending `isInfoKind`
  // becomes a compile error here.
  switch (message.kind) {
    case undefined:
    case "cascade":
      // Cascade body falls through below. RLD-05 / D-07: the disable
      // command's realized (disabled) rows stamp `needsReload: true`, so the
      // reload-hint is driven by the per-row stamp, not by a distinguishing
      // kind.
      break;
    default:
      assertNever(message);
      return;
  }

  // Cascade body. Caller-supplied order honored end-to-end (no internal
  // sort). An empty top-level marketplaces array renders the
  // "(no marketplaces)" sentinel rather than the empty string; one blank
  // line between marketplace blocks.
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  // OUT-03 / OUT-04 / D-04: the per-operation tally renders on PLURAL ops
  // (cardinality === "plural"), sits AFTER the body and BEFORE the reload-hint
  // trailer, and is empty for single-target / legacy emissions.
  const tally = composeTally(message);

  // Compute reload-hint per the state-change trigger ladder and append it
  // with one blank line.
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withTally = foldTallyAndHint(body, tally, hint);

  // Emit through the shared summary seam (GRAM-04). At info severity the body
  // emits unchanged; at error/warning severity the summary is prepended as its
  // own block, with the tally + reload-hint already folded last:
  // `{summary}\n\n{cascade body}\n\n{tally}\n\n{reload-hint}` (UXG-07 / GRAM-01 /
  // OUT-03).
  emitWithSummary(ctx, message, withTally);
}

/**
 * D-02 adapter seam shared by both context-cascade emitters: compose and emit a
 * cascade exactly like the cascade arm of `notify()` above, but dispatch each
 * per-plugin row body through a caller-supplied `renderPluginRowBody` instead of
 * the central `renderPluginRow` switch. The `notifyWithContext` entry point in
 * `shared/notify-context.ts` passes `(row, probe, mpScope) =>
 * context.render[row.status](row, probe, mpScope)` so the per-row bytes come
 * from the command's own render map, while the marketplace header, description
 * lines, cause-chain trailers, rollback-partial lines, the empty
 * `(no marketplaces)` sentinel, and the severity/summary `emitWithSummary` seam
 * all stay byte-identical to the legacy path. Each render map reproduces the
 * EXACT bytes of the central switch arm it lifts, so this dispatch yields output
 * byte-identical to `notify()` for every migrated command (proven by that
 * command's catalog-uat run).
 *
 * SEV-02 / RLD-02: severity and the reload-hint come from the rows' caller-
 * stamped `severity` / `needsReload` -- `emitWithSummary` -> `computeSeverity`
 * MAX-reduces the stamped severities, and the `hint` arg is the caller's
 * reload-hint decision (the reconcile applied-cascade passes `""`, the plain
 * cascade passes the OR-reduced `shouldEmitReloadHint` trailer). The single
 * soft-dep probe (`softDepStatus(pi)`) and the single `ctx.ui.notify` call
 * (IL-2, via `emitWithSummary`) discipline is preserved.
 */
function emitCascadeWith(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: CascadeNotificationMessage | ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
  hint: string,
): void {
  const probe = softDepStatus(pi);

  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  // OUT-03 / OUT-04 / D-04: trailing per-operation tally for plural cascades,
  // placed between the body and the reload-hint trailer.
  const tally = composeTally(message);
  const withTally = foldTallyAndHint(body, tally, hint);

  emitWithSummary(ctx, message, withTally);
}

/**
 * The state-change context-cascade emitter (the `notifyWithContext` seam). The
 * reload-hint is the OR-reduce of the rows' caller-stamped `needsReload`
 * (`shouldEmitReloadHint`, RLD-02).
 */
export function emitContextCascade(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  emitCascadeWith(ctx, pi, message, renderPluginRowBody, hint);
}

/**
 * UGRM-01 / UGRM-02: the never-silent no-op emitter for a bulk `update` that
 * realized ZERO transitions (0 updated, 0 failures, 0 warnings). Renders the
 * surviving cascade body (if any) via the caller's render map, then folds the
 * hard-coded `Plugin update: nothing to update` headline in the SAME tally slot
 * the normal path uses -- so the line can NEVER vanish (a `tally {count: 0}`
 * override would collapse to `""` in `composeTally`; this owns the headline
 * instead). Two cases, both at info severity with NO reload-hint:
 *   (a) Empty cascade (all up-to-date): no body -> emit ONLY the headline (NOT
 *       the `(no marketplaces)` sentinel).
 *   (b) Non-empty cascade (e.g. a benign `(partially-upgradable)` decline): render
 *       the body, then the headline below it.
 * IL-2: exactly one `ctx.ui.notify` call via `emitWithSummary` (which emits the
 * body unchanged at info severity -- no summary prefix).
 */
export function emitUpdateNoOpCascade(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: CascadeNotificationMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  const probe = softDepStatus(pi);

  const blocks = message.marketplaces.map((mp) => {
    const lines: string[] = [renderMpHeader(mp, probe)];
    for (const p of mp.plugins) {
      lines.push(...composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody));
    }

    return lines.join("\n");
  });
  // Empty cascade -> "" (NOT the `(no marketplaces)` sentinel): the no-op
  // headline alone is the never-silent output.
  const body = blocks.join("\n\n");

  // Fold the fixed headline into the tally slot (`{body}\n\n{headline}` when a
  // body survives; just `{headline}` when empty). No reload-hint -- nothing
  // changed on disk.
  const withHeadline = foldTallyAndHint(body, UPDATE_NO_OP_HEADLINE, "");

  emitWithSummary(ctx, message, withHeadline);
}

/**
 * RECON-04 / D-02 adapter seam: emit the `reconcile-applied-cascade` standalone
 * envelope through the shared cascade emitter. Like `dispatchInfoMessage`'s
 * standalone applied-cascade arm, NO reload-hint trailer is appended (a
 * load-time applied cascade is a standalone info kind, not a state-change
 * cascade), so the `hint` arg is `""` -- matching the legacy applied-cascade
 * byte form exactly (OUT-03 / OUT-04 / OUT-06 / D-03 / D-04).
 */
export function emitReconcileAppliedContextCascade(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: ReconcileAppliedCascadeMessage,
  renderPluginRowBody: (
    p: PluginNotificationMessage,
    probe: SoftDepStatus,
    mpScope: Scope,
  ) => string,
): void {
  emitCascadeWith(ctx, pi, message, renderPluginRowBody, "");
}

/**
 * `composePluginLines` parameterized over the per-row body renderer (D-02).
 * Byte-identical to `composePluginLines` except the column-0-indented row body
 * comes from `renderRow` rather than the central `renderPluginRow`. The
 * description / cause-chain / rollback-partial trailing lines stay composed by
 * the shared helpers so a migrated command's render map only owns the single
 * row line, never the multi-line trailers (those route through the central
 * path-redaction seam, NFR-9).
 */
function composePluginLinesWith(
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
  renderRow: (p: PluginNotificationMessage, probe: SoftDepStatus, mpScope: Scope) => string,
): string[] {
  const lines: string[] = [`  ${renderRow(p, probe, mpScope)}`];

  // PL-4 (RLD-04 / D-08): the list inventory rows (`installed` / `upgradable`
  // / `available` / `remote` / `unavailable` / `partially-available` /
  // `disabled` / `partially-installed` / `partially-upgradable`) carry the
  // manifest description; cascade `installed` rows never set `description`, so
  // the guard keeps them single-line.
  if (
    (p.status === "installed" ||
      p.status === "upgradable" ||
      p.status === "available" ||
      p.status === "remote" ||
      p.status === "unavailable" ||
      p.status === "partially-available" ||
      p.status === "disabled" ||
      p.status === "partially-installed" ||
      p.status === "partially-upgradable") &&
    p.description !== undefined &&
    p.description.length > 0
  ) {
    lines.push(`    ${truncateDescription(p.description)}`);
  }

  // SEV-02 / D-69-03 / XSURF-01: the partially-available install-failure row
  // carries a 4-space-indented install-worded `--partial` hint trailer. The row
  // surfaces as `unavailable` (Phase-72 structural arm) or `partially-available`
  // (resolver-state-driven token, XSURF-01); the structural `unavailable` arm
  // omits `partialHint` -- `--partial` cannot help. The hint references the user's own
  // flag only and interpolates no plugin / marketplace identifier (T-69-01).
  // D-70-01: the byte form is FROZEN as the reconciled DOC contract, locked
  // byte-for-byte in docs/output-catalog.md and docs/messaging-style-guide.md.
  if (
    (p.status === "unavailable" || p.status === "partially-available") &&
    p.partialHint === true
  ) {
    lines.push(`    ${PARTIAL_INSTALL_HINT_TRAILER}`);
  }

  // SEV-04 / XSURF-03: the partially-upgradable manual update-decline row carries a
  // 4-space-indented update-worded `--partial` hint trailer. The list inventory
  // `partially-upgradable` row omits `partialHint` and stays byte-frozen.
  if (p.status === "partially-upgradable" && p.partialHint === true) {
    lines.push(`    ${PARTIAL_UPDATE_HINT_TRAILER}`);
  }

  if (p.status === "failed" || p.status === "manual recovery") {
    const trailer = renderIndentedCauseChain(p.cause, "    ");
    if (trailer !== "") {
      lines.push(trailer);
    }

    for (const leak of collectManualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
  }

  lines.push(...composeRollbackPartialLines(p));
  return lines;
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
): (message: string, severity?: Severity) => void {
  return (message: string, severity?: Severity): void => {
    if (severity === undefined) {
      ctx.ui.notify(message);
    } else {
      ctx.ui.notify(message, severity);
    }
  };
}
