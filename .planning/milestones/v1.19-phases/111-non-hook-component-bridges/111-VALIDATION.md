---
phase: 111
slug: non-hook-component-bridges
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-30
---

# Phase 111 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Framework**          | Node.js built-in test runner with TypeScript compile checking                                                                  |
| **Config file**        | None — scripts are defined in `package.json`                                                                                   |
| **Quick run command**  | `node --test tests/bridges/<family>/<owner>.test.ts`                                                                           |
| **Direct owner gate**  | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/<family>/<owner>.ts`                                 |
| **Phase-focused run**  | `node --test "tests/bridges/{agents,commands,mcp,skills}/**/*.test.ts" tests/bridges/integration-materialization-gate.test.ts` |
| **Full suite command** | `npm run check`                                                                                                                |
| **Estimated runtime**  | ~30 seconds focused; ~90 seconds full                                                                                          |

---

## Sampling Rate

- **After every task commit:** Run the owner's focused test, direct-coverage command, and `npm run typecheck`.
- **After every plan wave:** Run every direct command completed in the wave, the phase-focused bridge run, and `npm run typecheck`.
- **Before `$gsd-verify-work`:** Run all 31 direct commands followed by `npm run check`.
- **Max feedback latency:** 90 seconds.

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement | Automated Behavior                                                               | Automated Command                                                                                                             | File Exists | Status   |
| --------- | ---- | ---- | ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| 111-01-01 | 01   | 1    | MOD-04      | Agent conversion bytes, mappings, warnings, and malformed inputs                 | `node --test tests/bridges/agents/convert.test.ts`                                                                            | ✅          | ✅ green |
| 111-01-02 | 01   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts`             | ✅          | ✅ green |
| 111-02-01 | 02   | 1    | MOD-04      | Agent discovery ordering, skips, hashes, names, and collisions                   | `node --test tests/bridges/agents/discover.test.ts`                                                                           | ✅          | ✅ green |
| 111-02-02 | 02   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/discover.ts`            | ✅          | ✅ green |
| 111-03-01 | 03   | 1    | MOD-04      | Agent frontmatter parsing and exact generated rendering                          | `node --test tests/bridges/agents/frontmatter.test.ts`                                                                        | ✅          | ✅ green |
| 111-03-02 | 03   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`         | ✅          | ✅ green |
| 111-04-01 | 04   | 1    | MOD-04      | Agent index partition, merge, ownership, and ordering                            | `node --test tests/bridges/agents/index-mutation.test.ts`                                                                     | ✅          | ✅ green |
| 111-04-02 | 04   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts`      | ✅          | ✅ green |
| 111-05-01 | 05   | 1    | MOD-04      | Agent barrel binding identity and closed public surface                          | `node --test tests/bridges/agents/index.test.ts`                                                                              | ✅          | ✅ green |
| 111-05-02 | 05   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/index.ts`               | ✅          | ✅ green |
| 111-06-01 | 06   | 1    | MOD-04      | Agent ownership-marker classification and foreign preservation                   | `node --test tests/bridges/agents/marker.test.ts`                                                                             | ✅          | ✅ green |
| 111-06-02 | 06   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/marker.ts`              | ✅          | ✅ green |
| 111-07-01 | 07   | 1    | MOD-04      | Agent stage, replace, rollback, finalize, and foreign-content lifecycle          | `node --test tests/bridges/agents/stage.test.ts`                                                                              | ✅          | ✅ green |
| 111-07-02 | 07   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/stage.ts`               | ✅          | ✅ green |
| 111-08-01 | 08   | 1    | MOD-04      | Agent public records and discriminated-union compiler evidence                   | `node --test tests/bridges/agents/types.test.ts`                                                                              | ✅          | ✅ green |
| 111-08-02 | 08   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/types.ts`               | ✅          | ✅ green |
| 111-09-01 | 09   | 1    | MOD-04      | Agent unstage ownership, foreign failures, index, and idempotence                | `node --test tests/bridges/agents/unstage.test.ts`                                                                            | ✅          | ✅ green |
| 111-09-02 | 09   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/unstage.ts`             | ✅          | ✅ green |
| 111-10-01 | 10   | 1    | MOD-04      | Command recursive discovery, generated names, skips, and diagnostics             | `node --test tests/bridges/commands/discover.test.ts`                                                                         | ✅          | ✅ green |
| 111-10-02 | 10   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/discover.ts`          | ✅          | ✅ green |
| 111-11-01 | 11   | 1    | MOD-04      | Command barrel binding identity and closed public surface                        | `node --test tests/bridges/commands/index.test.ts`                                                                            | ✅          | ✅ green |
| 111-11-02 | 11   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/index.ts`             | ✅          | ✅ green |
| 111-12-01 | 12   | 1    | MOD-04      | Command degrade, substitute, stage, replacement, and rollback lifecycle          | `node --test tests/bridges/commands/stage.test.ts`                                                                            | ✅          | ✅ green |
| 111-12-02 | 12   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/stage.ts`             | ✅          | ✅ green |
| 111-13-01 | 13   | 1    | MOD-04      | Command public records and lifecycle-union compiler evidence                     | `node --test tests/bridges/commands/types.test.ts`                                                                            | ✅          | ✅ green |
| 111-13-02 | 13   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/types.ts`             | ✅          | ✅ green |
| 111-14-01 | 14   | 1    | MOD-04      | Command containment, removal, and missing-file idempotence                       | `node --test tests/bridges/commands/unstage.test.ts`                                                                          | ✅          | ✅ green |
| 111-14-02 | 14   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/commands/unstage.ts`           | ✅          | ✅ green |
| 111-15-01 | 15   | 1    | MOD-04      | MCP slot order, first declarer, malformed documents, and environment restoration | `node --test tests/bridges/mcp/collision-slots.test.ts`                                                                       | ✅          | ✅ green |
| 111-15-02 | 15   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts`        | ✅          | ✅ green |
| 111-16-01 | 16   | 1    | MOD-04      | MCP barrel binding identity and closed public surface                            | `node --test tests/bridges/mcp/index.test.ts`                                                                                 | ✅          | ✅ green |
| 111-16-02 | 16   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/index.ts`                  | ✅          | ✅ green |
| 111-17-01 | 17   | 1    | MOD-04      | MCP ownership marker shapes and malformed values                                 | `node --test tests/bridges/mcp/marker.test.ts`                                                                                | ✅          | ✅ green |
| 111-17-02 | 17   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/marker.ts`                 | ✅          | ✅ green |
| 111-18-01 | 18   | 1    | MOD-04      | MCP precedence, wrapped forms, and malformed-source behavior                     | `node --test tests/bridges/mcp/parse.test.ts`                                                                                 | ✅          | ✅ green |
| 111-18-02 | 18   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/parse.ts`                  | ✅          | ✅ green |
| 111-19-01 | 19   | 1    | MOD-04      | Own-property preservation for ordinary and **proto** keys                        | `node --test tests/bridges/mcp/safe-set.test.ts`                                                                              | ✅          | ✅ green |
| 111-19-02 | 19   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts`               | ✅          | ✅ green |
| 111-20-01 | 20   | 2    | MOD-04      | MCP merge, collision, substitution, atomic replacement, and rollback lifecycle   | `node --test tests/bridges/mcp/stage.test.ts`                                                                                 | ✅          | ✅ green |
| 111-20-02 | 20   | 2    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/stage.ts`                  | ✅          | ✅ green |
| 111-21-01 | 21   | 1    | MOD-04      | MCP deep substitution, fresh values, env injection, and precedence               | `node --test tests/bridges/mcp/substitute.test.ts`                                                                            | ✅          | ✅ green |
| 111-21-02 | 21   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/substitute.ts`             | ✅          | ✅ green |
| 111-22-01 | 22   | 1    | MOD-04      | MCP public records, source tags, and lifecycle-union compiler evidence           | `node --test tests/bridges/mcp/types.test.ts`                                                                                 | ✅          | ✅ green |
| 111-22-02 | 22   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/types.ts`                  | ✅          | ✅ green |
| 111-23-01 | 23   | 1    | MOD-04      | MCP no-rewrite, malformed rejection, foreign preservation, and removal           | `node --test tests/bridges/mcp/unstage.test.ts`                                                                               | ✅          | ✅ green |
| 111-23-02 | 23   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/unstage.ts`                | ✅          | ✅ green |
| 111-24-01 | 24   | 1    | MOD-04      | Skill traversal, self-directory handling, symlink refusal, and collisions        | `node --test tests/bridges/skills/discover.test.ts`                                                                           | ✅          | ✅ green |
| 111-24-02 | 24   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/discover.ts`            | ✅          | ✅ green |
| 111-25-01 | 25   | 1    | MOD-04      | Skill fallback metadata, description folding, caps, and multiline spans          | `node --test tests/bridges/skills/frontmatter-degrade.test.ts`                                                                | ✅          | ✅ green |
| 111-25-02 | 25   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts` | ✅          | ✅ green |
| 111-26-01 | 26   | 1    | MOD-04      | Skill frontmatter block and key-node span scanning                               | `node --test tests/bridges/skills/frontmatter-scan.test.ts`                                                                   | ✅          | ✅ green |
| 111-26-02 | 26   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`    | ✅          | ✅ green |
| 111-27-01 | 27   | 1    | MOD-04      | Skill barrel binding identity and closed public surface                          | `node --test tests/bridges/skills/index.test.ts`                                                                              | ✅          | ✅ green |
| 111-27-02 | 27   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/index.ts`               | ✅          | ✅ green |
| 111-28-01 | 28   | 1    | MOD-04      | Skill exact name insertion/replacement and mismatch failures                     | `node --test tests/bridges/skills/rewrite-frontmatter.test.ts`                                                                | ✅          | ✅ green |
| 111-28-02 | 28   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts` | ✅          | ✅ green |
| 111-29-01 | 29   | 3    | MOD-04      | Skill copy, degrade, rewrite, substitute, replacement, and rollback lifecycle    | `node --test tests/bridges/skills/stage.test.ts`                                                                              | ✅          | ✅ green |
| 111-29-02 | 29   | 3    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/stage.ts`               | ✅          | ✅ green |
| 111-30-01 | 30   | 1    | MOD-04      | Skill public records and lifecycle-union compiler evidence                       | `node --test tests/bridges/skills/types.test.ts`                                                                              | ✅          | ✅ green |
| 111-30-02 | 30   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/types.ts`               | ✅          | ✅ green |
| 111-31-01 | 31   | 1    | MOD-04      | Skill validation, containment, removal, and missing-path idempotence             | `node --test tests/bridges/skills/unstage.test.ts`                                                                            | ✅          | ✅ green |
| 111-31-02 | 31   | 1    | MOD-04      | Complete direct functions, lines, branches, and compiler contract                | `npm run typecheck && npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/unstage.ts`             | ✅          | ✅ green |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [x] `tests/bridges/agents/index.test.ts` — created inside Plan 111-05; no separate foundation plan.
- [x] `tests/bridges/agents/types.test.ts` — created inside Plan 111-08; no separate foundation plan.
- [x] `tests/bridges/commands/index.test.ts` — created inside Plan 111-11; no separate foundation plan.
- [x] `tests/bridges/commands/types.test.ts` — created inside Plan 111-13; no separate foundation plan.
- [x] `tests/bridges/mcp/index.test.ts` — created inside Plan 111-16; no separate foundation plan.
- [x] `tests/bridges/mcp/safe-set.test.ts` — created inside Plan 111-19; no separate foundation plan.
- [x] `tests/bridges/mcp/types.test.ts` — created inside Plan 111-22; no separate foundation plan.
- [x] `tests/bridges/skills/frontmatter-scan.test.ts` — created inside Plan 111-26; no separate foundation plan.
- [x] `tests/bridges/skills/index.test.ts` — created inside Plan 111-27; no separate foundation plan.
- [x] `tests/bridges/skills/types.test.ts` — created inside Plan 111-30; no separate foundation plan.

No framework installation, shared fixture, global mock, or new test configuration is required. Each missing owner is created by its own pair-atomic plan.

---

## Supplemental-Suite Disposition

| Existing suite                                          | Required disposition                      | Carrier                                          |
| ------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------ |
| `tests/bridges/agents/convert-byte-identity.test.ts`    | Absorb all byte cases, then delete        | Plan 111-01                                      |
| `tests/bridges/integration-foreign-content.test.ts`     | Absorb owner evidence, then delete        | Plan 111-07                                      |
| Materialization AS-9 agent case                         | Absorb                                    | Plan 111-07                                      |
| Materialization AS-8 MCP case                           | Absorb                                    | Plan 111-20                                      |
| MCP-only cross-bridge isolation case                    | Retain with case-local source trees       | Supplemental contract                            |
| `tests/bridges/integration.test.ts` single-family cases | Absorb by family; delete after final move | Plans 111-07, 111-12, 111-20, and finally 111-29 |

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have an automated verification command.
- [x] Sampling continuity has no three consecutive tasks without automated verification.
- [x] Wave 0 covers all missing owner references.
- [x] Commands contain no watch-mode flags.
- [x] Expected feedback latency is less than 90 seconds.
- [x] `nyquist_compliant: true` is set after execution evidence is complete.

**Approval:** validated on 2026-08-30 from 31/31 direct owner gates, typecheck, and the full 4,238-test regression suite.

## Validation Audit 2026-08-30

| Metric     | Count |
| ---------- | ----: |
| Gaps found |     0 |
| Resolved   |     0 |
| Escalated  |     0 |
