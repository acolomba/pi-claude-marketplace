import type {
  CommitWorkflowsOptions,
  DiscoveredWorkflow,
  DiscoverPluginWorkflowsResult,
  PreparedWorkflowsNoop,
  PreparedWorkflowsStaged,
  PreparedWorkflowsStaging,
  StageWorkflowsCommitResult,
  StageWorkflowsInput,
  UnstageWorkflowFailure,
  UnstageWorkflowsInput,
  UnstageWorkflowsResult,
  WorkflowDiscoveryTarget,
  WorkflowEnvelope,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";

const discoveredWorkflow: DiscoveredWorkflow = {
  verdict: {
    outcome: "named",
    fileName: "greet.js",
    metaName: "greet",
    generatedName: "acme:greet",
    description: "greets",
  },
  scriptFile: "/plugin/workflows/greet.js",
  source: "export const meta = { name: 'greet', description: 'greets' };\n",
} satisfies DiscoveredWorkflow;
void discoveredWorkflow;

const workflowDiscoveryTarget: WorkflowDiscoveryTarget = {
  pluginRoot: "/plugin",
  componentPaths: { workflows: ["workflows"] },
} satisfies WorkflowDiscoveryTarget;
void workflowDiscoveryTarget;

const discoverPluginWorkflowsResult: DiscoverPluginWorkflowsResult = {
  discovered: [discoveredWorkflow],
  warnings: ['workflow script "helper.js" in "/plugin/workflows" was not installed: no meta'],
} satisfies DiscoverPluginWorkflowsResult;
void discoverPluginWorkflowsResult;

const workflowEnvelope: WorkflowEnvelope = {
  name: "acme:greet",
  description: "greets",
  script: "export const meta = { name: 'greet', description: 'greets' };\n",
} satisfies WorkflowEnvelope;
void workflowEnvelope;

const workflowEnvelopeWithoutDescription: WorkflowEnvelope = {
  name: "acme:greet",
  script: "export const meta = { name: 'greet' };\n",
} satisfies WorkflowEnvelope;
void workflowEnvelopeWithoutDescription;

const stageWorkflowsInput: StageWorkflowsInput = {
  locations: undefined!,
  pluginName: "acme",
  resolved: undefined!,
  previousWorkflowNames: ["acme:old"],
} satisfies StageWorkflowsInput;
void stageWorkflowsInput;

const stageWorkflowsInputWithoutPreviousNames: StageWorkflowsInput = {
  locations: undefined!,
  pluginName: "acme",
  resolved: undefined!,
} satisfies StageWorkflowsInput;
void stageWorkflowsInputWithoutPreviousNames;

const stageWorkflowsCommitResult: StageWorkflowsCommitResult = {
  stagedNames: ["acme:greet"],
  warnings: ['workflow script "helper.js" in "/plugin/workflows" was not installed: no meta'],
  unownedNames: [],
} satisfies StageWorkflowsCommitResult;
void stageWorkflowsCommitResult;

const preparedWorkflowsNoop: PreparedWorkflowsNoop = {
  kind: "noop",
  result: {
    stagedNames: [],
    warnings: [],
    unownedNames: [],
  },
} satisfies PreparedWorkflowsNoop;
void preparedWorkflowsNoop;

const preparedWorkflowsStaged: PreparedWorkflowsStaged = {
  kind: "staged",
  locations: undefined!,
  stagingRoot: "/home/.pi/workflows/.pi-claude-marketplace-staging/0f0f",
  result: stageWorkflowsCommitResult,
  _previousNames: ["acme:old"],
  _renamePairs: [
    {
      name: "acme:greet",
      from: "/home/.pi/workflows/.pi-claude-marketplace-staging/0f0f/acme:greet.json",
      to: "/home/.pi/workflows/saved/acme:greet.json",
    },
  ],
} satisfies PreparedWorkflowsStaged;
void preparedWorkflowsStaged;

void (preparedWorkflowsNoop satisfies PreparedWorkflowsStaging);
void (preparedWorkflowsStaged satisfies PreparedWorkflowsStaging);
void (preparedWorkflowsNoop.kind satisfies "noop");
void (preparedWorkflowsStaged.kind satisfies "staged");

const commitWorkflowsOptions: CommitWorkflowsOptions = {
  onPlaced: (placedNames: readonly string[]): void => {
    void placedNames;
  },
} satisfies CommitWorkflowsOptions;
void commitWorkflowsOptions;

const commitWorkflowsOptionsWithoutCallback: CommitWorkflowsOptions =
  {} satisfies CommitWorkflowsOptions;
void commitWorkflowsOptionsWithoutCallback;

const unstageWorkflowsInput: UnstageWorkflowsInput = {
  locations: undefined!,
  previousWorkflowNames: ["acme:greet"],
} satisfies UnstageWorkflowsInput;
void unstageWorkflowsInput;

const unstageWorkflowFailure: UnstageWorkflowFailure = {
  name: "acme:blocked",
  reason: "EISDIR: illegal operation on a directory",
} satisfies UnstageWorkflowFailure;
void unstageWorkflowFailure;

const unstageWorkflowsResult: UnstageWorkflowsResult = {
  removedNames: ["acme:greet"],
  warnings: [],
  failed: [unstageWorkflowFailure],
} satisfies UnstageWorkflowsResult;
void unstageWorkflowsResult;

// @ts-expect-error a discovered workflow always records the script file it decided
const discoveredWorkflowWithoutFile: DiscoveredWorkflow = {
  verdict: discoveredWorkflow.verdict,
  source: discoveredWorkflow.source,
};
void discoveredWorkflowWithoutFile;

// @ts-expect-error a discovered workflow always carries the bytes stage reuses
const discoveredWorkflowWithoutSource: DiscoveredWorkflow = {
  verdict: discoveredWorkflow.verdict,
  scriptFile: "/plugin/workflows/greet.js",
};
void discoveredWorkflowWithoutSource;

// @ts-expect-error an envelope always carries the script the engine runs
const workflowEnvelopeWithoutScript: WorkflowEnvelope = {
  name: "acme:greet",
  description: "greets",
};
void workflowEnvelopeWithoutScript;

// @ts-expect-error an unstage result always exposes the names it could not remove
const unstageWorkflowsResultWithoutFailed: UnstageWorkflowsResult = {
  removedNames: [],
  warnings: [],
};
void unstageWorkflowsResultWithoutFailed;

// @ts-expect-error an unstage failure always explains why the name survived
const unstageWorkflowFailureWithoutReason: UnstageWorkflowFailure = {
  name: "acme:blocked",
};
void unstageWorkflowFailureWithoutReason;

// @ts-expect-error a staged preparation always carries its staging root
const preparedWorkflowsStagedWithoutRoot: PreparedWorkflowsStaged = {
  kind: "staged",
  locations: undefined!,
  result: stageWorkflowsCommitResult,
  _previousNames: [],
  _renamePairs: [],
};
void preparedWorkflowsStagedWithoutRoot;

// @ts-expect-error a preparation handle has a closed discriminant set
void ({ kind: "prepared", result: stageWorkflowsCommitResult } satisfies PreparedWorkflowsStaging);
// @ts-expect-error a staged preparation requires its commit state
void ({ kind: "staged", result: stageWorkflowsCommitResult } satisfies PreparedWorkflowsStaging);
// @ts-expect-error a noop preparation exposes no staging root
void preparedWorkflowsNoop.stagingRoot;
// @ts-expect-error a discovery target publishes only its workflows component paths
void workflowDiscoveryTarget.componentPaths.skills;

type IsMutableArray<T extends readonly unknown[]> = T extends unknown[] ? true : false;

// @ts-expect-error discovery target workflows paths are a readonly array
void (true satisfies IsMutableArray<WorkflowDiscoveryTarget["componentPaths"]["workflows"]>);
// @ts-expect-error discovery result records are a readonly array
void (true satisfies IsMutableArray<DiscoverPluginWorkflowsResult["discovered"]>);
// @ts-expect-error discovery result warnings are a readonly array
void (true satisfies IsMutableArray<DiscoverPluginWorkflowsResult["warnings"]>);
// @ts-expect-error stage input previous names are a readonly array
void (true satisfies IsMutableArray<NonNullable<StageWorkflowsInput["previousWorkflowNames"]>>);
// @ts-expect-error commit result staged names are a readonly array
void (true satisfies IsMutableArray<StageWorkflowsCommitResult["stagedNames"]>);
// @ts-expect-error commit result warnings are a readonly array
void (true satisfies IsMutableArray<StageWorkflowsCommitResult["warnings"]>);
// @ts-expect-error staged preparation previous names are a readonly array
void (true satisfies IsMutableArray<PreparedWorkflowsStaged["_previousNames"]>);
// @ts-expect-error staged preparation rename pairs are a readonly array
void (true satisfies IsMutableArray<PreparedWorkflowsStaged["_renamePairs"]>);
// @ts-expect-error unstage input previous names are a readonly array
void (true satisfies IsMutableArray<UnstageWorkflowsInput["previousWorkflowNames"]>);
// @ts-expect-error unstage result removed names are a readonly array
void (true satisfies IsMutableArray<UnstageWorkflowsResult["removedNames"]>);
// @ts-expect-error unstage result warnings are a readonly array
void (true satisfies IsMutableArray<UnstageWorkflowsResult["warnings"]>);
// @ts-expect-error unstage result failures are a readonly array
void (true satisfies IsMutableArray<UnstageWorkflowsResult["failed"]>);
