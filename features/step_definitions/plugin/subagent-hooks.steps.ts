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
 *
 * A stand-in child knows its agent from the section of its system prompt that
 * pi-subagents tags (D-PG3-06). The section step writes it before the profile
 * Pi starts; the sibling-turn step starts a sibling of another agent between
 * two turns of the profile Pi; the metadata step removes or breaks the tag
 * before a new session; and the diagnostics step reads the bridge's identity
 * line from the child's debug log.
 *
 * The real-child steps run the installed pi-subagents through
 * `features/lib/real-subagent-child.ts`, in a fixture of the driver's own with
 * a loopback provider, and keep its hook runs, its child sessions in launch
 * order, and its main session as the last turn. A child session reads as its
 * launch-order ordinal, and the main session's control prompt is the positive
 * control (D-PG3-09). A run is a child's when its `agent_id` names a launched
 * child, and a main-session run has the main session's id and no `agent_id`,
 * so the runs step states which session a child's hook names in `session`,
 * `transcript path`, and `CLAUDE_CODE_SESSION_ID`: an ordinal or `main` for
 * an id, `session file of <ordinal>` or `session file of main` for a session
 * file (D-PG6-01, D-PG6-24).
 */

import assert from "node:assert/strict";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { type DataTable, Given, Then, When } from "@cucumber/cucumber";

