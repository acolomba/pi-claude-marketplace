// orchestrators/command-invocation.ts
//
// D-CF3-06: what the model receives when the user types a bridged slash
// command. The command is the prompt template this extension staged and Pi
// loaded. Its body is filled with the typed arguments as Claude Code
// 2.1.316's `T2e` fills it (D-CF1-01), so Pi's own 1-based expansion never
// runs on it.
//
// D-CF1-02 / T-01-22: the `!` commands run after the substitution, once, in
// the session's working directory, so a typed argument cannot form a command
// (the argument core escapes a word-initial `!`). T-01-24: a failed command,
// an oversized invocation, a missing Bash, a project Pi does not trust, and a
// staged file that cannot be read refuse the invocation, and nothing reaches
// the model.
//
// D-CF1-03: a command the user types, and a command the model runs with the
// `run_plugin_command` tool (`expandStagedCommand`, which runs no `!` command),
// reach this module. A prompt template outside this extension's two staged
// prompts directories, such as the user's own, is `not-staged` and keeps Pi's
// expansion.
//
// D-CF3-07: a project's `.pi/pi-claude-marketplace/` tree can come from the
// repository, so a project command runs only when the user's own ledger of
// project installs, under the user scope, lists it with the SHA-256 of the
// text read here. That one read feeds both the digest and the fill (T-03-22).

import { readFile } from "node:fs/promises";
import path from "node:path";

import { readCommandRecord } from "../bridges/commands/command-record.ts";
import { commandFileDigest } from "../bridges/commands/project-ledger.ts";
import { truncate1536 } from "../bridges/skills/frontmatter-degrade.ts";
import {
  claudeEffort,
  InvocationTooLargeError,
  parseArgumentNames,
  substituteArguments,
} from "../domain/argument-substitution.ts";
import { ContextInjectionError, expandContextInjections } from "../domain/context-injection.ts";
import { descriptionFallback } from "../domain/description-fallback.ts";
import { provenProjectSkills } from "../persistence/project-installs.ts";
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

import type { ShellRun } from "../domain/context-injection.ts";
import type { ExtensionAPI } from "../platform/pi-api.ts";
import type { PromptShellHost, PromptShellRunner } from "../platform/prompt-shell.ts";

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

/** The part of a scope's `state.json` that names the plugin owning a staged command. */
export interface CommandOwnerState {
  readonly marketplaces: Readonly<
    Record<
      string,
      {
        readonly plugins: Readonly<
          Record<string, { readonly resources: { readonly prompts: readonly string[] } }>
        >;
      }
    >
  >;
}

/** The side effects of an invocation. */
export interface CommandInvocationDependencies {
  readonly getAgentDir: () => string;
  readonly readFile: (file: string) => Promise<string>;
  /** Reads, without persisting a migration, the `state.json` under the given extension root. */
  readonly loadState: (extensionRoot: string) => Promise<CommandOwnerState>;
  /** The machine facts that choose a shell and give the commands their environment. */
  readonly host: PromptShellHost;
  readonly runShell: PromptShellRunner;
}

