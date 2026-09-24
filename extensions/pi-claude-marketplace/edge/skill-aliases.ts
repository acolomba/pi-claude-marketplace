import path from "node:path";

import { getAgentDir } from "../platform/pi-api.ts";

import type { AutocompleteProvider, ExtensionAPI, ExtensionContext } from "../platform/pi-api.ts";

/** Returns loaded marketplace skills whose bare names are free for aliases. */
function availableAliases(pi: ExtensionAPI, cwd: string): ReadonlySet<string> {
  const commands = pi.getCommands();
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

/** Wraps Pi's suggestions with the available bare skill spellings. */
function aliasProvider(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  current: AutocompleteProvider,
): AutocompleteProvider {
  return {
    getSuggestions: async (lines, line, col, options) => {
      const suggestions = await current.getSuggestions(lines, line, col, options);
      const typed = (lines[line] ?? "").slice(0, col);
      if (!typed.startsWith("/") || typed.startsWith("/skill:") || typed.includes(" ")) {
        return suggestions;
      }

      const aliases = availableAliases(pi, ctx.cwd);
      const query = typed.slice(1).toLowerCase();
      const existing = new Set(suggestions?.items.map((item) => item.value) ?? []);
      const items = (suggestions?.items ?? []).map((item) => {
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
      for (const name of aliases) {
        if (name.toLowerCase().includes(query) && !existing.has(name)) {
          items.push({ value: name, label: name });
        }
      }

      if (items.length === 0) {
        return suggestions;
      }

      return {
        items,
        prefix: suggestions?.prefix ?? typed,
      };
    },
    applyCompletion: (lines, line, col, item, prefix) =>
      current.applyCompletion(lines, line, col, item, prefix),
    shouldTriggerFileCompletion: (lines, line, col) =>
      current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
  };
}

/** Adds interactive bare aliases for the skills Pi has loaded after reload. */
export function registerSkillAliases(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) => aliasProvider(pi, ctx, current));
  });

  pi.on("input", (event, ctx) => {
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    const match = /^\/([a-z0-9][a-z0-9-]*)(?=\s|$)/.exec(event.text);
    const name = match?.[1];
    if (name === undefined || !availableAliases(pi, ctx.cwd).has(name)) {
      return { action: "continue" };
    }

    return {
      action: "transform",
      text: `/skill:${name}${event.text.slice(name.length + 1)}`,
      ...(event.images !== undefined && { images: event.images }),
    };
  });
}
