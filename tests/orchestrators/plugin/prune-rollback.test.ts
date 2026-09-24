import assert from "node:assert/strict";
import {
  chmod,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
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

test("missing directories retain recovery backups while files and state restore", async () => {
  await withHermeticEnvironment("prune-rollback-all-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const paths = [fixture.command, fixture.agent];
    const metadata = [locations.agentsIndexPath, locations.mcpJsonPath, locations.stateJsonPath];
    const before = await Promise.all([...paths, ...metadata].map((target) => readFile(target)));
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });

    // act
    for (const target of [fixture.skill, ...paths, fixture.hook]) {
      await rm(target, { force: true });
    }

    await rm(path.dirname(fixture.skill), { recursive: true });
    await rm(path.dirname(fixture.hook), { recursive: true });
    await writeFile(locations.stateJsonPath, "changed\n");

    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["skills", "hooks"],
    );
    assert.deepStrictEqual(
      await Promise.all([...paths, ...metadata].map((target) => readFile(target))),
      before,
    );
    await assert.rejects(lstat(path.dirname(fixture.skill)), { code: "ENOENT" });
    await assert.rejects(lstat(path.dirname(fixture.hook)), { code: "ENOENT" });
    const backupRoot = path.join(locations.extensionRoot, rollback.backupName);
    const manifest = JSON.parse(await readFile(path.join(backupRoot, "manifest.json"), "utf8")) as {
      entries: Array<{ phase: string; backup: string | null }>;
    };
    for (const { phase, fileName, original } of [
      { phase: "skills", fileName: "SKILL.md", original: "SKILL.md original\n" },
      { phase: "hooks", fileName: "hooks.json", original: "hooks.json original\n" },
    ]) {
      const entry = manifest.entries.find((saved) => saved.phase === phase);
      assert.ok(entry?.backup);
      assert.equal(await readFile(path.join(backupRoot, entry.backup, fileName), "utf8"), original);
    }

    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [rollback.backupName],
    );
  });
});

test("discard removes the snapshot after a successful state save", async () => {
  await withHermeticEnvironment("prune-rollback-commit-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
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

test("artifact publication refuses a replacement created at the write boundary", async () => {
  await withHermeticEnvironment("prune-rollback-publish-race-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(fixture.command);
    const replacement = Buffer.from("independent replacement\n");
    let published = false;
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      link: async (from, to) => {
        if (to === fixture.command) {
          await writeFile(to, replacement, { flag: "wx" });
          published = true;
        }

        await link(from, to);
      },
    });
    await rm(fixture.command);

    const failures = await rollback.rollback();

    assert.equal(published, true);
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["commands"],
    );
    assert.deepStrictEqual(await readFile(fixture.command), replacement);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "1")),
      original,
    );
  });
});

test("publication failure keeps the backup and reports an artifact restore failure", async () => {
  await withHermeticEnvironment("prune-rollback-rename-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      link: async (from, to) => {
        if (to === fixture.command) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rollback normalizes foreign filesystem rejections.
          await Promise.reject("restore refused");
        }

        await link(from, to);
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

test("nested directory backup stays complete across repeated partial rollbacks", async () => {
  await withHermeticEnvironment("prune-rollback-directory-retry-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const skillDir = path.dirname(fixture.skill);
    await rename(fixture.skill, path.join(skillDir, "a.md"));
    await writeFile(path.join(skillDir, "z.md"), "last child\n");
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    await rm(skillDir, { recursive: true });

    const firstFailures = await rollback.rollback();
    assert.deepStrictEqual(
      firstFailures.map(({ phase }) => phase),
      ["skills"],
    );
    await assert.rejects(lstat(skillDir), { code: "ENOENT" });

    const secondFailures = await rollback.rollback();
    assert.deepStrictEqual(
      secondFailures.map(({ phase }) => phase),
      ["skills"],
    );
    await assert.rejects(lstat(skillDir), { code: "ENOENT" });
    const backup = path.join(locations.extensionRoot, rollback.backupName, "0");
    assert.deepStrictEqual(await readdir(backup), ["a.md", "z.md"]);
    assert.equal(await readFile(path.join(backup, "a.md"), "utf8"), "SKILL.md original\n");
    assert.equal(await readFile(path.join(backup, "z.md"), "utf8"), "last child\n");
  });
});

test("an in-place edit to a restored file cannot change its retained backup", async () => {
  await withHermeticEnvironment("prune-rollback-file-alias-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(fixture.command);
    const independent = Buffer.from("independent command\n");
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      link: async (from, to) => {
        await link(from, to);
        if (to === fixture.command) {
          await writeFile(to, independent);
        }
      },
    });
    await rm(fixture.command);
    await writeFile(locations.mcpJsonPath, "independent metadata\n");

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.deepStrictEqual(await readFile(fixture.command), independent);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "1")),
      original,
    );
  });
});

