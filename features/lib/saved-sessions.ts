/**
 * @fileoverview The saved sessions of a sandbox's Pi: the folder where Pi
 * keeps them, and the `{session file}` token that stands for the file of one
 * session in the hooks runs step (D-PG6-12, D-PG6-16).
 *
 * Pi keeps the sessions of a working directory in
 * `<agent dir>/sessions/--<cwd>--/`, where `<cwd>` is the directory without
 * its leading slash and with each `/`, `\`, and `:` replaced by `-`. It names
 * a session file `<header timestamp>_<session id>.jsonl`, with each `:` and
 * `.` of the timestamp replaced by `-`. Pi 1.5.0 and 1.5.2 both do so.
 * Pi writes the file once the session holds a prompt and a reply, and
 * `--continue` opens the file of that folder with the newest modification
 * time, whatever its name says. Each line of the file is one session entry,
 * and a user message's entry has `type` `message` and the message.
 */

import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { RunTokens } from "./run-tokens.ts";

// The token that stands for the saved session file of a run's own session.
const SESSION_FILE_TOKEN = "{session file}";

// The header timestamp as Pi writes it in a session file's name.
const FILE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/u;

/** The folder where the sandbox's Pi keeps the saved sessions of its project. */
export function sessionsFolder(tokens: Pick<RunTokens, "agentDir" | "projectDir">): string {
  const cwd = tokens.projectDir.replace(/^[/\\]/u, "").replaceAll(/[/\\:]/gu, "-");
  return path.join(tokens.agentDir, "sessions", `--${cwd}--`);
}

/**
 * Returns `{session file}` when `value` is the path of the saved session file
 * of `sessionId` in the sandbox's sessions folder, and `value` unchanged
 * otherwise.
 */
export function projectSessionFile(
  value: unknown,
  sessionId: unknown,
  tokens: Pick<RunTokens, "agentDir" | "projectDir">,
): unknown {
  if (typeof value !== "string" || typeof sessionId !== "string") {
    return value;
  }

  const suffix = `_${sessionId}.jsonl`;
  const name = path.basename(value);
  const named =
    path.dirname(value) === sessionsFolder(tokens) &&
    name.endsWith(suffix) &&
    FILE_TIMESTAMP.test(name.slice(0, -suffix.length));
  return named ? SESSION_FILE_TOKEN : value;
}

// The session files of `folder`.
async function sessionFiles(folder: string): Promise<readonly string[]> {
  return (await readdir(folder))
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => path.join(folder, name));
}

/**
 * Returns the session file of `folder` with the newest modification time, the
 * one `--continue` opens. Fails when the folder holds no session file.
 */
export async function latestSessionFile(folder: string): Promise<string> {
  const files = await sessionFiles(folder);
  const modified = await Promise.all(
    files.map(async (file) => ({ file, mtimeMs: (await stat(file)).mtimeMs })),
  );
  const [latest] = modified.sort((left, right) => right.mtimeMs - left.mtimeMs);
  assert.ok(latest !== undefined, `the sessions folder ${folder} holds no saved session`);
  return latest.file;
}

// The text of each user message of a saved session file, whose lines are
// Pi's session entries.
function userPromptsOf(text: string): readonly string[] {
  return text
    .split("\n")
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const entry = JSON.parse(line) as {
        readonly type?: unknown;
        readonly message?: { readonly role?: unknown; readonly content?: unknown };
      };
      return entry.type === "message" && entry.message?.role === "user"
        ? textsOf(entry.message.content)
        : [];
    });
}

// The texts of a message's content: the string itself, or its text parts.
function textsOf(content: unknown): readonly string[] {
  if (typeof content === "string") {
    return [content];
  }

  const parts = Array.isArray(content) ? (content as readonly unknown[]) : [];
  return parts.flatMap((part) =>
    typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
      ? [part.text]
      : [],
  );
}

/**
 * Returns the one session file of `folder` whose user messages hold
 * `prompt`. Fails when no file or more than one holds it.
 */
export async function sessionFileWithPrompt(folder: string, prompt: string): Promise<string> {
  const files = await sessionFiles(folder);
  const texts = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const holding = files.filter((_file, index) =>
    userPromptsOf(texts[index] ?? "").includes(prompt),
  );
  assert.strictEqual(
    holding.length,
    1,
    `saved sessions holding "${prompt}": ${holding.join(", ")}`,
  );
  return holding[0] ?? "";
}
