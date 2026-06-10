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
// CFG-03 (Pitfall 53-1): when EITHER `base` or `local` config arm is
// `invalid`, surface a `(failed) {invalid manifest}` row for that scope and
// DO NOT call `planReconcile` for it. Invalid input is NEVER silently
// coerced to empty desired state (which would render as a mass-uninstall
// preview).
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

import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";

import { buildReconcilePreviewNotification, isReconcilePlanListEmpty } from "./notify.ts";
import { planReconcile } from "./plan.ts";

import type { ReconcilePlan } from "./types.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  CascadeNotificationMessage,
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
 * CFG-03 / Pitfall 53-1: surface an invalid config arm as a structured
 * `(failed) {invalid manifest}` marketplace row. The marketplace `name`
 * carries the file's BASENAME (never the absolute path -- RESEARCH Security
 * Threat Pattern "Information disclosure" T-53-02-02).
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

export async function previewReconcile(opts: PreviewReconcileOptions): Promise<void> {
  // Project-first per MSG-GR-3 when both scopes are searched; otherwise the
  // explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  const plans: ReconcilePlan[] = [];
  const invalidBlocks: MarketplaceNotificationMessage[] = [];

  for (const scope of scopes) {
    const loc = locationsFor(scope, opts.cwd);
    const outcome = await loadMergedScopeConfig(loc);

    // CFG-03 abort (Pitfall 53-1): if EITHER base or local config is invalid,
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

    const state = await loadState(loc.extensionRoot);
    plans.push(planReconcile(outcome.merged, state, scope));
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
  // blocks; the invalid-config blocks are appended (project-first per scope
  // fan-out order). The two block sources never collide because the
  // invalid-config path skips planReconcile for that scope -- a scope can be
  // EITHER in `plans` OR in `invalidBlocks`, never both.
  const projection = buildReconcilePreviewNotification(plans);
  const message: CascadeNotificationMessage = {
    marketplaces: [...projection.marketplaces, ...invalidBlocks],
  };

  notify(opts.ctx, opts.pi, message);
}
