// domain/components/hook-if-targets.ts
//
// MATCH-03 cross-tool mapping table: upstream Claude permission-rule
// prefix -> Pi event set + target field name. The `if`-field bridge reads
// this table at parse time to translate an `if` string like
// `"Read(src/**)"` into "fire on Pi events {read, grep, find, ls} when the
// event's `input.path` matches the path glob `src/**`".
//
// D-61-03: the five-entry closed set (Bash | PowerShell | Read | Edit |
// Write) is the upstream-faithful permission-rule prefix list. `Grep` /
// `Glob` / `LS` / `MultiEdit` / `NotebookEdit` are NOT upstream prefixes --
// they are covered by `Read` (readers) and `Edit` (editors) via upstream's
// cross-tool semantic ("Read rules apply to all built-in tools that read
// files like Grep and Glob" -- `code.claude.com/docs/en/permissions`). The
// `mcp__` family (literal / server-prefix) is handled separately at the
// `IfPredicate` discriminated-union layer because the matching semantic
// (`event.toolName`-based) differs from the path-and-command shape covered
// here.
//
// LOAD-BEARING GATE: the `as const satisfies Record<string, IfPrefixTarget>`
// clause is the compile-time exhaustiveness gate. Removing any of the five
// entries red-fails `npm run typecheck` because every entry in the
// constant must satisfy the `IfPrefixTarget` shape. Architecture-test
// introspection pins `Object.keys(IF_PREFIX_TARGETS)` to the exact tuple
// in locked order; adding a sixth entry without amending the test fails CI.
//
// Sibling to `hook-tool-names.ts` (TOOL-01) -- both files are pure-data
// closed-set lookup tables in the domain tier. Kept separate because the
// cross-tool semantic (Read covers Pi readers; Edit covers Pi editors) is
// unique to the `if`-field layer; the TOOL-01 forward/reverse maps are
// one-to-one bridging seams for the matcher parser and payload translators.

import type { PiToolName } from "./hook-tool-names.ts";

// ──────────────────────────────────────────────────────────────────────────
// IfPrefixTarget shape
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-prefix dispatch metadata. `piEvents` is the closed set of Pi tool-
 * event names this rule-prefix covers (Pi-form lowercase); `extractTarget`
 * indicates which field on the runtime event the predicate consults.
 *
 *   - `"command"` -- read `input.command` off the Pi shell tool-call event
 *                    (`bash` for `Bash`, `powershell` for `PowerShell`).
 *   - `"path"`    -- read `<reader|writer>ToolCallEvent.input.path`,
 *                    substituting `ctx.cwd` when the field is absent on
 *                    Pi's optional-path tools (grep/find/ls).
 *   - `"toolName"` -- read `event.toolName` directly (reserved for the
 *                     MCP discriminated arms; not used by any entry in
 *                     `IF_PREFIX_TARGETS` because the MCP family is
 *                     handled at the predicate-kind layer).
 */
interface IfPrefixTarget {
  readonly piEvents: ReadonlySet<PiToolName>;
  readonly extractTarget: "path" | "command" | "toolName";
}

// ──────────────────────────────────────────────────────────────────────────
// IF_PREFIX_TARGETS closed-set table
// ──────────────────────────────────────────────────────────────────────────

/**
 * D-61-03 upstream-faithful prefix -> Pi-event-set mapping. The five keys
 * are the exact upstream permission-rule prefix tokens documented at
 * `code.claude.com/docs/en/permissions` § "Bash" / § "PowerShell" /
 * § "Read and Edit". The key order is locked (matches the architecture-test
 * introspection); the `piEvents` sets capture upstream's cross-tool
 * semantic:
 *
 *   - `Bash`       fires on Pi `bash`.
 *   - `PowerShell` fires on Pi `powershell` (HKPS-01; upstream documents
 *                  `PowerShell(...)` rules as sharing the `Bash(...)` shape
 *                  over PowerShell command text).
 *   - `Read`       fires on Pi `read`, `grep`, `find`, `ls` (upstream "Read
 *                  rules apply to all built-in tools that read files").
 *   - `Edit`       fires on Pi `edit`, `write` (upstream "Edit rules apply
 *                  to all built-in tools that edit files").
 *   - `Write`      fires on Pi `write` only (upstream Write is narrower
 *                  than Edit and does not cover edits).
 *
 * `Bash` and `PowerShell` are the two command-bearing prefixes and both
 * read `input.command`, so each predicate carries its own `piEvents` set
 * and the dispatch consult checks membership before reading the field.
 */
export const IF_PREFIX_TARGETS = {
  Bash: {
    piEvents: new Set<PiToolName>(["bash"]),
    extractTarget: "command",
  },
  PowerShell: {
    piEvents: new Set<PiToolName>(["powershell"]),
    extractTarget: "command",
  },
  Read: {
    piEvents: new Set<PiToolName>(["read", "grep", "find", "ls"]),
    extractTarget: "path",
  },
  Edit: {
    piEvents: new Set<PiToolName>(["edit", "write"]),
    extractTarget: "path",
  },
  Write: {
    piEvents: new Set<PiToolName>(["write"]),
    extractTarget: "path",
  },
} as const satisfies Record<string, IfPrefixTarget>;
