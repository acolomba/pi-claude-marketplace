// bridges/hooks/if-field/index.ts
//
// MATCH-03 public surface for the `if`-field permission-rule matcher.
// Exports the `IfPredicate` discriminated union, the `MATCH_ALL_IF`
// fall-open sentinel, the parse-time compile (`compileIfPredicate`) and
// the dispatch-time consult (`ifFires`), and re-exports the glob +
// command-parser compile-time primitives from `./glob.ts`, `./bash.ts`,
// and `./powershell.ts`.
//
// D-61-02: every `if`-layer failure mode falls open to `MATCH_ALL_IF`
// (`{ kind: "match-all" }`). The sentinel exists so the dispatch path
// observes a uniformly-shaped predicate on every routing entry; absent
// or malformed `if` fields are normalized to `MATCH_ALL_IF` at parse
// time. The always-present-with-sentinel stance keeps the dispatch
// switch total and lets `assertNever` enforce NFR-7 exhaustiveness
// without an `undefined` arm.
//
// NFR-7: the `IfPredicate` union has six arms; any switch over
// `predicate.kind` must either cover every arm or terminate with
// `assertNever(predicate)`. Adding a seventh arm without updating the
// dispatch switch red-fails `npm run typecheck`.
//
// Fail-open contract recap (D-61-02):
//   - Unknown rule prefix (`Cd(...)`, typos)                -> MATCH_ALL_IF
//   - Malformed permission-rule syntax (`Bash(`)            -> MATCH_ALL_IF
//   - Runtime shell command unparseable                     -> dispatch fires
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

import path from "node:path";

import { TOOL_EVENTS, type BucketAEvent } from "../../../domain/components/hook-events.ts";
import { IF_PREFIX_TARGETS } from "../../../domain/components/hook-if-targets.ts";
import { hookDebugLog } from "../../../shared/debug-log.ts";
import { errorMessage } from "../../../shared/errors.ts";
import { assertNever } from "../exec-result.ts";

import { bashSubcommandFires, parseBashSubcommands } from "./bash.ts";
import { compileBashGlob, compilePathGlob } from "./glob.ts";
import {
  compilePowerShellRule,
  parsePowerShellSubcommands,
  powerShellSubcommandFires,
} from "./powershell.ts";

import type { ParseResult } from "./bash.ts";
import type { CompiledBashGlob, CompiledPathGlob, CompiledPowerShellGlob } from "./glob.ts";
import type { PiToolName } from "../../../domain/components/hook-tool-names.ts";
import type { ExtensionContext } from "../../../platform/pi-api.ts";

export type { CompiledBashGlob, CompiledPathGlob, CompiledPowerShellGlob } from "./glob.ts";
export { compileBashGlob, compilePathGlob, compilePowerShellGlob } from "./glob.ts";

export { parseBashSubcommands, bashSubcommandFires } from "./bash.ts";
export {
  compilePowerShellRule,
  parsePowerShellSubcommands,
  powerShellSubcommandFires,
} from "./powershell.ts";

// ──────────────────────────────────────────────────────────────────────────
// IfPredicate discriminated union
// ──────────────────────────────────────────────────────────────────────────

/**
 * Six-arm discriminated union representing a parsed `if` field. Stored
 * on the `RoutingEntry` (always present after compile; fall-open sentinel
 * for absent or malformed `if` strings). The dispatch consult switches
 * on `predicate.kind`:
 *
 *   - `match-all`         -- fire unconditionally. The `reason` field
 *                            captures fall-open context for
 *                            `hookDebugLog`.
 *   - `bash`              -- check whether `event.toolName` is in the
 *                            `piEvents` set, then consult
 *                            `bashGlob.test(subcmd)` against every parsed
 *                            subcommand of `event.input.command`.
 *   - `powershell`        -- the same two steps against `psGlob` and the
 *                            PowerShell subcommand parser (HKPS-01). The
 *                            `piEvents` guard on both command-bearing arms
 *                            is what keeps a `Bash(...)` rule from firing
 *                            on a `powershell` event and vice versa, since
 *                            both read `input.command`.
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
  | {
      readonly kind: "bash";
      readonly piEvents: ReadonlySet<PiToolName>;
      readonly bashGlob: CompiledBashGlob;
    }
  | {
      readonly kind: "powershell";
      readonly piEvents: ReadonlySet<PiToolName>;
      readonly psGlob: CompiledPowerShellGlob;
    }
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
const IF_PREFIX_REGEX = /^([A-Za-z_]\w*)\((.*)\)$/;

/**
 * MCP segment shape: a single non-empty character class run. Anchored
 * + bounded so a single linear scan decides the question (no
 * backtracking).
 */
