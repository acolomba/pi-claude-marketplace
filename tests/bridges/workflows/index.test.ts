import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { discoverPluginWorkflows as definingDiscoverPluginWorkflows } from "../../../extensions/pi-claude-marketplace/bridges/workflows/discover.ts";
import {
  abortPreparedWorkflows,
  commitPreparedWorkflows,
  discoverPluginWorkflows,
  prepareStageWorkflows,
  unstagePluginWorkflows,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/index.ts";
import {
  abortPreparedWorkflows as definingAbortPreparedWorkflows,
  commitPreparedWorkflows as definingCommitPreparedWorkflows,
  prepareStageWorkflows as definingPrepareStageWorkflows,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/stage.ts";
import { unstagePluginWorkflows as definingUnstagePluginWorkflows } from "../../../extensions/pi-claude-marketplace/bridges/workflows/unstage.ts";

import type * as WorkflowsBarrel from "../../../extensions/pi-claude-marketplace/bridges/workflows/index.ts";
import type {
  CommitWorkflowsOptions as BarrelCommitWorkflowsOptions,
  DiscoveredWorkflow as BarrelDiscoveredWorkflow,
  DiscoverPluginWorkflowsResult as BarrelDiscoverPluginWorkflowsResult,
  PreparedWorkflowsStaging as BarrelPreparedWorkflowsStaging,
  StageWorkflowsCommitResult as BarrelStageWorkflowsCommitResult,
  StageWorkflowsInput as BarrelStageWorkflowsInput,
  UnstageWorkflowFailure as BarrelUnstageWorkflowFailure,
  UnstageWorkflowsInput as BarrelUnstageWorkflowsInput,
  UnstageWorkflowsResult as BarrelUnstageWorkflowsResult,
  WorkflowDiscoveryTarget as BarrelWorkflowDiscoveryTarget,
  WorkflowEnvelope as BarrelWorkflowEnvelope,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/index.ts";
import type {
  CommitWorkflowsOptions as DefiningCommitWorkflowsOptions,
  DiscoveredWorkflow as DefiningDiscoveredWorkflow,
  DiscoverPluginWorkflowsResult as DefiningDiscoverPluginWorkflowsResult,
  PreparedWorkflowsStaging as DefiningPreparedWorkflowsStaging,
  StageWorkflowsCommitResult as DefiningStageWorkflowsCommitResult,
  StageWorkflowsInput as DefiningStageWorkflowsInput,
  UnstageWorkflowFailure as DefiningUnstageWorkflowFailure,
  UnstageWorkflowsInput as DefiningUnstageWorkflowsInput,
  UnstageWorkflowsResult as DefiningUnstageWorkflowsResult,
  WorkflowDiscoveryTarget as DefiningWorkflowDiscoveryTarget,
  WorkflowEnvelope as DefiningWorkflowEnvelope,
} from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedWorkflowsNoop = Extract<BarrelPreparedWorkflowsStaging, { kind: "noop" }>;
type PreparedWorkflowsStaged = Extract<BarrelPreparedWorkflowsStaging, { kind: "staged" }>;

void (true satisfies Same<BarrelCommitWorkflowsOptions, DefiningCommitWorkflowsOptions>);
void (true satisfies Same<BarrelDiscoveredWorkflow, DefiningDiscoveredWorkflow>);
void (true satisfies Same<
  BarrelDiscoverPluginWorkflowsResult,
  DefiningDiscoverPluginWorkflowsResult
>);
void (true satisfies Same<BarrelPreparedWorkflowsStaging, DefiningPreparedWorkflowsStaging>);
void (true satisfies Same<BarrelStageWorkflowsCommitResult, DefiningStageWorkflowsCommitResult>);
void (true satisfies Same<BarrelStageWorkflowsInput, DefiningStageWorkflowsInput>);
void (true satisfies Same<BarrelUnstageWorkflowFailure, DefiningUnstageWorkflowFailure>);
void (true satisfies Same<BarrelUnstageWorkflowsInput, DefiningUnstageWorkflowsInput>);
void (true satisfies Same<BarrelUnstageWorkflowsResult, DefiningUnstageWorkflowsResult>);
void (true satisfies Same<BarrelWorkflowDiscoveryTarget, DefiningWorkflowDiscoveryTarget>);
void (true satisfies Same<BarrelWorkflowEnvelope, DefiningWorkflowEnvelope>);
void (true satisfies Same<PreparedWorkflowsNoop["kind"], "noop">);
void (true satisfies Same<PreparedWorkflowsStaged["kind"], "staged">);

// @ts-expect-error the barrel withholds the noop arm, so it is reachable only by narrowing the union
void (true satisfies Same<WorkflowsBarrel.PreparedWorkflowsNoop, never>);
// @ts-expect-error the barrel withholds the staged arm, keeping its commit state bridge-internal
void (true satisfies Same<WorkflowsBarrel.PreparedWorkflowsStaged, never>);

describe("abortPreparedWorkflows", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedWorkflows = definingAbortPreparedWorkflows;

    // act
    const workflowsAbortPreparedWorkflows = abortPreparedWorkflows;

    // assert
    assert.strictEqual(workflowsAbortPreparedWorkflows, expectedAbortPreparedWorkflows);
  });
});

describe("commitPreparedWorkflows", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedCommitPreparedWorkflows = definingCommitPreparedWorkflows;

    // act
    const workflowsCommitPreparedWorkflows = commitPreparedWorkflows;

    // assert
    assert.strictEqual(workflowsCommitPreparedWorkflows, expectedCommitPreparedWorkflows);
  });
});

describe("discoverPluginWorkflows", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedDiscoverPluginWorkflows = definingDiscoverPluginWorkflows;

    // act
    const workflowsDiscoverPluginWorkflows = discoverPluginWorkflows;

    // assert
    assert.strictEqual(workflowsDiscoverPluginWorkflows, expectedDiscoverPluginWorkflows);
  });
});

describe("prepareStageWorkflows", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedPrepareStageWorkflows = definingPrepareStageWorkflows;

    // act
    const workflowsPrepareStageWorkflows = prepareStageWorkflows;

    // assert
    assert.strictEqual(workflowsPrepareStageWorkflows, expectedPrepareStageWorkflows);
  });
});

describe("unstagePluginWorkflows", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedUnstagePluginWorkflows = definingUnstagePluginWorkflows;

    // act
    const workflowsUnstagePluginWorkflows = unstagePluginWorkflows;

    // assert
    assert.strictEqual(workflowsUnstagePluginWorkflows, expectedUnstagePluginWorkflows);
  });
});
