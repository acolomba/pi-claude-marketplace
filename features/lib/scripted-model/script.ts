/**
 * @fileoverview The files the scripted model shares with the steps: the
 * script a scenario arms, and the call log the model appends to (D-CF1-17).
 *
 * Both live in the harness directory of the sandbox home, so a Pi of a child
 * agent, which shares that home, reads the same script and the same log, and
 * the `Before()` that empties the sandbox resets them. The script is one JSON
 * array of steps. The call log holds one JSON line per model call; its line
 * count is the index of the next step, so the model keeps no count in memory.
 * A call past the end of the script is logged with `overflow: true`.
 *
 * A step is a reply, a tool call, or an error that ends the call with stop
 * reason `error` and the message the scenario chooses. A reply may end with
 * stop reason `length` instead of `stop` (D-BG-06), and may report the
 * context tokens of its own call, so Pi starts its own compaction (D-BG-07).
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Type } from "typebox";
import { Compile } from "typebox/compile";

import { projectToolResult, projectUserText } from "../upstream/index.ts";

/**
 * One step of a model script: a reply text, which may end with stop reason
 * `length` and may report the context tokens of its call; one tool call; or
 * an error message that ends the call with stop reason `error` (D-BG-06,
 * D-BG-07).
 */
export type ScriptStep =
  | {
      readonly reply: string;
      readonly stopReason?: "length";
      readonly contextTokens?: number;
    }
  | { readonly tool: string; readonly arguments: Readonly<Record<string, unknown>> }
  | { readonly error: string };

const SCRIPT_FILE = "model-script.json";
const CALLS_FILE = "model-calls.jsonl";

const SCRIPT_VALIDATOR = Compile(
  Type.Array(
    Type.Union([
      Type.Object(
        {
          reply: Type.String(),
          stopReason: Type.Optional(Type.Literal("length")),
          contextTokens: Type.Optional(Type.Integer({ minimum: 1 })),
        },
        { additionalProperties: false },
      ),
      Type.Object(
        { tool: Type.String(), arguments: Type.Record(Type.String(), Type.Unknown()) },
        { additionalProperties: false },
      ),
      Type.Object({ error: Type.String() }, { additionalProperties: false }),
    ]),
  ),
);

const CALL_SCHEMA = Type.Object({
  index: Type.Integer(),
  overflow: Type.Boolean(),
  systemPrompt: Type.String(),
  tools: Type.Array(
    Type.Object({ name: Type.String(), description: Type.String(), parameters: Type.Unknown() }),
  ),
  messages: Type.Array(Type.Unknown()),
});

const CALL_VALIDATOR = Compile(CALL_SCHEMA);

/** One model call as the scripted model logged it, whole. */
export type ModelCall = Type.Static<typeof CALL_SCHEMA>;

const SCRIPT_COLUMNS: ReadonlySet<string> = new Set([
  "reply",
  "tool",
  "arguments",
  "error",
  "stop reason",
  "context tokens",
]);

// The columns that each name a kind of step; a row sets exactly one.
const STEP_KINDS = ["reply", "tool", "error"] as const;

// The columns that only a reply row may set.
const REPLY_ONLY_COLUMNS: readonly string[] = ["stop reason", "context tokens"];

type Cell = (column: string) => string;

// The path of the script file in the harness directory `harness`.
function modelScriptPath(harness: string): string {
  return path.join(harness, SCRIPT_FILE);
}

/** Returns the path of the call log in the harness directory `harness`. */
export function modelCallsPath(harness: string): string {
  return path.join(harness, CALLS_FILE);
}

function checkScriptHeader(header: readonly string[]): void {
  const unknown = header.filter((column) => !SCRIPT_COLUMNS.has(column));
  if (unknown.length > 0) {
    throw new Error(`unknown model script column: ${unknown.join(", ")}`);
  }

  if (!header.includes("reply")) {
    throw new Error("the model script has no reply column");
  }

  if (header.includes("tool") !== header.includes("arguments")) {
    throw new Error("the model script needs the tool and arguments columns together");
  }
}

