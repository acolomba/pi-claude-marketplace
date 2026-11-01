import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { invokeStagedCommand } from "../../extensions/pi-claude-marketplace/orchestrators/command-invocation.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  CommandInvocationDependencies,
  CommandInvocationRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/command-invocation.ts";
import type { ExtensionAPI } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  PromptShellHost,
  PromptShellRequest,
  PromptShellResult,
} from "../../extensions/pi-claude-marketplace/platform/prompt-shell.ts";

type PiCommand = ReturnType<ExtensionAPI["getCommands"]>[number];

const AGENT_DIR = "/agent";
const CWD = "/work";
const PROJECT_COMMAND = "/work/.pi/pi-claude-marketplace/resources/prompts/demo:greet.md";
const USER_COMMAND = "/agent/pi-claude-marketplace/resources/prompts/demo:greet.md";

function piCommand(name: string, source: PiCommand["source"], file: string): PiCommand {
  return {
    name,
    source,
    sourceInfo: { path: file, source: "extension", scope: "temporary", origin: "top-level" },
  };
}

function commandFile(body: string, frontmatter: readonly string[] = []): string {
  return ["---", "description: Greets.", ...frontmatter, "---", "", body, ""].join("\n");
}

const host = {
  platform: "linux",
  env: { PATH: "/usr/bin" },
  isFile: () => false,
  signalGroup: () => {
    throw new Error("an invocation must not signal a process");
  },
} satisfies PromptShellHost;

/** Reads only the named files, and runs no shell; any other read or a shell run fails the case. */
function dependencies(files: Readonly<Record<string, string>>): CommandInvocationDependencies {
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

/** A shell runner that records its requests and answers each with `result`. */
function recordingShell(result: PromptShellResult): {
  readonly requests: PromptShellRequest[];
  readonly runShell: CommandInvocationDependencies["runShell"];
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

function request(overrides: Partial<CommandInvocationRequest> = {}): CommandInvocationRequest {
  return {
    commands: [piCommand("demo:greet", "prompt", PROJECT_COMMAND)],
    name: "demo:greet",
    typed: "/demo:greet",
    args: "Ada",
    cwd: CWD,
    projectTrusted: true,
    sessionId: "session-1",
    thinkingLevel: "medium",
    ...overrides,
  };
}

test("D-CF1-01: sends a project command's body with the typed arguments appended", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Greet the person named in the arguments.") };

  // act
  const outcome = await invokeStagedCommand(request(), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "send",
    text: "Greet the person named in the arguments.\n\nARGUMENTS: Ada",
  });
});

test("D-CF3-10: fills the session id, the effort, and the project directory of a project command", async () => {
  // arrange
  const files = {
    [PROJECT_COMMAND]: commandFile(
      "Session ${CLAUDE_SESSION_ID}, effort ${CLAUDE_EFFORT}, project ${CLAUDE_PROJECT_DIR}.",
    ),
  };

  // act
  const outcome = await invokeStagedCommand(request({ args: "" }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "send",
    text: "Session session-1, effort medium, project /work.",
  });
});

test("D-CF3-10: leaves the project directory literal in a user command", async () => {
  // arrange
  const files = {
    [USER_COMMAND]: commandFile("Session ${CLAUDE_SESSION_ID}, project ${CLAUDE_PROJECT_DIR}."),
  };
  const commands = [piCommand("demo:greet", "prompt", USER_COMMAND)];

  // act
  const outcome = await invokeStagedCommand(
    request({ commands, args: "", thinkingLevel: undefined }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "send",
    text: "Session session-1, project ${CLAUDE_PROJECT_DIR}.",
  });
});

test("D-CF1-01: fills an empty argument string without appending anything", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Deploy $ARGUMENTS now") };

  // act
  const outcome = await invokeStagedCommand(request({ args: "" }), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Deploy  now" });
});

