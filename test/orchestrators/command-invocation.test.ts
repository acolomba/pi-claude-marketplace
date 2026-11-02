import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import { commandFileDigest } from "../../extensions/pi-claude-marketplace/bridges/commands/project-ledger.ts";
import {
  expandStagedCommand,
  invokeStagedCommand,
  listModelCommands,
} from "../../extensions/pi-claude-marketplace/orchestrators/command-invocation.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type {
  CommandInvocationDependencies,
  CommandInvocationRequest,
  CommandOwnerState,
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

/** IN-06: the user's ledger of the project `/work`, named by the SHA-256 of its path. */
const WORK_LEDGER = path.join(
  AGENT_DIR,
  "pi-claude-marketplace",
  "project-installs",
  createHash("sha256").update(CWD).digest("hex"),
  "skills.json",
);

/** D-CF3-07: ledger text that lists each generated name of `digests` for the project `project`. */
function projectLedger(digests: Readonly<Record<string, string>>, project = CWD): string {
  const listed: Record<string, { plugin: string; sha256: string }> = {};
  for (const [name, sha256] of Object.entries(digests)) {
    listed[name] = { plugin: "demo", sha256 };
  }

  return JSON.stringify({ version: 1, project, skills: listed });
}

/** The ledger a project install of `/demo:greet` wrote: it lists the staged file as `files` hold it. */
function installedLedger(files: Readonly<Record<string, string>>): string | null {
  const staged = files[PROJECT_COMMAND];
  return staged === undefined ? null : projectLedger({ "demo:greet": commandFileDigest(staged) });
}

/**
 * Reads only the named files and the user's ledger of `/work` (by default the
 * one the install of `files` wrote; `null` for none), and runs no shell; any
 * other read fails, and a shell run or a state read fails the case.
 */
function dependencies(
  files: Readonly<Record<string, string>>,
  ledger: string | null = installedLedger(files),
): CommandInvocationDependencies {
  const readable: Readonly<Record<string, string>> =
    ledger === null ? files : { ...files, [WORK_LEDGER]: ledger };
  return {
    getAgentDir: () => AGENT_DIR,
    readFile: (file) => {
      const content = readable[file];
      return content === undefined
        ? Promise.reject(new Error(`unexpected read of ${file}`))
        : Promise.resolve(content);
    },
    loadState: () => Promise.reject(new Error("a command that runs must not read the state")),
    host,
    runShell: () => Promise.reject(new Error("a body without a ! command must not run a shell")),
  };
}

