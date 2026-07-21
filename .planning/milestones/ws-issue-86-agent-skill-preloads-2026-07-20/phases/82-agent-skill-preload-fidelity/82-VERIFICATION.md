---
phase: 82-agent-skill-preload-fidelity
verified: 2026-07-19T15:53:15Z
status: passed
score: 14/14 must-haves verified
overrides_applied: 0
---

# Phase 82: Agent Skill Preload Fidelity Verification Report

**Phase Goal:** A Claude plugin agent declaring skill preloads (documented block-list `skills:` form, plugin-qualified names) converts to a Pi agent whose generated frontmatter carries the preloads, whose provenance explains the dropped `Skill` tool, and whose body tells the child LLM which referenced Claude skills are (or are not) in its context -- while every agent the fix does not apply to stays byte-identical.
**Verified:** 2026-07-19T15:53:15Z
**Status:** passed
**Re-verification:** No -- initial verification

All evidence below comes from reading the actual source/test files and executing
the test suites and quality gate in this verification session. SUMMARY claims
were treated as hypotheses, not evidence.

## Goal Achievement

### Observable Truths

Merged from ROADMAP Success Criteria (SC-1..SC-5, the contract) plus distinct
plan-frontmatter must_haves (deduplicated against the SCs).

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC-1: issue #86 canonical agent converts to `tools: bash,read` and `skills: spec-tree-review-changes`; dash item folds, no bogus `- spec-tree` in droppedFields | ✓ VERIFIED | `convert.test.ts:846-901` runs the full parseFrontmatter -> convertAgent pipeline on the exact #86 source (`tools: Bash, Read, Skill` + block-list `skills:` with `- spec-tree:review-changes`), asserts each facet AND pins the whole fileContent with `assert.equal`. Executed: 53/53 convert tests pass. |
| 2   | SC-2: same conversion records `droppedTools: Skill` with the warning that skills discovery is disabled and only listed skills are preloaded | ✓ VERIFIED | `convert.ts:231-234` pushes the exact D-82-09 string only when the dropped token is `Skill`; canonical pin embeds `droppedTools: Skill` + the warning in the whole-file constant (`convert.test.ts:886-889`). Test executed green. |
| 3   | SC-3: cross-plugin qualifier (`other-plugin:some-skill`) drops with a warning naming the token; bare names map exactly as today | ✓ VERIFIED | `convert.ts:370-377` (qualifier != pluginName -> exact warning naming full token, `continue`); `convert.test.ts:463-478` pins the full sentence and no double-warn; `convert.test.ts:549-570` pins unchanged bare behavior including duplicate emission (no dedupe). Executed green. |
| 4   | SC-4: body containing `spec-tree:review-changes` carries a legend entry mapping to `spec-tree-review-changes` with "(preloaded in your context)" / "(not available in this session)" annotations | ✓ VERIFIED | `frontmatter.ts:318-336` renders both annotations; `convert.test.ts:660-686` pins the preloaded and not-available cases via convertAgent; the canonical whole-file pin includes the rendered legend bytes. Executed green. |
| 5   | SC-5: agents without fix triggers produce byte-identical output; CSV/inline-array forms parse unchanged; generated `skills:` stays CSV | ✓ VERIFIED | Executed `node --test tests/bridges/agents/convert-byte-identity.test.ts`: 7/7 pass. `git diff b9441bec HEAD -- <corpus file>` is EMPTY (file has exactly one commit in its history -- the pre-fix 82-01 pin). Emitter still joins `skills` CSV (`frontmatter.ts:269`). `frontmatter.test.ts:127-137` pins CSV/inline-array/empty-value forms unchanged. |
| 6   | 82-01: corpus captured at pre-fix HEAD, fix-trigger-free, survives every later plan untouched | ✓ VERIFIED | Commit order verified: `b9441bec` (corpus) is an ancestor of `3d6bde04` (first converter change). Corpus inputs read: no dash lists, no `Skill` tool, no colon-qualified skills tokens, token-free bodies. `git diff --exit-code` clean vs both pin commit and working tree. |
| 7   | D-82-01: dash items fold into ANY key's CSV value; unsupported list keys land in droppedFields as one clean name | ✓ VERIFIED | `frontmatter.ts:134-168` (`applyFrontmatterLine`, dash branch before colon split); `frontmatter.test.ts:81-89` pins `hooks:` folding to `a:b,c` with no `- ` keys. Executed: 27/27 frontmatter tests pass. |
| 8   | D-82-02: lenient line-based parser kept, no YAML dependency | ✓ VERIFIED | `grep 'js-yaml\|from "yaml"' frontmatter.ts` -> no matches. AG-6 colon-tolerance test still green (`frontmatter.test.ts:14-25`). |
| 9   | D-82-03: mixed form resolves inline-value-wins, documented in parser comment and pinned by test | ✓ VERIFIED | Comment at `frontmatter.ts:20-21` and `:82-83` names D-82-03; `lastKeyFoldable = value === ""` (`frontmatter.ts:167`) implements it; `frontmatter.test.ts:91-104` pins `tools: Read` + dash items -> `Read`. Stale "no list-of-dash arrays" phrase absent. |
| 10  | Warn-drop never becomes a throw: unsafe qualified remainders AND bare tokens (empty, `.`, `..`, separators, control chars) warn-drop | ✓ VERIFIED | Post-review catch-based guard `convert.ts:382-392` (try/catch around `generatedSkillName`, replacing the incomplete enumeration -- CR-01 fix `bf62c77b`); `convert.test.ts:480-532` pins all classes with `assert.doesNotThrow`. Executed green. |
| 11  | D-82-08: only the `Skill` drop warns; other drops silent; aggregate warnings order tools-slot-before-skills-slot | ✓ VERIFIED | `convert.ts:227-239` warns only on exact token `Skill`; `convert.test.ts:596-618` pins silent WebFetch drop and disallowedTools interaction; `convert.test.ts:620-630` pins full-array `deepEqual` order. Executed green. |
| 12  | D-82-09: the Skill-drop warning is the exact locked string | ✓ VERIFIED | `convert.ts:233` literal matches 82-CONTEXT.md D-82-09 wording byte-for-byte; test pin `convert.test.ts:586-587` is the same literal; canonical whole-file pin interpolates it into provenance bytes. Executed green. |
| 13  | D-82-04/D-82-05: legend renders immediately after the provenance comment, before body, with heading exactly `## Pi coding agent skill legend` and the locked section shape | ✓ VERIFIED | `frontmatter.ts:303-336` (single-seam assembly, `renderSkillLegend`); `frontmatter.test.ts:389-435` pins full output bytes with legend between `-->` and body; no-legend/empty-legend byte layout pinned against a pre-change constant (`frontmatter.test.ts:379-387`). Executed green. |
| 14  | D-82-06/D-82-07: only same-plugin tokens resolving into knownSkills get entries; whole body scanned including fences; token-free bodies byte-identical (reference-gated) | ✓ VERIFIED | `detectSkillTokens` (`convert.ts:138-174`): lookbehind `(?<![A-Za-z0-9_.:-])`, candidate class `[A-Za-z0-9_-]+`, knownSkills gating, first-occurrence dedupe, `<plugin>-` elision throw-guard. Pins: unknown/cross-plugin/embedded/dotted-prefix absence, fence inclusion, dedupe order, token-free exact byte pin (`convert.test.ts:688-807`). Executed green. |

