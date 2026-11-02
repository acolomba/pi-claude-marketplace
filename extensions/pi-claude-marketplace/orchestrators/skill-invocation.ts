// orchestrators/skill-invocation.ts
//
// D-CF2-06: what the model receives when the user types a bridged skill. The
// skill is the `SKILL.md` this extension staged and Pi loaded; its body is
// filled with the typed arguments as Claude Code 2.1.316's `T2e` fills it
// (D-CF1-01) and framed in Pi's own `<skill>` block, so Pi's native
// expansion, which appends the raw arguments after the block, never runs.
//
// D-CF1-02 / T-01-22: the `!` commands run after the substitution, once, in
// the session's working directory, so a typed argument cannot form a command
// (the argument core escapes a word-initial `!`) and command output is never
// scanned again. T-01-24: a failed command, an oversized invocation, or a
// missing Bash aborts the invocation with Claude Code's message, and nothing
// reaches the model.
//
// D-CF1-03 (amended by the 2026-11-02 user decision on the Pi gap report,
// item 3): a skill the user types gets the whole invocation. When the model
// reads a staged `SKILL.md` on its own with Pi's read tool, `fillSkillRead`
// fills the same `${CLAUDE_*}` values and empties the arguments as for an
// invocation with none, but runs no `!` command: the model's read is not an
// invocation, and Claude Code's Skill tool path has no Pi equivalent. A skill
// outside this extension's two staged skills directories, such as the user's
// own Pi skill, is `not-bridged` and keeps Pi's expansion.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readSkillRecord } from "../bridges/skills/skill-names.ts";
import {
  claudeEffort,
  InvocationTooLargeError,
  parseArgumentNames,
  substituteArguments,
} from "../domain/argument-substitution.ts";
import { ContextInjectionError, expandContextInjections } from "../domain/context-injection.ts";
import {
  NODE_SKILL_TREE_LISTER,
  provenProjectSkills,
  skillTreeDigest,
} from "../persistence/project-installs.ts";
import { loadState } from "../persistence/state-io.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";
import {
  bashMissingMessage,
  createPromptShellRunner,
  NODE_PROMPT_SHELL_HOST,
  NODE_PROMPT_SHELL_SPAWN,
  selectPromptShell,
} from "../platform/prompt-shell.ts";
import { errorMessage } from "../shared/errors.ts";

import type { SkillAliasState } from "./skill-alias-state.ts";
import type { SkillTreeLister } from "../persistence/project-installs.ts";
import type { ExtensionAPI } from "../platform/pi-api.ts";
import type { PromptShellHost, PromptShellRunner } from "../platform/prompt-shell.ts";

/** One typed invocation of `/skill:<generatedName>` or of an alias of it. */
export interface SkillInvocationRequest {
  /** Pi's commands, as `pi.getCommands()` returns them. */
  readonly commands: ReturnType<ExtensionAPI["getCommands"]>;
  readonly generatedName: string;
  /** The slash token as the user typed it, such as `/skill:demo-greet`. */
  readonly typed: string;
  /** The rest of the line, trimmed; `""` when the user typed no arguments. */
  readonly args: string;
  readonly cwd: string;
  /** Whether Pi trusts the project at `cwd` (`ctx.isProjectTrusted()`). */
  readonly projectTrusted: boolean;
  readonly sessionId: string;
  /** Pi's session thinking level, which `${CLAUDE_EFFORT}` follows. */
  readonly thinkingLevel: string | undefined;
}

/** What to do with the typed text. */
export type SkillInvocationOutcome =
  | { readonly kind: "not-bridged" }
  | { readonly kind: "ok"; readonly text: string }
  | { readonly kind: "abort"; readonly message: string };

/** The side effects of an invocation. */
export interface SkillInvocationDependencies {
  readonly getAgentDir: () => string;
  readonly readFile: (file: string) => Promise<string>;
  /** Reads the `state.json` of the scope whose extension root is given. */
  readonly loadState: (extensionRoot: string) => Promise<SkillAliasState>;
  /** Lists the files and symbolic links of a staged skill directory (WR-03). */
  readonly listSkillTree: SkillTreeLister;
  /** The machine facts that choose a shell and give the commands their environment. */
  readonly host: PromptShellHost;
  readonly runShell: PromptShellRunner;
}

const DEFAULT_DEPENDENCIES: SkillInvocationDependencies = {
  getAgentDir,
  readFile: (file) => readFile(file, "utf8"),
  loadState,
  listSkillTree: NODE_SKILL_TREE_LISTER,
  host: NODE_PROMPT_SHELL_HOST,
  runShell: createPromptShellRunner({
    spawn: NODE_PROMPT_SHELL_SPAWN,
    host: NODE_PROMPT_SHELL_HOST,
  }),
};

