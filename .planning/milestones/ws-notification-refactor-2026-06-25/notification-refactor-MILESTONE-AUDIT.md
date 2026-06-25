---
milestone: notification-refactor
audited: 2026-06-24T23:10:00Z
status: passed
scores:
  requirements: 27/27
  phases: 4/4
  integration: 5/5
  flows: 3/3
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-cutting
    items:
      - "Cosmetic: stale docstring in composeReasons (notify.ts ~1658) — already triaged non-blocking."
      - "Pre-existing ENOTEMPTY temp-dir teardown flake in marketplace autoupdate/update suites (passes in isolation; full `npm run check` green) — already triaged non-blocking, did not surface in the audit run."
  - phase: 04-concern-module-extraction-open-closed-proof
    items:
      - "MOD-05 is a documented written measurement (open-closed-proof.md), not an enforced `notify.ts`-purity architecture test (per D-02). Nothing structurally prevents future grammar creeping back into notify.ts; the only milestone-close gate is `npm run check`. Accepted by design."
      - "MOD-06 catalog floor: hand-authored catalog section per rendered state, no generation/aggregation seam. Deliberate floor, generation deferred to a future milestone (in scope per OUT-of-scope table)."
      - "Two partially-irreducible central touch-points outside notify.ts honestly disclosed in the proof: edge/completions/provider.ts (novel positional/flag shapes) and catalog-uat FIXTURES map. Neither lives in notify.ts, so the 0-notify-edits claim holds."
nyquist:
  compliant_phases: [02, 03]
  partial_phases: [01, 04]
  missing_phases: []
  overall: partial
---

# Milestone Audit: Notification Refactor

**Status:** PASSED
**Audited:** 2026-06-24
**Workstream:** notification-refactor (unnumbered milestone)

## Verdict

All 27 requirements satisfied across 4 phases. Every phase carries a `passed`
VERIFICATION.md (5/5 must-haves each). The cross-phase wiring spine is intact and
the milestone through-line holds end-to-end: **caller owns intent (severity,
needsReload, status, reasons, cause); renderer owns presentation + environment
(soft-dep probe, formatting, reduction).** No critical gaps. Non-blocking tech debt
is pre-triaged and accepted by design.

## Definition of Done

| DoD element | Status | Evidence |
|-------------|--------|----------|
| Commands own outcome intent; `notify()` is a dumb reducer | MET | Reducer reads only `row.severity` (MAX) / `row.needsReload` (OR); no `.reasons`/`.status` inference (notify.ts:2064-2066, 2192-2196) |
| Severity caller-stamped, desired-state tri-state | MET | SEV-01..05 satisfied; `BENIGN_REASONS`/`allBenign`/content `cascadeSeverity` ladder removed (0 live refs) |
| Reload caller-stamped | MET | RLD-01..05 satisfied; `shouldEmitReloadHint` reads `row.needsReload`; `present`→`installed`; `disable-cascade` kind removed (2 hits are explanatory comments only) |
| Desired-state output (leading sentence + tally + always-rendered headers) | MET | OUT-01..08 satisfied; catalog + byte fixtures superseded atomically; catalog-uat 4/4 green, byte-frozen |
| Open-closed: ≤3 central files, 0 `notify.ts` edits | MET | docs/open-closed-proof.md (59 lines) enumerates router.ts/register.ts/output-catalog.md; notify.ts 3431→3315; two concerns extracted to shared/concerns/ |
| `npm run check` green at milestone close | MET | exit 0 (unit suite + 16/16 integration, 0 fail), re-run during this audit |

## Requirements Coverage (3-source cross-reference)

All 27 REQ-IDs cross-checked against REQUIREMENTS.md traceability `[x]`, SUMMARY
`requirements-completed` frontmatter, and phase VERIFICATION.md tables. Every ID is
`[x]` + listed in ≥1 SUMMARY + SATISFIED in its phase VERIFICATION. **Zero orphans,
zero unsatisfied, zero partial.**

| Group | IDs | Phase | Status |
|-------|-----|-------|--------|
| SEV | SEV-01..05 | 2 | satisfied (5/5) |
| RLD | RLD-01..05 | 2 | satisfied (5/5) |
| OUT | OUT-01..08 | 1 (OUT-07), 3 (rest) | satisfied (8/8) |
| MOD | MOD-01..06 | 1 (01-03), 4 (04-06) | satisfied (6/6) |
| GATE | GATE-01..03 | 2, 3, 4 | satisfied (3/3) |

