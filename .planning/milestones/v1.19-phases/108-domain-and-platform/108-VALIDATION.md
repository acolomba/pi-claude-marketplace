---
phase: 108
slug: domain-and-platform
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-28
validated: 2026-09-04
requirement: MOD-01, RES-01, PRES-03, PRES-04
coverage_score: 100
---

# Phase 108 — Validation Strategy

> Reconciled audit of the 23 domain-and-platform pairs. Phase 108 was executed and verified
> (`108-VERIFICATION.md`, `status: passed`, re-verified 2026-08-29 after Plan 108-24 closed two
> gap groups) but its VALIDATION.md was seeded by plan-phase and never reconciled by
> validate-phase — it stayed `status: draft`, `nyquist_compliant: false`. Per #2117 that made the
> `false` verdict an artifact of an unreconciled file, not a measured compliance failure. This
> reconciliation re-measures against the current tree and the retained all-pair artifact
> (`117-ALL-PAIR-RESULT.ndjson`). **It changed no production file, no test file, and generated
> no tests.**

## Status Lifecycle

1. **Draft seeded (2026-08-28):** plan-phase wrote the 58-row task/sampling map before execution;
   every row read "pending" and the frontmatter defaulted to `status: draft`,
   `nyquist_compliant: false`.
2. **Executed and verified (2026-08-29):** `108-VERIFICATION.md` scored 68/69 must-haves, closed
   the two re-verification gap groups via Plan 108-24, and recorded `status: passed`. The
   VALIDATION.md draft was never touched to match.
3. **Reconciled (2026-09-04):** all 23 owner suites re-run together, all 23 paired sources
   re-checked against the 204-row artifact, and the correspondence gate re-run — all green.
   Promoted to `status: validated`, `nyquist_compliant: true`, `wave_0_complete: true`.

**Why no gaps were filled.** Gap analysis found no MISSING and no PARTIAL requirement, so no
test was generated. This milestone's deliverable is a 204/204 one-to-one pair invariant enforced
by `scripts/check-corresponding-tests.mjs`; a generated test with no paired production module
would itself be an `unexpected-test` violation. The gate was measured at exit 0 with zero
violations after this audit.

## Test Infrastructure

| Property | Value |
| --- | --- |
| **Framework** | Node.js built-in `node:test`, `node:assert/strict`, test-context mocks/timers, `strong-mock` 9.2.2 |
| **Pair gate** | 204-row artifact `117-ALL-PAIR-RESULT.ndjson`, produced by `scripts/test-coverage-direct.mjs` |
| **Owner suite run** | `node --test <owner-test-path>` |
| **Phase suite** | 23 direct pairs, 742 owner cases (measured together in one run) |
| **Correspondence gate** | `node scripts/check-corresponding-tests.mjs` |
| **Repository suite** | `npm test`, `npm run test:integration`, `npm run check` |

## Coverage Scorecard

| Dimension | Covered | Total | Score | Evidence |
| --- | ---: | ---: | ---: | --- |
| Planned plans with an executable owner | 23 | 23 | 100% | One exact owner/source pair per plan (108-01..108-23) |
| Exact source-owner direct gates | 23 | 23 | 100% | All 23 rows read `complete` in the 204-row artifact |
| Focused owner cases | 742 | 742 | 100% | 23 owner suites run together, 0 failures, `node --test` |
| Phase success criteria | 4 | 4 | 100% | See the table below |
| Requirement coverage | 4 | 4 | 100% | MOD-01, RES-01, PRES-03, PRES-04 all exercised |

**Nyquist verdict:** PASS — every planned direct boundary in phase 108 has automated evidence,
and the two deferred items (resolver-consumer lexical migration; correspondence-gate
brownfield backlog) are explicitly assigned elsewhere, not hidden gaps of this phase.

## Requirement and Success-Criterion Coverage

| Contract | Status | Automated evidence |
| --- | --- | --- |
| **MOD-01:** all 23 domain-and-platform pairs complete the pair contract | COVERED | 23/23 owners pass together (742 cases, 0 fail); all 23 sources read `complete` in the 204-row artifact |
| **RES-01:** resolver results expose literal materializability and preserve three `state` distinctions | COVERED | `domain/resolver.test.ts` (module-scope type evidence: true-arm `pluginRoot` compiles, false-arm requires `@ts-expect-error`, three `state` literals stay distinct) plus 19 migrated fixture spreads verified by `npm run typecheck` |
| **PRES-03:** production and fake Git, credential, and device-flow adapters pass the same public contract cases | COVERED | Three shared registrars (Git 12 cases, credential 31 cases, device-flow 10 cases) run against both production and fake participants |
| **PRES-04:** each adapter contract has an independent negative (broken-implementation) control | COVERED | Each of the three registrars' single named broken-control test fails exactly its target case and no other, verified in `108-VERIFICATION.md`'s Shared Adapter Contracts table |
| **Criterion 4:** domain and platform tests run without live network access, developer credentials, or test-only production exports | COVERED | `git.ts` replaces HTTP transport, `github-auth.ts` device flow replaces `globalThis.fetch`, credential tests inject `CredentialSpawn`; no coverage-ignore or test-only export found in the three modified sources |

