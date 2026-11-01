---
phase: "02"
slug: "skills"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-01"
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, architecture, integration) and `@cucumber/cucumber` 13.3.0 (behavioral: RPC profile Pi with the scripted model, the registry of `get_commands`, and the real-terminal TUI driver) |
| **Config file** | `cucumber.json` (frozen; `order: random`); `package.json` scripts; `.fallowrc.json`; `rule-packs/architecture.json` |
| **Quick run command** | `node --test <test-path>`; `npm run test:coverage:direct -- <source-or-test>`; `npx cucumber-js features/skill/<capability>.feature`; `npx cucumber-js --name '<scenario title>'`; `npm run check:features` |
| **Full suite command** | `npm run check` (check:static, test:unpaired, test:integration, test:cucumber, test:coverage:direct:all) |
| **Estimated runtime** | ~600 seconds for `npm run check` on 4 cores (`test:modules` ~140 s, `test:integration` ~360 s measured by the research); under 60 seconds for one owner test; about 1-2 minutes for `features/skill` |

Every npm script that runs tests runs with the session's root wrapper
(`npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`)
because the sandbox runs as root.

---

## Sampling Rate

- **After every task commit:** the commit hook (`npm run check:commit`) plus the task's `<automated>` command: the owner test, direct coverage for the touched pair, the plan's feature file, and `npx fallow dupes` when `bridges/skills/stage.ts` or `discover.ts` changed.
- **After every plan wave:** `npm run check` on the combined tree (the GSD post-merge wave gate).
- **Before `/gsd-verify-work`:** `npm run check` green and `npm run test:cucumber` twice in random order (plan 02-07).
- **Max feedback latency:** 120 seconds per task command (the cucumber skill directory with profile Pis is the long one); the wave gate is the long run.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SKL-01 | — | N/A | cucumber + unit | `node --test test/bridges/skills/stage.test.ts test/bridges/skills/frontmatter-degrade.test.ts test/orchestrators/plugin/materialize-latest.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/stage.ts extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts && npx cucumber-js features/skill && npm run check:features` | ❌ W0 `features/skill/listing.feature` (red first in the task) | ⬜ pending |
| 02-01-02 | 01 | 1 | SKL-01 | — | N/A | cucumber + unit | `npx cucumber-js features/skill/listing.feature && node --test test/bridges/skills/stage.test.ts && npm run check:features` | ✅ after 02-01-01 | ⬜ pending |
| 02-01-03 | 01 | 1 | SKL-01 (record for SKL-03, SKL-05) | T-02-01, T-02-02, T-02-04 | the stored record is one JSON line, verified on write, never rewritten, names capped at 256 characters | unit + cucumber + static | `node --test test/bridges/skills/skill-names.test.ts test/bridges/skills/stage.test.ts test/bridges/skills/frontmatter-scan.test.ts test/edge/register.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/orchestrators/plugin/reinstall-flow.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/skill-names.ts extensions/pi-claude-marketplace/bridges/skills/stage.ts extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts && npx cucumber-js features/skill && npm run fallow` | ❌ W0 `test/bridges/skills/skill-names.test.ts` (red first in the task) | ⬜ pending |
| 02-02-01 | 02 | 2 | SKL-02 | T-02-05, T-02-06 | every unhonored field a skill sets is reported, as a discovery warning without a value or path | cucumber + unit | `node --test test/bridges/skills/stage.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/stage.ts && npx cucumber-js features/skill/frontmatter.feature && npx fallow dupes --fail-on-issues --format human --quiet` | ❌ W0 `features/skill/frontmatter.feature` (red first) | ⬜ pending |
| 02-02-02 | 02 | 2 | SKL-02 | T-02-05 | the four never-reported fields stay silent; order kept | cucumber + unit | `npx cucumber-js features/skill/frontmatter.feature && node --test test/bridges/skills/stage.test.ts && npm run check:features` | ✅ after 02-02-01 | ⬜ pending |
| 02-02-03 | 02 | 2 | SKL-02 | — | N/A | cucumber + lint | `npx cucumber-js features/skill/frontmatter.feature && npm run check:features && npx eslint features/step_definitions/skill/frontmatter.steps.ts --max-warnings 0` | ❌ W0 `features/step_definitions/skill/frontmatter.steps.ts` | ⬜ pending |
| 02-03-01 | 03 | 2 | SKL-03 | T-02-07, T-02-12 | extension-sourced input and non-bridged skills never reach the runner | unit + cucumber + static | `node --test test/orchestrators/skill-invocation.test.ts test/edge/skill-aliases.test.ts test/index.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts extensions/pi-claude-marketplace/edge/skill-aliases.ts && npx cucumber-js features/skill/invocation.feature && npm run fallow` | ❌ W0 `test/orchestrators/skill-invocation.test.ts` (red first) | ⬜ pending |
| 02-03-02 | 03 | 2 | SKL-03 | T-02-08, T-02-09, T-02-11 | substitution before injection; an abort is `handled`, reported only through `notifyUsageError`, nothing reaches the model | unit + cucumber | `node --test test/orchestrators/skill-invocation.test.ts test/edge/skill-aliases.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts extensions/pi-claude-marketplace/edge/skill-aliases.ts && npx cucumber-js features/skill/invocation.feature && npm run check:features` | ✅ after 02-03-01 | ⬜ pending |
| 02-03-03 | 03 | 2 | SKL-03 (D-CF2-05) | T-02-07 | the same path for interactive and RPC; autocomplete offers qualified aliases only | unit + cucumber | `node --test test/edge/skill-aliases.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/skill-aliases.ts && npx cucumber-js features/skill && npm run check:features` | ✅ after 02-03-01 | ⬜ pending |
| 02-04-01 | 04 | 2 | SKL-04 | T-02-13, T-02-14 | a shadowed skill is named in the install diagnostic; listings read names only | unit + cucumber | `node --test test/bridges/skills/discover.test.ts test/bridges/skills/stage.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/discover.ts && npx cucumber-js features/skill/collisions.feature && npx fallow dupes --fail-on-issues --format human --quiet` | ❌ W0 `features/skill/collisions.feature` (red first) | ⬜ pending |
| 02-04-02 | 04 | 2 | SKL-04 | — | N/A | unit + architecture + cucumber + integration | `node --test test/bridges/skills/discover.test.ts test/architecture/declared-component-path-overlap.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/discover.ts && npx cucumber-js features/skill/collisions.feature && npm run test:integration` | ✅ after 02-04-01 | ⬜ pending |
| 02-05-01 | 05 | 2 | SKL-06 | T-02-15 | a disabled plugin's skill is no longer expanded for the model | cucumber | `npx cucumber-js features/skill/lifecycle.feature && npm run check:features` | ❌ W0 `features/skill/lifecycle.feature` | ⬜ pending |
| 02-05-02 | 05 | 2 | SKL-06 | T-02-15 | uninstall removes, enable restores, update replaces | cucumber | `npx cucumber-js features/skill/lifecycle.feature && npm run check:features` | ✅ after 02-05-01 | ⬜ pending |
| 02-06-01 | 06 | 3 | SKL-05 | T-02-16 | an alias never takes a non-skill command's name; first claim wins | unit + cucumber + static | `node --test test/orchestrators/skill-alias-state.test.ts test/edge/skill-aliases.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts && npx cucumber-js features/skill/aliases.feature && npm run fallow` | ❌ W0 `features/skill/aliases.feature` (red first) | ⬜ pending |
| 02-06-02 | 06 | 3 | SKL-05 | T-02-16 | a command keeps its name; a disabled plugin's alias is gone | cucumber + unit | `npx cucumber-js features/skill/aliases.feature && node --test test/orchestrators/skill-alias-state.test.ts && npm run check:features` | ✅ after 02-06-01 | ⬜ pending |
| 02-06-03 | 06 | 3 | SKL-05 | T-02-18 | the TUI is released with its process group and stays in the sandbox | cucumber (TUI) + architecture + lint | `npx cucumber-js features/skill/aliases.feature && node --test test/architecture/pi-tui-notices.test.ts && npm run check:features && npx eslint features/lib/pi-tui.ts features/step_definitions/skill/aliases.steps.ts --max-warnings 0`; then `npm run test:cucumber -- features/marketplace/background-update.feature` | ❌ W0 `features/step_definitions/skill/aliases.steps.ts` | ⬜ pending |
| 02-07-01 | 07 | 4 | SKL-01..SKL-06 | T-02-20 | no test weakened to pass the gate | full suite | `npm run check`; then `npm run test:cucumber && npm run test:cucumber` | ✅ | ⬜ pending |
| 02-07-02 | 07 | 4 | D-CF2-10 (ROADMAP criterion 5) | T-02-19 | the Pi report is drafted, not filed | doc grep | `grep -c 'D-CF2-10' .planning/phases/02-skills/02-07-SUMMARY.md && grep -c 'D-CF2-12' .planning/phases/02-skills/02-07-SUMMARY.md` | ❌ written by the task | ⬜ pending |
| 02-07-03 | 07 | 4 | SKL-01..SKL-06 | — | N/A | doc grep | `grep -c '^## Threat Flags' .planning/phases/02-skills/02-07-SUMMARY.md && grep -c 'Parent lines' .planning/phases/02-skills/02-07-SUMMARY.md` | ❌ written by the task | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 plan: each new test file is created red-first inside the task
that needs it (TDD tasks), before the product change, and the red run is
recorded in that plan's SUMMARY.

