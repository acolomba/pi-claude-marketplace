import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { readSkillPreloads } from "../../../extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts";

import type { ReadSkillPreloadsInput } from "../../../extensions/pi-claude-marketplace/bridges/agents/skill-preload.ts";
import type {
  AgentSkillSource,
  DiscoveredAgent,
  SkillPreload,
} from "../../../extensions/pi-claude-marketplace/bridges/agents/types.ts";

const TARGET_ROOT = "/scope/pi-claude-marketplace/resources/skills";

async function createPluginTree(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "agents-skill-preload-")));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  return root;
}

// Writes `skills/<skill>/SKILL.md` under `root` and returns its source row.
async function writeSkill(root: string, skill: string, text: string): Promise<AgentSkillSource> {
  const sourcePath = path.join(root, "skills", skill);
  await mkdir(sourcePath, { recursive: true });
  await writeFile(path.join(sourcePath, "SKILL.md"), text);
  return {
    generatedName: `acme-${skill}`,
    sourcePath,
    targetPath: `${TARGET_ROOT}/acme-${skill}`,
  };
}

function agent(skills: string | undefined): DiscoveredAgent {
  return {
    sourceName: "bot",
    generatedName: "pi-claude-marketplace-acme-bot",
    sourcePath: "/plugin/agents/bot.md",
    sourceHash: "abc",
    raw: skills === undefined ? { description: "d" } : { description: "d", skills },
    body: "Body.\n",
  };
}

function preloadInput(
  root: string,
  skillSources: readonly AgentSkillSource[],
  overrides: Partial<ReadSkillPreloadsInput> = {},
): ReadSkillPreloadsInput {
  return {
    discovered: [agent("rules")],
    knownSkills: skillSources.map((row) => row.generatedName),
    skillSources,
    pluginName: "acme",
    pluginRoot: root,
    pluginDataDir: "/data/acme",
    referenceNames: {
      skills: skillSources.map((row) => row.generatedName),
      commands: [],
      workflows: [],
    },
    ...overrides,
  };
}

test("inlines a described skill under its staged folder with the plugin variables substituted", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "---\nname: rules\ndescription: The house rules.\n---\n\nRead ${CLAUDE_SKILL_DIR}/rules.md.\nRoot ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}.\n",
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nRead ${TARGET_ROOT}/acme-rules/rules.md.\nRoot ${root}, data /data/acme.`,
        },
      ],
    ]),
  );
});

test("inlines a skill whose only description is when_to_use", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "---\nname: rules\nwhen_to_use: When rules apply.\n---\nFollow the rules.\n",
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nFollow the rules.`,
        },
      ],
    ]),
  );
});

test("skips a skill that sets disable-model-invocation to true", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "---\ndescription: Hidden rules.\ndisable-model-invocation: true\n---\nFollow the rules.\n",
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      ["acme-rules", { kind: "skip", reason: "disable-model-invocation" }],
    ]),
  );
});

test("inlines a skill whose disable-model-invocation is the string true", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    '---\ndescription: Quoted rules.\ndisable-model-invocation: "true"\n---\nFollow the rules.\n',
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nFollow the rules.`,
        },
      ],
    ]),
  );
});

for (const { label, text } of [
  { label: "no frontmatter", text: "Follow the rules.\n" },
  { label: "only a name", text: "---\nname: rules\n---\nFollow the rules.\n" },
  {
    label: "a blank description and when_to_use",
    text: '---\ndescription: "  "\nwhen_to_use: ""\n---\nFollow the rules.\n',
  },
  { label: "a non-string description", text: "---\ndescription: 42\n---\nFollow the rules.\n" },
]) {
  test(`skips a skill with ${label} as having no description`, async (t) => {
    // arrange
    const root = await createPluginTree(t);
    const rules = await writeSkill(root, "rules", text);

    // act
    const preloads = await readSkillPreloads(preloadInput(root, [rules]));

    // assert
    assert.deepStrictEqual(
      preloads,
      new Map<string, SkillPreload>([["acme-rules", { kind: "skip", reason: "no-description" }]]),
    );
  });
}

test("skips a skill whose frontmatter does not parse", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "---\ndescription: [unclosed\n---\nFollow the rules.\n",
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([["acme-rules", { kind: "skip", reason: "unparseable" }]]),
  );
});

test("parses a skill whose source starts with a byte order mark", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "﻿---\ndescription: Marked rules.\n---\nFollow the rules.\n",
  );

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nFollow the rules.`,
        },
      ],
    ]),
  );
});

test("rewrites a same-plugin skill reference as the skills bridge does", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(
    root,
    "rules",
    "---\ndescription: The rules.\n---\nThen run acme:helper.\n",
  );
  const helper = await writeSkill(root, "helper", "---\ndescription: Help.\n---\nHelp.\n");

  // act
  const preloads = await readSkillPreloads(preloadInput(root, [rules, helper]));

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nThen run /skill:acme-helper.`,
        },
      ],
    ]),
  );
});

for (const { label, projectDir, expectedLine } of [
  { label: "with a project folder", projectDir: "/work/app", expectedLine: "Open /work/app." },
  {
    label: "without a project folder",
    projectDir: undefined,
    expectedLine: "Open ${CLAUDE_PROJECT_DIR}.",
  },
]) {
  test(`substitutes the project folder token only ${label}`, async (t) => {
    // arrange
    const root = await createPluginTree(t);
    const rules = await writeSkill(
      root,
      "rules",
      "---\ndescription: The rules.\n---\nOpen ${CLAUDE_PROJECT_DIR}.\n",
    );

    // act
    const preloads = await readSkillPreloads(preloadInput(root, [rules], { projectDir }));

    // assert
    assert.deepStrictEqual(
      preloads,
      new Map<string, SkillPreload>([
        [
          "acme-rules",
          {
            kind: "inline",
            text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\n${expectedLine}`,
          },
        ],
      ]),
    );
  });
}

test("reads only the rows of skills some agent names", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const rules = await writeSkill(root, "rules", "---\ndescription: The rules.\n---\nRules.\n");
  const unread: AgentSkillSource = {
    generatedName: "acme-unread",
    sourcePath: path.join(root, "skills", "missing"),
    targetPath: `${TARGET_ROOT}/acme-unread`,
  };

  // act
  const preloads = await readSkillPreloads(
    preloadInput(root, [rules, unread], { discovered: [agent("rules"), agent(undefined)] }),
  );

  // assert
  assert.deepStrictEqual(
    preloads,
    new Map<string, SkillPreload>([
      [
        "acme-rules",
        {
          kind: "inline",
          text: `Base directory for this skill: ${TARGET_ROOT}/acme-rules\n\nRules.`,
        },
      ],
    ]),
  );
});

test("reads nothing without skill sources", async (t) => {
  // arrange
  const root = await createPluginTree(t);

  // act
  const preloads = await readSkillPreloads(
    preloadInput(root, [], { knownSkills: ["acme-rules"], skillSources: undefined }),
  );

  // assert
  assert.deepStrictEqual(preloads, new Map());
});

test("propagates the read error of a named skill", async (t) => {
  // arrange
  const root = await createPluginTree(t);
  const missing: AgentSkillSource = {
    generatedName: "acme-rules",
    sourcePath: path.join(root, "skills", "rules"),
    targetPath: `${TARGET_ROOT}/acme-rules`,
  };

  // act & assert
  await assert.rejects(readSkillPreloads(preloadInput(root, [missing])), {
    code: "ENOENT",
    path: path.join(root, "skills", "rules", "SKILL.md"),
  });
});
