import { isDeepStrictEqual } from "node:util";

import { fileToolResponse } from "./tool-result-files.ts";

import type { ToolResultEvent, ToolResultEventResult } from "../../platform/pi-api.ts";

type Fields = Record<string, unknown>;

function record(value: unknown): value is Fields {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fieldsAre(value: Fields, names: readonly string[]): boolean {
  return Object.keys(value).every((key) => names.includes(key));
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function optionalCount(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  );
}

function changedText(event: ToolResultEvent, text: string): ToolResultEventResult | undefined {
  const content = [{ type: "text" as const, text }];
  return isDeepStrictEqual(content, event.content) ? undefined : { content, details: null };
}

function renderRead(
  event: ToolResultEvent,
  value: Fields,
  cwd: string,
): ToolResultEventResult | undefined {
  if (!fieldsAre(value, ["type", "file"]) || !record(value.file)) {
    return undefined;
  }

  const file = value.file;
  if (value.type === "text") {
    if (
      !fieldsAre(file, [
        "filePath",
        "content",
        "startLine",
        "numLines",
        "totalLines",
        "truncatedByTokenCap",
      ]) ||
      !optionalString(file.filePath) ||
      typeof file.content !== "string" ||
      !optionalCount(file.startLine) ||
      !optionalCount(file.numLines) ||
      !optionalCount(file.totalLines) ||
      (file.truncatedByTokenCap !== undefined && typeof file.truncatedByTokenCap !== "boolean")
    ) {
      return undefined;
    }

    if (isDeepStrictEqual(value, fileToolResponse(event, cwd))) {
      return undefined;
    }

    return changedText(event, file.content);
  }

  if (
    value.type !== "image" ||
    !fieldsAre(file, ["base64", "type"]) ||
    typeof file.base64 !== "string" ||
    typeof file.type !== "string" ||
    !/^image\/(?:png|jpeg|gif|webp|bmp)$/.test(file.type) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)
  ) {
    return undefined;
  }

  const image = { type: "image" as const, data: file.base64, mimeType: file.type };
  const oldImage = event.content.find((block) => block.type === "image");
  if (isDeepStrictEqual(image, oldImage)) {
    return undefined;
  }

  return { content: [image], details: null };
}

function validHunk(value: unknown): value is Fields {
  if (
    !record(value) ||
    !fieldsAre(value, ["oldStart", "oldLines", "newStart", "newLines", "lines"]) ||
    !Array.isArray(value.lines) ||
    !value.lines.every((line) => typeof line === "string")
  ) {
    return false;
  }

  return [value.oldStart, value.oldLines, value.newStart, value.newLines].every(
    (count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0,
  );
}

function renderEdit(event: ToolResultEvent, value: Fields): ToolResultEventResult | undefined {
  if (
    !fieldsAre(value, ["filePath", "oldString", "newString", "replaceAll", "structuredPatch"]) ||
    typeof value.filePath !== "string" ||
    !optionalString(value.oldString) ||
    typeof value.newString !== "string" ||
    (value.replaceAll !== undefined && value.replaceAll !== false) ||
    (value.structuredPatch !== undefined &&
      (!Array.isArray(value.structuredPatch) || !value.structuredPatch.every(validHunk)))
  ) {
    return undefined;
  }

  const hunks = value.structuredPatch;
  const diff = hunks
    ?.map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${(hunk.lines as string[]).join("\n")}`,
    )
    .join("\n");
  const text = [value.filePath, value.newString, diff]
    .filter((part) => part !== undefined)
    .join("\n");
  return changedText(event, text);
}

function renderWrite(event: ToolResultEvent, value: Fields): ToolResultEventResult | undefined {
  if (
    !fieldsAre(value, ["filePath", "content", "type"]) ||
    typeof value.filePath !== "string" ||
    typeof value.content !== "string" ||
    (value.type !== undefined && value.type !== "create" && value.type !== "update")
  ) {
    return undefined;
  }

  const prefix = value.type === undefined ? value.filePath : `${value.type} ${value.filePath}`;
  return changedText(event, `${prefix}\n${value.content}`);
}

/** Validates and renders one hook file-result replacement without file I/O. */
export function renderFileToolOutput(
  event: ToolResultEvent,
  candidate: unknown,
  cwd: string,
): ToolResultEventResult | undefined {
  if (!record(candidate)) {
    return undefined;
  }

  switch (event.toolName.toLowerCase()) {
    case "read":
      return renderRead(event, candidate, cwd);
    case "edit":
      return renderEdit(event, candidate);
    case "write":
      return renderWrite(event, candidate);
    default:
      return undefined;
  }
}
