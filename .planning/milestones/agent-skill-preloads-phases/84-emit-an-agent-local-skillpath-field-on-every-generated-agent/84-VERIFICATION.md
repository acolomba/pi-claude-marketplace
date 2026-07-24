---
phase: 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
verified: 2026-07-20T13:01:43Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 84: Agent skillPath resolution (end-to-end skill availability) Verification Report

**Phase Goal:** Emit an agent-local `skillPath` field on every generated agent that
references skills (`skillPath: ../pi-claude-marketplace/resources/skills`), so
pi-subagents resolves the agent's `skills:` names for the spawned subagent -- closing
issue #86 end-to-end; also raise the pi-subagents peer floor to `>=0.35.0`.
**Verified:** 2026-07-20T13:01:43Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: non-empty `skills:` agent emits `skillPath: ../pi-claude-marketplace/resources/skills`; skill-less agent emits none and stays byte-identical | VERIFIED | `frontmatter.ts:269-275` pushes `skillPath` only inside the existing `frontmatter.skills.length > 0` gate, right after `skills:`, before `systemPromptMode:`. `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` -> 93/93 pass, including `AGSK-04 emitGeneratedAgentFile without legend keeps today's exact bytes` and `AG-8 emitGeneratedAgentFile omits skills line when skills array is empty` (byte-identity preserved for skill-less agents). |
| 2 | D-84-01 legend collapse: every referenced skill annotates `(available on demand)`; the `preloaded` two-state branch and field are removed | VERIFIED | `renderSkillLegend` (`frontmatter.ts:332-347`) emits the single fixed literal `` `- \`${entry.token}\` → skill \`${entry.generatedName}\` (available on demand)` `` for every entry -- no ternary, no `preloaded` field on `SkillLegendEntry`. `grep -rn "preloaded in your context" tests/ extensions/` -> zero matches. `detectSkillTokens` (`convert.ts:139-143`) is a 3-parameter function (`body, pluginName, knownSkills`); call site `convert.ts:527` passes exactly 3 arguments (`detectSkillTokens(substitutedBody, pluginName, knownSkills)`). The sole remaining `preloaded` hit in `convert.ts` is unrelated warning prose ("only this plugin's skills can be preloaded"). |
| 3 | SC-2 / D-84-04: the emitted `skillPath` resolves the bridged skill via pi-subagents' real `resolveSkillsWithFallback` and stays out of the parent/global catalog | VERIFIED | `node --test tests/integration/skill-path-resolution.test.ts` -> 1/1 **pass** (not skipped) in this environment: it located the real installed pi-subagents 0.35.1, copied its `src/` tree outside `node_modules`, dynamically imported the real `resolveSkillsWithFallback`/`discoverAvailableSkills`, staged a real skill at the production `skillsTargetDir` layout, fed the emitter's actual `skillPath` output into the resolver, and asserted both resolution and invocation-privacy. Also confirmed the graceful-skip branch: `PI_SUBAGENTS_ROOT=/nonexistent-path node --test ...` -> 1 skipped, exit 0 (CI-safe when the optional peer is absent). |
| 4 | SC-3 / D-84-03: `package.json` declares `pi-subagents >=0.35.0` as an optional peer; `npm run check` stays green | VERIFIED | `package.json` `peerDependencies["pi-subagents"] = ">=0.35.0"`, `peerDependenciesMeta.pi-subagents.optional = true`; absent from `dependencies`/`devDependencies`; `node_modules/pi-subagents` does not exist (declared-optional, not installed). README prerequisites bullet states the `>=0.35.0` floor. `node --test tests/architecture/no-telemetry-deps.test.ts` (IL-4 guard) passes. `npx tsc --noEmit` exits 0; `npx eslint` on all touched files exits 0. 84-REVIEW.md (deep code review, 9 files, 6 commits) recorded 0 findings, and independently confirmed `npx prettier --check` clean and the full relevant test slice (101/101) green. |
| 5 | SC-4: live foreground A/B UAT evidence (with skillPath -> `HELLO_WORLD_FROM_SKILL_ZX9`; without -> `NO_SKILL_LOADED`) captured and approved | VERIFIED (human-approved UAT, per task instruction not re-executed) | `84-04-SUMMARY.md` records the real end-to-end A/B through the actual bridge install path (`pi-claude-marketplace-hello-plugin-hello-agent`, pi-subagents 0.35.1, foreground `async: false`): Run A with `skillPath` present -> `HELLO_WORLD_FROM_SKILL_ZX9`; Run B with the `skillPath:` line deleted -> `NO_SKILL_LOADED`. `coverage[0].human_judgment: true` with rationale documented. This is a blocking `checkpoint:human-verify` task already resolved (`status: complete`, approved during execution) -- treated as the SC-4 signal per verification scope, not re-run live. |

