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

const wrappedMcpDoc: RawMcpDoc = {
  mcpServers: {
    search: { command: "search-server", args: ["--stdio"] },
  },
  version: 1,
} satisfies RawMcpDoc;
void wrappedMcpDoc;

const unwrappedMcpDoc: RawMcpDoc = {
  search: { command: "search-server" },
} satisfies RawMcpDoc;
void unwrappedMcpDoc;

const resolvedMcpServers: ResolvedMcpServers = {
  source: "plugin-manifest",
  servers: {
    search: { command: "search-server", args: ["--stdio"] },
  },
} satisfies ResolvedMcpServers;
void resolvedMcpServers;

const resolvePluginMcpServersInput: ResolvePluginMcpServersInput = {
  entry: { mcpServers: { entry: { command: "entry-server" } } },
  manifest: { mcpServers: { manifest: { command: "manifest-server" } } },
  pluginRoot: "/plugins/acme",
} satisfies ResolvePluginMcpServersInput;
void resolvePluginMcpServersInput;

const stageMcpInput: StageMcpInput = {
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

const stagedMcpRecord: StagedMcpRecord = {
  generatedName: "search",
  sourcePath: "/plugins/acme/.mcp.json",
  targetPath: "/scope/mcp.json",
} satisfies StagedMcpRecord;
void stagedMcpRecord;

const stageMcpCommitResult: StageMcpCommitResult = {
  stagedNames: ["search"],
  recorded: [stagedMcpRecord],
  warnings: ["preserved foreign server foreign-search"],
} satisfies StageMcpCommitResult;
void stageMcpCommitResult;

const preparedMcpNoop: PreparedMcpNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
  },
} satisfies PreparedMcpNoop;
void preparedMcpNoop;

