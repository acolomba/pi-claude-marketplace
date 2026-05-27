// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Phase 18 / Plan 18-02: V1 -> V2 migration. The 4 V1 severity-named
// wrapper callsites (2 error + 2 success) collapse to a single
// notify(opts.ctx, opts.pi, { marketplaces: [...] }) call per
// orchestration. Payloads are constructed against the Phase 17.1
// amended grammar (7-entry MarketplaceStatus + optional `reasons?:`):
//
//   - enable fresh         -> status: "autoupdate enabled"
//                             -> `● <mp> [<scope>] (autoupdate enabled)`
//                                + `/reload to pick up changes` trailer (D-16-12)
//   - disable fresh        -> status: "autoupdate disabled"
//                             -> `● <mp> [<scope>] (autoupdate disabled)`
//                                + `/reload to pick up changes` trailer (D-16-12)
//   - enable idempotent    -> status: "skipped", reasons: ["already enabled"]
//                             -> `● <mp> [<scope>] (skipped) {already enabled}`
//                                severity: "warning" (D-16-11)
//   - disable idempotent   -> status: "skipped", reasons: ["already disabled"]
//                             -> `● <mp> [<scope>] (skipped) {already disabled}`
//                                severity: "warning" (D-16-11)
//   - failure (not-found)  -> status: "failed"
//                             -> `⊘ <mp> [<scope>] (failed)`
//                                severity: "error" (D-16-11)
//   - empty scopes         -> marketplaces: []
//                             -> `(no marketplaces)` (D-16-17 sentinel)
//
// CMC-33 / MSG-GR-5 retirement: the V1 marker-as-outcome row form
// (`● <mp> [<scope>] <autoupdate>`, `<no autoupdate>`) is no longer
// emitted by this orchestrator. The `<autoupdate>` marker now lives
// ONLY on the marketplace-list surface header (per D-17.1-01); on
// state-flip results, the outcome is conveyed by the `(autoupdate
// enabled)` / `(autoupdate disabled)` status token instead.
//
// Single orchestrator parameterized by `enable: boolean`. The edge
// layer (Phase 6) maps `marketplace autoupdate` -> enable=true and
// `marketplace noautoupdate` -> enable=false.
//
// Flow:
//   scopes = opts.scope !== undefined ? [opts.scope] : ["project", "user"]   // SC-6
//   for each scope:
//     withStateGuard(locations, async (state) => {
//       result = applyAutoupdateFlipInPlace(state, opts.name, opts.enable)  // MAU-1, MAU-3, MAU-4
//     })  // saves state.json on no-throw
//     accumulate result.changed[] and result.unchanged[] across scopes
//
//   compose one MarketplaceNotificationMessage per outcome (D-18-05
//   mapping above); emit ONE notify(opts.ctx, opts.pi, ...) call. The
//   caller-supplied order is honored end-to-end per D-16-06; the SC-6
//   scopes-loop order (project-then-user) is the visible iteration
//   order. The alphabetic sort that the V1 path applied (lines 178-180
//   pre-migration) is dropped -- the renderer no longer sorts and
//   D-16-06 forbids re-sorting at the orchestrator.
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import { locationsFor } from "../../persistence/locations.ts";
import { MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notify } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { applyAutoupdateFlipInPlace } from "./shared.ts";

import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { MarketplaceNotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
  /**
   * Factory `pi` reference. Plumbed in Plan 18-00 (Wave 0); consumed in
   * Plan 18-02 by the V2 `notify(ctx, pi, message)` calls below to drive
   * the single per-invocation soft-dep probe (D-16-14) -- even though
   * mp-level rows never inject soft-dep markers (D-16-15), the probe is
   * threaded through every notify() entry for invariant symmetry.
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
        // NotificationMessage construction recipe -- see add.ts:160-169
        // for the Wave 1 pilot recipe; this file uses statuses
        // [autoupdate enabled, autoupdate disabled, skipped, failed] per
        // D-18-05. Failure path: status: "failed" + empty plugins[];
        // severity is computed by notify() to "error" (D-16-11). The
        // underlying `err` is intentionally not surfaced as a cause chain
        // -- V2 confines `cause?: Error` to plugin-level variants per
        // D-16-08; the catalog `failure-not-found` fixture asserts the
        // rendered byte form only (mp name + scope + `(failed)`).
        const failureName = opts.name ?? "(unknown)";
        notify(opts.ctx, opts.pi, {
          marketplaces: [
            {
              name: failureName,
              scope,
              status: "failed",
              plugins: [],
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
      // Construction recipe -- failure path; see comments above the
      // per-scope failure notify() and the recipe block at the end of
      // this function for the full Wave 2 mirror template.
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

  // D-16-17: empty marketplaces[] -> notify() emits the `(no marketplaces)`
  // sentinel verbatim. No orchestrator-side composition.
  if (rows.length === 0) {
    notify(opts.ctx, opts.pi, { marketplaces: [] });
    return;
  }

  // NotificationMessage construction recipe (mirror of add.ts:160-169
  // pilot; Plan 18-02 substitutes the mp.status discriminator for the 4
  // Phase-17.1 autoupdate states).
  // - One MarketplaceNotificationMessage per outcome, emitted via ONE
  //   notify(opts.ctx, opts.pi, ...) call; `plugins: []` is required.
  // - Discriminator here: mp.status drawn from
  //   { "autoupdate enabled", "autoupdate disabled", "skipped" } per
  //   D-18-05; idempotent flips additionally carry
  //   `reasons: ["already enabled" | "already disabled"]`.
  // - Severity (info / warning) and `/reload to pick up changes` are
  //   computed by notify() per D-16-11 + D-16-12; callers MUST NOT compose.
  // - D-16-06: caller-order honored end-to-end -- the SC-6 scopes-loop
  //   order is the visible iteration order. NO alphabetic sort here.
  // - Reference: catalog UAT fixtures `enable-fresh`, `disable-fresh`,
  //   `enable-idempotent`, `disable-idempotent` at
  //   tests/architecture/catalog-uat.test.ts:1239-1283.
  const marketplaces: MarketplaceNotificationMessage[] = rows.map((row) => {
    if (row.alreadyMatching) {
      return {
        name: row.name,
        scope: row.scope,
        status: "skipped",
        reasons: [opts.enable ? "already enabled" : "already disabled"],
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