test("restored file mode survives the process umask", async () => {
  await withHermeticEnvironment("prune-rollback-file-mode-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    await chmod(fixture.command, 0o764);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    await rm(fixture.command);
    const priorUmask = process.umask(0o077);
    try {
      assert.deepStrictEqual(await rollback.rollback(), []);
    } finally {
      process.umask(priorUmask);
    }

    assert.equal((await lstat(fixture.command)).mode & 0o777, 0o764);
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
    });
    await rm(path.dirname(fixture.skill), { recursive: true });
    await rm(path.dirname(secondSkill), { recursive: true });

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase, cause }) => [phase, cause.message]),
      [
        [
          "skills",
          `Prune rollback requires manual directory restore at ${path.dirname(fixture.skill)}.`,
        ],
        [
          "skills",
          `Prune rollback requires manual directory restore at ${path.dirname(secondSkill)}.`,
        ],
      ],
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
    await assert.rejects(lstat(path.dirname(fixture.skill)), { code: "ENOENT" });
    await assert.rejects(lstat(path.dirname(secondSkill)), { code: "ENOENT" });
    assert.equal(
      await readFile(path.join(locations.extensionRoot, backupName ?? "", "0", "SKILL.md"), "utf8"),
      "SKILL.md original\n",
    );
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
    await assert.rejects(preparePruneRollback(locations, [fixture.member], { removeBackup: rm }));
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

test("rollback preserves absent artifacts and independent metadata created after the snapshot", async () => {
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
      removeBackup: rm,
    });
    await writeFile(locations.mcpJsonPath, "new mcp\n");
    await writeFile(locations.stateJsonPath, "new state\n");

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    for (const target of [
      fixture.command,
      path.dirname(fixture.hook),
      locations.agentsIndexPath,
      locations.stateJsonPath,
    ]) {
      await assert.rejects(stat(target), { code: "ENOENT" });
    }

    assert.equal(await readFile(locations.mcpJsonPath, "utf8"), "new mcp\n");
    assert.deepStrictEqual(
      (await readdir(locations.extensionRoot)).filter((name) => name.startsWith("prune-backup-")),
      [rollback.backupName],
    );
  });
});

