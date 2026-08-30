import type {
  DiscoveredSkill,
  PreparedSkillsNoop,
  PreparedSkillsStaged,
  PreparedSkillsStaging,
  SkillDegradeRecord,
  StageSkillsCommitResult,
  StageSkillsInput,
  StagedSkillRecord,
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
