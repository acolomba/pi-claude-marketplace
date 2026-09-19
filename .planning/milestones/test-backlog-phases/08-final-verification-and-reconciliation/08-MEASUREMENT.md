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

## 4. Aggregate unit coverage

The published bundle is run `20260919T002923698Z-2c0f1c43`, read from `coverage/unit.manifest.json` after the chain and the additional gates finished: started 2026-09-19T00:29:23.700Z, completed 00:35:35.289Z, accepted 00:36:40.757Z. Its `runtime` object is `{"node":"v26.8.2","v8":"14.6.202.34-node.28","platform":"linux","arch":"x64"}`. The research capture was `20260918T225947291Z-f055e502` with manifest digest `39a577cc3a087653`. This run differs from it in every identity below, as it must.

| Artifact | sha256, first 16 |
| --- | --- |
| `coverage/unit.lcov` | `efbd4718eaff6692` |
| `coverage/unit.istanbul.json` | `c0cb21f8e662c151` |
| `coverage/unit.manifest.json` | `e4324bf7acb84520` |
| `coverage/unit.validation.json` | `bf9dfd7c6a6d8d6a` |

Manifest `acceptance.population`, quoted without the per-file digests: `{"production":239,"loaded":230,"typeOnly":8,"executable":1}`. The nine unloaded production paths are `bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/hooks/exec-result.ts`, `bridges/mcp/types.ts`, `bridges/skills/types.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts` (all `type-only`) and `orchestrators/types.ts` (`executable`, 0 functions, 0 statements, 0 branches).

Manifest `acceptance.denominators`, quoted verbatim: `{"native":{"records":230,"lines":{"found":63825,"hit":63825},"functions":{"found":1890,"hit":1890},"branches":{"found":9234,"hit":9234}},"syntax":{"files":239,"functions":{"total":1865,"covered":1865},"statements":{"total":10393,"covered":10392},"branchArms":{"total":6653,"covered":6633}}}`.

The two models are kept apart. Neither row is derived from the other, and lines are never equated with statements.

