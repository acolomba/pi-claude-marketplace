/**
 * @fileoverview The companion extensions a profile Pi can load, found in the
 * optional peer cache (HAR-01, D-CF1-15).
 *
 * `scripts/install-test-peers.mjs` installs the declared floor of each
 * optional peer into `node_modules/.cache/optional-peers`. A companion loads
 * from the first `pi.extensions` entry of its `package.json`, as Pi loads an
 * installed package, never from a hard-coded file, and its version must be
 * the floor of its peer range in this repository's `package.json`. The
 * resolver reads the cache when a step asks, never at import, so a run with
 * no cache loads this module. `features/` may not import
 * `test/integration/optional-peer.ts`, so the floor check is repeated here.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { minVersion } from "semver";

/** A companion extension by the name its scenarios use. */
export type CompanionName = "pi-subagents" | "pi-mcp-adapter" | "pi-dynamic-workflows";

/** A companion as the peer cache holds it. */
export interface Companion {
  readonly name: CompanionName;
  /** The package root inside the peer cache. */
  readonly root: string;
  /** The absolute path of the first `pi.extensions` entry. */
  readonly entry: string;
  readonly version: string;
}

// scripts/install-test-peers.mjs fills this directory; the two paths change together.
const PEER_CACHE_MODULES = fileURLToPath(
  new URL("../../node_modules/.cache/optional-peers/node_modules/", import.meta.url),
);

const REPOSITORY_MANIFEST = new URL("../../package.json", import.meta.url);

const PEER_CACHE_REMEDY = "Run `node scripts/install-test-peers.mjs`.";

// HAR-01: a profile Pi loads its companions in this order, whatever order a
// feature names them in.
const LOAD_ORDER: readonly CompanionName[] = [
  "pi-subagents",
  "pi-mcp-adapter",
  "pi-dynamic-workflows",
];

const PACKAGES: Readonly<Record<CompanionName, string>> = {
  "pi-subagents": "pi-subagents",
  "pi-mcp-adapter": "pi-mcp-adapter",
  "pi-dynamic-workflows": "@quintinshaw/pi-dynamic-workflows",
};

interface CompanionManifest {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly pi?: { readonly extensions?: unknown };
}

/** Returns whether `file` lies inside the optional peer cache. */
export function isInPeerCache(file: string): boolean {
  return file.startsWith(PEER_CACHE_MODULES);
}

/** Returns `name` as a companion name, or throws when no companion has that name. */
export function parseCompanionName(name: string): CompanionName {
  const companion = LOAD_ORDER.find((candidate) => candidate === name);
  if (companion === undefined) {
    throw new Error(`unknown companion ${name}; expected one of ${LOAD_ORDER.join(", ")}`);
  }

  return companion;
}

/** Returns `names` in the fixed load order, each once. */
export function inLoadOrder(names: readonly CompanionName[]): CompanionName[] {
  return LOAD_ORDER.filter((name) => names.includes(name));
}

async function readJson(file: string | URL): Promise<unknown> {
  return JSON.parse(await readFile(file, "utf8"));
}

async function declaredFloor(packageName: string): Promise<string> {
  const manifest = (await readJson(REPOSITORY_MANIFEST)) as {
    readonly peerDependencies?: Readonly<Record<string, string>>;
  };
  const range = manifest.peerDependencies?.[packageName];
  const floor = range === undefined ? null : minVersion(range);
  if (floor === null) {
    throw new Error(`package.json declares no usable ${packageName} peer range`);
  }

  return floor.version;
}

/**
 * Returns the companion `name` as the peer cache holds it: its package root,
 * its first `pi.extensions` entry, and its version. Throws, naming the
 * install command, when the cache holds no such package, when the package
 * declares no extension, or when its version is not the declared floor.
 */
export async function resolveCompanion(name: CompanionName): Promise<Companion> {
  const packageName = PACKAGES[name];
  const root = path.join(PEER_CACHE_MODULES, packageName);
  let manifest: CompanionManifest;
  try {
    manifest = (await readJson(path.join(root, "package.json"))) as CompanionManifest;
  } catch (error: unknown) {
    throw new Error(`the peer cache holds no ${packageName}. ${PEER_CACHE_REMEDY}`, {
      cause: error,
    });
  }

  const extensions: unknown = manifest.pi?.extensions;
  const entry: unknown = Array.isArray(extensions) ? (extensions as unknown[])[0] : undefined;
  if (manifest.name !== packageName || typeof entry !== "string") {
    throw new Error(`the peer cache's ${packageName} declares no extension. ${PEER_CACHE_REMEDY}`);
  }

  const floor = await declaredFloor(packageName);
  if (manifest.version !== floor) {
    throw new Error(
      `the peer cache holds ${packageName} ${String(manifest.version)}, not the floor ${floor}. ${PEER_CACHE_REMEDY}`,
    );
  }

  return { name, root, entry: path.resolve(root, entry), version: floor };
}
