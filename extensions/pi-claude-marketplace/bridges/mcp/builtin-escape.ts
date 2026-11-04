// bridges/mcp/builtin-escape.ts
//
// Writes Claude's expansion of one MCP field for Pi's built-in MCP (BLT-02).
// Pi's resolver has no `${NAME:-default}` form, fails a connection on an
// unset variable, and runs a leading `!` as a shell command, so this encoder
// resolves every reference itself, from the session environment it is given,
// with Claude Code 2.1.318's rule: a set variable wins, the empty string
// included; an unset one takes its `:-` default, else keeps its literal
// `${NAME}` text (AVAR-02).
//
// Pi 1.5.0 `dist/core/resolve-config-value.js` resolves only `env` and
// `headers` values, the `secret` fields: there `$NAME` and `${NAME}` expand,
// `$$` reads as `$`, `$!` reads as `!`, and a leading `!` runs a command. So
// in a secret field every `$` is doubled and a leading `!` gains a `$`, and
// the server receives the resolved value byte for byte. `command`, `args`,
// and `url` are never resolved by Pi and are written as they are. The
// resolved values live only in Pi's session registry (P2-DC-02).

import type { McpFieldEncoder } from "./substitute.ts";
import type { ClaudeEnv, Segment } from "../../domain/claude-mcp-variables.ts";

function segmentValue(segment: Segment, env: ClaudeEnv): string {
  if (segment.kind === "text") {
    return segment.text;
  }

  const value = Object.hasOwn(env, segment.name) ? env[segment.name] : undefined;
  if (value !== undefined) {
    return value;
  }

  return segment.fallback ?? `\${${segment.name}}`;
}

function escapedForPi(value: string): string {
  // A replacement string would read `$$` as one `$`, so a function returns it.
  const escaped = value.replaceAll("$", () => "$$");
  return escaped.startsWith("!") ? `$${escaped}` : escaped;
}

/** Pi's built-in MCP field encoder: resolves each reference, then escapes a secret field for Pi. */
export const BUILTIN_FIELD_ENCODER: McpFieldEncoder = {
  expanded: (segments, secret, env) => {
    const value = segments.map((segment) => segmentValue(segment, env)).join("");
    return secret ? escapedForPi(value) : value;
  },
  literal: (text, secret) => (secret ? escapedForPi(text) : text),
};
