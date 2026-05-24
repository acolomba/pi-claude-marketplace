// shared/markers.ts
//
// Phase-extension user-contract prefixes (PUP-6, D-08). The original V1
// PRD §6.12 ES-5 marker strings have been superseded by the v1.3 universal
// compact-line grammar; the supersession is documented in
// docs/messaging-style-guide.md §15 (Supersession of ES-5) per D-13-11.
// The Phase 5/7 extension markers below are NOT part of ES-5 and remain
// the canonical user-contract prefixes for their respective surfaces.
// They are drift-guarded by tests/architecture/markers-snapshot.test.ts.

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
export const STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for";