/** The dependencies of a running Pi: its agent directory, the filesystem, and this machine's shells. */
function nodeDependencies(): CommandInvocationDependencies {
  const host = NODE_PROMPT_SHELL_HOST;
  return {
    host,
    runShell: createPromptShellRunner({ host, spawn: NODE_PROMPT_SHELL_SPAWN }),
    readFile: async (file) => readFile(file, "utf8"),
    loadState: async (extensionRoot) => loadState(extensionRoot, { persistMigration: false }),
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

/** A staged command file, split as Pi's loader splits it. */
interface CommandFile {
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
}

/** The one read of a staged command file: its text and that text split. */
interface ReadCommand {
  readonly text: string;
  readonly file: CommandFile;
}

function refusal(message: string): CommandInvocationOutcome {
  return { kind: "refuse", message };
}

/**
 * Finds the prompt command `request.name` and the scope whose staged prompts
 * directory holds its file. A command Pi loaded from any other file is not
 * this extension's.
 */
function locateStagedCommand(
  request: Pick<CommandInvocationRequest, "commands" | "name" | "cwd">,
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
 * these values reach a typed argument that names one, as upstream. The
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
 * Runs the `!` commands of a filled body with the shell the frontmatter
 * `shell` chooses, in the session's directory and the host's environment.
 * Returns `undefined` when that shell is a Bash this machine lacks.
 */
function contextShell(
  request: CommandInvocationRequest,
  frontmatter: Readonly<Record<string, unknown>>,
  dependencies: CommandInvocationDependencies,
): ShellRun | undefined {
  const { host } = dependencies;
  const choice = selectPromptShell(
    typeof frontmatter.shell === "string" ? frontmatter.shell : undefined,
    host,
  );
  if (choice.kind !== "shell") {
    return undefined;
  }

  return async (line) =>
    dependencies.runShell({ command: line, shell: choice.shell, cwd: request.cwd, env: host.env });
}

/**
 * D-CF1-01 / D-CF1-02: fills the body with the typed arguments and the
 * invocation variables, then replaces each `!` command with its output.
 * Throws the cores' errors.
 */
async function renderCommand(
  request: CommandInvocationRequest,
  command: StagedCommand,
  file: CommandFile,
  dependencies: CommandInvocationDependencies,
): Promise<CommandInvocationOutcome> {
  const filled = substituteArguments({
    body: file.body,
    args: request.args,
    argumentNames: parseArgumentNames(file.frontmatter.arguments),
    variables: commandVariables(request, command, file.frontmatter),
  });
  const run = contextShell(request, file.frontmatter, dependencies);
  return run === undefined
    ? refusal(bashMissingMessage(request.typed))
    : { kind: "send", text: await expandContextInjections(filled, run) };
}

/** T-01-24: the cores' own failures refuse with their message; any other propagates. */
function refusalFor(error: unknown): CommandInvocationOutcome {
  if (error instanceof ContextInjectionError || error instanceof InvocationTooLargeError) {
    return refusal(error.message);
  }

  throw error;
}

const ANY_PROJECT_REINSTALL = "/claude:plugin reinstall --scope project";

/**
 * D-CF3-07: the command that stages the project command again and records it
 * as this user's install. The project's `state.json` already records the
 * plugin, so `install` would refuse it; `reinstall` names the plugin whose
 * record lists the command among its prompts, or every project plugin when
 * no record does or the state cannot be read.
 */
async function projectReinstallCommand(
  request: CommandInvocationRequest,
  dependencies: CommandInvocationDependencies,
): Promise<string> {
  const extensionRoot = path.join(request.cwd, ".pi", "pi-claude-marketplace");
  const state = await dependencies.loadState(extensionRoot).catch(() => undefined);
  for (const [marketplace, { plugins }] of Object.entries(state?.marketplaces ?? {})) {
    for (const [plugin, record] of Object.entries(plugins)) {
      if (record.resources.prompts.includes(request.name)) {
        return `/claude:plugin reinstall ${plugin}@${marketplace} --scope project`;
      }
    }
  }

  return ANY_PROJECT_REINSTALL;
}

/**
 * D-CF3-07 (follows D-CF2-13): refuses a project command unless the user's
 * ledger of the project lists it with the digest of `text`, the file as read
 * for this invocation. A user command needs no record: no repository can
 * write the user scope. Returns `undefined` when the command may run.
 */
async function unprovenRefusal(
  request: CommandInvocationRequest,
  command: StagedCommand,
  text: string,
  agentDir: string,
  dependencies: CommandInvocationDependencies,
): Promise<CommandInvocationOutcome | undefined> {
  if (command.scope === "user") {
    return undefined;
  }

  const recorded = await provenProjectSkills(agentDir, request.cwd, dependencies.readFile);
  if (recorded.get(request.name) === commandFileDigest(text)) {
    return undefined;
  }

  const reinstall = await projectReinstallCommand(request, dependencies);
  return refusal(
    `The command ${request.typed} was not installed into the project ${request.cwd} on this machine, or its file changed after the install. Reinstall its plugin into this project with ${reinstall}, then run /reload to use it.`,
  );
}

/** A staged command read for one invocation, or the outcome that ends it early. */
type PreparedCommand =
  | { readonly kind: "ready"; readonly command: StagedCommand; readonly file: CommandFile }
  | CommandInvocationOutcome;

/**
 * Finds the staged command, refuses it in an untrusted project, reads its
 * file once, and refuses a project command this user's ledger does not list
 * with the digest of that text (D-CF3-07).
 */
async function prepareCommand(
  request: CommandInvocationRequest,
  dependencies: CommandInvocationDependencies,
): Promise<PreparedCommand> {
  const agentDir = dependencies.getAgentDir();
  const command = locateStagedCommand(request, agentDir);
  if (command === undefined) {
    return { kind: "not-staged" };
  }

  // D-CF3-07: Claude Code loads no project-scope plugin before the workspace
  // is trusted. A project command Pi still lists was discovered while the
  // project was trusted, so it refuses until the next `/reload`.
  if (command.scope === "project" && !request.projectTrusted) {
    return refusal(
      `The command ${request.typed} belongs to the project ${request.cwd}, which Pi does not trust. Trust the project folder, then run /reload to use it.`,
    );
  }

  // A file that changed after Pi loaded it, such as one an uninstall removed
  // before `/reload`, refuses the invocation: Pi's own expansion would send
  // the body it cached, with its `!` commands not run.
  const loaded = await dependencies
    .readFile(command.file)
    .then((text): ReadCommand => ({ text, file: parseFrontmatter(text) }))
    .catch((error: unknown) =>
      refusal(
        `Cannot read the command ${request.typed}: ${errorMessage(error)}. Run /reload to load the installed commands again.`,
      ),
    );
  if ("kind" in loaded) {
    return loaded;
  }

  const unproven = await unprovenRefusal(request, command, loaded.text, agentDir, dependencies);
  return unproven ?? { kind: "ready", command, file: loaded.file };
}

/**
 * D-CF3-06: builds what the model receives for a typed staged command,
 * reports that the command is not one this extension staged, or refuses it
 * with Claude Code's message (T-01-24). A project command in a project Pi
 * does not trust, a project command this user's ledger does not list with
 * the digest of its file (D-CF3-07), and a staged file that cannot be read
 * or parsed, refuse too. A failure other than these propagates.
 */
export async function invokeStagedCommand(
  request: CommandInvocationRequest,
  dependencies: CommandInvocationDependencies = NODE_DEPENDENCIES,
): Promise<CommandInvocationOutcome> {
  const prepared = await prepareCommand(request, dependencies);
  return prepared.kind === "ready"
    ? renderCommand(request, prepared.command, prepared.file, dependencies).catch(refusalFor)
    : prepared;
}

/**
 * Closes the D-CF3-01 gap: the text the model's command tool returns for a
 * staged command. The body is filled with the arguments and variables as a
 * typed invocation fills it, but its `!` commands do not run; each stays
 * literal. The same refusals as a typed invocation apply, and a command whose
 * frontmatter sets `disable-model-invocation: true` refuses with Claude Code
 * 2.1.316's Skill tool message, named for `toolName`.
 */
export async function expandStagedCommand(
  request: CommandInvocationRequest,
  toolName: string,
  dependencies: CommandInvocationDependencies = NODE_DEPENDENCIES,
): Promise<CommandInvocationOutcome> {
  const prepared = await prepareCommand(request, dependencies);
  if (prepared.kind !== "ready") {
    return prepared;
  }

  const { command, file } = prepared;
  if (file.frontmatter["disable-model-invocation"] === true) {
    return refusal(
      `Command ${request.name} cannot be used with ${toolName} due to disable-model-invocation. Ask the user to run ${request.typed} themselves; it cannot be invoked via ${toolName}. Do not replicate this command's workflow by other means; it is reserved for explicit user invocation.`,
    );
  }

  try {
    return {
      kind: "send",
      text: substituteArguments({
        body: file.body,
        args: request.args,
        argumentNames: parseArgumentNames(file.frontmatter.arguments),
        variables: commandVariables(request, command, file.frontmatter),
      }),
    };
  } catch (error) {
    return refusalFor(error);
  }
}

/** A staged command the model's command tool lists, with the text it is listed with. */
export interface ModelCommand {
  readonly name: string;
  readonly text: string;
}

/** What the listing reads from Pi and the session. */
export interface ModelCommandListRequest {
  /** Pi's commands, as `pi.getCommands()` returns them. */
  readonly commands: ReturnType<ExtensionAPI["getCommands"]>;
  readonly cwd: string;
  /** Whether Pi trusts the project at `cwd` (`ctx.isProjectTrusted()`). */
  readonly projectTrusted: boolean;
}

/** A frontmatter value that is a string with text in it, or `undefined`. */
function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Claude Code 2.1.316's listing rule (03-UPSTREAM-EVIDENCE Q1): a command is
 * listed when its source set a `description` or a `when_to_use`, and not when
 * it sets `disable-model-invocation: true`. Install wrote Claude Code's
 * fallback into a staged file whose source set no description (D-CF3-08), so
 * a staged description equal to that fallback counts as unset. The text is
 * the description, then ` - ` and `when_to_use` when set, cut at the skills'
 * 1,536-character listing cap.
 */
function listingText(file: CommandFile): string | undefined {
  if (file.frontmatter["disable-model-invocation"] === true) {
    return undefined;
  }

  const fallback = descriptionFallback(file.body, "Plugin command");
  const description = textValue(file.frontmatter.description) ?? fallback;
  const whenToUse = textValue(file.frontmatter.when_to_use);
  if (whenToUse === undefined) {
    return description === fallback ? undefined : truncate1536(description);
  }

  return truncate1536(`${description} - ${whenToUse}`);
}

/**
 * The listed text of the Pi command `name`, or `undefined` when it is not a
 * staged command the model may see: a project command in an untrusted
 * project or one this user's ledger does not list with the digest of its
 * file (D-CF3-07), a file that cannot be read or parsed, and a command the
 * listing rule leaves out.
 */
async function modelListing(
  request: ModelCommandListRequest,
  name: string,
  proven: () => Promise<ReadonlyMap<string, string>>,
  dependencies: CommandInvocationDependencies,
): Promise<string | undefined> {
  const command = locateStagedCommand({ ...request, name }, dependencies.getAgentDir());
  if (command === undefined || (command.scope === "project" && !request.projectTrusted)) {
    return undefined;
  }

  let text: string;
  let file: CommandFile;
  try {
    text = await dependencies.readFile(command.file);
    file = parseFrontmatter(text);
  } catch {
    return undefined;
  }

  if (command.scope === "project" && (await proven()).get(name) !== commandFileDigest(text)) {
    return undefined;
  }

  return listingText(file);
}

/**
 * Closes the D-CF3-01 gap: the staged commands Pi loaded that the model's
 * command tool lists, in Pi's order, with the text Claude Code lists each
 * with. The user's ledger is read once, and only for a project command.
 */
export async function listModelCommands(
  request: ModelCommandListRequest,
  dependencies: CommandInvocationDependencies = NODE_DEPENDENCIES,
): Promise<readonly ModelCommand[]> {
  let ledger: Promise<ReadonlyMap<string, string>> | undefined;
  const proven = (): Promise<ReadonlyMap<string, string>> => {
    ledger ??= provenProjectSkills(dependencies.getAgentDir(), request.cwd, dependencies.readFile);
    return ledger;
  };

  const names = request.commands
    .filter((command) => command.source === "prompt")
    .map((command) => command.name);
  const texts = await Promise.all(
    names.map(async (name) => modelListing(request, name, proven, dependencies)),
  );
  return names.flatMap((name, index) => {
    const text = texts[index];
    return text === undefined ? [] : [{ name, text }];
  });
}
