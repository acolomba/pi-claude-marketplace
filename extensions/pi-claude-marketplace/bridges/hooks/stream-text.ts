// bridges/hooks/stream-text.ts
//
// Collects the text of one output stream of a hook child, up to a bound.
// Every hook lane uses it: `./dispatch-exec.ts` for a blocking hook, and
// `./async-rewake/registry.ts` for an `asyncRewake` hook and for a plain
// `async` hook, which keeps the first 8,388,608 UTF-16 code units of its
// stdout and none of its stderr.
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

import { StringDecoder } from "node:string_decoder";

import { hookDebugLog } from "../../shared/debug-log.ts";

/** The text a stream has delivered so far. */
export interface StreamText {
  readonly text: () => string;
}

/** The most UTF-16 code units a collector keeps, and what it calls once it drops some. */
export interface StreamTextBound {
  readonly limit: number;
  readonly onLimit: () => void;
}

/**
 * NFR-2: the most UTF-16 code units of one stream that a collector keeps
 * under `ceilingBound`. V8's longest string is almost twice as long, so the
 * text and the next chunk always fit.
 */
const STREAM_TEXT_CEILING = 2 ** 28;

/**
 * The bound of a lane that keeps a stream whole (EXEC-02) up to the NFR-2
 * ceiling. Past the ceiling, one debug line names `stream` and `hook`.
 */
export function ceilingBound(stream: "stdout" | "stderr", hook: string): StreamTextBound {
  return {
    limit: STREAM_TEXT_CEILING,
    onLimit: () => {
      hookDebugLog(
        `hook output: ${stream} past ${STREAM_TEXT_CEILING} UTF-16 code units dropped (${hook})`,
      );
    },
  };
}

// Where to cut `text` to keep at most `limit` code units: one unit earlier
// when the last kept unit would be the high half of a surrogate pair.
function cutIndex(text: string, limit: number): number {
  const last = text.charCodeAt(limit - 1);
  return last >= 0xd800 && last <= 0xdbff ? limit - 1 : limit;
}

/**
 * Collects every chunk of `stream` as UTF-8 text. `onError` receives a stream
 * error. It is attached before the `data` listener, so an EPIPE or ECONNRESET
 * while a timeout stops the child cannot surface as an unhandled exception. A
 * `null` stream collects nothing. The text keeps the first `bound.limit`
 * UTF-16 code units, or one fewer where the cut would split a surrogate pair.
 * Later chunks are read and dropped, and `bound.onLimit` runs once, at the
 * first dropped unit.
 */
export function collectStreamText(
  stream: NodeJS.ReadableStream | null,
  onError: (err: Error) => void,
  bound: StreamTextBound,
): StreamText {
  let text = "";
  let full = false;
  const append = (piece: string): void => {
    text += piece;
    if (text.length > bound.limit) {
      text = text.slice(0, cutIndex(text, bound.limit));
      full = true;
      bound.onLimit();
    }
  };

  if (stream !== null) {
    const decoder = new StringDecoder("utf8");
    stream.on("error", onError);
    stream.on("data", (chunk: Buffer | string) => {
      if (!full) {
        append(typeof chunk === "string" ? chunk : decoder.write(chunk));
      }
    });
    stream.on("end", () => {
      if (!full) {
        append(decoder.end());
      }
    });
  }

  return { text: () => text };
}
