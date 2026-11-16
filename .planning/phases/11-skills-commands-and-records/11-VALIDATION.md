---
phase: "11"
slug: "skills-commands-and-records"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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
| PG-CMD-09 | `/demo:demo-lint x` sends the body of `commands/demo-lint.md` | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-CMD-09)" features/slash-command/aliases.feature` | yes | ✅ green |
| PG-CMD-09 | Claude Code name function; record round trip; planted name dropped | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/name.test.ts test/bridges/commands/command-record.test.ts test/orchestrators/skill-alias-state.test.ts` | yes | ✅ green |
| PG-SKILL-11 | Command alias row shows its description | cucumber, red by edit | `npm run test:cucumber:profile -- --profile adapter features/slash-command/aliases.feature features/slash-command/frontmatter.feature` | yes | ✅ green |
| PG-SKILL-11 | Skill alias row shows `argument-hint` and description | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-11)" features/skill/aliases.feature` | yes | ✅ green |
| PG-SKILL-11 | Hint only / description only / both / neither | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/edge/skill-aliases.test.ts` | yes | ✅ green |
| PG-SKILL-01 | Command body mention reaches the model in a `<file>` block | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/slash-command/invocation.feature` | yes | ✅ green |
| PG-SKILL-01 | Argument path, fence, code span, `!` output not attached | cucumber, guard | same command | yes | ✅ green |
| PG-SKILL-01 | Skill body mention attached through an alias | cucumber, red first | `npx cucumber-js --profile adapter --name "(PG-SKILL-01)" features/skill/invocation.feature` | yes | ✅ green |
| PG-SKILL-01 | Mention parser | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/file-mentions.test.ts` | yes | ✅ green |
| PG-SKILL-01 | Qualification and reads | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/mention-attachments.test.ts` | yes | ✅ green |
| PG-DOC-01 | Each cited line is a `Scenario` line; each cited scenario passes | script + suite | citation check in `11-RESEARCH.md`; `npm run test:cucumber` | yes | ✅ green |
| PG-DOC-02 | Old statements gone, new text present | grep | grep checks in `11-RESEARCH.md` | -- | ✅ green |

The plans' task IDs carry the exact commands; this table is the requirement-level contract.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/domain/file-mentions.test.ts` — lands with its source in the same commit
- [x] `test/orchestrators/mention-attachments.test.ts` — lands with its source in the same commit

No framework install and no shared fixture is missing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Codemode reach of plugin tools; UAT-02 rebuild order | PG-DOC-02 | Only a live run settles them; the docs mark them **unmeasured** | none in this phase |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-15 (gsd-validate-phase, no gaps)

## Validation Evidence 2026-11-15

Audited at 4e8d8d0b. Each requirement maps to a test that exists and passes:

- The nine owner unit files (`name`, `command-record`, `staged-command`, `skill-alias-state`, `skill-aliases`, `file-mentions`, `mention-attachments`, `command-invocation`, `skill-invocation`) ran together: 600 tests, 0 failures. The `run_plugin_command` and skill-read guards are the two `D-PG11-07` cases, which assert that the mention reader is asked for nothing.
- The tagged scenarios exist: `(PG-CMD-09)` in `features/slash-command/aliases.feature`, `(PG-SKILL-11)` twice in `features/skill/aliases.feature`, `(PG-SKILL-01)` three times in `features/slash-command/invocation.feature` and twice in `features/skill/invocation.feature`. They passed in the wave 8 gate (`/tmp/pg11-wave8.log`, `exit=0`, adapter 2084, builtin 204).
- PG-DOC-01: the citation check found 35 citations in `docs/skills-commands-compatibility.md`, and each one is a `Scenario` line (exit 0).
- PG-DOC-02: the four grep checks of `11-RESEARCH.md` print nothing.

## Validation Audit 2026-11-15

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Phase Gate 2026-11-16

`npm run check` on the final tree at 9874efc2, in a hermetic home (`PI_CODING_AGENT_DIR` set to a scratch directory). Log: `/tmp/pg11-phasegate2.log`, `exit=0`.

| Check | Result |
|---|---|
| check:static (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | passed |
| test:unpaired, test:integration | passed |
| test:cucumber, adapter profile | 2094 scenarios, 25908 steps passed |
| test:cucumber, builtin profile | 204 scenarios, 2762 steps passed |
| test:coverage:direct:all | passed, `coverage/direct.lcov` 374 records |

An earlier run at b574dd55 (`/tmp/pg11-phasegate.log`, `exit=0`, adapter 2092, builtin 204) passed before the last review fix round (WR-04, WR-05, IN-10). The review fixes added owner rows to `test/domain/file-mentions.test.ts` (now 115) and `test/orchestrators/skill-alias-state.test.ts`, and Examples rows to `features/slash-command/invocation.feature` and `features/slash-command/aliases.feature`.
