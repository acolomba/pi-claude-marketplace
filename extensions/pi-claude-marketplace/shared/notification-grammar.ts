import { appendHooksBlock } from "./concerns/hooks.ts";
import { softDepMarkers } from "./concerns/soft-dep.ts";
import { assertNever, causeChainTrailer, manualRecoveryLeaks } from "./errors.ts";

import type { SoftDepStatus } from "../platform/pi-api.ts";
import type { Dependency } from "./concerns/soft-dep.ts";
import type {
  ContentReason,
  MarketplaceDetails,
  MarketplaceInfoCascadeMessage,
  MarketplaceInfoMessage,
  MarketplaceNotAddedMessage,
  MarketplaceNotificationMessage,
  PluginAvailableMessage,
  PluginDisabledMessage,
  PluginInfoCascadeMessage,
  PluginInfoComponentsResolved,
  PluginInfoMessage,
  PluginInfoRow,
  PluginNotificationMessage,
  PluginPartiallyAvailableMessage,
  PluginRemoteMessage,
  PluginUnavailableMessage,
  PluginUninstalledMessage,
  ReconcileAppliedCascadeMessage,
  Reason,
} from "./notification-types.ts";
import type { Scope } from "./types.ts";

/** Exact notification grammar. Severity and summary policy live in notification-summary.ts. */

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
 * D-80-01: uses `◍` (U+25CD, circle with vertical fill), distinct from `◌`
 * (U+25CC, dotted circle), which `ICON_REMOTE` uses instead.
 */
export const ICON_DISABLED = "◍";

/**
 * RSTA-02 / D-80-01: dedicated glyph (`◌` U+25CC, dotted circle) for the
 * `(remote)` row -- a not-installed git-source plugin whose clone/mirror is not
 * yet materialized locally. The dotted circle reads "declared but not
 * present". Distinct from `ICON_DISABLED`, which uses `◍` (U+25CD).
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
 * sound but carries unsupported kinds (LSP, partial hooks, other components,
 * or workflows). Thus, `--partial` can install its supported components. Stays in the circled-
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
export function renderMpHeader(mp: MarketplaceNotificationMessage, probe: SoftDepStatus): string {
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
      // off-marker. The chevron token is written out here and in the
      // `already no autoupdate` skipped arm below -- those two literals are its
      // only spellings. Does NOT carry mp.reasons.
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
 * Compose a scope-bearing, reasons-bearing plugin row that carries NO
 * soft-dep marker. Folds the structurally-identical `renderPluginRow` arms
 * (`upgradable` / `skipped` / `failed` / `manual recovery` / `disabled`) that
 * differ only in their icon and their parenthesized status `label`. `label` is
 * the FULL parenthesized token (the caller passes `"(upgradable)"` etc.,
 * INCLUDING the parens, so the `"(manual recovery)"` literal keeps its space
 * verbatim). The `p` param is the structural subset those variants share: a
 * required `name` and an optional `scope` / `version` / `reasons`. Both
 * declares-flags are `false` (these arms never carry `dependencies`).
 *
 * `reasons` is OPTIONAL because `PluginDisabledMessage` declares it so;
 * `composeReasons` already treats `undefined` as the empty list, so a required
 * `readonly ContentReason[]` caller is unaffected. This is what lets the
 * `disabled` arm share this composer instead of restating its body -- the four
 * command-local copies were byte-identical to it, which is exactly the
 * property their comments asked a reader to maintain by hand.
 */
