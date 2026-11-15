import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  createPluginNamesCache,
  loadPluginNames,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  PluginAliasTarget,
  PluginNames,
  SkillAliasDependencies,
  SkillAliasState,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type Command = ReturnType<ExtensionAPI["getCommands"]>[number];

const AGENT_DIR = "/agent";
const CWD = "/work";
const PROJECT_ROOT = path.join(CWD, ".pi");

/** The alias table of the plugin names that `loadPluginNames` gives. */
async function loadPluginAliases(
  ...args: Parameters<typeof loadPluginNames>
): Promise<PluginNames["aliases"]> {
  return (await loadPluginNames(...args)).aliases;
}

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

/** Dependencies over in-memory states per scope root and in-memory files. */
function dependencies(
  states: Readonly<Record<string, SkillAliasState>>,
  files: Readonly<Record<string, string>>,
): SkillAliasDependencies {
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
  const aliases = await loadPluginAliases(
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
      ["demo:review", skill("demo-review")],
      ["demo:fancy", skill("demo-review")],
      ["fancy", skill("demo-review")],
    ],
  );
  verify(pi);
});

test("D-CF2-02: a skill with a record answers only to its stored names, not to the name its plugin prefix was cut from", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-tool");
  const pi = piWith([skillCommand("demo-tool", file)]);

  // act
  const aliases = await loadPluginAliases(
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
      ["demo:demo-tool", skill("demo-tool")],
      ["demo-tool", skill("demo-tool")],
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
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies({ [AGENT_DIR]: stateWith({ foo: skills }) }, files),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["foo:bar", skill("foo-bar")],
      ["foo:foo", skill("foo")],
    ],
  );
  verify(pi);
});

test("DC-25: a skill staged without a record under a plugin name that names no skill has no alias", async () => {
  // arrange
  const file = stagedPath(AGENT_DIR, "invalid");
  const pi = piWith([skillCommand("invalid", file)]);

  // act
  const aliases = await loadPluginAliases(
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
    const aliases = await loadPluginAliases(
      pi,
      CWD,
      true,
      dependencies({ [PROJECT_ROOT]: stateWith({ demo: ["demo-broken", "demo-greet"] }) }, files),
    );

    // assert
    assert.deepStrictEqual([...aliases], [["demo:greet", skill("demo-greet")]]);
    verify(pi);
  });
}

test("D-CF2-02: a skill whose staged file Pi did not load adds no alias", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", "/elsewhere/demo-review/SKILL.md")]);

  // act
  const aliases = await loadPluginAliases(
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
  const aliases = await loadPluginAliases(
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
  assert.deepStrictEqual([...aliases], [["tools:lint", skill("tools-lint")]]);
  verify(pi);
});

test("T-02-17: keeps only the stored names install writes: the plugin's own prefix and one bare name", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", file)]);

  // act
  const aliases = await loadPluginAliases(
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
      ["demo:review", skill("demo-review")],
      ["review", skill("demo-review")],
      ["demo:other:thing", skill("demo-review")],
    ],
  );
  verify(pi);
});

