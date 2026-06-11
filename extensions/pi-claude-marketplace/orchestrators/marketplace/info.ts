// orchestrators/marketplace/info.ts
//
// Read-only info surface for `marketplace info <name>`. MUST NOT touch
// the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`, no
// `refreshGitHubClone`. The grep-gate test in
// `tests/orchestrators/marketplace/info.test.ts` enforces this
// structurally. IL-2: exactly one `notify()` call per invocation on the
// all-success / all-not-added paths. The partial-failure path
// intentionally emits one notify per failed scope (in addition to the
// success cascade) so a corrupt manifest in one scope cannot silently
// hide behind a healthy other-scope render.

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { notify } from "../../shared/notify.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type {
  ContentReason,
  MarketplaceInfoMessage,
  NotificationMessage,
} from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";

export interface GetMarketplaceInfoOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly name: string;
  /** When omitted, fan-out across BOTH scopes (project-first per INFO-03). */
  readonly scope?: Scope;
  /** Project-scope cwd (ignored for user scope). */
  readonly cwd: string;
}

type MarketplaceRecord = ExtensionState["marketplaces"][string];

/**
 * Project a single persisted marketplace record into a
 * `MarketplaceInfoMessage`. Throws on manifest read/parse failure --
 * the caller catches and translates via `buildManifestFailureMessage`.
 *
 * Source dispatch: `record.source` is `Type.Unknown()` at the schema
 * level but is constrained to a `ParsedSource` at the write paths.
 * Casting to that discriminated union lets the discriminator narrow
 * `kind === "github"` without re-checking `typeof` on each field. Every
 * non-github kind coerces to the `path` arm with `record.marketplaceRoot`
 * -- surfacing a bare row beats refusing to render (NFR-12).
 */
async function buildBlock(
  record: MarketplaceRecord,
  autoupdate: boolean,
): Promise<MarketplaceInfoMessage> {
  const src = record.source as ParsedSource;
  const source: MarketplaceInfoMessage["source"] =
    src.kind === "github"
      ? {
          sourceKind: "github",
          owner: src.owner,
          repo: src.repo,
          ...(src.ref !== undefined && { ref: src.ref }),
        }
      : { sourceKind: "path", absPath: record.marketplaceRoot };

  // The renderer gates `last_updated:` line emission on
  // `sourceKind === "github"` AND `lastUpdatedAt !== undefined`.
  const details: MarketplaceInfoMessage["details"] = {
    autoupdate,
    ...(record.lastUpdatedAt !== undefined && { lastUpdatedAt: record.lastUpdatedAt }),
  };

  const parsed = (await loadMarketplaceManifest(record.manifestPath)) as Record<string, unknown>;
  const description = typeof parsed.description === "string" ? parsed.description : undefined;

  return {
    kind: "marketplace-info",
    name: record.name,
    scope: record.scope,
    details,
    source,
    ...(description !== undefined && { description }),
  };
}

/**
 * The `{not added}` bare-row failure (catalog state D-03 / INFO-04 scope
 * mismatch). Built as the dedicated `MarketplaceNotAddedMessage` variant
 * (TYPE-01 / D-46-01), which carries only the marketplace `name` and an
 * optional `scope`; `renderMarketplaceNotAdded` emits the bare column-0 row
 * `⊘ <name> [scope?] (failed) {not added}` with no marketplace header (there
 * is no marketplace to head).
 */
function buildNotAddedMessage(name: string, scope: Scope | undefined): NotificationMessage {
  return {
    kind: "marketplace-not-added",
    name,
    // `scope` is set when a single `--scope` was requested (renders the
    // `[scope]` bracket); OMITTED when `--scope` was undefined and BOTH scopes
    // missed (D-03: "absent from both scopes" body has no `[scope]` bracket).
    ...(scope !== undefined && { scope }),
  };
}

/**
 * Surface a manifest read/parse failure for a known marketplace record
 * as a `(failed) {<reason>}` row. Uses the `PluginInfoMessage` shape
 * (not `MarketplaceInfoMessage`) so the renderer's status discriminator
 * carries the failure semantics; the scope bracket renders so the user
 * can tell which scope failed.
 */
function buildManifestFailureMessage(
  record: MarketplaceRecord,
  reason: ContentReason,
  autoupdate: boolean,
): NotificationMessage {
  return {
    kind: "plugin-info",
    marketplaceName: record.name,
    marketplaceScope: record.scope,
    marketplaceDetails: {
      autoupdate,
    },
    plugin: {
      status: "failed",
      name: record.name,
      scope: record.scope,
      reasons: [reason],
      componentsResolved: false,
    },
  };
}

export async function getMarketplaceInfo(opts: GetMarketplaceInfoOptions): Promise<void> {
  // Project-first per MSG-GR-3 when both scopes are searched; otherwise
  // the explicit scope only.
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];

  // Each scope's state is loaded read-only via `loadState` (NFR-5
  // preserved -- NO network).
  //
  // SPLIT-01 rewire: autoupdate lives in claude-plugins.json (config),
  // not state. Load the merged config per scope alongside state so each
  // (scope, record) tuple carries the per-scope autoupdate truth.
  const found: { scope: Scope; record: MarketplaceRecord; autoupdate: boolean }[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, opts.cwd);
    const state = await loadState(locations.extensionRoot);
    const record = state.marketplaces[opts.name];
    if (record !== undefined) {
      const { merged } = await loadMergedScopeConfig(locations);
      const autoupdate = merged.marketplaces[opts.name]?.entry.autoupdate ?? false;
      found.push({ scope, record, autoupdate });
    }
  }

  if (found.length === 0) {
    notify(opts.ctx, opts.pi, buildNotAddedMessage(opts.name, opts.scope));
    return;
  }

  // Try each candidate independently so a manifest failure on one scope
  // does not poison the fan-out -- the other scope still renders.
  const blocks: MarketplaceInfoMessage[] = [];
  const failures: NotificationMessage[] = [];
  for (const f of found) {
    try {
      blocks.push(await buildBlock(f.record, f.autoupdate));
    } catch (err) {
      failures.push(buildManifestFailureMessage(f.record, narrowProbeError(err), f.autoupdate));
    }
  }

  // Single success -> emit the bare block (matches the prior single-
  // scope shape; no cascade wrapping). Two successes -> emit the
  // fan-out cascade (project-first per the iteration order above).
  // The destructure proves the non-empty tuple shape that the cascade
  // type requires.
  const [first, ...remaining] = blocks;
  if (first !== undefined && remaining.length === 0) {
    notify(opts.ctx, opts.pi, first);
  } else if (first !== undefined) {
    notify(opts.ctx, opts.pi, { kind: "marketplace-info-cascade", blocks: [first, ...remaining] });
  }

  // Surface each failed scope as its own notify call. This intentionally
  // breaks IL-2's single-notify rule on the partial-failure path so a
  // corrupt manifest in one scope cannot silently hide behind a healthy
  // other-scope render. Callers wanting strict IL-2 must pass `--scope`.
  for (const failure of failures) {
    notify(opts.ctx, opts.pi, failure);
  }
}
