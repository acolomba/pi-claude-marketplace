import assert from "node:assert/strict";
import { constants } from "node:buffer";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { test, type TestContext } from "node:test";

import {
  ceilingBound,
  collectStreamText,
} from "../../../extensions/pi-claude-marketplace/bridges/hooks/stream-text.ts";

const WHOLE = ceilingBound("stdout", "demo/Stop");

function rejectError(err: Error): void {
  throw new Error(`unexpected stream error: ${err.message}`);
}

test("joins a UTF-8 character split across two chunks", async () => {
  // arrange
  const stream = new PassThrough();
  const euro = Buffer.from("€", "utf8");
  const output = collectStreamText(stream, rejectError, WHOLE);

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
  const output = collectStreamText(stream, rejectError, WHOLE);

  // act
  stream.emit("data", "first ");
  stream.emit("data", "second");

  // assert
  assert.strictEqual(output.text(), "first second");
});

test("keeps every byte of an output past 1 MB", async () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError, WHOLE);

  // act
  stream.write(Buffer.alloc(1024 * 1024, 0x78));
  stream.end("tail");
  await once(stream, "end");

  // assert
  assert.strictEqual(output.text(), `${"x".repeat(1024 * 1024)}tail`);
});

test("keeps the first characters up to its bound and drops later chunks", async () => {
  // arrange
  const stream = new PassThrough();
  let limitCalls = 0;
  const output = collectStreamText(stream, rejectError, {
    limit: 5,
    onLimit: () => {
      limitCalls += 1;
    },
  });

  // act
  stream.write("abc");
  stream.write("defg");
  stream.end("hij");
  await once(stream, "end");

  // assert
  assert.deepStrictEqual({ text: output.text(), limitCalls }, { text: "abcde", limitCalls: 1 });
});

test("keeps a stream that ends at its bound whole and drops nothing", async () => {
  // arrange
  const stream = new PassThrough();
  let limitCalls = 0;
  const output = collectStreamText(stream, rejectError, {
    limit: 5,
    onLimit: () => {
      limitCalls += 1;
    },
  });

  // act
  stream.end("abcde");
  await once(stream, "end");

  // assert
  assert.deepStrictEqual({ text: output.text(), limitCalls }, { text: "abcde", limitCalls: 0 });
});

test("adds no unfinished UTF-8 tail once its bound is reached", async () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError, { limit: 2, onLimit: () => undefined });

  // act
  stream.write(Buffer.from("abc"));
  stream.end(Buffer.from([0xe2, 0x82]));
  await once(stream, "end");

  // assert
  assert.strictEqual(output.text(), "ab");
});

test("bounds an unfinished UTF-8 tail that passes its bound", async () => {
  // arrange
  const stream = new PassThrough();
  let limitCalls = 0;
  const output = collectStreamText(stream, rejectError, {
    limit: 2,
    onLimit: () => {
      limitCalls += 1;
    },
  });

  // act
  stream.end(Buffer.from([0x6f, 0x6b, 0xe2, 0x82]));
  await once(stream, "end");

  // assert
  assert.deepStrictEqual({ text: output.text(), limitCalls }, { text: "ok", limitCalls: 1 });
});

test("adds an unfinished UTF-8 sequence at the end as a replacement character", async () => {
  // arrange
  const stream = new PassThrough();
  const output = collectStreamText(stream, rejectError, WHOLE);

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
  collectStreamText(
    stream,
    (err) => {
      errors.push(err.message);
    },
    WHOLE,
  );

  // act
  stream.emit("error", new Error("EPIPE"));

  // assert
  assert.deepStrictEqual(errors, ["EPIPE"]);
});

test("collects nothing from a missing stream", () => {
  // act
  const output = collectStreamText(null, rejectError, WHOLE);

  // assert
  assert.strictEqual(output.text(), "");
});

test("keeps its ceiling below V8's longest string, with room for a 1 MiB chunk (NFR-2)", () => {
  // act
  const { limit } = ceilingBound("stdout", "demo/Stop");

  // assert
  assert.ok(limit + 1024 * 1024 < constants.MAX_STRING_LENGTH, `ceiling ${limit}`);
});

/** Collects the OBS-01 debug lines a case emits, restoring the flag after. */
function observeHookDebug(t: TestContext): () => string[] {
  const previous = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "PI_CLAUDE_MARKETPLACE_DEBUG");
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previous;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const diagnostics: string[] = [];
  t.mock.method(console, "error", (diagnostic: unknown) => {
    diagnostics.push(String(diagnostic));
  });
  return () => [...diagnostics];
}

test("names the stream and the hook in its debug line once a stream passes the ceiling (NFR-2)", (t) => {
  // arrange
  const debugLines = observeHookDebug(t);
  const bound = ceilingBound("stderr", "demo/Stop");

  // act
  bound.onLimit();

  // assert
  assert.deepStrictEqual(debugLines(), [
    "[hooks] hook output: stderr past 268435456 characters dropped (demo/Stop)",
  ]);
});
