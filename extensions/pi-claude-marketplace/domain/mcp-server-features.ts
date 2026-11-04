// domain/mcp-server-features.ts
//
// The closed Claude Code 2.1.291 MCP server table that the plugin resolver and
// the MCP bridge share. `translateMcpServer` maps the fields Claude reads to
// their pi-mcp-adapter `ServerEntry` equivalents. A field the table does not
// name never reaches `mcp-adapter.json`, so a plugin cannot set an adapter-only
// power Claude never grants, such as `auth`, `approveTools` or `lifecycle`
// (ANAME-05, ANAME-07). The table writes `auth: "oauth"` itself where Claude
// keeps OAuth beside `headers` (D-08-04); a plugin's own `auth` is dropped.
//
// `checkClaudeShape` is the one Claude-shape check every MCP implementation
// shares (MSEL-01): it decides malformed and hands back the typed server.
// `classifyMcpServer` is the pi-mcp-adapter verdict built on it: supported,
// blocked by a Claude feature pi-mcp-adapter cannot honor, or malformed. The
// built-in verdict lives in `mcp-builtin-features.ts` and uses the same check
// and field-feature helpers.

import Type from "typebox";
import { Compile } from "typebox/compile";

/**
 * A Claude Code server feature pi-mcp-adapter has no equivalent for: the `ws`
 * transport, a host-only server type, or one of the named fields (ANAME-07).
 * `command ~` and `args ~` are a leading home marker in a stdio server's
 * `command` or an `args` element. Claude Code passes it through literally, but
 * pi-mcp-adapter expands it to the home directory after interpolation, so no
 * written form keeps the value literal (AVAR-03). `sse` is the SSE transport,
 * which only Pi's built-in MCP rejects (MSEL-01), so only the built-in verdict
 * returns it.
 */
export type McpUnsupportedFeature =
  | "ws"
  | "sse"
  | "sse-ide"
  | "ws-ide"
  | "sdk"
  | "claudeai-proxy"
  | "headersHelper"
  | "oauth.xaa"
  | "command ~"
  | "args ~"
  | "bareElicitationCapability";

/** A server a partial install leaves out whole, with the first feature that blocks it. */
export interface DroppedMcpServer {
  readonly server: string;
  readonly feature: McpUnsupportedFeature;
}

/** The verdict an MCP implementation gives one declared server. */
export type McpServerVerdict =
  | { readonly kind: "supported" }
  | { readonly kind: "blocked"; readonly feature: McpUnsupportedFeature }
  | { readonly kind: "malformed"; readonly detail: string };

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
  if (
    typeof metadataUrl === "string" &&
    metadataUrl.startsWith("https://") &&
    URL.canParse(metadataUrl)
  ) {
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

/**
 * D-08-04: Claude Code keeps OAuth beside `headers` unless one of them is
 * `Authorization` in any letter case. pi-mcp-adapter turns OAuth off for any
 * non-empty `headers` unless the entry sets `auth: "oauth"`.
 */
function authField(server: Readonly<Record<string, unknown>>): { auth?: "oauth" } {
  if (!isPlainObject(server.headers)) {
    return {};
  }

  const keys = Object.keys(server.headers);
  return keys.length > 0 && !keys.some((key) => key.toLowerCase() === "authorization")
    ? { auth: "oauth" }
    : {};
}

function remoteOptions(server: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return { ...authField(server), ...oauthField(server.oauth), ...remoteTimeoutField(server) };
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
 * Translates one Claude server object, before variable expansion, into the
 * adapter entry this extension writes (ANAME-07). The entry holds the mapped
 * transport fields, `auth: "oauth"` for a remote server whose `headers` keep
 * OAuth in Claude (D-08-04), `oauth` and `requestTimeoutMs`, then the owned
 * fields: the plugin's `description` when given (ANAME-06), `directTools`
 * (`true` for a literal `alwaysLoad: true`, else `"search"`, ANAME-04) and
 * `toolPrefix: "mcp"`. A value of the wrong type is skipped, and so is every
 * field the table does not name, including a server's own `auth`,
 * `description`, `directTools` and `toolPrefix`.
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

// Claude Code 2.1.291's per-transport server schemas, chosen by `type` in
// `checkClaudeShape`. Unknown keys stay allowed, as Claude's strip-mode
// objects allow them. `role` and `request_timeout_ms` are never invalid, so
// they are absent, and `oauth.xaa` accepts any value.
const STRING_RECORD = Type.Record(Type.String(), Type.String());

const COMMON_FIELDS = {
  timeout: Type.Optional(Type.Integer({ minimum: 1 })),
  alwaysLoad: Type.Optional(Type.Boolean()),
  bareElicitationCapability: Type.Optional(Type.Boolean()),
};

const STDIO_SERVER_SCHEMA = Type.Object({
  command: Type.String({ minLength: 1 }),
  args: Type.Optional(Type.Array(Type.String())),
  env: Type.Optional(STRING_RECORD),
  ...COMMON_FIELDS,
});

const STDIO_SERVER = Compile(STDIO_SERVER_SCHEMA);

const OAUTH = Type.Object({
  clientId: Type.Optional(Type.String()),
  callbackPort: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_PORT })),
  authServerMetadataUrl: Type.Optional(Type.String({ pattern: "^https://" })),
  scopes: Type.Optional(Type.String({ minLength: 1 })),
  xaa: Type.Optional(Type.Unknown()),
});

