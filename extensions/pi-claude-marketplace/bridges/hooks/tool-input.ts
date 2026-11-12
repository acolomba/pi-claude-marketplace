import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

type Input = Record<string, unknown>;

/** The outcome of validating a hook's proposed replacement input. */
export type DecodedToolInput =
  | { readonly kind: "accepted"; readonly input: Record<string, unknown> }
  | { readonly kind: "ignored"; readonly category: "shape" | "field" | "value" };

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_TIMEOUT_SECONDS = 2_147_483.647;
const UNICODE_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g;

function record(input: unknown): input is Input {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function requestedPath(input: string, cwd: string, home: string): string {
  let normalized = input.replace(UNICODE_SPACES, " ");
  if (normalized.startsWith("@")) {
    normalized = normalized.slice(1);
  }

  if (normalized === "~") {
    normalized = home;
  } else if (normalized.startsWith("~/")) {
    normalized = path.join(home, normalized.slice(2));
  }

  if (normalized.startsWith("file://")) {
    normalized = fileURLToPath(normalized);
  }

  return path.resolve(cwd, normalized);
}

function toHookFileInput(tool: "read" | "write", input: Input, cwd: string, home: string): Input {
  if (typeof input.path !== "string") {
    return input;
  }

  const mapped: Input = { file_path: requestedPath(input.path, cwd, home) };
  if (tool === "read") {
    if (input.offset !== undefined) {
      mapped.offset = input.offset;
    }

    if (input.limit !== undefined) {
      mapped.limit = input.limit;
    }
  } else {
    mapped.content = input.content;
  }

  return mapped;
}

function toHookShellInput(input: Input): Input {
  const mapped: Input = { command: input.command };
  if (input.timeout !== undefined) {
    mapped.timeout = (input.timeout as number) * 1000;
  }

  return mapped;
}

/** Gives a built-in hook Claude's single-call input while leaving custom schemas alone. */
export function toHookToolInput(
  nativeToolName: string,
  input: unknown,
  cwd: string,
  home: string,
): unknown {
  if (!record(input)) {
    return input;
  }

  if (nativeToolName === "read" || nativeToolName === "write") {
    return toHookFileInput(nativeToolName, input, cwd, home);
  }

  if (nativeToolName === "bash" || nativeToolName === "powershell") {
    return toHookShellInput(input);
  }

  return input;
}

function accepted(input: Input): DecodedToolInput {
  return { kind: "accepted", input };
}

function validLine(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function decodeReadFields(candidate: Input, native: Input): DecodedToolInput {
  if (candidate.offset !== undefined && !validLine(candidate.offset)) {
    return { kind: "ignored", category: "value" };
  }

  if (candidate.limit !== undefined && !validLine(candidate.limit)) {
    return { kind: "ignored", category: "value" };
  }

  if (candidate.offset !== undefined) {
    native.offset = candidate.offset;
  }

  if (candidate.limit !== undefined) {
    native.limit = candidate.limit;
  }

  return accepted(native);
}

function decodeWriteFields(candidate: Input, native: Input): DecodedToolInput {
  if (typeof candidate.content !== "string") {
    return { kind: "ignored", category: "value" };
  }

  native.content = candidate.content;
  return accepted(native);
}

function decodeFileInput(
  tool: "read" | "write",
  candidate: Input,
  cwd: string,
  home: string,
): DecodedToolInput {
  const allowed =
    tool === "read"
      ? new Set(["file_path", "offset", "limit", "pages"])
      : new Set(["file_path", "content"]);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) {
    return { kind: "ignored", category: "field" };
  }

  if (typeof candidate.file_path !== "string" || candidate.file_path.length === 0) {
    return { kind: "ignored", category: "value" };
  }

  if (tool === "read" && candidate.pages !== undefined && candidate.pages !== "") {
    return { kind: "ignored", category: "field" };
  }

  const native: Input = { path: requestedPath(candidate.file_path, cwd, home) };
  return tool === "read"
    ? decodeReadFields(candidate, native)
    : decodeWriteFields(candidate, native);
}

function decodeShellInput(candidate: Input): DecodedToolInput {
  const allowed = new Set([
    "command",
    "timeout",
    "description",
    "run_in_background",
    "dangerouslyDisableSandbox",
  ]);
  if (Object.keys(candidate).some((key) => !allowed.has(key))) {
    return { kind: "ignored", category: "field" };
  }

  if (
    typeof candidate.command !== "string" ||
    (candidate.description !== undefined && typeof candidate.description !== "string") ||
    (candidate.run_in_background !== undefined && candidate.run_in_background !== false) ||
    (candidate.dangerouslyDisableSandbox !== undefined &&
      candidate.dangerouslyDisableSandbox !== false) ||
    (candidate.timeout !== undefined &&
      (typeof candidate.timeout !== "number" ||
        !Number.isFinite(candidate.timeout) ||
        candidate.timeout <= 0 ||
        candidate.timeout / 1000 === 0 ||
        candidate.timeout / 1000 > MAX_TIMEOUT_SECONDS))
  ) {
    return { kind: "ignored", category: "value" };
  }

  const native: Input = { command: candidate.command };
  if (candidate.timeout !== undefined) {
    native.timeout = candidate.timeout / 1000;
  }

  return accepted(native);
}

/** Validates a complete hook rewrite before any native input is replaced. */
export function decodeHookToolInput(
  nativeToolName: string,
  originalInput: Record<string, unknown>,
  candidate: unknown,
  cwd: string,
  home: string,
): DecodedToolInput {
  if (!record(candidate)) {
    return { kind: "ignored", category: "shape" };
  }

  if (Object.keys(candidate).some((key) => UNSAFE_KEYS.has(key))) {
    return { kind: "ignored", category: "field" };
  }

  if (isDeepStrictEqual(candidate, toHookToolInput(nativeToolName, originalInput, cwd, home))) {
    return accepted(originalInput);
  }

  if (nativeToolName === "read" || nativeToolName === "write") {
    return decodeFileInput(nativeToolName, candidate, cwd, home);
  }

  if (nativeToolName === "bash" || nativeToolName === "powershell") {
    return decodeShellInput(candidate);
  }

  return accepted(candidate);
}
