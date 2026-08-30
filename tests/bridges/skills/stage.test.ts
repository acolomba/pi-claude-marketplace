import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedSkills,
  commitPreparedSkills,
  prepareStageSkills,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

async function allocateCasePaths(
  t: TestContext,
  prefix: string,
): Promise<{
  scopeRoot: string;
  pluginRoot: string;
  pluginDataDir: string;
  locations: ReturnType<typeof locationsFor>;
}> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);

  return {
    scopeRoot,
    pluginRoot: path.join(scopeRoot, "plugin"),
    pluginDataDir: path.join(scopeRoot, "plugin-data"),
    locations,
  };
}

describe("prepareStageSkills", () => {
  test("returns a complete no-op without materializing bridge directories", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-noop-",
    );
    await mkdir(pluginRoot, { recursive: true });
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    const stagingDirectory = await stat(locations.skillsStagingDir).catch(() => undefined);
    const targetDirectory = await stat(locations.skillsTargetDir).catch(() => undefined);

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: { stagedNames: [], recorded: [], warnings: [], degraded: [] },
    });
    assert.strictEqual(stagingDirectory, undefined);
    assert.strictEqual(targetDirectory, undefined);
  });

  test("copies recursive skill trees and authors complete staged bytes", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-recursive-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    const betaDirectory = path.join(skillsDirectory, "beta");
    await mkdir(path.join(alphaDirectory, "resources"), { recursive: true });
    await mkdir(betaDirectory, { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha skill\nlicense: MIT\n---\n\n" +
        "Root: ${CLAUDE_PLUGIN_ROOT}\nData: ${CLAUDE_PLUGIN_DATA}\n" +
        "Skill: ${CLAUDE_SKILL_DIR}\nProject: ${CLAUDE_PROJECT_DIR}\n",
    );
    await writeFile(
      path.join(betaDirectory, "SKILL.md"),
      "---\nname: beta\ndescription: Beta skill\n---\n\nUnchanged beta body.\n",
    );
    await writeFile(path.join(alphaDirectory, "resources", "lookup.json"), '{"keys":["a","b"]}\n');
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const alphaTarget = path.join(locations.skillsTargetDir, "acme-alpha");
    const betaTarget = path.join(locations.skillsTargetDir, "acme-beta");
    const expectedAlphaBytes =
      "---\nname: acme-alpha\ndescription: Alpha skill\nlicense: MIT\n---\n\nRoot: " +
      pluginRoot +
      "\nData: " +
      pluginDataDir +
      "\nSkill: " +
      alphaTarget +
      "\nProject: " +
      scopeRoot +
      "\n";

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const alphaBytes = await readFile(path.join(prepared.stagingRoot, "acme-alpha", "SKILL.md"));
    const betaBytes = await readFile(path.join(prepared.stagingRoot, "acme-beta", "SKILL.md"));
    const resourceBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-alpha", "resources", "lookup.json"),
    );
    const stagedTree = await readdir(prepared.stagingRoot);

    // assert
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["acme-alpha", "acme-beta"],
      recorded: [
        { generatedName: "acme-alpha", sourcePath: alphaDirectory, targetPath: alphaTarget },
        { generatedName: "acme-beta", sourcePath: betaDirectory, targetPath: betaTarget },
      ],
      warnings: [],
      degraded: [],
    });
    assert.deepStrictEqual(prepared._previousNames, []);
    assert.deepStrictEqual(stagedTree, ["acme-alpha", "acme-beta"]);
    assert.deepStrictEqual(alphaBytes, Buffer.from(expectedAlphaBytes));
    assert.deepStrictEqual(
      betaBytes,
      Buffer.from("---\nname: acme-beta\ndescription: Beta skill\n---\n\nUnchanged beta body.\n"),
    );
    assert.deepStrictEqual(resourceBytes, Buffer.from('{"keys":["a","b"]}\n'));
  });

  test("keeps the first generated name and returns the complete collision warning", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-collision-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const winningDirectory = path.join(skillsDirectory, "acme-tool");
    const losingDirectory = path.join(skillsDirectory, "tool");
    await mkdir(winningDirectory, { recursive: true });
    await mkdir(losingDirectory, { recursive: true });
    await writeFile(
      path.join(winningDirectory, "SKILL.md"),
      "---\nname: acme-tool\ndescription: Winning skill\n---\n",
    );
    await writeFile(
      path.join(losingDirectory, "SKILL.md"),
      "---\nname: tool\ndescription: Losing skill\n---\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedWarning =
      'skill source "tool" in "' +
      skillsDirectory +
      '" elides to generated name "acme-tool", already produced by skill source ' +
      '"acme-tool"; ignoring duplicate.';

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["acme-tool"],
      recorded: [
        {
          generatedName: "acme-tool",
          sourcePath: winningDirectory,
          targetPath: path.join(locations.skillsTargetDir, "acme-tool"),
        },
      ],
      warnings: [expectedWarning],
      degraded: [],
    });
    assert.strictEqual(
      await readFile(path.join(prepared.stagingRoot, "acme-tool", "SKILL.md"), "utf8"),
      "---\nname: acme-tool\ndescription: Winning skill\n---\n",
    );
  });

  test("degrades malformed frontmatter and preserves the normalized body bytes", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-malformed-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "broken");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\rname: [unterminated\rdescription: discarded\r---\r\r" +
        "# Broken\r\rBody bytes survive.\r",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedBytes =
      "---\nname: acme-broken\n" +
      "description: Source frontmatter could not be parsed.\n" +
      "disable-model-invocation: true\n---\n\n# Broken\n\nBody bytes survive.";

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const stagedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-broken", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.deepStrictEqual(prepared.result.stagedNames, ["acme-broken"]);
    assert.deepStrictEqual(prepared.result.recorded, [
      {
        generatedName: "acme-broken",
        sourcePath: skillDirectory,
        targetPath: path.join(locations.skillsTargetDir, "acme-broken"),
      },
    ]);
    assert.deepStrictEqual(prepared.result.warnings, []);
    assert.strictEqual(prepared.result.degraded.length, 1);
    assert.strictEqual(prepared.result.degraded[0]?.generatedName, "acme-broken");
    assert.match(prepared.result.degraded[0]?.parseError ?? "", /unterminated|flow sequence/i);
    assert.strictEqual(stagedBytes, expectedBytes);
  });

  test("fills and caps descriptions without changing sibling frontmatter", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-description-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const emptyDirectory = path.join(skillsDirectory, "empty");
    const proseDirectory = path.join(skillsDirectory, "prose");
    const foldedDirectory = path.join(skillsDirectory, "folded");
    await mkdir(emptyDirectory, { recursive: true });
    await mkdir(proseDirectory, { recursive: true });
    await mkdir(foldedDirectory, { recursive: true });
    await writeFile(path.join(emptyDirectory, "SKILL.md"), "---\nname: empty\nversion: 1\n---\n");
    await writeFile(
      path.join(proseDirectory, "SKILL.md"),
      "---\nname: prose\nversion: 2\n---\n\n# Heading\n\n" +
        "First prose line.\nSecond prose line.\n\nLater.\n",
    );
    const description = "a".repeat(1000);
    const whenToUse = "b".repeat(536);
    await writeFile(
      path.join(foldedDirectory, "SKILL.md"),
      "---\nname: folded\ndescription: >-\n  " +
        description +
        "\nversion: 3\nwhen_to_use: " +
        whenToUse +
        "\n---\n\nBody.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedEmpty =
      '---\nname: acme-empty\nversion: 1\ndescription: "No description provided."\n---\n';
    const expectedProse =
      '---\nname: acme-prose\nversion: 2\ndescription: "First prose line. Second prose line."\n' +
      "---\n\n# Heading\n\nFirst prose line.\nSecond prose line.\n\nLater.\n";
    const expectedFoldedDescription = description + " " + "b".repeat(535);
    const expectedFolded =
      "---\nname: acme-folded\n" +
      'description: "' +
      expectedFoldedDescription +
      '"\nversion: 3\nwhen_to_use: ' +
      whenToUse +
      "\n---\n\nBody.\n";

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const emptyBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-empty", "SKILL.md"),
      "utf8",
    );
    const proseBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-prose", "SKILL.md"),
      "utf8",
    );
    const foldedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-folded", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.strictEqual(emptyBytes, expectedEmpty);
    assert.strictEqual(proseBytes, expectedProse);
    assert.strictEqual(foldedBytes, expectedFolded);
    assert.deepStrictEqual(prepared.result.degraded, []);
  });

  test("escapes substituted backslashes in an authored description", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-backslashes-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "windows");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: windows\n---\nUses ${CLAUDE_PLUGIN_ROOT}.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const windowsRoot = "C:\\Users\\case\\plugin";
    const expectedBytes =
      '---\nname: acme-windows\ndescription: "Uses C:\\\\Users\\\\case\\\\plugin."\n' +
      "---\nUses C:\\Users\\case\\plugin.\n";

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot: windowsRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const stagedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-windows", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.strictEqual(stagedBytes, expectedBytes);
    assert.deepStrictEqual(prepared.result.degraded, []);
  });

  test("keeps the project token literal for a user-scope install", async (t) => {
    // arrange
    const scopeRoot = await mkdtemp(path.join(tmpdir(), "skills-stage-user-"));
    t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
    const priorAgentDirectory = process.env.PI_CODING_AGENT_DIR;
    t.after(() => {
      if (priorAgentDirectory === undefined) {
        delete process.env.PI_CODING_AGENT_DIR;
      } else {
        process.env.PI_CODING_AGENT_DIR = priorAgentDirectory;
      }
    });
    process.env.PI_CODING_AGENT_DIR = scopeRoot;
    const locations = locationsFor("user", scopeRoot);
    const pluginRoot = path.join(scopeRoot, "plugin");
    const pluginDataDir = path.join(scopeRoot, "plugin-data");
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "vars");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: vars\ndescription: Variables\n---\n" +
        "Root: ${CLAUDE_PLUGIN_ROOT}\nData: ${CLAUDE_PLUGIN_DATA}\n" +
        "Skill: ${CLAUDE_SKILL_DIR}\nProject: ${CLAUDE_PROJECT_DIR}\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-vars");
    const expectedBytes =
      "---\nname: acme-vars\ndescription: Variables\n---\nRoot: " +
      pluginRoot +
      "\nData: " +
      pluginDataDir +
      "\nSkill: " +
      targetDirectory +
      "\nProject: ${CLAUDE_PROJECT_DIR}\n";

    // act
    const prepared = await prepareStageSkills({
      locations,
      cwd: path.join(scopeRoot, "ignored-project"),
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const stagedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-vars", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.strictEqual(stagedBytes, expectedBytes);
  });

  test("cleans the partial staging tree when substituted frontmatter is invalid", async (t) => {
    // arrange
    const { locations, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-invalid-output-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "invalid");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: invalid\ndescription: static\nlicense: ${CLAUDE_PLUGIN_DATA}\n---\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act & assert
    await assert.rejects(
      () =>
        prepareStageSkills({
          locations,
          cwd: scopeRoot,
          marketplaceName: "catalog",
          pluginName: "acme",
          pluginRoot,
          pluginDataDir: "[unterminated",
          resolved,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /unterminated|flow sequence/i);
        return true;
      },
    );
    assert.deepStrictEqual(await readdir(locations.skillsStagingDir), []);
  });

  test("rejects a symlinked target boundary and removes staged bytes", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-symlink-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "safe");
    const outsideDirectory = path.join(scopeRoot, "outside");
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(locations.skillsTargetDir, { recursive: true });
    await mkdir(outsideDirectory, { recursive: true });
    const hostileTarget = path.join(locations.skillsTargetDir, "acme-safe");
    await symlink(outsideDirectory, hostileTarget, "dir");
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: safe\ndescription: Safe skill\n---\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act & assert
    await assert.rejects(
      () =>
        prepareStageSkills({
          locations,
          cwd: scopeRoot,
          marketplaceName: "catalog",
          pluginName: "acme",
          pluginRoot,
          pluginDataDir,
          resolved,
        }),
      (error: unknown) => {
        assert.ok(error instanceof SymlinkRefusedError);
        assert.strictEqual(error.linkPath, hostileTarget);
        assert.strictEqual(error.linkTarget, outsideDirectory);
        return true;
      },
    );
    assert.deepStrictEqual(await readdir(locations.skillsStagingDir), []);
    assert.deepStrictEqual(await readdir(outsideDirectory), []);
  });
});

