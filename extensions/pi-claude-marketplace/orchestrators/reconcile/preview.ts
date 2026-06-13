// orchestrators/reconcile/preview.ts
//
// DIFF-01 SC #2 / DIFF-02 read-only preview surface for `/claude:plugin
// preview` (D-53-01).
//
// MUST NOT touch the network (NFR-5) -- no `platform/git`, no
// `DEFAULT_GIT_OPS`, no `refreshGitHubClone`. The architecture grep-gate
// test in `tests/architecture/no-orchestrator-network.test.ts` enforces this
// structurally.
//
// NEVER writes any file (NFR-5 read-surface discipline). Idempotency
// (DIFF-01 SC #2): two consecutive invocations against unchanged state +
// config produce byte-identical output.
//
// CFG-03: when EITHER `base` or `local` config arm is `invalid`, surface a
// `(failed) {invalid manifest}` row for that scope and DO NOT call
// `planReconcile` for it. Invalid input is NEVER silently coerced to empty
// desired state (which would render as a mass-uninstall preview).
//
// IL-2: exactly ONE `notify()` call per invocation -- the orchestrator
// accumulates per-scope plans + invalid-config rows, builds a single
// `NotificationMessage`, and dispatches once.
//
// Empty-plan case (DIFF-01 SC #2): when every plan is empty AND no scope
// surfaced an invalid-config failure, the orchestrator dispatches the
// dedicated `ReconcilePreviewEmptyMessage` standalone-arm variant whose
// renderer arm hard-codes the catalog-locked advisory body line
// `Preview: next reload will apply 0 actions.`. Routing the empty case
// through `notify()` preserves IL-2 and lets the catalog-uat byte-equality
// runner exercise the empty path through the same public surface as every
// other variant.

import path from "node:path";

import { loadMergedScopeConfig, mergeScopeConfigs } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { buildConfigFromState } from "../../persistence/migrate-config.ts";
import { loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";

import { buildReconcilePreviewNotification, isReconcilePlanListEmpty } from "./notify.ts";
import { planReconcile } from "./plan.ts";

import type { ReconcilePlan } from "./types.ts";
import type { MergedConfig, ScopeLoadOutcome } from "../../persistence/config-merge.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  CascadeNotificationMessage,
  ContentReason,
  MarketplaceNotificationMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface PreviewReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
  /** When omitted, fan-out across BOTH scopes (project-first per MSG-GR-3). */
  readonly scope?: Scope;
}

/**
 * CFG-03: surface an invalid config arm as a structured `(failed)
 * {invalid manifest}` marketplace row. The marketplace `name` carries the
 * file's BASENAME (never the absolute path -- information-disclosure
 * mitigation T-53-02-02).
 */
function buildInvalidConfigBlock(scope: Scope, filePath: string): MarketplaceNotificationMessage {
  return {
    name: path.basename(filePath),
    scope,
    status: "failed",
    reasons: ["invalid manifest"],
    plugins: [],
  };
}

/**
 * Classify a `loadState` throw (unparseable JSON, schema-invalid record,
 * unreadable file) into a closed-set reason. `loadState` wraps the raw
 * `JSON.parse` `SyntaxError` in an `Error` whose `cause` is the
 * `SyntaxError`, so unwrap the cause before delegating to the shared
 * `narrowProbeError` ladder (which the sibling read-only `listPlugins`
 * catch path also routes through).
 */
function narrowStateLoadFailReason(err: unknown): ContentReason {
  if (err instanceof Error && err.cause instanceof SyntaxError) {
    return "unparseable";
  }

  return narrowProbeError(err);
}

/**
 * MIG-01 pre-migration window (DIFF-01): pick the merged desired-state view
 * the planner runs against. When the BASE config file is ABSENT, the apply
 * path migrates FIRST inside its lock (apply.ts::readPassForScope step 1
 * writes `buildConfigFromState(state)` to `claude-plugins.json`, then plans
 * against the merged view). A preview that planned against the raw merged
 * view (absent base == empty desired state) would render a misleading
 * mass-uninstall plan for a populated state. Mirror the post-migration
 * merged view READ-ONLY instead: plan against the PURE
 * `buildConfigFromState` projection merged with the local arm -- no write,
 * no migration side effect (NFR-5 read-surface discipline). A pristine
 * scope (empty state) projects an empty config, so the empty-advisory
 * behavior is unchanged; an invalid base/local arm never reaches this
 * helper (CFG-03 abort happens first).
 */
