// orchestrators/marketplace/info.ts
//
// Phase 43 / INFO-01 + INFO-03 + INFO-04 + NFR-5 + IL-2.
//
// READ-ONLY: NO withStateGuard (the info surface never mutates state --
// it is a structurally read-only seam over the persisted records). NO
// `platform/git` / `DEFAULT_GIT_OPS` / `refreshGitHubClone` import
// (NFR-5: `info` MUST NOT touch the network -- a grep-gate test at
// `tests/orchestrators/marketplace/info.test.ts` enforces this
// structurally).
//
// IL-2 single-site discipline: exactly ONE `notify(opts.ctx, opts.pi,
// ...)` call per `getMarketplaceInfo` invocation. The fan-out (when no
// `--scope` is given and the marketplace name exists in both scopes) is
// composed by the new `MarketplaceInfoCascadeMessage` variant whose
// renderer joins per-block bodies with `\n\n`; the dispatcher still
// emits a single `ctx.ui.notify` call.
//
// Flow:
//   1. Determine the candidate scope set: project-first per
//      MSG-GR-3 / INFO-03 when `--scope` is omitted; otherwise the
//      explicit scope only.
//   2. For each candidate scope, `loadState(locationsFor(scope, cwd).extensionRoot)`
//      and pick up `state.marketplaces[name]` if present.
//   3. Branch on the collected records:
//      (a) Zero records found -> emit the Phase 42 INFO-04 `{not added}`
//          `PluginInfoMessage`. When a single `--scope` was requested,
//          set `plugin.scope` to that scope (renders `[scope]` bracket).
//          When `--scope` was omitted and BOTH scopes missed, OMIT
//          `plugin.scope` so the renderer's bracket short-circuit emits
//          no `[scope]` token (per D-03 acceptance test: the
//          "absent from both scopes" body has no `[scope]` bracket).
//      (b) One record found -> emit a single `MarketplaceInfoMessage`
//          via the shared `buildBlock` helper.
//      (c) Two records found (both scopes) -> emit a
//          `MarketplaceInfoCascadeMessage` with `blocks: [projectBlock,
//          userBlock]` in project-first order (the helper preserves the
//          iteration order of step 1).

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";

