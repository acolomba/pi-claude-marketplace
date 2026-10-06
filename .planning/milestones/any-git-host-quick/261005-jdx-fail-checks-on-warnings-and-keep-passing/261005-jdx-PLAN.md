---
phase: 261005-jdx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - package.json
  - scripts/test-reporter.mjs
  - scripts/test-coverage-direct.mjs
  - scripts/check-workflow-install-scripts.mjs
  - scripts/check-corresponding-tests.mjs
  - .fallowrc.json
  - .pre-commit-config.yaml
  - .github/workflows/lint.yml
  - scripts/init.sh
  - AGENTS.md
  - CONTRIBUTING.md
  - skills/local-verification/SKILL.md
  - CHANGELOG.md
  - .planning/codebase/CONVENTIONS.md
  - .planning/codebase/STACK.md
  - .planning/codebase/TESTING.md
  - .planning/BACKLOG.md
autonomous: true
requirements: [JDX-01, JDX-02, JDX-03, JDX-04, JDX-05, JDX-06]

estimate:
  tokens: 140000
  raw_tokens: 140000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "OD-A: the 19 unused await-in-loop disable directives are deleted as whole lines in a commit of their own; npm run --silent lint prints nothing and exits 0; with --max-warnings 0, a planted unused directive in an untracked test file makes npm run lint and npm run check:static exit 1 and print the warning while the other five static steps pass."
    - "OD-A: every step of check:static, check:commit, and check, and every CI job, either fails on its warning-level findings or is shown to have none, and the summary records the evidence per step. yamllint runs with --strict and accepts the one-space comment padding that yamlfmt writes. Fallow's policy-violation rule is off, so Fallow reports no workspace diagnostic. The Fallow audit job installs the npm dependencies and fails on a warn verdict or a degraded analysis."
    - "OD-A: passing runs print only a short summary. The two gate scripts, the Prettier check, the test reporter, and every direct-coverage arm print nothing on a pass, except one Merged LCOV line from an all-pair run that writes the merged report. Planted failures still print their report and exit 1, a failing changed-pair run names its base, and a failing escalated staged run names the staged file."
    - "OD-B: scripts/init.sh runs fallow agent install with --without hooks --without guide --approve and no longer deletes CLAUDE.md. A dry run of that exact line writes neither AGENTS.md nor CLAUDE.md. AGENTS.md has no Fallow local gate section and keeps the Fallow task map between its markers."
    - "OD-C: CONTRIBUTING.md, the local-verification skill, the #236 changelog entry, the codebase map, and BACKLOG FLOW-10 describe warning-free checks, quiet output, and the audit job's new failure. REVIEW.md marks Next steps 1 and 2 done with this quick task and stays untracked."
    - "Final tree: npm run check exits 0 and prints only npm's banner, six status lines from check:static, and one Merged LCOV line. fallow audit against origin/main returns verdict pass. Six Conventional Commits with explicit paths, and each commit hook passed."
  artifacts:
    - path: "package.json"
      provides: "lint fails on any warning; nested runs are silent; Prettier's check logs warnings only; every node --test script uses the project reporter"
      contains: "--max-warnings 0"
    - path: "scripts/test-reporter.mjs"
      provides: "the test reporter, silent on a passing run"
      contains: "const failedCountPattern = /^(?:fail|cancelled) [1-9]/;"
    - path: "scripts/test-coverage-direct.mjs"
      provides: "direct coverage, silent on a pass except the merged LCOV line, with failure context on stderr"
      contains: "affects every pair, so every pair ran."
    - path: ".pre-commit-config.yaml"
      provides: "strict yamllint that agrees with yamlfmt"
      contains: "min-spaces-from-content: 1"
    - path: ".github/workflows/lint.yml"
      provides: "the Fallow audit job with dependencies and a fail-on-warning step"
      contains: "steps.fallow.outputs.analysis-degraded"
    - path: ".fallowrc.json"
      provides: "the policy detector switched off, because no rule pack is configured"
      contains: '"policy-violation": "off"'
    - path: "scripts/init.sh"
      provides: "fallow agent install without the AGENTS.md guide"
      contains: "--without hooks --without guide --approve"
  key_links:
    - from: "package.json lint"
      to: "scripts/run-parallel.mjs (check:static)"
      via: "run-parallel runs npm run --silent lint, so an ESLint warning fails check:static, check:commit, check, and the CI static job"
      pattern: "--max-warnings 0"
    - from: "scripts/test-coverage-direct.mjs runPair"
      to: "scripts/test-reporter.mjs"
      via: "runPair echoes each pair's reporter output, so a silent reporter makes a passing pair silent"
      pattern: "--test-reporter=${reporterPath}"
    - from: ".github/workflows/lint.yml fail step"
      to: "fallow-rs/fallow action outputs verdict and analysis-degraded"
      via: "the step reads the outputs of the action step whose id is fallow"
      pattern: "steps.fallow.outputs.verdict == 'warn'"
    - from: ".pre-commit-config.yaml yamllint args"
      to: ".yamlfmt"
      via: "yamlfmt pads a line comment with one space, and yamllint now accepts one"
      pattern: "min-spaces-from-content: 1"
---

# Fail checks on warnings, keep passing output quiet, and stop Fallow rewriting AGENTS.md

<objective>
Per OD-A, OD-B, and OD-C (operator decisions, 2026-10-05, locked): every check fails on its warnings, so a pass means zero warnings and passing output can stay quiet. `fallow agent install` stops rewriting AGENTS.md. The docs describe both. This replaces the untracked uqn plan, which targets the deleted `scripts/check-changed.mjs` and predates quick task 261005-hpr.

Purpose: today a passing run exits 0 with 19 ESLint warnings, 3 yamllint warnings that pre-commit hides, and a "degraded inputs" warning on the CI Fallow audit job. A real warning can sit there unseen. Hiding passing output is safe only when a warning cannot pass.

Output: Task 1 (tracer) deletes the 19 unused directives and makes ESLint fail on any warning, proven end to end by a planted warning through `check:static` and by the commit hook. Task 2 sweeps every other step and CI job: it quiets passing output, makes yamllint strict, clears Fallow's diagnostic, and makes the CI Fallow audit fail on warnings. Task 3 stops `fallow agent install` from writing AGENTS.md, updates the docs and REVIEW.md, and runs `npm run check` on the final tree.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@skills/local-verification/SKILL.md
@package.json
@.github/workflows/lint.yml
</context>

## Operator decisions (locked)

OD, JDX, and T-jdx labels are plan-local. Never put them in files, comments, or commit messages. Durable IDs already in the code (D-07-13, D-07-14, D-08-15) stay. FLOW-10 is a BACKLOG ID and may appear in BACKLOG.md and REVIEW.md. The quick task ID `261005-jdx` appears only in BACKLOG.md, REVIEW.md, and the summary, never in code or commit messages.

- **OD-A. Warnings fail; passing output stays quiet.** Delete the 19 unused `eslint-disable` directives for the core await-in-loop rule as whole lines. ESLint runs with `--max-warnings 0` in the `lint` script and wherever else ESLint gates. Sweep every step of `check:static`, `check:commit`, and `check` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, test:unpaired, test:integration, test:coverage:direct:all and :commit) and the CI jobs for findings reported at warning level that still exit 0. Make each fail, or show there are none. The final tree passes with zero warnings. Tool log noise is not a finding, but say how each is handled (silenced or left) and why. `scripts/run-parallel.mjs` keeps hiding the output of passing steps. Keep uqn's quiet-output parts that still apply: `npm run --silent` in nested package.json chains, gate scripts silent on a pass, `format:check --log-level warn`, a test reporter that is silent on a pass (failures, threshold shortfalls, and the count line still print), and `test-coverage-direct.mjs` quiet on a pass (decide whether one final summary line stays). Drop uqn's parts that target `check-changed.mjs`.
- **OD-B. Fallow guide.** In `scripts/init.sh`, `fallow agent install` gets `--without guide` and keeps the skill, MCP, `--approve`, and `--without hooks`. Remove the `rm -f CLAUDE.md` line and its comment. Update the comment above the install, with a short note that the task map no longer refreshes on Fallow upgrades. Remove the "Fallow local gate" section of AGENTS.md by hand (its heading through the paragraph before "Fallow task map"), and keep the task map and the markers. Update other references to running the Fallow audit before a commit, if any.
- **OD-C. Docs.** Update the docs that describe the output or the gates: CONTRIBUTING.md, `skills/local-verification/SKILL.md`, the CHANGELOG #236 entry, and `.planning/codebase/` CONVENTIONS.md, STACK.md, and TESTING.md where they mention lint warnings, quiet output, or the Fallow gate. In the untracked REVIEW.md of the main checkout, mark "Next steps" items 1 and 2 done with this quick task ID. Never commit REVIEW.md.

## Requirement map

| ID | Outcome | Task |
| --- | --- | --- |
| JDX-01 | The 19 directives are gone in their own commit, a passing lint prints nothing, and any ESLint warning fails lint, `check:static`, the hook, and CI (OD-A) | 1 |
| JDX-02 | Every other step and CI job fails on its warnings or is shown to have none, with evidence per step (OD-A) | 2 |
| JDX-03 | Passing gate scripts, Prettier, the test reporter, and direct coverage print nothing except one Merged LCOV line, and failures keep their context (OD-A) | 2 |
| JDX-04 | `fallow agent install` no longer writes AGENTS.md or CLAUDE.md, and AGENTS.md lost the gate section but kept the task map (OD-B) | 3 |
| JDX-05 | CONTRIBUTING, the skill, CHANGELOG #236, the codebase map, BACKLOG FLOW-10, and REVIEW.md match the tree (OD-C) | 3 |
| JDX-06 | `npm run check` passes on the final tree and prints the expected short shape (OD-A) | 3 |

## Facts measured during planning

2026-10-05, branch `features/faster-precommit`, main checkout, HEAD `8b741d0ebbc9105aa418f6b3e88fd8f4eaf82843`, Node v26.10.0, npm 11.19.1, Prettier 3.9.6, fallow 3.27.0. Untracked: REVIEW.md and the uqn directory only. Anchor every edit on content, never on line numbers.

