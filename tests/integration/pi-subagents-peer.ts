// tests/integration/pi-subagents-peer.ts
//
// Shared pi-subagents peer support for the integration tests that check this
// extension's output against pi-subagents' own modules. It finds the
// installed package, decides whether its version reaches the declared peer
// floor, and imports one of its compiled agent modules in place. The generic
// identity, floor and loader pieces live in optional-peer.ts.
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
// `src/agents/skills`, so the loader imports the compiled
// `src/agents/<module>.js` by absolute file URL.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { lt } from "semver";

import {
  importPeerModule,
  readOptionalPeer,
  readPeerFloor as readDeclaredPeerFloor,
} from "./optional-peer.ts";

import type { OptionalPeer } from "./optional-peer.ts";

const PI_SUBAGENTS = "pi-subagents";

/** An installed pi-subagents package: its root directory and its version. */
export type PiSubagentsPeer = OptionalPeer;

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
    return readOptionalPeer(override, PI_SUBAGENTS);
  }

  const root = globalPackageRoot();
  if (!root || !existsSync(path.join(root, "package.json"))) {
    return undefined;
  }

  return readOptionalPeer(root, PI_SUBAGENTS);
}

/** Returns the lowest version the declared `peerDependencies["pi-subagents"]` range admits. */
export async function readPeerFloor(): Promise<string> {
  return readDeclaredPeerFloor(PI_SUBAGENTS);
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
  return importPeerModule<T>(peer, "src", "agents", `${module}.js`);
}
