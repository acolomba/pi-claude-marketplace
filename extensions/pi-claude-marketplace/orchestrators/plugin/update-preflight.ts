import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import {
  requireInstallable,
  requirePartialInstallable,
  resolveStrict,
} from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { shaVersion } from "../../domain/version.ts";
import { isRecordedButDisabled, loadState } from "../../persistence/state-io.ts";
import { errorMessage, PluginShapeError } from "../../shared/errors.ts";
import { classifyGitTransportFailure } from "../../shared/git-failure-classifiers.ts";
import { narrowUnsupportedKinds } from "../../shared/probe-classifiers.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";
import { DEFAULT_CREDENTIAL_OPS, buildAuthForHost, hostFromCloneUrl } from "../auth-host.ts";

import {
  canonicalCloneUrl,
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitSubdirRoot,
  resolvePluginPin,
} from "./clone-cache.ts";
import { resolvePluginVersion } from "./shared.ts";

import type { PluginEntry } from "../../domain/components/plugin.ts";
import type { GitPluginRootResult, MaterializablePlugin } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { NotificationContext, ToolInventory } from "../../platform/pi-api.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { GitOps } from "../marketplace/shared.ts";
import type {
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
  PluginUpdateUnchangedOutcome,
} from "../types.ts";

/** Target selected by the three public plugin-update invocation forms. */
export type UpdatePluginsTarget =
  | { readonly kind: "all" }
  | { readonly kind: "marketplace"; readonly marketplace: string }
  | { readonly kind: "plugin"; readonly plugin: string; readonly marketplace: string };

/** Clone-cache operations used while probing one update candidate. */
export interface UpdateCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

/** Direct update request validated and classified by the update flow. */
export interface UpdatePluginsOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly target: UpdatePluginsTarget;
  readonly gitOps?: GitOps;
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  readonly mapModel?: boolean;
  readonly local?: boolean;
  readonly partial?: boolean;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
}

/** Candidate state required by the staged update swap. */
export interface PreparedPluginUpdate {
  readonly state: ExtensionState;
  readonly record: ExtensionState["marketplaces"][string]["plugins"][string];
  readonly entry: PluginEntry;
  readonly installable: MaterializablePlugin;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly resolvedSha?: string;
}

/** Inputs required to classify and prepare one installed plugin update. */
export interface PreparePluginUpdateOptions {
  readonly plugin: string;
  readonly marketplace: string;
  readonly scope: Scope;
  readonly locations: ScopedLocations;
  readonly partial?: boolean;
  readonly ctx?: NotificationContext;
  readonly cloneCacheSeam?: UpdateCloneCacheSeam;
  readonly credentialOps?: CredentialOps;
  readonly deviceFlowHttp?: DeviceFlowHttp;
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly cleanupClones: (locations: ScopedLocations) => Promise<unknown>;
}

type PluginStateRecord = PreparedPluginUpdate["record"];

type PartialableUpdateShapeError = PluginShapeError & {
  readonly shape: PluginShapeError["shape"] & {
    readonly kind: "no-longer-installable";
    readonly partialable: true;
    readonly unsupportedKinds: readonly string[];
  };
};

interface UpdateCloneProbe {
  readonly probe: (source: GitBackedSource) => Promise<GitPluginRootResult>;
  readonly resolvedSha: () => string | undefined;
}

function makeUpdateCloneProbe(
  seam: UpdateCloneCacheSeam,
  locations: ScopedLocations,
  auth: {
    readonly ctx?: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  },
): UpdateCloneProbe {
  let captured: string | undefined;

  const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
    if (auth.ctx === undefined) {
      return undefined;
    }

    return buildAuthForHost({
      host: hostFromCloneUrl(cloneUrl, gitSource.kind),
      credentialOps: auth.credentialOps,
      ctx: auth.ctx,
      ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
      ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
    });
  };

  async function probeUnpinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    const cloneUrl = canonicalCloneUrl(gitSource);
    const authBundle = buildBundle(gitSource, cloneUrl);
    const materialized = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(gitSource.ref !== undefined && { ref: gitSource.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    if (gitSource.kind === "git-subdir") {
      const subdir = await resolveGitSubdirRoot(materialized.pluginRoot, gitSource.path);
      if (subdir.kind !== "materialized") {
        return subdir;
      }

      captured = materialized.resolvedSha;
      return { ...subdir, resolvedSha: materialized.resolvedSha };
    }

    captured = materialized.resolvedSha;
    return {
      kind: "materialized",
      pluginRoot: materialized.pluginRoot,
      resolvedSha: materialized.resolvedSha,
    };
  }

  async function probePinned(gitSource: GitBackedSource): Promise<GitPluginRootResult> {
    const authBundle = buildBundle(gitSource, canonicalCloneUrl(gitSource));
    const pin = await seam.resolvePluginPin({
      source: gitSource,
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    const cloneRoot = await seam.materializePluginClone({
      locations,
      cloneUrl: pin.cloneUrl,
      pin: pin.pin,
      ...(pin.ref !== undefined && { ref: pin.ref }),
      ...(authBundle !== undefined && { auth: authBundle }),
    });
    if (gitSource.kind === "git-subdir") {
      const subdir = await resolveGitSubdirRoot(cloneRoot, gitSource.path);
      if (subdir.kind !== "materialized") {
        return subdir;
      }

      captured = pin.pin;
      return { ...subdir, resolvedSha: pin.pin };
    }

    captured = pin.pin;
    return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: pin.pin };
  }

  return {
    probe: (source) => (source.sha === undefined ? probeUnpinned(source) : probePinned(source)),
    resolvedSha: () => captured,
  };
}

async function deriveUpdateToVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  resolvedSha: string | undefined,
): Promise<string> {
  const kind = parsePluginSource(entry.source).kind;
  if ((kind === "url" || kind === "git-subdir" || kind === "github") && resolvedSha !== undefined) {
    return shaVersion(resolvedSha);
  }

  return resolvePluginVersion(entry, installable);
}

