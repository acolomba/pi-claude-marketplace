---
phase: "1"
slug: "pi-1-0-floor-and-adapter-only-detection"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

Task IDs are the plan IDs. Statuses are from runs on 2026-10-09 at
`51ebbc07`; later commits touch only `.planning` markdown.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01 | 01 | 1 | PIFL-01 | — | N/A | architecture + typecheck | `node --test tests/architecture/peer-floor.test.ts`; `npm run typecheck` | ✅ | ✅ green |
| 01-01, 01-03 | 01, 03 | 1, 2 | PIFL-02 | — | override never reads as "not installed" | integration | `PI_SUBAGENTS_ROOT=<prefix>/node_modules/pi-subagents node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts` (0.74.0, 0 skipped) | ✅ | ✅ green |
| 01-01 | 01 | 1 | PIFL-03 | — | adapter never in devDeps or lock | architecture | `node --test tests/architecture/peer-floor.test.ts` | ✅ | ✅ green |
| 01-01, 01-03 | 01, 03 | 1, 2 | PIFL-04 | — | N/A | typecheck | `npm run typecheck` (in `npm run check`) | ✅ | ✅ green |
| 01-01 | 01 | 1 | PIFL-05 | supply chain | no install scripts; TS held | lint + grep | `npm run lint`; `grep -c 71369f80d099e25726ad04382f15aef14a251abc .github/workflows/lint.yml` | ✅ | ✅ green |
| 01-01 | 01 | 1 | PIFL-06 | — | N/A | grep | `node -p 'require("./package.json").engines.node'`; `rg -n "20\.19" AGENTS.md .planning/PROJECT.md` returns nothing | ✅ | ✅ green |
| 01-09 | 09 | 6 | PIFL-07 | sandbox | canaries never touch the real agent dir | live-only + grep | recorded README runs; `rg -n "pi-mcp-adapter@5.2.0|pi-subagents@0.74.0|pi-dynamic-workflows@3.14.0" scripts/pi.sh` | ✅ | ✅ green (manual-only part below) |
| 01-02, 01-04..01-08 | 02, 04-08 | 2-6 | ADET-01 | spoofing | built-in never satisfies the adapter | unit + e2e + RPC | `node --test tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts`; `PI_CM_E2E_REF=pinned node --test tests/e2e/adapter-detection-rpc.test.ts tests/e2e/install-soft-deps.test.ts` | ✅ | ✅ green |
| 01-02, 01-05, 01-06, 01-08 | 02, 05, 06, 08 | 2-6 | ADET-02 | spoofing | foreign `mcp` tool does not count | unit + e2e | `node --test tests/platform/pi-api.test.ts` | ✅ | ✅ green |

Amendments since planning: the adapter floor is `>=5.2.0 <6` (D-04-12,
D-07-07) and the engine pin is 3.14.0 (quick task 261006-kr1). Main's #236
deleted `tests/architecture/workflows-doc-pins.test.ts` and
`lint:type-members` as policy; PIFL-01 and PIFL-04 now rest on
`peer-floor.test.ts` and the typecheck.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/platform/pi-inventory-seed.ts` — shared `toolInfo` (with `exposure`) and adapter, built-in and foreign inventory seeds (D-01-13)
- [x] `expectSoftDepProbes` helper in `tests/edge/notification-boundary.ts` (port of the features/mcp helper) before `getCommands()` is read
- [x] `tests/integration/pi-subagents-peer.ts` — shared loader (IN-04)
- [x] `tests/e2e/_rpc.ts` plus the real-Pi detection test (D-01-14)
- [x] `tests/live-uat/openai-stub-server.mjs` (D-01-15)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stop canary and both engine canaries pass on Pi 1.0 (engine 3.13.1, storage canary re-run on 3.14.0) | PIFL-07 | needs a live Pi turn and a scratch engine install outside the repo | executor runs the `tests/live-uat/README.md` recipes and their negative controls; the verifier reads the recorded output |
| `docs/workflows-compatibility.md` stamps match the 3.13.0 → 3.13.1 body diffs | D-01-10 | judgement over a tarball diff | the diff recipe output is recorded in the plan SUMMARY |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-09 (retroactive; no gaps found)

## Validation Audit 2026-10-10

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
