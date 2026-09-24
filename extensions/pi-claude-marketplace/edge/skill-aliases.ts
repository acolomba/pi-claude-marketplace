import path from "node:path";

import { loadQualifiedSkillAliases } from "../orchestrators/skill-alias-state.ts";
import { getAgentDir } from "../platform/pi-api.ts";

import type { AutocompleteProvider, ExtensionAPI, ExtensionContext } from "../platform/pi-api.ts";

/** Returns loaded marketplace skills whose bare names are free for aliases. */
function availableAliases(
  commands: ReturnType<ExtensionAPI["getCommands"]>,
  cwd: string,
): ReadonlySet<string> {
  const reserved = new Set(
    commands.filter((command) => command.source !== "skill").map((c) => c.name),
  );
  const roots = [
    path.join(getAgentDir(), "pi-claude-marketplace", "resources", "skills"),
    path.join(cwd, ".pi", "pi-claude-marketplace", "resources", "skills"),
  ];
  const aliases = new Set<string>();

  for (const command of commands) {
    if (command.source !== "skill" || !command.name.startsWith("skill:")) {
      continue;
    }

    const name = command.name.slice("skill:".length);
    const inManagedRoot = roots.some((root) => {
      const relative = path.relative(root, command.sourceInfo.path);
      return (
        !/^(?:\.\.[/\\]|[A-Za-z]:|[/\\])/.test(relative) && path.basename(relative) === "SKILL.md"
      );
    });
    if (inManagedRoot && !reserved.has(name)) {
      aliases.add(name);
    }
  }

  return aliases;
}

type Suggestions = Awaited<ReturnType<AutocompleteProvider["getSuggestions"]>>;

/** Adds unclaimed skill aliases alongside Pi's native suggestions. */
function appendAliasSuggestions(
  typed: string,
  suggestions: Suggestions,
  aliases: Iterable<string>,
): Suggestions {
  const query = typed.slice(1).toLowerCase();
  const nativeItems = suggestions?.items ?? [];
  const existing = new Set(nativeItems.map((item) => item.value));
  const matches = [...aliases].filter(
    (alias) => alias.toLowerCase().includes(query) && !existing.has(alias),
  );

  return matches.length === 0
    ? suggestions
    : {
        items: [...nativeItems, ...matches.map((alias) => ({ value: alias, label: alias }))],
        prefix: suggestions?.prefix ?? typed,
      };
}

/** Shows a loaded skill under its bare name when that name is free. */
function bareSuggestions(
  typed: string,
  suggestions: Suggestions,
  aliases: ReadonlySet<string>,
): Suggestions {
  const existing = new Set(suggestions?.items.map((item) => item.value) ?? []);
  const items = suggestions?.items.map((item) => {
    if (!item.value.startsWith("skill:")) {
      return item;
    }

    const name = item.value.slice("skill:".length);
    if (!aliases.has(name) || existing.has(name)) {
      return item;
    }

    existing.add(name);
    return { ...item, value: name, label: name };
  });
  const mapped =
    items === undefined || suggestions === null ? suggestions : { ...suggestions, items };
  return appendAliasSuggestions(typed, mapped, aliases);
}

/** Wraps Pi's suggestions with the available bare skill spellings. */
function aliasProvider(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  current: AutocompleteProvider,
  getQualifiedAliases: (cwd: string) => Promise<ReadonlyMap<string, string>>,
): AutocompleteProvider {
  return {
    getSuggestions: async (lines, line, col, options) => {
      const suggestions = await current.getSuggestions(lines, line, col, options);
      const typed = (lines[line] ?? "").slice(0, col);
      if (!typed.startsWith("/") || typed.startsWith("/skill:") || typed.includes(" ")) {
        return suggestions;
      }

      if (typed.includes(":")) {
        const aliases = await getQualifiedAliases(ctx.cwd);
        return appendAliasSuggestions(typed, suggestions, aliases.keys());
      }

      return bareSuggestions(typed, suggestions, availableAliases(pi.getCommands(), ctx.cwd));
    },
    applyCompletion: (lines, line, col, item, prefix) =>
      current.applyCompletion(lines, line, col, item, prefix),
    shouldTriggerFileCompletion: (lines, line, col) =>
      current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
  };
}

/** Adds interactive bare and plugin-qualified aliases for loaded skills. */
export function registerSkillAliases(
  pi: ExtensionAPI,
  loadAliases: (
    pi: ExtensionAPI,
    cwd: string,
  ) => Promise<ReadonlyMap<string, string>> = loadQualifiedSkillAliases,
): void {
  const cache = new Map<string, Promise<ReadonlyMap<string, string>>>();
  const getQualifiedAliases = (cwd: string): Promise<ReadonlyMap<string, string>> => {
    let aliases = cache.get(cwd);
    if (aliases === undefined) {
      aliases = loadAliases(pi, cwd);
      cache.set(cwd, aliases);
    }

    return aliases;
  };

  pi.on("session_start", (_event, ctx) => {
    cache.clear();
    ctx.ui.addAutocompleteProvider((current) =>
      aliasProvider(pi, ctx, current, getQualifiedAliases),
    );
  });

  pi.on("input", (event, ctx) => {
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    const match = /^\/(\S+)(?=\s|$)/.exec(event.text);
    const name = match?.[1];
    if (name === undefined) {
      return { action: "continue" };
    }

    const commands = pi.getCommands();
    const bare = availableAliases(commands, ctx.cwd).has(name);
    if (bare) {
      return {
        action: "transform",
        text: `/skill:${name}${event.text.slice(name.length + 1)}`,
        ...(event.images !== undefined && { images: event.images }),
      };
    }

    if (!name.includes(":")) {
      return { action: "continue" };
    }

    if (commands.some((command) => command.source !== "skill" && command.name === name)) {
      return { action: "continue" };
    }

    return getQualifiedAliases(ctx.cwd).then((aliases) => {
      const generatedName = aliases.get(name);
      return generatedName === undefined
        ? { action: "continue" }
        : {
            action: "transform",
            text: `/skill:${generatedName}${event.text.slice(name.length + 1)}`,
            ...(event.images !== undefined && { images: event.images }),
          };
    });
  });
}
