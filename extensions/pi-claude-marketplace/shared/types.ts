// shared/types.ts
//
// Cross-tier types shared across domain/, persistence/, transaction/, and
// edge/ (Phase 6). Lives in shared/ so edge/ can import without crossing
// the D-11 import boundary (edge/ MUST NOT import from domain/).
//
// Per Phase 1 SUMMARY handoff item #1 + SC-1 (PRD §6.2): exactly two
// scopes -- `user` (Pi agent dir; defaults to ~/.pi/agent and honors
// PI_CODING_AGENT_DIR) and `project` (<cwd>/.pi). The Claude Code `local`
// scope is intentionally NOT introduced.

/**
 * The two extension scopes (SC-1).
 * - `user`:    `<Pi agent dir>/pi-claude-marketplace/`
 * - `project`: `<cwd>/.pi/pi-claude-marketplace/`
 */
export type Scope = "user" | "project";

/** Compile-time tuple of every Scope value -- useful for tab completion (Phase 6). */
export const SCOPES: readonly Scope[] = ["user", "project"] as const;
