import { resolveStrict } from "../../domain/plugin-resolver.ts";
import { parsePluginSource } from "../../domain/source.ts";
import { rowClaimsInstallDisabled } from "../../domain/unsupported-components.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";

import { makePresenceProbe } from "./git-source-probe.ts";
import { classifyManifestEntry } from "./plugin-state-classifier.ts";

import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
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
  | { readonly kind: "resolved"; readonly resolved: Awaited<ReturnType<typeof resolveStrict>> };

function candidateRowFields(manifestEntry: ManifestPluginEntry): {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
} {
  return {
    name: manifestEntry.name,
    ...(manifestEntry.version !== undefined && { version: manifestEntry.version }),
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
  marketplaceRoot: string,
  locations: ScopedLocations,
): Promise<ResolvedCandidate> {
  const parsedSource = parsePluginSource(manifestEntry.source);
  if (!isGitPluginSource(parsedSource)) {
    return { kind: "resolved", resolved: await resolveStrict(manifestEntry, { marketplaceRoot }) };
  }

  const probe = makePresenceProbe(locations);
  const presence = await probe(parsedSource);
  if (presence.kind === "not-cached") {
    return { kind: "cold" };
  }

  return {
    kind: "resolved",
    resolved: await resolveStrict(manifestEntry, {
      marketplaceRoot,
      resolveGitPluginRoot: probe,
    }),
  };
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
  manifestEntry: ManifestPluginEntry,
  resolved: Awaited<ReturnType<typeof resolveStrict>>,
  claimsInstallDisabled: boolean,
): CandidateRow {
  const bucket = classifyManifestEntry(resolved);

  switch (resolved.state) {
    case "installable":
      return {
        message: {
          status: "available",
          ...candidateRowFields(manifestEntry),
          ...installsDisabledField(claimsInstallDisabled),
        },
        bucket,
      };
    case "partially-available":
      return {
        message: {
          status: "partially-available",
          ...candidateRowFields(manifestEntry),
          reasons: partialCandidateReasons(resolved.unsupported, claimsInstallDisabled),
        },
        bucket,
      };
    case "unavailable":
      return {
        message: {
          status: "unavailable",
          ...candidateRowFields(manifestEntry),
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
  marketplaceRoot: string,
  locations: ScopedLocations,
  declaredEnabled: boolean | undefined,
): Promise<CandidateRow> {
  const claimsInstallDisabled = rowClaimsInstallDisabled(manifestEntry, declaredEnabled);

  try {
    const outcome = await resolveCandidateEntry(manifestEntry, marketplaceRoot, locations);
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

    return resolvedCandidateRow(manifestEntry, outcome.resolved, claimsInstallDisabled);
  } catch (probeErr) {
    return probeFailureRow(manifestEntry, probeErr);
  }
}
