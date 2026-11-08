---
phase: "1"
slug: "foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-07"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` (profiles `adapter` and `builtin`, `parallel: 8`) and `node:test` (`test/architecture/**`) |
| **Config file** | `cucumber.json`; the harness tests run directly with `node --test` |
| **Quick run command** | `npx cucumber-js <feature file>` after `node scripts/install-test-peers.mjs` once (or `npm run test:cucumber:profile -- --profile <adapter or builtin> <feature files>`, which installs the peers first) |
| **Full suite command** | `npm run check` (static checks with `check:features` and fallow, unpaired and integration tests, both cucumber profiles, direct coverage); the phase gate adds `npm run test:modules` |
| **Estimated runtime** | quick: about 30-120 seconds per feature file; full: about 20 minutes locally |

---

## Sampling Rate

- **After every task commit:** Run the task's own cucumber command (its seed plus the regression features it names) and `npm run check:features`; the commit hook runs `npm run check:commit`.
- **After every plan wave:** Run `npm run check` (the orchestrator's post-wave gate).
- **Before `/gsd-verify-work`:** `npm run check` and `npm run test:modules` green at the Phase 1 head (plan 01-08 Task 3).
- **Max feedback latency:** 120 seconds for a task's quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FND-01, FND-02 | T-1-01, T-1-02 | layout.md reserves every stream file; the roadmap pushes nothing (D-BG-16) | doc gate | `grep -q "^## Behavioral gaps" .agents/skills/cucumber/rules/layout.md` (and the D-BG-04 and D-BG-16 greps of the task); `SKIP=npm-check pre-commit run --files .agents/skills/cucumber/rules/layout.md` | ✅ (existing files edited) | ⬜ pending |
| 1-01-02 | 01 | 1 | FND-02 | — | the logs hold no entry written by a subagent | doc gate | `test -f .planning/DUBIOUS-CHOICES.md && test -f .planning/phases/01-foundation/DUBIOUS-CHOICES.md` | created by the task | ⬜ pending |
| 1-02-01 | 02 | 1 | FND-01 | T-1-03 | the shell's child marker never reaches Pi | cucumber seed + unit | `node --test test/architecture/hermetic-git-environment.test.ts`; `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature features/plugin/autoapply.feature` | seed created by the task | ⬜ pending |
| 1-02-02 | 02 | 1 | FND-01 | T-1-03, T-1-04, T-1-05 | no Pi without the base override starts without the redirect; crash kills only Pi | typecheck + lint + unit + regression | `npm run typecheck`; `npm run lint`; `node --test test/architecture/hermetic-git-environment.test.ts`; `npm run test:cucumber:profile -- --profile adapter features/hook/session.feature features/mcp-server/implementation-switch.feature features/marketplace/background-update.feature features/marketplace/github-source.feature features/plugin/subagent-child.feature` | ✅ | ⬜ pending |
| 1-02-03 | 02 | 1 | FND-01 | T-1-06 | the stale lock lives in the sandbox only | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/marketplace/state-lock.feature` | seed added by the task | ⬜ pending |
| 1-03-01 | 03 | 1 | FND-01 | T-1-07 | N/A | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/hook/stop-failure.feature features/hook/session.feature features/skill/aliases.feature` | seed created by the task | ⬜ pending |
| 1-03-02 | 03 | 1 | FND-01 | T-1-07 | the usage carrier never crosses calls | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature features/hook/session.feature features/hook/stop-failure.feature` | seed created by the task | ⬜ pending |
| 1-03-03 | 03 | 1 | FND-01 | T-1-08 | no upstream wording pinned | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/plugin/model-tools.feature features/hook/tool-use.feature features/agent/invocation.feature` | seed created by the task | ⬜ pending |
| 1-04-01 | 04 | 1 | FND-01 | T-1-09, T-1-10 | writers stay in the sandbox | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/plugin/state-migration.feature features/plugin/list.feature` | seed created by the task | ⬜ pending |
| 1-04-02 | 04 | 1 | FND-01 | T-1-09 | writers stay in the sandbox | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/plugin/config-migration.feature features/plugin/configuration.feature` | seed created by the task | ⬜ pending |
| 1-04-03 | 04 | 1 | FND-01 | T-1-09 | the user's own mcp.json entry is kept | cucumber seed (`@mcp`, both profiles) | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/legacy-move.feature features/mcp-server/configuration.feature`; `npm run test:cucumber:profile -- --profile builtin features/mcp-server/legacy-move.feature` | seed created by the task | ⬜ pending |
| 1-05-01 | 05 | 2 | FND-01 | T-1-11, T-1-12 | lifecycle lines hold no environment | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature features/hook/failures.feature features/hook/prompt-and-stop.feature features/hook/messages.feature` | seed created by the task | ⬜ pending |
| 1-05-02 | 05 | 2 | FND-01 | T-1-11 | N/A | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature features/hook/session.feature features/hook/messages.feature` | ✅ after 1-05-01 | ⬜ pending |
| 1-05-03 | 05 | 2 | FND-01 | T-1-11 | no hook process outlives the run | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature` | ✅ after 1-05-01 | ⬜ pending |
| 1-06-01 | 06 | 2 | FND-01 | T-1-13, T-1-14, T-1-15 | no request leaves the machine; the token stays in the sandbox | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature features/marketplace/github-source.feature features/marketplace/git-source.feature` | seed created by the task | ⬜ pending |
| 1-06-02 | 06 | 2 | FND-01 | T-1-13 | every other host is refused | unit | `node --test test/architecture/github-device-flow-redirect.test.ts`; `npm run test:unpaired` | created by the task | ⬜ pending |
| 1-06-03 | 06 | 2 | FND-01 | T-1-13 | the terminal Pi routes the same way | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature features/marketplace/background-update.feature` | ✅ after 1-06-01 | ⬜ pending |
| 1-07-01 | 07 | 2 | FND-01 | T-1-17, T-1-18 | the json Pi gets the allowlist only and is killed past its deadline | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/plugin/bootstrap.feature` | seed added by the task | ⬜ pending |
| 1-07-02 | 07 | 2 | FND-01 | T-1-19 | N/A | unit + cucumber seed | `node --test test/architecture/pi-tui-screen.test.ts test/architecture/pi-tui-notices.test.ts`; `npm run test:cucumber:profile -- --profile adapter features/plugin/bootstrap.feature features/marketplace/background-update.feature features/skill/aliases.feature` | created by the task | ⬜ pending |
| 1-07-03 | 07 | 2 | FND-01 | T-1-18 | N/A | cucumber seed | `npm run test:cucumber:profile -- --profile adapter features/plugin/browse.feature` | seeds added by the task | ⬜ pending |
| 1-08-01 | 08 | 3 | FND-01, FND-02 | T-1-21 | the frozen record matches the files Phase 1 changed | doc gate | `SKIP=npm-check pre-commit run --files .agents/skills/cucumber/rules/layout.md .agents/skills/cucumber/rules/world-and-stand-ins.md`; the grep gate of the task | ✅ | ⬜ pending |
| 1-08-02 | 08 | 3 | FND-02 | T-1-20, T-1-21 | the brief says push nothing unless the user asks | doc gate | `test -f .planning/milestones/behavioral-gaps-CHILD-SESSION-BRIEF.md` and the brief's greps | created by the task | ⬜ pending |
| 1-08-03 | 08 | 3 | FND-01, FND-02 | T-1-20 | branches stay local | full gate + git | `npm run check`; `npm run test:modules`; `git branch --list --format="%(refname:short) %(objectname:short)" "features/behavioral-gaps-phase-*"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements: cucumber, its two profiles, and `node:test` are in place, and each task creates the seed or unit case that verifies it. The optional peer cache is installed by `node scripts/install-test-peers.mjs` (run by every `npm run test:cucumber:profile` command above).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
All phase behaviors have automated verification. The CI-time check of plan 01-08 is a local measurement, because nothing is pushed (D-BG-16); it compares each leg's local time with the leg's timeout at the D-CF1-16 margin.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
