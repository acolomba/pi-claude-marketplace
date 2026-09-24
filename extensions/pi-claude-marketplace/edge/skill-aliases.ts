import { loadQualifiedSkillAliases } from "../orchestrators/skill-alias-state.ts";

import type { AutocompleteProvider, ExtensionAPI, ExtensionContext } from "../platform/pi-api.ts";

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

/** Wraps Pi's suggestions with plugin-qualified skill aliases. */
function aliasProvider(
  ctx: ExtensionContext,
  current: AutocompleteProvider,
  getQualifiedAliases: (cwd: string) => Promise<ReadonlyMap<string, string>>,
): AutocompleteProvider {
  return {
    getSuggestions: async (lines, line, col, options) => {
      const suggestions = await current.getSuggestions(lines, line, col, options);
      const typed = (lines[line] ?? "").slice(0, col);
      if (
        !typed.startsWith("/") ||
        typed.startsWith("/skill:") ||
        typed.includes(" ") ||
        !typed.includes(":")
      ) {
        return suggestions;
      }

      const aliases = await getQualifiedAliases(ctx.cwd);
      return appendAliasSuggestions(typed, suggestions, aliases.keys());
    },
    applyCompletion: (lines, line, col, item, prefix) =>
      current.applyCompletion(lines, line, col, item, prefix),
    shouldTriggerFileCompletion: (lines, line, col) =>
      current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
  };
}

/** Adds interactive plugin-qualified aliases for loaded skills. */
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
    ctx.ui.addAutocompleteProvider((current) => aliasProvider(ctx, current, getQualifiedAliases));
  });

  pi.on("input", (event, ctx) => {
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    const match = /^\/(\S+)(?=\s|$)/.exec(event.text);
    const name = match?.[1];
    if (!name?.includes(":")) {
      return { action: "continue" };
    }

    const commands = pi.getCommands();
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
