---
phase: 261005-phr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - CHANGELOG.md
  - AGENTS.md
  - .planning/PROJECT.md
  - .planning/codebase/STACK.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/shared/extension-version.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - eslint.config.js
  - tests/architecture/gate-targets.ts
  - docs/output-catalog.md
  - .planning/codebase/CONCERNS.md
  - .planning/codebase/CONVENTIONS.md
  - .planning/codebase/STRUCTURE.md
  - .planning/codebase/TESTING.md
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - extensions/pi-claude-marketplace/domain/README.md
  - extensions/pi-claude-marketplace/domain/components/hooks.ts
  - extensions/pi-claude-marketplace/domain/version.ts
  - extensions/pi-claude-marketplace/edge/args.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/persistence/migrate-config.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/session-env.ts
  - extensions/pi-claude-marketplace/shared/types.ts
autonomous: true
requirements: [PHR-01, PHR-02, PHR-03, PHR-04, PHR-05, PHR-06, PHR-07, PHR-08]

estimate:
  tokens: 130000
  raw_tokens: 130000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "UD-1: package.json engines.node and package-lock.json packages[\"\"].engines.node are both \">=22.22.2\", and commit 1 changes exactly one line in each file."
    - "UD-2: outside the historical set (.planning/milestones, .planning/quick, .planning/reviews, .planning/spikes, .planning/research, docs/competitive-analysis, the dated 0.x CHANGELOG line, third-party engines in package-lock.json), the live tree has no Node 20 mention, the PRD's NFR-4 row states 22.22.2, docs/competitive-analysis/ is unchanged, and the two comments that only explained Node 20 behavior (extension-version.ts, partial-vocabulary-guard.test.ts) no longer do."
    - "UD-3: CHANGELOG.md [Unreleased] states that Node.js 22.22.2 or later is required (#236), and records the decision-ID cleanup as an internal sub-bullet without a bare decision ID."
    - "UD-4: the Lint pre-commit job's Node 20 warning is traced to actions/cache@v4 inside pre-commit/action v3.0.1. No pre-commit/action release runs on node24, so lint.yml stays unchanged unless the execution-time check finds one. Every other action in every workflow runs on node24, and the SUMMARY records the runtime table."
    - "UD-5: the four decisions that shared one bare ID carry D-v1.0-01-11 (import direction and ledger zones), D-notification-refactor-01-11 (central presentation vocabulary), D-v1.12-51-11 (config schemaVersion), and D-v1.0-02-11 (hash byte normalization), each in the form D-<milestone archive label>-<phase>-<NN>. Each ID appears only in its mapped files and this task's directory, the bare-ID grep over the live tree returns nothing, and D-11-01 to D-11-06 are unchanged."
    - "UD-5: commit 2 changes only the ID tokens, plus whitespace and comment markers where a lengthened comment was rewrapped, and adds no new line over 100 columns."
    - "UD-6: two Conventional Commits with explicit paths, each pre-commit hook passed, no GSD label in a file or message, and `npm run check` on the final commit ends with exit=0."
  artifacts:
    - path: "package.json"
      provides: "the Node engines floor"
      contains: '"node": ">=22.22.2"'
    - path: "package-lock.json"
      provides: "the lockfile root mirrors the manifest engines"
      contains: '"node": ">=22.22.2"'
    - path: "CHANGELOG.md"
      provides: "the user-facing requirement note"
      contains: "Node.js 22.22.2 or later is now required."
    - path: "eslint.config.js"
      provides: "BLOCK C ledger zone messages cite the import-direction decision by its unique ID"
      contains: "D-v1.0-01-11: plugin ledger modules must not import each other."
    - path: "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
      provides: "the central presentation vocabulary cites its decision by its unique ID"
      contains: "D-notification-refactor-01-11"
    - path: "extensions/pi-claude-marketplace/persistence/config-io.ts"
      provides: "the schemaVersion pin cites its decision by its unique ID"
      contains: "D-v1.12-51-11"
    - path: "extensions/pi-claude-marketplace/domain/version.ts"
      provides: "the hash byte normalization cites its decision by its unique ID"
      contains: "D-v1.0-02-11"
  key_links:
    - from: "package.json engines"
      to: "package-lock.json packages[\"\"].engines"
      via: "npm mirrors the root manifest into the lockfile root, and CI runs npm ci from the lockfile"
      pattern: '">=22.22.2"'
    - from: ".planning/PROJECT.md Runtime constraint"
      to: "AGENTS.md Runtime constraint"
      via: "the AGENTS.md project block is generated from PROJECT.md, so the two bullets must read the same"
      pattern: "Node >= 22.22.2 (NFR-4)"
    - from: "eslint.config.js PLUGIN_LEDGERS doc comment and BLOCK C messages"
      to: "tests/architecture/gate-targets.ts and the .planning/codebase notes"
      via: "every citation of the import-direction rule and its ledger zones names the same ID"
      pattern: "D-v1.0-01-11"
---

# Drop Node 20 and give each bare D-11 a unique ID

<objective>
Two independent parts, user-approved and locked (UD-1 to UD-6).

Part A (Task 1): raise the declared Node floor from 20.19.0 to 22.22.2 in `package.json` and the lockfile root, remove every live mention of Node 20, record the change in the CHANGELOG, and trace the Node 20 warning on the Lint workflow's pre-commit job.

Part B (Task 2): the bare `D-11` labels four unrelated decisions. Give each decision a unique ID, replace all 59 bare uses in 42 files, and record the mapping.

Task 3 runs the final `npm run check` and the residual checks on the final commit.

Purpose: a reader can trust the declared runtime floor, and a decision ID found in a comment or lint message leads to exactly one decision.

Output: two commits, the evidence under `tmp/phr/`, and the SUMMARY with the full mapping. No tracer task: this plan edits configuration, prose, and comments, and it has no architecture to prove end to end.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@skills/local-verification/SKILL.md
@skills/typescript-comments/SKILL.md
</context>

## User decisions (locked)

UD, PHR, C, F, S, T, and T-phr labels are plan-local. Never put them in a file, a comment, or a commit message. The quick task ID `261005-phr` appears only in the summary. Durable IDs (NFR-4, NFR-5, BFILL-02, the new decision IDs) are fine.

