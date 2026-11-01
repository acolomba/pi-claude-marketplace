import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { NODE_PROJECT_SKILL_LEDGER } from "../../extensions/pi-claude-marketplace/bridges/skills/project-installs.ts";
import { invokeBridgedSkill } from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import { parseFrontmatter } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { SkillAliasState } from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import type {
  SkillInvocationDependencies,
  SkillInvocationRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  PromptShellHost,
  PromptShellRequest,
  PromptShellResult,
} from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

const AGENT_DIR = "/agent";
const CWD = "/work";
const PROJECT_SKILL_DIR = "/work/.pi/pi-claude-marketplace/resources/skills/demo-greet";
const PROJECT_SKILL = `${PROJECT_SKILL_DIR}/SKILL.md`;
const USER_SKILL_DIR = "/agent/pi-claude-marketplace/resources/skills/demo-greet";
const USER_SKILL = `${USER_SKILL_DIR}/SKILL.md`;
const RECORD =
  'pi-claude-marketplace: {"names":["demo:greet"],"pluginRoot":"/plugins/demo","pluginData":"/data/demo"}';

/** A staged skill whose body runs a command that a forged copy would run. */
const STATUS_SKILL = [
  "---",
  "name: demo-greet",
  "description: Greets.",
  "---",
  "",
  "Status: !`printf ran`",
].join("\n");

const host = {
  platform: "linux",
  env: { PATH: "/usr/bin" },
  isFile: () => false,
  signalGroup: () => {
    throw new Error("an invocation without a command must not signal a process");
  },
} satisfies PromptShellHost;

function skillCommand(name: string, file: string, baseDir?: string): PiCommand {
  return {
    name,
    source: "skill",
    sourceInfo: {
      path: file,
      source: "extension",
      scope: "temporary",
      origin: "top-level",
      ...(baseDir === undefined ? {} : { baseDir }),
    },
  };
}

function skillFile(body: string, frontmatter: readonly string[] = []): string {
  return ["---", "name: demo-greet", "description: Greets.", ...frontmatter, "---", "", body].join(
    "\n",
  );
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
    .filter(([file]) => file.startsWith(`${CWD}/.pi/`))
    .map(([file, content]) => [path.basename(path.dirname(file)), content] as const);
  return ledgerText(CWD, Object.fromEntries(projectSkills));
}

/** The project's `state.json`: plugin `demo` of marketplace `fixtures` staged `demo-greet`. */
const OWNER_STATE: SkillAliasState = {
  marketplaces: {
    fixtures: {
      plugins: {
        other: { resources: { skills: ["other-skill"] } },
        demo: { resources: { skills: ["demo-greet"] } },
      },
    },
  },
};

/**
 * Reads only the named files and the user ledger, `ledger` (by default one
 * that lists each project skill among `files`, and none for `null`); any
 * other read fails the case. The project's `state.json` is `state`, and
 * `null` makes it unreadable.
 */
function dependencies(
  files: Readonly<Record<string, string>>,
  ledger: string | null = provingLedger(files),
  state: SkillAliasState | null = OWNER_STATE,
): SkillInvocationDependencies {
  const readable = ledger === null ? files : { ...files, [LEDGER]: ledger };
  return {
    getAgentDir: () => AGENT_DIR,
    readFile: (file) => {
      const content = readable[file];
      return content === undefined
        ? Promise.reject(new Error(`unexpected read of ${file}`))
        : Promise.resolve(content);
    },
    loadState: (extensionRoot) =>
      extensionRoot !== `${CWD}/.pi/pi-claude-marketplace` || state === null
        ? Promise.reject(new Error(`unexpected state read of ${extensionRoot}`))
        : Promise.resolve(state),
    host,
    runShell: () => Promise.reject(new Error("a body without a ! command must not run a shell")),
  };
}

function request(overrides: Partial<SkillInvocationRequest> = {}): SkillInvocationRequest {
  return {
    commands: [skillCommand("skill:demo-greet", PROJECT_SKILL)],
    generatedName: "demo-greet",
    typed: "/skill:demo-greet",
    args: "Ada",
    cwd: CWD,
    projectTrusted: true,
    sessionId: "session-1",
    thinkingLevel: "medium",
    ...overrides,
  };
}

function block(location: string, baseDir: string, body: string): string {
  return (
    `<skill name="demo-greet" location="${location}">\n` +
    `References are relative to ${baseDir}.\n\n${body}\n</skill>`
  );
}

