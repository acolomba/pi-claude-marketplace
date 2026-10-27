// orchestrators/marketplace/hosted-catalog.ts
//
// D-PL5-06 / D-PL5-07: the files of a hosted marketplace, one catalog
// downloaded from an https URL. It is stored like a clone, so every reader of
// `sources/<name>/.claude-plugin/marketplace.json` works on it unchanged. A
// hosted tree has no `.git/`, so its ownership marker sits at the tree root
// and records the URL the catalog came from.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadMarketplaceManifestDocument } from "../../domain/manifest.ts";
import {
  catalogMarketplaceNameRefusal,
  reservedMarketplaceNameRefusal,
} from "../../domain/name.ts";
import { fetchHostedManifest } from "../../platform/hosted-manifest-fetch.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import {
  ReservedMarketplaceNameError,
  StaleSourceCloneError,
  UnreadableSourceCloneError,
  appendLeakToError,
} from "../../shared/errors.ts";
import { cleanupStaging, pathExists, type RemovalOps } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import type { HostedManifestSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";

/** D-PL5-07: downloads the catalog at a URL and returns its bytes. */
export type HostedManifestFetch = (url: string) => Promise<Uint8Array>;

/** D-PL5-07: the production download, `platform/hosted-manifest-fetch.ts`. */
export const DEFAULT_HOSTED_MANIFEST_FETCH: HostedManifestFetch = fetchHostedManifest;

// D-PL5-06: the hosted ownership marker. Its name and its place at the tree
// root are a user contract: renaming either makes every leftover written
// before the rename refuse as `{stale clone}`.
const HOSTED_MARKER_FILE = ".pi-claude-marketplace-hosted.json";
const GENERATED_BY = "pi-claude-marketplace";
const CATALOG_DIR = ".claude-plugin";
const CATALOG_FILE = "marketplace.json";

function hostedMarkerPath(dir: string): string {
  return path.join(dir, HOSTED_MARKER_FILE);
}

/**
 * D-PL5-06: downloads the catalog at `url` into `stagingDir`, as
 * `.claude-plugin/marketplace.json`, then writes the hosted ownership marker
 * beside it. Nothing is written before the bytes arrive. A plain write is
 * enough: the caller renames the whole staging tree into place (NFR-1).
 */
export async function downloadHostedCatalog(args: {
  readonly url: string;
  readonly stagingDir: string;
  readonly fetchCatalog: HostedManifestFetch;
}): Promise<void> {
  const { url, stagingDir } = args;
  const bytes = await args.fetchCatalog(url);
  const catalogDir = path.join(stagingDir, CATALOG_DIR);
  const catalogPath = path.join(catalogDir, CATALOG_FILE);
  await assertPathInside(stagingDir, catalogPath, "hosted marketplace catalog");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(catalogPath, bytes);
  const markerPath = hostedMarkerPath(stagingDir);
  await assertPathInside(stagingDir, markerPath, "hosted marketplace ownership marker");
  await atomicWriteJson(markerPath, { generatedBy: GENERATED_BY, url });
}

/**
 * D-PL5-09: downloads the catalog at the source's URL again and puts it in
 * place of the stored one at `manifestPath`. The bytes go to a fresh directory
 * under `sources-staging/`, on the filesystem of `sources/` (D-09), and are
 * read through the one manifest reader (NFR-8) before a rename replaces the
 * stored file. A catalog that now declares a reserved name is refused before
 * the rename (D-PL5-27), and so is one that declares a look-alike or one of
 * Claude Code's own names, judged against the record's `name` (D-PL5-28). A
 * failed download, an invalid or refused catalog, or a failed rename leaves
 * the stored file as it was, and a staging cleanup that leaks is appended to
 * the thrown error (MA-9).
 */
export async function refreshHostedCatalog(args: {
  readonly name: string;
  readonly source: HostedManifestSource;
  readonly manifestPath: string;
  readonly locations: ScopedLocations;
  readonly fetchCatalog: HostedManifestFetch;
  readonly removalOps: RemovalOps;
}): Promise<void> {
  const { name, source, manifestPath, locations, removalOps } = args;
  await assertPathInside(locations.sourcesDir, manifestPath, "hosted marketplace catalog");
  const bytes = await args.fetchCatalog(source.url);
  const stagingDir = await locations.sourcesStagingDir(randomUUID());
  const stagedPath = path.join(stagingDir, CATALOG_FILE);
  try {
    await mkdir(stagingDir, { recursive: true });
    await writeFile(stagedPath, bytes);
    const document = await loadMarketplaceManifestDocument(stagedPath);
    const refusal =
      catalogMarketplaceNameRefusal(document.manifest.name, name) ??
      reservedMarketplaceNameRefusal(document.manifest.name, source);
    if (refusal !== undefined) {
      throw new ReservedMarketplaceNameError(refusal);
    }

    await rename(stagedPath, manifestPath);
  } catch (err) {
    throw appendLeakToError(
      err,
      await cleanupStaging(removalOps, stagingDir, "marketplace catalog staging"),
    );
  }

  // The catalog is in place, so a staging directory left behind holds nothing
  // and does not fail the refresh.
  await cleanupStaging(removalOps, stagingDir, "marketplace catalog staging");
}

/** Whether `text` is the hosted ownership marker of a download of `url`. */
function marksDownloadOf(text: string, url: string): boolean {
  try {
    const marker: unknown = JSON.parse(text);
    return (
      typeof marker === "object" &&
      marker !== null &&
      Reflect.get(marker, "generatedBy") === GENERATED_BY &&
      Reflect.get(marker, "url") === url
    );
  } catch {
    // Text that is not JSON is not our marker.
    return false;
  }
}

/**
 * MA-12 / MA-13 for a hosted marketplace: removes `finalDir` when its hosted
 * ownership marker records a download of `url`, so the caller's rename can
 * proceed. Any other tree throws `StaleSourceCloneError`, and a marker that
 * cannot be read throws `UnreadableSourceCloneError`. Recognition is the only
 * authority for removal (D-3-02).
 *
 * The marker sits at the tree root, where a git repository can ship a file of
 * the same name. A download writes no `.git`, so a tree that has one is a
 * clone and stays.
 *
 * @returns the leak message from removing the leftover, or `undefined` when
 *   the removal left nothing behind or the destination no longer exists
 *   (IN-06).
 */
export async function recognizeHostedLeftover(args: {
  readonly finalDir: string;
  readonly derivedName: string;
  readonly url: string;
  readonly removalOps: RemovalOps;
}): Promise<string | undefined> {
  const { finalDir, derivedName, url, removalOps } = args;
  let text: string;
  try {
    text = await readFile(hostedMarkerPath(finalDir), "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" && !(await pathExists(finalDir))) {
      return undefined;
    }

    if (code === "ENOENT" || code === "ENOTDIR") {
      throw new StaleSourceCloneError(finalDir, derivedName);
    }

    const failure = code === "EACCES" || code === "EPERM" ? "permission-denied" : "unreadable";
    throw new UnreadableSourceCloneError(finalDir, derivedName, failure, { cause: err });
  }

  if (!marksDownloadOf(text, url) || (await pathExists(path.join(finalDir, ".git")))) {
    throw new StaleSourceCloneError(finalDir, derivedName);
  }

  return cleanupStaging(removalOps, finalDir, "marketplace leftover download");
}
