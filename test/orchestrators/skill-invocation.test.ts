import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  fillSkillRead,
  invokeBridgedSkill,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import { parseFrontmatter } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  SkillInvocationDependencies,
  SkillInvocationRequest,
  SkillReadRequest,
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

/**
 * Reads only the named files; any other read fails the case, and a shell run
 * fails it too.
 */
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

describe("invokeBridgedSkill", () => {
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
    const outcome = await invokeBridgedSkill(
      request({ typed: "/demo:greet" }),
      dependencies(files),
    );

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

  test("D-LOC-01: runs the context command of a project skill in a project Pi trusts", async () => {
    // arrange
    const files = { [PROJECT_SKILL]: STATUS_SKILL };
    const shell = recordingShell({
      kind: "exited",
      code: 0,
      stdout: "ran",
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
      text: block(PROJECT_SKILL, PROJECT_SKILL_DIR, "Status: ran"),
    });
  });
});

function readRequest(overrides: Partial<SkillReadRequest> = {}): SkillReadRequest {
  return {
    commands: [skillCommand("skill:demo-greet", PROJECT_SKILL)],
    file: PROJECT_SKILL,
    text: "",
    offset: undefined,
    limit: undefined,
    cwd: CWD,
    projectTrusted: true,
    sessionId: "session-1",
    thinkingLevel: "medium",
    ...overrides,
  };
}

/** A staged skill whose body names every variable, argument form, and a context command. */
const VARIABLES_SKILL = skillFile(
  [
    "Session ${CLAUDE_SESSION_ID} at ${CLAUDE_EFFORT} in ${CLAUDE_SKILL_DIR} for ${CLAUDE_PROJECT_DIR}.",
    "Args [$ARGUMENTS] [$who] [$0] [$ARGUMENTS[0]].",
    "Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}.",
    "Status: !`printf ran`",
  ].join("\n"),
  ["arguments: [who]", RECORD],
);

const VARIABLES_FRONTMATTER = [
  "---",
  "name: demo-greet",
  "description: Greets.",
  "arguments: [who]",
  RECORD,
  "---",
  "",
];