function parseArguments(text: string, row: number): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`model script row ${row}: the arguments are not a JSON object`);
  }

  // The checks above prove a plain JSON object.
  return parsed as Readonly<Record<string, unknown>>;
}

function replyStopReason(text: string, row: number): { stopReason?: "length" } {
  if (text === "") {
    return {};
  }

  if (text !== "length") {
    throw new Error(`model script row ${row}: the stop reason ${text} is not length`);
  }

  return { stopReason: text };
}

function replyContextTokens(text: string, row: number): { contextTokens?: number } {
  if (text === "") {
    return {};
  }

  const tokens = Number(text);
  if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(tokens)) {
    throw new Error(
      `model script row ${row}: the context tokens ${text} are not a positive integer`,
    );
  }

  return { contextTokens: tokens };
}

function replyStep(cell: Cell, row: number): ScriptStep {
  return {
    reply: cell("reply"),
    ...replyStopReason(cell("stop reason"), row),
    ...replyContextTokens(cell("context tokens"), row),
  };
}

function toolStep(cell: Cell, row: number): ScriptStep {
  const argumentsText = cell("arguments");
  if (argumentsText === "") {
    throw new Error(`model script row ${row} needs arguments for its tool`);
  }

  return { tool: cell("tool"), arguments: parseArguments(argumentsText, row) };
}

// Refuses a column set on a row of a kind that does not take it.
function checkRowColumns(cell: Cell, kind: (typeof STEP_KINDS)[number], row: number): void {
  if (kind !== "tool" && cell("arguments") !== "") {
    throw new Error(`model script row ${row} has arguments but no tool`);
  }

  const misplaced =
    kind === "reply" ? [] : REPLY_ONLY_COLUMNS.filter((column) => cell(column) !== "");
  if (misplaced.length > 0) {
    throw new Error(
      `model script row ${row} sets ${misplaced.join(", ")}, which only a reply takes`,
    );
  }
}

function parseScriptRow(
  header: readonly string[],
  cells: readonly string[],
  row: number,
): ScriptStep {
  if (cells.length !== header.length) {
    throw new Error(`model script row ${row} has ${cells.length} cells, not ${header.length}`);
  }

  const cell: Cell = (column) => cells[header.indexOf(column)] ?? "";
  const kinds = STEP_KINDS.filter((kind) => cell(kind) !== "");
  const [kind] = kinds;
  if (kind === undefined || kinds.length > 1) {
    throw new Error(`model script row ${row} needs exactly one of a reply, a tool, or an error`);
  }

  checkRowColumns(cell, kind, row);
  switch (kind) {
    case "reply":
      return replyStep(cell, row);
    case "tool":
      return toolStep(cell, row);
    case "error":
      return { error: cell("error") };
  }
}

/**
 * Reads a model script from the raw rows of a table, header first. Each row
 * is a reply, a tool call with its arguments as a JSON object, or an error.
 * Throws on a missing or unknown column, on a row that sets none or more than
 * one of them, and on a column set on a row of a kind that does not take it.
 */
export function parseScriptTable(rows: readonly (readonly string[])[]): ScriptStep[] {
  const [header, ...body] = rows;
  if (header === undefined) {
    throw new Error("the model script table has no header");
  }

  checkScriptHeader(header);
  return body.map((cells, index) => parseScriptRow(header, cells, index + 1));
}

/** Writes `steps` as the script in the harness directory `harness`. */
export async function writeModelScript(
  harness: string,
  steps: readonly ScriptStep[],
): Promise<void> {
  await writeFile(modelScriptPath(harness), `${JSON.stringify(steps, null, 2)}\n`);
}

async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

/**
 * Returns the script in the harness directory `harness`, or no steps when no
 * script is armed. Throws when the file is not a valid script.
 */
export async function readModelScript(harness: string): Promise<ScriptStep[]> {
  const text = await readOptional(modelScriptPath(harness));
  if (text === undefined) {
    return [];
  }

  const parsed: unknown = JSON.parse(text);
  if (!SCRIPT_VALIDATOR.Check(parsed)) {
    throw new Error(`invalid model script: ${JSON.stringify(SCRIPT_VALIDATOR.Errors(parsed))}`);
  }

  return parsed;
}