/** A project `state.json` whose plugin `demo` of the marketplace `fixtures` lists `prompts`. */
function ownerState(prompts: readonly string[]): CommandOwnerState {
  return { marketplaces: { fixtures: { plugins: { demo: { resources: { prompts } } } } } };
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

describe("invokeStagedCommand", () => {
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

  const NOT_RECORDED =
    "The command /demo:greet was not installed into the project /work on this machine, or its " +
    "file changed after the install. Reinstall its plugin into this project with ";

  const STATUS_COMMAND = commandFile("Status: !`printf ran`");

  for (const { title, ledger } of [
    { title: "the user's ledger of the project is missing", ledger: null },
    {
      title: "the ledger names another project",
      ledger: projectLedger({ "demo:greet": commandFileDigest(STATUS_COMMAND) }, "/elsewhere"),
    },
    {
      title: "the ledger does not list the command",
      ledger: projectLedger({ "demo:other": commandFileDigest(STATUS_COMMAND) }),
    },
    {
      title: "the ledger lists the command with the digest of another file",
      ledger: projectLedger({ "demo:greet": commandFileDigest(commandFile("Greet.")) }),
    },
    { title: "the ledger is not JSON", ledger: "{" },
  ]) {
    test(`D-CF3-07: refuses a project command without running its context command when ${title}`, async () => {
      // arrange
      const files = { [PROJECT_COMMAND]: STATUS_COMMAND };
      const loaded: string[] = [];

      // act
      const outcome = await invokeStagedCommand(request({ args: "" }), {
        ...dependencies(files, ledger),
        loadState: (extensionRoot) => {
          loaded.push(extensionRoot);
          return Promise.resolve(ownerState(["demo:greet"]));
        },
      });

      // assert
      assert.deepStrictEqual(outcome, {
        kind: "refuse",
        message: `${NOT_RECORDED}/claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it.`,
      });
      assert.deepStrictEqual(loaded, ["/work/.pi/pi-claude-marketplace"]);
    });
  }

  for (const { title, loadState } of [
    {
      title: "no record of the project state lists the command",
      loadState: () => Promise.resolve(ownerState(["demo:other"])),
    },
    {
      title: "the project state cannot be read",
      loadState: () => Promise.reject(new Error("state.json is not JSON")),
    },
  ]) {
    test(`D-CF3-07: names every project plugin in the reinstall when ${title}`, async () => {
      // arrange
      const files = { [PROJECT_COMMAND]: STATUS_COMMAND };

      // act
      const outcome = await invokeStagedCommand(request({ args: "" }), {
        ...dependencies(files, null),
        loadState,
      });

      // assert
      assert.deepStrictEqual(outcome, {
        kind: "refuse",
        message: `${NOT_RECORDED}/claude:plugin reinstall --scope project, then run /reload to use it.`,
      });
    });
  }

  /** `base` with each file it is asked to read recorded in `reads`. */
  function recordingReads(
    base: CommandInvocationDependencies,
    reads: string[],
  ): CommandInvocationDependencies {
    return {
      ...base,
      readFile: (file) => {
        reads.push(file);
        return base.readFile(file);
      },
    };
  }

  test("D-CF3-07: refuses a project command pi does not trust before reading the user's ledger", async () => {
    // arrange
    const reads: string[] = [];
    const files = { [PROJECT_COMMAND]: STATUS_COMMAND };

    // act
    const outcome = await invokeStagedCommand(
      request({ projectTrusted: false }),
      recordingReads(dependencies(files), reads),
    );

    // assert
    assert.strictEqual(outcome.kind, "refuse");
    assert.deepStrictEqual(reads, []);
  });

  test("D-CF3-07: runs a user command without reading the user's ledger or the state", async () => {
    // arrange
    const files = { [USER_COMMAND]: commandFile("Greet $0.") };
    const reads: string[] = [];

    // act
    const outcome = await invokeStagedCommand(
      request({ commands: [piCommand("demo:greet", "prompt", USER_COMMAND)] }),
      recordingReads(dependencies(files, null), reads),
    );

    // assert
    assert.deepStrictEqual(outcome, { kind: "send", text: "Greet Ada." });
    assert.deepStrictEqual(reads, [USER_COMMAND]);
  });

  test("T-03-22: fills the very text whose digest the ledger lists, read once", async () => {
    // arrange
    const base = dependencies({ [PROJECT_COMMAND]: commandFile("Greet $0.") });
    const reads: string[] = [];
    let commandReads = 0;
    const changing: CommandInvocationDependencies = {
      ...base,
      // A second read of the command would see a file a pull changed after the check.
      readFile: (file) => {
        commandReads += file === PROJECT_COMMAND ? 1 : 0;
        return commandReads > 1
          ? Promise.resolve(commandFile("Run !`printf pwned`."))
          : base.readFile(file);
      },
    };

    // act
    const outcome = await invokeStagedCommand(request(), recordingReads(changing, reads));

    // assert
    assert.deepStrictEqual(outcome, { kind: "send", text: "Greet Ada." });
    assert.deepStrictEqual(reads, [PROJECT_COMMAND, WORK_LEDGER]);
  });

  test("D-CF3-07: refuses by default a project command the running pi's user did not install", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "command-invocation-");
    const prompts = path.join(cwd, ".pi", "pi-claude-marketplace", "resources", "prompts");
    const file = path.join(prompts, "demo:greet.md");
    await mkdir(prompts, { recursive: true });
    await writeFile(file, commandFile("Greet $0."), "utf8");

    // act
    const outcome = await invokeStagedCommand(
      request({ commands: [piCommand("demo:greet", "prompt", file)], cwd }),
    );

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "refuse",
      message:
        `The command /demo:greet was not installed into the project ${cwd} on this machine, or ` +
        "its file changed after the install. Reinstall its plugin into this project with " +
        "/claude:plugin reinstall --scope project, then run /reload to use it.",
    });
  });
});

