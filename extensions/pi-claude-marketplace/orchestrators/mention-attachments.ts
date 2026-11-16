// orchestrators/mention-attachments.ts
//
// PG-SKILL-01: reads the files that a command or skill body mentions and
// appends them to the text the model receives. The caller passes the body as
// the author wrote it, with its variables filled and no argument substituted,
// so only the author's text can name a file (D-PG11-02).
//
// D-PG11-06: a mention is attached only when `stat`, which follows a symbolic
// link, reports a regular file of at most 262,144 bytes, and the bytes read
// hold no NUL byte. Anything else stays as text, with no notice and one debug
// line that names the path and the cause, never the content.
//
// D-PG11-07 / D-PG11-08: `MentionFileReader` is the only way this module
// reaches the filesystem, and each invocation orchestrator injects it. The
// module reads and never writes, so NFR-1 and NFR-10 do not apply. No
// containment rule applies either: the author of the body can already run `!`
// commands in the same invocation (D-CF1-02).

import { open, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  appendFileBlocks,
  findFileMentions,
  MENTION_FILE_BYTE_LIMIT,
  renderMentionBlock,
} from "../domain/file-mentions.ts";
import { hookDebugLog } from "../shared/debug-log.ts";
import { errorMessage } from "../shared/errors.ts";

import type { FileMention } from "../domain/file-mentions.ts";
import type { FileHandle } from "node:fs/promises";

/** D-PG11-08: the filesystem reads behind an attachment. */
export interface MentionFileReader {
  /** What `file` is, after following a symbolic link. */
  readonly stat: (file: string) => Promise<{ readonly isFile: boolean; readonly size: number }>;
  /** At most `maxBytes` bytes from the start of `file`. */
  readonly read: (file: string, maxBytes: number) => Promise<Uint8Array>;
  /** The home directory that `~` names. */
  readonly homeDir: () => string;
}

async function fillFrom(handle: FileHandle, buffer: Buffer, offset: number): Promise<number> {
  if (offset === buffer.length) {
    return offset;
  }

  const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset);
  return bytesRead === 0 ? offset : fillFrom(handle, buffer, offset + bytesRead);
}

async function readStart(file: string, maxBytes: number): Promise<Uint8Array> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    return buffer.subarray(0, await fillFrom(handle, buffer, 0));
  } finally {
    await handle.close();
  }
}

/** The reader of a running Pi. */
export const NODE_MENTION_FILE_READER: MentionFileReader = {
  stat: async (file) => {
    const status = await stat(file);
    return { isFile: status.isFile(), size: status.size };
  },
  read: readStart,
  homeDir: homedir,
};

/** D-PG11-04: `~` and a leading `~/` name the home directory; any other path is relative to `cwd`. */
function resolveMention(mentionPath: string, cwd: string, reader: MentionFileReader): string {
  if (mentionPath === "~") {
    return reader.homeDir();
  }

  return mentionPath.startsWith("~/")
    ? path.join(reader.homeDir(), mentionPath.slice(2))
    : path.resolve(cwd, mentionPath);
}

/** The block of a mentioned file, or why the file does not qualify. */
type MentionRead = { readonly block: string } | { readonly cause: string };

async function readMention(
  file: string,
  mention: FileMention,
  reader: MentionFileReader,
): Promise<MentionRead> {
  const status = await reader.stat(file);
  if (!status.isFile) {
    return { cause: "it is not a regular file" };
  }

  if (status.size > MENTION_FILE_BYTE_LIMIT) {
    return { cause: `it is larger than ${MENTION_FILE_BYTE_LIMIT} bytes` };
  }

  // One byte over the limit tells a file that grew after the `stat` from one that fits.
  const bytes = await reader.read(file, MENTION_FILE_BYTE_LIMIT + 1);
  const block = renderMentionBlock(file, bytes, mention);
  return block === undefined
    ? { cause: `it is larger than ${MENTION_FILE_BYTE_LIMIT} bytes or holds a NUL byte` }
    : { block };
}

/** The file block of one mention, or `undefined` with a debug line when the file does not qualify. */
async function mentionBlock(
  mention: FileMention,
  cwd: string,
  reader: MentionFileReader,
): Promise<string | undefined> {
  let file = mention.path;
  let read: MentionRead;
  try {
    file = resolveMention(mention.path, cwd, reader);
    read = await readMention(file, mention, reader);
  } catch (err) {
    read = { cause: errorMessage(err) };
  }

  if ("block" in read) {
    return read.block;
  }

  hookDebugLog(`a file mention skips ${file}: ${read.cause}`, "mentions");
  return undefined;
}

/**
 * PG-SKILL-01 / D-PG11-05: `input.rendered` with the file block of each file
 * that `input.authored` mentions, in mention order. The files are read in
 * parallel. A mention that does not qualify gives no block. Never rejects.
 */
export async function appendMentionedFiles(
  input: { readonly authored: string; readonly rendered: string; readonly cwd: string },
  reader: MentionFileReader,
): Promise<string> {
  const blocks = await Promise.all(
    findFileMentions(input.authored).map(async (mention) =>
      mentionBlock(mention, input.cwd, reader),
    ),
  );
  return appendFileBlocks(
    input.rendered,
    blocks.filter((block) => block !== undefined),
  );
}