const IF_MCP_SEGMENT_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Match an `mcp__<server>__<tool>` literal (`mcp__` prefix, two
 * non-empty `[A-Za-z0-9_-]+` segments separated by `__`). Split-based
 * to sidestep the regex backtracking that
 * `/^mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_-]+$/` would have on inputs like
 * `mcp__aaaa` (super-linear in the input length per S5852).
 */
function matchMcpLiteral(raw: string): boolean {
  if (!raw.startsWith("mcp__")) {
    return false;
  }

  const body = raw.slice("mcp__".length);
  const sepIdx = body.lastIndexOf("__");
  if (sepIdx <= 0 || sepIdx >= body.length - 2) {
    return false;
  }

  return (
    IF_MCP_SEGMENT_REGEX.test(body.slice(0, sepIdx)) &&
    IF_MCP_SEGMENT_REGEX.test(body.slice(sepIdx + 2))
  );
}

/**
 * Match an MCP server-prefix form: either bare `mcp__<server>` (no
 * trailing segment) or explicit `mcp__<server>__*`. Returns the server
 * segment on success or undefined. Split-based for the same
 * backtracking-avoidance reason as `matchMcpLiteral`.
 */
function matchMcpServerPrefix(raw: string): string | undefined {
  if (!raw.startsWith("mcp__")) {
    return undefined;
  }

  const body = raw.slice("mcp__".length);
  const server = body.endsWith("__*") ? body.slice(0, -3) : body;
  if (server.length === 0 || !IF_MCP_SEGMENT_REGEX.test(server)) {
    return undefined;
  }

  return server;
}

const TOOL_EVENT_MEMBERS_FOR_IF = new Set<string>(TOOL_EVENTS);

/**
 * MATCH-03 parse-time entry. Pure and total: every failure path
 * collapses to MATCH_ALL_IF and emits a `hookDebugLog` warning. The
 * function NEVER throws past its return type.
 *
 * Six compile paths, each guarded so a downstream compile throw
 * (broken glob, malformed command syntax) still falls open:
 *
 *   - empty after trim                       -> MATCH_ALL_IF
 *   - non-tool event (A5 disposition)        -> MATCH_ALL_IF
 *   - `mcp__<server>__<tool>` literal         -> mcp-literal predicate
 *   - `mcp__<server>` or `mcp__<server>__*`   -> mcp-server-prefix
 *   - `<Prefix>(<inner>)` with known Prefix  -> bash / powershell /
 *                                               path-tool
 *   - any miss (unknown prefix, malformed)   -> MATCH_ALL_IF
 *
 * The closed prefix set is exactly `Bash` / `PowerShell` / `Read` /
 * `Edit` / `Write` (D-61-03, HKPS-01); `Grep` / `Glob` / `LS` /
 * `MultiEdit` / `NotebookEdit` / `WebFetch` / `Agent` / `Cd` / typos all
 * fall open per D-61-02. Upstream's cross-tool semantic ("Read covers all
 * built-in readers; Edit covers all built-in editors") is encoded in
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

  if (matchMcpLiteral(trimmed)) {
    return { kind: "mcp-literal", toolName: trimmed };
  }

  const mcpServer = matchMcpServerPrefix(trimmed);
  if (mcpServer !== undefined) {
    return { kind: "mcp-server-prefix", serverPrefix: `mcp__${mcpServer}__` };
  }

  hookDebugLog(`compileIfPredicate: unrecognized if shape "${trimmed}"; falling open`);
  return MATCH_ALL_IF;
}

/**
 * Per-prefix compile dispatch. Each arm wraps the underlying glob
 * compile so a malformed inner still collapses to MATCH_ALL_IF
 * (D-61-02). Unknown prefixes (`Grep`, `Glob`, `LS`, `Cd`, ...) fall open
 * silently.
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
      return { kind: "bash", piEvents: IF_PREFIX_TARGETS.Bash.piEvents, bashGlob };
    } catch (err) {
      hookDebugLog(
        `compileIfPredicate: Bash glob compile failed for "${raw}": ${errorMessage(err)}; falling open`,
      );
      return MATCH_ALL_IF;
    }
  }

  if (prefix === "PowerShell") {
    try {
      const psGlob = compilePowerShellRule(inner);
      return { kind: "powershell", piEvents: IF_PREFIX_TARGETS.PowerShell.piEvents, psGlob };
    } catch (err) {
      hookDebugLog(
        `compileIfPredicate: PowerShell glob compile failed for "${raw}": ${errorMessage(err)}; falling open`,
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

// ──────────────────────────────────────────────────────────────────────────
// Dispatch-time consult (MATCH-03 / D-61-02 / D-61-03 / D-61-04)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-event input extractors. Read shape-fragile fields off the runtime
 * Pi event payload without throwing on malformed input. Each helper
 * returns string-or-undefined; the `ifFires` switch arms handle the
 * undefined arm explicitly per the D-61-02 fail-open contract and the
 * D-61-03 substitute-cwd rule.
 *
 * The narrow `(event as { ... }).input?.X` shape is deliberate: typing
 * against the full Pi `ToolCallEvent`/`ToolResultEvent` union would
 * require importing every per-event payload variant just to read one
 * field; the extractor's job is bounded to "pluck the field if present;
 * say undefined otherwise".
 */