function checkCall(record: unknown): ModelCall {
  if (!CALL_VALIDATOR.Check(record)) {
    throw new Error(`invalid model call record: ${JSON.stringify(CALL_VALIDATOR.Errors(record))}`);
  }

  return record;
}

/**
 * Returns every call in the call log of the harness directory `harness`, in
 * call order, or none when the model has not been called. Throws on a line
 * that is not a valid call record.
 */
export async function readModelCalls(harness: string): Promise<ModelCall[]> {
  const text = await readOptional(modelCallsPath(harness));
  const lines = (text ?? "").split("\n").filter((line) => line !== "");
  return lines.map((line): ModelCall => checkCall(JSON.parse(line)));
}

/**
 * Returns the model calls among the log lines a turn kept, by log file name,
 * in call order. Throws on a line that is not a valid call record.
 */
export function modelCallsOf(logs: ReadonlyMap<string, readonly unknown[]>): ModelCall[] {
  return (logs.get(CALLS_FILE) ?? []).map((record) => checkCall(record));
}

/**
 * The call of `logs` numbered `number` from 1, as the calls step numbers
 * them. Throws when the turn has no such call.
 */
export function numberedModelCall(
  logs: ReadonlyMap<string, readonly unknown[]>,
  number: number,
): ModelCall {
  const call = modelCallsOf(logs).find(({ index }) => index + 1 === number);
  if (call === undefined) {
    throw new Error(`the last turn has no model call ${number}`);
  }

  return call;
}

// The parts of a logged message that the call rows read.
const MESSAGE_PART_SCHEMA = Type.Object({
  type: Type.String(),
  text: Type.Optional(Type.String()),
  thinking: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  arguments: Type.Optional(Type.Unknown()),
});

const MESSAGE_VALIDATOR = Compile(
  Type.Object({
    role: Type.String(),
    content: Type.Union([Type.String(), Type.Array(MESSAGE_PART_SCHEMA)]),
    toolName: Type.Optional(Type.String()),
    isError: Type.Optional(Type.Boolean()),
  }),
);

type MessagePart = Type.Static<typeof MESSAGE_PART_SCHEMA>;

// One line per part: text as it is, and a tool call, a thought, or an image
// in a short readable form.
function partText(part: MessagePart): string {
  switch (part.type) {
    case "text":
      return part.text ?? "";
    case "toolCall":
      return `tool call ${part.name ?? ""} ${JSON.stringify(part.arguments)}`;
    case "thinking":
      return `thinking ${part.thinking ?? ""}`;
    default:
      return part.type;
  }
}

function messageRow(message: unknown): [string, string] {
  if (!MESSAGE_VALIDATOR.Check(message)) {
    throw new Error(`invalid model message: ${JSON.stringify(MESSAGE_VALIDATOR.Errors(message))}`);
  }

  const text =
    typeof message.content === "string"
      ? message.content
      : message.content.map((part) => partText(part)).join("\n");
  if (message.role === "toolResult") {
    const failed = message.isError === true;
    const tool = message.toolName ?? "";
    return [
      "tool result",
      `${tool} ${failed ? "failed" : "returned"}: ${projectToolResult(tool, failed, text)}`,
    ];
  }

  return [message.role, message.role === "user" ? projectUserText(text) : text];
}

/**
 * Returns one `[call, role, text]` row for every message but the system
 * messages of every call in `calls`, in call order and message order. The
 * call is numbered from 1. A tool call and a tool result read as one line.
 */
export function callMessageRows(calls: readonly ModelCall[]): [string, string, string][] {
  return calls.flatMap((call) =>
    call.messages
      .filter((message) => !MESSAGE_VALIDATOR.Check(message) || message.role !== "system")
      .map((message): [string, string, string] => [String(call.index + 1), ...messageRow(message)]),
  );
}
