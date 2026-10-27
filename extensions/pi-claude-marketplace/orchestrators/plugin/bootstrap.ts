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
//   - MPA-01: a re-run gets `marketplace add`'s own
//     `(skipped) {already added}` row, so nothing is swallowed. Every add
//     precondition, a different source under the official name included, is
//     rendered by `notifyAddFailure`, byte-identical to `marketplace add` for
//     the same source (reason and cause), and the autoupdate step is skipped.
//     An error that is not an add precondition propagates.
//   - ATTR-07: bootstrap passes `rethrowPreconditionErrors: true` so a failed
//     add reaches the catch below, which is how it knows to skip the
//     autoupdate step.

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
 * autoupdate for it. Its official name already turns autoupdate on by default
 * (D-PL8-07, reversed), so the autoupdate step writes no value and reports
 * `(skipped) {already autoupdate}` unless `claude-plugins.json` sets the value
 * off (D-PL8-19). Idempotent end-to-end:
 *   - first run on clean state: emits the add's `(added)` row, then the
 *     autoupdate step's `(skipped) {already autoupdate}` row.
 *   - re-run: emits the add's `(skipped) {already added}` row, then the same
 *     autoupdate row (MPA-01).
 *   - re-run when `claude-plugins.json` sets autoupdate off: emits the same
 *     skipped add row, then `(autoupdate enabled)`.
 *
 * An idempotent re-run is recognized before any clone: `addMarketplace`
 * matches the typed source against the user scope's records inside its own
 * state lock (WR-05 in `orchestrators/marketplace/add.ts`). When only the user's
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
    // ATTR-07: re-throw the typed precondition instead of emitting a
    // `(failed)` row, so the catch below can skip the autoupdate step.
    rethrowPreconditionErrors: true,
  };
  try {
    await addMarketplace(addOptions);
  } catch (err) {
    // A failed add reports its reason and cause as `marketplace add` does for
    // the same source, and there is nothing to autoupdate.
    notifyAddFailure(addOptions, err);
    return;
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
