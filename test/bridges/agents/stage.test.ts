import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test, type TestContext } from "node:test";

import {
  abortPreparedAgents,
  assertAgentCommitTargets,
  commitPreparedAgents,
  prepareStagePluginAgents,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/stage.ts";
import { loadAgentsIndex } from "../../../extensions/pi-claude-marketplace/persistence/agents-index-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { AgentOwnershipConflictError } from "../../../extensions/pi-claude-marketplace/shared/errors-bridges.ts";
import { createRemovalOps } from "../../../extensions/pi-claude-marketplace/shared/fs-utils.ts";
import { PathContainmentError } from "../../../extensions/pi-claude-marketplace/shared/path-safety.ts";

import { ADAPTER_ASYNC, BUILTIN_ASYNC } from "./agent-grant-seeds.ts";

import type {
  AgentsIndex,
  AgentsIndexEntry,
} from "../../../extensions/pi-claude-marketplace/persistence/agents-index-schema.ts";

const BOT_QUERY_SOURCE =
  "---\nname: bot\ndescription: Bot\ntools: Read, mcp__plugin_acme_db__query\n---\n\nBody.\n";

const BOT_QUERY_SOURCE_HASH = createHash("sha256").update(BOT_QUERY_SOURCE).digest("hex");

/** The frontmatter block of `BOT_QUERY_SOURCE` in one MCP implementation's grant form. */
function botQueryFrontmatter(sourcePath: string, form: "adapter" | "builtin"): string {
  const selector = form === "builtin" ? "mcp:plugin_acme_db/query" : "mcp:plugin_acme_db_/query";
  const asyncWarning = form === "builtin" ? BUILTIN_ASYNC : ADAPTER_ASYNC;
  return `---\nname: acme:bot\ndescription: Bot\naliases: pi-claude-marketplace-acme-bot\ntools: read,${selector}\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nadvertise: true\nasync: true\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: bot\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings:\n    - ${asyncWarning}\n---\n`;
}

/** An agents-index row of another plugin that records both grant forms (MGRT-01). */
function otherPluginRowWithForms(targetPath: string): AgentsIndexEntry {
  return {
    plugin: "other",
    marketplace: "catalog",
    sourceAgent: "bot",
    generatedName: "pi-claude-marketplace-other-bot",
    sourcePath: "/plugins/other/agents/bot.md",
    targetPath,
    sourceHash: "other-hash",
    droppedFields: [],
    droppedTools: ["mcp__plugin_other_web__get"],
    warnings: [],
    mcpImplementation: "builtin",
    mcpForms: {
      builtin: {
        frontmatter: "---\nother builtin\n---\n",
        warnings: [],
        droppedTools: ["mcp__plugin_other_web__get"],
      },
      adapter: {
        frontmatter: "---\nother adapter\n---\n",
        warnings: ["other adapter warning"],
        droppedTools: [],
      },
    },
  };
}

async function createStageTree(t: TestContext, prefix: string) {
  const scopeRoot = await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const pluginRoot = path.join(scopeRoot, "plugin");
  const agentsSourceDir = path.join(pluginRoot, "agents");
  await mkdir(agentsSourceDir, { recursive: true });
  const locations = locationsFor("project", scopeRoot);
  const pluginDataDir = path.join(locations.dataRoot, "catalog", "acme");
  return { scopeRoot, pluginRoot, agentsSourceDir, locations, pluginDataDir };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

describe("prepareStagePluginAgents", () => {
  test("stages the first same-directory exact duplicate with full winner provenance", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-exact-duplicate-",
    );
    const winnerPath = path.join(agentsSourceDir, "a-first.md");
    const incomingPath = path.join(agentsSourceDir, "z-second.md");
    const sourceBytes =
      "---\nname: reviewer\ndescription: Reviewer\ntools: Read\n---\n\nFirst body.\n";
    await writeFile(winnerPath, sourceBytes);
    await writeFile(
      incomingPath,
      "---\nname: reviewer\ndescription: Duplicate\ntools: Write\n---\n\nLater body.\n",
    );
    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md");

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    const leak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(leak, undefined);
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["pi-claude-marketplace-acme-reviewer"],
      recorded: [
        {
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: winnerPath,
          targetPath,
        },
      ],
      warnings: [
        {
          kind: "discovery",
          message: `agent source "reviewer" at "${incomingPath}" duplicates generated name "pi-claude-marketplace-acme-reviewer" already produced by agent source "reviewer" at "${winnerPath}"; keeping first discovered source.`,
        },
      ],
      failed: [],
    });
    assert.strictEqual(
      await readFile(targetPath, "utf8"),
      `---\nname: acme:reviewer\ndescription: Reviewer\naliases: pi-claude-marketplace-acme-reviewer\ntools: read\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nadvertise: true\nasync: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: reviewer\n  sourcePath: ${winnerPath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\nFirst body.\n`,
    );
    assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: winnerPath,
          targetPath,
          sourceHash: createHash("sha256").update(sourceBytes).digest("hex"),
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    });
  });

  test("ANAME-02: passes the written MCP server names to conversion and reports the async warning", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-mcp-",
    );
    await writeFile(
      path.join(agentsSourceDir, "bot.md"),
      "---\nname: bot\ndescription: Bot\ntools: Read, mcp__plugin_acme_db__query, mcp__plugin_acme_web__get\n---\n\nBody.\n",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
    });

    // assert
    assert.deepStrictEqual(prepared.result.warnings, [
      {
        kind: "hygiene",
        message:
          "[bot] tools include MCP tools, which pi-subagents serves only to background children -- the agent runs in the background (`async: true`), where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails",
      },
      { kind: "hygiene", message: "[bot] dropped tools: mcp__plugin_acme_web__get" },
    ]);
  });

  test("MGRT-01: a built-in staging writes the built-in form and records both forms on a row the loader keeps", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-grant-forms-",
    );
    const sourcePath = path.join(agentsSourceDir, "bot.md");
    await writeFile(sourcePath, BOT_QUERY_SOURCE);
    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const builtinFrontmatter = botQueryFrontmatter(sourcePath, "builtin");
    const expectedRow = {
      plugin: "acme",
      marketplace: "catalog",
      sourceAgent: "bot",
      generatedName: "pi-claude-marketplace-acme-bot",
      sourcePath,
      targetPath,
      sourceHash: BOT_QUERY_SOURCE_HASH,
      droppedFields: [],
      droppedTools: [],
      warnings: [BUILTIN_ASYNC],
      mcpImplementation: "builtin",
      mcpForms: {
        builtin: {
          frontmatter: builtinFrontmatter,
          warnings: [BUILTIN_ASYNC],
          droppedTools: [],
        },
        adapter: {
          frontmatter: botQueryFrontmatter(sourcePath, "adapter"),
          warnings: [ADAPTER_ASYNC],
          droppedTools: [],
        },
      },
    };

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
      mcpGrantForms: { active: "builtin", declaredMcpServers: { db: { command: "node" } } },
    });
    const leak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(leak, undefined);
    assert.deepStrictEqual(prepared.result.warnings, [
      { kind: "hygiene", message: `[bot] ${BUILTIN_ASYNC}` },
    ]);
    assert.strictEqual(await readFile(targetPath, "utf8"), `${builtinFrontmatter}\nBody.\n`);
    assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
      schemaVersion: 1,
      agents: [expectedRow],
    });
    assert.deepStrictEqual(await loadAgentsIndex(locations), {
      schemaVersion: 1,
      agents: [expectedRow],
      corruptions: [],
    });
  });

  test("MGRT-01: a built-in staging reports the built-in async warning and the built-in form's dropped tools", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-grant-forms-warnings-",
    );
    await writeFile(
      path.join(agentsSourceDir, "bot.md"),
      "---\nname: bot\ndescription: Bot\ntools: Read, mcp__plugin_acme_db__query, mcp__plugin_acme_web__get\n---\n\nBody.\n",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db", "web"],
      mcpGrantForms: {
        active: "builtin",
        declaredMcpServers: {
          db: { command: "node" },
          web: { type: "sse", url: "https://web.example/sse" },
        },
      },
    });

    // assert
    assert.deepStrictEqual(prepared.result.warnings, [
      { kind: "hygiene", message: `[bot] ${BUILTIN_ASYNC}` },
      { kind: "hygiene", message: "[bot] dropped tools: mcp__plugin_acme_web__get" },
    ]);
  });

  test("AS-9: stays a no-op with grant forms when no agent is discovered", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-grant-forms-noop-",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
      mcpGrantForms: { active: "builtin", declaredMcpServers: { db: { command: "node" } } },
    });

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
    });
    assert.strictEqual(await exists(locations.agentsStagingDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });

  test("returns a frozen no-op result when no agents component is declared", async (t) => {
    // arrange
    const { pluginRoot, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-no-component-",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [],
    });

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
    });
    assert.strictEqual(Object.isFrozen(prepared.result.stagedNames), true);
    assert.strictEqual(Object.isFrozen(prepared.result.recorded), true);
    assert.strictEqual(Object.isFrozen(prepared.result.warnings), true);
    assert.strictEqual(Object.isFrozen(prepared.result.failed), true);
    assert.strictEqual(await exists(locations.agentsStagingDir), false);
  });

  test("keeps an empty agents directory as a no-op without materializing agent paths", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-empty-",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      knownSkills: [],
    });
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.deepStrictEqual(prepared, {
      kind: "noop",
      result: { stagedNames: [], recorded: [], warnings: [], failed: [] },
    });
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await exists(locations.agentsDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });

  test("stages every ordered agent directory and keeps the first cross-directory duplicate", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-multiple-dirs-",
    );
    const generatedAgentsDir = path.join(pluginRoot, "generated-agents");
    await mkdir(generatedAgentsDir, { recursive: true });
    const firstSharedPath = path.join(agentsSourceDir, "shared.md");
    const duplicateSharedPath = path.join(generatedAgentsDir, "shared.md");
    const builderPath = path.join(generatedAgentsDir, "builder.md");
    await writeFile(
      firstSharedPath,
      "---\nname: shared\ndescription: First shared agent\ntools: Read\n---\n\nFirst.\n",
    );
    await writeFile(
      duplicateSharedPath,
      "---\nname: shared\ndescription: Later shared agent\ntools: Read\n---\n\nLater.\n",
    );
    await writeFile(
      builderPath,
      "---\nname: builder\ndescription: Builder agent\ntools: Read\n---\n\nBuild.\n",
    );

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir, generatedAgentsDir],
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["pi-claude-marketplace-acme-shared", "pi-claude-marketplace-acme-builder"],
      recorded: [
        {
          generatedName: "pi-claude-marketplace-acme-shared",
          sourcePath: firstSharedPath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-shared.md"),
        },
        {
          generatedName: "pi-claude-marketplace-acme-builder",
          sourcePath: builderPath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-builder.md"),
        },
      ],
      warnings: [
        {
          kind: "discovery",
          message: `agent source "shared" at "${duplicateSharedPath}" duplicates generated name "pi-claude-marketplace-acme-shared" already produced by agent source "shared" at "${firstSharedPath}"; keeping first discovered source.`,
        },
      ],
      failed: [],
    });
    assert.strictEqual(await exists(duplicateSharedPath), true);
  });

  test("stages the complete agent-family records and generated bytes", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-family-",
    );
    const helperSource = `---
name: acme-helper
description: Helper agent
tools: Read,Grep
---

Helper body.
`;
    const botSource = `---
name: bot
description: A bot agent
model: sonnet
tools: Read,Bash,Edit
---

You are a bot. Read from \${CLAUDE_PLUGIN_ROOT}/data and \${CLAUDE_PROJECT_DIR}.
`;
    const helperSourcePath = path.join(agentsSourceDir, "acme-helper.md");
    const botSourcePath = path.join(agentsSourceDir, "bot.md");
    const helperTargetPath = path.join(
      locations.agentsDir,
      "pi-claude-marketplace-acme-acme-helper.md",
    );
    const botTargetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const expectedHelperBytes = `---
name: acme:acme-helper
description: Helper agent
aliases: pi-claude-marketplace-acme-acme-helper
tools: read,grep
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: acme-helper
  sourcePath: ${helperSourcePath}
  droppedFields: []
  droppedTools: []
  warnings: []
---

Helper body.
`;
    const expectedBotBytes = `---
name: acme:bot
description: A bot agent
aliases: pi-claude-marketplace-acme-bot
model: anthropic/claude-sonnet-5-5
tools: read,bash,edit
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: ${botSourcePath}
  originalModel: sonnet
  droppedFields: []
  droppedTools: []
  warnings: []
---

You are a bot. Read from ${pluginRoot}/data and ${locations.scopeRoot}.
`;
    await writeFile(helperSourcePath, helperSource);
    await writeFile(botSourcePath, botSource);

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      knownSkills: ["acme-helper"],
      mapModel: true,
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["pi-claude-marketplace-acme-acme-helper", "pi-claude-marketplace-acme-bot"],
      recorded: [
        {
          generatedName: "pi-claude-marketplace-acme-acme-helper",
          sourcePath: helperSourcePath,
          targetPath: helperTargetPath,
        },
        {
          generatedName: "pi-claude-marketplace-acme-bot",
          sourcePath: botSourcePath,
          targetPath: botTargetPath,
        },
      ],
      warnings: [],
      failed: [],
    });
    assert.deepStrictEqual(await readdir(prepared.stagingDir), [
      "pi-claude-marketplace-acme-acme-helper.md",
      "pi-claude-marketplace-acme-bot.md",
    ]);
    assert.strictEqual(
      await readFile(
        path.join(prepared.stagingDir, "pi-claude-marketplace-acme-acme-helper.md"),
        "utf8",
      ),
      expectedHelperBytes,
    );
    assert.strictEqual(
      await readFile(path.join(prepared.stagingDir, "pi-claude-marketplace-acme-bot.md"), "utf8"),
      expectedBotBytes,
    );
  });

  test("leaves the project-directory token literal in user scope", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-user-scope-",
    );
    const sourcePath = path.join(agentsSourceDir, "user-agent.md");
    await writeFile(
      sourcePath,
      "---\nname: user-agent\ndescription: User agent\ntools: Read\n---\n\nRead ${CLAUDE_PROJECT_DIR} and ${CLAUDE_PLUGIN_ROOT}.\n",
    );
    const userLocations = { ...locations, scope: "user" as const };

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations: userLocations,
      cwd: userLocations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.strictEqual(
      await readFile(
        path.join(prepared.stagingDir, "pi-claude-marketplace-acme-user-agent.md"),
        "utf8",
      ),
      `---
name: acme:user-agent
description: User agent
aliases: pi-claude-marketplace-acme-user-agent
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: user-agent
  sourcePath: ${sourcePath}
  droppedFields: []
  droppedTools: []
  warnings: []
---

Read \${CLAUDE_PROJECT_DIR} and ${pluginRoot}.
`,
    );
    assert.strictEqual(await abortPreparedAgents(createRemovalOps(), prepared), undefined);
  });

  test("D-CF4-04: stages an agent that preloads a staged skill with the skill's content", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-preload-",
    );
    const sourcePath = path.join(agentsSourceDir, "bot.md");
    await writeFile(
      sourcePath,
      "---\nname: bot\ndescription: Bot\ntools: Read\nskills: rules\n---\n\nBot body.\n",
    );
    const skillSource = path.join(pluginRoot, "skills", "rules");
    await mkdir(skillSource, { recursive: true });
    await writeFile(
      path.join(skillSource, "SKILL.md"),
      "---\ndescription: The rules.\n---\nWork in ${CLAUDE_PROJECT_DIR}; see acme:rules.\n",
    );
    const skillTarget = path.join(locations.skillsTargetDir, "acme-rules");

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: "/work/app",
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      knownSkills: ["acme-rules"],
      referenceNames: { skills: ["acme-rules"], commands: [], workflows: [] },
      skillSources: [
        { generatedName: "acme-rules", sourcePath: skillSource, targetPath: skillTarget },
      ],
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.strictEqual(
      await readFile(path.join(prepared.stagingDir, "pi-claude-marketplace-acme-bot.md"), "utf8"),
      `---
name: acme:bot
description: Bot
aliases: pi-claude-marketplace-acme-bot
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: ${sourcePath}
  droppedFields: []
  droppedTools: []
  warnings: []
---

Bot body.

Base directory for this skill: ${skillTarget}

Work in /work/app; see /skill:acme-rules.
`,
    );
    assert.strictEqual(await abortPreparedAgents(createRemovalOps(), prepared), undefined);
  });

  test("D-CF4-04: stages without reading a skill source when no agent declares skills", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-no-preload-",
    );
    const sourcePath = path.join(agentsSourceDir, "bot.md");
    await writeFile(
      sourcePath,
      "---\nname: bot\ndescription: Bot\ntools: Read\n---\n\nBot body.\n",
    );
    const missingSource = path.join(pluginRoot, "skills", "missing");

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      knownSkills: ["acme-missing"],
      skillSources: [
        {
          generatedName: "acme-missing",
          sourcePath: missingSource,
          targetPath: path.join(locations.skillsTargetDir, "acme-missing"),
        },
      ],
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.strictEqual(
      await readFile(path.join(prepared.stagingDir, "pi-claude-marketplace-acme-bot.md"), "utf8"),
      `---
name: acme:bot
description: Bot
aliases: pi-claude-marketplace-acme-bot
tools: read
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: ${sourcePath}
  droppedFields: []
  droppedTools: []
  warnings: []
---

Bot body.
`,
    );
    assert.strictEqual(await abortPreparedAgents(createRemovalOps(), prepared), undefined);
  });

  test("D-PL1-02: tags index and conversion warnings hygiene and duplicates discovery, in stable order", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-warnings-",
    );
    const firstSourcePath = path.join(agentsSourceDir, "first.md");
    const duplicateSourcePath = path.join(agentsSourceDir, "second.md");
    const noisySource = `---
name: noisy
description: Noisy agent
model: future-model
tools: Read,WebFetch
priority: high
---

Noisy body.
`;
    await writeFile(firstSourcePath, noisySource);
    await writeFile(
      duplicateSourcePath,
      `---
name: noisy
description: Duplicate agent
tools: Read
---

Duplicate body.
`,
    );
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      `${JSON.stringify({ schemaVersion: 1, agents: [{ plugin: "broken" }] }, null, 2)}\n`,
    );
    const generatedName = "pi-claude-marketplace-acme-noisy";
    const expectedWarnings = [
      {
        kind: "hygiene",
        message: `agent index corruption (entry dropped): ${locations.agentsIndexPath}.agents[0]: row failed schema validation (entry dropped) -- <root>: must have required properties marketplace, sourceAgent, generatedName, sourcePath, targetPath, sourceHash, droppedFields, droppedTools, warnings`,
      },
      {
        kind: "hygiene",
        message: '[noisy] unknown model "future-model" -- omitted from generated frontmatter',
      },
      { kind: "hygiene", message: "[noisy] dropped fields: priority" },
      { kind: "hygiene", message: "[noisy] dropped tools: WebFetch" },
      {
        kind: "discovery",
        message: `agent source "noisy" at "${duplicateSourcePath}" duplicates generated name "${generatedName}" already produced by agent source "noisy" at "${firstSourcePath}"; keeping first discovered source.`,
      },
    ];

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mapModel: true,
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, {
      stagedNames: [generatedName],
      recorded: [
        {
          generatedName,
          sourcePath: firstSourcePath,
          targetPath: path.join(locations.agentsDir, `${generatedName}.md`),
        },
      ],
      warnings: expectedWarnings,
      failed: [],
    });
  });

  test("keeps guided dropped fields off the summary line while unguided ones stay on it", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-guided-",
    );
    const sourcePath = path.join(agentsSourceDir, "mixed.md");
    await writeFile(
      sourcePath,
      `---
name: mixed
description: Mixed agent
tools: Read
priority: high
mcpServers: echo
---

Mixed body.
`,
    );
    // The override key is the agent's DECLARED name -- what pi-subagents
    // resolves it by -- not the basename it is stored under.
    const declaredName = "acme:mixed";
    const expectedWarnings = [
      {
        kind: "hygiene",
        message:
          "[mixed] agent-level `mcpServers` is not converted -- dropped (Claude Code ignores it for plugin agents too). " +
          `To grant this agent MCP tools, set subagents.agentOverrides["${declaredName}"].tools ` +
          "(e.g. read,bash,mcp:<server>) in Pi settings.",
      },
      { kind: "hygiene", message: "[mixed] dropped fields: priority" },
    ];

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mapModel: false,
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result.warnings, expectedWarnings);
  });

  test("surfaces every foreign previous target as a complete failure", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-foreign-",
    );
    const sourcePath = path.join(agentsSourceDir, "reviewer.md");
    await writeFile(
      sourcePath,
      `---
name: reviewer
description: Reviews files
tools: Read
---

Review files.
`,
    );
    const wrongBasenameTarget = path.join(locations.agentsDir, "manual-agent.md");
    const missingMarkerTarget = path.join(
      locations.agentsDir,
      "pi-claude-marketplace-acme-orphan.md",
    );
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(
      wrongBasenameTarget,
      "---\nname: manual-agent\n---\ngeneratedBy: pi-claude-marketplace\n",
    );
    await writeFile(missingMarkerTarget, "---\nname: orphan\n---\nManual bytes.\n");
    const index: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "manual-agent",
          generatedName: "pi-claude-marketplace-acme-manual-agent",
          sourcePath: "/previous/manual-agent.md",
          targetPath: wrongBasenameTarget,
          sourceHash: "hash-manual",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "orphan",
          generatedName: "pi-claude-marketplace-acme-orphan",
          sourcePath: "/previous/orphan.md",
          targetPath: missingMarkerTarget,
          sourceHash: "hash-orphan",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.agentsIndexPath, `${JSON.stringify(index, null, 2)}\n`);

    // act
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // assert
    assert.strictEqual(prepared.kind, "staged");
    assert.deepStrictEqual(prepared.result, {
      stagedNames: ["pi-claude-marketplace-acme-reviewer"],
      recorded: [
        {
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md"),
        },
      ],
      warnings: [],
      failed: [
        {
          generatedName: "pi-claude-marketplace-acme-manual-agent",
          targetPath: wrongBasenameTarget,
          reason: 'target filename "manual-agent.md" does not start with "pi-claude-marketplace-"',
        },
        {
          generatedName: "pi-claude-marketplace-acme-orphan",
          targetPath: missingMarkerTarget,
          reason: `target ${missingMarkerTarget} is missing the generated marker`,
        },
      ],
    });
  });

  test("rejects a generated name owned by another plugin with complete conflict data", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-conflict-",
    );
    const sourcePath = path.join(agentsSourceDir, "reviewer.md");
    await writeFile(
      sourcePath,
      "---\nname: reviewer\ndescription: Reviews files\ntools: Read\n---\n\nReview.\n",
    );
    const conflictingTarget = path.join(
      locations.agentsDir,
      "pi-claude-marketplace-acme-reviewer.md",
    );
    const index: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "rival",
          marketplace: "other-catalog",
          sourceAgent: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath: "/rival/reviewer.md",
          targetPath: conflictingTarget,
          sourceHash: "hash-rival",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.agentsIndexPath, `${JSON.stringify(index, null, 2)}\n`);

    // act & assert
    await assert.rejects(
      () =>
        prepareStagePluginAgents(createRemovalOps(), {
          locations,
          cwd: locations.scopeRoot,
          marketplaceName: "catalog",
          pluginName: "acme",
          pluginRoot,
          pluginDataDir,
          agentsDirs: [agentsSourceDir],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AgentOwnershipConflictError);
        assert.deepStrictEqual(
          {
            name: error.name,
            message: error.message,
            stagingFor: error.stagingFor,
            conflicts: error.conflicts,
          },
          {
            name: "AgentOwnershipConflictError",
            message:
              'Refusing to stage agents for catalog/acme: "pi-claude-marketplace-acme-reviewer" already owned by other-catalog/rival.',
            stagingFor: { marketplace: "catalog", plugin: "acme" },
            conflicts: [
              {
                generatedName: "pi-claude-marketplace-acme-reviewer",
                owner: { marketplace: "other-catalog", plugin: "rival" },
              },
            ],
          },
        );
        return true;
      },
    );
  });

  test("removes the partial staging directory when a generated filename is too long", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-stage-write-error-",
    );
    const longName = "a".repeat(300);
    await writeFile(
      path.join(agentsSourceDir, "long.md"),
      `---\nname: ${longName}\ndescription: Long name\ntools: Read\n---\n\nBody.\n`,
    );

    // act
    const error = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    }).then(
      () => undefined,
      (reason: unknown) => reason,
    );
    const stagingEntries = await readdir(locations.agentsStagingDir);

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        code: (error as NodeJS.ErrnoException).code,
        syscall: (error as NodeJS.ErrnoException).syscall,
      },
      { name: "Error", code: "ENAMETOOLONG", syscall: "lstat" },
    );
    assert.deepStrictEqual(stagingEntries, []);
  });
});