test("D-CF1-01: fills the names the frontmatter declares", async () => {
  // arrange
  const files = {
    [PROJECT_COMMAND]: commandFile("Hello $name from $place.", ["arguments: [name, place]"]),
  };

  // act
  const outcome = await invokeStagedCommand(
    request({ args: "Ada 'New York'" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Hello Ada from New York." });
});

const RECORD = '"pi-claude-marketplace": {"pluginRoot":"/p","pluginData":"/d"}';

for (const { title, typed, frontmatter, expectedText } of [
  {
    title: "the plugin root install recorded",
    typed: "${CLAUDE_PLUGIN_ROOT}/x",
    frontmatter: [RECORD],
    expectedText: "Open /p/x",
  },
  {
    title: "the plugin data install recorded",
    typed: "${CLAUDE_PLUGIN_DATA}/cache",
    frontmatter: [RECORD],
    expectedText: "Open /d/cache",
  },
  {
    title: "the plugin root literally when the command holds no record",
    typed: "${CLAUDE_PLUGIN_ROOT}/x",
    frontmatter: [],
    expectedText: "Open ${CLAUDE_PLUGIN_ROOT}/x",
  },
  {
    title: "the project directory of a project command",
    typed: "${CLAUDE_PROJECT_DIR}/notes",
    frontmatter: [RECORD],
    expectedText: "Open /work/notes",
  },
  {
    title: "the skill directory literally, because a command has none",
    typed: "${CLAUDE_SKILL_DIR}/x",
    frontmatter: [RECORD],
    expectedText: "Open ${CLAUDE_SKILL_DIR}/x",
  },
]) {
  test(`D-CF3-06: a typed argument names ${title}`, async () => {
    // arrange
    const files = { [PROJECT_COMMAND]: commandFile("Open $ARGUMENTS", frontmatter) };

    // act
    const outcome = await invokeStagedCommand(request({ args: typed }), dependencies(files));

    // assert
    assert.deepStrictEqual(outcome, { kind: "send", text: expectedText });
  });
}

test("D-CF3-06: a typed argument names the project directory literally in a user command", async () => {
  // arrange
  const files = { [USER_COMMAND]: commandFile("Open $ARGUMENTS", [RECORD]) };
  const commands = [piCommand("demo:greet", "prompt", USER_COMMAND)];

  // act
  const outcome = await invokeStagedCommand(
    request({ commands, args: "${CLAUDE_PROJECT_DIR}/notes" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Open ${CLAUDE_PROJECT_DIR}/notes" });
});

test("D-CF1-01: sends a body that starts with another command as it is, which pi expands again", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("/demo:other $0") };

  // act
  const outcome = await invokeStagedCommand(request(), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "/demo:other Ada" });
});

for (const { title, commands } of [
  { title: "pi lists no command of that name", commands: [] },
  {
    title: "pi lists that name only as a skill",
    commands: [piCommand("demo:greet", "skill", PROJECT_COMMAND)],
  },
  {
    title: "the prompt file is the user's own template",
    commands: [piCommand("demo:greet", "prompt", "/agent/prompts/demo:greet.md")],
  },
  {
    title: "the prompt file was staged under another name",
    commands: [
      piCommand("demo:greet", "prompt", "/work/.pi/pi-claude-marketplace/resources/prompts/x.md"),
    ],
  },
  {
    title: "the prompt file was staged for another project",
    commands: [
      piCommand(
        "demo:greet",
        "prompt",
        "/elsewhere/.pi/pi-claude-marketplace/resources/prompts/demo:greet.md",
      ),
    ],
  },
]) {
  test(`D-CF1-03: reports a command as not staged when ${title}`, async () => {
    // arrange
    const files = {};

    // act
    const outcome = await invokeStagedCommand(request({ commands }), dependencies(files));

    // assert
    assert.deepStrictEqual(outcome, { kind: "not-staged" });
  });
}

test("reads a user command from the agent directory of the running pi by default", async (t) => {
  // arrange
  const { agentDir } = await createHermeticEnvironment(t, "command-invocation-");
  const prompts = path.join(agentDir, "pi-claude-marketplace", "resources", "prompts");
  const file = path.join(prompts, "demo:greet.md");
  await mkdir(prompts, { recursive: true });
  await writeFile(file, commandFile("Greet $0."), "utf8");

  // act
  const outcome = await invokeStagedCommand(
    request({ commands: [piCommand("demo:greet", "prompt", file)] }),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Greet Ada." });
});

test("D-CF1-02: replaces a context command with its output, run by the chosen shell in the session directory", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Status: !`printf ok`", ["shell: bash"]) };
  const shell = recordingShell({
    kind: "exited",
    code: 0,
    stdout: "ok",
    stderr: "",
    shell: "bash",
  });

  // act
  const outcome = await invokeStagedCommand(request({ args: "" }), {
    ...dependencies(files),
    runShell: shell.runShell,
  });

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Status: ok" });
  assert.deepStrictEqual(shell.requests, [
    { command: "printf ok", shell: "bash", cwd: CWD, env: { PATH: "/usr/bin" } },
  ]);
});

test("T-01-22: substitutes before injection, so an argument that starts with ! runs nothing", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Echo: $ARGUMENTS") };

  // act
  const outcome = await invokeStagedCommand(
    request({ args: "!`printf pwned`" }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Echo: \\! `printf pwned`" });
});

test("T-01-24: refuses with Claude Code's message when a context command fails", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Check: !`exit 3`") };
  const shell = recordingShell({
    kind: "exited",
    code: 3,
    stdout: "partial",
    stderr: "",
    shell: "bash",
  });

  // act
  const outcome = await invokeStagedCommand(request({ args: "" }), {
    ...dependencies(files),
    runShell: shell.runShell,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "refuse",
    message: 'Shell command failed for pattern "!`exit 3`": partial',
  });
});

test("T-01-24: refuses without running a command when the frontmatter asks for a missing Bash", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Check: !`exit 3`", ["shell: bash"]) };
  const windows = { ...host, platform: "win32", env: {} } satisfies PromptShellHost;

  // act
  const outcome = await invokeStagedCommand(request({ args: "" }), {
    ...dependencies(files),
    host: windows,
  });

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "refuse",
    message:
      "Skill /demo:greet requires bash (`shell: bash` in frontmatter) but Git Bash was not " +
      "found. Install Git for Windows (https://git-scm.com/downloads/win), or change the " +
      "skill's frontmatter to `shell: powershell`.",
  });
});

