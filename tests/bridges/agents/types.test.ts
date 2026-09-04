import type {
  AgentsReplacement,
  AgentsReplacementNoop,
  AgentsReplacementReplaced,
  ConvertedAgent,
  DiscoveredAgent,
  PreparedAgentsNoop,
  PreparedAgentsStaging,
  PreparedAgentsStaged,
  RawAgentFrontmatter,
  ReplacePreparedAgentsOptions,
  StageAgentsCommitResult,
  StageAgentsInput,
  StagedAgentRecord,
  UnstageAgentFailure,
  UnstageAgentsInput,
  UnstageAgentsResult,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

const rawAgentFrontmatter: RawAgentFrontmatter = {
  name: "reviewer",
  description: "Reviews changes",
  model: "sonnet",
  tools: "Read, Grep",
  disallowedTools: "Write",
  thinking: "enabled",
  effort: "high",
  skills: "testing",
  custom: { owner: "plugin" },
} satisfies RawAgentFrontmatter;
void rawAgentFrontmatter;

const discoveredAgent: DiscoveredAgent = {
  sourceName: "reviewer",
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
  sourceHash: "source-hash",
  raw: { name: "reviewer", model: "sonnet" },
  body: "Review the change.\n",
} satisfies DiscoveredAgent;
void discoveredAgent;

const convertedAgent: ConvertedAgent = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourceName: "reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
  sourceHash: "source-hash",
  fileContent: "---\nname: pi-claude-marketplace-acme-reviewer\n---\nReview the change.\n",
  originalModel: "sonnet",
  droppedFields: ["thinking"],
  droppedTools: ["WebFetch"],
  warnings: ["dropped unsupported tool WebFetch"],
} satisfies ConvertedAgent;
void convertedAgent;

const stageAgentsInput: StageAgentsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugin",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
  agentsSourceDir: "/plugin/agents",
  knownSkills: ["pi-claude-marketplace-acme-testing"],
  mapModel: true,
  cwd: "/project",
} satisfies StageAgentsInput;
void stageAgentsInput;

const stagedAgentRecord: StagedAgentRecord = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
  targetPath: "/scope/agents/pi-claude-marketplace-acme-reviewer.md",
} satisfies StagedAgentRecord;
void stagedAgentRecord;

const unstageAgentFailure: UnstageAgentFailure = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  targetPath: "/scope/agents/pi-claude-marketplace-acme-reviewer.md",
  reason: "foreign content",
} satisfies UnstageAgentFailure;
void unstageAgentFailure;

const stageAgentsCommitResult: StageAgentsCommitResult = {
  stagedNames: ["pi-claude-marketplace-acme-reviewer"],
  recorded: [stagedAgentRecord],
  warnings: ["dropped unsupported tool WebFetch"],
  failed: [unstageAgentFailure],
} satisfies StageAgentsCommitResult;
void stageAgentsCommitResult;

const preparedAgentsNoop: PreparedAgentsNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
    failed: [],
  },
} satisfies PreparedAgentsNoop;
void preparedAgentsNoop;

const preparedAgentsStaged: PreparedAgentsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingDir: "/scope/pi-claude-marketplace/agents-staging/acme",
  result: stageAgentsCommitResult,
  _previousEntries: [],
  _foreignPreservedEntries: [],
  _otherEntries: [],
  _newEntries: [],
  _stagedFilePaths: [
    {
      from: "/scope/pi-claude-marketplace/agents-staging/acme/reviewer.md",
      to: "/scope/agents/pi-claude-marketplace-acme-reviewer.md",
    },
  ],
} satisfies PreparedAgentsStaged;
void preparedAgentsStaged;

// @ts-expect-error known frontmatter fields keep their declared string type
void ({ name: 42 } satisfies RawAgentFrontmatter);
// @ts-expect-error a discovered agent always records its source hash
const discoveredAgentWithoutSourceHash: DiscoveredAgent = {
  sourceName: "reviewer",
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
  raw: {},
  body: "Review the change.\n",
};
void discoveredAgentWithoutSourceHash;
// @ts-expect-error a converted agent always records warnings
const convertedAgentWithoutWarnings: ConvertedAgent = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourceName: "reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
  sourceHash: "source-hash",
  fileContent: "Review the change.\n",
  droppedFields: [],
  droppedTools: [],
};
void convertedAgentWithoutWarnings;
// @ts-expect-error a stage input always carries the install cwd
const stageAgentsInputWithoutCwd: StageAgentsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugin",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
  agentsSourceDir: null,
};
void stageAgentsInputWithoutCwd;
// @ts-expect-error a staged record always identifies its target path
const stagedAgentRecordWithoutTargetPath: StagedAgentRecord = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  sourcePath: "/plugin/agents/reviewer.md",
};
void stagedAgentRecordWithoutTargetPath;
// @ts-expect-error an unstage failure always explains its reason
const unstageAgentFailureWithoutReason: UnstageAgentFailure = {
  generatedName: "pi-claude-marketplace-acme-reviewer",
  targetPath: "/scope/agents/pi-claude-marketplace-acme-reviewer.md",
};
void unstageAgentFailureWithoutReason;
// @ts-expect-error a commit result always exposes its failed rows
const stageAgentsCommitResultWithoutFailures: StageAgentsCommitResult = {
  stagedNames: [],
  recorded: [],
  warnings: [],
};
void stageAgentsCommitResultWithoutFailures;
// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageAgentsCommitResult } satisfies PreparedAgentsNoop);