Note: MOD-01/02/03 were revised mid-milestone (2026-06-24) to command-local
ownership intent (no central registry). The revised intent — no value/type drift,
exhaustiveness as a per-command compile error, notify-types.test.ts deleted — is
verified satisfied via the 15 `*.messaging.ts` modules and per-command
`satisfies CommandContext<Status,Msg>` render maps.

## Phase Verifications

| Phase | Status | Score | Validation (Nyquist) |
|-------|--------|-------|----------------------|
| 1. Localized type model & command-context spine | passed | 5/5 | PARTIAL (draft, nyquist_compliant:false) |
| 2. Caller-stamped severity & reload reducer | passed | 5/5 | COMPLIANT |
| 3. Desired-state output & atomic catalog supersession | passed | 5/5 | COMPLIANT |
| 4. Concern-module extraction & open-closed proof | passed | 5/5 | PARTIAL (compliant:true, wave_0_complete:false) |

## Cross-Phase Integration

Integration checked directly (no gsd-integration-checker subagent available in this
environment); all links verified against source.

| Link | Status | Evidence |
|------|--------|----------|
| orchestrators/*/*.messaging.ts → notify-context (CONTEXT threading) | WIRED | 15 messaging modules; ~20 orchestrators call notifyWithContext / notifyReconcileAppliedWithContext |
| notify-context → notify.ts reducer (emitContextCascade) | WIRED | dispatch via context.render[row.status]; reducer reads stamped fields only |
| composeReasons → concerns/soft-dep.ts (softDepMarkers delegation) | WIRED | notify.ts:1678 `composed.push(...softDepMarkers(...))`; signature unchanged |
| info renderer → concerns/hooks.ts (appendHooksBlock) | WIRED | notify.ts:2793; concern owns its types, imports nothing from notify.ts; shared/→domain/ fence preserved (lint exit 0) |
| GATE-01 producer-stamp backstop | WIRED | notify-stamp-coverage.test.ts 3/3 pass (drives both reconcile projections) |

**E2E flows (byte-equality gate as proxy for user-visible output):**
- Plugin lifecycle render (install/uninstall/update/reinstall/enable/disable/list/info) — catalog-uat 4/4, byte-frozen.
- Marketplace lifecycle render (add/remove/list/info/update/autoupdate) — same gate.
- Mixed-subject cascades (import + load-time reconcile) — null-subject leading sentence + uniform tally, covered by catalog fixtures + 16/16 integration tests.

## Tech Debt (non-blocking, accepted)

1. **MOD-05 measurement, not enforcement** (Phase 4, per D-02): open-closed posture
   is a durable written proof, not a `notify.ts`-purity arch test. Future grammar
   could regress into notify.ts without a gate beyond `npm run check`. Accepted by
   the user's design choice; honestly disclosed in the proof's Overview.
2. **MOD-06 catalog floor** (Phase 4): hand-authored catalog section per rendered
   state, no generation seam. Deliberate floor; generation deferred to a future
   milestone (declared out-of-scope).
3. **Cosmetic stale docstring** in composeReasons (notify.ts ~1658). Pre-triaged
   non-blocking; not a milestone gap.
4. **Pre-existing ENOTEMPTY teardown flake** in marketplace autoupdate/update
   suites (passes in isolation; full `npm run check` green; did not surface in this
   audit run). Pre-triaged non-blocking; not a milestone gap.

## Nyquist Coverage

| Phase | VALIDATION.md | Compliant | Classification |
|-------|---------------|-----------|----------------|
| 1 | exists | false (draft) | PARTIAL |
| 2 | exists | true | COMPLIANT |
| 3 | exists | true | COMPLIANT |
| 4 | exists | true / wave_0_complete:false | PARTIAL |

Overall: partial. Discovery only — not a milestone blocker. The substantive
correctness gate for this milestone is the catalog-uat byte-equality runner +
GATE-01 stamp-coverage arch test + `npm run check`, all green. Optionally run
`/gsd-validate-phase 1` and `/gsd-validate-phase 4` to close the Nyquist draft
status before archive.

---
*Audited by gsd-audit-milestone — 2026-06-24*
