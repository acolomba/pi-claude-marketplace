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

/** Reads only the named files; any other read fails the case. */
function dependencies(files: Readonly<Record<string, string>>): CommandInvocationDependencies {
  return {
    getAgentDir: () => AGENT_DIR,
    readFile: (file) => {
      const content = files[file];
      return content === undefined
        ? Promise.reject(new Error(`unexpected read of ${file}`))
        : Promise.resolve(content);
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