- **UD-1. Floor.** `engines.node` becomes `">=22.22.2"` (the user's choice). Update `package-lock.json` `packages[""].engines` to match without other lock churn. Prefer `npm install --package-lock-only --ignore-scripts` and confirm the diff is only that field. If npm rewrites anything else (a memory notes a bin-path normalization), keep only the engines change.
- **UD-2. Node 20 cleanup.** Remove every mention of Node 20, 20.19.0, or `>=20` from the live tree: AGENTS.md, `.planning/PROJECT.md` (NFR-4 and current-state text; dated history stays), README.md, `docs/`, `.planning/codebase/*.md`, `skills/`, source comments, tests that assert the engines string or the floor, `ci.yml` comments, `sonar-project.properties`, tsconfig notes, and any code path or comment that exists only for Node 20 compatibility. Historical records stay as written: `.planning/milestones`, `.planning/quick`, `.planning/reviews`, `.planning/spikes`, and dated CHANGELOG entries. **Amended by the user after the first plan:** `docs/competitive-analysis/` stays as written (dated snapshots), the PRD's NFR-4 row still changes, and the leftover-mention check excludes `docs/competitive-analysis/`.
- **UD-3. CHANGELOG.** Add an entry under the unreleased section, following the file's convention.
- **UD-4. Lint Node 20 notice.** Find what emits it. If a maintained version runs on node24, pin it by full commit SHA with the version comment, as the repo does for other third-party actions. If none exists, record that and leave it. Check every workflow.
- **UD-5. Bare D-11.** Enumerate every bare `D-11` (not followed by `-<digit>`) in the live tree, trace each use to its originating decision, group the uses by decision, and give each decision a unique ID in the `D-<phase>-<NN>` convention. Verify uniqueness over the whole repository, history folders included. On a collision, use a distinguishing form consistent with the repo and state the rule. An untraceable origin gets a unique descriptive ID and an uncertainty note. Replace each bare use and keep the surrounding text. Record the mapping in this plan and in the SUMMARY. Comments cite durable IDs only. Afterwards the bare-ID grep over the live tree returns nothing. `D-11-01` to `D-11-06` are already unique and stay. **Amended by the user after the first plan:** every new ID carries the milestone archive label, not only on a collision. The rule is `D-<milestone archive label>-<phase>-<NN>`, and the IDs are `D-v1.0-01-11` (import direction and ledger zones), `D-notification-refactor-01-11` (call, never duplicate), `D-v1.12-51-11` (schemaVersion pinned to 1), and `D-v1.0-02-11` (byte normalization before hashing).
- **UD-6. Boundaries and project rules.** Out of scope: the Pi peer floor (`>=0.86.1`), the Pi 1.x upgrade, REVIEW.md, push, PR, and version bump. Conventional Commits (title 5 to 72 characters, body lines of 80 or fewer, no GSD milestone or phase reference). Before each commit run `SKIP=npm-check pre-commit run --files <changed files>` and restage until clean. Commit in the foreground, never `--no-verify`, never `--amend`, never `git add -A`. The final verification is `npm run check` as its own command, not piped.

## Requirement map

| ID | Outcome | Task |
| --- | --- | --- |
| PHR-01 | UD-1: engines and the lockfile root say `>=22.22.2`, with a one-line diff in each file | 1 |
| PHR-02 | UD-2: no live Node 20 mention outside the historical set; the two Node-20-only comments are fixed | 1, 3 |
| PHR-03 | UD-3: CHANGELOG [Unreleased] carries the floor bullet and the ID sub-bullet | 1, 2 |
| PHR-04 | UD-4: the warning's emitter and every action runtime are recorded; a pin happens only if a node24 release exists | 1 |
| PHR-05 | UD-5: every bare use is traced and grouped, and the mapping is recorded | 2 |
| PHR-06 | UD-5: each decision has a unique ID under the stated rule, verified repo-wide | 2 |
| PHR-07 | UD-5: every bare use is replaced, nothing else changes, and the bare-ID grep is empty | 2, 3 |
| PHR-08 | UD-6: both commits follow the project rules, and the final `npm run check` passes | 1, 2, 3 |

## Facts measured during planning

2026-10-05, branch `features/faster-precommit`, main checkout, HEAD `afc724a8c2c6dbccc137e2fc9ad8d96df43a967d`, `origin/main` `6fc114b4`, Node v26.10.0, npm 11.19.1, fallow 3.27.0. Untracked: REVIEW.md only. Anchor every edit on content, never on a line number. The line numbers below locate content at the planning HEAD.

**F1. Floor sources.** `package.json` declares `"node": ">=20.19.0"` (line 36). The lockfile root `packages[""].engines` (line 38) holds the only `">=20.19.0"` string in `package-lock.json`. Every other Node range in the lock belongs to a third-party package and stays. No test or script reads `engines`. `tests/architecture/peer-floor.test.ts` compares only `peerDependencies`. The floor 22.22.2 is already exercised: `.planning/PROJECT.md:519` records the suite passing on Node v22.22.2. Note for the summary only: `>=22.22.2` also admits Node 23.x, 24.0 to 24.14, and 25.x, which `write-file-atomic@8` (`^22.22.2 || ^24.15.0 || >=26.0.0`) excludes. UD-1 fixes the simple floor, so nothing changes because of this.

**F2. No Node-20-only code path.** No Node version check, no polyfill, and no `process.versions` read exists in `extensions/`, `tests/`, or `scripts/`. `--experimental-test-coverage` (package.json scripts, `scripts/test-coverage-direct.mjs`) is the flag name on every Node line, so it stays. TypeScript stripping runs without a flag from Node 22.18.

**F3. Node 20 inventory.** `git grep -niE` with the user's pattern over the live tree (case-insensitive adds nothing). Each hit and its disposition:

| Location (planning HEAD) | Disposition |
| --- | --- |
| `package.json:36` | edit to `>=22.22.2` |
| `package-lock.json:38` (`packages[""].engines`) | edit to `>=22.22.2` |
| `package-lock.json`, the other `>= 20`, `>=20`, `>=20.0.0`, and `^20.19.0 \|\| ...` lines | third-party engines; unchanged |
| `AGENTS.md:59` (Runtime constraint) | edit |
| `.planning/PROJECT.md:868` (Runtime constraint) and `:862` (Tooling baseline, an undated bullet phrased as current state) | edit both (C3) |
| `.planning/codebase/STACK.md:21` and `:85` | edit |
| `docs/prd/pi-claude-marketplace-prd.md:1038` (NFR-4 row) | edit (C1) |
| `docs/competitive-analysis/pi-plugins.md:19, 430, 515, 531, 610, 654` and `docs/competitive-analysis/zmarketplace.md:433` (the old floor in dated snapshots, baseline v0.13.0) | historical by the user's amendment of UD-2; unchanged, and Script S5 excludes the directory (C1) |
| `tests/architecture/partial-vocabulary-guard.test.ts:113` ("(Node >= 20.12)") | edit: drop the parenthetical, since the floor guarantees `entry.parentPath` |
| `extensions/pi-claude-marketplace/shared/extension-version.ts:6-8` (no grep hit; the clause justifies the literal by JSON import attributes being experimental below Node 22) | edit (C4): JSON modules are stable from Node 22.12.0 (Node 22 docs, "JSON modules are no longer experimental"), so the clause applies only below the new floor |
| `CHANGELOG.md:359` (dated 0.x entry, #8) | historical; unchanged |
| `.planning/research/STACK.md:44`, `.planning/research/FEATURES.md:283` (v1.19 research, "Researched: 2026-08-28") | historical; unchanged (C2) |
| README.md, CONTRIBUTING.md, `skills/`, `sonar-project.properties`, `tsconfig.json`, `.github/workflows/*.yml` | no Node 20 mention; unchanged. The `ci.yml` D-01 comment cites Node 24 and write-file-atomic's floor and stays true |
| `shared/completion-cache.ts:42, 208` ("keeping the Node floor at 22") | not a Node 20 mention and consistent with the new floor; unchanged |

Every `20.19.0` in `AGENTS.md` (1), `.planning/PROJECT.md` (2), `.planning/codebase/STACK.md` (2), the PRD (1), and `package.json` (1) states our floor, so a file-wide `20.19.0` to `22.22.2` replacement in exactly these files is safe. Each replacement keeps its length, so no Markdown table realigns.

**F4. The Lint Node 20 notice.** The latest Lint run (37232074832), job `pre-commit` (111523749330), carries the warning annotation "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4." The emitter is `pre-commit/action@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd` (v3.0.1), a composite action whose `action.yml` calls `actions/cache@v4` (`using: 'node20'`). v3.0.1 is the newest pre-commit/action tag. Its `main` branch still calls `actions/cache@v4`. The repository is not archived, and its last push was 2025-08-13. So no maintained version runs on node24, and `lint.yml` stays (UD-4). The other runtimes: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/setup-python@v7`, `actions/upload-artifact@v7`, and `actions/download-artifact@v8` run on node24. `SonarSource/sonarqube-scan-action@ba9859ea` (v8.2.2) runs on node24. `fallow-rs/fallow@bd8fca5a` (v3.28.0) is composite and calls `actions/cache@55cc8345` (v5, node24) and `github/codeql-action/upload-sarif@b96794f0` (v4, node24). The two local `uses: $/.github/workflows/...` references are reusable workflows, not actions. The latest `ci.yml`, `e2e-nightly.yml`, and `fallow-audit` jobs carry no Node 20 annotation. The same pre-commit job also carries an ubuntu-latest to Ubuntu 26 migration notice, which is not a Node 20 notice and is out of scope.

**F5. Bare D-11 inventory.** The bare-ID grep (Script S5) finds 59 lines in 42 files, one use per line. No `D-11-<non-digit>` form exists. The qualified `D-11-01` to `D-11-06` (for example in `docs/output-catalog.md` and `tests/architecture/catalog-uat/fixtures/plugin-install.ts`) stay. Every file holds uses of one decision only.

**F6. Origins.** The four decisions and the evidence:

- **A, import direction.** v1.0 Phase 1 (foundations-toolchain) D-11: "Strict ESLint `import-x` boundary rules (`no-restricted-paths`) enforce layering". It lives at `.planning/phases/01-foundations-toolchain/01-CONTEXT.md:31` in commit `751836d6` (2026-05-12) and was never archived into the tree. The v1.4 CONTEXT files carry it as "D-11 layering (`shared/` is the lowest layer)" under Established Patterns, which is the source of the "D-11 layering" phrase in `shared/errors.ts` and `shared/notification-summary.ts` (written 2026-05-31 and 2026-06-02, before notification-refactor). The ledger zones joined the same decision: the v1.18 phase-99 review finding WR-06 ("Bears on: D-11, D-05, D-06") added the ledger walk to `import-boundaries.test.ts` in `395904c3` (2026-08-12), and `ee970169` (2026-10-04) moved it into the BLOCK C ESLint zones. The hooks `if:` comments (`feb04658`, 2026-09-20) cite the same rule ("D-11 import direction"). In `update-row.ts:9`, the neighbors D-05 and D-06 are v1.0 Phase 4 decisions.
- **B, central presentation vocabulary.** notification-refactor Phase 1 D-11: "The shared presentation vocabulary stays central in `notify.ts` ... Command render maps *call* these helpers; they do not duplicate them." It lives at `.planning/milestones/notification-refactor-phases/01-localized-type-model-command-context-spine/01-CONTEXT.md:95`. Every B citation entered with `49325575` (2026-06-25) or later. `reinstall.messaging.ts:45` (cause-chain lines through the central seam) entered with `49325575`, so it is B, not the September refine-unit-tests Phase 3 D-11 about the rollback cause-chain contract.
- **C, config schemaVersion.** v1.12 Phase 51 D-11: "(config schemaVersion): Optional `schemaVersion` field; must equal `1` if present; omitted = 1." It lives at `.planning/milestones/v1.12-phases/51-config-schema-persistence-state-split/51-CONTEXT.md:69`. The citations entered with `5f1d0c57` (2026-06-12). In `migrate-config.ts:3` and `config-io.ts:60`, the neighbors D-04, D-05, and D-13 are Phase 51 decisions.
- **D, hash byte normalization.** v1.0 Phase 2 (domain-core-persistence-primitives) D-11: "(Hash content normalization): `computeHashVersion(pluginRoot)` normalizes each file's bytes before hashing: leading UTF-8 BOM stripped, every `\r\n` collapsed to `\n`". It lives at `.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md:38` in commit `751836d6`. The neighbor D-12 in `version.ts:3` is the same phase's walk filter list.

No use was untraceable.

**F7. Archive labels and uniqueness.** The archive labels behind the four IDs:

- `notification-refactor`: the decision's CONTEXT lives at `.planning/milestones/notification-refactor-phases/01-localized-type-model-command-context-spine/`.
- `v1.12`: phase 51 lives at `.planning/milestones/v1.12-phases/51-config-schema-persistence-state-split/`.
- `v1.0`: phases 01 and 02 were never archived into the tree. MILESTONES.md names the milestone "v1.0: successor architecture" (completed 2026-05-11). The ROADMAP at commit `751836d6` lists its Phase 1 "Foundations & Toolchain" and Phase 2 "Domain Core & Persistence Primitives", and v1.1 starts at Phase 8. Every numbered milestone archive uses the `v1.N` label (`v1.4-phases` to `v1.20-phases`), so the label is `v1.0`.

`git grep -nF` over the whole repository at the planning HEAD finds 0 hits for each of `D-v1.0-01-11`, `D-notification-refactor-01-11`, `D-v1.12-51-11`, and `D-v1.0-02-11`. No existing ID carries a milestone label, so the form is new. The plain form would have collided for both phase-01 decisions, because `D-01-11` already names v1.20 Phase 1's stat-gate decision (`.planning/milestones/v1.20-phases/01-manifest-read-fidelity/01-CONTEXT.md:93`). The letter suffix was never an option, because the repo uses it for an amendment of the base decision ("D-116-01a (operator amendment, 2026-09-02): D-116-01 admits ...").

**F8. Line lengths.** After substitution, 11 comment lines in B files pass 100 columns: `shared/notification-grammar.ts` (the `// ... the row-composition primitives below` line and the `render maps, so the bytes stay identical` line), `enable-disable.messaging.ts` (the `vocabulary stays central` line and the `partiallyInstalledRow composition site` line), `fetch.messaging.ts`, `info.messaging.ts`, `install-cascade.messaging.ts`, `install.messaging.ts`, `reinstall.messaging.ts` (two lines), and `uninstall.messaging.ts`. Two `eslint.config.js` message strings already pass 100 (230 and 161 characters) and stay single strings. No A, C, or D comment line passes 100: the longest C line becomes 87 columns (`migrate-config.ts:3`) and the longest D line 57 (`version.ts:3`). Prettier does not reflow comments, and no lint rule limits comment width, but 25 comment lines over 100 exist in all of `extensions/`, so the house style wraps at 100.

**F9. Gates.** No test or script asserts an ESLint message, the engines string, or the PRD. `docs/output-catalog.md` is a build input, and `catalog-contract.test.ts` reads only its fenced examples. The edited line is prose. `partial-vocabulary-guard.test.ts` bans no token that a new ID contains. Commit 1 stages `package.json`, and commit 2 stages `tests/architecture/gate-targets.ts` (a non-test file under `tests/`), so each hook runs `check:static`, `test:unpaired`, and every pair. The all-pair run took 43 to 52 s (quick tasks 261005-la5 and 261005-hpr), and a cold ESLint cache adds about 215 s, so each hook fits in 600 s.

**F10. CHANGELOG.** `## [Unreleased]` exists, the newest bullets are on top, and the voice is plain user-facing English. PR #236 is this branch's open pull request (`gh pr list --head features/faster-precommit`). The precedent for a requirement bump is "Pi Coding Agent 0.86.1 is now required." The first [Unreleased] bullet, "Internal: commits run quick checks on their staged files, ... (#236)", collects this branch's internal changes as sub-bullets.

## Choices within the decisions

1. **C1, docs/ edits (UD-2 as amended).** The PRD NFR-4 row changes. `docs/competitive-analysis/` stays as written: its two analyses are dated snapshots with baseline v0.13.0 and keep their old floor statements (the user's amendment; quick task 261005-n1k also left the directory as written). Script S5 therefore excludes the directory, and the SUMMARY notes that the analyses still give the old floor by decision.
2. **C2, `.planning/research/`.** These are v1.19 research records dated 2026-08-28, so they are historical by the same rule as `.planning/milestones`.
3. **C3, PROJECT.md Tooling baseline.** The bullet has no date and reads as current state, so its floor changes. Its stale `write-file-atomic@^7` is outside the scope. It stays, and the SUMMARY flags it.
4. **C4, extension-version.ts.** The literal stays, because it is zero-I/O and offline. The clause that justified it by the floor goes (Target text T3).
5. **C5, ID rule (UD-5 as amended, fixed by the user).** Every ID is `D-<milestone archive label>-<phase>-<NN>`. The label is the name of the decision's milestone as the archive directories use it (`.planning/milestones/<label>-phases/`, with `v1.N` for numbered milestones, F7). `<phase>` is the two-digit phase number of the CONTEXT file that recorded the decision, and `<NN>` is the decision's number there. The label applies to all four IDs, not only where the plain form collides, so every ID names its milestone the same way the repo already does where phase numbers repeat (the archive layout and the `[milestone]` prefix on `windows` descriptions). Result: A is `D-v1.0-01-11`, B is `D-notification-refactor-01-11`, C is `D-v1.12-51-11`, and D is `D-v1.0-02-11`.
6. **C6, rewrap.** Each comment paragraph that holds one of the 11 lines of F8 is rewrapped at 100 columns or fewer, with its marker style, its indentation, and every word in order. No other paragraph is reflowed. Script S3 proves that only whitespace and comment markers moved.
7. **C7, CHANGELOG for Part B.** One internal sub-bullet (Target text T2). It spells no bare decision ID, so the final grep stays empty.
8. **C8, two commits.** Part A is one commit and Part B is one commit. Task 3 adds a commit only if `npm run check` exposes a defect in this task's changes.
9. **C9, neighbors stay bare.** The scope is the bare `D-11`. Bare neighbors in the same comments stay: D-12 (`version.ts`), D-05 and D-06 (`update-row.ts`, `config-io.ts`, `edge/types.ts`), D-04 and D-13 (`migrate-config.ts`), and D-10 (several messaging modules). The SUMMARY lists them as follow-up candidates, together with the stale text noticed during planning (C10).
10. **C10, stale text noticed, not changed.** `domain/README.md:18` says `Scope` is "planned" for `shared/types.ts` "(Phase 2)" and points to a Phase 1 SUMMARY. `edge/args.ts:5` and `shared/types.ts:5` say edge/ must not import domain/, which D-21-02 reversed. The `ci.yml` D-01 comment narrates Phase 1 planning. AGENTS.md and PROJECT.md give the Pi dev range as `^0.86.1`, while package.json has `^0.87.1`. STACK.md gives the package version as `0.18.1`.

## Part B mapping

| Decision | Origin | New ID | Uses | Files and planning-HEAD lines |
| --- | --- | --- | --- | --- |
| A. Import direction between layers, including the BLOCK C ledger zones | v1.0 Phase 1 D-11, `751836d6:.planning/phases/01-foundations-toolchain/01-CONTEXT.md:31` | `D-v1.0-01-11` | 32 | `eslint.config.js:9, 206, 309, 315, 320, 325`; `extensions/pi-claude-marketplace/` `bridges/hooks/if-field/index.ts:35, 138`, `domain/README.md:18`, `domain/components/hooks.ts:62, 74`, `edge/args.ts:4`, `edge/completions/data.ts:126`, `edge/types.ts:9`, `orchestrators/edge-deps.ts:85`, `orchestrators/plugin-path.ts:7`, `orchestrators/plugin/install-outcome.ts:63`, `orchestrators/plugin/shared.ts:12`, `orchestrators/plugin/uninstall.ts:41`, `orchestrators/plugin/update-flow.ts:57`, `orchestrators/plugin/update-row.ts:9`, `orchestrators/plugin/update-swap.ts:57`, `shared/completion-cache.ts:5`, `shared/errors.ts:147`, `shared/notification-summary.ts:102`, `shared/session-env.ts:11`, `shared/types.ts:4`; `tests/architecture/gate-targets.ts:36`; `.planning/codebase/CONCERNS.md:46`, `CONVENTIONS.md:69`, `STRUCTURE.md:97`, `TESTING.md:185` |
| B. The shared presentation vocabulary stays central; command render maps call it and never duplicate it | notification-refactor Phase 1 D-11, `.planning/milestones/notification-refactor-phases/01-localized-type-model-command-context-spine/01-CONTEXT.md:95` | `D-notification-refactor-01-11` | 19 | `extensions/pi-claude-marketplace/` `shared/notification-grammar.ts:44, 348, 560, 612, 665`, `orchestrators/plugin/enable-disable.messaging.ts:33, 74`, `orchestrators/plugin/fetch.messaging.ts:26`, `orchestrators/plugin/info.messaging.ts:39`, `orchestrators/plugin/install-cascade.messaging.ts:30`, `orchestrators/plugin/install.messaging.ts:42`, `orchestrators/plugin/list.messaging.ts:35`, `orchestrators/plugin/reinstall.messaging.ts:40, 45`, `orchestrators/plugin/uninstall.messaging.ts:22`, `orchestrators/plugin/update.messaging.ts:25`, `orchestrators/marketplace/update.messaging.ts:89`, `orchestrators/import/execute.messaging.ts:31`; `docs/output-catalog.md:3578` |
| C. Config `schemaVersion` is optional and pinned to literal 1 | v1.12 Phase 51 D-11, `.planning/milestones/v1.12-phases/51-config-schema-persistence-state-split/51-CONTEXT.md:69` | `D-v1.12-51-11` | 6 | `extensions/pi-claude-marketplace/persistence/config-io.ts:27, 60, 61`, `persistence/config-write-back.ts:29`, `persistence/migrate-config.ts:3, 109` |
| D. File bytes are normalized (BOM strip, CRLF to LF) before hashing | v1.0 Phase 2 D-11, `751836d6:.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md:38` | `D-v1.0-02-11` | 2 | `extensions/pi-claude-marketplace/domain/version.ts:3, 73` |

## Target text

**T1. CHANGELOG.md, the first bullet under `## [Unreleased]`,** followed by one blank line and then the existing first bullet. The bullet names no older Node line on purpose: Script S5 fails on any Node 20 mention in the live tree, and the [Unreleased] section is live. Insert exactly this line:

- Node.js 22.22.2 or later is now required. Pi and the `write-file-atomic` dependency already need Node 22. (#236)

**T2. CHANGELOG.md, a new last sub-bullet of the first bullet** ("Internal: commits run quick checks on their staged files, ... (#236)"). Insert it directly after the sub-bullet that starts with "`scripts/init.sh` no longer lets Fallow rewrite", with the same two-space indent:

  - Four unrelated decisions that comments, lint messages, and codebase notes cited by one shared ID now each have their own ID.

**T3. `extensions/pi-claude-marketplace/shared/extension-version.ts`.** The second paragraph of the header (it starts with "This is a plain string literal" and ends with "so the two are bumped in lockstep.") becomes these five lines. The rest of the file does not change.

```text
// This is a plain string literal, NOT a runtime `import ... with { type:
// "json" }` of package.json. The literal read is zero-I/O and stays offline
// (NFR-5). The literal MUST equal package.json `version`; a drift-guard test
// (tests/architecture/extension-version-sync.test.ts) fails CI on any desync,
// so the two are bumped in lockstep.
```

**T4. Commit 1 message.** Title and body, then the attribution trailers that your session instructions give:

```text
build: require Node.js 22.22.2 or later

Pi and write-file-atomic 8 do not support Node 20, so the engines field
and the lockfile root now say 22.22.2. The runtime constraint, the PRD,
and the stack notes state the same floor, and two comments that only
explained Node 20 behavior are gone.
```

**T5. Commit 2 message.** Title and body, then the attribution trailers:

```text
docs: give each decision behind the shared D-11 ID its own ID

Comments, lint messages, and codebase notes used one ID for four
unrelated decisions: the import-direction rule with its ledger zones,
the central presentation vocabulary, the config schemaVersion pin, and
the byte normalization before hashing. Each decision now has its own
ID, so a search for an ID finds one decision.
```

## Scripts

Save each script under `tmp/phr/` (gitignored) with the exact content below, and run it with `bash` (or `python3`). The interactive shell is zsh, which does not split words like bash.

**S1. `tmp/phr/groups.txt`** (42 rows, one space between the ID and the path):

```text
D-v1.0-01-11 eslint.config.js
D-v1.0-01-11 extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/domain/README.md
D-v1.0-01-11 extensions/pi-claude-marketplace/domain/components/hooks.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/edge/args.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/edge/completions/data.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/edge/types.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/shared/completion-cache.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/shared/errors.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/shared/notification-summary.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/shared/session-env.ts
D-v1.0-01-11 extensions/pi-claude-marketplace/shared/types.ts
D-v1.0-01-11 tests/architecture/gate-targets.ts
D-v1.0-01-11 .planning/codebase/CONCERNS.md
D-v1.0-01-11 .planning/codebase/CONVENTIONS.md
D-v1.0-01-11 .planning/codebase/STRUCTURE.md
D-v1.0-01-11 .planning/codebase/TESTING.md
D-notification-refactor-01-11 extensions/pi-claude-marketplace/shared/notification-grammar.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
D-notification-refactor-01-11 extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
D-notification-refactor-01-11 docs/output-catalog.md
D-v1.12-51-11 extensions/pi-claude-marketplace/persistence/config-io.ts
D-v1.12-51-11 extensions/pi-claude-marketplace/persistence/config-write-back.ts
D-v1.12-51-11 extensions/pi-claude-marketplace/persistence/migrate-config.ts
D-v1.0-02-11 extensions/pi-claude-marketplace/domain/version.ts
```

**S2. `tmp/phr/sub.sh`:**

```bash
#!/usr/bin/env bash
# Replaces each bare D-11 in a mapped file with the decision ID of its row.
set -euo pipefail
while read -r id path; do
  ID="$id" perl -pi -e 's/\bD-11\b(?!-\d)/$ENV{ID}/g' "$path"
done < tmp/phr/groups.txt
```

**S3. `tmp/phr/idcheck.py`:**

```python
#!/usr/bin/env python3
"""Proves that commit 2 changed only the bare decision ID tokens.

Usage: python3 tmp/phr/idcheck.py <start-commit>

For each row of tmp/phr/groups.txt, the file at <start-commit>, with every
bare D-11 replaced by the row's ID, must equal the working-tree file after
whitespace and comment continuation markers are normalized. A rewrapped
comment passes. Any other change fails.
"""
import re
import subprocess
import sys

BARE = re.compile(r"\bD-11\b(?!-\d)")
CONTINUATION = re.compile(r"\n[ \t]*(?:\*(?!/)|//)[ \t]?")


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", CONTINUATION.sub(" ", text)).strip()


start = sys.argv[1]
problems = []
with open("tmp/phr/groups.txt", encoding="utf-8") as rows:
    for row in rows:
        new_id, path = row.split()
        old = subprocess.run(
            ["git", "show", f"{start}:{path}"], check=True, capture_output=True, text=True
        ).stdout
        with open(path, encoding="utf-8") as handle:
            current = handle.read()
        if not BARE.search(old):
            problems.append(f"{path}: no bare ID at the start commit")
        if BARE.search(current):
            problems.append(f"{path}: bare ID left")
        if norm(BARE.sub(new_id, old)) != norm(current):
            problems.append(f"{path}: changed beyond the ID")
print("\n".join(problems) if problems else "idcheck ok")
sys.exit(1 if problems else 0)
```

**S4. `tmp/phr/actions.sh`:**

```bash
#!/usr/bin/env bash
# Records the runtime of every action the workflows run, and of the actions
# that those composite actions call. Needs an authenticated gh.
set -uo pipefail
out=tmp/phr/actions-runtime.txt
yml() { gh api "repos/$1/contents/$2?ref=$3" --jq .content 2>/dev/null | base64 -d 2>/dev/null; }
row() {
  local y
  y="$(yml "$1" "$2" "$3")"
  printf '%s %s@%s using=%s uses=%s\n' "$1" "$2" "$3" \
    "$(printf '%s\n' "$y" | sed -nE "s/^[[:space:]]*using:[[:space:]]*['\"]?([a-z0-9]+).*/\1/p" | head -n 1)" \
    "$(printf '%s\n' "$y" | sed -nE 's/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*([^[:space:]]+).*/\1/p' | tr '\n' ',')"
}
grep -hoE 'uses: [^[:space:]]+' .github/workflows/*.yml | sed 's/^uses: //' | grep -vE '^[$.]/' | LC_ALL=C sort -u > tmp/phr/actions-used.txt
{
  while IFS=@ read -r repo ref; do row "$repo" action.yml "$ref"; done < tmp/phr/actions-used.txt
  row actions/cache action.yml v4
  row actions/cache action.yml 55cc8345863c7cc4c66a329aec7e433d2d1c52a9
  row github/codeql-action upload-sarif/action.yml b96794f015dfd88f77b49b1c93e0fa7110f94c63
  echo "pre-commit/action newest tags: $(gh api repos/pre-commit/action/tags --jq '[.[0:3][] | "\(.name)=\(.commit.sha)"] | join(" ")' 2>&1)"
  echo "pre-commit/action main uses: $(yml pre-commit/action action.yml main | sed -nE 's/^[[:space:]]*-?[[:space:]]*uses:[[:space:]]*([^[:space:]]+).*/\1/p' | tr '\n' ',')"
} > "$out"
cat "$out"
```

**S5. `tmp/phr/residual.sh`:**

```bash
#!/usr/bin/env bash
# Residual checks over the live tree. Always: no Node 20 mention outside the
# historical set (which includes the dated docs/competitive-analysis/
# snapshots). With --ids: no bare D-11 either, over the user's exact scope.
set -uo pipefail
LIVE=(. ':!.planning/milestones' ':!.planning/quick' ':!.planning/reviews' ':!.planning/spikes')
git grep -niE 'Node(\.js)? ?20|node ?20|20\.19|>= ?20|node20' -- "${LIVE[@]}" ':!.planning/research' ':!docs/competitive-analysis' ':!package-lock.json' > tmp/phr/node20.txt
left="$(grep -v '^CHANGELOG\.md:[0-9]*:- Lowered Node\.js engine requirement' tmp/phr/node20.txt)"
if [ -n "$left" ]; then printf 'Node 20 mention left:\n%s\n' "$left"; exit 1; fi
if [ "${1:-}" = "--ids" ] && git grep -nE '\bD-11\b([^-]|$)' -- "${LIVE[@]}"; then
  echo "bare D-11 left"
  exit 1
fi
echo "residual ok"
```

**S6. `tmp/phr/verify-1.sh`:**

```bash
#!/usr/bin/env bash
# Task 1 verify: the Node floor, the lockfile root, residual Node 20 mentions,
# the action runtime record, and the shape of commit 1.
set -euo pipefail
fail() { echo "FAILED: $1"; exit 1; }
S="$(cat tmp/phr/start-1.sha)"
C="$(cat tmp/phr/commit-1.sha)"
test "$(git rev-list --count "$S..$C")" -eq 1 || fail "one commit"
test "$(git log -1 --format=%s "$C")" = "build: require Node.js 22.22.2 or later" || fail "title"
want=".planning/PROJECT.md .planning/codebase/STACK.md AGENTS.md CHANGELOG.md docs/prd/pi-claude-marketplace-prd.md extensions/pi-claude-marketplace/shared/extension-version.ts package-lock.json package.json tests/architecture/partial-vocabulary-guard.test.ts "
if [ -f tmp/phr/lint-pinned ]; then want=".github/workflows/lint.yml $want"; fi
got="$(git diff --name-only "$S" "$C" | LC_ALL=C sort | tr '\n' ' ')"
test "$got" = "$want" || fail "changed files: $got"
node -e 'const p=require("./package.json"),l=require("./package-lock.json");process.exit(p.engines.node===">=22.22.2"&&l.packages[""].engines.node===">=22.22.2"?0:1)' || fail "engines"
test "$(git diff --numstat "$S" "$C" -- package.json package-lock.json | LC_ALL=C sort)" = "$(printf '1\t1\tpackage-lock.json\n1\t1\tpackage.json')" || fail "package diff size"
grep -qF -- '- Node.js 22.22.2 or later is now required.' CHANGELOG.md || fail "changelog bullet"
grep -qF 'Node >= 22.22.2 (NFR-4)' AGENTS.md || fail "AGENTS.md runtime"
test "$(grep -c 'Node >= 22\.22\.2' .planning/PROJECT.md)" -eq 2 || fail "PROJECT.md"
grep -qF 'Node.js `>=22.22.2` declared in' .planning/codebase/STACK.md || fail "STACK.md engines"
grep -qF 'Node `>=22.22.2` (engines floor)' .planning/codebase/STACK.md || fail "STACK.md floor"
grep -qF 'MUST work with Node >= 22.22.2.' docs/prd/pi-claude-marketplace-prd.md || fail "PRD NFR-4"
grep -qF 'zero-I/O and stays offline' extensions/pi-claude-marketplace/shared/extension-version.ts || fail "extension-version comment"
! grep -qF 'NFR-4' extensions/pi-claude-marketplace/shared/extension-version.ts || fail "extension-version still cites the floor"
grep -qF '`entry.parentPath` is the absolute directory.' tests/architecture/partial-vocabulary-guard.test.ts || fail "parentPath comment"
grep -qE '^actions/cache action\.yml@v4 using=node20' tmp/phr/actions-runtime.txt || fail "action runtime record"
bash tmp/phr/residual.sh || fail "residual Node 20 mention"
test -z "$(git status --porcelain --untracked-files=no -- $(git diff --name-only "$S" "$C"))" || fail "uncommitted edits in commit 1 paths"
echo "task 1 ok"
```

**S7. `tmp/phr/verify-2.sh`:**

```bash
#!/usr/bin/env bash
# Task 2 verify: every bare D-11 became its decision's unique ID, and nothing
# else changed.
set -euo pipefail
fail() { echo "FAILED: $1"; exit 1; }
S="$(cat tmp/phr/start-2.sha)"
C="$(cat tmp/phr/commit-2.sha)"
G=tmp/phr/groups.txt
EXCL=':!.planning/quick/261005-phr-drop-node-20-and-give-each-bare-d-11-a-u'
LIVE=(. ':!.planning/milestones' ':!.planning/quick' ':!.planning/reviews' ':!.planning/spikes')
test "$(git rev-list --count "$S..$C")" -eq 1 || fail "one commit"
test "$(git log -1 --format=%s "$C")" = "docs: give each decision behind the shared D-11 ID its own ID" || fail "title"
test "$(wc -l < "$G")" -eq 42 || fail "groups.txt rows"
start_files="$(git grep -lE '\bD-11\b([^-]|$)' "$S" -- "${LIVE[@]}" | sed "s|^$S:||" | LC_ALL=C sort)"
test "$(awk '{print $2}' "$G" | LC_ALL=C sort)" = "$start_files" || fail "the mapping does not cover the start tree"
test "$( (awk '{print $2}' "$G"; echo CHANGELOG.md) | LC_ALL=C sort)" = "$(git diff --name-only "$S" "$C" | LC_ALL=C sort)" || fail "changed files"
for row in 'D-v1.0-01-11 25 32' 'D-notification-refactor-01-11 13 19' 'D-v1.12-51-11 3 6' 'D-v1.0-02-11 1 2'; do
  read -r id nfiles nuses <<< "$row"
  test "$(awk -v id="$id" '$1 == id' "$G" | wc -l)" -eq "$nfiles" || fail "$id rows"
  test "$(git grep -lF -e "$id" -- . "$EXCL" | LC_ALL=C sort)" = "$(awk -v id="$id" '$1 == id {print $2}' "$G" | LC_ALL=C sort)" || fail "$id files"
  test "$(git grep -ohF -e "$id" -- . "$EXCL" | wc -l)" -eq "$nuses" || fail "$id uses"
done
test "$(git grep -ohE 'D-11-[0-9]+' "$S" -- . "$EXCL" | wc -l)" -eq "$(git grep -ohE 'D-11-[0-9]+' -- . "$EXCL" | wc -l)" || fail "qualified D-11-NN IDs changed"
while read -r id path; do
  case "$path" in
    *.ts | *.js)
      test "$(awk 'length > 100' "$path" | wc -l)" -le "$(git show "$S:$path" | awk 'length > 100' | wc -l)" || fail "new line over 100 columns in $path"
      ;;
  esac
done < "$G"
python3 tmp/phr/idcheck.py "$S" || fail "idcheck"
bash tmp/phr/residual.sh --ids || fail "residual"
grep -qF 'now each have their own ID' CHANGELOG.md || fail "changelog sub-bullet"
test -z "$(git status --porcelain --untracked-files=no -- $(git diff --name-only "$S" "$C"))" || fail "uncommitted edits in commit 2 paths"
echo "task 2 ok"
```

**S8. `tmp/phr/verify-3.sh`:**

```bash
#!/usr/bin/env bash
# Task 3 verify: npm run check passed on HEAD, the audit did not fail, and the
# residual checks hold on the final tree.
set -euo pipefail
fail() { echo "FAILED: $1"; exit 1; }
H="$(git rev-parse HEAD)"
git merge-base --is-ancestor "$(cat tmp/phr/commit-2.sha)" "$H" || fail "commit 2 is not in HEAD"
grep -qx "head=$H" tmp/phr/check-final.meta || fail "npm run check ran on another commit"
test "$(tail -n 1 tmp/phr/check-final.log)" = "exit=0" || fail "npm run check exit"
node -e 'const a=JSON.parse(require("fs").readFileSync("tmp/phr/audit.json","utf8"));process.exit(a.error===true||a.verdict!=="fail"?0:1)' || fail "fallow audit verdict"
bash tmp/phr/residual.sh --ids || fail "residual"
test -z "$(git status --porcelain --untracked-files=no -- $(git diff --name-only "$(cat tmp/phr/start-1.sha)" "$H"))" || fail "uncommitted edits in task paths"
echo "task 3 ok"
```

## Execution rules

- Every path is relative to the checkout root (an executor worktree or the main checkout). `CI` must be unset for every command, so the checks keep their quiet local output.
- Run every multi-command step through bash: write it to `tmp/phr/<name>.sh` and run `bash tmp/phr/<name>.sh`. Spell every path literally. In bash, a path list may come from a file (`mapfile -t P < tmp/phr/paths-N.txt`), never from an unquoted zsh variable.
- Write logs under `tmp/phr/` with the exit code as the last line, never through a pipe: `<command> > tmp/phr/<name>.log 2>&1; echo "<NAME>_EXIT=$?" >> tmp/phr/<name>.log`.
- Run long commands in the foreground with a 600000 ms timeout. If a run can outlast that, background it once and wait for the completion notification. Never poll with sleep.
- Stage explicit paths only. Never run `git add -A` or `git add .`, and never use `--amend`, `--no-verify`, or a rebase. Never stage the plan, the summary, `.planning/STATE.md`, REVIEW.md, or anything under `tmp/` or `coverage/`. The operator edits files in the main checkout concurrently, so leave every other modified file alone.
- Markdown outside `.planning/` (`docs/`, CHANGELOG.md, AGENTS.md, `extensions/**/README.md`) is formatted by mdformat: keep each paragraph and bullet on one line. `.planning/` Markdown is not formatted. Use ASCII punctuation outside `.planning/`, because the texthooks fixers rewrite smart quotes and Unicode dashes.
- Comments follow `skills/typescript-comments/SKILL.md`. This plan changes only ID tokens and two Node-20-only clauses, so no comment gains new prose.
- Commit procedure (AGENTS.md), for N = 1 and 2:
  1. Write the commit's paths to `tmp/phr/paths-N.txt`, one per line, copied from the task's `<files>`. Stage them by name with a bash script.
  2. Run `SKIP=npm-check pre-commit run --files <the same paths> > tmp/phr/precommit-N.log 2>&1; echo "PRECOMMIT_EXIT=$?" >> tmp/phr/precommit-N.log`. If a fixer changed a file, inspect the diff, restage, and rerun until the log ends `PRECOMMIT_EXIT=0`. For commit 2, rerun Script S3 after any fixer change.
  3. Write the message to `tmp/phr/commit-N.txt`: the title and body from Target text T4 or T5, then the attribution trailers that your session instructions give. Check it with `pre-commit run gitlint --hook-stage commit-msg --commit-msg-filename tmp/phr/commit-N.txt`.
  4. Confirm that `git diff --cached --name-only | LC_ALL=C sort` equals `LC_ALL=C sort tmp/phr/paths-N.txt`.
  5. Run `npx fallow audit --base origin/main --format json --quiet > tmp/phr/audit-N.json 2> tmp/phr/audit-N.err`. A `verdict` of `fail` blocks the commit until fixed. A JSON `"error": true` is not blocking.
  6. In the foreground, run `git commit -F tmp/phr/commit-N.txt > tmp/phr/commit-N.log 2>&1; echo "COMMIT_EXIT=$?" >> tmp/phr/commit-N.log`. The hook runs `npm run check:commit` with every pair (F9). If `COMMIT_EXIT` is not 0, no commit happened: read the log, fix the cause, restage, and commit again.
  7. Run `git rev-parse HEAD > tmp/phr/commit-N.sha`, and note the hook's duration for the summary.
- Do not run ESLint, tsc, or a test suite just before a commit. The hook runs them.

<!-- planner-discipline-allow: D-11 -->
<!-- planner-discipline-allow: NFR-4 -->
<!-- planner-discipline-allow: 20.19.0 -->

<tasks>

<task type="auto">
  <name>Task 1: The package declares Node 22.22.2 or later, no live text mentions Node 20, and the Lint warning is traced</name>
  <precondition>The checkout descends from the planning HEAD, is not `main`, has `CI` unset, `node_modules`, perl, and python3, has nothing staged, and has no edits in this plan's paths: `test "$(git rev-parse --abbrev-ref HEAD)" != main && git merge-base --is-ancestor afc724a8c2c6dbccc137e2fc9ad8d96df43a967d HEAD && test -z "${CI:-}" && test -x node_modules/.bin/prettier && command -v perl && command -v python3 && test -z "$(git diff --cached --name-only)" && test -z "$(git status --porcelain --untracked-files=no -- package.json package-lock.json AGENTS.md CHANGELOG.md eslint.config.js docs extensions tests .planning/PROJECT.md .planning/codebase .github)"` (run through bash).</precondition>
  <files>package.json, package-lock.json, CHANGELOG.md, AGENTS.md, .planning/PROJECT.md, .planning/codebase/STACK.md, docs/prd/pi-claude-marketplace-prd.md, extensions/pi-claude-marketplace/shared/extension-version.ts, tests/architecture/partial-vocabulary-guard.test.ts</files>
  <read_first>
    - package.json (the `engines` block) and package-lock.json lines 1 to 45
    - CHANGELOG.md lines 1 to 20
    - AGENTS.md and .planning/PROJECT.md (each Runtime constraint; PROJECT.md lines 860 to 870)
    - .planning/codebase/STACK.md lines 19 to 23 and 83 to 87
    - extensions/pi-claude-marketplace/shared/extension-version.ts (the whole file) and tests/architecture/partial-vocabulary-guard.test.ts lines 105 to 120
    - .github/workflows/lint.yml (the whole file)
    - This plan: UD-1 to UD-4, facts F1 to F4, F9, F10, choices C1 to C4, Target text T1, T3, T4, and Scripts S4 to S6
  </read_first>
  <action>
Per UD-1, UD-2, UD-3, UD-4 and choices C1 to C4.
1. Run `mkdir -p tmp/phr` and `git rev-parse HEAD > tmp/phr/start-1.sha`. Save Scripts S4, S5, and S6 under `tmp/phr/` with their exact content.
2. Floor (UD-1). In package.json, change `engines.node` to `">=22.22.2"`. Then run `npm install --package-lock-only --ignore-scripts --no-audit --no-fund > tmp/phr/npm-lock.log 2>&1; echo "NPM_EXIT=$?" >> tmp/phr/npm-lock.log`. Accept the result only if `NPM_EXIT=0` and `git diff --numstat -- package-lock.json` prints exactly one changed line in each direction, where `git diff -U0 -- package-lock.json` shows the `packages[""].engines` node value going to `">=22.22.2"`. Otherwise, save `git diff -- package-lock.json > tmp/phr/npm-lock-extra.diff`, restore the file with `git checkout -- package-lock.json`, and change that one value by hand with the Edit tool (the old value `">=20.19.0"` occurs once in the file, F1). The summary records which route ran and any discarded churn. A planning-time dry run in a scratch clone (npm 11.19.1, Node v26.10.0) took the npm route and changed exactly that line.
3. Text (UD-2 as amended, C1 to C3). In AGENTS.md, .planning/PROJECT.md, .planning/codebase/STACK.md, and docs/prd/pi-claude-marketplace-prd.md, replace every `20.19.0` with `22.22.2` (for example `perl -pi -e 's/20\.19\.0/22.22.2/g'` over exactly these four files). F3 counts the occurrences per file, and every one states our floor. Change nothing else in these files. Do not touch `docs/competitive-analysis/` (dated snapshots, the user's amendment) or the other historical files of F3.
4. Comments (UD-2, C4). Apply Target text T3 to extensions/pi-claude-marketplace/shared/extension-version.ts. In tests/architecture/partial-vocabulary-guard.test.ts, the comment above the `path.join(entry.parentPath, entry.name)` line becomes `` // `entry.parentPath` is the absolute directory. `` (the version parenthetical goes).
5. CHANGELOG (UD-3). Insert Target text T1 as the first bullet under `## [Unreleased]`.
6. Lint warning (UD-4). Run `bash tmp/phr/actions.sh`. Expected result (F4): the `actions/cache action.yml@v4` row says `using=node20`, every other row says `node24` or `composite`, the newest pre-commit/action tag is v3.0.1, and its `main` still calls `actions/cache@v4`. If that holds, leave lint.yml unchanged and record the finding. Only if a pre-commit/action tag newer than v3.0.1 exists and its `action.yml` calls only actions whose `using` is node24 (check each with the `row` function of S4): change only the `uses:` line of the "Run pre-commit" step in .github/workflows/lint.yml to `pre-commit/action@<40-character commit SHA from the tags API> # <tag>`, run `touch tmp/phr/lint-pinned`, and add the file to this commit. If `gh` fails (no network or no authentication), write the F4 runtimes into `tmp/phr/actions-runtime.txt` in the S4 row format, under a first line `PLANNING-TIME RECORD (gh unavailable at execution)`, leave lint.yml unchanged, and flag it in the summary.
7. Make commit 1 (commit procedure, N=1) with the paths of `<files>`, plus .github/workflows/lint.yml only if step 6 pinned it, and the Target text T4 message. Expect the hook to run every pair, because package.json is staged.
  </action>
  <verify>
    <automated>bash tmp/phr/verify-1.sh</automated>
  </verify>
  <done>Commit 1 changes exactly the nine paths (ten if step 6 pinned lint.yml), and `docs/competitive-analysis/` is not among them. package.json and the lockfile root say `>=22.22.2`, with one changed line each. The runtime constraint in AGENTS.md and PROJECT.md, the PROJECT.md tooling bullet, STACK.md, and the PRD NFR-4 row state 22.22.2. extension-version.ts no longer justifies the literal by the floor, and the parentPath comment has no version note. CHANGELOG [Unreleased] opens with the T1 bullet. `tmp/phr/actions-runtime.txt` records the node20 `actions/cache@v4` behind pre-commit/action v3.0.1 and the runtime of every other action. Script S5 finds no Node 20 mention outside the historical set. The hook passed.</done>
</task>

<task type="auto">
  <name>Task 2: Each decision that shared the bare ID has its own unique ID in every comment, lint message, and note</name>
  <files>eslint.config.js, tests/architecture/gate-targets.ts, docs/output-catalog.md, CHANGELOG.md, .planning/codebase/CONCERNS.md, .planning/codebase/CONVENTIONS.md, .planning/codebase/STRUCTURE.md, .planning/codebase/TESTING.md, extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts, extensions/pi-claude-marketplace/domain/README.md, extensions/pi-claude-marketplace/domain/components/hooks.ts, extensions/pi-claude-marketplace/domain/version.ts, extensions/pi-claude-marketplace/edge/args.ts, extensions/pi-claude-marketplace/edge/completions/data.ts, extensions/pi-claude-marketplace/edge/types.ts, extensions/pi-claude-marketplace/orchestrators/edge-deps.ts, extensions/pi-claude-marketplace/orchestrators/plugin-path.ts, extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts, extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts, extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts, extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts, extensions/pi-claude-marketplace/persistence/config-io.ts, extensions/pi-claude-marketplace/persistence/config-write-back.ts, extensions/pi-claude-marketplace/persistence/migrate-config.ts, extensions/pi-claude-marketplace/shared/completion-cache.ts, extensions/pi-claude-marketplace/shared/errors.ts, extensions/pi-claude-marketplace/shared/notification-grammar.ts, extensions/pi-claude-marketplace/shared/notification-summary.ts, extensions/pi-claude-marketplace/shared/session-env.ts, extensions/pi-claude-marketplace/shared/types.ts</files>
  <read_first>
    - skills/typescript-comments/SKILL.md
    - This plan: UD-5, facts F5 to F9, choices C5 to C9, the Part B mapping, Target text T2 and T5, and Scripts S1 to S3, S5, and S7
    - After step 3, each comment paragraph that holds one of the 11 lines of F8 (read the paragraph before rewrapping it)
  </read_first>
  <action>
Per UD-5 and choices C5 to C9. The mapping table and Script S1 are the authority for which ID each file gets.
1. Run `git rev-parse HEAD > tmp/phr/start-2.sha`. It must equal `tmp/phr/commit-1.sha`. Save Scripts S1, S2, S3, and S7 under `tmp/phr/` with their exact content.
2. Uniqueness (C5, F7). For each of the four new IDs, run `git grep -nF -e <ID> -- . ':!.planning/quick/261005-phr-drop-node-20-and-give-each-bare-d-11-a-u'` and confirm that it prints nothing. If any ID already appears, stop and report it. Do not invent another form.
3. Substitution. Run `bash tmp/phr/sub.sh`. Each bare use becomes its row's ID, and every `D-11-<digits>` ID stays untouched (the perl pattern skips `-` followed by a digit).
4. Rewrap (C6). For each comment line of F8 that now passes 100 columns, rewrap the comment paragraph that holds it at 100 columns or fewer. Keep the marker style (` * ` in a JSDoc block, `// ` in a line comment), the indentation, and every word in order. Do not reflow any other paragraph, and do not touch the two long `eslint.config.js` message strings beyond the ID.
5. CHANGELOG (C7). Insert Target text T2 as the last sub-bullet of the first [Unreleased] bullet.
6. Run `python3 tmp/phr/idcheck.py "$(cat tmp/phr/start-2.sha)"` (it must print `idcheck ok`) and `bash tmp/phr/residual.sh --ids` (it must print `residual ok`).
7. Make commit 2 (commit procedure, N=2) with the 43 paths of `<files>` and the Target text T5 message. Expect the hook to run every pair, because `tests/architecture/gate-targets.ts` is staged.
  </action>
  <reversibility rating="reversible">The new IDs are plain tokens in comments, lint messages, and notes, so a different naming rule is one mechanical substitution away.</reversibility>
  <verify>
    <automated>bash tmp/phr/verify-2.sh</automated>
  </verify>
  <done>Commit 2 changes the 42 mapped files and CHANGELOG.md, nothing else. The bare-ID grep over the live tree is empty. `D-v1.0-01-11` appears 32 times in its 25 files, `D-notification-refactor-01-11` 19 times in its 13 files, `D-v1.12-51-11` 6 times in its 3 files, and `D-v1.0-02-11` twice in `domain/version.ts`, and none appears anywhere else outside this task's directory. The count of `D-11-<digits>` IDs is unchanged. Script S3 shows that only ID tokens, whitespace, and comment markers changed, and no TypeScript or JavaScript file gained a line over 100 columns. The CHANGELOG carries the T2 sub-bullet. The hook passed.</done>
</task>

<task type="auto">
  <name>Task 3: The final npm run check passes on the final commit, and the residual checks hold</name>
  <files>tmp/phr/check-final.log, tmp/phr/check-final.meta, tmp/phr/audit.json (gitignored evidence; no tracked file changes unless a fix commit is needed)</files>
  <read_first>
    - skills/local-verification/SKILL.md ("Planning and GSD gates")
    - This plan: UD-6, Script S8, and the Execution rules
  </read_first>
  <action>
Per UD-6 and PHR-08.
1. Save Script S8 under `tmp/phr/`. Write `head=<git rev-parse HEAD>` and `node=<node --version>` as two lines into `tmp/phr/check-final.meta`.
2. As its own command, in the foreground with a 600000 ms timeout: `npm run check > tmp/phr/check-final.log 2>&1; echo "exit=$?" >> tmp/phr/check-final.log`. A redirect is not a pipe, so the recorded exit is the check's own. If the run can outlast the timeout, background it once and wait for the completion notification.
3. If the log does not end with `exit=0`, read the failure. A defect in this task's changes gets a fix in a new Conventional Commit made with the commit procedure, never `--amend`. After a fix, or for a failure outside this task's changes, rerun step 1 and step 2 once. Never accept a failed or timed-out run. If the failure persists and lies outside this task's changes, stop and report it with the log.
4. Run `npx fallow audit --base origin/main --format json --quiet > tmp/phr/audit.json 2> tmp/phr/audit.err; echo "AUDIT_EXIT=$?" > tmp/phr/audit.exit`.
5. Record for the summary: the command, its exit, the commit, the Node version, the duration, and the audit verdict.
  </action>
  <verify>
    <automated>bash tmp/phr/verify-3.sh</automated>
  </verify>
  <done>`npm run check` ended with `exit=0` on the final HEAD, which contains commit 2. The fallow audit verdict against origin/main is not `fail`. Script S5 reports no Node 20 mention and no bare ID in the live tree. No task path has an uncommitted edit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
| --- | --- |
| npm registry metadata -> package-lock.json | Regenerating the lockfile root could carry a resolution change in along with the engines value. |
| GitHub Actions marketplace -> CI | A third-party action reference decides what code runs in the Lint and CI jobs. |
| decision record -> code comments and lint messages | A wrong or ambiguous ID sends a maintainer to the wrong rationale. |

## STRIDE Threat Register

ASVS level 1. Blocking threshold `high`. No threat below is high.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- | --- |
| T-phr-01 | Tampering | package-lock.json | low | mitigate | Commit 1 may change exactly one line of the lockfile, the root engines value. Script S6 checks the numstat and the parsed value. Any other npm rewrite is discarded and listed in the summary. |
| T-phr-02 | Tampering | .github/workflows/lint.yml action reference | low | mitigate | At planning no maintained node24 release exists, so no action reference changes. If the execution-time check finds one, it is pinned by its full 40-character commit SHA with a `# <tag>` comment, never by a tag, and the zizmor pre-commit hook runs on the file. |
| T-phr-03 | Repudiation | decision IDs in comments, lint messages, and notes | low | mitigate | Each new ID is unique in the whole repository (Task 2 step 2, Script S7), the mapping with origins is in this plan and the summary, and Script S3 proves that no comment wording changed. |
| T-phr-04 | Tampering | ESLint BLOCK C zones | low | mitigate | Only `message` strings and comments change in eslint.config.js. Script S3 covers the file, and the commit hook lints the real tree with the unchanged zones. |
| T-phr-05 | Denial of service | Node 20 users of the published package | low | accept | User decision (UD-1). Pi and write-file-atomic 8 already exclude Node 20, and npm only warns on `engines` unless `engine-strict` is set. The CHANGELOG states the requirement. |
| T-phr-SC | Tampering | npm installs | low | accept | No package is installed, added, or upgraded. `npm install --package-lock-only --ignore-scripts` rewrites only the lockfile root, and T-phr-01 checks the result. |
</threat_model>

<verification>
All three task verify scripts print `task N ok` on the final tree. `npm run check` passed on the final commit in the executor's checkout (Task 3). A merge does not run the hook, so after the worktree merges, the orchestrator runs `npm run check` in the main checkout before the quick task finishes, or reuses this result under the local-verification skill's rule. This task pushes nothing.

Orchestrator note: `.planning/STATE.md` is in the live tree. When you record this task there, keep the uppercase bare ID out of the description and the last-activity text (for example "give each decision under the shared d-11 label a unique ID"), or the UD-5 acceptance grep fails after the bookkeeping commit.
</verification>

<success_criteria>
- package.json and the lockfile root declare `>=22.22.2`, with a one-line change each.
- No live text mentions Node 20 outside the historical set (which now includes the dated `docs/competitive-analysis/` snapshots), the PRD's NFR-4 row states 22.22.2, and no comment explains Node 20 behavior.
- CHANGELOG [Unreleased] states the new floor (#236) and carries the internal ID sub-bullet.
- The Lint warning is traced to `actions/cache@v4` inside pre-commit/action v3.0.1, and the runtime of every workflow action is recorded. lint.yml changes only if a node24 release of pre-commit/action exists, and then only by a full-SHA pin.
- The four decisions carry `D-v1.0-01-11`, `D-notification-refactor-01-11`, `D-v1.12-51-11`, and `D-v1.0-02-11`, all in the form `D-<milestone archive label>-<phase>-<NN>`. Each is unique in the repository, the bare-ID grep is empty, and nothing but the ID tokens changed.
- Two commits, each hook passed, no GSD label in any message, and the final `npm run check` ends with `exit=0`.
</success_criteria>

## Source audit

| Source | Item | Plan coverage | Status |
| --- | --- | --- | --- |
| GOAL | Drop Node 20 and give each bare D-11 a unique ID | Tasks 1 to 3 | COVERED |
| CONTEXT | UD-1: engines `>=22.22.2`; lockfile root without other churn, npm route preferred, hand edit as fallback | Task 1 step 2; F1; S6 | COVERED |
| CONTEXT | UD-2: every live Node 20 mention (AGENTS.md, PROJECT.md, README.md, docs/, codebase notes, skills/, comments, tests, ci.yml, sonar, tsconfig, Node-20-only code); historical records stay | F2, F3; C1 to C4; Task 1 steps 3 and 4; S5 | COVERED |
| CONTEXT | UD-2 amendment: `docs/competitive-analysis/` stays as written, the PRD NFR-4 row still changes, and the leftover-mention check excludes the directory | F3; C1; Task 1 step 3; S5, S6 | COVERED |
| CONTEXT | UD-3: CHANGELOG entry under [Unreleased] per convention | F10; T1, T2; Task 1 step 5, Task 2 step 5 | COVERED |
| CONTEXT | UD-4: find the emitter; pin a maintained node24 version by full SHA, or record and leave; check every workflow | F4; S4; Task 1 step 6 | COVERED |
| CONTEXT | UD-5: enumerate, trace, group, unique `D-<phase>-<NN>` IDs, repo-wide uniqueness, collision rule stated, untraceable handling, replace keeping text, mapping recorded, durable IDs, empty final grep, `D-11-01` to `D-11-06` stay | F5 to F8; C5 to C9; the Part B mapping; S1 to S3, S7; Task 2 | COVERED |
| CONTEXT | UD-5 amendment: the milestone archive label on all four IDs (`D-v1.0-01-11`, `D-notification-refactor-01-11`, `D-v1.12-51-11`, `D-v1.0-02-11`); labels confirmed; 0 hits repo-wide | F7; C5; the Part B mapping; S1, S7 | COVERED |
| CONTEXT | UD-6: out of scope (Pi peer floor, Pi 1.x, REVIEW.md, push, PR, version bump); commit rules; final `npm run check` not piped | Execution rules; Task 3 | COVERED |
| REQ | PHR-01 to PHR-08 | Requirement map | COVERED |
| RESEARCH | None: a quick task with no research phase. The user's measured facts were re-checked as F1 and F4. | - | N/A |

<output>
Create `.planning/quick/261005-phr-drop-node-20-and-give-each-bare-d-11-a-u/261005-phr-SUMMARY.md` when done. It must contain:

- What changed in each commit, with the commit SHAs, and each hook's result and duration.
- Part A: the lock update route (npm or hand edit) and any discarded churn; the F3 inventory with the final disposition of each hit; the Lint finding (the annotation text, the emitter, the absence of a node24 pre-commit/action release, or the pin if one was made) and the runtime table from `tmp/phr/actions-runtime.txt`.
- Part B: the ID rule (C5) in words; the full mapping (old use -> decision -> origin file -> new ID -> files with lines), as in the Part B mapping table; the archive-label evidence of F7; the uniqueness evidence (the Task 2 step 2 greps and the S7 counts); and the classification notes of F6 (the "D-11 layering" phrase, `reinstall.messaging.ts:45`, and the ledger zones' lineage). State that no use was untraceable.
- The final `npm run check`: command, exit, commit, Node version, and duration, plus the fallow audit verdict.
- Observations for the operator: the bare neighbor IDs left as they were (C9), the stale text noticed (C10), the `>=22.22.2` range admitting Node versions that write-file-atomic 8 excludes (F1), the dated `docs/competitive-analysis/` snapshots that still give the old floor by the user's decision (C1), the stale `write-file-atomic@^7` in the PROJECT.md tooling bullet (C3), and the STATE.md description warning.
- A `## Threat Flags` section, even when the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
</output>
