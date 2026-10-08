---
phase: "5"
slug: "automatic-migration-on-reload"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-08"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `05-RESEARCH.md` §Validation Architecture, adjusted for the revised
> decisions in `05-CONTEXT.md` (D-05-07, D-05-08, D-05-09, D-05-10, D-05-16..19).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` (Node 26 locally, 24 in CI) |
| **Config file** | none (scripts in `package.json`; reporter `scripts/test-reporter.mjs`) |
| **Quick run command** | `node --test <owner test of the touched file>` (e.g. `node --test tests/orchestrators/reconcile/mcp-migration.test.ts`) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~5-20 s; full ~75 s |

---

## Sampling Rate

- **After every task commit:** owner test(s) of the touched files; the commit hook runs `check:commit`.
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green on the combined tree
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Requirement-level map; the planner binds task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | AMIG-01 | — | Path-source plugin: marked legacy entries deleted, servers installed fresh as `plugin_<p>_<s>_` (final Phase 3/4 shape); nothing carried from the legacy entry (D-05-09) | unit | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-01 | — | Git-source plugin with warm `resolvedSha` clone migrates; cold cache leaves entries with the reinstall remedy; no network module touched (D-05-18, NFR-5) | unit | same file + `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ❌ / ✅ | ⬜ pending |
| TBD | TBD | TBD | AMIG-01 | — | Second run: zero writes, byte-identical `mcp.json`, `mcp-adapter.json`, `state.json`; no lock taken in a scope with no legacy entries (D-05-16) | unit | mcp-migration test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-01 | — | Runs inside the per-scope reconcile loop before `applyPlan`; notice before the cascade; a throw becomes a warning row, never escapes (D-05-17, NFR-2) | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | AMIG-02 | — | Injected fault after the adapter write: no server lost; recorded order `mcp-adapter.json` -> `state.json` -> `mcp.json`; next run writes only `mcp.json`; third run writes nothing | unit (operations seam) | mcp-migration test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-02 | — | Same fault from a real filesystem refusal (`lockedLink`) through `applyReconcile` | integration | `npm run test:integration` (`tests/integration/mcp-migration.test.ts`) | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-02 | — | D-05-08 sweep on install, enable, import, reconcile install, reinstall, update: adapter write before legacy removal; rollback restores bytes | unit | owner tests of `install-outcome`, `reinstall-replace`, `update-swap` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | AMIG-03 | — | One notice per reload, both scopes, project before user; info when all moved, warning when anything left/dropped/removed; cost line; D-04-10 and D-05-05 lines; reload hint says reload now; old names sanitized | architecture lock + unit | `node --test tests/architecture/mcp-migration-notice.test.ts tests/shared/notification-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-03 | — | Silent when nothing moved, removed or left | unit | mcp-migration + apply tests | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | AMIG-04 | — | Unowned entry left in place with a warning; suppressed when the plan installs that plugin, whose install sweep then removes it | unit + integration | mcp-migration test; integration with `claude-plugins.json` declaring the plugin | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05-05 | T-05 (planner) | `tools[].permission_policy` / `toolPermissions` servers install with the new warning on every staging path; no longer `{unsupported mcp}` | unit + architecture lock | `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/stage.test.ts` + catalog locks | ✅ update | ⬜ pending |
| TBD | TBD | TBD | D-05-06 | — | Unsupported server dropped, rest installed, record `partially-installed`, notice names server + feature | unit | mcp-migration test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05-07 | — | Malformed server: plugin MCP unavailable, all legacy entries removed, none written, record MCP inventory emptied; fresh install still refuses | unit | mcp-migration test; `tests/domain/mcp-resolution.test.ts` | ❌ / ✅ | ⬜ pending |
| TBD | TBD | TBD | D-05-10 | T-05 (planner) | Old-name disable stub and panel full copy deleted only under the matching rule (no marker, moved old name, adapter-written file); a marker-less user server under an unrelated name is untouched | unit | mcp-migration test + bridge owner tests | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05-11 | — | Full definition at the new key in another source: plugin moves nothing; warning names key and source label (no absolute path) | unit | mcp-migration test | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05-19 | — | Unparseable `mcp.json` or `mcp-adapter.json`: no write in that scope, one row naming scope and file | unit | mcp-migration test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/reconcile/mcp-migration.test.ts` — pairs the new migration module
- [ ] `tests/architecture/mcp-migration-notice.test.ts` — catalog byte lock for the notice
- [ ] `tests/integration/mcp-migration.test.ts` — end to end through `applyReconcile`, `lockedLink` fault
- [ ] Shared legacy-fixture builder (0.19.x `mcp.json` shape) — a non-`.test.ts` file under `tests/` makes the commit hook run every pair; budget for it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real adapter 5.1.0 loads the migrated entries and drops the old names after the next `/reload` | AMIG-01, AMIG-03 | Needs a live Pi + adapter session | Phase 7 live UAT (ADOC-02) seeds a legacy entry and counts reloads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
