---
status: testing
phase: 90-session-environment-initialization
source: [90-VERIFICATION.md]
started: 2026-08-03T12:20:00Z
updated: 2026-08-03T12:20:00Z
---

## Current Test

number: 1
name: Live bash-child session env visibility
expected: |
  In a live Pi session with the extension loaded, `env | grep -E 'CLAUDECODE|CLAUDE_CODE_SESSION_ID|CLAUDE_SESSION_ID'` through Pi's bash tool shows CLAUDECODE=1 and both session-id keys equal to the current Pi session id; after /reload the id is refreshed (never stale).
awaiting: user response

## Tests

### 1. Live bash-child session env visibility
expected: In a live Pi session with the extension loaded, run `env | grep -E 'CLAUDECODE|CLAUDE_CODE_SESSION_ID|CLAUDE_SESSION_ID'` through Pi's bash tool: CLAUDECODE=1, both session-id keys equal the current Pi session id; after `/reload`, the id is refreshed (matches the new session, never stale). (SENV-01, SENV-02, SENV-03)
result: [pending]

### 2. Live plugin-bin PATH install/uninstall + reload cycle
expected: Install a plugin that has a `bin/` directory; `echo $PATH` through Pi's bash tool shows `<pluginRoot>/bin` appended (not prepended). Uninstall the plugin, run `/reload`; the entry is gone from PATH (ledger-based removal, no stale entry). (PENV-01)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
