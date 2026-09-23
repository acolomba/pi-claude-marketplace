---
phase: "12"
slug: "standalone-prune-with-dry-run"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 12 — Validation Strategy

> Test targets from `12-RESEARCH.md`. Plan and task IDs are assigned during
> planning; this draft maps requirements to tests before implementation.

---

## Test Infrastructure

| Property | Value |
| --- | --- |
| **Framework** | Node `node:test` with TypeScript source execution |
| **Config file** | `package.json`, `tsconfig.json`, `scripts/test-coverage-direct.pin.json` |
| **Quick run command** | `node --test tests/orchestrators/plugin/prune.test.ts tests/edge/handlers/plugin/prune.test.ts` after Wave 0 |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Quick run: under 30 seconds; full suite: several minutes |

---

## Sampling Rate

- **After every task commit:** Run focused `node --test` for changed pairs and
  `npm run test:coverage:direct -- <changed source>` where TypeScript source
  changed.
- **After every plan wave:** Run affected architecture/catalog tests plus
  `npm run test:integration` when command routing or disk behavior changed.
- **Before `$gsd-verify-work`:** Run `npm run check`; if the parent checkout's
  pre-existing `.planning/config.json` formatting drift still blocks its chain,
  run the unaffected downstream gates separately and record the limit.
- **Max feedback latency:** 30 seconds for focused unit tests; broader gates
  run at wave boundaries.

---

## Per-Task Verification Map

| Work area | Requirement | Threat Ref | Secure behavior | Test type | Automated command | File Exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Full-scope selection and read-only state | PRUNE-06, PRUNE-07 | T-12-01, T-12-02 | No wrong-scope deletion or dry-run write | unit | `node --test tests/orchestrators/plugin/dependency-index.test.ts tests/persistence/state-io.test.ts tests/orchestrators/plugin/prune.test.ts` | New prune test: ❌ W0 | ⬜ pending |
| Locked removal and member failure | PRUNE-06 | T-12-01, T-12-02 | Fail closed; failed member holds descendants | unit, integration | `node --test tests/orchestrators/plugin/prune.test.ts tests/integration/standalone-prune.test.ts` | ❌ W0 | ⬜ pending |
| Preview and notification rows | PRUNE-07 | T-12-03 | Preview names intended removals without mutating state | unit, catalog | `node --test tests/shared/notification-grammar.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-parser.test.ts` | New catalog fixture: ❌ W0 | ⬜ pending |
| Flag surface and completion | FLAG-02 | T-12-01 | Reject unsupported flags and extra operands | unit, architecture | `node --test tests/edge/handlers/plugin/prune.test.ts tests/edge/router.test.ts tests/edge/completions/provider.test.ts tests/architecture/flag-catalog-drift.test.ts` | New handler test: ❌ W0 | ⬜ pending |
| Offline boundary | PRUNE-06, PRUNE-07 | T-12-02 | Neither prune path fetches network data | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/prune.test.ts` — real state and disk cases
  for PRUNE-06/07, including legacy migration and zero-write preview.
- [ ] `tests/edge/handlers/plugin/prune.test.ts` — exact FLAG-02 parser and
  scope cases.
- [ ] `tests/integration/standalone-prune.test.ts` — command-to-state
  transaction and preview checks.
- [ ] `tests/architecture/catalog-uat/fixtures/plugin-prune.ts` — actual,
  pending, empty, and error rows.

Existing Node test infrastructure and fixtures need no new dependency.

---

## Manual-Only Verifications

All phase requirements have automated verification targets. A live Pi session
may still judge whether the preview and empty-result wording reads clearly;
that check does not replace the automated state and disk assertions.

---

## Validation Sign-Off

- [ ] Every plan task has an automated verification command.
- [ ] No three consecutive tasks lack automated verification.
- [ ] Wave 0 creates each new test and catalog fixture above.
- [ ] No watch-mode flags are used.
- [ ] Focused feedback fits the 30-second target.
- [ ] Set `nyquist_compliant: true` after the validation audit confirms coverage.

**Approval:** pending
