---
phase: 03-stopfailure-hooks
status: passed
verified: 2026-11-08
score: 4/4
requirements: [STOPF-01]
---

# Phase 3 Verification: StopFailure Hooks

The phase session verified this phase inline, following `.claude/agents/gsd-verifier.md`, because it cannot dispatch subagents in the foreground. Each criterion was checked against the code and the behavioral runs, not against the SUMMARYs alone.

## Success criteria

| # | Criterion (STOPF-01) | Evidence | Status |
|---|---|---|---|
| 1 | An error turn runs the StopFailure hook once, with Claude Code's payload and the error type | The seed scenario and the Outline over eight error types in `features/hook/stop-failure.feature` state each whole run row. S3 covers the `length` ending (`max_output_tokens`, no `last_assistant_message`, D-BG-303). | passed |
| 2 | A matcher selects runs by error type | In the Outline, the `named` hook runs and the look-alike `other` hook does not. S8 covers `\|` lists (D-BG-302). S7a and S7b cover the 13 admitted types and the dropped matchers (D-BG-301). | passed |
| 3 | A normal turn runs no StopFailure hook, and an error turn runs no Stop hook, as in Claude Code | S4a, S4b (upstream: StopFailure runs "instead of Stop") | passed |
| 4 | Output and exit code are ignored, and the next prompt gets a normal turn | S5 (exit 2, block JSON, and `on failure: block`: no notice, no extra model call). S6 (the next turn's call and its Stop row). | passed |

Every new scenario has a recorded red proof: in 03-01-SUMMARY.md, 03-02-SUMMARY.md, and 03-03-SUMMARY.md. Decisions D-BG-301 to D-BG-304 are implemented as CONTEXT.md states them, with the P3-DC-06 adjustment for D-BG-302.

## Gates

The phase gate ran at HEAD `1e61a128` on a machine shared with 14 other phases (load average about 88 on 28 cores).

- `npm run check`:
  - `check:static` passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
  - `test:unpaired` and `test:integration` passed.
  - The adapter cucumber profile ran 1670 scenarios: 1662 passed and 8 failed. All 8 failures were timeouts unrelated to this phase: 4 Pi starts with a companion that took more than 90 s, 3 terminal readiness checks that took more than 15 s, and 1 MCP connect.
- The 8 failed scenarios were rerun once (`--parallel 3`): 6 passed. The other 2 (`mcp-server/project-scope.feature:9` and `mcp-server/lifecycle.feature:237`) timed out again at the pi-mcp-adapter start.
- A serial diagnostic rerun (`--parallel 1`) passed `project-scope.feature:9`, while `lifecycle.feature:237` timed out at the same Given a third time. That feature declares no hooks, so this phase's code cannot run in it. The failure is recorded as a load timeout for the parent's combined-tree gate to re-check.
- `npm run test:cucumber:profile -- --profile builtin --parallel 3`: 148 of 148 passed.
- `npm run test:coverage:direct:all`: exit 0.
- `npm run test:modules`: exit 0.

## Human verification

None needed.
