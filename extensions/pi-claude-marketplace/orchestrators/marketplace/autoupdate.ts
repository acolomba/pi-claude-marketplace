// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Phase 13 Wave 2 sub-wave 2c (Plan 13-02c-01) -- CMC-33 / CMC-10 /
// CMC-05 / MSG-GR-5 migration. The legacy "Enabled autoupdate:"
// / "Disabled autoupdate:" / "Already enabled:" / "Already disabled:"
// sentence forms and the legacy empty-state marker (formerly the
// "No marketplaces" sentence) are RETIRED in favor of the
// marker-as-outcome `MarketplaceRow` form
// emitted via `renderRow`:
//   - enable success      -> `● <mp> [<scope>] <autoupdate>`
//   - enable already-on   -> `● <mp> [<scope>] <autoupdate> {already enabled}`
//   - disable success     -> `● <mp> [<scope>] <no autoupdate>`
//   - disable already-off -> `● <mp> [<scope>] <no autoupdate> {already disabled}`
//   - empty scopes        -> `(no marketplaces)` (CMC-10 EmptyToken)
// CMC-33 binding: the marker IS the outcome -- no `(<status>)` token on
// the autoupdate result row. `<no autoupdate>` appears ONLY here (per
// MSG-GR-5 / catalog §autoupdate); every other surface conveys
// autoupdate-off by ABSENCE of the marker.
//
// Single orchestrator parameterized by `enable: boolean`. The edge
// layer (Phase 6) maps `marketplace autoupdate` -> enable=true and
// `marketplace noautoupdate` -> enable=false.
//
// Flow:
//   scopes = opts.scope !== undefined ? [opts.scope] : ["user", "project"]   // SC-6
//   for each scope:
//     withStateGuard(locations, async (state) => {
//       result = applyAutoupdateFlipInPlace(state, opts.name, opts.enable)  // MAU-1, MAU-3, MAU-4
//     })  // saves state.json on no-throw
//     accumulate result.changed[] and result.unchanged[] across scopes
//
//   compose user-visible message: build a `MarketplaceRow` per accumulated
//   marketplace; join rows with `\n`; route via `notifySuccess` (flips
//   are always successes -- entity-shape failures surface at the edge
//   layer per CMC-34 / MSG-NC-1).
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import { locationsFor } from "../../persistence/locations.ts";
import { renderRow } from "../../presentation/compact-line.ts";
import { MARKETPLACE_LABEL_PROBE } from "../../shared/constants/marketplace-label-probe.ts";
import { errorMessage, MarketplaceNotFoundError } from "../../shared/errors.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { applyAutoupdateFlipInPlace } from "./shared.ts";

import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { MarketplaceRow } from "../../presentation/compact-line.ts";
import type { Scope } from "../../shared/types.ts";

export interface AutoupdateOptions {
  readonly ctx: ExtensionContext;
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

interface AutoupdateRowInput {
  readonly name: string;
  readonly scope: Scope;
  readonly alreadyMatching: boolean;
}

function missingEverywhere(
  opts: AutoupdateOptions,
  result: {
    readonly rows: readonly AutoupdateRowInput[];
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
 * CMC-33: build a `MarketplaceRow` for one autoupdate outcome. The
 * marker IS the outcome (no `(<status>)` token); `{already enabled}`
 * / `{already disabled}` reasons attach on idempotent flips per the
 * catalog at docs/output-catalog.md:700-709.
 */
function buildAutoupdateRow(input: AutoupdateRowInput, enable: boolean): MarketplaceRow {
  const marker: "autoupdate" | "no autoupdate" = enable ? "autoupdate" : "no autoupdate";
  return {
    kind: "marketplace",
    name: input.name,
    scope: input.scope,
    outcomeClass: "ok",
    marker,
    // status intentionally omitted -- CMC-33 marker-as-outcome form.
    ...(input.alreadyMatching && {
      reasons: [enable ? ("already enabled" as const) : ("already disabled" as const)],
    }),
  };
}

export async function setMarketplaceAutoupdate(opts: AutoupdateOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope === undefined ? ["user", "project"] : [opts.scope];

  const rows: AutoupdateRowInput[] = [];
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
        notifyError(opts.ctx, errorMessage(err), err);
        return;
      }

      errors.push({ scope, cause: err });
    }
  }

  // If a single-name flip was requested but the name was missing
  // from EVERY iterated scope (no row accumulated and every scope
  // errored), surface as a single error.
  if (missingEverywhere(opts, { rows, errors, scopes })) {
    const first = errors[0];
    if (first !== undefined) {
      notifyError(opts.ctx, errorMessage(first.cause), first.cause);
    }

    return;
  }

  // CMC-10: bare form across both empty scopes -- EmptyToken row.
  if (rows.length === 0) {
    notifySuccess(
      opts.ctx,
      renderRow({ kind: "empty", token: "no marketplaces" }, MARKETPLACE_LABEL_PROBE),
    );
    return;
  }

  // CMC-33: compose per-marketplace rows. Sort alphabetical by name for
  // deterministic output (Open Question 2 carry-forward); same-name
  // entries across scopes tie-break by scope via the row construction
  // order (project enumerated before user when both are iterated -- the
  // outer `scopes` loop order). The renderer's MSG-GR-3 sort comparator
  // is NOT applied here because the autoupdate result block is a
  // per-call result list, not the marketplace-list surface; alphabetical
  // by name is the established autoupdate-result ordering.
  const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const lines = sorted.map((row) =>
    renderRow(buildAutoupdateRow(row, opts.enable), MARKETPLACE_LABEL_PROBE),
  );
  notifySuccess(opts.ctx, lines.join("\n"));
}
