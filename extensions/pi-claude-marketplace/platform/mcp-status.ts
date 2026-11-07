// platform/mcp-status.ts
//
// ASTAT-01 / ASTAT-02: the extension's only reader of pi-mcp-adapter's status
// snapshots on the `pi-mcp-adapter/status/v1` channel of Pi's shared event
// bus. It lives in platform/ because the channel is an external-system
// boundary; it imports only `typebox` and this zone's `pi-api.ts`.
//
// pi-mcp-adapter is a soft dependency and is never imported: the channel name
// is a string literal here, and the snapshot shape is declared locally with
// only the fields this module reads.
// `test/integration/mcp-status-conformance.test.ts` checks the channel name,
// the snapshot version and the seven statuses against pi-mcp-adapter's own
// published contract.
//
// The channel is push-only, so info reads the last snapshot the adapter sent.
// One tracker lives for one extension load. Pi drops every `pi.events`
// subscription when it invalidates the runtime (`/reload`, a session switch),
// and the next load builds an empty tracker, so no snapshot survives a reload
// and no shutdown handler is needed.
//
// The handler never throws: Pi's bus prints a handler throw to stderr (IL-2).
//
// STATUSLOOKUP-01 / MSEL-01: the file also holds what info hands its
// server-status stamp, one lookup arm per MCP implementation, and
// `mcpStatusLookup`, which builds it from the readers of both
// implementations.

import Type from "typebox";
import { Compile } from "typebox/compile";

import type { ActiveMcpImplementation, PiEventSource } from "./pi-api.ts";

const MCP_STATUS_CHANNEL = "pi-mcp-adapter/status/v1";

// Only the fields read are declared, so the adapter's extra fields pass. A
// plain-string `status` lets a status this release does not know degrade one
// server instead of the whole snapshot.
const MCP_STATUS_SNAPSHOT_VALIDATOR = Compile(
  Type.Object({
    version: Type.Literal(1),
    servers: Type.Array(Type.Object({ name: Type.String(), status: Type.String() })),
  }),
);

/** The seven server statuses pi-mcp-adapter 7.0.0 reports, verbatim. */
export type McpServerRuntimeStatus =
  "connected" | "cached" | "failed" | "needs-auth" | "not-connected" | "blocked" | "disabled";

const RUNTIME_STATUSES = {
  connected: true,
  cached: true,
  failed: true,
  "needs-auth": true,
  "not-connected": true,
  blocked: true,
  disabled: true,
} as const satisfies Record<McpServerRuntimeStatus, true>;

function isRuntimeStatus(status: string): status is McpServerRuntimeStatus {
  return Object.hasOwn(RUNTIME_STATUSES, status);
}

/** Reads the server statuses an MCP implementation last reported. */
export interface McpStatusReader {
  /**
   * Answers for one server, named as the implementation names it: the adapter
   * config key for pi-mcp-adapter, the registered server name for Pi's
   * built-in MCP. Returns the server's status when the last usable snapshot
   * lists it with a known status; `"unrecognized"` when it lists it with a
   * status this release does not know; `"unlisted"` when a usable snapshot
   * does not list it; `"no-snapshot"` when there is no usable snapshot
   * (nothing published yet in this extension load, an empty snapshot, or a
   * malformed one). The built-in reader also answers `"no-snapshot"` when
   * Pi's MCP registry or tool list cannot be read. A lookup never throws.
   */
  lookup(serverName: string): McpServerRuntimeStatus | "unrecognized" | "unlisted" | "no-snapshot";
}

/**
 * MSEL-01: the status readers of the two MCP implementations, built once per
 * extension load. info picks one through `mcpStatusLookup`.
 */
export interface McpStatusReaders {
  readonly adapter: McpStatusReader;
  readonly builtin: McpStatusReader;
}

/**
 * STATUSLOOKUP-01 / MSEL-01: what info hands the server-status stamp, one arm
 * per MCP implementation, each with the reader of that implementation. Only
 * the `builtin` arm carries the project's trust and working directory,
 * because only the built-in statuses `project not trusted` and
 * `overridden by mcp.json` depend on them (D-MB-09, BLT-05).
 */
export type McpStatusLookup =
  | { readonly implementation: "adapter"; readonly reader: McpStatusReader }
  | { readonly implementation: "none"; readonly reader: McpStatusReader }
  | {
      readonly implementation: "builtin";
      readonly reader: McpStatusReader;
      readonly projectTrusted: boolean;
      readonly cwd: string;
    };

/**
 * STATUSLOOKUP-01 / MSEL-01: the status lookup of `implementation`, with the
 * reader of that implementation from `readers`. The project's trust and
 * working directory go only into the `builtin` arm.
 */
export function mcpStatusLookup(
  readers: McpStatusReaders,
  implementation: ActiveMcpImplementation,
  project: { readonly projectTrusted: boolean; readonly cwd: string },
): McpStatusLookup {
  switch (implementation) {
    case "builtin":
      return {
        implementation,
        reader: readers.builtin,
        projectTrusted: project.projectTrusted,
        cwd: project.cwd,
      };
    // MSEL-01: under `none` no implementation is active. With no adapter
    // loaded its tracker holds no snapshot, so every server reads
    // `status unknown`.
    case "adapter":
    case "none":
      return { implementation, reader: readers.adapter };
  }
}

// An empty `servers` list is the adapter's session-start and shutdown
// snapshot, so it reads as no usable snapshot. A later entry for a repeated
// name wins, as it does in a `Map` built in array order.
//
// ASTAT-02: Pi's bus hands every subscriber the emitter's own object, so an
// accessor can answer the validator with a string and later answer with
// something else. Each server's `name` and `status` is
// read once after the check, and each copy is checked again, so whatever a
// later read of `servers` returns, only strings are stored; any other copy
// voids the snapshot.
function readSnapshot(payload: unknown): ReadonlyMap<string, string> | undefined {
  if (!MCP_STATUS_SNAPSHOT_VALIDATOR.Check(payload)) {
    return undefined;
  }

  const statuses = new Map<string, string>();
  for (const server of payload.servers) {
    const name: unknown = server.name;
    const status: unknown = server.status;
    if (typeof name !== "string" || typeof status !== "string") {
      return undefined;
    }

    statuses.set(name, status);
  }

  return statuses.size === 0 ? undefined : statuses;
}

/**
 * Subscribes once to pi-mcp-adapter's status channel and returns a reader of
 * the last snapshot. Every payload replaces the cached snapshot, an invalid
 * one included, so an older snapshot is never shown after a newer bad one.
 */
export function createMcpStatusTracker(events: PiEventSource): McpStatusReader {
  let latest: ReadonlyMap<string, string> | undefined;
  events.on(MCP_STATUS_CHANNEL, (payload) => {
    try {
      latest = readSnapshot(payload);
    } catch {
      // A hostile payload's getter can throw; it reads as no usable snapshot.
      latest = undefined;
    }
  });
  return {
    lookup(serverName) {
      if (latest === undefined) {
        return "no-snapshot";
      }

      const status = latest.get(serverName);
      if (status === undefined) {
        return "unlisted";
      }

      return isRuntimeStatus(status) ? status : "unrecognized";
    },
  };
}
