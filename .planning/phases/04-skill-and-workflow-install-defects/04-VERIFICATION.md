---
phase: 04-skill-and-workflow-install-defects
verified: 2026-11-14T07:37:10Z
status: passed
score: 37/38 must-haves verified
covered_files: [".agents/skills/cucumber/rules/world-and-stand-ins.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-SUMMARY.md",".planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md","CHANGELOG.md","docs/research/parity-gaps/skills-commands.md","docs/workflows-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/index.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/domain/component-paths.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts","extensions/pi-claude-marketplace/domain/skill-tokens.ts","extensions/pi-claude-marketplace/domain/workflow-script.ts","extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts","features/lib/published-marketplace.ts","features/lib/upstream/index.ts","features/lib/upstream/workflows.ts","features/skill/root-source-entries.feature","features/skill/sibling-links.feature","features/step_definitions/marketplace/publishing.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-restrictions.feature","features/workflow/references.feature","test/bridges/agents/convert.test.ts","test/bridges/agents/index.test.ts","test/bridges/skills/stage.test.ts","test/domain/component-paths.test.ts","test/domain/plugin-resolver.test.ts","test/domain/skill-sibling-paths.test.ts","test/domain/skill-tokens.test.ts","test/domain/version.test.ts","test/domain/workflow-script.test.ts","test/orchestrators/plugin/discover-names.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/shared/redact-absolute-paths.test.ts"]
covered_digest: "v4:sha256:4fb38343c62697e53a03ef446f9b7dd653fa71f139c3930c4de6cea0a971a2b8"
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "PG-SKILL-04 unclassified edge: a segment that starts with a sibling's folder name and continues with %, +, ~, @ or a non-ASCII letter"
    reason: "Accepted as the current behavior: the `../b` prefix is rewritten (`../b%20x/ref.md` becomes `../demo-b%20x/ref.md`). The path was dead in the staged layout before and stays dead, so no working link breaks. A boundary check is tracked as BACKLOG SIBLINGPREFIX-01."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T08:30:00Z"
  - must_have: "Plan 04-04 judgment-tier prohibition: no staged text claims the user opted in to workflows"
    reason: "Holds on inspection: the only rewriter change is the slash arm of `domain/skill-tokens.ts`; the phase diff under extensions/ adds no opt-in wording; `features/workflow/references.feature` asserts the exact text the model receives."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T08:30:00Z"
decision_coverage:
  honored: 16
  total: 16
  not_honored: []
human_verification:
  - test: "Decide the PG-SKILL-04 unclassified edge: a path segment that starts with a sibling skill's folder name and continues with a character outside the token grammar (`%`, `+`, `~`, `@`, a non-ASCII letter). Probe: rewriteSiblingSkillPaths(\"../b%20x/ref.md\", {fileSourceDir: <skills>/a, skillSourceDir: <skills>/a, siblingSkills: {a, b}})."
    expected: "Either the maintainer accepts the current behavior (the `../b` prefix is rewritten, giving `../demo-b%20x/ref.md`; the path was dead in the staged layout before and stays dead, so no working link breaks) and a BACKLOG line records it, or the token gets a boundary check that leaves such a path byte-identical, as the 04-03 truth for D-PG4-06 and the 04-03-SUMMARY flagged assumption state."
    why_human: "The token boundary is the agent's discretion under CONTEXT. A space after `../b` must stay a boundary for prose (`see ../b for details`), so which characters continue a segment is a product choice, not a mechanical check."
  - test: "Confirm the judgment-tier prohibition of plan 04-04: no staged command, skill, or agent gains text that tells the model the user opted in to workflows or counters the engine's opt-in guidance."
    expected: "Holds. Non-authoritative LLM verdict: the only change to the rewriter is the slash arm of `domain/skill-tokens.ts` (`token.startsWith(\"/\") ? `/${workflowName}` : workflowName`); the phase diff under extensions/ adds no opt-in wording; `features/workflow/references.feature` asserts the exact text the model receives for the command body."
    why_human: "Judgment-tier prohibition (ADR-550 D4): it needs an explicit human resolution, and a verifier pass is not authoritative for it."
---

# Phase 4: Skill and Workflow Install Defects Verification Report

