import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  fillSkillRead,
  invokeBridgedSkill,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import {
  NODE_PROJECT_SKILL_LEDGER,
  skillTreeDigest,
} from "../../extensions/pi-claude-marketplace/persistence/project-installs.ts";
import { parseFrontmatter } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { SkillAliasState } from "../../extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts";
import type {
  SkillInvocationDependencies,
  SkillInvocationRequest,
  SkillReadRequest,
} from "../../extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts";
import type { SkillTreeEntry } from "../../extensions/pi-claude-marketplace/persistence/project-installs.ts";
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

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** IN-06: the ledger file of the project `/work` under the agent directory `/agent`. */
const LEDGER = `/agent/pi-claude-marketplace/project-installs/${sha256("/work")}/skills.json`;

/** WR-03: the in-memory files under the skill directory `dir`, as the lister reports them. */
function skillTree(files: Readonly<Record<string, string>>, dir: string): SkillTreeEntry[] {
  const prefix = `${dir}/`;
  return Object.keys(files)
    .filter((file) => file.startsWith(prefix))
    .map((file) => ({
      path: file.slice(prefix.length),
      kind: "file",
      sha256: sha256(files[file] ?? ""),
    }));
}

/** D-CF2-13: a user ledger that lists `digests` (name to directory digest) for the project `project`. */
function ledgerText(project: string, digests: Readonly<Record<string, string>>): string {
  const listed = Object.entries(digests).map(
    ([name, digest]) => [name, { plugin: "demo", sha256: digest }] as const,
  );
  return JSON.stringify({ version: 1, project, skills: Object.fromEntries(listed) });
}

