---
status: complete
phase: 03-claude-code-tool-names-and-tool-search
source: [03-VERIFICATION.md]
started: 2026-10-06T21:10:00Z
updated: 2026-10-06T20:57:41.337Z
---

## Current Test

[testing complete]

## Tests

### 1. Decide WR-03 — same-plugin key clash refuses before the ledger runs, or amend the wording
expected: A pre-check before `transaction.runPhases` refuses before any write, or SC3, D-03-12 and `docs/mcp-compatibility.md:27` are reworded to "refuses and leaves nothing behind".
result: pass

### 2. Decide WR-02 — write `auth: "oauth"` for a remote server that declares `oauth`, or record the divergence
expected: The translator derives `auth: "oauth"` so OAuth stays active alongside `headers`, or a recorded decision or documented Pi capability gap licenses the divergence.
result: pass

### 3. Decide WR-01 — TR-03 accounting for a server in both `mcp-adapter.json` and legacy `mcp.json`
expected: After a failed legacy-file write on uninstall, `dropped.mcpServers` omits a declared name that `mcp.json` still serves, and the install record keeps it; or the fix is carried to a later phase with a recorded reason.
result: pass

### 4. Clear the fallow audit `warn` before the PR (WR-05)
expected: `npx fallow audit` against the merge-base with `origin/main` reports verdict `pass`; the `plugin-info.ts` fixture clone groups (from ADET-01, commit 2502cbf3) are removed or a ship-prep task carries them.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
