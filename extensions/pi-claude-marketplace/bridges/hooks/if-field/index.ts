// bridges/hooks/if-field/index.ts
//
// MATCH-03 public surface for the `if`-field permission-rule matcher.
// Exports the `IfPredicate` discriminated union, the `MATCH_ALL_IF`
// fall-open sentinel, and re-exports the glob + Bash-parser compile-time
// primitives from `./glob.ts` and `./bash.ts`. Dispatch-time consult
// (`ifFires`) and parse-time compile (`compileIfPredicate`) land in
// follow-up plans against this surface.
//
// D-61-02: every `if`-layer failure mode falls open to `MATCH_ALL_IF`
// (`{ kind: "match-all" }`). The sentinel exists so the dispatch path
// observes a uniformly-shaped predicate on every routing entry; absent
// or malformed `if` fields are normalized to `MATCH_ALL_IF` at parse
// time. The always-present-with-sentinel stance keeps the dispatch
// switch total and lets `assertNever` enforce NFR-7 exhaustiveness
// without an `undefined` arm.
//
// NFR-7: the `IfPredicate` union has five arms; any switch over
// `predicate.kind` must either cover every arm or terminate with
// `assertNever(predicate)`. Adding a sixth arm without updating the
// dispatch switch red-fails `npm run typecheck`.
//
// Fail-open contract recap (D-61-02):
//   - Unknown rule prefix (`PowerShell(...)`, typos)        -> MATCH_ALL_IF
//   - Malformed permission-rule syntax (`Bash(`)            -> MATCH_ALL_IF
//   - Runtime Bash command unparseable                      -> dispatch fires
//   - Missing path target on optional-path Pi tools         -> substitute cwd
//
// Plugins that work in upstream Claude Code install in Pi-Claude
// unchanged; the `if` field is documented as best-effort and never
// blocks installation.
//
// CompileIfPredicateContext (D-61-03 substitute-cwd rule + A1
// projectRoot fallback): the path-glob compiler consumes a homedir +
// cwd + projectRoot triple to anchor `~`-prefixed patterns, bare
// relative globs (`src/**`), and absolute project-root patterns
// (`/docs/**`). Pi's `ExtensionContext` v0.73.x exposes only `cwd`
// today; callers pass `ctx.cwd` as the `projectRoot` fallback so a
// future Pi version exposing a separate `projectRoot` field can wire
// it without renaming the type. Upstream Claude's permission engine
// follows the same "Grep / LS default to cwd internally" rationale,
// so this fallback preserves byte-for-byte upstream truth-table
// fidelity until a richer Pi context surfaces.

import { TOOL_EVENTS, type BucketAEvent } from "../../../domain/components/hook-events.ts";
import { IF_PREFIX_TARGETS } from "../../../domain/components/hook-if-targets.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";

import { compileBashGlob, compilePathGlob } from "./glob.ts";

import type { CompiledBashGlob, CompiledPathGlob } from "./glob.ts";
import type { PiToolName } from "../../../domain/components/hook-tool-names.ts";

export type {
  CompiledBashGlob,
  CompiledPathGlob,
  GlobToken,
  PathAnchor,
  PathAnchorContext,
} from "./glob.ts";
export { compileBashGlob, compilePathGlob } from "./glob.ts";

export type { ParseResult } from "./bash.ts";
export { parseBashSubcommands, bashSubcommandFires, WRAPPER_STRIP } from "./bash.ts";

// ──────────────────────────────────────────────────────────────────────────
// IfPredicate discriminated union
// ──────────────────────────────────────────────────────────────────────────

/**
 * Five-arm discriminated union representing a parsed `if` field. Stored
 * on the `RoutingEntry` (always present after compile; fall-open sentinel
 * for absent or malformed `if` strings). The dispatch consult switches
 * on `predicate.kind`:
 *
 *   - `match-all`         -- fire unconditionally. The `reason` field
 *                            captures fall-open context for
 *                            `hookDebugLog`.
 *   - `bash`              -- consult `bashGlob.test(subcmd)` against
 *                            every parsed subcommand of the runtime
 *                            `event.input.command`.
 *   - `path-tool`         -- check whether `event.toolName` is in the
 *                            cross-tool `piEvents` set, then consult
 *                            `pathGlob.testAbsolute(event.input.path
 *                            ?? ctx.cwd)`.
 *   - `mcp-literal`       -- exact equality on `event.toolName`.
 *   - `mcp-server-prefix` -- `event.toolName.startsWith(serverPrefix)`
 *                            where `serverPrefix` includes the trailing
 *                            `"__"` (e.g. `"mcp__puppeteer__"`).
 */
