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

import type { CompiledBashGlob, CompiledPathGlob } from "./glob.ts";
import type { PiToolName } from "../../../domain/components/hook-tool-names.ts";

export type { CompiledBashGlob, CompiledPathGlob, GlobToken, PathAnchor } from "./glob.ts";
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
