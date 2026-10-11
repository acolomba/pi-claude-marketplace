---
phase: "9"
slug: "address-tech-debt-redact-llm-tool-error-text"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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

Decision-keyed (the phase has no REQUIREMENTS.md ID; it traces to PMOD-04 and the milestone audit's Verdict item 1). Task IDs are filled in by the planner.

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-01 | Every `content` text site passes through `redactCredentials` | static + unit | `grep -c 'type: "text"' extensions/pi-claude-marketplace/edge/handlers/tools.ts` -> `1`; `node --test tests/edge/handlers/tools.test.ts` | ❌ W0 (new cases) | ⬜ pending |
| D-02 | `details` unchanged | unit | existing details expectations pass untouched | ✅ | ⬜ pending |
| D-03 | Neither tool's `execute` rejects; error results use the TC-9 shape | unit | `node --test tests/edge/handlers/tools.test.ts` | ❌ W0 (new cases) | ⬜ pending |
| D-04 | Seam in `edge/handlers/tools.ts`; boundaries clean | static | `npm run fallow` exit 0 | ✅ | ⬜ pending |
| D-05 | Absolute paths not redacted | unit | TC-9 case passes unmodified | ✅ | ⬜ pending |
| D-06 | Required owner cases + 100% direct pair coverage | unit + coverage | `npm run --silent test:coverage:direct -- tests/edge/handlers/tools.test.ts` exit 0 | ❌ W0 | ⬜ pending |
| D-06 | AUTH-09 gate untouched | diff | `git diff --exit-code <base> -- tests/architecture/no-credential-leak.test.ts` | ✅ | ⬜ pending |
| D-07 | Deferred item closed and not reported open | doc + tool | `grep -n 'status: resolved' .planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` | ✅ | ⬜ pending |
| D-08 | Catalog and frozen corpus unchanged | diff | `git diff --exit-code <base> -- docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/` | ✅ | ⬜ pending |
| D-08 | No new suppression; gate green | gate | `npm run check` exit 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

`<base>` = the phase start commit, recorded when execution starts.

---

## Wave 0 Requirements

- [ ] New cases in `tests/edge/handlers/tools.test.ts`: channel-3 list line redaction, credential-bearing plugin-list failure, marketplace-list load failure resolves (does not reject), `marketplaceExists` failure resolves, LLM-supplied not-found-line redaction. Written RED first against the current tree.

Existing infrastructure (hermetic scope helpers, `strong-mock`) covers everything else.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
