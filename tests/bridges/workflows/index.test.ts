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
import type { PreparedWorkflowsStaging as BarrelPreparedWorkflowsStaging } from "../../../extensions/pi-claude-marketplace/bridges/workflows/index.ts";
import type { PreparedWorkflowsStaging as DefiningPreparedWorkflowsStaging } from "../../../extensions/pi-claude-marketplace/bridges/workflows/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedWorkflowsNoop = Extract<BarrelPreparedWorkflowsStaging, { kind: "noop" }>;
type PreparedWorkflowsStaged = Extract<BarrelPreparedWorkflowsStaging, { kind: "staged" }>;

void (true satisfies Same<BarrelPreparedWorkflowsStaging, DefiningPreparedWorkflowsStaging>);
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