import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { MarketplaceInfoMessage, NotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface GetMarketplaceInfoOptions {
  readonly ctx: ExtensionContext;
  /**
   * Required by `notify(ctx, pi, message)` for the soft-dep probe (info
   * surfaces do not emit soft-dep markers, but the probe argument is
   * threaded for signature parity with the cascade arm).
   */
  readonly pi: ExtensionAPI;
  readonly name: string;
  /** When omitted, fan-out across BOTH scopes (project-first per INFO-03). */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * Phase 43 / INFO-01: project a single persisted marketplace record into
 * a `MarketplaceInfoMessage` payload. Source dispatch covers the two
 * Phase 42 type-supported source kinds (`github` + `path`); other source
 * kinds (`url`, `git-subdir`, `npm`, `unknown`) coerce to the `path` arm
 * with `record.marketplaceRoot` as the absolute path. The path-fallback
 * preserves discoverability for path-sourced custom marketplaces parsed
 * under unusual kinds; surfacing a bare row beats refusing to render
 * (NFR-12 forward-compat). The `description` is best-effort: a manifest
 * read failure swallows to `undefined` rather than failing the info call.
 *
 * NOT exported (file-private factory; sole caller is the orchestrator
 * below).
 */
async function buildBlock(record: MarketplaceRecord): Promise<MarketplaceInfoMessage> {
  // Source dispatch -- Phase 42 type supports only `github | path`.
  // Non-github sources coerce to the `path` arm with the canonicalized
  // `record.marketplaceRoot` as the absolute path so the renderer never
  // receives an invalid discriminator. NFR-12: forward-compat for future
  // source kinds (Phase 44 may revisit if a future kind needs distinct
  // info-surface treatment).
  const src = record.source as { kind?: unknown; owner?: unknown; repo?: unknown; ref?: unknown };
  const source: MarketplaceInfoMessage["source"] =
    src.kind === "github" && typeof src.owner === "string" && typeof src.repo === "string"
      ? {
          sourceKind: "github",
          owner: src.owner,
          repo: src.repo,
          ...(typeof src.ref === "string" && { ref: src.ref }),
        }
      : { sourceKind: "path", absPath: record.marketplaceRoot };

  // Phase 42 / WR-04 / INFO-01: `lastUpdatedAt` lives on
  // `MarketplaceDetails`; the renderer gates emission of the
  // `last_updated:` line on `source.sourceKind === "github"` AND
  // `details.lastUpdatedAt !== undefined`.
  const details: MarketplaceInfoMessage["details"] = {
    autoupdate: record.autoupdate ?? false,
    ...(record.lastUpdatedAt !== undefined && { lastUpdatedAt: record.lastUpdatedAt }),
  };

  // INFO-01 description: best-effort read of marketplace.json. The
  // MARKETPLACE_SCHEMA does not validate `description`, but TypeBox 1.x
  // `Type.Object` accepts additional properties by default and
  // `JSON.parse` returns them. A read failure (missing file, invalid
  // JSON, schema mismatch) swallows to undefined -- info surface MUST
  // NOT fail catastrophically on a manifest read error; the user is
  // querying metadata, surfacing the source line without a description
  // beats refusing the call.
  let description: string | undefined;
  try {
    const parsed = (await loadMarketplaceManifest(record.manifestPath)) as Record<string, unknown>;
    if (typeof parsed.description === "string") {
      description = parsed.description;
    }
  } catch {
    description = undefined;
  }

  return {
    kind: "marketplace-info",
    name: record.name,
    scope: record.scope,
    details,
    source,
    ...(description !== undefined && { description }),
  };
}

export async function getMarketplaceInfo(opts: GetMarketplaceInfoOptions): Promise<void> {
  // INFO-03 iteration order: project-first per MSG-GR-3 when both scopes
  // are searched; otherwise the explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Collect (scope, record) tuples so the fan-out renderer preserves the
  // outer-loop iteration order. Each scope's state is loaded read-only
  // via `loadState` (NFR-5 preserved -- NO network).
  const found: { scope: Scope; record: MarketplaceRecord }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces[opts.name];
    if (record !== undefined) {
      found.push({ scope, record });
    }
  }

  // Branch on the collected records (a) / (b) / (c) per the file header.
  if (found.length === 0) {
    // Phase 42 INFO-04 `{not added}` carve-out. The renderer's predicate
    // at `shared/notify.ts:1902-1915` checks ONLY
    // `plugin.status === "failed" && reasons.length === 1 &&
    // reasons[0] === "not added"` and emits the bare plugin row;
    // `marketplaceName`, `marketplaceScope`, and `marketplaceDetails`
    // are unused on this path (placeholders only -- DO NOT "fix" them).
    //
    // `plugin.scope` is set when a single `--scope` was requested (the
    // bracket renders `[user]` / `[project]`); OMITTED when `--scope`
    // was undefined and BOTH scopes missed (the renderer's
    // `plugin.scope !== undefined ? ${[scope]} : ""` branch suppresses
    // the bracket -- D-03 acceptance: "absent from both scopes" has
    // no [scope] bracket because the marketplace is in neither scope).
    const message: NotificationMessage = {
      kind: "plugin-info",
      marketplaceName: opts.name,
      // Unused placeholder per the INFO-04 carve-out -- arbitrary value;
      // never rendered for the `{not added}` bare-row state.
      marketplaceScope: opts.scope ?? "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "failed",
        name: opts.name,
        ...(opts.scope !== undefined && { scope: opts.scope }),
        reasons: ["not added"],
        componentsResolved: false,
      },
    };
    notify(opts.ctx, opts.pi, message);
    return;
  }

  if (found.length === 1) {
    const sole = found[0];
    // Defensive: `found.length === 1` guarantees `found[0]` is defined;
    // explicit guard keeps the typecheck happy without a non-null
    // assertion (lint rule @typescript-eslint/no-non-null-assertion).
    if (sole !== undefined) {
      const block = await buildBlock(sole.record);
      notify(opts.ctx, opts.pi, block);
      return;
    }
  }

  // Two records (BOTH scopes hold the marketplace name): emit the
  // INFO-03 fan-out variant. `blocks` order follows the iteration order
  // of the outer scopes loop above -- project-first per MSG-GR-3.
  const blocks = await Promise.all(found.map((f) => buildBlock(f.record)));
  const message: NotificationMessage = {
    kind: "marketplace-info-cascade",
    blocks,
  };
  notify(opts.ctx, opts.pi, message);
}
