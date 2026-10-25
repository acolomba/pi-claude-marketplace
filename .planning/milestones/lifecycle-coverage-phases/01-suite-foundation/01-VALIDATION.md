---
phase: "1"
slug: "suite-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-22"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@cucumber/cucumber` 13 (behavioral); `node:test` for unit tests |
| **Config file** | `cucumber.json` |
| **Quick run command** | `npx cucumber-js <touched feature files>` and `npm run check:features` |
| **Full suite command** | `npm run test:cucumber` (about 15 s), then `npm run check` at the phase gate |
| **Estimated runtime** | ~15 seconds for the suite, ~2 minutes for `npm run check` |

---

## Sampling Rate

- **After every task commit:** Run `npx cucumber-js <touched feature files>` and `npm run check:features`
- **After every plan wave:** Run `npm run test:cucumber` and `npm run check:static`
- **Before `/gsd-verify-work`:** `npm run check` must be green on the combined tree
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

One row per task. Every command runs from the repository root; each task's commit also runs the
`npm-check` hook (`npm run check:commit`: typecheck, ESLint, fallow, Prettier, `check:features`). "❌
task" means the seed feature file does not exist yet and the task itself creates it with its first
scenario, so no separate Wave 0 is needed.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FND-01, FND-02 | T-01-01 | Move-only commit; no step text changes | static + behavioral | `npm run check:features && npx cucumber-js features/plugin/install.feature` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | FND-01, FND-02 | T-01-01 | Move-only commit; no step text changes | static + behavioral | `npm run check:features && npx cucumber-js features/marketplace/git-source.feature features/marketplace/github-source.feature features/marketplace/url-source.feature features/marketplace/url-source-update.feature features/marketplace/unsupported-source.feature` | ✅ | ⬜ pending |
| 1-01-03 | 01 | 1 | FND-01 | — | Skill text only | static | `SKIP=npm-check pre-commit run --files .agents/skills/cucumber/rules/layout.md && grep -c '^## Parallel work$' .agents/skills/cucumber/rules/layout.md` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 2 | FND-01, FND-02 | T-01-02, T-01-04 | Session payloads validated against the payload schema; reset session reports none | behavioral (no commit of its own) | `npx cucumber-js features/plugin/reconcile.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-02-02 | 02 | 2 | FND-01, FND-02 | T-01-03 | Uncompared session rows fail the scenario | behavioral (full suite); one commit for 1-02-01 and 1-02-02 | `npm run test:cucumber && npm run check:features` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 3 | FND-01, FND-02 | T-01-05 | A setup that must fail asserts every payload is an error | behavioral | `npx cucumber-js features/marketplace/failed-add.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-03-02 | 03 | 3 | FND-01, FND-02 | T-01-06 | plugin-info-cascade blocks are read, never skipped | behavioral | `npx cucumber-js features/plugin/info.feature features/plugin/prune.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-04-01 | 04 | 3 | FND-01, FND-02 | T-01-07 | Record read from the sandbox scope root only | behavioral | `npx cucumber-js features/plugin/enable.feature features/plugin/install.feature && npm run check:features` | ✅ | ⬜ pending |
| 1-04-02 | 04 | 3 | FND-01, FND-02 | T-01-07, T-01-08 | Plant and delete stay under the sandbox scope root; planted file released | behavioral | `npx cucumber-js features/plugin/uninstall.feature features/plugin/reinstall.feature && npm run check:features` | ✅ | ⬜ pending |
| 1-05-01 | 05 | 3 | FND-01, FND-02 | T-01-09, T-01-10 | Second Pi uses the sandbox HOME and a temp cwd; world stops it and removes the directory | behavioral | `npx cucumber-js features/plugin/install.feature && npm run check:features` | ✅ | ⬜ pending |
| 1-05-02 | 05 | 3 | FND-01, FND-02 | T-01-11 | Output style written inside the publication only | behavioral | `npx cucumber-js features/plugin/partial-install.feature features/plugin/install-dependencies.feature features/marketplace/update.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-06-01 | 06 | 4 | FND-01, FND-02 | T-01-13, T-01-14 | Every arm released by the world; loopback-only host | behavioral | `npx cucumber-js features/marketplace/failed-add.feature features/marketplace/git-source.feature features/marketplace/github-source.feature features/marketplace/url-source.feature features/marketplace/url-source-update.feature features/marketplace/unsupported-source.feature && npm run check:features` | ✅ | ⬜ pending |
| 1-06-02 | 06 | 4 | FND-01, FND-02 | T-01-12 | Official marketplace served by the loopback host through the GitHub base override | behavioral (full suite) | `npx cucumber-js features/plugin/bootstrap.feature && npm run test:cucumber && npm run check:features` | ❌ task | ⬜ pending |
| 1-06-03 | 06 | 4 | FND-01 | — | Skill text only | static | `SKIP=npm-check pre-commit run --files .agents/skills/cucumber/rules/world-and-stand-ins.md .agents/skills/cucumber/rules/steps.md && grep -c 'anthropics' .agents/skills/cucumber/rules/world-and-stand-ins.md` | ✅ | ⬜ pending |
| 1-07-01 | 07 | 4 | FND-01, FND-02 | T-01-15, T-01-16 | Lock taken in the sandbox only; release proves the child exited and the lock is gone | behavioral | `npx cucumber-js features/plugin/state-lock.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-07-02 | 07 | 4 | FND-01, FND-02 | T-01-16, T-01-17, T-01-18 | EISDIR obstruction stops root too; released by the world | behavioral | `npx cucumber-js features/plugin/install-rollback.feature features/marketplace/update.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-08-01 | 08 | 5 | FND-01, FND-02 | T-01-19, T-01-20, T-01-21 | Plugin sources name 127.0.0.1 or go through the base override; hermetic fixture git | behavioral | `npx cucumber-js features/plugin/git-source.feature features/plugin/install.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-08-02 | 08 | 5 | FND-01, FND-02 | T-01-19 | Request log states every clone request of each kind | behavioral | `npx cucumber-js features/plugin/git-source.feature && npm run check:features` | ✅ | ⬜ pending |
| 1-09-01 | 09 | 5 | FND-01, FND-02 | T-01-24 | Config writes only the scope's layer configs | behavioral | `npx cucumber-js features/plugin/pending.feature features/plugin/configuration.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-09-02 | 09 | 5 | FND-01, FND-02 | T-01-22, T-01-23 | Settings written under the sandbox HOME or project only | behavioral | `npx cucumber-js features/plugin/import.feature features/plugin/pending.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-10-01 | 10 | 6 | FND-01, FND-02 | T-01-25, T-01-26 | Plugin arms released by the world; resolution fails on an unknown or ambiguous plugin | behavioral | `npx cucumber-js features/plugin/fetch.feature features/marketplace/failed-add.feature features/marketplace/git-source.feature && npm run check:features` | ❌ task | ⬜ pending |
| 1-10-02 | 10 | 6 | FND-01, FND-02 | T-01-27 | Clone reader reads only the sandbox scope's checkouts | behavioral | `npx cucumber-js features/plugin/git-source.feature features/plugin/git-source-update.feature && npm run check:features` | ❌ task | ⬜ pending |

