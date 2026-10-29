// orchestrators/plugin/install-flow-cascade-context.ts
//
// Catalog, policy, pin, and marketplace-add context shared by install ledgers.

import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { appendLeaks } from "../../shared/errors.ts";
import { notifyMcpConfigNotices } from "../../shared/notification-dispatch.ts";

import { removeAddedClones, reusingCarriedAdds } from "./carried-marketplace-adds.ts";
import { readDependencyDeclaration } from "./dependency-declaration-read.ts";
import { cascadeFailureCause } from "./install-cascade.messaging.ts";
import { runInstallCascade } from "./install-cascade.ts";
import { probeInstallClone } from "./install-clone-probe.ts";
import { DEFAULT_MARKETPLACE_ADD, resolveTargetScopeMarketplace } from "./install-outcome.ts";
import { collectInstallReachableMarketplaces, resolveInstallMarketplaceSource } from "./shared.ts";

import type {
  AddedMarketplaces,
  CarriedAdd,
  MarketplaceAddSeam,
} from "./carried-marketplace-adds.ts";
import type { CascadeFailureSubject } from "./install-cascade.messaging.ts";
import type {
  CascadeMarketplaceTagProbe,
  CascadeTagProbe,
  InstallCascadeResult,
  ResolvedCascadeMember,
} from "./install-cascade.ts";
import type { InstallCloneCacheSeam } from "./install-clone-probe.ts";
import type {
  DirectoryPinRange,
  InstallFailureCapture,
  InstallLedgerOptions,
  TargetScopeAddOptions,
} from "./install-outcome.ts";
import type { ClaudeEnv } from "../../domain/claude-mcp-variables.ts";
import type {
  ClosureLookup,
  ClosureLookupResult,
  ClosureSubject,
} from "../../domain/dependency-closure.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState, PluginInstallRecord } from "../../persistence/state-io.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { CompletionCache } from "../../shared/completion-cache.ts";
import type { RemovalOps } from "../../shared/fs-utils.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { McpConfigNotice } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { runPhases } from "../../transaction/phase-ledger.ts";
import type {
  LockedStateTransaction,
  withLockedStateTransaction,
} from "../../transaction/with-state-guard.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { InstallPluginOutcome } from "../types.ts";

export interface CascadeInstallOptions {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly mapModel?: boolean;
  readonly partial?: boolean;
  readonly cloneCacheSeam?: InstallCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly tagProbe?: CascadeTagProbe;
  readonly marketplaceTagProbe?: CascadeMarketplaceTagProbe;
}

export interface CascadeTransaction {
  readonly runPhases: typeof runPhases;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}

/**
 * The fields `buildInstallLedgerOptions` reads off its caller's options,
 * narrowed so `installMissingDependencyWithTransaction` can share the builder
 * without carrying every `CascadeInstallOptions` field (D-09-05).
 */
export type InstallLedgerCallerOptions = Pick<
  CascadeInstallOptions,
  | "ctx"
  | "run"
  | "mapModel"
  | "partial"
  | "cloneCacheSeam"
  | "credentialOps"
  | "deviceFlowHttp"
  | "authMemo"
>;

/**
 * Assemble the `InstallLedgerOptions` for ONE cascade member from the
 * entrypoint options, spreading each optional field only when defined
 * (exactOptionalPropertyTypes). Extracted from `installPlugin`'s guard closure
 * so the conditional-spread ladder does not inflate that closure's cognitive
 * complexity. `ctx` is always threaded so the git-source clone probe can wire
 * the auth notify seam (PROV-03).
 *
 * The entrypoint options divide in two, and the split is the contract.
 *
 * Cascade-wide, deliberately: `mapModel`, `partial`, `cloneCacheSeam` and the
 * three auth collaborators. `--map-model` states how the user wants generated
 * agents written and `--partial` states which resolver gate the user accepts,
 * and a cascade that applied either to the plugin the user typed but not to
 * the plugins installed with it would produce one install under two policies.
 * The auth trio must be shared or a member would authenticate differently from
 * the tag query that selected its pin (AUTH-09).
 *
 * Per-member, necessarily: `sourcePin`, `resolvedVersion` and `pinVersion`.
 * The first two are facts about ONE member -- the commit its constraint
 * selected and the semver the selected tag carries -- so they arrive on `core`
 * and are never read off `opts`. `pinVersionOverride` takes absolute
 * precedence in `deriveInstallVersion`, so copying the caller's own onto
 * every member would record every dependency under the requesting plugin's
 * version string.
 */
