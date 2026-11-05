// bridges/mcp/substitute.ts
//
// Expands Claude Code's variables in one translated MCP entry and injects the
// stdio env (MENV-01..03, AVAR-01..03, AVAR-05). The entry comes from the
// closed table in `domain/mcp-server-features.ts`, so it holds only fields
// Claude reads. Claude expands five of them: stdio `command`, `args` elements
// and `env` values, which use the plain deny-list, and remote `url` and
// `headers` values, which use the remote-sink deny-list. Each goes through
// Claude's rule in `domain/claude-mcp-variables.ts`, and the `McpFieldEncoder`
// of the implementation that runs the server writes the result in that
// implementation's encoding: `ADAPTER_FIELD_ENCODER` below, over
// `adapter-escape.ts`, for pi-mcp-adapter, and `builtin-escape.ts` for Pi's
// built-in MCP. The `env` values under `CLAUDE_PLUGIN_ROOT` and
// `CLAUDE_PLUGIN_DATA` and every `oauth` value go through the encoder as
// literal text. Every other field, every key and every non-string value is
// copied unchanged. Bridge-local by design: shared/vars.ts owns content
// substitution, a different variable set.

import { expandClaudeValue } from "../../domain/claude-mcp-variables.ts";

import { serializeLiteral, serializeSegments } from "./adapter-escape.ts";
import { isPlainObject } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type {
  ClaudeBuiltins,
  ClaudeEnv,
  FieldClass,
  Segment,
} from "../../domain/claude-mcp-variables.ts";

/**
 * How one MCP implementation writes the values of the expanded fields.
 * `secret` marks a field the implementation itself resolves at connect time
 * (`env` and `headers` values), so its value may need guards that the other
 * fields do not.
 */
export interface McpFieldEncoder {
  /** Writes the segments Claude's rule left for one field value, reading `env` for references. */
  readonly expanded: (segments: readonly Segment[], secret: boolean, env: ClaudeEnv) => string;
  /** Writes a value Claude leaves unexpanded. */
  readonly literal: (text: string, secret: boolean) => string;
}

/**
 * pi-mcp-adapter's encoder (AVAR-03). The adapter expands a kept `${NAME}`
 * reference itself at connect time, so the encoder writes each reference as
 * text and never reads the environment.
 */
export const ADAPTER_FIELD_ENCODER: McpFieldEncoder = {
  expanded: (segments, secret) => serializeSegments(segments, secret),
  literal: (text, secret) => serializeLiteral(text, secret),
};

/**
 * Resolution context for one staged entry. `pluginRoot` / `pluginData` are the
 * real install paths substituted for `${CLAUDE_PLUGIN_ROOT}` /
 * `${CLAUDE_PLUGIN_DATA}`. `projectDir` feeds only the install-time expansion
 * of `${CLAUDE_PROJECT_DIR}` (AVAR-01): the construction site computes it ONCE
 * as "project scope -> cwd, user scope -> undefined", so a user-scope entry
 * keeps the reference for pi-mcp-adapter to expand from Pi's process. The
 * field is required (not optional) so every construction site states the
 * decision explicitly. `env` is the environment Claude's rule reads to decide
 * whether a variable is set (AVAR-02); no value from it is ever written.
 */
export interface McpSubstitutionContext extends ClaudeBuiltins {
  readonly env: ClaudeEnv;
}

/** One server's variable facts for the user-facing warnings (AVAR-02, AVAR-04). */
export interface VariableReport {
  /** Unset variables with no default, deduplicated in first-seen field order. */
  readonly missing: readonly string[];
  /**
   * AVAR-05: set deny-listed variables written as the empty string in `url`
   * or `headers`, deduplicated in first-seen order: `url`, then the `headers`
   * values in key order. A plain-field blank is not listed, because Claude
   * warns only about a remote server.
   */
  readonly blanked: readonly string[];
}

/** The names one entry's walk collects, in field order. */
interface ReportNames {
  readonly missing: string[];
  readonly blanked: string[];
}

/** What one entry's walk reads: the resolution context, the encoder, and the report it fills. */
interface WalkState {
  readonly ctx: McpSubstitutionContext;
  readonly encoder: McpFieldEncoder;
  readonly names: ReportNames;
}

/** The written entry and its variable report. */
export interface SubstitutedEntry {
  readonly entry: Record<string, unknown>;
  readonly report: VariableReport;
}

// AVAR-01: Claude writes the values under these env keys without expansion,
// whether injected or declared.
const LITERAL_ENV_KEYS: ReadonlySet<string> = new Set(["CLAUDE_PLUGIN_ROOT", "CLAUDE_PLUGIN_DATA"]);

