---
phase: 4
slug: marketplace-orchestrators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-10
---

# Phase 4 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Sourced from 04-RESEARCH.md §Validation Architecture (lines 1059-1129).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node ≥22, native TS strip) |
| **Config file** | none -- relies on `node --test` glob in package.json `test` script |
| **Quick run command** | `node --test "tests/orchestrators/marketplace/<file>.test.ts"` |
| **Full suite command** | `npm test` (or `npm run check` for typecheck + lint + format + tests) |
| **Estimated runtime** | ~10s per orchestrator file; ~30-60s full suite (currently 441 tests, Phase 4 adds ~9 files) |

---

## Sampling Rate

- **After every task commit:** `node --test tests/orchestrators/marketplace/<file>.test.ts` (per-orchestrator tests, < 10s)
- **After every plan wave:** `npm test` (full suite; 441 existing + Phase 4 additions)
- **Before `/gsd-verify-work`:** `npm run check` must be green (typecheck + ESLint + Prettier + tests)
- **Max feedback latency:** ~10s per task commit, ~60s per wave merge

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| MA-1 | Source kind dispatch (path/github) | unit | `node --test tests/orchestrators/marketplace/add.test.ts` | ❌ W0 | ⬜ pending |
| MA-2/SC-5 | Default scope = user (orchestrator accepts scope) | unit | same | ❌ W0 | ⬜ pending |
| MA-3 | Local path: directory or `marketplace.json` direct | unit | same | ❌ W0 | ⬜ pending |
| MA-4 | Tilde paths preserved verbatim | unit | `tests/domain/source.test.ts` | ✅ existing | ⬜ pending |
| MA-5 | Clone-then-rename via `gitOps.clone` mock | unit | `add.test.ts` with `makeMockGitOps` | ❌ W0 | ⬜ pending |
| MA-6 | Stale clone refusal | unit | `add.test.ts` | ❌ W0 | ⬜ pending |
| MA-8 | Duplicate name in scope | unit | `add.test.ts` | ❌ W0 | ⬜ pending |
| MA-9 | Manifest read failure → cleanup → leak | unit | `add.test.ts` | ❌ W0 | ⬜ pending |
| MA-10 | SSH/arbitrary URL/`@ref`/browser-paste rejected (orchestrator dispatch) | unit | `tests/domain/source.test.ts` (parser) + `add.test.ts` (dispatch) | ✅/❌ partial | ⬜ pending |
| MA-11 | Success message + NO reload hint | unit | `add.test.ts` snapshot | ❌ W0 | ⬜ pending |
| MR-1 | Cross-scope ambiguity → throw | unit | `tests/orchestrators/marketplace/remove.test.ts` | ❌ W0 | ⬜ pending |
| MR-2/MR-3 | Per-plugin cascade aggregation with chained causes | unit | `tests/orchestrators/marketplace/cascade.test.ts` (primitive in isolation) | ❌ W0 | ⬜ pending |
| MR-4 | ONE aggregated warning notification | unit | `remove.test.ts` with mock `ctx.ui.notify` | ❌ W0 | ⬜ pending |
| MR-5/MR-6/MR-7 | Post-state cleanup ordering + leak aggregation | unit | `remove.test.ts` | ❌ W0 | ⬜ pending |
| MR-8 | Reload hint emitted only when ≥1 resource removed | unit | `remove.test.ts` | ❌ W0 | ⬜ pending |
| ML-1..4 | List rendering by scope; empty case | unit | `tests/orchestrators/marketplace/list.test.ts` + `tests/presentation/marketplace-list.test.ts` | ❌ W0 | ⬜ pending |
| MU-1 | Bare-form refresh + empty silent succeed | unit | `tests/orchestrators/marketplace/update.test.ts` | ❌ W0 | ⬜ pending |
| MU-4 | Manifest persisted before cascade | unit | `update.test.ts` (mocked `pluginUpdate` asserts state.json saved before first call) | ❌ W0 | ⬜ pending |
| MU-5 | Clone advanced + manifest save fails → "Retry the command." | unit | `update.test.ts` | ❌ W0 | ⬜ pending |
| MU-6 | Cascade gated on `autoupdate` flag | unit | `update.test.ts` | ❌ W0 | ⬜ pending |
| MU-7 | Partition rendering order (updated → unchanged → skipped → failed) | unit | `update.test.ts` with `PluginUpdateOutcome` mocks | ❌ W0 | ⬜ pending |
| MU-8 | New manifest entries NOT auto-installed | unit | `update.test.ts` (assert `pluginUpdate` called once per pre-existing state plugin only) | ❌ W0 | ⬜ pending |
| MU-9 | Reload hint + soft-dep warnings composition | unit | `update.test.ts` with mock `ctx.pi.getAllTools` | ❌ W0 | ⬜ pending |
| MAU-1..4 | Single-name + bare-form flips, idempotency, missing/undefined → false | unit | `tests/orchestrators/marketplace/autoupdate.test.ts` | ❌ W0 | ⬜ pending |
| RH-1/RH-2 | Reload hint format + empty-names suppression | unit | `tests/presentation/reload-hint.test.ts` (snapshot vs PRD §6.8) | ❌ W0 | ⬜ pending |
| RH-3/RH-4 | Soft-dep probe matches | unit | `tests/presentation/soft-dep.test.ts` with mock `pi.getAllTools()` | ❌ W0 | ⬜ pending |
| RH-5 | Soft-dep warning BEFORE trailing reload hint | integration | `update.test.ts` and `remove.test.ts` end-to-end notifications | ❌ W0 | ⬜ pending |
| SC-6 | Bare-form list/update/autoupdate enumerate both scopes | unit | per-orchestrator test passing both `userLocations` and `projectLocations` | ❌ W0 | ⬜ pending |
| NFR-5 | Path-source `add`, `list`, `remove`, `autoupdate` MUST NOT touch network | unit | mock `GitOps` asserting no method called for these flows | ❌ W0 | ⬜ pending |
| D-14 | Force-pushed remote → orchestrator follows; SHA-no-longer-exists → MarketplaceUpdateError | unit | `update.test.ts` with `makeMockGitOps` exercising both cases | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan/wave/task IDs are filled in by the planner; per-task entries are added when PLAN.md files land. Above is the requirement → test mapping that planner tasks must reference.*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/marketplace/add.test.ts` -- covers MA-1, MA-5, MA-6, MA-8, MA-9, MA-10, MA-11
- [ ] `tests/orchestrators/marketplace/remove.test.ts` -- covers MR-1..8
- [ ] `tests/orchestrators/marketplace/list.test.ts` -- covers ML-1..4
- [ ] `tests/orchestrators/marketplace/update.test.ts` -- covers MU-1, MU-4..9, D-14
- [ ] `tests/orchestrators/marketplace/autoupdate.test.ts` -- covers MAU-1..4
- [ ] `tests/orchestrators/marketplace/cascade.test.ts` -- covers `cascadeUnstagePlugin` primitive in isolation (Phase 5 reuse surface)
- [ ] `tests/presentation/reload-hint.test.ts` -- covers RH-1, RH-2 (PRD-snapshot via `tests/helpers/prd-extract.ts` extended with RH-2 row literals)
- [ ] `tests/presentation/soft-dep.test.ts` -- covers RH-3, RH-4 (mock `pi.getAllTools()`)
- [ ] `tests/presentation/marketplace-list.test.ts` -- covers ML-1..2 byte-equality of one-line format
- [ ] `tests/helpers/git-mock.ts` -- `makeMockGitOps(state)` factory: stored-ref bookkeeping, `forceUpdateRef`/`checkout`/`resolveRef`/`clone` (assert dir + url; copy fixture into dir). Used by `add.test.ts` and `update.test.ts`.
- [ ] `tests/fixtures/marketplaces/<name>/.claude-plugin/marketplace.json` -- in-process fixture clones (no real network)
- [ ] `tests/orchestrators/marketplace/_fixtures/` -- mirrors Phase 3 `tests/bridges/_fixtures/` precedent

*All Wave 0 items are NEW. Phase 4 adds approximately 9 new test files plus a helper. Phase 1-3 produced 441 tests; Phase 4 expansion is purely additive -- no edits to existing tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live GitHub clone of `anthropics/claude-plugins-official` end-to-end | MA-5 (real network path) | Requires real network + GitHub HTTPS port 443; D-12 mandates offline tests in CI | Deferred to Phase 7 (live e2e). Phase 4 ships hermetic via `makeMockGitOps`. |
| Real `/reload` flow validates reload-hint correctness in a Pi session | RH-1..5 | Requires running Pi with the extension loaded; out of scope for unit tests | Document in 04-SUMMARY.md as "manual verification deferred to user-acceptance"; covered by integration test that asserts notify-call ordering. |

*All other phase behaviors have automated verification via the test map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner enforces)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references in the per-task map (12 items above)
- [ ] No watch-mode flags (`node --test` runs once per invocation)
- [ ] Feedback latency < 60s for full suite, < 10s for per-task
- [ ] `nyquist_compliant: true` set in frontmatter (after planner closes Wave 0 + per-task references)

**Approval:** pending
