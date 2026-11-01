---
phase: "6"
slug: "mcp-servers"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
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
| MCP-01 | search returns `mcp__plugin_demo_stub__echo`; negative control: call 1 lacks it | cucumber | `npx cucumber-js features/mcp-server/listing.feature` | ❌ W1 | ⬜ pending |
| MCP-02 | proxy call args reach the stub, result returned | cucumber | `npx cucumber-js features/mcp-server/invocation.feature` | ✅ seed | ⬜ pending |
| MCP-03 | root/data/`${VAR}` reach the stub; loopback HTTP with headers | cucumber + unit | `npx cucumber-js features/mcp-server/configuration.feature` | ❌ W2 | ⬜ pending |
| MCP-04 | merge order, file-source malformed skipped silently, inline malformed `{malformed mcp}`, `.mcpb` `{unsupported mcp}` (red proof first) | cucumber + unit | `node --test test/domain/mcp-resolution.test.ts` | ❌ W2 | ⬜ pending |
| MCP-05 | trusted+allow connects; trusted without allow and untrusted blocked (literal texts) | cucumber | `npx cucumber-js features/mcp-server/project-scope.feature` | ❌ W1/W2 | ⬜ pending |
| MCP-06 | `{requires pi-mcp-adapter}`; later adapter reaches the server, no reinstall | cucumber | `npx cucumber-js features/mcp-server/companion-missing.feature` | ❌ W2 | ⬜ pending |
| MCP-07 | foreground agent result pinned (D-CF6-10 gap); stub has no `tools/call` | cucumber | `npx cucumber-js features/mcp-server/invocation.feature` | ❌ W2 | ⬜ pending |
| MCP-08 | disable/uninstall unreachable; update replaces; override survives | cucumber | `npx cucumber-js features/mcp-server/lifecycle.feature` | ❌ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements; wave 1 adds the shared steps and fixture writers.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