import { inLoadOrder, resolveCompanion } from "../../lib/companions.ts";
import { HOOK_RUNS_LOG } from "../../lib/hook-recorder.ts";
import { mcpImplementationLaunch } from "../../lib/mcp-implementation.ts";
import { startSession } from "../../lib/pi-commands.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { DIALOG_METHODS } from "../../lib/pi-process.ts";
import { promptDisposition } from "../../lib/pi-rpc.ts";
import {
  FIXTURE_TIMEOUT_MS,
  parseConcurrentLaunches,
  parseRealChildAgents,
  runConcurrentRealSubagentChildren,
  runRealSubagentChild,
} from "../../lib/real-subagent-child.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf } from "../../lib/scripted-model/script.ts";
import {
  createSubagentHookSession,
  parseChildPromptMode,
  removeChildPromptSections,
  STAGE_TIMEOUT_MS,
  taggedChildPrompt,
  unendedHookProcesses,
  writeChildPromptSection,
} from "../../lib/subagent-hook-session.ts";
import { readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { HookRun } from "../../lib/hook-recorder.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { RealChildFixtureOptions } from "../../lib/real-subagent-child.ts";
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

// A turn of the profile Pi, a sibling's start and turn, and a second turn
// each wait one stage bound.
const SIBLING_TURNS_TIMEOUT_MS = 4 * STAGE_TIMEOUT_MS;

// Two turns and a new session each wait one stage bound.
const NEW_SESSION_TURNS_TIMEOUT_MS = 3 * STAGE_TIMEOUT_MS;

// The line the hooks bridge logs, with its debug log on, before a child run
// whose launch metadata is missing or malformed (D-PG3-06).
const IDENTITY_DIAGNOSTIC = "Child hook identity unavailable";

// The turn logs of a run of real pi-subagents children: each child session
// in launch order, and the main session.
const REAL_CHILDREN_LOG = "real-pi-subagents-children";
const REAL_MAIN_LOG = "real-pi-subagents-main";

// A child session as a run of real children records it in the turn.
interface RealChildSession {
  readonly generation: number;
  readonly agent: string;
  readonly mode: string;
  readonly state: string;
  readonly sessionId: string | undefined;
  readonly sessionFile: string | undefined;
  readonly pid: number | undefined;
}

// The main session as a run of real children records it in the turn.
interface RealMainSession {
  readonly sessionId: string;
  readonly sessionFile: string;
}

// The stdin members and the variable a real child's run states, in the
// columns of the runs step.
const REAL_CHILD_COLUMNS = [
  ["session", (run: HookRun) => run.stdin.session_id],
  ["event", (run: HookRun) => run.stdin.hook_event_name],
  ["tool name", (run: HookRun) => run.stdin.tool_name],
  ["agent type", (run: HookRun) => run.stdin.agent_type],
  ["agent id", (run: HookRun) => run.stdin.agent_id],
  ["transcript path", (run: HookRun) => run.stdin.transcript_path],
  ["CLAUDE_CODE_SESSION_ID", (run: HookRun) => run.environment.CLAUDE_CODE_SESSION_ID],
] as const satisfies readonly (readonly [string, (run: HookRun) => unknown])[];

const CHILD_ORDINALS: readonly string[] = ["first", "second", "third", "fourth"];

// The main session's runs for its control prompt: its start, the prompt, a
// bash call, and the Stop hook's block and the re-entered stop.
const MAIN_CONTROL_RUNS = 6;

// What a stand-in child's launch metadata becomes before its new session: no
// tagged section, or a tag whose name is not a quoted attribute.
const CHANGED_METADATA: Readonly<Record<string, string | undefined>> = {
  missing: undefined,
  malformed: "<active_agent name=demo:runner/>\n\n",
};

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

// Keeps `records` and every stand-in log line since the profile Pi started as
// the last turn, after asserting that the model was called no further than
// its script.
async function recordStartupTurn(
  world: ScenarioWorld,
  prompt: string,
  records: readonly RpcRecord[],
): Promise<void> {
  const logs = await readLogLinesSince(world.profileHarness(), new Map());
  const pastScript = modelCallsOf(logs).filter((call) => call.overflow);
  assert.deepStrictEqual(
    pastScript.map(({ index }) => index + 1),
    [],
    "the model was called past the end of its script",
  );
  world.recordTurn({ prompt, disposition: "started", records, logs });
}

// Sends `text` to the profile Pi, waits for its run to settle, and keeps
// every record since the prompt and every stand-in log line since the profile
// Pi started as the last turn, after asserting that Pi reported no fault and
// called the model no further than its script. A run that a Stop hook
// continues settles once, after its last model call (D-PG5-01).
async function promptInStartupSession(world: ScenarioWorld, text: string): Promise<void> {
  const prompt = expandTokens(text, world.tokens);
  const from = world.pi.recordCount();
  const { response } = await world.pi.request({ type: "prompt", message: prompt });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  const record = await world.pi.waitForRecord(
    from,
    (candidate) => candidate.type === "agent_settled",
    STAGE_TIMEOUT_MS,
  );
  assert.strictEqual(record.aborted, false, JSON.stringify(record));
  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(records.filter(isFault), []);
  await recordStartupTurn(world, prompt, records);
}

// What every run of real children shares: the profile's MCP implementation,
// the worker's compile cache, and the world's release.
async function realChildFixture(world: ScenarioWorld): Promise<RealChildFixtureOptions> {
  const { environment } = await world.oneShotPiLaunch();
  return {
    mcpProfile: world.mcpProfile,
    compileCache: await realpath(path.join(environment.TMPDIR, "jiti")),
    register: (release) => {
      world.onRelease(release);
    },
  };
}

// Keeps a run of real children as the last turn: its hook runs, its child
// sessions in launch order, and its main session.
function recordRealChildren(
  world: ScenarioWorld,
  prompt: string,
  hookRuns: readonly HookRun[],
  sessions: readonly RealChildSession[],
  main: RealMainSession,
): void {
  world.recordTurn({
    prompt,
    disposition: "started",
    records: [],
    logs: new Map<string, readonly unknown[]>([
      [HOOK_RUNS_LOG, hookRuns],
      [REAL_CHILDREN_LOG, sessions],
      [REAL_MAIN_LOG, [main]],
    ]),
  });
}

function realChildSessions(world: ScenarioWorld): readonly RealChildSession[] {
  return (world.requireTurn().logs.get(REAL_CHILDREN_LOG) ?? []) as readonly RealChildSession[];
}

function realMainSession(world: ScenarioWorld): RealMainSession {
  const [main] = (world.requireTurn().logs.get(REAL_MAIN_LOG) ?? []) as readonly RealMainSession[];
  assert.ok(main !== undefined, "the turn holds no main session");
  return main;
}

// Each child session's id by its ordinal, in launch order.
function childOrdinals(sessions: readonly RealChildSession[]): ReadonlyMap<string, string> {
  return new Map(
    sessions.flatMap(({ sessionId }, index) => {
      const ordinal = CHILD_ORDINALS[index];
      assert.ok(ordinal !== undefined, `more child sessions than ${CHILD_ORDINALS.length}`);
      return sessionId === undefined ? [] : [[sessionId, ordinal] as const];
    }),
  );
}

// The cell of each id and session file a real child's run may name: a child
// session by its ordinal, the main session as `main`, and a session file as
// `session file of` either.
function realSessionNames(
  sessions: readonly RealChildSession[],
  main: RealMainSession,
): ReadonlyMap<string, string> {
  const ordinals = childOrdinals(sessions);
  const files = sessions.flatMap(({ sessionId, sessionFile }) => {
    const ordinal = ordinals.get(sessionId ?? "");
    return ordinal === undefined || sessionFile === undefined
      ? []
      : [[sessionFile, `session file of ${ordinal}`] as const];
  });
  return new Map([
    ...ordinals,
    ...files,
    [main.sessionId, "main"],
    [main.sessionFile, "session file of main"],
  ]);
}

function stdinCell(value: unknown, ordinals: ReadonlyMap<string, string>): string {
  if (value === undefined) {
    return "";
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  return ordinals.get(text) ?? text;
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

// A stand-in for pi-subagents' launch metadata (E1): the section that its
// launch tags, read by every Pi that starts later in the sandbox. The step
// says which mode and which tag a real launch would write, and the release
// removes both sections.
Given(
  "the {word} section of pi's system prompt holds pi-subagents' tag for the agent {string} and the body {string}",
  async function (this: ScenarioWorld, mode: string, agent: string, body: string) {
    const agentDir = this.tokens.agentDir;
    this.onRelease(() => removeChildPromptSections(agentDir));
    await writeChildPromptSection(
      agentDir,
      parseChildPromptMode(mode),
      taggedChildPrompt(agent, body),
    );
  },
);

// The launch environment turns the extension's debug log on in the child, as
// a user's shell would, so its stderr holds the bridge's diagnostics.
Given(
  "pi runs with the scripted model and the mcp implementation as a pi-subagents background child with its debug log on",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    await writeLaunchEnvironment(this.tokens.home, { PI_CLAUDE_MARKETPLACE_DEBUG: "1" });
    const launch = mcpImplementationLaunch(this.mcpProfile);
    await this.usePiWithProfile({
      ...launch,
      extraExtensions: [...launch.extraExtensions, PI_LAUNCH_ENVIRONMENT_EXTENSION],
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
    await promptInStartupSession(this, text);
  },
);

// The sibling is a stand-in child of its own agent, started beside the
// profile Pi, which keeps the section it loaded at its start.
When(
  "the user prompts {string} in pi's startup session, a pi-subagents background child of the agent {string} prompts {string} beside it, and the user prompts {string}",
  { timeout: SIBLING_TURNS_TIMEOUT_MS },
  async function (
    this: ScenarioWorld,
    first: string,
    agent: string,
    sibling: string,
    second: string,
  ) {
    const session = createSubagentHookSession(await sessionOptions(this));
    this.onRelease(() => session.close());
    const firstRecords = await session.runTurn(this.pi, expandTokens(first, this.tokens));
    const child = await session.start("child", {
      mode: "append",
      text: taggedChildPrompt(agent, ""),
    });
    await session.runTurn(child, expandTokens(sibling, this.tokens));
    const secondRecords = await session.runTurn(this.pi, expandTokens(second, this.tokens));
    await recordStartupTurn(this, second, [...firstRecords, ...secondRecords]);
  },
);

// A new session reloads the sections of the system prompt, as a reload, a
// fork, or a resume of a child does.
When(
  "the user prompts {string} in pi's startup session, the child's launch metadata becomes {word}, and the user prompts {string} in a new session",
  { timeout: NEW_SESSION_TURNS_TIMEOUT_MS },
  async function (this: ScenarioWorld, first: string, metadata: string, second: string) {
    assert.ok(Object.hasOwn(CHANGED_METADATA, metadata), `unknown launch metadata ${metadata}`);
    const changed = CHANGED_METADATA[metadata];
    const session = createSubagentHookSession(await sessionOptions(this));
    const firstRecords = await session.runTurn(this.pi, expandTokens(first, this.tokens));
    await (changed === undefined
      ? removeChildPromptSections(this.tokens.agentDir)
      : writeChildPromptSection(this.tokens.agentDir, "append", changed));
    await startSession(this.pi);
    const secondRecords = await session.runTurn(this.pi, expandTokens(second, this.tokens));
    await recordStartupTurn(this, second, [...firstRecords, ...secondRecords]);
  },
);

// D-PG3-09: the installed pi-subagents launches each child; the main Pi's
// model names no launch mode, so the agent and pi-subagents' asyncByDefault
// decide it. A setting of `unset` writes no pi-subagents configuration, so
// pi-subagents' own default applies (D-PG3-01).
When(
  "pi-subagents, with its async-by-default setting {word}, launches from a main pi session a real child of each of these agents of a plugin with a stub mcp server, whose hooks record every event and whose stop hook would send a main session back:",
  { timeout: FIXTURE_TIMEOUT_MS },
  async function (this: ScenarioWorld, asyncByDefault: string, table: DataTable) {
    assert.ok(
      ["true", "false", "unset"].includes(asyncByDefault),
      `asyncByDefault is ${asyncByDefault}`,
    );
    const observed = await runRealSubagentChild({
      ...(await realChildFixture(this)),
      agents: parseRealChildAgents(table.raw()),
      ...(asyncByDefault !== "unset" && { asyncByDefault: asyncByDefault === "true" }),
    });
    const sessions = observed.children.map(
      ({ agent, mode, state, sessionId, sessionFile, pid }) => ({
        generation: 1,
        agent: agent ?? "",
        mode,
        state: state ?? "",
        sessionId,
        sessionFile,
        pid,
      }),
    );
    recordRealChildren(this, "real children", observed.hookRuns, sessions, {
      sessionId: observed.mainSessionId,
      sessionFile: observed.mainSessionFile,
    });
  },
);

When(
  "a pi-subagents runner process starts these child sessions of a plugin whose hooks record every event at once, prompts them all at once twice, and starts them again as new sessions:",
  { timeout: FIXTURE_TIMEOUT_MS },
  async function (this: ScenarioWorld, table: DataTable) {
    const generation = parseConcurrentLaunches(table.raw());
    const observed = await runConcurrentRealSubagentChildren({
      ...(await realChildFixture(this)),
      generations: [generation, generation],
      rounds: 2,
    });
    const sessions = observed.generations.flatMap((launched, index) =>
      launched.map(({ agent, sessionId, sessionFile, pid }) => ({
        generation: index + 1,
        agent,
        mode: "runner",
        state: "disposed",
        sessionId,
        sessionFile,
        pid,
      })),
    );
    recordRealChildren(this, "concurrent children", observed.hookRuns, sessions, {
      sessionId: observed.mainSessionId,
      sessionFile: observed.mainSessionFile,
    });
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

// The extension's debug log is Pi's stderr, which also holds Pi's own lines,
// so the step states only the lines of the bridge's identity diagnostic. It
// reads Pi's stderr, not the turn, so it leaves the turn uncompared.
Then(
  "pi's debug log holds these child hook identity diagnostics:",
  function (this: ScenarioWorld, table: DataTable) {
    const lines = this.pi.stderrText
      .split("\n")
      .filter((line) => line.includes(IDENTITY_DIAGNOSTIC))
      .map((line) => [line]);
    assert.deepStrictEqual([["diagnostic"], ...lines], table.raw());
  },
);

// The runner's pid differs on every run, so a row states whether pi-subagents
// recorded one for the child, and its session by its launch-order ordinal.
// The agent is the one pi-subagents recorded that it ran.
Then(
  "pi-subagents ran the real children like this:",
  function (this: ScenarioWorld, table: DataTable) {
    const sessions = realChildSessions(this);
    const ordinals = childOrdinals(sessions);
    const rows = sessions.map(({ agent, mode, state, sessionId, pid }) => [
      agent,
      mode,
      state,
      pid === undefined ? "none" : "recorded",
      sessionId === undefined ? "" : (ordinals.get(sessionId) ?? sessionId),
    ]);
    assert.deepStrictEqual(
      [["agent", "mode", "state", "runner process", "session"], ...rows],
      table.raw(),
    );
  },
);

// One runner process hosts every session, so the step asserts one pid and
// states each session by its launch-order ordinal.
Then(
  "one runner process hosted these child sessions:",
  function (this: ScenarioWorld, table: DataTable) {
    const sessions = realChildSessions(this);
    const ordinals = childOrdinals(sessions);
    assert.strictEqual(new Set(sessions.map(({ pid }) => pid)).size, 1, "one runner process");
    assert.strictEqual(ordinals.size, sessions.length, "each session has an id of its own");
    const rows = sessions.map(({ generation, agent, sessionId }) => [
      String(generation),
      agent,
      ordinals.get(sessionId ?? "") ?? "",
    ]);
    assert.deepStrictEqual([["generation", "agent", "session"], ...rows], table.raw());
  },
);

// The child sessions' runs, in any order, since concurrent sessions append
// theirs as they run. A run is a child's when its agent id names a launched
// child session; an id and a session file read as `realSessionNames` names
// them, and an empty value is an empty cell. The main session's runs are
// pi-subagents' turns as much as the user's, so the step states none of
// them, and asserts only that none of them carries a child identity.
Then(
  "the real children's hooks record these runs in any order, and no main-session run names a child:",
  function (this: ScenarioWorld, table: DataTable) {
    const turn = this.requireTurn();
    const runs = (turn.logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
    const sessions = realChildSessions(this);
    const ordinals = childOrdinals(sessions);
    const names = realSessionNames(sessions, realMainSession(this));
    const isChild = (run: HookRun): boolean => ordinals.has(String(run.stdin.agent_id));
    const rows = runs
      .filter(isChild)
      .map((run) => REAL_CHILD_COLUMNS.map(([, read]) => stdinCell(read(run), names)))
      .sort((left, right) => left.join("\0").localeCompare(right.join("\0")));
    const [header = [], ...stated] = table.raw();
    assert.deepStrictEqual(
      [header, ...rows],
      [
        header,
        ...[...stated].sort((left, right) => left.join("\0").localeCompare(right.join("\0"))),
      ],
    );
    assert.deepStrictEqual(
      header,
      REAL_CHILD_COLUMNS.map(([column]) => column),
    );
    const named = runs
      .filter((run) => !isChild(run))
      .filter(
        (run) => Object.hasOwn(run.stdin, "agent_type") || Object.hasOwn(run.stdin, "agent_id"),
      );
    assert.deepStrictEqual(named, []);
    this.markTurnCompared();
  },
);

// The positive control: the main session's first runs, those with its id and
// no agent id, for a prompt whose model calls bash, carry no child identity.
Then(
  "the main session's hooks record these runs for its control prompt:",
  function (this: ScenarioWorld, table: DataTable) {
    const turn = this.requireTurn();
    const runs = (turn.logs.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
    const { sessionId } = realMainSession(this);
    const rows = runs
      .filter((run) => run.stdin.session_id === sessionId && !Object.hasOwn(run.stdin, "agent_id"))
      .slice(0, MAIN_CONTROL_RUNS)
      .map((run) => [
        run.event,
        stdinCell(run.stdin.tool_name, new Map()),
        Object.hasOwn(run.stdin, "agent_type") || Object.hasOwn(run.stdin, "agent_id")
          ? "named"
          : "none",
      ]);
    assert.deepStrictEqual([["event", "tool name", "child identity"], ...rows], table.raw());
  },
);
