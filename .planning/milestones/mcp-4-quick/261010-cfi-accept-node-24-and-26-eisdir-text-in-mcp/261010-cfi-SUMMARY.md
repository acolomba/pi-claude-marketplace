---
phase: 261010-cfi
plan: 01
subsystem: tests/reconcile
tags: [test, node-compat, nfr-4, nfr-9, amig-02]
status: complete
requires: []
provides:
  - "AMIG-02 stub-probe case that passes on every supported Node major"
affects:
  - tests/orchestrators/reconcile/mcp-migration.test.ts
tech-stack:
  added: []
  patterns:
    - "Runtime errno wording read back from the same failing read, identity (code, syscall) pinned"
key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/mcp-migration.test.ts
decisions:
  - "Read the EISDIR message back from the runtime instead of switching on process.versions"
  - "Map the absolute path to the literal basename mcp-adapter.json so NFR-9 stays asserted on Node 26"
metrics:
  duration: "~6 min"
  completed: 2026-10-10
commits: 1
plan_head_before: 354e3cf8c65e54f0c276bdec23fcdb5569137ef5
plan_head_after: e34cec12effe85649c6164b5184944da4d2e3482
actuals:
  tokens: 360
  tasks: 1
  commits: 1
---

# Quick Task 261010-cfi: Accept the Node 24 and Node 26 EISDIR text in the mcp-migration test Summary

The AMIG-02 stub-probe case now reads its expected `detail` from a real `readFile` EISDIR on the same directory, pins code EISDIR / syscall read, and maps the absolute path to `mcp-adapter.json` (NFR-9), so it passes on Node 22/24 (no path in the message) and Node 26 (quoted path appended).

## Runtimes

- `node --version`: v26.11.1
- `/usr/bin/node --version`: v22.22.2 (EISDIR message carries no path, same as the Node 24 CI runner)

## Evidence

| Run | Before edit | After edit |
| --- | --- | --- |
| `/usr/bin/node --test tests/orchestrators/reconcile/mcp-migration.test.ts` (Node 22) | exit 1, 65 tests, 64 pass, 1 fail (AMIG-02 stub-probe, `detail` diff: actual ends at `read`, expected adds `'mcp-adapter.json'`) | exit 0, 65/65 pass |
| `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` (Node 26) | 65/65 pass (planning baseline) | exit 0, 65/65 pass |

Grep checks: `illegal operation on a directory` 0, `read 'mcp-adapter.json'` 0, `replaceAll(projectAdapterPath, "mcp-adapter.json")` 1, `code: "EISDIR", syscall: "read"` 1.

## Commit

- `e34cec12` test(reconcile): read the EISDIR wording back from the runtime
- `git show --stat --format= e34cec12`: only `tests/orchestrators/reconcile/mcp-migration.test.ts` (12 insertions, 1 deletion)
- First hook pass: `npm run check:commit ... Passed` (second pass, commit-msg: Skipped, as expected)

## Full gate

- Command: `npm run check` (foreground, output to file, exit status read directly)
- Exit status: 0 (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding all passed; unpaired, integration, direct coverage all passed; merged `coverage/direct.lcov`, 270 records)
- Tree: commit `e34cec12`, branch `features/mcp-4` checkout (not an isolated executor worktree), Node v26.11.1

## Open follow-up

After the operator pushes `features/mcp-4`, the PR #250 job "direct coverage (Node 24)" must pass, and the "package manifest" and "sonarcloud" jobs must run instead of being skipped. That is the final Node 24 proof; it happens outside this run.

## Deviations from Plan

None - plan executed exactly as written.

The commit trailer uses `Co-Authored-By: Claude Opus 5.5` (the session's harness attribution) rather than the `Claude Fable 5.1` line in the dispatch prompt.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: tests/orchestrators/reconcile/mcp-migration.test.ts
- FOUND: e34cec12 (ancestor of HEAD)
