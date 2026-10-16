/**
 * @fileoverview A marketplace published as one source kind.
 *
 * The dir and file kinds write the path fixture under the sandbox HOME
 * (D-04). The url and github kinds land with their stand-ins, so the steps
 * that publish a marketplace do not change when they do.
 */

import path from "node:path";

import {
  writeInvalidManifest,
  writeMalformedManifest,
  writeMarketplace,
} from "./path-marketplace.ts";

import type { OfferedPlugin } from "./path-marketplace.ts";

/** A kind of source a marketplace is published as. */
export type SourceKind = "dir" | "file" | "url" | "github";

const SOURCE_KINDS: readonly SourceKind[] = ["dir", "file", "url", "github"];

/**
 * A way a manifest is broken: JSON that does not parse, or JSON that breaks
 * the manifest schema.
 */
export type ManifestProblem = "malformed" | "schema-invalid";

const MANIFEST_WRITERS: Readonly<
  Record<ManifestProblem, (root: string, name: string) => Promise<void>>
> = {
  malformed: writeMalformedManifest,
  "schema-invalid": writeInvalidManifest,
};

/**
 * A published marketplace: its kind, the directory it is published in, and
 * the source a user types to add it.
 */
export interface PublishedMarketplace {
  readonly kind: SourceKind;
  readonly root: string;
  readonly source: string;
}

/** Returns the source kind `text` names, throwing on any other text. */
export function parseSourceKind(text: string): SourceKind {
  const kind = SOURCE_KINDS.find((candidate) => candidate === text);
  if (kind === undefined) {
    throw new Error(`unknown source kind "${text}"; expected one of ${SOURCE_KINDS.join(", ")}`);
  }

  return kind;
}

function noStandIn(kind: SourceKind): Error {
  return new Error(`the ${kind} source kind has no stand-in yet`);
}

/**
 * Publishes the marketplace `name` under `marketplacesRoot` as a `kind`
 * source offering `plugins`, in a directory of its own name. A file source is
 * the manifest inside `.claude-plugin/` (D-04).
 */
export function publishMarketplace(
  marketplacesRoot: string,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  return publishMarketplaceIn(marketplacesRoot, name, name, kind, plugins);
}

/**
 * Publishes a marketplace whose manifest declares `name` in the directory
 * `directory` under `marketplacesRoot`, as a `kind` source offering
 * `plugins`. For a git kind, `directory` is the repository its stand-in
 * serves (D-01, D-04).
 */
export async function publishMarketplaceIn(
  marketplacesRoot: string,
  directory: string,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  const root = path.join(marketplacesRoot, directory);
  switch (kind) {
    case "dir":
      await writeMarketplace(root, name, plugins);
      return { kind, root, source: root };
    case "file":
      await writeMarketplace(root, name, plugins);
      return { kind, root, source: path.join(root, ".claude-plugin", "marketplace.json") };
    case "url":
    case "github":
      throw noStandIn(kind);
  }
}

/**
 * Breaks the manifest of the marketplace `name` in the directory `published`
 * records, with `problem`: JSON that does not parse, or JSON that breaks the
 * manifest schema (D-04).
 */
export async function invalidateManifest(
  name: string,
  published: PublishedMarketplace,
  problem: ManifestProblem,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await MANIFEST_WRITERS[problem](published.root, name);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}