**Phase Goal:** The official skill and workflow plugins install what Claude Code loads, and the text they install names things that exist. A root-source marketplace entry installs only its listed skills, a link to a sibling skill resolves, a command can start its plugin's workflow by name, and an install says when a workflow does not keep an agent's tool restriction.

**Verified:** 2026-11-14T07:37:10Z
**Status:** passed with two orchestrator overrides pending maintainer review (all four success criteria verified; the edge decision and the judgment-tier prohibition are recorded under `overrides`)
**Re-verification:** No, initial verification

## Verification Basis

- HEAD `a9402c74` on `features/gaps`, clean tree. Phase range `e739fcfa..a9402c74`.
- Code read directly: `domain/component-paths.ts` (root-source rule), `domain/skill-sibling-paths.ts` and its wiring in `bridges/skills/stage.ts`, `domain/skill-tokens.ts` (workflow arm), `orchestrators/plugin/discover-names.ts` (restriction join), the `info.ts` note and lenient-listing sites, and the `install-outcome.ts` / `update-swap.ts` warning sites. The 04-01 and 04-02 SUMMARY text is out of date after WR-02, WR-04, WR-05, and WR-06. This report judges the code, not those summaries.
- Run by the verifier in its own process:
  - The owner unit tests: `node --import test/platform/isolated-pi-home.ts --test` over `skill-sibling-paths`, `skill-tokens`, `component-paths`, `workflow-script`, `discover-names`, `redact-absolute-paths`, and `version`. 689 of 689 pass.
  - The four phase features under cucumber's default profile, which equals `adapter`: `root-source-entries`, `sibling-links`, `references`, and `agent-restrictions`. 27 of 27 scenarios and 357 of 357 steps pass.
