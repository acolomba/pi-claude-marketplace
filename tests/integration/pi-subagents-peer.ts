// tests/integration/pi-subagents-peer.ts
//
// Shared pi-subagents peer support for the integration tests that check this
// extension's output against pi-subagents' own modules. It finds the
// installed package, decides whether its version reaches the declared peer
// floor, and imports one of its compiled agent modules in place.
//
// pi-subagents is an optional peer. This repository never installs it, so a
// test finds it either through `PI_SUBAGENTS_ROOT` or in the global npm root.
// `PI_SUBAGENTS_ROOT` is the operator's request to prove one specific
// install. An override that names no package, or a package other than
// pi-subagents, fails the test instead of reading as "not installed".
//
// PIFL-02: the floor is `semver.minVersion` of package.json
// `peerDependencies["pi-subagents"]`, so the tests prove exactly the version
// the extension declares and no separate constant can drift from it.
//
// The package's `exports` map does not expose `src/agents/frontmatter` or
// `src/agents/skills`, so a bare specifier cannot reach them. The loader
// imports the compiled `src/agents/<module>.js` by absolute file URL. Node
// loads compiled JavaScript from node_modules without type-stripping.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { lt, minVersion } from "semver";

const PI_SUBAGENTS = "pi-subagents";

/** An installed pi-subagents package: its root directory and its version. */
export interface PiSubagentsPeer {
  readonly root: string;
  readonly version: string;
}

interface PackageIdentity {
  readonly name?: unknown;
  readonly version?: unknown;
}

async function readPackageIdentity(packageJsonPath: string): Promise<PackageIdentity> {
  return JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageIdentity;
}

async function readPeer(root: string): Promise<PiSubagentsPeer> {
  const { name, version } = await readPackageIdentity(path.join(root, "package.json"));
  if (name !== PI_SUBAGENTS || typeof version !== "string") {
    throw new Error(
      `${root} holds ${JSON.stringify(name)} ${JSON.stringify(version)}, not ${PI_SUBAGENTS}`,
    );
  }

  return { root, version };
}

function globalPackageRoot(): string | undefined {
  try {
    const globalNodeModules = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    return globalNodeModules ? path.join(globalNodeModules, PI_SUBAGENTS) : undefined;
  } catch {
    // The global lookup is best-effort; a failed lookup means "not installed".
    return undefined;
  }
}

/**
 * Finds the pi-subagents package to prove. An explicit `PI_SUBAGENTS_ROOT`
 * must name a pi-subagents package or this throws. Without the override,
 * returns undefined when the global npm root holds no pi-subagents package.
 */
export async function findPiSubagentsPackage(): Promise<PiSubagentsPeer | undefined> {
  const override = process.env.PI_SUBAGENTS_ROOT;
  if (override) {
    if (!existsSync(path.join(override, "package.json"))) {
      throw new Error(`PI_SUBAGENTS_ROOT=${override} holds no package.json`);
    }

    return readPeer(override);
  }

  const root = globalPackageRoot();
  if (!root || !existsSync(path.join(root, "package.json"))) {
    return undefined;
  }

  return readPeer(root);
}

/** Returns the lowest version the declared `peerDependencies["pi-subagents"]` range admits. */
export async function readPeerFloor(): Promise<string> {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { readonly peerDependencies?: Readonly<Record<string, string>> };
  const range = manifest.peerDependencies?.[PI_SUBAGENTS];
  const floor = range === undefined ? null : minVersion(range);
  if (floor === null) {
    throw new Error(`package.json declares no usable ${PI_SUBAGENTS} peer range: ${range}`);
  }

  return floor.version;
}

/**
 * Reports whether a version sorts below the declared peer floor under semver.
 * A prerelease of the floor version counts as below it.
 */
export async function isBelowPeerFloor(version: string): Promise<boolean> {
  return lt(version, await readPeerFloor());
}

/**
 * Imports `src/agents/<module>.js` from the peer in place. A missing file or
 * an import error rejects, so a present but broken peer fails the caller.
 */
export async function loadPiSubagentsModule<T>(
  peer: PiSubagentsPeer,
  module: "frontmatter" | "skills",
): Promise<T> {
  return (await import(
    pathToFileURL(path.join(peer.root, "src", "agents", `${module}.js`)).href
  )) as T;
}