- [ ] `test/bridges/skills/skill-names.test.ts` — pair for the new names module (02-01 Task 3)
- [ ] `test/orchestrators/skill-invocation.test.ts` — pair for the new invocation module (02-03 Task 1)
- [ ] `features/skill/{listing,frontmatter,collisions,lifecycle,aliases}.feature` — created red-first by their plans; `invocation.feature` is the Phase 1 seed, edited red-first by 02-03
- [ ] `features/step_definitions/skill/{listing,frontmatter,collisions,aliases}.steps.ts` — the shared skill steps (02-01), the system-prompt skill list (02-02), the setup Given for an install that skipped a skill (02-04), the TUI alias turn (02-06)
- [ ] `features/lib/pi-tui.ts` optional profile and `typeText` — spike first (02-06 Task 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Filing the Pi gap report | ROADMAP Phase 2 criterion 5 (D-CF2-10) | Posting to Pi's public tracker is the user's call and needs the user's account | Read the "Pi gap report" section of `02-07-SUMMARY.md` and file it, or decide not to |
| `shell: powershell` with a real PowerShell, and the Windows `bash-missing` abort | SKL-03 | No `pwsh` in the sandbox and no Windows host; `selectPromptShell` runs Bash on Linux unless `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set | Unit-covered in `test/orchestrators/skill-invocation.test.ts` and the frozen `test/platform/prompt-shell.test.ts`; on Windows without Git Bash, invoke a skill with `shell: bash` and expect Claude Code's "requires bash" message |
| A typed argument that names `${CLAUDE_PLUGIN_ROOT}` and the other path variables | SKL-03 | The frozen prompt step rejects `{...}` text as an unknown run token, so no scenario can type it | Unit-covered in `test/orchestrators/skill-invocation.test.ts`; manually, type `/skill:<plugin>-<skill> ${CLAUDE_PLUGIN_ROOT}` in Pi and expect the plugin root in `ARGUMENTS:` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s per task command
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (set by `/gsd-validate-phase` after execution)
