import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { NODE_PROJECT_SKILL_LEDGER } from "../../extensions/pi-claude-marketplace/bridges/skills/project-installs.ts";
import { loadQualifiedSkillAliases } from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  SkillAliasDependencies,
  SkillAliasState,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type Command = ReturnType<ExtensionAPI["getCommands"]>[number];

const AGENT_DIR = "/agent";
const CWD = "/work";
const PROJECT_ROOT = path.join(CWD, ".pi");

/** The staged `SKILL.md` path of `generatedName` under the scope root `root`. */
function stagedPath(root: string, generatedName: string): string {
  return path.join(root, "pi-claude-marketplace", "resources", "skills", generatedName, "SKILL.md");
}

/** A staged `SKILL.md` whose record stores `names`. */
function recordedSkill(generatedName: string, names: readonly string[]): string {
  return [
    "---",
    `name: ${generatedName}`,
    "description: A skill.",
    `pi-claude-marketplace: {"names":${JSON.stringify(names)},"pluginRoot":"/plugin","pluginData":"/data"}`,
    "---",
    "",
    "Body.",
    "",
  ].join("\n");
}

/** A staged `SKILL.md` written before install stored the record. */
function unrecordedSkill(generatedName: string): string {
  return `---\nname: ${generatedName}\ndescription: A skill.\n---\n\nBody.\n`;
}

/** A command Pi loaded from the skill file `file`. */
function skillCommand(generatedName: string, file: string): Command {
  return {
    name: `skill:${generatedName}`,
    source: "skill",
    sourceInfo: { path: file, source: "user", scope: "user", origin: "top-level" },
  };
}

/** A prompt-template command named `name`. */
function promptCommand(name: string): Command {
  return {
    name,
    source: "prompt",
    sourceInfo: {
      path: `/agent/prompts/${name}.md`,
      source: "user",
      scope: "user",
      origin: "top-level",
    },
  };
}

/** One marketplace whose plugins hold the given generated skill names. */
function stateWith(plugins: Readonly<Record<string, readonly string[]>>): SkillAliasState {
  return {
    marketplaces: {
      fixtures: {
        plugins: Object.fromEntries(
          Object.entries(plugins).map(([plugin, skills]) => [plugin, { resources: { skills } }]),
        ),
      },
    },
  };
}

const LEDGER = "/agent/pi-claude-marketplace/project-installs.json";

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** D-CF2-13: a user ledger that lists `skills` (name to staged bytes) for the project `project`. */
function ledgerText(project: string, skills: Readonly<Record<string, string>>): string {
  const listed = Object.entries(skills).map(
    ([name, content]) => [name, { plugin: "demo", sha256: sha256(content) }] as const,
  );
  return JSON.stringify({ version: 1, projects: { [project]: Object.fromEntries(listed) } });
}

/** A ledger that lists every project skill among `files` with the digest of its bytes. */
function provingLedger(files: Readonly<Record<string, string>>): string {
  const projectSkills = Object.entries(files)
    .filter(([file]) => file.startsWith(`${PROJECT_ROOT}/`))
    .map(([file, content]) => [path.basename(path.dirname(file)), content] as const);
  return ledgerText(CWD, Object.fromEntries(projectSkills));
}

/**
 * Dependencies over in-memory states per scope root, in-memory files, and the
 * user ledger `ledger` (by default one that lists each project skill among
 * `files`, and none for `null`).
 */
function dependencies(
  states: Readonly<Record<string, SkillAliasState>>,
  readable: Readonly<Record<string, string>>,
  ledger: string | null = provingLedger(readable),
): SkillAliasDependencies {
  const files = ledger === null ? readable : { ...readable, [LEDGER]: ledger };
  return {
    getAgentDir: () => AGENT_DIR,
    loadState: (extensionRoot) => {
      const state = states[path.dirname(extensionRoot)];
      return state === undefined
        ? Promise.reject(new Error(`no state under ${extensionRoot}`))
        : Promise.resolve(state);
    },
    readFile: (file) => {
      const text = files[file];
      return text === undefined
        ? Promise.reject(new Error(`unreadable ${file}`))
        : Promise.resolve(text);
    },
  };
}

