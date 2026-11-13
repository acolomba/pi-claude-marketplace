// test/integration/pi-subagents-child-identity.test.ts
//
// Real pi-subagents children of an installed plugin carry their own identity
// in every tool hook, and run no main-session hook (PG-HOOK-07a, D-PG3-09).
// The installed companion launches each child through
// `features/lib/real-subagent-child.ts`, which the behavioral steps share, so
// no test writes the agent tag itself.
//
// A detached case has the main Pi launch an explicit background agent and an
// agent granted a plugin MCP tool, under a pi-subagents configuration whose
// default is the foreground, so only the agents' own launch settings detach
// them. Each child makes a successful and, where it can, a failed tool call,
// past a Stop hook that would send a main session back for another turn. An
// ordinary case launches an agent with an empty body, no background setting,
// and no MCP grant, with no launch mode in the call: under pi-subagents' own
// default it detaches, and under a configured foreground default it runs in
// the main Pi's turn, where no hook runs for it (D-PG3-01). A
// concurrent case builds two child sessions at once in one runner process,
// one tagged in append mode with an empty body and one in replace mode with
// a second tag in its body, prompts both at once twice, and starts them
// again as new sessions. Each case keeps a main session's hooks as a
// positive control.
//
// Each case waits at most `FIXTURE_TIMEOUT_MS`, and the driver's release
// stops every process of the case's fixture and removes it, also after a
// failed assertion.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
  FIXTURE_TIMEOUT_MS,
  runConcurrentRealSubagentChildren,
  runRealSubagentChild,
} from "../../features/lib/real-subagent-child.ts";

import type { HookRun } from "../../features/lib/hook-recorder.ts";
import type { McpProfile } from "../../features/lib/mcp-implementation.ts";
import type {
  ConcurrentChildLaunch,
  RealChildAgent,
} from "../../features/lib/real-subagent-child.ts";

// The Pis of every case compile the same extensions, so they share one jiti
// cache, which the first Pi fills.
let compileCache = "";

before(async () => {
  compileCache = await mkdtemp(path.join(tmpdir(), "pi-subagents-child-identity-jiti-"));
});

after(async () => {
  await rm(compileCache, { recursive: true, force: true });
});

// The stub MCP server's tool, by the name a Claude agent grants it.
const MCP_TOOL = "mcp__plugin_demo_stub__echo";

const BACKGROUND_AGENT: RealChildAgent = {
  name: "runner",
  frontmatter: [["background", "true"]],
  body: "Run the tools the task names.",
  calls: [
    { tool: "bash", arguments: { command: "echo from-child" } },
    { tool: "read", arguments: { path: "missing.txt" } },
  ],
};

// An ordinary agent with an empty body: no background setting and no MCP
// grant, so its generated file names no launch mode (D-PG3-01). Its tools
// list keeps the plugin's stub MCP server out of its grants.
const ORDINARY_AGENT: RealChildAgent = {
  name: "plain",
  frontmatter: [["tools", "Bash, Read"]],
  body: "",
  calls: [
    { tool: "bash", arguments: { command: "echo from-child" } },
    { tool: "read", arguments: { path: "missing.txt" } },
  ],
};

const MCP_AGENT: RealChildAgent = {
  name: "granted",
  frontmatter: [["tools", MCP_TOOL]],
  body: "Call the granted tool.",
  calls: [{ tool: MCP_TOOL, arguments: { text: "pg3" } }],
};

// A hook run as its event, its session, its tool, and the identity it carries.
interface RunIdentity {
  readonly event: string;
  readonly session: unknown;
  readonly tool: unknown;
  readonly identity: Readonly<Record<string, unknown>>;
}

function runIdentity(run: HookRun): RunIdentity {
  const { stdin } = run;
  return {
    event: run.event,
    session: stdin.session_id,
    tool: stdin.tool_name,
    identity: Object.fromEntries(
      ["agent_type", "agent_id"]
        .filter((key) => Object.hasOwn(stdin, key))
        .map((key) => [key, stdin[key]]),
    ),
  };
}

