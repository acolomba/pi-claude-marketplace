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
//     helper, no platform-git import). BLOCK F in `eslint.config.js` enforces
//     that, because this file is not in its `NETWORK_SEAMS` list.
//   - auth: `auth-host.ts`'s `buildCloneAuth` with a single sweep-wide
//     `authMemo` so a bulk sweep triggers each host's device flow at most once
//     (FTCH-06).
//   - classification: the fs-only presence probe (`makePresenceProbe`) for the
//     no-op gate, and `list`'s own rule (`resolveListCandidate`) for every row
//     that shows a status or a version, so a fetch row reads as the `list` row
//     of the same plugin (D-PL7-09, D-PL7-17).
//   - locking: an unpinned fetch refreshes the shared mirror and reads its row
//     inside one scope-lock body, so no other command changes the tree between
//     the two (GIT-03, D-PL7-07). A pinned clone is immutable and takes no lock.
//   - cascade: `notify-context.ts::notifyWithContext` with FETCH_CONTEXT.
//
// The enumeration is MANIFEST-driven (D-81 fetchable-set): the fetchable set
// comes from `loadMarketplaceManifest`, NOT installed state. A per-plugin
// failure never aborts the sweep (it is captured as a `(failed)` row), except
// an invalid GitHub base override, which fails the whole command (GHB-03). An
// unreadable marketplace manifest degrades to a per-marketplace `(failed)`
// block. fetch persists NO state (derive-not-persist): the only fs write is
// the clone seam's, which lives in clone-cache.ts.

import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope } from "../../shared/compare-name-scope.ts";
import {
  errorMessage,
  rethrowInvalidGitHubBaseUrl,
  StateLockHeldError,
} from "../../shared/errors.ts";
import { classifyGitFailure } from "../../shared/git-failure-classifiers.ts";
import { type ContentReason } from "../../shared/notification-types.ts";
import {
  notifyWithContext,
  type MarketplaceRows,
  type Plural,
} from "../../shared/notify-context.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";
import { withExistingScopeLock } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildCloneAuth } from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  networkCloneUrl,
  resolvePluginPin,
} from "./clone-cache.ts";
import { FETCH_CONTEXT, type FetchMsg } from "./fetch.messaging.ts";

import type { makePresenceProbe } from "./git-source-probe.ts";
import type { ListCandidate, resolveListCandidate } from "./list-candidate-version.ts";
import type { MarketplaceManifest } from "../../domain/manifest.ts";
import type { ResolveContext, ResolvedPlugin } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
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

/** Reads the two fetch-owned status boundaries without granting mutation authority. */
export interface FetchStatus {
  readonly makePresenceProbe: typeof makePresenceProbe;
  readonly resolveListCandidate: typeof resolveListCandidate;
}

