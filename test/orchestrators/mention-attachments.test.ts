import assert from "node:assert/strict";
import { mkdir, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

import {
  appendMentionedFiles,
  NODE_MENTION_FILE_READER,
} from "../../extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import type { MentionFileReader } from "../../extensions/pi-claude-marketplace/orchestrators/mention-attachments.ts";

const CWD = "/work";
const HOME = "/home/ada";
const LIMIT = 262_144;

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * A reader over in-memory files, all regular, that records each `stat` and
 * each `read` with the byte count asked; a path it does not hold rejects.
 */
function createMentionFiles(files: Readonly<Record<string, string>>): {
  readonly asked: string[];
  readonly reader: MentionFileReader;
} {
  const asked: string[] = [];
  return {
    asked,
    reader: {
      stat: (file) => {
        asked.push(`stat ${file}`);
        const content = files[file];
        return content === undefined
          ? Promise.reject(new Error(`no file ${file}`))
          : Promise.resolve({ isFile: true, size: bytesOf(content).length });
      },
      read: (file, maxBytes) => {
        asked.push(`read ${file} ${maxBytes}`);
        return Promise.resolve(bytesOf(files[file] ?? "").subarray(0, maxBytes));
      },
      homeDir: () => HOME,
    },
  };
}

/** The Node reader with each file it reads recorded in `reads`. */
function recordingNodeReader(reads: string[]): MentionFileReader {
  return {
    ...NODE_MENTION_FILE_READER,
    read: (file, maxBytes) => {
      reads.push(file);
      return NODE_MENTION_FILE_READER.read(file, maxBytes);
    },
  };
}

/** The message Node gives a `stat` of `file`. */
async function statError(file: string): Promise<string> {
  return stat(file).then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : ""),
  );
}

