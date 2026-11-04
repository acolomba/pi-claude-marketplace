---
phase: "5"
slug: "hook-tool-names"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-04"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The
> requirement-to-test map is in `05-RESEARCH.md` "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock`; cucumber-js profiles `adapter` and `builtin` |
| **Config file** | `package.json` scripts, `cucumber.json` (frozen) |
| **Quick run command** | `node --test test/bridges/hooks/dispatch.test.ts` (any touched pair) |
| **Full suite command** | `npm run check` plus both cucumber profiles; `npm run test:modules` at the phase gate |
| **Estimated runtime** | ~900 seconds (full); ~5 seconds (one pair) |

All npm scripts run with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (root container).

---

## Sampling Rate

- **After every task commit:** the touched pairs' tests plus `npm run check:static` (the commit hook runs `check:commit`)
- **After every plan wave:** `npm run check` on the combined tree plus both cucumber profiles
- **Before `/gsd-verify-work`:** full suite green, plus `npm run test:modules`
- **Max feedback latency:** 60 seconds for a pair

---

## Per-Task Verification Map

Filled by the planner per task (`<automated>` with `<fails_when>`). Requirement coverage:

| Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|------------------------|-----------|-------------------|-------------|--------|
| D-P5-02, D-P5-04 | unit | `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts` | ✅ | ✅ green |
| D-P5-01, D-P5-06, D-P5-07 | unit | `node --test test/bridges/hooks/mcp-tool-view.test.ts` | ✅ | ✅ green |
| D-P5-03, MHK-02 | unit | `node --test test/bridges/hooks/dispatch.test.ts` | ✅ | ✅ green |
| D-P5-04 (`if`) | unit | `node --test test/bridges/hooks/if-field/index.test.ts` | ✅ | ✅ green |
| MHK-01 (D-P5-08, D-P5-09) | cucumber | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature` (and `--profile adapter`) | ✅ | ✅ green |
| MHK-02 (D-P5-10, D-P5-11) | cucumber | `npx cucumber-js --profile builtin features/hook/tool-use.feature` (and `--profile adapter`) | ✅ | ✅ green |
| tags | static | `npm run check:features` | ✅ | ✅ green |

Per task (each runnable command in the plan carries a `<fails_when>`; `npm` commands run with the nondac prefix):

| Task | Wave | Requirement / Decision | Test Type | Automated Command | File Exists | Status |
|------|------|------------------------|-----------|-------------------|-------------|--------|
| 05-01 T1 | 1 | MHK-01; D-P5-01, -02, -03, -04, -05, -08, -13 | unit + cucumber | `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts test/bridges/hooks/mcp-tool-view.test.ts test/bridges/hooks/dispatch.test.ts`; `npm run test:coverage:direct -- <the three sources>`; `npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature` (and `--profile adapter` with `features/hook/tool-use.feature`); `npm run check:static` | ✅ | ✅ green |
| 05-01 T2 | 1 | MHK-01; D-P5-03, -04, -08 | unit + cucumber | `node --test test/bridges/hooks/if-field/index.test.ts test/bridges/hooks/dispatch.test.ts`; coverage of `if-field/index.ts` and `dispatch.ts`; both profiles on `features/hook/mcp-tool-names.feature`; `npm run check:static` | ✅ | ✅ green |
| 05-02 T1 | 2 | MHK-02; D-P5-06, -07, -10 | unit + cucumber | `node --test test/bridges/hooks/mcp-tool-view.test.ts test/bridges/hooks/dispatch.test.ts`; coverage; both profiles on `features/hook/tool-use.feature`; `npm run check:static` | ✅ | ✅ green |
| 05-02 T2 | 2 | MHK-02; D-P5-07, -11 | unit + cucumber | `node --test test/bridges/hooks/event-router.test.ts test/architecture/no-factory-time-probe.test.ts test/index.test.ts`; coverage; both profiles on `features/hook/tool-use.feature`; `npm run check:static` | ✅ | ✅ green |
| 05-03 T1 | 2 | MHK-01; D-P5-09 | cucumber | `npm run test:cucumber:profile -- --profile builtin features/hook/mcp-tool-names.feature`; `npm run check:static` | ✅ | ✅ green |
| 05-03 T2 | 2 | MHK-01, MHK-02; D-P5-03, -14 | cucumber + docs | both profiles on `features/hook/mcp-tool-names.feature`; `pre-commit run --files docs/hooks-compatibility.md ...`; `npm run check:features` | ✅ | ✅ green |
| 05-04 T1 | 3 | MHK-01, MHK-02; D-P5-12 | full gate + red sweep | the `npm run check` parts, `npm run test:modules`, the red sweep on the Phase 1 product code, the ownership check | ✅ | ✅ green |
| 05-04 T2 | 3 | D-P5-12, D-P5-14 | record | `grep -c '^## Parent lines'` and the other section checks on 05-04-SUMMARY.md | ✅ | ✅ green |

Red proofs (D-P5-12) run after each scenario task's commit against the Phase 1 product code (`git restore --source=640419724c48a60c7bb469acf0fde6f3a6ea7852 --worktree -- extensions/pi-claude-marketplace/bridges/hooks extensions/pi-claude-marketplace/domain/components/hooks`, then back to `HEAD`); 05-04 repeats the sweep on the final scenario texts.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` — D-P5-02, D-P5-04
- [x] `test/bridges/hooks/mcp-tool-view.test.ts` — D-P5-01, D-P5-06, D-P5-07
- [x] `features/hook/mcp-tool-names.feature` with its `features/lib/hook-*.ts` helpers

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s per pair
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-11-04 (Nyquist audit)

