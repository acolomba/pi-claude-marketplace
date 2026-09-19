# Phase 8 -- Final gate measurement at the phase HEAD

Plan 08-01 runs every required gate again at the phase HEAD and records the result here. Every figure below was measured by the runs this document names. No figure is copied from 08-RESEARCH.md or from the Phase 7 record. The Phase 7 figures appear only in the comparison tables, where each one is labeled as the expected value.

## 1. Preconditions

| Precondition | Evidence |
| --- | --- |
| Phase 1 verification complete | `01-VERIFICATION.md`: `status: passed`, `score: 5/5 must-haves verified`, verified 2026-09-14T14:41:23Z |
| Phase 2 verification complete | `02-VERIFICATION.md`: `status: passed`, `score: 4/4 must-haves verified`, verified 2026-09-14T15:02:10Z |
| Phase 3 verification complete | `03-VERIFICATION.md`: `status: passed`, `score: 18/18 must-haves verified`, verified 2026-09-14T15:32:46Z |
| Phase 4 verification complete | `04-VERIFICATION.md`: `status: passed`, `score: 7/7 must-haves verified`, verified 2026-09-14T15:32:46Z |
| Phase 5 verification complete | `05-VERIFICATION.md`: `status: passed`, `score: 10/10 must-haves verified`, verified 2026-09-15T05:10:01Z |
| Phase 6 verification complete | `06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified`, verified 2026-09-17T02:40:00Z |
| Phase 7 verification complete | `07-VERIFICATION.md`: `status: passed`, `score: 8/8 must-haves verified`, verified 2026-09-18T23:15:00Z (the report body counts 10/10; the frontmatter value is cited as canonical) |
| Code tree identity | Last commit touching `extensions/`: `31ed3c72` (2026-09-17 10:38:18 -0400). Last commit touching `tests/` and `scripts/`: `0844c2a7` (2026-09-18 18:09:00 -0400). `git diff --quiet 0844c2a7 HEAD -- extensions tests scripts package.json package-lock.json .fallowrc.json eslint.config.js sonar-project.properties .pre-commit-config.yaml; echo "exit=$?"` printed `exit=0`. The commits after `0844c2a7` touch `.planning/` only, so a docs-only commit between the runs of this plan does not change what was measured. |
| Run identity | HEAD `1e25b80bf474ceea0adebd307e901400c572eee1` on branch `features/test-backlog`. `git rev-list --left-right --count origin/main...HEAD` printed `0` behind and `297` ahead (the branch was never pushed). Run window (UTC, from the runner log): member 1 started 2026-09-19T00:22:19Z. The end of the window is recorded in section 2 after the last member. `node --version` printed `v26.8.2`, `npm --version` printed `11.19.1`, `npx fallow --version` printed `fallow 3.23.0` (signed, cache hit), `pre-commit --version` printed `pre-commit 4.5.1`. |
| Local edits present, never staged | `git status --short` before the run printed ` M .claude/settings.json`, ` M .codex/config.toml`, ` M .planning/state.json` and `?? .mcp.json` (the four per-machine edits this phase preserves). It also printed ` M .planning/STATE.md` (the orchestrator's execution-start tracking write) and `?? .planning/milestone.lock` (the orchestrator's advisory phase claim). None of the six is staged by this plan's task commits. |

## 2. The check chain member by member

Each of the sixteen `check` members ran as its own `npm run <member>` process from a sequential runner script. The runner captured `rc=$?` on the command itself, with stdout and stderr redirected to one log per member and never through a pipe. The logs live under the executor scratchpad (`gates/`) and are not committed. A member whose log ends without its summary line is re-run, never recorded.

| # | Command | Exit | Seconds | Counts / output line |
| --- | --- | --- | --- | --- |
| 1 | `npm run typecheck` | 0 | 38 | `tsc --noEmit`, no diagnostics |
