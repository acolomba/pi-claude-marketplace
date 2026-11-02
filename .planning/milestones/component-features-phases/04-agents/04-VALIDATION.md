---
phase: "4"
slug: "agents"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-01"
validated: "2026-11-01"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, direct coverage) and `@cucumber/cucumber` (behavioral, `features/`) |
| **Config file** | `package.json` scripts; `cucumber.js`; `scripts/test-reporter.mjs` |
| **Quick run command** | `node --test --test-reporter=./scripts/test-reporter.mjs test/bridges/agents/*.test.ts` and `npx cucumber-js features/agent` |
| **Full suite command** | `npm run check`, `npm run test:modules`, `npm run test:cucumber` |
| **Estimated runtime** | ~4 seconds (agents unit suite); the agent features and the full gate take minutes |

As root, every npm script and cucumber run goes through the `nondac-sh` wrapper (see `.planning/CHILD-SESSION-BRIEF.md`).

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` block (its unit files, `npm run test:coverage:direct -- <sources>`, `npx cucumber-js features/agent`, `npm run check:static`)
- **After every plan wave:** `npm run check` on the merged tree
- **Before `/gsd-verify-work`:** `npm run check`, `npm run test:modules`, and `npm run test:cucumber` twice (04-06 Task 1)
- **Max feedback latency:** ~4 seconds for the unit quick run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | AGT-01 | T-04-01..05 | A description-less agent lists with Claude Code's fallback | unit + cucumber | `node --test test/bridges/agents/convert.test.ts ...; npx cucumber-js features/agent` (`listing.feature`) | yes | green |
| 4-01-02 | 01 | 1 | AGT-01 | T-04-01, T-04-02 | Nested and declared files list as `<plugin>:<folder>:<name>`; a flattened duplicate is reported, not dropped; names stay inside the agents dir | unit + cucumber | `node --test test/bridges/agents/{discover,convert,types}.test.ts test/domain/name.test.ts; npx cucumber-js features/agent` | yes | green |
| 4-01-03 | 01 | 1 | AGT-01 | T-04-03 | Each bridged agent is advertised to the parent model | unit + cucumber | `node --test test/bridges/agents/{frontmatter,convert,stage}.test.ts; npx cucumber-js features/agent` (`listing.feature` "advertises") | yes | green |
| 4-01-04 | 01 | 1 | AGT-01 | — | Orchestrator expected texts carry `advertise: true` | unit | `node --test test/orchestrators/plugin/{update-swap,reinstall-flow,install-flow-ledger}.test.ts` | yes | green |
| 4-02-01 | 02 | 2 | AGT-02 | T-04-06 | A bridged agent runs in the foreground unless its source or the call asks for the background | unit + cucumber | `node --test test/bridges/agents/{convert,frontmatter,stage}.test.ts ...; npx cucumber-js features/agent` (`frontmatter.feature`) | yes | green |
| 4-02-02 | 02 | 2 | AGT-02, AGT-03 | T-04-07 | `effort` and `model` convert as Claude Code names them, with and without `--map-model` | unit + cucumber | `node --test test/bridges/agents/convert.test.ts test/edge/handlers/plugin/{install,update}.test.ts; npx cucumber-js features/agent/frontmatter.feature` | yes | green |
| 4-02-03 | 02 | 2 | AGT-03 | T-04-08 | Tool lists split as Claude Code splits them; ignored plugin fields are reported, not dropped silently | unit + cucumber | `node --test test/bridges/agents/{convert,stage}.test.ts; npx cucumber-js features/agent` | yes | green |
| 4-03-01 | 03 | 2 | AGT-05 | T-04-09 | Install without pi-subagents names `{requires pi-subagents}` and does not fail; agents list once the companion runs, no reinstall | cucumber | `npx cucumber-js features/agent/companion-missing.feature` | yes | green |
| 4-03-02 | 03 | 2 | AGT-06 | T-04-10 | A trusted project runs its plugin agent; an untrusted one does not run project-scope agents and still runs user-scope ones | cucumber | `npx cucumber-js features/agent/project-trust.feature` | yes | green |
| 4-04-01 | 04 | 2 | AGT-07 | T-04-11 | Disable removes the agent from pi-subagents' list; enable restores it | cucumber | `npx cucumber-js features/agent/lifecycle.feature` | yes | green |
| 4-04-02 | 04 | 2 | AGT-07 | T-04-11 | Uninstall removes, update replaces; disabling one plugin keeps another's agent | cucumber | `npx cucumber-js features/agent/lifecycle.feature` | yes | green |
| 4-05-01 | 05 | 3 | XK-01, AGT-03 | T-04-12..15 | A preloaded plugin skill's content reaches the child; a skill kept from the model is not preloaded; inline `!` commands do not run | unit + cucumber | `node --test test/bridges/agents/{skill-preload,convert,stage,types}.test.ts test/orchestrators/plugin/install-outcome.test.ts; npx cucumber-js features/agent` (`invocation.feature`) | yes | green |
| 4-05-02 | 05 | 3 | XK-01 | T-04-16 | An update preloads the new skill version; skipped preloads are reported | unit + cucumber | `node --test test/orchestrators/plugin/{update-flow,update-swap}.test.ts; npx cucumber-js features/agent/invocation.feature` | yes | green |
| 4-05-03 | 05 | 3 | AGT-02, AGT-04 | — | A foreground child gets the tools its agent lists; a same-name agent runs its own plugin's body; the background gap is recorded (D-CF4-10) and `Async: true` is pinned | cucumber | `npx cucumber-js features/agent` | yes | green |
| 4-06-01 | 06 | 4 | all | T-04-18 | Phase gate on the combined tree | full suite | `npm run check`; `npm run test:modules`; `npm run test:cucumber` x2 | yes | green |
| 4-06-02 | 06 | 4 | AGT-04, AGT-06 | T-04-17 | pi-subagents report drafted, not filed | doc check | `grep -c 'D-CF4-14' ...04-06-SUMMARY.md && grep -c 'drafted, not filed' ...` | yes | green |
| 4-06-03 | 06 | 4 | — | — | Parent lines collected; parent-owned files untouched | doc check | `grep -c '^## Threat Flags' ...; git diff --quiet ... -- CHANGELOG.md README*.md .planning/BACKLOG.md .fallowrc.json` | yes | green |

*Status: pending · green · red · flaky*

### Requirement coverage

| Requirement | Status | Tests |
|-------------|--------|-------|
| AGT-01 | COVERED | `features/agent/listing.feature` (10 scenarios); `test/bridges/agents/{discover,convert,frontmatter,types}.test.ts`; `test/domain/name.test.ts` |
| AGT-02 | COVERED | `features/agent/invocation.feature` (foreground child, child tools, same-name body); `features/agent/frontmatter.feature` (launch mode, `--map-model` run) |
| AGT-03 | COVERED | `features/agent/frontmatter.feature` (effort, model, tools split, ignored fields); `test/bridges/agents/convert.test.ts` |
| AGT-04 | COVERED (recorded gap D-CF4-10) | `frontmatter.feature` pins `Async: true` for `background: true`; the background run itself is a recorded gap, as the requirement allows |
| AGT-05 | COVERED | `features/agent/companion-missing.feature` (3 scenarios) |
| AGT-06 | COVERED | `features/agent/project-trust.feature` (4 scenarios) |
| AGT-07 | COVERED | `features/agent/lifecycle.feature` (5 scenarios) |
| XK-01 | COVERED | `features/agent/invocation.feature` (preload scenarios); `test/bridges/agents/skill-preload.test.ts` |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements (the Phase 1 cucumber harness, the scripted model, and pi-subagents from the optional-peer cache).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A background (`async: true`) agent run completes | AGT-04 | Recorded gap D-CF4-10: pi-subagents' detached runner aliases `@earendil-works/pi-ai` to `./compat` by prefix, so the frozen scripted model cannot load in a background child; the AGT-04 prohibition forbids shipping a background-run scenario | With a real model provider and pi-subagents 0.84, install a plugin whose agent has `background: true`, run it, and check the wake notice reports completion (see `04-06-SUMMARY.md`, report item 2) |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing)
- [x] No watch-mode flags
- [x] Feedback latency < 4s for the unit quick run (agents unit suite measured at 3.7 s, 554/554)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-01

## Validation Audit 2026-11-01

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
