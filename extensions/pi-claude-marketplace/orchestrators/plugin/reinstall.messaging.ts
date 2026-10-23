import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import { declaredDependencies } from "../../shared/concerns/soft-dep.ts";
import {
  type ContentReason,
  type PluginFailedMessage,
  type PluginManualRecoveryMessage,
  type PluginReinstalledMessage,
  type PluginUpdateSkippedMessage,
} from "../../shared/notification-types.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { malformedReasonsForKinds, skipSeverity } from "../../shared/notify-reasons.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";

import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { CommandContext, MarketplaceRows, Plural } from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
} from "../types.ts";

/**
 * reinstall's private status set: a success `reinstalled` row, a `skipped` row
 * (benign no-op), a `failed` row, or a `manual recovery` anchor row.
 */
type ReinstallStatus = "reinstalled" | "skipped" | "failed" | "manual recovery";

/**
 * reinstall's row message union. `dependencies` stays REQUIRED on the
 * `reinstalled` arm so `resolveRows` can compose its soft-dep markers
 * (D-06 / TYPE-04 / D-12).
 */
type ReinstallMsg =
  | PluginReinstalledMessage
  | PluginUpdateSkippedMessage
  | PluginFailedMessage
  | PluginManualRecoveryMessage;

/** The command label and complete per-status reason policy. */
export const REINSTALL_CONTEXT = {
  Messaging: { label: "Plugin reinstall" },
  rowPolicies: {
    reinstalled: { markers: true, contentReasons: true },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
    "manual recovery": { markers: false, contentReasons: true },
  },
} as const satisfies CommandContext<ReinstallStatus>;

// ───────────────────────────────────────────────────────────────────────────
// Outcome -> row projection.
//
// This family lived in reinstall.ts and was reached through two `__test_*`
// re-exports. It is reinstall's message vocabulary rather than any part of its
// transaction, which is what this module already owns, so it moved here and
// the seams went with it (FLOW-09). The orchestrator now calls it across a
// public interface, the same one the tests use.
// ───────────────────────────────────────────────────────────────────────────
/**
 * Render the bulk-reinstall outcome cascade as a single
 * `notify(ctx, run, NotificationMessage)` call per orchestration.
 *
 * Shape per marketplace (catalog `/claude:plugin reinstall` cascade):
 *
 *  ● <mp> [<scope>]
 *    ● <plugin> v<version> (reinstalled) [{requires <dep>}]
 *    ⊘ <plugin> (skipped) {<reason>}
 *    ⊘ <plugin> (failed) {<reason>}
 *    ⊘ <plugin> (manual recovery) {rollback partial}
 *
 *  /reload to pick up changes
 *
 * - Marketplace headers carry `status: undefined` (the marketplace itself
 *   was NOT updated by reinstall; the header is a pure label).
 * - Manual-recovery outcomes are folded into the cascade `plugins[]` array
 *   as `PluginManualRecoveryMessage` variants.
 * - Each row's severity + reload-hint are set explicitly by its producer;
 *   notify() aggregates those per-row fields into the cascade's overall
 *   trailer.
 * - Per-marketplace iteration order is honored end-to-end: the orchestrator
 *   pre-sorts via `compareByNameThenScope`; notify() does NOT sort
 *   marketplaces[] or plugins[].
 */