/** A staged skill that Pi loaded, with the scope root it was staged under. */
interface BridgedSkill {
  readonly name: string;
  readonly location: string;
  readonly baseDir: string;
  readonly projectScope: boolean;
}

function stagedSkillPath(root: string, generatedName: string): string {
  return path.resolve(
    root,
    "pi-claude-marketplace",
    "resources",
    "skills",
    generatedName,
    "SKILL.md",
  );
}

/** Finds the loaded skill when its file is one this extension staged. */
function findBridgedSkill(
  request: Pick<SkillInvocationRequest, "commands" | "generatedName" | "cwd">,
  agentDir: string,
): BridgedSkill | undefined {
  const name = `skill:${request.generatedName}`;
  const command = request.commands.find(
    (candidate) => candidate.source === "skill" && candidate.name === name,
  );
  if (command === undefined) {
    return undefined;
  }

  const loaded = path.resolve(command.sourceInfo.path);
  const projectScope =
    loaded === stagedSkillPath(path.join(request.cwd, ".pi"), request.generatedName);
  if (!projectScope && loaded !== stagedSkillPath(agentDir, request.generatedName)) {
    return undefined;
  }

  // Pi frames a skill with the directory of its file. `sourceInfo.baseDir`
  // names the directory of the extension that discovered the skill instead.
  return {
    name: request.generatedName,
    location: command.sourceInfo.path,
    baseDir: path.dirname(command.sourceInfo.path),
    projectScope,
  };
}

/** D-CF2-06: the `${CLAUDE_*}` values a typed argument or the body may name. */
function invocationVariables(
  request: Pick<SkillInvocationRequest, "cwd" | "sessionId" | "thinkingLevel">,
  skill: BridgedSkill,
  frontmatter: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  const record = readSkillRecord(frontmatter);
  return {
    CLAUDE_SESSION_ID: request.sessionId,
    CLAUDE_EFFORT: claudeEffort(request.thinkingLevel),
    CLAUDE_SKILL_DIR: skill.baseDir,
    ...(skill.projectScope ? { CLAUDE_PROJECT_DIR: request.cwd } : {}),
    ...(record === undefined
      ? {}
      : { CLAUDE_PLUGIN_ROOT: record.pluginRoot, CLAUDE_PLUGIN_DATA: record.pluginData }),
  };
}

/** Pi's own skill block (`_expandSkillCommand`), with no arguments after it. */
function skillBlock(skill: BridgedSkill, body: string): string {
  return (
    `<skill name="${skill.name}" location="${skill.location}">\n` +
    `References are relative to ${skill.baseDir}.\n\n${body}\n</skill>`
  );
}

/** The staged file of a skill, split as Pi's loader splits it. */
interface ParsedSkill {
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
}

/**
 * D-CF2-06: substitutes, then runs the `!` commands with the shell the
 * frontmatter `shell` chooses (D-CF1-01, D-CF1-02). Throws the cores' errors.
 */
async function fillSkill(
  request: SkillInvocationRequest,
  skill: BridgedSkill,
  parsed: ParsedSkill,
  dependencies: SkillInvocationDependencies,
): Promise<SkillInvocationOutcome> {
  const substituted = substituteArguments({
    body: parsed.body.trim(),
    args: request.args,
    argumentNames: parseArgumentNames(parsed.frontmatter.arguments),
    variables: invocationVariables(request, skill, parsed.frontmatter),
  });
  const requested = parsed.frontmatter.shell;
  const choice = selectPromptShell(
    typeof requested === "string" ? requested : undefined,
    dependencies.host,
  );
  if (choice.kind === "bash-missing") {
    return { kind: "abort", message: bashMissingMessage(request.typed) };
  }

  const expanded = await expandContextInjections(substituted, (command) =>
    dependencies.runShell({
      command,
      shell: choice.shell,
      cwd: request.cwd,
      env: dependencies.host.env,
    }),
  );
  return { kind: "ok", text: skillBlock(skill, expanded) };
}

/** The abort message for a project skill in a project Pi does not trust. */
function untrustedProjectMessage(request: SkillInvocationRequest): string {
  return `The skill ${request.typed} belongs to the project ${request.cwd}, which Pi does not trust. Trust the project folder, then run /reload to use it.`;
}