test("SK-6: a name that a command of another source has stays with that command", async () => {
  // arrange
  const file = stagedPath(PROJECT_ROOT, "demo-review");
  const pi = piWith([skillCommand("demo-review", file), promptCommand("fancy")]);

  // act
  const aliases = await loadPluginAliases(
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
      ["demo:review", skill("demo-review")],
      ["demo:fancy", skill("demo-review")],
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
  const aliases = await loadPluginAliases(
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
      ["tools:same", skill("tools-same")],
      ["same", skill("tools-same")],
      ["demo:same", skill("demo-same")],
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
  const aliases = await loadPluginAliases(pi, CWD, true, {
    ...projectOnly,
    loadState: (extensionRoot) => {
      loadedRoots.push(extensionRoot);
      return projectOnly.loadState(extensionRoot);
    },
  });

  // assert
  assert.deepStrictEqual([...aliases], [["foo:foo-bar", skill("foo-bar")]]);
  assert.deepStrictEqual(loadedRoots, [
    path.join(AGENT_DIR, "pi-claude-marketplace"),
    path.join(PROJECT_ROOT, "pi-claude-marketplace"),
  ]);
  verify(pi);
});

test("D-CF2-02: logs the scope root whose state cannot be read", async (t) => {
  // arrange
  const diagnostics = captureDebugLog(t);
  const pi = piWith([]);

  // act
  await loadPluginAliases(pi, CWD, false, dependencies({}, {}));

  // assert
  assert.deepStrictEqual(diagnostics, [
    `[skills] skill aliases skip the state under ${AGENT_DIR}: no state under ${path.join(AGENT_DIR, "pi-claude-marketplace")}`,
  ]);
  verify(pi);
});

test("D-CF2-02: logs the staged file that cannot be read", async (t) => {
  // arrange
  const diagnostics = captureDebugLog(t);
  const file = stagedPath(PROJECT_ROOT, "demo-broken");
  const pi = piWith([skillCommand("demo-broken", file)]);

  // act
  await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies({ [PROJECT_ROOT]: stateWith({ demo: ["demo-broken"] }) }, {}),
  );

  // assert
  assert.deepStrictEqual(diagnostics, [
    `[skills] skill aliases skip the state under ${AGENT_DIR}: no state under ${path.join(AGENT_DIR, "pi-claude-marketplace")}`,
    `[skills] skill aliases skip ${file}: unreadable ${file}`,
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
      ["demo:a", skill("demo-a")],
      ["demo:x", skill("demo-a")],
      ["x", skill("demo-a")],
    ],
  },
  {
    claimants: [
      { skill: "demo-a", names: ["demo:a", "demo:same", "same"] },
      { skill: "demo-b", names: ["demo:b", "demo:same", "same"] },
    ],
    reservedNames: [],
    expectedAliases: [
      ["demo:a", skill("demo-a")],
      ["demo:same", skill("demo-a")],
      ["same", skill("demo-a")],
      ["demo:b", skill("demo-b")],
    ],
  },
  {
    claimants: [
      { skill: "demo-a", names: ["demo:a", "demo:b"] },
      { skill: "demo-b", names: ["demo:b"] },
    ],
    reservedNames: ["demo:a"],
    expectedAliases: [["demo:b", skill("demo-a")]],
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
    const aliases = await loadPluginAliases(
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
  const pi = piWith([skillCommand("demo-review", file)]);

  // act
  const aliases = await loadPluginAliases(pi, cwd, true, {
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
      ["demo:review", skill("demo-review")],
      ["fancy", skill("demo-review")],
    ],
  );
  verify(pi);
});

/** The table target of the bridged skill `generatedName`. */
function skill(generatedName: string): PluginAliasTarget {
  return { kind: "skill", generatedName };
}

/** The table target of the bridged command `name`. */
function command(name: string): PluginAliasTarget {
  return { kind: "command", name };
}

/** The staged command file of `name` under the scope root `root`. */
function stagedCommandPath(root: string, name: string): string {
  return path.join(root, "pi-claude-marketplace", "resources", "prompts", `${name}.md`);
}

/** A staged command file whose frontmatter `name` is `frontmatterName`. */
function namedCommand(frontmatterName: string): string {
  return `---\nname: ${frontmatterName}\ndescription: A command.\n---\n\nBody.\n`;
}

/**
 * A staged command file whose record stores `claudeName`, or no Claude Code
 * name when it is `undefined`, with the frontmatter `name` `frontmatterName`
 * when one is given.
 */
function recordedCommand(claudeName: string | undefined, frontmatterName?: string): string {
  const record = {
    pluginRoot: "/plugin",
    pluginData: "/data",
    ...(claudeName !== undefined && { claudeName }),
  };
  return [
    "---",
    ...(frontmatterName === undefined ? [] : [`name: ${frontmatterName}`]),
    "description: A command.",
    `pi-claude-marketplace: ${JSON.stringify(record)}`,
    "---",
    "",
    "Body.",
    "",
  ].join("\n");
}

/** A command Pi loaded from the prompt file `file`. */
function stagedPromptCommand(name: string, file: string): Command {
  return {
    name,
    source: "prompt",
    sourceInfo: { path: file, source: "user", scope: "user", origin: "top-level" },
  };
}

/** One marketplace whose plugins hold the given skills and command (prompt) names. */
function stateWithCommands(
  plugins: Readonly<Record<string, { skills?: readonly string[]; prompts: readonly string[] }>>,
): SkillAliasState {
  return {
    marketplaces: {
      fixtures: {
        plugins: Object.fromEntries(
          Object.entries(plugins).map(([plugin, { skills = [], prompts }]) => [
            plugin,
            { resources: { skills, prompts } },
          ]),
        ),
      },
    },
  };
}

test("D-CF2-02: maps a loaded command's frontmatter name aliases to the command's Pi name", async () => {
  // arrange
  const file = stagedCommandPath(AGENT_DIR, "demo:ship");
  const pi = piWith([stagedPromptCommand("demo:ship", file)]);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [AGENT_DIR]: stateWithCommands({ demo: { prompts: ["demo:ship"] } }) },
      { [file]: namedCommand("fancy") },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:fancy", command("demo:ship")],
      ["fancy", command("demo:ship")],
    ],
  );
  verify(pi);
});