// NotificationMessage cascade recipe:
// - One MarketplaceNotificationMessage per affected marketplace, emitted via
//   a single notify(ctx, run, ...) call per orchestration.
// - plugins: readonly PluginNotificationMessage[] in display order
//   (orchestrator-controlled iteration; notify does not sort).
// - Discriminators by status: "reinstalled" / "skipped" / "failed" /
//   "manual recovery".
// - Each row's severity + reload-hint are set explicitly by its producer;
//   notify() aggregates them into the cascade's overall "/reload to pick up
//   changes" trailer. Callers MUST NOT compose that trailer themselves.
// - Reference: catalog UAT plugin-reinstall fixtures.
export function renderReinstallPartitionAndNotify(
  ctx: NotificationContext,
  run: NotificationRun,
  outcomes: readonly ReinstallPluginOutcome[],
  cardinality: "single" | "plural",
): void {
  // Group rows by (scope, marketplace) in input order. Two different scopes
  // for the same marketplace name render as two separate marketplace
  // blocks (CMC-21: per-scope rendering, no collapse).
  interface Block {
    readonly name: string;
    readonly scope: Scope;
    readonly outcomes: ReinstallPluginOutcome[];
  }
  const byMp = new Map<string, Block>();
  for (const outcome of outcomes) {
    const key = `${outcome.scope}:${outcome.marketplace}`;
    const existing = byMp.get(key);
    if (existing === undefined) {
      byMp.set(key, {
        name: outcome.marketplace,
        scope: outcome.scope,
        outcomes: [outcome],
      });
    } else {
      existing.outcomes.push(outcome);
    }
  }

  // Order marketplace blocks via compareByNameThenScope (name primary
  // case-insensitive, scope secondary project-before-user per MSG-GR-3).
  // the orchestrator owns the sort; notify does not reorder.
  const sortedBlocks = [...byMp.values()].sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
  );

  // OUT-07 / D-12: the reinstall cascade is a bulk op, so its row slot is typed
  // `Plural<Row>` (a readonly array). Additive typing only -- a fresh
  // variable-length array, identical at runtime.
  // WR-01: the per-block plugin rows are built through the `outcomeToPluginMessage`
  // helper, now typed to `ReinstallMsg`, so the `MarketplaceRows<ReinstallMsg>`
  // annotation holds without a cast -- a status drift between the producer and
  // the policy map is a compile error here.
  const marketplaces: Plural<MarketplaceRows<ReinstallMsg>> = sortedBlocks.map((block) => {
    const plugins: ReinstallMsg[] = block.outcomes.map((o) => outcomeToPluginMessage(o));
    return { name: block.name, scope: block.scope, plugins };
  });

  // OUT-04 / D-04: the trailing per-operation tally renders only for the bulk
  // (`@marketplace` / bare) reinstall forms; a single-target `<plugin>@<mp>`
  // reinstall omits it (the row embeds the outcome). The structural
  // single-vs-plural signal is the invocation FORM, threaded from
  // `reinstallPlugins`.
  notifyWithContext(ctx, run, REINSTALL_CONTEXT, marketplaces, undefined, cardinality);
}

/**
 * Type guard narrowing a `ReinstallPluginOutcome` to the `failed` variant
 * tagged with `failureClass: "manual-recovery"`. Used to route manual-
 * recovery outcomes to the `PluginManualRecoveryMessage` variant instead
 * of `PluginFailedMessage` in the cascade payload.
 */
function isManualRecoveryOutcome(
  outcome: ReinstallPluginOutcome,
): outcome is ReinstallFailedOutcome & { readonly failureClass: "manual-recovery" } {
  return outcome.partition === "failed" && outcome.failureClass === "manual-recovery";
}

/**
 * Compose the success row for one reinstalled plugin. The SOLE composer for
 * that row: the standalone verb and the bulk cascade mapper both call it, so
 * the two surfaces cannot report the same ledger run differently (WR-09).
 *
 * CMC-13: `declaresAgents` / `declaresMcp` are required booleans, mapped to the
 * `dependencies: Dependency[]` tuple per SNM-06. The row's `dependencies` feed
 * `resolveRows`, which composes `{requires pi-subagents}` / `{requires pi-mcp-adapter}`
 * when the companion extension is unloaded (D-12).
 *
 * WARN-01 / WR-09 / D-86-03: a component this ledger degraded names its kind and
 * takes the info -> warning raise, exactly as on the install, enable and backfill
 * arms. Discarding the signal here would leave a bare `(reinstalled)` row that
 * `list` renders as degraded one command later. A clean reinstall composes no
 * reasons and stays info, so its row is byte-identical to before (NREG-01).
 *
 * `rowScope` is the caller's orphan-fold decision: `undefined` suppresses the
 * `[<scope>]` bracket per `renderScopeBracket`.
 */