Plan 02 lands both of its tasks in Task 2's feature commit: once a session records its payloads, six
existing scenarios fail until Task 2 compares their session reports. So 1-02-01 is sampled when the
task ends, makes no commit, and gets the `npm-check` hook in that shared commit, and no commit leaves an
existing scenario failing. Task 2 then commits the ROADMAP file-ownership note alone. The plans of
waves 3, 4, and 5 run one at a time in this worktree; the wave numbers stay as they are.

Phase gate (after wave 6): `npm run check` on the combined tree.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0: the usage gate (`check:features`, run by every commit hook) fails on a step with
no scenario, so each task creates its seed feature file together with the steps it proves. Where each
item lands:

- [ ] Seed feature files: `plugin/reconcile` (01-02); `marketplace/failed-add`, `plugin/info`,
  `plugin/prune` (01-03); `plugin/partial-install`, `plugin/install-dependencies` (01-05);
  `plugin/bootstrap` (01-06); `plugin/state-lock`, `plugin/install-rollback` (01-07);
  `plugin/git-source` (01-08); `plugin/pending`, `plugin/import` (01-09); `plugin/fetch`,
  `plugin/git-source-update` (01-10); seeds added to the existing `plugin/install` (01-05),
  `plugin/enable`, `plugin/uninstall`, `plugin/reinstall` (01-04). `plugin/help` gets no seed:
  `usage-info` is already compared by `features/marketplace/help.feature`.
- [ ] `features/lib` modules: `result-rows.ts` (01-02), `state-lock-holder.ts` (01-07), `git-plugin.ts`
  (01-08), `git-clones.ts` (01-10); the official marketplace lives in `published-marketplace.ts`
  (01-06), and the settings writer in its step module `claude-code-settings.steps.ts` (01-09).
- [ ] Run tokens `{project dir}` and `{agent dir}` (01-07) and `{<repository> revision <n>}` (01-08),
  documented in `.agents/skills/cucumber/rules/features.md`.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (22 of 22 tasks, each with a `<fails_when>`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none: each task creates its own seed file)
- [x] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
