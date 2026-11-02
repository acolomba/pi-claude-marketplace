---
phase: "6"
slug: "mcp-servers"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-01"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit, integration); @cucumber/cucumber (behavioral) |
| **Config file** | `cucumber.json` (frozen), `tsconfig.json` |
| **Quick run command** | `/tmp/claude-0/-home-user-pi-claude-marketplace/5aec957e-dc04-5dcd-ad24-f2ccbabeb40f/scratchpad/nondac-sh -c 'NODE_OPTIONS=--max-old-space-size=6144 npx cucumber-js features/mcp-server'`; `node --test test/domain/mcp-resolution.test.ts` |
| **Full suite command** | `npm run check` (nondac env); phase gate adds `npm run test:modules` and `npm run test:cucumber` |
| **Estimated runtime** | ~120 seconds quick; ~15 minutes full |

---

## Sampling Rate

- **After every task commit:** the touched feature file, the pair test, and `npm run check:features`
- **After every plan wave:** `npm run check` on the merged tree
- **Before `/gsd-verify-work`:** `npm run check`, `npm run test:modules`, `npm run test:cucumber` green (seeds recorded)
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| MCP-01 | search returns `mcp__plugin_demo_stub__echo`; negative controls (no server, no match) | cucumber | `npx cucumber-js features/mcp-server/listing.feature` | ✅ | ✅ green |
| MCP-02 | proxy and direct calls reach the stub; an unlisted tool is never sent | cucumber | `npx cucumber-js features/mcp-server/invocation.feature` | ✅ | ✅ green |
| MCP-03 | env, `${VAR}`, `${VAR:-default}`, plugin path variables reach the stub; loopback HTTP headers, OAuth, unset header | cucumber + unit | `npx cucumber-js features/mcp-server/configuration.feature` | ✅ | ✅ green |
| MCP-04 | merge order, array and entry rules, `.mcpb` `{unsupported mcp}`; file-source defects skipped silently, inline and escaping refused (red proofs recorded) | cucumber + unit | `npx cucumber-js features/mcp-server/sources.feature features/mcp-server/invalid-configs.feature`; `node --test test/domain/mcp-resolution.test.ts` | ✅ | ✅ green |
| MCP-05 | trusted+allow connects; trusted without allow and untrusted blocked; info `pending approval` | cucumber | `npx cucumber-js features/mcp-server/project-scope.feature` | ✅ | ✅ green |
| MCP-06 | `{requires pi-mcp-adapter}`; later adapter reaches the server with no reinstall; info status | cucumber | `npx cucumber-js features/mcp-server/companion-missing.feature` | ✅ | ✅ green |
| MCP-07 | foreground agent result pinned (D-CF6-10 gap); stub gets no `tools/call`; no-tools agent gets no MCP tool | cucumber | `npx cucumber-js features/mcp-server/invocation.feature` | ✅ | ✅ green (gap pinned) |
| MCP-08 | disable/uninstall remove the server; enable restores; update replaces (no-update control); user `disabled` override survives | cucumber | `npx cucumber-js features/mcp-server/lifecycle.feature` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements; wave 1 adds the shared steps and fixture writers.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-01 (phase gate: `npm run check` seed 961879, `test:cucumber` seeds 512508 and 920909, all 1268 scenarios green)

## Validation Audit 2026-11-01

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