/** Pi, answering `getCommands()` once with `commands`. */
function piWith(commands: readonly Command[]): ExtensionAPI {
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn([...commands])
    .times(1);
  return pi;
}

test("D-CF2-02: maps each name a loaded skill stored to its generated name", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", file)]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }) },
      { [file]: recordedSkill("demo-review", ["demo:review", "demo:fancy", "fancy"]) },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", "demo-review"],
      ["demo:fancy", "demo-review"],
      ["fancy", "demo-review"],
    ],
  );
  verify(pi);
});

test("D-CF2-02: a skill with a record no longer answers to the name its plugin prefix was cut from", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-tool");
  const pi = piWith([skillCommand("demo-tool", file)]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [PROJECT_ROOT]: stateWith({ demo: ["demo-tool"] }) },
      { [file]: recordedSkill("demo-tool", ["demo:demo-tool", "demo-tool"]) },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:demo-tool", "demo-tool"],
      ["demo-tool", "demo-tool"],
    ],
  );
  verify(pi);
});

test("DC-25: a skill staged without a record keeps the alias its plugin prefix was cut from", async () => {
  // arrange
  const skills = ["foo-bar", "foo", "other"];
  const files = Object.fromEntries(
    skills.map((name) => [stagedPath(AGENT_DIR, name), unrecordedSkill(name)]),
  );
  const pi = piWith(skills.map((name) => skillCommand(name, stagedPath(AGENT_DIR, name))));

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies({ [AGENT_DIR]: stateWith({ foo: skills }) }, files),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["foo:bar", "foo-bar"],
      ["foo:foo", "foo"],
    ],
  );
  verify(pi);
});

test("DC-25: a skill staged without a record under a plugin name that names no skill has no alias", async () => {
  // arrange
  const file = stagedPath(AGENT_DIR, "invalid");
  const pi = piWith([skillCommand("invalid", file)]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies({ [AGENT_DIR]: stateWith({ "": ["invalid"] }) }, { [file]: unrecordedSkill("x") }),
  );

  // assert
  assert.deepStrictEqual([...aliases], []);
  verify(pi);
});

const BROKEN_FILE = stagedPath(PROJECT_ROOT, "demo-broken");

for (const { problem, brokenFiles } of [
  { problem: "cannot be read", brokenFiles: {} },
  {
    problem: "has frontmatter that does not parse",
    brokenFiles: { [BROKEN_FILE]: "---\nname: [unclosed\n---\n\nBody.\n" },
  },
]) {
  test(`D-CF2-02: a loaded skill whose staged file ${problem} adds no alias`, async () => {
    // arrange
    const kept = stagedPath(PROJECT_ROOT, "demo-greet");
    const files = { ...brokenFiles, [kept]: recordedSkill("demo-greet", ["demo:greet"]) };
    const pi = piWith([skillCommand("demo-broken", BROKEN_FILE), skillCommand("demo-greet", kept)]);

    // act
    const aliases = await loadQualifiedSkillAliases(
      pi,
      CWD,
      true,
      dependencies({ [PROJECT_ROOT]: stateWith({ demo: ["demo-broken", "demo-greet"] }) }, files),
    );

    // assert
    assert.deepStrictEqual([...aliases], [["demo:greet", "demo-greet"]]);
    verify(pi);
  });
}

test("D-CF2-02: a skill whose staged file Pi did not load adds no alias", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", "/elsewhere/demo-review/SKILL.md")]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }) },
      { [file]: recordedSkill("demo-review", ["demo:review", "demo:fancy", "fancy"]) },
    ),
  );

  // assert
  assert.deepStrictEqual([...aliases], []);
  verify(pi);
});

test("T-02-17: an untrusted project adds no alias, while the user scope still does", async () => {
  // arrange
  const projectFile = stagedPath(PROJECT_ROOT, "demo-review");
  const userFile = stagedPath(AGENT_DIR, "tools-lint");
  const pi = piWith([
    skillCommand("demo-review", projectFile),
    skillCommand("tools-lint", userFile),
  ]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    false,
    dependencies(
      {
        [AGENT_DIR]: stateWith({ tools: ["tools-lint"] }),
        [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }),
      },
      {
        [userFile]: recordedSkill("tools-lint", ["tools:lint"]),
        [projectFile]: recordedSkill("demo-review", ["demo:review", "review"]),
      },
    ),
  );

  // assert
  assert.deepStrictEqual([...aliases], [["tools:lint", "tools-lint"]]);
  verify(pi);
});

