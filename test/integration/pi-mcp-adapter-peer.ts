// test/integration/pi-mcp-adapter-peer.ts
//
// pi-mcp-adapter peer support for the conformance tests that run this
// extension's written MCP values and entries through the adapter's own
// functions (AVAR-03, AVAR-05, D-08-02, D-08-04) and check the status tracker
// against the adapter's own status channel, snapshot version and status union
// (ASTAT-01).
//
// PIFL-02, PIFL-03: pi-mcp-adapter is an optional peer and never a
// dependency, a devDependency, or a lockfile package. The tests read its
// declared floor from the optional peer cache.
//
// The adapter's `exports` map does not expose `dist/utils.js`,
// `dist/mcp-auth-flow.js`, `dist/mcp-auth-fetch.js` or `dist/config.js`, so
// the loader imports them by absolute file URL.
// `dist/types.js` is the one module this needs that the map does publish
// (`./types`); it is loaded in place like the others.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { findCachedPeer, importPeerModule } from "./optional-peer.ts";

import type { OptionalPeer } from "./optional-peer.ts";

/** The environment the adapter's interpolation reads. */
type AdapterEnvironment = Readonly<Record<string, string | undefined>>;

/** The `dist/utils.js` functions the conformance test drives. */
export interface PiMcpAdapterUtils {
  readonly interpolateEnvVars: (value: string, environment?: AdapterEnvironment) => string;
  readonly expandHomePath: (value: string) => string;
  readonly resolveConfigPath: (value: string, environment?: AdapterEnvironment) => string;
  /** Reads `process.env`. A single leading `!` runs the rest as a shell command. */
  readonly resolveCommandSecret: (value: string, context: string) => string;
  readonly resolveServerUrl: (
    definition: { readonly url: string },
    environment?: AdapterEnvironment,
  ) => string;
}

/** The OAuth fields `extractOAuthConfig` interpolates. */
export interface PiMcpAdapterOAuthConfig {
  readonly clientId?: string;
  readonly scope?: string;
  readonly authServerMetadataUrl?: string;
}

/** The `dist/mcp-auth-flow.js` functions the conformance tests drive. */
export interface PiMcpAdapterAuthFlow {
  /** Reads `process.env`. */
  readonly extractOAuthConfig: (definition: {
    readonly oauth: Readonly<Record<string, string>>;
  }) => PiMcpAdapterOAuthConfig;
  readonly supportsOAuth: (definition: Readonly<Record<string, unknown>>) => boolean;
}

/** The `dist/mcp-auth-fetch.js` function the entry conformance test drives. */
export interface PiMcpAdapterAuthFetch {
  /** Reads `process.env`, and throws a `TypeError` for a header OAuth mode refuses. */
  readonly resolveOAuthHeaders: (values: Readonly<Record<string, string>> | undefined) => Headers;
}

/** The `dist/config.js` function the entry conformance test drives. */
export interface PiMcpAdapterConfig {
  /** Reads every config source under `HOME`, `PI_CODING_AGENT_DIR` and `cwd`. */
  readonly loadMcpConfig: (
    overridePath?: string,
    cwd?: string,
  ) => { readonly mcpServers: Readonly<Record<string, unknown>> };
}

/** The `dist/types.js` constants the status conformance test reads. */
export interface PiMcpAdapterTypes {
  readonly MCP_STATUS_EVENT: string;
  readonly MCP_STATUS_SNAPSHOT_VERSION: number;
}

/**
 * Returns pi-mcp-adapter at the declared floor from the optional peer cache.
 * Throws, naming the repair command, when the cache does not hold it.
 */
export async function findPiMcpAdapterPackage(): Promise<OptionalPeer> {
  return findCachedPeer("pi-mcp-adapter");
}

/** Imports `dist/<module>.js` from the peer in place. */
export async function loadPiMcpAdapterModule<T>(
  peer: OptionalPeer,
  module: "utils" | "mcp-auth-flow" | "mcp-auth-fetch" | "config" | "types",
): Promise<T> {
  return importPeerModule<T>(peer, "dist", `${module}.js`);
}

/** Reads the text of one compiled `dist/` file, for the drift guard. */
export async function readPiMcpAdapterDist(
  peer: OptionalPeer,
  file: "server-manager.js" | "utils.js" | "mcp-auth-flow.js" | "types.d.ts",
): Promise<string> {
  return readFile(path.join(peer.root, "dist", file), "utf8");
}
