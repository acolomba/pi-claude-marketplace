// bridges/mcp/substitute.ts
//
// Expands Claude Code's variables in one translated MCP entry and injects the
// stdio env (MENV-01..03, AVAR-01..03, AVAR-05). The entry comes from the
// closed table in `domain/mcp-server-features.ts`, so it holds only fields
// Claude reads. Claude expands five of them: stdio `command`, `args` elements
// and `env` values, which use the plain deny-list, and remote `url` and
// `headers` values, which use the remote-sink deny-list. Each goes through
// Claude's rule in `domain/claude-mcp-variables.ts` and is written in
// pi-mcp-adapter's encoding by `adapter-escape.ts`. The `env` values under
// `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` and every `oauth` value are
// written as literal text. Every other field, every key and every non-string
// value is copied unchanged. Bridge-local by design: shared/vars.ts owns
// content substitution, a different variable set.

import { expandClaudeValue } from "../../domain/claude-mcp-variables.ts";

import { serializeLiteral, serializeSegments } from "./adapter-escape.ts";
import { isPlainObject } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type { ClaudeBuiltins, ClaudeEnv, FieldClass } from "../../domain/claude-mcp-variables.ts";

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
  ctx: McpSubstitutionContext,
  secret: boolean,
  names: ReportNames,
): string {
  const expanded = expandClaudeValue(raw, fieldClass, ctx.env, ctx);
  names.missing.push(...expanded.missing);
  if (fieldClass === "remote") {
    names.blanked.push(...expanded.withheld.filter(({ set }) => set).map(({ name }) => name));
  }

  return serializeSegments(expanded.segments, secret);
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

function writtenEnvValue(
  key: string,
  raw: string,
  ctx: McpSubstitutionContext,
  names: ReportNames,
): string {
  return LITERAL_ENV_KEYS.has(key)
    ? serializeLiteral(raw, true)
    : expandedValue(raw, "plain", ctx, true, names);
}

function writtenField(
  field: string,
  value: unknown,
  ctx: McpSubstitutionContext,
  names: ReportNames,
): unknown {
  switch (field) {
    case "command":
      return typeof value === "string" ? expandedValue(value, "plain", ctx, false, names) : value;
    case "url":
      return typeof value === "string" ? expandedValue(value, "remote", ctx, false, names) : value;
    case "args":
      return Array.isArray(value)
        ? value.map((arg: unknown) =>
            typeof arg === "string" ? expandedValue(arg, "plain", ctx, false, names) : arg,
          )
        : value;
    case "env":
      return isPlainObject(value)
        ? mappedStrings(value, (key, raw) => writtenEnvValue(key, raw, ctx, names))
        : value;
    case "headers":
      return isPlainObject(value)
        ? mappedStrings(value, (_key, raw) => expandedValue(raw, "remote", ctx, true, names))
        : value;
    case "oauth":
      return isPlainObject(value)
        ? mappedStrings(value, (_key, raw) => serializeLiteral(raw, false))
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
 * `headers`. The report lists the unset variables with no default, and the
 * set deny-listed variables blanked in `url` and `headers`, once each in that
 * order. Returns a fresh entry; the input is never mutated.
 */
export function substituteAndInject(
  translated: Readonly<Record<string, unknown>>,
  ctx: McpSubstitutionContext,
): SubstitutedEntry {
  const names: ReportNames = { missing: [], blanked: [] };
  const entry: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(withInjectedEnv(translated, ctx))) {
    safeSet(entry, field, writtenField(field, value, ctx, names));
  }

  return {
    entry,
    report: { missing: [...new Set(names.missing)], blanked: [...new Set(names.blanked)] },
  };
}
