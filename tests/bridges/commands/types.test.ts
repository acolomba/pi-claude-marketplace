import type {
  CommandDegradeRecord,
  CommandsReplacement,
  CommandsReplacementNoop,
  CommandsReplacementReplaced,
  DiscoveredCommand,
  PreparedCommandsNoop,
  PreparedCommandsStaged,
  PreparedCommandsStaging,
  StageCommandsCommitResult,
  StageCommandsInput,
  StagedCommandRecord,
  UnstageCommandsInput,
  UnstageCommandsResult,
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

const commandsReplacementNoop: CommandsReplacementNoop = {
  kind: "noop",
  prepared: preparedCommandsNoop,
} satisfies CommandsReplacementNoop;
void commandsReplacementNoop;

const commandsReplacementReplaced: CommandsReplacementReplaced = {
  kind: "replaced",
  prepared: preparedCommandsStaged,
} satisfies CommandsReplacementReplaced;
void commandsReplacementReplaced;

void (commandsReplacementNoop satisfies CommandsReplacement);
void (commandsReplacementReplaced satisfies CommandsReplacement);
void (commandsReplacementNoop.kind satisfies "noop");
void (commandsReplacementReplaced.kind satisfies "replaced");
void (commandsReplacementNoop.prepared.kind satisfies "noop");
void (commandsReplacementReplaced.prepared.kind satisfies "staged");

const unstageCommandsInput: UnstageCommandsInput = {
  locations: undefined!,
  previousCommandNames: ["acme:build:deploy"],
} satisfies UnstageCommandsInput;
void unstageCommandsInput;

const unstageCommandsResult: UnstageCommandsResult = {
  removedNames: ["acme:build:deploy"],
  warnings: ["preserved foreign command acme:foreign"],
} satisfies UnstageCommandsResult;
void unstageCommandsResult;

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error stage input command names are a readonly array
void (true satisfies IsMutableArray<NonNullable<StageCommandsInput["previousCommandNames"]>>);
// @ts-expect-error commit result staged names are a readonly array
void (true satisfies IsMutableArray<StageCommandsCommitResult["stagedNames"]>);
// @ts-expect-error commit result records are a readonly array
void (true satisfies IsMutableArray<StageCommandsCommitResult["recorded"]>);
// @ts-expect-error commit result warnings are a readonly array
void (true satisfies IsMutableArray<StageCommandsCommitResult["warnings"]>);
// @ts-expect-error commit result degraded rows are a readonly array
void (true satisfies IsMutableArray<StageCommandsCommitResult["degraded"]>);
// @ts-expect-error staged preparation previous names are a readonly array
void (true satisfies IsMutableArray<PreparedCommandsStaged["_previousNames"]>);
// @ts-expect-error staged preparation rename pairs are a readonly array
void (true satisfies IsMutableArray<PreparedCommandsStaged["_renamePairs"]>);
// @ts-expect-error unstage input command names are a readonly array
void (true satisfies IsMutableArray<UnstageCommandsInput["previousCommandNames"]>);
// @ts-expect-error unstage result removed names are a readonly array
void (true satisfies IsMutableArray<UnstageCommandsResult["removedNames"]>);
// @ts-expect-error unstage result warnings are a readonly array
void (true satisfies IsMutableArray<UnstageCommandsResult["warnings"]>);

// @ts-expect-error noop preparations do not expose staging roots
void preparedCommandsNoop.stagingRoot;
// @ts-expect-error staged preparations do not expose a wrapped preparation
void preparedCommandsStaged.prepared;
// @ts-expect-error staged preparations require staging state
void ({ kind: "staged", result: stageCommandsCommitResult } satisfies PreparedCommandsStaging);
// @ts-expect-error noop replacements contain only noop preparations
void commandsReplacementNoop.prepared.stagingRoot;
// @ts-expect-error replaced handles require a staged preparation
void ({ kind: "replaced", prepared: preparedCommandsNoop } satisfies CommandsReplacement);
// @ts-expect-error noop handles require a noop preparation
void ({ kind: "noop", prepared: preparedCommandsStaged } satisfies CommandsReplacement);
// @ts-expect-error a command replacement has a closed discriminant set
void ({ kind: "staged", prepared: preparedCommandsStaged } satisfies CommandsReplacement);
// @ts-expect-error a replacement handle always carries its preparation
void ({ kind: "noop" } satisfies CommandsReplacement);

// @ts-expect-error unstage input always carries the previous command names
const unstageCommandsInputWithoutNames: UnstageCommandsInput = {
  locations: undefined!,
};
void unstageCommandsInputWithoutNames;

// @ts-expect-error unstage results always expose warnings
const unstageCommandsResultWithoutWarnings: UnstageCommandsResult = {
  removedNames: [],
};
void unstageCommandsResultWithoutWarnings;