test("D-PG11-01: maps the Claude Code name a loaded command's record stores to the command's Pi name", async () => {
  // arrange
  const file = stagedCommandPath(AGENT_DIR, "demo:lint");
  const pi = piWith([stagedPromptCommand("demo:lint", file)]);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [AGENT_DIR]: stateWithCommands({ demo: { prompts: ["demo:lint"] } }) },
      { [file]: recordedCommand("demo:demo-lint") },
    ),
  );

  // assert
  assert.deepStrictEqual([...aliases], [["demo:demo-lint", command("demo:lint")]]);
  verify(pi);
});

for (const { title, claudeName, otherCommands } of [
  { title: "is the command's own Pi name", claudeName: "demo:lint", otherCommands: [] },
  {
    title: "is the Pi name of another loaded command",
    claudeName: "demo:demo-lint",
    otherCommands: [promptCommand("demo:demo-lint")],
  },
  { title: "is under another plugin's prefix", claudeName: "other:lint", otherCommands: [] },
  { title: "holds whitespace", claudeName: "demo:demo lint", otherCommands: [] },
]) {
  test(`D-PG11-01 / T-02-17: a stored Claude Code name that ${title} adds no alias`, async () => {
    // arrange
    const file = stagedCommandPath(AGENT_DIR, "demo:lint");
    const pi = piWith([stagedPromptCommand("demo:lint", file), ...otherCommands]);

    // act
    const aliases = await loadPluginAliases(
      pi,
      CWD,
      true,
      dependencies(
        { [AGENT_DIR]: stateWithCommands({ demo: { prompts: ["demo:lint"] } }) },
        { [file]: recordedCommand(claudeName, "fancy") },
      ),
    );

    // assert
    assert.deepStrictEqual(
      [...aliases],
      [
        ["demo:fancy", command("demo:lint")],
        ["fancy", command("demo:lint")],
      ],
    );
    verify(pi);
  });
}

test("D-PG11-01: a command staged with no stored Claude Code name answers to its frontmatter name aliases only", async () => {
  // arrange
  const file = stagedCommandPath(AGENT_DIR, "demo:lint");
  const pi = piWith([stagedPromptCommand("demo:lint", file)]);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [AGENT_DIR]: stateWithCommands({ demo: { prompts: ["demo:lint"] } }) },
      { [file]: recordedCommand(undefined, "fancy") },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:fancy", command("demo:lint")],
      ["fancy", command("demo:lint")],
    ],
  );
  verify(pi);
});

test("D-PG11-01: a stored Claude Code name a skill already claimed stays with the skill", async () => {
  // arrange
  const skillFile = stagedPath(AGENT_DIR, "demo-review");
  const commandFile = stagedCommandPath(AGENT_DIR, "demo:lint");
  const pi = piWith([
    skillCommand("demo-review", skillFile),
    stagedPromptCommand("demo:lint", commandFile),
  ]);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      {
        [AGENT_DIR]: stateWithCommands({
          demo: { skills: ["demo-review"], prompts: ["demo:lint"] },
        }),
      },
      {
        [skillFile]: recordedSkill("demo-review", ["demo:review", "demo:demo-lint"]),
        [commandFile]: recordedCommand("demo:demo-lint"),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", skill("demo-review")],
      ["demo:demo-lint", skill("demo-review")],
    ],
  );
  verify(pi);
});

