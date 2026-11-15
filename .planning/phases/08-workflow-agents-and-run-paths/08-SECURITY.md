---
phase: "08"
slug: "workflow-agents-and-run-paths"
status: verified
threats_open: 0
threats_open_nonblocking: 1
threats_total: 27
threats_closed: 26
asvs_level: 1
block_on: high
created: "2026-11-15"
---

# Phase 08 — Security

Of the 27 declared threats, 26 are closed and one is open. The register holds 4 high, 14 medium and 9 low threats. T-08-13 (medium) is open and nonblocking, because it is below the `block_on: high` limit: it waits for the maintainer to accept it. Six of the closed threats (T-08-18 to T-08-23) belong to plan 08-06, which ran only under option B and was skipped (option A). They are closed as not applicable: the surface they guard does not exist in the tree. The auditor read current source and tests at `f7360834` and ran no tests. After the review fixes, every line citation in the register was re-pointed at `8975cda6`; the audit's own checks still name `f7360834`.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Probe and harness processes to the developer's home | Real Pis, runners, the engine and MCP servers start on this machine | `HOME`, agent directory, processes, provider key |
| Workflow script text to user-visible notes | An agent type is any string literal of a third-party script; it reaches the terminal and the JSON payload | File name, folder, agent type |
| Plugin files to the read-only `info` surface | `info` reads agent frontmatter of a plugin it may not have installed | Agents paths, agent files |
| A suite step to the developer's git configuration | A step runs real git; a scripted model runs `bash` in a workflow subagent | Git identity, hooks, config |
| The compatibility page to the user's engine settings | A user who follows the page changes what every workflow subagent can reach | `providerMiddlewareExtensions`, project settings file |
| A plugin agent's tool grants to the child's tool set | A `Workflow` grant could start runs whose subagents hold more tools than the agent | `tools:` tokens |
| The catalog and pinned counts to their readers and gates | The catalog states which bytes `info` prints; three tests pin the state count | Documented rows, counts |

## Threat Register