1. **Passing output today.** `typecheck` and `fallow` print nothing. `lint` prints 19 warnings and exits 0. `lint:workflows` and `test:corresponding` print one pass line each. `format:check` prints "Checking formatting..." and "All matched files use Prettier code style!". `test:unpaired` (368 tests) and `test:integration` (67 tests, 0 skipped) print one count line each. Direct coverage prints the count line and a "Direct coverage passed" line per pair, then an all-pair completion line and the "Merged LCOV" line for `--all --lcov`, and "Staged pairs: N" plus a zero-pair report for `--staged`. `check:static` prints six status lines through `scripts/run-parallel.mjs`.
2. **Directives.** `git grep -n "eslint-disable-next-line no-await-in-loop" -- extensions tests scripts demos` lists 19 own-line comments in 9 files: `bridges/skills/discover.ts` (2), `orchestrators/import/execute.ts` (3), `orchestrators/plugin/enable-disable.ts` (1), `install-flow.ts` (1), `prune-rollback.ts` (3), `prune.ts` (1), `shared.ts` (2), `uninstall.ts` (2), and `orchestrators/reconcile/apply.ts` (4). Each matches `^[[:space:]]*// eslint-disable-next-line no-await-in-loop -- `. ESLint reports each as an unused directive. They were added for SonarCloud's await-in-loop rule. In a scratch worktree, the `sed` deletion removed exactly 19 lines and added none, and `fallow audit --base origin/main` stayed `pass` with 0 introduced findings, also with both gate-script pass lines deleted.
3. **ESLint plant.** The only rule set to `warn` in `eslint.config.js` is `no-console` (two blocks). An untracked `tests/zz-jdx-plant.ts` holding a `// eslint-disable-next-line no-console -- planted unused directive` line and `export const planted = 1;` left all six `check:static` steps passing today. `eslint tests/zz-jdx-plant.ts --max-warnings 0` exited 1 with the unused-directive warning and `ESLint found too many warnings (maximum: 0).` No other step reacts to that file. An untracked file under `scripts/` is not a usable plant: Fallow's production dead-code run reports it as an unused file.
4. **Fallow.** `--fail-on-issues` promotes every `warn`-severity rule to an error (`node_modules/fallow/skills/fallow/references/gotchas.md`, section "--fail-on-issues Promotes Warn to Error"), and each of the four `npm run fallow` runs passes it. Dead code: 0 issues. Health: 0 findings; its JSON lists 1225 `large_functions`, which Fallow does not count as findings and the human output does not print (REVIEW.md S5, still open). Dupes: 42 clone groups at 1.36% against the 3% threshold, gate outcome `pass`; the clone list is the report behind the threshold, and the npm script already hides it on a pass (BACKLOG FLOW-10). The dead-code JSON carries one workspace diagnostic, `rule-packs-not-configured`: `policy-violation` is `error` but no rule pack exists since the rule pack removal, so that detector measures nothing. A probe config with `"policy-violation": "off"` gave 0 issues and no diagnostic. Fallow writes tracing lines to stderr (for example `WARN Graph cache decoded but not reused`, and a `WARN Skipped 1 package.json entry point ... tsconfig.tsbuildinfo` line on `fallow audit`), which `RUST_LOG` controls.
5. **Prettier.** With `--log-level warn`, a passing check prints nothing, and a failing one prints `[warn] <file>` and `[warn] Code style issues found in the above file. Run Prettier with --write to fix.` and exits 1.
6. **yamllint.** `pre-commit run yamllint --all-files --verbose` passes and prints 3 warnings: "too few spaces before comment: expected 2 (comments)" at `lint.yml` (2) and `sonarcloud.yml` (1). yamlfmt (basic formatter, default padding) rewrites two spaces before a line comment to one, so re-padding those comments would be reverted. A probe config with `["--strict", "-d", "{extends: default, rules: {line-length: disable, document-start: disable, truthy: disable, comments: {min-spaces-from-content: 1}}}"]` passed on all files, and a plant `key: value #no space` failed with exit code 2 and "missing starting space in comment". pre-commit refuses to run while `.pre-commit-config.yaml` has unstaged edits.
7. **Other hooks.** markdownlint-cli2: 0 errors, and no rule is configured at warning level. zizmor: "No findings to report. Good job! (10 suppressed)" plus its own log line `WARN ... zizmor is running in offline mode by default`. The remaining hooks are fixers or checks that fail on any finding.
8. **CI evidence (last runs, at `a55e8ba5`).** The `fallow-audit` job carries a warning annotation "Fallow ran with degraded inputs: node-modules-missing (1)": the job never installs dependencies. The `pre-commit` job carries a warning annotation "Node.js 20 is deprecated ... actions/cache@v4", from inside `pre-commit/action@v3.0.1`. Job logs show `npm warn deprecated node-domexception@1.0.0` during `npm ci` (a transitive dependency of `@earendil-works/pi-coding-agent`), git hints, and in the Sonar job a `DEP0005` DeprecationWarning and a gpg WARNING from the scanner action. No log shows an ExperimentalWarning, and none prints locally on Node 22.22.2 or 26.10.0. The 19 ESLint warnings appear in the old check job log.
9. **The pinned Fallow action** (`fallow-rs/fallow@bd8fca5af5df4ccfd94c7a835d17bd93c31a7cef`, v3.28.0). Outputs include `verdict` (`pass`, `warn`, `fail`; "The threshold step gates on this for audit so warn-tier findings do not fail CI") and `analysis-degraded` (`true` when a workspace diagnostic has `degrades_analysis == true`). It posts inline annotations only when the introduced-issue count is not 0. Its CLI verdict table: `warn` exits 0 when every finding is warn-severity. BACKLOG FLOW-10 (closed as accepted, 2026-08-17) records that introduced duplication yields `warn`, not `fail`. Today against `origin/main` (`6fc114b4`): verdict `pass`, 0 introduced, 5 inherited duplication groups. The local `rule-packs-not-configured` diagnostic has no `degrades_analysis` field.
10. **fallow agent install.** A dry run with `--harness claude --harness codex --without hooks --without guide --approve --dry-run` lists only the two skill pointers, `.mcp.json`, `.codex/config.toml`, and `.claude/settings.local.json`. Without `--without guide` it lists `AGENTS.md would write` and `CLAUDE.md would write`. The only live text that asks for `fallow audit` before a commit is the generated AGENTS.md section. The kept task map has a "commit or open a PR" row, `.planning/codebase/CONVENTIONS.md` names an `npm run fallow:audit` script that no longer exists, and the rest is planning history.
11. **Recorded decisions.** In the archived `07-CONTEXT.md`, D-07-13 says the changed-pair selection prints which base candidate it selected, and D-07-14 says a zero-pair pass reports which paths were skipped and why. No gate uses the changed-pair arm since 261005-hpr: `check` and CI run `--all`, the hook runs `--staged`.
12. **Docs today.** CONTRIBUTING.md's "Checks" section lists the commands and the hook paragraph and says nothing about output. The skill says `check:static` "prints one line for each passing step and the full output of each failing step". None of CONTRIBUTING.md, the skill, STACK.md, or TESTING.md mentions warnings, `--max-warnings`, `--strict`, `degraded`, or `Merged LCOV` yet. TESTING.md does not name `scripts/test-reporter.mjs`.
13. **Places.** `tmp/` and `coverage/` are gitignored. The git hooks are installed and run in executor worktrees. REVIEW.md and the uqn directory are untracked files of the main checkout only. From any checkout, REVIEW.md is `"$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md"`. A previous executor sandbox refused compound git commands and command lines that name `.git` paths; running the command from a script file under `tmp/` worked. A temporary index (`GIT_INDEX_FILE=<abs path> git read-tree HEAD`, then `git update-index --cacheinfo`) makes `--staged` see a staged path without touching the real index (quick task 261005-hpr, probe P2).

## Warning sweep (planning classification)

The executor confirms every row with its own evidence and copies the table into the summary with an evidence column (log names).

| Step or job | Warning-level output that exits 0 today | Disposition |
| --- | --- | --- |
| `typecheck` (tsc) | None: tsc has errors only | Show none (`typecheck-2.log`) |
| `lint` (ESLint) | 19 unused-directive warnings; `no-console` is warn-level | Delete the 19; `--max-warnings 0` (Task 1) |
| `lint:workflows` | None: every violation exits 1 | Quiet on a pass |
| `fallow` | None reported: warn-severity rules are promoted to errors; the dupes clone list is the report behind the 3% threshold (FLOW-10); health `large_functions` is not a finding (S5). JSON-only diagnostic `rule-packs-not-configured` | Set `policy-violation` to `off` |
| `format:check` | None: Prettier's `[warn]` lines are its failure report, exit 1 | `--log-level warn` |
| `test:corresponding` | None | Quiet on a pass |
| `test:unpaired`, `test:integration`, direct coverage | None: Node's test runner has no warning level; skipped and todo tests are environment-dependent, not warnings | Reporter and direct coverage quiet on a pass |
| CI `static`, `integration`, `direct-coverage` | Same steps as above | Covered by the rows above |
| CI `e2e-tests`, `e2e-nightly` | None | Project reporter |
| CI `sonarcloud` | Sonar issues go to SonarCloud's quality gate and pull-request decoration, not to this job's exit status (`sonar.qualitygate.wait` is not set) | Show none in the job; the scanner's DEP0005 and gpg log lines are third-party noise, left |
| CI `package` | `npm notice` lines only | Show none |
| Every CI job | `npm warn deprecated node-domexception@1.0.0` during `npm ci` | Left: install-time notice about a transitive dependency of the Pi host package; no check reads it |
| Lint `pre-commit` | yamllint `comments` warnings (3) | `--strict` plus `min-spaces-from-content: 1` |
| Lint `pre-commit` | GitHub annotation: Node 20 deprecation of `actions/cache@v4` inside `pre-commit/action@v3.0.1` | Left: a platform notice about a third-party action's own dependency; removing it means replacing that action, a separate change. Flag it |
| Lint `pre-commit` | zizmor's offline-mode `WARN` log line | Left: tool log, hidden by pre-commit on a pass |
| Lint `fallow-audit` | "degraded inputs: node-modules-missing"; a `warn` verdict passes by the action's design | Install dependencies; fail on a `warn` verdict or a degraded analysis (reopens FLOW-10) |
| Tool noise | Fallow tracing `WARN` lines on stderr | Left: `check:static` hides a passing step's output, and `RUST_LOG=error` would also hide Fallow's notices on a failing run, where they can explain the failure |
| Tool noise | Node's ExperimentalWarning for test coverage | Not printed on Node 22.22.2, 26.10.0, or CI's Node 24; nothing to silence. If it appears, the reporter forwards it like any test stderr |

## Choices within the decisions