/** A ledger that lists every project skill among `files` with the digest of its directory. */
function provingLedger(files: Readonly<Record<string, string>>): string {
  const projectSkills = Object.entries(files)
    .filter(([file]) => file.startsWith(`${CWD}/.pi/`) && path.basename(file) === "SKILL.md")
    .map(([file, content]) => {
      const dir = path.dirname(file);
      return [path.basename(dir), skillTreeDigest(skillTree(files, dir), content)] as const;
    });
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
    listSkillTree: (dir) => Promise.resolve(skillTree(files, dir)),
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
    await NODE_PROJECT_SKILL_LEDGER.update({
      projectPath: cwd,
      forget: [],
      remember: new Map([
        ["demo-greet", { plugin: "demo", sha256: skillTreeDigest([], skillFile("Greet $0.")) }],
      ]),
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
      ledger: () => ledgerText("/elsewhere", { "demo-greet": skillTreeDigest([], STATUS_SKILL) }),
    },
    {
      title: "lists another digest for the skill",
      ledger: () => ledgerText(CWD, { "demo-greet": skillTreeDigest([], skillFile("Greet.")) }),
    },
    {
      title: "lists only another skill of the project",
      ledger: () => ledgerText(CWD, { "demo-other": skillTreeDigest([], STATUS_SKILL) }),
    },
  ]) {
    test(`D-CF2-13: aborts a project skill without running a command when the user ledger ${title}`, async () => {
      // arrange
      const files = { [PROJECT_SKILL]: STATUS_SKILL };

      // act
      const outcome = await invokeBridgedSkill(
        request({ args: "" }),
        dependencies(files, ledger()),
      );

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

  const STATUS_SCRIPT = `${PROJECT_SKILL_DIR}/status.sh`;

  for (const { title, change } of [
    {
      title: "a script in its directory changed",
      change: (files: Record<string, string>) => {
        files[STATUS_SCRIPT] = "printf changed";
      },
    },
    {
      title: "a file was added to its directory",
      change: (files: Record<string, string>) => {
        files[`${PROJECT_SKILL_DIR}/notes/extra.txt`] = "added";
      },
    },
    {
      title: "a file was removed from its directory",
      change: (files: Record<string, string>) => {
        Reflect.deleteProperty(files, STATUS_SCRIPT);
      },
    },
  ]) {
    test(`WR-03: aborts a project skill without running a command when ${title} after the install`, async () => {
      // arrange
      const installed = { [PROJECT_SKILL]: STATUS_SKILL, [STATUS_SCRIPT]: "printf ran" };
      const ledger = provingLedger(installed);
      const files: Record<string, string> = { ...installed };
      change(files);

      // act
      const outcome = await invokeBridgedSkill(request({ args: "" }), dependencies(files, ledger));

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

  test("WR-03: runs a project skill whose whole directory matches the ledger", async () => {
    // arrange
    const files = { [PROJECT_SKILL]: STATUS_SKILL, [STATUS_SCRIPT]: "printf ran" };
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

  test("WR-03: aborts a project skill whose directory cannot be listed", async () => {
    // arrange
    const files = { [PROJECT_SKILL]: STATUS_SKILL };

    // act
    const outcome = await invokeBridgedSkill(request({ args: "" }), {
      ...dependencies(files),
      listSkillTree: () => Promise.reject(new Error("EACCES")),
    });

    // assert
    assert.deepStrictEqual(outcome, {
      kind: "abort",
      message:
        "The skill /skill:demo-greet was not installed into the project /work on this machine, " +
        "or its file changed after the install. Reinstall its plugin into this project with " +
        "/claude:plugin reinstall demo@fixtures --scope project, then run /reload to use it.",
    });
  });

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
});

function readRequest(overrides: Partial<SkillReadRequest> = {}): SkillReadRequest {
  return {
    commands: [skillCommand("skill:demo-greet", PROJECT_SKILL)],
    file: PROJECT_SKILL,
    text: "",
    startLine: 0,
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

  test("D-CF1-03: leaves the project directory of a user skill literal and reads no ledger", async () => {
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
      dependencies(files, null),
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

  for (const { part, startLine, read, filled } of [
    {
      part: "from inside its frontmatter",
      startLine: 3,
      read: `arguments: [who]\n${RECORD}\n---\n\nArgs [$who].\n\n[3 more lines in file. Use offset=10 to continue.]`,
      filled: `arguments: [who]\n${RECORD}\n---\n\nArgs [].\n\n[3 more lines in file. Use offset=10 to continue.]`,
    },
    {
      part: "from inside its body",
      startLine: 8,
      read: "Args [$ARGUMENTS] [$who].",
      filled: "Args [] [].",
    },
  ]) {
    test(`D-CF1-03: fills only the body lines of a read that starts ${part}`, async () => {
      // arrange
      const files = { [PROJECT_SKILL]: VARIABLES_SKILL };

      // act
      const text = await fillSkillRead(readRequest({ text: read, startLine }), dependencies(files));

      // assert
      assert.strictEqual(text, filled);
    });
  }

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
        dependencies(files, null),
      );

      // assert
      assert.strictEqual(text, filled);
    });
  }

  for (const { title, overrides, files, ledger } of [
    {
      title: "a read of its frontmatter lines alone",
      overrides: { text: "---\nname: demo-greet" },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
      ledger: undefined,
    },
    {
      title: "a file that is not a SKILL.md",
      overrides: { file: `${PROJECT_SKILL_DIR}/notes.md`, text: "Args [$ARGUMENTS]." },
      files: {},
      ledger: null,
    },
    {
      title: "a SKILL.md that Pi did not load as a skill",
      overrides: { commands: [], text: "Args [$ARGUMENTS]." },
      files: {},
      ledger: null,
    },
    {
      title: "a SKILL.md under the other scope root of a loaded skill",
      overrides: { file: USER_SKILL, text: "Args [$ARGUMENTS]." },
      files: {},
      ledger: null,
    },
    {
      title: "a project skill in a project Pi does not trust",
      overrides: { projectTrusted: false, text: "Args [$ARGUMENTS]." },
      files: {},
      ledger: null,
    },
    {
      title: "a staged file that cannot be read",
      overrides: { text: "Args [$ARGUMENTS]." },
      files: {},
      ledger: null,
    },
    {
      title: "a staged file whose frontmatter does not parse",
      overrides: { text: "Args [$ARGUMENTS]." },
      files: { [PROJECT_SKILL]: "---\nname: [unclosed\n---\n\nArgs [$ARGUMENTS]." },
      ledger: null,
    },
    {
      title: "a project skill that the user ledger does not list",
      overrides: { text: VARIABLES_SKILL },
      files: { [PROJECT_SKILL]: VARIABLES_SKILL },
      ledger: null,
    },
    {
      title: "a fill past Claude Code's size limit",
      overrides: { text: `$ARGUMENTS${"x".repeat(4_000_001)}` },
      files: { [PROJECT_SKILL]: "Body." },
      ledger: undefined,
    },
  ]) {
    test(`D-CF1-03: keeps the read text for ${title}`, async () => {
      // arrange
      const resolved = dependencies(files, ledger);

      // act
      const text = await fillSkillRead(readRequest(overrides), resolved);

      // assert
      assert.strictEqual(text, undefined);
    });
  }
});
