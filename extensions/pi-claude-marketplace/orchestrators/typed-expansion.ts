// orchestrators/typed-expansion.ts
//
// PG-HOOK-06 / D-PG6-18: names the prompt template or skill that a typed line
// expands, so the hooks bridge runs the UserPromptExpansion hooks before the
// line expands. A hook must be told the command the line will expand to, so
// the precedence is that of the two edge handlers that expand it, the skill
// alias handler (`edge/skill-aliases.ts`) and the command invocation handler
// (`edge/command-invocation.ts`): a Pi command of another source keeps its
// name, a template named like the token is that template, `/skill:` names a
// skill Pi lists, and any other token is looked up in the plugin alias table.
//
// D-PG6-19: `command_name` is the Claude-form name, which the plugin name
// table holds for a bridged skill; a bridged command keeps its Pi name, and an
// item of no plugin its bare name. `command_source` is `plugin` for a bridged
// item, and otherwise the settings source of the Pi scope that loaded it.
// When the table cannot be loaded, a listed template or skill still resolves,
// with the name Pi has and no source, and an alias resolves to nothing, as
// the alias handler, which reads the same failed load, does not expand it.

import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import type { TypedExpansion, TypedExpansionResolver } from "../bridges/hooks/index.ts";
import type { ExtensionAPI, ExtensionContext } from "../platform/pi-api.ts";
import type { PluginNames, PluginNamesCache } from "./skill-alias-state.ts";

type Command = ReturnType<ExtensionAPI["getCommands"]>[number];

const SKILL_PREFIX = "skill:";

/** The token as Pi splits a typed slash line: the text up to the first whitespace. */
const SLASH_TOKEN = /^\/(\S+)(?=\s|$)/;

function expansion(
  commandName: string,
  commandArgs: string,
  commandSource: string | undefined,
): TypedExpansion {
  return {
    commandName,
    commandArgs,
    ...(commandSource === undefined ? {} : { commandSource }),
  };
}

/** D-PG6-19: Claude Code's `command_source` for an item of a Pi scope; a temporary one has none. */
function scopeSource(command: Command): string | undefined {
  switch (command.sourceInfo.scope) {
    case "user":
      return "userSettings";
    case "project":
      return "projectSettings";
    case "temporary":
      return undefined;
  }
}

/** The Claude-form name of a listed item this extension bridged, or nothing for the user's own. */
function bridgedName(command: Command, piName: string, names: PluginNames): string | undefined {
  if (command.source === "skill") {
    return names.skills.get(piName);
  }

  return names.commands.has(piName) ? piName : undefined;
}

/** A template or skill that Pi lists, under its Pi name `piName`. */
function listedExpansion(
  command: Command,
  piName: string,
  args: string,
  names: PluginNames | undefined,
): TypedExpansion {
  if (names === undefined) {
    return expansion(piName, args, undefined);
  }

  const claudeName = bridgedName(command, piName, names);
  return claudeName === undefined
    ? expansion(piName, args, scopeSource(command))
    : expansion(claudeName, args, "plugin");
}

/** D-CF2-02: a token the plugin alias table resolves to a bridged skill or command. */
function aliasExpansion(
  token: string,
  args: string,
  names: PluginNames | undefined,
): TypedExpansion | undefined {
  const target = names?.aliases.get(token);
  if (names === undefined || target === undefined) {
    return undefined;
  }

  return target.kind === "skill"
    ? expansion(names.skills.get(target.generatedName) ?? target.generatedName, args, "plugin")
    : expansion(target.name, args, "plugin");
}

/** D-PG6-18 / T-06-28: the table of the context, or nothing when it cannot be loaded. */
async function loadNames(
  names: PluginNamesCache,
  ctx: ExtensionContext,
): Promise<PluginNames | undefined> {
  try {
    return await names.get(ctx.cwd, ctx.isProjectTrusted());
  } catch (err) {
    hookDebugLog(`typed expansion without the plugin names: ${errorMessage(err)}`, "skills");
    return undefined;
  }
}

/** The command a token names once the table is read: a template, a listed skill, or an alias. */
function namedExpansion(
  token: string,
  args: string,
  commands: readonly Command[],
  names: PluginNames | undefined,
): TypedExpansion | undefined {
  const template = commands.find(
    (command) => command.source === "prompt" && command.name === token,
  );
  if (template !== undefined) {
    return listedExpansion(template, token, args, names);
  }

  if (!token.startsWith(SKILL_PREFIX)) {
    return aliasExpansion(token, args, names);
  }

  const skill = commands.find((command) => command.source === "skill" && command.name === token);
  return skill === undefined
    ? undefined
    : listedExpansion(skill, token.slice(SKILL_PREFIX.length), args, names);
}

/**
 * PG-HOOK-06 / D-PG6-18: the resolver of a typed line over Pi's command list
 * and the shared plugin name cache. Creating it calls nothing on `pi`.
 */
export function createTypedExpansionResolver(
  pi: ExtensionAPI,
  names: PluginNamesCache,
): TypedExpansionResolver {
  return async (text, ctx) => {
    const token = SLASH_TOKEN.exec(text)?.[1];
    if (token === undefined) {
      return undefined;
    }

    // SK-6: a command of another source, such as an extension's, keeps its name.
    const commands = pi.getCommands();
    if (
      commands.some(
        (command) =>
          command.name === token && command.source !== "prompt" && command.source !== "skill",
      )
    ) {
      return undefined;
    }

    const args = text.slice(token.length + 1).trim();
    return namedExpansion(token, args, commands, await loadNames(names, ctx));
  };
}
