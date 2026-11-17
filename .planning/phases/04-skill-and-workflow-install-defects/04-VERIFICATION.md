---
phase: 04-skill-and-workflow-install-defects
verified: 2026-11-17T03:34:18Z
status: passed
score: 38/38 must-haves verified
covered_files: [".agents/skills/cucumber/rules/world-and-stand-ins.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-01-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-02-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-03-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-04-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-05-SUMMARY.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-PLAN.md",".planning/phases/04-skill-and-workflow-install-defects/04-06-SUMMARY.md",".planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md","CHANGELOG.md","docs/research/parity-gaps/skills-commands.md","docs/workflows-compatibility.md","extensions/pi-claude-marketplace/bridges/agents/convert.ts","extensions/pi-claude-marketplace/bridges/agents/index.ts","extensions/pi-claude-marketplace/bridges/commands/staged-command.ts","extensions/pi-claude-marketplace/bridges/skills/discover.ts","extensions/pi-claude-marketplace/bridges/skills/stage.ts","extensions/pi-claude-marketplace/domain/component-paths.ts","extensions/pi-claude-marketplace/domain/plugin-resolver.ts","extensions/pi-claude-marketplace/domain/resolver-types.ts","extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts","extensions/pi-claude-marketplace/domain/skill-tokens.ts","extensions/pi-claude-marketplace/domain/workflow-script.ts","extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts","extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts","features/lib/published-marketplace.ts","features/lib/upstream/index.ts","features/lib/upstream/workflows.ts","features/skill/root-source-entries.feature","features/skill/sibling-links.feature","features/step_definitions/marketplace/publishing.steps.ts","features/step_definitions/plugin/installation.steps.ts","features/step_definitions/workflow/runs.steps.ts","features/workflow/agent-restrictions.feature","features/workflow/agent-types.feature","features/workflow/references.feature","test/bridges/agents/convert.test.ts","test/bridges/agents/index.test.ts","test/bridges/skills/stage.test.ts","test/domain/component-paths.test.ts","test/domain/plugin-resolver.test.ts","test/domain/skill-sibling-paths.test.ts","test/domain/skill-tokens.test.ts","test/domain/version.test.ts","test/domain/workflow-script.test.ts","test/orchestrators/plugin/discover-names.test.ts","test/orchestrators/plugin/info.test.ts","test/orchestrators/plugin/install-outcome.test.ts","test/orchestrators/plugin/update-swap.test.ts","test/shared/redact-absolute-paths.test.ts"]
covered_digest: "v4:sha256:5a47b5581461050135adeb3898d43418081f5de523abda9e292df2c21e3f22c5"
behavior_unverified: 0
overrides_applied: 4
overrides:
  - must_have: "PG-SKILL-04 unclassified edge: a segment that starts with a sibling's folder name and continues with %, +, ~, @ or a non-ASCII letter"
    reason: "Accepted as the current behavior: the `../b` prefix is rewritten (`../b%20x/ref.md` becomes `../demo-b%20x/ref.md`). The path was dead in the staged layout before and stays dead, so no working link breaks. A boundary check is tracked as BACKLOG SIBLINGPREFIX-01 (still open, BACKLOG.md:5363; re-probed 2026-11-16, unchanged; domain/skill-sibling-paths.ts has not changed since 55a81f8e, re-checked 2026-11-17). Carries the 04-03 D-PG4-06 byte-identity truth."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T08:30:00Z"
  - must_have: "Plan 04-04 judgment-tier prohibition: no staged text claims the user opted in to workflows"
    reason: "Holds on inspection, re-checked 2026-11-17: the workflow arm of domain/skill-tokens.ts:131 still only keeps the source's slash state (the D-PG8-18 full-name lookup at :78-82 changes which installed name is chosen, not the text around it); no file under extensions/ holds opt-in wording about workflows (every opt-in mention there is a source comment about AG-7 --map-model, --partial, the WLIF-03 bridge gate, or another non-workflow consent, and none is staged text); features/workflow/references.feature:16,67 asserts the exact text the model receives."
    accepted_by: "maintainer review 2026-11-16 (proposed by the orchestrator in the autonomous run)"
    accepted_at: "2026-11-14T08:30:00Z"
  - must_have: "04-05 truth: the note appears for the upstream name `<plugin>:<agent>` and for the generated agent name, for `tools` and for `disallowedTools`, with or without pi-subagents, once for each distinct pair of script and agent type"
    reason: "Superseded in its generated-name clause by decision D-PG8-04 (PROJECT.md:2421, Phase 8, confirmed by the maintainer review 2026-11-16), shipped in f9ebd499: the engine's registry binds an agent only by its frontmatter `name` (`<plugin>:<agent>`), so the generated flat file name binds no agent and a restriction note for it would be false. The note now keys on the declared name only (discover-names.ts:103-123,159-166); features/workflow/agent-types.feature:135 asserts that the generated file name gets no restriction note, and docs/workflows-compatibility.md:129 records it. The other clauses still hold: `tools` and `disallowedTools` (discover-names.ts:90-98), independent of pi-subagents (pure join over discovery), and one note per distinct pair (workflow-script.ts:944-954 dedupes the literals)."
    accepted_by: "project decision D-PG8-04 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-15T05:55:38Z"
  - must_have: "04-05 and 04-06 artifact and key-link patterns `workflowAgentRestrictionNotes` / `export function workflowAgentRestrictionNotes` (discover-names.ts, install-outcome.ts, update-swap.ts, info.ts)"
    reason: "Renamed by decision D-PG8-05 (PROJECT.md:2421, confirmed by the maintainer review 2026-11-16), shipped in b8ac6d91: both kinds of workflow agent note travel through one exported join, `workflowAgentNotes` (discover-names.ts:272), and the member `DiscoveredGeneratedNames.workflowAgentNotes` (:54, filled at :344-348). The wiring the patterns stood for is intact under the new name: install-outcome.ts:1257, update-swap.ts:1735, info.ts:134,1160,1318. `verify.artifacts`/`verify.key-links` report these five patterns missing only because the literal name changed."
    accepted_by: "project decision D-PG8-05 (PROJECT.md decision log); maintainer review 2026-11-16"
    accepted_at: "2026-11-15T04:08:22Z"
