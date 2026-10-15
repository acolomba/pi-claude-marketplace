/**
 * @fileoverview A marketplace published as one source kind.
 *
 * The dir and file kinds write the path fixture under the sandbox HOME
 * (D-04). The url and github kinds land with their stand-ins, so the steps
 * that publish a marketplace do not change when they do.
 */

import path from "node:path";

import { writeMarketplace } from "./path-marketplace.ts";

import type { OfferedPlugin } from "./path-marketplace.ts";

/** A kind of source a marketplace is published as. */
export type SourceKind = "dir" | "file" | "url" | "github";

const SOURCE_KINDS: readonly SourceKind[] = ["dir", "file", "url", "github"];

/** A published marketplace: its kind, and the source a user types to add it. */
export interface PublishedMarketplace {
  readonly kind: SourceKind;
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
 * source offering `plugins`. A file source is the manifest inside
 * `.claude-plugin/` (D-04).
 */
export async function publishMarketplace(
  marketplacesRoot: string,
  name: string,
  kind: SourceKind,
  plugins: readonly OfferedPlugin[],
): Promise<PublishedMarketplace> {
  const root = path.join(marketplacesRoot, name);
  switch (kind) {
    case "dir":
      await writeMarketplace(root, name, plugins);
      return { kind, source: root };
    case "file":
      await writeMarketplace(root, name, plugins);
      return { kind, source: path.join(root, ".claude-plugin", "marketplace.json") };
    case "url":
    case "github":
      throw noStandIn(kind);
  }
}
