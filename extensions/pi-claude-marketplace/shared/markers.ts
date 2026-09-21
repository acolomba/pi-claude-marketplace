// shared/markers.ts
//
// Stable user-contract prefixes (PUP-6). The compact-line grammar lives in
// docs/messaging-style-guide.md. The extension markers below are NOT part of
// ES-5 and are the canonical user-contract prefixes for their respective
// surfaces. They are drift-guarded by tests/shared/markers.test.ts.

/**
 * PUP-6 recovery hint. Stable user-contract prefix. The runtime caller in
 * `orchestrators/plugin/update-swap.ts` appends ` "${pluginName}".` after this
 * prefix to compose the final user-visible hint. Not a member of the ES-5
 * enum; drift-guarded by tests/shared/markers.test.ts.
 */
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";
