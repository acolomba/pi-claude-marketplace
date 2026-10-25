import { appendHooksBlock } from "./concerns/hooks.ts";
import { formatCauseChain } from "./errors.ts";
import { composeMcpConfigNoticesText, composeMcpMigrationText } from "./notification-mcp.ts";
import { RAW_SURFACE_SEVERITY } from "./notification-resolve.ts";
import { tallyCategory } from "./notification-summary.ts";

import type { SerializedCauseChain } from "./errors.ts";
import type {
  ResolvedEnvelope,
  ResolvedFailure,
  ResolvedMarketplace,
  ResolvedRawSurface,
  ResolvedRow,
  ResolvedTally,
  RowHint,
} from "./notification-resolve.ts";
import type {
  MarketplaceDetails,
  MarketplaceInfoCascadeMessage,
  MarketplaceInfoMessage,
  MarketplaceNotAddedMessage,
  McpServerSummaryEntry,
  PluginInfoCascadeMessage,
  PluginInfoComponentsResolved,
  PluginInfoMessage,
  PluginInfoRow,
  PluginFailedMessage,
  PluginNotificationMessage,
  PluginPartiallyInstalledMessage,
  PluginReinstalledMessage,
  PluginUpdatedMessage,
  PluginWillUpdateMessage,
  PruneEmptyMessage,
  Reason,
  ReconcilePendingEmptyMessage,
  Severity,
  VersionCommits,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";

/**
 * Exact notification grammar. Severity and the summary line are resolved in
 * notification-resolve.ts; this module only formats them.
 */

// ---------------------------------------------------------------------------
// Grammar rendering helpers -- file-private.
//
// SNM-17 / SNM-18 contract: the marketplace-header grammar and per-status
// icon discipline live HERE as the sole site that knows them.
// entry point.
// ---------------------------------------------------------------------------

const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";
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
 * D-80-01: uses `◍` (U+25CD, circle with vertical fill), distinct from `◌`
 * (U+25CC, dotted circle), which `ICON_REMOTE` uses instead.
 */
const ICON_DISABLED = "◍";

const ICON_REMOTE = "◌";

/**
 * FSTAT-02 / D-66-03: dedicated glyph for a `partially-installed` row -- a
 * recorded-installed plugin that currently re-resolves `partially-available` (installed
 * with one or more components dropped). DISTINCT from `ICON_INSTALLED` (`●`) so
 * the degraded install is visually separable from a clean `(installed)` row.
 * `partially-upgradable` deliberately REUSES `ICON_INSTALLED` (the row is currently
 * clean -- only its candidate would degrade), mirroring the `upgradable`
 * precedent.
 */
const ICON_PARTIALLY_INSTALLED = "◉";

/**
 * USTAT-02 / D-64-01: dedicated glyph for a not-installed, partially-available
 * `partially-available` row (`⊖` U+2296, circled minus) -- a plugin whose manifest is
 * sound but carries unsupported kinds (LSP, partial hooks, or other
 * components). Thus, `--partial` can install its supported components. Stays in the circled-
 * operator family with `ICON_UNINSTALLABLE` (`⊘`) but reads "diminished /
 * components dropped" rather than "blocked". DISTINCT from `⊘`
 * (`ICON_UNINSTALLABLE`, reserved for unavailable / blocked / failed / manual-
 * recovery) and from `◉` (`ICON_PARTIALLY_INSTALLED`, the *installed*-degraded row).
 *
 * Module-private: two places carry this glyph to a row -- `PLUGIN_ROW_LAYOUT`
 * below and `pluginInfoStatusGlyph`'s `partially-available` arm,
 * which the `info` plugin row joins -- so those rows' bytes are its public
 * contract.
 */
const ICON_PARTIALLY_AVAILABLE = "⊖";

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

export function renderMpHeader(mp: ResolvedMarketplace): string {
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
      // rows, e.g. `marketplace add`). mp-level rows never emit soft-dep
      // markers (mirrors the "skipped" arm). composeReasons returns "" when
      // reasons is undefined/empty, so the bare `(failed)` byte form
      // (update/autoupdate mp-failure states that ride the cause on a child row)
      // is preserved unchanged.
      const reasonsBrace = composeReasons(mp.reasons);
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
      // off-marker. The chevron token is written out here and in the
      // `already no autoupdate` skipped arm below -- those two literals are its
      // only spellings. Does NOT carry mp.reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate>`;
    case "skipped": {
      // The "skipped" arm is SHARED across mp-level skips (UXG-05's
      // `(skipped) {up-to-date}`, the idempotent autoupdate no-ops, etc.). The
      // reasons brace is formatted via composeReasons, the helper that backs
      // plugin-level skipped rows. mp-level skipped never emits
      // {requires pi-subagents} / {requires pi-mcp-adapter} markers; resolve
      // composes those on plugin rows only. composeReasons returns "" when mp.reasons is undefined
      // or empty, so the conditional join collapses cleanly with no trailing
      // space.
      const reasonsBrace = composeReasons(mp.reasons);
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

    case "will add":
      // D-20: pending-tense marketplace header. Names only the marketplace
      // and scope, never its declared source, and carries no reasons.
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (will add)`;
    case "will remove":
      return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (will remove)`;
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
  }
}

// ---------------------------------------------------------------------------
// MOD-03 / D-02 / D-10: every producer routes its rows through
// `notifyWithContext` / `notifyReconcileAppliedWithContext`. `resolveRows`
// applies the command's own `rowPolicies`, and `composePluginLines` formats
// each resolved row through `PLUGIN_ROW_LAYOUT`. That table is total over the
// plugin status union, so a new `PluginNotificationMessage` variant is a type
// error there.
//
// SNM-16 / D-12: `resolveRows` composes soft-dep markers from the row's
// `dependencies`, the soft-dep snapshot, and the command's marker policy, so
// each row arrives with its final `reasons`.
// ---------------------------------------------------------------------------

/**
 * Join tokens with single spaces, suppressing empty slots so absent
 * optional tokens (e.g. an undefined scope-bracket on `available` rows)
 * never produce a double-space. Single canonical implementation.
 */
// D-notification-refactor-01-11: the row-composition primitives below (joinTokens, renderScopeBracket,
// renderVersion, composeVersionArrow, composeReasons) stay declared HERE as
// the single source of the byte-stable presentation vocabulary.
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
function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${formatShaVersionForDisplay(formatHashVersionForDisplay(version))}`;
}

function renderScopeBracket(pluginScope: Scope | undefined, mpScope: Scope): string {
  if (pluginScope === undefined || pluginScope === mpScope) {
    return "";
  }

  return `[${pluginScope}]`;
}

/**
 * The `from → to` version slot. UPR-02: when the row carries `commits`, each
 * side's version is followed by its commit's first 7 characters in
 * parentheses. The producer decides whether a row carries them.
 */
function composeVersionArrow(
  from: string,
  to: string | undefined,
  commits?: VersionCommits,
): string {
  if (commits === undefined) {
    return `${renderVersion(from)} → ${renderVersion(to)}`;
  }

  return `${renderVersion(from)} (${shortCommit(commits.from)}) → ${renderVersion(to)} (${shortCommit(commits.to)})`;
}

function shortCommit(commit: string): string {
  return commit.slice(0, 7);
}

/**
 * Format a resolved MSG-GR-4 reasons list as its brace: `""` when the list is
 * undefined or empty (MSG-GR-4 forbids `{}`), otherwise `{<r1>, <r2>, ...}`.
 * Plugin rows reach their renderers resolved, so any soft-dep marker is
 * already in `reasons` (D-12); this helper adds nothing to the list.
 *
 * Single canonical implementation.
 *
 * The reasons array is the closed `Reason` set end-to-end: every caller passes
 * either a `readonly Reason[]` or `undefined`. Typing the parameter as `Reason`
 * rejects out-of-set strings at the call sites at compile time (CMC-11
 * closed-set discipline).
 */
function composeReasons(reasons: readonly Reason[] | undefined): string {
  if (reasons === undefined || reasons.length === 0) {
    return "";
  }

  return `{${reasons.join(", ")}}`;
}

/** Text-only row layout; semantic reason selection happens in resolution. */
interface PluginRowLayout {
  readonly icon: string;
  readonly scope: boolean;
  /**
   * `move` draws `from → version` when the row carries `from` (UPR-03), and
   * the single version otherwise.
   */
  readonly version: "single" | "arrow" | "move" | "none";
}

const PLUGIN_ROW_LAYOUT = {
  installed: { icon: ICON_INSTALLED, scope: true, version: "single" },
  updated: { icon: ICON_INSTALLED, scope: true, version: "arrow" },
  reinstalled: { icon: ICON_INSTALLED, scope: true, version: "move" },
  uninstalled: { icon: ICON_AVAILABLE, scope: true, version: "single" },
  available: { icon: ICON_AVAILABLE, scope: false, version: "single" },
  remote: { icon: ICON_REMOTE, scope: false, version: "single" },
  unavailable: { icon: ICON_UNINSTALLABLE, scope: false, version: "single" },
  "partially-available": { icon: ICON_PARTIALLY_AVAILABLE, scope: false, version: "single" },
  upgradable: { icon: ICON_INSTALLED, scope: true, version: "single" },
  "partially-installed": { icon: ICON_PARTIALLY_INSTALLED, scope: true, version: "move" },
  "partially-upgradable": { icon: ICON_INSTALLED, scope: true, version: "single" },
  skipped: { icon: ICON_UNINSTALLABLE, scope: true, version: "single" },
  failed: { icon: ICON_UNINSTALLABLE, scope: true, version: "move" },
  "manual recovery": { icon: ICON_UNINSTALLABLE, scope: true, version: "single" },
  "will install": { icon: ICON_INSTALLED, scope: true, version: "none" },
  "will uninstall": { icon: ICON_AVAILABLE, scope: true, version: "single" },
  "will enable": { icon: ICON_INSTALLED, scope: true, version: "none" },
  "will disable": { icon: ICON_DISABLED, scope: true, version: "none" },
  "will update": { icon: ICON_INSTALLED, scope: true, version: "arrow" },
  disabled: { icon: ICON_DISABLED, scope: true, version: "single" },
} as const satisfies Record<PluginNotificationMessage["status"], PluginRowLayout>;

function formatPluginRow(row: ResolvedRow, mpScope: Scope): string {
  if (row.missingPolicy === true) {
    return `${"name" in row ? row.name : "?"} (failed) {internal: no render arm for "${row.status}"}`;
  }

  const layout: PluginRowLayout = PLUGIN_ROW_LAYOUT[row.status];
  const version = renderVersionSlot(row, layout.version);
  const status =
    row.status === "will install" && row.partial === true ? "will partially install" : row.status;
  return joinTokens([
    layout.icon,
    row.name,
    renderScopeBracket(layout.scope && "scope" in row ? row.scope : undefined, mpScope),
    version,
    `(${status})`,
    composeReasons(row.reasons),
  ]);
}

function renderVersionSlot(row: ResolvedRow, mode: PluginRowLayout["version"]): string {
  switch (mode) {
    case "single":
      return renderVersion("version" in row ? row.version : undefined);
    case "arrow": {
      // Only the updated and will-update layouts select the from/to version slot.
      const updated = row as ResolvedRow<PluginUpdatedMessage | PluginWillUpdateMessage>;
      return composeVersionArrow(updated.from, updated.to, updated.commits);
    }

    case "move": {
      // Only the reinstalled, partially-installed, and failed layouts select it.
      const moved = row as ResolvedRow<
        PluginReinstalledMessage | PluginPartiallyInstalledMessage | PluginFailedMessage
      >;
      return moved.from === undefined
        ? renderVersion(moved.version)
        : composeVersionArrow(moved.from, moved.version, moved.commits);
    }

    case "none":
      return "";
  }
}

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
 * CR-01 / D-98-03: the stale-gate enable-failure remediation trailer. DISTINCT
 * from `PARTIAL_UPDATE_HINT_TRAILER` because the command that just failed is
 * `enable`, which accepts no `--partial` flag (`edge/handlers/plugin/
 * enable-disable.ts` parses a positional ref plus `--scope` / `--local` only) --
 * a "re-run" instruction there names the wrong command and earns the user an
 * `Unknown flag` usage error. This literal names `update` explicitly and states
 * the follow-up `enable`, which is the remedy the catalog documents. Interpolates
 * no plugin / marketplace identifier (T-73-01) and is locked byte-for-byte in
 * docs/output-catalog.md and docs/messaging-style-guide.md.
 */
const STALE_GATE_UPDATE_HINT_TRAILER = "Run update --partial on this plugin, then enable it again.";

/**
 * D-24: the catalog decline's hint trailer, rendered below the
 * partially-upgradable row `pending`, the load and `apply` give a catalog move
 * that would drop components without consent. DISTINCT from
 * `PARTIAL_UPDATE_HINT_TRAILER` because the command that holds the row is
 * `apply` or `pending`, which take no `--partial`: the remedy names the
 * per-plugin `update` consent command instead. Interpolates no plugin /
 * marketplace identifier (T-73-01) and is locked byte-for-byte in
 * docs/output-catalog.md and docs/messaging-style-guide.md.
 */
const CATALOG_PARTIAL_UPDATE_HINT_TRAILER =
  "Run update --partial on this plugin to update it with the supported components.";

/**
 * OUT-04 / D-102-10: the enable-hint trailer literal, rendered below an
 * install-disabled `(disabled)` row. The install materialized nothing the user
 * can reach, so the row alone leaves them with a fact and no next step; this
 * names the real, runnable `enable` verb. Interpolates no plugin / marketplace
 * / version identifier and no filesystem path (T-69-01), and names no flag that
 * does not exist. This byte form is FROZEN -- do not change the wording.
 */
const ENABLE_HINT_TRAILER = "Run enable on this plugin to use its components.";

/**
 * D-10: each resolved hint id mapped to its frozen trailer literal. The map is
 * total over `RowHint`, so a new hint id fails typecheck here until it has
 * text.
 */
const ROW_HINT_TRAILERS = {
  "partial-install": PARTIAL_INSTALL_HINT_TRAILER,
  "partial-update": PARTIAL_UPDATE_HINT_TRAILER,
  "catalog-partial-update": CATALOG_PARTIAL_UPDATE_HINT_TRAILER,
  "stale-gate-update": STALE_GATE_UPDATE_HINT_TRAILER,
  enable: ENABLE_HINT_TRAILER,
} as const satisfies Record<RowHint, string>;

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

/** Encode an info-only view; never alter the parsed policy used for matching. */
function renderAllowedMarketplaces(names: readonly string[]): string {
  return JSON.stringify(names).replace(
    /[\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069]/g,
    (character) => String.raw`\u${Number(character.codePointAt(0)).toString(16).padStart(4, "0")}`,
  );
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
 *     -- description wrapping is `plugin info`-only per INFO-02),
 *   - `allowed_marketplaces:` for a nonempty parsed policy, escaped as one
 *     compact JSON array without changing the parsed strings.
 *
 * Joins all lines with `\n`. Info messages do not emit soft-dep markers.
 * File-private; sole caller is `notify()` dispatcher.
 */
export function renderMarketplaceInfo(message: MarketplaceInfoMessage): string {
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

  if (message.allowedMarketplaces !== undefined && message.allowedMarketplaces.length > 0) {
    lines.push(`allowed_marketplaces: ${renderAllowedMarketplaces(message.allowedMarketplaces)}`);
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
 * File-private; sole caller is `notify()` dispatcher.
 */
export function renderMarketplaceInfoCascade(message: MarketplaceInfoCascadeMessage): string {
  return message.blocks.map((b) => renderMarketplaceInfo(b)).join("\n\n");
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
 * Its sole production caller is the text strategy's presentation formatter.
 */
export function renderPluginInfoCascade(message: PluginInfoCascadeMessage): string {
  return message.blocks.map((b) => renderPluginInfo(b)).join("\n\n");
}

/**
 * Map a `PluginInfoRow` status literal to its rendering glyph.
 * `installed` -> `●`, `available` -> `○`,
 * `unavailable | failed` -> `⊘`. Exhaustive switch with no default arm,
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
    case "disabled":
      // D-100-08 / ENBL-17: info row for a disabled record -- the existing
      // `◍` glyph, so the slot stays byte-identical to the disabled list row.
      return ICON_DISABLED;
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
  }
}

type ComponentKind = keyof PluginInfoComponentsResolved["components"];

// The renderer emits one line per member of this tuple, so a kind the
// interface declares but this tuple omits renders nowhere. `as const` is what
// keeps each member's LITERAL type, and the coverage proof below is what turns
// an omission into a build failure; `satisfies` catches the other direction, a
// member that is not a kind at all. Annotating the tuple with `ComponentKind`
// slots instead would erase the literals and make the proof vacuous -- every
// slot would report the whole union and `Exclude` would always answer `never`.
const COMPONENT_KIND_NAMES = [
  "agents",
  "commands",
  "hooks",
  "mcp",
  "skills",
  "workflows",
] as const satisfies readonly ComponentKind[];

type _AssertNever<T extends never> = T;
type _UncoveredComponentKind = Exclude<ComponentKind, (typeof COMPONENT_KIND_NAMES)[number]>;
type _ComponentKindsCoverageProof = _AssertNever<_UncoveredComponentKind>;

// INFO-02 / WFLW-04 completeness proof: a non-never `_ComponentKindsCoverageProof`
// is a TS2344 build failure naming the uncovered kind. The proof is consumed
// here, by the tuple it guards, rather than exported for a caller who has no
// use for it.
const COMPONENT_KINDS = COMPONENT_KIND_NAMES satisfies readonly Exclude<
  ComponentKind,
  _ComponentKindsCoverageProof
>[];

/**
 * Append the per-kind component lines, the optional `requires:` line and the
 * optional dependencies line for a resolved `PluginInfoRow`, in that order.
 * Per-kind order is alphabetical
 * (`agents`, `commands`, `hooks`, `mcp`, `skills`, `workflows`); within each
 * kind, names render in the caller-supplied order. The orchestrator pre-sorts;
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
  requires: PluginInfoComponentsResolved["requires"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    if (kind === "hooks") {
      appendHooksBlock(lines, components.hooks);
      continue;
    }

    if (kind === "mcp") {
      appendMcpLine(lines, components.mcp);
      continue;
    }

    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }

  appendRequiresLine(lines, requires);
  appendDependenciesLine(lines, dependencies);
}

/**
 * ANAME-07 / AVAR-04 / AVAR-05 / ASTAT-01: appends the optional
 * `    mcp: <list>` line. Each entry is the server's Claude name. A left-out
 * server adds ` (unsupported <feature>)` and never a state. A written server
 * adds its state first, then its unset and withheld variable names, as
 * ` (state; unset A, B; withheld C)`, each part only when present or
 * non-empty. The entries arrive stamped and sorted.
 */
function appendMcpLine(
  lines: string[],
  entries: PluginInfoComponentsResolved["components"]["mcp"],
): void {
  if (entries !== undefined && entries.length > 0) {
    lines.push(`    mcp: ${entries.map((entry) => mcpEntryText(entry)).join(", ")}`);
  }
}

function mcpEntryText(entry: McpServerSummaryEntry): string {
  if (entry.unsupportedFeature !== undefined) {
    return `${entry.name} (unsupported ${entry.unsupportedFeature})`;
  }

  const parts = [
    ...(entry.status === undefined ? [] : [entry.status]),
    ...variablePart("unset", entry.unsetVariables),
    ...variablePart("withheld", entry.withheldVariables),
  ];
  return parts.length === 0 ? entry.name : `${entry.name} (${parts.join("; ")})`;
}

function variablePart(label: string, names: readonly string[] | undefined): string[] {
  return names === undefined || names.length === 0 ? [] : [`${label} ${names.join(", ")}`];
}

/**
 * ADET-01: appends the optional `    requires: <list>` line. Each entry is the
 * companion name, followed by ` (missing)` when the orchestrator tagged it
 * missing. The orchestrator stamps and sorts the entries; the renderer only
 * formats them and takes no probe of its own.
 */
function appendRequiresLine(
  lines: string[],
  requires: PluginInfoComponentsResolved["requires"],
): void {
  if (requires !== undefined && requires.length > 0) {
    const entries = requires.map(({ companion, missing }) =>
      missing ? `${companion} (missing)` : companion,
    );
    lines.push(`    requires: ${entries.join(", ")}`);
  }
}

/**
 * Appends the optional `    dependencies: <list>` line. Both `renderPluginInfo`
 * arms end with this line, so it is LAST: after every per-kind line and the
 * optional `requires:` line on the resolved arm, and after the
 * `components: not resolved` marker on the unresolved arm (INFO-02 / D-01-32).
 */
function appendDependenciesLine(
  lines: string[],
  dependencies: readonly string[] | undefined,
): void {
  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}

/**
 * TYPE-01 / D-46-01a: render the dedicated `MarketplaceNotAddedMessage`
 * variant. Emits a bare column-0 row
 * `⊘ <name> [scope?] (failed) {marketplace not added}` with NO marketplace header (the row
 * IS the message). `name` carries the MARKETPLACE name. `scope` present =>
 * `[scope]` bracket; absent => no bracket. The version slot collapses to `""`
 * (the variant carries no version) and the brace carries the single `reason`
 * token `resolveNotAddedReason` chose (the variant carries no `reasons` field):
 * `marketplace not added`, or a scope-qualified sibling such as
 * `marketplace not added to user scope`.
 *
 * The brace is formatted by `composeReasons`, which adds nothing to the one
 * token -- info-surface rows NEVER emit soft-dep markers.
 */
export function renderMarketplaceNotAdded(
  message: MarketplaceNotAddedMessage,
  reason: Reason,
): string {
  return joinTokens([
    ICON_UNINSTALLABLE,
    message.name,
    message.scope === undefined ? "" : `[${message.scope}]`,
    renderVersion(undefined),
    "(failed)",
    composeReasons([reason]),
  ]);
}

/**
 * DIFF-01 / D-08 / D-14: the `reconcile-pending-empty` body line. The bytes are
 * locked to the `empty-steady-state` state of the pending section and the
 * `nothing-to-change` state of the apply section in `docs/output-catalog.md`.
 * The caller folds the message's advisories after it.
 */
export function renderReconcilePendingEmpty(
  command: ReconcilePendingEmptyMessage["command"],
): string {
  switch (command) {
    case "pending":
      return "Pending: /claude:plugin apply has nothing to change.";
    case "apply":
      return "Apply: nothing to change.";
  }
}

/** The `prune-empty` body: the scope held no orphaned dependency installs. */
export function renderPruneEmpty(message: PruneEmptyMessage): string {
  return `Nothing to prune in ${message.scope} scope: no orphaned dependency installs were found.`;
}

/**
 * The `prune-committed-warning` body: the scope line, then the cause line
 * indented two spaces, or nothing after the indent when there is no cause. It
 * takes the scope and the serialized chain, not the message, whose `cause` is
 * a live `Error`: the presentation step serializes and redacts the chain.
 */
export function renderPruneCommittedWarning(
  scope: Scope,
  cause: SerializedCauseChain | undefined,
): string {
  const causeTrailer = cause === undefined ? "" : formatCauseChain(cause);
  return `Prune committed in ${scope} scope.\n  ${causeTrailer}`;
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
 * `requires:` line + optional `dependencies:` line
 * (componentsResolved: true), or the single marker line
 * `    components: not resolved` followed by the same optional
 * `dependencies:` line (componentsResolved: false, D-01-32). The resolved
 * line order is components, `requires:`, `dependencies:`, then `note:`.
 *
 * Reasons brace via `composeReasons`, which formats `plugin.reasons` as
 * given -- info messages NEVER emit soft-dep markers. ADET-01: the companions
 * a resolved row needs render once, on the `requires:` line the orchestrator
 * stamped.
 *
 * WR-09: `notes` renders LAST -- after the component block and after any
 * `dependencies:` line -- as one `    note: <text>` line per entry. A row that
 * carries none is byte-unchanged.
 *
 * SORT PRECONDITION: per-kind arrays, `requires` and `dependencies` MUST be
 * pre-sorted at message construction. The renderer does not sort.
 */
export function renderPluginInfo(message: PluginInfoMessage): string {
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

  const pluginRowLine = joinTokens([
    pluginInfoStatusGlyph(plugin.status),
    plugin.name,
    renderScopeBracket(plugin.scope, message.marketplaceScope),
    renderVersion(plugin.version),
    `(${plugin.status})`,
    composeReasons(plugin.reasons),
  ]);
  lines.push(`  ${pluginRowLine}`);

  if (plugin.description !== undefined && plugin.description.length > 0) {
    lines.push(...wrapDescription(plugin.description, 4, DESCRIPTION_MAX_COLS));
  }

  // INFO-02 / INFO-05: per-kind components OR the unresolved marker.
  switch (plugin.componentsResolved) {
    case true:
      appendResolvedComponentLines(lines, plugin.components, plugin.requires, plugin.dependencies);
      break;

    case false:
      lines.push("    components: not resolved");
      // D-01-32: the cold git-source `(remote)` row carries the entry-declared list.
      appendDependenciesLine(lines, plugin.dependencies);
      break;
  }

  // WR-09: per-file advisories LAST, after every component line and after the
  // `dependencies:` line, one per entry in the order the composer supplied.
  // The label is a fixed token: the byte form is pinned by the output catalog.
  for (const note of plugin.notes ?? []) {
    lines.push(`    note: ${note}`);
  }

  return lines.join("\n");
}

/**
 * Compose the single-marketplace block: header line followed by one composed
 * plugin block per `mp.plugins[]` entry, in caller order. Joined
 * with `\n` to produce the block string that `composeReconcileAppliedBody`
 * then joins with `\n\n` between marketplaces.
 */
function composeMarketplaceBlock(mp: ResolvedMarketplace): string {
  // The header formats `mp.reasons` as given; resolve composes soft-dep
  // markers on plugin rows only, so none can leak onto an mp-level row.
  const lines: string[] = [renderMpHeader(mp)];
  for (const p of mp.plugins) {
    lines.push(...composePluginLines(p, mp.scope));
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
export function composeReconcileAppliedBody(marketplaces: readonly ResolvedMarketplace[]): string {
  const blocks = marketplaces.map((mp) => composeMarketplaceBlock(mp));
  return blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
}

/**
 * PL-4: which rows carry the manifest description, as a TOTAL map over the
 * status union so a new variant fails `npm run check` rather than silently
 * losing its description line. The list inventory rows carry it; a cascade
 * `installed` row never sets `description`, so those stay single-line.
 */
const DESCRIPTION_BEARING_STATUS = {
  installed: true,
  upgradable: true,
  available: true,
  remote: true,
  unavailable: true,
  "partially-available": true,
  disabled: true,
  "partially-installed": true,
  "partially-upgradable": true,
  updated: false,
  reinstalled: false,
  uninstalled: false,
  failed: false,
  skipped: false,
  "manual recovery": false,
  "will install": false,
  "will uninstall": false,
  "will enable": false,
  "will disable": false,
  "will update": false,
} as const satisfies Record<PluginNotificationMessage["status"], boolean>;

/**
 * The statuses the map above marks description-bearing, read back off that map
 * so the predicate's narrowing and its runtime decision come from one place and
 * cannot drift apart.
 */
type DescriptionBearingStatus = {
  [K in PluginNotificationMessage["status"]]: (typeof DESCRIPTION_BEARING_STATUS)[K] extends true
    ? K
    : never;
}[PluginNotificationMessage["status"]];

/** Narrow to the rows whose variant carries an optional `description`. */
function isDescriptionBearingRow(
  p: ResolvedRow,
): p is Extract<ResolvedRow, { status: DescriptionBearingStatus }> {
  return DESCRIPTION_BEARING_STATUS[p.status];
}

/**
 * Composes a resolved row, then its description, hint, and failure trailers.
 *
 * D-13: the argument's type must not contain a producer row that declares
 * `dependencies`, because `resolveRows` composes those markers into `reasons`.
 * The check runs on each member of a union argument.
 */
export function composePluginLines<R extends ResolvedRow>(
  p: R &
    ([R extends unknown ? ("dependencies" extends keyof R ? R : never) : never] extends [never]
      ? unknown
      : never),
  mpScope: Scope,
): string[] {
  const lines: string[] = [`  ${formatPluginRow(p, mpScope)}`];

  if (isDescriptionBearingRow(p) && p.description !== undefined && p.description.length > 0) {
    lines.push(`    ${truncateDescription(p.description)}`);
  }

  // D-10: the resolved hint id selects its frozen 4-space-indented trailer.
  // The literals interpolate nothing (T-69-01).
  if (p.hint !== undefined) {
    lines.push(`    ${ROW_HINT_TRAILERS[p.hint]}`);
  }

  if (p.failure !== undefined) {
    lines.push(...composeFailureLines(p.failure));
  }

  return lines;
}

/**
 * D-11 / PMOD-03: the failure lines of a failed or manual-recovery row, or of a
 * realized row carrying a remedy cause, in order: the 4-space cause line, one `    leaked: <path>` line per AS-7 leak,
 * then each rollback phase as a 4-space `[<phase>] (rollback failed)` row with
 * its optional 6-space cause line.
 */
function composeFailureLines(failure: ResolvedFailure): string[] {
  const lines: string[] = [];
  pushCauseLine(lines, failure.cause, "    ");
  for (const leak of failure.leaks) {
    lines.push(`    leaked: ${leak}`);
  }

  for (const entry of failure.rollbackPartial) {
    lines.push(`    [${entry.phase}] (rollback failed)`);
    pushCauseLine(lines, entry.cause, "      ");
  }

  return lines;
}

function pushCauseLine(
  lines: string[],
  chain: SerializedCauseChain | undefined,
  indent: string,
): void {
  if (chain !== undefined) {
    lines.push(`${indent}${formatCauseChain(chain)}`);
  }
}

// ---------------------------------------------------------------------------
// D-10 text strategy: the trailing segments and the summary block.
//
// Grammar mini-spec (documented in docs/output-catalog.md per SNM-19 /
// SNM-20). The wire format of one structured notification is:
//
//   [<summary line>]            <-- iff the envelope is warning or error
//
//   <mp-header-1>
//     <plugin-row-1>
//       [cause-chain at 4-space indent if (failed | manual recovery) with cause,
//        or a realized row whose producer set a cause]
//       [rollback child row at 4-space indent for each rollbackPartial phase]
//       [phase cause-chain at 6-space indent if phase.cause set]
//     <plugin-row-2>
//     ...
//
//   <mp-header-2>
//   ...
//
//   [<advisory lines>]
//
//   [<tally sentence> | <update no-op headline>]
//
//   [/reload to pick up changes]  <-- iff the envelope needsReload
//
//   [/claude:plugin apply to make these changes]  <-- iff the envelope needsApply
//
// Joins / separators:
//   - Plugin row prefix:                "  " (2 spaces)
//   - Cause-chain trailer prefix:       "    " (4 spaces)
//   - rollbackPartial child row prefix: "    " (4 spaces)
//   - rollbackPartial phase cause:      "      " (6 spaces)
//   - Between marketplace blocks:       "\n\n" (one blank line)
//   - Between every present segment:    "\n\n" (one blank line); an absent
//     segment is dropped before joining, so two segments are never separated
//     by two blank lines.
//
// Empty-marketplaces sentinel: "(no marketplaces)" on the plain cascade and
// the reconcile-applied cascade; the update no-op renders no sentinel.
// ---------------------------------------------------------------------------

/** Reload-hint trailer literal. */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

/**
 * APL-04 / D-05: the trailer of a `pending` block that holds a change. It is a
 * fixed literal that names no plugin, marketplace, or path (T-73-01).
 */
const APPLY_HINT_TRAILER = "/claude:plugin apply to make these changes";

/**
 * UGRM-01 / UGRM-02 never-silent no-op headline for a bulk `update` that
 * realized ZERO transitions (all targets up-to-date, OR the only surviving rows
 * are benign info skips such as a `(partially-upgradable)` decline). Hard-coded so
 * the byte form cannot drift from `docs/output-catalog.md`'s `all-up-to-date-noop`
 * / `skip-partially-upgradable-bulk` states -- mirrors the `reconcile-pending-empty`
 * byte-lock precedent. Emitted in PLACE of the tally sentence (a `tally {count: 0}`
 * override resolves to no tally), so the summary line never vanishes.
 */
const UPDATE_NO_OP_HEADLINE = "Plugin update: nothing to update";

/**
 * OUT-03: the tally sentence, `<Operation>: <n> failure(s), <n> warning(s),
 * <n> success(es)`, with the categories in that order and NO terminal period.
 * A category the resolved tally omits is omitted here. An absent tally is `""`.
 */
function tallySentence(tally: ResolvedTally | undefined): string {
  if (tally === undefined) {
    return "";
  }

  const parts: string[] = [];

  if (tally.failures > 0) {
    parts.push(tallyCategory(tally.failures, "failure", "failures"));
  }

  if (tally.warnings > 0) {
    parts.push(tallyCategory(tally.warnings, "warning", "warnings"));
  }

  if (tally.success !== undefined) {
    // UGRM-02: a verb has no plural-s (`1 updated`, `2 updated`).
    const { count, verb } = tally.success;
    parts.push(
      verb === undefined
        ? tallyCategory(count, "success", "successes")
        : tallyCategory(count, verb, verb),
    );
  }

  return `${tally.label}: ${parts.join(", ")}`;
}

/**
 * D-02 / D-15: the exact arguments of one notify call, the text and then an
 * optional severity. The text strategy decides how many there are.
 */
export type NotifyArguments = readonly [text: string] | readonly [text: string, severity: Severity];

/**
 * Formats one resolved envelope around a rendered body. It folds `body`, then
 * the no-op headline or the tally sentence, then the reload trailer, then the
 * apply trailer, dropping each absent segment and joining the rest with one
 * blank line. A warning or error envelope then prepends its summary line as its
 * own block (GRAM-01): one blank line, never a single `\n`, which would glue the
 * host `Error:` / `Warning:` label onto the first detail row. An info envelope
 * carries no summary line.
 *
 * D-15: an info envelope yields one argument, the text alone. A warning or
 * error envelope yields two, the text and its severity.
 */
export function formatEnvelopeArguments(envelope: ResolvedEnvelope, body: string): NotifyArguments {
  const folded = [
    body,
    envelope.noOp ? UPDATE_NO_OP_HEADLINE : tallySentence(envelope.tally),
    envelope.needsReload ? RELOAD_HINT_TRAILER : "",
    envelope.needsApply ? APPLY_HINT_TRAILER : "",
  ]
    .filter((segment) => segment !== "")
    .join("\n\n");

  return envelope.severity === "info"
    ? [folded]
    : [`${envelope.summary}\n\n${folded}`, envelope.severity];
}

/**
 * D-15: formats one resolved raw surface as its notify arguments. Every raw kind
 * passes its severity explicitly, read from `RAW_SURFACE_SEVERITY` (PMOD-01) or,
 * for the migration notice, from its resolved severity, so each emitting arm
 * yields two arguments.
 * `undefined` means nothing is emitted. The diagnostic arm reads the line count
 * and the async-rewake arm reads the summary length, so only a zero-length line
 * list or summary is a no-op (D-05, D-08). Producer strings pass through
 * verbatim.
 */
export function formatRawSurface(surface: ResolvedRawSurface): NotifyArguments | undefined {
  switch (surface.kind) {
    case "usage-error":
      // SNM-13 / D-06: one blank line separates the message from nonempty usage.
      return [
        surface.usage === "" ? surface.message : `${surface.message}\n\n${surface.usage}`,
        RAW_SURFACE_SEVERITY[surface.kind],
      ];
    case "usage-info":
      return [surface.usage, RAW_SURFACE_SEVERITY[surface.kind]];
    case "diagnostic":
      return surface.lines.length === 0
        ? undefined
        : [`${surface.header}\n\n${surface.lines.join("\n")}`, RAW_SURFACE_SEVERITY[surface.kind]];
    case "device-flow-prompt":
      // D-09: the provider's values pass through verbatim.
      return [
        `Open ${surface.verificationUri} and enter: ${surface.userCode}`,
        RAW_SURFACE_SEVERITY[surface.kind],
      ];
    case "async-rewake-summary":
      return surface.summary.length === 0
        ? undefined
        : [surface.summary, RAW_SURFACE_SEVERITY[surface.kind]];
    case "stop-override-cap":
      // D-07: the cap arrives as data from the settle bridge.
      return [
        `Stop hook override cap reached.\n\n\`${surface.pluginId}\`'s Stop hook blocked ${surface.cap} times in a row; the turn ended despite its active block.`,
        RAW_SURFACE_SEVERITY[surface.kind],
      ];
    case "reconcile-aborted":
      return [`reconcile aborted: ${surface.causeMessage}`, RAW_SURFACE_SEVERITY[surface.kind]];
    case "plugin-path-skipped":
      return [
        `plugin PATH not refreshed for ${surface.scope} scope (install state unreadable): ${surface.reason}`,
        RAW_SURFACE_SEVERITY[surface.kind],
      ];
    case "mcp-config-notices":
      return [
        composeMcpConfigNoticesText(surface.section, surface.notices),
        RAW_SURFACE_SEVERITY[surface.kind],
      ];
    case "mcp-migration": {
      // AMIG-03: the reload hint is the notice's last line.
      const text = composeMcpMigrationText(surface.rows, surface.notices);
      return [surface.needsReload ? `${text}\n${RELOAD_HINT_TRAILER}` : text, surface.severity];
    }
  }
}