re_verification:
  previous_status: passed
  previous_score: 38/38
  reason: "staleness: covered_digest moved after the previous report (cb5ee48c, 2026-11-16T06:49:40Z). Commit 421863f6 (docs: align decision wording with the maintainer review) touched none of the covered files; it and ebcce31e changed only docs, ROADMAP and phase 10/11 records. The digest moved through nine commits between cb5ee48c and 421863f6 that changed 9 covered files: 9e3dc68b, 4d6825ba, b35b86d1 (D-PG8-07 keep the last of two scripts with one name), 78011db4, 6d9a3cdd (D-PG10-25 unreadable options fail closed, info.ts), 6826f6f6, 3488bf29 (D-PG8-18 keep both names the elision would merge, skill-tokens.ts and workflow-script.ts), 8c64be00, 594ea843 (CHANGELOG)."
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  changed_since_previous: "skill-tokens.ts (full-name lookup first, D-PG8-18), workflow-script.ts (WNAM-05 throw replaced by unelideClashingWorkflowNames and keepLastWorkflowPerName, D-PG8-18/D-PG8-07), info.ts (applyRecordRowShape adds `unreadable`, D-PG10-25), installation.steps.ts (one new Given), docs/workflows-compatibility.md (two rows and one paragraph), CHANGELOG.md, and three test files. No Phase 4 truth changed status; line citations are updated."
decision_coverage:
  honored: 16
  total: 16
  not_honored: []
human_verification: []
---

# Phase 4: Skill and Workflow Install Defects Verification Report

**Phase Goal:** The official skill and workflow plugins install what Claude Code loads, and the text they install names things that exist. A root-source marketplace entry installs only its listed skills, a link to a sibling skill resolves, a command can start its plugin's workflow by name, and an install says when a workflow does not keep an agent's tool restriction.

**Verified:** 2026-11-17T03:34:18Z
**Status:** passed, with four overrides. Two are the earlier orchestrator overrides. Two record later project decisions (D-PG8-04, D-PG8-05). The maintainer review of 2026-11-16 accepted all four.
**Re-verification:** Yes. The previous report (passed, 38/38, four overrides, 2026-11-16T06:46:36Z, committed in cb5ee48c) became stale. Commit 421863f6 did not move its digest: it touched none of the covered files. Nine earlier commits did, between cb5ee48c and 421863f6 (see Changes Since the Previous Report).

## Verification Basis

