---
phase: "04"
slug: "skill-and-workflow-install-defects"
status: verified
threats_open: 0
threats_open_nonblocking: 0
threats_total: 15
threats_closed: 15
asvs_level: 1
block_on: high
created: "2026-11-14"
---

# Phase 04 — Security

All 15 declared threats are closed: 3 high, 7 medium and 5 low. Of these, 13 are mitigated, 1 is transferred (T-04-06) and 1 is accepted (T-04-07). The auditor read current source and tests at `c40ef6dc` (phase range `e739fcfa..c40ef6dc`, code from `f2b48edc`) and ran no tests. The combined-tree gates for waves 1 and 2 passed, as `04-VALIDATION.md` records. The wave 3 gate and the phase gate belong to the orchestrator.

## Trust Boundaries

| Boundary | Description | Data crossing |
| --- | --- | --- |
| Marketplace manifest to the resolver | A third-party entry's `source` and `skills` choose which folders are read and installed | Listed skill paths, root-source test |
| Marketplace entry to the lenient `info` listing | `info` reads the declared strings of a refused plugin without the strict validator | Raw component path strings, directory reads |
| Plugin Markdown to the staged skill text | The plugin author controls every character that the sibling path rewrite reads | Relative link tokens, generated names |
| Workflow script text to the analyzer | Untrusted JavaScript is parsed and walked, never run | AST, `agentType` literals |
| Plugin text to user-visible notes | A script file name, a folder and an agent type reach the terminal and the JSON payload | Note text |
| Workflow engine to its subagent sessions | The engine, which this project does not own, builds each child's tool list | Agent tool policy (transferred) |
| Local evidence to an outside tracker | The engine request draft leaves this machine when the maintainer files it | Package-relative paths, versions |

## Threat Register