describe("commitPreparedAgents", () => {
  for (const { coexistence, extraSources } of [
    { coexistence: "without", extraSources: [] },
    {
      coexistence: "with",
      extraSources: [{ name: "reviewer", description: "Reviewer", body: "Short body." }],
    },
  ]) {
    test(`AGENT-01: index persistence failure rolls back new names before the retry commits ${coexistence} a coexisting short-named agent`, async (t) => {
      // arrange
      const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
        t,
        "agents-index-failure-retry-",
      );
      const sourcePath = path.join(agentsSourceDir, "acme-reviewer.md");
      const sourceBytes =
        "---\nname: acme-reviewer\ndescription: Prefixed reviewer\ntools: Read\n---\n\nPrefixed body.\n";
      await writeFile(sourcePath, sourceBytes);
      const extras = extraSources.map(({ name, description, body }) => ({
        name,
        sourcePath: path.join(agentsSourceDir, `${name}.md`),
        bytes: `---\nname: ${name}\ndescription: ${description}\ntools: Read\n---\n\n${body}\n`,
        generatedName: `pi-claude-marketplace-acme-${name}`,
        targetPath: path.join(locations.agentsDir, `pi-claude-marketplace-acme-${name}.md`),
        expectedFileBytes: (extraSourcePath: string) =>
          `---\nname: acme:${name}\ndescription: ${description}\naliases: pi-claude-marketplace-acme-${name}\ntools: read\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nadvertise: true\nasync: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: ${name}\n  sourcePath: ${extraSourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\n${body}\n`,
      }));
      for (const extra of extras) {
        await writeFile(extra.sourcePath, extra.bytes);
      }

      await mkdir(locations.agentsDir, { recursive: true });
      await mkdir(locations.extensionRoot, { recursive: true });
      const oldTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md");
      const newTarget = path.join(
        locations.agentsDir,
        "pi-claude-marketplace-acme-acme-reviewer.md",
      );
      const oldBytes = `---\nname: pi-claude-marketplace-acme-reviewer\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: acme-reviewer\n  sourcePath: ${sourcePath}\n---\n\nLegacy body.\n`;
      await writeFile(oldTarget, oldBytes);
      const oldIndex: AgentsIndex = {
        schemaVersion: 1,
        agents: [
          {
            plugin: "acme",
            marketplace: "catalog",
            sourceAgent: "acme-reviewer",
            generatedName: "pi-claude-marketplace-acme-reviewer",
            sourcePath,
            targetPath: oldTarget,
            sourceHash: "a".repeat(64),
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
        ],
      };
      const oldIndexBytes = JSON.stringify(oldIndex);
      await writeFile(locations.agentsIndexPath, oldIndexBytes);
      const prepared = await prepareStagePluginAgents(createRemovalOps(), {
        locations,
        cwd: locations.scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir,
        agentsDirs: [agentsSourceDir],
      });
      assert.strictEqual(prepared.kind, "staged");
      const expectedEntries = [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "acme-reviewer",
          generatedName: "pi-claude-marketplace-acme-acme-reviewer",
          sourcePath,
          targetPath: newTarget,
          sourceHash: createHash("sha256").update(sourceBytes).digest("hex"),
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        ...extras.map((extra) => ({
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: extra.name,
          generatedName: extra.generatedName,
          sourcePath: extra.sourcePath,
          targetPath: extra.targetPath,
          sourceHash: createHash("sha256").update(extra.bytes).digest("hex"),
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        })),
      ];
      const expectedFileNames = [
        "pi-claude-marketplace-acme-acme-reviewer.md",
        ...extras.map((extra) => path.basename(extra.targetPath)),
      ];

      // act
      await chmod(locations.extensionRoot, 0o500);
      let failure: unknown;
      try {
        failure = await commitPreparedAgents(createRemovalOps(), prepared).then(
          () => undefined,
          (reason: unknown) => reason,
        );
      } finally {
        await chmod(locations.extensionRoot, 0o700);
      }

      const afterFailure = {
        indexBytes: await readFile(locations.agentsIndexPath, "utf8"),
        agentFileNames: await readdir(locations.agentsDir),
        stagingExists: await exists(prepared.stagingDir),
      };
      const retried = await prepareStagePluginAgents(createRemovalOps(), {
        locations,
        cwd: locations.scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir,
        agentsDirs: [agentsSourceDir],
      });
      const retryLeak = await commitPreparedAgents(createRemovalOps(), retried);

      // assert
      assert.ok(failure instanceof Error);
      const errno = failure as NodeJS.ErrnoException;
      assert.strictEqual(errno.code, "EACCES");
      assert.strictEqual(errno.syscall, "open");
      assert.ok(errno.path);
      assert.strictEqual(path.dirname(errno.path), locations.extensionRoot);
      assert.match(path.basename(errno.path), /^agents-index\.json\.\d+$/);
      assert.strictEqual(errno.message, `EACCES: permission denied, open '${errno.path}'`);
      assert.deepStrictEqual(afterFailure, {
        indexBytes: oldIndexBytes,
        agentFileNames: [],
        stagingExists: false,
      });
      assert.strictEqual(retryLeak, undefined);
      assert.deepStrictEqual(retried.result, {
        stagedNames: expectedEntries.map((entry) => entry.generatedName),
        recorded: expectedEntries.map(({ generatedName, sourcePath: source, targetPath }) => ({
          generatedName,
          sourcePath: source,
          targetPath,
        })),
        warnings: [],
        failed: [],
      });
      assert.deepStrictEqual((await readdir(locations.agentsDir)).sort(), expectedFileNames.sort());
      assert.strictEqual(
        await readFile(newTarget, "utf8"),
        `---\nname: acme:acme-reviewer\ndescription: Prefixed reviewer\naliases: pi-claude-marketplace-acme-acme-reviewer\ntools: read\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nadvertise: true\nasync: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: acme-reviewer\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\nPrefixed body.\n`,
      );
      for (const extra of extras) {
        assert.strictEqual(
          await readFile(extra.targetPath, "utf8"),
          extra.expectedFileBytes(extra.sourcePath),
        );
      }

      assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
        schemaVersion: 1,
        agents: expectedEntries,
      });
      assert.strictEqual(retried.kind, "staged");
      assert.strictEqual(await exists(retried.stagingDir), false);
    });
  }

  const foreignBytes = "Foreign bytes.\n";
  const foreignRow = (sourcePath: string, newTarget: string): AgentsIndex["agents"] => [
    {
      plugin: "acme",
      marketplace: "catalog",
      sourceAgent: "reviewer",
      generatedName: "pi-claude-marketplace-acme-reviewer",
      sourcePath,
      targetPath: newTarget,
      sourceHash: "b".repeat(64),
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    },
  ];
  const expectFileIntact = async (target: string): Promise<void> => {
    assert.strictEqual(await readFile(target, "utf8"), foreignBytes);
  };

  for (const { obstacle, indexedRows, occupyBefore, occupyAfter, expectIntact } of [
    {
      obstacle: "file",
      indexedRows: (): AgentsIndex["agents"] => [],
      occupyBefore: (target: string) => writeFile(target, foreignBytes),
      occupyAfter: () => Promise.resolve(),
      expectIntact: expectFileIntact,
    },
    {
      obstacle: "directory",
      indexedRows: (): AgentsIndex["agents"] => [],
      occupyBefore: async (target: string) => {
        await mkdir(target);
        await writeFile(path.join(target, "keep"), foreignBytes);
      },
      occupyAfter: () => Promise.resolve(),
      expectIntact: async (target: string) => {
        assert.deepStrictEqual(await readdir(target), ["keep"]);
        assert.strictEqual(await readFile(path.join(target, "keep"), "utf8"), foreignBytes);
      },
    },
    {
      obstacle: "symlink",
      indexedRows: (): AgentsIndex["agents"] => [],
      occupyBefore: () => Promise.resolve(),
      occupyAfter: (target: string) => symlink("missing-target", target),
      expectIntact: async (target: string) => {
        assert.strictEqual((await lstat(target)).isSymbolicLink(), true);
        assert.strictEqual(await readlink(target), "missing-target");
      },
    },
    {
      obstacle: "late file",
      indexedRows: (): AgentsIndex["agents"] => [],
      occupyBefore: () => Promise.resolve(),
      occupyAfter: (target: string) => writeFile(target, foreignBytes),
      expectIntact: expectFileIntact,
    },
    {
      obstacle: "indexed foreign file",
      indexedRows: foreignRow,
      occupyBefore: (target: string) => writeFile(target, foreignBytes),
      occupyAfter: () => Promise.resolve(),
      expectIntact: expectFileIntact,
    },
  ]) {
    test(`preserves old ownership and an occupied new ${obstacle} before deleting anything`, async (t) => {
      // arrange
      const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
        t,
        "agents-new-target-",
      );
      const sourcePath = path.join(agentsSourceDir, "reviewer.md");
      await writeFile(sourcePath, "---\nname: reviewer\ndescription: Reviewer\n---\n\nNew body.\n");
      await mkdir(locations.agentsDir, { recursive: true });
      await mkdir(locations.extensionRoot, { recursive: true });
      const oldTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-old.md");
      const newTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md");
      const oldBytes =
        "---\nname: pi-claude-marketplace-acme-old\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n---\n\nOld body.\n";
      await writeFile(oldTarget, oldBytes);
      const oldIndexBytes = JSON.stringify({
        schemaVersion: 1,
        agents: [
          {
            plugin: "acme",
            marketplace: "catalog",
            sourceAgent: "old",
            generatedName: "pi-claude-marketplace-acme-old",
            sourcePath,
            targetPath: oldTarget,
            sourceHash: "a".repeat(64),
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
          ...indexedRows(sourcePath, newTarget),
        ],
      });
      await writeFile(locations.agentsIndexPath, oldIndexBytes);
      await occupyBefore(newTarget);
      const prepared = await prepareStagePluginAgents(createRemovalOps(), {
        locations,
        cwd: locations.scopeRoot,
        marketplaceName: "catalog",
        pluginName: "acme",
        pluginRoot,
        pluginDataDir,
        agentsDirs: [agentsSourceDir],
      });
      assert.strictEqual(prepared.kind, "staged");
      await occupyAfter(newTarget);

      // act
      const error = await commitPreparedAgents(createRemovalOps(), prepared).then(
        () => undefined,
        (reason: unknown) => reason,
      );

      // assert
      assert.ok(error instanceof Error);
      assert.deepStrictEqual(
        { name: error.name, message: error.message },
        {
          name: "AgentTargetOccupiedError",
          message: `Cannot replace agent target with non-previous content at ${path.basename(newTarget)}`,
        },
      );
      assert.strictEqual(await readFile(oldTarget, "utf8"), oldBytes);
      assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), oldIndexBytes);
      await expectIntact(newTarget);
      assert.strictEqual(await exists(prepared.stagingDir), false);
    });
  }

  test("commits the complete agent-family tree, index, and substitutions", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-family-",
    );
    const helperSource = `---
name: acme-helper
description: Helper agent
tools: Read,Grep
---

Helper body.
`;
    const botSource = `---
name: bot
description: A bot agent
model: sonnet
tools: Read,Bash,Edit
---

You are a bot. Read from \${CLAUDE_PLUGIN_ROOT}/data and \${CLAUDE_PROJECT_DIR}.
`;
    const helperSourcePath = path.join(agentsSourceDir, "acme-helper.md");
    const botSourcePath = path.join(agentsSourceDir, "bot.md");
    const helperTargetPath = path.join(
      locations.agentsDir,
      "pi-claude-marketplace-acme-acme-helper.md",
    );
    const botTargetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const expectedHelperBytes = `---
name: acme:acme-helper
description: Helper agent
aliases: pi-claude-marketplace-acme-acme-helper
tools: read,grep
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: acme-helper
  sourcePath: ${helperSourcePath}
  droppedFields: []
  droppedTools: []
  warnings: []
---

Helper body.
`;
    const expectedBotBytes = `---
name: acme:bot
description: A bot agent
aliases: pi-claude-marketplace-acme-bot
model: anthropic/claude-sonnet-5-5
tools: read,bash,edit
systemPromptMode: replace
inheritProjectContext: true
inheritSkills: false
advertise: true
async: false
provenance:
  generatedBy: pi-claude-marketplace
  sourcePlugin: acme
  sourceAgent: bot
  sourcePath: ${botSourcePath}
  originalModel: sonnet
  droppedFields: []
  droppedTools: []
  warnings: []
---

You are a bot. Read from ${pluginRoot}/data and ${locations.scopeRoot}.
`;
    await writeFile(helperSourcePath, helperSource);
    await writeFile(botSourcePath, botSource);
    const expectedIndex: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "acme-helper",
          generatedName: "pi-claude-marketplace-acme-acme-helper",
          sourcePath: helperSourcePath,
          targetPath: helperTargetPath,
          sourceHash: "0b95a21a6f2001d5be49907dc52d3d7913aa20e38a73a098a1b8d825fcf8261c",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "bot",
          generatedName: "pi-claude-marketplace-acme-bot",
          sourcePath: botSourcePath,
          targetPath: botTargetPath,
          sourceHash: "971e229318e50e5ad01deb1afcb13fcc883a13632668fd385ad8f1624c69287c",
          originalModel: "sonnet",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    const expectedIndexBytes = `${JSON.stringify(expectedIndex, null, 2)}\n`;
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      knownSkills: ["acme-helper"],
      mapModel: true,
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.deepStrictEqual(await readdir(locations.agentsDir), [
      "pi-claude-marketplace-acme-acme-helper.md",
      "pi-claude-marketplace-acme-bot.md",
    ]);
    assert.strictEqual(await readFile(helperTargetPath, "utf8"), expectedHelperBytes);
    assert.strictEqual(await readFile(botTargetPath, "utf8"), expectedBotBytes);
    assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), expectedIndexBytes);
    assert.strictEqual(
      prepared.kind === "staged" ? await exists(prepared.stagingDir) : true,
      false,
    );
  });

  test("removes owned previous files, tolerates missing files, and preserves other owners", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-previous-",
    );
    const sourcePath = path.join(agentsSourceDir, "current.md");
    await writeFile(
      sourcePath,
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const ownedTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-old.md");
    const missingTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-missing.md");
    const otherTarget = path.join(locations.agentsDir, "pi-claude-marketplace-other-kept.md");
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(
      ownedTarget,
      "---\nname: old\nprovenance:\n  generatedBy: pi-claude-marketplace\n---\n\nOld.\n",
    );
    const previousIndex: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "old",
          generatedName: "pi-claude-marketplace-acme-old",
          sourcePath: "/previous/old.md",
          targetPath: ownedTarget,
          sourceHash: "hash-old",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "missing",
          generatedName: "pi-claude-marketplace-acme-missing",
          sourcePath: "/previous/missing.md",
          targetPath: missingTarget,
          sourceHash: "hash-missing",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        {
          plugin: "other",
          marketplace: "other-catalog",
          sourceAgent: "kept",
          generatedName: "pi-claude-marketplace-other-kept",
          sourcePath: "/other/kept.md",
          targetPath: otherTarget,
          sourceHash: "hash-kept",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.agentsIndexPath, `${JSON.stringify(previousIndex, null, 2)}\n`);
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);
    const storedIndex: unknown = JSON.parse(await readFile(locations.agentsIndexPath, "utf8"));

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await exists(ownedTarget), false);
    assert.strictEqual(await exists(missingTarget), false);
    assert.strictEqual(
      await exists(path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md")),
      true,
    );
    assert.deepStrictEqual(storedIndex, {
      schemaVersion: 1,
      agents: [
        previousIndex.agents[2],
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "current",
          generatedName: "pi-claude-marketplace-acme-current",
          sourcePath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md"),
          sourceHash: "24214fe4c9874b0a54cc773880901f4cac6c6e3c26010846e02c7054b2026249",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    });
  });

  test("AG-3: keeps another plugin's row with grant forms verbatim through a stage", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-other-forms-",
    );
    const sourcePath = path.join(agentsSourceDir, "bot.md");
    await writeFile(sourcePath, BOT_QUERY_SOURCE);
    const otherRow = otherPluginRowWithForms(
      path.join(locations.agentsDir, "pi-claude-marketplace-other-bot.md"),
    );
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      JSON.stringify({ schemaVersion: 1, agents: [otherRow] }),
    );
    const expectedIndex: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        otherRow,
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "bot",
          generatedName: "pi-claude-marketplace-acme-bot",
          sourcePath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md"),
          sourceHash: BOT_QUERY_SOURCE_HASH,
          droppedFields: [],
          droppedTools: [],
          warnings: [ADAPTER_ASYNC],
          mcpImplementation: "adapter",
          mcpForms: {
            adapter: {
              frontmatter: botQueryFrontmatter(sourcePath, "adapter"),
              warnings: [ADAPTER_ASYNC],
              droppedTools: [],
            },
            builtin: {
              frontmatter: botQueryFrontmatter(sourcePath, "builtin"),
              warnings: [BUILTIN_ASYNC],
              droppedTools: [],
            },
          },
        },
      ],
    };
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
      mcpGrantForms: { active: "adapter", declaredMcpServers: { db: { command: "node" } } },
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(
      await readFile(locations.agentsIndexPath, "utf8"),
      `${JSON.stringify(expectedIndex, null, 2)}\n`,
    );
  });

  test("AG-5: keeps the grant forms of this plugin's row whose file a user edited", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-foreign-forms-",
    );
    const sourcePath = path.join(agentsSourceDir, "reviewer.md");
    await writeFile(
      sourcePath,
      "---\nname: reviewer\ndescription: Reviews files\ntools: Read\n---\n\nReview.\n",
    );
    const editedTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const editedBytes = "---\nname: bot\n---\nEdited by hand.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(editedTarget, editedBytes);
    const editedRow: AgentsIndexEntry = {
      ...otherPluginRowWithForms(editedTarget),
      plugin: "acme",
      generatedName: "pi-claude-marketplace-acme-bot",
      sourcePath: "/previous/bot.md",
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      JSON.stringify({ schemaVersion: 1, agents: [editedRow] }),
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
      mcpGrantForms: { active: "builtin", declaredMcpServers: { db: { command: "node" } } },
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.deepStrictEqual(prepared.result.failed, [
      {
        generatedName: "pi-claude-marketplace-acme-bot",
        targetPath: editedTarget,
        reason: `target ${editedTarget} is missing the generated marker`,
      },
    ]);
    assert.strictEqual(await readFile(editedTarget, "utf8"), editedBytes);
    assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md"),
          sourceHash: "ed65c8a92ce122561217d7cdffbedd53f95f22e25f77f4514bf4af266b16c92d",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        editedRow,
      ],
    });
  });

  test("MGRT-01: a re-stage under the adapter replaces the row's grant forms with the new staging's", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-restage-forms-",
    );
    const sourcePath = path.join(agentsSourceDir, "bot.md");
    await writeFile(sourcePath, BOT_QUERY_SOURCE);
    const targetPath = path.join(locations.agentsDir, "pi-claude-marketplace-acme-bot.md");
    const stageInput = {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
      mcpServerNames: ["db"],
    };
    const declaredMcpServers = { db: { command: "node" } };
    await commitPreparedAgents(
      createRemovalOps(),
      await prepareStagePluginAgents(createRemovalOps(), {
        ...stageInput,
        mcpGrantForms: { active: "builtin", declaredMcpServers },
      }),
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      ...stageInput,
      mcpGrantForms: { active: "adapter", declaredMcpServers },
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(
      await readFile(targetPath, "utf8"),
      `${botQueryFrontmatter(sourcePath, "adapter")}\nBody.\n`,
    );
    assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "bot",
          generatedName: "pi-claude-marketplace-acme-bot",
          sourcePath,
          targetPath,
          sourceHash: BOT_QUERY_SOURCE_HASH,
          droppedFields: [],
          droppedTools: [],
          warnings: [ADAPTER_ASYNC],
          mcpImplementation: "adapter",
          mcpForms: {
            adapter: {
              frontmatter: botQueryFrontmatter(sourcePath, "adapter"),
              warnings: [ADAPTER_ASYNC],
              droppedTools: [],
            },
            builtin: {
              frontmatter: botQueryFrontmatter(sourcePath, "builtin"),
              warnings: [BUILTIN_ASYNC],
              droppedTools: [],
            },
          },
        },
      ],
    });
  });

  test("preserves foreign bytes and their complete index rows", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-foreign-",
    );
    const sourcePath = path.join(agentsSourceDir, "reviewer.md");
    await writeFile(
      sourcePath,
      "---\nname: reviewer\ndescription: Reviews files\ntools: Read\n---\n\nReview.\n",
    );
    const foreignTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-orphan.md");
    const unindexedTarget = path.join(locations.agentsDir, "manual-agent.md");
    const foreignBytes = "---\nname: orphan\n---\nManual bytes.\n";
    const unindexedBytes = "---\nname: manual\n---\nUnindexed bytes.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(foreignTarget, foreignBytes);
    await writeFile(unindexedTarget, unindexedBytes);
    const foreignRow = {
      plugin: "acme",
      marketplace: "catalog",
      sourceAgent: "orphan",
      generatedName: "pi-claude-marketplace-acme-orphan",
      sourcePath: "/previous/orphan.md",
      targetPath: foreignTarget,
      sourceHash: "hash-orphan",
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    } as const;
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      `${JSON.stringify({ schemaVersion: 1, agents: [foreignRow] }, null, 2)}\n`,
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared);
    const storedIndex: unknown = JSON.parse(await readFile(locations.agentsIndexPath, "utf8"));

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await readFile(foreignTarget, "utf8"), foreignBytes);
    assert.strictEqual(await readFile(unindexedTarget, "utf8"), unindexedBytes);
    assert.deepStrictEqual(storedIndex, {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "reviewer",
          generatedName: "pi-claude-marketplace-acme-reviewer",
          sourcePath,
          targetPath: path.join(locations.agentsDir, "pi-claude-marketplace-acme-reviewer.md"),
          sourceHash: "ed65c8a92ce122561217d7cdffbedd53f95f22e25f77f4514bf4af266b16c92d",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        foreignRow,
      ],
    });
  });

  test("removes staging and leaves prior content when a previous target cannot be removed", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-remove-error-",
    );
    const sourcePath = path.join(agentsSourceDir, "current.md");
    await writeFile(
      sourcePath,
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const previousTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-old.md");
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(
      previousTarget,
      "---\nname: old\nprovenance:\n  generatedBy: pi-claude-marketplace\n---\n\nOld.\n",
    );
    const previousIndex: AgentsIndex = {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "old",
          generatedName: "pi-claude-marketplace-acme-old",
          sourcePath: "/previous/old.md",
          targetPath: previousTarget,
          sourceHash: "hash-old",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    };
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(locations.agentsIndexPath, `${JSON.stringify(previousIndex, null, 2)}\n`);
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");
    await rm(previousTarget);
    await mkdir(previousTarget);
    await writeFile(path.join(previousTarget, "blocker.txt"), "keep");

    // act
    const error = await commitPreparedAgents(createRemovalOps(), prepared).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        code: (error as NodeJS.ErrnoException).code,
        syscall: (error as NodeJS.ErrnoException).syscall,
      },
      { name: "SystemError", code: "ERR_FS_EISDIR", syscall: "rm" },
    );
    assert.strictEqual(await readFile(path.join(previousTarget, "blocker.txt"), "utf8"), "keep");
    assert.strictEqual(await exists(prepared.stagingDir), false);
    assert.strictEqual(
      await readFile(locations.agentsIndexPath, "utf8"),
      `${JSON.stringify(previousIndex, null, 2)}\n`,
    );
  });

  test("rolls back a partial rename when the next staged file is missing", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-rename-error-",
    );
    await writeFile(
      path.join(agentsSourceDir, "alpha.md"),
      "---\nname: alpha\ndescription: Alpha agent\ntools: Read\n---\n\nAlpha.\n",
    );
    await writeFile(
      path.join(agentsSourceDir, "zulu.md"),
      "---\nname: zulu\ndescription: Zulu agent\ntools: Read\n---\n\nZulu.\n",
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");
    await mkdir(locations.agentsDir, { recursive: true });
    await rm(path.join(prepared.stagingDir, "pi-claude-marketplace-acme-zulu.md"));

    // act
    const error = await commitPreparedAgents(createRemovalOps(), prepared).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        code: (error as NodeJS.ErrnoException).code,
        syscall: (error as NodeJS.ErrnoException).syscall,
      },
      { name: "Error", code: "ENOENT", syscall: "rename" },
    );
    assert.deepStrictEqual(await readdir(locations.agentsDir), []);
    assert.strictEqual(await exists(prepared.stagingDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });

  test("surfaces a rollback leak when staging vanishes during commit", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-rollback-leak-",
    );
    await writeFile(
      path.join(agentsSourceDir, "alpha.md"),
      "---\nname: alpha\ndescription: Alpha agent\ntools: Read\n---\n\nAlpha.\n",
    );
    await writeFile(
      path.join(agentsSourceDir, "zulu.md"),
      "---\nname: zulu\ndescription: Zulu agent\ntools: Read\n---\n\nZulu.\n",
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");
    await mkdir(locations.agentsDir, { recursive: true });
    const alphaTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-alpha.md");
    const zuluTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-zulu.md");
    const alphaStaged = path.join(prepared.stagingDir, path.basename(alphaTarget));
    const zuluStaged = path.join(prepared.stagingDir, path.basename(zuluTarget));
    const zuluPair = prepared.stagedFilePaths[1];
    assert.ok(zuluPair);
    const stagedFilePaths = new Proxy([...prepared.stagedFilePaths], {
      get(target, property, receiver): unknown {
        if (property === "1") {
          rmSync(prepared.stagingDir, { recursive: true, force: true });
          return zuluPair;
        }

        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const vanishingPrepared = { ...prepared, stagedFilePaths: stagedFilePaths };

    // act
    const error = await commitPreparedAgents(createRemovalOps(), vanishingPrepared).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof Error);
    assert.strictEqual(
      error.message,
      `ENOENT: no such file or directory, rename '${zuluStaged}' -> '${zuluTarget}' ` +
        `(additionally: failed to roll back agent rename ${alphaTarget} -> ${alphaStaged}: ` +
        `ENOENT: no such file or directory, rename '${alphaTarget}' -> '${alphaStaged}')`,
    );
    assert.ok(error.cause instanceof Error);
    assert.deepStrictEqual(
      {
        message: error.cause.message,
        code: (error.cause as NodeJS.ErrnoException).code,
        syscall: (error.cause as NodeJS.ErrnoException).syscall,
      },
      {
        message: `ENOENT: no such file or directory, rename '${zuluStaged}' -> '${zuluTarget}'`,
        code: "ENOENT",
        syscall: "rename",
      },
    );
    assert.strictEqual(await exists(alphaTarget), true);
    assert.strictEqual(await exists(zuluTarget), false);
    assert.strictEqual(await exists(prepared.stagingDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });

  test("D-PL1-15: force replaces a staged row whose bytes a user changed and keeps a hand-named row with its file", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-force-",
    );
    const sourcePath = path.join(agentsSourceDir, "current.md");
    await writeFile(
      sourcePath,
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const currentTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md");
    const handNamedTarget = path.join(locations.agentsDir, "my-reviewer.md");
    const handNamedBytes = "---\nname: my-reviewer\n---\nWritten by hand.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(currentTarget, "---\nname: current\n---\nEdited by hand.\n");
    await writeFile(handNamedTarget, handNamedBytes);
    const editedRow = (sourceAgent: string, generatedName: string, targetPath: string) => ({
      plugin: "acme",
      marketplace: "catalog",
      sourceAgent,
      generatedName,
      sourcePath: `/previous/${sourceAgent}.md`,
      targetPath,
      sourceHash: `hash-${sourceAgent}`,
      droppedFields: [],
      droppedTools: [],
      warnings: [],
    });
    const handNamedRow = editedRow("reviewer", "my-reviewer", handNamedTarget);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [
          editedRow("current", "pi-claude-marketplace-acme-current", currentTarget),
          handNamedRow,
        ],
      }),
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared, { force: true });

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.deepStrictEqual((await readdir(locations.agentsDir)).sort(), [
      "my-reviewer.md",
      "pi-claude-marketplace-acme-current.md",
    ]);
    assert.strictEqual(await readFile(handNamedTarget, "utf8"), handNamedBytes);
    assert.strictEqual(
      await readFile(currentTarget, "utf8"),
      `---\nname: acme:current\ndescription: Current agent\naliases: pi-claude-marketplace-acme-current\ntools: read\nsystemPromptMode: replace\ninheritProjectContext: true\ninheritSkills: false\nadvertise: true\nasync: false\nprovenance:\n  generatedBy: pi-claude-marketplace\n  sourcePlugin: acme\n  sourceAgent: current\n  sourcePath: ${sourcePath}\n  droppedFields: []\n  droppedTools: []\n  warnings: []\n---\n\nCurrent.\n`,
    );
    assert.deepStrictEqual(JSON.parse(await readFile(locations.agentsIndexPath, "utf8")), {
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "current",
          generatedName: "pi-claude-marketplace-acme-current",
          sourcePath,
          targetPath: currentTarget,
          sourceHash: "24214fe4c9874b0a54cc773880901f4cac6c6e3c26010846e02c7054b2026249",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
        handNamedRow,
      ],
    });
  });

  test("D-PL10-13: force preserves a staged-name row that points at another file and leaves that file", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-force-moved-",
    );
    await writeFile(
      path.join(agentsSourceDir, "current.md"),
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const currentTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md");
    const userTarget = path.join(locations.agentsDir, "my-notes.md");
    const userBytes = "---\nname: my-notes\n---\nWritten by hand.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(userTarget, userBytes);
    await mkdir(locations.extensionRoot, { recursive: true });
    await writeFile(
      locations.agentsIndexPath,
      JSON.stringify({
        schemaVersion: 1,
        agents: [
          {
            plugin: "acme",
            marketplace: "catalog",
            sourceAgent: "current",
            // A hand-edited row: the staged name, but another file's path.
            generatedName: "pi-claude-marketplace-acme-current",
            sourcePath: "/previous/current.md",
            targetPath: userTarget,
            sourceHash: "hash-current",
            droppedFields: [],
            droppedTools: [],
            warnings: [],
          },
        ],
      }),
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });

    // act
    const cleanupLeak = await commitPreparedAgents(createRemovalOps(), prepared, { force: true });

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await readFile(userTarget, "utf8"), userBytes);
    assert.strictEqual(await exists(currentTarget), true);
    const index = JSON.parse(await readFile(locations.agentsIndexPath, "utf8")) as AgentsIndex;
    assert.deepStrictEqual(
      index.agents.map(({ generatedName, targetPath }) => ({ generatedName, targetPath })),
      [
        { generatedName: "pi-claude-marketplace-acme-current", targetPath: currentTarget },
        { generatedName: "pi-claude-marketplace-acme-current", targetPath: userTarget },
      ],
    );
  });

  test("force still refuses a file no index row names at a new target", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-commit-force-intruder-",
    );
    const sourcePath = path.join(agentsSourceDir, "current.md");
    await writeFile(
      sourcePath,
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const currentTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md");
    const orphanTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-orphan.md");
    const intruderBytes = "---\nname: current\n---\nDo not overwrite.\n";
    const orphanBytes = "---\nname: orphan\n---\nEdited by hand.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(currentTarget, intruderBytes);
    await writeFile(orphanTarget, orphanBytes);
    await mkdir(locations.extensionRoot, { recursive: true });
    const indexBytes = JSON.stringify({
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "orphan",
          generatedName: "pi-claude-marketplace-acme-orphan",
          sourcePath: "/previous/orphan.md",
          targetPath: orphanTarget,
          sourceHash: "hash-orphan",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    });
    await writeFile(locations.agentsIndexPath, indexBytes);
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const error = await commitPreparedAgents(createRemovalOps(), prepared, { force: true }).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      {
        name: "AgentTargetOccupiedError",
        message: `Cannot replace agent target with non-previous content at ${path.basename(currentTarget)}`,
        cause: undefined,
      },
    );
    assert.strictEqual(await readFile(currentTarget, "utf8"), intruderBytes);
    assert.strictEqual(await readFile(orphanTarget, "utf8"), orphanBytes);
    assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), indexBytes);
    assert.strictEqual(await exists(prepared.stagingDir), false);
  });

  test("NFR-10: force refuses an owned index row whose target is outside the agents directory and removes nothing", async (t) => {
    // arrange
    const { scopeRoot, pluginRoot, agentsSourceDir, locations, pluginDataDir } =
      await createStageTree(t, "agents-commit-force-escape-");
    const sourcePath = path.join(agentsSourceDir, "current.md");
    await writeFile(
      sourcePath,
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    // The generated marker makes the row pass the ownership check, so only the
    // containment check stands between the forced commit and this file.
    const outsideTarget = path.join(scopeRoot, "pi-claude-marketplace-acme-outside.md");
    const outsideBytes =
      "---\nname: outside\nprovenance:\n  generatedBy: pi-claude-marketplace\n---\nMoved away.\n";
    await writeFile(outsideTarget, outsideBytes);
    await mkdir(locations.agentsDir, { recursive: true });
    await mkdir(locations.extensionRoot, { recursive: true });
    const indexBytes = JSON.stringify({
      schemaVersion: 1,
      agents: [
        {
          plugin: "acme",
          marketplace: "catalog",
          sourceAgent: "outside",
          generatedName: "pi-claude-marketplace-acme-outside",
          sourcePath: "/previous/outside.md",
          targetPath: outsideTarget,
          sourceHash: "hash-outside",
          droppedFields: [],
          droppedTools: [],
          warnings: [],
        },
      ],
    });
    await writeFile(locations.agentsIndexPath, indexBytes);
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const error = await commitPreparedAgents(createRemovalOps(), prepared, { force: true }).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof PathContainmentError);
    assert.deepStrictEqual(
      { name: error.name, parent: error.parent, child: error.child, message: error.message },
      {
        name: "PathContainmentError",
        parent: locations.agentsDir,
        child: outsideTarget,
        message: `previous agent file escapes ${locations.agentsDir} (resolved: ${outsideTarget}).`,
      },
    );
    assert.strictEqual(await readFile(outsideTarget, "utf8"), outsideBytes);
    assert.deepStrictEqual(await readdir(locations.agentsDir), []);
    assert.strictEqual(await readFile(locations.agentsIndexPath, "utf8"), indexBytes);
    assert.strictEqual(await exists(prepared.stagingDir), false);
  });
});

