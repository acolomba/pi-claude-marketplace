import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import { resolveChildRootSession } from "../../../extensions/pi-claude-marketplace/bridges/hooks/child-root-session.ts";

const SESSION_HEADER = '{"type":"session","version":3,"id":"session-1","cwd":"/project"}';

async function caseDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "child-root-session-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

// A session file holding `text` in the case's directory.
async function sessionFile(t: TestContext, text: string): Promise<string> {
  const file = path.join(await caseDirectory(t), "session.jsonl");
  await writeFile(file, text);
  return file;
}

// The session file of a child that launched a nested child: its header names
// the file of the session that launched it in turn.
async function nestedLauncherFile(t: TestContext): Promise<string> {
  const directory = await caseDirectory(t);
  const grandparent = path.join(directory, "root.jsonl");
  const launcher = path.join(directory, "launcher.jsonl");
  await writeFile(grandparent, '{"type":"session","id":"root-session"}\n');
  await writeFile(
    launcher,
    `${JSON.stringify({ type: "session", id: "launcher-session", parentSession: grandparent })}\n`,
  );
  return launcher;
}

function readerReturning(headerId: string | undefined): {
  readonly read: (file: string) => Promise<string | undefined>;
  readonly files: string[];
} {
  const files: string[] = [];
  return {
    read: (file) => {
      files.push(file);
      return Promise.resolve(headerId);
    },
    files,
  };
}

test("D-PG6-02: a readable launching session file whose header id equals the variable is the root", async (t) => {
  // arrange
  const file = await sessionFile(t, `${SESSION_HEADER}\n{"type":"message"}\n`);

  // act
  const root = await resolveChildRootSession({ sessionId: "session-1", sessionFile: file });

  // assert
  assert.deepStrictEqual(root, { sessionId: "session-1", transcriptPath: file });
});

test("D-PG6-02: a header id that differs from the variable gives no root", async (t) => {
  // arrange
  const file = await sessionFile(t, `${SESSION_HEADER}\n`);

  // act
  const root = await resolveChildRootSession({ sessionId: "session-2", sessionFile: file });

  // assert
  assert.strictEqual(root, undefined);
});

test("D-PG6-02: a header with no variable is the root by the header's id", async (t) => {
  // arrange
  const file = await sessionFile(t, `${SESSION_HEADER}\n`);

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: file });

  // assert
  assert.deepStrictEqual(root, { sessionId: "session-1", transcriptPath: file });
});

for (const { label, sessionFile: file } of [
  { label: "no launching session file", sessionFile: undefined },
  { label: "an empty launching session file", sessionFile: "" },
]) {
  test(`D-PG6-02: the variable with ${label} is the root with an empty transcript path`, async () => {
    // arrange
    const reader = readerReturning("session-1");

    // act
    const root = await resolveChildRootSession(
      { sessionId: "session-1", sessionFile: file },
      reader.read,
    );

    // assert
    assert.deepStrictEqual(root, { sessionId: "session-1", transcriptPath: "" });
    assert.deepStrictEqual(reader.files, []);
  });
}

test("D-PG6-02: the variable with a launching session file that cannot be read keeps that file", async (t) => {
  // arrange
  const file = path.join(await caseDirectory(t), "missing.jsonl");

  // act
  const root = await resolveChildRootSession({ sessionId: "session-1", sessionFile: file });

  // assert
  assert.deepStrictEqual(root, { sessionId: "session-1", transcriptPath: file });
});

test("D-PG6-02: neither source gives no root", async () => {
  // arrange
  const reader = readerReturning("session-1");

  // act
  const root = await resolveChildRootSession(
    { sessionId: undefined, sessionFile: undefined },
    reader.read,
  );

  // assert
  assert.strictEqual(root, undefined);
  assert.deepStrictEqual(reader.files, []);
});

test("D-PG6-02: a launching session file that cannot be read and no variable give no root", async (t) => {
  // arrange
  const file = path.join(await caseDirectory(t), "missing.jsonl");

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: file });

  // assert
  assert.strictEqual(root, undefined);
});

test("D-PG6-02: a nested child reads only its launching session's file", async (t) => {
  // arrange
  const launcher = await nestedLauncherFile(t);
  const reader = readerReturning("launcher-session");

  // act
  const root = await resolveChildRootSession(
    { sessionId: "launcher-session", sessionFile: launcher },
    reader.read,
  );

  // assert
  assert.deepStrictEqual(root, { sessionId: "launcher-session", transcriptPath: launcher });
  assert.deepStrictEqual(reader.files, [launcher]);
});

test("D-PG6-02: the default reader follows no parentSession of the launching session's header", async (t) => {
  // arrange
  const launcher = await nestedLauncherFile(t);

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: launcher });

  // assert
  assert.deepStrictEqual(root, { sessionId: "launcher-session", transcriptPath: launcher });
});

for (const { label, text } of [
  { label: "a first line that is not JSON", text: "not json\n" },
  { label: "a JSON value that is not an object", text: "42\n" },
  { label: "a JSON null", text: "null\n" },
  { label: "a JSON object that is not a session header", text: '{"type":"message","id":"m"}\n' },
  { label: "an object with no type", text: '{"id":"session-1"}\n' },
  { label: "a session header with no id", text: '{"type":"session"}\n' },
  { label: "a session header whose id is not a string", text: '{"type":"session","id":7}\n' },
  { label: "a header line with no line end", text: SESSION_HEADER },
  { label: "an empty file", text: "" },
]) {
  test(`D-PG6-02: the default reader reads no id from ${label}`, async (t) => {
    // arrange
    const file = await sessionFile(t, text);

    // act
    const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: file });

    // assert
    assert.strictEqual(root, undefined);
  });
}

test("D-PG6-02: the default reader reads no id from a first line past 65,536 bytes", async (t) => {
  // arrange
  const longHeader = `{"type":"session","id":"session-1","pad":"${"x".repeat(70_000)}"}\n`;
  const file = await sessionFile(t, longHeader);

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: file });

  // assert
  assert.strictEqual(root, undefined);
});

test("D-PG6-02: the default reader reads no id from a directory", async (t) => {
  // arrange
  const directory = path.join(await caseDirectory(t), "session.jsonl");
  await mkdir(directory);

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: directory });

  // assert
  assert.strictEqual(root, undefined);
});

test("D-PG6-02: the default reader reads no id from a relative path", async (t) => {
  // arrange
  const file = await sessionFile(t, `${SESSION_HEADER}\n`);
  const relative = path.relative(process.cwd(), file);

  // act
  const root = await resolveChildRootSession({ sessionId: undefined, sessionFile: relative });

  // assert
  assert.strictEqual(root, undefined);
});
