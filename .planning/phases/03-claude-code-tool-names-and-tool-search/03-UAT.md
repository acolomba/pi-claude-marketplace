---
status: testing
phase: 03-claude-code-tool-names-and-tool-search
source: [03-VERIFICATION.md]
started: 2026-10-06T21:10:00Z
updated: 2026-10-06T21:10:00Z
---

## Current Test

number: 1
name: Decide WR-03 — same-plugin key clash refuses before the ledger runs, or amend the wording
expected: |
  Either (a) a pre-check before `transaction.runPhases` makes a plugin with a skill plus two
  colliding servers refuse before the skill directory is created, or (b) ROADMAP SC3, D-03-12
  and `docs/mcp-compatibility.md:27` say "refuses and leaves nothing behind" instead of
  "before it writes anything".
awaiting: user response

## Tests

### 1. Decide WR-03 — same-plugin key clash refuses before the ledger runs, or amend the wording
expected: A pre-check before `transaction.runPhases` refuses before any write, or SC3, D-03-12 and `docs/mcp-compatibility.md:27` are reworded to "refuses and leaves nothing behind".
result: [pending]

### 2. Decide WR-02 — write `auth: "oauth"` for a remote server that declares `oauth`, or record the divergence
expected: The translator derives `auth: "oauth"` so OAuth stays active alongside `headers`, or a recorded decision or documented Pi capability gap licenses the divergence.
result: [pending]

### 3. Decide WR-01 — TR-03 accounting for a server in both `mcp-adapter.json` and legacy `mcp.json`
expected: After a failed legacy-file write on uninstall, `dropped.mcpServers` omits a declared name that `mcp.json` still serves, and the install record keeps it; or the fix is carried to a later phase with a recorded reason.
result: [pending]

### 4. Clear the fallow audit `warn` before the PR (WR-05)
expected: `npx fallow audit` against the merge-base with `origin/main` reports verdict `pass`; the `plugin-info.ts` fixture clone groups (from ADET-01, commit 2502cbf3) are removed or a ship-prep task carries them.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
