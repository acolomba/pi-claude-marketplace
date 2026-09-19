---
phase: 05-production-export-ownership
wave: 4
status: passed
plans: ["05-05", "05-11"]
---

# Production export ownership: wave 4 verification

Completed in `851c5e26`. The stable wave passes 6,242/6,242 unit tests with exact 100% coverage across 225 emitted production modules: 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches. All 58 analyzer/census/Sonar controls and mandatory pre-commit checks pass, including affected direct pairs. Independent review has zero open findings across 22 changed source/test paths; all thirteen restored-export compiler controls reject their offenders. The complete census is 57 → 42: fifteen exact removals, zero additions. RingBuffer.read remains in the census until its proven adjacent exception can be activated with production mode in Plan 05-28. See [wave verification](05-WAVE-4-VERIFICATION.md). EXPORT-01 and EXPORT-02 remain open for later plans.

## Preserved contracts

Registered before-agent callbacks retain exact context/drain and stale-generation behavior. The sole synchronous wrapper owns the generation guard; its unreachable duplicate is retired. PID paths, serialized table bytes, dispatch environment, stream finalization and orphan ownership remain independently asserted. Unused barrel types and facade validators become private or retire while their real public signatures remain live. Shared and domain hook types get distinct names. The private event-set proof is consumed by the real registration tuple and rejects a missing SessionStart.

Every assertion disposition is in the two plan summaries. No threshold, production exclusion, artificial reader, skipped runtime case or direct-pair pin was added or relaxed.

## Evidence

- Native unit suite: 6,242/6,242 pass, zero failures/cancellations/skips/todos. Exact production totals: 62,664/62,664 lines, 1,835/1,835 functions and 9,063/9,063 branches; 225 emitted modules. `/tmp/test-backlog-wave4-unit-final.log`, `/tmp/test-backlog-wave4-coverage-final.json`.
- Complete production census: 57 → 42, fifteen exact removals and zero additions. Remaining: 37 unused values, two unused types, one unused file, one unused class member and one duplicate group. `/tmp/test-backlog-wave4-census.json`; both committed pins match.
- Fallow/Sonar/census controls: 58/58 pass. `/tmp/test-backlog-wave4-controls-final.log`.
- Independent review: zero open findings across 22 changed paths; all thirteen separate restored-export controls emit TS2578 and all baselines pass TypeScript/ESLint. `05-WAVE-4-REVIEW.md` records exact hashes and initial repaired findings.
- Mandatory full pre-commit passes on `/tmp/test-backlog-wave4-commit-files.json`, including lint, typecheck, formatting, Fallow and affected direct pairs. `/tmp/test-backlog-wave4-precommit-final.log`.
- Focused executor evidence: Plan 05 has 120 checks and five exact direct-owner measurements; Plan 11 has 58 checks and four exact direct-owner measurements. Review additionally verifies 60 focused checks and two annotation controls. See the summaries for individual commands, assertion ledgers and compiler controls.
- Implementation commit: `851c5e26`. Only these source/test paths were staged; user configuration/setup edits remain uncommitted.

## Gate repairs

The initial run passed 6,241 of 6,242 unit tests and measured exact 100% production coverage, but the census correctly rejected a stale RingBuffer suppression in shipping mode. Keeping that finding until Plan 05-28 preserves both modes' checks. The first compiler-proof repair passed all restoration controls but failed thirteen ESLint union checks. The final optional-property idiom passes both. Initial logs remain as `/tmp/test-backlog-wave4-{unit,controls,precommit}-first-attempt.log`; the already-failed first pre-commit run was cancelled before applying repairs. Final evidence above is from the repaired stable snapshot.

Aggregate unit/Sonar measurement remains distinct from direct owner pins and integration/E2E reports. The full 234-pair sweep passed in Wave 3; this wave reruns its affected pairs, with the final phase sweep still required.