This pass re-checked every roadmap criterion and every plan must-have against the current tree, `features/gaps` at `ebcce31e`. It did not reuse the earlier verdicts. Summaries were not taken as evidence. For each truth, the implementing code, its caller, and the test or scenario that exercises it were read again. Citations are current line numbers. **O/** means `extensions/pi-claude-marketplace/orchestrators/plugin/`, and **D/** means `extensions/pi-claude-marketplace/domain/`.

**Gate G (reused, not re-run):** `npm run check` exited 0 on the combined tree at `421863f6` (log `/tmp/pg-final2.log`). The verifier read the log. The static checks, the unpaired and the integration tests passed, with pi-mcp-adapter 7.0.1 from `node_modules/.cache/optional-peers`. The adapter cucumber profile ran 2100/2100 scenarios and 25988/25988 steps. The builtin profile ran 204/204 scenarios and 2762/2762 steps. Direct coverage merged 376 LCOV records. The log ends with `exit=0`. Since `421863f6`, only `ebcce31e` changed a file outside the VERIFICATION reports, one sentence of `docs/mcp-compatibility.md`, which is not a build input. So G covers every executable input of HEAD, including the five phase features (`root-source-entries`, `sibling-links`, `references`, `agent-restrictions`, `agent-types`) and `features/workflow/collisions.feature`, which pins D-PG8-07 and D-PG8-18. The project's reuse rule applies, and the suite was not repeated.

**Independent checks:** 15 named single tests from the previous pass, each run with `node --import ./test/platform/isolated-pi-home.ts --test --test-isolation=none --test-reporter=tap --test-name-pattern '^<name>$' <file>` under a fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` in the session scratchpad. Each reported `tests 1, pass 1, fail 0`. There was also one pure probe of `rewriteSiblingSkillPaths` for the token-boundary edge. `query verify.artifacts` and `query verify.key-links` ran for all six plans. This pass re-ran eight named tests the same way, under fresh `mktemp` HOME and `PI_CODING_AGENT_DIR` dirs in the session scratchpad: S5, S6, S10, S11, S12, S15, the 04-04 owner case `converges an elidable reference onto a generated workflow name`, and the new D-PG8-18 case `keeps the full workflow name a clashing script installs under (D-PG8-18)`. Each reported `tests 1, pass 1, fail 0`.

## Changes Since the Previous Report

`git log cb5ee48c..HEAD` over the 58 covered files lists nine commits, all before `421863f6`. `git diff --stat cb5ee48c HEAD` over them shows nine changed files. None changes the status of a Phase 4 truth:

| Commit(s) | File | Change | Effect on Phase 4 |
| --- | --- | --- | --- |
| 3488bf29 (D-PG8-18) | `D/skill-tokens.ts` | `resolveWorkflowReference` (:72-91) tries the full name `<plugin>:<source>` first (:78-82), then the elided generated name. | SC3 holds. For a reference whose source has no `<plugin>-` prefix, the full name equals the generated name. For a prefixed source whose script is installed under the elided name, the full name is not in the set, and the old path applies. The workflow arm still keeps the slash state (:131). S5, S6, the 04-04 owner case, and the new D-PG8-18 case pass. |
| b35b86d1 (D-PG8-07), 3488bf29 (D-PG8-18) | `D/workflow-script.ts` | The WNAM-05 collision throw `assertNoWorkflowNameCollisions` is gone. `unelideClashingWorkflowNames` (:254) gives clashing `meta.name`s their full names, and `keepLastWorkflowPerName` (:327) keeps the last of two scripts with one name. Both run in `bridges/workflows/discover.ts:446`. | The agent types still come from the AST (`readAgentTypes` :944-954, on the named verdict :235-237, :394). Install, update and `info` all read the workflows through `discoverPluginWorkflows` (O/discover-names.ts:330, O/info.ts:1266), so the notes come only from the installed scripts. Before, a plugin with two scripts of one name failed the whole install and gave no note. Now its kept script gets its own note. S15 passes. |
| 6d9a3cdd (D-PG10-25) | `O/info.ts` | `applyRecordRowShape` (:1813-1823) adds the `unreadable` reason when a record's stored options do not parse. It replaces the three `applyDisabledRowShape` calls. | Not on a Phase 4 path. The 04-02 and 04-06 code is unchanged, and its lines moved by +1 (above :1805) or +18 (below). S10 and S11 pass. |
| 78011db4 | `features/step_definitions/plugin/installation.steps.ts` | One new Given for unreadable options (:369-382). | The phase's "installation record" Then is unchanged. |
| 9e3dc68b, 4d6825ba, 8c64be00, 594ea843, 6826f6f6 | `CHANGELOG.md`, three test files | CHANGELOG wording for later phases. The tests are the owner cases of the changes above. | CHANGELOG.md:13 (`anthropics/skills` reinstall line) is unchanged. |
| 3488bf29, b35b86d1 | `docs/workflows-compatibility.md` | Two naming rows and one paragraph (:195-196, :204). | :42, :130 and :178 are unchanged. |

## Superseded mechanisms (later decisions)

| Decision | What it changed | Effect on Phase 4 must-haves |
| --- | --- | --- |
| D-PG4-11/12 wording (Phase 4 review WR-05 and 91b0c917, wording accepted by the maintainer review 2026-11-16) | The note names only the built-ins that the agent's restriction does not keep. It also hedges on the engine setting: `...which restricts its tools; unless the workflow engine's providerMiddlewareExtensions setting lists builtin:codemode, the engine does not keep that restriction, so the agent may use bash, edit, and write` (O/discover-names.ts:159-166). PROJECT.md:2395 records this exact wording. | SC4 holds: the note still says that the workflow does not keep the restriction. The literal note text in the folded 04-05 truth 1 ("can use read, bash, edit, and write") is the pre-review wording. The recorded decision replaces it, as the previous report noted. An agent whose `tools` keeps all four built-ins gets no note (agent-restrictions.feature:117). WFNOTETRIGGER-01 (BACKLOG.md:5367) is still open in BACKLOG as a maintainer question. |
| D-PG8-04 (Phase 8, confirmed by the maintainer review 2026-11-16) | The restriction note keys on the declared `<plugin>:<agent>` name only. The generated file name binds no agent in the engine, so it gets no note (f9ebd499). A second note kind was added for an agent type of the plugin's namespace that the plugin does not install. | The 04-05 truth 3 generated-name clause is reversed. It is carried by an override (see frontmatter). Its other clauses hold. The new missing-agent note gives no false note for any 04-05 "no note" arm: a bare name, another plugin's name, a generated flat name, and a non-literal each get none (discover-names.ts:216-230, 257-264). |
| D-PG8-05 (Phase 8, confirmed by the maintainer review 2026-11-16) | `workflowAgentRestrictionNotes` was renamed to `workflowAgentNotes`, the one member and join that carry both note kinds. It is capped at five missing-agent notes per script, followed by a count line (b8ac6d91). | The five artifact and key-link patterns of 04-05 and 04-06 fail on the literal name only. The wiring is intact under the new name, so an override carries it (see frontmatter). |
| `substituteClaudeVars` -> `substituteClaudeContent` (3abe4484, plugin option defaults in skill content) | Rename and an extra options argument. | The 04-03 ordering truth still holds: the sibling rewrite runs inside `skillMarkdownRewrite` (bridges/skills/stage.ts:250-266) before `substituteClaudeContent` (:388-389). |

## Goal Achievement

### Roadmap Success Criteria

| # | Truth | Status | Current evidence |
|---|-------|--------|----------|
| SC1 | With `source: "./"` and `skills: ["./skills/a"]`, and `skills/a` and `skills/b` on disk, `info` lists `a` only and only `a` is installed. After an update that drops a listed skill, no file or record of that skill stays behind (PG-CORE-01). | ✓ VERIFIED | `isMarketplaceRootSource` (D/component-paths.ts:555-560) and `rootSourceListedSkills` (:567-572) route a root-source entry that lists skills to `collectRootSourceSkillPaths` (:688-725, called at :742). That function replaces `skills/` and the manifest paths with the surviving listed folders (`addListedSkillPaths`, :637-650). `info` uses the same predicate in its lenient mirror (O/info.ts:2306-2334) and lists a self-skill folder as one skill (`componentNamesFromEntries`, :363-373). Scenarios in G: install stages only the listed skill (root-source-entries.feature:28); `info` lists only it (:196); update drops the folder and record (:75); a reinstall under the same version drops it (:102); a new session offers only the kept skill (:129); the dropped Claude Code name reaches the model as typed (:146); a second reinstall changes nothing (:168). The hash covers `.claude-plugin/marketplace.json` (S9). |
| SC2 | Skill `a` says `See ../b/ref.md`. After the install, the text the model receives names a path that exists and holds `b`'s file (PG-SKILL-04). | ✓ VERIFIED | sibling-links.feature:7 (in G): the model receives `See ../demo-b/ref.md.` (:35), calls `read` on `.../skills/demo-a/../demo-b/ref.md` (:37), and gets `The reference of skill b.` (:38). The rewrite is `rewriteSiblingSkillPaths` (D/skill-sibling-paths.ts:78-112), applied by `skillMarkdownRewrite` (bridges/skills/stage.ts:250-266) to `SKILL.md` (:387-388) and supporting Markdown (:399). The sibling map is built from discovery in `prepareStageSkills` (:510-512). Both install (O/install-outcome.ts:1270) and the update runner (O/update-swap.ts:410) call it. S1, S3 and S4 pass here. |
| SC3 | A command body `Workflow({ name: "demo:scan" })`: the scripted model calls `workflow` with the name copied from the prompt, the run completes, and a slash reference keeps its slash (PG-WF-01). | ✓ VERIFIED | D/skill-tokens.ts:131 `return token.startsWith("/") ? `/${workflowName}` : workflowName;`. references.feature (in G): the prompt holds `Call Workflow({ name: "demo:scan" }) now. Slash form: /demo:scan.` (:20,:31); the model-started run (:67) calls `workflow` with that name and completes; the staged skill keeps `allowed-tools: Workflow(demo:scan)` (:40,:63). The commands bridge inherits the rule through `rewriteMarkdownReferences` (bridges/commands/staged-command.ts:42,277). S5 and S6 pass here. |
| SC4 | An agent `reader` (`tools: Read`) and a workflow with `agentType: "demo:reader"` install with the restriction note, and `info` shows it. The compatibility page says the same, and the engine request is drafted under `.planning/upstream/` (PG-SEC-01). | ✓ VERIFIED | `readAgentTypes` (D/workflow-script.ts:944-954) puts the literal agent types on the named verdict (:235-237, :394). `workflowAgentNotes` (O/discover-names.ts:272-290) builds the note. It is spread into the install discovery warnings (O/install-outcome.ts:1257), the update staging warnings (O/update-swap.ts:1735), and the `info` notes (O/info.ts:1160-1165, 1182). agent-restrictions.feature:18 (install), :48 (update) and :79 (info) assert the exact note, and :117 asserts the no-note arm (in G). `docs/workflows-compatibility.md:130` has the D-PG4-14 row and cites the feature. `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md:3` says "Patch: no patch exists; this report is not filed." The note wording follows D-PG4-11/12 (see Superseded). S12-S15 pass here. |

### Plan Truths (those that restate a success criterion are folded into it)

| Plan | Truths | Status | Current evidence |
|------|--------|--------|----------|
| 04-01 | 9 (non-root and object sources keep D-CF1-06; no-survivor arms; shared `skills/` folder; listed root or `skills/` collects once; absent, null or empty `skills`; listed order; repeat reinstall idempotent; resolver writes nothing and only the update or reinstall transaction removes; hash covers `marketplace.json`) | ✓ 9/9 VERIFIED | Non-root and object sources: `isMarketplaceRootSource` is false for a non-string or a non-root string, so `collectStrictComponentKind` takes the D-CF1-06 path (component-paths.ts:741-760). No survivors: when a traversal was refused, nothing is collected; otherwise `addDeclaredSkillPaths` applies (:719-722; absolute paths count as traversal, :170-180). Listed root: `skills/` follows once (:646-649); spellings collapse after containment (:185-186, `addComponentPath` :189-200). Empty `skills`: `readPathOrArray` (:120-130) yields none, so D-CF1-06 applies. Shared folder: root-source-entries.feature:53. Idempotent reinstall: :168. Hash: S9. Refused listed paths are reported in Claude Code 2.1.323's wording, and the plugin stays installable (S7, S8; feature :222, :252). |
| 04-02 | 4 (a self-skill path lists as one skill; lenient mirror; lenient branch never reads a refused path; non-root unchanged) | ✓ 4/4 VERIFIED | `componentNamesFromEntries` (info.ts:363-373; S11). Lenient mirror: `rootSourceLenientSkillPaths` (:2306-2334) and `deriveLenientComponentPaths` (:2269-2294). Refused paths are never read: `containedRelativePath` is lexical and cwd-free (:2344-2356), and only kept paths reach `readEntriesOrMissing` (:2320-2325; S10). Non-root entries return `undefined`, which keeps the old listing (:2314-2316). Feature :272, :295, :317 and :343 in G. |
| 04-03 | 5 (supporting Markdown depth and trailing slash; all four positions plus `${CLAUDE_SKILL_DIR}`; D-PG4-06 byte identity; root-source unlisted sibling; every verb gets the map) | ✓ 4/4 VERIFIED, 1 PASSED (override) | Depth and trailing slash: `depthInSkill` and the climb (skill-sibling-paths.ts:35-41, 105-107); sibling-links.feature:40 (`../../demo-b/ref.md`, `../../demo-b/`, :80); S4. Positions and the variable: line-wise rewrite of every token (:84-111), run before substitution (stage.ts:381-389); S3. D-PG4-06: outside, own and unstaged paths stay unchanged (`matchSibling` :48-63; S2). The out-of-grammar prefix edge is still present: the probe still gives `../b%20x/ref.md` -> `../demo-b%20x/ref.md`, so this truth is carried by the SIBLINGPREFIX-01 override. Root-source unlisted sibling: sibling-links.feature:88. Every verb: the map is built inside `prepareStageSkills` (stage.ts:510-512), the one skills-staging entry for install (install-outcome.ts:1270) and for the update runner (update-swap.ts:410), which reinstall and apply moves reach through `materialize-latest.ts:145,230`. |
| 04-04 | 5 (elision and precedence; staged skill keeps bare name; byte identity on a miss; recognition only on a generated name and an ASCII slash; doc D-PG4-10) | ✓ 5/5 VERIFIED | `resolveWorkflowReference` (skill-tokens.ts:72-91, with the D-PG8-18 full-name lookup first at :78-82) and the workflow arm (:124-131). Owner cases `converges an elidable reference onto a generated workflow name`, `prefers the skill a token resolves to over a workflow of the same source name`, `leaves a workflow reference verbatim when the plugin stages no such workflow`, `reads only an ASCII slash before a workflow reference as its slash` and `skips a workflow candidate the workflow name generator rejects` (skill-tokens.test.ts:271,381,396,350,441) pass in G; the first was also re-run here. The staged skill keeps `Workflow(demo:scan)` (references.feature:33). docs/workflows-compatibility.md:178 carries the retargeting statement and the remaining engine and script-bytes residuals. |
| 04-05 | 7 (update prints once; upstream and generated names, `tools` and `disallowedTools`, with or without pi-subagents; no-note arms; empty arms; exact equality and escaping; never persisted; unreadable script costs its note) | ✓ 6/7 VERIFIED, 1 PASSED (override) | Update once: the one join site in the update runner (update-swap.ts:1727-1736), reached by reinstall and apply through `swapPluginUpdate` (materialize-latest.ts:145,230); S14. Generated name: reversed by D-PG8-04, carried by an override. The `tools`/`disallowedTools` clause holds (discover-names.ts:90-98). No-note arms: a non-literal is never collected (`collectAgentTypes`, workflow-script.ts:961-); another plugin's agent is not in `restricted` and fails the own-prefix test (discover-names.ts:216-226); an unrestricted agent has no unkept built-ins (:116-122); a non-admitted script has no `named` verdict (:286-289). Empty arms: no scripts or agents gives an empty `flatMap`, and absent or blank tools allow everything (:93). Exact equality is `Map.get` on the literal, and escaping is `forMessage` on the file name, folder and agent type (:141-157; S13). Never persisted: the note is recomputed in `discoverGeneratedNames` (:319-349) and travels only in warnings. Unreadable script: no `named` verdict, so no note, and the AST is parsed once (`readAgentTypes(parsed.ast)`, workflow-script.ts:235). One note per distinct pair still holds after D-PG8-07: of two scripts with one name only the kept one reaches the join (bridges/workflows/discover.ts:446). S12 and S15 pass here. |
| 04-06 | 4 (`info` reads agent files only inside the plugin root; no-literal plugins unchanged; root-source exception on the compat page; CHANGELOG reinstall line) | ✓ 4/4 VERIFIED | `previewWorkflowAgentNotes` (info.ts:1298-1325) returns early when no script names an agent type (:1304-1309). It reads agents only through `resolveContainedComponentPath` (:1312-1315), and a throw becomes a debug line with no notes (:1321-1324). docs/workflows-compatibility.md:42 states the root-source exception beside D-CF1-06. CHANGELOG.md:13 tells `anthropics/skills` users to run `/claude:plugin reinstall` once, and :14-18 name the other user-visible changes of the phase. |

**Score:** 38/38 truths verified: 4 success criteria and 34 plan truths. 36 are VERIFIED directly and 2 are PASSED (override): the SIBLINGPREFIX-01 edge under D-PG4-06, and the D-PG8-04 generated-name clause. None is behavior-unverified. Every behavior-dependent truth has a passing named test or a scenario in G.

**About the SIBLINGPREFIX-01 edge:** the 04-03 D-PG4-06 byte-identity truth at the out-of-grammar prefix edge is **still open in behavior**: `skill-sibling-paths.ts` has not changed since `55a81f8e`, so the earlier probe result stands, and BACKLOG SIBLINGPREFIX-01 (:5363) is still open. It is **carried by the existing override** and counts as PASSED (override), as Step 3b requires. No link that resolved before breaks.

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
| `D/skill-tokens.ts` | ✓ VERIFIED | slash-preserving workflow arm :131 (`D-PG4-08` at :11) |
| `D/workflow-script.ts` | ✓ VERIFIED | `agentTypes` on the named verdict :100, :394 |
| `O/discover-names.ts` | ✓ VERIFIED (override, renamed) | `export function workflowAgentNotes` :272 |
| `O/install-outcome.ts`, `O/update-swap.ts`, `O/info.ts` | ✓ VERIFIED (override, renamed) | :1257, :1735, :1160/:1318 |
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
| 02 | info -> component-paths | `isMarketplaceRootSource` import :39, use :2314 | WIRED |
| 02 | root-source-entries.feature -> info | `plugin components skills` (:196) | WIRED |
| 03 | stage -> skill-sibling-paths | `rewriteSiblingSkillPaths` :25,:257 | WIRED |
| 03 | stage -> skills/discover | `siblingSkills` from discovery :510-512 | WIRED |
| 04 | commands/staged-command -> skill-tokens | `rewriteMarkdownReferences` :42,:277 | WIRED |
| 04 | upstream/index -> upstream/workflows | `RESULT_PROJECTORS` `["workflow", projectWorkflowResult]` :17 | WIRED |
| 04 | references.feature -> runs.steps | model-started run :67 | WIRED |
| 05 | discover-names -> workflow-script | `verdict.agentTypes` :288 | WIRED |
| 05 | install-outcome -> discover-names | `generatedNames.workflowAgentNotes` :1257 | WIRED (override: renamed) |
| 05 | update-swap -> discover-names | `generatedNames.workflowAgentNotes` :1735 | WIRED (override: renamed) |
| 06 | info -> discover-names | `workflowAgentNotes(pluginName, discovered, workflows)` :1318 | WIRED (override: renamed) |
| 06 | workflows-compatibility -> agent-restrictions.feature | cited at :130 | WIRED |

## Data-Flow Trace (Level 4)

| Value | Source -> consumer | Real data | Status |
| --- | --- | --- | --- |
| Staged skill set | entry `skills` -> `collectRootSourceSkillPaths` -> `componentPaths.skills` -> `discoverPluginSkills` -> staged folders and record | Yes. The scenarios assert the staged folders and record names. | FLOWING |
| Sibling path text | discovery -> `siblingSkills` map -> `rewriteSiblingSkillPaths` -> staged `SKILL.md` -> model prompt | Yes. The model reads `b`'s file. | FLOWING |
| Workflow reference | source token -> `resolveWorkflowReference` -> slash state kept -> command prompt -> `workflow` tool call | Yes. The run completes. | FLOWING |
| Restriction note | script AST literals -> `agentTypes` -> `workflowAgentNotes` join with discovered agents -> install/update warnings and `info` notes | Yes. The exact rows are asserted. | FLOWING |

## Behavioral Spot-Checks

Each run used a fresh scratchpad `mktemp` HOME and `PI_CODING_AGENT_DIR`, with no services. Each gave `tests 1 / pass 1 / fail 0`. S1-S15 and P ran in the previous pass; the rows marked "re-run" ran again on the current tree, and S16 and S17 are new.

| ID | Named test | File | Result |
| --- | --- | --- | --- |
| S1 | rewrites a link from SKILL.md to a file of a sibling skill | test/domain/skill-sibling-paths.test.ts | PASS |
| S2 | leaves a path outside every skill as written | test/domain/skill-sibling-paths.test.ts | PASS |
| S3 | PG-SKILL-04: rewrites a skill directory variable path before substitution, so it ends in the sibling's target folder | test/bridges/skills/stage.test.ts | PASS |
| S4 | PG-SKILL-04: rewrites a sibling path in supporting Markdown from the folder of the file | test/bridges/skills/stage.test.ts | PASS |
| S5 | keeps the slash of a workflow reference its source wrote with one | test/domain/skill-tokens.test.ts | PASS (re-run) |
| S6 | keeps the installed workflow name without a slash inside a tool call | test/domain/skill-tokens.test.ts | PASS (re-run) |
| S7 | D-PG4-01 a root-source entry carries its refused listed skills paths and stays installable | test/domain/plugin-resolver.test.ts | PASS |
| S8 | D-PG4-01 the stat reader receives no refused listed path | test/domain/component-paths.test.ts | PASS |
| S9 | D-PG4-02 hashes a change to only the marketplace manifest under the root | test/domain/version.test.ts | PASS |
| S10 | D-PG4-01: the lenient listing of a root-source entry lists no skill when every listed path is absolute or escapes | test/orchestrators/plugin/info.test.ts | PASS (re-run) |
| S11 | D-PG4-01: info lists a listed skill folder that holds SKILL.md as one skill, not its subfolders | test/orchestrators/plugin/info.test.ts | PASS (re-run) |
| S12 | PG-SEC-01: notes a workflow script that runs a tool-restricted agent of the plugin | test/orchestrators/plugin/discover-names.test.ts | PASS (re-run) |
| S13 | PG-SEC-01: escapes format characters in the file name and the agent type of a note | test/orchestrators/plugin/discover-names.test.ts | PASS |
| S14 | PG-SEC-01: a swap to a version whose workflow runs a tool-restricted agent adds one note between the folder and bridge warnings | test/orchestrators/plugin/update-swap.test.ts | PASS |
| S15 | PG-SEC-01: finds nested agent types once each, in first-seen order | test/domain/workflow-script.test.ts | PASS (re-run) |
| S16 | converges an elidable reference onto a generated workflow name | test/domain/skill-tokens.test.ts | PASS (re-run) |
| S17 | keeps the full workflow name a clashing script installs under (D-PG8-18) | test/domain/skill-tokens.test.ts | PASS (new) |
| P | `rewriteSiblingSkillPaths` probe: `See ../b/ref.md.`, `../b%20x/ref.md`, `../bx/ref.md`, `see ../b for details` from skill `a` | pure, scratch only | `../demo-b/ref.md.`; `../demo-b%20x/ref.md` (edge, override); `../bx/ref.md` unchanged; `../demo-b for details` |
| G | `npm run check` at `421863f6` (same executable inputs as HEAD) | root scripts, both cucumber profiles | PASS (reused) |

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

`query check.decision-coverage-verify` returned `skipped: CONTEXT.md missing`, although `04-CONTEXT.md` exists, so the tool gave no verdict. Traced by hand: the D-PG4-01..15 decisions are honored by the shipped code cited above (16/16 trackable, as before). D-PG4-01 is in component-paths and info. D-PG4-02 is in the update and reinstall unstage path and the hash. D-PG4-03 is the shared-folder scenario. D-PG4-04..07 are in skill-sibling-paths and stage. D-PG4-08..10 are in skill-tokens and the docs. D-PG4-11..13 are in discover-names and the three join sites, with the wording amended as recorded. D-PG4-14 and D-PG4-15 are in the docs row and the upstream draft. Every D-PG4 row is locked: D-PG4-01 and D-PG4-02 are confirmed by the maintainer review of 2026-11-16 (PROJECT.md:2391,2392), and D-PG4-11/12 is locked with its wording accepted (PROJECT.md:2395). The later D-PG8-07 and D-PG8-18 rows (PROJECT.md:2422,2426) are locked as well, and the D-PG4 code honors them (see Changes Since the Previous Report).

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
| All 14 phase source and feature files (component-paths, skill-sibling-paths, skill-tokens, workflow-script, discover-names, skills/stage, info, install-outcome, update-swap, redact-absolute-paths, four phase features) | TBD / FIXME / XXX / TODO / HACK | None | No match (re-checked on the four changed source and step files) |
| Same scope | `@skip` / `@wip` | None | No match |

### Info (non-blocking)

- The previous Info item on the security delta (`redactAbsolutePaths` after a sentence period) is closed: the owner case "redacts an absolute path that follows a sentence period" is at test/shared/redact-absolute-paths.test.ts:551 and passes in G.
- The 04-01 and 04-02 SUMMARY text still describes the pre-review silent drop and the lexical-only lenient mirror, and the 04-05 and 04-06 SUMMARY text names the old `workflowAgentRestrictionNotes`. The code matches REVIEW-FIX and D-PG8-04/05, not those summaries.
- Accepted residuals still in BACKLOG: WFCMDCOLLIDE-01, WFAGENTCONST-01, PRELOADSIBLING-01 (:5347), STAGEDUPMARKER-01, WFRESTRICTGATE-01 (:5355), INFOAGENTESCAPE-01, SIBLINGPREFIX-01 (:5363) and WFNOTETRIGGER-01 (:5367).

## Maintainer Review

There are no human-verification items. The maintainer review of 2026-11-16 accepted the four overrides, which leave nothing unverified:

1. **SIBLINGPREFIX-01 (PG-SKILL-04 token boundary):** accept `../b%20x/ref.md` -> `../demo-b%20x/ref.md` (a dead path before and after), or add a boundary check after the token so the path stays byte-identical.
2. **PG-WF-01 judgment prohibition (flagged):** confirm that no staged command, skill or agent gains opt-in wording about workflows. The verifier's non-authoritative verdict is that this holds.
3. **D-PG8-04:** the generated agent file name gets no restriction note, which reverses a clause of the 04-05 truth.
4. **D-PG8-05:** the join is renamed to `workflowAgentNotes` and carries both note kinds.

Two other decisions are outside the overrides, and the same review locked both: D-PG4-01/02 (confirmed) and the D-PG4-12 note wording (accepted).

## Gaps Summary

There are no gaps and no regressions. On the current tree, all four roadmap criteria and all 34 plan truths of Phase 4 still hold. All citations now point at current lines. Since the previous report, D-PG8-07, D-PG8-18 and D-PG10-25 changed three covered source files; none of them breaks a Phase 4 truth (see Changes Since the Previous Report). Earlier work changed four mechanisms that the phase relies on, and none of them breaks a criterion:

- The D-PG4-11/12 review wording is now the recorded note text.
- D-PG8-04 stopped noting a generated agent file name, because the engine never binds that name. One 04-05 clause is reversed, and an override carries it.
- D-PG8-05 renamed the join to `workflowAgentNotes`. The five tool-pattern misses are only that rename, and an override carries them.
- The variable substitution was renamed, and the order of the rewrite and the substitution is unchanged.

The earlier uncertain truth, the SIBLINGPREFIX-01 edge, is still open in behavior. Its existing override carries it, and the score now counts it, so the score is 38/38.

---

_Verified: 2026-11-17T03:34:18Z_
_Verifier: Claude (gsd-verifier)_