Source paths without a prefix are relative to `extensions/pi-claude-marketplace/`. Test, feature, doc and script paths are repository-relative. `08-` files are in the phase directory.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-08-01 | Information disclosure, Tampering | probe Pi or child and the real `~/.pi/agent` | high | mitigate | Harness allowlist environment with sandbox `HOME`, `PI_CODING_AGENT_DIR` and `PI_OFFLINE=1` (test/e2e/_rpc.ts:241-243); driver under `--import` of test/platform/isolated-pi-home.ts (20-31; 08-SPIKE-S5.md:19, 49-56); loopback provider with dummy key (features/lib/real-subagent-child.ts:109, 405-410). | closed |
| T-08-02 | Denial of service | outliving fixture processes, scratch file in tree | medium | mitigate | `withMainRun` releases in `finally`, kills each process whose HOME is the fixture's, and removes the fixture (features/lib/real-subagent-child.ts:576-620, 653-712); scratch driver deleted (08-SPIKE-S5.md:19); worktree clean at `f7360834`. | closed |
| T-08-03 | Information disclosure | home path or credential in the committed record | low | mitigate | Record uses `SCRATCH` for the scratch path (08-SPIKE-S5.md:49-56); zero `/home/`, `/Users/` or `/root/` matches in the record or in the phase's added doc and feature lines; the only key is the dummy `pg3-dummy-key`. | closed |
| T-08-04 | Spoofing, Tampering | control, format or bidi characters forging install output | medium | mitigate | `forMessage` escapes `\p{Cc}` and `\p{Cf}` (domain/workflow-script.ts:1163-1168) on file name, folder and agent type in the one shared lead (orchestrators/plugin/discover-names.ts:149-157). Owner cases for U+202E, line break and U+200B: test/orchestrators/plugin/discover-names.test.ts:505-531, 824-842. | closed |
| T-08-05 | Denial of service | thousands of missing types, or one very long type, flooding output | medium | mitigate | At most 5 notes per script, plus one count line; a type longer than 128 units is counted, not printed (discover-names.ts:135-136, 211-238, 179-194). Owner cases for 6 and 7 types, for 129 characters, and for a count line that no missing-agent note precedes (discover-names.test.ts:742-822); scenarios for seven types and for one too-long type (features/workflow/agent-types.feature:161-190, 192-206). | closed |
| T-08-06 | Repudiation | wrong note, or a note read as a binding promise | low | mitigate | A note needs the `<plugin>:` prefix and no exact match to a discovered declared name (discover-names.ts:224, 277-283). No-note scenario for in-namespace installed and out-of-namespace types (agent-types.feature:108); namespace mutation recorded in 08-02-SUMMARY.md. | closed |
| T-08-07 | Information disclosure | absolute folder path in a note | low | mitigate | The lead writes `path.basename` of the script folder (discover-names.ts:150); `info` still maps notes through `redactAbsolutePaths` (orchestrators/plugin/info.ts:1291-1293); scenarios state `in "workflows"` (agent-types.feature:41-45, 101). | closed |
| T-08-08 | Information disclosure | `info` agent read leaving the plugin root | medium | mitigate | `previewWorkflowAgentNotes` keeps its early return, `resolveContainedComponentPath` before any read, and a total `try` (info.ts:1271-1298). Pinned by test/orchestrators/plugin/info.test.ts:10980 (throw) and 11005 (escaping path, now with the missing-agent note). | closed |
| T-08-09 | Tampering, Information disclosure | project step running git with the developer's identity or config | medium | mitigate | The step calls only `runGit` with world tokens (features/step_definitions/project.steps.ts:18-28); its environment is sandbox `HOME`, `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=/dev/null` (features/lib/hermetic-git.ts:17-41); the step module imports no process API. | closed |
| T-08-10 | Repudiation | guard scenario that passes when its behavior breaks | medium | mitigate | Five scenarios state whole tables and values that the engine or bridge produced (features/workflow/agent-steps.feature:96, 128; run.feature:66, 89; collisions.feature:52); each has a recorded red mutation (08-03-SUMMARY.md:92-116). | closed |
| T-08-11 | Tampering | scripted `bash` in a workflow subagent | low | accept | See the Accepted Risks Log. The commands are feature-file literals that read git state only (agent-steps.feature worktree scenario), in the sandbox project of a sandbox-HOME Pi. | closed |
| T-08-12 | Elevation of privilege | adapter opted into workflow children holds every adapter tool | medium | mitigate | The fifth row of the section states the cost, quotes the README "not a hook-only or operating-system sandbox", and points to D-PG4-14 (docs/workflows-compatibility.md:220). The extension writes no engine setting (244); no `providerMiddlewareExtensions` writer exists in `extensions/`. | closed |
| T-08-13 | Tampering | repository-shipped `.pi/workflows/settings.json` | medium | accept (pending maintainer acceptance) | Flagged residual, owned by the engine. Engine 3.15.0 reads the file with no trust check (`src/workflow-settings.ts:122-134`), so a cloned repository can turn on `providerMiddlewareExtensions` and `inheritMainModel`. This extension writes no engine setting. The page names the file, states that the engine reads it whether or not the project is trusted, and tells users to read it in a repository they did not write (docs/workflows-compatibility.md:242). Corrected from "transfer" by review CR-01. Rated medium because it lets a cloned repository bring about T-08-12 with no consent from the user. Open until the maintainer accepts it; see the Accepted Risks Log. | open (nonblocking) |
| T-08-14 | Denial of service, Tampering | this extension listed in `providerMiddlewareExtensions` | medium | mitigate | Closing statement: do not list this extension, why (state lock and load reconcile in every child), and that no setting restores plugin hooks or skills (docs/workflows-compatibility.md:246). | closed |
| T-08-15 | Repudiation | source read or prediction presented as measurement | medium | mitigate | Grade list includes "source-read at 3.15.0", "measured by spike S5" and "documented upstream for subagents" (docs/workflows-compatibility.md:9-20); every row carries a grade (216-225); the adapter row (219) agrees with the S5(b) verdict (08-SPIKE-S5.md:106-107). | closed |
| T-08-16 | Elevation of privilege | `Read` agent starting a workflow whose subagents hold `bash`, `edit`, `write` | high | mitigate | Option A: `TOOL_MAP` has no `Workflow` entry (bridges/agents/convert.ts:92-102). Guard scenario asserts `tools read` for `Read, Workflow, Workflow(demo:scan)` (features/agent/frontmatter.feature:1300-1327), with a red run recorded in 08-05-SUMMARY.md; documented in docs/mcp-compatibility.md:386-393. | closed |
| T-08-17 | Elevation of privilege | background child of an agent with no `tools` list offered `workflow` and `workflow_control` | medium | accept | See the Accepted Risks Log. Measured by spike S5 (08-SPIKE-S5.md:104); stated in the Agents divergence bullet (docs/mcp-compatibility.md:761, D-PG8-14); BACKLOG candidate text in 08-05-SUMMARY.md:112. | closed |
| T-08-18 | Elevation of privilege | mapped `Workflow` grant (option B only) | high | mitigate | Not applicable: 08-06 skipped (08-06-SUMMARY.md, `status: skipped`, `commits: 0`); no grant is mapped (convert.ts:92-102; T-08-16). | closed (n/a) |
| T-08-19 | Tampering | `Workflow(...)` text reaching `tools:` (option B only) | medium | mitigate | Not applicable: no `Workflow` token is written. `toolNameOf` (convert.ts:276) still keeps only the tool name for every token. | closed (n/a) |
| T-08-20 | Denial of service | agent naming `workflow` cannot launch without the engine (option B only) | medium | mitigate | Not applicable: no generated file names `workflow`; the agent keeps its existing tool list. | closed (n/a) |
| T-08-21 | Denial of service | child-started background runs (option B only) | low | accept | Not applicable as planned. The same concern persists through the T-08-17 ambient path (08-SPIKE-S5.md:103) and is covered by that acceptance. | closed (n/a) |
| T-08-22 | Tampering | stored grant text no longer recognized (option B only) | low | mitigate | Not applicable: `bridges/` has no diff in `d0898ebd..f7360834`, so `legacy-grant-form.ts`, `grant-rewrite.ts` and `mcp-async-warning.ts` are unchanged. | closed (n/a) |
| T-08-23 | Information disclosure, Tampering | live-run fixture option for the engine (option B only) | medium | mitigate | Not applicable: no fixture option was added; `withMainRun` is unchanged in isolation and release (see T-08-01, T-08-02). | closed (n/a) |
| T-08-24 | Repudiation | documented row or fixture note differs from `info` output | low | mitigate | Fixture note (test/architecture/catalog-uat/fixtures/plugin-info.ts:234-236) equals the `missingAgentNote` text (discover-names.ts:169-171) and the feature lines; the contract test compares documented bytes every run (catalog-contract.test.ts:279-300; docs/output-catalog.md:3161). | closed |
| T-08-25 | Tampering | pinned count or byte total changed by more than one state | low | mitigate | Counts 324 to 325 and 337 to 338; bytes 54,553 to 55,017 (+464), then 55,018 (+1, the one state line that review WR-02 changed) (catalog-contract.test.ts:21-22); 22 modules unchanged (279); the catalog diff adds lines only. | closed |
| T-08-26 | Information disclosure | machine path in the documented row | low | mitigate | The fixture names the folder `workflows` alone (plugin-info.ts:234); the documented row has no absolute path (docs/output-catalog.md:3161-3171). | closed |
| T-08-SC | Tampering | npm/pip/cargo installs | high | mitigate | `package.json`, `package-lock.json`, `scripts/install-test-peers.mjs` and `test/integration/optional-peer-suite-versions.json` have no diff in `d0898ebd..f7360834`. | closed |