export function buildInstallLedgerOptions(
  opts: InstallLedgerCallerOptions,
  env: ClaudeEnv,
  core: {
    scope: Scope;
    cwd: string;
    marketplace: string;
    plugin: string;
    /** RESV-03: the commit a cascade member's version constraint selected. */
    sourcePin?: string;
    /**
     * RESV-05 / GV-01: the semver THIS member's selected tag carries, recorded
     * beside a version that carries the tag's commit, as Claude Code records
     * it. Dependency ranges read it back.
     */
    resolvedVersion?: string;
    /** The caller's `pinVersionOverride`, for the member the caller named. */
    pinVersion?: string;
    /** GV-01: the range THIS plugin directory member's listed copy must satisfy. */
    directoryPin?: DirectoryPinRange;
    /** D-04-01: whether THIS member is the plugin the caller named. */
    provenance?: PluginInstallRecord["provenance"];
    /**
     * LAYER-07 / WR-07: the transaction's add seam and its list of added
     * marketplaces, shared by every member of the cascade.
     */
    marketplaceAdd: MarketplaceAddSeam;
    addedMarketplaces: AddedMarketplaces;
    cloneCandidates?: Set<string>;
    cloneProbe?: InstallLedgerOptions["cloneProbe"];
  },
  removalOps: RemovalOps,
): InstallLedgerOptions {
  return {
    ctx: opts.ctx,
    run: opts.run,
    scope: core.scope,
    cwd: core.cwd,
    marketplace: core.marketplace,
    plugin: core.plugin,
    ...(core.sourcePin !== undefined && { sourcePinOverride: core.sourcePin }),
    ...(core.resolvedVersion !== undefined && { resolvedVersion: core.resolvedVersion }),
    ...(core.directoryPin !== undefined && { directoryPin: core.directoryPin }),
    ...(core.provenance !== undefined && { provenance: core.provenance }),
    ...(opts.mapModel !== undefined && { mapModel: opts.mapModel }),
    ...(opts.partial !== undefined && { partial: opts.partial }),
    ...(core.pinVersion !== undefined && { pinVersionOverride: core.pinVersion }),
    ...(opts.cloneCacheSeam !== undefined && { cloneCacheSeam: opts.cloneCacheSeam }),
    ...(core.cloneCandidates !== undefined && { cloneCandidates: core.cloneCandidates }),
    cloneProbe: core.cloneProbe ?? probeInstallClone,
    // D-08-12: the install path's composition root. The ledger options carry the
    // port as a required member, so this assembly point is the one place the real
    // operations enter the install path.
    removalOps,
    env,
    ...(opts.credentialOps !== undefined && { credentialOps: opts.credentialOps }),
    ...(opts.deviceFlowHttp !== undefined && { deviceFlowHttp: opts.deviceFlowHttp }),
    ...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
    marketplaceAdd: core.marketplaceAdd,
    addedMarketplaces: core.addedMarketplaces,
  };
}

/**
 * WR-07 / LAYER-07 / D-MF-04: the install's state lock for a body whose ledger
 * runs add marketplaces to the scope, each appended to `added`. The body gets
 * a transaction whose save moves those adds to `committed`. When the body
 * throws, or returns without saving, every clone an unsaved add created is
 * removed before the lock is released, as `marketplace add` removes its own
 * clone when its save fails. A removal leak is appended to a thrown error, or
 * written to the debug log for an arm that returns.
 */
