// domain/mcp-builtin-translation.ts
//
// The closed table from one Claude server object to the config this extension
// registers with Pi's built-in MCP (BLT-02). It starts from the adapter table
// in `mcp-server-features.ts`, so both implementations share Claude's timeout
// floor and caps and Claude's OAuth redirect, then renames those fields for
// Pi. Pi compares a registration by `JSON.stringify(config)` and reconnects a
// server whose JSON changed, so the keys come out in one fixed order: `type`,
// the transport fields, `oauth`, `timeout`, `exposure`, `description`.
//
// - `timeout` is Pi's per-request timeout in seconds, any positive number
//   (Pi 1.5.0 `dist/core/mcp-servers.js` `validateMcpServerConfig`), so the
//   milliseconds are divided by 1000 with no rounding (P2-DC-05).
// - `oauth.redirectUri` becomes Pi's `callbackUrl` in place. `clientName` and
//   `clientRegistration` are never written, so Pi keeps its Client ID Metadata
//   Document (D-MB-11).
// - `exposure` is `deferred` behind Pi's tool search, or `direct` for a
//   literal `alwaysLoad: true` (D-MB-02).
// - No Pi-only power is written: no `cwd` (P2-DC-04), `auth`, `toolExposure`,
//   `enabled`, or `clientSecret`, and none of the adapter's own fields
//   (`directTools`, `toolPrefix`, `httpTransport`).

import { translateMcpServer } from "./mcp-server-features.ts";

const TRANSPORT_FIELDS = ["command", "args", "env", "url", "headers"] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function typeField(server: Readonly<Record<string, unknown>>): { type?: "http" } {
  return server.type === "http" || server.type === "streamable-http" ? { type: "http" } : {};
}

function transportFields(adapter: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const field of TRANSPORT_FIELDS) {
    if (Object.hasOwn(adapter, field)) {
      fields[field] = adapter[field];
    }
  }

  return fields;
}

// The adapter table writes `oauth` only with one of its four string keys, in
// the order clientId, redirectUri, authServerMetadataUrl, scope.
function oauthField(oauth: unknown): { oauth?: Record<string, unknown> } {
  if (!isRecord(oauth)) {
    return {};
  }

  return {
    oauth: Object.fromEntries(
      Object.entries(oauth).map(([key, value]) => [
        key === "redirectUri" ? "callbackUrl" : key,
        value,
      ]),
    ),
  };
}

function timeoutField(requestTimeoutMs: unknown): { timeout?: number } {
  return typeof requestTimeoutMs === "number" ? { timeout: requestTimeoutMs / 1000 } : {};
}

/**
 * Translates one Claude server object, before variable expansion, into the
 * config this extension registers with Pi's built-in MCP: the transport
 * fields, `oauth`, `timeout`, `exposure`, then the plugin's `description` when
 * given. A remote server (`http` or `streamable-http`) starts with
 * `type: "http"`. A field of the wrong type is skipped, as the adapter table
 * skips it.
 */
export function translateBuiltinMcpServer(
  server: Readonly<Record<string, unknown>>,
  description: string | undefined,
): Record<string, unknown> {
  const adapter = translateMcpServer(server, description);
  return {
    ...typeField(server),
    ...transportFields(adapter),
    ...oauthField(adapter.oauth),
    ...timeoutField(adapter.requestTimeoutMs),
    exposure: server.alwaysLoad === true ? "direct" : "deferred",
    ...(description === undefined ? {} : { description }),
  };
}
