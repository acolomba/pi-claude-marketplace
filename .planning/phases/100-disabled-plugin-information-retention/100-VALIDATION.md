---
phase: 100
slug: disabled-plugin-information-retention
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-11
---

# Phase 100 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `100-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in), Node >= 20.19.0, TypeScript run natively (no build step) |
| **Config file** | none — `package.json` scripts + `tsconfig.json` (`noEmit`, strict) |
| **Quick run command** | `node --test tests/persistence/state-io.test.ts tests/orchestrators/plugin/enable-disable.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | quick ~30 seconds; full suite several minutes |
| **Fs mocking** | `memfs` (persistence/platform suites); orchestrator suites use real tmpdirs |
| **Byte contract** | `tests/architecture/catalog-uat.test.ts` against `<!-- catalog-state: NAME -->` blocks in `docs/output-catalog.md` |
| **Whole-tree gates** | `tests/orchestrators/reconcile/plan.test.ts` (ENBL-05 drift), `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/no-orchestrator-network.test.ts`, `tests/architecture/notify-closed-set-locks.test.ts` |

---

## Sampling Rate

- **After every task commit:** the narrowest suite the task touches, e.g.
  `node --test tests/persistence/state-io.test.ts` or
  `node --test tests/orchestrators/plugin/enable-disable.test.ts` (each < 30s)
- **After every plan wave:** `npm run typecheck && node --test tests/architecture/ tests/persistence/ tests/orchestrators/plugin/`
  The architecture directory is non-negotiable at wave boundaries — COMPAT-01, the ENBL-05
  drift gate and the catalog gate are the three that fail *late* otherwise.
- **Before `/gsd-verify-work`:** full `npm run check` must be green
- **Max feedback latency:** 30 seconds
- **Byte-fixture rule:** any commit touching `docs/output-catalog.md`'s
  `<!-- catalog-state: … -->` blocks must, in the same commit, touch
  `tests/architecture/catalog-uat.test.ts` — neither direction of the gate may pass on a
  half-landed pair.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this table is the requirement→test contract each task
must satisfy. `File Exists` marks whether the target suite already exists (extend) or is a
Wave 0 gap (create).

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ENBL-10 | New optional key validates; a legacy record without it loads unchanged; no `schemaVersion` bump | unit | `node --test tests/persistence/state-io.test.ts` | ✅ extend (`:472` resolvedSha test is the template) | ⬜ pending |
| ENBL-10 | COMPAT-01 key-set clause amended; `:388` forbidden-name clause still green | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ amend `:342` | ⬜ pending |
| ENBL-10 | Migration performs **no** fill for the new key | unit | `node --test tests/persistence/migrate.test.ts` | ❌ W0 add clause | ⬜ pending |
| ENBL-11 | Persisted payload is the supported subset; entries round-trip to the rendered `hooks:` line byte-identically | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ extend | ⬜ pending |
| ENBL-12 | **Record wins** when the key is present (assert zero disk reads on the hooks path) | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ extend | ⬜ pending |
| ENBL-12 | **Legacy path**: key absent → `readStateOnlyHookEntries` still answers from the materialized file | unit | same | ✅ extend — the regression D-100-03 exists to prevent | ⬜ pending |
| ENBL-12 | Key present but empty renders no `hooks:` line and stamps no reason (`listed`-with-zero ≠ `none` ≠ `degraded`) | unit | same | ❌ W0 | ⬜ pending |
| ENBL-13 | Disable still deletes `hooks.json` and all four other artifact kinds from disk | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:474` (invert the record half, keep the disk half) | ⬜ pending |
| **ENBL-14** | **A disabled plugin with populated `resources.hooks` is NOT hydrated on reload** | unit | `node --test tests/bridges/hooks/…` | ❌ **W0 — the phase's central correctness test** | ⬜ pending |
| ENBL-14 | Guard reads `isRecordedButDisabled`, not a twin spelling | architecture | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ automatic, no new clause | ⬜ pending |
| ENBL-15 | A disabled record with populated `agents`/`mcpServers` renders the byte-identical bare `(disabled)` list row | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| ENBL-16 | A manifest-absent disabled record renders `(disabled) {not in manifest}` and **no other reason** | unit | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts` | ✅ invert `:437` | ⬜ pending |
| ENBL-16 | Same on the info surface | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ W0 | ⬜ pending |
| ENBL-16 | A disabled **partial** carries `{not in manifest}` and not the kind tokens | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ amend `:1069` | ⬜ pending |
| ENBL-17 | Disabled `info` reports description + components | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ❌ W0 | ⬜ pending |
| ENBL-17 | New disabled-info catalog state + byte fixture | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ❌ W0 (fixture **and** catalog block, same commit) | ⬜ pending |
| ENBL-17 | `{already disabled}` fetch-skip survives; `disabled-fetch-skipped` + `mixed-fetch-skipped` still render | architecture | same | ✅ existing fixtures must stay green | ⬜ pending |
| ENBL-17 | The disabled info path still performs **zero** network calls under `--fetch` | unit | `node --test tests/orchestrators/plugin/info-manifest-absent.test.ts` | ✅ extend the `:951+` zero-counter suite to the rerouted disabled arm | ⬜ pending |
| ENBL-17 | Glyph/token stay `◍` / `(disabled)`; SNM-02 19-entry lock green | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ no change expected | ⬜ pending |
| **ENBL-18** | **Disable preserves the inventory exactly** (all five arrays deep-equal the pre-disable record) | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ invert `:397` — **mandatory: the generic constrains only the producer** | ⬜ pending |
| ENBL-18 | Same for a hooks-only plugin | unit | same | ✅ invert `:474` | ⬜ pending |
| ENBL-18 | Producer generic makes an inventory change a compile error | typecheck | `npm run typecheck` | ✅ rewrite `tests/persistence/state-io.test.ts:691` | ⬜ pending |
| ENBL-18 | A disabled+populated record is a legal stored shape (`STATE_VALIDATOR.Check`) | unit | `node --test tests/persistence/state-io.test.ts` | ✅ `:672-688` already does this; input changes | ⬜ pending |
| ENBL-18 | Partial-cascade fold still SHRINKS the record (the fold path bypasses `toDisabledRecord`) | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:1731` stays green unmodified — a failure here signals the fold path was touched by mistake | ⬜ pending |
| **ENBL-19** | **Enable of a disabled plugin owning skills/commands/agents succeeds** (no self-conflict) | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ `:538` + `:618` are existing canaries; add an explicit named test | ⬜ pending |
| ENBL-19 | A *genuine* cross-plugin conflict is still rejected on the enable path | unit | `node --test tests/orchestrators/plugin/shared.test.ts` | ❌ W0 — proves the exclusion did not disable the guard | ⬜ pending |
| INV-04 supersession | REQUIREMENTS.md text amended; no stale test asserts the bare row | docs/unit | `node --test tests/docs/` + the two list suites | ✅ amend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/bridges/hooks/…` — **a disabled record with populated `resources.hooks` is not hydrated** (ENBL-14). No such test exists; check whether an existing `event-router` / hooks-bridge suite already stands up a state fixture and extend it rather than creating a new file.
- [ ] `tests/orchestrators/plugin/list.test.ts` — disabled record with populated `agents`/`mcpServers` renders the bare row (ENBL-15).
- [ ] `tests/orchestrators/plugin/info-manifest-absent.test.ts` — disabled `info` reports description + components (ENBL-17); `{not in manifest}` on the info disabled row (ENBL-16); key-present-but-empty renders no `hooks:` line (ENBL-12).
- [ ] `tests/architecture/catalog-uat.test.ts` + `docs/output-catalog.md` — new disabled-info catalog state and byte fixture (ENBL-17).
- [ ] `tests/orchestrators/plugin/shared.test.ts` — a genuine cross-plugin conflict is still rejected after the exclusion (ENBL-19).
- [ ] `tests/persistence/migrate.test.ts` — legacy record without the new key loads unchanged, no fill (ENBL-10).
- [ ] Framework install: none — `node:test` is built in.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Disabled, manifest-absent plugin renders its retained inventory in a live Pi session after `/reload` | ENBL-17, ENBL-14 | End-to-end reload behavior spans the Pi extension host; the automated suites exercise the orchestrators, not the host lifecycle | Install a plugin, disable it, remove its entry from the marketplace manifest, `/reload`, then run `/claude:plugin info <plugin>` — expect description + components + `(disabled) {not in manifest}`, and confirm the plugin's hooks do not fire |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
