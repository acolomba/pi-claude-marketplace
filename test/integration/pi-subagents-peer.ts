// test/integration/pi-subagents-peer.ts
//
// Shared pi-subagents peer support for the integration tests that check this
// extension's output against pi-subagents' own modules. It returns the
// package from the optional peer cache and imports one of its compiled agent
// modules in place. The generic identity, floor and loader pieces live in
// optional-peer.ts.
//
// pi-subagents is an optional peer. The tests prove the version the suites run,
// named by test/integration/optional-peer-suite-versions.json and installed by
// scripts/install-test-peers.mjs. It is above the declared floor, so no suite
// proves the floor itself (D-PG1-02, which amends PIFL-02 for pi-subagents).
//
// The package's `exports` map does not expose `src/agents/frontmatter` or
// `src/agents/skills`, so the loader imports the compiled
// `src/agents/<module>.js` by absolute file URL.

import { findCachedPeer, importPeerModule } from "./optional-peer.ts";

import type { OptionalPeer } from "./optional-peer.ts";

/** An installed pi-subagents package: its root directory and its version. */
export type PiSubagentsPeer = OptionalPeer;

/**
 * Returns pi-subagents at the version the suites run from the optional peer cache.
 * Throws, naming the repair command, when the cache does not hold it.
 */
export async function findPiSubagentsPackage(): Promise<PiSubagentsPeer> {
  return findCachedPeer("pi-subagents");
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