test("D-CF2-06: frames a project skill's body with the typed arguments in Pi's skill block", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Greet the person named in the arguments.\n") };

  // act
  const outcome = await invokeBridgedSkill(request(), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(
      PROJECT_SKILL,
      PROJECT_SKILL_DIR,
      "Greet the person named in the arguments.\n\nARGUMENTS: Ada",
    ),
  });
});

test("D-CF2-06: frames a user skill under the agent directory", async () => {
  // arrange
  const files = { [USER_SKILL]: skillFile("Greet $ARGUMENTS.") };
  const commands = [skillCommand("skill:demo-greet", USER_SKILL)];

  // act
  const outcome = await invokeBridgedSkill(request({ commands }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(USER_SKILL, USER_SKILL_DIR, "Greet Ada."),
  });
});

test("T-02-17: aborts a project skill in an untrusted project without reading its file", async () => {
  // arrange
  const files = {};

  // act
  const outcome = await invokeBridgedSkill(
    request({ projectTrusted: false, typed: "/fancy" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message:
      "The skill /fancy belongs to the project /work, which Pi does not trust. " +
      "Trust the project folder, then run /reload to use it.",
  });
});

test("T-02-17: frames a user skill in an untrusted project", async () => {
  // arrange
  const files = { [USER_SKILL]: skillFile("Greet $ARGUMENTS.") };
  const commands = [skillCommand("skill:demo-greet", USER_SKILL)];

  // act
  const outcome = await invokeBridgedSkill(
    request({ commands, projectTrusted: false }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(USER_SKILL, USER_SKILL_DIR, "Greet Ada."),
  });
});

test("D-CF2-06: frames the skill with the directory of its file, not the discovering extension's", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Greet $ARGUMENTS.") };
  const commands = [skillCommand("skill:demo-greet", PROJECT_SKILL, "/extensions/marketplace")];

  // act
  const outcome = await invokeBridgedSkill(request({ commands }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Greet Ada."),
  });
});

test("D-CF2-06: passes no arguments as an empty text, so nothing is appended", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Greet everyone.") };

  // act
  const outcome = await invokeBridgedSkill(request({ args: "" }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Greet everyone."),
  });
});

test("D-CF2-06: frames an empty block for a body with no text", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("\n\n") };

  // act
  const outcome = await invokeBridgedSkill(request({ args: "" }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, ""),
  });
});

test("D-CF1-01: fills named arguments from the frontmatter arguments list", async () => {
  // arrange
  const files = {
    [PROJECT_SKILL]: skillFile("Hello $name from $place.", ["arguments: [name, place]"]),
  };

  // act
  const outcome = await invokeBridgedSkill(
    request({ args: "Ada 'New York'" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Hello Ada from New York."),
  });
});

test("D-CF2-06: fills the session, effort, skill, project, and plugin variables of a project skill", async () => {
  // arrange
  const body = [
    "session ${CLAUDE_SESSION_ID}",
    "effort ${CLAUDE_EFFORT}",
    "skill ${CLAUDE_SKILL_DIR}",
    "project ${CLAUDE_PROJECT_DIR}",
    "root ${CLAUDE_PLUGIN_ROOT}",
    "data ${CLAUDE_PLUGIN_DATA}",
  ].join("\n");
  const files = { [PROJECT_SKILL]: skillFile(body, [RECORD]) };

  // act
  const outcome = await invokeBridgedSkill(request({ args: "" }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(
      PROJECT_SKILL,
      PROJECT_SKILL_DIR,
      [
        "session session-1",
        "effort medium",
        `skill ${PROJECT_SKILL_DIR}`,
        "project /work",
        "root /plugins/demo",
        "data /data/demo",
      ].join("\n"),
    ),
  });
});

test("D-CF2-06: leaves the project and plugin variables of a user skill without a record literal", async () => {
  // arrange
  const body = "project ${CLAUDE_PROJECT_DIR} root ${CLAUDE_PLUGIN_ROOT} effort ${CLAUDE_EFFORT}";
  const files = { [USER_SKILL]: skillFile(body) };
  const commands = [skillCommand("skill:demo-greet", USER_SKILL)];

  // act
  const outcome = await invokeBridgedSkill(
    request({ commands, args: "", thinkingLevel: undefined }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(
      USER_SKILL,
      USER_SKILL_DIR,
      "project ${CLAUDE_PROJECT_DIR} root ${CLAUDE_PLUGIN_ROOT} effort high",
    ),
  });
});

test("D-CF2-06: expands a variable that a typed argument names", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Echo: $ARGUMENTS") };

  // act
  const outcome = await invokeBridgedSkill(
    request({ args: "${CLAUDE_SESSION_ID} ${CLAUDE_EFFORT}", thinkingLevel: "off" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Echo: session-1 low"),
  });
});

for (const { title, commands } of [
  {
    title: "a user's own Pi skill outside the staged skills directories",
    commands: [skillCommand("skill:demo-greet", "/agent/skills/demo-greet/SKILL.md")],
  },
  {
    title: "a staged skill file of another generated name",
    commands: [
      skillCommand(
        "skill:demo-greet",
        "/work/.pi/pi-claude-marketplace/resources/skills/x/SKILL.md",
      ),
    ],
  },
  { title: "a name Pi does not report", commands: [] },
  {
    title: "a name only a prompt template reports",
    commands: [{ ...skillCommand("skill:demo-greet", PROJECT_SKILL), source: "prompt" as const }],
  },
]) {
  test(`D-CF1-03: leaves ${title} to Pi without reading a file`, async () => {
    // arrange
    const files = {};

    // act
    const outcome = await invokeBridgedSkill(request({ commands }), dependencies(files));

    // assert
    assert.deepStrictEqual(outcome, { kind: "not-bridged" });
  });
}

test("aborts with a /reload hint when the staged skill file cannot be read", async () => {
  // arrange
  const files = {};

  // act
  const outcome = await invokeBridgedSkill(request(), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message:
      `Cannot read the skill /skill:demo-greet: unexpected read of ${PROJECT_SKILL}. ` +
      "Run /reload to load the installed skills again.",
  });
});

