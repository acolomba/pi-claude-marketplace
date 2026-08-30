import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { discoverPluginSkills } from "../../../extensions/pi-claude-marketplace/bridges/skills/discover.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

async function createPluginRoot(t: TestContext, prefix: string): Promise<string> {
  const pluginRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));
  return pluginRoot;
}

function resolvedPlugin(pluginRoot: string, skills: readonly string[]): ResolvedPluginInstallable {
  return {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: ["skills"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [...skills], commands: [], agents: [] },
    mcpServers: {},
    defaultEnabled: true,
  };
}

test("returns no skills when the plugin declares no skill paths", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-empty-");
  const resolved = resolvedPlugin(pluginRoot, []);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});

test("returns no skills when a relative skill parent is absent", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-missing-");
  const resolved = resolvedPlugin(pluginRoot, [path.join("catalog", "skills")]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, { discovered: [], warnings: [] });
});

test("discovers a relative skill parent in stable source-name order", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-relative-");
  const skillsRelative = path.join("catalog", "skills");
  const skillsDirectory = path.join(pluginRoot, skillsRelative);
  const knowledgeDirectory = path.join(skillsDirectory, "acme-knowledge");
  const helperDirectory = path.join(skillsDirectory, "helper");
  await mkdir(path.join(knowledgeDirectory, "resources"), { recursive: true });
  await writeFile(
    path.join(knowledgeDirectory, "SKILL.md"),
    "---\nname: acme-knowledge\ndescription: Consult the knowledge base.\n---\n\nUse the bundled lookup.\n",
  );
  await writeFile(
    path.join(knowledgeDirectory, "resources", "lookup.json"),
    '{"answer":"local"}\n',
  );
  await mkdir(helperDirectory, { recursive: true });
  await writeFile(
    path.join(helperDirectory, "SKILL.md"),
    "---\nname: helper\ndescription: Run the helper.\n---\n\nUse the helper procedure.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [skillsRelative]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "acme-knowledge",
        generatedName: "acme-knowledge",
        skillDir: knowledgeDirectory,
      },
      {
        sourceName: "helper",
        generatedName: "acme-helper",
        skillDir: helperDirectory,
      },
    ],
    warnings: [],
  });
});

test("preserves declared parent order while sorting each absolute parent", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-absolute-");
  const firstParent = path.join(pluginRoot, "first-declared");
  const secondParent = path.join(pluginRoot, "second-declared");
  const betaDirectory = path.join(firstParent, "beta");
  const zetaDirectory = path.join(firstParent, "zeta");
  const alphaDirectory = path.join(secondParent, "alpha");
  await mkdir(betaDirectory, { recursive: true });
  await writeFile(
    path.join(betaDirectory, "SKILL.md"),
    "---\nname: beta\ndescription: Beta skill.\n---\n\nBeta body.\n",
  );
  await mkdir(zetaDirectory, { recursive: true });
  await writeFile(
    path.join(zetaDirectory, "SKILL.md"),
    "---\nname: zeta\ndescription: Zeta skill.\n---\n\nZeta body.\n",
  );
  await mkdir(alphaDirectory, { recursive: true });
  await writeFile(
    path.join(alphaDirectory, "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha skill.\n---\n\nAlpha body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [firstParent, secondParent]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { sourceName: "beta", generatedName: "acme-beta", skillDir: betaDirectory },
      { sourceName: "zeta", generatedName: "acme-zeta", skillDir: zetaDirectory },
      { sourceName: "alpha", generatedName: "acme-alpha", skillDir: alphaDirectory },
    ],
    warnings: [],
  });
});

test("discovers a declared relative path that is itself a skill directory", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-self-");
  const skillRelative = path.join("catalog", "implement");
  const skillDirectory = path.join(pluginRoot, skillRelative);
  const nestedDirectory = path.join(skillDirectory, "nested");
  await mkdir(nestedDirectory, { recursive: true });
  await writeFile(
    path.join(skillDirectory, "SKILL.md"),
    "---\nname: implement\ndescription: Implement a task.\n---\n\nFollow the task contract.\n",
  );
  await writeFile(
    path.join(nestedDirectory, "SKILL.md"),
    "---\nname: nested\ndescription: Nested skill.\n---\n\nThis directory is not a second root.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [skillRelative]);

  // act
  const discovery = await discoverPluginSkills({
    pluginName: "mattpocock-skills",
    resolved,
  });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "implement",
        generatedName: "mattpocock-skills-implement",
        skillDir: skillDirectory,
      },
    ],
    warnings: [],
  });
});
