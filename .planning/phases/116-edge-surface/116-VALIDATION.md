---
phase: "116"
slug: "edge-surface"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-02"
---

# Phase 116 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock ^9.2.2` (Node 26.7 local, 24 CI) |
| **Config file** | none — suites are selected by glob in `package.json` scripts |
| **Quick run command** | `node --test tests/edge/<pair>.test.ts` |
| **Full suite command** | `npm test` then `npm run test:integration` |
| **Estimated runtime** | ~5 s per pair; ~180 s for the full unit suite (4,832 tests, 274 suites) |

**`npm run check` MUST NOT be used as the gate.** Its chain is
`typecheck && lint && fallow && format:check && test && test:integration`, and `format:check`
fails on eight pre-existing untracked operator files, so it short-circuits before the tests ever
run. Run each gate separately and check exit codes.

---

## Sampling Rate

- **After every task commit:** `node --test <file>` then
  `npm run test:coverage:direct -- <paired source>`
- **After every plan wave:** `npm test` and `npm run test:integration`, each checked by exit code
- **Before `/gsd-verify-work`:** `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`,
  `npm run test:integration`, and `node scripts/check-corresponding-tests.mjs` all green
- **Max feedback latency:** ~15 seconds per task (single-file run plus its direct coverage gate)

---

## Per-Task Verification Map

Seeded at plan granularity — one row per source-test pair, which is what ROADMAP.md fixes before
planning. Task-level rows (`116-NN-MM`) are added by `/gsd-validate-phase` once PLAN.md files
exist. Wave numbers are the researcher's recommended ordering; the planner owns the final call.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 116-01 | 01 | 1 | MOD-09 | — | N/A | unit | `node --test tests/edge/args-schema.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/args-schema.ts` | ⬜ pending |
| 116-02 | 02 | 1 | MOD-09 | — | N/A | unit | `node --test tests/edge/args.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/args.ts` | ⬜ pending |
| 116-03 | 03 | 5 | MOD-09 | — | N/A | unit | `node --test tests/edge/completions/data.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/completions/data.ts` | ⬜ pending |
| 116-04 | 04 | 1 | MOD-09 | — | N/A | unit | `node --test tests/edge/completions/normalize.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/completions/normalize.ts` | ⬜ pending |
| 116-05 | 05 | 5 | MOD-09 | — | N/A | unit | `node --test tests/edge/completions/provider.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/completions/provider.ts` | ⬜ pending |
| 116-06 | 06 | 1 | MOD-09 | — | N/A | unit | `node --test tests/edge/flag-catalog.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/flag-catalog.ts` | ⬜ pending |
| 116-07 | 07 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/add.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts` | ⬜ pending |
| 116-08 | 08 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/autoupdate.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | ⬜ pending |
| 116-09 | 09 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/info.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts` | ⬜ pending |
| 116-10 | 10 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/list.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` | ⬜ pending |
| 116-11 | 11 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/remove.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts` | ⬜ pending |
| 116-12 | 12 | 2 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/shared.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts` | ⬜ pending |
| 116-13 | 13 | 3 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/marketplace/update.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` | ⬜ pending |
| 116-14 | 14 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/bootstrap.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` | ⬜ pending |
| 116-15 | 15 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/enable-disable.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts` | ⬜ pending |
| 116-16 | 16 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/fetch.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts` | ⬜ pending |
| 116-17 | 17 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/import.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` | ⬜ pending |
| 116-18 | 18 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/info.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts` | ⬜ pending |
| 116-19 | 19 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/install.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` | ⬜ pending |
| 116-20 | 20 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/list.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` | ⬜ pending |
| 116-21 | 21 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/pending.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` | ⬜ pending |
| 116-22 | 22 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/reinstall.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` | ⬜ pending |
| 116-23 | 23 | 2 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/shared.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` | ⬜ pending |
| 116-24 | 24 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/uninstall.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` | ⬜ pending |
| 116-25 | 25 | 4 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/plugin/update.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` | ⬜ pending |
| 116-26 | 26 | 2 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/shared.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/shared.ts` | ⬜ pending |
| 116-27 | 27 | 5 | MOD-09 | — | N/A | unit | `node --test tests/edge/handlers/tools.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/tools.ts` | ⬜ pending |
| 116-28 | 28 | 5 | MOD-09 | — | N/A | unit | `node --test tests/edge/register.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/register.ts` | ⬜ pending |
| 116-29 | 29 | 5 | MOD-09 | — | N/A | unit | `node --test tests/edge/router.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/router.ts` | ⬜ pending |
| 116-30 | 30 | 1 | MOD-09 | — | N/A | type-only | `node --test tests/edge/types.test.ts && npm run typecheck` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/helpers/notification-boundary.ts` — add an optional `cwd` option (an unstated `ctx.cwd`
      makes the orchestrator die with `The "path" argument must be of type string. Received
      function`), and make `toolProbes` explicit at every call site (`notifyUsageError` does not run
      the soft-dependency probe, so the default `toolProbes = emissions * 2` leaves an unmet
      expectation and `verifyBoundary()` fails). Roughly 20 of the 30 plans depend on this.
- [ ] Re-run every suite that already imports the helper after changing it
      (`grep -rl createNotificationBoundary tests/`)
- [ ] Wave 0 carries its own negative control: confirm the fixed helper still fails when an
      unexpected `ctx.ui.notify` call is made, so the D-116-06 proof is discriminating.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

The two success criteria that are **not** proven per owner are proven by existing gates instead,
and duplicating them in an owner is forbidden by D-116-12:

| Behavior | Criterion | Gate that owns it |
|----------|-----------|-------------------|
| No direct `process.stdout` / `process.stderr` writes | SC-3 (negative) | `npm run lint` (ESLint `no-restricted-syntax`) and `npm run fallow` (`boundaries.calls.forbidden`) |

SC-4's offline half **is** per-owner work: `tests/architecture/no-orchestrator-network.test.ts`
names five orchestrator files and says nothing about `edge/`, so the eight read-only edge surfaces
each need `t.mock.method(globalThis, "fetch", refuseNetwork)` with `callCount() === 0`.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
