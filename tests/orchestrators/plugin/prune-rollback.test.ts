import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { preparePruneRollback } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts";
import { saveAgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { IndexedRecord } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

function member(locations: ScopedLocations): IndexedRecord {
  const record: ExtensionState["marketplaces"][string]["plugins"][string] = {
    version: "1.0.0",
    resolvedSource: "/unused",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: ["orphan-skill"],
      prompts: ["orphan-command"],
      agents: ["orphan-agent"],
      mcpServers: ["orphan-mcp"],
      hooks: ["stop"],
    },
    enabled: true,
    provenance: "dependency",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const marketplace: ExtensionState["marketplaces"][string] = {
    name: "mp",
    scope: locations.scope,
    source: pathSource("./mp"),
    addedFromCwd: locations.scopeRoot,
    manifestPath: path.join(locations.extensionRoot, "sources", "mp", "marketplace.json"),
    marketplaceRoot: path.join(locations.extensionRoot, "sources", "mp"),
    plugins: { orphan: record },
  };
  return { key: "orphan@mp", provenance: "dependency", marketplace, plugin: "orphan", record };
}

async function seed(locations: ScopedLocations): Promise<{
  readonly member: IndexedRecord;
  readonly skill: string;
  readonly command: string;
  readonly agent: string;
  readonly hook: string;
}> {
  const orphan = member(locations);
  await saveState(locations.extensionRoot, {
    schemaVersion: 3,
    marketplaces: { mp: orphan.marketplace },
  });
  const skill = path.join(locations.skillsTargetDir, "orphan-skill", "SKILL.md");
  const command = path.join(locations.promptsTargetDir, "orphan-command.md");
  const agent = path.join(locations.agentsDir, "orphan-agent.md");
  const hook = path.join(locations.hooksDir, "orphan", "hooks.json");
  for (const target of [skill, command, agent, hook]) {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${path.basename(target)} original\n`);
  }

  await saveAgentsIndex(locations, {
    schemaVersion: 1,
    agents: [
      {
        plugin: "orphan",
        marketplace: "mp",
        sourceAgent: "orphan",
        generatedName: "orphan-agent",
        sourcePath: "/unused",
        targetPath: agent,
        sourceHash: "unused",
        droppedFields: [],
        droppedTools: [],
        warnings: [],
      },
    ],
  });
  await writeFile(locations.mcpJsonPath, '{ "mcpServers": { "orphan": 1 } }\n');
  return { member: orphan, skill, command, agent, hook };
}

test("restores every removed artifact and exact metadata bytes after failed persistence", async () => {
  await withHermeticEnvironment("prune-rollback-all-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const paths = [fixture.skill, fixture.command, fixture.agent, fixture.hook];
    const metadata = [locations.agentsIndexPath, locations.mcpJsonPath, locations.stateJsonPath];
    const before = await Promise.all([...paths, ...metadata].map((target) => readFile(target)));
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });

    // act
    for (const target of paths) {
      await rm(target, { force: true });
    }

    await rm(path.dirname(fixture.skill), { recursive: true });
    await rm(path.dirname(fixture.hook), { recursive: true });
    for (const target of metadata) {
      await writeFile(target, "changed\n");
    }

    await rollback.markUnstaged();

    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(failures, []);
    assert.deepStrictEqual(
      await Promise.all([...paths, ...metadata].map((target) => readFile(target))),
      before,
    );
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});

test("discard removes the snapshot after a successful state save", async () => {
  await withHermeticEnvironment("prune-rollback-commit-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });

    // act
    await rollback.discard();

    // assert
    assert.equal(await readFile(fixture.skill, "utf8"), "SKILL.md original\n");
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});

test("occupied artifact remains untouched and keeps its recovery backup", async () => {
  await withHermeticEnvironment("prune-rollback-occupied-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await writeFile(fixture.command, "replacement\n");

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => ({ phase, message: cause.message })),
      [
        {
          phase: "commands",
          message: `Prune rollback found an occupied artifact at ${fixture.command}.`,
        },
      ],
    );
    assert.equal(await readFile(fixture.command, "utf8"), "replacement\n");
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("rename failure keeps the backup and reports an artifact restore failure", async () => {
  await withHermeticEnvironment("prune-rollback-rename-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      rename: async (from, to) => {
        if (to === fixture.command) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rollback normalizes foreign filesystem rejections.
          await Promise.reject("restore refused");
        }

        await rename(from, to);
      },
    });
    await rm(fixture.command);

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => ({ phase, message: cause.message })),
      [{ phase: "commands", message: "restore refused" }],
    );
    await assert.rejects(stat(fixture.command), { code: "ENOENT" });
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("retained backup maps two skills to their exact recovery targets", async () => {
  await withHermeticEnvironment("prune-rollback-manifest-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const secondSkill = path.join(locations.skillsTargetDir, "second-skill", "SKILL.md");
    await mkdir(path.dirname(secondSkill), { recursive: true });
    await writeFile(secondSkill, "second original\n");
    const secondMember: IndexedRecord = {
      ...fixture.member,
      record: {
        ...fixture.member.record,
        resources: { ...fixture.member.record.resources, skills: ["orphan-skill", "second-skill"] },
      },
    };
    const rollback = await preparePruneRollback(locations, [secondMember], {
      removeBackup: rm,
      rename: async (from, to) => {
        if (to === path.dirname(secondSkill)) {
          throw new Error("restore refused");
        }

        await rename(from, to);
      },
    });
    await rm(path.dirname(fixture.skill), { recursive: true });
    await rm(path.dirname(secondSkill), { recursive: true });

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => [phase, cause.message]),
      [["skills", "restore refused"]],
    );
    const [backupName] = (await readdir(locations.extensionRoot)).filter((name) =>
      name.startsWith("prune-backup-"),
    );
    assert.equal(rollback.backupName, backupName);
    const manifest = JSON.parse(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "manifest.json"), "utf8"),
    ) as { entries: Array<{ phase: string; root: string; target: string; backup: string | null }> };
    assert.deepStrictEqual(
      manifest.entries.filter((entry) => entry.phase === "skills"),
      [
        {
          phase: "skills",
          root: path.join("pi-claude-marketplace", "resources", "skills"),
          target: "orphan-skill",
          backup: "0",
        },
        {
          phase: "skills",
          root: path.join("pi-claude-marketplace", "resources", "skills"),
          target: "second-skill",
          backup: "1",
        },
      ],
    );
    assert.equal(await readFile(secondSkill, "utf8").catch(() => "missing"), "missing");
    assert.equal(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "1", "SKILL.md"), "utf8"),
      "second original\n",
    );
  });
});

test("snapshot preparation refuses an agent path outside the scope", async () => {
  await withHermeticEnvironment("prune-rollback-outside-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    await saveAgentsIndex(locations, {
      schemaVersion: 1,
      agents: [
        {
          plugin: "orphan",
          marketplace: "mp",
          sourceAgent: "orphan",
          generatedName: "orphan-agent",
          sourcePath: "/unused",
          targetPath: path.join(cwd, "outside.md"),
          sourceHash: "unused",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    });
    const stateBefore = await readFile(locations.stateJsonPath);

    // act & assert
    await assert.rejects(
      preparePruneRollback(locations, [fixture.member], { rename, removeBackup: rm }),
    );
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), stateBefore);
    assert.equal(await readFile(fixture.skill, "utf8"), "SKILL.md original\n");
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});

test("invalid bridge names are excluded from the snapshot", async () => {
  await withHermeticEnvironment("prune-rollback-unsafe-names-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const unsafeMember: IndexedRecord = {
      ...fixture.member,
      plugin: "../invalid",
      record: {
        ...fixture.member.record,
        resources: {
          ...fixture.member.record.resources,
          skills: ["../invalid"],
          prompts: ["../invalid"],
        },
      },
    };

    // act
    const rollback = await preparePruneRollback(locations, [unsafeMember], {
      rename,
      removeBackup: rm,
    });
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(failures, []);
    assert.equal(await readFile(fixture.skill, "utf8"), "SKILL.md original\n");
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});

test("rollback preserves absent artifacts and removes metadata created after the snapshot", async () => {
  await withHermeticEnvironment("prune-rollback-absent-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    await rm(fixture.command);
    await rm(path.dirname(fixture.hook), { recursive: true });
    await rm(locations.agentsIndexPath);
    await rm(locations.mcpJsonPath);
    await rm(locations.stateJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await writeFile(locations.mcpJsonPath, "new mcp\n");
    await writeFile(locations.stateJsonPath, "new state\n");
    await rollback.markUnstaged();

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(failures, []);
    for (const target of [
      fixture.command,
      path.dirname(fixture.hook),
      locations.agentsIndexPath,
      locations.mcpJsonPath,
      locations.stateJsonPath,
    ]) {
      await assert.rejects(stat(target), { code: "ENOENT" });
    }

    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [],
    );
  });
});

const replacementCases: readonly {
  readonly name: string;
  readonly phase: "commands" | "skills";
  readonly replace: (fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>;
}[] = [
  {
    name: "directory replaces command file",
    phase: "commands",
    replace: async (fixture) => {
      await rm(fixture.command);
      await mkdir(fixture.command);
    },
  },
  {
    name: "file replaces skill directory",
    phase: "skills",
    replace: async (fixture) => {
      await rm(path.dirname(fixture.skill), { recursive: true });
      await writeFile(path.dirname(fixture.skill), "replacement\n");
    },
  },
  {
    name: "skill directory gains a file",
    phase: "skills",
    replace: async (fixture) => {
      await writeFile(path.join(path.dirname(fixture.skill), "extra.md"), "extra\n");
    },
  },
  {
    name: "skill file changes name",
    phase: "skills",
    replace: async (fixture) => {
      await rename(fixture.skill, path.join(path.dirname(fixture.skill), "OTHER.md"));
    },
  },
  {
    name: "skill file changes content",
    phase: "skills",
    replace: async (fixture) => {
      await writeFile(fixture.skill, "changed\n");
    },
  },
  {
    name: "skill directory changes mode",
    phase: "skills",
    replace: async (fixture) => {
      await chmod(path.dirname(fixture.skill), 0o700);
    },
  },
];

for (const { name, phase, replace } of replacementCases) {
  test(`rollback preserves replacement when ${name}`, async () => {
    await withHermeticEnvironment(
      `prune-rollback-replaced-${name.replaceAll(" ", "-")}-`,
      async ({ cwd }) => {
        // arrange
        const locations = locationsFor("project", cwd);
        const fixture = await seed(locations);
        const rollback = await preparePruneRollback(locations, [fixture.member], {
          rename,
          removeBackup: rm,
        });
        await replace(fixture);

        // act
        const failures = await rollback.rollback();

        // assert
        assert.equal(failures.length, 1);
        assert.equal(failures[0]?.phase, phase);
        assert.match(failures[0]?.cause.message ?? "", /occupied artifact/);
        assert.equal(
          (await readdir(locations.extensionRoot)).filter((name) =>
            name.startsWith("prune-backup-"),
          ).length,
          1,
        );
      },
    );
  });
}

test("nested symlink content is compared without following its target", async () => {
  await withHermeticEnvironment("prune-rollback-symlink-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const outside = path.join(cwd, "outside.md");
    await writeFile(outside, "outside bytes\n");
    await symlink(outside, path.join(path.dirname(fixture.skill), "linked.md"));
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(failures, []);
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
  });
});

test("a replaced nested symlink is detected without reading either target", async () => {
  await withHermeticEnvironment("prune-rollback-symlink-replaced-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const linked = path.join(path.dirname(fixture.skill), "linked.md");
    await symlink(path.join(cwd, "first-outside.md"), linked);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await rm(linked);
    await symlink(path.join(cwd, "second-outside.md"), linked);

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["skills"],
    );
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("metadata restore failure keeps backups and still restores state last", async () => {
  await withHermeticEnvironment("prune-rollback-metadata-failure-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const originalState = await readFile(locations.stateJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    const outside = path.join(cwd, "outside.json");
    await writeFile(outside, "outside bytes\n");
    await rm(locations.mcpJsonPath);
    await symlink(outside, locations.mcpJsonPath);
    await writeFile(locations.stateJsonPath, "changed\n");

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), originalState);
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("shared MCP edit after unstage stays current and retains its original backup", async () => {
  await withHermeticEnvironment("prune-rollback-mcp-collision-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const originalMcp = await readFile(locations.mcpJsonPath);
    const originalState = await readFile(locations.stateJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await writeFile(locations.mcpJsonPath, '{ "mcpServers": {} }\n');
    await rollback.markUnstaged();
    await writeFile(locations.mcpJsonPath, '{ "mcpServers": { "independent": 1 } }\n');
    await writeFile(locations.stateJsonPath, "failed save\n");

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.equal(
      await readFile(locations.mcpJsonPath, "utf8"),
      '{ "mcpServers": { "independent": 1 } }\n',
    );
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), originalState);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "5")),
      originalMcp,
    );
  });
});

test("agents index edit after unstage stays current and retains its original backup", async () => {
  await withHermeticEnvironment("prune-rollback-agents-index-collision-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const originalIndex = await readFile(locations.agentsIndexPath);
    const originalState = await readFile(locations.stateJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await writeFile(locations.agentsIndexPath, "unstaged index\n");
    await rollback.markUnstaged();
    await writeFile(locations.agentsIndexPath, "independent index\n");
    await writeFile(locations.stateJsonPath, "failed save\n");

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["agents index"],
    );
    assert.equal(await readFile(locations.agentsIndexPath, "utf8"), "independent index\n");
    assert.deepStrictEqual(await readFile(locations.stateJsonPath), originalState);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "4")),
      originalIndex,
    );
  });
});

test("metadata directory collision leaves the directory and its backup intact", async () => {
  await withHermeticEnvironment("prune-rollback-metadata-directory-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const originalMcp = await readFile(locations.mcpJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    await rollback.markUnstaged();
    await rm(locations.mcpJsonPath);
    await mkdir(locations.mcpJsonPath);

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.equal((await stat(locations.mcpJsonPath)).isDirectory(), true);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "5")),
      originalMcp,
    );
  });
});

test("state restore refusal keeps the backup and reports state failure", async () => {
  await withHermeticEnvironment("prune-rollback-state-refusal-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: rm,
    });
    const outside = path.join(cwd, "outside-state.json");
    await writeFile(outside, "outside bytes\n");
    await rm(locations.stateJsonPath);
    await symlink(outside, locations.stateJsonPath);

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["state"],
    );
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("failed rollback cleanup reports partial failure and retains the backup", async () => {
  await withHermeticEnvironment("prune-rollback-cleanup-rollback-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: () => Promise.reject(new Error("backup cleanup refused")),
    });

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => ({ phase, message: cause.message })),
      [{ phase: "backup cleanup", message: "backup cleanup refused" }],
    );
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});

test("failed committed cleanup stays silent and retains the backup", async () => {
  await withHermeticEnvironment("prune-rollback-cleanup-discard-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      rename,
      removeBackup: () => Promise.reject(new Error("backup cleanup refused")),
    });

    // act & assert
    await assert.doesNotReject(rollback.discard());
    assert.equal(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-"))
        .length,
      1,
    );
  });
});
