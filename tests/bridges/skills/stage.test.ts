import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedSkills,
  commitPreparedSkills,
  finalizeSkillsReplacement,
  prepareStageSkills,
  replacePreparedSkills,
  rollbackSkillsReplacement,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { ManualRecoveryError } from "../../../extensions/pi-claude-marketplace/shared/errors.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

const filesystemPromises = createRequire(import.meta.url)(
  "node:fs/promises",
) as typeof import("node:fs/promises");

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
    const expectedResult = {
      stagedNames: ["acme-broken"],
      recorded: [
        {
          generatedName: "acme-broken",
          sourcePath: skillDirectory,
          targetPath: path.join(locations.skillsTargetDir, "acme-broken"),
        },
      ],
      warnings: [],
      degraded: [
        {
          generatedName: "acme-broken",
          parseError:
            "Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:\n\n" +
            "name: [unterminated\ndescription: discarded\n^\n",
        },
      ],
    };

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
    assert.deepStrictEqual(prepared.result, expectedResult);
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
    const expectedPrepareError = {
      name: "YAMLParseError",
      message:
        "Flow sequence in block collection must be sufficiently indented and end with a ] at line 3, column 23:\n\n" +
        "license: [unterminated\n                      ^\n",
      cause: undefined,
    };

    // act
    let prepareError: unknown;
    try {
      await prepareStageSkills({
        locations,
        cwd: scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir: "[unterminated",
        resolved,
      });
    } catch (error) {
      prepareError = error;
    }

    // assert
    assert.ok(prepareError instanceof Error);
    assert.deepStrictEqual(
      {
        name: prepareError.name,
        message: prepareError.message,
        cause: prepareError.cause,
      },
      expectedPrepareError,
    );
    assert.deepStrictEqual(await readdir(locations.skillsStagingDir), []);
  });

  test("propagates a copy error and removes its partial staging tree", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-copy-error-",
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
    const copyError = Object.assign(new Error("skill copy denied"), { code: "EACCES" });
    const copy = t.mock.method(filesystemPromises, "cp", (): Promise<never> =>
      Promise.reject(copyError),
    );
    t.after(() => {
      copy.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    let prepareError: unknown;
    try {
      await prepareStageSkills({
        locations,
        cwd: scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir,
        resolved,
      });
    } catch (error) {
      prepareError = error;
    }

    // assert
    assert.strictEqual(prepareError, copyError);
    assert.deepStrictEqual(await readdir(locations.skillsStagingDir), []);
    assert.strictEqual(
      await stat(path.join(locations.skillsTargetDir, "acme-alpha")).catch(() => undefined),
      undefined,
    );
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

    // act
    let prepareError: unknown;
    try {
      await prepareStageSkills({
        locations,
        cwd: scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir,
        resolved,
      });
    } catch (error) {
      prepareError = error;
    }

    // assert
    assert.ok(prepareError instanceof SymlinkRefusedError);
    assert.strictEqual(prepareError.linkPath, hostileTarget);
    assert.strictEqual(prepareError.linkTarget, outsideDirectory);
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

  test("propagates a previous-directory removal error without renaming staged bytes", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-remove-error-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const previousDirectory = path.join(locations.skillsTargetDir, "previous");
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(previousDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: Alpha\n---\n",
    );
    await writeFile(path.join(previousDirectory, "SKILL.md"), "previous bytes\n");
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
    const originalRm = filesystemPromises.rm.bind(filesystemPromises);
    const removalError = Object.assign(new Error("previous removal denied"), { code: "EACCES" });
    const removal = t.mock.method(
      filesystemPromises,
      "rm",
      async (
        target: Parameters<typeof originalRm>[0],
        options?: Parameters<typeof originalRm>[1],
      ) => {
        if (String(target) === previousDirectory) {
          throw removalError;
        }

        await originalRm(target, options);
      },
    );
    t.after(() => {
      removal.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    let commitError: unknown;
    try {
      await commitPreparedSkills(prepared);
    } catch (error) {
      commitError = error;
    }

    // assert
    assert.strictEqual(commitError, removalError);
    assert.strictEqual(
      await readFile(path.join(previousDirectory, "SKILL.md"), "utf8"),
      "previous bytes\n",
    );
    assert.strictEqual((await stat(prepared.stagingRoot)).isDirectory(), true);
  });

  test("propagates a target inspection error before the rename", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-stat-error-",
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
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    const originalStat = filesystemPromises.stat.bind(filesystemPromises);
    const inspectionError = Object.assign(new Error("target inspection denied"), {
      code: "EACCES",
    });
    const inspection = t.mock.method(
      filesystemPromises,
      "stat",
      async (
        target: Parameters<typeof originalStat>[0],
        options?: Parameters<typeof originalStat>[1],
      ) => {
        if (String(target) === targetDirectory) {
          throw inspectionError;
        }

        return originalStat(target, options);
      },
    );
    t.after(() => {
      inspection.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    let commitError: unknown;
    try {
      await commitPreparedSkills(prepared);
    } catch (error) {
      commitError = error;
    }

    // assert
    assert.strictEqual(commitError, inspectionError);
    assert.strictEqual((await stat(prepared.stagingRoot)).isDirectory(), true);
    assert.strictEqual(await stat(targetDirectory).catch(() => undefined), undefined);
  });

  test("propagates a rename error and leaves the staged tree intact", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-rename-error-",
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
    const renameError = Object.assign(new Error("target rename denied"), { code: "EACCES" });
    const rename = t.mock.method(filesystemPromises, "rename", (): Promise<never> =>
      Promise.reject(renameError),
    );
    t.after(() => {
      rename.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    let commitError: unknown;
    try {
      await commitPreparedSkills(prepared);
    } catch (error) {
      commitError = error;
    }

    // assert
    assert.strictEqual(commitError, renameError);
    assert.strictEqual(
      await readFile(path.join(prepared.stagingRoot, "acme-alpha", "SKILL.md"), "utf8"),
      "---\nname: acme-alpha\ndescription: Alpha\n---\n",
    );
  });

  test("returns the complete cleanup leak after a successful rename", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-cleanup-leak-",
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
    const originalRm = filesystemPromises.rm.bind(filesystemPromises);
    const cleanupError = Object.assign(new Error("staging cleanup denied"), { code: "EACCES" });
    const removal = t.mock.method(
      filesystemPromises,
      "rm",
      async (
        target: Parameters<typeof originalRm>[0],
        options?: Parameters<typeof originalRm>[1],
      ) => {
        if (String(target) === prepared.stagingRoot) {
          throw cleanupError;
        }

        await originalRm(target, options);
      },
    );
    t.after(() => {
      removal.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedLeak =
      "failed to clean up skills staging directory at " +
      prepared.stagingRoot +
      ": staging cleanup denied";

    // act
    const leak = await commitPreparedSkills(prepared);
    const targetBytes = await readFile(
      path.join(locations.skillsTargetDir, "acme-alpha", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.strictEqual(leak, expectedLeak);
    assert.strictEqual(targetBytes, "---\nname: acme-alpha\ndescription: Alpha\n---\n");
    assert.strictEqual((await stat(prepared.stagingRoot)).isDirectory(), true);
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

describe("replacePreparedSkills", () => {
  test("returns the complete no-op replacement handle", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-replace-noop-",
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
    const replacement = await replacePreparedSkills(prepared);

    // assert
    assert.deepStrictEqual(replacement, { kind: "noop", prepared });
    assert.strictEqual(await stat(locations.skillsTargetDir).catch(() => undefined), undefined);
    assert.strictEqual(await stat(locations.skillsStagingDir).catch(() => undefined), undefined);
  });

  test("backs up an owned tree, skips a missing previous tree, and installs exact new bytes", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-replace-owned-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    await mkdir(path.join(skillDirectory, "resources"), { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\nNew body.\n",
    );
    await writeFile(path.join(skillDirectory, "resources", "new.txt"), "new resource\n");
    await writeFile(path.join(targetDirectory, "SKILL.md"), "old skill bytes\n");
    await writeFile(path.join(targetDirectory, "old.txt"), "old resource\n");
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
      previousSkillNames: ["acme-alpha", "missing"],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const replacement = await replacePreparedSkills(prepared);
    assert.strictEqual(replacement.kind, "replaced");
    t.after(() => finalizeSkillsReplacement(replacement));
    const targetBytes = await readFile(path.join(targetDirectory, "SKILL.md"), "utf8");
    const resourceBytes = await readFile(
      path.join(targetDirectory, "resources", "new.txt"),
      "utf8",
    );
    const oldResource = await stat(path.join(targetDirectory, "old.txt")).catch(() => undefined);
    const stagingEntries = await readdir(locations.skillsStagingDir);

    // assert
    assert.deepStrictEqual(replacement, { kind: "replaced", prepared });
    assert.strictEqual(
      targetBytes,
      "---\nname: acme-alpha\ndescription: New alpha\n---\nNew body.\n",
    );
    assert.strictEqual(resourceBytes, "new resource\n");
    assert.strictEqual(oldResource, undefined);
    assert.strictEqual(stagingEntries.length, 2);
    assert.strictEqual(stagingEntries.includes(path.basename(prepared.stagingRoot)), true);
    assert.strictEqual(
      stagingEntries.some((name) => name.startsWith("backup-")),
      true,
    );
  });

  test("removes an owned orphan that appears after the previous tree is backed up", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-replace-owned-orphan-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\nNew body.\n",
    );
    await writeFile(path.join(targetDirectory, "SKILL.md"), "old skill bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const originalRename = filesystemPromises.rename.bind(filesystemPromises);
    const move = t.mock.method(
      filesystemPromises,
      "rename",
      async (
        from: Parameters<typeof originalRename>[0],
        to: Parameters<typeof originalRename>[1],
      ) => {
        await originalRename(from, to);
        if (String(from) === targetDirectory) {
          await mkdir(targetDirectory, { recursive: true });
          await writeFile(path.join(targetDirectory, "leftover.txt"), "owned orphan\n");
        }
      },
    );
    t.after(() => {
      move.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    const replacement = await replacePreparedSkills(prepared);
    const targetBytes = await readFile(path.join(targetDirectory, "SKILL.md"), "utf8");
    const orphanState = await stat(path.join(targetDirectory, "leftover.txt")).catch(
      () => undefined,
    );
    const leaks = await finalizeSkillsReplacement(replacement);

    // assert
    assert.strictEqual(
      targetBytes,
      "---\nname: acme-alpha\ndescription: New alpha\n---\nNew body.\n",
    );
    assert.strictEqual(orphanState, undefined);
    assert.deepStrictEqual(leaks, []);
  });

  test("restores owned bytes and preserves foreign content when a new target is occupied", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-replace-foreign-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    const betaDirectory = path.join(skillsDirectory, "beta");
    const alphaTarget = path.join(locations.skillsTargetDir, "acme-alpha");
    const betaTarget = path.join(locations.skillsTargetDir, "acme-beta");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(betaDirectory, { recursive: true });
    await mkdir(alphaTarget, { recursive: true });
    await mkdir(betaTarget, { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\n",
    );
    await writeFile(
      path.join(betaDirectory, "SKILL.md"),
      "---\nname: beta\ndescription: New beta\n---\n",
    );
    await writeFile(path.join(alphaTarget, "SKILL.md"), "owned alpha bytes\n");
    await writeFile(path.join(betaTarget, "SKILL.md"), "foreign beta bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const expectedMessage =
      "Cannot replace skill target with non-previous content at " + betaTarget;

    // act
    let replacementError: unknown;
    try {
      await replacePreparedSkills(prepared);
    } catch (error) {
      replacementError = error;
    }

    const alphaBytes = await readFile(path.join(alphaTarget, "SKILL.md"), "utf8");
    const betaBytes = await readFile(path.join(betaTarget, "SKILL.md"), "utf8");
    const stagingEntries = await readdir(locations.skillsStagingDir);

    // assert
    assert.ok(replacementError instanceof Error);
    assert.deepStrictEqual(
      { name: replacementError.name, message: replacementError.message },
      { name: "Error", message: expectedMessage },
    );
    assert.strictEqual(alphaBytes, "owned alpha bytes\n");
    assert.strictEqual(betaBytes, "foreign beta bytes\n");
    assert.deepStrictEqual(stagingEntries, []);
  });

  test("returns manual-recovery leaks when automatic restoration also fails", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-replace-manual-recovery-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    const betaDirectory = path.join(skillsDirectory, "beta");
    const alphaTarget = path.join(locations.skillsTargetDir, "acme-alpha");
    const betaTarget = path.join(locations.skillsTargetDir, "acme-beta");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(betaDirectory, { recursive: true });
    await mkdir(alphaTarget, { recursive: true });
    await mkdir(betaTarget, { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\n",
    );
    await writeFile(
      path.join(betaDirectory, "SKILL.md"),
      "---\nname: beta\ndescription: New beta\n---\n",
    );
    await writeFile(path.join(alphaTarget, "SKILL.md"), "old alpha bytes\n");
    await writeFile(path.join(betaTarget, "SKILL.md"), "foreign beta bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const originalRm = filesystemPromises.rm.bind(filesystemPromises);
    const originalRename = filesystemPromises.rename.bind(filesystemPromises);
    const removalError = Object.assign(new Error("replacement removal denied"), { code: "EACCES" });
    const restoreError = Object.assign(new Error("previous restoration denied"), {
      code: "EACCES",
    });
    let backupPath = "";
    const removal = t.mock.method(
      filesystemPromises,
      "rm",
      async (
        target: Parameters<typeof originalRm>[0],
        options?: Parameters<typeof originalRm>[1],
      ) => {
        if (String(target) === alphaTarget) {
          throw removalError;
        }

        await originalRm(target, options);
      },
    );
    const rename = t.mock.method(
      filesystemPromises,
      "rename",
      async (
        from: Parameters<typeof originalRename>[0],
        to: Parameters<typeof originalRename>[1],
      ) => {
        if (String(from) === alphaTarget) {
          backupPath = String(to);
          await originalRename(from, to);
          return;
        }

        if (String(from) === backupPath && String(to) === alphaTarget) {
          throw restoreError;
        }

        await originalRename(from, to);
      },
    );
    t.after(() => {
      removal.mock.restore();
      rename.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();

    // act
    let replacementError: unknown;
    try {
      await replacePreparedSkills(prepared);
    } catch (error) {
      replacementError = error;
    }

    // assert
    assert.ok(replacementError instanceof ManualRecoveryError);
    assert.strictEqual(
      replacementError.message,
      "Cannot replace skill target with non-previous content at " + betaTarget,
    );
    assert.deepStrictEqual(replacementError.leaks, [
      "failed to remove replacement skill dir at " + alphaTarget + ": replacement removal denied",
      "failed to restore previous skill dir acme-alpha from " +
        backupPath +
        " to " +
        alphaTarget +
        ": previous restoration denied",
    ]);
  });
});

describe("rollbackSkillsReplacement", () => {
  test("accepts a no-op handle without leaks", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-rollback-noop-",
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
    const replacement = await replacePreparedSkills(prepared);

    // act
    const leaks = await rollbackSkillsReplacement(replacement);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
  });

  test("removes new trees and restores every previous byte", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-rollback-restore-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    const betaDirectory = path.join(skillsDirectory, "beta");
    const alphaTarget = path.join(locations.skillsTargetDir, "acme-alpha");
    const betaTarget = path.join(locations.skillsTargetDir, "acme-beta");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(betaDirectory, { recursive: true });
    await mkdir(path.join(alphaTarget, "nested"), { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\n",
    );
    await writeFile(
      path.join(betaDirectory, "SKILL.md"),
      "---\nname: beta\ndescription: New beta\n---\n",
    );
    await writeFile(path.join(alphaTarget, "SKILL.md"), "old alpha bytes\n");
    await writeFile(path.join(alphaTarget, "nested", "old.txt"), "old nested bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const replacement = await replacePreparedSkills(prepared);
    assert.strictEqual(replacement.kind, "replaced");

    // act
    const leaks = await rollbackSkillsReplacement(replacement);
    const alphaBytes = await readFile(path.join(alphaTarget, "SKILL.md"), "utf8");
    const nestedBytes = await readFile(path.join(alphaTarget, "nested", "old.txt"), "utf8");
    const betaState = await stat(betaTarget).catch(() => undefined);
    const stagingEntries = await readdir(locations.skillsStagingDir);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(alphaBytes, "old alpha bytes\n");
    assert.strictEqual(nestedBytes, "old nested bytes\n");
    assert.strictEqual(betaState, undefined);
    assert.deepStrictEqual(stagingEntries, []);
  });

  test("rejects a cloned replacement handle without internal identity", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-rollback-cloned-",
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
    const replacement = await replacePreparedSkills(prepared);
    assert.strictEqual(replacement.kind, "replaced");
    t.after(() => finalizeSkillsReplacement(replacement));
    const clonedReplacement = { ...replacement };

    // act & assert
    await assert.rejects(
      () => rollbackSkillsReplacement(clonedReplacement),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.deepStrictEqual(
          { name: error.name, message: error.message },
          { name: "Error", message: "Unknown skills replacement handle." },
        );
        return true;
      },
    );
  });
});

describe("finalizeSkillsReplacement", () => {
  test("accepts a no-op handle without leaks", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-finalize-noop-",
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
    const replacement = await replacePreparedSkills(prepared);

    // act
    const leaks = await finalizeSkillsReplacement(replacement);

    // assert
    assert.deepStrictEqual(leaks, []);
    assert.strictEqual(Object.isFrozen(leaks), true);
  });

  test("removes backup state, keeps new bytes, and is idempotent", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-finalize-replaced-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\n",
    );
    await writeFile(path.join(targetDirectory, "SKILL.md"), "old alpha bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const replacement = await replacePreparedSkills(prepared);
    assert.strictEqual(replacement.kind, "replaced");

    // act
    const firstLeaks = await finalizeSkillsReplacement(replacement);
    const secondLeaks = await finalizeSkillsReplacement(replacement);
    const targetBytes = await readFile(path.join(targetDirectory, "SKILL.md"), "utf8");
    const stagingEntries = await readdir(locations.skillsStagingDir);

    // assert
    assert.deepStrictEqual(firstLeaks, []);
    assert.deepStrictEqual(secondLeaks, []);
    assert.strictEqual(targetBytes, "---\nname: acme-alpha\ndescription: New alpha\n---\n");
    assert.deepStrictEqual(stagingEntries, []);
  });

  test("returns both cleanup leaks and keeps the installed tree", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-finalize-leaks-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "alpha");
    const targetDirectory = path.join(locations.skillsTargetDir, "acme-alpha");
    await mkdir(skillDirectory, { recursive: true });
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: New alpha\n---\n",
    );
    await writeFile(path.join(targetDirectory, "SKILL.md"), "old alpha bytes\n");
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
      previousSkillNames: ["acme-alpha"],
    });
    assert.strictEqual(prepared.kind, "staged");
    const replacement = await replacePreparedSkills(prepared);
    assert.strictEqual(replacement.kind, "replaced");
    const backupDirectory = (await readdir(locations.skillsStagingDir)).find((name) =>
      name.startsWith("backup-"),
    );
    assert.notStrictEqual(backupDirectory, undefined);
    const backupRoot = path.join(locations.skillsStagingDir, backupDirectory ?? "missing");
    const originalRm = filesystemPromises.rm.bind(filesystemPromises);
    const backupError = Object.assign(new Error("backup cleanup denied"), { code: "EACCES" });
    const stagingError = Object.assign(new Error("staging cleanup denied"), { code: "EACCES" });
    const removal = t.mock.method(
      filesystemPromises,
      "rm",
      async (
        target: Parameters<typeof originalRm>[0],
        options?: Parameters<typeof originalRm>[1],
      ) => {
        if (String(target) === backupRoot) {
          throw backupError;
        }

        if (String(target) === prepared.stagingRoot) {
          throw stagingError;
        }

        await originalRm(target, options);
      },
    );
    t.after(() => {
      removal.mock.restore();
      syncBuiltinESMExports();
    });
    syncBuiltinESMExports();
    const expectedLeaks = [
      "failed to clean up skills replacement backup directory at " +
        backupRoot +
        ": backup cleanup denied",
      "failed to clean up skills staging directory at " +
        prepared.stagingRoot +
        ": staging cleanup denied",
    ];

    // act
    const leaks = await finalizeSkillsReplacement(replacement);
    const targetBytes = await readFile(path.join(targetDirectory, "SKILL.md"), "utf8");

    // assert
    assert.deepStrictEqual(leaks, expectedLeaks);
    assert.strictEqual(targetBytes, "---\nname: acme-alpha\ndescription: New alpha\n---\n");
    assert.strictEqual(Object.isFrozen(leaks), true);
  });
});
