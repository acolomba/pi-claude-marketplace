import type { InputEvent, InputEventResult } from "../platform/pi-api.ts";

/** U+200B ZERO WIDTH SPACE: Pi matches a slash command only at the start of the text. */
const NO_EXPANSION_PREFIX = "​";

/**
 * The `transform` result that sends `text` to the model as it is, with the
 * images of `event`. Pi runs its skill and template expansion again on the
 * text an input handler returns, so a finished text that starts with `/`
 * would be expanded a second time. One zero-width space before it keeps the
 * slash line literal, as Claude Code sends a command body that starts with
 * `/` (03-UPSTREAM-EVIDENCE E8; the 2026-11-02 user decision on the Pi gap
 * report, item 6).
 */
export function finishedTransform(text: string, event: InputEvent): InputEventResult {
  const literal = text.startsWith("/") ? `${NO_EXPANSION_PREFIX}${text}` : text;
  return event.images === undefined
    ? { action: "transform", text: literal }
    : { action: "transform", text: literal, images: event.images };
}
