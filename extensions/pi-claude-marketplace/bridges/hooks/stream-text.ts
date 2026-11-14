// bridges/hooks/stream-text.ts
//
// Collects the text of one output stream of a hook child, up to a bound.
// Every hook lane uses it: `./dispatch-exec.ts` for a blocking hook, and
// `./async-rewake/registry.ts` for an `asyncRewake` hook and for a plain
// `async` hook. The registry sets the plain hook's lower bound for stdout,
// `PLAIN_ASYNC_STREAM_LIMIT` with a kept tail of `PLAIN_ASYNC_STREAM_TAIL`,
// and keeps none of its stderr.
//
// EXEC-02: Claude Code 2.1.316 keeps every byte a command hook prints on
// stdout and stderr and reads all of it, so a JSON answer of any size still
// decides. Every collector still takes a bound, because a hook that prints
// for hours would otherwise grow one string until V8 throws in a `data`
// listener, which nothing catches (NFR-2). `ceilingBound` gives the blocking
// lane and the `asyncRewake` lane a ceiling far past what a hook prints, and
// a plain `async` hook, which has no timer (D-PG5-17), passes a lower bound.
//
// WR-05: incoming Buffers go through a `StringDecoder`, so a multi-byte UTF-8
// sequence that a chunk boundary splits is joined again, not turned into
// U+FFFD characters. The decoder's tail is added on `end`, so a final partial
// sequence is not dropped.
//
// A bound counts UTF-16 code units, as `String.length` does, so a character
// outside the Basic Multilingual Plane, such as an emoji, counts as two. A cut
// that would split such a pair keeps one unit fewer, so the text never ends
// in half a character.
//
// A bound may also keep a tail: the last units of the stream past the cut. A
// stream that the head and the tail hold whole comes back exactly. Once units
// are dropped, the tail loses its first line, which can start anywhere in a
// line, and its whole lines follow the head after a line break. A hook's
// answer on its last line, after more progress lines than the head holds, then
// still parses as one line, and no line fragment can parse first (D-BG-205).

import { constants } from "node:buffer";
import { StringDecoder } from "node:string_decoder";

import { hookDebugLog } from "../../shared/debug-log.ts";

/** The text a stream has delivered so far. */
export interface StreamText {
  readonly text: () => string;
}

/** The most UTF-16 code units a collector keeps, and what it calls once it drops some. */
export interface StreamTextBound {
  readonly limit: number;
  /** The most code units of the stream's end that the text keeps past a cut; none by default. */
  readonly tail?: number;
  readonly onLimit: () => void;
}

/** NFR-2: the most UTF-16 code units of one stream that `ceilingBound` keeps. */
const STREAM_TEXT_CEILING = 2 ** 28;

/**
 * NFR-2: the code units that `ceilingBound` leaves free below the runtime's
 * longest string, so the kept text plus the next chunk always fits.
 */
const STREAM_TEXT_HEADROOM = 2 ** 20;

/**
 * The bound of a lane that keeps a stream whole (EXEC-02) up to the NFR-2
 * ceiling, or up to `STREAM_TEXT_HEADROOM` below the runtime's longest
 * string, `maxStringLength`, when that is less, as on a 32-bit host. Past
 * the bound, one debug line names `stream` and `hook`.
 */
export function ceilingBound(
  stream: "stdout" | "stderr",
  hook: string,
  maxStringLength: number = constants.MAX_STRING_LENGTH,
): StreamTextBound {
  const limit = Math.min(STREAM_TEXT_CEILING, maxStringLength - STREAM_TEXT_HEADROOM);
  return {
    limit,
    onLimit: () => {
      hookDebugLog(`hook output: ${stream} past ${limit} UTF-16 code units dropped (${hook})`);
    },
  };
}

// Where to cut `text` to keep at most `limit` code units: one unit earlier
// when the last kept unit would be the high half of a surrogate pair.
function cutIndex(text: string, limit: number): number {
  const last = text.charCodeAt(limit - 1);
  return last >= 0xd800 && last <= 0xdbff ? limit - 1 : limit;
}

// The last `count` code units of `text`. A start that splits a surrogate pair
// lies in the tail's first line, which the text never keeps once units drop.
function lastUnits(text: string, count: number): string {
  return text.length <= count ? text : text.slice(text.length - count);
}

/**
 * Collects every chunk of `stream` as UTF-8 text. `onError` receives a stream
 * error. It is attached before the `data` listener, so an EPIPE or ECONNRESET
 * while a timeout stops the child cannot surface as an unhandled exception. A
 * `null` stream collects nothing. The text keeps the first `bound.limit`
 * UTF-16 code units, or one fewer where the cut would split a surrogate pair.
 * Later chunks are read and dropped, and `bound.onLimit` runs once, at the
 * first dropped unit. With a `bound.tail`, the text keeps the last
 * `bound.tail` units of the stream past the cut: all of them, joined exactly,
 * while none is dropped, and after that only the whole lines among them,
 * after a line break.
 */
export function collectStreamText(
  stream: NodeJS.ReadableStream | null,
  onError: (err: Error) => void,
  bound: StreamTextBound,
): StreamText {
  let head = "";
  let tail = "";
  let full = false;
  let dropped = false;
  const tailLimit = bound.tail ?? 0;
  const keepsTail = tailLimit > 0;
  const keepTail = (units: string): string => {
    const kept = lastUnits(units, tailLimit);
    if (!dropped && kept.length < units.length) {
      dropped = true;
      bound.onLimit();
    }

    return kept;
  };

  const append = (piece: string): void => {
    if (full) {
      tail = keepTail(tail + piece);
      return;
    }

    head += piece;
    if (head.length > bound.limit) {
      const cut = cutIndex(head, bound.limit);
      tail = keepTail(head.slice(cut));
      head = head.slice(0, cut);
      full = true;
    }
  };

  const text = (): string => {
    if (!dropped) {
      return head + tail;
    }

    const lineEnd = tail.indexOf("\n");
    return lineEnd === -1 ? head : `${head}\n${tail.slice(lineEnd + 1)}`;
  };

  if (stream !== null) {
    const decoder = new StringDecoder("utf8");
    stream.on("error", onError);
    stream.on("data", (chunk: Buffer | string) => {
      if (!full || keepsTail) {
        append(typeof chunk === "string" ? chunk : decoder.write(chunk));
      }
    });
    stream.on("end", () => {
      if (!full || keepsTail) {
        append(decoder.end());
      }
    });
  }

  return { text };
}
