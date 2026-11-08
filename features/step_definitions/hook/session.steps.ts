/**
 * @fileoverview Steps about the session actions that run plugin hooks: a new
 * session, a compaction, a fork, a stop, a release of a waiting hook, and a
 * start after a crash of the profile Pi, a reload and a quit of a Pi in the
 * terminal, the setup they need, and each action recording the hook runs it
 * caused as a turn.
 *
 * A session action is not a prompt, so the model-turn `When` cannot read the
 * hook runs it causes. Each action `When` here reads the stand-in logs of the
 * profile Pi before and after the action and keeps the lines the action added
 * as the last turn (HAR-03), so the hook runs steps state them. Each setup
 * `Given` performs the same action and records no turn.
 *
 * Pi compacts nothing in a session shorter than its recent-token budget, so a
 * compaction scenario first lowers the budget in the agent settings, before
 * the profile Pi starts. The scripted model plays each summarization call of
 * a compaction, so the script lists one reply for each. A compaction that a
 * hook cancels fails, and its step states the error Pi answers with.
 *
 * Pi offers `/reload` only in the terminal, so the reload and the terminal
 * quit run a Pi in the terminal beside the profile Pi, which installed the
 * plugin and stays idle. Both share the sandbox, so the terminal Pi's hook
 * runs land in the profile Pi's harness directory.
 *
 * A hook whose script waits goes on until a step creates its release marker,
 * `$HOME/hook-releases/<name>` (D-BG-12). The extension shows an async rewake
 * hook's declared rewake summary on every exit, so the release steps wait for
 * the hook's end line in the lifecycle log and then for that summary, the
 * sign that the extension handled the exit. A released hook must declare one.
 *
 * A Pi that dies leaves its hook processes running, and the next Pi's load
 * stops them (ASYNC-04). The crash step kills the profile Pi's own process
 * and asserts that every hook process a pid file names still runs. The
 * restart step starts the same launch again and keeps the new session's
 * results and what the start added as the last turn.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, When } from "@cucumber/cucumber";

import { promptDisposition } from "../../../test/e2e/_rpc.ts";
import { readHookScriptPids } from "../../lib/hook-files.ts";
import { HOOK_RUNS_LOG, waitForHookLifecycle } from "../../lib/hook-recorder.ts";
import { startSession } from "../../lib/pi-commands.ts";
import { expandTokens } from "../../lib/run-tokens.ts";
import { modelCallsOf, readModelCalls } from "../../lib/scripted-model/script.ts";
import { isRunning, readLogLengths, readLogLinesSince } from "../../lib/turn-records.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { HookRun } from "../../lib/hook-recorder.ts";
import type { RpcRecord } from "../../lib/pi-process.ts";
import type { ModelCall } from "../../lib/scripted-model/script.ts";
import type { ScenarioWorld } from "../../support/world.ts";

// Pi keeps this many tokens of recent history out of a compaction. One token
// makes a one-turn session compactable.
const COMPACTION_SETTINGS = `${JSON.stringify({ compaction: { keepRecentTokens: 1 } })}\n`;

// A scripted turn settles in well under a second; the margin covers a loaded
// CI runner and stays below the 30-second step timeout, so a setup prompt
// that never settles fails here.
const SETUP_TURN_TIMEOUT_MS = 20_000;

const DIALOG_METHODS: ReadonlySet<string> = new Set(["select", "confirm", "input", "editor"]);

// The terminal Pi compiles nothing new, because the profile Pi already filled
// the compile cache, so its first SessionStart run lands within seconds; the
// margin covers a slow worker.
const TERMINAL_STARTUP_RUN_TIMEOUT_MS = 30_000;

// How often the terminal Given reads the hook log while it waits for the
// startup run; a short interval keeps the wait close to the run itself.
const HOOK_LOG_POLL_MS = 50;

// A prompt's UserPromptSubmit run lands within seconds of the prompt; the
// margin covers a loaded CI runner and stays below the step timeout.
const TERMINAL_PROMPT_RUN_TIMEOUT_MS = 20_000;

// A released script exits within a second, and the extension shows its
// rewake summary right after; the margin covers a loaded CI runner and stays
// below the 30-second step timeout.
const HOOK_RELEASE_TIMEOUT_MS = 20_000;

// An extension error or a dialog during a session action is never expected.
function faultsOf(records: readonly RpcRecord[]): readonly RpcRecord[] {
  return records.filter(
    (record) =>
      record.type === "extension_error" ||
      (record.type === "extension_ui_request" && DIALOG_METHODS.has(String(record.method))),
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Whether `record` is the `claude-plugin` entry of a rewake summary.
function isRewakeSummary(record: RpcRecord): boolean {
  const { entry } = record;
  return (
    record.type === "entry_appended" &&
    isRecord(entry) &&
    entry.customType === "claude-plugin" &&
    isRecord(entry.data) &&
    entry.data.kind === "async-rewake-summary"
  );
}

// The calls the model got past the end of its script, by number.
function overflowingCalls(calls: readonly ModelCall[]): readonly string[] {
  return calls.filter((call) => call.overflow).map((call) => `call ${call.index + 1}`);
}

// Runs `action` on the profile Pi and keeps every record and stand-in log line
// it added as the last turn, after asserting that Pi reported no fault and
// called the model no further than its script. The action resolves only once
// Pi answered, and Pi answers a session action after its session handlers,
// the hooks among them, finished.
async function recordSessionAction(
  world: ScenarioWorld,
  prompt: string,
  action: () => Promise<void>,
): Promise<void> {
  const harness = world.profileHarness();
  const lengths = await readLogLengths(harness);
  const from = world.pi.recordCount();
  await action();
  const records = world.pi.recordsSince(from);
  assert.deepStrictEqual(faultsOf(records), []);
  const logs = await readLogLinesSince(harness, lengths);
  assert.deepStrictEqual(overflowingCalls(modelCallsOf(logs)), [], "the model ran past its script");
  world.recordTurn({ prompt, disposition: "handled", records, logs });
}

// Runs `action` on the terminal Pi and keeps the hook log lines it added as
// the last turn. The terminal Pi prints no RPC record, so the turn has none.
async function recordTerminalAction(
  world: ScenarioWorld,
  prompt: string,
  action: () => Promise<void>,
): Promise<void> {
  const harness = world.profileHarness();
  const lengths = await readLogLengths(harness);
  await action();
  const logs = await readLogLinesSince(harness, lengths);
  world.recordTurn({ prompt, disposition: "interactive", records: [], logs });
}

// The hook runs the log holds so far, in the order they were appended.
async function readHookRuns(harness: string): Promise<readonly HookRun[]> {
  const lines = await readLogLinesSince(harness, new Map());
  return (lines.get(HOOK_RUNS_LOG) ?? []) as readonly HookRun[];
}

// Waits until the log holds a run that `isRun` accepts, by reading it again
// every `HOOK_LOG_POLL_MS`, never for a fixed time alone, and fails with
// `missing` after `timeoutMs`.
async function waitForRun(
  harness: string,
  isRun: (run: HookRun) => boolean,
  timeoutMs: number,
  missing: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await readHookRuns(harness)).some(isRun)) {
    assert.ok(Date.now() < deadline, missing);
    await new Promise((resolve) => setTimeout(resolve, HOOK_LOG_POLL_MS));
  }
}

// Waits until the log holds a SessionStart run with the source `startup`.
async function waitForStartupRun(harness: string): Promise<void> {
  await waitForRun(
    harness,
    (run) => run.event === "SessionStart" && run.stdin.source === "startup",
    TERMINAL_STARTUP_RUN_TIMEOUT_MS,
    "the terminal pi ran no SessionStart startup hook",
  );
}

// Waits until a run of a waiting hook removed the release marker `marker`,
// which frees that one run, and fails after `deadline`.
async function waitForReleaseTaken(marker: string, deadline: number): Promise<void> {
  while (existsSync(marker)) {
    assert.ok(Date.now() < deadline, `no run of the hook took its release marker ${marker}`);
    await new Promise((resolve) => setTimeout(resolve, HOOK_LOG_POLL_MS));
  }
}

// Creates the release marker of `hook` in the sandbox home and waits until a
// run of the hook takes it, so it frees exactly one run. Then waits for an
// end line of the hook that the log gained after the release and for the
// rewake summary the extension shows after it, and asserts that Pi reported
// no fault meanwhile.
async function releaseHook(world: ScenarioWorld, hook: string): Promise<void> {
  const deadline = Date.now() + HOOK_RELEASE_TIMEOUT_MS;
  const harness = world.profileHarness();
  const lengths = await readLogLengths(harness);
  const from = world.pi.recordCount();
  const releases = path.join(world.tokens.home, "hook-releases");
  const marker = path.join(releases, hook);
  await mkdir(releases, { recursive: true });
  await writeFile(marker, "", { flag: "wx" });
  await waitForReleaseTaken(marker, deadline);
  await waitForHookLifecycle(harness, hook, "end", lengths, deadline - Date.now());
  await world.pi.waitForRecord(from, isRewakeSummary, deadline - Date.now());
  assert.deepStrictEqual(faultsOf(world.pi.recordsSince(from)), []);
}

// Asserts that some hook process started and that every process a hook pid
// file in `harness` names still runs.
async function assertHookProcessesRunning(harness: string, when: string): Promise<void> {
  const pids = await readHookScriptPids(harness);
  assert.notDeepStrictEqual(pids, [], `no hook process was running ${when}`);
  assert.deepStrictEqual(
    pids.filter((pid) => !isRunning(pid)),
    [],
    `these hook processes were gone ${when}`,
  );
}

// RPC `compact` answers after Pi ran its `session_compact` handlers.
async function compactSession(world: ScenarioWorld): Promise<void> {
  const { response } = await world.pi.request({ type: "compact" });
  assert.strictEqual(response.success, true, JSON.stringify(response));
}

// Pi reads the agent settings when it starts, so this precedes the profile
// Pi. The file is new in the sandbox, and its release removes it.
Given(
  "pi keeps only one recent token when the hooks session compacts",
  async function (this: ScenarioWorld) {
    const file = path.join(this.tokens.agentDir, "settings.json");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, COMPACTION_SETTINGS, { flag: "wx" });
    this.onRelease(() => rm(file, { force: true }));
    assert.strictEqual(await readFile(file, "utf8"), COMPACTION_SETTINGS);
  },
);

// A prompt that gives a compaction a turn to summarize. Pi starts a turn for
// it, and the step waits for `agent_settled`, never for a fixed time, and
// keeps no turn. A setup turn before a later session needs the same, with or
// without hooks, so both phrases share it.
async function promptSetup(this: ScenarioWorld, text: string): Promise<void> {
  const harness = this.profileHarness();
  const from = this.pi.recordCount();
  const message = expandTokens(text, this.tokens);
  const { response } = await this.pi.request({ type: "prompt", message });
  assert.strictEqual(promptDisposition(response), "started", JSON.stringify(response));
  const settled = await this.pi.waitForRecord(
    from,
    (record) => record.type === "agent_settled",
    SETUP_TURN_TIMEOUT_MS,
  );
  assert.strictEqual(settled.aborted, false, JSON.stringify(settled));
  assert.deepStrictEqual(faultsOf(this.pi.recordsSince(from)), []);
  assert.deepStrictEqual(overflowingCalls(await readModelCalls(harness)), []);
}

Given("the user has prompted {string} with the hooks recording", promptSetup);
Given("the user has prompted {string}", promptSetup);

Given(
  "the user has compacted the session with the hooks recording",
  async function (this: ScenarioWorld) {
    this.profileHarness();
    await compactSession(this);
  },
);

Given(
  "the user has released the hook {string}",
  async function (this: ScenarioWorld, hook: string) {
    await releaseHook(this, hook);
  },
);

// The terminal Pi starts beside the profile Pi in the same sandbox, so it
// loads the plugin's user-scope hooks. The step waits for the startup
// SessionStart run, so that run never lands in a later turn.
Given(
  "the user has started pi in the terminal with the hooks recording",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const harness = this.profileHarness();
    await this.startTuiSession();
    await waitForStartupRun(harness);
  },
);
// A waiting hook that the terminal Pi's start ran logs its start right after
// its run, so the step waits for a start line that the log gained after the
// terminal Pi started and checks that the process of that line runs.
Given(
  "the user has started pi in the terminal and the hook {string} goes on in the background",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld, hook: string) {
    const harness = this.profileHarness();
    const lengths = await readLogLengths(harness);
    await this.startTuiSession();
    const started = await waitForHookLifecycle(
      harness,
      hook,
      "start",
      lengths,
      TERMINAL_STARTUP_RUN_TIMEOUT_MS,
    );
    assert.strictEqual(
      isRunning(started.pid),
      true,
      `the hook ${hook} that the terminal pi started is gone`,
    );
  },
);

Given(
  "pi's process has died, leaving its hook processes running",
  async function (this: ScenarioWorld) {
    await this.crashPi();
    await assertHookProcessesRunning(this.profileHarness(), "after pi died");
  },
);

// A new session's payloads become the last results, as the plain new-session
// `When` keeps them, so a payload no step states still fails the scenario.
// `When` keeps them, so a payload no step states still fails the scenario.
When(
  "the user starts a new pi session with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "new_session", async () => {
      const report = await startSession(this.pi);
      this.recordResults(report.payloads, "session");
      this.skills = report.skills;
    });
  },
);

When(
  "the user compacts the session with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "compact", () => compactSession(this));
  },
);

When(
  "the user compacts the session with the hooks recording, which fails with {string}",
  async function (this: ScenarioWorld, message: string) {
    await recordSessionAction(this, "compact", async () => {
      const { response } = await this.pi.request({ type: "compact" });
      assert.deepStrictEqual(
        { success: response.success, error: response.error },
        { success: false, error: message },
      );
    });
  },
);

// Pi forks a session at a user message the caller names, so the step asks
// Pi for the messages it can fork at and picks the first.
When(
  "the user forks the session at its first prompt with the hooks recording",
  async function (this: ScenarioWorld) {
    await recordSessionAction(this, "fork", async () => {
      const listed = await this.pi.request({ type: "get_fork_messages" });
      assert.strictEqual(listed.response.success, true, JSON.stringify(listed.response));
      const { messages } = listed.response.data as {
        readonly messages: ReadonlyArray<{ readonly entryId: string; readonly text: string }>;
      };
      const [first] = messages;
      if (first === undefined) {
        assert.fail("the session holds no prompt to fork at");
      }

      const forked = await this.pi.request({ type: "fork", entryId: first.entryId });
      assert.deepStrictEqual(forked.response.data, { text: first.text, cancelled: false });
    });
  },
);

When(
  "the user releases the hook {string} with the hooks recording",
  async function (this: ScenarioWorld, hook: string) {
    await recordSessionAction(this, "release", () => releaseHook(this, hook));
  },
);

// The new Pi's records all come from its start, so the turn keeps every one.
When(
  "the user starts pi again with the hooks recording",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const harness = this.profileHarness();
    const lengths = await readLogLengths(harness);
    const report = await this.restartPi("after-crash");
    this.recordResults(report.payloads, "session");
    this.skills = report.skills;
    const records = this.pi.recordsSince(0);
    assert.deepStrictEqual(faultsOf(records), []);
    const logs = await readLogLinesSince(harness, lengths);
    this.recordTurn({ prompt: "restart", disposition: "handled", records, logs });
  },
);

// Stopping the profile Pi ends its RPC input, which Pi answers by shutting
// its session down. The release's later stop does nothing.
When("the user quits pi with the hooks recording", async function (this: ScenarioWorld) {
  await recordSessionAction(this, "quit", () => this.pi.stop());
});

// A hook run prints nothing to the terminal, so no quiet window shows that a
// reload ran no session hook. The step types a prompt after the reload and
// waits for its UserPromptSubmit run instead: the bridge dispatches that run
// through the same hooks runtime after the reload, so the turn holds every
// session hook run the reload caused before it.
When(
  "the user reloads pi in the terminal and then prompts {string} with the hooks recording",
  async function (this: ScenarioWorld, text: string) {
    const tui = this.requireTuiSession();
    const harness = this.profileHarness();
    const prompt = expandTokens(text, this.tokens);
    await recordTerminalAction(this, "/reload", async () => {
      await tui.reload();
      tui.sendLine(prompt);
      await waitForRun(
        harness,
        (run) => run.event === "UserPromptSubmit" && run.stdin.prompt === prompt,
        TERMINAL_PROMPT_RUN_TIMEOUT_MS,
        "the terminal pi ran no UserPromptSubmit hook for the prompt after the reload",
      );
    });
  },
);

// The terminal driver quits Pi with its quit keys and waits for Pi to exit,
// and Pi exits after its session handlers ran. The release's later stop does
// nothing.
When(
  "the user quits pi in the terminal with the hooks recording",
  async function (this: ScenarioWorld) {
    const tui = this.requireTuiSession();
    await recordTerminalAction(this, "quit", () => tui.stop());
  },
);
