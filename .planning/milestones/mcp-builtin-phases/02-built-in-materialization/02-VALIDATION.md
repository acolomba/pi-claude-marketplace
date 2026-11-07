---
phase: "2"
slug: "built-in-materialization"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-04"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` "Validation Architecture". Audited after execution against the final tree. No test was added in this audit (the phase gate is closed); every gap is recorded as manual-only or deferred.

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

### Gate evidence on the final tree

| Gate | Result | Source |
|------|--------|--------|
| `check:static`, `test:unpaired`, `test:integration`, `test:coverage:direct:all`, `test:modules` | green | orchestrator-supplied evidence (not re-run in this audit) |
| cucumber `adapter` profile | 1564/1564, seed 679076 | orchestrator-supplied evidence |
| cucumber `builtin` profile | 97/98, seed 779998; sole failure `features/mcp-server/companion-missing.feature:61` (P2-DC-43, Phase 3-owned, MREC-05) | orchestrator-supplied evidence |
| Spot-check in this audit: `node --test` on the nine phase unit pairs plus `test/integration/mcp-builtin-encoding-conformance.test.ts` | 249/249 pass | run here |

---

## Sampling Rate

- **After every task commit:** the touched pairs' `node --test` and direct coverage, `npm run check:static`, and the owned feature file under each profile it applies to.
- **After every plan wave:** `npm run check` in parts plus both cucumber profiles on the whole tree.
- **Before `/gsd-verify-work`:** full suite green, plus `npm run test:modules`; red proofs recorded per profile.
- **Max feedback latency:** 120 seconds for a task-level check.

---

## Per-Requirement Verification Map

Unit pairs live under `test/`. "Feature" means `features/mcp-server/<name>.feature`; a profile in parentheses is the profile the scenario runs under (a `@builtin-only` or `@adapter-only` tag pins one, an untagged scenario runs under both).

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| MSEL-03 | No registration under adapter or none | unit + cucumber | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts`; adapter profile on `listing.feature` ("registers no server with Pi (MSEL-03)") and `implementation-switch.feature` (`none` leg: empty registry, no extension error) | ✅ | ✅ green |
| MSEL-02 | Switch adapter → none → built-in → adapter, no plugin command | cucumber (`@own-implementation`) | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature` (3 scenarios) | ✅ | ⚠️ green with a gap: restarts stand in for `/reload`, which no run drives (P2-DC-88) |
| MSEL-04 | Installed under built-in, reached under adapter after restart | cucumber | same file, scenario "(MSEL-04)" | ✅ | ✅ green |
| MREC-02 | Legacy record (no `mcpServerConfigs`) reaches its server | unit + cucumber | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts`; `implementation-switch.feature` `@mcp` scenario "(MREC-02)", both profiles | ✅ | ✅ green |
| BLT-01 | Registered at startup and `/reload`; deferred via `tool_search`, `alwaysLoad` direct | unit + cucumber | `node --test test/bridges/mcp/builtin-registration.test.ts test/orchestrators/mcp/builtin-registration-step.test.ts`; builtin profile on `listing.feature`, `invocation.feature`, `builtin-direct.feature` | ✅ | ✅ green (updated 2026-11-06): startup leg; the `/reload` leg in `builtin-reload.feature` (terminal Pi, builtin profile, quick 261106-m03); the new-session leg in `lifecycle.feature:392`, `@mcp` since 06-05 |
| BLT-02 | Transports, fields, expansion, `$`/`!`, timeout seconds, OAuth | unit + integration + cucumber | `node --test test/domain/mcp-builtin-translation.test.ts test/bridges/mcp/builtin-escape.test.ts test/bridges/mcp/builtin-entry.test.ts test/integration/mcp-builtin-encoding-conformance.test.ts`; builtin profile on `configuration.feature`, `sources.feature`, `builtin-values.feature` | ✅ | ✅ green |
| BLT-02 | Adapter output byte-identical | unit + integration | `node --test test/bridges/mcp/substitute.test.ts test/bridges/mcp/adapter-entry.test.ts test/integration/adapter-expansion-conformance.test.ts` | ✅ | ✅ green |
| BLT-03 | Project servers only while trusted | unit + cucumber | `test/orchestrators/mcp/builtin-registration-step.test.ts`; builtin profile on `project-scope.feature` and `builtin-trust.feature` | ✅ | ✅ green |
| BLT-04 | Names, fold, overrides reported | unit + cucumber | `test/bridges/mcp/builtin-overrides.test.ts`; builtin profile on `listing.feature` (name, fold, 64-char cut) and `builtin-status.feature` (`overridden by mcp.json`) | ✅ | ✅ green (updated 2026-11-06): names and fold; "never silent" is met by `info` and Pi's `/mcp` by the user's decision (02-UAT check 1, D-MB-19, D-MB-29); a name another extension holds reads `not loaded` (`builtin-status.feature`, quick 261106-m02) |
| BLT-05 | `info` statuses | unit + cucumber | `node --test test/orchestrators/plugin/info-mcp-status.test.ts test/platform/mcp-builtin-status.test.ts`; builtin profile on `builtin-status.feature` (one scenario per token) | ✅ | ✅ green; WR-03 and WR-04 race and cross-marketplace rows are unit-only (P2-DC-97) |
| BLT-06 | Disable, uninstall, enable, update take effect next session | cucumber both profiles | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/lifecycle.feature` (and adapter) | ✅ | ✅ green |
| MDOC-01 | Built-in column with a citation per statement | docs lint + review | `pre-commit run --files docs/mcp-compatibility.md`; the citation scan by the verifier found no missing path | ✅ | ✅ green (lint); citation accuracy stays manual, see below |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ green with a recorded gap*

