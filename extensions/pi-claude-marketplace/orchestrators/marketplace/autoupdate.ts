// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Each orchestration emits a single
// notify(opts.ctx, opts.pi, { marketplaces: [...] }) call. Outcomes map to
// the 7-entry MarketplaceStatus grammar (+ optional `reasons?:`):
//
//  - enable fresh -> status: "autoupdate enabled"
//  -> `● <mp> [<scope>] <autoupdate>`
//  - disable fresh -> status: "autoupdate disabled"
//  -> `● <mp> [<scope>] <no autoupdate>`
//  - enable idempotent -> status: "skipped", reasons: ["already autoupdate"]
//  -> `● <mp> [<scope>] <autoupdate> {already autoupdate}`
//  severity: "warning"
//  - disable idempotent -> status: "skipped", reasons: ["already no autoupdate"]
//  -> `● <mp> [<scope>] <no autoupdate> {already no autoupdate}`
//  severity: "warning"
//  - failure (not-found) -> status: "failed"
//  -> `⊘ <mp> [<scope>] (failed)`
//  severity: "error"
//  - empty scopes -> marketplaces: []
//  -> `(no marketplaces)` sentinel
//
// None of these emit the `/reload to pick up changes` trailer:
// `shouldEmitReloadHint` fires only on a PLUGIN row with a state-changing
// status (installed/updated/reinstalled/uninstalled), and an autoupdate flip
// changes a marketplace record, not a Pi-visible resource (SNM-33).
//
// UXG-04 / MSG-GR-5 (reverses the Phase 17.1 / D-18-05 status-token design):
// the marker-as-outcome row form (`● <mp> [<scope>] <autoupdate>` /
// `<no autoupdate>`) IS NOW the emitted form on the flip surface, for byte-form
// parity with the marketplace-list surface header. Fresh flips render the bare
// marker; idempotent flips render the marker + the `{already autoupdate}` /
// `{already no autoupdate}` brace. The renderer (shared/notify.ts) owns the
// byte composition; per CLAUDE.md IL-2 all output still flows through notify().
// Strategy B: the `autoupdate enabled` / `autoupdate disabled` / `skipped`
// MarketplaceStatus discriminators are UNCHANGED -- only the emitted bytes and
// the two renamed REASONS members (`already autoupdate` / `already no
// autoupdate`) differ.
//
// Single orchestrator parameterized by `enable: boolean`. The edge layer maps
// `marketplace autoupdate` -> enable=true and `marketplace noautoupdate` ->
// enable=false.
//
// Flow:
//  scopes = opts.scope !== undefined ? [opts.scope] : ["project", "user"] // SC-6
//  for each scope:
//  withStateGuard(locations, async (state) => {
//  result = applyAutoupdateFlipInPlace(state, opts.name, opts.enable) // MAU-1, MAU-3, MAU-4
//  }) // saves state.json on no-throw
//  accumulate result.changed[] and result.unchanged[] across scopes
//
//  compose one MarketplaceNotificationMessage per outcome; emit ONE
//  notify(opts.ctx, opts.pi,...) call. The caller-supplied order is honored
//  end-to-end; the SC-6 scopes-loop order (project-then-user) is the visible
//  iteration order. No alphabetic sort -- the renderer does not sort and the
//  orchestrator must not re-sort.
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import { locationsFor } from "../../persistence/locations.ts";
import { errorMessage, MarketplaceNotFoundError, StateLockHeldError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { applyAutoupdateFlipInPlace } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  MarketplaceNotificationMessage,
  PluginFailedMessage,
  Reason,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
  /**
   * Soft-dep probe target, consumed by the `notify(ctx, pi, message)` calls
   * below to drive the single per-invocation soft-dep probe -- even though
   * mp-level rows never inject soft-dep markers, the probe is threaded through
   * every notify entry for invariant symmetry.
   */
  readonly pi: ExtensionAPI;
  /** When undefined, flip every marketplace in target scope(s). */
  readonly name?: string;
  /** true -> autoupdate; false -> noautoupdate. */
  readonly enable: boolean;
  /** When undefined, SC-6 enumerates BOTH scopes. */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

function shouldCollectNotFound(opts: AutoupdateOptions, err: unknown): boolean {
  return opts.name !== undefined && err instanceof MarketplaceNotFoundError;
}

interface AutoupdateFlipRow {
  readonly name: string;
  readonly scope: Scope;
  readonly alreadyMatching: boolean;
}

function missingEverywhere(
  opts: AutoupdateOptions,
  result: {
    readonly rows: readonly AutoupdateFlipRow[];
    readonly errors: readonly unknown[];
    readonly scopes: readonly Scope[];
  },
): boolean {
  return (
    opts.name !== undefined &&
    result.rows.length === 0 &&
    result.errors.length === result.scopes.length
  );
}

/**
 * Builds the synthetic failed-plugin child that carries the underlying
 * autoupdate-flip error to the user. The marketplace header alone cannot
 * carry a cause (SNM-10), so the child's `cause` drives the renderer's
 * depth-5 cause-chain trailer. A held state lock narrows to the `lock held`
 * reason (its message carries the retry hint); anything else falls back to
 * the permissive `not found`.
 */
function autoupdateFailedRow(name: string, err: unknown): PluginFailedMessage {
  const reasons: readonly Reason[] =
    err instanceof StateLockHeldError ? (["lock held"] as const) : (["not found"] as const);
  return {
    status: "failed",
    name,
    reasons,
    cause: err instanceof Error ? err : new Error(errorMessage(err)),
  };
}

export async function setMarketplaceAutoupdate(opts: AutoupdateOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  const rows: AutoupdateFlipRow[] = [];
  const errors: { scope: Scope; cause: unknown }[] = [];

  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    try {
      const result = await withStateGuard(locations, (state) => {
        // applyAutoupdateFlipInPlace mutates state in place and returns
        // plain changed/unchanged arrays. The guard saves on no-throw.
        return applyAutoupdateFlipInPlace(state, opts.name, opts.enable);
      });
      for (const name of result.changed) {
        rows.push({ name, scope, alreadyMatching: false });
      }

      for (const name of result.unchanged) {
        rows.push({ name, scope, alreadyMatching: true });
      }
    } catch (err) {
      // For single-name flips: applyAutoupdateFlipInPlace throws
      // MarketplaceNotFoundError when the name is absent from THIS
      // scope. With SC-6 bare-form, that is expected if the name only
      // lives in the OTHER scope; we collect and only surface if BOTH
      // scopes failed AND no flips happened anywhere.
      if (!shouldCollectNotFound(opts, err)) {
        // A non-NotFound autoupdate-flip failure renders as the header
        // `⊘ <name> [<scope>] (failed)`. The MarketplaceNotificationMessage
        // shape carries no `cause` (SNM-10 confines `cause` to plugin-level
        // variants), so surface the underlying error -- notably
        // StateLockHeldError, whose message carries an actionable retry
        // hint -- via a synthetic failed-plugin child whose `cause` drives
        // the depth-5 cause-chain trailer the renderer appends.
        const failureName = opts.name ?? "(unknown)";
        notify(opts.ctx, opts.pi, {
          marketplaces: [
            {
              name: failureName,
              scope,
              status: "failed",
              plugins: [autoupdateFailedRow(failureName, err)],
            },
          ],
        });
        return;
      }

      errors.push({ scope, cause: err });
    }
  }

  // If a single-name flip was requested but the name was missing
  // from EVERY iterated scope (no row accumulated and every scope
  // errored), surface as a single failure marketplace row.
  if (missingEverywhere(opts, { rows, errors, scopes })) {
    const first = errors[0];
    if (first !== undefined) {
      // Failure path: emit a single failed marketplace row for the scope
      // where the first not-found was observed.
      const failureName = opts.name ?? "(unknown)";
      notify(opts.ctx, opts.pi, {
        marketplaces: [
          {
            name: failureName,
            scope: first.scope,
            status: "failed",
            plugins: [],
          },
        ],
      });
    }

    return;
  }

  // Empty marketplaces[] -> notify emits the `(no marketplaces)` sentinel
  // verbatim. No orchestrator-side composition.
  if (rows.length === 0) {
    notify(opts.ctx, opts.pi, { marketplaces: [] });
    return;
  }

  // NotificationMessage construction recipe:
  // - One MarketplaceNotificationMessage per outcome, emitted via ONE
  //   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
  // - Discriminator: mp.status drawn from { "autoupdate enabled",
  //   "autoupdate disabled", "skipped" }; idempotent flips additionally carry
  //   `reasons: ["already autoupdate" | "already no autoupdate"]`.
  // - Severity (info / warning) and `/reload to pick up changes` are computed
  //   by notify(); callers MUST NOT compose.
  // - Caller order is honored end-to-end -- the SC-6 scopes-loop order is the
  //   visible iteration order. NO alphabetic sort here.
  // - Reference: catalog UAT fixtures `enable-fresh`, `disable-fresh`,
  //   `enable-idempotent`, `disable-idempotent`.
  const marketplaces: MarketplaceNotificationMessage[] = rows.map((row) => {
    if (row.alreadyMatching) {
      return {
        name: row.name,
        scope: row.scope,
        status: "skipped",
        reasons: [opts.enable ? "already autoupdate" : "already no autoupdate"],
        plugins: [],
      };
    }

    return {
      name: row.name,
      scope: row.scope,
      status: opts.enable ? "autoupdate enabled" : "autoupdate disabled",
      plugins: [],
    };
  });

  notify(opts.ctx, opts.pi, { marketplaces });
}
