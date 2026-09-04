import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/discover.ts";

test("discovers flat markdown agents in source order with complete records", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-flat-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const agentsDirectory = path.join(directory, "agents");
  const nestedDirectory = path.join(agentsDirectory, "nested");
  await mkdir(nestedDirectory, { recursive: true });
  const helperPath = path.join(agentsDirectory, "a-helper.md");
  const fallbackPath = path.join(agentsDirectory, "z-last.md");
  const helperBytes = Buffer.from(
    "---\r\nname: acme-helper\r\ndescription: Helpful agent\r\ntools: Read, Write\r\n---\r\n\r\nHelp carefully.\r\n",
  );
  const fallbackBytes = Buffer.from("﻿Plain body\r\n");
  await writeFile(helperPath, helperBytes);
  await writeFile(fallbackPath, fallbackBytes);
  await writeFile(path.join(agentsDirectory, ".hidden.md"), "---\nname: hidden\n---\n");
  await writeFile(path.join(agentsDirectory, "notes.txt"), "not an agent\n");
  await writeFile(path.join(nestedDirectory, "nested.md"), "---\nname: nested\n---\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "acme-helper",
        generatedName: "pi-claude-marketplace-acme-helper",
        sourcePath: helperPath,
        sourceHash: "af6c30f084d68c095f606272c9e31a10f3aafc0e8796e2a167be6ebd46f8106c",
        raw: {
          name: "acme-helper",
          description: "Helpful agent",
          tools: "Read, Write",
        },
        body: "\nHelp carefully.\r\n",
      },
      {
        sourceName: "z-last",
        generatedName: "pi-claude-marketplace-acme-z-last",
        sourcePath: fallbackPath,
        sourceHash: "908a44e1f16dd6260a671a79b5a1c2280db6ba2f9edb78ad004009d4e3258894",
        raw: {},
        body: "﻿Plain body\r\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [agentsDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
  assert.strictEqual(Object.isFrozen(discovery.discovered), true);
  assert.strictEqual(Object.isFrozen(discovery.warnings), true);
});

test("skips a missing agents directory", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-missing-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const missingDirectory = path.join(directory, "missing", "agents");
  const expectedDiscovery = { discovered: [], warnings: [] };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [missingDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("skips an agents path below a regular file", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-not-directory-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const filePath = path.join(directory, "plugin.txt");
  await writeFile(filePath, "plugin source\n");
  const agentsPath = path.join(filePath, "agents");
  const expectedDiscovery = { discovered: [], warnings: [] };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [agentsPath],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("rejects an unreadable markdown entry with the filesystem error", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-unreadable-"));
  const sourcePath = path.join(directory, "private.md");
  t.after(async () => {
    await chmod(sourcePath, 0o600).catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
  });
  await writeFile(sourcePath, "---\nname: private\n---\nbody\n");
  await chmod(sourcePath, 0o000);

  // act & assert
  await assert.rejects(
    () => discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          name: error.name,
          message: error.message,
          code: (error as NodeJS.ErrnoException).code,
          path: (error as NodeJS.ErrnoException).path,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        {
          name: "Error",
          message: `EACCES: permission denied, open '${sourcePath}'`,
          code: "EACCES",
          path: sourcePath,
          syscall: "open",
        },
      );
      return true;
    },
  );
});

test("skips a symlinked markdown entry without following its target", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-symlink-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const agentsDirectory = path.join(directory, "agents");
  await mkdir(agentsDirectory, { recursive: true });
  const outsidePath = path.join(directory, "outside.md");
  const sourcePath = path.join(agentsDirectory, "kept.md");
  await writeFile(outsidePath, "---\nname: outside\n---\noutside body\n");
  await symlink(outsidePath, path.join(agentsDirectory, "linked.md"));
  await writeFile(sourcePath, "---\nname: kept\n---\nkept body\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "kept",
        generatedName: "pi-claude-marketplace-acme-kept",
        sourcePath,
        sourceHash: "bbe7287acdb000edf946936f859dbe1acdd8b6d7f74032fbc27b0c9050c591b9",
        raw: { name: "kept" },
        body: "kept body\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [agentsDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("keeps the first generated name across agent directories and reports the duplicate", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-duplicate-dirs-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const firstDirectory = path.join(directory, "first");
  const secondDirectory = path.join(directory, "second");
  await mkdir(firstDirectory, { recursive: true });
  await mkdir(secondDirectory, { recursive: true });
  const firstPath = path.join(firstDirectory, "shared.md");
  await writeFile(firstPath, "---\nname: shared\ntools: Read\n---\nfirst body\n");
  await writeFile(
    path.join(secondDirectory, "shared.md"),
    "---\nname: shared\ntools: Write\n---\nsecond body\n",
  );
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "shared",
        generatedName: "pi-claude-marketplace-acme-shared",
        sourcePath: firstPath,
        sourceHash: "b3cb6f4230d18ef3de5efe1044403c789ee53585128c72ce45883660a361453d",
        raw: { name: "shared", tools: "Read" },
        body: "first body\n",
      },
    ],
    warnings: [
      `agent source "shared" in "${secondDirectory}" elides to generated name "pi-claude-marketplace-acme-shared" already produced by an earlier componentPaths.agents entry; ignoring duplicate.`,
    ],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [firstDirectory, secondDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("keeps the first source when distinct names collide after plugin-prefix elision", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-elided-collision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const firstPath = path.join(directory, "a-prefixed.md");
  await writeFile(firstPath, "---\nname: acme-reviewer\n---\nfirst\n");
  await writeFile(path.join(directory, "b-short.md"), "---\nname: reviewer\n---\nsecond\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "acme-reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath: firstPath,
        sourceHash: "4f1a28213ca1cd2f183a5679dd53221a9a7842eab3f713a0626cddecce6bfe65",
        raw: { name: "acme-reviewer" },
        body: "first\n",
      },
    ],
    warnings: [
      `agent source "reviewer" in "${directory}" elides to generated name "pi-claude-marketplace-acme-reviewer" already produced by an earlier componentPaths.agents entry; ignoring duplicate.`,
    ],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [directory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("rejects a source name that elides to an empty generated suffix", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-empty-elision-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  await writeFile(path.join(directory, "empty.md"), "---\nname: acme-\n---\nbody\n");

  // act & assert
  await assert.rejects(
    () => discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] }),
    { name: "Error", message: "Name must be a non-empty string." },
  );
});
