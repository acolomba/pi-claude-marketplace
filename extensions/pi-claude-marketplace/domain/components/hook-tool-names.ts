// domain/components/hook-tool-names.ts
//
// TOOL-01 bidirectional Claude <-> Pi tool-name map and the derived
// `PiToolName` / `ClaudeToolName` literal unions. This module is the
// source of truth the matcher parser reads at parse time to translate
// Claude-form matcher tokens (`Edit`, `Bash`, `Glob`, ...) into the
// Pi-form `event.toolName` literals (`edit`, `bash`, `find`, ...) the
// dispatcher compares against, and the inverse map future payload
// translators will read at dispatch time to translate Pi-form events
// back into Claude-form `tool_name` fields.
//
// D-58-04: the file lives at `domain/components/hook-tool-names.ts`
// (NOT at `bridges/hooks/tool-names.ts`) because the table is a
// domain-tier static contract -- pure data, no I/O, no bridge wiring.
//
// D-58-04: the LOAD-BEARING compile-time gate is
// `PI_TO_CLAUDE_TOOL_NAMES satisfies Record<PiToolName, string>` where
// `PiToolName = Exclude<ToolCallEvent["toolName"], string>` drops the
// `CustomToolCallEvent` open-ended `string` arm and leaves only the
// seven literal Pi tool names. Adding an eighth Pi tool literal to the
// peer-dep `@earendil-works/pi-coding-agent` `ToolCallEvent` union
// without adding a matching entry here red-fails `npm run typecheck`.
//
// D-58-05: the `find <-> Glob` mapping is locked even though the two
// semantics diverge (Pi `find` is Unix-find-style; Claude `Glob` is a
// glob-pattern file-finder). LOW-confidence semantic mismatch is
// accepted for v1.13 because Glob is the closest Claude-form analogue
// to Pi `find` and leaving the entry out would silently drop Glob
// matchers at parse time.
//
// The reverse map `CLAUDE_TO_PI_TOOL_NAMES` is hand-written rather than
// computed from `PI_TO_CLAUDE_TOOL_NAMES` so the architecture test can
// type-check the reverse-direction literal shape (a computed reverse
// would erase to `Record<string, PiToolName>` and lose the locked
// `ClaudeToolName` keys).

import type { ToolCallEvent } from "../../platform/pi-api.ts";

/**
 * The seven Pi-form tool-name literals, derived from the peer-dep
 * `ToolCallEvent` discriminated union by filtering out the
 * `CustomToolCallEvent` arm (the one whose `toolName` is the open-ended
 * `string` type). The literal arms (`bash` | `read` | `edit` | `write`
 * | `grep` | `find` | `ls`) remain.
 *
 * D-58-04: a naive `Exclude<ToolCallEvent["toolName"], string>` would
 * evaluate to `never` because a union `"bash" | ... | string` collapses
 * to `string` at the property-access step. Walking the union arms via
 * `T extends { toolName: infer N }` with `string extends N` filtering
 * the `CustomToolCallEvent` arm preserves the literal `toolName` fields
 * on the seven specific arms.
 */
type LiteralToolNameArm<T> = T extends { toolName: infer N }
  ? string extends N
    ? never
    : N
  : never;
export type PiToolName = LiteralToolNameArm<ToolCallEvent>;

/**
 * Claude-form spelling of every Pi tool literal. Keys are the seven
 * lowercase Pi tool names; values are the Claude-form PascalCase /
 * uppercase spellings used in `hooks/hooks.json` matcher tokens and
 * Claude tool_call payloads.
 *
 * D-58-05: `find -> Glob` is the LOW-confidence mapping. Pi `find` is
 * Unix-find-style (path predicates, name globs, size/mtime filters);
 * Claude `Glob` is a glob-pattern file-finder. Glob is the closest
 * Claude-form analogue and the v1.13 mapping accepts the semantic
 * mismatch so Glob matchers translate into a Pi event the dispatcher
 * can fire on.
 *
 * The `satisfies Record<PiToolName, string>` annotation is the
 * load-bearing compile-time exhaustiveness gate -- removing any of the
 * seven entries red-fails `npm run typecheck`.
 */
export const PI_TO_CLAUDE_TOOL_NAMES = {
  bash: "Bash",
  read: "Read",
  edit: "Edit",
  write: "Write",
  grep: "Grep",
  // D-58-05: LOW-confidence semantic mismatch -- Pi `find` is
  // Unix-find-style, Claude `Glob` is a glob-pattern file-finder.
  // Accepted for v1.13.
  find: "Glob",
  ls: "LS",
} as const satisfies Record<PiToolName, string>;

/**
 * The seven Claude-form tool-name literals, derived from
 * `PI_TO_CLAUDE_TOOL_NAMES` value positions via the `CLAUDE_TO_PI_TOOL_NAMES`
 * key set. `Bash` | `Read` | `Edit` | `Write` | `Grep` | `Glob` | `LS`.
 */
export type ClaudeToolName = keyof typeof CLAUDE_TO_PI_TOOL_NAMES;

/**
 * Inverse of `PI_TO_CLAUDE_TOOL_NAMES`. Keys are the seven Claude-form
 * tool names; values are the corresponding Pi-form literals.
 *
 * Hand-written rather than computed from the forward map so the keys
 * type-check as the locked `ClaudeToolName` literal union. A computed
 * reverse (e.g. `Object.fromEntries(Object.entries(...).map(...))`)
 * would erase to `Record<string, PiToolName>`, dropping the literal
 * key information the architecture test relies on.
 */
export const CLAUDE_TO_PI_TOOL_NAMES = {
  Bash: "bash",
  Read: "read",
  Edit: "edit",
  Write: "write",
  Grep: "grep",
  // D-58-05: see `PI_TO_CLAUDE_TOOL_NAMES.find` -- accepted LOW-
  // confidence semantic mismatch in both directions.
  Glob: "find",
  LS: "ls",
} as const satisfies Record<string, PiToolName>;