function expandedValue(
  raw: string,
  fieldClass: FieldClass,
  secret: boolean,
  { ctx, encoder, names }: WalkState,
): string {
  const expanded = expandClaudeValue(raw, fieldClass, ctx.env, ctx);
  names.missing.push(...expanded.missing);
  if (fieldClass === "remote") {
    names.blanked.push(...expanded.withheld.filter(({ set }) => set).map(({ name }) => name));
  }

  return encoder.expanded(expanded.segments, secret, ctx.env);
}

/** Copies each key with `safeSet`, so a `__proto__` key stays an own key (WR-01). */
function mappedStrings(
  record: Readonly<Record<string, unknown>>,
  write: (key: string, raw: string) => string,
): Record<string, unknown> {
  const written: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    safeSet(written, key, typeof value === "string" ? write(key, value) : value);
  }

  return written;
}

function writtenEnvValue(key: string, raw: string, walk: WalkState): string {
  return LITERAL_ENV_KEYS.has(key)
    ? walk.encoder.literal(raw, true)
    : expandedValue(raw, "plain", true, walk);
}

function writtenField(field: string, value: unknown, walk: WalkState): unknown {
  switch (field) {
    case "command":
      return typeof value === "string" ? expandedValue(value, "plain", false, walk) : value;
    case "url":
      return typeof value === "string" ? expandedValue(value, "remote", false, walk) : value;
    case "args":
      return Array.isArray(value)
        ? value.map((arg: unknown) =>
            typeof arg === "string" ? expandedValue(arg, "plain", false, walk) : arg,
          )
        : value;
    case "env":
      return isPlainObject(value)
        ? mappedStrings(value, (key, raw) => writtenEnvValue(key, raw, walk))
        : value;
    case "headers":
      return isPlainObject(value)
        ? mappedStrings(value, (_key, raw) => expandedValue(raw, "remote", true, walk))
        : value;
    case "oauth":
      return isPlainObject(value)
        ? mappedStrings(value, (_key, raw) => walk.encoder.literal(raw, false))
        : value;
    default:
      return value;
  }
}

/**
 * MENV-01/02: a stdio entry (a string `command`) gets the injected env first
 * and its declared env spread over it, so declared keys win (Claude Code
 * spread order). `env` sits after `command` and `args`, where the closed table
 * writes it. A remote entry never gains an env.
 *
 * AVAR-01: Claude Code injects only `CLAUDE_PLUGIN_ROOT` and
 * `CLAUDE_PLUGIN_DATA`. MENV-03 is satisfied by inheritance:
 * `CLAUDE_PROJECT_DIR` reaches every MCP child through Pi's process, where
 * `applyMcpAdapterEnv` sets it.
 */
function withInjectedEnv(
  translated: Readonly<Record<string, unknown>>,
  ctx: McpSubstitutionContext,
): Readonly<Record<string, unknown>> {
  if (typeof translated.command !== "string") {
    return translated;
  }

  const { command, args, env, ...rest } = translated;
  const injected: Record<string, string> = {
    CLAUDE_PLUGIN_ROOT: ctx.pluginRoot,
    CLAUDE_PLUGIN_DATA: ctx.pluginData,
  };
  return {
    command,
    ...(Object.hasOwn(translated, "args") ? { args } : {}),
    env: { ...injected, ...(isPlainObject(env) ? env : {}) },
    ...rest,
  };
}

/**
 * Injects the stdio env, then writes Claude's five expansion fields of one
 * translated entry, in entry order: `command`, `args`, `env`, then `url`,
 * `headers`, each through `encoder`. The report lists the unset variables
 * with no default, and the set deny-listed variables blanked in `url` and
 * `headers`, once each in that order. Returns a fresh entry; the input is
 * never mutated. Every caller names its encoder, pi-mcp-adapter's or Pi's
 * built-in one, so no path writes one implementation's encoding by omission
 * (P2-DC-53).
 */
export function substituteAndInject(
  translated: Readonly<Record<string, unknown>>,
  ctx: McpSubstitutionContext,
  encoder: McpFieldEncoder,
): SubstitutedEntry {
  const walk: WalkState = { ctx, encoder, names: { missing: [], blanked: [] } };
  const entry: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(withInjectedEnv(translated, ctx))) {
    safeSet(entry, field, writtenField(field, value, walk));
  }

  const { missing, blanked } = walk.names;
  return { entry, report: { missing: [...new Set(missing)], blanked: [...new Set(blanked)] } };
}
