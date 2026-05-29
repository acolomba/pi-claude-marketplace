---
phase: 24
slug: grammar-consistency
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 24 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `24-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node ≥22 |
| **Config file** | none -- glob-driven via `package.json` scripts |
| **Quick run command** | `node --test "tests/architecture/catalog-uat.test.ts" "tests/orchestrators/plugin/install.test.ts" "tests/shared/errors.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | quick ~10s · full ~30s |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run `npm run check` (full suite must include typecheck -- the rename is partly compiler-driven)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

> Task IDs assigned by the planner; per-task rows completed by the Nyquist auditor once `*-PLAN.md` exists. The dimensions below are the regression-detection axes every task must map to.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | SNM-36 | -- | N/A (display-token rename; no security surface) | architecture/UAT | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ | ⬜ pending |

**Regression-detection dimensions (from RESEARCH §Validation Architecture) -- every task maps to ≥1:**

- **(a) EMIT renders `{lsp}` / `{hooks, lsp}`** -- catalog byte-equality (`catalog-uat.test.ts` fixtures :246,:490 ↔ `docs/output-catalog.md` :158,:300, lockstep) + `install.test.ts:1589` + `install.test.ts:1698/:1712` expected outputs.
- **(b) DETECT still matches camelCase** -- `install.test.ts` INPUTs `["contains lspServers"]` (:1579,:1698,:1712) stay camelCase AND still resolve to `["lsp"]`. This single test proves detect-camelCase / emit-`lsp` end to end.
- **(c) KEEP-bucket NOT renamed (false-GREEN guard)** -- `errors.test.ts:204` composed message `…: hooks; lspServers` + `resolver-loose.test.ts:194` / `resolver-strict.test.ts:163` `kind:"lspServers"` fixtures MUST stay GREEN with camelCase. A RED here means a KEEP site was wrongly renamed.
- **(d) SC#4 manifest untouched** -- post-edit `grep -n lspServers domain/components/plugin.ts domain/resolver.ts` must still show `:31`, `:142`, `:160`; `resolver-strict.test.ts` GREEN.

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* Every dimension above maps to an EXISTING test; the phase only updates fixtures/expectations (in lockstep) and relies on the KEEP-bucket assertions as the regression guard. No new test file or framework install needed.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.* The catalog-UAT byte-equality test is self-checking (reads `output-catalog.md` fenced `<!-- catalog-state: … -->` blocks at runtime and asserts `notify()` output equals them -- doc + fixture must change together or it goes RED, structurally preventing EMIT-side false-GREEN).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none -- existing infra suffices)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
