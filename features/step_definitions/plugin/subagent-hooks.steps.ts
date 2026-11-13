/**
 * @fileoverview Steps about the hooks of an installed plugin in a pi-subagents
 * background child and in the main session beside it: a child profile Pi with
 * the profile's MCP implementation, a prompt whose turn keeps every hook run
 * since Pi started, a sibling child and a child that run beside the profile Pi,
 * the release of their waiting hooks, and the hook processes still waiting.
 *
 * A child runs a plugin's tool hooks and none of the main session's lifecycle
 * hooks (D-PG3-08). Pi runs a session's SessionStart hooks while it starts,
 * before any prompt, so the startup-session prompt keeps every stand-in log
 * line since the profile Pi started as the turn, and the runs step states the
 * startup run of a main session and its absence in a child.
 *
 * The sibling and the child are Pis of their own in the run's sandbox, with
 * the profile Pi's scripted model and MCP implementation and pi-subagents'
 * marker, driven through `features/lib/subagent-hook-session.ts`. Each one's
 * release stops its Pi and every hook script of the sandbox that still runs.
 * The child step observes every hook that waits when it begins after each
 * stage of the child, its load, its hook's start and end, a new session, and
 * its stop, and fails at the first stage that ends such a hook or changes the
 * record that lets a later load stop it (D-PG3-09).
 */

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { inLoadOrder, resolveCompanion } from "../../lib/companions.ts";
import { mcpImplementationLaunch } from "../../lib/mcp-implementation.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import {
  createSubagentHookSession,
  STAGE_TIMEOUT_MS,
  unendedHookProcesses,
} from "../../lib/subagent-hook-session.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { RpcRecord } from "../../lib/pi-process.ts";
import type { SubagentHookSessionOptions } from "../../lib/subagent-hook-session.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// The scripted model, which every Pi of these steps loads right after the real extension.
const SCRIPTED_MODEL_EXTENSION = fileURLToPath(
  new URL("../../lib/scripted-model/extension.ts", import.meta.url),
);

// The child step bounds each of its five stages by `STAGE_TIMEOUT_MS`, and
// the profile Pi already filled the compile cache, so six stage bounds cover
// the step on a loaded runner.
const CHILD_STAGES_TIMEOUT_MS = 6 * STAGE_TIMEOUT_MS;

// Releasing two waiting hooks waits for two end lines.
const RELEASE_TIMEOUT_MS = 2 * STAGE_TIMEOUT_MS;

const CHILD_STAGES = ["load", "hook start", "hook end", "new session", "stop"] as const;

function isFault(record: RpcRecord): boolean {
  return (
    record.type === "extension_error" ||
    (record.type === "extension_ui_request" &&
      typeof record.method === "string" &&
      DIALOG_METHODS.has(record.method))
  );
}

// Where the sibling and the child run and what they load: the profile Pi's
// sandbox and git environment, its scripted model and MCP implementation,
// and the project scope's data root, where the plugin's hooks keep their
// records.
async function sessionOptions(world: ScenarioWorld): Promise<SubagentHookSessionOptions> {
  world.profileHarness();
  const { sandbox, git, environment } = await world.oneShotPiLaunch();
  const launch = mcpImplementationLaunch(world.mcpProfile);
  const companions = await Promise.all(
    inLoadOrder(launch.companions).map((name) => resolveCompanion(name)),
  );
  return {
    sandbox,
    git,
    temporaryDirectory: environment.TMPDIR,
    extensions: [
      SCRIPTED_MODEL_EXTENSION,
      ...companions.map((companion) => companion.entry),
      ...launch.extraExtensions,
    ],
    dataRoot: path.join(world.scopeRoot("project"), "pi-claude-marketplace", "data"),
  };
}

// Sends `text` to the profile Pi, waits for `settlements` settles, and keeps
// every record since the prompt and every stand-in log line since the profile
// Pi started as the last turn, after asserting that Pi reported no fault and
// called the model no further than its script.
async function promptInStartupSession(
  world: ScenarioWorld,
  text: string,
  settlements: number,
): Promise<void> {
  const harness = world.profileHarness();
  const prompt = expandTokens(text, world.tokens);
  const from = world.pi.recordCount();
  const { response } = await world.pi.request({ type: "prompt", message: prompt });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  let next = from;
  for (let settled = 0; settled < settlements; settled += 1) {
    const record = await world.pi.waitForRecord(
      next,
      (candidate) => candidate.type === "agent_settled",
      STAGE_TIMEOUT_MS,
    );
    assert.strictEqual(record.aborted, false, JSON.stringify(record));
    next = from + world.pi.recordsSince(from).indexOf(record) + 1;
  }

  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isFault), []);
  const logs = await readLogLinesSince(harness, new Map());
  const pastScript = modelCallsOf(logs).filter((call) => call.overflow);
  assert.deepStrictEqual(
    pastScript.map(({ index }) => index + 1),
    [],
    "the model was called past the end of its script",
  );
  world.recordTurn({ prompt, disposition: "started", records, logs });
}

