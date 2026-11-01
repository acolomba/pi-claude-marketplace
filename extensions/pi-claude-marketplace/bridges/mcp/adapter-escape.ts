// bridges/mcp/adapter-escape.ts
//
// Writes Claude's expansion of one MCP field in pi-mcp-adapter's encoding
// (AVAR-03). At connect time the adapter expands `${NAME}` and, since
// pi-mcp-adapter 7.0.0, `${NAME:-default}` in its first pass, then `$env:NAME`,
// then `{env:NAME}`, in three global passes. Each pass reads the previous
// pass's output but never its own. The adapter also runs a leading `!` in an
// `env` or `headers` value as a shell command. Literal text that Claude keeps,
// including literal `${NAME:-default}` text (VER-04), must therefore reach the
// server unchanged through all of that. The split token
// `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` breaks each trigger: the third pass
// expands it to the empty string after the first two passes have read past
// the broken trigger, and its own output is never read again.
//
// D-CF1-13: a reference with a default is written as `${NAME:-default}` for
// the adapter's first pass. The split token holds `}`, so it cannot go inside
// a default; `domain/claude-mcp-variables.ts` keeps every default that holds
// `$env:` or `{env:` text out of a reference. Either the runtime value or the
// default ends up beside the text around the reference, so both get the
// guards a plain reference gets.

import { ADAPTER_EMPTY_ENV } from "../../shared/session-env.ts";

import type { Segment } from "../../domain/claude-mcp-variables.ts";

const SPLIT_TOKEN = `{env:${ADAPTER_EMPTY_ENV}}`;

// The adapter's three triggers in literal text; the first also covers a `:-`
// default (VER-04). One pass, so an inserted split token is never escaped again.
const TRIGGER = /\$env:|\{env:|\$(?=\{\w+(?:\}|:-))/g;

// A literal tail that a kept reference expanding to the empty string at runtime
// could complete into `$env:NAME` or `{env:NAME}`.
const PARTIAL_TRIGGER_TAIL = /[${](?:e(?:nv?)?)?$/;

// The start of literal text after a kept reference that could complete a
// `$env:NAME` or `{env:NAME}` begun at the end of the reference's runtime
// value: a name character (which covers `env:`, `nv:` and `v:`), a `:` before
// a name character, or the closing `}`.
const MARKER_COMPLETION = /^(?:[\w}]|:\w)/;

type Reference = Extract<Segment, { kind: "ref" }>;

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

// A default resolved at install and the text beside it reach the adapter as
// one literal, so adjacent text segments are escaped as one run.
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

// A reference's default cannot complete a marker begun by the reference
// before it, nor a partial trigger in the text or default before it.
function needsReferenceGuard(
  reference: Reference,
  precedingText: string,
  afterReference: boolean,
): boolean {
  const { fallback } = reference;
  return (
    PARTIAL_TRIGGER_TAIL.test(precedingText) ||
    (afterReference && fallback !== undefined && MARKER_COMPLETION.test(fallback))
  );
}

function writtenReference({ name, fallback }: Reference): string {
  return fallback === undefined ? `\${${name}}` : `\${${name}:-${fallback}}`;
}

/**
 * Writes the segments of one field. Literal runs get the split token in each
 * adapter trigger, and each reference is written as `${NAME}`, or as
 * `${NAME:-default}` when it carries a default (D-CF1-13). The split token
 * also goes in front of a kept reference after a partial trigger, in front of
 * literal text after a kept reference when that text could complete a marker
 * begun by the reference's value or default (AVAR-05), and in front of a
 * reference after a reference when its default could complete such a marker.
 * A `secret` field (`env` and `headers` values) that starts with `!` gains one
 * more `!`, which the adapter removes instead of running a shell command.
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
      const guard = needsReferenceGuard(segment, precedingText, afterReference) ? SPLIT_TOKEN : "";
      written += guard + writtenReference(segment);
      precedingText = segment.fallback ?? "";
      afterReference = true;
    }
  }

  return secret && written.startsWith("!") ? `!${written}` : written;
}

/** Writes a value Claude leaves unexpanded as one literal run. */
export function serializeLiteral(text: string, secret: boolean): string {
  return serializeSegments([{ kind: "text", text }], secret);
}
