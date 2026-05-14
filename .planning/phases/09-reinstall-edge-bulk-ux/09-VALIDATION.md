---
phase: 9
slug: reinstall-edge-bulk-ux
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-14
---

# Phase 9 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                      |
| ---------------------- | ------------------------------------------ |
| **Framework**          | Node built-in test runner (`node --test`)  |
| **Config file**        | `package.json` scripts / `tsconfig.json`   |
| **Quick run command**  | `node --test <focused test files>`         |
| **Full suite command** | `npm run check`                            |
| **Estimated runtime**  | ~20-90 seconds depending on suite breadth  |

---

## Sampling Rate

- **After every task commit:** Run the task's focused `node --test ...` command.
- **After every plan wave:** Run the focused phase suite plus `npm run typecheck`.
- **Before `/gsd-verify-work`:** `npm run check` must be green.
- **Max feedback latency:** 90 seconds for full-suite feedback; focused tests should run sooner.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
| ------- | ---- | ---- | ----------- | --------- | ----------------- | ----------- | ------ |
| 9-01-01 | 01 | 1 | PRL-03, PRL-04, PRL-05, PRL-13, PRL-14 | orchestrator | `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts` | ✅ existing | ⬜ pending |
| 9-02-01 | 02 | 2 | PRL-01, PRL-03, PRL-04, PRL-14 | edge/router | `node --test tests/edge/handlers/plugin/reinstall.test.ts tests/edge/router.test.ts tests/edge/register.test.ts` | ❌ handler test may need creation | ⬜ pending |
| 9-03-01 | 03 | 2 | PRL-15, PRL-16 | completions | `node --test tests/edge/completions/provider.test.ts` | ✅ existing | ⬜ pending |
| 9-04-01 | 04 | 3 | PRL-01, PRL-13, PRL-14 | docs/static/full | `node --test tests/architecture/no-orchestrator-network.test.ts && npm run typecheck && npm run check` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the phase requirements. Add missing focused test files inside implementation tasks as needed:

- [ ] `tests/edge/handlers/plugin/reinstall.test.ts` - handler parsing, `--scope`, `--force`, invalid forms, and no-mutation usage failures.
- [ ] Extend `tests/orchestrators/plugin/reinstall.test.ts` - batch target forms, continuation, deterministic partitions, reload hints, and soft-dependency aggregation.
- [ ] Extend `tests/edge/completions/provider.test.ts` - top-level `reinstall`, installed refs, `@marketplace`, `--force`, trailing spaces, soft-fail/state-error behavior.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Manual smoke can still be useful after implementation:

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| Real Pi command UX | PRL-01, PRL-13, PRL-14 | Confirms final notification text in host UI | Install a fixture plugin, run `/claude:plugin reinstall ...`, verify summary/reload/warning text. |
| Real tab completion UX | PRL-15, PRL-16 | Confirms TUI rendering of trailing-space completions | In Pi, type `/claude:plugin rei<TAB>` and `/claude:plugin reinstall <TAB>`. |

---

## Validation Categories

1. **Focused orchestrator batch tests**
   - Target forms: all, marketplace, plugin.
   - Scope: explicit `user`/`project`, implicit ambiguity, implicit not found.
   - Empty state: `No plugins installed.` and no reload hint.
   - Continuation: one failed plugin and one successful plugin in the same batch; old resources/data preserved for the failed plugin and success committed for the other plugin.
   - Determinism: shuffled state insertion order still renders stable section/item order.
   - Reload/soft-dependency aggregation: only successful changed outcomes trigger `refresh`; agents/MCP warnings aggregate once.
   - Command: `node --test tests/orchestrators/plugin/reinstall.test.ts tests/architecture/no-orchestrator-network.test.ts`

2. **Edge handler tests**
   - Bare args map to `{ kind: "all" }`.
   - `@mp` maps to marketplace target.
   - `plugin@mp` maps to plugin target.
   - `--scope` works before, between, and after args.
   - `--force` works before/after ref and passes to the orchestrator/core.
   - Invalid ref, unknown long flag, extra positionals, and missing `--scope` value emit usage/error without mutation.
   - Command: `node --test tests/edge/handlers/plugin/reinstall.test.ts`

3. **Router/register tests**
   - `TOP_LEVEL_USAGE` includes reinstall syntax.
   - `routeClaudePlugin("reinstall ...")` dispatches to `handlers.reinstall`.
   - Registered command completions include `reinstall`.
   - Command: `node --test tests/edge/router.test.ts tests/edge/register.test.ts`

4. **Completion tests**
   - Top-level `rei` completes to `reinstall `.
   - `reinstall ` completes installed refs only.
   - `reinstall @` completes marketplace-only form.
   - `reinstall --force ` still completes refs.
   - Terminal completions include trailing spaces; multi-marketplace plugin half `name@` does not.
   - Existing per-marketplace manifest soft-fail and top-level state-error tests still pass.
   - Command: `node --test tests/edge/completions/provider.test.ts`

5. **Docs/static/no-network validation**
   - `README.md` contains reinstall syntax and semantic notes.
   - Architecture guard proves no Git/network surface in reinstall orchestrator after bulk additions.
   - Commands:
     - `node --test tests/architecture/no-orchestrator-network.test.ts`
     - `npm run typecheck`
     - `npm run check`

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
