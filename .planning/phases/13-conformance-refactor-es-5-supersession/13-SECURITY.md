---
phase: 13
slug: conformance-refactor-es-5-supersession
status: passed
threats_open: 0
asvs_level: 1
created: 2026-05-24
verified: 2026-05-24
---

# Phase 13 -- Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Phase 13 (Conformance Refactor & ES-5 Supersession) introduces NO new application-security domain. It is a mechanical rewrite of user-visible callsites onto the Wave 1 renderer/composer primitives, plus the ES-5 atomic three-file supersession commit. No new I/O, no new auth, no new persistence shapes, no new external trust boundaries. All threats are inherited / refactor-specific (regression vectors) per RESEARCH.md §"Security Domain".

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `ctx.ui.notify` boundary (IL-2) | Single sanctioned output channel for all user-visible messages from the extension into the Pi host runtime. | Closed-set status tokens, reasons, markers; per-row payloads (`name`, `version`, `scope`, `status`, `reasons`, `declaresAgents?`, `declaresMcp?`) -- no raw exception objects, no stack traces, no absolute paths. |
| `Error.cause` chain boundary (NFR-9) | Depth-5 walk from `notifyError` that surfaces only `.message` (or string verbatim / `Object.prototype.toString.call` fallback). | `Error.message` strings only -- no `.stack`, no absolute paths, no internal object shapes. Depth bound + cycle detection prevent walker DoS. |
| Static-audit boundary (CMC-35 / D-13-12) | `tests/architecture/no-legacy-markers.test.ts` continues to enforce zero re-introductions of the 5 ES-5 marker strings across the codebase's lifetime. | Pinned literal fixtures in the test body survive any future `shared/markers.ts` edit; allow-list is documented and minimal (markers.ts + 2 snapshot/audit test files + `transaction/phase-ledger.ts` header). |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-13-01 | Tampering | `STATUS_TOKENS` array (Plan 13-01-01) | mitigate | `tests/architecture/grammar-frontmatter.test.ts` byte-equality assertion fails CI on any code/frontmatter drift. | closed |
| T-13-02 | Information Disclosure | `renderRow` token emission (Plan 13-01-01) | accept | All inputs are validated state; renderer surfaces only `name`/`version`/`scope`/`status`/`reasons` -- no stack traces, no absolute paths (NFR-9 invariant). | closed (accepted) |
| T-13-03 | Denial of Service | `renderRow` switch dispatch (Plan 13-01-01) | accept | Pure switch over closed union; O(1); no recursion; `assertNever` runtime safety net. | closed (accepted) |
| T-13-04 | Denial of Service | `causeChainTrailer` cycle walk (Plan 13-01-02) | mitigate | Depth bound 5 + cycle detection (`current.cause !== current`); O(5) max iterations. | closed |
| T-13-05 | Information Disclosure | `notifyError` body (Plan 13-01-02) | mitigate | Trailer surfaces only `Error.message` (or string / `Object.prototype.toString.call` fallback for non-Error); no `.stack`, no absolute paths -- NFR-9 invariant preserved. | closed |
| T-13-06 | Tampering | `cascadeSeverity` boundary (Plan 13-01-02) | mitigate | Pure function over typed `PluginCascadeRow[]`; closed-set `status` from `Extract<StatusToken,...>`; no untrusted input enters this code path. | closed |
| T-13-07 | Tampering | Wave 2 callsite migration (Plan 13-01-03) | mitigate | ESLint `no-restricted-imports` rule fails `npm run check` on any legacy marker import; `tests/architecture/no-legacy-markers.test.ts` static-audit fails on any legacy marker string in non-allow-listed files. Together they make regression structurally impossible. | closed |
| T-13-08 | Tampering | Post-Wave-3 codebase (Plan 13-01-03) | mitigate | Static-audit test continues to enforce zero re-introductions for the lifetime of the codebase; pinned literals in the test body survive `markers.ts` export deletion. | closed |
| T-13-09 | Tampering | Cascade severity routing (Plan 13-02a-01) | mitigate | `cascadeSeverity` is pure; `cascadeSummary` returns `{message, severity}`; orchestrators destructure -- cannot accidentally route a non-trivially-failed cascade through `notifySuccess`. | closed |
| T-13-10 | Information Disclosure | `notifyError` cause-chain on import setup failure (Plan 13-02a-01) | mitigate | `notifyError`'s Wave 1 body uses `causeChainTrailer` which surfaces only `.message` per NFR-9. | closed |
| T-13-02a-02-01 | Tampering (string-shape regression) | `transaction/rollback.ts::formatRollbackError` rewrite (Plan 13-02a-02) | mitigate | 7 migrated D-03 contract tests + new byte-equivalence test gate every structural invariant: zero-partial fast path returns original instance, ES-4 cause chain set, PathContainmentError + SymlinkRefusedError bypass returns original instance verbatim, rendered shape contains the new closed-set tokens. The 1-partial test asserts `!got.message.toLowerCase().includes("reason")` (F-4) so prose cannot seep back. | closed |
| T-13-02a-02-02 | Information Disclosure (NFR-9) | `bridges/stage.ts` → `ManualRecoveryError.leaks` → orchestrator `notifyError` cause-chain (Plan 13-02a-02) | mitigate by reuse | Depth-5 walker surfaces ONLY `.message`; does NOT surface `err.leaks` directly. Leak paths embedded via leak-set reconstruction at render time, structurally typed (not stringly-typed). Net effect: same user-visible text as legacy form; NFR-9 invariant unchanged. | closed |
| T-13-02a-02-03 | Tampering (closed-set CMC-11 regression) | `narrowReason` structural rewrite in `reinstall.ts` (Plan 13-02a-02) | mitigate | Structural `instanceof ManualRecoveryError` (walked via `findManualRecoveryError` after the WR-01 fix in commit `6caa431`) produces `"rollback partial"` as the closed-set Reason. Cascade-row rendered shape `⊘ <name> [<scope>] (failed) {rollback partial}` byte-identical to legacy. Verified by STRENGTHENED line-225 regex in `tests/edge/handlers/plugin/reinstall.test.ts` AND the new 6-test `__test_findManualRecoveryError` regression suite. | closed |
| T-13-02a-02-04 | Tampering (ESLint cutover gate weakening) | Removing 6 allow-list entries in `eslint.config.js` (Plan 13-02a-02) | mitigate | The `paths[].importNames` restriction in BLOCK E is PRESERVED (only the per-file `ignores` are removed). After this plan, ANY file under `extensions/pi-claude-marketplace/**` OR `tests/**` that re-imports `MANUAL_RECOVERY_REQUIRED` / `ROLLBACK_PARTIAL` fails lint. Cutover STRENGTHENS the gate. | closed |
| T-13-02a-02-05 | Tampering (leak double-count F-5) | `errorWithManualRecovery` merge of `err.leaks` + new `leaks` (Plan 13-02a-02) | mitigate | F-5 dedup test added in Task 2 Step 10 binds the no-double-count invariant via a constructed counterexample input. Implementation chose `[...new Set(...)]` dedup; test passes. | closed |
| T-13-02a-02-SC | Tampering (supply chain) | npm installs (Plan 13-02a-02) | n/a | No new package installs. All migration is in-tree TypeScript refactor consuming Wave 1 composers. No `Package Legitimacy Audit` required. | closed (n/a) |
| T-13-11 | Information Disclosure | Edge handler entity-shape errors (Plan 13-02b-01) | mitigate | `EntityErrorRow.reasons` constrained to `Reason` closed set; no raw exception messages leaked into the compact line; `notifyError`'s cause-chain trailer surfaces only `.message` per NFR-9. | closed |
| T-13-12 | Tampering | MSG-SD-3 enforcement (Plan 13-02b-01) | mitigate | `PluginInlineUninstalledRow` lacks `declaresAgents/Mcp` fields structurally; TS compile fails on any attempt to add them. | closed |
| T-13-13 | Tampering | CMC-31 partial-failure ordering (Plan 13-02c-01) | mitigate | `cascadeSummary` always sorts children via `compareByNameThenScope`; order is deterministic across runs. | closed |
| T-13-14 | Information Disclosure | mp remove failure cause chains (Plan 13-02c-01) | mitigate | `notifyError`'s body uses `causeChainTrailer` (depth 5; only `.message` surfaced; NFR-9). | closed |
| T-13-15 | Denial of Service | `cascadeSeverity` on large remove cascades (Plan 13-02c-01) | accept | Linear scan over `PluginCascadeRow[]`; O(n) where n is the number of plugins in the marketplace; unbounded in theory but bounded in practice (marketplace with 10000 plugins is implausible). | closed (accepted) |
| T-13-16 | Tampering | Fold rule + sort determinism (Plan 13-02d-01) | mitigate | `compareByNameThenScope` provides deterministic order; integration test `tests/integration/fold-adoption.test.ts` exercises the round-trip. | closed |
| T-13-17 | Information Disclosure | Plugin descriptions in list output (Plan 13-02d-01) | accept | `description` comes from the user-trusted manifest; truncated at column 66 per PL-1; no path leakage. | closed (accepted) |
| T-13-18 | Tampering | Catalog UAT pairing (Plan 13-03-01) | mitigate | Every annotated catalog block MUST have a fixture entry; missing entries surface as test failures, not silent passes. `tests/architecture/catalog-uat.test.ts` exits 0. | closed |
| T-13-19 | Information Disclosure | Catalog UAT (Plan 13-03-01) | n/a | Pure byte-equality test reading the local catalog file; no I/O beyond. | closed (n/a) |
| T-13-20 | Tampering | Atomic-commit integrity (Plan 13-03-02) | mitigate | All 4 edits land in a SINGLE commit per D-13-03 (verified: `c4d87d4` lists exactly 4 files in `git show HEAD --stat`). Partial edits would have left the test suite red (markers-snapshot.test.ts asserted `literals.length === 5` which would have failed on PRD-pointer state). | closed |
| T-13-21 | Tampering | Post-commit re-introduction (Plan 13-03-02) | mitigate | `tests/architecture/no-legacy-markers.test.ts` (Plan 13-01-03) pins the 5 literals and continues to scan the codebase forever. Test passes 1/1 at HEAD. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party) · n/a*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-02 | `renderRow` token emission cannot leak stack traces or absolute paths by construction -- all inputs are typed state, the renderer outputs only `name`/`version`/`scope`/`status`/`reasons`. Accepted as a structural invariant rather than a runtime guard. | Phase 13 planner | 2026-05-23 |
| AR-13-02 | T-13-03 | `renderRow` switch dispatch is O(1) over a closed discriminated union. `assertNever` is the runtime safety net for exhaustiveness. DoS is not a realistic vector. | Phase 13 planner | 2026-05-23 |
| AR-13-03 | T-13-15 | `cascadeSeverity` is O(n) over `PluginCascadeRow[]`. The phase did not introduce any code path that produces an unbounded row count. A 10000-plugin marketplace is implausible at the project's V1 scale. | Phase 13 planner | 2026-05-23 |
| AR-13-04 | T-13-17 | Plugin `description` text in list output is read from a user-trusted manifest, truncated at column 66 per PL-1. The truncation prevents accidental long-token disclosure; the manifest is not under attacker control in V1's threat model. | Phase 13 planner | 2026-05-23 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-24 | 27 | 27 | 0 | gsd-orchestrator (short-circuit: `threats_open: 0 AND register_authored_at_plan_time: true`) |

