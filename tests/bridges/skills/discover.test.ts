import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
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

test("filters hidden, non-regular, nested-only, linked, and undeclared entries", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-filter-");
  const skillsDirectory = path.join(pluginRoot, "skills");
  const hiddenDirectory = path.join(skillsDirectory, ".hidden");
  const missingDocumentDirectory = path.join(skillsDirectory, "missing-document");
  const directoryDocumentDirectory = path.join(skillsDirectory, "directory-document");
  const nestedOnlyDirectory = path.join(skillsDirectory, "nested-only");
  const opaqueDirectory = path.join(skillsDirectory, "opaque");
  const visibleDirectory = path.join(skillsDirectory, "visible");
  const externalDirectory = path.join(pluginRoot, "external-skill");
  const undeclaredDirectory = path.join(pluginRoot, "undeclared", "outside");
  await mkdir(hiddenDirectory, { recursive: true });
  await writeFile(
    path.join(hiddenDirectory, "SKILL.md"),
    "---\nname: hidden\ndescription: Hidden skill.\n---\n\nHidden body.\n",
  );
  await mkdir(missingDocumentDirectory, { recursive: true });
  await writeFile(path.join(missingDocumentDirectory, "README.md"), "No skill document.\n");
  await mkdir(path.join(directoryDocumentDirectory, "SKILL.md"), { recursive: true });
  await mkdir(path.join(nestedOnlyDirectory, "deep"), { recursive: true });
  await writeFile(
    path.join(nestedOnlyDirectory, "deep", "SKILL.md"),
    "---\nname: deep\ndescription: Nested-only skill.\n---\n\nNested body.\n",
  );
  await mkdir(opaqueDirectory, { recursive: true });
  const opaqueDocument = path.join(opaqueDirectory, "SKILL.md");
  await writeFile(
    opaqueDocument,
    "---\nname: opaque\ndescription: Metadata-only discovery.\n---\n\nOpaque body.\n",
  );
  if (process.platform !== "win32") {
    await chmod(opaqueDocument, 0o000);
  }

  await mkdir(visibleDirectory, { recursive: true });
  await writeFile(
    path.join(visibleDirectory, "SKILL.md"),
    "---\nname: visible\ndescription: Visible skill.\n---\n\nVisible body.\n",
  );
  await writeFile(path.join(skillsDirectory, "loose.md"), "Not a skill directory.\n");
  await mkdir(externalDirectory, { recursive: true });
  await writeFile(
    path.join(externalDirectory, "SKILL.md"),
    "---\nname: linked\ndescription: Linked skill.\n---\n\nLinked body.\n",
  );
  await symlink(
    externalDirectory,
    path.join(skillsDirectory, "linked-directory"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await mkdir(undeclaredDirectory, { recursive: true });
  await writeFile(
    path.join(undeclaredDirectory, "SKILL.md"),
    "---\nname: outside\ndescription: Undeclared skill.\n---\n\nOutside body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [skillsDirectory]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      { sourceName: "opaque", generatedName: "acme-opaque", skillDir: opaqueDirectory },
      { sourceName: "visible", generatedName: "acme-visible", skillDir: visibleDirectory },
    ],
    warnings: [],
  });
});

test("keeps the first generated name when sources collide within one parent", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-local-collision-");
  const skillsDirectory = path.join(pluginRoot, "skills");
  const prefixedDirectory = path.join(skillsDirectory, "acme-foo");
  const bareDirectory = path.join(skillsDirectory, "foo");
  await mkdir(prefixedDirectory, { recursive: true });
  await writeFile(
    path.join(prefixedDirectory, "SKILL.md"),
    "---\nname: acme-foo\ndescription: Prefixed skill.\n---\n\nPrefixed body.\n",
  );
  await mkdir(bareDirectory, { recursive: true });
  await writeFile(
    path.join(bareDirectory, "SKILL.md"),
    "---\nname: foo\ndescription: Bare skill.\n---\n\nBare body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [skillsDirectory]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "acme-foo",
        generatedName: "acme-foo",
        skillDir: prefixedDirectory,
      },
    ],
    warnings: [
      `skill source "foo" in "${skillsDirectory}" elides to generated name ` +
        `"acme-foo", already produced by skill source "acme-foo"; ignoring duplicate.`,
    ],
  });
});

