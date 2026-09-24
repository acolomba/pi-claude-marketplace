---
phase: "3"
slug: "dependency-resolution"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-14"
validated: "2026-09-16"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in test runner) |
| **Config file** | none — plain `node --test` over `tests/**/*.test.ts` |
| **Quick run command** | `node --test <specific test file(s)>` |
| **Full suite command** | `npm test` (unit) + `npm run test:integration` |
| **Estimated runtime** | seconds for a targeted file; minutes for the full suite |

---

## Sampling Rate

- **After every task commit:** Run the task's own `<automated>` command(s) — direct-owner
  test file(s) for the module(s) that task touched.
- **After every plan wave:** Run the full `npm test` unit suite.
- **Before `/gsd-verify-work`:** `npm run check` (typecheck + lint + fallow + format:check +
  unit + integration) must be green.
- **Max feedback latency:** under 60 seconds for a single targeted test file.

---

## Per-Task Verification Map

*Filled by validate-phase on 2026-09-16 from each PLAN.md task's `<verify><automated>`
entries, cross-referenced against the SUMMARY.md verification records and the
`03-SECURITY.md` threat register. The first automated command per task is the
direct-owner test; secondary commands (architecture gates, `npm run check`) are noted.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | RESV-01, RESV-02, RESV-06 | T-03-02 / T-03-05 | A dependency naming an unadded marketplace fails the cascade; a failed cascade never reaches `tx.save()` | tracer / unit | `node --test tests/domain/dependency-closure.test.ts tests/orchestrators/plugin/install-cascade.test.ts` (+ `no-orchestrator-network`, `import-boundaries` gates) | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | RESV-01 | — | Cascade-installed dependency survives `/reload` (config write-back + reconcile) | unit | `node --test tests/orchestrators/plugin/shared.test.ts tests/orchestrators/plugin/install-flow.test.ts tests/persistence/config-write-back.test.ts` (+ `reconcile/plan.test.ts`) | ✅ | ✅ green |
| 03-01-03 | 01 | 1 | RESV-04, RESV-05, RESV-06 | T-03-01 / T-03-03 / T-03-04 | Cycle terminates with a reported chain; keys pass the token allowlist; rollback cannot reach an already-installed member | unit | `node --test tests/domain/dependency-closure.test.ts tests/orchestrators/plugin/install-cascade.test.ts` (+ `test:coverage:direct` on `dependency-closure.ts`) | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | RESV-03 | T-03-SC | `semver` and `@types/semver` declared and lockfile-pinned; no telemetry dep enters | unit / script | `node -e "...package.json semver declared..."` + `node --test tests/architecture/no-telemetry-deps.test.ts` | ✅ | ✅ green |
| 03-02-02 | 02 | 2 | RESV-03 | T-03-07 / T-03-08 / T-03-09 | Input-char and conjunct caps fail closed before allocation; rendered range is bounded; disjoint pairs fail as a conflict | unit | `node --test tests/domain/dependency-range.test.ts` (+ `test:coverage:direct` on `dependency-range.ts`) | ✅ | ✅ green |
| 03-03-01 | 03 | 2 | RESV-03 | T-03-10 / T-03-12 | D-03-03 network carve-out is stated in both constraint files | docs / grep | `grep -c 'D-03-03' .planning/PROJECT.md CLAUDE.md` + `node --test tests/architecture/import-boundaries.test.ts` | ✅ | ✅ green |
| 03-03-02 | 03 | 2 | RESV-03 | T-03-11 | User docs state no marketplace is added or cloned to satisfy a dependency | docs / grep | `test -s docs/dependency-resolution.md && grep -c 'docs/dependency-resolution.md' README.md` | ✅ | ✅ green |
| 03-04-01 | 04 | 3 | RESV-03 | T-03-14 | Tag listing is a structured `listServerRefs` call — no shell, no argument vector | unit | `node --test tests/platform/git.test.ts` (+ `test:coverage:direct` on `platform/git.ts`) | ✅ | ✅ green |
| 03-04-02 | 04 | 3 | RESV-03 | T-03-18 | Human decision checkpoint (`blocking-human`) — see Manual-Only | checkpoint | N/A — answered `proceed-as-decided` (03-04-SUMMARY.md) | N/A | ✅ answered |
| 03-04-03 | 04 | 3 | RESV-03 | T-03-13 / T-03-15 / T-03-16 / T-03-17 | Only own-prefix tags are candidates with no head fallback; per-URL memo; no credential on any arm; install owners stay network-free | unit | `node --test tests/orchestrators/plugin/dependency-tag-probe.test.ts` (+ `no-orchestrator-network`, `no-credential-leak`, `import-boundaries` gates) | ✅ | ✅ green |
| 03-05-01 | 05 | 4 | RESV-03 | T-03-19 / T-03-20 / T-03-22 / T-03-23 | Intersection verdict precedes any query; re-pin source comes from the marketplace entry only; failure arms carry bounded ranges and no paths; accumulator is graph-scoped | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` (+ `no-orchestrator-network`, `import-boundaries` gates) | ✅ | ✅ green |
| 03-05-02 | 05 | 4 | RESV-03, RESV-05 | T-03-21 / T-03-24 | An already-installed member is checked, never re-materialized; an unsatisfied constraint fails the install | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts tests/domain/dependency-range.test.ts` (+ `test:coverage:direct` on `install-cascade.ts`) | ✅ | ✅ green |
| 03-06-01 | 06 | 5 | RESV-06 | T-03-27 | Reason vocabulary grows only by pinned-enumeration amendment with a catalog row | unit / gate | `node --test tests/shared/notification-types.test.ts tests/shared/notification-grammar.test.ts` (+ `compat-01-no-expansion`, `catalog-contract` gates) | ✅ | ✅ green |
| 03-06-02 | 06 | 5 | RESV-01, RESV-03, RESV-04, RESV-06 | T-03-25 / T-03-26 / T-03-28 | Rows interpolate only allowlisted keys, bounded ranges, and closed-set reasons; all output goes through the single dispatch surface | unit | `node --test tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/orchestrators/plugin/install-flow.test.ts` (+ `test:coverage:direct` on `install-cascade.messaging.ts`) | ✅ | ✅ green |
| 03-07-01 | 07 | 2 | RESV-01, RESV-02 | T-03-29 / T-03-30 / T-03-31 / T-03-32 | Root derivation goes through the containment chokepoint; stat precedes read; unusable manifest falls back to the entry; no materializing path | unit | `node --test tests/orchestrators/plugin/dependency-declaration-read.test.ts` (+ `test:coverage:direct` on `dependency-declaration-read.ts`) | ✅ | ✅ green |
| 03-07-02 | 07 | 2 | RESV-01, RESV-02 | T-03-32 | Cascade reads the plugin's own manifest first; `install-flow.ts` stays in `NETWORK_FREE_TARGETS` | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts tests/orchestrators/plugin/install-cascade.test.ts` (+ `no-orchestrator-network`, `import-boundaries` gates) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sampling continuity: every task except the 03-04-02 human checkpoint carries an
automated direct-owner test; no 3 consecutive tasks lack one.*