describe("appendMentionedFiles", () => {
  test("PG-SKILL-01 / D-PG11-05: appends the block of a mentioned file after one blank line", async () => {
    // arrange
    const files = createMentionFiles({ "/work/x.md": "Check.\n" });

    // act
    const text = await appendMentionedFiles(
      { authored: "Review @/work/x.md", rendered: "Review @/work/x.md now", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(
      text,
      'Review @/work/x.md now\n\n<file name="/work/x.md">\nCheck.\n\n</file>',
    );
  });

  test("D-PG11-02: scans only the authored text and asks nothing without a mention there", async () => {
    // arrange
    const files = createMentionFiles({ "/work/x.md": "Check." });

    // act
    const text = await appendMentionedFiles(
      { authored: "Review $ARGUMENTS", rendered: "Review @/work/x.md", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, "Review @/work/x.md");
    assert.deepStrictEqual(files.asked, []);
  });

  test("D-PG11-04: resolves a relative mention against the session directory", async () => {
    // arrange
    const files = createMentionFiles({ "/work/notes/a.md": "A." });

    // act
    const text = await appendMentionedFiles(
      { authored: "See @notes/a.md", rendered: "See @notes/a.md", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, 'See @notes/a.md\n\n<file name="/work/notes/a.md">\nA.\n</file>');
  });

  test("D-PG11-04: resolves a quoted ~ and a leading ~/ against the reader's home directory", async () => {
    // arrange
    const files = createMentionFiles({ "/home/ada/notes.md": "Notes." });

    // act
    const text = await appendMentionedFiles(
      { authored: 'See @~/notes.md and @"~"', rendered: "See them", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, 'See them\n\n<file name="/home/ada/notes.md">\nNotes.\n</file>');
    assert.deepStrictEqual(files.asked, [
      "stat /home/ada/notes.md",
      "stat /home/ada",
      "read /home/ada/notes.md 262145",
    ]);
  });

  test("D-PG11-04: does not expand ~ before another user's name", async () => {
    // arrange
    const files = createMentionFiles({});

    // act
    const text = await appendMentionedFiles(
      { authored: "See @~other/x", rendered: "See @~other/x", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, "See @~other/x");
    assert.deepStrictEqual(files.asked, ["stat /work/~other/x"]);
  });

  test("D-PG11-04: attaches only the lines that a line range selects", async () => {
    // arrange
    const files = createMentionFiles({ "/work/x.md": "one\ntwo\nthree\n" });

    // act
    const text = await appendMentionedFiles(
      { authored: "See @x.md#L2-3", rendered: "See it", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, 'See it\n\n<file name="/work/x.md">\ntwo\nthree\n</file>');
  });

  test("D-PG11-05: keeps mention order when the second read resolves first", async () => {
    // arrange
    let resolveFirst: (bytes: Uint8Array) => void = () => undefined;
    const firstRead = new Promise<Uint8Array>((resolve) => {
      resolveFirst = resolve;
    });
    const reader: MentionFileReader = {
      stat: () => Promise.resolve({ isFile: true, size: 1 }),
      read: (file) =>
        file === "/work/a.md"
          ? firstRead
          : Promise.resolve(bytesOf("B")).finally(() => {
              resolveFirst(bytesOf("A"));
            }),
      homeDir: () => HOME,
    };

    // act
    const text = await appendMentionedFiles(
      { authored: "@a.md @b.md", rendered: "Both", cwd: CWD },
      reader,
    );

    // assert
    assert.strictEqual(
      text,
      'Both\n\n<file name="/work/a.md">\nA\n</file>\n<file name="/work/b.md">\nB\n</file>',
    );
  });

  test("D-PG11-06: skips a missing file with a debug line and keeps the other block", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const files = createMentionFiles({ "/work/ok.md": "Ok." });

    // act
    const text = await appendMentionedFiles(
      { authored: "@missing.md @ok.md", rendered: "Both", cwd: CWD },
      files.reader,
    );

    // assert
    assert.strictEqual(text, 'Both\n\n<file name="/work/ok.md">\nOk.\n</file>');
    assert.deepStrictEqual(logged, [
      "[mentions] a file mention skips /work/missing.md: no file /work/missing.md",
    ]);
  });

  test("D-PG11-06: skips a read that rejects with a debug line and keeps the other block", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const files = createMentionFiles({ "/work/locked.md": "Secret.", "/work/ok.md": "Ok." });
    const reader: MentionFileReader = {
      ...files.reader,
      read: (file, maxBytes) =>
        file === "/work/locked.md"
          ? Promise.reject(new Error("EACCES: permission denied"))
          : files.reader.read(file, maxBytes),
    };

    // act
    const text = await appendMentionedFiles(
      { authored: "@locked.md @ok.md", rendered: "Both", cwd: CWD },
      reader,
    );

    // assert
    assert.strictEqual(text, 'Both\n\n<file name="/work/ok.md">\nOk.\n</file>');
    assert.deepStrictEqual(logged, [
      "[mentions] a file mention skips /work/locked.md: EACCES: permission denied",
    ]);
  });

  test("D-PG11-06: skips a file that grew past the limit after its stat, reading one byte over it", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const files = createMentionFiles({ "/work/big.md": "a".repeat(LIMIT + 10) });
    const reader: MentionFileReader = {
      ...files.reader,
      stat: async (file) => {
        await files.reader.stat(file);
        return { isFile: true, size: 10 };
      },
    };

    // act
    const text = await appendMentionedFiles(
      { authored: "@big.md", rendered: "Big", cwd: CWD },
      reader,
    );

    // assert
    assert.strictEqual(text, "Big");
    assert.deepStrictEqual(files.asked, ["stat /work/big.md", "read /work/big.md 262145"]);
    assert.deepStrictEqual(logged, [
      "[mentions] a file mention skips /work/big.md: it is larger than 262144 bytes or holds a NUL byte",
    ]);
  });

  test("D-PG11-06: skips a directory with a debug line and keeps the other block", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await mkdir(path.join(cwd, "dir"));
    await writeFile(path.join(cwd, "ok.md"), "Ok.");
    const logged = captureDebugLog(t);

    // act
    const text = await appendMentionedFiles(
      { authored: "@dir @ok.md", rendered: "Both", cwd },
      NODE_MENTION_FILE_READER,
    );

    // assert
    assert.strictEqual(text, `Both\n\n<file name="${cwd}/ok.md">\nOk.\n</file>`);
    assert.deepStrictEqual(logged, [
      `[mentions] a file mention skips ${cwd}/dir: it is not a regular file`,
    ]);
  });

  test("D-PG11-06: skips a file over 262,144 bytes without reading it", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "big.md"), "a".repeat(LIMIT + 1));
    await writeFile(path.join(cwd, "ok.md"), "Ok.");
    const reads: string[] = [];
    const logged = captureDebugLog(t);

    // act
    const text = await appendMentionedFiles(
      { authored: "@big.md @ok.md", rendered: "Both", cwd },
      recordingNodeReader(reads),
    );

    // assert
    assert.strictEqual(text, `Both\n\n<file name="${cwd}/ok.md">\nOk.\n</file>`);
    assert.deepStrictEqual(reads, [`${cwd}/ok.md`]);
    assert.deepStrictEqual(logged, [
      `[mentions] a file mention skips ${cwd}/big.md: it is larger than 262144 bytes`,
    ]);
  });

  test("D-PG11-06: skips a file with a NUL byte and logs no content", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "bin.dat"), "secret\u0000bytes");
    await writeFile(path.join(cwd, "ok.md"), "Ok.");
    const logged = captureDebugLog(t);

    // act
    const text = await appendMentionedFiles(
      { authored: "@bin.dat @ok.md", rendered: "Both", cwd },
      NODE_MENTION_FILE_READER,
    );

    // assert
    assert.strictEqual(text, `Both\n\n<file name="${cwd}/ok.md">\nOk.\n</file>`);
    assert.deepStrictEqual(logged, [
      `[mentions] a file mention skips ${cwd}/bin.dat: it is larger than 262144 bytes or holds a NUL byte`,
    ]);
  });

  test("D-PG11-06: attaches the target of a symbolic link under the mention's own path", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "target.md"), "Target.");
    await symlink(path.join(cwd, "target.md"), path.join(cwd, "link.md"));

    // act
    const text = await appendMentionedFiles(
      { authored: "@link.md", rendered: "Linked", cwd },
      NODE_MENTION_FILE_READER,
    );

    // assert
    assert.strictEqual(text, `Linked\n\n<file name="${cwd}/link.md">\nTarget.\n</file>`);
  });

  test("D-PG11-06: skips a symbolic link to a directory", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await mkdir(path.join(cwd, "dir"));
    await symlink(path.join(cwd, "dir"), path.join(cwd, "link"));
    const logged = captureDebugLog(t);

    // act
    const text = await appendMentionedFiles(
      { authored: "@link", rendered: "Linked", cwd },
      NODE_MENTION_FILE_READER,
    );

    // assert
    assert.strictEqual(text, "Linked");
    assert.deepStrictEqual(logged, [
      `[mentions] a file mention skips ${cwd}/link: it is not a regular file`,
    ]);
  });

  test("D-PG11-06: skips a dangling symbolic link with the error of its stat", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    const link = path.join(cwd, "link.md");
    await symlink(path.join(cwd, "gone.md"), link);
    const cause = await statError(link);
    const logged = captureDebugLog(t);

    // act
    const text = await appendMentionedFiles(
      { authored: "@link.md", rendered: "Linked", cwd },
      NODE_MENTION_FILE_READER,
    );

    // assert
    assert.strictEqual(text, "Linked");
    assert.deepStrictEqual(logged, [`[mentions] a file mention skips ${link}: ${cause}`]);
  });
});

