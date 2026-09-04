import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverGeneratedNames } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts";

import type { MaterializablePlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";
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
  },
): MaterializablePlugin {
  return {
    componentPaths: {
      agents: [...componentPaths.agents],
      commands: [...componentPaths.commands],
      skills: [...componentPaths.skills],
    },
    defaultEnabled: true,
    installable: true,
    mcpServers: {},
    name: "acme",
    notes: [],
    pluginRoot,
    state: "installable",
    supported: ["agents", "commands", "skills"],
    unsupported: [],
  };
}

async function writeAgent(directory: string, fileName: string, name?: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const contents =
    name === undefined ? "Agent body.\n" : `---\nname: ${name}\n---\n\nAgent body.\n`;
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
  await writeSkill(skillsDirectory, "zeta");
  await writeSkill(skillsDirectory, "alpha");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-alpha", "pi-claude-marketplace-acme-zeta"],
    agentsSourceDir: agentsDirectory,
    commands: ["acme:alpha", "acme:zeta"],
    skills: ["acme-alpha", "acme-zeta"],
  });
});

test("returns empty names and a null source when no components are declared", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-empty-");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: [],
    commands: [],
    skills: [],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: [],
    agentsSourceDir: null,
    commands: [],
    skills: [],
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
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: [],
    agentsSourceDir: agentsDirectory,
    commands: [],
    skills: [],
  });
});

test("keeps first-wins names while deliberately dropping all bridge warnings", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-warnings-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const commandsDirectory = path.join(pluginRoot, "commands");
  const skillsDirectory = path.join(pluginRoot, "skills");
  await writeAgent(agentsDirectory, "a.md", "review");
  await writeAgent(agentsDirectory, "b.md", "review");
  await writeCommand(commandsDirectory, "acme-run.md");
  await writeCommand(commandsDirectory, "run.md");
  await writeSkill(skillsDirectory, "acme-helper");
  await writeSkill(skillsDirectory, "helper");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
  });

  // act
  const discovered = await discoverGeneratedNames("acme", resolved);

  // assert
  assert.deepStrictEqual(discovered, {
    agents: ["pi-claude-marketplace-acme-review"],
    agentsSourceDir: agentsDirectory,
    commands: ["acme:run"],
    skills: ["acme-helper"],
  });
});

test("propagates a hard agent failure after successful skill and command discovery", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "plugin-discover-names-agent-failure-");
  const agentsDirectory = path.join(pluginRoot, "agents");
  const commandsDirectory = path.join(pluginRoot, "commands");
  const skillsDirectory = path.join(pluginRoot, "skills");
  await writeAgent(agentsDirectory, "invalid.md", ".");
  await writeCommand(commandsDirectory, "valid.md");
  await writeSkill(skillsDirectory, "valid");
  const resolved = resolvedPlugin(pluginRoot, {
    agents: ["agents"],
    commands: ["commands"],
    skills: ["skills"],
  });

  // act & assert
  await assert.rejects(() => discoverGeneratedNames("acme", resolved), {
    name: "Error",
    message: `agent name in ${path.join(agentsDirectory, "invalid.md")} must not be "." or "..".`,
  });
});
