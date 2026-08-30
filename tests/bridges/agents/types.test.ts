import type {
  ConvertedAgent,
  DiscoveredAgent,
  PreparedAgentsNoop,
  PreparedAgentsStaged,
  RawAgentFrontmatter,
  StageAgentsCommitResult,
  StageAgentsInput,
  StagedAgentRecord,
  UnstageAgentFailure,
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
