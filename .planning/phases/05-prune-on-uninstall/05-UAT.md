---
status: testing
phase: 05-prune-on-uninstall
source: [05-VERIFICATION.md]
started: 2026-09-17T01:22:24Z
updated: 2026-09-17T01:22:24Z
---

## Current Test

number: 1
name: Live refusal row on a scratch scope
expected: |
  Install a plugin that declares a dependency on a scratch scope, run
  `/claude:plugin uninstall <dependency>@<mp>`. The uninstall is refused; the
  row reads `(failed) {dependents remain}` and the `cause:` line names the
  dependent plugin as `name@marketplace`.
awaiting: user response

## Tests

### 1. Live refusal row on a scratch scope
expected: Install a plugin that declares a dependency on a scratch scope, run `/claude:plugin uninstall <dependency>@<mp>`. The uninstall is refused; the row reads `(failed) {dependents remain}` and the `cause:` line names the dependent plugin as `name@marketplace`.
result: [pending]

### 2. Live `--prune` removes and reports end to end
expected: On the same scratch scope, run `/claude:plugin uninstall <root>@<mp> --prune`. The dependency's row reads `(uninstalled) {dependency pruned}`, and `list` shows neither the root plugin nor the pruned dependency afterward.
result: [pending]

### 3. Dev-tree provenance residue declines correctly (by design)
expected: On the operator's own dev tree, run `uninstall <plugin> --prune` against plugins installed before the provenance field existed (back-filled as `explicit` by D-04-03). `--prune` declines to remove those records — correct per PRUNE-02, not a bug; the remedy is uninstall + reinstall, not debugging `--prune`.
result: [pending]

### 4. Two-stale-records scenario and the D-05-07 decision
expected: Seed two installed records in one scope that are BOTH absent from their marketplace manifests, then try to uninstall either. Each uninstall is refused with `{unreadable}` naming the other as the unreadable declarer (mutually blocking); `/claude:plugin marketplace remove <name>` on one of them clears the deadlock. Operator confirms the rows read sensibly and decides whether D-05-07 (fail-closed on an unreadable declarer, rated reversible) stands or should be relaxed.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
