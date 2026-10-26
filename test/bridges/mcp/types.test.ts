import type {
  LegacyMcpOwner,
  McpReplacement,
  McpReplacementNoop,
  McpReplacementReplaced,
  PreparedMcpNoop,
  PreparedMcpStaged,
  PreparedMcpStaging,
  RawMcpDoc,
  RemoveLegacyMcpInput,
  RemoveLegacyMcpResult,
  StageMcpCommitResult,
  StageMcpInput,
  StagedMcpRecord,
  UnstageMcpInput,
  UnstageMcpResult,
} from "../../../extensions/pi-claude-marketplace/bridges/mcp/types.ts";

const wrappedMcpDoc: RawMcpDoc = {
  mcpServers: {
    search: { command: "search-server", args: ["--stdio"] },
  },
  version: 1,
} satisfies RawMcpDoc;
void wrappedMcpDoc;

void ({ mcpServers: null } satisfies RawMcpDoc);
void ({ mcpServers: "malformed" } satisfies RawMcpDoc);
void ({ mcpServers: ["malformed"] } satisfies RawMcpDoc);
void ({ mcpServers: true } satisfies RawMcpDoc);
void ({ mcpServers: 17 } satisfies RawMcpDoc);

const unwrappedMcpDoc: RawMcpDoc = {
  search: { command: "search-server" },
} satisfies RawMcpDoc;
void unwrappedMcpDoc;

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
  env: {},
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
  notices: [{ kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" }],
} satisfies StageMcpCommitResult;
void stageMcpCommitResult;

const preparedMcpNoop: PreparedMcpNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
    notices: [],
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

const preparedMcpLegacyOnly: PreparedMcpStaged = {
  kind: "staged",
  locations: undefined!,
  stagedNames: [],
  result: stageMcpCommitResult,
  _legacy: { pluginName: "acme", marketplaceName: "official", names: ["search"] },
} satisfies PreparedMcpStaged;
void preparedMcpLegacyOnly;

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
  legacy: {
    removedNames: ["search"],
    notices: [{ kind: "comments-dropped", scope: "project", file: "mcp.json" }],
    written: [{ path: "/scope/mcp.json", bytes: Buffer.from("{}\n") }],
  },
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
  notices: [{ kind: "comments-dropped", scope: "user", file: "mcp.json" }],
  written: [{ path: "/scope/mcp.json", bytes: Buffer.from("{}\n") }],
} satisfies UnstageMcpResult;
void unstageMcpResult;

void ({
  plugin: "acme",
  marketplace: "official",
  names: ["search", "deploy"],
} satisfies LegacyMcpOwner);

void ({
  locations: undefined!,
  pluginName: "acme",
  marketplaceName: "official",
} satisfies RemoveLegacyMcpInput);

void ({
  removedNames: ["search"],
  notices: [{ kind: "left-unchanged", scope: "project", file: "mcp.json" }],
  written: [{ path: "/scope/mcp.json", bytes: Buffer.from("{}\n") }],
} satisfies RemoveLegacyMcpResult);

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error validated stage inputs require a server record
void ({ ...stageMcpInput, servers: ["search"] } satisfies StageMcpInput);
// @ts-expect-error stage input always carries the plugin data path
const stageMcpInputWithoutPluginData: StageMcpInput = {
  locations: undefined!,
  cwd: "/work/project",
  marketplaceName: "official",
  pluginName: "acme",
  servers: {},
  pluginRoot: "/plugins/acme",
  env: {},
};
void stageMcpInputWithoutPluginData;
// @ts-expect-error D-08-06: stage input always carries the caller's environment
const stageMcpInputWithoutEnv: StageMcpInput = {
  locations: undefined!,
  cwd: "/work/project",
  marketplaceName: "official",
  pluginName: "acme",
  servers: {},
  pluginRoot: "/plugins/acme",
  pluginData: "/data/official/acme",
};
void stageMcpInputWithoutEnv;
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
// @ts-expect-error staged preparations require their locations and server names
void ({ kind: "staged", result: stageMcpCommitResult } satisfies PreparedMcpStaging);
// @ts-expect-error exact optional properties reject an explicit undefined pending document
void ({ ...preparedMcpStaged, _nextDoc: undefined } satisfies PreparedMcpStaged);
// @ts-expect-error a legacy sweep always names the entries' owner
void ({ ...preparedMcpStaged, _legacy: { names: ["search"] } } satisfies PreparedMcpStaged);
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
void ({ ...mcpReplacementReplaced, prepared: preparedMcpNoop } satisfies McpReplacement);
// @ts-expect-error replaced handles always report the legacy removal
void ({ kind: "replaced", prepared: preparedMcpStaged } satisfies McpReplacement);
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
// @ts-expect-error unstage results always expose the files they wrote
const unstageMcpResultWithoutWritten: UnstageMcpResult = {
  removedNames: [],
  warnings: [],
  notices: [],
};
void unstageMcpResultWithoutWritten;

// @ts-expect-error raw MCP document fields are readonly
wrappedMcpDoc.mcpServers = {};
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
// @ts-expect-error unstage result written files are a readonly array
void (true satisfies IsMutableArray<UnstageMcpResult["written"]>);
// @ts-expect-error a legacy owner's names are a readonly array
void (true satisfies IsMutableArray<LegacyMcpOwner["names"]>);
// @ts-expect-error legacy removal results always expose the files they wrote
void ({ removedNames: [], notices: [] } satisfies RemoveLegacyMcpResult);
