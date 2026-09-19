import {
  pluginRow,
  renderUninstalledRow,
  ICON_UNINSTALLABLE,
} from "../../shared/notification-grammar.ts";
import {
  type ContentReason,
  type PluginFailedMessage,
  type PluginUninstalledMessage,
  type Reason,
} from "../../shared/notification-types.ts";

import type { CommandContext, MarketplaceRows, RenderFn } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";

/**
 * uninstall.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin uninstall` (MOD-01). Co-locates uninstall's private status
 * set, its row message shapes, its command-private reason, and a render map
 * total over uninstall's OWN statuses (D-10) lifting the matching
 * `renderPluginRow` arm bodies VERBATIM. Shared presentation vocabulary stays
 * central in `shared/notification-grammar.ts` (D-11) and is CALLED here, never duplicated.
 */

/**
 * D-05-11 / D-06-06: the command-private reasons owned by `uninstall`. Both
 * are meaningful only to this flow: `dependents unsatisfied` marks a removal
 * that went through while other installed plugins in the scope still declared
 * the target, and `dependency pruned` marks a dependency record `--prune`
 * swept out after the named plugin. Both are members of the closed `Reason`
 * set; the pin below rejects a typo at compile time.
 */
// `_ReasonInSet<R extends Reason> = R` pins the private reasons to the closed
// `Reason` set as it derives `UninstallPrivateReason`: an out-of-set literal
// violates the `extends Reason` constraint -- a TS2344 compile error here, with
// no runtime footprint.
type _ReasonInSet<R extends Reason> = R;
// fallow-ignore-next-line private-type-leak -- `_ReasonInSet` is the compile-time membership guard; exporting that helper would widen the command's public reason vocabulary.
export type UninstallPrivateReason = _ReasonInSet<"dependency pruned" | "dependents unsatisfied">;

/**
 * uninstall's private status set: a success `uninstalled` row or a `failed`
 * row. NO soft-dep marker ever appears on either row (MSG-SD-3) -- neither arm
 * declares `dependencies`, so `composeReasons` receives both flags `false`.
 */
type UninstallStatus = "uninstalled" | "failed";

/**
 * uninstall's row message union -- the subset of central plugin shapes whose
 * status uninstall emits.
 */
type UninstallMsg = PluginUninstalledMessage | PluginFailedMessage;

/**
 * Render map total over uninstall's OWN statuses (D-10): a missing arm is a
 * TS2741 compile error at the `satisfies` site. Arm bodies are byte-identical
 * to the central `renderPluginRow` switch.
 */