function discardingUnsavedAdds(
  transaction: CascadeTransaction,
  added: AddedMarketplaces,
  committed: AddedMarketplaces,
): Pick<CascadeTransaction, "withLockedStateTransaction"> {
  return {
    withLockedStateTransaction: async (locations, body, deps) =>
      transaction.withLockedStateTransaction(
        locations,
        async (tx) => {
          const observed: LockedStateTransaction = {
            state: tx.state,
            save: async () => {
              await tx.save();
              committed.push(...added.splice(0));
            },
          };
          let value: Awaited<ReturnType<typeof body>>;
          try {
            value = await body(observed);
          } catch (err) {
            throw appendLeaks(err, await removeAddedClones(added));
          }

          for (const leak of await removeAddedClones(added)) {
            if (leak !== undefined) {
              hookDebugLog(`install saved no state; ${leak}`);
            }
          }

          return value;
        },
        deps,
      ),
  };
}

/** One install transaction's `marketplace add` seam, its add lists, and its lock owner. */
export interface InstallAdds {
  readonly marketplaceAdd: MarketplaceAddSeam;
  readonly addedMarketplaces: AddedMarketplaces;
  readonly committedAdds: AddedMarketplaces;
  readonly lockOwner: Pick<CascadeTransaction, "withLockedStateTransaction">;
}

/**
 * Starts the add bookkeeping of one install transaction (WR-07 / LAYER-07). A
 * source in `carried` (WR-E) is recorded again from its kept clone.
 */
export function trackInstallAdds(
  transaction: CascadeTransaction,
  seam: MarketplaceAddSeam | undefined,
  carried: CarriedAdd[] = [],
): InstallAdds {
  const addedMarketplaces: AddedMarketplaces = [];
  const committedAdds: AddedMarketplaces = [];
  return {
    marketplaceAdd: reusingCarriedAdds(seam ?? DEFAULT_MARKETPLACE_ADD, carried),
    addedMarketplaces,
    committedAdds,
    lockOwner: discardingUnsavedAdds(transaction, addedMarketplaces, committedAdds),
  };
}

/**
 * D-03-INV / D-SEED-01: settle each marketplace a saved install added, as
 * `marketplace add` settles one after its save. Each settle is best effort.
 */
export async function settleAddedMarketplaces(
  committed: AddedMarketplaces,
  seam: MarketplaceAddSeam,
  locations: ScopedLocations,
  completionCache: CompletionCache,
): Promise<void> {
  for (const { marketplace } of committed) {
    // eslint-disable-next-line no-await-in-loop -- two added marketplaces of one repository seed the same plugin mirrors.
    await seam.settle({ locations, name: marketplace, completionCache });
  }
}

/**
 * RESV-05: every `<plugin>@<marketplace>` key the target scope already records.
 * The cascade keeps a recorded ENABLED key as a walk wall -- it never becomes
 * a phase and no rollback reaches it -- and strips a recorded DISABLED key so
 * the walk re-enables it as a member (EDEP-03, `liveInstalledKeys`).
 */
export function collectInstalledKeys(state: ExtensionState): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const [marketplaceName, record] of Object.entries(state.marketplaces)) {
    for (const pluginName of Object.keys(record.plugins)) {
      keys.add(`${pluginName}@${marketplaceName}`);
    }
  }

  return keys;
}

/**
 * The record one install transaction reads a marketplace from, or `undefined`.
 * `plugin` names the plugin the caller installs from it (WR-05).
 */
export type TargetRecordFor = (
  marketplace: string,
  plugin?: string,
) => Promise<ExtensionState["marketplaces"][string] | undefined>;

/**
 * Reads the selected root marketplace's validated policy from its cached
 * manifest. It is the install's first read of the root marketplace, so a root
 * plugin the user scope's manifest does not list fails here, before any add.
 */
export async function loadInstallRootAllowlist(
  recordFor: TargetRecordFor,
  marketplace: string,
  plugin: string,
): Promise<ReadonlySet<string>> {
  const record = await recordFor(marketplace, plugin);
  if (record === undefined) {
    return new Set<string>();
  }

  const manifest = await loadMarketplaceManifest(record.manifestPath);
  return new Set(manifest.allowCrossMarketplaceDependenciesOn ?? []);
}

