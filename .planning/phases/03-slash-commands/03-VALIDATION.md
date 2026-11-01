---
phase: "03"
slug: "slash-commands"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-01"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` with `strong-mock` (unit, architecture, integration) and `@cucumber/cucumber` (behavioral: RPC profile Pi with the scripted model, the registry probe, and the real-terminal TUI driver) |
| **Config file** | `cucumber.json` (frozen; `order: random`); `package.json` scripts; `.fallowrc.json`; `rule-packs/architecture.json` |
| **Quick run command** | `node --test <test-path>`; `npm run test:coverage:direct -- <source-or-test>`; `npx cucumber-js features/slash-command/<capability>.feature`; `npm run check:features`; `npx fallow dupes` |
| **Full suite command** | `npm run check` (check:static, test:unpaired, test:integration, test:cucumber, test:coverage:direct:all) |
| **Estimated runtime** | ~600 seconds for `npm run check`; under 60 seconds for one owner test; about 1-2 minutes for `features/slash-command` |

Every npm script that runs tests runs with the session's root wrapper
(`npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`)
because the sandbox runs as root.

---

## Sampling Rate

- **After every task commit:** the commit hook (`npm run check:commit`) plus the task's `<automated>` command: the owner test, direct coverage for the touched pair, the plan's feature file, and `npx fallow dupes` when a file mirrors Phase 2 code.
- **After every plan wave:** `npm run check` on the merged tree plus `npx fallow dupes`.
- **Before `/gsd-verify-work`:** `npm run check` green, the whole unit suite (`npm run test:modules`), and `npm run test:cucumber` twice more in random order (seeds recorded).
- **Max feedback latency:** 120 seconds per task command; the wave gate is the long run.

---

## Per-Requirement Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 / D-CF3-08 | Fallback description: first line, heading, 101-char cut, empty body `Plugin command`, degraded command | unit + cucumber (red: Pi's 60-char text) | `node --test test/bridges/commands/staged-command.test.ts`; `npx cucumber-js features/slash-command/listing.feature` | ❌ Wave 1 |
| CMD-01 / D-CF3-12 | Nested `build/web` gives `/demo:build:web`; `demo-lint` gives `/demo:lint`; `.hidden.md` not listed | cucumber (negative-edit proof) | listing.feature | ✅ seed only |
| D-CF3-06 record | Record written, read back, PARSE-02 safe | unit | staged-command.test.ts, stage.test.ts | ❌ Wave 1 |
| CMD-02 | `$ARGUMENTS`, `$0`, `ARGUMENTS:` append, `$ARGUMENTS[N]`, named `arguments`, no-args `""` | unit (orchestrator) + cucumber Outline (red: Pi 1-based) | `node --test test/orchestrators/command-invocation.test.ts`; invocation.feature | ❌ Wave 2 |
| CMD-02 | User's own Pi template keeps Pi's expansion (negative control) | unit + cucumber | edge and orchestrator tests | ❌ Wave 2 |
| CMD-02 / E8 | Chained body text pinned (residual) | unit | orchestrator test | ❌ Wave 2 |
| CMD-03 / FG-05 | `!` runs; failure gives usage-error, model gets nothing; `!` argument escaped | cucumber (red: literal `!`) + unit | invocation.feature | ❌ Wave 2 |
| CMD-03 | `${CLAUDE_SESSION_ID}` / `${CLAUDE_EFFORT}` at invocation; typed `${CLAUDE_PLUGIN_ROOT}` | cucumber + unit | invocation.feature | ❌ Wave 2 |
| D-CF3-07 | Unrecorded project command aborts; recorded runs; user scope never checks | unit (ledger fakes) + cucumber (red: command ran) | invocation.feature (reuses Phase 2 provenance Given); `node --test test/bridges/commands/project-ledger.test.ts` | ❌ Wave 2 |
| D-CF3-07 writer | Commit records at project scope, none at user scope, failure propagates; unstage forgets, failure is a warning | unit | stage.test.ts, unstage.test.ts, project-ledger.test.ts | ❌ Wave 2 |
| CMD-03 / D-CF3-09 | `[deploy] dropped fields: model, effort`; none for clean or degraded; manifest `model` counts (wave 3) | unit + cucumber (red: no warning row) | frontmatter.feature | ❌ Wave 2 |
| CMD-03 / D-CF3-10 | `argument-hint` in TUI menu | cucumber (TUI, shared sandbox) | frontmatter.feature | ❌ Wave 2 (spike first) |
| CMD-03 / D-CF3-01 | Command absent from `<available_skills>` while a skill is present | cucumber (negative control, divergence pin) | frontmatter.feature | ❌ Wave 2 |
| CMD-03 / D-CF3-02 | `user-invocable: false` listed and runnable | cucumber (negative-edit proof) | frontmatter.feature | ❌ Wave 2 |
| CMD-04 / D-CF3-03 | Map source and content listed with manifest descriptions; overrides; content frontmatter; invalid keys, missing or non-`.md` source, second key warnings; directory source walked; both/neither unavailable | unit (resolver, discover, writer) + cucumber (red: plugin unavailable) | `node --test test/domain/component-paths.test.ts test/bridges/commands/discover.test.ts`; manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / D-CF3-04 | Entry declaration adds to `commands/`, no warning; entry map `content` dropped with warning | unit + cucumber (red: `commands/` file missing) | manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / D-CF3-05 | `"./cmds/a.md"` gives `/demo:a`; array file + dir; non-`.md` warns | unit + cucumber (red: nothing listed) | manifest-forms.feature | ❌ Wave 3 |
| CMD-04 / FG-14 | plugin.json declaration replaces `commands/` with the note | cucumber (negative-edit proof) | manifest-forms.feature | ❌ Wave 3 |
| CMD-05 / D-CF3-11 | Disable, uninstall, enable, update (new description listed, new body in model log); uninstall-before-reload aborts with the unreadable message | cucumber (negative-edit proofs; the abort row needs the handler) | lifecycle.feature | ❌ Wave 3 |


---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. New test files are created by their plans.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