describe("assertAgentCommitTargets", () => {
  test("accepts a no-op prepare without touching the agents directory", async (t) => {
    // arrange
    const { pluginRoot, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-targets-noop-",
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [],
    });

    // act
    const outcome = await assertAgentCommitTargets(prepared, { force: true }).then(
      () => "accepted",
    );

    // assert
    assert.strictEqual(outcome, "accepted");
    assert.strictEqual(await exists(locations.agentsDir), false);
  });

  test("PI-6: refuses a new target holding a file no index row names and keeps the staged handle", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-targets-occupied-",
    );
    await writeFile(
      path.join(agentsSourceDir, "current.md"),
      "---\nname: current\ndescription: Current agent\ntools: Read\n---\n\nCurrent.\n",
    );
    const currentTarget = path.join(locations.agentsDir, "pi-claude-marketplace-acme-current.md");
    const intruderBytes = "---\nname: current\n---\nDo not overwrite.\n";
    await mkdir(locations.agentsDir, { recursive: true });
    await writeFile(currentTarget, intruderBytes);
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const error = await assertAgentCommitTargets(prepared).then(
      () => undefined,
      (reason: unknown) => reason,
    );

    // assert
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      {
        name: "AgentTargetOccupiedError",
        message: `Cannot replace agent target with non-previous content at ${path.basename(currentTarget)}`,
        cause: undefined,
      },
    );
    assert.strictEqual(await readFile(currentTarget, "utf8"), intruderBytes);
    assert.deepStrictEqual(await readdir(prepared.stagingDir), [
      "pi-claude-marketplace-acme-current.md",
    ]);
  });
});

