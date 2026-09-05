---
phase: "01"
slug: "live-evidence-revalidation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-04"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in test runner on Node v26.8.1 |
| **Config file** | none — repository scripts invoke `node --test` directly |
| **Quick run command** | `node --test tests/architecture/revalidation.test.ts` |
| **Full suite command** | `npm run check` |
| **Measured runtime** | focused architecture check 4.01 seconds; full `npm run check` 240.25 seconds |

The final tracked implementation locations are `scripts/revalidation.mjs`,
`scripts/revalidation.negative.mjs`, and
`tests/architecture/revalidation.test.ts`. The canonical ledger uses normalized
top-level `files`, `sourceClaims`, `findings`, `decisions`, and `scopeChanges`
arrays as specified in `01-REVALIDATION-SCHEMA.md`. Mutation probes operate only
on repository-local temporary copies of the required source-test pair and
fixtures; they never patch the developer's live source or tests, and real state
remains approval-gated (01-RESEARCH.md, Open Questions (RESOLVED)).

---

## Sampling Rate

- **After every task commit:** Run the focused validator tests and `node scripts/revalidation.mjs validate --allow-incomplete`
- **After every plan wave:** Regenerate the Markdown view, validate the ledger, and run retained behavioral probes
- **Before `$gsd-verify-work`:** `npm run check` must be green, the generated view must be clean, the ledger must have no `inconclusive` record, and corpus coverage must be exactly 110/110
- **Max feedback latency:** 30 seconds for the focused validator check

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01-01 | 1 | RVAL-01, RVAL-02 | T-01-01 / T-01-02 | Reject path escape and instruction-derived records while proving stable rendering | tracer + architecture | `node --test tests/architecture/revalidation.test.ts --test-name-pattern='tracer'` | ✅ | ✅ green |
| 01-01-02 | 01-01 | 1 | RVAL-02, RVAL-03, RVAL-04 | T-01-01…T-01-05 | Reject malformed identities, invalid links, incomplete evidence/decisions/scope, unsafe shards, leakage, and view drift | unit + planted negative | `node --test tests/architecture/revalidation.test.ts && node scripts/revalidation.negative.mjs` | ✅ | ✅ green |
| 01-01-03 | 01-01 | 1 | RVAL-01 | T-01-01 / T-01-04 | Accept only the locked sorted 110-path inventory and canonical generated view | live manifest | `node scripts/revalidation.mjs inventory && node scripts/revalidation.mjs render && node scripts/revalidation.mjs validate --allow-incomplete` | ✅ | ✅ green |
| 01-02-01…01-54-03 | 01-02…01-54 | 2 | RVAL-01, RVAL-02 | T-01-02-01…T-01-43-03 | Preserve claim identity and reject incomplete or unsafe evidence records in 53 measured exclusive shards; mutation probes use only isolated repository-local copies | unit + shard ledger | `node scripts/revalidation.mjs validate-shard --assignment .planning/phases/01-live-evidence-revalidation/01-CORPUS-ASSIGNMENT.md --plan 01-NN --shard .planning/phases/01-live-evidence-revalidation/shards/01-NN.json` | ✅ | ✅ green |
| 01-55-01 | 01-55 | 3 | RVAL-01, RVAL-02 | T-01-55-01 | Merge exact 110/110 evidence and block incomplete claims | live ledger | `node scripts/revalidation.mjs validate` | ✅ | ✅ green |
| 01-58-01…01-66-01 | 01-58…01-66 | 6-14 | RVAL-03 | T-01-45-01…T-01-47-02 | Keep operator decisions unresolved until every premise has terminal live evidence | decision ledger | `node scripts/revalidation.mjs validate --decision MF-DEC-NN` | ✅ | ✅ green |
| 01-67-01…01-69-01 | 01-67…01-69 | 15-17 | RVAL-04 | T-01-67…T-01-69-03 | Preserve historical traceability while removing stale-only scope from active requirements | artifact validation | `node scripts/revalidation.mjs scope-impact --check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `scripts/revalidation.mjs` — enumerate, validate, and render the canonical ledger
- [x] `tests/architecture/revalidation.test.ts` — positive and planted-negative semantic validation
- [x] A schema/protocol document defining identities, required fields, evidence methods, and completion rules
- [x] `01-REVALIDATION.json` initialized with all 110 sorted file records and no falsely completed reviews
- [x] Negative cases for missing, extra, or duplicate paths; duplicate identities; dangling or cyclic duplicate links; missing evidence; illegal status or route; unresolved decision premises; and Markdown drift

---

## Final Hard Gate (Plan 01-69)

| Command | Result |
|---------|--------|
| `node --test tests/architecture/revalidation.test.ts` | ✅ 30 tests passed, 0 failed in 4.01 seconds |
| `node scripts/revalidation.negative.mjs` | ✅ planted negative controls passed in 0.11 seconds |
| `node scripts/revalidation.mjs validate` | ✅ strict ledger validation passed in 0.85 seconds |
| `node scripts/revalidation.mjs scope-impact --check` | ✅ all 40 scope-impact records passed in 0.15 seconds |
| `npm run format:check` | ✅ all tracked JavaScript, JSON, TypeScript, and script files use Prettier style |
| `npm run check` | ✅ typecheck, ESLint, Fallow, formatting, corresponding-test gates, 5,224 unit/architecture tests, and 31 integration tests passed in 240.25 seconds |

The focused architecture command initially produced an exit-1 wrapper with no
child output in the filesystem sandbox. The identical unrestricted command was
then run because this test launches Node child processes; all 30 tests passed.
The full gate ran from a disposable clean snapshot containing committed `HEAD`
plus only the authorized formatting repair below, with the installed
`node_modules` linked for dependency resolution. This kept `.claude/settings.json`,
`.codex/config.toml`, and `.planning/config.json` user changes outside the test
input. Fallow reported only its expected informational note that git hotspot
analysis is unavailable inside a non-git snapshot; every configured gate still
passed.

### Terminal ledger census

| Invariant | Final result |
|-----------|--------------|
| Inventory files | 110 total; 110 `complete` |
| Source claims | 2,897; every `findingId` resolves to a canonical terminal finding |
| Findings | 2,437; statuses are only `confirmed`, `duplicate`, `stale`, or `superseded` |
| Inconclusive findings | 0 |
| Decisions | 9 total; 9 `resolved`; 0 pending |
| Scope-impact records | 40: 7 `keep`, 31 `narrow/split`, 2 `move-to-evidence` |
| Generated view | `01-REVALIDATION.md` is byte-exact output from `renderRevalidation` |
| Phase 2 plans | 0 |

The planning round trip also passed: 30 unique active or complete requirement
definitions map exactly once across Phases 1-9; `GGAT-02` and `RCOV-04` are the
only evidence-only IDs; Phase 2-9 requirement counts remain
`3/5/4/3/3/3/3/2`; and all 40 scope records retain distinct path-qualified
before/after anchors. The deterministic external-API detector examined all 69
Phase 1 plans and the final Phase 1 roadmap section and returned
`detected: false` with no signals. `COVERAGE.md` is therefore intentionally
absent, and no schema task is applicable.

### Mechanical formatting prerequisite repair

The first clean-snapshot `npm run check` reached `format:check` and identified
exactly 26 tracked Phase 1 JSON artifacts. With explicit Rule-3 authorization,
the repository's installed Prettier formatted only these files:

- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-02.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-03.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-04.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-05.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-06.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-07.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-09.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-14.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-15.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-16.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-19.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-20.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-22.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-35.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-36.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-37.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-40.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-42.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-43.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-44.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-45.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-49.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-52.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-53.json`
- `.planning/phases/01-live-evidence-revalidation/shards/01-54.json`

Per-path SHA-256 digests of normalized parsed JSON were captured before and
after formatting. All 26 digests were equal and the mismatch count was zero, so
the repair changed formatting only. The standalone formatter gate and the full
verification chain were then rerun successfully.

---

## Manual-Only Verifications

All phase completion behaviors have automated validation. The operator still makes policy choices for live surviving premises, but the ledger mechanically enforces that their evidence, alternatives, selection, and downstream effects are recorded.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 seconds for focused checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** final hard evidence gate green for Plan 01-69; Phase 2 planning is authorized from the rewritten scope.
