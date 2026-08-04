---
status: resolved
phase: 90-session-environment-initialization
source: [90-VERIFICATION.md]
started: 2026-08-03T12:20:00Z
updated: 2026-08-04T12:48:55Z
---

## Current Test

[testing complete]

## Tests

### 1. Live bash-child session env visibility
expected: In a live Pi session with the extension loaded, run `env | grep -E 'CLAUDECODE|CLAUDE_CODE_SESSION_ID|CLAUDE_SESSION_ID'` through Pi's bash tool: CLAUDECODE=1, both session-id keys equal the current Pi session id; after `/reload`, the id is refreshed (matches the new session, never stale). (SENV-01, SENV-02, SENV-03)
result: pass
note: "All three vars present; id identical across /reload (same session — correct) and refreshed to a new id after /new. A transient error flash was observed once after the first /new but did not reproduce on repeat; no text captured (session not persisted, no logs). Not attributable to SENV behavior."

### 2. Live plugin-bin PATH install/uninstall + reload cycle
expected: Install a plugin that has a `bin/` directory; `echo $PATH` through Pi's bash tool shows `<pluginRoot>/bin` appended (not prepended). Uninstall the plugin, run `/reload`; the entry is gone from PATH (ledger-based removal, no stale entry). (PENV-01)
result: pass
note: "Verified with disposable path-source marketplace tmp/penv-uat-mkt (plugin bin-tool). PATH entry appended (position 9, not prepended); hello-penv resolved and ran; uninstall + /reload removed the entry with no stale remnant. Install required --partial (see test 3 issue)."

### 3. Bin-shipping plugin default install + reason accuracy
expected: A plugin that ships a `bin/` directory installs by default (Claude Code 2.1.212 parity — bin dirs are honored at runtime since PENV-01), and any install-failure reason token names the actual axis of the problem.
result: pass
note: "Retested live 2026-08-04 after 90-02 (D-90-06 bin install-by-default, D-90-05 {unsupported component}) and 90-03 (SURF-01 arm-aware install classifier); bin-only plugin installs by default; non-carve-out kind renders {unsupported component} on install/list/info; both-defects case renders byte-identical {unsupported source}."

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-90-3
  truth: "A plugin shipping a bin/ directory installs by default (its bin/ is honored at runtime via PENV-01 PATH injection), and install-failure reason tokens name the actual axis of the problem"
  status: resolved
  reason: "User reported: installing produces an error; this shows as unsupported source. is this right?"
  severity: major
  test: 3
  root_cause: "domain/resolver.ts:347-371 still lists bin in UNSUPPORTED_COMPONENT_KINDS with a bin/ dir convention probe, so a bin-shipping plugin resolves partially-available and the default install gate blocks it (--partial required). PENV-01 (orchestrators/plugin-path.ts collectBinDirs) now honors bin/ at runtime for every enabled installed record, making the classification stale against Claude Code 2.1.212 parity. Separately, shared/probe-classifiers.ts:204 kindToReason maps only lspServers->lsp and hooks->unsupported hooks; every other kind (bin, monitors, themes, ...) collapses to the generic unsupported source reason token, mislabeling a fully supported path source."
  artifacts:
    - path: "extensions/pi-claude-marketplace/domain/resolver.ts"
      issue: "bin in UNSUPPORTED_COMPONENT_KINDS + bin/ convention probe despite PENV-01 runtime support"
    - path: "extensions/pi-claude-marketplace/shared/probe-classifiers.ts"
      issue: "kindToReason collapses unmapped kinds to unsupported source (mislabel)"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"
      issue: "narrowResolverReasons inherits the same permissive unsupported source fallback for the install failure row"
  missing:
    - "Reclassify bin as a supported component kind so a bin-shipping plugin installs by default (Claude Code parity; runtime already appends <pluginRoot>/bin)"
    - "Accurate reason marker for non-carve-out unsupported kinds instead of the generic unsupported source fallback (closed-set REASONS catalog amendment)"
  debug_session: ".planning/debug/bin-unsupported-classification.md"