describe("abortPreparedAgents", () => {
  test("returns without materializing paths for a no-op prepare", async (t) => {
    // arrange
    const { pluginRoot, locations, pluginDataDir } = await createStageTree(t, "agents-abort-noop-");
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [],
    });

    // act
    const cleanupLeak = await abortPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await exists(locations.agentsDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });

  test("removes staged files without touching agent targets", async (t) => {
    // arrange
    const { pluginRoot, agentsSourceDir, locations, pluginDataDir } = await createStageTree(
      t,
      "agents-abort-staged-",
    );
    await writeFile(
      path.join(agentsSourceDir, "reviewer.md"),
      "---\nname: reviewer\ndescription: Reviews files\ntools: Read\n---\n\nReview.\n",
    );
    const prepared = await prepareStagePluginAgents(createRemovalOps(), {
      locations,
      cwd: locations.scopeRoot,
      marketplaceName: "catalog",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir,
      agentsDirs: [agentsSourceDir],
    });
    assert.strictEqual(prepared.kind, "staged");

    // act
    const cleanupLeak = await abortPreparedAgents(createRemovalOps(), prepared);

    // assert
    assert.strictEqual(cleanupLeak, undefined);
    assert.strictEqual(await exists(prepared.stagingDir), false);
    assert.strictEqual(await exists(locations.agentsDir), false);
    assert.strictEqual(await exists(locations.agentsIndexPath), false);
  });
});
