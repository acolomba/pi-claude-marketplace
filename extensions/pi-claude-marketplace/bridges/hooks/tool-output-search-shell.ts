import { isDeepStrictEqual } from "node:util";

import { searchShellToolResponse } from "./tool-result-search-shell.ts";

import type { ToolResultEvent, ToolResultEventResult } from "../../platform/pi-api.ts";

type Fields = Record<string, unknown>;

function record(value: unknown): value is Fields {
  if (value === null || typeof value !== "object") {
    return false;
  }

  return !Array.isArray(value);
}

function fieldsAre(value: Fields, names: readonly string[]): boolean {
  for (const key of Object.keys(value)) {
    if (!names.includes(key)) {
      return false;
    }
  }

  return true;
}

function optionalString(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return typeof value === "string";
}

function optionalCount(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function contentBlocks(value: unknown): value is ToolResultEvent["content"] {
  return (
    Array.isArray(value) &&
    value.every(
      (block) =>
        record(block) &&
        ((fieldsAre(block, ["type", "text"]) &&
          block.type === "text" &&
          typeof block.text === "string") ||
          (fieldsAre(block, ["type", "data", "mimeType"]) &&
            block.type === "image" &&
            typeof block.data === "string" &&
            typeof block.mimeType === "string" &&
            /^image\/(?:png|jpeg|gif|webp|bmp)$/.test(block.mimeType) &&
            /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(block.data) &&
            block.data.length > 0)),
    )
  );
}

function validGlob(value: Fields): boolean {
  return (
    fieldsAre(value, [
      "filenames",
      "numFiles",
      "truncated",
      "durationMs",
      "totalMatches",
      "countIsComplete",
      "timedOut",
    ]) &&
    (value.filenames === undefined || strings(value.filenames)) &&
    optionalCount(value.numFiles) &&
    optionalCount(value.durationMs) &&
    optionalCount(value.totalMatches) &&
    optionalBoolean(value.truncated) &&
    optionalBoolean(value.countIsComplete) &&
    optionalBoolean(value.timedOut)
  );
}

function validGrep(value: Fields): boolean {
  return (
    fieldsAre(value, [
      "mode",
      "content",
      "filenames",
      "numFiles",
      "numLines",
      "numMatches",
      "totalFiles",
      "totalLines",
      "appliedLimit",
      "appliedOffset",
      "timedOut",
    ]) &&
    (value.mode === undefined ||
      value.mode === "content" ||
      value.mode === "files_with_matches" ||
      value.mode === "count") &&
    optionalString(value.content) &&
    (value.filenames === undefined || strings(value.filenames)) &&
    [
      value.numFiles,
      value.numLines,
      value.numMatches,
      value.totalFiles,
      value.totalLines,
      value.appliedLimit,
      value.appliedOffset,
    ].every(optionalCount) &&
    optionalBoolean(value.timedOut)
  );
}

function validShell(value: Fields, bash: boolean): boolean {
  return (
    fieldsAre(value, [
      "stdout",
      "stderr",
      "interrupted",
      "isImage",
      "rawOutputPath",
      "structuredContent",
      "persistedOutputPath",
      "persistedOutputSize",
      "returnCodeInterpretation",
    ]) &&
    optionalString(value.stdout) &&
    optionalString(value.stderr) &&
    optionalBoolean(value.interrupted) &&
    optionalBoolean(value.isImage) &&
    optionalString(value.rawOutputPath) &&
    optionalString(value.persistedOutputPath) &&
    optionalCount(value.persistedOutputSize) &&
    optionalString(value.returnCodeInterpretation) &&
    (value.structuredContent === undefined || (bash && contentBlocks(value.structuredContent))) &&
    (bash || value.rawOutputPath === undefined)
  );
}

function renderedSearch(value: Fields, tool: "find" | "grep"): string | undefined {
  if (tool === "find") {
    return strings(value.filenames) ? value.filenames.join("\n") : undefined;
  }

  if (value.mode === "files_with_matches") {
    return strings(value.filenames) ? value.filenames.join("\n") : undefined;
  }

  if (typeof value.content === "string") {
    return value.content;
  }

  return value.mode === "count" && typeof value.numMatches === "number"
    ? String(value.numMatches)
    : undefined;
}

function renderedShell(value: Fields, bash: boolean): ToolResultEvent["content"] | undefined {
  if (bash && contentBlocks(value.structuredContent)) {
    return value.structuredContent;
  }

  const blocks: ToolResultEvent["content"] = [];
  if (typeof value.stdout === "string") {
    blocks.push({ type: "text", text: value.stdout });
  }

  if (typeof value.stderr === "string") {
    blocks.push({ type: "text", text: value.stderr });
  }

  return blocks.length > 0 ? blocks : undefined;
}

/** Validates and renders a search or shell result replacement. */
export function renderSearchShellToolOutput(
  event: ToolResultEvent,
  candidate: unknown,
  cwd: string,
): ToolResultEventResult | undefined {
  if (!record(candidate) || typeof event.toolName !== "string") {
    return undefined;
  }

  const tool = event.toolName;
  if (tool !== "find" && tool !== "grep" && tool !== "bash" && tool !== "powershell") {
    return undefined;
  }

  if (isDeepStrictEqual(candidate, searchShellToolResponse(event, cwd))) {
    return undefined;
  }

  if (tool === "find" || tool === "grep") {
    const valid = tool === "find" ? validGlob(candidate) : validGrep(candidate);
    const text = valid ? renderedSearch(candidate, tool) : undefined;
    return text === undefined ? undefined : { content: [{ type: "text", text }], details: null };
  }

  if (!validShell(candidate, tool === "bash")) {
    return undefined;
  }

  const content = renderedShell(candidate, tool === "bash");
  return content === undefined ? undefined : { content, details: null };
}
