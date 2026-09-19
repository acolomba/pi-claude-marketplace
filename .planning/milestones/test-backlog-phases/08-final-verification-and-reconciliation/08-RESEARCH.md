# Phase 8: Final Verification and Reconciliation - Research

**Researched:** 2026-09-18
**Domain:** Repository gate execution, coverage measurement, and planning-record reconciliation (no product code)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Gate execution (FINAL-01)
- The complete gate is `npm run check` (typecheck, lint, workflow lints, fallow,
  format, corresponding-test controls, direct-coverage negative, verified unit
  coverage, coverage negatives, coverage risk and its negative, integration,
  type-member gate and its negative), plus `npm run test:e2e` (pinned ref),
  `npm run test:coverage:direct:all`, and `pre-commit run --all-files`. All run
  fresh at the phase HEAD; Phase 7 numbers are evidence, not a substitute.
- The branch was never pushed (292 ahead of `origin/main`, 0 behind), so local
  runs are the evidence. Record each command, its exit status and its counts in
  a phase measurement document.
- The 100% claim comes from the validated same-run aggregate unit capture
  (`coverage/unit.lcov`) in all three dimensions. The direct-pair pin and the
  integration/e2e reports remain separate measurements and are reported as such.
- A failing gate is classified before it is acted on: a regression is fixed
  through reachable public behavior; an environment failure is recorded as a debt
  with its cause. Known candidate: two integration tests resolve `pi-subagents`
  from `npm root -g` (global 0.47.1; the `excludeTools` floor is 0.62.0). No
  threshold, exclusion, suppression or pin may be loosened to turn a gate green.
- e2e needs network (a depth-1 fetch of the pinned upstream marketplace SHA). If
  the sandbox blocks it, record the launch error verbatim as an environment
  debt; do not treat a launch error as a passing or skipped gate.

### Item reconciliation (FINAL-02)
- The authorized items are NEGCTL-01, E2EIMP-01, TESTQ-01, FLOW-07, COV-01
  (Phase 1); SWTEST-01 (Phase 2); AGCOL-01 (Phase 3); ARGS-01 (Phase 4);
  FLOW-09 (Phase 5); the pending todo
  `2026-09-02-detect-unused-code-and-type-members.md` (Phase 6); FLOW-05
  (Phase 7). Each disposition cites its phase VERIFICATION.md status and score
  and the fresh gate result; nothing is re-implemented.
- Records to write: close `FLOW-05` in BACKLOG.md (the only heading still open;
  the CRAP 30 policy lives in `scripts/coverage-risk-policy.json`, whole-tree
  `maxCrap: 0` is unchanged by design); mark the `SWTEST-01` heading closed to
  match its body; move the pending todo to `todos/completed/`; flip the STATE.md
  deferred-items row "Tooling — Detect unused code and unused type members" from
  Pending to closed; check FINAL-01/FINAL-02 in REQUIREMENTS.md and set their
  traceability rows to Complete.
- Preserve `.planning/milestones/`, `inputs/test-backlog/`, every phase
  directory and every completed summary. Reconciliation edits are additive
  closure notes, never rewrites of history.
- Preserve the uncommitted local configuration edits (`.claude/settings.json`,
  `.codex/config.toml`, `.planning/state.json`, `.mcp.json`); never stage them.

### Release artifacts
- No version bump and no CHANGELOG entry in this phase. The previous two test
  milestones shipped with no npm release, and the changelog now lists one entry
  per pull request ending in its number, which only `/gsd-ship` can supply.

### Claude's Discretion
- Shape and name of the phase measurement document, the order of the gate runs,
  and how the closure notes are worded, subject to the comment and prose
  policies already in force (no phase/plan/wave references in source comments).

### Deferred Ideas (OUT OF SCOPE)
- Raising the global `pi-subagents` peer to the 0.62.0 `excludeTools` floor on
  this machine is an environment task, not phase work.
- Pushing the branch and opening the PR belongs to `/gsd-ship` after the
  milestone completes.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FINAL-01 | Preserve 100% aggregate unit production coverage, assertion strength, direct-pair requirements, and all required quality checks. | Section "Live Gate Measurements" (every gate measured at HEAD `e433c5bf`, with exit statuses and counts); section "Aggregate Unit Coverage" (native 63825/63825, 1890/1890, 9234/9234 recounted independently from `coverage/unit.lcov`); section "Validation Architecture" (the exact commands that prove it). |
| FINAL-02 | Account for all authorized backlog/todo items with implementation evidence or a current user-agreed disposition. | Section "Reconciliation Inventory" (eleven items, record location with line numbers, existing closure state, VERIFICATION.md status and score, edit needed); section "Closure note template" (verbatim copy of an existing closure). |
</phase_requirements>

## Summary

This phase writes no product code. It runs the full gate set once more at the phase HEAD, records the result in a measurement document shaped like `07-MEASUREMENT.md`, and adds closure notes to the planning records that still read as open. The research therefore consisted of running every required command at the current HEAD (`e433c5bf`, the `08-CONTEXT.md` commit; the last commit touching `extensions/` is `31ed3c72`, the last touching `tests/` and `scripts/` is `0844c2a7`) and reading every record the reconciliation touches.

Result of the live run: all sixteen members of `npm run check` exit 0 (1300 s total, 21 min 40 s); `npm run test:e2e` exits 0 with 14/14 (the network was reachable and the depth-1 fetch of the pinned SHA succeeded); `npm run test:coverage:direct:all` exits 0 with 239 pairs and the two pinned shortfalls matched exactly; `pre-commit run --all-files` exits 1 with exactly one failing hook, TruffleHog, whose error is `failed to read index file: open .../.git/index: not a directory` because this checkout is a git worktree (`.git` is a file). That is an environment failure already covered by `CLAUDE.md` line 17 (`SKIP=trufflehog` inside worktrees); the other 40 hooks passed or had no files, and no file was rewritten. The aggregate unit capture `20260918T225947291Z-f055e502` reports native 63825/63825 lines, 1890/1890 functions, 9234/9234 branches over 230 loaded of 239 production files, identical to Phase 7's certified figures. The candidate environment failure named in CONTEXT.md (the two global-peer integration tests) did not occur: 32/32 integration tests pass against global `pi-subagents` 0.47.1.

Reconciliation: of the eleven authorized items, nine already carry a closure or superseded disposition in their record. Two records still need an additive closure edit (`FLOW-05` body and `SWTEST-01` heading), one todo needs to move to `todos/completed/`, one STATE.md deferred row needs its status flipped, and REQUIREMENTS.md/ROADMAP.md need their FINAL-01/02 and Phase 8 rows advanced. Every phase 1-7 VERIFICATION.md reads `status: passed` with a full score; `init.manager` reports all seven as `stale`, which is the known `covered_files` timestamp artifact and not an outcome verdict.

**Primary recommendation:** Plan two plans: (1) a measurement plan that re-runs the gate set as separate commands (never one `npm run check` inside one tool call), writes `08-MEASUREMENT.md` in the `07-MEASUREMENT.md` shape, and classifies the one expected red (TruffleHog, environment); (2) a reconciliation plan that adds the closure notes listed in the inventory table, moves the todo, and advances REQUIREMENTS/ROADMAP/STATE by hand-edit verified with `git diff`, staging only the named planning files.

## Project Constraints (from CLAUDE.md)

Directives that bind this phase [VERIFIED: /home/acolomba/src/pi-claude-marketplace-test-backlog/CLAUDE.md, read this session]:

