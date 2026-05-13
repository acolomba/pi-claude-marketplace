---
phase: 2
slug: domain-core-persistence-primitives
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-09
populated: 2026-05-10
---

# Phase 2 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, native TS strip on Node >=22.18) |
| **Config file** | none -- relies on `tsconfig.json` and Node's native loader |
| **Quick run command** | `node --test tests/<dir>/<file>.test.ts` (per-task targeted run) |
| **Full suite command** | `npm run check` (typecheck + lint + format + tests) |
| **Estimated runtime** | ~30-60 seconds (Phase 2 is pure-foundation; tests are fast) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (per the per-task map below)
- **After every plan wave:** Run `npm run check` (full quality gate per NFR-6)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Populated from PLAN.md frontmatter and `<automated>` blocks. File-Exists column is "W0" for tasks blocked on Wave 0 directory scaffolding.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SP-1..7, NFR-12, MM-4 | T-02-01 (parser injection) | Reject browser-paste `/tree/<ref>` and `git@` forms | type | `npm run typecheck` | W0 | pending |
| 02-01-02 | 01 | 1 | SP-1..7, NFR-12, MM-4 | T-02-01 | Pure parser; no I/O; verbatim raw preserved | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-01-03 | 01 | 1 | SP-1..7, SC-1, NFR-12, MM-4 | T-02-01 | Table-driven PRD §6.1 fixtures (~14 strict + ~12 loose) | unit (table) | `node --test tests/domain/source.test.ts` | W0 | pending |
| 02-02-01 | 02 | 1 | MM-1 | T-02-02 (schema bypass) | TypeBox plugin schema with literal-tagged union (no `discriminator` option) | type | `npm run typecheck` | W0 | pending |
| 02-02-02 | 02 | 1 | MM-1, MM-2 | T-02-02 | TypeBox MCP component schema | type | `npm run typecheck` | W0 | pending |
| 02-02-03 | 02 | 1 | MM-1, MM-2 | T-02-02 | Top-level marketplace manifest; `Type.Cyclic`/`Type.Module` (NOT `Type.Recursive`) | type | `npm run typecheck` | W0 | pending |
| 02-02-04 | 02 | 1 | MM-1, MM-2 | T-02-02 | TypeBox JIT validator integration tests | unit | `node --test tests/domain/manifest.test.ts` | W0 | pending |
| 02-03-01 | 03 | 1 | RN-1 | T-02-03 (hash collision) | `assertSafeName` rejects path-traversal characters | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-03-02 | 03 | 1 | RN-1, RN-2 | T-02-03 | Generator functions for skill/command/agent names | unit | `node --test tests/domain/name.test.ts` | W0 | pending |
| 02-03-03 | 03 | 1 | RN-2 | T-02-03 | SHA-256 -> 12 hex; `path.posix.join` for cross-OS reproducibility | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-03-04 | 03 | 1 | RN-2 (PI-7 helper) | T-02-03 | Snapshot test (PI-7 SC-5 verifier); `Object.freeze`d HASH_WALK_SKIP | snapshot | `node --test tests/domain/version.test.ts` | W0 | pending |
| 02-04-01 | 04 | 2 | ST-1..6 | T-02-04 (containment) | `ScopedLocations` brand symbol; per-scope independence (D-10) | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-04-02 | 04 | 2 | SC-2, SC-7, ST-1..6 | T-02-04 | Pure load/save; `atomicWriteJson`; ENOENT -> DEFAULT_STATE | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-04-03 | 04 | 2 | SC-3, ST-4..6 | T-02-04 | Single sanctioned `console.warn` (IL-3); legacy migration | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-04-04 | 04 | 2 | ST-1..6 | T-02-04 | Locations brand round-trip | unit | `node --test tests/persistence/locations.test.ts` | W0 | pending |
| 02-04-05 | 04 | 2 | SC-2, SC-3, SC-7, ST-1..6 | T-02-04 | Legacy state.json round-trip + IL-3 console.warn assertion (SC-4 verifier) | unit (fixture) | `node --test tests/persistence/state-io.test.ts tests/persistence/migrate.test.ts` | W0 | pending |
| 02-05-01 | 05 | 2 | NFR-7, MM-3..7, PR-1..6 | T-02-05 (resolution drift) | `Installable \| NotInstallable` literal-tagged discriminated union; injectable I/O hooks | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-05-02 | 05 | 2 | NFR-7, SC-4 | T-02-05 | `// @ts-expect-error` directives prove type narrowing (SC-1 verifier) | type | `npm run typecheck && node --test tests/domain/resolver.types.test.ts` | W0 | pending |
| 02-05-03 | 05 | 2 | PR-1..6 | T-02-05 | Strict-mode resolver: 9 non-installable cases | unit | `node --test tests/domain/resolver-strict.test.ts` | W0 | pending |
| 02-05-04 | 05 | 2 | PR-1..6, MM-3..7 | T-02-05 | Loose-mode resolver: forward-compat handling | unit | `node --test tests/domain/resolver-loose.test.ts` | W0 | pending |
| 02-06-01 | 06 | 3 | ST-7..9 | T-02-06 (rollback divergence) | Phase ledger types + closing-summary line format | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-06-02 | 06 | 3 | ST-7..9 | T-02-06 | Rollback marker assembly (D-03 owns marker) | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-06-03 | 06 | 3 | ST-7..9 | T-02-06 | `withStateGuard` intra-process queue + `runPhases` composition | type+lint | `npm run typecheck && npm run lint` | W0 | pending |
| 02-06-04 | 06 | 3 | ST-7..9 | T-02-06 | Closing summary snapshot; per-attempt JSONL schema | snapshot+unit | `node --test tests/transaction/phase-ledger.test.ts` | W0 | pending |
| 02-06-05 | 06 | 3 | ST-7..9 | T-02-06 | `(rollback partial: ...)` marker emission test | unit | `node --test tests/transaction/rollback.test.ts` | W0 | pending |
| 02-06-06 | 06 | 3 | ST-7..9 | T-02-06 | In-process concurrent install round-trip (SC-3 verifier) | unit (concurrent) | `node --test tests/transaction/with-state-guard.test.ts` | W0 | pending |

