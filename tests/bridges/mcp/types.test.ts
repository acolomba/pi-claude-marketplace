import type {
  McpReplacement,
  McpReplacementNoop,
  McpReplacementReplaced,
  McpServersSource,
  PreparedMcpNoop,
  PreparedMcpStaged,
  PreparedMcpStaging,
  RawMcpDoc,
  ResolvedMcpServers,
  ResolvePluginMcpServersInput,
  StageMcpCommitResult,
  StageMcpInput,
  StagedMcpRecord,
  UnstageMcpInput,
  UnstageMcpResult,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/types.ts";

void ("marketplace-entry" satisfies McpServersSource);
void ("plugin-manifest" satisfies McpServersSource);
void ("standalone" satisfies McpServersSource);
void ("none" satisfies McpServersSource);

const wrappedMcpDoc = {
  mcpServers: {
    search: { command: "search-server", args: ["--stdio"] },
  },
  version: 1,
} satisfies RawMcpDoc;
void wrappedMcpDoc;

const unwrappedMcpDoc = {
  search: { command: "search-server" },
} satisfies RawMcpDoc;
void unwrappedMcpDoc;

const resolvedMcpServers = {
  source: "plugin-manifest",
  servers: {
    search: { command: "search-server", args: ["--stdio"] },
  },
} satisfies ResolvedMcpServers;
void resolvedMcpServers;

const resolvePluginMcpServersInput = {
  entry: { mcpServers: { entry: { command: "entry-server" } } },
  manifest: { mcpServers: { manifest: { command: "manifest-server" } } },
  pluginRoot: "/plugins/acme",
} satisfies ResolvePluginMcpServersInput;
void resolvePluginMcpServersInput;

const stageMcpInput = {
  locations: undefined!,
  cwd: "/work/project",
  marketplaceName: "official",
  pluginName: "acme",
  servers: {
    search: { command: "${CLAUDE_PLUGIN_ROOT}/bin/search" },
  },
  pluginRoot: "/plugins/acme",
  pluginData: "/data/official/acme",
  sourcePath: "/plugins/acme/.mcp.json",
} satisfies StageMcpInput;
void stageMcpInput;

const stagedMcpRecord = {
  generatedName: "search",
  sourcePath: "/plugins/acme/.mcp.json",
  targetPath: "/scope/mcp.json",
} satisfies StagedMcpRecord;
void stagedMcpRecord;

const stageMcpCommitResult = {
  stagedNames: ["search"],
  recorded: [stagedMcpRecord],
  warnings: ["preserved foreign server foreign-search"],
} satisfies StageMcpCommitResult;
void stageMcpCommitResult;

const preparedMcpNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
  },
} satisfies PreparedMcpNoop;
void preparedMcpNoop;

const preparedMcpStaged = {
  kind: "staged",
  locations: undefined!,
  stagedNames: ["search"],
  result: stageMcpCommitResult,
  _nextDoc: wrappedMcpDoc,
} satisfies PreparedMcpStaged;
void preparedMcpStaged;

void (preparedMcpNoop satisfies PreparedMcpStaging);
void (preparedMcpStaged satisfies PreparedMcpStaging);
void (preparedMcpNoop.kind satisfies "noop");
void (preparedMcpStaged.kind satisfies "staged");

const mcpReplacementNoop = {
  kind: "noop",
  prepared: preparedMcpNoop,
} satisfies McpReplacementNoop;
void mcpReplacementNoop;

const mcpReplacementReplaced = {
  kind: "replaced",
  prepared: preparedMcpStaged,
} satisfies McpReplacementReplaced;
void mcpReplacementReplaced;

void (mcpReplacementNoop satisfies McpReplacement);
void (mcpReplacementReplaced satisfies McpReplacement);
void (mcpReplacementNoop.kind satisfies "noop");
void (mcpReplacementReplaced.kind satisfies "replaced");
void (mcpReplacementNoop.prepared.kind satisfies "noop");
void (mcpReplacementReplaced.prepared.kind satisfies "staged");

const unstageMcpInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
} satisfies UnstageMcpInput;
void unstageMcpInput;

const unstageMcpResult = {
  removedNames: ["search"],
  warnings: ["preserved foreign server foreign-search"],
} satisfies UnstageMcpResult;
void unstageMcpResult;

// @ts-expect-error MCP sources have a closed precedence vocabulary
void ("plugin-entry" satisfies McpServersSource);
// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageMcpCommitResult } satisfies PreparedMcpStaging);
