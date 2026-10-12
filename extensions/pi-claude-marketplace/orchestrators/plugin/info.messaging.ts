import { type PluginSkippedMessage } from "../../shared/notification-types.ts";

import type { CommandContext } from "../../shared/notify-context.ts";

/**
 * info.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin info` (MOD-01).
 *
 * Surface boundary (research Open Question 3): info has TWO rendering surfaces.
 *
 *  1. The STANDALONE `plugin-info` / `plugin-info-cascade` envelopes
 *     (`PluginInfoMessage`, carrying a `PluginInfoRow`) are a SIBLING concept to
 *     cascades -- a different multi-line component-listing surface presented by
 *     the central presentation step and formatted by its text formatter. That
 *     standalone envelope routing STAYS central; it is not a
 *     `PluginNotificationMessage` cascade and cannot route through
 *     `notifyWithContext`. The `marketplace-not-added` standalone likewise stays
 *     central.
 *
 *  2. The cascade `MarketplaceNotificationMessage` block info emits BESIDE the
 *     standalone envelope, carrying a `PluginNotificationMessage` row
 *     byte-identical to the list surface's. There is exactly one: the D-96-04
 *     fetch-skip note a `--fetch` run produces per scope that had nothing to
 *     fetch (`skipped`) -- a state-only block (`not in manifest`) or a
 *     recorded-but-disabled record (`already disabled`), whichever the block
 *     reports through `InfoBlock.skipReason`.
 *
 *     `PLUGIN_INFO_CONTEXT` is total over that one status (D-10). The
 *     standalone `PluginInfoRow` shape cannot express it: its status set admits
 *     no `skipped`.
 *
 *     D-100-08 / ENBL-17: a recorded-but-disabled scope emits no cascade row
 *     here. It goes through the same block builder every other installed
 *     record does and renders as a standalone `(disabled)` info row, keeping
 *     one render path instead of a second arm that would duplicate it.
 *
 * The shared presentation vocabulary stays central in
 * `shared/notification-types.ts` and `shared/notification-grammar.ts`
 * (D-notification-refactor-01-11) and is CALLED here, never duplicated.
 */

type PluginInfoStatus = "skipped";

/** info's cascade row message union (the fetch-skip note). */
export type PluginInfoCascadeMsg = PluginSkippedMessage;

/** The command label and complete per-status reason policy. */
export const PLUGIN_INFO_CONTEXT = {
  Messaging: { label: "Plugin info" },
  rowPolicies: { skipped: { markers: false, contentReasons: true } },
} as const satisfies CommandContext<PluginInfoStatus>;