/** Selects distinct foreign policies without letting their order outrank a same-marketplace grant. */
function originalDeclaringMarketplaces(
  declarers: readonly string[],
  marketplace: string,
): { sameMarketplace: boolean; foreign: ReadonlySet<string> } {
  const declaringMarketplaces = new Set<string>();
  for (const key of declarers) {
    const at = key.lastIndexOf("@");
    if (at <= 0 || at === key.length - 1) {
      continue;
    }

    const declaringMarketplace = key.slice(at + 1);
    if (declaringMarketplace === marketplace) {
      return { sameMarketplace: true, foreign: declaringMarketplaces };
    }

    declaringMarketplaces.add(declaringMarketplace);
  }

  return { sameMarketplace: false, foreign: declaringMarketplaces };
}

/** Reads each eligible original source's policy before a missing root can install. */
export async function authorizeMissingDependency(args: {
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly state: ExtensionState;
  readonly declarers: readonly string[];
}): Promise<boolean> {
  const sources = originalDeclaringMarketplaces(args.declarers, args.marketplace);
  if (sources.sameMarketplace) {
    return true;
  }

  let policyError: Error | undefined;
  for (const declaringMarketplace of sources.foreign) {
    try {
      // eslint-disable-next-line no-await-in-loop -- the first allowing marketplace returns; `??=` keeps the first error
      const source = await resolveInstallMarketplaceSource({
        targetScope: args.scope,
        cwd: args.cwd,
        marketplace: declaringMarketplace,
        targetState: args.state,
      });
      if (source === undefined) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- the first allowing marketplace returns; `??=` keeps the first error
      const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
      if (manifest.allowCrossMarketplaceDependenciesOn?.includes(args.marketplace) === true) {
        return true;
      }
    } catch (err: unknown) {
      policyError ??= err as Error;
    }
  }

  if (policyError !== undefined) {
    throw policyError;
  }

  return false;
}

/**
 * The cascade's catalog read: one plugin's declared dependencies, in the
 * D-01-32 read order. The plugin's OWN manifest answers wherever it is readable
 * without a network call, and the marketplace entry that declares the plugin is
 * the fallback. `dependency-declaration-read.ts` owns that order and the
 * filesystem contract it rests on; this function locates the entry for it.
 *
 * LAYER-07 / D-MF-04: `record` is the target scope's record, the one the
 * member then installs from. `loadMarketplaceManifest` is the memoized PI-2
 * read of bytes already on disk, and the declaration read reaches no
 * materializing path at all.
 *
 * D-03-05: the read is handed the TARGET scope's locations, because that is the
 * scope every cascade member installs into and therefore the clone cache a
 * git-source member's manifest would live in.
 */
async function lookupCascadeDependencies(
  record: ExtensionState["marketplaces"][string],
  locations: ScopedLocations,
  subject: ClosureSubject,
): Promise<ClosureLookupResult> {
  const manifest = await loadMarketplaceManifest(record.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, subject.name);
  if (declared.kind === "absent") {
    return { kind: "absent" };
  }

  return readDependencyDeclaration({
    marketplaceRoot: record.marketplaceRoot,
    entry: declared.entry,
    locations,
  });
}

/**
 * LAYER-07 / D-MF-04: the catalog reads of one install transaction. Each
 * marketplace the walk, the pin probe, or the allowlist reads resolves through
 * `resolveTargetScopeMarketplace`, so a marketplace only the user scope records
 * is added to the target scope before its first read. The walk then reads the
 * clone each member installs from, never the user scope's older clone.
 *
 * NFR-5 (amended by D-MF-04): such an add clones a git source. The walk's
 * trust guards run before its lookup, so only a marketplace the install may
 * use is added. RESV-06: a dependency whose marketplace add fails is named as
 * the failing member, as it was when its own ledger ran the add.
 */
