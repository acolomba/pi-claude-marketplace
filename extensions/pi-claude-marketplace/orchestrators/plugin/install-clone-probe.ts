import { canonicalCloneUrl } from "../../domain/clone-key.ts";
import { buildCloneAuth } from "../auth-host.ts";

import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitPluginRootWithSubdir,
  resolvePluginPin,
} from "./clone-cache.ts";

import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** Clone-cache operations used to materialize an install source. */
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

interface InstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly seam?: InstallCloneCacheSeam;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_INSTALL_CLONE_CACHE_SEAM: InstallCloneCacheSeam = {
  resolvePluginPin,
  materializePluginClone,
  materializeOrRefreshPluginMirror,
};

/**
 * Materializes one install source and classifies its clone-relative plugin root.
 *
 * A resolved sha is returned only with a materialized result. Missing or
 * escaping subdirectories cannot leak a stale sha into the install record, and
 * clone failures retain their original thrown value.
 */
export async function probeInstallClone(options: InstallCloneProbeOptions): Promise<{
  readonly result: GitPluginRootResult;
  readonly resolvedSha: string | undefined;
}> {
  const seam = options.seam ?? REAL_INSTALL_CLONE_CACHE_SEAM;
  const { source, locations } = options;
  const cloneUrl = canonicalCloneUrl(source);
  const auth = buildCloneAuth(cloneUrl, source.kind, options.auth);

  if (source.sha === undefined) {
    const materialized = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(source.ref !== undefined && { ref: source.ref }),
      ...(auth !== undefined && { auth }),
    });
    const result = await resolveGitPluginRootWithSubdir(
      source,
      materialized.pluginRoot,
      materialized.resolvedSha,
    );
    return {
      result,
      resolvedSha: result.kind === "materialized" ? materialized.resolvedSha : undefined,
    };
  }

  const pin = await seam.resolvePluginPin({ source });
  const cloneRoot = await seam.materializePluginClone({
    locations,
    cloneUrl: pin.cloneUrl,
    pin: pin.pin,
    ...(pin.ref !== undefined && { ref: pin.ref }),
    ...(auth !== undefined && { auth }),
  });
  const result = await resolveGitPluginRootWithSubdir(source, cloneRoot, pin.pin);
  return { result, resolvedSha: result.kind === "materialized" ? pin.pin : undefined };
}