- Read before editing; trace callers before modifying a function (no functions are modified here).
- NEVER commit to `main`; the work stays on `features/test-backlog`.
- Commit messages follow Conventional Commits; title 5-72 chars; body lines <= 80 chars; avoid GSD milestone/phase mentions in titles and PR titles (Phase 7's close used `docs: close the reliable coverage metrics phase`).
- Run `pre-commit run --all-files` (or `--files <changed>`) BEFORE `git commit`; a failed hook means the commit did not happen; never `--amend` to recover; NEVER `--no-verify`.
- "When committing from inside a worktree, prefix the commit with `SKIP=trufflehog`." (CLAUDE.md line 17) -- this checkout IS a worktree (see Environment Availability).
- NEVER rebase or rewrite history.
- Version bump offer before a PR: explicitly declined by CONTEXT.md for this phase (no bump, no CHANGELOG entry).
- Quality bar: `npm run check` must stay green (NFR-6).
- GSD workflow enforcement: edits go through `/gsd-execute-phase`.
- Source-comment policy (skills/typescript-comments): no phase/plan/wave references in source comments. Not triggered -- this phase edits planning documents only, where phase references are the norm (see the existing BACKLOG closures).

## Architectural Responsibility Map

This phase has no runtime tiers. The map below assigns each capability to the tool or file that owns it, which is what the planner needs to route tasks.

| Capability | Primary Owner | Secondary Owner | Rationale |
|------------|---------------|-----------------|-----------|
| Quality gate execution | `package.json` `check` chain (16 members) | `.pre-commit-config.yaml` (same gates as hooks) | The chain is the CI contract; pre-commit re-runs a subset per commit |
| Aggregate unit coverage proof | `scripts/coverage-unit.mjs` -> `coverage/unit.manifest.json` + `coverage/unit.lcov` | `scripts/coverage-validate.mjs` (readback) | Only an accepted bundle carries the 100% claim (D-01 native model) |
| Direct-pair pin | `scripts/test-coverage-direct.mjs --all` + `scripts/test-coverage-direct.pin.json` | -- | A separate measurement from the aggregate; reported apart |
| e2e against upstream | `tests/e2e/_helpers.ts` (`git fetch --depth 1 origin <PINNED_SHA>`) | network | Only gate that needs the network |
| Measurement record | `.planning/phases/08-.../08-MEASUREMENT.md` (new) | `08-VERIFICATION.md` (verifier) | Precedent: `07-MEASUREMENT.md` |
| Item dispositions | `.planning/BACKLOG.md`, `.planning/todos/`, `.planning/STATE.md` | `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` | Additive closure notes; history preserved |
| Phase/milestone bookkeeping | Hand-edit of STATE.md / ROADMAP.md / REQUIREMENTS.md | `git diff` as the check | GSD verbs are unreliable here (see Pitfalls) |

## Standard Stack

No libraries are added. The tools below are what the phase runs, with the versions measured this session.

### Core
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Node.js | v26.8.2 [VERIFIED: `node --version`] | Runs every gate; the accepted bundle binds this runtime | Same runtime as Phase 7's certification |
| npm | 11.19.1 [VERIFIED: `npm --version`] | Script runner | -- |
| pre-commit | 4.5.1 [VERIFIED: `pre-commit --version`] | 41-hook pipeline | CI `lint.yml` runs the same file |
| fallow | 3.23.0 [VERIFIED: `npx fallow --version`] | dead-code, cycles, health, dupes, CRAP consumer | Pinned by `scripts/coverage-risk-policy.json` (`"version": "3.23.0"`) [VERIFIED: file read this session] |
| gsd-tools | in-repo shim `.claude/gsd-core/bin/gsd-tools.cjs` [VERIFIED: init.phase-op ran] | `init.phase-op`, `list-todos`, `todo complete`, `init.manager` | `phase complete` / state verbs: see Pitfalls |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| git | worktree at `gitdir: /home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-test-backlog` [VERIFIED: `cat .git`] | `git diff` verification of hand edits; explicit-path staging | Every commit |
| TruffleHog | v3.92.4 (pre-commit rev) [VERIFIED: `.pre-commit-config.yaml:47`] | Secret scan | Fails in worktrees; skip per CLAUDE.md |

**Installation:** none. **Package Legitimacy Audit:** not required -- this phase installs no external package (verified: no `npm install` in any decision; `package.json`/`package-lock.json` untouched since `14658799`).

## Live Gate Measurements (FINAL-01)

All commands ran from `/home/acolomba/src/pi-claude-marketplace-test-backlog` on HEAD `e433c5bf960036f51f92d63d0c6c438e039c6c95` (`docs(08): smart discuss context`), Node v26.8.2, npm 11.19.1, between 2026-09-18T22:55:25Z and 23:40:04Z. Each `npm run <member>` ran as its own process from a sequential detached shell script; exit statuses were captured directly (`rc=$?` on the command, never through a pipe). Logs are in the session scratchpad (`gates/NN-<member>.log`), not committed. [VERIFIED: this session]

### The `npm run check` chain, member by member

| # | Command | Exit | Seconds | Counts / output line |
|---|---------|------|---------|----------------------|
| 1 | `npm run typecheck` | 0 | 37 | `tsc --noEmit`, no diagnostics |
| 2 | `npm run lint` | 0 | 163 | `eslint extensions tests scripts eslint.config.js`, no findings |
| 3 | `npm run lint:workflows` | 0 | 1 | `Workflow install-scripts gate passed.` |
| 4 | `npm run lint:workflows:negative` | 0 | 0 | `Workflow install-scripts negative controls passed.` |
| 5 | `npm run fallow` | 0 | 5 | dead-code `✓ No issues found`; cycles `✓ No issues found`; health `0 above threshold · 14965 analyzed · maintainability 91.8 (good)`; dupes `1,819 lines (1.9%) duplicated across 61 files`. The health and dupes lines print a red `✗` glyph while exiting 0 (known: fallow-dupes red-glyph/green-exit) |
| 6 | `npm run format:check` | 0 | 47 | prettier `--check`, all matched files formatted |
| 7 | `npm run test:corresponding` | 0 | 3 | `Corresponding-test gate passed.` |
| 8 | `npm run test:corresponding:negative` | 0 | 1 | `Corresponding-test negative controls passed.` |
| 9 | `npm run test:coverage:direct:negative` | 0 | 4 | `Base-selection, pair-enumeration and coverage-pin negative controls passed: ...` |
| 10 | `npm run test:coverage:unit` | 0 | 452 | `tests 6900 / suites 284 / pass 6900 / fail 0 / cancelled 0 / skipped 0 / todo 0 / duration_ms 367455.9`; capture `20260918T225947291Z-f055e502`: 312 worker(s), 543 raw record(s), 618 module(s), 9 unloaded production source(s); `Coverage map validated: ... 239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es)`; `Coverage unit verified: ... native 63825/63825 line(s), 1890/1890 function(s), 9234/9234 branch(es); syntax 1865/1865 function(s), 10392/10393 statement(s), 6633/6653 branch arm(s)` |
| 11 | `npm run coverage:unit:negative` | 0 | 17 | `Verified unit coverage negative controls passed (32 of 32).` |
| 12 | `npm run coverage:risk` | 0 | 12 | `Coverage risk verified: 20260918T225947291Z-f055e502, 1865 production function(s) in 239 file(s) measured, max CRAP 20.00 at extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts:108:0 (statusTag), policy < 30; 13100 other row(s) not gated` |
| 13 | `npm run coverage:risk:negative` | 0 | 35 | `Coverage risk negative controls passed (20 of 20).` |
| 14 | `npm run test:integration` | 0 | 13 | `tests 32 / pass 32 / fail 0 / skipped 0`; includes `T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser` and `SC-2 / AGSK-06: emitted skillPath resolves the staged skill via pi-subagents' resolveSkillsWithFallback ...` both `✔` |
| 15 | `npm run lint:type-members` | 0 | 86 | `Unused type member gate passed with 5 recorded exception(s).` |
| 16 | `npm run lint:type-members:negative` | 0 | 424 | `Unused type member negative controls passed (7 of 7).` |

Chain total: 1300 s (21 min 40 s). Phase 7 measured the same chain at 1287 s. [VERIFIED: scratchpad `gates/SUMMARY.txt`]

### The three additional gates

| Command | Exit | Seconds | Counts / output line | Classification |
|---------|------|---------|----------------------|----------------|
| `npm run test:e2e` | 0 | 10 | `tests 14 / pass 14 / fail 0 / skipped 0 / duration_ms 9381`; the three `import` cases (`imports enabled Claude settings across both scopes`, `--scope project narrows writes to project scope`, `reports source mismatches and skips dependent plugins`) all `✔`; `real Pi runtime package bin loads the extension under isolated HOME and cwd` `✔` (6.4 s) | pass; network was reachable (`git ls-remote https://github.com/anthropics/claude-plugins-official` exit 0 before the run) |
| `npm run test:coverage:direct:all` | 0 | 509 | `All-pair run complete: 239 pairs in 508.6s (508588ms) on v26.8.2`; 237 `Direct coverage passed` rows; `2 pinned shortfall(s) matched scripts/test-coverage-direct.pin.json exactly` (`bridges/commands/discover.ts` branches 55/56, lines 412/414; `orchestrators/plugin/install-outcome.ts` branches 109/111, lines 1039/1045); report at `coverage/all-pairs.jsonl` (239 lines) | pass; pin unchanged |
| `pre-commit run --all-files` | **1** | 838 | 35 hooks `Passed`, 5 `Skipped` (no files to check), 1 `Failed`: **TruffleHog** -- `error running scan {"error": "failed to scan Git: error preparing repo: failed to read index file: open /home/acolomba/src/pi-claude-marketplace-test-backlog/.git/index: not a directory"}`. All npm hooks passed (`npm lint`, `npm format check`, `npm typecheck`, `npm fallow`, `npm lint workflows`, `npm direct coverage (changed pairs)`, `npm type members`, `npm type members (negative controls)`, `npm unit coverage (verified bundle)`, `npm coverage risk`); mdformat, markdownlint-cli2, zizmor, yamllint, yamlfmt, prettier passed. `git status --short` before and after is byte-identical (` M .claude/settings.json`, ` M .codex/config.toml`, ` M .planning/state.json`, `?? .mcp.json`): **no file was rewritten** | **environment, not regression**: `.git` here is a 95-byte file (`gitdir: /home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-test-backlog`) because this checkout is a worktree; TruffleHog opens `.git/index` as if `.git` were a directory. `CLAUDE.md:17` already prescribes `SKIP=trufflehog` for commits made inside a worktree. `SKIP=trufflehog pre-commit run trufflehog --all-files` reports `Skipped`, exit 0 |

Post-run readbacks, exit captured directly: `npm run coverage:validate` exit 0 (`Coverage bundle verified: 20260918T225947291Z-f055e502, 239 file(s), 1865 function(s), 10393 statement(s), 3089 branch(es)`); `npm run coverage:risk -- --report coverage/unit.risk.json` exit 0. The published bundle survived `pre-commit run --all-files` unchanged (`npm-coverage-unit` reused it: same `runId`, `acceptedAt: 2026-09-18T23:07:14.395Z`, `coverage/runs/` holds only `20260918T225947291Z-f055e502`). [VERIFIED: this session]

**Red classification summary:** one red, `pre-commit run --all-files` -> TruffleHog, classified environment (worktree `.git` file). Zero regressions. The CONTEXT.md candidate (global `pi-subagents` 0.47.1 vs the 0.62.0 `excludeTools` floor) produced no red: both `npm root -g` resolvers passed. The reason is that those two tests exercise pi-subagents' frontmatter parser and `resolveSkillsWithFallback`, not `excludeTools`; the floor only matters to the agents bridge's warning text, which unit tests cover with fakes. [VERIFIED: integration log + `tests/integration/skill-path-resolution.test.ts:58-80` read this session]

### Aggregate Unit Coverage (the FINAL-01 100% claim)

Published bundle `20260918T225947291Z-f055e502`: started 22:59:47Z, completed 23:06:08Z, accepted 23:07:14Z; runtime `{"node":"v26.8.2","v8":"14.6.202.34-node.28","platform":"linux","arch":"x64"}`. Digests (sha256, first 16): `coverage/unit.lcov` `dd85503c74f59d61`, `coverage/unit.istanbul.json` `1748b8d2abfaefa7`, `coverage/unit.manifest.json` `39a577cc3a087653`, `coverage/unit.validation.json` `ebb38cb9a6b0dd09`. [VERIFIED: `sha256sum` this session]

Manifest `acceptance.population` (quoted): `{"production":239,"loaded":230,"typeOnly":8,"executable":1}` with the nine unloaded paths `bridges/agents/types.ts`, `bridges/commands/types.ts`, `bridges/hooks/exec-result.ts`, `bridges/mcp/types.ts`, `bridges/skills/types.ts`, `domain/resolver-types.ts`, `edge/types.ts`, `orchestrators/import/types.ts` (type-only) and `orchestrators/types.ts` (executable, 0 functions/statements/branches). [VERIFIED: `coverage/unit.manifest.json` read this session]

Manifest `acceptance.denominators` (quoted): `{"native":{"records":230,"lines":{"found":63825,"hit":63825},"functions":{"found":1890,"hit":1890},"branches":{"found":9234,"hit":9234}},"syntax":{"files":239,"functions":{"total":1865,"covered":1865},"statements":{"total":10393,"covered":10392},"branchArms":{"total":6653,"covered":6633}}}`. [VERIFIED: same]

Independent recount, in the form `07-MEASUREMENT.md` section 5 used:

| Model | Files | Functions | Statements or lines | Branches |
|-------|-------|-----------|---------------------|----------|
| Native (`coverage/unit.lcov`, records under `extensions/pi-claude-marketplace/`) | 230 records (230 of 230 `SF:` records are production) | 1890/1890 | 63825/63825 lines | 9234/9234 blocks |
| Syntax (`coverage/unit.istanbul.json`) | 239 | 1865/1865 | 10392/10393 statements | 6633/6653 arms |

Zero `DA:...,0`, zero `BRDA:...,0` (or `-`), zero `FNDA:0,...` entries in the LCOV (counted line by line). The 21 syntax deficits are exactly Phase 7's list: the one statement `bridges/commands/discover.ts:289` and the twenty arms at `discover.ts:288[0]`, `bridges/hooks/spawn-helpers.ts:113[1]`, `bridges/skills/stage.ts:391[1]`, `domain/source.ts:181[1]`, `edge/browser/plugin-browser.ts:309[1]`, `:392[1]`, `orchestrators/marketplace/add.ts:734[1]`, `orchestrators/marketplace/autoupdate.ts:528[1]`, `orchestrators/plugin/clone-cache.ts:331[1]`, `orchestrators/plugin/info.ts:304[1]`, `:1602[1]`, `:1622[1]`, `orchestrators/plugin/install-outcome.ts:991[1]`, `orchestrators/plugin/reinstall-record.ts:78[1]`, `orchestrators/plugin/update-flow.ts:583[1]`, `orchestrators/plugin/update-swap.ts:318[1]`, `:328[1]`, `:338[1]`, `orchestrators/reconcile/apply.ts:618[1]`, `shared/notification-grammar.ts:171[1]`. Their dispositions in `07-MEASUREMENT.md` sections 8.2-8.3 stand unchanged. [VERIFIED: recount script over the two artifacts this session]

CRAP distribution from `coverage/unit.risk.json` (1865 functions, `failures: []`): below 5: 1394; 5 to 9.99: 377; 10 to 19.99: 88; 20 to 29.99: 6; 30 or more: 0; maximum 20.00 at `plugin-browser.ts:108 statusTag`; one partial function `collectCommandFile` at 16/17 statements (0.9412). Identical to `07-MEASUREMENT.md` section 7 and 9.3. [VERIFIED: computed from the report this session]

**Every figure equals Phase 7's certified run `e88ba46e`.** This is expected: no commit since `0844c2a7` touched `extensions/`, `tests/` or `scripts/` (`git log -1 -- <path>`), and Phase 7 section 5 showed the counters that differ between runs are timing-dependent execution counts, never zero/nonzero flips.

Note on STATE.md: its Current Position paragraph still cites the Phase 6-era figures "1833/1833 functions, 9049/9049 branches". The authoritative current figures are the ones above; the STATE.md text is history and need not be rewritten (additive policy), but the new Current Position paragraph the plan writes should cite the fresh numbers.

## Reconciliation Inventory (FINAL-02)

Line numbers are for the files at HEAD `e433c5bf` [VERIFIED: `grep -n` and `sed -n` this session]. "Edit needed" is the delta the plan must write; "none" means the record already carries its disposition and only the measurement document needs to cite it.

| Item | Phase | Record (file:line, heading as written) | Existing disposition in the record | Evidence (VERIFICATION.md frontmatter) | Edit needed |
|------|-------|----------------------------------------|------------------------------------|----------------------------------------|-------------|
| NEGCTL-01 | 1 | `BACKLOG.md:2891` `## NEGCTL-01: the direct-coverage negative control cannot capture its child's stderr on Node 26 — CLOSED` | Closure paragraph at 2893-2900: "Closed 2026-09-14 in test-backlog Phase 1 ... verification passed 5/5 ... The original report below is preserved as history." | `01-VERIFICATION.md`: `status: passed`, `score: 5/5 must-haves verified`, `verified: 2026-09-14T14:41:23Z` | none (fresh evidence: chain #9 exit 0) |
| E2EIMP-01 | 1 | `BACKLOG.md:2936` `## ~~E2EIMP-01: ...~~ -- CLOSED AS STALE` | "Revalidated 2026-09-14 (test-backlog HIST-01): ... passes all three cases (3 pass, 0 fail) on Node v26.8.2." | `01-VERIFICATION.md` 5/5 (HIST-01) | none (fresh evidence: `test:e2e` 14/14 incl. the three import cases) |
| TESTQ-01 | 1 | `BACKLOG.md:2691` `## ~~TESTQ-01: act on the two-pass unit-test review corpus~~ -- CLOSED` | "Reconfirmed 2026-09-14: the archived completed requirements preserve this closure." Closed 2026-09-11 by refine-unit-tests, `implemented` | `01-VERIFICATION.md` 5/5 (HIST-01) | none |
| FLOW-07 | 1 | `BACKLOG.md:487` `## ~~FLOW-07: is the ESLint no-restricted-paths zone matrix now redundant?~~ -- CLOSED` | "Reconfirmed 2026-09-14: archived GGAT-03 remains checked complete and its Phase 7 verification remains passed (7/7)." | `01-VERIFICATION.md` 5/5 (HIST-01) | none |
| COV-01 | 1 | `BACKLOG.md:99` `## ~~COV-01: coverage exclusion policy, and the two out-of-bound orchestrators~~ -- SUPERSEDED` | "Disposition 2026-09-11: `superseded` (RCOV-04 ...)"; both orchestrators inside the all-pair baseline, neither in the pin | `01-VERIFICATION.md` 5/5 (HIST-01) | none (fresh evidence: `direct:all` passed `orchestrators/import/execute.ts` 149/149 branches, 34/34 functions, 1213/1213 lines and `orchestrators/marketplace/update.ts` 124/124, 17/17, 885/885; `sonar-project.properties` has no `sonar.coverage.exclusions`) |
| SWTEST-01 | 2 | `BACKLOG.md:2811` `## SWTEST-01: the Sonar way ruleset stops at extensions/; tests/ is unmeasured by it` (heading reads OPEN) | Body 2813-2823: "**Closed 2026-09-14 — test-backlog Phase 2.** ... Independent verification passed 4/4 ..." | `02-VERIFICATION.md`: `status: passed`, `score: 4/4 must-haves verified` | **heading only**: mark closed to match the body, e.g. `## ~~SWTEST-01: ...~~ -- CLOSED` (the `~~...~~ -- CLOSED` form is the majority style: TESTQ-01, FLOW-07, E2EIMP-01, ARGS-01, AGCOL-01) |
| AGCOL-01 | 3 | `BACKLOG.md:1978` `## ~~AGCOL-01: ...~~ — CLOSED` | "Current disposition, 2026-09-14: Closed in test-backlog Phase 3, commit b663bc68; ... verification passed 18/18." | `03-VERIFICATION.md`: `status: passed`, `score: 18/18 must-haves verified` | none |
| ARGS-01 | 4 | `BACKLOG.md:2206` `## ~~ARGS-01: ...~~ — CLOSED` | "Current disposition, 2026-09-14: Closed in test-backlog Phase 4, commit a8ef0dac; ... verification passed 7/7." | `04-VERIFICATION.md`: `status: passed`, `score: 7/7 must-haves verified` | none |
| FLOW-09 | 5 | `BACKLOG.md:638` `## FLOW-09: internals exported only for tests -- CLOSED` | "Production mode: DONE, and this closes the item." (`.fallowrc.json` `production: {deadCode: true, ...}`) | `05-VERIFICATION.md`: `status: passed`, `score: 10/10 must-haves verified` | none (fresh evidence: chain #5 `fallow dead-code` no issues) |
| todo `2026-09-02-detect-unused-code-and-type-members.md` | 6 | `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` (frontmatter `resolves_phase: 6`); STATE.md:97 deferred row `Tooling | Detect unused code and unused type members ... | Pending | Phase 116 discussion | v1.19`; STATE.md:99 row `todos | 2026-09-02-detect-... | (presence-only) | 2026-09-04 | v1.19` | Todo body opens with "**Promoted 2026-09-14:** explicitly authorized for test-backlog Phase 6, MEMBER-01/02." No closure note; still under `pending/` | `06-VERIFICATION.md`: `status: passed`, `score: 2/2 must-haves verified` | **move** to `.planning/todos/completed/` (`git mv`, or `gsd-tools todo complete 2026-09-02-detect-unused-code-and-type-members.md` then stage both paths) with an additive closure paragraph at the top of the body; **flip** STATE.md:97 status cell from `Pending` to a closed wording (e.g. `closed — test-backlog Phase 6, 06-VERIFICATION 2/2`); STATE.md:99 is a presence-only acknowledgment and may stay, optionally annotated (discretion) |
| FLOW-05 | 7 | `BACKLOG.md:392` `## FLOW-05: revisit CRAP and real coverage in the fallow health gate` (heading OPEN, body 394-417 has no closure) | none -- the body still ends "Until then `maxCrap: 0` is the honest setting" | `07-VERIFICATION.md`: `status: passed`, `score: 8/8 must-haves verified` (frontmatter; the report body and the close commit say 10/10 -- cite the frontmatter and mention the body count) | **heading + closure paragraph**: mark closed and insert a closure paragraph above "Filed 2026-08-16 ..." that states: CRAP is now measured from the verified Istanbul map (`scripts/coverage-unit.mjs` pipeline, `docs/coverage-metrics.md`), gated at 30 by `scripts/coverage-risk-policy.json` through `npm run coverage:risk` in `check`, pre-commit and CI; whole-tree `.fallowrc.json` `maxCrap: 0` unchanged by design (the policy file, not the fallow config, owns the threshold); fresh result 0 of 1865 at or above 30, max 20.00; the three bullets below about `c8`/`-1` columns are the historical reason the conversion had to be owned first, and are retained as history |

Also part of FINAL-02 bookkeeping (not items, but records the decisions name):

| Record | Current text | Target |
|--------|--------------|--------|
| `REQUIREMENTS.md:31-32` | `- [ ] **FINAL-01**: ...` / `- [ ] **FINAL-02**: ...` | `[x]` both (after the measurement and reconciliation land) |
| `REQUIREMENTS.md:54-55` | `| FINAL-01 | 8 | Pending |` / `| FINAL-02 | 8 | Pending |` | `Complete` |
| `ROADMAP.md:21` | `- [ ] **Phase 8: Final Verification and Reconciliation** — All authorized items` | `- [x] ... (completed <date>)` (Phase 7's form: `— FLOW-05 (completed 2026-09-18)`) |
| `ROADMAP.md:146` | `**Plans:** To be planned after discussion and live investigation.` | plan list, then `**Plans:** N/N plans complete` |
| `ROADMAP.md:161` | `| 8. Final Verification and Reconciliation | 0/TBD | Not started | - |` | `| N/N | Complete | <date> |` |
| `STATE.md` frontmatter | `current_phase: 08`, `status: planning`, `completed_phases: 7`, `percent: 88`, `stopped_at: Phase 07 complete, ready to plan Phase 08` | advance by hand at close (`completed_phases: 8`, `percent: 100`, status per the milestone-close convention) and verify with `git diff` |
| `STATE.md` "## Current Position" | Phase 08 / Plan: Not started / Status: Ready to plan | fresh paragraph citing the new figures; keep `stopped_at:` one line (phase.complete truncation snag) |

### Closure note template (copy verbatim, adapt IDs)

The NEGCTL-01 closure, `BACKLOG.md:2893-2900`, is the cleanest single-paragraph model [VERIFIED: read this session]:

```markdown
Closed 2026-09-14 in test-backlog Phase 1. The failure was isolated to the
sandbox/process-pipe observation path on Node v26.8.2; file-backed separate
stdout/stderr capture preserves the exact CLI diagnostic. Launch errors,
signals, wrong status, and missing diagnostics have discriminating controls.
The full negative suite passes inside and outside the sandbox; independent
GSD review found no issues and verification passed 5/5. See
[verification](phases/01-reliable-negative-controls/01-VERIFICATION.md).
The original report below is preserved as history.
```

Shape to keep: date + phase; what now holds (one or two sentences); the verification status and score with a relative link to the phase VERIFICATION.md; the sentence that the original filing is preserved as history. The bold-lead variant (`**Closed 2026-09-14 — test-backlog Phase 2.** ...`, SWTEST-01 body) and the `**Current disposition, 2026-09-14:**` variant (AGCOL-01, ARGS-01) are equally in force.

## Repository Bookkeeping Facts

| Fact | Value | Provenance |
|------|-------|------------|
| Branch / HEAD | `features/test-backlog` at `e433c5bf`; `git rev-list --left-right --count origin/main...HEAD` = `0	293` (293 ahead incl. the CONTEXT commit, 0 behind); never pushed, so no CI evidence exists | [VERIFIED: git this session] |
| Version | `package.json:119` `"version": "0.18.3"`; `sonar-project.properties:7` `sonar.projectVersion=0.18.3`; `extensions/pi-claude-marketplace/shared/extension-version.ts:16` `export const EXTENSION_VERSION = "0.18.3";` | [VERIFIED: grep this session] |
| CHANGELOG `[Unreleased]` | `CHANGELOG.md:3`; 13 top-level bullets, each ending in a PR number `(#197)` ... `(#178)`; no entry for this milestone's work; last touched by `3e33ca62 docs(changelog): anchor entries to PRs ...` | [VERIFIED: read this session] |
| Last commit touching each tree | `extensions/` `31ed3c72` (2026-09-17); `tests/` and `scripts/` `0844c2a7` (2026-09-18); `package.json` and `.pre-commit-config.yaml` `14658799`; `.fallowrc.json` `3bebe6ec`; `eslint.config.js` `fa81a02e` | [VERIFIED: `git log -1 -- <path>`] |
| Phase 1-7 verification | all seven `status: passed` (5/5, 4/4, 18/18, 7/7, 10/10, 2/2, 8/8); `init.manager` reports `verification_status: stale` for every one and `missing` for Phase 8 (the `covered_files` timestamp artifact documented in STATE.md's "Historical refine-unit-tests closeout") | [VERIFIED: frontmatter grep + `init.manager` this session] |
| `gsd-tools verification status 07` | returns `"status": "missing"` and `resolve-file` returns `""` although `07-VERIFICATION.md` exists -- another reason to trust the files, not the verbs | [VERIFIED: this session] |
| GSD "Known snag for the next close" (STATE.md:153-161) | `phase.complete` and state verbs refused because they saw `.planning/workstreams/`; `milestone complete` left original-path deletions unstaged and wrote wrong `completed_phases`/`percent` | [VERIFIED: read this session] |
| `.planning/workstreams/` now | does not exist; `gsd-tools workstream list` -> `{"mode": "flat", "workstreams": []}`; so the recorded refusal cause is gone, but the truncation/regression snags in memory remain, and CONTEXT.md already decided hand-edit + diff | [VERIFIED: `ls`, verb output this session] |
| Uncommitted local edits (never stage) | ` M .claude/settings.json` (+12: a `UserPromptSubmit` hook running `codegraph prompt-hook`), ` M .codex/config.toml` (+4: `[mcp_servers.codegraph]`), ` M .planning/state.json` (phases 5-7 `pending`->`complete`, `next` pointer, `updated_at` -- GSD tooling rewrites this file itself), `?? .mcp.json` (codegraph server entry) | [VERIFIED: `git diff` this session] |
| Archives to preserve | `.planning/milestones/` (refine-unit-tests, v1.19, agent-skill-preloads, defaults-enabled, fetch-plugin ... artifacts), `.planning/inputs/test-backlog/` (PRE-MILESTONE-ROADMAP.md, PRE-MILESTONE-STATE.md, paused-preparation/) -- note CONTEXT.md writes `inputs/test-backlog/`; the real path is under `.planning/` | [VERIFIED: `ls`] |
| Stale resume residue | `.planning/HANDOFF.json` (`"phase": "05"`, `"status": "paused"`, timestamp 2026-09-14T16:58:16Z, committed in `dd825223`) and `.planning/phases/05-production-export-ownership/.continue-here.md` still exist although Phase 5 completed 2026-09-15 | [VERIFIED: `ls`, `head`] -- see Open Questions |
| Todo verbs | `gsd-tools list-todos` sees exactly the one pending todo; `gsd-tools todo complete <filename>` is documented as "Move todo from pending to completed" | [VERIFIED: help text `gsd-tools.cjs:122`] |

## Architecture Patterns

### Gate execution flow

```text
phase HEAD (docs-only commits; code tree == 31ed3c72 / 0844c2a7)
   |
   v
[1] run each `check` member as its own process ----> exit + counts per row
   |   (typecheck, lint, workflows x2, fallow, format, corresponding x2,
   |    direct:negative, coverage:unit, unit:negative, risk, risk:negative,
   |    integration, type-members x2)
   v
[2] coverage/unit.manifest.json accepted?  --no--> refusal rows -> classify (regression vs environment) -> STOP, do not loosen
   |  yes
   v
[3] recount coverage/unit.lcov + unit.istanbul.json independently ----> denominators table
   v
[4] test:e2e (network) ----> pass | launch error verbatim (environment)
   v
[5] test:coverage:direct:all ----> 239 pairs, pin match
   v
[6] git status --short; pre-commit run --all-files; git status --short ----> TruffleHog red expected (worktree); any rewritten file reported
   v
[7] 08-MEASUREMENT.md (07-MEASUREMENT.md shape) ----> commit (planning files only)
   v
[8] reconciliation edits (BACKLOG, todo move, STATE row, REQUIREMENTS, ROADMAP) ----> git diff review ----> commit
```

### Pattern 1: one process per gate member, exit captured directly
**What:** Run `npm run <member>` sixteen times, not `npm run check` once. Record `rc=$?` on the command itself.
**When to use:** Always here. The chain takes ~22 min (the tool ceiling is 10 min), and a single `npm run check` hides which member failed and how long it took. Never `cmd | tee`; the pipe's exit is `tee`'s.
**Example:**
```bash
# Source: this session's runner (scratchpad/run-gates.sh)
for s in typecheck lint lint:workflows lint:workflows:negative fallow format:check \
         test:corresponding test:corresponding:negative test:coverage:direct:negative \
         test:coverage:unit coverage:unit:negative coverage:risk coverage:risk:negative \
         test:integration lint:type-members lint:type-members:negative; do
  start=$(date +%s); npm run "$s" > "$OUT/${s//:/_}.log" 2>&1; rc=$?
  echo "cmd='npm run $s' exit=$rc seconds=$(( $(date +%s) - start ))" >> "$OUT/SUMMARY.txt"
done
```
Launch it detached (`setsid nohup ... &`) and poll the summary file; a plain `run_in_background` call is still subject to the 10-minute ceiling.

### Pattern 2: the measurement document shape (precedent `07-MEASUREMENT.md`)
**What:** A dated section per run identity, tables of command / exit / seconds / counts, a denominators table with both models kept apart, a deficit list with dispositions, a classification table for every red, and an explicit "nothing loosened" statement.
**Recommended name:** `08-MEASUREMENT.md` in the phase directory (discretion; mirrors Phase 7 and is what the verifier will look for).
**Sections to include:** 1 Preconditions (HEAD, last code commits, runtime); 2 The `check` chain member by member; 3 Additional gates (e2e, direct:all, pre-commit with the before/after `git status`); 4 Aggregate unit coverage (manifest population/denominators quoted, independent recount, digests, zero-entry counts); 5 Deficits and CRAP distribution (equal to Phase 7 or the delta); 6 Red classification (each red: command, verbatim error, regression/environment, cause, debt or fix); 7 What did not change (pin, policy, `.fallowrc.json`, exclusions, suppressions); 8 Item reconciliation table (the eleven items with VERIFICATION status/score and fresh gate result).

### Pattern 3: additive closure notes
**What:** Insert a closure paragraph directly under the heading (above the original filing), change the heading to the closed form, leave every original line intact.
**When to use:** FLOW-05 (heading + paragraph), SWTEST-01 (heading only), the todo (paragraph + move).

### Pattern 4: hand-edit + diff for GSD bookkeeping
**What:** Edit STATE.md / ROADMAP.md / REQUIREMENTS.md with the Edit tool, then `git diff -- <file>` and read every hunk before staging. Stage by explicit path (`git add .planning/BACKLOG.md .planning/REQUIREMENTS.md ...`), never `git add -A` or `git add -u`, so the four local edits stay out.
**Why:** STATE.md:153-161 records the verb refusals; memory records `phase.complete` truncating multi-line `stopped_at:` and regressing Current Position, and `planned-phase` stomping `status:`. Phase 7's close (`5b927ce6`) is the diff to imitate: REQUIREMENTS checkboxes + traceability rows, ROADMAP bullet + Plans line + progress row, STATE frontmatter + Current Position.

### Anti-patterns to avoid
- **Treating the research run as the phase run.** CONTEXT.md locks "All run fresh at the phase HEAD". The figures above are the expected values and the classification key; the plan must produce its own run and record.
- **Loosening anything to clear TruffleHog.** The fix is `SKIP=trufflehog` (already policy in CLAUDE.md), not editing `.pre-commit-config.yaml`.
- **Rewriting the FLOW-05 body.** The three historical bullets (`c8` `-1` columns, the 25->238 swing) explain why Phase 7 had to own the conversion; keep them under the closure.
- **Bumping the version or adding a CHANGELOG line.** Explicitly excluded by CONTEXT.md.
- **Using `git stash`** to set aside the four local edits (shared stash stack across worktrees); leave them in place, they do not interfere with any gate (`pre-commit --all-files` passed with them present).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving the bundle is current | a `stat`/mtime check | `npm run coverage:validate` (content digests, exit 0/1) | freshness is a content check by design (`docs/coverage-metrics.md`) |
| Recounting coverage | trusting the console table | the LCOV `LF/LH/FNF/FNH/BRF/BRH` sums and the map's `f/s/b` counters (script in Code Examples) | mirrors `07-MEASUREMENT.md` section 5 and catches a swapped or half bundle |
| Moving the todo | copy + delete | `git mv` (or `gsd-tools todo complete <file>` + `git add` both paths) | keeps the rename in history |
| Diffing bookkeeping edits | eyeballing | `git diff -- .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md` | the verification step for hand edits per STATE.md:157 |
| Secret scan inside a worktree | a local trufflehog invocation with a fake `.git` | `SKIP=trufflehog pre-commit run --all-files` | CLAUDE.md:17; TruffleHog cannot read a worktree's `.git` file |

## Common Pitfalls

### Pitfall 1: the 10-minute tool ceiling
**What goes wrong:** `npm run check` (1300 s), `lint:type-members:negative` alone (424 s) and `test:coverage:unit` (452 s) each approach or exceed a single call. `pre-commit run --all-files` took 838 s. `test:coverage:direct:all` took 509 s.
**How to avoid:** detached sequential runner + polling (Pattern 1). Budget ~45 min wall time for the whole set.
**Warning signs:** a log that ends without the summary line; a killed `npm run` leaves orphan `node` children (kill by pid, as happened once this session).

### Pitfall 2: TruffleHog is red in this worktree, and only there
**What goes wrong:** `pre-commit run --all-files` exits 1 on TruffleHog with `open .../.git/index: not a directory`.
**Why:** `.git` is a file (`gitdir: ...`) in a worktree.
**How to avoid:** record it as environment (verbatim error), re-run with `SKIP=trufflehog` for the exit-0 evidence of the other 40 hooks, and commit with `SKIP=trufflehog` per CLAUDE.md.

### Pitfall 3: `fallow` prints red glyphs on a green exit
**What goes wrong:** the health and dupes lines print `✗` while exiting 0; a reader who trusts the glyph reports a false red.
**How to avoid:** report the exit status; quote the line (`✗ 0 above threshold ...`, `✗ 1,819 lines (1.9%) duplicated ...`).

### Pitfall 4: coverage artifacts vanish mid-run
**What goes wrong:** `coverage/unit.manifest.json` is absent while `test:coverage:unit` runs (public artifacts are removed at the start and rewritten at acceptance). A concurrent reader gets `ENOENT`.
**How to avoid:** read the bundle only after step 10 exits; never run two coverage-producing commands at once.

### Pitfall 5: the four local edits and `git add`
**What goes wrong:** `git add -A`/`-u` stages `.planning/state.json` and the two config files; `gsd-tools commit` may do the same.
**How to avoid:** explicit paths only; check `git status --short` after every commit and expect exactly ` M .claude/settings.json`, ` M .codex/config.toml`, ` M .planning/state.json`, `?? .mcp.json` to remain.

### Pitfall 6: pre-commit hooks that write
**What goes wrong:** `trailing-whitespace`, `end-of-file-fixer` and `prettier --write` still apply to `.planning/**` (only mdformat, markdownlint and the texthooks fixers exclude `.planning/`). A hook rewrite fails the commit silently-looking and leaves the fix unstaged.
**How to avoid:** `pre-commit run --files <edited planning files>` before `git commit`; `git status` after; never `--amend`.

### Pitfall 7: `07-VERIFICATION.md` score mismatch
**What goes wrong:** frontmatter `score: 8/8`, body "10/10", close commit "10/10".
**How to avoid:** cite the frontmatter value as canonical and note the body count in the same cell; do not edit the verification file.

### Pitfall 8: STATE.md figures are stale by design
**What goes wrong:** Current Position still says "1833/1833 functions, 9049/9049 branches" (Phase 6 era).
**How to avoid:** the new Current Position paragraph cites the fresh bundle; leave the old paragraph as history unless the close rewrites the section wholesale as Phase 7 did.

## Code Examples

### Independent recount of the published bundle
```bash
# Source: this session; mirrors 07-MEASUREMENT.md section 5
node -e '
const fs=require("fs");const t=fs.readFileSync("coverage/unit.lcov","utf8").split("\n");
let rec=0,LF=0,LH=0,FNF=0,FNH=0,BRF=0,BRH=0,z=0,p=false;
for(const l of t){if(l.startsWith("SF:")){p=l.includes("extensions/pi-claude-marketplace/");if(p)rec++;continue;}
 if(!p)continue;const [k,v]=l.split(":");
 if(k==="LF")LF+=+v;else if(k==="LH")LH+=+v;else if(k==="FNF")FNF+=+v;else if(k==="FNH")FNH+=+v;
 else if(k==="BRF")BRF+=+v;else if(k==="BRH")BRH+=+v;
 else if((k==="DA"&&v.endsWith(",0"))||(k==="BRDA"&&(v.endsWith(",0")||v.endsWith(",-")))||(k==="FNDA"&&v.startsWith("0,")))z++;}
console.log({rec,LF,LH,FNF,FNH,BRF,BRH,zeroEntries:z});
const m=JSON.parse(fs.readFileSync("coverage/unit.manifest.json","utf8"));
console.log(m.runId,m.acceptance.acceptedAt,JSON.stringify(m.acceptance.denominators));'
# expected at this tree: rec 230, LF/LH 63825, FNF/FNH 1890, BRF/BRH 9234, zeroEntries 0
```

### Exit status without a pipe, then the summary
```bash
npm run coverage:validate > "$OUT/validate.log" 2>&1; echo "exit=$?"     # expected exit=0
npm run coverage:risk -- --report coverage/unit.risk.json > "$OUT/risk.log" 2>&1; echo "exit=$?"
tail -1 "$OUT/risk.log"   # Coverage risk verified: <runId>, 1865 production function(s) in 239 file(s) ..., max CRAP 20.00 ..., policy < 30
```

### pre-commit with the before/after status capture
```bash
git status --short > "$OUT/status-before.txt"
pre-commit run --all-files > "$OUT/pre-commit.log" 2>&1; echo "exit=$?"          # expected exit=1 (TruffleHog only)
git status --short > "$OUT/status-after.txt"; diff "$OUT/status-before.txt" "$OUT/status-after.txt" && echo "no files rewritten"
SKIP=trufflehog pre-commit run --all-files > "$OUT/pre-commit-skip.log" 2>&1; echo "exit=$?"   # expected exit=0
```

### Closing the todo
```bash
git mv .planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md \
       .planning/todos/completed/2026-09-02-detect-unused-code-and-type-members.md
# then Edit: insert the closure paragraph under the H1, citing 06-VERIFICATION.md (2/2) and the fresh lint:type-members result
```

### Explicit-path commit
```bash
pre-commit run --files .planning/BACKLOG.md .planning/STATE.md .planning/REQUIREMENTS.md .planning/ROADMAP.md \
  .planning/todos/completed/2026-09-02-detect-unused-code-and-type-members.md \
  .planning/phases/08-final-verification-and-reconciliation/08-MEASUREMENT.md; echo "exit=$?"
git add .planning/BACKLOG.md .planning/STATE.md .planning/REQUIREMENTS.md .planning/ROADMAP.md \
  .planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md \
  .planning/todos/completed/2026-09-02-detect-unused-code-and-type-members.md \
  .planning/phases/08-final-verification-and-reconciliation/
SKIP=trufflehog git commit -F "$OUT/commit-msg.txt"
git status --short   # expect only the four local edits
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm test` + separate lcov in the chain | one verified capture (`test:coverage:unit` = `coverage:unit:verified`), `npm test` removed from `check` | Phase 7 (07-08, commit `14658799`) | the 100% claim is the accepted bundle's `acceptance.denominators.native` |
| `maxCrap: 0` as the only CRAP posture | policy 30 in `scripts/coverage-risk-policy.json` consumed via `coverage:risk`; `.fallowrc.json` `maxCrap: 0` unchanged | Phase 7 | FLOW-05's stated blocker (no reliable conversion) no longer holds |
| GSD verbs for phase close | hand-edit + `git diff` | refine-unit-tests close (STATE.md:153-161) | applies to this close too |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The plan's fresh run will reproduce the same counts (6900 unit, 32 integration, 14 e2e, 239 pairs, identical denominators) because no code commit lands between now and the phase run | Live Gate Measurements | Low: if a count differs the measurement document records the delta; Phase 7 showed only execution counts drift, never zero/nonzero flips |
| A2 | `gsd-tools phase complete 8` would still misbehave (truncation/regression snags) even though the `.planning/workstreams/` refusal cause is gone | Bookkeeping facts | Low: CONTEXT.md already locks hand-edit + diff; nothing depends on the verb |
| A3 | The `gsd-tools todo complete` verb performs a plain rename and does not edit the file body | Reconciliation | Low: `git mv` is the documented alternative and the plan can use it outright |
| A4 | The network stays reachable for the plan's e2e run (it was reachable this session) | Additional gates | Medium: if blocked, CONTEXT.md prescribes recording the launch error verbatim as an environment debt |

## Open Questions

1. **Stale `.planning/HANDOFF.json` and `05-.../.continue-here.md`**
   - What we know: both still describe a Phase 5 pause from 2026-09-14; Phase 5 closed 2026-09-15; `/gsd-resume-work` reads HANDOFF.json.
   - What's unclear: whether removing them counts as "rewriting history" under the additive-only decision, and whether they are in FINAL-02's scope (they are not authorized items).
   - Recommendation: do not touch them in this phase; mention them in the measurement document's "not in scope" list and leave the decision to the milestone close or `/gsd-ship`.
2. **Wording for the STATE.md:97 status cell**
   - What we know: the decision says flip from `Pending` to closed; other rows use `acknowledged — ...` and `passed` shapes.
   - Recommendation: `closed — test-backlog Phase 6 (06-VERIFICATION 2/2); gate `lint:type-members` in `check`` keeps the table's one-line-per-row shape; discretion.
3. **Whether the milestone close (`/gsd-complete-milestone`) is part of this phase**
   - What we know: ROADMAP/REQUIREMENTS/STATE Phase 8 rows are in scope; CONTEXT.md defers push/PR to `/gsd-ship`; STATE.md documents `milestone complete` CLI gaps.
   - Recommendation: the plan closes the phase (rows above) and stops; milestone archival is a separate command with its own known snags.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | every gate | ✓ | v26.8.2 (V8 14.6.202.34-node.28) | -- |
| npm | scripts | ✓ | 11.19.1 | -- |
| pre-commit | `pre-commit run --all-files` | ✓ | 4.5.1 at `/home/acolomba/.local/bin/pre-commit` | -- |
| fallow | `npm run fallow`, `coverage:risk` | ✓ | 3.23.0 (`node_modules/.bin/fallow`, matches policy pin) | -- |
| Network to github.com | `test:e2e` depth-1 fetch of `PINNED_SHA` `6196a61b...` | ✓ (this session: `git ls-remote` exit 0; e2e 14/14) | -- | record launch error verbatim as environment debt (CONTEXT.md) |
| git worktree layout | pre-commit TruffleHog | ✗ (worktree `.git` file) | -- | `SKIP=trufflehog` (CLAUDE.md:17) |
| global `pi-subagents` | two integration tests | ✓ | 0.47.1 at `/home/acolomba/.npm-global/lib/node_modules/pi-subagents` (below the 0.62.0 `excludeTools` floor, but both tests pass) | tests `t.skip` when unreachable |
| `PI_CODING_AGENT_DIR`, `GITHUB_TOKEN`, `TEST_CONCURRENCY`, `CI` | test env | none set in this shell | -- | -- |
| Machine | all | 28 CPUs, 62 GB RAM; another Claude session was active in the sibling worktree `pi-claude-marketplace-manifest` during the run (tsserver at 124% CPU) without affecting outcomes | -- | -- |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** TruffleHog in a worktree (`SKIP=trufflehog`).

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED: read this session].

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node v26.8.2 built-in), driven through `package.json` scripts |
| Config file | `package.json` scripts; `scripts/coverage-capture.manifest.mjs` (`UNIT_TEST_PATTERNS`) |
| Quick run command | `npm run coverage:validate; echo "exit=$?"` (6 s, proves the bundle is current) |
| Full suite command | the sixteen `check` members run separately (Pattern 1), then `npm run test:e2e`, `npm run test:coverage:direct:all`, `pre-commit run --all-files` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command / diff | File Exists? |
|--------|----------|-----------|--------------------------|-------------|
| FINAL-01 | every `check` member exits 0 at the phase HEAD | gate | sixteen `npm run <member>; echo "exit=$?"` rows, all `exit=0` | ✅ (scripts exist) |
| FINAL-01 | aggregate unit production coverage is 100% in lines, functions, branches | measurement | `npm run coverage:validate` exit 0 and the recount script: `LF==LH`, `FNF==FNH`, `BRF==BRH`, `zeroEntries==0` over `coverage/unit.lcov` | ✅ |
| FINAL-01 | direct-pair requirements unchanged | gate | `npm run test:coverage:direct:all; echo "exit=$?"` -> `2 pinned shortfall(s) matched ... exactly`; `git diff --quiet HEAD~N -- scripts/test-coverage-direct.pin.json` | ✅ |
| FINAL-01 | assertion strength and thresholds not loosened | diff | `git diff <phase-start>..HEAD -- .fallowrc.json eslint.config.js scripts/coverage-risk-policy.json scripts/test-coverage-direct.pin.json scripts/check-unused-type-members.exceptions.json sonar-project.properties .pre-commit-config.yaml package.json` is empty (this phase commits only `.planning/**`) | ✅ |
| FINAL-01 | e2e passes or its launch error is recorded verbatim | gate | `npm run test:e2e; echo "exit=$?"` -> `tests 14 / pass 14` | ✅ |
| FINAL-01 | pre-commit red is classified, no file rewritten | gate + diff | `git status --short` before/after identical; `SKIP=trufflehog pre-commit run --all-files` exit 0 | ✅ |
| FINAL-02 | every authorized item has a disposition citing its VERIFICATION status/score | doc check | `grep -n "FLOW-05\|SWTEST-01" .planning/BACKLOG.md` shows closed headings; `ls .planning/todos/pending/` is empty and `ls .planning/todos/completed/ | grep detect-unused` hits; `grep -n "Detect unused code" .planning/STATE.md` no longer shows `Pending`; `grep -n "FINAL-0" .planning/REQUIREMENTS.md` shows `[x]` and `Complete`; `sed -n 161p .planning/ROADMAP.md` shows `Complete` | ❌ Wave 0 (the edits are the phase's work) |
| FINAL-02 | archives and completed work preserved | diff | `git diff --stat <phase-start>..HEAD -- .planning/milestones .planning/inputs .planning/phases/0[1-7]-*` is empty except additive files | ✅ |

### Sampling Rate
- **Per task commit:** `pre-commit run --files <edited files>; echo "exit=$?"` then `git status --short`.
- **Per wave merge:** `npm run coverage:validate; echo "exit=$?"` (proves no code drift) and the FINAL-02 grep set above.
- **Phase gate:** the full set in the measurement document, all exits recorded, before `/gsd-verify-work 8`.

### Wave 0 Gaps
- None in test infrastructure. The FINAL-02 "tests" are the greps/diffs above against the records the plan edits.

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled). The phase changes no production or test code, so no ASVS category applies to new behavior. Security-relevant facts of the run itself:

| Concern | Applies | Handling |
|---------|---------|----------|
| Secret scan (TruffleHog) | yes, and it is the one red | environment failure in a worktree; the same hook runs green in CI's `lint.yml` on a normal checkout and `detect-private-key` passed here; do not weaken the hook config |
| Network egress | only `test:e2e` (`git fetch --depth 1 origin 6196a61b...` from `https://github.com/anthropics/claude-plugins-official`) | pinned SHA, read-only; `GITHUB_TOKEN` not set, so the fetch is anonymous |
| Supply chain | no package installed; `package-lock.json` unchanged; `coverage:producer:build -- --verify` is part of CI's qualification (not re-run here, Phase 7 verified it) | -- |
| Local config files | `.claude/settings.json`, `.codex/config.toml`, `.mcp.json` hold per-machine codegraph wiring, no secrets (inspected) | never staged |

## Sources

### Primary (HIGH confidence)
- Live execution at HEAD `e433c5bf` of all 16 `check` members, `test:e2e`, `test:coverage:direct:all`, `pre-commit run --all-files`, `coverage:validate`, `coverage:risk -- --report` (scratchpad logs `gates/*.log`, `SUMMARY.txt`, `EXTRA-SUMMARY.txt`).
- `coverage/unit.manifest.json`, `coverage/unit.lcov`, `coverage/unit.istanbul.json`, `coverage/unit.risk.json` read and recounted this session.
- `.planning/phases/08-.../08-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/BACKLOG.md` (headings and the eleven item bodies), `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md`, phases 1-7 `*-VERIFICATION.md` frontmatter, `07-MEASUREMENT.md`, `01-02-SUMMARY.md`, `01-BASELINE.md`, `docs/coverage-metrics.md`, `CLAUDE.md`, `package.json` scripts, `.pre-commit-config.yaml`, `scripts/test-coverage-direct.pin.json`, `scripts/coverage-risk-policy.json`, `.fallowrc.json` thresholds, `tests/e2e/_helpers.ts`, `tests/e2e/_pinned-sha.ts`, `tests/integration/skill-path-resolution.test.ts`, `CHANGELOG.md` head, `sonar-project.properties`.
- `gsd-tools` verbs run read-only: `init.phase-op 8`, `init.manager`, `workstream list`, `list-todos`, `verification status 07`, `verification resolve-file 07`, help text for `todo complete`.

### Secondary (MEDIUM confidence)
- None; no web or documentation lookups were needed (no external library or API question exists in this phase, so the research-plan seam was not invoked).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Gate measurements: HIGH - every command executed this session with exit captured directly; counts quoted from the logs.
- Coverage figures: HIGH - recounted independently from the artifacts and equal to the manifest and to Phase 7.
- Reconciliation inventory: HIGH - every record opened and quoted with line numbers.
- Bookkeeping/GSD-verb behavior: MEDIUM-HIGH - read-only verbs probed; destructive verbs (`phase complete`) deliberately not exercised.

**Research date:** 2026-09-18
**Valid until:** the next commit touching `extensions/`, `tests/`, `scripts/`, `package.json`, `.fallowrc.json`, `eslint.config.js` or `.pre-commit-config.yaml` (any of these invalidates the bundle and the counts); the planning-record line numbers hold until BACKLOG.md/STATE.md are edited.
