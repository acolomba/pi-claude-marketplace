---
phase: 3
slug: resource-bridges
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
---

# Phase 3 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution of the four resource bridges (skills, commands, agents, MCP).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node ≥22 built-in test runner; Phase 1/2 baseline) |
| **Config file** | none -- `package.json` declares `test` script that calls `node --test` |
| **Quick run command** | `npm run test -- --test-name-pattern <bridge>` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + full `node --test`) |
| **Estimated runtime** | ~10-20 seconds full suite |

---

## Sampling Rate

- **After every task commit:** Run the bridge-scoped `node --test` slice (≤3s)
- **After every plan wave:** Run `npm run check` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md generation. Each task gets a row mapping its REQ-ID(s) to a concrete `node --test` command (or Wave 0 dependency if the test file doesn't exist yet).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-1 | 01 | 1 | RN-6 | T-03-* (path-safety) | Substitution + bridge errors + symlink-safe fs ops | unit | `node --test "tests/shared/vars.test.ts" "tests/shared/errors-bridges.test.ts" "tests/shared/fs-utils.test.ts"` | ✅ exists | ✅ green |
| 3-01-2 | 01 | 1 | RN-6, AS-8, AS-9 | T-03-loc | Bridge-target paths derived from ScopedLocations only (NFR-10 containment) | unit | `node --test "tests/persistence/locations.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-01-3 | 01 | 1 | SK-4, CM-3, RN-4, RN-5 | T-03-fix | Fixture corpora for downstream bridge tests; foreign-agent fixtures cover marker/basename probes | fixture | `test -f tests/bridges/_fixtures/test-plugin/.claude-plugin/plugin.json && test -f tests/bridges/_fixtures/test-plugin/skills/acme-knowledge/SKILL.md && test -f tests/bridges/_fixtures/test-plugin/.mcp.json && test -f tests/bridges/_fixtures/empty-mcp/.claude-plugin/plugin.json && test -f tests/bridges/_fixtures/empty-agents/agents/.gitkeep && test -f tests/bridges/_fixtures/foreign-agents/no-marker.md && test -f tests/bridges/_fixtures/foreign-agents/wrong-basename.md` | ✅ exists | ✅ green |
| 3-02-1 | 02 | 1 | AG-2, AG-4, AG-7 | T-03-idx | TypeBox JIT validator rejects malformed agents-index rows | unit | `node --test "tests/persistence/agents-index-schema.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-02-2 | 02 | 1 | AG-2, AG-4 | T-03-idx | Atomic save (write-file-atomic); load throws on file-shape error, soft-fails per-row | unit | `node --test "tests/persistence/agents-index-io.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-03-1 | 03 | 2 | SK-1, SK-2, SK-3 | T-03-skl | Skill discovery + name generation + frontmatter rewrite (no extra-FS escape) | unit | `node --test "tests/bridges/skills/discover.test.ts" "tests/bridges/skills/rewrite-frontmatter.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-03-2 | 03 | 2 | SK-1, SK-2, SK-4, SK-5, AS-8, RN-6 | T-03-skl | Stage prepare/commit/abort + unstage with atomic rename, body-substitution, symlink-refusal | unit + integration | `node --test "tests/bridges/skills/**/*.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-04-1 | 04 | 2 | CM-1, CM-2 | T-03-cmd | Command discovery; CM-2 elision rule for slug == plugin name | unit | `node --test "tests/bridges/commands/discover.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-04-2 | 04 | 2 | CM-1, CM-2, CM-3, CM-4, RN-6 | T-03-cmd | Stage/commit/abort + unstage; body-substitution; collision detection | unit + integration | `node --test "tests/bridges/commands/**/*.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-05-1 | 05 | 2 | AG-5, AG-6, AG-7, AG-8, AG-10, AG-11, AG-12 | T-03-agt | AG-5 marker discipline (basename + body marker), convert mappings (model/tools/thinking), markers-snapshot guard | unit | `node --test "tests/bridges/agents/marker.test.ts" "tests/bridges/agents/frontmatter.test.ts" "tests/bridges/agents/convert.test.ts" "tests/bridges/agents/discover.test.ts" "tests/architecture/markers-snapshot.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-05-2 | 05 | 2 | AG-1, AG-2, AG-3, AG-4, AG-9, AS-9, RN-4 | T-03-agt | 10-step prepare partition; AG-9 cross-owner throw; AG-3 partition by (mp,plugin); AS-9 noop-no-materialize | unit + integration | `node --test "tests/bridges/agents/stage.test.ts" "tests/bridges/agents/index-mutation.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-05-3 | 05 | 2 | AG-5, AG-9 | T-03-agt | AG-5 unstage-time foreign-content soft-fail (preserve in failed[]); bridge-isolation (no cross-bridge imports) | unit + integration | `node --test "tests/bridges/agents/**/*.test.ts" && npx tsc --noEmit && ! grep -r "from \"\\.\\./skills\\|from \"\\.\\./commands\\|from \"\\.\\./mcp" extensions/claude-marketplace/bridges/agents/` | ✅ exists | ✅ green |
| 3-06-1 | 06 | 2 | MC-1, MC-2, MC-5, MC-8 | T-03-mcp | Per-server `_claudeMarketplace` marker; MC-1 precedence chain no-fallthrough; MC-2 wrapped+unwrapped parse; four-slot enumeration | unit | `node --test "tests/bridges/mcp/marker.test.ts" "tests/bridges/mcp/parse.test.ts" "tests/bridges/mcp/collision-slots.test.ts" && npx tsc --noEmit` | ✅ exists | ✅ green |
| 3-06-2 | 06 | 2 | MC-3, MC-4, MC-6, MC-7, AS-8, RN-5 | T-03-mcp, T-03-37 | MC-4 cross-slot collision throws; same-(mp,plugin) self-replace allowed; MC-6 atomic write; AS-8 noop-no-materialize; no network in bridges/mcp | unit + integration | `node --test "tests/bridges/mcp/**/*.test.ts" && npx tsc --noEmit && ! grep -r "fetch\|http\." extensions/claude-marketplace/bridges/mcp/` | ✅ exists | ✅ green |
| 3-07-1 | 07 | 3 | SK-1..5, CM-1..4, AG-1..12, MC-1..8, RN-4, RN-5, RN-6, AS-8, AS-9 | (cross-bridge) | Full-plugin staging across all four bridges; observable on-disk layout matches PRD | integration | `node --test tests/bridges/integration.test.ts` | ✅ exists | ✅ green |
| 3-07-2 | 07 | 3 | AG-5, AG-9, MC-4 | T-03-agt, T-03-mcp | Foreign-content soft-fail across agent + MCP at integration scale | integration | `node --test tests/bridges/integration-foreign-content.test.ts` | ✅ exists | ✅ green |
| 3-07-3 | 07 | 3 | AS-8, AS-9 | -- | Materialization gate: empty-mcp + empty-agents fixtures land NO files; cross-bridge isolation verified; flips `nyquist_compliant: true` after full-suite green | integration | `node --test tests/bridges/integration-materialization-gate.test.ts && npm run check` | ✅ exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Plan 03-07 task 3 promotes status from ⬜ pending → ✅ green and flips frontmatter `nyquist_compliant: true` after full suite runs.*

---

## Wave 0 Requirements

> Wave 0 is the test-infrastructure-and-fixtures pass that lands before any production bridge code. The planner derives this list from RESEARCH.md §"Test Strategy" and the per-bridge fixture layouts.

- [x] `tests/bridges/_fixtures/test-plugin/` -- test plugin with skills + commands + agents + mcpServers (covers success criterion 1) (Plan 03-01)
- [x] `tests/bridges/_fixtures/empty-mcp/` -- plugin with empty `mcpServers` (covers success criterion 4) (Plan 03-01)
- [x] `tests/bridges/_fixtures/empty-agents/` -- plugin with empty agents source dir (covers success criterion 4) (Plan 03-01)
- [x] `tests/bridges/_fixtures/foreign-agents/` -- corpus exercising AG-5 basename/marker miss cases (covers success criterion 2) (Plan 03-01)
- [x] `tests/bridges/skills/{discover,rewrite-frontmatter,stage,unstage}.test.ts` -- SK-1..SK-5 (Plan 03-03)
- [x] `tests/bridges/commands/{discover,stage,unstage}.test.ts` -- CM-1..CM-4 (Plan 03-04)
- [x] `tests/bridges/agents/{marker,frontmatter,convert,discover,stage,unstage,index-mutation}.test.ts` -- AG-1..AG-12 (Plan 03-05)
- [x] `tests/persistence/agents-index-{schema,io}.test.ts` -- AG-7 schema + AG-4 file-level corruption throw (Plan 03-02)
- [x] `tests/bridges/mcp/{marker,parse,collision-slots,stage,unstage}.test.ts` -- MC-1..MC-8 (Plan 03-06)
- [x] `tests/bridges/integration.test.ts` -- multi-bridge end-to-end staging (Plan 03-07)
- [x] `tests/bridges/integration-foreign-content.test.ts` -- AG-5 foreign-content preservation (Plan 03-07)
- [x] `tests/bridges/integration-materialization-gate.test.ts` -- AS-8/AS-9 noop discipline (Plan 03-07)
- [x] `tests/architecture/markers-snapshot.test.ts` -- pin GENERATED_AGENT_MARKER + CLAUDE_MARKETPLACE_MARKER_KEY (Plan 03-05)

*If a fixture or test file already exists from Phase 2, it does not appear here -- Wave 0 only lists net-new artefacts.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (per planner -- likely none) | -- | -- | -- |

*Phase 3 bridges are pure filesystem operations on local disk; all behaviors are expected to have automated verification. The planner will fill this section if any UAT-only check surfaces during planning.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
