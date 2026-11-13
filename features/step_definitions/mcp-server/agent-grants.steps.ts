/**
 * @fileoverview Steps about the MCP tool grants of a plugin's agents: an
 * agent whose `tools:` line grants a plugin MCP tool by its Claude Code name,
 * and an agent with no `tools:` line (MCP-07, D-CF6-07, D-CF6-10, MGRT-01).
 *
 * Both write the agent through the MCP server fixture writer, never through
 * the agent fixtures, so the agent's file holds only what these steps name.
 *
 * MGRT-01: a profile Pi with pi-subagents and the profile's MCP launch shows
 * the grant form of the active implementation in what pi-subagents reports.
 * An agents index rewritten as a release before MGRT-01 wrote it plays an
 * agent that release installed.
 *
 * MGRT-02 / D-MB-12: a profile Pi started with pi-subagents' child marker,
 * `PI_SUBAGENT_CHILD=1`, plays a pi-subagents background child. pi-subagents
 * 0.84.0 sets the marker in its runner process before any child session
 * starts, and every ambient extension loads into those sessions.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { Given, Then, When } from "@cucumber/cucumber";

import {
  holdsAgentGrantForms,
  readAgentIndexRows,
  stripAgentGrantForms,
} from "../../lib/mcp-agent-earlier-index.ts";
import { mcpImplementationLaunch } from "../../lib/mcp-implementation.ts";
import { publishMcpServerAgent } from "../../lib/mcp-server-files.ts";
import {
  PI_LAUNCH_ENVIRONMENT_EXTENSION,
  readAppliedLaunchEnvironments,
  writeLaunchEnvironment,
} from "../../lib/pi-launch-environment.ts";
import { PROFILE_PI_START_TIMEOUT_MS } from "../../support/world.ts";

import type { AgentGrantForm } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import type {
  AgentsIndex,
  AgentsIndexEntry,
} from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";
import type { ScenarioWorld } from "../../support/world.ts";

const HISTORICAL_LEAD =
  "tools include MCP tools, which pi-subagents serves only to background children -- " +
  "the agent runs in the background (`async: true`), where Claude Code runs it in the " +
  "foreground; ";
const CORRECTED_LEAD =
  "tools include MCP tools, which require a pi-subagents background child -- " +
  "the agent runs in the background (`async: true`); ";
const ADAPTER_TAIL = "a launch before pi-mcp-adapter has cached the server's tools still fails";
const BUILTIN_TAIL = "a launch before Pi's built-in MCP has listed the server's tools still fails";
const AGENT_FILE = "pi-claude-marketplace-demo-runner.md";
const AGENT_BODY = "\nCall the tools the task names.\n";
const OTHER_WARNING = "a warning that stays";

interface GrantForms {
  readonly adapter: AgentGrantForm;
  readonly builtin: AgentGrantForm;
}

interface GrantFixture {
  readonly indexPath: string;
  readonly targetPath: string;
  readonly originalIndex: string;
  readonly originalFile: string;
  readonly row: AgentsIndexEntry;
  readonly forms: GrantForms;
  readonly legacy: boolean;
}

interface GrantScenarioWorld extends ScenarioWorld {
  grantFixture?: GrantFixture;
}

function warning(generation: string, implementation: "adapter" | "builtin"): string {
  assert.ok(generation === "historical" || generation === "corrected" || generation === "near");
  const lead = generation === "historical" ? HISTORICAL_LEAD : CORRECTED_LEAD;
  const tail = implementation === "adapter" ? ADAPTER_TAIL : BUILTIN_TAIL;
  return lead + tail + (generation === "near" ? "!" : "");
}

function grantBlock(
  world: ScenarioWorld,
  implementation: "adapter" | "builtin",
  generation: string,
): string {
  const sourcePath = path.join(
    world.tokens.home,
    "marketplaces/fixtures/plugins/demo/agents/runner.md",
  );
  const selector = implementation === "adapter" ? "plugin_demo_stub_" : "plugin_demo_stub";
  return [
    "---",
    "name: demo:runner",
    "description: Calls the tools the task names.",
    `aliases: ${AGENT_FILE.slice(0, -3)}`,
    `tools: mcp:${selector}/echo`,
    "systemPromptMode: replace",
    "inheritProjectContext: true",
    "inheritSkills: false",
    "advertise: true",
    "async: true",
    "provenance:",
    "  generatedBy: pi-claude-marketplace",
    "  sourcePlugin: demo",
    "  sourceAgent: runner",
    `  sourcePath: ${sourcePath}`,
    "  droppedFields: []",
    "  droppedTools: []",
    "  warnings:",
    `    - ${warning(generation, implementation)}`,
    `    - ${OTHER_WARNING}`,
    "---",
    "",
  ].join("\n");
}

async function replaceFixtureFile(file: string, text: string): Promise<void> {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function seedGrantFixture(
  world: GrantScenarioWorld,
  generation: string,
  legacy: boolean,
): Promise<void> {
  const indexPath = path.join(world.scopeRoot("user"), "pi-claude-marketplace/agents-index.json");
  const targetPath = path.join(world.scopeRoot("user"), "agents", AGENT_FILE);
  const installed = JSON.parse(await readFile(indexPath, "utf8")) as AgentsIndex;
  assert.strictEqual(installed.schemaVersion, 1);
  assert.strictEqual(installed.agents.length, 1);
  const [installedRow] = installed.agents;
  assert.ok(installedRow !== undefined);
  assert.strictEqual(installedRow.targetPath, targetPath);
  let held: "adapter" | "builtin" = "adapter";
  if (!legacy && world.mcpProfile === "adapter") {
    held = "builtin";
  }

  const adapter = grantBlock(world, "adapter", generation);
  const builtin = grantBlock(world, "builtin", generation);
  const forms: GrantForms = {
    adapter: {
      frontmatter: adapter,
      warnings: [warning(generation, "adapter"), OTHER_WARNING],
      droppedTools: [],
    },
    builtin: {
      frontmatter: builtin,
      warnings: [warning(generation, "builtin"), OTHER_WARNING],
      droppedTools: [],
    },
  };
  const { mcpImplementation: _implementation, mcpForms: _forms, ...baseRow } = installedRow;
  const row: AgentsIndexEntry = legacy
    ? { ...baseRow, warnings: forms.adapter.warnings, droppedTools: [] }
    : {
        ...baseRow,
        warnings: forms[held].warnings,
        droppedTools: [],
        mcpImplementation: held,
        mcpForms: forms,
      };
  const fileText = forms[held].frontmatter + AGENT_BODY;
  const indexText = `${JSON.stringify({ ...installed, agents: [row] }, null, 2)}\n`;
  await replaceFixtureFile(targetPath, fileText);
  await replaceFixtureFile(indexPath, indexText);
  world.grantFixture = {
    indexPath,
    targetPath,
    originalIndex: indexText,
    originalFile: fileText,
    row,
    forms,
    legacy,
  };
  assert.strictEqual(await readFile(targetPath, "utf8"), fileText);
  assert.strictEqual(await readFile(indexPath, "utf8"), indexText);
}

function grantFixture(world: GrantScenarioWorld): GrantFixture {
  const fixture = world.grantFixture;
  assert.ok(fixture !== undefined, "no MCP grant fixture was installed");
  return fixture;
}

// The `tools:` lines of the agent file at `file`, so a step can check that
// the file grants exactly what it names.
async function toolsLines(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  return text.split("\n").filter((line) => line.startsWith("tools:"));
}

// D-CF6-07: `tool` is a plugin MCP tool's Claude Code name, such as
// `mcp__plugin_demo_stub__echo`, which the agents bridge converts to an
// `mcp:` entry for pi-subagents.
Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} granted the mcp tool {string}",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string, tool: string) {
    const file = await publishMcpServerAgent(this.requirePublished(name), plugin, agent, tool);
    assert.deepStrictEqual(await toolsLines(file), [`tools: ${tool}`]);
  },
);

// D-CF6-10: an agent with no `tools:` line gets pi-subagents' default tools.
Given(
  "the published plugin {string} of the marketplace {string} has the agent {string} with no mcp tools",
  async function (this: ScenarioWorld, plugin: string, name: string, agent: string) {
    const file = await publishMcpServerAgent(this.requirePublished(name), plugin, agent, undefined);
    assert.deepStrictEqual(await toolsLines(file), []);
  },
);

// MGRT-01: pi-subagents with the MCP launch of the profile: pi-mcp-adapter
// under the adapter profile, the built-in stand-in under the builtin profile.
Given(
  "pi runs with the scripted model, pi-subagents, and the mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const launch = mcpImplementationLaunch(this.mcpProfile);
    await this.usePiWithProfile({
      companions: ["pi-subagents", ...launch.companions],
      extraExtensions: launch.extraExtensions,
    });
  },
);

// MGRT-01 / P4-DC-06: a release before MGRT-01 recorded no grant form on an
// agent's row, and its agent files hold pi-mcp-adapter's form. The step checks
// what the index holds afterwards, not how many rows changed, so it passes
// where the rows already hold no forms.
Given(
  "the agents index of the user scope holds the rows an earlier release wrote",
  async function (this: ScenarioWorld) {
    const file = path.join(this.scopeRoot("user"), "pi-claude-marketplace", "agents-index.json");
    await stripAgentGrantForms(file);
    const rows = await readAgentIndexRows(file);
    assert.notStrictEqual(rows.length, 0, `${file} holds no agent`);
    assert.deepStrictEqual(rows.filter(holdsAgentGrantForms), []);
  },
);

// MGRT-02: the launch-environment extension sets the marker in the profile
// Pi's own environment before any session starts, as pi-subagents' runner
// does, and this extension reads it at session start, after every extension
// loaded. This Pi is not a whole child: the world loads companions before
// `extraExtensions`, so pi-subagents' factory runs before the marker is set
// and registers its tools, which pi-subagents 0.84.0 skips in a real child
// (`src/extension/index.js:225`). So no scenario calls `subagent` in this Pi.
// Once it started, the step empties the launch environment, which the
// extension reads at every start, so a restart starts a Pi that is not a
// child, as the user's next Pi outside pi-subagents is.
Given(
  "pi runs with the scripted model and pi-subagents as a pi-subagents background child",
  { timeout: PROFILE_PI_START_TIMEOUT_MS },
  async function (this: ScenarioWorld) {
    const { home } = this.tokens;
    const file = await writeLaunchEnvironment(home, { PI_SUBAGENT_CHILD: "1" });
    this.onRelease(() => rm(file, { force: true }));
    await this.usePiWithProfile({
      companions: ["pi-subagents"],
      extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION],
    });
    assert.deepStrictEqual(await readAppliedLaunchEnvironments(this.profileHarness()), [
      { PI_SUBAGENT_CHILD: "1" },
    ]);
    await rm(file);
    assert.strictEqual(await writeLaunchEnvironment(home, {}), file);
  },
);

Given(
  "the installed mcp agent holds the {word} warning for the other implementation",
  async function (this: GrantScenarioWorld, generation: string) {
    await seedGrantFixture(this, generation, false);
  },
);

Given(
  "the installed mcp agent holds the {word} warning without implementation metadata",
  async function (this: GrantScenarioWorld, generation: string) {
    await seedGrantFixture(this, generation, true);
  },
);

Given(
  "the user has edited one byte of the installed mcp agent",
  async function (this: GrantScenarioWorld) {
    const fixture = grantFixture(this);
    const edited = fixture.originalFile.replace("Calls", "calls");
    await replaceFixtureFile(fixture.targetPath, edited);
    this.grantFixture = { ...fixture, originalFile: edited };
    assert.strictEqual(await readFile(fixture.targetPath, "utf8"), edited);
  },
);

When(
  "the user restarts pi twice with this profile's mcp implementation",
  { timeout: PROFILE_PI_START_TIMEOUT_MS * 3 },
  async function (this: GrantScenarioWorld) {
    const restart = this.mcpProfile === "adapter" ? "with-adapter" : "without-adapter";
    const first = await this.restartPi(restart);
    assert.deepStrictEqual(first.payloads, []);
    assert.strictEqual(await this.runningMcpImplementation(), this.mcpProfile);
    const second = await this.restartPi(restart);
    assert.deepStrictEqual(second.payloads, []);
    assert.strictEqual(await this.runningMcpImplementation(), this.mcpProfile);
    this.recordResults(second.payloads, "session");
    this.skills = second.skills;
  },
);

When(
  "the user restarts pi twice with built-in mcp",
  { timeout: PROFILE_PI_START_TIMEOUT_MS * 4 },
  async function (this: GrantScenarioWorld) {
    if (this.mcpProfile === "adapter") {
      const withoutAdapter = await this.restartPi("without-adapter");
      assert.deepStrictEqual(withoutAdapter.payloads, []);
      if ((await this.runningMcpImplementation()) === "none") {
        const first = await this.restartPi("builtin-on");
        assert.deepStrictEqual(first.payloads, []);
      }
    } else {
      const first = await this.restartPi("without-adapter");
      assert.deepStrictEqual(first.payloads, []);
    }

    assert.strictEqual(await this.runningMcpImplementation(), "builtin");
    const second = await this.restartPi("without-adapter");
    assert.deepStrictEqual(second.payloads, []);
    assert.strictEqual(await this.runningMcpImplementation(), "builtin");
    this.recordResults(second.payloads, "session");
    this.skills = second.skills;
  },
);

Then(
  "the installed mcp agent and index contain the complete switched grant and warnings",
  async function (this: GrantScenarioWorld) {
    const fixture = grantFixture(this);
    const active = this.mcpProfile;
    assert.strictEqual(
      await readFile(fixture.targetPath, "utf8"),
      fixture.forms[active].frontmatter + AGENT_BODY,
    );
    const expected: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          ...fixture.row,
          mcpImplementation: active,
          mcpForms: fixture.forms,
          warnings: fixture.forms[active].warnings,
          droppedTools: [],
        },
      ],
    };
    const actual: unknown = JSON.parse(await readFile(fixture.indexPath, "utf8"));
    assert.deepStrictEqual(actual, expected);
  },
);

Then(
  "the implementation-less mcp agent and index contain the complete built-in grant and warnings",
  async function (this: GrantScenarioWorld) {
    const fixture = grantFixture(this);
    assert.strictEqual(fixture.legacy, true);
    assert.strictEqual(
      await readFile(fixture.targetPath, "utf8"),
      fixture.forms.builtin.frontmatter + AGENT_BODY,
    );
    const expected: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          ...fixture.row,
          mcpImplementation: "builtin",
          mcpForms: fixture.forms,
          warnings: fixture.forms.builtin.warnings,
          droppedTools: [],
        },
      ],
    };
    const actual: unknown = JSON.parse(await readFile(fixture.indexPath, "utf8"));
    assert.deepStrictEqual(actual, expected);
  },
);

Then(
  "the installed mcp agent file and index remain byte identical",
  async function (this: GrantScenarioWorld) {
    const fixture = grantFixture(this);
    assert.strictEqual(await readFile(fixture.targetPath, "utf8"), fixture.originalFile);
    assert.strictEqual(await readFile(fixture.indexPath, "utf8"), fixture.originalIndex);
  },
);
