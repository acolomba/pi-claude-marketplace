---
phase: 5
slug: plugin-orchestrators
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-10
revised: 2026-05-10
---

# Phase 5 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node ≥22.18 native TS strip) |
| **Config file** | none -- `npm test` invokes `node --test "tests/**/*.test.ts"` |
| **Quick run command** | `npm test -- tests/orchestrators/plugin/<file>.test.ts` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~30s full suite (current 521 tests) |

---

## Sampling Rate

- **After every task commit:** Run targeted `npm test -- tests/<scope>.test.ts` for the touched file
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> One row per requirement-ID coverage point. Each row's "Secure Behavior" cell is the verbatim REQUIREMENTS.md text. Plan/wave columns are bound to the 10-plan layout from `05-NN-PLAN.md`.

| REQ ID | Plan | Wave | Secure Behavior (REQUIREMENTS.md verbatim) | Test Type | Automated Command | File Exists | Status |
|--------|------|------|-------------------------------------------|-----------|-------------------|-------------|--------|
| **PI-1** | 05-06 | 2 | Token parsed as `<plugin>@<marketplace>` with exactly one `@`, both halves non-empty | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-2** | 05-06 | 2 | Resolution consults already-cached manifest; install MUST NOT trigger network sync (asymmetric with `update`) | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-3** | 05-06 | 2 | Plugins not in manifest fail with `Plugin "<name>" not found in marketplace "<mp>".` | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-4** | 05-06 | 2 | Non-installable resolver result fails with `Plugin "<name>" is not installable: <notes>` | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-5** | 05-06 | 2 | Already-installed plugins fail with "already installed" error | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-6** | 05-04 | 1 | Cross-plugin name conflicts (skill, prompt, agent) block install; one message lists every conflicting name | unit | `npm test -- tests/orchestrators/plugin/shared.test.ts` | ❌ W0 | ⬜ pending |
| **PI-7** | 05-06 | 2 | Version from manifest → marketplace-entry → `hash-<12hex>` SHA-256; ENOENT/ENOTDIR surface; algorithm + 12-char truncation stable | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-8** | 05-06 | 2 | Staging in tmp dir on same filesystem as destination; commit is atomic rename; staging-dir leaks surface as `cleanupWarnings` | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-9** | 05-06 | 2 | Staging order skills/prompts → agents → MCP → state commit; failure rolls back earlier phases; rollback failures surface `(rollback partial: …)` | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-10** | 05-06 | 2 | `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substituted in skill bodies, command files, agent bodies | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-11** | 05-06 | 2 | Agents staged + `pi-subagents` unloaded → canonical pi-subagents warning string in message | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-12** | 05-06 | 2 | MCP servers staged + `pi-mcp-adapter` unloaded → canonical pi-mcp-adapter warning string in message | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-13** | 05-06 | 2 | Plugins declaring `dependencies` install with manual-install warning | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PI-14** | 05-02 | 0 | `PathContainmentError` MUST NOT be folded into the "rollback partial" line | unit | `npm test -- tests/transaction/rollback.test.ts` | ❌ W0 | ⬜ pending |
| **PI-15** | 05-06 | 2 | Concurrent install detected at state-guard commit rolls back staged resources with "was installed concurrently" error | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **PU-1** | 05-07 | 2 | Order: skills/prompts → agents → MCP → state-guard commit → per-plugin data dir cleanup | integration | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-2** | 05-07 | 2 | Per-plugin data-dir cleanup AFTER state commit so EACCES cannot strand state in `installed=true` | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-3** | 05-07 | 2 | Failures earlier than data-dir cleanup abort uninstall with marketplace record intact (retryable) | integration | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-4** | 05-07 | 2 | Data-dir cleanup leaks surface at `warning` severity, leaked path named in body | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-5** | 05-07 | 2 | Tolerate concurrent uninstall by another process (silent converge if record already gone at commit) | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-6** | 05-07 | 2 | Legacy state records missing `resources.agents`/`resources.mcpServers` load-time-migrated to `[]` | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-7** | 05-07 | 2 | Foreign content at agent target (basename or generated marker missing) retained in index with `failed[]`; uninstall fails loudly | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PU-8** | 05-07 | 2 | Emit reload hint `Run /reload to drop "<plugin>"` when any resource removed | unit | `npm test -- tests/orchestrators/plugin/uninstall.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-1** | 05-09 | 3 | Three forms: bare / `@mp` / `pl@mp`; empty target set succeeds silently with `No plugins installed.` | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-2** | 05-09 | 3 | `update` refreshes GitHub clone (`syncClone`) once per marketplace before reading manifest | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-3** | 05-09 | 3 | Resolved version equals recorded version → reported `unchanged` (no I/O) | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-4** | 05-09 | 3 | No longer installable per resolver → `skipped` with `no longer installable: <notes>` | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-5** | 05-09 | 3 | Missing from refreshed manifest → `skipped: not in manifest` | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-6** | 05-09 | 3 | Three phases: prepare (write tmp) → state-guard swap → physical replace + soft-dep commit; phase-3 failure → recovery hint to uninstall+install | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-7** | 05-09 | 3 | Phase-3 failure cleans staging dir and aborts agents/MCP staging without masking original error | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-8** | 05-09 | 3 | Reload hint emitted when ≥1 plugin actually updated | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PUP-9** | 05-09 | 3 | Direct (non-cascade) `update` throws → `error`-severity notification with `Error.cause` chained; `failed` partition is cascade-only | unit | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **PL-1** | 05-08 | 2 | No flags shows every bucket; flags select union of buckets | integration | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-2** | 05-08 | 2 | No marketplace name → nested tree grouped by scope, marketplaces as section headings | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-3** | 05-08 | 2 | With marketplace name → only that marketplace's plugin list | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-4** | 05-05 + 05-08 | 1/2 | Each entry shows icon (●/○/⊘), name, optional `(<version>)`, status marker; description on second indented line truncated at column 66 | unit | `npm test -- tests/presentation/plugin-list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-5** | 05-08 | 2 | Plugin is `upgradable` iff manifest version differs (string compare) from install record | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-6** | 05-08 | 2 | Marketplace manifest load failure shows `[warning] could not load manifest: <reason>` and STILL renders installed plugins | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **PL-7** | 05-08 | 2 | Per-marketplace headers include `[autoupdate]` tag when flag is on | unit | `npm test -- tests/orchestrators/plugin/list.test.ts` | ❌ W0 | ⬜ pending |
| **RN-3** | 05-04 | 1 | Cross-plugin install conflict guard runs BEFORE any disk write and lists every conflicting name in one message | unit | `npm test -- tests/orchestrators/plugin/shared.test.ts` | ❌ W0 | ⬜ pending |
| **AS-2** | 05-06 | 2 | Install ordering: skills/prompts → agents → MCP → state commit | integration | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **AS-3** | 05-09 | 3 | Update is three-phase: prepare in tmp → state-guard swap (with old-resource snapshot) → physical replace + soft-dep commit | integration | `npm test -- tests/orchestrators/plugin/update.test.ts` | ❌ W0 | ⬜ pending |
| **AS-6** | 05-06 + 05-07 + 05-09 | 2/3 | Post-commit cleanup leaks surface as `cleanupWarnings` and bump message severity to `warning`; state already committed | integration | `npm test -- tests/orchestrators/plugin/*.test.ts` | ❌ W0 | ⬜ pending |
| **AS-7** | 05-06 | 2 | Specific guidance emitted when install rollback leaves orphan agent index entries (whole-plugin index unreadable vs specific entries orphaned) | unit | `npm test -- tests/orchestrators/plugin/install.test.ts` | ❌ W0 | ⬜ pending |
| **NFR-2** | 05-06 + 05-07 + 05-09 | 2/3 | No fix requires Pi restart; `Run /reload` MUST suffice | manual | smoke test, see Manual-Only Verifications | n/a | ⬜ pending |
| **NFR-3** | 05-06 + 05-07 + 05-09 | 2/3 | All operations safe to retry on transient failure (idempotent or fail-clean) | integration | `npm test -- tests/orchestrators/plugin/*.test.ts` | ❌ W0 | ⬜ pending |
| **D-07 (COMP-01)** | 05-03 | 0 | `componentPaths` array SUPPLEMENT semantics; first-wins on duplicate paths | unit | `npm test -- tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/bridge/discover-*.test.ts` | ✅ (update) | ⬜ pending |
| **D-07 (errors)** | 05-01 | 0 | New error classes (`ConcurrentUninstallError`, `ComponentPathRefuseError`, `ForeignAgentContentError`, `Phase3Error`) | unit | `npm test -- tests/shared/errors.test.ts` | ✅ (extend) | ⬜ pending |
| **D-07 (markers)** | 05-01 | 0 | `RECOVERY_PLUGIN_REINSTALL_PREFIX` marker constant + snapshot-test extension | unit | `npm test -- tests/shared/markers.test.ts` | ✅ (extend) | ⬜ pending |
| **D-07 (architecture)** | 05-02 | 0 | No orchestrator imports network helpers (source-grep test with `stripComments()`) | architectural | `npm test -- tests/architecture/no-orchestrator-network.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is the foundation slice. It must land before Wave 1 helpers, Wave 2 commands, or Wave 3 update. Three parallel plans deliver the slice:

**Plan 05-01 (markers + errors extensions):**
- [ ] `src/shared/markers.ts` -- add `RECOVERY_PLUGIN_REINSTALL_PREFIX`
- [ ] `tests/shared/markers.test.ts` -- separate test block (preserve existing `literals.length === 5` assertion; do not extend the 5-row snapshot)
- [ ] `src/shared/errors.ts` -- add `ConcurrentUninstallError`, `ComponentPathRefuseError`, `ForeignAgentContentError`, `Phase3Error`
- [ ] `tests/shared/errors.test.ts` -- extend with the 4 new error cases

**Plan 05-02 (PI-14 bypass + architectural NFR-5 test):**
- [ ] `src/transaction/rollback.ts` -- add `instanceof PathContainmentError` short-circuit inside `formatRollbackError`
- [ ] `tests/transaction/rollback.test.ts` -- add bypass case
- [ ] `tests/architecture/no-orchestrator-network.test.ts` -- source-grep architectural assertion using `stripComments()` to avoid header-docstring false positives

**Plan 05-03 (D-07 / COMP-01 resolver + bridges + supporting tests):**
- [ ] `src/domain/resolver.ts` -- `ComponentPathsSchema` array migration (readonly-string-array-per-kind, SUPPLEMENT semantics, first-wins on duplicates)
- [ ] `src/bridge/skills/discover.ts`, `src/bridge/prompts/discover.ts`, `src/bridge/agents/discover.ts` -- array iteration with per-path containment guard
- [ ] `tests/domain/resolver-strict.test.ts`, `tests/domain/resolver-loose.test.ts` -- update assertions for the array shape + COMP-01 fixtures
- [ ] `tests/bridge/discover-skills.test.ts`, `discover-prompts.test.ts`, `discover-agents.test.ts` -- array fixtures + first-wins dedup case
- [ ] Add `pluginDataDir` escape-path tests (the method already exists at `persistence/locations.ts:132` -- verify-only, do NOT re-add)

*All other waves (1-4) are blocked-by Wave 0.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `Run /reload` recovery in live Pi process | NFR-2 | Requires running `pi` interactively, observing extension reload, and confirming components register | 1. Install a plugin. 2. Verify `/reload` re-registers extension. 3. Uninstall. 4. Verify `/reload` drops it. Repeat for `update`. |
| Cross-process state-guard contention | PU-3, PUP-4 | Concurrent process spawning is hostile to deterministic test runners | Spawn two `pi` instances, run uninstall in both -- confirm silent-converge in one, success in the other, no state corruption |
| Manifest-load-failure user-facing message format | PL-6 | Visual confirmation of column-66 truncation and `[warning]` prefix rendering in terminal | Run `/claude:plugin list` against a broken-manifest fixture; eyeball indentation and truncation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