## Accepted Risks Log

- **T-08-11 (low):** Scripted `bash` commands run in a workflow subagent. They are literal git-state reads in the sandbox project of a sandbox-HOME Pi. The engine keeps the isolation worktree and its branch inside the sandbox, which the world removes.
- **T-08-17 (medium):** A pi-subagents background child of a bridged agent with no `tools:` list is offered the engine's `workflow` and `workflow_control` tools. `disallowedTools: Workflow` does not remove them. This phase did not introduce it: pi-subagents loads ambient extensions in a runner's child. It is recorded as D-PG8-14 in docs/mcp-compatibility.md:761. The maintainer question is carried as a BACKLOG candidate in 08-05-SUMMARY.md:112. Pending: no `.planning/BACKLOG.md` entry exists yet.
- **T-08-13 (medium, open, nonblocking, owned by the engine, pending maintainer acceptance):** Engine 3.15.0 merges `<project>/.pi/workflows/settings.json` with no Pi project trust check (`src/workflow-settings.ts:122-134`; callers pass only `{ cwd }`). A repository a user opens can load any enabled user extension into every workflow subagent (`providerMiddlewareExtensions`) and move untagged steps to the session's model (`inheritMainModel`). The earlier "transfer to Pi trust" disposition was false: the README sentence it quoted is about project-scoped extension resources in the allowlist match. This extension cannot gate the engine's read; the page warns users. The autonomous fixer proposed the acceptance. The maintainer has not accepted it, so the threat stays open until the maintainer does. Rated medium, the rating of T-08-12, because a repository can enable that exposure with no consent from the user, and it can also load any other enabled user extension into every subagent. Carrier: the parent writes this line to `.planning/BACKLOG.md` when it merges this branch. It is not written here: `- [workflows] Ask the pi-dynamic-workflows engine to apply Pi project trust to <project>/.pi/workflows/settings.json (3.15.0 src/workflow-settings.ts:122-134 reads it untrusted; a cloned repo can set providerMiddlewareExtensions and inheritMainModel). Source: 08-REVIEW.md CR-01, 08-SECURITY.md T-08-13.`
- **T-08-21 (low, n/a):** Background workflow runs that outlive a child are owned by the engine. Through the T-08-17 path, a default call's result never reaches the child (08-SPIKE-S5.md:103).
- **T-08-04 residual (planned):** A quote mark inside an agent type is not escaped, as in every workflow-script note.