function isPartialableUpdateShapeError(error: unknown): error is PartialableUpdateShapeError {
  return (
    error instanceof PluginShapeError &&
    error.shape.kind === "no-longer-installable" &&
    error.shape.partialable
  );
}

async function resolveUpdateCandidate(
  entry: PluginEntry,
  marketplaceRoot: string,
  resolveGitPluginRoot: (source: GitBackedSource) => Promise<GitPluginRootResult>,
  options: { readonly plugin: string; readonly fromVersion: string; readonly partial: boolean },
): Promise<MaterializablePlugin | PluginUpdateSkippedOutcome> {
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot, resolveGitPluginRoot });
    if (options.partial) {
      requirePartialInstallable(resolved, "update");
    } else {
      requireInstallable(resolved, "update");
    }

    return resolved;
  } catch (error: unknown) {
    const networkReason = classifyGitTransportFailure(error);
    if (networkReason !== undefined) {
      return skippedCandidate(options, [errorMessage(error)], [networkReason]);
    }

    if (isPartialableUpdateShapeError(error)) {
      return {
        ...skippedCandidate(
          options,
          [errorMessage(error)],
          narrowUnsupportedKinds(error.shape.unsupportedKinds),
        ),
        partialUpgradable: true,
      };
    }

    return skippedCandidate(options, [errorMessage(error)], ["no longer installable"]);
  }
}

function skippedCandidate(
  options: { readonly plugin: string; readonly fromVersion: string },
  notes: readonly string[],
  reasons: readonly ContentReason[],
): PluginUpdateSkippedOutcome {
  return {
    partition: "skipped",
    name: options.plugin,
    fromVersion: options.fromVersion,
    notes: [...notes],
    reasons: [...reasons],
    declaresAgents: false,
    declaresMcp: false,
  };
}

function staticPreflightRow(options: {
  readonly partition: "failed" | "skipped";
  readonly plugin: string;
  readonly notes: readonly string[];
  readonly reason: ContentReason;
  readonly fromVersion?: string;
}): PluginUpdateOutcome {
  return {
    partition: options.partition,
    name: options.plugin,
    ...(options.fromVersion !== undefined && { fromVersion: options.fromVersion }),
    notes: [...options.notes],
    reasons: [options.reason],
    declaresAgents: false,
    declaresMcp: false,
  };
}

function triageUpdateMembership(
  plugin: string,
  record: PluginStateRecord | undefined,
  lookup: ReturnType<typeof lookupDeclaredPlugin>,
): PluginUpdateOutcome | { readonly record: PluginStateRecord; readonly entry: PluginEntry } {
  if (record === undefined) {
    return lookup.kind === "absent"
      ? staticPreflightRow({
          partition: "failed",
          plugin,
          notes: ["not in manifest"],
          reason: "not in manifest",
        })
      : staticPreflightRow({
          partition: "skipped",
          plugin,
          notes: ["not installed"],
          reason: "not installed",
        });
  }

  if (lookup.kind === "absent") {
    return staticPreflightRow({
      partition: "skipped",
      plugin,
      notes: ["not in manifest"],
      reason: "not in manifest",
      fromVersion: record.version,
    });
  }

  return { record, entry: lookup.entry };
}

function widensPartialGate(record: PluginStateRecord): boolean {
  return isRecordedButDisabled(record) && !record.compatibility.installable;
}

function disabledPinProjection(
  version: string,
  resolvedSource: string,
  resolvedSha: string | undefined,
  compatibility: PluginStateRecord["compatibility"],
): string {
  return JSON.stringify([
    version,
    resolvedSource,
    resolvedSha ?? null,
    compatibility.installable,
    [...compatibility.notes],
    [...compatibility.supported],
    [...compatibility.unsupported],
  ]);
}

function nextDisabledPin(
  preflight: PreparedPluginUpdate,
  shaFallback: string | undefined,
): { readonly compatibility: PluginStateRecord["compatibility"]; readonly projection: string } {
  const compatibility = {
    installable: preflight.installable.state === "installable",
    notes: [...preflight.installable.notes],
    supported: [...preflight.installable.supported],
    unsupported: [...preflight.installable.unsupported],
  };
  return {
    compatibility,
    projection: disabledPinProjection(
      preflight.toVersion,
      preflight.installable.pluginRoot,
      preflight.resolvedSha ?? shaFallback,
      compatibility,
    ),
  };
}

