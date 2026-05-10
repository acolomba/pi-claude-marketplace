// orchestrators/marketplace/autoupdate.ts
//
// MAU-1, MAU-2, MAU-3, MAU-4 + SC-6 + NFR-5.
//
// Single orchestrator parameterized by `enable: boolean`. The edge
// layer (Phase 6) maps `marketplace autoupdate` -> enable=true and
// `marketplace noautoupdate` -> enable=false.
//
// Flow:
//   scopes = opts.scope !== undefined ? [opts.scope] : ["user", "project"]   // SC-6
//   for each scope:
//     withStateGuard(locations, async (state) => {
//       result = applyAutoupdateFlip(state, opts.name, opts.enable)        // MAU-1, MAU-3, MAU-4
//     })  // saves state.json on no-throw
//     accumulate result.changed[] and result.unchanged[] across scopes
//
//   compose user-visible message:
//     - changed   non-empty: "Enabled autoupdate: <names>." or "Disabled autoupdate: <names>."
//     - unchanged non-empty: "Already enabled: <names>." or "Already disabled: <names>."   // MAU-3
//     - both empty (single-name not found in any scope): MarketplaceNotFoundError surfaces from applyAutoupdateFlip
//
// NFR-5: zero git surface -- autoupdate never imports platform/git
// or DEFAULT_GIT_OPS.

import { locationsFor } from "../../persistence/locations.ts";
import { errorMessage } from "../../shared/errors.ts";
import { notifyError, notifySuccess } from "../../shared/notify.ts";
import { withStateGuard } from "../../transaction/with-state-guard.ts";

import { applyAutoupdateFlip } from "./shared.ts";

import type { Scope } from "../../shared/types.ts";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

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

export async function setMarketplaceAutoupdate(opts: AutoupdateOptions): Promise<void> {
  const scopes: readonly Scope[] = opts.scope !== undefined ? [opts.scope] : ["user", "project"];

  const overallChanged: string[] = [];
  const overallUnchanged: string[] = [];
  const errors: { scope: Scope; cause: unknown }[] = [];

  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    try {
      const result = await withStateGuard(locations, (state) => {
        // applyAutoupdateFlip mutates state in place and returns frozen
        // changed/unchanged arrays. The guard saves on no-throw.
        return applyAutoupdateFlip(state, opts.name, opts.enable);
      });
      overallChanged.push(...result.changed);
      overallUnchanged.push(...result.unchanged);
    } catch (err) {
      // For single-name flips: applyAutoupdateFlip throws
      // MarketplaceNotFoundError when the name is absent from THIS
      // scope. With SC-6 bare-form, that is expected if the name only
      // lives in the OTHER scope; we collect and only surface if BOTH
      // scopes failed AND no flips happened anywhere.
      errors.push({ scope, cause: err });
    }
  }

  // If a single-name flip was requested but the name was missing
  // from EVERY iterated scope (no changed/unchanged accumulated and
  // every scope errored), surface as a single error.
  if (
    opts.name !== undefined &&
    overallChanged.length === 0 &&
    overallUnchanged.length === 0 &&
    errors.length === scopes.length
  ) {
    const first = errors[0];
    if (first !== undefined) {
      notifyError(opts.ctx, errorMessage(first.cause), first.cause);
    }

    return;
  }

  // Compose success message. MAU-3 idempotent reporting.
  const verbDone = opts.enable ? "Enabled" : "Disabled";
  const verbAlready = opts.enable ? "enabled" : "disabled";

  const lines: string[] = [];
  if (overallChanged.length > 0) {
    // Sort for deterministic output (Open Question 2: alphabetical).
    const sorted = [...overallChanged].sort((a, b) => a.localeCompare(b));
    lines.push(`${verbDone} autoupdate: ${sorted.join(", ")}.`);
  }

  if (overallUnchanged.length > 0) {
    const sorted = [...overallUnchanged].sort((a, b) => a.localeCompare(b));
    lines.push(`Already ${verbAlready}: ${sorted.join(", ")}.`);
  }

  // Bare form across both empty scopes: parallel to MU-1 silent
  // succeed semantics.
  if (lines.length === 0) {
    notifySuccess(opts.ctx, "No marketplaces configured.");
    return;
  }

  notifySuccess(opts.ctx, lines.join("\n"));
}
