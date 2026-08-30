import type {
  DiscoveredSkill,
  PreparedSkillsNoop,
  PreparedSkillsStaged,
  PreparedSkillsStaging,
  SkillDegradeRecord,
  SkillsReplacement,
  SkillsReplacementNoop,
  SkillsReplacementReplaced,
  StageSkillsCommitResult,
  StageSkillsInput,
  StagedSkillRecord,
  UnstageSkillsInput,
  UnstageSkillsResult,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/types.ts";

const discoveredSkill: DiscoveredSkill = {
  sourceName: "deploy",
  generatedName: "acme-deploy",
  skillDir: "/plugins/acme/skills/deploy",
} satisfies DiscoveredSkill;
void discoveredSkill;

const stageSkillsInput: StageSkillsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugins/acme",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
  previousSkillNames: ["acme-obsolete"],
  cwd: "/work/project",
} satisfies StageSkillsInput;
void stageSkillsInput;

const stagedSkillRecord: StagedSkillRecord = {
  generatedName: "acme-deploy",
  sourcePath: "/plugins/acme/skills/deploy",
  targetPath: "/scope/pi-claude-marketplace/resources/skills/acme-deploy",
} satisfies StagedSkillRecord;
void stagedSkillRecord;

const skillDegradeRecord: SkillDegradeRecord = {
  generatedName: "acme-deploy",
  parseError: "unterminated frontmatter",
} satisfies SkillDegradeRecord;
void skillDegradeRecord;

const stageSkillsCommitResult: StageSkillsCommitResult = {
  stagedNames: ["acme-deploy"],
  recorded: [stagedSkillRecord],
  warnings: ["neutralized malformed frontmatter"],
  degraded: [skillDegradeRecord],
} satisfies StageSkillsCommitResult;
void stageSkillsCommitResult;

const preparedSkillsNoop: PreparedSkillsNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    recorded: [],
    warnings: [],
    degraded: [],
  },
} satisfies PreparedSkillsNoop;
void preparedSkillsNoop;

const preparedSkillsStaged: PreparedSkillsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingRoot: "/scope/pi-claude-marketplace/skills-staging/acme",
  result: stageSkillsCommitResult,
  _previousNames: ["acme-obsolete"],
  _renamePairs: [
    {
      from: "/scope/pi-claude-marketplace/skills-staging/acme/acme-deploy",
      to: "/scope/pi-claude-marketplace/resources/skills/acme-deploy",
    },
  ],
} satisfies PreparedSkillsStaged;
void preparedSkillsStaged;

void (preparedSkillsNoop satisfies PreparedSkillsStaging);
void (preparedSkillsStaged satisfies PreparedSkillsStaging);
void (preparedSkillsNoop.kind satisfies "noop");
void (preparedSkillsStaged.kind satisfies "staged");

// @ts-expect-error a discovered skill always identifies its source directory
const discoveredSkillWithoutDirectory: DiscoveredSkill = {
  sourceName: "deploy",
  generatedName: "acme-deploy",
};
void discoveredSkillWithoutDirectory;

// @ts-expect-error a stage input always carries the install cwd
const stageSkillsInputWithoutCwd: StageSkillsInput = {
  locations: undefined!,
  marketplaceName: "official",
  pluginName: "acme",
  pluginRoot: "/plugins/acme",
  pluginDataDir: "/data/official/acme",
  resolved: undefined!,
};
void stageSkillsInputWithoutCwd;

// @ts-expect-error a staged skill always identifies its target path
const stagedSkillRecordWithoutTarget: StagedSkillRecord = {
  generatedName: "acme-deploy",
  sourcePath: "/plugins/acme/skills/deploy",
};
void stagedSkillRecordWithoutTarget;

// @ts-expect-error a degradation record always explains its parse failure
const skillDegradeRecordWithoutError: SkillDegradeRecord = {
  generatedName: "acme-deploy",
};
void skillDegradeRecordWithoutError;

// @ts-expect-error a commit result always exposes degraded skill rows
const stageSkillsCommitResultWithoutDegraded: StageSkillsCommitResult = {
  stagedNames: [],
  recorded: [],
  warnings: [],
};
void stageSkillsCommitResultWithoutDegraded;

// @ts-expect-error a staged preparation always carries its rename pairs
const preparedSkillsStagedWithoutRenames: PreparedSkillsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingRoot: "/scope/pi-claude-marketplace/skills-staging/acme",
  result: stageSkillsCommitResult,
  _previousNames: [],
};
void preparedSkillsStagedWithoutRenames;

// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageSkillsCommitResult } satisfies PreparedSkillsStaging);

const skillsReplacementNoop: SkillsReplacementNoop = {
  kind: "noop",
  prepared: preparedSkillsNoop,
} satisfies SkillsReplacementNoop;
void skillsReplacementNoop;

const skillsReplacementReplaced: SkillsReplacementReplaced = {
  kind: "replaced",
  prepared: preparedSkillsStaged,
} satisfies SkillsReplacementReplaced;
void skillsReplacementReplaced;

void (skillsReplacementNoop satisfies SkillsReplacement);
void (skillsReplacementReplaced satisfies SkillsReplacement);
void (skillsReplacementNoop.kind satisfies "noop");
void (skillsReplacementReplaced.kind satisfies "replaced");
void (skillsReplacementNoop.prepared.kind satisfies "noop");
void (skillsReplacementReplaced.prepared.kind satisfies "staged");

const unstageSkillsInput: UnstageSkillsInput = {
  locations: undefined!,
  previousSkillNames: ["acme-deploy"],
} satisfies UnstageSkillsInput;
void unstageSkillsInput;

const unstageSkillsResult: UnstageSkillsResult = {
  removedNames: ["acme-deploy"],
  warnings: ["preserved foreign skill acme-foreign"],
} satisfies UnstageSkillsResult;
void unstageSkillsResult;

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error previous skill names are a readonly array
void (true satisfies IsMutableArray<NonNullable<StageSkillsInput["previousSkillNames"]>>);
// @ts-expect-error commit result staged names are a readonly array
void (true satisfies IsMutableArray<StageSkillsCommitResult["stagedNames"]>);
// @ts-expect-error commit result records are a readonly array
void (true satisfies IsMutableArray<StageSkillsCommitResult["recorded"]>);
// @ts-expect-error commit result warnings are a readonly array
void (true satisfies IsMutableArray<StageSkillsCommitResult["warnings"]>);
// @ts-expect-error commit result degraded rows are a readonly array
void (true satisfies IsMutableArray<StageSkillsCommitResult["degraded"]>);
// @ts-expect-error staged preparation previous names are a readonly array
void (true satisfies IsMutableArray<PreparedSkillsStaged["_previousNames"]>);
// @ts-expect-error staged preparation rename pairs are a readonly array
void (true satisfies IsMutableArray<PreparedSkillsStaged["_renamePairs"]>);
// @ts-expect-error unstage input skill names are a readonly array
void (true satisfies IsMutableArray<UnstageSkillsInput["previousSkillNames"]>);
// @ts-expect-error unstage result removed names are a readonly array
void (true satisfies IsMutableArray<UnstageSkillsResult["removedNames"]>);
// @ts-expect-error unstage result warnings are a readonly array
void (true satisfies IsMutableArray<UnstageSkillsResult["warnings"]>);

// @ts-expect-error noop preparations do not expose staging roots
void preparedSkillsNoop.stagingRoot;
// @ts-expect-error staged preparations do not expose a wrapped preparation
void preparedSkillsStaged.prepared;
// @ts-expect-error staged preparations require staging state
void ({ kind: "staged", result: stageSkillsCommitResult } satisfies PreparedSkillsStaging);
// @ts-expect-error noop replacements contain only noop preparations
void skillsReplacementNoop.prepared.stagingRoot;
// @ts-expect-error replaced handles require a staged preparation
void ({ kind: "replaced", prepared: preparedSkillsNoop } satisfies SkillsReplacement);
// @ts-expect-error noop handles require a noop preparation
void ({ kind: "noop", prepared: preparedSkillsStaged } satisfies SkillsReplacement);
// @ts-expect-error a skill replacement has a closed discriminant set
void ({ kind: "staged", prepared: preparedSkillsStaged } satisfies SkillsReplacement);
// @ts-expect-error a replacement handle always carries its preparation
void ({ kind: "noop" } satisfies SkillsReplacement);

// @ts-expect-error unstage input always carries the previous skill names
const unstageSkillsInputWithoutNames: UnstageSkillsInput = {
  locations: undefined!,
};
void unstageSkillsInputWithoutNames;

// @ts-expect-error unstage results always expose warnings
const unstageSkillsResultWithoutWarnings: UnstageSkillsResult = {
  removedNames: [],
};
void unstageSkillsResultWithoutWarnings;