| Model | Files | Functions | Statements or lines | Branches |
| --- | --- | --- | --- | --- |
| Native (Node's LCOV over the 230 loaded production files) | 230 records | 1890/1890 | 63825/63825 lines | 9234/9234 blocks |
| Syntax (the accepted Istanbul map over all 239 production files) | 239 | 1865/1865 | 10392/10393 statements | 6633/6653 arms |

Independent recount, computed apart from the pipeline over the two public artifacts:

| Check | Result |
| --- | --- |
| LCOV totals recounted line by line | 230 `SF:` records in the file, all 230 under `extensions/pi-claude-marketplace/`; LF 63825, LH 63825, FNF 1890, FNH 1890, BRF 9234, BRH 9234: equal to `acceptance.denominators.native` |
| LCOV zero-count entries | zero `DA:...,0`, zero `BRDA:...,0` (or `-`), zero `FNDA:0,...` entries |
| Map totals recounted over `f`, `s`, `b` | 239 files, functions 1865/1865, statements 10392/10393, arms 6633/6653: equal to `acceptance.denominators.syntax` |

The native invariant holds on this run: 100.00 percent lines, functions and branches over the loaded production files.

Comparison with Phase 7. The Phase 7 values are the certified figures of `07-MEASUREMENT.md` sections 4 and 9.3. They are the expected values, not this run's measurement.

| Denominator | This run | Phase 7 certified | Verdict |
| --- | --- | --- | --- |
| Native lines | 63825/63825 | 63825/63825 | equal |
| Native functions | 1890/1890 | 1890/1890 | equal |
| Native branches | 9234/9234 | 9234/9234 | equal |
| Syntax functions | 1865/1865 | 1865/1865 | equal |
| Syntax statements | 10392/10393 | 10392/10393 | equal |
| Syntax branch arms | 6633/6653 | 6633/6653 | equal |

## 5. Deficits and CRAP distribution

The fresh map holds 21 counters at zero, and every function executed. The one statement is `bridges/commands/discover.ts:289:6`. The twenty arms are `bridges/commands/discover.ts:288[0]`, `bridges/hooks/spawn-helpers.ts:113[1]`, `bridges/skills/stage.ts:391[1]`, `domain/source.ts:181[1]`, `edge/browser/plugin-browser.ts:309[1]`, `edge/browser/plugin-browser.ts:392[1]`, `orchestrators/marketplace/add.ts:734[1]`, `orchestrators/marketplace/autoupdate.ts:528[1]`, `orchestrators/plugin/clone-cache.ts:331[1]`, `orchestrators/plugin/info.ts:304[1]`, `orchestrators/plugin/info.ts:1602[1]`, `orchestrators/plugin/info.ts:1622[1]`, `orchestrators/plugin/install-outcome.ts:991[1]`, `orchestrators/plugin/reinstall-record.ts:78[1]`, `orchestrators/plugin/update-flow.ts:583[1]`, `orchestrators/plugin/update-swap.ts:318[1]`, `orchestrators/plugin/update-swap.ts:328[1]`, `orchestrators/plugin/update-swap.ts:338[1]`, `orchestrators/reconcile/apply.ts:618[1]` and `shared/notification-grammar.ts:171[1]`. This list is equal to `07-MEASUREMENT.md` section 6, with no delta. The dispositions in `07-MEASUREMENT.md` sections 8.2 and 8.3 stand unchanged.

CRAP distribution computed from `coverage/unit.risk.json` (`status: passed`, `runId` `20260919T002923698Z-2c0f1c43`, `policy.maxCrap` 30, 1865 production functions in 239 files, 0 at or above 30, 13100 other rows all `estimated` and not gated):

| Score | Functions |
| --- | --- |
| below 5 | 1394 |
| 5 to 9.99 | 377 |
| 10 to 19.99 | 88 |
| 20 to 29.99 | 6 |
| 30 or more | 0 |

- Maximum 20.00, held by six functions of cyclomatic 20 at 100 percent statement coverage: `edge/browser/plugin-browser.ts` `statusTag` (108), `statusDescription` (140), `availableActions` (179); `orchestrators/plugin/install.messaging.ts` `composeInstallFailureMessage` (226); `shared/notification-grammar.ts` `renderPluginRow` (901); `shared/notification-types.ts` `pluginVersion` (434). The anchor the gate prints is `plugin-browser.ts:108:0 (statusTag)`.
- One partially covered function: `bridges/commands/discover.ts:246 collectCommandFile`, 16 of 17 statements (ratio 0.9411764705882353), cyclomatic 6, score 6.007327498473438, labeled 6 by Fallow with `source: istanbul`.
- `failures` is empty.

Histogram, maximum, anchor, partial function and ratio are identical to `07-MEASUREMENT.md` sections 7 and 9.3.

## 6. Red classification

One non-zero exit was recorded in sections 2 and 3: `pre-commit run --all-files`. No chain member and no other gate was red.

| Command | Verbatim error | Classification | Cause | Debt or fix |
| --- | --- | --- | --- | --- |
| `pre-commit run --all-files` | `2026-09-18T20:56:09-04:00	error	trufflehog	error running scan	{"error": "failed to scan Git: error preparing repo: failed to read index file: open /home/acolomba/src/pi-claude-marketplace-test-backlog/.git/index: not a directory"}` | environment | This checkout is a git worktree. Its `.git` is a 95-byte file that reads `gitdir: /home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-test-backlog`. TruffleHog opens `.git/index` as if `.git` were a directory, so the scan cannot start here. | No fix in this plan and no change to the hook configuration. `CLAUDE.md` line 17 already prescribes `SKIP=trufflehog` for commits made inside a worktree, and the control `SKIP=trufflehog pre-commit run trufflehog --all-files` printed `Skipped` with `exit=0`. `detect private key` passed in the same run. CI's `lint.yml` runs the same hook on a normal checkout. The remaining 40 hooks passed or had no files to check, and no file was rewritten. |

## 7. What did not change

No production source under `extensions/` changed. No test, no script, no coverage configuration, census pin, threshold, suppression, direct pin, `.fallowrc.json` value, ESLint rule, Sonar property, pre-commit hook or `package.json` script changed. `maxCrap: 0` stays disabled in `.fallowrc.json` and the policy in `scripts/coverage-risk-policy.json` stays 30. Nothing was loosened to turn a gate green.

Evidence, exits captured directly:

- `git diff --quiet 0844c2a7 HEAD -- extensions tests scripts package.json package-lock.json .fallowrc.json eslint.config.js sonar-project.properties .pre-commit-config.yaml; echo "exit=$?"` printed `exit=0` at the HEAD each section of this document was written against.
- `git diff --name-only 0844c2a7 HEAD` lists 14 files, all under `.planning/`: `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, four Phase 7 records (`07-REVIEW-FIX.md`, `07-SECURITY.md`, `07-VALIDATION.md`, `07-VERIFICATION.md`) and seven Phase 8 records (`08-01-PLAN.md`, `08-02-PLAN.md`, `08-CONTEXT.md`, `08-MEASUREMENT.md`, `08-PATTERNS.md`, `08-RESEARCH.md`, `08-VALIDATION.md`). No path outside `.planning/` appears.
- `scripts/test-coverage-direct.pin.json` still holds exactly two rows: `bridges/commands/discover.ts` (`branches 55/56, lines 412/414`, BC-019) and `orchestrators/plugin/install-outcome.ts` (`branches 109/111, lines 1039/1045`, D-08-A14). The section 3 all-pairs row matched both exactly and recorded no other shortfall.
- `sonar-project.properties` has no `sonar.coverage.exclusions` line.
- `rg -c "fallow-ignore" extensions tests scripts` sums to 10 matches in 8 files. Seven are live markers (`index.ts`, `domain/resolver-types.ts`, `bridges/hooks/async-rewake/ring-buffer.ts`, `bridges/hooks/async-rewake/registry.ts`, `orchestrators/plugin/reinstall-replace.ts`, and the two `tests/live-uat/*-canary.mjs` drivers). Three are string literals inside planted fixtures in `tests/architecture/fallow-production-mode.test.ts`. `.planning/codebase/CONVENTIONS.md` recorded 11 markers on 2026-08-18, one of them in `scripts/revalidation.mjs`, which no longer exists. The difference predates this phase: the code tree is byte-identical to `0844c2a7`, so this phase added or removed no marker.

## 8. Item reconciliation

The eleven authorized items are listed in the order CONTEXT.md enumerates them, and no item was re-implemented in this phase. Each row names the record as it reads after this phase and the phase VERIFICATION.md frontmatter. It then names the fresh gate rows in sections 2 to 5 that evidence the item, and the disposition this phase wrote.

| Item | Phase | Record (heading as written after this phase) | Verification | Fresh evidence | Disposition |
| --- | --- | --- | --- | --- | --- |
| `NEGCTL-01` | 1 | `.planning/BACKLOG.md`, heading `## NEGCTL-01: the direct-coverage negative control cannot capture its child's stderr on Node 26 — CLOSED`; the body opens `Closed 2026-09-14 in test-backlog Phase 1.` | `01-VERIFICATION.md`: `status: passed`, `score: 5/5` | section 2 row 9: `npm run test:coverage:direct:negative` exit 0, `Direct-coverage negative controls passed.`; section 3 `test:coverage:direct:all` exit 0, 239 pairs | already closed, cited |
| `E2EIMP-01` | 1 | `.planning/BACKLOG.md`, heading `## ~~E2EIMP-01: three import e2e tests assert a summary header the command no longer emits~~ -- CLOSED AS STALE`; the body opens `Revalidated 2026-09-14 (test-backlog HIST-01)` | `01-VERIFICATION.md`: `status: passed`, `score: 5/5` | section 3 `test:e2e` exit 0, `tests 14 / pass 14 / fail 0`, with the three `import` cases (`imports enabled Claude settings across both scopes`, `--scope project narrows writes to project scope`, `reports source mismatches and skips dependent plugins`) all passing | already closed, cited |
| `TESTQ-01` | 1 | `.planning/BACKLOG.md`, heading `## ~~TESTQ-01: act on the two-pass unit-test review corpus~~ -- CLOSED`; the body opens `Reconfirmed 2026-09-14` and records the `refine-unit-tests` closure with disposition `implemented` | `01-VERIFICATION.md`: `status: passed`, `score: 5/5` | section 2 row 2: `npm run lint` exit 0; section 2 row 5: `npm run fallow` exit 0; plus the archived closure the record cites | already closed, cited |
| `FLOW-07` | 1 | `.planning/BACKLOG.md`, heading `## ~~FLOW-07: is the ESLint no-restricted-paths zone matrix now redundant?~~ -- CLOSED`; the body opens `Reconfirmed 2026-09-14: archived GGAT-03 remains checked complete` | `01-VERIFICATION.md`: `status: passed`, `score: 5/5` | section 2 row 2: `npm run lint` exit 0; section 2 row 5: `npm run fallow` exit 0 (the cycle and boundary runs); plus the archived GGAT-03 closure (7/7) the record cites | already closed, cited |
| `COV-01` | 1 | `.planning/BACKLOG.md`, heading `## ~~COV-01: coverage exclusion policy, and the two out-of-bound orchestrators~~ -- SUPERSEDED`; the body opens `Disposition 2026-09-11: superseded` | `01-VERIFICATION.md`: `status: passed`, `score: 5/5` | section 3 `test:coverage:direct:all` exit 0: both orchestrators sit among the 237 `Direct coverage passed` rows and neither is a pinned shortfall. The run's `coverage/all-pairs.jsonl` records `orchestrators/import/execute.ts` at `branches 149/149, functions 34/34, lines 1213/1213` and `orchestrators/marketplace/update.ts` at `branches 124/124, functions 17/17, lines 885/885`. Section 7: `sonar-project.properties` has no `sonar.coverage.exclusions` line | already closed, cited |
| `SWTEST-01` | 2 | `.planning/BACKLOG.md`, heading now `## ~~SWTEST-01: the Sonar way ruleset stops at extensions/; tests/ is unmeasured by it~~ -- CLOSED`; the body already opened `Closed 2026-09-14 — test-backlog Phase 2.` before this phase and is unchanged | `02-VERIFICATION.md`: `status: passed`, `score: 4/4` | section 2 row 2: `npm run lint` exit 0 with no findings (the Sonar test rules run inside this member over `tests/`) | heading closed to match body |
| `AGCOL-01` | 3 | `.planning/BACKLOG.md`, heading `## ~~AGCOL-01: the agents collision gate is dead by the same argument that retired the skills one~~ — CLOSED`; the body opens `Current disposition, 2026-09-14: Closed in test-backlog Phase 3, commit b663bc68` | `03-VERIFICATION.md`: `status: passed`, `score: 18/18` | section 2 row 10: `npm run test:coverage:unit` exit 0, 6900/6900 with native 100% over the agents bridge; section 2 row 14: `npm run test:integration` exit 0, 32/32 including the two global-peer cases | already closed, cited |
| `ARGS-01` | 4 | `.planning/BACKLOG.md`, heading `## ~~ARGS-01: the edge parse layer silently swallows unknown flags and surplus positionals~~ — CLOSED`; the body opens `Current disposition, 2026-09-14: Closed in test-backlog Phase 4, commit a8ef0dac` | `04-VERIFICATION.md`: `status: passed`, `score: 7/7` | section 2 row 10: `npm run test:coverage:unit` exit 0, 6900/6900 with native 100% over the edge parse layer; section 2 row 14: `npm run test:integration` exit 0, 32/32 | already closed, cited |
| `FLOW-09` | 5 | `.planning/BACKLOG.md`, heading `## FLOW-09: internals exported only for tests -- CLOSED`; the body records `Production mode: DONE, and this closes the item.` | `05-VERIFICATION.md`: `status: passed`, `score: 10/10` | section 2 row 5: `npm run fallow` exit 0, `fallow dead-code` `✓ No issues found` under the production-mode `.fallowrc.json` that section 7 shows unchanged | already closed, cited |
| `2026-09-02-detect-unused-code-and-type-members.md` | 6 | `.planning/todos/completed/2026-09-02-detect-unused-code-and-type-members.md` (moved from `todos/pending/` with `git mv`), closure paragraph `Closed 2026-09-17 — test-backlog Phase 6.` under the H1, frontmatter unchanged; `.planning/STATE.md` deferred-items `Tooling` row status `closed — test-backlog Phase 6 (06-VERIFICATION 2/2); gate lint:type-members in check` | `06-VERIFICATION.md`: `status: passed`, `score: 2/2` | section 2 row 15: `npm run lint:type-members` exit 0, `Unused type member gate passed with 5 recorded exception(s).`; section 2 row 16: `npm run lint:type-members:negative` exit 0, `Unused type member negative controls passed (7 of 7).` | moved to completed/, closure note added, STATE.md row closed |
| `FLOW-05` | 7 | `.planning/BACKLOG.md`, heading `## ~~FLOW-05: revisit CRAP and real coverage in the fallow health gate~~ -- CLOSED`, closure paragraph `Closed 2026-09-18 in test-backlog Phase 7` inserted above the original filing, which is unchanged | `07-VERIFICATION.md`: `status: passed`, `score: 8/8` (frontmatter; the report body counts 10/10) | section 2 row 12: `npm run coverage:risk` exit 0, `max CRAP 20.00 ... policy < 30`; section 5: 0 of 1865 production functions at or above 30, histogram identical to Phase 7; section 7: `.fallowrc.json` `maxCrap: 0` and the policy 30 unchanged | closed with closure note |

### 8.1 Not in scope, left as found

- `.planning/HANDOFF.json` and `.planning/phases/05-production-export-ownership/.continue-here.md`: stale Phase 5 pause residue. Neither is an authorized item, and their removal is a milestone-close decision, so both stay as found.
- Milestone archival: belongs to `/gsd-complete-milestone`, run after `/gsd-verify-work 8`.
- Pushing the branch and opening the pull request: belongs to `/gsd-ship`.
- Raising the global `pi-subagents` peer to the 0.62.0 `excludeTools` floor: an environment task on this machine, not phase work. Both global-peer integration tests passed on the installed 0.47.1 (section 2 row 14).
- A version bump and a `CHANGELOG.md` entry: excluded by the CONTEXT.md release-artifacts decision. Only `/gsd-ship` can supply the pull request number the changelog format needs.