test("D-CF2-02: a command whose frontmatter name is its own file name answers to the bare name only", async () => {
  // arrange
  const file = stagedCommandPath(AGENT_DIR, "demo:ship");
  const pi = piWith([stagedPromptCommand("demo:ship", file)]);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      { [AGENT_DIR]: stateWithCommands({ demo: { prompts: ["demo:ship"] } }) },
      { [file]: namedCommand("ship") },
    ),
  );

  // assert
  assert.deepStrictEqual([...aliases], [["ship", command("demo:ship")]]);
  verify(pi);
});

for (const { title, projectTrusted, expectedAliases } of [
  {
    title: "Pi trusts the project",
    projectTrusted: true,
    expectedAliases: [
      ["demo:fancy", command("demo:ship")],
      ["fancy", command("demo:ship")],
    ],
  },
  { title: "Pi does not trust the project", projectTrusted: false, expectedAliases: [] },
]) {
  test(`D-LOC-01: a project command claims its names only when ${title}`, async () => {
    // arrange
    const file = stagedCommandPath(PROJECT_ROOT, "demo:ship");
    const pi = piWith([stagedPromptCommand("demo:ship", file)]);

    // act
    const aliases = await loadPluginAliases(
      pi,
      CWD,
      projectTrusted,
      dependencies(
        { [PROJECT_ROOT]: stateWithCommands({ demo: { prompts: ["demo:ship"] } }) },
        { [file]: namedCommand("fancy") },
      ),
    );

    // assert
    assert.deepStrictEqual([...aliases], expectedAliases);
    verify(pi);
  });
}

