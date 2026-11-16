---
phase: 04-skill-and-workflow-install-defects
verified: 2026-11-16T06:46:36Z
status: passed
score: 38/38 must-haves verified
covered_files: [".agents/skills/cucumber/rules/world-and-stand-ins.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-SUMMARY.md",".planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md","CHANGELOG.md","docs/research/parity-gaps/skills-commands.md","docs/workflows-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/index.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/skills/discover.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/domain/component-paths.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts","extensions/pi-claude-marketplace/domain/skill-tokens.ts","extensions/pi-claude-marketplace/domain/workflow-script.ts","extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts","features/lib/published-marketplace.ts","features/lib/upstream/index.ts","features/lib/upstream/workflows.ts","features/skill/root-source-entries.feature","features/skill/sibling-links.feature","features/step_definitions/marketplace/publishing.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-restrictions.feature","features/workflow/agent-types.feature","features/workflow/references.feature","test/bridges/agents/convert.test.ts","test/bridges/agents/index.test.ts","test/bridges/skills/stage.test.ts","test/domain/component-paths.test.ts","test/domain/plugin-resolver.test.ts","test/domain/skill-sibling-paths.test.ts","test/domain/skill-tokens.test.ts","test/domain/version.test.ts","test/domain/workflow-script.test.ts","test/orchestrators/plugin/discover-names.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/shared/redact-absolute-paths.test.ts"]
covered_digest: "v4:sha256:5edc51ef6c2865896b06e43f3e78d408dd8760be6eb03ef709e9e62907dfd51a"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "PG-SKILL-04 unclassified edge: a segment that starts with a sibling's folder name and continues with %, +, ~, @ or a non-ASCII letter"
    reason: "Accepted as the current behavior: the `../b` prefix is rewritten (`../b%20x/ref.md` becomes `../demo-b%20x/ref.md`). The path was dead in the staged layout before and stays dead, so no working link breaks. A boundary check is tracked as BACKLOG SIBLINGPREFIX-01 (still open, BACKLOG.md:5357; re-probed 2026-11-16, unchanged; domain/skill-sibling-paths.ts has not changed since 55a81f8e). Carries the 04-03 D-PG4-06 byte-identity truth."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T08:30:00Z"
  - must_have: "Plan 04-04 judgment-tier prohibition: no staged text claims the user opted in to workflows"
    reason: "Holds on inspection, re-checked 2026-11-16: the workflow arm of domain/skill-tokens.ts:123 still only keeps the source's slash state; no file under extensions/ holds opt-in wording about workflows (the only opt-in text is the AG-7 --map-model flag and the WLIF-03 bridge gate comments); features/workflow/references.feature:16,67 asserts the exact text the model receives."
    accepted_by: "orchestrator (autonomous run, pending maintainer review)"
    accepted_at: "2026-11-14T08:30:00Z"
  - must_have: "04-05 truth: the note appears for the upstream name `<plugin>:<agent>` and for the generated agent name, for `tools` and for `disallowedTools`, with or without pi-subagents, once for each distinct pair of script and agent type"
    reason: "Superseded in its generated-name clause by decision D-PG8-04 (PROJECT.md:2421, Phase 8, pending maintainer review), shipped in f9ebd499: the engine's registry binds an agent only by its frontmatter `name` (`<plugin>:<agent>`), so the generated flat file name binds no agent and a restriction note for it would be false. The note now keys on the declared name only (discover-names.ts:103-123,159-166); features/workflow/agent-types.feature:135 asserts that the generated file name gets no restriction note, and docs/workflows-compatibility.md:129 records it. The other clauses still hold: `tools` and `disallowedTools` (discover-names.ts:90-98), independent of pi-subagents (pure join over discovery), and one note per distinct pair (workflow-script.ts:886-896 dedupes the literals)."
    accepted_by: "project decision D-PG8-04 (PROJECT.md decision log, pending maintainer review)"
    accepted_at: "2026-11-15T05:55:38Z"
  - must_have: "04-05 and 04-06 artifact and key-link patterns `workflowAgentRestrictionNotes` / `export function workflowAgentRestrictionNotes` (discover-names.ts, install-outcome.ts, update-swap.ts, info.ts)"
    reason: "Renamed by decision D-PG8-05 (PROJECT.md:2421, pending maintainer review), shipped in b8ac6d91: both kinds of workflow agent note travel through one exported join, `workflowAgentNotes` (discover-names.ts:272), and the member `DiscoveredGeneratedNames.workflowAgentNotes` (:53, filled at :332-336). The wiring the patterns stood for is intact under the new name: install-outcome.ts:1257, update-swap.ts:1735, info.ts:133,1159,1317. `verify.artifacts`/`verify.key-links` report these five patterns missing only because the literal name changed."
    accepted_by: "project decision D-PG8-05 (PROJECT.md decision log, pending maintainer review)"
    accepted_at: "2026-11-15T04:08:22Z"