- Not run: `npm run check`. The orchestrator owns the phase gate and is running it at HEAD.
- `verify.artifacts`: 25 of 25 artifacts pass across the six plans. `verify.key-links`: 15 of 15 links are verified.

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | With `source: "./"` and `skills: ["./skills/a"]`, and `skills/a` and `skills/b` on disk, `info` lists `a` only and only `a` is installed. After an update that drops a listed skill, no file or record of that skill stays behind (PG-CORE-01). | ✓ VERIFIED | `isMarketplaceRootSource` and `collectRootSourceSkillPaths` (`component-paths.ts:555-725`) replace `skills/` and the manifest paths with the surviving listed folders. `info` uses the same predicate (`info.ts:2269`). Scenarios passed in this run: install stages `root-a` alone; `info` shows `plugin components skills = a`; update 1.0.0→1.1.0 and a same-version reinstall each leave only `root-a/` and the record `root-a`; a new session offers only `/skill:root-a`; `/root:b` reaches the model as typed; a second reinstall changes nothing. The completion cache has no per-skill row (`PluginIndexRow`: name, status, version). `version.test.ts` pins that the hash version covers `.claude-plugin/marketplace.json`, so an unversioned entry's `skills` change reaches `update`. |
| SC2 | Skill `a` says `See ../b/ref.md`. After the install, the text the model receives names a path that exists and holds `b`'s file (PG-SKILL-04). | ✓ VERIFIED | `sibling-links.feature` scenario 1 passed: the model receives `See ../demo-b/ref.md.`, reads `…/skills/demo-a/../demo-b/ref.md`, and gets `The reference of skill b.` The rewrite runs after `rewriteMarkdownReferences` and before `substituteClaudeVars` (`stage.ts:394-406`). The sibling map is built from discovery in `prepareStageSkills` (`stage.ts:516`), which both `install-outcome.ts:1267` and `update-swap.ts:402` call. |
| SC3 | A command body `Workflow({ name: "demo:scan" })`: the scripted model calls `workflow` with the name copied from the prompt, the run completes, and a slash reference keeps its slash (PG-WF-01). | ✓ VERIFIED | `skill-tokens.ts`: `return token.startsWith("/") ? `/${workflowName}` : workflowName`. `references.feature` passed: the prompt holds `Call Workflow({ name: "demo:scan" }) now. Slash form: /demo:scan.`, the tool call `workflow {"name":"demo:scan"}` returns `started the workflow scan`, and the run ends `completed` with `Scan done.` The staged skill keeps `allowed-tools: Workflow(demo:scan)`. |
| SC4 | An agent `reader` (`tools: Read`) and a workflow with `agentType: "demo:reader"` install with the restriction note, and `info` shows it. The compatibility page says the same, and the engine request is drafted under `.planning/upstream/` (PG-SEC-01). | ✓ VERIFIED | `readAgentTypes` in `workflow-script.ts` puts the literal `agentTypes` on the named verdict. `workflowAgentRestrictionNotes` (`discover-names.ts:168`) is spread into the install and update warnings (`install-outcome.ts:1254`, `update-swap.ts:1713`) and into `info` notes (`info.ts:1290`). `agent-restrictions.feature` passed for install, update, and `info`, and for the no-note case. `docs/workflows-compatibility.md:127` has the D-PG4-14 row. `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` exists and says "Patch: no patch exists; this report is not filed." The note wording is the WR-05 text, under D-PG4-12 (accepted without review). |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Evidence |
|------|--------|--------|----------|
| 04-01 | 9 (non-root and object sources keep D-CF1-06; no-survivor arms; shared `skills/` folder; listed root or `skills/` collects once; absent, null, or empty `skills`; listed order; repeat reinstall idempotent; resolver writes nothing and only the update or reinstall transaction removes; hash covers `marketplace.json`) | ✓ 9/9 VERIFIED | `collectRootSourceSkillPaths` and `addListedSkillPaths` read directly; the `component-paths` and `version` owner cases pass; the shared-folder, repeat-reinstall, and fallback scenarios pass. After WR-02 and WR-04, a refused listed path is reported in Claude Code 2.1.323's wording and the plugin stays installable (Outline rows for `../outside`, `../outside/skills`, `./skills/missing`, and `./notes.md` pass). |
| 04-02 | 4 (a self-skill path lists as one skill; lenient mirror; lenient branch never reads a refused path; non-root unchanged) | ✓ 4/4 VERIFIED | `info.ts` `rootSourceLenientSkillPaths` (async probe after IN-01, cwd-free after WR-03); the `info` scenarios for escape, cwd climb, and all-missing pass. |
| 04-03 | 5 (supporting Markdown depth and trailing slash; all four positions plus `${CLAUDE_SKILL_DIR}`; D-PG4-06 byte-identity; root-source unlisted sibling; every verb gets the map) | ✓ 4/5 VERIFIED, ? 1 UNCERTAIN | See the PG-SKILL-04 edge below. The D-PG4-06 truth holds within the token grammar, but a segment that starts with a sibling name and continues with an out-of-grammar character is not byte-identical. |
| 04-04 | 5 (elision and precedence; staged skill keeps bare name; byte-identity on a miss; recognition only on a generated name and an ASCII slash; doc D-PG4-10) | ✓ 5/5 VERIFIED | The `skill-tokens` owner cases pass; `docs/workflows-compatibility.md:175` carries the corrected retargeting statement and the residuals. |
| 04-05 | 7 (update prints once; upstream and generated names, `tools` and `disallowedTools`, with or without pi-subagents; no-note arms; empty arms; exact equality and escaping; never persisted; unreadable script costs its note) | ✓ 7/7 VERIFIED | `workflowAgentRestrictionNotes` is pure, recomputed per call, and never written to state; the `discover-names` and `workflow-script` owner cases pass. After IN-04, an agent that keeps all four built-ins gets no note (IN-05 is an open maintainer question). |
| 04-06 | 4 (`info` reads agent files only inside the plugin root; no-literal plugins unchanged; root-source exception on the compat page; CHANGELOG reinstall line) | ✓ 4/4 VERIFIED | `previewAgentRestrictionNotes` filters through `resolveContainedComponentPath` and catches to no note; `docs/workflows-compatibility.md:39`; `CHANGELOG.md:13`. |

**Score:** 37/38 truths verified (4 success criteria + 34 plan truths), 1 uncertain, 0 failed, 0 behavior-unverified.

### Prohibitions

| Plan | Statement | Tier | Disposition |
|------|-----------|------|-------------|
| 04-04 | MUST NOT add text to a staged command, skill, or agent that tells the model the user opted in to workflows, or counters the engine's opt-in guidance | judgment | Non-authoritative LLM verdict: holds. Flagged as `unverified-prohibition — human review recommended` (human item 2). |

## PG-SKILL-04 Unclassified Edge: Classification

