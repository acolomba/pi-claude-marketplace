---
phase: "02"
slug: row-policies
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-01"
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
| --- | --- |
| Framework | Existing node:test and node:assert/strict |
| Config file | package.json and existing TypeScript configuration |
| Quick run command | `node --test tests/shared/notification-resolve.test.ts tests/shared/notify-context.test.ts` |
| Full suite command | `npm run check` |
| Estimated runtime | Focused checks: seconds; full suite: about 7 minutes |

## Sampling Rate

- Before every task commit: run changed owner tests, direct pair coverage, and typecheck.
- After every wave: run shared presentation, marker, and catalog suites.
- Before verification: run `npm run check`, `node scripts/notify-corpus.mjs check`, and `git diff --exit-code e40d3dda -- docs/output-catalog.md`.
- Target feedback latency for focused checks: 180 seconds. The full suite takes longer.

## Per-Task Verification Map

The planner must replace this requirement map with concrete task IDs, waves,
threat references, and commands when plans are written.

| Requirement | Behavior | Test owner | Status |
| --- | --- | --- | --- |
| PMOD-02 | Total data policies and producer narrowing | notify-context and all messaging owners | pending |
| PMOD-02 | Reasons, markers, missing policy, and frozen rows | notification-resolve | pending |
| PMOD-02 | Complete row text and command differences | notification-grammar and messaging owners | pending |
| PMOD-02 | Severity, arity, ordering, summaries, reload | notification-dispatch and notify-context | pending |
| PMOD-02 | Marker derivation remains centralized | soft-dep-marker-policy and workflows-marker-coverage | pending |
| PMOD-05 | One scan, optional facts, both message arms | reconcile/pending | pending |
| PMOD-05 | Sentence, indent, singular/plural/absent count | notification-summary and catalog fixtures | pending |
| Both | Production output unchanged | catalog and wire corpus | pending corpus disposition |

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No runner or harness
installation is needed. Preserve paired direct coverage for every changed owner.
Resolve the 25 synthetic callback emissions identified in RESEARCH.md before
planning their migration; do not silently change the corpus baseline.

## Manual-Only Verifications

All implementation behaviors have automated verification. The synthetic-corpus
acceptance conflict requires a recorded user decision, not a manual output test.

## Validation Sign-Off

- [ ] All tasks have automated verification or Wave 0 dependencies
- [ ] No three consecutive tasks lack automated verification
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Focused feedback latency below 180 seconds
- [ ] `nyquist_compliant: true` set after execution audit

**Approval:** pending
