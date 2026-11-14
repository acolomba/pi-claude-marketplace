import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverGeneratedNames } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts";

import type { MaterializablePlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type { TestContext } from "node:test";

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  return pluginRoot;
}

function resolvedPlugin(
  pluginRoot: string,
  componentPaths: {
    readonly agents: readonly string[];
    readonly commands: readonly string[];
    readonly skills: readonly string[];
    readonly workflows: readonly string[];
  },
): MaterializablePlugin {
  return {
    componentPaths: {
      agents: [...componentPaths.agents],
      commands: [...componentPaths.commands],
      skills: [...componentPaths.skills],
      workflows: [...componentPaths.workflows],
    },
    defaultEnabled: true,
    installable: true,
    mcpServers: {},
    declaredMcpServers: {},
    name: "acme",
    notes: [],
    pluginRoot,
    state: "installable",
    supported: ["agents", "commands", "skills"],
    unsupported: [],
  };
}

async function writeAgent(
  directory: string,
  fileName: string,
  frontmatter: Readonly<Record<string, string>> = {},
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const fields = Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}\n`);
  const contents =
    fields.length === 0 ? "Agent body.\n" : `---\n${fields.join("")}---\n\nAgent body.\n`;
  await writeFile(path.join(directory, fileName), contents, "utf8");
}

async function writeCommand(directory: string, fileName: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), "Command body.\n", "utf8");
}

async function writeSkill(directory: string, sourceName: string): Promise<void> {
  const skillDirectory = path.join(directory, sourceName);
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(path.join(skillDirectory, "SKILL.md"), "Skill body.\n", "utf8");
}

async function writeWorkflow(
  directory: string,
  fileName: string,
  metaName?: string,
  body = "",
): Promise<void> {
  await mkdir(directory, { recursive: true });
  const contents =
    metaName === undefined
      ? `export function help() {\n  return 1;\n}\n${body}`
      : `export const meta = { name: ${JSON.stringify(metaName)}, description: "d" };\n${body}`;
  await writeFile(path.join(directory, fileName), contents, "utf8");
}

function agentCall(agentType: string): string {
  return `await agent("run", { agentType: ${JSON.stringify(agentType)} });\n`;
}

function restrictionNote(fileName: string, folder: string, agentType: string): string {
  return `workflow script "${fileName}" in "${folder}" runs agent type "${agentType}", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write`;
}

test("composes generated names from every bridge in each bridge's declared order", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-complete-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const commandsDirectory = path.join(pluginRoot, "commands");
  const skillsDirectory = path.join(pluginRoot, "skills");
  await writeAgent(agentsDirectory, "zeta.md");
  await writeAgent(agentsDirectory, "alpha.md");
  await writeCommand(commandsDirectory, "zeta.md");
  await writeCommand(commandsDirectory, "alpha.md");
  // Skill names differ from the command names: a command keeps a name it shares with a skill
  // of its plugin, and the skill is not staged (D-CF2-03).
  await writeSkill(skillsDirectory, "zeta-guide");
  await writeSkill(skillsDirectory, "alpha-guide");
  const workflowsDirectory = path.join(pluginRoot, "workflows");
  await writeWorkflow(workflowsDirectory, "zeta.js", "zeta");
  await writeWorkflow(workflowsDirectory, "alpha.js", "acme-alpha");
  // A helper module with no `meta` is not a workflow, so it contributes no name.
  await writeWorkflow(workflowsDirectory, "helper.js");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
    workflows: ["workflows"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-alpha", "pi-claude-marketplace-acme-zeta"],
    agentsDirs: [agentsDirectory],
    commands: ["acme:alpha", "acme:zeta"],
    skills: ["acme-alpha-guide", "acme-zeta-guide"],
    workflows: ["acme:alpha", "acme:zeta"],
    workflowAgentRestrictionNotes: [],
  });
});

test("returns empty names and a null source when no components are declared", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-empty-");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: [],
    commands: [],
    skills: [],
    workflows: [],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: [],
    agentsDirs: [],
    commands: [],
    skills: [],
    workflows: [],
    workflowAgentRestrictionNotes: [],
  });
});

test("returns an empty agent list with the selected relative source directory", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-empty-agents-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  await mkdir(agentsDirectory, { recursive: true });
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: [],
    skills: [],
    workflows: [],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: [],
    agentsDirs: [agentsDirectory],
    commands: [],
    skills: [],
    workflows: [],
    workflowAgentRestrictionNotes: [],
  });
});

test("keeps first-wins names while deliberately dropping all bridge warnings", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-warnings-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const commandsDirectory = path.join(pluginRoot, "commands");
  const skillsDirectory = path.join(pluginRoot, "skills");
  await writeAgent(agentsDirectory, "a.md", { name: "review" });
  await writeAgent(agentsDirectory, "b.md", { name: "review" });
  await writeCommand(commandsDirectory, "acme-run.md");
  await writeCommand(commandsDirectory, "run.md");
  await writeSkill(skillsDirectory, "acme-helper");
  await writeSkill(skillsDirectory, "helper");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
    workflows: [],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-review"],
    agentsDirs: [agentsDirectory],
    commands: ["acme:run"],
    skills: ["acme-helper"],
    workflows: [],
    workflowAgentRestrictionNotes: [],
  });
});

test("discovers agents from every resolved directory in resolver order", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-agent-dirs-");
  const declaredDirectory = path.join(pluginRoot, "declared-agents");
  const conventionalDirectory = path.join(pluginRoot, "agents");
  await writeAgent(declaredDirectory, "shared.md", { name: "shared" });
  await writeAgent(conventionalDirectory, "later.md", { name: "later" });
  await writeAgent(conventionalDirectory, "shared.md", { name: "shared" });
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["declared-agents", "agents"],
    commands: [],
    skills: [],
    workflows: [],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-shared", "pi-claude-marketplace-acme-later"],
    agentsDirs: [declaredDirectory, conventionalDirectory],
    commands: [],
    skills: [],
    workflows: [],
    workflowAgentRestrictionNotes: [],
  });
});

test("propagates a hard agent failure after successful skill and command discovery", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-agent-failure-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const commandsDirectory = path.join(pluginRoot, "commands");
  const skillsDirectory = path.join(pluginRoot, "skills");
  await writeAgent(agentsDirectory, "invalid.md", { name: "." });
  await writeCommand(commandsDirectory, "valid.md");
  await writeSkill(skillsDirectory, "valid");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
    workflows: [],
  });

  // act & assert
  await assert.rejects(() => discoverGeneratedNames("acme", resolved), {
    name: "Error",
    message: `agent name in ${path.join(agentsDirectory, "invalid.md")} must not be "." or "..".`,
  });
});

test("PG-SEC-01: notes a workflow script that runs a tool-restricted agent of the plugin", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-restricted-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const workflowsDirectory = path.join(pluginRoot, "workflows");
  await writeAgent(agentsDirectory, "reader.md", { tools: "Read" });
  await writeWorkflow(workflowsDirectory, "scan.js", "scan", agentCall("acme:reader"));
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: [],
    skills: [],
    workflows: ["workflows"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-reader"],
    agentsDirs: [agentsDirectory],
    commands: [],
    skills: [],
    workflows: ["acme:scan"],
    workflowAgentRestrictionNotes: [
      `workflow script "scan.js" in "workflows" runs agent type "acme:reader", which restricts its tools; the workflow engine does not keep that restriction, so the agent can use read, bash, edit, and write`,
    ],
  });
});

for (const { shape, agentFile, frontmatter, agentType } of [
  {
    shape: "the generated agent name",
    agentFile: "reader.md",
    frontmatter: { tools: "Read" },
    agentType: "pi-claude-marketplace-acme-reader",
  },
  {
    shape: "an agent that sets disallowedTools",
    agentFile: "reader.md",
    frontmatter: { disallowedTools: "Bash" },
    agentType: "acme:reader",
  },
  {
    shape: "the namespaced upstream name of an agent in a subfolder",
    agentFile: path.join("review", "security.md"),
    frontmatter: { tools: "Read" },
    agentType: "acme:review:security",
  },
] satisfies readonly {
  shape: string;
  agentFile: string;
  frontmatter: Readonly<Record<string, string>>;
  agentType: string;
}[]) {
  test(`PG-SEC-01: notes a restricted agent named by ${shape}`, async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "plugin-discover-names-restricted-match-");
    const agentsDirectory = path.join(pluginRoot, "agents");
    const workflowsDirectory = path.join(pluginRoot, "workflows");
    await writeAgent(
      path.dirname(path.join(agentsDirectory, agentFile)),
      path.basename(agentFile),
      frontmatter,
    );
    await writeWorkflow(workflowsDirectory, "scan.js", "scan", agentCall(agentType));
    const resolved = resolvedPlugin(pluginRoot, {
      agents: ["agents"],
      commands: [],
      skills: [],
      workflows: ["workflows"],
    });

    // act
    const discovered = await discoverGeneratedNames("acme", resolved);

    // assert
    assert.deepStrictEqual(discovered.workflowAgentRestrictionNotes, [
      restrictionNote("scan.js", "workflows", agentType),
    ]);
  });
}

for (const { shape, frontmatter, script } of [
  {
    shape: "an agent with no tool restriction",
    frontmatter: { description: "reads" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("acme:reader")}`,
  },
  {
    shape: "an agent whose tools value is blank",
    frontmatter: { tools: "" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("acme:reader")}`,
  },
  {
    shape: "an agent type of another plugin",
    frontmatter: { tools: "Read" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("other:reader")}`,
  },
  {
    shape: "an empty agent type",
    frontmatter: { tools: "Read" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("")}`,
  },
  {
    shape: "an agent type that differs only by case",
    frontmatter: { tools: "Read" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("acme:Reader")}`,
  },
  {
    shape: "a script that names the agent but is skipped",
    frontmatter: { tools: "Read" },
    script: agentCall("acme:reader"),
  },
  {
    shape: "a script that names the agent but is refused",
    frontmatter: { tools: "Read" },
    script: `export const meta = { name: "scan", description: "d" };\n${agentCall("acme:reader")}const at = Date.now();\n`,
  },
] satisfies readonly {
  shape: string;
  frontmatter: Readonly<Record<string, string>>;
  script: string;
}[]) {
  test(`PG-SEC-01: gives no restriction note for ${shape}`, async (t) => {
    // arrange
    const pluginRoot = await createPluginRoot(t, "plugin-discover-names-unrestricted-");
    await writeAgent(path.join(pluginRoot, "agents"), "reader.md", frontmatter);
    const workflowsDirectory = path.join(pluginRoot, "workflows");
    await mkdir(workflowsDirectory, { recursive: true });
    await writeFile(path.join(workflowsDirectory, "scan.js"), script, "utf8");
    const resolved = resolvedPlugin(pluginRoot, {
      agents: ["agents"],
      commands: [],
      skills: [],
      workflows: ["workflows"],
    });

    // act
    const discovered = await discoverGeneratedNames("acme", resolved);

    // assert
    assert.deepStrictEqual(discovered.workflowAgentRestrictionNotes, []);
  });
}