**Score:** 4/4 must-haves verified (5 truths above map to 4 roadmap SCs; SC-1 spans truths 1-2 combined with the AGSK-04 re-amendment).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | emits `skillPath`, single-state legend | VERIFIED | Read in full; gated push confirmed; `SkillLegendEntry.preloaded` absent from interface. |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | `detectSkillTokens` 3-param, no `emittedSkills` | VERIFIED | Signature and call site confirmed via grep + read. |
| `tests/bridges/agents/frontmatter.test.ts` | 4x `skillPath:` line insertions, no `preloaded:` legend-input fields | VERIFIED | grep count = 4; suite passes. |
| `tests/bridges/agents/convert.test.ts` | 2x `skillPath:` line insertions | VERIFIED | grep count = 2; suite passes. |
| `tests/bridges/agents/convert-byte-identity.test.ts` | 2x `skillPath:` line insertions (out-of-plan-scope corpus, self-caught deviation) | VERIFIED | grep count = 2; file exists and is part of the green `npm run check` run recorded in 84-REVIEW.md. |
| `tests/integration/skill-path-resolution.test.ts` | SC-2 resolver-contract test, graceful skip | VERIFIED | Ran directly both branches (real-pass and env-forced-skip); both exit 0. |
| `package.json` | optional peer `pi-subagents >=0.35.0` | VERIFIED | Confirmed via `node -e` assertion against the live file. |
| `README.md` | `>=0.35.0` floor stated | VERIFIED | grep match on prerequisites bullet. |
| `.planning/workstreams/issue-86-agent-skill-preloads/REQUIREMENTS.md` | AGSK-06 defined, traceability row present | VERIFIED (with a documentation-lag note, see Gaps Summary) | AGSK-06 is defined with 4-part acceptance mirroring the ROADMAP SCs, mapped to Phase 84 in the Traceability table, and counted in Coverage (6/6). The requirement checkbox (`[ ]`) and its Traceability/Coverage prose ("In progress (Plans 84-01..03 of 4 complete)") were last updated after Plan 84-03 and were not refreshed after Plan 84-04 completed -- a stale-but-accounted-for state, not a missing one. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `emitGeneratedAgentFile` | `skillPath` line | `frontmatter.skills.length > 0` gate | WIRED | Same conditional block that already emits `skills:`; not gated on legend presence (confirmed by reading source). |
| Generated agent frontmatter | pi-subagents `resolveSkillsWithFallback` | `localBaseDir = dirname(agentFilePath)` + emitted `skillPath` | WIRED | `tests/integration/skill-path-resolution.test.ts` exercises this against the real installed resolver and passes. |
| `detectSkillTokens` call site (`convert.ts:527`) | `detectSkillTokens` definition (`convert.ts:139`) | 3-argument call | WIRED | Argument count and parameter list match; `tsc --noEmit` clean. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AGSK-06 | 84-01, 84-02, 84-03, 84-04 | Agent-local skillPath resolution end-to-end | SATISFIED | All four sub-plans' must-haves independently verified above (SC-1..SC-4 evidence). REQUIREMENTS.md defines and traces AGSK-06 to Phase 84 (see documentation-lag note). |
| AGSK-04 (re-amended) | 84-01, 84-02 | Single-state "(available on demand)" legend | SATISFIED | Code + tests confirm collapse; REQUIREMENTS.md AGSK-04 text already carries the single-state wording and cites the amendment. |

No orphaned requirements found: `grep -E "Phase 84"` in REQUIREMENTS.md yields only AGSK-06 and the AGSK-04 amendment note, both accounted for in plan frontmatter.

### Anti-Patterns Found

None. `grep -n -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across all 8 files modified/created by this phase returns zero matches. `npx eslint` on those files exits 0. 84-REVIEW.md (independent deep review, 0 findings) corroborates.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit fixture corpus (skillPath emission + legend collapse) | `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` | 93/93 pass | PASS |
| SC-2 resolver-contract (real pi-subagents present) | `node --test tests/integration/skill-path-resolution.test.ts` | 1/1 pass, not skipped -- real resolution exercised | PASS |
| SC-2 graceful-skip (peer absent) | `PI_SUBAGENTS_ROOT=/nonexistent-path node --test tests/integration/skill-path-resolution.test.ts` | 1 skipped, exit 0 | PASS |
| IL-4 telemetry guard | `node --test tests/architecture/no-telemetry-deps.test.ts` | 1/1 pass | PASS |
| Typecheck | `npx tsc --noEmit` | exit 0 | PASS |
| Lint | `npx eslint` on all 8 touched files | exit 0 | PASS |

### Human Verification Required

None. SC-4's live foreground A/B is a blocking `checkpoint:human-verify` task that was already executed and approved during phase execution (84-04-SUMMARY.md, `status: complete`, `human_judgment: true`, transcripts captured). Per verification scope, this is treated as the accepted SC-4 signal rather than re-run.

### Gaps Summary

No blocking gaps. One documentation-lag note (not a code gap, not blocking):

- `.planning/workstreams/issue-86-agent-skill-preloads/REQUIREMENTS.md` still shows AGSK-06 as an unchecked `[ ]` item and its Traceability/Coverage prose reads "In progress (Plans 84-01..03 of 4 complete)" / "in progress" -- last touched by the Plan 84-03 commit (`78bb14fa`). Plan 84-04's commit (`3853c5df`) updated ROADMAP.md (which correctly shows "4/4 plans executed" and all four plan checkboxes ticked) but did not touch REQUIREMENTS.md. AGSK-06 itself is fully defined, worded, and mapped to Phase 84 in REQUIREMENTS.md -- this is a stale status marker, not a missing or incorrect requirement. Recommend a trivial follow-up edit (check the `[x]` box, update the traceability/coverage status strings and the "Last updated" footer to reflect Plan 84-04) before milestone completion, but it does not block this phase's goal, which is fully achieved in code and tests.

---

_Verified: 2026-07-20T13:01:43Z_
_Verifier: Claude (gsd-verifier)_