describe("commitPreparedSkills", () => {
  test("accepts a no-op handle without materializing a target", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-noop-",
    );
    await mkdir(pluginRoot, { recursive: true });
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });

    // act
    const leak = await commitPreparedSkills(prepared);
    const targetDirectory = await stat(locations.skillsTargetDir).catch(() => undefined);

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(targetDirectory, undefined);
  });

  test("replaces previous and stale directories with complete staged trees", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-replace-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const previousDirectory = path.join(locations.skillsTargetDir, "previous");
    const staleDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    await mkdir(path.join(skillDirectory, "resources"), { recursive: true });
    await mkdir(previousDirectory, { recursive: true });
    await mkdir(staleDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha\n---\nBody.\n",
    );
    await writeFile(path.join(skillDirectory, "resources", "a.txt"), "new resource\n");
    await writeFile(path.join(previousDirectory, "SKILL.md"), "previous bytes\n");
    await writeFile(path.join(staleDirectory, "leftover.txt"), "stale bytes\n");
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
      previousSkillNames: ["previous"],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const leak = await commitPreparedSkills(prepared);
    const targetBytes = await readFile(
      path.join(locations.skillsTargetDir, "acme-alpha", "SKILL.md"),
      "utf8",
    );
    const resourceBytes = await readFile(
      path.join(locations.skillsTargetDir, "acme-alpha", "resources", "a.txt"),
      "utf8",
    );
    const previousState = await stat(previousDirectory).catch(() => undefined);
    const staleState = await stat(
      path.join(locations.skillsTargetDir, "acme-alpha", "leftover.txt"),
    ).catch(() => undefined);
    const stagingState = await stat(prepared.stagingRoot).catch(() => undefined);

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(targetBytes, "---\nname: acme-alpha\ndescription: Alpha\n---\nBody.\n");
    assert.strictEqual(resourceBytes, "new resource\n");
    assert.strictEqual(previousState, undefined);
    assert.strictEqual(staleState, undefined);
    assert.strictEqual(stagingState, undefined);
  });
});

describe("abortPreparedSkills", () => {
  test("accepts a no-op handle without materializing a directory", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-abort-noop-",
    );
    await mkdir(pluginRoot, { recursive: true });
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: [],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });

    // act
    const leak = await abortPreparedSkills(prepared);

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(await stat(locations.skillsStagingDir).catch(() => undefined), undefined);
  });

  test("removes an uncommitted staged tree and is idempotent", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-abort-staged-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha\n---\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills({
      locations,
      cwd: scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const firstLeak = await abortPreparedSkills(prepared);
    const secondLeak = await abortPreparedSkills(prepared);
    const stagingState = await stat(prepared.stagingRoot).catch(() => undefined);
    const targetState = await stat(locations.skillsTargetDir).catch(() => undefined);

    // assert
    assert.strictEqual(firstLeak, undefined);
    assert.strictEqual(secondLeak, undefined);
    assert.strictEqual(stagingState, undefined);
    assert.strictEqual(targetState, undefined);
  });
});
