// bridges/mcp/builtin-description.ts
//
// ANAME-06: the plugin description Pi's built-in MCP shows for each of the
// plugin's servers, read at registration time because no record field holds
// it. The rule is the resolver's: the `description` of the plugin's own
// manifest, else the marketplace entry's, an empty string counting as absent
// at either site.
//
// MANF-01 / D-01-07: the plugin manifest is the first `MANIFEST_CANDIDATES`
// file present under the plugin root; when that file cannot be read or holds
// no usable description, the entry's description answers, never a later
// candidate. D-PL2-24: each candidate is located through the shared link
// containment of `domain/manifest-containment.ts`, inside the manifest
// boundary of the plugin's source. Every failure reads as absent, so the
// reader never throws and a missing description only drops the field.

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  isAbsenceError,
  locateManifestCandidate,
  sourceManifestBoundary,
} from "../../domain/manifest-containment.ts";
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { MANIFEST_CANDIDATES } from "../../domain/manifest-path.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { isErrnoException } from "../../shared/errors.ts";

import type { ManifestBoundary } from "../../domain/manifest-containment.ts";
import type { ManifestPluginEntry } from "../../domain/manifest-lookup.ts";

/** Where one installed plugin's description is read from. */
export interface BuiltinDescriptionSource {
  /** The cached `marketplace.json` of the marketplace that lists the plugin. */
  readonly manifestPath: string;
  readonly marketplaceRoot: string;
  readonly pluginName: string;
  /** The recorded plugin root, already checked for containment by the caller. */
  readonly pluginRoot: string;
  /** The recorded commit of a pinned or git source; absent for an in-place path source. */
  readonly pin: string | undefined;
}

/** What one manifest candidate says: not there, or there with its description. */
type CandidateRead = PresentCandidate | { readonly present: false };

interface PresentCandidate {
  readonly present: true;
  readonly description: string | undefined;
}

const NOT_THERE: CandidateRead = { present: false };
// A manifest that is there but cannot be read, parsed, or located inside the
// boundary describes nothing, and still ends the walk (D-01-07).
const UNUSABLE: CandidateRead = { present: true, description: undefined };

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

async function declaredEntry(
  source: BuiltinDescriptionSource,
): Promise<ManifestPluginEntry | undefined> {
  try {
    const lookup = lookupDeclaredPlugin(
      await loadMarketplaceManifest(source.manifestPath),
      source.pluginName,
    );
    return lookup.kind === "declared" ? lookup.entry : undefined;
  } catch {
    // An unreadable marketplace manifest leaves no entry to read from.
    return undefined;
  }
}

// D-01-06: a missing file, or a directory spelled as the candidate, is no manifest.
function isNoManifest(error: unknown): boolean {
  return isAbsenceError(error) || (isErrnoException(error) && error.code === "EISDIR");
}

async function openedCandidate(manifestPath: string): Promise<CandidateRead> {
  let text: string;
  try {
    text = await readFile(manifestPath, "utf8");
  } catch (error: unknown) {
    return isNoManifest(error) ? NOT_THERE : UNUSABLE;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return UNUSABLE;
  }

  return typeof parsed === "object" && parsed !== null && "description" in parsed
    ? { present: true, description: nonEmpty(parsed.description) }
    : UNUSABLE;
}

async function candidateRead(
  boundary: ManifestBoundary,
  candidate: string,
): Promise<CandidateRead> {
  const location = await locateManifestCandidate(
    boundary,
    path.join(boundary.pluginRoot, candidate),
  );
  if (location.kind === "open") {
    return openedCandidate(location.path);
  }

  // A link that leaves the boundary, or cannot be resolved, is a manifest
  // that cannot be used; a dangling link is none.
  return location.kind === "absent" ? NOT_THERE : UNUSABLE;
}

async function manifestDescription(boundary: ManifestBoundary): Promise<string | undefined> {
  const reads = await Promise.all(
    MANIFEST_CANDIDATES.map((candidate) => candidateRead(boundary, candidate)),
  );
  // D-01-07: the first candidate that is there is the plugin's manifest.
  return reads.find((read): read is PresentCandidate => read.present)?.description;
}

/**
 * ANAME-06: the description for one installed plugin's built-in MCP servers,
 * or `undefined` when neither the plugin manifest nor the marketplace entry
 * gives a non-empty one. Never throws.
 */
export async function readBuiltinServerDescription(
  source: BuiltinDescriptionSource,
): Promise<string | undefined> {
  const entry = await declaredEntry(source);
  // A plugin the manifest no longer lists has no source to read, so its
  // manifest is bounded by its plugin directory alone.
  const boundary = sourceManifestBoundary(
    entry?.source,
    source.pluginRoot,
    source.marketplaceRoot,
    source.pin,
  );
  return (await manifestDescription(boundary)) ?? nonEmpty(entry?.description);
}
