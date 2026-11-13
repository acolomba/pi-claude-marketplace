import path from "node:path";

import type { ToolResultEvent } from "../../platform/pi-api.ts";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function displayedText(event: ToolResultEvent): string | undefined {
  const block = event.content.find((item) => item.type === "text");
  return block?.type === "text" ? block.text : undefined;
}

function rawSearchText(event: ToolResultEvent): string | undefined {
  const displayed = displayedText(event);
  if (displayed === undefined) {
    return undefined;
  }

  if (record(event.details) && record(event.details.truncation)) {
    const raw = event.details.truncation.content;
    if (typeof raw === "string") {
      return raw;
    }
  }

  if (!record(event.details)) {
    return displayed;
  }

  const hasNotice =
    typeof event.details.resultLimitReached === "number" ||
    typeof event.details.matchLimitReached === "number" ||
    event.details.linesTruncated === true;
  if (!hasNotice) {
    return displayed;
  }

  const notice =
    /\n\n\[(?:\d+ (?:results|matches) limit reached|\d+(?:\.\d+)?(?:KB|MB) limit reached|Some lines truncated to \d+ chars\.)[^\]]*\]$/.exec(
      displayed,
    );
  return notice ? displayed.slice(0, notice.index) : displayed;
}

function searchTruncated(details: unknown, limitKey: string): boolean | undefined {
  if (!record(details)) {
    return undefined;
  }

  if (details[limitKey] !== undefined) {
    return true;
  }

  return record(details.truncation) && typeof details.truncation.truncated === "boolean"
    ? details.truncation.truncated
    : undefined;
}

function globResponse(event: ToolResultEvent, cwd: string): unknown {
  const raw = rawSearchText(event);
  if (raw === undefined) {
    return undefined;
  }

  const truncated = searchTruncated(event.details, "resultLimitReached");
  const response: Record<string, unknown> = {};
  if (truncated !== undefined) {
    response.truncated = truncated;
  }

  if (raw === "No files found matching pattern") {
    return { ...response, filenames: [], numFiles: 0 };
  }

  const byteTruncated =
    record(event.details) &&
    record(event.details.truncation) &&
    event.details.truncation.truncated === true;
  if (byteTruncated || raw.includes("\n") || raw.includes("\r") || raw === "") {
    return response;
  }

  const root = typeof event.input.path === "string" ? path.resolve(cwd, event.input.path) : cwd;
  response.filenames = [path.resolve(root, raw)];
  response.numFiles = 1;
  return response;
}

function grepResponse(event: ToolResultEvent): unknown {
  const raw = rawSearchText(event);
  if (raw === undefined) {
    return undefined;
  }

  if (raw === "No matches found") {
    return { mode: "content", content: "", numLines: 0 };
  }

  const response: Record<string, unknown> = { mode: "content", content: raw };
  if (!raw.includes("\n") && /^.+[:-]\d+[:-] /.test(raw)) {
    response.numLines = 1;
  }

  return response;
}

function shellResponse(event: ToolResultEvent, bash: boolean): unknown {
  const response: Record<string, unknown> = { interrupted: false };
  if (record(event.details) && typeof event.details.fullOutputPath === "string") {
    response.persistedOutputPath = event.details.fullOutputPath;
  }

  if (bash) {
    response.structuredContent = event.content;
  }

  return response;
}

/** Projects only supported facts from a successful native search or shell result. */
export function searchShellToolResponse(event: ToolResultEvent, cwd: string): unknown {
  if (typeof event.toolName !== "string") {
    return undefined;
  }

  switch (event.toolName.toLowerCase()) {
    case "find":
      return globResponse(event, cwd);
    case "grep":
      return grepResponse(event);
    case "bash":
      return shellResponse(event, true);
    case "powershell":
      return shellResponse(event, false);
    default:
      return undefined;
  }
}