void (preparedAgentsNoop satisfies PreparedAgentsStaging);
void (preparedAgentsStaged satisfies PreparedAgentsStaging);
void (preparedAgentsNoop.kind satisfies "noop");
void (preparedAgentsStaged.kind satisfies "staged");

const replacePreparedAgentsOptions: ReplacePreparedAgentsOptions = {
  force: true,
} satisfies ReplacePreparedAgentsOptions;
void replacePreparedAgentsOptions;
void ({} satisfies ReplacePreparedAgentsOptions);

const agentsReplacementNoop: AgentsReplacementNoop = {
  kind: "noop",
  prepared: preparedAgentsNoop,
} satisfies AgentsReplacementNoop;
void agentsReplacementNoop;

const agentsReplacementReplaced: AgentsReplacementReplaced = {
  kind: "replaced",
  prepared: preparedAgentsStaged,
} satisfies AgentsReplacementReplaced;
void agentsReplacementReplaced;
void (agentsReplacementNoop satisfies AgentsReplacement);
void (agentsReplacementReplaced satisfies AgentsReplacement);
void (agentsReplacementNoop.kind satisfies "noop");
void (agentsReplacementReplaced.kind satisfies "replaced");
void (agentsReplacementNoop.prepared.kind satisfies "noop");
void (agentsReplacementReplaced.prepared.kind satisfies "staged");

const unstageAgentsInput: UnstageAgentsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
} satisfies UnstageAgentsInput;
void unstageAgentsInput;

const unstageAgentsResult: UnstageAgentsResult = {
  removedNames: ["pi-claude-marketplace-acme-reviewer"],
  failed: [unstageAgentFailure],
  warnings: ["preserved foreign content"],
} satisfies UnstageAgentsResult;
void unstageAgentsResult;

// @ts-expect-error raw frontmatter fields are readonly
rawAgentFrontmatter.name = "changed";
// @ts-expect-error discovered agent identities are readonly
discoveredAgent.sourceName = "changed";
// @ts-expect-error converted agent warnings are readonly
convertedAgent.warnings = [];
// @ts-expect-error stage input paths are readonly
stageAgentsInput.cwd = "/changed";
// @ts-expect-error staged record targets are readonly
stagedAgentRecord.targetPath = "/changed";
// @ts-expect-error unstage failure reasons are readonly
unstageAgentFailure.reason = "changed";
// @ts-expect-error commit result failure rows are readonly
stageAgentsCommitResult.failed = [];
// @ts-expect-error prepare discriminants are readonly
preparedAgentsNoop.kind = "noop";
// @ts-expect-error replacement options are readonly
replacePreparedAgentsOptions.force = false;
// @ts-expect-error replacement discriminants are readonly
agentsReplacementReplaced.kind = "replaced";
// @ts-expect-error unstage input identities are readonly
unstageAgentsInput.pluginName = "changed";
// @ts-expect-error unstage result warnings are readonly
unstageAgentsResult.warnings = [];

// @ts-expect-error noop preparations do not expose staging paths
void preparedAgentsNoop.stagingDir;
// @ts-expect-error staged preparations do not expose a replacement handle
void preparedAgentsStaged.prepared;
// @ts-expect-error noop replacements contain only noop preparations
void agentsReplacementNoop.prepared.stagingDir;
// @ts-expect-error replaced handles require a staged preparation
void ({ kind: "replaced", prepared: preparedAgentsNoop } satisfies AgentsReplacement);
// @ts-expect-error replacement options accept only a boolean force flag
void ({ force: "yes" } satisfies ReplacePreparedAgentsOptions);
// @ts-expect-error exact optional properties reject an explicit undefined force flag
void ({ force: undefined } satisfies ReplacePreparedAgentsOptions);
// @ts-expect-error an agent replacement has a closed discriminant set
void ({ kind: "staged", prepared: preparedAgentsStaged } satisfies AgentsReplacement);
// @ts-expect-error unstage input always identifies its plugin
const unstageAgentsInputWithoutPlugin: UnstageAgentsInput = {
  locations: undefined!,
  marketplaceName: "official",
};
void unstageAgentsInputWithoutPlugin;
// @ts-expect-error unstage results always expose warnings
const unstageAgentsResultWithoutWarnings: UnstageAgentsResult = {
  removedNames: [],
  failed: [],
};
void unstageAgentsResultWithoutWarnings;
