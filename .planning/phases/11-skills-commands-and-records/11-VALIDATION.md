---
phase: "11"
slug: "skills-commands-and-records"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15"
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `11-RESEARCH.md` "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (unit); `@cucumber/cucumber` profiles `adapter` / `builtin` (behavioral) |
| **Config file** | `package.json` scripts, `cucumber.json` |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>` |
| **Pair coverage** | `npm run test:coverage:direct -- <source path>` |
| **Feature run** | `npm run test:cucumber:profile -- --profile adapter <feature paths>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~5 s; feature ~60 s; full ~75 s+ |

---

## Sampling Rate

- **After every task commit:** the owner test, its pair coverage, and the feature file the task touches; `npm run check:features` when a feature or step file changed. The commit hook runs `check:commit`.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` green.
- **Max feedback latency:** ~90 seconds per task.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PG-CMD-09 | `/demo:demo-lint x` sends the body of `commands/demo-lint.md` | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-CMD-09)" features/slash-command/aliases.feature` | scenario new | ⬜ pending |
| PG-CMD-09 | Claude Code name function; record round trip; planted name dropped | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/name.test.ts test/bridges/commands/command-record.test.ts test/orchestrators/skill-alias-state.test.ts` | yes | ⬜ pending |
| PG-SKILL-11 | Command alias row shows its description | cucumber, red by edit | `npm run test:cucumber:profile -- --profile adapter features/slash-command/aliases.feature features/slash-command/frontmatter.feature` | rows change | ⬜ pending |
| PG-SKILL-11 | Skill alias row shows `argument-hint` and description | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-11)" features/skill/aliases.feature` | scenario new | ⬜ pending |
| PG-SKILL-11 | Hint only / description only / both / neither | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/skill-aliases.test.ts` | yes | ⬜ pending |
| PG-SKILL-01 | Command body mention reaches the model in a `<file>` block | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/slash-command/invocation.feature` | scenario new | ⬜ pending |
| PG-SKILL-01 | Argument path, fence, code span, `!` output not attached | cucumber, guard | same command | scenario new | ⬜ pending |
| PG-SKILL-01 | Skill body mention attached through an alias | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/skill/invocation.feature` | scenario new | ⬜ pending |
| PG-SKILL-01 | Mention parser | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/file-mentions.test.ts` | ❌ W0 | ⬜ pending |
| PG-SKILL-01 | Qualification and reads | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/mention-attachments.test.ts` | ❌ W0 | ⬜ pending |
| PG-DOC-01 | Each cited line is a `Scenario` line; each cited scenario passes | script + suite | citation check in `11-RESEARCH.md`; `npm run test:cucumber` | page new | ⬜ pending |
| PG-DOC-02 | Old statements gone, new text present | grep | grep checks in `11-RESEARCH.md` | -- | ⬜ pending |

The plans' task IDs carry the exact commands; this table is the requirement-level contract.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/domain/file-mentions.test.ts` — lands with its source in the same commit
- [ ] `test/orchestrators/mention-attachments.test.ts` — lands with its source in the same commit

No framework install and no shared fixture is missing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Codemode reach of plugin tools; UAT-02 rebuild order | PG-DOC-02 | Only a live run settles them; the docs mark them **unmeasured** | none in this phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
