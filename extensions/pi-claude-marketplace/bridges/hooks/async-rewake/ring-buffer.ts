// bridges/hooks/async-rewake/ring-buffer.ts
//
// EXEC-05 / D-62-04 pure-leaf circular Buffer for the asyncRewake
// per-child stderr / stdout capture. Fixed capacity, monotonic
// `writeIndex` + `filled` counters, no project-internal imports, no
// node:child_process. Plan 02's registry constructs one instance per
// stream per child via `new RingBuffer(STDERR_CAP_BYTES)` and
// `new RingBuffer(STDOUT_CAP_BYTES)` from the constants exported below.
//
// Policy (diverges from the sync `dispatch-exec.ts` kill-on-overflow
// path -- D-62-04 rationale): on overflow, OLDEST bytes are dropped to
// preserve the TAIL of the stream. asyncRewake's primary use case is
// the exit-code-2 inject of a security finding; the trigger lives at
// the END of stderr / stdout, not the beginning, so the head of the
// stream is the bytes we can afford to lose. A noisy child that emits
// far more than 64 KiB of stderr cannot OOM the parent (capacity is
// fixed at allocation time) and the exit handler still sees the last
// few hundred bytes which carry the action-causing finding.
//
// The `truncated` latch is set the moment any byte is dropped (single-
// write overflow that overwrites an old byte, OR a single chunk larger
// than capacity that already cannot fit in full) and is NEVER reset.
// The exit handler in Plan 02 reads it via `read()` and prepends the
// `[…truncated]\n\n` marker on the inject payload so the model sees
// that history was lost.
//
// UTF-8 wrap-boundary caveat: when overflow drops the head, a multi-
// byte sequence that straddled the wrap point may decode to a single
// `�` glyph at the truncated body's head. This is documented and
// accepted -- the `truncated` flag already tells the consumer that
// history was lost, the loss is at the truncation point by construction,
// and reaching for `StringDecoder` would buy a marginally cleaner glyph
// at the cost of cross-write state we do not need (and would not be
// observable to the LLM after the `[…truncated]` marker either way).
//
// Pure-and-total contract: NEITHER `write` NOR `read` may throw on any
// input. `capacity === 0` is a valid construction (every write latches
// `truncated` when the chunk is non-empty; every `read()` returns the
// empty string).

/** EXEC-05: stderr cap. 64 KiB per child. */
export const STDERR_CAP_BYTES = 65_536;

/** EXEC-05: stdout cap. 1 MiB per child. */
export const STDOUT_CAP_BYTES = 1_048_576;

// ──────────────────────────────────────────────────────────────────────────
// RingBuffer
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fixed-capacity circular byte buffer with tail-drop on overflow.
 *
 * Construction allocates `capacity` bytes (uninitialized via
 * `Buffer.allocUnsafe`; the public surface only ever reads bytes that
 * have been written or are inside the active wrap window so the
 * uninitialized regions are never observable). `capacity === 0` is
 * valid -- the instance behaves as a no-op sink that latches
 * `truncated` on every non-empty write.
 */
export class RingBuffer {
  private readonly buf: Buffer;
  private readonly capacity: number;
  private writeIndex = 0;
  private filled = 0;
  private truncated = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buf = Buffer.allocUnsafe(capacity);
  }

  /**
   * Append `chunk` bytes to the buffer. On overflow (chunk larger than
   * capacity OR total bytes-written exceeds capacity), oldest bytes are
   * dropped and the `truncated` latch is set. Never throws.
   */
  write(chunk: Buffer): void {
    if (chunk.length === 0) {
      return;
    }

    if (this.capacity === 0) {
      // No-op sink. Non-empty input is necessarily truncated.
      this.truncated = true;
      return;
    }

    // Chunk strictly larger than capacity: keep only the TAIL of the
    // chunk. The head of the chunk plus any pre-existing buffer
    // contents are both dropped. Exact-fill (`chunk.length === capacity`)
    // is NOT a truncation -- the chunk fits in full.
    let effective = chunk;
    if (chunk.length > this.capacity) {
      effective = chunk.subarray(chunk.length - this.capacity);
      this.truncated = true;
    }

    // Overwrite-old-bytes case: even if the chunk itself fits, writing
    // it pushes the total past `capacity`, which means at least one
    // pre-existing byte gets overwritten.
    const room = this.capacity - this.filled;
    if (effective.length > room) {
      this.truncated = true;
    }

    // Two-segment copy across the wrap point. `firstLen` is the
    // number of bytes that fit between `writeIndex` and the end of
    // the backing buffer; `tailLen` is the remainder, copied back to
    // the start of the backing buffer.
    const firstLen = Math.min(effective.length, this.capacity - this.writeIndex);
    effective.copy(this.buf, this.writeIndex, 0, firstLen);
    const tailLen = effective.length - firstLen;
    if (tailLen > 0) {
      effective.copy(this.buf, 0, firstLen, firstLen + tailLen);
    }

    this.writeIndex = (this.writeIndex + effective.length) % this.capacity;
    this.filled = Math.min(this.filled + effective.length, this.capacity);
  }

  /**
   * Decode the current contents as utf-8 and return them together with
   * the `truncated` latch. Returns chronological order: oldest byte
   * first, newest byte last. Never throws.
   */
  read(): { text: string; truncated: boolean } {
    if (this.filled === 0) {
      return { text: "", truncated: this.truncated };
    }

    if (this.filled < this.capacity) {
      // Buffer never wrapped: the active region is `[0, filled)`.
      return {
        text: this.buf.subarray(0, this.filled).toString("utf8"),
        truncated: this.truncated,
      };
    }

    // Wrapped: oldest byte is at `writeIndex`, newest byte is at
    // `writeIndex - 1`. Compose `[writeIndex, capacity) + [0, writeIndex)`.
    const head = this.buf.subarray(this.writeIndex);
    const tail = this.buf.subarray(0, this.writeIndex);
    return {
      text: Buffer.concat([head, tail]).toString("utf8"),
      truncated: this.truncated,
    };
  }
}