The 04-03-SUMMARY list of covered edges (depth 0, 1, and 2; the variable prefix; a trailing slash; punctuation; own skill; outside; unstaged; after a path character; a continued dot segment; inner dots; several tokens; a long line) is adequate for the requirement. The verifier probed the edges it leaves out:

| Input (from skill `a`, siblings `a`, `b`, `my-c`) | Output | Class |
|---|---|---|
| `<../b/ref.md>`, `(../b)`, `'../b'`, `"../b/ref.md"`, `[x](../b/ref.md#sec)`, `../b/ref.md?raw`, `../my-c/` | sibling rewritten, suffix kept | correct |
| `../../skills/b/x.md` | `../demo-b/x.md` | correct (resolves by source path) |
| `./../b/ref.md`, `..\b\ref.md`, `../B/ref.md` | unchanged | dead path stays dead (fail-safe; case and backslash forms are not tokens) |
| `../b%20x/ref.md` (also `+`, `~`, `@`, non-ASCII after `b`) | `../demo-b%20x/ref.md` | **prefix rewrite of a path outside every sibling.** It was dead and stays dead, but it is not byte-identical. This contradicts the 04-03 D-PG4-06 truth and the summary's flagged assumption ("A path segment with other characters … stays as written") |

Classification: **edge: token boundary**. The only consequence is that one dead path becomes a different dead path. No link that resolved before breaks, and SC2 and PG-SKILL-04 hold. It goes to the maintainer as a decision (human item 1): either accept it and add a BACKLOG line, or add a sticky boundary check after the token that refuses `%`, `+`, `~`, `@`, and Unicode letters or digits. Other known edges are already tracked: own-skill `../a/` (IN-02, research record), agent preload (PRELOADSIBLING-01), and a climb to the plugin root (excluded by the requirement).

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `domain/component-paths.ts` | ✓ VERIFIED | root-source predicate and collector; refused-path messages |
| `domain/skill-sibling-paths.ts` | ✓ VERIFIED | pure, `node:path` only; 19 owner cases |
| `bridges/skills/stage.ts` | ✓ VERIFIED | `siblingSkills` on the context; `skillMarkdownRewrite` for `SKILL.md` and supporting `.md` files |
| `domain/skill-tokens.ts` | ✓ VERIFIED | slash-preserving workflow arm |
| `domain/workflow-script.ts` | ✓ VERIFIED | `agentTypes` on the named verdict |
| `orchestrators/plugin/discover-names.ts` | ✓ VERIFIED | exported `workflowAgentRestrictionNotes` |
| `orchestrators/plugin/info.ts`, `install-outcome.ts`, `update-swap.ts` | ✓ VERIFIED | notes and refused-path warnings wired |
| `features/skill/{root-source-entries,sibling-links}.feature`, `features/workflow/{references,agent-restrictions}.feature` | ✓ VERIFIED | 27 scenarios pass |
| `docs/workflows-compatibility.md`, `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`, `CHANGELOG.md` | ✓ VERIFIED | D-PG4-10, D-PG4-14, and D-PG4-15 content present |

## Key Link Verification

All 15 plan key links are verified by `verify.key-links`. The verifier also traced by hand that `prepareStageSkills` (which builds the sibling map) is the one skills-staging entry for both install (`install-outcome.ts:1267`) and the update runner (`update-swap.ts:402`), which reinstall and apply moves reuse. That trace backs the 04-03 truth that every verb gets the map.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Owner rules for all four requirements | `node --import test/platform/isolated-pi-home.ts --test <7 owner files>` | 689 pass, 0 fail | ✓ PASS |
| Phase scenarios | `npx --no cucumber-js features/skill/root-source-entries.feature features/skill/sibling-links.feature features/workflow/references.feature features/workflow/agent-restrictions.feature` | 27/27 scenarios, 357/357 steps | ✓ PASS |
| Sibling-path token boundary | node probe of `rewriteSiblingSkillPaths` (table above) | `../b%20x/ref.md` → `../demo-b%20x/ref.md` | ? routed to human |

## Probe Execution

