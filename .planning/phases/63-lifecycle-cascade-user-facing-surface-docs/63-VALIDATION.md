---
phase: 63
slug: lifecycle-cascade-user-facing-surface-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (Node >= 20.19.0; native TS strip on Node 22.18+) |
| **Config file** | `package.json` `test` script + per-suite globs under `tests/` |
| **Quick run command** | `npm run check` (typecheck + lint + format-check + tests) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~60-90 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Populated by the planner from PLAN.md tasks. Each task ID `63-NN-MM` should map a requirement to an automated test command or a documented Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-NN-MM | NN | W | REQ-XX | T-63-NN / — | — | unit / integration / byte-equality / docs-lint | `npm test -- <glob>` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/transaction/lifecycle-cascade.test.ts` — integration test for LIFE-01/LIFE-02 5th cascade slot (install + uninstall paths through all 4 sites: `install.ts`, `update.ts`, `reinstall.ts`, `uninstall.ts` → `cascadeUnstagePlugin`)
- [ ] `tests/install/hook-path-containment.test.ts` — LIFE-03 symlink-escape rejection fixtures (buried-symlink + leaf-symlink + valid-real-path cases)
- [ ] `tests/architecture/catalog-uat.test.ts` — extend with `(unavailable) {orphan rewake}` fixture row for SURF-05 closed-set REASONS amendment (atomic-supersession per D-58-01)
- [ ] `tests/commands/plugin/info.test.ts` — extend with `hooks:` line rendering assertions (SURF-01), alphabetical slot between `commands` and `mcp`
- [ ] `tests/install/async-rewake-warning.test.ts` — SURF-05 install-time warning fires once for `rewakeMessage`/`rewakeSummary` without `asyncRewake: true`; silent when `asyncRewake: true`
- [ ] `tests/docs/hooks-doc.test.ts` — SURF-06 `docs/hooks.md` exists, README link present, no internal jargon / REQ-IDs / phase numbers / bucket-A/D taxonomy

*If existing infrastructure already covers a row above (e.g., the conformance harness from Phase 13/14), the planner replaces the Wave 0 bullet with a "covered by existing" note.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First-time-reader comprehensibility of `docs/hooks.md` | SURF-06 | Subjective ("plain English for first-time readers"); machine lints catch jargon presence but not absence-of-clarity | Pi user (plugin author or end user) reads the doc cold and reports back whether the 8-event story, worked examples, and "what happens to my plugin?" section land. Captured during `/gsd-verify-work`. |
| README.md section style match against existing top-level sections | SURF-06 | Format match is structural, but visual hierarchy + heading parallelism is reviewer-judged | Reviewer compares the new `## Hook support` section's structure against an existing top-level section (e.g., `## MCP servers`). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
