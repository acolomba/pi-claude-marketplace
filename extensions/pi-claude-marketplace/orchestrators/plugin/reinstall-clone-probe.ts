import { canonicalCloneUrl, networkCloneUrl } from "../../domain/clone-key.ts";
import { buildCloneAuth } from "../auth-host.ts";

import { materializePluginCommitCopy, resolveGitSubdirRoot } from "./clone-cache.ts";

import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** Clone-cache operation used to materialize a reinstall source. */
export interface ReinstallCloneCacheSeam {
  readonly materializePluginCommitCopy: typeof materializePluginCommitCopy;
}

/** Inputs required to probe one reinstall source at its recorded sha. */
export interface ReinstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly recordedSha: string;
  readonly seam?: ReinstallCloneCacheSeam;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_REINSTALL_CLONE_CACHE_SEAM: ReinstallCloneCacheSeam = {
  materializePluginCommitCopy,
};

/**
 * Probes one reinstall source at its recorded sha (PURL-07, GIT-01).
 *
 * The reinstall restores the per-commit copy the record names: the copy
 * itself when present, else a copy of the mirror at that sha, else a clone of
 * that sha, so a retry is safe (D-08-05, NFR-3, NFR-5). A mirror a `fetch`
 * moved past the recorded sha never replaces the recorded commit. Clone and
 * subdirectory failures retain their original classification.
 */
export async function probeReinstallClone(
  options: ReinstallCloneProbeOptions,
): Promise<GitPluginRootResult> {
  const seam = options.seam ?? REAL_REINSTALL_CLONE_CACHE_SEAM;
  const { source, locations, recordedSha } = options;
  const cloneUrl = canonicalCloneUrl(source);

  const cloneRoot = await seam.materializePluginCommitCopy({
    locations,
    cloneUrl,
    networkUrl: networkCloneUrl(source),
    sha: recordedSha,
    resolveAuth: () => buildCloneAuth(cloneUrl, source.kind, options.auth),
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
