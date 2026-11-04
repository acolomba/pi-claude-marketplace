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
| 6-NN-NN | NN | N | DUAL-04 / MDOC-02 / parent line | T-06-NN / — | see plan | see plan | see plan | ✅ / ❌ W0 | ⬜ pending |

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
