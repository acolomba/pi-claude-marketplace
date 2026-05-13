// presentation/reload-hint.ts
//
// RH-1, RH-2 reload-hint composition. Pure string functions -- no IO,
// no ctx parameter. The orchestrator layer decides WHEN to call this
// (RH-1 gate: only when generated resources changed); this file is
// the WHAT (the format string).
//
// ES-5 stable contract: the prefix `Run /reload to ` is sourced from
// shared/markers.ts (the markers-snapshot test enforces byte-equality
// with PRD §6.12). Inlining the literal is forbidden; if the PRD
// contract changes, the constant changes and this composer follows.

import { RELOAD_HINT_PREFIX } from "../shared/markers.ts";

/** RH-2 verb table: the only three legal verbs. */
export type ReloadVerb = "load" | "refresh" | "drop";

/**
 * RH-1 / RH-2: render the reload hint or "" when no hint is needed.
 *
 *   - 0 names: ""           (RH-1: no hint when no resources changed)
 *   - 1 name:  "Run /reload to <verb> it."
 *   - N names: 'Run /reload to <verb> "n1", "n2".'
 *
 * Caller responsibility: pass non-empty names ONLY when generated
 * resources actually changed (RH-1 gate). This function trusts its
 * input and renders mechanically.
 */
export function reloadHint(verb: ReloadVerb, names: readonly string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length === 1) {
    return `${RELOAD_HINT_PREFIX}${verb} it.`;
  }

  const quotedNames = names.map((n) => `"${n}"`).join(", ");
  return `${RELOAD_HINT_PREFIX}${verb} ${quotedNames}.`;
}

/**
 * Append `hint` to `body` on its own trailing line. When `hint === ""`
 * (RH-1 suppression), returns the bare body. Used by every orchestrator
 * that may emit a reload hint -- keeps the join logic centralized.
 */
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
