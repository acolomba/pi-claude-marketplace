import { assertNever } from "../../shared/errors.ts";
import { notifyWithContext } from "../../shared/notify-context.ts";
import { malformedReasonsForKinds, skipSeverity } from "../../shared/notify-reasons.ts";
import {
  compareByNameThenScope,
  ICON_INSTALLED,
  ICON_UNINSTALLABLE,
  installedLikeRow,
  pluginRow,
  renderVersion,
  type ContentReason,
  type PluginFailedMessage,
  type PluginManualRecoveryMessage,
  type PluginReinstalledMessage,
  type PluginSkippedMessage,
} from "../../shared/notify.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { Dependency } from "../../shared/concerns/soft-dep.ts";
import type {
  CommandContext,
  MarketplaceRows,
  Plural,
  RenderFn,
} from "../../shared/notify-context.ts";
import type { Scope } from "../../shared/types.ts";
import type {
  ReinstallFailedOutcome,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
} from "../types.ts";

/**
 * reinstall.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin reinstall` (MOD-01). Co-locates reinstall's private status
 * set, its cascade row message shapes, and a render map total over reinstall's
 * OWN statuses (D-10) lifting the matching `renderPluginRow` arm bodies
 * VERBATIM. The shared presentation vocabulary stays central in
 * `shared/notify.ts` (D-11) and is CALLED here, never duplicated.
 *
 * NFR-9: the `manual recovery` / `failed` cause-chain and rollback-partial
 * trailing lines are NOT composed here. The render map renders only the single
 * row body; the central `emitContextCascade` seam appends the indented
 * cause-chain / rollback-partial lines through `redactAbsolutePaths` (D-11), so
 * the path-redaction security seam is never bypassed.
 */

/**
 * reinstall's private status set: a success `reinstalled` row, a `skipped` row
 * (benign no-op), a `failed` row, or a `manual recovery` anchor row.
 */
type ReinstallStatus = "reinstalled" | "skipped" | "failed" | "manual recovery";

/**
 * reinstall's row message union. `dependencies` stays REQUIRED on the
 * `reinstalled` arm so the soft-dep marker injection fires for exactly that arm
 * (D-06 / TYPE-04).
 */
export type ReinstallMsg =
  | PluginReinstalledMessage
  | PluginSkippedMessage
  | PluginFailedMessage
  | PluginManualRecoveryMessage;

/**
 * Render map total over reinstall's OWN statuses (D-10): a missing arm is a
 * TS2741 compile error at the `satisfies` site. Arm bodies are byte-identical
 * to the central `renderPluginRow` switch. The `manual recovery` status
 * discriminator is the literal `"manual recovery"` WITH a space.
 */
const REINSTALL_RENDER: {
  [K in ReinstallStatus]: RenderFn<Extract<ReinstallMsg, { status: K }>>;
} = {
  // WR-09: threads the optional `reasons` brace, matching the central arm. A
  // reinstall that degraded a component names the kind here; a clean one passes
  // an undefined list and renders the same brace-less row as before.
  reinstalled: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(reinstalled)",
      p.reasons,
      probe,
    ),
  skipped: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)", probe),
  failed: (p, probe, mpScope) => pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)", probe),
  "manual recovery": (p, probe, mpScope) =>
    pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(manual recovery)", probe),
};

/**
 * D-04 / D-05: reinstall's `CommandContext`. The `as const satisfies` pin
 * enforces that reinstall supplies both `Messaging.label` and a total render
 * map.
 */
export const REINSTALL_CONTEXT = {
  Messaging: { label: "Plugin reinstall" },
  render: REINSTALL_RENDER,
} as const satisfies CommandContext<ReinstallStatus, ReinstallMsg>;

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
 * `notify(ctx, pi, NotificationMessage)` call per orchestration.
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
 * - Severity + reload-hint are computed by notify().
 * - Per-marketplace iteration order is honored end-to-end: the orchestrator
 *   pre-sorts via `compareByNameThenScope`; notify() does NOT sort
 *   marketplaces[] or plugins[].
 */