re_verification:
  previous_status: passed
  previous_score: 37/38
  reason: "staleness: Phases 5-11, the gaps-agents/gaps-mcp merges and later fixes changed 20 of the 42 covered non-planning files after the previous report (dfbe5b21, 2026-11-14T07:53:16Z)"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  score_correction: "The previous report applied the SIBLINGPREFIX-01 override but still counted its truth as uncertain (37/38). Step 3b counts a PASSED (override) truth as verified, so the same evidence gives 38/38. The edge itself is still open in behavior; see the override."
decision_coverage:
  honored: 16
  total: 16
  not_honored: []
human_verification: []
---

# Phase 4: Skill and Workflow Install Defects Verification Report

**Phase Goal:** The official skill and workflow plugins install what Claude Code loads, and the text they install names things that exist. A root-source marketplace entry installs only its listed skills, a link to a sibling skill resolves, a command can start its plugin's workflow by name, and an install says when a workflow does not keep an agent's tool restriction.

**Verified:** 2026-11-16T06:46:36Z
**Status:** passed, with four overrides. Two are the earlier orchestrator overrides, still pending maintainer review. Two are new and record later project decisions (D-PG8-04, D-PG8-05), also pending maintainer review.
**Re-verification:** Yes. The previous report (passed, 37/38, two overrides, 2026-11-14T07:37:10Z) became stale, because later work changed 20 of its 42 covered non-planning files.

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `171d884f`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations are current line numbers. **O/** means `extensions/pi-claude-marketplace/orchestrators/plugin/`, and **D/** means `extensions/pi-claude-marketplace/domain/`.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `1183aae3` (log `/tmp/pg11-maskfix.log`). The verifier read the log. All seven static checks passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features). Then the unpaired and integration tests passed, with real pi-subagents 0.88.1, pi-mcp-adapter 7.0.1 and pi-dynamic-workflows 3.15.0 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2098/2098 scenarios and 25964/25964 steps (seed 700460). The builtin profile ran 204/204 scenarios and 2762/2762 steps (seed 547387). Direct coverage merged 374 LCOV records. The log ends with `exit=0`. `git diff --name-only 1183aae3 HEAD` outside `.planning/` is empty, so G covers every executable input of HEAD, including the five phase features (`root-source-entries`, `sibling-links`, `references`, `agent-restrictions`, `agent-types`). The project's reuse rule applies, and the suite was not repeated.

**Independent checks (this pass):** 15 named single tests, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each reported `tests 1, pass 1, fail 0`. There was also one pure probe of `rewriteSiblingSkillPaths` for the token-boundary edge. `query verify.artifacts` and `query verify.key-links` ran for all six plans.

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 4 must-haves |
| --- | --- | --- |
| D-PG4-11/12 wording (Phase 4 review WR-05 and 91b0c917, pending maintainer review) | The note names only the built-ins that the agent's restriction does not keep. It also hedges on the engine setting: `...which restricts its tools; unless the workflow engine's providerMiddlewareExtensions setting lists builtin:codemode, the engine does not keep that restriction, so the agent may use bash, edit, and write` (O/discover-names.ts:159-166). PROJECT.md:2395 records this exact wording. | SC4 holds: the note still says that the workflow does not keep the restriction. The literal note text in the folded 04-05 truth 1 ("can use read, bash, edit, and write") is the pre-review wording. The recorded decision replaces it, as the previous report noted. An agent whose `tools` keeps all four built-ins gets no note (agent-restrictions.feature:117). WFNOTETRIGGER-01 (BACKLOG.md:5361) is still open as a maintainer question. |
| D-PG8-04 (Phase 8, pending maintainer review) | The restriction note keys on the declared `<plugin>:<agent>` name only. The generated file name binds no agent in the engine, so it gets no note (f9ebd499). A second note kind was added for an agent type of the plugin's namespace that the plugin does not install. | The 04-05 truth 3 generated-name clause is reversed. It is carried by an override (see frontmatter). Its other clauses hold. The new missing-agent note gives no false note for any 04-05 "no note" arm: a bare name, another plugin's name, a generated flat name, and a non-literal each get none (discover-names.ts:216-230, 257-264). |
| D-PG8-05 (Phase 8, pending maintainer review) | `workflowAgentRestrictionNotes` was renamed to `workflowAgentNotes`, the one member and join that carry both note kinds. It is capped at five missing-agent notes per script, followed by a count line (b8ac6d91). | The five artifact and key-link patterns of 04-05 and 04-06 fail on the literal name only. The wiring is intact under the new name, so an override carries it (see frontmatter). |
| `substituteClaudeVars` -> `substituteClaudeContent` (3abe4484, plugin option defaults in skill content) | Rename and an extra options argument. | The 04-03 ordering truth still holds: the sibling rewrite runs inside `skillMarkdownRewrite` (bridges/skills/stage.ts:250-266) before `substituteClaudeContent` (:388-389). |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| SC1 | With `source: "./"` and `skills: ["./skills/a"]`, and `skills/a` and `skills/b` on disk, `info` lists `a` only and only `a` is installed. After an update that drops a listed skill, no file or record of that skill stays behind (PG-CORE-01). | ✓ VERIFIED | `isMarketplaceRootSource` (D/component-paths.ts:555-560) and `rootSourceListedSkills` (:567-572) route a root-source entry that lists skills to `collectRootSourceSkillPaths` (:688-725, called at :742). That function replaces `skills/` and the manifest paths with the surviving listed folders (`addListedSkillPaths`, :637-650). `info` uses the same predicate in its lenient mirror (O/info.ts:2288-2316) and lists a self-skill folder as one skill (`componentNamesFromEntries`, :362-372). Scenarios in G: install stages only the listed skill (root-source-entries.feature:28); `info` lists only it (:196); update drops the folder and record (:75); a reinstall under the same version drops it (:102); a new session offers only the kept skill (:129); the dropped Claude Code name reaches the model as typed (:146); a second reinstall changes nothing (:168). The hash covers `.claude-plugin/marketplace.json` (S9). |
| SC2 | Skill `a` says `See ../b/ref.md`. After the install, the text the model receives names a path that exists and holds `b`'s file (PG-SKILL-04). | ✓ VERIFIED | sibling-links.feature:7 (in G): the model receives `See ../demo-b/ref.md.` (:35), calls `read` on `.../skills/demo-a/../demo-b/ref.md` (:37), and gets `The reference of skill b.` (:38). The rewrite is `rewriteSiblingSkillPaths` (D/skill-sibling-paths.ts:78-112), applied by `skillMarkdownRewrite` (bridges/skills/stage.ts:250-266) to `SKILL.md` (:387-388) and supporting Markdown (:399). The sibling map is built from discovery in `prepareStageSkills` (:510-512). Both install (O/install-outcome.ts:1270) and the update runner (O/update-swap.ts:410) call it. S1, S3 and S4 pass here. |
| SC3 | A command body `Workflow({ name: "demo:scan" })`: the scripted model calls `workflow` with the name copied from the prompt, the run completes, and a slash reference keeps its slash (PG-WF-01). | ✓ VERIFIED | D/skill-tokens.ts:123 `return token.startsWith("/") ? `/${workflowName}` : workflowName;`. references.feature (in G): the prompt holds `Call Workflow({ name: "demo:scan" }) now. Slash form: /demo:scan.` (:20,:31); the model-started run (:67) calls `workflow` with that name and completes; the staged skill keeps `allowed-tools: Workflow(demo:scan)` (:40,:63). The commands bridge inherits the rule through `rewriteMarkdownReferences` (bridges/commands/staged-command.ts:42,277). S5 and S6 pass here. |
| SC4 | An agent `reader` (`tools: Read`) and a workflow with `agentType: "demo:reader"` install with the restriction note, and `info` shows it. The compatibility page says the same, and the engine request is drafted under `.planning/upstream/` (PG-SEC-01). | ✓ VERIFIED | `readAgentTypes` (D/workflow-script.ts:886-896) puts the literal agent types on the named verdict (:236-238, :334). `workflowAgentNotes` (O/discover-names.ts:272-290) builds the note. It is spread into the install discovery warnings (O/install-outcome.ts:1257), the update staging warnings (O/update-swap.ts:1735), and the `info` notes (O/info.ts:1159-1164, 1181). agent-restrictions.feature:18 (install), :48 (update) and :79 (info) assert the exact note, and :117 asserts the no-note arm (in G). `docs/workflows-compatibility.md:130` has the D-PG4-14 row and cites the feature. `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md:3` says "Patch: no patch exists; this report is not filed." The note wording follows D-PG4-11/12 (see Superseded). S12-S15 pass here. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Current evidence |
|------|--------|--------|----------|
| 04-01 | 9 (non-root and object sources keep D-CF1-06; no-survivor arms; shared `skills/` folder; listed root or `skills/` collects once; absent, null or empty `skills`; listed order; repeat reinstall idempotent; resolver writes nothing and only the update or reinstall transaction removes; hash covers `marketplace.json`) | ✓ 9/9 VERIFIED | Non-root and object sources: `isMarketplaceRootSource` is false for a non-string or a non-root string, so `collectStrictComponentKind` takes the D-CF1-06 path (component-paths.ts:741-760). No survivors: when a traversal was refused, nothing is collected; otherwise `addDeclaredSkillPaths` applies (:719-722; absolute paths count as traversal, :170-180). Listed root: `skills/` follows once (:646-649); spellings collapse after containment (:185-186, `addComponentPath` :189-200). Empty `skills`: `readPathOrArray` (:120-130) yields none, so D-CF1-06 applies. Shared folder: root-source-entries.feature:53. Idempotent reinstall: :168. Hash: S9. Refused listed paths are reported in Claude Code 2.1.323's wording, and the plugin stays installable (S7, S8; feature :222, :252). |
| 04-02 | 4 (a self-skill path lists as one skill; lenient mirror; lenient branch never reads a refused path; non-root unchanged) | ✓ 4/4 VERIFIED | `componentNamesFromEntries` (info.ts:362-372; S11). Lenient mirror: `rootSourceLenientSkillPaths` (:2288-2316) and `deriveLenientComponentPaths` (:2251-2276). Refused paths are never read: `containedRelativePath` is lexical and cwd-free (:2326-2338), and only kept paths reach `readEntriesOrMissing` (:2302-2307; S10). Non-root entries return `undefined`, which keeps the old listing (:2296-2298). Feature :272, :295, :317 and :343 in G. |
| 04-03 | 5 (supporting Markdown depth and trailing slash; all four positions plus `${CLAUDE_SKILL_DIR}`; D-PG4-06 byte identity; root-source unlisted sibling; every verb gets the map) | ✓ 4/4 VERIFIED, 1 PASSED (override) | Depth and trailing slash: `depthInSkill` and the climb (skill-sibling-paths.ts:35-41, 105-107); sibling-links.feature:40 (`../../demo-b/ref.md`, `../../demo-b/`, :80); S4. Positions and the variable: line-wise rewrite of every token (:84-111), run before substitution (stage.ts:381-389); S3. D-PG4-06: outside, own and unstaged paths stay unchanged (`matchSibling` :48-63; S2). The out-of-grammar prefix edge is still present: the probe still gives `../b%20x/ref.md` -> `../demo-b%20x/ref.md`, so this truth is carried by the SIBLINGPREFIX-01 override. Root-source unlisted sibling: sibling-links.feature:88. Every verb: the map is built inside `prepareStageSkills` (stage.ts:510-512), the one skills-staging entry for install (install-outcome.ts:1270) and for the update runner (update-swap.ts:410), which reinstall and apply moves reach through `materialize-latest.ts:145,230`. |
| 04-04 | 5 (elision and precedence; staged skill keeps bare name; byte identity on a miss; recognition only on a generated name and an ASCII slash; doc D-PG4-10) | ✓ 5/5 VERIFIED | `resolveWorkflowReference` (skill-tokens.ts:70-84) and the workflow arm (:116-123). Owner cases `converges an elidable reference onto a generated workflow name`, `prefers the skill a token resolves to over a workflow of the same source name`, `leaves a workflow reference verbatim when the plugin stages no such workflow`, `reads only an ASCII slash before a workflow reference as its slash` and `skips a workflow candidate the workflow name generator rejects` (skill-tokens.test.ts:271,366,381,335,426) pass in G. The staged skill keeps `Workflow(demo:scan)` (references.feature:33). docs/workflows-compatibility.md:178 carries the retargeting statement and the remaining engine and script-bytes residuals. |
| 04-05 | 7 (update prints once; upstream and generated names, `tools` and `disallowedTools`, with or without pi-subagents; no-note arms; empty arms; exact equality and escaping; never persisted; unreadable script costs its note) | ✓ 6/7 VERIFIED, 1 PASSED (override) | Update once: the one join site in the update runner (update-swap.ts:1727-1736), reached by reinstall and apply through `swapPluginUpdate` (materialize-latest.ts:145,230); S14. Generated name: reversed by D-PG8-04, carried by an override. The `tools`/`disallowedTools` clause holds (discover-names.ts:90-98). No-note arms: a non-literal is never collected (workflow-script.ts:903-); another plugin's agent is not in `restricted` and fails the own-prefix test (discover-names.ts:216-226); an unrestricted agent has no unkept built-ins (:116-122); a non-admitted script has no `named` verdict (:286-289). Empty arms: no scripts or agents gives an empty `flatMap`, and absent or blank tools allow everything (:93). Exact equality is `Map.get` on the literal, and escaping is `forMessage` on the file name, folder and agent type (:141-157; S13). Never persisted: the note is recomputed in `discoverGeneratedNames` (:320-337) and travels only in warnings. Unreadable script: no `named` verdict, so no note, and the AST is parsed once (`readAgentTypes(parsed.ast)`, workflow-script.ts:236). S12 and S15 pass here. |
| 04-06 | 4 (`info` reads agent files only inside the plugin root; no-literal plugins unchanged; root-source exception on the compat page; CHANGELOG reinstall line) | ✓ 4/4 VERIFIED | `previewWorkflowAgentNotes` (info.ts:1297-1324) returns early when no script names an agent type (:1303-1308). It reads agents only through `resolveContainedComponentPath` (:1311-1314), and a throw becomes a debug line with no notes (:1320-1323). docs/workflows-compatibility.md:42 states the root-source exception beside D-CF1-06. CHANGELOG.md:13 tells `anthropics/skills` users to run `/claude:plugin reinstall` once, and :14-18 name the other user-visible changes of the phase. |

**Score:** 38/38 truths verified: 4 success criteria and 34 plan truths. 36 are VERIFIED directly and 2 are PASSED (override): the SIBLINGPREFIX-01 edge under D-PG4-06, and the D-PG8-04 generated-name clause. None is behavior-unverified. Every behavior-dependent truth has a passing named test from this pass or a scenario in G.

**About the old 37/38:** the one truth the previous report left uncertain is the 04-03 D-PG4-06 byte-identity truth, at the out-of-grammar prefix edge. It is **still open in behavior**: the probe reproduces it, `skill-sibling-paths.ts` has not changed since `55a81f8e`, and BACKLOG SIBLINGPREFIX-01 is still open. It is **carried by the existing override**, which the previous report applied but did not count. It now counts, as Step 3b requires. No link that resolved before breaks.

### Prohibitions

| Plan | Statement | Tier | Disposition |
|------|-----------|------|-------------|
| 04-04 | MUST NOT add text to a staged command, skill, or agent that tells the model the user opted in to workflows, or counters the engine's opt-in guidance | judgment | Non-authoritative LLM verdict: holds (re-checked on the current tree). Carried by the existing orchestrator override. **Flagged: unverified-prohibition, human review recommended** (see Maintainer Review). |

## Required Artifacts

`query verify.artifacts`: plans 04-01 to 04-04 pass 15/15. Plan 04-05 gives 2/5 and plan 04-06 gives 3/5. All five misses are the literal `workflowAgentRestrictionNotes` patterns that D-PG8-05 renamed, and the D-PG8-05 override carries them. Every artifact exists and is substantive:

| Artifact | Status | Details |
|----------|--------|---------|
| `D/component-paths.ts` | ✓ VERIFIED | `isMarketplaceRootSource` :555; collector :688-725; refused-path messages :94-118 |
| `D/skill-sibling-paths.ts` | ✓ VERIFIED | pure, imports `node:path` only; 19 owner cases |
| `bridges/skills/stage.ts` | ✓ VERIFIED | `siblingSkills` on the context (:282, :510-512); `skillMarkdownRewrite` :250-266 |
| `D/skill-tokens.ts` | ✓ VERIFIED | slash-preserving workflow arm :123 (`D-PG4-08` at :11) |
| `D/workflow-script.ts` | ✓ VERIFIED | `agentTypes` on the named verdict :101, :334 |
| `O/discover-names.ts` | ✓ VERIFIED (override, renamed) | `export function workflowAgentNotes` :272 |
| `O/install-outcome.ts`, `O/update-swap.ts`, `O/info.ts` | ✓ VERIFIED (override, renamed) | :1257, :1735, :1159/:1317 |
| `features/skill/{root-source-entries,sibling-links}.feature`, `features/workflow/{references,agent-restrictions}.feature` | ✓ VERIFIED | 30 scenarios, all in G; no `@skip`/`@wip` tag |
| `features/lib/published-marketplace.ts`, `features/lib/upstream/workflows.ts`, `features/step_definitions/plugin/installation.steps.ts`, `test/domain/version.test.ts` | ✓ VERIFIED | `verify.artifacts` pass |
| `docs/workflows-compatibility.md`, `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`, `CHANGELOG.md` | ✓ VERIFIED | D-PG4-10 (:178), D-PG4-14 (:130), D-PG4-01 (:42); `Patch:` (:3); `anthropics/skills` (:13) |

## Key Link Verification

`query verify.key-links`: plans 04-01 to 04-04 give 10/10. Plan 04-05 gives 1/3 and plan 04-06 gives 1/2; the three misses are the renamed pattern. Current connections:

| Plan | From -> To | Current connection | Status |
| --- | --- | --- | --- |
| 01 | component-paths -> skills/discover | `componentPaths.skills` holds only the survivors; `isMarketplaceRootSource` :555,:568 | WIRED |
| 01 | publishing.steps -> published-marketplace | `writePublishedMarketplaceFiles` | WIRED |
| 01 | root-source-entries.feature -> installation.steps | "installation record" Then | WIRED |
| 02 | info -> component-paths | `isMarketplaceRootSource` import :39, use :2296 | WIRED |
| 02 | root-source-entries.feature -> info | `plugin components skills` (:196) | WIRED |
| 03 | stage -> skill-sibling-paths | `rewriteSiblingSkillPaths` :25,:257 | WIRED |
| 03 | stage -> skills/discover | `siblingSkills` from discovery :510-512 | WIRED |
| 04 | commands/staged-command -> skill-tokens | `rewriteMarkdownReferences` :42,:277 | WIRED |
| 04 | upstream/index -> upstream/workflows | `RESULT_PROJECTORS` `["workflow", projectWorkflowResult]` :17 | WIRED |
| 04 | references.feature -> runs.steps | model-started run :67 | WIRED |
| 05 | discover-names -> workflow-script | `verdict.agentTypes` :288 | WIRED |
| 05 | install-outcome -> discover-names | `generatedNames.workflowAgentNotes` :1257 | WIRED (override: renamed) |
| 05 | update-swap -> discover-names | `generatedNames.workflowAgentNotes` :1735 | WIRED (override: renamed) |
| 06 | info -> discover-names | `workflowAgentNotes(pluginName, discovered, workflows)` :1317 | WIRED (override: renamed) |
| 06 | workflows-compatibility -> agent-restrictions.feature | cited at :130 | WIRED |

## Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| Staged skill set | entry `skills` -> `collectRootSourceSkillPaths` -> `componentPaths.skills` -> `discoverPluginSkills` -> staged folders and record | Yes. The scenarios assert the staged folders and record names. | FLOWING |
| Sibling path text | discovery -> `siblingSkills` map -> `rewriteSiblingSkillPaths` -> staged `SKILL.md` -> model prompt | Yes. The model reads `b`'s file. | FLOWING |
| Workflow reference | source token -> `resolveWorkflowReference` -> slash state kept -> command prompt -> `workflow` tool call | Yes. The run completes. | FLOWING |
| Restriction note | script AST literals -> `agentTypes` -> `workflowAgentNotes` join with discovered agents -> install/update warnings and `info` notes | Yes. The exact rows are asserted. | FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0`.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| S1 | rewrites a link from SKILL.md to a file of a sibling skill | test/domain/skill-sibling-paths.test.ts | PASS |
| S2 | leaves a path outside every skill as written | test/domain/skill-sibling-paths.test.ts | PASS |
| S3 | PG-SKILL-04: rewrites a skill directory variable path before substitution, so it ends in the sibling's target folder | test/bridges/skills/stage.test.ts | PASS |
| S4 | PG-SKILL-04: rewrites a sibling path in supporting Markdown from the folder of the file | test/bridges/skills/stage.test.ts | PASS |
| S5 | keeps the slash of a workflow reference its source wrote with one | test/domain/skill-tokens.test.ts | PASS |
| S6 | keeps the installed workflow name without a slash inside a tool call | test/domain/skill-tokens.test.ts | PASS |
| S7 | D-PG4-01 a root-source entry carries its refused listed skills paths and stays installable | test/domain/plugin-resolver.test.ts | PASS |
| S8 | D-PG4-01 the stat reader receives no refused listed path | test/domain/component-paths.test.ts | PASS |
| S9 | D-PG4-02 hashes a change to only the marketplace manifest under the root | test/domain/version.test.ts | PASS |
| S10 | D-PG4-01: the lenient listing of a root-source entry lists no skill when every listed path is absolute or escapes | test/orchestrators/plugin/info.test.ts | PASS |
| S11 | D-PG4-01: info lists a listed skill folder that holds SKILL.md as one skill, not its subfolders | test/orchestrators/plugin/info.test.ts | PASS |
| S12 | PG-SEC-01: notes a workflow script that runs a tool-restricted agent of the plugin | test/orchestrators/plugin/discover-names.test.ts | PASS |
| S13 | PG-SEC-01: escapes format characters in the file name and the agent type of a note | test/orchestrators/plugin/discover-names.test.ts | PASS |
| S14 | PG-SEC-01: a swap to a version whose workflow runs a tool-restricted agent adds one note between the folder and bridge warnings | test/orchestrators/plugin/update-swap.test.ts | PASS |
| S15 | PG-SEC-01: finds nested agent types once each, in first-seen order | test/domain/workflow-script.test.ts | PASS |
| P | `rewriteSiblingSkillPaths` probe: `See ../b/ref.md.`, `../b%20x/ref.md`, `../bx/ref.md`, `see ../b for details` from skill `a` | pure, scratch only | `../demo-b/ref.md.`; `../demo-b%20x/ref.md` (edge, override); `../bx/ref.md` unchanged; `../demo-b for details` |
| G | `npm run check` at `1183aae3` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

## Probe Execution

No plan declares a `probe-*.sh`, and no `scripts/*/tests/probe-*.sh` is in scope. Not applicable.

## Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| PG-CORE-01 | 04-01, 04-02, 04-06 | ✓ SATISFIED | SC1. REQUIREMENTS.md:65 `[x]`, trace :203 Complete |
| PG-SKILL-04 | 04-03 | ✓ SATISFIED (one edge carried by an override) | SC2. REQUIREMENTS.md:73 `[x]`, trace :208 Complete |
| PG-WF-01 | 04-04 | ✓ SATISFIED | SC3. REQUIREMENTS.md:48 `[x]`, trace :193 Complete |
| PG-SEC-01 | 04-05, 04-06 | ✓ SATISFIED | SC4. REQUIREMENTS.md:80 `[x]`, trace :212 Complete |

No orphaned requirement: REQUIREMENTS.md maps exactly these four IDs to Phase 4, and each appears in plan frontmatter.

## Decision Coverage

`query check.decision-coverage-verify` returned `skipped: CONTEXT.md missing`, although `04-CONTEXT.md` exists, so the tool gave no verdict. Traced by hand: the D-PG4-01..15 decisions are honored by the shipped code cited above (16/16 trackable, as before). D-PG4-01 is in component-paths and info. D-PG4-02 is in the update and reinstall unstage path and the hash. D-PG4-03 is the shared-folder scenario. D-PG4-04..07 are in skill-sibling-paths and stage. D-PG4-08..10 are in skill-tokens and the docs. D-PG4-11..13 are in discover-names and the three join sites, with the wording amended as recorded. D-PG4-14 and D-PG4-15 are in the docs row and the upstream draft. D-PG4-01, D-PG4-02 and D-PG4-12 remain pending maintainer review (PROJECT.md:2391,2392,2395).

## Test Quality Audit

| Test File | Linked Req | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|---------|----------|-----------------|---------|
| `test/domain/component-paths.test.ts`, `test/domain/plugin-resolver.test.ts` | PG-CORE-01 | 0 | no | value (whole result) | ok |
| `test/domain/skill-sibling-paths.test.ts`, `test/bridges/skills/stage.test.ts` | PG-SKILL-04 | 0 | no | value (whole string, staged bytes) | ok |
| `test/domain/skill-tokens.test.ts` | PG-WF-01 | 0 | no | value | ok |
| `test/orchestrators/plugin/discover-names.test.ts`, `test/domain/workflow-script.test.ts`, `test/orchestrators/plugin/update-swap.test.ts` | PG-SEC-01 | 0 | no | value | ok |
| five phase features | all | 0 (no `@skip` or `@wip` tag) | no | behavioral (model calls, staged files, records) | ok |

## Anti-Patterns Found

| Scope | Pattern | Severity | Result |
|------|---------|----------|--------|
| All 14 phase source and feature files (component-paths, skill-sibling-paths, skill-tokens, workflow-script, discover-names, skills/stage, info, install-outcome, update-swap, redact-absolute-paths, four phase features) | TBD / FIXME / XXX / TODO / HACK | None | No match |
| Same scope | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- The previous Info item on the security delta (`redactAbsolutePaths` after a sentence period) is closed: the owner case "redacts an absolute path that follows a sentence period" is at test/shared/redact-absolute-paths.test.ts:551 and passes in G.
- The 04-01 and 04-02 SUMMARY text still describes the pre-review silent drop and the lexical-only lenient mirror, and the 04-05 and 04-06 SUMMARY text names the old `workflowAgentRestrictionNotes`. The code matches REVIEW-FIX and D-PG8-04/05, not those summaries.
- Accepted residuals still in BACKLOG: WFCMDCOLLIDE-01, WFAGENTCONST-01, PRELOADSIBLING-01 (:5340), STAGEDUPMARKER-01, WFRESTRICTGATE-01 (:5349), INFOAGENTESCAPE-01, SIBLINGPREFIX-01 (:5357) and WFNOTETRIGGER-01 (:5361).

## Maintainer Review

There are no human-verification items. Four overrides wait for the maintainer, and they leave nothing unverified:

1. **SIBLINGPREFIX-01 (PG-SKILL-04 token boundary):** accept `../b%20x/ref.md` -> `../demo-b%20x/ref.md` (a dead path before and after), or add a boundary check after the token so the path stays byte-identical.
2. **PG-WF-01 judgment prohibition (flagged):** confirm that no staged command, skill or agent gains opt-in wording about workflows. The verifier's non-authoritative verdict is that this holds.
3. **D-PG8-04:** the generated agent file name gets no restriction note, which reverses a clause of the 04-05 truth.
4. **D-PG8-05:** the join is renamed to `workflowAgentNotes` and carries both note kinds.

Two other decisions are still pending review but are outside the overrides: D-PG4-01/02 and the D-PG4-12 note wording.

## Gaps Summary

There are no gaps and no regressions. On the current tree, all four roadmap criteria and all 34 plan truths of Phase 4 still hold. All citations now point at current lines. Later work changed four mechanisms that the phase relies on, and none of them breaks a criterion:

- The D-PG4-11/12 review wording is now the recorded note text.
- D-PG8-04 stopped noting a generated agent file name, because the engine never binds that name. One 04-05 clause is reversed, and an override carries it.
- D-PG8-05 renamed the join to `workflowAgentNotes`. The five tool-pattern misses are only that rename, and an override carries them.
- The variable substitution was renamed, and the order of the rewrite and the substitution is unchanged.

The earlier uncertain truth, the SIBLINGPREFIX-01 edge, is still open in behavior. Its existing override carries it, and the score now counts it, so the score is 38/38.

---

_Verified: 2026-11-16T06:46:36Z_
_Verifier: Claude (gsd-verifier)_
