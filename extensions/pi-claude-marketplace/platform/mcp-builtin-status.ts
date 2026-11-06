// platform/mcp-builtin-status.ts
//
// BLT-05: the status reader for the MCP servers the extension registers with
// Pi's built-in MCP. It lives in platform/ because Pi's MCP registry is an
// external-system boundary; it imports only this zone's `mcp-status.ts` and
// `pi-api.ts` types, the shared `Scope` type, and the shared debug log,
// error message, and path redaction helpers.
//
// P2-DC-10: Pi gives extensions no connection state and emits no status
// event, so a lookup infers the state from what Pi exposes, within the view
// the parameter names: the registered servers and the tool list. Pi registers
// every tool of a server in `getAllTools()` as soon as the server connects,
// deferred ones included, under the namespace `mcp__<server>` with `-` folded
// to `_` (Pi 1.5.0 `mcpNamespace`), and its `/mcp` manager re-registers every
// tool of a server it disables for the session with the exposure `hidden`.
// So a registered server answers:
//
// - `connected` when a tool of its namespace is not hidden;
// - `disabled` when every tool of its namespace is hidden, unless the
//   server's last registration replaced another config;
// - `not-connected` when its namespace has no tool: still connecting, failed,
//   waiting for sign-in, or offering no tool, which Pi does not tell apart.
//
// Pi also hides every tool of a server that an extension registers again
// with a changed config: it drops the old connection and starts a new one
// (Pi 1.5.0 `mcp_servers_change` handler). Until the new connection lists its
// tools, and for the session when it fails, nothing in the registry or the
// tool list tells that apart from a `/mcp` disable. So the registration sync
// notes each name whose registration replaced another config, and such a
// name with only hidden tools answers `not-connected`. A replaced server that
// the user then disables in `/mcp` also answers `not-connected`.
//
// A name Pi does not list answers `unlisted` (rendered `not loaded`), even
// when hidden tools of an earlier registration in the session remain.
//
// ASTAT-02: a lookup never throws. When Pi's MCP registry or tool list cannot
// be read, because Pi refuses a read from a stale runtime or a tool another
// extension registered cannot be read, it answers `no-snapshot`. info shows
// that as `status unknown`, the existing token for a state info cannot read.
// The reason goes to the `mcp` debug channel, never to the user.
//
// D-MB-29: when another extension registered a server under the same name
// first, Pi refuses this extension's registration. The registration sync
// notes the refusal here, and info reads such a name as `not loaded`. This
// reader still answers for whatever server Pi lists under the name, because
// `lookup` receives only the server name and cannot learn its own
// `extensionPath`.
//
// MSEL-01: `index.ts` builds this reader once per extension load, at factory
// time, before every extension has loaded, so building it must not read `pi`.
// Every read happens inside `lookup`, which runs inside an info command,
// after every extension has loaded.

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";
import { redactAbsolutePaths } from "../shared/redact-absolute-paths.ts";

import type { McpStatusReader } from "./mcp-status.ts";
import type { PiInventory, PiMcpRegistry, ToolInventoryItem } from "./pi-api.ts";
import type { Scope } from "../shared/types.ts";

// Pi 1.5.0 `core/mcp-servers.js` `mcpNamespace`.
function namespaceOf(serverName: string): string {
  return `mcp__${serverName.replaceAll("-", "_")}`;
}

// `ToolInventoryItem` declares only the fields every caller reads; Pi's items
// also carry `namespace` and `exposure`, which are read here by narrowing.
function namespaceNameOf(tool: ToolInventoryItem): unknown {
  if (!("namespace" in tool)) {
    return undefined;
  }

  const namespace: unknown = tool.namespace;
  return typeof namespace === "object" && namespace !== null && "name" in namespace
    ? namespace.name
    : undefined;
}

function isHidden(tool: ToolInventoryItem): boolean {
  return "exposure" in tool && tool.exposure === "hidden";
}

// The names whose last accepted registration in this Pi process replaced a
// listed config of another shape. A fresh registration or a removal clears a
// name, and Pi starts each session with no registration, so a name from an
// earlier session is cleared when it registers again.
const replacedRegistrations = new Set<string>();

// D-MB-29: the names whose last registration attempt in this Pi process Pi
// refused. A later registration Pi accepts, or a removal, clears a name.
const refusedRegistrations = new Set<string>();

/** The record whose server the built-in registration step registers under a name. */
export interface BuiltinServerOwner {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
}

// ASTAT-01 / P2-DC-14: the owner of each name the registration step's last
// sync asked Pi to register, as it decided: the user records first, then the
// trusted project's, a later record of the same server name winning. A server
// whose record could not be read keeps its earlier owner. The marketplace is
// not part of the name, and two plugin and server pairs can fold to one name,
// so another record can own a name.
let serverOwners: ReadonlyMap<string, BuiltinServerOwner> = new Map();

/** Records the owner of each name the registration step's last sync decided. */
export function noteBuiltinServerOwners(owners: ReadonlyMap<string, BuiltinServerOwner>): void {
  serverOwners = owners;
}

/** The owner the last sync gave `serverName`, or `undefined` when it gave that name none. */
export function builtinServerOwner(serverName: string): BuiltinServerOwner | undefined {
  return serverOwners.get(serverName);
}

/** Notes that the sync registered `serverName` in place of a listed config of another shape. */
export function noteReplacedBuiltinRegistration(serverName: string): void {
  replacedRegistrations.add(serverName);
  refusedRegistrations.delete(serverName);
}

/** Notes that the sync registered `serverName` fresh, or removed it. */
export function noteFreshBuiltinRegistration(serverName: string): void {
  replacedRegistrations.delete(serverName);
  refusedRegistrations.delete(serverName);
}

/** D-MB-29: notes that Pi refused the sync's registration of `serverName`. */
export function noteRefusedBuiltinRegistration(serverName: string): void {
  refusedRegistrations.add(serverName);
}

/** D-MB-29: whether Pi refused the sync's last registration of `serverName`. */
export function builtinRegistrationRefused(serverName: string): boolean {
  return refusedRegistrations.has(serverName);
}

// The answer for `serverName` from what Pi lists now. It throws when Pi's
// registry or tool list cannot be read.
function readStatus(
  pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
  serverName: string,
): ReturnType<McpStatusReader["lookup"]> {
  if (!pi.getMcpServers().some((server) => server.name === serverName)) {
    return "unlisted";
  }

  const namespace = namespaceOf(serverName);
  const tools = pi.getAllTools().filter((tool) => namespaceNameOf(tool) === namespace);
  if (tools.length === 0) {
    return "not-connected";
  }

  if (!tools.every(isHidden)) {
    return "connected";
  }

  return replacedRegistrations.has(serverName) ? "not-connected" : "disabled";
}

/**
 * Returns the built-in MCP status reader for one extension load. Building it
 * reads nothing from `pi`.
 */
export function createBuiltinMcpStatusReader(
  pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
): McpStatusReader {
  return {
    lookup(serverName) {
      try {
        return readStatus(pi, serverName);
      } catch (error: unknown) {
        // ASTAT-02: info only uses this answer to annotate a row, so a failed
        // read must not fail info. UF-4: the error can name absolute paths,
        // which the line cuts to their last segment.
        hookDebugLog(
          redactAbsolutePaths(
            `status of MCP server ${serverName} unreadable: ${errorMessage(error)}`,
          ),
          "mcp",
        );
        return "no-snapshot";
      }
    },
  };
}