test("D-CF2-02: the plugin table keeps every skill alias and gives a command the names no skill claimed", async () => {
  // arrange
  const skillFile = stagedPath(AGENT_DIR, "demo-review");
  const shipFile = stagedCommandPath(AGENT_DIR, "demo:ship");
  const deployFile = stagedCommandPath(AGENT_DIR, "demo:deploy");
  const commands = [
    skillCommand("demo-review", skillFile),
    stagedPromptCommand("demo:ship", shipFile),
    stagedPromptCommand("demo:deploy", deployFile),
  ];
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  when(() => pi.getCommands())
    .thenReturn(commands)
    .times(1);

  // act
  const aliases = await loadPluginAliases(
    pi,
    CWD,
    true,
    dependencies(
      {
        [AGENT_DIR]: stateWithCommands({
          demo: { skills: ["demo-review"], prompts: ["demo:ship", "demo:deploy"] },
        }),
      },
      {
        [skillFile]: recordedSkill("demo-review", ["demo:review", "demo:fancy", "fancy"]),
        [shipFile]: namedCommand("fancy"),
        [deployFile]: namedCommand("release"),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...aliases],
    [
      ["demo:review", { kind: "skill", generatedName: "demo-review" }],
      ["demo:fancy", { kind: "skill", generatedName: "demo-review" }],
      ["fancy", { kind: "skill", generatedName: "demo-review" }],
      ["demo:release", { kind: "command", name: "demo:deploy" }],
      ["release", { kind: "command", name: "demo:deploy" }],
    ],
  );
  verify(pi);
});

test("D-PG6-19: gives each loaded skill its stored identity, a skill with no record its legacy alias, and an unreadable skill no name", async () => {
  // arrange
  const recorded = stagedPath(AGENT_DIR, "demo-review");
  const legacy = stagedPath(AGENT_DIR, "demo-status");
  const unreadable = stagedPath(AGENT_DIR, "demo-broken");
  const pi = piWith([
    skillCommand("demo-review", recorded),
    skillCommand("demo-status", legacy),
    skillCommand("demo-broken", unreadable),
  ]);

  // act
  const names = await loadPluginNames(
    pi,
    CWD,
    false,
    dependencies(
      { [AGENT_DIR]: stateWith({ demo: ["demo-review", "demo-status", "demo-broken"] }) },
      {
        [recorded]: recordedSkill("demo-review", ["demo:review", "fancy"]),
        [legacy]: unrecordedSkill("demo-status"),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    [...names.skills],
    [
      ["demo-review", "demo:review"],
      ["demo-status", "demo:status"],
    ],
  );
  verify(pi);
});

test("D-PG6-19: a skill keeps its own name when another skill or a command of another source took it", async () => {
  // arrange
  const first = stagedPath(AGENT_DIR, "demo-first");
  const second = stagedPath(AGENT_DIR, "demo-second");
  const pi = piWith([
    skillCommand("demo-first", first),
    skillCommand("demo-second", second),
    { ...promptCommand("demo:taken"), source: "extension" },
  ]);

  // act
  const names = await loadPluginNames(
    pi,
    CWD,
    false,
    dependencies(
      { [AGENT_DIR]: stateWith({ demo: ["demo-first", "demo-second"] }) },
      {
        [first]: recordedSkill("demo-first", ["demo:taken", "demo:second"]),
        [second]: recordedSkill("demo-second", ["demo:second"]),
      },
    ),
  );

  // assert
  assert.deepStrictEqual(
    { aliases: [...names.aliases], skills: [...names.skills] },
    {
      aliases: [["demo:second", skill("demo-first")]],
      skills: [
        ["demo-first", "demo:taken"],
        ["demo-second", "demo:second"],
      ],
    },
  );
  verify(pi);
});

test("D-PG6-19: lists each loaded bridged command, with or without a frontmatter name, and no command Pi did not load", async () => {
  // arrange
  const named = stagedCommandPath(AGENT_DIR, "demo:ship");
  const plain = stagedCommandPath(AGENT_DIR, "demo:deploy");
  const pi = piWith([
    stagedPromptCommand("demo:ship", named),
    stagedPromptCommand("demo:deploy", plain),
  ]);

  // act
  const names = await loadPluginNames(
    pi,
    CWD,
    false,
    dependencies(
      {
        [AGENT_DIR]: stateWithCommands({
          demo: { prompts: ["demo:ship", "demo:deploy", "demo:unloaded"] },
        }),
      },
      { [named]: namedCommand("fancy"), [plain]: "Deploy.\n" },
    ),
  );

  // assert
  assert.deepStrictEqual([...names.commands], ["demo:ship", "demo:deploy"]);
  verify(pi);
});

/** A plugin name table that holds the one alias `alias`. */
function namesWith(alias: string): PluginNames {
  return {
    aliases: new Map([[alias, skill("demo-review")]]),
    skills: new Map(),
    commands: new Set(),
  };
}

test("D-PG6-18: the name cache loads once for a directory and trust state, keeps trusted and untrusted apart, and loads again after clear", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const loads: string[] = [];
  const cache = createPluginNamesCache(pi, (loadPi, cwd, projectTrusted) => {
    assert.equal(loadPi, pi);
    loads.push(`${cwd} ${projectTrusted}`);
    return Promise.resolve(namesWith(`${cwd}:${loads.length}`));
  });

  // act
  const trusted = await cache.get(CWD, true);
  const again = await cache.get(CWD, true);
  const untrusted = await cache.get(CWD, false);
  cache.clear();
  const reloaded = await cache.get(CWD, true);

  // assert
  assert.deepStrictEqual(
    {
      loads,
      same: again === trusted,
      aliases: [trusted, untrusted, reloaded].map((names) => [...names.aliases.keys()]),
    },
    {
      loads: [`${CWD} true`, `${CWD} false`, `${CWD} true`],
      same: true,
      aliases: [[`${CWD}:1`], [`${CWD}:2`], [`${CWD}:3`]],
    },
  );
  verify(pi);
});

test("D-PG6-18: the name cache does not keep a rejected load", async () => {
  // arrange
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  let loads = 0;
  const cache = createPluginNamesCache(pi, () => {
    loads += 1;
    return loads === 1
      ? Promise.reject(new Error("state unreadable"))
      : Promise.resolve(namesWith("demo:review"));
  });

  // act
  const failed = await cache.get(CWD, true).then(
    () => "loaded",
    (err: unknown) => (err instanceof Error ? err.message : "not an error"),
  );
  const names = await cache.get(CWD, true);

  // assert
  assert.deepStrictEqual(
    { failed, loads, aliases: [...names.aliases.keys()] },
    { failed: "state unreadable", loads: 2, aliases: ["demo:review"] },
  );
  verify(pi);
});
