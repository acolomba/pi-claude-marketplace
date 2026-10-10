// bridges/mcp/collision-slots.ts
//
// Walks pi-mcp-adapter 5's config sources in its precedence order and records
// every full server definition each one holds (AFILE-05, MC-4, RN-5, closes
// MCPSRC-01). The order, lowest precedence first:
//
//   1. ~/.config/mcp/mcp.json
//   2. ~/.agents/mcp.json
//   3. ~/.agents/mcp/mcp.json
//   4. <Pi agent dir>/mcp.json             (Pi format: `mcpServers` only)
//   5. <Pi agent dir>/mcp-adapter.json     (the user-scope target)
//   6. ancestor files                      (only on a user-global opt-in)
//   7. <cwd>/.mcp.json
//   8. <cwd>/.pi/mcp.json                  (Pi format: `mcpServers` only)
//   9. <cwd>/.pi/mcp-adapter.json          (the project-scope target)
//
// The ancestor files follow `settings.ancestorConfigRoots` from the last
// adapter-format user-global source (1, 2, 3 or 5) that sets it; a project
// file's setting is ignored (see collision-ancestors.ts). An ancestor path
// that is already a global source is not read twice.
//
// A later source wins. Only a full definition (a string `command`, `url` or
// `socket`) declares a server; any other entry is an override the adapter
// merges into a lower definition, so it declares nothing. Adapter-format
// sources hold their servers under `mcpServers`, else `mcp-servers`. A source
// that does not parse, is not an object, or holds a non-object server map
// contributes nothing, as the adapter skips it. Any read error other than a
// missing file (EACCES, EISDIR) propagates.
//
// Out of contract: `imports` host configs, `pi.mcp` package entries,
// `settings.agentPluginPaths`, `claudePlugins`, runtime `registerMcpServer`,
// host-config discovery, `--mcp-config`, `PI_MCP_CONFIG_MODE=exclusive`, a
// file the adapter rejects only through its deeper settings validation, the
// adapter's Pi-format translation checks, and de-duplication of sources that
// alias each other through symlinks.

import { homedir } from "node:os";
import path from "node:path";

import { getAgentDir } from "../../platform/pi-api.ts";
import { McpConfigFileError } from "../../shared/errors-bridges.ts";

import {
  ADAPTER_SERVER_KEYS,
  PI_MCP_SERVER_KEYS,
  isFullDefinition,
  readMcpConfigDoc,
  type McpConfigDoc,
  type McpServerKey,
} from "./adapter-doc.ts";
import { ancestorSourcePaths } from "./collision-ancestors.ts";

/** One full server definition and the source that holds it. */
export interface McpSourceDeclaration {
  readonly sourcePath: string;
  readonly entry: unknown;
}

/** Every source the adapter reads, and the full definitions each holds. */
export interface McpSourceWalk {
  /** Every source path, lowest precedence first. */
  readonly sourcePaths: readonly string[];
  /** Per server name, its full definitions in source order: the last one wins. */
  readonly declarations: ReadonlyMap<string, readonly McpSourceDeclaration[]>;
}

interface McpSource {
  readonly sourcePath: string;
  /** Adapter-format sources may carry `settings`; Pi-format `mcp.json` sources do not. */
  readonly isAdapterFormat: boolean;
}

interface McpSourceRead {
  readonly source: McpSource;
  readonly config: McpConfigDoc | undefined;
}

function adapterSource(sourcePath: string): McpSource {
  return { sourcePath, isAdapterFormat: true };
}

function piSource(sourcePath: string): McpSource {
  return { sourcePath, isAdapterFormat: false };
}

function globalSources(): readonly McpSource[] {
  const home = homedir();
  const agentDir = getAgentDir();
  return [
    adapterSource(path.join(home, ".config", "mcp", "mcp.json")),
    adapterSource(path.join(home, ".agents", "mcp.json")),
    adapterSource(path.join(home, ".agents", "mcp", "mcp.json")),
    piSource(path.join(agentDir, "mcp.json")),
    adapterSource(path.join(agentDir, "mcp-adapter.json")),
  ];
}

function projectSources(cwd: string): readonly McpSource[] {
  return [
    adapterSource(path.join(cwd, ".mcp.json")),
    piSource(path.join(cwd, ".pi", "mcp.json")),
    adapterSource(path.join(cwd, ".pi", "mcp-adapter.json")),
  ];
}

async function readSource(source: McpSource): Promise<McpSourceRead> {
  const serverKeys: readonly [McpServerKey, ...McpServerKey[]] = source.isAdapterFormat
    ? ADAPTER_SERVER_KEYS
    : PI_MCP_SERVER_KEYS;
  try {
    return { source, config: await readMcpConfigDoc(source.sourcePath, serverKeys) };
  } catch (err) {
    if (err instanceof McpConfigFileError) {
      return { source, config: undefined };
    }

    throw err;
  }
}

function isSettingsObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The last `settings.ancestorConfigRoots` an adapter-format global source sets. */
function configuredAncestorRoots(globalReads: readonly McpSourceRead[]): unknown {
  let configured: unknown;
  for (const { source, config } of globalReads) {
    const settings = config?.doc.settings;
    const roots = isSettingsObject(settings) ? settings.ancestorConfigRoots : undefined;
    if (source.isAdapterFormat && roots !== undefined) {
      configured = roots;
    }
  }

  return configured;
}

async function ancestorSources(
  cwd: string,
  globalReads: readonly McpSourceRead[],
): Promise<readonly McpSource[]> {
  const globalPaths = new Set(globalReads.map(({ source }) => path.resolve(source.sourcePath)));
  const ancestorPaths = await ancestorSourcePaths(cwd, configuredAncestorRoots(globalReads));
  return ancestorPaths
    .filter((ancestorPath) => !globalPaths.has(path.resolve(ancestorPath)))
    .map((ancestorPath) => adapterSource(ancestorPath));
}

function addDeclarations(
  declarations: Map<string, McpSourceDeclaration[]>,
  { source, config }: McpSourceRead,
): void {
  const servers = config?.serverMaps.get(config.serverKey) ?? {};
  for (const [name, entry] of Object.entries(servers)) {
    if (!isFullDefinition(entry)) {
      continue;
    }

    const declared = declarations.get(name) ?? [];
    declared.push({ sourcePath: source.sourcePath, entry });
    declarations.set(name, declared);
  }
}

/**
 * Reads pi-mcp-adapter's config sources for `cwd` in precedence order and
 * returns every full server definition, in source order (AFILE-05). Each
 * source is read once.
 */
export async function walkMcpSources(cwd: string): Promise<McpSourceWalk> {
  const globalReads = await Promise.all(globalSources().map((source) => readSource(source)));
  const laterSources = [...(await ancestorSources(cwd, globalReads)), ...projectSources(cwd)];
  const laterReads = await Promise.all(laterSources.map((source) => readSource(source)));
  const reads = [...globalReads, ...laterReads];
  const declarations = new Map<string, McpSourceDeclaration[]>();
  for (const read of reads) {
    addDeclarations(declarations, read);
  }

  return {
    sourcePaths: reads.map(({ source }) => source.sourcePath),
    declarations,
  };
}
