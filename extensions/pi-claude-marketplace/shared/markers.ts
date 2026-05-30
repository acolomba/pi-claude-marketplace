// shared/markers.ts
//
// Stable user-contract prefixes (PUP-6). The PRD §6.12 ES-5 marker strings
// have been superseded by the compact-line grammar in
// docs/messaging-style-guide.md (Supersession of ES-5). The extension markers
// below are NOT part of ES-5 and remain the canonical user-contract prefixes
// for their respective surfaces. They are drift-guarded by
// tests/architecture/markers-snapshot.test.ts.

/**
 * PUP-6 recovery hint. Stable user-contract prefix. The runtime caller in
 * `orchestrators/plugin/update.ts` appends ` "${pluginName}".` after this
 * prefix to compose the final user-visible hint. Not a member of the ES-5
 * enum; drift-guarded by tests/architecture/markers-snapshot.test.ts.
 */
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";

/**
 * State-lock contention prefix. Stable user-contract prefix. The transaction
 * layer appends the scope and lock path when a second process attempts to
 * mutate the same scope while a `withStateGuard` lock is already held. Not a
 * member of the ES-5 enum; drift-guarded by
 * tests/architecture/markers-snapshot.test.ts.
 */
export const STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for";
