---
phase: 61
slug: if-field-permission-rule-matcher
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-15
revised: 2026-06-15
---

# Phase 61 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, ESM-strip via Node ≥22.18 or `tsx` loader) |
| **Config file** | none (node:test discovers test files via glob) |
| **Quick run command** | `node --test --import tsx tests/architecture/hooks-if-field.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 seconds (single file); ~60 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `node --test --import tsx tests/architecture/hooks-if-field.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 61-01-01 | 01 | 1 | MATCH-03 §1 / D-61-01 / D-61-03 / NFR-7 | T-61-02, T-61-04, T-61-05 | Pure-and-total glob compile; no fs.realpath; no regex compile of user input | unit | `cd /home/acolomba/pi-claude-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 \| grep -E 'if-field\|hook-if-targets' \|\| echo "typecheck clean for new files"` | ✅ Task 3 ships test scaffold | ⬜ pending |
| 61-01-02 | 01 | 1 | MATCH-03 §1 / D-61-04 | T-61-01, T-61-03 | Hand-rolled Bash parser; depth-cap 8 on $() recursion; quote-aware split; closed wrapper set | unit | `cd /home/acolomba/pi-claude-marketplace && npx tsc --noEmit -p tsconfig.json 2>&1 \| grep -E 'if-field/bash' \|\| echo "typecheck clean for bash.ts"` | ✅ Task 3 ships test scaffold | ⬜ pending |
| 61-01-03 | 01 | 1 | MATCH-03 §1-5 / D-61-01..04 | T-61-02, T-61-03 | Truth-table scaffold + IfPredicate exhaustiveness pin (Wave-0 contract: ships the architecture-test file every later task asserts against) | architecture | `cd /home/acolomba/pi-claude-marketplace && node --test --import tsx tests/architecture/hooks-if-field.test.ts 2>&1 \| tail -20` | ✅ Wave 0 scaffold | ⬜ pending |
| 61-02-01 | 02 | 2 | MATCH-03 §1-2 / HOOK-03 / D-61-02 / D-61-03 / D-61-04 | T-61-06 | HOOK_HANDLER_SCHEMA `if` optional (required stays `["type"]`); compileIfPredicate pure-and-total; parseHooksConfig signature widened with ctx; all 22 call sites updated; fail-open across every failure mode | unit + integration | `cd /home/acolomba/pi-claude-marketplace && npm run typecheck 2>&1 \| tail -20` | ✅ Task 1 extends Task 3's file | ⬜ pending |
| 61-02-02 | 02 | 2 | MATCH-03 §2 / NFR-7 | T-61-08 | RoutingEntry.ifPredicate always-present sentinel; flattenPluginIntoBuckets populates from side-Map; referential-equality reuse on MATCH_ALL_IF | architecture + integration | `cd /home/acolomba/pi-claude-marketplace && npm run check 2>&1 \| tail -30` | ✅ Task 2 extends Task 3's file | ⬜ pending |
| 61-03-01 | 03 | 3 | MATCH-03 §3-4 / D-61-02 / D-61-03 / D-61-04 / D-58-01 | T-61-09, T-61-10, T-61-11 | ifFires switch with assertNever; per-event extractors safe on malformed shapes; REQUIREMENTS.md MATCH-03 amendment lands atomically with first commit | unit + docs | `cd /home/acolomba/pi-claude-marketplace && npm run typecheck 2>&1 \| tail -20` | ✅ Task 3 ships test scaffold (Plan 01) | ⬜ pending |
| 61-03-02 | 03 | 3 | MATCH-03 §4 / D-61-02 | — | reduceBucket consults ifFires between matcherFires and activeExecutor; if-no-match returns `continue` (NOT block) | architecture + integration | `cd /home/acolomba/pi-claude-marketplace && npm run check 2>&1 \| tail -30` | ✅ Task 3 ships test scaffold (Plan 01) | ⬜ pending |
| 61-03-03 | 03 | 3 | MATCH-03 §1-5 / D-61-01..04 / A5 | T-61-09, T-61-10, T-61-11 | Architecture-test closure: zero `t.todo`, every truth-table row asserted end-to-end through ifFires + compileIfPredicate; AND composition + fail-open + substitute-cwd + non-tool-event + IfPredicate exhaustiveness | architecture | `cd /home/acolomba/pi-claude-marketplace && node --test --import tsx tests/architecture/hooks-if-field.test.ts 2>&1 \| tail -30 && npm run check 2>&1 \| tail -10` | ✅ Task 3 ships test scaffold (Plan 01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/architecture/hooks-if-field.test.ts` — stubs for MATCH-03 §1-5 + D-61-01..04 shipped by **Plan 01 Task 3** (Wave 1). This file is the Wave-0 contract for all downstream tasks; every Plan 02 / Plan 03 task extends it rather than creating a new test file.
- [x] No new framework install — node:test is built-in.

Plan 01 Task 3 is accepted as the Wave-0 scaffold per the planner's "interface-first task ordering" convention: Task 3 ships the file in the same wave as Tasks 1/2 (which the file imports from), and every subsequent task (Plan 02 Task 1/2, Plan 03 Task 1/2/3) operates by extending it. The `wave_0_complete: true` flag reflects this: the scaffold is present before any task that depends on it runs (Task 3 must complete before Plan 02 Wave 2 begins).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| — | — | — | — |

*All phase behaviors have automated verification (architecture-test fixtures pin every upstream truth-table row).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (8 of 8 tasks have an `<automated>` verify command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Plan 01 Task 3 ships the scaffold every later task extends)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter

**Approval:** pending
