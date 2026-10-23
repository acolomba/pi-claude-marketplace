// orchestrators/plugin/bootstrap.ts
//
// One-keystroke onboarding for the Anthropic marketplace.
// behavioral-composition-exception: bootstrapClaudePlugin
//
// Composes the two already-idempotent orchestrators
// (`addMarketplace` + `setMarketplaceAutoupdate`) under hard-coded
// user scope so a new Pi user can run `/claude:plugin bootstrap` and
// land in a working state with the canonical Anthropic marketplace
// configured and tracking upstream.
//
// Notes / forbidden patterns (reviewer guard rails):
//   - No direct `ctx.ui.notify` here. All user-visible signals come
//     from the two composed orchestrators via shared/notification-dispatch.ts (IL-2).
//     MOD-01: bootstrap owns NO notification vocabulary of its own; the
//     delegated `addMarketplace` / `setMarketplaceAutoupdate` emit through
//     their own command contexts (ADD_CONTEXT / AUTOUPDATE_CONTEXT), so the
//     bootstrap-emitted bytes are exactly those commands' bytes.
//   - No `notifySuccess` wrapper added on top of the composed
//     orchestrators -- the contract is one user-visible signal per
//     state change; the composed orchestrators each emit exactly that.
//   - No `gitOps` default applied here -- `addMarketplace` already
//     applies `DEFAULT_GIT_OPS` when `opts.gitOps` is undefined.
//   - No `scope` field on `BootstrapOptions` -- scope is hard-coded to
//     `"user"`. The edge handler also rejects `--scope` explicitly.
//   - No pre-check of `loadState` to skip steps; the underlying
//     orchestrators are already idempotent under `withStateGuard`, and
//     pre-checking would introduce a TOCTOU race with concurrent install
//     locks plus duplicate logic.
//   - Only `MarketplaceDuplicateNameError` is swallowed from
//     `addMarketplace`. Every other add precondition is rendered by
//     `notifyAddFailure`, byte-identical to `marketplace add` for the same
//     source (reason and cause), and the autoupdate step is skipped. An error
//     that is not an add precondition propagates.
//   - ATTR-07: `addMarketplace` now routes precondition failures
//     (incl. duplicate name) through `notify` as a `(failed) {<reason>}` row
//     for the public `marketplace add` command. Bootstrap MUST keep the
//     one-signal-per-state-change contract, so it passes
//     `rethrowPreconditionErrors: true` to restore the throw-based contract
//     it depends on -- catching + swallowing the typed duplicate-name error so
//     no failed row leaks on an idempotent re-run.

import { MarketplaceDuplicateNameError } from "../../shared/errors.ts";
import { addMarketplace, notifyAddFailure } from "../marketplace/add.ts";
import { setMarketplaceAutoupdate } from "../marketplace/autoupdate.ts";

import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AddMarketplaceOptions } from "../marketplace/add.ts";
import type { GitOps } from "../marketplace/shared.ts";

/**
 * Hard-coded GitHub shorthand for the canonical Anthropic marketplace.
 * Not user-overridable. If a future iteration introduces
 * configurable bootstrap targets, this constant becomes a defaulted
 * field on `BootstrapOptions`.
 */
const BOOTSTRAP_SOURCE = "anthropics/claude-plugins-official";

/**
 * The manifest `name` field for `anthropics/claude-plugins-official`.
 * `addMarketplace` derives this value from the cloned marketplace
 * manifest and records it; `setMarketplaceAutoupdate` reads the same
 * key. The edge handler also names this marketplace on the failed row it
 * emits when bootstrap throws. Keeping it as a single shared constant
 * prevents drift.
 */
export const BOOTSTRAP_MARKETPLACE_NAME = "claude-plugins-official";

export interface BootstrapOptions {
  readonly ctx: ExtensionContext;
  /**
   * D-05 / D-07: the command's run, shared with the nested `addMarketplace`
   * and `setMarketplaceAutoupdate`.
   */
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly completionCache: CompletionCache;
  /** D-12 injection seam. Always provided by the edge handler via EdgeDeps. */
  readonly gitOps: GitOps;
}

/**
 * Add the canonical Anthropic marketplace to user scope and enable
 * autoupdate for it. Idempotent end-to-end:
 *   - first run on clean state: emits two notifications (add + enable).
 *   - re-run on fully bootstrapped state: emits ONE idempotent
 *     "Already enabled: ..." notification from the autoupdate step.
 *     The add step's `MarketplaceDuplicateNameError` is swallowed so
 *     no duplicate "already added" message is emitted.
 *   - re-run on half-bootstrapped state (marketplace present, autoupdate
 *     off): emits ONE "Enabled autoupdate: ..." notification.
 *
 * An idempotent re-run meets the duplicate-name check before any clone:
 * `addMarketplace` matches the typed source against the user scope's
 * records inside its own state lock (WR-05 in
 * `orchestrators/marketplace/add.ts`). When only the user's
 * `claude-plugins.local.json` declares the marketplace, the add declares
 * it in `claude-plugins.json` too and emits its `(added)` row, still
 * without a clone (LAYER-01).
 */
export async function bootstrapClaudePlugin(opts: BootstrapOptions): Promise<void> {
  const addOptions: AddMarketplaceOptions = {
    ctx: opts.ctx,
    run: opts.run,
    scope: "user",
    cwd: opts.cwd,
    rawSource: BOOTSTRAP_SOURCE,
    completionCache: opts.completionCache,
    gitOps: opts.gitOps,
    // ATTR-07: re-throw the typed precondition (incl. MarketplaceDuplicateName
    // Error) instead of emitting a `(failed)` row, so the catch below can
    // swallow the idempotent re-run and keep one-signal-per-state-change.
    rethrowPreconditionErrors: true,
  };
  try {
    await addMarketplace(addOptions);
  } catch (err) {
    // The marketplace already exists in user scope -- idempotent path.
    // The autoupdate step below covers the user-visible signal via its
    // "Already enabled: ..." message. Do NOT emit any "already added"
    // notification here to keep the single-signal-per-state-change
    // contract from the composed orchestrators.
    if (!(err instanceof MarketplaceDuplicateNameError)) {
      // Any other failed add reports its reason and cause as `marketplace
      // add` does for the same source, and there is nothing to autoupdate.
      notifyAddFailure(addOptions, err);
      return;
    }
  }

  await setMarketplaceAutoupdate({
    ctx: opts.ctx,
    run: opts.run,
    name: BOOTSTRAP_MARKETPLACE_NAME,
    enable: true,
    scope: "user",
    cwd: opts.cwd,
  });
}