test("PG-SEC-01: gives one note per distinct script and agent type pair, in script order", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-restricted-pairs-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const workflowsDirectory = path.join(pluginRoot, "workflows");
  await writeAgent(agentsDirectory, "reader.md", { tools: "Read" });
  await writeAgent(agentsDirectory, "writer.md", { disallowedTools: "Bash" });
  await writeAgent(agentsDirectory, "free.md");
  await writeWorkflow(
    workflowsDirectory,
    "b.js",
    "bee",
    agentCall("acme:writer") + agentCall("acme:free") + agentCall("acme:reader"),
  );
  await writeWorkflow(
    workflowsDirectory,
    "a.js",
    "ay",
    agentCall("acme:reader") + agentCall("acme:reader"),
  );
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: [],
    skills: [],
    workflows: ["workflows"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered.workflowAgentRestrictionNotes, [
    restrictionNote("a.js", "workflows", "acme:reader"),
    restrictionNote("b.js", "workflows", "acme:writer"),
    restrictionNote("b.js", "workflows", "acme:reader"),
  ]);
});

test("PG-SEC-01: escapes format characters in the file name and the agent type of a note", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-restricted-escape-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const workflowsDirectory = path.join(pluginRoot, "workflows");
  await writeAgent(agentsDirectory, "reader.md", { name: "rea\u200bder", tools: "Read" });
  await writeWorkflow(workflowsDirectory, "sc\u202ean.js", "scan", agentCall("acme:rea\u200bder"));
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: [],
    skills: [],
    workflows: ["workflows"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered.workflowAgentRestrictionNotes, [
    restrictionNote(String.raw`sc\u{202e}an.js`, "workflows", String.raw`acme:rea\u{200b}der`),
  ]);
});
