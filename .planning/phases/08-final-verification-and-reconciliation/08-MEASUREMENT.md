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
| Run identity | HEAD `1e25b80bf474ceea0adebd307e901400c572eee1` on branch `features/test-backlog`. `git rev-list --left-right --count origin/main...HEAD` printed `0` behind and `297` ahead (the branch was never pushed). Run window (UTC, from the runner logs): the chain ran from 2026-09-19T00:22:19Z (member 1 start) to 00:46:30Z (member 16 end). The three additional gates and the readbacks ran from 00:47:16Z to 01:10:12Z. `node --version` printed `v26.8.2`, `npm --version` printed `11.19.1`, `npx fallow --version` printed `fallow 3.23.0` (signed, cache hit), `pre-commit --version` printed `pre-commit 4.5.1`. |
| Local edits present, never staged | `git status --short` before the run printed ` M .claude/settings.json`, ` M .codex/config.toml`, ` M .planning/state.json` and `?? .mcp.json` (the four per-machine edits this phase preserves). It also printed ` M .planning/STATE.md` (the orchestrator's execution-start tracking write) and `?? .planning/milestone.lock` (the orchestrator's advisory phase claim). None of the six is staged by this plan's task commits. |

## 2. The check chain member by member

Each of the sixteen `check` members ran as its own `npm run <member>` process from a sequential runner script. The runner captured `rc=$?` on the command itself, with stdout and stderr redirected to one log per member and never through a pipe. The logs live under the executor scratchpad (`gates/`) and are not committed. A member whose log ends without its summary line is re-run, never recorded.

| # | Command | Exit | Seconds | Counts / output line |
| --- | --- | --- | --- | --- |
| 1 | `npm run typecheck` | 0 | 38 | `tsc --noEmit`, no diagnostics |
| 2 | `npm run lint` | 0 | 163 | `eslint extensions tests scripts eslint.config.js`, no findings |
| 3 | `npm run lint:workflows` | 0 | 1 | `Workflow install-scripts gate passed.` |
| 4 | `npm run lint:workflows:negative` | 0 | 0 | `Workflow install-scripts negative controls passed.` |
| 5 | `npm run fallow` | 0 | 5 | dead-code `✓ No issues found (0.51s)`; cycles `✓ No issues found (0.90s)`; health `✗ 0 above threshold · 14965 analyzed · maintainability 91.8 (good) (0.21s)`; dupes `✗ 1,819 lines (1.9%) duplicated across 61 files (0.24s)`. The health and dupes lines print a red `✗` glyph while the process exits 0. |
| 6 | `npm run format:check` | 0 | 48 | `All matched files use Prettier code style!` |
| 7 | `npm run test:corresponding` | 0 | 2 | `Corresponding-test gate passed.` |
| 8 | `npm run test:corresponding:negative` | 0 | 1 | `Corresponding-test negative controls passed.` |
| 9 | `npm run test:coverage:direct:negative` | 0 | 4 | `Direct-coverage negative controls passed.` and `Base-selection, pair-enumeration and coverage-pin negative controls passed: ...` |
| 10 | `npm run test:coverage:unit` | 0 | 443 | `tests 6900 / suites 284 / pass 6900 / fail 0 / cancelled 0 / skipped 0 / todo 0 / duration_ms 357917.460698`; `Coverage capture 20260919T002923698Z-2c0f1c43: 312 worker(s), 543 raw record(s), 618 module(s), 9 unloaded production source(s)`; `Coverage map validated: 20260919T002923698Z-2c0f1c43, 239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es), schema 1, syntax model 1`; `Coverage unit verified: 20260919T002923698Z-2c0f1c43: 239 production file(s), 230 loaded, 9 unloaded (8 type-only, 1 executable); native 63825/63825 line(s), 1890/1890 function(s), 9234/9234 branch(es); syntax 1865/1865 function(s), 10392/10393 statement(s), 6633/6653 branch arm(s)` |
| 11 | `npm run coverage:unit:negative` | 0 | 18 | `Verified unit coverage negative controls passed (32 of 32).` |
| 12 | `npm run coverage:risk` | 0 | 12 | `Coverage risk verified: 20260919T002923698Z-2c0f1c43, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13100 other row(s) not gated` |
| 13 | `npm run coverage:risk:negative` | 0 | 35 | `Coverage risk negative controls passed (20 of 20).` |
| 14 | `npm run test:integration` | 0 | 14 | `tests 32 / pass 32 / fail 0 / skipped 0`; the two global-peer cases `T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser` and `SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback and stays out of the global catalog` both `✔` |
| 15 | `npm run lint:type-members` | 0 | 85 | `Unused type member gate passed with 5 recorded exception(s).` |
| 16 | `npm run lint:type-members:negative` | 0 | 421 | `Unused type member negative controls passed (7 of 7).` |

