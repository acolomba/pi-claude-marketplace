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
  const expectedDocuments = new Set<string>(
    documents.map(({ expectedJsonBytes }) => expectedJsonBytes),
  );

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

test("writes an empty object at a root-level target", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-empty-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "empty.json");
  const expectedJsonBytes = "{}\n";

  // act
  await atomicWriteJson(filePath, {});
  const jsonBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(jsonBytes, expectedJsonBytes);
});

test("preserves string-key insertion order in the emitted document", async (t) => {
  // arrange
  const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-order-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "ordered.json");
  const expectedJsonBytes = '{\n  "zebra": 3,\n  "alpha": 1,\n  "middle": 2\n}\n';

  // act
  await atomicWriteJson(filePath, { zebra: 3, alpha: 1, middle: 2 });
  const jsonBytes = await readFile(filePath, "utf8");

  // assert
  assert.strictEqual(jsonBytes, expectedJsonBytes);
});

for (const { name, content, expectedJsonBytes } of [
  {
    name: "writes negative zero as JSON zero",
    content: { negativeZero: -0 },
    expectedJsonBytes: '{\n  "negativeZero": 0\n}\n',
  },
  {
    name: "preserves a finite fractional JSON number",
    content: { fraction: 0.125 },
    expectedJsonBytes: '{\n  "fraction": 0.125\n}\n',
  },
  {
    name: "writes non-finite JSON numbers as null",
    content: { notANumber: Number.NaN, positiveInfinity: Infinity, negativeInfinity: -Infinity },
    expectedJsonBytes:
      '{\n  "notANumber": null,\n  "positiveInfinity": null,\n  "negativeInfinity": null\n}\n',
  },
] as const) {
  test(name, async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(os.tmpdir(), "atomic-json-number-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, "number.json");

    // act
    await atomicWriteJson(filePath, content);
    const jsonBytes = await readFile(filePath, "utf8");

    // assert
    assert.strictEqual(jsonBytes, expectedJsonBytes);
  });
}
