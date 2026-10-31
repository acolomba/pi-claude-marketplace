---
phase: "5"
slug: "automatic-migration-on-reload"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

Filled by the planner from the PLAN.md tasks (2026-10-08). The requirement-level rows below the task map are the researcher's seed, kept for traceability; each names the task that now owns it.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | AMIG-01, AMIG-03 | T-05-01..04 | `/reload` moves a path-source plugin's entry with the fresh-install bytes; nothing carried; one info notice; second reload changes no bytes | integration | `TMPDIR=/var/tmp/mcp4-p5-01 node --test tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-01-02 | 01 | 1 | AMIG-01 | T-05-03 | Owner reader groups by marker; marker-keyed removal keeps foreign content; unparseable `mcp.json` left unchanged | unit | `node --test tests/bridges/mcp/legacy.test.ts tests/bridges/mcp/marker.test.ts tests/bridges/mcp/index.test.ts` + direct coverage | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | AMIG-01, AMIG-03 | T-05-01, T-05-02, T-05-04 | Step order adapter -> state -> legacy; pristine scope untouched; placement before `applyPlan`; throw becomes a row; notice before cascade; catalog byte lock | unit + arch | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts tests/orchestrators/reconcile/apply.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/mcp-migration-notice.test.ts` + direct coverage | ✅ | ✅ green |
| 5-02-01 | 02 | 2 | AMIG-01 | T-05-06, T-05-07 | A server with tool permission rules installs without `--partial` and warns; no tool name or value in a notice | integration | `TMPDIR=/var/tmp/mcp4-p5-02 node --test tests/integration/mcp-tool-rules.test.ts` | ✅ | ✅ green |
| 5-02-02 | 02 | 2 | AMIG-01 | T-05-08 | Classifier flip, rule reader, stage notice, rendering, unstage fold; malformed rules still malformed | unit | `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/stage.test.ts tests/shared/notification-dispatch.test.ts tests/orchestrators/marketplace/shared.test.ts` + direct coverage | ✅ | ✅ green |
| 5-02-03 | 02 | 2 | AMIG-01, AMIG-03 | T-05-06 | Catalog and compatibility doc; a migrated rules plugin matches a fresh install | arch + integration | `node --test tests/architecture/mcp-config-notices.test.ts tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-03-01 | 03 | 3 | AMIG-01, AMIG-02 | T-05-09, T-05-12 | A real install removes the plugin's old `mcp.json` entry and its old-name leftovers after writing; unrelated marker-less entries and a user's own full server under the old name (no `directTools`) stay | integration | `TMPDIR=/var/tmp/mcp4-p5-03 node --test tests/integration/mcp-legacy-sweep.test.ts tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-03-02 | 03 | 3 | AMIG-02 | T-05-11 | Reinstall and update sweep after their adapter writes; install rollback restores both files byte for byte | unit | `node --test tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/install-outcome.test.ts` + direct coverage | ✅ | ✅ green |
| 5-03-03 | 03 | 3 | AMIG-01, AMIG-02 | T-05-09, T-05-11 | Leftover filter, identical-bytes skip, ordered replace and rollback (legacy restore first; adapter kept when it fails); leftover notice byte lock | unit + arch | `node --test tests/bridges/mcp/legacy.test.ts tests/bridges/mcp/stage.test.ts tests/shared/notification-dispatch.test.ts tests/architecture/mcp-config-notices.test.ts` + direct coverage | ✅ | ✅ green |
| 5-04-01 | 04 | 4 | AMIG-04 | T-05-14 | Unowned entry stays with a warning; other-scope record does not own it; a planned install sweeps it with no warning | integration | `TMPDIR=/var/tmp/mcp4-p5-04 node --test tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-04-02 | 04 | 4 | AMIG-01 | T-05-13, T-05-15, T-05-16 | Recorded-sha fs-only probe; unreadable sources, collisions (label, no absolute path) and broken files stay with rows and no write | unit | `node --test tests/orchestrators/plugin/git-source-probe.test.ts tests/bridges/mcp/legacy.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts` + direct coverage | ✅ | ✅ green |
| 5-04-03 | 04 | 4 | AMIG-01, AMIG-03 | T-05-13 | Left-in-place rows byte-locked; a cold git cache warms into a move | unit + arch + integration | `node --test tests/shared/notification-dispatch.test.ts tests/architecture/mcp-migration-notice.test.ts tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-05-01 | 05 | 5 | AMIG-01, AMIG-03 | T-05-17 | Undeclared removed, unsupported dropped (record partially installed, info breakdown), malformed emptied, leftovers listed | integration | `TMPDIR=/var/tmp/mcp4-p5-05 node --test tests/integration/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-05-02 | 05 | 5 | AMIG-02 | T-05-18 | Recorder of real writes: `[mcp-adapter.json, state.json, mcp.json]`; injected fault, crash points and half-done state converge; `lockedLink` refusal loses no server | unit + integration | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts tests/integration/mcp-migration.test.ts` + direct coverage | ✅ | ✅ green |
| 5-05-03 | 05 | 5 | AMIG-03 | T-05-17 | Removed and unfinished rows byte-locked; info/warning rules | unit + arch | `node --test tests/shared/notification-dispatch.test.ts tests/architecture/mcp-migration-notice.test.ts` + direct coverage | ✅ | ✅ green |