Paths without a prefix are relative to `extensions/pi-claude-marketplace/`. Test, feature, doc and planning paths are repository-relative.

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T-04-01 | Information disclosure | root-source branch of `collectStrictComponentKind` | high | mitigate | Each listed path passes `validateComponentPath` (domain/component-paths.ts:102-144, through `resolveContainedComponentPath` and `assertPathInside` at 14-39) in `validateComponentPaths` (531-544). `survivingListedPaths` stats only the accepted paths (554-563). A refusal returns the dirty flag (640), which makes the plugin unavailable (domain/plugin-resolver.ts:836). Proven by test/domain/component-paths.test.ts:1318-1363, where the recording stat reader gets no refused path. | closed |
| T-04-02 | Tampering | installed skill set after a catalog change | medium | mitigate | 04-01 adds no write path: `f2b48edc` changes only the domain reader, and `c4c0a951` changes only tests and features. Removal on update and reinstall, the session read, the alias, and the repeat are proven by features/skill/root-source-entries.feature:75, 102, 129, 146, 168. | closed |
| T-04-03 | Information disclosure | root-source branch of `deriveLenientComponentPaths` | medium | mitigate | `rootSourceLenientSkillPaths` keeps only what `containedRelativePath` accepts and drops absolute and escaping strings before any read (orchestrators/plugin/info.ts:2232-2268). The non-root lenient join is unchanged. Proven by test/orchestrators/plugin/info.test.ts:2292-2376, where the recording `listDirectory` never gets the outside or absolute folder, and features/skill/root-source-entries.feature:222. | closed |
| T-04-04 | Tampering | `rewriteSiblingSkillPaths` | medium | mitigate | Lexical and reads no file (domain/skill-sibling-paths.ts:79-112). A token is rewritten only when it resolves to a staged sibling other than the file's own skill (49-64). The output is a climb to the flat skills folder plus a generated name plus name-only segments (105-106), and a `.` or `..` continuation is refused (33, 89-92). Generated names pass `assertSafeName` (domain/name.ts:433-434; bridges/skills/stage.ts:319). The file depth comes from the symlink-skipping walk of the staged folder (bridges/skills/stage.ts:182, 264-279), so no output path leaves the staged skills root. Proven by test/domain/skill-sibling-paths.test.ts:113-169. | closed |
| T-04-05 | Denial of service | the token pattern over plugin-controlled text | medium | mitigate | One pattern; each repeat starts with a separator its class does not hold (domain/skill-sibling-paths.ts:24-30). It is applied per line (111). Proven by test/domain/skill-sibling-paths.test.ts:233, which runs 100,000 `../` segments under a 2-second timeout. | closed |
| T-04-06 | Elevation of privilege | a workflow started by name runs agents without their declared tool restriction | high | transfer | Transfer documented: the compatibility row in docs/workflows-compatibility.md:127 (D-PG4-14) and the draft engine request in .planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md. Disclosure shipped at install (orchestrators/plugin/install-outcome.ts:1248), at update, reinstall and apply move (orchestrators/plugin/update-swap.ts:1708), and in `info` (orchestrators/plugin/info.ts:1132-1140, 1245-1272), plus a CHANGELOG line. Proven by features/workflow/agent-restrictions.feature:17, 47, 78, test/orchestrators/plugin/install-outcome.test.ts:2720, and update-swap.test.ts:1494. | closed |
| T-04-07 | Spoofing | plugin text that tells the model to start a workflow | low | accept | Accepted: see Accepted Risks Log. The diff adds no opt-in text under `extensions/`. The 04-04 change only keeps the slash state of the source (domain/skill-tokens.ts:119-123). | closed |
| T-04-08 | Denial of service | the `agentType` walk in domain/workflow-script.ts | medium | mitigate | The 524,288-byte cap (domain/workflow-script.ts:354, applied at bridges/workflows/discover.ts:112). The walk reuses the one parse (236), has a depth budget of 1,000 (874, 916), and a catch returns no agent types (886-896), so the verdict stays. Proven by test/domain/workflow-script.test.ts:1422-1450, both sides of the budget. | closed |
| T-04-09 | Spoofing | the note text built in discover-names.ts | medium | mitigate | `forMessage` (domain/workflow-script.ts:1163-1168) on the file name, the folder and the agent type where each enters the string (orchestrators/plugin/discover-names.ts:113-117). An agent type is echoed only when it equals a restricted agent's name (144). Proven by test/orchestrators/plugin/discover-names.test.ts:451-472. | closed |
| T-04-10 | Repudiation | false restriction notes | low | mitigate | Literal-only matching with exact equality against the plugin's agents whose `tools` or `disallowedTools` is not blank (orchestrators/plugin/discover-names.ts:77-99, 134-148). Proven by the seven no-note cases at test/orchestrators/plugin/discover-names.test.ts:350-411 and test/domain/workflow-script.test.ts:1344-1362. | closed |
| T-04-11 | Information disclosure | the absolute workflows folder in the install and update note | low | mitigate | The join writes only the base name of the folder (orchestrators/plugin/discover-names.ts:114), which is stronger than the plan required (04-05 deviation 1). Proven by features/workflow/agent-restrictions.feature:39, 42, 73, which state `in "workflows"`. | closed |
| T-04-12 | Information disclosure | the agent read for notes in `info` | medium | mitigate | The note is skipped when no script names a literal agent type (orchestrators/plugin/info.ts:1251-1256). Each agents path passes `resolveContainedComponentPath` before `discoverPluginAgents` (1259-1263). That check refuses absolute, escaping and symlinked paths, and the plugin root itself is contained (325-332). A throw gives no note (1268-1271). Proven by test/orchestrators/plugin/info.test.ts:10786-10813, 10815-10838 and 10840-10881 (zero reads of the escaping and the absolute file). | closed |
| T-04-13 | Information disclosure | the absolute workflows folder in the `info` note | low | mitigate | `redactAbsolutePaths` on each note at the composition site (orchestrators/plugin/info.ts:1265-1267), over a note that already holds only the folder's base name. Proven by test/orchestrators/plugin/info.test.ts:10756-10784 and features/workflow/agent-restrictions.feature:109. | closed |
| T-04-14 | Information disclosure | the engine request draft | low | mitigate | The draft cites the public repository URL, package-relative `src/agent.ts` lines and versions only. A scan for home paths, temporary paths and credential patterns finds nothing. The file states "this report is not filed" (.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md:3). | closed |
| T-04-SC | Tampering | npm/pip/cargo installs | high | mitigate | No change to `package.json`, `package-lock.json`, `sonar-project.properties`, `test/integration/optional-peer-suite-versions.json` or `scripts/install-test-peers.mjs` between `e739fcfa` and `c40ef6dc`. `.fallowrc.json` was changed and then restored inside the range, with no net change. | closed |

