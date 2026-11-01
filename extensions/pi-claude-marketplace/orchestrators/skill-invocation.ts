// orchestrators/skill-invocation.ts
//
// D-CF2-06: what the model receives when the user types a bridged skill. The
// skill is the `SKILL.md` this extension staged and Pi loaded; its body is
// filled with the typed arguments as Claude Code 2.1.316's `T2e` fills it
// (D-CF1-01) and framed in Pi's own `<skill>` block, so Pi's native
// expansion, which appends the raw arguments after the block, never runs.
//
// D-CF1-03: only a skill the user types reaches this module. The model's own
// skill reads have no extension hook, so they get neither arguments nor
// injection. A skill outside this extension's two staged skills directories,
// such as the user's own Pi skill, is `not-bridged` and keeps Pi's expansion.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readSkillRecord } from "../bridges/skills/skill-names.ts";
import {
  claudeEffort,
  parseArgumentNames,
  substituteArguments,
} from "../domain/argument-substitution.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";
import {
  createPromptShellRunner,
  NODE_PROMPT_SHELL_HOST,
  NODE_PROMPT_SHELL_SPAWN,
} from "../platform/prompt-shell.ts";

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
  /** The machine facts that choose a shell and give the commands their environment. */
  readonly host: PromptShellHost;
  readonly runShell: PromptShellRunner;
}

const DEFAULT_DEPENDENCIES: SkillInvocationDependencies = {
  getAgentDir,
  readFile: (file) => readFile(file, "utf8"),
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
  request: SkillInvocationRequest,
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
  request: SkillInvocationRequest,
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

/**
 * D-CF2-06: builds what the model receives for a typed bridged skill, or
 * reports that the skill is not one this extension staged.
 */
export async function invokeBridgedSkill(
  request: SkillInvocationRequest,
  dependencies: SkillInvocationDependencies = DEFAULT_DEPENDENCIES,
): Promise<SkillInvocationOutcome> {
  const skill = findBridgedSkill(request, dependencies.getAgentDir());
  if (skill === undefined) {
    return { kind: "not-bridged" };
  }

  const parsed = parseFrontmatter(await dependencies.readFile(skill.location));
  const substituted = substituteArguments({
    body: parsed.body.trim(),
    args: request.args,
    argumentNames: parseArgumentNames(parsed.frontmatter.arguments),
    variables: invocationVariables(request, skill, parsed.frontmatter),
  });
  return { kind: "ok", text: skillBlock(skill, substituted) };
}
