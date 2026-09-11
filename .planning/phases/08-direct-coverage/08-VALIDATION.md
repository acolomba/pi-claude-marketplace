---
phase: "8"
slug: "direct-coverage"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in runner), Node v26.8.2 locally / 24 in CI |
| **Config file** | none — configured entirely through `package.json` scripts |
| **Quick run command** | `node --test <test-path>` |
| **Pair coverage command** | `node scripts/test-coverage-direct.mjs <source-path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run ~1–10 s; `npm run check` several minutes; a full report sweep ≈ 8.1 min |

---

## Sampling Rate

- **After every task commit:** `node --test <changed test path>`, plus
  `node scripts/test-coverage-direct.mjs <changed source path>` for each pair the task
  touched — **explicit single pairs**. Never the bare `npm run test:coverage:direct`, which
  selects 147 pairs and 6.5 minutes on this branch.
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:coverage:direct:negative && npm test`
- **Before `/gsd-verify-work`:** `npm run check` green, `pre-commit run --all-files` green,
  and the second full report run complete with the pin regenerated from it.
- **Max feedback latency:** 10 s per task-level check.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner. This map is the requirement→command contract the
> plans must satisfy; the planner fills the Task ID and Plan columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | RCOV-01 | — | the reporter enumerates all 230 pairs without throwing | negative control | `npm run test:coverage:direct:negative` | ✅ file, ❌ case — W0 | ⬜ pending |
| TBD | TBD | 0 | RCOV-03 | — | `pre-commit run --all-files` is green | smoke | `pre-commit run --all-files` | ✅ command, currently red | ⬜ pending |
| TBD | TBD | 0 | RCOV-01 | — | the baseline is complete and current | manual measurement | `npm run test:coverage:direct:report` (≈8 min, **in the repository**) | n/a — artifact | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | `edge/args.ts` reads complete after the rewrite | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/args.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | `edge/handlers/shared.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/shared.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | `edge/handlers/plugin/pending.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` | ✅ | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | flag parsing unchanged by the rewrites (`--scope --local`, trailing `--scope`) | unit | `node --test tests/edge/args.test.ts tests/edge/handlers/shared.test.ts` | ✅ file, ❌ 2 cases | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | the four generation guards return early | unit | `node --test tests/bridges/hooks/event-router.test.ts` | ✅ file, ❌ 3 cases | ⬜ pending |
| TBD | TBD | 1 | RCOV-02 | — | `isUpdatePreflightOutcome` discriminates both arms | unit | `node --test tests/orchestrators/plugin/update-preflight.test.ts` | ✅ file, ❌ 2 cases | ⬜ pending |
| TBD | TBD | 2 | RCOV-02 | T-08-01 | a `cleanupStaging` failure surfaces as a leak message, interleaved and partitioned (G1) | unit | `node --test tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/agents/stage.test.ts` | ✅ files, ❌ G1 cases | ⬜ pending |
| TBD | TBD | 3 | RCOV-02 | — | `install-outcome.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | ✅ file, ❌ ~60 lines | ⬜ pending |
| TBD | TBD | 3 | RCOV-03 | — | the pin fails on an addition / a changed reading / a stale row / a missing module | negative control | `npm run test:coverage:direct:negative` | ✅ file, ❌ 5 cases | ⬜ pending |
| TBD | TBD | 4 | RCOV-03 | — | the changed-pair gate selects `origin/main` and says so | CI assertion | in-job assertion on the printed `Changed-pair base:` line | ❌ — new CI job | ⬜ pending |
| TBD | TBD | 4 | RCOV-01/02/03 | — | the whole gate chain is green | full suite | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-coverage-direct.report.mjs:112` — repair the `map(pairForPath)` arity bug
      (`D-08-A01`; blocks RCOV-01 entirely — the reporter has never run to completion)
- [ ] `scripts/test-coverage-direct.negative.mjs` — a case planting the reporter's pair
      enumeration, so the repair carries its own control (`D-08-A09`)
- [ ] `.pre-commit-config.yaml` — widen the `fix-unicode-dashes` exclusion (`D-08-20`), so
      `--all-files` is green **before** a new hook is added to it
- [ ] The enumeration report run, **in the repository**, to completion (`D-08-A10`) — the
      input to every classification decision downstream

*No framework install is needed; `node:test` is built in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The committed pin equals a fresh measurement of the final tree | RCOV-01 | The sweep takes ≈8 min and is not in `npm run check` by design | Run `npm run test:coverage:direct:report` in the repository after all code work lands; regenerate the pin from that run and diff it against the committed file |
| The pre-commit hook's real cost on a working branch | RCOV-03 | Depends on branch length and staged content | Stage a one-pair change and time the hook; record the measured figure in `CONTRIBUTING.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s at task level
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