test("T-03-10: refuses with Claude Code's message when the arguments pass the size limit", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Echo: $ARGUMENTS") };

  // act
  const outcome = await invokeStagedCommand(
    request({ args: "a".repeat(4_000_001) }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "refuse",
    message:
      "This skill, command or hook and the arguments filled into it add up to more than " +
      "4,000,000 characters. Use shorter arguments or fewer placeholders such as $ARGUMENTS.",
  });
});

test("D-CF3-06: refuses a project command in a project pi does not trust before reading its file", async () => {
  // arrange
  const files = {};

  // act
  const outcome = await invokeStagedCommand(
    request({ projectTrusted: false }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "refuse",
    message:
      "The command /demo:greet belongs to the project /work, which Pi does not trust. " +
      "Trust the project folder, then run /reload to use it.",
  });
});

test("D-CF3-06: sends a user command although pi does not trust the project", async () => {
  // arrange
  const files = { [USER_COMMAND]: commandFile("Greet $0.") };
  const commands = [piCommand("demo:greet", "prompt", USER_COMMAND)];

  // act
  const outcome = await invokeStagedCommand(
    request({ commands, projectTrusted: false }),
    dependencies(files),
  );

  // assert
  assert.deepStrictEqual(outcome, { kind: "send", text: "Greet Ada." });
});

test("D-CF3-06: refuses a staged command whose file cannot be read", async () => {
  // arrange
  const files = {};

  // act
  const outcome = await invokeStagedCommand(request(), dependencies(files));

  // assert
  assert.deepStrictEqual(outcome, {
    kind: "refuse",
    message:
      `Cannot read the command /demo:greet: unexpected read of ${PROJECT_COMMAND}. ` +
      "Run /reload to load the installed commands again.",
  });
});

test("lets a failure other than the cores' own propagate", async () => {
  // arrange
  const files = { [PROJECT_COMMAND]: commandFile("Status: !`printf ok`") };
  const failure = new Error("spawn failed");

  // act & assert
  await assert.rejects(
    () =>
      invokeStagedCommand(request({ args: "" }), {
        ...dependencies(files),
        runShell: () => Promise.reject(failure),
      }),
    (error: unknown) => {
      assert.strictEqual(error, failure);
      return true;
    },
  );
});
