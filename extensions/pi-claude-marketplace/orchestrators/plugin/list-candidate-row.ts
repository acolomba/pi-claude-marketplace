import { rowClaimsInstallDisabled } from "../../domain/unsupported-components.ts";
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";

import { resolveListCandidate } from "./list-candidate-version.ts";
import { classifyManifestEntry } from "./plugin-state-classifier.ts";

import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";
import type { ResolveContext, ResolvedPlugin } from "../../domain/resolver-types.ts";
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
  resolved: ResolvedPlugin,
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
  marketplaceContext: Pick<
    ResolveContext,
    "marketplaceRoot" | "marketplaceName" | "marketplaceSource"
  >,
  locations: ScopedLocations,
  declaredEnabled: boolean | undefined,
): Promise<CandidateRow> {
  const claimsInstallDisabled = rowClaimsInstallDisabled(manifestEntry, declaredEnabled);

  try {
    const outcome = await resolveListCandidate(manifestEntry, marketplaceContext, locations);
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
