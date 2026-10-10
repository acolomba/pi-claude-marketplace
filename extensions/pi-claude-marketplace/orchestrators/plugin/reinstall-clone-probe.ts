import { canonicalCloneUrl, networkCloneUrl, pluginMirrorKey } from "../../domain/clone-key.ts";
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
 * Unpinned sources prefer a mirror whose HEAD reads without network access.
 * A missing mirror, or one whose HEAD cannot be read, falls back to the
 * recorded-sha clone. A reinstall re-clones that sha on a cache miss, so a
 * retry is safe (D-08-05, NFR-3, NFR-5). Clone and subdirectory failures
 * retain their original classification.
 */
export async function probeReinstallClone(
  options: ReinstallCloneProbeOptions,
): Promise<GitPluginRootResult> {
  const seam = options.seam ?? REAL_REINSTALL_CLONE_CACHE_SEAM;
  const { source, locations, recordedSha } = options;
  const cloneUrl = canonicalCloneUrl(source);

  if (source.sha === undefined) {
    const mirrorRoot = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
    const mirrorSha = await readUsableMirrorSha(mirrorRoot);
    if (mirrorSha !== undefined) {
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
    networkUrl: networkCloneUrl(source),
    pin: recordedSha,
    auth,
  });
  if (source.kind === "git-subdir") {
    return resolveSubdir(source.path, cloneRoot, recordedSha);
  }

  return { kind: "materialized", pluginRoot: cloneRoot, resolvedSha: recordedSha };
}

async function readUsableMirrorSha(mirrorRoot: string): Promise<string | undefined> {
  if (!(await pathExists(mirrorRoot))) {
    return undefined;
  }

  try {
    return await readMirrorHeadSha(mirrorRoot);
  } catch {
    return undefined;
  }
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
