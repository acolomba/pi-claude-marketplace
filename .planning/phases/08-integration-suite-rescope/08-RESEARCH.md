# Phase 8: Integration Suite Rescope - Research

**Researched:** 2026-11-23
**Domain:** test-suite triage (node:test integration suite, cucumber scenarios, unit pairs, test charter docs)
**Confidence:** HIGH for the case map and the moves (read and run this session); MEDIUM for "cucumber does not cover" sentences that rest on the milestone audit for files no earlier phase rechecked

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- [Classification] Q: "How is each remaining case classified?" → Selected: "Research lists every case of every remaining file with its class (peer conformance, multi-process race, internal: stored fields / earlier-release state / fault injection / call absence, or rule 4), the evidence for the class, and for any case that fits none: the scenario or unit test that covers it (delete) or the source pair it moves beside (unit test)" — ITSCOPE-01.
- [Moves to unit tests] Q: "How does a case move to a unit test?" → Selected: "Beside its source pair under `test/<layer>/...`, following the typescript-unit-tests skill, with 100% direct coverage of the pair kept; the integration case goes in the same commit" — test layout rule.
- [Deletion proof] Q: "Does a case deleted as covered need a break?" → Selected: "Yes, as in Phases 1-7: one reverted deliberate break shows the covering scenario or unit test fails on a When/Then or an assertion before the case goes" — milestone rules.
- [Headers] Q: "What does each remaining file's header say?" → Selected: "Its class and the behavior cucumber does not cover, in the `// path` + prose style of the trimmed files (e.g. `test/integration/standalone-prune.test.ts`); fix the overclaims carried from Phases 4 and 5 (state exactly what the cases assert)" — ITSCOPE-02.
- [Charter] Q: "Where does the charter go and what does it say?" → Selected: "One short section in each of `.agents/skills/typescript-unit-tests/` (SKILL.md or a rules file), `.agents/skills/cucumber/`, and `.planning/codebase/TESTING.md`, with the same rule: what belongs in an integration test (the ITSCOPE-01 classes), and what goes to cucumber (user-visible behavior) or a unit test (one source pair); written plainly (simple-english)" — ITSCOPE-03.
- [Docs pass] Q: "Fix the Phase 1 source-read doc claims?" → Selected: "Yes if research confirms them as wrong or unverifiable; reword to what a test or scenario shows" — small, in scope as cleanup of claims about the suite.
- [Upstream parity] Q: "A case that pins behavior that may differ from Claude Code with no decision ID?" → Selected: "It stays and the question goes to the user (milestone rule), as in Phase 6" — milestone rule.
- [Bugs] Q: "A case exposing a product bug?" → Selected: "Rule 4: small fix with a unit test and CHANGELOG parent line, else BACKLOG entry and the case stays" — milestone rule.
- [Final gate] Q: "When is ITSCOPE-04 checked?" → Selected: "After the last Phase 8 merge and after Phase 6.1 merges: `npm run check` on the combined tree, both cucumber profiles green, 100% direct coverage" — ITSCOPE-04.

### Claude's Discretion
- Plan count and waves (likely: classification and moves per group of files; charter and headers; final gate).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

(REQUIREMENTS.md Out of Scope, also binding: no rewrite of the peer conformance tables as scenarios; the `integration` CI job and `test:integration` stay; internal cases that would need new cucumber fault-injection support stay as integration cases.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ITSCOPE-01 | Every case left in `test/integration/` is peer conformance, a multi-process race, or internal (stored record fields, earlier-release state, fault injection, calls that must not happen); any other case moves to a unit test with its source pair or is deleted when covered | Case map below: 279 cases in 30 files (measured), 265 kept, 14 leave: 8 move into `test/orchestrators/reconcile/plan.test.ts` (drafted, run, 100% direct coverage), 6 delete as covered with named breaks (4 breaks pre-run on unit pairs this session). No helper is orphaned. |
| ITSCOPE-02 | Each remaining file's header names its class and the behavior cucumber does not cover | Header audit of the 28 remaining files: 23 need new or changed text; draft text for each is in "Header text". The two carried overclaims are settled (`standalone-prune` assertion strengthened and run; `mcp-verdict-migration` reworded). |
| ITSCOPE-03 | The charter is in the `typescript-unit-tests` skill, the `cucumber` skill, and `.planning/codebase/TESTING.md` | Draft charter text and the exact insertion points are in "Charter text". `TESTING.md` also carries stale counts ("16 files") to fix. |
| ITSCOPE-04 | `npm run check` passes on the combined tree at the end | Final-gate plan after Phase 6.1 merges; Validation Architecture lists the commands and the extra mechanical checks. |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before editing it; trace callers before changing a function.
- Never commit to `main`; never rebase or rewrite history; merge to update. Commit per `.agents/skills/committing/SKILL.md`; never `--no-verify`; never set `SKIP=` for a pre-commit hook.
- A user-visible `/claude:plugin` behavior change ships with a cucumber scenario that fails without it (none expected here: this phase changes tests and docs only).
- GSD gates run `npm run check` on the combined tree (post-merge of each wave, phase gate, final handoff); a passing commit hook is not a verdict. A quick task that commits a build input runs `npm run check` after merge.
- Every plan `SUMMARY.md` has `## Threat Flags`.
- `windows append --description` is prefixed with `[integration-rescope]`.
- Upstream parity: a scenario/case expects Claude Code's behavior or names a decision ID or Pi gap; an unlicensed divergence goes to the user.
- Parent lines (CHANGELOG, BACKLOG, PROJECT Key Decisions) go under "Parent lines" in the last plan's SUMMARY, not into those files (ROADMAP "Parent lines").
- Unit-test rules (`typescript-unit-tests` skill): one test module per source module at the mirrored path; 100% direct coverage per pair; `test()` not `it()`; one top-level `describe()` per exported entrypoint, no nesting; `// arrange` / `// act` / `// assert`; whole-value `deepStrictEqual`; a data-driven `for` loop makes one sibling `test()` per row; "When relocating a case, preserve its assertions unless the contract changed" (`rules/cases.md`); titles cite durable IDs, never phases.
- Comments and test titles cite durable spec IDs, never GSD artifacts (CONVENTIONS.md "Comments").
- Text for docs and the charter follows `simple-english` (Plain mode).
- Phase-specific environment facts (CONTEXT.md "Specifics"): run npm scripts with `npm_config_script_shell=…/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`; direct coverage under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp`; `fd` on `PATH`; cucumber runs with `--parallel 2` and under the shared `flock`; breaks only inside the plan's own worktree; `fallow audit` `weakened-tests` for a deleted test file is expected and recorded, not fixed (no `.fallowrc.json` or CI change, user decision 2026-11-21); a cucumber failure prints as `  N) <title> # <file>:<line>`.

## Summary

The integration suite at `e205d23` has 30 files under Phase 8's scope (31 test files minus `hooks-additionalcontext-end-to-end.test.ts`, which Phase 6.1 deletes) and **279 cases, all passing** (measured: one TAP run of the whole set, `exit=0`, then one run per file for the counts). Nearly all of them already fit an ITSCOPE-01 class. The twelve peer conformance files (224 cases, most of them rows of the expansion and encoding tables) import and run a peer's own code: pi-mcp-adapter's `dist/`, pi-subagents' `src/`, the workflow engine, or Pi's own `ExtensionRunner`, `resolveConfigValueOrThrow`, and `validateMcpServerConfig`. Three files hold multi-process cases (`concurrent-install`, `load-reconcile-race`, `subagent-hook-ownership`). The rest are internal cases that earlier phases already trimmed and labeled, plus four untouched internal files (`mcp-server-records`, `mcp-verdict-update`, `workflow-kind-inversion`, `marketplace-add-seed-mirrors`).

Fourteen cases leave the suite. The ten pure in-memory cases of `reconcile-plan-convergence` split: 8 move into `test/orchestrators/reconcile/plan.test.ts` as 8 new cases (drafted in a scratch worktree, 71/71 pass, lint clean, `plan.ts` direct coverage 100%/100%/100%), and 2 delete as covered by existing unit cases, each with a break that this research ran and saw fail the covering unit case. Four more cases are covered by cucumber or unit tests and delete: the single-process D-13 case of `load-reconcile-race` (`features/plugin/config-migration.feature:248`), test 1 of `subagent-hook-ownership` (`features/plugin/subagent-child.feature:364`, whose When step asserts the same per-stage observations), test 1 of `workflow-kind-inversion` (`features/workflow/storage.feature:18` and `:31`), and the whole of `transaction-lifecycle-cascade` (its one case is duplicated by `test/orchestrators/plugin/reinstall-flow.test.ts:4275`, `update-flow.test.ts:8197`, and `features/hook/lifecycle.feature:42`/`:52`). Two files then go: `reconcile-plan-convergence.test.ts` and `transaction-lifecycle-cascade.test.ts`. No helper module loses its last importer.

The header work is the larger part. Of the 28 files that remain, 7 have no header that states a class, 2 need a rewrite after their trims, 2 carry the overclaims, 12 (the 10 conformance files, `plugin-layer-verbs`, and `marketplace-layer-remove`) say what they check but not their class, and 5 are already right. The two carried overclaims are settled: `standalone-prune` can assert the whole recorded git-call object (run green this session), and the `mcp-verdict-migration` header must say its cases compare whole rendered text that no scenario compares. The Phase 1 doc claims are source reads, confirmed in the installed peers this session, and need a "read in source, not run" marker. One more doc pointer goes stale with the deletions (`docs/output-catalog.md:695`). No remaining case pins a Claude Code divergence without a decision ID or Pi gap.

**Update during research:** Phase 6.1's commits landed on the branch while this research ran (`b116f4f`..`8d80287`, merge `8038de7`). They delete `hooks-additionalcontext-end-to-end.test.ts`, change `bridges/hooks/{event-adapters,event-router,runtime,routing-state,dispatch,index}.ts`, and change `docs/hooks-compatibility.md`; they touch no other file this research cites. On that tree, `hooks-result-boundary` (6/6) and `hooks-dispatch-end-to-end` (1/1) still pass, and the IN-03 sentence is still at `docs/hooks-compatibility.md:77` [VERIFIED: run and grep at `8d80287`].

**Primary recommendation:** Four Wave 1 plans on disjoint files, run in parallel: (1) the `reconcile-plan-convergence` move, (2) the four cucumber- or unit-covered deletions with their cucumber breaks, (3) headers and doc claims, (4) the charter. Then one Wave 2 final-gate plan, which runs after Phase 6.1 has merged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User-visible `/claude:plugin` behavior | cucumber (`features/`) | — | AGENTS.md "Behavioral tests"; real Pi, real peers, both MCP profiles |
| One source module's exported behavior | unit pair (`test/<layer>/<module>.test.ts`) | — | `typescript-unit-tests` pairing rule; 100% direct coverage per pair |
| A peer's own code reading what the extension writes | `test/integration/` | — | needs the peer's real modules; one Pi run per row would be the alternative (Out of Scope) |
| Races and hand-offs between processes | `test/integration/` | cucumber where one Pi suffices | a scenario runs one Pi at a time |
| Internal state no command shows, earlier-release state, injected faults, calls that must not happen | `test/integration/` | unit pair when one module owns it | cucumber cannot observe or inject it |
| The charter text | `.agents/skills/{typescript-unit-tests,cucumber}/SKILL.md`, `.planning/codebase/TESTING.md` | — | ITSCOPE-03 |

