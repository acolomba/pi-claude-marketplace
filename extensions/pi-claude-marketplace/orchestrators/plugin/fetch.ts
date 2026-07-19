// orchestrators/plugin/fetch.ts
//
// The fetch orchestrator (FTCH-01/02/04/06/07). A fetch materializes a
// plugin's clone/mirror into the shared cache WITHOUT installing, then renders
// the post-fetch DERIVED status row (available / partially-available /
// unavailable) -- exactly what `list` / `info` show. It reuses the shipped
// seams for every hard problem:
//
//   - git materialize: the `clone-cache.ts` entrypoints (via the injected
//     FetchCloneCacheSeam), reached ONLY by name -- fetch.ts names zero git
//     surface (no git-ops handle, no default-git-ops constant, no clone-refresh
//     helper, no platform-git import), a gate enforced by
//     tests/architecture/no-orchestrator-network.test.ts's forbidden-targets
//     set.
//   - auth: `auth-host.ts` re-exports (`buildAuthForHost` / `hostFromCloneUrl`)
//     with a single sweep-wide `authMemo` so a bulk sweep triggers each host's
//     device flow at most once (FTCH-06).
//   - classification: the fs-only `git-source-probe.ts` (`makePresenceProbe`
//     for the no-op gate, `probeManifestEntry` for the post-fetch row).
//   - cascade: `notify-context.ts::notifyWithContext` with FETCH_CONTEXT.
//
// The enumeration is MANIFEST-driven (D-81 fetchable-set): the fetchable set
// comes from `loadMarketplaceManifest`, NOT installed state. A per-plugin
// failure never aborts the sweep (it is captured as a `(failed)` row), and an
// unreadable marketplace manifest degrades to a per-marketplace `(failed)`
// block. fetch persists NO state (derive-not-persist): the only fs write is
// the clone seam's, which lives in clone-cache.ts.

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import { compareByNameThenScope } from "../../shared/notify.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "./clone-cache.ts";
import { FETCH_CONTEXT, type FetchMsg } from "./fetch.messaging.ts";
import { makePresenceProbe, probeManifestEntry } from "./git-source-probe.ts";

import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { ContentReason } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

type ManifestEntry = MarketplaceManifest["plugins"][number];

// ─────────────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D-81-01: the three fetch shapes. The edge layer parses argv and constructs
 * this discriminated union:
 *   - `{ kind: "plugin", plugin, marketplace }` -- `fetch <plugin>@<mp>` (single)
 *   - `{ kind: "marketplace", marketplace }` -- `fetch @<mp>` (bulk)
 *   - `{ kind: "all" }` -- bare `fetch` (bulk)
 */
export type FetchTarget =
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "all" };

/**
 * Test-only clone-cache seam override (mirrors install's InstallCloneCacheSeam).
 * Production leaves this undefined and fetch uses the real `resolvePluginPin` /
 * `materializePluginClone` / `materializeOrRefreshPluginMirror` imports (which
 * default to the real git backend). Tests substitute mock-backed entrypoints so
 * the fetch path runs without touching the network. The seam is the ONLY git
 * surface fetch reaches, and it reaches it by name -- fetch.ts declares no
 * git-ops handle of its own.
 */
export interface FetchCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

