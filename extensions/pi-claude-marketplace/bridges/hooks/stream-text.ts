// bridges/hooks/stream-text.ts
//
// Collects the whole text of one output stream of a hook child. Both hook
// lanes use it: `./dispatch-exec.ts` for a blocking hook and
// `./async-rewake/registry.ts` for an `asyncRewake` hook.
//
// EXEC-02: there is no size limit. Claude Code 2.1.316 keeps every byte a
// command hook prints on stdout and stderr and reads all of it, so a JSON
// answer of any size still decides.
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

/**
 * Collects every chunk of `stream` as UTF-8 text. `onError` receives a stream
 * error. It is attached before the `data` listener, so an EPIPE or ECONNRESET
 * while a timeout stops the child cannot surface as an unhandled exception. A
 * `null` stream collects nothing.
 */
export function collectStreamText(
  stream: NodeJS.ReadableStream | null,
  onError: (err: Error) => void,
): StreamText {
  let text = "";
  if (stream !== null) {
    const decoder = new StringDecoder("utf8");
    stream.on("error", onError);
    stream.on("data", (chunk: Buffer | string) => {
      text += typeof chunk === "string" ? chunk : decoder.write(chunk);
    });
    stream.on("end", () => {
      text += decoder.end();
    });
  }

  return { text: () => text };
}