## Standard Stack

No new packages. The phase uses only what the repository already has.

| Tool | Version (installed) | Purpose |
|------|---------|---------|
| `node:test` + `node:assert/strict` | Node v24.22.3 | the integration and unit runner |
| `@cucumber/cucumber` (via `scripts/cucumber.mjs`) | repo devDependency | the covering scenarios for breaks |
| `scripts/test-coverage-direct.mjs` | repo | per-pair direct coverage (`npm run test:coverage:direct -- <pair>`) |
| `scripts/check-corresponding-tests.mjs` | repo | `test:corresponding`; `test/integration` is a non-corresponding root |
| `scripts/install-test-peers.mjs` | repo | installs pi-mcp-adapter, pi-subagents 0.88.1 (suite version, `test/integration/optional-peer-suite-versions.json`), and the workflow engine into `node_modules/.cache/optional-peers` |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## The Case Map (ITSCOPE-01)

**Counts are measured** [VERIFIED: one `node --test --test-reporter=tap` run per file at `e205d23`, logs in the research scratch dir `research-08/tap-<file>.log`; whole set: `# tests 279`, `# pass 279`, `exit=0`]. Line numbers are the `test(` line at `e205d23` [VERIFIED: grep of `test(` in each file]. "Class" uses the ITSCOPE-01 words: **PEER** (peer conformance against a peer's own code), **RACE** (multi-process), **INT-field** (stored record field), **INT-earlier** (state only an earlier release wrote), **INT-fault** (fault injection), **INT-absent** (calls or writes that must not happen). `hooks-additionalcontext-end-to-end.test.ts` is out of scope (Phase 6.1 deletes it).

### Summary per file

| File | Cases | Class | Action | Header |
|---|---:|---|---|---|
| adapter-expansion-conformance | 80 | PEER (pi-mcp-adapter `dist/`) | keep all | add class sentence |
| adapter-tool-name-conformance | 11 | PEER (pi-mcp-adapter `formatToolName`) | keep all | add class sentence |
| agents-adapter-grant-conformance | 1 | PEER (pi-subagents allowlist, pi-mcp-adapter name) | keep | add class sentence |
| agents-builtin-grant-conformance | 3 | PEER (pi-subagents `mcp-direct-tool-allowlist.js`) | keep all | add class sentence |
| auth-e2e | 1 | INT-fault | keep | already right |
| concurrent-install | 2 | RACE | keep all | **new header** |
| hooks-dispatch-end-to-end | 1 | INT-fault | keep (recheck after 6.1) | already right |
| hooks-result-boundary | 6 | PEER (Pi `ExtensionRunner`) | keep all (recheck after 6.1) | **new header** |
| load-reconcile-race | 3 | 2 RACE, 1 covered | keep 2, **delete D-13 case** | **rewrite** |
| marketplace-add-seed-mirrors | 6 | INT-field + INT-absent | keep all | **new header** |
| marketplace-layer-remove | 3 | INT-fault | keep all | add class label |
| mcp-adapter-entry-conformance | 3 | PEER (pi-mcp-adapter `config.js`, `utils.js`, `mcp-auth-fetch.js`) | keep all | add class sentence |
| mcp-builtin-encoding-conformance | 77 | PEER (Pi `resolve-config-value.js`, `validateMcpServerConfig`) | keep all | add class sentence |
| mcp-migration | 1 | INT-fault | keep | already right |
| mcp-server-records | 6 | INT-field (+ INT-earlier for 2) | keep all | **new header** |
| mcp-status-conformance | 3 | PEER (pi-mcp-adapter `types.js`/`types.d.ts`, Pi event bus) | keep all | add class sentence |
| mcp-verdict-list | 2 | INT-field, INT-absent | keep all | already right |
| mcp-verdict-migration | 3 | INT-earlier | keep all | **fix overclaim** |
| mcp-verdict-update | 4 | INT-field (+ INT-earlier, INT-absent) | keep all | **new header** |
| path-source-tag-install | 2 | INT-absent / INT-field | keep all | already right |
| pi-subagents-child-launch-conformance | 11 | PEER (pi-subagents `child-launch.js`, allowlist, `agents.js`) | keep all | **new header** |
| plugin-layer-verbs | 2 | INT-fault (tampered source kind) | keep all | add class label |
| provenance-invisibility | 11 | PEER (pi-subagents `frontmatter.js`) | keep all | add class sentence |
| reconcile-plan-convergence | 10 | none (pure in-memory) | **8 move, 2 delete; file goes** | — |
| skill-path-resolution | 1 | PEER (pi-subagents `skills.js`) | keep | add class sentence |
| standalone-prune | 2 | INT-absent | keep all | **fix overclaim** (+ stronger assertion) |
| subagent-hook-ownership | 2 | 1 RACE, 1 covered | keep 1, **delete test 1** | **rewrite** |
| transaction-lifecycle-cascade | 1 | none (covered) | **delete; file goes** | — |
| workflow-engine-agent-registry | 17 | PEER (engine `dist/agent-registry.js`) | keep all | add class sentence |
| workflow-kind-inversion | 4 | 1 covered, INT-absent, 2 INT-earlier | keep 3, **delete test 1** | **new header** |
| **Total** | **279** | | **265 kept, 8 moved, 6 deleted** | |

Kept by class: PEER 224, RACE 5, internal 36 (= 265). After the phase, `test/integration/` holds 28 `.test.ts` files (30 here, minus `reconcile-plan-convergence` and `transaction-lifecycle-cascade`).

### PEER files (12 files, 224 cases): keep all

Evidence for every row: the file imports and runs the peer's own module, not a copy [VERIFIED: grep of `findCachedPeer(`, `importPeerModule<`, `readPiMcpAdapterDist(`, and the `node_modules/@earendil-works/pi-coding-agent/dist/core/` imports]. A scenario would need one Pi run per row and still could not pin the peer's source (REQUIREMENTS Out of Scope).

| File | Cases (line) | Peer code it runs | What cucumber does not cover (audit, rechecked where noted) |
|---|---|---|---|
| adapter-expansion-conformance | 52 table rows `:168-169` (`EXPANSION_CASES`); 14 option rows `:1016-1017` (`OPTION_FIELD_CASES`); 3 `${NAME:-default}` states `:380-385`; statics `:181`, `:397`, `:425`, `:470`, `:526`, `:655`, `:736`, `:796` (drift guard), `:825`, `:899`, `:926` | `pi-mcp-adapter-peer.ts` loads `dist/utils.js`, `server-manager.js`, `mcp-auth-flow.js` | scenarios hold only a few env values (`mcp-server/configuration.feature`, `options.feature`, `legacy-move.feature:218`); not the table, the bounded-exhaustive property, marker-forming attacks (AVAR-05, D-CF1-13), the deny-list check, the split token, or the drift guard |
| adapter-tool-name-conformance | 11 rows `:100-101` (`TOOL_NAME_CASES`, 10) and `:116` | `dist/types.js` `formatToolName` | `mcp-server/listing.feature` cuts one server segment and `hook/mcp-tool-names.feature` has one 64-character name; not 65 characters, dots, empty/one-character tool, prefixed name, non-ASCII, the UTF-16/code-point edge, the screenshot drift guard |
| agents-adapter-grant-conformance | `:71` | pi-subagents `src/runs/shared/mcp-direct-tool-allowlist.js` + adapter name rule | pins the AGTLONGNAME-01 capability gap; `mcp-server/agent-grants.feature` covers only the exclude side |
| agents-builtin-grant-conformance | `:171`, `:194`, `:214` | pi-subagents allowlist resolver | `agent/frontmatter.feature` resolves one per-tool built-in grant; not a whole-server selector with the hyphen fold, a long tool, or adapter selectors left unresolved under the built-in MCP |
| mcp-adapter-entry-conformance | `:89` (D-08-02), `:139`, `:160` (D-08-04) | adapter `dist/config.js`, `utils.js`, `mcp-auth-fetch.js` | `configuration.feature` covers the clean D-08-04 header; not `supportsOAuth=false` for an unset header variable, nor the adapter loading a file that holds `_piClaudeMarketplace.serverChoices` |
| mcp-builtin-encoding-conformance | 22 written rows `:168-169`, 30 resolver rows `:181-182`, 7 Pi-syntax rows `:216-217`, 3 validator rows `:265-266`, `:279`, 6 + 8 option rows `:314-315`, `:327-328` | Pi `dist/core/resolve-config-value.js` (`resolveConfigValueOrThrow`) and `validateMcpServerConfig`, by absolute file URL (Pi exports neither) | a few env/option values and an unset url variable; not the table through Pi's resolver, the PI-1/PI-2 cases, or the same-JSON validator check (no reconnect, P2-DC-08) |
| mcp-status-conformance | `:80`, `:140`, `:179` (drift guard on `dist/types.d.ts`) | adapter `dist/types.js` constants and the real Pi event bus (`createEventBus`) | ASTAT-01 is in `mcp-server/companion-missing.feature` and `project-scope.feature:179`; not the ASTAT-02 shutdown snapshot or the channel/version/status-union drift guard |
| provenance-invisibility | `:41`, `:159`, 4 block headers `:193-194`, 4 one-line descriptions `:220-226`, `:253` | pi-subagents `src/agents/frontmatter.js` | a description block and quoted values; not injected `name:`/`---` lines, `|`/`|-`/`>`/`>-`, `#1 and #2`, `@reviewer`, a colon in a name or alias |
| skill-path-resolution | `:50` | pi-subagents `src/agents/skills.js` (`resolveSkillsWithFallback`, `discoverAvailableSkills`) | resolution is in `agent/invocation.feature`; not "stays out of the global catalog" |
| workflow-engine-agent-registry | `:75`, 4 descriptions `:90-96`, `:108`, 8 provenance values `:123-133`, 3 source names `:145-146` | engine `dist/agent-registry.js` | three values in `workflow/agent-steps.feature`; not the other descriptions, a lone CR, the provenance values, or the source names `'reader`, `@reader`, `Reviewer: code` |
| pi-subagents-child-launch-conformance | `:142`, `:169`, `:200`, `:247`, `:304`, `:317`, `:330`, `:351`, `:367`, `:391`, `:410` | pi-subagents `src/runs/shared/child-launch.js`, the allowlist, `src/agents/agents.js`, model resolution | fan-out, inherit model, and a short MCP grant run in real children; not ambient adapter tools for unrestricted and exclusion-only runners, suppression by a read / empty list / read-only ceiling, `MCP_DIRECT_TOOLS` ownership, the exclude name removing a tool |
| hooks-result-boundary | `:56`, `:101`, `:128`, `:153`, `:185`, `:202` | Pi `dist/core/extensions/runner.js` `ExtensionRunner.emitToolResult` [VERIFIED: read `:1-229`] | `hook/tool-use.feature` covers redaction and replacement as the model sees it; not what a later Pi handler reads, `structuredContent`/`isError` on block feedback, or the echoed file result as a no-op |

### RACE cases: keep

| File:line | Case | Evidence |
|---|---|---|
| concurrent-install `:206` | D-15 same-plugin race leaves one record, no orphan skills | two `fork()`ed `concurrent-install-child.ts`; `assertOneWinner` (`:177-186`) wants one ok and one "Another pi-claude-marketplace operation is in progress"; `plugin/state-lock.feature` only holds a lock |
| concurrent-install `:221` | D-15 different-plugin same-scope race records exactly one plugin | same harness |
| load-reconcile-race `:276` | RECON-06 two concurrent `applyReconcile` children | two forks of `load-reconcile-race-child.ts` |
| load-reconcile-race `:411` | concurrent first-load migration serializes | two forks; MIG-01 trichotomy under the lock |
| subagent-hook-ownership `:232` | a main load stops the waiting hook of a child whose Pi died and keeps a live sibling's | three real Pi processes; no scenario kills a child Pi beside a live sibling (`hook/async.feature:369`, `:391`, `:497` kill a main Pi only) [VERIFIED: grep `died\|crash\|dead` in `features/*/*.feature`] |

Note on the word "race": `subagent-hook-ownership:232` is a hand-off between live and dead processes, not two writers racing. It is still "something cucumber cannot reach" in the multi-process sense. The charter should say "a race or a hand-off between processes" so the class matches the case (see Charter text). This is a wording choice, not a scope change.

### Internal cases already trimmed and labeled by Phases 2-7: keep

| File:line | Case | Class | Evidence (header and phase SUMMARY) |
|---|---|---|---|
| auth-e2e `:150` | a staging cleanup failure keeps the print refusal as the primary cause | INT-fault | `fs.rm` made to fail; header `:1-13`; Phase 6 06-02 |
| hooks-dispatch-end-to-end `:172` | a throwing lazy project hydrate never blocks SessionStart dispatch | INT-fault | ctx without `cwd`; header `:1-13`; Phase 6 06-01. No unit case in `test/bridges/hooks/{index,event-router}.test.ts` covers it [VERIFIED: grep]. |
| marketplace-layer-remove `:211`, `:369`, `:473` | partial remove, failure-only remove, PRUNE-03 | INT-fault | EACCES injected through the remove's `cascade` seam; header `:1-10`; Phase 3 03-02 |
| mcp-migration `:113` | a refused write between the two writes loses no server | INT-fault | read-only directory; header `:1-8`; Phase 5 |
| mcp-verdict-list `:58` | an install stores the neutral verdict and its basis | INT-field | reads `compatibilityBasis`; no step reads it (audit Group B) |
| mcp-verdict-list `:98` | list rows per implementation, and list writes nothing | INT-absent | state.json bytes compared; rows for adapter/builtin are also in `mcp-server/verdict-list.feature:18`, `:43` |
| mcp-verdict-migration `:120`, `:152`, `:202` | the load's move over a released-build record | INT-earlier | `stripReleasedFields` deletes `compatibilityBasis` and `mcpServerConfigs` (`:57-71`); see the overclaim fix |
| path-source-tag-install `:125`, `:322` | CR-01 untracked file kept out; D-07-04 marketplace `.git` untouched | INT-field / INT-absent | header `:1-16`; Phase 7 07-01 |
| plugin-layer-verbs `:154`, `:186` | LAYER-06 with an unknown recorded source kind | INT-fault (a tampered record no command writes) | header `:1-10`; Phase 2 |
| standalone-prune `:167`, `:200` | prune runs neither seam and makes no recorded git call | INT-absent | `registeredCommand` throws on `applyReconcile`/`installMissingDependencies` (`:150-155`); see the overclaim fix |

### Internal cases in the untouched files: keep

| File:line | Case | Class | Evidence |
|---|---|---|---|
| mcp-server-records `:168` | install records every declared server in merge order, unexpanded, blocked one included | INT-field | asserts `record.mcpServerConfigs` from saved state.json |
| mcp-server-records `:216` | update records the new version's servers | INT-field | same |
| mcp-server-records `:240` | enabling a disabled plugin fills servers on a record that lacked them | INT-field + INT-earlier | record without `mcpServerConfigs` = a pre-MREC-01 record |
| mcp-server-records `:265` | disabled update records servers without enabling | INT-field | same |
| mcp-server-records `:296` | reinstall fills servers on a record that lacked them | INT-field + INT-earlier | same |
| mcp-server-records `:319` | import that installs records its servers | INT-field | same |
| mcp-verdict-update `:111`, `:148`, `:171`, `:209` | update, reinstall of a legacy record, failed update's intent mark, disabled update (and a byte-identical repeat) store the neutral basis | INT-field (+ INT-earlier `:148`, INT-absent `:209`) | header `:1-5`; reads `compatibilityBasis` |
| marketplace-add-seed-mirrors `:155`, `:202`, `:253`, `:299`, `:357`, `:396` | mirror seeded from the one marketplace clone; path marketplace seeds with no git call; other repo stays remote; reachable pin seeds, unreachable does not; mirror keeps the real remote url; GC sweeps an unreferenced mirror | INT-field (`plugin-clones/` contents) + INT-absent (git and credential calls) | no command lists `plugin-clones/`; the user-visible outcome is in `marketplace/url-source.feature:202` (no git request after the add) and `:225` (available right after the add); the seeder alone is unit-tested (`test/orchestrators/plugin/clone-cache.test.ts:1724-2083`, SEED-01..04, D-SEED-01). These six pin the wiring from `addMarketplace` (`orchestrators/marketplace/add.ts:1236-1247`) to the seeder. Phase 3 (03-03 SUMMARY) kept them as internal. |
| workflow-kind-inversion `:288` | RECON-05: two applies leave the envelope and state.json unwritten | INT-absent | backdated mtimes compared (`:245-283`) |
| workflow-kind-inversion `:348` | a record whose supported set grew gets its envelope rewritten | INT-earlier | record rewritten to `unsupported: ["workflows"]`, as a release without workflow support wrote it |
| workflow-kind-inversion `:423` | WCONV-01/02: a record from a build where the kind was invisible: load leaves it, one apply converges, next apply writes nothing | INT-earlier + INT-absent | `fileSnapshot` bytes/inode/mtimeNs |

`marketplace-add-seed-mirrors` could also move into `test/orchestrators/marketplace/add.test.ts`, since it uses only fakes and real files. It fits INT-field / INT-absent, so it may stay. Recommendation: keep it, as Phase 3 decided. A move would duplicate the SEED units, and its six cases are the only check that `addMarketplace` reaches the seeder.

### Cases that leave

#### `reconcile-plan-convergence` (10 cases, pure in-memory): 8 move, 2 delete, file goes

All ten call only `buildConfigFromState` (`persistence/migrate-config.ts`), `mergeScopeConfigs` (`persistence/config-merge.ts`), and `planReconcile` (`orchestrators/reconcile/plan.ts`) on literals [VERIFIED: read `:1-593`]. None fits an ITSCOPE-01 class. `plan.test.ts` already imports `mergeScopeConfigs` through its `mergedConfig` helper (`test/orchestrators/reconcile/plan.test.ts:47-64`) and asserts with `emptyReconcilePlan` (`:1635`, `:1933`), so the moved cases follow its existing idiom and need no new import.

| Integration case (line) | Action | Destination or covering case | Break that must fail the cover (run this session) |
|---|---|---|---|
| `:139` migrates populated state to the declared config | **delete as covered** | `test/persistence/migrate-config.test.ts:167` "projects complete marketplaces, plugins, legacy flags, and nullish sources" (two marketplaces, an `installable: false` record) | **B1** `persistence/migrate-config.ts` `basePluginEntries`: return `[]` when `!record.compatibility.installable`. Result: `migrate-config.test.ts` `✖ projects complete marketplaces, plugins, legacy flags, and nullish sources`, `ℹ fail 1` [VERIFIED: run] |
| `:151` + `:175` converge populated state, project and user scope | **move** (one `for` over the two scopes, 2 sibling `test()`s) | `plan.test.ts`, inside `describe("planReconcile")`: "plans nothing in the ${scope} scope for a config that declares every recorded marketplace and plugin, a non-installable record included" | — (moved) |
| `:199` a distinct declared alias resolves to the canonical recorded marketplace (plugin recorded, empty plan) | **move** | `plan.test.ts`: "plans nothing for a declared alias whose plugin the canonical recorded marketplace holds". `plan.test.ts:146` has the alias only with no record (an install), so this is not a duplicate | — |
| `:324` D-09-16 missing key plans the bucket; recorded dependency plans nothing | **delete as covered** | unsatisfied arm: `plan.test.ts:1053` "MISS-01: buckets a missing declared dependency once, with its declarer's ranges" and `:1001`; satisfied arm (an undeclared `provenance: "dependency"` record is kept): `plan.test.ts:877` "D-04-05: keeps an undeclared record whose provenance is dependency" | **B2** `orchestrators/reconcile/plan.ts:602` `record.provenance === "dependency"` → `=== "never"`: `✖ D-04-05: keeps an undeclared record whose provenance is dependency` plus 3 more D-04-05 cases [VERIFIED: run]. **B3** `plan.ts:1070` `pluginsToDependencyInstall: pluginDiff.dependencyInstall` → `[]`: `✖ MISS-01: buckets a missing declared dependency once, with its declarer's ranges` and 9 more [VERIFIED: run] |
| `:385` D-09-14 an unsatisfied declaration re-plans the same bucket entry | **move** | `plan.test.ts`: "D-09-14: the same unsatisfied declaration plans the same dependency install again". `:492` repeats only an enable plan, so the dependency bucket's re-plan has no unit case of the planner (the apply pair has `apply.test.ts:5367`) | — |
| `:468` FIX-02 migration leaves out local declarations; merged view converges | **move** the plan half; the projection half is covered | plan half → `plan.test.ts`: "FIX-02: a base layer without the local declarations and the local layer plan nothing for their records". Projection half is `migrate-config.test.ts:311` and `:327` (the `FIX-02:` cases) | — |
| `:490` LAYER-01 both layers declare a marketplace with its recorded source | **move** | `plan.test.ts`: "LAYER-01: a marketplace both layers declare with its recorded source plans nothing" | — |
| `:562` LAYER-09 disabled record, base `false`, local without `enabled` | **move** | `plan.test.ts`: "LAYER-09: a disabled record under a base enabled false and a local entry without enabled plans nothing" | — |
| `:573` LAYER-09 enabled record → plans a disable | **move** | `plan.test.ts`: "LAYER-09: an enabled record under a base enabled false and a local entry without enabled plans a disable" | — |

Count: 8 integration cases move (`:151`, `:175`, `:199`, `:385`, `:468`, `:490`, `:562`, `:573`; `:151`/`:175` become one data-driven pair) and produce 8 new sibling `test()`s in `plan.test.ts`; the projection half of `:468` is left to `migrate-config.test.ts:311`/`:327`. 2 cases delete as covered (`:139`, `:324`). The draft is in Code Examples and was run: `plan.test.ts` 71/71 pass (63 before + 8), ESLint `--max-warnings 0` clean, `node scripts/test-coverage-direct.mjs test/orchestrators/reconcile/plan.test.ts` → `plan.ts | 100.00 | 100.00 | 100.00`, "branches 180/180, functions 31/31, lines 1073/1073" [VERIFIED: run in a scratch worktree, then removed]. The moves also fail on B2 (the new FIX-02 case) and B3 (the new D-09-14 case) [VERIFIED: run].

#### `load-reconcile-race:494` (D-13 single-process): delete as covered

- Cover: `features/plugin/config-migration.feature:248` "The first load after an upgrade from release 0.4.3 writes the project config with autoupdate off". Its Given rewrites the record as release 0.4.3 wrote it (`features/step_definitions/plugin/installation.steps.ts:424-436`: `schemaVersion` 1, no config file), and its Then (`:259-261`) wants `autoupdate | false` in `claude-plugins.json`. The integration case asserts the same: config written, `autoupdate: false` captured before the `loadState` scrub. The user-scope twin is `:10` (`autoupdate | true`).
- Break: `persistence/migrate-config.ts:178-180`, delete the `else if (legacyAutoupdate === false) { entry.autoupdate = false; }` arm. Expected red: `config-migration.feature:248` on its "declares these marketplaces" Then. (The `migrate-config.test.ts:167` unit case is likely to fail too; the break must be seen to fail the scenario.) [ASSUMED: the scenario failure was not run in this research; the planner runs it under the lock.]
- After the deletion, the header bullet at `:25-26` ("D-13 gate single-process happy path…") goes, and the `Scenario C` divider (`:490-492`) goes with it. Check `seedStateRaw`, `readConfigRaw`, and `existsSync`, which `:411` still uses; `tsc --noEmit` (`noUnusedLocals`) catches anything left.

#### `subagent-hook-ownership:175` (test 1): delete as covered

- Cover: `features/plugin/subagent-child.feature:364` "Loading and stopping a child leaves parent and sibling hooks running". Its When step (`features/step_definitions/plugin/subagent-hooks.steps.ts:505-523`) runs the same `session.runChildStages` and asserts `stages` deep-equal to every stage with `{ hook, running: true, record: "kept" }`, which is the integration case's per-stage journal and process check. The Thens then want the child hook's start/end, `parent-wait` and `sibling-wait` still running, and after the release both ending with code 0 (`:388-403`).
- Left over: the integration case's final check that the parent's journal reads `{ version: 1, entries: [] }` after its own release (`:228-231`). That is the parent's own clean-up, not ownership, and `test/bridges/hooks/async-rewake/registry.test.ts` owns the journal format. Accept it as covered there, or keep the one assertion by moving nothing. Recommendation: delete.
- Break: make a child's load treat every journal as its own (or reap the main PID table) in `bridges/hooks/async-rewake/registry.ts`. Expected red: the When step's `assert.deepStrictEqual(stages, …)` at `subagent-hooks.steps.ts:518`, reported as `  N) Loading and stopping a child leaves parent and sibling hooks running # features/plugin/subagent-child.feature:364`. **Do the break only after Phase 6.1 merges**, and pick a line outside the files 6.1 changed (6.1 does not list `async-rewake/registry.ts`). [ASSUMED: not run here.]
- Trim after deletion: `STAGES` (`:72`) and the `{ reply: "Parent done." }` step become unused, and `parent-wait` in `WAITING_HOOKS` stays harmless. The header loses the first-case sentences.

#### `workflow-kind-inversion:171` (test 1, WINV-02 / WBRG-01): delete as covered

- Cover: `features/workflow/storage.feature:18` "Installing a plugin into the project saves its workflow in the project and nothing in the user's workflow directory" (result row `installed`, empty `reasons`, saved file `demo:hello.json`, nothing in the user's workflow directory), and `:31` "A new session offers the workflow of a project install and runs it" (the saved script runs, so its text arrived intact). The integration case's extra record reads (`supported` has `workflows`, `resources.workflows`) are internal detail that the two scenarios fail on anyway when the kind is not admitted.
- Breaks: (a) the resolver records `workflows` unsupported → `storage.feature:18` fails on the results table (status/reasons); (b) the bridge writes the envelope with a changed `script` → `storage.feature:31` fails when the run is checked. [ASSUMED: not run here.]
- Doc pointer to fix in the same plan: `docs/output-catalog.md:695` says "The workflow-specific half of that claim is enforced by `test/integration/workflow-kind-inversion.test.ts`". Proposed: "The workflow-specific half of that claim is enforced by the scenario "Installing a plugin into the project saves its workflow in the project and nothing in the user's workflow directory" in `features/workflow/storage.feature`, whose result row is `installed` with no reason, not by this block's byte pairing."
- The file comment block at `:33-41` describes only this case and goes; the new header goes at the top (`// test/integration/workflow-kind-inversion.test.ts`).

#### `transaction-lifecycle-cascade:134` (LIFE-01 / LIFE-02, the only case): delete, file goes

- The case chains install → update → reinstall (after corrupting the saved `hooks/<plugin>/hooks.json`) → uninstall and checks the saved file and the install/uninstall rows.
- Every step already has a unit case in its pair: reinstall of a corrupted saved file is `test/orchestrators/plugin/reinstall-flow.test.ts:4275` "LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json from the resolved manifest" (it corrupts the file with `{ corrupted: true }` first, exactly as the integration case does, `:4299-4302`); update is `update-flow.test.ts:8197` "LIFE-01 (update): version A->B (both ship hooks) overwrites <hooksDir>/<plugin>/hooks.json…"; uninstall is `uninstall.test.ts:3956` "LIFE-04: manifest-absent uninstall removes the staged hooks config" and the `unstage:hooks` cases (`:4116-4151`); install is `install-outcome.test.ts:1901` (LIFE-01). What a user sees: `features/hook/lifecycle.feature:52` "Updating a plugin replaces its hooks", `:42` "Uninstalling a plugin stops its hooks", and the install rows with the reload hint in every install scenario.
- Breaks: B7, skipping the `writeHookConfig` call in `update-swap.ts` `commitUpdateHooks` (shared by update and reinstall), turned `reinstall-flow.test.ts:4275` and two `update-flow.test.ts` LIFE-01 cases red [VERIFIED: run]; `lifecycle.feature:52` is expected red too. B7c: uninstall leaves `hooks/<plugin>/` → `lifecycle.feature:42` [ASSUMED: not run]. (A draft unit case for the reinstall repair was written first and passed, which is how `:4275` was found to exist already; it is not needed.)
- No helper or doc references the file [VERIFIED: `git grep -n transaction-lifecycle-cascade -- . ':(exclude).planning'` prints only the file itself].

### Helper modules after the moves

| Helper | Importers after Phase 8 | Verdict |
|---|---|---|
| `concurrent-install-child.ts` | `concurrent-install.test.ts:53` (fork path) | stays |
| `ipc-child.ts` | `concurrent-install-child.ts:10`, `load-reconcile-race-child.ts:25` | stays |
| `load-reconcile-race-child.ts` | `load-reconcile-race.test.ts:64` (fork path; the two race cases still fork it) | stays |
| `mcp-plugin-seed.ts` | `mcp-adapter-entry-conformance`, `mcp-migration`, `mcp-server-records`, `mcp-status-conformance`, `mcp-verdict-list`, `mcp-verdict-migration`, `mcp-verdict-update` | stays |
| `optional-peer.ts` | `agents-adapter-grant`, `agents-builtin-grant`, `pi-subagents-child-launch`, `workflow-engine-agent-registry`, `pi-mcp-adapter-peer.ts`, `pi-subagents-peer.ts` (type import in `adapter-expansion`) | stays |
| `optional-peer-suite-versions.json` | `optional-peer.ts:94`, `scripts/install-test-peers.mjs:39`, `features/lib/companions.ts:41`, `test/architecture/gate-targets.ts:37`, `scripts/pi.sh:111` (comment) | stays (build input for the cucumber suite too) |
| `pi-mcp-adapter-peer.ts` | `adapter-expansion`, `adapter-tool-name`, `mcp-adapter-entry`, `mcp-status` | stays |
| `pi-subagents-peer.ts` | `provenance-invisibility`, `skill-path-resolution` | stays |
| `test/bridges/mcp/expansion-cases.ts` | `adapter-expansion-conformance`, `mcp-builtin-encoding-conformance`, and also `test/bridges/mcp/substitute.test.ts:12` | stays (the audit's "used only by the integration tests" is out of date) |

[VERIFIED: `git grep -n -- <helper> -- . ':(exclude).planning'` for each.] The deleted files and cases import no helper of their own: `reconcile-plan-convergence` imports only production modules, `transaction-lifecycle-cascade` imports production modules plus `test/platform/hermetic-environment.ts` and `test/shared/notification-run-seeds.ts`, which many other tests import.

## Header Text (ITSCOPE-02)

**Form.** Copy the trimmed files (`test/integration/auth-e2e.test.ts:1-13`, `hooks-dispatch-end-to-end.test.ts:1-13`, `path-source-tag-install.test.ts:1-16`): a `// test/integration/<file>.test.ts` line, a `//` line, then prose that (1) states the class with the words of ITSCOPE-01 followed by `(ITSCOPE-01)`, (2) says what the cases check, and (3) says what cucumber does not cover and where the user-visible part is. Put `(ITSCOPE-01)` in every header, so the final gate can check it mechanically (see Validation Architecture). Keep any existing technical paragraph that is still true (peer loading, environment handling, timeouts). Durable IDs only, no phase numbers. Write it in plain English (`simple-english`).

**Already right (5, no change):** `auth-e2e`, `hooks-dispatch-end-to-end`, `mcp-migration`, `mcp-verdict-list`, `path-source-tag-install`. Each already says "kept as … (ITSCOPE-01)", what it checks, and where cucumber covers the rest [VERIFIED: read `:1-16` of each].

### New headers (7 files)

`concurrent-install.test.ts` (no comment today; insert above the imports):

```ts
// test/integration/concurrent-install.test.ts
//
// Two multi-process races (ITSCOPE-01). Two forked processes run
// concurrent-install-child.ts and install into one project scope at the same
// moment, the same plugin or two different ones. The state lock (D-15) lets one
// install win and refuses the other: the scope records exactly one plugin, and
// the skills on disk are exactly the winner's, so the loser leaves no orphan. A
// scenario runs one Pi at a time, so `features/plugin/state-lock.feature` can
// hold the lock but cannot race two installs.
```

`hooks-result-boundary.test.ts` (no comment today):

```ts
// test/integration/hooks-result-boundary.test.ts
//
// Peer conformance (ITSCOPE-01) against Pi's own `ExtensionRunner` from the
// installed `@earendil-works/pi-coding-agent`. Each case puts the patch that
// `adaptToolResultResult` returns for a PostToolUse hook into Pi's real
// `emitToolResult` and reads what Pi returns and what a later handler gets
// (D-PG2-06). A replacement clears the stale `details`, `structuredContent`,
// and image blocks; block feedback keeps `structuredContent` and `isError`; an
// echoed file result changes nothing. The scenarios of
// `features/hook/tool-use.feature` see only what the model gets, not what a
// later Pi handler reads.
```

`marketplace-add-seed-mirrors.test.ts` (no comment today):

```ts
// test/integration/marketplace-add-seed-mirrors.test.ts
//
// Six internal cases (ITSCOPE-01) of the mirror seeding that follows
// `marketplace add` (D-SEED-01). The real `addMarketplace` runs against a local
// git checkout through the git double, and each case reads `plugin-clones/`
// and the recorded git and credential calls: a same-repository plugin gets its
// mirror from the one marketplace clone, a path marketplace seeds with no git
// call, a plugin from another repository stays unseeded, a reachable pin seeds
// and an unreachable one does not, the mirror keeps the real remote url, and
// clone garbage collection removes a mirror that nothing uses. No command
// lists `plugin-clones/`. What a user sees is in
// `features/marketplace/url-source.feature`: the plugin is available right
// after the add, and its install makes no git request.
```

`pi-subagents-child-launch-conformance.test.ts` (no comment today):

```ts
// test/integration/pi-subagents-child-launch-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against pi-subagents' own launch planner,
// `src/runs/shared/child-launch.js`, with its MCP allowlist and agent
// discovery, in place from the suite version in the optional peer cache
// (D-PG1-02). Each case writes an agent with `convertAgent` and asks the
// planner which tools and model the child gets: ambient adapter tools for an
// unrestricted or exclusion-only runner, none after an explicit read, an
// empty list, or a read-only ceiling; a short MCP grant selects its tool, and
// an exclude name removes one (PG-AGENT-09); the Agent grant keys allow
// fan-out or none (PG-AGENT-03); an inherit model runs on the parent's model
// (PG-AGENT-07a, D-PG7-17). The scenarios launch a few real children
// (`features/agent/frontmatter.feature`, `features/plugin/subagent-child.feature`);
// the other launch plans need pi-subagents' own planner.
```

`mcp-server-records.test.ts` (replace `:1-5`):

```ts
// test/integration/mcp-server-records.test.ts
//
// Six internal cases (ITSCOPE-01) of a stored record field (MREC-01, D-MB-04).
// The install record's `mcpServerConfigs` keeps every declared MCP server that
// is not malformed, in its Claude form, in D-CF6-01 merge order, before
// plugin-variable substitution, the servers pi-mcp-adapter blocks included.
// Each case runs the real install, update, enable, disabled update,
// reinstall, or import in a hermetic home and reads the saved state.json, so a
// path that skips the record producer fails. The enable and reinstall cases
// start from a record that an earlier release wrote without the field. No
// command shows the field.
```

`mcp-verdict-update.test.ts` (replace `:1-5`):

```ts
// test/integration/mcp-verdict-update.test.ts
//
// Four internal cases (ITSCOPE-01) of a stored record field (D-P3-02,
// MREC-03). Each case runs the real update, reinstall, or disabled update in a
// hermetic home and reads the saved state.json: the swap's final write stores
// the neutral MCP verdict with `compatibilityBasis: "neutral"`, a reinstall of
// a record an earlier release wrote does the same, a failed update keeps the
// basis that its intent mark carries, and a repeated disabled update writes
// nothing. No command shows `compatibilityBasis`; the update rows a user sees
// are in `features/mcp-server/verdict-update.feature`.
```

`workflow-kind-inversion.test.ts` (top of file; remove the `:33-41` block that described the deleted case):

```ts
// test/integration/workflow-kind-inversion.test.ts
//
// Three internal cases (ITSCOPE-01) of the reconcile over a plugin with a
// workflow. RECON-05: two applies over a declared, enabled, recorded plugin
// write neither its saved workflow nor state.json (writes that must not
// happen, read from backdated modification times). D-10: a record that a
// release without workflow support wrote, whose supported set has grown, gets
// its saved workflow written again. WCONV-01 / WCONV-02: a record from a build
// in which the workflows kind was invisible is left alone by a load, brought up
// to date by one apply, and left alone by the next apply. What a user sees of
// the install and the saved workflow is in `features/workflow/storage.feature`.
```

### Rewrites after a trim (2 files; written by the plan that deletes the case)

`load-reconcile-race.test.ts` `:1-6` and the bullet `:25-26`: replace the first paragraph with "Two multi-process races (ITSCOPE-01), each between two forked processes that run load-reconcile-race-child.ts: RECON-06, two concurrent applies of one declared path-source marketplace and plugin, and the first-run migration (MIG-01, D-13) of two concurrent first loads. A scenario runs one Pi at a time. The single-process first load after an upgrade is in `features/plugin/config-migration.feature`." Keep the "Test design constraint" block (`:7-24`) without the D-13 bullet, and keep `:28-30`.

`subagent-hook-ownership.test.ts` `:3-13`: "One multi-process case (ITSCOPE-01) of the process ownership of async hooks (D-PG3-09). A main Pi, a pi-subagents background child, and a live sibling child each run as a real Pi process in RPC mode with the real extension, the scripted model, and a plugin installed through `/claude:plugin`, whose waiting script hooks stand in for slow async rewake hooks. When the child's Pi dies, the next main load stops the child's waiting hook, because the hook process carries the dispatch marker that the dead child's journal names, and it leaves the live sibling's hook and journal alone. No scenario kills a child's Pi while a sibling runs. A child that loads and stops while other hooks wait is in "Loading and stopping a child leaves parent and sibling hooks running" (`features/plugin/subagent-child.feature`)." Keep `:15-18` (timeouts and release).

### Overclaims carried from Phases 4 and 5 (2 files)

**`standalone-prune.test.ts` (Phase 4 IN-03).** The header says the cases prove "no git call", but `:156-157` and `:190-191` assert only `gitCalls.clone` and `gitCalls.fetch`. The git double (`test/platform/git-ops-fake.ts`) records seven operations (`clone`, `fetch`, `forceUpdateRef`, `checkout`, `resolveRef`, `currentBranch`, `resolveRemoteRef`, `:119-230`) and serves `listRemotes` without recording it (`:253-256`) [VERIFIED: read]. Fix both sides:

- Assertion: replace each pair of lines with one whole-object check (run green this session, 2/2 [VERIFIED]):

```ts
    assert.deepStrictEqual(gitCalls, {
      checkout: [],
      clone: [],
      currentBranch: [],
      fetch: [],
      forceUpdateRef: [],
      resolveRef: [],
      resolveRemoteRef: [],
    });
```

- Header `:5-7`: "…and a git double records every git operation it serves except `listRemotes`, so the actual prune and the `--dry-run` preview each prove that prune runs neither seam and makes none of those git calls."

**`mcp-verdict-migration.test.ts` (Phase 5).** The header `:11-15` says the cases "pin user-visible text that no scenario shows yet". Rechecked: the move itself is in scenarios that compare result fields, not text (`features/mcp-server/legacy-move.feature:968` "A load removes the entry of a server the plugin no longer declares and of one it cannot run, and moves the rest (AMIG-01, MREC-02)"), and the row grammar is unit-tested (`test/shared/notification-mcp.test.ts` holds "pi-mcp-adapter cannot run it" [VERIFIED: grep]). No scenario lists a release 0.19.2 record whose catalog moved to a version with an sse server under Pi's built-in MCP; `verdict-list.feature:362` lists one whose catalog did not move. Replace `:11-15` with: "The first two cases also compare the whole rendered text of the move notice, and the third the whole `list` text, including the row `(partially-upgradable) {unsupported mcp}` of a record whose catalog moved. The scenarios compare result fields, not rendered text: the move is in `features/mcp-server/legacy-move.feature`, and the other list rows a user sees after the move are in `features/mcp-server/verdict-list.feature`." This states what the cases assert and keeps them (class INT-earlier). Moving the third row into a scenario is possible with existing steps but not needed for ITSCOPE-01 (see Open Questions).

### Class sentence for headers that only describe their checks (12 files)

Add one sentence at the start of the prose, and one "cucumber does not cover" sentence at the end of the first paragraph. The second sentence comes from the PEER table above ("What cucumber does not cover"). Example for `adapter-tool-name-conformance.test.ts`:

```ts
// test/integration/adapter-tool-name-conformance.test.ts
//
// Peer conformance (ITSCOPE-01) against pi-mcp-adapter's own code. PG-MCP-02,
// D-PG1-09: compare this extension's adapter tool names with pi-mcp-adapter's
// own formatToolName, including length and encoding edges. The scenarios hold
// one cut server segment (`features/mcp-server/listing.feature`) and one name
// of exactly 64 characters (`features/hook/mcp-tool-names.feature`); the other
// edges and the drift guard are only here.
```

| File | Class sentence to add | Where |
|---|---|---|
| adapter-expansion-conformance | "Peer conformance (ITSCOPE-01) against pi-mcp-adapter's own expansion code." | before `:3` |
| adapter-tool-name-conformance | as the example | `:3` |
| agents-adapter-grant-conformance | "Peer conformance (ITSCOPE-01) against pi-subagents' own grant resolver and pi-mcp-adapter's tool names; it pins a pi-subagents capability gap (AGTLONGNAME-01). `features/mcp-server/agent-grants.feature` covers only the exclude side." | `:3-4` |
| agents-builtin-grant-conformance | "Peer conformance (ITSCOPE-01) against pi-subagents' own selector resolver." + "`features/agent/frontmatter.feature` resolves one per-tool grant in a real child." | `:3` |
| mcp-adapter-entry-conformance | "Peer conformance (ITSCOPE-01) against pi-mcp-adapter's config loader and OAuth check." + the clean header is also in `features/mcp-server/configuration.feature` | `:3` |
| mcp-builtin-encoding-conformance | "Peer conformance (ITSCOPE-01) against Pi's own resolver and validator." + "The scenarios hold a few env and option values." | `:3` |
| mcp-status-conformance | "Peer conformance (ITSCOPE-01) against pi-mcp-adapter's status contract." + "ASTAT-01 is also in `features/mcp-server/companion-missing.feature` and `project-scope.feature`." | `:3` |
| provenance-invisibility | "Peer conformance (ITSCOPE-01) against pi-subagents' own frontmatter parser." | `:3` |
| skill-path-resolution | "Peer conformance (ITSCOPE-01) against pi-subagents' own skill resolver." + "Resolution is also in `features/agent/invocation.feature`; the catalog check is only here." | `:3` |
| workflow-engine-agent-registry | "Peer conformance (ITSCOPE-01) against the workflow engine's own agent registry." + "Three of the values are in `features/workflow/agent-steps.feature`." | `:3` |
| plugin-layer-verbs | "Two internal cases (ITSCOPE-01) of fault injection: each rewrites the recorded marketplace source to a kind this release does not know…" (replaces the last sentence `:9-10`) + "The LAYER-04 refusals and the LAYER-08 cases a user sees are in `features/plugin/*.feature`." | `:3`, `:9-10` |
| marketplace-layer-remove | "Three internal cases (ITSCOPE-01) of fault injection." (before "Removing a marketplace…") + "What a user sees of a remove is in `features/marketplace/remove.feature`." | `:3` |

Confidence for the "cucumber does not cover" sentences of the PEER files is MEDIUM: they restate the milestone audit (`.planning/research/INTEGRATION-OVERLAP.md`, Group A), which read code and ran nothing. They claim only what the scenarios hold, never that a row is unique, so a wrong sentence overstates nothing.

## Doc Claims (Phase 1 IN-02 / IN-03, plus one pointer the deletions break)

**IN-02, `docs/mcp-compatibility.md:770`.** Claim: "An `openUi: false` default makes pi-subagents 0.88.1 read the tool cache of the adapter as stale, because its `computeMcpServerHash` leaves out `openUi`. An agent with a plugin MCP grant then does not launch." Read this session in the installed peers: pi-mcp-adapter's `computeServerHash` adds `openUi: false` to the hashed identity (`node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/dist/metadata-cache.js:117-150`, the line `...(definition.openUi === false ? { openUi: false } : {})`), and pi-subagents 0.88.1's `computeMcpServerHash` builds its identity without `openUi` (`…/pi-subagents/src/runs/shared/mcp-direct-tool-allowlist.js:381-411`), and `isServerCacheValid` compares the two hashes (`:374-379`) [VERIFIED: read]. So the first sentence is right, and it is a source read. The second sentence is an inference from the same source: nothing ran `openUi: false`. Verdict: true as far as it goes, but not shown by a test, so mark it. Proposed text for the two sentences:

> An `openUi: false` default would make pi-subagents 0.88.1 read the adapter's tool cache as stale: pi-mcp-adapter 7.0.1 hashes `openUi: false` into a server's cache key, and pi-subagents' `computeMcpServerHash` leaves it out, so the two keys differ (read in source, `dist/metadata-cache.js` and `src/runs/shared/mcp-direct-tool-allowlist.js`). By the same source, an agent with a plugin MCP grant then does not launch. No test runs `openUi: false`.

Keep the sentence after it, which cites the scenarios for the positive case.

**IN-03, `docs/hooks-compatibility.md:77`.** Claim (end of the Evidence paragraph): "…one of them launched as a fork, whose prompt pi-subagents leaves without its appended boundary." Read this session: `registerSubagentPromptBoundary` returns before it hooks `before_agent_start` when `config.forkCacheKey` is set, and its comment says the fork's boundary "goes in its task message instead (see projectForkRequest)" (`…/pi-subagents/src/runs/shared/subagent-prompt-runtime.js:232-245`) [VERIFIED: read]. The scenario row is `features/plugin/subagent-child.feature:621-623` (`fork cache key | pg3-fork`), and no step reads the prompt. Verdict: right about the system prompt, silent about where the boundary goes, and not observed. Proposed:

> …one of them launched as a fork. pi-subagents 0.88.1 appends no boundary to a fork's system prompt and puts it in the fork's task message (read in source, `registerSubagentPromptBoundary`); no step reads the prompt.

`docs/hooks-compatibility.md` belongs to Phase 6.1 until it merges. Make this edit after the merge, and find the sentence by its text, since 6.1 changes the file and the line can move.

**New: `docs/output-catalog.md:695`.** After `workflow-kind-inversion:171` goes, the sentence "The workflow-specific half of that claim is enforced by `test/integration/workflow-kind-inversion.test.ts`" points at a case that no longer exists. Replace with the wording in the case map. `docs/output-catalog.md` is a build input (the `ci.yml` `build_inputs` list, `:22`), and ten `test/architecture/` tests read it (`catalog-uat/*`, `*-notice*.test.ts`); a prose line outside a catalog block should not change them, but run `npm run test:unpaired` after the edit.

**Doc links that stay valid:** `docs/hooks-compatibility.md:27` links `hooks-result-boundary.test.ts` and `:85` links `subagent-hook-ownership.test.ts`; both files stay. `docs/mcp-compatibility.md:762` names `agents-adapter-grant-conformance.test.ts`; it stays. No doc names `reconcile-plan-convergence` or `transaction-lifecycle-cascade` [VERIFIED: `git grep`].

## Charter Text (ITSCOPE-03)

One rule, the same words in all three places. Plain English, short. Proposed text:

```markdown
## Where a test goes

- Behavior that a user can see is a cucumber scenario under `features/`.
- The behavior of one source module is a unit test in that module's pair under `test/`.
- A case goes in `test/integration/` only when neither of those can reach what it checks. It must be one of these:
  - **Peer conformance:** it runs a peer's own code (Pi, pi-mcp-adapter, pi-subagents, or the workflow engine) on what this extension writes.
  - **Multi-process:** two or more processes race, or one process acts on what another process left behind.
  - **Internal:** a stored record field that no command shows, state that only an earlier release wrote, an injected fault, or a call or a write that must not happen.
  - **A known bug:** it guards a bug that has a BACKLOG entry until the fix lands, and its header names the BACKLOG ID.
- The first comment of each integration file names its class and the behavior that cucumber does not cover.
- A case that fits none of these moves to the unit test of its source pair. If a scenario or a unit test already covers it, delete it: first break the behavior on purpose, see that test fail, and undo the break.
```

Where it goes:

| File | Insert at | Notes |
|---|---|---|
| `.agents/skills/typescript-unit-tests/SKILL.md` | a new `## Where a test goes` section after the "Read before you act" table (after line 24) and before `## Review` (line 26) | The table is what every reader opens; the section sits beside it. |
| `.agents/skills/cucumber/SKILL.md` | a new `## Where a test goes` section after the intro paragraph (line 8) and before `## Read before you act` (line 10) | Same text. |
| `.planning/codebase/TESTING.md` | replace the "**Integration Tests:**" bullet (lines 187-188) with the same list under a `**Integration Tests:**` lead | Also fix the stale "16 files" (line 188, and the dated count block at lines 62-69 if the planner refreshes it); after Phases 6.1 and 8 the directory holds 28 `.test.ts` files. Line 30 describes `npm run check` without `test:cucumber`; fixing it is optional and harmless. |

"Multi-process" is wider than ITSCOPE-01's "multi-process race" on purpose: `subagent-hook-ownership:232` is a hand-off to a dead process, not a race. If the planner prefers the requirement's exact words, the case is still a race in the loose sense (a main load reaps while a sibling process is live), and the charter can say "a race between processes, or one acting on what another left". "A known bug" is the rule-4 case, named in plain words because the charter outlives the milestone.

## Upstream Parity Check (milestone rule)

No remaining case pins behavior that differs from Claude Code without a decision ID or a Pi gap. Checked:

| Case group | What it pins | Licensing |
|---|---|---|
| `concurrent-install` | one install wins, the other is refused | D-15 / state lock; `features/marketplace/state-lock.feature:4` says Claude Code writes without a lock: a recorded project decision |
| `load-reconcile-race` | non-corruption under contention, migrate once | RECON-06, MIG-01, D-13 |
| `agents-adapter-grant-conformance` | pi-subagents needs the uncut name | Pi capability gap, AGTLONGNAME-01, D-PG1-10 |
| `adapter-tool-name-conformance` | adapter cut at 64 characters | D-PG1-07/08/09 (Pi gap) |
| `hooks-result-boundary` (titles carry no ID) | replacement clears `details`/`structuredContent`; failed result stays failed | `docs/hooks-compatibility.md:27` and `:430`: D-PG2-05/06. Recommend the new header cite D-PG2-06 (done in the draft). |
| `pi-subagents-child-launch-conformance` (5 titles carry no ID: `:142`, `:169`, `:304`, `:317`, `:330`) | ambient MCP tools for an agent with no tools list; none for an explicit list | matches Claude Code's rule that a subagent without `tools` inherits every tool, and one with `tools` gets only those [ASSUMED: from training knowledge of the Claude Code subagent docs; not re-fetched here]. No divergence to license. |
| `standalone-prune` | prune runs no reconcile, no dependency install, no git call | NFR-5 (it names the operations that may use the network, and prune is not among them) and the prune decisions (PRUNE-03, D-05-xx) |
| `mcp-verdict-*`, `mcp-server-records` | stored fields | D-P3-01/02/04/16, MREC-01/02/03 |
| `workflow-kind-inversion` | no rewrite on an unchanged apply | RECON-05, D-10, WCONV-01/02 |

If the planner wants the `[ASSUMED]` row confirmed, a `claude-code-compat-research` lookup of the subagent `tools` field closes it; nothing in this phase changes that behavior, so it gates nothing.

No case exposed a product bug (rule 4): every one of the 279 cases passes at `e205d23`, and no break this research ran found a gap.

## Architecture Patterns

### System Architecture Diagram

```
                 a case in test/integration/
                            |
            does it run a peer's own code?  --yes-->  PEER: keep, header says which peer
                            | no
            does it need two or more processes? --yes--> RACE: keep
                            | no
            does it read state no command shows, earlier-release
            state, an injected fault, or a call that must not happen? --yes--> INTERNAL: keep
                            | no
            does a scenario or unit case fail on the same break? --yes--> break it, see red,
                            | no                                         undo, delete the case
                            v
            move it beside its source pair (test/<layer>/<module>.test.ts),
            keep the assertions, keep 100% direct coverage, delete it here
                            |
                            v
            file left with no case -> delete the file; helper left with no importer -> delete it
                            |
                            v
            header of each remaining file: class (ITSCOPE-01) + what cucumber does not cover
```

### Recommended plan split (disjoint files per plan)

Phase 8 execution starts after Phase 6.1 merges (CONTEXT "Specifics"). Every plan below is in Wave 1 except the gate.

| Plan | Wave | Files modified | Files deleted | Heavy runs | Proof it needs |
|---|---|---|---|---|---|
| 08-01 Move the convergence cases | 1 | `test/orchestrators/reconcile/plan.test.ts` | `test/integration/reconcile-plan-convergence.test.ts` | none (unit only) | B1 (`migrate-config.test.ts:167` red), B2 (`plan.test.ts:877` red), B3 (`plan.test.ts:1053` red); `plan.ts` direct coverage 100% |
| 08-02 Delete the cases cucumber covers | 1 | `test/integration/load-reconcile-race.test.ts`, `test/integration/subagent-hook-ownership.test.ts`, `test/integration/workflow-kind-inversion.test.ts`, `docs/output-catalog.md` | `test/integration/transaction-lifecycle-cascade.test.ts` | single-scenario cucumber runs under the lock | B4 (`config-migration.feature:248`), B5 (`subagent-child.feature:364`), B6a/b (`workflow/storage.feature:18`, `:31`), B7 (`reinstall-flow.test.ts:4275`, `update-flow.test.ts:8197`; pre-run red), B7c (`hook/lifecycle.feature:42`); this plan also writes the headers of its three edited files |
| 08-03 Headers and doc claims | 1 | the other 20 header files (6 new, 2 overclaims, 12 class sentences), `docs/mcp-compatibility.md`, `docs/hooks-compatibility.md` | — | the integration suite once | `standalone-prune` 2/2 with the whole-object assertion; header grep |
| 08-04 Charter | 1 | `.agents/skills/typescript-unit-tests/SKILL.md`, `.agents/skills/cucumber/SKILL.md`, `.planning/codebase/TESTING.md` | — | none | text review (`simple-english`, `humanizer`) |
| 08-05 Final gate (ITSCOPE-04) | 2 | the phase SUMMARY files only | — | `npm run check` on the combined tree | see Validation Architecture |

08-03 and 08-04 may merge into one plan; they touch no file in common with 08-01 or 08-02. Only 08-02 needs the cucumber lock for breaks. 08-01 and 08-02 each delete one file, which `fallow audit` reports as `weakened-tests` (`warn`); record it in the SUMMARY (user decision 2026-11-21), and do not change `.fallowrc.json` or CI. `test:corresponding` is unaffected: `test/integration` is a non-corresponding root (`.planning/codebase/TESTING.md:165`), and `plan.test.ts` is an existing pair. Each plan keeps 100% direct coverage at every commit, because no source file changes; 08-01 only adds cases to one pair.

The 08-02 heavy work is four focused cucumber runs (one feature line each, `--parallel 2`, under the lock) with the break applied and again with it reverted. The adapter profile suffices for each: none of the four scenarios carries an MCP tag [ASSUMED: tags not checked line by line; `check:features` will tell].

### Anti-Patterns to Avoid

- **Moving a cross-module case into a pair by calling another module's production function as an arrange step.** The draft avoids `buildConfigFromState` in `plan.test.ts`; it authors the config literal. `mergeScopeConfigs` is already the helper's idiom there.
- **Spreading `emptyReconcilePlan(...)` into a nonempty expected plan.** `rules/cases.md` says to build expected values independently. Use `emptyReconcilePlan(...)` only where the whole expected plan is empty, as `plan.test.ts:1635` does, and full literals otherwise, as the integration cases did. (The draft below follows this for the two nonempty cases.)
- **Deleting before the break is seen red.** The milestone rule: break, see the cover fail on a When/Then or an assertion, revert, then delete.
- **Editing a file 6.1 owns before 6.1 merges.** `docs/hooks-compatibility.md` is 6.1's.
- **Headers that claim more than the cases assert.** That is exactly the IN-03 finding; say what is compared.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-pair coverage | a custom coverage run | `npm run test:coverage:direct -- <test or source path>` (or `node scripts/test-coverage-direct.mjs <path>`) | it is the gate's own measurement |
| Proving a break fails a scenario | reading the step code | run the scenario with the break and match `  N) <title> # <file>:<line>` | the summary formatter's form (CONTEXT "Specifics") |
| Break apply/revert | manual edits in the main checkout | the plan's own worktree; Phase 7's `break.sh` / `check-red.mjs` under `.../scratchpad/plan-07/inputs/` | breaks must never land in the main checkout |
| Helper orphan check | reading imports by eye | `git grep -n -- <helper> -- . ':(exclude).planning'` per helper, plus `npm run fallow` (dead code over `test/` in its second run) | fallow also checks the forked child paths only by string, so grep is needed |

## Runtime State Inventory

This is a test-suite refactor, so the inventory is short.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None: the deleted tests use temp directories only (`mkdtemp`, `withHermeticHome`) | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | `node_modules/.cache/optional-peers` (peer cache) and the ESLint content cache; unchanged by the phase | none; warm ESLint with a lone `npm run lint` first (CONTEXT) |

## Common Pitfalls

### Pitfall 1: Phase 6.1 changes the hooks code under two kept files
**What goes wrong:** `hooks-result-boundary.test.ts` imports `adaptToolResultResult` from `bridges/hooks/event-adapters.ts`, and `hooks-dispatch-end-to-end.test.ts` drives `createHooksHydration` / the `session_start` handler from `bridges/hooks/index.ts`. Phase 6.1's plan modifies both modules and the SessionStart path (`06.1-01-PLAN.md` `files_modified`).
**Status:** rechecked at `8d80287` (6.1 merged into the branch): both files pass unchanged.
**How to avoid:** start Phase 8 from the merged tree; run both files again before writing their headers; if 6.1 changed a signature, the header text above still holds, but the kept case may need its call updated (in the plan that owns the file, 08-03).
**Warning signs:** a type error or a failed `hooks-dispatch-end-to-end` case after the 6.1 merge.

### Pitfall 2: Unused locals after a trim
**What goes wrong:** removing `subagent-hook-ownership:175` leaves `STAGES` (`:72`) and the `Parent done.` script step unused; removing `load-reconcile-race:494` and `workflow-kind-inversion:171` may leave helpers or imports unused. `tsc --noEmit` (`noUnusedLocals`) and ESLint fail.
**How to avoid:** run `npm run typecheck` and `npm run lint` on the plan's tree before committing; delete what they name.

### Pitfall 3: A break that the integration case catches but the cover does not
**What goes wrong:** the break proves nothing if only the integration case goes red.
**How to avoid:** run the cover alone with the break (one scenario line, or one unit file), and record its red line. The pre-run breaks B1-B3 were checked this way.

### Pitfall 4: The cucumber break runs collide with another executor
**How to avoid:** `flock -w 3600 …/phase07-heavy.lock` around each cucumber run, `--parallel 2`, `fd` on `PATH` (the Glob scenarios need it; not relevant to the four scenarios named here, but the gate runs them).

### Pitfall 5: Direct coverage noise from the container environment
**What goes wrong:** the ~10.6 KB environment makes `test/bridges/hooks/dispatch-exec.test.ts` exceed the 10,000-character context cap (STATE.md).
**How to avoid:** run `test:coverage:direct:all` under `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp` plus the npm prefix.

### Pitfall 6: Counting the old 68-row claim
The audit says the expansion table has 68 rows. Measured: `EXPANSION_CASES` produces 52 adapter rows and 52 built-in rows (22 written plus 30 through Pi's resolver), and `OPTION_FIELD_CASES` 14 option rows in each conformance file. Use the measured counts in headers and SUMMARYs if a count appears at all.

### Pitfall 7: `docs/output-catalog.md` is a build input
Editing its line 695 makes the commit hook run `check:commit`, and the `test/architecture/catalog-uat/*` tests read the file. Keep the edit outside any fenced catalog block.

## Code Examples

### The 8 moved cases for `test/orchestrators/reconcile/plan.test.ts`

Insert inside `describe("planReconcile", …)`, before `test("preserves base and local marketplace declaration order and provenance", …)` (`plan.test.ts:364`). The helpers `mergedConfig`, `marketplaceRecord`, `pluginRecord`, `stateWith` and the imports (`githubSource`, `pathSource`, `planReconcile`, `emptyReconcilePlan`, `ScopeSatisfactionVerdict`) already exist in the file (`:9-112`). Draft run this session with Prettier applied, in exactly this literal form: 71/71 pass, `tsc --noEmit -p tsconfig.json` clean, ESLint `--max-warnings 0` clean, `plan.ts` 100% direct coverage [VERIFIED]. The two nonempty expected plans are full literals, per `rules/cases.md`.

```ts
  for (const scope of ["project", "user"] as const) {
    test(`plans nothing in the ${scope} scope for a config that declares every recorded marketplace and plugin, a non-installable record included`, () => {
      // arrange
      const merged = mergedConfig(
        { "mp-github": { source: "acme/tools" }, "mp-path": { source: "./mp-path-local" } },
        { "code-reviewer@mp-path": {}, "formatter@mp-github": {}, "soft-degraded@mp-path": {} },
      );
      const state = stateWith({
        "mp-path": marketplaceRecord("mp-path", pathSource("./mp-path-local"), {
          "code-reviewer": pluginRecord(true),
          "soft-degraded": pluginRecord(true, {
            installable: false,
            skills: [],
            unsupported: ["agents"],
          }),
        }),
        "mp-github": marketplaceRecord("mp-github", githubSource("acme/tools"), {
          formatter: pluginRecord(true),
        }),
      });

      // act
      const plan = planReconcile(merged, state, scope);

      // assert
      assert.deepStrictEqual(plan, emptyReconcilePlan(scope));
    });
  }

  test("plans nothing for a declared alias whose plugin the canonical recorded marketplace holds", () => {
    // arrange
    const merged = mergedConfig(
      { "declared-name": { source: "./local-marketplace" } },
      { "formatter@declared-name": {} },
    );
    const state = stateWith({
      "canonical-name": marketplaceRecord("canonical-name", pathSource("./local-marketplace"), {
        formatter: pluginRecord(true),
      }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
  });

  test("D-09-14: the same unsatisfied declaration plans the same dependency install again", () => {
    // arrange
    const merged = mergedConfig({ mp: { source: "acme/mp" } }, { "app@mp": {} });
    const state = stateWith({
      mp: marketplaceRecord("mp", githubSource("acme/mp"), { app: pluginRecord(true) }),
    });
    const verdict: ScopeSatisfactionVerdict = {
      ok: true,
      unsatisfied: [{ dependent: "app@mp", dependency: "vault@mp", kind: "missing" }],
    };
    const expectedPlan = {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [],
      pluginsToDependencyDisable: [
        { scope: "project", plugin: "app", marketplace: "mp", dependency: "vault@mp", kind: "missing" },
      ],
      pluginsToDependencyInstall: [
        {
          scope: "project",
          plugin: "vault",
          marketplace: "mp",
          ranges: [],
          requiredBy: "app@mp",
          declarers: ["app@mp"],
        },
      ],
      sourceMismatches: [],
    };

    // act
    const plans = [
      planReconcile(merged, state, "project", verdict),
      planReconcile(merged, state, "project", verdict),
    ];

    // assert
    assert.deepStrictEqual(plans, [expectedPlan, expectedPlan]);
  });

  test("FIX-02: a base layer without the local declarations and the local layer plan nothing for their records", () => {
    // arrange
    const merged = mergedConfig(
      { "mp-base": { source: "./mp-base" } },
      { "bp@mp-base": {} },
      { "mp-local": { source: "./mp-local" } },
      { "lp@mp-local": {}, "lbp@mp-base": {} },
    );
    const state = stateWith({
      "mp-local": marketplaceRecord("mp-local", pathSource("./mp-local"), {
        lp: pluginRecord(true),
        dep: pluginRecord(true, { provenance: "dependency" }),
      }),
      "mp-base": marketplaceRecord("mp-base", pathSource("./mp-base"), {
        bp: pluginRecord(true),
        lbp: pluginRecord(true),
      }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
  });

  test("LAYER-01: a marketplace both layers declare with its recorded source plans nothing", () => {
    // arrange
    const merged = mergedConfig(
      { tools: { source: "./tools", autoupdate: true } },
      { "formatter@tools": {} },
      { tools: { source: "./tools" } },
    );
    const state = stateWith({
      tools: marketplaceRecord("tools", pathSource("./tools"), { formatter: pluginRecord(true) }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
  });

  test("LAYER-09: a disabled record under a base enabled false and a local entry without enabled plans nothing", () => {
    // arrange
    const merged = mergedConfig(
      { tools: { source: "./tools" } },
      { "formatter@tools": { enabled: false } },
      {},
      { "formatter@tools": {} },
    );
    const state = stateWith({
      tools: marketplaceRecord("tools", pathSource("./tools"), { formatter: pluginRecord(false) }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, emptyReconcilePlan("project"));
  });

  test("LAYER-09: an enabled record under a base enabled false and a local entry without enabled plans a disable", () => {
    // arrange
    const merged = mergedConfig(
      { tools: { source: "./tools" } },
      { "formatter@tools": { enabled: false } },
      {},
      { "formatter@tools": {} },
    );
    const state = stateWith({
      tools: marketplaceRecord("tools", pathSource("./tools"), { formatter: pluginRecord(true) }),
    });

    // act
    const plan = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(plan, {
      scope: "project",
      marketplacesToAdd: [],
      marketplacesToRemove: [],
      pluginsToInstall: [],
      pluginsToUninstall: [],
      pluginsToEnable: [],
      pluginsToDisable: [{ scope: "project", plugin: "formatter", marketplace: "tools" }],
      pluginsToDependencyDisable: [],
      pluginsToDependencyInstall: [],
      sourceMismatches: [],
    });
  });
```

Run Prettier on the file after inserting (it splits the long `pluginsToDependencyDisable` element over several lines).

### Break recipes (apply in the plan's worktree, revert before commit)

```text
B1  extensions/pi-claude-marketplace/persistence/migrate-config.ts, basePluginEntries:
    before `const entry = declaredEntry(record);` add
      if (!record.compatibility.installable) { return []; }
    red: test/persistence/migrate-config.test.ts
      "projects complete marketplaces, plugins, legacy flags, and nullish sources"   [run: fail 1]
B2  extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:602
      record.provenance === "dependency"  ->  record.provenance === "never"
    red: plan.test.ts "D-04-05: keeps an undeclared record whose provenance is dependency" (+3 D-04-05)  [run]
B3  plan.ts:1070  pluginsToDependencyInstall: pluginDiff.dependencyInstall  ->  []
    red: plan.test.ts "MISS-01: buckets a missing declared dependency once, with its declarer's ranges" (+9)  [run]
B4  migrate-config.ts:178-180  delete the `else if (legacyAutoupdate === false)` arm
    red: features/plugin/config-migration.feature:248                               [not run]
B5  bridges/hooks/async-rewake/registry.ts: a child load reaps journals it does not own
    red: features/plugin/subagent-child.feature:364 (When step assertion)           [not run]
B6a resolver records workflows unsupported -> features/workflow/storage.feature:18  [not run]
B6b workflows bridge writes a changed script -> features/workflow/storage.feature:31 [not run]
B7  orchestrators/plugin/update-swap.ts commitUpdateHooks (:1171-1199, shared by update and reinstall):
    replace the `await writeHookConfig({...})` call with `void writeHookConfig;`
    red: reinstall-flow.test.ts "LIFE-01 (reinstall): a plugin with hooks rewrites <hooksDir>/<plugin>/hooks.json
         from the resolved manifest"; update-flow.test.ts "LIFE-01 (update): version A->B (both ship hooks)
         overwrites …" and "LIFE-01 (update): version A (no hooks) -> version B (with hooks) writes the new
         hooks.json"   [run: fail 1 and fail 2]; features/hook/lifecycle.feature:52 expected too [not run]
B7c uninstall keeps hooks/<plugin>/ -> features/hook/lifecycle.feature:42          [not run]
```

The planner picks the exact line for B5, B6, and B7c after the 6.1 merge (B5's module is outside 6.1's file list, but its neighbors are not).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `test/integration/` as "multiple layers together" (TESTING.md:187-188) | integration holds only what cucumber and unit pairs cannot reach (ITSCOPE-01) | this milestone | the charter text replaces the old bullet |
| Phase-scoped "kept" notes in SUMMARYs | each file's header states its class | Phases 2-7, finished here | headers are the durable record |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Breaks B4-B6 and B7c turn their named scenario red | Case map, Code Examples | a deletion has no proof; the plan runs each break before deleting, so a wrong cover is found then, and the case stays |
| A2 | Claude Code gives a subagent with no `tools` every tool and one with `tools` only those | Upstream Parity Check | the five untitled child-launch cases would pin a divergence; they would stay either way (PEER), and the question would go to the user |
| A3 | The four scenarios used as covers carry no MCP tag, so the adapter profile is enough for the break runs | Recommended plan split | a break run under one profile could miss a builtin-only path; the gate runs both profiles anyway |
| A4 | The "cucumber does not cover" sentences of the PEER headers match the suite | Header Text | a header overstates; the sentences only name what the scenarios hold, which limits the harm |

## Open Questions (RESOLVED)

All three are resolved in 08-CONTEXT.md: [Moved-catalog row] (no scenario), [Charter wording] ("multi-process"), [TESTING.md counts] (integration bullet only).

1. **Add a scenario for the moved-catalog `list` row of a release 0.19.2 record?**
   - What we know: `mcp-verdict-migration:202` compares the row `(partially-upgradable) {unsupported mcp}` under Pi's built-in MCP; no scenario lists it (`verdict-list.feature:362` covers a catalog that did not move). The case stays as INT-earlier anyway.
   - What's unclear: whether the user wants the row as a scenario (a `@builtin-only` scenario needs its licensing ID beside an `@adapter-only` twin, or `@mcp` if the row is the same under both).
   - Recommendation: say so in the header (drafted) and do not add a scenario in this phase.
2. **"Multi-process" or "multi-process race" in the charter?** Recommendation: "multi-process" with the race and hand-off spelled out, because `subagent-hook-ownership:232` is a hand-off.
3. **Refresh the dated count block in TESTING.md (lines 62-69)?** It is a 2026-10-05 snapshot (343 files). Recommendation: change only the integration bullet and its count; refreshing the whole snapshot is a codebase-map task.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | every run | ✓ | v24.22.3 | — |
| optional peer cache (`node_modules/.cache/optional-peers`) | PEER files, cucumber | ✓ | pi-subagents 0.88.1 (suite version), pi-mcp-adapter, `@quintinshaw/pi-dynamic-workflows` | `node scripts/install-test-peers.mjs` (run by `test:integration`) |
| `fd` | `hook/tool-use.feature` Glob scenarios in the gate | per container (`apt-get install -y fd-find`) | — | install in a fresh container |
| shared `flock` lock file | cucumber and full-suite runs | ✓ | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node v24.22.3) for unit and integration; `@cucumber/cucumber` via `scripts/cucumber.mjs` for scenarios |
| Config file | `package.json` scripts; `cucumber.json` |
| Quick run command | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test <file>` |
| Full suite command | `npm run check` (with the npm prefix and under the lock) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ITSCOPE-01 | moved planner fixed points | unit | `node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/orchestrators/reconcile/plan.test.ts` (expect 71 tests) | ✅ (cases added) |
| ITSCOPE-01 | moved pair keeps coverage | coverage | `env -i HOME=$HOME PATH=$PATH LANG=C.UTF-8 TMPDIR=/tmp CI=1 NODE_OPTIONS=--max-old-space-size=6144 node scripts/test-coverage-direct.mjs test/orchestrators/reconcile/plan.test.ts` (expect "branches 180/180, functions 31/31, lines 1073/1073" or the new totals at 100%) | ✅ |
| ITSCOPE-01 | remaining suite passes | integration | `npm run test:integration` (expect 279 − 10 − 1 − 1 − 1 − 1 = 265 tests, all pass) | ✅ |
| ITSCOPE-01 | no orphan helper | static | `for h in concurrent-install-child ipc-child load-reconcile-race-child mcp-plugin-seed optional-peer pi-mcp-adapter-peer pi-subagents-peer; do git grep -q -- "$h" -- test ':!test/integration/'"$h"'.ts' \|\| echo "orphan: $h"; done` prints nothing; `npm run fallow` passes | ✅ |
| ITSCOPE-01 | each deletion's break turned its cover red | manual record | SUMMARY lists each break, the red line (`  N) <title> # <file>:<line>` or the `✖` unit title), and the revert | Wave 0: none needed |
| ITSCOPE-02 | every remaining file states its class | static | `for f in test/integration/*.test.ts; do head -20 "$f" \| grep -q "(ITSCOPE-01)" \|\| echo "$f"; done` prints nothing; `head -1` of each file is `// test/integration/<name>.test.ts` | ✅ |
| ITSCOPE-02 | overclaims fixed | integration + review | `node --import … --test test/integration/standalone-prune.test.ts` 2/2 with the whole-object assertion; header text review | ✅ |
| ITSCOPE-03 | charter present in three files | static | `grep -n "## Where a test goes" .agents/skills/typescript-unit-tests/SKILL.md .agents/skills/cucumber/SKILL.md` and `grep -n "Peer conformance" .planning/codebase/TESTING.md` | ✅ |
| ITSCOPE-04 | combined tree green | full | `npm run check` (both cucumber profiles inside), plus `npm run test:coverage:direct:all` under `env -i` if the full run's coverage step is noisy | ✅ |

### Sampling Rate
- **Per task commit:** the touched file's own run (unit file, or the one integration file), `npm run check:static` in the worktree (the commit hook may check nothing inside `.claude/worktrees/…`).
- **Per wave merge:** `npm run check` on the combined tree (AGENTS.md "Build verification").
- **Phase gate:** `npm run check` green after the last Phase 8 merge and after the Phase 6.1 merge, both profiles, 100% direct coverage; then `/gsd-verify-work`.

### Wave 0 Gaps
None. The existing test infrastructure covers every requirement; the phase adds cases to one existing pair and changes no harness.

## Security Domain

`.planning/config.json` has no `security_enforcement` key (absent means enabled) and sets `workflow.nyquist_validation: true` (`:22`) [VERIFIED: grep], so both sections are included. The phase changes tests and docs only.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (`auth-e2e` stays as is) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | no production input path changes |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A deleted test hides a regression in a security-relevant path (credential leak AUTH-09, deny-listed credentials AVAR-05, containment NFR-10) | Tampering / Information disclosure | those cases are all kept (`auth-e2e`, `adapter-expansion-conformance` AVAR-05 rows); every deletion needs a seen-red break first |
| A break committed by mistake | Tampering | breaks only in the plan worktree; `git status --porcelain -- extensions/` empty before each commit |

Each plan SUMMARY still carries `## Threat Flags` (AGENTS.md).

## Sources

### Primary (HIGH confidence)
- The 30 integration files at `e205d23`, read; per-file TAP runs (`research-08/tap-*.log`), `# tests 279`, `# pass 279`.
- `test/orchestrators/reconcile/plan.test.ts`, `test/persistence/migrate-config.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts:4275`, `update-flow.test.ts:8197`, `uninstall.test.ts:3956`, `test/platform/git-ops-fake.ts`, read.
- Scratch-worktree runs: the draft `plan.test.ts` (71/71, `tsc` and ESLint clean, direct coverage 100%), the `standalone-prune` assertion (2/2), breaks B1-B3 and B7 (red as stated).
- `features/plugin/config-migration.feature:248`, `features/plugin/subagent-child.feature:364` and `features/step_definitions/plugin/subagent-hooks.steps.ts:505-523`, `features/workflow/storage.feature:18-31`, `features/hook/lifecycle.feature`, `features/mcp-server/{verdict-list,legacy-move,verdict-update}.feature`, `features/marketplace/url-source.feature:202,225`, read.
- Installed peers: `pi-mcp-adapter/dist/metadata-cache.js:117-150`, `pi-subagents/src/runs/shared/mcp-direct-tool-allowlist.js:360-411`, `pi-subagents/src/runs/shared/subagent-prompt-runtime.js:232-245`, `pi-subagents/package.json` (`"version": "0.88.1"`), read.

### Secondary (MEDIUM confidence)
- `.planning/research/INTEGRATION-OVERLAP.md` (Groups A-C) for the PEER "cucumber does not cover" sentences; it read code and ran nothing.

### Tertiary (LOW confidence)
- Claude Code subagent `tools` inheritance (A2), from training knowledge.

## Metadata

**Confidence breakdown:**
- Case map and counts: HIGH (every file read; every count measured).
- Moves: HIGH (drafted and run; coverage measured).
- Deletions B1-B3 and B7: HIGH (breaks run); B4-B6 and B7c: MEDIUM (covers read, breaks not run).
- Headers: HIGH for internal and race files; MEDIUM for the PEER "not covered" sentences.
- Doc claims: HIGH (peer sources read).

**Research date:** 2026-11-23
**Valid until:** 30 days, or until another change lands in `test/integration/`, the cited unit pairs, or the cited feature files.
