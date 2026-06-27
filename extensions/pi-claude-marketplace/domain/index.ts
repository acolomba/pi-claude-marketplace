// domain/index.ts -- public API surface for the domain/ tier

export type { ParsedSource, PathSource, GitHubSource, UnknownSource } from "./source.ts";
export { parsePluginSource, pathSource, githubSource } from "./source.ts";

export type { MarketplaceManifest } from "./manifest.ts";
export { MARKETPLACE_SCHEMA, MARKETPLACE_VALIDATOR } from "./manifest.ts";

export type { PluginEntry, PluginManifest } from "./components/plugin.ts";
export {
  PLUGIN_ENTRY_SCHEMA,
  PLUGIN_MANIFEST_SCHEMA,
  PLUGIN_ENTRY_VALIDATOR,
  PLUGIN_MANIFEST_VALIDATOR,
} from "./components/plugin.ts";

export type { MCPServers } from "./components/mcp.ts";
export { MCP_SERVERS_SCHEMA, MCP_SERVERS_VALIDATOR } from "./components/mcp.ts";

export {
  assertSafeName,
  generatedSkillName,
  generatedCommandName,
  generatedAgentName,
} from "./name.ts";

export { computeHashVersion, HASH_WALK_SKIP } from "./version.ts";

export type {
  ResolvedPlugin,
  ResolvedPluginInstallable,
  ResolvedPluginUnsupported,
  ResolvedPluginUnavailable,
  MaterializablePlugin,
  ResolveContext,
} from "./resolver.ts";
export {
  ResolvedPluginSchema,
  resolveStrict,
  resolveLoose,
  requireInstallable,
  requireForceInstallable,
} from "./resolver.ts";
