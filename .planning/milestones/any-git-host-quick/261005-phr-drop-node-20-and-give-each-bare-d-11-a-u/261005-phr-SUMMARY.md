---
phase: 261005-phr
plan: 01
subsystem: build-config, comments
tags: [node-floor, engines, decision-ids, changelog, ci-actions]
status: complete
requires: []
provides:
  - "engines.node >=22.22.2 in package.json and the lockfile root"
  - "unique IDs D-v1.0-01-11, D-notification-refactor-01-11, D-v1.12-51-11, D-v1.0-02-11"
affects: [package.json, package-lock.json, CHANGELOG.md, eslint.config.js, extensions/, .planning/codebase/]
tech-stack:
  added: []
  patterns:
    - "Decision IDs that collide across milestones take the form D-<milestone archive label>-<phase>-<NN>"
key-files:
  created: []
  modified:
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
    - "(plus the other 39 files of the Part B mapping)"
decisions:
  - "Node floor raised to >=22.22.2 (engines and lockfile root); lint.yml unchanged because no pre-commit/action release runs on node24"
  - "Bare D-11 split into D-v1.0-01-11 (import direction and ledger zones), D-notification-refactor-01-11 (central presentation vocabulary), D-v1.12-51-11 (config schemaVersion), D-v1.0-02-11 (hash byte normalization)"
metrics:
  duration: "about 22 min"
  completed: 2026-10-05
estimate:
  tokens: 130000
  tasks: 3
actuals:
  tokens: 15911
  tasks: 3
  commits: 2
plan_head_before: 7d9c8d68c254b37c68168b05f33ca48a0d76a15a
plan_head_after: d85402f5d2441c726801607217b5b54a66a2450c
---

# Phase 261005-phr Plan 01: Drop Node 20 and give each bare D-11 a unique ID Summary

The package now requires Node.js 22.22.2 or later, with a one-line change in `package.json` and one in the lockfile root. The bare `D-11` ID, which named four unrelated decisions, is replaced by four milestone-labelled IDs in all 59 places it appeared (42 files).

`actuals.tokens` is chars/4 over the realized diff (63,644 bytes of `git diff` across 51 files, 84 insertions and 81 deletions). The estimate of 130k was planning-side, and the change was mostly mechanical.

## Commits

| # | SHA | Title | Files | Hook | Hook duration |
| --- | --- | --- | --- | --- | --- |
| 1 | `5f281f38` | `build: require Node.js 22.22.2 or later` | 9 | passed, `npm run check:commit` with every pair (package.json staged) | 253 s |
| 2 | `d85402f5` | `docs: give each decision behind the shared D-11 ID its own ID` | 43 | passed, `npm run check:commit` with every pair (`tests/architecture/gate-targets.ts` staged) | 132 s |

Before each commit, `SKIP=npm-check pre-commit run --files <paths>` was clean on the first run (`PRECOMMIT_EXIT=0`, no fixer rewrites), gitlint passed on the message file, and the staged set matched the path list exactly. The pre-commit fallow audit gave `pass` before commit 1 and `warn` before commit 2 (see Observations, item 1).

## Part A: Node floor

**Lockfile route:** npm. `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` exited 0 and changed exactly one line (`packages[""].engines.node` to `">=22.22.2"`). Nothing was discarded.

**F3 inventory, final dispositions:**