export type IfPredicate =
  | { readonly kind: "match-all"; readonly reason?: string }
  | { readonly kind: "bash"; readonly bashGlob: CompiledBashGlob }
  | {
      readonly kind: "path-tool";
      readonly piEvents: ReadonlySet<PiToolName>;
      readonly pathGlob: CompiledPathGlob;
    }
  | { readonly kind: "mcp-literal"; readonly toolName: string }
  | { readonly kind: "mcp-server-prefix"; readonly serverPrefix: string };

// ──────────────────────────────────────────────────────────────────────────
// Fall-open sentinel
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-61-02 fall-open sentinel. Returned by the parse-time compile path
 * whenever the `if` field is absent, structurally unparseable, or uses
 * an unsupported rule prefix. Dispatch reads this as "fire the hook
 * whenever the group `matcher` fires" -- equivalent to having no
 * `if` field at all in upstream Claude Code.
 */
export const MATCH_ALL_IF: IfPredicate = { kind: "match-all" };

// ──────────────────────────────────────────────────────────────────────────
// CompileIfPredicateContext (parse-time anchor triple)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Anchor context consumed by `compileIfPredicate` (parse-time entry in
 * `domain/components/hooks.ts`) and the underlying `compilePathGlob`.
 * The three fields drive `~`-prefix substitution (homedir),
 * cwd-anchored bare relative globs (cwd), and project-root-anchored
 * absolute patterns (projectRoot).
 *
 * D-61-03 substitute-cwd rule: when a Pi-side reader event
 * (`grep`/`find`/`ls`) carries no `input.path`, dispatch-time consult
 * substitutes `ctx.cwd` as the target path so a `Read(src/**)`
 * predicate still matches the implicit cwd-rooted scope upstream
 * documents.
 *
 * A1 projectRoot fallback: Pi's `ExtensionContext` v0.73.x has no
 * `projectRoot` field; production call sites pass `ctx.cwd` for both
 * `cwd` and `projectRoot` until a richer Pi surface exists.
 */
export interface CompileIfPredicateContext {
  readonly homedir: string;
  readonly cwd: string;
  readonly projectRoot: string;
}

// ──────────────────────────────────────────────────────────────────────────
// compileIfPredicate (D-61-02 / D-61-03 / D-61-04 fail-open + cross-tool)
// ──────────────────────────────────────────────────────────────────────────

/**
 * MATCH-03 permission-rule prefix shape:
 *   `<Prefix>(<inner>)`  e.g.  `Bash(git push *)` / `Read(src/**)`
 * Captures the prefix (group 1) and the inner pattern (group 2). Inner
 * may be empty -- `compileIfPredicate` rejects empty-inner forms via
 * the per-prefix compile attempt.
 */
const IF_PREFIX_REGEX = /^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/;

/**
 * MCP literal shape: exactly two `__`-segmented components after
 * `mcp__`. Segment-strict per the upstream `if`-field grammar.
 */
const IF_MCP_LITERAL_REGEX = /^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/;

/**
 * MCP server-prefix shape: either bare `mcp__server` (no trailing
 * segment) or explicit `mcp__server__*`. Captures the server segment
 * (group 1); the compiled predicate carries `mcp__${server}__` as the
 * startsWith probe.
 */
const IF_MCP_SERVER_PREFIX_REGEX = /^mcp__([A-Za-z0-9_-]+)(?:__\*)?$/;

const TOOL_EVENT_MEMBERS_FOR_IF = new Set<string>(TOOL_EVENTS);