// D-BG-10: the marker is in the spawn environment, as pi-subagents' runner
// sets it, and the child loads the profile's MCP implementation, as a child
// loads the user's extensions.
Given(
  "pi runs with the scripted model and the mcp implementation as a pi-subagents background child",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await this.usePiWithProfile({
      ...mcpImplementationLaunch(this.mcpProfile),
      subagentChild: true,
    });
  },
);

Given(
  "a pi-subagents background sibling child has prompted {string} and the hook {string} goes on in the background",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, text: string, hook: string) {
    const session = createSubagentHookSession(await sessionOptions(this));
    this.onRelease(() => session.close());
    const sibling = await session.start("child");
    await session.promptPastWaitingHook(sibling, expandTokens(text, this.tokens), hook);
  },
);

When(
  "the user prompts {string} in pi's startup session",
  async function (this: ScenarioWorld, text: string) {
    await promptInStartupSession(this, text, 1);
  },
);

// STOP-03: Pi starts the turn a Stop hook asks for after it reports the first
// `agent_settled`, so the step waits for the second one.
When(
  "the user prompts {string} in pi's startup session and the stop hooks send the turn back",
  async function (this: ScenarioWorld, text: string) {
    await promptInStartupSession(this, text, 2);
  },
);

When(
  "a pi-subagents background child loads, runs the hook {string} for {string} until the hook ends, starts a new session, and stops",
  { timeout: CHILD_STAGES_TIMEOUT_MS },
  async function (this: ScenarioWorld, hook: string, text: string) {
    const harness = this.profileHarness();
    const prompt = expandTokens(text, this.tokens);
    const session = createSubagentHookSession(await sessionOptions(this));
    this.onRelease(() => session.close());
    const foreign = await session.waitingHooks();
    assert.notDeepStrictEqual(foreign, [], "no hook waits before the child loads");
    const lengths = await readLogLengths(harness);
    const { records, stages } = await session.runChildStages(foreign, prompt, hook);
    const kept = foreign.map(({ hook: name }) => ({ hook: name, running: true, record: "kept" }));
    assert.deepStrictEqual(
      stages,
      CHILD_STAGES.map((stage) => ({ stage, hooks: kept })),
    );
    const logs = await readLogLinesSince(harness, lengths);
    this.recordTurn({ prompt, disposition: "started", records, logs });
  },
);

When(
  "the user releases the waiting hooks {string} and {string}",
  { timeout: RELEASE_TIMEOUT_MS },
  async function (this: ScenarioWorld, first: string, second: string) {
    const harness = this.profileHarness();
    const session = createSubagentHookSession(await sessionOptions(this));
    const lengths = await readLogLengths(harness);
    const from = this.pi.recordCount();
    await session.release(first);
    await session.release(second);
    const records = this.pi.recordsSince(from);
    assert.deepStrictEqual(records.filter(isFault), []);
    const logs = await readLogLinesSince(harness, lengths);
    this.recordTurn({ prompt: "release", disposition: "handled", records, logs });
  },
);

// Pi's `compaction_end` events of the turn, by their reason and outcome,
// which Pi states as fields, so no summary text is read. It leaves the turn
// to the step that compares its hook runs.
Then("pi compacts the session once for its context threshold", function (this: ScenarioWorld) {
  const ends = this.requireTurn().records.filter((record) => record.type === "compaction_end");
  assert.deepStrictEqual(
    ends.map(({ reason, aborted }) => ({ reason, aborted })),
    [{ reason: "threshold", aborted: false }],
  );
});

// It reads processes, not the turn, so it leaves the turn uncompared.
Then(
  "these hook processes have started and not ended:",
  async function (this: ScenarioWorld, table: DataTable) {
    const unended = await unendedHookProcesses(this.tokens.home);
    assert.deepStrictEqual(
      [["hook", "running"], ...unended.map(({ hook, running }) => [hook, String(running)])],
      table.raw(),
    );
  },
);
