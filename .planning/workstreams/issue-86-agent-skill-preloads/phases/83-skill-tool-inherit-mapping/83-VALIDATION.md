---
phase: 83
slug: skill-tool-inherit-mapping
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (Node built-in runner, TS via native strip under Node 26) |
| **Config file** | none (glob in package.json scripts) |
| **Quick run command** | `node --test tests/bridges/agents/convert.test.ts tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert-byte-identity.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + unit + integration — NFR-6 gate) |
| **Estimated runtime** | quick ~0.1s (87 tests at HEAD); full ~90s |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (3 agents-bridge test files)
- **After every plan wave:** Run `npm test` (full unit tree)
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*Filled after planning — see requirement-level map below for the contract each plan must satisfy.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (pending planning) | — | — | AGSK-05 | — | — | — | — | — | ⬜ pending |

**Requirement-level map (from 83-RESEARCH.md Validation Architecture):**

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGSK-05 / D-83-01 | declared+allowed → `inheritSkills: true`; disallowed or absent → `false` | unit (exact pins) | quick run command | Extend `tests/bridges/agents/convert.test.ts` |
| AGSK-05 / D-83-02 | `Skill` still in `droppedTools` when flag true | unit | same | Extend convert.test.ts |
| AGSK-05 / D-83-04 | New warning wording exact-equality; old wording for disallowed | unit | same | Extend convert.test.ts |
| AGSK-05 / D-83-05 | Legend third state; two Phase 82 states preserved for non-Skill | unit (byte pins) | same | Extend `frontmatter.test.ts` (render) + convert.test.ts (end-to-end) |
| AGSK-05 / D-83-06 | Non-Skill corpus byte-identical to Phase 82; Skill fixture changes exactly as specified | unit (whole-file `assert.equal`) | same | Corpus exists (unchanged); carve-out pins in convert.test.ts |
| AGSK-05 / D-83-07 | Duplication (eager injection + lazy catalog) documented | unit (pinning test) | same | Extend convert.test.ts |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Capture the Phase 82 (HEAD) whole-file output of a `Skill`-declared-but-disallowed input as a constant BEFORE any converter change (the D-83-06 disallowed-direction pin — the only Skill-bearing input class whose bytes must NOT change). Same discipline as 82-01's pre-fix corpus capture.

*Everything else reuses existing node:test infrastructure; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