**Score:** 14/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `tests/bridges/agents/convert-byte-identity.test.ts` | 7 full-fileContent exact-equality pins captured pre-fix; min 80 lines; contains `assert.equal` | ✓ VERIFIED | 261 lines, 7 `assert.equal` whole-file pins, imports `convertAgent` + `parseFrontmatter`. Single-commit file history (`b9441bec` only); zero diff since. 7/7 pass executed. |
| `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | Dash-list folding + D-82-03 doc; SkillLegendEntry; legend field on emitGeneratedAgentFile; contains `D-82-03` and `Pi coding agent skill legend` | ✓ VERIFIED | Both required strings present. `applyFrontmatterLine` fold logic real (not stub); `renderSkillLegend` renders locked bytes; arrow emitted via `→` escape (no literal U+2192/U+2014 in source -- byte-scanned). |
| `extensions/pi-claude-marketplace/bridges/agents/convert.ts` | mapSkills qualifier handling + throw guards; mapTools Skill warning; contains `dropped tool "Skill"` and `detectSkillTokens` | ✓ VERIFIED | Both required strings present. `detectSkillTokens`/`escapeRegExp` are private (export surface unchanged: only pre-existing 6 exports). |
| `tests/bridges/agents/frontmatter.test.ts` | Parser fold pins + legend byte-layout pins (present/absent/empty) | ✓ VERIFIED | 27 tests executed green: 7 fold-behavior pins (colon-bearing, multi-item, unsupported-key, mixed, orphan/bare dash, CRLF, unchanged forms) + 3 legend byte-layout pins with full-output constants. |
| `tests/bridges/agents/convert.test.ts` | Qualified/cross-plugin/no-throw/D-82-09/order pins; detection edges; #86 canonical e2e | ✓ VERIFIED | 53 tests executed green, including the canonical whole-file pin and reference-gated twin, plus review-fix regression pins (separators/control chars, colon-spacing, dotted prefix). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `convert-byte-identity.test.ts` | `convert.ts` / `frontmatter.ts` | `convertAgent` / `parseFrontmatter` imports | ✓ WIRED | Imports at lines 4-5; full-pipeline classes 1, 2, 7 call parseFrontmatter. |
| `frontmatter.ts` (folded values) | `convert.ts` | comma-joined strings consumed by `splitCsv` with zero splitCsv changes | ✓ WIRED | `mapSkills` calls `splitCsv(rawSkills)` (`convert.ts:348`); splitCsv unchanged; canonical e2e proves the fold -> map -> emit path end to end. |
| `convert.ts` | `domain/name.ts` | stripped remainder delegated to `generatedSkillName` (name.ts read-only) | ✓ WIRED | Import `convert.ts:13`; delegation at `:389` (mapSkills) and `:167` (detectSkillTokens). `domain/name.ts` untouched by phase commits. |
| `convert.ts` warnings | `frontmatter.ts` provenance | `formatOptionalProvenanceList` -> `sanitizeProvenance` | ✓ WIRED | Warnings flow through emit input (`convert.ts:529`); breakout guard pinned: crafted `evil-->qual:skill` leaves exactly one `-->` (`convert.test.ts:572-579`). |
| `convertAgent` | `emitGeneratedAgentFile` | `SkillLegendEntry[]` legend field | ✓ WIRED | `detectSkillTokens` result passed at `convert.ts:508,532`; empty-legend byte identity pinned. |
| `convertAgent` | extension install path | `stage.ts` | ✓ WIRED | `stage.ts:48` imports, `:135` calls convertAgent over discovered agents; `parseFrontmatter` consumed by `discover.ts`. The fixed pipeline is live, not orphaned. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Generated agent frontmatter `skills:` | `skillsResult.emit` | `parseFrontmatter` fold -> `raw.skills` -> `splitCsv` -> qualifier strip -> `generatedSkillName` -> knownSkills gate | Yes -- canonical e2e pin proves real bytes end to end | ✓ FLOWING |
| Legend block | `legend` (SkillLegendEntry[]) | `substitutedBody` regex scan -> knownSkills/emittedSkills membership | Yes -- entries derive from actual body + discovery data; reference-gated when empty | ✓ FLOWING |
| Provenance warnings | `warnings` | per-mapper slot pushes aggregated in convertAgent | Yes -- deepEqual full-array order pin | ✓ FLOWING |

### Behavioral Spot-Checks

All executed in this verification session (not taken from SUMMARYs):

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Byte-identity corpus green | `node --test tests/bridges/agents/convert-byte-identity.test.ts` | 7 pass / 0 fail | ✓ PASS |
| Parser + legend rendering pins | `node --test tests/bridges/agents/frontmatter.test.ts` | 27 pass / 0 fail | ✓ PASS |
| Mapping, warning, detection, #86 e2e pins | `node --test tests/bridges/agents/convert.test.ts` | 53 pass / 0 fail | ✓ PASS |
| Corpus untouched since pre-fix pin | `git diff b9441bec HEAD -- tests/bridges/agents/convert-byte-identity.test.ts` | empty diff; file history = 1 commit | ✓ PASS |
| Full quality gate (NFR-6) | `npm run check` | exit 0 (typecheck + ESLint + Prettier + unit + integration 16/16) | ✓ PASS |
| Corpus pin precedes all converter changes | `git merge-base --is-ancestor b9441bec 3d6bde04` | exit 0 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (none) | `find scripts -path '*/tests/probe-*.sh'` | no probes exist; phase declares none | SKIPPED (no probes) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AGSK-01 | 82-01, 82-02 | Block-list `skills:`/`tools:` parses with values intact; no bogus `- <token>` droppedFields; CSV/inline-array byte-identical | ✓ SATISFIED | Truths 1, 5, 6, 7, 8, 9 |
| AGSK-02 | 82-03 | Same-plugin qualifier maps like bare form; cross-plugin warns-and-drops naming token | ✓ SATISFIED | Truths 1, 3, 10 |
| AGSK-03 | 82-03 | Skill-tool drop explained in provenance warnings | ✓ SATISFIED | Truths 2, 11, 12 |
| AGSK-04 | 82-01, 82-04 | Body-referenced skills get a visible legend; token-free bodies byte-identical | ✓ SATISFIED | Truths 4, 13, 14, 5 |

Orphan check: REQUIREMENTS.md maps AGSK-01..04 to Phase 82 (all claimed by plans) and AGSK-05 to Phase 83 (explicitly out of this phase's scope per 82-CONTEXT.md). No orphaned requirements.

### Review-Fix Regression Check (advisory review, status: fixed)

The four post-plan fix commits were verified against the locked decisions and the corpus:

| Commit | Fix | Locked-decision impact | Corpus impact |
| ------ | --- | ---------------------- | ------------- |
| `bf62c77b` (CR-01) | catch-based guard replaces `""`/`"."`/`".."` enumeration in mapSkills | Strengthens the 82-03 "warn-drop never throws" truth; D-82-08/09 untouched | None -- corpus classes contain no unsafe tokens; 7/7 green |
| `fade105c` (WR-01) | trim around qualifier colon | Within AGSK-02 intent (same-plugin qualifier maps like bare form); pinned by new tests | None -- corpus has no colon-bearing skills tokens |
| `fb158171` (WR-02) | `.` added to legend lookbehind | Tightens D-82-06 (fewer false positives -- its stated purpose); pinned by dotted-prefix test | None -- corpus bodies are token-free |
| `8f5fcb3d` (IN-03) | removed `(T-82-12)` comment | Comment-policy compliance only | None -- test file comment change |

Note (informational, not a gap): the CR-01 fix intentionally extends warn-drop to bare unsafe tokens (`.`, `..`, `a/b`) that previously THREW and aborted plugin staging. Those inputs produced no generated output before, so SC-5 byte-identity (which compares generated output) is unaffected; the change is documented as a BLOCKER fix in 82-REVIEW.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers, no empty-return stubs, no forbidden GSD planning anchors, no literal U+2192/U+2014 in the five phase-touched files | - | - |

Review observations IN-01 (duplicate `Skill` tokens duplicate the D-82-09 warning) and IN-02 (`__proto__` frontmatter key hardening) were deliberately left unfixed as documented info-level observations in 82-REVIEW.md; neither violates a locked decision or a success criterion.

### Human Verification Required

None. The phase surface is deterministic text transformation with byte-exact pins: the #86 canonical fixture, the locked D-82-05 legend shape, and the locked D-82-09 warning string were all user-approved in 82-CONTEXT.md and are asserted verbatim by executed tests. No visual, real-time, or external-service behavior exists in this phase. No `<human-check>` blocks were deferred by any plan.

### Gaps Summary

No gaps. All five ROADMAP success criteria and all plan-level must-haves are observable in the codebase and pinned by executed tests. The pre-fix byte-identity corpus survived the entire phase (including the four review-fix commits) with a zero diff against its capture commit, and the full quality gate exits 0.

---

_Verified: 2026-07-19T15:53:15Z_
_Verifier: Claude (gsd-verifier)_
