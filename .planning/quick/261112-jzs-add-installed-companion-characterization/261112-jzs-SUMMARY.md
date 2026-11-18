---
phase: quick-261112-jzs
plan: 01
subsystem: testing
tags: [pi-subagents, mcp, integration]
requires: []
provides:
  - Installed companion child launch characterization in the integration suite
  - Patch sensitivity and positive detached-child acceptance instructions
affects: [PG-MCP-02, companion-upgrade]
actuals:
  tokens: 2512
  tasks: 3
  commits: 1
commits: 1
plan_head_before: 80e87b6e1c65bdb06d079d08bb99d6701dfc0027
plan_head_after: 92bace26
tech-stack:
  added: []
  patterns: [installed optional-peer launch contract test]
key-files:
  created: [test/integration/pi-subagents-child-launch-conformance.test.ts]
  modified: [.planning/debug/artifacts/real-child-mcp-automation/README.md]
key-decisions:
  - Preserve the installed 0.88.0 known-gap assertions until the positive child acceptance passes for an adopted fix.
requirements-completed: []
duration: 25min
completed: 2026-11-12
status: complete
---

# Quick task 261112-jzs: Installed companion characterization

The integration suite now calls the installed `buildInProcessChildLaunch` export in six independent cases. Two cases describe the current ambient MCP suppression gap. Four cases cover explicit grants and restrictions.

## Verification

- The focused new module and the existing long-grant module passed against cached `pi-subagents` 0.88.0. The focused module reported six passes, zero failures, and zero skips.
- The actual compiled module from companion fix `1e79b864159430cc124783a7d7c9e4e5daa2a7bf` differs from the installed compiled module only by the two-line ambient-clearing branch. The fixed checkout was at `7629470d1d86f62e4fd4b6ccb1ee4b2c28953db4`.
- With that compiled module temporarily substituted in a fresh Node process, exactly the unrestricted and exclusion-only known-gap cases failed. Both observed `mcpDirectTools: undefined`. The four explicit grant and restriction controls passed.
- A `finally` block restored the installed module byte for byte. Its SHA-256 was `0020cfc64c7c0793e428cf2626020ef7dba3366f7d5ac7818df7a1980fc8e44d` before and after the substitution. A fresh restored run passed all six cases.
- The saved positive runner exited 0 against `/tmp/pi-subagents-mcp-fix/dist-pkg/index.js`. `demo:runner` called the short echo tool. `demo:control` received and called the long tool. `demo:restricted` lacked the long tool and called the allowed short tool. All three detached children completed.
- `fallow audit --base HEAD` reported no issues. The normal commit hook passed, including typecheck, lint, Fallow, formatting, and `npm run check:commit`. An initial hook run found five `require-await` lint errors; the cases now use `createHermeticEnvironment(t)` and the next hook passed.
- The orchestrator ran `npm run check` on the combined tree with exit 0 on Node v26.13.0. It passed 1,812 adapter scenarios, 155 built-in scenarios, and 354 direct-coverage pairs, including the new integration module. Source reference: `92bace26f6438a09f01c92148673695d7d7fb655`. Log: `/tmp/gsd-mcp-characterization-full-check.log`. Only planning Markdown changed afterward; no new untracked build inputs were present.

## Commit

- `92bace26` `test(integration): characterize installed child MCP launch`

The README, plan, coverage declaration, summary, and STATE update are included in the final planning-record commit.

## Deviations from Plan

The sandbox blocked child-process spawning and local stand-in startup. The patch driver and positive runner completed with elevated execution. The first commit hook exposed a lint error in synchronous callbacks; the corrected test passed the next hook. No production source, package version, or companion checkout was changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

The test module, README, and summary exist. Commit `92bace26` is in the current branch. The cached companion module matches its saved SHA-256.

## Upstream PR and Review

Opened https://github.com/nicobailon/pi-subagents/pull/3259. Review found outdated MCP documentation and requested contributor credit. Both were fixed in `7629470d1d86f62e4fd4b6ccb1ee4b2c28953db4`, pushed to the existing branch, and the review thread was resolved. The Tests workflow passed on that commit: https://github.com/nicobailon/pi-subagents/actions/runs/43290904487. No package was published or dependency upgraded here.