---

## Wave 0 Requirements

Files all exist on the final tree; the flag stays `false` as found in the draft, since this audit did not tick the boxes against a Wave 0 close-out record.

- [x] `test/domain/mcp-builtin-translation.test.ts`, `test/bridges/mcp/builtin-{escape,entry,registration}.test.ts` — present, pass (BLT-01, BLT-02)
- [x] `test/integration/mcp-builtin-encoding-conformance.test.ts` — present, passes (BLT-02)
- [x] The `tool_search` projection lib and step (`features/lib/mcp-builtin-tool-search.ts`, `builtin-tool-search.steps.ts`) (BLT-01)
- [x] The legacy-record rewrite lib and step (`features/lib/mcp-builtin-earlier-record.ts`) (MREC-02)
- [x] A restart-scoped "not reached, no extension error" step (`implementation-switch.steps.ts`) (MSEL-02, MSEL-03)
- [x] The registry-config probe extension (`features/lib/mcp-builtin-config-probe/`) (BLT-02, P2-DC-17)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each built-in statement in `docs/mcp-compatibility.md` cites a scenario or the Pi 1.5.0 source | MDOC-01 | Citation accuracy is a reading check | Read each built-in cell and open the cited scenario or file |

## Deferred / Unit-Only Gaps

| Gap | Requirement | Disposition |
|-----|-------------|-------------|
| `companion-missing.feature:61` red under builtin (reads `not loaded`, expects `status unknown`) | BLT-05 | Deferred to Phase 3 (MREC-05); builtin profile 97/98 until then (P2-DC-43) |
| WR-03 (replaced-registration race) and WR-04 (cross-marketplace owner) have no scenario | BLT-05 | Unit-only by design (P2-DC-97); unit rows pass |
| A switch of implementation made by `/reload` in a running Pi | MSEL-02 | Open (updated 2026-11-06): restarts stand in for `/reload` in `implementation-switch.feature` (P2-DC-88). `builtin-reload.feature` proves the registration path a `/reload` runs, which the switch also uses, but no scenario changes the loaded implementation and then runs `/reload` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for a task-level check
- [ ] `nyquist_compliant: true` set in frontmatter — withheld: MSEL-02's `/reload` switch has no scenario (see Deferred). BLT-01 and BLT-04 were closed on 2026-11-06 by quick 261106-m02 and 261106-m03 and the user's 02-UAT decisions

**Approval:** validated with gaps, 2026-11-04 (not Nyquist-compliant)
