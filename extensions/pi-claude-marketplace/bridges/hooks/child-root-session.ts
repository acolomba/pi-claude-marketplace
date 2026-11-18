// bridges/hooks/child-root-session.ts
//
// D-PG6-02: the session that launched a pi-subagents child, one hop only, from the launch
// variable's id and the child header's `parentSession` file, whose first line is read once.

import { constants } from "node:fs";
import { open } from "node:fs/promises";
import path from "node:path";

/** The session that launched a child: its id and its session file, or `""` when it has none. */
export interface ChildRootSession {
  readonly sessionId: string;
  readonly transcriptPath: string;
}

// D-PG6-02: the bound of the read of another session's header line.
const HEADER_READ_BYTES = 65_536;

function headerIdOf(line: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }

  return typeof parsed === "object" &&
    parsed !== null &&
    "type" in parsed &&
    parsed.type === "session" &&
    "id" in parsed &&
    typeof parsed.id === "string"
    ? parsed.id
    : undefined;
}

// `O_NONBLOCK` keeps the open of a FIFO from waiting for a writer; the
// regular-file check then refuses it.
async function readSessionHeaderId(file: string): Promise<string | undefined> {
  if (!path.isAbsolute(file)) {
    return undefined;
  }

  try {
    const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
      if (!(await handle.stat()).isFile()) {
        return undefined;
      }

      const buffer = Buffer.alloc(HEADER_READ_BYTES);
      const { bytesRead } = await handle.read(buffer, 0, HEADER_READ_BYTES, 0);
      const text = buffer.toString("utf8", 0, bytesRead);
      const end = text.indexOf("\n");
      return end === -1 ? undefined : headerIdOf(text.slice(0, end));
    } finally {
      await handle.close();
    }
  } catch {
    return undefined;
  }
}

/**
 * D-PG6-02: the session that launched a child, from the launch variable's
 * `sessionId` and the child header's `sessionFile`, or `undefined` when no
 * source names one. `readHeaderId` reads the id in a session file's header
 * line, at most once. When it reads one, that id must equal the variable's.
 * The file's own `parentSession` is never followed, so a child of a child
 * names the child that launched it.
 */
export async function resolveChildRootSession(
  source: { readonly sessionId: string | undefined; readonly sessionFile: string | undefined },
  readHeaderId: (file: string) => Promise<string | undefined> = readSessionHeaderId,
): Promise<ChildRootSession | undefined> {
  const { sessionId, sessionFile } = source;
  if (sessionFile === undefined || sessionFile === "") {
    return sessionId === undefined ? undefined : { sessionId, transcriptPath: "" };
  }

  const headerId = await readHeaderId(sessionFile);
  if (headerId === undefined) {
    return sessionId === undefined ? undefined : { sessionId, transcriptPath: sessionFile };
  }

  return sessionId === undefined || sessionId === headerId
    ? { sessionId: headerId, transcriptPath: sessionFile }
    : undefined;
}