function installCatalog(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly addOptions: TargetScopeAddOptions;
  readonly sink: CascadeFailureSink;
}): { readonly recordFor: TargetRecordFor; readonly lookup: ClosureLookup } {
  const { state, locations, addOptions, sink } = args;
  const resolvedKeys: string[] = [];
  const recordFor: TargetRecordFor = (marketplace, plugin) =>
    resolveTargetScopeMarketplace(state, locations, addOptions, marketplace, plugin);
  return { recordFor, lookup: catalogLookup(recordFor, locations, sink, resolvedKeys) };
}

/**
 * A catalog read through `recordFor`: the member's declarations from the
 * record its marketplace resolves to, or `absent`. A record that cannot be
 * resolved names the member on `sink` before the throw (RESV-06).
 */
export function catalogLookup(
  recordFor: TargetRecordFor,
  locations: ScopedLocations,
  sink: CascadeFailureSink,
  resolvedKeys: string[] = [],
): ClosureLookup {
  return async (subject) => {
    try {
      const record = await recordFor(subject.marketplace);
      const result =
        record === undefined
          ? { kind: "absent" as const }
          : await lookupCascadeDependencies(record, locations, subject);
      resolvedKeys.push(subject.key);
      return result;
    } catch (err: unknown) {
      sink.subject = {
        kind: "member",
        key: subject.key,
        error: err as Error,
        rollbackPartials: [],
        unmaterialized: resolvedKeys,
      };
      throw err;
    }
  };
}

/** The cascade options both install owners pass the same way. */
export type SharedCascadeOptions = Pick<
  Parameters<typeof runInstallCascade>[0],
  | "state"
  | "locations"
  | "rootKey"
  | "rootAllowedMarketplaces"
  | "lookup"
  | "marketplaceRecordFor"
  | "installedKeys"
  | "knownMarketplaces"
  | "capture"
  | "transaction"
  | "tagProbe"
  | "marketplaceTagProbe"
>;

/**
 * RESV-01 / LAYER-07: the cascade options the plain install and the
 * missing-dependency install build alike. The catalog reads go through
 * `installCatalog`, so the walk reads the clone each member installs from.
 *
 * RESV-03 / CMP-3: the pin probe reads a member's source out of the
 * marketplace record, and it must reach that record the same way the walk's
 * own catalog read does. Reading the target snapshot directly would answer
 * "no source" for a marketplace the CMP-3 fallback resolves, turning a
 * resolvable constrained dependency into a `no-matching-tag` it never earned.
 *
 * D-03-08: `knownMarketplaces` is the set this install can READ. A dependency
 * naming anything else fails the cascade. This reachable set decides trust: a
 * marketplace in it that only the user scope records is added to the target
 * scope before the walk reads it (LAYER-07 / D-MF-04), and no marketplace
 * outside it is ever added to satisfy a dependency. It is the CMP-3-aware set
 * and NOT the raw target-scope key set, because the walk's own catalog read
 * resolves through the same project -> user fallback. Seeding the guard from
 * the narrower set would put two notions of "reachable" in one walk, and the
 * guard runs FIRST -- so the stricter one would win and refuse a dependency
 * the lookup one step later resolves, under the one cascade message that
 * carries a trust rule. Every name in this set is one the user added
 * themselves, so that trust rule is unchanged. The requested plugin's own
 * marketplace needs no special seeding: it is in this set whenever the ledger
 * could resolve it, and the ledger still owns reporting the double-miss
 * through the `marketplace-absent` arm.
 */
