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
 */

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
