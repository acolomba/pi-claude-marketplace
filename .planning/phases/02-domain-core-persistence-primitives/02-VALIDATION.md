---
phase: 2
slug: domain-core-persistence-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 2 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, native TS strip on Node ≥22.18) |
| **Config file** | none -- relies on `tsconfig.json` and Node's native loader |
| **Quick run command** | `npm test -- --test-name-pattern '<scope>'` (per-task targeted run) |
| **Full suite command** | `npm run check` (typecheck + lint + format + tests) |
| **Estimated runtime** | ~30-60 seconds (Phase 2 is pure-foundation; tests are fast) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` for the touched module's test file (`tests/{domain,persistence,transaction,sources}/<module>.test.ts`)
- **After every plan wave:** Run `npm run check` (full quality gate per NFR-6)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled by gsd-planner during PLAN.md generation. Each task in PLAN.md must include `<acceptance_criteria>` and an `<automated>` verify command (typically `npm test -- <test-file>`). Tasks with no automated verify must declare a Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be populated by planner_ | -- | -- | -- | -- | -- | -- | -- | -- | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/` -- directory exists; one test file per `domain/components/*.ts` schema
- [ ] `tests/persistence/` -- directory exists; `state-io.test.ts` covers legacy migration round-trips
- [ ] `tests/transaction/` -- directory exists; `phase-ledger.test.ts`, `state-guard.test.ts`, `compose-guards.test.ts`
- [ ] `tests/sources/` -- directory exists; `parse-source.test.ts` covers PRD §6.1 accept/reject fixtures
- [ ] `tests/plugin/` -- directory exists; `resolve.test.ts` covers PR-2's nine non-installable cases + the `// @ts-expect-error` discriminated-union test (NFR-7)
- [ ] `tests/shared/` -- directory exists; hash stability snapshot test (PI-7)

*node:test + native TS strip is already installed (Phase 1) -- no framework install required.*

---

## Test Type Catalog (from RESEARCH.md §Validation Architecture)

| Test Type | Pattern | Phase 2 Examples |
|-----------|---------|------------------|
| **Pure-function unit tests** | `node --test tests/<dir>/<file>.test.ts` | parseSource, composeGuards, plugin@marketplace key formatter |
| **Type-level tests** | `// @ts-expect-error` blocks + `Equal<>` helpers | NFR-7: reading `pluginRoot` from `NotInstallable` must fail typecheck |
| **Snapshot tests** | `t.assert.snapshot()` (node:test stable since 23.4) | PI-7: SHA-256 hash → 12-hex; ledger closing summary line format |
| **Table-driven tests** | Loop over fixture array; one assertion per row | PRD §6.1 accept/reject patterns (~14 strict + ~12 loose cases) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

*All Phase 2 behaviors are pure functions or pure data -- automated verification covers everything. No manual UAT needed for this phase (foundational layer; UAT begins at Phase 3 install/uninstall flows).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (test directory scaffolding)
- [ ] No watch-mode flags (CI-safe)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter once planner-populated map is reviewed

**Approval:** pending
