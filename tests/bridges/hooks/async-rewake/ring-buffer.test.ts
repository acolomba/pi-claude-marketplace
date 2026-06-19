import assert from "node:assert/strict";
import test from "node:test";

import {
  RingBuffer,
  STDERR_CAP_BYTES,
  STDOUT_CAP_BYTES,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts";

// EXEC-05 / D-62-04: the ring-buffer is a pure-leaf circular Buffer that
// preserves the TAIL on overflow (oldest bytes dropped) and latches a
// `truncated` flag that the exit handler in the registry uses to prepend
// the `[…truncated]` marker.

test("RingBuffer: STDERR_CAP_BYTES === 64 KiB and STDOUT_CAP_BYTES === 1 MiB", () => {
  assert.equal(STDERR_CAP_BYTES, 64 * 1024);
  assert.equal(STDOUT_CAP_BYTES, 1024 * 1024);
});

test("RingBuffer: zero capacity reads empty + truncated false", () => {
  const b = new RingBuffer(0);
  assert.deepEqual(b.read(), { text: "", truncated: false });
});

test("RingBuffer: zero-capacity write of empty buffer keeps truncated false", () => {
  const b = new RingBuffer(0);
  b.write(Buffer.alloc(0));
  assert.deepEqual(b.read(), { text: "", truncated: false });
});

test("RingBuffer: zero-capacity write of non-empty buffer latches truncated", () => {
  const b = new RingBuffer(0);
  b.write(Buffer.from("X"));
  assert.deepEqual(b.read(), { text: "", truncated: true });
});

test("RingBuffer: empty-chunk write is a no-op on a non-zero-capacity buffer", () => {
  const b = new RingBuffer(8);
  b.write(Buffer.alloc(0));
  assert.deepEqual(b.read(), { text: "", truncated: false });
});

test("RingBuffer: simple write under capacity reads back unchanged", () => {
  const b = new RingBuffer(8);
  b.write(Buffer.from("abc"));
  assert.deepEqual(b.read(), { text: "abc", truncated: false });
});

test("RingBuffer: exact-fill no overflow", () => {
  const b = new RingBuffer(8);
  b.write(Buffer.from("12345678"));
  assert.deepEqual(b.read(), { text: "12345678", truncated: false });
});

test("RingBuffer: single-write one-byte overflow drops oldest byte", () => {
  const b = new RingBuffer(8);
  b.write(Buffer.from("123456789"));
  assert.deepEqual(b.read(), { text: "23456789", truncated: true });
});

test("RingBuffer: two-write overflow drops the very oldest byte", () => {
  const b = new RingBuffer(8);
  b.write(Buffer.from("1234"));
  b.write(Buffer.from("56789"));
  assert.deepEqual(b.read(), { text: "23456789", truncated: true });
});

test("RingBuffer: chunk larger than capacity keeps only the tail of the chunk", () => {
  const b = new RingBuffer(4);
  b.write(Buffer.from("ABCDEFGHIJ"));
  assert.deepEqual(b.read(), { text: "GHIJ", truncated: true });
});

test("RingBuffer: two-segment wrap-around reads chronological-order", () => {
  // Write 6 then 4 into a capacity-8 buffer; the second write wraps and
  // overwrites the oldest 2 bytes. The composed read MUST be the LAST
  // 8 bytes in chronological order.
  const b = new RingBuffer(8);
  b.write(Buffer.from("ABCDEF"));
  b.write(Buffer.from("GHIJ"));
  assert.deepEqual(b.read(), { text: "CDEFGHIJ", truncated: true });
});

test("RingBuffer: truncated latch never resets across subsequent writes", () => {
  const b = new RingBuffer(4);
  b.write(Buffer.from("ABCDE")); // overflow trips latch
  assert.equal(b.read().truncated, true);
  b.write(Buffer.from("X")); // small follow-up
  assert.equal(b.read().truncated, true);
});

test("RingBuffer: many small writes that eventually overflow drop oldest bytes", () => {
  const b = new RingBuffer(4);
  b.write(Buffer.from("a"));
  b.write(Buffer.from("b"));
  b.write(Buffer.from("c"));
  b.write(Buffer.from("d"));
  // exact fill; no overflow yet
  assert.deepEqual(b.read(), { text: "abcd", truncated: false });
  b.write(Buffer.from("e"));
  assert.deepEqual(b.read(), { text: "bcde", truncated: true });
  b.write(Buffer.from("fg"));
  assert.deepEqual(b.read(), { text: "defg", truncated: true });
});

test("RingBuffer: write + read are total -- never throw on arbitrary inputs", () => {
  const b = new RingBuffer(4);
  assert.doesNotThrow(() => {
    b.write(Buffer.alloc(0));
    b.write(Buffer.from("xy"));
    b.write(Buffer.from(""));
    b.read();
    b.write(Buffer.from("ABCDEFG"));
    b.read();
  });
});