*Status: pending -> green -> red -> flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/` -- directory exists; covers all domain tests (source, manifest, plugin/mcp components, name, version, resolver, resolver-strict, resolver-loose, resolver.types)
- [ ] `tests/persistence/` -- directory exists; covers `locations.test.ts`, `state-io.test.ts`, `migrate.test.ts`
- [ ] `tests/transaction/` -- directory exists; covers `phase-ledger.test.ts`, `rollback.test.ts`, `with-state-guard.test.ts`
- [ ] Legacy fixture files for `02-04-05` (state-io migration round-trip): three pre-migration `state.json` snapshots

*node:test + native TS strip is already installed (Phase 1) -- no framework install required.*

---

## Test Type Catalog (from RESEARCH.md §Validation Architecture)

| Test Type | Pattern | Phase 2 Examples |
|-----------|---------|------------------|
| **Pure-function unit tests** | `node --test tests/<dir>/<file>.test.ts` | parsePluginSource, composeGuards, plugin@marketplace key formatter |
| **Type-level tests** | `// @ts-expect-error` blocks + `Equal<>` helpers | NFR-7: reading `pluginRoot` from `NotInstallable` must fail typecheck (02-05-02) |
| **Snapshot tests** | `t.assert.snapshot()` (node:test stable since 23.4) | PI-7: SHA-256 -> 12-hex (02-03-04); ledger closing summary line format (02-06-04) |
| **Table-driven tests** | Loop over fixture array; one assertion per row | PRD §6.1 accept/reject patterns (02-01-03: ~14 strict + ~12 loose cases) |
| **Concurrent simulation** | Two parallel `await` callers in one process | SC-3 in-process install round-trip (02-06-06) |
| **Fixture round-trip** | Read pre-migration JSON, run loader, assert normalized shape | SC-4 legacy state.json migration (02-04-05) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|

*All Phase 2 behaviors are pure functions or pure data -- automated verification covers everything. No manual UAT needed for this phase (foundational layer; UAT begins at Phase 3 install/uninstall flows).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has one)
- [x] Wave 0 covers all MISSING references (test directory scaffolding + legacy fixtures)
- [x] No watch-mode flags (CI-safe; no `--watch`)
- [x] Feedback latency < 60s (typecheck + per-file node --test runs)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-10 (orchestrator-populated from PLAN.md frontmatter)