function extractCommand(event: unknown): string | undefined {
  const cmd = (event as { input?: { command?: unknown } }).input?.command;
  return typeof cmd === "string" ? cmd : undefined;
}

/**
 * Returns `event.toolName` when it is a string, `""` otherwise.
 *
 * The empty-string coercion is fail-CLOSED by design: every downstream
 * check (`piEvents` membership for the `bash`, `powershell`, and
 * `path-tool` arms, literal equality for the `mcp-literal` arm,
 * `startsWith` for the `mcp-server-prefix` arm) rejects the empty string.
 * A malformed event payload missing `toolName` therefore matches no
 * predicate arm that reads a tool name, which is the desired safe
 * default.
 */
function extractToolName(event: unknown): string {
  const name = (event as { toolName?: unknown }).toolName;
  return typeof name === "string" ? name : "";
}

function extractPath(event: unknown): string | undefined {
  const p = (event as { input?: { path?: unknown } }).input?.path;
  return typeof p === "string" ? p : undefined;
}

/**
 * The per-shell collaborators the shared command-arm body needs: the
 * predicate's own `piEvents` set, the shell name used in the fall-open
 * debug line, the subcommand parser, and the compiled-glob matcher with
 * its glob already bound.
 */
interface CommandArm {
  readonly piEvents: ReadonlySet<PiToolName>;
  readonly shell: string;
  parse(command: string): ParseResult;
  fires(subcommand: string, hasInterpolation: boolean): boolean;
}

/**
 * Shared dispatch body for the two command-bearing predicate arms.
 *
 * Guards `event.toolName` against the predicate's own `piEvents` set
 * BEFORE reading `input.command`: `Bash(...)` and `PowerShell(...)` both
 * read that one field, so without the guard a rule written for one shell
 * would fire on the other's events. Then extracts the command (absent ->
 * no match), parses it (unparseable -> `hookDebugLog` + fire, the
 * D-61-04 fail-open), and returns true on the first subcommand that
 * fires.
 */
function commandArmFires(arm: CommandArm, event: unknown): boolean {
  if (!arm.piEvents.has(extractToolName(event) as PiToolName)) {
    return false;
  }

  const command = extractCommand(event);
  if (command === undefined) {
    return false;
  }

  const parsed = arm.parse(command);
  if (!parsed.ok) {
    hookDebugLog(`ifFires: ${arm.shell} unparseable: ${parsed.reason}; firing`);
    return true;
  }

  return parsed.subcommands.some((subcommand) => arm.fires(subcommand, parsed.hasInterpolation));
}

