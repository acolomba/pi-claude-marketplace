/**
 * shared/concerns/hooks.ts -- the hooks-summary concern (D-01). Owns the hook
 * summary types (`ClaudeHookEvent`, the file-private `_ToolEvent`,
 * `HookSummaryEntry`, `HookSummary`) and the pure `appendHooksBlock` block
 * renderer. The info renderer (`appendResolvedComponentLines`, which stays in
 * `notify.ts`) imports and calls `appendHooksBlock`; `COMPONENT_KINDS` also
 * stays in `notify.ts` (only the `kind === "hooks"` arm dispatches here).
 *
 * This module imports nothing from `notify.ts` -- it owns its types, the
 * strongest no-cycle position.
 */

// ---------------------------------------------------------------------------
// SURF-02 / D-63-06 / D-63-07: hook summary type seam.
//
// `ClaudeHookEvent` is the public literal-union of the 8 supported Claude
// hook events. Type definitions live here (in `shared/`) so the rendering
// surface can consume them without violating the `shared/` -> `domain/`
// import-direction fence (`import-x/no-restricted-paths`). The matching
// runtime tuples `BUCKET_A_EVENTS` / `TOOL_EVENTS` in
// `domain/components/hook-events.ts` are pinned to these literal unions
// via a `satisfies readonly ClaudeHookEvent[]` (and respectively
// `satisfies readonly BucketAEvent[]`) assertion in that file -- one
// drifts, the typecheck breaks at the source-of-truth assertion site.
//
// `HookSummaryEntry` is the discriminated union the info-surface renderer
// consumes. Three arms:
//   - tool event (untagged): statically carries `matcher: string`.
//   - non-tool event (untagged): statically cannot carry a matcher.
//   - lenient (tagged `kind: "lenient"`): produced by the info-surface
//     readers for entries the install path will NOT materialize. Two
//     producers: (1) the lenient reader when the resolver bailed (it did
//     NOT record `hooksConfigPath`), and (2) the strict reader's
//     dropped-handler enumeration for a force-degradable plugin
//     (PHOOK-05 / D-71-05) whose parseable hooks.json had one or more
//     unsupportable events / matcher groups / handlers partitioned out.
//     Carries an arbitrary `event: string` (may be `Stop`,
//     `Notification`, or any other token the plugin author wrote), a
//     `supported: boolean` bucket-A / supportability flag, and an
//     optional `matcher`. Rendered as `<event>` (or `<event>(<matcher>)`
//     when `matcher` is present) with a ` (unsupported)` suffix iff
//     `supported === false`. The lenient arm exists ONLY on the info
//     surface; the resolver-side strict parser
//     (`domain/components/hooks.ts::parseHooksConfig`) remains strict and
//     never produces lenient entries.
// Discriminator is structural: the untagged arms have no `kind` field;
// the lenient arm is the only one carrying `kind: "lenient"`. The
// renderer branches on `"kind" in entry` first, then on `"matcher" in
// entry` for the tool/non-tool split.
//
// `HookSummary` is the public wrapper interface. The payload boundary uses
// the raw `readonly HookSummaryEntry[]` shape (see
// `PluginInfoComponentsResolved.components.hooks?` in notify.ts);
// `HookSummary` exists as a labelled handle for consumers that want the
// named wrapper.
// ---------------------------------------------------------------------------

export type ClaudeHookEvent =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PreCompact"
  | "PostCompact"
  | "SessionEnd";

type _ToolEvent = "PreToolUse" | "PostToolUse" | "PostToolUseFailure";

export type HookSummaryEntry =
  | { readonly event: _ToolEvent; readonly matcher: string }
  | { readonly event: Exclude<ClaudeHookEvent, _ToolEvent> }
  | {
      readonly kind: "lenient";
      readonly event: string;
      readonly supported: boolean;
      readonly matcher?: string;
    };

export interface HookSummary {
  readonly entries: readonly HookSummaryEntry[];
}

/**
 * SURF-02 / D-63-04: append the multi-line `hooks:` block when the row
 * carries one or more entries. Emits a 4-space-indent header followed by
 * one 6-space-indent line per entry. Three arm shapes:
 *   - lenient arm (`kind === "lenient"`): `<event>` -- or
 *     `<event>(<matcher>)` when a `matcher` is present (matcher-group
 *     granularity for a dropped group / handler, PHOOK-05 / D-71-05) --
 *     with a ` (unsupported)` suffix iff `supported === false`. Produced
 *     by the info-surface lenient reader (resolver did NOT record
 *     `hooksConfigPath`) and by the strict reader's dropped enumeration.
 *   - tool event (untagged, has `matcher`): `<event>(<matcher>)`.
 *   - non-tool event (untagged, no `matcher`): bare `<event>`.
 * Reads `entry.event` / `entry.matcher` directly -- no re-derivation
 * from a closed-set tuple, no runtime guard (the union is exhaustive,
 * every arm renders).
 */
export function appendHooksBlock(
  lines: string[],
  entries: readonly HookSummaryEntry[] | undefined,
): void {
  if (entries === undefined || entries.length === 0) {
    return;
  }

  lines.push("    hooks:");
  for (const entry of entries) {
    if ("kind" in entry) {
      const matcherPart = entry.matcher === undefined ? "" : `(${entry.matcher})`;
      lines.push(`      ${entry.event}${matcherPart}${entry.supported ? "" : " (unsupported)"}`);
    } else if ("matcher" in entry) {
      lines.push(`      ${entry.event}(${entry.matcher})`);
    } else {
      lines.push(`      ${entry.event}`);
    }
  }
}