export interface FetchPluginsOptions {
  readonly ctx: ExtensionContext;
  /** Factory `pi` reference -- notify owns the single soft-dep probe. */
  readonly pi: ExtensionAPI;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: FetchTarget;
  /** Test-only clone-cache seam override; production uses the real imports. */
  readonly cloneCacheSeam?: FetchCloneCacheSeam;
  /** Defaults to DEFAULT_CREDENTIAL_OPS at use (auth at install parity, D-81-05). */
  readonly credentialOps?: CredentialOps;
  /** Device Flow HTTP seam; tests inject makeMockDeviceFlowHttp(). */
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/**
 * FTCH-01/02/04/06/07 entrypoint. Enumerates the fetchable set from the
 * marketplace MANIFEST (not installed state), materializes each cold/unpinned
 * git source into the shared cache through the clone-cache seam (no-ops for
 * path + pinned-warm sources), derives the fresh post-fetch status row, and
 * renders one cascade block per (scope, marketplace). A single authMemo spans
 * the whole sweep (once-per-host). A per-plugin failure is captured as a
 * `(failed)` row, and a manifest-load failure as a per-marketplace `(failed)`
 * block -- neither aborts the sweep.
 */
export async function fetchPlugins(opts: FetchPluginsOptions): Promise<void> {
  const { ctx, pi } = opts;

  const { targets, manifestFailures } = await enumerateFetchTargets(opts);

  // FTCH-06 / D-81-05: ONE authMemo Map spans the whole sweep so a bulk sweep of
  // N private-host plugins triggers each host's device flow at most once. A
  // per-plugin memo would re-trigger the flow N times.
  const authMemo = new Map<string, AuthAttemptResult>();
  const seam = opts.cloneCacheSeam ?? {
    resolvePluginPin,
    materializePluginClone,
    materializeOrRefreshPluginMirror,
  };
  const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS;

  // Group rows by (scope, marketplace) so the cascade renders one block per pair
  // (project-first via compareByNameThenScope at the emit seam).
  const byMp = new Map<string, { name: string; scope: Scope; plugins: FetchMsg[] }>();
  const pushRow = (scope: Scope, marketplace: string, row: FetchMsg): void => {
    const key = `${scope}:${marketplace}`;
    const existing = byMp.get(key);
    if (existing === undefined) {
      byMp.set(key, { name: marketplace, scope, plugins: [row] });
    } else {
      existing.plugins.push(row);
    }
  };

  for (const target of targets) {
    // NEVER-throws per-plugin (mirrors updateSinglePlugin): a thrown fetch is
    // captured as a `(failed)` row and the sweep continues to the remaining
    // plugins.
    const row = await fetchOne(target, {
      ctx,
      seam,
      credentialOps,
      authMemo,
      ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    });
    pushRow(target.scope, target.marketplace, row);
  }

  // OUT-04 / D-04: the cardinality is the invocation FORM -- a `<plugin>@<mp>`
  // target is single (no tally); `@<mp>` and bare forms are plural (tally).
  const cardinality: "single" | "plural" = opts.target.kind === "plugin" ? "single" : "plural";

  const blocks: MarketplaceRows<FetchMsg>[] = [...byMp.values()].map((g) => ({
    name: g.name,
    scope: g.scope,
    plugins: g.plugins,
  }));
  // A marketplace whose manifest failed to load renders an mp-level `(failed)`
  // block (list's unparseable-mp form) carrying the narrowed closed-set reason
  // on the marketplace subject (D-48-A) at error severity, no plugin child rows.
  for (const failure of manifestFailures) {
    blocks.push({
      name: failure.marketplace,
      scope: failure.scope,
      status: "failed",
      severity: "error",
      reasons: [failure.reason],
      plugins: [],
    });
  }

  blocks.sort((a, b) =>
    compareByNameThenScope({ name: a.name, scope: a.scope }, { name: b.name, scope: b.scope }),
  );
  const marketplaces: Plural<MarketplaceRows<FetchMsg>> = blocks;

  notifyWithContext(ctx, pi, FETCH_CONTEXT, marketplaces, "cascade", cardinality);
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest-driven enumeration (fetchable set)
// ─────────────────────────────────────────────────────────────────────────────

interface FetchTargetEntry {
  readonly entry: ManifestEntry;
  readonly marketplace: string;
  readonly marketplaceRoot: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
}

/** A marketplace whose manifest failed to load during enumeration. */
interface ManifestFailure {
  readonly marketplace: string;
  readonly scope: Scope;
  readonly reason: ContentReason;
}

interface FetchEnumeration {
  readonly targets: readonly FetchTargetEntry[];
  readonly manifestFailures: readonly ManifestFailure[];
}

/**
 * Enumerate the fetchable set from the marketplace MANIFEST (D-81 fetchable-set,
 * NOT install-state enumerateTargets). For the plugin shape resolve the single
 * manifest entry; for marketplace/all shapes read every manifest entry. A
 * plugin/marketplace not present in state (or absent from the manifest) simply
 * contributes no target -- fetch renders whatever the manifest lists. All reads
 * are `loadState` + `loadMarketplaceManifest` only (NFR-5: no network at
 * enumeration).
 *
 * The manifest load is soft per-marketplace (list's
 * `loadMarketplaceManifestSoftly` parity): ONE corrupt/missing marketplace.json
 * folds into `manifestFailures` with its `narrowProbeError` reason instead of
 * aborting the whole sweep, so healthy marketplaces still fetch.
 */
async function enumerateFetchTargets(opts: FetchPluginsOptions): Promise<FetchEnumeration> {
  const { cwd, target } = opts;
  const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
  const wantMarketplace = target.kind === "all" ? undefined : target.marketplace;
  const wantPlugin = target.kind === "plugin" ? target.plugin : undefined;

  const targets: FetchTargetEntry[] = [];
  const manifestFailures: ManifestFailure[] = [];
  for (const scope of scopes) {
    const locations = locationsFor(scope, cwd);
    const state = await loadState(locations.extensionRoot);

    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      if (wantMarketplace !== undefined && mpName !== wantMarketplace) {
        continue;
      }

      try {
        targets.push(
          ...(await enumerateMarketplaceEntries(mpName, mp, scope, locations, wantPlugin)),
        );
      } catch (err) {
        manifestFailures.push({ marketplace: mpName, scope, reason: narrowProbeError(err) });
      }
    }
  }

  return { targets, manifestFailures };
}

/**
 * Read a single marketplace's manifest and project its plugin entries into
 * fetch targets, filtered to `wantPlugin` when the single (`<plugin>@<mp>`) form
 * requested one. Extracted from `enumerateFetchTargets` to keep the scope/
 * marketplace iteration inside the cognitive-complexity ceiling.
 */
async function enumerateMarketplaceEntries(
  mpName: string,
  mp: { manifestPath: string; marketplaceRoot: string },
  scope: Scope,
  locations: ScopedLocations,
  wantPlugin: string | undefined,
): Promise<FetchTargetEntry[]> {
  const manifest = await loadMarketplaceManifest(mp.manifestPath);
  const out: FetchTargetEntry[] = [];
  for (const entry of manifest.plugins) {
    if (wantPlugin === undefined || entry.name === wantPlugin) {
      out.push({
        entry,
        marketplace: mpName,
        marketplaceRoot: mp.marketplaceRoot,
        scope,
        locations,
      });
    }
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// fetch-one core (no-op gate -> materialize -> fresh row)
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOneDeps {
  readonly ctx: ExtensionContext;
  readonly seam: FetchCloneCacheSeam;
  readonly credentialOps: CredentialOps;
  readonly authMemo: Map<string, AuthAttemptResult>;
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/**
 * Fetch a single manifest entry. NEVER throws: a thrown materialize is captured
 * as a `(failed)` row via the closed-set REASONS narrowing so the bulk sweep is
 * failure-tolerant.
 *
 * Flow:
 *   (1) Non-git source (path / npm / unknown): a no-op -- render
 *       `(skipped) {up-to-date}` at info severity, no git seam call.
 *   (2) Git source: run the fs-only presence probe FIRST. A PINNED source whose
 *       clone is already `materialized` is a no-op -> `(skipped) {up-to-date}`,
 *       no network. Otherwise (remote-cold OR any unpinned) run the materialize:
 *       pinned arm -> resolvePluginPin + materializePluginClone; unpinned arm ->
 *       canonicalCloneUrl + materializeOrRefreshPluginMirror (always refreshes;
 *       the refresh IS the consented fetch).
 *   (3) After the seam returns, derive the row FRESH from `probeManifestEntry`
 *       against the now-warm tree (never a pre-materialize probe).
 */
async function fetchOne(target: FetchTargetEntry, deps: FetchOneDeps): Promise<FetchMsg> {
  const { entry, marketplaceRoot, locations } = target;
  const source = parsePluginSource(entry.source);

  const isGitSource =
    source.kind === "url" || source.kind === "git-subdir" || source.kind === "github";

  // (1) Non-git source: nothing to fetch -> a no-op skipped row.
  if (!isGitSource) {
    return skippedUpToDate(entry);
  }

  const gitSource: GitBackedSource = source;

  try {
    // (2) fs-only no-op gate. A PINNED source whose clone is already present is
    // a no-op (network-free). An unpinned source ALWAYS refreshes (its warm
    // mirror is not a no-op), so only the pinned-warm case short-circuits here.
    if (gitSource.sha !== undefined) {
      const presence = await makePresenceProbe(locations)(gitSource);
      if (presence.kind === "materialized") {
        return skippedUpToDate(entry);
      }
    }

    // (3) Materialize through the clone-cache seam (the consented fetch).
    await materializeThroughSeam(gitSource, deps, locations);

    // Derive the post-fetch row FRESH against the now-warm tree.
    return await freshRow(entry, marketplaceRoot, locations);
  } catch (err) {
    return failedRow(entry, err);
  }
}

/**
 * Run the git materialize through the injected clone-cache seam. Pinned sources
 * resolve their pin then clone into the per-sha immutable cache; unpinned
 * sources refresh the single mutable URL-keyed mirror in place. Both arms thread
 * the host-keyed auth bundle (once-per-host via the shared authMemo). Mirrors
 * install's `makeInstallCloneProbe` structure; fetch reaches the git surface
 * only through the seam.
 */
async function materializeThroughSeam(
  gitSource: GitBackedSource,
  deps: FetchOneDeps,
  locations: ScopedLocations,
): Promise<void> {
  if (gitSource.sha === undefined) {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const auth = buildProbeAuth(cloneUrl, gitSource.kind, deps);
    await deps.seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      ...(auth !== undefined && { auth }),
    });
    return;
  }

  const { cloneUrl, pin, ref } = await deps.seam.resolvePluginPin({ source: gitSource });
  const auth = buildProbeAuth(cloneUrl, gitSource.kind, deps);
  await deps.seam.materializePluginClone({
    locations,
    cloneUrl,
    pin,
    ...(ref !== undefined && { ref }),
    ...(auth !== undefined && { auth }),
  });
}

/**
 * Build the host-keyed auth bundle for a resolved cloneUrl (install parity,
 * D-81-05). Returns a bundle for a registered provider host or undefined for a
 * no-provider / public host (T-79-04 cross-host leak guard). The sweep-wide
 * authMemo caps the device flow at once per host (FTCH-06).
 */
function buildProbeAuth(
  cloneUrl: string,
  kind: "url" | "git-subdir" | "github",
  deps: FetchOneDeps,
) {
  return buildAuthForHost({
    host: hostFromCloneUrl(cloneUrl, kind),
    credentialOps: deps.credentialOps,
    ctx: deps.ctx,
    authMemo: deps.authMemo,
    ...(deps.deviceFlowHttp !== undefined && { deviceFlowHttp: deps.deviceFlowHttp }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Row builders (derived post-fetch status / no-op / failure)
// ─────────────────────────────────────────────────────────────────────────────

/** Optional-version + optional-description carry from the manifest entry (PL-4). */
function entryMeta(entry: ManifestEntry): { version?: string; description?: string } {
  return {
    ...(entry.version !== undefined && { version: entry.version }),
    ...(entry.description !== undefined && { description: entry.description }),
  };
}

/**
 * D-81-02: the no-op row (path source or pinned-warm clone with nothing to
 * fetch). Renders `(skipped)` carrying the existing `up-to-date` REASONS member
 * at info severity -- no new closed-set token (FTCH-03).
 */
function skippedUpToDate(entry: ManifestEntry): FetchMsg {
  return {
    status: "skipped",
    name: entry.name,
    reasons: ["up-to-date"] as const,
    ...entryMeta(entry),
  };
}

/**
 * Derive the FRESH post-fetch status row from `probeManifestEntry` against the
 * now-warm tree (never a pre-materialize probe). The classification maps 1:1
 * onto the fetch row status: `remote` (still unmaterialized), `available`,
 * `partially-available` (carries the dropped-kind reasons), `unavailable`
 * (carries the structural reasons). Mirrors `list`'s `availableRowMessage`.
 */
async function freshRow(
  entry: ManifestEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<FetchMsg> {
  const meta = entryMeta(entry);
  const classification = await probeManifestEntry(entry, marketplaceRoot, locations);
  if (classification === "remote") {
    return { status: "remote", name: entry.name, ...meta };
  }

  if (classification === "available") {
    return { status: "available", name: entry.name, ...meta };
  }

  // partially-available / unavailable carry REQUIRED reasons. Re-resolve to read
  // the typed reason source: the unsupported component kinds (partially-
  // available) or the structural notes (unavailable), narrowed through the SAME
  // helpers `list` uses (byte-parity). A probe throw folds to `unavailable` with
  // the narrowed cause class.
  return await reasonedRow(entry, marketplaceRoot, locations, meta);
}

/**
 * Build the reasons-bearing `partially-available` / `unavailable` row. Re-runs
 * the fs-only resolver (via the presence probe) to read the typed reason source
 * and narrows it with the shared list-surface helpers. A resolver throw folds to
 * `(unavailable)` carrying the narrowed probe-error class (parity with list's
 * per-row probe-failure narrowing).
 */
async function reasonedRow(
  entry: ManifestEntry,
  marketplaceRoot: string,
  locations: ScopedLocations,
  meta: { version?: string; description?: string },
): Promise<FetchMsg> {
  const { resolveStrict } = await import("../../domain/resolver.ts");
  const source = parsePluginSource(entry.source);
  const isGitSource =
    source.kind === "url" || source.kind === "git-subdir" || source.kind === "github";

  try {
    const resolved = isGitSource
      ? await resolveStrict(entry, {
          marketplaceRoot,
          resolveGitPluginRoot: makePresenceProbe(locations),
        })
      : await resolveStrict(entry, { marketplaceRoot });

    // Discriminate on the resolver's own three-way state so the reasons source
    // matches the classification (list-parity).
    if (resolved.state === "partially-available") {
      return {
        status: "partially-available",
        name: entry.name,
        reasons: narrowUnsupportedKinds(resolved.unsupported),
        ...meta,
      };
    }

    if (resolved.state === "unavailable") {
      return {
        status: "unavailable",
        name: entry.name,
        reasons: narrowResolverNotes(resolved.notes),
        ...meta,
      };
    }

    // An `installable` resolve slipped past the classifier (concurrent warm) --
    // render it as `available` rather than fabricating reasons.
    return { status: "available", name: entry.name, ...meta };
  } catch (probeErr) {
    return {
      status: "unavailable",
      name: entry.name,
      reasons: [narrowProbeError(probeErr)],
      ...meta,
    };
  }
}

/**
 * Capture a thrown per-plugin fetch into a `(failed)` row. The materialize throw
 * (network / auth / fs) narrows into the EXISTING closed-set REASONS (`network
 * unreachable` / `authentication required` / `source missing` / `permission
 * denied`) so the sweep stays failure-tolerant with no new token; the raw error
 * text rides the `cause` chain. `severity` is REQUIRED on a failed row (GATE-01)
 * -- a fetch that threw did not warm the cache (the desired state was not
 * carried out), so it stamps `error`, at parity with the install / update /
 * reinstall per-plugin failed rows.
 */
function failedRow(entry: ManifestEntry, err: unknown): FetchMsg {
  const cause = err instanceof Error ? err : new Error(errorMessage(err));
  return {
    status: "failed",
    severity: "error",
    name: entry.name,
    reasons: [narrowFetchFailure(err)],
    cause,
    ...(entry.version !== undefined && { version: entry.version }),
  };
}

/**
 * Narrow a git-materialize throw into an EXISTING closed-set REASON -- no new
 * token. The shared `classifyGitTransportFailure` ladder handles the
 * isomorphic-git `HttpError` (401/403 -> auth), `UserCanceledError` (the auth
 * flow terminated unsuccessfully), and network-errno arms; fetch adds the fs
 * errno arms of `reasonsFromTypedError` and folds any non-recognized throw to
 * `source missing` (the fail-clean default -- the tree could not be produced).
 */
function narrowFetchFailure(err: unknown): ContentReason {
  const transport = classifyGitTransportFailure(err);
  if (transport !== undefined) {
    return transport;
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return "permission denied";
    }
  }

  return "source missing";
}