Chain total: 1290 s (21 min 30 s), the sum of the sixteen `seconds=` values in the runner summary. Member 1 ran from 00:22:19Z to 00:22:57Z. Members 2 to 16 ran from 00:25:38Z to 00:46:30Z. Phase 7 measured the same chain at 1287 s.

## 3. Additional gates

The three gates outside the chain ran the same way: one process each, exit captured on the command, output in its own log. `npm run test:e2e` ran in the foreground after a network control. The other two ran detached because each exceeds the 10-minute tool ceiling.

| Command | Exit | Seconds | Counts / output line | Classification |
| --- | --- | --- | --- | --- |
| `npm run test:e2e` | 0 | 8 | `tests 14 / pass 14 / fail 0 / skipped 0 / duration_ms 7378.272341`; the three `import` cases (`imports enabled Claude settings across both scopes`, `--scope project narrows writes to project scope`, `reports source mismatches and skips dependent plugins`) all `✔`; `real Pi runtime package bin loads the extension under isolated HOME and cwd` `✔` (1.3 s). Network control before the run: `git ls-remote https://github.com/anthropics/claude-plugins-official HEAD` printed `network exit=0`. | pass. The network was reachable and the depth-1 fetch of the pinned SHA `6196a61bdeece7b9889ecda1e45bd7085788ae75` succeeded. |
| `npm run test:coverage:direct:all` | 0 | 490 | `All-pair run complete: 239 pairs in 488.5s (488498ms) on v26.8.2`; 237 `Direct coverage passed` rows; `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly.` The two recorded shortfalls: `bridges/commands/discover.ts (branches 55/56, lines 412/414)` and `orchestrators/plugin/install-outcome.ts (branches 109/111, lines 1039/1045)`. Report `coverage/all-pairs.jsonl` holds 239 lines. | pass. The pin is unchanged. |
| `pre-commit run --all-files` | 1 | 840 | 41 hooks: 35 `Passed`, 5 `Skipped` (`(no files to check)`: broken symlinks, sort simple yaml files, forbid submodules, forbid new submodules, Alphabetize Codeowners), 1 `Failed`: TruffleHog, with the error `failed to scan Git: error preparing repo: failed to read index file: open /home/acolomba/src/pi-claude-marketplace-test-backlog/.git/index: not a directory`. Every npm hook passed (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow`, `npm lint workflows`, `npm direct coverage (changed pairs)`, `npm type members`, `npm type members (negative controls)`, `npm unit coverage (verified bundle)`, `npm coverage risk`). `detect private key`, mdformat, markdownlint-cli2, zizmor, yamllint, yamlfmt and prettier passed. `git status --short` before and after the run are byte-identical (`diff` printed `status diff exit=0`): no file was rewritten. | TruffleHog: environment, not regression (section 6). Every other hook: pass. |

Post-run readbacks, exit captured directly. `npm run coverage:validate` printed `exit=0` and `Coverage bundle verified: 20260919T002923698Z-2c0f1c43, 239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es), schema 1, syntax model 1; manifest coverage/unit.manifest.json`. `npm run coverage:risk -- --report coverage/unit.risk.json` printed `exit=0` and `Coverage risk verified: 20260919T002923698Z-2c0f1c43, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13100 other row(s) not gated`. The manifest `runId` is the one the chain's `test:coverage:unit` log printed, its `acceptance.acceptedAt` is `2026-09-19T00:36:40.757Z` (before the pre-commit run started at 00:55:45Z), and `coverage/runs/` holds only `20260919T002923698Z-2c0f1c43`. So the `npm-coverage-unit` hook reused the bundle and did not replace it. The control `SKIP=trufflehog pre-commit run trufflehog --all-files` printed `TruffleHog ... Skipped` and `exit=0`.