## Accepted Risks Log

| Risk ID | Threat | Rationale | Accepted by |
| --- | --- | --- | --- |
| AR-04-01 | T-04-07 | Plugin text can tell the model to start a workflow. The bridge adds no instruction and keeps the author's reference as written. The engine's own opt-in guidance for its `workflow` tool stays in force, and the 04-04 prohibition forbids text that claims the user opted in. The user installed the plugin whose text is shown. The residual is stated in docs/workflows-compatibility.md:177. | 04-04-PLAN `<threat_model>`, severity low |

Documented residuals outside the register:

- INFOAGENTESCAPE-01 (.planning/BACKLOG.md:5317). This was present before the phase: base `e739fcfa` info.ts:393 and 2121-2122. For a refused plugin, the lenient `agents:` line of `info` reads directory entry names from a declared folder that is absolute or outside the plugin root. The other non-root lenient kinds work the same way. It lists names only and reads no file contents. The new note read is contained (T-04-12), and no plan's threat model claimed this path.
- WFAGENTCONST-01 (.planning/BACKLOG.md:5301). The T-04-06 disclosure covers only `agentType` string literals. `claude-security`'s `scan.js` passes two `tools: Read` agents through constants, so those two get no note. This is by design (D-PG4-11: a missing note, never a false one), and docs/workflows-compatibility.md:127 states the gap.
- The T-04-06 transfer is documented, but the counterparty has not been told yet. The draft is not filed, and WFRESTRICTGATE-01 (.planning/BACKLOG.md:5313) tracks the version gate after an engine fix. Until the engine fixes it, a restricted agent that a workflow runs keeps `read`, `bash`, `edit` and `write`. The notes are the only control on this side.
- Advisory, no containment impact: `containedRelativePath` (orchestrators/plugin/info.ts:2255-2266) uses `path.relative(".", declared)`, which resolves against `process.cwd()`. When the working directory is `/`, `..` stops at the filesystem root, so `../outside` becomes `outside` and is read inside the plugin root instead of being dropped. The result never leaves the root. This affects only the lenient listing of an unavailable row. Routed to the code-review pass.
- PRELOADSIBLING-01 (.planning/BACKLOG.md:5305): a skill body that an agent preloads keeps a dead sibling path. This is a broken link, not a security issue.

No unregistered threat flags: all six SUMMARY Threat Flags sections say None.

## Security Audit Trail

| Audit date | Threats total | Closed | Open blocking | Open nonblocking | Run by |
| --- | --- | --- | --- | --- | --- |
| 2026-11-14 | 15 | 15 | 0 | 0 | gsd-security-auditor: current-source read at c40ef6dc, ASVS L1 |

## Sign-Off

- [x] Every threat has a declared disposition and implementation evidence.
- [x] The transfer (T-04-06) has its documentation and disclosure; the accepted risk (T-04-07) is logged.
- [x] Residual risks documented; no new acceptance inferred.
- [x] No blocking or nonblocking threat remains open.
- [x] `status: verified`; `threats_open: 0`.

**Approval:** verified 2026-11-14 at c40ef6dc. No test suite was rerun by the auditor; the parent owns the combined-tree gate.