const UNINSTALL_RENDER: {
  [K in UninstallStatus]: RenderFn<Extract<UninstallMsg, { status: K }>>;
} = {
  uninstalled: (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
};

/**
 * D-04 / D-05: uninstall's `CommandContext`. The `as const satisfies` pin
 * enforces that uninstall supplies both `Messaging.label` and a total render
 * map.
 */
export const UNINSTALL_CONTEXT = {
  Messaging: { label: "Plugin uninstall" },
  render: UNINSTALL_RENDER,
} as const satisfies CommandContext<UninstallStatus, UninstallMsg>;

/** D-05-11: the pruned row's brace under the deleting disposition. */
const PRUNED_ROW_REASONS = ["dependency pruned"] as const satisfies readonly ContentReason[];

/**
 * D-05-11 / D-05-09: the pruned row's brace under `--keep-data`. The order is
 * contractual: why the plugin went, then what was kept.
 */
const PRUNED_ROW_REASONS_DATA_KEPT = [
  "dependency pruned",
  "data kept",
] as const satisfies readonly ContentReason[];

/**
 * D-05-11 / PRUNE-04: the row for one dependency record `--prune` removed. It
 * is an ordinary `uninstalled` row -- same status, glyph, `info` severity and
 * reload hint as the named plugin's row -- because the operation IS an
 * uninstall; only the brace differs, and it says why a plugin the user did not
 * name went. `keepData` is the whole command's disposition (D-05-09), so the
 * pruned row carries `data kept` exactly when the primary row does.
 */
export function composePrunedRow(args: {
  readonly plugin: string;
  readonly version: string;
  readonly keepData: boolean;
}): PluginUninstalledMessage {
  return {
    status: "uninstalled",
    name: args.plugin,
    version: args.version,
    reasons: args.keepData ? PRUNED_ROW_REASONS_DATA_KEPT : PRUNED_ROW_REASONS,
    severity: "info",
    needsReload: true,
  };
}

/** WR-06 / DATA-01: the named plugin's row under `--keep-data` alone. */
const UNINSTALLED_ROW_REASONS_DATA_KEPT = ["data kept"] as const satisfies readonly ContentReason[];

/**
 * LOAD-03 / D-06-06: the named plugin's row when other installed plugins in
 * the scope still declared it. The removal went through, so the token rides
 * the success row and states the consequence; the dependents themselves ride
 * the row's cause line.
 */
const UNINSTALLED_ROW_REASONS_DEPENDENTS = [
  "dependents unsatisfied",
] as const satisfies readonly ContentReason[];

/**
 * LOAD-03 / D-05-09: both axes on one row. The order is contractual, and it is
 * the pruned row's rule applied to this row's pair: the brace says what the
 * removal means for the rest of the scope before it says what was left on
 * disk, because the disposition is a footnote about the plugin that went while
 * the dependents are the fact the operator has to act on.
 */
const UNINSTALLED_ROW_REASONS_DEPENDENTS_DATA_KEPT = [
  "dependents unsatisfied",
  "data kept",
] as const satisfies readonly ContentReason[];

/**
 * The named plugin's brace, composed from the two INDEPENDENT axes the row can
 * carry: what the removal means for the rest of the scope, and what it left on
 * disk. Neither replaces the other, and with neither present the row keeps its
 * byte-frozen brace-less form (D-02-01).
 */
function uninstalledRowReasons(
  keepData: boolean,
  hasDependents: boolean,
): readonly ContentReason[] | undefined {
  if (hasDependents) {
    return keepData
      ? UNINSTALLED_ROW_REASONS_DEPENDENTS_DATA_KEPT
      : UNINSTALLED_ROW_REASONS_DEPENDENTS;
  }

  return keepData ? UNINSTALLED_ROW_REASONS_DATA_KEPT : undefined;
}

/**
 * The named plugin's success row. It stays an `info` row with its reload stamp
 * whatever the brace says: the uninstall was carried out in full, which is the
 * info arm of the severity model. The consequence for the dependents is not
 * this row's subject -- it is reported at the next load, at warning, by the
 * load-time check, which gives each dependent its own row and the full remedy.
 *
 * T-06-01 / T-06-02: the cause line is built from `name@marketplace` keys
 * whose names already passed `domain/dependencies.ts`'s token pattern, and no
 * nested cause is chained behind it, so no absolute path and no control
 * character can reach the rendered sentence.
 */
export function composeUninstalledRow(args: {
  readonly plugin: string;
  readonly version?: string;
  readonly keepData: boolean;
  /** Sorted `name@marketplace` keys of the records that still declare the plugin. */
  readonly dependents: readonly string[];
}): PluginUninstalledMessage {
  const hasDependents = args.dependents.length > 0;
  const reasons = uninstalledRowReasons(args.keepData, hasDependents);
  return {
    status: "uninstalled",
    name: args.plugin,
    ...(args.version !== undefined && { version: args.version }),
    ...(reasons !== undefined && { reasons }),
    ...(hasDependents && { cause: new Error(`required by ${args.dependents.join(", ")}`) }),
    // D-03/D-06: realized uninstall transition -> info, reloads Pi resources.
    severity: "info",
    needsReload: true,
  };
}

/**
 * PRUNE-04: the standalone report's blocks. The named plugin's marketplace
 * comes first with its row first; every pruned member joins the block of its
 * own marketplace, and a marketplace that only lost members gets a block of
 * its own in the order the sweep reached it. Rows inside a block keep removal
 * order. With no members the result is the single block the plain uninstall
 * renders (D-05-12).
 */
export function composeRemovalBlocks(args: {
  readonly primary: { readonly marketplace: string; readonly row: PluginUninstalledMessage };
  readonly members: readonly {
    readonly marketplace: string;
    readonly row: PluginUninstalledMessage | PluginFailedMessage;
  }[];
  readonly scope: Scope;
}): readonly MarketplaceRows<PluginUninstalledMessage | PluginFailedMessage>[] {
  const blocks = new Map<string, UninstallMsg[]>([[args.primary.marketplace, [args.primary.row]]]);
  for (const member of args.members) {
    const rows = blocks.get(member.marketplace);
    if (rows === undefined) {
      blocks.set(member.marketplace, [member.row]);
    } else {
      rows.push(member.row);
    }
  }

  return [...blocks].map(([name, plugins]) => ({ name, scope: args.scope, plugins }));
}
