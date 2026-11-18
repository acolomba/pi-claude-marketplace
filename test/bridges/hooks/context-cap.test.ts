import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { capHookContext } from "../../../extensions/pi-claude-marketplace/bridges/hooks/context-cap.ts";

const SAVED_PATH = "/data/hook-1-additionalContext.txt";
// The em dash (U+2014) of the write-failure line, escaped because the
// fix-unicode-dashes hook rewrites a literal one.
const EM_DASH = "\u2014";
const FAILURE_HEAD = `\n\n[Hook additionalContext truncated at 10000 chars ${EM_DASH} persist-to-disk failed: `;
const GRINNING_FACE = "\u{1F600}";

// A writer that records each text it saves and resolves to `filePath`.
function createWriter(filePath: string): {
  readonly saved: string[];
  readonly write: (text: string) => Promise<string>;
} {
  const saved: string[] = [];
  return {
    saved,
    write: (text) => {
      saved.push(text);
      return Promise.resolve(filePath);
    },
  };
}

// The wrapper Claude Code 2.1.323 sends in place of a saved string.
function wrapper(size: string, filePath: string, preview: string): string {
  return (
    "<persisted-output>\n" +
    `Output too large (${size}). Full output saved to: ${filePath}\n\n` +
    `Preview (first 2KB):\n${preview}\n...\n</persisted-output>`
  );
}

describe("capHookContext under the limit", () => {
  for (const { name, text } of [
    { name: "a string of exactly 10,000 units", text: "x".repeat(10_000) },
    { name: "an empty string", text: "" },
    { name: "10,000 units of two-unit characters", text: GRINNING_FACE.repeat(5_000) },
    { name: "a string of 6,000 units", text: "x".repeat(6_000) },
  ]) {
    test(`D-PG5-14: returns ${name} unchanged and saves nothing`, async () => {
      // arrange
      const writer = createWriter(SAVED_PATH);

      // act
      const capped = await capHookContext(text, "additionalContext", writer.write);

      // assert
      assert.deepStrictEqual({ capped, saved: writer.saved }, { capped: text, saved: [] });
    });
  }
});

describe("capHookContext over the limit", () => {
  test("D-PG5-15: saves a string of 10,001 units whole and returns the wrapper", async () => {
    // arrange
    const text = "x".repeat(10_001);
    const writer = createWriter(SAVED_PATH);

    // act
    const capped = await capHookContext(text, "additionalContext", writer.write);

    // assert
    assert.deepStrictEqual(
      { capped, saved: writer.saved },
      { capped: wrapper("9.8KB", SAVED_PATH, "x".repeat(2_000)), saved: [text] },
    );
  });

  test("D-PG5-15: wraps 12,000 characters with the 11.7KB label and a 2,000-character preview", async () => {
    // arrange
    const writer = createWriter(SAVED_PATH);

    // act
    const capped = await capHookContext("x".repeat(12_000), "additionalContext", writer.write);

    // assert
    assert.strictEqual(
      capped,
      "<persisted-output>\n" +
        "Output too large (11.7KB). Full output saved to: /data/hook-1-additionalContext.txt\n\n" +
        `Preview (first 2KB):\n${"x".repeat(2_000)}\n...\n</persisted-output>`,
    );
  });

  for (const { name, text, size, preview } of [
    {
      name: "ends the preview at a line break past character 1,000",
      text: `${"a".repeat(1_500)}\n${"b".repeat(10_000)}`,
      size: "11.2KB",
      preview: "a".repeat(1_500),
    },
    {
      name: "keeps 2,000 characters when the last line break lies before character 1,000",
      text: `${"a".repeat(900)}\n${"b".repeat(10_000)}`,
      size: "10.6KB",
      preview: `${"a".repeat(900)}\n${"b".repeat(1_099)}`,
    },
    {
      name: "moves the cut one unit back from a high surrogate at unit 2,000",
      text: `${"x".repeat(1_999)}${GRINNING_FACE}${"x".repeat(10_000)}`,
      size: "11.7KB",
      preview: "x".repeat(1_999),
    },
    {
      name: "keeps a pair that ends at unit 2,000",
      text: GRINNING_FACE.repeat(6_000),
      size: "11.7KB",
      preview: GRINNING_FACE.repeat(1_000),
    },
    {
      name: "labels 10,240 units as 10KB",
      text: "x".repeat(10_240),
      size: "10KB",
      preview: "x".repeat(2_000),
    },
    {
      name: "labels 1,048,576 units as 1MB",
      text: "x".repeat(1_048_576),
      size: "1MB",
      preview: "x".repeat(2_000),
    },
    {
      name: "puts a backslash after the opener of each wrapper tag in the preview",
      text: `a </persisted-output> b <PERSISTED-OUTPUT> c <b>${"x".repeat(11_000)}`,
      size: "10.8KB",
      preview: `a <\\/persisted-output> b <\\PERSISTED-OUTPUT> c <b>${"x".repeat(1_952)}`,
    },
  ]) {
    test(`D-PG5-15: ${name}`, async () => {
      // arrange
      const writer = createWriter(SAVED_PATH);

      // act
      const capped = await capHookContext(text, "additionalContext", writer.write);

      // assert
      assert.strictEqual(capped, wrapper(size, SAVED_PATH, preview));
    });
  }

  test("D-PG5-16: keeps the wrapper within 10,000 characters for a long path and a preview of tags", async () => {
    // arrange
    const writer = createWriter(`/${"p".repeat(4_095)}`);

    // act
    const capped = await capHookContext(
      "<persisted-output>".repeat(700),
      "additionalContext",
      writer.write,
    );

    // assert
    assert.strictEqual(capped.length <= 10_000, true);
  });
});

describe("capHookContext when the write fails", () => {
  for (const { name, write } of [
    {
      name: "a writer that rejects",
      write: (): Promise<string> => Promise.reject(new Error("disk full")),
    },
    {
      name: "a writer that throws at once",
      write: (): Promise<string> => {
        throw new Error("disk full");
      },
    },
  ]) {
    test(`D-PG5-15: returns the head and the failure line, 10,000 units in all, for ${name}`, async () => {
      // arrange
      const marker = `${FAILURE_HEAD}disk full]`;

      // act
      const capped = await capHookContext("x".repeat(12_000), "additionalContext", write);

      // assert
      assert.deepStrictEqual(
        { capped, length: capped.length },
        { capped: "x".repeat(10_000 - marker.length) + marker, length: 10_000 },
      );
    });
  }

  test("D-PG5-16: cuts the failure line of a 20,000-character error to 10,000 units", async () => {
    // arrange
    const error = "e".repeat(20_000);

    // act
    const capped = await capHookContext("x".repeat(12_000), "additionalContext", () =>
      Promise.reject(new Error(error)),
    );

    // assert
    assert.strictEqual(capped, `${FAILURE_HEAD}${error}]`.slice(0, 10_000));
  });

  test("D-PG5-15: names the source of the string in the failure line", async () => {
    // arrange
    const marker = `\n\n[Hook stdout truncated at 10000 chars ${EM_DASH} persist-to-disk failed: full]`;

    // act
    const capped = await capHookContext("x".repeat(12_000), "stdout", () =>
      Promise.reject(new Error("full")),
    );

    // assert
    assert.strictEqual(capped, "x".repeat(10_000 - marker.length) + marker);
  });
});
