---
phase: 75
slug: rename-force-unsupported-vocabulary-to-partial-partially-ava
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 75 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node >=20.19) |
| **Config file** | none |
| **Quick run command** | `node --test tests/architecture/catalog-uat.test.ts tests/architecture/notify-closed-set-locks.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + node --test) |
| **Estimated runtime** | quick ~5s · full ~1-2 min |

---

## Sampling Rate

- **After every task commit:** Run the quick command (byte-equality catalog UAT + closed-set length locks + the new grep-absence guard)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite (`npm run check`) must be green
- **Max feedback latency:** ~5 seconds (quick)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Populated by the planner. Rename buckets map to: catalog-uat byte-equality for render tokens/glyphs/hint-trailers; closed-set length locks for token-set integrity; resolver-\*/classifier tests for the verdict + force-state rename; completions/handler tests for `--force`→`--partial`; completion-cache round-trip for the v3→v4 drop-rebuild; the new grep-absence guard as the surgical-completeness check.)*

---

## Wave 0 Requirements

- [ ] New architecture test (grep-based absence/presence guard) — lands **in** the rename commit asserting the post-state (cannot be green on the current tree), per RESEARCH.md § "NEW test to add".

*This rename is length-preserving; the existing closed-set length locks (23/18/32/7) stay green with no count bump. Existing infrastructure otherwise covers all rename buckets.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| {behavior} | REQ-{XX} | {reason} | {steps} |

*Expected: "All phase behaviors have automated verification" — the byte-equality catalog UAT covers every user-visible token change. Confirm at planning.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
