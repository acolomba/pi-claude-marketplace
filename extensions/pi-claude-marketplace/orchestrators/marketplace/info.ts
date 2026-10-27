// orchestrators/marketplace/info.ts
//
// Read-only info surface for `marketplace info <name>`. MUST NOT touch
// the network (NFR-5) -- no `platform/git`, no `DEFAULT_GIT_OPS`, no
// `refreshGitHubClone`. The grep-gate test in
// `test/orchestrators/marketplace/info.test.ts` enforces this
// structurally. IL-2: exactly one `notify()` call per invocation on the
// all-success / all-not-added paths. The partial-failure path intentionally
// emits one notify per scope in project-first order, so a corrupt manifest
// in one scope cannot silently hide behind a healthy other-scope render.

import path from "node:path";

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { notify } from "../../shared/notification-dispatch.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  type MarketplaceInfoMessage,
  type NotificationMessage,
} from "../../shared/notification-types.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { collectMarketplaceRecordsByScope } from "../scope-fanout.ts";

import { crossScopeFlag, recordedManifestPath } from "./shared.ts";

import type { ParsedSource } from "../../domain/source.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { Scope } from "../../shared/types.ts";

/** Inputs to `getMarketplaceInfo`: the notification context and the marketplace to describe. */
export interface GetMarketplaceInfoOptions {
  readonly ctx: ExtensionContext;
  /** D-05: the command's notification run; every block renders from its snapshot. */
  readonly run: NotificationRun;
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
 * `kind === "github"` / `kind === "url"` without re-checking `typeof` on
 * each field. `github`, `url` (D-76-09), and recorded path sources get
 * dedicated projections, and a hosted source shows as `url` with its catalog
 * URL (D-PL5-05). Every OTHER kind coerces to the `path` arm with
 * `record.marketplaceRoot` -- surfacing a bare row beats refusing to render
 * (NFR-12).
 *
 * D-01: a path source shows a path the record holds. When the typed source's
 * basename equals the recorded manifest's basename, the user named the
 * manifest file, so the row shows the recorded manifest; otherwise it shows
 * the recorded root of the directory source. The typed source is provenance
 * and is read only for that basename, so the row and `marketplace update` name
 * the same file.
 */
async function buildBlock(
  record: MarketplaceRecord,
  autoupdate: boolean,
): Promise<MarketplaceInfoMessage> {
  const src = record.source as ParsedSource;
  const manifestPath = recordedManifestPath(record);
  let source: MarketplaceInfoMessage["source"];
  if (src.kind === "github") {
    source = {
      sourceKind: "github",
      owner: src.owner,
      repo: src.repo,
      ...(src.ref !== undefined && { ref: src.ref }),
    };
  } else if (src.kind === "url") {
    // D-76-09: url sources project a `url:` line. This MUST branch before
    // the `path` fallback, else a url source would render as
    // `path: <clone dir>` (record.marketplaceRoot), which is wrong.
    source = {
      sourceKind: "url",
      url: src.url,
      ...(src.ref !== undefined && { ref: src.ref }),
    };
  } else if (src.kind === "hosted") {
    // D-PL5-05: a hosted catalog shows its URL and last update time as a url
    // source does, so the info message and its schema keep three kinds.
    source = { sourceKind: "url", url: src.url };
  } else if (src.kind === "path") {
    source = {
      sourceKind: "path",
      absPath:
        path.basename(src.logical) === path.basename(manifestPath)
          ? manifestPath
          : record.marketplaceRoot,
    };
  } else {
    source = { sourceKind: "path", absPath: record.marketplaceRoot };
  }

  // D-76-10: the renderer gates `last_updated:` line emission on
  // `sourceKind !== "path"` (all git-backed kinds) AND
  // `lastUpdatedAt !== undefined`.
  const details: MarketplaceInfoMessage["details"] = {
    autoupdate,
    ...(record.lastUpdatedAt !== undefined && { lastUpdatedAt: record.lastUpdatedAt }),
  };

  const parsed = await loadMarketplaceManifest(manifestPath);
  const rawDescription = (parsed as Record<string, unknown>).description;
  const description = typeof rawDescription === "string" ? rawDescription : undefined;

  return {
    kind: "marketplace-info",
    name: record.name,
    scope: record.scope,
    details,
    source,
    ...(description !== undefined && { description }),
    ...(parsed.allowCrossMarketplaceDependenciesOn !== undefined && {
      allowedMarketplaces: parsed.allowCrossMarketplaceDependenciesOn,
    }),
  };
}

/**
 * The `{marketplace not added}` bare-row failure (catalog state D-03 / INFO-04 scope
 * mismatch). Built as the dedicated `MarketplaceNotAddedMessage` variant
 * (TYPE-01 / D-46-01), which carries only the marketplace `name` and an
 * optional `scope`; `renderMarketplaceNotAdded` emits the bare column-0 row
 * `⊘ <name> [scope?] (failed) {marketplace not added}` with no marketplace header (there
 * is no marketplace to head).
 */
async function buildNotAddedMessage(
  cwd: string,
  name: string,
  scope: Scope | undefined,
): Promise<NotificationMessage> {
  return {
    kind: "marketplace-not-added",
    name,
    // `scope` is set when a single `--scope` was requested (renders the
    // `[scope]` bracket); OMITTED when `--scope` was undefined and BOTH scopes
    // missed (D-03: "absent from both scopes" body has no `[scope]` bracket).
    ...(scope !== undefined && { scope }),
    ...(await crossScopeFlag({ cwd, marketplace: name, scope })),
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
      marketplaceSubject: true,
    },
  };
}

