---
phase: "1"
slug: "pi-1-0-floor-and-adapter-only-detection"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-02"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `strong-mock` 9.2.2; typed ESLint; fallow; `lint:type-members` |
| **Config file** | `package.json` scripts, `eslint.config.js`, `.fallowrc.json`, `scripts/check-unused-type-members.contracts.json` |
| **Quick run command** | `node --test <owner test files of the touched modules>` (for example `node --test tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts`) |
| **Full suite command** | `TMPDIR=/var/tmp/<dir> npm run check > tmp/check.log 2>&1; echo "CHECK_EXIT=$?" >> tmp/check.log` and `TMPDIR=/var/tmp/<dir> npm run test:e2e > tmp/e2e.log 2>&1; echo "E2E_EXIT=$?" >> tmp/e2e.log` |
| **Estimated runtime** | quick ~30 s; full check ~20 min; e2e ~3 min |

---

## Sampling Rate

- **After every task commit:** owner tests of the touched files, then pre-commit (`check:changed`, which widens to the full check for config, shared-support and e2e paths).
- **After every plan wave:** `npm run check` (unpiped log ending in `CHECK_EXIT`); `npm run test:e2e` for waves that touch `tests/e2e/`.
- **Before `/gsd-verify-work`:** `npm run check`, `npm run test:e2e`, the `PI_SUBAGENTS_ROOT` integration run with 0 skips, and the recorded live canary runs, all green.
- **Max feedback latency:** quick run under 60 s per task.

---

## Per-Task Verification Map

The planner fills task IDs. Requirement-level checks from `01-RESEARCH.md` §Validation Architecture:

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PIFL-01 | — | N/A | architecture | `node --test tests/architecture/peer-floor.test.ts tests/architecture/workflows-doc-pins.test.ts` | ✅ | ⬜ pending |
| TBD | TBD | TBD | PIFL-02 | — | override never reads as "not installed" | integration | `PI_SUBAGENTS_ROOT=<prefix>/node_modules/pi-subagents npm run test:integration` (0 skipped) | ✅ edit + ❌ loader | ⬜ pending |
| TBD | TBD | TBD | PIFL-03 | — | adapter never in devDeps or lock | architecture | `node --test tests/architecture/peer-floor.test.ts` (new cases) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | PIFL-04 | — | N/A | typecheck + analyzer | `npm run typecheck && npm run lint:type-members` | ✅ | ⬜ pending |
| TBD | TBD | TBD | PIFL-05 | supply chain | no install scripts; TS held | lint + grep | `npm run lint`; `grep -c 71369f80d099e25726ad04382f15aef14a251abc .github/workflows/lint.yml` | ✅ | ⬜ pending |
| TBD | TBD | TBD | PIFL-06 | — | N/A | grep | `node -p 'require("./package.json").engines.node'`; `rg -n "20\.19" AGENTS.md .planning/PROJECT.md` returns nothing | ✅ | ⬜ pending |
| TBD | TBD | TBD | PIFL-07 | sandbox | canaries never touch the real agent dir | live-only + grep | recorded README runs; `rg -n "pi-mcp-adapter@5.0.0|pi-subagents@0.74.0|pi-dynamic-workflows@3.13.1" scripts/pi.sh` | ✅ | ⬜ pending |
| TBD | TBD | TBD | ADET-01 | spoofing | built-in never satisfies the adapter | unit + e2e + RPC | `node --test tests/platform/pi-api.test.ts`; `npm run test:e2e` | ✅ edit + ❌ RPC | ⬜ pending |
| TBD | TBD | TBD | ADET-02 | spoofing | foreign `mcp` tool does not count | unit | `node --test tests/platform/pi-api.test.ts` | ✅ edit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/platform/pi-inventory-seed.ts` — shared `toolInfo` (with `exposure`) and adapter, built-in and foreign inventory seeds (D-01-13)
- [ ] `expectSoftDepProbes` helper in `tests/edge/notification-boundary.ts` (port of the features/mcp helper) before `getCommands()` is read
- [ ] `tests/integration/pi-subagents-peer.ts` — shared loader (IN-04)
- [ ] `tests/e2e/_rpc.ts` plus the real-Pi detection test (D-01-14)
- [ ] `tests/live-uat/openai-stub-server.mjs` (D-01-15)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stop canary and both engine canaries pass on Pi 1.0 / engine 3.13.1 | PIFL-07 | needs a live Pi turn and a scratch engine install outside the repo | executor runs the `tests/live-uat/README.md` recipes and their negative controls; the verifier reads the recorded output |
| `docs/workflows-compatibility.md` stamps match the 3.13.0 → 3.13.1 body diffs | D-01-10 | judgement over a tarball diff | the diff recipe output is recorded in the plan SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