Documented residuals outside the register:

- The 128-character display limit counts UTF-16 units before `forMessage` escapes the text. So a printed type of control characters can expand to about 1 KB. Output stays bounded by 5 notes and 1 count line.
- Option A for PG-WF-05 was answered in the autonomous run, pending maintainer review (08-06-SUMMARY.md). If option B is chosen later, T-08-18 to T-08-23 become applicable, and plan 08-06 runs with its register.

No unregistered threat flags: all seven SUMMARY Threat Flags sections say None.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-15 | 27 | 27 | 0 | 0 | gsd-security-auditor: current-source read at f7360834; T-08-18..23 closed as not applicable (08-06 skipped) |
| 2026-11-15 | 27 | 27 | 0 | 0 | gsd-code-fixer (review CR-01): T-08-13 disposition corrected from transfer to accept (flagged, engine-owned), pending maintainer review |
| 2026-11-15 | 27 | 26 | 0 | 1 | gsd-code-fixer (review WR2-01): T-08-13 reopened as nonblocking and rated medium until the maintainer accepts it |

## Sign-Off

- [x] Every threat has a declared disposition and implementation or documentation evidence.
- [x] Residual risks documented.
- [ ] T-08-13 acceptance: proposed by the autonomous fixer, pending maintainer acceptance. Until then it is open and nonblocking.
- [x] No blocking threat remains open; one nonblocking threat (T-08-13) remains open.
- [x] `status: verified`; `threats_open: 0`; `threats_open_nonblocking: 1`.

**Approval:** verified 2026-11-15 at f7360834 for the blocking gate. T-08-13 is open and nonblocking, pending maintainer acceptance (review WR2-01). No test suite was rerun by the auditor; the parent owns the combined-tree gate.