test("T-02-17: keeps only the stored names install writes: the plugin's own prefix and one bare name", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", file)]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }) },
      {
        [file]: recordedSkill("demo-review", [
          "demo:review",
          "other:review",
          "review",
          "commit",
          "demo:other:thing",
        ]),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", "demo-review"],
      ["review", "demo-review"],
      ["demo:other:thing", "demo-review"],
    ],
  );
  verify(pi);
});

test("SK-6: a name that a command of another source has stays with that command", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", file), promptCommand("fancy")]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }) },
      { [file]: recordedSkill("demo-review", ["demo:review", "demo:fancy", "fancy"]) },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", "demo-review"],
      ["demo:fancy", "demo-review"],
    ],
  );
  verify(pi);
});

test("D-CF2-02: a name the user scope claimed is not mapped again by the project scope", async () => {
  // arrange
  const userFile = stagedPath(AGENT_DIR, "tools-same");
  const projectFile = stagedPath(PROJECT_ROOT, "demo-same");
  const pi = piWith([skillCommand("tools-same", userFile), skillCommand("demo-same", projectFile)]);

  // act
  const aliases = await loadQualifiedSkillAliases(
    pi,
    CWD,
    true,
    dependencies(
      {
        [AGENT_DIR]: stateWith({ tools: ["tools-same"] }),
        [PROJECT_ROOT]: stateWith({ demo: ["demo-same"] }),
      },
      {
        [userFile]: recordedSkill("tools-same", ["tools:same", "same"]),
        [projectFile]: recordedSkill("demo-same", ["demo:same", "same"]),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["tools:same", "tools-same"],
      ["same", "tools-same"],
      ["demo:same", "demo-same"],
    ],
  );
  verify(pi);
});

test("D-CF2-02: reads the project scope when the user scope state cannot be read", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "foo-bar");
  const pi = piWith([skillCommand("foo-bar", file)]);
  const loadedRoots: string[] = [];
  const projectOnly = dependencies(
    { [PROJECT_ROOT]: stateWith({ foo: ["foo-bar"] }) },
    { [file]: recordedSkill("foo-bar", ["foo:foo-bar"]) },
  );

  // act
  const aliases = await loadQualifiedSkillAliases(pi, CWD, true, {
    ...projectOnly,
    loadState: (extensionRoot) => {
      loadedRoots.push(extensionRoot);
      return projectOnly.loadState(extensionRoot);
    },
  });

  // assert
  assert.deepStrictEqual([...aliases], [["foo:foo-bar", "foo-bar"]]);
  assert.deepStrictEqual(loadedRoots, [
    path.join(AGENT_DIR, "pi-claude-marketplace"),
    path.join(PROJECT_ROOT, "pi-claude-marketplace"),
  ]);
  verify(pi);
});

