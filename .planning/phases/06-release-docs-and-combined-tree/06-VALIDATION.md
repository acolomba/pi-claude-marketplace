---
phase: "6"
slug: "release-docs-and-combined-tree"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-04"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> The source is `06-RESEARCH.md` § Validation Architecture.

`$ENV` below means
`npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/bd012ee2-49d5-5eae-bcde-ad28ca160602/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.
It is needed because the container runs as root. A Bash call caps at 10
minutes, so full gates run in the background. Never run two heavy gates at
once in one checkout.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit, architecture, integration) and cucumber-js (profiles `adapter` and `builtin`) |
| **Config file** | `package.json` scripts, `cucumber.json`, `.fallowrc.json` |
| **Quick run command** | `$ENV node --test --test-reporter=./scripts/test-reporter.mjs <test-path>`; `$ENV npx cucumber-js --profile <adapter\|builtin> <feature>[:line]` |
| **Full suite command** | `$ENV npm run check` (static, unpaired, integration, both cucumber profiles, direct coverage), plus `$ENV npm run test:modules` at the phase gate |
| **Estimated runtime** | ~2,400 seconds for `npm run check` (about 40 min, mostly the two cucumber profiles), and ~600 seconds for `test:modules` |

---

## Sampling Rate

- **After every task commit:** the task's own tests (node:test file or
  cucumber feature under each profile it applies to), plus the commit hook
  (`check:commit`: static checks, unpaired tests, direct coverage for the
  staged pairs). A catalog-doc commit also runs `$ENV npm run test:unpaired`.
- **After every plan wave:** `$ENV npm run check` on the combined tree, in the
  background. After the fallow cleanup wave, run `$ENV npm run fallow`
  first, because it is cheap.
- **Before `/gsd-verify-work`:** all of these green on one commit:
  - `$ENV npm run check` and `$ENV npm run test:modules`;
  - the D-P6-06 per-feature table under both profiles;
  - `npx fallow dupes`.
- **Max feedback latency:** 600 seconds for task-level checks (one Bash call).

---

## Per-Task Verification Map

The planner fills this table from the PLAN.md files. The checker requires
every task to have an `<automated>` verify. The plan-level commands are in
`06-RESEARCH.md` § Phase Requirements → Test Map.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 06-01 | 1 | DUAL-04 | T-06-02 | The one new step is a read-only `/claude:plugin list` (NFR-5, D-P6-18); only the frozen restart steps touch Pi settings | cucumber (adapter) + grep | `$ENV npm run test:cucumber:profile -- --profile adapter --name "moves from pi-mcp-adapter to pi's built-in mcp" features/mcp-server/implementation-switch.feature`, and the exactly-one-list-read check (see plan) | ✅ | ⬜ pending |
| 6-01-02 | 06-01 | 1 | DUAL-04 | T-06-01 | The no-implementation read fails on `d1711fd`, so the row cannot pass without the D-MB-07 marker | cucumber red proof (worktree) | `grep -q "requires pi-mcp-adapter" …/exec-06-01/dual04-red-run.log`, and the pass-count check (see plan) | ✅ | ⬜ pending |
| 6-02-01 | 06-02 | 1 | MGRT-01 | T-06-03, T-06-04 | The swap stages the grant form its arguments name; a selector names only the plugin's own server | unit + cucumber (builtin) | `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/plugin/update-swap.test.ts` | ✅; the apply scenario ❌ W0 | ⬜ pending |
| 6-02-02 | 06-02 | 1 | MGRT-01 | T-06-03 | The adapter twin keeps pi-mcp-adapter's grant, and the grants file passes under both profiles | cucumber (both profiles) | `$ENV npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature`, then `--profile builtin` | ✅ | ⬜ pending |
| 6-03-01 | 06-03 | 1 | MREC-03 | T-06-07 | One snapshot per lookup, with the usual probe counts | unit + cucumber pair | `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/edge-deps.test.ts test/orchestrators/plugin/git-source-probe.test.ts test/edge/register.test.ts test/edge/completions/data.test.ts …` (see plan) | ✅; the completion pair ❌ W0 | ⬜ pending |
| 6-03-02 | 06-03 | 1 | MREC-03 | T-06-05, T-06-06 | A cache entry is served only under the implementation that wrote it; the path stays `ScopedLocations.pluginCacheFile`, and writes stay atomic | unit | `node --test --test-reporter=./scripts/test-reporter.mjs test/shared/completion-cache.test.ts test/edge/completions/data.test.ts` | ✅ | ⬜ pending |
| 6-03-03 | 06-03 | 1 | MREC-03 | T-06-07 | Installed rows read the stored verdict for the active implementation | unit + cucumber pair | `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/edge-deps.test.ts test/orchestrators/plugin/plugin-state-classifier.test.ts test/orchestrators/plugin/list-installed-row.test.ts` | ✅; the `update --partial` pair is new in the task | ⬜ pending |
| 6-04-01 | 06-04 | 1 | BLT-01 | T-06-08 | No caller can fall back to pi-mcp-adapter's encoding by leaving the encoder out | unit + integration | `node --test --test-reporter=./scripts/test-reporter.mjs test/bridges/mcp/substitute.test.ts` | ✅ | ⬜ pending |
| 6-04-02 | 06-04 | 1 | BLT-02 | T-06-09 | The built-in description reader refuses a manifest link outside the plugin, as every reader does | architecture | `node --test --test-reporter=./scripts/test-reporter.mjs test/architecture/manifest-read-agreement.test.ts` | ✅; the reader's half ❌ W0 | ⬜ pending |
| 6-04-03 | 06-04 | 1 | BLT-01 | — | n/a (a harness file moves) | cucumber static + scenarios | `$ENV npm run check:features` | ✅ | ⬜ pending |
| 6-05-01 | 06-05 | 1 | BLT-01 | T-06-10 | The stand-in wait is bounded at 10 s and keeps its failure message | cucumber (builtin) | `$ENV npm run test:cucumber:profile -- --profile builtin --name "A new session offers the plugin's tool again" features/mcp-server/lifecycle.feature` | ✅ | ⬜ pending |
| 6-05-02 | 06-05 | 1 | BLT-01 | T-06-11 | The drafted report names no absolute path, and nothing is filed | cucumber static | `$ENV npm run check:features` | ✅ | ⬜ pending |
| 6-06-01 | 06-06 | 1 | MDOC-02 | T-06-13 | The READMEs say the user turns built-in MCP on, and never that the extension edits settings | docs lint + grep | `env -u GH_TOKEN -u GITHUB_TOKEN SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files README.md README.es.md`, and the `grep -qF` checks of the turn-on and both-loaded words in each README (see plan) | ✅ | ⬜ pending |
| 6-06-02 | 06-06 | 1 | MDOC-02 | — | n/a (docs) | docs lint + grep | the same `pre-commit run --files docs/hooks-compatibility.md`, and the check of the cut, `D-MB-13`, and at least two `D-MB-08` citations (baseline: one) (see plan) | ✅ | ⬜ pending |
| 6-06-03 | 06-06 | 1 | MDOC-02 | T-06-12 | The docs never call resolved built-in values private | docs lint + grep | the same `pre-commit run --files docs/mcp-compatibility.md` | ✅ | ⬜ pending |
| 6-07-01 | 06-07 | 1 | MDOC-02 | T-06-14 | Blocks, fixture literals, and the counter change in one commit | architecture (catalog contract) | `node --test --test-reporter=./scripts/test-reporter.mjs test/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ⬜ pending |
| 6-07-02 | 06-07 | 1 | MDOC-02 | T-06-15 | Token lists and lock counts stay, so no `--json` consumer sees a new or removed token | unpaired suite | `$ENV npm run test:unpaired` | ✅ | ⬜ pending |
| 6-07-03 | 06-07 | 1 | MDOC-02 | T-06-15 | Every closed-set entry keeps an emitter, so none is removed | architecture (locks) | `node --test --test-reporter=./scripts/test-reporter.mjs test/architecture/notify-closed-set-locks.test.ts` | ✅ | ⬜ pending |
| 6-08-01 | 06-08 | 2 | MREC-02 | T-06-16, T-06-17 | The legacy reader refuses a plugin root outside its clone root (`uncontained`) before it reads a file | unit | `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/mcp/recorded-servers.test.ts test/orchestrators/mcp/builtin-registration-step.test.ts test/orchestrators/plugin/mcp-verdict-read.test.ts …` (see plan) | ✅; the refusal cases ❌ W0 | ⬜ pending |
| 6-08-02 | 06-08 | 2 | MREC-02 | T-06-18, T-06-19 | The debug line is redacted, and fallow reports any later unused export | unit + fallow | `node --test --test-reporter=./scripts/test-reporter.mjs test/orchestrators/mcp/recorded-servers.test.ts` | ✅; the redaction case ❌ W0 | ⬜ pending |
| 6-09-01 | 06-09 | 3 | MSEL-01 | T-06-20 | No code can read "adapter not loaded" as "no MCP"; typecheck rejects the old field | grep + typecheck | `git grep -c piMcpAdapterLoaded -- extensions test features scripts` finds nothing (see plan) | ✅ | ⬜ pending |
| 6-09-02 | 06-09 | 3 | MSEL-01 | T-06-21 | The probe-count suites pass unchanged | typecheck + unit | `$ENV npm run typecheck`, then `node --test --test-reporter=./scripts/test-reporter.mjs test/index.test.ts test/edge/register.test.ts test/shared/notification-run.test.ts test/architecture/no-factory-time-probe.test.ts`; whole-tree suites stay with the wave gate and 06-12 | ✅ | ⬜ pending |
| 6-10-01 | 06-10 | 3 | MDOC-02 | — | n/a (CHANGELOG) | records check | the `node -e` CHANGELOG shape check, and the `awk` + `grep -qF` check of the turn-on words in `[Unreleased]` (see plan) | ✅ | ⬜ pending |
| 6-10-02 | 06-10 | 3 | MDOC-02 / SC4 | T-06-22, T-06-23 | Each unapplied line has one BACKLOG entry, and nothing is filed upstream | records check | the BACKLOG ID loop (see plan) | ✅ | ⬜ pending |
| 6-10-03 | 06-10 | 3 | MDOC-02 / SC4 | — | n/a (PROJECT.md) | records check | the D-MB-14 to D-MB-29 row loop (see plan) | ✅ | ⬜ pending |
| 6-11-01 | 06-11 | 3 | DUAL-01 / SC4 | T-06-24 | The stated marker count is measured from the tree | records check | the `rg -n "fallow-ignore"` count compared with CONVENTIONS.md (see plan) | ✅ | ⬜ pending |
| 6-11-02 | 06-11 | 3 | DUAL-01 / SC4 | — | n/a (codebase maps) | records check | `grep -q 'orchestrators/mcp/' .planning/codebase/STRUCTURE.md` and the module checks (see plan) | ✅ | ⬜ pending |
| 6-11-03 | 06-11 | 3 | DUAL-01 / SC4 | — | n/a (skill rules) | docs lint | `env -u GH_TOKEN -u GITHUB_TOKEN SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files .agents/skills/cucumber/rules/world-and-stand-ins.md .agents/skills/cucumber/rules/layout.md` | ✅ | ⬜ pending |
| 6-12-01 | 06-12 | 4 | DUAL-04, MDOC-02 | — | n/a (re-verification) | cucumber (both profiles) + fallow dupes + MDOC-02 check | `$ENV npm run test:cucumber:profile -- --profile adapter --name "moves from pi-mcp-adapter to pi's built-in mcp" features/mcp-server/implementation-switch.feature`; `npx fallow dupes --fail-on-issues --format human --quiet`; the `node -e` MDOC-02 statement check, which names each missing statement (see plan) | ✅ | ⬜ pending |
| 6-12-02 | 06-12 | 4 | DUAL-03 | T-06-26, T-06-29 | The required parts pass on one commit, with a fresh ESLint cache; an e2e part may be deferred to CI `e2e-tests` only for a network failure | full gate (background) | `sh …/exec-06-12/gate.sh`, then at least 7 `check exit status 0` lines and a `unit exit status 0` line in `gate.log`, and each e2e part passed or deferred as network-unavailable (see plan) | ✅ (the task writes `gate.sh`) | ⬜ pending |
| 6-12-03 | 06-12 | 4 | DUAL-03 | T-06-25, T-06-26, T-06-29 | The executor pushes nothing, reusing the gate needs an empty build-input diff, and each e2e deferral reaches the parent | records check | `grep -q 'D-CF1-16' .planning/phases/06-release-docs-and-combined-tree/06-CI-HANDOFF.md`, the section checks, and the deferral carry-over check (see plan) | ✅ | ⬜ pending |
| 6-13-01 | 06-13 | 5 | SC4 | T-06-27, T-06-28 | The root log has no token-shaped string, and it holds every source entry and High item | records check | four `node -e` and `grep` checks (see plan) | ✅ | ⬜ pending |
| 6-13-02 | 06-13 | 5 | SC4 | — | n/a (frozen record) | records check | `grep -c 'Amended by mcp-builtin Phase 6'` on 01-FROZEN.md is at least 5, plus three fact checks | ✅ | ⬜ pending |
| 6-13-03 | 06-13 | 5 | SC4, DUAL-04 | T-06-28 | Every parent-line label has a row whose evidence exists, and REQUIREMENTS.md records D-P6-18's reading of DUAL-04 | records check | two `node -e` checks, and the `grep` of the D-P6-18 note under the DUAL-04 bullet (see plan) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] A `@builtin-only` apply-convergence grant scenario in
  `features/mcp-server/agent-grants.feature`, written red first (P4-DC-60).
