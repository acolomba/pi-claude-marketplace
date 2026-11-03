---
phase: "1"
slug: "harness-and-version-raise"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-01"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration, e2e) and `@cucumber/cucumber` 13.3.0 (behavioral) |
| **Config file** | `cucumber.json` (`parallel: 8`, `order: random`); `package.json` scripts; `.fallowrc.json`; `rule-packs/architecture.json` |
| **Quick run command** | `node --test <test-path>`; `npm run test:coverage:direct -- <source-or-test>`; `npx cucumber-js features/<kind>` or `npm run test:cucumber -- features/<kind>` (installs the companions first) |
| **Full suite command** | `npm run check` (check:static, test:unpaired, test:integration, test:cucumber, test:coverage:direct:all) |
| **Estimated runtime** | ~600 seconds for `npm run check` on 4 cores; under 60 seconds for one owner test or one kind's features |

---

## Sampling Rate

- **After every task commit:** the commit hook (`npm run check:commit`) plus the task's `<automated>` command (owner test, direct coverage for the pair, or `npx cucumber-js features/<kind>`).
- **After every plan wave:** `npm run check` on the combined tree (the GSD post-merge wave gate).
- **Before `/gsd-verify-work`:** `npm run check` green, `npm run test:e2e` once against the 1.4.0 floor fixture, and `npm run test:cucumber` twice in random order (plan 01-09).
- **Max feedback latency:** 60 seconds per task command; the wave gate is the long run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | VER-01, VER-02, VER-03 | T-01-SC, T-01-02 | package legitimacy re-checked before install; companions never in the lockfile | architecture | `node --test test/architecture/peer-floor.test.ts test/bridges/mcp/adapter-entry.test.ts` | ✅ | ✅ green |
| 1-01-02 | 01 | 1 | VER-04 | T-01-01, T-01-03 | no environment value leaks through a literal under adapter 7.x | integration + unit | `node --test test/integration/adapter-expansion-conformance.test.ts` | ✅ | ✅ green |
| 1-01-03 | 01 | 1 | VER-05, VER-03 | T-01-02 | carried user keys survive re-stage | unit + integration + cucumber | `npm run test:integration && npm run test:cucumber` | ✅ | ✅ green |
| 1-02-01 | 02 | 1 | HAR-08 | T-01-07 | N/A | static | `npm run check:features` | ✅ | ✅ green |
| 1-02-02 | 02 | 1 | HAR-08 | — | N/A | doc lint | `pre-commit run --files .agents/skills/cucumber/rules/world-and-stand-ins.md` | ✅ | ✅ green |
| 1-02-03 | 02 | 1 | DEC-01, DEC-02 | T-01-06 | autonomous decisions name their DUBIOUS-CHOICES entry | doc grep | `grep -o 'D-CF1-[0-9][0-9] (component-features' .planning/PROJECT.md \| sort -u \| wc -l` (17) | ✅ | ✅ green |
| 1-03-01 | 03 | 2 | HAR-01, HAR-02, HAR-03, HAR-07 | T-01-11, T-01-14, T-01-15 | allowlist environment plus typed TMPDIR only; no fallback reply | architecture + cucumber | `node --test test/architecture/hermetic-git-environment.test.ts && npx cucumber-js features/skill` | ✅ | ✅ green |
| 1-03-02 | 03 | 2 | HAR-01 | — | companions resolved only from the verified peer cache at the declared floor | cucumber | `npm run test:cucumber -- features/skill` | ✅ | ✅ green |
| 1-03-03 | 03 | 2 | HAR-05, HAR-02 | T-01-12, T-01-13 | no process outlives its scenario; unused steps and uncompared turns fail | cucumber (x2) | `npm run test:cucumber && npm run test:cucumber` | ✅ | ✅ green |
| 1-04-01 | 04 | 3 | HAR-01, HAR-04, HAR-07 | T-01-30 | whole-set listing comparison | cucumber | `npx cucumber-js features/slash-command` | ✅ | ✅ green |
| 1-04-02 | 04 | 3 | HAR-04 | T-01-29 | N/A | cucumber (x2) | `npm run test:cucumber && npm run test:cucumber` | ✅ | ✅ green |
| 1-05-01 | 05 | 3 | HAR-04, HAR-07 | T-01-31 | recorder captures only `CLAUDE_*` variables | cucumber | `npx cucumber-js features/hook` | ✅ | ✅ green |
| 1-05-02 | 05 | 3 | HAR-04 | T-01-32 | N/A | cucumber | `npm run test:cucumber` | ✅ | ✅ green |
| 1-06-01 | 06 | 3 | HAR-04, HAR-07 | T-01-33 | stub exits on stdin close; orphan found by pid | cucumber | `npm run test:cucumber -- features/mcp-server` | ✅ | ✅ green |
| 1-06-02 | 06 | 3 | HAR-06 | T-01-35 | project-server approval is opt-in and removed by the release | cucumber | `npm run test:cucumber -- features/mcp-server` | ✅ | ✅ green |
| 1-07-01 | 07 | 3 | HAR-07 | T-01-37 | foreground child only | cucumber | `npm run test:cucumber -- features/agent/invocation.feature` | ✅ | ✅ green |
| 1-07-02 | 07 | 3 | HAR-06 | T-01-36 | untrusted scenario cannot pass as trusted | cucumber | `npm run test:cucumber -- features/agent` | ✅ | ✅ green |
| 1-08-01 | 08 | 3 | HAR-07 | T-01-38 | run awaited on its terminal record | cucumber | `npm run test:cucumber -- features/workflow` | ✅ | ✅ green |
| 1-08-02 | 08 | 3 | HAR-07 | — | N/A | cucumber + layout | `npm run test:cucumber && npm run check:features` | ✅ | ✅ green |
| 1-09-01 | 09 | 4 | CI-01 | T-01-40, T-01-41, T-01-42 | matrix values reach `run:` only through `env:` | workflow lint | `pre-commit run --files .github/workflows/ci.yml && npm run lint:workflows` | ✅ | ✅ green |
| 1-09-02 | 09 | 4 | HAR-08, DEC-01, DEC-02 | — | N/A | doc lint + static | `pre-commit run --files CHANGELOG.md .planning/PROJECT.md && npm run check:features` | ✅ | ✅ green |
| 1-09-03 | 09 | 4 | CI-01, VER-03, HAR-05 | — | full gate | full suite + e2e | `npm run check && npm run test:e2e` | ✅ | ✅ green |
| 1-10-01 | 10 | 1 | DEC-01 (D-CF1-01, D-CF1-02) | T-01-08, T-01-10 | handler registered after the hooks bridge and the skill aliases | unit + fallow | `node --test test/edge/command-invocation.test.ts test/index.test.ts && npx fallow dead-code --fail-on-issues` | ✅ | ✅ green |
| 1-10-02 | 10 | 1 | DEC-01 (D-CF1-04, D-CF1-05) | T-01-09 | N/A | unit (100% direct) | `node --test test/domain/description-fallback.test.ts test/domain/invocation-frontmatter.test.ts` | ✅ | ✅ green |
| 1-11-01 | 11 | 2 | DEC-01 (D-CF1-06) | T-01-16 | declared paths still pass containment | unit + cucumber | `node --test test/domain/component-paths.test.ts && npx cucumber-js features/plugin/component-directories.feature` | ✅ | ✅ green |
| 1-11-02 | 11 | 2 | DEC-01 (D-CF1-06) | T-01-17 | a folder left unread is always reported | unit + cucumber | `node --test test/orchestrators/plugin/install-outcome.test.ts test/orchestrators/plugin/update-swap.test.ts && npx cucumber-js features/plugin/staging-warnings.feature` | ✅ | ✅ green |
| 1-11-03 | 11 | 2 | DEC-01 (D-CF1-06) | — | N/A | unit + doc lint | `node --test test/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| 1-12-01 | 12 | 2 | DEC-01 (D-CF1-01, D-CF1-03) | — | N/A | unit (100% direct) | `node --test test/domain/shell-words.test.ts test/domain/argument-substitution.test.ts` | ✅ | ✅ green |
| 1-12-02 | 12 | 2 | DEC-01 (D-CF1-01) | — | quoting and escapes match upstream | unit (golden table) | `node --test test/domain/shell-words.test.ts` | ✅ | ✅ green |
| 1-12-03 | 12 | 2 | DEC-01 (D-CF1-01) | T-01-18, T-01-19, T-01-20 | arguments cannot form `!` patterns; no re-substitution; size cap | unit (100% direct) | `node --test test/domain/argument-substitution.test.ts` | ✅ | ✅ green |
| 1-13-01 | 13 | 2 | DEC-01 (D-CF1-02) | T-01-25 | exactly five sanctioned spawn sites | unit + architecture + fallow | `node --test test/architecture/no-shell-out.test.ts && npm run fallow` | ✅ | ✅ green |
| 1-13-02 | 13 | 2 | DEC-01 (D-CF1-02) | T-01-24 | failure is a typed error, never stdout | unit (100% direct) | `node --test test/domain/context-injection.test.ts` | ✅ | ✅ green |
| 1-13-03 | 13 | 2 | DEC-01 (D-CF1-02) | T-01-21, T-01-23 | process group stopped on timeout and abort | unit (fake timers) | `node --test test/platform/prompt-shell.test.ts` | ✅ | ✅ green |
| 1-14-01 | 14 | 2 | VER-04, VER-05 (D-CF1-13) | — | precondition proven before delegation | integration | `node --test test/integration/adapter-expansion-conformance.test.ts` | ✅ | ✅ green |
| 1-14-02 | 14 | 2 | VER-05 | T-01-26, T-01-27, T-01-28 | marker-bearing and deny-listed defaults never delegated | unit + integration | `npm run test:integration` | ✅ | ✅ green |
| 1-14-03 | 14 | 2 | VER-05 | — | N/A | doc lint | `pre-commit run --files docs/mcp-compatibility.md docs/env-vars.md` | ✅ | ✅ green |
| 1-15-01 | 15 | 1 | VER-01, VER-03 | T-01-04, T-01-SC | fixture installed with `--ignore-scripts` | e2e | `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts && PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts` | ✅ | ✅ green |
| 1-15-02 | 15 | 1 | VER-01 (Pi types for D-CF1-01, D-CF1-10..12) | — | NFR-11 chokepoint kept | unit (type proofs) | `node --test test/platform/pi-api.test.ts && npm run typecheck` | ✅ | ✅ green |
| 1-15-03 | 15 | 1 | VER-06 | T-01-05 | N/A | doc grep + lint | `grep -c '1\.4\.0 or newer' README.md` and `pre-commit run --files README.md README.es.md CHANGELOG.md` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Every new test module is created by the task that needs it (no separate Wave 0 scaffold). The new owners are:

- [x] `test/edge/command-invocation.test.ts`, `test/domain/description-fallback.test.ts`, `test/domain/invocation-frontmatter.test.ts` (plan 01-10, wave 1)
- [x] `test/domain/shell-words.test.ts` (research golden table), `test/domain/argument-substitution.test.ts` (plan 01-12, wave 2)
- [x] `test/domain/context-injection.test.ts`, `test/platform/prompt-shell.test.ts` (plan 01-13, wave 2; injected fake spawn, no live pwsh)
- [x] `features/skill/invocation.feature` and the scripted model, turn records, companions, and profile world (plan 01-03, wave 2)
- [x] the five wave-3 seeds: `features/{slash-command/listing,hook/tool-use,mcp-server/invocation,agent/invocation,agent/project-trust,workflow/run}.feature`
- [x] `features/plugin/component-directories.feature` (plan 01-11, wave 2)
- Framework install: none (all present; `@earendil-works/pi-ai` 1.4.0 arrives with plan 01-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI shard wall time on GitHub runners | CI-01 | needs the branch on `origin` and a dispatched run; the executor does not push | Plan 01-09 Task 1 step 2: dispatch `ci.yml` through `gh api` when the head is on `origin`, else record local x2 as estimated; the parent re-measures after each component merge |
| `shell: powershell` with a real PowerShell | DEC-01 (D-CF1-02) | `pwsh` is not installed on the build machine | Unit cases inject the spawner; a Windows or pwsh run is a parent follow-up if a component phase ships a PowerShell scenario |
| Live adapter canary at 7.0.0 | VER-03 | `test/live-uat/mcp-adapter-canary.mjs` is operator-run, outside the gate | Run per `test/live-uat/README.md` with pi-mcp-adapter 7.0.0; record the observed result |
| Package legitimacy of six new versions | VER-01, VER-02 | the protocol's blocking human checkpoint is replaced in this unattended run | Plan 01-01 Task 1 records the `npm view` evidence; DUBIOUS-CHOICES DC-13 item 7 lists it for the user's review |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 60s (the wave gate runs `npm run check`, about 10 minutes, by design)
- [x] `nyquist_compliant: true` set in frontmatter (set by validate-phase)

**Approval:** approved 2026-11-01 (validate-phase audit: every task has a green automated command; the latency box stays open because the wave gate is a ~10-minute `npm run check` by design)

## Validation Audit 2026-11-01

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