function mergedViewForPlanning(outcome: ScopeLoadOutcome, state: ExtensionState): MergedConfig {
  if (outcome.base.status !== "absent") {
    return outcome.merged;
  }

  const local = outcome.local.status === "valid" ? outcome.local.config : {};
  return mergeScopeConfigs(buildConfigFromState(state), local);
}

export async function previewReconcile(opts: PreviewReconcileOptions): Promise<void> {
  // Project-first per MSG-GR-3 when both scopes are searched; otherwise the
  // explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  const plans: ReconcilePlan[] = [];
  const invalidBlocks: MarketplaceNotificationMessage[] = [];

  for (const scope of scopes) {
    const loc = locationsFor(scope, opts.cwd);
    const outcome = await loadMergedScopeConfig(loc);

    // CFG-03 abort: if EITHER base or local config is invalid,
    // emit a (failed) {invalid manifest} row for that scope. Do NOT call
    // planReconcile -- invalid input must never be coerced into an empty
    // desired-state diff that would render as a mass-uninstall preview.
    if (outcome.base.status === "invalid") {
      invalidBlocks.push(buildInvalidConfigBlock(scope, outcome.base.filePath));
    }

    if (outcome.local.status === "invalid") {
      invalidBlocks.push(buildInvalidConfigBlock(scope, outcome.local.filePath));
    }

    if (outcome.base.status === "invalid" || outcome.local.status === "invalid") {
      // Skip the planner for this scope.
      continue;
    }

    // Failure containment (IL-2): a hand-edited / corrupt `state.json`
    // throws from `loadState` (unparseable JSON or schema-invalid record).
    // Mirror the CFG-03 arm above -- surface a structured `(failed)` row
    // carrying the BASENAME (T-53-02-02: never the absolute path) instead
    // of letting the throw escape the command handler with no
    // `ctx.ui.notify` output at all (the sibling read-only `listPlugins`
    // catches exactly this class).
    let state;
    try {
      state = await loadState(loc.extensionRoot);
    } catch (err) {
      invalidBlocks.push({
        name: "state.json",
        scope,
        status: "failed",
        reasons: [narrowStateLoadFailReason(err)],
        plugins: [],
      });
      continue;
    }

    // MIG-01 pre-migration window (DIFF-01): plan against what the next
    // load's reconcile would actually see (the apply path migrates first),
    // not against an absent-as-empty merged view -- see mergedViewForPlanning.
    plans.push(planReconcile(mergedViewForPlanning(outcome, state), state, scope));
  }

  // DIFF-01 SC #2 empty-steady-state: no invalid-config rows AND every plan
  // is empty -> dispatch the dedicated ReconcilePreviewEmptyMessage variant
  // (the renderer hard-codes the catalog-locked advisory body line, so the
  // byte form cannot drift from docs/output-catalog.md). IL-2 preserved by
  // routing through notify() exactly once.
  if (invalidBlocks.length === 0 && isReconcilePlanListEmpty(plans)) {
    notify(opts.ctx, opts.pi, { kind: "reconcile-preview-empty" });
    return;
  }

  // Compose the cascade message: the projection emits the per-scope plan
  // blocks; the invalid-config / invalid-state blocks are merged in and the
  // whole list re-sorted via compareByNameThenScope so mixed output honours
  // the single per-scope row-order policy (MSG-GR-3: name primary
  // case-insensitive, project-before-user secondary) every other
  // list-rendering surface routes through. The two block sources never
  // collide on a key because the invalid path skips planReconcile for that
  // scope -- a scope can be EITHER in `plans` OR in `invalidBlocks`, never
  // both.
  const projection = buildReconcilePreviewNotification(plans);
  const message: CascadeNotificationMessage = {
    marketplaces: [...projection.marketplaces, ...invalidBlocks].sort((a, b) =>
      compareByNameThenScope(a, b),
    ),
  };

  notify(opts.ctx, opts.pi, message);
}
