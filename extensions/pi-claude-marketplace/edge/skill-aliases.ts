import { randomUUID } from "node:crypto";

import { loadQualifiedSkillAliases } from "../orchestrators/skill-alias-state.ts";
import { invokeBridgedSkill } from "../orchestrators/skill-invocation.ts";
import { notifyUsageError } from "../shared/notification-dispatch.ts";
import { openNotificationRun } from "../shared/notification-run.ts";

import type {
  SkillInvocationOutcome,
  SkillInvocationRequest,
} from "../orchestrators/skill-invocation.ts";
import type {
  AutocompleteProvider,
  ExtensionAPI,
  ExtensionContext,
  InputEvent,
  InputEventResult,
} from "../platform/pi-api.ts";

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

/**
 * D-CF2-06: maps an invocation outcome onto Pi's input result. T-01-24: an
 * aborted invocation is reported to the user and handled, so nothing of it
 * reaches the model.
 */
function inputResult(
  outcome: SkillInvocationOutcome,
  event: InputEvent,
  reportAbort: (message: string) => void,
): InputEventResult {
  switch (outcome.kind) {
    case "ok":
      return {
        action: "transform",
        text: outcome.text,
        ...(event.images !== undefined && { images: event.images }),
      };
    case "abort":
      reportAbort(outcome.message);
      return { action: "handled" };
    case "not-bridged":
      return { action: "continue" };
  }
}

/**
 * D-CF2-05 / D-CF2-06: resolves a typed `/skill:` token or plugin-qualified
 * alias, from interactive or RPC input, and sends a bridged skill through the
 * invocation; `extension` input passes through unchanged.
 */
export function registerSkillAliases(
  pi: ExtensionAPI,
  loadAliases: (
    pi: ExtensionAPI,
    cwd: string,
  ) => Promise<ReadonlyMap<string, string>> = loadQualifiedSkillAliases,
  invokeSkill: (
    request: SkillInvocationRequest,
  ) => Promise<SkillInvocationOutcome> = invokeBridgedSkill,
  createInvocationId: () => string = randomUUID,
): void {
  // A skill abort is a `usage-error` of the command `skill`, so RPC and JSON
  // clients receive it as a `claude-plugin` entry with that origin.
  const reportAbort = (ctx: ExtensionContext, message: string): void => {
    const run = openNotificationRun(pi, {
      kind: "command",
      commandId: "skill",
      invocationId: createInvocationId(),
    });
    notifyUsageError(ctx, run, { message, usage: "" });
  };

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
    if (event.source === "extension") {
      return { action: "continue" };
    }

    const match = /^\/(\S+)(?=\s|$)/.exec(event.text);
    const token = match?.[1];
    if (!token?.includes(":")) {
      return { action: "continue" };
    }

    const commands = pi.getCommands();
    if (commands.some((command) => command.source !== "skill" && command.name === token)) {
      return { action: "continue" };
    }

    if (token.startsWith("skill:")) {
      return invokeSkill({
        commands,
        generatedName: token.slice("skill:".length),
        typed: `/${token}`,
        args: event.text.slice(token.length + 1).trim(),
        cwd: ctx.cwd,
        sessionId: ctx.sessionManager.getSessionId(),
        thinkingLevel: pi.getThinkingLevel(),
      }).then((outcome) =>
        inputResult(outcome, event, (message) => {
          reportAbort(ctx, message);
        }),
      );
    }

    return getQualifiedAliases(ctx.cwd).then((aliases) => {
      const generatedName = aliases.get(token);
      return generatedName === undefined
        ? { action: "continue" }
        : {
            action: "transform",
            text: `/skill:${generatedName}${event.text.slice(token.length + 1)}`,
            ...(event.images !== undefined && { images: event.images }),
          };
    });
  });
}