1. Directives (OD-A): delete the 19 lines with `sed`, in a commit of their own, so a reversal is one `git revert`. ESLint's fix mode leaves whitespace-only lines. SonarCloud may report those 19 awaits again; the commit body and the summary say so.
2. ESLint (OD-A): `--max-warnings 0` goes only into the `lint` script. Every gating run reaches ESLint through it: `check:static` (and so `check:commit`, `check`, and the hook), and the CI `static` job. `lint:fix` is a fixer and stays unchanged.
3. Direct coverage summary (OD-A): delete the per-pair pass line and the all-pair completion line (its timing varies by machine and it names nothing). Keep the existing "Merged LCOV: <path> (<N> records)" line as the one summary line. It prints only when `--lcov` is given (`npm run check`, CI, `test:coverage`), it names the one artifact the run produces and that Sonar reads, and the escalated hook run stays silent.
4. Failure context (OD-A): a failing changed-pair run writes `Changed-pair base: <candidate>` to stderr, and a failing escalated staged run writes `Staged <path> affects every pair, so every pair ran.` to stderr. Passing runs print neither, and the zero-pair report goes. This supersedes the print-on-pass parts of D-07-13 and D-07-14 under the operator's newer quiet-on-a-pass decision; their failure halves (a failing answer names its base, and a failed selection exits non-zero with the git error) stay. Flag it.
5. Reporter (OD-A): the count line prints after a failed or cancelled test or an unmet coverage threshold. Skipped and todo counts alone are not warnings: they track the environment.
6. yamllint (OD-A): add `--strict`, and set `comments: {min-spaces-from-content: 1}` so the linter agrees with yamlfmt's output (fact 6) instead of re-padding comments that yamlfmt would rewrite.
7. Fallow (OD-A): set `rules.policy-violation` to `off`. No rule pack is configured, so the detector measured nothing, and Fallow's own diagnostic names this as the fix.
8. Fallow audit job (OD-A): install the dependencies (`npm ci --ignore-scripts`, which `lint:workflows` requires), and add a step that fails when `verdict` is `warn` or `analysis-degraded` is `true`. Using the operator's warnings-fail decision over BACKLOG FLOW-10 (closed 2026-08-17, which accepted a passing `warn` verdict for introduced duplication): a pull request that adds a clone group now fails CI, while the 3% threshold in `npm run fallow` is unchanged. Flag it. The step does not fail on the action's other warnings: a narrowing request it could not apply or an unreadable changed-file list means the report covers more of the project than the change (no weaker verdict, and the second can be a transient GitHub API failure), and an empty scope is what a docs-only pull request produces.
9. Not changed: `scripts/run-parallel.mjs` (OD-A keeps it), `format` and `lint:fix` (fixers), npm's banner on a top-level command, the hook entry, and the CI `run:` lines.

## Target text

Use these as the end state. Wording in prose targets may change only to pass the simple-english and humanizer self-checks, and must keep the phrases the verify checks.

**`.pre-commit-config.yaml`, the yamllint hook:**

```yaml
      - id: yamllint
        # yamlfmt pads a line comment with one space, so the comments rule
        # accepts one. --strict makes every warning fail the hook.
        args: ["--strict", "-d", "{extends: default, rules: {line-length: disable, document-start: disable, truthy: disable, comments: {min-spaces-from-content: 1}}}"]
```

**`.github/workflows/lint.yml`, the `fallow-audit` job (the job comment, `if`, `runs-on`, `timeout-minutes`, and the checkout step stay as they are):**

```yaml
      # Without the npm dependencies, Fallow reports a degraded analysis.
      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Run fallow audit
        id: fallow
        uses: fallow-rs/fallow@bd8fca5af5df4ccfd94c7a835d17bd93c31a7cef # v3.28.0
        with:
          command: audit
          format: github-annotations

      # The action passes a warn verdict, for example a clone group that the
      # change adds, and a degraded analysis. A warning fails a check here.
      - name: Fail on a Fallow warning
        if: steps.fallow.outputs.verdict == 'warn' || steps.fallow.outputs.analysis-degraded == 'true'
        env:
          VERDICT: ${{ steps.fallow.outputs.verdict }}
          DEGRADED: ${{ steps.fallow.outputs.analysis-degraded }}
        run: |
          echo "::error::Fallow audit verdict: ${VERDICT}. Degraded analysis: ${DEGRADED}."
          exit 1
```

