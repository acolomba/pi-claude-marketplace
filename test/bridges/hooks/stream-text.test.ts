import assert from "node:assert/strict";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import { collectStreamText } from "../../../extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts";

function rejectError(err: Error): void {
  throw new Error(`unexpected stream error: ${err.message}`);
}

test("joins a UTF-8 character split across two chunks", async () => {
  // arrange
  const stream = new PassThrough();
  const euro = Buffer.from("€", "utf8");
  const output = collectStreamText(stream, rejectError);

  // act
  stream.write(Buffer.concat([Buffer.from("a"), euro.subarray(0, 1)]));
  stream.end(Buffer.concat([euro.subarray(1), Buffer.from("b")]));
  await once(stream, "end");

  // assert
  assert.strictEqual(output.text(), "a€b");
});

test("keeps string chunks in order", () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError);

  // act
  stream.emit("data", "first ");
  stream.emit("data", "second");

  // assert
  assert.strictEqual(output.text(), "first second");
});

test("keeps every byte of an output past 1 MB", async () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError);

  // act
  stream.write(Buffer.alloc(1024 * 1024, 0x78));
  stream.end("tail");
  await once(stream, "end");

  // assert
  assert.strictEqual(output.text(), `${"x".repeat(1024 * 1024)}tail`);
});

test("adds an unfinished UTF-8 sequence at the end as a replacement character", async () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError);

  // act
  stream.end(Buffer.from([0x6f, 0x6b, 0xe2, 0x82]));
  await once(stream, "end");

  // assert
  assert.strictEqual(output.text(), "ok\uFFFD");
});

test("hands a stream error to the error listener", () => {
  // arrange
  const stream = new PassThrough();
  const errors: string[] = [];
  collectStreamText(stream, (err) => {
    errors.push(err.message);
  });

  // act
  stream.emit("error", new Error("EPIPE"));

  // assert
  assert.deepStrictEqual(errors, ["EPIPE"]);
});

test("collects nothing from a missing stream", () => {
  // act
  const output = collectStreamText(null, rejectError);

  // assert
  assert.strictEqual(output.text(), "");
});
