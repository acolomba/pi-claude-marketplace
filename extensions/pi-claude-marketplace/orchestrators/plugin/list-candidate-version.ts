// orchestrators/plugin/list-candidate-version.ts
//
// The one version rule (VER-01, VER-02) for a manifest entry, resolved
// offline (NFR-5) through the fs-only presence probe, and shared by the
// not-installed and the installed list rows so both read one derivation.

import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { shaVersion } from "../../domain/version.ts";

import { makePresenceProbe } from "./git-source-probe.ts";
import { resolveDeclaredPluginVersion } from "./shared.ts";

import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
import type { ResolveContext, ResolvedPlugin } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/**
 * A manifest entry's offline resolution: `cold` for a git source with no
 * mirror, else the resolver verdict and, when the tree is materialized, the
 * version an install of it would record.
 */
export type ListCandidate =
  | { readonly kind: "cold" }
  | {
      readonly kind: "resolved";
      readonly resolved: ResolvedPlugin;
      /** VER-01 / VER-02: the declared version of the tree, which replaces the entry's. */
      readonly version?: string;
    };

type GitPluginSource = Parameters<ReturnType<typeof makePresenceProbe>>[0];

function isGitPluginSource(
  parsedSource: ReturnType<typeof parsePluginSource>,
): parsedSource is GitPluginSource {
  return (
    parsedSource.kind === "url" ||
    parsedSource.kind === "git-subdir" ||
    parsedSource.kind === "github"
  );
}

/** Resolves one manifest entry offline and derives its candidate version. */
export async function resolveListCandidate(
  manifestEntry: ManifestPluginEntry,
  marketplaceContext: Pick<ResolveContext, "marketplaceRoot" | "marketplaceName">,
  locations: ScopedLocations,
): Promise<ListCandidate> {
  const parsedSource = parsePluginSource(manifestEntry.source);
  if (!isGitPluginSource(parsedSource)) {
    const resolved = await resolveStrict(manifestEntry, marketplaceContext);
    if (resolved.state === "unavailable") {
      return { kind: "resolved", resolved };
    }

    // VER-02: a path source takes the declared version the same way.
    const version = await resolveDeclaredPluginVersion(manifestEntry, resolved.pluginRoot);
    return { kind: "resolved", resolved, ...(version !== undefined && { version }) };
  }

  const probe = makePresenceProbe(locations);
  const presence = await probe(parsedSource);
  if (presence.kind === "not-cached") {
    return { kind: "cold" };
  }

  const resolved = await resolveStrict(manifestEntry, {
    ...marketplaceContext,
    resolveGitPluginRoot: probe,
  });
  if (presence.kind !== "materialized") {
    return { kind: "resolved", resolved };
  }

  // VER-01: the version an install of the warm tree records -- the declared
  // version (plugin.json, then the entry), else its commit.
  const version =
    (await resolveDeclaredPluginVersion(manifestEntry, presence.pluginRoot)) ??
    shaVersion(presence.resolvedSha);
  return { kind: "resolved", resolved, version };
}
