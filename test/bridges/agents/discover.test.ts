import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { discoverPluginAgents } from "../../../extensions/pi-claude-marketplace/bridges/agents/discover.ts";

for (const { title, firstFile, secondFile, firstBytes, raw } of [
  {
    title: "same-directory frontmatter names",
    firstFile: "a-first.md",
    secondFile: "z-second.md",
    firstBytes: "---\nname: shared\ntools: Read\n---\nfirst body\n",
    raw: { name: "shared", tools: "Read" },
  },
  {
    title: "filename fallback names",
    firstFile: "shared.md",
    secondFile: "z-second.md",
    firstBytes: "first body\n",
    raw: {},
  },
]) {
  test(`keeps the first exact source for ${title} with both complete paths`, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-exact-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const firstPath = path.join(directory, firstFile);
    const secondPath = path.join(directory, secondFile);
    await writeFile(firstPath, firstBytes);
    await writeFile(secondPath, "---\nname: shared\n---\nsecond body\n");

    // act
    const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

    // assert
    assert.deepStrictEqual(discovery, {
      discovered: [
        {
          sourceName: "shared",
          generatedName: "pi-claude-marketplace-acme-shared",
          sourcePath: firstPath,
          sourceHash: createHash("sha256").update(firstBytes).digest("hex"),
          raw,
          body: "first body\n",
        },
      ],
      warnings: [
        `agent source "shared" at "${secondPath}" duplicates generated name "pi-claude-marketplace-acme-shared" already produced by agent source "shared" at "${firstPath}"; keeping first discovered source.`,
      ],
    });
  });
}

test("discovers markdown agents in walk order with complete records", async (t) => {
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
  const fallbackBytes = Buffer.from("\uFEFFPlain body\r\n");
  await writeFile(helperPath, helperBytes);
  await writeFile(fallbackPath, fallbackBytes);
  await writeFile(path.join(agentsDirectory, ".hidden.md"), "---\nname: hidden\n---\n");
  await writeFile(path.join(agentsDirectory, "notes.txt"), "not an agent\n");
  await writeFile(path.join(nestedDirectory, "nested.md"), "---\nname: nested\n---\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "hidden",
        generatedName: "pi-claude-marketplace-acme-hidden",
        sourcePath: path.join(agentsDirectory, ".hidden.md"),
        sourceHash: createHash("sha256").update("---\nname: hidden\n---\n").digest("hex"),
        raw: { name: "hidden" },
        body: "",
      },
      {
        sourceName: "acme-helper",
        generatedName: "pi-claude-marketplace-acme-acme-helper",
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
        sourceName: "nested",
        generatedName: "pi-claude-marketplace-acme-nested-nested",
        sourcePath: path.join(nestedDirectory, "nested.md"),
        namespace: ["nested"],
        sourceHash: createHash("sha256").update("---\nname: nested\n---\n").digest("hex"),
        raw: { name: "nested" },
        body: "",
      },
      {
        sourceName: "z-last",
        generatedName: "pi-claude-marketplace-acme-z-last",
        sourcePath: fallbackPath,
        sourceHash: "908a44e1f16dd6260a671a79b5a1c2280db6ba2f9edb78ad004009d4e3258894",
        raw: {},
        body: "Plain body\r\n",
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

test("returns a folded block scalar description without phantom frontmatter keys", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-block-scalar-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const sourcePath = path.join(directory, "reviewer.md");
  await writeFile(
    sourcePath,
    "---\nname: reviewer\ndescription: >\n  Reviews files and reports: findings\n  across the whole change set.\ntools: Read\n---\n\nReview carefully.\n",
  );
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath,
        sourceHash: "fca7cd3ceee8b02918d14b216520c9ad86c572d69e21068a1308c57e2e79edd1",
        raw: {
          name: "reviewer",
          description: "Reviews files and reports: findings across the whole change set.",
          tools: "Read",
        },
        body: "\nReview carefully.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [directory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
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
      `agent source "shared" at "${path.join(secondDirectory, "shared.md")}" duplicates generated name "pi-claude-marketplace-acme-shared" already produced by agent source "shared" at "${firstPath}"; keeping first discovered source.`,
    ],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [firstDirectory, secondDirectory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);

  // act
  const reversed = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [secondDirectory, firstDirectory],
  });

  // assert
  assert.deepStrictEqual(reversed, {
    discovered: [
      {
        sourceName: "shared",
        generatedName: "pi-claude-marketplace-acme-shared",
        sourcePath: path.join(secondDirectory, "shared.md"),
        sourceHash: createHash("sha256")
          .update("---\nname: shared\ntools: Write\n---\nsecond body\n")
          .digest("hex"),
        raw: { name: "shared", tools: "Write" },
        body: "second body\n",
      },
    ],
    warnings: [
      `agent source "shared" at "${firstPath}" duplicates generated name "pi-claude-marketplace-acme-shared" already produced by agent source "shared" at "${path.join(secondDirectory, "shared.md")}"; keeping first discovered source.`,
    ],
  });
});

