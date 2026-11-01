import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedSkills,
  commitPreparedSkills,
  prepareStageSkills,
} from "../../../extensions/pi-claude-marketplace/bridges/skills/stage.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { SymlinkRefusedError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";
import { createRemovalOpsFake } from "../../platform/removal-ops-fake.ts";

import type { ResolvedPluginInstallable } from "../../../extensions/pi-claude-marketplace/domain/resolver-types.ts";

// Builtin-module patching that remains in this file, and why. The removal port
// carries cleanupStaging's removals only. Every fault that reaches that helper
// is injected through the collaborator; four faults land on calls the port
// does not carry:
//
//   - `cp` in prepareStageSkills' per-skill copy, and `stat` in
//     commitPreparedSkills' target inspection: both verbs are outside the
//     port's membership (D-08-13), so neither has an injected seam.
//   - the `rm` of a previous-named target dir and the staged `rename`, both
//     inside commitPreparedSkills: direct calls the port deliberately does not
//     carry, so faulting them still needs the builtin.
//
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

/**
 * Stages the one skill directory `directory` of the plugin `acme`, whose
 * `SKILL.md` holds `source`, and returns the staged `SKILL.md` bytes.
 */
async function stageSingleSkill(
  t: TestContext,
  directory: string,
  source: string,
): Promise<string> {
  const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
    t,
    "skills-stage-single-",
  );
  const skillsDirectory = path.join(pluginRoot, "skills");
  await mkdir(path.join(skillsDirectory, directory), { recursive: true });
  await writeFile(path.join(skillsDirectory, directory, "SKILL.md"), source);
  const resolved = {
    installable: true,
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: ["skills"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
    mcpServers: {},
    defaultEnabled: true,
  } satisfies ResolvedPluginInstallable;
  const prepared = await prepareStageSkills(createRemovalOps(), {
    locations,
    cwd: scopeRoot,
    knownWorkflowNames: [],
    pluginName: "acme",
    pluginRoot,
    pluginDataDir,
    resolved,
  });
  assert.strictEqual(prepared.kind, "staged");
  return readFile(path.join(prepared.stagingRoot, `acme-${directory}`, "SKILL.md"), "utf8");
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
      componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedWarning =
      'skill source "tool" in "' +
      skillsDirectory +
      '" elides to generated name "acme-tool", already produced by skill source ' +
      '"acme-tool"; ignoring duplicate.';

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      warnings: [{ kind: "discovery", message: expectedWarning }],
      degraded: [],
    });
    assert.strictEqual(
      await readFile(path.join(prepared.stagingRoot, "acme-tool", "SKILL.md"), "utf8"),
      "---\nname: acme-tool\ndescription: Winning skill\n---\n",
    );
  });

  test("rewrites same-plugin references including fenced examples", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-tokens-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    const toolDirectory = path.join(skillsDirectory, "tool");
    await mkdir(alphaDirectory, { recursive: true });
    await mkdir(toolDirectory, { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      '---\nname: alpha\ndescription: "Wraps acme:acme-tool for cleanup"\n---\n\n' +
        "Run acme:acme-tool before acme:ghost.\n\n```text\nacme:acme-tool stays verbatim\n```\n",
    );
    await writeFile(
      path.join(toolDirectory, "SKILL.md"),
      "---\nname: tool\ndescription: Cleanup tool\n---\n\nTool body.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const alphaBytes = await readFile(path.join(prepared.stagingRoot, "acme-alpha", "SKILL.md"));

    // assert
    assert.deepStrictEqual(prepared.result.stagedNames, ["acme-alpha", "acme-tool"]);
    assert.deepStrictEqual(
      alphaBytes,
      Buffer.from(
        '---\nname: acme-alpha\ndescription: "Wraps /skill:acme-tool for cleanup"\n---\n\n' +
          "Run /skill:acme-tool before acme:ghost.\n\n```text\n/skill:acme-tool stays verbatim\n```\n",
      ),
    );
  });

  test("SKTK-01: rewrites a sibling-workflow reference onto the name the caller says will be staged", async (t) => {
    // arrange -- the skill names a workflow by its upstream spelling. The
    // workflows bridge has not run yet, so the installed name is whatever the
    // caller threads in; a workflow the caller does not name stays verbatim.
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-workflow-tokens-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const alphaDirectory = path.join(skillsDirectory, "alpha");
    await mkdir(alphaDirectory, { recursive: true });
    await writeFile(
      path.join(alphaDirectory, "SKILL.md"),
      "---\nname: alpha\ndescription: Runs the audit\n---\n\n" +
        "Run /acme:acme-audit, then /acme:acme-release.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: ["acme:audit"],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const alphaBytes = await readFile(path.join(prepared.stagingRoot, "acme-alpha", "SKILL.md"));

    // assert
    assert.deepStrictEqual(
      alphaBytes,
      Buffer.from(
        "---\nname: acme-alpha\ndescription: Runs the audit\n---\n\n" +
          "Run /acme:audit, then /acme:acme-release.\n",
      ),
    );
  });

  test("rewrites command references in a skill and its supporting Markdown", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-cross-references-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const helperDirectory = path.join(skillsDirectory, "helper");
    await mkdir(helperDirectory, { recursive: true });
    await writeFile(
      path.join(helperDirectory, "SKILL.md"),
      "---\nname: helper\ndescription: Helper\n---\nRun /acme:review.\n",
    );
    await writeFile(path.join(helperDirectory, "notes.md"), "Then use acme:review.\n");
    const outsideFile = path.join(pluginRoot, "outside.md");
    await writeFile(outsideFile, "Run acme:review.\n");
    await symlink(outsideFile, path.join(helperDirectory, "linked.md"));
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
      referenceNames: { skills: ["acme-helper"], commands: ["acme:review"], workflows: [] },
    });
    assert.strictEqual(prepared.kind, "staged");
    const skill = await readFile(
      path.join(prepared.stagingRoot, "acme-helper", "SKILL.md"),
      "utf8",
    );
    const notes = await readFile(
      path.join(prepared.stagingRoot, "acme-helper", "notes.md"),
      "utf8",
    );

    // assert
    assert.strictEqual(
      skill,
      "---\nname: acme-helper\ndescription: Helper\n---\nRun /acme:review.\n",
    );
    assert.strictEqual(notes, "Then use /acme:review.\n");
    assert.strictEqual(await readFile(outsideFile, "utf8"), "Run acme:review.\n");
  });

  test("SKTK-01: rewrites references in a degraded skill's preserved body", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-tokens-degraded-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const brokenDirectory = path.join(skillsDirectory, "broken");
    const toolDirectory = path.join(skillsDirectory, "tool");
    await mkdir(brokenDirectory, { recursive: true });
    await mkdir(toolDirectory, { recursive: true });
    await writeFile(
      path.join(brokenDirectory, "SKILL.md"),
      "---\nname: [unterminated\ndescription: discarded\n---\n\nRun acme:acme-tool after the break.\n",
    );
    await writeFile(
      path.join(toolDirectory, "SKILL.md"),
      "---\nname: tool\ndescription: Cleanup tool\n---\n\nTool body.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const brokenBytes = await readFile(path.join(prepared.stagingRoot, "acme-broken", "SKILL.md"));

    // assert
    assert.deepStrictEqual(prepared.result.stagedNames, ["acme-broken", "acme-tool"]);
    assert.deepStrictEqual(
      prepared.result.degraded.map((record) => record.generatedName),
      ["acme-broken"],
    );
    assert.deepStrictEqual(
      brokenBytes,
      Buffer.from(
        "---\nname: acme-broken\n" +
          "description: Source frontmatter could not be parsed.\n" +
          "disable-model-invocation: true\n---\n\nRun /skill:acme-tool after the break.",
      ),
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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

  test("SKFM-01 stages the author description when only an unquoted colon broke the parse", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-colon-repair-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "helper");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: helper\ndescription: Use this: when reviewing pull requests\n---\n\nBody prose.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedBytes =
      "---\nname: acme-helper\n" +
      'description: "Use this: when reviewing pull requests"\n' +
      "---\n\nBody prose.\n";
    const expectedResult = {
      stagedNames: ["acme-helper"],
      recorded: [
        {
          generatedName: "acme-helper",
          sourcePath: skillDirectory,
          targetPath: path.join(locations.skillsTargetDir, "acme-helper"),
        },
      ],
      warnings: [],
      degraded: [],
    };

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const stagedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-helper", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.deepStrictEqual(prepared.result, expectedResult);
    assert.strictEqual(stagedBytes, expectedBytes);
  });

  test("SKFM-01 degrades with the source error when the colon was not the only defect", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-colon-still-broken-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "broken");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: [unterminated\ndescription: Use this: when reviewing\n---\n\n" +
        "# Broken\n\nBody bytes survive.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
            "name: [unterminated\ndescription: Use this: when reviewing\n^\n",
        },
      ],
    };

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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

  test("SKFM-01 folds when_to_use into a repaired description", async (t) => {
    // arrange
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-stage-colon-augment-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "helper");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "---\nname: helper\ndescription: Use this: when reviewing\n" +
        "when_to_use: For pull requests\n---\n\nBody.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedBytes =
      "---\nname: acme-helper\n" +
      'description: "Use this: when reviewing For pull requests"\n' +
      "when_to_use: For pull requests\n---\n\nBody.\n";

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const stagedBytes = await readFile(
      path.join(prepared.stagingRoot, "acme-helper", "SKILL.md"),
      "utf8",
    );

    // assert
    assert.deepStrictEqual(prepared.result.degraded, []);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const expectedEmpty = '---\nname: acme-empty\nversion: 1\ndescription: "Plugin skill"\n---\n';
    const expectedProse =
      '---\nname: acme-prose\nversion: 2\ndescription: "Heading"\n' +
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
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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

  for (const { behavior, source, expectedBytes } of [
    {
      behavior: "the first line of the body, without the rest of its paragraph",
      source:
        "---\nname: brief\n---\n\nFirst line of the brief.\nSecond line of the same paragraph.\n",
      expectedBytes:
        '---\nname: acme-brief\ndescription: "First line of the brief."\n---\n\n' +
        "First line of the brief.\nSecond line of the same paragraph.\n",
    },
    {
      behavior: "the text of a leading heading without its marks",
      source: "---\nname: brief\n---\n\n# Review a change\n\nRead the diff.\n",
      expectedBytes:
        '---\nname: acme-brief\ndescription: "Review a change"\n---\n\n' +
        "# Review a change\n\nRead the diff.\n",
    },
    {
      behavior: "Plugin skill for an empty body",
      source: "---\nname: brief\n---\n",
      expectedBytes: '---\nname: acme-brief\ndescription: "Plugin skill"\n---\n',
    },
  ]) {
    test(`D-CF2-07: fills a missing description with ${behavior}`, async (t) => {
      // act
      const stagedBytes = await stageSingleSkill(t, "brief", source);

      // assert
      assert.strictEqual(stagedBytes, expectedBytes);
    });
  }

  test("NREG-01: keeps a present description byte for byte", async (t) => {
    // arrange
    const expectedBytes =
      "---\nname: acme-brief\ndescription:   Kept as written  \n---\n\nFirst line.\n";

    // act
    const stagedBytes = await stageSingleSkill(
      t,
      "brief",
      "---\nname: brief\ndescription:   Kept as written  \n---\n\nFirst line.\n",
    );

    // assert
    assert.strictEqual(stagedBytes, expectedBytes);
  });

  test("WTU-01: stages when_to_use after the fallback as one double-quoted scalar", async (t) => {
    // arrange
    const expectedBytes =
      "---\nname: acme-greet\nwhen_to_use: Use it when greeting.\n" +
      'description: "Greets. Use it when greeting."\n---\n\nGreets.\n';

    // act
    const stagedBytes = await stageSingleSkill(
      t,
      "greet",
      "---\nname: greet\nwhen_to_use: Use it when greeting.\n---\n\nGreets.\n",
    );

    // assert
    assert.strictEqual(stagedBytes, expectedBytes);
  });

  test("WTU-01: folds when_to_use onto the fallback and cuts the result at 1,536", async (t) => {
    // arrange
    const whenToUse = "w".repeat(1600);
    const expectedDescription = "First line. " + "w".repeat(1536 - "First line.\n".length);
    const expectedBytes =
      "---\nname: acme-brief\nwhen_to_use: " +
      whenToUse +
      '\ndescription: "' +
      expectedDescription +
      '"\n---\n\nFirst line.\n';

    // act
    const stagedBytes = await stageSingleSkill(
      t,
      "brief",
      "---\nname: brief\nwhen_to_use: " + whenToUse + "\n---\n\nFirst line.\n",
    );

    // assert
    assert.strictEqual(stagedBytes, expectedBytes);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const windowsRoot = "C:\\Users\\case\\plugin";
    const expectedBytes =
      '---\nname: acme-windows\ndescription: "Uses C:\\\\Users\\\\case\\\\plugin."\n' +
      "---\nUses C:\\Users\\case\\plugin.\n";

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
    const { agentDir: scopeRoot } = await createHermeticEnvironment(t, "skills-stage-user-");
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: path.join(scopeRoot, "ignored-project"),
      knownWorkflowNames: [],
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
      await prepareStageSkills(createRemovalOps(), {
        locations,
        cwd: scopeRoot,
        knownWorkflowNames: [],
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
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
      await prepareStageSkills(createRemovalOps(), {
        locations,
        cwd: scopeRoot,
        knownWorkflowNames: [],
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;

    // act
    let prepareError: unknown;
    try {
      await prepareStageSkills(createRemovalOps(), {
        locations,
        cwd: scopeRoot,
        knownWorkflowNames: [],
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
      componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });

    // act
    const leak = await commitPreparedSkills(createRemovalOps(), prepared);
    const targetDirectory = await stat(locations.skillsTargetDir).catch(() => undefined);

    // assert
    assert.strictEqual(leak, undefined);
    assert.strictEqual(targetDirectory, undefined);
  });

  test("commits a source led by a byte-order mark as one unmarked frontmatter block", async (t) => {
    // arrange
    // FMBOM-01: a marker makes `rewriteFrontmatterName` take the freshBlock
    // path, which emits a name-only block and leaves the source block -- with
    // its `description` -- as body text. The assertions read the COMMITTED
    // bytes, not a parse result: the installed peer tolerates a leading marker
    // in its own parser, so a parse-only check would pass without the strip.
    const { locations, pluginDataDir, pluginRoot, scopeRoot } = await allocateCasePaths(
      t,
      "skills-commit-bom-",
    );
    const skillsDirectory = path.join(pluginRoot, "skills");
    const skillDirectory = path.join(skillsDirectory, "reviewer");
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(
      path.join(skillDirectory, "SKILL.md"),
      "\uFEFF---\nname: source-reviewer\ndescription: Reviews changes\n---\n\nReview carefully.\n",
    );
    const resolved = {
      installable: true,
      state: "installable",
      name: "acme",
      pluginRoot,
      supported: ["skills"],
      unsupported: [],
      notes: [],
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const targetFile = path.join(locations.skillsTargetDir, "acme-reviewer", "SKILL.md");
    const expectedBytes = Buffer.from(
      "---\nname: acme-reviewer\ndescription: Reviews changes\n---\n\nReview carefully.\n",
    );

    // act
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    const leak = await commitPreparedSkills(createRemovalOps(), prepared);
    const committedBytes = await readFile(targetFile);

    // assert
    assert.strictEqual(leak, undefined);
    assert.deepStrictEqual(committedBytes, expectedBytes);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
      previousSkillNames: ["previous"],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const leak = await commitPreparedSkills(createRemovalOps(), prepared);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      await commitPreparedSkills(createRemovalOps(), prepared);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      await commitPreparedSkills(createRemovalOps(), prepared);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
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
      await commitPreparedSkills(createRemovalOps(), prepared);
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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");
    const cleanupError = Object.assign(new Error("staging cleanup denied"), { code: "EACCES" });
    // The fault is keyed on this one staging root, so a sibling cleanup in the
    // same commit would still succeed. The staged rename below is NOT a port
    // call, so it still moves real bytes and the target read still holds.
    const removal = createRemovalOpsFake({
      boundary: "memory",
      rmErrors: [[prepared.stagingRoot, cleanupError]],
    });
    const expectedLeak =
      "failed to clean up skills staging directory at " +
      prepared.stagingRoot +
      ": staging cleanup denied";

    // act
    const leak = await commitPreparedSkills(removal.removalOps, prepared);
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
      componentPaths: { skills: [], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });

    // act
    const leak = await abortPreparedSkills(createRemovalOps(), prepared);

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
      componentPaths: { skills: [skillsDirectory], commands: [], agents: [], workflows: [] },
      mcpServers: {},
      defaultEnabled: true,
    } satisfies ResolvedPluginInstallable;
    const prepared = await prepareStageSkills(createRemovalOps(), {
      locations,
      cwd: scopeRoot,
      knownWorkflowNames: [],
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      resolved,
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const firstLeak = await abortPreparedSkills(createRemovalOps(), prepared);
    const secondLeak = await abortPreparedSkills(createRemovalOps(), prepared);
    const stagingState = await stat(prepared.stagingRoot).catch(() => undefined);
    const targetState = await stat(locations.skillsTargetDir).catch(() => undefined);

    // assert
    assert.strictEqual(firstLeak, undefined);
    assert.strictEqual(secondLeak, undefined);
    assert.strictEqual(stagingState, undefined);
    assert.strictEqual(targetState, undefined);
  });
});
