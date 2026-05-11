---
phase: 5
slug: plugin-orchestrators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 5 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node ≥22.18 native TS strip) |
| **Config file** | none -- `npm test` invokes `node --test "tests/**/*.test.ts"` |
| **Quick run command** | `npm test -- tests/orchestrators/plugin/<file>.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~30s full suite (current 521 tests) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npm test -- tests/<scope>.test.ts` for the touched file
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> One row per requirement-ID coverage point. Plan-checker will pin individual task IDs to these rows after PLAN.md files are cut. The map is keyed by requirement first, plan/wave second.

| REQ ID | Plan (TBD) | Wave (TBD) | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|--------|------------|------------|-----------------|-----------|-------------------|-------------|--------|
| **PI-1** | install | 2 | 4-phase staging order skills/prompts → agents → MCP → state commit | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-2** | install | 2 | Cached-manifest path (NO network) on install | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-3** | install | 2 | Cross-plugin name conflict pre-write (one batched message) | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-4** | install | 2 | Cross-marketplace agent ownership refusal | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-5** | install | 2 | `dependencies` declarations → manual-install warning | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-6** | shared | 1 | Pre-write conflict guard helper | unit | `npm test -- tests/orchestrators/plugin/shared.test.ts` | ❌ W0 | ⬜ pending |
| **PI-7** | install | 2 | `hash-<12hex>` version derivation when manifest lacks version | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-8** | install | 2 | Phase-1 rollback on phase-2 failure (skills/prompts unstage) | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-9** | install | 2 | Phase-2 rollback on phase-3 failure (agents unstage) | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-10** | install | 2 | Phase-3 rollback on phase-4 failure (mcp unstage) | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-11** | install | 2 | `(rollback partial: [<phase>] <msg>; …)` aggregation | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-12** | install | 2 | State commit is the LAST phase | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-13** | install | 2 | `Run /reload to install "<plugin>"` on success | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-14** | rollback | 0 | `PathContainmentError` bypasses rollback-partial aggregation | unit | `npm test -- tests/transaction/rollback.test.ts` | ❌ W0 | ⬜ pending |
| **PI-15** | install | 2 | Idempotent retry on partial-state install | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PU-1** | uninstall | 2 | Uninstall ordering skills/prompts → agents → MCP → state → data dir | integration | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-2** | uninstall | 2 | Per-plugin data dir removal | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-3** | uninstall | 2 | Concurrent uninstall → silent converge | integration | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-4** | uninstall | 2 | State-commit guard window | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-5** | uninstall | 2 | Silent-converge notification policy (no notify on concurrent) | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-6** | uninstall | 2 | `Run /reload to drop "<plugin>"` only when ≥1 resource removed | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-7** | uninstall | 2 | Loud refusal when foreign content at agent target file | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-8** | uninstall | 2 | Uninstall returns no-op summary when plugin not installed | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-1** | update | 3 | `syncClone` once per marketplace (memoized) | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-2** | update | 3 | Partition `updated`/`unchanged`/`skipped`/`failed` | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-3** | update | 3 | Phase 1: prepare-in-tmp | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-4** | update | 3 | Phase 2: state-guard swap with old-resource snapshot | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-5** | update | 3 | Phase 3a: physical replace + soft-dep commit | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-6** | update | 3 | Phase-3a failures aggregated before phase-3b | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-7** | update | 3 | Phase-3 recovery hint → "run uninstall then install" | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-8** | update | 3 | `updateSinglePlugin: PluginUpdateFn` cascade-safe (never throws) | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-9** | update | 3 | Direct-path `updatePlugins` emits notifyError; cascade path does not | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PL-1** | list | 2 | Top-level `list` shows every bucket grouped by scope | integration | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-2** | list | 2 | Marketplace-filtered `list` shows only that marketplace | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-3** | list | 2 | Each entry: icon (●/○/⊘) + name + `(<version>)` + status | unit | `npm test -- tests/presentation/plugin-list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-4** | list | 2 | Description on second indented line, truncated at column 66 | unit | `npm test -- tests/presentation/plugin-list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-5** | list | 2 | `upgradable` flag iff manifest.version !== install record.version (string compare) | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-6** | list | 2 | Manifest load failure → `[warning] could not load manifest: <reason>` then still render | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-7** | list | 2 | `dim`/`error` severity routing through `ctx.ui.notify` | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **RN-3** | reload-hint | 2 | `appendReloadHint`/`composeReloadHint` semantics | unit | `npm test -- tests/shared/reload-hint.test.ts` | ❌ W0 | ⬜ pending |
| **AS-2** | install/update | 2/3 | Atomic state commit (write-file-atomic) | unit | `npm test -- tests/state/*.test.ts` | ✅ (carry-fwd) | ⬜ pending |
| **AS-3** | install/uninstall/update | 2/3 | Tmp + rename for non-JSON tree commits | unit | `npm test -- tests/transaction/*.test.ts` | ✅ (carry-fwd) | ⬜ pending |
| **AS-6** | uninstall/update | 2/3 | Phase-ordered rollback unstage idempotence | integration | `npm test -- tests/orchestrators/plugin/*.test.ts` | ❌ W0 | ⬜ pending |
| **AS-7** | install/update | 2/3 | Old-resource snapshot captured inside state-guard window | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **NFR-2** | install/uninstall/update | 2/3 | Recovery without restart -- `/reload` suffices | manual | smoke test, see Manual-Only Verifications | n/a | ⬜ pending |
| **NFR-3** | install/uninstall/update | 2/3 | Retry safety: idempotent or fail-clean | integration | `npm test -- tests/orchestrators/plugin/*.test.ts` | ❌ W0 | ⬜ pending |
| **D-07 (COMP-01)** | resolver/bridge | 0 | `componentPaths` array SUPPLEMENT semantics; first-wins on dedup | unit | `npm test -- tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/bridge/discover-*.test.ts` | ✅ (update) | ⬜ pending |
| **D-07 (errors)** | shared/errors | 0 | New error classes: `ComponentPathRefuseError`, `ForeignAgentContentError`, etc. | unit | `npm test -- tests/shared/errors.test.ts` | ✅ (extend) | ⬜ pending |
| **D-07 (markers)** | shared/markers | 0 | New plugin install marker constant | unit | `npm test -- tests/shared/markers.test.ts` | ✅ (extend) | ⬜ pending |
| **D-07 (architecture)** | architecture | 0 | No orchestrator imports network helpers (source-grep test) | architectural | `npm test -- tests/architecture/no-orchestrator-network.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is the foundation slice. It must land before Wave 1 helpers, Wave 2 commands, or Wave 3 update. Concrete deliverables:

- [ ] `src/shared/markers.ts` -- extend with plugin-install marker constant
- [ ] `tests/shared/markers.test.ts` -- extend with new-marker case
- [ ] `src/shared/errors.ts` -- add `ComponentPathRefuseError`, `ForeignAgentContentError`, plus 2 more identified by research
- [ ] `tests/shared/errors.test.ts` -- extend
- [ ] `src/transaction/rollback.ts` -- add `instanceof PathContainmentError` short-circuit (PI-14)
- [ ] `tests/transaction/rollback.test.ts` -- add bypass case
- [ ] `src/domain/resolver.ts` -- `ComponentPathsSchema` array migration (D-07/COMP-01)
- [ ] `src/bridge/skills/discover.ts`, `src/bridge/prompts/discover.ts`, `src/bridge/agents/discover.ts` -- array iteration
- [ ] `tests/domain/resolver-strict.test.ts`, `tests/domain/resolver-loose.test.ts` -- update assertions
- [ ] `tests/bridge/discover-skills.test.ts`, `discover-prompts.test.ts`, `discover-agents.test.ts` -- array fixtures
- [ ] `tests/architecture/no-orchestrator-network.test.ts` -- source-grep architectural assertion (NFR-5 architectural surface)
- [ ] `src/state/types.ts` (if needed) -- manifest-loader helper signature

*Wave 0 lands as one or more PLAN.md files (planner decides cut). All other waves are blocked-by Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `Run /reload` recovery in live Pi process | NFR-2 | Requires running `pi` interactively, observing extension reload, and confirming components register | 1. Install a plugin. 2. Verify `/reload` re-registers extension. 3. Uninstall. 4. Verify `/reload` drops it. Repeat for `update`. |
| Cross-process state-guard contention | PU-3, PUP-4 | Concurrent process spawning is hostile to deterministic test runners | Spawn two `pi` instances, run uninstall in both -- confirm silent-converge in one, success in the other, no state corruption |
| Manifest-load-failure user-facing message format | PL-6 | Visual confirmation of column-66 truncation and `[warning]` prefix rendering in terminal | Run `/claude:plugin list` against a broken-manifest fixture; eyeball indentation and truncation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