- [ ] A completions-per-implementation cucumber pair, with the harness
  implementation parameter (P3-DC-22, D-P6-22).
- [ ] The `readBuiltinServerDescription` half of
  `test/architecture/manifest-read-agreement.test.ts` (MANF-01).
- [ ] Unit cases for the UF-1 refusal shapes, the UF-4 redaction, and the
  update-swap cascade with `mcpImplementation: "builtin"`.
- [ ] The DUAL-04 `list` row in `features/mcp-server/implementation-switch.feature`.
  The red proof runs in a worktree at `d1711fd` (06-RESEARCH.md § 2).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The docs describe built-in support, the three markers, what the adapter adds, and the naming divergence | MDOC-02 | Prose review. The mechanical checks (pre-commit fixers, grep for the marker strings, the catalog contract) cover only its shape | Read the CHANGELOG `[Unreleased]` entry, README.md, README.es.md, and docs/hooks-compatibility.md against the D-P6-01..03 checklist |
| The CI behavioral jobs finish within their timeouts | SC3 | The parent session dispatches CI. Executors have no GitHub tools | The parent pushes the final head, dispatches `ci.yml`, reads the job durations, and applies D-CF1-16's 1.5-times rule (D-P6-25) |
| Every parent line is applied or backlogged, and the root log is merged | SC4 | Records review | Walk `06-PARENT-LINES.md`. Each line names its commit, or its BACKLOG.md entry, or a reason it no longer applies |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
