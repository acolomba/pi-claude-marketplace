// bridges/mcp/adapter-escape.ts
//
// Writes Claude's expansion of one MCP field in pi-mcp-adapter's encoding
// (AVAR-03). At connect time the adapter expands `${NAME}`, then `$env:NAME`,
// then `{env:NAME}`, in three global passes. Each pass reads the previous
// pass's output but never its own. The adapter also runs a leading `!` in an
// `env` or `headers` value as a shell command. Literal text that Claude keeps
// must therefore reach the server unchanged through all of that. The split
// token `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` breaks each trigger: the third pass
// expands it to the empty string after the first two passes have read past
// the broken trigger, and its own output is never read again.

import { ADAPTER_EMPTY_ENV } from "../../shared/session-env.ts";

import type { Segment } from "../../domain/claude-mcp-variables.ts";

const SPLIT_TOKEN = `{env:${ADAPTER_EMPTY_ENV}}`;

// The adapter's three triggers in literal text. One pass, so an inserted split
// token is never escaped again.
const TRIGGER = /\$env:|\{env:|\$(?=\{\w+\})/g;

// A literal tail that a kept reference expanding to the empty string at runtime
// could complete into `$env:NAME` or `{env:NAME}`.
const PARTIAL_TRIGGER_TAIL = /[${](?:e(?:nv?)?)?$/;

// The start of literal text after a kept reference that could complete a
// `$env:NAME` or `{env:NAME}` begun at the end of the reference's runtime
// value: a name character (which covers `env:`, `nv:` and `v:`), a `:` before
// a name character, or the closing `}`.
const MARKER_COMPLETION = /^(?:[\w}]|:\w)/;

function escapeTrigger(trigger: string): string {
  switch (trigger) {
    case "$env:":
      return `$env${SPLIT_TOKEN}:`;
    case "{env:":
      return `{env:${SPLIT_TOKEN}`;
    default:
      return `$${SPLIT_TOKEN}`;
  }
}

// A `:-` default and the text beside it reach the adapter as one literal, so
// adjacent text segments are escaped as one run.
function mergedRuns(segments: readonly Segment[]): Segment[] {
  const runs: Segment[] = [];
  for (const segment of segments) {
    const previous = runs.at(-1);
    if (segment.kind === "text" && previous?.kind === "text") {
      runs[runs.length - 1] = { kind: "text", text: previous.text + segment.text };
    } else {
      runs.push(segment);
    }
  }

  return runs;
}

/**
 * Writes the segments of one field. Literal runs get the split token in each
 * adapter trigger, and each reference is written as `${NAME}`. The split token
 * also goes in front of a kept reference after a partial trigger, and in front
 * of literal text after a kept reference when that text could complete a
 * marker begun by the reference's value (AVAR-05). A `secret` field (`env` and
 * `headers` values) that starts with `!` gains one more `!`, which the adapter
 * removes instead of running a shell command.
 */
export function serializeSegments(segments: readonly Segment[], secret: boolean): string {
  let written = "";
  let precedingText = "";
  let afterReference = false;
  for (const segment of mergedRuns(segments)) {
    if (segment.kind === "text") {
      const guard = afterReference && MARKER_COMPLETION.test(segment.text) ? SPLIT_TOKEN : "";
      written += guard + segment.text.replace(TRIGGER, (trigger) => escapeTrigger(trigger));
      precedingText = segment.text;
      afterReference = false;
    } else {
      const guard = PARTIAL_TRIGGER_TAIL.test(precedingText) ? SPLIT_TOKEN : "";
      written += `${guard}\${${segment.name}}`;
      precedingText = "";
      afterReference = true;
    }
  }

  return secret && written.startsWith("!") ? `!${written}` : written;
}

/** Writes a value Claude leaves unexpanded as one literal run. */
export function serializeLiteral(text: string, secret: boolean): string {
  return serializeSegments([{ kind: "text", text }], secret);
}