test("preserves distinct complete source names without a duplicate warning", async (t) => {
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
        generatedName: "pi-claude-marketplace-acme-acme-reviewer",
        sourcePath: firstPath,
        sourceHash: "4f1a28213ca1cd2f183a5679dd53221a9a7842eab3f713a0626cddecce6bfe65",
        raw: { name: "acme-reviewer" },
        body: "first\n",
      },
      {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath: path.join(directory, "b-short.md"),
        sourceHash: "a96ad208a08c2fc9202cf2f508546375d92fa6c9fd24fc446953700012aa838c",
        raw: { name: "reviewer" },
        body: "second\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [directory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("preserves a valid source ending in its plugin prefix", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-full-prefix-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const sourcePath = path.join(directory, "empty.md");
  await writeFile(sourcePath, "---\nname: acme-\n---\nbody\n");

  // act
  const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

  // assert
  assert.deepStrictEqual(discovery, {
    discovered: [
      {
        sourceName: "acme-",
        generatedName: "pi-claude-marketplace-acme-acme-",
        sourcePath,
        sourceHash: "ff73ae6922b6dba7d5df325776d0e132ac109ae7c16ede7ecf55ca02793e736b",
        raw: { name: "acme-" },
        body: "body\n",
      },
    ],
    warnings: [],
  });
});

