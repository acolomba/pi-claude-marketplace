import { homedir } from "node:os";

import { requestedPath } from "./tool-input.ts";

import type { ToolResultEvent } from "../../platform/pi-api.ts";

interface Hunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly lines: string[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

function hunkHeader(row: string): Omit<Hunk, "lines"> | undefined {
  const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?:.*)$/.exec(row);
  if (!header) {
    return undefined;
  }

  const oldStart = Number(header[1]);
  const oldLines = header[2] === undefined ? 1 : Number(header[2]);
  const newStart = Number(header[3]);
  const newLines = header[4] === undefined ? 1 : Number(header[4]);
  if (
    ![oldStart, oldLines, newStart, newLines].every(Number.isSafeInteger) ||
    (oldStart === 0 && oldLines !== 0) ||
    (newStart === 0 && newLines !== 0)
  ) {
    return undefined;
  }

  return { oldStart, oldLines, newStart, newLines };
}

function hunkBody(
  rows: string[],
  start: number,
  header: Omit<Hunk, "lines">,
): { readonly hunk: Hunk; readonly next: number } | undefined {
  const lines: string[] = [];
  let oldCount = 0;
  let newCount = 0;
  let index = start;
  for (const row of rows.slice(start)) {
    if (row.startsWith("@@ ")) {
      break;
    }

    index++;

    if (row.startsWith(" ")) {
      oldCount++;
      newCount++;
    } else if (row.startsWith("-")) {
      oldCount++;
    } else if (row.startsWith("+")) {
      newCount++;
    } else if (row !== String.raw`\ No newline at end of file` || lines.length === 0) {
      return undefined;
    }

    lines.push(row);
  }

  if (oldCount !== header.oldLines || newCount !== header.newLines) {
    return undefined;
  }

  return { hunk: { ...header, lines }, next: index };
}

/** Decodes only complete unified hunks whose declared old/new counts match. */
function unifiedHunks(patch: string): Hunk[] | undefined {
  const rows = patch.split("\n");
  if (rows.at(-1) === "") {
    rows.pop();
  }

  if (rows.length < 3 || !rows[0]?.startsWith("--- ") || !rows[1]?.startsWith("+++ ")) {
    return undefined;
  }

  const hunks: Hunk[] = [];
  let index = 2;
  while (index < rows.length) {
    const header = hunkHeader(String(rows[index]));
    if (header === undefined) {
      return undefined;
    }

    const body = hunkBody(rows, index + 1, header);
    if (body === undefined) {
      return undefined;
    }

    hunks.push(body.hunk);
    index = body.next;
  }

  return hunks;
}

function editResponse(event: ToolResultEvent, filePath: string): unknown {
  const oldString = event.input.oldText ?? event.input.old_string;
  const newString = event.input.newText ?? event.input.new_string;
  if (typeof oldString !== "string" || typeof newString !== "string") {
    return undefined;
  }

  const response: Record<string, unknown> = { filePath, oldString, newString, replaceAll: false };
  if (record(event.details) && typeof event.details.patch === "string") {
    const hunks = unifiedHunks(event.details.patch);
    if (hunks !== undefined) {
      response.structuredPatch = hunks;
    }
  }

  return response;
}

function readResponse(event: ToolResultEvent, filePath: string): unknown {
  const image = event.content.find((block) => block.type === "image");
  if (image?.type === "image") {
    return { type: "image", file: { base64: image.data, type: image.mimeType } };
  }

  const text = event.content.find((block) => block.type === "text");
  if (text?.type !== "text") {
    return undefined;
  }

  const truncation =
    record(event.details) && record(event.details.truncation)
      ? event.details.truncation
      : undefined;
  const raw = truncation && typeof truncation.content === "string" ? truncation.content : text.text;
  const file: Record<string, unknown> = {
    filePath,
    content: raw,
    startLine:
      typeof event.input.offset === "number" && Number.isSafeInteger(event.input.offset)
        ? event.input.offset
        : 1,
  };
  const ambiguous =
    raw === text.text && /\n\n\[(?:\d+ more lines in file|Showing lines \d+-\d+ of \d+)/.test(raw);
  if (!ambiguous && truncation?.firstLineExceedsLimit !== true) {
    file.numLines = lineCount(raw);
    if (
      event.input.offset === undefined &&
      event.input.limit === undefined &&
      !truncation?.truncated
    ) {
      file.totalLines = lineCount(raw);
    }
  }

  return { type: "text", file };
}

/** Projects facts supplied by a successful Pi file tool into Claude's result fields. */
export function fileToolResponse(event: ToolResultEvent, cwd: string): unknown {
  if (typeof event.toolName !== "string") {
    return undefined;
  }

  const tool = event.toolName;
  if (tool !== "read" && tool !== "edit" && tool !== "write") {
    return undefined;
  }

  if (!record(event.input)) {
    return undefined;
  }

  const inputPath = event.input.path ?? event.input.file_path;
  if (typeof inputPath !== "string") {
    return undefined;
  }

  const filePath = requestedPath(inputPath, cwd, homedir());
  if (tool === "write") {
    return typeof event.input.content === "string"
      ? { filePath, content: event.input.content }
      : undefined;
  }

  return tool === "edit" ? editResponse(event, filePath) : readResponse(event, filePath);
}
