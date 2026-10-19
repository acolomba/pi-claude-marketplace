/**
 * @fileoverview A marketplace published as one source kind.
 *
 * The dir and file kinds write the path fixture under the sandbox HOME
 * (D-04). The url and github kinds land with their stand-ins, so the steps
 * that publish a marketplace do not change when they do.
 */

import assert from "node:assert/strict";
import { rm, stat } from "node:fs/promises";
import path from "node:path";

import {
  writeDependencyAllowance,
  writeInvalidManifest,
  writeMalformedManifest,
  writeManifestText,
  writeMarketplace,
  writeMarketplaceDescription,
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
  Record<ManifestProblem, (manifestFile: string, name: string) => Promise<void>>
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
  readonly manifestPath: string;
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
 * Returns the directory that a `kind` marketplace published in `directory`
 * under `marketplacesRoot` lives in, failing when a marketplace is published
 * there already. The url and github kinds throw until they have a stand-in.
 */
export async function requireFreeRoot(
  marketplacesRoot: string,
  directory: string,
  kind: SourceKind,
): Promise<string> {
  switch (kind) {
    case "dir":
    case "file": {
      const root = path.join(marketplacesRoot, directory);
      await assert.rejects(
        stat(root),
        { code: "ENOENT" },
        `${directory} already holds a marketplace`,
      );
      return root;
    }

    case "url":
    case "github":
      throw noStandIn(kind);
  }
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
 * serves (ADD-04).
 */
export async function publishMarketplaceIn(
  marketplacesRoot: string,
  directory: string,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  const root = path.join(marketplacesRoot, directory);
  const manifestPath = path.join(root, ".claude-plugin", "marketplace.json");
  switch (kind) {
    case "dir":
      await writeMarketplace(root, name, plugins, manifestPath);
      return { kind, root, source: root, manifestPath };
    case "file":
      await writeMarketplace(root, name, plugins, manifestPath);
      return { kind, root, source: manifestPath, manifestPath };
    case "url":
    case "github":
      throw noStandIn(kind);
  }
}

/** Publishes a file source outside the conventional manifest directory. */
export async function publishExternalMarketplace(
  marketplacesRoot: string,
  name: string,
): Promise<PublishedMarketplace> {
  const root = path.join(marketplacesRoot, name);
  const manifestPath = path.join(root, "catalog", "marketplace.json");
  await writeMarketplace(root, name, [], manifestPath);
  return { kind: "file", root, source: manifestPath, manifestPath };
}

/** Publishes new offers at the recorded source without moving its manifest. */
export async function republishMarketplace(
  published: PublishedMarketplace,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeMarketplace(published.root, name, plugins, published.manifestPath);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}

/** Rewrites the exact published manifest with the supplied JSON text. */
export async function rewritePublishedManifest(
  published: PublishedMarketplace,
  text: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeManifestText(published.manifestPath, text);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}

function ownedTarget(published: PublishedMarketplace, target: string): string {
  const root = path.resolve(published.root);
  const resolved = path.resolve(target);
  const relative = path.relative(root, resolved);
  if (
    root === path.parse(root).root ||
    (relative !== "" && (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)))
  ) {
    throw new Error(`refusing to change ${resolved} outside the published root ${root}`);
  }

  return resolved;
}

/** Removes only the directory or exact manifest recorded for this publication. */
export async function removePublishedSource(published: PublishedMarketplace): Promise<void> {
  switch (published.kind) {
    case "dir":
      await rm(ownedTarget(published, published.root), { recursive: true });
      return;
    case "file":
      await rm(ownedTarget(published, published.manifestPath));
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}

/** Writes a visibly different conventional manifest beside an external file source. */
export async function publishConventionalDecoy(
  published: PublishedMarketplace,
  name: string,
): Promise<void> {
  if (published.kind !== "file") {
    throw new Error(`a ${published.kind} publication cannot have a file-source decoy`);
  }

  const conventionalPath = ownedTarget(
    published,
    path.join(published.root, ".claude-plugin", "marketplace.json"),
  );
  if (conventionalPath === path.resolve(published.manifestPath)) {
    throw new Error("the published manifest is already the conventional manifest");
  }

  await writeMarketplace(published.root, `${name}-decoy`, [], conventionalPath);
}

/**
 * Breaks the manifest of the marketplace `name` in the directory `published`
 * records, with `problem`: JSON that does not parse, or JSON that breaks the
 * manifest schema (ADD-07).
 */
export async function invalidateManifest(
  name: string,
  published: PublishedMarketplace,
  problem: ManifestProblem,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await MANIFEST_WRITERS[problem](published.manifestPath, name);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}

/**
 * Lets the plugins of the marketplace `published` records depend on plugins of
 * the marketplace `target`.
 */
export async function allowDependenciesOn(
  published: PublishedMarketplace,
  target: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeDependencyAllowance(published.manifestPath, target);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}

/** Sets the description of the marketplace `published` records. */
export async function describeMarketplace(
  published: PublishedMarketplace,
  description: string,
): Promise<void> {
  switch (published.kind) {
    case "dir":
    case "file":
      await writeMarketplaceDescription(published.manifestPath, description);
      return;
    case "url":
    case "github":
      throw noStandIn(published.kind);
  }
}