No `scripts/*/tests/probe-*.sh` exists, and no plan declares one. Step 7c: not applicable.

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| PG-CORE-01 | 04-01, 04-02, 04-06 | ✓ SATISFIED | SC1 |
| PG-SKILL-04 | 04-03 | ✓ SATISFIED (one edge decision pending) | SC2 |
| PG-WF-01 | 04-04 | ✓ SATISFIED | SC3 |
| PG-SEC-01 | 04-05, 04-06 | ✓ SATISFIED | SC4 |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 4. Their traceability rows still read `Pending`, and the orchestrator updates them when the phase completes.

## Decision Coverage

`check.decision-coverage-verify`: 16 of 16 trackable CONTEXT.md decisions are honored by shipped artifacts. D-PG4-01, D-PG4-02, and D-PG4-12 remain accepted without maintainer review (open questions, not gaps).

## Test Quality Audit

| Test File | Linked Req | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|---------|----------|-----------------|---------|
| `test/domain/component-paths.test.ts` | PG-CORE-01 | 0 | no | value (whole result) | ok |
| `test/domain/skill-sibling-paths.test.ts` | PG-SKILL-04 | 0 | no | value (whole string) | ok |
| `test/domain/skill-tokens.test.ts` | PG-WF-01 | 0 | no | value | ok |
| `test/orchestrators/plugin/discover-names.test.ts`, `test/domain/workflow-script.test.ts` | PG-SEC-01 | 0 | no | value | ok |
| four phase features | all | 0 (no `@skip` or `@wip` tag) | no | behavioral (model calls, staged files, records) | ok |

Disabled tests on requirements: 0. Circular patterns: 0. Insufficient assertions: 0.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (phase diff, all 43 files) | none | no TBD, FIXME, XXX, TODO, HACK, or placeholder in added lines | none | none |

### Info (non-blocking)

- `04-SECURITY.md` audited at `c40ef6dc`. Later commits changed user-visible text and path handling: `b5c7dc4a`, `17bd223c`, `0e914540`, `84c69fe5`, `f273f776`, `91b0c917`, and `71df5c78`. `71df5c78` narrows `redactAbsolutePaths` so that a match cannot start right after a `.`. That fixes `../outside/x`, but an absolute path written right after a period with no space (`text./home/...`) is no longer redacted. This extension composes no such message today. A short delta check by `/gsd-secure-phase` would close the audit window.
- The 04-01 and 04-02 SUMMARY text describes the pre-review silent drop and the lexical-only lenient mirror. The code matches REVIEW-FIX, not those summaries.
- Accepted residuals, already in BACKLOG: WFCMDCOLLIDE-01, WFAGENTCONST-01, PRELOADSIBLING-01, STAGEDUPMARKER-01, WFRESTRICTGATE-01, and INFOAGENTESCAPE-01. Open maintainer questions, not counted: IN-05, IN-06, IN-07, A1, and A2.

## Human Verification Required

### 1. PG-SKILL-04 token boundary

**Test:** Review the probe `../b%20x/ref.md` from skill `a` with sibling `b` staged as `demo-b`.
**Expected:** Either accept the result `../demo-b%20x/ref.md` (dead before, dead after) and record a BACKLOG line, or fix the boundary so the path stays byte-identical, as the 04-03 D-PG4-06 truth says.
**Why human:** The token grammar is the agent's discretion. A space must stay a boundary for prose, so which characters continue a segment is a product choice.

### 2. PG-WF-01 judgment prohibition

**Test:** Confirm that the phase added no opt-in wording to staged commands, skills, or agents.
**Expected:** Holds (non-authoritative verifier verdict above).
**Why human:** A judgment-tier prohibition needs an explicit human resolution.

## Gaps Summary

There are no gaps. All four roadmap success criteria hold in code, and the phase's owner tests and cucumber scenarios pass in the verifier's own run. Status is `human_needed` for two items: one decision on the sibling-path token boundary, a dead path that becomes another dead path and the only uncertain truth, and the judgment-tier PG-WF-01 prohibition, which needs a human's sign-off. The orchestrator's `npm run check` at HEAD is still the phase gate.

---

_Verified: 2026-11-14T07:37:10Z_
_Verifier: Claude (gsd-verifier)_

## Post-Verification Changes

- `66200dd7` narrows the WR-06 redaction change after this report: only a dot that starts a relative path form (`./`, `../`) blocks an absolute-path match, so an absolute path right after a sentence period is redacted again (owner case "redacts an absolute path that follows a sentence period"). This closes the Info item on the security delta.
