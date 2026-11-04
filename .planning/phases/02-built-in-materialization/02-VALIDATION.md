---
phase: "2"
slug: "built-in-materialization"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-04"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (unit, integration), `@cucumber/cucumber` (profiles `adapter` and `builtin`) |
| **Config file** | `cucumber.json`, `package.json` scripts (both frozen) |
| **Script prefix** | `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/c8fa846b-6efd-592e-ae3c-12be087a8d83/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` |
| **Quick run command** | `node --test <test file>` and `npm run test:coverage:direct -- <source>` |
| **Full suite command** | `npm run check` in parts (`check:static`, `test:unpaired`, `test:integration`, `test:coverage:direct:all`) plus `npm run test:cucumber:profile` under `adapter` and `builtin`; the phase gate adds `npm run test:modules` |
| **Estimated runtime** | unit 0.2-1.2 s per file; one builtin feature 20-60 s; full adapter profile about 7 min; full builtin profile 1-3 min |

---

## Sampling Rate

- **After every task commit:** the touched pairs' `node --test` and direct coverage, `npm run check:static`, and the owned feature file under each profile it applies to.
- **After every plan wave:** `npm run check` in parts plus both cucumber profiles on the whole tree.
- **Before `/gsd-verify-work`:** full suite green, plus `npm run test:modules`; red proofs recorded per profile.
- **Max feedback latency:** 120 seconds for a task-level check.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| MSEL-03 | No registration under adapter or none | unit + cucumber | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts`; adapter profile on `implementation-switch.feature` | seed ✅ / feature ❌ | ⬜ pending |
| MSEL-02 | Switch adapter → none → built-in → adapter, no plugin command | cucumber (`@own-implementation`) | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature` | ❌ W2 | ⬜ pending |
| MSEL-04 | Installed under built-in, reached under adapter after restart | cucumber | same file | ❌ W2 | ⬜ pending |
| MREC-02 | Legacy record (no `mcpServerConfigs`) reaches its server | unit + cucumber | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts`; builtin profile on the owning feature | ❌ | ⬜ pending |
| BLT-01 | Registered at startup and `/reload`; deferred via `tool_search`, `alwaysLoad` direct | unit + cucumber | `node --test test/bridges/mcp/builtin-registration.test.ts`; builtin profile on `listing.feature`, `invocation.feature` | ❌ | ⬜ pending |
| BLT-02 | Transports, fields, expansion, `$`/`!`, timeout seconds, OAuth | unit + integration + cucumber | `node --test test/domain/mcp-builtin-translation.test.ts test/bridges/mcp/builtin-escape.test.ts test/bridges/mcp/builtin-entry.test.ts`; `node --test test/integration/mcp-builtin-*.test.ts`; builtin profile on `configuration.feature`, `sources.feature` | ❌ | ⬜ pending |
| BLT-02 | Adapter output byte-identical | unit + integration | `node --test test/bridges/mcp/substitute.test.ts test/bridges/mcp/adapter-entry.test.ts test/integration/adapter-expansion-conformance.test.ts` | ✅ | ⬜ pending |
| BLT-03 | Project servers only while trusted | unit + cucumber | builtin profile on `project-scope.feature` and the built-in trust feature | ❌ | ⬜ pending |
| BLT-04 | Names, fold, overrides reported | unit + cucumber | builtin profile on `listing.feature` and the built-in status feature | ❌ | ⬜ pending |
| BLT-05 | `info` statuses | unit + cucumber | `node --test test/orchestrators/plugin/info-mcp-status.test.ts test/platform/mcp-builtin-status.test.ts`; builtin profile on the built-in status feature | pairs ✅ / feature ❌ | ⬜ pending |
| BLT-06 | Disable, uninstall, enable, update take effect next session | cucumber both profiles | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/lifecycle.feature` (and adapter) | ❌ (tags lifted) | ⬜ pending |
| MDOC-01 | Built-in column with a citation per statement | docs lint + review | `pre-commit run --files docs/mcp-compatibility.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/domain/mcp-builtin-translation.test.ts`, `test/bridges/mcp/builtin-{escape,entry,registration}.test.ts` — new pairs (BLT-01, BLT-02)
- [ ] `test/integration/mcp-builtin-*.test.ts` — Pi resolver and validator conformance (BLT-02)
- [ ] The `tool_search` projection lib and step (BLT-01)
- [ ] The legacy-record rewrite lib and step (MREC-02)
- [ ] A restart-scoped "not reached, no extension error" step (MSEL-02, MSEL-03)
- [ ] The registry-config probe extension for OAuth and timeout values (BLT-02, P2-DC-17)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each built-in statement in `docs/mcp-compatibility.md` cites a scenario or the Pi 1.5.0 source | MDOC-01 | Citation accuracy is a reading check | Read each built-in cell and open the cited scenario or file |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
