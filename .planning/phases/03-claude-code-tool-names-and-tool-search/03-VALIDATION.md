---
phase: "3"
slug: "claude-code-tool-names-and-tool-search"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-06"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node 26 locally, Node 24 in CI) |
| **Config file** | none — scripts in `package.json`; reporter `scripts/test-reporter.mjs` |
| **Quick run command** | `node --test tests/<area>/<file>.test.ts` (the owner test of the touched source) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~75 seconds (`npm run check`); owner tests a few seconds |

---

## Sampling Rate

- **After every task commit:** the pre-commit hook runs `npm run check:commit` (static + unpaired + staged source-test pairs); during work, the owner test.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` green; record command, exit status, commit and Node version.
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled by the planner from 03-RESEARCH.md "Phase Requirements → Test Map"; task IDs are assigned when plans exist.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-xx-xx | — | — | ANAME-01 | — | N/A | unit | `node --test tests/domain/name.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-xx | — | — | ANAME-02 | — | N/A | unit | `node --test tests/domain/components/hooks/matcher.test.ts tests/bridges/hooks/dispatch.test.ts tests/bridges/agents/convert.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-xx | — | — | ANAME-03 | — | Refuse before any write (bytes unchanged) | unit | `node --test tests/bridges/mcp/stage.test.ts tests/bridges/mcp/collision-slots.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-xx | — | — | ANAME-04/05/06 | — | N/A | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/domain/plugin-resolver.test.ts` | ✅ extend | ⬜ pending |
| 3-xx-xx | — | — | ANAME-07 | T-03 (closed translation) | No plugin-set `auth`, `approveTools`, `requestHeadersCommand`, `inheritEnv`, `bearerToken*`, `cwd` reaches the entry | unit (security) | `node --test tests/bridges/mcp/adapter-entry.test.ts` + new domain module test | ❌ W0 | ⬜ pending |
| 3-xx-xx | — | — | ANAME-07 / D-03-10 | — | N/A | unit + integration + catalog | `node --test tests/domain/mcp-resolution.test.ts tests/domain/plugin-resolver.test.ts tests/orchestrators/plugin/install-flow.test.ts && npm run test:architecture` | ✅ extend + catalog fixtures | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Paired test for the new domain field-table / unsupported-feature module (e.g. `tests/domain/mcp-server-features.test.ts`)
- [ ] Shared expected-key helper (or production builder import) for the MCP-touching tests whose keys change
- [ ] Catalog-uat fixtures for every new `{unsupported mcp}` block in `docs/output-catalog.md`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real adapter 5 loads the new entry, tools reachable through `mcp({ search })`, marker content ignored | ANAME-01, ANAME-04 | Needs a live Pi 1.0 + pi-mcp-adapter 5.0.0 run; formal UAT is Phase 7 ADOC-02 | Reuse the sandbox recipe in 03-RESEARCH.md "Measurement record" (`~/.cache/pi-cm-phase3-research/bin/run.sh`) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
