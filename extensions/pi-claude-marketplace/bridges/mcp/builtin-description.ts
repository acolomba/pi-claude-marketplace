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
//
// ANAME-06 / T-02-18: a read or parse failure of the marketplace manifest, or
// of the plugin manifest candidate that decides the walk, leaves one
// `mcp`-channel debug line. The line never quotes the file: a parse failure is
// named by a fixed phrase, because the parser's message quotes the start of
// the text. A missing file leaves no line, a candidate after the deciding one
// is never traced, and a link that leaves the boundary is a refusal, not a
// failure (D-PL2-24). A manifest without a usable description is not a
// failure either.

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
import { hookDebugLog } from "../../shared/debug-log.ts";
import {
  errorMessage,
  InvalidMarketplaceManifestError,
  isErrnoException,
} from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

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
  /** Why the candidate could not be read, located, or parsed; `undefined` when it was. */
  readonly failure: string | undefined;
}

/** The candidate that decides the walk, with its `MANIFEST_CANDIDATES` entry. */
interface DecidingCandidate {
  readonly candidate: string;
  readonly read: PresentCandidate;
}

const NOT_THERE: CandidateRead = { present: false };
// A manifest that is there but has no usable description, or lies outside the
// boundary, describes nothing, and still ends the walk (D-01-07).
const UNUSABLE: CandidateRead = { present: true, description: undefined, failure: undefined };

const NOT_JSON = "the file is not valid JSON";

// A manifest that is there but cannot be read, located, or parsed describes
// nothing and ends the walk too; `reason` words its debug line.
function failed(reason: string): CandidateRead {
  return { present: true, description: undefined, failure: reason };
}

function traceUnread(pluginName: string, source: string, reason: string): void {
  hookDebugLog(
    redactAbsolutePaths(
      `MCP server description of ${pluginName} not read from ${source}: ${reason}`,
    ),
    "mcp",
  );
}

// `InvalidMarketplaceManifestError` embeds the parser's message, which can
// quote the file.
function marketplaceManifestFailure(error: unknown): string {
  return error instanceof InvalidMarketplaceManifestError
    ? "it is not a valid marketplace manifest"
    : errorMessage(error);
}

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
  } catch (error: unknown) {
    // An unreadable marketplace manifest leaves no entry to read from. A
    // missing one is no failure.
    if (!isAbsenceError(error)) {
      traceUnread(source.pluginName, "the marketplace manifest", marketplaceManifestFailure(error));
    }

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
    return isNoManifest(error) ? NOT_THERE : failed(errorMessage(error));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failed(NOT_JSON);
  }

  return typeof parsed === "object" && parsed !== null && "description" in parsed
    ? { present: true, description: nonEmpty(parsed.description), failure: undefined }
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
  // A link that leaves the boundary, or cannot be resolved, is a manifest
  // that cannot be used; a dangling link is none.
  switch (location.kind) {
    case "open":
      return openedCandidate(location.path);
    case "absent":
      return NOT_THERE;
    case "escapes":
      return UNUSABLE;
    case "unresolvable":
      return failed(errorMessage(location.error));
  }
}

async function manifestDescription(
  boundary: ManifestBoundary,
  pluginName: string,
): Promise<string | undefined> {
  const reads = await Promise.all(
    MANIFEST_CANDIDATES.map(async (candidate) => ({
      candidate,
      read: await candidateRead(boundary, candidate),
    })),
  );
  // D-01-07: the first candidate that is there is the plugin's manifest, and
  // only its failure is traced.
  const deciding = reads.find((entry): entry is DecidingCandidate => entry.read.present);
  if (deciding?.read.failure !== undefined) {
    traceUnread(pluginName, deciding.candidate, deciding.read.failure);
  }

  return deciding?.read.description;
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
  return (await manifestDescription(boundary, source.pluginName)) ?? nonEmpty(entry?.description);
}
