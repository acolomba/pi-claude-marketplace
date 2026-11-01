// test/integration/optional-peer.ts
//
// Identity, range and module-loading support for the integration tests that
// check this extension's output against an optional peer's own code
// (pi-subagents, pi-mcp-adapter, @quintinshaw/pi-dynamic-workflows).
//
// PIFL-03: an optional peer is never a `dependencies` or `devDependencies`
// entry and never a lockfile package. `scripts/install-test-peers.mjs` puts
// each declared floor in a gitignored cache, and `findCachedPeer` returns it.
// A missing package, another package, or a version other than the floor
// throws with the repair command.
//
// PIFL-02: the declared range and floor come from package.json
// `peerDependencies`, so the tests prove exactly the versions the extension
// declares and no separate constant can drift from them.
//
// A peer's internal modules are often outside its `exports` map, so a bare
// specifier cannot reach them. `importPeerModule` imports a file under the
// peer root by absolute file URL. Node loads compiled JavaScript from
// node_modules without type-stripping.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { minVersion } from "semver";

// scripts/install-test-peers.mjs fills this directory; the two paths change together.
const PEER_CACHE_NODE_MODULES = fileURLToPath(
  new URL("../../node_modules/.cache/optional-peers/node_modules/", import.meta.url),
);

const PEER_CACHE_REMEDY =
  "Run `node scripts/install-test-peers.mjs` (`npm run test:integration` runs it first).";

/** An installed optional peer: its package root directory and its version. */
export interface OptionalPeer {
  readonly root: string;
  readonly version: string;
}

interface PackageIdentity {
  readonly name?: unknown;
  readonly version?: unknown;
}

interface PeerManifest {
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

/**
 * Reads the package at `root`. Throws when `root` holds no package.json, holds
 * a package other than `packageName`, or declares no string version.
 */
async function readOptionalPeer(root: string, packageName: string): Promise<OptionalPeer> {
  const packageJsonPath = path.join(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`${root} holds no package.json`);
  }

  const { name, version } = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageIdentity;
  if (name !== packageName || typeof version !== "string") {
    throw new Error(
      `${root} holds ${JSON.stringify(name)} ${JSON.stringify(version)}, not ${packageName}`,
    );
  }

  return { root, version };
}

/** Returns package.json `peerDependencies[packageName]`, or throws when it is absent. */
async function readDeclaredPeerRange(packageName: string): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as PeerManifest;
  const range = manifest.peerDependencies?.[packageName];
  if (range === undefined) {
    throw new Error(`package.json declares no ${packageName} peer range`);
  }

  return range;
}

/** Returns the lowest version the declared `peerDependencies[packageName]` range admits. */
async function readPeerFloor(packageName: string): Promise<string> {
  const range = await readDeclaredPeerRange(packageName);
  const floor = minVersion(range);
  if (floor === null) {
    throw new Error(`package.json declares no usable ${packageName} peer range: ${range}`);
  }

  return floor.version;
}

/**
 * Returns `packageName` from the optional peer cache. Throws, naming the
 * repair command, when the cache holds no such package or holds a version
 * other than the declared floor.
 */
export async function findCachedPeer(packageName: string): Promise<OptionalPeer> {
  const floor = await readPeerFloor(packageName);
  const peer = await readOptionalPeer(
    path.join(PEER_CACHE_NODE_MODULES, packageName),
    packageName,
  ).catch((error: unknown) => {
    throw new Error(
      `${PEER_CACHE_NODE_MODULES} holds no ${packageName} ${floor}. ${PEER_CACHE_REMEDY}`,
      { cause: error },
    );
  });
  if (peer.version !== floor) {
    throw new Error(
      `${PEER_CACHE_NODE_MODULES} holds ${packageName} ${peer.version}, not the declared floor ${floor}. ${PEER_CACHE_REMEDY}`,
    );
  }

  return peer;
}

/**
 * Imports the file at `segments` under the peer root in place. A missing file
 * or an import error rejects, so a present but broken peer fails the caller.
 */
export async function importPeerModule<T>(peer: OptionalPeer, ...segments: string[]): Promise<T> {
  return (await import(pathToFileURL(path.join(peer.root, ...segments)).href)) as T;
}