| Location | Disposition |
| --- | --- |
| `package.json` engines | changed to `>=22.22.2` |
| `package-lock.json` `packages[""].engines` | changed to `>=22.22.2` (npm route) |
| `package-lock.json` third-party `>= 20` / `>=20` / `^20.19.0 \|\| ...` engines | unchanged (third-party) |
| `AGENTS.md` Runtime constraint | changed to `Node >= 22.22.2 (NFR-4)` |
| `.planning/PROJECT.md` Runtime constraint and Tooling baseline bullet | both changed to `Node >= 22.22.2` |
| `.planning/codebase/STACK.md` engines line and Development floor line | both changed |
| `docs/prd/pi-claude-marketplace-prd.md` NFR-4 row | changed to `MUST work with Node >= 22.22.2.` (same length, so the table did not realign) |
| `docs/competitive-analysis/*.md` (7 lines) | unchanged: dated snapshots, by the user's amendment |
| `tests/architecture/partial-vocabulary-guard.test.ts` parentPath comment | `(Node >= 20.12)` removed |
| `extensions/pi-claude-marketplace/shared/extension-version.ts` header | the clause that justified the literal by import-attributes JSON being experimental below Node 22 (and the NFR-4 reference) is removed. Target text T3 applied |
| `CHANGELOG.md` dated 0.x entry (#8) | unchanged (historical) |
| `.planning/research/STACK.md`, `.planning/research/FEATURES.md` | unchanged (historical research) |
| README.md, CONTRIBUTING.md, `skills/`, `sonar-project.properties`, `tsconfig.json`, `.github/workflows/*.yml` | no mention; unchanged |
| `shared/completion-cache.ts` "keeping the Node floor at 22" | unchanged (consistent with the new floor) |

`CHANGELOG.md` `[Unreleased]` now opens with: "Node.js 22.22.2 or later is now required. Pi and the `write-file-atomic` dependency already need Node 22. (#236)". Script S5 reports no live Node 20 mention outside the historical set.

**Lint Node 20 notice:** the annotation reads "Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/cache@v4." It comes from `pre-commit/action@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd` (v3.0.1). That composite action calls `actions/cache@v4`, which declares `using: node20`. v3.0.1 is still the newest tag, and `main` still calls `actions/cache@v4`. No maintained release runs on node24, so `lint.yml` is unchanged.

Runtime table (`tmp/phr/actions-runtime.txt`, measured at execution with `gh`):

```text
SonarSource/sonarqube-scan-action action.yml@ba9859eae8dd6bd29e412f25ddbbef3d032000f4 using=node24 uses=
actions/checkout action.yml@v7 using=node24 uses=
actions/download-artifact action.yml@v8 using=node24 uses=
actions/setup-node action.yml@v7 using=node24 uses=
actions/setup-python action.yml@v7 using=node24 uses=
actions/upload-artifact action.yml@v7 using=node24 uses=
fallow-rs/fallow action.yml@bd8fca5af5df4ccfd94c7a835d17bd93c31a7cef using=composite uses=actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9,github/codeql-action/upload-sarif@b96794f015dfd88f77b49b1c93e0fa7110f94c63,
pre-commit/action action.yml@2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd using=composite uses=actions/cache@v4,
actions/cache action.yml@v4 using=node20 uses=
actions/cache action.yml@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 using=node24 uses=
github/codeql-action upload-sarif/action.yml@b96794f015dfd88f77b49b1c93e0fa7110f94c63 using=node24 uses=
pre-commit/action newest tags: v3.0.1=2c7b3805fd2a0fd8c1884dcaebf91fc102a13ecd v3.0.0=646c83fcd040023954eafda54b4db0192ce70507 v2.0.3=9b88afc9cd57fd75b655d5c71bd38146d07135fe
pre-commit/action main uses: actions/cache@v4,
```

## Part B: unique decision IDs

**ID rule (C5):** every new ID is `D-<milestone archive label>-<phase>-<NN>`. The label is the milestone name as the archive directories use it (`.planning/milestones/<label>-phases/`, with `v1.N` for numbered milestones). `<phase>` is the two-digit phase number of the CONTEXT file that recorded the decision, and `<NN>` is the decision's number there. All four IDs carry the label, not only the two that would collide.

**Mapping:**

| Old use | Decision | Origin | New ID | Uses | Files |
| --- | --- | --- | --- | --- | --- |
| bare D-11 | Import direction between layers, including the BLOCK C ledger zones | v1.0 Phase 1, `751836d6:.planning/phases/01-foundations-toolchain/01-CONTEXT.md:31` | `D-v1.0-01-11` | 32 | `eslint.config.js` (6); `bridges/hooks/if-field/index.ts` (2), `domain/README.md`, `domain/components/hooks.ts` (2), `edge/args.ts`, `edge/completions/data.ts`, `edge/types.ts`, `orchestrators/edge-deps.ts`, `orchestrators/plugin-path.ts`, `orchestrators/plugin/{install-outcome,shared,uninstall,update-flow,update-row,update-swap}.ts`, `shared/{completion-cache,errors,notification-summary,session-env,types}.ts`; `tests/architecture/gate-targets.ts`; `.planning/codebase/{CONCERNS,CONVENTIONS,STRUCTURE,TESTING}.md` (25 files) |
| bare D-11 | The shared presentation vocabulary stays central, and command render maps call it and never duplicate it | notification-refactor Phase 1, `.planning/milestones/notification-refactor-phases/01-localized-type-model-command-context-spine/01-CONTEXT.md:95` | `D-notification-refactor-01-11` | 19 | `shared/notification-grammar.ts` (5), `orchestrators/plugin/{enable-disable (2), fetch, info, install-cascade, install, list, reinstall (2), uninstall, update}.messaging.ts`, `orchestrators/marketplace/update.messaging.ts`, `orchestrators/import/execute.messaging.ts`, `docs/output-catalog.md` (13 files) |
| bare D-11 | Config `schemaVersion` is optional and pinned to literal 1 | v1.12 Phase 51, `.planning/milestones/v1.12-phases/51-config-schema-persistence-state-split/51-CONTEXT.md:69` | `D-v1.12-51-11` | 6 | `persistence/config-io.ts` (3), `persistence/config-write-back.ts`, `persistence/migrate-config.ts` (2) (3 files) |
| bare D-11 | File bytes are normalized (BOM strip, CRLF to LF) before hashing | v1.0 Phase 2, `751836d6:.planning/phases/02-domain-core-persistence-primitives/02-CONTEXT.md:38` | `D-v1.0-02-11` | 2 | `domain/version.ts` (2) |

The plan's Part B mapping table has the per-line positions at the planning HEAD. No use was untraceable.

**Archive-label evidence (F7):** `notification-refactor` and `v1.12` are the archive directory names of the two archived phases. v1.0 phases 01 and 02 were never archived into the tree. MILESTONES.md names the milestone "v1.0: successor architecture", and the ROADMAP at `751836d6` lists Phase 1 "Foundations & Toolchain" and Phase 2 "Domain Core & Persistence Primitives". The plain form would have collided for both phase-01 decisions, because `D-01-11` already names v1.20 Phase 1's stat-gate decision.

**Uniqueness evidence:** before the substitution, `git grep -nF -e <ID> -- . ':!<this task dir>'` found 0 hits for each of the four IDs (`tmp/phr/uniq.log`). After commit 2, Script S7 confirmed 32 uses in 25 files, 19 in 13, 6 in 3, and 2 in 1. Each ID appears only in its mapped files. The count of `D-11-<digits>` IDs is unchanged, so D-11-01 to D-11-06 stay as they were. Script S3 (`idcheck ok`) proved that only ID tokens, whitespace, and comment markers changed. No `.ts`/`.js` file gained a line over 100 columns. I rewrapped the 11 lines that F8 predicted would pass 100 columns, each locally within its own paragraph.

**Classification notes (F6):** the "D-11 layering" phrase in `shared/errors.ts` and `shared/notification-summary.ts` comes from the v1.4 CONTEXT files, which carried the v1.0 Phase 1 decision under Established Patterns. Those files predate notification-refactor, so the phrase maps to decision A. `reinstall.messaging.ts:45` (cause-chain lines through the central seam) entered with `49325575`. It is decision B, not the later refine-unit-tests Phase 3 decision about the rollback cause-chain contract. The ledger zones belong to decision A. Review finding WR-06 ("Bears on: D-11, D-05, D-06") added the ledger walk in `395904c3`, and `ee970169` moved it into the BLOCK C ESLint zones.

The CHANGELOG first `[Unreleased]` bullet gained the sub-bullet "Four unrelated decisions that comments, lint messages, and codebase notes cited by one shared ID now each have their own ID."

## Final verification

- Command: `npm run check > tmp/phr/check-final.log 2>&1; echo "exit=$?" >> tmp/phr/check-final.log` (not piped, `CI` unset)
- Exit: `exit=0`
- Commit: `d85402f5d2441c726801607217b5b54a66a2450c` (executor worktree)
- Node: v26.10.0
- Duration: 71 s
- Steps: typecheck, lint, lint:workflows, fallow, format:check, and test:corresponding passed. test:unpaired, test:integration, and direct coverage for all pairs passed (`Merged LCOV: coverage/direct.lcov (258 records)`).
- Fallow audit vs `origin/main`: verdict `warn` (AUDIT_EXIT=0). It reports no dead-code or complexity findings, and 1 duplication group introduced, 23 inherited. See Observations, item 1.
- `verify-1.sh`, `verify-2.sh`, and `verify-3.sh` all print `task N ok` on the final tree.

A merge does not run the hook. After the worktree merges, the orchestrator runs `npm run check` in the main checkout, or reuses this result under the local-verification rule.

## Deviations from Plan

None. The plan executed as written. The two checkpoints behaved as the plan predicted: the lockfile took the npm route, and no node24 pre-commit/action release exists, so `lint.yml` is unchanged.

## Observations for the operator

1. **The CI fallow-audit job will likely fail on PR #236.** The final `fallow audit --base origin/main` verdict is `warn`, not `pass`. It reports one "introduced" clone group: `orchestrators/marketplace/update.messaging.ts:86` against `orchestrators/plugin/enable-disable.messaging.ts:88`. The clone is pre-existing code (`probe, ), ]), "partially-installed": ... skipped: ... failed: ...`). Fallow does not tokenize comments, so the clone matches across a comment block. That comment block's ID line changed in commit 2, so fallow attributes the clone to this change. The code tokens are byte-identical before and after (idcheck). The audit before commit 2 was `pass`. The lint.yml `fallow-audit` job fails on `warn`, so PR #236 will likely show that job red. Fixing this needs your decision: dedupe the two render-map arms, add a `duplicates.ignoredClones` entry with a justification, or accept the red job. I did not change it, because it is outside the plan.
2. **CHANGELOG shape vs `.claude/rules/changelog.md`.** The rule says one top-level bullet per PR. Target text T1 adds a second top-level bullet for #236, next to the existing "Internal: ... (#236)" bullet. I followed the plan's locked text. Merging the two at release time is still possible.
3. **Bare neighbor IDs left as they were (C9):** D-12 (`version.ts`), D-05 and D-06 (`update-row.ts`, `config-io.ts`, `edge/types.ts`), D-04 and D-13 (`migrate-config.ts`), and D-10 (several messaging modules). Each is a follow-up candidate for the same milestone-labelled form.
4. **Stale text noticed, not changed (C10):** `domain/README.md` says `Scope` is "planned" for `shared/types.ts` "(Phase 2)" and points to a Phase 1 SUMMARY. `edge/args.ts` and `shared/types.ts` say edge/ must not import domain/, which D-21-02 reversed. The `ci.yml` D-01 comment narrates Phase 1 planning. AGENTS.md and PROJECT.md give the Pi dev range as `^0.86.1`, while package.json has `^0.87.1`. The planner's note that STACK.md gives the package version as `0.18.1` is already out of date: the current file says `0.19.2`.
5. **The `>=22.22.2` range** also admits Node 23.x, 24.0 to 24.14, and 25.x, which `write-file-atomic@8` (`^22.22.2 || ^24.15.0 || >=26.0.0`) excludes. The simple floor was your choice (UD-1).
6. **`docs/competitive-analysis/`** still gives the old Node floor in its dated v0.13.0 snapshots, by your decision.
7. **PROJECT.md Tooling baseline** still says `write-file-atomic@^7` (the dependency is `^8`). This is outside the scope, so it is unchanged.
8. **STATE.md wording:** `.planning/STATE.md` is in the live tree. When you record this task there, keep the uppercase bare ID out of the description and last-activity text (for example "give each decision under the shared d-11 label a unique ID"). Otherwise the bare-ID acceptance grep (`tmp/phr/residual.sh --ids`) fails after the bookkeeping commit. I made no STATE.md or ROADMAP.md update. The orchestrator owns the docs commit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: `5f281f38` and `d85402f5` are ancestors of HEAD (`git rev-list --count 7d9c8d68..HEAD` = 2)
- FOUND: all 51 modified paths are committed with no uncommitted edits (verify-3)
- FOUND: `tmp/phr/check-final.log` ends `exit=0` for `head=d85402f5d2441c726801607217b5b54a66a2450c`