// NotificationMessage cascade recipe:
// - One MarketplaceNotificationMessage per affected marketplace, emitted via
//   a single notify(ctx, pi, ...) call per orchestration.
// - plugins: readonly PluginNotificationMessage[] in display order
//   (orchestrator-controlled iteration; notify does not sort).
// - Discriminators by status: "reinstalled" / "skipped" / "failed" /
//   "manual recovery".
// - Severity + "/reload to pick up changes" trailer are computed by notify();
//   callers MUST NOT compose them.
// - Reference: catalog UAT plugin-reinstall fixtures.
export function renderReinstallPartitionAndNotify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
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
  // the render map is a compile error here.
  const marketplaces: Plural<MarketplaceRows<ReinstallMsg>> = sortedBlocks.map((block) => {
    const plugins: ReinstallMsg[] = block.outcomes.map((o) =>
      outcomeToPluginMessage(o, block.scope),
    );
    return { name: block.name, scope: block.scope, plugins };
  });

  // OUT-04 / D-04: the trailing per-operation tally renders only for the bulk
  // (`@marketplace` / bare) reinstall forms; a single-target `<plugin>@<mp>`
  // reinstall omits it (the row embeds the outcome). The structural
  // single-vs-plural signal is the invocation FORM, threaded from
  // `reinstallPlugins`.
  notifyWithContext(ctx, pi, REINSTALL_CONTEXT, marketplaces, undefined, cardinality);
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
 * `dependencies: Dependency[]` tuple per SNM-06. The renderer's per-row soft-dep
 * probe fires `{requires pi-subagents}` / `{requires pi-mcp}` when the companion
 * extension is unloaded.
 *
 * WARN-01 / WR-09 / D-86-03: a component this ledger degraded names its kind and
 * takes the info -> warning raise, exactly as on the install, enable and backfill
 * arms. `reinstall` was the last ledger-driven verb whose outcome carried the
 * signal but whose row discarded it -- a bare `(reinstalled)` row over a record
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
  return {
    status: "reinstalled",
    name: outcome.name,
    dependencies: dependenciesFromOutcome(outcome),
    // IN-02: the spread is not defensive -- `resolvePluginVersion` always
    // returns a non-empty string. It keeps a legacy record carrying an empty
    // version from putting an empty slot in the payload; the renderer suppresses
    // the `v<version>` token either way.
    ...(outcome.version !== "" && { version: outcome.version }),
    ...(rowScope !== undefined && { scope: rowScope }),
    ...(malformed.length > 0 && { reasons: malformed }),
    // D-03/D-06: realized reinstall transition -> reloads Pi resources.
    severity: malformed.length > 0 ? "warning" : "info",
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
 *
 * Orphan-fold scope-bracket suppression: per-row `scope?` is
 * OMITTED when it matches the marketplace's scope. The renderer's
 * `renderScopeBracket` contract at `shared/notify.ts` suppresses
 * `[<scope>]` brackets when the row's scope is absent.
 */
export function outcomeToPluginMessage(
  outcome: ReinstallPluginOutcome,
  marketplaceScope: Scope,
): ReinstallMsg {
  const rowScope = outcome.scope === marketplaceScope ? undefined : outcome.scope;
  switch (outcome.partition) {
    case "reinstalled":
      return reinstalledRowFromOutcome(outcome, rowScope);

    case "skipped": {
      const reasons = narrowReasons(outcome.notes);
      const skipped: PluginSkippedMessage = {
        status: "skipped",
        name: outcome.name,
        reasons,
        ...(rowScope !== undefined && { scope: rowScope }),
        // D-01: an absent-target reinstall (the named plugin is not installed)
        // cannot be carried out -> error (severity-only flip; the `(skipped)
        // {not installed}` per-row grammar is preserved). Otherwise benign
        // idempotent skip -> info, actionable skip -> warning; never reloads.
        severity: reasons.includes("not installed") ? "error" : skipSeverity(reasons),
        needsReload: false,
      };
      return skipped;
    }

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
          ...(rowScope !== undefined && { scope: rowScope }),
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
        ...(rowScope !== undefined && { scope: rowScope }),
        // D-03/D-06: a failed reinstall -> error, no reload.
        severity: "error",
        needsReload: false,
      };
      return failed;
    }

    default:
      return assertNever(outcome);
  }
}

/**
 * Map a `ReinstallReinstalledOutcome`'s `declaresAgents` / `declaresMcp`
 * predicate flags to the `Dependency[]` tuple consumed by
 * `PluginReinstalledMessage.dependencies` per SNM-06. The
 * renderer's per-row soft-dep probe iterates this array to emit
 * `{requires pi-subagents}` / `{requires pi-mcp}` markers when the
 * companion extension is unloaded (MSG-SD-1..2).
 */
function dependenciesFromOutcome(outcome: ReinstallReinstalledOutcome): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (outcome.declaresAgents) {
    deps.push("agents");
  }

  if (outcome.declaresMcp) {
    deps.push("mcp");
  }

  return Object.freeze(deps);
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
  // The cascade could not read/reconcile the on-disk state for this row;
  // `"unreadable"` is the truthful existing member. The former
  // `"not in manifest"` LIED that the plugin was absent from the manifest for
  // any cascade/IO failure whose typed dispatch (`reasonsFromTypedError`)
  // missed. No new `REASONS` member is introduced (ContentReason only).
  return "unreadable";
}
