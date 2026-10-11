---
quick_id: 261011-bsm
status: complete
date: 2026-10-11
commit: f38ce0f4
---

# Quick Task 261011-bsm: merge origin/main into features/json

**One-liner:** `origin/main` (#248, #250) is merged into `features/json` as one
merge commit, `f38ce0f4`, with main's code ported to the branch's notification
run model. PR #251 now reads MERGEABLE.

## What changed

- Merge commit `f38ce0f4`. Its parents are `699daee8` (features/json) and
  `94160614` (origin/main). The merge resolved 115 conflicted paths: 37
  production, 65 test, 13 planning, `CHANGELOG.md`, and
  `docs/output-catalog.md`.
- main's code now takes `run: NotificationRun` instead of `pi`, and soft
  dependencies come from `run.softDeps`. Each command still reads the companion
  extensions once, through main's `PiInventory` (tools and commands).
- main's two direct-notify MCP surfaces are now typed raw kinds that both
  strategies render: `mcp-config-notices` and `mcp-migration`. The wire schema
  grows from 19 to 21 payload kinds. Plugin info carries typed MCP server
  entries and a `requires` companion list. `requires pi-mcp` became
  `requires pi-mcp-adapter`, and `unsupported mcp` is new. The text bytes keep
  main's catalog form.
- The e2e peer-floor fixture now pins Pi 1.0.0. The RPC adapter-detection e2e
  test and the MCP canary read `claude-plugin` entries.
- The planning records keep both milestones (json-output and mcp-4). The
  WINDOWS ledger has 92 entries with 0 open: main's 88-90 kept their IDs, and
  the branch's 88/89 became 91/92. main's research files stay at the root, and
  the branch's moved to `.planning/milestones/json-output-research/`.

## Verification

- `npm run check`: exit 0 on the committed tree (Node v26.11.1, 95 s).
- `CI=1 npm run test:e2e`: 33/33 pass on Pi 1.0.0, the installed runtime and the
  peer floor.
- `SKIP=npm-check pre-commit run --all-files`: exit 0 on the committed tree.
- Test titles: 7,155 titles expected. Every missing title is logged as a
  rename, a move, or one retired `describe` wrapper whose tests were split by
  owner.
- PR #251: `MERGEABLE`. The CI integration and pinned e2e jobs passed on the
  first run.

## Deviations

- The `gsd-executor` cannot spawn agents, so the orchestrator ran the plan's
  delegation waves: Task 1 in sequence, Wave A in parallel (3 agents), Wave B
  in parallel (6 agents), then Task 3.
- The first `git commit` failed in the hooks. The moved MCP tests held literal
  bidi and NBSP characters, where main's source has escapes. Task 3 restored
  the escapes, re-ran `npm run check`, and committed. It did not use amend or
  `--no-verify`.

## Open items

- The Lint `fallow-audit` job fails on 3 clone groups in the edge handlers that
  this branch added before the merge. The merge introduced none. It is not a
  required check.
- Two choices for the user before PR #251 merges: the new `mcp-config-notices` /
  `mcp-migration` payload kinds and plugin-info fields (rated costly to change
  once released), and the Phase 9 D-03 `isError` choice.
- A live run of `tests/live-uat/mcp-adapter-canary.mjs` needs a person.
- CI-only cases: the pi-mcp-adapter 5 conformance tests and the pi-subagents
  >=0.74 cases skip on this machine.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
