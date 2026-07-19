---
phase: 83-skill-tool-inherit-mapping
verified: 2026-07-19T18:20:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Install a plugin containing a Skill-declaring agent (e.g. the issue #86 canonical spec-tree changes-reviewer), run /reload, invoke the generated agent, and ask the child to list and load an installed Pi skill. Repeat with a non-Skill agent."
    expected: "The Skill-declaring agent's child session receives the lazy skill catalog (name + description, readable on demand) and can load a skill under its Pi name; the non-Skill agent's child runs with skills discovery disabled (pi-subagents passes --no-skills for inheritSkills: false)."
    why_human: "The conversion output is fully byte-pinned, but the phase goal's capability claim (child can dynamically discover and load skills) depends on the external pi-subagents/pi runtime honoring the emitted inheritSkills: true line. Static checks verified the pi-subagents 0.28.0 source contract (pi-args.ts:132-134 per 83-CONTEXT.md), not live behavior."
---

# Phase 83: Skill Tool Inherit Mapping Verification Report

**Phase Goal:** A Claude plugin agent that declared the `Skill` tool converts to a Pi agent whose child can dynamically discover and load installed Pi skills (`inheritSkills: true`), with provenance and legend wording that accurately describe that capability -- while agents that do not declare `Skill` keep their Phase 82 output byte-identically.
**Verified:** 2026-07-19T18:20:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC-1: `Skill`-declaring agent (incl. #86 canonical) converts with `inheritSkills: true`; `Skill` stays in `droppedTools`; warning states the discovery mapping and that catalog names differ (pointing at the body legend) | VERIFIED | `convert.ts:262-284` computes `inheritSkills = skillDeclared && !disallowedTokens.includes("Skill")` and pushes the D-83-04 wording ("mapped to Pi skill discovery ... catalog names are Pi names, which differ from Claude skill names (see the skill legend in the agent body)"); `convert.ts:542` threads `inheritSkills: toolsResult.inheritSkills` to the emitter. Tests: `convert.test.ts:695-702` (flag + drop record), `600-605` (exact warning), `1038-1097` (#86 canonical whole-file pin with `inheritSkills: true` + `SKILL_INHERIT_WARNING`). All pass (npm run check exit 0). |
| 2 | SC-2: `Skill` in `disallowedTools`, or not declared at all, keeps `inheritSkills: false` and byte-identical Phase 82 output | VERIFIED | `DISALLOWED_SKILL_EXPECTED` whole-file raw-literal pin (`convert.test.ts:642-673`) was captured at pre-AGSK-05 HEAD (commit 73b92f15, before converter change 4a62c64c) and has 0 diff hunks since capture (`git diff 73b92f15..HEAD` touches it nowhere); it passes at HEAD. Seven-class byte-identity corpus (`convert-byte-identity.test.ts`) is untouched across the whole phase (`git diff f14cd717..HEAD` empty) and green. Branch tests `convert.test.ts:704-724` cover disallowed / not-declared / omitted-default. Known degenerate exception: WR-01 (see Anti-Patterns) -- duplicated `Skill` token, plan-sanctioned. |
| 3 | SC-3: legend annotates known-but-not-preloaded skills as available on demand for `Skill`-declaring agents | VERIFIED | `frontmatter.ts:342-347` third annotation state gated on `inheritSkills`; call site passes `frontmatter.inheritSkills ?? false` (`frontmatter.ts:318`). Direct emitter full-output pin `frontmatter.test.ts:489-537` (preloaded + on-demand entries in one legend); e2e pins `convert.test.ts:811-829` (on-demand) and `831-862` (both opposite directions render `not available in this session`). |
| 4 | SC-4: skills:-list + inherited-catalog duplication documented by a pinning test | VERIFIED | `convert.test.ts:726-738` -- test "AGSK-05 / D-83-07 a preloaded skill also remains discoverable in the inherited catalog (accepted duplication)" asserts both `/^skills: spec-tree-review-changes$/m` and `/^inheritSkills: true$/m` in one output; doc comment names eager full-content injection + lazy catalog listing, no dedup logic. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | `ToolMappingResult.inheritSkills` computed in mapTools; warning branch; convertAgent threading | VERIFIED | Interface field at line 79; flag computation 268-270; single-push warning branch 278-284; threading at 542. `splitCsv(rawDisallowed)` called exactly once (compute-once/reuse per plan). |
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | `inheritSkills?` optional field; conditional trio line; renderSkillLegend third state | VERIFIED | `readonly inheritSkills?: boolean` at 191; conditional lowercase emission at 277 (last frontmatter field, AG-8 position); `renderSkillLegend(legend, inheritSkills)` at 334-356 with "available on demand". |
| `tests/bridges/agents/convert.test.ts` | `DISALLOWED_SKILL_EXPECTED`, `SKILL_INHERIT_WARNING` / `SKILL_DROP_WARNING_NO_INHERIT`, D-83 pin suite, updated #86 canonical pin | VERIFIED | All present (lines 590-598, 642-673, 695-738, 811-862, 1038-1097). `DISALLOWED_SKILL_EXPECTED` contains zero `${` interpolations. Stale "out of scope" comment removed (0 matches). |
| `tests/bridges/agents/frontmatter.test.ts` | `INHERIT_TRUE_EXPECTED` full-output pin; on-demand legend render pin | VERIFIED | Lines 446-537: full-output `assert.equal` pins for the true path, AG-8 last-field position, and the three-state legend. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| convert.ts mapTools | convert.ts warning branch + return | single `inheritSkills` boolean | WIRED | One boolean drives warning wording (278-284) and result field (302, 311). |
| convert.ts convertAgent step 8 | frontmatter.ts emitGeneratedAgentFile | `inheritSkills: toolsResult.inheritSkills` | WIRED | Exact pattern at convert.ts:542. |
| frontmatter.ts emitGeneratedAgentFile | renderSkillLegend | `frontmatter.inheritSkills ?? false` second arg | WIRED | frontmatter.ts:318. |
| tests/bridges/agents/convert.test.ts | convert.ts | convertSpecTree driving convertAgent; exact-equality warning/frontmatter pins | WIRED | `SKILL_INHERIT_WARNING` string appears exactly once in convert.ts and once in convert.test.ts (byte-identical); D-82-09 string exactly once in convert.ts. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Generated agent fileContent | `inheritSkills` frontmatter line + legend annotation | `raw.tools` / `raw.disallowedTools` -> mapTools -> toolsResult.inheritSkills -> emitGeneratedAgentFile | Yes -- #86 canonical whole-file pin proves real source frontmatter flows through parse -> convert -> emit to the exact expected bytes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full quality gate (NFR-6) | `npm run check` | exit 0; 2974 pass / 0 fail (unit) + 16/16 integration | PASS |
| Duplicate-Skill + disallow degenerate input (WR-01 reproduction) | node probe against HEAD convertAgent | `droppedTools: ["Skill","Skill"]`, warnings: 1x D-82-09 string (pre-phase code pushed per-occurrence: 2 warnings) | PASS (behavior confirmed; see WR-01) |
| ASCII purity of all four modified files | node byte scan | 0 literal U+2192, 0 U+2014, 0 non-ASCII bytes in all four files | PASS |
| Corpus + pin immutability | `git diff f14cd717..HEAD -- convert-byte-identity.test.ts` (empty); `git diff 73b92f15..HEAD` has no `DISALLOWED_SKILL_EXPECTED` hunks | Both untouched | PASS |

### Probe Execution

SKIPPED -- no `scripts/*/tests/probe-*.sh` convention exists in this repo and no phase artifact declares probes.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AGSK-05 | 83-01, 83-02, 83-03 | Skill tool declaration maps to `inheritSkills: true` with discovery warning, on-demand legend, byte-identity for non-declaring/disallowed agents | SATISFIED | All four SC truths verified above; REQUIREMENTS.md line 21 checked `[x]`, traceability row "AGSK-05 / Phase 83 / Complete". |

No orphaned requirements: AGSK-05 is the only requirement REQUIREMENTS.md maps to Phase 83, and all three plans declare it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| convert.ts | 278-284 | WR-01 (from 83-REVIEW.md, reproduced first-hand): Skill warning moved from per-occurrence to per-agent push. A degenerate declared-but-disallowed source with a duplicated `Skill` token (`tools: Read, Skill, Skill` + `disallowedTools: Skill`) now emits 1 warning where Phase 82 emitted 2 -- a byte deviation inside the SC-2 class, and `droppedTools` still records `Skill` twice (2 drop records, 1 explanation). | WARNING (advisory) | Plan-sanctioned: 83-03 PLAN specified "push exactly one warning" keyed on `skillDeclared`; 83-03 SUMMARY documents it as a key decision. No realistic fixture is affected (the pre-phase per-occurrence behavior was unpinned and byte-irrelevant to every fixture and to the seven-class corpus). Recommended follow-up: add a pin test for the duplicate-Skill-disallowed class so the dedup is a documented contract rather than an unpinned edge. |
| frontmatter.ts | 95 | WR-02 (from 83-REVIEW.md): pre-existing `parseFrontmatter` closing-delimiter regex matches `---` as a line prefix, silently truncating frontmatter for lines starting with `---`. | INFO (pre-existing, out of phase scope) | Not introduced by this phase (regex unchanged in the phase diff). Affects the inherit flag only for pathological source frontmatter. Suggested fix in 83-REVIEW.md (`/\n---(?:\r?\n|$)/`) is a candidate for a follow-up quick fix. |

No debt markers: zero TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER matches across all four modified files.

### Human Verification Required

### 1. Live inheritSkills round-trip through pi-subagents

**Test:** Install a plugin containing a Skill-declaring agent (e.g. the issue #86 canonical spec-tree changes-reviewer) via `/claude:plugin install`, run `/reload`, invoke the generated agent, and ask the child session to list and load an installed Pi skill. Repeat with a non-Skill agent.
**Expected:** The Skill-declaring agent's child receives the lazy skill catalog (name + description, readable on demand) and can load a skill under its Pi name; the non-Skill agent's child runs with skills discovery disabled (pi-subagents passes `--no-skills` for `inheritSkills: false`).
**Why human:** The conversion output is fully byte-pinned, but the goal's capability claim ("child can dynamically discover and load installed Pi skills") depends on the external pi-subagents/pi runtime honoring the emitted flag. Static verification confirmed the pi-subagents 0.28.0 source contract (pi-args.ts:132-134, cited with verification date in 83-CONTEXT.md), not live behavior.

### Gaps Summary

No gaps. All four ROADMAP success criteria are verified in the codebase with exact-equality pins, both byte-identity guards (the 83-01 disallowed whole-file pin and the seven-class corpus) survived the phase untouched and green, and `npm run check` exits 0. The single automated-verification caveat is WR-01, a plan-sanctioned warning-dedup for the degenerate duplicated-`Skill`-token input class -- advisory, not goal-blocking, with a recommended follow-up pin test. WR-02 is a pre-existing parser defect outside this phase's scope. One human verification item remains: a live end-to-end run confirming pi-subagents honors the emitted `inheritSkills: true`.

---

_Verified: 2026-07-19T18:20:00Z_
_Verifier: Claude (gsd-verifier)_