test("resolves the frontmatter name of a source led by a byte-order mark", async (t) => {
  // arrange
  // FMBOM-01: without the strip the anchored fence match fails, so `sourceName`
  // falls back to the filename stem and the whole `---` block survives in
  // `body`, where `convert.ts` emits it verbatim into the generated agent.
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-bom-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const sourcePath = path.join(directory, "file-stem.md");
  await writeFile(
    sourcePath,
    "\uFEFF---\nname: reviewer\ndescription: Reviews changes\ntools: Read\n---\nReview carefully.\n",
  );
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "reviewer",
        generatedName: "pi-claude-marketplace-acme-reviewer",
        sourcePath,
        sourceHash: "e69c9a6c7c0603ba59e497163b9a88b9a8997753f02ccf6838d4de49d0af620f",
        raw: {
          name: "reviewer",
          description: "Reviews changes",
          tools: "Read",
        },
        body: "Review carefully.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [directory],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

// Writes `text` at `file` below `root`, creating its folders, and returns its path.
async function writeAgentFile(root: string, file: string, text: string): Promise<string> {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, text);
  return target;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

test("D-CF4-01 names a nested file after its folders and keeps a frontmatter name last", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-nested-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const securityPath = await writeAgentFile(directory, "review/security.md", "Check security.\n");
  const nestedPath = await writeAgentFile(
    directory,
    "review/deep/nested.md",
    "---\nname: nested-x\n---\nReview deeply.\n",
  );
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "nested-x",
        generatedName: "pi-claude-marketplace-acme-review-deep-nested-x",
        sourcePath: nestedPath,
        namespace: ["review", "deep"],
        sourceHash: sha256("---\nname: nested-x\n---\nReview deeply.\n"),
        raw: { name: "nested-x" },
        body: "Review deeply.\n",
      },
      {
        sourceName: "security",
        generatedName: "pi-claude-marketplace-acme-review-security",
        sourcePath: securityPath,
        namespace: ["review"],
        sourceHash: sha256("Check security.\n"),
        raw: {},
        body: "Check security.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF4-01 finds dotfiles, dot-folders, and an upper-case extension but not other files", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-dotfiles-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const hiddenPath = await writeAgentFile(directory, ".hidden.md", "Hidden.\n");
  const insidePath = await writeAgentFile(directory, ".hiddendir/inside.md", "Inside.\n");
  const upperPath = await writeAgentFile(directory, "UPPER.MD", "Upper.\n");
  await writeAgentFile(directory, "notes.txt", "Notes.\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: ".hidden",
        generatedName: "pi-claude-marketplace-acme-.hidden",
        sourcePath: hiddenPath,
        sourceHash: sha256("Hidden.\n"),
        raw: {},
        body: "Hidden.\n",
      },
      {
        sourceName: "inside",
        generatedName: "pi-claude-marketplace-acme-.hiddendir-inside",
        sourcePath: insidePath,
        namespace: [".hiddendir"],
        sourceHash: sha256("Inside.\n"),
        raw: {},
        body: "Inside.\n",
      },
      {
        sourceName: "UPPER.MD",
        generatedName: "pi-claude-marketplace-acme-UPPER.MD",
        sourcePath: upperPath,
        sourceHash: sha256("Upper.\n"),
        raw: {},
        body: "Upper.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF4-01 skips a symlinked folder without following it", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-symlink-dir-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const agentsDirectory = path.join(directory, "agents");
  await writeAgentFile(directory, "outside/linked.md", "Outside.\n");
  const keptPath = await writeAgentFile(agentsDirectory, "kept.md", "Kept.\n");
  await symlink(path.join(directory, "outside"), path.join(agentsDirectory, "linked"));
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "kept",
        generatedName: "pi-claude-marketplace-acme-kept",
        sourcePath: keptPath,
        sourceHash: sha256("Kept.\n"),
        raw: {},
        body: "Kept.\n",
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

test("D-CF4-01 finds a file 31 folders deep and does not read a folder 32 deep", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-depth-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const folders = Array.from({ length: 31 }, () => "d");
  const foundPath = await writeAgentFile(directory, path.join(...folders, "found.md"), "Found.\n");
  await writeAgentFile(directory, path.join(...folders, "d", "lost.md"), "Lost.\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "found",
        generatedName: `pi-claude-marketplace-acme-${folders.join("-")}-found`,
        sourcePath: foundPath,
        namespace: folders,
        sourceHash: sha256("Found.\n"),
        raw: {},
        body: "Found.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF4-01 keeps a declared file's bare name and walks a declared folder", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-declared-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const declaredPath = await writeAgentFile(directory, "custom/review/security.md", "Secure.\n");
  const walkedPath = await writeAgentFile(directory, "more/review/audit.md", "Audit.\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "security",
        generatedName: "pi-claude-marketplace-acme-security",
        sourcePath: declaredPath,
        sourceHash: sha256("Secure.\n"),
        raw: {},
        body: "Secure.\n",
      },
      {
        sourceName: "audit",
        generatedName: "pi-claude-marketplace-acme-review-audit",
        sourcePath: walkedPath,
        namespace: ["review"],
        sourceHash: sha256("Audit.\n"),
        raw: {},
        body: "Audit.\n",
      },
    ],
    warnings: [],
  };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [declaredPath, path.join(directory, "more")],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF4-01 finds no agent at a declared symlink, upper-case file, or missing file", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-declared-none-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const targetPath = await writeAgentFile(directory, "real/target.md", "Target.\n");
  const linkPath = path.join(directory, "link.md");
  await symlink(targetPath, linkPath);
  const upperPath = await writeAgentFile(directory, "custom/UPPER.MD", "Upper.\n");
  const filePath = await writeAgentFile(directory, "plugin.txt", "Plugin.\n");
  const expectedDiscovery = { discovered: [], warnings: [] };

  // act
  const discovery = await discoverPluginAgents({
    pluginName: "acme",
    agentsDirs: [
      linkPath,
      upperPath,
      path.join(directory, "missing.md"),
      path.join(filePath, "below.md"),
    ],
  });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});

test("D-CF4-01 rejects a declared file path the filesystem cannot inspect", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-declared-error-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const longPath = path.join(directory, `${"a".repeat(300)}.md`);

  // act & assert
  await assert.rejects(
    () => discoverPluginAgents({ pluginName: "acme", agentsDirs: [longPath] }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        {
          code: (error as NodeJS.ErrnoException).code,
          syscall: (error as NodeJS.ErrnoException).syscall,
        },
        { code: "ENAMETOOLONG", syscall: "lstat" },
      );
      return true;
    },
  );
});

test("AG-12 keeps a nested file over the flat file its folder name flattens onto", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(tmpdir(), "agent-discover-flattened-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 3 }));
  const nestedPath = await writeAgentFile(directory, "review/security.md", "Nested.\n");
  const flatPath = await writeAgentFile(directory, "review-security.md", "Flat.\n");
  const expectedDiscovery = {
    discovered: [
      {
        sourceName: "security",
        generatedName: "pi-claude-marketplace-acme-review-security",
        sourcePath: nestedPath,
        namespace: ["review"],
        sourceHash: sha256("Nested.\n"),
        raw: {},
        body: "Nested.\n",
      },
    ],
    warnings: [
      `agent source "review-security" at "${flatPath}" duplicates generated name "pi-claude-marketplace-acme-review-security" already produced by agent source "security" at "${nestedPath}"; keeping first discovered source.`,
    ],
  };

  // act
  const discovery = await discoverPluginAgents({ pluginName: "acme", agentsDirs: [directory] });

  // assert
  assert.deepStrictEqual(discovery, expectedDiscovery);
});