// The invariant: every stored name of every loaded skill maps to that skill
// unless a command of another source or an earlier claim holds it.
for (const { claimants, reservedNames, expectedAliases } of [
  {
    claimants: [{ skill: "demo-a", names: ["demo:a", "demo:x", "x"] }],
    reservedNames: [],
    expectedAliases: [
      ["demo:a", "demo-a"],
      ["demo:x", "demo-a"],
      ["x", "demo-a"],
    ],
  },
  {
    claimants: [
      { skill: "demo-a", names: ["demo:a", "demo:same", "same"] },
      { skill: "demo-b", names: ["demo:b", "demo:same", "same"] },
    ],
    reservedNames: [],
    expectedAliases: [
      ["demo:a", "demo-a"],
      ["demo:same", "demo-a"],
      ["same", "demo-a"],
      ["demo:b", "demo-b"],
    ],
  },
  {
    claimants: [
      { skill: "demo-a", names: ["demo:a", "demo:b"] },
      { skill: "demo-b", names: ["demo:b"] },
    ],
    reservedNames: ["demo:a"],
    expectedAliases: [["demo:b", "demo-a"]],
  },
  {
    claimants: [{ skill: "demo-a", names: [] }],
    reservedNames: [],
    expectedAliases: [],
  },
]) {
  test(`D-CF2-02: ${claimants.map(({ skill, names }) => `${skill} [${names.join(" ")}]`).join(", ")} with [${reservedNames.join(" ")}] reserved maps ${expectedAliases.length} name(s)`, async () => {
    // arrange
    const files = Object.fromEntries(
      claimants.map(({ skill, names }) => [
        stagedPath(PROJECT_ROOT, skill),
        recordedSkill(skill, names),
      ]),
    );
    const pi = piWith([
      ...claimants.map(({ skill }) => skillCommand(skill, stagedPath(PROJECT_ROOT, skill))),
      ...reservedNames.map(promptCommand),
    ]);

    // act
    const aliases = await loadQualifiedSkillAliases(
      pi,
      CWD,
      true,
      dependencies(
        { [PROJECT_ROOT]: stateWith({ demo: claimants.map(({ skill }) => skill) }) },
        files,
      ),
    );

    // assert
    assert.deepStrictEqual([...aliases], expectedAliases);
    verify(pi);
  });
}

test("D-CF2-02: reads the staged skill file from disk with the production reader", async (t) => {
  // arrange
  const { agentDir, cwd } = await createHermeticEnvironment(t, "skill-alias-state-");
  const projectRoot = path.join(cwd, ".pi");
  const file = stagedPath(projectRoot, "demo-review");
  await mkdir(path.dirname(file), { recursive: true });
  const content = recordedSkill("demo-review", ["demo:review", "fancy"]);
  await writeFile(file, content, "utf8");
  await NODE_PROJECT_SKILL_LEDGER.update({
    projectPath: cwd,
    forget: [],
    remember: new Map([["demo-review", { plugin: "demo", sha256: sha256(content) }]]),
  });
  const pi = piWith([skillCommand("demo-review", file)]);

  // act
  const aliases = await loadQualifiedSkillAliases(pi, cwd, true, {
    getAgentDir: () => agentDir,
    loadState: (extensionRoot) =>
      extensionRoot === path.join(projectRoot, "pi-claude-marketplace")
        ? Promise.resolve(stateWith({ demo: ["demo-review"] }))
        : Promise.reject(new Error(`no state under ${extensionRoot}`)),
  });

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", "demo-review"],
      ["fancy", "demo-review"],
    ],
  );
  verify(pi);
});

for (const { title, ledger } of [
  { title: "lists no project", ledger: () => null },
  {
    title: "lists another digest for the skill",
    ledger: () => ledgerText(CWD, { "demo-review": recordedSkill("demo-review", ["demo:other"]) }),
  },
  {
    title: "lists the skill for another project",
    ledger: () =>
      ledgerText("/elsewhere", { "demo-review": recordedSkill("demo-review", ["fancy"]) }),
  },
]) {
  test(`D-CF2-13: a project skill claims no name when the user ledger ${title}, and a user skill still does`, async () => {
    // arrange
    const projectFile = stagedPath(PROJECT_ROOT, "demo-review");
    const userFile = stagedPath(AGENT_DIR, "tools-lint");
    const pi = piWith([
      skillCommand("tools-lint", userFile),
      skillCommand("demo-review", projectFile),
    ]);

    // act
    const aliases = await loadQualifiedSkillAliases(
      pi,
      CWD,
      true,
      dependencies(
        {
          [AGENT_DIR]: stateWith({ tools: ["tools-lint"] }),
          [PROJECT_ROOT]: stateWith({ demo: ["demo-review"] }),
        },
        {
          [userFile]: recordedSkill("tools-lint", ["tools:lint"]),
          [projectFile]: recordedSkill("demo-review", ["demo:review", "fancy"]),
        },
        ledger(),
      ),
    );

    // assert
    assert.deepStrictEqual([...aliases], [["tools:lint", "tools-lint"]]);
    verify(pi);
  });
}
