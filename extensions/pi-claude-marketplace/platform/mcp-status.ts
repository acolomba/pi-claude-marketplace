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
// `tests/integration/mcp-status-conformance.test.ts` checks the channel name,
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

import Type from "typebox";
import { Compile } from "typebox/compile";

import type { PiEventSource } from "./pi-api.ts";

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

/** The seven server statuses pi-mcp-adapter 5.1.0 reports, verbatim. */
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

/** Reads the server statuses of the last snapshot pi-mcp-adapter published. */
export interface McpStatusReader {
  /**
   * Answers for one adapter config key: the server's status when the last
   * usable snapshot lists it with a known status; `"unrecognized"` when it
   * lists it with a status this release does not know; `"unlisted"` when a
   * usable snapshot does not list it; `"no-snapshot"` when there is no usable
   * snapshot (nothing published yet in this extension load, an empty
   * snapshot, or a malformed one).
   */
  lookup(key: string): McpServerRuntimeStatus | "unrecognized" | "unlisted" | "no-snapshot";
}

// An empty `servers` list is the adapter's session-start and shutdown
// snapshot, so it reads as no usable snapshot. A later entry for a repeated
// name wins, as it does in a `Map` built in array order.
function readSnapshot(payload: unknown): ReadonlyMap<string, string> | undefined {
  if (!MCP_STATUS_SNAPSHOT_VALIDATOR.Check(payload) || payload.servers.length === 0) {
    return undefined;
  }

  return new Map(payload.servers.map((server) => [server.name, server.status]));
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
    lookup(key) {
      if (latest === undefined) {
        return "no-snapshot";
      }

      const status = latest.get(key);
      if (status === undefined) {
        return "unlisted";
      }

      return isRuntimeStatus(status) ? status : "unrecognized";
    },
  };
}
