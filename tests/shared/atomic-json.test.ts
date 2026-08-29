import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { atomicWriteJson } from "../../extensions/pi-claude-marketplace/shared/atomic-json.ts";

test("writes two-space JSON with one trailing newline", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-shape-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "out.json");
  const expectedJsonBytes = '{\n  "ok": true,\n  "count": 7\n}\n';

  // act
  await atomicWriteJson(filePath, { ok: true, count: 7 });
  const jsonBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(jsonBytes, expectedJsonBytes);
});

test("creates a missing parent tree before writing the document", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-parent-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "new", "nested", "out.json");
  const expectedJsonBytes = '{\n  "message": "written"\n}\n';

  // act
  await atomicWriteJson(filePath, { message: "written" });
  const jsonBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(jsonBytes, expectedJsonBytes);
});

test("keeps every concurrent same-path observation as one complete document", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-concurrent-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "shared.json");
  const documents = [
    {
      content: { writer: "first", sequence: [1, 2] },
      expectedJsonBytes: '{\n  "writer": "first",\n  "sequence": [\n    1,\n    2\n  ]\n}\n',
    },
    {
      content: { writer: "second", enabled: true },
      expectedJsonBytes: '{\n  "writer": "second",\n  "enabled": true\n}\n',
    },
    {
      content: { writer: "third", nested: { status: "ready" } },
      expectedJsonBytes: '{\n  "writer": "third",\n  "nested": {\n    "status": "ready"\n  }\n}\n',
    },
  ] as const;
  const expectedDocuments = new Set(documents.map(({ expectedJsonBytes }) => expectedJsonBytes));

  // act
  const observedDocuments = await Promise.all(
    documents.map(async ({ content }) => {
      await atomicWriteJson(filePath, content);
      return readFile(filePath, "utf8");
    }),
  );

  // assert
  assert.deepStrictEqual(
    observedDocuments.map((jsonBytes) => expectedDocuments.has(jsonBytes)),
    [true, true, true],
  );
  assert.strictEqual(observedDocuments.length, documents.length);
});