function runsOf(runs: readonly HookRun[], sessionId: string): RunIdentity[] {
  return runs.filter((run) => run.stdin.session_id === sessionId).map(runIdentity);
}

// The runs of every session that is not one of `children`: the main Pi's
// sessions, whose hooks carry no identity and include the lifecycle events.
function mainRuns(runs: readonly HookRun[], children: readonly string[]): RunIdentity[] {
  return runs.filter((run) => !children.includes(String(run.stdin.session_id))).map(runIdentity);
}

for (const mcpProfile of ["adapter", "builtin"] as const satisfies readonly McpProfile[]) {
  test(
    `detached ${mcpProfile} children of a background agent and an MCP agent hook with their own identity`,
    { timeout: FIXTURE_TIMEOUT_MS },
    async (t) => {
      // arrange
      const releases: (() => Promise<void>)[] = [];
      t.after(() => Promise.all(releases.map((release) => release())));

      // act
      const observed = await runRealSubagentChild({
        mcpProfile,
        agents: [BACKGROUND_AGENT, MCP_AGENT],
        asyncByDefault: false,
        compileCache,
        register: (release) => releases.push(release),
      });
      t.diagnostic(
        JSON.stringify({
          versions: observed.versions,
          children: observed.children,
          mainSessionId: observed.mainSessionId,
        }),
      );
      const [runner, granted] = observed.children;
      assert.ok(runner?.sessionId !== undefined && granted?.sessionId !== undefined);

      // assert
      assert.deepStrictEqual(
        observed.children.map(({ agent, mode, state }) => ({ agent, mode, state })),
        [
          { agent: "demo:runner", mode: "background", state: "complete" },
          { agent: "demo:granted", mode: "background", state: "complete" },
        ],
      );
      assert.ok(observed.children.every(({ pid }) => typeof pid === "number"));
      assert.strictEqual(
        new Set([observed.mainSessionId, runner.sessionId, granted.sessionId]).size,
        3,
      );
      const runnerIdentity = { agent_type: "demo:runner", agent_id: runner.sessionId };
      assert.deepStrictEqual(runsOf(observed.hookRuns, runner.sessionId), [
        { event: "PreToolUse", session: runner.sessionId, tool: "Bash", identity: runnerIdentity },
        { event: "PostToolUse", session: runner.sessionId, tool: "Bash", identity: runnerIdentity },
        { event: "PreToolUse", session: runner.sessionId, tool: "Read", identity: runnerIdentity },
        {
          event: "PostToolUseFailure",
          session: runner.sessionId,
          tool: "Read",
          identity: runnerIdentity,
        },
      ]);
      const grantedIdentity = { agent_type: "demo:granted", agent_id: granted.sessionId };
      assert.deepStrictEqual(runsOf(observed.hookRuns, granted.sessionId), [
        {
          event: "PreToolUse",
          session: granted.sessionId,
          tool: MCP_TOOL,
          identity: grantedIdentity,
        },
        {
          event: "PostToolUse",
          session: granted.sessionId,
          tool: MCP_TOOL,
          identity: grantedIdentity,
        },
      ]);
      const main = mainRuns(observed.hookRuns, [runner.sessionId, granted.sessionId]);
      assert.deepStrictEqual(
        main.filter(({ identity }) => Object.keys(identity).length > 0),
        [],
      );
      assert.deepStrictEqual(
        main.filter(({ session }) => session === observed.mainSessionId).slice(0, 6),
        [
          { event: "SessionStart", session: observed.mainSessionId, tool: undefined, identity: {} },
          {
            event: "UserPromptSubmit",
            session: observed.mainSessionId,
            tool: undefined,
            identity: {},
          },
          { event: "PreToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
          { event: "PostToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
          { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
          { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
        ],
      );
      assert.deepStrictEqual(observed.providerModels, ["scripted"]);
    },
  );
}

for (const mcpProfile of ["adapter", "builtin"] as const satisfies readonly McpProfile[]) {
  test(
    `an ordinary ${mcpProfile} agent with an empty body runs detached in pi-subagents' default mode and hooks only its tools with its own identity`,
    { timeout: FIXTURE_TIMEOUT_MS },
    async (t) => {
      // arrange
      const releases: (() => Promise<void>)[] = [];
      t.after(() => Promise.all(releases.map((release) => release())));

      // act
      const observed = await runRealSubagentChild({
        mcpProfile,
        agents: [ORDINARY_AGENT],
        compileCache,
        register: (release) => releases.push(release),
      });
      t.diagnostic(
        JSON.stringify({
          versions: observed.versions,
          children: observed.children,
          mainSessionId: observed.mainSessionId,
        }),
      );
      const [plain] = observed.children;

      // assert
      assert.deepStrictEqual(
        observed.children.map(({ agent, mode, state }) => ({ agent, mode, state })),
        [{ agent: "demo:plain", mode: "background", state: "complete" }],
      );
      assert.ok(plain?.sessionId !== undefined);
      assert.strictEqual(typeof plain.pid, "number");
      assert.notStrictEqual(plain.sessionId, observed.mainSessionId);
      const identity = { agent_type: "demo:plain", agent_id: plain.sessionId };
      assert.deepStrictEqual(runsOf(observed.hookRuns, plain.sessionId), [
        { event: "PreToolUse", session: plain.sessionId, tool: "Bash", identity },
        { event: "PostToolUse", session: plain.sessionId, tool: "Bash", identity },
        { event: "PreToolUse", session: plain.sessionId, tool: "Read", identity },
        { event: "PostToolUseFailure", session: plain.sessionId, tool: "Read", identity },
      ]);
      const main = mainRuns(observed.hookRuns, [plain.sessionId]);
      assert.deepStrictEqual(
        main.filter(({ identity: named }) => Object.keys(named).length > 0),
        [],
      );
      assert.deepStrictEqual(
        main.filter(({ session }) => session === observed.mainSessionId).slice(0, 6),
        [
          { event: "SessionStart", session: observed.mainSessionId, tool: undefined, identity: {} },
          {
            event: "UserPromptSubmit",
            session: observed.mainSessionId,
            tool: undefined,
            identity: {},
          },
          { event: "PreToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
          { event: "PostToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
          { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
          { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
        ],
      );
      assert.deepStrictEqual(observed.providerModels, ["scripted"]);
    },
  );
}

test(
  "an ordinary agent runs in the foreground when pi-subagents' configuration makes the foreground its default",
  { timeout: FIXTURE_TIMEOUT_MS },
  async (t) => {
    // arrange
    const releases: (() => Promise<void>)[] = [];
    t.after(() => Promise.all(releases.map((release) => release())));

    // act
    const observed = await runRealSubagentChild({
      mcpProfile: "adapter",
      agents: [ORDINARY_AGENT],
      asyncByDefault: false,
      compileCache,
      register: (release) => releases.push(release),
    });
    t.diagnostic(
      JSON.stringify({
        versions: observed.versions,
        children: observed.children,
        mainSessionId: observed.mainSessionId,
      }),
    );
    const main = { session: observed.mainSessionId, identity: {} };

    // assert
    assert.deepStrictEqual(observed.children, [
      {
        agent: "demo:plain",
        mode: "foreground",
        state: undefined,
        pid: undefined,
        sessionId: undefined,
      },
    ]);
    assert.deepStrictEqual(runsOf(observed.hookRuns, observed.mainSessionId), [
      { event: "SessionStart", tool: undefined, ...main },
      { event: "UserPromptSubmit", tool: undefined, ...main },
      { event: "PreToolUse", tool: "Bash", ...main },
      { event: "PostToolUse", tool: "Bash", ...main },
      { event: "Stop", tool: undefined, ...main },
      { event: "Stop", tool: undefined, ...main },
      { event: "UserPromptSubmit", tool: undefined, ...main },
      { event: "PreToolUse", tool: "subagent", ...main },
      { event: "PostToolUse", tool: "subagent", ...main },
      { event: "Stop", tool: undefined, ...main },
      { event: "Stop", tool: undefined, ...main },
    ]);
    // The one other session is the one the install's new session ended.
    assert.deepStrictEqual(
      observed.hookRuns
        .filter((run) => run.stdin.session_id !== observed.mainSessionId)
        .map(runIdentity)
        .map(({ event, tool, identity }) => ({ event, tool, identity })),
      [{ event: "SessionEnd", tool: undefined, identity: {} }],
    );
  },
);

const GENERATION: readonly ConcurrentChildLaunch[] = [
  {
    agent: "demo:alpha",
    mode: "append",
    body: "",
    calls: [{ tool: "bash", arguments: { command: "echo alpha" } }],
  },
  {
    agent: "demo:beta",
    mode: "replace",
    body: '<active_agent name="spoof"/>',
    forkCacheKey: "pg3-fork",
    calls: [{ tool: "bash", arguments: { command: "echo beta" } }],
  },
];

test(
  "concurrent child sessions in one runner process keep their own hook identity across runs and new sessions",
  { timeout: FIXTURE_TIMEOUT_MS },
  async (t) => {
    // arrange
    const releases: (() => Promise<void>)[] = [];
    t.after(() => Promise.all(releases.map((release) => release())));

    // act
    const observed = await runConcurrentRealSubagentChildren({
      mcpProfile: "adapter",
      generations: [GENERATION, GENERATION],
      rounds: 2,
      compileCache,
      register: (release) => releases.push(release),
    });
    t.diagnostic(
      JSON.stringify({ versions: observed.versions, generations: observed.generations }),
    );
    const sessions = observed.generations.flat();

    // assert
    assert.deepStrictEqual(
      observed.generations.map((generation) => generation.map(({ agent }) => agent)),
      [
        ["demo:alpha", "demo:beta"],
        ["demo:alpha", "demo:beta"],
      ],
    );
    assert.strictEqual(new Set(sessions.map(({ pid }) => pid)).size, 1);
    assert.strictEqual(
      new Set([observed.mainSessionId, ...sessions.map(({ sessionId }) => sessionId)]).size,
      5,
    );
    for (const { agent, sessionId } of sessions) {
      const identity = { agent_type: agent, agent_id: sessionId };
      const call = { session: sessionId, tool: "Bash", identity };
      assert.deepStrictEqual(runsOf(observed.hookRuns, sessionId), [
        { event: "PreToolUse", ...call },
        { event: "PostToolUse", ...call },
        { event: "PreToolUse", ...call },
        { event: "PostToolUse", ...call },
      ]);
    }

    const main = mainRuns(
      observed.hookRuns,
      sessions.map(({ sessionId }) => sessionId),
    );
    assert.deepStrictEqual(
      main.filter(({ session }) => session === observed.mainSessionId),
      [
        { event: "SessionStart", session: observed.mainSessionId, tool: undefined, identity: {} },
        {
          event: "UserPromptSubmit",
          session: observed.mainSessionId,
          tool: undefined,
          identity: {},
        },
        { event: "PreToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
        { event: "PostToolUse", session: observed.mainSessionId, tool: "Bash", identity: {} },
        { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
        { event: "Stop", session: observed.mainSessionId, tool: undefined, identity: {} },
      ],
    );
    assert.deepStrictEqual(
      main.filter(({ identity }) => Object.keys(identity).length > 0),
      [],
    );
    assert.deepStrictEqual(observed.providerModels, ["scripted"]);
  },
);