const TOOL_POLICY = Type.Object({
  name: Type.String(),
  permission_policy: Type.Optional(
    Type.Union([
      Type.Literal("always_allow"),
      Type.Literal("always_ask"),
      Type.Literal("always_deny"),
    ]),
  ),
});

const REMOTE_SERVER_SCHEMA = Type.Object({
  url: Type.String(),
  headers: Type.Optional(STRING_RECORD),
  headersHelper: Type.Optional(Type.String()),
  oauth: Type.Optional(OAUTH),
  tools: Type.Optional(Type.Array(TOOL_POLICY)),
  discoveryCache: Type.Optional(Type.Boolean()),
  toolPermissions: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Union([Type.Literal("allow"), Type.Literal("ask"), Type.Literal("blocked")]),
    ),
  ),
  ...COMMON_FIELDS,
});

const REMOTE_SERVER = Compile(REMOTE_SERVER_SCHEMA);

const WS_SERVER_SCHEMA = Type.Object({
  url: Type.String(),
  headers: Type.Optional(STRING_RECORD),
  headersHelper: Type.Optional(Type.String()),
  ...COMMON_FIELDS,
});

const WS_SERVER = Compile(WS_SERVER_SCHEMA);

/**
 * One declared server after the shared Claude-shape check (MSEL-01):
 * malformed with Claude's first schema error, a host-only type (reported
 * without validation), or a valid server typed by its transport. A valid
 * remote server keeps its `type` as `transport`.
 */
export type McpServerShape =
  | { readonly kind: "malformed"; readonly detail: string }
  | {
      readonly kind: "host-only";
      readonly feature: Extract<
        McpUnsupportedFeature,
        "sse-ide" | "ws-ide" | "sdk" | "claudeai-proxy"
      >;
    }
  | { readonly kind: "stdio"; readonly server: Type.Static<typeof STDIO_SERVER_SCHEMA> }
  | {
      readonly kind: "remote";
      readonly transport: "sse" | "http" | "streamable-http";
      readonly server: Type.Static<typeof REMOTE_SERVER_SCHEMA>;
    }
  | { readonly kind: "ws"; readonly server: Type.Static<typeof WS_SERVER_SCHEMA> };

type MalformedShape = Extract<McpServerShape, { readonly kind: "malformed" }>;

function malformed(errors: readonly { instancePath: string; message: string }[]): MalformedShape {
  const detail = errors
    .slice(0, 1)
    .map((error) => `${error.instancePath || "(root)"}: ${error.message}`)
    .join("");
  return { kind: "malformed", detail };
}

function featureVerdict(feature: McpUnsupportedFeature | undefined): McpServerVerdict {
  return feature === undefined ? { kind: "supported" } : { kind: "blocked", feature };
}

function elicitationFeature(server: {
  readonly bareElicitationCapability?: boolean;
}): McpUnsupportedFeature | undefined {
  return server.bareElicitationCapability === true ? "bareElicitationCapability" : undefined;
}

/**
 * The remote field features both implementations block, in table order:
 * `headersHelper`, then a truthy `oauth.xaa`. Tool permission rules do not
 * block (`unenforcedToolRules`).
 */
export function remoteFieldFeature(server: {
  readonly headersHelper?: string;
  readonly oauth?: { readonly xaa?: unknown };
}): McpUnsupportedFeature | undefined {
  if (server.headersHelper !== undefined) {
    return "headersHelper";
  }

  if (server.oauth?.xaa) {
    return "oauth.xaa";
  }

  return undefined;
}

/** A Claude Code tool permission field that pi-mcp-adapter does not enforce. */
export type McpUnenforcedToolRule = "tools[].permission_policy" | "toolPermissions";

/**
 * Lists the tool permission fields a valid remote server declares, in table
 * order: `tools[].permission_policy` when a `tools` element has a
 * `permission_policy`, then `toolPermissions` when it has a key (ANAME-07,
 * AMIG-01). The server works under pi-mcp-adapter, which has no per-tool
 * rule, so these restrictions are not enforced. Whether Claude Code enforces
 * them for a plugin server is not established. Any other input, including a
 * stdio server and a remote server its schema rejects, gives `[]`.
 */
export function unenforcedToolRules(server: unknown): readonly McpUnenforcedToolRule[] {
  if (
    !isPlainObject(server) ||
    (server.type !== "sse" && server.type !== "http" && server.type !== "streamable-http") ||
    !REMOTE_SERVER.Check(server)
  ) {
    return [];
  }

  const rules: McpUnenforcedToolRule[] = [];
  if ((server.tools ?? []).some((tool) => tool.permission_policy !== undefined)) {
    rules.push("tools[].permission_policy");
  }

  if (Object.keys(server.toolPermissions ?? {}).length > 0) {
    rules.push("toolPermissions");
  }

  return rules;
}