Criterion 2 (resolver consumers narrow on `installable`) is **partially covered by phase 108
itself and explicitly deferred for the remaining ten lexical call sites** — see Deferred Item
below. This is not a phase-108 gap: the union, constructors, and resolver-owned narrowing gates
are all covered by `resolver.test.ts`; only external-consumer call-site migration is deferred.

## Exact Pair Map

Source of truth: `117-ALL-PAIR-RESULT.ndjson`, filtered to `domain/` and `platform/`.

| # | Source | Owner test | Verdict |
| ---: | --- | --- | --- |
| 108-01 | `domain/auth-registry.ts` | `tests/domain/auth-registry.test.ts` | complete |
| 108-02 | `domain/clone-key.ts` | `tests/domain/clone-key.test.ts` | complete |
| 108-03 | `domain/components/hook-events.ts` | `tests/domain/components/hook-events.test.ts` | complete |
| 108-04 | `domain/components/hook-if-targets.ts` | `tests/domain/components/hook-if-targets.test.ts` | complete |
| 108-05 | `domain/components/hook-tool-names.ts` | `tests/domain/components/hook-tool-names.test.ts` | complete |
| 108-06 | `domain/components/hooks.ts` | `tests/domain/components/hooks.test.ts` | complete |
| 108-07 | `domain/components/hooks/matcher.ts` | `tests/domain/components/hooks/matcher.test.ts` | complete |
| 108-08 | `domain/components/hooks/partition.ts` | `tests/domain/components/hooks/partition.test.ts` | complete |
| 108-09 | `domain/components/hooks/schema.ts` | `tests/domain/components/hooks/schema.test.ts` | complete |
| 108-10 | `domain/components/mcp.ts` | `tests/domain/components/mcp.test.ts` | complete |
| 108-11 | `domain/components/plugin.ts` | `tests/domain/components/plugin.test.ts` | complete |
| 108-12 | `domain/github-auth.ts` | `tests/domain/github-auth.test.ts` | complete |
| 108-13 | `domain/manifest-cache.ts` | `tests/domain/manifest-cache.test.ts` | complete |
| 108-14 | `domain/manifest-lookup.ts` | `tests/domain/manifest-lookup.test.ts` | complete |
| 108-15 | `domain/manifest.ts` | `tests/domain/manifest.test.ts` | complete |
| 108-16 | `domain/name.ts` | `tests/domain/name.test.ts` | complete |
| 108-17 | `domain/plugin-root.ts` | `tests/domain/plugin-root.test.ts` | complete |
| 108-18 | `domain/resolver.ts` | `tests/domain/resolver.test.ts` | complete |
| 108-19 | `domain/source.ts` | `tests/domain/source.test.ts` | complete |
| 108-20 | `domain/version.ts` | `tests/domain/version.test.ts` | complete |
| 108-21 | `platform/git-credential.ts` | `tests/platform/git-credential.test.ts` | complete |
| 108-22 | `platform/git.ts` | `tests/platform/git.test.ts` | complete |
| 108-23 | `platform/pi-api.ts` | `tests/platform/pi-api.test.ts` | complete |
| | **Total** | | **23 complete, 0 short** |

Per-pair branch/function/line counts are recorded in `108-VERIFICATION.md`'s Direct Owner
Coverage table (measured 2026-08-29) and are not restated here since they were not re-measured
individually in this reconciliation — the 204-row artifact's `complete` verdict for all 23 rows
was used instead, per the method note preferring the retained artifact over restating a phase's
own summary numbers.

## Manual-Only

None. All phase-108 behaviors have automated verification, per `108-VERIFICATION.md`'s Human
Verification Required section ("N/A. This is an infrastructure and test-foundation phase.").

## Verification Evidence

Measured on the current tree during this reconciliation, each command run separately:

- 23 owner suites run together (`node --test` over all 23 files): 742 pass, 0 fail, 48 suites,
  exit 0.
- 23 direct pair gates via the 204-row artifact: all `complete`.
- `node scripts/check-corresponding-tests.mjs` → exit 0, `Corresponding-test gate passed.`

## Deferred Item

`108-VERIFICATION.md` records an explicit, named ledger for the ten external resolver-consumer
call sites that still need lexical migration onto the `installable` discriminant:

- `plugin-state-classifier.ts` → Phase 113 (P113-24).
- Lifecycle consumers → Phase 114 (P114-07/08/09/10/11/12/14).
- Reconcile backfill/notifications → Phase 115 (P115-06/07).

Phase 115's own (reconciled) VALIDATION.md confirms its two assigned items (backfill, notify)
landed as `108-06`/`108-07` pairs, both `complete`. This deferred item does not hide a phase-108
implementation gap: the `ResolvedPlugin` public union and resolver-owned narrowing gates are
fully covered by `resolver.test.ts` and its module-scope type evidence; only downstream
call-site migration was deferred by design.

## Gaps Summary

| Metric | Count |
| --- | ---: |
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Tests generated | 0 |
| Manual-only items | 0 |

No actionable gap remains. The draft's `nyquist_compliant: false` was an artifact of plan-phase
seeding never being reconciled after execution — not a measured shortfall. `108-VERIFICATION.md`
already closed both real gap groups it found (data-row phase syntax, stale helper-path comments)
via Plan 108-24 before this reconciliation began.

---

_Reconciled and validated: 2026-09-04. Closes the draft-status Nyquist file flagged by the
v1.19 milestone audit._
