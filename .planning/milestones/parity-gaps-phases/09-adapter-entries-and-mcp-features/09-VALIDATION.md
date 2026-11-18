---
phase: "9"
slug: "adapter-entries-and-mcp-features"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
validated: "2026-11-14"
created: "2026-11-14"
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (unit, integration), @cucumber/cucumber 13.3.0 (behavioral, profiles `adapter` and `builtin`) |
| **Config file** | `cucumber.json`, `package.json` scripts |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <owner test>`; one feature: `npm run test:cucumber:profile -- --profile adapter <feature>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~9 seconds |

---

## Sampling Rate

- **After every task commit:** Run the owner test of each touched pair and the touched feature under its profile
- **After every plan wave:** Run `npm run check` (wave gate; record commit, Node version, exit and scenario counts below)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 9 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01 T1 | 01 | 1 | PG-MCP-06 (harness prerequisite) | -- | listing wait ends on Pi's registry when the stub stays connected | cucumber | `npm run test:cucumber:profile -- --profile adapter <20 listing features>` (180/180), builtin (109/109); resident measurement: 0 listing-wait failures | yes | ✅ green |
| 09-01 T2-3 | 01 | 1 | PG-MCP-08 (guard) | -- | -- | cucumber | `features/mcp-server/resources.feature:8` (adapter), `:33` (builtin); passed on first product run, regression guards, not red-green | yes | ✅ green |
| 09-02 T1 | 02 | 1 | PG-MCP-06 prep (D-PG9-03) | T-09-05 | marker accepts own JSON scalars only; null/object/array/`__proto__` rejected | unit | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/mcp/marker.test.ts` (`:116`, `:171`, `:201`); red 4/73 before `bd2643fd` | yes | ✅ green |
| 09-02 T2 | 02 | 1 | PG-MCP-06 (D-PG9-04) | T-09-06 | -- | fixture + cucumber | release 0.23.0 entry fixture `8424da36`; `features/mcp-server/lifecycle.feature:537` | yes | ✅ green |
| 09-03 T1 | 03 | 2 | PG-MCP-06 (D-PG9-01/02) | -- | -- | cucumber + unit | `features/mcp-server/configuration.feature:64` (red on `1c58f1a8` at the file-text step); `test/domain/mcp-server-features.test.ts:125`; `test/bridges/mcp/adapter-entry.test.ts:642`, `:804`, `:854`, `:889`, `:1588` | yes | ✅ green |
| 09-03 T2 | 03 | 2 | PG-MCP-06 (one kept connection) | -- | -- | cucumber | `features/mcp-server/invocation.feature:10` adapter stub table (one `initialize`), commit `6340989e`; lifecycle `:463`, `:500` | yes | ✅ green |
| 09-03 amend | 03 | 2 | PG-SEC-03 UI half (withheld) | -- | no `openUi` default; agent MCP grants launch | unit + integration | `test/domain/mcp-server-features.test.ts:111` "D-PG9-07: no transport's defaults hold openUi"; `test/integration/pi-subagents-child-identity.test.ts` "detached adapter children of a background agent and an MCP agent hook with their own identity" (fail with default at `581c2f5e`, pass at `7b7bf951`) | yes | ⚠️ guard only; UI capability NOT withheld |
| 09-04 T1 | 04 | 3 | PG-MCP-09 (D-PG9-05) | T-09-15 accepted | no credential field joins the carried set | cucumber + unit | `features/mcp-server/lifecycle.feature:574` (update with url change), `:619` (reinstall), red at the file-text step; `adapter-entry.test.ts:1131`, `:1233`, `:1694`, `:1805` (8/75 red before `4640737a`) | yes | ✅ green |
| 09-04 T2 | 04 | 3 | PG-MCP-06, PG-SEC-03 (user value wins) | -- | -- | cucumber + unit | `lifecycle.feature:657` passes on arrival; negative control: inverted `defaultFieldsFor` filter made it fail (lifecycle half only); `adapter-entry.test.ts:825` | yes | ✅ green |
| 09-05 T1-2 | 05 | 4 | PG-MCP-08 docs, PG-SEC-03 divergence record | -- | -- | doc | `docs/mcp-compatibility.md:155` `## Features beyond tools`, `:170` `@server:uri`, `:172` UI divergence, `:164` sampling (D-PG9-08); manual read | yes | ✅ manual |
| 09-06 T1-2 | 06 | 3 | PG-SEC-03 (D-PG9-08 record) | -- | -- | doc | `.planning/PROJECT.md:2397-2398`, `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`, BACKLOG `MCPSAMPLING-01` (`.planning/BACKLOG.md:5329`); manual read | yes | ✅ manual |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `features/lib/mcp-implementation.ts` `listingDone` adapter arm and `features/step_definitions/hook/tool-use.steps.ts:310-321`: a listing wait that does not need the stub process to exit (RESEARCH Pitfall 1), green on the full adapter profile with today's code before the lifecycle default lands.
- [x] `features/lib/mcp-stub-server.ts`: opt-in static resource plus a step to declare it.
- [x] `features/lib/mcp-server-files.ts`: earlier-release entry helper without `lifecycle`, `openUi`, `requestTimeoutMs`, `defaultFields`; override steps for the new fields.