test("aborts with a /reload hint when the staged skill frontmatter does not parse", async () => {
  // arrange
  const content = "---\nname: [demo\n---\n\nStatus: !`printf ok`\n";
  const files = { [PROJECT_SKILL]: content };
  let parseFailure = "";
  try {
    parseFrontmatter(content);
  } catch (error) {
    parseFailure = error instanceof Error ? error.message : String(error);
  }

  // act
  const outcome = await invokeBridgedSkill(request({ typed: "/demo:greet" }), dependencies(files));

  // assert
  assert.notStrictEqual(parseFailure, "");
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message: `Cannot read the skill /demo:greet: ${parseFailure}. Run /reload to load the installed skills again.`,
  });
});

test("D-CF2-06: reads the staged skill file from disk with the production dependencies", async (t) => {
  // arrange
  const { cwd } = await createHermeticEnvironment(t, "skill-invocation-");
  const skillDir = path.join(
    cwd,
    ".pi",
    "pi-claude-marketplace",
    "resources",
    "skills",
    "demo-greet",
  );
  const file = path.join(skillDir, "SKILL.md");
  await mkdir(skillDir, { recursive: true });
  await writeFile(file, skillFile("Greet $0."), "utf8");
  await NODE_PROJECT_SKILL_LEDGER.update({
    projectPath: cwd,
    forget: [],
    remember: new Map([["demo-greet", { plugin: "demo", sha256: sha256(skillFile("Greet $0.")) }]]),
  });

  // act
  const outcome = await invokeBridgedSkill(
    request({ commands: [skillCommand("skill:demo-greet", file)], cwd }),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "ok", text: block(file, skillDir, "Greet Ada.") });
});

/** A shell that records each request and answers with `result`. */
function recordingShell(result: PromptShellResult): {
  readonly requests: PromptShellRequest[];
  readonly runShell: SkillInvocationDependencies["runShell"];
} {
  const requests: PromptShellRequest[] = [];
  return {
    requests,
    runShell: (shellRequest) => {
      requests.push(shellRequest);
      return Promise.resolve(result);
    },
  };
}

test("D-CF1-02: replaces a context command with its output, run by the chosen shell in the session directory", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Status: !`printf ok`", ["shell: bash"]) };
  const shell = recordingShell({
    kind: "exited",
    code: 0,
    stdout: "ok",
    stderr: "",
    shell: "bash",
  });

  // act
  const outcome = await invokeBridgedSkill(request({ args: "" }), {
    ...dependencies(files),
    runShell: shell.runShell,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Status: ok"),
  });
  assert.deepStrictEqual(shell.requests, [
    { command: "printf ok", shell: "bash", cwd: CWD, env: { PATH: "/usr/bin" } },
  ]);
});

test("T-01-22: substitutes before injection, so an argument that starts with ! runs nothing", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Echo: $ARGUMENTS") };

  // act
  const outcome = await invokeBridgedSkill(
    request({ args: "!`printf pwned`" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Echo: \\! `printf pwned`"),
  });
});

