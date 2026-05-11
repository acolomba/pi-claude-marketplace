// shared/markers.ts
//
// PRD §6.12 ES-5 user-contract strings ("gitlint-grade"). DO NOT EDIT
// without updating docs/prd/pi-claude-marketplace-prd.md §6.12 in the same
// commit. The snapshot test at tests/architecture/markers-snapshot.test.ts
// reads the PRD at runtime and asserts these constants are byte-for-byte
// prefixes of the PRD literals (everything up to the first `<` or `…`).

export const PI_SUBAGENTS_NOT_LOADED = "pi-subagents is not loaded; ";
export const PI_MCP_ADAPTER_NOT_LOADED = "pi-mcp-adapter is not loaded; ";
export const RELOAD_HINT_PREFIX = "Run /reload to ";
export const MANUAL_RECOVERY_REQUIRED = "MANUAL RECOVERY REQUIRED: ";
export const ROLLBACK_PARTIAL = "(rollback partial: ";

/**
 * PUP-6 recovery hint (Phase 5 extension beyond ES-5).
 *
 * Stable user-contract prefix. The runtime caller in
 * `orchestrators/plugin/update.ts` appends ` "${pluginName}".` after this
 * prefix to compose the final user-visible hint. This constant is NOT a
 * member of the original ES-5 enum (which lists pi-subagents /
 * pi-mcp-adapter / reload-hint / manual-recovery / rollback-partial only);
 * it is a Phase 5 extension to the markers surface, drift-guarded by
 * tests/architecture/markers-snapshot.test.ts.
 */
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";

/**
 * D-08 state-lock contention prefix (Phase 7 extension beyond ES-5).
 *
 * Stable user-contract prefix. The transaction layer appends the scope and
 * lock path when a second process attempts to mutate the same scope while a
 * `withStateGuard` lock is already held. This constant is NOT a member of
 * the original ES-5 enum; it is a Phase 7 extension to the markers surface,
 * drift-guarded by tests/architecture/markers-snapshot.test.ts.
 */
export const STATE_LOCK_HELD_PREFIX = "Another claude-marketplace operation is in progress for";