describe("fillSkillRead", () => {
  test("D-CF1-03: fills a whole project skill read as a typed invocation with no arguments, running no command", async () => {
    // arrange
    const files = { [PROJECT_SKILL]: VARIABLES_SKILL };

    // act
    const text = await fillSkillRead(readRequest({ text: VARIABLES_SKILL }), dependencies(files));

    // assert
    assert.strictEqual(
      text,
      [
        ...VARIABLES_FRONTMATTER,
        `Session session-1 at medium in ${PROJECT_SKILL_DIR} for /work.`,
        "Args [] [] [$0] [$ARGUMENTS[0]].",
        "Root /plugins/demo, data /data/demo.",
        "Status: !`printf ran`",
      ].join("\n"),
    );
  });

  test("D-CF1-03: leaves the project directory of a user skill literal", async () => {
    // arrange
    const files = { [USER_SKILL]: VARIABLES_SKILL };

    // act
    const text = await fillSkillRead(
      readRequest({
        commands: [skillCommand("skill:demo-greet", USER_SKILL)],
        file: USER_SKILL,
        text: VARIABLES_SKILL,
        projectTrusted: false,
        thinkingLevel: undefined,
      }),
      dependencies(files),
    );

    // assert
    assert.strictEqual(
      text,
      [
        ...VARIABLES_FRONTMATTER,
        `Session session-1 at high in ${USER_SKILL_DIR} for \${CLAUDE_PROJECT_DIR}.`,
        "Args [] [] [$0] [$ARGUMENTS[0]].",
        "Root /plugins/demo, data /data/demo.",
        "Status: !`printf ran`",
      ].join("\n"),
    );
  });

  for (const { part, offset, limit, read, filled } of [
    {
      part: "from inside its frontmatter",
      offset: 4,
      limit: 5,
      read: [
        "arguments: [who]",
        RECORD,
        "---",
        "",
        "Session ${CLAUDE_SESSION_ID} at ${CLAUDE_EFFORT} in ${CLAUDE_SKILL_DIR} for ${CLAUDE_PROJECT_DIR}.",
        "",
        "[3 more lines in file. Use offset=9 to continue.]",
      ].join("\n"),
      filled: [
        "arguments: [who]",
        RECORD,
        "---",
        "",
        `Session session-1 at medium in ${PROJECT_SKILL_DIR} for /work.`,
        "",
        "[3 more lines in file. Use offset=9 to continue.]",
      ].join("\n"),
    },
    {
      part: "from inside its body",
      offset: 9,
      limit: 1,
      read: "Args [$ARGUMENTS] [$who] [$0] [$ARGUMENTS[0]].\n\n[2 more lines in file. Use offset=10 to continue.]",
      filled:
        "Args [] [] [$0] [$ARGUMENTS[0]].\n\n[2 more lines in file. Use offset=10 to continue.]",
    },
    {
      part: "inside its body and runs to its end",
      offset: 10,
      limit: undefined,
      read: "Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}.\nStatus: !`printf ran`",
      filled: "Root /plugins/demo, data /data/demo.\nStatus: !`printf ran`",
    },
    {
      part: "at offset 0",
      offset: 0,
      limit: undefined,
      read: VARIABLES_SKILL,
      filled: [
        ...VARIABLES_FRONTMATTER,
        `Session session-1 at medium in ${PROJECT_SKILL_DIR} for /work.`,
        "Args [] [] [$0] [$ARGUMENTS[0]].",
        "Root /plugins/demo, data /data/demo.",
        "Status: !`printf ran`",
      ].join("\n"),
    },
  ]) {
    test(`D-CF1-03: fills only the body lines of a read that starts ${part}`, async () => {
      // arrange
      const files = { [PROJECT_SKILL]: VARIABLES_SKILL };

      // act
      const text = await fillSkillRead(
        readRequest({ text: read, offset, limit }),
        dependencies(files),
      );

      // assert
      assert.strictEqual(text, filled);
    });
  }

  test("D-CF1-03: fills a whole read that Pi's read tool cut at 2000 lines, keeping its notice", async () => {
    // arrange
    const content = ["Greet $ARGUMENTS.", ...Array.from({ length: 2001 }, () => "line")].join("\n");
    const kept = Array.from({ length: 1999 }, () => "line");
    const notice = "[Showing lines 1-2000 of 2002. Use offset=2001 to continue.]";
    const files = { [USER_SKILL]: content };

    // act
    const text = await fillSkillRead(
      readRequest({
        commands: [skillCommand("skill:demo-greet", USER_SKILL)],
        file: USER_SKILL,
        text: ["Greet $ARGUMENTS.", ...kept, "", notice].join("\n"),
      }),
      dependencies(files),
    );

    // assert
    assert.strictEqual(text, ["Greet .", ...kept, "", notice].join("\n"));
  });

  for (const { form, content, filled } of [
    { form: "no frontmatter", content: "Greet $ARGUMENTS.", filled: "Greet ." },
    {
      form: "a frontmatter with no closing fence",
      content: "---\nname: demo-greet\nGreet $ARGUMENTS.",
      filled: "---\nname: demo-greet\nGreet .",
    },
  ]) {
    test(`D-CF1-03: fills every line of a skill file with ${form}`, async () => {
      // arrange
      const files = { [USER_SKILL]: content };

      // act
      const text = await fillSkillRead(
        readRequest({
          commands: [skillCommand("skill:demo-greet", USER_SKILL)],
          file: USER_SKILL,
          text: content,
        }),
        dependencies(files),
      );

      // assert
      assert.strictEqual(text, filled);
    });
  }

  for (const { title, overrides, files } of [
    {
      title: "a read of its frontmatter lines alone",
      overrides: {
        text: "---\nname: demo-greet\n\n[9 more lines in file. Use offset=3 to continue.]",
        offset: 1,
        limit: 2,
      },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a whole read whose text a hook replaced",
      overrides: { text: "Hook: ${CLAUDE_EFFORT} [$ARGUMENTS]" },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a hook text that starts with the staged text and adds a line",
      overrides: { text: `${VARIABLES_SKILL}\nHook: \${CLAUDE_EFFORT} [$ARGUMENTS]` },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a partial read whose hook text drops the continuation notice",
      overrides: { text: "Args [$ARGUMENTS] [$who] [$0] [$ARGUMENTS[0]].", offset: 9, limit: 1 },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a read text that matches the staged file at another offset",
      overrides: {
        text: "Root ${CLAUDE_PLUGIN_ROOT}, data ${CLAUDE_PLUGIN_DATA}.\n\n[1 more lines in file. Use offset=11 to continue.]",
        offset: 9,
        limit: 1,
      },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a read whose offset is past the end of the staged file",
      overrides: { text: "Args [$ARGUMENTS].", offset: 50 },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
    },
    {
      title: "a file that is not a SKILL.md",
      overrides: { file: `${PROJECT_SKILL_DIR}/notes.md`, text: "Args [$ARGUMENTS]." },
      files: {},
    },
    {
      title: "a SKILL.md that Pi did not load as a skill",
      overrides: { commands: [], text: "Args [$ARGUMENTS]." },
      files: {},
    },
    {
      title: "a SKILL.md under the other scope root of a loaded skill",
      overrides: { file: USER_SKILL, text: "Args [$ARGUMENTS]." },
      files: {},
    },
    {
      title: "a project skill in a project Pi does not trust",
      overrides: { projectTrusted: false, text: "Args [$ARGUMENTS]." },
      files: {},
    },
    {
      title: "a staged file that cannot be read",
      overrides: { text: "Args [$ARGUMENTS]." },
      files: {},
    },
    {
      title: "a staged file whose frontmatter does not parse",
      overrides: { text: "Args [$ARGUMENTS]." },
      files: { [PROJECT_SKILL]: "---\nname: [unclosed\n---\n\nArgs [$ARGUMENTS]." },
    },
    {
      title: "a fill past Claude Code's size limit",
      overrides: { text: "${CLAUDE_SESSION_ID} [$ARGUMENTS]", sessionId: "s".repeat(4_000_001) },
      files: { [PROJECT_SKILL]: "${CLAUDE_SESSION_ID} [$ARGUMENTS]" },
    },
  ]) {
    test(`D-CF1-03: keeps the read text for ${title}`, async () => {
      // arrange
      const resolved = dependencies(files);

      // act
      const text = await fillSkillRead(readRequest(overrides), resolved);

      // assert
      assert.strictEqual(text, undefined);
    });
  }
});
