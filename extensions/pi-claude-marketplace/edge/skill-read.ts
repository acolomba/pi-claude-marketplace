import { homedir } from "node:os";
import path from "node:path";

import { fillSkillRead } from "../orchestrators/skill-invocation.ts";

import type { SkillReadRequest } from "../orchestrators/skill-invocation.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
  ToolResultEvent,
  ToolResultEventResult,
} from "../platform/pi-api.ts";

/**
 * The file a read tool call names, resolved as Pi's read tool resolves it: a
 * leading `@` dropped, a leading `~` read as the home directory, and a
 * relative path read against the session's directory.
 */
function readPath(requested: string, cwd: string, home: string): string {
  const stripped = requested.startsWith("@") ? requested.slice(1) : requested;
  const expanded =
    stripped === "~" || stripped.startsWith("~/") ? home + stripped.slice(1) : stripped;
  return path.resolve(cwd, expanded);
}

/**
 * The 0-based index of the first file line a read returned. Pi's read tool
 * starts at line `offset`, counted from 1, and at the first line when the
 * offset is absent or 0.
 */
function startLine(offset: unknown): number {
  return typeof offset === "number" && offset > 0 ? offset - 1 : 0;
}

/** The one text a successful read of a text file returned, or `undefined`. */
function readText(event: ToolResultEvent): string | undefined {
  const [first, ...rest] = event.content;
  return event.toolName === "read" && !event.isError && rest.length === 0 && first?.type === "text"
    ? first.text
    : undefined;
}

/**
 * Amends D-CF1-03 (the 2026-11-02 user decision on the Pi gap report, item
 * 3): when the model's read tool returns a staged plugin `SKILL.md`, the text
 * it gets has the skill's `${CLAUDE_*}` values filled and its arguments
 * empty, as a typed invocation with no arguments has them. No `!` command
 * runs. Any other result keeps its content, and a failed fill keeps it too.
 */
export function registerSkillReadFill(
  pi: ExtensionAPI,
  fill: (request: SkillReadRequest) => Promise<string | undefined> = fillSkillRead,
  home: () => string = homedir,
): void {
  const filled = async (
    event: ToolResultEvent,
    ctx: ExtensionContext,
    text: string,
    requested: string,
  ): Promise<ToolResultEventResult | undefined> => {
    try {
      const replaced = await fill({
        commands: pi.getCommands(),
        file: readPath(requested, ctx.cwd, home()),
        text,
        startLine: startLine(event.input.offset),
        cwd: ctx.cwd,
        projectTrusted: ctx.isProjectTrusted(),
        sessionId: ctx.sessionManager.getSessionId(),
        thinkingLevel: pi.getThinkingLevel(),
      });
      return replaced === undefined || replaced === text
        ? undefined
        : { content: [{ type: "text", text: replaced }] };
    } catch {
      return undefined;
    }
  };

  pi.on("tool_result", (event, ctx) => {
    const text = readText(event);
    const requested = event.input.path;
    return text === undefined || typeof requested !== "string"
      ? undefined
      : filled(event, ctx, text, requested);
  });
}