export function reinstalledRowFromOutcome(
  outcome: ReinstallReinstalledOutcome,
  rowScope: Scope | undefined,
): PluginReinstalledMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  // D-10-15 / D-18-07: no tag a range admits pinned this; the marketplace's
  // current copy is what landed. Named first, and it moves no severity, as on
  // update's row.
  const currentCopy: readonly ContentReason[] =
    outcome.constraint?.fellBackToCurrentCopy === true
      ? (["dependency current copy"] as const)
      : [];
  // D-18-06: the kinds the reinstall left out, after the malformed kinds, in
  // the install row's emit order.
  const dropped: readonly ContentReason[] =
    outcome.partialDegrade === undefined
      ? []
      : narrowUnsupportedKinds(outcome.partialDegrade.kinds);
  // WLIF-06: the tail token. The reinstall's new source did not re-place a
  // workflow the record named, so the command that envelope registered is still
  // live -- the host cannot unregister it, and only a reload drops it. Raises
  // the row to `warning`: the reinstall was carried out, but the desired state
  // is not reached until that reload.
  const stale: readonly ContentReason[] =
    outcome.staleWorkflowCommand === true ? (["stale workflow command"] as const) : [];
  const reasons: readonly ContentReason[] = [...currentCopy, ...malformed, ...dropped, ...stale];
  // A newly left-out kind is a shortfall the user did not ask for, so it
  // raises the row; a record that was already partial stays `info`.
  const raised =
    malformed.length > 0 || stale.length > 0 || outcome.partialDegrade?.newlyDegraded === true;
  return {
    status: "reinstalled",
    name: outcome.name,
    // WDEP-04 / SEV-01: the reinstall row stamps the soft-dep marker but takes
    // NO `companionSeverity` raise, matching the `agents` and `mcp` markers on
    // this same row. That asymmetry against install / update / enable is
    // deliberate and byte-pinned by the catalog's reinstall soft-dep state,
    // which carries no attention summary line; do not "repair" it with a raise.
    dependencies: declaredDependencies(outcome),
    // IN-02: the spread is not defensive -- `resolvePluginVersion` always
    // returns a non-empty string. It keeps a legacy record carrying an empty
    // version from putting an empty slot in the payload; the renderer suppresses
    // the `v<version>` token either way.
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    ...(reasons.length > 0 && { reasons }),
    // D-03/D-06: realized reinstall transition -> reloads Pi resources.
    severity: raised ? "warning" : "info",
    needsReload: true,
  };
}

/**
 * Map a `ReinstallPluginOutcome` to its `PluginNotificationMessage`
 * representation. The variant set covers `reinstalled` / `skipped` /
 * `failed` / `manual recovery` per the catalog states.
 *
 * Reason-token mapping precedence (failed/manual-recovery variants):
 *  (1) failureClass=manual-recovery -> `["rollback partial"]`
 *  (2) typed `outcome.reasons` (set at the catch site via
 *  `reasonsFromTypedError(err)`) -> verbatim
 *  (3) substring parse on `notes` via `narrowReasons` -> legacy fallback
 * A plain failed outcome that carries `cause` renders it as the cause line.
 *
 * Orphan-fold scope-bracket suppression: the row carries no `scope?`. The sole
 * caller groups outcomes by `(scope, marketplace)`, so a row's scope always
 * equals its marketplace block's scope, and `renderScopeBracket` in
 * `shared/notification-grammar.ts` suppresses the `[<scope>]` bracket for a row
 * whose scope is absent.
 */
function outcomeToPluginMessage(outcome: ReinstallPluginOutcome): ReinstallMsg {
  switch (outcome.partition) {
    case "reinstalled":
      return reinstalledRowFromOutcome(outcome, undefined);

    case "skipped":
      return skippedRowFromOutcome(outcome);

    case "failed": {
      // CMC-16: structural failure-class tag takes priority over
      // the substring match on `notes` for the manual-recovery
      // class. Manual-recovery is STRUCTURALLY a
      // `PluginManualRecoveryMessage` variant, NOT a
      // `PluginFailedMessage` with a `{rollback partial}` reason. The
      // status discriminator is the literal `"manual recovery"` WITH a
      // space per shared/grammar/status-tokens.ts:47.
      //
      // Reason precedence (locked):
      //  (1) failureClass=manual-recovery -> ["rollback partial"]
      //  (2) typed outcome.reasons -> verbatim
      //  (3) narrowReasons(outcome.notes) -> substring fallback
      // WR-04: `narrowReasons([])` and `narrowReasons(undefined)` both return
      // `[]`, which would render a failed row with no `{<reason>}` brace. Guard
      // with the `"unreadable"` fallback (ATTR-09 / D-47-B) so a failed row never
      // renders bare.
      const narrowed: readonly ContentReason[] = isManualRecoveryOutcome(outcome)
        ? (["rollback partial"] as const)
        : (outcome.reasons ?? narrowReasons(outcome.notes));
      const reasons: readonly ContentReason[] =
        narrowed.length > 0 ? narrowed : (["unreadable"] as const);

      if (isManualRecoveryOutcome(outcome)) {
        const manualRecovery: PluginManualRecoveryMessage = {
          status: "manual recovery",
          name: outcome.name,
          reasons,
          // D-03/D-06: manual-recovery anchor is always actionable -> warning,
          // no reload.
          severity: "warning",
          needsReload: false,
        };
        return manualRecovery;
      }

      const failed: PluginFailedMessage = {
        status: "failed",
        name: outcome.name,
        reasons,
        ...(outcome.cause !== undefined && { cause: outcome.cause }),
        // D-18-10: one child per bridge whose commit or finalize failed.
        ...(outcome.rollbackPartial !== undefined && { rollbackPartial: outcome.rollbackPartial }),
        // D-03/D-06: a failed reinstall -> error, no reload.
        severity: "error",
        needsReload: false,
      };
      return failed;
    }
  }
}