Researcher seed rows (owner task in the first column):

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-01-01, 5-01-03 | 01 | 1 | AMIG-01 | — | Path-source plugin: marked legacy entries deleted, servers installed fresh as `plugin_<p>_<s>_` (final Phase 3/4 shape); nothing carried from the legacy entry (D-05-09) | unit | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` | ✅ | ✅ green |
| 5-04-02, 5-04-03 | 04 | 4 | AMIG-01 | — | Git-source plugin with warm `resolvedSha` clone migrates; cold cache leaves entries with the reinstall remedy; no network module touched (D-05-18, NFR-5) | unit | same file + `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ✅ | ✅ green |
| 5-01-01 | 01 | 1 | AMIG-01 | — | Second run: zero writes, byte-identical `mcp.json`, `mcp-adapter.json`, `state.json`; no lock taken in a scope with no legacy entries (D-05-16) | unit | mcp-migration test | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | AMIG-01 | — | Runs inside the per-scope reconcile loop before `applyPlan`; notice before the cascade; a throw becomes a warning row, never escapes (D-05-17, NFR-2) | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ | ✅ green |
| 5-05-02 | 05 | 5 | AMIG-02 | — | Injected fault after the adapter write: no server lost; recorded order `mcp-adapter.json` -> `state.json` -> `mcp.json`; next run writes only `mcp.json`; third run writes nothing | unit (operations seam) | mcp-migration test | ✅ | ✅ green |
| 5-05-02 | 05 | 5 | AMIG-02 | — | Same fault from a real filesystem refusal (`lockedLink`) through `applyReconcile` | integration | `npm run test:integration` (`tests/integration/mcp-migration.test.ts`) | ✅ | ✅ green |
| 5-03-01, 5-03-02, 5-03-03 | 03 | 3 | AMIG-02 | — | D-05-08 sweep on install, enable, import, reconcile install, reinstall, update: adapter write before legacy removal; rollback restores bytes | unit | owner tests of `install-outcome`, `reinstall-replace`, `update-swap` | ✅ | ✅ green |
| 5-01-03, 5-04-03, 5-05-03 | 01, 04, 05 | 1, 4, 5 | AMIG-03 | — | One notice per reload, both scopes, project before user; info when all moved, warning when anything left/dropped/removed; cost line; D-04-10 and D-05-05 lines; reload hint says reload now; old names sanitized | architecture lock + unit | `node --test tests/architecture/mcp-migration-notice.test.ts tests/shared/notification-dispatch.test.ts` | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | AMIG-03 | — | Silent when nothing moved, removed or left | unit | mcp-migration + apply tests | ✅ | ✅ green |
| 5-04-01, 5-04-02 | 04 | 4 | AMIG-04 | — | Unowned entry left in place with a warning; suppressed when the plan installs that plugin, whose install sweep then removes it | unit + integration | mcp-migration test; integration with `claude-plugins.json` declaring the plugin | ✅ | ✅ green |
| 5-02-01, 5-02-02, 5-02-03 | 02 | 2 | D-05-05 | T-05-06, T-05-08 | `tools[].permission_policy` / `toolPermissions` servers install with the new warning on every staging path; no longer `{unsupported mcp}` | unit + architecture lock | `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/stage.test.ts` + catalog locks | ✅ | ✅ green |
| 5-05-01, 5-05-02 | 05 | 5 | D-05-06 | — | Unsupported server dropped, rest installed, record `partially-installed`, notice names server + feature | unit | mcp-migration test | ✅ | ✅ green |
| 5-05-01, 5-05-02 | 05 | 5 | D-05-07 | — | Malformed server: plugin MCP unavailable, all legacy entries removed, none written, record MCP inventory emptied; fresh install still refuses | unit | mcp-migration test; `tests/domain/mcp-resolution.test.ts` | ✅ | ✅ green |
| 5-03-01, 5-03-03, 5-05-01 | 03, 05 | 3, 5 | D-05-10 | T-05-09 | Old-name override stub and panel full copy (a full definition carrying `directTools`) deleted only under the matching rule (no marker, moved old name, one of those two shapes, adapter-written file); a marker-less user full server under an old name without `directTools`, and a marker-less server under an unrelated name, are untouched | unit + integration | mcp-migration test + bridge owner tests + `tests/integration/mcp-legacy-sweep.test.ts` | ✅ | ✅ green |
| 5-04-02 | 04 | 4 | D-05-11 | — | Full definition at the new key in another source: plugin moves nothing; warning names key and source label (no absolute path) | unit | mcp-migration test | ✅ | ✅ green |
| 5-04-02 | 04 | 4 | D-05-19 | — | Unparseable `mcp.json` or `mcp-adapter.json`: no write in that scope, one row naming scope and file | unit | mcp-migration test | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/reconcile/mcp-migration.test.ts` — pairs the new migration module
- [x] `tests/architecture/mcp-migration-notice.test.ts` — catalog byte lock for the notice
- [x] `tests/integration/mcp-migration.test.ts` — end to end through `applyReconcile`, `lockedLink` fault
- [x] Shared legacy-fixture builder (0.19.x `mcp.json` shape) — a non-`.test.ts` file under `tests/` makes the commit hook run every pair; budget for it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real adapter 5.1.0 loads the migrated entries and drops the old names after the next `/reload` | AMIG-01, AMIG-03 | Needs a live Pi + adapter session | Phase 7 live UAT (ADOC-02) seeds a legacy entry and counts reloads |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-08

## Validation Audit 2026-10-08

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