describe("NODE_MENTION_FILE_READER", () => {
  test("reports a regular file with its size and a directory as not a file", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "x.md"), "abc");

    // act
    const file = await NODE_MENTION_FILE_READER.stat(path.join(cwd, "x.md"));
    const directory = await NODE_MENTION_FILE_READER.stat(cwd);

    // assert
    assert.deepStrictEqual(file, { isFile: true, size: 3 });
    assert.strictEqual(directory.isFile, false);
  });

  test("reads at most the asked bytes from the start of a longer file", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "x.md"), "abcdef");

    // act
    const bytes = await NODE_MENTION_FILE_READER.read(path.join(cwd, "x.md"), 4);

    // assert
    assert.deepStrictEqual(Buffer.from(bytes), Buffer.from("abcd"));
  });

  test("reads the whole of a file shorter than the asked bytes", async (t) => {
    // arrange
    const { cwd } = await createHermeticEnvironment(t, "mention-attachments-");
    await writeFile(path.join(cwd, "x.md"), "ab");

    // act
    const bytes = await NODE_MENTION_FILE_READER.read(path.join(cwd, "x.md"), 4);

    // assert
    assert.deepStrictEqual(Buffer.from(bytes), Buffer.from("ab"));
  });

  test("names the home directory of the process", async (t) => {
    // arrange
    const { home } = await createHermeticEnvironment(t, "mention-attachments-");

    // act
    const homeDir = NODE_MENTION_FILE_READER.homeDir();

    // assert
    assert.strictEqual(homeDir, home);
  });
});
