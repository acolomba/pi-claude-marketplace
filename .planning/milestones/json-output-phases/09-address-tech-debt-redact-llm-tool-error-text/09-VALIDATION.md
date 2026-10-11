---
phase: "9"
slug: "address-tech-debt-redact-llm-tool-error-text"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-10"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` |
| **Config file** | none (npm scripts in `package.json`) |
| **Quick run command** | `node --test tests/edge/handlers/tools.test.ts` |
| **Full suite command** | `npm run check` (unpiped; read `$?`) |
| **Estimated runtime** | ~3 seconds quick; ~75-120 seconds full |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/edge/handlers/tools.test.ts` (the pre-commit hook adds `check:commit` for staged pairs)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Decision-keyed (the phase has no REQUIREMENTS.md ID; it traces to PMOD-04 and the milestone audit's Verdict item 1). All three tasks are in plan 09-01 (wave 1), which runs in the main checkout. The exact commands are the `<automated>` elements of 09-01-PLAN.md.

| Task ID | Plan | Wave | Decision | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | PMOD-04 (D-01, D-02, D-04, D-05, D-06) | T-09-01, T-09-02, T-09-04 | Every content string passes through `redactCredentials` in `textContent`; the url-source line, the plugin load-failure line, and the not-found line carry `***` | unit + static | Owner TAP run with `# tests 39`, `# pass 39`, and three passing `redacts` cases; comment-stripped node count (`type: "text"` 1, `redactCredentials(` 1, `presentCascade(` 2, redact-credentials import 1); `git diff --numstat b30468c0 -- tests/edge/handlers/tools.test.ts` with 0 deletions; the commit holds exactly the pair | ✅ | ✅ green |
| 09-01-02 | 01 | 1 | PMOD-04 (D-03, D-06) | T-09-02, T-09-03 | Neither execute rejects; every failure returns the redacted TC-9 shape | unit + static + coverage | Owner TAP run with `# tests 41`, `# pass 41`, three `redacts` and two `instead of throwing` cases; the node count adds two `return await build` and one `loadFailure(...)` per subject; `npm run --silent test:coverage:direct -- tests/edge/handlers/tools.test.ts` exits 0; two commits touch tools.ts since b30468c0 | ✅ | ✅ green |
| 09-01-03 | 01 | 1 | PMOD-04, audit Verdict item 1 (D-06, D-07, D-08) | T-09-05, T-09-06, T-09-SC | The item is resolved with its pointer, audit-open no longer lists it, the invariants hold, and the gate is green | doc + tool + gate | Deferred-items node check (one `  status: resolved` line; a Resolved by line with `09/`, PMOD-04, and both commits); `query audit-open` without the item; `git diff --exit-code b30468c0 -- docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/ tests/architecture/no-credential-leak.test.ts`; committed-scope check; no added suppression marker; `npx fallow audit --base b30468c0` verdict pass; `npm run check` exit 0 | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

The base for every diff is `b30468c0`, the HEAD at planning. Only planning Markdown lands after it before execution, and 09-01-01's precondition checks that.

---

## Wave 0 Requirements

- [x] New cases in `tests/edge/handlers/tools.test.ts`, written RED first against the current tree:
  - 09-01-01: "redacts the credential of a url source on its marketplace line", "redacts a credential in the load failure it reports", and "redacts a credential in the marketplace name it reports as not found". RED: `# fail 3`.
  - 09-01-02: "returns a redacted tool error instead of throwing when the load fails" and "returns a redacted tool error instead of throwing when the marketplace lookup fails". RED: `# fail 2`; both reject.

Existing infrastructure (hermetic scope helpers, `strong-mock`) covers everything else.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-11

## Validation Audit 2026-10-11

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