test("T-01-24: aborts with Claude Code's message when a context command fails", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Check: !`exit 3`") };
  const shell = recordingShell({
    kind: "exited",
    code: 3,
    stdout: "partial",
    stderr: "",
    shell: "bash",
  });

  // act
  const outcome = await invokeBridgedSkill(request({ args: "" }), {
    ...dependencies(files),
    runShell: shell.runShell,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message: 'Shell command failed for pattern "!`exit 3`": partial',
  });
});

test("T-01-24: aborts without running a command when the frontmatter asks for a missing Bash", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Check: !`exit 3`", ["shell: bash"]) };
  const windows = { ...host, platform: "win32", env: {} } satisfies PromptShellHost;

  // act
  const outcome = await invokeBridgedSkill(request({ typed: "/demo:greet", args: "" }), {
    ...dependencies(files),
    host: windows,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message:
      "Skill /demo:greet requires bash (`shell: bash` in frontmatter) but Git Bash was not " +
      "found. Install Git for Windows (https://git-scm.com/downloads/win), or change the " +
      "skill's frontmatter to `shell: powershell`.",
  });
});

test("T-01-24: aborts with Claude Code's message when the arguments pass the size limit", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Echo: $ARGUMENTS") };

  // act
  const outcome = await invokeBridgedSkill(
    request({ args: "a".repeat(4_000_001) }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "abort",
    message:
      "This skill, command or hook and the arguments filled into it add up to more than " +
      "4,000,000 characters. Use shorter arguments or fewer placeholders such as $ARGUMENTS.",
  });
});

test("lets a failure other than the cores' own propagate", async () => {
  // arrange
  const files = { [PROJECT_SKILL]: skillFile("Status: !`printf ok`") };
  const failure = new Error("spawn failed");

  // act & assert
  await assert.rejects(
    () =>
      invokeBridgedSkill(request({ args: "" }), {
        ...dependencies(files),
        runShell: () => Promise.reject(failure),
      }),
    (error: unknown) => {
      assert.strictEqual(error, failure);
      return true;
    },
  );
});

for (const { title, ledger } of [
  { title: "lists no project", ledger: () => null },
  {
    title: "lists the skill for another project",
    ledger: () => ledgerText("/elsewhere", { "demo-greet": STATUS_SKILL }),
  },
  {
    title: "lists another digest for the skill",
    ledger: () => ledgerText(CWD, { "demo-greet": skillFile("Greet.") }),
  },
  {
    title: "lists only another skill of the project",
    ledger: () => ledgerText(CWD, { "demo-other": STATUS_SKILL }),
  },
]) {
  test(`D-CF2-13: aborts a project skill without running a command when the user ledger ${title}`, async () => {
    // arrange
    const files = { [PROJECT_SKILL]: STATUS_SKILL };

    // act
    const outcome = await invokeBridgedSkill(request({ args: "" }), dependencies(files, ledger()));

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "abort",
      message:
        "The skill /skill:demo-greet was not installed into the project /work on this machine, " +
        "or its file changed after the install. Reinstall its plugin into this project with " +
        "/claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it.",
    });
  });
}

for (const { title, state } of [
  { title: "cannot be read", state: null },
  {
    title: "lists the skill under no plugin",
    state: { marketplaces: { fixtures: { plugins: {} } } },
  },
]) {
  test(`D-CF2-13: the abort names a reinstall of every project plugin when the project state ${title}`, async () => {
    // arrange
    const files = { [PROJECT_SKILL]: STATUS_SKILL };

    // act
    const outcome = await invokeBridgedSkill(
      request({ args: "" }),
      dependencies(files, null, state),
    );

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "abort",
      message:
        "The skill /skill:demo-greet was not installed into the project /work on this machine, " +
        "or its file changed after the install. Reinstall its plugin into this project with " +
        "/claude:plugin reinstall --scope project, then run /reload to use it.",
    });
  });
}

test("D-CF2-13: frames a user skill without reading the user ledger", async () => {
  // arrange
  const files = { [USER_SKILL]: skillFile("Greet $ARGUMENTS.") };
  const commands = [skillCommand("skill:demo-greet", USER_SKILL)];

  // act
  const outcome = await invokeBridgedSkill(request({ commands }), dependencies(files, null));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "ok",
    text: block(USER_SKILL, USER_SKILL_DIR, "Greet Ada."),
  });
});