test("keeps the first generated name when sources collide across parents", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-parent-collision-");
  const winningParent = path.join(pluginRoot, "winning-parent");
  const losingParent = path.join(pluginRoot, "losing-parent");
  const winningDirectory = path.join(winningParent, "acme-shared");
  const losingDirectory = path.join(losingParent, "shared");
  await mkdir(winningDirectory, { recursive: true });
  await writeFile(
    path.join(winningDirectory, "SKILL.md"),
    "---\nname: acme-shared\ndescription: Winning skill.\n---\n\nWinning body.\n",
  );
  await mkdir(losingDirectory, { recursive: true });
  await writeFile(
    path.join(losingDirectory, "SKILL.md"),
    "---\nname: shared\ndescription: Losing skill.\n---\n\nLosing body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [winningParent, losingParent]);

  // act
  const discovery = await discoverPluginSkills({ pluginName: "acme", resolved });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "acme-shared",
        generatedName: "acme-shared",
        skillDir: winningDirectory,
      },
    ],
    warnings: [
      `skill source "shared" in "${losingParent}" elides to generated name ` +
        `"acme-shared", already produced by skill source "acme-shared"; ignoring duplicate.`,
    ],
  });
});

test("keeps a self skill when a later parent produces the same generated name", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-self-wins-");
  const selfDirectory = path.join(pluginRoot, "implement");
  const parentDirectory = path.join(pluginRoot, "skills");
  const duplicateDirectory = path.join(parentDirectory, "implement");
  await mkdir(selfDirectory, { recursive: true });
  await writeFile(
    path.join(selfDirectory, "SKILL.md"),
    "---\nname: implement\ndescription: Direct skill.\n---\n\nDirect body.\n",
  );
  await mkdir(duplicateDirectory, { recursive: true });
  await writeFile(
    path.join(duplicateDirectory, "SKILL.md"),
    "---\nname: implement\ndescription: Duplicate skill.\n---\n\nDuplicate body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [selfDirectory, parentDirectory]);

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
        skillDir: selfDirectory,
      },
    ],
    warnings: [
      `skill source "implement" in "${parentDirectory}" elides to generated name ` +
        `"mattpocock-skills-implement", already produced by skill source "implement"; ` +
        `ignoring duplicate.`,
    ],
  });
});

test("reports a self skill loss without traversing its nested directories", async (t) => {
  // arrange
  const pluginRoot = await createPluginRoot(t, "skill-discover-self-loses-");
  const parentDirectory = path.join(pluginRoot, "skills");
  const winningDirectory = path.join(parentDirectory, "mattpocock-skills-implement");
  const selfDirectory = path.join(pluginRoot, "implement");
  const nestedDirectory = path.join(selfDirectory, "nested");
  await mkdir(winningDirectory, { recursive: true });
  await writeFile(
    path.join(winningDirectory, "SKILL.md"),
    "---\nname: implement\ndescription: Winning skill.\n---\n\nWinning body.\n",
  );
  await mkdir(nestedDirectory, { recursive: true });
  await writeFile(
    path.join(selfDirectory, "SKILL.md"),
    "---\nname: implement\ndescription: Losing direct skill.\n---\n\nLosing body.\n",
  );
  await writeFile(
    path.join(nestedDirectory, "SKILL.md"),
    "---\nname: nested\ndescription: Nested skill.\n---\n\nNested body.\n",
  );
  const resolved = resolvedPlugin(pluginRoot, [parentDirectory, selfDirectory]);

  // act
  const discovery = await discoverPluginSkills({
    pluginName: "mattpocock-skills",
    resolved,
  });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "mattpocock-skills-implement",
        generatedName: "mattpocock-skills-implement",
        skillDir: winningDirectory,
      },
    ],
    warnings: [
      `skill source "implement" in "${selfDirectory}" elides to generated name ` +
        `"mattpocock-skills-implement", already produced by skill source ` +
        `"mattpocock-skills-implement"; ignoring duplicate.`,
    ],
  });
});