// The values pi-mcp-adapter home-expands: exactly `~`, or a `~/` or `~\`
// prefix. `~\` counts on every platform, although the adapter expands it only
// on Windows. `~user/x` is left alone.
const LEADING_HOME = /^~(?:$|[/\\])/;
// A leading `${NAME:-default}` reference whose default is such a value. The
// check does not read the environment, so the default counts even when NAME
// is set at install (AVAR-03).
const LEADING_HOME_DEFAULT = /^\$\{[A-Za-z_]\w*:-~(?:[/\\][^}]*)?\}/;

function startsWithHomeMarker(value: string): boolean {
  return LEADING_HOME.test(value) || LEADING_HOME_DEFAULT.test(value);
}

/**
 * The leading home features both implementations block (AVAR-03): `command ~`
 * before `args ~`, so a stdio server with both reports its command.
 */
export function leadingHomeFeature(server: {
  readonly command: string;
  readonly args?: readonly string[];
}): McpUnsupportedFeature | undefined {
  if (startsWithHomeMarker(server.command)) {
    return "command ~";
  }

  return (server.args ?? []).some((arg) => startsWithHomeMarker(arg)) ? "args ~" : undefined;
}

function stdioShape(server: unknown): McpServerShape {
  return STDIO_SERVER.Check(server)
    ? { kind: "stdio", server }
    : malformed(STDIO_SERVER.Errors(server));
}

// Claude's schema also checks `authServerMetadataUrl` as a URL, which the
// typebox pattern cannot express.
function remoteShape(
  server: unknown,
  transport: "sse" | "http" | "streamable-http",
): McpServerShape {
  if (!REMOTE_SERVER.Check(server)) {
    return malformed(REMOTE_SERVER.Errors(server));
  }

  const metadataUrl = server.oauth?.authServerMetadataUrl;
  if (metadataUrl !== undefined && !URL.canParse(metadataUrl)) {
    return { kind: "malformed", detail: "/oauth/authServerMetadataUrl: must be a valid URL" };
  }

  return { kind: "remote", transport, server };
}

function wsShape(server: unknown): McpServerShape {
  return WS_SERVER.Check(server) ? { kind: "ws", server } : malformed(WS_SERVER.Errors(server));
}

/**
 * The Claude-shape check every MCP implementation shares (MSEL-01), by Claude
 * Code 2.1.291's server schemas (ANAME-07). A non-object, an unknown `type`,
 * or a config its transport's schema rejects is `malformed`, with the first
 * error as `detail`. A host-only type (`sse-ide`, `ws-ide`, `sdk`,
 * `claudeai-proxy`) is reported without validation, since Claude does not run
 * one from a plugin. A valid stdio, remote, or `ws` server comes back typed.
 * A server is malformed for one implementation exactly when it is malformed
 * for every other.
 */
export function checkClaudeShape(server: unknown): McpServerShape {
  if (!isPlainObject(server)) {
    return { kind: "malformed", detail: "(root): must be object" };
  }

  switch (server.type) {
    case undefined:
    case "stdio":
      return stdioShape(server);
    case "sse":
    case "http":
    case "streamable-http":
      return remoteShape(server, server.type);
    case "ws":
      return wsShape(server);
    case "sse-ide":
    case "ws-ide":
    case "sdk":
    case "claudeai-proxy":
      return { kind: "host-only", feature: server.type };
    default:
      return { kind: "malformed", detail: `unknown type ${JSON.stringify(server.type)}` };
  }
}

/**
 * The pi-mcp-adapter verdict for one declared server (ANAME-07). A server the
 * shared Claude-shape check finds malformed is `malformed`; a host-only type
 * is `blocked` by its type. A valid server that uses a feature pi-mcp-adapter
 * cannot honor is `blocked` with the first such feature in table order: `ws`,
 * `headersHelper`, `oauth.xaa`, then for stdio `command ~` and `args ~`
 * (AVAR-03), then `bareElicitationCapability`. `role`, `discoveryCache` and
 * the tool permission rules never block (`unenforcedToolRules`, AMIG-01), and
 * neither does a `~` in a remote server's `url` or `headers`, which the
 * adapter does not home-expand.
 */
export function classifyMcpServer(server: unknown): McpServerVerdict {
  const shape = checkClaudeShape(server);
  switch (shape.kind) {
    case "malformed":
      return shape;
    case "host-only":
      return { kind: "blocked", feature: shape.feature };
    case "ws":
      return { kind: "blocked", feature: "ws" };
    case "stdio":
      return featureVerdict(leadingHomeFeature(shape.server) ?? elicitationFeature(shape.server));
    case "remote":
      return featureVerdict(remoteFieldFeature(shape.server) ?? elicitationFeature(shape.server));
  }
}
