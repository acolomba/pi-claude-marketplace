---
phase: 63
slug: lifecycle-cascade-user-facing-surface-docs
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-16
revised: 2026-06-16
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

> One row per task across plans 63-01..07. Test paths reflect what the
> plans ACTUALLY touch (not template placeholders). `File Exists` is
> ✅ for pre-existing files, ❌ W0 for files the plans create as a
> Wave 0 dependency.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01-01 | 01 | 1 | SURF-02 | T-63-01-RE | type-only seams; discriminator exhaustiveness pinned | unit (types + renderer) | `npm test -- tests/shared/notify.test.ts` | ✅ | ⬜ pending |
| 63-01-02 | 01 | 1 | SURF-02 | T-63-01-RE | multi-line hooks-block byte form pinned | unit (byte-form fixture) | `npm test -- tests/shared/notify.test.ts` | ✅ | ⬜ pending |
| 63-02-01 | 02 | 2 | LIFE-03 | T-63-LIFE-03-SE / T-63-02-NAME / T-63-02-CONT / T-63-02-PW | symlink-escape rejection + atomic write + name guard | unit (bridge) | `npm test -- tests/bridges/hooks/stage.test.ts` | ❌ W0 | ⬜ pending |
| 63-02-02 | 02 | 2 | LIFE-03 | T-63-02-NAME / T-63-02-PW | write/remove happy-path + idempotency + name-guard fixtures | unit (bridge) | `npm test -- tests/bridges/hooks/stage.test.ts` | ❌ W0 | ⬜ pending |
| 63-02-03 | 02 | 2 | LIFE-03 | T-63-LIFE-03-SE | buried + leaf + valid-real-path symlink-escape fixtures | unit (bridge) | `npm test -- tests/bridges/hooks/symlink-escape.test.ts` | ❌ W0 | ⬜ pending |
| 63-03-01 | 03 | 2 | SURF-05 | T-63-03-ID / T-63-03-CT | REASONS += "orphan rewake"; resolver detects orphan-rewake at parse time | unit (resolver) | `npm test -- tests/domain/resolver-strict.test.ts tests/shared/notify.test.ts` | ✅ | ⬜ pending |
| 63-03-02 | 03 | 2 | SURF-05 | T-63-03-CT | atomic-supersession byte-equality (catalog + UAT + tuple + resolver land together) | byte-equality / docs-lint | `npm test -- tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 63-04-01 | 04 | 3 | LIFE-01, LIFE-02 | T-63-04-COH / T-63-04-CASCADE | install.ts 6-element phases array; hooksPhase parse-then-write; orphan-rewake reason wiring | integration (orchestrator) | `npm test -- tests/orchestrators/plugin/install.test.ts` | ✅ | ⬜ pending |
| 63-04-02 | 04 | 3 | LIFE-01 | T-63-04-CASCADE | update.ts Phase 3a commit-loop hooks slot; PHASE3_FAILURE_PHASES += "hooks" | integration (orchestrator) | `npm test -- tests/orchestrators/plugin/update.test.ts` | ✅ | ⬜ pending |
| 63-04-03 | 04 | 3 | LIFE-01 | T-63-04-CASCADE | reinstall.ts parallel-prepare/commit hooks slot; rollback symmetry | integration (orchestrator) | `npm test -- tests/orchestrators/plugin/reinstall.test.ts` | ✅ | ⬜ pending |
| 63-04-04 | 04 | 3 | LIFE-01, LIFE-02 | T-63-04-UNSTAGE | cascadeUnstagePlugin hooks step + UnstageOutcome.dropped.hooks; 4-site integration | integration (transaction) | `npm test -- tests/transaction/lifecycle-cascade.test.ts tests/orchestrators/marketplace` | ❌ W0 (lifecycle-cascade.test.ts) | ⬜ pending |
| 63-05-01 | 05 | 3 | SURF-01 | T-63-05-RP / T-63-05-DE / T-63-05-PI | info.ts re-parse + projectHookSummaryEntries; alphabetical slot | unit (orchestrator) | `npm test -- tests/commands/plugin/info.test.ts` | ✅ | ⬜ pending |
| 63-05-02 | 05 | 3 | SURF-01 | T-63-05-DE | multi-line block byte form + unavailable contract + alphabetical slot fixtures | byte-equality / unit | `npm test -- tests/commands/plugin/info.test.ts` | ✅ | ⬜ pending |
| 63-06-01 | 06 | 4 | SURF-06 | T-63-06-XR | docs/hooks.md per D-63-09 section order + D-63-11 6 worked examples; verified env-var citation | docs-lint | `npm test -- tests/docs/hooks-doc.test.ts` | ❌ W0 | ⬜ pending |
| 63-06-02 | 06 | 4 | SURF-06 | T-63-06-XR | README.md ## Hook support section linking docs/hooks.md | docs-lint | `npm test -- tests/docs/hooks-doc.test.ts` | ❌ W0 | ⬜ pending |
| 63-06-03 | 06 | 4 | SURF-06 | T-63-06-XR | jargon-leak grep + 8-event coverage + cross-refs + README link | docs-lint | `npm test -- tests/docs/hooks-doc.test.ts` | ❌ W0 | ⬜ pending |
| 63-07-01 | 07 | 4 | SURF-03, SURF-04 | — | scope-fences architecture-lint (5 invariants) | architecture-lint | `npm test -- tests/architecture/scope-fences-63.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Notes:
- Task 63-03-01's plan-declared verify command is `npm test -- tests/domain/resolver.test.ts tests/shared/notify.test.ts`, but `tests/domain/resolver.test.ts` does not exist — the resolver suite is split into `resolver-strict.test.ts`, `resolver-loose.test.ts`, `resolver-comp01.test.ts`, `resolver.types.test.ts`. `applyHooksConfig` is part of `resolveStrict`, so the executor should run `tests/domain/resolver-strict.test.ts` (or extend with the new orphan-rewake cases in that file). The map records the corrected command for sampling-rate enforcement.
- The Phase 3a commit-loop in `update.ts` continues across failures (D-03). Plan 63-04 Task 2 Test 4 explicitly pins the "no in-process rollback for hooks" semantic — recovery is via the existing `RECOVERY_PLUGIN_REINSTALL_PREFIX` hint, not a backup-restore primitive.