Verification basis for the short-circuit:

- All 10 PLAN.md files contained parseable `<threat_model>` blocks → `register_authored_at_plan_time: true`.
- All mitigations are structural (TypeScript discriminated unions, ESLint rules, pinned literal-fixture audits, depth-bounded walkers) and are verified green by the post-execution gate `npm run check` at HEAD `32b8456`: 1142/1142 tests pass; ESLint clean; typecheck clean; Prettier clean.
- The structural-gate tests are themselves the enforcement surface:
  - `tests/architecture/no-legacy-markers.test.ts` (covers T-13-07, T-13-08, T-13-21) -- 1/1 pass.
  - `tests/architecture/catalog-uat.test.ts` (covers T-13-18, T-13-19) -- 3/3 pass.
  - `tests/architecture/markers-snapshot.test.ts` (covers T-13-20 indirectly) -- 6/6 pass.
  - `tests/architecture/grammar-frontmatter.test.ts` (covers T-13-01) -- passes.
  - `tests/transaction/rollback.test.ts` (covers T-13-02a-02-01, T-13-02a-02-02) -- passes (7 migrated D-03 contract tests + new shape assertions).
  - `tests/orchestrators/plugin/reinstall.test.ts` (covers T-13-02a-02-03 via the WR-01-fix regression suite `__test_findManualRecoveryError`) -- 6 new tests pass.
- The WR-01 finding from the post-execution code review (lock-release-failed error wrap breaking the structural `instanceof` check) was fixed atomically in commit `6caa431` with an explicit regression suite added in the same commit. WR-02 (JSDoc placement) fixed in `5ae15fe`. The `13-REVIEW-FIX.md` document records the per-finding remediation pass.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / n/a)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-24
