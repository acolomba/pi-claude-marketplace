import { canonicalCloneUrl, pluginMirrorKey } from "../../domain/clone-key.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { buildCloneAuth } from "../auth-host.ts";

import { materializePluginClone, resolveGitSubdirRoot } from "./clone-cache.ts";
import { readMirrorHeadSha } from "./git-source-probe.ts";

import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** Clone-cache operation used to materialize a reinstall source. */
export interface ReinstallCloneCacheSeam {
  readonly materializePluginClone: typeof materializePluginClone;
}

/** Inputs required to probe one reinstall source at its recorded sha. */
export interface ReinstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly recordedSha: string;
  readonly seam?: ReinstallCloneCacheSeam;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_REINSTALL_CLONE_CACHE_SEAM: ReinstallCloneCacheSeam = {
  materializePluginClone,
};

/**
 * Probes one reinstall source from a warm mirror or its recorded-sha clone.
 *
 * Unpinned sources prefer the existing mirror and read its HEAD without
 * network access. Missing mirrors fall back to the recorded-sha clone path;
 * clone and subdirectory failures retain their original classification.
 */
export async function probeReinstallClone(
  options: ReinstallCloneProbeOptions,
): Promise<GitPluginRootResult> {
  const seam = options.seam ?? REAL_REINSTALL_CLONE_CACHE_SEAM;
  const { source, locations, recordedSha } = options;
  const cloneUrl = canonicalCloneUrl(source);

  if (source.sha === undefined) {
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
    if (await pathExists(mirrorRoot)) {
      const mirrorSha = await readMirrorHeadSha(mirrorRoot);
      if (source.kind === "git-subdir") {
        return resolveSubdir(source.path, mirrorRoot, mirrorSha);
      }

      return { kind: "materialized", pluginRoot: mirrorRoot, resolvedSha: mirrorSha };
    }
  }

  const auth = buildCloneAuth(cloneUrl, source.kind, options.auth);
  const cloneRoot = await seam.materializePluginClone({
    locations,
    cloneUrl,
    pin: recordedSha,
    ...(auth !== undefined && { auth }),
  });
  if (source.kind === "git-subdir") {
    return resolveSubdir(source.path, cloneRoot, recordedSha);
  }

  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: recordedSha };
}

async function resolveSubdir(
  subdirPath: string,
  cloneRoot: string,
  resolvedSha: string,
): Promise<GitPluginRootResult> {
  const subdirResult = await resolveGitSubdirRoot(cloneRoot, subdirPath);
  if (subdirResult.kind !== "materialized") {
    return subdirResult;
  }

  return {
    kind: "materialized",
    pluginRoot: subdirResult.pluginRoot,
    resolvedSha,
  };
}
