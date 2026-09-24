---
phase: 104
slug: workflow-lifecycle-completion
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-15
validated: 2026-08-16
---

# Phase 104 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none — suites are globbed by `package.json` scripts |
| **Quick run command** | `node --test tests/orchestrators/plugin/<file>.test.ts` plus `npm run typecheck` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~20 seconds per suite, ~3 minutes full |

**Typecheck is an unusually high-yield fast gate for this phase.** Every wiring site here
is a compile error on omission — the closed `Phase3Failure["phase"]` union, the
`dropped` object's sixth key, `resourcesFromHandles` losing a parameter. Run
`npm run typecheck` after every task, not just the suite.

---

## Sampling Rate

- **After every task commit:** the single affected suite file + `npm run typecheck`
- **After every plan wave:**
  `node --test "tests/orchestrators/plugin/*.test.ts" "tests/orchestrators/marketplace/*.test.ts" "tests/bridges/workflows/*.test.ts" tests/architecture/catalog-uat.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts`
- **Before `/gsd-verify-work`:** `npm run check` green, PLUS one hand-run of
  `node tests/live-uat/workflow-storage-canary.mjs` — it sits outside `npm run check` by
  design and is the only surface exercising the real engine's storage layout
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| WLIF-02 | update triad — add + remove + `meta.name` rename over one fixture pair leaves exactly version B's artifacts | integration | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ | ✅ green |
| WLIF-02 | the workflow inventory is reassigned under its own failure guard; a workflows-commit failure leaves the OLD inventory | unit | same | ✅ | ✅ green |
| WLIF-03 | uninstall leaves no envelope, **user** scope | integration | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ | ✅ green |
| WLIF-03 | uninstall leaves no envelope, **project** scope (derived key) | integration | same | ✅ | ✅ green |
| WLIF-03 | `cascadeUnstagePlugin` reports the sixth kind in `dropped` and removes the file | unit | `node --test tests/orchestrators/marketplace/cascade.test.ts` | ✅ | ✅ green |
| WLIF-03 | `marketplace remove --cascade` inherits the sixth unstage | integration | `node --test tests/orchestrators/marketplace/remove.test.ts` | ✅ | ✅ green |
| WLIF-03 | live-engine removal proof, both scopes | manual/live | `node tests/live-uat/workflow-storage-canary.mjs` | ✅ | 🖐 manual (closed 2026-08-16) |
| WLIF-04 | reinstall replaces envelopes; the record names the NEW staged names | integration | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ✅ green |
| WLIF-05 | disable removes envelopes; enable re-materializes them | integration | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ | ✅ green |
| WLIF-05 | enable converges when re-materialization produces a DIFFERENT generated name (the WR-01 gap) | integration | same | ✅ | ✅ green |
| WR-06 | a foreign pre-existing target is refused, not clobbered; a plugin-owned one is replaced | unit | `node --test tests/bridges/workflows/stage.test.ts` | ✅ | ✅ green |
| WLIF-06 | the token renders only when workflows were actually removed | unit | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| WLIF-06 | closed-set membership, order and length | unit | `node --test tests/architecture/compat-01-no-expansion.test.ts tests/architecture/notify-closed-set-locks.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Four of these are enabling work with no behavior of their own — the phase cannot express
its own test cases until they land.

- [x] **`update.test.ts`'s fixture builder cannot express the triad.**
      `seedPathMarketplace` takes a boolean `hasWorkflows?` and writes exactly one file
      with a fixed body. The triad needs the array shape
      `workflows?: { fileName: string; source: string }[]` —
      `install-workflows.test.ts` already has exactly that shape to copy.
- [x] **`makePluginRecord` hardcodes `workflows: []` and ignores the override**, while its
      four sibling fields honor theirs. An update-removal case needs a seeded record
      naming version A's workflows.
- [x] **Extract the hermetic workflow-home helper to `tests/helpers/`.** It currently lives
      only in `install-workflows.test.ts` and is needed by four more suites.
      `sonarjs/no-identical-functions` is an ESLint **error** here, so copying it four
      times will fail the build — extraction is required, not stylistic.
- [x] **~12 `typeof cascadeUnstagePlugin` stub literals** across `uninstall.test.ts`,
      `remove.test.ts` and `cascade.test.ts` need the sixth key in their `dropped` object,
      plus one whole-object `deepEqual` of `outcome.dropped`. These are compile errors, so
      they surface immediately — budget for them rather than being surprised by them.
- [x] No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real engine no longer lists a removed plugin's workflow after `uninstall`, in both scopes | WLIF-03 | The engine is a 0.x package with no exported contract; coupling `npm run check` to it would import upstream churn into every build | `node tests/live-uat/workflow-storage-canary.mjs`. The assertion belongs in `main`'s `try`, in its own removal section — NOT in `teardown`, which runs from a `finally` where a throw would mask a real primary failure |

---

## Validation Sign-Off

- [x] All tasks have automated verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16 — PARTIAL (1 manual-only, closed by hand)

---

## Validation Audit 2026-08-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Manual-only (by design) | 1 |

**Evidence.** All four enabling Wave 0 items landed — the hermetic workflow-home
helper was extracted to `tests/helpers/workflow-home.ts` (the `sonarjs/no-identical-functions`
error made extraction mandatory, and four suites now share it), and no
`typeof cascadeUnstagePlugin` stub is left short of its sixth `dropped` key
(the suite typechecks clean, which is what would have caught it). Spot-checked rows:

- `WLIF-05` — `tests/orchestrators/plugin/enable-disable.test.ts` carries the round
  trip at `:2269`, the differing-generated-name convergence (the WR-01 gap) at `:2341`,
  and an empty-inventory enable at `:2413`
- `WLIF-06` — `tests/architecture/notify-closed-set-locks.test.ts:55` pins
  `DEPENDENCIES` as `["agents","mcp","workflows"]` by order and length
- `WR-06` — `tests/bridges/workflows/stage.test.ts:500` covers replacing a target
  named in the previous list

Gate results at audit time: unit `3698 pass / 0 fail / 1 skipped`, integration
`18 pass / 0 fail`, `npm run typecheck` clean.

**The manual row is closed, not outstanding.** `104-VERIFICATION.md` records the
live-engine removal canary as run by hand against real engine 3.5.1 on 2026-08-16,
negative control included: a mutated copy with one uninstall skipped FAILED as
required, so the canary's PASS carries information. The assertion sits in `main`'s
`try` rather than `teardown`, where a throw from a `finally` would mask a real
primary failure. It stays manual-only because the engine is deliberately in no
dependency manifest.
