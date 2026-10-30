// orchestrators/plugin/bootstrap.ts
//
// One-keystroke onboarding for the Anthropic marketplace.
// behavioral-composition-exception: bootstrapClaudePlugin
//
// Runs the already-idempotent `addMarketplace` under hard-coded user scope
// so a new Pi user can run `/claude:plugin bootstrap` and land in a working
// state with the canonical Anthropic marketplace configured. Its official
// name turns autoupdate on by default (D-PL8-07), so bootstrap writes no
// autoupdate value, and a value the user set stays as it is.
//
// Notes / forbidden patterns (reviewer guard rails):
//   - No direct `ctx.ui.notify` here. All user-visible signals come
//     from the composed add via shared/notification-dispatch.ts (IL-2).
//     MOD-01: bootstrap owns NO notification vocabulary of its own; the
//     delegated `addMarketplace` emits through its own command context
//     (ADD_CONTEXT), so the bootstrap-emitted bytes are exactly
//     `marketplace add`'s bytes.
//   - No `notifySuccess` wrapper added on top of the composed add -- the
//     contract is one user-visible signal per state change, and the add
//     emits exactly that.
//   - No `gitOps` default applied here -- `addMarketplace` already
//     applies `DEFAULT_GIT_OPS` when `opts.gitOps` is undefined.
//   - No `scope` field on `BootstrapOptions` -- scope is hard-coded to
//     `"user"`. The edge handler also rejects `--scope` explicitly.
//   - No pre-check of `loadState` to skip the add; it is already
//     idempotent under `withStateGuard`, and
//     pre-checking would introduce a TOCTOU race with concurrent install
//     locks plus duplicate logic.
//   - MPA-01: a re-run gets `marketplace add`'s own
//     `(skipped) {already added}` row, so nothing is swallowed. Every add
//     precondition, a different source under the official name included, is
//     rendered by `notifyAddFailure`, byte-identical to `marketplace add` for
//     the same source (reason and cause). An error that is not an add
//     precondition propagates. A throw of the missing-dependency step comes
//     after the add committed, so it is not an add failure: it propagates as
//     a `BootstrapStepError`.
//   - ATTR-07: bootstrap passes `rethrowPreconditionErrors: true` so a failed
//     add reaches the catch below, which renders it.

import { addMarketplace, notifyAddFailure } from "../marketplace/add.ts";

import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AddMarketplaceOptions } from "../marketplace/add.ts";
import type { GitOps } from "../marketplace/shared.ts";
import type { ScopeDependencyInstallFn } from "../types.ts";

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
 * manifest and records it. The edge handler names this marketplace on the failed row it
 * emits when bootstrap throws. Keeping it as a single shared constant
 * prevents drift.
 */
export const BOOTSTRAP_MARKETPLACE_NAME = "claude-plugins-official";

/**
 * WR-02 / D-PL2-09: a step after the official marketplace's add committed
 * threw. The add already reported `(added)`, so this is not a failed add: the handler lets `cause` reach the command, as
 * `marketplace add` does for the same step.
 */
export class BootstrapStepError extends Error {
  constructor(cause: unknown) {
    super("a step after the bootstrap marketplace add failed", { cause });
    this.name = "BootstrapStepError";
  }
}

export interface BootstrapOptions {
  readonly ctx: ExtensionContext;
  /**
   * D-05 / D-07: the command's run, shared with the nested `addMarketplace`.
   */
  readonly run: NotificationRun;
  readonly cwd: string;
  readonly completionCache: CompletionCache;
  /** D-12 injection seam. Always provided by the edge handler via EdgeDeps. */
  readonly gitOps: GitOps;
  /**
   * D-PL2-09: bootstrap runs the missing-dependency step through its add, in
   * the user scope, and the add selects only the official marketplace's
   * dependencies. Its rows render under the add's `(added)` row.
   */
  readonly installMissingDependencies: ScopeDependencyInstallFn;
}

/**
 * Add the canonical Anthropic marketplace to user scope. Its official name
 * turns autoupdate on by default (D-PL8-07), and bootstrap leaves an
 * autoupdate value in `claude-plugins.json` as the user set it. Idempotent
 * end-to-end:
 *   - first run on clean state: emits the add's `(added)` row.
 *   - re-run: emits the add's `(skipped) {already added}` row (MPA-01).
 *
 * An idempotent re-run is recognized before any clone: `addMarketplace`
 * matches the typed source against the user scope's records inside its own
 * state lock (WR-05 in `orchestrators/marketplace/add.ts`). When only the user's
 * `claude-plugins.local.json` declares the marketplace, the add declares
 * it in `claude-plugins.json` too and emits its `(added)` row, still
 * without a clone (LAYER-01).
 */
export async function bootstrapClaudePlugin(opts: BootstrapOptions): Promise<void> {
  const add: { committed: boolean } = { committed: false };
  const addOptions: AddMarketplaceOptions = {
    ctx: opts.ctx,
    run: opts.run,
    scope: "user",
    cwd: opts.cwd,
    rawSource: BOOTSTRAP_SOURCE,
    completionCache: opts.completionCache,
    gitOps: opts.gitOps,
    installMissingDependencies: (request) => {
      // The add runs the step only after its state commit.
      add.committed = true;
      return opts.installMissingDependencies(request);
    },
    // ATTR-07: re-throw the typed precondition instead of emitting a
    // `(failed)` row, so the catch below renders it.
    rethrowPreconditionErrors: true,
  };
  try {
    await addMarketplace(addOptions);
  } catch (err) {
    if (!add.committed) {
      // A failed add reports its reason and cause as `marketplace add` does
      // for the same source.
      notifyAddFailure(addOptions, err);
      return;
    }

    // WR-02: the add committed and reported `(added)`, so a throw of its
    // missing-dependency step is not an add failure. It reaches the handler
    // wrapped, so the handler can tell it from a failed add.
    throw new BootstrapStepError(err);
  }
}
