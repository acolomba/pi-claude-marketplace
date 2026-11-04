import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify } from "strong-mock";

import { createMcpSessionMaterializer } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/session-materialize.ts";
import { expectSoftDepProbes } from "../../edge/notification-boundary.ts";

import type { AgentGrantsStepInput } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/agent-grants-step.ts";
import type { BuiltinRegistrationStepInput } from "../../../extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type McpSessionSteps = Parameters<typeof createMcpSessionMaterializer>[0];

type StepName = "builtin registration" | "agent grants";

interface StepCall {
  readonly step: StepName;
  readonly input: BuiltinRegistrationStepInput | AgentGrantsStepInput;
}

/** How a recording step ends after it records its call. */
type StepEnding = "resolve" | "throw" | "reject";

function endStep(step: StepName, ending: StepEnding): Promise<void> {
  if (ending === "throw") {
    throw new Error(`${step} threw`);
  }

  return ending === "reject" ? Promise.reject(new Error(`${step} rejected`)) : Promise.resolve();
}

/** Both session steps, each recording its call into one shared log before it ends as told. */
function recordingSteps(
  calls: StepCall[],
  endings: { readonly registration: StepEnding; readonly grants: StepEnding },
): McpSessionSteps {
  return {
    builtinRegistrationStep: (input) => {
      calls.push({ step: "builtin registration", input });
      return endStep("builtin registration", endings.registration);
    },
    agentGrantsStep: (input) => {
      calls.push({ step: "agent grants", input });
      return endStep("agent grants", endings.grants);
    },
  };
}

/** A Pi that allows exactly one soft-dependency snapshot and nothing else. */
function piAllowingOneSnapshot(): ExtensionAPI {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  expectSoftDepProbes(pi, 1);
  return pi;
}

test("opens one load run and hands it to the registration step, then to the agent grants step", async () => {
  // arrange
  const pi = piAllowingOneSnapshot();
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const calls: StepCall[] = [];
  const materialize = createMcpSessionMaterializer(
    recordingSteps(calls, { registration: "resolve", grants: "resolve" }),
  );

  // act
  await materialize(pi, ctx);

  // assert
  const snapshot = calls[0]?.input.snapshot;
  assert.deepStrictEqual(calls, [
    { step: "builtin registration", input: { pi, ctx, snapshot } },
    { step: "agent grants", input: { pi, ctx, snapshot } },
  ]);
  assert.ok(snapshot !== undefined);
  const { softDeps: _softDeps, ...run } = snapshot;
  assert.deepStrictEqual(run, { origin: { kind: "load" }, entrySink: pi });
  verify(pi);
  verify(ctx);
});

for (const ending of ["throw", "reject"] as const) {
  test(`NFR-2: a registration step that fails by ${ending} still runs the agent grants step and resolves`, async () => {
    // arrange
    const pi = piAllowingOneSnapshot();
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const calls: StepCall[] = [];
    const materialize = createMcpSessionMaterializer(
      recordingSteps(calls, { registration: ending, grants: "resolve" }),
    );

    // act
    await materialize(pi, ctx);

    // assert
    assert.deepStrictEqual(
      calls.map((call) => call.step),
      ["builtin registration", "agent grants"],
    );
    verify(pi);
    verify(ctx);
  });
}

for (const ending of ["throw", "reject"] as const) {
  test(`NFR-2: an agent grants step that fails by ${ending} leaves the materializer resolved`, async () => {
    // arrange
    const pi = piAllowingOneSnapshot();
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const calls: StepCall[] = [];
    const materialize = createMcpSessionMaterializer(
      recordingSteps(calls, { registration: "resolve", grants: ending }),
    );

    // act
    await materialize(pi, ctx);

    // assert
    assert.deepStrictEqual(
      calls.map((call) => call.step),
      ["builtin registration", "agent grants"],
    );
    verify(pi);
    verify(ctx);
  });
}
