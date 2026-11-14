// bridges/hooks/stream-text.ts
//
// Collects the whole text of one output stream of a hook child. Both hook
// lanes use it: `./dispatch-exec.ts` for a blocking hook and
// `./async-rewake/registry.ts` for an `asyncRewake` hook.
//
// EXEC-02: there is no size limit by default. Claude Code 2.1.316 keeps every
// byte a command hook prints on stdout and stderr and reads all of it, so a
// JSON answer of any size still decides. A caller may pass a bound: a plain
// `async` hook has no timer (D-PG5-17), so its lane keeps only the first part
// of each stream, and a hook that prints for hours cannot grow one string
// until V8 throws in a `data` listener (NFR-2).
//
// WR-05: incoming Buffers go through a `StringDecoder`, so a multi-byte UTF-8
// sequence that a chunk boundary splits is joined again, not turned into
// U+FFFD characters. The decoder's tail is added on `end`, so a final partial
// sequence is not dropped.

import { StringDecoder } from "node:string_decoder";

/** The text a stream has delivered so far. */
export interface StreamText {
  readonly text: () => string;
}

/** The most characters a collector keeps, and what it calls once it drops some. */
export interface StreamTextBound {
  readonly limit: number;
  readonly onLimit: () => void;
}

/**
 * Collects every chunk of `stream` as UTF-8 text. `onError` receives a stream
 * error. It is attached before the `data` listener, so an EPIPE or ECONNRESET
 * while a timeout stops the child cannot surface as an unhandled exception. A
 * `null` stream collects nothing. With a `bound`, the text keeps its first
 * `limit` characters, later chunks are read and dropped, and `onLimit` runs
 * once, at the first dropped character.
 */
export function collectStreamText(
  stream: NodeJS.ReadableStream | null,
  onError: (err: Error) => void,
  bound?: StreamTextBound,
): StreamText {
  let text = "";
  let full = false;
  const append = (piece: string): void => {
    text += piece;
    if (bound !== undefined && text.length > bound.limit) {
      text = text.slice(0, bound.limit);
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
