---
phase: 101
slug: workflow-component-kind-recognition
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-14
validated: 2026-08-16
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node 22.22.2 built-in) |
| **Config file** | none — the runner is configured entirely by the `package.json` script glob |
| **Quick run command** | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` |
| **Full suite command** | `npm run check` (typecheck → lint → format:check → test → test:integration) |
| **Estimated runtime** | ~15 seconds quick, ~4 minutes full |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts && npm run typecheck`
- **After every plan wave:** Run `npm run test` (the full unit glob, including every architecture gate)
- **Before `/gsd-verify-work`:** `npm run check` green, then `pre-commit run --all-files` (CI runs `--all-files`; a scoped run hides pre-existing violations)
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | SC 3 (info) | — | N/A | catalog byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-01 | — | N/A | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-02 | — | Declared path escaping `pluginRoot` is refused at the containment chokepoint (parity with skills) | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-02 | — | N/A | unit | `node --test tests/domain/resolver-loose.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-03 | — | N/A | unit | `node --test tests/domain/resolver-strict.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-04 | — | N/A | architecture | `node --test tests/architecture/hooks-foundation.test.ts` | ✅ | ✅ green |
| TBD | TBD | 1 | WFLW-04 | — | N/A | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ | ✅ green |
| TBD | TBD | 2 | SC 3 (info) | — | N/A | catalog byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ✅ green |
| TBD | TBD | 2 | Boundary move | — | N/A | integration | `node --test tests/orchestrators/reconcile/backfill.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs are filled in by the planner; the requirement→command mapping above is the binding contract.*

---

## Requirement Coverage Detail

| Req ID | Behavior | Test Type |
|--------|----------|-----------|
| WFLW-01 | convention-only `workflows/`, no manifest field → `supported` includes `workflows`, `componentPaths.workflows === ["workflows"]` **(PRIMARY — 16 of 16 sampled real plugins ship this shape)** | unit |
| WFLW-01 | empty `workflows/` dir still admits the kind | unit |
| WFLW-02 | manifest declares `workflows: "wf"` (string form) → resolved | unit |
| WFLW-02 | manifest declares `workflows: ["a","b"]` (array form) → both resolved, first-wins dedup | unit |
| WFLW-02 | declared path that does not exist → accepted, **no note**, still `installable` | unit |
| WFLW-02 | declared path escaping `pluginRoot` → note + `unavailable` (parity with skills) | unit |
| WFLW-02 | declared path + convention dir → union, declared first (`["custom", "workflows"]`) | unit |
| WFLW-02 | loose mode: entry-declared resolves; manifest-only → `component declarations conflict`; convention dir alone → **not** admitted | unit |
| WFLW-03 | a workflows-only plugin resolves with `supported` non-empty — the zero-signal regression this phase closes | unit |
| WFLW-03 | `compatibility.supported` records `"workflows"` after install — the state-level satisfaction of SC 3's `list` half (no `list` bytes change this phase; the rendered `list` signal is the Phase 105 degradation token) | unit/integration |
| WFLW-04 | `SUPPORTED_COMPONENT_KINDS` equals the 5-tuple in order | architecture |
| WFLW-04 | COMPAT-01 no-expansion contract still passes with **zero** edits | architecture |
| SC 3 (info) | `info` renders `    workflows: <stem>, <stem>` in the six-kind alphabetical order | catalog byte-equality |
| Boundary move | an `installable: false` record whose supported set grows by `workflows` backfills once; an `installable: true` one does not | integration |

---

## Wave 0 Requirements

- [x] `docs/output-catalog.md` — a `<!-- catalog-state: … -->` block under `## /claude:plugin info <plugin>@<marketplace>` showing the `workflows:` line (covers SC 3, info half)
- [x] `tests/architecture/catalog-uat.test.ts` — the paired `FIXTURES` entry; the gate walks in both directions and fails without both halves

No framework install is needed. No new test file is created (locked CONTEXT.md decision — new cases extend existing files).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification. This phase is offline by construction (the resolver is network-free, NFR-5) and touches no interactive surface.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (the two catalog halves)
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-08-16

---

## Validation Audit 2026-08-16

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Evidence.** Every automated command named above resolves to a file that exists,
and every requirement ID in the coverage detail table is carried by at least one
test that names it:

- `WFLW-01`/`WFLW-02`/`WFLW-03` — `tests/domain/resolver-strict.test.ts`, `tests/domain/resolver-loose.test.ts`
- `WFLW-04` — `tests/architecture/hooks-foundation.test.ts:199` locks
  `SUPPORTED_COMPONENT_KINDS` as `[skills, commands, agents, hooks, workflows]`
  by shape and order; `tests/architecture/compat-01-no-expansion.test.ts` passes unedited
- `SC 3 (info)` — the Wave 0 catalog pair landed: `docs/output-catalog.md` carries
  `installed-single-scope-with-workflows` and `state-only-installed-with-workflows`,
  byte-paired against `tests/architecture/catalog-uat.test.ts`
- Boundary move — `tests/orchestrators/reconcile/backfill.test.ts:458` drives the
  grown-supported-set re-materialization case

Gate results at audit time: unit `3698 pass / 0 fail / 1 skipped`, integration
`18 pass / 0 fail`, `npm run typecheck` clean. The Manual-Only table is empty, so
this phase is fully Nyquist-compliant.