---

## Validation Audit 2026-11-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Re-run on `features/mcp-builtin-phase-5` HEAD: the six unit files (`builtin-mcp-tool-names`, `mcp-tool-view`, `dispatch`, `if-field/index`, `event-router`, `architecture/no-factory-time-probe`) pass 404/404; `features/hook/mcp-tool-names.feature` + `features/hook/tool-use.feature` pass under `--profile builtin` (5/5 scenarios) and `--profile adapter` (23/23); `npm run check:features` exits 0. Direct coverage and the full gate: 05-04-SUMMARY (cd5c7b4).

| Req / Decision | Evidence |
|----------------|----------|
| MHK-01 | `mcp-tool-names.feature` "Hooks on a plugin MCP tool match it and see it under Claude Code's name", "A hook on a built-in tool matches the server as Pi registered it and sees the tool segment folded (MHK-01, D-MB-08)"; `dispatch.test.ts` suites "built-in MCP tool names (MHK-01)" and "... in tool results and if fields (MHK-01)" |
| MHK-02 | `tool-use.feature` "A hook on a plugin MCP tool runs once per call through pi-mcp-adapter's proxy (D-CF5-12, MHK-02)", "... runs on every built-in call, the tool search included (MHK-01, MHK-02)", "A built-in MCP tool whose cut name looks like a proxy call still runs its hooks (MHK-02)"; `dispatch.test.ts` "mcp proxy calls (D-CF5-12, MHK-02)" |
| D-P5-01 | `mcp-tool-view.test.ts` "names a built-in MCP tool with its server's registered name after one tool read", "keeps the name of an MCP tool that Pi does not list", "... when the tool read throws" |
| D-P5-02 | `builtin-mcp-tool-names.test.ts` `claudeFormToolName` suite (three cases) |
| D-P5-03 | `dispatch.test.ts` "lands a hook's input rewrite on Pi's own input", "names the tool in Claude's form in a block reason, a notice, and the model's context", "... in the ask dialog", tool-result notice/feedback rows; `mcp-tool-names.feature` notice scenario |
| D-P5-04 | `builtin-mcp-tool-names.test.ts` `toolLiteralNames`/`serverPrefixNames`; `if-field/index.test.ts` "D-P5-04: ..." rows; `dispatch.test.ts` D-P5-04 rows |
| D-P5-05 | `builtin-mcp-tool-names.test.ts` D-P5-05 rows; `mcp-tool-view.test.ts` "keeps Pi's name of ... (D-P5-05)"; `dispatch.test.ts` "gives the hooks Pi's event itself ..." |
| D-P5-06 | `mcp-tool-view.test.ts` "applies / does not apply the proxy rule when ..." and "no Pi API" cases; `dispatch.test.ts` proxy rows |
| D-P5-07 | `mcp-tool-view.test.ts` "keeps the first answer of the proxy rule for the view's generation"; `event-router.test.ts` "the tool handlers of one bridge load share one read of the proxy rule", "a new bridge load reads the proxy rule again ..."; `no-factory-time-probe.test.ts` |
| D-P5-08 | `mcp-tool-names.feature` first scenario (`@mcp`, both profiles) |
| D-P5-09 | `mcp-tool-names.feature` fold scenario (`@builtin-only`) |
| D-P5-10 | `tool-use.feature` cut-name proxy-shaped scenario (`@builtin-only`) |
| D-P5-11 | `tool-use.feature` adapter/built-in pair |
| D-P5-12 | process record: red sweep table in 05-04-SUMMARY "Red proofs" (not a re-runnable test by design) |
| D-P5-13 | structural: the two new modules and their unit pairs exist; `npm run check` pairing + fallow boundaries |
| D-P5-14 | docs: `docs/hooks-compatibility.md` rows 119-120 and paragraphs at 148-150; no automated content test (docs, by design) |