/**
 * D-61-03 substitute-cwd helper: if the runtime path is relative, resolve
 * it against `ctx.cwd`. Absolute paths are normalized in place. No
 * `fs.realpath` -- pure string comparison only (RESEARCH T-61-05 note:
 * symlink resolution at dispatch time would add I/O cost and surface
 * race conditions).
 */
function resolveTarget(p: string, ctx: ExtensionContext): string {
  if (path.isAbsolute(p)) {
    return path.normalize(p);
  }

  return path.resolve(ctx.cwd, p);
}

/**
 * MATCH-03 dispatch-time consult. Returns true iff the routing entry's
 * `if` field permits dispatch for the current event. Total switch over
 * `IfPredicate.kind` with `assertNever` exhaustiveness (NFR-7).
 *
 * Per-arm contract:
 *
 *   - `match-all` -- always fires (fall-open sentinel).
 *   - `bash` -- guard `event.toolName` against the predicate's `piEvents`
 *     set and return false on a miss; extract `event.input.command`; if
 *     absent return false (no command to match); parse subcommands; on
 *     parse failure `hookDebugLog` + return true (D-61-04 fail-open); on
 *     parse success match every subcommand against `bashGlob` and return
 *     true on the first hit (with `bashSubcommandFires` applying the
 *     specificity-override branch on `$()`/backticks/`$VAR`).
 *   - `powershell` -- the same sequence against `psGlob`, the PowerShell
 *     subcommand parser, and `powerShellSubcommandFires` (HKPS-01). Both
 *     command-bearing arms guard `toolName` first because both read
 *     `input.command`; without the guard a `Bash(...)` rule would fire on
 *     a `powershell` event.
 *   - `path-tool` -- guard `event.toolName` against the predicate's
 *     `piEvents` set (defensive; the matcher gate already filters by
 *     event kind, but the closed-set membership check keeps the path
 *     extractor's substitute-cwd semantic correctly anchored). If the
 *     event carries no `input.path` (Pi grep/find/ls optional-path
 *     tools), substitute `ctx.cwd` per D-61-03. Resolve relative inputs
 *     against `ctx.cwd` and call `pathGlob.testAbsolute`.
 *   - `mcp-literal` -- exact equality on `event.toolName`.
 *   - `mcp-server-prefix` -- prefix probe via `startsWith`.
 *
 * `claudeEvent` is accepted for symmetry with `compileIfPredicate` (the
 * parse-time entry rejects `if` on non-tool events by compiling them to
 * `MATCH_ALL_IF`, so a non-tool entry reaching this consult is already
 * the fall-open sentinel). Reserved for forward-compat against future
 * per-event nuance.
 */
export function ifFires(
  predicate: IfPredicate,
  event: unknown,
  ctx: ExtensionContext,
  _claudeEvent: BucketAEvent,
): boolean {
  switch (predicate.kind) {
    case "match-all":
      return true;

    case "bash":
      return commandArmFires(
        {
          piEvents: predicate.piEvents,
          shell: "Bash",
          parse: parseBashSubcommands,
          fires: (subcommand, hasInterpolation) =>
            bashSubcommandFires(predicate.bashGlob, subcommand, hasInterpolation),
        },
        event,
      );

    case "powershell":
      return commandArmFires(
        {
          piEvents: predicate.piEvents,
          shell: "PowerShell",
          parse: parsePowerShellSubcommands,
          fires: (subcommand, hasInterpolation) =>
            powerShellSubcommandFires(predicate.psGlob, subcommand, hasInterpolation),
        },
        event,
      );

    case "path-tool": {
      const toolName = extractToolName(event);
      if (!predicate.piEvents.has(toolName as PiToolName)) {
        return false;
      }

      const rawPath = extractPath(event) ?? ctx.cwd;
      return predicate.pathGlob.testAbsolute(resolveTarget(rawPath, ctx));
    }

    case "mcp-literal":
      return extractToolName(event) === predicate.toolName;

    case "mcp-server-prefix":
      return extractToolName(event).startsWith(predicate.serverPrefix);

    default:
      return assertNever(predicate);
  }
}