/**
 * The `skipped` row. The shared runner's typed reasons win over the narrowed
 * notes (D-18-07). A `dependents constrain` skip carries the gate's holders on
 * `notes`, and they become the row's cause line, as on update's row.
 */
function skippedRowFromOutcome(outcome: ReinstallSkippedOutcome): PluginUpdateSkippedMessage {
  const reasons = outcome.reasons ?? narrowReasons(outcome.notes);
  const holdsCause = reasons.includes("dependents constrain") && outcome.notes.length > 0;
  return {
    status: "skipped",
    name: outcome.name,
    reasons,
    ...(holdsCause && { cause: new Error(outcome.notes.join(" ")) }),
    // D-01: an absent-target reinstall (the named plugin is not installed)
    // cannot be carried out -> error (severity-only flip; the `(skipped)
    // {not installed}` per-row grammar is preserved). Otherwise benign
    // idempotent skip -> info, actionable skip -> warning; never reloads.
    severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
    needsReload: false,
  };
}

/**
 * Closed-set narrowing for skipped/failed outcome notes. Maps the legacy
 * free-form notes to the closed `Reason` set (CMC-11). Unrecognized text
 * falls back to `"unreadable"` (ATTR-09 / D-47-B: a truthful "could not
 * read/reconcile this row" member, never a false manifest-absence claim) when
 * the underlying cause is opaque.
 *
 * The mapping is intentionally narrow -- production code paths that
 * generate notes have known shapes (`"not installed"`, `"not in
 * manifest"`, `MarketplaceNotFoundError.message`, raw `Error.message`
 * from cached-manifest read). catalog UAT is the binding
 * verification that the mapped reason set is sufficient.
 */
export function narrowReasons(notes: readonly string[] | undefined): readonly ContentReason[] {
  if (notes === undefined || notes.length === 0) {
    return [];
  }

  const reasons: ContentReason[] = [];
  for (const note of notes) {
    reasons.push(narrowReason(note));
  }

  return Object.freeze(reasons);
}

function narrowReason(note: string): ContentReason {
  // Exact-match first. Order: cheapest predicate to most expensive.
  if (note === "not installed") {
    return "not installed";
  }

  if (note === "not in manifest") {
    return "not in manifest";
  }

  if (note === "up-to-date") {
    return "up-to-date";
  }

  if (note === "already installed") {
    return "already installed";
  }

  // ENBL-05: the disabled-record short-circuit's note. Without this arm it
  // falls through to `"unreadable"` and the row claims the cascade could not
  // read the plugin, which is false -- it read it and found the user's disable.
  if (note === "already disabled") {
    return "already disabled";
  }

  // Substring matches for common synthetic messages.
  if (note.includes("not found in cached manifest")) {
    return "not in manifest";
  }

  if (note.includes("not found")) {
    return "not found";
  }

  // CMC-16: the orchestrator's catch blocks set the structural
  // `failureClass: "manual-recovery"` tag on the failed outcome, consumed by
  // `outcomeToPluginMessage`'s closed-set Reason mapping. This narrowing path
  // remains for non-manual-recovery rollback scenarios.
  if (note.includes("rollback")) {
    return "rollback partial";
  }

  // ATTR-09 / D-47-B: last-resort fallback for a genuinely unrecognized note.
  // The cascade could not read/reconcile the on-disk state for this row --
  // that is not a manifest absence, so the truthful member is `"unreadable"`
  // and not `"not in manifest"`, for any cascade/IO failure whose typed
  // dispatch (`reasonsFromTypedError`) missed. No new `REASONS` member is
  // introduced (ContentReason only).
  return "unreadable";
}
