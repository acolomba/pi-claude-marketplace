---
phase: "9"
slug: "adapter-entries-and-mcp-features"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| (filled from plans) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `features/lib/mcp-implementation.ts` `listingDone` adapter arm and `features/step_definitions/hook/tool-use.steps.ts:310-321`: a listing wait that does not need the stub process to exit (RESEARCH Pitfall 1), green on the full adapter profile with today's code before the lifecycle default lands.
- [ ] `features/lib/mcp-stub-server.ts`: opt-in static resource plus a step to declare it.
- [ ] `features/lib/mcp-server-files.ts`: earlier-release entry helper without `lifecycle`, `openUi`, `requestTimeoutMs`, `defaultFields`; override steps for the new fields.

## Regression guards (not red-green)

The two PG-MCP-08 resource scenarios (one per profile) change no behavior. They are expected to pass on today's code; research probes B and C read `stub notes` under both implementations before any change. They guard against a later regression, as the ROADMAP note for Phase 9 says.

## Wave Gates

| Wave | Commit | Node | `npm run check` exit | Scenarios (adapter / builtin) | Notes |
|------|--------|------|----------------------|-------------------------------|-------|
| 1 (09-01, 09-02) | 1c58f1a8 | v26.13.1 | 0 | 1927 / 185 passed | 362 direct-coverage records; `/tmp/pg9-wave1.log` |
| 2 (09-03) | fc264060 | v26.13.1 | 0 | 1928 / 185 passed | 362 records; `/tmp/pg9-wave2.log` |
| 3 (09-04) | b131df8e | v26.13.1 | 0 | 1931 / 185 passed | 362 records; `/tmp/pg9-wave3.log` |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Divergence record for sampling cited by the compatibility page | PG-SEC-03 | documentation | read `docs/mcp-compatibility.md`, `PROJECT.md` D-PG9-08 row, upstream draft, BACKLOG MCPSAMPLING-01 |
| Features-beyond-tools table: every unbacked cell marked unmeasured | PG-MCP-08 | documentation | read the new section |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 9s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

## D-PG9-07 amendment (orchestrator, 2026-11-14)

The `openUi: false` default is withheld (09-03, commit 7b7bf951). Regression guards: `test/integration/pi-subagents-child-identity.test.ts` "detached adapter children of a background agent and an MCP agent hook with their own identity", and the domain owner case "D-PG9-07: no transport's defaults hold openUi". The UI half of PG-SEC-03 does not ship; see the amendment in 09-CONTEXT.md.