function disabledRefreshWouldWrite(preflight: PreparedPluginUpdate): boolean {
  const next = nextDisabledPin(preflight, preflight.record.resolvedSha);
  const current = disabledPinProjection(
    preflight.record.version,
    preflight.record.resolvedSource,
    preflight.record.resolvedSha,
    preflight.record.compatibility,
  );
  return next.projection !== current;
}

async function refreshDisabledRecord(
  options: PreparePluginUpdateOptions,
  preflight: PreparedPluginUpdate,
): Promise<boolean> {
  return withLockedStateTransaction(options.locations, async (transaction) => {
    const record = transaction.state.marketplaces[options.marketplace]?.plugins[options.plugin];
    if (record === undefined) {
      return false;
    }

    const next = nextDisabledPin(preflight, record.resolvedSha);
    const current = disabledPinProjection(
      record.version,
      record.resolvedSource,
      record.resolvedSha,
      record.compatibility,
    );
    if (next.projection === current) {
      return false;
    }

    record.version = preflight.toVersion;
    record.resolvedSource = preflight.installable.pluginRoot;
    if (preflight.resolvedSha !== undefined) {
      record.resolvedSha = preflight.resolvedSha;
    }

    record.compatibility = next.compatibility;
    record.updatedAt = new Date().toISOString();
    await transaction.save();
    return true;
  });
}

async function refreshDisabledPluginUpdate(
  options: PreparePluginUpdateOptions,
  preflight: PreparedPluginUpdate,
): Promise<PluginUpdateSkippedOutcome | PluginUpdateUnchangedOutcome> {
  const wrote = disabledRefreshWouldWrite(preflight)
    ? await refreshDisabledRecord(options, preflight)
    : false;
  if (wrote && preflight.resolvedSha !== undefined) {
    try {
      await options.cleanupClones(options.locations);
    } catch {
      // Clone cleanup is hygienic and retries on a later lifecycle operation.
    }
  }

  if (preflight.toVersion === preflight.fromVersion) {
    return {
      partition: "unchanged",
      name: options.plugin,
      fromVersion: preflight.fromVersion,
      toVersion: preflight.toVersion,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  return {
    partition: "skipped",
    name: options.plugin,
    notes: [],
    reasons: ["already disabled"],
    declaresAgents: false,
    declaresMcp: false,
  };
}

/** Resolves, validates, and classifies one plugin before any staged replacement. */
export async function preparePluginUpdate(
  options: PreparePluginUpdateOptions,
): Promise<PreparedPluginUpdate | PluginUpdateOutcome> {
  const state = await loadState(options.locations.extensionRoot);
  const marketplace = state.marketplaces[options.marketplace];
  if (marketplace === undefined) {
    return staticPreflightRow({
      partition: "skipped",
      plugin: options.plugin,
      notes: [`marketplace "${options.marketplace}" not found in ${options.scope} scope`],
      reason: "not in manifest",
    });
  }

  const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
  const triaged = triageUpdateMembership(
    options.plugin,
    marketplace.plugins[options.plugin],
    lookupDeclaredPlugin(manifest, options.plugin),
  );
  if ("partition" in triaged) {
    return triaged;
  }

  const clone = makeUpdateCloneProbe(
    options.cloneCacheSeam ?? {
      resolvePluginPin,
      materializePluginClone,
      materializeOrRefreshPluginMirror,
    },
    options.locations,
    {
      ...(options.ctx !== undefined && { ctx: options.ctx }),
      credentialOps: options.credentialOps ?? DEFAULT_CREDENTIAL_OPS,
      ...(options.deviceFlowHttp !== undefined && { deviceFlowHttp: options.deviceFlowHttp }),
      ...(options.authMemo !== undefined && { authMemo: options.authMemo }),
    },
  );
  const candidate = await resolveUpdateCandidate(
    triaged.entry,
    marketplace.marketplaceRoot,
    clone.probe,
    {
      plugin: options.plugin,
      fromVersion: triaged.record.version,
      partial: options.partial === true || widensPartialGate(triaged.record),
    },
  );
  if ("partition" in candidate) {
    return candidate;
  }

  const resolvedSha = clone.resolvedSha();
  const toVersion = await deriveUpdateToVersion(triaged.entry, candidate, resolvedSha);
  if (toVersion === triaged.record.version && !isRecordedButDisabled(triaged.record)) {
    return {
      partition: "unchanged",
      name: options.plugin,
      fromVersion: triaged.record.version,
      toVersion,
      declaresAgents: false,
      declaresMcp: false,
    };
  }

  const prepared: PreparedPluginUpdate = {
    state,
    record: triaged.record,
    entry: triaged.entry,
    installable: candidate,
    fromVersion: triaged.record.version,
    toVersion,
    ...(resolvedSha !== undefined && { resolvedSha }),
  };
  return isRecordedButDisabled(triaged.record)
    ? refreshDisabledPluginUpdate(options, prepared)
    : prepared;
}
