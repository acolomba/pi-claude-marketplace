---
phase: 104
slug: pre-install-read-surfaces
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-15
---

# Phase 104 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict` |
| **Config file** | none — `package.json` `test` script carries the glob |
| **Quick run command** | `node --test "tests/orchestrators/plugin/{list,info}.test.ts" "tests/architecture/catalog-uat.test.ts"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~11 seconds quick / ~44 seconds full (3518 tests), measured |

Full gate: `npm run check` = typecheck + lint + format:check + test + test:integration.

---

## Sampling Rate

- **After every task commit:** Run the quick run command (~11s)
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must exit 0
- **Max feedback latency:** 11 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed by requirement and
behavior so the planner can attach each row to the task that delivers it.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| OUT-02 | `list` renders `{installs disabled}` on an `(available)` row whose entry declares `false` | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ | ✅ green |
| OUT-02 | `list` renders it on a cold `(remote)` row | unit | same | ✅ | ✅ green |
| OUT-02 | `list` renders it appended on a `(partially-available)` row | unit | same | ✅ | ✅ green |
| OUT-02 | `list` does NOT render it on either `(unavailable)` arm | unit | same | ✅ | ✅ green |
| OUT-03 | `info` renders it on `(available)`, cold `(remote)` and `(partially-available)` | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ | ✅ green |
| OUT-02 / OUT-03 | byte form matches the documented catalog blocks | contract | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| OUT-05 | no gitOps surface in `list.ts` / `info.ts` / `domain/resolver.ts` | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ `domain/resolver.ts` added to `FORBIDDEN_TARGETS` | ✅ green |
| OUT-05 | cold `(remote)` row carries the token with NO clone materialized | unit (behavioral) | `node --test tests/orchestrators/plugin/list.test.ts` | ✅| ✅ green |
| OUT-05 crit. 4 | entry silent + warm `plugin.json` declares `false` → row is BARE | unit | both files | ✅| ✅ green |
| DFEN-08 | `defaultEnabled: true` and absent render byte-identically to today | regression | `npm test` | ✅ every existing list/info/catalog assertion IS this test | ✅ green |
| crit. 5 | an installed / disabled / partially-installed row never acquires the token | unit | both files | ✅| ✅ green |

The criterion-4 row is called out as highest-value deliberately: it is the only
test that fails if a later change "fixes" the deliberate entry-only divergence
into a `plugin.json` read.

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new framework, no new
fixture file, no shared-fixture module is needed. Verified against the harnesses
the phase consumes:

- `withHermeticHome` + `seedMarketplace` (`tests/orchestrators/plugin/list.test.ts`)
  — takes an arbitrary `manifest` object, so a `defaultEnabled: false` entry needs
  no helper change.
- `stageWarmMirror` (same file) — supplies the warm-clone criterion-4 case.
- `makeCtx()` (same file) — captures message + severity.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

One caveat carried from research, recorded here so the new offline test does not
inherit the defect: the EXISTING offline guard in
`tests/orchestrators/plugin/list.test.ts` (~`:2593-2601`) is **vacuous** — it calls
`readFile` on a directory, which always throws `EISDIR`, so its boolean is always
`false`; and it runs BEFORE the call it means to constrain. The new OUT-05
behavioral test must use `stat`/`access` and must assert AFTER `listPlugins`
returns. Repairing the pre-existing guard is out of this phase's scope
(surgical-changes rule) and is captured in the backlog.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 11s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-15

## Validation Audit 2026-08-15

Reconciled at milestone close. Every row's test was written during the phase and
is green; the file was seeded at planning time and never promoted out of `draft`.

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

One row deserves its own note. The plan's OUT-05 offline check was written as a
CORRECT guard — `stat`/`access` asserted AFTER the call — rather than cloning the
pre-existing sibling, which `readFile`s a directory and can therefore never fail.
That hollow guard was deleted in the following phase. Evidence: full suite green
at the close (3553 tests, 3552 pass, 0 fail, 1 pre-existing skip).
