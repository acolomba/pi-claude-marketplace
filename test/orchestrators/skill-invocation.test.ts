import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { invokeBridgedSkill } from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";

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

/** Reads only the named file; any other read fails the case. */
function dependencies(files: Readonly<Record<string, string>>): SkillInvocationDependencies {
  return {
    getAgentDir: () => AGENT_DIR,
    readFile: (file) => {
      const content = files[file];
      return content === undefined
        ? Promise.reject(new Error(`unexpected read of ${file}`))
        : Promise.resolve(content);
    },
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

test("lets a read failure of the staged skill file propagate", async () => {
  // arrange
  const files = {};

  // act & assert
  await assert.rejects(
    () => invokeBridgedSkill(request(), dependencies(files)),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(error.message, `unexpected read of ${PROJECT_SKILL}`);
      return true;
    },
  );
});

test("D-CF2-06: reads the staged skill file from disk with the production dependencies", async (t) => {
  // arrange
  const cwd = await mkdtemp(path.join(tmpdir(), "skill-invocation-"));
  t.after(() => rm(cwd, { recursive: true, force: true, maxRetries: 3 }));
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
