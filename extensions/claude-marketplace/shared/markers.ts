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
