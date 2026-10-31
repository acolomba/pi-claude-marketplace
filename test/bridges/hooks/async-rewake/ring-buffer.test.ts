import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  RingBuffer,
  STDERR_CAP_BYTES,
  STDOUT_CAP_BYTES,
} from "../../../../extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts";

describe("STDERR_CAP_BYTES", () => {
  test("caps captured standard error at 65,536 bytes", () => {
    // arrange
    const expectedCapacity = 65_536;

    // act
    const capacity = STDERR_CAP_BYTES;

    // assert
    assert.strictEqual(capacity, expectedCapacity);
  });
});

describe("STDOUT_CAP_BYTES", () => {
  test("caps captured standard output at 1,048,576 bytes", () => {
    // arrange
    const expectedCapacity = 1_048_576;

    // act
    const capacity = STDOUT_CAP_BYTES;

    // assert
    assert.strictEqual(capacity, expectedCapacity);
  });
});

describe("RingBuffer", () => {
  test("reads an untouched buffer as empty and untruncated", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const expectedRead = { text: "", truncated: false };

    // act
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("ignores an empty write without changing buffered bytes", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const initialInput = Buffer.from([0x41, 0x42]);
    const emptyInput = Buffer.alloc(0);
    const expectedRead = { text: "AB", truncated: false };

    // act
    buffer.write(initialInput);
    buffer.write(emptyInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("keeps a zero-capacity buffer untruncated after an empty write", () => {
    // arrange
    const buffer = new RingBuffer(0);
    const input = Buffer.alloc(0);
    const expectedRead = { text: "", truncated: false };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("latches truncation when a zero-capacity buffer receives one byte", () => {
    // arrange
    const buffer = new RingBuffer(0);
    const input = Buffer.from([0x41]);
    const expectedRead = { text: "", truncated: true };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("returns multiple chunks in chronological order before capacity is reached", () => {
    // arrange
    const buffer = new RingBuffer(8);
    const firstInput = Buffer.from([0x41, 0x42]);
    const secondInput = Buffer.from([0x43, 0x44]);
    const expectedRead = { text: "ABCD", truncated: false };

    // act
    buffer.write(firstInput);
    buffer.write(secondInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("retains every byte when several chunks exactly fill the buffer", () => {
    // arrange
    const buffer = new RingBuffer(6);
    const firstInput = Buffer.from([0x41, 0x42]);
    const secondInput = Buffer.from([0x43, 0x44]);
    const thirdInput = Buffer.from([0x45, 0x46]);
    const expectedRead = { text: "ABCDEF", truncated: false };

    // act
    buffer.write(firstInput);
    buffer.write(secondInput);
    buffer.write(thirdInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("retains every byte when one chunk exactly fills the buffer", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const input = Buffer.from([0x31, 0x32, 0x33, 0x34]);
    const expectedRead = { text: "1234", truncated: false };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("drops only the oldest byte when chronological input exceeds capacity by one", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const initialInput = Buffer.from([0x31, 0x32, 0x33, 0x34]);
    const newestInput = Buffer.from([0x35]);
    const expectedRead = { text: "2345", truncated: true };

    // act
    buffer.write(initialInput);
    buffer.write(newestInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("keeps the chronological tail when a write crosses the physical wrap point", () => {
    // arrange
    const buffer = new RingBuffer(6);
    const initialInput = Buffer.from([0x41, 0x42, 0x43, 0x44]);
    const wrappingInput = Buffer.from([0x45, 0x46, 0x47, 0x48]);
    const expectedRead = { text: "CDEFGH", truncated: true };

    // act
    buffer.write(initialInput);
    buffer.write(wrappingInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("keeps only the tail when one chunk exceeds capacity by one byte", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const input = Buffer.from([0x41, 0x42, 0x43, 0x44, 0x45]);
    const expectedRead = { text: "BCDE", truncated: true };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("keeps only the newest bytes when one chunk is much larger than capacity", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const input = Buffer.from([0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a]);
    const expectedRead = { text: "GHIJ", truncated: true };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("keeps truncation latched through later reads and writes", () => {
    // arrange
    const buffer = new RingBuffer(4);
    const overflowingInput = Buffer.from([0x41, 0x42, 0x43, 0x44, 0x45]);
    const laterInput = Buffer.from([0x46]);
    const expectedOverflowRead = { text: "BCDE", truncated: true };
    const expectedLaterRead = { text: "CDEF", truncated: true };

    // act
    buffer.write(overflowingInput);
    const overflowRead = buffer.read();
    buffer.write(laterInput);
    const laterRead = buffer.read();

    // assert
    assert.deepStrictEqual(overflowRead, expectedOverflowRead);
    assert.deepStrictEqual(laterRead, expectedLaterRead);
  });

  test("preserves arbitrary non-text bytes that form valid UTF-8", () => {
    // arrange
    const buffer = new RingBuffer(5);
    const input = Buffer.from([0x00, 0x1f, 0x7f, 0xc2, 0xa0]);
    const expectedRead = { text: "\u0000\u001f\u007f\u00a0", truncated: false };

    // act
    buffer.write(input);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });

  test("accepts a raw UTF-8 tail that begins inside a split multibyte sequence", () => {
    // arrange
    const buffer = new RingBuffer(2);
    const firstInput = Buffer.from([0x41, 0xe2]);
    const secondInput = Buffer.from([0x82, 0xac]);
    const expectedRead = { text: "\ufffd\ufffd", truncated: true };

    // act
    buffer.write(firstInput);
    buffer.write(secondInput);
    const read = buffer.read();

    // assert
    assert.deepStrictEqual(read, expectedRead);
  });
});