export interface FetchPluginsOptions {
  readonly ctx: ExtensionContext;
  /** D-05: the command run; its soft-dependency snapshot feeds the emission. */
  readonly run: NotificationRun;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: FetchTarget;
  /** Test-only clone-cache seam override; production uses the real imports. */
  readonly cloneCacheSeam?: FetchCloneCacheSeam;
  /** Defaults to DEFAULT_CREDENTIAL_OPS at use (auth at install parity, D-81-05). */
  readonly credentialOps?: CredentialOps;
  /** Device Flow HTTP seam; callers can inject a network-free collaborator. */
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
export function createFetchPlugins(
  status: FetchStatus,
): (opts: FetchPluginsOptions) => Promise<void> {
  return async function fetchPlugins(opts: FetchPluginsOptions): Promise<void> {
    const { ctx, run } = opts;

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
      // A thrown fetch is captured as a `(failed)` row and the sweep continues
      // to the remaining plugins. Only an invalid GitHub base override escapes
      // and ends the sweep (GHB-03).
      // eslint-disable-next-line no-await-in-loop -- the shared `authMemo` runs the device flow once per host
      const row = await fetchOne(target, {
        ctx,
        run,
        seam,
        status,
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

    notifyWithContext(ctx, run, FETCH_CONTEXT, marketplaces, "cascade", cardinality);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest-driven enumeration (fetchable set)
// ─────────────────────────────────────────────────────────────────────────────

interface FetchTargetEntry {
  readonly entry: ManifestEntry;
  readonly marketplace: string;
  readonly marketplaceRoot: string;
  readonly marketplaceSource: unknown;
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
    // eslint-disable-next-line no-await-in-loop -- at most two scopes, one state read each
    const state = await loadState(locations.extensionRoot);

    for (const [mpName, mp] of Object.entries(state.marketplaces)) {
      if (wantMarketplace !== undefined && mpName !== wantMarketplace) {
        continue;
      }

      try {
        targets.push(
          // eslint-disable-next-line no-await-in-loop -- bounded by the scope's marketplaces, one manifest load each
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
  mp: { manifestPath: string; marketplaceRoot: string; source: unknown },
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
        marketplaceSource: mp.source,
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
  readonly run: NotificationRun;
  readonly seam: FetchCloneCacheSeam;
  readonly status: FetchStatus;
  readonly credentialOps: CredentialOps;
  readonly authMemo: Map<string, AuthAttemptResult>;
  readonly deviceFlowHttp?: DeviceFlowHttp;
}

/**
 * Fetch a single manifest entry. A thrown materialize is captured as a
 * `(failed)` row via the closed-set REASONS narrowing, so the bulk sweep
 * tolerates every per-plugin failure except an invalid GitHub base override,
 * which this function rethrows to fail the command (GHB-03).
 *
 * Flow:
 *   (1) Non-git source (path / npm / unknown): a no-op -- render
 *       `(skipped) {up-to-date}` at info severity, no git seam call.
 *   (2) Git source: run the fs-only presence probe FIRST. A PINNED source whose
 *       clone is already `materialized` is a no-op -> `(skipped) {up-to-date}`,
 *       no network. Otherwise (remote-cold OR any unpinned) run the materialize:
 *       pinned arm -> resolvePluginPin + materializePluginClone; unpinned arm ->
 *       canonicalCloneUrl + materializeOrRefreshPluginMirror (a cold mirror is
 *       cloned, a warm one refreshed; either IS the consented fetch).
 *   (3) After the seam returns, derive the row FRESH from `resolveListCandidate`
 *       against the now-warm tree (never a pre-materialize probe). The unpinned
 *       arm runs the materialize and this read in one `withExistingScopeLock`
 *       body (D-PL7-07); a held lock fails the row `lock held`.
 *
 * Every row that shows a version takes it from the same list rule: the
 * version of the warm or path tree, else the entry's (D-PL7-09, D-PL7-17).
 */
async function fetchOne(target: FetchTargetEntry, deps: FetchOneDeps): Promise<FetchMsg> {
  const { entry, locations } = target;
  const source = parsePluginSource(entry.source);
  const marketplaceContext = {
    marketplaceRoot: target.marketplaceRoot,
    marketplaceName: target.marketplace,
    marketplaceSource: target.marketplaceSource,
  };
  const readCandidate = (): Promise<CandidateRead> =>
    readListCandidate(entry, marketplaceContext, locations, deps.status);

  const isGitSource =
    source.kind === "url" || source.kind === "git-subdir" || source.kind === "github";

  // (1) Non-git source: nothing to fetch -> a no-op skipped row.
  if (!isGitSource) {
    return skippedUpToDate(entry, await readCandidate());
  }

  const gitSource: GitBackedSource = source;
  let rowRead = false;
  const fetchAndRead = async (): Promise<FetchMsg> => {
    await materializeThroughSeam(gitSource, deps, locations);
    const row = freshRow(entry, await readCandidate());
    rowRead = true;
    return row;
  };

  try {
    // (2) fs-only no-op gate. A PINNED source whose clone is already present is
    // a no-op (network-free). An unpinned source ALWAYS refreshes (its warm
    // mirror is not a no-op), so only the pinned-warm case short-circuits here.
    if (gitSource.sha !== undefined) {
      const presence = await deps.status.makePresenceProbe(locations)(gitSource);
      if (presence.kind === "materialized") {
        return skippedUpToDate(entry, await readCandidate());
      }

      // (3) A pinned clone is immutable and never touches the mirror: no lock.
      return await fetchAndRead();
    }

    // (3) A mirror refresh and the row read run under the scope's state lock,
    // so no install copies from a mirror mid-refresh and no cleanup removes
    // the tree the row reads (GIT-03, D-PL7-07).
    return await withExistingScopeLock(locations, fetchAndRead);
  } catch (err) {
    rethrowInvalidGitHubBaseUrl(err);
    return failedRow(entry, err, networkCloneUrl(gitSource), rowRead);
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
    const auth = buildCloneAuth(cloneUrl, gitSource.kind, deps);
    await deps.seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      networkUrl: networkCloneUrl(gitSource),
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      auth,
    });
    return;
  }

  const { cloneUrl, pin, ref } = await deps.seam.resolvePluginPin({ source: gitSource });
  await deps.seam.materializePluginClone({
    locations,
    cloneUrl,
    networkUrl: networkCloneUrl(gitSource),
    pin,
    ...(ref !== undefined && { ref }),
    resolveAuth: () => buildCloneAuth(cloneUrl, gitSource.kind, deps),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Row builders (derived post-fetch status / no-op / failure)
// ─────────────────────────────────────────────────────────────────────────────

/** A list-rule read of one entry; a throw is kept so the row can narrow it. */
type CandidateRead = ListCandidate | { readonly kind: "unreadable"; readonly error: unknown };

/** Read the entry through `list`'s offline rule, keeping a throw as `unreadable`. */
async function readListCandidate(
  entry: ManifestEntry,
  marketplaceContext: Pick<
    ResolveContext,
    "marketplaceRoot" | "marketplaceName" | "marketplaceSource"
  >,
  locations: ScopedLocations,
  status: FetchStatus,
): Promise<CandidateRead> {
  try {
    return await status.resolveListCandidate(entry, marketplaceContext, locations);
  } catch (error) {
    return { kind: "unreadable", error };
  }
}

/**
 * The version and description a row carries (PL-4). The version is `list`'s:
 * the one the warm or path tree declares, else the entry's, which a cold or
 * unreadable read keeps (D-PL7-09).
 */
function rowMeta(
  entry: ManifestEntry,
  candidate: CandidateRead,
): { version?: string; description?: string } {
  const version = (candidate.kind === "resolved" ? candidate.version : undefined) ?? entry.version;
  return {
    ...(version !== undefined && { version }),
    ...(entry.description !== undefined && { description: entry.description }),
  };
}

/**
 * D-81-02: the no-op row (path source or pinned-warm clone with nothing to
 * fetch). Renders `(skipped)` carrying the existing `up-to-date` REASONS member
 * at info severity -- no new closed-set token (FTCH-03) -- with `list`'s
 * version (D-PL7-17).
 */
function skippedUpToDate(entry: ManifestEntry, candidate: CandidateRead): FetchMsg {
  return {
    status: "skipped",
    name: entry.name,
    reasons: ["up-to-date"] as const,
    ...rowMeta(entry, candidate),
  };
}

/**
 * Derive the FRESH post-fetch status row from the list-rule read of the
 * now-warm tree, as `list-candidate-row.ts::availableRowMessage` does: `cold`
 * (still unmaterialized) is `remote`, a resolved tree takes the resolver's
 * three-way state, and a read that threw is `unavailable` with the narrowed
 * probe-error class.
 */
function freshRow(entry: ManifestEntry, candidate: CandidateRead): FetchMsg {
  const meta = rowMeta(entry, candidate);
  switch (candidate.kind) {
    case "cold":
      return { status: "remote", name: entry.name, ...meta };
    case "unreadable":
      return {
        status: "unavailable",
        name: entry.name,
        reasons: [narrowProbeError(candidate.error)],
        ...meta,
      };
    case "resolved":
      return resolvedRow(entry.name, candidate.resolved, meta);
  }
}

/**
 * The row of a resolved tree: the unsupported component kinds of a
 * partially-available plugin and the structural notes of an unavailable one
 * narrow through the SAME helpers `list` uses (byte-parity).
 */
function resolvedRow(
  name: string,
  resolved: ResolvedPlugin,
  meta: { version?: string; description?: string },
): FetchMsg {
  switch (resolved.state) {
    case "installable":
      return { status: "available", name, ...meta };
    case "partially-available":
      return {
        status: "partially-available",
        name,
        reasons: narrowUnsupportedKinds(resolved.unsupported),
        ...meta,
      };
    case "unavailable":
      return { status: "unavailable", name, reasons: narrowResolverNotes(resolved.notes), ...meta };
  }
}

/**
 * Capture a thrown per-plugin fetch into a `(failed)` row. The throw narrows
 * into the EXISTING closed-set REASONS (`narrowFetchFailure`), so the sweep
 * stays failure-tolerant with no new token; the raw error rides the `cause`
 * chain. When the git host answered with an HTTP status, the cause leads with
 * `{status} on {url}`, the status and the URL the fetch sent (`remoteUrl`, the
 * source's wire URL), as `marketplace update` frames a refused refresh
 * (D-PL7-03, D-PL7-14). `severity` is REQUIRED on a failed row (GATE-01) -- a
 * fetch that threw before it read its row did not warm the cache (the desired
 * state was not carried out), so it stamps `error`, at parity with the
 * install / update / reinstall per-plugin failed rows.
 *
 * `rowRead` is true when the locked body already read its row. The fetch
 * warmed the cache, and the throw came from the lock: it was lost or could
 * not be released. The row still stamps `error`.
 */
function failedRow(
  entry: ManifestEntry,
  err: unknown,
  remoteUrl: string,
  rowRead: boolean,
): FetchMsg {
  const error = err instanceof Error ? err : new Error(errorMessage(err));
  const { reason, frame } = narrowFetchFailure(err, remoteUrl, rowRead);
  return {
    status: "failed",
    severity: "error",
    name: entry.name,
    reasons: [reason],
    cause: frame === undefined ? error : new Error(frame, { cause: error }),
    ...(entry.version !== undefined && { version: entry.version }),
  };
}

/**
 * Narrow a fetch throw into an EXISTING closed-set REASON -- no new token. The
 * ladder: a held scope lock is `lock held`, and so is a lock lost or not
 * released after the locked body read its row (`rowRead`), because the fetch
 * itself succeeded and the source is not missing; then `classifyGitFailure`
 * with the plugin-clone rule (D-PL7-02), so a host 404/410 is `source
 * missing`, any other non-auth HTTP status `network error` (with its frame),
 * and the credential and network-errno arms keep their reasons; then
 * EACCES/EPERM on the thrown error -> `permission denied`;
 * and any other throw folds to `source missing` (the fail-clean default -- the
 * tree could not be produced).
 */
function narrowFetchFailure(
  err: unknown,
  remoteUrl: string,
  rowRead: boolean,
): { readonly reason: ContentReason; readonly frame?: string } {
  if (rowRead || err instanceof StateLockHeldError) {
    return { reason: "lock held" };
  }

  const classified = classifyGitFailure(err, { notFound: "source missing" }, remoteUrl);
  if (classified !== undefined) {
    return classified;
  }

  if (err instanceof Error) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      return { reason: "permission denied" };
    }
  }

  return { reason: "source missing" };
}