const replacementCases: readonly {
  readonly name: string;
  readonly phase: "commands" | "skills";
  readonly replace: (fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>;
  readonly assertReplacement: (fixture: Awaited<ReturnType<typeof seed>>) => Promise<void>;
}[] = [
  {
    name: "directory replaces command file",
    phase: "commands",
    replace: async (fixture) => {
      await rm(fixture.command);
      await mkdir(fixture.command);
    },
    assertReplacement: async (fixture) => {
      assert.equal((await stat(fixture.command)).isDirectory(), true);
      assert.deepStrictEqual(await readdir(fixture.command), []);
    },
  },
  {
    name: "file replaces skill directory",
    phase: "skills",
    replace: async (fixture) => {
      await rm(path.dirname(fixture.skill), { recursive: true });
      await writeFile(path.dirname(fixture.skill), "replacement\n");
    },
    assertReplacement: async (fixture) => {
      assert.equal((await stat(path.dirname(fixture.skill))).isFile(), true);
      assert.equal(await readFile(path.dirname(fixture.skill), "utf8"), "replacement\n");
    },
  },
  {
    name: "skill directory gains a file",
    phase: "skills",
    replace: async (fixture) => {
      await writeFile(path.join(path.dirname(fixture.skill), "extra.md"), "extra\n");
    },
    assertReplacement: async (fixture) => {
      assert.deepStrictEqual(await readdir(path.dirname(fixture.skill)), ["SKILL.md", "extra.md"]);
      assert.equal(await readFile(fixture.skill, "utf8"), "SKILL.md original\n");
      assert.equal(
        await readFile(path.join(path.dirname(fixture.skill), "extra.md"), "utf8"),
        "extra\n",
      );
    },
  },
  {
    name: "skill file changes name",
    phase: "skills",
    replace: async (fixture) => {
      await rename(fixture.skill, path.join(path.dirname(fixture.skill), "OTHER.md"));
    },
    assertReplacement: async (fixture) => {
      assert.deepStrictEqual(await readdir(path.dirname(fixture.skill)), ["OTHER.md"]);
      assert.equal(
        await readFile(path.join(path.dirname(fixture.skill), "OTHER.md"), "utf8"),
        "SKILL.md original\n",
      );
    },
  },
  {
    name: "skill file changes content",
    phase: "skills",
    replace: async (fixture) => {
      await writeFile(fixture.skill, "changed\n");
    },
    assertReplacement: async (fixture) => {
      assert.deepStrictEqual(await readdir(path.dirname(fixture.skill)), ["SKILL.md"]);
      assert.equal(await readFile(fixture.skill, "utf8"), "changed\n");
    },
  },
  {
    name: "skill directory changes mode",
    phase: "skills",
    replace: async (fixture) => {
      await chmod(path.dirname(fixture.skill), 0o700);
    },
    assertReplacement: async (fixture) => {
      assert.equal((await stat(path.dirname(fixture.skill))).mode & 0o777, 0o700);
      assert.deepStrictEqual(await readdir(path.dirname(fixture.skill)), ["SKILL.md"]);
      assert.equal(await readFile(fixture.skill, "utf8"), "SKILL.md original\n");
    },
  },
];

for (const { name, phase, replace, assertReplacement } of replacementCases) {
  test(`rollback preserves replacement when ${name}`, async () => {
    await withHermeticEnvironment(
      `prune-rollback-replaced-${name.replaceAll(" ", "-")}-`,
      async ({ cwd }) => {
        // arrange
        const locations = locationsFor("project", cwd);
        const fixture = await seed(locations);
        const originalSkillMode = (await stat(path.dirname(fixture.skill))).mode & 0o777;
        const rollback = await preparePruneRollback(locations, [fixture.member], {
          removeBackup: rm,
        });
        await replace(fixture);

        // act
        const failures = await rollback.rollback();

        // assert
        assert.equal(failures.length, 1);
        assert.equal(failures[0]?.phase, phase);
        assert.match(failures[0]?.cause.message ?? "", /occupied artifact/);
        await assertReplacement(fixture);
        const manifest = JSON.parse(
          await readFile(
            path.join(locations.extensionRoot, rollback.backupName, "manifest.json"),
            "utf8",
          ),
        ) as { entries: Array<{ phase: string; backup: string | null }> };
        const saved = manifest.entries.find((entry) => entry.phase === phase);
        assert.ok(saved?.backup);
        const backup = path.join(locations.extensionRoot, rollback.backupName, saved.backup);
        if (phase === "skills") {
          assert.equal((await stat(backup)).isDirectory(), true);
          assert.equal((await stat(backup)).mode & 0o777, originalSkillMode);
          assert.deepStrictEqual(await readdir(backup), ["SKILL.md"]);
        } else {
          assert.equal((await stat(backup)).isFile(), true);
        }

        assert.equal(
          await readFile(phase === "skills" ? path.join(backup, "SKILL.md") : backup, "utf8"),
          phase === "skills" ? "SKILL.md original\n" : "orphan-command.md original\n",
        );
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
      removeBackup: rm,
    });

    // act
    const failures = await rollback.rollback();

    // assert
    assert.deepStrictEqual(failures, []);
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
  });
});

test("missing directory retains a nested symlink in its backup", async () => {
  await withHermeticEnvironment("prune-rollback-symlink-publish-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const linked = path.join(path.dirname(fixture.skill), "linked.md");
    const outside = path.join(cwd, "outside.md");
    await writeFile(outside, "outside bytes\n");
    await symlink(outside, linked);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    await rm(path.dirname(fixture.skill), { recursive: true });

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["skills"],
    );
    await assert.rejects(lstat(path.dirname(fixture.skill)), { code: "ENOENT" });
    assert.equal(
      await readlink(path.join(locations.extensionRoot, rollback.backupName, "0", "linked.md")),
      outside,
    );
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
  });
});