## Regression guards (not red-green)

The two PG-MCP-08 resource scenarios (one per profile) change no behavior. They are expected to pass on today's code; research probes B and C read `stub notes` under both implementations before any change. They guard against a later regression, as the ROADMAP note for Phase 9 says.

## Wave Gates

| Wave | Commit | Node | `npm run check` exit | Scenarios (adapter / builtin) | Notes |
|------|--------|------|----------------------|-------------------------------|-------|
| 1 (09-01, 09-02) | 1c58f1a8 | v26.13.1 | 0 | 1927 / 185 passed | 362 direct-coverage records; `/tmp/pg9-wave1.log` |
| 2 (09-03) | fc264060 | v26.13.1 | 0 | 1928 / 185 passed | 362 records; `/tmp/pg9-wave2.log` |
| 3 (09-04) | b131df8e | v26.13.1 | 0 | 1931 / 185 passed | 362 records; `/tmp/pg9-wave3.log` |
| 4 (09-06) | b131df8e (reused) | v26.13.1 | 0 (reused) | 1931 / 185 passed | only non-build-input docs changed, so the wave 3 result is reused |
| 5 (09-05) | d987142a | v26.13.1 | 0 | 1931 / 185 passed | 362 records; `/tmp/pg9-wave5.log` |
| phase gate | bea13012 | v26.13.1 | 0 | 1938 / 185 passed | after three review-fix rounds; 362 records; `/tmp/pg9-phasegate.log` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Divergence record for sampling cited by the compatibility page | PG-SEC-03 | documentation | read `docs/mcp-compatibility.md`, `PROJECT.md` D-PG9-08 row, upstream draft, BACKLOG MCPSAMPLING-01 |
| Features-beyond-tools table: every unbacked cell marked unmeasured | PG-MCP-08 | documentation | read the new section |

---

## Requirement Coverage (audit 2026-11-14)

| Requirement | Coverage | Evidence |
|-------------|----------|----------|
| PG-MCP-06 | COVERED | `configuration.feature:64`, `lifecycle.feature:463`, `:500`, `:537`, `:657`, `invocation.feature:10`; owner cases in `adapter-entry.test.ts`, `marker.test.ts`, `mcp-server-features.test.ts` |
| PG-MCP-08 | COVERED | scenarios `resources.feature:8` (adapter), `:33` (builtin), guards; docs `docs/mcp-compatibility.md:155-172` (manual) |
| PG-MCP-09 | COVERED | `lifecycle.feature:574`, `:619`; `adapter-entry.test.ts` D-PG9-05 cases |
| PG-SEC-03 | PARTIAL | sampling half: divergence recorded (D-PG9-08, manual). UI half: the `openUi: false` default is withheld under the D-PG9-07 amendment; plugin servers still receive the MCP UI extension. The divergence is recorded in D-PG9-07 and the page (`:172`), pending maintainer review (BACKLOG MCPOPENUI-01). Not counted as covered; accepted as a recorded divergence by the orchestrator (autonomous run, pending maintainer review), so the phase is compliant with this gap stated. |

Audit re-runs (targeted only): the three owner tests 294/294 pass; `resources.feature` adapter and builtin exit 0; adapter `--name "PG-MCP-0[69]"` over `lifecycle.feature` and `configuration.feature`, 7 scenarios passed. No test added: every requirement has proof. `nyquist_compliant` stays false until the wave 5 gate is recorded and the PG-SEC-03 UI half is settled by the maintainer.

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 9s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

## D-PG9-07 amendment (orchestrator, 2026-11-14)

The `openUi: false` default is withheld (09-03, commit 7b7bf951). Regression guards: `test/integration/pi-subagents-child-identity.test.ts` "detached adapter children of a background agent and an MCP agent hook with their own identity", and the domain owner case "D-PG9-07: no transport's defaults hold openUi". The UI half of PG-SEC-03 does not ship; see the amendment in 09-CONTEXT.md.
