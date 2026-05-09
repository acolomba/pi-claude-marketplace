import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { atomicWriteJson } from "../../extensions/claude-marketplace/shared/atomic-json.ts";

/**
 * NFR-1, AS-1, D-03 -- atomicWriteJson via write-file-atomic@^8.
 *
 * The library handles tmp + fsync + rename internally; these tests verify
 * the wrapper produces the expected shape (2-space indent + trailing newline)
 * and that concurrent writes serialize cleanly.
 */

test("happy path: write succeeds with 2-space indent + trailing newline (AS-1)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const file = path.join(dir, "out.json");
    await atomicWriteJson(file, { ok: true, n: 7 });
    const got = await readFile(file, "utf8");
    assert.equal(
      got,
      '{\n  "ok": true,\n  "n": 7\n}\n',
      `unexpected JSON shape: ${JSON.stringify(got)}`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("auto-creates parent directory if missing (D-03 ergonomics)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const file = path.join(dir, "deeply", "nested", "out.json");
    await atomicWriteJson(file, { hello: "world" });
    const got = await readFile(file, "utf8");
    const parsed = JSON.parse(got) as { hello: string };
    assert.equal(parsed.hello, "world");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("concurrent writes serialize cleanly (NFR-1 -- write-file-atomic queue)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const file = path.join(dir, "race.json");
    // Kick off 5 parallel writes with distinct payloads. The library's
    // internal queue serializes them; the final on-disk content is one of
    // the inputs (which one is non-deterministic, but it MUST be a complete
    // valid JSON document of one of the candidates -- never a mid-write
    // truncation).
    const candidates = [{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }, { i: 5 }];
    await Promise.all(candidates.map((c) => atomicWriteJson(file, c)));
    const got = await readFile(file, "utf8");
    const parsed = JSON.parse(got) as { i: number };
    assert.ok(
      candidates.some((c) => c.i === parsed.i),
      `final content's "i" must match one of the inputs, got ${parsed.i}`,
    );
    // The trailing newline + 2-space indent must still be intact:
    assert.match(got, /^\{\n {2}"i": \d+\n\}\n$/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
