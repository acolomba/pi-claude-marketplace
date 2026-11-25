import { canonicalCloneUrl, networkCloneUrl } from "../../domain/clone-key.ts";
import { buildCloneAuth } from "../auth-host.ts";
import { pluginCloneTransport } from "../github-transport.ts";
import { defaultPluginTransportContext } from "../marketplace/shared.ts";

import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  materializePluginCommitCopy,
  materializeUnpinnedSource,
  resolveGitPluginRootWithSubdir,
  resolvePluginPin,
} from "./clone-cache.ts";

import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";
import type { CloneTransport, PluginTransportContext } from "../github-transport.ts";

/** Clone-cache operations used to materialize an install source. */
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
  readonly materializePluginCommitCopy: typeof materializePluginCommitCopy;
}

/** Inputs required to materialize and classify one install clone. */
export interface InstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly seam?: InstallCloneCacheSeam;
  readonly cloneCandidates?: Set<string>;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly run: NotificationRun;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
  /**
   * D-SG-18: the command's transport context, whose checks and notes every
   * clone of the command shares. Omitted, the call makes one of its own, so
   * the clone still follows the install's checks. Every command root passes
   * one, so only a direct caller of the guard-free ledger omits it.
   */
  readonly transportContext?: PluginTransportContext;
  /** D-SG-22: the subject of the row that reports the clone, `<plugin>@<marketplace>`. */
  readonly subject: string;
}

const REAL_INSTALL_CLONE_CACHE_SEAM: InstallCloneCacheSeam = {
  resolvePluginPin,
  materializePluginClone,
  materializeOrRefreshPluginMirror,
  materializePluginCommitCopy,
};

/**
 * D-SG-18, D-SG-19: the clone transport of one install source. The plan
 * reads the context's force, its checks, and its platform (SG-SSH-05), and
 * the note goes to its notes. With no context, the call makes one, so no
 * clone stays on SSH for want of a context.
 */
function installCloneTransport(options: InstallCloneProbeOptions): CloneTransport {
  return pluginCloneTransport(
    options.transportContext ?? defaultPluginTransportContext(),
    options.source,
    options.subject,
  );
}

/**
 * Materializes one install source and classifies its clone-relative plugin root.
 *
 * A resolved sha is returned only with a materialized result. Missing or
 * escaping subdirectories cannot leak a stale sha into the install record, and
 * clone failures retain their original thrown value. D-SG-18: every clone the
 * source needs runs over the transport `installCloneTransport` plans.
 */
export async function probeInstallClone(options: InstallCloneProbeOptions): Promise<{
  readonly result: GitPluginRootResult;
  readonly resolvedSha: string | undefined;
}> {
  const seam = options.seam ?? REAL_INSTALL_CLONE_CACHE_SEAM;
  const { source, locations } = options;
  const cloneUrl = canonicalCloneUrl(source);
  const onCloneCreated = (key: string): void => {
    options.cloneCandidates?.add(key);
  };

  const transport = installCloneTransport(options);

  if (source.sha === undefined) {
    // GIT-01 / GIT-04: install already holds the scope's state lock, so the
    // mirror step and the copy run under it (GIT-03).
    const result = await materializeUnpinnedSource(seam, {
      locations,
      source,
      auth: buildCloneAuth(cloneUrl, source.kind, options.auth),
      onCloneCreated,
      transport,
    });
    return {
      result,
      resolvedSha: result.kind === "materialized" ? result.resolvedSha : undefined,
    };
  }

  const pin = await seam.resolvePluginPin({ source });
  const cloneRoot = await seam.materializePluginClone({
    locations,
    cloneUrl: pin.cloneUrl,
    networkUrl: networkCloneUrl(source),
    pin: pin.pin,
    ...(pin.ref !== undefined && { ref: pin.ref }),
    resolveAuth: () => buildCloneAuth(cloneUrl, source.kind, options.auth),
    onCloneCreated,
    transport,
  });
  const result = await resolveGitPluginRootWithSubdir(source, cloneRoot, pin.pin);
  return { result, resolvedSha: result.kind === "materialized" ? pin.pin : undefined };
}