No comment line in a workflow may name an npm install command without `--ignore-scripts`: `lint:workflows` reads comments too. Keep the action outputs in `env:`, never inline `${{ }}` in `run:` (zizmor's template-injection audit).

**`.fallowrc.json`:** in `rules`, `"policy-violation": "off"` replaces `"policy-violation": "error"`. Nothing else changes.

**`scripts/init.sh`, the Fallow lines** (the line before the install is the blank line after the `.claude/CLAUDE.md` removal; the `# normalize AGENTS.md` block follows after one blank line):

```bash
# fallow: skill pointers and MCP registration. No commit gate: the commit hook
# already runs `npm run fallow`. No guide: it rewrites AGENTS.md and adds a
# CLAUDE.md import shim. The Fallow task map in AGENTS.md is kept by hand and
# no longer refreshes on fallow upgrades.
npx fallow agent install --harness claude --harness codex --without hooks --without guide --approve
```

**Doc wording (proposals; each paragraph stays on one line in mdformat files):**

- CONTRIBUTING.md, a new paragraph after the hook paragraph of "Checks": "Every check fails on a warning, so a passing check prints little. `npm run check:static` prints one line for each step, `npm run check` adds one `Merged LCOV` line that names the merged coverage report, and the other commands print nothing when they pass. A failing step prints its full output."
- `skills/local-verification/SKILL.md`: after the sentence about `check:static` output, add "A warning fails its step: ESLint runs with `--max-warnings 0`, and Prettier, Fallow, and the gate scripts fail on every finding." After the `npm run check` paragraph, add "The test and direct coverage steps print nothing when they pass. The all-pair run also prints one `Merged LCOV` line. A failing test prints Node's report and the count line, and a coverage shortfall names the source and its coverage." In "Committing", after "It runs only the fixers and linters and takes seconds.", add "A linter warning fails it too, because yamllint runs with `--strict`."
- CHANGELOG.md, two new sub-bullets at the end of the #236 entry, same indentation as its siblings: "Every local and CI check now fails on a warning, and a passing check prints at most one summary line." and "`scripts/init.sh` no longer lets Fallow rewrite `AGENTS.md`, so the Fallow task map there no longer changes on a Fallow upgrade."
- `.planning/codebase/CONVENTIONS.md`: the Linting bullet says `npm run lint` runs `eslint extensions tests scripts eslint.config.js --max-warnings 0` with a content cache, so any warning fails it. The Logging line adds that a `no-console` warning fails `npm run lint`. The "Fallow loads no rule pack" bullet adds that `rules.policy-violation` is `off` for that reason. The `npm run fallow:audit` bullet becomes: the Lint workflow's `fallow-audit` job gates pull requests on newly introduced findings only, installs the npm dependencies first, and fails on a `warn` verdict (a clone group the change adds) or a degraded analysis as well as on `fail`; it is distinct from the full `npm run fallow` gate.
- `.planning/codebase/STACK.md`: the `fallow-audit` sub-bullet and the `lint.yml` line add the dependency install and the failure on a `warn` verdict or a degraded analysis. The `pre-commit` line says yamllint runs with `--strict`, so a warning fails.
- `.planning/codebase/TESTING.md`, after the run-commands block: "Every `node --test` script and each direct-coverage pair run use `scripts/test-reporter.mjs`. A passing run prints nothing. A failing run prints Node's `spec` report, any coverage shortfall, and the count line."
- `.planning/BACKLOG.md`, a paragraph directly under the FLOW-10 heading: "Reopened 2026-10-05 by quick task 261005-jdx: a warning now fails every check. The Lint workflow's `fallow-audit` job fails on a `warn` verdict, so a pull request that introduces a clone group fails CI. The 3% threshold in `npm run fallow` is unchanged."
- REVIEW.md, at the end of "Next steps" item 1: "Done in quick task `261005-jdx` (<short SHAs of commits 1 to 4>): ESLint runs with `--max-warnings 0`, yamllint with `--strict`, and the Fallow audit job installs dependencies and fails on a `warn` verdict or a degraded analysis, which reopens FLOW-10. A passing `npm run check` prints npm's banner, six status lines, and one `Merged LCOV` line. Left: the Node 20 notice on the Lint pre-commit job." At the end of item 2: "Done in quick task `261005-jdx` (<short SHA of commit 5>): `init.sh` passes `--without guide`, the gate section is gone from `AGENTS.md`, and the task map stays but no longer refreshes on Fallow upgrades."

## Execution rules

- Every path is relative to the checkout root (an executor worktree or the main checkout). A fresh worktree starts with cold ESLint and Prettier caches: the first lint takes minutes.
- If the sandbox refuses a command line (a compound git command, or a line that names a `.git` path), write the command to `tmp/jdx/<name>.sh` and run `bash tmp/jdx/<name>.sh`. Run a task's `<verify>` that way if needed. Record each such deviation in the summary.
- Write logs under `tmp/jdx/` and record the exit code as the last line, never through a pipe: `<command> > tmp/jdx/<name>.log 2>&1; echo "<NAME>_EXIT=$?" >> tmp/jdx/<name>.log`.
- Run long commands in the foreground with a 600000 ms timeout. If a run can outlast it, background it once and wait for the completion notification. Never poll with sleep.
- Stage explicit paths only. Never `git add -A` or `git add .`, never `--amend`, `--no-verify`, or a rebase. Never stage the plan, the summary, `.planning/STATE.md`, REVIEW.md, the uqn directory, or anything under `tmp/`. Never edit the uqn directory. The operator edits files concurrently: leave other modified files alone.
- Delete every planted file right after its run. Before any commit, `git status --porcelain -- extensions tests scripts` must list only the commit's own paths, because the hook checks untracked files too.
- Commit procedure (AGENTS.md):
  1. Stage the commit's paths by name. pre-commit refuses to run while `.pre-commit-config.yaml` has unstaged edits.
  2. Run `SKIP=npm-check pre-commit run --files <the same paths> > tmp/jdx/precommit-N.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/jdx/precommit-N.log`. If a fixer changed a file, inspect the diff, restage, and rerun until the log ends `PRECOMMIT_EXIT=0`.
  3. Write the message to `tmp/jdx/commit-N.txt`: the task's title, body lines of 80 characters or fewer, no GSD IDs (no quick task, phase, or plan), then the attribution trailers your session instructions give. Check it with `pre-commit run gitlint --hook-stage commit-msg --commit-msg-filename tmp/jdx/commit-N.txt`.
  4. Confirm `git diff --cached --name-only` lists exactly the commit's paths.
  5. Run `git commit -F tmp/jdx/commit-N.txt > tmp/jdx/commit-N.log 2>&1; echo "COMMIT_EXIT=$?" >> tmp/jdx/commit-N.log` in the foreground. Its hook runs `npm run check:commit` when a build input is staged. If `COMMIT_EXIT` is not 0, no commit happened: read the log, fix the cause, restage, and commit again.
  6. Run `git rev-parse HEAD > tmp/jdx/commit-N.sha`.
- Do not run `fallow audit` before commits (OD-B removes that instruction). Task 2 runs it once against `origin/main` as evidence. Run `npm run check`, ESLint, tsc, or the test suites only where a step says so.

<!-- planner-discipline-allow: no-await-in-loop -->
<!-- planner-discipline-allow: Direct coverage passed -->
<!-- planner-discipline-allow: All-pair run complete -->
<!-- planner-discipline-allow: skippedReport -->
<!-- planner-discipline-allow: enforceSelectedPairs -->
<!-- planner-discipline-allow: Staged pairs: -->
<!-- planner-discipline-allow: gate passed -->
<!-- planner-discipline-allow: --test-reporter=spec -->
<!-- planner-discipline-allow: rm -f CLAUDE.md -->
<!-- planner-discipline-allow: ## Fallow local gate -->
<!-- planner-discipline-allow: gate-marker -->
<!-- planner-discipline-allow: npm run fallow:audit -->
<!-- planner-discipline-allow: process.stdout.write(`Changed-pair base -->

<tasks>

<task type="tracer">
  <name>Task 1: A warning fails lint and check:static, and a clean lint prints nothing</name>
  <files>extensions/pi-claude-marketplace/bridges/skills/discover.ts, extensions/pi-claude-marketplace/orchestrators/import/execute.ts, extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts, extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts, extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts, package.json</files>
  <precondition>The checkout descends from the planning HEAD, is not `main`, has `node_modules` and the git hooks, has nothing staged, and this plan's paths are clean: `test "$(git rev-parse --abbrev-ref HEAD)" != main && git merge-base --is-ancestor 8b741d0ebbc9105aa418f6b3e88fd8f4eaf82843 HEAD && test -x node_modules/.bin/eslint && test -x "$(git rev-parse --git-path hooks)/pre-commit" && git diff --cached --quiet && P="$(git status --porcelain -- extensions tests scripts package.json .fallowrc.json .pre-commit-config.yaml .github AGENTS.md CONTRIBUTING.md CHANGELOG.md skills .planning/codebase .planning/BACKLOG.md)" && test -z "$P"` succeeds. Otherwise halt and report.</precondition>
  <read_first>
    - package.json: the `lint` script
    - scripts/run-parallel.mjs (whole file; it is not edited)
  </read_first>
  <action>
Per OD-A and choices 1 and 2.
1. Run `mkdir -p tmp/jdx` and `git rev-parse HEAD > tmp/jdx/start-1.sha`.
2. Run `git grep -n "eslint-disable-next-line no-await-in-loop" -- extensions tests scripts demos > tmp/jdx/directives.txt`. Planning found 19 lines in the 9 files of this task (fact 2). If the set differs, stop and report the difference.
3. Delete each listed line whole: `sed -i '/^[[:space:]]*\/\/ eslint-disable-next-line no-await-in-loop -- /d'` followed by the 9 file paths typed literally. Do not use ESLint's fix mode. `git diff --numstat` must list exactly the 9 files, with 0 added and 19 deleted lines in total.
4. Run `npm run --silent lint > tmp/jdx/lint-1.log 2>&1; echo "LINT_EXIT=$?" >> tmp/jdx/lint-1.log` (cold cache: minutes). The log must be the single line `LINT_EXIT=0`. Any other line is a warning or an error: fix it and rerun.
5. Commit 1 (commit procedure, N=1) with the 9 paths. Title: `chore(lint): remove unused no-await-in-loop directives`. Body: ESLint does not enable that core rule, so it reported each of the 19 directives as unused, and a passing lint printed 19 warnings. A passing lint now prints nothing. The directives were added for SonarCloud's await-in-loop rule, so SonarCloud may report those awaits again.
6. In package.json, add `--max-warnings 0` to the `lint` script directly after `eslint.config.js`. Change nothing else in this task.
7. Planted warning (fact 3). Write the untracked file `tests/zz-jdx-plant.ts` with two lines: `// eslint-disable-next-line no-console -- planted unused directive` and `export const planted = 1;`. Run `npm run --silent lint > tmp/jdx/plant-lint-1.log 2>&1; echo "PLANT_LINT_EXIT=$?" >> tmp/jdx/plant-lint-1.log`, then `npm run --silent check:static > tmp/jdx/plant-static-1.log 2>&1; echo "PLANT_STATIC_EXIT=$?" >> tmp/jdx/plant-static-1.log`. Delete the plant at once and confirm `git status --porcelain -- tests` prints nothing. Expect lint to exit 1 with the unused-directive warning on the plant and `ESLint found too many warnings (maximum: 0).`. Expect `check:static` to exit 1 with a `failed lint (` line, the same warning, and five `passed` lines.
8. Run `npm run --silent lint > tmp/jdx/lint-2.log 2>&1; echo "LINT_EXIT=$?" >> tmp/jdx/lint-2.log`. The log must be the single line `LINT_EXIT=0`.
9. Commit 2 (N=2) with `package.json`. Title: `build(lint): fail on any ESLint warning`. Body: npm run lint passes --max-warnings 0, so an ESLint warning now fails lint, check:static, the commit hook, npm run check, and the CI static job. A passing lint prints nothing. Expect this commit's hook to run every pair, because package.json is staged.
  </action>
  <verify>
    <automated>S="$(cat tmp/jdx/start-1.sha)" && A="$(cat tmp/jdx/commit-1.sha)" && B="$(cat tmp/jdx/commit-2.sha)" && test "$(git rev-list --count "$S".."$B")" -eq 2 && test "$(git rev-parse "$B^")" = "$A" && test "$(git log -1 --format=%s "$A")" = "chore(lint): remove unused no-await-in-loop directives" && test "$(git log -1 --format=%s "$B")" = "build(lint): fail on any ESLint warning" && test "$(wc -l < tmp/jdx/directives.txt | tr -d ' ')" = "19" && NA="$(git diff --name-only "$S" "$A")" && test "$(printf '%s\n' "$NA" | LC_ALL=C sort | tr '\n' ' ')" = "$(cut -d: -f1 tmp/jdx/directives.txt | LC_ALL=C sort -u | tr '\n' ' ')" && MA="$(git diff --numstat "$S" "$A")" && test "$(printf '%s\n' "$MA" | awk '{a+=$1; d+=$2} END {print a, d}')" = "0 19" && NB="$(git diff --name-only "$A" "$B")" && test "$NB" = "package.json" && { git grep -q no-await-in-loop -- extensions tests scripts demos; test $? -eq 1; } && node -e 'if (!/ --max-warnings 0 /.test(require("./package.json").scripts.lint + " ")) process.exit(1)' && test "$(cat tmp/jdx/lint-1.log)" = "LINT_EXIT=0" && test "$(cat tmp/jdx/lint-2.log)" = "LINT_EXIT=0" && grep -q 'tests/zz-jdx-plant.ts' tmp/jdx/plant-lint-1.log && grep -q 'Unused eslint-disable directive' tmp/jdx/plant-lint-1.log && grep -qF 'ESLint found too many warnings (maximum: 0).' tmp/jdx/plant-lint-1.log && test "$(tail -1 tmp/jdx/plant-lint-1.log)" = "PLANT_LINT_EXIT=1" && grep -q '^failed lint (' tmp/jdx/plant-static-1.log && grep -q 'Unused eslint-disable directive' tmp/jdx/plant-static-1.log && test "$(grep -c '^passed ' tmp/jdx/plant-static-1.log)" = "5" && test "$(tail -1 tmp/jdx/plant-static-1.log)" = "PLANT_STATIC_EXIT=1" && test ! -e tests/zz-jdx-plant.ts && test "$(tail -1 tmp/jdx/precommit-1.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/precommit-2.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-1.log)" = "COMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-2.log)" = "COMMIT_EXIT=0" && echo "task 1 ok"</automated>
  </verify>
  <done>Two commits in `tmp/jdx/commit-1.sha` and `tmp/jdx/commit-2.sha`. The first deletes exactly the 19 directive lines and adds nothing. The second adds `--max-warnings 0` to `lint` and changes nothing else. A whole-repository lint prints nothing. A planted warning fails `npm run lint` and `check:static` with the warning visible, and the other five static steps pass. Both commit hooks passed, and no plant remains.</done>
</task>

<task type="auto">
  <name>Task 2: Every other check fails on its warnings, and a passing check prints only a short summary</name>
  <files>package.json, scripts/test-reporter.mjs, scripts/test-coverage-direct.mjs, scripts/check-workflow-install-scripts.mjs, scripts/check-corresponding-tests.mjs, .fallowrc.json, .pre-commit-config.yaml, .github/workflows/lint.yml</files>
  <read_first>
    - package.json: `check`, `check:commit`, `test:coverage`, `format:check`, `test:e2e`, `test:e2e:nightly`, `test:coverage:integration`, `test:coverage:e2e`
    - scripts/test-reporter.mjs (whole file)
    - scripts/test-coverage-direct.mjs: the doc comment of `selectBase`; `pairabilityRefusal`, `pairsForPaths`, and `pairsForChangedPaths` with their comments; then `runPair`, `measurePair`, `runAllPairs`, `writeMergedLcov`, `skippedReport`, `runChangedPairs`, `enforceSelectedPairs`, and `runStagedPairs` (from about line 600 to the end of `runStagedPairs`)
    - scripts/check-workflow-install-scripts.mjs and scripts/check-corresponding-tests.mjs: `main`
    - .pre-commit-config.yaml: the yamllint hook; .github/workflows/lint.yml: the `fallow-audit` job; .fallowrc.json: `rules`
    - This plan: "Warning sweep" and "Target text"
  </read_first>
  <action>
Per OD-A and choices 3 to 9.
1. `git rev-parse HEAD > tmp/jdx/start-2.sha`. Edit package.json:
   a. In `check`, `check:commit`, and `test:coverage`, every `npm run <script>` becomes `npm run --silent <script>`. The chains are otherwise unchanged.
   b. In `format:check`, insert `--log-level warn` directly after `--check`. Leave `format` alone.
   c. In `test:e2e` and `test:e2e:nightly`, insert `--test-reporter=./scripts/test-reporter.mjs` directly after `node --test`.
   d. In `test:coverage:integration` and `test:coverage:e2e`, replace `--test-reporter=spec` with `--test-reporter=./scripts/test-reporter.mjs`. Keep `--test-reporter-destination=stdout` and the lcov reporter pair.
2. Edit scripts/test-reporter.mjs (choice 5):
   a. Beside `thresholdPattern`, add `const failedCountPattern = /^(?:fail|cancelled) [1-9]/;`.
   b. Add a small function `runFailed(state)` that is true when `state.unmet` is not empty or any collected count matches `failedCountPattern`.
   c. The default export yields the joined count line only when counts were collected and `runFailed(state)` is true. Everything forwarded to `spec` and the shortfall lines stay exactly as they are.
   d. Rewrite the header comment: a passing run prints nothing beyond what tests themselves write and Node's diagnostics; failures keep Node's `spec` output; the count line follows a failed or cancelled test or an unmet coverage threshold; skipped and todo counts alone print nothing. Keep the `fallow-ignore-next-line` marker and the export name.
3. Edit scripts/test-coverage-direct.mjs (choices 3 and 4):
   a. `runPair`: delete the write of the "Direct coverage passed" line. Keep `summary` for the returned record, and keep the write that echoes the pair's captured output (it is empty for a passing pair once the reporter is silent).
   b. `measurePair`: keep the per-shortfall line. Its comment no longer says that `runPair` prints a line for every passing pair; it says the line shows a shortfall as soon as it lands, before the run fails.
   c. `runAllPairs`: delete the all-pair completion write and the `startedAt`, `elapsedMs`, and `elapsedSeconds` values that only it used. Keep `writeMergedLcov` and its "Merged LCOV" line unchanged.
   d. Delete `skippedReport` and `enforceSelectedPairs`. Remove the `skipped` computation from `pairsForPaths`, which then returns `{ pairs: [...] }`. Keep `pairabilityRefusal`, because `isPairablePath` uses it.
   e. `runChangedPairs`: delete the stdout write of the selected base. Wrap `await enforcePairs(selected.pairs)` in a try/catch whose catch writes `Changed-pair base: ${selected.base}` and a newline to stderr, then rethrows. The selection-failure branch stays.
   f. `runStagedPairs`: delete the stdout writes of the escalation notice and the staged-pair count. When `escalation` is set, wrap `await runAllPairs()` in a try/catch whose catch writes `Staged ${escalation} affects every pair, so every pair ran.` and a newline to stderr, then rethrows. Otherwise call `await enforcePairs(selected.pairs)`.
   g. Rewrite every comment that promises removed output so it states the current behavior: the paragraph above `runChangedPairs` (a failing run writes the selected base to stderr, which keeps a failing answer auditable, D-07-13; a failed selection still exits non-zero and names the git error, D-07-14; a passing run prints nothing), the `selectBase` doc (the returned candidate is what a failing run names), the `pairabilityRefusal` doc (drop the paragraph about a zero-pair report), and the `pairsForChangedPaths` doc (no passed-over paths). Search the file for "print", "report", and "passed over" to find them. The thrown incomplete-coverage error stays unchanged.
4. In scripts/check-workflow-install-scripts.mjs and scripts/check-corresponding-tests.mjs, the no-violation branch of `main` returns without writing anything. Failure output stays exactly as it is.
5. Evidence for the quiet passes and planted failures. Plants under `tmp/jdx/` are gitignored. Delete each plant under `extensions/` or `tests/` at once, and confirm `git status --porcelain -- extensions tests` prints nothing.
   a. Single-line passes (each log must be only its exit line with 0): `npm run --silent typecheck` into `typecheck-2.log` (TYPECHECK_EXIT), `npm run --silent lint:workflows` into `wf-2.log` (WF_EXIT), `npm run --silent test:corresponding` into `corr-2.log` (CORR_EXIT), `npm run --silent format:check` into `fmt-2.log` (FMT_EXIT), `npm run --silent test:unpaired` into `unpaired-2.log` (UNPAIRED_EXIT), and `npm run --silent test:integration` into `integration-2.log` (INTEGRATION_EXIT). Run `mkdir -p coverage`, then `npm run --silent test:coverage:integration` into `covint-2.log` (COVINT_EXIT); also `coverage/integration.lcov` must be non-empty. If an integration test fails, the log must still show Node's report and the count line; record whether the cause is environmental (stale pi-subagents global peer), and do not change tests.
   b. Workflow gate plant: write `tmp/jdx/wf-root/.github/workflows/plant.yml` holding the single line `run: npm ci`, then run `node scripts/check-workflow-install-scripts.mjs --root tmp/jdx/wf-root` into `plant-wf-2.log` (PLANT_WF_EXIT). Expect exit 1 and a line that starts `missing --ignore-scripts: .github/workflows/plant.yml:1:`.
   c. Pairing gate plant: write `extensions/pi-claude-marketplace/zz-jdx-planted.ts` holding `export const planted = 1;`, run `npm run --silent test:corresponding` into `plant-corr-2.log` (PLANT_CORR_EXIT), and delete it. Expect exit 1 and a violation that names the file.
   d. Prettier plant: write `tests/zz-jdx-fmt.ts` holding `export const planted   =   1;`, run `npm run --silent format:check` into `plant-fmt-2.log` (PLANT_FMT_EXIT), and delete it. Expect exit 1 and the line `[warn] tests/zz-jdx-fmt.ts`.
   e. Reporter plants under `tmp/jdx/plant/`: `pass.test.mjs` (one empty test), `fail.test.mjs` (one test named `planted fail` that throws), `partial.mjs` (an exported function with an `if` whose false path returns a different value), and `partial.test.mjs` (calls it on the true path only). Run `node --test --test-reporter=./scripts/test-reporter.mjs tmp/jdx/plant/pass.test.mjs` into `reporter-pass-2.log` (REPORTER_PASS_EXIT; single line, 0). Run the same on `fail.test.mjs` into `reporter-fail-2.log` (REPORTER_FAIL_EXIT): exit 1, Node's report naming `planted fail`, and a count line that starts `tests 1,` and shows `fail 1`. Run `node --test --experimental-test-coverage --test-coverage-include='tmp/jdx/plant/*.mjs' --test-coverage-exclude='tmp/jdx/plant/*.test.mjs' --test-coverage-lines=100 --test-reporter=./scripts/test-reporter.mjs tmp/jdx/plant/partial.test.mjs` into `reporter-coverage-2.log` (REPORTER_COVERAGE_EXIT): exit 1, Node's `does not meet threshold` line, a line that starts `coverage below threshold: tmp/jdx/plant/partial.mjs `, and a count line.
   f. Direct coverage passes (single exit line, 0): `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/shared/compare-name-scope.ts` into `direct-pair-2.log` (DIRECT_PAIR_EXIT), and `node scripts/test-coverage-direct.mjs --staged` with nothing staged into `direct-staged-2.log` (DIRECT_STAGED_EXIT).
   g. Direct coverage failures. Confirm `git diff --quiet HEAD -- extensions/pi-claude-marketplace/shared/compare-name-scope.ts`, copy that file to `tmp/jdx/compare-name-scope.ts.orig`, and append an exported function that no test calls. Run `node scripts/test-coverage-direct.mjs --base HEAD` into `direct-plant-2.log` (DIRECT_PLANT_EXIT): exit 1, the line `Changed-pair base: HEAD`, and a line that starts `Incomplete direct coverage for extensions/pi-claude-marketplace/shared/compare-name-scope.ts: `. Then build a temporary index (fact 13): `GIT_INDEX_FILE="$PWD/tmp/jdx/probe.index" git read-tree HEAD`; write `{}` to `tmp/jdx/probe-tsconfig.json` and store a blob with `git hash-object -w tmp/jdx/probe-tsconfig.json`; run `GIT_INDEX_FILE="$PWD/tmp/jdx/probe.index" git update-index --cacheinfo "100644,<blob>,tsconfig.json"`. Run `GIT_INDEX_FILE="$PWD/tmp/jdx/probe.index" node scripts/test-coverage-direct.mjs --staged` into `escalate-2.log` (ESCALATE_EXIT; about a minute): exit 1, the line `Staged tsconfig.json affects every pair, so every pair ran.`, and the same incomplete-coverage line. Copy the original back at once, confirm the file is clean against HEAD, and delete the probe index and the probe JSON. The real index stays empty.
   h. Optional, needs the network: `npm run --silent test:e2e` into `e2e-2.log` (E2E_EXIT). A pass is the single exit line. A failure must show Node's report and the count line; record whether the cause is environmental. If the machine has no network, skip it and say so.
6. Commit 3 (N=3) with `package.json scripts/test-reporter.mjs scripts/test-coverage-direct.mjs scripts/check-workflow-install-scripts.mjs scripts/check-corresponding-tests.mjs`. Title: `build(checks): print only a summary from passing checks`. Body: nested npm runs pass --silent; the gate scripts no longer announce a pass; Prettier's check logs warnings only; the project test reporter prints its count line only after a failed or cancelled test or an unmet coverage threshold, and every node --test script uses it; direct coverage prints nothing on a pass except the merged LCOV line, and a failing run names its base or the staged file that made every pair run.
7. Apply the "Target text" for `.fallowrc.json` (choice 7), the yamllint hook in `.pre-commit-config.yaml` (choice 6), and the `fallow-audit` job in `.github/workflows/lint.yml` (choice 8). Then stage these three paths (pre-commit needs the config staged).
8. Evidence for the warning fixes:
   a. `npm run --silent fallow` into `fallow-warm-2.log` (FALLOW_EXIT, 0). The first run after the config change may print Fallow's stderr tracing line `WARN Graph cache decoded but not reused`: tool noise, left (sweep table). Run it again into `fallow-2.log`, which must be the single line `FALLOW_EXIT=0`. Then `npx fallow dead-code --format json --quiet > tmp/jdx/fallow-dc-2.json`: `total_issues` is 0 and there is no `workspace_diagnostics` entry.
   b. `pre-commit run yamllint --all-files --verbose` into `yamllint-2.log` (YAMLLINT_EXIT; 0, and no `warning` or `error` finding line). Write `tmp/jdx/plant.yml` holding `key: value #no space` and run `pre-commit run yamllint --files tmp/jdx/plant.yml` into `plant-yaml-2.log` (PLANT_YAML_EXIT): exit 1 and `missing starting space in comment`.
   c. `pre-commit run zizmor --all-files --verbose` into `zizmor-2.log` (ZIZMOR_EXIT) and `pre-commit run markdownlint-cli2 --all-files --verbose` into `markdownlint-2.log` (MDLINT_EXIT): both exit 0, zizmor prints `No findings to report`, and markdownlint prints `Summary: 0 error(s)`.
   d. `npm run --silent lint:workflows` into `wf-3.log` (WF_EXIT; single line, 0): the new install step carries `--ignore-scripts`.
   e. `npx fallow audit --base origin/main --format json --quiet > tmp/jdx/audit-2.json 2> tmp/jdx/audit-2.err`: `verdict` is `pass`, and no `dead_code.workspace_diagnostics` entry has `degrades_analysis` set to true. This is what the new CI step reads.
   f. Optional, needs `gh`: `gh api "repos/fallow-rs/fallow/contents/action.yml?ref=bd8fca5af5df4ccfd94c7a835d17bd93c31a7cef" --jq .content > tmp/jdx/fallow-action.b64` and `base64 -d tmp/jdx/fallow-action.b64 > tmp/jdx/fallow-action.yml`. The outputs list `verdict:` and `analysis-degraded:`, the names the new step reads (fact 9). If `gh` is unavailable, say so.
9. Commit 4 (N=4) with `.fallowrc.json .pre-commit-config.yaml .github/workflows/lint.yml`. Title: `ci: fail on yamllint and Fallow audit warnings`. Body: yamllint runs with --strict and accepts the one-space comment padding that yamlfmt writes; the Fallow audit job installs the npm dependencies, so its analysis is not degraded, and fails on a warn verdict or a degraded analysis, so a pull request that adds a clone group now fails; policy-violation is off because no rule pack is configured, so that detector measured nothing.
10. Write the confirmed "Warning sweep" table, with an evidence column, into the summary draft (Task 3 finishes the summary).
  </action>
  <verify>
    <automated>S="$(cat tmp/jdx/start-2.sha)" && C="$(cat tmp/jdx/commit-3.sha)" && D="$(cat tmp/jdx/commit-4.sha)" && test "$(git rev-list --count "$S".."$D")" -eq 2 && test "$(git rev-parse "$D^")" = "$C" && test "$(git log -1 --format=%s "$C")" = "build(checks): print only a summary from passing checks" && test "$(git log -1 --format=%s "$D")" = "ci: fail on yamllint and Fallow audit warnings" && NC="$(git diff --name-only "$S" "$C")" && test "$(printf '%s\n' "$NC" | LC_ALL=C sort | tr '\n' ' ')" = "package.json scripts/check-corresponding-tests.mjs scripts/check-workflow-install-scripts.mjs scripts/test-coverage-direct.mjs scripts/test-reporter.mjs " && ND="$(git diff --name-only "$C" "$D")" && test "$(printf '%s\n' "$ND" | LC_ALL=C sort | tr '\n' ' ')" = ".fallowrc.json .github/workflows/lint.yml .pre-commit-config.yaml " && node -e 'const s=require("./package.json").scripts;const bad=[];for(const k of ["check","check:commit","test:coverage"]){const all=s[k].split("npm run ").length-1;const quiet=s[k].split("npm run --silent ").length-1;if(all===0||all!==quiet)bad.push(k)}if(!s["format:check"].startsWith("prettier --check --log-level warn "))bad.push("format:check");if(!/ --max-warnings 0 /.test(s.lint+" "))bad.push("lint");for(const k of ["test:e2e","test:e2e:nightly","test:coverage:integration","test:coverage:e2e"])if(!s[k].includes("--test-reporter=./scripts/test-reporter.mjs"))bad.push(k);for(const k of ["test:coverage:integration","test:coverage:e2e"])if(!s[k].includes("--test-reporter=lcov"))bad.push(k+" lcov");if(Object.values(s).some((v)=>v.includes("--test-reporter=spec")))bad.push("spec");if(bad.length>0){console.error(bad.join(", "));process.exit(1)}' && grep -qF 'const failedCountPattern = /^(?:fail|cancelled) [1-9]/;' scripts/test-reporter.mjs && ! grep -qE 'Direct coverage passed|All-pair run complete|skippedReport|enforceSelectedPairs|Staged pairs:' scripts/test-coverage-direct.mjs && ! grep -qF 'process.stdout.write(`Changed-pair base' scripts/test-coverage-direct.mjs && grep -qF 'Changed-pair base: ${selected.base}' scripts/test-coverage-direct.mjs && grep -qF 'affects every pair, so every pair ran.' scripts/test-coverage-direct.mjs && grep -qF 'Merged LCOV: ${lcovPath}' scripts/test-coverage-direct.mjs && ! grep -q 'gate passed' scripts/check-workflow-install-scripts.mjs scripts/check-corresponding-tests.mjs && node -e 'const c=require("./.fallowrc.json");if(c.rules["policy-violation"]!=="off")process.exit(1)' && /usr/bin/python3 -c 'import sys, yaml
c = yaml.safe_load(open(".pre-commit-config.yaml"))
h = [h for r in c["repos"] for h in r["hooks"] if h["id"] == "yamllint"][0]
a = h["args"]
cfg = yaml.safe_load(a[a.index("-d") + 1])
r = cfg["rules"]
sys.exit(0 if "--strict" in a and r["comments"] == {"min-spaces-from-content": 1} and r["line-length"] == "disable" and r["document-start"] == "disable" and r["truthy"] == "disable" else 1)' && /usr/bin/python3 -c 'import sys, yaml
steps = yaml.safe_load(open(".github/workflows/lint.yml"))["jobs"]["fallow-audit"]["steps"]
audit = [s for s in steps if str(s.get("uses", "")).startswith("fallow-rs/fallow@")]
fail = [s for s in steps if "steps.fallow.outputs.verdict == " in str(s.get("if", ""))]
ok = any("npm ci --ignore-scripts" in s.get("run", "") for s in steps) and any(str(s.get("uses", "")).startswith("actions/setup-node@") for s in steps) and len(audit) == 1 and audit[0].get("id") == "fallow" and len(fail) == 1 and "steps.fallow.outputs.analysis-degraded" in fail[0]["if"] and "exit 1" in fail[0].get("run", "") and "${{" not in fail[0].get("run", "") and steps.index(fail[0]) > steps.index(audit[0])
sys.exit(0 if ok else 1)' && test "$(cat tmp/jdx/typecheck-2.log)" = "TYPECHECK_EXIT=0" && test "$(cat tmp/jdx/wf-2.log)" = "WF_EXIT=0" && test "$(cat tmp/jdx/wf-3.log)" = "WF_EXIT=0" && test "$(cat tmp/jdx/corr-2.log)" = "CORR_EXIT=0" && test "$(cat tmp/jdx/fmt-2.log)" = "FMT_EXIT=0" && test "$(cat tmp/jdx/unpaired-2.log)" = "UNPAIRED_EXIT=0" && { test "$(cat tmp/jdx/integration-2.log)" = "INTEGRATION_EXIT=0" || grep -qE '^tests [0-9]+, ' tmp/jdx/integration-2.log; } && { test "$(cat tmp/jdx/covint-2.log)" = "COVINT_EXIT=0" || grep -qE '^tests [0-9]+, ' tmp/jdx/covint-2.log; } && test -s coverage/integration.lcov && grep -q '^missing --ignore-scripts: .github/workflows/plant.yml:1:' tmp/jdx/plant-wf-2.log && test "$(tail -1 tmp/jdx/plant-wf-2.log)" = "PLANT_WF_EXIT=1" && grep -q 'zz-jdx-planted' tmp/jdx/plant-corr-2.log && test "$(tail -1 tmp/jdx/plant-corr-2.log)" = "PLANT_CORR_EXIT=1" && grep -qx '\[warn\] tests/zz-jdx-fmt.ts' tmp/jdx/plant-fmt-2.log && test "$(tail -1 tmp/jdx/plant-fmt-2.log)" = "PLANT_FMT_EXIT=1" && test "$(cat tmp/jdx/reporter-pass-2.log)" = "REPORTER_PASS_EXIT=0" && grep -q 'planted fail' tmp/jdx/reporter-fail-2.log && grep -qE '^tests 1, .*fail 1,' tmp/jdx/reporter-fail-2.log && test "$(tail -1 tmp/jdx/reporter-fail-2.log)" = "REPORTER_FAIL_EXIT=1" && grep -q 'does not meet threshold' tmp/jdx/reporter-coverage-2.log && grep -q '^coverage below threshold: tmp/jdx/plant/partial.mjs ' tmp/jdx/reporter-coverage-2.log && grep -qE '^tests [0-9]+, ' tmp/jdx/reporter-coverage-2.log && test "$(tail -1 tmp/jdx/reporter-coverage-2.log)" = "REPORTER_COVERAGE_EXIT=1" && test "$(cat tmp/jdx/direct-pair-2.log)" = "DIRECT_PAIR_EXIT=0" && test "$(cat tmp/jdx/direct-staged-2.log)" = "DIRECT_STAGED_EXIT=0" && grep -qx 'Changed-pair base: HEAD' tmp/jdx/direct-plant-2.log && grep -q '^Incomplete direct coverage for extensions/pi-claude-marketplace/shared/compare-name-scope.ts: ' tmp/jdx/direct-plant-2.log && test "$(tail -1 tmp/jdx/direct-plant-2.log)" = "DIRECT_PLANT_EXIT=1" && grep -qxF 'Staged tsconfig.json affects every pair, so every pair ran.' tmp/jdx/escalate-2.log && grep -q '^Incomplete direct coverage for extensions/pi-claude-marketplace/shared/compare-name-scope.ts: ' tmp/jdx/escalate-2.log && test "$(tail -1 tmp/jdx/escalate-2.log)" = "ESCALATE_EXIT=1" && test ! -e tmp/jdx/probe.index && git diff --quiet HEAD -- extensions/pi-claude-marketplace/shared/compare-name-scope.ts && { test ! -e tmp/jdx/e2e-2.log || test "$(cat tmp/jdx/e2e-2.log)" = "E2E_EXIT=0" || grep -qE '^tests [0-9]+, ' tmp/jdx/e2e-2.log; } && test "$(cat tmp/jdx/fallow-2.log)" = "FALLOW_EXIT=0" && node -e 'const j=require("./tmp/jdx/fallow-dc-2.json");if(j.total_issues!==0||(j.workspace_diagnostics??[]).length!==0)process.exit(1)' && test "$(tail -1 tmp/jdx/yamllint-2.log)" = "YAMLLINT_EXIT=0" && ! grep -qE '^[[:space:]]+[0-9]+:[0-9]+[[:space:]]+(warning|error)' tmp/jdx/yamllint-2.log && grep -q 'missing starting space in comment' tmp/jdx/plant-yaml-2.log && test "$(tail -1 tmp/jdx/plant-yaml-2.log)" = "PLANT_YAML_EXIT=1" && test "$(tail -1 tmp/jdx/fallow-warm-2.log)" = "FALLOW_EXIT=0" && test "$(tail -1 tmp/jdx/zizmor-2.log)" = "ZIZMOR_EXIT=0" && grep -q 'No findings to report' tmp/jdx/zizmor-2.log && test "$(tail -1 tmp/jdx/markdownlint-2.log)" = "MDLINT_EXIT=0" && grep -q 'Summary: 0 error(s)' tmp/jdx/markdownlint-2.log && node -e 'const j=require("./tmp/jdx/audit-2.json");const d=(j.dead_code&&j.dead_code.workspace_diagnostics)||[];if(j.verdict!=="pass"||d.some((x)=>x.degrades_analysis===true))process.exit(1)' && W="$(git status --porcelain -- extensions tests scripts)" && test -z "$W" && git diff --cached --quiet && test "$(tail -1 tmp/jdx/precommit-3.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/precommit-4.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-3.log)" = "COMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-4.log)" = "COMMIT_EXIT=0" && echo "task 2 ok"</automated>
  </verify>
  <done>Two commits in `tmp/jdx/commit-3.sha` and `tmp/jdx/commit-4.sha` change exactly the five quiet-output files and the three warning-fix files. Passing typecheck, lint:workflows, test:corresponding, format:check, unpaired and integration tests, the reporter, an explicit pair, and a staged run with nothing staged each print nothing. Planted failures in both gate scripts, Prettier, the reporter (failing test and unmet threshold), a changed-pair run, an escalated staged run, and yamllint each print their report and exit non-zero, and the two direct-coverage failures name their base and the staged file. Fallow reports 0 issues and no diagnostic, yamllint is strict with zero warnings on the tree, and the CI audit job installs dependencies and fails on a warn verdict or a degraded analysis. The audit against origin/main passes. The sweep table is drafted with evidence.</done>
</task>

<task type="auto">
  <name>Task 3: Fallow stops rewriting AGENTS.md, the docs match, and the final npm run check prints the short shape</name>
  <files>scripts/init.sh, AGENTS.md, CONTRIBUTING.md, skills/local-verification/SKILL.md, CHANGELOG.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/STACK.md, .planning/codebase/TESTING.md, .planning/BACKLOG.md</files>
  <read_first>
    - scripts/init.sh: the Fallow lines and the `# normalize AGENTS.md` block
    - AGENTS.md: from the `fallow:setup-hooks:start` marker to the end
    - .claude/rules/changelog.md, then the simple-english (Plain mode) and humanizer skills (Skill tool, or their SKILL.md under the main checkout's `.agents/skills/`)
    - CONTRIBUTING.md "Checks"; skills/local-verification/SKILL.md "What the commands run" and "Committing"; CHANGELOG.md the #236 entry and its sub-bullets
    - .planning/codebase/CONVENTIONS.md: the Linting bullets, the Fallow bullets, and the Logging section; .planning/codebase/STACK.md: the fallow, pre-commit, and `lint.yml` lines; .planning/codebase/TESTING.md: "Run Commands"; .planning/BACKLOG.md: the FLOW-10 entry
    - REVIEW.md in the main checkout: "Next steps (operator, 2026-10-05...)" only
    - This plan: "Target text"
  </read_first>
  <action>
Per OD-B and OD-C.
1. `git rev-parse HEAD > tmp/jdx/start-3.sha`. In scripts/init.sh, apply the "Target text" for the Fallow lines: the install line gains `--without guide` and keeps `--harness claude --harness codex --without hooks --approve`; the comment above it is replaced; the CLAUDE.md removal line, its comment, and the blank line before them go. The `.claude/CLAUDE.md` removal for CodeGraph and the `# normalize AGENTS.md` block stay.
2. In AGENTS.md, delete the gate section by hand: its heading line and its three paragraphs (the audit-before-commit instruction, the gate=new-only note, and the note for non-skill agents), with the blank lines that separate them, so the start marker is followed by one blank line and the "Fallow task map" heading. The task map, its table, and both markers stay byte-identical. Delete lines only.
3. Run the install line from init.sh as a dry run: `bash -c "$(grep -E '^npx fallow agent install' scripts/init.sh) --dry-run" > tmp/jdx/agent-dry-3.log 2>&1; echo "DRY_EXIT=$?" >> tmp/jdx/agent-dry-3.log`. Expect exit 0, the `fallow agent install (dry run)` header, and no `AGENTS.md` or `CLAUDE.md` row. Re-check the other live references to running the Fallow audit before a commit: `git grep -n -i "fallow audit" -- . ':!.planning/milestones' ':!.planning/quick' ':!.planning/phases' ':!.planning/spikes'` may list only the kept task-map row in AGENTS.md, the `Run fallow audit` step name in lint.yml, BACKLOG history, and the CONVENTIONS line that step 5 rewrites. Record the result.
4. Commit 5 (N=5) with `scripts/init.sh AGENTS.md`. Title: `chore(init): stop fallow agent install from writing AGENTS.md`. Body: init.sh passes --without guide, so fallow agent install no longer rewrites AGENTS.md or creates a CLAUDE.md import shim, and the CLAUDE.md removal goes. The gate section that told agents to run fallow audit before each commit and push is removed by hand: the commit hook already runs npm run fallow. The task map stays, but it no longer refreshes on fallow upgrades.
5. Apply the doc wording of "Target text" to CONTRIBUTING.md, skills/local-verification/SKILL.md, CHANGELOG.md, and the three `.planning/codebase/` files, and add the FLOW-10 note to `.planning/BACKLOG.md`. Run the changelog rule's simple-english and humanizer self-checks on every new CHANGELOG, CONTRIBUTING, and skill sentence: 25 words or fewer, no semicolon, no should, would, could, or may. In CHANGELOG.md change no line outside the two new sub-bullets. Keep each mdformat paragraph on one line. Change nothing else in these files.
6. Commit 6 (N=6) with `CONTRIBUTING.md skills/local-verification/SKILL.md CHANGELOG.md .planning/codebase/CONVENTIONS.md .planning/codebase/STACK.md .planning/codebase/TESTING.md .planning/BACKLOG.md`. Title: `docs: describe warning-free checks and quiet output`. Body: CONTRIBUTING, the local-verification skill, and the changelog say that every check fails on a warning and that a passing check prints little; the codebase map records the ESLint, yamllint, and Fallow settings; the backlog records that the audit job now fails on introduced duplication.
7. REVIEW.md (untracked, main checkout; never stage it): resolve it as `"$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md"` and append the two "Target text" notes to "Next steps" items 1 and 2, with the short SHAs from `tmp/jdx/commit-*.sha`. Change nothing else in it.
8. Final evidence. Run `npm run --silent lint > tmp/jdx/lint-3.log 2>&1; echo "LINT_EXIT=$?" >> tmp/jdx/lint-3.log` (single line `LINT_EXIT=0`). Then run `npm run check > tmp/jdx/check-final.log 2>&1; echo "CHECK_EXIT=$?" >> tmp/jdx/check-final.log` in the foreground (about two minutes warm). Expected shape (JDX-06): npm's banner (a blank line, `> pi-claude-marketplace@<version> check`, `> npm run --silent check:static && ...`, a blank line), six lines `passed <step> (<seconds> s)` for typecheck, lint, lint:workflows, fallow, format:check, and test:corresponding, one line `Merged LCOV: coverage/direct.lcov (<N> records)`, and `CHECK_EXIT=0`. Any other line is a warning or chatter: find its source, fix it, and rerun. If a line comes from the machine rather than the repository (for example an npm configuration warning), do not change the repository for it: record it as a deviation and classify it in the sweep table. Record the command, exit status, commit, and `node --version` in the summary, as the local-verification skill asks.
9. Finish the summary (see `<output>`).
  </action>
  <verify>
    <automated>S="$(cat tmp/jdx/start-3.sha)" && E="$(cat tmp/jdx/commit-5.sha)" && F="$(cat tmp/jdx/commit-6.sha)" && test "$(git rev-list --count "$S".."$F")" -eq 2 && test "$(git rev-parse "$F^")" = "$E" && test "$(git log -1 --format=%s "$E")" = "chore(init): stop fallow agent install from writing AGENTS.md" && test "$(git log -1 --format=%s "$F")" = "docs: describe warning-free checks and quiet output" && NE="$(git diff --name-only "$S" "$E")" && test "$(printf '%s\n' "$NE" | LC_ALL=C sort | tr '\n' ' ')" = "AGENTS.md scripts/init.sh " && NF="$(git diff --name-only "$E" "$F")" && test "$(printf '%s\n' "$NF" | LC_ALL=C sort | tr '\n' ' ')" = ".planning/BACKLOG.md .planning/codebase/CONVENTIONS.md .planning/codebase/STACK.md .planning/codebase/TESTING.md CHANGELOG.md CONTRIBUTING.md skills/local-verification/SKILL.md " && grep -qxF 'npx fallow agent install --harness claude --harness codex --without hooks --without guide --approve' scripts/init.sh && ! grep -qF 'rm -f CLAUDE.md' scripts/init.sh && grep -q 'no longer refreshes' scripts/init.sh && grep -qF 'rm -f .claude/CLAUDE.md' scripts/init.sh && ! grep -qx '## Fallow local gate' AGENTS.md && ! grep -q 'gate-marker' AGENTS.md && grep -qx '## Fallow task map' AGENTS.md && grep -q 'fallow:setup-hooks:start' AGENTS.md && grep -q 'fallow:setup-hooks:end' AGENTS.md && ME="$(git diff --numstat "$S" "$E" -- AGENTS.md)" && test "$(printf '%s\n' "$ME" | cut -f1)" = "0" && test "$(tail -1 tmp/jdx/agent-dry-3.log)" = "DRY_EXIT=0" && grep -qF 'fallow agent install (dry run)' tmp/jdx/agent-dry-3.log && ! grep -qE '(AGENTS|CLAUDE)\.md' tmp/jdx/agent-dry-3.log && grep -q 'warning' CONTRIBUTING.md && grep -qF 'Merged LCOV' CONTRIBUTING.md && grep -qF -- '--max-warnings 0' skills/local-verification/SKILL.md && grep -qF 'Merged LCOV' skills/local-verification/SKILL.md && grep -qF -- '--strict' skills/local-verification/SKILL.md && awk 'index($0,"(#236)"){f=1} f&&index($0,"Internal: local checks now select"){exit} f' CHANGELOG.md > tmp/jdx/c236.txt && grep -q '^  - .*warning' tmp/jdx/c236.txt && grep -q '^  - .*AGENTS.md' tmp/jdx/c236.txt && MF="$(git diff --numstat "$E" "$F" -- CHANGELOG.md)" && test "$(printf '%s\n' "$MF" | cut -f1,2 | tr '\t' ' ')" = "2 0" && grep -qF -- '--max-warnings 0' .planning/codebase/CONVENTIONS.md && grep -q 'policy-violation' .planning/codebase/CONVENTIONS.md && ! grep -qF 'npm run fallow:audit' .planning/codebase/CONVENTIONS.md && grep -qF -- '--strict' .planning/codebase/STACK.md && grep -q 'degraded' .planning/codebase/STACK.md && grep -qF 'scripts/test-reporter.mjs' .planning/codebase/TESTING.md && grep -q '261005-jdx' .planning/BACKLOG.md && R="$(git rev-parse --path-format=absolute --git-common-dir)/../REVIEW.md" && test -f "$R" && test "$(grep -c '261005-jdx' "$R")" -ge 2 && L="$(git -C "$(dirname "$R")" ls-files REVIEW.md)" && test -z "$L" && test "$(cat tmp/jdx/lint-3.log)" = "LINT_EXIT=0" && test "$(tail -1 tmp/jdx/check-final.log)" = "CHECK_EXIT=0" && O="$(grep -v '^> ' tmp/jdx/check-final.log | grep -v '^$' | grep -v '^CHECK_EXIT=')" && test "$(printf '%s\n' "$O" | wc -l | tr -d ' ')" = "7" && test "$(printf '%s\n' "$O" | grep -cE '^passed (typecheck|lint|lint:workflows|fallow|format:check|test:corresponding) \([0-9.]+ s\)$')" = "6" && printf '%s\n' "$O" | grep -qE '^Merged LCOV: coverage/direct\.lcov \([0-9]+ records\)$' && git diff --cached --quiet && test "$(tail -1 tmp/jdx/precommit-5.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/precommit-6.log)" = "PRECOMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-5.log)" = "COMMIT_EXIT=0" && test "$(tail -1 tmp/jdx/commit-6.log)" = "COMMIT_EXIT=0" && echo "task 3 ok"</automated>
  </verify>
  <done>Commit 5 changes exactly scripts/init.sh and AGENTS.md: the install line passes `--without guide`, the CLAUDE.md removal is gone, the comment notes the hand-kept task map, and AGENTS.md lost only the gate section. The dry run writes neither AGENTS.md nor CLAUDE.md. Commit 6 changes exactly the seven doc files, and CHANGELOG #236 gains two sub-bullets with no other line changed. REVIEW.md marks Next steps 1 and 2 done and stays untracked. A final `npm run --silent lint` prints nothing, and `npm run check` exits 0 with npm's banner, six status lines, and one Merged LCOV line only.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| check output -> reader | An operator or agent acts on what a run prints. Quieting a pass must never hide a failure or a warning. |
| pull request -> Fallow audit verdict | Code under review decides the audit verdict, and the new step turns a warning into a failure. |
| init.sh -> developer checkout | The setup script writes agent files into every fresh checkout and worktree. |

## STRIDE Threat Register

ASVS level 1. Blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-jdx-01 | Repudiation | quiet passing output (`--silent`, reporter, gate scripts, direct coverage) | medium | mitigate | Exit codes are unchanged and only success text goes. Every warning class that exited 0 now fails (ESLint, yamllint, Fallow audit), so a hidden pass holds no warning. Planted failures in Tasks 1 and 2 prove each tool's own failure output survives: ESLint through `check:static`, both gate scripts, Prettier, a failing test, an unmet threshold, a changed-pair shortfall with its base, an escalated staged shortfall with its staged file, and yamllint. |
| T-jdx-02 | Tampering | `.github/workflows/lint.yml` fail step | medium | mitigate | A misspelled output name evaluates to an empty string, and the step would never fire. The output names come from the action.yml at the pinned SHA (fact 9), and Task 2 re-reads it when `gh` is available. The verify pins the step's `id`, its condition, its order, and its `env` use. The audit against `origin/main` passes today, so the step cannot fail the first run on old findings. Its first real run is on the pull request (REVIEW F1). |
| T-jdx-03 | Elevation of privilege | `npm ci` in the `fallow-audit` job on pull-request code | low | mitigate | The install passes `--ignore-scripts` (enforced by `lint:workflows`), the job keeps `contents: read`, the checkout keeps `persist-credentials: false`, and the outputs reach the shell only through `env:` (zizmor checks the file). |
| T-jdx-04 | Denial of service | the audit now fails on introduced duplication (reopens FLOW-10) | low | accept | Deliberate per the operator's warnings-fail decision. A pull request that adds a clone group fails until the clone is removed or the operator restores the old posture by deleting the step. The summary and REVIEW.md flag it. |
| T-jdx-05 | Repudiation | a vacuous test run | low | accept | A glob that matched no test now passes silently, as it passed before. The test globs are static, and the all-pair direct-coverage run asserts one record per production module. |
| T-jdx-06 | Information disclosure | temporary index and planted files | low | accept | The probe blob, index, and plants stay local under `tmp/jdx/` or are deleted at once. The real index stays empty. |
| T-jdx-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no package. The CI job installs the existing lockfile with `npm ci --ignore-scripts`. |
</threat_model>

<verification>
All three task `<verify>` commands print `task N ok` on the final commit. `git status --short` shows no planted file and nothing staged. `npm run check` passed on the final tree in this checkout (Task 3 step 8). A merge does not run the hook, so after the worktree merges, the orchestrator runs `npm run check` in the main checkout before the quick task finishes, or reuses this result under the local-verification skill's rule.
</verification>

<success_criteria>
- `npm run --silent lint` prints nothing, and a planted ESLint warning fails `lint` and `check:static` with the warning shown.
- Every other step and CI job fails on its warnings or has a recorded "none" with evidence, and tool noise is classified as silenced or left with a reason.
- Passing gate scripts, Prettier, tests, and direct coverage print nothing except one Merged LCOV line, and every planted failure still prints its report.
- `fallow agent install` no longer writes AGENTS.md or CLAUDE.md, and AGENTS.md keeps only the task map inside its markers.
- The docs, BACKLOG FLOW-10, and REVIEW.md match the tree.
- `npm run check` exits 0 with npm's banner, six status lines, and one Merged LCOV line.
- Six commits, each hook passed, and `.planning/STATE.md` is in none of them.
</success_criteria>

## Source audit

| Source | Item | Plan coverage | Status |
| --- | --- | --- | --- |
| GOAL | Fail checks on warnings and keep passing output quiet; stop Fallow rewriting AGENTS.md | Tasks 1-3 | COVERED |
| CONTEXT | OD-A: delete the 19 directives as whole lines, in their own commit | Task 1 steps 2-5 | COVERED |
| CONTEXT | OD-A: `--max-warnings 0` wherever ESLint gates | Task 1 step 6; choice 2 | COVERED |
| CONTEXT | OD-A: sweep every check step and CI job; make each warning fail or show none; zero warnings on the final tree | Task 2; "Warning sweep"; Task 3 step 8 | COVERED |
| CONTEXT | OD-A: classify tool noise (Fallow tracing, ExperimentalWarning, and others) as silenced or left, with a reason | "Warning sweep"; Task 2 step 10 | COVERED |
| CONTEXT | OD-A: `run-parallel.mjs` keeps hiding passing output | Choice 9 | COVERED |
| CONTEXT | OD-A: uqn parts that still apply (nested `--silent`, quiet gates, `--log-level warn`, silent reporter, quiet direct coverage with a justified summary line); drop the `check-changed.mjs` parts | Task 2 steps 1-4; choice 3 | COVERED |
| CONTEXT | OD-B: `--without guide`, drop the CLAUDE.md removal, update the comment with the refresh note, remove the AGENTS.md gate section by hand, update other references | Task 3 steps 1-4 | COVERED |
| CONTEXT | OD-C: CONTRIBUTING, the skill, CHANGELOG #236, CONVENTIONS, STACK, TESTING; REVIEW.md items 1 and 2 | Task 3 steps 5-7 | COVERED |
| CONTEXT | Verification: final `npm run check` green with zero ESLint warnings; silent lint; planted warning; expected output shape; dry run | Task 1 steps 4, 7, 8; Task 3 steps 3, 8 | COVERED |
| DISCOVERED | yamllint warnings hidden by pre-commit; Fallow rule-pack diagnostic; degraded CI audit; FLOW-10 and D-07-13/14 overlap | Task 2 steps 7-9; choices 4, 6-8 | COVERED |
| REQ | JDX-01 to JDX-06 | Requirement map | COVERED |
| RESEARCH | None: quick task, no research phase | - | N/A |

<output>
Create `.planning/quick/261005-jdx-fail-checks-on-warnings-and-keep-passing/261005-jdx-SUMMARY.md`. Include the six commit SHAs and titles, the hook result of each commit, the last line of every `tmp/jdx/*.log`, the confirmed "Warning sweep" table with an evidence column, the final `npm run check` output shape with its command, exit status, commit, and `node --version`, the final changelog wording, and every sandbox deviation. Flag for the operator: the Fallow audit job now fails on introduced duplication (reopens BACKLOG FLOW-10); the print-on-pass parts of D-07-13 and D-07-14 are superseded; SonarCloud may report the 19 awaits again; the Node 20 notice on the Lint pre-commit job is left; the new audit step and the yamllint `--strict` setting run on GitHub for the first time on the pull request; REVIEW.md S5 (`maxUnitSize`) and the stale `fallow-ignore` count in CONVENTIONS.md (F5) are unchanged. Include:

```markdown
## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
```

Replace "None" with specifics if execution finds otherwise.
</output>