const preparedMcpStaged: PreparedMcpStaged = {
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

const mcpReplacementNoop: McpReplacementNoop = {
  kind: "noop",
  prepared: preparedMcpNoop,
} satisfies McpReplacementNoop;
void mcpReplacementNoop;

const mcpReplacementReplaced: McpReplacementReplaced = {
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

const unstageMcpInput: UnstageMcpInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
} satisfies UnstageMcpInput;
void unstageMcpInput;

const unstageMcpResult: UnstageMcpResult = {
  removedNames: ["search"],
  warnings: ["preserved foreign server foreign-search"],
} satisfies UnstageMcpResult;
void unstageMcpResult;

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error MCP sources have a closed precedence vocabulary
void ("plugin-entry" satisfies McpServersSource);
// @ts-expect-error wrapped MCP documents require a server record
void ({ mcpServers: ["search"] } satisfies RawMcpDoc);
// @ts-expect-error resolved MCP servers always identify their source
const resolvedMcpServersWithoutSource: ResolvedMcpServers = {
  servers: {},
};
void resolvedMcpServersWithoutSource;
// @ts-expect-error resolution input always identifies the plugin root
const resolvePluginMcpServersInputWithoutRoot: ResolvePluginMcpServersInput = {
  entry: {},
  manifest: {},
};
void resolvePluginMcpServersInputWithoutRoot;
// @ts-expect-error stage input always carries the plugin data path
const stageMcpInputWithoutPluginData: StageMcpInput = {
  locations: undefined!,
  cwd: "/work/project",
  marketplaceName: "official",
  pluginName: "acme",
  servers: {},
  pluginRoot: "/plugins/acme",
};
void stageMcpInputWithoutPluginData;
// @ts-expect-error exact optional properties reject an explicit undefined source path
void ({ ...stageMcpInput, sourcePath: undefined } satisfies StageMcpInput);
// @ts-expect-error a staged record always identifies its source path
const stagedMcpRecordWithoutSource: StagedMcpRecord = {
  generatedName: "search",
  targetPath: "/scope/mcp.json",
};
void stagedMcpRecordWithoutSource;
// @ts-expect-error a staged record always identifies its target path
const stagedMcpRecordWithoutTarget: StagedMcpRecord = {
  generatedName: "search",
  sourcePath: "/plugins/acme/.mcp.json",
};
void stagedMcpRecordWithoutTarget;
// @ts-expect-error a commit result always exposes recorded provenance rows
const stageMcpCommitResultWithoutRecords: StageMcpCommitResult = {
  stagedNames: [],
  warnings: [],
};
void stageMcpCommitResultWithoutRecords;
// @ts-expect-error a commit result always exposes warnings
const stageMcpCommitResultWithoutWarnings: StageMcpCommitResult = {
  stagedNames: [],
  recorded: [],
};
void stageMcpCommitResultWithoutWarnings;
// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageMcpCommitResult } satisfies PreparedMcpStaging);
// @ts-expect-error staged preparations require their pending document and paths
void ({ kind: "staged", result: stageMcpCommitResult } satisfies PreparedMcpStaging);
// @ts-expect-error noop preparations do not expose staged locations
void preparedMcpNoop.locations;
// @ts-expect-error noop preparations do not expose staged server names
void preparedMcpNoop.stagedNames;
// @ts-expect-error noop preparations do not expose a pending document
void preparedMcpNoop._nextDoc;
// @ts-expect-error staged preparations cannot narrow to the noop arm
void (preparedMcpStaged satisfies PreparedMcpNoop);
// @ts-expect-error noop replacements contain only noop preparations
void mcpReplacementNoop.prepared._nextDoc;
// @ts-expect-error replaced handles require a staged preparation
void ({ kind: "replaced", prepared: preparedMcpNoop } satisfies McpReplacement);
// @ts-expect-error noop handles require a noop preparation
void ({ kind: "noop", prepared: preparedMcpStaged } satisfies McpReplacement);
// @ts-expect-error replacement handles have a closed discriminant set
void ({ kind: "staged", prepared: preparedMcpStaged } satisfies McpReplacement);
// @ts-expect-error replacement handles always carry their preparation
void ({ kind: "noop" } satisfies McpReplacement);
// @ts-expect-error unstage input always identifies its marketplace
const unstageMcpInputWithoutMarketplace: UnstageMcpInput = {
  locations: undefined!,
  pluginName: "acme",
};
void unstageMcpInputWithoutMarketplace;
// @ts-expect-error unstage input always identifies its plugin
const unstageMcpInputWithoutPlugin: UnstageMcpInput = {
  locations: undefined!,
  marketplaceName: "official",
};
void unstageMcpInputWithoutPlugin;
// @ts-expect-error unstage results always expose warnings
const unstageMcpResultWithoutWarnings: UnstageMcpResult = {
  removedNames: [],
};
void unstageMcpResultWithoutWarnings;

// @ts-expect-error raw MCP document fields are readonly
wrappedMcpDoc.mcpServers = {};
// @ts-expect-error resolved MCP sources are readonly
resolvedMcpServers.source = "none";
// @ts-expect-error resolution inputs are readonly
resolvePluginMcpServersInput.pluginRoot = "/changed";
// @ts-expect-error stage inputs are readonly
stageMcpInput.cwd = "/changed";
// @ts-expect-error staged record provenance is readonly
stagedMcpRecord.sourcePath = "/changed";
// @ts-expect-error preparation discriminants are readonly
preparedMcpNoop.kind = "noop";
// @ts-expect-error staged pending documents are readonly
preparedMcpStaged._nextDoc = {};
// @ts-expect-error replacement discriminants are readonly
mcpReplacementReplaced.kind = "replaced";
// @ts-expect-error unstage input identities are readonly
unstageMcpInput.pluginName = "changed";

// @ts-expect-error commit result staged names are a readonly array
void (true satisfies IsMutableArray<StageMcpCommitResult["stagedNames"]>);
// @ts-expect-error commit result records are a readonly array
void (true satisfies IsMutableArray<StageMcpCommitResult["recorded"]>);
// @ts-expect-error commit result warnings are a readonly array
void (true satisfies IsMutableArray<StageMcpCommitResult["warnings"]>);
// @ts-expect-error prepared staged names are a readonly array
void (true satisfies IsMutableArray<PreparedMcpStaged["stagedNames"]>);
// @ts-expect-error unstage result removed names are a readonly array
void (true satisfies IsMutableArray<UnstageMcpResult["removedNames"]>);
// @ts-expect-error unstage result warnings are a readonly array
void (true satisfies IsMutableArray<UnstageMcpResult["warnings"]>);