/**
 * MATCH-03 parse-time entry. Pure and total: every failure path
 * collapses to MATCH_ALL_IF and emits a `hookDebugLog` warning. The
 * function NEVER throws past its return type.
 *
 * Five compile paths, each guarded so a downstream compile throw
 * (broken glob, malformed Bash syntax) still falls open:
 *
 *   - empty after trim                       -> MATCH_ALL_IF
 *   - non-tool event (A5 disposition)        -> MATCH_ALL_IF
 *   - `mcp__<server>__<tool>` literal         -> mcp-literal predicate
 *   - `mcp__<server>` or `mcp__<server>__*`   -> mcp-server-prefix
 *   - `<Prefix>(<inner>)` with known Prefix  -> bash / path-tool
 *   - any miss (unknown prefix, malformed)   -> MATCH_ALL_IF
 *
 * The closed prefix set is exactly `Bash` / `Read` / `Edit` / `Write`
 * (D-61-03); `Grep` / `Glob` / `LS` / `MultiEdit` / `NotebookEdit` /
 * `PowerShell` / `WebFetch` / `Agent` / `Cd` / typos all fall open per
 * D-61-02. Upstream's cross-tool semantic ("Read covers all built-in
 * readers; Edit covers all built-in editors") is encoded in
 * `IF_PREFIX_TARGETS`, so a `Read(src/**)` rule fires on Pi `read`,
 * `grep`, `find`, `ls` at dispatch time.
 */
export function compileIfPredicate(
  rawIf: string,
  claudeEvent: BucketAEvent,
  ctx: CompileIfPredicateContext,
): IfPredicate {
  const trimmed = rawIf.trim();
  if (trimmed.length === 0) {
    hookDebugLog(`compileIfPredicate: empty if value on ${claudeEvent}; falling open`);
    return MATCH_ALL_IF;
  }

  if (!TOOL_EVENT_MEMBERS_FOR_IF.has(claudeEvent)) {
    hookDebugLog(
      `compileIfPredicate: if value "${trimmed}" on non-tool event ${claudeEvent} is ignored; falling open`,
    );
    return MATCH_ALL_IF;
  }

  const prefixMatch = IF_PREFIX_REGEX.exec(trimmed);
  if (prefixMatch !== null) {
    return compileIfPrefixForm(trimmed, prefixMatch[1] ?? "", prefixMatch[2] ?? "", ctx);
  }

  if (IF_MCP_LITERAL_REGEX.test(trimmed)) {
    return { kind: "mcp-literal", toolName: trimmed };
  }

  const mcpServerMatch = IF_MCP_SERVER_PREFIX_REGEX.exec(trimmed);
  if (mcpServerMatch !== null) {
    const server = mcpServerMatch[1] ?? "";
    return { kind: "mcp-server-prefix", serverPrefix: `mcp__${server}__` };
  }

  hookDebugLog(`compileIfPredicate: unrecognized if shape "${trimmed}"; falling open`);
  return MATCH_ALL_IF;
}

/**
 * Per-prefix compile dispatch. Each arm wraps the underlying glob
 * compile so a malformed inner still collapses to MATCH_ALL_IF
 * (D-61-02). Unknown prefixes (`Grep`, `Glob`, `LS`, `PowerShell`, ...)
 * fall open silently.
 */
function compileIfPrefixForm(
  raw: string,
  prefix: string,
  inner: string,
  ctx: CompileIfPredicateContext,
): IfPredicate {
  if (prefix === "Bash") {
    try {
      const bashGlob = compileBashGlob(inner);
      return { kind: "bash", bashGlob };
    } catch (err) {
      hookDebugLog(
        `compileIfPredicate: Bash glob compile failed for "${raw}": ${errorMessage(err)}; falling open`,
      );
      return MATCH_ALL_IF;
    }
  }

  if (prefix === "Read" || prefix === "Edit" || prefix === "Write") {
    const target = IF_PREFIX_TARGETS[prefix];
    try {
      const pathGlob = compilePathGlob(inner, ctx);
      return { kind: "path-tool", piEvents: target.piEvents, pathGlob };
    } catch (err) {
      hookDebugLog(
        `compileIfPredicate: ${prefix} path glob compile failed for "${raw}": ${errorMessage(err)}; falling open`,
      );
      return MATCH_ALL_IF;
    }
  }

  hookDebugLog(`compileIfPredicate: unsupported prefix "${prefix}" in "${raw}"; falling open`);
  return MATCH_ALL_IF;
}
