---
phase: "3"
slug: "claude-code-tool-names-and-tool-search"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

Filled by the planner from 03-RESEARCH.md "Phase Requirements → Test Map". Each command is the task's own `<verify>` in short form; the plan file holds the exact command and its failure signal. Task commands that set `TMPDIR` use `/var/tmp/mcp4-p3-NN`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | ANAME-01, ANAME-04 | T-03-02 | Owned `toolPrefix`/`directTools` on every entry; a global or plugin `toolPrefix` cannot rename tools | unit + e2e | `node --test tests/domain/name.test.ts && node --test --test-name-pattern="^(ANAME-01\|AFILE-0\|PI-9\|D-102-02)" tests/orchestrators/plugin/install-flow.test.ts` | ✅ extend | ✅ green |
| 3-01-02 | 01 | 1 | ANAME-01 | T-03-03 | Cascade unstage maps removed keys back to declared names | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts tests/orchestrators/marketplace/shared.test.ts` + direct coverage | ✅ extend | ✅ green |
| 3-01-03 | 01 | 1 | ANAME-01 | — | N/A | unit + integration + e2e | `npm run test:modules && npm run test:integration && node --test tests/e2e/install-soft-deps.test.ts` | ✅ extend | ✅ green |
| 3-02-01 | 02 | 1 | ANAME-02 | T-03-04 | No RegExp built from matcher text | unit | `node --test tests/domain/components/hooks/matcher.test.ts tests/bridges/hooks/dispatch.test.ts` + direct coverage | ✅ extend | ✅ green |
| 3-02-02 | 02 | 1 | ANAME-02 | T-03-05 | Proxy-call hook gap documented | unit + docs | `node --test tests/domain/components/hooks/partition.test.ts tests/bridges/hooks/if-field/index.test.ts` | ✅ extend | ✅ green |
| 3-03-01 | 03 | 2 | ANAME-07 | T-03-06, T-03-07, T-03-08 | Closed table drops adapter-only and credential keys | unit + e2e | `node --test tests/domain/mcp-server-features.test.ts && node --test --test-name-pattern="^(ANAME-0\|AFILE-0)" tests/orchestrators/plugin/install-flow.test.ts` | ✅ created (03-03) | ✅ green |
| 3-03-02 | 03 | 2 | ANAME-06 | — | N/A | unit + e2e | `node --test tests/domain/plugin-resolver.test.ts && node --test --test-name-pattern="^ANAME-0" tests/orchestrators/plugin/install-flow.test.ts` | ✅ extend | ✅ green |
| 3-03-03 | 03 | 2 | ANAME-04, ANAME-05, ANAME-07 | T-03-06, T-03-07, T-03-08 | Every vendored `ServerEntry` and `OAuthConfig` key in hostile plugin input stays out of the entry | unit (security) + integration | `npm run test:modules && npm run test:integration` + direct coverage | ✅ extend | ✅ green |
| 3-04-01 | 04 | 3 | ANAME-07 | T-03-10 | An unhonored per-tool policy or helper refuses a normal install | unit + e2e + closed-set gates | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/partial-vocabulary-guard.test.ts && node --test --test-name-pattern="^ANAME-07" tests/orchestrators/plugin/install-flow.test.ts` | ✅ extend | ✅ green |
| 3-04-02 | 04 | 3 | ANAME-07 | T-03-11 | An invalid config is never half-honored (unavailable) | unit + parity + e2e | `node --test tests/domain/mcp-server-features.test.ts tests/domain/mcp-resolution.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/install.messaging.test.ts tests/architecture/cross-surface-reason-parity.test.ts` + direct coverage | ✅ extend | ✅ green |
| 3-04-03 | 04 | 3 | ANAME-03, ANAME-07 | T-03-12 | N/A | e2e + catalog gate | `npm run test:modules && npm run test:architecture && npm run test:integration` | ✅ extend + new catalog fixtures | ✅ green |
| 3-05-01 | 05 | 3 | ANAME-03 | T-03-13 | Refuse before any write (no file, no record) | unit + ledger e2e | `node --test tests/shared/errors-bridges.test.ts tests/bridges/mcp/stage.test.ts && node --test --test-name-pattern="^ANAME-03" tests/orchestrators/plugin/install-outcome.test.ts` | ✅ extend | ✅ green |
| 3-05-02 | 05 | 3 | ANAME-03 | T-03-13 | Folded clash refused within a plugin, across plugins and against user servers (bytes unchanged) | unit | `npm run test:modules && npm run test:integration` + direct coverage | ✅ extend | ✅ green |
| 3-06-01 | 06 | 4 | ANAME-01, ANAME-07 | — | N/A | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ extend | ✅ green |
| 3-06-02 | 06 | 4 | ANAME-07 | T-03-14 | N/A | unit + catalog gate | `npm run test:modules && npm run test:architecture && npm run test:integration` + direct coverage | ✅ extend + new catalog fixture | ✅ green |
| 3-07-01 | 07 | 4 | ANAME-02 | T-03-15 | Only servers this install writes are granted | unit + ledger e2e | `node --test tests/bridges/agents/convert.test.ts tests/bridges/agents/stage.test.ts && node --test --test-name-pattern="^ANAME-02" tests/orchestrators/plugin/install-outcome.test.ts` | ✅ extend | ✅ green |
| 3-07-02 | 07 | 4 | ANAME-02 | T-03-15, T-03-16 | A disallow never weakens without a trace | unit | `node --test tests/bridges/agents/convert.test.ts tests/bridges/agents/stage.test.ts` + direct coverage | ✅ extend | ✅ green |
| 3-07-03 | 07 | 4 | ANAME-02 | T-03-15 | A left-out server is never granted | ledger e2e | `npm run test:modules && npm run test:integration` + direct coverage | ✅ extend | ✅ green |
| 3-08-01 | 08 | 5 | ANAME-07 | T-03-18 | A stale plugin timeout never survives as a user value | unit + e2e | `node --test tests/bridges/mcp/marker.test.ts tests/bridges/mcp/adapter-entry.test.ts && node --test --test-name-pattern="^(ANAME-0\|AFILE-06)" tests/orchestrators/plugin/update-flow.test.ts` | ✅ extend | ✅ green |
| 3-08-02 | 08 | 5 | ANAME-07 | T-03-17 | The marker holds field names only | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/marker.test.ts` + direct coverage | ✅ extend | ✅ green |
| 3-08-03 | 08 | 5 | ANAME-07 | T-03-18 | The user's stub round-trips through a plugin-owned timeout | integration + notices lock | `npm run test:modules && npm run test:architecture && npm run test:integration` | ✅ extend | ✅ green |
| 3-09-01 | 09 | 5 | ANAME-03, ANAME-04, ANAME-05 | T-03-19 | Docs never say the extension edits Pi settings | docs lint | `pre-commit run markdownlint-cli2 --files docs/mcp-compatibility.md README.md` | ✅ created (03-09) | ✅ green |
| 3-09-02 | 09 | 5 | ANAME-05 | — | N/A | docs | `rg -q "Divergences" docs/mcp-compatibility.md` | ✅ created (03-09) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Audit 2026-10-06 (HEAD 5218c051; the source tree equals 0a8bf82d, only `STATE.md` differs): every row is green. The 20 focused owner-test runs pass with 0 failures on Node v26.10.0, and every name-filtered command matched tests, so none passed empty: `^ANAME-03` 1, `^ANAME-02` 2, `^(ANAME-0|AFILE-06)` 3, `^ANAME-07` 4, `^ANAME-0` 8, `^(ANAME-01|AFILE-0|PI-9|D-102-02)` 25, `^(ANAME-0|AFILE-0)` 29. `tests/e2e/install-soft-deps.test.ts` passes 8/8. The `test:modules`, `test:architecture` and `test:integration` parts of the composite rows rest on the wave-5 `npm run check` (`tmp/p3-wave5-check.log` ends `CHECK_EXIT=0`, run after 0a8bf82d). `markdownlint-cli2` passes on `docs/mcp-compatibility.md` and `README.md`, and the document has its `Divergences` section. Each of ANAME-01 to ANAME-07 has owner tests that cite its ID and assert its behavior.

---

## Wave 0 Requirements

- [x] Paired test for the new domain field-table / unsupported-feature module: `tests/domain/mcp-server-features.test.ts`, created by plan 03-03 Task 1 and completed by 03-03 Task 3 and 03-04 Task 2
- [x] Expected keys in MCP-touching tests: written literally in owner tests, and through the production `generatedMcpServerKey` import where a test derives them (e2e, plan 03-01 Task 3)
- [x] Catalog-uat fixtures for every new `{unsupported mcp}` block in `docs/output-catalog.md`: plan 03-04 Task 3 (install and list states) and plan 03-06 Task 2 (info state)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real adapter 5 loads the new entry, tools reachable through `mcp({ search })`, marker content ignored | ANAME-01, ANAME-04 | Needs a live Pi 1.0 + pi-mcp-adapter 5.0.0 run; formal UAT is Phase 7 ADOC-02 | Reuse the sandbox recipe in 03-RESEARCH.md "Measurement record" (`~/.cache/pi-cm-phase3-research/bin/run.sh`) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-06 (validate-phase audit on HEAD 5218c051)

## Validation Audit 2026-10-06

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