/**
 * The command that stages the project skill again and records it as this
 * user's install. The project's `state.json` already records the plugin, so
 * `install` would refuse it as installed; `reinstall` names the plugin that
 * the record lists the skill under, or every project plugin when no record
 * lists it.
 */
async function reinstallCommand(
  request: SkillInvocationRequest,
  skill: BridgedSkill,
  dependencies: SkillInvocationDependencies,
): Promise<string> {
  let state: SkillAliasState;
  try {
    state = await dependencies.loadState(path.join(request.cwd, ".pi", "pi-claude-marketplace"));
  } catch {
    return "/claude:plugin reinstall --scope project";
  }

  const owner = Object.entries(state.marketplaces)
    .flatMap(([marketplace, entry]) =>
      Object.entries(entry.plugins).map(([plugin, record]) => ({ marketplace, plugin, record })),
    )
    .find(({ record }) => record.resources.skills.includes(skill.name));
  return owner === undefined
    ? "/claude:plugin reinstall --scope project"
    : `/claude:plugin reinstall ${owner.plugin}@${owner.marketplace} --scope project`;
}

/**
 * The abort message for a project skill that this user did not install into
 * the project, or whose file changed after the install (D-CF2-13).
 */
async function notInstalledHereMessage(
  request: SkillInvocationRequest,
  skill: BridgedSkill,
  dependencies: SkillInvocationDependencies,
): Promise<string> {
  const command = await reinstallCommand(request, skill, dependencies);
  return `The skill ${request.typed} was not installed into the project ${request.cwd} on this machine, or its file changed after the install. Reinstall its plugin into this project with ${command}, then run /reload to use it.`;
}

/**
 * D-CF2-13 / WR-03: whether the user's project ledger lists the project skill
 * with the digest of its staged directory as it is now, `content` standing
 * for its `SKILL.md`. A directory that cannot be listed fails the check. A
 * user skill needs no ledger: no repository can write the user scope.
 */
async function isInstalledHere(
  request: Pick<SkillInvocationRequest, "cwd">,
  skill: BridgedSkill,
  content: string,
  agentDir: string,
  dependencies: SkillInvocationDependencies,
): Promise<boolean> {
  if (!skill.projectScope) {
    return true;
  }

  const proven = await provenProjectSkills(agentDir, request.cwd, dependencies.readFile);
  const recorded = proven.get(skill.name);
  if (recorded === undefined) {
    return false;
  }

  try {
    return recorded === skillTreeDigest(await dependencies.listSkillTree(skill.baseDir), content);
  } catch {
    return false;
  }
}

/** The abort message for a staged skill file that cannot be read or parsed. */
function unreadableSkillMessage(typed: string, error: unknown): string {
  return `Cannot read the skill ${typed}: ${errorMessage(error)}. Run /reload to load the installed skills again.`;
}

/**
 * D-CF2-06: builds what the model receives for a typed bridged skill, reports
 * that the skill is not one this extension staged, or aborts with Claude
 * Code's message (T-01-24). A project skill in a project Pi does not trust,
 * a project skill this user did not install into the project (D-CF2-13), and
 * a staged file that cannot be read or parsed, abort too. A failure other
 * than these propagates.
 */
export async function invokeBridgedSkill(
  request: SkillInvocationRequest,
  dependencies: SkillInvocationDependencies = DEFAULT_DEPENDENCIES,
): Promise<SkillInvocationOutcome> {
  const agentDir = dependencies.getAgentDir();
  const skill = findBridgedSkill(request, agentDir);
  if (skill === undefined) {
    return { kind: "not-bridged" };
  }

  // T-02-17: Claude Code loads no project-scope plugin before the workspace
  // is trusted, and resource discovery leaves an untrusted project's skills
  // out. A skill Pi still lists here was discovered while the project was
  // trusted, so it aborts until the next `/reload` and runs nothing.
  if (skill.projectScope && !request.projectTrusted) {
    return { kind: "abort", message: untrustedProjectMessage(request) };
  }

  // A file that changed after Pi loaded it, such as one an uninstall,
  // disable, or update removed before `/reload`, aborts the invocation: Pi's
  // own expansion would send the body with its `!` commands not run.
  let content: string;
  let parsed: ParsedSkill;
  try {
    content = await dependencies.readFile(skill.location);
    parsed = parseFrontmatter(content);
  } catch (error) {
    return { kind: "abort", message: unreadableSkillMessage(request.typed, error) };
  }

  // D-CF2-13: Pi trusts a project that holds only this extension's tree, so
  // trust alone cannot tell a cloned repository's staged skill from one this
  // user installed. The ledger in the user scope can. The digest covers the
  // very `SKILL.md` bytes that run below and every other file of the staged
  // skill directory, such as a script a `!` command runs (WR-03).
  if (!(await isInstalledHere(request, skill, content, agentDir, dependencies))) {
    return { kind: "abort", message: await notInstalledHereMessage(request, skill, dependencies) };
  }

  try {
    return await fillSkill(request, skill, parsed, dependencies);
  } catch (error) {
    if (error instanceof ContextInjectionError || error instanceof InvocationTooLargeError) {
      return { kind: "abort", message: error.message };
    }

    throw error;
  }
}

