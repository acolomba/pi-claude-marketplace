import {
  ICON_AVAILABLE,
  ICON_PARTIALLY_AVAILABLE,
  ICON_REMOTE,
  ICON_UNINSTALLABLE,
  composeReasons,
  joinTokens,
  pluginRow,
  renderScopeBracket,
  renderVersion,
  type PluginAvailableMessage,
  type PluginFailedMessage,
  type PluginPartiallyAvailableMessage,
  type PluginRemoteMessage,
  type PluginSkippedMessage,
  type PluginUnavailableMessage,
} from "../../shared/notify.ts";

import type { CommandContext, RenderFn } from "../../shared/notify-context.ts";

/**
 * fetch.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin fetch` (FTCH-02). Co-locates fetch's private status set, its
 * cascade row message shapes, and a render map total over fetch's OWN statuses
 * (D-10) lifting the matching `renderPluginRow` arm bodies VERBATIM. The shared
 * presentation vocabulary stays central in `shared/notify.ts` (D-11) and is
 * CALLED here, never duplicated. No closed set (ICON / STATUS_TOKENS /
 * PLUGIN_STATUSES / REASONS) grows -- every member fetch needs already exists.
 */

/**
 * fetch's private status set. D-81-02: a fetch success renders the plugin's
 * POST-FETCH derived status row -- exactly what `list` / `info` show
 * (`available` / `partially-available` / `unavailable`, plus `remote` for a
 * source that stayed unmaterialized). A no-op (pinned-warm clone or a path
 * source with nothing to fetch) renders `skipped`; a per-plugin fetch failure
 * inside the failure-tolerant sweep renders `failed`.
 */
export const FETCH_STATUSES = [
  "available",
  "partially-available",
  "unavailable",
  "remote",
  "skipped",
  "failed",
] as const;
export type FetchStatus = (typeof FETCH_STATUSES)[number];

/** fetch's row message union -- the subset of central plugin shapes fetch emits. */
export type FetchMsg =
  | PluginAvailableMessage
  | PluginPartiallyAvailableMessage
  | PluginUnavailableMessage
  | PluginRemoteMessage
  | PluginSkippedMessage
  | PluginFailedMessage;

/**
 * Render map total over fetch's OWN statuses (D-10): a missing arm is a TS2741
 * compile error at the `satisfies` site. Arm bodies are byte-identical to the
 * central `renderPluginRow` switch (and to the `list` render map, which emits
 * the same not-installed rows). The `available` / `partially-available` /
 * `unavailable` arms omit the `[<scope>]` bracket (MSG-PL-6 / SNM-11 carve-out)
 * by passing `undefined` to `renderScopeBracket`; the `remote` arm additionally
 * drops the reasons brace (D-80-03). The `skipped` no-op row routes through
 * `pluginRow` with the `(skipped)` token at info severity (D-81-02: an existing
 * closed-set reason such as `up-to-date` is carried in `reasons`).
 */
const FETCH_RENDER: { [K in FetchStatus]: RenderFn<Extract<FetchMsg, { status: K }>> } = {
  available: (p, probe, mpScope) =>
    joinTokens([
      ICON_AVAILABLE,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `available` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(available)",
      composeReasons(undefined, false, false, probe),
    ]),
  // USTAT-01 / D-64-01: not-installed, partially-available row -- the dedicated
  // ICON_PARTIALLY_AVAILABLE (`⊖`) glyph + `(partially-available)` token. Body
  // cloned from the `unavailable` arm (same MSG-PL-6 / SNM-11 no-scope carve-out
  // and reasons composition); only the glyph and token differ.
  "partially-available": (p, probe, mpScope) =>
    joinTokens([
      ICON_PARTIALLY_AVAILABLE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(partially-available)",
      composeReasons(p.reasons, false, false, probe),
    ]),
  unavailable: (p, probe, mpScope) =>
    joinTokens([
      ICON_UNINSTALLABLE,
      p.name,
      // MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field.
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(unavailable)",
      composeReasons(p.reasons, false, false, probe),
    ]),
  // RSTA-01 / D-80-03: not-installed git-source row whose clone/mirror is not
  // materialized locally. Clones the `available` arm, swapping the glyph
  // (`○` -> `◌`) and token (`(available)` -> `(remote)`). SNM-11 carve-out:
  // `remote` has NO `scope?` field, so the scope bracket is omitted. Bare row --
  // NO reasons brace (D-80-03), so the `composeReasons` line is dropped.
  remote: (p, _probe, mpScope) =>
    joinTokens([
      ICON_REMOTE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(remote)",
    ]),
  // D-81-02: no-op fetch (pinned-warm clone / nothing-to-fetch path source).
  // Routes through `pluginRow` with the `(skipped)` token, mirroring the update
  // verb's no-op parity; the existing `up-to-date` REASONS member is carried in
  // `reasons` at info severity (closed set does not grow -- FTCH-03).
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: fetch's `CommandContext`. The `as const satisfies` pin enforces
 * that fetch supplies both `Messaging.label` and a total render map.
 */
export const FETCH_CONTEXT = {
  Messaging: { label: "Plugin fetch" },
  render: FETCH_RENDER,
} as const satisfies CommandContext<FetchStatus, FetchMsg>;
