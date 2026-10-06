// domain/mcp-server-features.ts
//
// The closed Claude Code 2.1.291 MCP server table that the plugin resolver and
// the MCP bridge share. `translateMcpServer` maps the fields Claude reads to
// their pi-mcp-adapter `ServerEntry` equivalents. A field the table does not
// name never reaches `mcp-adapter.json`, so a plugin cannot set an adapter-only
// power Claude never grants, such as `auth`, `approveTools` or `lifecycle`
// (ANAME-05, ANAME-07).

// Claude ignores a `timeout` below one second.
const MIN_TIMEOUT_MS = 1000;
// Claude caps `timeout` here, which is also Node's largest timer delay.
const MAX_TIMEOUT_MS = 2_147_483_647;
// Claude caps `request_timeout_ms` before it stands in for `timeout`.
const MAX_REQUEST_TIMEOUT_MS = 300_000;
const MAX_PORT = 65_535;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function stdioFields(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (typeof server.command === "string") {
    fields.command = server.command;
  }

  if (Array.isArray(server.args)) {
    fields.args = server.args;
  }

  if (isPlainObject(server.env)) {
    fields.env = server.env;
  }

  return fields;
}

function remoteFields(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (typeof server.url === "string") {
    fields.url = server.url;
  }

  if (isPlainObject(server.headers)) {
    fields.headers = server.headers;
  }

  return fields;
}

/**
 * Maps Claude's four OAuth keys. `callbackPort` becomes Claude's own redirect
 * URI form, `http://localhost:<port>/callback`, which a pre-registered OAuth
 * client expects. Every other key, including a plugin `redirectUri` and
 * `clientSecret`, is dropped. `oauth` is written only when one key maps.
 */
function oauthField(oauth: unknown): { oauth?: Record<string, string> } {
  if (!isPlainObject(oauth)) {
    return {};
  }

  const mapped: Record<string, string> = {};
  if (typeof oauth.clientId === "string") {
    mapped.clientId = oauth.clientId;
  }

  const port = oauth.callbackPort;
  if (isInteger(port) && port >= 1 && port <= MAX_PORT) {
    mapped.redirectUri = `http://localhost:${port}/callback`;
  }

  const metadataUrl = oauth.authServerMetadataUrl;
  if (typeof metadataUrl === "string" && metadataUrl.startsWith("https://")) {
    mapped.authServerMetadataUrl = metadataUrl;
  }

  if (typeof oauth.scopes === "string" && oauth.scopes !== "") {
    mapped.scope = oauth.scopes;
  }

  return Object.keys(mapped).length > 0 ? { oauth: mapped } : {};
}

function timeoutField(timeout: unknown): { requestTimeoutMs?: number } {
  return isInteger(timeout) && timeout >= MIN_TIMEOUT_MS
    ? { requestTimeoutMs: Math.min(timeout, MAX_TIMEOUT_MS) }
    : {};
}

/**
 * A present `timeout` decides alone, even when Claude ignores it. Only when it
 * is absent does a remote server's `request_timeout_ms` stand in, capped at
 * five minutes as Claude caps it.
 */
function remoteTimeoutField(server: Readonly<Record<string, unknown>>): {
  requestTimeoutMs?: number;
} {
  if (server.timeout !== undefined) {
    return timeoutField(server.timeout);
  }

  const requestTimeout = server.request_timeout_ms;
  return isInteger(requestTimeout)
    ? timeoutField(Math.min(requestTimeout, MAX_REQUEST_TIMEOUT_MS))
    : {};
}

function remoteOptions(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...oauthField(server.oauth), ...remoteTimeoutField(server) };
}

/**
 * The transport fields by Claude's `type`. `sse` selects the adapter's SSE
 * transport, and `http` keeps its default. A `type` the table does not know
 * maps no field.
 */
function serverFields(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  switch (server.type) {
    case undefined:
    case "stdio":
      return { ...stdioFields(server), ...timeoutField(server.timeout) };
    case "sse":
      return { ...remoteFields(server), httpTransport: "sse", ...remoteOptions(server) };
    case "http":
    case "streamable-http":
      return { ...remoteFields(server), ...remoteOptions(server) };
    default:
      return {};
  }
}

/**
 * Translates one Claude server object, after variable substitution, into the
 * adapter entry this extension writes (ANAME-07). The entry holds the mapped
 * transport fields, `oauth` and `requestTimeoutMs`, then the owned fields: the
 * plugin's `description` when given (ANAME-06), `directTools` (`true` for a
 * literal `alwaysLoad: true`, else `"search"`, ANAME-04) and `toolPrefix:
 * "mcp"`. A value of the wrong type is skipped, and so is every field the
 * table does not name, including a server's own `description`, `directTools`
 * and `toolPrefix`.
 */
export function translateMcpServer(
  server: Readonly<Record<string, unknown>>,
  description: string | undefined,
): Record<string, unknown> {
  return {
    ...serverFields(server),
    ...(description === undefined ? {} : { description }),
    directTools: server.alwaysLoad === true ? true : "search",
    toolPrefix: "mcp",
  };
}
