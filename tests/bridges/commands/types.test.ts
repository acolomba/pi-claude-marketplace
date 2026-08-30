import type {
  CommandDegradeRecord,
  DiscoveredCommand,
  PreparedCommandsNoop,
  PreparedCommandsStaged,
  PreparedCommandsStaging,
  StageCommandsCommitResult,
  StageCommandsInput,
  StagedCommandRecord,
} from "../../../extensions/pi-claude-marketplace/bridges/commands/types.ts";

const discoveredCommand: DiscoveredCommand = {
  sourceName: "build/deploy",
  generatedName: "acme:build:deploy",
  commandFile: "/plugin/commands/build/deploy.md",
} satisfies DiscoveredCommand;
void discoveredCommand;

const stageCommandsInput: StageCommandsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugin",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
  previousCommandNames: ["acme:old"],
  cwd: "/project",
} satisfies StageCommandsInput;
void stageCommandsInput;

const stagedCommandRecord: StagedCommandRecord = {
  generatedName: "acme:build:deploy",
  sourcePath: "/plugin/commands/build/deploy.md",
  targetPath: "/scope/pi-claude-marketplace/resources/prompts/acme:build:deploy.md",
} satisfies StagedCommandRecord;
void stagedCommandRecord;

const commandDegradeRecord: CommandDegradeRecord = {
  generatedName: "acme:build:deploy",
  parseError: "unterminated frontmatter",
} satisfies CommandDegradeRecord;
void commandDegradeRecord;

const stageCommandsCommitResult: StageCommandsCommitResult = {
  stagedNames: ["acme:build:deploy"],
  recorded: [stagedCommandRecord],
  warnings: ["neutralized malformed frontmatter"],
  degraded: [commandDegradeRecord],
} satisfies StageCommandsCommitResult;
void stageCommandsCommitResult;

const preparedCommandsNoop: PreparedCommandsNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
    degraded: [],
  },
} satisfies PreparedCommandsNoop;
void preparedCommandsNoop;

const preparedCommandsStaged: PreparedCommandsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingRoot: "/scope/pi-claude-marketplace/commands-staging/acme",
  result: stageCommandsCommitResult,
  _previousNames: ["acme:old"],
  _renamePairs: [
    {
      from: "/scope/pi-claude-marketplace/commands-staging/acme/acme:build:deploy.md",
      to: "/scope/pi-claude-marketplace/resources/prompts/acme:build:deploy.md",
    },
  ],
} satisfies PreparedCommandsStaged;
void preparedCommandsStaged;

void (preparedCommandsNoop satisfies PreparedCommandsStaging);
void (preparedCommandsStaged satisfies PreparedCommandsStaging);
void (preparedCommandsNoop.kind satisfies "noop");
void (preparedCommandsStaged.kind satisfies "staged");

// @ts-expect-error a discovered command always records its command file
const discoveredCommandWithoutFile: DiscoveredCommand = {
  sourceName: "build/deploy",
  generatedName: "acme:build:deploy",
};
void discoveredCommandWithoutFile;

// @ts-expect-error a stage input always carries the install cwd
const stageCommandsInputWithoutCwd: StageCommandsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugin",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
};
void stageCommandsInputWithoutCwd;

// @ts-expect-error a staged command always records its target path
const stagedCommandRecordWithoutTarget: StagedCommandRecord = {
  generatedName: "acme:build:deploy",
  sourcePath: "/plugin/commands/build/deploy.md",
};
void stagedCommandRecordWithoutTarget;

// @ts-expect-error a degradation record always explains its parse failure
const commandDegradeRecordWithoutError: CommandDegradeRecord = {
  generatedName: "acme:build:deploy",
};
void commandDegradeRecordWithoutError;

// @ts-expect-error a commit result always exposes degraded command rows
const stageCommandsCommitResultWithoutDegraded: StageCommandsCommitResult = {
  stagedNames: [],
  recorded: [],
  warnings: [],
};
void stageCommandsCommitResultWithoutDegraded;

// @ts-expect-error a staged preparation always carries its rename pairs
const preparedCommandsStagedWithoutRenames: PreparedCommandsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingRoot: "/scope/pi-claude-marketplace/commands-staging/acme",
  result: stageCommandsCommitResult,
  _previousNames: [],
};
void preparedCommandsStagedWithoutRenames;

// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageCommandsCommitResult } satisfies PreparedCommandsStaging);
