import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  abortPreparedAgents,
  commitPreparedAgents,
  discoverPluginAgents,
  finalizeAgentsReplacement,
  GENERATED_AGENT_MARKER,
  GENERATED_AGENT_MARKER_LEGACY,
  prepareStagePluginAgents,
  replacePreparedAgents,
  rollbackAgentsReplacement,
  unstagePluginAgents,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import { discoverPluginAgents as definingDiscoverPluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/discover.ts";
import {
  GENERATED_AGENT_MARKER as definingGeneratedAgentMarker,
  GENERATED_AGENT_MARKER_LEGACY as definingGeneratedAgentMarkerLegacy,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/marker.ts";
import {
  abortPreparedAgents as definingAbortPreparedAgents,
  commitPreparedAgents as definingCommitPreparedAgents,
  finalizeAgentsReplacement as definingFinalizeAgentsReplacement,
  prepareStagePluginAgents as definingPrepareStagePluginAgents,
  replacePreparedAgents as definingReplacePreparedAgents,
  rollbackAgentsReplacement as definingRollbackAgentsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/stage.ts";
import { unstagePluginAgents as definingUnstagePluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/unstage.ts";

import type * as AgentsBarrel from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import type {
  AgentsReplacement as BarrelAgentsReplacement,
  PreparedAgentsStaging as BarrelPreparedAgentsStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import type {
  AgentsReplacement as DefiningAgentsReplacement,
  PreparedAgentsStaging as DefiningPreparedAgentsStaging,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

type Same<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left]
    ? true
    : false
  : false;
type PreparedAgentsNoop = Extract<BarrelPreparedAgentsStaging, { kind: "noop" }>;
type PreparedAgentsStaged = Extract<BarrelPreparedAgentsStaging, { kind: "staged" }>;
type AgentsReplacementNoop = Extract<BarrelAgentsReplacement, { kind: "noop" }>;
type AgentsReplacementReplaced = Extract<BarrelAgentsReplacement, { kind: "replaced" }>;

void (true satisfies Same<BarrelAgentsReplacement, DefiningAgentsReplacement>);
void (true satisfies Same<BarrelPreparedAgentsStaging, DefiningPreparedAgentsStaging>);
void (true satisfies Same<PreparedAgentsNoop["kind"], "noop">);
void (true satisfies Same<PreparedAgentsStaged["kind"], "staged">);
void (true satisfies Same<AgentsReplacementNoop["kind"], "noop">);
void (true satisfies Same<AgentsReplacementReplaced["kind"], "replaced">);
void (true satisfies Same<AgentsReplacementNoop["prepared"], PreparedAgentsNoop>);
void (true satisfies Same<AgentsReplacementReplaced["prepared"], PreparedAgentsStaged>);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
} satisfies BarrelPreparedAgentsStaging);
void ({
  kind: "noop",
  prepared: {
    kind: "noop",
    result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
  },
} satisfies BarrelAgentsReplacement);

// @ts-expect-error staging internals require narrowing to the staged handle
void ("/staging" satisfies BarrelPreparedAgentsStaging["stagingDir"]);
// @ts-expect-error an agent preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedAgentsStaging);
// @ts-expect-error an agent replacement handle has a closed discriminant set
void ({ kind: "staged" } satisfies BarrelAgentsReplacement);
// @ts-expect-error the barrel keeps the staged implementation type private
void (true satisfies Same<AgentsBarrel.PreparedAgentsStaged, never>);
// @ts-expect-error the barrel does not export the internal marker prefix
void (true satisfies Same<typeof AgentsBarrel.GENERATED_AGENT_PREFIX, never>);

describe("abortPreparedAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedAgents = definingAbortPreparedAgents;

    // act
    const agentsAbortPreparedAgents = abortPreparedAgents;

    // assert
    assert.strictEqual(agentsAbortPreparedAgents, expectedAbortPreparedAgents);
  });
});

describe("commitPreparedAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedCommitPreparedAgents = definingCommitPreparedAgents;

    // act
    const agentsCommitPreparedAgents = commitPreparedAgents;

    // assert
    assert.strictEqual(agentsCommitPreparedAgents, expectedCommitPreparedAgents);
  });
});

describe("discoverPluginAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedDiscoverPluginAgents = definingDiscoverPluginAgents;

    // act
    const agentsDiscoverPluginAgents = discoverPluginAgents;

    // assert
    assert.strictEqual(agentsDiscoverPluginAgents, expectedDiscoverPluginAgents);
  });
});

describe("finalizeAgentsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedFinalizeAgentsReplacement = definingFinalizeAgentsReplacement;

    // act
    const agentsFinalizeAgentsReplacement = finalizeAgentsReplacement;

    // assert
    assert.strictEqual(agentsFinalizeAgentsReplacement, expectedFinalizeAgentsReplacement);
  });
});

describe("GENERATED_AGENT_MARKER", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedGeneratedAgentMarker = definingGeneratedAgentMarker;

    // act
    const agentsGeneratedAgentMarker = GENERATED_AGENT_MARKER;

    // assert
    assert.strictEqual(agentsGeneratedAgentMarker, expectedGeneratedAgentMarker);
  });
});

describe("GENERATED_AGENT_MARKER_LEGACY", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedGeneratedAgentMarkerLegacy = definingGeneratedAgentMarkerLegacy;

    // act
    const agentsGeneratedAgentMarkerLegacy = GENERATED_AGENT_MARKER_LEGACY;

    // assert
    assert.strictEqual(
      agentsGeneratedAgentMarkerLegacy,
      expectedGeneratedAgentMarkerLegacy,
    );
  });
});

describe("prepareStagePluginAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedPrepareStagePluginAgents = definingPrepareStagePluginAgents;

    // act
    const agentsPrepareStagePluginAgents = prepareStagePluginAgents;

    // assert
    assert.strictEqual(agentsPrepareStagePluginAgents, expectedPrepareStagePluginAgents);
  });
});

describe("replacePreparedAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedReplacePreparedAgents = definingReplacePreparedAgents;

    // act
    const agentsReplacePreparedAgents = replacePreparedAgents;

    // assert
    assert.strictEqual(agentsReplacePreparedAgents, expectedReplacePreparedAgents);
  });
});

describe("rollbackAgentsReplacement", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedRollbackAgentsReplacement = definingRollbackAgentsReplacement;

    // act
    const agentsRollbackAgentsReplacement = rollbackAgentsReplacement;

    // assert
    assert.strictEqual(agentsRollbackAgentsReplacement, expectedRollbackAgentsReplacement);
  });
});

describe("unstagePluginAgents", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedUnstagePluginAgents = definingUnstagePluginAgents;

    // act
    const agentsUnstagePluginAgents = unstagePluginAgents;

    // assert
    assert.strictEqual(agentsUnstagePluginAgents, expectedUnstagePluginAgents);
  });
});