test("rollback rejects a symlink substituted into an artifact backup", async () => {
  await withHermeticEnvironment("prune-rollback-symlink-artifact-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const outside = path.join(cwd, "outside.md");
    await writeFile(outside, "outside bytes\n");
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    const backup = path.join(locations.extensionRoot, rollback.backupName, "1");
    await rm(backup);
    await symlink(outside, backup);
    await rm(fixture.command);

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["commands"],
    );
    await assert.rejects(lstat(fixture.command), { code: "ENOENT" });
    assert.equal(await readlink(backup), outside);
    assert.equal(await readFile(outside, "utf8"), "outside bytes\n");
  });
});

test("unsupported backup artifact kind retains the recovery snapshot", async () => {
  await withHermeticEnvironment("prune-rollback-unsupported-backup-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
      inspectBackup: async (target) => {
        const entry = await lstat(target);
        if (path.basename(target) === "1") {
          return Object.assign(entry, {
            isFile: () => false,
            isSymbolicLink: () => false,
            isDirectory: () => false,
          });
        }

        return entry;
      },
    });
    const unsupportedBackup = path.join(locations.extensionRoot, rollback.backupName, "1");
    await rm(fixture.command);

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["commands"],
    );
    assert.match(failures[0]?.cause.message ?? "", /cannot publish unsupported artifact/);
    await assert.rejects(stat(fixture.command), { code: "ENOENT" });
    assert.equal(await readFile(unsupportedBackup, "utf8"), "orphan-command.md original\n");
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
      removeBackup: rm,
    });
    await writeFile(locations.mcpJsonPath, '{ "mcpServers": {} }\n');
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

test("MCP edit before unstage observation stays current and retains its backup", async () => {
  await withHermeticEnvironment("prune-rollback-mcp-before-mark-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(locations.mcpJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    const independent = Buffer.from('{ "mcpServers": { "orphan": 1, "independent": 2 } }\n');
    await writeFile(locations.mcpJsonPath, independent);

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.deepStrictEqual(await readFile(locations.mcpJsonPath), independent);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "5")),
      original,
    );
  });
});

test("MCP edit during rollback observation remains current with recovery backup", async () => {
  await withHermeticEnvironment("prune-rollback-mcp-read-race-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(locations.mcpJsonPath);
    const independent = Buffer.from('{ "mcpServers": { "independent": 2 } }\n');
    let injected = false;
    const ops = {
      removeBackup: rm,
      afterMetadataRead: async (target: string): Promise<void> => {
        if (target === locations.mcpJsonPath && !injected) {
          injected = true;
          await writeFile(target, independent);
        }
      },
    };
    const rollback = await preparePruneRollback(locations, [fixture.member], ops);
    await writeFile(locations.mcpJsonPath, '{ "mcpServers": {} }\n');

    const failures = await rollback.rollback();

    assert.equal(injected, true);
    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.deepStrictEqual(await readFile(locations.mcpJsonPath), independent);
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "5")),
      original,
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
      removeBackup: rm,
    });
    await writeFile(locations.agentsIndexPath, "unstaged index\n");
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
      removeBackup: rm,
    });
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

test("missing shared metadata keeps its original recovery backup", async () => {
  await withHermeticEnvironment("prune-rollback-metadata-missing-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(locations.mcpJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    await rm(locations.mcpJsonPath);

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    await assert.rejects(stat(locations.mcpJsonPath), { code: "ENOENT" });
    assert.deepStrictEqual(
      await readFile(path.join(locations.extensionRoot, rollback.backupName, "5")),
      original,
    );
  });
});

test("a damaged metadata backup is reported without replacing the live document", async () => {
  await withHermeticEnvironment("prune-rollback-metadata-backup-damaged-", async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const original = await readFile(locations.mcpJsonPath);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
      removeBackup: rm,
    });
    const backup = path.join(locations.extensionRoot, rollback.backupName, "5");
    await rm(backup);
    await mkdir(backup);

    const failures = await rollback.rollback();

    assert.deepStrictEqual(
      failures.map(({ phase }) => phase),
      ["mcp"],
    );
    assert.deepStrictEqual(await readFile(locations.mcpJsonPath), original);
    assert.equal((await stat(backup)).isDirectory(), true);
  });
});

test("state restore refusal keeps the backup and reports state failure", async () => {
  await withHermeticEnvironment("prune-rollback-state-refusal-", async ({ cwd }) => {
    // arrange
    const locations = locationsFor("project", cwd);
    const fixture = await seed(locations);
    const rollback = await preparePruneRollback(locations, [fixture.member], {
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