---

## Wave 0 Requirements

> Wave 0 is the set of test files that MUST exist (with at least the
> first failing assertion in place) before Wave 1 or later tasks land,
> so feedback sampling has a target to run. Each entry's file path
> matches the plan that creates it — exact byte-match against the
> Per-Task Verification Map above.

- [ ] `tests/transaction/lifecycle-cascade.test.ts` — integration test for LIFE-01/LIFE-02 5th cascade slot (install + update + reinstall + uninstall paths through `install.ts`, `update.ts`, `reinstall.ts` Phase 3a / parallel-prepare loops, and `cascadeUnstagePlugin` in `shared.ts`). Created by Plan 63-04 Task 4.
- [ ] `tests/bridges/hooks/symlink-escape.test.ts` — LIFE-03 symlink-escape rejection fixtures (buried-symlink + leaf-symlink + valid-real-path cases). Created by Plan 63-02 Task 3.
- [ ] `tests/bridges/hooks/stage.test.ts` — write/remove happy-path + idempotency + name-guard fixtures for `writeHookConfig` / `removeHookConfig`. Created by Plan 63-02 Task 2.
- [ ] `tests/architecture/catalog-uat.test.ts` — extend with `(installed) {orphan rewake}` fixture row(s) for SURF-05 closed-set REASONS amendment (atomic-supersession per D-58-01). File exists; Plan 63-03 Task 2 extends it.
- [ ] `tests/commands/plugin/info.test.ts` — extend with `hooks:` line rendering assertions (SURF-01), alphabetical slot between `commands` and `mcp`. File exists; Plan 63-05 Task 2 extends it.
- [ ] `tests/domain/resolver-strict.test.ts` — extend with the 4 orphan-rewake detection cases for SURF-05 (Plan 63-03 Task 1). File exists; the plan extends it (the plan's declared verify command `tests/domain/resolver.test.ts` is a file-name mismatch and should be read as `tests/domain/resolver-strict.test.ts`).
- [ ] `tests/orchestrators/plugin/install.test.ts` — extend with the 6 fixture cases for Plan 63-04 Task 1 (hooksPhase + orphan-rewake reason wiring). File exists.
- [ ] `tests/orchestrators/plugin/update.test.ts` — extend with 4 cases for Plan 63-04 Task 2 (Phase 3a commit-loop hooks slot + no-in-process-rollback semantics). File exists.
- [ ] `tests/orchestrators/plugin/reinstall.test.ts` — extend with 4 cases for Plan 63-04 Task 3 (parallel-prepare/commit hooks slot). File exists.
- [ ] `tests/docs/hooks-doc.test.ts` — SURF-06 doc-lint test: docs/hooks.md exists, README link present, no internal jargon / REQ-IDs / phase numbers / bucket-A/D taxonomy. Created by Plan 63-06 Task 3.
- [ ] `tests/architecture/scope-fences-63.test.ts` — SURF-03 + SURF-04 absence pins (5 invariants). Created by Plan 63-07 Task 1.

*Existing infrastructure coverage (no Wave 0 file creation needed): `tests/shared/notify.test.ts` (extended in-place by Plan 63-01), `tests/architecture/catalog-uat.test.ts` (extended in-place by Plan 63-03), `tests/commands/plugin/info.test.ts` (extended in-place by Plan 63-05), `tests/domain/resolver-strict.test.ts` (extended in-place by Plan 63-03), `tests/orchestrators/plugin/{install,update,reinstall}.test.ts` (extended in-place by Plan 63-04).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First-time-reader comprehensibility of `docs/hooks.md` | SURF-06 | Subjective ("plain English for first-time readers"); machine lints catch jargon presence but not absence-of-clarity | Pi user (plugin author or end user) reads the doc cold and reports back whether the 8-event story, worked examples, and "what happens to my plugin?" section land. Captured during `/gsd-verify-work`. |
| README.md section style match against existing top-level sections | SURF-06 | Format match is structural, but visual hierarchy + heading parallelism is reviewer-judged | Reviewer compares the new `## Hook support` section's structure against an existing top-level section (e.g., `## MCP servers`). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for review
</content>