describe("expandStagedCommand", () => {
  test("D-CF3-01: fills the body with the arguments and variables and leaves its context command literal", async () => {
    // arrange
    const files = {
      [PROJECT_COMMAND]: commandFile(
        "Greet $who in ${CLAUDE_PROJECT_DIR} at ${CLAUDE_EFFORT}. Status: !`printf ran`",
        ["arguments: [who]"],
      ),
    };

    // act
    const outcome = await expandStagedCommand(request(), "run_plugin_command", dependencies(files));

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "send",
      text: "Greet Ada in /work at medium. Status: !`printf ran`",
    });
  });

  test("D-CF3-01: refuses a command that sets disable-model-invocation with Claude Code's message", async () => {
    // arrange
    const files = {
      [PROJECT_COMMAND]: commandFile("Greet.", ["disable-model-invocation: true"]),
    };

    // act
    const outcome = await expandStagedCommand(request(), "run_plugin_command", dependencies(files));

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "refuse",
      message:
        "Command demo:greet cannot be used with run_plugin_command due to " +
        "disable-model-invocation. Ask the user to run /demo:greet themselves; it cannot be " +
        "invoked via run_plugin_command. Do not replicate this command's workflow by other " +
        "means; it is reserved for explicit user invocation.",
    });
  });

  test("D-CF3-01: reports a command this extension did not stage", async () => {
    // act
    const outcome = await expandStagedCommand(
      request({ commands: [] }),
      "run_plugin_command",
      dependencies({}, null),
    );

    // assert
    assert.deepStrictEqual(outcome, { kind: "not-staged" });
  });

  test("D-CF3-07: refuses a project command the user's ledger does not list", async () => {
    // arrange
    const files = { [PROJECT_COMMAND]: commandFile("Greet.") };
    const resolved = {
      ...dependencies(files, null),
      loadState: () => Promise.resolve(ownerState(["demo:greet"])),
    };

    // act
    const outcome = await expandStagedCommand(request(), "run_plugin_command", resolved);

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "refuse",
      message:
        "The command /demo:greet was not installed into the project /work on this machine, or " +
        "its file changed after the install. Reinstall its plugin into this project with " +
        "/claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it.",
    });
  });

  test("T-03-10: refuses with Claude Code's message when the arguments pass the size limit", async () => {
    // arrange
    const files = { [PROJECT_COMMAND]: commandFile("Echo: $ARGUMENTS") };

    // act
    const outcome = await expandStagedCommand(
      request({ args: "a".repeat(4_000_001) }),
      "run_plugin_command",
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
});

describe("listModelCommands", () => {
  const userCommand = (name: string): string =>
    `/agent/pi-claude-marketplace/resources/prompts/${name}.md`;

  test("D-CF3-01: lists the commands Claude Code lists, in Pi's order, with Claude Code's text", async () => {
    // arrange
    const files = {
      [userCommand("demo:deploy")]: commandFile("Deploy."),
      [userCommand("demo:advise")]: [
        "---",
        "description: Advise",
        "when_to_use: Use when asked.",
        "---",
        "",
        "Advise.",
      ].join("\n"),
      [userCommand("demo:whenonly")]: "---\nwhen_to_use: Use alone.\n---\n\nWhen body.",
      [userCommand("demo:long")]: commandFile("Long.", [`when_to_use: ${"w".repeat(1600)}`]),
      [userCommand("demo:fallback")]: "---\ndescription: Fallback body.\n---\n\nFallback body.",
      [userCommand("demo:empty")]: "---\ndescription: '  '\n---\n\nEmpty body.",
      [userCommand("demo:manual")]: commandFile("Manual.", ["disable-model-invocation: true"]),
      [userCommand("demo:broken")]: "---\ndescription: [unclosed\n---\n\nBroken.",
    };
    const names = [
      "demo:deploy",
      "demo:advise",
      "demo:whenonly",
      "demo:long",
      "demo:fallback",
      "demo:empty",
      "demo:manual",
      "demo:broken",
      "demo:missing",
    ];
    const commands = [
      ...names.map((name) => piCommand(name, "prompt", userCommand(name))),
      piCommand("skill:demo-skill", "skill", "/agent/skills/demo-skill/SKILL.md"),
      piCommand("mine", "prompt", "/agent/prompts/mine.md"),
    ];

    // act
    const listed = await listModelCommands(
      { commands, cwd: CWD, projectTrusted: true },
      dependencies(files, null),
    );

    // assert
    assert.deepStrictEqual(listed, [
      { name: "demo:deploy", text: "Greets." },
      { name: "demo:advise", text: "Advise - Use when asked." },
      { name: "demo:whenonly", text: "When body. - Use alone." },
      { name: "demo:long", text: `Greets. - ${"w".repeat(1526)}` },
    ]);
  });

  for (const { title, projectTrusted, ledger, ledgerReads, expectedNames } of [
    {
      title: "lists a project command the user's ledger lists, reading the ledger once",
      projectTrusted: true,
      ledger: () =>
        projectLedger({
          "demo:greet": commandFileDigest(commandFile("Greet.")),
          "demo:other": commandFileDigest(commandFile("Other.")),
        }),
      ledgerReads: 1,
      expectedNames: ["demo:greet", "demo:other"],
    },
    {
      title: "leaves out a project command the user's ledger does not list",
      projectTrusted: true,
      ledger: () => null,
      ledgerReads: 1,
      expectedNames: [],
    },
    {
      title: "leaves out a project command in a project pi does not trust",
      projectTrusted: false,
      ledger: () =>
        projectLedger({
          "demo:greet": commandFileDigest(commandFile("Greet.")),
          "demo:other": commandFileDigest(commandFile("Other.")),
        }),
      ledgerReads: 0,
      expectedNames: [],
    },
  ]) {
    test(`D-CF3-07: ${title}`, async () => {
      // arrange
      const other = "/work/.pi/pi-claude-marketplace/resources/prompts/demo:other.md";
      const files = {
        [PROJECT_COMMAND]: commandFile("Greet."),
        [other]: commandFile("Other."),
      };
      const reads: string[] = [];
      const resolved = dependencies(files, ledger());

      // act
      const listed = await listModelCommands(
        {
          commands: [
            piCommand("demo:greet", "prompt", PROJECT_COMMAND),
            piCommand("demo:other", "prompt", other),
          ],
          cwd: CWD,
          projectTrusted,
        },
        {
          ...resolved,
          readFile: (file) => {
            reads.push(file);
            return resolved.readFile(file);
          },
        },
      );

      // assert
      assert.deepStrictEqual(
        listed.map(({ name }) => name),
        expectedNames,
      );
      assert.strictEqual(reads.filter((file) => file === WORK_LEDGER).length, ledgerReads);
    });
  }
});
