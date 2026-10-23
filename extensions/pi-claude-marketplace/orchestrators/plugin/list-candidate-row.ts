import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { rowClaimsInstallDisabled } from "../../domain/unsupported-components.ts";
import { shaVersion } from "../../domain/version.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";

import { makePresenceProbe } from "./git-source-probe.ts";
import { classifyManifestEntry } from "./plugin-state-classifier.ts";
import { resolveDeclaredPluginVersion } from "./shared.ts";

import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
import type { ResolveContext } from "../../domain/resolver-types.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ContentReason } from "../../shared/notification-types.ts";
import type {
  PluginAvailableMessage,
  PluginPartiallyAvailableMessage,
  PluginRemoteMessage,
  PluginUnavailableMessage,
} from "../../shared/notification-types.ts";

/** The resolver-state bucket consumed by plugin-list filtering. */
export type FilterBucket =
  "installed-inventory" | "available" | "partially-available" | "unavailable" | "remote";

/** The exact row and filter bucket produced for one not-installed candidate. */
export interface CandidateRow {
  readonly message:
    | PluginRemoteMessage
    | PluginAvailableMessage
    | PluginPartiallyAvailableMessage
    | PluginUnavailableMessage;
  readonly bucket: FilterBucket;
}

type ResolvedCandidate =
  | { readonly kind: "cold" }
  | {
      readonly kind: "resolved";
      readonly resolved: Awaited<ReturnType<typeof resolveStrict>>;
      /** VER-01: the version of a warm git tree, which replaces the entry's. */
      readonly version?: string;
    };

interface CandidateRowFields {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
}

function candidateRowFields(
  manifestEntry: ManifestPluginEntry,
  version: string | undefined = manifestEntry.version,
): CandidateRowFields {
  return {
    name: manifestEntry.name,
    ...(version !== undefined && { version }),
    ...(manifestEntry.description !== undefined && { description: manifestEntry.description }),
  };
}

function installsDisabledField(claimsInstallDisabled: boolean): {
  readonly reasons?: readonly ContentReason[];
} {
  return claimsInstallDisabled ? { reasons: ["installs disabled"] } : {};
}

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

async function resolveCandidateEntry(
  manifestEntry: ManifestPluginEntry,
  marketplaceContext: Pick<ResolveContext, "marketplaceRoot" | "marketplaceName">,
  locations: ScopedLocations,
): Promise<ResolvedCandidate> {
  const parsedSource = parsePluginSource(manifestEntry.source);
  if (!isGitPluginSource(parsedSource)) {
    return {
      kind: "resolved",
      resolved: await resolveStrict(manifestEntry, marketplaceContext),
    };
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

function partialCandidateReasons(
  unsupported: Parameters<typeof narrowUnsupportedKinds>[0],
  claimsInstallDisabled: boolean,
): ContentReason[] {
  return [
    ...narrowUnsupportedKinds(unsupported),
    ...(claimsInstallDisabled ? (["installs disabled"] as const) : []),
  ];
}

function resolvedCandidateRow(
  fields: CandidateRowFields,
  resolved: Awaited<ReturnType<typeof resolveStrict>>,
  claimsInstallDisabled: boolean,
): CandidateRow {
  const bucket = classifyManifestEntry(resolved);

  switch (resolved.state) {
    case "installable":
      return {
        message: {
          status: "available",
          ...fields,
          ...installsDisabledField(claimsInstallDisabled),
        },
        bucket,
      };
    case "partially-available":
      return {
        message: {
          status: "partially-available",
          ...fields,
          reasons: partialCandidateReasons(resolved.unsupported, claimsInstallDisabled),
        },
        bucket,
      };
    case "unavailable":
      return {
        message: {
          status: "unavailable",
          ...fields,
          reasons: narrowResolverNotes(resolved.notes),
        },
        bucket,
      };
  }
}

function probeFailureRow(manifestEntry: ManifestPluginEntry, probeErr: unknown): CandidateRow {
  return {
    message: {
      status: "unavailable",
      ...candidateRowFields(manifestEntry),
      reasons: [narrowProbeError(probeErr)],
    },
    bucket: "unavailable",
  };
}

/**
 * Composes one not-installed list row from local filesystem state only.
 *
 * Git sources with no cached clone remain `remote`; warm and path sources use
 * the resolver's exact three-way state. Probe failures become per-row reasons.
 */
export async function availableRowMessage(
  manifestEntry: ManifestPluginEntry,
  marketplaceContext: Pick<ResolveContext, "marketplaceRoot" | "marketplaceName">,
  locations: ScopedLocations,
  declaredEnabled: boolean | undefined,
): Promise<CandidateRow> {
  const claimsInstallDisabled = rowClaimsInstallDisabled(manifestEntry, declaredEnabled);

  try {
    const outcome = await resolveCandidateEntry(manifestEntry, marketplaceContext, locations);
    if (outcome.kind === "cold") {
      return {
        message: {
          status: "remote",
          ...candidateRowFields(manifestEntry),
          ...installsDisabledField(claimsInstallDisabled),
        },
        bucket: "remote",
      };
    }

    return resolvedCandidateRow(
      candidateRowFields(manifestEntry, outcome.version),
      outcome.resolved,
      claimsInstallDisabled,
    );
  } catch (probeErr) {
    return probeFailureRow(manifestEntry, probeErr);
  }
}
