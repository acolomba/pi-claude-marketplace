import { homedir } from "node:os";
import { isDeepStrictEqual } from "node:util";

import { editPairViews } from "./tool-batch.ts";
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

function validReadText(file: Fields): file is Fields & { content: string } {
  return (
    fieldsAre(file, [
      "filePath",
      "content",
      "startLine",
      "numLines",
      "totalLines",
      "truncatedByTokenCap",
    ]) &&
    optionalString(file.filePath) &&
    typeof file.content === "string" &&
    optionalCount(file.startLine) &&
    optionalCount(file.numLines) &&
    optionalCount(file.totalLines) &&
    (file.truncatedByTokenCap === undefined || typeof file.truncatedByTokenCap === "boolean")
  );
}

function validReadImage(file: Fields): file is Fields & { base64: string; type: string } {
  return (
    fieldsAre(file, ["base64", "type"]) &&
    typeof file.base64 === "string" &&
    typeof file.type === "string" &&
    /^image\/(?:png|jpeg|gif|webp|bmp)$/.test(file.type) &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64) &&
    file.base64.length > 0
  );
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
    if (!validReadText(file)) {
      return undefined;
    }

    if (isDeepStrictEqual(value, fileToolResponse(event, cwd))) {
      return undefined;
    }

    return changedText(event, file.content);
  }

  if (value.type !== "image" || !validReadImage(file)) {
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

  if (
    ![value.oldStart, value.oldLines, value.newStart, value.newLines].every(
      (count) => typeof count === "number" && Number.isSafeInteger(count) && count >= 0,
    )
  ) {
    return false;
  }

  if (
    (value.oldStart === 0 && value.oldLines !== 0) ||
    (value.newStart === 0 && value.newLines !== 0)
  ) {
    return false;
  }

  const lines = value.lines;
  if (
    !lines.every(
      (line, index) =>
        /^[ +-]/.test(line) || (line === "\\ No newline at end of file" && index > 0),
    )
  ) {
    return false;
  }

  const oldCount = lines.filter((line) => line.startsWith(" ") || line.startsWith("-")).length;
  const newCount = lines.filter((line) => line.startsWith(" ") || line.startsWith("+")).length;
  return oldCount === value.oldLines && newCount === value.newLines;
}

function editEcho(event: ToolResultEvent, value: Fields, cwd: string): boolean {
  if (isDeepStrictEqual(value, fileToolResponse(event, cwd))) {
    return true;
  }

  const batch = editPairViews(event.input, cwd, homedir());
  return (
    batch?.pairs.some((pair) =>
      isDeepStrictEqual(
        value,
        fileToolResponse(
          {
            ...event,
            input: {
              path: batch.target,
              oldText: pair.input.old_string,
              newText: pair.input.new_string,
            },
          },
          cwd,
        ),
      ),
    ) ?? false
  );
}

function renderEdit(
  event: ToolResultEvent,
  value: Fields,
  cwd: string,
): ToolResultEventResult | undefined {
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

  if (editEcho(event, value, cwd)) {
    return undefined;
  }

  const hunks = value.structuredPatch;
  const diff = hunks
    ?.map(
      (hunk) =>
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n${(hunk.lines as string[]).join("\n")}`,
    )
    .join("\n");
  const text = `${value.filePath}: ${value.newString}` + (diff === undefined ? "" : "\n" + diff);
  return changedText(event, text);
}

function renderWrite(
  event: ToolResultEvent,
  value: Fields,
  cwd: string,
): ToolResultEventResult | undefined {
  if (
    !fieldsAre(value, ["filePath", "content", "type"]) ||
    typeof value.filePath !== "string" ||
    typeof value.content !== "string" ||
    (value.type !== undefined && value.type !== "create" && value.type !== "update")
  ) {
    return undefined;
  }

  if (isDeepStrictEqual(value, fileToolResponse(event, cwd))) {
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

  switch (event.toolName) {
    case "read":
      return renderRead(event, candidate, cwd);
    case "edit":
      return renderEdit(event, candidate, cwd);
    case "write":
      return renderWrite(event, candidate, cwd);
    default:
      return undefined;
  }
}