export function pluginRow(
  icon: string,
  p: {
    readonly name: string;
    readonly scope?: Scope;
    readonly version?: string;
    readonly reasons?: readonly ContentReason[];
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
 * reason set; `dependencies` drives the `{requires pi-subagents}` /
 * `{requires pi-mcp}` markers via `composeReasons`.
 *
 * WR-13 / WR-12: which callers thread `reasons`, over the seven command arms
 * folded here -- ALL of them now pass `p.reasons`: the five `(installed)` arms
 * (install, enable, list, import, reconcile), the `(reinstalled)` arm (WR-09),
 * and the `(updated)` arm (WR-12). The `(updated)` arm was the last caller
 * passing `undefined`, because `PluginUpdatedMessage` carried no `reasons`
 * field; since `update` stages through the same bridges and degrades a
 * component exactly as install / enable / reinstall do, that gap rendered a
 * clean `(updated)` row over a degraded component. The field is optional on
 * every one of these message types, so a caller with nothing to report still
 * composes the brace-less row byte for byte.
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

/**
 * The not-installed and realized-removal row renderers, exported so the
 * per-command render maps in `orchestrators/*.messaging.ts` CALL the central
 * presentation vocabulary (D-11) instead of re-inlining byte-identical arm
 * bodies. `renderPluginRow` dispatches to exactly these, so the central switch
 * and every command map cannot drift.
 */
export function renderUninstalledRow(
  p: PluginUninstalledMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  return joinTokens([
    ICON_AVAILABLE,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(uninstalled)",
    composeReasons(undefined, false, false, probe),
  ]);
}

/**
 * MSG-PL-6 / SNM-11 carve-out: `available` has NO `scope?` field.
 *
 * OUT-02: `reasons` is a REQUIRED parameter rather than a read of `p.reasons`,
 * because whether this row carries a reason brace is a fact about the calling
 * SURFACE, not about the status. Only the list surface's producer stamps the
 * entry-derived `installs disabled` token; every other surface that composes an
 * `(available)` row builds it without reasons and always has, so forwarding
 * there would be plumbing with no producer behind it. Making the parameter
 * required rather than optional is what forces each surface to state its own
 * answer at the call site instead of inheriting one silently.
 *
 * Both soft-dep flags stay hard-coded false: the SNM-11 no-scope-bracket
 * carve-out family never emits soft-dependency markers.
 */
export function renderAvailableRow(
  p: PluginAvailableMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
  reasons: readonly ContentReason[] | undefined,
): string {
  return joinTokens([
    ICON_AVAILABLE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(available)",
    composeReasons(reasons, false, false, probe),
  ]);
}

/**
 * RSTA-01 / D-80-03: a not-installed git-source row whose clone or mirror is
 * not materialized locally. It is the `available` row with the glyph swapped
 * (`○` -> `◌`) and the token swapped. SNM-11 carve-out: no `scope?` field.
 *
 * OUT-02 / OUT-05: D-80-03's bare-row rule NARROWS here rather than reversing.
 * What the row still refuses is every probe-derived reason and every soft-dep
 * marker -- there is no materialized tree to derive either from, which is why
 * both soft-dep flags stay hard-coded false. What it admits is the one
 * entry-derived token, `installs disabled`, which needs no tree at all because
 * the marketplace entry is readable with no clone (DOC-02). That is what lets
 * an unfetched row state what an install would do.
 *
 * `reasons` is a REQUIRED parameter for the reason given on
 * `renderAvailableRow`: only the list surface's producer stamps the token, and
 * each surface states its own answer at the call site.
 */
export function renderRemoteRow(
  p: PluginRemoteMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
  reasons: readonly ContentReason[] | undefined,
): string {
  return joinTokens([
    ICON_REMOTE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(remote)",
    composeReasons(reasons, false, false, probe),
  ]);
}

/** MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field. */
export function renderUnavailableRow(
  p: PluginUnavailableMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  return joinTokens([
    ICON_UNINSTALLABLE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(unavailable)",
    composeReasons(p.reasons, false, false, probe),
  ]);
}

/**
 * USTAT-01 / D-64-01: the not-installed partially-available row. It is the
 * `unavailable` row with the glyph swapped (`⊘` -> `⊖`) and the token swapped.
 * MSG-PL-6 / SNM-11 carve-out: no `scope?` field.
 */
export function renderPartiallyAvailableRow(
  p: PluginPartiallyAvailableMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  return joinTokens([
    ICON_PARTIALLY_AVAILABLE,
    p.name,
    renderScopeBracket(undefined, mpScope),
    renderVersion(p.version),
    "(partially-available)",
    composeReasons(p.reasons, false, false, probe),
  ]);
}

/**
 * D-54-01 / ENBL-04: the list/info inventory row for a recorded-but-disabled
 * plugin. Subject-first grammar, using the dedicated ICON_DISABLED (`◍`) glyph
 * -- the same glyph the `(will disable)` pending-tense row carries.
 *
 * ENBL-16: the caller's `reasons` are threaded and the caller stamps at most
 * `not in manifest`. ENBL-15: both soft-dep flags are hard-coded false, which
 * is what keeps a disabled row free of a soft-dep marker whatever inventory
 * the record retained.
 */
export function renderDisabledRow(
  p: PluginDisabledMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
): string {
  return joinTokens([
    ICON_DISABLED,
    p.name,
    renderScopeBracket(p.scope, mpScope),
    renderVersion(p.version),
    "(disabled)",
    composeReasons(p.reasons, false, false, probe),
  ]);
}

/**
 * DIFF-02 pending-tense rows: the pre-transition analogs the reconcile plan
 * projects. None carries a `version` slot (the transition has not happened
 * yet) and none carries reasons.
 *
 * Glyphs mirror the realized row of the same class, which is the established
 * precedent: `●` for `(installed)` / `(will install)` / `(will enable)`, `○`
 * for `(available)` / `(will uninstall)`, and `◍` for `(disabled)` /
 * `(will disable)`.
 *
 * FSTAT-06 / D-66-04: the `partial` modifier renders
 * `(will partially install)` when the planned install would degrade (it
 * resolves `partially-available`). There is deliberately NO
 * `will partially update` analog -- the reconcile plan has no update bucket
 * (D-66-05).
 *
 * D-53-02 / ENBL-05: the `will enable` bucket is populated only when the
 * recorded-but-disabled marker (the record's explicit `enabled: false`
 * boolean, and nothing else) is paired with a config entry whose
 * `enabled !== false`. The arm is always present so enable-wiring stays
 * type-complete.
 */
function renderPendingRow(
  p: Extract<
    PluginNotificationMessage,
    { status: "will install" | "will uninstall" | "will enable" | "will disable" }
  >,
  mpScope: Scope,
): string {
  const bracket = renderScopeBracket(p.scope, mpScope);
  switch (p.status) {
    case "will install":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        bracket,
        p.partial === true ? "(will partially install)" : "(will install)",
      ]);
    case "will uninstall":
      return joinTokens([ICON_AVAILABLE, p.name, bracket, "(will uninstall)"]);
    case "will enable":
      return joinTokens([ICON_INSTALLED, p.name, bracket, "(will enable)"]);
    case "will disable":
      return joinTokens([ICON_DISABLED, p.name, bracket, "(will disable)"]);
  }
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
 * `reinstalled` / `partially-installed` arms declare `dependencies`; those
 * arms pass `p.dependencies.includes("agents")` /
 * `p.dependencies.includes("mcp")` to `composeReasons`. The other 15 arms pass
 * `false` for both declares-flags so the soft-dep markers cannot leak onto
 * rows that structurally never declare a soft dep. `partially-installed` is
 * the one arm whose field is OPTIONAL (WR-03): the success cascades thread the
 * staged counts, the inventory rows omit them.
 *
 * Per-variant `composeReasons` first argument, over the 19 plugin statuses:
 *  - 9 reasons-less variants (updated, uninstalled, available, remote, disabled,
 *  will install, will uninstall, will enable, will disable) pass `undefined` --
 *  or, on the arms that can carry no marker of any kind (remote and the four
 *  pending-tense rows), drop the call entirely;
 *  - 10 reasons-bearing variants (installed, reinstalled, unavailable,
 *  upgradable, failed, skipped, manual recovery, partially-installed,
 *  partially-upgradable, partially-available) pass `p.reasons`. `installed` and
 *  `reinstalled` are the two arms whose field is OPTIONAL, so they pass a
 *  possibly-undefined value.
 *
 * NOT rendered here (`notify` composes them as additional
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
    // `installed` (cascade transition AND the list-surface inventory row) --
    // SURF-05 / D-63-08 threads the optional `reasons` brace through
    // composeReasons; soft-dep markers append into the SAME brace block per
    // MSG-GR-4 (a plugin with orphan-rewake AND a missing companion extension
    // renders as `(installed) {orphan rewake, requires pi-subagents}`). BOTH
    // surfaces can carry a brace: INV-01 stamps `{not in manifest}` on the
    // list inventory row. The brace is omitted only when the composed list is
    // empty, which is the ordinary case on both surfaces -- not a property of
    // the inventory row.
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
    // `updated` -- WR-12 threads the optional `reasons` brace exactly as the
    // `installed` and `reinstalled` arms do, so an update that degraded a
    // component names the kind instead of rendering a bare success row over it.
    // Soft-dep markers append into the SAME brace per MSG-GR-4.
    case "updated":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        composeVersionArrow(p.from, p.to),
        "(updated)",
        composeReasons(
          p.reasons,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]);
    // `reinstalled` -- WR-09 threads the optional `reasons` brace exactly as the
    // `installed` arm above, so a reinstall that degraded a component names the
    // kind instead of rendering a bare success row over it. Soft-dep markers
    // append into the SAME brace per MSG-GR-4.
    case "reinstalled":
      return joinTokens([
        ICON_INSTALLED,
        p.name,
        renderScopeBracket(p.scope, mpScope),
        renderVersion(p.version),
        "(reinstalled)",
        composeReasons(
          p.reasons,
          p.dependencies.includes("agents"),
          p.dependencies.includes("mcp"),
          probe,
        ),
      ]);
    case "uninstalled":
      return renderUninstalledRow(p, probe, mpScope);
    case "available":
      // OUT-02: no producer that renders through THIS arm stamps `reasons`, so
      // the `undefined` is the drop stated by construction, not an omission.
      return renderAvailableRow(p, probe, mpScope, undefined);
    case "remote":
      // RSTA-01 / D-80-03: not-installed git-source row whose clone/mirror is
      // not materialized locally. Clones the `available` arm, swapping the
      // glyph (`○` -> `◌`) and token (`(available)` -> `(remote)`). SNM-11
      // carve-out: `remote` has NO `scope?` field, so the scope bracket is
      // omitted. D-80-03 as narrowed by OUT-05: the row refuses probe- and
      // soft-dep-derived reasons and admits only the entry-derived `installs
      // disabled` token. No producer that renders through THIS arm stamps it,
      // so the `undefined` is the drop stated by construction, not an omission.
      return renderRemoteRow(p, probe, mpScope, undefined);
    case "unavailable":
      return renderUnavailableRow(p, probe, mpScope);
    case "partially-available":
      return renderPartiallyAvailableRow(p, probe, mpScope);
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
    case "will uninstall":
    case "will enable":
    case "will disable":
      return renderPendingRow(p, mpScope);
    case "disabled":
      return renderDisabledRow(p, probe, mpScope);
    default: {
      assertNever(p);
      return "";
    }
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
 * OUT-04 / D-102-10: the enable-hint trailer literal, rendered below an
 * install-disabled `(disabled)` row. The install materialized nothing the user
 * can reach, so the row alone leaves them with a fact and no next step; this
 * names the real, runnable `enable` verb. Interpolates no plugin / marketplace
 * / version identifier and no filesystem path (T-69-01), and names no flag that
 * does not exist. This byte form is FROZEN -- do not change the wording.
 */
const ENABLE_HINT_TRAILER = "Run enable on this plugin to use its components.";

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
export function renderMarketplaceInfo(
  message: MarketplaceInfoMessage,
  _probe: SoftDepStatus,
): string {
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
export function renderMarketplaceInfoCascade(
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
export function renderPluginInfoCascade(
  message: PluginInfoCascadeMessage,
  probe: SoftDepStatus,
): string {
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
 * variant. Emits a bare column-0 row
 * `⊘ <name> [scope?] (failed) {marketplace not added}` with NO marketplace header (the row
 * IS the message). `name` carries the MARKETPLACE name. `scope` present =>
 * `[scope]` bracket; absent => no bracket. The version slot collapses to `""`
 * (the variant carries no version) and the brace is hard-coded via a
 * single-token literal (the variant carries no `reasons` field): `marketplace not added`,
 * or the `marketplace not added to user scope` sibling when `presentInOtherScope`
 * says the container was found in the scope the command did not target.
 *
 * `probe` is accepted for signature parity with the other info renderers and
 * threaded into `composeReasons` with BOTH soft-dep declares-flags FALSE --
 * info-surface rows NEVER emit soft-dep markers.
 */
export function renderMarketplaceNotAdded(
  message: MarketplaceNotAddedMessage,
  probe: SoftDepStatus,
): string {
  return joinTokens([
    ICON_UNINSTALLABLE,
    message.name,
    message.scope === undefined ? "" : `[${message.scope}]`,
    renderVersion(undefined),
    "(failed)",
    composeReasons([notAddedReasonFor(message)], false, false, probe),
  ]);
}

/**
 * CMP-4 / SCOPE-01: pick the structural token the `{...}` brace carries.
 *
 * The qualified token REPLACES the plain one rather than joining it -- "the
 * container does not exist" and "it exists, but not in the scope you targeted"
 * are competing claims about one subject, so a brace carrying both would state
 * both.
 *
 * A qualified token requires a `scope`, which is what the `[scope]` bracket
 * renders from. An ABSENT bracket means the caller consulted BOTH scopes and
 * both missed (D-03), so there is no other scope left to be present in and the
 * plain token is the only truthful one.
 *
 * The scope word names the scope that MISSED, matching the bracket beside it.
 */
function notAddedReasonFor(message: MarketplaceNotAddedMessage): Reason {
  if (message.presentInOtherScope !== true || message.scope === undefined) {
    return "marketplace not added";
  }

  return message.scope === "user"
    ? "marketplace not added to user scope"
    : "marketplace not added to project scope";
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
export function renderPluginInfo(message: PluginInfoMessage, probe: SoftDepStatus): string {
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
export function composeMarketplaceBlock(
  mp: MarketplaceNotificationMessage,
  probe: SoftDepStatus,
): string {
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
export function composeReconcileAppliedBody(
  message: ReconcileAppliedCascadeMessage,
  probe: SoftDepStatus,
): string {
  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  return blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");
}

/**
 * PL-4: which rows carry the manifest description, as a TOTAL map over the
 * status union so a new variant fails `npm run check` rather than silently
 * losing its description line. The list inventory rows carry it; a cascade
 * `installed` row never sets `description`, so those stay single-line.
 */
const DESCRIPTION_BEARING_STATUS: Record<PluginNotificationMessage["status"], boolean> = {
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
};

/** Narrow to the rows whose variant declares an optional `description`. */
function isDescriptionBearingRow(
  p: PluginNotificationMessage,
): p is Extract<PluginNotificationMessage, { description?: string }> {
  return DESCRIPTION_BEARING_STATUS[p.status];
}

/**
 * Select the 4-space-indented `--partial` hint trailer for a row, or
 * undefined when the row carries none. Exactly one can apply, because each
 * arm is keyed on a distinct status.
 *
 * SEV-02 / D-69-03 / XSURF-01: the partially-available INSTALL-failure row
 * takes the install-worded hint. That row surfaces as `unavailable` (the
 * structural arm) or `partially-available` (the resolver-state-driven token);
 * the structural `unavailable` arm omits `partialHint` because `--partial`
 * cannot help it. T-69-01: the hint names the user's own flag and
 * interpolates no plugin or marketplace identifier. D-70-01: the byte form is
 * FROZEN as the reconciled doc contract, locked byte-for-byte in
 * docs/output-catalog.md and docs/messaging-style-guide.md.
 *
 * SEV-04 / XSURF-03: the partially-upgradable manual update-decline row takes
 * the update-worded hint; the list inventory `partially-upgradable` row omits
 * `partialHint` and stays byte-frozen.
 *
 * CR-01 / D-98-03: the stale-gate ENABLE failure takes its OWN trailer. Its
 * remedy is `update --partial` too, but the failed command is `enable`, so
 * the "re-run" wording of the update hint would name a command that rejects
 * the flag it advertises. Only the enable-failure narrowing stamps
 * `partialHint` on a `failed` row, so this arm stays inert for every other
 * producer.
 */
function partialHintTrailerFor(p: PluginNotificationMessage): string | undefined {
  if (p.status === "unavailable" || p.status === "partially-available") {
    return p.partialHint === true ? PARTIAL_INSTALL_HINT_TRAILER : undefined;
  }

  if (p.status === "partially-upgradable") {
    return p.partialHint === true ? PARTIAL_UPDATE_HINT_TRAILER : undefined;
  }

  if (p.status === "failed") {
    return p.partialHint === true ? STALE_GATE_UPDATE_HINT_TRAILER : undefined;
  }

  return undefined;
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
export function composePluginLinesWith(
  p: PluginNotificationMessage,
  probe: SoftDepStatus,
  mpScope: Scope,
  renderRow: (p: PluginNotificationMessage, probe: SoftDepStatus, mpScope: Scope) => string,
): string[] {
  const lines: string[] = [`  ${renderRow(p, probe, mpScope)}`];

  if (isDescriptionBearingRow(p) && p.description !== undefined && p.description.length > 0) {
    lines.push(`    ${truncateDescription(p.description)}`);
  }

  const hint = partialHintTrailerFor(p);
  if (hint !== undefined) {
    lines.push(`    ${hint}`);
  }

  // OUT-04 / D-102-10: the install-disabled row carries a 4-space-indented
  // trailer naming the `enable` verb. Only the install surface stamps
  // `enableHint`, so the list / info inventory `(disabled)` rows and the
  // `disable` verb's own row stay byte-frozen. The byte form is FROZEN and
  // interpolates nothing (T-69-01).
  if (p.status === "disabled" && p.enableHint === true) {
    lines.push(`    ${ENABLE_HINT_TRAILER}`);
  }

  if (p.status === "failed" || p.status === "manual recovery") {
    const trailer = renderIndentedCauseChain(p.cause, "    ");
    if (trailer !== "") {
      lines.push(trailer);
    }

    for (const leak of manualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
  }

  lines.push(...composeRollbackPartialLines(p));
  return lines;
}