export async function sharedCascadeOptions(args: {
  readonly opts: InstallLedgerCallerOptions &
    Pick<CascadeInstallOptions, "tagProbe" | "marketplaceTagProbe">;
  readonly env: ClaudeEnv;
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly root: {
    readonly scope: Scope;
    readonly cwd: string;
    readonly marketplace: string;
    readonly plugin: string;
    readonly rootKey: string;
  };
  readonly adds: InstallAdds;
  readonly sink: CascadeFailureSink;
  readonly capture: InstallFailureCapture;
  readonly transaction: CascadeTransaction;
  readonly removalOps: RemovalOps;
}): Promise<SharedCascadeOptions> {
  const { opts, state, locations, root, adds } = args;
  const catalog = installCatalog({
    state,
    locations,
    addOptions: buildInstallLedgerOptions(
      opts,
      args.env,
      {
        scope: root.scope,
        cwd: root.cwd,
        marketplace: root.marketplace,
        plugin: root.plugin,
        marketplaceAdd: adds.marketplaceAdd,
        addedMarketplaces: adds.addedMarketplaces,
      },
      args.removalOps,
    ),
    sink: args.sink,
  });
  return {
    state,
    locations,
    rootKey: root.rootKey,
    rootAllowedMarketplaces: await loadInstallRootAllowlist(
      catalog.recordFor,
      root.marketplace,
      root.plugin,
    ),
    lookup: catalog.lookup,
    marketplaceRecordFor: catalog.recordFor,
    installedKeys: collectInstalledKeys(state),
    knownMarketplaces: await collectInstallReachableMarketplaces({
      targetScope: root.scope,
      cwd: root.cwd,
      targetState: state,
    }),
    capture: args.capture,
    transaction: args.transaction,
    ...(opts.tagProbe !== undefined && { tagProbe: opts.tagProbe }),
    ...(opts.marketplaceTagProbe !== undefined && {
      marketplaceTagProbe: opts.marketplaceTagProbe,
    }),
  };
}

/**
 * The commit a cascade member installs and the version it records, when the
 * walk or the plan chose them. RESV-03 / GV-01: a member whose constraint
 * selected a release tag installs that tag's commit and records the tag's
 * semver as `resolvedVersion`. D-PL4-01: otherwise a member the plan
 * previewed installs the commit its preview resolved. That commit carries no
 * `resolvedVersion`, so the recorded version derives as an unpinned install
 * of the same commit derives it; setting one here would record a tag-shaped
 * version the plan never chose.
 */
export function memberLedgerPin(member: ResolvedCascadeMember): {
  readonly sourcePin?: string;
  readonly resolvedVersion?: string;
} {
  if (member.pin !== undefined) {
    return { sourcePin: member.pin.oid, resolvedVersion: member.pin.version };
  }

  return member.previewedCommit === undefined ? {} : { sourcePin: member.previewedCommit };
}

/**
 * D-04-01: the per-member ledger options of a cascade whose every member
 * exists to satisfy a declaration -- the reload's missing-dependency install
 * and an update's new closure (UPD-DEP-D1). RESV-03: a member whose
 * constraint selected a release tag installs that tag's commit and records
 * its semver as `resolvedVersion` (GV-01). D-PL4-01: a member the plan
 * previewed installs the commit its preview resolved.
 */
export function dependencyLedgerOptions(
  opts: InstallLedgerCallerOptions,
  env: ClaudeEnv,
  core: {
    readonly scope: Scope;
    readonly cwd: string;
    readonly adds: InstallAdds;
    readonly removalOps: RemovalOps;
    readonly cloneCandidates?: Set<string>;
  },
): (member: ResolvedCascadeMember) => InstallLedgerOptions {
  return (member) =>
    buildInstallLedgerOptions(
      opts,
      env,
      {
        scope: core.scope,
        cwd: core.cwd,
        marketplace: member.marketplace,
        plugin: member.name,
        ...memberLedgerPin(member),
        ...(member.directoryPin !== undefined && { directoryPin: member.directoryPin }),
        provenance: "dependency",
        marketplaceAdd: core.adds.marketplaceAdd,
        addedMarketplaces: core.adds.addedMarketplaces,
        ...(core.cloneCandidates !== undefined && { cloneCandidates: core.cloneCandidates }),
      },
      core.removalOps,
    );
}

/**
 * Where `unwrapCascade` leaves the structured failure for the catch site.
 *
 * The catch needs the DISCRIMINANT, not a rendered string, because RESV-06's
 * row names the failing dependency and the reason it failed -- neither of which
 * survives a `throw new Error(text)`. The sink carries it across the lock
 * closure boundary the same way `capture` carries the rollback partials: both
 * are written BEFORE the rethrow, which is why neither can ride the closure's
 * `InstallTransactionOutcome` return.
 */