---

## Wave 0 Requirements

- [x] New leaf modules this phase introduces (cross-manifest range intersection,
  git-tag range resolution, the multi-plugin cascade orchestrator, the path-stack +
  visited-memo cycle walk) each need their own mirrored test file per the project's
  1:1 source↔test correspondence gate (`npm run test:corresponding`) — satisfied:
  `domain/dependency-closure.ts` ↔ `tests/domain/dependency-closure.test.ts`,
  `domain/dependency-range.ts` ↔ `tests/domain/dependency-range.test.ts`,
  `orchestrators/plugin/dependency-tag-probe.ts` ↔ `tests/orchestrators/plugin/dependency-tag-probe.test.ts`,
  `orchestrators/plugin/install-cascade.ts` ↔ `tests/orchestrators/plugin/install-cascade.test.ts`,
  `orchestrators/plugin/install-cascade.messaging.ts` ↔ `tests/orchestrators/plugin/install-cascade.messaging.test.ts`,
  `orchestrators/plugin/dependency-declaration-read.ts` ↔ `tests/orchestrators/plugin/dependency-declaration-read.test.ts`.
  Tests were written alongside implementation in each plan (no stubs were needed).

*Existing infrastructure (`node:test`, `npm run check` gate chain) covers all phase
requirements — no new framework or fixture installation needed.*

---

## Manual-Only Verifications

All phase behaviors have automated verification. No real-world dependency
fixtures exist to exercise against a live marketplace (per REQUIREMENTS.md
Planning Notes — RESV/PROV test data is necessarily synthetic), so synthetic
fixtures are the only verification path regardless of automation.

One task is a human decision rather than a behavior:

| Task ID | What | Outcome |
|---------|------|---------|
| 03-04-02 | `checkpoint:decision` / `blocking-human` — confirm D-03-09 (hard-fail no-match in both query arms) and the `<pluginName>--v<semver>` release-tag convention before Task 3 ships | Developer answered `proceed-as-decided` (recorded verbatim in `03-04-SUMMARY.md` § Checkpoint Outcome); Task 3 ran unamended and its behavior is covered by `tests/orchestrators/plugin/dependency-tag-probe.test.ts` |

---

## Validation Audit 2026-09-16

| Metric | Count |
|--------|-------|
| Tasks mapped | 16 (15 automated + 1 human checkpoint) |
| Requirements covered | 6/6 (RESV-01..06) |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Targeted run of all 19 referenced test files at `01b67686`: 622 tests, 622 pass,
0 fail (`node --test`, 9.7 s). Every `<automated>` command's owning test file
exists on disk and every SUMMARY.md verification record reads `status: pass`.
No auditor subagent was spawned: no MISSING or PARTIAL classification remained
after cross-referencing.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-09-16