/** A read of a file by the model's read tool, as Pi reports its result. */
export interface SkillReadRequest {
  /** Pi's commands, as `pi.getCommands()` returns them. */
  readonly commands: ReturnType<ExtensionAPI["getCommands"]>;
  /** The absolute path the read tool read. */
  readonly file: string;
  /** The text the read tool returned. */
  readonly text: string;
  /** The 0-based index of the file line the returned text starts with. */
  readonly startLine: number;
  readonly cwd: string;
  /** Whether Pi trusts the project at `cwd` (`ctx.isProjectTrusted()`). */
  readonly projectTrusted: boolean;
  readonly sessionId: string;
  /** Pi's session thinking level, which `${CLAUDE_EFFORT}` follows. */
  readonly thinkingLevel: string | undefined;
}

/**
 * The 0-based index of the first body line of `content`, found as Pi's
 * frontmatter parser finds the closing fence: the first line after the first
 * that starts with `---`, when the text starts with `---`. A text without a
 * closed frontmatter is all body.
 */
function bodyStartLine(content: string): number {
  const lines = content.split("\n");
  if (!content.startsWith("---")) {
    return 0;
  }

  const close = lines.findIndex((line, index) => index > 0 && line.startsWith("---"));
  return close === -1 ? 0 : close + 1;
}

/**
 * The staged skill that `file` names, when Pi loaded it from one of this
 * extension's two staged skills directories.
 */
function readSkill(request: SkillReadRequest, agentDir: string): BridgedSkill | undefined {
  if (path.basename(request.file) !== "SKILL.md") {
    return undefined;
  }

  const skill = findBridgedSkill(
    {
      commands: request.commands,
      generatedName: path.basename(path.dirname(request.file)),
      cwd: request.cwd,
    },
    agentDir,
  );
  return skill !== undefined && path.resolve(skill.location) === request.file ? skill : undefined;
}

/**
 * Amends D-CF1-03: the text the model gets when its read tool returns a
 * staged `SKILL.md`. Each returned line of the skill's body is filled as a
 * typed invocation with no arguments fills it: the `${CLAUDE_*}` values, and
 * `$ARGUMENTS` and named arguments empty. No `!` command runs; its line stays
 * literal. Frontmatter lines stay as they are. Every fill is local to one
 * line and an empty argument appends nothing, so a read that starts at an
 * offset or stops at a limit gets exactly the lines a whole read would.
 *
 * Returns `undefined`, and the model keeps the text it read, for any other
 * file, a project skill in a project Pi does not trust, a project skill this
 * user did not install into the project (D-CF2-13), a file that cannot be
 * read or parsed, and a fill past Claude Code's size limit.
 */
export async function fillSkillRead(
  request: SkillReadRequest,
  dependencies: SkillInvocationDependencies = DEFAULT_DEPENDENCIES,
): Promise<string | undefined> {
  const agentDir = dependencies.getAgentDir();
  const skill = readSkill(request, agentDir);
  if (skill === undefined || (skill.projectScope && !request.projectTrusted)) {
    return undefined;
  }

  let content: string;
  let parsed: ParsedSkill;
  try {
    content = await dependencies.readFile(skill.location);
    parsed = parseFrontmatter(content);
  } catch {
    return undefined;
  }

  if (!(await isInstalledHere(request, skill, content, agentDir, dependencies))) {
    return undefined;
  }

  const lines = request.text.split("\n");
  const bodyFrom = Math.max(0, bodyStartLine(content) - request.startLine);
  if (bodyFrom >= lines.length) {
    return undefined;
  }

  // InvocationTooLargeError is the one error the substitution throws.
  try {
    const body = substituteArguments({
      body: lines.slice(bodyFrom).join("\n"),
      args: "",
      argumentNames: parseArgumentNames(parsed.frontmatter.arguments),
      variables: invocationVariables(request, skill, parsed.frontmatter),
    });
    return [...lines.slice(0, bodyFrom), body].join("\n");
  } catch {
    return undefined;
  }
}
