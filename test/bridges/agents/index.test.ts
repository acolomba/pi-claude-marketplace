import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { discoverPluginAgents as definingDiscoverPluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/discover.ts";
import {
  abortPreparedAgents,
  assertAgentCommitTargets,
  commitPreparedAgents,
  discoverPluginAgents,
  prepareStagePluginAgents,
  unstagePluginAgents,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import {
  abortPreparedAgents as definingAbortPreparedAgents,
  assertAgentCommitTargets as definingAssertAgentCommitTargets,
  commitPreparedAgents as definingCommitPreparedAgents,
  prepareStagePluginAgents as definingPrepareStagePluginAgents,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/stage.ts";
import { unstagePluginAgents as definingUnstagePluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/unstage.ts";

import type * as AgentsBarrel from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import type { PreparedAgentsStaging as BarrelPreparedAgentsStaging } from "../../../extensions/pi-claude-marketplace/bridges/agents/index.ts";
import type { PreparedAgentsStaging as DefiningPreparedAgentsStaging } from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type PreparedAgentsNoop = Extract<BarrelPreparedAgentsStaging, { kind: "noop" }>;
type PreparedAgentsStaged = Extract<BarrelPreparedAgentsStaging, { kind: "staged" }>;

void (true satisfies Same<BarrelPreparedAgentsStaging, DefiningPreparedAgentsStaging>);
void (true satisfies Same<PreparedAgentsNoop["kind"], "noop">);
void (true satisfies Same<PreparedAgentsStaged["kind"], "staged">);
void ({
  kind: "noop",
  result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
} satisfies BarrelPreparedAgentsStaging);

// @ts-expect-error staging internals require narrowing to the staged handle
void ("/staging" satisfies BarrelPreparedAgentsStaging["stagingDir"]);
// @ts-expect-error an agent preparation handle has a closed discriminant set
void ({ kind: "missing" } satisfies BarrelPreparedAgentsStaging);
// @ts-expect-error the barrel keeps the staged implementation type private
void ({} satisfies { readonly retired?: AgentsBarrel.PreparedAgentsStaged });
// @ts-expect-error the barrel does not export the internal marker prefix
void ({} satisfies { readonly retired?: typeof AgentsBarrel.GENERATED_AGENT_PREFIX });
// @ts-expect-error the barrel keeps the current marker in its defining module
void ({} satisfies { readonly retired?: typeof AgentsBarrel.GENERATED_AGENT_MARKER });
// @ts-expect-error the barrel keeps the legacy marker private to its detector
void ({} satisfies { readonly retired?: typeof AgentsBarrel.GENERATED_AGENT_MARKER_LEGACY });

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

describe("assertAgentCommitTargets", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAssertAgentCommitTargets = definingAssertAgentCommitTargets;

    // act
    const agentsAssertAgentCommitTargets = assertAgentCommitTargets;

    // assert
    assert.strictEqual(agentsAssertAgentCommitTargets, expectedAssertAgentCommitTargets);
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
