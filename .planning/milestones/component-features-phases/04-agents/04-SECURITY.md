---
phase: "04"
slug: "agents"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of the six plans (`04-01-PLAN.md` to `04-06-PLAN.md`), written at plan time. Each mitigation was checked against the phase branch tree at ASVS level 1 (the code or test the plan names exists and does what the plan promised). Block threshold: `high`. The six plans each carry a `T-04-SC` row (no package install); the register folds them into one row.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin author -> agents walk | folder names, file names, and symlinks inside a plugin's `agents/` tree decide which files are read and which file names are written under `<scopeRoot>/agents/` | file paths (containment) |
| plugin author -> parent system prompt | with `advertise: true`, each bridged agent's name and description enter the parent model's system prompt | model input |
| plugin author -> generated frontmatter | source `background`, `model`, `effort`, `tools`, and `disallowedTools` become pi-subagents keys that decide how and with what a child runs | tool grants, model selection |
| plugin author -> agent system prompt | a preloaded skill's `SKILL.md` body becomes part of the agent's system prompt | model input, `!` command text |
| skills phase rows -> agents stage | the source and target folders the skills phase recorded decide which files the agents stage reads | file paths (containment) |
| untrusted project -> pi-subagents runs | a project-scope plugin agent lives in `<cwd>/.pi/agents/`, which pi-subagents runs only in a trusted project | agent definitions |
| user verb -> pi-subagents agent set | disable, uninstall, enable, or update decides which agent files pi-subagents can list and run | agent definitions |
| scenario -> sandbox settings | the settings Givens write `{agent dir}/settings.json` in the scenario sandbox | test configuration |
| phase -> public tracker | the pi-subagents report is text for the user to file | public text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Tampering | `domain/name.ts` namespace segments in a generated file name | medium | mitigate | `generatedAgentName` (l.551) and `declaredAgentName` (l.594) run `assertSafeName` on the plugin, the source, every segment (`"agent namespace segment"`), and the joined name; `assertSafeName` (l.36) refuses empty, `.`, `..`, `/`, `\`, and control characters; segment cases in `test/domain/name.test.ts` (l.1270-1278, l.1388-1395); `bridges/agents/stage.ts` keeps `assertPathInside` on the staging dir, staged file, and target (l.214-222) and on a previous file (l.388) | closed |
| T-04-02 | Information disclosure | `bridges/agents/discover.ts` walk following a symlink | medium | mitigate | the walk recurses only into `entry.isDirectory()` and reads only `entry.isFile()` Dirents (l.94-96); a declared file is read only when `lstat(file).isFile()` (l.106); cases "skips a symlinked markdown entry without following its target" (l.240) and "D-CF4-01 skips a symlinked folder without following it" (l.544) in `test/bridges/agents/discover.test.ts` | closed |
| T-04-03 | Denial of service | `discover.ts` on a deep folder tree | low | mitigate | `MAX_AGENT_NAMESPACE_DEPTH = 32` (l.57) stops the read at l.87; case "D-CF4-01 finds a file 31 folders deep and does not read a folder 32 deep" (l.576) | closed |
| T-04-04 | Spoofing | plugin agent descriptions in the parent prompt (`advertise: true`) | low | accept | see Accepted Risks Log | closed |
| T-04-05 | Tampering | settings Givens writing outside the sandbox | low | mitigate | `mergeUserSetting` (`features/step_definitions/agent/listing.steps.ts` l.83-98) writes only `path.join(world.tokens.agentDir, "settings.json")` and registers a release that restores the previous bytes or removes the file | closed |
| T-04-06 | Tampering | `bridges/agents/convert.ts` model pass-through and `async` emission | medium | mitigate | `asyncSetting` returns a boolean (`=== "true"` after quote strip) or `undefined`, and `optionalAsync` (l.1016) emits only `async: true`/`false` or no key; a model comes only from the closed `MODEL_MAP` (l.57) or as `anthropic/<value>` for a `claude-` value matching no `/[\s:]/` (l.314); rows for `claude-x:high`, `Claude-Opus-4-7`, `claude opus` in `test/bridges/agents/convert.test.ts` (l.602-617) omit the model with a warning | closed |
| T-04-07 | Elevation of privilege | `convert.ts` tool splitting | medium | mitigate | `splitToolList` (l.183) splits on commas and whitespace only at parenthesis depth 0 (l.209); `*` or an omitted list both take `omittedToolMapping` (l.421-422); AG-11 throws on an explicit list that maps to nothing (l.1025-1049, row `WebFetch NotebookEdit` l.2335); `toolNameOf` (l.233) maps `Tool(spec)` to the whole tool, so a disallow removes it (rows `Bash(rm *)` l.2202, l.2324) | closed |
| T-04-08 | Denial of service | the `async: false` default | low | accept | see Accepted Risks Log | closed |
| T-04-09 | Elevation of privilege | project-scope agent files in an untrusted project | high | mitigate | project-scope agents are still written to the scope's `agentsDir` (`persistence/locations.ts` l.51-52, unchanged by this phase; SC-1); `features/agent/project-trust.feature` "An untrusted project does not run its plugin agent" pins pi-subagents' refusal of an explicit `agentScope: "project"` run | closed |
| T-04-10 | Information disclosure | pinned texts naming machine paths | low | mitigate | no absolute machine path (`/home/`, `/root/`, `/tmp/`) appears in `features/agent/*.feature`; the default-scope untrusted text that names the checkout path is recorded only in `04-03-SUMMARY.md` | closed |
| T-04-11 | Elevation of privilege | a disabled or uninstalled plugin's agent staying runnable | medium | mitigate | `features/agent/lifecycle.feature` scenarios "Disabling a plugin removes its agent from pi-subagents' list" (l.23) and "Uninstalling a plugin removes its agent from the list" (l.54) observe the list in a new session; `unstagePluginAgents` (`bridges/agents/unstage.ts` l.49-86) removes each recorded `targetPath` after the ownership check | closed |
| T-04-12 | Information disclosure | `bridges/agents/skill-preload.ts` inlining a hidden skill | medium | mitigate | the eligibility rule (l.81-86) skips `disable-model-invocation: true` and a skill with no non-blank `description` or `when_to_use` before any text is built; convert test "leaves a ${reason} skip out of skills with its warning" (`D-CF4-04 skill preloads`, l.2392+) and scenarios (B), (C), (E) of plan 04-05 | closed |
| T-04-13 | Elevation of privilege | inline `!` commands in a preloaded skill | high | mitigate | `rule-packs/architecture.json` `child-process-chokepoint` excludes no `bridges/agents/` file; no `bridges/agents/` file imports `node:child_process`, `platform/prompt-shell.ts`, or `domain/context-injection.ts` (grep, rc=1); the content is written as literal text after the agent body. Residual recorded under D-CF4-04 (pi-subagents does not run `!` lines in an agent prompt) | closed |
| T-04-14 | Tampering | a skill body holding frontmatter-looking lines | medium | mitigate | the blocks are appended after the generated closing `---`; convert test "an inlined text with frontmatter-looking lines leaves the generated frontmatter unchanged" parses the file back with `parseFrontmatter` and `deepStrictEqual`s its `raw` to the plain conversion's | closed |
| T-04-15 | Tampering | reading a file outside the plugin through a skill row | low | mitigate | `readSkillPreloads` (l.50-66) reads only `path.join(row.sourcePath, "SKILL.md")` for rows from `skillSources`, which come only from the skills phase (`install-outcome.ts` l.1315 `c.stagedSkillRecords`, `update-swap.ts` l.407); skills discovery accepts a folder only when `lstat` reports a regular, non-symlink `SKILL.md` (`bridges/skills/discover.ts` l.76-93) | closed |
| T-04-16 | Spoofing | preloading another plugin's skill | low | accept | see Accepted Risks Log | closed |
| T-04-17 | Repudiation | posting the pi-subagents report on the user's behalf | low | mitigate | `04-06-SUMMARY.md` "pi-subagents report (D-CF4-09, D-CF4-10; drafted, not filed)": the phase filed nothing; the user decides | closed |
| T-04-18 | Tampering | a gate fix weakening a test to pass | medium | mitigate | `04-06-SUMMARY.md`: "The gate passed on the combined tree with no fix, so no source file changed"; no test was changed by the gate plan | closed |
| T-04-SC | Tampering | package installs (all six plans) | low | accept | see Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Summary Threat Flags

All six SUMMARYs report "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced." No new flag to classify.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-04 | Upstream parity (D-CF4-14): Claude Code puts plugin agent descriptions in front of its model too. pi-subagents strips control characters, XML-escapes each description, cuts it at 512 bytes, and caps the catalog at 16 agents and 12,288 bytes (`src/agents/advertised-agent-prompt.js`, checked in the peer cache) | plan 04-01 threat model | 2026-11-01 |
| AR-04-02 | T-04-08 | Upstream parity (D-CF4-05): Claude Code runs plugin agents in the foreground by default; the call can still ask for the background | plan 04-02 threat model | 2026-11-01 |
| AR-04-03 | T-04-16 | A reference qualified with another plugin stays dropped with a staging warning (convert test l.379-392); Claude Code's cross-plugin fallback is a recorded residual | plan 04-05 threat model | 2026-11-01 |
| AR-04-04 | T-04-SC | No plan installs a package (research Package Legitimacy Audit: none); plan 04-06 only refreshed the optional-peer cache that the lockfile and the declared floors already pin, through the T-01-02 controls of `scripts/install-test-peers.mjs` | plan threat models | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 19 | 19 | 0 | gsd-secure-phase (ASVS L1, inline verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
