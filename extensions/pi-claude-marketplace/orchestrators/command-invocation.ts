// orchestrators/command-invocation.ts
//
// D-CF3-06: what the model receives when the user types a bridged slash
// command. The command is the prompt template this extension staged and Pi
// loaded. Its body is filled with the typed arguments as Claude Code
// 2.1.316's `T2e` fills it (D-CF1-01), so Pi's own 1-based expansion never
// runs on it.
//
// D-CF1-03: only a command the user types reaches this module. A prompt
// template outside this extension's two staged prompts directories, such as
// the user's own, is `not-staged` and keeps Pi's expansion.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCommandRecord } from "../bridges/commands/command-record.ts";
import {
  claudeEffort,
  parseArgumentNames,
  substituteArguments,
} from "../domain/argument-substitution.ts";
import { getAgentDir, parseFrontmatter } from "../platform/pi-api.ts";

import type { ExtensionAPI } from "../platform/pi-api.ts";

/** One typed invocation of a slash command, such as `/demo:greet Ada`. */
export interface CommandInvocationRequest {
  /** Pi's commands, as `pi.getCommands()` returns them. */
  readonly commands: ReturnType<ExtensionAPI["getCommands"]>;
  /** The command name, the typed token without its slash, such as `demo:greet`. */
  readonly name: string;
  /** The slash token as the user typed it, such as `/demo:greet`. */
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
export type CommandInvocationOutcome =
  | { readonly kind: "not-staged" }
  | { readonly kind: "send"; readonly text: string }
  | { readonly kind: "refuse"; readonly message: string };

/** The side effects of an invocation. */
export interface CommandInvocationDependencies {
  readonly getAgentDir: () => string;
  readonly readFile: (file: string) => Promise<string>;
}

/** The dependencies of a running Pi: its agent directory and the real filesystem. */
function nodeDependencies(): CommandInvocationDependencies {
  return {
    readFile: async (file) => readFile(file, "utf8"),
    getAgentDir,
  };
}

const NODE_DEPENDENCIES = nodeDependencies();

/** The scope whose staged prompts directory holds a command file. */
type StagingScope = "project" | "user";

/** A prompt command Pi loaded from a file this extension staged. */
interface StagedCommand {
  readonly file: string;
  readonly scope: StagingScope;
}

/**
 * Finds the prompt command `request.name` and the scope whose staged prompts
 * directory holds its file. A command Pi loaded from any other file is not
 * this extension's.
 */
function locateStagedCommand(
  request: CommandInvocationRequest,
  agentDir: string,
): StagedCommand | undefined {
  const listed = request.commands.find(
    (entry) => entry.source === "prompt" && entry.name === request.name,
  );
  if (listed === undefined) {
    return undefined;
  }

  const file = path.resolve(listed.sourceInfo.path);
  const scopeRoots: ReadonlyArray<readonly [StagingScope, string]> = [
    ["project", path.join(request.cwd, ".pi")],
    ["user", agentDir],
  ];
  const staged = scopeRoots.find(
    ([, root]) =>
      path.resolve(root, "pi-claude-marketplace", "resources", "prompts", `${request.name}.md`) ===
      file,
  );
  return staged === undefined ? undefined : { file, scope: staged[0] };
}

/**
 * D-CF3-06 / D-CF3-10: the `${CLAUDE_*}` values a typed argument or the body
 * may name. Install already filled the body's path variables (CM-3, SUB-02);
 * the values here reach a typed argument that names one, as upstream. The
 * plugin root and data come from the record install stored in the staged
 * frontmatter. A command has no skill directory, so `${CLAUDE_SKILL_DIR}`
 * stays literal.
 */
function commandVariables(
  request: CommandInvocationRequest,
  command: StagedCommand,
  frontmatter: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
  const variables: Record<string, string> = {
    CLAUDE_SESSION_ID: request.sessionId,
    CLAUDE_EFFORT: claudeEffort(request.thinkingLevel),
  };
  if (command.scope === "project") {
    variables.CLAUDE_PROJECT_DIR = request.cwd;
  }

  const record = readCommandRecord(frontmatter);
  if (record !== undefined) {
    variables.CLAUDE_PLUGIN_ROOT = record.pluginRoot;
    variables.CLAUDE_PLUGIN_DATA = record.pluginData;
  }

  return variables;
}

/**
 * D-CF3-06: builds what the model receives for a typed staged command, or
 * reports that the command is not one this extension staged.
 */
export async function invokeStagedCommand(
  request: CommandInvocationRequest,
  dependencies: CommandInvocationDependencies = NODE_DEPENDENCIES,
): Promise<CommandInvocationOutcome> {
  const command = locateStagedCommand(request, dependencies.getAgentDir());
  if (command === undefined) {
    return { kind: "not-staged" };
  }

  const { frontmatter, body } = parseFrontmatter(await dependencies.readFile(command.file));
  const text = substituteArguments({
    body,
    args: request.args,
    argumentNames: parseArgumentNames(frontmatter.arguments),
    variables: commandVariables(request, command, frontmatter),
  });
  return { kind: "send", text };
}