export interface CascadeFailureSink {
  subject?: CascadeFailureSubject;
  /**
   * AFILE-04: the notices of every MCP config rewrite that has already
   * happened, written before the next step that can throw for the same reason
   * as `subject`: the members that committed before a member failed, or the
   * whole cascade, disable cascade or promotion when a later config write or
   * the state save throws.
   */
  mcpConfigNotices: readonly McpConfigNotice[];
}

/**
 * AFILE-04: the notices member an outcome carries, present only when there is
 * a notice to carry (NREG-01).
 */
export function installMcpConfigNoticesMember(notices: readonly McpConfigNotice[]): {
  readonly mcpConfigNotices?: readonly McpConfigNotice[];
} {
  return notices.length > 0 ? { mcpConfigNotices: notices } : {};
}

/**
 * AFILE-04: a standalone install shows its MCP config notices after its own
 * row; an orchestrated one sends nothing and leaves them to its caller. Both
 * modes carry them on the outcome.
 */
export function withMcpConfigNotices(
  ctx: NotificationContext,
  run: NotificationRun,
  orchestrated: boolean,
  outcome: InstallPluginOutcome,
  notices: readonly McpConfigNotice[],
): InstallPluginOutcome {
  if (!orchestrated) {
    notifyMcpConfigNotices(ctx, run, notices);
  }

  return { ...outcome, ...installMcpConfigNoticesMember(notices) };
}

/** The cascade arms that are failures, which `unwrapCascade` routes for every caller. */
export type CascadeFailureArm = Extract<
  InstallCascadeResult,
  { readonly kind: "closure-failed" | "constraint-failed" | "marketplace-absent" | "member-failed" }
>;

/**
 * Route the cascade's outcome onto install's existing three dispositions:
 * the installed arm, the `marketplace-absent` sentinel (reported as
 * `undefined`, so the caller returns from inside the lock WITHOUT `tx.save()`),
 * or a throw the guard's own catch composes into failed rows.
 *
 * A `member-failed` whose key is the ROOT records a subject only when the walk
 * also resolved dependencies. The cascade block then keeps those rolled-back
 * members visible; a root-only failure stays on the existing single-row path,
 * which classifies entity-shape errors and git-auth challenges.
 *
 * The cascade's rollback partials are appended to whatever the failing member's
 * OWN bridge-level ledger already captured; both are real undo failures and
 * neither may shadow the other.
 */
export function unwrapCascade<S extends Exclude<InstallCascadeResult, CascadeFailureArm>>(
  cascade: S | CascadeFailureArm,
  capture: InstallFailureCapture,
  rootKey: string,
  sink: CascadeFailureSink,
): S | undefined {
  if (cascade.kind === "marketplace-absent") {
    return undefined;
  }

  if (cascade.kind === "closure-failed") {
    sink.subject = { kind: "closure", failure: cascade.failure };
    throw cascadeFailureCause(sink.subject, rootKey);
  }

  // RESV-03: the constraint verdict is reached before any member becomes a
  // ledger phase, so this arm carries nothing to roll back -- it throws for the
  // same reason the closure arm does, into the same catch, which composes the
  // failed rows.
  if (cascade.kind === "constraint-failed") {
    sink.subject = { kind: "constraint", failure: cascade.failure };
    throw cascadeFailureCause(sink.subject, rootKey);
  }

  if (cascade.kind === "member-failed") {
    capture.rollbackPartials = [...capture.rollbackPartials, ...cascade.rollbackPartials];
    sink.mcpConfigNotices = cascade.mcpConfigNotices;
    if (cascade.key !== rootKey || cascade.unmaterialized.length > 0) {
      sink.subject = {
        kind: "member",
        key: cascade.key,
        error: cascade.error,
        ...(cascade.key === rootKey &&
          capture.version !== undefined && {
            version: capture.version,
          }),
        rollbackPartials: capture.rollbackPartials,
        unmaterialized: cascade.unmaterialized,
      };
    }

    throw cascade.error;
  }

  return cascade;
}