export async function getMarketplaceInfo(opts: GetMarketplaceInfoOptions): Promise<void> {
  // Project-first per MSG-GR-3 when both scopes are searched; otherwise the
  // explicit scope only. The scope fan-out (read-only state + per-scope config truth) is shared with
  // the plugin `info` surface -- see `orchestrators/scope-fanout.ts`. This
  // surface has no plugin in hand, so it passes no `pluginKey` and never reads
  // the `declaredEnabled` the shared row carries.
  const found = await collectMarketplaceRecordsByScope({
    cwd: opts.cwd,
    scope: opts.scope,
    marketplace: opts.name,
  });

  if (found.length === 0) {
    notify(opts.ctx, opts.run, await buildNotAddedMessage(opts.cwd, opts.name, opts.scope));
    return;
  }

  // Try each candidate independently so a manifest failure on one scope
  // does not poison the fan-out -- the other scope still renders.
  const outcomes: NotificationMessage[] = [];
  for (const f of found) {
    try {
      // eslint-disable-next-line no-await-in-loop -- at most two scopes, one manifest block each
      outcomes.push(await buildBlock(f.record, f.autoupdate));
    } catch (err) {
      outcomes.push(buildManifestFailureMessage(f.record, narrowProbeError(err), f.autoupdate));
    }
  }

  // A partial or complete failure emits one result per candidate in the same
  // project-first order as collection. Keeping success and failure in one
  // outcome list prevents either kind from jumping ahead of the other.
  if (
    !outcomes.every(
      (outcome): outcome is MarketplaceInfoMessage => outcome.kind === "marketplace-info",
    )
  ) {
    for (const outcome of outcomes) {
      notify(opts.ctx, opts.run, outcome);
    }

    return;
  }

  // Single success -> emit the bare block (matches the prior single-
  // scope shape; no cascade wrapping). Two successes -> emit the
  // fan-out cascade (project-first per the iteration order above).
  // The destructure proves the non-empty tuple shape that the cascade
  // type requires.
  const [first, ...remaining] = outcomes;
  if (first !== undefined && remaining.length === 0) {
    notify(opts.ctx, opts.run, first);
  } else if (first !== undefined) {
    notify(opts.ctx, opts.run, { kind: "marketplace-info-cascade", blocks: [first, ...remaining] });
  }
}
