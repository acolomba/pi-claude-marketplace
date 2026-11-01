---
phase: "02"
slug: "skills"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of the 7 plans (`02-01-PLAN.md` to `02-07-PLAN.md`), written at plan time. Each mitigation was checked against the merged tree at ASVS level 1 (the code or test the plan names exists and does what the plan promised). Block threshold: `high`. Every `## Threat Flags` section of the 7 summaries reads "None".

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| plugin author -> staged frontmatter | the source `SKILL.md` frontmatter `name` and directory name flow into the record the bridge writes | author strings |
| staged file -> session loader | the alias loader and the invocation read the record back as data | stored names, plugin paths |
| plugin author -> install diagnostic | author frontmatter keys become warning text the user reads | field keys |
| user input (TUI, RPC client) -> shell | typed arguments flow into a plugin skill whose `!` commands run on the user's machine | user input, shell commands |
| extension / model -> shell | another extension's message or the model's own skill read must not reach the runner | extension text, model reads |
| shell output -> model | command output is spliced into what the model receives | command output |
| plugin author -> slash namespace | a plugin's skills, its commands, other plugins, and Pi's commands compete for a typed name | slash names |
| plugin tree -> discovery | directory listings of the plugin's commands folders | file names (containment) |
| plugin lifecycle -> session | a verb's effect on what Pi loads at the next session | skill availability |
| test harness -> TUI process | the scenario starts a real Pi TUI on the sandbox | process lifetime, environment |
| phase -> public tracker | the Pi gap report is text for the user to file | report text |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `bridges/skills/skill-names.ts::writeSkillRecord` | medium | mitigate | One `JSON.stringify` line under `pi-claude-marketplace:` (l.185-197); `withoutRecordNode` replaces an existing key node (l.168-176); re-parse via `readSkillRecord` and throw on difference (l.198-202); tests "T-02-01: keeps quotes, colons, and newlines of a name inside the record" and "T-02-01: throws when the written record does not read back" (`test/bridges/skills/skill-names.test.ts` l.205, l.220); stage test "D-CF2-02: replaces an author's own record key with the stored record" (`stage.test.ts` l.1290); PARSE-02 re-parse follows the write in `stage.ts` | closed |
| T-02-02 | Tampering | reference rewrite over the stored names | medium | mitigate | `bridges/skills/stage.ts` l.360-369 writes the record after `rewriteMarkdownReferences` and `substituteClaudeVars`; `rewriteSupportingMarkdown` skips `skillFile` (l.164-174); `stage.test.ts` l.1049 stores `acme:review` unchanged in the record while the body's `acme:review` becomes `/skill:acme-review` | closed |
| T-02-03 | Information disclosure | absolute `pluginRoot`/`pluginData` in staged frontmatter | low | accept | see Accepted Risks Log | closed |
| T-02-04 | Denial of service | oversized frontmatter `name` | low | mitigate | `NAME_LIMIT = 256` and the length check in `frontmatterNameAliases` (`skill-names.ts` l.33, l.97); `skill-names.test.ts` l.55-59 pins 256 kept and 257 dropped | closed |
| T-02-05 | Repudiation | `stage.ts` (a field silently has no effect) | low | mitigate | `droppedInvocationFieldsWarning` (`domain/invocation-frontmatter.ts` l.35-41) called in `stage.ts` l.345; lines join the discovery warnings (l.505); `features/skill/frontmatter.feature` scenarios l.6, l.32, l.64 | closed |
| T-02-06 | Information disclosure | the dropped-fields warning text | low | mitigate | The line is `[<source dir>] dropped fields: <keys>`; keys are filtered to the fixed `UNHONORED_FIELDS` list, no value and no absolute path | closed |
| T-02-07 | Elevation of privilege | `edge/skill-aliases.ts` (extension text or a model read reaching the runner) | high | mitigate | `event.source === "extension"` returns `continue` before any parse (l.164-166); only the `input` event reaches `invokeBridgedSkill`, the sole caller of `expandContextInjections` and the prompt-shell runner (no tool or model-read hook); `findBridgedSkill` (`orchestrators/skill-invocation.ts` l.104-131) requires the loaded file to be this extension's staged `SKILL.md` in the user or project root; tests `skill-aliases.test.ts` l.106 (extension), l.128 (interactive and RPC), `skill-invocation.test.ts` l.283 (not-bridged cases) | closed |
| T-02-08 | Tampering | typed arguments forming a `!` command (carries T-01-22) | high | mitigate | `fillSkill` runs `substituteArguments` (l.175-180) before `expandContextInjections` (l.190); `guardBangs` in `domain/argument-substitution.ts` (l.133, l.142) escapes a word-initial `!`; injection scans once; unit "T-01-22: substitutes before injection..." (`skill-invocation.test.ts` l.377); scenario "An argument that starts with an exclamation mark reaches the model escaped and runs nothing" (`features/skill/invocation.feature` l.96) | closed |
| T-02-09 | Information disclosure | failure output reaching the model (carries T-01-24) | medium | mitigate | `invokeBridgedSkill` maps `ContextInjectionError`/`InvocationTooLargeError` to `abort` (l.216-224), bash-missing to `abort` (l.186-188); `inputResult` returns `handled` and calls `reportAbort` -> `notifyUsageError` from `shared/notification-dispatch.ts` (`skill-aliases.ts` l.89-91, l.115-122); unit tests l.386, l.434 (`skill-aliases.test.ts`), l.394, l.418, l.439 (`skill-invocation.test.ts`); scenario "A failing context command stops the skill and reports Claude Code's message" (`invocation.feature` l.75) | closed |
| T-02-10 | Elevation of privilege | RPC clients can trigger a plugin's `!` commands (D-CF2-05) | medium | accept | see Accepted Risks Log | closed |
| T-02-11 | Denial of service | runaway `!` command or oversized arguments | medium | mitigate | `platform/prompt-shell.ts` `DEFAULT_TIMEOUT_MS = 120_000` with process-group stop (T-01-23); `MAX_CHARACTERS = 4_000_000` -> `InvocationTooLargeError` (`argument-substitution.ts` l.30, l.145) -> abort; unit `skill-invocation.test.ts` l.439 | closed |
| T-02-12 | Spoofing | `/skill:<name>` handled for a user's own Pi skill | low | mitigate | `findBridgedSkill` compares the loaded path to `<root>/pi-claude-marketplace/resources/skills/<name>/SKILL.md` for the agent dir and `<cwd>/.pi` only; otherwise `not-bridged` -> `continue`; tests `skill-invocation.test.ts` l.283 (other path, unreported name, prompt template) and `skill-aliases.test.ts` l.188 | closed |
| T-02-13 | Spoofing | `discover.ts` (a skill and a command claim one name) | medium | mitigate | `discovery.commandNames.has(identityName)` skips the skill with `shadowedByCommandWarning` (`bridges/skills/discover.ts` l.155-156); `features/skill/collisions.feature` l.7, l.34, l.58 | closed |
| T-02-14 | Tampering | listing a commands folder | low | mitigate | `commandUpstreamNames` lists only `resolved.componentPaths.commands` (`discover.ts` l.243-246) through `readDirEntriesTolerant` and `isPlainMarkdownFile` (`skill-names.ts` l.136-149; `shared/fs-utils.ts` l.208) | closed |
| T-02-15 | Elevation of privilege | disabled or uninstalled plugin's skill still expanded | medium | mitigate | `features/skill/lifecycle.feature` l.19, l.24 (`/skill:demo-greet` reaches the model as text), l.45 (uninstall); `features/skill/aliases.feature` l.183 (disabled alias); the alias loader keeps only skills Pi loaded (`orchestrators/skill-alias-state.ts` l.114) | closed |
| T-02-16 | Spoofing | `orchestrators/skill-alias-state.ts` (alias hijacks a command or another plugin's name) | medium | mitigate | Non-skill command names reserved and first claim wins (l.129-131, l.157-163); `edge/skill-aliases.ts` l.173-176 leaves a non-skill command's token to Pi; install never stores a qualified alias equal to a command name (`createSkillNameClaims`, `skill-names.ts` l.112-129); unit "SK-6: ..." (`skill-alias-state.test.ts` l.258); scenarios `aliases.feature` l.41, l.71, l.133, l.162 | closed |
| T-02-17 | Tampering | hand-edited staged record adds aliases | low | accept | see Accepted Risks Log | closed |
| T-02-18 | Denial of service | TUI process outliving its scenario or writing outside the sandbox | low | mitigate | `this.onRelease(() => tui.stop())` right after start (`features/support/world.ts` l.663, `features/step_definitions/skill/aliases.steps.ts` l.69); `features/lib/pi-tui.ts` l.193-194 spawns `detached` with `rpcChildEnvironment(sandbox, git)` (allowlist, git keys, sandbox `TMPDIR`, `PI_OFFLINE=1`) | closed |
| T-02-19 | Repudiation | posting the Pi report on the user's behalf | low | mitigate | The D-CF2-10 report is drafted in `02-07-SUMMARY.md` and marked not filed | closed |
| T-02-20 | Tampering | a gate fix weakening a test | medium | mitigate | `02-07-SUMMARY.md` records that the gate passed with no fix, so no test changed | closed |
| T-02-SC | Tampering | package installs (all 7 plans) | low | accept | see Accepted Risks Log | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Phase 01 Carry-forward (T-01-22, T-01-24) — closed for skills

`01-SECURITY.md` "Carry-forward to Phases 2 and 3" asked the wiring phase to show three things. For skills, all three now hold end to end:

| Requirement | Evidence |
|-------------|----------|
| Substitution runs before `expandContextInjections` | `orchestrators/skill-invocation.ts::fillSkill` l.175-198; unit `skill-invocation.test.ts` l.377; scenario `invocation.feature` l.96 |
| `ContextInjectionError` / `InvocationTooLargeError` / bash-missing abort reports through `shared/notification-dispatch.ts` and nothing reaches the model | `invokeBridgedSkill` l.186-188, l.216-224 -> `edge/skill-aliases.ts::inputResult` returns `handled` and calls `notifyUsageError` (l.89-91, l.115-122); units `skill-invocation.test.ts` l.394, l.418, l.439 and `skill-aliases.test.ts` l.386, l.434; scenario `invocation.feature` l.75 |
| Only user-invoked skills reach the runner (D-CF1-03) | `invokeBridgedSkill` is called only from the `input` handler in `edge/skill-aliases.ts`, which returns `continue` for `extension` input; `expandContextInjections` and `createPromptShellRunner` have no other production caller; the model's skill reads have no extension hook; a non-staged skill is `not-bridged` |

Commands are still open on this carry-forward until Phase 3 wires the command invocation handler.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-03 | The staged body already holds these paths after install-time `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_PLUGIN_DATA}` substitution (SUB-01); same trust, same reader | plan 02-01 threat model | 2026-11-01 |
| AR-02-02 | T-02-10 | Same trust as interactive input and as Claude Code's print mode; the plugin was installed by the user; recorded under D-CF2-05 and DC-24 item 3 | plan 02-03 threat model (D-CF2-05) | 2026-11-01 |
| AR-02-03 | T-02-17 | The staged file sits under the user's own scope root; editing it is the same trust as editing the skill itself, and the invocation still requires the staged path | plan 02-06 threat model | 2026-11-01 |
| AR-02-04 | T-02-SC (plans 02-01 to 02-07) | No plan installs a package; `package.json` and `package-lock.json` have no commit since the Phase 1 dependency raise | plan threat models | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 21 | 21 | 0 | gsd-secure-phase (ASVS L1, inline verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
